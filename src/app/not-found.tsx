import Link from 'next/link'
import { ArrowLeft, Compass, HeartPulse, LayoutDashboard, Shield, Stethoscope } from 'lucide-react'

export default function CustomNotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-600/20">
          <Compass className="h-8 w-8" />
        </div>

        <p className="mt-5 font-mono text-xs font-extrabold uppercase tracking-widest text-teal-600">
          Error 404 · Route Not Found
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          This Ward or Page Doesn&apos;t Exist
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The clinical module, patient link, or URL you visited may have moved. Jump straight back into your hospital workspace below.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 text-left text-xs">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 hover:bg-teal-100/70 transition"
          >
            <LayoutDashboard className="h-5 w-5 text-teal-700 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">Hospital Workspace</p>
              <p className="text-slate-600">OPD Queue, Smart Rx &amp; IPD Wards</p>
            </div>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition"
          >
            <HeartPulse className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">AetherMed SaaS Home</p>
              <p className="text-slate-600">Plans, Modules &amp; Book Demo</p>
            </div>
          </Link>

          <Link
            href="/login"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition"
          >
            <Stethoscope className="h-5 w-5 text-sky-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">Doctor &amp; Staff Login</p>
              <p className="text-slate-600">1-Click Demo Credentials</p>
            </div>
          </Link>

          <Link
            href="/platform-admin"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition"
          >
            <Shield className="h-5 w-5 text-violet-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">SaaS Platform Admin</p>
              <p className="text-slate-600">Manage Clinics &amp; MedWiki Sync</p>
            </div>
          </Link>
        </div>

        <div className="mt-7 pt-5 border-t border-slate-100">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
