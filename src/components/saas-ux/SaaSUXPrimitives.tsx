'use client'

import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Crown,
  Download,
  Filter,
  Inbox,
  Keyboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'
import {
  useDebouncedValue,
  validateSmartField,
  type AutosaveState,
  type ValidationRule,
} from '@/hooks/useSaaSUX'

// ============================================================================
// #2 SKELETON LOADERS — Shimmering clinical KPI, Card & Table skeletons
// ============================================================================
export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-6 w-6 rounded-lg bg-slate-200" />
          </div>
          <div className="mt-4 h-8 w-24 rounded-lg bg-slate-200" />
          <div className="mt-3 h-3 w-36 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs animate-pulse space-y-3"
        >
          <div className="flex justify-between">
            <div className="h-6 w-16 rounded-lg bg-slate-200" />
            <div className="h-5 w-20 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-100" />
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <div className="h-7 w-24 rounded-lg bg-slate-200" />
            <div className="h-7 w-24 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTableRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100 animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-4 rounded bg-slate-200/80" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// #5 EMPTY STATE — Clear zero-data / zero-filter-match state with CTA
// ============================================================================
export function EmptyStateCard({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon?: typeof Inbox
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-200/60">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-3.5 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 transition"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// #6 AUTOSAVE PILL + #20 NETWORK RECOVERY CARD (Matches user screenshot!)
// ============================================================================
export function AutosaveBadge({
  status,
  lastSavedAt,
  onRestore,
  hasRestoredDraft,
}: {
  status: AutosaveState
  lastSavedAt: Date | null
  onRestore?: () => void
  hasRestoredDraft?: boolean
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      {status === 'saving' && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          <Loader2 className="h-3 w-3 animate-spin text-teal-600" />
          Autosaving draft...
        </span>
      )}
      {(status === 'saved' || status === 'recovered') && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Changes saved
          {lastSavedAt && (
            <span className="text-[10px] font-normal text-emerald-700">
              · {lastSavedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
      )}
      {status === 'offline_saved' && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          <CloudOff className="h-3 w-3 text-amber-600" />
          Saved offline locally
        </span>
      )}
      {hasRestoredDraft && onRestore && status === 'idle' && (
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
        >
          <RotateCcw className="h-3 w-3" /> Restore unsaved draft
        </button>
      )}
    </div>
  )
}

export function NetworkRecoveryBanner({
  isOnline,
  justRecovered,
  onDismiss,
}: {
  isOnline: boolean
  justRecovered: boolean
  onDismiss: () => void
}) {
  if (!isOnline) {
    return (
      <div className="fixed bottom-16 lg:bottom-5 right-4 z-50 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-xl">
        <CloudOff className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="text-xs">
          <p className="font-bold text-amber-950">Working Offline</p>
          <p className="text-amber-800">Drafts are autosaving locally. Nothing will be lost.</p>
        </div>
      </div>
    )
  }

  if (justRecovered) {
    // Exact visual card shown in user's screenshot: "Changes saved · Back online. Nothing was lost."
    return (
      <div className="fixed bottom-16 lg:bottom-5 right-4 z-50 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-xl min-w-[290px]">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-slate-900">Changes saved</p>
            <p className="text-slate-600">Back online. Nothing was lost.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return null
}

export function ErrorRecoveryBanner({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  if (!error) return null
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2.5 text-rose-900">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
        <div>
          <p className="font-bold">Connection or Sync Interrupted</p>
          <p className="text-rose-700">{error}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 font-bold text-white hover:bg-rose-700"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry Now
      </button>
    </div>
  )
}

// ============================================================================
// #9 SMART FORM VALIDATION INPUT
// ============================================================================
export function SmartValidatedInput({
  label,
  value,
  onChange,
  rules = [],
  type = 'text',
  placeholder,
  required,
  className = '',
  hint,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  rules?: ValidationRule[]
  type?: string
  placeholder?: string
  required?: boolean
  className?: string
  hint?: string
}) {
  const [touched, setTouched] = useState(false)
  const effectiveRules: ValidationRule[] = required && !rules.includes('required') ? ['required', ...rules] : rules
  const error = touched ? validateSmartField(value, effectiveRules) : null
  const isValid = touched && !error && value.trim().length > 0

  return (
    <div className={className}>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onBlur={() => setTouched(true)}
          onChange={(e) => {
            onChange(e.target.value)
            if (!touched && e.target.value.length > 2) setTouched(true)
          }}
          placeholder={placeholder}
          className={`w-full rounded-xl border px-3 py-2 pr-8 text-sm transition focus:outline-none ${
            error
              ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
              : isValid
              ? 'border-emerald-400 bg-white focus:border-teal-600'
              : 'border-slate-300 bg-white focus:border-teal-600'
          }`}
        />
        {isValid && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 absolute right-2.5 top-2.5 pointer-events-none" />
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

// ============================================================================
// #10 BULK ACTIONS + #11 REUSABLE DATA TABLE + #12 ADVANCED DATA FILTERING
// ============================================================================
export interface SaaSColumn<T> {
  key: string
  header: string
  sortable?: boolean
  sortValue?: (row: T) => string | number
  render: (row: T) => React.ReactNode
  csvValue?: (row: T) => string | number
  className?: string
}

export interface SaaSFacetFilter<T> {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
  match: (row: T, selectedValue: string) => boolean
}

export interface SaaSBulkAction<T> {
  label: string
  variant?: 'default' | 'primary' | 'danger'
  onExecute: (selectedIds: string[], selectedRows: T[], clearSelection: () => void) => void | Promise<void>
}

export function SaaSDataTable<T>({
  data,
  rowKey,
  columns,
  loading = false,
  searchPlaceholder = 'Search records...',
  searchableText,
  filters = [],
  bulkActions = [],
  exportFilename = 'aethermed-export.csv',
  emptyTitle = 'No matching records found',
  emptyDescription = 'Adjust your search or filters, or create a new record to get started.',
  emptyActionLabel,
  onEmptyAction,
  initialPageSize = 10,
  headerRight,
}: {
  data: T[]
  rowKey: (row: T) => string
  columns: SaaSColumn<T>[]
  loading?: boolean
  searchPlaceholder?: string
  searchableText?: (row: T) => string
  filters?: SaaSFacetFilter<T>[]
  bulkActions?: SaaSBulkAction<T>[]
  exportFilename?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  initialPageSize?: number
  headerRight?: React.ReactNode
}) {
  const [rawSearch, setRawSearch] = useState('')
  const debouncedSearch = useDebouncedValue(rawSearch, 160)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const activeFilterCount = Object.values(activeFilters).filter((v) => v && v !== 'ALL').length

  const filteredAndSorted = useMemo(() => {
    let rows = data

    if (debouncedSearch.trim() && searchableText) {
      const q = debouncedSearch.trim().toLowerCase()
      rows = rows.filter((r) => searchableText(r).toLowerCase().includes(q))
    }

    for (const f of filters) {
      const sel = activeFilters[f.key]
      if (sel && sel !== 'ALL') {
        rows = rows.filter((r) => f.match(r, sel))
      }
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      if (col?.sortValue) {
        const getter = col.sortValue
        rows = [...rows].sort((a, b) => {
          const va = getter(a)
          const vb = getter(b)
          if (va < vb) return sortDir === 'asc' ? -1 : 1
          if (va > vb) return sortDir === 'asc' ? 1 : -1
          return 0
        })
      }
    }

    return rows
  }, [data, debouncedSearch, searchableText, filters, activeFilters, sortKey, sortDir, columns])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredAndSorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const allVisibleSelected =
    pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(rowKey(r)))

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        pagedRows.forEach((r) => next.delete(rowKey(r)))
      } else {
        pagedRows.forEach((r) => next.add(rowKey(r)))
      }
      return next
    })
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportCsv(rowsToExport: T[]) {
    const header = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',')
    const lines = rowsToExport.map((row) =>
      columns
        .map((col) => {
          const val = col.csvValue
            ? col.csvValue(row)
            : col.sortValue
            ? col.sortValue(row)
            : ''
          return `"${String(val ?? '').replace(/"/g, '""')}"`
        })
        .join(',')
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedRows = data.filter((r) => selectedIds.has(rowKey(r)))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* Toolbar: Debounced Search + Advanced Multi-Facet Filters + CSV Export */}
      <div className="border-b border-slate-100 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
            {searchableText && (
              <div className="relative flex-1 max-w-sm min-w-[210px]">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={rawSearch}
                  onChange={(e) => {
                    setRawSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-8 py-2 text-xs focus:border-teal-500 focus:bg-white focus:outline-none"
                />
                {rawSearch && (
                  <button
                    type="button"
                    onClick={() => setRawSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {filters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <Filter className="h-3.5 w-3.5 text-teal-600" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-teal-600 px-1.5 py-0.2 text-[10px] text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                {filters.map((f) => (
                  <select
                    key={f.key}
                    value={activeFilters[f.key] || 'ALL'}
                    onChange={(e) => {
                      setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                      setPage(1)
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="ALL">{f.label}: All</option>
                    {f.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ))}
                {(activeFilterCount > 0 || rawSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilters({})
                      setRawSearch('')
                      setPage(1)
                    }}
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCsv(filteredAndSorted)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            {headerRight}
          </div>
        </div>

        {/* #10 Sticky Bulk Action Bar when rows are selected */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs text-white">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-500 px-2 py-0.5 font-bold text-slate-950">
                {selectedIds.size} selected
              </span>
              <span className="text-slate-300">Bulk Actions:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {bulkActions.map((ba) => (
                <button
                  key={ba.label}
                  type="button"
                  onClick={() =>
                    ba.onExecute(Array.from(selectedIds), selectedRows, () =>
                      setSelectedIds(new Set())
                    )
                  }
                  className={`rounded-lg px-3 py-1.5 font-bold transition ${
                    ba.variant === 'danger'
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : ba.variant === 'primary'
                      ? 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {ba.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => exportCsv(selectedRows)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Export Selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-400 hover:text-white px-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Body / Skeleton / Empty State */}
      {loading ? (
        <SkeletonTableRows rows={6} cols={columns.length + 1} />
      ) : filteredAndSorted.length === 0 ? (
        <div className="p-6">
          <EmptyStateCard
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
            secondaryLabel={
              activeFilterCount > 0 || rawSearch ? 'Clear Active Filters' : undefined
            }
            onSecondary={
              activeFilterCount > 0 || rawSearch
                ? () => {
                    setActiveFilters({})
                    setRawSearch('')
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-10 py-3 px-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select visible rows"
                      className="rounded border-slate-300"
                    />
                  </th>
                  {columns.map((col) => {
                    const isSorted = sortKey === col.key
                    return (
                      <th key={col.key} className={`py-3 px-3.5 ${col.className || ''}`}>
                        {col.sortable && col.sortValue ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (isSorted) {
                                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                              } else {
                                setSortKey(col.key)
                                setSortDir('asc')
                              }
                            }}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            <span>{col.header}</span>
                            {isSorted ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-teal-600" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-teal-600" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRows.map((row) => {
                  const id = rowKey(row)
                  const checked = selectedIds.has(id)
                  return (
                    <tr
                      key={id}
                      className={`transition ${
                        checked ? 'bg-teal-50/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className={`py-3 px-3.5 ${col.className || ''}`}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{(safePage - 1) * pageSize + 1}</strong>–
                <strong>{Math.min(safePage * pageSize, filteredAndSorted.length)}</strong> of{' '}
                <strong>{filteredAndSorted.length}</strong>
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-semibold">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// #13 KEYBOARD SHORTCUTS CHEAT-SHEET MODAL
// ============================================================================
export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  const shortcuts = [
    { keys: ['⌘ / Ctrl', 'K'], desc: 'Open Global Spotlight Command Palette' },
    { keys: ['?'], desc: 'Open / Close Keyboard Shortcuts Help' },
    { keys: ['['], desc: 'Collapse / Expand Persistent Left Sidebar' },
    { keys: ['Alt', '1'], desc: 'Jump to Command Overview' },
    { keys: ['Alt', '2'], desc: 'Jump to OPD Queue & Triage Vitals' },
    { keys: ['Alt', '3'], desc: 'Jump to Smart OPD Prescription Pad' },
    { keys: ['Alt', '4'], desc: 'Jump to IPD Ward & Bed Board' },
    { keys: ['Alt', '5'], desc: 'Jump to Patients (UHID) Directory' },
    { keys: ['Alt', '6'], desc: 'Jump to MedWiki Drug Formulary' },
    { keys: ['Alt', '7'], desc: 'Jump to Lab & Unified Billing' },
    { keys: ['Alt', '8'], desc: 'Jump to Refer & Earn Affiliate Hub' },
    { keys: ['Esc'], desc: 'Dismiss active modal or command palette' },
  ]

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">Workspace Keyboard Shortcuts</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 text-xs">
          {shortcuts.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-2.5">
              <span className="text-slate-700 font-medium">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 shadow-2xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// #14 TIER-BASED UI INDICATORS & QUOTA BARS
// ============================================================================
export interface PlanUsageSummary {
  planName: string
  tier: string
  status: string
  billingCycle?: string
  doctorsUsed: number
  doctorLimit: number
  bedsUsed: number
  bedLimit: number
  staffUsed: number
  staffLimit: number
  branchesUsed: number
  branchLimit: number
}

export function TierBadge({ tier, planName, status }: { tier?: string; planName?: string; status?: string }) {
  const t = (tier || 'advance').toLowerCase()
  const isEnterprise = t.includes('enterprise')
  const isAdvance = t.includes('advance')
  const isTrial = status === 'trialing'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
        isTrial
          ? 'bg-amber-100 text-amber-800 border border-amber-300'
          : isEnterprise
          ? 'bg-violet-100 text-violet-800 border border-violet-200'
          : isAdvance
          ? 'bg-teal-100 text-teal-800 border border-teal-200'
          : 'bg-slate-200 text-slate-700'
      }`}
    >
      {isEnterprise ? <Crown className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
      {planName || tier || 'SaaS Plan'}
      {isTrial ? ' · TRIAL' : ''}
    </span>
  )
}

export function PlanQuotaCard({
  usage,
  onOpenSettings,
}: {
  usage: PlanUsageSummary | null
  onOpenSettings?: () => void
}) {
  if (!usage) return null
  const meters = [
    { label: 'Doctors', used: usage.doctorsUsed, max: usage.doctorLimit },
    { label: 'IPD Beds', used: usage.bedsUsed, max: usage.bedLimit },
    { label: 'Hospital Staff', used: usage.staffUsed, max: usage.staffLimit },
    { label: 'Branches', used: usage.branchesUsed, max: usage.branchLimit },
  ]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">Subscription Plan &amp; Resource Quotas</h3>
          <TierBadge tier={usage.tier} planName={usage.planName} status={usage.status} />
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-bold text-teal-700 hover:underline"
          >
            Manage Plan &amp; Staff →
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {meters.map((m) => {
          const pct = m.max > 0 ? Math.min(100, Math.round((m.used / m.max) * 100)) : 0
          const nearLimit = pct >= 80
          return (
            <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-600">{m.label}</span>
                <span className={nearLimit ? 'text-amber-700 font-bold' : 'text-slate-900'}>
                  {m.used} / {m.max}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 95
                      ? 'bg-rose-500'
                      : nearLimit
                      ? 'bg-amber-500'
                      : 'bg-teal-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Re-exports from sibling modules for convenient single import
export {
  BentoDashboardCard,
  BentoDashboardGrid,
} from './BentoDashboardCard'
export { BreadcrumbNav } from './BreadcrumbNav'
export { QuickActionFloating, QuickActionFab } from './QuickActionFloating'
export { EnhancedFilterBar } from './EnhancedFilterBar'
export {
  ModuleAccessGate,
  useSidebarModules,
} from './ModuleAccessGate'
export {
  type ModuleDefinition,
  type UserContext,
  type PlanFeatures,
  type ClinicModelConfig,
  type HmsModuleId,
  canAccessModule,
  getAccessibleModules,
  inferClinicModel,
  parsePlanFeatures,
  ROLE_INFO,
} from '@/lib/role-access'

// ============================================================================
// #19 DESTRUCTIVE ACTION PROTECTION MODAL
// ============================================================================
export function ConfirmDestructiveModal({
  open,
  title,
  description,
  confirmText,
  requireExactMatch,
  confirmButtonLabel = 'Permanently Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmText?: string
  requireExactMatch?: string
  confirmButtonLabel?: string
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  if (!open) return null

  const canConfirm = requireExactMatch ? typed.trim() === requireExactMatch.trim() : true

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
          </div>
        </div>

        {confirmText && (
          <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-xs text-rose-800">
            {confirmText}
          </div>
        )}

        {requireExactMatch && (
          <div className="mt-4 text-xs">
            <label className="block font-semibold text-slate-700 mb-1">
              Type <span className="font-mono font-bold text-rose-700">{requireExactMatch}</span> to confirm:
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireExactMatch}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setTyped('')
              onCancel()
            }}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={async () => {
              await onConfirm()
              setTyped('')
            }}
            className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-40 transition"
          >
            {busy ? 'Processing...' : confirmButtonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
