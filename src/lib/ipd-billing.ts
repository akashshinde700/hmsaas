export interface IpdFinancialSummary {
  stayDays: number
  dailyRoomRate: number
  dailyNursingRate: number
  roomChargesTotal: number
  nursingChargesTotal: number
  medicationChargesTotal: number
  procedureAndOtherChargesTotal: number
  grossTotal: number
  depositsPaidTotal: number
  preAuthAmount: number
  netPayable: number
}

export function calculateIpdRunningBill(params: {
  admittedAt: Date | string
  dischargedAt?: Date | string | null
  dailyRate: number
  nursingChargeDay: number
  chargeItems: Array<{ amount: number }>
  medicationOrders: Array<{ unitPrice: number; dosesGiven: number }>
  deposits: Array<{ amount: number }>
  preAuthAmount?: number
}): IpdFinancialSummary {
  const start = new Date(params.admittedAt).getTime()
  const end = params.dischargedAt ? new Date(params.dischargedAt).getTime() : Date.now()
  const diffHours = Math.max(1, (end - start) / (1000 * 60 * 60))
  // Minimum 1 day billed; every partial 24h cycle rounds up per standard Indian IPD tariff
  const stayDays = Math.max(1, Math.ceil(diffHours / 24))

  const roomChargesTotal = stayDays * (params.dailyRate || 0)
  const nursingChargesTotal = stayDays * (params.nursingChargeDay || 0)
  const procedureAndOtherChargesTotal = params.chargeItems.reduce((sum, c) => sum + (c.amount || 0), 0)
  const medicationChargesTotal = params.medicationOrders.reduce(
    (sum, m) => sum + (m.unitPrice || 0) * Math.max(1, m.dosesGiven || 1),
    0
  )

  const grossTotal =
    roomChargesTotal +
    nursingChargesTotal +
    procedureAndOtherChargesTotal +
    medicationChargesTotal

  const depositsPaidTotal = params.deposits.reduce((sum, d) => sum + (d.amount || 0), 0)
  const preAuthAmount = params.preAuthAmount || 0
  const netPayable = Math.max(0, grossTotal - depositsPaidTotal)

  return {
    stayDays,
    dailyRoomRate: params.dailyRate || 0,
    dailyNursingRate: params.nursingChargeDay || 0,
    roomChargesTotal,
    nursingChargesTotal,
    medicationChargesTotal,
    procedureAndOtherChargesTotal,
    grossTotal,
    depositsPaidTotal,
    preAuthAmount,
    netPayable,
  }
}
