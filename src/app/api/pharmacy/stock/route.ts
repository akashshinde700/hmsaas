/**
 * PHARMACY STOCK API
 * GET    /api/pharmacy/stock?organizationId=...&lowStock=1&medicineId=...
 * POST   /api/pharmacy/stock  — add new batch stock
 * PATCH  /api/pharmacy/stock/[id] — update quantity / price
 *
 * Tenant guarded. Only pharmacist/admin/doctor roles.
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

const ALLOWED_ROLES = ['super_admin', 'admin', 'doctor', 'nurse', 'pharmacist']

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organizationId') || session.organizationId
  const lowStock = searchParams.get('lowStock') === '1'
  const medicineId = searchParams.get('medicineId') || undefined

  if (orgId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  const where: any = {
    organizationId: orgId,
    isActive: true,
    ...(medicineId ? { medicineId } : {}),
  }

  const stock = await dbUnscoped.pharmacyStock.findMany({
    where,
    include: {
      medicine: { select: { id: true, name: true, genericName: true, dosageForm: true, strength: true, category: true } },
    },
    orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }],
  })

  let result = stock
  if (lowStock) {
    result = stock.filter((s) => s.quantity <= s.reorderLevel)
  }

  return apiJson({ stock: result, lowStockCount: result.filter((s) => s.quantity <= s.reorderLevel).length }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const body = await req.json()
  const { organizationId, medicineId, batchNo, mrp, purchasePrice, sellingPrice, quantity, reorderLevel, expiryDate, manufacturer, branchId } = body

  if (!organizationId || !medicineId || !batchNo) {
    return apiJson({ error: 'organizationId, medicineId, batchNo required.' }, { status: 400, startMs })
  }

  if (organizationId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  // Verify medicine exists in org
  const medicine = await dbUnscoped.medicine.findUnique({ where: { id: medicineId } })
  if (!medicine || medicine.organizationId !== null && medicine.organizationId !== organizationId) {
    return apiJson({ error: 'Medicine not found in this organization.' }, { status: 404, startMs })
  }

  const stock = await dbUnscoped.pharmacyStock.create({
    data: {
      organizationId,
      branchId: branchId || null,
      medicineId,
      batchNo,
      mrp: Number(mrp || 0),
      purchasePrice: Number(purchasePrice || 0),
      sellingPrice: Number(sellingPrice || 0),
      quantity: Number(quantity || 0),
      reorderLevel: Number(reorderLevel || 10),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      manufacturer: manufacturer || null,
    },
    include: {
      medicine: { select: { name: true, genericName: true, dosageForm: true } },
    },
  })

  await dbUnscoped.auditLog.create({
    data: {
      organizationId,
      actorName: session.name,
      actorRole: session.role,
      action: 'PHARMACY_STOCK_ADDED',
      entity: 'PharmacyStock',
      details: `Added batch ${batchNo} - ${medicine?.name} x${quantity}`,
    },
  })

  return apiJson({ stock }, { status: 201, startMs })
}
