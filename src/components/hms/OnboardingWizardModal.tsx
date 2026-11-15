'use client'

import { useState } from 'react'
import { Building2, CheckCircle2, Sparkles, Stethoscope, BedDouble, X } from 'lucide-react'
import { toast } from 'sonner'
import { SmartValidatedInput } from '@/components/saas-ux/SaaSUXPrimitives'

export default function OnboardingWizardModal({
  open,
  initialClinicName,
  initialUhidPrefix,
  onClose,
  onCompleted,
}: {
  open: boolean
  initialClinicName: string
  initialUhidPrefix: string
  onClose: () => void
  onCompleted: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    clinicDisplayName: initialClinicName || 'My Multispecialty Hospital',
    primarySpecialty: 'Multispecialty OPD + IPD',
    phone: '9822011223',
    uhidPrefix: initialUhidPrefix || 'HMS',
    opdTimings: '09:00 AM – 09:00 PM',
    avgDailyOpd: '50–100 Patients / day',
    defaultLanguage: 'en',
    ipdFocus: 'General + Deluxe + ICU Wards',
    upiId: 'hospital@upi',
    heardFrom: 'Doctor Peer / Referral',
  })

  if (!open) return null

  async function finishOnboarding() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'completeOnboarding',
          ...form,
        }),
      })
      if (!res.ok) {
        toast.error('Could not save onboarding profile')
        return
      }
      toast.success('Hospital workspace personalized & ready!')
      onCompleted()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl">
        {/* Progress Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-teal-600">
                Step {step} of 4 · Guided Hospital Setup
              </p>
              <h3 className="text-base font-extrabold text-slate-900">
                Personalize Your OPD &amp; IPD Workspace
              </h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s <= step ? 'bg-teal-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Facility Profile */}
        {step === 1 && (
          <div className="mt-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Building2 className="h-4 w-4 text-teal-600" />
              1. Facility Identity &amp; Primary Specialty
            </div>
            <SmartValidatedInput
              label="Hospital / Clinic Letterhead Name"
              required
              value={form.clinicDisplayName}
              onChange={(v) => setForm({ ...form, clinicDisplayName: v })}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Facility Category</label>
                <select
                  value={form.primarySpecialty}
                  onChange={(e) => setForm({ ...form, primarySpecialty: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option>Multispecialty OPD + IPD</option>
                  <option>ICU &amp; Critical Care Hospital</option>
                  <option>General Medicine &amp; Diabetology</option>
                  <option>Pediatrics &amp; Maternity Nursing Home</option>
                  <option>Orthopedics &amp; Surgical Center</option>
                </select>
              </div>
              <SmartValidatedInput
                label="24x7 Reception / Emergency Mobile"
                rules={['indian_phone']}
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            </div>
          </div>
        )}

        {/* Step 2: OPD Preferences */}
        {step === 2 && (
          <div className="mt-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Stethoscope className="h-4 w-4 text-teal-600" />
              2. OPD Token Queue &amp; Prescription Language
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <SmartValidatedInput
                label="Patient UHID Prefix"
                required
                rules={['uhid_prefix']}
                value={form.uhidPrefix}
                onChange={(v) => setForm({ ...form, uhidPrefix: v.toUpperCase() })}
                hint="Example: SHP → generates SHP-0001"
              />
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Default Prescription Advice Language
                </label>
                <select
                  value={form.defaultLanguage}
                  onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Daily OPD Volume</label>
                <select
                  value={form.avgDailyOpd}
                  onChange={(e) => setForm({ ...form, avgDailyOpd: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option>10–30 Patients / day</option>
                  <option>50–100 Patients / day</option>
                  <option>100–250+ Patients / day</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">OPD Consultation Hours</label>
                <input
                  value={form.opdTimings}
                  onChange={(e) => setForm({ ...form, opdTimings: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: IPD & Billing */}
        {step === 3 && (
          <div className="mt-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BedDouble className="h-4 w-4 text-teal-600" />
              3. IPD Ward Configuration &amp; Instant UPI Receipts
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">IPD Ward Setup</label>
              <select
                value={form.ipdFocus}
                onChange={(e) => setForm({ ...form, ipdFocus: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option>General + Deluxe + ICU Wards</option>
                <option>Daycare Observation Beds Only</option>
                <option>Maternity + NICU + Private Suites</option>
                <option>OPD Only (Enable IPD Later)</option>
              </select>
            </div>
            <SmartValidatedInput
              label="Hospital UPI ID for OPD & IPD Deposit Receipts"
              value={form.upiId}
              onChange={(v) => setForm({ ...form, upiId: v })}
              placeholder="hospitalname@icici"
            />
          </div>
        )}

        {/* Step 4: Discovery Capture */}
        {step === 4 && (
          <div className="mt-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              4. Final Step — How Did You Discover AetherMed?
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                'Doctor Peer / Referral',
                'Google / Medical Search',
                'Hospital IT Consultant',
                'WhatsApp / Social Media',
              ].map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setForm({ ...form, heardFrom: src })}
                  className={`rounded-xl border p-3 text-left font-semibold transition ${
                    form.heardFrom === src
                      ? 'border-teal-600 bg-teal-50 text-teal-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-emerald-900">
              <strong>Ready to launch:</strong> MedWiki Drug Sync (65+ core molecules), Live OPD Queue, Smart Rx Pad, and ICTHospital-grade IPD Bed Board are pre-configured.
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3 | 4) : onClose())}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
          >
            {step > 1 ? '← Back' : 'Skip for Now'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              className="rounded-xl bg-teal-600 px-5 py-2.5 font-bold text-white hover:bg-teal-700"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={finishOnboarding}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving Setup...' : 'Complete Hospital Setup ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
