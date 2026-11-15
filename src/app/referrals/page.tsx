'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Gift,
  HeartPulse,
  IndianRupee,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { SmartValidatedInput } from '@/components/saas-ux/SaaSUXPrimitives'

export default function PublicReferralsAffiliatePage() {
  const [referredHospitals, setReferredHospitals] = useState(10)
  const [avgPlanMonthly, setAvgPlanMonthly] = useState(4999)
  const [partner, setPartner] = useState<{
    name: string
    referralCode: string
    commissionPercent: number
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    companyOrClinic: '',
    city: 'Pune',
    upiOrBankDetails: '',
  })

  const monthlyCommission = Math.round(referredHospitals * avgPlanMonthly * 0.2)
  const annualCommission = monthlyCommission * 12

  async function handleJoinAffiliate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'registerPartner', ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Registration failed')
        return
      }
      setPartner(data.partner)
      toast.success(`Partner account ready! Code: ${data.partner.referralCode}`)
    } finally {
      setBusy(false)
    }
  }

  const shareUrl =
    typeof window !== 'undefined' && partner
      ? `${window.location.origin}/?ref=${partner.referralCode}`
      : ''

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900">AetherMed Partner Program</span>
              <p className="text-[11px] text-slate-500">Healthcare SaaS Affiliate &amp; Referral Hub</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Hospital Login
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to SaaS Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-12">
        {/* Hero + Interactive Commission Calculator */}
        <div className="grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1 text-xs font-bold text-teal-800">
              <Gift className="h-3.5 w-3.5 text-teal-600" />
              20% Recurring Revenue Share · Instant UPI Payouts
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Partner With India&apos;s Fastest{' '}
              <span className="text-teal-600">OPD + IPD Cloud HMS</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Built for Healthcare IT consultants, pharma distributors, medical equipment dealers, and doctors. Refer clinics or multi-bed hospitals to AetherMed and earn <strong>20% recurring SaaS commission</strong> on every subscription renewal.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <Sparkles className="h-5 w-5 text-teal-600" />
                <p className="mt-2 font-bold text-slate-900">Instant Unique Code</p>
                <p className="text-slate-500 mt-0.5">Generate your trackable partner link in 10 seconds.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <p className="mt-2 font-bold text-slate-900">20% Recurring</p>
                <p className="text-slate-500 mt-0.5">Earn every month &amp; year the hospital stays active.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <IndianRupee className="h-5 w-5 text-sky-600" />
                <p className="mt-2 font-bold text-slate-900">Direct UPI / NEFT</p>
                <p className="text-slate-500 mt-0.5">Transparent conversion tracking inside Platform Admin.</p>
              </div>
            </div>
          </div>

          {/* Interactive SaaS Affiliate Calculator */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-slate-900 p-7 text-white shadow-xl">
            <h2 className="text-lg font-extrabold">Recurring Earnings Calculator</h2>
            <p className="text-xs text-slate-400 mt-1">
              Slide to estimate your recurring partner income at 20% revenue share:
            </p>

            <div className="mt-6 space-y-5 text-xs">
              <div>
                <div className="flex justify-between font-bold">
                  <span>Active Referred Hospitals</span>
                  <span className="text-teal-400 text-base">{referredHospitals} Hospitals</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={referredHospitals}
                  onChange={(e) => setReferredHospitals(Number(e.target.value))}
                  className="mt-2 w-full accent-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1.5">Average Hospital SaaS Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Basic', price: 1999 },
                    { label: 'Advance', price: 4999 },
                    { label: 'Enterprise', price: 9999 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setAvgPlanMonthly(p.price)}
                      className={`rounded-xl py-2 font-bold transition ${
                        avgPlanMonthly === p.price
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                      <div className="text-[10px] opacity-80">₹{p.price}/mo</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Monthly Partner Payout</span>
                  <span className="font-bold text-white text-base">
                    ₹{monthlyCommission.toLocaleString('en-IN')}/mo
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-teal-300 font-semibold">Annual Recurring Income</span>
                  <span className="text-2xl font-extrabold text-emerald-400">
                    ₹{annualCommission.toLocaleString('en-IN')}/yr
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instant Partner Registration Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-10 shadow-sm">
          {partner ? (
            <div className="text-center max-w-lg mx-auto py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-2xl font-extrabold text-slate-900">
                Welcome Aboard, {partner.name}!
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Share your unique referral link below. Every demo booked via this link automatically attributes 20% commission to your partner code.
              </p>

              <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
                <p className="text-xs font-bold text-teal-800">
                  Partner Code: <span className="font-mono text-base">{partner.referralCode}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-xl border border-teal-200 bg-white px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl)
                      setCopied(true)
                      toast.success('Referral link copied!')
                      setTimeout(() => setCopied(false), 1800)
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-extrabold text-slate-900 text-center">
                Generate Your Instant Affiliate Code
              </h2>
              <p className="text-xs text-slate-500 text-center mt-1">
                Free to join — instant approval with real-time payout tracking.
              </p>

              <form onSubmit={handleJoinAffiliate} className="mt-6 grid gap-4 sm:grid-cols-2">
                <SmartValidatedInput
                  label="Full Name"
                  required
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="Rohan Deshpande"
                />
                <SmartValidatedInput
                  label="Work Email"
                  required
                  rules={['email']}
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="rohan@medtechpune.in"
                />
                <SmartValidatedInput
                  label="Mobile / WhatsApp"
                  required
                  rules={['indian_phone']}
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="98220XXXXX"
                />
                <SmartValidatedInput
                  label="Agency / Company / Clinic"
                  value={form.companyOrClinic}
                  onChange={(v) => setForm({ ...form, companyOrClinic: v })}
                  placeholder="MedTech Solutions"
                />
                <SmartValidatedInput
                  label="City"
                  value={form.city}
                  onChange={(v) => setForm({ ...form, city: v })}
                />
                <SmartValidatedInput
                  label="UPI ID for Commission Payouts"
                  value={form.upiOrBankDetails}
                  onChange={(v) => setForm({ ...form, upiOrBankDetails: v })}
                  placeholder="yourname@okicici"
                />
                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50"
                  >
                    {busy ? 'Creating Partner Account...' : 'Join Affiliate Program & Get Referral Link →'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
