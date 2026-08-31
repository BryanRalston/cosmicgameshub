/* Tiny shared SFX + juice + share-card. Mute: localStorage.cg_mute */
(function (w) {
  'use strict';
  var mute = false;
  try { mute = localStorage.getItem('cg_mute') === '1'; } catch (e) {}
  var ctx = null;

  function ac() {
    if (!ctx) {
      try { ctx = new (w.AudioContext || w.webkitAudioContext)(); } catch (e) {}
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  function beep(freq, dur, type, vol, slide) {
    if (mute) return;
    var a = ac();
    if (!a) return;
    var o = a.createOscillator();
    var g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.07, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur + 0.02);
  }

  var kit = {
    place: function () { beep(520, 0.06, 'triangle', 0.07); beep(780, 0.05, 'sine', 0.035); },
    correct: function () {
      beep(660, 0.07, 'triangle', 0.08);
      setTimeout(function () { beep(880, 0.11, 'sine', 0.06); }, 60);
    },
    miss: function () { beep(190, 0.16, 'square', 0.045, 88); },
    share: function () {
      beep(523, 0.07, 'sine', 0.055);
      setTimeout(function () { beep(659, 0.1, 'sine', 0.055); }, 70);
    },
    tick: function () { beep(920, 0.025, 'sine', 0.03); }
  };

  function play(name) { if (kit[name]) kit[name](); }
  function haptic(ms) { try { if (!mute && navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {} }
  function setMuted(v) {
    mute = !!v;
    try { localStorage.setItem('cg_mute', mute ? '1' : '0'); } catch (e) {}
  }
  function juice(el, kind) {
    if (!el) return;
    var cls = kind === 'miss' ? 'cg-shake' : (kind === 'flash' ? 'cg-flash' : 'cg-pop');
    el.classList.remove('cg-pop', 'cg-shake', 'cg-flash');
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function injectCss() {
    if (document.getElementById('cg-sfx-css')) return;
    var s = document.createElement('style');
    s.id = 'cg-sfx-css';
    s.textContent = [
      '@keyframes cgPop{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}',
      '@keyframes cgShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}',
      '@keyframes cgFlash{0%{box-shadow:0 0 0 0 rgba(0,212,255,.55)}100%{box-shadow:0 0 0 14px rgba(0,212,255,0)}}',
      '.cg-pop{animation:cgPop .26s cubic-bezier(.2,1.5,.3,1)}',
      '.cg-shake{animation:cgShake .28s ease}',
      '.cg-flash{animation:cgFlash .42s ease}'
    ].join('');
    document.head.appendChild(s);
  }

  function shareCard(opts) {
    opts = opts || {};
    var title = opts.title || 'CosmicGamesHub';
    var sub = opts.subtitle || '';
    var lines = opts.lines || [];
    var grid = opts.grid || '';
    var url = opts.url || 'cosmicgameshub.com/games/daily';
    var canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    var c = canvas.getContext('2d');
    c.fillStyle = '#09090f';
    c.fillRect(0, 0, 1080, 1080);
    var gdt = c.createLinearGradient(0, 0, 1080, 800);
    gdt.addColorStop(0, 'rgba(0,212,255,0.16)');
    gdt.addColorStop(1, 'rgba(168,85,247,0.08)');
    c.fillStyle = gdt;
    c.fillRect(0, 0, 1080, 1080);
    c.fillStyle = '#00d4ff';
    c.fillRect(0, 0, 1080, 10);
    c.font = '700 28px Outfit, system-ui, sans-serif';
    c.fillStyle = '#00d4ff';
    c.fillText('COSMICGAMESHUB', 72, 96);
    c.fillStyle = '#ffffff';
    c.font = '900 64px Outfit, system-ui, sans-serif';
    c.fillText(title, 72, 180);
    c.fillStyle = '#a8a8c0';
    c.font = '500 28px Outfit, system-ui, sans-serif';
    c.fillText(sub, 72, 230);
    var y = 300;
    if (grid) {
      c.font = '48px ui-monospace, monospace';
      c.fillStyle = '#ffffff';
      grid.split('\n').forEach(function (row) {
        c.fillText(row, 72, y);
        y += 64;
      });
      y += 20;
    }
    c.font = '600 32px Outfit, system-ui, sans-serif';
    lines.forEach(function (ln) {
      c.fillStyle = '#ffffff';
      c.fillText(ln, 72, y);
      y += 48;
    });
    c.fillStyle = '#00d4ff';
    c.font = '700 26px Outfit, system-ui, sans-serif';
    c.fillText(url, 72, 1032);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve({
          canvas: canvas,
          blob: blob,
          url: blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')
        });
      }, 'image/png');
    });
  }

  function shareNow(opts) {
    opts = opts || {};
    play('share');
    var text = opts.text || '';
    if (text && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
    return shareCard(opts).then(function (card) {
      if (card && card.url) {
        var a = document.createElement('a');
        a.href = card.url;
        a.download = (opts.filename || 'cosmicgameshub-daily') + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return card;
    });
  }

  document.addEventListener('pointerdown', function () { ac(); }, { once: true });
  injectCss();

  w.CGSfx = {
    play: play,
    haptic: haptic,
    setMuted: setMuted,
    isMuted: function () { return mute; },
    juice: juice,
    shareCard: shareCard,
    shareNow: shareNow,
    unlock: ac
  };
})(window);
