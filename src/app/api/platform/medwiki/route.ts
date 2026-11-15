import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'
import { normalizeAndUpsertMedicines, RawMedicineInput } from '@/lib/medwiki-engine'

// Sample MedWiki live delta discovery pack for instant testing inside Platform Admin
const MEDWIKI_DELTA_BATCH: RawMedicineInput[] = [
  { name: 'Clavam 625 Tablet', composition: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)', manufacturer: 'Alkem Laboratories Ltd', packSize: 'Strip of 10 tablets', mrp: 218.5, schedule: 'Schedule H', defaultDosage: '1 tablet', defaultFrequency: '1-0-1', defaultDuration: '5 days', defaultTiming: 'After Food', defaultInstructions: 'Take one tablet twice daily after meals. Complete the full course even if you feel better.', language: 'en', uses: 'Acute bacterial sinusitis, otitis media, pneumonia' },
  { name: 'Mahacef 200mg Tablet', composition: 'Cefixime (200mg)', manufacturer: 'Mankind Pharma Ltd', packSize: 'Strip of 10 tablets', mrp: 107.0, schedule: 'Schedule H1', defaultDosage: '1 tablet', defaultFrequency: '1-0-1', defaultDuration: '7 days', defaultTiming: 'After Food', defaultInstructions: 'Take one tablet once daily after food. Do not skip doses.', language: 'en', uses: 'Typhoid fever, UTI, respiratory infections' },
  { name: 'Chymoral Forte Tablet', composition: 'Trypsin + Chymotrypsin (100000 AU)', manufacturer: 'Torrent Pharmaceuticals Ltd', packSize: 'Strip of 20 tablets', mrp: 452.0, schedule: 'Schedule H', defaultFrequency: '1-1-1', defaultTiming: '30 mins Before Food', defaultInstructions: 'Take one tablet three times daily, 30 minutes before food. Swallow whole with water.', language: 'en', uses: 'Post-surgical edema, trauma, inflammatory swelling' },
  { name: 'Stemetil MD 5mg Tablet', composition: 'Prochlorperazine (5mg)', manufacturer: 'Abbott', packSize: 'Strip of 15 tablets', mrp: 162.0, schedule: 'Schedule H', defaultDosage: '1 tablet', defaultFrequency: '0-0-2', defaultDuration: '3 days', defaultTiming: 'As needed', defaultInstructions: 'Take one tablet as needed for nausea or vertigo. Maximum 3 tablets in 24 hours.', language: 'en', uses: 'Vertigo, labyrinthitis, severe nausea & migraine' },
  { name: 'Vertin 16mg Tablet', composition: 'Betahistine (16mg)', manufacturer: 'Abbott', packSize: 'Strip of 15 tablets', mrp: 345.0, schedule: 'Schedule H', defaultDosage: '1 tablet', defaultFrequency: '1-0-1', defaultDuration: '14 days', defaultTiming: 'After Food', defaultInstructions: 'Take one tablet once daily after breakfast. Do not stop suddenly without consulting doctor.', language: 'en', uses: 'Meniere disease, peripheral vertigo, tinnitus' },
  { name: 'Magnex Forte 1.5g Injection', composition: 'Cefoperazone (1000mg) + Sulbactam (500mg)', dosageForm: 'Injection', manufacturer: 'Pfizer Ltd', packSize: 'Vial of 1.5 gm', mrp: 525.0, schedule: 'Schedule H1', defaultRoute: 'IV', defaultFrequency: '1-0-1', defaultInstructions: 'Administer intravenously as directed by physician. Reconstitute with sterile water before use.', language: 'en', uses: 'IPD hepatobiliary, intra-abdominal & respiratory infections' },
  { name: 'Dexona 4mg/ml Injection', composition: 'Dexamethasone (4mg/ml)', dosageForm: 'Injection', manufacturer: 'Zydus Cadila', packSize: 'Vial of 2 ml', mrp: 11.4, schedule: 'Schedule H', defaultRoute: 'IV/IM', defaultFrequency: '1-0-0', defaultInstructions: 'Inject intramuscularly or intravenously as prescribed. Do not self-administer without medical supervision.', language: 'en', uses: 'Cerebral edema, severe allergic shock, airway inflammation' },
  { name: 'Deriphyllin 110mg Injection', composition: 'Etofylline (84.7mg) + Theophylline (25.3mg)', dosageForm: 'Injection', manufacturer: 'Zydus Cadila', packSize: 'Ampoule of 2 ml', mrp: 14.2, schedule: 'Schedule H', defaultRoute: 'IM/IV', defaultFrequency: '1-0-0', defaultInstructions: 'Administer slowly intravenously or intramuscularly. Monitor for palpitations and tremor.', language: 'en', uses: 'Acute bronchospasm, status asthmaticus, COPD' },
  { name: 'Meftal-Spas Tablet', composition: 'Mefenamic Acid (250mg) + Dicyclomine (10mg)', manufacturer: 'Blue Cross Laboratories Ltd', packSize: 'Strip of 10 tablets', mrp: 52.0, schedule: 'Schedule H', defaultDosage: '1 tablet', defaultFrequency: '0-0-1', defaultDuration: '2 days', defaultTiming: 'After Food', defaultInstructions: 'Take one tablet after food for abdominal pain. Maximum 3 tablets per day.', language: 'en', uses: 'Abdominal colic, spasmodic dysmenorrhea' },
  { name: 'Cremaffin Plus Syrup', composition: 'Liquid Paraffin + Milk of Magnesia + Sodium Picosulfate', dosageForm: 'Syrup', manufacturer: 'Abbott', packSize: 'Bottle of 225 ml', mrp: 295.0, schedule: 'OTC', defaultDosage: '10 ml', defaultFrequency: '0-0-1', defaultTiming: 'At Bedtime', defaultInstructions: 'Take 10 ml syrup at bedtime for constipation. Shake well before use.', language: 'en', uses: 'Post-operative & chronic constipation' },
  // Hindi language entries
  { name: 'Paracetamol 500mg Tablet', composition: 'Paracetamol (500mg)', manufacturer: 'Multiple', packSize: 'Strip of 15 tablets', mrp: 15.0, schedule: 'OTC', defaultDosage: '1 tablet', defaultFrequency: '1-0-1', defaultDuration: '3 days', defaultTiming: 'After Food', defaultInstructions: 'खाने के बाद एक गोली लें। बुखार या दर्द होने पर लें।', language: 'hi', uses: 'बुखार, सिरदर्द, बदन दर्द' },
  { name: 'Oral Rehydration Salt (ORS) Powder', composition: 'Sodium Chloride + Potassium Chloride + Sodium Citrate + Glucose', manufacturer: 'Multiple', packSize: 'Sachet of 21.6 gm', mrp: 8.0, schedule: 'OTC', defaultDosage: '1 sachet', defaultFrequency: '0-0-1', defaultTiming: 'As needed', defaultInstructions: 'एक sachet को एक लीटर साफ पानी में घोलें। बार-बार पीते रहें।', language: 'hi', uses: 'उल्टी-दस्त से शरीर में पानी की कमी' },
]

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  const [totalGlobal, totalCustom, recentRuns, medicines, allGlobalCats] = await Promise.all([
    dbUnscoped.medicine.count({ where: { organizationId: null, isActive: true } }),
    dbUnscoped.medicine.count({ where: { NOT: { organizationId: null }, isActive: true } }),
    dbUnscoped.medwikiSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 12 }),
    dbUnscoped.medicine.findMany({
      where: {
        organizationId: null,
        isActive: true,
        ...(q ? { searchText: { contains: q } } : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
      take: 40,
    }),
    dbUnscoped.medicine.groupBy({
      by: ['category'],
      where: { organizationId: null, isActive: true },
      _count: { id: true },
    }),
  ])

  return apiJson(
    {
      totalGlobal,
      totalCustom,
      webhookEndpoint: '/api/medicines/sync',
      syncApiKeyPreview: `${(process.env.MEDWIKI_SYNC_API_KEY || 'mwk_live_...').slice(0, 14)}••••`,
      categories: allGlobalCats
        .map((c) => ({ category: c.category, count: c._count.id }))
        .sort((a, b) => b.count - a.count),
      recentRuns,
      medicines,
    },
    { startMs }
  )
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const action = String(body.action || 'runSampleDelta')

  if (action === 'runSampleDelta') {
    const result = await normalizeAndUpsertMedicines(MEDWIKI_DELTA_BATCH, {
      triggerSource: 'platform_admin_ui',
      mode: 'medwiki_delta_sync',
      queryOrTerm: 'Live Delta Batch (10 Formulations)',
    })
    return apiJson(result, { startMs })
  }

  if (action === 'upsertBatch' && Array.isArray(body.medicines)) {
    const result = await normalizeAndUpsertMedicines(body.medicines, {
      triggerSource: 'platform_batch_json',
      mode: 'batch_import',
      queryOrTerm: body.label || `${body.medicines.length} medicines`,
    })
    return apiJson(result, { startMs })
  }

  if (action === 'createSingle') {
    const result = await normalizeAndUpsertMedicines([body.medicine], {
      triggerSource: 'platform_manual',
      mode: 'single_upsert',
      queryOrTerm: body.medicine?.name || 'Manual Entry',
    })
    return apiJson(result, { startMs })
  }

  return apiJson({ error: 'Unsupported MedWiki action' }, { status: 400, startMs })
}
