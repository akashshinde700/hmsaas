import { dbUnscoped } from '@/lib/db'
import { apiJson, getOrSetCache } from '@/lib/cache'

export async function GET() {
  const startMs = performance.now()
  const { data, hit } = await getOrSetCache('public:blog', 30_000, async () => {
    return dbUnscoped.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
    })
  })
  return apiJson(data, { startMs, cacheHit: hit })
}
