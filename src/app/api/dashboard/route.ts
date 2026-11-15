import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, getOrSetCache } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'
import { calculateIpdRunningBill } from '@/lib/ipd-billing'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgId = session.organizationId
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data, hit } = await getOrSetCache(`dash:${orgId}`, 8_000, async () => {
    const [
      totalPatients,
      opdToday,
      beds,
      activeAdmissions,
      recentPrescriptions,
      invoices,
      globalMedCount,
      customMedCount,
      pendingLabs,
      doctors,
      allStaffCount,
      branchesCount,
      settings,
      org,
    ] = await Promise.all([
      db.patient.count({ where: { organizationId: orgId } }),
      db.opdQueue.findMany({
        where: { organizationId: orgId, queueDate: todayStr },
        include: { patient: true, doctor: { select: { id: true, name: true } } },
        orderBy: { tokenNumber: 'asc' },
      }),
      db.bed.findMany({
        where: { organizationId: orgId },
        include: { category: true },
      }),
      db.ipdAdmission.findMany({
        where: { organizationId: orgId, dischargedAt: null },
        include: {
          patient: true,
          bed: { include: { category: true } },
          admittingDoctor: { select: { id: true, name: true } },
          chargeItems: true,
          medicationOrders: true,
          deposits: true,
        },
        orderBy: { admittedAt: 'desc' },
      }),
      db.prescription.findMany({
        where: { organizationId: orgId },
        include: {
          patient: { select: { name: true, uhid: true } },
          doctor: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.invoice.findMany({
        where: { organizationId: orgId },
        select: { totalAmount: true, amountPaid: true, balanceDue: true, billType: true, createdAt: true },
      }),
      dbUnscoped.medicine.count({ where: { organizationId: null, isActive: true } }),
      dbUnscoped.medicine.count({ where: { organizationId: orgId, isActive: true } }),
      db.labOrder.count({ where: { organizationId: orgId, status: { not: 'completed' } } }),
      db.user.findMany({
        where: { organizationId: orgId, isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          specialization: true,
          qualification: true,
          registrationNo: true,
          consultationFee: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.user.count({ where: { organizationId: orgId, isActive: true } }),
      db.branch.count({ where: { organizationId: orgId } }),
      db.clinicSettings.findFirst({ where: { organizationId: orgId } }),
      dbUnscoped.organization.findUnique({
        where: { id: orgId },
        include: { subscription: { include: { plan: true } } },
      }),
    ])

    const occupiedBedIds = new Set(activeAdmissions.map((a) => a.bedId))
    const totalBeds = beds.length
    const occupiedBeds = occupiedBedIds.size
    const maintenanceBeds = beds.filter(
      (b) => !occupiedBedIds.has(b.id) && (b.status === 'maintenance' || b.status === 'cleaning')
    ).length
    const freeBeds = Math.max(0, totalBeds - occupiedBeds - maintenanceBeds)

    const enrichedActiveAdmissions = activeAdmissions.map((adm) => {
      const financials = calculateIpdRunningBill({
        admittedAt: adm.admittedAt,
        dailyRate: adm.bed.category.dailyRate,
        nursingChargeDay: adm.bed.category.nursingChargeDay,
        chargeItems: adm.chargeItems,
        medicationOrders: adm.medicationOrders,
        deposits: adm.deposits,
        preAuthAmount: adm.preAuthAmount,
      })
      return {
        ...adm,
        financials,
      }
    })

    const collectedRevenue = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0)
    const runningIpdUnbilled = enrichedActiveAdmissions.reduce(
      (s, i) => s + i.financials.grossTotal,
      0
    )

    const plan = org?.subscription?.plan
    const doctorsCount = doctors.filter(
      (u) => u.role.toLowerCase().includes('doctor') || u.role.toLowerCase().includes('admin')
    ).length

    return {
      kpis: {
        totalPatients,
        opdTotalToday: opdToday.length,
        opdTodayTotal: opdToday.length,
        opdWaiting: opdToday.filter((q) => q.status === 'waiting' || q.status === 'vitals_done').length,
        opdInConsult: opdToday.filter((q) => q.status === 'in_consultation').length,
        opdCompleted: opdToday.filter((q) => q.status === 'completed').length,
        totalBeds,
        occupiedBeds,
        availableBeds: freeBeds,
        freeBeds,
        maintenanceBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        occupancyPercent: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        collectedRevenue,
        runningIpdUnbilled,
        ipdRunningUnbilled: runningIpdUnbilled,
        pendingLabs,
        medicineCatalogCount: globalMedCount + customMedCount,
        medwikiCatalogSize: globalMedCount + customMedCount,
      },
      planUsage: {
        planName: plan?.name || 'Advance Hospital',
        tier: plan?.tier || 'advance',
        status: org?.subscription?.status || org?.status || 'active',
        billingCycle: org?.subscription?.billingCycle || 'monthly',
        trialEndsAt: org?.subscription?.trialEndsAt || null,
        currentPeriodEnd: org?.subscription?.currentPeriodEnd || null,
        doctorsUsed: doctorsCount,
        doctorLimit: plan?.doctorLimit ?? 10,
        bedsUsed: totalBeds,
        bedLimit: plan?.bedLimit ?? 50,
        staffUsed: allStaffCount,
        staffLimit: plan?.staffLimit ?? 25,
        branchesUsed: branchesCount,
        branchLimit: plan?.branchLimit ?? 3,
        storageLimitMB: plan?.storageLimitMB ?? 10240,
      },
      doctors,
      settings,
      opdQueue: opdToday.slice(0, 12),
      activeAdmissions: enrichedActiveAdmissions,
      recentPrescriptions,
    }
  })

  return apiJson(data, { startMs, cacheHit: hit })
}
