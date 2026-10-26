import{__brixScope as e}from"./brix3d-m56d9c429.js";e.buildComposer=function(){const{EffectComposer:t,RenderPass:m,UnrealBloomPass:v,ShaderPass:c,SSAOPass:r,OutputPass:i}=e.postMods,a=new globalThis.__BRIX_THREE.Vector2;e.renderer.getSize(a);const n=e.renderer.getPixelRatio();let s=null;try{s=new globalThis.__BRIX_THREE.WebGLRenderTarget(Math.max(1,Math.floor(a.width*n)),Math.max(1,Math.floor(a.height*n)),{type:globalThis.__BRIX_THREE.HalfFloatType,samples:4})}catch{s=null}if(e.composer=s?new t(e.renderer,s):new t(e.renderer),e.composer.addPass(new m(e.scene,e.camera)),e.qualitySettings.ssao&&r&&!e.isMobileGfx()){const o=e.viewSize();e.ssaoPass=new r(e.scene,e.camera,o.w,o.h,16),e.ssaoPass.kernelRadius=8,e.ssaoPass.minDistance=.005,e.ssaoPass.maxDistance=.12,e.composer.addPass(e.ssaoPass)}e.qualitySettings.bloom&&!e.isMobileGfx()&&(e.bloomPass=new v(new globalThis.__BRIX_THREE.Vector2(innerWidth*.5,innerHeight*.5),.22,.35,.88),e.qualityPreset!=="high"&&(e.bloomPass.nMips=1),e.composer.addPass(e.bloomPass));const d={uniforms:{tDiffuse:{value:null},darkness:{value:.06},offset:{value:1.15},saturation:{value:1}},vertexShader:`
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
        `};e.vignettePass=new c(d),e.composer.addPass(e.vignettePass),i&&e.composer.addPass(new i),e.gradeScreenPass=null;const l=e.viewSize();e.composer.setSize(l.w,l.h),window.__brixPostOn=!0,e.markDirty()};
