# MEDWIKI SCRAPER - DIRECT MYSQL SAVE
# Scrapes ALL molecules A-Z from medwiki.co.in
# Saves directly to medicines database - no duplicates

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager
import time
import random
import re
import string
import logging
import sys
import json
import os
from datetime import datetime
import urllib.parse
import requests

try:
    import mysql.connector
except ImportError:
    print("Installing mysql-connector-python...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "mysql-connector-python"], check=True)
    import mysql.connector

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'medwiki_{datetime.now().strftime("%Y%m%d")}.log', encoding='utf-8'),
        logging.StreamHandler(stream=open(sys.stdout.fileno(), mode='w', encoding='utf-8', closefd=False))
    ]
)
logger = logging.getLogger(__name__)

# ── DB Config ──────────────────────────────────────────────────────────────────
DB_CONFIG = {
    'host':     'localhost',
    'user':     'root',
    'password': 'root',
    'database': 'medicines',
    'charset':  'utf8mb4',
}

CHECKPOINT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scraper_checkpoint.json')

# ── Form / Route / Default Dose Maps ──────────────────────────────────────────
# Order matters: most specific first to avoid false matches
FORM_MAP = [
    # Ophthalmic / ENT — before generic "drops"
    ('Eye Drop',      r'\beye\s*drops?\b|\bophthalmic\s*drops?\b|\beye\s*oint(?:ment)?\b|\bocular\s*drops?\b'),
    ('Eye Ointment',  r'\beye\s*oint(?:ment)?\b|\bophthalmic\s*oint(?:ment)?\b'),
    ('Ear Drop',      r'\bear\s*drops?\b|\botic\s*drops?\b|\botic\s*solution\b'),
    ('Nasal Drop',    r'\bnasal\s*drops?\b|\bnasal\s*solution\b|\bnose\s*drops?\b'),
    ('Nasal Spray',   r'\bnasal\s*spray\b|\bnasal\s*mist\b'),
    # Inhalation
    ('Inhaler',       r'\binhaler\b|\brespule\b|\brotacap\b|\brotahaler\b|\bnebuliz\b|\bbreathe\b'),
    # Parenteral
    ('Injection',     r'\binjection\b|\binj\b|\bvial\b|\bampoule\b|\bampoule\b|\blyophili\b'),
    ('Infusion',      r'\binfusion\b|\biv\s*drip\b|\biv\s*fluid\b'),
    # Oral liquid
    ('Suspension',    r'\bsuspension\b|\bsusp\b|\bdry\s*syrup\b'),
    ('Syrup',         r'\bsyrup\b|\boral\s*solution\b|\belixir\b|\blinctus\b|\bsolution\s*oral\b'),
    # Oral solid
    ('Capsule',       r'\bcapsule\b|\bsoftgel\b|\bsoft\s*gel\b|\bsoft\s*gelatin\b'),
    ('Tablet',        r'\btablet\b|\bchewable\b|\bdispersible\b|\bsublingual\b|\bbuccal\b'),
    # Topical — solids / semi-solids
    ('Dusting Powder',r'\bdusting\s*powder\b'),
    ('Powder',        r'\bpowder\b|\bsachet\b'),
    ('Ointment',      r'\bointment\b'),
    ('Cream',         r'\bcream\b'),
    ('Gel',           r'\bgel\b'),
    ('Lotion',        r'\blotion\b|\bemulsion\b'),
    ('Soap',          r'\bsoap\b|\bmedicated\s*soap\b'),
    ('Shampoo',       r'\bshampoo\b'),
    ('Foam',          r'\bfoam\b|\bmousse\b'),
    ('Spray',         r'\bspray\b|\baerosol\b'),
    ('Patch',         r'\bpatch\b|\btransdermal\b|\btts\b'),
    ('Suppository',   r'\bsuppository\b|\bsuppositories\b|\bpessary\b'),
    ('Enema',         r'\benema\b'),
    ('Drops',         r'\bdrops?\b'),
    ('Solution',      r'\bsolution\b|\bliquid\b'),
]

# Medwiki page sometimes has explicit "Type:" / "Dosage Form:" labels — values to match
FORM_LABEL_SYNONYMS = {
    'tablet':          'Tablet',    'tablets':         'Tablet',
    'capsule':         'Capsule',   'capsules':        'Capsule',
    'softgel':         'Capsule',   'soft gelatin':    'Capsule',
    'syrup':           'Syrup',     'oral solution':   'Syrup',
    'suspension':      'Suspension','dry syrup':       'Suspension',
    'injection':       'Injection', 'vial':            'Injection',
    'infusion':        'Infusion',
    'cream':           'Cream',
    'ointment':        'Ointment',  'eye ointment':    'Eye Ointment',
    'gel':             'Gel',
    'lotion':          'Lotion',
    'soap':            'Soap',      'medicated soap':  'Soap',
    'shampoo':         'Shampoo',
    'powder':          'Powder',    'dusting powder':  'Dusting Powder',
    'sachet':          'Powder',
    'spray':           'Spray',     'nasal spray':     'Nasal Spray',
    'inhaler':         'Inhaler',   'respule':         'Inhaler',
    'rotacap':         'Inhaler',
    'eye drop':        'Eye Drop',  'eye drops':       'Eye Drop',
    'ear drop':        'Ear Drop',  'ear drops':       'Ear Drop',
    'nasal drop':      'Nasal Drop','nasal drops':     'Nasal Drop',
    'drops':           'Drops',     'drop':            'Drops',
    'patch':           'Patch',     'transdermal':     'Patch',
    'suppository':     'Suppository',
    'solution':        'Solution',  'liquid':          'Solution',
    'foam':            'Foam',      'enema':           'Enema',
}

ROUTE_MAP = {
    'Tablet':          'Oral',
    'Capsule':         'Oral',
    'Syrup':           'Oral',
    'Suspension':      'Oral',
    'Powder':          'Oral',
    'Dusting Powder':  'Topical',
    'Solution':        'Oral',
    'Drops':           'Oral',
    'Injection':       'Injectable',
    'Infusion':        'Injectable',
    'Eye Drop':        'Ophthalmic',
    'Eye Ointment':    'Ophthalmic',
    'Ear Drop':        'Otic',
    'Nasal Drop':      'Nasal',
    'Nasal Spray':     'Nasal',
    'Spray':           'Nasal',
    'Cream':           'Topical',
    'Ointment':        'Topical',
    'Gel':             'Topical',
    'Lotion':          'Topical',
    'Soap':            'Topical',
    'Shampoo':         'Topical',
    'Foam':            'Topical',
    'Patch':           'Transdermal',
    'Inhaler':         'Inhalation',
    'Suppository':     'Rectal',
    'Enema':           'Rectal',
}

# Sensible default dose per form
DEFAULT_DOSAGE_MAP = {
    'Tablet':          '1 tablet',
    'Capsule':         '1 capsule',
    'Syrup':           '5 ml',
    'Suspension':      '5 ml',
    'Eye Drop':        '1 drop',
    'Eye Ointment':    'Apply thin strip',
    'Ear Drop':        '2 drops',
    'Nasal Drop':      '2 drops',
    'Nasal Spray':     '1 spray',
    'Cream':           'Apply thin layer',
    'Ointment':        'Apply thin layer',
    'Gel':             'Apply thin layer',
    'Lotion':          'Apply as directed',
    'Soap':            'Use as directed',
    'Shampoo':         'Apply and rinse',
    'Foam':            'Apply as directed',
    'Dusting Powder':  'Apply thin layer',
    'Inhaler':         '1 puff',
    'Injection':       '1 vial',
    'Infusion':        '1 vial',
    'Powder':          '1 sachet',
    'Drops':           '5 drops',
    'Spray':           '2 sprays',
    'Patch':           '1 patch',
    'Suppository':     '1 suppository',
    'Enema':           '1 enema',
    'Solution':        '5 ml',
}

# Sensible default frequency per form
DEFAULT_FREQ_MAP = {
    'Tablet':          '1-0-1',
    'Capsule':         '1-0-1',
    'Syrup':           '1-1-1',
    'Suspension':      '1-1-1',
    'Eye Drop':        '1-0-1',
    'Eye Ointment':    '1-0-1',
    'Ear Drop':        '1-0-1',
    'Nasal Drop':      '1-0-1',
    'Nasal Spray':     '1-0-1',
    'Cream':           '1-0-1',
    'Ointment':        '1-0-1',
    'Gel':             '1-0-1',
    'Lotion':          '1-0-1',
    'Soap':            '1-0-1',
    'Shampoo':         '1-0-0',
    'Foam':            '1-0-1',
    'Dusting Powder':  '1-0-1',
    'Inhaler':         '1-0-1',
    'Injection':       '0-0-1',
    'Infusion':        '0-0-1',
    'Powder':          '1-1-1',
    'Drops':           '1-1-1',
    'Spray':           '1-0-1',
    'Patch':           '1-0-0',
    'Suppository':     '0-0-1',
    'Enema':           '0-0-1',
    'Solution':        '1-1-1',
}


def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"Checkpoint loaded: resuming from term '{data.get('last_term')}' (index {data.get('term_index', 0)})")
            return data
        except Exception as e:
            logger.warning(f"Checkpoint read failed ({e}), starting fresh")
    return {}


def save_checkpoint(term, term_index, seen_mol_urls):
    try:
        with open(CHECKPOINT_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'last_term':     term,
                'term_index':    term_index,
                'seen_mol_urls': list(seen_mol_urls),
            }, f, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Checkpoint save failed: {e}")


class MedwikiScraper:

    def __init__(self):
        self.driver          = None
        self.wait            = None
        self.db              = None
        self.cursor          = None
        self.seen_brand_urls = set()
        self.seen_mol_urls   = set()
        self.stats = {
            'molecules': 0, 'brands_found': 0,
            'inserted': 0, 'skipped_dup': 0, 'errors': 0
        }

    # ── Form helpers ───────────────────────────────────────────────────────────
    def _detect_form(self, text):
        """Detect dosage form from any text (name, title, page)."""
        if not text:
            return ''
        for form_name, pattern in FORM_MAP:
            if re.search(pattern, text, re.IGNORECASE):
                return form_name
        return ''

    def _infer_route_from_form(self, form):
        return ROUTE_MAP.get(form, 'Oral')

    def _extract_dosage(self, text, form):
        """Extract clean dosage quantity from text."""
        if text:
            t = text.lower()
            m = re.search(r'(\d+)\s*drops?', t)
            if m:
                return f"{m.group(1)} drops"
            m = re.search(r'(\d+\.?\d*)\s*ml\b', t)
            if m:
                return f"{m.group(1)} ml"
            m = re.search(r'(\d+)\s*puffs?', t)
            if m:
                return f"{m.group(1)} puff"
            m = re.search(r'(\d+)\s*(tablet|capsule|tab|cap)s?', t)
            if m:
                return f"{m.group(1)} {m.group(2)}"
            m = re.search(r'(\d+)\s*sprays?', t)
            if m:
                return f"{m.group(1)} spray"
        return DEFAULT_DOSAGE_MAP.get(form, '1 tablet')

    def _extract_frequency(self, text):
        """Extract frequency pattern (1-0-1 style) from how_to_use / dosage text."""
        if not text:
            return None
        t = text.lower()
        patterns = [
            (r'\bonce\s*daily\b|\bod\b|\bonce\s*a\s*day\b|\bonce\s*in\s*a\s*day\b', '1-0-0'),
            (r'\btwice\s*daily\b|\bbd\b|\bbid\b|\btwice\s*a\s*day\b|\btwo\s*times\s*daily\b', '1-0-1'),
            (r'\bthree\s*times\s*daily\b|\btds\b|\btid\b|\bthrice\s*daily\b|\b3\s*times\s*daily\b', '1-1-1'),
            (r'\bfour\s*times\s*daily\b|\bqid\b|\b4\s*times\s*daily\b', '1-1-1-1'),
            (r'\bat\s*bedtime\b|\bhs\b|\bat\s*night\b|\bnocte\b|\bbefore\s*sleep\b', '0-0-1'),
            (r'\beverning\s*only\b|\bonce\s*at\s*night\b', '0-0-1'),
            (r'\bmorning\s*only\b|\bonce\s*in\s*morning\b|\bevery\s*morning\b', '1-0-0'),
            (r'\bevery\s*8\s*hours?\b', '1-1-1'),
            (r'\bevery\s*12\s*hours?\b', '1-0-1'),
            (r'\bevery\s*6\s*hours?\b', '1-1-1-1'),
            (r'\bevery\s*24\s*hours?\b|\bdaily\b', '1-0-0'),
        ]
        for pattern, freq in patterns:
            if re.search(pattern, t):
                return freq
        return None

    # ── DB ─────────────────────────────────────────────────────────────────────
    def connect_db(self):
        try:
            self.db     = mysql.connector.connect(**DB_CONFIG)
            self.cursor = self.db.cursor()
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS `medicines` (
                  `id` int NOT NULL AUTO_INCREMENT,
                  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
                  `generic_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `brand` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `manufacturer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `dosage_form` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `strength` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `pack_size` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `therapeutic_class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `pharmacological_class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `atc_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `snomed_id` bigint unsigned DEFAULT NULL,
                  `rxnorm_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `mrp` decimal(12,2) DEFAULT NULL,
                  `purchase_price` decimal(12,2) DEFAULT NULL,
                  `schedule` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `is_controlled` tinyint(1) DEFAULT '0',
                  `is_narcotic` tinyint(1) DEFAULT '0',
                  `requires_prescription` tinyint(1) DEFAULT '1',
                  `default_dosage` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `default_frequency` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `default_duration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                  `default_route` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Oral',
                  `default_instructions` text COLLATE utf8mb4_unicode_ci,
                  `usage_count` int DEFAULT '0',
                  `last_used_at` timestamp NULL DEFAULT NULL,
                  `is_active` tinyint(1) DEFAULT '1',
                  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `idx_medicines_name` (`name`),
                  KEY `idx_medicines_generic` (`generic_name`),
                  KEY `idx_medicines_brand` (`brand`),
                  KEY `idx_medicines_category` (`category`),
                  KEY `idx_medicines_therapeutic` (`therapeutic_class`),
                  KEY `idx_medicines_active_popular` (`is_active`,`usage_count`),
                  KEY `idx_medicines_controlled` (`is_controlled`),
                  FULLTEXT KEY `ft_medicines_search` (`name`,`generic_name`,`brand`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            self.db.commit()

            # Fix unique key: name+generic only is wrong — same brand can have
            # different manufacturer or strength (e.g. Dolo 650 by Micro Labs vs USV).
            # Correct key: name + generic + manufacturer + strength + dosage_form.
            try:
                self.cursor.execute("ALTER TABLE medicines DROP INDEX `uk_name_generic`")
                self.db.commit()
            except mysql.connector.Error:
                pass  # index doesn't exist on fresh table — that's fine
            try:
                self.cursor.execute("""
                    ALTER TABLE medicines
                    ADD UNIQUE KEY `uk_name_mfr_strength_form`
                    (`name`(80), `generic_name`(80), `manufacturer`(80),
                     `strength`(50), `dosage_form`(50))
                """)
                self.db.commit()
            except mysql.connector.Error:
                pass  # already exists

            # Load existing records into in-memory set for fast dedup
            self.cursor.execute("""
                SELECT LOWER(CONCAT(
                    COALESCE(name,''), '||',
                    COALESCE(generic_name,''), '||',
                    COALESCE(manufacturer,''), '||',
                    COALESCE(strength,''), '||',
                    COALESCE(dosage_form,'')
                )) FROM medicines
            """)
            for (key,) in self.cursor.fetchall():
                self.seen_brand_urls.add(key)

            logger.info(f"DB connected. Existing records: {len(self.seen_brand_urls)}")
            return True
        except mysql.connector.Error as e:
            logger.error(f"DB connection failed: {e}")
            return False

    def _make_dedup_key(self, d):
        # Compound key matching DB UNIQUE KEY uk_name_mfr_strength_form
        # Only use manufacturer in key if it was actually extracted (non-empty)
        # — empty manufacturer should NOT block different-manufacturer records
        mfr = (d.get('manufacturer', '') or '').strip().lower()
        parts = [
            (d.get('name', '') or '').strip().lower(),
            (d.get('generic', '') or '').strip().lower(),
            mfr,                                               # '' if unknown
            (d.get('strength', '') or '').strip().lower(),
            (d.get('form', '') or '').strip().lower(),
        ]
        key = '||'.join(parts)
        # If manufacturer is blank, append url to make key unique per brand page
        # so two different brands with same name/generic/form but no extracted mfr
        # are NOT wrongly treated as duplicates
        if not mfr and d.get('url'):
            key = key + '||url:' + d['url'].rstrip('/')
        return key

    def insert_medicine(self, d):
        try:
            mrp      = self._to_decimal(d.get('price', ''))
            sched    = d.get('schedule', '') or ''
            is_ctrl  = 1 if any(x in sched for x in ['X', 'H1']) else 0
            rx       = 0 if str(d.get('prescription_required', 'Yes')).lower() == 'no' else 1

            name         = self._trim(d.get('name', ''), 255)
            generic_name = self._trim(d.get('generic', ''), 255)
            manufacturer = self._trim(d.get('manufacturer', ''), 255)
            dosage_form  = self._trim(d.get('form', ''), 100)
            strength     = self._trim(d.get('strength', ''), 100)
            pack_size    = self._trim(d.get('pack_size', ''), 100)

            dedup_key = self._make_dedup_key(d)
            if dedup_key in self.seen_brand_urls:
                self.stats['skipped_dup'] += 1
                logger.debug(f"    [SKIP] Duplicate: {name} | {generic_name} | {strength}")
                return False
            self.seen_brand_urls.add(dedup_key)

            # Derive route + sensible defaults from dosage_form
            route     = self._infer_route_from_form(dosage_form or '')
            how_text  = d.get('how_to_use', '') or d.get('dosage', '') or ''
            def_dose  = self._extract_dosage(how_text, dosage_form or '')
            def_freq  = self._extract_frequency(how_text) or DEFAULT_FREQ_MAP.get(dosage_form or '', '1-0-1')
            def_instr = self._trim(how_text, 500)

            sql = """
                INSERT INTO medicines
                (name, generic_name, brand, manufacturer, dosage_form, strength,
                 pack_size, category, therapeutic_class, mrp, schedule,
                 is_controlled, is_narcotic, requires_prescription,
                 default_dosage, default_frequency, default_route,
                 default_instructions, usage_count, is_active)
                VALUES
                (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s, %s,%s,%s, %s,%s,%s, %s,%s,%s)
            """
            vals = (
                name, generic_name,
                name,                                                          # brand = name
                manufacturer, dosage_form, strength, pack_size,
                self._trim(d.get('category', 'General Medicine'), 100),
                self._trim(d.get('category', ''), 255),
                mrp, self._trim(sched, 20),
                is_ctrl, 0, rx,
                self._trim(def_dose, 100),
                self._trim(def_freq, 100),
                route,
                def_instr,
                0, 1
            )
            self.cursor.execute(sql, vals)
            self.db.commit()
            self.stats['inserted'] += 1

            price_info = f"₹{mrp}" if mrp else "No Price"
            logger.info(
                f"    [SAVED] {name} | Generic: {generic_name} | "
                f"Form: {dosage_form} | Route: {route} | "
                f"Dose: {def_dose} | Freq: {def_freq} | {price_info}"
            )
            return True
        except mysql.connector.IntegrityError as e:
            # DB-level duplicate (safety net — Python dedup should catch first)
            self.stats['skipped_dup'] += 1
            logger.debug(f"    [SKIP-DB-DUP] {name} | {generic_name} | {manufacturer}")
            try:
                self.db.rollback()
            except Exception:
                pass
            return False
        except mysql.connector.Error as e:
            logger.error(f"DB insert error: {e}")
            self.stats['errors'] += 1
            try:
                self.db.rollback()
            except Exception:
                pass
            return False

    def _generic_from_composition(self, composition):
        """Extract clean generic name(s) from composition string.

        Input:  "Neomycin (0.5% w/v) + Beclometasone (0.025% w/v) + Clotrimazole (1% w/v)"
        Output: "Neomycin + Beclometasone + Clotrimazole"

        Input:  "Paracetamol 500mg"
        Output: "Paracetamol"
        """
        if not composition:
            return ''
        # Split on + into individual components
        parts = re.split(r'\s*\+\s*', composition)
        generics = []
        for part in parts[:4]:  # max 4 components
            # Remove dosage brackets: (0.5% w/v), (500mg), (2% w/w)
            part = re.sub(r'\([\d\.\s%a-zA-Z/]+\)', '', part)
            # Remove inline dosage: "500mg", "0.5%w/v", "2% w/v", "10 IU/ml"
            part = re.sub(
                r'\d+\.?\d*\s*(?:mg|mcg|iu|units?|ml|gm|g|%\s*w/[vw]|%\s*v/v|%)',
                '', part, flags=re.IGNORECASE
            )
            # Remove leftover punctuation / brackets
            part = re.sub(r'[\(\)\[\]]', '', part)
            part = part.strip(' ,/')
            if part and len(part) > 1:
                generics.append(part.title())
        return ' + '.join(generics)

    def _strength_from_composition(self, composition):
        """Extract combined strength string from composition.

        "Neomycin (0.5% w/v) + Clotrimazole (1% w/v)" → "0.5% w/v + 1% w/v"
        "Paracetamol 500mg"                             → "500mg"
        """
        if not composition:
            return ''
        # Find all dosage values: (0.5% w/v), 500mg, 2% w/w, etc.
        strengths = re.findall(
            r'(\d+\.?\d*\s*(?:mg|mcg|iu|units?|ml|gm|g|%\s*w/[vw]|%\s*v/v|%))',
            composition, re.IGNORECASE
        )
        return ' + '.join(s.strip() for s in strengths[:4]) if strengths else ''

    def _trim(self, val, maxlen):
        if not val:
            return None
        val = str(val).strip()
        return val[:maxlen] if val else None

    def _to_decimal(self, price_str):
        if not price_str:
            return None
        m = re.search(r'[\d]+(?:\.\d+)?', str(price_str).replace(',', ''))
        return float(m.group(0)) if m else None

    # ── Google fallback ────────────────────────────────────────────────────────
    def fetch_from_google(self, brand_name, generic_name,
                          existing_form="", existing_strength="",
                          existing_manufacturer=""):
        result = {
            'mrp':          None,
            'dosage_form':  existing_form,
            'strength':     existing_strength,
            'manufacturer': existing_manufacturer,
            'generic':      generic_name,
            'composition':  '',
        }
        try:
            query_parts = [brand_name] if brand_name else []
            if generic_name and generic_name.lower() != (brand_name or '').lower():
                query_parts.append(generic_name)
            if existing_strength:
                query_parts.append(existing_strength)
            query_parts.append("medicine India MRP uses manufacturer")
            query = " ".join(query_parts)

            search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
            logger.info(f"    [Google] '{brand_name}'")

            original_window = self.driver.current_window_handle
            self.driver.execute_script("window.open('');")
            self.driver.switch_to.window(self.driver.window_handles[-1])
            self.driver.get(search_url)
            time.sleep(random.uniform(2, 3.5))

            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            lines = page_text.split('\n')
            brand_l = (brand_name or '').lower()
            generic_l = (generic_name or '').lower()

            # ── MRP ──────────────────────────────────────────────────────────
            price_patterns = [
                r'MRP[\s:]*₹?\s*([\d,]+(?:\.\d{1,2})?)',
                r'₹\s*([\d,]+(?:\.\d{1,2})?)',
                r'Rs\.?\s*([\d,]+(?:\.\d{1,2})?)',
                r'price[\s:]*(?:Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)',
                r'INR\s*([\d,]+(?:\.\d{1,2})?)',
            ]
            for line in lines:
                ll = line.lower()
                near = brand_l in ll or generic_l in ll
                for pat in price_patterns:
                    for match in re.findall(pat, line, re.IGNORECASE):
                        try:
                            price = float(str(match).replace(',', ''))
                            if 2 <= price <= 100000:
                                if near:
                                    result['mrp'] = price
                                    break
                                elif not result['mrp']:
                                    result['mrp'] = price
                        except ValueError:
                            pass
                    if result['mrp'] and near:
                        break
                if result['mrp'] and near:
                    break

            # ── Dosage form ───────────────────────────────────────────────────
            if not existing_form:
                # Try structured pattern first
                fm = re.search(
                    r'(?:dosage\s*form|drug\s*form|type|formulation)\s*[:\-]?\s*([a-zA-Z\s]{3,25})',
                    page_text, re.IGNORECASE
                )
                if fm:
                    candidate = fm.group(1).strip().lower()
                    result['dosage_form'] = (
                        FORM_LABEL_SYNONYMS.get(candidate)
                        or self._detect_form(fm.group(1))
                        or self._detect_form(page_text[:3000])
                    )
                else:
                    result['dosage_form'] = self._detect_form(page_text[:3000])
                if result['dosage_form']:
                    logger.info(f"    [Google Form] {result['dosage_form']}")

            # ── Strength ──────────────────────────────────────────────────────
            if not existing_strength:
                for pat in [
                    r'(\d+\.?\d*\s*(?:mg|mcg|ml|gm|g|%\s*w/[vw]|%\s*v/v|%|IU|units?))\b',
                ]:
                    sm = re.search(pat, page_text, re.IGNORECASE)
                    if sm:
                        result['strength'] = sm.group(1).strip()
                        logger.info(f"    [Google Strength] {result['strength']}")
                        break

            # ── Manufacturer ──────────────────────────────────────────────────
            if not existing_manufacturer:
                mfr_pat = re.search(
                    r'(?:manufactured\s*by|manufacturer|marketed\s*by|mfg\s*by)\s*[:\-]?\s*([A-Za-z][^\n]{5,80})',
                    page_text, re.IGNORECASE
                )
                if mfr_pat:
                    candidate = mfr_pat.group(1).strip()
                    cl = candidate.lower()
                    if any(x in cl for x in ['ltd', 'pvt', 'pharma', 'laborator',
                                              'healthcare', 'biotech', 'medical',
                                              'life', 'sciences', 'india', 'inc']):
                        result['manufacturer'] = candidate[:150]
                        logger.info(f"    [Google Mfr] {result['manufacturer']}")

            # ── Generic / composition ─────────────────────────────────────────
            if not generic_name or generic_name == brand_name:
                comp_pat = re.search(
                    r'(?:composition|contains|active\s*ingredient|salt|generic)\s*[:\-]?\s*([A-Za-z][^\n]{5,200})',
                    page_text, re.IGNORECASE
                )
                if comp_pat:
                    comp_text = comp_pat.group(1).strip()
                    if len(comp_text) < 200:
                        result['composition'] = comp_text
                        extracted = self._generic_from_composition(comp_text)
                        if extracted:
                            result['generic'] = extracted
                            logger.info(f"    [Google Generic] {result['generic']}")

            self.driver.close()
            self.driver.switch_to.window(original_window)
            return result

        except Exception as e:
            logger.debug(f"Google fetch error: {e}")
            try:
                if len(self.driver.window_handles) > 1:
                    self.driver.close()
                    self.driver.switch_to.window(self.driver.window_handles[0])
            except Exception:
                pass
            return result

    # ── Browser ────────────────────────────────────────────────────────────────
    def setup_driver(self):
        try:
            options = Options()
            options.add_argument('--start-maximized')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--log-level=3')
            options.add_argument('--disable-extensions')
            options.add_argument(
                'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
            options.add_experimental_option('useAutomationExtension', False)

            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
            self.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            self.driver.execute_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
            )
            self.driver.set_page_load_timeout(60)
            self.wait = WebDriverWait(self.driver, 25)
            self.driver.get("https://medwiki.co.in")
            time.sleep(3)
            logger.info(f"Browser ready | medwiki title: {self.driver.title[:50]}")
            return True
        except Exception as e:
            logger.error(f"Browser setup failed: {e}")
            return False

    def _get(self, url, retries=3):
        for attempt in range(retries):
            try:
                self.driver.get(url)
                time.sleep(random.uniform(2, 3.5))
                self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                if "medwiki" not in self.driver.current_url.lower() and attempt < retries - 1:
                    time.sleep(3)
                    continue
                return True
            except TimeoutException:
                logger.debug(f"Timeout attempt {attempt+1}: {url}")
                if attempt < retries - 1:
                    time.sleep(random.uniform(5, 10))
            except Exception as e:
                logger.debug(f"Get error attempt {attempt+1}: {e}")
                if attempt < retries - 1:
                    time.sleep(3)
        return False

    def _scroll(self, times=8):
        last = self.driver.execute_script("return document.body.scrollHeight")
        no_change = 0
        for _ in range(times):
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(0.8)
            new = self.driver.execute_script("return document.body.scrollHeight")
            if new == last:
                no_change += 1
                if no_change >= 2:
                    break
            else:
                no_change = 0
            last = new

    # ── Data Extraction ────────────────────────────────────────────────────────
    def _clean(self, text):
        if not text:
            return ""
        return re.sub(r'\s+', ' ', str(text)).strip()

    def _extract_schedule(self, text):
        for pat, name in [
            (r'Schedule\s*H1', 'Schedule H1'),
            (r'Schedule\s*H\b', 'Schedule H'),
            (r'Schedule\s*X',   'Schedule X'),
            (r'Schedule\s*G',   'Schedule G'),
        ]:
            if re.search(pat, text, re.IGNORECASE):
                return name
        return ""

    def _categorize(self, name, composition, uses):
        combined = f"{name} {composition} {uses}".lower()
        cats = {
            'Antibiotic':            r'(cillin|mycin|floxacin|cef|azithro|doxy|metro|antibiotic)',
            'Antihypertensive':      r'(pril|sartan|olol|dipine|thiazide|hypertension)',
            'Antidiabetic':          r'(metformin|glipizide|glimepiride|insulin|diabetes)',
            'Analgesic/Antipyretic': r'(paracetamol|ibuprofen|diclofenac|aspirin|pain|fever)',
            'Gastrointestinal':      r'(prazole|tidine|antacid|ulcer|gastric|domperidone)',
            'Antiallergic':          r'(cetirizine|fexofenadine|loratadine|antihistamine)',
            'Cardiovascular':        r'(statin|cardiac|heart|angina|cholesterol)',
            'Respiratory':           r'(inhaler|asthma|broncho|respiratory|cough|salbutamol)',
            'Dermatological':        r'(cream|ointment|gel|lotion|soap|skin|derma|topical)',
            'Ophthalmic':            r'(eye\s*drop|ophthalmic|ocular)',
            'ENT':                   r'(ear\s*drop|nasal|otic|rhinitis|sinusitis)',
            'Vitamin/Supplement':    r'(vitamin|mineral|supplement|calcium|iron|zinc)',
            'Antiepileptic':         r'(epilepsy|seizure|valproate|gabapentin|phenytoin)',
            'Antiviral':             r'(antiviral|oseltamivir|acyclovir)',
            'Antifungal':            r'(antifungal|azole|terbinafine|fluconazole)',
            'Thyroid':               r'(thyroid|levothyroxine|thyroxine)',
            'Neurological':          r'(ssri|snri|antidepressant|sertraline|escitalopram)',
        }
        for cat, pat in cats.items():
            if re.search(pat, combined, re.IGNORECASE):
                return cat
        return "General Medicine"

    def extract_brand_data(self, brand_url, mol_generic=""):
        data = {
            'name': '', 'generic': mol_generic, 'composition': '',
            'manufacturer': '', 'price': '', 'form': '', 'strength': '',
            'pack_size': '', 'prescription_required': 'Yes', 'schedule': '',
            'category': '', 'uses': '', 'side_effects': '', 'dosage': '',
            'how_to_use': '', 'contraindications': '', 'warnings': '',
            'storage': '', 'url': brand_url
        }
        try:
            if not self._get(brand_url):
                return None
            self._scroll(8)

            title = self.driver.title
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            lines = [ln.strip() for ln in page_text.split('\n') if ln.strip()]

            # ── Pass 0: URL slug is most reliable — has full name+strength+form ─
            # e.g. "florac-250mg-injection" → name, form, strength all in one
            url_slug = brand_url.rstrip('/').split('/')[-1].replace('-', ' ')
            data['name'] = url_slug.title()                    # "Florac 250Mg Injection"
            data['form'] = self._detect_form(url_slug)         # "Injection"
            # Extract strength from URL slug: "750mg", "0.5%", "10ml" etc.
            sm = re.search(r'(\d+\.?\d*\s*(?:mg|mcg|ml|gm|g|%|iu|units?))\b', url_slug, re.IGNORECASE)
            if sm:
                data['strength'] = sm.group(1)

            # ── Pass 1: page title can refine name if longer / more specific ──
            if title:
                title_name = title.split('-')[0].split('|')[0].strip()
                if title_name and len(title_name) > len(data['name']):
                    data['name'] = title_name
                if not data['form']:
                    data['form'] = self._detect_form(title_name)

            # ── Parse the page line by line ──────────────────────────────────
            for i, line in enumerate(lines):
                ll  = line.lower()
                nxt = lines[i+1] if i+1 < len(lines) else ""

                # Name fallback (first meaningful line)
                if not data['name'] and i < 5 and 3 < len(line) < 120:
                    if not any(x in ll for x in ['medwiki', 'search', 'login', 'home']):
                        data['name'] = line
                        if not data['form']:
                            data['form'] = self._detect_form(line)

                # ── Explicit "Type:" / "Dosage Form:" / "Drug Form:" label ──
                # Medwiki often shows: "Type\nTablet" or "Dosage Form\nInjection"
                # Only use page label if URL slug detection gave nothing
                if not data['form'] and any(x == ll.strip() for x in
                        ['type', 'dosage form', 'drug form', 'formulation',
                         'form', 'product type', 'drug type']):
                    candidate = nxt.strip().lower()
                    if candidate in FORM_LABEL_SYNONYMS:
                        data['form'] = FORM_LABEL_SYNONYMS[candidate]
                    elif candidate:
                        detected = self._detect_form(nxt)
                        if detected:
                            data['form'] = detected

                # ── "X is a tablet/injection/cream..." sentence detection ────
                if not data['form'] and data['name']:
                    name_lower = data['name'].lower()
                    # Pattern: "Dolo 650 is a Tablet" / "Betadine is an Antiseptic Cream"
                    m = re.search(
                        r'(?:' + re.escape(name_lower[:15]) + r'.{0,30}?\s+is\s+(?:a|an)\s+)([\w\s]{3,30})',
                        ll, re.IGNORECASE
                    )
                    if m:
                        detected = self._detect_form(m.group(1))
                        if detected:
                            data['form'] = detected

                # Composition / generic
                if any(x in ll for x in ['composition', 'salt', 'active ingredient', 'contains']) and not data['composition']:
                    if 3 < len(nxt) < 500:
                        data['composition'] = nxt
                        if not data['generic']:
                            data['generic'] = self._generic_from_composition(nxt)

                # Manufacturer — validate: must look like a company name
                if any(x in ll for x in ['manufacturer', 'marketed by', 'mfg', 'manufactured by', 'company']) and not data['manufacturer']:
                    nxt_l = nxt.lower()
                    bad = any(x in nxt_l for x in [
                        'variation', 'available', 'select', 'view', 'click',
                        'add to cart', 'buy', 'price', 'search', 'login',
                    ])
                    looks_like_company = any(x in nxt_l for x in [
                        'ltd', 'limited', 'pvt', 'private', 'inc', 'corp',
                        'pharma', 'laborator', 'healthcare', 'biotech',
                        'medical', 'life', 'care', 'india', 'sciences',
                    ])
                    if not bad and looks_like_company and 3 < len(nxt) < 200:
                        data['manufacturer'] = nxt

                # Price
                if '₹' in line and not data['price']:
                    data['price'] = self._clean(line)

                # Strength — only from dedicated "Strength:" label or composition context
                if 'strength' in ll and not data['strength'] and len(nxt) < 100:
                    data['strength'] = nxt
                # Inline strength: only from short lines that look like label values
                # (e.g. "500 mg", "0.5% w/v") — skip pack/dosage/uses lines
                if not data['strength'] and len(line) < 40:
                    pack_ctx = any(x in ll for x in ['bottle', 'strip', 'tube', 'pack', 'vial', 'ampoule', 'sachet'])
                    if not pack_ctx:
                        m = re.search(r'(\d+\.?\d*\s*(?:mg|mcg|gm|g|%\s*w/[vw]|%\s*v/v|%|IU|units?))\b', line, re.IGNORECASE)
                        if m:
                            data['strength'] = m.group(1)

                # Pack size — "Packaging :", "Pack Size :", "Pack of X"
                pack_label_hit = any(x in ll for x in [
                    'packaging', 'pack size', 'pack of', 'bottle of',
                    'packing', 'pack:', 'package'
                ])
                if pack_label_hit and not data['pack_size'] and len(nxt) < 150:
                    data['pack_size'] = nxt
                    # "bottle of 5 ml Eye Drop" → also extract form if missing
                    if not data['form']:
                        data['form'] = self._detect_form(nxt)
                if not data['pack_size']:
                    m = re.search(
                        r'(\d+)\s*(tablet|capsule|ml|gm|g|strip|bottle|vial|tube|sachet|patch)s?',
                        line, re.IGNORECASE
                    )
                    if m and len(line) < 120:
                        data['pack_size'] = m.group(0)
                        if not data['form']:
                            data['form'] = self._detect_form(line)

                # Prescription / OTC
                if 'otc' in ll or 'over the counter' in ll:
                    data['prescription_required'] = 'No'

                # Schedule
                if not data['schedule']:
                    data['schedule'] = self._extract_schedule(line)

                # Uses
                if any(x in ll for x in ['uses', 'used for', 'indication', 'treats']) and not data['uses']:
                    txt = ""
                    for off in range(1, 4):
                        nx = lines[i+off] if i+off < len(lines) else ""
                        if nx and 15 < len(nx) < 300:
                            if any(s in nx.lower() for s in ['side effect', 'dosage', 'how to']):
                                break
                            txt += nx + ". "
                    if txt:
                        data['uses'] = self._clean(txt[:1000])

                # Side effects
                if 'side effect' in ll and not data['side_effects']:
                    txt = ""
                    for off in range(1, 4):
                        nx = lines[i+off] if i+off < len(lines) else ""
                        if nx and 15 < len(nx) < 300:
                            if any(s in nx.lower() for s in ['dosage', 'how to', 'uses']):
                                break
                            txt += nx + ", "
                    if txt:
                        data['side_effects'] = self._clean(txt[:800])

                # Dosage
                if any(x in ll for x in ['dosage', 'dose']) and not data['dosage']:
                    if len(nxt) > 10:
                        data['dosage'] = self._clean(nxt[:300])

                # How to use / instructions
                if any(x in ll for x in ['how to use', 'how to take', 'direction', 'instruction']) and not data['how_to_use']:
                    if len(nxt) > 10:
                        data['how_to_use'] = self._clean(nxt[:300])

                # Storage
                if ('storage' in ll or 'store at' in ll) and not data['storage']:
                    if len(nxt) > 10:
                        data['storage'] = self._clean(nxt[:200])

            # ── Post-loop: try form from page text if still missing ──────────
            if not data['form']:
                # Structured label scan: "Type: Tablet" or "Dosage Form\nInjection"
                m = re.search(
                    r'(?:type|dosage\s*form|drug\s*form|formulation)\s*[:\-]?\s*([a-zA-Z\s]{3,30})',
                    page_text, re.IGNORECASE
                )
                if m:
                    candidate = m.group(1).strip().lower()
                    if candidate in FORM_LABEL_SYNONYMS:
                        data['form'] = FORM_LABEL_SYNONYMS[candidate]
                    else:
                        data['form'] = self._detect_form(m.group(1))
            # Full-page text scan only as last resort — risks false positives
            # but is better than no form at all
            if not data['form']:
                data['form'] = self._detect_form(page_text[:2000])  # limit to first 2000 chars

            # ── Strength fallback from composition ───────────────────────────
            if not data['strength'] and data['composition']:
                data['strength'] = self._strength_from_composition(data['composition'])

            # ── Google fallback: any important field missing → search ────────
            need_google = (
                not data['price']
                or not data['form']
                or not data['strength']
                or not data['manufacturer']
                or not data['generic']
            )
            if need_google:
                google_data = self.fetch_from_google(
                    data['name'], data['generic'],
                    existing_form=data['form'],
                    existing_strength=data['strength'],
                    existing_manufacturer=data['manufacturer']
                )
                if google_data['mrp'] and not data['price']:
                    data['price'] = f"₹{google_data['mrp']}"
                if google_data['dosage_form'] and not data['form']:
                    data['form'] = google_data['dosage_form']
                if google_data['strength'] and not data['strength']:
                    data['strength'] = google_data['strength']
                if google_data['manufacturer'] and not data['manufacturer']:
                    data['manufacturer'] = google_data['manufacturer']
                if google_data['generic'] and not data['generic']:
                    data['generic'] = google_data['generic']
                if google_data['composition'] and not data['composition']:
                    data['composition'] = google_data['composition']

            # ── Generic fallback from composition ────────────────────────────
            if not data['generic'] and data['composition']:
                data['generic'] = self._generic_from_composition(data['composition'])

            data['category'] = self._categorize(data['name'], data['composition'], data['uses'])

            for k in data:
                if isinstance(data[k], str):
                    data[k] = self._clean(data[k])

            return data

        except Exception as e:
            logger.error(f"Extract error {brand_url}: {e}")
            self.stats['errors'] += 1
            return None

    # ── A-Z Molecule Scraping ──────────────────────────────────────────────────
    def get_all_search_terms(self):
        terms = list(string.ascii_lowercase)
        prefixes = [
            'ab','ac','ad','al','am','an','ar','as','at','az',
            'be','bi','bu','ca','ce','ch','ci','cl','co','cy',
            'da','de','di','do','dr','du','ef','el','em','en','er','es',
            'fa','fe','fi','fl','fo','fu','ga','ge','gi','gl','go','gr',
            'ha','he','hi','ho','hu','hy','ib','im','in','ir','is','iv',
            'ke','la','le','li','lo','lu','ma','me','mi','mo','mu',
            'na','ne','ni','no','nu','ob','ol','om','on','op','or','os','ox',
            'pa','pe','ph','pi','pl','po','pr','pu','ra','re','ri','ro','ru',
            'sa','se','si','so','sp','st','su','sy','ta','te','th','ti','to',
            'tr','tu','ul','un','ur','va','ve','vi','vo','wa','xa','za','zi','zo',
            'cef','cip','dol','ome','pan','rab','ese','met','gli','amo',
            'azi','lev','mox','ofl','nor','cla','dox','tet','van','lin',
            'atv','ros','ato','sim','tel','los','ram','ena','amp','bis',
            'sal','bud','mon','flu','ibu','par','dic','asp','tra','tap',
        ]
        return list(dict.fromkeys(terms + prefixes))

    def get_mol_urls_from_page(self, url):
        mol_urls = set()
        try:
            if not self._get(url):
                return mol_urls
            self._scroll()
            for link in self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/molecule/']"):
                href = link.get_attribute('href')
                if href and '/molecule/' in href:
                    mol_urls.add(href.split('?')[0])
        except Exception as e:
            logger.debug(f"Mol page error {url}: {e}")
        return mol_urls

    def get_brand_urls_from_mol(self, mol_url):
        brand_urls = set()
        try:
            if not self._get(mol_url):
                return brand_urls
            self._scroll()
            for link in self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/brand/']"):
                href = link.get_attribute('href')
                if href and '/brand/' in href:
                    brand_urls.add(href.split('?')[0])
        except Exception as e:
            logger.debug(f"Brand URL error {mol_url}: {e}")
        return brand_urls

    def get_brand_urls_from_brands_page(self, term):
        brand_urls = set()
        try:
            for param in ['search', 'alphabet']:
                url = f"https://medwiki.co.in/brands/en?{param}={term}"
                if not self._get(url):
                    continue
                self._scroll()
                for link in self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/brand/']"):
                    href = link.get_attribute('href')
                    if href and '/brand/' in href:
                        brand_urls.add(href.split('?')[0])
                time.sleep(random.uniform(0.5, 1))
        except Exception as e:
            logger.debug(f"Brands page error for term '{term}': {e}")
        return brand_urls

    def get_molecule_info_from_page(self, mol_url):
        try:
            if not self._get(mol_url):
                return ""
            title = self.driver.title
            if title:
                return title.split('-')[0].split('|')[0].strip()
            for h in self.driver.find_elements(By.CSS_SELECTOR, "h1, h2"):
                text = h.text.strip()
                if text and len(text) < 100:
                    return text
        except Exception as e:
            logger.debug(f"Molecule info error {mol_url}: {e}")
        return ""

    # ── Main scrape loop ───────────────────────────────────────────────────────
    def run(self):
        # Prevent two instances from running simultaneously (monthly cron safety)
        lock_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scraper.lock')
        if os.path.exists(lock_file):
            logger.warning(f"Lock file found: {lock_file}. Another run may be in progress. Exiting.")
            logger.warning("If this is stale, delete the lock file manually and re-run.")
            return
        try:
            with open(lock_file, 'w') as lf:
                lf.write(str(os.getpid()))
        except Exception as e:
            logger.warning(f"Could not create lock file: {e}")

        logger.info("=" * 80)
        logger.info("MEDWIKI SCRAPER - ALL FORMS (tablet/drop/lotion/soap/...)")
        logger.info("DB: medicines  |  Flow: A-Z search → molecules + brands → DB")
        logger.info("=" * 80)

        if not self.connect_db():
            if os.path.exists(lock_file):
                os.remove(lock_file)
            return
        if not self.setup_driver():
            if os.path.exists(lock_file):
                os.remove(lock_file)
            return

        search_terms = self.get_all_search_terms()
        logger.info(f"Total search terms: {len(search_terms)}\n")

        cp = load_checkpoint()
        resume_index = cp.get('term_index', 0)
        if cp.get('seen_mol_urls'):
            self.seen_mol_urls.update(cp['seen_mol_urls'])
            logger.info(f"Restored {len(self.seen_mol_urls)} seen molecule URLs from checkpoint")
        if resume_index > 0:
            logger.info(f"Skipping first {resume_index} already-done terms\n")

        try:
            for tidx, term in enumerate(search_terms, 1):
                if tidx <= resume_index:
                    continue
                logger.info(f"[{tidx}/{len(search_terms)}] Searching: '{term}'")

                # ── Molecules page ────────────────────────────────────────────
                term_mol_urls = set()
                for param in ['search', 'alphabet']:
                    url = f"https://medwiki.co.in/molecules/en?{param}={term}"
                    term_mol_urls.update(self.get_mol_urls_from_page(url))

                new_mols = term_mol_urls - self.seen_mol_urls
                self.seen_mol_urls.update(new_mols)
                logger.info(f"  Molecules: {len(new_mols)} new | {len(term_mol_urls)-len(new_mols)} already seen")

                for mol_url in new_mols:
                    mol_name = mol_url.rstrip('/').split('/')[-1].replace('-', ' ').title()
                    brand_urls = self.get_brand_urls_from_mol(mol_url)
                    self.stats['molecules'] += 1
                    logger.info(f"  Molecule: {mol_name} → {len(brand_urls)} brands")

                    for brand_url in brand_urls:
                        url_key = brand_url.rstrip('/')
                        if url_key in self.seen_brand_urls:
                            self.stats['skipped_dup'] += 1
                            continue
                        self.seen_brand_urls.add(url_key)
                        self.stats['brands_found'] += 1

                        brand_name_log = url_key.split('/')[-1].replace('-', ' ').title()
                        logger.info(f"    [Brand] {brand_name_log}")

                        data = self.extract_brand_data(brand_url, mol_generic=mol_name)
                        if not data or not data.get('name'):
                            logger.warning("      [SKIP] No data extracted")
                            continue

                        self.insert_medicine(data)
                        time.sleep(random.uniform(0.8, 1.8))

                # ── Brands page ───────────────────────────────────────────────
                brand_page_urls = self.get_brand_urls_from_brands_page(term)
                new_brands = brand_page_urls - self.seen_brand_urls
                logger.info(f"  Brands page: {len(new_brands)} new | {len(brand_page_urls)-len(new_brands)} already seen")

                for brand_url in new_brands:
                    url_key = brand_url.rstrip('/')
                    if url_key in self.seen_brand_urls:
                        self.stats['skipped_dup'] += 1
                        continue
                    self.seen_brand_urls.add(url_key)
                    self.stats['brands_found'] += 1

                    generic_name = url_key.split('/')[-1].replace('-', ' ').title()
                    brand_name_log = generic_name
                    logger.info(f"    [Brand/Page] {brand_name_log}")

                    data = self.extract_brand_data(brand_url, mol_generic=generic_name)
                    if not data or not data.get('name'):
                        logger.warning("      [SKIP] No data extracted")
                        continue

                    self.insert_medicine(data)
                    time.sleep(random.uniform(0.8, 1.8))

                logger.info(
                    f"  --- Stats: inserted={self.stats['inserted']} | "
                    f"skipped={self.stats['skipped_dup']} | "
                    f"errors={self.stats['errors']} ---\n"
                )
                save_checkpoint(term, tidx, self.seen_mol_urls)
                time.sleep(random.uniform(0.5, 1))

        except KeyboardInterrupt:
            logger.warning("\nStopped by user — data already saved to DB")

        else:
            if os.path.exists(CHECKPOINT_FILE):
                os.remove(CHECKPOINT_FILE)
                logger.info("Checkpoint cleared (all terms completed)")

        finally:
            if self.driver:
                self.driver.quit()
            if self.cursor:
                self.cursor.close()
            if self.db:
                self.db.close()
            # Release lock
            if os.path.exists(lock_file):
                os.remove(lock_file)

            logger.info("\n" + "=" * 80)
            logger.info("SCRAPING COMPLETE")
            logger.info("=" * 80)
            logger.info(f"  Molecules processed : {self.stats['molecules']}")
            logger.info(f"  Brand pages visited : {self.stats['brands_found']}")
            logger.info(f"  Inserted to DB      : {self.stats['inserted']}")
            logger.info(f"  Duplicates skipped  : {self.stats['skipped_dup']}")
            logger.info(f"  Errors              : {self.stats['errors']}")
            logger.info(f"  DB: medicines table in '{DB_CONFIG['database']}'")
            logger.info("=" * 80)

    # ── Update mode: fix NULL records ─────────────────────────────────────────
    def run_update_mode(self, batch_size=50):
        logger.info("=" * 80)
        logger.info("UPDATE MODE — Fix NULL MRP / dosage_form / strength via Google")
        logger.info("=" * 80)

        if not self.connect_db():
            return
        if not self.setup_driver():
            return

        stats = {'updated': 0, 'not_found': 0, 'errors': 0}

        try:
            while True:
                self.cursor.execute("""
                    SELECT id, name, generic_name, brand, manufacturer,
                           dosage_form, strength, mrp
                    FROM medicines
                    WHERE mrp IS NULL OR mrp = 0
                       OR dosage_form IS NULL OR dosage_form = ''
                       OR strength IS NULL OR strength = ''
                    ORDER BY id
                    LIMIT %s
                """, (batch_size,))
                medicines = self.cursor.fetchall()
                if not medicines:
                    logger.info("No more medicines with missing data!")
                    break

                logger.info(f"\nProcessing batch of {len(medicines)} ...")

                for (med_id, name, generic_name, brand, manufacturer,
                     existing_form, existing_strength, existing_mrp) in medicines:

                    logger.info(f"\n  ID {med_id}: {name}")

                    # Try to infer form from name first (avoids Google call)
                    inferred_form = self._detect_form(name or '') if not existing_form else existing_form

                    google_data = self.fetch_from_google(
                        name or brand or '',
                        generic_name or '',
                        existing_form=inferred_form,
                        existing_strength=existing_strength or '',
                        existing_manufacturer=manufacturer or ''
                    )

                    updates, values = [], []
                    if google_data['mrp'] and not existing_mrp:
                        updates.append("mrp = %s"); values.append(google_data['mrp'])
                    resolved_form = inferred_form or google_data['dosage_form']
                    if resolved_form and not existing_form:
                        updates.append("dosage_form = %s"); values.append(resolved_form)
                        route = self._infer_route_from_form(resolved_form)
                        updates.append("default_route = %s"); values.append(route)
                        if not existing_strength:
                            def_dose = DEFAULT_DOSAGE_MAP.get(resolved_form, '1 tablet')
                            updates.append("default_dosage = %s"); values.append(def_dose)
                            def_freq = DEFAULT_FREQ_MAP.get(resolved_form, '1-0-1')
                            updates.append("default_frequency = %s"); values.append(def_freq)
                    if google_data['strength'] and not existing_strength:
                        updates.append("strength = %s"); values.append(google_data['strength'])

                    if updates:
                        values.append(med_id)
                        sql = f"UPDATE medicines SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s"
                        try:
                            self.cursor.execute(sql, values)
                            self.db.commit()
                            stats['updated'] += 1
                            logger.info(f"  [UPDATED] {', '.join(updates)}")
                        except Exception as e:
                            logger.error(f"  [ERROR] {e}")
                            stats['errors'] += 1
                    else:
                        stats['not_found'] += 1
                        logger.info("  [NOT FOUND] No data")

                    time.sleep(random.uniform(2, 4))

                logger.info(
                    f"\n--- Batch: updated={stats['updated']} "
                    f"not_found={stats['not_found']} errors={stats['errors']} ---"
                )

        except KeyboardInterrupt:
            logger.warning("\nStopped by user")
        finally:
            if self.driver:
                self.driver.quit()
            if self.cursor:
                self.cursor.close()
            if self.db:
                self.db.close()

            logger.info("\n" + "=" * 80)
            logger.info("UPDATE MODE COMPLETE")
            logger.info(f"  Updated    : {stats['updated']}")
            logger.info(f"  Not Found  : {stats['not_found']}")
            logger.info(f"  Errors     : {stats['errors']}")
            logger.info("=" * 80)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Medwiki Medicine Scraper')
    parser.add_argument(
        '--mode', choices=['scrape', 'update'], default='scrape',
        help='scrape: full A-Z scrape (default), update: fix NULL fields via Google'
    )
    parser.add_argument('--batch-size', type=int, default=50, help='Update mode batch size')
    args = parser.parse_args()

    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    start = time.time()

    scraper = MedwikiScraper()
    if args.mode == 'update':
        scraper.run_update_mode(batch_size=args.batch_size)
    else:
        scraper.run()

    elapsed = time.time() - start
    print(f"\nTotal time: {int(elapsed//3600)}h {int((elapsed%3600)//60)}m")
