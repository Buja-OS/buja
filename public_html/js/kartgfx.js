// Buja Kart graphics: the kart and driver model, image-based lighting, post-processing and nitro flames.
// Everything the player owns shows on the kart: paint, livery, helmet, driver, wheels (handling), engine and
// exhaust (speed), air intake and turbo (acceleration), nitro bottles and flame colour (nitro).
// Liveries and helmet designs are drawn by the GPU from the kart's own coordinates, so they stay sharp up close
// and need no image downloads.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader, EXRLoader, RoundedBoxGeometry, mergeGeometries } from './vendor/kart-fx.js';

const TEX = '/assets/kart/';
export const DESIGN_ID = { classic: 0, stripes: 1, naija: 2, flames: 3, carbon: 4, neon: 5 };
export const HELMET_ID = { classic: 0, chevron: 1, naija: 2, gold: 3, carbon: 4, chrome: 5 };
/** Each driver's race suit, glove colour and kart number. */
export const SUITS = {
  green:  { suit: '#1E9E55', trim: '#FFFFFF', glove: '#111418', num: 7,  skin: '#6B4430' },
  red:    { suit: '#D8322A', trim: '#F2E6D0', glove: '#15171B', num: 11, skin: '#5A3826' },
  yellow: { suit: '#F2B51C', trim: '#1B1C20', glove: '#1B1C20', num: 23, skin: '#7A4E36' },
  blue:   { suit: '#2459D6', trim: '#FFFFFF', glove: '#101216', num: 44, skin: '#4E3122' },
};
/** Nitro flame colours by nitro level: orange, then blue, violet, and a white-hot magenta at the top. */
export const FLAME = [['#FFD27A', '#FF7A1A'], ['#BFF3FF', '#2FA8FF'], ['#BFF3FF', '#2FA8FF'], ['#F0D6FF', '#9B5CFF'], ['#F0D6FF', '#9B5CFF'], ['#FFFFFF', '#FF3DC8']];
const HDR_FOR = { day: 'park', sunset: 'sunrise', harmattan: 'dawn', night: 'night' };

const texCache = {};
function tex(name, { srgb = true, rep = 1 } = {}) {
  const k = name + rep; if (texCache[k]) return texCache[k];
  const t = new THREE.TextureLoader().load(TEX + name); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[k] = t);
}

/* ------------------------------------------------------------------ lighting ------------------------------------------------------------------ */
/** Real-world light from a photographed sky (CC0 HDRI), prefiltered for reflections. Falls back to the procedural sky. */
export async function loadEnvironment(renderer, env, fallbackScene) {
  const name = HDR_FOR[env] || 'park';
  try {
    const hdr = await new EXRLoader().loadAsync(TEX + 'hdr/' + name + '.exr');
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromEquirectangular(hdr); pm.dispose(); hdr.dispose();
    return rt.texture;
  } catch {
    if (!fallbackScene) return null;
    const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(fallbackScene, 0, 0.1, 10000).texture; pm.dispose(); return t;
  }
}

/* ------------------------------------------------------------------ post-processing ------------------------------------------------------------------ */
// Final grade: vignette, a touch of contrast and saturation, and a radial speed blur while the nitro burns.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uVig: { value: 0.28 }, uSat: { value: 1.16 }, uContrast: { value: 1.1 }, uTaps: { value: 6 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uBlur, uVig, uSat, uContrast; varying vec2 vUv;
    void main(){
      vec2 c = vec2(0.5, 0.56); vec2 d = vUv - c; vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (uBlur > 0.001) { float w = 1.0; float r = length(d);
        for (int i = 1; i <= 6; i++) { float s = 1.0 - uBlur * 0.009 * float(i) * smoothstep(0.15, 0.55, r); col += texture2D(tDiffuse, c + d * s).rgb; w += 1.0; }
        col /= w; }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      float v = smoothstep(0.95, 0.35, length(d * vec2(1.25, 1.0))); col *= mix(1.0 - uVig, 1.0, v);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};
/** The render chain for medium and high phones. Low phones draw straight to the screen and skip this. */
export function makePost(renderer, scene, camera, tier) {
  if (tier === 'low') return null;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier === 'high' && renderer.capabilities.isWebGL2 ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.5, 5.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  let fxaa = null;
  if (tier !== 'high' || !renderer.capabilities.isWebGL2) { fxaa = new ShaderPass(FXAAShader); fxaa.uniforms.resolution.value.set(1 / size.x, 1 / size.y); composer.addPass(fxaa); }
  const post = {
    composer, bloom, grade,
    render(boost) {
      const b = Math.max(0, Math.min(1, boost || 0));
      bloom.strength = 0.45 + b * 0.3; grade.uniforms.uBlur.value = tier === 'high' ? b : b * 0.6; grade.uniforms.uVig.value = 0.26 + b * 0.12;
      composer.render();
    },
    setSize(w, h) { composer.setSize(w, h); const s = renderer.getDrawingBufferSize(new THREE.Vector2()); if (fxaa) fxaa.uniforms.resolution.value.set(1 / s.x, 1 / s.y); },
    dispose() { rt.dispose(); composer.dispose && composer.dispose(); },
  };
  return post;
}

/* ------------------------------------------------------------------ materials ------------------------------------------------------------------ */
/**
 * Kart paint with its livery drawn from object-space position, so decals wrap every panel without textures.
 * The base colour stays in material.color, so the minimap and multiplayer recolouring keep working.
 */
function paintMaterial(colour, design, paint, tier) {
  const phys = tier === 'high';
  const special = paint === 'chrome' ? { metalness: 1, roughness: 0.06 } : paint === 'gold' ? { metalness: 1, roughness: 0.2 } : { metalness: 0.35, roughness: 0.34 };
  const m = phys ? new THREE.MeshPhysicalMaterial({ color: colour, ...special, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 })
    : new THREE.MeshStandardMaterial({ color: colour, ...special, envMapIntensity: 1.1 });
  const id = DESIGN_ID[design] || 0; m.defines = { KDESIGN: id };
  if (id === 4) { m.roughness = 0.3; m.metalness = 0.2; }
  const carbon = id === 4 ? tex('carbon.webp') : null;
  m.onBeforeCompile = (sh) => {
    if (carbon) sh.uniforms.uCarbon = { value: carbon };
    if (id === 3) sh.uniforms.uFlame = { value: flameTexture() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKPos; varying vec3 vKNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKPos = position; vKNrm = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vKPos; varying vec3 vKNrm;
      #if KDESIGN == 4
        uniform sampler2D uCarbon;
      #endif
      #if KDESIGN == 3
        uniform sampler2D uFlame;
      #endif
      float band(float x, float c, float w) { return smoothstep(w, w * 0.6, abs(x - c)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 P = vKPos; vec3 N = normalize(vKNrm); float top = smoothstep(0.15, 0.45, N.y); float side = smoothstep(0.35, 0.7, abs(N.x));
      #if KDESIGN == 1
        float s = max(band(abs(P.x), 0.17, 0.055), 0.0) * top; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.95, 0.92), s);
        float s2 = band(P.y, 0.52, 0.035) * side; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.95, 0.92), s2);
      #elif KDESIGN == 2
        float w = band(P.x, 0.0, 0.2) * top + band(P.y, 0.5, 0.06) * side; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96), clamp(w, 0.0, 1.0));
      #elif KDESIGN == 3
        // hot-rod flame artwork projected along both sides: tongues run from the nose back
        vec2 fu = vec2((1.98 - P.z) / 2.75, (P.y - 0.25) / 0.4);
        vec4 fl = texture2D(uFlame, fu) * side * step(0.0, fu.x) * step(fu.x, 1.0) * step(0.0, fu.y) * step(fu.y, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, fl.rgb, fl.a);
      #elif KDESIGN == 4
        vec3 bw = pow(abs(N), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 cf = texture2D(uCarbon, P.zy * 1.3).rgb * bw.x + texture2D(uCarbon, P.xz * 1.3).rgb * bw.y + texture2D(uCarbon, P.xy * 1.3).rgb * bw.z;
        diffuseColor.rgb = cf * 2.4; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.45, 0.1), band(P.x, 0.0, 0.045) * top);
      #elif KDESIGN == 5
        diffuseColor.rgb *= 0.35;
      #endif
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #if KDESIGN == 5
        float ln = band(P.y, 0.3, 0.018) * side + band(abs(P.x), 0.35, 0.02) * top;
        totalEmissiveRadiance += vec3(0.1, 0.9, 1.0) * ln * 9.0;
      #endif
      `);
  };
  m.customProgramCacheKey = () => 'kpaint' + id + (phys ? 'p' : 's');
  return m;
}
let _flameT = null;
/** Classic hot-rod flames: yellow at the root, orange, red tips, a dark outline. Front of the kart on the left. */
function flameTexture() {
  if (_flameT) return _flameT;
  const W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // five tongues, each a leaf shape rooted at the nose, reaching back along the side
  const tongues = [[0.14, 0.17, 0.7], [0.34, 0.2, 0.96], [0.55, 0.2, 0.84], [0.74, 0.18, 0.66], [0.88, 0.13, 0.46]];   // [centre height, half-height, reach]
  const leaf = ([yc, hh, reach]) => { const p = new Path2D(), y = H * (1 - yc), h = H * hh, x = W * reach;
    p.moveTo(0, y - h); p.bezierCurveTo(x * 0.45, y - h * 1.1, x * 0.8, y - h * 0.2, x, y + h * 0.15); p.bezierCurveTo(x * 0.7, y + h * 0.35, x * 0.35, y + h * 1.05, 0, y + h); p.closePath(); return p; };
  const paths = tongues.map(leaf);
  g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#1A0A06'; paths.forEach((p) => g.stroke(p));   // outline first, so only the outer edge shows
  const gr = g.createLinearGradient(0, 0, W * 0.95, 0); gr.addColorStop(0, '#FFE84D'); gr.addColorStop(0.3, '#FFA21A'); gr.addColorStop(0.62, '#EC3A1A'); gr.addColorStop(1, '#A80F0A');
  g.fillStyle = gr; paths.forEach((p) => g.fill(p));
  g.fillStyle = 'rgba(255,255,255,.35)'; paths.forEach((p, i) => { g.save(); g.clip(p); g.fillRect(0, H * (1 - tongues[i][0]) - H * tongues[i][1] * 0.9, W, H * tongues[i][1] * 0.35); g.restore(); });   // a highlight along each tongue
  _flameT = new THREE.CanvasTexture(c); _flameT.colorSpace = THREE.SRGBColorSpace; _flameT.anisotropy = 8; _flameT.wrapS = _flameT.wrapT = THREE.ClampToEdgeWrapping; return _flameT;
}
/** Helmet paint: the design is drawn from the helmet's own centre. */
function helmetMaterial(colour, design, tier) {
  const id = HELMET_ID[design] || 0;
  const base = { 0: colour, 1: colour, 2: '#008751', 3: '#D4A93A', 4: '#1C1E23', 5: '#E3E7EC' }[id];
  const mr = id === 3 ? [1, 0.18] : id === 5 ? [1, 0.04] : id === 4 ? [0.2, 0.35] : [0.1, 0.22];
  const m = tier === 'high' ? new THREE.MeshPhysicalMaterial({ color: base, metalness: mr[0], roughness: mr[1], clearcoat: id === 4 ? 0.4 : 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 })
    : new THREE.MeshStandardMaterial({ color: base, metalness: mr[0], roughness: mr[1], envMapIntensity: 1.2 });
  m.defines = { KHELM: id };
  const carbon = id === 4 ? tex('carbon.webp') : null;
  m.onBeforeCompile = (sh) => {
    if (carbon) sh.uniforms.uCarbon = { value: carbon };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 hPos; varying vec3 vH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = hPos;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vH;
      #if KHELM == 4
        uniform sampler2D uCarbon;
      #endif
      float band(float x, float c, float w) { return smoothstep(w, w * 0.6, abs(x - c)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 H = normalize(vH);
      #if KHELM == 1
        float c = band(H.x, 0.0, 0.2) - band(H.x, 0.0, 0.1); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.9, 0.8), clamp(c, 0.0, 1.0) * step(-0.2, H.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.9, 0.8), band(H.y, 0.05, 0.05) * step(H.z, 0.2));
      #elif KHELM == 2
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97), band(H.x, 0.0, 0.26) * step(-0.3, H.y));
      #elif KHELM == 4
        vec3 cf = texture2D(uCarbon, vH.zy * 6.0).rgb * 1.7; diffuseColor.rgb = cf; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.45, 0.1), band(H.x, 0.0, 0.08) * step(-0.2, H.y));
      #endif
      `);
  };
  m.customProgramCacheKey = () => 'khelm' + id + (tier === 'high' ? 'p' : 's');
  return m;
}

/* ------------------------------------------------------------------ geometry helpers ------------------------------------------------------------------ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Put a geometry where it belongs on the kart. */
function place(g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null } = {}) {
  const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), s ? (s.isVector3 ? s : V(s, s, s)) : V(1, 1, 1));
  g.applyMatrix4(m); return g;
}
/** A rounded box whose front end tapers: nose cones and side pods. */
function taperedBox(w, h, d, r, taperFront, taperBack = 0, seg = 3) {
  const g = new RoundedBoxGeometry(w, h, d, seg, r); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / (d / 2); // -1 back .. 1 front
    const k = z > 0 ? 1 - taperFront * z * z : 1 - taperBack * z * z;
    p.setX(i, p.getX(i) * k); if (z > 0) p.setY(i, p.getY(i) * (1 - taperFront * 0.45 * z * z) - h * 0.12 * z * z * taperFront);
  }
  g.computeVertexNormals(); return g;
}
/** A steel tube along a list of points. */
function tube(points, r, closed = false, seg = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => V(...p)), closed, 'catmullrom', 0.1), points.length * 8, r, seg, closed);
}
/** Paint a whole geometry one colour (for the vertex-coloured materials). */
function tint(g, colour) {
  const c = new THREE.Color(colour); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
/** Merge geometries that may or may not be indexed, keeping only position/normal/uv (+colour). */
function merge(list, withColour = false) {
  const clean = list.filter(Boolean).map((g) => {
    let x = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', ...(withColour ? ['color'] : []), 'hPos'].includes(k)) x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    if (withColour && !x.attributes.color) tint(x, '#ffffff');
    return x;
  });
  if (!clean.length) return null;
  // every piece must carry the same attribute set
  const names = Object.keys(clean[0].attributes); clean.forEach((x) => { for (const n of names) if (!x.attributes[n]) { const size = clean[0].attributes[n].itemSize; x.setAttribute(n, new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * size), size)); } for (const k of Object.keys(x.attributes)) if (!names.includes(k)) x.deleteAttribute(k); });
  return mergeGeometries(clean, false);
}

/* ------------------------------------------------------------------ wheels ------------------------------------------------------------------ */
/** Wheels get wider and fancier with the Wheels (handling) upgrade: steel, alloy, gold twin-spoke, carbon with a red lip. */
const RIMS = [
  { col: '#5C6068', spokes: 0, metal: 0.8, rough: 0.45 },
  { col: '#C9CDD2', spokes: 5, metal: 1, rough: 0.28 },
  { col: '#DADDE2', spokes: 5, metal: 1, rough: 0.18 },
  { col: '#C99A3A', spokes: 6, metal: 1, rough: 0.22, twin: true },
  { col: '#D4A93A', spokes: 6, metal: 1, rough: 0.16, twin: true },
  { col: '#1B1D22', spokes: 7, metal: 0.6, rough: 0.3, lip: '#E0342B' },
];
function makeWheel(front, level, tier, ghostMat) {
  const R = front ? 0.4 : 0.43, W = (front ? 0.3 : 0.38) + level * 0.015, rin = 0.23;
  // tyre profile, rotated about the axle (X): inner lip, sidewall, rounded shoulder, flat tread
  const prof = []; const sh = 0.07;
  prof.push([rin, -W / 2], [R - sh, -W / 2]);
  for (let a = 0; a <= 6; a++) { const t = (a / 6) * Math.PI / 2; prof.push([R - sh + Math.sin(t) * sh, -W / 2 + sh - Math.cos(t) * sh]); }
  for (let a = 0; a <= 6; a++) { const t = (a / 6) * Math.PI / 2; prof.push([R - sh + Math.cos(t) * sh, W / 2 - sh + Math.sin(t) * sh]); }
  prof.push([R - sh, W / 2], [rin, W / 2]);
  const tg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), tier === 'low' ? 14 : 24); tg.rotateZ(Math.PI / 2);
  const rim = RIMS[Math.min(5, level)];
  const parts = [];
  const barrel = new THREE.CylinderGeometry(rin, rin, W * 0.92, tier === 'low' ? 12 : 20, 1, true); barrel.rotateZ(Math.PI / 2); parts.push(barrel);
  const face = new THREE.CylinderGeometry(rin * 0.98, rin * 0.98, 0.02, tier === 'low' ? 12 : 20); face.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.06, 0.07, W * 0.5, 10); hub.rotateZ(Math.PI / 2); parts.push(hub);
  if (!rim.spokes) { place(face, { x: 0 }); parts.push(face); for (let i = 0; i < 4; i++) { const h = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8); h.rotateZ(Math.PI / 2); const a = i / 4 * Math.PI * 2; place(h, { x: 0.005, y: Math.cos(a) * 0.12, z: Math.sin(a) * 0.12 }); parts.push(h); } }
  else for (let i = 0; i < rim.spokes; i++) {
    const a = i / rim.spokes * Math.PI * 2;
    for (const off of rim.twin ? [-0.09, 0.09] : [0]) { const sp = new THREE.BoxGeometry(0.04, 0.2, 0.035); place(sp, { x: 0.02, y: Math.cos(a + off) * 0.11, z: Math.sin(a + off) * 0.11, rx: a + off }); parts.push(sp); }
  }
  const rimG = merge(parts);
  const g = new THREE.Group();
  if (ghostMat) { g.add(new THREE.Mesh(tg, ghostMat)); return g; }
  if (tier === 'low') { const one = merge([tint(tg.clone(), '#161616'), tint(rimG.clone(), rim.col)], true); g.add(new THREE.Mesh(one, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }))); g.userData.R = R; return g; }
  const tyreM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.86, normalMap: tier === 'low' ? null : tex('tread_n.webp', { srgb: false }), envMapIntensity: 0.4 });
  if (tyreM.normalMap) { tyreM.normalMap.repeat.set(10, 1); tyreM.normalScale.set(0.7, 0.7); }
  const rimM = new THREE.MeshStandardMaterial({ color: rim.col, metalness: rim.metal, roughness: rim.rough, envMapIntensity: 1.2 });
  const tm = new THREE.Mesh(tg, tyreM), rm = new THREE.Mesh(rimG, rimM); g.add(tm, rm);
  if (rim.lip) { const lip = new THREE.TorusGeometry(rin * 0.99, 0.018, 6, 24); lip.rotateY(Math.PI / 2); place(lip, { x: W * 0.46 }); g.add(new THREE.Mesh(lip, new THREE.MeshStandardMaterial({ color: rim.lip, roughness: 0.3, metalness: 0.4 }))); }
  // wheels on the kart's left face the other way
  g.userData.R = R;
  return g;
}

/* ------------------------------------------------------------------ nitro flames ------------------------------------------------------------------ */
const flameVS = `varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const flameFS = `uniform vec3 uCore; uniform vec3 uEdge; uniform float uTime; uniform float uPower; varying vec2 vUv; varying float vFace;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y); }
  void main(){
    float along = vUv.y;                       // 0 at the pipe, 1 at the tip
    float n = noise(vec2(vUv.x * 6.0, along * 5.0 - uTime * 14.0)) * 0.6 + noise(vec2(vUv.x * 13.0, along * 11.0 - uTime * 23.0)) * 0.4;
    float body = smoothstep(1.0, 0.25, along + n * 0.35) * smoothstep(0.0, 0.08, along);
    vec3 col = mix(uCore, uEdge, smoothstep(0.05, 0.6, along + n * 0.2));
    float a = body * uPower * mix(0.12, 1.0, vFace * vFace);   // seen end-on (from the chase camera) a jet of flame looks thin, not a wall of light
    gl_FragColor = vec4(col * (1.8 + 4.2 * (1.0 - along) * (1.0 - along)) * a * 0.85, a);
  }`;
/** Layered flame cones at each exhaust tip, additive, glowing through the bloom pass. */
function makeFlames(tips, level, tier) {
  const [core, edge] = FLAME[Math.min(5, level)];
  const mat = new THREE.ShaderMaterial({ uniforms: { uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: flameVS, fragmentShader: flameFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false });
  const len = 1.0 + level * 0.14, rad = 0.12 + level * 0.01;
  // wide at the pipe, narrowing to a tip behind the kart; the cone's UV v already runs 0 at the base to 1 at the tip
  const cone = new THREE.ConeGeometry(rad, len, tier === 'low' ? 8 : 14, 6, true); cone.translate(0, len / 2, 0); cone.rotateX(-Math.PI / 2);
  const inner = cone.clone(); inner.scale(0.55, 0.55, 0.7);
  const geos = []; tips.forEach((t) => { geos.push(cone.clone().translate(t.x, t.y, t.z)); if (level >= 3) geos.push(inner.clone().translate(t.x, t.y, t.z)); });
  const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'uv', 'normal'].includes(k)) g.deleteAttribute(k); return g; })), mat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: edge, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  glow.scale.set(0.7 + level * 0.05, 0.7 + level * 0.05, 1); const c = tips.reduce((a, t) => a.add(t), V(0, 0, 0)).multiplyScalar(1 / tips.length); glow.position.copy(c).add(V(0, 0, -0.2)); glow.visible = false;
  let light = null; if (tier === 'high') { light = new THREE.PointLight(edge, 0, 7, 2); light.position.copy(c).add(V(0, 0.2, -0.6)); }
  return { mesh, glow, light, mat, level,
    set(power, drift, t) {
      const on = power > 0.01; mesh.visible = glow.visible = on; mat.uniforms.uTime.value = t; mat.uniforms.uPower.value = power;
      if (drift) { mat.uniforms.uCore.value.set('#DDF6FF'); mat.uniforms.uEdge.value.set('#3AA0FF'); } else { mat.uniforms.uCore.value.set(core); mat.uniforms.uEdge.value.set(edge); }
      mesh.scale.set(1, 1, 0.75 + power * 0.35 + Math.random() * 0.12); glow.material.opacity = power * 0.22; glow.material.color.copy(mat.uniforms.uEdge.value);
      if (light) light.intensity = on ? 6 * power : 0;
    } };
}
let _glowT = null;
function glowTexture() {
  if (_glowT) return _glowT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glowT = new THREE.CanvasTexture(c); return _glowT;
}
let _shadowT = null;
export function blobShadowTexture() {
  if (_shadowT) return _shadowT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _shadowT = new THREE.CanvasTexture(c); return _shadowT;
}
/** The race number on the nose panel and side pods. */
function numberTexture(n, bg, fg) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.strokeStyle = fg; g.stroke();
  g.fillStyle = fg; g.font = '900 64px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ------------------------------------------------------------------ the kart ------------------------------------------------------------------ */
/**
 * Build a kart. opts: { colour, paint, design, helmet, driver, stats: {engine, accel, handling, boost}, tier, ghost, night }
 * Returns a Group with .wheels (front two first; spin on X, steer on Y), .paint (the body material), .flames, .driverParts.
 */
export function buildKart(opts) {
  const { tier = 'high', ghost = false } = opts;
  const lv = { engine: 0, accel: 0, handling: 0, boost: 0, stability: 0, ...(opts.stats || {}) };
  const suit = SUITS[opts.driver] || SUITS.green;
  let colour = opts.colour || suit.suit; const design = ghost ? 'classic' : (opts.design || 'classic'), helm = opts.helmet || 'classic';
  if (design === 'naija') colour = '#008751'; if (design === 'carbon') colour = '#1C1E23'; if (design === 'neon') colour = '#15171C';
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const ghostMat = ghost ? new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.3, depthWrite: false }) : null;
  const paintM = ghost ? ghostMat : paintMaterial(colour, design, opts.paint, tier);
  const low = tier === 'low';
  // vertex-coloured materials: one for every glossy metal part, one for the matte parts (plastics, suit, carbon)
  const metalM = ghost ? ghostMat : new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 0.26, envMapIntensity: 1.2 });
  const matteM = ghost ? ghostMat : new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.62, envMapIntensity: 0.7 });
  const carbonM = ghost || low ? matteM : new THREE.MeshStandardMaterial({ map: tex('carbon.webp', { rep: 3 }), normalMap: tex('carbon_n.webp', { srgb: false, rep: 3 }), roughness: 0.32, metalness: 0.2, envMapIntensity: 1.1 });
  const metal = [], matte = [], body = [], carbon = [];

  /* chassis: a steel tube frame, floor tray, bumpers */
  const frameCol = lv.engine >= 3 ? '#D9DDE2' : '#3C4048';
  for (const s of [-1, 1]) metal.push(tint(tube([[s * 0.5, 0.26, 1.35], [s * 0.55, 0.26, 0.6], [s * 0.6, 0.26, -0.4], [s * 0.62, 0.28, -1.15]], 0.045), frameCol));
  metal.push(tint(tube([[-0.5, 0.26, 1.35], [0, 0.3, 1.42], [0.5, 0.26, 1.35]], 0.04), frameCol));
  metal.push(tint(place(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8), { y: 0.43, z: -1.1, rz: Math.PI / 2 }), '#2A2D33'));   // rear axle
  metal.push(tint(place(new THREE.CylinderGeometry(0.035, 0.035, 1.75, 8), { y: 0.4, z: 1.1, rz: Math.PI / 2 }), frameCol));      // front stub axles
  carbon.push(place(new RoundedBoxGeometry(1.05, 0.05, 2.5, 2, 0.02), { y: 0.23, z: 0.05 }));
  // front nose cone and nose panel (paint), side pods (paint), rear bumper (black plastic)
  body.push(place(taperedBox(1.45, 0.34, 1.0, 0.14, 0.42, 0.05), { y: 0.42, z: 1.45 }));
  body.push(place(taperedBox(0.9, 0.52, 0.12, 0.05, 0.05), { y: 0.72, z: 0.82, rx: -0.95 }));   // nose panel in front of the driver's legs
  for (const s of [-1, 1]) body.push(place(taperedBox(0.34, 0.3, 1.25, 0.12, 0.35, 0.25), { x: s * 0.86, y: 0.45, z: -0.05 }));
  matte.push(tint(place(new RoundedBoxGeometry(1.95, 0.28, 0.32, 3, 0.1), { y: 0.42, z: -1.68 }), '#16171B'));
  matte.push(tint(place(new RoundedBoxGeometry(1.2, 0.18, 0.3, 3, 0.08), { y: 0.36, z: 1.98 }), '#16171B'));  // front bumper lip
  // seat: a moulded shell
  const seat = new THREE.SphereGeometry(0.42, low ? 10 : 18, low ? 8 : 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.5); seat.scale(0.85, 1.3, 0.9);
  matte.push(tint(place(seat, { y: 1.02, z: -0.5, rx: -0.2 }), '#1B1D22'));
  // steering column and wheel
  metal.push(tint(place(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), { y: 0.72, z: 0.42, rx: -1.05 }), '#8A8F96'));
  const sw = new THREE.TorusGeometry(0.19, 0.03, 6, low ? 14 : 22); matte.push(tint(place(sw, { y: 0.94, z: 0.18, rx: -1.05 + Math.PI / 2 }), '#131417'));
  matte.push(tint(place(new THREE.BoxGeometry(0.34, 0.035, 0.05), { y: 0.94, z: 0.18, rx: -1.05 + Math.PI / 2 }), '#1E2024'));
  // engine on the right rear: block and finned cylinder; bigger and brighter as Speed is upgraded
  const eg = 1 + lv.engine * 0.06;
  metal.push(tint(place(new RoundedBoxGeometry(0.4 * eg, 0.36 * eg, 0.42 * eg, 2, 0.05), { x: 0.52, y: 0.55, z: -0.95 }), '#9AA1A8'));
  for (let i = 0; i < 5 + lv.engine; i++) metal.push(tint(place(new THREE.CylinderGeometry(0.17 * eg, 0.17 * eg, 0.022, 14), { x: 0.52, y: 0.76 + i * 0.045, z: -0.95 }), '#B8BEC5'));
  if (lv.engine >= 2) metal.push(tint(place(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), { x: 0.52, y: 0.8 + (5 + lv.engine) * 0.045, z: -0.95 }), '#D4A93A'));
  // air intake: a small black box, a red filter, then a carbon ram-air scoop with chrome trumpets (Acceleration)
  if (lv.accel <= 1) matte.push(tint(place(new RoundedBoxGeometry(0.28, 0.2, 0.3, 2, 0.06), { x: -0.5, y: 0.62, z: -0.95 }), '#1A1B1F'));
  else if (lv.accel <= 3) { matte.push(tint(place(new THREE.CylinderGeometry(0.13, 0.15, 0.3, 14), { x: -0.5, y: 0.66, z: -0.95, rz: Math.PI / 2 }), '#D8322A')); metal.push(tint(place(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), { x: -0.2, y: 0.66, z: -0.95, rz: Math.PI / 2 }), '#C9CED6')); }
  else { carbon.push(place(taperedBox(0.34, 0.26, 0.55, 0.08, 0.3), { x: -0.5, y: 0.68, z: -0.9 })); for (const dz of [-0.12, 0.12]) metal.push(tint(place(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 12), { x: -0.5, y: 0.9, z: -0.95 + dz }), '#E6E9ED')); }
  if (lv.accel >= 5) metal.push(tint(place(new THREE.TorusGeometry(0.1, 0.045, 8, 16), { x: 0.2, y: 0.58, z: -1.25, ry: Math.PI / 2 }), '#C8A45A'));   // a turbo snail
  // exhaust: one pipe, twin pipes from Speed 3, four chrome tips at Speed 5; flames come out of each tip
  const pipes = lv.engine >= 5 ? 4 : lv.engine >= 3 ? 2 : 1; const tips = [];
  for (let i = 0; i < pipes; i++) {
    const x = 0.62 + (pipes > 1 ? (i % 2 ? 0.1 : -0.1) : 0), y = 0.52 + (pipes === 4 ? (i < 2 ? 0.1 : -0.06) : 0);
    metal.push(tint(tube([[0.52, 0.55, -0.8], [0.68, 0.45, -1.2], [x, y, -1.62]], 0.045 + lv.engine * 0.003), lv.engine >= 3 ? '#E6E9ED' : '#7E848C'));
    metal.push(tint(place(new THREE.CylinderGeometry(0.065, 0.055, 0.18, 12), { x, y, z: -1.72, rx: Math.PI / 2 }), lv.engine >= 5 ? '#8FA6FF' : '#D0D4DA'));
    tips.push(V(x, y, -1.82));
  }
  // rear wing: none, then a small wing (Speed 2), a big carbon wing with painted endplates (Speed 4)
  if (lv.engine >= 2) {
    const big = lv.engine >= 4; const w = big ? 1.9 : 1.4;
    (big ? carbon : matte).push(big ? place(new RoundedBoxGeometry(w, 0.05, 0.42, 2, 0.02), { y: 1.28, z: -1.72, rx: 0.12 }) : tint(place(new RoundedBoxGeometry(w, 0.05, 0.32, 2, 0.02), { y: 1.1, z: -1.68, rx: 0.1 }), '#1A1B1F'));
    for (const s of [-1, 1]) { metal.push(tint(place(new THREE.BoxGeometry(0.04, big ? 0.62 : 0.46, 0.05), { x: s * 0.45, y: big ? 0.98 : 0.86, z: -1.66 }), '#2A2D33')); if (big) body.push(place(new RoundedBoxGeometry(0.04, 0.34, 0.5, 2, 0.015), { x: s * w / 2, y: 1.25, z: -1.72 })); }
  }
  // nitro bottles behind the seat: one blue (Nitro 1), two (Nitro 3), two big with a glowing gauge (Nitro 5)
  const glow = [];
  if (lv.boost >= 1) {
    const n = lv.boost >= 3 ? 2 : 1, big = lv.boost >= 5, bcol = lv.boost >= 5 ? '#E0B040' : lv.boost >= 3 ? '#7B4CFF' : '#2A7BFF';
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i ? 0.18 : -0.18), r = big ? 0.1 : 0.08, h = big ? 0.62 : 0.5;
      metal.push(tint(place(new THREE.CapsuleGeometry(r, h, 4, 12), { x, y: 1.08, z: -0.98, rx: -0.35 }), bcol));
      metal.push(tint(place(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), { x, y: 1.45, z: -1.12, rx: -0.35 }), '#E6E9ED'));
    }
    if (big) glow.push(place(new THREE.BoxGeometry(0.1, 0.04, 0.02), { y: 1.0, z: -0.62, rx: -0.35 }));
  }
  // Stability: a front splitter (1), side skirts (3), a rear diffuser (5): the kart sits lower and wider
  if (lv.stability >= 1) carbon.push(place(taperedBox(1.6 + lv.stability * 0.04, 0.04, 0.5, 0.02, 0.2), { y: 0.26, z: 1.92 }));
  if (lv.stability >= 3) for (const s of [-1, 1]) carbon.push(place(new RoundedBoxGeometry(0.06, 0.1, 1.5, 2, 0.02), { x: s * 1.04, y: 0.3, z: -0.05 }));
  if (lv.stability >= 5) { carbon.push(place(new THREE.BoxGeometry(1.34, 0.03, 0.4), { y: 0.36, z: -1.8, rx: 0.28 })); for (let i = -2; i <= 2; i++) carbon.push(place(new THREE.BoxGeometry(0.03, 0.09, 0.36), { x: i * 0.3, y: 0.32, z: -1.8, rx: 0.28 })); }
  // headlights and brake light strip (they glow at night and under braking)
  for (const s of [-1, 1]) glow.push(place(new THREE.CircleGeometry(0.07, 12), { x: s * 0.36, y: 0.47, z: 1.86, rx: -0.25 }));
  if (design === 'neon') { const under = new THREE.PlaneGeometry(1.6, 3.2); under.rotateX(-Math.PI / 2); place(under, { y: 0.1 }); g.userData.under = under; }

  /* the driver: race suit in the driver's colours, gloves on the wheel, helmet from the shop */
  const D = [], Dm = [];
  const S = suit;
  const cap = (a, b, r, col) => { const va = V(...a), vb = V(...b); const len = va.distanceTo(vb); const c = new THREE.CapsuleGeometry(r, Math.max(0.01, len), 3, low ? 6 : 10);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), vb.clone().sub(va).normalize()); c.applyQuaternion(q); const mid = va.add(vb).multiplyScalar(0.5); c.translate(mid.x, mid.y, mid.z); return tint(c, col); };
  D.push(cap([0, 0.82, -0.52], [0, 1.28, -0.42], 0.26, S.suit));                  // torso, leaning back
  D.push(tint(place(new THREE.TorusGeometry(0.2, 0.05, 6, 16), { y: 1.44, z: -0.38, rx: Math.PI / 2 }), S.trim)); // collar
  for (const s of [-1, 1]) {
    D.push(cap([s * 0.24, 1.3, -0.4], [s * 0.34, 1.02, -0.06], 0.085, S.suit));   // upper arm
    D.push(cap([s * 0.34, 1.02, -0.06], [s * 0.19, 1.0, 0.16], 0.075, S.suit));   // forearm to the wheel
    D.push(tint(place(new THREE.SphereGeometry(0.075, 8, 6), { x: s * 0.18, y: 1.0, z: 0.19 }), S.glove));
    D.push(cap([s * 0.14, 0.62, -0.35], [s * 0.18, 0.7, 0.35], 0.11, S.suit));   // thigh
    D.push(cap([s * 0.18, 0.7, 0.35], [s * 0.14, 0.5, 0.95], 0.09, S.suit));     // shin under the nose
    D.push(tint(place(new THREE.BoxGeometry(0.035, 0.36, 0.04), { x: s * 0.265, y: 1.18, z: -0.42, rz: s * -0.15 }), S.trim)); // suit side stripe
  }
  const helmet = new THREE.SphereGeometry(0.29, low ? 14 : 24, low ? 10 : 18); helmet.scale(1, 1.06, 1.1);
  const hp = helmet.attributes.position; const hPos = new Float32Array(hp.count * 3); for (let i = 0; i < hp.count; i++) { hPos[i * 3] = hp.getX(i); hPos[i * 3 + 1] = hp.getY(i); hPos[i * 3 + 2] = hp.getZ(i); }
  helmet.setAttribute('hPos', new THREE.BufferAttribute(hPos, 3)); place(helmet, { y: 1.68, z: -0.34 });
  const chin = new THREE.SphereGeometry(0.3, 14, 8, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.55, Math.PI * 0.3); chin.scale(1, 1.05, 1.12);
  const cp = chin.attributes.position; const cPos = new Float32Array(cp.count * 3); for (let i = 0; i < cp.count; i++) { cPos[i * 3] = cp.getX(i); cPos[i * 3 + 1] = cp.getY(i); cPos[i * 3 + 2] = cp.getZ(i); } chin.setAttribute('hPos', new THREE.BufferAttribute(cPos, 3)); place(chin, { y: 1.68, z: -0.34 });
  const visorG = new THREE.SphereGeometry(0.302, low ? 12 : 22, 10, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.36, Math.PI * 0.2); visorG.scale(1, 1.06, 1.1); place(visorG, { y: 1.68, z: -0.34 });

  /* assemble: one mesh per material */
  const add = (geos, mat, colour = false) => { const m = merge(geos, colour); if (!m) return null; const mesh = new THREE.Mesh(m, mat); mesh.castShadow = !ghost; mesh.receiveShadow = !ghost && !low; g.add(mesh); return mesh; };
  add(body, paintM); g.paint = paintM;
  add(metal, metalM, true);
  if (low && !ghost) matte.push(tint(visorG.clone(), '#0E1116'));   // on low phones the visor rides along with the matte parts
  if (carbonM === matteM) add([...matte, ...carbon.map((c) => tint(c, '#202226'))], matteM, true); else { add(matte, matteM, true); add(carbon, carbonM); }
  const suitM = ghost ? ghostMat : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.6 });
  g.driver = add(D, suitM, true);
  g.helmet = add([helmet, chin], ghost ? ghostMat : helmetMaterial(S.suit === colour ? colour : (opts.helmetColour || colour), helm, tier));
  if (!low || ghost) add([visorG], ghost ? ghostMat : (tier === 'high' ? new THREE.MeshPhysicalMaterial({ color: '#0B0E14', metalness: 1, roughness: 0.04, iridescence: 1, iridescenceIOR: 1.6, envMapIntensity: 1.6 }) : new THREE.MeshStandardMaterial({ color: '#10141B', metalness: 1, roughness: 0.06, envMapIntensity: 1.5 })));
  if (!ghost) {
    const gm = new THREE.MeshStandardMaterial({ color: '#FFF3D6', emissive: '#FFE7B0', emissiveIntensity: opts.night ? 4 : 0.6, toneMapped: true });
    if (glow.length && (!low || opts.night)) g.lights = add(glow, gm);
    // brake light: its own material so its glow can follow the brake
    const bl = new THREE.Mesh(place(new THREE.BoxGeometry(1.1, 0.05, 0.02), { y: 0.5, z: -1.85 }), new THREE.MeshStandardMaterial({ color: '#400808', emissive: '#FF1A1A', emissiveIntensity: 0.25 })); g.add(bl); g.brakeLight = bl.material;
    if (g.userData.under) { const um = new THREE.Mesh(g.userData.under, new THREE.MeshBasicMaterial({ color: '#22E0FF', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); g.add(um); }
    // race numbers: the nose panel and both side pods
    const nt = numberTexture(S.num, '#FFFFFF', '#111418'); const nm = new THREE.MeshStandardMaterial({ map: nt, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    const num = merge([place(new THREE.PlaneGeometry(0.34, 0.34), { y: 0.8, z: 0.87, rx: -0.95 }), place(new THREE.PlaneGeometry(0.32, 0.32), { x: 1.04, y: 0.47, z: 0.0, ry: Math.PI / 2 }), place(new THREE.PlaneGeometry(0.32, 0.32), { x: -1.04, y: 0.47, z: 0.0, ry: -Math.PI / 2 })]);
    if (!low) g.add(new THREE.Mesh(num, nm));
    // a soft contact shadow so the kart sits on the road even where real shadows are off
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.4), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, opacity: low ? 1 : 0.75 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.035; sh.renderOrder = 1; g.add(sh);
  }
  /* wheels */
  const hl = Math.min(5, lv.handling);
  g.wheels = [[-0.95, 1.1, true], [0.95, 1.1, true], [-0.98, -1.1, false], [0.98, -1.1, false]].map(([x, z, front]) => {
    const w = makeWheel(front, hl, tier, ghostMat); w.rotation.order = 'YXZ'; if (x < 0) w.children.forEach((c) => { c.rotation.y = Math.PI; });
    w.position.set(x, w.userData.R, z); w.traverse((o) => { if (o.isMesh) o.castShadow = !ghost; }); g.add(w); return w;
  });
  /* nitro flames */
  if (!ghost) { g.flames = makeFlames(tips, Math.min(5, lv.boost), tier); g.add(g.flames.mesh, g.flames.glow); if (g.flames.light) g.add(g.flames.light); }
  g.v = 0; g.h = 0; g.lap = 1; g.s = 0; g.boost = 0; g.drift = 0; g.idx = 0; g.lean = 0; g.pitch = 0; g.colour = colour;
  return g;
}

/* ------------------------------------------------------------------ sky dressing ------------------------------------------------------------------ */
/** Drifting clouds for day, sunset and harmattan; stars at night. */
export function buildSky(scene, env, tier) {
  const out = { update() {} };
  if (env.night) {
    const n = tier === 'low' ? 400 : 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * Math.PI * 2, v = Math.random() * 0.45 + 0.05; const r = 4200; p[i * 3] = Math.cos(u) * Math.cos(v) * r; p[i * 3 + 1] = Math.sin(v) * r; p[i * 3 + 2] = Math.sin(u) * Math.cos(v) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#DDE6FF', map: glowTexture(), size: 3, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false })));
    return out;
  }
  const t = tex('cloud.png'); const tintC = env.harmattan ? '#E8D6B8' : env.sunset ? '#FFD2B0' : '#FFFFFF';
  const mat = new THREE.SpriteMaterial({ map: t, color: tintC, transparent: true, depthWrite: false, fog: false, opacity: env.harmattan ? 0.55 : 0.9 });
  const clouds = []; const N = tier === 'low' ? 14 : 30;
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 1400 + Math.random() * 2400, s = 380 + Math.random() * 520;
    const c = new THREE.Sprite(mat); c.position.set(Math.cos(a) * r, 520 + Math.random() * 520, Math.sin(a) * r); c.scale.set(s * 1.8, s * 0.7, 1); scene.add(c); clouds.push(c);
  }
  out.update = (dt) => { for (const c of clouds) { c.position.x += dt * 6; if (c.position.x > 3800) c.position.x = -3800; } };
  return out;
}

/* ------------------------------------------------------------------ foliage ------------------------------------------------------------------ */
/** Palm fronds and leafy crowns as crossed, alpha-tested cards: far more alive than solid blobs, still one draw call each. */
export function foliageGeometries() {
  // palm crown: 9 fronds arching out and down from the top of the trunk
  const fr = []; for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(4.6, 1.3, 6, 1); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k) + 2.3; p.setX(k, x); p.setY(k, p.getY(k) - 0.09 * x * x); }
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * 0.5 + (i % 2) * 0.5);
    g.rotateX(-0.25); g.rotateY(i / 9 * Math.PI * 2 + (i % 2) * 0.2); g.translate(0, 9.1, 0); fr.push(g);
  }
  const palm = mergeGeometries(fr.map((g) => { g.deleteAttribute('normal'); g.computeVertexNormals(); return g; }));
  // leafy crown: 3 crossed cards plus a flat top
  const cr = []; for (let i = 0; i < 3; i++) { const g = new THREE.PlaneGeometry(7.2, 6.4); g.rotateY(i / 3 * Math.PI); g.translate(0, 6.2, 0); cr.push(g); }
  const top = new THREE.PlaneGeometry(6.8, 6.8); top.rotateX(-Math.PI / 2); top.translate(0, 7.4, 0); cr.push(top);
  const crown = mergeGeometries(cr);
  // lift normals toward the sky so the cards light like a round canopy, not flat paper
  for (const geo of [palm, crown]) { const n = geo.attributes.normal; for (let k = 0; k < n.count; k++) { const v = V(n.getX(k), n.getY(k) + 1.2, n.getZ(k)).normalize(); n.setXYZ(k, v.x, v.y, v.z); } }
  return { palm, crown };
}
export function foliageMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ map: tex(kind === 'palm' ? 'palm.png' : 'leaves.png'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.5 });
  m.map.wrapS = m.map.wrapT = THREE.ClampToEdgeWrapping;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: 0.45 });
  return { m, depth };
}
export { tex };
