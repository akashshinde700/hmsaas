import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')

  const prescriptions = await db.prescription.findMany({
    where: {
      organizationId: session.organizationId,
      ...(patientId ? { patientId } : {}),
    },
    include: {
      patient: true,
      doctor: {
        select: {
          id: true,
          name: true,
          qualification: true,
          specialization: true,
          registrationNo: true,
        },
      },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return apiJson({ prescriptions }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const patientId = String(body.patientId || '')
  const diagnosis = String(body.diagnosis || '').trim()
  const items = Array.isArray(body.items) ? body.items : []

  if (!patientId || !diagnosis) {
    return apiJson({ error: 'Patient and diagnosis are required.' }, { status: 400, startMs })
  }

  const orgId = session.organizationId
  const rxCount = await db.prescription.count({ where: { organizationId: orgId } })
  const prescriptionNo = `RX-${String(rxCount + 1).padStart(4, '0')}`

  const created = await dbUnscoped.$transaction(async (tx) => {
    const rx = await tx.prescription.create({
      data: {
        organizationId: orgId,
        prescriptionNo,
        patientId,
        doctorId: body.doctorId || session.userId,
        opdQueueId: body.opdQueueId || null,
        chiefComplaints: body.chiefComplaints ? String(body.chiefComplaints).trim() : null,
        diagnosis,
        icdCode: body.icdCode ? String(body.icdCode).trim() : null,
        clinicalNotes: body.clinicalNotes ? String(body.clinicalNotes).trim() : null,
        labInvestigations: body.labInvestigations ? String(body.labInvestigations).trim() : null,
        advice: body.advice ? String(body.advice).trim() : null,
        adviceLanguage: String(body.adviceLanguage || 'en'),
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        recommendIpdAdmit: Boolean(body.recommendIpdAdmit),
        vitalsSnapshotJson: body.vitals ? JSON.stringify(body.vitals) : null,
        items: {
          create: items
            .filter((it: Record<string, unknown>) => String(it.medicineName || '').trim())
            .map((it: Record<string, unknown>) => ({
              medicineId: it.medicineId ? String(it.medicineId) : null,
              medicineName: String(it.medicineName).trim(),
              genericName: it.genericName ? String(it.genericName) : null,
              dosageForm: it.dosageForm ? String(it.dosageForm) : 'Tablet',
              strength: it.strength ? String(it.strength) : null,
              dosage: String(it.dosage || '1 tablet'),
              frequency: String(it.frequency || '1-0-1'),
              timing: String(it.timing || 'After Food'),
              duration: String(it.duration || '5 days'),
              route: String(it.route || 'Oral'),
              quantity: Number(it.quantity || 10),
              instructions: it.instructions ? String(it.instructions) : null,
            })),
        },
      },
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            name: true,
            qualification: true,
            specialization: true,
            registrationNo: true,
            consultationFee: true,
          },
        },
        items: true,
      },
    })

    // Auto-learn DoctorMedicineDefault & increment Medicine.usageCount
    for (const item of rx.items) {
      if (item.medicineId) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { usageCount: { increment: 1 } },
        }).catch(() => null)
      }
      await tx.doctorMedicineDefault.upsert({
        where: {
          organizationId_doctorId_medicineName: {
            organizationId: orgId,
            doctorId: rx.doctorId,
            medicineName: item.medicineName,
          },
        },
        update: {
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          timing: item.timing,
          route: item.route,
          instructions: item.instructions,
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
        create: {
          organizationId: orgId,
          doctorId: rx.doctorId,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          timing: item.timing,
          route: item.route,
          instructions: item.instructions,
          usageCount: 1,
        },
      })
    }

    if (body.opdQueueId) {
      await tx.opdQueue.updateMany({
        where: { id: String(body.opdQueueId), organizationId: orgId },
        data: {
          status: body.recommendIpdAdmit ? 'admitted_ipd' : 'completed',
          completedAt: new Date(),
        },
      })
    }

    // Optional: Auto-create OPD Consultation Bill
    if (body.generateOpdBill) {
      const fee = Number(body.consultationFee ?? rx.doctor.consultationFee ?? 500)
      const invCount = await tx.invoice.count({ where: { organizationId: orgId } })
      await tx.invoice.create({
        data: {
          organizationId: orgId,
          invoiceNo: `INV-${String(invCount + 1).padStart(4, '0')}`,
          patientId,
          billType: 'OPD',
          subtotal: fee,
          totalAmount: fee,
          amountPaid: body.markBillPaid ? fee : 0,
          balanceDue: body.markBillPaid ? 0 : fee,
          status: body.markBillPaid ? 'paid' : 'pending',
          paymentMode: body.markBillPaid ? 'UPI' : null,
          items: {
            create: [
              {
                category: 'Consultation',
                description: `OPD Consultation — ${rx.doctor.name} (${rx.prescriptionNo})`,
                quantity: 1,
                unitRate: fee,
                amount: fee,
              },
            ],
          },
        },
      })
    }

    return rx
  })

  invalidateCachePrefix(`meds:${orgId}:`)
  invalidateCachePrefix(`dash:${orgId}`)

  return apiJson({ prescription: created }, { status: 201, startMs })
}
