#!/usr/bin/env python3
"""
AetherMed MedWiki Continuous Sync Engine (v2.0)
===============================================
Continuously scrapes molecules & branded formulations from medwiki.co.in and
streams normalized medicine batches directly into the AetherMed Next.js + Prisma
SaaS platform via `POST /api/medicines/sync` (with `X-Medwiki-Key` auth).

Supported Scraping Engines:
  1. `lightpanda` (Recommended): Connects via CDP (`ws://127.0.0.1:9222`) to
     https://github.com/lightpanda-io/browser — ~11x faster & ~9x lower RAM than Chrome!
  2. `playwright`: Local headless Chromium via Playwright.
  3. `http`: Ultra-lightweight `requests` + HTML parser for static/SSR brand pages.

Usage:
  # 1. Start Lightpanda CDP server:
  #    ./lightpanda serve --host 127.0.0.1 --port 9222
  # 2. Run continuous delta sync into your Next.js HMS SaaS:
  MEDWIKI_SYNC_API_KEY="mwk_live_..." python3 medwiki/medwiki_sync.py --engine lightpanda --batch-size 25
"""

import argparse
import json
import logging
import os
import random
import re
import string
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional, Set
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("medwiki_sync")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINT_PATH = os.path.join(BASE_DIR, "scraper_checkpoint.json")
LOCK_PATH = os.path.join(BASE_DIR, "scraper.lock")

API_URL = os.environ.get("HMS_SYNC_API_URL", "http://127.0.0.1:3000/api/medicines/sync")
API_KEY = os.environ.get("MEDWIKI_SYNC_API_KEY", "mwk_live_aethermed_sync_key_2026")
LIGHTPANDA_CDP_URL = os.environ.get("LIGHTPANDA_CDP_URL", "ws://127.0.0.1:9222")

FORM_PATTERNS = [
    ("Eye Drop", r"\beye\s*drops?\b|\bophthalmic\s*drops?\b"),
    ("Ear Drop", r"\bear\s*drops?\b|\botic\s*drops?\b"),
    ("Nasal Spray", r"\bnasal\s*spray\b"),
    ("Inhaler", r"\binhaler\b|\brespules?\b|\brotacaps?\b"),
    ("Infusion", r"\binfusion\b|\biv\s*fluid\b|\biv\s*drip\b"),
    ("Injection", r"\binjection\b|\binj\b|\bvial\b|\bampoule\b"),
    ("Suspension", r"\bsuspension\b|\bdry\s*syrup\b"),
    ("Syrup", r"\bsyrup\b|\boral\s*solution\b|\belixir\b|\blinctus\b"),
    ("Capsule", r"\bcapsule\b|\bsoftgel\b"),
    ("Tablet", r"\btablet\b|\bdispersible\b|\bchewable\b"),
    ("Ointment", r"\bointment\b"),
    ("Cream", r"\bcream\b"),
    ("Gel", r"\bgel\b"),
    ("Lotion", r"\blotion\b"),
    ("Powder", r"\bpowder\b|\bsachet\b"),
    ("Drops", r"\bdrops?\b"),
]


def detect_form(text: str) -> str:
    for form_name, pat in FORM_PATTERNS:
        if re.search(pat, text or "", re.IGNORECASE):
            return form_name
    return "Tablet"


def parse_brand_html_or_text(url: str, title: str, text: str, mol_generic: str = "") -> Optional[Dict]:
    slug = url.rstrip("/").split("/")[-1].replace("-", " ").strip()
    name = (title.split("-")[0].split("|")[0].strip() if title else "") or slug.title()
    if not name or len(name) < 2:
        return None

    dosage_form = detect_form(f"{slug} {name}")
    strength_match = re.search(
        r"(\d+\.?\d*\s*(?:mg|mcg|ml|gm|g|%\s*w/[vw]|%|iu|units?))\b",
        f"{slug} {text[:800]}",
        re.IGNORECASE,
    )
    strength = strength_match.group(1).strip() if strength_match else ""

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    composition = ""
    manufacturer = ""
    price = None
    pack_size = ""
    uses = ""
    side_effects = ""
    schedule = "Schedule H"

    for idx, ln in enumerate(lines):
        ll = ln.lower()
        nxt = lines[idx + 1] if idx + 1 < len(lines) else ""

        if not composition and any(k in ll for k in ["composition", "salt", "active ingredient", "contains"]):
            if 3 < len(nxt) < 350:
                composition = nxt

        if not manufacturer and any(k in ll for k in ["manufacturer", "marketed by", "manufactured by"]):
            if any(c in nxt.lower() for c in ["ltd", "pvt", "pharma", "laborator", "healthcare", "india", "inc"]):
                manufacturer = nxt[:180]

        if price is None and ("₹" in ln or "mrp" in ll):
            m = re.search(r"₹\s*([\d,]+(?:\.\d{1,2})?)", ln)
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                except ValueError:
                    pass

        if not pack_size and any(k in ll for k in ["pack size", "packaging", "strip of", "bottle of", "vial of"]):
            pack_size = (nxt if len(ln) < 18 else ln)[:100]

        if "otc" in ll or "over the counter" in ll:
            schedule = "OTC"
        elif "schedule h1" in ll:
            schedule = "Schedule H1"
        elif "schedule x" in ll:
            schedule = "Schedule X"

        if not uses and any(k in ll for k in ["uses of", "used for", "indications"]):
            uses = " ".join(lines[idx + 1 : idx + 3])[:400]

        if not side_effects and "side effect" in ll:
            side_effects = " ".join(lines[idx + 1 : idx + 3])[:300]

    return {
        "name": name,
        "genericName": mol_generic or None,
        "composition": composition or mol_generic or None,
        "manufacturer": manufacturer or None,
        "dosageForm": dosage_form,
        "strength": strength or None,
        "packSize": pack_size or None,
        "mrp": price,
        "schedule": schedule,
        "uses": uses or None,
        "sideEffects": side_effects or None,
        "source": "medwiki",
        "sourceUrl": url,
    }


class PageFetcher:
    """Unified fetcher supporting Lightpanda CDP, Playwright Chromium, or HTTP."""

    def __init__(self, engine: str = "lightpanda"):
        self.engine = engine
        self.pw = None
        self.browser = None
        self.page = None
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                )
            }
        )

    def start(self):
        if self.engine in ("lightpanda", "playwright"):
            try:
                from playwright.sync_api import sync_playwright

                self.pw = sync_playwright().start()
                if self.engine == "lightpanda":
                    logger.info(f"Connecting to Lightpanda CDP at {LIGHTPANDA_CDP_URL} ...")
                    self.browser = self.pw.chromium.connect_over_cdp(LIGHTPANDA_CDP_URL)
                else:
                    logger.info("Launching headless Playwright Chromium ...")
                    self.browser = self.pw.chromium.launch(headless=True)
                ctx = self.browser.contexts[0] if self.browser.contexts else self.browser.new_context()
                self.page = ctx.new_page()
                return
            except Exception as exc:
                logger.warning(f"{self.engine} unavailable ({exc}); falling back to fast HTTP mode.")
                self.engine = "http"

    def fetch(self, url: str):
        if self.page:
            self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            title = self.page.title()
            body_text = self.page.inner_text("body")
            hrefs = self.page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
            return title, body_text, hrefs

        resp = self.session.get(url, timeout=20)
        resp.raise_for_status()
        html = resp.text
        title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = re.sub(r"\s+", " ", title_m.group(1)).strip() if title_m else ""
        hrefs = [
            h if h.startswith("http") else f"https://medwiki.co.in{h}"
            for h in re.findall(r'href=["\']([^"\']+)["\']', html)
        ]
        clean_text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", html, flags=re.I)
        clean_text = re.sub(r"<[^>]+>", "\n", clean_text)
        return title, clean_text, hrefs

    def close(self):
        try:
            if self.browser:
                self.browser.close()
            if self.pw:
                self.pw.stop()
        except Exception:
            pass


def push_batch_to_hms(items: List[Dict], engine: str, term: str) -> Dict:
    if not items:
        return {}
    resp = requests.post(
        API_URL,
        headers={
            "Content-Type": "application/json",
            "X-Medwiki-Key": API_KEY,
        },
        json={
            "triggerSource": f"medwiki_{engine}",
            "mode": "continuous_delta",
            "queryOrTerm": term,
            "medicines": items,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def load_checkpoint() -> Dict:
    if os.path.exists(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_checkpoint(term_index: int, seen_urls: Set[str]):
    with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "updatedAt": datetime.utcnow().isoformat(),
                "termIndex": term_index,
                "seenUrls": list(seen_urls)[-25000:],
            },
            f,
        )


def run_sync(engine: str, batch_size: int, max_terms: int):
    if os.path.exists(LOCK_PATH):
        logger.warning(f"Lock file exists at {LOCK_PATH}. Exiting to avoid concurrent runs.")
        return

    with open(LOCK_PATH, "w") as lf:
        lf.write(str(os.getpid()))

    fetcher = PageFetcher(engine=engine)
    cp = load_checkpoint()
    start_idx = int(cp.get("termIndex", 0))
    seen_urls: Set[str] = set(cp.get("seenUrls", []))
    terms = list(string.ascii_lowercase)

    try:
        fetcher.start()
        processed_terms = 0
        for idx, term in enumerate(terms):
            if idx < start_idx:
                continue
            if max_terms and processed_terms >= max_terms:
                break

            processed_terms += 1
            logger.info(f"[{idx + 1}/{len(terms)}] Discovering brands for '{term}' via {fetcher.engine} ...")
            _, _, hrefs = fetcher.fetch(f"https://medwiki.co.in/brands/en?alphabet={term}")
            brand_urls = sorted({h.split("?")[0].rstrip("/") for h in hrefs if "/brand/" in h})

            batch: List[Dict] = []
            for b_url in brand_urls:
                if b_url in seen_urls:
                    continue
                seen_urls.add(b_url)
                try:
                    b_title, b_text, _ = fetcher.fetch(b_url)
                    parsed = parse_brand_html_or_text(b_url, b_title, b_text)
                    if parsed:
                        batch.append(parsed)
                    if len(batch) >= batch_size:
                        res = push_batch_to_hms(batch, fetcher.engine, term)
                        logger.info(f"  -> Synced batch ({len(batch)} items): {res}")
                        batch = []
                    time.sleep(random.uniform(0.25, 0.6))
                except Exception as exc:
                    logger.debug(f"Brand scrape skipped ({b_url}): {exc}")

            if batch:
                res = push_batch_to_hms(batch, fetcher.engine, term)
                logger.info(f"  -> Synced final batch ({len(batch)} items): {res}")

            save_checkpoint(idx + 1, seen_urls)

    finally:
        fetcher.close()
        if os.path.exists(LOCK_PATH):
            os.remove(LOCK_PATH)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AetherMed Continuous MedWiki Sync Worker")
    parser.add_argument("--engine", choices=["lightpanda", "playwright", "http"], default="lightpanda")
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--max-terms", type=int, default=0, help="0 = full A-Z")
    args = parser.parse_args()
    run_sync(args.engine, args.batch_size, args.max_terms)
