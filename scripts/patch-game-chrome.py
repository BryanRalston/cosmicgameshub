#!/usr/bin/env python3
"""Normalize game-page nav to the hub compact bar. Skip fullscreen lab-nav canvases."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "games"
SKIP = {"index.html", "daily.html"}
LAB = {"asteroid-dodge.html", "beat-lab.html", "void-keeper.html", "brix3d.html", "dream-machine.html"}

NAV = """<nav class="nav" role="navigation" aria-label="Main navigation">
  <div class="container">
    <div class="nav__inner">
      <a href="/" class="nav__logo" aria-label="CosmicGamesHub home">
        <span class="nav__logo-icon">🎮</span>
        <span class="nav__logo-text">Cosmic<span>Games</span>Hub</span>
      </a>
      <ul class="nav__links" id="navLinks">
        <li><a href="/pros">Pros</a></li>
        <li><a href="/guides">Guides</a></li>
        <li><a href="/games/daily">Daily</a></li>
        <li><a href="/versus">Comparisons</a></li>
        <li><a href="/games" class="active">Games</a></li>
        <li><a href="/tools/gaming-fps-calculator" class="nav__cta btn">Free Tools</a></li>
      </ul>
      <button class="nav__hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>"""

NAV_RE = re.compile(r"<nav class=\"nav\"[\s\S]*?</nav>", re.I)


def main() -> None:
    for path in sorted(ROOT.glob("*.html")):
        if path.name in SKIP or path.name in LAB:
            continue
        text = path.read_text(encoding="utf-8")
        if not NAV_RE.search(text):
            print("no nav", path.name)
            continue
        new, n = NAV_RE.subn(NAV, text, count=1)
        if n:
            path.write_text(new, encoding="utf-8")
            print("nav", path.name)
        if "global.js" not in new:
            new = new.replace("</body>", '  <script src="/global.js" defer></script>\n</body>')
            path.write_text(new, encoding="utf-8")
            print("js", path.name)


if __name__ == "__main__":
    main()
