import{__brixScope as n}from"./brix3d-t8ace133d.js";n.WebGLCubeRenderTarget=class extends n.WebGLRenderTarget{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const r={width:t,height:t,depth:1},a=[r,r,r,r,r,r];e.encoding!==void 0&&(n.warnOnce("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),e.colorSpace=e.encoding===n.sRGBEncoding?n.SRGBColorSpace:n.NoColorSpace),this.texture=new n.CubeTexture(a,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:n.LinearFilter}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const r={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},a=new n.BoxGeometry(5,5,5),s=new n.ShaderMaterial({name:"CubemapFromEquirect",uniforms:n.cloneUniforms(r.uniforms),vertexShader:r.vertexShader,fragmentShader:r.fragmentShader,side:n.BackSide,blending:n.NoBlending});s.uniforms.tEquirect.value=e;const i=new n.Mesh(a,s),o=e.minFilter;return e.minFilter===n.LinearMipmapLinearFilter&&(e.minFilter=n.LinearFilter),new n.CubeCamera(1,10,this).update(t,i),e.minFilter=o,i.geometry.dispose(),i.material.dispose(),this}clear(t,e,r,a){const s=t.getRenderTarget();for(let i=0;i<6;i++)t.setRenderTarget(this,i),t.clear(e,r,a);t.setRenderTarget(s)}},n._vector1=new n.Vector3,n._vector2=new n.Vector3,n._normalMatrix=new n.Matrix3,n.Plane=class{constructor(t=new n.Vector3(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,r,a){return this.normal.set(t,e,r),this.constant=a,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,r){const a=n._vector1.subVectors(r,e).cross(n._vector2.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(a,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const r=t.delta(n._vector1),a=this.normal.dot(r);if(a===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const s=-(t.start.dot(this.normal)+this.constant)/a;return s<0||s>1?null:e.copy(t.start).addScaledVector(r,s)}intersectsLine(t){const e=this.distanceToPoint(t.start),r=this.distanceToPoint(t.end);return e<0&&r>0||r<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const r=e||n._normalMatrix.getNormalMatrix(t),a=this.coplanarPoint(n._vector1).applyMatrix4(t),s=this.normal.applyMatrix3(r).normalize();return this.constant=-a.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},n._sphere$5=new n.Sphere,n._vector$7=new n.Vector3,n.Frustum=class{constructor(t=new n.Plane,e=new n.Plane,r=new n.Plane,a=new n.Plane,s=new n.Plane,i=new n.Plane){this.planes=[t,e,r,a,s,i]}set(t,e,r,a,s,i){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(r),o[3].copy(a),o[4].copy(s),o[5].copy(i),this}copy(t){const e=this.planes;for(let r=0;r<6;r++)e[r].copy(t.planes[r]);return this}setFromProjectionMatrix(t,e=n.WebGLCoordinateSystem){const r=this.planes,a=t.elements,s=a[0],i=a[1],o=a[2],l=a[3],d=a[4],v=a[5],y=a[6],f=a[7],g=a[8],S=a[9],x=a[10],p=a[11],c=a[12],h=a[13],u=a[14],m=a[15];if(r[0].setComponents(l-s,f-d,p-g,m-c).normalize(),r[1].setComponents(l+s,f+d,p+g,m+c).normalize(),r[2].setComponents(l+i,f+v,p+S,m+h).normalize(),r[3].setComponents(l-i,f-v,p-S,m-h).normalize(),r[4].setComponents(l-o,f-y,p-x,m-u).normalize(),e===n.WebGLCoordinateSystem)r[5].setComponents(l+o,f+y,p+x,m+u).normalize();else if(e===n.WebGPUCoordinateSystem)r[5].setComponents(o,y,x,u).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),n._sphere$5.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),n._sphere$5.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(n._sphere$5)}intersectsSprite(t){return n._sphere$5.center.set(0,0,0),n._sphere$5.radius=.7071067811865476,n._sphere$5.applyMatrix4(t.matrixWorld),this.intersectsSphere(n._sphere$5)}intersectsSphere(t){const e=this.planes,r=t.center,a=-t.radius;for(let s=0;s<6;s++)if(e[s].distanceToPoint(r)<a)return!1;return!0}intersectsBox(t){const e=this.planes;for(let r=0;r<6;r++){const a=e[r];if(n._vector$7.x=a.normal.x>0?t.max.x:t.min.x,n._vector$7.y=a.normal.y>0?t.max.y:t.min.y,n._vector$7.z=a.normal.z>0?t.max.z:t.min.z,a.distanceToPoint(n._vector$7)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let r=0;r<6;r++)if(e[r].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},n.PlaneGeometry=class F extends n.BufferGeometry{constructor(t=1,e=1,r=1,a=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:r,heightSegments:a};const s=t/2,i=e/2,o=Math.floor(r),l=Math.floor(a),d=o+1,v=l+1,y=t/o,f=e/l,g=[],S=[],x=[],p=[];for(let c=0;c<v;c++){const h=c*f-i;for(let u=0;u<d;u++){const m=u*y-s;S.push(m,-h,0),x.push(0,0,1),p.push(u/o),p.push(1-c/l)}}for(let c=0;c<l;c++)for(let h=0;h<o;h++){const u=h+d*c,m=h+d*(c+1),A=h+1+d*(c+1),P=h+1+d*c;g.push(u,m,P),g.push(m,A,P)}this.setIndex(g),this.setAttribute("position",new n.Float32BufferAttribute(S,3)),this.setAttribute("normal",new n.Float32BufferAttribute(x,3)),this.setAttribute("uv",new n.Float32BufferAttribute(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new F(t.width,t.height,t.widthSegments,t.heightSegments)}},n.alphahash_fragment=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,n.alphahash_pars_fragment=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,n.alphamap_fragment=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,n.alphamap_pars_fragment=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,n.alphatest_fragment=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,n.alphatest_pars_fragment=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`;
