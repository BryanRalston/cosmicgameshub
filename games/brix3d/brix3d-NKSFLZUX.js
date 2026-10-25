function d(e,n,a){if(e){if(!n.length){e.innerHTML='<div class="gallery-empty">No saved builds yet. Save your first creation!</div>';return}e.innerHTML=n.map((t,i)=>{let l=typeof t.thumbnail=="string"&&t.thumbnail.startsWith("data:image/")?t.thumbnail:"",r=l?`<img src="${l}" alt="">`:'<div class="gallery-thumb-fallback">No preview</div>',s=a(t.name),o=a(String(t.brickCount)),c=a(t.date||"");return`
        <div class="gallery-item" data-index="${i}">
          ${r}
          <div class="gallery-item-info">
            <div class="gallery-item-name">${s}</div>
            <div class="gallery-item-meta">${o} bricks \u2022 ${c}</div>
          </div>
          <div class="gallery-item-actions">
            <button onclick="loadGalleryBuild(${i})">\u{1F4C2} Load</button>
            <button class="delete" onclick="deleteGalleryBuild(${i})">\u{1F5D1}\uFE0F</button>
          </div>
        </div>`}).join("")}}export{d as renderGalleryGrid};
