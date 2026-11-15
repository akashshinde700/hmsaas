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
    ] = await Promise.all([
      db.patient.count({ where: { organizationId: orgId } }),
      db.opdQueue.findMany({
        where: { organizationId: orgId, queueDate: todayStr },
        include: { patient: true, doctor: { select: { name: true } } },
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
          admittingDoctor: { select: { name: true } },
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
    ])

    const occupiedBedIds = new Set(activeAdmissions.map((a) => a.bedId))
    const totalBeds = beds.length
    const occupiedBeds = occupiedBedIds.size
    const maintenanceBeds = beds.filter(
      (b) => !occupiedBedIds.has(b.id) && (b.status === 'maintenance' || b.status === 'cleaning')
    ).length
    const freeBeds = Math.max(0, totalBeds - occupiedBeds - maintenanceBeds)

    const ipdSummaries = activeAdmissions.map((adm) => {
      const bill = calculateIpdRunningBill({
        admittedAt: adm.admittedAt,
        dailyRate: adm.bed.category.dailyRate,
        nursingChargeDay: adm.bed.category.nursingChargeDay,
        chargeItems: adm.chargeItems,
        medicationOrders: adm.medicationOrders,
        deposits: adm.deposits,
        preAuthAmount: adm.preAuthAmount,
      })
      return {
        id: adm.id,
        admissionNo: adm.admissionNo,
        patientName: adm.patient.name,
        uhid: adm.patient.uhid,
        bedNumber: adm.bed.bedNumber,
        wardName: adm.bed.category.name,
        doctorName: adm.admittingDoctor.name,
        diagnosis: adm.provisionalDiagnosis,
        admittedAt: adm.admittedAt,
        stayDays: bill.stayDays,
        grossTotal: bill.grossTotal,
        depositsPaid: bill.depositsPaidTotal,
        netPayable: bill.netPayable,
      }
    })

    const collectedRevenue = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0)
    const ipdRunningUnbilled = ipdSummaries.reduce((s, i) => s + i.grossTotal, 0)

    return {
      kpis: {
        totalPatients,
        opdTodayTotal: opdToday.length,
        opdWaiting: opdToday.filter((q) => q.status === 'waiting' || q.status === 'vitals_done').length,
        opdInConsult: opdToday.filter((q) => q.status === 'in_consultation').length,
        opdCompleted: opdToday.filter((q) => q.status === 'completed').length,
        totalBeds,
        occupiedBeds,
        freeBeds,
        maintenanceBeds,
        occupancyPercent: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        collectedRevenue,
        ipdRunningUnbilled,
        pendingLabs,
        medwikiCatalogSize: globalMedCount + customMedCount,
      },
      opdQueue: opdToday.slice(0, 8),
      activeIpd: ipdSummaries,
      recentPrescriptions,
    }
  })

  return apiJson(data, { startMs, cacheHit: hit })
}
