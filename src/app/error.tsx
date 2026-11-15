'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AetherMed Graceful Error Recovery]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900">
          Temporary Workspace Glitch
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Your patient records, IPD beds, and local autosaved prescription drafts are completely safe. Click below to recover this view immediately.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-xl bg-slate-50 p-2.5 font-mono text-[11px] text-slate-500 border border-slate-200">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-teal-700"
          >
            <RefreshCw className="h-4 w-4" /> Recover &amp; Retry View
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Home className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
