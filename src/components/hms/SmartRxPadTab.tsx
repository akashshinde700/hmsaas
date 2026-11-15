'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Pill,
  Plus,
  Printer,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  ClinicSettingsData,
  DoctorOption,
  MedicineSearchResult,
  PatientRecord,
} from './types'

interface RxRow {
  medicineId?: string
  medicineName: string
  genericName: string
  dosageForm: string
  strength: string
  dosage: string
  frequency: string
  timing: string
  duration: string
  route: string
  quantity: number
  instructions: string
}

const SYMPTOM_CHIPS = [
  'High-grade fever with chills',
  'Dry cough & throat irritation',
  'Epigastric burning & acidity',
  'Headache & dizziness',
  'Elevated BP readings',
  'Joint & lower back pain',
  'Breathlessness on exertion',
  'Generalized weakness',
]

const DIAGNOSIS_CHIPS = [
  'Acute Viral Febrile Illness',
  'Upper Respiratory Tract Infection (URTI)',
  'Acute Gastritis / GERD',
  'Essential Hypertension (I10)',
  'Type 2 Diabetes Mellitus (E11)',
  'Acute Bronchitis',
  'Urinary Tract Infection (UTI)',
  'Acute Lumbar Spondylosis',
]

const LAB_CHIPS = [
  'CBC with ESR',
  'Fasting & PP Blood Sugar',
  'HbA1c',
  'Lipid Profile',
  'Liver Function Test (LFT)',
  'Renal Function Test (RFT)',
  'Dengue NS1 / IgM / IgG',
  'Thyroid Profile (TSH, T3, T4)',
  'Urine Routine & Microscopy',
  'Chest X-Ray PA View',
  '12-Lead ECG',
]

const MULTILINGUAL_ADVICE: Record<'en' | 'hi' | 'mr', string[]> = {
  en: [
    'Drink 2.5–3 litres of warm water / ORS daily and take complete rest for 3 days.',
    'Avoid oily, spicy, fermented, and outside packaged foods.',
    'For Blood Pressure: Restrict salt intake (<4g/day); avoid pickles, papad & chips.',
    'For Diabetes: Avoid sugar, sweets, fruit juices & refined carbs; brisk walk 30 mins daily.',
    'Report immediately to Hospital 24x7 Emergency if breathlessness, persistent vomiting, or high fever occurs.',
  ],
  hi: [
    'प्रतिदिन 2.5–3 लीटर गुनगुना पानी / ORS पिएं और 3 दिन पूर्ण आराम करें।',
    'मसालेदार, तैलीय और बाहर के डिब्बाबंद भोजन से परहेज करें।',
    'बीपी के लिए: नमक कम लें; अचार, पापड़ और चिप्स से बचें।',
    'डायबिटीज के लिए: चीनी, मिठाई और फलों के रस से बचें; रोजाना 30 मिनट टहलें।',
    'तेज बुखार, सांस लेने में तकलीफ या लगातार उल्टी होने पर तुरंत अस्पताल इमरजेंसी में संपर्क करें।',
  ],
  mr: [
    'दररोज २.५ ते ३ लिटर कोमट पाणी / ORS प्या आणि ३ दिवस पूर्ण विश्रांती घ्या.',
    'तिखट, तेलकट आणि बाहेरील पॅकबंद पदार्थ पूर्णपणे टाळा.',
    'रक्तदाबासाठी (BP): मिठाचे प्रमाण कमी ठेवा; लोणचे, पापड व चिप्स टाळा.',
    'मधुमेहासाठी: साखर, गोड पदार्थ आणि फळांचे रस टाळा; दररोज ३० मिनिटे चाला.',
    'तीव्र ताप, धाप लागणे किंवा सतत उलट्या झाल्यास तात्काळ हॉस्पिटल इमर्जन्सीशी संपर्क साधा.',
  ],
}

export default function SmartRxPadTab({
  patients,
  doctors,
  settings,
  preselectedPatientId,
  preselectedQueueId,
  onNavigateIpdAdmit,
  onLatencySample,
}: {
  patients: PatientRecord[]
  doctors: DoctorOption[]
  settings: ClinicSettingsData | null
  preselectedPatientId?: string | null
  preselectedQueueId?: string | null
  onNavigateIpdAdmit: (patientId: string, diagnosis: string) => void
  onLatencySample?: (ms: number) => void
}) {
  const [patientId, setPatientId] = useState(preselectedPatientId || patients[0]?.id || '')
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || '')
  const [chiefComplaints, setChiefComplaints] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [labInvestigations, setLabInvestigations] = useState('')
  const [adviceLang, setAdviceLang] = useState<'en' | 'hi' | 'mr'>('en')
  const [advice, setAdvice] = useState('')
  const [followUpDays, setFollowUpDays] = useState('5')
  const [recommendIpdAdmit, setRecommendIpdAdmit] = useState(false)
  const [generateOpdBill, setGenerateOpdBill] = useState(true)
  const [markBillPaid, setMarkBillPaid] = useState(true)

  const [vitals, setVitals] = useState({
    bp: '120/80',
    pulse: '78',
    temp: '98.6',
    spo2: '99',
    weight: '68',
  })

  // Medicine autocomplete
  const [medSearch, setMedSearch] = useState('')
  const [medResults, setMedResults] = useState<MedicineSearchResult[]>([])
  const [rxItems, setRxItems] = useState<RxRow[]>([])
  const [saving, setSaving] = useState(false)
  const [recentPrescriptions, setRecentPrescriptions] = useState<Array<Record<string, unknown>>>([])
  const [printableRx, setPrintableRx] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (preselectedPatientId) setPatientId(preselectedPatientId)
  }, [preselectedPatientId])

  useEffect(() => {
    if (!patientId && patients[0]?.id) setPatientId(patients[0].id)
  }, [patients, patientId])

  const searchMedicines = useCallback(
    async (q: string) => {
      const t0 = performance.now()
      const res = await fetch(`/api/medicines?q=${encodeURIComponent(q)}&limit=18`)
      const serverHeader = res.headers.get('X-Response-Time')
      const ms = serverHeader ? parseFloat(serverHeader) : performance.now() - t0
      onLatencySample?.(ms)
      if (res.ok) {
        const d = await res.json()
        setMedResults(d.medicines || [])
      }
    },
    [onLatencySample]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMedicines(medSearch)
    }, 80)
    return () => clearTimeout(timer)
  }, [medSearch, searchMedicines])

  const loadRecentRx = useCallback(async () => {
    const res = await fetch('/api/prescriptions')
    if (res.ok) {
      const d = await res.json()
      setRecentPrescriptions(d.prescriptions || [])
    }
  }, [])

  useEffect(() => {
    loadRecentRx()
  }, [loadRecentRx])

  function addMedicineToPad(med: MedicineSearchResult) {
    setRxItems((prev) => [
      ...prev,
      {
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.composition || med.genericName || '',
        dosageForm: med.dosageForm,
        strength: med.strength || '',
        dosage: med.defaultDosage || '1 tablet',
        frequency: med.defaultFrequency || '1-0-1',
        timing: med.defaultTiming || 'After Food',
        duration: med.defaultDuration || '5 days',
        route: med.defaultRoute || 'Oral',
        quantity: 10,
        instructions: med.defaultInstructions || '',
      },
    ])
    setMedSearch('')
    toast.success(`Added ${med.name} (${med.defaultFrequency})`)
  }

  function updateRxRow(idx: number, patch: Partial<RxRow>) {
    setRxItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function handleSavePrescription(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId || !diagnosis.trim()) {
      toast.error('Please select a patient and enter a clinical diagnosis.')
      return
    }
    setSaving(true)
    try {
      const followUpDate =
        Number(followUpDays) > 0
          ? new Date(Date.now() + Number(followUpDays) * 24 * 60 * 60 * 1000).toISOString()
          : null

      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId,
          opdQueueId: preselectedQueueId || null,
          chiefComplaints,
          diagnosis,
          labInvestigations,
          advice,
          adviceLanguage: adviceLang,
          followUpDate,
          recommendIpdAdmit,
          vitals,
          items: rxItems,
          generateOpdBill,
          markBillPaid,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save prescription')
        return
      }
      toast.success(`Prescription ${data.prescription.prescriptionNo} saved & doctor defaults learned!`)
      setPrintableRx(data.prescription)
      await loadRecentRx()
    } finally {
      setSaving(false)
    }
  }

  const selectedPatient = patients.find((p) => p.id === patientId)

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left 8 Cols: Active Smart Prescription Pad */}
      <form onSubmit={handleSavePrescription} className="lg:col-span-8 space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Smart OPD Prescription Pad</h2>
                <p className="text-xs text-slate-500">
                  Powered by Live MedWiki Drug Formulary &amp; Per-Doctor Dosing Memory
                </p>
              </div>
            </div>

            {selectedPatient && (
              <button
                type="button"
                onClick={() =>
                  onNavigateIpdAdmit(
                    selectedPatient.id,
                    diagnosis || chiefComplaints || 'OPD Direct Admission'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
              >
                <BedDouble className="h-3.5 w-3.5" /> Admit Patient to IPD Bed →
              </button>
            )}
          </div>

          {/* Patient & Doctor Selection */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Patient (UHID) *
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium focus:border-teal-500 focus:outline-none"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.uhid}) · {p.ageYears ?? '—'}y/{p.gender[0]} · {p.phone}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Consulting Doctor
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium focus:border-teal-500 focus:outline-none"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialization || d.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Drug Allergy Alert Banner */}
          {selectedPatient?.allergies && selectedPatient.allergies.toLowerCase() !== 'none known' && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                <strong>KNOWN ALLERGY ALERT:</strong> {selectedPatient.allergies}
                {selectedPatient.chronicConditions
                  ? ` · Chronic History: ${selectedPatient.chronicConditions}`
                  : ''}
              </span>
            </div>
          )}

          {/* Compact Quick Vitals Strip */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 font-medium">BP (mmHg)</span>
              <input
                value={vitals.bp}
                onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-semibold"
              />
            </div>
            <div>
              <span className="text-slate-500 font-medium">Pulse (/min)</span>
              <input
                value={vitals.pulse}
                onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-semibold"
              />
            </div>
            <div>
              <span className="text-slate-500 font-medium">SpO2 (%)</span>
              <input
                value={vitals.spo2}
                onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-semibold"
              />
            </div>
            <div>
              <span className="text-slate-500 font-medium">Temp (°F)</span>
              <input
                value={vitals.temp}
                onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-semibold"
              />
            </div>
            <div>
              <span className="text-slate-500 font-medium">Weight (kg)</span>
              <input
                value={vitals.weight}
                onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono font-semibold"
              />
            </div>
          </div>

          {/* Symptoms & Diagnosis */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Chief Complaints / Symptoms
              </label>
              <input
                value={chiefComplaints}
                onChange={(e) => setChiefComplaints(e.target.value)}
                placeholder="Fever, cough, body ache..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SYMPTOM_CHIPS.slice(0, 5).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setChiefComplaints((prev) => (prev ? `${prev}, ${chip}` : chip))
                    }
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Clinical Diagnosis *
              </label>
              <input
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Viral Febrile Illness"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DIAGNOSIS_CHIPS.slice(0, 5).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setDiagnosis((prev) => (prev ? `${prev}; ${chip}` : chip))}
                    className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] text-teal-800 hover:bg-teal-100"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic MedWiki Medicine Search & Rx Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-600" />
              Rx Medications ({rxItems.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Type brand or generic salt (e.g. Dolo, Augmentin, Pantoprazole, Telma, Azithral)
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              placeholder="Search MedWiki Global Catalog + Your Clinic Formulary..."
              className="w-full rounded-xl border border-teal-300 bg-teal-50/20 pl-10 pr-4 py-2.5 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Instant Suggestions */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1">
            {medResults.slice(0, 12).map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => addMedicineToPad(med)}
                className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-left text-xs hover:border-teal-500 hover:bg-teal-50 transition"
              >
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{med.name}</span>
                    {med.doctorUsage > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> My Default
                      </span>
                    )}
                    {med.isControlled && (
                      <span className="rounded bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">
                        {med.schedule}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {med.composition || med.genericName} ·{' '}
                    <span className="font-mono text-teal-700">{med.defaultFrequency}</span>
                    {med.mrp ? ` · ₹${med.mrp}` : ''}
                  </div>
                </div>
                <Plus className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              </button>
            ))}
          </div>

          {/* Prescribed Items Table */}
          {rxItems.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Medicine &amp; Salt</th>
                    <th className="py-2.5 px-2">Dose</th>
                    <th className="py-2.5 px-2">Frequency</th>
                    <th className="py-2.5 px-2">Timing</th>
                    <th className="py-2.5 px-2">Duration</th>
                    <th className="py-2.5 px-2">Qty</th>
                    <th className="py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rxItems.map((item, idx) => (
                    <tr key={`${item.medicineName}-${idx}`}>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{item.medicineName}</p>
                        <p className="text-[11px] text-slate-500">{item.genericName}</p>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={item.dosage}
                          onChange={(e) => updateRxRow(idx, { dosage: e.target.value })}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={item.frequency}
                          onChange={(e) => updateRxRow(idx, { frequency: e.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1 font-mono"
                        >
                          <option value="1-0-1">1-0-1 (BD)</option>
                          <option value="1-1-1">1-1-1 (TDS)</option>
                          <option value="1-0-0">1-0-0 (Morning)</option>
                          <option value="0-1-0">0-1-0 (Afternoon)</option>
                          <option value="0-0-1">0-0-1 (Night)</option>
                          <option value="1-1-1-1">1-1-1-1 (QID)</option>
                          <option value="SOS">SOS (As needed)</option>
                          <option value="Once Weekly">Once Weekly</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={item.timing}
                          onChange={(e) => updateRxRow(idx, { timing: e.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1"
                        >
                          <option>After Food</option>
                          <option>Before Food (Empty Stomach)</option>
                          <option>15 mins Before Food</option>
                          <option>At Bedtime</option>
                          <option>Early Morning Empty Stomach</option>
                          <option>As Directed</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={item.duration}
                          onChange={(e) => updateRxRow(idx, { duration: e.target.value })}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateRxRow(idx, { quantity: Number(e.target.value) })}
                          className="w-14 rounded-lg border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => setRxItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lab Orders & Multilingual Patient Advice */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Recommended Lab &amp; Radiology Investigations
            </label>
            <input
              value={labInvestigations}
              onChange={(e) => setLabInvestigations(e.target.value)}
              placeholder="CBC, HbA1c, Lipid Profile, Chest X-Ray..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {LAB_CHIPS.map((lab) => (
                <button
                  key={lab}
                  type="button"
                  onClick={() =>
                    setLabInvestigations((prev) => (prev ? `${prev}, ${lab}` : lab))
                  }
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 hover:bg-sky-50 hover:text-sky-700"
                >
                  + {lab}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Dietary &amp; Clinical Advice (Multilingual)
              </label>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
                {(
                  [
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'हिंदी' },
                    { id: 'mr', label: 'मराठी' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setAdviceLang(l.id)}
                    className={`rounded-md px-2.5 py-0.5 font-semibold ${
                      adviceLang === l.id ? 'bg-teal-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={2}
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              placeholder="Click quick advice templates below or type custom instructions..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MULTILINGUAL_ADVICE[adviceLang].map((line, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAdvice((prev) => (prev ? `${prev}\n• ${line}` : `• ${line}`))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] text-slate-700 hover:border-teal-400 hover:bg-teal-50"
                >
                  + {line.slice(0, 62)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 font-medium text-slate-700">
                Follow-up after (days):
                <input
                  type="number"
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(e.target.value)}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center font-semibold"
                />
              </label>

              <label className="flex items-center gap-1.5 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={generateOpdBill}
                  onChange={(e) => setGenerateOpdBill(e.target.checked)}
                />
                Auto-create OPD Bill
              </label>

              {generateOpdBill && (
                <label className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <input
                    type="checkbox"
                    checked={markBillPaid}
                    onChange={(e) => setMarkBillPaid(e.target.checked)}
                  />
                  Mark Paid (UPI)
                </label>
              )}

              <label className="flex items-center gap-1.5 font-medium text-rose-700">
                <input
                  type="checkbox"
                  checked={recommendIpdAdmit}
                  onChange={(e) => setRecommendIpdAdmit(e.target.checked)}
                />
                Advise IPD Admission
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Saving Rx...' : 'Save & Generate Printable Rx'}
            </button>
          </div>
        </div>
      </form>

      {/* Right 4 Cols: Recent Prescriptions & Instant Print */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Recent Prescriptions ({recentPrescriptions.length})
          </h3>
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {recentPrescriptions.map((rx) => {
              const p = rx.patient as { name?: string; uhid?: string } | undefined
              const d = rx.doctor as { name?: string } | undefined
              const items = (rx.items as Array<{ medicineName: string }>) || []
              return (
                <div
                  key={String(rx.id)}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-teal-700">
                      {String(rx.prescriptionNo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrintableRx(rx)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700"
                    >
                      <Printer className="h-3 w-3" /> Print / View
                    </button>
                  </div>
                  <p className="mt-1 font-bold text-slate-900">
                    {p?.name} <span className="font-normal text-slate-500">({p?.uhid})</span>
                  </p>
                  <p className="mt-0.5 text-slate-700 font-medium">{String(rx.diagnosis)}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {items.length} med(s) · {d?.name}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* PRINTABLE HOSPITAL LETTERHEAD PRESCRIPTION MODAL */}
      {printableRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl print-sheet">
            <div className="no-print mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase text-teal-700">
                Letterhead Prescription Preview
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
                >
                  <Printer className="h-4 w-4" /> Print A4 / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableRx(null)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Hospital White-Label Header */}
            <div className="border-b-2 border-teal-700 pb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-teal-800">
                  {settings?.clinicDisplayName || 'Hospital & Medical Center'}
                </h2>
                {settings?.tagline && (
                  <p className="text-xs font-medium text-slate-600">{settings.tagline}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {settings?.address} {settings?.phone ? `· Tel: ${settings.phone}` : ''}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold text-slate-900 text-sm">
                  {String((printableRx.doctor as Record<string, unknown>)?.name || '')}
                </p>
                <p className="text-slate-600">
                  {String((printableRx.doctor as Record<string, unknown>)?.qualification || '')}
                </p>
                <p className="text-slate-500">
                  Reg No: {String((printableRx.doctor as Record<string, unknown>)?.registrationNo || 'MMC')}
                </p>
              </div>
            </div>

            {/* Patient Strip */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs border border-slate-200">
              <div>
                <strong>Patient:</strong>{' '}
                {String((printableRx.patient as Record<string, unknown>)?.name || '')} (
                {String((printableRx.patient as Record<string, unknown>)?.uhid || '')})
              </div>
              <div>
                <strong>Rx No:</strong> {String(printableRx.prescriptionNo)}
              </div>
              <div>
                <strong>Date:</strong>{' '}
                {new Date(String(printableRx.createdAt || Date.now())).toLocaleDateString('en-IN')}
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              {Boolean(printableRx.chiefComplaints) && (
                <p>
                  <strong>Chief Complaints:</strong> {String(printableRx.chiefComplaints)}
                </p>
              )}
              <p className="text-sm">
                <strong>Diagnosis:</strong> {String(printableRx.diagnosis)}
              </p>
            </div>

            {/* Rx Symbol + Medications */}
            <div className="mt-5">
              <p className="font-serif text-2xl font-bold text-teal-800">℞</p>
              <table className="mt-2 w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y border-slate-300 bg-slate-50">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Medicine &amp; Generic Composition</th>
                    <th className="py-2 px-2">Dosage</th>
                    <th className="py-2 px-2">Frequency</th>
                    <th className="py-2 px-2">Timing &amp; Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {((printableRx.items as Array<Record<string, unknown>>) || []).map((it, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-2 font-semibold">{i + 1}</td>
                      <td className="py-2.5 px-2">
                        <p className="font-bold text-slate-900">{String(it.medicineName)}</p>
                        {Boolean(it.genericName) && (
                          <p className="text-[11px] text-slate-500">{String(it.genericName)}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2">{String(it.dosage)}</td>
                      <td className="py-2.5 px-2 font-mono font-bold">{String(it.frequency)}</td>
                      <td className="py-2.5 px-2">
                        {String(it.timing)} · <strong>{String(it.duration)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Boolean(printableRx.labInvestigations) && (
              <div className="mt-5 text-xs">
                <strong>Investigations Advised:</strong> {String(printableRx.labInvestigations)}
              </div>
            )}

            {Boolean(printableRx.advice) && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs whitespace-pre-line border border-slate-200">
                <strong>Instructions / Advice:</strong>
                <div className="mt-1">{String(printableRx.advice)}</div>
              </div>
            )}

            <div className="mt-10 flex items-end justify-between border-t border-slate-200 pt-4 text-[11px] text-slate-500">
              <p>{settings?.rxFooterNote}</p>
              <div className="text-right">
                <p className="font-bold text-slate-800">
                  {String((printableRx.doctor as Record<string, unknown>)?.name || '')}
                </p>
                <p>Authorized Medical Signatory</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
