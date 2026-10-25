function later() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Split three.js evaluation from the game so they are not one long task.
later()
  .then(() => import('./three-entry.js'))
  .then(() => later())
  .then(() => import('./main.js'))
  .catch((err) => {
    console.error(err);
  });
