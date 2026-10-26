import{__brixScope as d}from"./brix3d-m3b79cb7a.js";d.createSkyGradient=function(i,e,t,l=!1){const r=document.createElement("canvas");r.width=2,r.height=512;const a=r.getContext("2d"),o=a.createLinearGradient(0,0,0,512);o.addColorStop(0,"#"+i.toString(16).padStart(6,"0")),o.addColorStop(.4,"#"+e.toString(16).padStart(6,"0")),l&&(o.addColorStop(.7,"#"+e.toString(16).padStart(6,"0")),o.addColorStop(.85,"#"+t.toString(16).padStart(6,"0")),o.addColorStop(.95,"#fffaf0")),o.addColorStop(1,"#"+t.toString(16).padStart(6,"0")),a.fillStyle=o,a.fillRect(0,0,2,512);const n=new globalThis.__BRIX_THREE.CanvasTexture(r);return n.magFilter=globalThis.__BRIX_THREE.LinearFilter,n},d.createShaderSky=function(i,e,t){const l=new globalThis.__BRIX_THREE.SphereGeometry(900,32,32),r=new globalThis.__BRIX_THREE.ShaderMaterial({vertexShader:`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 glowColor;
          varying vec3 vWorldPosition;
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float t = dir.y * 0.5 + 0.5; // 0 at bottom, 1 at top
            
            // Main sky gradient
            vec3 skyColor = mix(horizonColor, topColor, pow(t, 0.7));
            
            // Horizon glow effect
            float horizonFactor = pow(1.0 - abs(dir.y), 4.0);
            vec3 finalColor = mix(skyColor, glowColor, horizonFactor * 0.6);
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,uniforms:{topColor:{value:new globalThis.__BRIX_THREE.Color(i)},horizonColor:{value:new globalThis.__BRIX_THREE.Color(e)},glowColor:{value:new globalThis.__BRIX_THREE.Color(t)}},side:globalThis.__BRIX_THREE.BackSide});return new globalThis.__BRIX_THREE.Mesh(l,r)};
