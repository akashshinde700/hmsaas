import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'
import { hashPassword } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgId = session.organizationId
  const [settings, staff, branches, org] = await Promise.all([
    db.clinicSettings.findFirst({ where: { organizationId: orgId } }),
    db.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        specialization: true,
        qualification: true,
        registrationNo: true,
        consultationFee: true,
        takesConsultations: true,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.branch.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } }),
    dbUnscoped.organization.findUnique({
      where: { id: orgId },
      include: { subscription: { include: { plan: true } } },
    }),
  ])

  return apiJson({ settings, staff, branches, organization: org }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgId = session.organizationId
  const body = await req.json()
  const action = String(body.action || 'updateSettings')

  if (action === 'addStaff') {
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim()
    if (!email || !name) {
      return apiJson({ error: 'Name and email are required.' }, { status: 400, startMs })
    }
    const exists = await dbUnscoped.user.findUnique({ where: { email } })
    if (exists) {
      return apiJson({ error: 'Email already in use.' }, { status: 409, startMs })
    }
    const mainBranch = await db.branch.findFirst({ where: { organizationId: orgId } })
    const created = await db.user.create({
      data: {
        organizationId: orgId,
        branchId: mainBranch?.id || null,
        email,
        password: await hashPassword(String(body.password || 'Doctor@123')),
        name,
        phone: body.phone ? String(body.phone) : null,
        role: String(body.role || 'doctor'),
        specialization: body.specialization ? String(body.specialization) : null,
        qualification: body.qualification ? String(body.qualification) : null,
        registrationNo: body.registrationNo ? String(body.registrationNo) : null,
        consultationFee: Number(body.consultationFee || 500),
        takesConsultations: body.role === 'doctor' || Boolean(body.takesConsultations),
      },
    })
    return apiJson({ user: created }, { status: 201, startMs })
  }

  if (action === 'addBranch') {
    const branch = await db.branch.create({
      data: {
        organizationId: orgId,
        name: String(body.name || '').trim(),
        code: String(body.code || `BR-${Math.floor(10 + Math.random() * 89)}`).toUpperCase(),
        city: body.city ? String(body.city) : 'Pune',
        address: body.address ? String(body.address) : null,
        phone: body.phone ? String(body.phone) : null,
      },
    })
    return apiJson({ branch }, { status: 201, startMs })
  }

  const updated = await dbUnscoped.clinicSettings.upsert({
    where: { organizationId: orgId },
    update: {
      clinicDisplayName: String(body.clinicDisplayName || 'Hospital').trim(),
      tagline: body.tagline ? String(body.tagline) : null,
      address: body.address ? String(body.address) : null,
      phone: body.phone ? String(body.phone) : null,
      emergencyPhone: body.emergencyPhone ? String(body.emergencyPhone) : null,
      email: body.email ? String(body.email) : null,
      gstNumber: body.gstNumber ? String(body.gstNumber) : null,
      uhidPrefix: String(body.uhidPrefix || 'UHID').toUpperCase(),
      upiId: body.upiId ? String(body.upiId) : null,
      bankName: body.bankName ? String(body.bankName) : null,
      bankAccountNo: body.bankAccountNo ? String(body.bankAccountNo) : null,
      bankIfsc: body.bankIfsc ? String(body.bankIfsc) : null,
      rxFooterNote: body.rxFooterNote ? String(body.rxFooterNote) : undefined,
    },
    create: {
      organizationId: orgId,
      clinicDisplayName: String(body.clinicDisplayName || 'Hospital').trim(),
    },
  })

  return apiJson({ settings: updated }, { startMs })
}
