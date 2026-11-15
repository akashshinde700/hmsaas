'use client'

import React, { useMemo } from 'react'
import { ChevronRight, Home, Activity, Stethoscope, BedDouble, Users, Pill, CreditCard, Gift, Settings, Database } from 'lucide-react'
import Link from 'next/link'

const ICONS: Record<string, React.ElementType> = {
  overview: Home,
  opd: Activity,
  rx: Stethoscope,
  ipd: BedDouble,
  patients: Users,
  medicines: Pill,
  pharmacy: Database,
  billing: CreditCard,
  referrals: Gift,
  settings: Settings,
}

const LABELS: Record<string, string> = {
  overview: 'Command Overview',
  opd: 'OPD Queue',
  rx: 'Smart Rx Pad',
  ipd: 'IPD Ward Board',
  patients: 'Patient Directory',
  medicines: 'Medicine Formulary',
  billing: 'Lab & Billing',
  referrals: 'Refer & Earn',
  settings: 'Hospital Settings',
}

export interface BreadcrumbItem {
  label: string
  href?: string
  moduleId?: string
}

export function BreadcrumbNav({ items }: { items: BreadcrumbItem[] }) {
  const breadcrumbs = useMemo(() => {
    return items.map((item, idx) => {
      const Icon = ICONS[item.moduleId || ''] || Home
      const last = idx === items.length - 1
      return (
        <React.Fragment key={item.label}>
          {!last && item.href ? (
            <Link
              href={item.href}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition"
            >
              <Icon className="h-3 w-3" />
              <span className="font-medium">{item.label}</span>
              <ChevronRight className="h-3 w-3 text-slate-400" />
            </Link>
          ) : !last && !item.href ? (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Icon className="h-3 w-3 opacity-50" />
              <span className="font-medium text-slate-400">{item.label}</span>
              <ChevronRight className="h-3 w-3 text-slate-400" />
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-slate-900">
              <Icon className="h-3 w-3 text-teal-600" />
              <span>{item.label}</span>
            </span>
          )}
        </React.Fragment>
      )
    })
  }, [items])

  if (breadcrumbs.length === 0) return null

  return (
    <div className="flex items-center gap-2 text-[10px] mb-2">
      <span className="text-slate-400 font-bold uppercase tracking-wider">You are here</span>
      {breadcrumbs}
    </div>
  )
}