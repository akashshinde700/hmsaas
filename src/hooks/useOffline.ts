'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getPendingMutations,
  markSynced,
  markFailed,
  getSyncStats,
} from '@/lib/offline-db'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''

export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState({ pending: 0, synced: 0, failed: 0 })

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
      const s = await getSyncStats()
      if (mounted) setStats(s)
    })()
    return () => {
      mounted = false
    }
  }, [isOnline])

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

  return { isOnline, syncing, stats, syncNow }
}
