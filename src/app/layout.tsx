import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { PwaServiceWorkerRegister } from '@/components/pwa/PwaInstall'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: 'AetherMed Cloud HMS — OPD, IPD & Smart Drug SaaS Platform',
  description:
    'Next-generation Multi-Tenant Hospital & Clinic Management SaaS by AetherDev Solutions. Unified OPD Queue, Smart Rx with Continuous MedWiki Drug Sync, Live IPD Ward & Bed Board, Discharge Summaries, GST Billing & Platform Admin.',
  applicationName: 'AetherMed Cloud HMS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AetherMed HMS',
  },
}

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <ThemeProvider>
          <PwaServiceWorkerRegister />
          {children}
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
