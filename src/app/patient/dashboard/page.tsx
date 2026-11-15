'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  BedDouble,
  FileText,
  CreditCard,
  Calendar,
  HeartPulse,
  LogOut,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

interface PatientSection {
  id: 'profile' | 'prescriptions' | 'laborders' | 'ipdadmissions' | 'appointments' | 'invoices'
  label: string
  icon: React.ReactNode
}

interface PatientSession {
  patientId: string
  uhid: string
  name: string
  phone: string
  organizationId: string
  organizationName: string
}

const PATIENT_SECTIONS: PatientSection[] = [
  { id: 'profile', label: 'Profile', icon: <HeartPulse className="h-3 w-3" /> },
  { id: 'prescriptions', label: 'Prescriptions', icon: <FileText className="h-3 w-3" /> },
  { id: 'laborders', label: 'Lab Reports', icon: <FileText className="h-3 w-3" /> },
  { id: 'ipdadmissions', label: 'IPD Admissions', icon: <BedDouble className="h-3 w-3" /> },
  { id: 'appointments', label: 'Appointments', icon: <Calendar className="h-3 w-3" /> },
  { id: 'invoices', label: 'Bills', icon: <CreditCard className="h-3 w-3" /> },
]

export default function PatientDashboardPage() {
  const router = useRouter()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [session, setSession] = useState<PatientSession | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [labOrders, setLabOrders] = useState<any[]>([])
  const [admissions, setAdmissions] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'profile' | 'prescriptions' | 'laborders' | 'ipdadmissions' | 'appointments' | 'invoices'>('profile')

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('hms_patient_session='))
    if (!token) {
      router.push('/patient/login')
      return
    }
    try {
      const payload = JSON.parse(Buffer.from(token.split('=')[1], 'base64').toString('utf8'))
      setSession({
        patientId: payload.patientId,
        uhid: payload.uhid,
        name: payload.name,
        phone: payload.phone,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
      })
    } catch {
      router.push('/patient/login')
    }
  }, [router])

  async function fetchSection(section: typeof activeSection) {
    try {
      const res = await fetch(`/api/patient/records?section=${section}`)
      const data = await res.json()
      if (section === 'profile') setProfile(data.patient)
      if (section === 'prescriptions') setPrescriptions(data.prescriptions || [])
      if (section === 'laborders') setLabOrders(data.labOrders || [])
      if (section === 'ipdadmissions') setAdmissions(data.admissions || [])
      if (section === 'appointments') setAppointments(data.appointments || [])
      if (section === 'invoices') setInvoices(data.invoices || [])
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (!session) return
    fetchSection('profile')
    fetchSection('prescriptions')
    fetchSection('laborders')
    fetchSection('ipdadmissions')
    fetchSection('appointments')
    fetchSection('invoices')
    setLoading(false)
  }, [session])

  async function handleLogout() {
    await fetch('/api/patient/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/patient/login')
  }

  if (!session) return null

  return (
    <div className={`min-h-screen flex flex-col ${resolvedTheme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white shrink-0">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">Patient Portal</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {session.organizationName} · UHID: {session.uhid}
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
        {/* Welcome Banner */}
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-gradient-to-r from-teal-50 to-emerald-50/50 p-6 dark:from-slate-900/50 dark:to-emerald-900/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome back, {session.name.split(' ')[0]}!</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Here&rsquo;s a summary of your health records at {session.organizationName}.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-bold text-teal-700 dark:text-teal-400">{profile?.uhid || session.uhid}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your Health ID</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prescriptions</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{prescriptions.length}</p>
              </div>
              <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 p-3">
                <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lab Reports</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{labOrders.length}</p>
              </div>
              <div className="rounded-lg bg-sky-50 dark:bg-sky-900/20 p-3">
                <FileText className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">IPD Admissions</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{admissions.length}</p>
              </div>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-3">
                <BedDouble className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Appointments</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{appointments.length}</p>
              </div>
              <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 p-3">
                <Calendar className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
          </div>
        ) : (
          <>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2">
            {PATIENT_SECTIONS.map((section) => {
              const active = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(section.id)
                    fetchSection(section.id)
                  }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                    active
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeSection === 'profile' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Personal Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Full Name</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.name || session.name}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">UHID</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">{profile?.uhid || session.uhid}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Phone</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.phone || session.phone}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.email || 'Not provided'}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Blood Group</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.bloodGroup || 'Not recorded'}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Hospital</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{session.organizationName}</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'prescriptions' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Prescriptions
                </h3>
                {prescriptions.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400">No prescriptions yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400">
                            {rx.prescriptionNo}
                          </span>
                          <span className="rounded-full bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                            OPD
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{rx.diagnosis}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {new Date(rx.createdAt).toLocaleDateString('en-IN')} · {rx.items?.length || 0} medicine(s)
                        </p>
                        <div className="mt-3 flex gap-2">
                          {rx.items?.slice(0, 3).map((item: any) => (
                            <span key={item.id} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              {item.medicineName}
                            </span>
                          ))}
                          {rx.items?.length > 3 && (
                            <span className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-500">
                              +{rx.items.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'laborders' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Laboratory Reports
                </h3>
                {labOrders.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400">No lab reports yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {labOrders.map((lab) => (
                      <div
                        key={lab.id}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{lab.testName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {lab.category} · {new Date(lab.orderedAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              lab.status === 'completed'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {lab.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'appointments' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Appointments
                </h3>
                <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-3">
                    Book a New Appointment
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    Select your preferred doctor and time slot. Our reception team will confirm your appointment.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 transition"
                  >
                    Go to Hospital Portal <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {appointments.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400">No appointments scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 p-4"
                      >
                        <p className="font-semibold text-slate-900 dark:text-white">{appt.doctor?.name || 'Doctor'}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(appt.appointmentDate).toLocaleDateString('en-IN')} at {appt.slotTime} · {appt.type}
                        </p>
                        <span
                          className="rounded-full bg-teal-50 dark:bg-teal-900/20 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300"
                        >
                          {appt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'invoices' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Bills & Invoices
                </h3>
                {invoices.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400">No bills yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{inv.invoiceNo}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {inv.billType} · {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-white">
                            ₹{inv.totalAmount?.toLocaleString('en-IN') || '0'}
                          </p>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400"
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'ipdadmissions' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-rose-600 dark:text-rose-400" /> IPD Admissions
                </h3>
                {admissions.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400">No IPD admissions.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {admissions.map((adm) => (
                      <div
                        key={adm.id}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 p-4"
                      >
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {adm.admissionNo} · {adm.bed?.bedNumber || 'Bed assigned'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {adm.provisionalDiagnosis} · {adm.admittingDoctor?.name}
                        </p>
                        <span
                          className="rounded-full bg-teal-50 dark:bg-teal-900/20 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300"
                        >
                          {adm.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}
      </main>
    </div>
  )
}
