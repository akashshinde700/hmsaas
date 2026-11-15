'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BedDouble,
  Clock,
  HeartPulse,
  Plus,
  Search,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
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
    bloodSugarMgDl: '',
  })

  const loadOpd = useCallback(async () => {
    const res = await fetch('/api/opd')
    if (res.ok) {
      const d = await res.json()
      setQueue(d.queue || [])
    }
  }, [])

  useEffect(() => {
    loadOpd()
  }, [loadOpd])

  async function updateQueueStatus(queueId: string, status: string) {
    await fetch('/api/opd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateQueueStatus', queueId, status }),
    })
    loadOpd()
    onRefreshGlobal?.()
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Live OPD Token Queue &amp; Nursing Vitals Station
          </h2>
          <p className="text-xs text-slate-500">
            Check in walk-in or appointment patients, capture triage vitals, and send directly to the Smart Rx Pad.
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

      {/* Queue Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {queue.map((q) => {
          const p = q.patient as PatientRecord
          const d = q.doctor as DoctorOption | null
          const status = String(q.status)
          const priority = String(q.priority)
          return (
            <div
              key={String(q.id)}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 font-mono text-sm font-extrabold text-white">
                    #{String(q.tokenNumber)}
                  </span>
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
                {Boolean(q.visitReason) && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                    Reason: {String(q.visitReason)}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setVitalsTarget(q)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Record Vitals
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateQueueStatus(String(q.id), 'in_consultation')
                    onWriteRx(p.id, String(q.id))
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 font-bold text-white hover:bg-teal-700"
                >
                  <Stethoscope className="h-3.5 w-3.5" /> Consult &amp; Rx →
                </button>
                <button
                  type="button"
                  onClick={() => onAdmitIpd(p.id, String(q.visitReason || 'OPD Evaluation'))}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 font-semibold text-sky-800 hover:bg-sky-100"
                >
                  <BedDouble className="h-3.5 w-3.5" /> IPD
                </button>
              </div>
            </div>
          )
        })}
      </div>

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
                const res = await fetch('/api/opd', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'checkIn', ...checkInForm }),
                })
                if (res.ok) {
                  const d = await res.json()
                  toast.success(`Issued OPD Token #${d.tokenNumber}`)
                  setShowCheckIn(false)
                  loadOpd()
                  onRefreshGlobal?.()
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
                await fetch('/api/opd', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'recordVitals',
                    queueId: vitalsTarget.id,
                    patientId: (vitalsTarget.patient as PatientRecord).id,
                    ...vForm,
                  }),
                })
                toast.success('Triage vitals recorded!')
                setVitalsTarget(null)
                loadOpd()
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
  const [query, setQuery] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [form, setForm] = useState({
    name: '',
    gender: 'Male',
    ageYears: '36',
    bloodGroup: 'O+',
    phone: '',
    city: 'Pune',
    allergies: '',
    chronicConditions: '',
    insuranceProvider: '',
  })

  const filtered = patients.filter((p) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.uhid.toLowerCase().includes(q) ||
      p.phone.includes(q)
    )
  })

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by UHID, patient name, or phone..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700"
        >
          <UserPlus className="h-4 w-4" /> Register New Patient (UHID)
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="py-3 px-4">UHID</th>
              <th className="py-3 px-4">Patient Details</th>
              <th className="py-3 px-4">Allergies / Chronic</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const activeIpd = p.ipdAdmissions?.[0]
              return (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 font-mono font-bold text-teal-700">{p.uhid}</td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                    <p className="text-slate-500">
                      {p.ageYears ?? '—'} yrs · {p.gender} · {p.bloodGroup || '—'} · {p.phone}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 max-w-[260px]">
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
                  </td>
                  <td className="py-3.5 px-4">
                    {activeIpd ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-700">
                        Admitted ({activeIpd.bed?.bedNumber || activeIpd.admissionNo})
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                        Out-Patient
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Register New Patient</h3>
              <button type="button" onClick={() => setShowRegister(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
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
                toast.success(`Registered ${d.name} (${d.uhid})`)
                setShowRegister(false)
                await onRefreshPatients()
              }}
              className="mt-4 grid grid-cols-2 gap-3 text-xs"
            >
              <div className="col-span-2">
                <label className="block font-bold mb-1">Full Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Patient full name"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Phone *</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="98220XXXXX"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Age (Years)</label>
                <input
                  type="number"
                  value={form.ageYears}
                  onChange={(e) => setForm({ ...form, ageYears: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Gender</label>
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
                <label className="block font-bold mb-1">Blood Group</label>
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
                <label className="block font-bold mb-1">Chronic Conditions</label>
                <input
                  value={form.chronicConditions}
                  onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })}
                  placeholder="Hypertension, Type 2 Diabetes, Asthma..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
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
