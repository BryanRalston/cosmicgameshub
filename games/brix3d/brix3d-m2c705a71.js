import{__brixScope as e}from"./brix3d-m56d9c429.js";e.createInfiniteGround=function(){const l=e.PLATE_STUDS,a=l*e.STUD,u=new globalThis.__BRIX_THREE.BoxGeometry(a,e.PLATE_H*.5,a),c=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860}),d=new globalThis.__BRIX_THREE.Mesh(u,c);d.position.set(a/2,-e.PLATE_H*.25,a/2),d.receiveShadow=!0,e.scene.add(d);const h=e.makeBaseplateStudTextures(l),n=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:4108878,map:h.map}),p=.4343;n.customProgramCacheKey=()=>"plate-stud-disk-lod49",n.onBeforeCompile=t=>{t.uniforms.uStudShade={value:e.isMobileGfx()?0:1},t.uniforms.uViewH=e.studViewH,t.fragmentShader=t.fragmentShader.replace("#include <common>",`uniform float uStudShade;
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
            float imageY = uViewH - gl_FragCoord.y;
            float yN = imageY / max(uViewH, 1.0);
            // The far band of the home camera aliases into green-grey stripes.
            // 1280 and the phone share uStudShade 0. Hold their disks off
            // through the far-plate column (y 0.56) and fully on by the phone
            // plate row near 0.60. The 1440 window already passed with the
            // fade finished by y 0.49, so its stud rows are not re-ramped.
            float farOff = step(0.562, yN);
            float nearOn = smoothstep(0.40, 0.49, yN);
            float nearBand = mix(farOff, nearOn, uStudShade);
            float diskVis = disk * fade * mix(1.0, farGate, uStudShade);
            diskVis *= nearBand;
            float gap = mix(${p}, 0.78, uStudShade);
            vec3 studRgb = mix(vec3(gap), vec3(1.0), diskVis);
            diffuseColor.rgb *= studRgb;
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(${l}.0 - vMapUv.x, ${l}.0 - vMapUv.y));
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
          }
          `)},e.groundStuds=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(a,a),n),e.groundStuds.rotation.x=-Math.PI/2,e.groundStuds.position.set(a/2,.012,a/2),e.groundStuds.castShadow=!1,e.groundStuds.receiveShadow=!0,e.scene.add(e.groundStuds),d.castShadow=!1;const r=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});r.polygonOffset=!0,r.polygonOffsetFactor=1,r.polygonOffsetUnits=1;const i=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.BoxGeometry(a+1.6,e.PLATE_H*.28,a+1.6),r);i.position.set(a/2,-e.PLATE_H*.42,a/2),i.receiveShadow=!0,i.name="plateRim",e.scene.add(i);const m=new globalThis.__BRIX_THREE.PlaneGeometry(16e3,16e3,80,80),f=new globalThis.__BRIX_THREE.MeshLambertMaterial({color:3116860});f.customProgramCacheKey=()=>"grass-dim-lod31",f.onBeforeCompile=t=>{t.uniforms.uStudShade={value:e.isMobileGfx()?0:1},t.fragmentShader=t.fragmentShader.replace("#include <common>",`uniform float uStudShade;
#include <common>`),t.fragmentShader=t.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          diffuseColor.g *= mix(1.0, 0.34, uStudShade);`)};const o=new globalThis.__BRIX_THREE.Mesh(m,f);o.rotation.x=-Math.PI/2,o.position.set(a/2,-.02,a/2),o.receiveShadow=!1,o.userData.isGround=!0,e.scene.add(o),window.grassPlane=o,window.baseplateRef=d,window.groundStudsRef=e.groundStuds,e.createDistantScenery(a);const g=a,x=l,s=new globalThis.__BRIX_THREE.GridHelper(g,x,2059816,2059816);s.position.set(a/2,.002,a/2),s.material.opacity=0,s.material.transparent=!0,s.visible=!1,e.scene.add(s),window.gridHelper=s,e.controls&&!e.controls.__plateStudLod&&(e.controls.__plateStudLod=!0,e.controls.addEventListener("change",()=>e.updateNearPlateStuds(!1))),e.updateNearPlateStuds(!0)};
