'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, RefreshCw } from 'lucide-react'
import { AuditLogTable } from '@/components/audit/AuditLogTable'

export default function AuditLogsPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState('')

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('hms_tenant_session='))
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('=')[1], 'base64').toString('utf8')
      )
      if (payload.kind !== 'tenant') {
        router.push('/login')
        return
      }
      setOrgId(payload.organizationId)
    } catch {
      router.push('/login')
    }
  }, [router])

  if (!orgId) return null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-700" /> Audit Log
            </h1>
            <p className="text-sm text-slate-500">
              Track all actions across your organization for compliance.
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 transition"
            onClick={() => window.dispatchEvent(new Event('online'))}
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        <AuditLogTable organizationId={orgId} />
      </div>
    </div>
  )
}
