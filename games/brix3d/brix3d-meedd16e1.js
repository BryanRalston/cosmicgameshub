import{__brixScope as e}from"./brix3d-m3a43665d.js";e.createInfiniteGround=function(){const t=96*e.STUD,d=new globalThis.__BRIX_THREE.BoxGeometry(t,e.PLATE_H*.5,t),c=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),s=new globalThis.__BRIX_THREE.Mesh(d,c);s.position.set(t/2,-e.PLATE_H*.25,t/2),s.receiveShadow=!0,e.scene.add(s);const f=e.makeBaseplateStudTextures(96),n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:f.map}),u=.4343;n.customProgramCacheKey=()=>"plate-stud-disk-cap3",n.onBeforeCompile=o=>{o.uniforms.uStudShade={value:e.isMobileGfx()?0:1},o.uniforms.uViewH=e.studViewH,o.fragmentShader=o.fragmentShader.replace("#include <common>",`uniform float uStudShade;
uniform float uViewH;
#include <common>`),o.fragmentShader=o.fragmentShader.replace("#include <map_fragment>",`
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
            // On the desktop home ray a far cell is a one-pixel edge and
            // wins the click, so the brick there is a speck. Wide and phone
            // keep the original disk.
            float diskVis = disk * fade * mix(1.0, smoothstep(8.0, 16.0, cellPx), uStudShade);
            diffuseColor.rgb *= mix(vec3(${u}), vec3(1.0), diskVis);
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(96.0 - vMapUv.x, 96.0 - vMapUv.y));
            float edgeFade = smoothstep(0.0, 8.0, edgeStud);
            float farMix = smoothstep(3.0, 16.0, cellPx);
            diffuseColor.rgb = mix(vec3(0.1843, 0.5608, 0.2353), diffuseColor.rgb, edgeFade * farMix);
            // Four-pixel rows. The crest sits on the checker sample, and the
            // row above it is brighter than the row below, so the stud reads
            // as a lit cylinder. Desktop only, and only below the moire band.
            float imageY = uViewH - gl_FragCoord.y;
            float row = mod(imageY, 4.0);
            float rowLit = row < 1.0 ? 0.62 : row < 2.0 ? 0.70 : row < 3.0 ? 1.22 : 1.12;
            float inBand = step(uViewH * 0.44, imageY);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(rowLit), uStudShade * inBand);
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(t,t),n),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(t/2,.012,t/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),s.castShadow=!1;const l=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});l.polygonOffset=!0,l.polygonOffsetFactor=1,l.polygonOffsetUnits=1;const r=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(t+1.6,e.PLATE_H*.28,t+1.6),l);r.position.set(t/2,-e.PLATE_H*.42,t/2),r.receiveShadow=!0,r.name="plateRim",e.scene.add(r);const h=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),p=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),a=new globalThis.__BRIX_THREE.Mesh(h,p);a.rotation.x=-Math.PI/2,a.position.set(t/2,-.02,t/2),a.receiveShadow=!1,a.userData.isGround=!0,e.scene.add(a),window.grassPlane=a,window.baseplateRef=s,window.groundStudsRef=e.groundStuds,e.createDistantScenery(t);const m=t,g=96,i=new globalThis.__BRIX_THREE.GridHelper(m,g,2059816,2059816);i.position.set(t/2,.002,t/2),i.material.opacity=.15,i.material.transparent=!0,e.scene.add(i),window.gridHelper=i,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
