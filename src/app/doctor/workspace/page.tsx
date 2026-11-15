'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Stethoscope,
  BedDouble,
  FileText,
  Plus,
  Save,
  LogOut,
  ArrowRight,
  ChevronRight,
  Sun,
  Moon,
  Search,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { AppointmentCalendar } from '@/components/doctor/AppointmentCalendar'

interface DoctorSession {
  userId: string
  name: string
  email: string
  role: string
  organizationId: string
  organizationName: string
  specialization?: string | null
}

interface Patient {
  id: string
  uhid: string
  name: string
  phone: string
  gender: string
  ageYears?: number | null
  bloodGroup?: string | null
  allergies?: string | null
  chronicConditions?: string | null
}

interface DoctorTab {
  id: 'appointments' | 'eprescribe' | 'ipd' | 'bedboard'
  label: string
  icon: React.ReactNode
}

const DOCTOR_TABS: DoctorTab[] = [
  { id: 'appointments', label: 'Appointments', icon: <Calendar className="h-3 w-3" /> },
  { id: 'eprescribe', label: 'E-Prescribe', icon: <FileText className="h-3 w-3" /> },
  { id: 'ipd', label: 'IPD Admissions', icon: <BedDouble className="h-3 w-3" /> },
  { id: 'bedboard', label: 'Ward Bed Board', icon: <AlertCircle className="h-3 w-3" /> },
]

export default function DoctorWorkspacePage() {
  const router = useRouter()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [session, setSession] = useState<DoctorSession | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'appointments' | 'eprescribe' | 'ipd' | 'bedboard'>('appointments')
  const [loading, setLoading] = useState(true)
  const [showPrescribe, setShowPrescribe] = useState(false)
  const [newRx, setNewRx] = useState<{ patientId: string; diagnosis: string; items: any[] } | null>(null)

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('hms_tenant_session='))
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const payload = JSON.parse(Buffer.from(token.split('=')[1], 'base64').toString('utf8'))
      if (payload.kind !== 'tenant') {
        router.push('/login')
        return
      }
      setSession({
        userId: payload.userId,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        specialization: payload.specialization || undefined,
      })
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!session) return
    ;(async () => {
      try {
        const res = await fetch(`/api/patients?organizationId=${session.organizationId}&limit=50`)
        const data = await res.json()
        setPatients(data.patients || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    })()
  }, [session])

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.uhid.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
  )

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/login')
  }

  async function createPrescription() {
    if (!newRx) return
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: session!.organizationId,
          patientId: newRx.patientId,
          doctorId: session!.userId,
          diagnosis: newRx.diagnosis,
          items: newRx.items,
        }),
      })
      if (res.ok) {
        setShowPrescribe(false)
        setNewRx(null)
        alert('Prescription created successfully!')
      }
    } catch {
      alert('Failed to create prescription')
    }
  }

  if (!session) return null

  return (
    <div className={`min-h-screen flex flex-col ${resolvedTheme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shrink-0">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">Doctor Workspace</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {session.specialization} · {session.organizationName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle theme"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-600" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Welcome back, Dr. {session.name.split(' ')[0]}!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage your appointments, e-prescribe, and oversee IPD admissions from here.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-700">
          {DOCTOR_TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-500 dark:border-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Appointments Tab */}
          {activeTab === 'appointments' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Appointment Calendar
                </h3>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition flex items-center gap-1.5"
                >
                  <Plus className="h-3 w-3" /> New Booking
                </button>
              </div>
              <AppointmentCalendar
                organizationId={session.organizationId}
                doctorId={session.userId}
              />
            </div>
          )}

          {/* E-Prescribe Tab */}
          {activeTab === 'eprescribe' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> E-Prescribe
              </h3>

              {!showPrescribe ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPatients.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setNewRx({ patientId: p.id, diagnosis: '', items: [] })
                        setShowPrescribe(true)
                      }}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                          {p.uhid}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {p.ageYears}Y · {p.gender}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.phone}</p>
                      {p.allergies && (
                        <div className="mt-2 rounded bg-rose-50 dark:bg-rose-900/20 px-2 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                          ⚠ {p.allergies}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : newRx ? (
                <div className="max-w-xl">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => setShowPrescribe(false)}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <ArrowRight className="h-3 w-3" /> Back to patient list
                    </button>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      New Prescription
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        Diagnosis
                      </label>
                      <textarea
                        value={newRx.diagnosis}
                        onChange={(e) => setNewRx({ ...newRx, diagnosis: e.target.value })}
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. Acute bronchitis, mild hypertension..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        Medicines (type & press Enter)
                      </label>
                      <div className="space-y-2">
                        {newRx.items.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              value={item.name || ''}
                              onChange={(e) => {
                                const items = [...newRx.items]
                                items[i] = { ...items[i], name: e.target.value }
                                setNewRx({ ...newRx, items })
                              }}
                              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Medicine name"
                            />
                            <input
                              value={item.dosage || ''}
                              onChange={(e) => {
                                const items = [...newRx.items]
                                items[i] = { ...items[i], dosage: e.target.value }
                                setNewRx({ ...newRx, items })
                              }}
                              className="w-24 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="1 tablet"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const items = [...newRx.items]
                                items.splice(i, 1)
                                setNewRx({ ...newRx, items })
                              }}
                              className="rounded-lg p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setNewRx({ ...newRx, items: [...newRx.items, { name: '', dosage: '', frequency: '', duration: '' }] })
                          }
                          className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="h-3 w-3" /> Add medicine
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={createPrescription}
                        disabled={!newRx.diagnosis.trim() || newRx.items.some((i) => !i.name.trim())}
                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="h-4 w-4 mr-2" /> Save Prescription
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPrescribe(false)}
                        className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* IPD Tab */}
          {activeTab === 'ipd' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-rose-600 dark:text-rose-400" /> IPD Admissions
              </h3>
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  IPD admission management coming in the next build.
                </p>
              </div>
            </div>
          )}

          {/* Bed Board Tab */}
          {activeTab === 'bedboard' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Ward Bed Board
              </h3>
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  Live ward bed board coming in the next build.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
