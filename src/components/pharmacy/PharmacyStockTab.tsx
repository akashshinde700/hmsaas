'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Search,
  AlertTriangle,
  Clock,
  Package,
  Save,
  Edit,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface PharmacyStockItem {
  id: string
  medicine: {
    name: string
    genericName?: string | null
    dosageForm?: string | null
    strength?: string | null
    category?: string | null
  }
  batchNo: string
  mrp: number
  purchasePrice: number
  sellingPrice: number
  quantity: number
  reorderLevel: number
  expiryDate?: string | null
  manufacturer?: string | null
  isActive: boolean
  createdAt: string
}

interface PharmacyStockTabProps {
  organizationId: string
  userRole: string
  userName: string
}

export default function PharmacyStockTab({ organizationId, userRole, userName }: PharmacyStockTabProps) {
  const [stock, setStock] = useState<PharmacyStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    medicineId: '',
    medicineName: '',
    batchNo: '',
    mrp: '',
    purchasePrice: '',
    sellingPrice: '',
    quantity: '',
    reorderLevel: '10',
    expiryDate: '',
    manufacturer: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  const loadStock = useCallback(async () => {
    try {
      setLoading(true)
      const url = new URL(`/api/pharmacy/stock`, window.location.origin)
      url.searchParams.set('organizationId', organizationId)
      if (lowStockOnly) url.searchParams.set('lowStock', '1')

      const res = await fetch(url.toString())
      if (res.ok) {
        const d = await res.json()
        setStock(d.stock || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [organizationId, lowStockOnly])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  const lowStockCount = stock.filter((s) => s.quantity <= s.reorderLevel).length

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/pharmacy/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          medicineId: form.medicineId || form.medicineName,
          batchNo: form.batchNo,
          mrp: Number(form.mrp || 0),
          purchasePrice: Number(form.purchasePrice || 0),
          sellingPrice: Number(form.sellingPrice || 0),
          quantity: Number(form.quantity || 0),
          reorderLevel: Number(form.reorderLevel || 10),
          expiryDate: form.expiryDate || null,
          manufacturer: form.manufacturer || null,
        }),
      })
      if (res.ok) {
        toast.success('Stock batch added!')
        setShowAdd(false)
        setForm({
          medicineId: '', medicineName: '', batchNo: '', mrp: '',
          purchasePrice: '', sellingPrice: '', quantity: '', reorderLevel: '10',
          expiryDate: '', manufacturer: '',
        })
        loadStock()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to add stock')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleUpdateQty = async (id: string, newQty: number) => {
    try {
      const res = await fetch(`/api/pharmacy/stock/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty, orgId: organizationId }),
      })
      if (res.ok) {
        loadStock()
      } else {
        toast.error('Failed to update stock')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleDispense = async (item: PharmacyStockItem, qty: number) => {
    if (qty > item.quantity) {
      toast.error('Insufficient stock!')
      return
    }
    const patientId = prompt('Enter Patient UHID/ID:')
    if (!patientId) return
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          patientId,
          pharmacyStockId: item.id,
          quantity: qty,
          unitPrice: item.sellingPrice,
          dispensedBy: userName,
        }),
      })
      if (res.ok) {
        toast.success(`Dispensed ${qty}x ${item.medicine.name}`)
        loadStock()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Dispense failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header + Low Stock Alert */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Package className="h-5 w-5" />
          </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Pharmacy Stock Management</h2>
              <p className="text-xs text-slate-500">
                Track medicine batches, expiry, and low-stock alerts per tenant.
              </p>
            </div>
        </div>

        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span className="font-bold text-rose-800">
              {lowStockCount} item(s) at/below reorder level
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto lg:ml-0">
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              lowStockOnly
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Clock className="h-3 w-3 mr-1" />
            {lowStockOnly ? 'Show All' : 'Low Stock Only'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 transition flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" /> Add Batch
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h3 className="text-sm font-bold text-teal-900 mb-3 flex items-center gap-2">
            <Plus className="h-3 w-3 text-teal-600" /> New Stock Batch
          </h3>
          <form onSubmit={handleAddStock} className="grid gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Medicine Name
              </label>
              <input
                value={form.medicineName}
                onChange={(e) => setForm({ ...form, medicineName: e.target.value })}
                placeholder="e.g. Paracetamol 500mg"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Batch No
              </label>
              <input
                value={form.batchNo}
                onChange={(e) => setForm({ ...form, batchNo: e.target.value })}
                placeholder="BATCH-001"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Qty
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="100"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Reorder Level
              </label>
              <input
                type="number"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                placeholder="10"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Selling Price (₹)
              </label>
              <input
                type="number"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                step="0.01"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Manufacturer
              </label>
              <input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                placeholder="e.g. Cipla"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-700 transition flex items-center gap-1.5"
              >
                <Save className="h-3 w-3" /> Add Batch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left">
                  Medicine
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left">
                  Batch
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  Qty
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  Reorder
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                  Price (₹)
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left">
                  Expiry
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="h-32 text-center text-slate-500 dark:text-slate-400">
                    Loading stock…
                  </td>
                </tr>
              ) : stock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-32 text-center text-slate-500 dark:text-slate-400">
                    No stock batches found. Add your first medicine batch above.
                  </td>
                </tr>
              ) : (
                stock.map((item) => {
                  const isLow = item.quantity <= item.reorderLevel
                  const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date()
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition ${
                        isExpired ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''
                        }`}
                    >
                      <td className="px-4 py-3 text-slate-900 dark:text-white">
                        <div>
                          <p className="font-medium">{item.medicine.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.medicine.genericName || ''} {item.medicine.dosageForm} {item.medicine.strength}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {item.batchNo}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {item.reorderLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{item.sellingPrice?.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {item.expiryDate ? (
                          <span
                            className={`font-medium ${
                              isExpired
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {new Date(item.expiryDate).toLocaleDateString('en-IN')}
                            {isExpired ? ' (EXPIRED)' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDispense(item, item.quantity)}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
                            title="Dispense all"
                          >
                            <Save className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const qty = prompt(`Enter qty to dispense (max ${item.quantity}):`)
                              if (qty) handleDispense(item, parseInt(qty))
                            }}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Dispense custom qty"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.quantity)}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Refresh qty"
                          >
                            <Clock className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3 text-xs">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Batches
          </p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">{stock.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Low Stock Alerts
          </p>
          <p className={`text-xl font-extrabold ${lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {lowStockCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Stock Value (₹)
          </p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">
            {stock.reduce((sum, s) => sum + s.quantity * s.sellingPrice, 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  )
}
