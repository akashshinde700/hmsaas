import Link from 'next/link'
import { dbUnscoped } from '@/lib/db'
import { ArrowLeft, Calendar, Clock, HeartPulse } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BlogIndexPage() {
  const posts = await dbUnscoped.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <HeartPulse className="h-4 w-4" />
            </div>
            <span className="font-extrabold text-slate-900">AetherMed Insights</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold text-slate-900">
          Hospital Operations, IPD Automation &amp; Clinical SaaS Guides
        </h1>
        <p className="mt-2 text-slate-600 text-sm">
          Managed live from the AetherMed Platform Admin portal.
        </p>

        <div className="mt-8 space-y-6">
          {posts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-semibold text-teal-700">
                  {post.category}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.publishedAt).toLocaleDateString('en-IN')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {post.readTimeMin} min read
                </span>
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-900">{post.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{post.description}</p>
              <div className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-700 leading-relaxed">
                {post.body}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
