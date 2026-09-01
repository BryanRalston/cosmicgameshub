# Daily Amazon deals feed (parked)

`/deals` is built to show **live Amazon offer prices**. It stays empty until Amazon Associates is **fully accepted** and **Creators API** (the 2026 replacement for PA-API) is allowed. We do not invent a sale.

Affiliate tag on every URL: `cosmicgameshu-20`. Links on guides still work without the API.

## Why keys are blocked

Creators API requires:

1. An Associates account that has been **reviewed and finally accepted** (not just a tracking ID).
2. Qualifying sales. In 2026 this is commonly **~10 qualifying sales in the last 30 days**.

If Associates Central shows “Have an Approved Associates Account ❌”, skip the API. Drive real clicks from guides. After sales land, request final acceptance via Associates Contact Us if needed. Then Tools → Creators API.

## After Amazon unlocks it

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `PAAPI_ACCESS_KEY` | Creators API / PA-API access key |
| `PAAPI_SECRET_KEY` | Secret |
| `PAAPI_PARTNER_TAG` | `cosmicgameshu-20` |

Then run the **Deals feed** workflow (or wait for 14:00 UTC cron). Until those secrets exist, the Action no-ops and `/deals` stays empty.

## What is already in the repo

- Catalog: `data/deals-catalog.json` (ASINs only; search URLs ignored)
- Fetcher: `scripts/fetch-deals.py`
- Schedule: `.github/workflows/deals.yml`

Local check without keys (must exit 0):

```
python scripts/fetch-deals.py
```
