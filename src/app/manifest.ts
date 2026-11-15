import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'AetherMed Cloud HMS — OPD, IPD & Pharmacy SaaS',
    short_name: 'AetherMed HMS',
    description:
      'Multi-tenant Hospital & Clinic Management SaaS — OPD Queue, Smart Rx with MedWiki Drug Engine, Live IPD Ward Bed Board, Discharge Summaries & Billing.',
    start_url: '/login?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0d9488',
    categories: ['medical', 'health', 'business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
