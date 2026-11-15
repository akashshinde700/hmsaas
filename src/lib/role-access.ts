/*
 * =============================================================================
 * ROLE & PLAN ACCESS CONTROL — AetherMed Cloud HMS
 * =============================================================================
 *
 * Central, single-source-of-truth for deciding which workspace modules a logged-in
 * user can see and use. Driven by two dimensions:
 *
 *   1. USER ROLE  (super_admin, admin, doctor, nurse, receptionist, pharmacist, billing)
 *   2. PLAN FEATURES (opd, ipd, medwiki, lab, pharmacy, customBranding, analytics)
 *
 * Supported clinic models (configured per Organization via Platform Admin):
 *   • "OPD ONLY"        → OPD Queue, Rx Pad, Patients, Medicines (no IPD beds/admissions)
 *   • "IPD ONLY"        → IPD Ward Board, Admissions, MAR, Billing (no OPD queue)
 *   • "OPD + IPD"       → Both OPD and IPD modules (most multi-specialty hospitals)
 *   • "FULL HOSPITAL"   → Everything including Lab, Pharmacy, Analytics, Referrals
 *
 * Single-doctor clinics: doctor role auto-restricts to that doctor's own patients
 * and hides admin-only modules (staff management, plan settings).
 */

// -----------------------------------------------------------------------------
// Module identifiers (must match dashboard NAV_ITEMS ids)
// -----------------------------------------------------------------------------
export type HmsModuleId =
  | 'overview'
  | 'opd'
  | 'rx'
  | 'ipd'
  | 'patients'
  | 'medicines'
  | 'pharmacy'
  | 'billing'
  | 'referrals'
  | 'settings'

export interface ModuleDefinition {
  id: HmsModuleId
  label: string
  shortLabel: string
  shortcut: string
  iconName: string
  // Which plan feature gates this module (undefined = always available by role)
  planFeature?: string
  // Which roles can see this module by default
  defaultRoles: HmsRole[]
  // Modules hidden from doctors unless they own the patient context
  doctorRestricted?: boolean
  // Modules hidden from single-doctor clinics
  hiddenForSingleDoctor?: boolean
}

export type HmsRole =
  | 'super_admin'
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'pharmacist'
  | 'billing'

export interface UserContext {
  userId: string
  organizationId: string
  role: HmsRole
  name: string
  email: string
  isDoctor?: boolean
}

export interface PlanFeatures {
  opd: boolean
  ipd: boolean
  medwiki: boolean
  lab: boolean
  pharmacy: boolean
  customBranding: boolean
  analytics: boolean
}

export interface ClinicModelConfig {
  modelType: 'opd_only' | 'ipd_only' | 'opd_ipd' | 'full_hospital'
  singleDoctor: boolean
}

// -----------------------------------------------------------------------------
// Module registry with role & plan gating
// -----------------------------------------------------------------------------
export const MODULE_REGISTRY: Record<HmsModuleId, ModuleDefinition> = {
  overview: {
    id: 'overview',
    label: 'Command Overview',
    shortLabel: 'Overview',
    shortcut: 'Alt+1',
    iconName: 'LayoutDashboard',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'billing'],
  },
  opd: {
    id: 'opd',
    label: 'OPD Queue & Vitals',
    shortLabel: 'OPD',
    shortcut: 'Alt+2',
    iconName: 'Activity',
    planFeature: 'opd',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist'],
  },
  rx: {
    id: 'rx',
    label: 'Smart Rx Pad',
    shortLabel: 'Rx Pad',
    shortcut: 'Alt+3',
    iconName: 'Stethoscope',
    planFeature: 'medwiki',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse'],
    doctorRestricted: true,
  },
  ipd: {
    id: 'ipd',
    label: 'IPD & Bed Board',
    shortLabel: 'IPD',
    shortcut: 'Alt+4',
    iconName: 'BedDouble',
    planFeature: 'ipd',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse'],
    hiddenForSingleDoctor: true,
  },
  patients: {
    id: 'patients',
    label: 'Patients (UHID)',
    shortLabel: 'Patients',
    shortcut: 'Alt+5',
    iconName: 'Users',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'billing'],
  },
  medicines: {
    id: 'medicines',
    label: 'Medicine Formulary',
    shortLabel: 'Meds',
    shortcut: 'Alt+6',
    iconName: 'Pill',
    planFeature: 'pharmacy',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse', 'pharmacist'],
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacy Stock',
    shortLabel: 'Pharmacy',
    shortcut: 'Alt+P',
    iconName: 'Database',
    planFeature: 'pharmacy',
    defaultRoles: ['super_admin', 'admin', 'doctor', 'nurse', 'pharmacist'],
  },
  billing: {
    id: 'billing',
    label: 'Lab & Billing',
    shortLabel: 'Billing',
    shortcut: 'Alt+7',
    iconName: 'CreditCard',
    planFeature: 'lab',
    defaultRoles: ['super_admin', 'admin', 'billing', 'receptionist'],
    hiddenForSingleDoctor: true,
  },
  referrals: {
    id: 'referrals',
    label: 'Refer & Earn',
    shortLabel: 'Refer',
    shortcut: 'Alt+8',
    iconName: 'Gift',
    defaultRoles: ['super_admin', 'admin', 'doctor'],
  },
  settings: {
    id: 'settings',
    label: 'Hospital Settings',
    shortLabel: 'Settings',
    shortcut: 'Alt+9',
    iconName: 'Settings',
    defaultRoles: ['super_admin', 'admin'],
    hiddenForSingleDoctor: true,
  },
}

// -----------------------------------------------------------------------------
// Default plan feature presets per clinic model
// -----------------------------------------------------------------------------
export const CLINIC_MODEL_PRESETS: Record<ClinicModelConfig['modelType'], PlanFeatures> = {
  opd_only: {
    opd: true,
    ipd: false,
    medwiki: true,
    lab: false,
    pharmacy: true,
    customBranding: true,
    analytics: false,
  },
  ipd_only: {
    opd: false,
    ipd: true,
    medwiki: true,
    lab: true,
    pharmacy: true,
    customBranding: true,
    analytics: false,
  },
  opd_ipd: {
    opd: true,
    ipd: true,
    medwiki: true,
    lab: true,
    pharmacy: true,
    customBranding: true,
    analytics: false,
  },
  full_hospital: {
    opd: true,
    ipd: true,
    medwiki: true,
    lab: true,
    pharmacy: true,
    customBranding: true,
    analytics: true,
  },
}

// -----------------------------------------------------------------------------
// Parse plan featuresJson (stored as JSON string on Plan model)
// -----------------------------------------------------------------------------
export function parsePlanFeatures(featuresJson?: string | null): PlanFeatures {
  const defaults: PlanFeatures = {
    opd: true,
    ipd: true,
    medwiki: true,
    lab: true,
    pharmacy: true,
    customBranding: true,
    analytics: false,
  }
  if (!featuresJson) return defaults
  try {
    const parsed = JSON.parse(featuresJson) as Partial<PlanFeatures>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

// -----------------------------------------------------------------------------
// Determine clinic model from plan + organization settings
// -----------------------------------------------------------------------------
export function inferClinicModel(
  planFeatures: PlanFeatures,
  organizationType?: string | null,
  hasIpdBeds?: boolean | null,
): ClinicModelConfig {
  const hasOPD = planFeatures.opd
  const hasIPD = planFeatures.ipd
  const singleDoctor = organizationType === 'clinic' || !hasIpdBeds

  let modelType: ClinicModelConfig['modelType']
  if (hasOPD && hasIPD) modelType = 'opd_ipd'
  else if (hasOPD && !hasIPD) modelType = 'opd_only'
  else if (!hasOPD && hasIPD) modelType = 'ipd_only'
  else modelType = 'full_hospital'

  return { modelType, singleDoctor }
}

// -----------------------------------------------------------------------------
// Core access check
// -----------------------------------------------------------------------------
export function canAccessModule(
  moduleId: HmsModuleId,
  ctx: UserContext,
  planFeatures: PlanFeatures,
  clinicModel: ClinicModelConfig,
): boolean {
  const mod = MODULE_REGISTRY[moduleId]
  if (!mod) return false

  // Platform super_admin bypasses almost everything
  if (ctx.role === 'super_admin') return true

  // Plan feature gate
  if (mod.planFeature && !planFeatures[mod.planFeature as keyof PlanFeatures]) {
    return false
  }

  // Single-doctor clinics hide heavy admin modules (super_admin already returned true above)
  if (clinicModel.singleDoctor && mod.hiddenForSingleDoctor) {
    return ctx.role === 'admin'
  }

  // Role-based allowlist
  if (!mod.defaultRoles.includes(ctx.role)) return false

  // Doctor restriction: doctors see Rx/Patients only for their own context (handled at UI level)
  if (mod.doctorRestricted && ctx.role === 'doctor') return true

  return true
}

// -----------------------------------------------------------------------------
// Get all accessible modules for a user, sorted by NAV order
// -----------------------------------------------------------------------------
export function getAccessibleModules(
  ctx: UserContext,
  planFeatures: PlanFeatures,
  clinicModel: ClinicModelConfig,
): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((mod) =>
    canAccessModule(mod.id, ctx, planFeatures, clinicModel),
  )
}

// -----------------------------------------------------------------------------
// Shortcut key → module id lookup
// -----------------------------------------------------------------------------
export function getModuleByShortcut(shortcut: string): HmsModuleId | null {
  for (const mod of Object.values(MODULE_REGISTRY)) {
    if (mod.shortcut === shortcut) return mod.id
  }
  return null
}

// -----------------------------------------------------------------------------
// Role display info
// -----------------------------------------------------------------------------
export const ROLE_INFO: Record<HmsRole, { label: string; color: string; description: string }> = {
  super_admin: { label: 'Platform Super Admin', color: 'violet', description: 'Full platform control across all clinics' },
  admin: { label: 'Hospital Admin', color: 'teal', description: 'Manage staff, settings, plans, and all modules' },
  doctor: { label: 'Consulting Doctor', color: 'sky', description: 'OPD consultations, prescriptions, IPD rounds for own patients' },
  nurse: { label: 'IPD Nurse', color: 'emerald', description: 'Ward board, vitals, MAR medication administration' },
  receptionist: { label: 'Front Desk', color: 'amber', description: 'OPD tokens, patient registration, billing payments' },
  pharmacist: { label: 'Pharmacist', color: 'violet', description: 'Medicine formulary, prescription dispensing' },
  billing: { label: 'Billing Desk', color: 'rose', description: 'Invoices, payments, deposits, financial settlement' },
}