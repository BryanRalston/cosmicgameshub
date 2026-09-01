/**
 * Games-free affiliate one-liner next to Amazon CTAs.
 * Include only on pages we already edit. Does not rewrite pro pages.
 */
(function () {
  var NOTE = "We may earn a commission if you buy through our links. This doesn't affect the pick.";
  if (!document.getElementById("aff-note-style")) {
    var s = document.createElement("style");
    s.id = "aff-note-style";
    s.textContent = [
      ".aff-cta{display:flex;flex-direction:column;align-items:flex-start;gap:.35rem;margin:.15rem 0 .35rem}",
      ".aff-cta .btn--amazon,.aff-cta .btn--amazon-sm{margin-top:0}",
      ".aff-note{margin:0;font-size:.75rem;line-height:1.4;color:var(--text-lo,#888);max-width:36rem}"
    ].join("");
    document.head.appendChild(s);
  }

  function decorate(btn) {
    if (!btn || btn.closest(".aff-cta") || btn.closest("table")) return;
    var next = btn.nextElementSibling;
    if (next && next.classList && next.classList.contains("aff-note")) return;
    var wrap = document.createElement("div");
    wrap.className = "aff-cta";
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    var n = document.createElement("p");
    n.className = "aff-note";
    n.textContent = NOTE;
    wrap.appendChild(n);
  }

  document.querySelectorAll("a.btn--amazon, a.btn--amazon-sm").forEach(decorate);
})();
