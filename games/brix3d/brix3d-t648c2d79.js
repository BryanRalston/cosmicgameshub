import{__brixScope as t}from"./brix3d-t8ace133d.js";t.WebGLCapabilities=function(e,n,u){let r;function c(){if(r!==void 0)return r;if(n.has("EXT_texture_filter_anisotropic")===!0){const M=n.get("EXT_texture_filter_anisotropic");r=e.getParameter(M.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function d(M){if(M==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";M="mediump"}return M==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const i=typeof WebGL2RenderingContext<"u"&&e.constructor.name==="WebGL2RenderingContext";let o=u.precision!==void 0?u.precision:"highp";const a=d(o);a!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",a,"instead."),o=a);const S=i||n.has("WEBGL_draw_buffers"),g=u.logarithmicDepthBuffer===!0,s=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),v=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=e.getParameter(e.MAX_TEXTURE_SIZE),f=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),l=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),E=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),h=v>0,m=i||n.has("OES_texture_float"),T=h&&m,p=i?e.getParameter(e.MAX_SAMPLES):0;return{isWebGL2:i,drawBuffers:S,getMaxAnisotropy:c,getMaxPrecision:d,precision:o,logarithmicDepthBuffer:g,maxTextures:s,maxVertexTextures:v,maxTextureSize:x,maxCubemapSize:f,maxAttributes:_,maxVertexUniforms:l,maxVaryings:E,maxFragmentUniforms:b,vertexTextures:h,floatFragmentTextures:m,floatVertexTextures:T,maxSamples:p}},t.WebGLClipping=function(e){const n=this;let u=null,r=0,c=!1,d=!1;const i=new t.Plane,o=new t.Matrix3,a={value:null,needsUpdate:!1};this.uniform=a,this.numPlanes=0,this.numIntersection=0,this.init=function(s,v){const x=s.length!==0||v||r!==0||c;return c=v,r=s.length,x},this.beginShadows=function(){d=!0,g(null)},this.endShadows=function(){d=!1},this.setGlobalState=function(s,v){u=g(s,v,0)},this.setState=function(s,v,x){const f=s.clippingPlanes,_=s.clipIntersection,l=s.clipShadows,E=e.get(s);if(!c||f===null||f.length===0||d&&!l)d?g(null):S();else{const b=d?0:r,h=b*4;let m=E.clippingState||null;a.value=m,m=g(f,v,h,x);for(let T=0;T!==h;++T)m[T]=u[T];E.clippingState=m,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=b}};function S(){a.value!==u&&(a.value=u,a.needsUpdate=r>0),n.numPlanes=r,n.numIntersection=0}function g(s,v,x,f){const _=s!==null?s.length:0;let l=null;if(_!==0){if(l=a.value,f!==!0||l===null){const E=x+_*4,b=v.matrixWorldInverse;o.getNormalMatrix(b),(l===null||l.length<E)&&(l=new Float32Array(E));for(let h=0,m=x;h!==_;++h,m+=4)i.copy(s[h]).applyMatrix4(b,o),i.normal.toArray(l,m),l[m+3]=i.constant}a.value=l,a.needsUpdate=!0}return n.numPlanes=_,n.numIntersection=0,l}},t.WebGLCubeMaps=function(e){let n=new WeakMap;function u(i,o){return o===t.EquirectangularReflectionMapping?i.mapping=t.CubeReflectionMapping:o===t.EquirectangularRefractionMapping&&(i.mapping=t.CubeRefractionMapping),i}function r(i){if(i&&i.isTexture){const o=i.mapping;if(o===t.EquirectangularReflectionMapping||o===t.EquirectangularRefractionMapping)if(n.has(i)){const a=n.get(i).texture;return u(a,i.mapping)}else{const a=i.image;if(a&&a.height>0){const S=new t.WebGLCubeRenderTarget(a.height/2);return S.fromEquirectangularTexture(e,i),n.set(i,S),i.addEventListener("dispose",c),u(S.texture,i.mapping)}else return null}}return i}function c(i){const o=i.target;o.removeEventListener("dispose",c);const a=n.get(o);a!==void 0&&(n.delete(o),a.dispose())}function d(){n=new WeakMap}return{get:r,dispose:d}},t._createPlanes=function(e){const n=[],u=[],r=[];let c=e;const d=e-t.LOD_MIN+1+t.EXTRA_LOD_SIGMA.length;for(let i=0;i<d;i++){const o=Math.pow(2,c);u.push(o);let a=1/o;i>e-t.LOD_MIN?a=t.EXTRA_LOD_SIGMA[i-e+t.LOD_MIN-1]:i===0&&(a=0),r.push(a);const S=1/(o-2),g=-S,s=1+S,v=[g,g,s,g,s,s,g,g,s,s,g,s],x=6,f=6,_=3,l=2,E=1,b=new Float32Array(_*f*x),h=new Float32Array(l*f*x),m=new Float32Array(E*f*x);for(let p=0;p<x;p++){const M=p%3*2/3-1,R=p>2?0:-1,P=[M,R,0,M+2/3,R,0,M+2/3,R+1,0,M,R,0,M+2/3,R+1,0,M,R+1,0];b.set(P,_*f*p),h.set(v,l*f*p);const C=[p,p,p,p,p,p];m.set(C,E*f*p)}const T=new t.BufferGeometry;T.setAttribute("position",new t.BufferAttribute(b,_)),T.setAttribute("uv",new t.BufferAttribute(h,l)),T.setAttribute("faceIndex",new t.BufferAttribute(m,E)),n.push(T),c>t.LOD_MIN&&c--}return{lodPlanes:n,sizeLods:u,sigmas:r}},t._createRenderTarget=function(e,n,u){const r=new t.WebGLRenderTarget(e,n,u);return r.texture.mapping=t.CubeUVReflectionMapping,r.texture.name="PMREM.cubeUv",r.scissorTest=!0,r},t._setViewport=function(e,n,u,r,c){e.viewport.set(n,u,r,c),e.scissor.set(n,u,r,c)},t._getBlurShader=function(e,n,u){const r=new Float32Array(t.MAX_SAMPLES),c=new t.Vector3(0,1,0);return new t.ShaderMaterial({name:"SphericalGaussianBlur",defines:{n:t.MAX_SAMPLES,CUBEUV_TEXEL_WIDTH:1/n,CUBEUV_TEXEL_HEIGHT:1/u,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:r},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:c}},vertexShader:t._getCommonVertexShader(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:t.NoBlending,depthTest:!1,depthWrite:!1})},t._getEquirectMaterial=function(){return new t.ShaderMaterial({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:t._getCommonVertexShader(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:t.NoBlending,depthTest:!1,depthWrite:!1})},t._getCubemapMaterial=function(){return new t.ShaderMaterial({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:t._getCommonVertexShader(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:t.NoBlending,depthTest:!1,depthWrite:!1})},t._getCommonVertexShader=function(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`};
