# Daily Amazon deals feed

`/deals` shows **live Amazon offer prices** from Product Advertising API 5.0, pulled once a day. If we cannot fetch a live price, we show nothing. We do not invent a sale.

Affiliate tag on every URL: `cosmicgameshu-20`.

## GitHub secrets Bryan must paste

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `PAAPI_ACCESS_KEY` | Access key from Amazon Associates → Product Advertising API |
| `PAAPI_SECRET_KEY` | Secret key from the same screen |
| `PAAPI_PARTNER_TAG` | `cosmicgameshu-20` |

Create the keys at [Amazon Associates](https://affiliate-program.amazon.com/) → Product Advertising API (PA-API). The store must be Amazon.com. The partner tag must match `cosmicgameshu-20`.

Until those three secrets exist, `.github/workflows/deals.yml` no-ops: it prints a skip message, writes `data/deals.json` as `status: no-credentials`, does **not** commit fake prices, and `/deals` stays empty. That is correct.

## What runs

- Catalog: `data/deals-catalog.json` (ASINs from `product-links.json` `/dp/` links + `tools/find-my-gear.html`; search URLs ignored).
- Fetcher: `scripts/fetch-deals.py` (Python 3.12, stdlib, AWS SigV4, 10 ASINs per GetItems call, 1.1s between batches).
- Output: `data/deals.json` — live `price` only. ASINs with no offer are skipped.
- Schedule: `0 14 * * *` (14:00 UTC) plus `workflow_dispatch`.

Local check without keys (must exit 0):

```
python scripts/fetch-deals.py
```
