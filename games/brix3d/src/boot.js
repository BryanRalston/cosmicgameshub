function later(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function afterPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

// Each part is its own module, so parsing it cannot become one long task.
// Yield once a slice has used about 8ms. Lighthouse's 4x CPU lane then
// stays under the 50ms long-task line.
async function runParts(urls) {
  const times = [];
  let slice = performance.now();
  for (let i = 0; i < urls.length; i++) {
    const t0 = performance.now();
    await import(urls[i]);
    times.push(Math.round((performance.now() - t0) * 10) / 10);
    if (performance.now() - slice >= 8) {
      await later(0);
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
function warm(urls) {
  return Promise.all(urls.map((url) => fetch(url).then((res) => res.arrayBuffer()).catch(() => null)));
}

afterPaint().then(async () => {
  const threeUrls = window.__BRIX_THREE_PARTS__ || [];
  const mainUrls = window.__BRIX_MAIN_PARTS__ || [];
  const extra = window.__BRIX_WARM__ || [];
  await warm(threeUrls.concat(mainUrls, extra));
  await later(0);
  const threeTimes = await runParts(threeUrls);
  await later(0);
  const orbitMod = await import('./orbit-entry.js');
  globalThis.__BRIX_ORBIT = orbitMod.OrbitControls;
  await later(0);
  const mainTimes = await runParts(mainUrls);
  window.__brixPartTimes = {
    three: threeTimes,
    main: mainTimes,
    done: performance.now()
  };
}).catch((err) => {
  console.error(err);
});
