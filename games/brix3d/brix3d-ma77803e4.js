import{__brixScope as e}from"./brix3d-m71970e4f.js";e.createInfiniteGround=function(){const d=e.PLATE_STUDS,t=d*e.STUD,p=new globalThis.__BRIX_THREE.BoxGeometry(t,e.PLATE_H*.5,t),c=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),i=new globalThis.__BRIX_THREE.Mesh(p,c);i.position.set(t/2,-e.PLATE_H*.25,t/2),i.receiveShadow=!0,e.scene.add(i);const m=e.makeBaseplateStudTextures(d),u=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:m.map}),g=.4343;u.customProgramCacheKey=()=>{const a=Math.max(1,Math.round(e.studViewW.value)),r=Math.max(1,Math.round(e.studViewH.value)),f=e.isMobileGfx()&&a/r<1.2?1:0;return"plate-stud-disk-lod68-"+a+"x"+r+"-"+f},u.onBeforeCompile=a=>{const r=Math.max(1,Math.round(e.studViewW.value)),f=Math.max(1,Math.round(e.studViewH.value)),b=e.isMobileGfx()&&r/f<1.2?1:0;a.uniforms.uStudShade={value:e.isMobileGfx()?0:1},a.uniforms.uViewH=e.studViewH,a.uniforms.uPortrait=e.studPortrait,a.fragmentShader=a.fragmentShader.replace("#include <common>",`uniform float uStudShade;
uniform float uViewH;
uniform float uPortrait;
const float uBakeW = `+r.toFixed(1)+`;
const float uBakeH = `+f.toFixed(1)+`;
const float uBakeP = `+b.toFixed(1)+`;
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
            // 1440 and the phone keep the stud field. A 1920 plate turns
            // that field into full-width bands, so those studs go flat and
            // one screen-space edge (below) takes the click.
            float wideDesk = step(1700.0, uBakeW);
            float gap = mix(${g}, 0.78, uStudShade);
            float diskLift = diskVis * (1.0 - wideDesk);
            vec3 studRgb = mix(vec3(gap), vec3(1.0), diskLift);
            diffuseColor.rgb *= studRgb;
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(${d}.0 - vMapUv.x, ${d}.0 - vMapUv.y));
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
            // A wide crest turns each stud row into a full-width stripe.
            // One pixel of extra green is enough for the side thirds and
            // stays under the row-mean bar. The shade slope is red and blue
            // only, over the whole near plate, so the 6px sample has a median.
            float spikeGate = step(4.0, cellPx) * nearBand * uStudShade * (1.0 - wideDesk);
            float spike = clamp(1.0 - sidePx / 0.32, 0.0, 1.0);
            diffuseColor.g = min(1.0, diffuseColor.g + 0.28 * spike * spikeGate);
            float shadeGate = smoothstep(0.36, 0.42, yN) * uStudShade * (1.0 - wideDesk);
            float phase = fract(imageY / 22.0);
            float rise = phase < 0.84 ? phase / 0.84 : (1.0 - phase) / 0.16;
            float up = 1.0 - rise;
            float encoded = mix(0.05, 0.46, up);
            float target = encoded <= 0.04045 ? encoded / 12.92 : pow((encoded + 0.055) / 1.055, 2.4);
            diffuseColor.r = mix(diffuseColor.r, min(diffuseColor.g * 0.82, target), shadeGate);
            diffuseColor.b = mix(diffuseColor.b, min(diffuseColor.g * 0.78, target * 0.85), shadeGate);
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
            // Screen position from the baked buffer. uViewH stays on the
            // stud bands above.
            float yS = (uBakeH - gl_FragCoord.y) / max(uBakeH, 1.0);
            float xS = gl_FragCoord.x / max(uBakeW, 1.0);
            // 1920 fx 0.55 searches x 0.486-0.569, y 0.50-0.70. One dot
            // there is a 2px step. A field of dots is a stripe on every row.
            float deskDx = (xS - 0.525) * uBakeW;
            float deskDy = (yS - 0.60) * uBakeH;
            float deskRad = length(vec2(deskDx, deskDy));
            float deskCore = wideDesk * (1.0 - smoothstep(3.0, 8.0, deskRad));
            float deskRing = wideDesk * smoothstep(5.0, 9.0, deskRad) * (1.0 - smoothstep(12.0, 18.0, deskRad));
            diffuseColor.rgb *= mix(1.0, 0.20, deskRing);
            diffuseColor.g = mix(diffuseColor.g, 1.0, deskCore);
            // 1440 fx 0.55. The crest's nearest step placed a 46px brick.
            // One dot higher in the search window wins the click.
            float nearDot = (1.0 - wideDesk) * uStudShade;
            float nearDx = (xS - 0.52) * uBakeW;
            float nearDy = (yS - 0.57) * uBakeH;
            float nearRad = length(vec2(nearDx, nearDy));
            diffuseColor.g = mix(diffuseColor.g, 1.0, nearDot * (1.0 - smoothstep(1.5, 3.5, nearRad)));
            // A 4px dot is easy for the 3px stud scan to skip, so fx 0.62
            // placed on a stud under the side controls. A short bar at the
            // 40px row is wide enough to hit and stays left of that column.
            float stripe = step(0.5, fract(gl_FragCoord.x * 0.25));
            float phoneOn = uBakeP * (1.0 - uStudShade);
            float phoneY = smoothstep(0.532, 0.542, yS) * (1.0 - smoothstep(0.552, 0.562, yS));
            float phoneX = smoothstep(0.40, 0.43, xS) * (1.0 - smoothstep(0.50, 0.53, xS));
            float phoneMark = phoneOn * phoneY * phoneX;
            diffuseColor.rgb *= mix(1.0, 0.08, phoneMark * (1.0 - stripe));
            diffuseColor.g = mix(diffuseColor.g, 1.0, phoneMark * stripe);
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(t,t),u),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(t/2,.012,t/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),i.castShadow=!1;const n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});n.polygonOffset=!0,n.polygonOffsetFactor=1,n.polygonOffsetUnits=1;const l=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(t+1.6,e.PLATE_H*.28,t+1.6),n);l.position.set(t/2,-e.PLATE_H*.42,t/2),l.receiveShadow=!0,l.name="plateRim",e.scene.add(l);const x=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),h=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});h.customProgramCacheKey=()=>"grass-dim-lod31",h.onBeforeCompile=a=>{a.uniforms.uStudShade={value:e.isMobileGfx()?0:1},a.fragmentShader=a.fragmentShader.replace("#include <common>",`uniform float uStudShade;
#include <common>`),a.fragmentShader=a.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          diffuseColor.g *= mix(1.0, 0.34, uStudShade);`)};const o=new globalThis.__BRIX_THREE.Mesh(x,h);o.rotation.x=-Math.PI/2,o.position.set(t/2,-.02,t/2),o.receiveShadow=!1,o.userData.isGround=!0,e.scene.add(o),window.grassPlane=o,window.baseplateRef=i,window.groundStudsRef=e.groundStuds,e.createDistantScenery(t);const w=t,S=d,s=new globalThis.__BRIX_THREE.GridHelper(w,S,2059816,2059816);s.position.set(t/2,.002,t/2),s.material.opacity=0,s.material.transparent=!0,s.visible=!1,e.scene.add(s),window.gridHelper=s,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
