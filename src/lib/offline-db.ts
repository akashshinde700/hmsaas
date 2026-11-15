/**
 * OFFLINE-FIRST LOCAL STORE (IndexedDB)
 *
 * Mirrors core HMS entities so the app keeps working when the network is down.
 * All writes are queued in `syncQueue` and flushed to the server when connectivity returns.
 * PHI is stored ONLY in IndexedDB (never in the HTTP cache) — it never leaves the device
 * until explicitly synced to the tenant server.
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb'

interface HMSDBSchema extends DBSchema {
  patients: {
    key: string
    value: any
    indexes: { 'by-org': string; 'by-uhid': string }
  }
  prescriptions: {
    key: string
    value: any
    indexes: { 'by-patient': string }
  }
  labOrders: {
    key: string
    value: any
    indexes: { 'by-patient': string }
  }
  appointments: {
    key: string
    value: any
    indexes: { 'by-patient': string }
  }
  invoices: {
    key: string
    value: any
    indexes: { 'by-patient': string }
  }
  ipdAdmissions: {
    key: string
    value: any
    indexes: { 'by-patient': string }
  }
  opdQueue: {
    key: string
    value: any
    indexes: { 'by-org': string }
  }
  syncQueue: {
    key: number
    value: {
      id: number
      ts: number
      action: 'create' | 'update' | 'delete'
      entity: string
      endpoint: string
      payload: any
      patientId?: string
      orgId?: string
      retries: number
      status: 'pending' | 'synced' | 'failed'
      error?: string
    }
    indexes: { 'by-status': string; 'by-entity': string }
    autoIncrement: true
  }
  ocrResults: {
    key: string
    value: {
      id: string
      ts: number
      source: string
      fileName: string
      extractedText: string
      parsedFields: unknown
      patientId?: string
      synced: number
    }
    indexes: { 'by-patient': string; 'by-synced': number }
  }
}

const DB_NAME = 'aethermed-hms-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<HMSDBSchema>> | null = null

export function getOfflineDB(): Promise<IDBPDatabase<HMSDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<HMSDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Patients
        const patients = db.createObjectStore('patients', { keyPath: 'id' })
        patients.createIndex('by-org', 'organizationId')
        patients.createIndex('by-uhid', 'uhid', { unique: true })

        // Prescriptions
        const prescriptions = db.createObjectStore('prescriptions', { keyPath: 'id' })
        prescriptions.createIndex('by-patient', 'patientId')

        // Lab orders
        const labOrders = db.createObjectStore('labOrders', { keyPath: 'id' })
        labOrders.createIndex('by-patient', 'patientId')

        // Appointments
        const appointments = db.createObjectStore('appointments', { keyPath: 'id' })
        appointments.createIndex('by-patient', 'patientId')

        // Invoices
        const invoices = db.createObjectStore('invoices', { keyPath: 'id' })
        invoices.createIndex('by-patient', 'patientId')

        // IPD admissions
        const ipdAdmissions = db.createObjectStore('ipdAdmissions', { keyPath: 'id' })
        ipdAdmissions.createIndex('by-patient', 'patientId')

        // OPD queue
        const opdQueue = db.createObjectStore('opdQueue', { keyPath: 'id' })
        opdQueue.createIndex('by-org', 'organizationId')

        // Sync queue (mutations pending upload)
        const syncQueue = db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        syncQueue.createIndex('by-status', 'status')
        syncQueue.createIndex('by-entity', 'entity')

        // OCR results
        const ocrResults = db.createObjectStore('ocrResults', { keyPath: 'id' })
        ocrResults.createIndex('by-patient', 'patientId')
        ocrResults.createIndex('by-synced', 'synced')
      },
    })
  }
  return dbPromise
}

/* ---------- Generic helpers ---------- */

type StoreName = keyof HMSDBSchema & string

export async function offlinePut<T extends { id: string }>(
  store: StoreName,
  record: T
): Promise<void> {
  const db: any = await getOfflineDB()
  await db.put(store, record)
}

export async function offlineGet<T>(
  store: StoreName,
  id: string
): Promise<T | null> {
  const db: any = await getOfflineDB()
  return (await db.get(store, id)) ?? null
}

export async function offlineGetAll<T>(
  store: StoreName
): Promise<T[]> {
  const db: any = await getOfflineDB()
  return db.getAll(store)
}

export async function offlineGetByIndex<T>(
  store: StoreName,
  indexName: string,
  value: unknown
): Promise<T[]> {
  const db: any = await getOfflineDB()
  return db.getFromIndex(store, indexName, value)
}

export async function offlineDel(
  store: StoreName,
  id: string
): Promise<void> {
  const db: any = await getOfflineDB()
  await db.delete(store, id)
}

export async function offlineClear(store: StoreName): Promise<void> {
  const db: any = await getOfflineDB()
  await db.clear(store)
}

/* ---------- Sync queue ---------- */

export interface QueuedMutation {
  action: 'create' | 'update' | 'delete'
  entity: string
  endpoint: string
  payload: any
  patientId?: string
  orgId?: string
}

export async function enqueueMutation(m: QueuedMutation): Promise<number> {
  const db: any = await getOfflineDB()
  return db.add('syncQueue', {
    ts: Date.now(),
    ...m,
    retries: 0,
    status: 'pending',
  })
}

export async function getPendingMutations(): Promise<any[]> {
  const db: any = await getOfflineDB()
  return db.getFromIndex('syncQueue', 'by-status', 'pending')
}

export async function markSynced(id: number): Promise<void> {
  const db: any = await getOfflineDB()
  await db.put('syncQueue', { id, status: 'synced' })
}

export async function markFailed(id: number, error: string): Promise<void> {
  const db: any = await getOfflineDB()
  const row = await db.get('syncQueue', id)
  if (!row) return
  await db.put('syncQueue', {
    ...row,
    retries: row.retries + 1,
    status: row.retries + 1 >= 3 ? 'failed' : 'pending',
    error,
  })
}

export async function getSyncStats(): Promise<{
  pending: number
  synced: number
  failed: number
}> {
  const db: any = await getOfflineDB()
  const [pending, synced, failed] = await Promise.all([
    db.getFromIndex('syncQueue', 'by-status', 'pending'),
    db.getFromIndex('syncQueue', 'by-status', 'synced'),
    db.getFromIndex('syncQueue', 'by-status', 'failed'),
  ])
  return { pending: pending.length, synced: synced.length, failed: failed.length }
}

/* ---------- OCR results ---------- */

export interface OCRRecord {
  id: string
  source: string
  fileName: string
  extractedText: string
  parsedFields: unknown
  patientId?: string
  synced: number
}

export async function saveOCRResult(record: OCRRecord): Promise<void> {
  const db: any = await getOfflineDB()
  await db.put('ocrResults', record)
}

export async function getUnsyncedOCR(): Promise<OCRRecord[]> {
  const db: any = await getOfflineDB()
  return db.getFromIndex('ocrResults', 'by-synced', 0)
}

export async function markOCRSynced(id: string): Promise<void> {
  const db: any = await getOfflineDB()
  const row = await db.get('ocrResults', id)
  if (!row) return
  await db.put('ocrResults', { ...row, synced: 1 })
}

export async function clearSyncedRecords(olderThanMs = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getOfflineDB()
  const cutoff = Date.now() - olderThanMs
  const stores: StoreName[] = [
    'patients',
    'prescriptions',
    'labOrders',
    'appointments',
    'invoices',
    'ipdAdmissions',
    'opdQueue',
  ]
  for (const store of stores) {
    const tx = db.transaction(store as any, 'readwrite')
    const storeAny: any = tx.store
    const index = storeAny.index('by-uhid') || storeAny.index('by-patient') || storeAny
    // best-effort: delete all records older than cutoff by createdAt
    const all = await tx.store.getAll()
    const old = all.filter(
      (r: any) =>
        r.createdAt && new Date(r.createdAt).getTime() < cutoff
    )
    for (const r of old) await tx.store.delete(r.id)
    await tx.done
  }
}

/* ---------- Mirror: fetch + cache from server ---------- */

export async function mirrorEntity<T>(
  store: StoreName,
  records: T[],
  orgId?: string
): Promise<void> {
  const db = await getOfflineDB()
  const tx = db.transaction(store as any, 'readwrite')
  const storeAny: any = tx.store
  for (const r of records) await storeAny.put(r)
  await tx.done
}
