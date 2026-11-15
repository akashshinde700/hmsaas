'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
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
  Moon,
  Pill,
  Settings,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  X,
  Zap,
  Clock,
  History,
} from 'lucide-react'
import { PwaInstallButton } from '@/components/pwa/PwaInstall'
import { useNetworkRecovery, usePersistentState, useRecentItems, useFocusMode } from '@/hooks/useSaaSUX'
import { useTheme } from '@/components/providers/ThemeProvider'
import {
  ErrorRecoveryBanner,
  KeyboardShortcutsModal,
  NetworkRecoveryBanner,
  PlanQuotaCard,
  TierBadge,
  type PlanUsageSummary,
  BentoDashboardGrid,
  BentoDashboardCard,
  BreadcrumbNav,
  QuickActionFloating,
  QuickActionFab,
  EnhancedFilterBar,
} from '@/components/saas-ux/SaaSUXPrimitives'
import {
  ModuleAccessGate,
  useSidebarModules,
} from '@/components/saas-ux/ModuleAccessGate'
import { ROLE_INFO, type UserContext } from '@/lib/role-access'
import SmartRxPadTab from '@/components/hms/SmartRxPadTab'
import IpdModuleTab from '@/components/hms/IpdModuleTab'
import { OpdQueueTab, PatientsDirectoryTab } from '@/components/hms/OpdAndPatientsTabs'
import {
  BillingAndLabsTab,
  HospitalSettingsTab,
  MedicineMasterTab,
} from '@/components/hms/FormularyBillingSettingsTabs'
import PharmacyStockTab from '@/components/pharmacy/PharmacyStockTab'
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
  | 'pharmacy'
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
  href?: string
}> = [
  { id: 'overview', label: 'Command Overview', shortLabel: 'Overview', shortcut: 'Alt+1', icon: LayoutDashboard },
  { id: 'opd', label: 'OPD Queue & Vitals', shortLabel: 'OPD', shortcut: 'Alt+2', icon: Activity },
  { id: 'rx', label: 'Smart Rx Pad', shortLabel: 'Rx Pad', shortcut: 'Alt+3', icon: Stethoscope, badge: 'MedWiki' },
  { id: 'ipd', label: 'IPD & Bed Board', shortLabel: 'IPD', shortcut: 'Alt+4', icon: BedDouble, badge: 'Live' },
  { id: 'patients', label: 'Patients (UHID)', shortLabel: 'Patients', shortcut: 'Alt+5', icon: Users },
  { id: 'medicines', label: 'Medicine Formulary', shortLabel: 'Meds', shortcut: 'Alt+6', icon: Pill },
  { id: 'pharmacy', label: 'Pharmacy Stock', shortLabel: 'Pharmacy', shortcut: 'Alt+P', icon: Database },
  { id: 'billing', label: 'Lab & Billing', shortLabel: 'Billing', shortcut: 'Alt+7', icon: CreditCard },
  { id: 'referrals', label: 'Refer & Earn', shortLabel: 'Refer', shortcut: 'Alt+8', icon: Gift, badge: '20%' },
  { id: 'settings', label: 'Hospital Settings', shortLabel: 'Settings', shortcut: 'Alt+9', icon: Settings },
]

const MODULE_LABELS: Record<NavKey, string> = {
  overview: 'Command Overview',
  opd: 'OPD Queue & Vitals',
  rx: 'Smart Rx Pad',
  ipd: 'IPD & Bed Board',
  patients: 'Patient Directory (UHID)',
  medicines: 'Medicine Formulary',
  pharmacy: 'Pharmacy Stock Management',
  billing: 'Lab & Billing',
  referrals: 'Refer & Earn',
  settings: 'Hospital Settings',
}

export default function HospitalDashboardPage() {
  const router = useRouter()

  // #4 Persistent Sidebar Collapse + Persistent Active Navigation Tab
  const [activeNav, setActiveNav] = usePersistentState<NavKey>('hms_active_nav_v2', 'overview')
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    'hms_sidebar_collapsed',
    false
  )

  // #22 Focus Mode — compact single-doctor workflow
  const { focused, setFocused, toggleFocus } = useFocusMode()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdActiveIndex, setCmdActiveIndex] = useState(0)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [upgradeNudge, setUpgradeNudge] = useState<{ module: string; feature?: string } | null>(null)

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

  // #21 Recent Items
  const { recent, addRecent } = useRecentItems()

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
      setSessionInfo({ ...aJson.user, organization: aJson.organization })
      if (aJson.settings) {
        setSettings(aJson.settings)
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

  interface TenantSession {
    userId: string
    organizationId: string
    role: string
    name: string
    email: string
    specialization?: string | null
    impersonatedBy?: string
    organization?: {
      name: string
      slug: string
      type?: string
      status?: string
      subscription?: {
        status: string
        plan?: {
          name: string
          tier: string
          featuresJson?: string
        }
      }
    }
  }

  // Parse user role & plan for access control
  const user = useMemo(() => {
    if (!sessionInfo) return null
    const s = sessionInfo as unknown as TenantSession
    return {
      userId: s.userId,
      organizationId: s.organizationId,
      role: s.role as any,
      name: s.name,
      email: s.email,
      specialization: s.specialization || null,
    } as UserContext
  }, [sessionInfo])

  const planFeaturesJson = useMemo(() => {
    const org = (sessionInfo as unknown as TenantSession | null)?.organization
    return org?.subscription?.plan?.featuresJson || null
  }, [sessionInfo])

  const orgType = useMemo(() => {
    const org = (sessionInfo as unknown as TenantSession | null)?.organization
    return org?.type || null
  }, [sessionInfo])

  // Parse org-level moduleVisibility from settings (hide/unhide per module)
  const moduleVisibility = useMemo(() => {
    if (!settings?.moduleVisibility) return null
    try {
      const parsed = JSON.parse(
        typeof settings.moduleVisibility === 'string'
          ? settings.moduleVisibility
          : JSON.stringify(settings.moduleVisibility),
      )
      return parsed as Record<string, boolean>
    } catch {
      return null
    }
  }, [settings?.moduleVisibility])

  // Accessible modules based on role + plan + org-level module visibility
  const accessibleModules = useSidebarModules(
    user,
    planFeaturesJson,
    orgType,
    undefined,
    moduleVisibility,
  )

  // Filter NAV_ITEMS by access control + org-level module toggles
  const visibleNavItems = useMemo(() => {
    if (!user) return []
    const accessibleIds = new Set(accessibleModules.map((m) => m.id))
    return NAV_ITEMS.filter((n) => {
      if (!accessibleIds.has(n.id)) return false
      // Org-level module visibility gating (hide/unhide toggle)
      if (n.id !== 'settings' && moduleVisibility && moduleVisibility[n.id] === false) return false
      // Pharmacy module is gated on org-level pharmacyEnabled toggle
      if (n.id === 'pharmacy' && !(settings?.pharmacyEnabled || false)) return false
      return true
    })
  }, [user, accessibleModules, settings, moduleVisibility])

  // Auto-reset activeNav if current tab is no longer accessible
  useEffect(() => {
    if (user && !visibleNavItems.some((n) => n.id === activeNav)) {
      setActiveNav(visibleNavItems[0]?.id || 'overview')
    }
  }, [user, visibleNavItems, activeNav, setActiveNav])

  // Global keyboard shortcuts
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
        const target = visibleNavItems.find((item) => item.shortcut === `Alt+${e.key}`)
        if (target) setActiveNav(target.id)
        return
      }

      if (inInput) return

      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        refreshCore()
        return
      }
      if (e.altKey && e.key.toLowerCase() === 'p') {
        const pharmacy = visibleNavItems.find((item) => item.id === 'pharmacy')
        if (pharmacy) { e.preventDefault(); setActiveNav(pharmacy.id) }
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      } else if (e.key === '[') {
        e.preventDefault()
        setSidebarCollapsed((v) => !v)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveNav, setSidebarCollapsed, toggleFocus, visibleNavItems, refreshCore])

  // #3 Spotlight Command Palette Unified Items
  const commandResults = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase()
    const items: Array<{ id: string; category: string; label: string; sub?: string; run: () => void }> = []

    const quickActions = [
      { id: 'act-rx', category: 'Quick Action', label: 'Write 30-Second Smart Prescription', sub: 'Alt+3', run: () => setActiveNav('rx') },
      { id: 'act-ipd', category: 'Quick Action', label: 'Open Live IPD Ward & Bed Board', sub: 'Alt+4', run: () => setActiveNav('ipd') },
      { id: 'act-wiz', category: 'Quick Action', label: 'Launch Guided Hospital Onboarding Wizard', sub: 'Setup', run: () => setWizardOpen(true) },
      { id: 'act-ref', category: 'Quick Action', label: 'Refer a Hospital & Earn 20% Commission', sub: 'Alt+8', run: () => setActiveNav('referrals') },
      { id: 'act-focus', category: 'UI', label: 'Toggle Focus Mode (Single Doctor)', sub: '⌘/Ctrl+F', run: toggleFocus },
    ]

    for (const a of quickActions) {
      if (!q || a.label.toLowerCase().includes(q)) items.push(a)
    }

    for (const n of visibleNavItems) {
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

    // Recent items in command palette
    for (const r of recent.slice(0, 5)) {
      if (!q || r.label.toLowerCase().includes(q)) {
        items.push({
          id: `recent-${r.id}`,
          category: 'Recent',
          label: r.label,
          sub: r.sub,
            run: () => {
              if (r.module === 'rx') setRxPatientId(r.routeParam ?? null)
              setActiveNav(r.module)
            },
        })
      }
    }

    return items.slice(0, 14)
  }, [cmdQuery, patients, visibleNavItems, recent, setActiveNav, toggleFocus])

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/login')
  }

  const roleInfo = user ? (ROLE_INFO as Record<string, { label: string; color: string; description: string }>)[user.role] : null

  const { resolvedTheme, toggleTheme, theme } = useTheme()

  const typedSession = sessionInfo as unknown as TenantSession | null

  if (initialLoading && !sessionInfo) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-12 w-64 rounded-2xl bg-slate-200 animate-pulse" />
        <BentoDashboardGrid cards={[
          { title: 'OPD Today', value: '—', sub: 'Loading...', icon: Activity, color: 'teal' },
          { title: 'IPD Beds', value: '—', sub: 'Loading...', icon: BedDouble, color: 'sky' },
          { title: 'Revenue', value: '—', sub: 'Loading...', icon: CreditCard, color: 'emerald' },
          { title: 'Drug Catalog', value: '—', sub: 'Loading...', icon: Database, color: 'violet' },
        ]} />
      </div>
    )
  }

  if (!sessionInfo) return null

  const kpis = (dashData?.kpis as Record<string, number>) || {}
  const activeAdmissions =
    (dashData?.activeAdmissions as Array<Record<string, unknown>>) || []
  const opdQueue = (dashData?.opdQueue as Array<Record<string, unknown>>) || []

  const currentModule = visibleNavItems.find((n) => n.id === activeNav)

  return (
    <div className={`min-h-screen bg-slate-100/80 flex flex-col ${focused ? 'px-2' : ''}`}>
      {/* Platform Admin Impersonation Banner */}
      {typedSession?.impersonatedBy && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>
              Platform Admin Impersonation ({typedSession.impersonatedBy}) → Viewing{' '}
              <strong>{typedSession.organization?.name}</strong> as {typedSession.email}
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
          className={`hidden lg:flex shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-950 text-slate-200 p-3.5 transition-all duration-300 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          } ${focused ? 'w-16' : ''}`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 px-1.5 py-2 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white shrink-0">
                  <HeartPulse className="h-5 w-5" />
                </div>
                {!sidebarCollapsed && !focused && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">
                      {settings?.clinicDisplayName || typedSession?.organization?.name}
                    </p>
                    <p className="text-[11px] text-teal-400 font-medium truncate">
                      {typedSession?.organization?.subscription?.plan?.name || 'Advance Hospital'}
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
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                const active = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.label} (${item.shortcut})`}
                    onClick={() => {
                      setActiveNav(item.id)
                      addRecent({
                        id: item.id,
                        type: 'module',
                        label: item.label,
                        sub: item.shortcut,
                        module: item.id,
                      })
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && !focused && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && !focused && item.badge && (
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
              {visibleNavItems.length < NAV_ITEMS.length && (
                <div className="mx-2 mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-2 text-[10px] text-slate-400 text-center">
                  Some modules hidden by your plan / role
                </div>
              )}
            </nav>
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
            {!sidebarCollapsed && !focused && (
              <div className="px-2">
                <p className="font-bold text-white truncate">{user?.name}</p>
                {roleInfo && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400 border border-slate-700/50">
                      {user?.role}
                    </span>
                    <p className="text-[11px] text-slate-400 truncate">{roleInfo.label}</p>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={toggleFocus}
              title={focused ? 'Exit Focus Mode' : 'Focus Mode (hide chrome)'}
              className={`w-full flex items-center justify-center lg:justify-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                focused
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {focused ? <Clock className="h-4 w-4" /> : <History className="h-4 w-4" />}
              {!sidebarCollapsed && !focused && <span>{focused ? 'Exit Focus' : 'Focus Mode'}</span>}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="w-full flex items-center justify-center lg:justify-start gap-2 rounded-xl px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && !focused && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${focused ? 'px-4' : ''}`}>
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
                  <BreadcrumbNav
                    items={[
                      { label: MODULE_LABELS[activeNav as NavKey] || activeNav, moduleId: activeNav },
                    ]}
                  />
                  <h1 className="text-base font-extrabold text-slate-900 truncate">
                    {currentModule?.label || NAV_ITEMS.find((n) => n.id === activeNav)?.label}
                  </h1>
                  <div className="hidden sm:block">
                    <TierBadge
                      tier={
                        planUsage?.tier ||
                        typedSession?.organization?.subscription?.plan?.tier
                      }
                      planName={
                        planUsage?.planName ||
                        typedSession?.organization?.subscription?.plan?.name
                      }
                      status={
                        planUsage?.status ||
                        typedSession?.organization?.subscription?.status
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Tenant Isolated · UHID Prefix:{' '}
                  <span className="font-mono font-semibold">{settings?.uhidPrefix || 'HMS'}</span>
                  {roleInfo && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {roleInfo.label}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                <Zap className="h-3 w-3 text-emerald-600" />
                <span>API {lastLatencyMs.toFixed(1)}ms</span>
              </div>

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

              <button
                type="button"
                title="Keyboard Shortcuts (?)"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <kbd className="font-mono text-[10px]">?</kbd>
              </button>

              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'system'} mode`}
                className={`rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition ${
                  resolvedTheme === 'dark' ? 'text-teal-600 border-teal-200 bg-teal-50' : ''
                }`}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-slate-600" />
                )}
              </button>

              <PwaInstallButton compact />
            </div>
          </header>

          {/* Dynamic Tab Content */}
          <main className={`flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto space-y-5 ${focused ? 'p-2 sm:p-4' : ''}`}>
            {/* #20 Graceful Error Recovery Banner */}
            <ErrorRecoveryBanner error={fetchError} onRetry={refreshCore} />

            {/* #15 Guided Onboarding Data Capture Banner when not yet completed */}
            {settings && !settings.onboardingCompleted && activeNav === 'overview' && visibleNavItems.some((n) => n.id === 'overview') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
              >
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
              </motion.div>
            )}

            {/* Plan Upgrade Nudge */}
            {upgradeNudge && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-600 text-white shrink-0">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">{upgradeNudge.module} requires plan upgrade</p>
                    <p className="text-amber-800">
                      Your current plan does not include {upgradeNudge.feature || 'this module'}. Contact Platform Admin to enable it.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUpgradeNudge(null)}
                  className="text-amber-500 hover:text-amber-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {visibleNavItems.some((n) => n.id === activeNav) ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeNav}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* ==================== OVERVIEW TAB (Bento Dashboard) ==================== */}
                {activeNav === 'overview' && (
                  <div className="space-y-6">
                    {/* Bento KPI Grid */}
                    <BentoDashboardGrid cards={[
                      {
                        title: 'OPD Queue Today',
                        value: kpis.opdTotalToday ?? 0,
                        sub: `${kpis.opdWaiting ?? 0} waiting · ${kpis.opdCompleted ?? 0} completed`,
                        icon: Activity,
                        color: 'teal',
                        onClick: () => setActiveNav('opd'),
                      },
                      {
                        title: 'IPD Ward Occupancy',
                        value: `${kpis.occupiedBeds ?? 0} / ${kpis.totalBeds ?? 0}`,
                        sub: `${kpis.availableBeds ?? 0} free beds (${kpis.occupancyRate ?? 0}% full)`,
                        icon: BedDouble,
                        color: 'sky',
                        onClick: () => setActiveNav('ipd'),
                      },
                      {
                        title: 'Collected Revenue',
                        value: `₹${(kpis.collectedRevenue ?? 0).toLocaleString('en-IN')}`,
                        sub: `+ ₹${(kpis.runningIpdUnbilled ?? 0).toLocaleString('en-IN')} active IPD unbilled`,
                        icon: CreditCard,
                        color: 'emerald',
                        onClick: () => setActiveNav('billing'),
                      },
                      {
                        title: 'MedWiki Drug Catalog',
                        value: kpis.medicineCatalogCount ?? 0,
                        sub: 'Global MedWiki + Custom Formulary',
                        icon: Database,
                        color: 'violet',
                        onClick: () => setActiveNav('medicines'),
                      },
                    ]} />

                    {/* #14 Tier-Based Subscription Quotas */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.1 }}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
                    >
                      <PlanQuotaCard
                        usage={planUsage}
                        onOpenSettings={() => setActiveNav('settings')}
                      />
                    </motion.div>

                    {/* Quick Clinical Launchpad */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.15 }}
                      className="grid gap-4 sm:grid-cols-3"
                    >
                      {visibleNavItems.some((n) => n.id === 'rx') && (
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
                      )}
                      {visibleNavItems.some((n) => n.id === 'ipd') && (
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
                              Live Ward Bed Board & Admit
                            </h3>
                          </div>
                          <ArrowUpRight className="h-5 w-5" />
                        </button>
                      )}
                      {visibleNavItems.some((n) => n.id === 'referrals') && (
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
                              Refer a Peer Hospital & Earn
                            </h3>
                          </div>
                          <ArrowUpRight className="h-5 w-5 text-teal-600" />
                        </button>
                      )}
                    </motion.div>

                    {/* Two-Column Live OPD Queue + Active IPD Patients */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.2 }}
                      className="grid gap-6 lg:grid-cols-2"
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900">
                            Today's OPD Queue ({opdQueue.length})
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
                                  </span>
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
                          {visibleNavItems.some((n) => n.id === 'ipd') && (
                            <button
                              type="button"
                              onClick={() => setActiveNav('ipd')}
                              className="text-xs font-bold text-sky-700 hover:underline"
                            >
                              Open Ward Board →
                            </button>
                          )}
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
                                    {p?.name}
                                    <span className="font-mono text-rose-700">[{bed?.bedNumber}]</span>
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
                          {activeAdmissions.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4">
                              No active IPD admissions
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Recent Items Quick Access */}
                    {recent.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.25 }}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-teal-600" />
                            Recent Items
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              // clear recent handled by component
                            }}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="space-y-2 text-xs">
                          {recent.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                if (item.module === 'rx') setRxPatientId(item.routeParam ?? null)
                                setActiveNav(item.module)
                              }}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-teal-50/50 cursor-pointer transition"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">{item.label}</p>
                                <p className="text-[10px] text-slate-500">{item.sub}</p>
                              </div>
                              <span className="text-slate-400">→</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ==================== OPD QUEUE TAB ==================== */}
                {activeNav === 'opd' && (
                  <ModuleAccessGate
                    moduleId="opd"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <OpdQueueTab
                      patients={patients}
                      doctors={doctors}
                      onWriteRx={(pid, qid) => {
                        setRxPatientId(pid)
                        setRxQueueId(qid)
                        setActiveNav('rx')
                        addRecent({ id: pid, type: 'patient', label: patients.find((x) => x.id === pid)?.name || 'Patient', sub: 'OPD Queue', module: 'rx' })
                      }}
                      onAdmitIpd={(pid, diag) => {
                        setPendingIpdAdmit({ patientId: pid, diagnosis: diag })
                        setActiveNav('ipd')
                      }}
                      onRefreshGlobal={refreshCore}
                    />
                  </ModuleAccessGate>
                )}

                {/* ==================== SMART RX PAD TAB ==================== */}
                {activeNav === 'rx' && (
                  <ModuleAccessGate
                    moduleId="rx"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
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
                  </ModuleAccessGate>
                )}

                {/* ==================== IPD MODULE & BED BOARD TAB ==================== */}
                {activeNav === 'ipd' && (
                  <ModuleAccessGate
                    moduleId="ipd"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <IpdModuleTab
                      patients={patients}
                      doctors={doctors}
                      settings={settings}
                      pendingAdmit={pendingIpdAdmit}
                      onClearPendingAdmit={() => setPendingIpdAdmit(null)}
                      onRefreshGlobal={refreshCore}
                    />
                  </ModuleAccessGate>
                )}

                {/* ==================== PATIENTS UHID TAB ==================== */}
                {activeNav === 'patients' && (
                  <ModuleAccessGate
                    moduleId="patients"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <PatientsDirectoryTab
                      patients={patients}
                      onRefreshPatients={refreshCore}
                      onWriteRx={(pid) => {
                        setRxPatientId(pid)
                        setActiveNav('rx')
                        addRecent({ id: pid, type: 'patient', label: patients.find((x) => x.id === pid)?.name || 'Patient', sub: 'Patient Directory', module: 'rx' })
                      }}
                      onAdmitIpd={(pid, diag) => {
                        setPendingIpdAdmit({ patientId: pid, diagnosis: diag })
                        setActiveNav('ipd')
                      }}
                    />
                  </ModuleAccessGate>
                )}

                {/* ==================== MEDICINE MASTER TAB ==================== */}
                {activeNav === 'medicines' && (
                  <ModuleAccessGate
                    moduleId="medicines"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <MedicineMasterTab />
                  </ModuleAccessGate>
                )}

                {/* ==================== PHARMACY STOCK TAB ==================== */}
                {activeNav === 'pharmacy' && (
                  <ModuleAccessGate
                    moduleId="pharmacy"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    {user && (
                      <PharmacyStockTab
                        organizationId={user.organizationId}
                        userRole={user.role}
                        userName={user.name}
                      />
                    )}
                  </ModuleAccessGate>
                )}

                {/* ==================== LAB & BILLING TAB ==================== */}
                {activeNav === 'billing' && (
                  <ModuleAccessGate
                    moduleId="billing"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <BillingAndLabsTab patients={patients} />
                  </ModuleAccessGate>
                )}

                {/* ==================== #16 REFER & EARN TAB ==================== */}
                {activeNav === 'referrals' && (
                  <ModuleAccessGate
                    moduleId="referrals"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <ReferAndEarnTab />
                  </ModuleAccessGate>
                )}

                {/* ==================== HOSPITAL SETTINGS TAB ==================== */}
                {activeNav === 'settings' && (
                  <ModuleAccessGate
                    moduleId="settings"
                    user={user}
                    featuresJson={planFeaturesJson}
                    organizationType={orgType}
                  >
                    <HospitalSettingsTab
                      onRefreshGlobal={refreshCore}
                      onOpenWizard={() => setWizardOpen(true)}
                    />
                  </ModuleAccessGate>
                )}
              </motion.div>
            </AnimatePresence>
            ) : user && visibleNavItems.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                No dashboard modules are visible. Contact your administrator.
              </p>
            ) : null}
          </main>
        </div>
      </div>

      {/* #18 Sticky Mobile-Optimized Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        {([
          { id: 'overview', label: 'Home', icon: LayoutDashboard },
          { id: 'opd', label: 'OPD', icon: Activity },
          { id: 'rx', label: 'Smart Rx', icon: Stethoscope },
          { id: 'ipd', label: 'IPD Beds', icon: BedDouble },
        ] as const).map((m) => {
          const Icon = m.icon
          const active = activeNav === m.id
          const visible = visibleNavItems.some((n) => n.id === m.id)
          if (!visible) return null
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
                <span className="font-bold truncate">{typedSession?.organization?.name}</span>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 space-y-1">
                {visibleNavItems.map((item) => {
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
              {commandResults.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-400">
                  No matching results
                </div>
              )}
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
        initialClinicName={settings?.clinicDisplayName || typedSession?.organization?.name || ''}
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