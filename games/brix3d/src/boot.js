function later(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A zero timer is clamped to about 4ms, and those gaps were the slow place
// loads. A channel message is still its own task, so a slice stays under the
// long-task line without waiting out the clamp.
function soon() {
  const channel = soon.channel || (soon.channel = new MessageChannel());
  return new Promise((resolve) => {
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

function afterPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

// Each part is its own module, so parsing it cannot become one long task.
// Yield before a slice passes 6ms, and again after a slow part.
// A 4x Lighthouse CPU lane then stays under the 50ms long-task line.
// The cap is 6ms, not 4, so fewer timer gaps sit on the way to first place.
async function runParts(urls) {
  const times = [];
  let slice = performance.now();
  for (let i = 0; i < urls.length; i++) {
    if (performance.now() - slice >= 6) {
      await soon();
      slice = performance.now();
    }
    const t0 = performance.now();
    await import(urls[i]);
    const dt = performance.now() - t0;
    times.push(Math.round(dt * 10) / 10);
    if (dt >= 6 || performance.now() - slice >= 9) {
      await soon();
      slice = performance.now();
    }
  }
  return times;
}

window.__brixLoadPrefabs = () => import('./prefabs.js');
window.__brixLoadPost = () => import('./post.js');
window.__brixLoadGallery = () => import('./gallery-lazy.js');
window.__brixBootStarted = performance.now();

// Fetch the parts without evaluating them so the later import() calls hit
// the HTTP cache instead of paying one round trip per file.
async function warm(urls) {
  // Starting every fetch in one turn is its own long task. The requests
  // still overlap; only the calls that kick them off are sliced.
  const pending = [];
  let slice = performance.now();
  for (let i = 0; i < urls.length; i++) {
    pending.push(fetch(urls[i]).then((res) => res.arrayBuffer()).catch(() => null));
    // fetch() spends time in the browser after the JS clock moves.
    // Yield on a short clock and a hard count so one slice stays under 10ms.
    if ((i + 1) % 30 === 0 || performance.now() - slice >= 5) {
      await soon();
      slice = performance.now();
    }
  }
  await Promise.all(pending);
}

// Main init looks up #container. The plate host has to be on screen
// before main runs.
async function waitForUi() {
  while (!window.__brixUiShown || !document.getElementById('container')) {
    await later(0);
  }
}

// Part files are a few kilobytes each. On a fast origin they finish
// downloading before the first large text paints, and Lighthouse then
// simulates every one of them as render-blocking. Wait until that text
// has painted, then start the fetches.
async function waitForContentPaint() {
  while (window.__brixContentPainted == null || !window.__BRIX_THREE_PARTS__ || !window.__BRIX_MAIN_PARTS__) {
    await later(0);
  }
}

afterPaint().then(async () => {
  const threeUrls = window.__BRIX_THREE_PARTS__ || [];
  const mainUrls = window.__BRIX_MAIN_PARTS__ || [];
  const extra = window.__BRIX_WARM__ || [];
  await waitForContentPaint();
  await warm(threeUrls.concat(mainUrls, extra));
  const threeTimes = await runParts(threeUrls);
  await waitForUi();
  const orbitMod = await import('./orbit-entry.js');
  globalThis.__BRIX_ORBIT = orbitMod.OrbitControls;
  await later(0);
  const mainTimes = await runParts(mainUrls);
  window.__brixPartTimes = {
    three: threeTimes,
    main: mainTimes,
    done: performance.now()
  };
  // Chrome and the brick catalog lay out text. Doing that between imports
  // turned one small module into a 50ms+ task and pushed time-to-place over
  // 500ms. The place stamp is already set inside main init.
  if (typeof window.__brixStartChrome === 'function') window.__brixStartChrome();
}).catch((err) => {
  console.error(err);
});
