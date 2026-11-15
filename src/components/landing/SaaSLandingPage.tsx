'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Globe,
  HeartPulse,
  Layers,
  Lock,
  PhoneCall,
  Pill,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react'
import { PwaInstallButton } from '@/components/pwa/PwaInstall'
import { useAutosaveDraft, useThrottledCallback } from '@/hooks/useSaaSUX'
import { AutosaveBadge, SmartValidatedInput } from '@/components/saas-ux/SaaSUXPrimitives'
import { toast } from 'sonner'

interface PublicPlan {
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
  features: Record<string, boolean>
}

const MODULES = [
  {
    icon: Stethoscope,
    badge: 'OPD Workflow',
    title: '30-Second Smart Prescription & Token Queue',
    desc: 'Live reception token queue, nurse vitals station, doctor dosing memory, Schedule H/H1 alerts, and English/Hindi/Marathi printouts.',
    accent: 'from-teal-500 to-emerald-600',
  },
  {
    icon: BedDouble,
    badge: 'ICTHospital-Grade IPD',
    title: 'Live Ward Bed Board, Admissions & Discharges',
    desc: 'Transactional single-bed occupancy across General, Semi-Private, Deluxe & ICU wards. Bed transfers, nursing rounds, MAR drug charts & NABH discharge summaries.',
    accent: 'from-sky-500 to-blue-600',
  },
  {
    icon: Pill,
    badge: 'Lightpanda + MedWiki Sync',
    title: 'Continuous Dynamic Medicine Intelligence',
    desc: 'Automated molecule & brand sync extracts salt composition, strength, route, MRP & standard dosage into a sub-5ms searchable formulary.',
    accent: 'from-violet-500 to-purple-600',
  },
  {
    icon: Receipt,
    badge: 'Unified Revenue',
    title: 'Running IPD Ledger, Deposits & GST Billing',
    desc: 'Real-time daily room & nursing accrual, OT/procedure charges, ICTHospital-style advance deposit receipts, and 1-click final bill settlement.',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    icon: Building2,
    badge: 'Multi-Tenant SaaS',
    title: 'Isolated Clinics, Multi-Branch & White-Label',
    desc: 'Strict Prisma tenant isolation guard. Each hospital gets its own UHID sequence, custom letterhead, UPI/bank details, and role-based access.',
    accent: 'from-emerald-500 to-teal-700',
  },
  {
    icon: Zap,
    badge: 'PWA + Sub-10ms API',
    title: 'Installable App on Desktop, iPad & Android',
    desc: 'Works full-screen at reception desks and ICU nursing stations with hot LRU caching and instant keyboard-first navigation.',
    accent: 'from-rose-500 to-pink-600',
  },
]

const FAQS = [
  {
    q: 'Does AetherMed handle both OPD clinics and multi-bed IPD hospitals?',
    a: 'Yes. Single-doctor polyclinics can start on the Basic plan with OPD Queue, Smart Rx & Billing, while nursing homes and multispecialty hospitals get full IPD Ward Bed Boards, Advance Deposits, Nursing/Doctor Rounds, MAR charts, and Discharge Summaries.',
  },
  {
    q: 'How does the MedWiki medicine database stay updated automatically?',
    a: 'Our continuous MedWiki sync worker (powered by Lightpanda headless CDP / webhook ingestion at /api/medicines/sync) normalizes brand names, salt compositions, strengths, MRP, and dosage forms directly into the shared global formulary without creating duplicates.',
  },
  {
    q: 'Is each hospital’s patient data isolated and private?',
    a: 'Every database query passes through a Prisma Multi-Tenant Isolation Guard scoped to your organizationId. No clinic can ever view or collide with another clinic’s patients, UHIDs, beds, or invoices.',
  },
  {
    q: 'Can doctors prescribe in Marathi, Hindi, and English?',
    a: 'Yes. The Smart Prescription Pad includes 1-click dietary and clinical instructions in English, हिंदी, and मराठी, plus automatic learning of each doctor’s preferred dosage and timing.',
  },
]

export default function SaaSLandingPage({ initialPlans }: { initialPlans: PublicPlan[] }) {
  const [plans, setPlans] = useState<PublicPlan[]>(initialPlans)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    clinicName: '',
    contactName: '',
    email: '',
    phone: '',
    city: 'Pune',
    facilityType: 'Hospital (OPD + IPD)',
    bedsCount: '30 Beds',
    selectedPlan: initialPlans[1]?.name || 'Advance Hospital',
    message: '',
  })

  const inquiryDraft = useAutosaveDraft(
    'aethermed:landing_inquiry_draft',
    form,
    Boolean(form.clinicName || form.contactName || form.email || form.phone)
  )

  useEffect(() => {
    if (plans.length === 0) {
      fetch('/api/public/plans')
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          if (Array.isArray(d) && d.length > 0) setPlans(d)
        })
        .catch(() => {})
    }
    // Track affiliate referral visit if ?ref=CODE is present
    const params = new URLSearchParams(window.location.search)
    const refCode = params.get('ref')
    if (refCode) {
      setForm((prev) => ({
        ...prev,
        message: prev.message || `Referred via Partner Code: ${refCode.toUpperCase()}`,
      }))
      fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trackClick', referralCode: refCode }),
      }).catch(() => {})
    }
  }, [plans.length])

  const [submitInquiryThrottled, coolingDown] = useThrottledCallback(async () => {
    if (!form.clinicName.trim() || !form.contactName.trim() || !form.email.trim()) {
      toast.error('Please enter your hospital/clinic name, your name, and email.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not submit inquiry')
        return
      }
      inquiryDraft.clearDraft()
      setSubmitted(true)
      toast.success('Demo request received! Our onboarding team will reach out shortly.')
    } finally {
      setSubmitting(false)
    }
  }, 1200)

  function handleInquirySubmit(e: React.FormEvent) {
    e.preventDefault()
    submitInquiryThrottled()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-sm shadow-teal-600/20">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                AetherMed <span className="text-teal-600">Cloud</span>
              </span>
              <p className="text-[11px] font-medium text-slate-500">by AetherDev Solutions</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#modules" className="hover:text-teal-600 transition">OPD &amp; IPD</a>
            <a href="#medwiki" className="hover:text-teal-600 transition">MedWiki Engine</a>
            <a href="#pricing" className="hover:text-teal-600 transition">SaaS Plans</a>
            <Link href="/referrals" className="text-teal-700 font-semibold hover:text-teal-800 transition">
              Affiliate (20%)
            </Link>
            <Link href="/blog" className="hover:text-teal-600 transition">Insights</Link>
            <a href="#demo" className="hover:text-teal-600 transition">Book Demo</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <PwaInstallButton compact />
            <Link
              href="/platform-admin"
              className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex transition"
            >
              Platform Admin
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
            >
              Hospital Login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-teal-50/40 to-slate-50 pt-14 pb-20 lg:pt-20 lg:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-800">
                <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                Unified OPD + IPD + Continuous MedWiki Drug SaaS · Built on Next.js & Prisma
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.12]">
                Run Your Entire{' '}
                <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                  OPD, IPD Wards & Pharmacy
                </span>{' '}
                in One Fast Cloud Platform.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Replace fragmented desktop software, paper bed boards, and slow prescription tools.
                AetherMed gives clinics and multispecialty hospitals sub-10ms medicine search, live
                ICU/Ward bed occupancy, advance deposit tracking, and instant discharge summaries.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition"
                >
                  Start 7-Day Free Hospital Trial
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                >
                  Explore Live OPD + IPD Demo
                </Link>
                <Link
                  href="/platform-admin"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3.5 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition"
                >
                  Open SaaS Platform Admin
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-6 sm:max-w-xl">
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">&lt;8 ms</p>
                  <p className="text-xs font-medium text-slate-500">Hot API Response Time</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-teal-600">OPD + IPD</p>
                  <p className="text-xs font-medium text-slate-500">Transactional Bed Board</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">100% SaaS</p>
                  <p className="text-xs font-medium text-slate-500">Multi-Tenant & White-Label</p>
                </div>
              </div>
            </motion.div>

            {/* Interactive Live Hospital Preview Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-5"
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Live Hospital Command Snapshot
                    </span>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                    PWA Ready
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>OPD Queue Today</span>
                      <Activity className="h-4 w-4 text-teal-600" />
                    </div>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">42 Tokens</p>
                    <p className="mt-0.5 text-[11px] text-emerald-600 font-medium">Avg wait 6 mins</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>IPD Bed Occupancy</span>
                      <BedDouble className="h-4 w-4 text-sky-600" />
                    </div>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">14 / 16 Beds</p>
                    <p className="mt-0.5 text-[11px] text-sky-600 font-medium">ICU-01, PVT-301 Active</p>
                  </div>
                </div>

                {/* Mini Bed Board Visual */}
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2.5">
                    <span>Real-Time Ward & ICU Bed Matrix</span>
                    <span className="text-[11px] text-slate-500">Auto-synced on Discharge</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
                    <div className="rounded-lg border border-rose-200 bg-rose-50 py-2 text-rose-700">
                      ICU-01
                      <div className="text-[9px] font-normal">Occupied</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-emerald-700">
                      ICU-02
                      <div className="text-[9px] font-normal">Free Bed</div>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 py-2 text-rose-700">
                      PVT-301
                      <div className="text-[9px] font-normal">Occupied</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-emerald-700">
                      GEN-101
                      <div className="text-[9px] font-normal">Free Bed</div>
                    </div>
                  </div>
                </div>

                {/* Mini MedWiki Search Preview */}
                <div className="mt-4 rounded-xl border border-teal-200/70 bg-teal-50/40 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-900 flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-teal-600" />
                      MedWiki Smart Rx Autocomplete
                    </span>
                    <span className="text-[10px] font-mono text-teal-700">2.1 ms</span>
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-2xs border border-teal-100">
                      <div>
                        <span className="font-semibold text-slate-800">Augmentin 625 Duo</span>
                        <span className="ml-2 text-[11px] text-slate-500">Amoxycillin + Clavulanic Acid</span>
                      </div>
                      <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">1-0-1 · 5d</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-2xs border border-teal-100">
                      <div>
                        <span className="font-semibold text-slate-800">Tazact 4.5gm Inj</span>
                        <span className="ml-2 text-[11px] text-slate-500">Piperacillin + Tazobactam</span>
                      </div>
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">IV · TDS</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Modules Bento Grid */}
      <section id="modules" className="py-20 bg-white border-y border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-600">Complete Clinical & Financial OS</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Everything a Modern Clinic or Multi-Bed Hospital Needs
            </h2>
            <p className="mt-3 text-slate-600">
              Engineered from the ground up with Prisma ORM, Next.js App Router, and real-world Indian OPD + IPD workflows.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, idx) => {
              const Icon = m.icon
              return (
                <motion.div
                  key={m.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.05 }}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 hover:bg-white hover:shadow-lg hover:border-teal-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${m.accent} text-white shadow-sm`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {m.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-teal-700 transition">
                    {m.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* MedWiki Continuous Sync Architecture Highlight */}
      <section id="medwiki" className="py-18 bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 ring-1 ring-teal-400/30">
                <Database className="h-3.5 w-3.5" />
                Continuous MedWiki Drug Pipeline + Lightpanda Browser CDP
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Always-Fresh Pharmaceutical Formulary Across Every Tenant Clinic
              </h2>
              <p className="mt-4 text-slate-300 leading-relaxed">
                Your MedWiki scraper connects via Lightpanda headless CDP (11x faster &amp; 90% lower memory than Chrome) and streams normalized molecules &amp; brands straight to <code className="rounded bg-slate-800 px-1.5 py-0.5 text-teal-300">/api/medicines/sync</code>.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm text-slate-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                  <span>Compound deduplication by brand + salt + manufacturer + strength + form</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                  <span>27 dosage forms mapped automatically to route, dose &amp; 1-0-1 frequency</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                  <span>Global catalog shared with all clinics + isolated custom clinic formulary</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                  <span>Per-doctor dosage memory ranks frequently prescribed brands first</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-950 p-5 font-mono text-xs text-slate-300 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-[11px] text-slate-400">
                <span>Continuous Sync Flow</span>
                <span className="text-emerald-400">● Active Pipeline</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
                  <p className="text-teal-400 font-semibold">1. Lightpanda CDP Scraper</p>
                  <p className="mt-1 text-slate-400">medwiki_sync.py --engine lightpanda --batch-size 25</p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
                  <p className="text-sky-400 font-semibold">2. Webhook Upsert &amp; Normalization</p>
                  <p className="mt-1 text-slate-400">POST /api/medicines/sync → Prisma Medicine + MedwikiSyncRun</p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
                  <p className="text-emerald-400 font-semibold">3. Sub-5ms OPD Rx &amp; IPD MAR Search</p>
                  <p className="mt-1 text-slate-400">Hot LRU cache + DoctorMedicineDefault ranking</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic SaaS Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-600">Transparent SaaS Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Flexible Plans for Polyclinics, Nursing Homes &amp; Multispecialty Hospitals
            </h2>
            <p className="mt-3 text-slate-600">
              100% database-driven plans managed live from Platform Admin. Every plan includes a 7-day free trial with your real hospital workflow.
            </p>

            {/* Monthly / Yearly Toggle */}
            <div className="mt-7 inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                  billingCycle === 'monthly' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                  billingCycle === 'yearly' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearly Billing <span className="ml-1 text-[10px] opacity-90">(2 Months Free)</span>
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-7 lg:grid-cols-3">
            {plans.map((plan) => {
              const popular = plan.tier === 'advance'
              const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly
              const f = plan.features || {}
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                    popular
                      ? 'border-teal-500 bg-white shadow-xl shadow-teal-900/5 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-3 right-6 rounded-full bg-teal-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                      Most Popular for Hospitals
                    </span>
                  )}

                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                      {plan.tier} tier
                    </p>
                  </div>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>

                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Up to <strong>{plan.doctorLimit}</strong> Consulting Doctors</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Up to <strong>{plan.bedLimit}</strong> IPD / Daycare Beds</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>
                        <strong>{plan.branchLimit >= 99 ? 'Unlimited' : plan.branchLimit}</strong>{' '}
                        Hospital Branch{plan.branchLimit === 1 ? '' : 'es'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span><strong>{plan.staffLimit}</strong> Nursing / Reception / Billing Staff</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>OPD Queue, Smart Rx &amp; Live MedWiki Formulary</span>
                    </li>
                    {f.ipd !== false && (
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                        <span>Live IPD Ward Bed Board, MAR &amp; Discharge Summary</span>
                      </li>
                    )}
                    {f.customBranding && (
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                        <span>Custom Hospital Letterhead, GST &amp; UPI QR Print</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>{Math.round(plan.storageLimitMB / 1024)} GB Cloud Record Storage</span>
                    </li>
                  </ul>

                  <a
                    href="#demo"
                    onClick={() => setForm((prev) => ({ ...prev, selectedPlan: plan.name }))}
                    className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-bold transition ${
                      popular
                        ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    Start 7-Day Free Trial
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Book Demo / Clinic Onboarding Inquiry Section */}
      <section id="demo" className="py-20 bg-white border-t border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 border border-teal-200">
                <Clock className="h-3.5 w-3.5" />
                Go Live in Under 15 Minutes
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                Request a Personalized Hospital or Clinic Demo
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Submit your hospital details below. Every inquiry goes straight to our SaaS Platform Admin desk so we can provision your dedicated tenant workspace with pre-configured OPD &amp; IPD wards.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <ShieldCheck className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Zero Lock-In · 100% Data Ownership</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Strict multi-tenant isolation with full patient, invoice, and clinical record export anytime.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Layers className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Instant Demo Access Right Now</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Want to explore immediately? Sign in with 1-click demo credentials on the{' '}
                      <Link href="/login" className="font-semibold text-teal-700 underline">
                        Hospital Login
                      </Link>{' '}
                      or{' '}
                      <Link href="/platform-admin" className="font-semibold text-teal-700 underline">
                        Platform Admin
                      </Link>{' '}
                      page.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 pt-2">
                  <PhoneCall className="h-4 w-4 text-teal-600" />
                  <span>AetherDev Solutions · Hinjawadi, Pune, Maharashtra · +91 86000 98315</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 shadow-sm">
              {submitted ? (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-slate-900">Inquiry Submitted Successfully!</h3>
                  <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                    Your inquiry is now live inside the <strong>Platform Admin → Inquiries</strong> queue. Our team will contact you to activate your 7-day trial.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-6 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pb-1">
                    <span className="text-xs font-bold text-slate-600">
                      Instant Demo &amp; 7-Day Cloud Sandbox Request
                    </span>
                    <AutosaveBadge
                      status={inquiryDraft.status}
                      lastSavedAt={inquiryDraft.lastSavedAt}
                      hasRestoredDraft={inquiryDraft.hasRestoredDraft}
                      onRestore={() => {
                        const saved = inquiryDraft.loadSavedDraft()
                        if (saved) {
                          setForm(saved)
                          toast.success('Restored your unsaved inquiry draft')
                        }
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <SmartValidatedInput
                      label="Hospital / Clinic Name"
                      required
                      rules={['required']}
                      value={form.clinicName}
                      onChange={(val) => setForm({ ...form, clinicName: val })}
                      placeholder="e.g. Lifeline Multispecialty Hospital"
                    />
                  </div>
                  <div>
                    <SmartValidatedInput
                      label="Doctor / Administrator Name"
                      required
                      rules={['required']}
                      value={form.contactName}
                      onChange={(val) => setForm({ ...form, contactName: val })}
                      placeholder="Dr. Rajesh Kulkarni"
                    />
                  </div>
                  <div>
                    <SmartValidatedInput
                      label="Work Email"
                      type="email"
                      required
                      rules={['required', 'email']}
                      value={form.email}
                      onChange={(val) => setForm({ ...form, email: val })}
                      placeholder="admin@lifelinehospital.in"
                    />
                  </div>
                  <div>
                    <SmartValidatedInput
                      label="Phone / WhatsApp"
                      rules={['indian_phone']}
                      value={form.phone}
                      onChange={(val) => setForm({ ...form, phone: val })}
                      placeholder="+91 98220 XXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Pune, Mumbai, Nashik..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Facility Type
                    </label>
                    <select
                      value={form.facilityType}
                      onChange={(e) => setForm({ ...form, facilityType: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                    >
                      <option>Hospital (OPD + IPD)</option>
                      <option>Multispecialty ICU Hospital</option>
                      <option>OPD Polyclinic / Daycare</option>
                      <option>Pediatric / Maternity Nursing Home</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Interested SaaS Plan
                    </label>
                    <select
                      value={form.selectedPlan}
                      onChange={(e) => setForm({ ...form, selectedPlan: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} (₹{p.priceMonthly.toLocaleString('en-IN')}/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Workflow Requirements (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Number of doctors, IPD wards/beds, existing data migration needs..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={submitting || coolingDown}
                      className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition"
                    >
                      {submitting ? 'Submitting Request...' : 'Book Demo & Activate 7-Day Trial'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-slate-50 border-t border-slate-200/70">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-slate-400 text-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
              <HeartPulse className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-white">AetherMed Cloud HMS</p>
              <p className="text-xs text-slate-500">Engineered by AetherDev Solutions · Pune, India</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <Link href="/referrals" className="text-teal-400 hover:text-white transition">
              Partner &amp; Affiliate Program (20%)
            </Link>
            <Link href="/login" className="hover:text-white transition flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Hospital Portal
            </Link>
            <Link href="/platform-admin" className="hover:text-white transition flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> Platform Admin
            </Link>
            <Link href="/blog" className="hover:text-white transition flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Clinical Blog
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
