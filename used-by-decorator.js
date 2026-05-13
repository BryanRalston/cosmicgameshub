/**
 * used-by-decorator.js
 * Auto-decorates each product card on a buying-guide page with a
 * "X of N tracked pros use this" trust line, sourced from /data/pros.json.
 *
 * Configuration before this script runs (in the host page):
 *   window.UB_FIELD = 'mouse' | 'headset' | 'keyboard' | 'monitor' | 'mousepad'
 *   window.UB_THEME = { color, bg, border, emoji }   // optional, defaults below
 *
 * Card structures supported:
 *   .vg-pick      with .vg-pick-name (game-specific guides)
 *   .product-card with .product-card__title (older generic guides)
 *
 * Injection point: just before the Amazon CTA inside the card.
 */
(function () {
  if (!window.UB_FIELD) return;

  var THEME = Object.assign(
    { color: '#00d4ff', bg: 'rgba(0,212,255,0.04)', border: 'rgba(0,212,255,0.18)', emoji: '🎮' },
    window.UB_THEME || {}
  );

  // Inject scoped CSS once.
  if (!document.getElementById('ub-decorator-style')) {
    var s = document.createElement('style');
    s.id = 'ub-decorator-style';
    s.textContent = [
      '.ub-pros-line{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.65rem .85rem;margin:.85rem 0 .5rem;background:' + THEME.bg + ';border:1px solid ' + THEME.border + ';border-radius:10px;font-size:.85rem;color:#b8b8c8;line-height:1.4}',
      '.ub-pros-line strong{color:' + THEME.color + ';font-weight:800}',
      '.ub-pros-line .ub-names{color:#eef}',
      '.ub-pros-line a{color:' + THEME.color + ';text-decoration:none;font-weight:700}',
      '.ub-pros-line a:hover{text-decoration:underline}'
    ].join('');
    document.head.appendChild(s);
  }

  function decorate(pros) {
    var FIELD = window.UB_FIELD;
    // Try both card structures
    var cards = Array.from(document.querySelectorAll('.vg-pick, .product-card'));
    cards.forEach(function (card) {
      var titleEl = card.querySelector('.vg-pick-name, .product-card__title');
      if (!titleEl) return;
      var title = titleEl.textContent.trim().toLowerCase();
      if (!title) return;
      var matches = pros.filter(function (p) {
        var g = p[FIELD];
        if (!g) return false;
        var gl = g.toLowerCase();
        return title.startsWith(gl) || gl.startsWith(title);
      });
      if (!matches.length) return;
      var names = matches.slice(0, 4).map(function (p) { return p.name; }).join(', ');
      var more = matches.length > 4
        ? ' <a href="/pros">+' + (matches.length - 4) + ' more →</a>'
        : ' <a href="/pros">See setups →</a>';
      var line = document.createElement('div');
      line.className = 'ub-pros-line';
      line.innerHTML = THEME.emoji + ' <strong>' + matches.length + ' of ' + pros.length + ' tracked pros</strong> use this — <span class="ub-names">' + names + '</span>' + more;
      // Prefer to inject right before the Amazon CTA so it sits next to the buy decision
      var cta = card.querySelector('.vg-cta, .btn--amazon, .btn-amazon, a[href*="amazon.com"][rel*="sponsored"]');
      if (cta && cta.parentElement) {
        cta.parentElement.insertBefore(line, cta);
      } else {
        var body = card.querySelector('.vg-pick-body, .product-card__body') || card;
        body.appendChild(line);
      }
    });
  }

  fetch('/data/pros.json').then(function (r) { return r.json(); }).then(decorate).catch(function () { /* fail silently */ });
})();
