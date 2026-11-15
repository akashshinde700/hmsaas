'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// #7 DEBOUNCING — Prevents firing search/filter API calls on every keystroke
// ============================================================================
export function useDebouncedValue<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

// ============================================================================
// #8 THROTTLING — Prevents rapid double-submits / button spam within `limitMs`
// ============================================================================
export function useThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void | Promise<void>,
  limitMs = 900
): [(...args: Args) => void, boolean] {
  const lastRunRef = useRef<number>(0)
  const [coolingDown, setCoolingDown] = useState(false)

  const throttled = useCallback(
    (...args: Args) => {
      const now = Date.now()
      if (now - lastRunRef.current < limitMs) return
      lastRunRef.current = now
      setCoolingDown(true)
      Promise.resolve(callback(...args)).finally(() => {
        setTimeout(() => setCoolingDown(false), Math.min(limitMs, 500))
      })
    },
    [callback, limitMs]
  )

  return [throttled, coolingDown]
}

// ============================================================================
// #4 PERSISTENT STATE — Persists sidebar collapse, active tab, table prefs
// ============================================================================
export function usePersistentState<T>(key: string, defaultValue: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue)
  const hydrated = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setState(JSON.parse(raw) as T)
      }
    } catch {
      // ignore storage errors
    }
    hydrated.current = true
  }, [key])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // ignore
        }
        return resolved
      })
    },
    [key]
  )

  return [state, update]
}

// ============================================================================
// #6 AUTOSAVE FUNCTIONS + #20 NETWORK RECOVERY ("Back online. Nothing was lost.")
// ============================================================================
export type AutosaveState = 'idle' | 'saving' | 'saved' | 'offline_saved' | 'recovered'

export function useAutosaveDraft<T>(
  storageKey: string,
  value: T,
  enabled = true
): {
  status: AutosaveState
  lastSavedAt: Date | null
  hasRestoredDraft: boolean
  loadSavedDraft: () => T | null
  clearDraft: () => void
} {
  const [status, setStatus] = useState<AutosaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false)
  const firstRender = useRef(true)

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(storageKey)
      if (existing) setHasRestoredDraft(true)
    } catch {
      // ignore
    }
  }, [storageKey])

  useEffect(() => {
    if (!enabled) return
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    setStatus('saving')
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value))
        setLastSavedAt(new Date())
        setStatus(navigator.onLine ? 'saved' : 'offline_saved')
      } catch {
        setStatus('idle')
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [storageKey, value, enabled])

  useEffect(() => {
    function handleOnline() {
      setStatus((prev) => (prev === 'offline_saved' ? 'recovered' : 'saved'))
      setLastSavedAt(new Date())
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const loadSavedDraft = useCallback((): T | null => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }, [storageKey])

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
      setHasRestoredDraft(false)
      setStatus('idle')
    } catch {
      // ignore
    }
  }, [storageKey])

  return { status, lastSavedAt, hasRestoredDraft, loadSavedDraft, clearDraft }
}

// ============================================================================
// #20 ONLINE / OFFLINE CONNECTION MONITOR
// ============================================================================
export function useNetworkRecovery() {
  const [isOnline, setIsOnline] = useState(true)
  const [justRecovered, setJustRecovered] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    function onOffline() {
      setIsOnline(false)
      setJustRecovered(false)
    }
    function onOnline() {
      setIsOnline(true)
      setJustRecovered(true)
      const t = setTimeout(() => setJustRecovered(false), 6000)
      return () => clearTimeout(t)
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return { isOnline, justRecovered, dismissRecovery: () => setJustRecovered(false) }
}

// ============================================================================
// #9 SMART FORM VALIDATION — Inline real-time validation rules
// ============================================================================
export type ValidationRule =
  | 'required'
  | 'email'
  | 'indian_phone'
  | 'gstin'
  | 'positive_number'
  | 'age'
  | 'uhid_prefix'

export function validateSmartField(value: string | number | undefined | null, rules: ValidationRule[]): string | null {
  const str = String(value ?? '').trim()

  if (rules.includes('required') && !str) {
    return 'This field is required.'
  }
  if (!str) return null

  if (rules.includes('email')) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    if (!emailRe.test(str)) return 'Enter a valid work email (e.g. doctor@hospital.in).'
  }

  if (rules.includes('indian_phone')) {
    const digits = str.replace(/\D/g, '')
    const normalized = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      return 'Enter a valid 10-digit Indian mobile number.'
    }
  }

  if (rules.includes('gstin')) {
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(str)) {
      return 'GSTIN must be 15 characters (e.g. 27AABCS1429B1Z5).'
    }
  }

  if (rules.includes('positive_number')) {
    const n = Number(str)
    if (Number.isNaN(n) || n < 0) return 'Enter a valid positive amount.'
  }

  if (rules.includes('age')) {
    const n = Number(str)
    if (Number.isNaN(n) || n < 0 || n > 125) return 'Age must be between 0 and 125 years.'
  }

  if (rules.includes('uhid_prefix')) {
    if (!/^[A-Z0-9]{2,8}$/i.test(str)) return 'Use 2–8 alphanumeric characters (e.g. SHP, HMS).'
  }

  return null
}
