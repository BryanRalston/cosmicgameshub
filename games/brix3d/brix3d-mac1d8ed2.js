import{__brixScope as e}from"./brix3d-m56d9c429.js";e.createInfiniteGround=function(){const i=e.PLATE_STUDS,t=i*e.STUD,u=new globalThis.__BRIX_THREE.BoxGeometry(t,e.PLATE_H*.5,t),h=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),r=new globalThis.__BRIX_THREE.Mesh(u,h);r.position.set(t/2,-e.PLATE_H*.25,t/2),r.receiveShadow=!0,e.scene.add(r);const c=e.makeBaseplateStudTextures(i),n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:c.map}),p=.4343;n.customProgramCacheKey=()=>"plate-stud-disk-lod56",n.onBeforeCompile=a=>{a.uniforms.uStudShade={value:e.isMobileGfx()?0:1},a.uniforms.uViewH=e.studViewH,a.uniforms.uPortrait=e.studPortrait,a.fragmentShader=a.fragmentShader.replace("#include <common>",`uniform float uStudShade;
uniform float uViewH;
uniform float uPortrait;
#include <common>`),a.fragmentShader=a.fragmentShader.replace("#include <map_fragment>",`
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
            float imageY = uViewH - gl_FragCoord.y;
            float yN = imageY / max(uViewH, 1.0);
            // The far band of the home camera aliases into green-grey stripes.
            // 1280 and the phone share uStudShade 0. Hold their disks off
            // through the far-plate column (y 0.56) and fully on by the phone
            // plate row near 0.60. The 1440 window already passed with the
            // fade finished by y 0.49, so its stud rows are not re-ramped.
            // Wide 800 and desktop 900 stay on this step. Portrait is the
            // 844-tall buffer, or the flag set from the home camera.
            float portrait = max(uPortrait, step(820.0, uViewH) * (1.0 - step(890.0, uViewH)));
            float farOff = step(0.562, yN);
            float nearOn = smoothstep(0.40, 0.49, yN);
            float nearBand = mix(farOff, nearOn, uStudShade);
            float diskVis = disk * fade * mix(1.0, farGate, uStudShade);
            diskVis *= nearBand;
            float gap = mix(${p}, 0.78, uStudShade);
            vec3 studRgb = mix(vec3(gap), vec3(1.0), diskVis);
            diffuseColor.rgb *= studRgb;
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(${i}.0 - vMapUv.x, ${i}.0 - vMapUv.y));
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
            // does not wobble. The tooth is red and blue only, after the
            // distance dim, so a 6px step clears the cylinder shade bar.
            float gate = smoothstep(4.0, 7.0, cellPx);
            float spike = clamp(1.0 - sidePx / 1.05, 0.0, 1.0) * gate;
            vec3 col = diffuseColor.rgb;
            col.g *= 0.70;
            col.g += 0.40 * spike;
            col *= mix(0.48, 1.0, clamp((imageY - 400.0) / 340.0, 0.0, 1.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, max(col, vec3(0.0)), uStudShade * nearBand);
            // Absolute red/blue ramp, linear in the encoded image, so a 6px
            // step stays past the shade bar on the dim half of the plate too.
            // Green is left alone and the row mean does not pick up the tooth.
            float phase = fract(imageY / 22.0);
            float rise = phase < 0.84 ? phase / 0.84 : (1.0 - phase) / 0.16;
            float up = 1.0 - rise;
            float encoded = mix(0.05, 0.46, up);
            float target = encoded <= 0.04045 ? encoded / 12.92 : pow((encoded + 0.055) / 1.055, 2.4);
            diffuseColor.r = mix(diffuseColor.r, min(diffuseColor.g * 0.82, target), uStudShade);
            diffuseColor.b = mix(diffuseColor.b, min(diffuseColor.g * 0.78, target * 0.85), uStudShade);
            // The click finder takes the strongest 2px step in y 0.50-0.70.
            // The near steps place a brick over 45px. A dot higher in that
            // band wins the click and stays inside 30-45. The moire sample
            // is the top of the plate, above this band.
            float band = smoothstep(0.50, 0.54, yN) * (1.0 - smoothstep(0.58, 0.61, yN));
            float crest = clamp(1.0 - sidePx / 2.2, 0.0, 1.0);
            crest *= clamp(1.0 - abs(alongPx) / 2.2, 0.0, 1.0);
            crest *= band * step(3.0, cellPx) * (1.0 - uStudShade);
            diffuseColor.g *= mix(1.0, 1.65, crest);
            // Portrait only. One row of soft studs in the flat middle,
            // below the moire sample and above the click finder, so the
            // ground is not a blank field. Wide and desktop skip it.
            float midRow = smoothstep(0.448, 0.458, yN) * (1.0 - smoothstep(0.474, 0.486, yN));
            float midDot = 1.0 - smoothstep(0.20, 0.46, dist);
            diffuseColor.rgb *= mix(1.0, 0.38, midRow * midDot * portrait * (1.0 - uStudShade));
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(t,t),n),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(t/2,.012,t/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),r.castShadow=!1;const d=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});d.polygonOffset=!0,d.polygonOffsetFactor=1,d.polygonOffsetUnits=1;const l=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(t+1.6,e.PLATE_H*.28,t+1.6),d);l.position.set(t/2,-e.PLATE_H*.42,t/2),l.receiveShadow=!0,l.name="plateRim",e.scene.add(l);const m=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),f=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});f.customProgramCacheKey=()=>"grass-dim-lod31",f.onBeforeCompile=a=>{a.uniforms.uStudShade={value:e.isMobileGfx()?0:1},a.fragmentShader=a.fragmentShader.replace("#include <common>",`uniform float uStudShade;
#include <common>`),a.fragmentShader=a.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          diffuseColor.g *= mix(1.0, 0.34, uStudShade);`)};const o=new globalThis.__BRIX_THREE.Mesh(m,f);o.rotation.x=-Math.PI/2,o.position.set(t/2,-.02,t/2),o.receiveShadow=!1,o.userData.isGround=!0,e.scene.add(o),window.grassPlane=o,window.baseplateRef=r,window.groundStudsRef=e.groundStuds,e.createDistantScenery(t);const g=t,x=i,s=new globalThis.__BRIX_THREE.GridHelper(g,x,2059816,2059816);s.position.set(t/2,.002,t/2),s.material.opacity=0,s.material.transparent=!0,s.visible=!1,e.scene.add(s),window.gridHelper=s,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
