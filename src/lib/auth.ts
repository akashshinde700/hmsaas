import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { signToken, verifyToken } from './crypto'
import { dbUnscoped } from './db'

export const PLATFORM_COOKIE = 'hms_platform_session'
export const TENANT_COOKIE = 'hms_tenant_session'

export interface PlatformSessionPayload {
  kind: 'platform'
  adminId: string
  email: string
  name: string
}

export interface TenantSessionPayload {
  kind: 'tenant'
  userId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: string
  name: string
  email: string
  specialization?: string | null
  impersonatedBy?: string
}

export function createPlatformToken(admin: { id: string; email: string; name: string }): string {
  return signToken<PlatformSessionPayload>(
    {
      kind: 'platform',
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    },
    60 * 60 * 24 * 7
  )
}

export function createTenantToken(
  user: {
    id: string
    organizationId: string
    role: string
    name: string
    email: string
    specialization?: string | null
  },
  org: { name: string; slug: string },
  impersonatedBy?: string,
  ttlSeconds = 60 * 60 * 24 * 7
): string {
  return signToken<TenantSessionPayload>(
    {
      kind: 'tenant',
      userId: user.id,
      organizationId: user.organizationId,
      organizationName: org.name,
      organizationSlug: org.slug,
      role: user.role,
      name: user.name,
      email: user.email,
      ...(user.specialization ? { specialization: user.specialization } : {}),
      ...(impersonatedBy ? { impersonatedBy } : {}),
    },
    ttlSeconds
  )
}

export async function getPlatformSession(req?: NextRequest): Promise<PlatformSessionPayload | null> {
  let raw: string | undefined
  if (req) {
    raw = req.cookies.get(PLATFORM_COOKIE)?.value
  } else {
    const jar = await cookies()
    raw = jar.get(PLATFORM_COOKIE)?.value
  }
  const parsed = verifyToken<PlatformSessionPayload>(raw)
  if (!parsed || parsed.kind !== 'platform') return null
  return parsed
}

export async function getTenantSession(req?: NextRequest): Promise<TenantSessionPayload | null> {
  let raw: string | undefined
  if (req) {
    raw =
      req.cookies.get(TENANT_COOKIE)?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  } else {
    const jar = await cookies()
    raw = jar.get(TENANT_COOKIE)?.value
  }
  const parsed = verifyToken<TenantSessionPayload>(raw)
  if (!parsed || parsed.kind !== 'tenant') return null
  return parsed
}

export async function verifyActiveTenantSession(req?: NextRequest): Promise<TenantSessionPayload | null> {
  const session = await getTenantSession(req)
  if (!session) return null
  const org = await dbUnscoped.organization.findUnique({
    where: { id: session.organizationId },
    select: { status: true },
  })
  if (!org || org.status === 'suspended' || org.status === 'cancelled') {
    return null
  }
  return session
}
