'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  FlaskConical,
  Pill,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ClinicSettingsData, MedicineSearchResult, PatientRecord } from './types'

export function MedicineMasterTab() {
  const [query, setQuery] = useState('')
  const [medicines, setMedicines] = useState<MedicineSearchResult[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    name: '',
    composition: '',
    manufacturer: '',
    dosageForm: 'Tablet',
    strength: '',
    mrp: '',
    defaultFrequency: '1-0-1',
    defaultDuration: '5 days',
  })

  const loadMeds = useCallback(async (q = '') => {
    const res = await fetch(`/api/medicines?q=${encodeURIComponent(q)}&limit=50`)
    if (res.ok) {
      const d = await res.json()
      setMedicines(d.medicines || [])
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadMeds(query), 90)
    return () => clearTimeout(t)
  }, [query, loadMeds])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            <Database className="h-3.5 w-3.5" />
            3-Tier Dynamic Medicine Architecture
          </div>
          <h2 className="mt-1.5 text-lg font-extrabold text-slate-900">
            Global MedWiki Formulary + Your Hospital Custom Drugs
          </h2>
          <p className="text-xs text-slate-500">
            Global drugs sync continuously from MedWiki; custom drugs added here remain private to your hospital.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" /> Add Custom Clinic Medicine
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="relative max-w-md mb-4">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, salt molecule, category, form..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Brand Name</th>
                <th className="py-3 px-3">Salt Composition</th>
                <th className="py-3 px-3">Form &amp; Route</th>
                <th className="py-3 px-3">Default Rx</th>
                <th className="py-3 px-3">MRP</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        m.isCustom
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {m.isCustom ? 'Clinic Custom' : 'MedWiki Global'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {m.name}
                    {m.manufacturer && (
                      <p className="text-[11px] font-normal text-slate-400">{m.manufacturer}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{m.composition || m.genericName}</td>
                  <td className="py-2.5 px-3">
                    {m.dosageForm} · <span className="text-slate-500">{m.defaultRoute}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-teal-800">
                    {m.defaultFrequency} · {m.defaultDuration}
                  </td>
                  <td className="py-2.5 px-3 font-medium">{m.mrp ? `₹${m.mrp}` : '—'}</td>
                  <td className="py-2.5 px-3">
                    {m.isCustom && (
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/medicines?id=${m.id}`, { method: 'DELETE' })
                          toast.success('Removed custom medicine')
                          loadMeds(query)
                        }}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Add Custom Hospital Formulation</h3>
              <button type="button" onClick={() => setShowAdd(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const res = await fetch('/api/medicines', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(form),
                })
                if (res.ok) {
                  toast.success('Saved to your clinic formulary!')
                  setShowAdd(false)
                  loadMeds(query)
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <input
                required
                placeholder="Brand Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Generic / Salt Composition *"
                value={form.composition}
                onChange={(e) => setForm({ ...form, composition: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.dosageForm}
                  onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option>Tablet</option>
                  <option>Capsule</option>
                  <option>Syrup</option>
                  <option>Injection</option>
                  <option>Infusion</option>
                  <option>Ointment</option>
                </select>
                <input
                  type="number"
                  placeholder="MRP (₹)"
                  value={form.mrp}
                  onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white">
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function BillingAndLabsTab({ patients }: { patients: PatientRecord[] }) {
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([])
  const [deposits, setDeposits] = useState<Array<Record<string, unknown>>>([])
  const [labs, setLabs] = useState<Array<Record<string, unknown>>>([])
  const [resultInput, setResultInput] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    const [bRes, lRes] = await Promise.all([fetch('/api/billing'), fetch('/api/labs')])
    if (bRes.ok) {
      const b = await bRes.json()
      setInvoices(b.invoices || [])
      setDeposits(b.deposits || [])
    }
    if (lRes.ok) {
      const l = await lRes.json()
      setLabs(l.orders || [])
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-6">
      {/* Lab Orders */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-teal-600" />
            OPD &amp; IPD Laboratory Orders ({labs.length})
          </h3>
          <button
            type="button"
            onClick={async () => {
              if (!patients[0]) return
              await fetch('/api/labs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create',
                  patientId: patients[0].id,
                  testName: 'Complete Blood Count (CBC) + CRP',
                  price: 650,
                }),
              })
              toast.success('Lab test ordered!')
              loadData()
            }}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
          >
            + Quick Lab Order
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          {labs.map((lab) => {
            const p = lab.patient as PatientRecord
            return (
              <div
                key={String(lab.id)}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
              >
                <div>
                  <span className="font-mono font-bold text-teal-700">{String(lab.orderNo)}</span> ·{' '}
                  <strong>{String(lab.testName)}</strong> — {p?.name} ({p?.uhid})
                  {Boolean(lab.resultSummary) && (
                    <p className="mt-1 font-medium text-emerald-800">
                      Result: {String(lab.resultSummary)}
                    </p>
                  )}
                </div>

                {lab.status !== 'completed' ? (
                  <div className="flex gap-2">
                    <input
                      value={resultInput[String(lab.id)] || ''}
                      onChange={(e) =>
                        setResultInput({ ...resultInput, [String(lab.id)]: e.target.value })
                      }
                      placeholder="Enter lab result values..."
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/labs', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'complete',
                            id: lab.id,
                            resultSummary:
                              resultInput[String(lab.id)] || 'Within normal reference range',
                          }),
                        })
                        toast.success('Lab report published!')
                        loadData()
                      }}
                      className="rounded-lg bg-teal-600 px-3 py-1 font-bold text-white"
                    >
                      Publish Report
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                    Completed
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Unified OPD & IPD Invoices */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-teal-600" />
          Unified OPD &amp; IPD Invoices ({invoices.length}) &amp; Advance Deposits ({deposits.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="py-2.5 px-3">Invoice No</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Net Amount</th>
                <th className="py-2.5 px-3">Paid</th>
                <th className="py-2.5 px-3">Balance</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const p = inv.patient as PatientRecord
                const balance = Number(inv.balanceAmount || 0)
                return (
                  <tr key={String(inv.id)}>
                    <td className="py-2.5 px-3 font-mono font-bold">{String(inv.invoiceNo)}</td>
                    <td className="py-2.5 px-3 font-bold text-teal-700">{String(inv.billType)}</td>
                    <td className="py-2.5 px-3">
                      {p?.name} <span className="text-slate-400">({p?.uhid})</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      ₹{Number(inv.netAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                      ₹{Number(inv.paidAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-rose-700 font-bold">
                      ₹{balance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {String(inv.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch('/api/billing', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'recordPayment',
                                invoiceId: inv.id,
                                amount: balance,
                                paymentMode: 'UPI',
                              }),
                            })
                            toast.success(`Collected ₹${balance} against ${inv.invoiceNo}!`)
                            loadData()
                          }}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white"
                        >
                          Collect ₹{balance}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function HospitalSettingsTab({ onRefreshGlobal }: { onRefreshGlobal?: () => void }) {
  const [settings, setSettings] = useState<ClinicSettingsData>({
    clinicDisplayName: '',
    tagline: '',
    address: '',
    phone: '',
    emergencyPhone: '',
    email: '',
    gstNumber: '',
    uhidPrefix: 'HMS',
    upiId: '',
    rxFooterNote: '',
  })
  const [staff, setStaff] = useState<Array<Record<string, unknown>>>([])
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: 'DOCTOR',
    specialization: 'General Medicine',
    qualification: 'MBBS, MD',
    consultationFee: '600',
  })

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const d = await res.json()
      if (d.settings) setSettings(d.settings)
      setStaff(d.staff || [])
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* White-Label Hospital Branding */}
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateBranding', ...settings }),
          })
          if (res.ok) {
            toast.success('Hospital letterhead & billing settings updated!')
            onRefreshGlobal?.()
          }
        }}
        className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 text-xs"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="h-5 w-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-900">
            White-Label Hospital Letterhead, UHID &amp; GST Settings
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block font-bold mb-1">Hospital / Clinic Display Name</label>
            <input
              value={settings.clinicDisplayName || ''}
              onChange={(e) => setSettings({ ...settings, clinicDisplayName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold mb-1">Tagline / Accreditation</label>
            <input
              value={settings.tagline || ''}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold mb-1">Address</label>
            <input
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Reception Phone</label>
            <input
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">UHID Prefix</label>
            <input
              value={settings.uhidPrefix || 'HMS'}
              onChange={(e) => setSettings({ ...settings, uhidPrefix: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">UPI VPA for Instant QR Receipts</label>
            <input
              value={settings.upiId || ''}
              onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">GSTIN</label>
            <input
              value={settings.gstNumber || ''}
              onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700"
        >
          <CheckCircle2 className="h-4 w-4" /> Save Hospital Branding
        </button>
      </form>

      {/* Doctors & Staff Management */}
      <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" />
            Doctors &amp; Staff ({staff.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowAddStaff(true)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
          >
            + Add Doctor / Nurse
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          {staff.map((u) => (
            <div
              key={String(u.id)}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-slate-900">{String(u.name)}</p>
                <p className="text-slate-500">
                  {String(u.email)} · {String(u.specialization || u.role)}
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-bold text-teal-700">
                {String(u.role)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showAddStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-slate-900">Add Doctor / Nursing / Billing Staff</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const res = await fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'createStaff', ...staffForm }),
                })
                const d = await res.json()
                if (!res.ok) {
                  toast.error(d.error || 'Could not add staff')
                  return
                }
                toast.success(`Created ${d.user.email}! Temp password: ${d.temporaryPassword}`)
                setShowAddStaff(false)
                loadSettings()
                onRefreshGlobal?.()
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <input
                required
                placeholder="Full Name (e.g. Dr. Sneha Patil)"
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Work Email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="DOCTOR">DOCTOR</option>
                  <option value="NURSE">NURSE (IPD)</option>
                  <option value="RECEPTIONIST">RECEPTIONIST</option>
                  <option value="PHARMACIST">PHARMACIST</option>
                </select>
                <input
                  placeholder="Specialization"
                  value={staffForm.specialization}
                  onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaff(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
