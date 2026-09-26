// Buja Kart: Abuja's expressways and the adverts along every track. The expressway routes (Aminu Kano Crescent,
// Airport Road, Kubwa Expressway) are drawn the way the real roads look: a wide carriageway you race on, a grass
// median with trees and double-arm lamps, the opposite carriageway with oncoming traffic, flyovers, footbridges,
// rail bridges, green direction signs and the hills round the city. Everything that repeats is instanced or merged,
// so a phone draws it in a few dozen calls. Loaded with kart.js; nothing here runs outside a race.
import * as THREE from './vendor/three.module.min.js';

const M = (o) => new THREE.MeshStandardMaterial(o);
const Y = new THREE.Vector3(0, 1, 0);
const TEX = '/assets/kart/';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
/** Text sized down until it fits the width. */
function fitText(g, text, weight, maxPx, maxW, family = 'Inter, system-ui, sans-serif') { let px = maxPx; do { g.font = `${weight} ${px}px ${family}`; px -= 2; } while (px > 8 && g.measureText(text).width > maxW); }
function spaced(g, text, x, y, gap) { // letter-spaced text, centred on x
  const widths = [...text].map((ch) => g.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let cx = x - total / 2; g.textAlign = 'left'; [...text].forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + gap; });
}

function mergeList(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g)); const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) { const size = geos[0].attributes[name].itemSize; const arr = new Float32Array(geos.reduce((n, g) => n + g.attributes[name].array.length, 0)); let o = 0; geos.forEach((g) => { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }); out.setAttribute(name, new THREE.BufferAttribute(arr, size)); }
  return out;
}

/* ================================== the adverts ================================== */
// FREDMIND: the winged F on white, the name in wide capitals. Buja: the bridge mark, the name, and the app's own line.
function drawFred(g, x, y, w, h, img) {
  g.fillStyle = '#FAFAF7'; g.fillRect(x, y, w, h);
  g.fillStyle = '#111114'; g.fillRect(x, y + h - h * 0.06, w, h * 0.06);
  const markH = h * 0.66, markW = img ? markH * img.width / img.height : 0;
  const text = 'FREDMIND'; g.fillStyle = '#111114'; g.textBaseline = 'middle';
  if (w / h > 3.2) { // a long strip: mark then name, side by side
    if (img) g.drawImage(img, x + w * 0.08, y + (h - markH) / 2 - h * 0.03, markW, markH);
    fitText(g, text, 600, h * 0.5, w * 0.62); spaced(g, text, x + w * 0.58, y + h * 0.47, h * 0.12);
  } else {
    if (img) g.drawImage(img, x + (w - markW * 0.8) / 2, y + h * 0.08, markW * 0.8, markH * 0.8);
    fitText(g, text, 600, h * 0.2, w * 0.8); spaced(g, text, x + w / 2, y + h * 0.8, h * 0.05);
  }
}
function drawBuja(g, x, y, w, h, img) {
  g.fillStyle = '#FFFFFF'; g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#7ED957'); gr.addColorStop(1, '#FF7A1A'); g.fillStyle = gr; g.fillRect(x, y + h - h * 0.07, w, h * 0.07);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  if (w / h > 3.2) {
    const mh = h * 0.72, mw = img ? mh * img.width / img.height : 0; if (img) g.drawImage(img, x + w * 0.06, y + (h - mh) / 2 - h * 0.03, mw, mh);
    g.fillStyle = '#1D1D22'; fitText(g, 'Buja', 900, h * 0.62, w * 0.3); g.fillText('Buja', x + w * 0.06 + mw + h * 0.25, y + h * 0.46);
    g.fillStyle = '#2E7D1E'; fitText(g, "Abuja's everyday app", 700, h * 0.3, w * 0.4); g.textAlign = 'right'; g.fillText("Abuja's everyday app", x + w * 0.96, y + h * 0.47);
  } else {
    const mh = h * 0.5, mw = img ? mh * img.width / img.height : 0; if (img) g.drawImage(img, x + w * 0.07, y + h * 0.12, mw, mh);
    g.fillStyle = '#1D1D22'; fitText(g, 'Buja', 900, h * 0.42, w * 0.5); g.fillText('Buja', x + w * 0.1 + mw, y + h * 0.38);
    g.fillStyle = '#2E7D1E'; fitText(g, "Abuja's everyday app", 700, h * 0.14, w * 0.84); g.textAlign = 'center'; g.fillText("Abuja's everyday app", x + w / 2, y + h * 0.8);
  }
}
/** The two adverts as textures: a board (both stacked, for the screens that switch between them) and two strips. */
export async function adTextures() {
  const [fred, buja] = await Promise.all([loadImg(TEX + 'ads/fredmind-mark.png'), loadImg(TEX + 'ads/buja-mark.png')]);
  const board = canvasTex(1024, 1024, (g) => { drawFred(g, 0, 0, 1024, 512, fred); drawBuja(g, 0, 512, 1024, 512, buja); });
  const strips = [drawFred, drawBuja].map((d, i) => canvasTex(1024, 160, (g) => d(g, 0, 0, 1024, 160, i ? buja : fred)));
  return { board, strips };
}

/**
 * Adverts on every track: tall LED billboards by the road that switch between FREDMIND and Buja as you race,
 * and low boards along the barriers. Call race.adTick(now) each frame.
 */
export async function buildAds(R, { roadW, twin, clearOfTrack }) {
  const ads = await adTextures(); const N = R.samples.length, T = R.tier;
  const night = !!(R.env && R.env.night);
  // Two sets of screens half a cycle apart, so the road always shows both brands
  const phase = [0, 1].map((k) => { const t = ads.board.clone(); t.needsUpdate = true; t.repeat.set(1, 0.5); t.offset.set(0, k ? 0 : 0.5); return t; });
  const frame = M({ color: '#1B1E23', roughness: 0.5, metalness: 0.6 });
  const screens = phase.map((t) => M({ map: t, emissive: '#FFFFFF', emissiveMap: t, emissiveIntensity: night ? 0.9 : 0.16, roughness: 0.35 }));
  const panel = new THREE.BoxGeometry(10.5, 5.25, 0.4); panel.clearGroups();   // one material for every face: one draw call per set of boards
  const pole = new THREE.CylinderGeometry(0.42, 0.55, 9.6, 10); pole.translate(0, 4.8, 0);
  const every = 52, max = Math.ceil(N / every) + 2;
  const polesM = new THREE.InstancedMesh(pole, M({ color: '#6B7079', roughness: 0.45, metalness: 0.7 }), max);
  const boards = [0, 1].map((k) => new THREE.InstancedMesh(panel, screens[k], max));
  const rim = new THREE.BoxGeometry(10.9, 5.6, 0.3); rim.translate(0, 0, -0.1); const rims = new THREE.InstancedMesh(rim, frame, max * 2); let nr = 0;
  const bridges = (R.circuit.bridges || []).map((b) => b.s); const marks = R.circuit.landmarks || [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); let np = 0; const nb = [0, 0];
  for (let s = 20, k = 0; s < N; s += every, k++) {
    const sides = twin ? [1] : [k % 2 ? 1 : -1];
    for (const side of sides) {
      const p = R.samples[s], t = R.tangents[s], off = side * (roadW / 2 + (twin ? (R.circuit.service ? 26 : 15) : 11.5));   // on city streets, just behind the barrier
      const x = p.x - t.z * off, z = p.z + t.x * off;
      if (!clearOfTrack(x, z, roadW / 2 + (twin ? 9 : 6)) || bridges.some((b) => Math.min(Math.abs(b - s), N - Math.abs(b - s)) < 14) || marks.some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 80 * 80)) continue;
      if ((R.circuit.noBuild || []).some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r)) continue;
      // face the karts coming towards it, turned a little towards the road
      const nx = -t.x + 0.4 * side * t.z, nz = -t.z - 0.4 * side * t.x; q.setFromAxisAngle(Y, Math.atan2(nx, nz));
      m4.compose(new THREE.Vector3(x, 0, z), q, one); polesM.setMatrixAt(np++, m4);
      const b = k % 2; m4.compose(new THREE.Vector3(x, 12.1, z), q, one); boards[b].setMatrixAt(nb[b]++, m4); rims.setMatrixAt(nr++, m4);
    }
  }
  polesM.count = np; rims.count = nr; R.scene.add(rims); boards.forEach((b, i) => { b.count = nb[i]; b.castShadow = T !== 'low'; R.scene.add(b); }); polesM.castShadow = T !== 'low'; R.scene.add(polesM);
  // switch the screens every seven seconds, with a quick blank between, the way LED boards do
  let last = 0, showing = 0;
  R.adTick = (now) => {
    const cyc = Math.floor(now / 7000);
    if (cyc !== last) { last = cyc; showing = cyc % 2; phase.forEach((t, k) => t.offset.set(0, (showing + k) % 2 ? 0 : 0.5)); screens.forEach((m) => { m.emissiveIntensity = 0; }); R._adFlash = now; }
    if (R._adFlash && now - R._adFlash > 120) { screens.forEach((m) => { m.emissiveIntensity = night ? 0.9 : 0.16; }); R._adFlash = 0; }
  };
  // Low boards along the barriers at four places round the lap, alternating the two brands
  const hoard = new THREE.PlaneGeometry(7.4, 1.3);
  // the steel frame behind each board, on two legs, standing just behind the barrier
  const fb = new THREE.BoxGeometry(7.6, 1.5, 0.12); fb.translate(0, 0, -0.08); const legs = [-3.2, 3.2].map((x) => { const l = new THREE.BoxGeometry(0.12, 1.3, 0.12); l.translate(x, -1.3, -0.08); return l; });
  const frameM = new THREE.InstancedMesh(mergeList([fb, ...legs]), M({ color: '#2A2E34', roughness: 0.5, metalness: 0.6 }), 90); let nf = 0;
  const hm = ads.strips.map((t) => M({ map: t, roughness: 0.55, emissive: '#FFFFFF', emissiveMap: t, emissiveIntensity: night ? 0.5 : 0.06 }));
  const HN = 90, hMesh = hm.map((m) => new THREE.InstancedMesh(hoard, m, HN)); const hn = [0, 0];
  const sides = twin ? [1] : [-1, 1]; const offB = roadW / 2 + 10.1;
  for (const at of T === 'low' ? [0.06, 0.38, 0.72] : [0.06, 0.22, 0.38, 0.55, 0.72, 0.88]) {
    const s0 = Math.floor(at * N);
    for (const side of sides) for (let j = 0; j < 6; j++) {
      const s = (s0 + j * 2) % N; const p = R.samples[s], t = R.tangents[s];
      const x = p.x - t.z * side * offB, z = p.z + t.x * side * offB;
      if (R.nearest(x, z).dist < offB - 3 || bridges.some((b) => Math.abs(b - s) < 6)) continue;
      if ((R.circuit.noBuild || []).some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r)) continue;
      q.setFromAxisAngle(Y, Math.atan2(t.x, t.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2));   // the printed side faces the road
      const b = (j + (side > 0 ? 0 : 1)) % 2; if (hn[b] >= HN) continue;
      m4.compose(new THREE.Vector3(x, 1.95, z), q, one); hMesh[b].setMatrixAt(hn[b]++, m4); if (nf < 90) frameM.setMatrixAt(nf++, m4);
    }
  }
  hMesh.forEach((m, i) => { m.count = hn[i]; R.scene.add(m); }); frameM.count = nf; R.scene.add(frameM);
  return ads;
}

/* ================================== the expressways ================================== */
/**
 * Everything beside and above the race carriageway on an expressway route. R is the race: it has samples,
 * tangents, ribbon(), scene, tex, tier and circuit. Returns the helpers the rest of the world needs.
 */
export function buildExpressway(R, H) {
  const C = R.circuit, N = R.samples.length, RW = C.roadW, MED = C.twin.median, T = R.tier;
  const P = R.samples, TN = R.tangents;
  const at = (i, lat) => { const p = P[i], t = TN[i]; return [p.x - t.z * lat, p.z + t.x * lat]; };
  const twinLat = -(RW + MED);
  R.twinPts = P.map((_, i) => { const [x, z] = at(i, twinLat); return new THREE.Vector3(x, 0, z); });
  const asphalt = R.roadMat; R.parkCars = [];
  const concrete = M({ color: '#C9C3B6', roughness: 0.85, map: R.tex.pave, envMapIntensity: 0.4 });
  const steel = M({ color: '#8A9099', roughness: 0.4, metalness: 0.75 });
  const white = M({ color: '#F4F2EC', roughness: 0.6 });

  // the opposite carriageway
  const tw = new THREE.Mesh(R.ribbon(twinLat - RW / 2, twinLat + RW / 2, 0.02), asphalt); tw.receiveShadow = true; R.scene.add(tw);
  // the raised grass median, edged with kerbs painted black and yellow
  const gt = R.tex.grass.clone(); gt.needsUpdate = true; gt.repeat.set(1 / 10, 1 / 10);
  const gn = R.tex.grassN ? R.tex.grassN.clone() : null; if (gn) { gn.needsUpdate = true; gn.repeat.set(1 / 10, 1 / 10); }
  const med = new THREE.Mesh(R.ribbon(-(RW / 2 + MED - 0.4), -(RW / 2 + 0.4), 0.26), M({ map: gt, normalMap: gn, roughness: 1, envMapIntensity: 0.4, color: '#D8E6C0' })); med.receiveShadow = true; R.scene.add(med);
  kerbs(R, [-(RW / 2), -(RW / 2 + 0.45)], [-(RW / 2 + MED), -(RW / 2 + MED - 0.45)]);
  // painted lanes on the opposite carriageway
  laneLines(R, twinLat, RW, C.lanes || 3);

  // service road (Kubwa): beyond the guard rail, separated by grass
  if (C.service) {
    const sv = new THREE.Mesh(R.ribbon(RW / 2 + 12, RW / 2 + 19.5, 0.02), asphalt); sv.receiveShadow = true; R.scene.add(sv);
    laneLines(R, RW / 2 + 15.75, 7.5, 2);
  }

  // Median: trees (cypress on the expressways, palms in Wuse) and tall double-arm lamps, instanced
  const mid = -(RW / 2 + MED / 2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const treeN = Math.ceil(N / 3);
  if (C.twin.trees === 'palm') {
    const fol = H.foliageGeometries(); const trunk = new THREE.CylinderGeometry(0.22, 0.36, 9, 7); trunk.translate(0, 4.5, 0);
    const pf = H.foliageMaterial('palm'); const tm = new THREE.InstancedMesh(trunk, M({ color: '#8C7A5E', roughness: 0.9, map: R.tex.rock }), treeN), fm = new THREE.InstancedMesh(fol.palm, pf.m, treeN); fm.customDepthMaterial = pf.depth;
    let n = 0; for (let s = 1; s < N; s += 4) { if (bridgeNear(C, s, N, 5)) continue; const [x, z] = at(s, mid); const k = 0.85 + Math.random() * 0.3; m4.compose(v.set(x, 0.26, z), q.setFromAxisAngle(Y, Math.random() * 6), sc.set(k, k, k)); tm.setMatrixAt(n, m4); fm.setMatrixAt(n, m4); n++; }
    tm.count = fm.count = n; [tm, fm].forEach((m) => { m.castShadow = T !== 'low'; R.scene.add(m); });
  } else {
    const cone = new THREE.ConeGeometry(1.25, 8.5, 7); cone.translate(0, 6.2, 0); const cone2 = new THREE.ConeGeometry(0.95, 5, 7); cone2.translate(0, 9.6, 0);
    const crown = H.mergeGeos([cone, cone2]); const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6); trunk.translate(0, 1.2, 0);
    const cm = new THREE.InstancedMesh(crown, M({ color: '#FFFFFF', roughness: 0.92, envMapIntensity: 0.25 }), treeN * 2), tm = new THREE.InstancedMesh(trunk, M({ color: '#6B5842', roughness: 0.9 }), treeN * 2);
    const col = new THREE.Color(); let n = 0;
    for (let s = 0; s < N; s += T === 'low' ? 5 : 3) { if (bridgeNear(C, s, N, 5)) continue; for (const d of MED > 10 && T !== 'low' ? [-2.2, 2.2] : [0]) { if (s % 10 === 0 && d === 0) continue; const [x, z] = at(s, mid + d + (Math.random() - 0.5) * 0.6); const k = 0.8 + Math.random() * 0.45; m4.compose(v.set(x, 0.26, z), q.setFromAxisAngle(Y, Math.random() * 6), sc.set(k, k * (0.9 + Math.random() * 0.3), k)); cm.setMatrixAt(n, m4); tm.setMatrixAt(n, m4); cm.setColorAt(n, col.setHSL(0.25 + Math.random() * 0.06, 0.38 + Math.random() * 0.15, 0.2 + Math.random() * 0.08)); n++; } }
    cm.count = tm.count = n; [cm, tm].forEach((m) => { m.castShadow = T !== 'low'; R.scene.add(m); });
  }
  // double-arm lamps: a tall pole in the median, a curved arm out over each carriageway
  const pole = new THREE.CylinderGeometry(0.14, 0.24, 12, 8); pole.translate(0, 6, 0);
  const armGeo = (dir) => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 11.2, 0), new THREE.Vector3(dir * 1.2, 12.2, 0), new THREE.Vector3(dir * 3.2, 12.4, 0)]); return new THREE.TubeGeometry(c, T === 'low' ? 4 : 8, 0.08, T === 'low' ? 3 : 5); };
  const head = (dir) => { const g = new THREE.BoxGeometry(1.1, 0.2, 0.45); g.translate(dir * 3.5, 12.3, 0); return g; };
  const lampG = H.mergeGeos([pole, armGeo(1), armGeo(-1), head(1), head(-1)]);
  const LN = Math.ceil(N / 10) + 1, lm = new THREE.InstancedMesh(lampG, M({ color: '#9AA1A9', roughness: 0.35, metalness: 0.8 }), LN); let nl = 0; const heads = [];
  for (let s = 5; s < N; s += 10) {
    if (bridgeNear(C, s, N, 4)) continue; const [x, z] = at(s, mid); const t = TN[s];
    q.setFromAxisAngle(Y, Math.atan2(t.x, t.z) + Math.PI / 2); m4.compose(v.set(x, 0.26, z), q, sc.set(1, 1, 1)); lm.setMatrixAt(nl++, m4);
    for (const d of [-1, 1]) { const [hx, hz] = at(s, mid + d * 3.5); heads.push([hx, hz]); }
  }
  lm.count = nl; lm.castShadow = T === 'high'; R.scene.add(lm);
  if (R.env && R.env.night && heads.length) {
    const glow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.38, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE2A0').multiplyScalar(9), toneMapped: false }), heads.length);
    const pc = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,150,.5)'); gr.addColorStop(0.5, 'rgba(255,196,120,.16)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: pc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), heads.length);
    heads.forEach(([x, z], i) => { glow.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 12.1, z)); pool.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.09, z)); });
    pool.renderOrder = 2; R.scene.add(glow, pool);
  }

  // bridges and signs
  for (const b of C.bridges || []) {
    if (b.type === 'flyover') flyover(R, b, { RW, MED, concrete, asphalt, steel, H });
    else if (b.type === 'foot') footbridge(R, b, { RW, MED, steel, concrete });
    else if (b.type === 'rail') railBridge(R, b, { RW, MED, concrete, H });
  }
  for (const g of C.signs || []) signGantry(R, g, { RW, MED, steel });
  if (C.hills) hills(R, H);
  traffic(R, H, { RW, MED, twinLat });
  return { twinPts: R.twinPts };
}
const bridgeNear = (C, s, N, d) => (C.bridges || []).some((b) => Math.min(Math.abs(b.s - s), N - Math.abs(b.s - s)) < d);

/** Lane markings: solid edge lines, dashed lines between lanes. */
export function laneLines(R, centre, width, lanes) {
  const P = R.samples, TN = R.tangents, N = P.length; const lp = [], li = [];
  const quad = (i, j, off, w) => { const a = P[i], b = P[j], t = TN[i], t2 = TN[j], vv = lp.length / 3; lp.push(a.x - t.z * (off - w), 0.05, a.z + t.x * (off - w), a.x - t.z * (off + w), 0.05, a.z + t.x * (off + w), b.x - t2.z * (off - w), 0.05, b.z + t2.x * (off - w), b.x - t2.z * (off + w), 0.05, b.z + t2.x * (off + w)); li.push(vv, vv + 1, vv + 2, vv + 1, vv + 3, vv + 2); };
  const edge = width / 2 - 0.6, laneW = (width - 1.2) / lanes;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; quad(i, j, centre + edge, 0.1); quad(i, j, centre - edge, 0.1);
    if (i % 3 === 0) for (let k = 1; k < lanes; k++) quad(i, j, centre - edge + k * laneW, 0.08);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.setIndex(li); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M({ color: '#F2F2EC', roughness: 0.5 })); R.scene.add(m); return m;
}

/** Raised kerbs along the loop between two lateral offsets, painted in alternating blocks. One draw call. */
export function kerbs(R, ...bands) {
  const P = R.samples, TN = R.tangents, N = P.length; const pos = [], col = [], idx = [], h = 0.3;
  const black = [0.03, 0.03, 0.035], yellow = [0.98, 0.78, 0.08];
  for (const [o1, o2] of bands) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, a = P[i], b = P[j], t = TN[i], t2 = TN[j]; const c = i % 2 ? black : yellow;
    const pt = (p, tt, o, y) => [p.x - tt.z * o, y, p.z + tt.x * o];
    // top face and the face towards the road
    for (const [oA, oB, yA, yB] of [[o1, o2, h, h], [o1, o1, 0, h]]) {
      const vv = pos.length / 3; pos.push(...pt(a, t, oA, yA), ...pt(a, t, oB, yB), ...pt(b, t2, oA, yA), ...pt(b, t2, oB, yB)); for (let k = 0; k < 4; k++) col.push(...c); idx.push(vv, vv + 1, vv + 2, vv + 1, vv + 3, vv + 2);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  R.scene.add(new THREE.Mesh(g, M({ vertexColors: true, roughness: 0.8, envMapIntensity: 0.2, side: THREE.DoubleSide })));
}

/** A group standing across the road at sample s, centred at lateral offset lat. Local +x is the driver's left. */
function across(R, s, lat) { const g = new THREE.Group(); R.placeAlong(g, s, lat); return g; }
const box = (g, w, h, d, m, x, y, z = 0, cast = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = cast; b.receiveShadow = true; g.add(b); return b; };
function nameBoard(text, bg = '#0B6B3A') { return canvasTex(512, 64, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 512, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(4, 4, 504, 56); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, text.toUpperCase(), 800, 34, 470); g.fillText(text.toUpperCase(), 256, 34); }); }

/** A flyover: a concrete deck across both carriageways on piers, ramps down each side on earth banks,
 *  an advert on the face you drive towards and the interchange's name over the median. */
function flyover(R, b, { RW, MED, concrete, asphalt, steel, H }) {
  const W = 2 * RW + MED, latC = -(RW / 2 + MED / 2), Ld = W + 26, hD = 7.4, dw = 13;
  const g = across(R, b.s, latC);
  box(g, Ld, 1.3, dw, concrete, 0, hD);                                  // the deck
  for (const z of [-4.5, -1.5, 1.5, 4.5]) box(g, Ld, 0.9, 0.8, concrete, 0, hD - 1.05, z);   // girders
  for (const z of [-dw / 2 + 0.2, dw / 2 - 0.2]) box(g, Ld, 1.05, 0.35, concrete, 0, hD + 1.15, z);   // parapets
  const topM = M({ color: '#3B3D41', roughness: 0.92 }); const top = new THREE.Mesh(new THREE.PlaneGeometry(Ld, dw - 0.8), topM); top.rotation.x = -Math.PI / 2; top.position.y = hD + 0.66; g.add(top);
  for (const x of [-(W / 2 + 11), 0, W / 2 + 11]) { for (const z of [-3.8, 3.8]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, hD - 1.4, 12), concrete); c.position.set(x, (hD - 1.4) / 2, z); c.castShadow = true; g.add(c); } box(g, 2.6, 1.1, dw - 1, concrete, x, hD - 1.9); }
  // ramps on earth banks with retaining walls, clear of the rest of the loop
  const rampR = Math.max(30, Math.min(b.ramp || 70, (b.clearR || 200) - 40)), rampL = Math.max(30, Math.min(b.ramp || 70, (b.clearL || 200) - 40 - W / 2));
  for (const [dir, len] of [[-1, rampR], [1, rampL]]) {
    const x0 = dir * Ld / 2, x1 = dir * (Ld / 2 + len);
    const sh = new THREE.Shape(); sh.moveTo(x0, 0); sh.lineTo(x1, 0); sh.lineTo(x0, hD + 0.65); sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: dw, bevelEnabled: false }); eg.translate(0, 0, -dw / 2);
    const bank = new THREE.Mesh(eg, concrete); bank.castShadow = bank.receiveShadow = true; g.add(bank);
    const slope = Math.atan2(hD + 0.65, len), L = Math.hypot(len, hD + 0.65);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(L, dw - 0.8), topM); road.rotation.order = 'ZXY'; road.rotation.set(-Math.PI / 2, 0, 0); const rg = new THREE.Group(); rg.add(road); rg.rotation.z = dir * -slope; rg.position.set((x0 + x1) / 2, (hD + 0.65) / 2 + 0.03, 0); g.add(rg);
  }
  // cars parked in the jam on the deck, and a few on the ramps
  const faceM = new THREE.MeshBasicMaterial({ map: nameBoard(b.name || 'Interchange') });
  const nb = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), faceM); nb.position.set(0, hD + 0.2, -dw / 2 - 0.02); nb.rotation.y = Math.PI; g.add(nb);
  const nb2 = nb.clone(); nb2.position.z = dw / 2 + 0.02; nb2.rotation.y = 0; g.add(nb2);
  if (R.adStrips) R.adStrips.forEach((t, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(RW * 0.9, RW * 0.9 * 160 / 1024), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: '#fff', emissiveMap: t, emissiveIntensity: 0.12 })); m.position.set((k ? 1 : -1) * (RW + MED) / 2, hD + 0.1, -dw / 2 - 0.03); m.rotation.y = Math.PI; g.add(m); });
  R.scene.add(g); g.updateMatrixWorld(true);
  // a few cars crossing on the deck (they stand still: you pass under them in a moment)
  if (R.parkCars) for (let i = -3; i <= 3; i++) { if (Math.random() < 0.3) continue; const w = g.localToWorld(new THREE.Vector3(i * 11 + (Math.random() - 0.5) * 4, hD + 0.66, (i % 2 ? -1 : 1) * 2.6)); R.parkCars.push([w.x, w.y, w.z, g.rotation.y + Math.PI / 2 + (i % 2 ? Math.PI : 0)]); }
}

/** A steel pedestrian footbridge with stair towers at both ends and a banner facing the traffic. */
function footbridge(R, b, { RW, MED, steel, concrete }) {
  const W = 2 * RW + MED, latC = -(RW / 2 + MED / 2), L = W + 20, h = 6.4;
  const g = across(R, b.s, latC); const blue = M({ color: '#2B5C8A', roughness: 0.45, metalness: 0.6 });
  box(g, L, 0.45, 3, concrete, 0, h);
  for (const z of [-1.45, 1.45]) { box(g, L, 0.16, 0.16, blue, 0, h + 1.3, z, false); box(g, L, 0.12, 0.12, blue, 0, h + 0.7, z, false); for (let x = -L / 2; x <= L / 2; x += 3.2) box(g, 0.1, 1.3, 0.1, blue, x, h + 0.65, z, false); }
  // piers: verges and median
  for (const x of [-(W / 2 + 10), 0, W / 2 + 10]) box(g, 0.9, h, 0.9, concrete, x, h / 2);
  // stair towers: flights zig-zagging up beside the road
  for (const dir of [-1, 1]) {
    const x = dir * (L / 2 + 3);
    box(g, 6, 0.3, 3.2, concrete, x, h); box(g, 0.5, h, 0.5, steel, x + dir * 2.8, h / 2, 1.4); box(g, 0.5, h, 0.5, steel, x + dir * 2.8, h / 2, -1.4);
    for (let k = 0; k < 2; k++) { const fl = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 1.5), concrete); fl.position.set(x + dir * 1, h * (k + 0.5) / 2, (k ? -1 : 1) * 2.5); fl.rotation.z = (k ? 1 : -1) * dir * Math.atan2(h / 2, 9); fl.castShadow = true; g.add(fl); }
  }
  // the banner on the side you drive towards, over your carriageway
  if (R.adStrips) { const t = R.adStrips[b.s % 2]; const m = new THREE.Mesh(new THREE.PlaneGeometry(RW * 0.85, RW * 0.85 * 160 / 1024), M({ map: t, roughness: 0.5, emissive: '#fff', emissiveMap: t, emissiveIntensity: 0.12 })); m.position.set(-(RW + MED) / 2, h + 0.9, -1.56); m.rotation.y = Math.PI; g.add(m); }
  R.scene.add(g);
}

/** The Abuja light rail crossing the expressway on a concrete bridge, a train waiting on it. */
function railBridge(R, b, { RW, MED, concrete, H }) {
  const W = 2 * RW + MED, latC = -(RW / 2 + MED / 2), Ld = W + 30, h = 7.8;
  const g = across(R, b.s, latC);
  box(g, Ld, 1.6, 8, concrete, 0, h);
  for (const z of [-3.8, 3.8]) box(g, Ld, 0.8, 0.3, concrete, 0, h + 1.2, z);
  for (const x of [-(W / 2 + 13), 0, W / 2 + 13]) { box(g, 3, h - 0.8, 3, concrete, x, (h - 0.8) / 2); }
  for (const dir of [-1, 1]) { const len = 60, x0 = dir * Ld / 2; const sh = new THREE.Shape(); sh.moveTo(x0, 0); sh.lineTo(x0 + dir * len, 0); sh.lineTo(x0 + dir * len, h * 0.3); sh.lineTo(x0, h + 0.8); sh.closePath(); const eg = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: false }); eg.translate(0, 0, -4); const m = new THREE.Mesh(eg, concrete); m.castShadow = true; g.add(m); }
  // rails and a two-car train: white with a green band
  const rail = M({ color: '#5A5A5E', metalness: 0.9, roughness: 0.3 }); for (const z of [-1.9, -0.5, 0.5, 1.9]) box(g, Ld + 120, 0.14, 0.12, rail, 0, h + 0.87, z, false);
  const body = M({ color: '#F1F1EE', roughness: 0.35, metalness: 0.2 }), band = M({ color: '#0C7A45', roughness: 0.4 }), glass = M({ color: '#1C2A35', roughness: 0.1, metalness: 0.8 });
  for (const x of [-13.5, 13.5]) { box(g, 26, 3.4, 2.9, body, x, h + 2.7, -1.2); box(g, 26.1, 0.5, 2.95, band, x, h + 1.7, -1.2, false); box(g, 24, 0.9, 2.96, glass, x, h + 3.2, -1.2, false); }
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), new THREE.MeshBasicMaterial({ map: nameBoard('Abuja Light Rail', '#0C7A45') })); lab.position.set(0, h, -4.02); lab.rotation.y = Math.PI; g.add(lab);
  R.scene.add(g);
}

/** Green direction signs on a gantry over your carriageway, like the ones on Abuja's expressways. */
function signGantry(R, sg, { RW, MED, steel }) {
  const g = across(R, sg.s, 0); const hgt = 7.6;
  for (const lat of [RW / 2 + 10.5, -(RW / 2 + MED / 2)]) { const x = -lat; box(g, 0.45, hgt, 0.45, steel, x, hgt / 2); }
  const span = RW + 10.5 + MED / 2; box(g, span, 0.35, 0.35, steel, -(RW / 2 + 10.5) + span / 2, hgt, 0.4, false); box(g, span, 0.35, 0.35, steel, -(RW / 2 + 10.5) + span / 2, hgt, -0.4, false);
  const lines = sg.text || [], arrow = sg.arrow || 'up';
  const tex = canvasTex(512, 256, (x) => {
    x.fillStyle = '#0B6B3A'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.roundRect(8, 8, 496, 240, 16); x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle'; lines.forEach((ln, i) => { fitText(x, ln, 800, 58, 340); x.fillText(ln, 34, 80 + i * 96); });
    x.save(); x.translate(440, 128); if (arrow === 'right') x.rotate(Math.PI / 2); x.lineWidth = 14; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(0, 60); x.lineTo(0, -40); x.stroke(); x.beginPath(); x.moveTo(-32, -18); x.lineTo(0, -62); x.lineTo(32, -18); x.closePath(); x.fillStyle = '#fff'; x.fill(); x.restore();
  });
  const face = M({ map: tex, roughness: 0.45, emissive: '#fff', emissiveMap: tex, emissiveIntensity: R.env && R.env.night ? 0.35 : 0.05 });
  const back = M({ color: '#8C9198', roughness: 0.5, metalness: 0.6 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(RW * 0.62, RW * 0.31, 0.2), back); sign.position.set(0, hgt + RW * 0.155 - 0.5, -0.65); sign.castShadow = true; g.add(sign);
  const faceP = new THREE.Mesh(new THREE.PlaneGeometry(RW * 0.62, RW * 0.31), face); faceP.position.set(0, hgt + RW * 0.155 - 0.5, -0.76); faceP.rotation.y = Math.PI; g.add(faceP);
  R.scene.add(g);
}

/** Abuja sits in a bowl of hills: a ring of green-brown granite hills on the horizon. */
function hills(R, H) {
  const c = R.samples.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / R.samples.length);
  const mat = M({ map: R.tex.rock, normalMap: R.tex.rockN, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, color: '#8E9A72' });
  const n = R.tier === 'low' ? 7 : 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3 * Math.sin(i * 7.1), d = 1900 + 500 * ((i * 37) % 7) / 7;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    if ((R.circuit.landmarks || []).some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 700 ** 2)) continue;
    const m = new THREE.Mesh(H.rockGeometry(R.tier === 'low' ? 2 : 3, 0.55 + 0.25 * ((i * 13) % 5) / 5, 3 + i * 1.7), mat); m.scale.set(420 + (i % 3) * 140, 260 + (i % 4) * 60, 360 + (i % 2) * 180); m.position.set(x, -10, z); m.rotation.y = i; R.scene.add(m);
  }
}

/** Oncoming traffic on the opposite carriageway: saloons, SUVs, the green-and-white Abuja taxis and a few buses. */
function carGeometry(H) {
  const body = new THREE.BoxGeometry(1.85, 0.72, 4.4); body.translate(0, 0.62, 0);
  const cab = new THREE.BoxGeometry(1.62, 0.62, 2.2); cab.translate(0, 1.28, -0.25);
  const bodyG = H.mergeGeos([body, cab]);
  const parts = []; for (const [x, z] of [[-0.86, 1.35], [0.86, 1.35], [-0.86, -1.35], [0.86, -1.35]]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10); w.rotateZ(Math.PI / 2); w.translate(x, 0.34, z); parts.push(w); }
  const glass = new THREE.BoxGeometry(1.64, 0.46, 2.0); glass.translate(0, 1.3, -0.25); parts.push(glass);
  return { bodyG, darkG: H.mergeGeos(parts) };
}
function traffic(R, H, { RW, MED, twinLat }) {
  const P = R.twinPts, N = P.length, lanes = R.circuit.lanes || 3, laneW = (RW - 1.2) / lanes;
  const count = R.tier === 'low' ? 12 : R.tier === 'medium' ? 20 : 28; const { bodyG, darkG } = carGeometry(H);
  const PAL = ['#F2F2F0', '#C9CDD2', '#1C1E22', '#8E1F1F', '#1F3A6B', '#E8E6DF', '#5A5E63', '#0E7A45', '#D0B25A'];
  const extra = R.parkCars || [];
  const bodies = new THREE.InstancedMesh(bodyG, M({ roughness: 0.3, metalness: 0.55, envMapIntensity: 1 }), count + 40), dark = new THREE.InstancedMesh(darkG, M({ color: '#141619', roughness: 0.25, metalness: 0.5 }), count + 40);
  bodies.castShadow = R.tier === 'high'; R.scene.add(bodies, dark);
  const col = new THREE.Color(); const cars = [];
  for (let i = 0; i < count; i++) {
    const taxi = i % 5 === 0; const lane = i % lanes;
    cars.push({ i: (i / count) * N + Math.random() * 6, v: 19 + Math.random() * 9 - lane * 1.5, lat: -(RW / 2 - 0.6) + (lane + 0.5) * laneW, taxi });
    bodies.setColorAt(i, col.set(taxi ? '#1E9E55' : PAL[Math.floor(Math.random() * PAL.length)]));
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const seg = P.map((p, i) => p.distanceTo(P[(i + 1) % N]) || 4);
  // parked cars on flyover decks are added once, after the bridges are built
  R.trafficTick = (dt) => {
    if (extra.length && !R._parked) { R._parked = true; extra.forEach(([x, y, z, h], k) => { if (k >= 40) return; m4.compose(v.set(x, y, z), q.setFromAxisAngle(Y, h), one); bodies.setMatrixAt(count + k, m4); dark.setMatrixAt(count + k, m4); bodies.setColorAt(count + k, col.set(PAL[k % PAL.length])); }); bodies.count = dark.count = count + Math.min(40, extra.length); bodies.instanceColor.needsUpdate = true; }
    for (let k = 0; k < count; k++) {
      const c = cars[k]; const i0 = Math.floor(c.i); c.i -= (c.v * dt) / seg[(i0 - 1 + N) % N]; if (c.i < 0) c.i += N;   // against the race direction
      const a = Math.floor(c.i) % N, b = (a + 1) % N, f = c.i - Math.floor(c.i);
      const t = R.tangents[a], x = P[a].x + (P[b].x - P[a].x) * f - t.z * c.lat, z = P[a].z + (P[b].z - P[a].z) * f + t.x * c.lat;
      m4.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, Math.atan2(-t.x, -t.z)), one); bodies.setMatrixAt(k, m4); dark.setMatrixAt(k, m4);
    }
    bodies.instanceMatrix.needsUpdate = true; dark.instanceMatrix.needsUpdate = true;
  };
  bodies.count = dark.count = count; R.trafficTick(0);
}

/* ================================== landmarks on the new routes ================================== */
export function routeLandmarks(R, H) {
  const stone = M({ color: '#EEEAE0', roughness: 0.7 }), white = M({ color: '#F6F4EE', roughness: 0.55 }), glass = M({ color: '#3F6E93', metalness: 0.85, roughness: 0.1 });
  const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const bx = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  const signBoard = (g, text, w, h, x, y, z, ry, bg = '#FFFFFF', fg = '#1D1D22') => { const t = canvasTex(512, 96, (c) => { c.fillStyle = bg; c.fillRect(0, 0, 512, 96); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, text, 800, 60, 480); c.fillText(text, 256, 50); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: '#fff', emissiveMap: t, emissiveIntensity: R.env && R.env.night ? 0.5 : 0.04 })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
  return {
    // Moshood Abiola National Stadium: an oval bowl ringed by white columns under a white roof ring, the dome of the indoor hall beside it
    stadium: () => {
      const g = new THREE.Group(); const bowl = new THREE.Mesh(lathe([[58, 0], [86, 0], [86, 20], [83, 24], [62, 9], [58, 5]], 64), stone); bowl.scale.z = 0.8; bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
      const cols = []; for (let a = 0; a < 56; a++) { const c = new THREE.CylinderGeometry(0.8, 0.8, 22, 8); c.translate(Math.cos(a / 56 * Math.PI * 2) * 90, 11, Math.sin(a / 56 * Math.PI * 2) * 90 * 0.8); cols.push(c); }
      const cm = new THREE.Mesh(H.mergeGeos(cols), white); cm.castShadow = true; g.add(cm);
      const roof = new THREE.Mesh(lathe([[64, 23], [93, 26], [93, 28.4], [64, 25.4]], 64), M({ color: '#F4F4F2', roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide })); roof.scale.z = 0.8; roof.castShadow = true; g.add(roof);
      const pitch = new THREE.Mesh(new THREE.CircleGeometry(46, 40), M({ color: '#3E8A34', roughness: 1 })); pitch.rotation.x = -Math.PI / 2; pitch.scale.y = 0.8; pitch.position.y = 0.4; g.add(pitch);
      const trk = new THREE.Mesh(new THREE.RingGeometry(46, 56, 48), M({ color: '#B2432F', roughness: 0.9 })); trk.rotation.x = -Math.PI / 2; trk.scale.y = 0.8; trk.position.y = 0.35; g.add(trk);
      const hall = new THREE.Mesh(new THREE.SphereGeometry(20, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), white); hall.position.set(125, 0, -40); hall.scale.y = 0.75; hall.castShadow = true; g.add(hall);
      for (const [x, z] of [[-70, -70], [70, -70], [-70, 70], [70, 70]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 40, 8), M({ color: '#9AA0A8', metalness: 0.8, roughness: 0.3 })); m.position.set(x, 20, z * 0.8); g.add(m); bx(g, 5, 3, 1, M({ color: '#E8E8E8', emissive: R.env && R.env.night ? '#FFF6D8' : '#000', emissiveIntensity: 3 }), x, 39, z * 0.8); }
      return g;
    },
    // The City Gate monument: two tall white pylons leaning in over a stepped base, joined by a cross beam, the flag between them
    citygate: () => {
      const g = new THREE.Group(); bx(g, 30, 1.2, 16, stone); bx(g, 22, 1, 11, stone, 0, 1.2);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.6, 30, 4), white); p.rotation.y = Math.PI / 4; p.rotation.z = s * 0.2; p.position.set(s * 6.4, 16.7, 0); p.scale.z = 1.6; p.castShadow = true; g.add(p); }
      bx(g, 12, 1.8, 3.8, white, 0, 21); bx(g, 5.4, 3.4, 3.8, white, 0, 26.5);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.7, 8, 20, Math.PI), white); arch.position.set(0, 2.2, 3); g.add(arch);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 17, 8), M({ color: '#DDD', metalness: 0.8, roughness: 0.3 })); pole.position.set(0, 10.7, 0); g.add(pole);
      const ft = H.flagTexture(); const f = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.5, 12, 1), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.7 })); f.position.set(2.1, 17.6, 0); g.add(f);
      (R.flags = R.flags || []).push(f);
      return g;
    },
    // Banex Plaza, Wuse 2: a busy cream-and-glass shopping block with its name on the roof, shop signs along the front
    banex: () => {
      const g = new THREE.Group(); const cream = M({ color: '#E9DFC8', roughness: 0.7 });
      bx(g, 74, 18, 38, cream); for (let y = 4; y < 18; y += 4.6) bx(g, 74.4, 1.9, 38.4, glass, 0, y);
      bx(g, 34, 6, 20, cream, -10, 18); signBoard(g, 'BANEX PLAZA', 30, 5.6, -10, 27.5, 10.2, 0, '#0E4E8C', '#FFFFFF'); signBoard(g, 'BANEX PLAZA', 30, 5.6, -10, 27.5, -10.2, Math.PI, '#0E4E8C', '#FFFFFF');
      ['PHONES & LAPTOPS', 'PHARMACY', 'SUPERMARKET', 'FASHION', 'ELECTRONICS', 'FOOD COURT'].forEach((t, i) => { const x = -30 + i * 12; signBoard(g, t, 10.5, 1.6, x, 3.6, 19.25, 0, ['#FF7A1A', '#1E9E55', '#E0342B', '#2459D6', '#1D1D22', '#F2B51C'][i], '#FFFFFF'); signBoard(g, t, 10.5, 1.6, x, 3.6, -19.25, Math.PI, ['#FF7A1A', '#1E9E55', '#E0342B', '#2459D6', '#1D1D22', '#F2B51C'][i], '#FFFFFF'); });
      return g;
    },
    // Wuse 2 shop rows: two-storey blocks with awnings and hand-painted signs
    wuse: () => {
      const g = new THREE.Group(); const cols = ['#E4D2B0', '#D7C9B8', '#EFE6D2', '#CFD8DC'];
      for (let i = 0; i < 6; i++) { const x = -40 + i * 16; bx(g, 15, 8 + (i % 3) * 3, 14, M({ color: cols[i % 4], roughness: 0.8 }), x, 0, 0); bx(g, 15, 0.3, 3, M({ color: ['#1E9E55', '#E0342B', '#2459D6', '#FF7A1A'][i % 4], roughness: 0.6 }), x, 3.4, 8.4);
        signBoard(g, ['MINI MART', 'BARBING SALON', 'POS & TRANSFERS', 'PHONE REPAIRS', 'PHARMACY', 'SUYA SPOT'][i], 13, 1.5, x, 5, 7.05, 0); signBoard(g, ['MINI MART', 'BARBING SALON', 'POS & TRANSFERS', 'PHONE REPAIRS', 'PHARMACY', 'SUYA SPOT'][i], 13, 1.5, x, 5, -7.05, Math.PI); }
      return g;
    },
    // Nnamdi Azikiwe International Airport: the control tower and terminal at the end of Airport Road
    airport: () => {
      const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 46, 16), white); t.position.y = 23; t.castShadow = true; g.add(t);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 5.5, 6, 12), glass); cab.position.y = 49; g.add(cab); const cap = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1.2, 12), white); cap.position.y = 52.6; g.add(cap);
      bx(g, 180, 14, 44, M({ color: '#DCE3E8', roughness: 0.4, metalness: 0.3 }), 0, 0, 80); bx(g, 186, 1.6, 52, white, 0, 14, 80); for (let x = -80; x <= 80; x += 20) bx(g, 14, 9, 44.6, glass, x, 2, 80);
      return g;
    },
  };
}
