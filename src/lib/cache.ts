import { NextResponse } from 'next/server'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const MAX_ENTRIES = 1000
const store = new Map<string, CacheEntry<unknown>>()

export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  ComputeFn: () => Promise<T>
): Promise<{ data: T; hit: boolean }> {
  const now = Date.now()
  const existing = store.get(key)
  if (existing && existing.expiresAt > now) {
    // Refresh LRU order
    store.delete(key)
    store.set(key, existing)
    return { data: existing.value as T, hit: true }
  }

  const data = await ComputeFn()
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value
    if (oldestKey) store.delete(oldestKey)
  }
  store.set(key, { value: data, expiresAt: now + ttlMs })
  return { data, hit: false }
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
    }
  }
}

export function clearAllCache(): void {
  store.clear()
}

export function apiJson<T>(
  payload: T,
  init?: { status?: number; startMs?: number; cacheHit?: boolean; cacheControl?: string }
): NextResponse<T> {
  const elapsed = init?.startMs ? Math.max(0.1, performance.now() - init.startMs) : undefined
  const headers = new Headers()
  if (elapsed !== undefined) {
    const formatted = elapsed.toFixed(2)
    headers.set('X-Response-Time', `${formatted}ms`)
    headers.set(
      'Server-Timing',
      `app;dur=${formatted}${init?.cacheHit !== undefined ? `,cache;desc="${init.cacheHit ? 'HIT' : 'MISS'}"` : ''}`
    )
  }
  if (init?.cacheControl) {
    headers.set('Cache-Control', init.cacheControl)
  }
  return NextResponse.json(payload, {
    status: init?.status ?? 200,
    headers,
  })
}
