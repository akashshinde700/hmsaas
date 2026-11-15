import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'
import { decryptSecret, encryptSecret, generateStrongPassword, hashPassword } from '@/lib/crypto'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgs = await dbUnscoped.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { include: { plan: true } },
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          generatedPasswordEnc: true,
        },
      },
      _count: {
        select: {
          branches: true,
          patients: true,
          beds: true,
        },
      },
      ipdAdmissions: {
        where: { dischargedAt: null },
        select: { id: true },
      },
    },
  })

  const formatted = orgs.map((org) => {
    const adminUser =
      org.users.find((u) => u.role === 'super_admin' && u.isActive) || org.users[0] || null
    const doctorsCount = org.users.filter(
      (u) => u.isActive && (u.role === 'doctor' || u.role === 'super_admin')
    ).length
    const staffCount = org.users.filter(
      (u) => u.isActive && u.role !== 'doctor'
    ).length

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      city: org.city,
      status: org.status,
      createdAt: org.createdAt,
      adminEmail: adminUser?.email || null,
      adminName: adminUser?.name || null,
      generatedPassword: decryptSecret(adminUser?.generatedPasswordEnc) || null,
      subscription: org.subscription
        ? {
            status: org.subscription.status,
            billingCycle: org.subscription.billingCycle,
            currentPeriodEnd: org.subscription.currentPeriodEnd,
            trialEndsAt: org.subscription.trialEndsAt,
            plan: {
              ...org.subscription.plan,
              features: JSON.parse(org.subscription.plan.featuresJson || '{}'),
            },
          }
        : null,
      usage: {
        doctors: doctorsCount,
        staff: staffCount,
        branches: org._count.branches,
        patients: org._count.patients,
        beds: org._count.beds,
        activeIpd: org.ipdAdmissions.length,
      },
    }
  })

  return apiJson(formatted, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const name = String(body.name || '').trim()
  const adminEmail = String(body.adminEmail || '').trim().toLowerCase()
  const adminName = String(body.adminName || 'Hospital Admin').trim()
  const city = String(body.city || 'Pune').trim()
  const phone = String(body.phone || '').trim()
  const planId = String(body.planId || '').trim()
  const startMode = String(body.startMode || 'trial7') // trial7, trial14, active_monthly, active_yearly

  if (!name || !adminEmail) {
    return apiJson({ error: 'Clinic/Hospital name and Admin email are required.' }, { status: 400, startMs })
  }

  const emailTaken = await dbUnscoped.user.findUnique({ where: { email: adminEmail } })
  if (emailTaken) {
    return apiJson({ error: `Email ${adminEmail} is already registered to another user.` }, { status: 409, startMs })
  }

  let baseSlug = slugify(name) || 'clinic'
  const slugConflict = await dbUnscoped.organization.findUnique({ where: { slug: baseSlug } })
  if (slugConflict) {
    baseSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`
  }

  const chosenPlan =
    (planId ? await dbUnscoped.plan.findUnique({ where: { id: planId } }) : null) ||
    (await dbUnscoped.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))

  if (!chosenPlan) {
    return apiJson({ error: 'No active plan available. Create a plan first.' }, { status: 400, startMs })
  }

  const plainPassword = String(body.password || '').trim() || generateStrongPassword(11)
  const passwordHash = await hashPassword(plainPassword)
  const encryptedPwd = encryptSecret(plainPassword)

  const now = new Date()
  const isTrial = startMode.startsWith('trial')
  const trialDays = startMode === 'trial14' ? 14 : 7
  const billingCycle = startMode === 'active_yearly' ? 'yearly' : 'monthly'
  const periodDays = billingCycle === 'yearly' ? 365 : 30

  const created = await dbUnscoped.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        slug: baseSlug,
        type: String(body.type || 'hospital'),
        city,
        phone: phone || null,
        email: adminEmail,
        status: isTrial ? 'trialing' : 'active',
      },
    })

    await tx.subscription.create({
      data: {
        organizationId: org.id,
        planId: chosenPlan.id,
        status: isTrial ? 'trialing' : 'active',
        billingCycle,
        paymentProvider: 'manual',
        currentPeriodStart: now,
        currentPeriodEnd: isTrial
          ? null
          : new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000),
        trialEndsAt: isTrial
          ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
          : null,
      },
    })

    const prefix = name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 3) || 'HMS'

    await tx.clinicSettings.create({
      data: {
        organizationId: org.id,
        clinicDisplayName: name,
        tagline: 'OPD, IPD & Digital Healthcare Center',
        address: city,
        phone: phone || null,
        email: adminEmail,
        uhidPrefix: prefix,
      },
    })

    const mainBranch = await tx.branch.create({
      data: {
        organizationId: org.id,
        name: `${city} Main Campus`,
        code: 'MAIN-01',
        city,
        phone: phone || null,
        isMain: true,
      },
    })

    const orgAdmin = await tx.user.create({
      data: {
        organizationId: org.id,
        branchId: mainBranch.id,
        email: adminEmail,
        password: passwordHash,
        generatedPasswordEnc: encryptedPwd,
        name: adminName,
        phone: phone || null,
        role: 'super_admin',
        specialization: 'General Medicine',
        qualification: 'MBBS, MD',
        takesConsultations: true,
      },
    })

    // Seed starter General Ward & ICU beds so IPD works immediately for the new hospital!
    const genWard = await tx.bedCategory.create({
      data: {
        organizationId: org.id,
        name: 'General Ward',
        code: 'GEN',
        floor: '1st Floor',
        dailyRate: 1500,
        nursingChargeDay: 350,
        color: '#0d9488',
      },
    })
    const icuWard = await tx.bedCategory.create({
      data: {
        organizationId: org.id,
        name: 'ICU',
        code: 'ICU',
        floor: '2nd Floor',
        dailyRate: 6500,
        nursingChargeDay: 1200,
        color: '#dc2626',
      },
    })
    for (const num of ['GEN-101', 'GEN-102', 'GEN-103']) {
      await tx.bed.create({
        data: {
          organizationId: org.id,
          branchId: mainBranch.id,
          categoryId: genWard.id,
          bedNumber: num,
          floor: '1st Floor',
          hasOxygen: true,
        },
      })
    }
    for (const num of ['ICU-01', 'ICU-02']) {
      await tx.bed.create({
        data: {
          organizationId: org.id,
          branchId: mainBranch.id,
          categoryId: icuWard.id,
          bedNumber: num,
          floor: '2nd Floor',
          hasOxygen: true,
          hasMonitor: true,
          hasVentilator: true,
        },
      })
    }

    return { org, orgAdmin }
  })

  invalidateCachePrefix('platform:')

  return apiJson(
    {
      organization: created.org,
      orgAdmin: { email: created.orgAdmin.email, name: created.orgAdmin.name },
      temporaryPassword: plainPassword,
    },
    { status: 201, startMs }
  )
}
