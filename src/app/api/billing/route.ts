import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const [invoices, payments, deposits] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId: session.organizationId },
      include: {
        patient: { select: { id: true, name: true, uhid: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    db.payment.findMany({
      where: { organizationId: session.organizationId },
      include: {
        patient: { select: { name: true, uhid: true } },
        invoice: { select: { invoiceNo: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 40,
    }),
    db.patientDeposit.findMany({
      where: { organizationId: session.organizationId },
      include: {
        patient: { select: { name: true, uhid: true } },
        ipdAdmission: { select: { admissionNo: true } },
      },
      orderBy: { depositedAt: 'desc' },
      take: 40,
    }),
  ])

  return apiJson({ invoices, payments, deposits }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orgId = session.organizationId
  const body = await req.json()
  const action = String(body.action || 'createInvoice')

  if (action === 'bulkMarkPaid' && Array.isArray(body.ids)) {
    const unpaid = await db.invoice.findMany({
      where: {
        organizationId: orgId,
        id: { in: body.ids.map(String) },
        balanceDue: { gt: 0 },
      },
    })
    const basePayCount = await db.payment.count({ where: { organizationId: orgId } })
    for (let i = 0; i < unpaid.length; i++) {
      const inv = unpaid[i]
      await dbUnscoped.$transaction([
        dbUnscoped.payment.create({
          data: {
            organizationId: orgId,
            paymentNo: `PAY-${String(basePayCount + i + 1).padStart(4, '0')}`,
            patientId: inv.patientId,
            invoiceId: inv.id,
            amount: inv.balanceDue,
            paymentMode: String(body.paymentMode || 'UPI'),
          },
        }),
        dbUnscoped.invoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: inv.totalAmount,
            balanceDue: 0,
            status: 'paid',
            paymentMode: String(body.paymentMode || 'UPI'),
          },
        }),
      ])
    }
    invalidateCachePrefix(`dash:${orgId}`)
    return apiJson({ settled: unpaid.length }, { startMs })
  }

  if (action === 'recordPayment') {
    const invoiceId = String(body.invoiceId || '')
    const amount = Number(body.amount || 0)
    const inv = await db.invoice.findFirst({ where: { id: invoiceId, organizationId: orgId } })
    if (!inv || amount <= 0) {
      return apiJson({ error: 'Valid invoice and payment amount required.' }, { status: 400, startMs })
    }

    const payCount = await db.payment.count({ where: { organizationId: orgId } })
    const newPaid = Math.min(inv.totalAmount, inv.amountPaid + amount)
    const newBalance = Math.max(0, inv.totalAmount - newPaid)

    const [payment] = await dbUnscoped.$transaction([
      dbUnscoped.payment.create({
        data: {
          organizationId: orgId,
          paymentNo: `PAY-${String(payCount + 1).padStart(4, '0')}`,
          patientId: inv.patientId,
          invoiceId: inv.id,
          amount,
          paymentMode: String(body.paymentMode || 'UPI'),
          referenceNo: body.referenceNo ? String(body.referenceNo) : null,
        },
      }),
      dbUnscoped.invoice.update({
        where: { id: inv.id },
        data: {
          amountPaid: newPaid,
          balanceDue: newBalance,
          status: newBalance === 0 ? 'paid' : 'partially_paid',
          paymentMode: String(body.paymentMode || 'UPI'),
        },
      }),
    ])

    invalidateCachePrefix(`dash:${orgId}`)
    return apiJson({ payment }, { status: 201, startMs })
  }

  const items: Array<{ category?: string; description: string; quantity: number; unitRate: number }> =
    Array.isArray(body.items) ? body.items : []
  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitRate || 0), 0)
  const discount = Number(body.discount || 0)
  const gstPercent = Number(body.gstPercent || 0)
  const taxable = Math.max(0, subtotal - discount)
  const gstAmount = Math.round((taxable * gstPercent) / 100)
  const totalAmount = taxable + gstAmount
  const amountPaid = Number(body.amountPaid || 0)
  const balanceDue = Math.max(0, totalAmount - amountPaid)

  const invCount = await db.invoice.count({ where: { organizationId: orgId } })
  const invoiceNo = `INV-${String(invCount + 1).padStart(4, '0')}`

  const invoice = await db.invoice.create({
    data: {
      organizationId: orgId,
      invoiceNo,
      patientId: String(body.patientId),
      billType: String(body.billType || 'OPD'),
      subtotal,
      discount,
      gstPercent,
      gstAmount,
      totalAmount,
      amountPaid,
      balanceDue,
      status: balanceDue === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
      paymentMode: body.paymentMode ? String(body.paymentMode) : null,
      items: {
        create: items.map((it) => ({
          category: String(it.category || 'Service'),
          description: String(it.description),
          quantity: Number(it.quantity || 1),
          unitRate: Number(it.unitRate || 0),
          amount: Number(it.quantity || 1) * Number(it.unitRate || 0),
        })),
      },
    },
    include: { items: true },
  })

  if (amountPaid > 0) {
    const payCount = await db.payment.count({ where: { organizationId: orgId } })
    await db.payment.create({
      data: {
        organizationId: orgId,
        paymentNo: `PAY-${String(payCount + 1).padStart(4, '0')}`,
        patientId: invoice.patientId,
        invoiceId: invoice.id,
        amount: amountPaid,
        paymentMode: String(body.paymentMode || 'UPI'),
      },
    })
  }

  invalidateCachePrefix(`dash:${orgId}`)
  return apiJson({ invoice }, { status: 201, startMs })
}
