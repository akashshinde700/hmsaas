import { dbUnscoped } from './db'
import { invalidateCachePrefix } from './cache'

// ============================================================================
// MEDWIKI DRUG INTELLIGENCE & CONTINUOUS SYNC ENGINE
// Ported and enhanced from medwiki/ready.py — unifies:
//   1. Dosage form detection across 27 clinical forms
//   2. Route, default dosage, frequency & timing inference
//   3. Composition -> clean generic salt + combined strength extraction
//   4. Schedule H / H1 / X / OTC classification & therapeutic categorization
//   5. Compound deduplication key (`dedupKey`) + pre-computed `searchText`
// ============================================================================

export const FORM_PATTERNS: Array<[string, RegExp]> = [
  ['Eye Drop', /\beye\s*drops?\b|\bophthalmic\s*drops?\b|\bocular\s*drops?\b/i],
  ['Eye Ointment', /\beye\s*oint(?:ment)?\b|\bophthalmic\s*oint(?:ment)?\b/i],
  ['Ear Drop', /\bear\s*drops?\b|\botic\s*drops?\b|\botic\s*solution\b/i],
  ['Nasal Drop', /\bnasal\s*drops?\b|\bnasal\s*solution\b|\bnose\s*drops?\b/i],
  ['Nasal Spray', /\bnasal\s*spray\b|\bnasal\s*mist\b/i],
  ['Inhaler', /\binhaler\b|\brespule\b|\brotacap\b|\brotahaler\b|\bnebuliz/i],
  ['Infusion', /\binfusion\b|\biv\s*drip\b|\biv\s*fluid\b/i],
  ['Injection', /\binjection\b|\binj\.?\b|\bvial\b|\bampoule\b|\blyophili/i],
  ['Suspension', /\bsuspension\b|\bsusp\b|\bdry\s*syrup\b/i],
  ['Syrup', /\bsyrup\b|\boral\s*solution\b|\belixir\b|\blinctus\b/i],
  ['Capsule', /\bcapsule\b|\bcap\.?\b|\bsoftgel\b|\bsoft\s*gel/i],
  ['Tablet', /\btablet\b|\btab\.?\b|\bchewable\b|\bdispersible\b|\bsublingual\b|\bsr\b|\bxr\b|\bdt\b/i],
  ['Dusting Powder', /\bdusting\s*powder\b/i],
  ['Powder', /\bpowder\b|\bsachet\b|\bgranules\b/i],
  ['Ointment', /\bointment\b/i],
  ['Cream', /\bcream\b/i],
  ['Gel', /\bgel\b/i],
  ['Lotion', /\blotion\b|\bemulsion\b/i],
  ['Soap', /\bsoap\b/i],
  ['Shampoo', /\bshampoo\b/i],
  ['Spray', /\bspray\b|\baerosol\b/i],
  ['Patch', /\bpatch\b|\btransdermal\b/i],
  ['Suppository', /\bsuppository\b|\bpessary\b/i],
  ['Drops', /\bdrops?\b/i],
  ['Solution', /\bsolution\b|\bliquid\b/i],
]

export const ROUTE_BY_FORM: Record<string, string> = {
  Tablet: 'Oral',
  Capsule: 'Oral',
  Syrup: 'Oral',
  Suspension: 'Oral',
  Powder: 'Oral',
  'Dusting Powder': 'Topical',
  Solution: 'Oral',
  Drops: 'Oral',
  Injection: 'IV/IM',
  Infusion: 'IV Infusion',
  'Eye Drop': 'Ophthalmic',
  'Eye Ointment': 'Ophthalmic',
  'Ear Drop': 'Otic',
  'Nasal Drop': 'Nasal',
  'Nasal Spray': 'Nasal',
  Spray: 'Topical',
  Cream: 'Topical',
  Ointment: 'Topical',
  Gel: 'Topical',
  Lotion: 'Topical',
  Soap: 'Topical',
  Shampoo: 'Topical',
  Patch: 'Transdermal',
  Inhaler: 'Inhalation',
  Suppository: 'Rectal',
}

export const DEFAULT_DOSAGE_BY_FORM: Record<string, string> = {
  Tablet: '1 tablet',
  Capsule: '1 capsule',
  Syrup: '5 ml',
  Suspension: '5 ml',
  'Eye Drop': '1-2 drops',
  'Eye Ointment': 'Thin strip',
  'Ear Drop': '2 drops',
  'Nasal Drop': '2 drops',
  'Nasal Spray': '1 spray each nostril',
  Cream: 'Apply thin layer',
  Ointment: 'Apply thin layer',
  Gel: 'Apply thin layer',
  Lotion: 'Apply locally',
  Inhaler: '2 puffs',
  Injection: '1 vial',
  Infusion: '100 ml IV',
  Powder: '1 sachet',
  Drops: '10 drops',
  Patch: '1 patch',
  Suppository: '1 suppository',
  Solution: '5 ml',
}

export const DEFAULT_FREQ_BY_FORM: Record<string, string> = {
  Tablet: '1-0-1',
  Capsule: '1-0-1',
  Syrup: '1-1-1',
  Suspension: '1-1-1',
  'Eye Drop': '1-1-1',
  'Ear Drop': '1-0-1',
  'Nasal Spray': '1-0-1',
  Cream: '1-0-1',
  Ointment: '1-0-1',
  Gel: '1-0-1',
  Inhaler: '1-0-1',
  Injection: '1-0-1',
  Infusion: '1-0-0',
  Powder: '1-0-0',
  Drops: '1-1-1',
}

const CATEGORY_RULES: Array<[string, RegExp]> = [
  ['Antibiotic', /(cillin|mycin|floxacin|cef|azithro|doxy|metro|meropenem|piperacillin|linezolid|antibiotic)/i],
  ['Analgesic / Antipyretic', /(paracetamol|aceclofenac|ibuprofen|diclofenac|tramadol|etoricoxib|naproxen|ketorolac|pain|fever)/i],
  ['Gastrointestinal / PPI', /(prazole|pantoprazole|omeprazole|rabeprazole|esomeprazole|domperidone|ondansetron|antacid|sucralfate|lactulose)/i],
  ['Antidiabetic', /(metformin|glimepiride|dapagliflozin|empagliflozin|sitagliptin|vildagliptin|insulin|teneligliptin)/i],
  ['Cardiovascular / BP', /(telmisartan|amlodipine|losartan|ramipril|metoprolol|bisoprolol|atorvastatin|rosuvastatin|clopidogrel|aspirin|furosemide|spironolactone)/i],
  ['Respiratory / Asthma', /(montelukast|levocetirizine|salbutamol|budesonide|formoterol|ambroxol|dextromethorphan|acebrophylline|deriphyllin)/i],
  ['Antiallergic', /(cetirizine|fexofenadine|loratadine|hydroxyzine|chlorpheniramine|antihistamine)/i],
  ['IV Fluids / Critical Care', /(ringer|normal saline|dextrose|dns|noradrenaline|dopamine|adrenaline|heparin|albumin|mannitol)/i],
  ['Vitamin / Supplement', /(vitamin|cholecalciferol|methylcobalamin|calcium|iron|folic|zinc|multivitamin|b-complex|biotin)/i],
  ['Thyroid / Endocrine', /(levothyroxine|thyroxine|carbimazole|prednisolone|methylprednisolone|dexamethasone|hydrocortisone)/i],
  ['Neurology / Psychiatry', /(levetiracetam|valproate|pregabalin|gabapentin|amitriptyline|escitalopram|sertraline|clonazepam|alprazolam)/i],
  ['Antifungal / Antiviral', /(fluconazole|itraconazole|terbinafine|clotrimazole|acyclovir|oseltamivir)/i],
  ['Dermatology', /(mupirocin|fusidic|betamethasone|clobetasol|permethrin|calamine|ketoconazole)/i],
  ['Pediatrics', /(pediatric|drops|zinc gluconate|ors|oral rehydration|domstal baby)/i],
]

export function detectDosageForm(text?: string | null): string {
  if (!text) return 'Tablet'
  for (const [formName, regex] of FORM_PATTERNS) {
    if (regex.test(text)) return formName
  }
  return 'Tablet'
}

export function extractGenericFromComposition(composition?: string | null): string {
  if (!composition) return ''
  const parts = composition.split(/\s*\+\s*/)
  const generics: string[] = []
  for (const raw of parts.slice(0, 4)) {
    const cleaned = raw
      .replace(/\([\d.\s%a-zA-Z/]+\)/g, '')
      .replace(/\d+\.?\d*\s*(?:mg|mcg|iu|units?|ml|gm|g|%\s*w\/[vw]|%\s*v\/v|%)/gi, '')
      .replace(/[()[\]]/g, '')
      .trim()
      .replace(/^[,/]+|[,/]+$/g, '')
    if (cleaned.length > 1) {
      generics.push(cleaned)
    }
  }
  return generics.join(' + ')
}

export function extractStrengthFromComposition(composition?: string | null): string {
  if (!composition) return ''
  const matches = composition.match(
    /(\d+\.?\d*\s*(?:mg|mcg|iu|units?|ml|gm|g|%\s*w\/[vw]|%\s*v\/v|%))/gi
  )
  return matches ? matches.slice(0, 4).map((m) => m.trim()).join(' + ') : ''
}

export function categorizeMedicine(name: string, composition = '', uses = ''): string {
  const combined = `${name} ${composition} ${uses}`
  for (const [category, regex] of CATEGORY_RULES) {
    if (regex.test(combined)) return category
  }
  return 'General Medicine'
}

export interface RawMedicineInput {
  organizationId?: string | null
  name: string
  genericName?: string | null
  composition?: string | null
  brand?: string | null
  manufacturer?: string | null
  dosageForm?: string | null
  strength?: string | null
  packSize?: string | null
  category?: string | null
  therapeuticClass?: string | null
  mrp?: number | string | null
  schedule?: string | null
  requiresPrescription?: boolean
  defaultDosage?: string | null
  defaultFrequency?: string | null
  defaultDuration?: string | null
  defaultRoute?: string | null
  defaultTiming?: string | null
  defaultInstructions?: string | null
  uses?: string | null
  sideEffects?: string | null
  contraindications?: string | null
  source?: string
  sourceUrl?: string | null
}

export function normalizeMedicineRecord(input: RawMedicineInput) {
  const cleanName = (input.name || '').trim()
  const composition = (input.composition || '').trim() || null
  const genericName =
    (input.genericName || '').trim() ||
    extractGenericFromComposition(composition) ||
    cleanName
  const dosageForm =
    (input.dosageForm || '').trim() ||
    detectDosageForm(`${cleanName} ${input.packSize || ''}`)
  const strength =
    (input.strength || '').trim() ||
    extractStrengthFromComposition(composition) ||
    extractStrengthFromComposition(cleanName) ||
    null
  const manufacturer = (input.manufacturer || '').trim() || null
  const brand = (input.brand || cleanName).trim()
  const category =
    (input.category || '').trim() ||
    categorizeMedicine(cleanName, `${genericName} ${composition || ''}`, input.uses || '')
  const route = (input.defaultRoute || '').trim() || ROUTE_BY_FORM[dosageForm] || 'Oral'
  const defaultDosage =
    (input.defaultDosage || '').trim() || DEFAULT_DOSAGE_BY_FORM[dosageForm] || '1 tablet'
  const defaultFrequency =
    (input.defaultFrequency || '').trim() || DEFAULT_FREQ_BY_FORM[dosageForm] || '1-0-1'
  const defaultDuration = (input.defaultDuration || '').trim() || '5 days'
  const defaultTiming =
    (input.defaultTiming || '').trim() ||
    (/prazole|domperidone|rabeprazole|pantoprazole|omeprazole/i.test(`${cleanName} ${genericName}`)
      ? 'Before Food (Empty Stomach)'
      : route === 'Oral'
      ? 'After Food'
      : 'As Directed')

  let mrp: number | null = null
  if (input.mrp !== null && input.mrp !== undefined && input.mrp !== '') {
    const parsed = Number(String(input.mrp).replace(/[^\d.]/g, ''))
    if (!Number.isNaN(parsed) && parsed > 0) mrp = parsed
  }

  const schedule = (input.schedule || '').trim() || 'Schedule H'
  const isControlled = /H1|X/i.test(schedule)
  const scopePrefix = input.organizationId ? `org:${input.organizationId}` : 'global'
  const dedupKey = [
    scopePrefix,
    cleanName.toLowerCase(),
    genericName.toLowerCase(),
    (manufacturer || '').toLowerCase(),
    (strength || '').toLowerCase(),
    dosageForm.toLowerCase(),
  ].join('||')

  const searchText = [
    cleanName,
    genericName,
    composition || '',
    brand,
    manufacturer || '',
    dosageForm,
    strength || '',
    category,
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  return {
    organizationId: input.organizationId || null,
    dedupKey,
    name: cleanName,
    genericName,
    composition,
    brand,
    manufacturer,
    dosageForm,
    strength,
    packSize: (input.packSize || '').trim() || null,
    category,
    therapeuticClass: (input.therapeuticClass || category).trim(),
    mrp,
    schedule,
    isControlled,
    requiresPrescription: input.requiresPrescription ?? schedule !== 'OTC',
    defaultDosage,
    defaultFrequency,
    defaultDuration,
    defaultRoute: route,
    defaultTiming,
    defaultInstructions: (input.defaultInstructions || '').trim() || null,
    uses: (input.uses || '').trim() || null,
    sideEffects: (input.sideEffects || '').trim() || null,
    contraindications: (input.contraindications || '').trim() || null,
    source: input.source || 'medwiki',
    sourceUrl: input.sourceUrl || null,
    searchText,
    lastSyncedAt: new Date(),
  }
}

export async function normalizeAndUpsertMedicines(
  items: RawMedicineInput[],
  meta: { triggerSource?: string; mode?: string; queryOrTerm?: string } = {}
) {
  const startMs = Date.now()
  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const raw of items) {
    if (!raw?.name || !raw.name.trim()) {
      skippedCount++
      continue
    }
    try {
      const normalized = normalizeMedicineRecord(raw)
      const existing = await dbUnscoped.medicine.findUnique({
        where: { dedupKey: normalized.dedupKey },
        select: { id: true },
      })
      if (existing) {
        await dbUnscoped.medicine.update({
          where: { id: existing.id },
          data: {
            ...normalized,
            updatedAt: new Date(),
          },
        })
        updatedCount++
      } else {
        await dbUnscoped.medicine.create({
          data: normalized,
        })
        insertedCount++
      }
    } catch {
      errorCount++
    }
  }

  invalidateCachePrefix('meds:')

  const durationMs = Date.now() - startMs
  const syncRun = await dbUnscoped.medwikiSyncRun.create({
    data: {
      triggerSource: meta.triggerSource || 'webhook',
      mode: meta.mode || 'batch_upsert',
      queryOrTerm: meta.queryOrTerm || null,
      status: errorCount > 0 && insertedCount + updatedCount === 0 ? 'failed' : 'completed',
      foundCount: items.length,
      insertedCount,
      updatedCount,
      skippedCount,
      errorCount,
      durationMs,
      completedAt: new Date(),
      logSummary: `Processed ${items.length} medicines in ${durationMs}ms (${insertedCount} new, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors).`,
    },
  })

  return {
    syncRunId: syncRun.id,
    foundCount: items.length,
    insertedCount,
    updatedCount,
    skippedCount,
    errorCount,
    durationMs,
  }
}
