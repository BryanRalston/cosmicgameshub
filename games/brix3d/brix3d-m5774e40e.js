import{__brixScope as e}from"./brix3d-m3cf279b3.js";e.warmShaders=async function(){if(await e.yieldTick(),!e.renderer||typeof e.renderer.compileAsync!="function"){e.shadersWarmed=!0,e.needsRender=!0;return}const o=new Set;e.warmTarget||(e.warmTarget=new globalThis.__BRIX_THREE.WebGLRenderTarget(4,4));let t=0;for(;t<8;){const i=[];e.scene.traverse(s=>{(s.isMesh||s.isLine)&&s.material&&i.push(s)});let l=!1;for(const s of i){const n=Array.isArray(s.material)?s.material:[s.material];for(const r of n){if(!r||o.has(r.uuid))continue;o.add(r.uuid),l=!0;const d=new globalThis.__BRIX_THREE.Scene,a=new globalThis.__BRIX_THREE.Mesh(s.geometry,r);a.castShadow=!!s.castShadow,a.receiveShadow=!!s.receiveShadow,a.frustumCulled=!1,d.add(a);try{await e.renderer.compileAsync(d,e.camera,e.scene),e.renderer.setRenderTarget(e.warmTarget),e.renderer.render(d,e.camera),e.renderer.setRenderTarget(null)}catch(f){console.error(f)}await e.yieldTick()}}if(l){t=0;continue}if(window.scenerySettled)break;t++,await e.yieldTick()}e.shadersWarmed=!0,e.needsRender=!0},e.loadPostMods=function(){return e.postModsPromise||(e.postModsPromise=globalThis.__brixLoadPost().then(o=>(e.postMods={EffectComposer:o.EffectComposer,RenderPass:o.RenderPass,UnrealBloomPass:o.UnrealBloomPass,ShaderPass:o.ShaderPass,SSAOPass:o.SSAOPass},e.postMods))),e.postModsPromise},e.setupPostProcessing=function(){if(e.composer){try{e.composer.dispose()}catch{}e.composer=null}if(e.ssaoPass=null,e.bloomPass=null,e.vignettePass=null,window.__brixPostOn=!1,!e.qualitySettings.post||e.isMobileGfx())return;const o=++e.postGen;e.loadPostMods().then(()=>{o===e.postGen&&(!e.qualitySettings.post||e.isMobileGfx()||!e.renderer||!e.postMods||e.buildComposer())}).catch(()=>{})},e.buildComposer=function(){const{EffectComposer:o,RenderPass:t,UnrealBloomPass:i,ShaderPass:l,SSAOPass:s,OutputPass:n}=e.postMods,r=new globalThis.__BRIX_THREE.Vector2;e.renderer.getSize(r);const d=e.renderer.getPixelRatio();let a=null;try{a=new globalThis.__BRIX_THREE.WebGLRenderTarget(Math.max(1,Math.floor(r.width*d)),Math.max(1,Math.floor(r.height*d)),{type:globalThis.__BRIX_THREE.HalfFloatType,samples:4})}catch{a=null}e.composer=a?new o(e.renderer,a):new o(e.renderer),e.composer.addPass(new t(e.scene,e.camera)),e.qualitySettings.ssao&&s&&!e.isMobileGfx()&&(e.ssaoPass=new s(e.scene,e.camera,innerWidth,innerHeight,16),e.ssaoPass.kernelRadius=8,e.ssaoPass.minDistance=.005,e.ssaoPass.maxDistance=.12,e.composer.addPass(e.ssaoPass)),e.qualitySettings.bloom&&!e.isMobileGfx()&&(e.bloomPass=new i(new globalThis.__BRIX_THREE.Vector2(innerWidth*.5,innerHeight*.5),.22,.35,.88),e.qualityPreset!=="high"&&(e.bloomPass.nMips=1),e.composer.addPass(e.bloomPass));const f={uniforms:{tDiffuse:{value:null},darkness:{value:.06},offset:{value:1.15},saturation:{value:1}},vertexShader:`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          uniform sampler2D tDiffuse;
          uniform float darkness;
          uniform float offset;
          uniform float saturation;
          varying vec2 vUv;

          void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            float vign = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
            texel.rgb *= mix(1.0 - darkness, 1.0, vign);
            float gray = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
            texel.rgb = mix(vec3(gray), texel.rgb, saturation);
            // Stay linear. OutputPass applies the same AgX grade as the phone renderer.
            gl_FragColor = texel;
          }
        `};e.vignettePass=new l(f),e.composer.addPass(e.vignettePass),n&&e.composer.addPass(new n),e.composer.setSize(innerWidth,innerHeight),window.__brixPostOn=!0,e.needsRender=!0},e.renderEnvCube=function(){const o=new globalThis.__BRIX_THREE.Scene,t=new globalThis.__BRIX_THREE.PerspectiveCamera(90,1,.1,100),i=new globalThis.__BRIX_THREE.SphereGeometry(50,32,32),l=new globalThis.__BRIX_THREE.ShaderMaterial({uniforms:{topColor:{value:new globalThis.__BRIX_THREE.Color(30719)},bottomColor:{value:new globalThis.__BRIX_THREE.Color(16777215)},offset:{value:10},exponent:{value:.6}},vertexShader:`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition + offset).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
          }
        `,side:globalThis.__BRIX_THREE.BackSide}),s=new globalThis.__BRIX_THREE.Mesh(i,l);o.add(s);const n=new globalThis.__BRIX_THREE.WebGLCubeRenderTarget(256);return new globalThis.__BRIX_THREE.CubeCamera(.1,100,n).update(e.renderer,o),n};
