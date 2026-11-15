'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Pill,
  Plus,
  Printer,
  Receipt,
  Search,
  Sparkles,
  UserPlus,
  Wind,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  ClinicSettingsData,
  DoctorOption,
  MedicineSearchResult,
  PatientRecord,
} from './types'

interface WardCategory {
  id: string
  name: string
  code: string
  floor: string
  dailyRate: number
  nursingChargeDay: number
  color: string
  description?: string | null
}

interface EnrichedBed {
  id: string
  categoryId: string
  category: WardCategory
  bedNumber: string
  floor: string
  hasOxygen: boolean
  hasVentilator: boolean
  hasMonitor: boolean
  status: string
  effectiveStatus: 'free' | 'occupied' | 'cleaning' | 'maintenance' | string
  occupant: null | {
    admissionId: string
    admissionNo: string
    patientId: string
    patientName: string
    uhid: string
    ageYears?: number | null
    gender: string
    allergies?: string | null
    diagnosis: string
    admittedAt: string
    doctorName: string
  }
}

interface IpdFinancials {
  stayDays: number
  dailyRoomRate: number
  dailyNursingRate: number
  roomChargesTotal: number
  nursingChargesTotal: number
  medicationChargesTotal: number
  procedureAndOtherChargesTotal: number
  grossTotal: number
  depositsPaidTotal: number
  preAuthAmount: number
  netPayable: number
}

interface EnrichedAdmission {
  id: string
  admissionNo: string
  patientId: string
  patient: PatientRecord
  bedId: string
  bed: { id: string; bedNumber: string; floor: string; category: WardCategory }
  admittingDoctor: DoctorOption
  admissionType: string
  admittedAt: string
  dischargedAt: string | null
  status: string
  provisionalDiagnosis: string
  finalDiagnosis?: string | null
  chiefComplaints?: string | null
  allergiesSnapshot?: string | null
  attendantName?: string | null
  attendantRelation?: string | null
  attendantPhone?: string | null
  insuranceTpa?: string | null
  preAuthAmount: number
  conditionAtDischarge?: string | null
  dischargeSummary?: string | null
  dischargeAdvice?: string | null
  roundNotes: Array<{
    id: string
    authorName: string
    noteType: string
    observations: string
    plan?: string | null
    vitalsText?: string | null
    recordedAt: string
  }>
  medicationOrders: Array<{
    id: string
    medicineName: string
    genericName?: string | null
    dosage: string
    route: string
    frequency: string
    duration: string
    unitPrice: number
    dosesGiven: number
    lastGivenAt?: string | null
    status: string
  }>
  chargeItems: Array<{
    id: string
    category: string
    description: string
    quantity: number
    unitRate: number
    amount: number
    chargedAt: string
  }>
  deposits: Array<{
    id: string
    receiptNo: string
    amount: number
    paymentMode: string
    referenceNo?: string | null
    notes?: string | null
    depositedAt: string
  }>
  bedTransfers: Array<{
    id: string
    fromBed: { bedNumber: string }
    toBed: { bedNumber: string }
    reason?: string | null
    transferredAt: string
  }>
  financials: IpdFinancials
}

export default function IpdModuleTab({
  patients,
  doctors,
  settings,
  pendingAdmit,
  onClearPendingAdmit,
  onRefreshGlobal,
}: {
  patients: PatientRecord[]
  doctors: DoctorOption[]
  settings: ClinicSettingsData | null
  pendingAdmit?: { patientId: string; diagnosis: string } | null
  onClearPendingAdmit?: () => void
  onRefreshGlobal?: () => void
}) {
  const [categories, setCategories] = useState<WardCategory[]>([])
  const [beds, setBeds] = useState<EnrichedBed[]>([])
  const [admissions, setAdmissions] = useState<EnrichedAdmission[]>([])
  const [selectedWard, setSelectedWard] = useState<string>('ALL')
  const [admFilter, setAdmFilter] = useState<'current' | 'discharged'>('current')

  // Active Admission Clinical & Billing Chart Modal
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null)
  const [chartTab, setChartTab] = useState<'overview' | 'rounds' | 'mar' | 'billing' | 'discharge'>('overview')
  const [printableDischarge, setPrintableDischarge] = useState<EnrichedAdmission | null>(null)

  // Modals
  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [admitForm, setAdmitForm] = useState({
    patientId: '',
    bedId: '',
    admittingDoctorId: doctors[0]?.id || '',
    admissionType: 'Emergency',
    provisionalDiagnosis: '',
    chiefComplaints: '',
    attendantName: '',
    attendantRelation: 'Spouse / Parent',
    attendantPhone: '',
    insuranceTpa: '',
    initialDeposit: '5000',
    depositMode: 'UPI',
  })

  const [showAddWard, setShowAddWard] = useState(false)
  const [wardForm, setWardForm] = useState({
    name: '',
    code: '',
    floor: '2nd Floor',
    dailyRate: '2500',
    nursingChargeDay: '500',
  })

  const [showAddBed, setShowAddBed] = useState(false)
  const [bedForm, setBedForm] = useState({
    categoryId: '',
    bedNumber: '',
    floor: '1st Floor',
    hasOxygen: true,
    hasMonitor: false,
    hasVentilator: false,
  })

  // Sub-forms inside IPD Chart
  const [roundForm, setRoundForm] = useState({
    noteType: 'Doctor Round',
    observations: '',
    plan: '',
    vitalsText: 'BP 120/80 mmHg · Pulse 78/min · SpO2 98% · Temp 98.6°F',
  })
  const [marSearch, setMarSearch] = useState('')
  const [marResults, setMarResults] = useState<MedicineSearchResult[]>([])
  const [chargeForm, setChargeForm] = useState({
    category: 'Procedure',
    description: '',
    quantity: '1',
    unitRate: '1500',
  })
  const [depositForm, setDepositForm] = useState({
    amount: '5000',
    paymentMode: 'UPI',
    referenceNo: '',
    notes: 'Interim IPD Advance Deposit',
  })
  const [transferBedId, setTransferBedId] = useState('')
  const [transferReason, setTransferReason] = useState('Step-down / clinical ward shift')
  const [dischargeForm, setDischargeForm] = useState({
    finalDiagnosis: '',
    conditionAtDischarge: 'Improved & Hemodynamically Stable',
    dischargeSummary:
      'Patient was admitted with acute symptoms, evaluated thoroughly, and managed conservatively with IV medications, fluids, and supportive nursing care. Clinical parameters and vitals improved steadily. Discharged in stable condition with home medications.',
    dischargeAdvice:
      'Continue prescribed oral medications strictly on time. Take soft nutritious diet and adequate hydration. Review in OPD after 5 days or immediately in Emergency if fever/breathlessness recurs.',
    collectBalanceNow: true,
    paymentMode: 'UPI',
  })

  const loadIpd = useCallback(async () => {
    const res = await fetch('/api/ipd?show=all')
    if (res.ok) {
      const d = await res.json()
      setCategories(d.categories || [])
      setBeds(d.beds || [])
      setAdmissions(d.admissions || [])
    }
  }, [])

  useEffect(() => {
    loadIpd()
  }, [loadIpd])

  const freeBeds = beds.filter((b) => b.effectiveStatus === 'free')

  // Handle incoming "Admit to IPD" redirect from OPD Smart Rx Pad
  useEffect(() => {
    if (pendingAdmit) {
      setAdmitForm((prev) => ({
        ...prev,
        patientId: pendingAdmit.patientId,
        provisionalDiagnosis: pendingAdmit.diagnosis,
        bedId: freeBeds[0]?.id || '',
      }))
      setShowAdmitModal(true)
      onClearPendingAdmit?.()
    }
  }, [pendingAdmit, freeBeds, onClearPendingAdmit])

  // Search MedWiki for IPD MAR drug chart
  useEffect(() => {
    if (!selectedAdmissionId || chartTab !== 'mar') return
    const t = setTimeout(async () => {
      const res = await fetch(`/api/medicines?q=${encodeURIComponent(marSearch)}&limit=12`)
      if (res.ok) {
        const d = await res.json()
        setMarResults(d.medicines || [])
      }
    }, 90)
    return () => clearTimeout(t)
  }, [marSearch, selectedAdmissionId, chartTab])

  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId) || null

  async function postIpdAction(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch('/api/ipd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'IPD operation failed')
      return null
    }
    toast.success(successMsg)
    await loadIpd()
    onRefreshGlobal?.()
    return data
  }

  const occupiedCount = beds.filter((b) => b.effectiveStatus === 'occupied').length
  const visibleBeds =
    selectedWard === 'ALL' ? beds : beds.filter((b) => b.categoryId === selectedWard)
  const filteredAdmissions = admissions.filter((a) =>
    admFilter === 'current' ? a.dischargedAt === null : a.dischargedAt !== null
  )

  return (
    <div className="space-y-6">
      {/* Top IPD Summary Banner & Quick Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
              <BedDouble className="h-3.5 w-3.5" />
              ICTHospital-Grade Transactional IPD &amp; Live Ward Bed Board
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-slate-900">
              In-Patient Department (IPD) &amp; Ward Occupancy
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Single-bed &amp; single-patient transactional locking · Real-time room tariff accrual · Advance Deposits &amp; Discharge Summary
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddWard(true)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + New Ward
            </button>
            <button
              type="button"
              onClick={() => {
                setBedForm((f) => ({ ...f, categoryId: categories[0]?.id || '' }))
                setShowAddBed(true)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add Bed
            </button>
            <button
              type="button"
              onClick={() => {
                setAdmitForm((f) => ({
                  ...f,
                  patientId: patients[0]?.id || '',
                  bedId: freeBeds[0]?.id || '',
                  admittingDoctorId: doctors[0]?.id || '',
                }))
                setShowAdmitModal(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700"
            >
              <UserPlus className="h-4 w-4" /> Admit Patient to IPD
            </button>
          </div>
        </div>

        {/* Occupancy Metrics Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Total Hospital Beds</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{beds.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
            <p className="text-xs text-emerald-700 font-medium">Available Free Beds</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">{freeBeds.length}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5">
            <p className="text-xs text-rose-700 font-medium">Currently Admitted (IPD)</p>
            <p className="mt-1 text-2xl font-extrabold text-rose-700">{occupiedCount}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5">
            <p className="text-xs text-sky-700 font-medium">Occupancy Rate</p>
            <p className="mt-1 text-2xl font-extrabold text-sky-800">
              {beds.length ? Math.round((occupiedCount / beds.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* LIVE VISUAL WARD & BED BOARD */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedWard('ALL')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                selectedWard === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Wards ({beds.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedWard(cat.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  selectedWard === cat.id
                    ? 'bg-teal-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.name} · ₹{cat.dailyRate}/d
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Free (Click to Admit)
            </span>
            <span className="flex items-center gap-1 text-rose-700">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Occupied (Click for IPD Chart)
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Cleaning
            </span>
          </div>
        </div>

        {/* Bed Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visibleBeds.map((bed) => {
            const isOccupied = bed.effectiveStatus === 'occupied' && bed.occupant
            const isFree = bed.effectiveStatus === 'free'
            return (
              <div
                key={bed.id}
                onClick={() => {
                  if (isOccupied && bed.occupant) {
                    const adm = admissions.find((a) => a.id === bed.occupant!.admissionId)
                    setSelectedAdmissionId(bed.occupant.admissionId)
                    setChartTab('overview')
                    if (adm) {
                      setDischargeForm((df) => ({
                        ...df,
                        finalDiagnosis: adm.provisionalDiagnosis,
                      }))
                    }
                  } else if (isFree) {
                    setAdmitForm((f) => ({
                      ...f,
                      bedId: bed.id,
                      patientId: f.patientId || patients[0]?.id || '',
                      admittingDoctorId: f.admittingDoctorId || doctors[0]?.id || '',
                    }))
                    setShowAdmitModal(true)
                  }
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  isOccupied
                    ? 'border-rose-200 bg-rose-50/50 hover:border-rose-400 hover:shadow-md'
                    : isFree
                    ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:shadow-md'
                    : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-extrabold text-slate-900">
                    {bed.bedNumber}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      isOccupied
                        ? 'bg-rose-600 text-white'
                        : isFree
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {bed.effectiveStatus}
                  </span>
                </div>

                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {bed.category.name} · {bed.floor}
                </p>

                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                  {bed.hasOxygen && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1.5 py-0.5 border border-slate-200">
                      <Wind className="h-2.5 w-2.5 text-sky-600" /> O2
                    </span>
                  )}
                  {bed.hasMonitor && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1.5 py-0.5 border border-slate-200">
                      <Activity className="h-2.5 w-2.5 text-teal-600" /> Monitor
                    </span>
                  )}
                  {bed.hasVentilator && (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                      Ventilator
                    </span>
                  )}
                </div>

                {isOccupied && bed.occupant ? (
                  <div className="mt-3 border-t border-rose-200/70 pt-2.5 text-xs">
                    <p className="font-bold text-slate-900 truncate">
                      {bed.occupant.patientName}{' '}
                      <span className="font-normal text-slate-500">({bed.occupant.uhid})</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-rose-800 line-clamp-1 font-medium">
                      {bed.occupant.diagnosis}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {bed.occupant.doctorName} · Open IPD Chart →
                    </p>
                  </div>
                ) : isFree ? (
                  <div className="mt-3 border-t border-emerald-200/70 pt-2.5 flex items-center justify-between text-xs text-emerald-800 font-semibold">
                    <span>₹{bed.category.dailyRate}/day</span>
                    <span>+ Click to Admit</span>
                  </div>
                ) : (
                  <div className="mt-3 border-t border-amber-200/70 pt-2.5 flex items-center justify-between text-xs">
                    <span className="text-amber-800">Sanitizing</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        postIpdAction(
                          { action: 'updateBedStatus', bedId: bed.id, status: 'free' },
                          `Bed ${bed.bedNumber} marked clean & free!`
                        )
                      }}
                      className="rounded-lg bg-white px-2 py-0.5 font-bold text-emerald-700 border border-emerald-300"
                    >
                      Mark Ready
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ADMISSIONS REGISTER TABLE */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-slate-900">IPD Admissions Register</h3>
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAdmFilter('current')}
              className={`rounded-lg px-3.5 py-1.5 font-bold ${
                admFilter === 'current' ? 'bg-teal-600 text-white' : 'text-slate-600'
              }`}
            >
              Currently Admitted ({admissions.filter((a) => !a.dischargedAt).length})
            </button>
            <button
              type="button"
              onClick={() => setAdmFilter('discharged')}
              className={`rounded-lg px-3.5 py-1.5 font-bold ${
                admFilter === 'discharged' ? 'bg-slate-800 text-white' : 'text-slate-600'
              }`}
            >
              Discharged History ({admissions.filter((a) => a.dischargedAt).length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-3">IPD No</th>
                <th className="py-3 px-3">Patient</th>
                <th className="py-3 px-3">Ward / Bed</th>
                <th className="py-3 px-3">Diagnosis &amp; Doctor</th>
                <th className="py-3 px-3">Stay</th>
                <th className="py-3 px-3">Running Bill</th>
                <th className="py-3 px-3">Deposits Paid</th>
                <th className="py-3 px-3">Net Payable</th>
                <th className="py-3 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmissions.map((adm) => (
                <tr key={adm.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-mono font-bold text-teal-700">{adm.admissionNo}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{adm.patient.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {adm.patient.uhid} · {adm.patient.ageYears ?? '—'}y/{adm.patient.gender[0]}
                    </p>
                  </td>
                  <td className="py-3 px-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-800">
                      {adm.bed.bedNumber}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{adm.bed.category.name}</p>
                  </td>
                  <td className="py-3 px-3 max-w-[230px]">
                    <p className="font-medium text-slate-800 truncate">
                      {adm.finalDiagnosis || adm.provisionalDiagnosis}
                    </p>
                    <p className="text-[11px] text-slate-500">{adm.admittingDoctor.name}</p>
                  </td>
                  <td className="py-3 px-3 font-semibold">{adm.financials.stayDays} day(s)</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    ₹{adm.financials.grossTotal.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 font-semibold text-emerald-700">
                    ₹{adm.financials.depositsPaidTotal.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 font-bold text-rose-700">
                    ₹{adm.financials.netPayable.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3">
                    {adm.dischargedAt ? (
                      <button
                        type="button"
                        onClick={() => setPrintableDischarge(adm)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="h-3.5 w-3.5" /> Discharge Summary
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAdmissionId(adm.id)
                          setChartTab('overview')
                          setDischargeForm((df) => ({
                            ...df,
                            finalDiagnosis: adm.provisionalDiagnosis,
                          }))
                        }}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 font-bold text-white hover:bg-teal-700"
                      >
                        Open IPD Chart →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================
          MODAL: FULL 5-TAB IPD PATIENT CLINICAL & BILLING CHART
      ======================================================================== */}
      {selectedAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6 overflow-y-auto">
          <div className="my-auto w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-teal-500 px-2 py-0.5 font-mono text-xs font-bold">
                    {selectedAdmission.admissionNo}
                  </span>
                  <span className="rounded bg-rose-500/90 px-2 py-0.5 font-mono text-xs font-bold">
                    Bed {selectedAdmission.bed.bedNumber} ({selectedAdmission.bed.category.name})
                  </span>
                  <span className="text-xs text-slate-300">
                    Day {selectedAdmission.financials.stayDays} · Admitted{' '}
                    {new Date(selectedAdmission.admittedAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <h3 className="mt-1.5 text-lg font-extrabold">
                  {selectedAdmission.patient.name}{' '}
                  <span className="text-sm font-normal text-slate-300">
                    ({selectedAdmission.patient.uhid} · {selectedAdmission.patient.ageYears ?? '—'}y/
                    {selectedAdmission.patient.gender} · {selectedAdmission.admittingDoctor.name})
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAdmissionId(null)}
                className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold">
              {(
                [
                  { id: 'overview', label: '1. Overview & Bed Transfer', icon: BedDouble },
                  {
                    id: 'rounds',
                    label: `2. Doctor & Nurse Rounds (${selectedAdmission.roundNotes.length})`,
                    icon: ClipboardList,
                  },
                  {
                    id: 'mar',
                    label: `3. IPD Drug Chart / MAR (${selectedAdmission.medicationOrders.length})`,
                    icon: Pill,
                  },
                  {
                    id: 'billing',
                    label: `4. Running Bill & Deposits (₹${selectedAdmission.financials.netPayable.toLocaleString('en-IN')} due)`,
                    icon: Receipt,
                  },
                  { id: 'discharge', label: '5. Discharge Summary & Final Bill', icon: FileCheck2 },
                ] as const
              ).map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChartTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
                      chartTab === t.id
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Chart Body */}
            <div className="p-6 max-h-[72vh] overflow-y-auto">
              {/* SUB-TAB 1: OVERVIEW & WARD TRANSFER */}
              {chartTab === 'overview' && (
                <div className="grid gap-6 lg:grid-cols-2 text-sm">
                  <div className="space-y-3">
                    {selectedAdmission.allergiesSnapshot && (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        Known Allergies: {selectedAdmission.allergiesSnapshot}
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                      <p>
                        <strong className="text-slate-700">Provisional Diagnosis:</strong>{' '}
                        <span className="text-slate-900 font-semibold">
                          {selectedAdmission.provisionalDiagnosis}
                        </span>
                      </p>
                      {selectedAdmission.chiefComplaints && (
                        <p>
                          <strong className="text-slate-700">Presenting Complaints:</strong>{' '}
                          {selectedAdmission.chiefComplaints}
                        </p>
                      )}
                      <p>
                        <strong className="text-slate-700">Attendant / Guardian:</strong>{' '}
                        {selectedAdmission.attendantName || '—'}{' '}
                        {selectedAdmission.attendantPhone
                          ? `(${selectedAdmission.attendantPhone})`
                          : ''}
                      </p>
                      <p>
                        <strong className="text-slate-700">Insurance / TPA:</strong>{' '}
                        {selectedAdmission.insuranceTpa || 'Self-Pay / Cashless N/A'}{' '}
                        {selectedAdmission.preAuthAmount > 0
                          ? `· Pre-Auth ₹${selectedAdmission.preAuthAmount.toLocaleString('en-IN')}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {/* Bed Transfer Box */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ArrowRightLeft className="h-4 w-4 text-teal-600" />
                      Shift / Transfer Patient to Another Ward Bed
                    </h4>
                    <div className="mt-3 space-y-3 text-xs">
                      <select
                        value={transferBedId}
                        onChange={(e) => setTransferBedId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="">Select destination free bed...</option>
                        {freeBeds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bedNumber} — {b.category.name} (₹{b.category.dailyRate}/day)
                          </option>
                        ))}
                      </select>
                      <input
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        placeholder="Reason (e.g. ICU step-down to Private Deluxe)"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                      <button
                        type="button"
                        disabled={!transferBedId}
                        onClick={async () => {
                          await postIpdAction(
                            {
                              action: 'transferBed',
                              ipdAdmissionId: selectedAdmission.id,
                              toBedId: transferBedId,
                              reason: transferReason,
                            },
                            'Patient transferred to new bed cleanly!'
                          )
                          setTransferBedId('')
                        }}
                        className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-40"
                      >
                        Confirm Bed Transfer
                      </button>

                      {selectedAdmission.bedTransfers.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-600">
                          <p className="font-semibold">Transfer History:</p>
                          {selectedAdmission.bedTransfers.map((tr) => (
                            <p key={tr.id}>
                              {tr.fromBed.bedNumber} → <strong>{tr.toBed.bedNumber}</strong> (
                              {tr.reason})
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: DOCTOR ROUNDS & NURSING HANDOVER NOTES */}
              {chartTab === 'rounds' && (
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm">Add Progress Round / Nursing Note</h4>
                    <select
                      value={roundForm.noteType}
                      onChange={(e) => setRoundForm({ ...roundForm, noteType: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    >
                      <option>Doctor Round</option>
                      <option>ICU Chart</option>
                      <option>Nursing Handover</option>
                      <option>Surgery / Procedure Note</option>
                    </select>
                    <input
                      value={roundForm.vitalsText}
                      onChange={(e) => setRoundForm({ ...roundForm, vitalsText: e.target.value })}
                      placeholder="Vitals snapshot..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
                    />
                    <textarea
                      rows={3}
                      value={roundForm.observations}
                      onChange={(e) => setRoundForm({ ...roundForm, observations: e.target.value })}
                      placeholder="Clinical findings / SOAP observations..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    />
                    <input
                      value={roundForm.plan}
                      onChange={(e) => setRoundForm({ ...roundForm, plan: e.target.value })}
                      placeholder="Updated treatment plan / nursing instructions..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!roundForm.observations.trim()) {
                          toast.error('Enter clinical observations')
                          return
                        }
                        await postIpdAction(
                          {
                            action: 'addRoundNote',
                            ipdAdmissionId: selectedAdmission.id,
                            ...roundForm,
                          },
                          'Round note logged!'
                        )
                        setRoundForm((f) => ({ ...f, observations: '', plan: '' }))
                      }}
                      className="w-full rounded-xl bg-teal-600 py-2.5 font-bold text-white hover:bg-teal-700"
                    >
                      Save Clinical Note
                    </button>
                  </div>

                  <div className="lg:col-span-7 space-y-3">
                    {selectedAdmission.roundNotes.map((rn) => (
                      <div key={rn.id} className="rounded-xl border border-slate-200 p-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-bold text-teal-800">
                            {rn.noteType} · {rn.authorName}
                          </span>
                          <span className="text-slate-400">
                            {new Date(rn.recordedAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {rn.vitalsText && (
                          <p className="mt-2 rounded bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700">
                            {rn.vitalsText}
                          </p>
                        )}
                        <p className="mt-2 text-slate-800 leading-relaxed">{rn.observations}</p>
                        {rn.plan && (
                          <p className="mt-1.5 text-teal-800 font-medium">
                            <strong>Plan:</strong> {rn.plan}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: IPD MEDICATION ADMINISTRATION RECORD (MAR) */}
              {chartTab === 'mar' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4">
                    <label className="block text-xs font-bold text-teal-900 mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                      Order IV / Oral Medication from Live MedWiki Catalog
                    </label>
                    <div className="relative">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        value={marSearch}
                        onChange={(e) => setMarSearch(e.target.value)}
                        placeholder="Search Injections, IV Fluids, Antibiotics (e.g. Monocef, Tazact, Pantocid, RL, Kabimol)..."
                        className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs"
                      />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {marResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            postIpdAction(
                              {
                                action: 'addMedication',
                                ipdAdmissionId: selectedAdmission.id,
                                medicineId: m.id,
                                medicineName: m.name,
                                genericName: m.composition || m.genericName,
                                strength: m.strength,
                                dosageForm: m.dosageForm,
                                dosage: m.defaultDosage,
                                route: m.defaultRoute,
                                frequency: m.defaultFrequency,
                                duration: '5 days',
                                unitPrice: m.mrp || 65,
                              },
                              `Ordered ${m.name} on IPD MAR!`
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs hover:border-teal-500"
                        >
                          <span className="font-bold text-slate-900">+ {m.name}</span>{' '}
                          <span className="text-slate-500">
                            ({m.defaultRoute} · {m.defaultFrequency}
                            {m.mrp ? ` · ₹${m.mrp}` : ''})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Drug &amp; Salt</th>
                          <th className="py-2.5 px-3">Route &amp; Dose</th>
                          <th className="py-2.5 px-3">Schedule</th>
                          <th className="py-2.5 px-3">Doses Given</th>
                          <th className="py-2.5 px-3">Unit Rate</th>
                          <th className="py-2.5 px-3">Nurse Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedAdmission.medicationOrders.map((mo) => (
                          <tr key={mo.id}>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-900">{mo.medicineName}</p>
                              <p className="text-[11px] text-slate-500">{mo.genericName}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="rounded bg-sky-50 px-2 py-0.5 font-bold text-sky-800">
                                {mo.route}
                              </span>{' '}
                              {mo.dosage}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">{mo.frequency}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700">
                              {mo.dosesGiven} dose(s)
                            </td>
                            <td className="py-2.5 px-3">₹{mo.unitPrice}</td>
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() =>
                                  postIpdAction(
                                    { action: 'giveDose', orderId: mo.id },
                                    `Recorded dose given for ${mo.medicineName}`
                                  )
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white hover:bg-emerald-700"
                              >
                                + Administer Dose
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: RUNNING IPD BILL & ADVANCE DEPOSITS */}
              {chartTab === 'billing' && (
                <div className="grid gap-6 lg:grid-cols-12 text-xs">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                      <h4 className="font-bold text-sm text-slate-900">
                        Live Running IPD Ledger ({selectedAdmission.financials.stayDays} Day Stay)
                      </h4>
                      <div className="divide-y divide-slate-100 pt-2">
                        <div className="flex justify-between py-2">
                          <span>
                            Room Rent ({selectedAdmission.bed.category.name} ·{' '}
                            {selectedAdmission.financials.stayDays}d × ₹
                            {selectedAdmission.financials.dailyRoomRate})
                          </span>
                          <strong>
                            ₹{selectedAdmission.financials.roomChargesTotal.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span>
                            Nursing &amp; Doctor Rounds ({selectedAdmission.financials.stayDays}d × ₹
                            {selectedAdmission.financials.dailyNursingRate})
                          </span>
                          <strong>
                            ₹
                            {selectedAdmission.financials.nursingChargesTotal.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span>IPD MAR Medications ({selectedAdmission.medicationOrders.length})</span>
                          <strong>
                            ₹
                            {selectedAdmission.financials.medicationChargesTotal.toLocaleString(
                              'en-IN'
                            )}
                          </strong>
                        </div>
                        {selectedAdmission.chargeItems.map((c) => (
                          <div key={c.id} className="flex justify-between py-2 text-slate-700">
                            <span>
                              [{c.category}] {c.description} ({c.quantity} × ₹{c.unitRate})
                            </span>
                            <strong>₹{c.amount.toLocaleString('en-IN')}</strong>
                          </div>
                        ))}
                        <div className="flex justify-between py-2.5 text-sm font-extrabold text-slate-900">
                          <span>Gross Running Total</span>
                          <span>
                            ₹{selectedAdmission.financials.grossTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 text-emerald-700 font-bold">
                          <span>Less: Advance Deposits Received ({selectedAdmission.deposits.length})</span>
                          <span>
                            − ₹
                            {selectedAdmission.financials.depositsPaidTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between py-2.5 text-base font-extrabold text-rose-700">
                          <span>Current Net Balance Due</span>
                          <span>
                            ₹{selectedAdmission.financials.netPayable.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deposit Receipts History */}
                    <div className="rounded-xl border border-slate-200 p-4">
                      <h5 className="font-bold text-slate-800 mb-2">Advance Deposit Receipts</h5>
                      <div className="space-y-1.5">
                        {selectedAdmission.deposits.map((dep) => (
                          <div
                            key={dep.id}
                            className="flex items-center justify-between rounded-lg bg-emerald-50/70 px-3 py-2 border border-emerald-100"
                          >
                            <span>
                              <strong className="font-mono">{dep.receiptNo}</strong> · {dep.paymentMode}{' '}
                              ({new Date(dep.depositedAt).toLocaleDateString('en-IN')})
                            </span>
                            <strong className="text-emerald-800">
                              ₹{dep.amount.toLocaleString('en-IN')}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Add Charge + Collect Deposit */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                      <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Plus className="h-4 w-4 text-teal-600" /> Add Procedure / OT / Lab Charge
                      </h5>
                      <select
                        value={chargeForm.category}
                        onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                      >
                        <option>Procedure</option>
                        <option>OT/Surgery</option>
                        <option>Oxygen/Ventilator</option>
                        <option>Lab</option>
                        <option>Consumables</option>
                        <option>Specialist Visit</option>
                      </select>
                      <input
                        value={chargeForm.description}
                        onChange={(e) =>
                          setChargeForm({ ...chargeForm, description: e.target.value })
                        }
                        placeholder="e.g. Minor Dressing / Portable X-Ray / Nebulization"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={chargeForm.quantity}
                          onChange={(e) =>
                            setChargeForm({ ...chargeForm, quantity: e.target.value })
                          }
                          placeholder="Qty"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                        />
                        <input
                          type="number"
                          value={chargeForm.unitRate}
                          onChange={(e) =>
                            setChargeForm({ ...chargeForm, unitRate: e.target.value })
                          }
                          placeholder="Rate (₹)"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!chargeForm.description.trim()) return
                          await postIpdAction(
                            {
                              action: 'addCharge',
                              ipdAdmissionId: selectedAdmission.id,
                              ...chargeForm,
                            },
                            'Added charge to IPD running bill!'
                          )
                          setChargeForm((f) => ({ ...f, description: '' }))
                        }}
                        className="w-full rounded-lg bg-slate-900 py-2 font-bold text-white"
                      >
                        Add Charge to Bill
                      </button>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2.5">
                      <h5 className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-emerald-600" /> Collect Advance Deposit
                      </h5>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={depositForm.amount}
                          onChange={(e) =>
                            setDepositForm({ ...depositForm, amount: e.target.value })
                          }
                          placeholder="Amount (₹)"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold"
                        />
                        <select
                          value={depositForm.paymentMode}
                          onChange={(e) =>
                            setDepositForm({ ...depositForm, paymentMode: e.target.value })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                        >
                          <option>UPI</option>
                          <option>Cash</option>
                          <option>Card</option>
                          <option>Bank Transfer</option>
                        </select>
                      </div>
                      <input
                        value={depositForm.referenceNo}
                        onChange={(e) =>
                          setDepositForm({ ...depositForm, referenceNo: e.target.value })
                        }
                        placeholder="UTR / Reference No (Optional)"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          postIpdAction(
                            {
                              action: 'addDeposit',
                              ipdAdmissionId: selectedAdmission.id,
                              ...depositForm,
                            },
                            `Collected ₹${depositForm.amount} Advance Deposit!`
                          )
                        }
                        className="w-full rounded-lg bg-emerald-600 py-2 font-bold text-white hover:bg-emerald-700"
                      >
                        Generate Deposit Receipt (DEP)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 5: DISCHARGE SUMMARY & ATOMIC BED RELEASE */}
              {chartTab === 'discharge' && (
                <div className="space-y-4 text-xs">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Final Diagnosis *</label>
                      <input
                        value={dischargeForm.finalDiagnosis}
                        onChange={(e) =>
                          setDischargeForm({ ...dischargeForm, finalDiagnosis: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Condition at Discharge</label>
                      <select
                        value={dischargeForm.conditionAtDischarge}
                        onChange={(e) =>
                          setDischargeForm({
                            ...dischargeForm,
                            conditionAtDischarge: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option>Improved &amp; Hemodynamically Stable</option>
                        <option>Completely Recovered</option>
                        <option>Referred to Higher Center</option>
                        <option>Discharged Against Medical Advice (LAMA)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Course in Hospital &amp; Treatment Summary
                    </label>
                    <textarea
                      rows={3}
                      value={dischargeForm.dischargeSummary}
                      onChange={(e) =>
                        setDischargeForm({ ...dischargeForm, dischargeSummary: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Post-Discharge Home Advice &amp; Follow-Up
                    </label>
                    <textarea
                      rows={2}
                      value={dischargeForm.dischargeAdvice}
                      onChange={(e) =>
                        setDischargeForm({ ...dischargeForm, dischargeAdvice: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">
                        Final Settlement Due: ₹
                        {selectedAdmission.financials.netPayable.toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-slate-600">
                          (Gross ₹{selectedAdmission.financials.grossTotal.toLocaleString('en-IN')} −
                          Deposits ₹
                          {selectedAdmission.financials.depositsPaidTotal.toLocaleString('en-IN')})
                        </span>
                      </p>
                      <label className="mt-1.5 inline-flex items-center gap-2 font-semibold text-teal-900">
                        <input
                          type="checkbox"
                          checked={dischargeForm.collectBalanceNow}
                          onChange={(e) =>
                            setDischargeForm({
                              ...dischargeForm,
                              collectBalanceNow: e.target.checked,
                            })
                          }
                        />
                        Collect remaining balance now &amp; mark Final IPD Invoice PAID
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        const res = await postIpdAction(
                          {
                            action: 'discharge',
                            ipdAdmissionId: selectedAdmission.id,
                            ...dischargeForm,
                          },
                          `Discharged ${selectedAdmission.patient.name} & freed Bed ${selectedAdmission.bed.bedNumber}!`
                        )
                        if (res) {
                          setSelectedAdmissionId(null)
                          setAdmFilter('discharged')
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-700"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Complete Discharge &amp; Free Bed
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIT PATIENT TO IPD */}
      {showAdmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">New IPD Patient Admission</h3>
              <button type="button" onClick={() => setShowAdmitModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {freeBeds.length === 0 ? (
              <div className="py-8 text-center text-sm text-rose-700">
                No free beds available! Add a new bed or discharge an existing patient first.
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const ok = await postIpdAction(
                    { action: 'admit', ...admitForm },
                    'Patient admitted & bed marked occupied!'
                  )
                  if (ok) setShowAdmitModal(false)
                }}
                className="mt-4 grid grid-cols-2 gap-3 text-xs"
              >
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Select Patient *</label>
                  <select
                    required
                    value={admitForm.patientId}
                    onChange={(e) => setAdmitForm({ ...admitForm, patientId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.uhid}) · {p.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Allocate Free Bed *</label>
                  <select
                    required
                    value={admitForm.bedId}
                    onChange={(e) => setAdmitForm({ ...admitForm, bedId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                  >
                    {freeBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bedNumber} — {b.category.name} (₹{b.category.dailyRate}/d)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Admitting Consultant</label>
                  <select
                    value={admitForm.admittingDoctorId}
                    onChange={(e) =>
                      setAdmitForm({ ...admitForm, admittingDoctorId: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Provisional Diagnosis *
                  </label>
                  <input
                    required
                    value={admitForm.provisionalDiagnosis}
                    onChange={(e) =>
                      setAdmitForm({ ...admitForm, provisionalDiagnosis: e.target.value })
                    }
                    placeholder="e.g. Acute Dengue Fever with Thrombocytopenia / Pneumonia"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Attendant Name</label>
                  <input
                    value={admitForm.attendantName}
                    onChange={(e) => setAdmitForm({ ...admitForm, attendantName: e.target.value })}
                    placeholder="Relative accompanying patient"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Attendant Mobile</label>
                  <input
                    value={admitForm.attendantPhone}
                    onChange={(e) => setAdmitForm({ ...admitForm, attendantPhone: e.target.value })}
                    placeholder="98XXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 mb-1">
                    Initial Advance Deposit (₹)
                  </label>
                  <input
                    type="number"
                    value={admitForm.initialDeposit}
                    onChange={(e) =>
                      setAdmitForm({ ...admitForm, initialDeposit: e.target.value })
                    }
                    className="w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deposit Payment Mode</label>
                  <select
                    value={admitForm.depositMode}
                    onChange={(e) => setAdmitForm({ ...admitForm, depositMode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option>UPI</option>
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Insurance Pre-Auth</option>
                  </select>
                </div>

                <div className="col-span-2 flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdmitModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-teal-600 px-5 py-2.5 font-bold text-white hover:bg-teal-700"
                  >
                    Confirm Admission &amp; Lock Bed
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW WARD */}
      {showAddWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Create IPD Ward / Bed Category</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const ok = await postIpdAction(
                  { action: 'createWard', ...wardForm },
                  `Ward "${wardForm.name}" created!`
                )
                if (ok) setShowAddWard(false)
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <input
                required
                placeholder="Ward Name (e.g. Pediatric NICU / Surgical Ward)"
                value={wardForm.name}
                onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="Code (e.g. NICU)"
                  value={wardForm.code}
                  onChange={(e) => setWardForm({ ...wardForm, code: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  placeholder="Floor (e.g. 3rd Floor)"
                  value={wardForm.floor}
                  onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Daily Room Rate (₹)"
                  value={wardForm.dailyRate}
                  onChange={(e) => setWardForm({ ...wardForm, dailyRate: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Daily Nursing Fee (₹)"
                  value={wardForm.nursingChargeDay}
                  onChange={(e) => setWardForm({ ...wardForm, nursingChargeDay: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWard(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white">
                  Save Ward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW BED */}
      {showAddBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Add New IPD Bed</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const ok = await postIpdAction(
                  { action: 'createBed', ...bedForm },
                  `Bed ${bedForm.bedNumber} added!`
                )
                if (ok) setShowAddBed(false)
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <select
                required
                value={bedForm.categoryId}
                onChange={(e) => setBedForm({ ...bedForm, categoryId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (₹{c.dailyRate}/day)
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Bed Number (e.g. ICU-05 or GEN-106)"
                value={bedForm.bedNumber}
                onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={bedForm.hasOxygen}
                    onChange={(e) => setBedForm({ ...bedForm, hasOxygen: e.target.checked })}
                  />
                  Oxygen Line
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={bedForm.hasMonitor}
                    onChange={(e) => setBedForm({ ...bedForm, hasMonitor: e.target.checked })}
                  />
                  Monitor
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={bedForm.hasVentilator}
                    onChange={(e) => setBedForm({ ...bedForm, hasVentilator: e.target.checked })}
                  />
                  Ventilator
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBed(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white">
                  Add Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE NABH-STYLE DISCHARGE SUMMARY MODAL */}
      {printableDischarge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl print-sheet text-xs">
            <div className="no-print mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-bold uppercase text-teal-700">IPD Discharge Summary</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 font-bold text-white"
                >
                  <Printer className="h-4 w-4" /> Print Summary
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableDischarge(null)}
                  className="rounded-xl border border-slate-200 p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b-2 border-teal-700 pb-4 flex justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-teal-800">
                  {settings?.clinicDisplayName || 'Hospital & Medical Center'}
                </h2>
                <p className="text-slate-600">{settings?.address}</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-slate-900 px-2.5 py-1 text-white font-bold uppercase">
                  IPD Discharge Summary
                </span>
                <p className="mt-1 font-mono font-bold">{printableDischarge.admissionNo}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div>
                <strong>Patient:</strong> {printableDischarge.patient.name} (
                {printableDischarge.patient.uhid})
              </div>
              <div>
                <strong>Ward / Bed:</strong> {printableDischarge.bed.category.name} (
                {printableDischarge.bed.bedNumber})
              </div>
              <div>
                <strong>Admitted On:</strong>{' '}
                {new Date(printableDischarge.admittedAt).toLocaleString('en-IN')}
              </div>
              <div>
                <strong>Discharged On:</strong>{' '}
                {printableDischarge.dischargedAt
                  ? new Date(printableDischarge.dischargedAt).toLocaleString('en-IN')
                  : '—'}
              </div>
              <div>
                <strong>Consultant:</strong> {printableDischarge.admittingDoctor.name}
              </div>
              <div>
                <strong>Condition:</strong> {printableDischarge.conditionAtDischarge}
              </div>
            </div>

            <div className="mt-4 space-y-3 leading-relaxed">
              <div>
                <strong className="text-slate-900">Final Diagnosis:</strong>
                <p className="mt-0.5 text-sm font-bold text-teal-900">
                  {printableDischarge.finalDiagnosis || printableDischarge.provisionalDiagnosis}
                </p>
              </div>
              <div>
                <strong className="text-slate-900">Hospital Course &amp; Treatment Given:</strong>
                <p className="mt-0.5">{printableDischarge.dischargeSummary}</p>
              </div>
              {printableDischarge.dischargeAdvice && (
                <div>
                  <strong className="text-slate-900">Discharge Instructions &amp; Follow-Up:</strong>
                  <p className="mt-0.5">{printableDischarge.dischargeAdvice}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
