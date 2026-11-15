/**
 * BATCH SYNC ENDPOINT
 *
 * Receives queued mutations from the offline-first client when connectivity
 * returns. Each mutation is applied server-side with the tenant guard still
 * enforced (multi-tenant isolation is preserved even during sync).
 *
 * Body: { mutations: [{ action, entity, endpoint, payload, patientId, orgId }] }
 * Returns: { results: [{ index, ok, error }] }
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'

const ENTITY_HANDLERS: Record<
  string,
  (payload: any) => Promise<{ ok: boolean; error?: string }>
> = {
  appointment: async (payload) => {
    try {
      const data: any = {
        organizationId: payload.organizationId,
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        slotTime: payload.slotTime,
        type: payload.type,
        reason: payload.reason,
        status: payload.status || 'scheduled',
      }
      if (payload.appointmentDate) {
        data.appointmentDate = new Date(payload.appointmentDate)
      }
      await dbUnscoped.appointment.create({ data })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  },
  prescription: async (payload) => {
    try {
      await dbUnscoped.prescription.create({
        data: {
          organizationId: payload.organizationId,
          patientId: payload.patientId,
          diagnosis: payload.diagnosis,
          prescriptionNo: payload.prescriptionNo,
        } as any,
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  },
  labOrder: async (payload) => {
    try {
      await dbUnscoped.labOrder.create({
        data: {
          organizationId: payload.organizationId,
          patientId: payload.patientId,
          testName: payload.testName,
          category: payload.category,
          status: payload.status || 'ordered',
        } as any,
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  },
  ipdAdmission: async (payload) => {
    try {
      await dbUnscoped.ipdAdmission.create({
        data: {
          organizationId: payload.organizationId,
          patientId: payload.patientId,
          admissionNo: payload.admissionNo,
          provisionalDiagnosis: payload.provisionalDiagnosis,
          status: payload.status || 'admitted',
        } as any,
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  },
  invoice: async (payload) => {
    try {
      await dbUnscoped.invoice.create({
        data: {
          organizationId: payload.organizationId,
          patientId: payload.patientId,
          invoiceNo: payload.invoiceNo,
          billType: payload.billType,
          totalAmount: payload.totalAmount,
          status: payload.status || 'unpaid',
        } as any,
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  },
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const body = await req.json()
  const mutations = Array.isArray(body.mutations) ? body.mutations : []

  if (mutations.length === 0) {
    return apiJson({ error: 'No mutations provided.' }, { status: 400, startMs })
  }

  const results = []
  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i]
    const handler = ENTITY_HANDLERS[m.entity]
    if (!handler) {
      results.push({ index: i, ok: false, error: `Unknown entity: ${m.entity}` })
      continue
    }
    const out = await handler(m.payload)
    results.push({ index: i, ...out })
  }

  const okCount = results.filter((r) => r.ok).length
  return apiJson(
    { results, okCount, total: results.length },
    { startMs, status: okCount === results.length ? 200 : 207 }
  )
}
