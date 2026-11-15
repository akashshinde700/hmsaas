import Link from 'next/link'
import { dbUnscoped } from '@/lib/db'
import SaaSLandingPage from '@/components/landing/SaaSLandingPage'

const NAV_LINKS = [
  { href: '/referrals', label: 'Referrals (Earn 20%)' },
  { href: '/blog', label: 'Insights' },
  { href: '/platform-admin', label: 'Platform Admin' },
  { href: '/login', label: 'Hospital Login' },
] as const

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const rows = await dbUnscoped.plan.findMany({
    where: { isActive: true, isCustom: false },
    orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
  })

  const initialPlans = rows.map((p) => ({
    ...p,
    features: (() => {
      try {
        return JSON.parse(p.featuresJson || '{}')
      } catch {
        return {}
      }
    })(),
  }))

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-sm shadow-teal-600/20">
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l3 3 4 4-7-7-7 7 4-4 3-3h4"></path>
                <path d="M12 22c-4.71 0-8.53-3.82-8.53-8.53 0-3.78 2.43-7.01 5.82-8.16 0.26-0.09 0.53-0.09 0.79 0 3.39 1.15 5.82 4.38 5.82 8.16 0 4.71-3.82 8.53-8.53 8.53Z"></path>
              </svg>
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                AetherMed <span className="text-teal-600">Cloud</span>
              </span>
              <p className="text-[11px] font-medium text-slate-500">by AetherDev Solutions</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition">
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-lg border border-teal-200 bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
            >
              Hospital Login
            </Link>
          </div>
        </div>
      </nav>
      <SaaSLandingPage initialPlans={initialPlans} />
    </>
  )
}
