'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">Recovering Application Session</h1>
          <p className="mt-2 text-xs text-slate-600">
            Nothing was lost ({error?.digest || 'transient error'}). Click below to reload cleanly.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-5 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white"
          >
            Reload Workspace
          </button>
        </div>
      </body>
    </html>
  )
}
