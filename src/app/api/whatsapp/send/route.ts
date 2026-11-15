/**
 * WHATSAPP SEND API
 * POST /api/whatsapp/send — Send WhatsApp message via self-hosted gateway (OpenWA / Evolution API)
 * Body: { to, message, orgId }
 * Requires: whatsappEnabled + whatsappGatewayUrl + whatsappApiKey in ClinicSettings
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const { to, message, orgId = session.organizationId } = body

  if (!to || !message) {
    return apiJson({ error: 'to and message are required.' }, { status: 400, startMs })
  }

  if (orgId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  // Fetch WhatsApp config for the org
  const settings = await dbUnscoped.clinicSettings.findUnique({
    where: { organizationId: orgId },
    select: {
      whatsappEnabled: true,
      whatsappGatewayUrl: true,
      whatsappApiKey: true,
      whatsappPhoneNumber: true,
    },
  })

  if (!settings?.whatsappEnabled) {
    return apiJson(
      { error: 'WhatsApp is not enabled for this organization.' },
      { status: 403, startMs }
    )
  }

  if (!settings.whatsappGatewayUrl || !settings.whatsappApiKey) {
    return apiJson(
      { error: 'WhatsApp gateway URL and API key are required.' },
      { status: 400, startMs }
    )
  }

  // Format phone number (ensure country code)
  const phone = to.startsWith('+') ? to : `+91${to}`

  try {
    // Try Evolution API format first, fall back to OpenWA
    const gatewayUrl = settings.whatsappGatewayUrl.replace(/\/$/, '')

    // Try Evolution API /message/sendText/{instance}
    const evoRes = await fetch(`${gatewayUrl}/message/sendText/default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: settings.whatsappApiKey,
      },
      body: JSON.stringify({
        number: phone.replace('+', ''),
        text: message,
        options: { delay: 1000, presence: 'composing' },
      }),
    })

    if (evoRes.ok) {
      const data = await evoRes.json()
      await dbUnscoped.auditLog.create({
        data: {
          organizationId: orgId,
          actorName: session.name,
          actorRole: session.role,
          action: 'WHATSAPP_SENT',
          entity: 'WhatsAppMessage',
          details: `Sent WhatsApp to ${phone}`,
        },
      })
      return apiJson({ sent: true, provider: 'evolution-api', data }, { startMs })
    }

    // Try OpenWA /send-message
    const openwaRes = await fetch(`${gatewayUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.whatsappApiKey}`,
      },
      body: JSON.stringify({
        phone,
        message,
      }),
    })

    if (openwaRes.ok) {
      const data = await openwaRes.json()
      await dbUnscoped.auditLog.create({
        data: {
          organizationId: orgId,
          actorName: session.name,
          actorRole: session.role,
          action: 'WHATSAPP_SENT',
          entity: 'WhatsAppMessage',
          details: `Sent WhatsApp to ${phone}`,
        },
      })
      return apiJson({ sent: true, provider: 'openwa', data }, { startMs })
    }

    // Both failed
    const evoText = await evoRes.text()
    return apiJson(
      { error: 'WhatsApp gateway error', detail: evoText.slice(0, 200) },
      { status: 502, startMs }
    )
  } catch (err) {
    return apiJson(
      { error: 'WhatsApp send failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500, startMs }
    )
  }
}
