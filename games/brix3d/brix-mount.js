    (function () {
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var card = document.getElementById('phoneTutorial');
        if (!card || card.hidden) return;
        card.hidden = true;
        card.dataset.closed = '1';
        var box = document.getElementById('phoneTutorialDontShow');
        if (box && box.checked) {
          try { localStorage.setItem('brickBuilderTutorialDismissed', 'true'); } catch (err) {}
        }
      });
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
      var thawWait = false;
      function pumpThaw() {
        // The first full-document layout has to stay under the long-task
        // line. HUD nodes stay display:none until that flush has finished.
        if (!window.__brixLayoutFlushed) {
          if (thawWait) return;
          thawWait = true;
          function wait() {
            if (!window.__brixLayoutFlushed) { requestAnimationFrame(wait); return; }
            thawWait = false;
            pumpThaw();
          }
          requestAnimationFrame(wait);
          return;
        }
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
      var hotQueue = [];
      // Runs after the place stamp. The sidebar shell is first so its
      // children stay display:none, then a few buttons per frame.
      window.__brixStartChrome = function () {
        // The name field has a box while the loading screen is still the
        // top hit. A click then types into the loader, and Save never sees
        // the name. Thaw the sidebar once that screen stops taking hits.
        function go() {
          var boot = document.getElementById('loadingScreen');
          if (boot && !boot.classList.contains('hide') && boot.style.display !== 'none') {
            setTimeout(go, 0);
            return;
          }
          if (hotQueue.length) {
            var shell = catalogQueue.shift();
            catalogQueue = hotQueue.concat(catalogQueue);
            hotQueue = [];
            if (shell) catalogQueue.unshift(shell);
          }
          pumpThaw();
          if (!catalogQueue.length) return;
          function step() {
            var n = 0;
            var t0 = performance.now();
            // One node was too slow: Tools was still display:none when a
            // player scrolled to it. A few cheap nodes fit under the
            // long-task line. A single expensive node still gets its own turn.
            while (catalogQueue.length && n < 12) {
              if (n && performance.now() - t0 >= 5) break;
              var el = catalogQueue.shift();
              el.classList.remove('brix-park');
              el.classList.remove('brix-cold');
              n++;
            }
            if (catalogQueue.length) requestAnimationFrame(function () { setTimeout(step, 0); });
            else if (window.innerWidth > 430) window.brixTrayReady = true;
          }
          requestAnimationFrame(function () { setTimeout(step, 0); });
        }
        go();
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
          if (el.id === 'tutorialModal' || el.id === 'keybindModal') {
            el.classList.add('brix-park');
            arm(el);
            var heavy = el.querySelectorAll('.tutorial-header, .tutorial-page, #keybindList');
            for (var h = 0; h < heavy.length; h++) {
              heavy[h].classList.add('brix-park');
              heavy[h].classList.add('brix-cold');
            }
            continue;
          }
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
                var id = node.id || '';
                var cls = node.classList;
                var hot = cls.contains('section') || cls.contains('section-title') || cls.contains('section-content') || cls.contains('tool-btn') || cls.contains('tool-grid') || cls.contains('color-preset') || cls.contains('color-presets') || cls.contains('project-btn') || id === 'deleteBtn' || id === 'projectName' || id === 'saveProjectBtn';
                if (hot) hotQueue.push(node);
                else catalogQueue.push(node);
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
            if (t.id === 'controls' && t.classList.contains('tray-open')) {
              var scroll = t.querySelector('.tray-scroll') || t;
              // Section shells first. Brick buttons stay cold so the name
              // list does not lay out in this turn. A title that is still
              // content-visibility:hidden cannot be tapped.
              var sections = scroll.querySelectorAll('.section');
              for (var s = 0; s < sections.length; s++) {
                sections[s].classList.remove('brix-park');
                sections[s].classList.remove('brix-cold');
              }
              releaseCold(scroll);
            }
            if (t.id === 'tutorialModal' && t.dataset.closed === '1' && t.classList.contains('visible')) {
              // Skip already ran. A late boot timer must not cover the plate again.
              t.classList.remove('visible');
              continue;
            }
            if ((t.id === 'tutorialModal' || t.id === 'keybindModal') && t.classList.contains('visible')) {
              // One card used to lay out in a single 30ms turn. That simulated
              // past 50ms. The shell shows first. Each block follows on its own turn.
              if (!t.__brixSplit) {
                t.__brixSplit = true;
                var pages = t.querySelectorAll('.tutorial-page');
                for (var p = 0; p < pages.length; p++) {
                  pages[p].classList.remove('brix-park');
                  pages[p].classList.remove('brix-cold');
                }
                var bits = t.querySelectorAll('.tutorial-header, .tutorial-page > *, #keybindList');
                for (var b = 0; b < bits.length; b++) {
                  bits[b].classList.add('brix-park');
                  bits[b].classList.add('brix-cold');
                }
                t.classList.remove('brix-park');
                t.classList.remove('brix-cold');
                for (var b2 = 0; b2 < bits.length; b2++) enqueue(bits[b2], false);
                pumpThaw();
              }
            }
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
        s.src = '/games/brix3d/brix3d.HJXMTZ2L.js';
        document.body.appendChild(s);
        var hold = document.createElement('div');
        hold.id = 'brixHold';
        hold.style.display = 'none';
        // A full-document layout is about 16ms no matter how few nodes
        // changed, and that simulates past 50ms. Layout containment keeps
        // a HUD or tutorial reveal inside this box. The box fills the
        // viewport, so fixed bars stay where they were. position:fixed
        // made getBoundingClientRect ignore a 90% page scale, and the
        // ghost then sat off the cursor.
        hold.style.contain = 'layout';
        hold.style.width = '100%';
        hold.style.height = '100vh';
        hold.style.height = '100dvh';
        hold.style.pointerEvents = 'none';
        // pointer-events inherits. The hold stays none so a gap falls
        // through, but the canvas and the bars were dead too: Skip never
        // received the click, the welcome card stayed over the plate, and
        // a tap on the studs never reached the canvas. These roots opt in.
        // Decorative hints keep their own pointer-events:none.
        var hit = document.createElement('style');
        hit.textContent = '#container,#controls,#tutorialModal,#keybindModal,#buildHud,#quickBar,#starterBar,#dailyPrompt,#stats,#qualityBar,#fps,#info,#galleryModal,#loadConfirm,#namePrompt,#mirrorPopup,#buildToolPopup,#brixBack,#phoneViewBtn,#sidebarToggle,#fullscreenHint,#fpsModeUI,.zoom-controls,.rotation-ind,.brix-more,#toast,.pan-hint{pointer-events:auto}';
        document.head.appendChild(hit);
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
          // The name row stays display:none until Skip. A box under the
          // loader makes the first click type into the loader.
          function unparkProjectName() {
            var field = document.getElementById('projectName');
            var node = field;
            var guard = 0;
            while (node && node.id !== 'brixHold' && guard++ < 14) {
              node.classList.remove('brix-park');
              node.classList.remove('brix-cold');
              node = node.parentElement;
            }
            var title = document.querySelector('#projectSection > .section-title');
            if (title) {
              title.classList.remove('brix-park');
              title.classList.remove('brix-cold');
            }
          }
          // Skip has to close the card even when it lands before the game
          // module binds its own listener. A later show must not undo that.
          hold.addEventListener('click', function (e) {
            var n = e.target;
            if (!n || !n.closest || !n.closest('#tutorialSkip')) return;
            var modal = document.getElementById('tutorialModal');
            if (!modal) return;
            modal.dataset.closed = '1';
            modal.classList.remove('visible');
            unparkProjectName();
          }, true);
          // The game binds Escape only after its module evaluates. A player
          // can close the card in that gap. One Escape has to win.
          document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var modal = document.getElementById('tutorialModal');
            if (!modal || !modal.classList.contains('visible')) return;
            modal.dataset.closed = '1';
            modal.classList.remove('visible');
            unparkProjectName();
          }, true);
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
              // Desktop waits until the orbit pose exists. A card shown
              // before that reads as the camera moving under the modal.
              // The name row stays parked until Skip, so a click cannot
              // land on it while this card or the loader is on top.
              function showDeskTutorial() {
                if (window.innerWidth <= 768) return;
                if (/(?:^#|[?&#])b=/.test(location.hash + location.search)) return;
                var deskDismissed = false;
                try { deskDismissed = localStorage.getItem('brickBuilderTutorialDismissed') === 'true'; } catch (e2) {}
                if (deskDismissed) return;
                if (!window.__brixViewReady) {
                  setTimeout(showDeskTutorial, 32);
                  return;
                }
                var deskModal = document.getElementById('tutorialModal');
                if (!deskModal || deskModal.dataset.closed === '1') return;
                if (!deskModal.classList.contains('visible')) deskModal.classList.add('visible');
                if (window.controls) window.controls.enabled = false;
              }
              showDeskTutorial();
              if (window.innerWidth <= 768 && !/(?:^#|[?&#])b=/.test(location.hash + location.search)) {
                var dismissed = false;
                try { dismissed = localStorage.getItem('brickBuilderTutorialDismissed') === 'true'; } catch (e) {}
                if (!dismissed) {
                  var card = hold.querySelector('#phoneTutorial');
                  if (card && card.dataset.closed !== '1') {
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
