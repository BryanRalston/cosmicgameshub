import{__brixScope as e}from"./brix3d-md2ebfef0.js";e.init=async function(){e.isTouchDevice="ontouchstart"in window||navigator.maxTouchPoints>0,e.loadQualityPreset(),setTimeout(()=>e.SoundSystem.init(),0),e.scene=new globalThis.__BRIX_THREE.Scene,e.scene.background=new globalThis.__BRIX_THREE.Color(8900331),e.scene.fog=new globalThis.__BRIX_THREE.Fog(8900331,100,400),e.camera=new globalThis.__BRIX_THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,1e3),e.renderer=new globalThis.__BRIX_THREE.WebGLRenderer({antialias:e.useMsaa(),preserveDrawingBuffer:!1,powerPreference:"high-performance"}),e.renderer.setSize(innerWidth,innerHeight),e.renderer.setPixelRatio(e.qualityDpr()),e.renderer.shadowMap.enabled=!0,e.renderer.shadowMap.type=globalThis.__BRIX_THREE.PCFShadowMap,e.renderer.toneMapping=globalThis.__BRIX_THREE.ACESFilmicToneMapping,e.renderer.toneMappingExposure=e.isMobileGfx()?1:1.15,e.renderer.info.autoReset=!1,document.getElementById("container").appendChild(e.renderer.domElement),performance.mark("brix-renderer"),e.envMap=null,e.scene.environment=null,e.scheduleEnvMap(),e.controls=new globalThis.__BRIX_ORBIT(e.camera,e.renderer.domElement),e.controls.addEventListener("change",()=>{e.needsRender=!0}),e.controls.enableDamping=!0,e.controls.dampingFactor=.1,e.controls.rotateSpeed=1.05,e.controls.zoomSpeed=1.15,e.controls.minPolarAngle=.1,e.controls.maxPolarAngle=Math.PI/2.1,e.controls.minDistance=3,e.controls.maxDistance=300,e.frameHomeCamera(),performance.mark("brix-controls"),e.controls.maxTargetRadius=1/0,e.controls.addEventListener("change",()=>{e.controls.target.y<0&&(e.controls.target.y=0),e.camera.position.y<.5&&(e.camera.position.y=.5)}),e.raycaster=new globalThis.__BRIX_THREE.Raycaster,e.mouse=new globalThis.__BRIX_THREE.Vector2,await e.yieldTick();const o=new globalThis.__BRIX_THREE.AmbientLight(16777215,.78);o.name="ambient",e.scene.add(o);const r=e.qualityShadowSize(),a=new globalThis.__BRIX_THREE.DirectionalLight(16774888,1.7);a.name="sun",a.position.set(50,80,60),a.castShadow=!0,a.shadow.mapSize.width=r,a.shadow.mapSize.height=r,a.shadow.camera.near=1,a.shadow.camera.far=200,a.shadow.camera.left=-48,a.shadow.camera.right=48,a.shadow.camera.top=48,a.shadow.camera.bottom=-48,a.shadow.bias=-8e-4,a.shadow.normalBias=.04,e.scene.add(a),window.sunLight=a,e.scene.add(a.target);const i=new globalThis.__BRIX_THREE.HemisphereLight(14150911,7181408,.8);i.name="hemi",e.scene.add(i),await e.yieldTick(),e.initBrickLightPool(),e.setupPostProcessing(),e.applyQuality(e.qualityPreset,{silent:!0});const l=new globalThis.__BRIX_THREE.PlaneGeometry(2e3,2e3),n=new globalThis.__BRIX_THREE.MeshBasicMaterial({visible:!1});e.groundPlane=new globalThis.__BRIX_THREE.Mesh(l,n),e.groundPlane.rotation.x=-Math.PI/2,e.groundPlane.position.y=e.BASE_Y,e.scene.add(e.groundPlane),await e.yieldTick(),performance.mark("brix-before-ground"),e.createInfiniteGround(),performance.mark("brix-ground"),await e.yieldTick(),e.setupEvents(),performance.mark("brix-events"),window.brixCanPlace=!0,window.brixPlaceableAt=performance.now(),setTimeout(()=>{e.buildEnvMapNow&&e.buildEnvMapNow()},0),await e.yieldTick(),e.animate(),setTimeout(()=>{window.brixStartScenery&&window.brixStartScenery()},0),setTimeout(()=>{e.ensurePrefabs()},1500),e.updateTimeOfDay(),setTimeout(()=>{const t=document.getElementById("loadingScreen");t&&(t.classList.add("hide"),setTimeout(()=>{t.style.display="none"},280));const s=!!e.shareTokenFromLocation();!s&&!e.bricks.length&&(window.innerWidth<=768?e.toast("Tap a starter, or tap the plate. The ghost is your 1\xD71.","success"):e.toast("Plate is ready. Tap a starter or place your first brick.","success")),e.tryLoadShareFromLocation(),e.initDailyPrompt(),(e.bricks.length||s)&&e.hideStarterBar()},400),e.updateUI()},e.loadPostMods=function(){return e.postModsPromise||(e.postModsPromise=globalThis.__brixLoadPost().then(o=>(e.postMods={EffectComposer:o.EffectComposer,RenderPass:o.RenderPass,UnrealBloomPass:o.UnrealBloomPass,ShaderPass:o.ShaderPass,SSAOPass:o.SSAOPass},e.postMods))),e.postModsPromise},e.setupPostProcessing=function(){if(e.composer){try{e.composer.dispose()}catch{}e.composer=null}if(e.ssaoPass=null,e.bloomPass=null,e.vignettePass=null,!e.qualitySettings.post||e.isMobileGfx())return;const o=++e.postGen;e.loadPostMods().then(()=>{o===e.postGen&&(!e.qualitySettings.post||e.isMobileGfx()||!e.renderer||!e.postMods||e.buildComposer())}).catch(()=>{})},e.buildComposer=function(){const{EffectComposer:o,RenderPass:r,UnrealBloomPass:a,ShaderPass:i,SSAOPass:l}=e.postMods,n=new globalThis.__BRIX_THREE.Vector2;e.renderer.getSize(n);const t=e.renderer.getPixelRatio();let s=null;try{s=new globalThis.__BRIX_THREE.WebGLRenderTarget(Math.max(1,Math.floor(n.width*t)),Math.max(1,Math.floor(n.height*t)),{type:globalThis.__BRIX_THREE.HalfFloatType,samples:4})}catch{s=null}e.composer=s?new o(e.renderer,s):new o(e.renderer),e.composer.addPass(new r(e.scene,e.camera)),e.qualitySettings.ssao&&l&&!e.isMobileGfx()&&(e.ssaoPass=new l(e.scene,e.camera,innerWidth,innerHeight,16),e.ssaoPass.kernelRadius=8,e.ssaoPass.minDistance=.005,e.ssaoPass.maxDistance=.12,e.composer.addPass(e.ssaoPass)),e.qualitySettings.bloom&&!e.isMobileGfx()&&(e.bloomPass=new a(new globalThis.__BRIX_THREE.Vector2(innerWidth*.5,innerHeight*.5),.22,.35,.88),e.composer.addPass(e.bloomPass));const c={uniforms:{tDiffuse:{value:null},darkness:{value:.06},offset:{value:1.15},saturation:{value:1.1}},vertexShader:`
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
            // The composer target is linear and this pass is the last one.
            // A display gamma keeps the plate mid green without a second ACES pass.
            texel.rgb = pow(max(texel.rgb, vec3(0.0)), vec3(0.4545));
            gl_FragColor = texel;
          }
        `};e.vignettePass=new i(c),e.composer.addPass(e.vignettePass),e.composer.setSize(innerWidth,innerHeight),e.needsRender=!0},e.renderEnvCube=function(){const o=new globalThis.__BRIX_THREE.Scene,r=new globalThis.__BRIX_THREE.PerspectiveCamera(90,1,.1,100),a=new globalThis.__BRIX_THREE.SphereGeometry(50,32,32),i=new globalThis.__BRIX_THREE.ShaderMaterial({uniforms:{topColor:{value:new globalThis.__BRIX_THREE.Color(30719)},bottomColor:{value:new globalThis.__BRIX_THREE.Color(16777215)},offset:{value:10},exponent:{value:.6}},vertexShader:`
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
        `,side:globalThis.__BRIX_THREE.BackSide}),l=new globalThis.__BRIX_THREE.Mesh(a,i);o.add(l);const n=new globalThis.__BRIX_THREE.WebGLCubeRenderTarget(256);return new globalThis.__BRIX_THREE.CubeCamera(.1,100,n).update(e.renderer,o),n},e.scheduleEnvMap=function(){let o=!1;e.buildEnvMapNow=()=>{if(o||!e.renderer)return o;o=!0,performance.mark("brix-env-start"),e.pmremGenerator||(e.pmremGenerator=new globalThis.__BRIX_THREE.PMREMGenerator(e.renderer),e.pmremGenerator.compileEquirectangularShader());const r=e.renderEnvCube();return setTimeout(()=>{r&&(e.envMap=e.pmremGenerator.fromCubemap(r.texture).texture,r.dispose(),e.scene.environment=e.envMap,performance.mark("brix-env"),e.needsRender=!0)},0),!0}};
