export interface ClinicSettingsData {
  clinicDisplayName: string
  tagline?: string | null
  address?: string | null
  phone?: string | null
  emergencyPhone?: string | null
  email?: string | null
  gstNumber?: string | null
  uhidPrefix: string
  upiId?: string | null
  bankName?: string | null
  bankAccountNo?: string | null
  bankIfsc?: string | null
  rxFooterNote?: string | null
  // Patient Portal access control
  patientPortalEnabled?: boolean
  portalWelcomeMessage?: string | null
}

export interface DoctorOption {
  id: string
  name: string
  role: string
  specialization?: string | null
  qualification?: string | null
  registrationNo?: string | null
  consultationFee: number
}

export interface PatientRecord {
  id: string
  uhid: string
  name: string
  gender: string
  ageYears?: number | null
  bloodGroup?: string | null
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  allergies?: string | null
  chronicConditions?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  insuranceProvider?: string | null
  isVip: boolean
  ipdAdmissions?: Array<{ id: string; admissionNo: string; bed?: { bedNumber: string } }>
  _count?: { prescriptions: number; ipdAdmissions: number }
}

export interface MedicineSearchResult {
  id: string
  name: string
  genericName?: string | null
  composition?: string | null
  brand?: string | null
  manufacturer?: string | null
  dosageForm: string
  strength?: string | null
  packSize?: string | null
  category: string
  mrp?: number | null
  schedule?: string | null
  isControlled: boolean
  isCustom: boolean
  source: string
  usageCount: number
  doctorUsage: number
  defaultDosage: string
  defaultFrequency: string
  defaultDuration: string
  defaultTiming: string
  defaultRoute: string
  defaultInstructions?: string | null
  uses?: string | null
}
