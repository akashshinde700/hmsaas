import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'
import { encryptSecret, generateStrongPassword, hashPassword } from '@/lib/crypto'

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
  const action = String(body.action || 'updateBranding')

  if (action === 'addStaff' || action === 'createStaff') {
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim()
    if (!email || !name) {
      return apiJson({ error: 'Name and email are required.' }, { status: 400, startMs })
    }
    const exists = await dbUnscoped.user.findUnique({ where: { email } })
    if (exists) {
      return apiJson({ error: 'Email already in use.' }, { status: 409, startMs })
    }
    const tempPassword = String(body.password || generateStrongPassword())
    const mainBranch = await db.branch.findFirst({ where: { organizationId: orgId } })
    const created = await db.user.create({
      data: {
        organizationId: orgId,
        branchId: mainBranch?.id || null,
        email,
        password: await hashPassword(tempPassword),
        generatedPasswordEnc: encryptSecret(tempPassword),
        name,
        phone: body.phone ? String(body.phone) : null,
        role: String(body.role || 'DOCTOR'),
        specialization: body.specialization ? String(body.specialization) : null,
        qualification: body.qualification ? String(body.qualification) : null,
        registrationNo: body.registrationNo ? String(body.registrationNo) : null,
        consultationFee: Number(body.consultationFee || 500),
        takesConsultations:
          String(body.role || '').toLowerCase() === 'doctor' || Boolean(body.takesConsultations),
        ...(body.role === 'doctor'
          ? { portalAccessEnabled: Boolean(body.portalAccessEnabled) }
          : {}),
      },
    })
    invalidateCachePrefix(`dash:${orgId}`)
    return apiJson({ user: created, temporaryPassword: tempPassword }, { status: 201, startMs })
  }

  if (action === 'completeOnboarding') {
    const onboardingPayload = {
      primarySpecialty: String(body.primarySpecialty || 'Multispecialty OPD + IPD'),
      opdTimings: String(body.opdTimings || '09:00 AM – 09:00 PM'),
      avgDailyOpd: String(body.avgDailyOpd || '40–80 Patients'),
      ipdFocus: String(body.ipdFocus || 'General + Private + ICU Wards'),
      heardFrom: String(body.heardFrom || 'Doctor Peer Referral'),
      completedAt: new Date().toISOString(),
      completedBy: session.email,
    }

    const updated = await dbUnscoped.clinicSettings.upsert({
      where: { organizationId: orgId },
      update: {
        ...(body.clinicDisplayName
          ? { clinicDisplayName: String(body.clinicDisplayName).trim() }
          : {}),
        ...(body.uhidPrefix ? { uhidPrefix: String(body.uhidPrefix).toUpperCase().trim() } : {}),
        ...(body.phone ? { phone: String(body.phone).trim() } : {}),
        ...(body.upiId ? { upiId: String(body.upiId).trim() } : {}),
        ...(body.defaultLanguage ? { defaultLanguage: String(body.defaultLanguage) } : {}),
        onboardingCompleted: true,
        onboardingDataJson: JSON.stringify(onboardingPayload),
      },
      create: {
        organizationId: orgId,
        clinicDisplayName: String(body.clinicDisplayName || 'Hospital').trim(),
        uhidPrefix: String(body.uhidPrefix || 'UHID').toUpperCase().trim(),
        onboardingCompleted: true,
        onboardingDataJson: JSON.stringify(onboardingPayload),
      },
    })

    invalidateCachePrefix(`dash:${orgId}`)
    return apiJson({ settings: updated }, { startMs })
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
    invalidateCachePrefix(`dash:${orgId}`)
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
      ...(typeof body.patientPortalEnabled === 'boolean'
        ? { patientPortalEnabled: body.patientPortalEnabled }
        : {}),
      ...(body.portalWelcomeMessage
        ? { portalWelcomeMessage: String(body.portalWelcomeMessage) }
        : {}),
      ...(typeof body.pharmacyEnabled === 'boolean'
        ? { pharmacyEnabled: body.pharmacyEnabled }
        : {}),
      ...(typeof body.whatsappEnabled === 'boolean'
        ? { whatsappEnabled: body.whatsappEnabled }
        : {}),
      ...(body.whatsappGatewayUrl
        ? { whatsappGatewayUrl: String(body.whatsappGatewayUrl) }
        : {}),
      ...(body.whatsappApiKey
        ? { whatsappApiKey: String(body.whatsappApiKey) }
        : {}),
      ...(body.whatsappPhoneNumber
        ? { whatsappPhoneNumber: String(body.whatsappPhoneNumber) }
        : {}),
    },
    create: {
      organizationId: orgId,
      clinicDisplayName: String(body.clinicDisplayName || 'Hospital').trim(),
      ...(typeof body.patientPortalEnabled === 'boolean'
        ? { patientPortalEnabled: body.patientPortalEnabled }
        : {}),
      ...(body.portalWelcomeMessage
        ? { portalWelcomeMessage: String(body.portalWelcomeMessage) }
        : {}),
      ...(typeof body.pharmacyEnabled === 'boolean'
        ? { pharmacyEnabled: body.pharmacyEnabled }
        : {}),
      ...(typeof body.whatsappEnabled === 'boolean'
        ? { whatsappEnabled: body.whatsappEnabled }
        : {}),
      ...(body.whatsappGatewayUrl
        ? { whatsappGatewayUrl: String(body.whatsappGatewayUrl) }
        : {}),
      ...(body.whatsappApiKey
        ? { whatsappApiKey: String(body.whatsappApiKey) }
        : {}),
      ...(body.whatsappPhoneNumber
        ? { whatsappPhoneNumber: String(body.whatsappPhoneNumber) }
        : {}),
    },
  })

  invalidateCachePrefix(`dash:${orgId}`)
  return apiJson({ settings: updated }, { startMs })
}
