(function (root) {
  'use strict';
  var READABLE = {
    phonePx: 118,
    tabletPx: 112,
    deskPx: 108,
    zoomMinPhone: 0.4,
    zoomMinDesk: 0.88,
    zoomMax: 1.7,
    productW: 46,
    productH: 54
  };

  function targetPx(cssW) {
    if (cssW < 520) return READABLE.phonePx;
    if (cssW < 900) return READABLE.tabletPx;
    return READABLE.deskPx;
  }

  function widthZoom(cssW, worldW, sprite) {
    worldW = worldW || 1280;
    sprite = sprite || 78;
    var target = targetPx(cssW || 390);
    var z = sprite * (cssW || 390) / target / worldW;
    if (!(z > 0)) z = 0.2;
    return Math.round(z * 100) / 100;
  }

  function zoomMin(cssW, cssH) {
    var fit = frameZoom(cssW, cssH || 540, 1280, 900, 78);
    if (!(fit > 0)) fit = 0.4;
    if (cssW < 720) {
      var wide = widthZoom(cssW, 1280, 78);
      var z = Math.min(fit, wide);
      if (z < 0.16) z = 0.16;
      return Math.round(z * 100) / 100;
    }
    if (fit < 0.4) fit = 0.4;
    return fit;
  }

  function clampZoom(cssW, zoom, cssH) {
    var z = zoom || 1;
    var min = zoomMin(cssW, cssH);
    if (z < min) z = min;
    if (z > READABLE.zoomMax) z = READABLE.zoomMax;
    return Math.round(z * 100) / 100;
  }

  function frameZoom(cssW, cssH, worldW, worldH, sprite) {
    cssW = cssW || 390;
    cssH = cssH || 480;
    worldH = worldH || 900;
    sprite = sprite || 78;
    var target = targetPx(cssW);
    var z = sprite * cssH / target / worldH;
    if (!(z > 0)) z = 0.35;
    if (z > READABLE.zoomMax) z = READABLE.zoomMax;
    return Math.round(z * 100) / 100;
  }

  function view(cssW, cssH, worldW, worldH, zoom, sprite, fit) {
    cssW = cssW || 800;
    cssH = cssH || 450;
    sprite = sprite || 78;
    zoom = fit ? (zoom || 1) : clampZoom(cssW, zoom, cssH);
    var target = targetPx(cssW);
    var viewW = sprite * cssW / target / zoom;
    var viewH = viewW * cssH / cssW;
    if (viewW > worldW) {
      viewW = worldW;
      viewH = viewW * cssH / cssW;
    }
    if (viewH > worldH) {
      viewH = worldH;
      viewW = Math.min(worldW, viewH * cssW / cssH);
    }
    var spritePx = sprite * cssW / viewW;
    var productPx = READABLE.productW * cssW / viewW;
    return {
      viewW: viewW,
      viewH: viewH,
      cssW: cssW,
      cssH: cssH,
      spritePx: spritePx,
      productPx: productPx,
      zoom: zoom
    };
  }

  function onScreen(actor, camX, camY, viewW, viewH, margin) {
    var pad = margin == null ? 140 : margin;
    return actor.x > camX - pad && actor.x < camX + viewW + pad && actor.y > camY - pad && actor.y < camY + viewH + pad;
  }

  function edges(camX, camY, viewW, viewH, worldW, worldH) {
    return {
      left: camX > 12,
      right: camX + viewW < worldW - 12,
      up: camY > 12,
      down: camY + viewH < worldH - 12
    };
  }

  // Mid-phone fragment budget after bandwidth, about 144 MP/s. Not a Mali or Adreno counter.
  var FILL_BUDGET = 2400000;
  var QUALITY = [
    { tier: 0, dpr: 0.5, glows: 0, fullSprites: 16, shed: true },
    { tier: 1, dpr: 1, glows: 0, fullSprites: 28, shed: false },
    { tier: 2, dpr: 1, glows: 6, fullSprites: 80, shed: false },
    { tier: 3, dpr: 2, glows: 24, fullSprites: 999, shed: false }
  ];

  function fillPx(tier, cssW, cssH, spritePx, shown) {
    var q = QUALITY[tier] || QUALITY[0];
    var plate = cssW * cssH * q.dpr * q.dpr;
    var sprites = Math.min(shown, q.fullSprites) * spritePx * spritePx;
    var blobs = Math.max(0, shown - q.fullSprites) * 144;
    return plate + plate * 0.35 + sprites + q.glows * 96 * 96 + blobs;
  }

  function adapt(state) {
    state = state || {};
    var tier = state.tier == null ? 3 : state.tier;
    if (tier < 0) tier = 0;
    if (tier > 3) tier = 3;
    var hot = state.hot || 0;
    var cool = state.cool || 0;
    var cssW = state.cssW || 1280;
    var cssH = state.cssH || 800;
    var spritePx = state.spritePx || 108;
    var shown = state.shown == null ? 8 : state.shown;
    var frameMs = state.frameMs || 0;
    var fill = fillPx(tier, cssW, cssH, spritePx, shown);
    var reason = 'hold';
    var over = fill > FILL_BUDGET || frameMs > 18;
    if (over) {
      hot += 1;
      cool = 0;
      if (hot >= 3 && tier > 0) {
        tier -= 1;
        hot = 0;
        reason = 'down';
        fill = fillPx(tier, cssW, cssH, spritePx, shown);
      } else if (hot >= 3) reason = 'floor';
      else reason = 'hot';
    } else {
      cool += 1;
      hot = 0;
      if (cool >= 18 && tier < 3 && frameMs <= 15) {
        var nextFill = fillPx(tier + 1, cssW, cssH, spritePx, shown);
        if (nextFill <= FILL_BUDGET) {
          tier += 1;
          cool = 0;
          reason = 'up';
          fill = nextFill;
        } else reason = 'budget';
      } else if (cool >= 18 && frameMs > 15) reason = 'pace';
      else if (cool >= 18) reason = 'ceil';
      else reason = 'cool';
    }
    var q = QUALITY[tier];
    return {
      tier: tier,
      fill: Math.round(fill),
      budget: FILL_BUDGET,
      hot: hot,
      cool: cool,
      dpr: q.dpr,
      glows: q.glows,
      fullSprites: q.fullSprites,
      shed: q.shed,
      reason: reason
    };
  }

  function stepAdapt(state) {
    var next = adapt(state);
    next.cssW = state.cssW;
    next.cssH = state.cssH;
    next.spritePx = state.spritePx;
    next.shown = state.shown;
    next.frameMs = state.frameMs;
    return next;
  }

  function selfTest() {
    var reasons = [];
    var phone = view(390, 480, 1600, 900, 1, 78);
    if (phone.spritePx < 112) reasons.push('phone sprite ' + phone.spritePx);
    if (phone.productPx < 60) reasons.push('phone product ' + phone.productPx);
    var wide = view(900, 520, 2880, 900, 1, 78);
    var deskFloor = zoomMin(900, 520);
    var fitted = view(900, 520, 2880, 900, 0.2, 78);
    if (Math.abs(fitted.zoom - deskFloor) > 0.001) reasons.push('zoomed out ' + fitted.zoom);
    if (!(deskFloor < 0.7 && deskFloor + 0.001 >= 0.4)) reasons.push('desk floor ' + deskFloor);
    if (fitted.spritePx < 40) reasons.push('desk far ' + Math.round(fitted.spritePx));
    if (!(wide.spritePx > fitted.spritePx)) reasons.push('desk zoom');
    var grown = view(390, 480, 2880, 900, 1, 78);
    if (Math.round(grown.spritePx) !== Math.round(phone.spritePx)) reasons.push('growth shrink');
    var phoneMin = view(390, 480, 1600, 900, 0.2, 78);
    if (Math.abs(phoneMin.zoom - 0.2) > 0.02) reasons.push('phone zoom ' + phoneMin.zoom);
    if (phoneMin.spritePx < 40) reasons.push('phone far ' + Math.round(phoneMin.spritePx));
    var phoneWideH = Math.round(390 * 900 / 1280);
    var phoneWide = view(390, phoneWideH, 1280, 900, 0.05, 78);
    if (phoneWide.viewW < 1270) reasons.push('phone width ' + Math.round(phoneWide.viewW));
    if (phoneWide.viewH < 860) reasons.push('phone height ' + Math.round(phoneWide.viewH));
    var phoneFit = frameZoom(390, 540, 1280, 900, 78);
    if (Math.abs(phoneFit - READABLE.zoomMinPhone) > 0.001) reasons.push('phone fit ' + phoneFit);
    var fitZ = frameZoom(390, 480, 1600, 900, 78);
    var framed = view(390, 480, 1600, 900, fitZ, 78, true);
    if (framed.viewH < 775) reasons.push('frame ' + Math.round(framed.viewH));
    if (fitZ >= 1) reasons.push('frame zoom ' + fitZ);
    if (!onScreen({ x: 100, y: 100 }, 0, 0, 300, 400, 20)) reasons.push('cull in');
    if (onScreen({ x: 2000, y: 100 }, 0, 0, 300, 400, 20)) reasons.push('cull out');
    var edge = edges(0, 0, 300, 400, 2880, 900);
    if (edge.left || !edge.right) reasons.push('edge');
    var crowd = { tier: 3, hot: 0, cool: 0, cssW: 1280, cssH: 800, spritePx: 108, shown: 150, frameMs: 16 };
    var steps = 0;
    while (steps < 8) {
      crowd = stepAdapt(crowd);
      steps++;
    }
    if (!(crowd.tier < 3)) reasons.push('crowd tier ' + crowd.tier);
    if (crowd.fill > FILL_BUDGET) reasons.push('crowd fill ' + crowd.fill);
    var quiet = { tier: 3, hot: 0, cool: 0, cssW: 390, cssH: 700, spritePx: 118, shown: 8, frameMs: 10 };
    var qsteps = 0;
    while (qsteps < 8) {
      quiet = stepAdapt(quiet);
      qsteps++;
    }
    if (quiet.tier !== 3) reasons.push('quiet tier ' + quiet.tier);
    var hotPhone = { tier: 3, hot: 0, cool: 0, cssW: 390, cssH: 700, spritePx: 118, shown: 8, frameMs: 32 };
    var hsteps = 0;
    while (hsteps < 20) {
      hotPhone = stepAdapt(hotPhone);
      hsteps++;
    }
    if (hotPhone.tier !== 0 || !hotPhone.shed) reasons.push('hot phone ' + hotPhone.tier);
    return { ok: reasons.length === 0, reason: reasons.join('; '), phone: Math.round(phone.spritePx), product: Math.round(phone.productPx) };
  }

  var api = {
    READABLE: READABLE,
    targetPx: targetPx,
    zoomMin: zoomMin,
    widthZoom: widthZoom,
    clampZoom: clampZoom,
    frameZoom: frameZoom,
    view: view,
    onScreen: onScreen,
    edges: edges,
    FILL_BUDGET: FILL_BUDGET,
    fillPx: fillPx,
    adapt: adapt,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.render = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
