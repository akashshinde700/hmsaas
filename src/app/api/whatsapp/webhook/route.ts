/**
 * WHATSAPP WEBHOOK API
 * POST /api/whatsapp/webhook — Receive incoming WhatsApp messages from gateway
 * Supports both Evolution API and OpenWA webhook formats
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'

export async function POST(req: NextRequest) {
  const startMs = performance.now()

  try {
    const body = await req.json()

    // Evolution API webhook format
    // OpenWA webhook format
    const eventType = body.event || body.type || 'message'
    const from = body.from || body.sender || body.phone
    const messageText = body.message || body.text?.body || body.content
    const instanceId = body.instance || body.instanceId || 'default'

    if (!from || !messageText) {
      return apiJson({ error: 'Missing from or message.' }, { status: 400, startMs })
    }

    // Store incoming message as audit log (for compliance)
    // Find org by phone number match
    const settings = await dbUnscoped.clinicSettings.findFirst({
      where: { whatsappPhoneNumber: { contains: instanceId } },
      select: { organizationId: true },
    })

    const orgId = settings?.organizationId || 'unknown'

    await dbUnscoped.auditLog.create({
      data: {
        organizationId: orgId,
        actorName: 'WhatsApp Gateway',
        actorRole: 'system',
        action: 'WHATSAPP_RECEIVED',
        entity: 'WhatsAppMessage',
        details: `Incoming from ${from}: ${messageText.slice(0, 200)}`,
      },
    })

    // Auto-reply: acknowledge receipt
    const autoReply = `धन्यवाद! आपका मैसेज रिसीव हो गया है। अस्पताल टीम जल्द ही जवाब देगी।`

    return apiJson({
      received: true,
      from,
      message: messageText,
      autoReply,
      orgId,
    }, { startMs })
  } catch (err) {
    return apiJson(
      { error: 'Webhook processing failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500, startMs }
    )
  }
}

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  // Webhook verification (for Evolution API / OpenWA challenge)
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return apiJson({ status: 'whatsapp webhook active' }, { startMs })
}
