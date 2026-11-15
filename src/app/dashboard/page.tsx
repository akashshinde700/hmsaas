'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowUpRight,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Command,
  CreditCard,
  Database,
  Gift,
  HeartPulse,
  Keyboard,
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
import { useNetworkRecovery, usePersistentState } from '@/hooks/useSaaSUX'
import {
  ErrorRecoveryBanner,
  KeyboardShortcutsModal,
  NetworkRecoveryBanner,
  PlanQuotaCard,
  SkeletonKpiGrid,
  TierBadge,
  type PlanUsageSummary,
} from '@/components/saas-ux/SaaSUXPrimitives'
import SmartRxPadTab from '@/components/hms/SmartRxPadTab'
import IpdModuleTab from '@/components/hms/IpdModuleTab'
import { OpdQueueTab, PatientsDirectoryTab } from '@/components/hms/OpdAndPatientsTabs'
import {
  BillingAndLabsTab,
  HospitalSettingsTab,
  MedicineMasterTab,
} from '@/components/hms/FormularyBillingSettingsTabs'
import OnboardingWizardModal from '@/components/hms/OnboardingWizardModal'
import ReferAndEarnTab from '@/components/hms/ReferAndEarnTab'
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
  | 'referrals'
  | 'settings'

const NAV_ITEMS: Array<{
  id: NavKey
  label: string
  shortLabel: string
  shortcut: string
  icon: typeof LayoutDashboard
  badge?: string
}> = [
  { id: 'overview', label: 'Command Overview', shortLabel: 'Overview', shortcut: 'Alt+1', icon: LayoutDashboard },
  { id: 'opd', label: 'OPD Queue & Vitals', shortLabel: 'OPD', shortcut: 'Alt+2', icon: Activity },
  { id: 'rx', label: 'Smart Rx Pad', shortLabel: 'Rx Pad', shortcut: 'Alt+3', icon: Stethoscope, badge: 'MedWiki' },
  { id: 'ipd', label: 'IPD & Bed Board', shortLabel: 'IPD', shortcut: 'Alt+4', icon: BedDouble, badge: 'Live' },
  { id: 'patients', label: 'Patients (UHID)', shortLabel: 'Patients', shortcut: 'Alt+5', icon: Users },
  { id: 'medicines', label: 'Medicine Formulary', shortLabel: 'Meds', shortcut: 'Alt+6', icon: Pill },
  { id: 'billing', label: 'Lab & Billing', shortLabel: 'Billing', shortcut: 'Alt+7', icon: CreditCard },
  { id: 'referrals', label: 'Refer & Earn', shortLabel: 'Refer', shortcut: 'Alt+8', icon: Gift, badge: '20%' },
  { id: 'settings', label: 'Hospital Settings', shortLabel: 'Settings', shortcut: 'Alt+9', icon: Settings },
]

export default function HospitalDashboardPage() {
  const router = useRouter()

  // #4 Persistent Sidebar Collapse + Persistent Active Navigation Tab
  const [activeNav, setActiveNav] = usePersistentState<NavKey>('hms_active_nav_v2', 'overview')
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    'hms_sidebar_collapsed',
    false
  )

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdActiveIndex, setCmdActiveIndex] = useState(0)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  const [initialLoading, setInitialLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sessionInfo, setSessionInfo] = useState<Record<string, unknown> | null>(null)
  const [dashData, setDashData] = useState<Record<string, unknown> | null>(null)
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [settings, setSettings] = useState<(ClinicSettingsData & { onboardingCompleted?: boolean }) | null>(null)
  const [planUsage, setPlanUsage] = useState<PlanUsageSummary | null>(null)
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(2.4)

  // #20 Online / Offline Recovery State
  const { isOnline, justRecovered, dismissRecovery } = useNetworkRecovery()

  // Cross-module handoff states
  const [rxPatientId, setRxPatientId] = useState<string | null>(null)
  const [rxQueueId, setRxQueueId] = useState<string | null>(null)
  const [pendingIpdAdmit, setPendingIpdAdmit] = useState<{
    patientId: string
    diagnosis: string
  } | null>(null)

  const refreshCore = useCallback(async () => {
    setFetchError(null)
    try {
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
      setLastLatencyMs(
        headerMs ? parseFloat(headerMs) : Math.round((performance.now() - t0) * 10) / 10
      )

      if (dRes.ok) {
        const dj = await dRes.json()
        setDashData(dj)
        setDoctors(dj.doctors || [])
        if (dj.settings) setSettings(dj.settings)
        if (dj.planUsage) setPlanUsage(dj.planUsage)
      }
      if (pRes.ok) {
        const pj = await pRes.json()
        setPatients(pj.patients || [])
      }
    } catch {
      setFetchError('Unable to reach server right now. Check connection and click Retry.')
    } finally {
      setInitialLoading(false)
    }
  }, [router])

  useEffect(() => {
    refreshCore()
  }, [refreshCore])

  // #13 Global Keyboard Shortcuts (⌘K, ?, [, Alt+1..9, Esc)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select'

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
        setCmdActiveIndex(0)
        return
      }

      if (e.key === 'Escape') {
        setCmdOpen(false)
        setShortcutsOpen(false)
        setMobileMenuOpen(false)
        return
      }

      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = Number(e.key) - 1
        if (NAV_ITEMS[idx]) setActiveNav(NAV_ITEMS[idx].id)
        return
      }

      if (inInput) return

      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      } else if (e.key === '[') {
        e.preventDefault()
        setSidebarCollapsed((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveNav, setSidebarCollapsed])

  // #3 Spotlight Command Palette Unified Items
  const commandResults = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase()
    const items: Array<{ id: string; category: string; label: string; sub?: string; run: () => void }> = []

    const quickActions = [
      {
        id: 'act-rx',
        category: 'Quick Action',
        label: 'Write 30-Second Smart Prescription',
        sub: 'Alt+3',
        run: () => setActiveNav('rx'),
      },
      {
        id: 'act-ipd',
        category: 'Quick Action',
        label: 'Open Live IPD Ward & Bed Board',
        sub: 'Alt+4',
        run: () => setActiveNav('ipd'),
      },
      {
        id: 'act-wiz',
        category: 'Quick Action',
        label: 'Launch Guided Hospital Onboarding Wizard',
        sub: 'Setup',
        run: () => setWizardOpen(true),
      },
      {
        id: 'act-ref',
        category: 'Quick Action',
        label: 'Refer a Hospital & Earn 20% Commission',
        sub: 'Alt+8',
        run: () => setActiveNav('referrals'),
      },
    ]

    for (const a of quickActions) {
      if (!q || a.label.toLowerCase().includes(q)) items.push(a)
    }

    for (const n of NAV_ITEMS) {
      if (!q || n.label.toLowerCase().includes(q)) {
        items.push({
          id: `nav-${n.id}`,
          category: 'Module',
          label: n.label,
          sub: n.shortcut,
          run: () => setActiveNav(n.id),
        })
      }
    }

    for (const p of patients) {
      if (!q || p.name.toLowerCase().includes(q) || p.uhid.toLowerCase().includes(q)) {
        items.push({
          id: `pat-${p.id}`,
          category: 'Patient',
          label: `${p.name} (${p.uhid})`,
          sub: 'Prescribe →',
          run: () => {
            setRxPatientId(p.id)
            setActiveNav('rx')
          },
        })
      }
    }

    return items.slice(0, 14)
  }, [cmdQuery, patients, setActiveNav])

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/login')
  }

  if (initialLoading && !sessionInfo) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-12 w-64 rounded-2xl bg-slate-200 animate-pulse" />
        <SkeletonKpiGrid count={4} />
        <SkeletonKpiGrid count={3} />
      </div>
    )
  }

  if (!sessionInfo) return null

  const user = sessionInfo.user as {
    name: string
    email: string
    role: string
    impersonatedBy?: string
  }
  const org = sessionInfo.organization as {
    name: string
    subscription?: { status: string; plan?: { name: string; tier?: string } }
  }
  const kpis = (dashData?.kpis as Record<string, number>) || {}
  const activeAdmissions =
    (dashData?.activeAdmissions as Array<Record<string, unknown>>) || []
  const opdQueue = (dashData?.opdQueue as Array<Record<string, unknown>>) || []

  return (
    <div className="min-h-screen bg-slate-100/80 flex flex-col">
      {/* Platform Admin Impersonation Banner */}
      {user.impersonatedBy && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>
              Platform Admin Impersonation ({user.impersonatedBy}) → Viewing{' '}
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
        {/* #4 Persistent Collapsible Desktop Left Sidebar */}
        <aside
          className={`hidden lg:flex shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-950 text-slate-200 p-3.5 transition-all duration-200 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 px-1.5 py-2 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white shrink-0">
                  <HeartPulse className="h-5 w-5" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">
                      {settings?.clinicDisplayName || org?.name}
                    </p>
                    <p className="text-[11px] text-teal-400 font-medium truncate">
                      {org?.subscription?.plan?.name || 'Advance Hospital'}
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                title="Collapse / Expand Sidebar ([)"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            <nav className="mt-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.label} (${item.shortcut})`}
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && item.badge && (
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
            {!sidebarCollapsed && (
              <div className="px-2">
                <p className="font-bold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.role}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="w-full flex items-center justify-center lg:justify-start gap-2 rounded-xl px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Utility Header */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden rounded-lg border border-slate-200 p-2"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-slate-900 truncate">
                    {NAV_ITEMS.find((n) => n.id === activeNav)?.label}
                  </h1>
                  {/* #14 Tier-Based UI Indicator */}
                  <div className="hidden sm:block">
                    <TierBadge
                      tier={planUsage?.tier || org?.subscription?.plan?.tier}
                      planName={planUsage?.planName || org?.subscription?.plan?.name}
                      status={planUsage?.status || org?.subscription?.status}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Tenant Isolated · UHID Prefix:{' '}
                  <span className="font-mono font-semibold">{settings?.uhidPrefix || 'HMS'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Ultra-fast API Latency Badge */}
              <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                <Zap className="h-3 w-3 text-emerald-600" />
                <span>API {lastLatencyMs.toFixed(1)}ms</span>
              </div>

              {/* #3 Spotlight Command Palette Trigger */}
              <button
                type="button"
                onClick={() => {
                  setCmdOpen(true)
                  setCmdActiveIndex(0)
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-400"
              >
                <Command className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Quick Jump / Search</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono border border-slate-200">
                  ⌘K
                </kbd>
              </button>

              {/* #13 Keyboard Shortcuts Help Trigger */}
              <button
                type="button"
                title="Keyboard Shortcuts (?)"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <kbd className="font-mono text-[10px]">?</kbd>
              </button>

              <PwaInstallButton compact />
            </div>
          </header>

          {/* Dynamic Tab Content (pb-24 on mobile for sticky bottom nav!) */}
          <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto space-y-5">
            {/* #20 Graceful Error Recovery Banner */}
            <ErrorRecoveryBanner error={fetchError} onRetry={refreshCore} />

            {/* #15 Guided Onboarding Data Capture Banner when not yet completed */}
            {settings && !settings.onboardingCompleted && activeNav === 'overview' && (
              <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-extrabold text-slate-900 text-sm">
                      Personalize Your Hospital OPD &amp; IPD Setup (60 Seconds)
                    </p>
                    <p className="text-slate-600">
                      Configure your letterhead, UHID prefix, default Rx language (EN/हिंदी/मराठी), and UPI QR billing in 4 quick steps.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-700"
                >
                  Start Guided Setup →
                </button>
              </div>
            )}

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

                  {/* #14 Tier-Based Subscription Quotas */}
                  <PlanQuotaCard
                    usage={planUsage}
                    onOpenSettings={() => setActiveNav('settings')}
                  />

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
                      onClick={() => setActiveNav('referrals')}
                      className="flex items-center justify-between rounded-2xl border border-teal-200 bg-white p-5 text-left text-slate-900 shadow-2xs hover:border-teal-500 transition"
                    >
                      <div>
                        <span className="text-[11px] font-bold uppercase text-teal-600">
                          Partner Rewards · 20% Share
                        </span>
                        <h3 className="mt-1 text-base font-extrabold">
                          Refer a Peer Hospital &amp; Earn
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
                                  {String(q.chiefComplaint || q.visitReason || 'OPD Consultation')}
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

              {/* ==================== #16 REFER & EARN TAB ==================== */}
              {activeNav === 'referrals' && <ReferAndEarnTab />}

              {/* ==================== HOSPITAL SETTINGS TAB ==================== */}
              {activeNav === 'settings' && (
                <HospitalSettingsTab
                  onRefreshGlobal={refreshCore}
                  onOpenWizard={() => setWizardOpen(true)}
                />
              )}
            </motion.div>
          </main>
        </div>
      </div>

      {/* #18 Sticky Mobile-Optimized Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        {(
          [
            { id: 'overview', label: 'Home', icon: LayoutDashboard },
            { id: 'opd', label: 'OPD', icon: Activity },
            { id: 'rx', label: 'Smart Rx', icon: Stethoscope },
            { id: 'ipd', label: 'IPD Beds', icon: BedDouble },
          ] as const
        ).map((m) => {
          const Icon = m.icon
          const active = activeNav === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveNav(m.id)}
              className={`flex flex-col items-center justify-center py-2 text-[10px] font-bold transition ${
                active ? 'text-teal-600' : 'text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              {m.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center py-2 text-[10px] font-bold text-slate-500"
        >
          <Menu className="h-4 w-4 mb-0.5" />
          More
        </button>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden flex">
          <div className="w-64 bg-slate-950 text-white p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="font-bold truncate">{org?.name}</span>
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
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                        activeNav === item.id
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
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

      {/* #3 Spotlight Command Palette with Arrow-Key + Enter Navigation */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 pt-16 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl border border-slate-200"
          >
            <input
              autoFocus
              value={cmdQuery}
              onChange={(e) => {
                setCmdQuery(e.target.value)
                setCmdActiveIndex(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setCmdActiveIndex((i) => Math.min(commandResults.length - 1, i + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setCmdActiveIndex((i) => Math.max(0, i - 1))
                } else if (e.key === 'Enter' && commandResults[cmdActiveIndex]) {
                  e.preventDefault()
                  commandResults[cmdActiveIndex].run()
                  setCmdOpen(false)
                  setCmdQuery('')
                }
              }}
              placeholder="Type a module, quick action, or patient UHID / name (↑↓ + Enter)..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
            />
            <div className="mt-3 max-h-80 overflow-y-auto space-y-1 text-xs">
              {commandResults.map((item, idx) => {
                const active = idx === cmdActiveIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setCmdActiveIndex(idx)}
                    onClick={() => {
                      item.run()
                      setCmdOpen(false)
                      setCmdQuery('')
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                      active ? 'bg-teal-600 text-white' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span
                        className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.category}
                      </span>
                      <span className="font-semibold">{item.label}</span>
                    </div>
                    {item.sub && (
                      <span
                        className={`font-mono text-[10px] ${
                          active ? 'text-teal-100' : 'text-slate-400'
                        }`}
                      >
                        {item.sub}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* #13 Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* #15 Guided Onboarding Data Capture Modal */}
      <OnboardingWizardModal
        open={wizardOpen}
        initialClinicName={settings?.clinicDisplayName || org?.name || ''}
        initialUhidPrefix={settings?.uhidPrefix || 'HMS'}
        onClose={() => setWizardOpen(false)}
        onCompleted={refreshCore}
      />

      {/* #20 Network Offline / "Back online. Nothing was lost." Recovery Banner */}
      <NetworkRecoveryBanner
        isOnline={isOnline}
        justRecovered={justRecovered}
        onDismiss={dismissRecovery}
      />
    </div>
  )
}
