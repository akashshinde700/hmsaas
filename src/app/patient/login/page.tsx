'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, Lock, ArrowRight, ArrowLeft, ShieldCheck, HeartPulse, Mail } from 'lucide-react'

export default function PatientLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/patient/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.')
        setLoading(false)
        return
      }
      router.push('/patient/dashboard')
    } catch {
      setError('Network error. Please check your connection.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-100 px-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-teal-600 text-white mb-4 shadow-lg shadow-teal-200/50">
            <HeartPulse className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Patient Portal
          </h1>
          <p className="text-slate-600 mt-1">
            Access your medical records, prescriptions & appointments
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/60 text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-teal-400 dark:focus:bg-slate-700"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/60 text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-teal-400 dark:focus:bg-slate-700"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Default password: <span className="font-mono text-teal-600 dark:text-teal-400">patient123</span>
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phone || !password}
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white transition disabled:opacity-50 ${
                !loading
                  ? 'bg-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-200/40'
                  : 'bg-slate-300'
              }`}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Sign In to Portal
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Don't have portal access? Ask your hospital reception to register your mobile number.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">HIPAA-style encrypted portal</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Hospital Staff Login
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <Mail className="h-3 w-3" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
