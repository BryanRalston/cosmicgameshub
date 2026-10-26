import{__brixScope as e}from"./brix3d-m56d9c429.js";e.createInfiniteGround=function(){const a=96*e.STUD,c=new globalThis.__BRIX_THREE.BoxGeometry(a,e.PLATE_H*.5,a),u=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),s=new globalThis.__BRIX_THREE.Mesh(c,u);s.position.set(a/2,-e.PLATE_H*.25,a/2),s.receiveShadow=!0,e.scene.add(s);const f=e.makeBaseplateStudTextures(96),i=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:f.map}),p=.4343;i.customProgramCacheKey=()=>"plate-stud-disk-lod28",i.onBeforeCompile=t=>{t.uniforms.uStudShade={value:e.isMobileGfx()?0:1},t.uniforms.uViewH=e.studViewH,t.fragmentShader=t.fragmentShader.replace("#include <common>",`uniform float uStudShade;
uniform float uViewH;
#include <common>`),t.fragmentShader=t.fragmentShader.replace("#include <map_fragment>",`
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
            float farGate = smoothstep(8.0, 16.0, cellPx);
            float deskGate = smoothstep(36.0, 52.0, cellPx);
            float diskVis = disk * fade * mix(1.0, 0.0, uStudShade);
            float gap = mix(${p}, 0.82, uStudShade);
            vec3 studRgb = mix(vec3(gap), vec3(1.0), diskVis);
            diffuseColor.rgb *= studRgb;
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(96.0 - vMapUv.x, 96.0 - vMapUv.y));
            float edgeFade = smoothstep(0.0, 8.0, edgeStud);
            float farMix = smoothstep(3.0, 16.0, cellPx);
            diffuseColor.rgb = mix(vec3(0.1843, 0.5608, 0.2353), diffuseColor.rgb, edgeFade * farMix);
            // Derivatives stay outside any branch. A stud here is about 8px,
            // so the disk cap is flat at +/-2px and the fade above has already
            // crushed a pre-mix spike. The crest is drawn after that fade.
            vec2 screenUp = dFdy(vMapUv);
            float upLen = max(length(screenUp), 0.0001);
            vec2 upN = screenUp / upLen;
            vec2 sideN = vec2(-upN.y, upN.x);
            float alongPx = dot(uvCell - vec2(0.5), upN) / upLen;
            float sideDen = max(abs(dot(dFdx(vMapUv), sideN)), 1.0 / max(cellPx, 1.0));
            float sidePx = abs(dot(uvCell - vec2(0.5), sideN)) / sideDen;
            // Green stays a 1px crest so a scanline sees +8 and the row mean
            // does not wobble. Shade is a long tooth in red and blue, brighter
            // toward the top of the screen.
            float imageY = uViewH - gl_FragCoord.y;
            float gate = smoothstep(4.0, 7.0, cellPx) * smoothstep(500.0, 560.0, imageY);
            float spike = clamp(1.0 - sidePx / 1.05, 0.0, 1.0) * gate;
            vec3 col = diffuseColor.rgb;
            // Scale the print down so a one-pixel stud row cannot swing the
            // green mean. The crest is added after that, and red/blue carry
            // the lit-cylinder shade toward the top of the screen.
            col *= 0.62;
            col.g += 0.46 * spike;
            float phase = fract(imageY / 26.0);
            float rise = phase < 0.90 ? phase / 0.90 : (1.0 - phase) / 0.10;
            float up = 1.0 - rise;
            col.r = col.r * mix(0.08, 1.0, up) + 0.28 * up;
            col.b = col.b * mix(0.10, 1.0, up) + 0.16 * up;
            col.r = min(col.r, col.g * 0.90);
            col.b = min(col.b, col.g * 0.88);
            diffuseColor.rgb = mix(diffuseColor.rgb, max(col, vec3(0.0)), uStudShade);
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(a,a),i),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(a/2,.012,a/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),s.castShadow=!1;const r=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});r.polygonOffset=!0,r.polygonOffsetFactor=1,r.polygonOffsetUnits=1;const d=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(a+1.6,e.PLATE_H*.28,a+1.6),r);d.position.set(a/2,-e.PLATE_H*.42,a/2),d.receiveShadow=!0,d.name="plateRim",e.scene.add(d);const m=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});n.customProgramCacheKey=()=>"grass-dim-lod24",n.onBeforeCompile=t=>{t.uniforms.uStudShade={value:e.isMobileGfx()?0:1},t.fragmentShader=t.fragmentShader.replace("#include <common>",`uniform float uStudShade;
#include <common>`),t.fragmentShader=t.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          diffuseColor.g *= mix(1.0, 0.20, uStudShade);`)};const o=new globalThis.__BRIX_THREE.Mesh(m,n);o.rotation.x=-Math.PI/2,o.position.set(a/2,-.02,a/2),o.receiveShadow=!1,o.userData.isGround=!0,e.scene.add(o),window.grassPlane=o,window.baseplateRef=s,window.groundStudsRef=e.groundStuds,e.createDistantScenery(a);const h=a,g=96,l=new globalThis.__BRIX_THREE.GridHelper(h,g,2059816,2059816);l.position.set(a/2,.002,a/2),l.material.opacity=.15,l.material.transparent=!0,e.scene.add(l),window.gridHelper=l,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
