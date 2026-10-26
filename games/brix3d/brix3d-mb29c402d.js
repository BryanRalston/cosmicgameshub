import{__brixScope as e}from"./brix3d-m85d60a29.js";e.createInfiniteGround=function(){const a=96*e.STUD,d=new globalThis.__BRIX_THREE.BoxGeometry(a,e.PLATE_H*.5,a),c=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3582020}),o=new globalThis.__BRIX_THREE.Mesh(d,c);o.position.set(a/2,-e.PLATE_H*.25,a/2),o.receiveShadow=!0,e.scene.add(o);const _=e.makeBaseplateStudTextures(96),n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:_.map}),u=.4343;n.customProgramCacheKey=()=>"plate-stud-disk",n.onBeforeCompile=i=>{i.fragmentShader=i.fragmentShader.replace("#include <map_fragment>",`
          {
            vec2 uvCell = fract(vMapUv);
            float dist = length(uvCell - 0.5);
            float rad = ${e.STUD_R/e.STUD};
            // fwidth of the repeated uv. A clamped 0.0045 edge stayed sharp
            // when a cell was smaller than a pixel and the horizon rang.
            float pixel = max(fwidth(vMapUv).x, fwidth(vMapUv).y);
            float cellPx = 1.0 / max(pixel, 0.0001);
            // Far disks beat into row-sized bands. Soften only that band.
            float far = 1.0 - smoothstep(4.0, 18.0, cellPx);
            float aa = clamp(max(pixel * mix(0.75, 3.2, far), 0.0012), 0.0012, 0.2);
            float disk = 1.0 - smoothstep(rad - aa, rad + aa, dist);
            float fade = smoothstep(1.6, 3.2, cellPx);
            diffuseColor.rgb *= mix(vec3(${u}), vec3(1.0), disk * fade);
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(a,a),n),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(a/2,.012,a/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),o.castShadow=!1;const r=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:1858600});r.polygonOffset=!0,r.polygonOffsetFactor=1,r.polygonOffsetUnits=1;const l=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(a+1.6,e.PLATE_H*.28,a+1.6),r);l.position.set(a/2,-e.PLATE_H*.42,a/2),l.receiveShadow=!0,l.name="plateRim",e.scene.add(l);const h=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),f=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),t=new globalThis.__BRIX_THREE.Mesh(h,f);t.rotation.x=-Math.PI/2,t.position.set(a/2,-.02,a/2),t.receiveShadow=!1,t.userData.isGround=!0,e.scene.add(t),window.grassPlane=t,window.baseplateRef=o,window.groundStudsRef=e.groundStuds,e.createDistantScenery(a);const p=a,E=96,s=new globalThis.__BRIX_THREE.GridHelper(p,E,2059816,2059816);s.position.set(a/2,.002,a/2),s.material.opacity=.15,s.material.transparent=!0,e.scene.add(s),window.gridHelper=s,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
