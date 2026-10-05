from __future__ import annotations

import csv
import json
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup

BIST_TLREF_URL = "https://www.borsaistanbul.com/en/indices/tlref"
TCMB_EVDS_URL = "https://evds3.tcmb.gov.tr/"
TCMB_PKA_URL = "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB%2BTR/Main%2BMenu/Istatistikler/Egilim%2BAnketleri/Piyasa%2BKatilimcilari%2BAnketi"
CACHE_TTL_SECONDS = 900
_DATA_DIR = Path(__file__).resolve().parent / "data"
TLREF_HISTORY_PATH = _DATA_DIR / "TLREFORANI_D_official.csv"
LEGACY_SNAPSHOT_PATH = _DATA_DIR / "tlref_snapshot.json"
MACRO_SNAPSHOT_PATH = _DATA_DIR / "tcmb_macro_snapshot.json"

_TLREF_CACHE: dict[str, Any] = {"ts": 0.0, "payload": None}
_MACRO_CACHE: dict[str, Any] = {"ts": 0.0, "payload": None}
_DATE_FORMATS = ("%m.%d.%Y", "%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d")
_MONTHS_TR = {
    "OCAK": 1, "ŞUBAT": 2, "SUBAT": 2, "MART": 3, "NİSAN": 4, "NISAN": 4,
    "MAYIS": 5, "HAZİRAN": 6, "HAZIRAN": 6, "TEMMUZ": 7, "AĞUSTOS": 8, "AGUSTOS": 8,
    "EYLÜL": 9, "EYLUL": 9, "EKİM": 10, "EKIM": 10, "KASIM": 11, "ARALIK": 12,
}


def _parse_date(value: str):
    value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_rate(value: str):
    cleaned = value.strip().replace("%", "").replace(" ", "")
    if not cleaned:
        return None
    if "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        rate_pct = float(cleaned)
    except ValueError:
        return None
    if not (0.0 <= rate_pct <= 500.0):
        return None
    return rate_pct / 100.0


def _parse_number(value: str):
    cleaned = value.strip().replace(" ", "").replace(",", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_bist_tlref_html(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for tr in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        dt = _parse_date(cells[0])
        rate = _parse_rate(cells[1])
        if dt is not None and rate is not None:
            rows.append({"date": dt.isoformat(), "rate": rate, "source": "bist_live"})

    if not rows:
        txt = soup.get_text("\n", strip=True)
        pattern = re.compile(r"(?P<date>\d{2}[./]\d{2}[./]\d{4})\s+(?P<rate>\d{1,3}[.,]\d{4})")
        for m in pattern.finditer(txt):
            dt = _parse_date(m.group("date"))
            rate = _parse_rate(m.group("rate"))
            if dt is not None and rate is not None:
                rows.append({"date": dt.isoformat(), "rate": rate, "source": "bist_live"})

    dedup = {r["date"]: r for r in rows}
    return [dedup[k] for k in sorted(dedup)]


def load_bundled_tlref_history() -> list[dict]:
    rows: list[dict] = []
    if TLREF_HISTORY_PATH.exists():
        with TLREF_HISTORY_PATH.open("r", encoding="utf-16", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for raw in reader:
                dt = _parse_date(str(raw.get("TARIH/DATE", "")))
                code = str(raw.get("KOD/CODE", "")).strip().upper()
                rate = _parse_rate(str(raw.get("DEGER/VALUE", "")))
                if dt is None or code != "TLREF" or rate is None:
                    continue
                rows.append(
                    {
                        "date": dt.isoformat(),
                        "rate": rate,
                        "repo_vwap": _parse_rate(str(raw.get("REPO AOF /VWAP REPO RATE", ""))),
                        "traded_volume": _parse_number(str(raw.get("ISLEM HACMI/TRADED VOLUME", ""))),
                        "eligible_volume": _parse_number(str(raw.get("HESAPLAMAYA DAHIL ISLEM HACMİ /ELIGIBLE TRANSACTIONS TRADED VOLUME", ""))),
                        "source": "official_csv",
                    }
                )
    elif LEGACY_SNAPSHOT_PATH.exists():
        data = json.loads(LEGACY_SNAPSHOT_PATH.read_text(encoding="utf-8"))
        for raw in data.get("history", []):
            if raw.get("date") and raw.get("rate") is not None:
                rows.append({"date": raw["date"], "rate": float(raw["rate"]), "source": "legacy_snapshot"})
    dedup = {r["date"]: r for r in rows}
    return [dedup[k] for k in sorted(dedup)]


def _merge_history(base: list[dict], live: list[dict]) -> list[dict]:
    merged = {r["date"]: dict(r) for r in base}
    for r in live:
        prior = merged.get(r["date"], {})
        merged[r["date"]] = {**prior, **r}
    return [merged[k] for k in sorted(merged)]


def _realized_tlref_return(history: list[dict], lookback_days: int = 365) -> float | None:
    if len(history) < 2:
        return None
    dated = [(date.fromisoformat(r["date"]), float(r["rate"])) for r in history]
    end = dated[-1][0]
    start = end - timedelta(days=lookback_days)
    relevant = [(d, r) for d, r in dated if d >= start - timedelta(days=7)]
    if len(relevant) < 2:
        return None
    acc = 1.0
    for i, (d, rate) in enumerate(relevant):
        period_start = max(d, start)
        next_d = relevant[i + 1][0] if i + 1 < len(relevant) else end + timedelta(days=1)
        period_end = min(next_d, end + timedelta(days=1))
        days = max((period_end - period_start).days, 0)
        if days:
            acc *= (1.0 + rate / 365.0) ** days
    return acc - 1.0


def _tlref_stats(history: list[dict]) -> dict:
    if not history:
        return {}
    rates = [float(r["rate"]) for r in history]
    return {
        "count": len(history),
        "start_date": history[0]["date"],
        "end_date": history[-1]["date"],
        "latest_rate": rates[-1],
        "mean_21d": sum(rates[-21:]) / min(len(rates), 21),
        "mean_63d": sum(rates[-63:]) / min(len(rates), 63),
        "min_1y": min(rates[-252:]) if rates else None,
        "max_1y": max(rates[-252:]) if rates else None,
        "realized_return_1y": _realized_tlref_return(history, 365),
    }


def fetch_tlref_market_data(force: bool = False) -> dict:
    now = time.time()
    if not force and _TLREF_CACHE["payload"] is not None and now - float(_TLREF_CACHE["ts"]) < CACHE_TTL_SECONDS:
        return _TLREF_CACHE["payload"]

    bundled = load_bundled_tlref_history()
    live: list[dict] = []
    live_error = None
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; MKFinTECHLabGEN/1.6; +https://www.borsaistanbul.com/)",
            "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
        }
        with httpx.Client(timeout=15.0, follow_redirects=True, headers=headers) as client:
            response = client.get(BIST_TLREF_URL)
            response.raise_for_status()
        live = parse_bist_tlref_html(response.text)
        if not live:
            raise ValueError("No TLREF rows parsed from official Borsa Istanbul page")
    except Exception as exc:
        live_error = str(exc)

    history = _merge_history(bundled, live)
    latest = history[-1] if history else None
    payload = {
        "status": "live_merged" if live else "official_csv_fallback",
        "source": "Borsa Istanbul TLREF + bundled official historical CSV" if live else "Borsa Istanbul official historical CSV",
        "source_url": BIST_TLREF_URL,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "latest": latest,
        "history": history,
        "stats": _tlref_stats(history),
        "is_live": bool(live),
        "warning": live_error,
    }
    _TLREF_CACHE["ts"] = now
    _TLREF_CACHE["payload"] = payload
    return payload


def parse_tcmb_12m_inflation_html(html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    text = " ".join(soup.stripped_strings)
    key = "Piyasa Katılımcılarının 12 Ay Sonrası Yıllık TÜFE Beklentisi (%)"
    idx = text.find(key)
    if idx < 0:
        key = "Piyasa Katilimcilarinin 12 Ay Sonrasi Yillik TUFE Beklentisi (%)"
        idx = text.find(key)
    if idx < 0:
        return None
    tail = text[idx + len(key): idx + len(key) + 180]
    m = re.search(r"(\d{1,3}[,.]\d{1,2})", tail)
    if not m:
        return None
    rate = _parse_rate(m.group(1))
    if rate is None:
        return None
    period = None
    pm = re.search(r"(OCAK|ŞUBAT|SUBAT|MART|NİSAN|NISAN|MAYIS|HAZİRAN|HAZIRAN|TEMMUZ|AĞUSTOS|AGUSTOS|EYLÜL|EYLUL|EKİM|EKIM|KASIM|ARALIK)\s+(20\d{2})", tail.upper())
    if pm:
        month_name, year = pm.groups()
        month = _MONTHS_TR.get(month_name)
        if month:
            period = f"{int(year):04d}-{month:02d}"
    return {"value": rate, "period": period}


def _macro_snapshot() -> dict:
    return json.loads(MACRO_SNAPSHOT_PATH.read_text(encoding="utf-8"))


def build_policy_proxy_nodes(snapshot: dict, latest_tlref: float | None) -> tuple[float, float, list[dict]]:
    """Convert TCMB PKA policy expectations into transparent TLREF-equivalent survey proxies."""
    current_policy_rate = float(snapshot.get("current_policy_rate", 0.0))
    basis = (float(latest_tlref) - current_policy_rate) if latest_tlref is not None and current_policy_rate else 0.0
    nodes: list[dict] = []
    for raw_node in snapshot.get("policy_rate_anchors", []):
        policy_rate = float(raw_node.get("policy_rate", raw_node.get("rate")))
        proxy_rate = policy_rate + basis
        nodes.append(
            {
                **raw_node,
                "policy_rate": policy_rate,
                "rate": proxy_rate,
                "tlref_proxy_rate": proxy_rate,
                "policy_to_tlref_basis": basis,
                "proxy_method": "TCMB PKA policy-rate expectation + current observed (TLREF - policy rate) basis",
                "source_type": "tcmb_pka",
                "source": f"{snapshot.get('source')} · TLREF-equivalent survey proxy",
            }
        )
    return current_policy_rate, basis, nodes


def fetch_macro_market_data(force: bool = False) -> dict:
    now = time.time()
    if not force and _MACRO_CACHE["payload"] is not None and now - float(_MACRO_CACHE["ts"]) < CACHE_TTL_SECONDS:
        return _MACRO_CACHE["payload"]

    snap = _macro_snapshot()
    inflation_value = float(snap["inflation_12m"])
    inflation_period = snap.get("survey_period")
    is_live = False
    warning = None
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; MKFinTECHLabGEN/1.6; +https://www.tcmb.gov.tr/)",
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
        }
        with httpx.Client(timeout=15.0, follow_redirects=True, headers=headers) as client:
            response = client.get(TCMB_EVDS_URL)
            response.raise_for_status()
        parsed = parse_tcmb_12m_inflation_html(response.text)
        if parsed:
            inflation_value = float(parsed["value"])
            inflation_period = parsed.get("period") or inflation_period
            is_live = True
        else:
            warning = "TCMB EVDS page loaded but the 12M CPI expectation could not be parsed; using official survey snapshot."
    except Exception as exc:
        warning = f"TCMB EVDS live fetch unavailable; using official survey snapshot: {exc}"

    # Convert policy-rate survey expectations into TLREF-equivalent proxies using
    # the observed TLREF-policy basis. This avoids treating the policy rate itself
    # as a forward TLREF fixing.
    tlref_payload = fetch_tlref_market_data(force=force)
    latest_tlref = float((tlref_payload.get("latest") or {}).get("rate", 0.0)) if tlref_payload.get("latest") else None
    current_policy_rate, policy_to_tlref_basis, policy_nodes = build_policy_proxy_nodes(snap, latest_tlref)

    payload = {
        "status": "live_inflation_plus_survey_snapshot" if is_live else "survey_snapshot",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "inflation_12m": {
            "value": inflation_value,
            "period": inflation_period,
            "source": "TCMB EVDS - Piyasa Katilimcilarinin 12 Ay Sonrasi Yillik TUFE Beklentisi",
            "source_url": TCMB_EVDS_URL,
            "is_live": is_live,
        },
        "inflation_24m": float(snap.get("inflation_24m", 0.0)),
        "current_policy_rate": {
            "value": current_policy_rate,
            "as_of": snap.get("current_policy_rate_as_of"),
            "source": snap.get("current_policy_rate_source"),
            "source_url": snap.get("current_policy_rate_source_url"),
        },
        "tlref_policy_basis": {
            "value": policy_to_tlref_basis,
            "tlref": latest_tlref,
            "policy_rate": current_policy_rate,
            "method": "current observed TLREF minus current TCMB policy rate",
        },
        "policy_path": {
            "survey_period": snap.get("survey_period"),
            "survey_date": snap.get("survey_date"),
            "source": snap.get("source"),
            "source_url": snap.get("source_url", TCMB_PKA_URL),
            "nodes": policy_nodes,
        },
        "warning": warning,
    }
    _MACRO_CACHE["ts"] = now
    _MACRO_CACHE["payload"] = payload
    return payload
