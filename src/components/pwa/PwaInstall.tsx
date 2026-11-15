'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let savedPrompt: BeforeInstallPromptEvent | null = null
const subscribers = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    savedPrompt = e as BeforeInstallPromptEvent
    subscribers.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    savedPrompt = null
    subscribers.forEach((fn) => fn())
  })
}

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const sync = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
      setAvailable(Boolean(savedPrompt) && !standalone)
    }
    sync()
    subscribers.add(sync)
    return () => {
      subscribers.delete(sync)
    }
  }, [])

  if (!available) return null

  return (
    <button
      type="button"
      onClick={async () => {
        if (!savedPrompt) return
        await savedPrompt.prompt()
        await savedPrompt.userChoice
        savedPrompt = null
        setAvailable(false)
      }}
      className={
        compact
          ? 'inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition'
          : 'inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-500/20 transition'
      }
    >
      <Download className="h-3.5 w-3.5" />
      Install HMS App
    </button>
  )
}
