#!/usr/bin/env python3
"""Render static /pros cards and /pros/{id} pages from data/pros.json.

Run from the repo root:  python3 scripts/render-pros.py
Regenerate whenever the pro database changes so crawlers keep seeing HTML.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROS_PATH = ROOT / "data" / "pros.json"
LINKS_PATH = ROOT / "data" / "product-links.json"
INDEX_PATH = ROOT / "pros" / "index.html"
SITEMAP_PATH = ROOT / "sitemap.xml"

GAME_LABEL = {
    "valorant": "Valorant",
    "cs2": "CS2",
    "apex": "Apex",
    "fortnite": "Fortnite",
}

CARDS_START = "<!-- PROS_CARDS_START -->"
CARDS_END = "<!-- PROS_CARDS_END -->"
SITEMAP_START = "<!-- PROS_PAGES_START -->"
SITEMAP_END = "<!-- PROS_PAGES_END -->"


def esc(value) -> str:
    if value is None:
        return ""
    return html.escape(str(value), quote=True)


def flag_for(iso: str | None) -> str:
    if not iso or len(iso) != 2:
        return "🌐"
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso.upper())


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_product(name: str | None, links: dict) -> dict | None:
    if not name or not links:
        return None
    direct = links.get(name)
    if direct:
        return direct
    lower = name.lower()
    best_key = None
    for key in links:
        if key.startswith("_"):
            continue
        lk = key.lower()
        if lower.startswith(lk) and (best_key is None or len(lk) > len(best_key)):
            best_key = key
    return links.get(best_key) if best_key else None


def search_blob(p: dict) -> str:
    parts = [
        p.get("name"),
        p.get("team"),
        p.get("realName"),
        p.get("mouse"),
        p.get("keyboard"),
        p.get("headset"),
        p.get("monitor"),
        p.get("mousepad"),
        p.get("role"),
        GAME_LABEL.get(p.get("game"), p.get("game")),
    ]
    return " ".join(str(v) for v in parts if v).lower()


def card_html(p: dict) -> str:
    game = p.get("game") or ""
    game_label = GAME_LABEL.get(game, game)
    badge = f'<span class="ph-game-badge ph-game-{esc(game)}">{esc(game_label)}</span>'
    team = p.get("team")
    team_line = f"{esc(team)}{badge}" if team else badge
    edpi = p.get("edpi")
    dpi = p.get("dpi")
    refresh = p.get("refreshHz")

    def row(label: str, value):
        shown = esc(value) if value else "—"
        cls = "ph-gear-val" + ("" if value else " null")
        return (
            f'<div class="ph-gear-row"><div class="ph-gear-lbl">{label}</div>'
            f'<span class="{cls}">{shown}</span></div>'
        )

    href = f"/pros/{esc(p['id'])}"
    return f"""        <a class="ph-card" href="{href}" data-id="{esc(p['id'])}" data-game="{esc(game)}" data-search="{esc(search_blob(p))}">
          <div class="ph-card-head">
            <div class="ph-flag" aria-hidden="true">{flag_for(p.get("country"))}</div>
            <div class="ph-card-name">
              <div class="ph-name">{esc(p.get("name"))}</div>
              <div class="ph-team">{team_line}</div>
            </div>
            <div class="ph-edpi">
              <div class="ph-edpi-val">{esc(edpi) if edpi is not None else "—"}</div>
              <div class="ph-edpi-lbl">eDPI</div>
            </div>
          </div>
          <div class="ph-gear">
            {row("Mouse", p.get("mouse"))}
            {row("Headset", p.get("headset"))}
            {row("Monitor", p.get("monitor"))}
          </div>
          <div class="ph-card-foot">
            <span class="ph-stat"><strong>{esc(dpi) if dpi is not None else "—"}</strong> dpi</span>
            <span class="ph-stat-sep">·</span>
            <span class="ph-stat"><strong>{esc(refresh) if refresh is not None else "—"}</strong>Hz</span>
            <span class="ph-stat-sep">·</span>
            <span class="ph-stat">{esc(p.get("resolution")) or "—"}</span>
            <span class="ph-verified">v {esc(p.get("lastVerified") or "")}</span>
          </div>
        </a>"""


def product_val(name, links: dict, as_product: bool) -> str:
    if not name:
        return '<span class="ph-detail-val" style="color:var(--text-lo,#666);">—</span>'
    if not as_product:
        return f'<span class="ph-detail-val">{esc(name)}</span>'
    resolved = resolve_product(name, links)
    if not resolved:
        return f'<span class="ph-detail-val">{esc(name)}</span>'
    amazon = resolved.get("amazon")
    if amazon:
        return (
            f'<a class="ph-detail-val ph-gear-link" href="{esc(amazon)}" '
            f'rel="nofollow sponsored" target="_blank">{esc(name)}</a>'
        )
    internal = resolved.get("internal")
    if internal:
        return f'<a class="ph-detail-val ph-gear-link" href="{esc(internal)}">{esc(name)}</a>'
    return f'<span class="ph-detail-val">{esc(name)}</span>'


def extra_links(name, links: dict) -> str:
    resolved = resolve_product(name, links) if name else None
    if not resolved:
        return ""
    bits = []
    internal = resolved.get("internal")
    amazon = resolved.get("amazon")
    if internal:
        bits.append(f'<a class="pp-extra" href="{esc(internal)}">Read our page →</a>')
    if amazon:
        bits.append(
            f'<a class="pp-extra" href="{esc(amazon)}" rel="nofollow sponsored" target="_blank">Amazon →</a>'
        )
    if not bits:
        return ""
    return '<div class="pp-extra-row">' + " ".join(bits) + "</div>"


def detail_page(p: dict, links: dict, n_pros: int) -> str:
    game = p.get("game") or ""
    game_label = GAME_LABEL.get(game, game)
    name = p.get("name") or p["id"]
    real = p.get("realName")
    team = p.get("team")
    role = p.get("role")
    sub_bits = [f"{flag_for(p.get('country'))}"]
    if real:
        sub_bits.append(esc(real))
    if team:
        sub_bits.append(esc(team))
    sub_bits.append(
        f'<span class="ph-game-badge ph-game-{esc(game)}">{esc(game_label)}</span>'
    )
    if role:
        sub_bits.append(esc(role))
    sub = " · ".join(sub_bits)

    def row(label, value, as_product=False):
        return (
            f'<div class="ph-detail-row"><div class="ph-detail-key">{label}</div>'
            f"{product_val(value, links, as_product)}</div>"
        )

    title = f"{esc(name)} Settings 2026 — Mouse, Keyboard, Sens | CosmicGamesHub"
    desc = (
        f"{name} {game_label} setup: {p.get('mouse') or 'mouse'}, "
        f"{p.get('keyboard') or 'keyboard'}, {p.get('headset') or 'headset'}, "
        f"{p.get('monitor') or 'monitor'}. DPI {p.get('dpi')}, "
        f"sens {p.get('sensitivity')}, eDPI {p.get('edpi')}. "
        f"Last verified {p.get('lastVerified') or '2026'}."
    )
    verified = p.get("lastVerified") or ""
    extra = extra_links(p.get("mouse"), links)
    page_url = f"https://cosmicgameshub.com/pros/{p['id']}"
    json_ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": f"{name} Settings 2026",
                    "description": desc,
                    "dateModified": "2026-08-30",
                    "author": {
                        "@type": "Organization",
                        "name": "CosmicGamesHub",
                        "url": "https://cosmicgameshub.com",
                    },
                    "mainEntityOfPage": page_url,
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Home",
                            "item": "https://cosmicgameshub.com/",
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Pro Gear & Settings",
                            "item": "https://cosmicgameshub.com/pros",
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": name,
                            "item": page_url,
                        },
                    ],
                },
            ],
        },
        ensure_ascii=False,
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{esc(desc)}">
  <meta property="og:title" content="{esc(name)} Pro Settings — {esc(game_label)} 2026">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://cosmicgameshub.com/pros/{esc(p['id'])}">
  <link rel="canonical" href="https://cosmicgameshub.com/pros/{esc(p['id'])}">
  <script type="application/ld+json">{json_ld}</script>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/styles.css">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-D272MF8NQP"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-D272MF8NQP');</script>
  <style>
    .ph-hero {{ text-align: center; padding: 2.5rem 1rem 1rem; }}
    .ph-eyebrow {{ display: inline-block; font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent, #00d4ff); margin-bottom: .55rem; }}
    .ph-h1 {{ font-size: clamp(2rem, 5vw, 3rem); margin: 0 0 .4rem; color: #fff; font-family: 'Outfit', sans-serif; font-weight: 900; letter-spacing: -0.04em; line-height: 1.05; }}
    .ph-sub {{ color: var(--text-mid, #a8a8c0); font-size: .95rem; }}
    .ph-wrap {{ max-width: 640px; margin: 0 auto; padding: 0 1rem 4rem; }}
    .ph-game-badge {{ display: inline-block; font-size: .62rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: .12rem .4rem; border-radius: 4px; }}
    .ph-game-valorant {{ background: rgba(255,70,85,0.12); color: #ff4655; }}
    .ph-game-cs2 {{ background: rgba(255,179,0,0.12); color: #ffb300; }}
    .ph-game-apex {{ background: rgba(255,46,99,0.12); color: #ff2e63; }}
    .ph-game-fortnite {{ background: rgba(155,93,229,0.12); color: #9b5de5; }}
    .ph-modal-stats {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; margin: 1.25rem 0; }}
    .ph-modal-stat {{ text-align: center; padding: .75rem .5rem; background: rgba(0,212,255,0.04); border: 1px solid rgba(0,212,255,0.15); border-radius: 10px; }}
    .ph-modal-stat-val {{ font-size: 1.4rem; font-weight: 800; color: var(--accent, #00d4ff); font-variant-numeric: tabular-nums; line-height: 1; }}
    .ph-modal-stat-lbl {{ font-size: .6rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-lo, #888); margin-top: .3rem; }}
    .ph-section-lbl {{ font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent, #00d4ff); margin: 1.25rem 0 .5rem; }}
    .ph-detail-row {{ display: flex; justify-content: space-between; gap: 1rem; padding: .55rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: .92rem; }}
    .ph-detail-key {{ color: var(--text-lo, #888); }}
    .ph-detail-val {{ color: #fff; font-weight: 700; text-align: right; }}
    a.ph-gear-link {{ color: #fff; text-decoration: none; border-bottom: 1px dotted rgba(0,212,255,0.35); }}
    a.ph-gear-link:hover {{ color: var(--accent, #00d4ff); }}
    .pp-extra-row {{ display: flex; gap: .85rem; justify-content: center; flex-wrap: wrap; margin: 1.1rem 0 .25rem; }}
    .pp-extra {{ font-size: .82rem; color: var(--accent, #00d4ff); text-decoration: none; font-weight: 700; }}
    .pp-extra:hover {{ text-decoration: underline; }}
    .pp-back {{ display: inline-block; margin-top: 1.5rem; font-size: .88rem; color: var(--accent, #00d4ff); text-decoration: none; font-weight: 700; }}
    .pp-verified {{ margin-top: 1.25rem; font-size: .72rem; color: var(--text-lo, #666); text-align: center; }}
  </style>
</head>
<body>
  <nav class="nav" role="navigation" aria-label="Main navigation">
    <div class="container">
      <div class="nav__inner">
        <a href="/" class="nav__logo" aria-label="CosmicGamesHub home">
          <span class="nav__logo-icon">🎮</span>
          <span class="nav__logo-text">Cosmic<span>Games</span>Hub</span>
        </a>
        <ul class="nav__links">
          <li><a href="/pros" class="active">Pros</a></li>
          <li><a href="/guides">Guides</a></li>
          <li><a href="/games/daily">Daily</a></li>
          <li><a href="/versus">Comparisons</a></li>
          <li><a href="/games">Games</a></li>
          <li><a href="/tools/gaming-fps-calculator" class="nav__cta btn">Free Tools</a></li>
        </ul>
        <button class="nav__hamburger" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </nav>

  <main>
    <nav class="breadcrumb" aria-label="Breadcrumb" style="max-width:640px;margin:1rem auto;padding:0 1rem;">
      <ol><li><a href="/">Home</a></li><li><a href="/pros">Pro Gear &amp; Settings</a></li><li aria-current="page">{esc(name)}</li></ol>
    </nav>

    <div class="ph-hero">
      <div class="ph-eyebrow">Pro Database · {esc(game_label)}</div>
      <h1 class="ph-h1">{esc(name)}</h1>
      <p class="ph-sub">{sub}</p>
    </div>

    <div class="ph-wrap">
      <div class="ph-modal-stats">
        <div class="ph-modal-stat"><div class="ph-modal-stat-val">{esc(p.get("dpi")) if p.get("dpi") is not None else "—"}</div><div class="ph-modal-stat-lbl">DPI</div></div>
        <div class="ph-modal-stat"><div class="ph-modal-stat-val">{esc(p.get("sensitivity")) if p.get("sensitivity") is not None else "—"}</div><div class="ph-modal-stat-lbl">Sens</div></div>
        <div class="ph-modal-stat"><div class="ph-modal-stat-val">{esc(p.get("edpi")) if p.get("edpi") is not None else "—"}</div><div class="ph-modal-stat-lbl">eDPI</div></div>
      </div>

      <div class="ph-section-lbl">Gear</div>
      {row("Mouse", p.get("mouse"), True)}
      {row("Keyboard", p.get("keyboard"), True)}
      {row("Headset", p.get("headset"), True)}
      {row("Mousepad", p.get("mousepad"), True)}

      <div class="ph-section-lbl">Display</div>
      {row("Monitor", p.get("monitor"), True)}
      {row("Resolution", p.get("resolution"), False)}
      {row("Refresh", f"{p.get('refreshHz')}Hz" if p.get("refreshHz") else None, False)}
      {row("Polling", f"{p.get('pollingHz')}Hz" if p.get("pollingHz") else None, False)}

      {extra}

      <p class="pp-verified">Last verified: {esc(verified) if verified else "—"} · Source of record: <a href="/data/pros.json">pros.json</a></p>
      <a class="pp-back" href="/pros">← All {n_pros} pros</a>
    </div>
  </main>

  <footer class="site-footer">
    <p>© 2026 CosmicGamesHub · <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/games">Games</a> · <a href="/">Home</a></p>
    <p class="affiliate-disclosure">As an Amazon Associate we earn from qualifying purchases. Pro player gear data compiled from public sources; may not reflect day-of changes.</p>
  </footer>
  <script src="/global.js" defer></script>
</body>
</html>
"""


def replace_between(text: str, start: str, end: str, inner: str) -> str:
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pattern.search(text):
        raise SystemExit(f"Missing markers {start} / {end}")
    return pattern.sub(start + "\n" + inner + "\n    " + end, text)


def main() -> None:
    pros = load_json(PROS_PATH)
    links = load_json(LINKS_PATH)
    if not isinstance(pros, list) or not pros:
        raise SystemExit("pros.json is empty")

    cards = "\n".join(card_html(p) for p in pros)
    index = INDEX_PATH.read_text(encoding="utf-8")
    INDEX_PATH.write_text(replace_between(index, CARDS_START, CARDS_END, cards), encoding="utf-8")

    written = []
    for p in pros:
        slug = p["id"]
        if not re.fullmatch(r"[a-z0-9-]+", slug):
            raise SystemExit(f"Unsafe pro id: {slug}")
        dest = ROOT / "pros" / slug / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(detail_page(p, links, len(pros)), encoding="utf-8")
        written.append(slug)

    sitemap_entries = []
    for p in pros:
        sitemap_entries.append(
            "  <url>\n"
            f"    <loc>https://cosmicgameshub.com/pros/{p['id']}</loc>\n"
            "    <lastmod>2026-08-30</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.7</priority>\n"
            "  </url>"
        )
    sitemap = SITEMAP_PATH.read_text(encoding="utf-8")
    SITEMAP_PATH.write_text(
        replace_between(sitemap, SITEMAP_START, SITEMAP_END, "\n".join(sitemap_entries)),
        encoding="utf-8",
    )

    stale = []
    for child in (ROOT / "pros").iterdir():
        if child.is_dir() and child.name not in written:
            stale.append(child.name)
    if stale:
        print("Note: leftover pro folders not in JSON:", ", ".join(stale))

    print(f"Rendered {len(written)} pro pages and {len(pros)} list cards.")


if __name__ == "__main__":
    main()
