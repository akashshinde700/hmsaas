'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowUpRight,
  BedDouble,
  Command,
  CreditCard,
  Database,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Settings,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { PwaInstallButton } from '@/components/pwa/PwaInstall'
import SmartRxPadTab from '@/components/hms/SmartRxPadTab'
import IpdModuleTab from '@/components/hms/IpdModuleTab'
import { OpdQueueTab, PatientsDirectoryTab } from '@/components/hms/OpdAndPatientsTabs'
import {
  BillingAndLabsTab,
  HospitalSettingsTab,
  MedicineMasterTab,
} from '@/components/hms/FormularyBillingSettingsTabs'
import type {
  ClinicSettingsData,
  DoctorOption,
  PatientRecord,
} from '@/components/hms/types'

type NavKey =
  | 'overview'
  | 'opd'
  | 'rx'
  | 'ipd'
  | 'patients'
  | 'medicines'
  | 'billing'
  | 'settings'

const NAV_ITEMS: Array<{ id: NavKey; label: string; icon: typeof LayoutDashboard; badge?: string }> = [
  { id: 'overview', label: 'Command Overview', icon: LayoutDashboard },
  { id: 'opd', label: 'OPD Queue & Vitals', icon: Activity },
  { id: 'rx', label: 'Smart Rx Pad', icon: Stethoscope, badge: 'MedWiki' },
  { id: 'ipd', label: 'IPD & Bed Board', icon: BedDouble, badge: 'Live' },
  { id: 'patients', label: 'Patients (UHID)', icon: Users },
  { id: 'medicines', label: 'Medicine Formulary', icon: Pill },
  { id: 'billing', label: 'Lab & Billing', icon: CreditCard },
  { id: 'settings', label: 'Hospital Settings', icon: Settings },
]

export default function HospitalDashboardPage() {
  const router = useRouter()
  const [activeNav, setActiveNav] = useState<NavKey>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')

  const [sessionInfo, setSessionInfo] = useState<Record<string, unknown> | null>(null)
  const [dashData, setDashData] = useState<Record<string, unknown> | null>(null)
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [settings, setSettings] = useState<ClinicSettingsData | null>(null)
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(2.4)

  // Cross-module handoff states
  const [rxPatientId, setRxPatientId] = useState<string | null>(null)
  const [rxQueueId, setRxQueueId] = useState<string | null>(null)
  const [pendingIpdAdmit, setPendingIpdAdmit] = useState<{
    patientId: string
    diagnosis: string
  } | null>(null)

  const refreshCore = useCallback(async () => {
    const t0 = performance.now()
    const [aRes, dRes, pRes] = await Promise.all([
      fetch('/api/auth'),
      fetch('/api/dashboard'),
      fetch('/api/patients'),
    ])

    const aJson = await aRes.json()
    if (!aJson?.user) {
      router.replace('/login')
      return
    }
    setSessionInfo(aJson)
    if (aJson.organization?.settings) {
      setSettings(aJson.organization.settings)
    }

    const headerMs = dRes.headers.get('X-Response-Time')
    setLastLatencyMs(headerMs ? parseFloat(headerMs) : Math.round((performance.now() - t0) * 10) / 10)

    if (dRes.ok) {
      const dj = await dRes.json()
      setDashData(dj)
      setDoctors(dj.doctors || [])
      if (dj.settings) setSettings(dj.settings)
    }
    if (pRes.ok) {
      const pj = await pRes.json()
      setPatients(pj.patients || [])
    }
  }, [router])

  useEffect(() => {
    refreshCore()
  }, [refreshCore])

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/login')
  }

  if (!sessionInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
        Opening Hospital Workspace...
      </div>
    )
  }

  const user = sessionInfo.user as {
    name: string
    email: string
    role: string
    impersonatedBy?: string
  }
  const org = sessionInfo.organization as {
    name: string
    subscription?: { status: string; plan?: { name: string } }
  }
  const kpis = (dashData?.kpis as Record<string, number>) || {}
  const activeAdmissions =
    (dashData?.activeAdmissions as Array<Record<string, unknown>>) || []
  const opdQueue = (dashData?.opdQueue as Array<Record<string, unknown>>) || []

  return (
    <div className="min-h-screen bg-slate-100/80 flex flex-col">
      {/* Platform Admin Impersonation Banner */}
      {user.impersonatedBy && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>
              Platform Admin Impersonation Session ({user.impersonatedBy}) → Viewing{' '}
              <strong>{org?.name}</strong> as {user.email}
            </span>
          </div>
          <Link
            href="/platform-admin"
            className="rounded-lg bg-slate-950 px-3 py-1 text-white hover:bg-slate-800"
          >
            Return to Platform Admin →
          </Link>
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-950 text-slate-200 p-4">
          <div>
            <div className="flex items-center gap-2.5 px-2 py-2 border-b border-slate-800 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white shrink-0">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-white">
                  {settings?.clinicDisplayName || org?.name}
                </p>
                <p className="text-[11px] text-teal-400 font-medium">
                  {org?.subscription?.plan?.name || 'SaaS Plan'} · {org?.subscription?.status || 'active'}
                </p>
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-800 text-teal-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
            <div className="px-2">
              <p className="font-bold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Utility Header */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden rounded-lg border border-slate-200 p-2"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-base font-extrabold text-slate-900">
                  {NAV_ITEMS.find((n) => n.id === activeNav)?.label}
                </h1>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Multi-Tenant Isolated Workspace · UHID Prefix:{' '}
                  <span className="font-mono font-semibold">{settings?.uhidPrefix || 'HMS'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Ultra-fast API Latency Badge */}
              <div className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                <Zap className="h-3 w-3 text-emerald-600" />
                <span>API {lastLatencyMs.toFixed(1)}ms</span>
              </div>

              {/* Quick Command Palette Trigger */}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-400"
              >
                <Command className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Quick Jump / Search</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono border border-slate-200">
                  ⌘K
                </kbd>
              </button>

              <PwaInstallButton compact />
            </div>
          </header>

          {/* Dynamic Tab Content */}
          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
            <motion.div
              key={activeNav}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* ==================== OVERVIEW TAB ==================== */}
              {activeNav === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div
                      onClick={() => setActiveNav('opd')}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-teal-400 transition"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">OPD Queue Today</span>
                        <Activity className="h-4 w-4 text-teal-600" />
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-slate-900">
                        {kpis.opdTotalToday ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-teal-700 font-medium">
                        {kpis.opdWaiting ?? 0} waiting · {kpis.opdCompleted ?? 0} completed
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveNav('ipd')}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-sky-400 transition"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">IPD Ward Occupancy</span>
                        <BedDouble className="h-4 w-4 text-sky-600" />
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-slate-900">
                        {kpis.occupiedBeds ?? 0}{' '}
                        <span className="text-lg font-semibold text-slate-400">
                          / {kpis.totalBeds ?? 0} Beds
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-emerald-700 font-medium">
                        {kpis.availableBeds ?? 0} free beds ready ({kpis.occupancyRate ?? 0}% full)
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveNav('billing')}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-emerald-400 transition"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">Collected Revenue</span>
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-slate-900">
                        ₹{(kpis.collectedRevenue ?? 0).toLocaleString('en-IN')}
                      </p>
                      <p className="mt-1 text-xs text-amber-700 font-medium">
                        + ₹{(kpis.runningIpdUnbilled ?? 0).toLocaleString('en-IN')} active IPD unbilled
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveNav('medicines')}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-violet-400 transition"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">MedWiki Drug Catalog</span>
                        <Database className="h-4 w-4 text-violet-600" />
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-slate-900">
                        {kpis.medicineCatalogCount ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-violet-700 font-medium">
                        Global MedWiki + Custom Formulary
                      </p>
                    </div>
                  </div>

                  {/* Quick Clinical Launchpad */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setActiveNav('rx')}
                      className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-5 text-left text-white shadow-md hover:opacity-95 transition"
                    >
                      <div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-teal-100">
                          <Sparkles className="h-3.5 w-3.5" /> 30-Second Consultation
                        </span>
                        <h3 className="mt-1 text-base font-extrabold">Open Smart OPD Rx Pad</h3>
                      </div>
                      <ArrowUpRight className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveNav('ipd')}
                      className="flex items-center justify-between rounded-2xl bg-slate-900 p-5 text-left text-white shadow-md hover:bg-slate-800 transition"
                    >
                      <div>
                        <span className="text-[11px] font-bold uppercase text-sky-300">
                          ICTHospital IPD Engine
                        </span>
                        <h3 className="mt-1 text-base font-extrabold">
                          Live Ward Bed Board &amp; Admit
                        </h3>
                      </div>
                      <ArrowUpRight className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveNav('patients')}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-2xs hover:border-teal-500 transition"
                    >
                      <div>
                        <span className="text-[11px] font-bold uppercase text-teal-600">
                          {kpis.totalPatients ?? 0} UHID Records
                        </span>
                        <h3 className="mt-1 text-base font-extrabold">
                          Register / Lookup Patient
                        </h3>
                      </div>
                      <ArrowUpRight className="h-5 w-5 text-teal-600" />
                    </button>
                  </div>

                  {/* Two-Column Live OPD Queue + Active IPD Patients */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-900">
                          Today&apos;s OPD Queue ({opdQueue.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveNav('opd')}
                          className="text-xs font-bold text-teal-700 hover:underline"
                        >
                          Manage Queue →
                        </button>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        {opdQueue.slice(0, 5).map((q) => {
                          const p = q.patient as PatientRecord
                          return (
                            <div
                              key={String(q.id)}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                            >
                              <div>
                                <span className="font-mono font-bold text-teal-700">
                                  Token #{String(q.tokenNumber)}
                                </span>{' '}
                                · <strong>{p?.name}</strong> ({p?.uhid})
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {String(q.visitReason || 'OPD Consultation')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setRxPatientId(p.id)
                                  setRxQueueId(String(q.id))
                                  setActiveNav('rx')
                                }}
                                className="rounded-lg bg-teal-600 px-3 py-1.5 font-bold text-white"
                              >
                                Prescribe
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-900">
                          Active Admitted IPD Patients ({activeAdmissions.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveNav('ipd')}
                          className="text-xs font-bold text-sky-700 hover:underline"
                        >
                          Open Ward Board →
                        </button>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        {activeAdmissions.map((adm) => {
                          const p = adm.patient as PatientRecord
                          const bed = adm.bed as { bedNumber: string; category: { name: string } }
                          const fin = adm.financials as {
                            grossTotal: number
                            depositsPaidTotal: number
                            netPayable: number
                          }
                          return (
                            <div
                              key={String(adm.id)}
                              onClick={() => setActiveNav('ipd')}
                              className="cursor-pointer rounded-xl border border-rose-100 bg-rose-50/40 p-3 hover:border-rose-300 transition"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">
                                  {p?.name}{' '}
                                  <span className="font-mono text-rose-700">
                                    [{bed?.bedNumber}]
                                  </span>
                                </span>
                                <span className="font-bold text-slate-800">
                                  Bill: ₹{fin?.grossTotal?.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <p className="mt-0.5 text-slate-600">
                                {String(adm.provisionalDiagnosis)} · Paid Deposit: ₹
                                {fin?.depositsPaidTotal?.toLocaleString('en-IN')}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== OPD QUEUE TAB ==================== */}
              {activeNav === 'opd' && (
                <OpdQueueTab
                  patients={patients}
                  doctors={doctors}
                  onWriteRx={(pid, qid) => {
                    setRxPatientId(pid)
                    setRxQueueId(qid)
                    setActiveNav('rx')
                  }}
                  onAdmitIpd={(pid, diag) => {
                    setPendingIpdAdmit({ patientId: pid, diagnosis: diag })
                    setActiveNav('ipd')
                  }}
                  onRefreshGlobal={refreshCore}
                />
              )}

              {/* ==================== SMART RX PAD TAB ==================== */}
              {activeNav === 'rx' && (
                <SmartRxPadTab
                  patients={patients}
                  doctors={doctors}
                  settings={settings}
                  preselectedPatientId={rxPatientId}
                  preselectedQueueId={rxQueueId}
                  onNavigateIpdAdmit={(pid, diag) => {
                    setPendingIpdAdmit({ patientId: pid, diagnosis: diag })
                    setActiveNav('ipd')
                  }}
                  onLatencySample={(ms) => setLastLatencyMs(ms)}
                />
              )}

              {/* ==================== IPD MODULE & BED BOARD TAB ==================== */}
              {activeNav === 'ipd' && (
                <IpdModuleTab
                  patients={patients}
                  doctors={doctors}
                  settings={settings}
                  pendingAdmit={pendingIpdAdmit}
                  onClearPendingAdmit={() => setPendingIpdAdmit(null)}
                  onRefreshGlobal={refreshCore}
                />
              )}

              {/* ==================== PATIENTS UHID TAB ==================== */}
              {activeNav === 'patients' && (
                <PatientsDirectoryTab
                  patients={patients}
                  onRefreshPatients={refreshCore}
                  onWriteRx={(pid) => {
                    setRxPatientId(pid)
                    setActiveNav('rx')
                  }}
                  onAdmitIpd={(pid, diag) => {
                    setPendingIpdAdmit({ patientId: pid, diagnosis: diag })
                    setActiveNav('ipd')
                  }}
                />
              )}

              {/* ==================== MEDICINE MASTER TAB ==================== */}
              {activeNav === 'medicines' && <MedicineMasterTab />}

              {/* ==================== LAB & BILLING TAB ==================== */}
              {activeNav === 'billing' && <BillingAndLabsTab patients={patients} />}

              {/* ==================== HOSPITAL SETTINGS TAB ==================== */}
              {activeNav === 'settings' && (
                <HospitalSettingsTab onRefreshGlobal={refreshCore} />
              )}
            </motion.div>
          </main>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden flex">
          <div className="w-64 bg-slate-950 text-white p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="font-bold">{org?.name}</span>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(item.id)
                        setMobileMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900"
                    >
                      <Icon className="h-4 w-4" /> {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 py-2 text-xs text-rose-400 font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Cmd+K Global Command & Patient Jump Modal */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 pt-20 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl border border-slate-200"
          >
            <input
              autoFocus
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              placeholder="Jump to module or type patient name / UHID..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
            />
            <div className="mt-3 max-h-72 overflow-y-auto space-y-1 text-xs">
              <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">Modules</p>
              {NAV_ITEMS.filter((n) =>
                n.label.toLowerCase().includes(cmdQuery.toLowerCase())
              ).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(n.id)
                    setCmdOpen(false)
                    setCmdQuery('')
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                >
                  <span>{n.label}</span>
                  <span className="text-[10px] text-slate-400">Open →</span>
                </button>
              ))}

              <p className="px-2 pt-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                Patients
              </p>
              {patients
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(cmdQuery.toLowerCase()) ||
                    p.uhid.toLowerCase().includes(cmdQuery.toLowerCase())
                )
                .slice(0, 6)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setRxPatientId(p.id)
                      setActiveNav('rx')
                      setCmdOpen(false)
                      setCmdQuery('')
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-teal-50"
                  >
                    <span>
                      <strong>{p.name}</strong> ({p.uhid})
                    </span>
                    <span className="text-[11px] font-semibold text-teal-700">Prescribe →</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
