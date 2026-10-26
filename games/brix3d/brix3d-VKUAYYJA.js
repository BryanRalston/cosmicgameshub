function m(e,i,a){if(e){if(!i.length){e.innerHTML='<div class="gallery-empty">No saved builds yet. Save your first creation!</div>';return}e.innerHTML=i.map((t,n)=>{let r=typeof t.thumbnail=="string"&&t.thumbnail.startsWith("data:image/")?t.thumbnail:"",l=r?`<img src="${r}" alt="">`:'<div class="gallery-thumb-fallback">No preview</div>',s=a(t.name),o=a(String(t.brickCount)),c=Number(t.brickCount)===1?"brick":"bricks",d=a(t.date||"");return`
        <div class="gallery-item" data-index="${n}">
          ${l}
          <div class="gallery-item-info">
            <div class="gallery-item-name">${s}</div>
            <div class="gallery-item-meta">${o} ${c} \u2022 ${d}</div>
          </div>
          <div class="gallery-item-actions">
            <button onclick="loadGalleryBuild(${n})">\u{1F4C2} Load</button>
            <button class="delete" onclick="deleteGalleryBuild(${n})">\u{1F5D1}\uFE0F</button>
          </div>
        </div>`}).join("")}}export{m as renderGalleryGrid};
