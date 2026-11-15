'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardCopy, Gift, IndianRupee, Share2, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  SaaSDataTable,
  SkeletonKpiGrid,
  SmartValidatedInput,
} from '@/components/saas-ux/SaaSUXPrimitives'

interface ReferralLeadRow {
  id: string
  referredClinicName: string
  contactName: string
  contactPhone: string
  city?: string | null
  planInterested: string
  status: string
  rewardAmountINR: number
  createdAt: string
}

interface PartnerRecord {
  id: string
  name: string
  referralCode: string
  commissionPercent: number
  clicksCount: number
  totalReferrals: number
  convertedCount: number
  totalEarnedINR: number
  pendingPayoutINR: number
  leads: ReferralLeadRow[]
}

export default function ReferAndEarnTab() {
  const [partner, setPartner] = useState<PartnerRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [leadForm, setLeadForm] = useState({
    referredClinicName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    city: 'Pune',
    planInterested: 'Advance Hospital',
  })

  const loadPartner = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/referrals')
      if (res.ok) {
        const d = await res.json()
        setPartner(d.partner || null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPartner()
  }, [loadPartner])

  if (loading) return <SkeletonKpiGrid count={4} />

  const shareUrl =
    typeof window !== 'undefined' && partner
      ? `${window.location.origin}/?ref=${partner.referralCode}`
      : `https://aethermed.in/?ref=${partner?.referralCode || ''}`

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <Gift className="h-3.5 w-3.5" /> Hospital Peer Referral &amp; Affiliate Rewards
            </span>
            <h2 className="mt-2 text-2xl font-extrabold">
              Refer Fellow Doctors &amp; Hospitals — Earn 20% Commission + 1 Month Free
            </h2>
            <p className="mt-1 text-xs text-teal-100 leading-relaxed">
              Share your hospital&apos;s unique referral link or submit a colleague&apos;s clinic below. Every converted hospital credits recurring rewards directly to your account.
            </p>
          </div>

          {partner && (
            <div className="rounded-2xl bg-slate-950/35 backdrop-blur-xs p-4 border border-white/20 min-w-[270px]">
              <p className="text-[11px] uppercase tracking-wider text-teal-200 font-bold">
                Your Referral Code &amp; Link
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-extrabold">{partner.referralCode}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl)
                    setCopied(true)
                    toast.success('Copied referral link to clipboard!')
                    setTimeout(() => setCopied(false), 1800)
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <p className="mt-1.5 truncate font-mono text-[11px] text-teal-100">{shareUrl}</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      {partner && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Link Visits</span>
              <Share2 className="h-4 w-4 text-teal-600" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{partner.clicksCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Referred Clinics</span>
              <Users className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {partner.totalReferrals}{' '}
              <span className="text-xs font-semibold text-emerald-600">
                ({partner.convertedCount} converted)
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Total Earned</span>
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-emerald-700">
              ₹{partner.totalEarnedINR.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Pending Reward Credit</span>
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-amber-700">
              ₹{partner.pendingPayoutINR.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Submit Peer Referral + Tracked Referrals DataTable */}
      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!partner) return
            setSubmitting(true)
            try {
              const res = await fetch('/api/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'submitLead',
                  referralCode: partner.referralCode,
                  ...leadForm,
                }),
              })
              const d = await res.json()
              if (!res.ok) {
                toast.error(d.error || 'Could not submit referral')
                return
              }
              toast.success(`Referred ${leadForm.referredClinicName} — reward tracked!`)
              setLeadForm({
                referredClinicName: '',
                contactName: '',
                contactPhone: '',
                contactEmail: '',
                city: 'Pune',
                planInterested: 'Advance Hospital',
              })
              loadPartner()
            } finally {
              setSubmitting(false)
            }
          }}
          className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 text-xs"
        >
          <h3 className="text-base font-bold text-slate-900">Refer a Colleague&apos;s Hospital</h3>
          <SmartValidatedInput
            label="Hospital / Nursing Home Name"
            required
            value={leadForm.referredClinicName}
            onChange={(v) => setLeadForm({ ...leadForm, referredClinicName: v })}
            placeholder="e.g. Swastik Multispecialty Hospital"
          />
          <SmartValidatedInput
            label="Doctor / Director Name"
            required
            value={leadForm.contactName}
            onChange={(v) => setLeadForm({ ...leadForm, contactName: v })}
            placeholder="Dr. Mahesh Patil"
          />
          <SmartValidatedInput
            label="Mobile / WhatsApp Number"
            required
            rules={['indian_phone']}
            value={leadForm.contactPhone}
            onChange={(v) => setLeadForm({ ...leadForm, contactPhone: v })}
            placeholder="98220XXXXX"
          />
          <div className="grid grid-cols-2 gap-2">
            <SmartValidatedInput
              label="City"
              value={leadForm.city}
              onChange={(v) => setLeadForm({ ...leadForm, city: v })}
            />
            <div>
              <label className="block font-bold text-slate-700 mb-1">Recommended Plan</label>
              <select
                value={leadForm.planInterested}
                onChange={(e) => setLeadForm({ ...leadForm, planInterested: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option>Basic</option>
                <option>Advance Hospital</option>
                <option>Enterprise Multispecialty</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-teal-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting Referral...' : 'Submit Hospital Referral →'}
          </button>
        </form>

        <div className="lg:col-span-7">
          <SaaSDataTable<ReferralLeadRow>
            data={partner?.leads || []}
            rowKey={(r) => r.id}
            searchPlaceholder="Search referred hospitals..."
            searchableText={(r) => `${r.referredClinicName} ${r.contactName} ${r.city || ''}`}
            exportFilename="hospital-referrals.csv"
            emptyTitle="No peer referrals submitted yet"
            emptyDescription="Submit your first hospital referral on the left to earn 20% commission + free subscription credits."
            columns={[
              {
                key: 'clinic',
                header: 'Referred Hospital',
                sortable: true,
                sortValue: (r) => r.referredClinicName,
                render: (r) => (
                  <div>
                    <p className="font-bold text-slate-900">{r.referredClinicName}</p>
                    <p className="text-[11px] text-slate-500">
                      {r.contactName} · {r.contactPhone}
                    </p>
                  </div>
                ),
              },
              {
                key: 'plan',
                header: 'Plan',
                render: (r) => <span className="font-medium text-slate-700">{r.planInterested}</span>,
              },
              {
                key: 'status',
                header: 'Stage',
                render: (r) => (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      r.status === 'converted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {r.status}
                  </span>
                ),
              },
              {
                key: 'reward',
                header: 'Reward',
                sortable: true,
                sortValue: (r) => r.rewardAmountINR,
                render: (r) => (
                  <span className="font-bold text-emerald-700">
                    ₹{r.rewardAmountINR.toLocaleString('en-IN')}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
