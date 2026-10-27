setTimeout(function () {
window.dataLayer = window.dataLayer || [];
window.gtag = function () { window.dataLayer.push(arguments); };
window.addEventListener('load', function () {
  var loadGa = function () {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-D272MF8NQP';
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', 'G-D272MF8NQP');
  };
  setTimeout(loadGa, 15000);
});
var names = JSON.parse(document.getElementById('brix-sheets').textContent);
var sheetAt = 0;
function bootSheets() {
  var s = document.createElement('script');
  s.src = '/games/brix3d/brix-shell.js';
  s.onload = function () {
    setTimeout(function () {
      var m = document.createElement('script');
      m.src = '/games/brix3d/brix-mount.js';
      document.body.appendChild(m);
    }, 0);
  };
  document.body.appendChild(s);
}
function stepSheets() {
  if (sheetAt >= names.length) { bootSheets(); return; }
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/games/brix3d/' + names[sheetAt++];
  function next() {
    // A forced layout here joined the sheet parse. On a busy CPU that
    // layout simulated past 50ms near 600ms and had no script URL.
    setTimeout(stepSheets, 0);
  }
  link.onload = next;
  link.onerror = next;
  document.head.appendChild(link);
}
var preloadAt = 0;
var sheetsStarted = false;
setTimeout(function preloadSome() {
  // One turn used to append every sheet. On a busy browser that turn
  // simulated just past 50ms, so the preloads yield every few links.
  // Stylesheets start after the first batch is queued, on their own turn,
  // so a cold parse is not added to the preload turn. Critical popup and
  // title rules are already in the document style and do not wait here.
  var end = Math.min(preloadAt + 6, names.length);
  for (; preloadAt < end; preloadAt++) {
    var preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'style';
    preload.href = '/games/brix3d/' + names[preloadAt];
    document.head.appendChild(preload);
  }
  if (!sheetsStarted) {
    sheetsStarted = true;
    setTimeout(stepSheets, 0);
  }
  if (preloadAt < names.length) setTimeout(preloadSome, 0);
}, 0);
}, 0);
setTimeout(function () {
(function () {
  document.addEventListener('click', function (event) {
    var btn = event.target.closest && event.target.closest('.brix-more__toggle');
    if (!btn) return;
    var nav = btn.closest('.brix-more');
    if (!nav) return;
    var open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params);
  }
  function referrerPath() {
    try {
      if (!document.referrer) return 'direct';
      var url = new URL(document.referrer);
      if (url.origin !== location.origin) return 'direct';
      return url.pathname || '/';
    } catch (err) {
      return 'direct';
    }
  }
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var match = (link.getAttribute('href') || '').match(/^\/games\/([a-z0-9-]+)$/);
    if (!match || match[1] === 'brix3d') return;
    track('game_card_click', { game: match[1], source_page: '/games/brix3d', placement: 'more_games' });
  }, true);
  var started = false;
  function start(event) {
    if (started) return;
    if (event.type === 'keydown' && (event.key === '/' || event.key === 'Escape' || event.metaKey || event.ctrlKey || event.altKey)) return;
    var target = event.target;
    if (target.closest && target.closest('.brix-more, a')) return;
    started = true;
    track('game_start', { game: 'brix3d', source_page: referrerPath() });
  }
  document.addEventListener('pointerdown', start, true);
  document.addEventListener('keydown', start, true);
  fetch('/data/featured.json', { credentials: 'same-origin' })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data || data.slug !== 'brix3d' || document.querySelector('.gotw-tag')) return;
      var tag = document.createElement('p');
      tag.className = 'gotw-tag gotw-tag--float';
      tag.textContent = 'Game of the Week';
      document.body.appendChild(tag);
    })
    .catch(function () {});
})();
}, 0);
