(function (root) {
  'use strict';
  var READABLE = {
    phonePx: 118,
    tabletPx: 112,
    deskPx: 108,
    zoomMinPhone: 1,
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

  function zoomMin(cssW) {
    return cssW < 720 ? READABLE.zoomMinPhone : READABLE.zoomMinDesk;
  }

  function clampZoom(cssW, zoom) {
    var z = zoom || 1;
    var min = zoomMin(cssW);
    if (z < min) z = min;
    if (z > READABLE.zoomMax) z = READABLE.zoomMax;
    return Math.round(z * 100) / 100;
  }

  function view(cssW, cssH, worldW, worldH, zoom, sprite) {
    cssW = cssW || 800;
    cssH = cssH || 450;
    sprite = sprite || 78;
    zoom = clampZoom(cssW, zoom);
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

  function selfTest() {
    var reasons = [];
    var phone = view(390, 480, 1600, 900, 1, 78);
    if (phone.spritePx < 112) reasons.push('phone sprite ' + phone.spritePx);
    if (phone.productPx < 60) reasons.push('phone product ' + phone.productPx);
    var wide = view(900, 520, 2880, 900, 1, 78);
    var fitted = view(900, 520, 2880, 900, 0.2, 78);
    if (fitted.zoom < 0.88) reasons.push('zoomed out ' + fitted.zoom);
    if (fitted.spritePx + 1 < wide.spritePx * 0.88) reasons.push('shrink ' + fitted.spritePx);
    var grown = view(390, 480, 2880, 900, 1, 78);
    if (Math.round(grown.spritePx) !== Math.round(phone.spritePx)) reasons.push('growth shrink');
    if (!onScreen({ x: 100, y: 100 }, 0, 0, 300, 400, 20)) reasons.push('cull in');
    if (onScreen({ x: 2000, y: 100 }, 0, 0, 300, 400, 20)) reasons.push('cull out');
    var edge = edges(0, 0, 300, 400, 2880, 900);
    if (edge.left || !edge.right) reasons.push('edge');
    return { ok: reasons.length === 0, reason: reasons.join('; '), phone: Math.round(phone.spritePx), product: Math.round(phone.productPx) };
  }

  var api = {
    READABLE: READABLE,
    targetPx: targetPx,
    zoomMin: zoomMin,
    clampZoom: clampZoom,
    view: view,
    onScreen: onScreen,
    edges: edges,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.render = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
