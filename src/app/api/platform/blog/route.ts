import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const posts = await dbUnscoped.blogPost.findMany({ orderBy: { publishedAt: 'desc' } })
  return apiJson(posts, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const title = String(body.title || '').trim()
  if (!title) return apiJson({ error: 'Title required.' }, { status: 400, startMs })

  const slug = `${makeSlug(title)}-${Math.floor(10 + Math.random() * 89)}`
  const post = await dbUnscoped.blogPost.create({
    data: {
      slug,
      title,
      category: String(body.category || 'Hospital SaaS').trim(),
      description: String(body.description || title).trim(),
      body: String(body.body || '').trim(),
      isPublished: body.isPublished !== false,
    },
  })
  invalidateCachePrefix('public:blog')
  return apiJson(post, { status: 201, startMs })
}

export async function PUT(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const id = String(body.id || '')
  const updated = await dbUnscoped.blogPost.update({
    where: { id },
    data: {
      title: String(body.title || '').trim(),
      category: String(body.category || 'Hospital SaaS').trim(),
      description: String(body.description || '').trim(),
      body: String(body.body || '').trim(),
      isPublished: Boolean(body.isPublished),
    },
  })
  invalidateCachePrefix('public:blog')
  return apiJson(updated, { startMs })
}

export async function DELETE(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  await dbUnscoped.blogPost.delete({ where: { id } })
  invalidateCachePrefix('public:blog')
  return apiJson({ success: true }, { startMs })
}
