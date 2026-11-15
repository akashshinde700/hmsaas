'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  Database,
  ExternalLink,
  Gift,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useDebouncedValue,
  useNetworkRecovery,
  usePersistentState,
} from '@/hooks/useSaaSUX'
import {
  ConfirmDestructiveModal,
  EmptyStateCard,
  ErrorRecoveryBanner,
  NetworkRecoveryBanner,
  SkeletonKpiGrid,
  SkeletonTableRows,
  TierBadge,
} from '@/components/saas-ux/SaaSUXPrimitives'

interface Plan {
  id: string
  name: string
  tier: string
  doctorLimit: number
  branchLimit: number
  staffLimit: number
  bedLimit: number
  storageLimitMB: number
  priceMonthly: number
  priceYearly: number
  isCustom: boolean
  isActive: boolean
  features: Record<string, boolean>
  subscribersCount?: number
}

interface OrgRow {
  id: string
  name: string
  slug: string
  type: string
  city: string | null
  status: string
  adminEmail: string | null
  adminName: string | null
  generatedPassword: string | null
  subscription: null | {
    status: string
    billingCycle: string
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    plan: Plan
  }
  usage: {
    doctors: number
    staff: number
    branches: number
    patients: number
    beds: number
    activeIpd: number
  }
}

interface InquiryRow {
  id: string
  clinicName: string
  contactName: string
  email: string
  phone: string | null
  city: string | null
  facilityType: string
  bedsCount: string | null
  selectedPlan: string | null
  message: string | null
  status: string
  followUps: Array<{ id: string; date: string; by: string; note: string; nextDate?: string | null }>
  createdAt: string
}

interface BlogPostRow {
  id: string
  slug: string
  title: string
  category: string
  description: string
  body: string
  isPublished: boolean
  publishedAt: string
}

interface ReferralLeadRow {
  id: string
  partnerId: string
  referredClinicName: string
  contactName: string
  contactPhone: string
  contactEmail: string | null
  city: string | null
  planInterested: string | null
  status: string
  rewardAmountINR: number
  createdAt: string
}

interface AffiliatePartnerRow {
  id: string
  name: string
  email: string
  phone: string | null
  companyOrClinic: string | null
  city: string | null
  referralCode: string
  commissionPercent: number
  clicksCount: number
  convertedCount: number
  totalEarnedINR: number
  leads: ReferralLeadRow[]
}

interface MedwikiState {
  totalGlobal: number
  totalCustom: number
  webhookEndpoint: string
  syncApiKeyPreview: string
  categories: Array<{ category: string; count: number }>
  recentRuns: Array<{
    id: string
    triggerSource: string
    mode: string
    queryOrTerm: string | null
    status: string
    foundCount: number
    insertedCount: number
    updatedCount: number
    durationMs: number
    startedAt: string
    logSummary: string | null
  }>
  medicines: Array<{
    id: string
    name: string
    genericName: string | null
    composition: string | null
    manufacturer: string | null
    dosageForm: string
    strength: string | null
    category: string
    mrp: number | null
    schedule: string | null
    defaultFrequency: string
    usageCount: number
  }>
}

function formatDateDMY(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function PlatformAdminPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [admin, setAdmin] = useState<{ id: string; name: string; email: string } | null>(null)
  const [needsBootstrap, setNeedsBootstrap] = useState(false)
  const [loginEmail, setLoginEmail] = useState('aetherdevsolutions@gmail.com')
  const [loginPassword, setLoginPassword] = useState('Admin@123')
  const [loginName, setLoginName] = useState('Akash Shinde')
  const [busy, setBusy] = useState(false)

  const [tab, setTab] = usePersistentState<'orgs' | 'plans' | 'inquiries' | 'referrals' | 'medwiki' | 'blog'>(
    'aethermed:platform_admin_tab',
    'orgs'
  )
  const { isOnline, justRecovered, dismissRecovery } = useNetworkRecovery()
  const [dataLoading, setDataLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [selectedInquiries, setSelectedInquiries] = useState<string[]>([])
  const [inquiryFilter, setInquiryFilter] = useState<string>('all')
  const [partners, setPartners] = useState<AffiliatePartnerRow[]>([])
  const [posts, setPosts] = useState<BlogPostRow[]>([])
  const [medwiki, setMedwiki] = useState<MedwikiState | null>(null)
  const [medQuery, setMedQuery] = useState('')
  const debouncedMedQuery = useDebouncedValue(medQuery, 220)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Destructive protection modals (#19)
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<OrgRow | null>(null)
  const [deletePlanTarget, setDeletePlanTarget] = useState<Plan | null>(null)
  const [confirmBulkDeleteInquiries, setConfirmBulkDeleteInquiries] = useState(false)
  const [destructiveBusy, setDestructiveBusy] = useState(false)

  // Modals
  const [showCreateClinic, setShowCreateClinic] = useState(false)
  const [clinicForm, setClinicForm] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    phone: '',
    city: 'Pune',
    planId: '',
    startMode: 'active_monthly',
  })

  const [markPaidOrg, setMarkPaidOrg] = useState<OrgRow | null>(null)
  const [markPaidCycle, setMarkPaidCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [markPaidPlanId, setMarkPaidPlanId] = useState('')

  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null)
  const [editingPost, setEditingPost] = useState<Partial<BlogPostRow> | null>(null)
  const [followUpNotes, setFollowUpNotes] = useState<Record<string, string>>({})
  const [showAddGlobalMed, setShowAddGlobalMed] = useState(false)
  const [globalMedForm, setGlobalMedForm] = useState({
    name: '',
    composition: '',
    manufacturer: '',
    dosageForm: 'Tablet',
    strength: '',
    mrp: '',
    schedule: 'Schedule H',
    uses: '',
  })

  const loadAll = useCallback(async (q = '') => {
    setDataLoading(true)
    setLoadError(null)
    try {
      const [oRes, pRes, iRes, rRes, bRes, mRes] = await Promise.all([
        fetch('/api/platform/organizations'),
        fetch('/api/platform/plans'),
        fetch('/api/platform/inquiries'),
        fetch('/api/referrals?scope=platform'),
        fetch('/api/platform/blog'),
        fetch(`/api/platform/medwiki${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      ])
      if (oRes.status === 401) {
        setAdmin(null)
        return
      }
      if (oRes.ok) setOrgs(await oRes.json())
      if (pRes.ok) setPlans(await pRes.json())
      if (iRes.ok) setInquiries(await iRes.json())
      if (rRes.ok) {
        const rData = await rRes.json()
        setPartners(Array.isArray(rData.partners) ? rData.partners : [])
      }
      if (bRes.ok) setPosts(await bRes.json())
      if (mRes.ok) setMedwiki(await mRes.json())
    } catch {
      setLoadError('Unable to reach Platform Control Plane APIs. Please verify connection and retry.')
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/platform/auth')
      .then((r) => r.json())
      .then((d) => {
        if (d.admin) setAdmin(d.admin)
        setNeedsBootstrap(Boolean(d.needsBootstrap))
      })
      .finally(() => setChecked(true))
  }, [])

  useEffect(() => {
    if (admin) loadAll(debouncedMedQuery)
  }, [admin, debouncedMedQuery, loadAll])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/platform/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: needsBootstrap ? 'bootstrap' : 'login',
          email: loginEmail,
          password: loginPassword,
          name: loginName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Authentication failed')
        return
      }
      setAdmin(data.admin)
      setNeedsBootstrap(false)
      toast.success(`Welcome back, ${data.admin.name}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/platform/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    setAdmin(null)
  }

  async function orgAction(orgId: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(`/api/platform/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Action failed')
      return null
    }
    if (action === 'resetAdminPassword') {
      toast.success(`New password for ${data.email}: ${data.temporaryPassword}`)
    } else if (action === 'customizePlan') {
      toast.success('Dedicated custom plan created — adjust limits in the modal.')
      setEditingPlan(data.plan)
    } else {
      toast.success('Organization updated.')
    }
    await loadAll()
    return data
  }

  async function handleImpersonate(org: OrgRow) {
    const res = await fetch('/api/platform/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: org.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not impersonate clinic')
      return
    }
    toast.success(`Signed in as ${data.user.email} (${org.name})`)
    router.push('/dashboard')
  }

  async function executeDeleteOrg() {
    if (!deleteOrgTarget) return
    setDestructiveBusy(true)
    try {
      const res = await fetch(`/api/platform/organizations/${deleteOrgTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: deleteOrgTarget.name }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Deletion rejected')
        return
      }
      toast.success(`Deleted "${data.deleted}"`)
      setOrgs((prev) => prev.filter((o) => o.id !== deleteOrgTarget.id))
      setDeleteOrgTarget(null)
      await loadAll(debouncedMedQuery)
    } finally {
      setDestructiveBusy(false)
    }
  }

  async function executeDeletePlan() {
    if (!deletePlanTarget) return
    setDestructiveBusy(true)
    try {
      const res = await fetch(`/api/platform/plans?id=${deletePlanTarget.id}`, {
        method: 'DELETE',
      })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.error || 'Delete failed')
        return
      }
      toast.success(`Plan "${deletePlanTarget.name}" deleted`)
      setPlans((prev) => prev.filter((p) => p.id !== deletePlanTarget.id))
      setDeletePlanTarget(null)
      await loadAll(debouncedMedQuery)
    } finally {
      setDestructiveBusy(false)
    }
  }

  async function handleBulkInquiryStatus(newStatus: string) {
    if (selectedInquiries.length === 0) return
    const prev = inquiries
    setInquiries((curr) =>
      curr.map((inq) => (selectedInquiries.includes(inq.id) ? { ...inq, status: newStatus } : inq))
    )
    const ids = [...selectedInquiries]
    setSelectedInquiries([])
    const res = await fetch('/api/platform/inquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulkStatus', ids, status: newStatus }),
    })
    if (!res.ok) {
      setInquiries(prev)
      toast.error('Bulk update failed — rolled back')
      return
    }
    toast.success(`Updated ${ids.length} inquiries to "${newStatus}"`)
  }

  async function executeBulkDeleteInquiries() {
    if (selectedInquiries.length === 0) return
    setDestructiveBusy(true)
    const ids = [...selectedInquiries]
    const prev = inquiries
    setInquiries((curr) => curr.filter((inq) => !ids.includes(inq.id)))
    try {
      const res = await fetch('/api/platform/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulkDelete', ids }),
      })
      if (!res.ok) {
        setInquiries(prev)
        toast.error('Bulk delete failed')
        return
      }
      setSelectedInquiries([])
      setConfirmBulkDeleteInquiries(false)
      toast.success(`Deleted ${ids.length} selected inquiries`)
    } finally {
      setDestructiveBusy(false)
    }
  }

  async function handleApproveReferralLead(leadId: string, partnerId: string, rewardAmountINR: number) {
    const prevPartners = partners
    // Optimistic UI (#1)
    setPartners((curr) =>
      curr.map((p) =>
        p.id === partnerId
          ? {
              ...p,
              convertedCount: p.convertedCount + 1,
              totalEarnedINR: p.totalEarnedINR + rewardAmountINR,
              leads: p.leads.map((l) => (l.id === leadId ? { ...l, status: 'converted' } : l)),
            }
          : p
      )
    )
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approveLead', leadId }),
    })
    if (!res.ok) {
      setPartners(prevPartners)
      toast.error('Failed to approve referral lead')
      return
    }
    toast.success(`Approved referral & credited ₹${rewardAmountINR.toLocaleString('en-IN')} commission!`)
  }

  async function handleCreateClinic(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/platform/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not create clinic')
        return
      }
      setShowCreateClinic(false)
      setClinicForm({
        name: '',
        adminName: '',
        adminEmail: '',
        phone: '',
        city: 'Pune',
        planId: plans[0]?.id || '',
        startMode: 'active_monthly',
      })
      toast.success(
        `Created "${data.organization.name}"! Login: ${data.orgAdmin.email} / ${data.temporaryPassword}`
      )
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPlan) return
    setBusy(true)
    try {
      const isEdit = Boolean(editingPlan.id)
      const res = await fetch('/api/platform/plans', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Plan save failed')
        return
      }
      setEditingPlan(null)
      toast.success(`Plan "${data.name}" saved — live on Landing Page!`)
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePost(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPost) return
    setBusy(true)
    try {
      const isEdit = Boolean(editingPost.id)
      const res = await fetch('/api/platform/blog', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPost),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Blog save failed')
        return
      }
      setEditingPost(null)
      toast.success('Blog post saved.')
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  async function triggerSampleMedwikiSync() {
    setBusy(true)
    try {
      const res = await fetch('/api/platform/medwiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'runSampleDelta' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Sync failed')
        return
      }
      toast.success(
        `MedWiki Sync Complete in ${data.durationMs}ms: ${data.insertedCount} new, ${data.updatedCount} updated!`
      )
      await loadAll(medQuery)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddGlobalMed(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/platform/medwiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSingle',
          medicine: {
            ...globalMedForm,
            mrp: globalMedForm.mrp ? Number(globalMedForm.mrp) : null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save medicine')
        return
      }
      setShowAddGlobalMed(false)
      setGlobalMedForm({
        name: '',
        composition: '',
        manufacturer: '',
        dosageForm: 'Tablet',
        strength: '',
        mrp: '',
        schedule: 'Schedule H',
        uses: '',
      })
      toast.success('Medicine added to Global MedWiki Catalog!')
      await loadAll(medQuery)
    } finally {
      setBusy(false)
    }
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9] text-sm text-slate-500">
        Loading Platform Admin...
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9] p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f8a77] text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Platform Admin</h1>
              <p className="text-xs text-slate-500">AetherMed SaaS Control Plane</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {needsBootstrap && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Name</label>
                <input
                  required
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Platform Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#0f8a77] py-3 text-sm font-bold text-white hover:bg-[#0c7464] disabled:opacity-50 transition"
            >
              {busy ? 'Signing in...' : needsBootstrap ? 'Create Platform Admin' : 'Sign In to Platform Admin'}
            </button>
          </form>

          <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Demo Platform Credentials (Pre-filled):</p>
            <p className="mt-0.5 font-mono">aetherdevsolutions@gmail.com / Admin@123</p>
          </div>

          <div className="mt-4 flex justify-between text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-900">← Landing Page</Link>
            <Link href="/login" className="text-[#0f8a77] font-semibold hover:underline">Hospital Login →</Link>
          </div>
        </div>
      </div>
    )
  }

  const newInquiriesCount = inquiries.filter((i) => i.status === 'new').length

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900">
      {/* Exact Clean Top Bar matching image-1.png */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Platform Admin</h1>
            <p className="text-xs text-slate-500">
              {admin.name} · {admin.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'orgs', label: 'Organizations' },
                { id: 'plans', label: 'Plans' },
                {
                  id: 'inquiries',
                  label: `Inquiries${newInquiriesCount > 0 ? ` (${newInquiriesCount} new)` : ''}`,
                },
                { id: 'referrals', label: `Affiliates (${partners.length})` },
                { id: 'medwiki', label: `MedWiki DB (${medwiki?.totalGlobal ?? 0})` },
                { id: 'blog', label: 'Blog' },
              ] as const
            ).map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-[#0f8a77] text-white shadow-2xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              Public Site <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <ErrorRecoveryBanner error={loadError} onRetry={() => loadAll(debouncedMedQuery)} />

        {dataLoading && orgs.length === 0 && (
          <div className="space-y-4">
            <SkeletonKpiGrid count={4} />
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <SkeletonTableRows rows={5} cols={6} />
            </div>
          </div>
        )}
        {/* ================= TAB 1: ORGANIZATIONS (Exact image-1.png Layout) ================= */}
        {tab === 'orgs' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Organizations ({orgs.length})</h2>
              <button
                type="button"
                onClick={() => {
                  setClinicForm((f) => ({ ...f, planId: f.planId || plans[0]?.id || '' }))
                  setShowCreateClinic(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f8a77] px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-[#0c7464] transition"
              >
                <Plus className="h-4 w-4" /> Create clinic
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">CLINIC</th>
                    <th className="py-3.5 px-4">LOGIN</th>
                    <th className="py-3.5 px-4">PLAN</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4">USAGE</th>
                    <th className="py-3.5 px-4">PERIOD / TRIAL</th>
                    <th className="py-3.5 px-5">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {orgs.map((org) => {
                    const sub = org.subscription
                    const plan = sub?.plan
                    const effStatus = sub?.status || org.status
                    return (
                      <tr key={org.id} className="align-top hover:bg-slate-50/50 transition">
                        {/* CLINIC */}
                        <td className="py-5 px-5 max-w-[220px]">
                          <p className="font-semibold text-slate-900 leading-snug">{org.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400 break-all">{org.slug}</p>
                          {plan && (
                            <div className="mt-1.5">
                              <TierBadge tier={plan.tier} planName={plan.name} status={effStatus} />
                            </div>
                          )}
                        </td>

                        {/* LOGIN */}
                        <td className="py-5 px-4">
                          <p className="text-xs font-medium text-slate-700">
                            {org.adminEmail || 'No admin email'}
                          </p>
                          {org.generatedPassword && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800 border border-slate-200/70">
                              <span>{org.generatedPassword}</span>
                              <button
                                type="button"
                                title="Copy credentials"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${org.adminEmail} / ${org.generatedPassword}`
                                  )
                                  setCopiedId(org.id)
                                  toast.success('Copied login email & password!')
                                  setTimeout(() => setCopiedId(null), 1500)
                                }}
                                className="text-slate-500 hover:text-teal-700"
                              >
                                {copiedId === org.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <ClipboardCopy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* PLAN */}
                        <td className="py-5 px-4">
                          <select
                            value={plan?.id || ''}
                            onChange={(e) =>
                              orgAction(org.id, 'changePlan', { planId: e.target.value })
                            }
                            className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-500 focus:outline-none"
                          >
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* STATUS */}
                        <td className="py-5 px-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              effStatus === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : effStatus === 'trialing'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {effStatus}
                          </span>
                        </td>

                        {/* USAGE */}
                        <td className="py-5 px-4 text-xs text-slate-600 leading-relaxed">
                          <div>
                            {org.usage.doctors}/{plan?.doctorLimit ?? '—'} doctors
                          </div>
                          <div>
                            {org.usage.branches}/{plan?.branchLimit ?? '—'} branches ·
                          </div>
                          <div>
                            {org.usage.staff}/{plan?.staffLimit ?? '—'} staff
                          </div>
                          <div>
                            {org.usage.beds}/{plan?.bedLimit ?? '—'} beds ({org.usage.activeIpd} IPD)
                          </div>
                          <div>{org.usage.patients} patients</div>
                        </td>

                        {/* PERIOD / TRIAL */}
                        <td className="py-5 px-4 text-xs text-slate-600">
                          {effStatus === 'trialing' ? (
                            <div>
                              <p className="text-slate-500">Trial ends</p>
                              <p className="font-medium text-slate-800 mt-0.5">
                                {formatDateDMY(sub?.trialEndsAt)}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-slate-500">Paid until</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-slate-800">
                                  {formatDateDMY(sub?.currentPeriodEnd)}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  {sub?.billingCycle || 'MONTHLY'}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* ACTIONS (Exact pill buttons from image-1.png) */}
                        <td className="py-5 px-5 max-w-[240px]">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMarkPaidOrg(org)
                                setMarkPaidPlanId(plan?.id || plans[0]?.id || '')
                                setMarkPaidCycle(
                                  sub?.billingCycle === 'yearly' ? 'yearly' : 'monthly'
                                )
                              }}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              onClick={() => orgAction(org.id, 'extendTrial', { days: 7 })}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              +7d trial
                            </button>
                            <button
                              type="button"
                              onClick={() => orgAction(org.id, 'suspend')}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {org.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                            <button
                              type="button"
                              onClick={() => orgAction(org.id, 'customizePlan')}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Customize plan
                            </button>
                            <button
                              type="button"
                              onClick={() => orgAction(org.id, 'resetAdminPassword')}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Reset pwd
                            </button>
                            <button
                              type="button"
                              onClick={() => handleImpersonate(org)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:border-teal-400 hover:text-teal-700"
                            >
                              Login as
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteOrgTarget(org)}
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SAAS PLANS ================= */}
        {tab === 'plans' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">SaaS Subscription Plans ({plans.length})</h2>
                <p className="text-xs text-slate-500">
                  Public plans appear automatically on the SaaS Landing Page.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingPlan({
                    name: '',
                    tier: 'basic',
                    doctorLimit: 5,
                    branchLimit: 1,
                    staffLimit: 10,
                    bedLimit: 25,
                    storageLimitMB: 5120,
                    priceMonthly: 2999,
                    priceYearly: 29990,
                    features: { opd: true, ipd: true, medwiki: true, lab: true, customBranding: true },
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f8a77] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c7464]"
              >
                <Plus className="h-4 w-4" /> Create Plan
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-teal-700">
                        {p.isCustom ? 'Dedicated Custom' : p.tier}
                      </span>
                      <span className="text-xs text-slate-400">
                        {p.subscribersCount ?? 0} clinic(s)
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{p.name}</h3>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">
                      ₹{p.priceMonthly.toLocaleString('en-IN')}
                      <span className="text-xs font-normal text-slate-500">
                        /mo · ₹{p.priceYearly.toLocaleString('en-IN')}/yr
                      </span>
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                      <div>Doctors: <strong>{p.doctorLimit}</strong></div>
                      <div>IPD Beds: <strong>{p.bedLimit}</strong></div>
                      <div>Branches: <strong>{p.branchLimit}</strong></div>
                      <div>Staff: <strong>{p.staffLimit}</strong></div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(p)}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit Limits &amp; Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePlanTarget(p)}
                      className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: SALES INQUIRIES (#1, #10, #12, #19) ================= */}
        {tab === 'inquiries' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                Landing Page Demo Inquiries ({inquiries.length})
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(['all', 'new', 'follow_up', 'demo', 'converted', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setInquiryFilter(st)}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      inquiryFilter === st
                        ? 'bg-[#0f8a77] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'all' ? 'All Leads' : st}
                  </button>
                ))}
              </div>
            </div>

            {selectedInquiries.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs">
                <span className="font-bold text-teal-950">
                  {selectedInquiries.length} inquiry lead(s) selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkInquiryStatus('follow_up')}
                    className="rounded-lg bg-white border border-teal-300 px-3 py-1.5 font-semibold text-teal-900 hover:bg-teal-100"
                  >
                    Mark Follow-Up
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkInquiryStatus('demo')}
                    className="rounded-lg bg-white border border-teal-300 px-3 py-1.5 font-semibold text-teal-900 hover:bg-teal-100"
                  >
                    Mark Demo Scheduled
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDeleteInquiries(true)}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInquiries([])}
                    className="text-slate-500 hover:text-slate-800 px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {inquiries.filter((i) => inquiryFilter === 'all' || i.status === inquiryFilter).length === 0 ? (
              <EmptyStateCard
                title="No matching demo inquiries"
                description="Switch the status filter above or submit a test inquiry on the Landing Page."
              />
            ) : (
              <div className="space-y-4">
                {inquiries
                  .filter((i) => inquiryFilter === 'all' || i.status === inquiryFilter)
                  .map((inq) => {
                    const checkedRow = selectedInquiries.includes(inq.id)
                    return (
                      <div
                        key={inq.id}
                        className={`rounded-2xl border bg-white p-5 shadow-2xs transition ${
                          checkedRow ? 'border-teal-400 ring-2 ring-teal-500/15' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checkedRow}
                              onChange={(e) =>
                                setSelectedInquiries((prev) =>
                                  e.target.checked
                                    ? [...prev, inq.id]
                                    : prev.filter((x) => x !== inq.id)
                                )
                              }
                              className="mt-1.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <div>
                              <div className="flex items-center gap-2.5">
                                <h3 className="font-bold text-slate-900 text-base">{inq.clinicName}</h3>
                                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                                  {inq.status}
                                </span>
                                {inq.selectedPlan && (
                                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                                    Plan: {inq.selectedPlan}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-600">
                                <strong>{inq.contactName}</strong> · {inq.email}
                                {inq.phone ? ` · ${inq.phone}` : ''}
                                {inq.city ? ` · ${inq.city}` : ''} · {inq.facilityType}
                              </p>
                              {inq.message && (
                                <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                                  &ldquo;{inq.message}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={inq.status}
                              onChange={async (e) => {
                                const nextStatus = e.target.value
                                // Optimistic status update (#1)
                                setInquiries((curr) =>
                                  curr.map((item) =>
                                    item.id === inq.id ? { ...item, status: nextStatus } : item
                                  )
                                )
                                await fetch('/api/platform/inquiries', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: inq.id, status: nextStatus }),
                                })
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium"
                            >
                              <option value="new">new</option>
                              <option value="follow_up">follow_up</option>
                              <option value="demo">demo</option>
                              <option value="converted">converted</option>
                              <option value="closed">closed</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                setClinicForm({
                                  name: inq.clinicName,
                                  adminName: inq.contactName,
                                  adminEmail: inq.email,
                                  phone: inq.phone || '',
                                  city: inq.city || 'Pune',
                                  planId: plans[1]?.id || plans[0]?.id || '',
                                  startMode: 'trial7',
                                })
                                setTab('orgs')
                                setShowCreateClinic(true)
                              }}
                              className="rounded-lg bg-[#0f8a77] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c7464]"
                            >
                              Convert to Clinic →
                            </button>
                          </div>
                        </div>

                        {/* Follow-up notes */}
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          {inq.followUps.length > 0 && (
                            <div className="mb-2 space-y-1 text-xs text-slate-600">
                              {inq.followUps.map((f) => (
                                <div key={f.id} className="rounded bg-slate-50 px-2.5 py-1">
                                  <strong>{f.date} ({f.by}):</strong> {f.note}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              value={followUpNotes[inq.id] || ''}
                              onChange={(e) =>
                                setFollowUpNotes({ ...followUpNotes, [inq.id]: e.target.value })
                              }
                              placeholder="Add sales follow-up note..."
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const note = (followUpNotes[inq.id] || '').trim()
                                if (!note) return
                                await fetch('/api/platform/inquiries', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: inq.id,
                                    status: inq.status === 'new' ? 'follow_up' : inq.status,
                                    newFollowUpNote: note,
                                  }),
                                })
                                setFollowUpNotes({ ...followUpNotes, [inq.id]: '' })
                                loadAll(debouncedMedQuery)
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3B: AFFILIATES & REFERRALS (#16) ================= */}
        {tab === 'referrals' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Gift className="h-5 w-5 text-[#0f8a77]" />
                  Affiliate Partners &amp; Hospital Referrals ({partners.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Manage recurring 20%–25% partner commissions, track referral link clicks, and approve converted hospitals.
                </p>
              </div>
              <Link
                href="/referrals"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Public Affiliate Portal <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {partners.length === 0 ? (
              <EmptyStateCard
                title="No affiliate partners registered yet"
                description="Partners and hospital admins who enroll via /referrals or their workspace appear here."
              />
            ) : (
              <div className="space-y-4">
                {partners.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                          <span className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-800">
                            {p.referralCode}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            {p.commissionPercent}% Recurring
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {p.companyOrClinic || 'Independent Partner'} · {p.email}
                          {p.city ? ` · ${p.city}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2 text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Link Clicks</div>
                          <div className="text-base font-extrabold text-slate-900">{p.clicksCount}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2 text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Converted</div>
                          <div className="text-base font-extrabold text-teal-700">{p.convertedCount}</div>
                        </div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2 text-center">
                          <div className="text-[10px] uppercase font-bold text-emerald-700">Earned</div>
                          <div className="text-base font-extrabold text-emerald-800">
                            ₹{p.totalEarnedINR.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {p.leads.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Referred Hospital Leads ({p.leads.length})
                        </p>
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60">
                          {p.leads.map((lead) => (
                            <div
                              key={lead.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{lead.referredClinicName}</span>
                                <span className="ml-2 text-slate-500">
                                  {lead.contactName} · {lead.contactPhone} · {lead.planInterested || 'Advance'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">
                                  Reward: ₹{lead.rewardAmountINR.toLocaleString('en-IN')}
                                </span>
                                {lead.status === 'converted' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                                    <CheckCircle2 className="h-3 w-3" /> Credited
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleApproveReferralLead(lead.id, p.id, lead.rewardAmountINR)
                                    }
                                    className="rounded-lg bg-[#0f8a77] px-3 py-1 font-bold text-white hover:bg-[#0c7464]"
                                  >
                                    Approve &amp; Credit ₹{lead.rewardAmountINR.toLocaleString('en-IN')}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: MEDWIKI CONTINUOUS SYNC HUB ================= */}
        {tab === 'medwiki' && medwiki && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                    <Database className="h-3.5 w-3.5" />
                    Global MedWiki Master Formulary
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">
                    Continuous Scraper &amp; Drug Ingestion Pipeline
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 max-w-2xl">
                    Medicines scraped from <code className="font-mono">medwiki.co.in</code> via{' '}
                    <code className="font-mono">medwiki/medwiki_sync.py</code> (Lightpanda CDP / Cron) stream into{' '}
                    <code className="font-mono">{medwiki.webhookEndpoint}</code> and become immediately searchable across every hospital tenant.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={triggerSampleMedwikiSync}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f8a77] px-4 py-2 text-xs font-bold text-white hover:bg-[#0c7464] disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                    Run Live Delta Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddGlobalMed(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Global Medicine
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Global MedWiki Formulations</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">{medwiki.totalGlobal}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Tenant Custom Formulations</p>
                  <p className="mt-1 text-2xl font-extrabold text-teal-700">{medwiki.totalCustom}</p>
                </div>
                <div className="rounded-xl bg-slate-900 p-4 text-slate-200 font-mono text-xs">
                  <p className="text-teal-400 font-semibold flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Lightpanda Sync Command
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-300 break-all">
                    python3 medwiki/medwiki_sync.py --engine lightpanda --batch-size 25
                  </p>
                </div>
              </div>

              {/* Recent Sync Runs */}
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Recent Sync &amp; Ingestion Runs
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Source</th>
                        <th className="py-2 px-3">Batch / Query</th>
                        <th className="py-2 px-3">Inserted</th>
                        <th className="py-2 px-3">Updated</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 px-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {medwiki.recentRuns.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{r.triggerSource}</td>
                          <td className="py-2 px-3 text-slate-600">{r.queryOrTerm || r.mode}</td>
                          <td className="py-2 px-3 text-emerald-700 font-semibold">+{r.insertedCount}</td>
                          <td className="py-2 px-3 text-sky-700">{r.updatedCount}</td>
                          <td className="py-2 px-3 font-mono">{r.durationMs}ms</td>
                          <td className="py-2 px-3 text-slate-400">
                            {new Date(r.startedAt).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Searchable Global Medicine Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-slate-900">Search Global MedWiki Catalog</h3>
                <div className="relative w-72">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={medQuery}
                    onChange={(e) => setMedQuery(e.target.value)}
                    placeholder="Search brand, generic salt, category (debounced)..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Brand Name</th>
                      <th className="py-2.5 px-3">Generic / Salt Composition</th>
                      <th className="py-2.5 px-3">Form &amp; Strength</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">MRP</th>
                      <th className="py-2.5 px-3">Default Freq</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medwiki.medicines.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {m.name}
                          {m.manufacturer && (
                            <div className="text-[11px] font-normal text-slate-400">{m.manufacturer}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{m.composition || m.genericName}</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {m.dosageForm}
                          </span>
                          {m.strength && <span className="ml-1.5 text-slate-500">{m.strength}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-teal-700 font-medium">{m.category}</td>
                        <td className="py-2.5 px-3 font-medium">
                          {m.mrp ? `₹${m.mrp.toFixed(1)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{m.defaultFrequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: BLOG ================= */}
        {tab === 'blog' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Marketing &amp; SEO Blog ({posts.length})</h2>
              <button
                type="button"
                onClick={() =>
                  setEditingPost({
                    title: '',
                    category: 'Hospital SaaS',
                    description: '',
                    body: '',
                    isPublished: true,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f8a77] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c7464]"
              >
                <Plus className="h-4 w-4" /> New Article
              </button>
            </div>
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                      {post.category}
                    </span>
                    <h3 className="mt-2 font-bold text-slate-900">{post.title}</h3>
                    <p className="mt-1 text-xs text-slate-600">{post.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingPost(post)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/platform/blog?id=${post.id}`, { method: 'DELETE' })
                        loadAll()
                      }}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Create Clinic */}
      {showCreateClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Provision New Hospital / Clinic</h3>
              <button type="button" onClick={() => setShowCreateClinic(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateClinic} className="mt-4 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital / Clinic Name *</label>
                <input
                  required
                  value={clinicForm.name}
                  onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
                  placeholder="e.g. City Care Multispecialty Hospital"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Org Admin Name *</label>
                  <input
                    required
                    value={clinicForm.adminName}
                    onChange={(e) => setClinicForm({ ...clinicForm, adminName: e.target.value })}
                    placeholder="Dr. Amit Joshi"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email *</label>
                  <input
                    type="email"
                    required
                    value={clinicForm.adminEmail}
                    onChange={(e) => setClinicForm({ ...clinicForm, adminEmail: e.target.value })}
                    placeholder="admin@citycare.in"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    value={clinicForm.phone}
                    onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })}
                    placeholder="9822012345"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    value={clinicForm.city}
                    onChange={(e) => setClinicForm({ ...clinicForm, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subscription Plan</label>
                  <select
                    value={clinicForm.planId}
                    onChange={(e) => setClinicForm({ ...clinicForm, planId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {plans.filter((p) => !p.isCustom).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.priceMonthly}/mo)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Status</label>
                  <select
                    value={clinicForm.startMode}
                    onChange={(e) => setClinicForm({ ...clinicForm, startMode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="trial7">7-Day Free Trial</option>
                    <option value="trial14">14-Day Free Trial</option>
                    <option value="active_monthly">Active Paid (Monthly)</option>
                    <option value="active_yearly">Active Paid (Yearly)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateClinic(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-[#0f8a77] px-5 py-2 text-xs font-bold text-white hover:bg-[#0c7464]"
                >
                  {busy ? 'Creating...' : 'Create Clinic & Generate Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Mark Paid */}
      {markPaidOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Mark Subscription Paid — {markPaidOrg.name}
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plan</label>
                <select
                  value={markPaidPlanId}
                  onChange={(e) => setMarkPaidPlanId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Cycle</label>
                <select
                  value={markPaidCycle}
                  onChange={(e) => setMarkPaidCycle(e.target.value as 'monthly' | 'yearly')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="monthly">Monthly (+30 days)</option>
                  <option value="yearly">Yearly (+365 days)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setMarkPaidOrg(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await orgAction(markPaidOrg.id, 'markPaid', {
                      planId: markPaidPlanId,
                      billingCycle: markPaidCycle,
                    })
                    setMarkPaidOrg(null)
                  }}
                  className="rounded-xl bg-[#0f8a77] px-5 py-2 text-xs font-bold text-white"
                >
                  Confirm Paid &amp; Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Plan */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingPlan.id ? `Edit Plan: ${editingPlan.name}` : 'Create SaaS Plan'}
              </h3>
              <button type="button" onClick={() => setEditingPlan(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePlan} className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name *</label>
                <input
                  required
                  value={editingPlan.name || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Price (₹)</label>
                <input
                  type="number"
                  required
                  value={editingPlan.priceMonthly ?? 1999}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, priceMonthly: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Yearly Price (₹)</label>
                <input
                  type="number"
                  required
                  value={editingPlan.priceYearly ?? 19990}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, priceYearly: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Doctors Limit</label>
                <input
                  type="number"
                  value={editingPlan.doctorLimit ?? 3}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, doctorLimit: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">IPD Beds Limit</label>
                <input
                  type="number"
                  value={editingPlan.bedLimit ?? 15}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, bedLimit: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branches Limit</label>
                <input
                  type="number"
                  value={editingPlan.branchLimit ?? 1}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, branchLimit: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Limit</label>
                <input
                  type="number"
                  value={editingPlan.staffLimit ?? 5}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, staffLimit: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-[#0f8a77] px-5 py-2 text-xs font-bold text-white"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Global MedWiki Medicine */}
      {showAddGlobalMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Formulation to Global MedWiki Catalog</h3>
              <button type="button" onClick={() => setShowAddGlobalMed(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddGlobalMed} className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
                <input
                  required
                  value={globalMedForm.name}
                  onChange={(e) => setGlobalMedForm({ ...globalMedForm, name: e.target.value })}
                  placeholder="e.g. Cefotax 1g Injection"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Salt Composition *</label>
                <input
                  required
                  value={globalMedForm.composition}
                  onChange={(e) => setGlobalMedForm({ ...globalMedForm, composition: e.target.value })}
                  placeholder="e.g. Cefotaxime (1000mg)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dosage Form</label>
                <select
                  value={globalMedForm.dosageForm}
                  onChange={(e) => setGlobalMedForm({ ...globalMedForm, dosageForm: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option>Tablet</option>
                  <option>Capsule</option>
                  <option>Syrup</option>
                  <option>Suspension</option>
                  <option>Injection</option>
                  <option>Infusion</option>
                  <option>Inhaler</option>
                  <option>Eye Drop</option>
                  <option>Cream</option>
                  <option>Ointment</option>
                  <option>Powder</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="0.1"
                  value={globalMedForm.mrp}
                  onChange={(e) => setGlobalMedForm({ ...globalMedForm, mrp: e.target.value })}
                  placeholder="48.5"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                <input
                  value={globalMedForm.manufacturer}
                  onChange={(e) => setGlobalMedForm({ ...globalMedForm, manufacturer: e.target.value })}
                  placeholder="Cipla Ltd / Sun Pharma"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGlobalMed(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0f8a77] px-5 py-2 text-xs font-bold text-white"
                >
                  Normalize &amp; Save Globally
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Blog Editor */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {editingPost.id ? 'Edit Blog Post' : 'Create Blog Post'}
            </h3>
            <form onSubmit={handleSavePost} className="mt-4 space-y-3 text-sm">
              <input
                required
                placeholder="Article Title"
                value={editingPost.title || ''}
                onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                required
                placeholder="Short SEO Description"
                value={editingPost.description || ''}
                onChange={(e) => setEditingPost({ ...editingPost, description: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <textarea
                rows={6}
                required
                placeholder="Article body..."
                value={editingPost.body || ''}
                onChange={(e) => setEditingPost({ ...editingPost, body: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0f8a77] px-5 py-2 text-xs font-bold text-white"
                >
                  Publish Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* #19 DESTRUCTIVE ACTION PROTECTION MODALS */}
      <ConfirmDestructiveModal
        open={Boolean(deleteOrgTarget)}
        title={`Delete Tenant "${deleteOrgTarget?.name || ''}"?`}
        description={`This permanently removes "${deleteOrgTarget?.name || ''}" along with ${
          deleteOrgTarget?.usage.patients ?? 0
        } patient record(s), IPD admissions, prescriptions, and GST invoices.`}
        confirmText="Multi-tenant isolation ensures no other hospital is affected, but this tenant's clinical records cannot be recovered."
        requireExactMatch={deleteOrgTarget?.name}
        confirmButtonLabel="Permanently Delete Clinic"
        busy={destructiveBusy}
        onConfirm={executeDeleteOrg}
        onCancel={() => setDeleteOrgTarget(null)}
      />

      <ConfirmDestructiveModal
        open={Boolean(deletePlanTarget)}
        title={`Delete SaaS Plan "${deletePlanTarget?.name || ''}"?`}
        description="Removing a public plan hides it from the SaaS Landing Page immediately. Existing subscribed hospitals cannot have their active plan deleted."
        confirmButtonLabel="Delete Plan"
        busy={destructiveBusy}
        onConfirm={executeDeletePlan}
        onCancel={() => setDeletePlanTarget(null)}
      />

      <ConfirmDestructiveModal
        open={confirmBulkDeleteInquiries}
        title={`Delete ${selectedInquiries.length} Selected Inquiries?`}
        description="Selected demo requests and their sales follow-up notes will be permanently removed from the Platform Admin queue."
        confirmButtonLabel={`Delete ${selectedInquiries.length} Inquiries`}
        busy={destructiveBusy}
        onConfirm={executeBulkDeleteInquiries}
        onCancel={() => setConfirmBulkDeleteInquiries(false)}
      />

      {/* #20 NETWORK RECOVERY BANNER */}
      <NetworkRecoveryBanner
        isOnline={isOnline}
        justRecovered={justRecovered}
        onDismiss={dismissRecovery}
      />
    </div>
  )
}
