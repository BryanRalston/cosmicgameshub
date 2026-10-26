import{__brixScope as e}from"./brix3d-m3b79cb7a.js";e.createInfiniteGround=function(){const t=96*e.STUD,d=new globalThis.__BRIX_THREE.BoxGeometry(t,e.PLATE_H*.5,t),c=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),o=new globalThis.__BRIX_THREE.Mesh(d,c);o.position.set(t/2,-e.PLATE_H*.25,t/2),o.receiveShadow=!0,e.scene.add(o);const f=e.makeBaseplateStudTextures(96),n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:f.map}),_=.4343;n.customProgramCacheKey=()=>"plate-stud-disk",n.onBeforeCompile=i=>{i.fragmentShader=i.fragmentShader.replace("#include <map_fragment>",`
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
            // Disks and the stud green both dissolve while a cell is still
            // many pixels tall. A 2px window turned into a one-pixel shelf
            // where the pattern started.
            float fade = smoothstep(3.0, 16.0, cellPx);
            diffuseColor.rgb *= mix(vec3(${_}), vec3(1.0), disk * fade);
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(96.0 - vMapUv.x, 96.0 - vMapUv.y));
            float edgeFade = smoothstep(0.0, 8.0, edgeStud);
            float farMix = smoothstep(3.0, 16.0, cellPx);
            diffuseColor.rgb = mix(vec3(0.1843, 0.5608, 0.2353), diffuseColor.rgb, edgeFade * farMix);
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(t,t),n),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(t/2,.012,t/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),o.castShadow=!1;const l=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});l.polygonOffset=!0,l.polygonOffsetFactor=1,l.polygonOffsetUnits=1;const r=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(t+1.6,e.PLATE_H*.28,t+1.6),l);r.position.set(t/2,-e.PLATE_H*.42,t/2),r.receiveShadow=!0,r.name="plateRim",e.scene.add(r);const p=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),h=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),a=new globalThis.__BRIX_THREE.Mesh(p,h);a.rotation.x=-Math.PI/2,a.position.set(t/2,-.02,t/2),a.receiveShadow=!1,a.userData.isGround=!0,e.scene.add(a),window.grassPlane=a,window.baseplateRef=o,window.groundStudsRef=e.groundStuds,e.createDistantScenery(t);const u=t,E=96,s=new globalThis.__BRIX_THREE.GridHelper(u,E,2059816,2059816);s.position.set(t/2,.002,t/2),s.material.opacity=.15,s.material.transparent=!0,e.scene.add(s),window.gridHelper=s,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
