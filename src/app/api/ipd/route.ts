import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'
import { calculateIpdRunningBill } from '@/lib/ipd-billing'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgId = session.organizationId
  const { searchParams } = new URL(req.url)
  const show = searchParams.get('show') || 'all' // current, discharged, all

  const [categories, beds, admissions] = await Promise.all([
    db.bedCategory.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { dailyRate: 'asc' },
    }),
    db.bed.findMany({
      where: { organizationId: orgId },
      include: { category: true },
      orderBy: [{ categoryId: 'asc' }, { bedNumber: 'asc' }],
    }),
    db.ipdAdmission.findMany({
      where: {
        organizationId: orgId,
        ...(show === 'current'
          ? { dischargedAt: null }
          : show === 'discharged'
          ? { NOT: { dischargedAt: null } }
          : {}),
      },
      include: {
        patient: true,
        bed: { include: { category: true } },
        admittingDoctor: {
          select: { id: true, name: true, specialization: true, qualification: true, registrationNo: true },
        },
        roundNotes: { orderBy: { recordedAt: 'desc' } },
        medicationOrders: { orderBy: { startDate: 'desc' } },
        chargeItems: { orderBy: { chargedAt: 'desc' } },
        deposits: { orderBy: { depositedAt: 'desc' } },
        bedTransfers: {
          include: {
            fromBed: { select: { bedNumber: true } },
            toBed: { select: { bedNumber: true } },
          },
          orderBy: { transferredAt: 'desc' },
        },
      },
      orderBy: { admittedAt: 'desc' },
      take: 100,
    }),
  ])

  // ICTHospital core rule: Bed occupancy is derived from active admissions (`dischargedAt == null`),
  // never trusting stale manual flags alone!
  const activeByBedId = new Map(
    admissions.filter((a) => a.dischargedAt === null).map((a) => [a.bedId, a])
  )

  const enrichedBeds = beds.map((b) => {
    const activeAdm = activeByBedId.get(b.id)
    const effectiveStatus = activeAdm
      ? 'occupied'
      : b.status === 'occupied'
      ? 'free'
      : b.status
    return {
      ...b,
      effectiveStatus,
      occupant: activeAdm
        ? {
            admissionId: activeAdm.id,
            admissionNo: activeAdm.admissionNo,
            patientId: activeAdm.patientId,
            patientName: activeAdm.patient.name,
            uhid: activeAdm.patient.uhid,
            ageYears: activeAdm.patient.ageYears,
            gender: activeAdm.patient.gender,
            allergies: activeAdm.patient.allergies,
            diagnosis: activeAdm.provisionalDiagnosis,
            admittedAt: activeAdm.admittedAt,
            doctorName: activeAdm.admittingDoctor.name,
          }
        : null,
    }
  })

  const enrichedAdmissions = admissions.map((adm) => ({
    ...adm,
    financials: calculateIpdRunningBill({
      admittedAt: adm.admittedAt,
      dischargedAt: adm.dischargedAt,
      dailyRate: adm.bed.category.dailyRate,
      nursingChargeDay: adm.bed.category.nursingChargeDay,
      chargeItems: adm.chargeItems,
      medicationOrders: adm.medicationOrders,
      deposits: adm.deposits,
      preAuthAmount: adm.preAuthAmount,
    }),
  }))

  return apiJson(
    {
      categories,
      beds: enrichedBeds,
      admissions: enrichedAdmissions,
    },
    { startMs }
  )
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgId = session.organizationId
  const body = await req.json()
  const action = String(body.action || 'admit')

  try {
    // 1. ADMIT PATIENT TO BED (Transactional single-bed & single-patient lock)
    if (action === 'admit') {
      const patientId = String(body.patientId || '')
      const bedId = String(body.bedId || '')
      const provisionalDiagnosis = String(body.provisionalDiagnosis || '').trim()

      if (!patientId || !bedId || !provisionalDiagnosis) {
        return apiJson(
          { error: 'Patient, free IPD bed, and provisional diagnosis are required.' },
          { status: 400, startMs }
        )
      }

      const result = await dbUnscoped.$transaction(async (tx) => {
        const bedOccupied = await tx.ipdAdmission.findFirst({
          where: { organizationId: orgId, bedId, dischargedAt: null },
        })
        if (bedOccupied) {
          throw new Error('Selected bed is already occupied by an admitted patient.')
        }

        const patientAlreadyAdmitted = await tx.ipdAdmission.findFirst({
          where: { organizationId: orgId, patientId, dischargedAt: null },
        })
        if (patientAlreadyAdmitted) {
          throw new Error('This patient already has an active IPD admission. Discharge or transfer them instead.')
        }

        const [bed, patient, settings, admCount] = await Promise.all([
          tx.bed.findFirst({ where: { id: bedId, organizationId: orgId } }),
          tx.patient.findFirst({ where: { id: patientId, organizationId: orgId } }),
          tx.clinicSettings.findFirst({ where: { organizationId: orgId } }),
          tx.ipdAdmission.count({ where: { organizationId: orgId } }),
        ])

        if (!bed || !patient) {
          throw new Error('Invalid bed or patient for this hospital.')
        }

        const prefix = settings?.ipdPrefix || 'IPD'
        const admissionNo = `${prefix}-${String(admCount + 1).padStart(4, '0')}`
        const admittedAt = body.admittedAt ? new Date(body.admittedAt) : new Date()

        const admission = await tx.ipdAdmission.create({
          data: {
            organizationId: orgId,
            branchId: bed.branchId,
            admissionNo,
            patientId,
            bedId,
            admittingDoctorId: body.admittingDoctorId || session.userId,
            admissionType: String(body.admissionType || 'Emergency'),
            admittedAt,
            provisionalDiagnosis,
            chiefComplaints: body.chiefComplaints ? String(body.chiefComplaints) : null,
            allergiesSnapshot: patient.allergies,
            attendantName: body.attendantName ? String(body.attendantName) : null,
            attendantRelation: body.attendantRelation ? String(body.attendantRelation) : null,
            attendantPhone: body.attendantPhone ? String(body.attendantPhone) : null,
            insuranceTpa: body.insuranceTpa ? String(body.insuranceTpa) : patient.insuranceProvider,
            preAuthAmount: Number(body.preAuthAmount || 0),
            isMlc: Boolean(body.isMlc),
          },
        })

        await tx.bed.update({
          where: { id: bed.id },
          data: { status: 'occupied', lastAdmittedAt: admittedAt },
        })

        // Initial deposit if entered during admission
        const depositAmt = Number(body.initialDeposit || 0)
        if (depositAmt > 0) {
          const depCount = await tx.patientDeposit.count({ where: { organizationId: orgId } })
          await tx.patientDeposit.create({
            data: {
              organizationId: orgId,
              receiptNo: `DEP-${String(depCount + 1).padStart(4, '0')}`,
              patientId,
              ipdAdmissionId: admission.id,
              amount: depositAmt,
              paymentMode: String(body.depositMode || 'UPI'),
              notes: 'Initial IPD Admission Advance Deposit',
              receivedBy: session.name,
            },
          })
        }

        return admission
      })

      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ admission: result }, { status: 201, startMs })
    }

    // 2. DOCTOR / NURSING ROUND NOTE
    if (action === 'addRoundNote') {
      const note = await db.ipdRoundNote.create({
        data: {
          organizationId: orgId,
          ipdAdmissionId: String(body.ipdAdmissionId),
          authorId: session.userId,
          authorName: session.name,
          noteType: String(body.noteType || 'Doctor Round'),
          observations: String(body.observations || '').trim(),
          plan: body.plan ? String(body.plan).trim() : null,
          vitalsText: body.vitalsText ? String(body.vitalsText).trim() : null,
        },
      })
      return apiJson({ note }, { status: 201, startMs })
    }

    // 3. IPD MEDICATION ORDER (MAR)
    if (action === 'addMedication') {
      const order = await db.ipdMedicationOrder.create({
        data: {
          organizationId: orgId,
          ipdAdmissionId: String(body.ipdAdmissionId),
          medicineId: body.medicineId || null,
          orderedById: session.userId,
          medicineName: String(body.medicineName).trim(),
          genericName: body.genericName ? String(body.genericName) : null,
          strength: body.strength ? String(body.strength) : null,
          dosageForm: body.dosageForm ? String(body.dosageForm) : 'Injection',
          dosage: String(body.dosage || '1 vial'),
          route: String(body.route || 'IV'),
          frequency: String(body.frequency || '1-0-1'),
          duration: String(body.duration || '3 days'),
          unitPrice: Number(body.unitPrice || 0),
          dosesGiven: 1,
          lastGivenAt: new Date(),
        },
      })
      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ order }, { status: 201, startMs })
    }

    // 4. ADMINISTER DOSE ON MAR
    if (action === 'giveDose') {
      const order = await dbUnscoped.ipdMedicationOrder.findFirst({
        where: { id: String(body.orderId), organizationId: orgId },
      })
      if (!order) return apiJson({ error: 'Medication order not found.' }, { status: 404, startMs })
      const updated = await dbUnscoped.ipdMedicationOrder.update({
        where: { id: order.id },
        data: { dosesGiven: { increment: 1 }, lastGivenAt: new Date() },
      })
      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ order: updated }, { startMs })
    }

    // 5. ADD PROCEDURE / OT / CONSUMABLE CHARGE TO RUNNING IPD BILL
    if (action === 'addCharge') {
      const qty = Number(body.quantity || 1)
      const rate = Number(body.unitRate || 0)
      const charge = await db.ipdChargeItem.create({
        data: {
          organizationId: orgId,
          ipdAdmissionId: String(body.ipdAdmissionId),
          category: String(body.category || 'Procedure'),
          description: String(body.description || '').trim(),
          quantity: qty,
          unitRate: rate,
          amount: qty * rate,
          addedBy: session.name,
        },
      })
      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ charge }, { status: 201, startMs })
    }

    // 6. COLLECT ADVANCE DEPOSIT RECEIPT (ICTHospital `patient_deposit`)
    if (action === 'addDeposit') {
      const adm = await db.ipdAdmission.findFirst({
        where: { id: String(body.ipdAdmissionId), organizationId: orgId },
      })
      if (!adm) return apiJson({ error: 'Admission not found.' }, { status: 404, startMs })

      const depCount = await db.patientDeposit.count({ where: { organizationId: orgId } })
      const deposit = await db.patientDeposit.create({
        data: {
          organizationId: orgId,
          receiptNo: `DEP-${String(depCount + 1).padStart(4, '0')}`,
          patientId: adm.patientId,
          ipdAdmissionId: adm.id,
          amount: Number(body.amount || 0),
          paymentMode: String(body.paymentMode || 'UPI'),
          referenceNo: body.referenceNo ? String(body.referenceNo) : null,
          notes: body.notes ? String(body.notes) : 'Interim IPD Deposit',
          receivedBy: session.name,
        },
      })
      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ deposit }, { status: 201, startMs })
    }

    // 7. BED / WARD TRANSFER
    if (action === 'transferBed') {
      const ipdAdmissionId = String(body.ipdAdmissionId || '')
      const toBedId = String(body.toBedId || '')

      const updated = await dbUnscoped.$transaction(async (tx) => {
        const adm = await tx.ipdAdmission.findFirst({
          where: { id: ipdAdmissionId, organizationId: orgId, dischargedAt: null },
        })
        if (!adm) throw new Error('Active admission not found.')

        const destOccupied = await tx.ipdAdmission.findFirst({
          where: { organizationId: orgId, bedId: toBedId, dischargedAt: null },
        })
        if (destOccupied) throw new Error('Target bed is already occupied.')

        await tx.bedTransfer.create({
          data: {
            organizationId: orgId,
            ipdAdmissionId: adm.id,
            fromBedId: adm.bedId,
            toBedId,
            reason: body.reason ? String(body.reason) : 'Clinical ward transfer',
            transferredBy: session.name,
          },
        })

        await tx.bed.update({
          where: { id: adm.bedId },
          data: { status: 'cleaning', lastDischargedAt: new Date() },
        })
        await tx.bed.update({
          where: { id: toBedId },
          data: { status: 'occupied', lastAdmittedAt: new Date() },
        })

        return tx.ipdAdmission.update({
          where: { id: adm.id },
          data: { bedId: toBedId },
        })
      })

      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ admission: updated }, { startMs })
    }

    // 8. DISCHARGE PATIENT + GENERATE DISCHARGE SUMMARY + FINAL IPD INVOICE
    if (action === 'discharge') {
      const ipdAdmissionId = String(body.ipdAdmissionId || '')

      const result = await dbUnscoped.$transaction(async (tx) => {
        const adm = await tx.ipdAdmission.findFirst({
          where: { id: ipdAdmissionId, organizationId: orgId },
          include: {
            bed: { include: { category: true } },
            chargeItems: true,
            medicationOrders: true,
            deposits: true,
          },
        })

        if (!adm) throw new Error('IPD Admission not found.')
        if (adm.dischargedAt) {
          throw new Error('This patient was already discharged. Cannot overwrite discharge timestamp.')
        }

        const dischargedAt = body.dischargedAt ? new Date(body.dischargedAt) : new Date()
        if (dischargedAt < adm.admittedAt) {
          throw new Error('Discharge time cannot be earlier than admission time.')
        }

        const fin = calculateIpdRunningBill({
          admittedAt: adm.admittedAt,
          dischargedAt,
          dailyRate: adm.bed.category.dailyRate,
          nursingChargeDay: adm.bed.category.nursingChargeDay,
          chargeItems: adm.chargeItems,
          medicationOrders: adm.medicationOrders,
          deposits: adm.deposits,
          preAuthAmount: adm.preAuthAmount,
        })

        const invCount = await tx.invoice.count({ where: { organizationId: orgId } })
        const invoiceNo = `INV-${String(invCount + 1).padStart(4, '0')}`
        const settleNow = Boolean(body.collectBalanceNow)
        const totalPaid = settleNow
          ? fin.grossTotal
          : Math.min(fin.grossTotal, fin.depositsPaidTotal)
        const balanceDue = Math.max(0, fin.grossTotal - totalPaid)

        const invoice = await tx.invoice.create({
          data: {
            organizationId: orgId,
            branchId: adm.branchId,
            invoiceNo,
            patientId: adm.patientId,
            ipdAdmissionId: adm.id,
            billType: 'IPD',
            subtotal: fin.grossTotal,
            depositApplied: fin.depositsPaidTotal,
            totalAmount: fin.grossTotal,
            amountPaid: totalPaid,
            balanceDue,
            status: balanceDue === 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'pending',
            paymentMode: settleNow ? String(body.paymentMode || 'UPI') : null,
            notes: `IPD Final Bill (${adm.admissionNo} — ${fin.stayDays} day stay in ${adm.bed.category.name})`,
            items: {
              create: [
                {
                  category: 'Room & Bed Charges',
                  description: `${adm.bed.category.name} (${adm.bed.bedNumber}) — ${fin.stayDays} day(s) @ ₹${fin.dailyRoomRate}/day`,
                  quantity: fin.stayDays,
                  unitRate: fin.dailyRoomRate,
                  amount: fin.roomChargesTotal,
                },
                {
                  category: 'Nursing & Doctor Rounds',
                  description: `24x7 Nursing & In-patient Rounds — ${fin.stayDays} day(s) @ ₹${fin.dailyNursingRate}/day`,
                  quantity: fin.stayDays,
                  unitRate: fin.dailyNursingRate,
                  amount: fin.nursingChargesTotal,
                },
                ...(fin.medicationChargesTotal > 0
                  ? [
                      {
                        category: 'IPD Pharmacy / MAR',
                        description: `In-patient IV/Oral Medications (${adm.medicationOrders.length} orders)`,
                        quantity: 1,
                        unitRate: fin.medicationChargesTotal,
                        amount: fin.medicationChargesTotal,
                      },
                    ]
                  : []),
                ...adm.chargeItems.map((ci) => ({
                  category: ci.category,
                  description: ci.description,
                  quantity: ci.quantity,
                  unitRate: ci.unitRate,
                  amount: ci.amount,
                })),
              ],
            },
          },
        })

        if (settleNow && fin.netPayable > 0) {
          const payCount = await tx.payment.count({ where: { organizationId: orgId } })
          await tx.payment.create({
            data: {
              organizationId: orgId,
              paymentNo: `PAY-${String(payCount + 1).padStart(4, '0')}`,
              patientId: adm.patientId,
              invoiceId: invoice.id,
              amount: fin.netPayable,
              paymentMode: String(body.paymentMode || 'UPI'),
              notes: `IPD Discharge Final Settlement (${adm.admissionNo})`,
            },
          })
        }

        const updatedAdm = await tx.ipdAdmission.update({
          where: { id: adm.id },
          data: {
            dischargedAt,
            status: 'discharged',
            finalDiagnosis: String(body.finalDiagnosis || adm.provisionalDiagnosis).trim(),
            conditionAtDischarge: String(body.conditionAtDischarge || 'Improved & Stable'),
            dischargeSummary: String(
              body.dischargeSummary ||
                'Patient responded well to IV medical therapy, vitals stabilized, afebrile and hemodynamically stable at discharge.'
            ).trim(),
            dischargeAdvice: body.dischargeAdvice ? String(body.dischargeAdvice).trim() : null,
            followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
            finalInvoiceId: invoice.id,
          },
        })

        // Free the bed atomically!
        await tx.bed.update({
          where: { id: adm.bedId },
          data: { status: 'free', lastDischargedAt: dischargedAt },
        })

        return { admission: updatedAdm, invoice }
      })

      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson(result, { startMs })
    }

    // 9. CREATE WARD CATEGORY OR BED
    if (action === 'createWard') {
      const cat = await db.bedCategory.create({
        data: {
          organizationId: orgId,
          name: String(body.name).trim(),
          code: String(body.code || body.name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
          floor: String(body.floor || '1st Floor'),
          dailyRate: Number(body.dailyRate || 1500),
          nursingChargeDay: Number(body.nursingChargeDay || 350),
          color: String(body.color || '#0d9488'),
          description: body.description ? String(body.description) : null,
        },
      })
      return apiJson({ category: cat }, { status: 201, startMs })
    }

    if (action === 'createBed') {
      const mainBranch = await db.branch.findFirst({ where: { organizationId: orgId } })
      const bed = await db.bed.create({
        data: {
          organizationId: orgId,
          branchId: mainBranch?.id || null,
          categoryId: String(body.categoryId),
          bedNumber: String(body.bedNumber).trim().toUpperCase(),
          floor: String(body.floor || '1st Floor'),
          hasOxygen: Boolean(body.hasOxygen),
          hasVentilator: Boolean(body.hasVentilator),
          hasMonitor: Boolean(body.hasMonitor),
          status: 'free',
        },
      })
      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ bed }, { status: 201, startMs })
    }

    if (action === 'updateBedStatus') {
      const bedId = String(body.bedId || '')
      const active = await db.ipdAdmission.findFirst({
        where: { organizationId: orgId, bedId, dischargedAt: null },
      })
      if (active) {
        return apiJson(
          { error: 'Cannot change status of an occupied bed. Discharge or transfer the patient first.' },
          { status: 400, startMs }
        )
      }
      const bed = await dbUnscoped.bed.update({
        where: { id: bedId },
        data: { status: String(body.status || 'free') },
      })
      invalidateCachePrefix(`dash:${orgId}`)
      return apiJson({ bed }, { startMs })
    }

    return apiJson({ error: `Unknown IPD action: ${action}` }, { status: 400, startMs })
  } catch (err) {
    return apiJson(
      { error: err instanceof Error ? err.message : 'IPD operation failed' },
      { status: 400, startMs }
    )
  }
}
