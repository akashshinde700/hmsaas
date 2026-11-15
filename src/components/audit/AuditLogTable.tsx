'use client'

import { useEffect, useState } from 'react'
import { Search, Filter, Clock, User, FileText, ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLogEntry {
  id: string
  actorName: string
  actorRole: string
  action: string
  entity: string
  details?: string | null
  createdAt: string
}

interface AuditLogTableProps {
  organizationId: string
  initialFilter?: { actor?: string; action?: string; entity?: string }
}

export function AuditLogTable({ organizationId, initialFilter }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState({
    actor: initialFilter?.actor || '',
    action: initialFilter?.action || '',
    entity: initialFilter?.entity || '',
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/audit-logs?organizationId=${organizationId}&limit=50&page=${page}&actor=${encodeURIComponent(filter.actor)}&action=${encodeURIComponent(filter.action)}&entity=${encodeURIComponent(filter.entity)}`
        )
        const data = await res.json()
        if (mounted) {
          setLogs(data.logs || [])
          setLoading(false)
        }
      } catch {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [organizationId, page, filter.actor, filter.action, filter.entity])

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Audit Log</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search actor…"
              value={filter.actor}
              onChange={(e) => setFilter({ ...filter, actor: e.target.value })}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
            />
            <input
              type="text"
              placeholder="Filter action…"
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Time
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actor
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Role
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Action
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Entity
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-slate-500 dark:text-slate-400">
                  Loading audit logs…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-slate-500 dark:text-slate-400">
                  No audit records found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {log.actorName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        log.actorRole === 'super_admin'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          : log.actorRole === 'admin'
                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                            : log.actorRole === 'doctor'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}
                    >
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
                    {log.entity}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                    {log.details || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Showing {logs.length} record(s)
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800">
            {page}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
