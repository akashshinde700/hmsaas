'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  FlaskConical,
  Lock,
  Plus,
  Package,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAutosaveDraft, validateSmartField } from '@/hooks/useSaaSUX'
import {
  AutosaveBadge,
  ConfirmDestructiveModal,
  EmptyStateCard,
  SaaSDataTable,
  SmartValidatedInput,
  TierBadge,
} from '@/components/saas-ux/SaaSUXPrimitives'
import type { ClinicSettingsData, MedicineSearchResult, PatientRecord } from './types'

export function MedicineMasterTab() {
  const [medicines, setMedicines] = useState<MedicineSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MedicineSearchResult | null>(null)
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

  const loadMeds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/medicines?limit=100')
      if (res.ok) {
        const d = await res.json()
        setMedicines(d.medicines || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMeds()
  }, [loadMeds])

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
            Filter by source, dosage form, or controlled drug schedule; export your hospital formulary anytime.
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

      <SaaSDataTable<MedicineSearchResult>
        data={medicines}
        loading={loading}
        rowKey={(m) => m.id}
        initialPageSize={10}
        searchPlaceholder="Debounced search by brand, generic salt, manufacturer, category..."
        searchableText={(m) =>
          `${m.name} ${m.composition || ''} ${m.genericName || ''} ${m.manufacturer || ''} ${m.category}`
        }
        exportFilename="medwiki-hospital-formulary.csv"
        emptyTitle="No formulations match your filters"
        emptyDescription="Add a custom hospital formulation or clear filters to browse the Global MedWiki catalog."
        emptyActionLabel="+ Add Custom Medicine"
        onEmptyAction={() => setShowAdd(true)}
        filters={[
          {
            key: 'source',
            label: 'Source',
            options: [
              { value: 'global', label: 'MedWiki Global' },
              { value: 'custom', label: 'Clinic Custom' },
            ],
            match: (m, val) => (val === 'custom' ? m.isCustom : !m.isCustom),
          },
          {
            key: 'form',
            label: 'Dosage Form',
            options: [
              'Tablet',
              'Capsule',
              'Syrup',
              'Suspension',
              'Injection',
              'Infusion',
              'Inhaler',
            ].map((f) => ({ value: f, label: f })),
            match: (m, val) => m.dosageForm.toLowerCase() === val.toLowerCase(),
          },
          {
            key: 'schedule',
            label: 'Schedule',
            options: [
              { value: 'controlled', label: 'Controlled (H1 / X)' },
              { value: 'standard', label: 'Standard Rx / OTC' },
            ],
            match: (m, val) => (val === 'controlled' ? m.isControlled : !m.isControlled),
          },
        ]}
        columns={[
          {
            key: 'source',
            header: 'Source',
            sortable: true,
            sortValue: (m) => (m.isCustom ? '1-Custom' : '2-Global'),
            csvValue: (m) => (m.isCustom ? 'Clinic Custom' : 'MedWiki Global'),
            render: (m) => (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  m.isCustom ? 'bg-violet-100 text-violet-700' : 'bg-teal-50 text-teal-700'
                }`}
              >
                {m.isCustom ? 'Clinic Custom' : 'MedWiki Global'}
              </span>
            ),
          },
          {
            key: 'name',
            header: 'Brand Name',
            sortable: true,
            sortValue: (m) => m.name,
            csvValue: (m) => m.name,
            render: (m) => (
              <div>
                <p className="font-bold text-slate-900">{m.name}</p>
                {m.manufacturer && (
                  <p className="text-[11px] font-normal text-slate-400">{m.manufacturer}</p>
                )}
              </div>
            ),
          },
          {
            key: 'salt',
            header: 'Salt Composition',
            csvValue: (m) => m.composition || m.genericName || '',
            render: (m) => <span className="text-slate-600">{m.composition || m.genericName}</span>,
          },
          {
            key: 'form',
            header: 'Form & Route',
            sortable: true,
            sortValue: (m) => m.dosageForm,
            render: (m) => (
              <span>
                {m.dosageForm} · <span className="text-slate-500">{m.defaultRoute}</span>
              </span>
            ),
          },
          {
            key: 'rx',
            header: 'Default Rx',
            render: (m) => (
              <span className="font-mono font-semibold text-teal-800">
                {m.defaultFrequency} · {m.defaultDuration}
              </span>
            ),
          },
          {
            key: 'mrp',
            header: 'MRP',
            sortable: true,
            sortValue: (m) => m.mrp ?? 0,
            render: (m) => <span className="font-medium">{m.mrp ? `₹${m.mrp}` : '—'}</span>,
          },
          {
            key: 'action',
            header: '',
            render: (m) =>
              m.isCustom ? (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(m)}
                  className="text-rose-500 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null,
          },
        ]}
      />

      <ConfirmDestructiveModal
        open={Boolean(deleteTarget)}
        title={`Remove "${deleteTarget?.name}"?`}
        description="This custom formulation will be removed from your clinic's private formulary. Existing past prescriptions will remain unaffected."
        confirmButtonLabel="Remove Custom Medicine"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await fetch(`/api/medicines?id=${deleteTarget.id}`, { method: 'DELETE' })
          toast.success(`Removed ${deleteTarget.name}`)
          setDeleteTarget(null)
          loadMeds()
        }}
      />

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
                  loadMeds()
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <SmartValidatedInput
                label="Brand Name"
                required
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="e.g. SahyadriORS Powder"
              />
              <SmartValidatedInput
                label="Generic / Salt Composition"
                required
                value={form.composition}
                onChange={(v) => setForm({ ...form, composition: v })}
                placeholder="e.g. WHO Oral Rehydration Salts"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={form.dosageForm}
                    onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option>Tablet</option>
                    <option>Capsule</option>
                    <option>Syrup</option>
                    <option>Injection</option>
                    <option>Infusion</option>
                    <option>Powder</option>
                  </select>
                </div>
                <SmartValidatedInput
                  label="MRP (₹)"
                  type="number"
                  rules={['positive_number']}
                  value={form.mrp}
                  onChange={(v) => setForm({ ...form, mrp: v })}
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

interface InvoiceRecord {
  id: string
  invoiceNo: string
  billType: string
  patient?: PatientRecord
  totalAmount: number
  amountPaid: number
  balanceDue: number
  status: string
  createdAt: string
}

export function BillingAndLabsTab({ patients }: { patients: PatientRecord[] }) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [deposits, setDeposits] = useState<Array<Record<string, unknown>>>([])
  const [labs, setLabs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [resultInput, setResultInput] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // #1 Optimistic Lab Report Publishing
  async function publishLabOptimistic(labId: string) {
    const summary = resultInput[labId] || 'Within normal reference range'
    const previous = labs
    setLabs((prev) =>
      prev.map((l) =>
        String(l.id) === labId ? { ...l, status: 'completed', resultSummary: summary } : l
      )
    )
    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', id: labId, resultSummary: summary }),
      })
      if (!res.ok) throw new Error()
      toast.success('Lab report published immediately!')
    } catch {
      setLabs(previous)
      toast.error('Failed to publish lab report — reverted.')
    }
  }

  // #1 Optimistic Single Invoice Payment Collection
  async function collectInvoiceOptimistic(inv: InvoiceRecord) {
    const previous = invoices
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === inv.id
          ? { ...i, amountPaid: i.totalAmount, balanceDue: 0, status: 'paid' }
          : i
      )
    )
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordPayment',
          invoiceId: inv.id,
          amount: inv.balanceDue,
          paymentMode: 'UPI',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Collected ₹${inv.balanceDue.toLocaleString('en-IN')} against ${inv.invoiceNo}!`)
    } catch {
      setInvoices(previous)
      toast.error('Payment update failed — reverted.')
    }
  }

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

        {labs.length === 0 ? (
          <EmptyStateCard
            icon={FlaskConical}
            title="No lab investigations ordered yet"
            description="Order pathology or radiology investigations from the Smart Rx Pad or click + Quick Lab Order."
          />
        ) : (
          <div className="space-y-2.5 text-xs">
            {labs.map((lab) => {
              const p = lab.patient as PatientRecord
              const labId = String(lab.id)
              return (
                <div
                  key={labId}
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
                        value={resultInput[labId] || ''}
                        onChange={(e) =>
                          setResultInput({ ...resultInput, [labId]: e.target.value })
                        }
                        placeholder="Enter lab result values..."
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => publishLabOptimistic(labId)}
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
        )}
      </div>

      {/* Unified OPD & IPD Invoices DataTable with Bulk Settlement */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-teal-600" />
            Unified OPD &amp; IPD Invoices ({invoices.length}) · Advance Deposits ({deposits.length})
          </h3>
        </div>

        <SaaSDataTable<InvoiceRecord>
          data={invoices}
          loading={loading}
          rowKey={(i) => i.id}
          searchPlaceholder="Search by Invoice No, Patient Name, or UHID..."
          searchableText={(i) => `${i.invoiceNo} ${i.patient?.name || ''} ${i.patient?.uhid || ''}`}
          exportFilename="hospital-invoices.csv"
          filters={[
            {
              key: 'type',
              label: 'Department',
              options: [
                { value: 'OPD', label: 'OPD Bills' },
                { value: 'IPD', label: 'IPD Final Bills' },
              ],
              match: (i, val) => i.billType === val,
            },
            {
              key: 'status',
              label: 'Payment Status',
              options: [
                { value: 'paid', label: 'Paid' },
                { value: 'unpaid', label: 'Pending / Partial' },
              ],
              match: (i, val) => (val === 'paid' ? i.status === 'paid' : i.status !== 'paid'),
            },
          ]}
          bulkActions={[
            {
              label: 'Settle & Mark Selected Paid (UPI)',
              variant: 'primary',
              onExecute: async (ids, _rows, clear) => {
                await fetch('/api/billing', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'bulkMarkPaid', ids, paymentMode: 'UPI' }),
                })
                toast.success(`Settled ${ids.length} invoice(s)!`)
                clear()
                loadData()
              },
            },
          ]}
          columns={[
            {
              key: 'invoiceNo',
              header: 'Invoice No',
              sortable: true,
              sortValue: (i) => i.invoiceNo,
              render: (i) => <span className="font-mono font-bold">{i.invoiceNo}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              sortValue: (i) => i.billType,
              render: (i) => <span className="font-bold text-teal-700">{i.billType}</span>,
            },
            {
              key: 'patient',
              header: 'Patient',
              sortable: true,
              sortValue: (i) => i.patient?.name || '',
              render: (i) => (
                <span>
                  {i.patient?.name}{' '}
                  <span className="text-slate-400">({i.patient?.uhid})</span>
                </span>
              ),
            },
            {
              key: 'total',
              header: 'Total Amount',
              sortable: true,
              sortValue: (i) => Number(i.totalAmount || 0),
              render: (i) => (
                <span className="font-bold">
                  ₹{Number(i.totalAmount || 0).toLocaleString('en-IN')}
                </span>
              ),
            },
            {
              key: 'paid',
              header: 'Paid',
              sortable: true,
              sortValue: (i) => Number(i.amountPaid || 0),
              render: (i) => (
                <span className="text-emerald-700 font-semibold">
                  ₹{Number(i.amountPaid || 0).toLocaleString('en-IN')}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Balance Due',
              sortable: true,
              sortValue: (i) => Number(i.balanceDue || 0),
              render: (i) => (
                <span className="text-rose-700 font-bold">
                  ₹{Number(i.balanceDue || 0).toLocaleString('en-IN')}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (i) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    i.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {i.status}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              render: (i) =>
                Number(i.balanceDue || 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => collectInvoiceOptimistic(i)}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white hover:bg-emerald-700"
                  >
                    Collect ₹{Number(i.balanceDue).toLocaleString('en-IN')}
                  </button>
                ) : null,
            },
          ]}
        />
      </div>
    </div>
  )
}

export function HospitalSettingsTab({
  onRefreshGlobal,
  onOpenWizard,
}: {
  onRefreshGlobal?: () => void
  onOpenWizard?: () => void
}) {
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
    patientPortalEnabled: false,
    portalWelcomeMessage: '',
    pharmacyEnabled: false,
  })
  const [orgPlan, setOrgPlan] = useState<{ name: string; tier: string; status: string } | null>(null)
  const [staff, setStaff] = useState<Array<Record<string, unknown>>>([])
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: 'DOCTOR',
    specialization: 'General Medicine',
    qualification: 'MBBS, MD',
    consultationFee: '600',
    portalAccessEnabled: false,
  })

  // #6 Autosave Draft on White-Label Branding Settings
  const { status: autosaveStatus, lastSavedAt } = useAutosaveDraft(
    'hms_branding_settings_draft',
    settings,
    Boolean(settings.clinicDisplayName)
  )

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const d = await res.json()
      if (d.settings) setSettings(d.settings)
      setStaff(d.staff || [])
      if (d.organization?.subscription?.plan) {
        setOrgPlan({
          name: d.organization.subscription.plan.name,
          tier: d.organization.subscription.plan.tier,
          status: d.organization.subscription.status,
        })
      }
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
          const gstErr = settings.gstNumber
            ? validateSmartField(settings.gstNumber, ['gstin'])
            : null
          if (gstErr) {
            toast.error(gstErr)
            return
          }
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateBranding', ...settings }),
          })
          if (res.ok) {
            toast.success('Hospital letterhead & billing settings saved!')
            onRefreshGlobal?.()
          }
        }}
        className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">
              White-Label Letterhead, UHID &amp; GST Settings
            </h3>
            {orgPlan && (
              <TierBadge tier={orgPlan.tier} planName={orgPlan.name} status={orgPlan.status} />
            )}
          </div>
          <AutosaveBadge status={autosaveStatus} lastSavedAt={lastSavedAt} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SmartValidatedInput
            className="sm:col-span-2"
            label="Hospital / Clinic Display Name"
            required
            value={settings.clinicDisplayName || ''}
            onChange={(v) => setSettings({ ...settings, clinicDisplayName: v })}
          />
          <SmartValidatedInput
            className="sm:col-span-2"
            label="Tagline / Accreditation"
            value={settings.tagline || ''}
            onChange={(v) => setSettings({ ...settings, tagline: v })}
          />
          <SmartValidatedInput
            className="sm:col-span-2"
            label="Address"
            value={settings.address || ''}
            onChange={(v) => setSettings({ ...settings, address: v })}
          />
          <SmartValidatedInput
            label="Reception Phone"
            rules={['indian_phone']}
            value={settings.phone || ''}
            onChange={(v) => setSettings({ ...settings, phone: v })}
          />
          <SmartValidatedInput
            label="UHID Prefix"
            rules={['uhid_prefix']}
            value={settings.uhidPrefix || 'HMS'}
            onChange={(v) => setSettings({ ...settings, uhidPrefix: v.toUpperCase() })}
          />
          <SmartValidatedInput
            label="UPI VPA for Instant QR Receipts"
            value={settings.upiId || ''}
            onChange={(v) => setSettings({ ...settings, upiId: v })}
          />
          <SmartValidatedInput
            label="15-Digit GSTIN (Optional)"
            rules={['gstin']}
            value={settings.gstNumber || ''}
            onChange={(v) => setSettings({ ...settings, gstNumber: v.toUpperCase() })}
            placeholder="27AABCS1429B1Z5"
          />
        </div>

        {/* Patient Portal Access Control */}
        <div className="col-span-2 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-teal-600" />
              <h4 className="font-bold text-slate-900">Patient Portal Access</h4>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, patientPortalEnabled: !settings.patientPortalEnabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 ${settings.patientPortalEnabled ? 'bg-teal-600 border-teal-600' : 'bg-slate-200 border-slate-200'} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600`}
              aria-pressed={settings.patientPortalEnabled}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${settings.patientPortalEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          <p className="text-[11px] text-teal-700 mb-2">
            जब ON हो तब ही आपके पेशेंट्स पोर्टल लॉगिन कर सकेंगे। डॉक्टर लेवल पर भी एक्सेस देना ज़रूरी है।
          </p>
          <SmartValidatedInput
            label="Portal Welcome Message (shown to patients)"
            value={settings.portalWelcomeMessage || ''}
            onChange={(v) => setSettings({ ...settings, portalWelcomeMessage: v })}
            placeholder="Welcome to our patient portal..."
          />
        </div>

        {/* Pharmacy Module Toggle */}
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <Package className="h-3 w-3" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Pharmacy Inventory Module</h4>
                <p className="text-[10px] text-teal-700">
                  ऑन करने पर ही डैशबोर्ड में Pharmacy Stock tab दिखेगा।
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, pharmacyEnabled: !settings.pharmacyEnabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 ${settings.pharmacyEnabled ? 'bg-teal-600 border-teal-600' : 'bg-slate-200 border-slate-200'} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600`}
              aria-pressed={settings.pharmacyEnabled}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${settings.pharmacyEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          <p className="text-[11px] text-teal-700 mb-0">
            अस्पताल के पास pharmacy न हो तो इसे OFF रखें। dashboard से Pharmacy tab hide हो जाएगा।
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700"
          >
            <CheckCircle2 className="h-4 w-4" /> Save Hospital Branding
          </button>

          {onOpenWizard && (
            <button
              type="button"
              onClick={onOpenWizard}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100"
            >
              <Sparkles className="h-3.5 w-3.5" /> Launch Guided Setup Wizard
            </button>
          )}
        </div>
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
          {staff.map((u) => {
            const isDoctor = String(u.role) === 'DOCTOR'
            const portalEnabled = Boolean(u.portalAccessEnabled)
            return (
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
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-bold text-teal-700">
                    {String(u.role)}
                  </span>
                  {isDoctor && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        portalEnabled
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {portalEnabled ? 'Portal ON' : 'Portal OFF'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showAddStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-slate-900">Add Doctor / Nursing / Billing Staff</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const emailErr = validateSmartField(staffForm.email, ['required', 'email'])
                if (emailErr) {
                  toast.error(emailErr)
                  return
                }
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
              <SmartValidatedInput
                label="Full Name"
                required
                value={staffForm.name}
                onChange={(v) => setStaffForm({ ...staffForm, name: v })}
                placeholder="Dr. Sneha Patil"
              />
              <SmartValidatedInput
                label="Work Email"
                required
                rules={['email']}
                value={staffForm.email}
                onChange={(v) => setStaffForm({ ...staffForm, email: v })}
                placeholder="sneha@hospital.in"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="DOCTOR">DOCTOR</option>
                    <option value="NURSE">NURSE (IPD)</option>
                    <option value="RECEPTIONIST">RECEPTIONIST</option>
                    <option value="PHARMACIST">PHARMACIST</option>
                  </select>
                </div>
                <SmartValidatedInput
                  label="Specialization"
                  value={staffForm.specialization}
                  onChange={(v) => setStaffForm({ ...staffForm, specialization: v })}
                />
                {staffForm.role === 'DOCTOR' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={staffForm.portalAccessEnabled}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, portalAccessEnabled: e.target.checked })
                      }
                      className="rounded border-slate-300 bg-slate-50 text-teal-600 focus:ring-teal-500"
                    />
                    <label className="text-sm text-slate-600 font-medium">
                      Enable Patient Portal Access for this doctor&rsquo;s patients
                    </label>
                  </div>
                )}
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
