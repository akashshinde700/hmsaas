import { dbUnscoped } from '@/lib/db'
import { apiJson, getOrSetCache } from '@/lib/cache'

export async function GET() {
  const startMs = performance.now()
  const { data, hit } = await getOrSetCache('public:plans', 30_000, async () => {
    const rows = await dbUnscoped.plan.findMany({
      where: { isActive: true, isCustom: false },
      orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
    })
    return rows.map((p) => ({
      ...p,
      features: safeJson(p.featuresJson),
    }))
  })

  return apiJson(data, {
    startMs,
    cacheHit: hit,
    cacheControl: 'public, max-age=15, stale-while-revalidate=60',
  })
}

function safeJson(str: string): Record<string, boolean> {
  try {
    return JSON.parse(str || '{}')
  } catch {
    return {}
  }
}
