function u(i,l,n){if(i){if(!l.length){i.innerHTML='<div class="gallery-empty">No saved builds yet. Save your first creation!</div>';return}i.innerHTML=l.map((t,e)=>{let a=typeof t.thumbnail=="string"&&t.thumbnail.startsWith("data:image/")?t.thumbnail:"",r=a?`<img src="${a}" alt="">`:'<div class="gallery-thumb-fallback">No preview</div>',o=n(t.name),s=n(String(t.brickCount)),c=Number(t.brickCount)===1?"brick":"bricks",d=n(t.date||"");return`
        <div class="gallery-item" data-index="${e}">
          ${r}
          <div class="gallery-item-info">
            <div class="gallery-item-name">${o}</div>
            <div class="gallery-item-meta">${s} ${c} \u2022 ${d}</div>
          </div>
          <div class="gallery-item-actions">
            <button onclick="loadGalleryBuild(${e})">\u{1F4C2} Load</button>
            <button class="delete" onclick="deleteGalleryBuild(${e})">\u{1F5D1}\uFE0F</button>
          </div>
        </div>`}).join(""),i.querySelectorAll(".gallery-item").forEach(t=>{t.addEventListener("click",e=>{if(e.target.closest("button"))return;let a=Number(t.getAttribute("data-index"));Number.isFinite(a)&&typeof window.loadGalleryBuild=="function"&&window.loadGalleryBuild(a)})})}}export{u as renderGalleryGrid};
