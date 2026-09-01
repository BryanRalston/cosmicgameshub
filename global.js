(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function injectGlobalNav() {
    var navLinks = document.querySelector('.nav__links');
    if (!navLinks) return;
    navLinks.innerHTML =
      '<li><a href="/games">Play</a></li>' +
      '<li><a href="/guides">Gear</a></li>' +
      '<li><a href="/deals">Deals</a></li>' +
      '<li><a href="/pros">Pros</a></li>' +
      '<li><a href="/games/daily">Daily</a></li>' +
      '<li><a href="/versus">Compare</a></li>' +
      '<li><button type="button" class="nav__search-btn" id="navSearchBtn" aria-label="Open search" aria-haspopup="dialog" aria-controls="siteSearch">Search</button></li>';
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

  function initSiteChrome() {
    injectGlobalNav();
    injectSearchOverlay();
    initHamburger();
    initSearch();

    /* ── Scroll reveal: first-paint visible, animate only off-screen ── */
    (function () {
      var revealEls = document.querySelectorAll(
        '.js-reveal, .product-card, .guide-card, .game-card, .cat-card, .versus-card, .feature-card, .stat-block, .faq__item, .faq-item, .disclosure'
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
  }

  onReady(initSiteChrome);
})();
