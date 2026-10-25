    (function () {
      var parseLate = window.__brixParseLate;
      var thawQueue = [];
      var thawOn = false;
      var bootLeft = 0;
      function arm(el) {
        if (!el || el.nodeType !== 1 || el.id === 'container') return;
        el.classList.add('brix-cold');
      }
      function enqueue(el, boot, skipCold) {
        if (!el || el.nodeType !== 1 || el.id === 'container') return;
        if (!skipCold && !el.classList.contains('brix-cold')) arm(el);
        if (el.__brixQueued) return;
        el.__brixQueued = true;
        el.__brixBoot = !!boot;
        if (boot) bootLeft++;
        thawQueue.push(el);
      }
      function pumpThaw() {
        if (thawOn) return;
        thawOn = true;
        function step() {
          var el = thawQueue.shift();
          if (el) {
            el.__brixQueued = false;
            el.classList.remove('brix-park');
            el.classList.remove('brix-cold');
            if (el.__brixBoot) {
              bootLeft--;
              if (bootLeft <= 0) window.brixChromeReady = true;
            }
          }
          if (thawQueue.length) {
            // One node per frame. Two timers before the next paint were
            // laid out together, and that text layout was the long task.
            requestAnimationFrame(function () { setTimeout(step, 0); });
          } else {
            thawOn = false;
            if (bootLeft <= 0) window.brixChromeReady = true;
            if (document.body.classList.contains('phone-tray-open')) window.brixTrayReady = true;
            if (window.innerWidth > 430 && !catalogQueue.length) window.brixTrayReady = true;
          }
        }
        setTimeout(step, 0);
      }
      var catalogQueue = [];
      // Runs after the place stamp. The sidebar shell is first so its
      // children stay display:none, then a few buttons per frame.
      window.__brixStartChrome = function () {
        pumpThaw();
        if (!catalogQueue.length) return;
        function step() {
          var n = 0;
          while (catalogQueue.length && n < 8) {
            var el = catalogQueue.shift();
            el.classList.remove('brix-park');
            el.classList.remove('brix-cold');
            n++;
          }
          if (catalogQueue.length) requestAnimationFrame(function () { setTimeout(step, 0); });
          else if (window.innerWidth > 430) window.brixTrayReady = true;
        }
        requestAnimationFrame(function () { setTimeout(step, 0); });
      };
      function releaseCold(el) {
        if (!el || el.nodeType !== 1) return;
        var nodes = [el];
        var kids = el.querySelectorAll ? el.querySelectorAll('.brix-cold') : [];
        for (var i = 0; i < kids.length; i++) nodes.push(kids[i]);
        for (var n = 0; n < nodes.length; n++) {
          if (nodes[n].classList.contains('brix-cold')) enqueue(nodes[n], false);
        }
        pumpThaw();
      }
      function soon(fn) {
        var channel = soon.channel || (soon.channel = new MessageChannel());
        channel.port1.onmessage = function () { fn(); };
        channel.port2.postMessage(0);
      }
      function parkList(nodes, onEach) {
        var i = 0;
        function step() {
          var t0 = performance.now();
          while (i < nodes.length && performance.now() - t0 < 5) {
            onEach(nodes[i]);
            i++;
          }
          if (i < nodes.length) soon(step);
        }
        step();
      }
      function markCold(hold) {
        var phone = window.innerWidth <= 430;
        var top = hold.children;
        for (var i = 0; i < top.length; i++) {
          var el = top[i];
          if (el.id === 'container') continue;
          if (el.hidden || el.classList.contains('hidden')) continue;
          if (el.id === 'controls') {
            var scroll = el.querySelector('.tray-scroll');
            if (phone && scroll) {
              // Stay display:none until its own frame. content-visibility
              // on this node still laid the brick names out with the plate.
              el.classList.add('brix-park');
              enqueue(el, true, true);
              arm(scroll);
              var deep = scroll.querySelectorAll('.section, .subsection, .brick-btn');
              var deepList = [];
              for (var d = 0; d < deep.length; d++) deepList.push(deep[d]);
              parkList(deepList, arm);
            } else {
              // Every descendant stays display:none. Revealing the shell
              // while labels were still visible was a 30ms text layout.
              el.classList.add('brix-park');
              var inner = el.querySelectorAll('*');
              var innerList = [];
              for (var j = 0; j < inner.length; j++) innerList.push(inner[j]);
              catalogQueue.unshift(el);
              parkList(innerList, function (node) {
                node.classList.add('brix-park');
                catalogQueue.push(node);
              });
            }
            continue;
          }
          var showNow = el.id === 'brixBack' || el.id === 'quickBar' || el.id === 'buildHud' || el.id === 'phoneViewBtn' || el.id === 'stats' || el.id === 'fps' || el.id === 'qualityBar' || el.id === 'toast' || el.classList.contains('zoom-controls') || el.classList.contains('brix-more') || el.classList.contains('rotation-ind');
          if (showNow) {
            // Park, then show one per turn at the real absolute position.
            // content-visibility thaw moved these boxes and was the phone CLS.
            el.classList.add('brix-park');
            enqueue(el, true, true);
          } else {
            arm(el);
            el.classList.add('brix-park');
          }
        }
      }
      function watchShows(hold) {
        var mo = new MutationObserver(function (recs) {
          for (var i = 0; i < recs.length; i++) {
            var t = recs[i].target;
            if (!t || t.nodeType !== 1) continue;
            if (t.id === 'fullscreenHint' && t.classList.contains('visible')) releaseCold(t);
            if (t.id === 'controls' && t.classList.contains('tray-open')) releaseCold(t.querySelector('.tray-scroll') || t);
            if ((t.id === 'tutorialModal' || t.id === 'keybindModal') && t.classList.contains('visible')) releaseCold(t);
            if (t.classList && t.classList.contains('modal-overlay') && t.style.display && t.style.display !== 'none') releaseCold(t);
            if (t.id === 'phoneTutorial' && !t.hidden) releaseCold(t);
            if (t.id === 'starterBar' && !t.classList.contains('hidden')) releaseCold(t);
            if (t.id === 'dailyPrompt' && !t.hidden) releaseCold(t);
            if (t.classList && t.classList.contains('visible') && t.classList.contains('brix-cold')) releaseCold(t);
          }
        });
        mo.observe(hold, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
      }
      setTimeout(function () {
                fetch('/games/brix3d/brix-parts.json', { cache: 'no-store' }).then(function (res) {
          if (!res.ok) throw new Error('parts ' + res.status);
          return res.json();
        }).then(function (data) {
          window.__BRIX_THREE_PARTS__ = data.three;
          window.__BRIX_MAIN_PARTS__ = data.main;
          window.__BRIX_WARM__ = data.warm;
        }).catch(function (err) { console.error(err); });
        var s = document.createElement('script');
        s.type = 'module';
        s.src = '/games/brix3d/brix3d.B7TJPEGQ.js';
        document.body.appendChild(s);
        var hold = document.createElement('div');
        hold.id = 'brixHold';
        hold.style.display = 'none';
        document.body.appendChild(hold);
        fetch('/games/brix3d/brix-late.html', { cache: 'no-store' }).then(function (res) {
          if (!res.ok) throw new Error('late ui ' + res.status);
          return res.text();
        }).then(function (text) {
          var scratch = document.createElement('div');
          parseLate(text, scratch, function () {
          // Mount while the holder is display:none, then show it on the
          // next turn. Doing both inside the last parse step laid out the
          // whole tree in one 17ms task.
          setTimeout(function () {
          while (scratch.firstChild) hold.appendChild(scratch.firstChild);
          if (window.innerWidth <= 768) {
            var share = /(?:^#|[?&#])b=/.test(location.hash + location.search);
            var dismissed = false;
            try { dismissed = localStorage.getItem('brickBuilderTutorialDismissed') === 'true'; } catch (e) {}
            if (!share && !dismissed) {
              var bar = hold.querySelector('#starterBar');
              if (bar) bar.classList.add('hidden');
            }
          }
          watchShows(hold);
          markCold(hold);
          setTimeout(function () {
            hold.style.display = '';
            window.__brixUiShown = true;
            // Lay the parked shell out in this task. The tutorial is still
            // hidden, so its text layout happens in the next one.
            void hold.offsetHeight;
            // Reveal the phone card, then let it paint before boot fetches
            // the part files. A fetch that finishes before this paint is
            // simulated as render-blocking for the whole graph.
            setTimeout(function () {
              if (window.innerWidth <= 768 && !/(?:^#|[?&#])b=/.test(location.hash + location.search)) {
                var dismissed = false;
                try { dismissed = localStorage.getItem('brickBuilderTutorialDismissed') === 'true'; } catch (e) {}
                if (!dismissed) {
                  var card = hold.querySelector('#phoneTutorial');
                  if (card) {
                    card.hidden = false;
                    card.classList.remove('brix-park');
                    card.classList.remove('brix-cold');
                    void card.offsetHeight;
                  }
                }
              }
              requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                  window.__brixContentPainted = performance.now();
                });
              });
            }, 0);
          }, 0);
          }, 0);
          });
        }).catch(function (err) { console.error(err); });
      }, 0);
    })();
