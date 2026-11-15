'use client'

import { useState } from 'react'
import { Plus, Stethoscope, BedDouble, CreditCard, Users, Search, Printer } from 'lucide-react'
import { motion } from 'motion/react'
import { AnimatePresence } from 'motion/react'

interface QuickAction {
  id: string
  label: string
  icon: React.ElementType
  color: 'teal' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet'
  onClick: () => void
}

const COLOR_BG: Record<string, string> = {
  teal: 'bg-teal-600 hover:bg-teal-700',
  sky: 'bg-sky-600 hover:bg-sky-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
  rose: 'bg-rose-600 hover:bg-rose-700',
  violet: 'bg-violet-600 hover:bg-violet-700',
}

interface QuickActionFloatingProps {
  actions: QuickAction[]
  floating?: boolean
}

export function QuickActionFloating({ actions, floating = true }: QuickActionFloatingProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full p-2.5 text-white shadow-lg transition-transform ${COLOR_BG[actions[0]?.color || 'teal']}`}
        aria-label="Quick actions"
      >
        <Plus className="h-5 w-5" />
      </button>

      {floating && open && (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-12 flex flex-col items-end gap-1.5"
          >
            {actions.slice(1).map((action) => (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  action.onClick()
                  setOpen(false)
                }}
                className={`rounded-full p-2.5 text-white shadow-md transition-all ${COLOR_BG[action.color]}`}
                title={action.label}
              >
                <action.icon className="h-4 w-4" />
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

/*
 * Compact single-action floating button (for mobile bottom-right quick access)
 */
export function QuickActionFab({ label, icon: Icon, color = 'teal', onClick }: QuickAction) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fixed bottom-6 right-6 rounded-full p-3 shadow-xl text-white transition-transform hover:scale-105 active:scale-95 z-40 ${COLOR_BG[color]}`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}