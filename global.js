(function () {
  'use strict';

  /* ── Hamburger nav toggle (skip if page has own inline handler) ── */
  var hamburger = document.querySelector('.nav__hamburger');
  var navLinks = document.querySelector('.nav__links');
  if (hamburger && navLinks && !hamburger.dataset.navInit) {
    hamburger.dataset.navInit = '1';
    hamburger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }
  /* ── Scroll reveal ── */
  if ('IntersectionObserver' in window) {
    var revealEls = document.querySelectorAll(
      '.js-reveal, .product-card, .guide-card, .game-card, .cat-card, .versus-card, .feature-card, .stat-block, .faq__item, .faq-item, .disclosure'
    );
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) {
      if (!el.classList.contains('js-reveal')) el.classList.add('js-reveal');
      io.observe(el);
    });
  }

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
        /* collapse all siblings */
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

  /* ── Active nav link highlight ── */
  var path = window.location.pathname.replace(/\/$/, '');
  document.querySelectorAll('.nav__links a').forEach(function (a) {
    var href = a.getAttribute('href').replace(/\/$/, '');
    if (href && path.startsWith(href) && href !== '') {
      a.classList.add('active');
    }
  });

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

})();
