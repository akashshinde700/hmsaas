import { dbUnscoped } from '../src/lib/db'
import { encryptSecret, hashPassword } from '../src/lib/crypto'
import { normalizeAndUpsertMedicines, RawMedicineInput } from '../src/lib/medwiki-engine'

const MEDWIKI_CURATED_CATALOG: RawMedicineInput[] = [
  // Analgesics / Antipyretics / NSAIDs
  { name: 'Dolo 650 Tablet', composition: 'Paracetamol (650mg)', manufacturer: 'Micro Labs Ltd', packSize: 'Strip of 15 tablets', mrp: 33.7, schedule: 'OTC', uses: 'Fever, mild to moderate pain, headache, body ache', sideEffects: 'Rare nausea, allergic skin rash' },
  { name: 'Calpol 500mg Tablet', composition: 'Paracetamol (500mg)', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd', packSize: 'Strip of 15 tablets', mrp: 15.1, schedule: 'OTC', uses: 'Fever and pain relief' },
  { name: 'Calpol 250mg Paediatric Oral Suspension', composition: 'Paracetamol (250mg/5ml)', dosageForm: 'Suspension', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd', packSize: 'Bottle of 60 ml', mrp: 45.2, schedule: 'OTC', uses: 'Pediatric fever and pain' },
  { name: 'Zerodol-SP Tablet', composition: 'Aceclofenac (100mg) + Paracetamol (325mg) + Serratiopeptidase (15mg)', manufacturer: 'Ipca Laboratories Ltd', packSize: 'Strip of 10 tablets', mrp: 132.5, schedule: 'Schedule H', uses: 'Post-operative pain, joint inflammation, trauma swelling' },
  { name: 'Zerodol-P Tablet', composition: 'Aceclofenac (100mg) + Paracetamol (325mg)', manufacturer: 'Ipca Laboratories Ltd', packSize: 'Strip of 10 tablets', mrp: 72.0, schedule: 'Schedule H', uses: 'Acute musculoskeletal pain, osteoarthritis, dental pain' },
  { name: 'Combiflam Tablet', composition: 'Ibuprofen (400mg) + Paracetamol (325mg)', manufacturer: 'Sanofi India Ltd', packSize: 'Strip of 20 tablets', mrp: 46.8, schedule: 'Schedule H', uses: 'Fever, muscle pain, dysmenorrhea, dental pain' },
  { name: 'Ultracet Tablet', composition: 'Tramadol (37.5mg) + Paracetamol (325mg)', manufacturer: 'Janssen Pharmaceuticals', packSize: 'Strip of 15 tablets', mrp: 268.0, schedule: 'Schedule H1', uses: 'Moderate to severe acute pain' },
  { name: 'Nucoxia 90 Tablet', composition: 'Etoricoxib (90mg)', manufacturer: 'Zydus Cadila', packSize: 'Strip of 10 tablets', mrp: 215.0, schedule: 'Schedule H', uses: 'Gout, rheumatoid arthritis, ankylosing spondylitis', defaultFrequency: '1-0-0' },
  { name: 'Dynapar AQ 75mg/ml Injection', composition: 'Diclofenac (75mg/ml)', dosageForm: 'Injection', manufacturer: 'Troikaa Pharmaceuticals Ltd', packSize: 'Ampoule of 1 ml', mrp: 35.0, schedule: 'Schedule H', defaultRoute: 'IM/IV', uses: 'Acute renal colic, post-operative IPD pain' },
  { name: 'Kabimol 1000mg IV Infusion', composition: 'Paracetamol (1000mg/100ml)', dosageForm: 'Infusion', manufacturer: 'Fresenius Kabi India Pvt Ltd', packSize: 'Bottle of 100 ml', mrp: 312.0, schedule: 'Schedule H', defaultRoute: 'IV Infusion', defaultFrequency: '1-1-1', uses: 'IPD high-grade fever and post-surgical pain' },

  // Antibiotics (OPD + IPD Critical Care)
  { name: 'Augmentin 625 Duo Tablet', composition: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd', packSize: 'Strip of 10 tablets', mrp: 223.0, schedule: 'Schedule H', uses: 'Bacterial sinusitis, pneumonia, UTI, skin infections' },
  { name: 'Augmentin DDS Suspension', composition: 'Amoxycillin (400mg) + Clavulanic Acid (57mg)', dosageForm: 'Suspension', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd', packSize: 'Bottle of 30 ml', mrp: 167.0, schedule: 'Schedule H', uses: 'Pediatric bacterial infections' },
  { name: 'Azithral 500 Tablet', composition: 'Azithromycin (500mg)', manufacturer: 'Alembic Pharmaceuticals Ltd', packSize: 'Strip of 5 tablets', mrp: 132.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', defaultDuration: '3 days', uses: 'Upper and lower respiratory tract infections, typhoid' },
  { name: 'Taxim-O 200 Tablet', composition: 'Cefixime (200mg)', manufacturer: 'Alkem Laboratories Ltd', packSize: 'Strip of 10 tablets', mrp: 119.5, schedule: 'Schedule H1', uses: 'Enteric fever, UTI, bronchitis, pharyngitis' },
  { name: 'Zifi 200 Tablet', composition: 'Cefixime (200mg)', manufacturer: 'FDC Ltd', packSize: 'Strip of 10 tablets', mrp: 114.0, schedule: 'Schedule H1', uses: 'Bacterial infections of ear, throat, urinary tract' },
  { name: 'Ciplox 500 Tablet', composition: 'Ciprofloxacin (500mg)', manufacturer: 'Cipla Ltd', packSize: 'Strip of 10 tablets', mrp: 49.2, schedule: 'Schedule H', uses: 'Urinary tract infection, infectious diarrhea' },
  { name: 'Levoflox 500 Tablet', composition: 'Levofloxacin (500mg)', manufacturer: 'Cipla Ltd', packSize: 'Strip of 10 tablets', mrp: 98.5, schedule: 'Schedule H1', defaultFrequency: '1-0-0', uses: 'Community-acquired pneumonia, complicated UTI' },
  { name: 'Doxy-1 L-DR Forte Capsule', composition: 'Doxycycline (100mg) + Lactobacillus (5B Spores)', dosageForm: 'Capsule', manufacturer: 'USV Ltd', packSize: 'Strip of 10 capsules', mrp: 138.0, schedule: 'Schedule H', uses: 'Rickettsial fever, acne, respiratory infections' },
  { name: 'Flagyl 400 Tablet', composition: 'Metronidazole (400mg)', manufacturer: 'Abbott', packSize: 'Strip of 15 tablets', mrp: 25.4, schedule: 'Schedule H', defaultFrequency: '1-1-1', uses: 'Amoebiasis, anaerobic bacterial infections, giardiasis' },
  { name: 'Monocef 1g Injection', composition: 'Ceftriaxone (1000mg)', dosageForm: 'Injection', manufacturer: 'Aristo Pharmaceuticals Pvt Ltd', packSize: 'Vial of 1 gm', mrp: 69.5, schedule: 'Schedule H1', defaultRoute: 'IV', defaultFrequency: '1-0-1', uses: 'IPD sepsis, meningitis, typhoid, pneumonia, surgical prophylaxis' },
  { name: 'Tazact 4.5gm Injection', composition: 'Piperacillin (4000mg) + Tazobactam (500mg)', dosageForm: 'Injection', manufacturer: 'Cipla Ltd', packSize: 'Vial of 4.5 gm', mrp: 445.0, schedule: 'Schedule H1', defaultRoute: 'IV', defaultFrequency: '1-1-1', uses: 'Severe hospital-acquired pneumonia, intra-abdominal sepsis, ICU infections' },
  { name: 'Meronem 1000mg Injection', composition: 'Meropenem (1000mg)', dosageForm: 'Injection', manufacturer: 'Pfizer Ltd', packSize: 'Vial of 1 gm', mrp: 1180.0, schedule: 'Schedule H1', defaultRoute: 'IV', defaultFrequency: '1-1-1', uses: 'ICU multidrug-resistant infections, severe sepsis' },
  { name: 'Lizolid 600mg IV Infusion', composition: 'Linezolid (600mg/300ml)', dosageForm: 'Infusion', manufacturer: 'Glenmark Pharmaceuticals Ltd', packSize: 'Bag of 300 ml', mrp: 420.0, schedule: 'Schedule H1', defaultRoute: 'IV Infusion', defaultFrequency: '1-0-1', uses: 'MRSA pneumonia and complicated skin infections' },

  // Gastrointestinal / PPI / Antiemetics
  { name: 'Pan 40 Tablet', composition: 'Pantoprazole (40mg)', manufacturer: 'Alkem Laboratories Ltd', packSize: 'Strip of 15 tablets', mrp: 165.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', defaultTiming: 'Before Food (Empty Stomach)', uses: 'GERD, peptic ulcer, gastritis, NSAID gastroprotection' },
  { name: 'Pan-D Capsule PR', composition: 'Pantoprazole (40mg) + Domperidone (30mg)', dosageForm: 'Capsule', manufacturer: 'Alkem Laboratories Ltd', packSize: 'Strip of 15 capsules', mrp: 210.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', defaultTiming: 'Before Food (Empty Stomach)', uses: 'Acid reflux with nausea and bloating' },
  { name: 'Razo-D Capsule SR', composition: 'Rabeprazole (20mg) + Domperidone (30mg)', dosageForm: 'Capsule', manufacturer: 'Dr. Reddys Laboratories Ltd', packSize: 'Strip of 15 capsules', mrp: 298.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', defaultTiming: 'Before Food (Empty Stomach)', uses: 'GERD, dyspepsia' },
  { name: 'Pantocid IV 40mg Injection', composition: 'Pantoprazole (40mg)', dosageForm: 'Injection', manufacturer: 'Sun Pharmaceutical Industries Ltd', packSize: 'Vial of 40 mg', mrp: 56.5, schedule: 'Schedule H', defaultRoute: 'IV', defaultFrequency: '1-0-1', uses: 'IPD stress ulcer prophylaxis, upper GI bleed, acute gastritis' },
  { name: 'Emset 4 Tablet', composition: 'Ondansetron (4mg)', manufacturer: 'Cipla Ltd', packSize: 'Strip of 10 tablets', mrp: 55.4, schedule: 'Schedule H', uses: 'Nausea and vomiting' },
  { name: 'Emset 4mg/2ml Injection', composition: 'Ondansetron (4mg/2ml)', dosageForm: 'Injection', manufacturer: 'Cipla Ltd', packSize: 'Ampoule of 2 ml', mrp: 16.8, schedule: 'Schedule H', defaultRoute: 'IV', defaultFrequency: '1-1-1', uses: 'IPD acute vomiting and post-op nausea' },
  { name: 'Digene Mint Syrup', composition: 'Magnesium Hydroxide + Simethicone + Aluminium Hydroxide', dosageForm: 'Syrup', manufacturer: 'Abbott', packSize: 'Bottle of 200 ml', mrp: 158.0, schedule: 'OTC', defaultDosage: '10 ml', uses: 'Heartburn, hyperacidity, gas' },
  { name: 'Duphalac Oral Solution', composition: 'Lactulose (10gm/15ml)', dosageForm: 'Syrup', manufacturer: 'Abbott', packSize: 'Bottle of 250 ml', mrp: 292.0, schedule: 'Schedule H', defaultDosage: '15 ml', defaultFrequency: '0-0-1', uses: 'Constipation, hepatic encephalopathy' },
  { name: 'Econorm 250mg Sachet', composition: 'Saccharomyces Boulardii (250mg)', dosageForm: 'Powder', manufacturer: 'Dr. Reddys Laboratories Ltd', packSize: 'Sachet of 1 gm', mrp: 58.0, schedule: 'OTC', defaultFrequency: '1-0-1', uses: 'Acute infectious diarrhea and antibiotic-associated diarrhea' },

  // Antidiabetic
  { name: 'Glycomet-GP 1 Tablet PR', composition: 'Glimepiride (1mg) + Metformin (500mg)', manufacturer: 'USV Ltd', packSize: 'Strip of 15 tablets', mrp: 138.0, schedule: 'Schedule H', defaultFrequency: '1-0-1', defaultTiming: 'Before Food', uses: 'Type 2 Diabetes Mellitus' },
  { name: 'Glycomet-GP 2 Tablet PR', composition: 'Glimepiride (2mg) + Metformin (500mg)', manufacturer: 'USV Ltd', packSize: 'Strip of 15 tablets', mrp: 185.0, schedule: 'Schedule H', defaultFrequency: '1-0-1', defaultTiming: 'Before Food', uses: 'Type 2 Diabetes Mellitus' },
  { name: 'Glycomet 500 SR Tablet', composition: 'Metformin (500mg)', manufacturer: 'USV Ltd', packSize: 'Strip of 20 tablets', mrp: 46.5, schedule: 'Schedule H', defaultTiming: 'After Food', uses: 'Type 2 Diabetes Mellitus, PCOS' },
  { name: 'Oxra 10mg Tablet', composition: 'Dapagliflozin (10mg)', manufacturer: 'Sun Pharmaceutical Industries Ltd', packSize: 'Strip of 14 tablets', mrp: 196.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', uses: 'Type 2 Diabetes, Heart Failure, CKD' },
  { name: 'Janumet 50/500 Tablet', composition: 'Sitagliptin (50mg) + Metformin (500mg)', manufacturer: 'MSD Pharmaceuticals', packSize: 'Strip of 15 tablets', mrp: 315.0, schedule: 'Schedule H', uses: 'Type 2 Diabetes Mellitus' },
  { name: 'Human Actrapid 40IU/ml Injection', composition: 'Soluble Insulin (40IU/ml)', dosageForm: 'Injection', manufacturer: 'Novo Nordisk India Pvt Ltd', packSize: 'Vial of 10 ml', mrp: 175.0, schedule: 'Schedule H', defaultRoute: 'SC/IV', uses: 'IPD glycemic control, diabetic ketoacidosis, diabetes' },

  // Cardiovascular / Antihypertensives / Statins
  { name: 'Telma 40 Tablet', composition: 'Telmisartan (40mg)', manufacturer: 'Glenmark Pharmaceuticals Ltd', packSize: 'Strip of 15 tablets', mrp: 118.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', uses: 'Essential hypertension, cardiovascular risk reduction' },
  { name: 'Telma-AM Tablet', composition: 'Telmisartan (40mg) + Amlodipine (5mg)', manufacturer: 'Glenmark Pharmaceuticals Ltd', packSize: 'Strip of 15 tablets', mrp: 245.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', uses: 'Uncontrolled hypertension' },
  { name: 'Amlokind-AT Tablet', composition: 'Amlodipine (5mg) + Atenolol (50mg)', manufacturer: 'Mankind Pharma Ltd', packSize: 'Strip of 10 tablets', mrp: 42.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', uses: 'Hypertension, angina pectoris' },
  { name: 'Metolar XR 50 Tablet', composition: 'Metoprolol Succinate (50mg)', manufacturer: 'Cipla Ltd', packSize: 'Strip of 15 tablets', mrp: 112.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', uses: 'Hypertension, arrhythmias, post-MI care' },
  { name: 'Atorva 20 Tablet', composition: 'Atorvastatin (20mg)', manufacturer: 'Zydus Cadila', packSize: 'Strip of 15 tablets', mrp: 212.0, schedule: 'Schedule H', defaultFrequency: '0-0-1', uses: 'Dyslipidemia, coronary artery disease prevention' },
  { name: 'Rosuvas 10 Tablet', composition: 'Rosuvastatin (10mg)', manufacturer: 'Sun Pharmaceutical Industries Ltd', packSize: 'Strip of 15 tablets', mrp: 268.0, schedule: 'Schedule H', defaultFrequency: '0-0-1', uses: 'Hypercholesterolemia, atherosclerosis prevention' },
  { name: 'Ecosprin 75 Tablet', composition: 'Aspirin (75mg)', manufacturer: 'USV Ltd', packSize: 'Strip of 14 tablets', mrp: 5.5, schedule: 'Schedule H', defaultFrequency: '0-1-0', uses: 'Antiplatelet therapy for CAD and stroke prevention' },
  { name: 'Lasix 20mg/2ml Injection', composition: 'Furosemide (20mg/2ml)', dosageForm: 'Injection', manufacturer: 'Sanofi India Ltd', packSize: 'Ampoule of 2 ml', mrp: 12.5, schedule: 'Schedule H', defaultRoute: 'IV', uses: 'Pulmonary edema, acute heart failure, fluid overload' },

  // Respiratory / Antiallergics
  { name: 'Montair-LC Tablet', composition: 'Montelukast (10mg) + Levocetirizine (5mg)', manufacturer: 'Cipla Ltd', packSize: 'Strip of 15 tablets', mrp: 318.0, schedule: 'Schedule H', defaultFrequency: '0-0-1', uses: 'Allergic rhinitis, seasonal allergies, bronchial asthma' },
  { name: 'Allegra 120mg Tablet', composition: 'Fexofenadine (120mg)', manufacturer: 'Sanofi India Ltd', packSize: 'Strip of 10 tablets', mrp: 218.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', uses: 'Allergic rhinitis, chronic urticaria (non-sedating)' },
  { name: 'Ascoril LS Syrup', composition: 'Ambroxol (30mg) + Levosalbutamol (1mg) + Guaifenesin (50mg)', dosageForm: 'Syrup', manufacturer: 'Glenmark Pharmaceuticals Ltd', packSize: 'Bottle of 100 ml', mrp: 129.0, schedule: 'Schedule H', defaultDosage: '5 ml', defaultFrequency: '1-1-1', uses: 'Productive cough with bronchospasm' },
  { name: 'Grilinctus-DX Syrup', composition: 'Dextromethorphan (15mg) + Chlorpheniramine (2mg)', dosageForm: 'Syrup', manufacturer: 'Franco-Indian Pharmaceuticals', packSize: 'Bottle of 100 ml', mrp: 118.0, schedule: 'Schedule H', defaultDosage: '5 ml', defaultFrequency: '1-1-1', uses: 'Dry irritating cough' },
  { name: 'Asthalin 100mcg Inhaler', composition: 'Salbutamol (100mcg)', dosageForm: 'Inhaler', manufacturer: 'Cipla Ltd', packSize: '200 MDI Puffs', mrp: 148.0, schedule: 'Schedule H', defaultDosage: '2 puffs', uses: 'Acute bronchospasm and asthma relief' },
  { name: 'Duolin Respules 3ml', composition: 'Levosalbutamol (1.25mg) + Ipratropium (500mcg)', dosageForm: 'Inhaler', manufacturer: 'Cipla Ltd', packSize: 'Pack of 5 respules', mrp: 62.0, schedule: 'Schedule H', defaultRoute: 'Nebulization', defaultDosage: '1 respule', defaultFrequency: '1-1-1', uses: 'IPD/ER nebulization for COPD and acute asthma' },
  { name: 'Budecort 0.5mg Respules', composition: 'Budesonide (0.5mg/2ml)', dosageForm: 'Inhaler', manufacturer: 'Cipla Ltd', packSize: 'Pack of 5 respules', mrp: 128.0, schedule: 'Schedule H', defaultRoute: 'Nebulization', defaultDosage: '1 respule', defaultFrequency: '1-0-1', uses: 'Nebulized corticosteroid for asthma/croup' },

  // IV Fluids & Emergency IPD Care
  { name: 'Ringer Lactate (RL) IV Fluid 500ml', composition: 'Sodium Lactate + Sodium Chloride + Potassium Chloride + Calcium Chloride', dosageForm: 'Infusion', manufacturer: 'Baxter India Pvt Ltd', packSize: 'Bottle of 500 ml', mrp: 68.0, schedule: 'Schedule H', defaultRoute: 'IV Infusion', defaultDosage: '500 ml @ 100ml/hr', uses: 'IPD dehydration, trauma resuscitation, surgical fluid replacement' },
  { name: 'Normal Saline (NS 0.9%) IV Fluid 500ml', composition: 'Sodium Chloride (0.9% w/v)', dosageForm: 'Infusion', manufacturer: 'Fresenius Kabi India Pvt Ltd', packSize: 'Bottle of 500 ml', mrp: 54.0, schedule: 'Schedule H', defaultRoute: 'IV Infusion', defaultDosage: '500 ml @ 80ml/hr', uses: 'IV hydration and drug dilution' },
  { name: 'DNS (Dextrose 5% + NS 0.9%) IV Fluid 500ml', composition: 'Dextrose (5% w/v) + Sodium Chloride (0.9% w/v)', dosageForm: 'Infusion', manufacturer: 'Otsuka Pharmaceutical India', packSize: 'Bottle of 500 ml', mrp: 58.0, schedule: 'Schedule H', defaultRoute: 'IV Infusion', uses: 'Maintenance fluid & caloric support in IPD' },

  // Vitamins, Supplements, Thyroid & Others
  { name: 'Shelcal 500 Tablet', composition: 'Elemental Calcium (500mg) + Vitamin D3 (250 IU)', manufacturer: 'Torrent Pharmaceuticals Ltd', packSize: 'Strip of 15 tablets', mrp: 144.0, schedule: 'OTC', defaultFrequency: '0-1-0', uses: 'Calcium & Vitamin D deficiency, osteoporosis, fracture recovery' },
  { name: 'Uprise-D3 60K Capsule', composition: 'Cholecalciferol / Vitamin D3 (60000 IU)', dosageForm: 'Capsule', manufacturer: 'Alkem Laboratories Ltd', packSize: 'Strip of 4 softgels', mrp: 138.0, schedule: 'OTC', defaultFrequency: 'Once Weekly', defaultDuration: '8 weeks', uses: 'Vitamin D3 deficiency' },
  { name: 'Neurobion Forte Tablet', composition: 'Vitamin B1 + B2 + B3 + B5 + B6 + Mecobalamin (B12)', manufacturer: 'Procter & Gamble Health Ltd', packSize: 'Strip of 30 tablets', mrp: 42.5, schedule: 'OTC', defaultFrequency: '0-1-0', uses: 'Peripheral neuropathy, Vitamin B-complex deficiency' },
  { name: 'Orofer XT Tablet', composition: 'Ferrous Ascorbate (100mg) + Folic Acid (1.5mg)', manufacturer: 'Emcure Pharmaceuticals Ltd', packSize: 'Strip of 10 tablets', mrp: 186.0, schedule: 'OTC', defaultFrequency: '0-1-0', uses: 'Iron deficiency anemia, pregnancy supplementation' },
  { name: 'Limcee 500mg Chewable Tablet', composition: 'Ascorbic Acid / Vitamin C (500mg)', manufacturer: 'Abbott', packSize: 'Strip of 15 tablets', mrp: 26.5, schedule: 'OTC', defaultFrequency: '1-0-1', uses: 'Immunity support, wound healing, scurvy' },
  { name: 'Thyronorm 50mcg Tablet', composition: 'Levothyroxine Sodium (50mcg)', manufacturer: 'Abbott', packSize: 'Bottle of 120 tablets', mrp: 168.0, schedule: 'Schedule H', defaultFrequency: '1-0-0', defaultTiming: 'Early Morning Empty Stomach', uses: 'Hypothyroidism' },
  { name: 'Mahaflox 0.5% Eye Drop', composition: 'Moxifloxacin (0.5% w/v)', dosageForm: 'Eye Drop', manufacturer: 'Mankind Pharma Ltd', packSize: 'Bottle of 5 ml', mrp: 89.0, schedule: 'Schedule H', defaultDosage: '1 drop', defaultFrequency: '1-1-1-1', uses: 'Bacterial conjunctivitis' },
  { name: 'T-Bact 2% Ointment', composition: 'Mupirocin (2% w/w)', dosageForm: 'Ointment', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd', packSize: 'Tube of 5 gm', mrp: 122.0, schedule: 'Schedule H', uses: 'Bacterial skin infections, impetigo, surgical wound dressing' },
  { name: 'Electral ORS Powder', composition: 'WHO Oral Rehydration Salts (21.8g)', dosageForm: 'Powder', manufacturer: 'FDC Ltd', packSize: 'Sachet of 21.8 gm', mrp: 22.8, schedule: 'OTC', defaultInstructions: 'Dissolve 1 sachet in 1 litre of clean drinking water', uses: 'Dehydration due to diarrhea, vomiting, heat exhaustion' },
]

async function main() {
  console.log('[Seed] Initializing AetherMed Cloud HMS SaaS database...')

  // 1. Platform Admin (exact user from image-1.png)
  const platformPasswordHash = await hashPassword('Admin@123')
  await dbUnscoped.platformAdmin.upsert({
    where: { email: 'aetherdevsolutions@gmail.com' },
    update: { name: 'Akash Shinde', password: platformPasswordHash },
    create: {
      email: 'aetherdevsolutions@gmail.com',
      name: 'Akash Shinde',
      password: platformPasswordHash,
      isActive: true,
    },
  })

  // 2. Dynamic SaaS Plans (reflected live on Landing Page & Platform Admin)
  const existingPlans = await dbUnscoped.plan.count()
  let basicPlanId = ''
  let advancePlanId = ''
  let enterprisePlanId = ''

  if (existingPlans === 0) {
    const basic = await dbUnscoped.plan.create({
      data: {
        name: 'Basic',
        tier: 'basic',
        doctorLimit: 3,
        branchLimit: 1,
        staffLimit: 4,
        bedLimit: 10,
        storageLimitMB: 2048,
        priceMonthly: 1999,
        priceYearly: 19990,
        sortOrder: 1,
        featuresJson: JSON.stringify({
          opd: true,
          ipd: true,
          medwiki: true,
          lab: true,
          customBranding: false,
          analytics: false,
        }),
      },
    })
    const advance = await dbUnscoped.plan.create({
      data: {
        name: 'Advance Hospital',
        tier: 'advance',
        doctorLimit: 12,
        branchLimit: 3,
        staffLimit: 25,
        bedLimit: 60,
        storageLimitMB: 10240,
        priceMonthly: 4999,
        priceYearly: 49990,
        sortOrder: 2,
        featuresJson: JSON.stringify({
          opd: true,
          ipd: true,
          medwiki: true,
          lab: true,
          customBranding: true,
          analytics: true,
        }),
      },
    })
    const enterprise = await dbUnscoped.plan.create({
      data: {
        name: 'Enterprise Multispecialty',
        tier: 'enterprise',
        doctorLimit: 50,
        branchLimit: 99,
        staffLimit: 150,
        bedLimit: 250,
        storageLimitMB: 51200,
        priceMonthly: 9999,
        priceYearly: 99990,
        sortOrder: 3,
        featuresJson: JSON.stringify({
          opd: true,
          ipd: true,
          medwiki: true,
          lab: true,
          customBranding: true,
          analytics: true,
          whiteLabel: true,
        }),
      },
    })
    basicPlanId = basic.id
    advancePlanId = advance.id
    enterprisePlanId = enterprise.id
  } else {
    const plans = await dbUnscoped.plan.findMany({ orderBy: { sortOrder: 'asc' } })
    basicPlanId = plans[0]?.id || ''
    advancePlanId = plans[1]?.id || basicPlanId
    enterprisePlanId = plans[2]?.id || advancePlanId
  }
  void enterprisePlanId

  // 3. Seed Global MedWiki Medicine Catalog
  const medSync = await normalizeAndUpsertMedicines(MEDWIKI_CURATED_CATALOG, {
    triggerSource: 'seed',
    mode: 'curated_medwiki_catalog',
    queryOrTerm: 'A-Z High-Frequency OPD & IPD Formulary',
  })
  console.log(`[Seed] MedWiki Global Catalog ready: ${medSync.insertedCount} inserted, ${medSync.updatedCount} updated.`)

  // 4. Seed Tenant #1: Sahyadri Multispecialty Hospital Pune (Full OPD + IPD Demo)
  const existingOrg1 = await dbUnscoped.organization.findUnique({
    where: { slug: 'sahyadri-hospital-pune' },
  })

  if (!existingOrg1) {
    const org1 = await dbUnscoped.organization.create({
      data: {
        name: 'Sahyadri Multispecialty Hospital Pune',
        slug: 'sahyadri-hospital-pune',
        type: 'multispecialty',
        phone: '+91 20 6721 3000',
        email: 'admin@sahyadrihospitalpune.in',
        address: 'Plot 14, Baner-Balewadi High Street, Pune',
        city: 'Pune',
        state: 'Maharashtra',
        gstNumber: '27AABCS1429B1Z5',
        status: 'active',
      },
    })

    await dbUnscoped.subscription.create({
      data: {
        organizationId: org1.id,
        planId: advancePlanId,
        status: 'active',
        billingCycle: 'monthly',
        paymentProvider: 'manual',
        currentPeriodStart: new Date('2026-11-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      },
    })

    await dbUnscoped.clinicSettings.create({
      data: {
        organizationId: org1.id,
        clinicDisplayName: 'Sahyadri Multispecialty Hospital',
        tagline: '24x7 Emergency, ICU, IPD & Super-Specialty OPD Care',
        address: 'Plot 14, Baner-Balewadi High Street, Pune - 411045',
        phone: '+91 20 6721 3000',
        emergencyPhone: '+91 20 6721 3999',
        email: 'care@sahyadrihospitalpune.in',
        gstNumber: '27AABCS1429B1Z5',
        uhidPrefix: 'SHP',
        invoicePrefix: 'INV',
        ipdPrefix: 'IPD',
        upiId: 'sahyadrihospital@icici',
        bankName: 'ICICI Bank — Baner Branch',
        bankAccountNo: '003905018824',
        bankIfsc: 'ICIC0000039',
      },
    })

    const branch1 = await dbUnscoped.branch.create({
      data: {
        organizationId: org1.id,
        name: 'Baner Main Hospital',
        code: 'BANER-HQ',
        address: 'Baner-Balewadi High Street, Pune',
        city: 'Pune',
        phone: '+91 20 6721 3000',
        isMain: true,
      },
    })

    const adminPwd = 'Sahyadri@123'
    const dr1 = await dbUnscoped.user.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        email: 'admin@sahyadrihospitalpune.in',
        password: await hashPassword(adminPwd),
        generatedPasswordEnc: encryptSecret(adminPwd),
        name: 'Dr. Siddharth Deshmukh',
        phone: '9822014500',
        role: 'super_admin',
        specialization: 'Internal Medicine & Critical Care',
        qualification: 'MBBS, MD (Medicine), IDCCM',
        registrationNo: 'MMC-2016-084512',
        consultationFee: 700,
        takesConsultations: true,
      },
    })

    const dr2 = await dbUnscoped.user.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        email: 'ananya.kulkarni@sahyadrihospitalpune.in',
        password: await hashPassword('Doctor@123'),
        name: 'Dr. Ananya Kulkarni',
        phone: '9822014501',
        role: 'doctor',
        specialization: 'Pediatrics & Neonatology',
        qualification: 'MBBS, DNB (Pediatrics)',
        registrationNo: 'MMC-2019-092341',
        consultationFee: 600,
        takesConsultations: true,
      },
    })

    await dbUnscoped.user.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        email: 'reception@sahyadrihospitalpune.in',
        password: await hashPassword('Staff@123'),
        name: 'Priya Jadhav',
        phone: '9822014509',
        role: 'receptionist',
        takesConsultations: false,
      },
    })

    // Seed IPD Bed Categories (Wards) & Beds
    const wardGen = await dbUnscoped.bedCategory.create({
      data: {
        organizationId: org1.id,
        name: 'General Ward',
        code: 'GEN',
        floor: '1st Floor',
        dailyRate: 1500,
        nursingChargeDay: 400,
        color: '#0d9488',
        description: 'Multi-bed ventilated general recovery ward',
      },
    })
    const wardSemi = await dbUnscoped.bedCategory.create({
      data: {
        organizationId: org1.id,
        name: 'Semi-Private Twin',
        code: 'SEMI',
        floor: '2nd Floor',
        dailyRate: 3000,
        nursingChargeDay: 600,
        color: '#0284c7',
        description: 'Twin-sharing AC room with central oxygen',
      },
    })
    const wardPvt = await dbUnscoped.bedCategory.create({
      data: {
        organizationId: org1.id,
        name: 'Private Deluxe Suite',
        code: 'PVT',
        floor: '3rd Floor',
        dailyRate: 5500,
        nursingChargeDay: 900,
        color: '#7c3aed',
        description: 'Private AC room with attendant couch & smart monitor',
      },
    })
    const wardIcu = await dbUnscoped.bedCategory.create({
      data: {
        organizationId: org1.id,
        name: 'Medical ICU',
        code: 'ICU',
        floor: '4th Floor',
        dailyRate: 8500,
        nursingChargeDay: 1800,
        color: '#dc2626',
        description: '1:1 ICU bed with multipara monitor, oxygen & ventilator',
      },
    })

    const createdBeds: Record<string, string> = {}
    const bedSpecs = [
      { cat: wardGen, nums: ['GEN-101', 'GEN-102', 'GEN-103', 'GEN-104', 'GEN-105'], ox: true, vent: false, mon: false },
      { cat: wardSemi, nums: ['SEMI-201', 'SEMI-202', 'SEMI-203', 'SEMI-204'], ox: true, vent: false, mon: true },
      { cat: wardPvt, nums: ['PVT-301', 'PVT-302', 'PVT-303'], ox: true, vent: false, mon: true },
      { cat: wardIcu, nums: ['ICU-01', 'ICU-02', 'ICU-03', 'ICU-04'], ox: true, vent: true, mon: true },
    ]
    for (const spec of bedSpecs) {
      for (const bn of spec.nums) {
        const b = await dbUnscoped.bed.create({
          data: {
            organizationId: org1.id,
            branchId: branch1.id,
            categoryId: spec.cat.id,
            bedNumber: bn,
            floor: spec.cat.floor,
            hasOxygen: spec.ox,
            hasVentilator: spec.vent,
            hasMonitor: spec.mon,
            status: bn === 'GEN-105' ? 'cleaning' : 'free',
          },
        })
        createdBeds[bn] = b.id
      }
    }

    // Seed Patients
    const p1 = await dbUnscoped.patient.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        uhid: 'SHP-0001',
        name: 'Rajeshwar Patil',
        gender: 'Male',
        ageYears: 58,
        bloodGroup: 'B+',
        phone: '9850112233',
        city: 'Pune',
        address: 'Aundh Road, Pune',
        abhaNumber: '91-4421-8830-1920',
        allergies: 'Sulfa Drugs, Penicillin',
        chronicConditions: 'Type 2 Diabetes, Hypertension',
        emergencyContact: 'Sunita Patil (Wife)',
        emergencyPhone: '9850112234',
        insuranceProvider: 'Star Health Insurance',
        isVip: true,
      },
    })

    const p2 = await dbUnscoped.patient.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        uhid: 'SHP-0002',
        name: 'Meera Shinde',
        gender: 'Female',
        ageYears: 34,
        bloodGroup: 'O+',
        phone: '9765401122',
        city: 'Pune',
        address: 'Wakad, Pune',
        allergies: 'None known',
        chronicConditions: 'Hypothyroidism',
        emergencyContact: 'Rohan Shinde (Husband)',
        emergencyPhone: '9765401123',
      },
    })

    const p3 = await dbUnscoped.patient.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        uhid: 'SHP-0003',
        name: 'Aarav Joshi',
        gender: 'Male',
        ageYears: 7,
        bloodGroup: 'A+',
        phone: '9923104455',
        city: 'Pune',
        address: 'Pashan, Pune',
        allergies: 'Dust mites',
        emergencyContact: 'Vikram Joshi (Father)',
        emergencyPhone: '9923104455',
      },
    })

    const p4 = await dbUnscoped.patient.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        uhid: 'SHP-0004',
        name: 'Sureshchandra Gokhale',
        gender: 'Male',
        ageYears: 66,
        bloodGroup: 'AB+',
        phone: '9422019988',
        city: 'Pune',
        address: 'Kothrud, Pune',
        allergies: 'Ibuprofen / NSAIDs',
        chronicConditions: 'COPD, Ischemic Heart Disease',
        emergencyContact: 'Nikhil Gokhale (Son)',
        emergencyPhone: '9422019989',
        insuranceProvider: 'HDFC ERGO TPA',
      },
    })

    const p5 = await dbUnscoped.patient.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        uhid: 'SHP-0005',
        name: 'Snehal Pawar',
        gender: 'Female',
        ageYears: 29,
        bloodGroup: 'O+',
        phone: '9881234567',
        city: 'Pune',
        address: 'Hinjawadi Phase 1, Pune',
      },
    })

    // Seed 2 Active IPD Admissions (syncing bed occupancy)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

    const ipd1 = await dbUnscoped.ipdAdmission.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        admissionNo: 'IPD-0001',
        patientId: p4.id,
        bedId: createdBeds['ICU-01'],
        admittingDoctorId: dr1.id,
        admissionType: 'Emergency',
        admittedAt: threeDaysAgo,
        status: 'admitted',
        provisionalDiagnosis: 'Acute Exacerbation of COPD with Lower Respiratory Tract Infection',
        chiefComplaints: 'Severe breathlessness at rest, productive cough, SpO2 86% on room air',
        allergiesSnapshot: p4.allergies,
        attendantName: 'Nikhil Gokhale',
        attendantRelation: 'Son',
        attendantPhone: '9422019989',
        insuranceTpa: 'HDFC ERGO TPA',
        preAuthAmount: 45000,
      },
    })
    await dbUnscoped.bed.update({
      where: { id: createdBeds['ICU-01'] },
      data: { status: 'occupied', lastAdmittedAt: threeDaysAgo },
    })

    await dbUnscoped.ipdRoundNote.createMany({
      data: [
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          authorId: dr1.id,
          authorName: dr1.name,
          noteType: 'ICU Chart',
          observations: 'Patient conscious, oriented. Bilateral wheeze reduced after Duolin + Budecort nebulization. Maintaining SpO2 96% on 2L O2 nasal prongs.',
          plan: 'Continue IV Tazact 4.5gm TDS, wean oxygen to 1L/min tonight, repeat ABG & CBC tomorrow morning.',
          vitalsText: 'BP 134/82 mmHg · Pulse 88/min · SpO2 96% (2L O2) · Temp 98.8°F',
          recordedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          authorName: 'Sister Kavita More (ICU Nurse)',
          noteType: 'Nursing Handover',
          observations: 'Evening nebulization and IV antibiotic dose administered without adverse reaction. Urine output adequate (1450 ml/24h).',
          plan: 'Strict input/output charting, head-end elevation 30 degrees.',
          vitalsText: 'BP 128/80 mmHg · Pulse 84/min · SpO2 97% · RBS 142 mg/dL',
          recordedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ],
    })

    await dbUnscoped.ipdMedicationOrder.createMany({
      data: [
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          orderedById: dr1.id,
          medicineName: 'Tazact 4.5gm Injection',
          genericName: 'Piperacillin + Tazobactam',
          strength: '4.5 gm',
          dosageForm: 'Injection',
          dosage: '1 vial in 100ml NS',
          route: 'IV',
          frequency: '1-1-1',
          duration: '5 days',
          unitPrice: 445,
          dosesGiven: 8,
          status: 'active',
        },
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          orderedById: dr1.id,
          medicineName: 'Pantocid IV 40mg Injection',
          genericName: 'Pantoprazole',
          strength: '40 mg',
          dosageForm: 'Injection',
          dosage: '1 vial',
          route: 'IV',
          frequency: '1-0-1',
          duration: '5 days',
          unitPrice: 56.5,
          dosesGiven: 5,
          status: 'active',
        },
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          orderedById: dr1.id,
          medicineName: 'Duolin Respules 3ml',
          genericName: 'Levosalbutamol + Ipratropium',
          strength: '3 ml',
          dosageForm: 'Inhaler',
          dosage: '1 respule',
          route: 'Nebulization',
          frequency: '1-1-1-1',
          duration: '5 days',
          unitPrice: 62,
          dosesGiven: 10,
          status: 'active',
        },
      ],
    })

    await dbUnscoped.ipdChargeItem.createMany({
      data: [
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          category: 'Oxygen/Ventilator',
          description: 'Continuous Oxygen Therapy & Multipara Monitoring (3 days)',
          quantity: 3,
          unitRate: 1200,
          amount: 3600,
          addedBy: dr1.name,
        },
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd1.id,
          category: 'Lab',
          description: 'Arterial Blood Gas (ABG) + Complete Blood Count + CRP + Chest X-Ray Portable',
          quantity: 1,
          unitRate: 2850,
          amount: 2850,
          addedBy: dr1.name,
        },
      ],
    })

    await dbUnscoped.patientDeposit.create({
      data: {
        organizationId: org1.id,
        receiptNo: 'DEP-0001',
        patientId: p4.id,
        ipdAdmissionId: ipd1.id,
        amount: 20000,
        paymentMode: 'UPI',
        referenceNo: 'UPI431980112450',
        notes: 'Initial ICU admission advance deposit',
        receivedBy: 'Priya Jadhav',
        depositedAt: threeDaysAgo,
      },
    })

    // Second Active IPD Admission (Private Deluxe)
    const ipd2 = await dbUnscoped.ipdAdmission.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        admissionNo: 'IPD-0002',
        patientId: p2.id,
        bedId: createdBeds['PVT-301'],
        admittingDoctorId: dr1.id,
        admissionType: 'Planned',
        admittedAt: twoDaysAgo,
        status: 'admitted',
        provisionalDiagnosis: 'Acute Dengue Fever with Thrombocytopenia (Platelets 58,000)',
        chiefComplaints: 'High grade fever with chills for 4 days, retro-orbital pain, myalgia',
        attendantName: 'Rohan Shinde',
        attendantRelation: 'Husband',
        attendantPhone: '9765401123',
      },
    })
    await dbUnscoped.bed.update({
      where: { id: createdBeds['PVT-301'] },
      data: { status: 'occupied', lastAdmittedAt: twoDaysAgo },
    })

    await dbUnscoped.patientDeposit.create({
      data: {
        organizationId: org1.id,
        receiptNo: 'DEP-0002',
        patientId: p2.id,
        ipdAdmissionId: ipd2.id,
        amount: 10000,
        paymentMode: 'Card',
        referenceNo: 'POS-991042',
        notes: 'Admission deposit',
        receivedBy: 'Priya Jadhav',
        depositedAt: twoDaysAgo,
      },
    })

    await dbUnscoped.ipdMedicationOrder.createMany({
      data: [
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd2.id,
          orderedById: dr1.id,
          medicineName: 'Ringer Lactate (RL) IV Fluid 500ml',
          genericName: 'Sodium Lactate Compound',
          dosageForm: 'Infusion',
          dosage: '500 ml @ 100ml/hr',
          route: 'IV Infusion',
          frequency: '1-1-1',
          duration: '3 days',
          unitPrice: 68,
          dosesGiven: 6,
          status: 'active',
        },
        {
          organizationId: org1.id,
          ipdAdmissionId: ipd2.id,
          orderedById: dr1.id,
          medicineName: 'Kabimol 1000mg IV Infusion',
          genericName: 'Paracetamol',
          dosageForm: 'Infusion',
          dosage: '100 ml IV',
          route: 'IV Infusion',
          frequency: 'SOS (Temp > 100.4F)',
          duration: '3 days',
          unitPrice: 312,
          dosesGiven: 3,
          status: 'active',
        },
      ],
    })

    // Seed Today's OPD Queue
    const todayStr = new Date().toISOString().slice(0, 10)
    await dbUnscoped.opdQueue.createMany({
      data: [
        {
          organizationId: org1.id,
          patientId: p1.id,
          doctorId: dr1.id,
          tokenNumber: 1,
          queueDate: todayStr,
          priority: 'vip',
          visitType: 'Follow-up',
          chiefComplaint: 'BP & fasting blood sugar review, mild pedal edema',
          status: 'vitals_done',
        },
        {
          organizationId: org1.id,
          patientId: p3.id,
          doctorId: dr2.id,
          tokenNumber: 2,
          queueDate: todayStr,
          priority: 'urgent',
          visitType: 'New Visit',
          chiefComplaint: 'Fever 101.8°F since yesterday night and cough',
          status: 'waiting',
        },
        {
          organizationId: org1.id,
          patientId: p5.id,
          doctorId: dr1.id,
          tokenNumber: 3,
          queueDate: todayStr,
          priority: 'normal',
          visitType: 'New Visit',
          chiefComplaint: 'Migraine headache and epigastric burning',
          status: 'in_consultation',
        },
      ],
    })

    await dbUnscoped.vitalSign.create({
      data: {
        organizationId: org1.id,
        patientId: p1.id,
        bpSystolic: 142,
        bpDiastolic: 88,
        pulse: 78,
        temperatureF: 98.4,
        spo2: 99,
        weightKg: 76.5,
        heightCm: 171,
        bloodSugar: 136,
        recordedBy: 'Priya Jadhav',
      },
    })

    // Seed Sample Prescription + Invoice
    const rx1 = await dbUnscoped.prescription.create({
      data: {
        organizationId: org1.id,
        prescriptionNo: 'RX-0001',
        patientId: p1.id,
        doctorId: dr1.id,
        chiefComplaints: 'Uncontrolled evening BP readings, fasting sugar 136 mg/dL',
        diagnosis: 'Essential Hypertension with Type 2 Diabetes Mellitus',
        icdCode: 'I10 / E11.9',
        labInvestigations: 'HbA1c, Lipid Profile, Serum Creatinine, Urine Microalbumin',
        advice: 'Restrict salt intake (<4g/day). Avoid pickles, papad & packaged foods. Brisk 30-min morning walk daily.',
        followUpDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        items: {
          create: [
            {
              medicineName: 'Telma-AM Tablet',
              genericName: 'Telmisartan (40mg) + Amlodipine (5mg)',
              dosageForm: 'Tablet',
              strength: '40mg + 5mg',
              dosage: '1 tablet',
              frequency: '1-0-0',
              timing: 'After Breakfast',
              duration: '30 days',
              route: 'Oral',
              quantity: 30,
            },
            {
              medicineName: 'Glycomet-GP 1 Tablet PR',
              genericName: 'Glimepiride (1mg) + Metformin (500mg)',
              dosageForm: 'Tablet',
              strength: '1mg + 500mg',
              dosage: '1 tablet',
              frequency: '1-0-1',
              timing: '15 mins Before Food',
              duration: '30 days',
              route: 'Oral',
              quantity: 60,
            },
            {
              medicineName: 'Atorva 20 Tablet',
              genericName: 'Atorvastatin (20mg)',
              dosageForm: 'Tablet',
              strength: '20mg',
              dosage: '1 tablet',
              frequency: '0-0-1',
              timing: 'At Bedtime',
              duration: '30 days',
              route: 'Oral',
              quantity: 30,
            },
          ],
        },
      },
    })
    void rx1

    const inv1 = await dbUnscoped.invoice.create({
      data: {
        organizationId: org1.id,
        branchId: branch1.id,
        invoiceNo: 'INV-0001',
        patientId: p1.id,
        billType: 'OPD',
        subtotal: 1250,
        discount: 0,
        gstPercent: 0,
        gstAmount: 0,
        totalAmount: 1250,
        amountPaid: 1250,
        balanceDue: 0,
        status: 'paid',
        paymentMode: 'UPI',
        items: {
          create: [
            { category: 'Consultation', description: 'Super-Specialty OPD Consultation — Dr. Siddharth Deshmukh', quantity: 1, unitRate: 700, amount: 700 },
            { category: 'Procedure', description: '12-Lead Digital ECG + Random Blood Glucose', quantity: 1, unitRate: 550, amount: 550 },
          ],
        },
      },
    })

    await dbUnscoped.payment.create({
      data: {
        organizationId: org1.id,
        paymentNo: 'PAY-0001',
        patientId: p1.id,
        invoiceId: inv1.id,
        amount: 1250,
        paymentMode: 'UPI',
        referenceNo: 'UPI-882910442',
      },
    })
  }

  // 5. Seed Tenant #2: Arogya Care Clinic Kharadi (Second multi-tenant org visible in Platform Admin)
  const existingOrg2 = await dbUnscoped.organization.findUnique({
    where: { slug: 'arogya-care-kharadi' },
  })

  if (!existingOrg2) {
    const org2 = await dbUnscoped.organization.create({
      data: {
        name: 'Arogya Care Clinic & Daycare Kharadi',
        slug: 'arogya-care-kharadi',
        type: 'clinic',
        phone: '+91 20 4890 1200',
        email: 'admin@arogyacarekharadi.in',
        address: 'EON Free Zone Road, Kharadi, Pune',
        city: 'Pune',
        state: 'Maharashtra',
        status: 'active',
      },
    })

    await dbUnscoped.subscription.create({
      data: {
        organizationId: org2.id,
        planId: basicPlanId,
        status: 'active',
        billingCycle: 'monthly',
        paymentProvider: 'manual',
        currentPeriodStart: new Date('2026-11-10T00:00:00Z'),
        currentPeriodEnd: new Date('2026-12-10T00:00:00Z'),
      },
    })

    await dbUnscoped.clinicSettings.create({
      data: {
        organizationId: org2.id,
        clinicDisplayName: 'Arogya Care Polyclinic & Daycare',
        tagline: 'Family Medicine, Pediatrics & Daycare Observation',
        address: 'EON Free Zone Road, Kharadi, Pune - 411014',
        phone: '+91 20 4890 1200',
        uhidPrefix: 'ACK',
      },
    })

    const br2 = await dbUnscoped.branch.create({
      data: {
        organizationId: org2.id,
        name: 'Kharadi Main Branch',
        code: 'KHD-01',
        city: 'Pune',
        isMain: true,
      },
    })

    const org2Pwd = 'Arogya@123'
    await dbUnscoped.user.create({
      data: {
        organizationId: org2.id,
        branchId: br2.id,
        email: 'admin@arogyacarekharadi.in',
        password: await hashPassword(org2Pwd),
        generatedPasswordEnc: encryptSecret(org2Pwd),
        name: 'Dr. Rohit Kulkarni',
        phone: '9890112200',
        role: 'super_admin',
        specialization: 'General Physician',
        qualification: 'MBBS, DNB',
        registrationNo: 'MMC-2018-041290',
        consultationFee: 500,
      },
    })

    const dayWard = await dbUnscoped.bedCategory.create({
      data: {
        organizationId: org2.id,
        name: 'Daycare Observation Ward',
        code: 'DAY',
        floor: 'Ground Floor',
        dailyRate: 1200,
        nursingChargeDay: 300,
      },
    })
    for (const bn of ['DAY-01', 'DAY-02', 'DAY-03', 'DAY-04']) {
      await dbUnscoped.bed.create({
        data: {
          organizationId: org2.id,
          branchId: br2.id,
          categoryId: dayWard.id,
          bedNumber: bn,
          floor: 'Ground Floor',
          hasOxygen: true,
        },
      })
    }

    await dbUnscoped.patient.create({
      data: {
        organizationId: org2.id,
        branchId: br2.id,
        uhid: 'ACK-0001',
        name: 'Pooja Nimbalkar',
        gender: 'Female',
        ageYears: 31,
        bloodGroup: 'B+',
        phone: '9764001122',
        city: 'Pune',
      },
    })
  }

  // 6. Seed Sample Inquiries & Blog Posts
  const inqCount = await dbUnscoped.platformInquiry.count()
  if (inqCount === 0) {
    await dbUnscoped.platformInquiry.createMany({
      data: [
        {
          clinicName: 'Lotus Ortho & Trauma Hospital',
          contactName: 'Dr. Mahesh Bhosale',
          email: 'drmahesh@lotushospitalnashik.in',
          phone: '9823045678',
          city: 'Nashik',
          facilityType: 'Hospital (OPD + IPD)',
          bedsCount: '45 Beds',
          selectedPlan: 'Advance Hospital',
          message: 'Looking to migrate our 45-bed orthopedic hospital from legacy desktop software to cloud OPD + IPD + Pharmacy billing.',
          status: 'new',
          followUpsJson: JSON.stringify([]),
        },
        {
          clinicName: 'Niramay Lifecare Nursing Home',
          contactName: 'Dr. Sneha Chavan',
          email: 'sneha@niramaykolhapur.in',
          phone: '9890445566',
          city: 'Kolhapur',
          facilityType: 'Hospital (OPD + IPD)',
          bedsCount: '25 Beds',
          selectedPlan: 'Advance Hospital',
          message: 'Need live IPD bed occupancy board, advance deposit receipts, and Marathi prescription printouts.',
          status: 'demo',
          followUpsJson: JSON.stringify([
            {
              id: 'fu-1',
              date: '2026-11-14',
              by: 'Akash Shinde',
              note: 'Walked through OPD Rx Pad & IPD Ward Bed Board on Zoom. Demo approved — onboarding next week.',
              nextDate: '2026-11-18',
            },
          ]),
        },
      ],
    })
  }

  const blogCount = await dbUnscoped.blogPost.count()
  if (blogCount === 0) {
    await dbUnscoped.blogPost.createMany({
      data: [
        {
          slug: 'how-unified-opd-ipd-cloud-hms-reduces-discharge-delays',
          title: 'How Unified OPD + IPD Cloud HMS Cuts Hospital Discharge Time by 65%',
          category: 'IPD Operations',
          readTimeMin: 4,
          description: 'Manual bed registers and disconnected pharmacy/ward billing stall discharges for hours. Here is how transactional IPD bed boards and live deposit ledgers eliminate discharge bottlenecks.',
          body: `## Why Hospital Discharges Take Hours on Legacy Software\n\nIn most 20-to-150 bed Indian hospitals, ward nurses maintain bed occupancy on whiteboards while billing clerks manually calculate room days, ICU shifts, nursing charges, and advance deposits at the moment of discharge.\n\n## Transactional Bed Truth + Running IPD Ledger\n\nAetherMed Cloud HMS models bed occupancy directly from active admission records with transactional single-bed locking. Every daily room charge, nursing round, IV medication order, and advance deposit updates the patient's running IPD bill in real time.\n\n- Zero double-booked beds across ER, ICU, and Deluxe Wards\n- Instant running balance visibility against collected advance deposits\n- One-click NABH-style Discharge Summary with home prescription auto-fill`,
        },
        {
          slug: 'smart-prescriptions-with-live-medwiki-drug-intelligence',
          title: 'Writing 30-Second Digital Prescriptions with Continuous MedWiki Drug Sync',
          category: 'Clinical Productivity',
          readTimeMin: 3,
          description: 'How automated salt composition extraction, Schedule H/H1 alerts, multilingual patient advice (English, Hindi, Marathi), and doctor dosage memory speed up busy OPD clinics.',
          body: `## Designed for High-Volume Indian OPDs\n\nDoctors seeing 60+ OPD patients daily cannot afford slow dropdowns or manual typing of generic salt compositions.\n\n## Sub-10ms Autocomplete + Doctor Smart Memory\n\nAetherMed pairs a continuously synced MedWiki formulary with per-doctor prescribing memory. Select a brand once, and your preferred dosage, frequency (1-0-1), timing (Before/After Food), and Marathi/Hindi dietary instructions fill automatically.`,
        },
      ],
    })
  }

  // Seed Affiliate & Referral Program data
  const partnerCount = await dbUnscoped.affiliatePartner.count()
  if (partnerCount === 0) {
    const sahyadriOrg = await dbUnscoped.organization.findUnique({
      where: { slug: 'sahyadri-hospital-pune' },
    })
    const partner1 = await dbUnscoped.affiliatePartner.create({
      data: {
        name: 'Sahyadri Multispecialty Hospital Referral Desk',
        email: 'admin@sahyadrihospitalpune.in',
        phone: '9822011223',
        companyOrClinic: 'Sahyadri Multispecialty Hospital Pune',
        city: 'Pune',
        referralCode: 'HOSP-SAHYADRI20',
        upiOrBankDetails: 'sahyadrihospital@icici',
        commissionPercent: 20,
        clicksCount: 48,
        totalReferrals: 3,
        convertedCount: 2,
        totalEarnedINR: 19996,
        pendingPayoutINR: 4999,
        organizationId: sahyadriOrg?.id || null,
      },
    })
    await dbUnscoped.referralLead.createMany({
      data: [
        {
          partnerId: partner1.id,
          referredClinicName: 'Deccan Heart & Lung Institute',
          contactName: 'Dr. Vivek Joshi',
          contactPhone: '9823019988',
          contactEmail: 'vivek@deccanheartpune.in',
          city: 'Pune',
          planInterested: 'Advance Hospital',
          status: 'converted',
          rewardAmountINR: 9998,
        },
        {
          partnerId: partner1.id,
          referredClinicName: 'Kothrud Ortho & Trauma Nursing Home',
          contactName: 'Dr. Prachi Gokhale',
          contactPhone: '9850123499',
          contactEmail: 'prachi@kothrudortho.in',
          city: 'Pune',
          planInterested: 'Advance Hospital',
          status: 'demo_booked',
          rewardAmountINR: 4999,
        },
      ],
    })

    await dbUnscoped.affiliatePartner.create({
      data: {
        name: 'MedTech Maharashtra IT Consultants',
        email: 'partners@medtechmh.in',
        phone: '9765001122',
        companyOrClinic: 'MedTech IT & Pharmacy Distributors',
        city: 'Mumbai',
        referralCode: 'AFF-MEDTECH20',
        upiOrBankDetails: 'medtechmh@okaxis',
        commissionPercent: 25,
        clicksCount: 112,
        totalReferrals: 5,
        convertedCount: 3,
        totalEarnedINR: 37490,
        pendingPayoutINR: 7490,
      },
    })
  }

  console.log('[Seed] All Platform, Tenant, MedWiki, OPD, IPD & Affiliate seed data ready!')
}

main()
  .catch((err) => {
    console.error('[Seed] Failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await dbUnscoped.$disconnect()
  })
