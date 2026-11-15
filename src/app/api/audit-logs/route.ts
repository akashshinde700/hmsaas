/**
 * AUDIT LOGS API
 * GET    /api/audit-logs?organizationId=...&limit=50  — list audit logs (tenant-scoped)
 * POST   /api/audit-logs                              — create an audit log entry
 *
 * Multi-tenant isolation: requires organizationId in query/body.
 * Only accessible by admin/super_admin roles of that organization.
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organizationId') || session.organizationId
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const actor = searchParams.get('actor') || undefined
  const action = searchParams.get('action') || undefined
  const entity = searchParams.get('entity') || undefined

  // Tenant guard: only allow own org
  if (orgId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  const logs = await dbUnscoped.auditLog.findMany({
    where: {
      organizationId: orgId,
      ...(actor ? { actorName: { contains: actor } } : {}),
      ...(action ? { action: { contains: action } } : {}),
      ...(entity ? { entity: { contains: entity } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return apiJson({ logs, count: logs.length }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const body = await req.json()
  const { organizationId, actorName, actorRole, action, entity, details } = body

  if (!organizationId || !actorName || !action || !entity) {
    return apiJson(
      { error: 'organizationId, actorName, action, entity are required.' },
      { status: 400, startMs }
    )
  }

  // Tenant guard
  if (organizationId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  const log = await dbUnscoped.auditLog.create({
    data: {
      organizationId,
      actorName,
      actorRole: actorRole || session.role,
      action,
      entity,
      details: details ? String(details) : null,
    },
  })

  return apiJson({ log }, { status: 201, startMs })
}
