/**
 * MEDWIKI SYNC SERVICE — Crash-Proof Continuous Sync
 *
 * Features:
 *   • Circuit breaker — stops calling MedWiki if it keeps failing
 *   • Exponential backoff retry — 3 attempts with increasing delays
 *   • Per-item error isolation — one bad medicine doesn't kill the batch
 *   • Timeout guard — each fetch has a hard 10s timeout
 *   • Graceful degradation — returns partial results on partial failure
 *   • Sync run logging — every run recorded in medwikiSyncRun table
 */

import { dbUnscoped } from './db'
import { invalidateCachePrefix } from './cache'
import { normalizeMedicineRecord } from './medwiki-engine'

// -----------------------------------------------------------------------------
// Circuit Breaker State
// -----------------------------------------------------------------------------
interface CircuitState {
  failures: number
  lastFailure: number | null
  halfOpen: boolean
  blockedUntil: number | null
}

const CIRCUIT: CircuitState = {
  failures: 0,
  lastFailure: null,
  halfOpen: false,
  blockedUntil: null,
}

const CIRCUIT_THRESHOLD = 5 // open after 5 consecutive failures
const CIRCUIT_COOLDOWN_MS = 60 * 1000 // 1 minute before trying again

// -----------------------------------------------------------------------------
// Fetch with Timeout + Retry
// -----------------------------------------------------------------------------
async function fetchWithRetry(
  url: string,
  opts: RequestInit & { retries?: number; timeoutMs?: number },
): Promise<Response> {
  const retries = opts.retries ?? 3
  const timeoutMs = opts.timeoutMs ?? 10_000
  const { retries: _, timeoutMs: _2, ...fetchOpts } = opts

  let lastError: unknown = null

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal })
      clearTimeout(timer)
      return res
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      }
    }
  }

  throw lastError
}

// -----------------------------------------------------------------------------
// Circuit Breaker Check
// -----------------------------------------------------------------------------
function canCallMedwiki(): boolean {
  const now = Date.now()

  // If blocked, check if cooldown has passed
  if (CIRCUIT.blockedUntil && now < CIRCUIT.blockedUntil) {
    return false
  }

  // If half-open, allow one trial call
  if (CIRCUIT.halfOpen) {
    return true
  }

  return true
}

function recordMedwikiSuccess(): void {
  CIRCUIT.failures = 0
  CIRCUIT.lastFailure = null
  CIRCUIT.halfOpen = false
  CIRCUIT.blockedUntil = null
}

function recordMedwikiFailure(): void {
  CIRCUIT.failures += 1
  CIRCUIT.lastFailure = Date.now()

  if (CIRCUIT.failures >= CIRCUIT_THRESHOLD) {
    CIRCUIT.halfOpen = false
    CIRCUIT.blockedUntil = Date.now() + CIRCUIT_COOLDOWN_MS
  } else {
    CIRCUIT.halfOpen = true // allow trial after next failure threshold not reached
  }
}

// -----------------------------------------------------------------------------
// MedWiki Remote Fetch (replace with your actual MedWiki API endpoint)
// -----------------------------------------------------------------------------
export async function fetchMedwikiDelta(options: {
  query?: string
  limit?: number
  lastSyncedAt?: string | null
}): Promise<{ medicines: any[]; hasMore: boolean }> {
  if (!canCallMedwiki()) {
    return { medicines: [], hasMore: false }
  }

  const medwikiBase = process.env.MEDWIKI_API_BASE_URL
  const medwikiKey = process.env.MEDWIKI_API_KEY

  if (!medwikiBase || !medwikiKey) {
    // No MedWiki remote configured — return empty, not an error
    return { medicines: [], hasMore: false }
  }

  const url = new URL(`${medwikiBase.replace(/\/$/, '')}/api/delta`)
  if (options.query) url.searchParams.set('q', options.query)
  if (options.limit) url.searchParams.set('limit', String(options.limit))
  if (options.lastSyncedAt) url.searchParams.set('since', options.lastSyncedAt)

  try {
    const res = await fetchWithRetry(url.toString(), {
      method: 'GET',
      retries: 3,
      timeoutMs: 10_000,
      headers: {
        'Authorization': `Bearer ${medwikiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`MedWiki HTTP ${res.status}`)
    }

    const data = await res.json()
    recordMedwikiSuccess()

    return {
      medicines: Array.isArray(data.medicines) ? data.medicines : [],
      hasMore: Boolean(data.hasMore),
    }
  } catch (err) {
    recordMedwikiFailure()
    console.error('[MedWiki Sync] Remote fetch failed:', err)
    return { medicines: [], hasMore: false }
  }
}

// -----------------------------------------------------------------------------
// Main Sync Function — Called by API routes + Cron
// -----------------------------------------------------------------------------
export async function runMedwikiSync(options: {
  triggerSource?: string
  mode?: string
  queryOrTerm?: string
  medicines?: any[] // if provided, sync these instead of fetching from remote
}): Promise<{
  syncRunId: string
  foundCount: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  durationMs: number
  logSummary: string
}> {
  const startMs = Date.now()
  const triggerSource = options.triggerSource || 'cron'
  const mode = options.mode || 'continuous_delta'

  let items: any[] = []

  if (options.medicines && options.medicines.length > 0) {
    items = options.medicines
  } else {
    // Fetch from MedWiki remote
    const lastRun = await dbUnscoped.medwikiSyncRun.findFirst({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    })

    const remote = await fetchMedwikiDelta({
      query: options.queryOrTerm,
      limit: 100,
      lastSyncedAt: lastRun?.completedAt?.toISOString() || null,
    })
    items = remote.medicines
  }

  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  // Process each medicine individually — one bad item won't kill the batch
  for (const raw of items) {
    if (!raw?.name || !raw.name.trim()) {
      skippedCount++
      continue
    }

    try {
      const normalized = normalizeMedicineRecord({
        ...raw,
        source: raw.source || 'medwiki',
        organizationId: null, // MedWiki global medicines
      })

      const existing = await dbUnscoped.medicine.findUnique({
        where: { dedupKey: normalized.dedupKey },
        select: { id: true },
      })

      if (existing) {
        await dbUnscoped.medicine.update({
          where: { id: existing.id },
          data: { ...normalized, updatedAt: new Date() },
        })
        updatedCount++
      } else {
        await dbUnscoped.medicine.create({ data: normalized })
        insertedCount++
      }
    } catch {
      errorCount++
    }
  }

  invalidateCachePrefix('meds:')

  const durationMs = Date.now() - startMs
  const syncRun = await dbUnscoped.medwikiSyncRun.create({
    data: {
      triggerSource,
      mode,
      queryOrTerm: options.queryOrTerm || null,
      status: errorCount > 0 && insertedCount + updatedCount === 0 ? 'failed' : 'completed',
      foundCount: items.length,
      insertedCount,
      updatedCount,
      skippedCount,
      errorCount,
      durationMs,
      completedAt: new Date(),
      logSummary: `Processed ${items.length} medicines in ${durationMs}ms (${insertedCount} new, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors).`,
    },
  })

  return {
    syncRunId: syncRun.id,
    foundCount: items.length,
    insertedCount,
    updatedCount,
    skippedCount,
    errorCount,
    durationMs,
    logSummary: syncRun.logSummary || '',
  }
}
