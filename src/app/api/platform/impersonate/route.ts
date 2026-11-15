import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { createTenantToken, getPlatformSession, TENANT_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const platform = await getPlatformSession(req)
  if (!platform) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const organizationId = String(body.organizationId || '')
  const org = await dbUnscoped.organization.findUnique({
    where: { id: organizationId },
    include: { users: true },
  })
  if (!org) return apiJson({ error: 'Clinic not found.' }, { status: 404, startMs })

  const targetUser =
    org.users.find((u) => u.role === 'super_admin' && u.isActive) || org.users[0]
  if (!targetUser) {
    return apiJson({ error: 'Clinic has no user account to impersonate.' }, { status: 400, startMs })
  }

  await dbUnscoped.auditLog.create({
    data: {
      organizationId: org.id,
      actorName: platform.name,
      actorRole: 'platform_admin',
      action: 'IMPERSONATE_LOGIN',
      entity: 'User',
      details: `Platform Admin (${platform.email}) opened support session as ${targetUser.email}`,
    },
  })

  const token = createTenantToken(
    targetUser,
    { name: org.name, slug: org.slug },
    platform.email,
    60 * 60 * 2
  )

  const res = apiJson(
    {
      success: true,
      redirectTo: '/dashboard',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        organizationName: org.name,
      },
    },
    { startMs }
  )
  res.cookies.set(TENANT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2,
  })
  return res
}
