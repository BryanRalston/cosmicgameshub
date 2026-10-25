import{__brixScope as e}from"./brix3d-mba2742b1.js";e.renderEnvCube=function(){const o=new globalThis.__BRIX_THREE.Scene,r=new globalThis.__BRIX_THREE.PerspectiveCamera(90,1,.1,100),a=new globalThis.__BRIX_THREE.SphereGeometry(50,32,32),i=new globalThis.__BRIX_THREE.ShaderMaterial({uniforms:{topColor:{value:new globalThis.__BRIX_THREE.Color(30719)},bottomColor:{value:new globalThis.__BRIX_THREE.Color(16777215)},offset:{value:10},exponent:{value:.6}},vertexShader:`
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
        `,side:globalThis.__BRIX_THREE.BackSide}),l=new globalThis.__BRIX_THREE.Mesh(a,i);o.add(l);const n=new globalThis.__BRIX_THREE.WebGLCubeRenderTarget(256);return new globalThis.__BRIX_THREE.CubeCamera(.1,100,n).update(e.renderer,o),n},e.scheduleEnvMap=function(){let o=!1;e.buildEnvMapNow=()=>{if(o||!e.renderer)return o;if(o=!0,performance.mark("brix-env-start"),e.isMobileGfx())return e.scene.environment=null,performance.mark("brix-env"),!0;e.pmremGenerator||(e.pmremGenerator=new globalThis.__BRIX_THREE.PMREMGenerator(e.renderer),e.pmremGenerator.compileEquirectangularShader());const r=e.renderEnvCube();return setTimeout(()=>{r&&(e.envMap=e.pmremGenerator.fromCubemap(r.texture).texture,r.dispose(),e.scene.environment=e.envMap,performance.mark("brix-env"),e.needsRender=!0)},0),!0}};
