'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { ArrowRight, Building2, HeartPulse, ShieldCheck, Stethoscope } from 'lucide-react'
import { PwaInstallButton } from '@/components/pwa/PwaInstall'
import { toast } from 'sonner'

export default function TenantLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@sahyadrihospitalpune.in')
  const [password, setPassword] = useState('Sahyadri@123')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) router.replace('/dashboard')
      })
      .catch(() => {})
  }, [router])

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed')
        return
      }
      toast.success(`Signed in to ${data.user.organizationName}`)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50/40 to-slate-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-12"
      >
        {/* Left Clinical Brand Panel */}
        <div className="bg-slate-900 text-white p-8 lg:col-span-5 flex flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-white">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <p className="font-extrabold tracking-tight">AetherMed Cloud HMS</p>
                <p className="text-[11px] text-teal-300">OPD · IPD · MedWiki Pharmacy</p>
              </div>
            </Link>

            <h2 className="mt-8 text-2xl font-extrabold leading-snug">
              Fast Clinical Workspace for Doctors, Nurses &amp; Reception.
            </h2>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              Multi-tenant isolated hospital workspace with live OPD token queue, 30-second Smart Rx, ICTHospital-grade IPD bed board, and instant discharge summaries.
            </p>
          </div>

          <div className="mt-8 space-y-2.5 text-xs">
            <p className="font-bold uppercase tracking-wider text-teal-300">
              1-Click Demo Hospital Accounts:
            </p>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@sahyadrihospitalpune.in')
                setPassword('Sahyadri@123')
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-left hover:border-teal-400 transition"
            >
              <div className="flex items-center justify-between font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-teal-400" />
                  Sahyadri Multispecialty (OPD + IPD)
                </span>
                <span className="text-[10px] text-teal-300">Fill →</span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                admin@sahyadrihospitalpune.in / Sahyadri@123
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail('admin@arogyacarekharadi.in')
                setPassword('Arogya@123')
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-left hover:border-teal-400 transition"
            >
              <div className="flex items-center justify-between font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-sky-400" />
                  Arogya Care Polyclinic Kharadi
                </span>
                <span className="text-[10px] text-sky-300">Fill →</span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                admin@arogyacarekharadi.in / Arogya@123
              </p>
            </button>
          </div>
        </div>

        {/* Right Sign-In Form */}
        <div className="p-8 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Hospital Staff Login</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Sign in with your clinic email to access OPD, IPD &amp; Billing.
                </p>
              </div>
              <PwaInstallButton compact />
            </div>

            <form onSubmit={submitLogin} className="mt-7 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {loading ? 'Signing in...' : 'Sign In to Hospital Workspace'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-800">
              ← Back to SaaS Plans &amp; Home
            </Link>
            <Link
              href="/platform-admin"
              className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> SaaS Platform Admin
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
