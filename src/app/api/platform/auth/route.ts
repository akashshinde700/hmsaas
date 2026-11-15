import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { createPlatformToken, getPlatformSession, PLATFORM_COOKIE } from '@/lib/auth'
import { hashPassword, verifyPassword } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  const adminCount = await dbUnscoped.platformAdmin.count()
  return apiJson(
    {
      admin: session
        ? { id: session.adminId, email: session.email, name: session.name }
        : null,
      needsBootstrap: adminCount === 0,
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
    res.cookies.delete(PLATFORM_COOKIE)
    return res
  }

  if (action === 'bootstrap') {
    const count = await dbUnscoped.platformAdmin.count()
    if (count > 0) {
      return apiJson({ error: 'Platform admin already exists.' }, { status: 400, startMs })
    }
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || 'Platform Admin').trim()
    const password = String(body.password || '')
    if (!email || password.length < 6) {
      return apiJson({ error: 'Valid email and 6+ char password required.' }, { status: 400, startMs })
    }
    const created = await dbUnscoped.platformAdmin.create({
      data: { email, name, password: await hashPassword(password) },
    })
    const token = createPlatformToken(created)
    const res = apiJson(
      { admin: { id: created.id, email: created.email, name: created.name } },
      { startMs }
    )
    res.cookies.set(PLATFORM_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const admin = await dbUnscoped.platformAdmin.findUnique({ where: { email } })

  if (!admin || !admin.isActive || !(await verifyPassword(password, admin.password))) {
    return apiJson({ error: 'Invalid platform admin email or password.' }, { status: 401, startMs })
  }

  await dbUnscoped.platformAdmin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  })

  const token = createPlatformToken(admin)
  const res = apiJson(
    { admin: { id: admin.id, email: admin.email, name: admin.name } },
    { startMs }
  )
  res.cookies.set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
