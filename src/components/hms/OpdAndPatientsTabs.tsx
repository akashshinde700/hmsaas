'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BedDouble,
  CheckCircle2,
  Crown,
  HeartPulse,
  Plus,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { validateSmartField } from '@/hooks/useSaaSUX'
import {
  ConfirmDestructiveModal,
  EmptyStateCard,
  SaaSDataTable,
  SkeletonCardGrid,
  SmartValidatedInput,
} from '@/components/saas-ux/SaaSUXPrimitives'
import type { DoctorOption, PatientRecord } from './types'

export function OpdQueueTab({
  patients,
  doctors,
  onWriteRx,
  onAdmitIpd,
  onRefreshGlobal,
}: {
  patients: PatientRecord[]
  doctors: DoctorOption[]
  onWriteRx: (patientId: string, queueId: string) => void
  onAdmitIpd: (patientId: string, diagnosis: string) => void
  onRefreshGlobal?: () => void
}) {
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set())
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [checkInForm, setCheckInForm] = useState({
    patientId: patients[0]?.id || '',
    doctorId: doctors[0]?.id || '',
    priority: 'normal',
    visitReason: '',
  })
  const [vitalsTarget, setVitalsTarget] = useState<Record<string, unknown> | null>(null)
  const [vForm, setVForm] = useState({
    bpSystolic: '122',
    bpDiastolic: '80',
    pulse: '78',
    temperatureF: '98.6',
    spo2: '99',
    weightKg: '68',
  })

  const loadOpd = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/opd')
      if (res.ok) {
        const d = await res.json()
        setQueue(d.queue || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOpd()
  }, [loadOpd])

  // #1 Optimistic UI Update with rollback on failure
  async function updateQueueStatusOptimistic(queueId: string, nextStatus: string) {
    const previous = queue
    setQueue((prev) =>
      prev.map((q) => (String(q.id) === queueId ? { ...q, status: nextStatus } : q))
    )
    try {
      const res = await fetch('/api/opd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateQueueStatus', queueId, status: nextStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      onRefreshGlobal?.()
    } catch {
      setQueue(previous)
      toast.error('Could not update token status — reverted.')
    }
  }

  async function handleBulkComplete() {
    const ids = Array.from(selectedQueueIds)
    if (ids.length === 0) return
    const previous = queue
    setQueue((prev) =>
      prev.map((q) => (selectedQueueIds.has(String(q.id)) ? { ...q, status: 'completed' } : q))
    )
    setSelectedQueueIds(new Set())
    try {
      const res = await fetch('/api/opd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulkUpdateStatus', ids, status: 'completed' }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Marked ${ids.length} OPD token(s) completed!`)
      onRefreshGlobal?.()
    } catch {
      setQueue(previous)
      toast.error('Bulk update failed — reverted.')
    }
  }

  const visibleQueue =
    statusFilter === 'ALL' ? queue : queue.filter((q) => String(q.status) === statusFilter)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Live OPD Token Queue &amp; Nursing Vitals Station
            </h2>
            <p className="text-xs text-slate-500">
              Instant optimistic status transitions, multi-token bulk actions, and 1-click consultation handoff.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCheckInForm((f) => ({
                ...f,
                patientId: patients[0]?.id || '',
                doctorId: doctors[0]?.id || '',
              }))
              setShowCheckIn(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> Issue OPD Token
          </button>
        </div>

        {/* #12 Advanced Queue Status Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: `All (${queue.length})` },
              { id: 'waiting', label: 'Waiting' },
              { id: 'vitals_done', label: 'Vitals Done' },
              { id: 'in_consultation', label: 'In Consultation' },
              { id: 'completed', label: 'Completed' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-full px-3 py-1 font-bold transition ${
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {selectedQueueIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-1.5 text-white">
              <span className="font-bold text-teal-400">{selectedQueueIds.size} selected</span>
              <button
                type="button"
                onClick={handleBulkComplete}
                className="rounded-lg bg-emerald-500 px-2.5 py-1 font-bold text-slate-950 hover:bg-emerald-400"
              >
                Mark Completed
              </button>
              <button
                type="button"
                onClick={() => setSelectedQueueIds(new Set())}
                className="text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* #2 Skeleton Loader or #5 Empty State or Queue Cards */}
      {loading ? (
        <SkeletonCardGrid count={6} />
      ) : visibleQueue.length === 0 ? (
        <EmptyStateCard
          icon={Activity}
          title="No OPD tokens in this view"
          description="Issue a walk-in OPD token or switch status filter to see all patients checked in today."
          actionLabel="+ Issue OPD Token"
          onAction={() => setShowCheckIn(true)}
          secondaryLabel={statusFilter !== 'ALL' ? 'Show All Tokens' : undefined}
          onSecondary={statusFilter !== 'ALL' ? () => setStatusFilter('ALL') : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleQueue.map((q) => {
            const p = q.patient as PatientRecord
            const d = q.doctor as DoctorOption | null
            const status = String(q.status)
            const priority = String(q.priority)
            const qId = String(q.id)
            const isSelected = selectedQueueIds.has(qId)
            return (
              <div
                key={qId}
                className={`rounded-2xl border bg-white p-5 shadow-2xs flex flex-col justify-between transition ${
                  isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedQueueIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(qId)) next.delete(qId)
                            else next.add(qId)
                            return next
                          })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 font-mono text-sm font-extrabold text-white">
                        #{String(q.tokenNumber)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {priority !== 'normal' && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                          {priority}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'in_consultation'
                            ? 'bg-teal-100 text-teal-800'
                            : status === 'vitals_done'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-slate-900">{p?.name}</h3>
                  <p className="text-xs text-slate-500">
                    {p?.uhid} · {p?.ageYears ?? '—'}y/{p?.gender} · {p?.phone}
                  </p>
                  {d && (
                    <p className="mt-1 text-xs font-medium text-teal-700">Consultant: {d.name}</p>
                  )}
                  {Boolean(q.chiefComplaint || q.visitReason) && (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                      Reason: {String(q.chiefComplaint || q.visitReason)}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setVitalsTarget(q)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Vitals
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateQueueStatusOptimistic(qId, 'in_consultation')
                      onWriteRx(p.id, qId)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 font-bold text-white hover:bg-teal-700"
                  >
                    <Stethoscope className="h-3.5 w-3.5" /> Consult &amp; Rx →
                  </button>
                  {status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => updateQueueStatusOptimistic(qId, 'completed')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Done
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onAdmitIpd(p.id, String(q.chiefComplaint || q.visitReason || 'OPD Evaluation'))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    <BedDouble className="h-3.5 w-3.5" /> IPD
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Issue OPD Token */}
      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Issue OPD Queue Token</h3>
              <button type="button" onClick={() => setShowCheckIn(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const res = await fetch('/api/opd', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'checkIn', ...checkInForm }),
                  })
                  const d = await res.json()
                  if (!res.ok) throw new Error(d.error || 'Could not issue OPD token.')
                  toast.success(`Issued OPD Token #${d.tokenNumber}`)
                  setShowCheckIn(false)
                  loadOpd()
                  onRefreshGlobal?.()
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not issue OPD token.')
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Patient</label>
                <select
                  value={checkInForm.patientId}
                  onChange={(e) => setCheckInForm({ ...checkInForm, patientId: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.uhid})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Doctor</label>
                <select
                  value={checkInForm.doctorId}
                  onChange={(e) => setCheckInForm({ ...checkInForm, doctorId: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={checkInForm.priority}
                  onChange={(e) => setCheckInForm({ ...checkInForm, priority: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="normal">Normal Walk-In</option>
                  <option value="vip">VIP Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Chief Complaint</label>
                <input
                  value={checkInForm.visitReason}
                  onChange={(e) => setCheckInForm({ ...checkInForm, visitReason: e.target.value })}
                  placeholder="Fever, BP checkup, follow-up..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckIn(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white">
                  Generate Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nurse Triage Vitals */}
      {vitalsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-slate-900">
              Record Triage Vitals — {(vitalsTarget.patient as PatientRecord)?.name}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const res = await fetch('/api/opd', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'recordVitals',
                      queueId: vitalsTarget.id,
                      patientId: (vitalsTarget.patient as PatientRecord).id,
                      ...vForm,
                    }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Could not save triage vitals.')
                  toast.success('Triage vitals recorded!')
                  setVitalsTarget(null)
                  loadOpd()
                  onRefreshGlobal?.()
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not save triage vitals.')
                }
              }}
              className="mt-4 grid grid-cols-2 gap-3 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">Systolic BP</label>
                <input
                  value={vForm.bpSystolic}
                  onChange={(e) => setVForm({ ...vForm, bpSystolic: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Diastolic BP</label>
                <input
                  value={vForm.bpDiastolic}
                  onChange={(e) => setVForm({ ...vForm, bpDiastolic: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Pulse (/min)</label>
                <input
                  value={vForm.pulse}
                  onChange={(e) => setVForm({ ...vForm, pulse: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">SpO2 (%)</label>
                <input
                  value={vForm.spo2}
                  onChange={(e) => setVForm({ ...vForm, spo2: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Temp (°F)</label>
                <input
                  value={vForm.temperatureF}
                  onChange={(e) => setVForm({ ...vForm, temperatureF: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Weight (kg)</label>
                <input
                  value={vForm.weightKg}
                  onChange={(e) => setVForm({ ...vForm, weightKg: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVitalsTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white">
                  Save Vitals
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function PatientsDirectoryTab({
  patients,
  onRefreshPatients,
  onWriteRx,
  onAdmitIpd,
}: {
  patients: PatientRecord[]
  onRefreshPatients: () => Promise<void>
  onWriteRx: (patientId: string) => void
  onAdmitIpd: (patientId: string, diagnosis: string) => void
}) {
  const [showRegister, setShowRegister] = useState(false)
  const [pendingBulkDelete, setPendingBulkDelete] = useState<{
    ids: string[]
    clear: () => void
  } | null>(null)

  const [form, setForm] = useState({
    name: '',
    gender: 'Male',
    ageYears: '36',
    bloodGroup: 'O+',
    phone: '',
    city: 'Pune',
    allergies: '',
    chronicConditions: '',
    isVip: false,
    addToOpdQueue: true,
  })

  return (
    <div className="space-y-5">
      <SaaSDataTable<PatientRecord>
        data={patients}
        rowKey={(p) => p.id}
        searchPlaceholder="Debounced search by UHID, patient name, mobile, allergy..."
        searchableText={(p) =>
          `${p.uhid} ${p.name} ${p.phone} ${p.allergies || ''} ${p.chronicConditions || ''}`
        }
        exportFilename="patients-uhid-directory.csv"
        emptyTitle="No matching UHID patients found"
        emptyDescription="Register a new walk-in patient or clear active filters to view your full directory."
        emptyActionLabel="+ Register New Patient"
        onEmptyAction={() => setShowRegister(true)}
        headerRight={
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
          >
            <UserPlus className="h-4 w-4" /> Register Patient (UHID)
          </button>
        }
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'ipd', label: 'Currently Admitted (IPD)' },
              { value: 'opd', label: 'Out-Patient' },
              { value: 'vip', label: 'VIP Patients' },
              { value: 'allergy', label: 'Has Drug Allergy' },
            ],
            match: (p, val) => {
              if (val === 'ipd') return Boolean(p.ipdAdmissions && p.ipdAdmissions.length > 0)
              if (val === 'opd') return !p.ipdAdmissions || p.ipdAdmissions.length === 0
              if (val === 'vip') return Boolean(p.isVip)
              if (val === 'allergy') return Boolean(p.allergies && p.allergies.trim())
              return true
            },
          },
          {
            key: 'gender',
            label: 'Gender',
            options: [
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
              { value: 'Other', label: 'Other' },
            ],
            match: (p, val) => p.gender === val,
          },
          {
            key: 'blood',
            label: 'Blood Group',
            options: ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-'].map((bg) => ({
              value: bg,
              label: bg,
            })),
            match: (p, val) => p.bloodGroup === val,
          },
        ]}
        bulkActions={[
          {
            label: 'Mark VIP',
            variant: 'primary',
            onExecute: async (ids, _rows, clear) => {
              await fetch('/api/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'bulkVip', ids, isVip: true }),
              })
              toast.success(`Tagged ${ids.length} patient(s) as VIP!`)
              clear()
              await onRefreshPatients()
            },
          },
          {
            label: 'Delete Selected',
            variant: 'danger',
            onExecute: (ids, _rows, clear) => {
              setPendingBulkDelete({ ids, clear })
            },
          },
        ]}
        columns={[
          {
            key: 'uhid',
            header: 'UHID',
            sortable: true,
            sortValue: (p) => p.uhid,
            csvValue: (p) => p.uhid,
            render: (p) => (
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-teal-700">{p.uhid}</span>
                {p.isVip && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    <Crown className="h-2.5 w-2.5" /> VIP
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'name',
            header: 'Patient Details',
            sortable: true,
            sortValue: (p) => p.name,
            csvValue: (p) => `${p.name} (${p.phone})`,
            render: (p) => (
              <div>
                <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                <p className="text-slate-500">
                  {p.ageYears ?? '—'} yrs · {p.gender} · {p.bloodGroup || '—'} · {p.phone}
                </p>
              </div>
            ),
          },
          {
            key: 'allergies',
            header: 'Allergies / Chronic',
            csvValue: (p) => `${p.allergies || 'None'} | ${p.chronicConditions || ''}`,
            render: (p) => (
              <div className="max-w-[240px]">
                {p.allergies ? (
                  <span className="rounded bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                    Allergy: {p.allergies}
                  </span>
                ) : (
                  <span className="text-slate-400">No known drug allergies</span>
                )}
                {p.chronicConditions && (
                  <p className="mt-1 text-slate-600 truncate">{p.chronicConditions}</p>
                )}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Care Status',
            sortable: true,
            sortValue: (p) => (p.ipdAdmissions?.length ? '1-IPD' : '2-OPD'),
            render: (p) => {
              const activeIpd = p.ipdAdmissions?.[0]
              return activeIpd ? (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-700">
                  Admitted ({activeIpd.bed?.bedNumber || activeIpd.admissionNo})
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                  Out-Patient
                </span>
              )
            },
          },
          {
            key: 'actions',
            header: 'Quick Actions',
            render: (p) => {
              const activeIpd = p.ipdAdmissions?.[0]
              return (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onWriteRx(p.id)}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 font-bold text-white hover:bg-teal-700"
                  >
                    Write OPD Rx
                  </button>
                  {!activeIpd && (
                    <button
                      type="button"
                      onClick={() => onAdmitIpd(p.id, p.chronicConditions || 'IPD Evaluation')}
                      className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 font-semibold text-sky-800 hover:bg-sky-100"
                    >
                      Admit IPD
                    </button>
                  )}
                </div>
              )
            },
          },
        ]}
      />

      {/* #19 Destructive Action Protection Modal for Bulk Patient Deletion */}
      <ConfirmDestructiveModal
        open={Boolean(pendingBulkDelete)}
        title={`Delete ${pendingBulkDelete?.ids.length || 0} Patient Record(s)?`}
        description="Deleting patient records permanently removes their UHID profile, OPD prescriptions, and billing history inside your hospital tenant."
        confirmText="Tip: Export CSV first if you need an archival copy."
        requireExactMatch="DELETE"
        confirmButtonLabel="Permanently Delete Records"
        onCancel={() => setPendingBulkDelete(null)}
        onConfirm={async () => {
          if (!pendingBulkDelete) return
          await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bulkDelete', ids: pendingBulkDelete.ids }),
          })
          toast.success(`Deleted ${pendingBulkDelete.ids.length} patient record(s).`)
          pendingBulkDelete.clear()
          setPendingBulkDelete(null)
          await onRefreshPatients()
        }}
      />

      {/* #9 Smart Validated Register Patient Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Register New Patient (UHID)</h3>
              <button type="button" onClick={() => setShowRegister(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const phoneErr = validateSmartField(form.phone, ['required', 'indian_phone'])
                const ageErr = validateSmartField(form.ageYears, ['age'])
                if (!form.name.trim() || phoneErr || ageErr) {
                  toast.error(phoneErr || ageErr || 'Please enter valid patient details.')
                  return
                }
                const res = await fetch('/api/patients', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(form),
                })
                const d = await res.json()
                if (!res.ok) {
                  toast.error(d.error || 'Could not register patient')
                  return
                }
                const created = d.patient || d
                toast.success(`Registered ${created.name} (${created.uhid})`)
                setShowRegister(false)
                await onRefreshPatients()
              }}
              className="mt-4 grid grid-cols-2 gap-3 text-xs"
            >
              <SmartValidatedInput
                className="col-span-2"
                label="Full Name"
                required
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="e.g. Rajeshwar Deshmukh"
              />
              <SmartValidatedInput
                label="10-Digit Mobile"
                required
                rules={['indian_phone']}
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="9822012345"
              />
              <SmartValidatedInput
                label="Age (Years)"
                type="number"
                rules={['age']}
                value={form.ageYears}
                onChange={(v) => setForm({ ...form, ageYears: v })}
              />
              <div>
                <label className="block font-bold mb-1 text-slate-700">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-700">Blood Group</label>
                <select
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option>O+</option>
                  <option>A+</option>
                  <option>B+</option>
                  <option>AB+</option>
                  <option>O-</option>
                  <option>A-</option>
                  <option>B-</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-rose-700 mb-1">Known Drug Allergies</label>
                <input
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Sulfa drugs (leave blank if none)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold mb-1 text-slate-700">Chronic Conditions</label>
                <input
                  value={form.chronicConditions}
                  onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })}
                  placeholder="Hypertension, Type 2 Diabetes, Asthma..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2 flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.addToOpdQueue}
                    onChange={(e) => setForm({ ...form, addToOpdQueue: e.target.checked })}
                  />
                  Auto-issue Today&apos;s OPD Queue Token
                </label>
                <label className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <input
                    type="checkbox"
                    checked={form.isVip}
                    onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
                  />
                  VIP Priority
                </label>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white">
                  Generate UHID &amp; Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
