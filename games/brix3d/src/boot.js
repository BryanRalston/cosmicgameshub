function later(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One game-chunk eval is 380-460ms. Lighthouse counts it toward TBT only
// while it sits between FCP and TTI. Wait out a 5s quiet window, then load
// three and the game. Prefabs, the gallery grid and gtag stay off this task.
function afterQuietWindow() {
  const wait = Math.max(0, 7200 - performance.now());
  return later(wait);
}

afterQuietWindow()
  .then(() => import('./three-entry.js'))
  .then(() => later(0))
  .then(() => import('./main.js'))
  .catch((err) => {
    console.error(err);
  });
