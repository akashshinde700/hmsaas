'use client'

import { useMemo } from 'react'
import { Lock, ShieldAlert, Clock, BrainCircuit } from 'lucide-react'
import type { ModuleDefinition, UserContext, PlanFeatures, ClinicModelConfig } from '@/lib/role-access'
import {
  canAccessModule,
  getAccessibleModules,
  inferClinicModel,
  parsePlanFeatures,
  ROLE_INFO,
} from '@/lib/role-access'

/*
 * ModuleAccessGate — Wraps any module tab content and hides it when the current
 * user / plan combination does not have access. Falls back to a polite upgrade
 * card so the user understands WHY the module is locked and what to ask their
 * Platform Admin to enable.
 */
export interface ModuleAccessGateProps {
  moduleId: string
  user: UserContext | null
  featuresJson?: string | null
  organizationType?: string | null
  hasIpdBeds?: boolean | null
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ModuleAccessGate({
  moduleId,
  user,
  featuresJson,
  organizationType,
  hasIpdBeds,
  children,
  fallback,
}: ModuleAccessGateProps) {
  if (!user) return null

  const planFeatures = useMemo(() => parsePlanFeatures(featuresJson), [featuresJson])
  const clinicModel = useMemo(
    () => inferClinicModel(planFeatures, organizationType, hasIpdBeds),
    [planFeatures, organizationType, hasIpdBeds],
  )

  const allowed = useMemo(
    () => canAccessModule(moduleId as any, user, planFeatures, clinicModel),
    [moduleId, user, planFeatures, clinicModel],
  )

  if (!allowed) {
    const modInfoMap: Record<string, string> = {
      overview: 'Command Overview',
      opd: 'OPD Queue',
      rx: 'Smart Rx Pad',
      ipd: 'IPD Ward Board',
      patients: 'Patient Directory',
      medicines: 'Medicine Formulary',
      billing: 'Lab & Billing',
      referrals: 'Refer & Earn',
      settings: 'Hospital Settings',
    }
    const modInfo = modInfoMap[String(moduleId)] || String(moduleId)

    const roleInfo = (ROLE_INFO as Record<string, { label: string; color: string; description: string }>)[user.role]

    return (
      fallback ?? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4 shrink-0">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Module not available on your plan
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            <strong>{modInfo}</strong> is not included in your current clinic plan or is not
            accessible to your <strong>{roleInfo.label}</strong> role.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-left">
            <p className="font-semibold text-slate-700 mb-2">
              Your clinic model:
              <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-teal-700 font-bold">
                {clinicModel.modelType.replace('_', ' ').toUpperCase()}
              </span>
              {clinicModel.singleDoctor && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-amber-700 font-bold">
                  Single Doctor Mode
                </span>
              )}
            </p>
            <p className="text-slate-500">
              Ask your Platform Admin to enable the required plan feature (OPD / IPD / Lab /
              Pharmacy) or adjust your role permissions.
            </p>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}

/*
 * getSidebarModules — Returns the modules that should appear in the left sidebar
 * for the current user, filtered by access control.
 */
export function useSidebarModules(
  user: UserContext | null,
  featuresJson?: string | null,
  organizationType?: string | null,
  hasIpdBeds?: boolean | null,
  moduleVisibility?: Record<string, boolean> | null,
) {
  return useMemo(() => {
    if (!user) return []
    const planFeatures = parsePlanFeatures(featuresJson)
    const clinicModel = inferClinicModel(planFeatures, organizationType, hasIpdBeds)
    return getAccessibleModules(user, planFeatures, clinicModel, moduleVisibility)
  }, [user, featuresJson, organizationType, hasIpdBeds, moduleVisibility])
}

/*
 * LockedModuleBadge — Small badge shown next to a locked module in the sidebar
 * to indicate it requires a plan upgrade.
 */
export function LockedModuleBadge({ moduleId }: { moduleId: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200"
    >
      <ShieldAlert className="h-3 w-3" /> Locked
    </span>
  )
}

/*
 * PlanUpgradeNudge — Dismissible banner suggesting plan upgrade when user tries
 * to access a gated module repeatedly.
 */
export interface PlanUpgradeNudgeProps {
  open: boolean
  onDismiss: () => void
  moduleName: string
  requiredFeature?: string
}

export function PlanUpgradeNudge({ open, onDismiss, moduleName, requiredFeature }: PlanUpgradeNudgeProps) {
  if (!open) return null
  return (
    <div className="fixed bottom-24 left-4 z-50 w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-white shrink-0">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <div className="text-xs">
          <p className="font-bold text-amber-900">
            Unlock {moduleName}?
          </p>
          <p className="text-amber-800">
            Your plan does not include {requiredFeature || 'this module'}. Contact Platform Admin to upgrade.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-amber-500 hover:text-amber-700"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}