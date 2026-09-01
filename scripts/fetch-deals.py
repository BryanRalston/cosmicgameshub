#!/usr/bin/env python3
"""Fetch live Amazon offer prices via PA-API 5.0 GetItems. Stdlib only.

No keys → write a no-credentials placeholder and exit 0.
No live offer → skip that ASIN. We do not invent prices.
Amazon Associates tag on every URL: cosmicgameshu-20
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "deals-catalog.json"
OUT_PATH = ROOT / "data" / "deals.json"

HOST = "webservices.amazon.com"
ENDPOINT = "https://webservices.amazon.com/paapi5/getitems"
CANONICAL_URI = "/paapi5/getitems"
REGION = "us-east-1"
SERVICE = "ProductAdvertisingAPI"
AMZ_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems"
CONTENT_TYPE = "application/json; charset=utf-8"
CONTENT_ENCODING = "amz-1.0"
DISPLAY_TAG = "cosmicgameshu-20"
BATCH_SIZE = 10
BATCH_SLEEP_S = 1.1
RESOURCES = [
    "Images.Primary.Large",
    "ItemInfo.Title",
    "Offers.Listings.Price",
    "Offers.Listings.SavingBasis",
    "Offers.Listings.Availability.Message",
]
CATEGORIES = {"mice", "keyboards", "headsets", "monitors", "chairs", "other"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now(dt: datetime | None = None) -> str:
    stamp = (dt or utc_now()).replace(microsecond=0)
    return stamp.isoformat().replace("+00:00", "Z")


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def no_credentials_payload() -> dict:
    return {
        "updatedAt": None,
        "source": "none",
        "status": "no-credentials",
        "items": [],
        "note": "PA-API keys not set. We do not invent prices.",
    }


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date_stamp: str) -> bytes:
    k_date = _hmac(("AWS4" + secret).encode("utf-8"), date_stamp)
    k_region = _hmac(k_date, REGION)
    k_service = _hmac(k_region, SERVICE)
    return _hmac(k_service, "aws4_request")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sign_headers(access_key: str, secret_key: str, payload: bytes, amz_date: str, date_stamp: str) -> dict:
    signed_headers = "content-encoding;host;x-amz-date;x-amz-target"
    canonical_headers = (
        f"content-encoding:{CONTENT_ENCODING}\n"
        f"host:{HOST}\n"
        f"x-amz-date:{amz_date}\n"
        f"x-amz-target:{AMZ_TARGET}\n"
    )
    canonical_request = "\n".join(
        [
            "POST",
            CANONICAL_URI,
            "",
            canonical_headers,
            signed_headers,
            sha256_hex(payload),
        ]
    )
    credential_scope = f"{date_stamp}/{REGION}/{SERVICE}/aws4_request"
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            sha256_hex(canonical_request.encode("utf-8")),
        ]
    )
    signature = hmac.new(
        signing_key(secret_key, date_stamp),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    authorization = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    return {
        "Authorization": authorization,
        "Content-Encoding": CONTENT_ENCODING,
        "Content-Type": CONTENT_TYPE,
        "Host": HOST,
        "X-Amz-Date": amz_date,
        "X-Amz-Target": AMZ_TARGET,
        "User-Agent": "CosmicGamesHub/1.0 (deals-feed; stdlib)",
    }


def load_catalog() -> list[dict]:
    raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    rows = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(rows, list):
        raise SystemExit("deals-catalog.json must be a list or {items: [...]}")
    seen: set[str] = set()
    catalog: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        asin = str(row.get("asin") or "").strip().upper()
        if len(asin) != 10 or asin in seen:
            continue
        seen.add(asin)
        category = str(row.get("category") or "other").strip().lower()
        if category not in CATEGORIES:
            category = "other"
        item = {
            "asin": asin,
            "name": str(row.get("name") or asin).strip(),
            "category": category,
            "image": row.get("image") or None,
            "guide": row.get("guide") or None,
        }
        typical = row.get("typicalStreet")
        if isinstance(typical, bool) or typical is None:
            pass
        elif isinstance(typical, (int, float)):
            item["typicalStreet"] = int(typical) if float(typical).is_integer() else float(typical)
        catalog.append(item)
    return catalog


def chunks(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def paapi_get_items(asins: list[str], access_key: str, secret_key: str, partner_tag: str) -> dict:
    body = {
        "ItemIds": asins,
        "Resources": RESOURCES,
        "PartnerTag": partner_tag,
        "PartnerType": "Associates",
        "Marketplace": "www.amazon.com",
        "Operation": "GetItems",
    }
    payload = json.dumps(body, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    now = utc_now()
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    headers = sign_headers(access_key, secret_key, payload, amz_date, date_stamp)
    req = urllib.request.Request(ENDPOINT, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"PA-API HTTP {exc.code}: {err_body[:800]}") from exc


def nested(data: dict, *keys):
    cur = data
    for key in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def first_listing(item: dict) -> dict | None:
    offers = item.get("Offers") or {}
    listings = offers.get("Listings") or []
    if not listings or not isinstance(listings, list):
        return None
    listing = listings[0]
    return listing if isinstance(listing, dict) else None


def as_float(value) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def amazon_url(asin: str) -> str:
    return f"https://www.amazon.com/dp/{asin}?tag={DISPLAY_TAG}"


def live_item(catalog_row: dict, pa_item: dict) -> dict | None:
    listing = first_listing(pa_item)
    if not listing:
        return None
    price = as_float(nested(listing, "Price", "Amount"))
    if price is None:
        return None
    currency = nested(listing, "Price", "Currency") or "USD"
    availability = nested(listing, "Availability", "Message")
    image = catalog_row.get("image") or nested(pa_item, "Images", "Primary", "Large", "URL")
    out = {
        "asin": catalog_row["asin"],
        "name": catalog_row["name"],
        "category": catalog_row["category"],
        "image": image or None,
        "guide": catalog_row.get("guide") or None,
        "url": amazon_url(catalog_row["asin"]),
        "price": round(price, 2),
        "currency": currency,
        "belowTypical": False,
    }
    typical = catalog_row.get("typicalStreet")
    if isinstance(typical, (int, float)):
        out["typicalStreet"] = typical
        out["belowTypical"] = price <= float(typical) - 5
    basis = as_float(nested(listing, "SavingBasis", "Amount"))
    if basis is not None and basis > 0 and price < basis:
        out["savingPct"] = int(round((basis - price) / basis * 100))
    if availability:
        out["availability"] = str(availability)
    return out


def fetch_live(catalog: list[dict], access_key: str, secret_key: str, partner_tag: str) -> list[dict]:
    by_asin = {row["asin"]: row for row in catalog}
    asins = [row["asin"] for row in catalog]
    live: list[dict] = []
    batches = chunks(asins, BATCH_SIZE)
    last_error = None
    for i, batch in enumerate(batches):
        if i:
            time.sleep(BATCH_SLEEP_S)
        try:
            data = paapi_get_items(batch, access_key, secret_key, partner_tag)
        except Exception as exc:
            last_error = exc
            print(f"batch {i + 1}/{len(batches)} failed: {exc}", file=sys.stderr)
            continue
        errors = data.get("Errors") or []
        for err in errors:
            code = (err or {}).get("Code", "")
            msg = (err or {}).get("Message", "")
            print(f"PA-API error: {code} {msg}", file=sys.stderr)
        items = nested(data, "ItemsResult", "Items") or []
        if not isinstance(items, list):
            continue
        for pa_item in items:
            if not isinstance(pa_item, dict):
                continue
            asin = str(pa_item.get("ASIN") or "").strip().upper()
            row = by_asin.get(asin)
            if not row:
                continue
            parsed = live_item(row, pa_item)
            if parsed:
                live.append(parsed)
    if not live and last_error and len(batches) > 0:
        raise last_error
    return live


def main() -> int:
    access_key = (os.environ.get("PAAPI_ACCESS_KEY") or "").strip()
    secret_key = (os.environ.get("PAAPI_SECRET_KEY") or "").strip()
    partner_tag = (os.environ.get("PAAPI_PARTNER_TAG") or DISPLAY_TAG).strip() or DISPLAY_TAG

    if not access_key or not secret_key:
        print("PA-API keys not set. Skipping live fetch. We do not invent prices.")
        write_json(OUT_PATH, no_credentials_payload())
        return 0

    catalog = load_catalog()
    if not catalog:
        write_json(
            OUT_PATH,
            {
                "updatedAt": iso_now(),
                "source": "paapi5",
                "status": "ok",
                "items": [],
                "note": "Catalog has no ASINs.",
            },
        )
        return 0

    try:
        items = fetch_live(catalog, access_key, secret_key, partner_tag)
    except Exception as exc:
        print(f"PA-API fetch failed; leaving previous deals.json untouched. {exc}", file=sys.stderr)
        return 1

    write_json(
        OUT_PATH,
        {
            "updatedAt": iso_now(),
            "source": "paapi5",
            "status": "ok",
            "items": items,
            "note": None if items else "PA-API returned no live offers. We do not invent prices.",
        },
    )
    print(f"Wrote {len(items)} live offer(s) to {OUT_PATH.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
