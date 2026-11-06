export function renderGalleryGrid(grid, galleryBuilds, escHtml) {
  if (!grid) return;
  if (!galleryBuilds.length) {
    grid.innerHTML = '<div class="gallery-empty">No saved builds yet. Save your first creation!</div>';
    return;
  }
  grid.innerHTML = galleryBuilds.map((build, i) => {
    const safeThumb = typeof build.thumbnail === 'string' && build.thumbnail.startsWith('data:image/')
      ? build.thumbnail
      : '';
    const thumb = safeThumb
      ? `<img src="${safeThumb}" alt="">`
      : '<div class="gallery-thumb-fallback">No preview</div>';
    const name = escHtml(build.name);
    const count = escHtml(String(build.brickCount));
    const word = Number(build.brickCount) === 1 ? 'brick' : 'bricks';
    const date = escHtml(build.date || '');
    return `
        <div class="gallery-item" data-index="${i}">
          ${thumb}
          <div class="gallery-item-info">
            <div class="gallery-item-name">${name}</div>
            <div class="gallery-item-meta">${count} ${word} • ${date}</div>
          </div>
          <div class="gallery-item-actions">
            <button onclick="loadGalleryBuild(${i})">📂 Load</button>
            <button class="delete" onclick="deleteGalleryBuild(${i})">🗑️</button>
          </div>
        </div>`;
  }).join('');
  grid.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const index = Number(item.getAttribute('data-index'));
      if (!Number.isFinite(index)) return;
      if (typeof window.loadGalleryBuild === 'function') window.loadGalleryBuild(index);
    });
  });
}
