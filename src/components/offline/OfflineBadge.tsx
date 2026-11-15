'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi, Cloud, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * OFFLINE / ONLINE STATUS BADGE
 * Shows live connectivity status and sync queue count.
 * Place in the app shell header (dashboard + patient portal).
 */
export function OfflineBadge() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [queued, setQueued] = useState(0)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('@/lib/offline-db')
        const stats = await mod.getSyncStats()
        if (mounted) setQueued(stats.pending)
      } catch {}
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-300">
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Online
          </span>
          {queued > 0 && (
            <>
              <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {queued} syncing
              </span>
            </>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-rose-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Offline
          </span>
          {queued > 0 && (
            <>
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {queued} queued
              </span>
            </>
          )}
        </>
      )}
    </div>
  )
}

/**
 * SYNC STATUS PANEL
 * Drawer/modal showing pending mutations and retry controls.
 */
export function SyncPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stats, setStats] = useState({ pending: 0, synced: 0, failed: 0 })
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const mod = await import('@/lib/offline-db')
      const s = await mod.getSyncStats()
      if (mounted) setStats(s)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleRetry = async () => {
    setSyncing(true)
    try {
      const mod = await import('@/lib/offline-db')
      const pending = await mod.getPendingMutations()
      for (const m of pending) {
        try {
          const res = await fetch(m.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m.payload),
          })
          if (res.ok) await mod.markSynced(m.id)
          else await mod.markFailed(m.id, `HTTP ${res.status}`)
        } catch (err: any) {
          await mod.markFailed(m.id, err.message)
        }
      }
      setStats(await mod.getSyncStats())
    } finally {
      setSyncing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-md mx-auto mt-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Offline Sync</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Pending actions</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                stats.pending > 0
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {stats.pending}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Synced</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{stats.synced}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Failed</span>
            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">{stats.failed}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={syncing || stats.pending === 0}
            onClick={handleRetry}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
              syncing || stats.pending === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-200/40'
            }`}
          >
            {syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Cloud className="h-4 w-4 mr-2" />
            )}
            {syncing ? 'Syncing…' : stats.pending === 0 ? 'All synced' : 'Sync now'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
