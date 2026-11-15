'use client'

import { useState, useCallback } from 'react'
import { Filter, X, Clock, Search } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useSaaSUX'

interface FilterOption {
  value: string
  label: string
  color?: string
}

interface FilterFacet {
  key: string
  label: string
  options: FilterOption[]
  initialValue?: string
}

interface EnhancedFilterBarProps {
  filters: FilterFacet[]
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onFilterChange?: (filters: Record<string, string>) => void
  onReset?: () => void
  compact?: boolean
}

export function EnhancedFilterBar({
  filters,
  searchPlaceholder = 'Search records...',
  searchValue = '',
  onSearchChange,
  onFilterChange,
  onReset,
  compact = false,
}: EnhancedFilterBarProps) {
  const [rawSearch, setRawSearch] = useState(searchValue)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const debouncedSearch = useDebouncedValue(rawSearch, 160)

  // Initialize filters from initialValue
  useCallback(() => {
    const initial: Record<string, string> = {}
    for (const f of filters) {
      if (f.initialValue) initial[f.key] = f.initialValue
    }
    setActiveFilters(initial)
  }, [])

  const activeCount =
    Object.values(activeFilters).filter((v) => v && v !== 'ALL').length +
    (rawSearch ? 1 : 0)

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev, [key]: value }
      onFilterChange?.(next)
      return next
    })
  }

  const handleReset = () => {
    setRawSearch('')
    setActiveFilters({})
    onSearchChange?.('')
    onFilterChange?.({})
    onReset?.()
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-2xs ${
        compact ? 'sm:flex sm:items-center sm:justify-between sm:gap-3' : 'flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3'
      }`}
    >
      {/* Search */}
      <div
        className={`relative min-w-[200px] flex-1 ${
          compact ? 'max-w-sm' : 'max-w-md'
        }`}
      >
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          value={rawSearch}
          onChange={(e) => {
            setRawSearch(e.target.value)
            onSearchChange?.(e.target.value)
          }}
          placeholder={searchPlaceholder}
          className={`w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-8 py-2.5 ${
            compact ? 'text-xs px-3' : 'text-sm px-4'
          } focus:border-teal-500 focus:bg-white focus:outline-none transition`}
        />
        {rawSearch && (
          <button
            type="button"
            onClick={() => {
              setRawSearch('')
              onSearchChange?.('')
            }}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 min-w-[220px]">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <Filter className="h-3.5 w-3.5 text-teal-600" />
            Filters
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-teal-600 px-1.5 py-0.2 text-[10px] text-white">
                {activeCount}
              </span>
            )}
          </span>
          {filters.map((f) => {
            const current = activeFilters[f.key] || 'ALL'
            const option = f.options.find((o) => o.value === current)
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  const next = current === 'ALL' ? f.options[0]?.value || 'ALL' : 'ALL'
                  handleFilterChange(f.key, next)
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
                  current === 'ALL'
                    ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    : 'border-teal-200 bg-teal-50 text-teal-700'
                }`}
              >
                {f.label}:{' '}
                <span
                  className={`font-bold ${
                    current === 'ALL' ? 'text-slate-500' : 'text-teal-800'
                  }`}
                >
                  {current === 'ALL' ? 'All' : option?.label || current}
                </span>
                {current !== 'ALL' && (
                  <X className="h-3 w-3 text-teal-500 opacity-60 hover:opacity-100" />
                )}
              </button>
            )
          })}
          {(activeCount > 0 || rawSearch) && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-teal-700 hover:underline px-2"
            >
              Reset all
            </button>
          )}
        </div>
      )}

      {/* Active filter pills (compact summary) */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
          {Object.entries(activeFilters).map(([key, val]) => {
            if (val === 'ALL') return null
            const f = filters.find((f) => f.key === key)
            const option = f?.options.find((o) => o.value === val)
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs text-teal-700"
              >
                {f?.label}: {option?.label || val}
                <button
                  type="button"
                  onClick={() => handleFilterChange(key, 'ALL')}
                  className="ml-1 text-teal-500 hover:text-teal-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
          {rawSearch && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
              Search: "{rawSearch}"
              <button
                type="button"
                onClick={() => {
                  setRawSearch('')
                  onSearchChange?.('')
                }}
                className="ml-1 text-amber-500 hover:text-amber-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}