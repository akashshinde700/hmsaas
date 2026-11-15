import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'
import { encryptSecret, generateStrongPassword, hashPassword } from '@/lib/crypto'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { id } = await context.params
  const body = await req.json()
  const action = String(body.action || '')

  const org = await dbUnscoped.organization.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      users: true,
    },
  })

  if (!org) {
    return apiJson({ error: 'Organization not found.' }, { status: 404, startMs })
  }

  if (action === 'changePlan') {
    const planId = String(body.planId || '')
    const plan = await dbUnscoped.plan.findUnique({ where: { id: planId } })
    if (!plan) return apiJson({ error: 'Plan not found.' }, { status: 404, startMs })
    if (org.subscription) {
      await dbUnscoped.subscription.update({
        where: { organizationId: org.id },
        data: { planId: plan.id },
      })
    } else {
      await dbUnscoped.subscription.create({
        data: { organizationId: org.id, planId: plan.id, status: 'active' },
      })
    }
    invalidateCachePrefix('tenant:')
    return apiJson({ success: true }, { startMs })
  }

  if (action === 'markPaid') {
    const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly'
    const days = billingCycle === 'yearly' ? 365 : 30
    const baseDate =
      org.subscription?.currentPeriodEnd && org.subscription.currentPeriodEnd > new Date()
        ? org.subscription.currentPeriodEnd
        : new Date()
    const nextEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

    await dbUnscoped.organization.update({
      where: { id: org.id },
      data: { status: 'active' },
    })

    if (org.subscription) {
      await dbUnscoped.subscription.update({
        where: { organizationId: org.id },
        data: {
          status: 'active',
          billingCycle,
          currentPeriodEnd: nextEnd,
          trialEndsAt: null,
          ...(body.planId ? { planId: String(body.planId) } : {}),
        },
      })
    }
    invalidateCachePrefix('tenant:')
    return apiJson({ success: true, currentPeriodEnd: nextEnd }, { startMs })
  }

  if (action === 'extendTrial') {
    const addDays = Number(body.days || 7)
    const base =
      org.subscription?.trialEndsAt && org.subscription.trialEndsAt > new Date()
        ? org.subscription.trialEndsAt
        : org.subscription?.currentPeriodEnd && org.subscription.currentPeriodEnd > new Date()
        ? org.subscription.currentPeriodEnd
        : new Date()
    const nextTrial = new Date(base.getTime() + addDays * 24 * 60 * 60 * 1000)

    await dbUnscoped.organization.update({
      where: { id: org.id },
      data: { status: 'active' },
    })
    if (org.subscription) {
      await dbUnscoped.subscription.update({
        where: { organizationId: org.id },
        data: {
          status: 'trialing',
          trialEndsAt: nextTrial,
          currentPeriodEnd: nextTrial,
        },
      })
    }
    return apiJson({ success: true, trialEndsAt: nextTrial }, { startMs })
  }

  if (action === 'suspend') {
    const nextStatus = org.status === 'suspended' ? 'active' : 'suspended'
    await dbUnscoped.organization.update({
      where: { id: org.id },
      data: { status: nextStatus },
    })
    if (org.subscription) {
      await dbUnscoped.subscription.update({
        where: { organizationId: org.id },
        data: { status: nextStatus },
      })
    }
    return apiJson({ success: true, status: nextStatus }, { startMs })
  }

  if (action === 'customizePlan') {
    const basePlan = org.subscription?.plan
    const customPlan = await dbUnscoped.plan.create({
      data: {
        name: `${org.name} — Custom`,
        tier: 'custom',
        doctorLimit: basePlan?.doctorLimit ?? 5,
        branchLimit: basePlan?.branchLimit ?? 2,
        staffLimit: basePlan?.staffLimit ?? 10,
        bedLimit: basePlan?.bedLimit ?? 25,
        storageLimitMB: basePlan?.storageLimitMB ?? 5120,
        priceMonthly: basePlan?.priceMonthly ?? 2999,
        priceYearly: basePlan?.priceYearly ?? 29990,
        featuresJson: basePlan?.featuresJson ?? '{"opd":true,"ipd":true,"medwiki":true,"lab":true}',
        isCustom: true,
        isActive: true,
      },
    })
    if (org.subscription) {
      await dbUnscoped.subscription.update({
        where: { organizationId: org.id },
        data: { planId: customPlan.id },
      })
    }
    return apiJson(
      {
        success: true,
        plan: {
          ...customPlan,
          features: JSON.parse(customPlan.featuresJson || '{}'),
        },
      },
      { startMs }
    )
  }

  if (action === 'resetAdminPassword') {
    const adminUser =
      org.users.find((u) => u.role === 'super_admin' && u.isActive) || org.users[0]
    if (!adminUser) {
      return apiJson({ error: 'No user account found in this clinic.' }, { status: 404, startMs })
    }
    const newPwd = generateStrongPassword(11)
    await dbUnscoped.user.update({
      where: { id: adminUser.id },
      data: {
        password: await hashPassword(newPwd),
        generatedPasswordEnc: encryptSecret(newPwd),
      },
    })
    return apiJson(
      {
        success: true,
        email: adminUser.email,
        temporaryPassword: newPwd,
      },
      { startMs }
    )
  }

  return apiJson({ error: `Unknown action: ${action}` }, { status: 400, startMs })
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const org = await dbUnscoped.organization.findUnique({ where: { id } })
  if (!org) return apiJson({ error: 'Organization not found.' }, { status: 404, startMs })

  if (String(body.confirmName || '').trim() !== org.name) {
    return apiJson(
      { error: `Confirmation mismatch. Type "${org.name}" exactly to delete.` },
      { status: 400, startMs }
    )
  }

  await dbUnscoped.organization.delete({ where: { id: org.id } })
  invalidateCachePrefix('platform:')
  return apiJson({ deleted: org.name }, { startMs })
}
