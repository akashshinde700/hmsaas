import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'
import { MODULE_REGISTRY } from '@/lib/role-access'

// Visibility controls dashboard navigation, not API authorization.
export async function GET(req: NextRequest) {
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401 })
  const settings = await dbUnscoped.clinicSettings.findUnique({
    where: { organizationId: session.organizationId },
    select: { moduleVisibility: true },
  })
  let moduleVisibility: Record<string, boolean> = {}
  try { moduleVisibility = JSON.parse(settings?.moduleVisibility || '{}') } catch { /* defaults */ }
  return apiJson({ moduleVisibility })
}

export async function PATCH(req: NextRequest) {
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401 })
  const user = await dbUnscoped.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, isActive: true },
    select: { role: true },
  })
  if (!user || !['admin', 'super_admin'].includes(user.role.toLowerCase())) {
    return apiJson({ error: 'Only organization administrators can change module visibility.' }, { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return apiJson({ error: 'Invalid JSON' }, { status: 400 }) }
  const incoming = (body as { moduleVisibility?: unknown })?.moduleVisibility
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return apiJson({ error: 'moduleVisibility must be an object' }, { status: 400 })
  }
  const entries = Object.entries(incoming)
  if (entries.some(([key, value]) => !Object.hasOwn(MODULE_REGISTRY, key) || key === 'settings' || typeof value !== 'boolean')) {
    return apiJson({ error: 'Invalid module visibility values. Settings must remain available.' }, { status: 400 })
  }
  const orgId = session.organizationId
  const existing = await dbUnscoped.clinicSettings.findUnique({ where: { organizationId: orgId }, select: { moduleVisibility: true } })
  let merged: Record<string, boolean> = {}
  try { merged = JSON.parse(existing?.moduleVisibility || '{}') } catch { /* defaults */ }
  if (!merged || typeof merged !== 'object' || Array.isArray(merged)) merged = {}
  delete merged.settings
  for (const [key, value] of entries) merged[key] = value as boolean
  await dbUnscoped.clinicSettings.upsert({
    where: { organizationId: orgId },
    update: { moduleVisibility: JSON.stringify(merged) },
    create: { organizationId: orgId, clinicDisplayName: 'Hospital', moduleVisibility: JSON.stringify(merged) },
  })
  invalidateCachePrefix(`dash:${orgId}`)
  return apiJson({ moduleVisibility: merged })
}
