'use client'

import { motion } from 'motion/react'
import {
  Activity,
  BedDouble,
  CreditCard,
  Database,
  Users,
  Gift,
  Settings,
  HeartPulse,
  Clock,
  TrendingUp,
} from 'lucide-react'

interface BentoCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.ElementType
  color: 'teal' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet'
  onClick?: () => void
  href?: string
  trend?: { label: string; value: number; positive: boolean }
}

const COLOR_CLASSES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-600', text: 'text-teal-700' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'text-sky-600', text: 'text-sky-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', text: 'text-amber-700' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600', text: 'text-rose-700' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', text: 'text-violet-700' },
}

export function BentoDashboardCard({
  title,
  value,
  sub,
  icon: Icon,
  color = 'teal',
  onClick,
  href,
  trend,
}: BentoCardProps) {
  const cls = COLOR_CLASSES[color]
  const isLink = Boolean(href || onClick)

  return (
    <motion.div
      onClick={onClick || (href ? () => { window.location.href = href } : undefined)}
      role={isLink ? "button" : undefined}
      tabIndex={isLink ? 0 : undefined}
      onKeyDown={isLink ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (onClick) onClick(); else if (href) window.location.href = href } } : undefined}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`rounded-2xl border ${cls.border} bg-white p-5 shadow-2xs transition-all duration-200 ${
        isLink ? 'cursor-pointer hover:border-teal-400 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span className="font-semibold">{title}</span>
        <div className={`rounded-xl p-1.5 ${cls.bg}`}>
          <Icon className={`h-4 w-4 ${cls.icon}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-slate-900">{value}</span>
        {trend && (
          <span
            className={`text-xs font-bold ${
              trend.positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className={`mt-1 text-[11px] font-medium ${cls.text}`}>{sub}</p>
      {trend && (
        <p className="mt-2 text-[10px] text-slate-400">
          {trend.label} <span className="font-medium">{trend.positive ? '+' : '-'}{trend.value}%</span>
        </p>
      )}
      {isLink && (
        <div className="mt-3 flex items-center gap-1 text-xs font-bold text-slate-500">
          Open →
          <span className="text-slate-400">↗</span>
        </div>
      )}
    </motion.div>
  )
}

/*
 * BentoDashboardGrid — Animated staggered bento grid of KPI cards.
 * Cards animate in with a slight stagger for a premium SaaS feel.
 */
interface BentoDashboardGridProps {
  cards: BentoCardProps[]
}

export function BentoDashboardGrid({ cards }: BentoDashboardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06 }}
          className="flex flex-col"
        >
          <BentoDashboardCard {...card} />
        </motion.div>
      ))}
    </div>
  )
}