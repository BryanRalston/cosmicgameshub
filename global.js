(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  var MORE_GAMES = [
    { href: '/games/rift', name: 'RIFT' },
    { href: '/games/gamerdle', name: 'Gamerdle' },
    { href: '/games/brix3d', name: 'BRIX 3D' },
    { href: '/games/rootweave', name: 'Rootweave' },
    { href: '/games/pixle', name: 'Pixle' },
    { href: '/games', name: 'All games' }
  ];

  function injectGlobalNav() {
    var navLinks = document.querySelector('.nav__links');
    if (!navLinks) return;
    navLinks.innerHTML =
      '<li><a href="/games" class="nav__primary">Games</a></li>' +
      '<li><a href="/guides" class="nav__secondary">Guides</a></li>' +
      '<li><button type="button" class="nav__search-btn" id="navSearchBtn" aria-label="Open search" aria-haspopup="dialog" aria-controls="siteSearch">Search</button></li>';
  }

  function pagePath() {
    return window.location.pathname.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  }

  function moreGamesMarkup(path) {
    var html = '';
    MORE_GAMES.forEach(function (game) {
      var current = path === game.href ? ' aria-current="page"' : '';
      html += '<li><a href="' + game.href + '"' + current + '>' + game.name + '</a></li>';
    });
    return html;
  }

  function pageOverflowLocked() {
    var body = getComputedStyle(document.body);
    var root = getComputedStyle(document.documentElement);
    return body.overflow === 'hidden' || body.overflowY === 'hidden' || root.overflow === 'hidden' || root.overflowY === 'hidden';
  }

  var DOCK_CSS = '.more-games--dock{position:fixed;z-index:220;top:calc(8px + env(safe-area-inset-top,0px));right:8px;left:auto;margin:0;max-width:min(420px,calc(100vw - 16px));padding:.35rem;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(9,9,15,.94);font-family:system-ui,sans-serif}.more-games--dock .more-games__toggle{display:inline-flex;align-items:center;min-height:44px;padding:0 .9rem;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#fff;font:inherit;font-weight:800;font-size:.85rem;cursor:pointer}.more-games--dock .more-games__list{display:none;flex-wrap:wrap;gap:.4rem;list-style:none;margin:.4rem 0 0;padding:0}.more-games--dock.is-open .more-games__list{display:flex}.more-games--dock .more-games__list a{display:inline-flex;align-items:center;min-height:44px;padding:.35rem .8rem;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:#fff;font-weight:700;font-size:.85rem;text-decoration:none}.gotw-tag--float{position:fixed;z-index:230;left:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));margin:0;padding:.2rem .55rem;border-radius:999px;background:#ffe14a;color:#1a1200;font:800 .72rem/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}';

  function ensureDockCss() {
    if (document.getElementById('more-games-dock-css')) return;
    if (document.querySelector('link[href*="styles.css"]')) return;
    var style = document.createElement('style');
    style.id = 'more-games-dock-css';
    style.textContent = DOCK_CSS;
    document.head.appendChild(style);
  }

  function injectMoreGames() {
    if (document.querySelector('[data-more-games]')) return;
    var path = pagePath();
    if (path.indexOf('/games/') !== 0) return;
    var dock = pageOverflowLocked() || !!document.getElementById('lab-nav');
    var nav = document.createElement('nav');
    nav.className = dock ? 'more-games more-games--dock' : 'more-games';
    nav.setAttribute('data-more-games', '1');
    nav.setAttribute('aria-label', 'More games');
    var toggle = dock
      ? '<button type="button" class="more-games__toggle" aria-expanded="false">More games</button>'
      : '<span class="more-games__label">More games</span>';
    nav.innerHTML = toggle + '<ul class="more-games__list">' + moreGamesMarkup(path) + '</ul>';
    if (dock) {
      var button = nav.querySelector('.more-games__toggle');
      button.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      ensureDockCss();
      document.body.appendChild(nav);
      return;
    }
    var main = document.querySelector('main');
    if (main) main.appendChild(nav);
    else document.body.appendChild(nav);
  }

  function injectSearchOverlay() {
    if (document.getElementById('siteSearch')) return;
    var wrap = document.createElement('div');
    wrap.id = 'siteSearch';
    wrap.className = 'site-search';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="site-search__backdrop" data-search-close="1"></div>' +
      '<div class="site-search__panel" role="dialog" aria-modal="true" aria-labelledby="siteSearchLabel">' +
        '<p id="siteSearchLabel" class="visually-hidden">Search CosmicGamesHub</p>' +
        '<div class="site-search__bar">' +
          '<input type="search" id="siteSearchInput" class="site-search__input" placeholder="Search games, gear, pros…" autocomplete="off" enterkeyhint="go" />' +
          '<button type="button" class="site-search__close" data-search-close="1" aria-label="Close search">Esc</button>' +
        '</div>' +
        '<div class="site-search__hint" id="siteSearchHint">Type to search. Enter opens the first result.</div>' +
        '<div class="site-search__results" id="siteSearchResults" role="listbox" aria-label="Search results"></div>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function initHamburger() {
    var hamburger = document.querySelector('.nav__hamburger');
    var navLinks = document.querySelector('.nav__links');
    if (!hamburger || !navLinks || hamburger.dataset.navInit) return;
    hamburger.dataset.navInit = '1';
    hamburger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
      hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        var overlay = document.getElementById('siteSearch');
        if (overlay && !overlay.hidden) return;
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.focus();
      }
    });
  }

  function initSearch() {
    var overlay = document.getElementById('siteSearch');
    var input = document.getElementById('siteSearchInput');
    var resultsEl = document.getElementById('siteSearchResults');
    var hint = document.getElementById('siteSearchHint');
    var openBtn = document.getElementById('navSearchBtn');
    if (!overlay || !input || !resultsEl) return;

    var index = null;
    var loading = false;
    var filtered = [];

    function loadIndex() {
      if (index || loading) return Promise.resolve(index);
      loading = true;
      return fetch('/data/search.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          index = Array.isArray(data) ? data : [];
          loading = false;
          return index;
        })
        .catch(function () {
          index = [];
          loading = false;
          return index;
        });
    }

    function isTypingTarget(el) {
      if (!el) return false;
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function closeSearch() {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
      document.body.classList.remove('search-open');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    }

    function openSearch() {
      overlay.hidden = false;
      overlay.classList.add('is-open');
      document.body.classList.add('search-open');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
      var navLinks = document.querySelector('.nav__links');
      var hamburger = document.querySelector('.nav__hamburger');
      if (navLinks) navLinks.classList.remove('open');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      }
      loadIndex().then(function () {
        render();
        input.focus();
        input.select();
      });
    }

    function matches(item, q) {
      if (!q) return false;
      if ((item.title || '').toLowerCase().indexOf(q) !== -1) return true;
      if ((item.type || '').toLowerCase().indexOf(q) !== -1) return true;
      var tags = item.tags || [];
      for (var i = 0; i < tags.length; i++) {
        if (String(tags[i]).toLowerCase().indexOf(q) !== -1) return true;
      }
      return false;
    }

    function score(item, q) {
      var title = (item.title || '').toLowerCase();
      if (title === q) return 100;
      if (title.indexOf(q) === 0) return 80;
      if (title.indexOf(q) !== -1) return 60;
      var tags = item.tags || [];
      for (var i = 0; i < tags.length; i++) {
        if (String(tags[i]).toLowerCase().indexOf(q) !== -1) return 40;
      }
      if ((item.type || '').toLowerCase().indexOf(q) !== -1) return 20;
      return 0;
    }

    var GROUP_ORDER = [
      { type: 'game', label: 'Games' },
      { type: 'gear', label: 'Gear' },
      { type: 'pro', label: 'Pros' },
      { type: 'compare', label: 'Compare' },
      { type: 'page', label: 'Pages' }
    ];

    function render() {
      var q = (input.value || '').trim().toLowerCase();
      resultsEl.innerHTML = '';
      filtered = [];
      if (!q) {
        if (hint) hint.hidden = false;
        resultsEl.innerHTML = '<p class="site-search__empty">Search games, gear guides, pro setups, and comparisons.</p>';
        return;
      }
      if (hint) hint.hidden = true;
      var pool = index || [];
      var hits = pool.filter(function (item) { return matches(item, q); });
      hits.sort(function (a, b) { return score(b, q) - score(a, q); });
      filtered = hits;
      if (!hits.length) {
        resultsEl.innerHTML = '<p class="site-search__empty">No matches for “' + q.replace(/[<>&]/g, '') + '”.</p>';
        return;
      }
      var html = '';
      GROUP_ORDER.forEach(function (group) {
        var rows = hits.filter(function (item) { return item.type === group.type; });
        if (!rows.length) return;
        html += '<section class="site-search__group">';
        html += '<h3 class="site-search__group-label">' + group.label + '</h3>';
        rows.slice(0, 8).forEach(function (item) {
          var tags = (item.tags || []).slice(0, 3).join(' · ');
          html +=
            '<a class="site-search__hit" role="option" href="' + item.url + '">' +
              '<span class="site-search__hit-title">' + (item.title || '') + '</span>' +
              (tags ? '<span class="site-search__hit-meta">' + tags + '</span>' : '') +
            '</a>';
        });
        html += '</section>';
      });
      resultsEl.innerHTML = html;
    }

    function goFirst() {
      var first = resultsEl.querySelector('.site-search__hit');
      if (first && first.getAttribute('href')) {
        window.location.href = first.getAttribute('href');
      }
    }

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (overlay.hidden) openSearch();
        else closeSearch();
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-search-close')) {
        closeSearch();
      }
    });

    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        goFirst();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) {
        e.preventDefault();
        closeSearch();
        if (openBtn) openBtn.focus();
        return;
      }
      var metaK = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      var slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!metaK && !slash) return;
      if (isTypingTarget(e.target)) {
        if (overlay.hidden) return;
        if (slash) return;
      }
      e.preventDefault();
      if (overlay.hidden) openSearch();
      else input.focus();
    });
  }

  function featuredArt(slug, name, alt) {
    return {
      name: name,
      img: '/images/thumbs/' + slug + '-hero.webp',
      avif: '/images/thumbs/' + slug + '-hero.avif',
      w: 1600,
      h: 900,
      alt: alt
    };
  }

  var FEATURED_ART = {
    'holiday-rush': featuredArt('holiday-rush', 'Holiday Rush', 'Holiday Rush Mart floor, top-down'),
    rift: featuredArt('rift', 'RIFT', 'RIFT word game'),
    gamerdle: featuredArt('gamerdle', 'Gamerdle', 'Gamerdle guess the video game'),
    brix3d: featuredArt('brix3d', 'BRIX 3D', 'BRIX 3D brick cottage on the build plate'),
    rootweave: featuredArt('rootweave', 'Rootweave', 'Rootweave valley farm'),
    pixle: featuredArt('pixle', 'Pixle', 'Pixle five-letter gaming word'),
    'asteroid-dodge': featuredArt('asteroid-dodge', 'Asteroid Dodge', 'Asteroid Dodge'),
    'aim-trainer': featuredArt('aim-trainer', 'Aim Trainer', 'Aim Trainer'),
    crossword: featuredArt('crossword', 'Crossword', 'Crossword'),
    link: featuredArt('link', 'Link', 'Link'),
    sudoku: featuredArt('sudoku', 'Sudoku', 'Sudoku'),
    minesweeper: featuredArt('minesweeper', 'Minesweeper', 'Minesweeper')
  };

  var WEEK_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function weekLabel(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!match) return '';
    var month = WEEK_MONTHS[Number(match[2]) - 1];
    if (!month) return '';
    return 'Week of ' + month + ' ' + Number(match[3]);
  }

  function titleFromSlug(slug) {
    return slug.split('-').map(function (word) {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  function paintFeatured(data) {
    if (!data || typeof data.slug !== 'string' || !/^[a-z0-9-]+$/.test(data.slug)) return;
    var slug = data.slug;
    var art = FEATURED_ART[slug];
    var name = art ? art.name : titleFromSlug(slug);
    var blurb = typeof data.blurb === 'string' ? data.blurb : '';
    var card = document.getElementById('gotw');
    if (card) {
      card.setAttribute('href', '/games/' + slug);
      var title = document.getElementById('gotwTitle');
      var blurbEl = document.getElementById('gotwBlurb');
      var week = document.getElementById('gotwWeek');
      var img = document.getElementById('gotwImg');
      var media = document.getElementById('gotwMedia');
      if (title) title.textContent = name;
      if (blurbEl) blurbEl.textContent = blurb;
      if (week) week.textContent = weekLabel(data.weekStart);
      if (img && media) {
        if (art) {
          img.hidden = false;
          if (img.getAttribute('src') !== art.img) {
            img.src = art.img;
            img.width = art.w;
            img.height = art.h;
          }
          var avif = document.getElementById('gotwAvif');
          if (avif && art.avif) avif.srcset = art.avif;
          img.alt = art.alt;
          media.classList.remove('is-plain');
        } else {
          img.hidden = true;
          img.alt = '';
          media.classList.add('is-plain');
        }
      }
    }
    var existing = document.querySelector('.tile__badge--gotw');
    var currentSlug = existing && existing.closest('.tile') ? existing.closest('.tile').getAttribute('data-slug') : '';
    if (currentSlug !== slug) {
      if (existing) existing.remove();
      var badges = document.querySelector('.tile[data-slug="' + slug + '"] .tile__badges');
      if (badges) {
        var tileBadge = document.createElement('span');
        tileBadge.className = 'tile__badge tile__badge--gotw';
        tileBadge.textContent = 'Game of the Week';
        badges.insertBefore(tileBadge, badges.firstChild);
      }
    }
    document.querySelectorAll('.gh-card__thumb, .gh-desk-card__imgwrap').forEach(function (link) {
      var dest = (link.getAttribute('href') || '').replace(/\/$/, '');
      if (dest !== '/games/' + slug) return;
      var badge = link.querySelector('.gh-card__badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'gh-card__badge';
        link.appendChild(badge);
      }
      badge.className = 'gh-card__badge gh-card__badge--gotw';
      badge.textContent = 'Game of the Week';
    });
    var gameMatch = pagePath().match(/^\/games\/([a-z0-9-]+)$/);
    if (!gameMatch || gameMatch[1] !== slug || slug === 'daily' || slug === 'embed-template') return;
    if (document.querySelector('.gotw-tag')) return;
    var tag = document.createElement('p');
    tag.className = 'gotw-tag';
    tag.textContent = 'Game of the Week';
    var heading = document.querySelector('h1');
    if (heading && heading.parentNode) {
      heading.parentNode.insertBefore(tag, heading);
      return;
    }
    tag.classList.add('gotw-tag--float');
    ensureDockCss();
    document.body.appendChild(tag);
  }

  function applyFeatured() {
    fetch('/data/featured.json', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('featured');
        return response.json();
      })
      .then(paintFeatured)
      .catch(function () {});
  }

  function playBreakMarkup() {
    return '<aside class="play-break" data-play-break="1" aria-label="Take a break: play our free games">' +
      '<p class="play-break__title">Take a break: play our free games</p>' +
      '<ul>' +
        '<li><a href="/games/brix3d">BRIX 3D</a><span> — build with bricks in the browser</span></li>' +
        '<li><a href="/games/rift">RIFT</a><span> — three daily word zones</span></li>' +
        '<li><a href="/games/gamerdle">Gamerdle</a><span> — guess the mystery game</span></li>' +
      '</ul>' +
    '</aside>';
  }

  function injectPlayBreaks() {
    if (!/^\/guides\/[a-z0-9-]+$/.test(pagePath())) return;
    var root = document.querySelector('main') || document.querySelector('.guide-main');
    if (!root || root.querySelector('[data-play-break]')) return;
    var headings = root.querySelectorAll('h2');
    var midHost = null;
    for (var i = 0; i < headings.length; i++) {
      var top = headings[i].getBoundingClientRect().top + window.scrollY;
      if (top >= window.innerHeight) {
        midHost = headings[i];
        break;
      }
    }
    if (midHost && midHost.parentNode) {
      var mid = document.createElement('div');
      mid.innerHTML = playBreakMarkup();
      midHost.parentNode.insertBefore(mid.firstChild, midHost);
    }
    root.insertAdjacentHTML('beforeend', playBreakMarkup());
  }

  function eventElement(event) {
    var node = event.target;
    if (!node) return null;
    return node.nodeType === 1 ? node : node.parentElement;
  }

  function trackEvent(name, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params);
  }

  function gameSlugFromHref(href) {
    try {
      var url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return '';
      var match = url.pathname.replace(/\/$/, '').match(/^\/games\/([a-z0-9-]+)$/);
      if (!match || match[1] === 'daily' || match[1] === 'embed-template') return '';
      return match[1];
    } catch (err) {
      return '';
    }
  }

  function clickPlacement(el) {
    if (el.closest('.play-break')) return 'play_break';
    if (el.closest('#gotw, .gotw')) return 'feature';
    if (el.closest('.tile, .tile-grid')) return 'tile';
    if (el.closest('.more-games, .brix-more')) return 'more_games';
    if (el.closest('.nav')) return 'nav';
    return 'link';
  }

  function sameHostReferrer() {
    try {
      if (!document.referrer) return 'direct';
      var url = new URL(document.referrer);
      if (url.origin !== window.location.origin) return 'direct';
      return url.pathname || '/';
    } catch (err) {
      return 'direct';
    }
  }

  function ignoredGameTarget(el) {
    return !!(el && el.closest && el.closest('nav, footer, .more-games, .brix-more, .play-break, #siteSearch, .site-search'));
  }

  function watchComplete(id, className, onComplete) {
    var el = document.getElementById(id);
    if (!el) return;
    function check() {
      if (el.classList.contains(className)) onComplete();
    }
    check();
    var observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function initAnalytics() {
    document.addEventListener('click', function (event) {
      var origin = eventElement(event);
      var link = origin && origin.closest('a[href]');
      if (!link) return;
      var slug = gameSlugFromHref(link.getAttribute('href'));
      if (!slug) return;
      trackEvent('game_card_click', {
        game: slug,
        source_page: window.location.pathname,
        placement: clickPlacement(link)
      });
    }, true);

    var match = pagePath().match(/^\/games\/([a-z0-9-]+)$/);
    if (!match || match[1] === 'daily' || match[1] === 'embed-template') return;
    var slug = match[1];
    var started = false;
    function start(event) {
      if (started) return;
      if (event.type === 'keydown' && (event.key === '/' || event.key === 'Escape' || event.metaKey || event.ctrlKey || event.altKey)) return;
      if (ignoredGameTarget(eventElement(event))) return;
      started = true;
      trackEvent('game_start', { game: slug, source_page: sameHostReferrer() });
    }
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('keydown', start, true);

    var finished = false;
    function complete() {
      if (finished) return;
      finished = true;
      trackEvent('game_complete', { game: slug, source_page: sameHostReferrer() });
    }
    if (slug === 'rift') {
      watchComplete('resultScreen', 'show', complete);
    } else if (slug === 'gamerdle') {
      watchComplete('resultPanel', 'show', complete);
    } else if (slug === 'pixle') {
      watchComplete('result-modal', 'open', complete);
    } else if (slug === 'aim-trainer') {
      watchComplete('resultOverlay', 'show', complete);
    }
  }

  function initPortalFilters() {
    var grid = document.getElementById('tileGrid');
    if (!grid) return;
    var chips = document.querySelectorAll('.chip[data-cat]');
    var tiles = grid.querySelectorAll('.tile');
    var empty = document.getElementById('tileEmpty');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var cat = chip.getAttribute('data-cat');
        chips.forEach(function (other) {
          var on = other === chip;
          other.classList.toggle('is-on', on);
          other.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        var shown = 0;
        tiles.forEach(function (tile) {
          var cats = (tile.getAttribute('data-cats') || '').split(/\s+/);
          var match = cat === 'all' || cats.indexOf(cat) !== -1;
          tile.hidden = !match;
          if (match) shown += 1;
        });
        grid.querySelectorAll('.shelf').forEach(function (shelf) {
          shelf.hidden = !shelf.querySelector('.tile:not([hidden])');
        });
        if (empty) empty.hidden = shown !== 0;
      });
    });
  }

  function initSiteChrome() {
    injectGlobalNav();
    injectMoreGames();
    injectSearchOverlay();
    initHamburger();
    initSearch();
    applyFeatured();
    initPortalFilters();
    initAnalytics();
    if (document.readyState === 'complete') injectPlayBreaks();
    else window.addEventListener('load', injectPlayBreaks);

    /* ── Scroll reveal: first-paint visible, animate only off-screen ── */
    (function () {
      var revealEls = document.querySelectorAll(
        '.js-reveal, .product-card, .guide-card, .game-card, .cat-card, .versus-card, .feature-card, .stat-block, .faq__item, .faq-item, .disclosure, .tile, .shelf, .gotw, .secondary-card, .gh-card, .gh-desk-card'
      );
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      revealEls.forEach(function (el) {
        if (!el.classList.contains('js-reveal')) el.classList.add('js-reveal');
        var r = el.getBoundingClientRect();
        if (reduce || (r.top < window.innerHeight - 4 && r.bottom > 0)) {
          el.classList.add('revealed');
        }
      });
      document.documentElement.classList.add('js-ready');
      if (reduce || !('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      revealEls.forEach(function (el) {
        if (!el.classList.contains('revealed')) io.observe(el);
      });
    })();

    /* ── Flashlight glow on grid containers ── */
    document.querySelectorAll('.glow-grid, .guide-cards, .product-grid, .game-grid, .cat-grid, .versus-grid').forEach(function (grid) {
      grid.addEventListener('mousemove', function (e) {
        var cards = grid.querySelectorAll('.card, .guide-card, .product-card, .game-card, .cat-card, .versus-card');
        cards.forEach(function (card) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--cx', (e.clientX - r.left) + 'px');
          card.style.setProperty('--cy', (e.clientY - r.top) + 'px');
        });
      });
      grid.addEventListener('mouseleave', function () {
        grid.querySelectorAll('.card, .guide-card, .product-card, .game-card, .cat-card, .versus-card').forEach(function (card) {
          card.style.removeProperty('--cx');
          card.style.removeProperty('--cy');
        });
      });
    });

    /* ── 3D tilt on cards ── */
    var TILT_MAX = 8;
    document.querySelectorAll('.product-card, .guide-card, .cat-card, .versus-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var rx = ((e.clientY - cy) / (r.height / 2)) * -TILT_MAX;
        var ry = ((e.clientX - cx) / (r.width / 2)) * TILT_MAX;
        card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-3px)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });

    /* ── FAQ accordion (both patterns) ── */
    function initFaq(questionSel, itemSel) {
      document.querySelectorAll(questionSel).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.closest(itemSel + ', .faq__item, .faq-item');
          var expanded = item && item.classList.contains('open');
          var parent = btn.closest('.faq__list, .faq-list, .faq');
          if (parent) {
            parent.querySelectorAll(itemSel + ', .faq__item, .faq-item').forEach(function (i) {
              i.classList.remove('open');
              var b = i.querySelector(questionSel);
              if (b) b.setAttribute('aria-expanded', 'false');
            });
          }
          if (!expanded && item) {
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });
    }
    initFaq('.faq__question', '.faq__item');
    initFaq('.faq-item h3', '.faq-item');

    /* ── Active nav link highlight (longest match wins) ── */
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    var best = null;
    var bestLen = -1;
    document.querySelectorAll('.nav__links a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/\/$/, '');
      if (!href) return;
      if (path === href || (href !== '/' && path.indexOf(href) === 0)) {
        if (href.length > bestLen) {
          best = a;
          bestLen = href.length;
        }
      }
    });
    if (best) best.classList.add('active');

    /* ── Smooth scroll for anchor links ── */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    /* ── Nav scroll shadow (skip if homepage handles its own scroll) ── */
    var nav = document.querySelector('.nav');
    if (nav && !document.getElementById('mainNav')) {
      var onScroll = function () {
        nav.classList.toggle('nav--scrolled', window.scrollY > 10);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ── Reading progress bar (article pages only) ── */
    var article = document.querySelector('.article, .guide-main');
    if (article) {
      var bar = document.createElement('div');
      bar.id = 'reading-progress';
      document.body.appendChild(bar);
      window.addEventListener('scroll', function () {
        var scrollTop = window.scrollY;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0) + '%';
      }, { passive: true });
    }

    /* ── Back-to-top button ── */
    if (article) {
      var btt = document.createElement('button');
      btt.id = 'back-to-top';
      btt.setAttribute('aria-label', 'Back to top');
      btt.innerHTML = '↑';
      document.body.appendChild(btt);
      window.addEventListener('scroll', function () {
        btt.classList.toggle('visible', window.scrollY > 600);
      }, { passive: true });
      btt.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    mountEmailCaptures();
  }

  var BD_EMBED = 'https://buttondown.com/api/emails/embed-subscribe/cosmicgameshub';
  var emailUid = 0;

  function emailCaptureHTML() {
    emailUid += 1;
    var id = 'bd-email-' + emailUid;
    return (
      '<div class="email-band__eyebrow">Free · Unsubscribe anytime</div>' +
      '<p class="email-band__title">Get a daily puzzle ping</p>' +
      '<p class="email-band__sub">Daily puzzle reminder + occasional FPS gear note. Confirm the email Buttondown sends — we will not pretend you joined before that.</p>' +
      '<form class="email-band__form embeddable-buttondown-form" action="' + BD_EMBED + '" method="post">' +
        '<label class="visually-hidden" for="' + id + '">Email address</label>' +
        '<div class="email-band__input-wrap">' +
          '<input type="email" name="email" id="' + id + '" class="email-band__input" placeholder="you@email.com" required autocomplete="email" />' +
          '<button type="submit" class="btn btn--primary email-band__btn">Get updates</button>' +
        '</div>' +
        '<input type="hidden" name="embed" value="1" />' +
        '<p class="email-band__note">Hosted by <a href="https://buttondown.com/cosmicgameshub">Buttondown</a>. See <a href="/privacy">Privacy</a>. We do not sell emails.</p>' +
      '</form>'
    );
  }

  function mountEmailCaptures() {
    document.querySelectorAll('[data-cg-email]').forEach(function (el) {
      if (el.getAttribute('data-cg-email-ready')) return;
      el.setAttribute('data-cg-email-ready', '1');
      if (!el.classList.contains('email-capture')) el.classList.add('email-capture');
      el.innerHTML = emailCaptureHTML();
    });
  }

  onReady(initSiteChrome);
})();
