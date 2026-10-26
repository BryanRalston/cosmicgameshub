import{__brixScope as e}from"./brix3d-m56d9c429.js";e.ensureGrade=function(a,r){e.gradeMat||(e.gradeMat=new globalThis.__BRIX_THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null},exposure:{value:1},darkness:{value:.06},offset:{value:1.15},useVignette:{value:0}},depthTest:!1,depthWrite:!1,toneMapped:!1,vertexShader:`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = vec4(position.xy, 0.0, 1.0);
            }
          `,fragmentShader:`
            uniform sampler2D tDiffuse;
            uniform float exposure;
            uniform float darkness;
            uniform float offset;
            uniform float useVignette;
            varying vec2 vUv;
            void main() {
              vec4 texel = texture2D(tDiffuse, vUv);
              vec3 color = texel.rgb;
              if (useVignette > 0.5) {
                vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
                float vign = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
                color *= mix(1.0 - darkness, 1.0, vign);
              }
              color = clamp(color * exposure, 0.0, 1.0);
              vec3 encoded = mix(
                pow(color, vec3(0.41666)) * 1.055 - vec3(0.055),
                color * 12.92,
                vec3(lessThanEqual(color, vec3(0.0031308)))
              );
              gl_FragColor = vec4(encoded, texel.a);
            }
          `}),e.gradeQuad=new globalThis.__BRIX_THREE.Mesh(new globalThis.__BRIX_THREE.PlaneGeometry(2,2),e.gradeMat),e.gradeQuad.frustumCulled=!1,e.gradeScene=new globalThis.__BRIX_THREE.Scene,e.gradeScene.add(e.gradeQuad),e.gradeCam=new globalThis.__BRIX_THREE.PerspectiveCamera(1,1,.1,2)),(!e.gradeLinear||e.gradeLinear.width!==a||e.gradeLinear.height!==r)&&(e.gradeLinear&&e.gradeLinear.dispose(),e.gradeOut&&e.gradeOut.dispose(),e.gradeLinear=new globalThis.__BRIX_THREE.WebGLRenderTarget(a,r,{depthBuffer:!0,stencilBuffer:!1}),e.gradeOut=new globalThis.__BRIX_THREE.WebGLRenderTarget(a,r,{depthBuffer:!1,stencilBuffer:!1}),e.gradeLinear.texture.colorSpace=globalThis.__BRIX_THREE.LinearSRGBColorSpace,e.gradeOut.texture.colorSpace=globalThis.__BRIX_THREE.LinearSRGBColorSpace)};
