import{Clock as Mr,HalfFloatType as Ir,NoBlending as Cr,Vector2 as It,WebGLRenderTarget as Ur}from"./three.module.min.js";var Ke={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};import{ShaderMaterial as Mt,UniformsUtils as br}from"./three.module.min.js";import{BufferGeometry as Sr,Float32BufferAttribute as bt,OrthographicCamera as yr,Mesh as Tr}from"./three.module.min.js";var j=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},Er=new yr(-1,1,1,-1,0,1),it=class extends Sr{constructor(){super(),this.setAttribute("position",new bt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new bt([0,2,0,0,2,0],2))}},Ar=new it,me=class{constructor(r){this._mesh=new Tr(Ar,r)}dispose(){this._mesh.geometry.dispose()}render(r){r.render(this._mesh,Er)}get material(){return this._mesh.material}set material(r){this._mesh.material=r}};var Ne=class extends j{constructor(r,s){super(),this.textureID=s!==void 0?s:"tDiffuse",r instanceof Mt?(this.uniforms=r.uniforms,this.material=r):r&&(this.uniforms=br.clone(r.uniforms),this.material=new Mt({name:r.name!==void 0?r.name:"unspecified",defines:Object.assign({},r.defines),uniforms:this.uniforms,vertexShader:r.vertexShader,fragmentShader:r.fragmentShader})),this.fsQuad=new me(this.material)}render(r,s,p){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=p.texture),this.fsQuad.material=this.material,this.renderToScreen?(r.setRenderTarget(null),this.fsQuad.render(r)):(r.setRenderTarget(s),this.clear&&r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil),this.fsQuad.render(r))}dispose(){this.material.dispose(),this.fsQuad.dispose()}};var ze=class extends j{constructor(r,s){super(),this.scene=r,this.camera=s,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(r,s,p){let v=r.getContext(),f=r.state;f.buffers.color.setMask(!1),f.buffers.depth.setMask(!1),f.buffers.color.setLocked(!0),f.buffers.depth.setLocked(!0);let S,C;this.inverse?(S=0,C=1):(S=1,C=0),f.buffers.stencil.setTest(!0),f.buffers.stencil.setOp(v.REPLACE,v.REPLACE,v.REPLACE),f.buffers.stencil.setFunc(v.ALWAYS,S,4294967295),f.buffers.stencil.setClear(C),f.buffers.stencil.setLocked(!0),r.setRenderTarget(p),this.clear&&r.clear(),r.render(this.scene,this.camera),r.setRenderTarget(s),this.clear&&r.clear(),r.render(this.scene,this.camera),f.buffers.color.setLocked(!1),f.buffers.depth.setLocked(!1),f.buffers.color.setMask(!0),f.buffers.depth.setMask(!0),f.buffers.stencil.setLocked(!1),f.buffers.stencil.setFunc(v.EQUAL,1,4294967295),f.buffers.stencil.setOp(v.KEEP,v.KEEP,v.KEEP),f.buffers.stencil.setLocked(!0)}},qe=class extends j{constructor(){super(),this.needsSwap=!1}render(r){r.state.buffers.stencil.setLocked(!1),r.state.buffers.stencil.setTest(!1)}};var ot=class{constructor(r,s){if(this.renderer=r,this._pixelRatio=r.getPixelRatio(),s===void 0){let p=r.getSize(new It);this._width=p.width,this._height=p.height,s=new Ur(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Ir}),s.texture.name="EffectComposer.rt1"}else this._width=s.width,this._height=s.height;this.renderTarget1=s,this.renderTarget2=s.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Ne(Ke),this.copyPass.material.blending=Cr,this.clock=new Mr}swapBuffers(){let r=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=r}addPass(r){this.passes.push(r),r.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(r,s){this.passes.splice(s,0,r),r.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(r){let s=this.passes.indexOf(r);s!==-1&&this.passes.splice(s,1)}isLastEnabledPass(r){for(let s=r+1;s<this.passes.length;s++)if(this.passes[s].enabled)return!1;return!0}render(r){r===void 0&&(r=this.clock.getDelta());let s=this.renderer.getRenderTarget(),p=!1;for(let v=0,f=this.passes.length;v<f;v++){let S=this.passes[v];if(S.enabled!==!1){if(S.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(v),S.render(this.renderer,this.writeBuffer,this.readBuffer,r,p),S.needsSwap){if(p){let C=this.renderer.getContext(),c=this.renderer.state.buffers.stencil;c.setFunc(C.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,r),c.setFunc(C.EQUAL,1,4294967295)}this.swapBuffers()}ze!==void 0&&(S instanceof ze?p=!0:S instanceof qe&&(p=!1))}}this.renderer.setRenderTarget(s)}reset(r){if(r===void 0){let s=this.renderer.getSize(new It);this._pixelRatio=this.renderer.getPixelRatio(),this._width=s.width,this._height=s.height,r=this.renderTarget1.clone(),r.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=r,this.renderTarget2=r.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(r,s){this._width=r,this._height=s;let p=this._width*this._pixelRatio,v=this._height*this._pixelRatio;this.renderTarget1.setSize(p,v),this.renderTarget2.setSize(p,v);for(let f=0;f<this.passes.length;f++)this.passes[f].setSize(p,v)}setPixelRatio(r){this._pixelRatio=r,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};import{Color as Rr}from"./three.module.min.js";var st=class extends j{constructor(r,s,p=null,v=null,f=null){super(),this.scene=r,this.camera=s,this.overrideMaterial=p,this.clearColor=v,this.clearAlpha=f,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new Rr}render(r,s,p){let v=r.autoClear;r.autoClear=!1;let f,S;this.overrideMaterial!==null&&(S=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(r.getClearColor(this._oldClearColor),r.setClearColor(this.clearColor)),this.clearAlpha!==null&&(f=r.getClearAlpha(),r.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&r.clearDepth(),r.setRenderTarget(this.renderToScreen?null:p),this.clear===!0&&r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil),r.render(this.scene,this.camera),this.clearColor!==null&&r.setClearColor(this._oldClearColor),this.clearAlpha!==null&&r.setClearAlpha(f),this.overrideMaterial!==null&&(this.scene.overrideMaterial=S),r.autoClear=v}};import{AdditiveBlending as zr,Color as Ut,HalfFloatType as at,MeshBasicMaterial as _r,ShaderMaterial as $e,UniformsUtils as Rt,Vector2 as ge,Vector3 as _e,WebGLRenderTarget as lt}from"./three.module.min.js";import{Color as Nr}from"./three.module.min.js";var Ct={name:"LuminosityHighPassShader",shaderID:"luminosityHighPass",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Nr(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var Be=class l extends j{constructor(r,s,p,v){super(),this.strength=s!==void 0?s:1,this.radius=p,this.threshold=v,this.resolution=r!==void 0?new ge(r.x,r.y):new ge(256,256),this.clearColor=new Ut(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let f=Math.round(this.resolution.x/2),S=Math.round(this.resolution.y/2);this.renderTargetBright=new lt(f,S,{type:at}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let I=0;I<this.nMips;I++){let R=new lt(f,S,{type:at});R.texture.name="UnrealBloomPass.h"+I,R.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(R);let z=new lt(f,S,{type:at});z.texture.name="UnrealBloomPass.v"+I,z.texture.generateMipmaps=!1,this.renderTargetsVertical.push(z),f=Math.round(f/2),S=Math.round(S/2)}let C=Ct;this.highPassUniforms=Rt.clone(C.uniforms),this.highPassUniforms.luminosityThreshold.value=v,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new $e({uniforms:this.highPassUniforms,vertexShader:C.vertexShader,fragmentShader:C.fragmentShader}),this.separableBlurMaterials=[];let c=[3,5,7,9,11];f=Math.round(this.resolution.x/2),S=Math.round(this.resolution.y/2);for(let I=0;I<this.nMips;I++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(c[I])),this.separableBlurMaterials[I].uniforms.invSize.value=new ge(1/f,1/S),f=Math.round(f/2),S=Math.round(S/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=s,this.compositeMaterial.uniforms.bloomRadius.value=.1;let M=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=M,this.bloomTintColors=[new _e(1,1,1),new _e(1,1,1),new _e(1,1,1),new _e(1,1,1),new _e(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;let y=Ke;this.copyUniforms=Rt.clone(y.uniforms),this.blendMaterial=new $e({uniforms:this.copyUniforms,vertexShader:y.vertexShader,fragmentShader:y.fragmentShader,blending:zr,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new Ut,this.oldClearAlpha=1,this.basic=new _r,this.fsQuad=new me(null)}dispose(){for(let r=0;r<this.renderTargetsHorizontal.length;r++)this.renderTargetsHorizontal[r].dispose();for(let r=0;r<this.renderTargetsVertical.length;r++)this.renderTargetsVertical[r].dispose();this.renderTargetBright.dispose();for(let r=0;r<this.separableBlurMaterials.length;r++)this.separableBlurMaterials[r].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(r,s){let p=Math.round(r/2),v=Math.round(s/2);this.renderTargetBright.setSize(p,v);for(let f=0;f<this.nMips;f++)this.renderTargetsHorizontal[f].setSize(p,v),this.renderTargetsVertical[f].setSize(p,v),this.separableBlurMaterials[f].uniforms.invSize.value=new ge(1/p,1/v),p=Math.round(p/2),v=Math.round(v/2)}render(r,s,p,v,f){r.getClearColor(this._oldClearColor),this.oldClearAlpha=r.getClearAlpha();let S=r.autoClear;r.autoClear=!1,r.setClearColor(this.clearColor,0),f&&r.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=p.texture,r.setRenderTarget(null),r.clear(),this.fsQuad.render(r)),this.highPassUniforms.tDiffuse.value=p.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,r.setRenderTarget(this.renderTargetBright),r.clear(),this.fsQuad.render(r);let C=this.renderTargetBright;for(let c=0;c<this.nMips;c++)this.fsQuad.material=this.separableBlurMaterials[c],this.separableBlurMaterials[c].uniforms.colorTexture.value=C.texture,this.separableBlurMaterials[c].uniforms.direction.value=l.BlurDirectionX,r.setRenderTarget(this.renderTargetsHorizontal[c]),r.clear(),this.fsQuad.render(r),this.separableBlurMaterials[c].uniforms.colorTexture.value=this.renderTargetsHorizontal[c].texture,this.separableBlurMaterials[c].uniforms.direction.value=l.BlurDirectionY,r.setRenderTarget(this.renderTargetsVertical[c]),r.clear(),this.fsQuad.render(r),C=this.renderTargetsVertical[c];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,r.setRenderTarget(this.renderTargetsHorizontal[0]),r.clear(),this.fsQuad.render(r),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,f&&r.state.buffers.stencil.setTest(!0),this.renderToScreen?(r.setRenderTarget(null),this.fsQuad.render(r)):(r.setRenderTarget(p),this.fsQuad.render(r)),r.setClearColor(this._oldClearColor,this.oldClearAlpha),r.autoClear=S}getSeperableBlurMaterial(r){let s=[];for(let p=0;p<r;p++)s.push(.39894*Math.exp(-.5*p*p/(r*r))/r);return new $e({defines:{KERNEL_RADIUS:r},uniforms:{colorTexture:{value:null},invSize:{value:new ge(.5,.5)},direction:{value:new ge(.5,.5)},gaussianCoefficients:{value:s}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(r){return new $e({defines:{NUM_MIPS:r},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}};Be.BlurDirectionX=new ge(1,0);Be.BlurDirectionY=new ge(0,1);import{ColorManagement as Br,RawShaderMaterial as Dr,UniformsUtils as Fr,LinearToneMapping as Or,ReinhardToneMapping as Pr,CineonToneMapping as Lr,AgXToneMapping as kr,ACESFilmicToneMapping as Hr,SRGBTransfer as Gr}from"./three.module.min.js";var Nt={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = OptimizedCineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var ut=class extends j{constructor(){super();let r=Nt;this.uniforms=Fr.clone(r.uniforms),this.material=new Dr({name:r.name,uniforms:this.uniforms,vertexShader:r.vertexShader,fragmentShader:r.fragmentShader}),this.fsQuad=new me(this.material),this._outputColorSpace=null,this._toneMapping=null}render(r,s,p){this.uniforms.tDiffuse.value=p.texture,this.uniforms.toneMappingExposure.value=r.toneMappingExposure,(this._outputColorSpace!==r.outputColorSpace||this._toneMapping!==r.toneMapping)&&(this._outputColorSpace=r.outputColorSpace,this._toneMapping=r.toneMapping,this.material.defines={},Br.getTransfer(this._outputColorSpace)===Gr&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Or?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Pr?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Lr?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Hr?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===kr&&(this.material.defines.AGX_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(r.setRenderTarget(null),this.fsQuad.render(r)):(r.setRenderTarget(s),this.clear&&r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil),this.fsQuad.render(r))}dispose(){this.material.dispose(),this.fsQuad.dispose()}};import{Vector2 as Zr}from"./three.module.min.js";var Xr={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new Zr(1/1024,1/512)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
		precision highp float;

		uniform sampler2D tDiffuse;

		uniform vec2 resolution;

		varying vec2 vUv;

		// FXAA 3.11 implementation by NVIDIA, ported to WebGL by Agost Biro (biro@archilogic.com)

		//----------------------------------------------------------------------------------
		// File:        es3-keplerFXAAassetsshaders/FXAA_DefaultES.frag
		// SDK Version: v3.00
		// Email:       gameworks@nvidia.com
		// Site:        http://developer.nvidia.com/
		//
		// Copyright (c) 2014-2015, NVIDIA CORPORATION. All rights reserved.
		//
		// Redistribution and use in source and binary forms, with or without
		// modification, are permitted provided that the following conditions
		// are met:
		//  * Redistributions of source code must retain the above copyright
		//    notice, this list of conditions and the following disclaimer.
		//  * Redistributions in binary form must reproduce the above copyright
		//    notice, this list of conditions and the following disclaimer in the
		//    documentation and/or other materials provided with the distribution.
		//  * Neither the name of NVIDIA CORPORATION nor the names of its
		//    contributors may be used to endorse or promote products derived
		//    from this software without specific prior written permission.
		//
		// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
		// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
		// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
		// PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
		// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
		// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
		// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
		// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
		// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
		// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
		// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
		//
		//----------------------------------------------------------------------------------

		#ifndef FXAA_DISCARD
			//
			// Only valid for PC OpenGL currently.
			// Probably will not work when FXAA_GREEN_AS_LUMA = 1.
			//
			// 1 = Use discard on pixels which don't need AA.
			//     For APIs which enable concurrent TEX+ROP from same surface.
			// 0 = Return unchanged color on pixels which don't need AA.
			//
			#define FXAA_DISCARD 0
		#endif

		/*--------------------------------------------------------------------------*/
		#define FxaaTexTop(t, p) texture2D(t, p, -100.0)
		#define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), -100.0)
		/*--------------------------------------------------------------------------*/

		#define NUM_SAMPLES 5

		// assumes colors have premultipliedAlpha, so that the calculated color contrast is scaled by alpha
		float contrast( vec4 a, vec4 b ) {
			vec4 diff = abs( a - b );
			return max( max( max( diff.r, diff.g ), diff.b ), diff.a );
		}

		/*============================================================================

									FXAA3 QUALITY - PC

		============================================================================*/

		/*--------------------------------------------------------------------------*/
		vec4 FxaaPixelShader(
			vec2 posM,
			sampler2D tex,
			vec2 fxaaQualityRcpFrame,
			float fxaaQualityEdgeThreshold,
			float fxaaQualityinvEdgeThreshold
		) {
			vec4 rgbaM = FxaaTexTop(tex, posM);
			vec4 rgbaS = FxaaTexOff(tex, posM, vec2( 0.0, 1.0), fxaaQualityRcpFrame.xy);
			vec4 rgbaE = FxaaTexOff(tex, posM, vec2( 1.0, 0.0), fxaaQualityRcpFrame.xy);
			vec4 rgbaN = FxaaTexOff(tex, posM, vec2( 0.0,-1.0), fxaaQualityRcpFrame.xy);
			vec4 rgbaW = FxaaTexOff(tex, posM, vec2(-1.0, 0.0), fxaaQualityRcpFrame.xy);
			// . S .
			// W M E
			// . N .

			bool earlyExit = max( max( max(
					contrast( rgbaM, rgbaN ),
					contrast( rgbaM, rgbaS ) ),
					contrast( rgbaM, rgbaE ) ),
					contrast( rgbaM, rgbaW ) )
					< fxaaQualityEdgeThreshold;
			// . 0 .
			// 0 0 0
			// . 0 .

			#if (FXAA_DISCARD == 1)
				if(earlyExit) FxaaDiscard;
			#else
				if(earlyExit) return rgbaM;
			#endif

			float contrastN = contrast( rgbaM, rgbaN );
			float contrastS = contrast( rgbaM, rgbaS );
			float contrastE = contrast( rgbaM, rgbaE );
			float contrastW = contrast( rgbaM, rgbaW );

			float relativeVContrast = ( contrastN + contrastS ) - ( contrastE + contrastW );
			relativeVContrast *= fxaaQualityinvEdgeThreshold;

			bool horzSpan = relativeVContrast > 0.;
			// . 1 .
			// 0 0 0
			// . 1 .

			// 45 deg edge detection and corners of objects, aka V/H contrast is too similar
			if( abs( relativeVContrast ) < .3 ) {
				// locate the edge
				vec2 dirToEdge;
				dirToEdge.x = contrastE > contrastW ? 1. : -1.;
				dirToEdge.y = contrastS > contrastN ? 1. : -1.;
				// . 2 .      . 1 .
				// 1 0 2  ~=  0 0 1
				// . 1 .      . 0 .

				// tap 2 pixels and see which ones are "outside" the edge, to
				// determine if the edge is vertical or horizontal

				vec4 rgbaAlongH = FxaaTexOff(tex, posM, vec2( dirToEdge.x, -dirToEdge.y ), fxaaQualityRcpFrame.xy);
				float matchAlongH = contrast( rgbaM, rgbaAlongH );
				// . 1 .
				// 0 0 1
				// . 0 H

				vec4 rgbaAlongV = FxaaTexOff(tex, posM, vec2( -dirToEdge.x, dirToEdge.y ), fxaaQualityRcpFrame.xy);
				float matchAlongV = contrast( rgbaM, rgbaAlongV );
				// V 1 .
				// 0 0 1
				// . 0 .

				relativeVContrast = matchAlongV - matchAlongH;
				relativeVContrast *= fxaaQualityinvEdgeThreshold;

				if( abs( relativeVContrast ) < .3 ) { // 45 deg edge
					// 1 1 .
					// 0 0 1
					// . 0 1

					// do a simple blur
					return mix(
						rgbaM,
						(rgbaN + rgbaS + rgbaE + rgbaW) * .25,
						.4
					);
				}

				horzSpan = relativeVContrast > 0.;
			}

			if(!horzSpan) rgbaN = rgbaW;
			if(!horzSpan) rgbaS = rgbaE;
			// . 0 .      1
			// 1 0 1  ->  0
			// . 0 .      1

			bool pairN = contrast( rgbaM, rgbaN ) > contrast( rgbaM, rgbaS );
			if(!pairN) rgbaN = rgbaS;

			vec2 offNP;
			offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;
			offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;

			bool doneN = false;
			bool doneP = false;

			float nDist = 0.;
			float pDist = 0.;

			vec2 posN = posM;
			vec2 posP = posM;

			int iterationsUsed = 0;
			int iterationsUsedN = 0;
			int iterationsUsedP = 0;
			for( int i = 0; i < NUM_SAMPLES; i++ ) {
				iterationsUsed = i;

				float increment = float(i + 1);

				if(!doneN) {
					nDist += increment;
					posN = posM + offNP * nDist;
					vec4 rgbaEndN = FxaaTexTop(tex, posN.xy);
					doneN = contrast( rgbaEndN, rgbaM ) > contrast( rgbaEndN, rgbaN );
					iterationsUsedN = i;
				}

				if(!doneP) {
					pDist += increment;
					posP = posM - offNP * pDist;
					vec4 rgbaEndP = FxaaTexTop(tex, posP.xy);
					doneP = contrast( rgbaEndP, rgbaM ) > contrast( rgbaEndP, rgbaN );
					iterationsUsedP = i;
				}

				if(doneN || doneP) break;
			}


			if ( !doneP && !doneN ) return rgbaM; // failed to find end of edge

			float dist = min(
				doneN ? float( iterationsUsedN ) / float( NUM_SAMPLES - 1 ) : 1.,
				doneP ? float( iterationsUsedP ) / float( NUM_SAMPLES - 1 ) : 1.
			);

			// hacky way of reduces blurriness of mostly diagonal edges
			// but reduces AA quality
			dist = pow(dist, .5);

			dist = 1. - dist;

			return mix(
				rgbaM,
				rgbaN,
				dist * .5
			);
		}

		void main() {
			const float edgeDetectionQuality = .2;
			const float invEdgeDetectionQuality = 1. / edgeDetectionQuality;

			gl_FragColor = FxaaPixelShader(
				vUv,
				tDiffuse,
				resolution,
				edgeDetectionQuality, // [0,1] contrast needed, otherwise early discard
				invEdgeDetectionQuality
			);

		}
	`};import{DataTextureLoader as sn,DataUtils as kt,FloatType as vt,HalfFloatType as Je,NoColorSpace as an,LinearFilter as Ht,LinearSRGBColorSpace as Gt,RedFormat as ln,RGBAFormat as un}from"./three.module.min.js";var zt=function(l){return URL.createObjectURL(new Blob([l],{type:"text/javascript"}))},Vr=function(l){return new Worker(l)};try{URL.revokeObjectURL(zt(""))}catch{zt=function(r){return"data:application/javascript;charset=UTF-8,"+encodeURI(r)},Vr=function(r){return new Worker(r,{type:"module"})}}var ie=Uint8Array,de=Uint16Array,ht=Uint32Array,_t=new ie([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Bt=new ie([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Qr=new ie([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),Dt=function(l,r){for(var s=new de(31),p=0;p<31;++p)s[p]=r+=1<<l[p-1];for(var v=new ht(s[30]),p=1;p<30;++p)for(var f=s[p];f<s[p+1];++f)v[f]=f-s[p]<<5|p;return[s,v]},Ft=Dt(_t,2),Ot=Ft[0],Wr=Ft[1];Ot[28]=258,Wr[258]=28;var Pt=Dt(Bt,0),Yr=Pt[0],Vn=Pt[1],pt=new de(32768);for(D=0;D<32768;++D)ve=(D&43690)>>>1|(D&21845)<<1,ve=(ve&52428)>>>2|(ve&13107)<<2,ve=(ve&61680)>>>4|(ve&3855)<<4,pt[D]=((ve&65280)>>>8|(ve&255)<<8)>>>1;var ve,D,De=function(l,r,s){for(var p=l.length,v=0,f=new de(r);v<p;++v)++f[l[v]-1];var S=new de(r);for(v=0;v<r;++v)S[v]=S[v-1]+f[v-1]<<1;var C;if(s){C=new de(1<<r);var c=15-r;for(v=0;v<p;++v)if(l[v])for(var M=v<<4|l[v],y=r-l[v],I=S[l[v]-1]++<<y,R=I|(1<<y)-1;I<=R;++I)C[pt[I]>>>c]=M}else for(C=new de(p),v=0;v<p;++v)l[v]&&(C[v]=pt[S[l[v]-1]++]>>>15-l[v]);return C},Fe=new ie(288);for(D=0;D<144;++D)Fe[D]=8;var D;for(D=144;D<256;++D)Fe[D]=9;var D;for(D=256;D<280;++D)Fe[D]=7;var D;for(D=280;D<288;++D)Fe[D]=8;var D,Lt=new ie(32);for(D=0;D<32;++D)Lt[D]=5;var D;var Kr=De(Fe,9,1);var qr=De(Lt,5,1),ct=function(l){for(var r=l[0],s=1;s<l.length;++s)l[s]>r&&(r=l[s]);return r},se=function(l,r,s){var p=r/8|0;return(l[p]|l[p+1]<<8)>>(r&7)&s},ft=function(l,r){var s=r/8|0;return(l[s]|l[s+1]<<8|l[s+2]<<16)>>(r&7)},$r=function(l){return(l/8|0)+(l&7&&1)},Jr=function(l,r,s){(r==null||r<0)&&(r=0),(s==null||s>l.length)&&(s=l.length);var p=new(l instanceof de?de:l instanceof ht?ht:ie)(s-r);return p.set(l.subarray(r,s)),p},jr=function(l,r,s){var p=l.length;if(!p||s&&!s.l&&p<5)return r||new ie(0);var v=!r||s,f=!s||s.i;s||(s={}),r||(r=new ie(p*3));var S=function(P){var fe=r.length;if(P>fe){var he=new ie(Math.max(fe*2,P));he.set(r),r=he}},C=s.f||0,c=s.p||0,M=s.b||0,y=s.l,I=s.d,R=s.m,z=s.n,F=p*8;do{if(!y){s.f=C=se(l,c,1);var ee=se(l,c+1,3);if(c+=3,ee)if(ee==1)y=Kr,I=qr,R=9,z=5;else if(ee==2){var ke=se(l,c,31)+257,je=se(l,c+10,15)+4,et=ke+se(l,c+5,31)+1;c+=14;for(var Se=new ie(et),He=new ie(19),$=0;$<je;++$)He[Qr[$]]=se(l,c+$*3,7);c+=je*3;for(var Ge=ct(He),tt=(1<<Ge)-1,rt=De(He,Ge,1),$=0;$<et;){var te=rt[se(l,c,tt)];c+=te&15;var H=te>>>4;if(H<16)Se[$++]=H;else{var ce=0,ae=0;for(H==16?(ae=3+se(l,c,3),c+=2,ce=Se[$-1]):H==17?(ae=3+se(l,c,7),c+=3):H==18&&(ae=11+se(l,c,127),c+=7);ae--;)Se[$++]=ce}}var Ze=Se.subarray(0,ke),le=Se.subarray(ke);R=ct(Ze),z=ct(le),y=De(Ze,R,1),I=De(le,z,1)}else throw"invalid block type";else{var H=$r(c)+4,V=l[H-4]|l[H-3]<<8,Ee=H+V;if(Ee>p){if(f)throw"unexpected EOF";break}v&&S(M+V),r.set(l.subarray(H,Ee),M),s.b=M+=V,s.p=c=Ee*8;continue}if(c>F){if(f)throw"unexpected EOF";break}}v&&S(M+131072);for(var Xe=(1<<R)-1,Ve=(1<<z)-1,Ae=c;;Ae=c){var ce=y[ft(l,c)&Xe],Y=ce>>>4;if(c+=ce&15,c>F){if(f)throw"unexpected EOF";break}if(!ce)throw"invalid length/literal";if(Y<256)r[M++]=Y;else if(Y==256){Ae=c,y=null;break}else{var ye=Y-254;if(Y>264){var $=Y-257,K=_t[$];ye=se(l,c,(1<<K)-1)+Ot[$],c+=K}var we=I[ft(l,c)&Ve],xe=we>>>4;if(!we)throw"invalid distance";c+=we&15;var le=Yr[xe];if(xe>3){var K=Bt[xe];le+=ft(l,c)&(1<<K)-1,c+=K}if(c>F){if(f)throw"unexpected EOF";break}v&&S(M+131072);for(var be=M+ye;M<be;M+=4)r[M]=r[M-le],r[M+1]=r[M+1-le],r[M+2]=r[M+2-le],r[M+3]=r[M+3-le];M=be}}s.l=y,s.p=Ae,s.b=M,y&&(C=1,s.m=R,s.d=I,s.n=z)}while(!C);return M==r.length?r:Jr(r,0,M)};var en=new ie(0);var tn=function(l){if((l[0]&15)!=8||l[0]>>>4>7||(l[0]<<8|l[1])%31)throw"invalid zlib data";if(l[1]&32)throw"invalid zlib data: preset dictionaries not supported"};function Oe(l,r){return jr((tn(l),l.subarray(2,-4)),r)}var rn=typeof TextDecoder<"u"&&new TextDecoder,nn=0;try{rn.decode(en,{stream:!0}),nn=1}catch{}var mt=class extends sn{constructor(r){super(r),this.type=Je}parse(r){let Ge=Math.pow(2.7182818,2.2);function tt(e,t){let n=0;for(let a=0;a<65536;++a)(a==0||e[a>>3]&1<<(a&7))&&(t[n++]=a);let i=n-1;for(;n<65536;)t[n++]=0;return i}function rt(e){for(let t=0;t<16384;t++)e[t]={},e[t].len=0,e[t].lit=0,e[t].p=null}let te={l:0,c:0,lc:0};function ce(e,t,n,i,a){for(;n<e;)t=t<<8|Et(i,a),n+=8;n-=e,te.l=t>>n&(1<<e)-1,te.c=t,te.lc=n}let ae=new Array(59);function Ze(e){for(let n=0;n<=58;++n)ae[n]=0;for(let n=0;n<65537;++n)ae[e[n]]+=1;let t=0;for(let n=58;n>0;--n){let i=t+ae[n]>>1;ae[n]=t,t=i}for(let n=0;n<65537;++n){let i=e[n];i>0&&(e[n]=i|ae[i]++<<6)}}function le(e,t,n,i,a,o){let h=t,g=0,d=0;for(;i<=a;i++){if(h.value-t.value>n)return!1;ce(6,g,d,e,h);let u=te.l;if(g=te.c,d=te.lc,o[i]=u,u==63){if(h.value-t.value>n)throw new Error("Something wrong with hufUnpackEncTable");ce(8,g,d,e,h);let m=te.l+6;if(g=te.c,d=te.lc,i+m>a+1)throw new Error("Something wrong with hufUnpackEncTable");for(;m--;)o[i++]=0;i--}else if(u>=59){let m=u-59+2;if(i+m>a+1)throw new Error("Something wrong with hufUnpackEncTable");for(;m--;)o[i++]=0;i--}}Ze(o)}function Xe(e){return e&63}function Ve(e){return e>>6}function Ae(e,t,n,i){for(;t<=n;t++){let a=Ve(e[t]),o=Xe(e[t]);if(a>>o)throw new Error("Invalid table entry");if(o>14){let h=i[a>>o-14];if(h.len)throw new Error("Invalid table entry");if(h.lit++,h.p){let g=h.p;h.p=new Array(h.lit);for(let d=0;d<h.lit-1;++d)h.p[d]=g[d]}else h.p=new Array(1);h.p[h.lit-1]=t}else if(o){let h=0;for(let g=1<<14-o;g>0;g--){let d=i[(a<<14-o)+h];if(d.len||d.p)throw new Error("Invalid table entry");d.len=o,d.lit=t,h++}}}return!0}let Y={c:0,lc:0};function ye(e,t,n,i){e=e<<8|Et(n,i),t+=8,Y.c=e,Y.lc=t}let K={c:0,lc:0};function we(e,t,n,i,a,o,h,g,d){if(e==t){i<8&&(ye(n,i,a,o),n=Y.c,i=Y.lc),i-=8;let u=n>>i;if(u=new Uint8Array([u])[0],g.value+u>d)return!1;let m=h[g.value-1];for(;u-- >0;)h[g.value++]=m}else if(g.value<d)h[g.value++]=e;else return!1;K.c=n,K.lc=i}function xe(e){return e&65535}function be(e){let t=xe(e);return t>32767?t-65536:t}let P={a:0,b:0};function fe(e,t){let n=be(e),a=be(t),o=n+(a&1)+(a>>1),h=o,g=o-a;P.a=h,P.b=g}function he(e,t){let n=xe(e),i=xe(t),a=n-(i>>1)&65535,o=i+a-32768&65535;P.a=o,P.b=a}function Xt(e,t,n,i,a,o,h){let g=h<16384,d=n>a?a:n,u=1,m,T;for(;u<=d;)u<<=1;for(u>>=1,m=u,u>>=1;u>=1;){T=0;let x=T+o*(a-m),b=o*u,U=o*m,E=i*u,A=i*m,N,G,Z,J;for(;T<=x;T+=U){let k=T,B=T+i*(n-m);for(;k<=B;k+=A){let X=k+E,ne=k+b,Q=ne+E;g?(fe(e[k+t],e[ne+t]),N=P.a,Z=P.b,fe(e[X+t],e[Q+t]),G=P.a,J=P.b,fe(N,G),e[k+t]=P.a,e[X+t]=P.b,fe(Z,J),e[ne+t]=P.a,e[Q+t]=P.b):(he(e[k+t],e[ne+t]),N=P.a,Z=P.b,he(e[X+t],e[Q+t]),G=P.a,J=P.b,he(N,G),e[k+t]=P.a,e[X+t]=P.b,he(Z,J),e[ne+t]=P.a,e[Q+t]=P.b)}if(n&u){let X=k+b;g?fe(e[k+t],e[X+t]):he(e[k+t],e[X+t]),N=P.a,e[X+t]=P.b,e[k+t]=N}}if(a&u){let k=T,B=T+i*(n-m);for(;k<=B;k+=A){let X=k+E;g?fe(e[k+t],e[X+t]):he(e[k+t],e[X+t]),N=P.a,e[X+t]=P.b,e[k+t]=N}}m=u,u>>=1}return T}function Vt(e,t,n,i,a,o,h,g,d){let u=0,m=0,T=h,x=Math.trunc(i.value+(a+7)/8);for(;i.value<x;)for(ye(u,m,n,i),u=Y.c,m=Y.lc;m>=14;){let U=u>>m-14&16383,E=t[U];if(E.len)m-=E.len,we(E.lit,o,u,m,n,i,g,d,T),u=K.c,m=K.lc;else{if(!E.p)throw new Error("hufDecode issues");let A;for(A=0;A<E.lit;A++){let N=Xe(e[E.p[A]]);for(;m<N&&i.value<x;)ye(u,m,n,i),u=Y.c,m=Y.lc;if(m>=N&&Ve(e[E.p[A]])==(u>>m-N&(1<<N)-1)){m-=N,we(E.p[A],o,u,m,n,i,g,d,T),u=K.c,m=K.lc;break}}if(A==E.lit)throw new Error("hufDecode issues")}}let b=8-a&7;for(u>>=b,m-=b;m>0;){let U=t[u<<14-m&16383];if(U.len)m-=U.len,we(U.lit,o,u,m,n,i,g,d,T),u=K.c,m=K.lc;else throw new Error("hufDecode issues")}return!0}function dt(e,t,n,i,a,o){let h={value:0},g=n.value,d=q(t,n),u=q(t,n);n.value+=4;let m=q(t,n);if(n.value+=4,d<0||d>=65537||u<0||u>=65537)throw new Error("Something wrong with HUF_ENCSIZE");let T=new Array(65537),x=new Array(16384);rt(x);let b=i-(n.value-g);if(le(e,n,b,d,u,T),m>8*(i-(n.value-g)))throw new Error("Something wrong with hufUncompress");Ae(T,d,u,x),Vt(T,x,e,n,m,u,o,a,h)}function Qt(e,t,n){for(let i=0;i<n;++i)t[i]=e[t[i]]}function wt(e){for(let t=1;t<e.length;t++){let n=e[t-1]+e[t]-128;e[t]=n}}function xt(e,t){let n=0,i=Math.floor((e.length+1)/2),a=0,o=e.length-1;for(;!(a>o||(t[a++]=e[n++],a>o));)t[a++]=e[i++]}function St(e){let t=e.byteLength,n=new Array,i=0,a=new DataView(e);for(;t>0;){let o=a.getInt8(i++);if(o<0){let h=-o;t-=h+1;for(let g=0;g<h;g++)n.push(a.getUint8(i++))}else{let h=o;t-=2;let g=a.getUint8(i++);for(let d=0;d<h+1;d++)n.push(g)}}return n}function Wt(e,t,n,i,a,o){let h=new DataView(o.buffer),g=n[e.idx[0]].width,d=n[e.idx[0]].height,u=3,m=Math.floor(g/8),T=Math.ceil(g/8),x=Math.ceil(d/8),b=g-(T-1)*8,U=d-(x-1)*8,E={value:0},A=new Array(u),N=new Array(u),G=new Array(u),Z=new Array(u),J=new Array(u);for(let B=0;B<u;++B)J[B]=t[e.idx[B]],A[B]=B<1?0:A[B-1]+T*x,N[B]=new Float32Array(64),G[B]=new Uint16Array(64),Z[B]=new Uint16Array(T*64);for(let B=0;B<x;++B){let X=8;B==x-1&&(X=U);let ne=8;for(let O=0;O<T;++O){O==T-1&&(ne=b);for(let L=0;L<u;++L)G[L].fill(0),G[L][0]=a[A[L]++],Yt(E,i,G[L]),Kt(G[L],N[L]),qt(N[L]);u==3&&$t(N);for(let L=0;L<u;++L)Jt(N[L],Z[L],O*64)}let Q=0;for(let O=0;O<u;++O){let L=n[e.idx[O]].type;for(let pe=8*B;pe<8*B+X;++pe){Q=J[O][pe];for(let Re=0;Re<m;++Re){let ue=Re*64+(pe&7)*8;h.setUint16(Q+0*2*L,Z[O][ue+0],!0),h.setUint16(Q+1*2*L,Z[O][ue+1],!0),h.setUint16(Q+2*2*L,Z[O][ue+2],!0),h.setUint16(Q+3*2*L,Z[O][ue+3],!0),h.setUint16(Q+4*2*L,Z[O][ue+4],!0),h.setUint16(Q+5*2*L,Z[O][ue+5],!0),h.setUint16(Q+6*2*L,Z[O][ue+6],!0),h.setUint16(Q+7*2*L,Z[O][ue+7],!0),Q+=8*2*L}}if(m!=T)for(let pe=8*B;pe<8*B+X;++pe){let Re=J[O][pe]+8*m*2*L,ue=m*64+(pe&7)*8;for(let Ye=0;Ye<ne;++Ye)h.setUint16(Re+Ye*2*L,Z[O][ue+Ye],!0)}}}let k=new Uint16Array(g);h=new DataView(o.buffer);for(let B=0;B<u;++B){n[e.idx[B]].decoded=!0;let X=n[e.idx[B]].type;if(n[B].type==2)for(let ne=0;ne<d;++ne){let Q=J[B][ne];for(let O=0;O<g;++O)k[O]=h.getUint16(Q+O*2*X,!0);for(let O=0;O<g;++O)h.setFloat32(Q+O*2*X,w(k[O]),!0)}}}function Yt(e,t,n){let i,a=1;for(;a<64;)i=t[e.value],i==65280?a=64:i>>8==255?a+=i&255:(n[a]=i,a++),e.value++}function Kt(e,t){t[0]=w(e[0]),t[1]=w(e[1]),t[2]=w(e[5]),t[3]=w(e[6]),t[4]=w(e[14]),t[5]=w(e[15]),t[6]=w(e[27]),t[7]=w(e[28]),t[8]=w(e[2]),t[9]=w(e[4]),t[10]=w(e[7]),t[11]=w(e[13]),t[12]=w(e[16]),t[13]=w(e[26]),t[14]=w(e[29]),t[15]=w(e[42]),t[16]=w(e[3]),t[17]=w(e[8]),t[18]=w(e[12]),t[19]=w(e[17]),t[20]=w(e[25]),t[21]=w(e[30]),t[22]=w(e[41]),t[23]=w(e[43]),t[24]=w(e[9]),t[25]=w(e[11]),t[26]=w(e[18]),t[27]=w(e[24]),t[28]=w(e[31]),t[29]=w(e[40]),t[30]=w(e[44]),t[31]=w(e[53]),t[32]=w(e[10]),t[33]=w(e[19]),t[34]=w(e[23]),t[35]=w(e[32]),t[36]=w(e[39]),t[37]=w(e[45]),t[38]=w(e[52]),t[39]=w(e[54]),t[40]=w(e[20]),t[41]=w(e[22]),t[42]=w(e[33]),t[43]=w(e[38]),t[44]=w(e[46]),t[45]=w(e[51]),t[46]=w(e[55]),t[47]=w(e[60]),t[48]=w(e[21]),t[49]=w(e[34]),t[50]=w(e[37]),t[51]=w(e[47]),t[52]=w(e[50]),t[53]=w(e[56]),t[54]=w(e[59]),t[55]=w(e[61]),t[56]=w(e[35]),t[57]=w(e[36]),t[58]=w(e[48]),t[59]=w(e[49]),t[60]=w(e[57]),t[61]=w(e[58]),t[62]=w(e[62]),t[63]=w(e[63])}function qt(e){let t=.5*Math.cos(.7853975),n=.5*Math.cos(3.14159/16),i=.5*Math.cos(3.14159/8),a=.5*Math.cos(3*3.14159/16),o=.5*Math.cos(5*3.14159/16),h=.5*Math.cos(3*3.14159/8),g=.5*Math.cos(7*3.14159/16),d=new Array(4),u=new Array(4),m=new Array(4),T=new Array(4);for(let x=0;x<8;++x){let b=x*8;d[0]=i*e[b+2],d[1]=h*e[b+2],d[2]=i*e[b+6],d[3]=h*e[b+6],u[0]=n*e[b+1]+a*e[b+3]+o*e[b+5]+g*e[b+7],u[1]=a*e[b+1]-g*e[b+3]-n*e[b+5]-o*e[b+7],u[2]=o*e[b+1]-n*e[b+3]+g*e[b+5]+a*e[b+7],u[3]=g*e[b+1]-o*e[b+3]+a*e[b+5]-n*e[b+7],m[0]=t*(e[b+0]+e[b+4]),m[3]=t*(e[b+0]-e[b+4]),m[1]=d[0]+d[3],m[2]=d[1]-d[2],T[0]=m[0]+m[1],T[1]=m[3]+m[2],T[2]=m[3]-m[2],T[3]=m[0]-m[1],e[b+0]=T[0]+u[0],e[b+1]=T[1]+u[1],e[b+2]=T[2]+u[2],e[b+3]=T[3]+u[3],e[b+4]=T[3]-u[3],e[b+5]=T[2]-u[2],e[b+6]=T[1]-u[1],e[b+7]=T[0]-u[0]}for(let x=0;x<8;++x)d[0]=i*e[16+x],d[1]=h*e[16+x],d[2]=i*e[48+x],d[3]=h*e[48+x],u[0]=n*e[8+x]+a*e[24+x]+o*e[40+x]+g*e[56+x],u[1]=a*e[8+x]-g*e[24+x]-n*e[40+x]-o*e[56+x],u[2]=o*e[8+x]-n*e[24+x]+g*e[40+x]+a*e[56+x],u[3]=g*e[8+x]-o*e[24+x]+a*e[40+x]-n*e[56+x],m[0]=t*(e[x]+e[32+x]),m[3]=t*(e[x]-e[32+x]),m[1]=d[0]+d[3],m[2]=d[1]-d[2],T[0]=m[0]+m[1],T[1]=m[3]+m[2],T[2]=m[3]-m[2],T[3]=m[0]-m[1],e[0+x]=T[0]+u[0],e[8+x]=T[1]+u[1],e[16+x]=T[2]+u[2],e[24+x]=T[3]+u[3],e[32+x]=T[3]-u[3],e[40+x]=T[2]-u[2],e[48+x]=T[1]-u[1],e[56+x]=T[0]-u[0]}function $t(e){for(let t=0;t<64;++t){let n=e[0][t],i=e[1][t],a=e[2][t];e[0][t]=n+1.5747*a,e[1][t]=n-.1873*i-.4682*a,e[2][t]=n+1.8556*i}}function Jt(e,t,n){for(let i=0;i<64;++i)t[n+i]=kt.toHalfFloat(jt(e[i]))}function jt(e){return e<=1?Math.sign(e)*Math.pow(Math.abs(e),2.2):Math.sign(e)*Math.pow(Ge,Math.abs(e)-1)}function yt(e){return new DataView(e.array.buffer,e.offset.value,e.size)}function er(e){let t=e.viewer.buffer.slice(e.offset.value,e.offset.value+e.size),n=new Uint8Array(St(t)),i=new Uint8Array(n.length);return wt(n),xt(n,i),new DataView(i.buffer)}function nt(e){let t=e.array.slice(e.offset.value,e.offset.value+e.size),n=Oe(t),i=new Uint8Array(n.length);return wt(n),xt(n,i),new DataView(i.buffer)}function tr(e){let t=e.viewer,n={value:e.offset.value},i=new Uint16Array(e.width*e.scanlineBlockSize*(e.channels*e.type)),a=new Uint8Array(8192),o=0,h=new Array(e.channels);for(let U=0;U<e.channels;U++)h[U]={},h[U].start=o,h[U].end=h[U].start,h[U].nx=e.width,h[U].ny=e.lines,h[U].size=e.type,o+=h[U].nx*h[U].ny*h[U].size;let g=Ie(t,n),d=Ie(t,n);if(d>=8192)throw new Error("Something is wrong with PIZ_COMPRESSION BITMAP_SIZE");if(g<=d)for(let U=0;U<d-g+1;U++)a[U+g]=Te(t,n);let u=new Uint16Array(65536),m=tt(a,u),T=q(t,n);dt(e.array,t,n,T,i,o);for(let U=0;U<e.channels;++U){let E=h[U];for(let A=0;A<h[U].size;++A)Xt(i,E.start+A,E.nx,E.size,E.ny,E.nx*E.size,m)}Qt(u,i,o);let x=0,b=new Uint8Array(i.buffer.byteLength);for(let U=0;U<e.lines;U++)for(let E=0;E<e.channels;E++){let A=h[E],N=A.nx*A.size,G=new Uint8Array(i.buffer,A.end*2,N*2);b.set(G,x),x+=N*2,A.end+=N}return new DataView(b.buffer)}function rr(e){let t=e.array.slice(e.offset.value,e.offset.value+e.size),n=Oe(t),i=e.lines*e.channels*e.width,a=e.type==1?new Uint16Array(i):new Uint32Array(i),o=0,h=0,g=new Array(4);for(let d=0;d<e.lines;d++)for(let u=0;u<e.channels;u++){let m=0;switch(e.type){case 1:g[0]=o,g[1]=g[0]+e.width,o=g[1]+e.width;for(let T=0;T<e.width;++T){let x=n[g[0]++]<<8|n[g[1]++];m+=x,a[h]=m,h++}break;case 2:g[0]=o,g[1]=g[0]+e.width,g[2]=g[1]+e.width,o=g[2]+e.width;for(let T=0;T<e.width;++T){let x=n[g[0]++]<<24|n[g[1]++]<<16|n[g[2]++]<<8;m+=x,a[h]=m,h++}break}}return new DataView(a.buffer)}function Tt(e){let t=e.viewer,n={value:e.offset.value},i=new Uint8Array(e.width*e.lines*(e.channels*e.type*2)),a={version:re(t,n),unknownUncompressedSize:re(t,n),unknownCompressedSize:re(t,n),acCompressedSize:re(t,n),dcCompressedSize:re(t,n),rleCompressedSize:re(t,n),rleUncompressedSize:re(t,n),rleRawSize:re(t,n),totalAcUncompressedCount:re(t,n),totalDcUncompressedCount:re(t,n),acCompression:re(t,n)};if(a.version<2)throw new Error("EXRLoader.parse: "+Ue.compression+" version "+a.version+" is unsupported");let o=new Array,h=Ie(t,n)-2;for(;h>0;){let E=Qe(t.buffer,n),A=Te(t,n),N=A>>2&3,G=(A>>4)-1,Z=new Int8Array([G])[0],J=Te(t,n);o.push({name:E,index:Z,type:J,compression:N}),h-=E.length+3}let g=Ue.channels,d=new Array(e.channels);for(let E=0;E<e.channels;++E){let A=d[E]={},N=g[E];A.name=N.name,A.compression=0,A.decoded=!1,A.type=N.pixelType,A.pLinear=N.pLinear,A.width=e.width,A.height=e.lines}let u={idx:new Array(3)};for(let E=0;E<e.channels;++E){let A=d[E];for(let N=0;N<o.length;++N){let G=o[N];A.name==G.name&&(A.compression=G.compression,G.index>=0&&(u.idx[G.index]=E),A.offset=E)}}let m,T,x;if(a.acCompressedSize>0)switch(a.acCompression){case 0:m=new Uint16Array(a.totalAcUncompressedCount),dt(e.array,t,n,a.acCompressedSize,m,a.totalAcUncompressedCount);break;case 1:let E=e.array.slice(n.value,n.value+a.totalAcUncompressedCount),A=Oe(E);m=new Uint16Array(A.buffer),n.value+=a.totalAcUncompressedCount;break}if(a.dcCompressedSize>0){let E={array:e.array,offset:n,size:a.dcCompressedSize};T=new Uint16Array(nt(E).buffer),n.value+=a.dcCompressedSize}if(a.rleRawSize>0){let E=e.array.slice(n.value,n.value+a.rleCompressedSize),A=Oe(E);x=St(A.buffer),n.value+=a.rleCompressedSize}let b=0,U=new Array(d.length);for(let E=0;E<U.length;++E)U[E]=new Array;for(let E=0;E<e.lines;++E)for(let A=0;A<d.length;++A)U[A].push(b),b+=d[A].width*e.type*2;Wt(u,U,d,m,T,i);for(let E=0;E<d.length;++E){let A=d[E];if(!A.decoded)switch(A.compression){case 2:let N=0,G=0;for(let Z=0;Z<e.lines;++Z){let J=U[E][N];for(let k=0;k<A.width;++k){for(let B=0;B<2*A.type;++B)i[J++]=x[G+B*A.width*A.height];G++}N++}break;case 1:default:throw new Error("EXRLoader.parse: unsupported channel compression")}}return new DataView(i.buffer)}function Qe(e,t){let n=new Uint8Array(e),i=0;for(;n[t.value+i]!=0;)i+=1;let a=new TextDecoder().decode(n.slice(t.value,t.value+i));return t.value=t.value+i+1,a}function nr(e,t,n){let i=new TextDecoder().decode(new Uint8Array(e).slice(t.value,t.value+n));return t.value=t.value+n,i}function ir(e,t){let n=Me(e,t),i=q(e,t);return[n,i]}function or(e,t){let n=q(e,t),i=q(e,t);return[n,i]}function Me(e,t){let n=e.getInt32(t.value,!0);return t.value=t.value+4,n}function q(e,t){let n=e.getUint32(t.value,!0);return t.value=t.value+4,n}function Et(e,t){let n=e[t.value];return t.value=t.value+1,n}function Te(e,t){let n=e.getUint8(t.value);return t.value=t.value+1,n}let re=function(e,t){let n;return"getBigInt64"in DataView.prototype?n=Number(e.getBigInt64(t.value,!0)):n=e.getUint32(t.value+4,!0)+Number(e.getUint32(t.value,!0)<<32),t.value+=8,n};function W(e,t){let n=e.getFloat32(t.value,!0);return t.value+=4,n}function sr(e,t){return kt.toHalfFloat(W(e,t))}function w(e){let t=(e&31744)>>10,n=e&1023;return(e>>15?-1:1)*(t?t===31?n?NaN:1/0:Math.pow(2,t-15)*(1+n/1024):6103515625e-14*(n/1024))}function Ie(e,t){let n=e.getUint16(t.value,!0);return t.value+=2,n}function ar(e,t){return w(Ie(e,t))}function lr(e,t,n,i){let a=n.value,o=[];for(;n.value<a+i-1;){let h=Qe(t,n),g=Me(e,n),d=Te(e,n);n.value+=3;let u=Me(e,n),m=Me(e,n);o.push({name:h,pixelType:g,pLinear:d,xSampling:u,ySampling:m})}return n.value+=1,o}function ur(e,t){let n=W(e,t),i=W(e,t),a=W(e,t),o=W(e,t),h=W(e,t),g=W(e,t),d=W(e,t),u=W(e,t);return{redX:n,redY:i,greenX:a,greenY:o,blueX:h,blueY:g,whiteX:d,whiteY:u}}function cr(e,t){let n=["NO_COMPRESSION","RLE_COMPRESSION","ZIPS_COMPRESSION","ZIP_COMPRESSION","PIZ_COMPRESSION","PXR24_COMPRESSION","B44_COMPRESSION","B44A_COMPRESSION","DWAA_COMPRESSION","DWAB_COMPRESSION"],i=Te(e,t);return n[i]}function fr(e,t){let n=q(e,t),i=q(e,t),a=q(e,t),o=q(e,t);return{xMin:n,yMin:i,xMax:a,yMax:o}}function hr(e,t){let n=["INCREASING_Y"],i=Te(e,t);return n[i]}function pr(e,t){let n=W(e,t),i=W(e,t);return[n,i]}function vr(e,t){let n=W(e,t),i=W(e,t),a=W(e,t);return[n,i,a]}function mr(e,t,n,i,a){if(i==="string"||i==="stringvector"||i==="iccProfile")return nr(t,n,a);if(i==="chlist")return lr(e,t,n,a);if(i==="chromaticities")return ur(e,n);if(i==="compression")return cr(e,n);if(i==="box2i")return fr(e,n);if(i==="lineOrder")return hr(e,n);if(i==="float")return W(e,n);if(i==="v2f")return pr(e,n);if(i==="v3f")return vr(e,n);if(i==="int")return Me(e,n);if(i==="rational")return ir(e,n);if(i==="timecode")return or(e,n);if(i==="preview")return n.value+=a,"skipped";n.value+=a}function gr(e,t,n){let i={};if(e.getUint32(0,!0)!=20000630)throw new Error("THREE.EXRLoader: Provided file doesn't appear to be in OpenEXR format.");i.version=e.getUint8(4);let a=e.getUint8(5);i.spec={singleTile:!!(a&2),longName:!!(a&4),deepFormat:!!(a&8),multiPart:!!(a&16)},n.value=8;let o=!0;for(;o;){let h=Qe(t,n);if(h==0)o=!1;else{let g=Qe(t,n),d=q(e,n),u=mr(e,t,n,g,d);u===void 0?console.warn(`THREE.EXRLoader: Skipped unknown header attribute type '${g}'.`):i[h]=u}}if(a&-5)throw console.error("THREE.EXRHeader:",i),new Error("THREE.EXRLoader: Provided file is currently unsupported.");return i}function dr(e,t,n,i,a){let o={size:0,viewer:t,array:n,offset:i,width:e.dataWindow.xMax-e.dataWindow.xMin+1,height:e.dataWindow.yMax-e.dataWindow.yMin+1,channels:e.channels.length,bytesPerLine:null,lines:null,inputSize:null,type:e.channels[0].pixelType,uncompress:null,getter:null,format:null,colorSpace:Gt};switch(e.compression){case"NO_COMPRESSION":o.lines=1,o.uncompress=yt;break;case"RLE_COMPRESSION":o.lines=1,o.uncompress=er;break;case"ZIPS_COMPRESSION":o.lines=1,o.uncompress=nt;break;case"ZIP_COMPRESSION":o.lines=16,o.uncompress=nt;break;case"PIZ_COMPRESSION":o.lines=32,o.uncompress=tr;break;case"PXR24_COMPRESSION":o.lines=16,o.uncompress=rr;break;case"DWAA_COMPRESSION":o.lines=32,o.uncompress=Tt;break;case"DWAB_COMPRESSION":o.lines=256,o.uncompress=Tt;break;default:throw new Error("EXRLoader.parse: "+e.compression+" is unsupported")}if(o.scanlineBlockSize=o.lines,o.type==1)switch(a){case vt:o.getter=ar,o.inputSize=2;break;case Je:o.getter=Ie,o.inputSize=2;break}else if(o.type==2)switch(a){case vt:o.getter=W,o.inputSize=4;break;case Je:o.getter=sr,o.inputSize=4}else throw new Error("EXRLoader.parse: unsupported pixelType "+o.type+" for "+e.compression+".");o.blockCount=(e.dataWindow.yMax+1)/o.scanlineBlockSize;for(let g=0;g<o.blockCount;g++)re(t,i);o.outputChannels=o.channels==3?4:o.channels;let h=o.width*o.height*o.outputChannels;switch(a){case vt:o.byteArray=new Float32Array(h),o.channels<o.outputChannels&&o.byteArray.fill(1,0,h);break;case Je:o.byteArray=new Uint16Array(h),o.channels<o.outputChannels&&o.byteArray.fill(15360,0,h);break;default:console.error("THREE.EXRLoader: unsupported type: ",a);break}return o.bytesPerLine=o.width*o.inputSize*o.channels,o.outputChannels==4?(o.format=un,o.colorSpace=Gt):(o.format=ln,o.colorSpace=an),o}let We=new DataView(r),wr=new Uint8Array(r),Ce={value:0},Ue=gr(We,r,Ce),_=dr(Ue,We,wr,Ce,this.type),At={value:0},xr={R:0,G:1,B:2,A:3,Y:0};for(let e=0;e<_.height/_.scanlineBlockSize;e++){let t=q(We,Ce);_.size=q(We,Ce),_.lines=t+_.scanlineBlockSize>_.height?_.height-t:_.scanlineBlockSize;let i=_.size<_.lines*_.bytesPerLine?_.uncompress(_):yt(_);Ce.value+=_.size;for(let a=0;a<_.scanlineBlockSize;a++){let o=a+e*_.scanlineBlockSize;if(o>=_.height)break;for(let h=0;h<_.channels;h++){let g=xr[Ue.channels[h].name];for(let d=0;d<_.width;d++){At.value=(a*(_.channels*_.width)+h*_.width+d)*_.inputSize;let u=(_.height-1-o)*(_.width*_.outputChannels)+d*_.outputChannels+g;_.byteArray[u]=_.getter(i,At)}}}}return{header:Ue,width:_.width,height:_.height,data:_.byteArray,format:_.format,colorSpace:_.colorSpace,type:this.type}}setDataType(r){return this.type=r,this}load(r,s,p,v){function f(S,C){S.colorSpace=C.colorSpace,S.minFilter=Ht,S.magFilter=Ht,S.generateMipmaps=!1,S.flipY=!1,s&&s(S,C)}return super.load(r,f,p,v)}};import{BoxGeometry as cn,Vector3 as Le}from"./three.module.min.js";var Pe=new Le;function oe(l,r,s,p,v,f){let S=2*Math.PI*v/4,C=Math.max(f-2*v,0),c=Math.PI/4;Pe.copy(r),Pe[p]=0,Pe.normalize();let M=.5*S/(S+C),y=1-Pe.angleTo(l)/c;return Math.sign(Pe[s])===1?y*M:C/(S+C)+M+M*(1-y)}var gt=class extends cn{constructor(r=1,s=1,p=1,v=2,f=.1){if(v=v*2+1,f=Math.min(r/2,s/2,p/2,f),super(1,1,1,v,v,v),v===1)return;let S=this.toNonIndexed();this.index=null,this.attributes.position=S.attributes.position,this.attributes.normal=S.attributes.normal,this.attributes.uv=S.attributes.uv;let C=new Le,c=new Le,M=new Le(r,s,p).divideScalar(2).subScalar(f),y=this.attributes.position.array,I=this.attributes.normal.array,R=this.attributes.uv.array,z=y.length/6,F=new Le,ee=.5/v;for(let H=0,V=0;H<y.length;H+=3,V+=2)switch(C.fromArray(y,H),c.copy(C),c.x-=Math.sign(c.x)*ee,c.y-=Math.sign(c.y)*ee,c.z-=Math.sign(c.z)*ee,c.normalize(),y[H+0]=M.x*Math.sign(C.x)+c.x*f,y[H+1]=M.y*Math.sign(C.y)+c.y*f,y[H+2]=M.z*Math.sign(C.z)+c.z*f,I[H+0]=c.x,I[H+1]=c.y,I[H+2]=c.z,Math.floor(H/z)){case 0:F.set(1,0,0),R[V+0]=oe(F,c,"z","y",f,p),R[V+1]=1-oe(F,c,"y","z",f,s);break;case 1:F.set(-1,0,0),R[V+0]=1-oe(F,c,"z","y",f,p),R[V+1]=1-oe(F,c,"y","z",f,s);break;case 2:F.set(0,1,0),R[V+0]=1-oe(F,c,"x","z",f,r),R[V+1]=oe(F,c,"z","x",f,p);break;case 3:F.set(0,-1,0),R[V+0]=1-oe(F,c,"x","z",f,r),R[V+1]=1-oe(F,c,"z","x",f,p);break;case 4:F.set(0,0,1),R[V+0]=1-oe(F,c,"x","y",f,r),R[V+1]=1-oe(F,c,"y","x",f,s);break;case 5:F.set(0,0,-1),R[V+0]=oe(F,c,"x","y",f,r),R[V+1]=1-oe(F,c,"y","x",f,s);break}}};import{BufferAttribute as fn,BufferGeometry as hn,Float32BufferAttribute as $n,InstancedBufferAttribute as Jn,InterleavedBuffer as jn,InterleavedBufferAttribute as ei,TriangleFanDrawMode as ti,TriangleStripDrawMode as ri,TrianglesDrawMode as ni,Vector3 as ii}from"./three.module.min.js";function pn(l,r=!1){let s=l[0].index!==null,p=new Set(Object.keys(l[0].attributes)),v=new Set(Object.keys(l[0].morphAttributes)),f={},S={},C=l[0].morphTargetsRelative,c=new hn,M=0;for(let y=0;y<l.length;++y){let I=l[y],R=0;if(s!==(I.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+y+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let z in I.attributes){if(!p.has(z))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+y+'. All geometries must have compatible attributes; make sure "'+z+'" attribute exists among all geometries, or in none of them.'),null;f[z]===void 0&&(f[z]=[]),f[z].push(I.attributes[z]),R++}if(R!==p.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+y+". Make sure all geometries have the same number of attributes."),null;if(C!==I.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+y+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let z in I.morphAttributes){if(!v.has(z))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+y+".  .morphAttributes must be consistent throughout all geometries."),null;S[z]===void 0&&(S[z]=[]),S[z].push(I.morphAttributes[z])}if(r){let z;if(s)z=I.index.count;else if(I.attributes.position!==void 0)z=I.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+y+". The geometry must have either an index or a position attribute"),null;c.addGroup(M,z,y),M+=z}}if(s){let y=0,I=[];for(let R=0;R<l.length;++R){let z=l[R].index;for(let F=0;F<z.count;++F)I.push(z.getX(F)+y);y+=l[R].attributes.position.count}c.setIndex(I)}for(let y in f){let I=Zt(f[y]);if(!I)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+y+" attribute."),null;c.setAttribute(y,I)}for(let y in S){let I=S[y][0].length;if(I===0)break;c.morphAttributes=c.morphAttributes||{},c.morphAttributes[y]=[];for(let R=0;R<I;++R){let z=[];for(let ee=0;ee<S[y].length;++ee)z.push(S[y][ee][R]);let F=Zt(z);if(!F)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+y+" morphAttribute."),null;c.morphAttributes[y].push(F)}}return c}function Zt(l){let r,s,p,v=-1,f=0;for(let M=0;M<l.length;++M){let y=l[M];if(y.isInterleavedBufferAttribute)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. InterleavedBufferAttributes are not supported."),null;if(r===void 0&&(r=y.array.constructor),r!==y.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(s===void 0&&(s=y.itemSize),s!==y.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(p===void 0&&(p=y.normalized),p!==y.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(v===-1&&(v=y.gpuType),v!==y.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;f+=y.array.length}let S=new r(f),C=0;for(let M=0;M<l.length;++M)S.set(l[M].array,C),C+=l[M].array.length;let c=new fn(S,s,p);return v!==void 0&&(c.gpuType=v),c}export{mt as EXRLoader,ot as EffectComposer,Xr as FXAAShader,ut as OutputPass,st as RenderPass,gt as RoundedBoxGeometry,Ne as ShaderPass,Be as UnrealBloomPass,pn as mergeGeometries};
/*! Bundled license information:

three/examples/jsm/libs/fflate.module.js:
  (*!
  fflate - fast JavaScript compression/decompression
  <https://101arrowz.github.io/fflate>
  Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
  version 0.6.9
  *)
*/
