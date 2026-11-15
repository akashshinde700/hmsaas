import { dbUnscoped } from '@/lib/db'
import SaaSLandingPage from '@/components/landing/SaaSLandingPage'

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

  return <SaaSLandingPage initialPlans={initialPlans} />
}
