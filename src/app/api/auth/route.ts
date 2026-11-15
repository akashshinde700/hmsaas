import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { createTenantToken, TENANT_COOKIE, verifyActiveTenantSession } from '@/lib/auth'
import { verifyPassword } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ user: null }, { startMs })

  const [org, settings, doctors] = await Promise.all([
    dbUnscoped.organization.findUnique({
      where: { id: session.organizationId },
      include: { subscription: { include: { plan: true } } },
    }),
    db.clinicSettings.findFirst({
      where: { organizationId: session.organizationId },
    }),
    db.user.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        takesConsultations: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        specialization: true,
        qualification: true,
        registrationNo: true,
        consultationFee: true,
      },
    }),
  ])

  return apiJson(
    {
      user: session,
      organization: org,
      settings,
      doctors,
    },
    { startMs }
  )
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const body = await req.json()
  const action = String(body.action || 'login')

  if (action === 'logout') {
    const res = apiJson({ success: true }, { startMs })
    res.cookies.delete(TENANT_COOKIE)
    return res
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  const user = await dbUnscoped.user.findUnique({
    where: { email },
    include: { organization: true },
  })

  if (!user || !user.isActive || !(await verifyPassword(password, user.password))) {
    return apiJson({ error: 'Invalid hospital email or password.' }, { status: 401, startMs })
  }

  if (user.organization.status === 'suspended' || user.organization.status === 'cancelled') {
    return apiJson(
      { error: `Organization "${user.organization.name}" is currently ${user.organization.status}. Contact Platform Admin.` },
      { status: 403, startMs }
    )
  }

  await dbUnscoped.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  const token = createTenantToken(user, {
    name: user.organization.name,
    slug: user.organization.slug,
  })

  const res = apiJson(
    {
      user: {
        userId: user.id,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationSlug: user.organization.slug,
        role: user.role,
        name: user.name,
        email: user.email,
      },
    },
    { startMs }
  )
  res.cookies.set(TENANT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
