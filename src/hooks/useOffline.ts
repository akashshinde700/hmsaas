'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getPendingMutations,
  markSynced,
  markFailed,
  getSyncStats,
} from '@/lib/offline-db'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''
const SYNC_TAG = 'aethermed-sync-mutations'

export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState({ pending: 0, synced: 0, failed: 0 })

  // Online/offline detection
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

  // Refresh stats when online status changes
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const s = await getSyncStats()
      if (mounted) setStats(s)
    })()
    return () => {
      mounted = false
    }
  }, [isOnline])

  // Listen for sync completion messages from service worker
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETED') {
        setStats((s) => ({ ...s, pending: 0 }))
        setSyncing(false)
      }
      if (event.data?.type === 'SYNC_FAILED') {
        setSyncing(false)
      }
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMessage)
    }
    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage)
      }
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const pending = await getPendingMutations()
      for (const m of pending) {
        try {
          const res = await fetch(`${API_BASE}${m.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m.payload),
          })
          if (res.ok) {
            await markSynced(m.id)
          } else {
            await markFailed(m.id, `HTTP ${res.status}`)
          }
        } catch (err: any) {
          await markFailed(m.id, err.message)
        }
      }
      setStats(await getSyncStats())
    } finally {
      setSyncing(false)
    }
  }, [syncing])

  // Register background sync when coming online (service worker handles the actual flush)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted || !isOnline) return
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready
          await (registration as any).sync.register(SYNC_TAG)
        } catch {
          // Background Sync API not supported — fall back to manual sync
          await syncNow()
        }
      } else {
        await syncNow()
      }
    })()
    return () => {
      mounted = false
    }
  }, [isOnline, syncNow])

  return { isOnline, syncing, stats, syncNow }
}
