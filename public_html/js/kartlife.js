// Buja Kart: life on the road. Fulani herders walking their cattle beside the road (and the cows that wander
// across it), stunt ramps to jump, coins to collect, a police checkpoint and the police giving chase, and the two
// off-city routes: a laterite bush path through a village, and Abuja airport's runway. Everything that repeats is
// instanced; the per-frame work is a few dozen matrix updates.
import * as THREE from './vendor/three.module.min.js';

const M = (o) => new THREE.MeshStandardMaterial(o);
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const TMP = { m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), zero: new THREE.Vector3(0, 0, 0) };   // reused every frame: no garbage
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}

/** Road surfaces that are not asphalt: red laterite with tyre ruts, and airfield concrete in slabs. UVs are in metres. */
export function surfaceMaterial(kind, tex) {
  if (kind === 'dirt') {
    // compacted red laterite: blotchy colour, fine grit and pebbles, two worn wheel tracks; a matching bump map for relief
    const S = 512, hc = document.createElement('canvas'); hc.width = hc.height = S; const h = hc.getContext('2d');
    h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
    const t = canvasTex(S, S, (g) => {
      g.fillStyle = '#A65A33'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 60; i++) { const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); const dark = Math.random() < 0.5; gr.addColorStop(0, dark ? 'rgba(110,50,25,.28)' : 'rgba(205,130,85,.26)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      for (const cx of [150, 362]) { const gr = g.createLinearGradient(cx - 40, 0, cx + 40, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(95,42,20,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - 40, 0, 80, S);
        const hg = h.createLinearGradient(cx - 40, 0, cx + 40, 0); hg.addColorStop(0, 'rgba(128,128,128,0)'); hg.addColorStop(0.5, 'rgba(90,90,90,.7)'); hg.addColorStop(1, 'rgba(128,128,128,0)'); h.fillStyle = hg; h.fillRect(cx - 40, 0, 80, S); }
      for (let i = 0; i < 9000; i++) { const x = Math.random() * S, y = Math.random() * S, v = Math.random(); g.fillStyle = v < 0.5 ? `rgba(80,35,15,${0.15 + v * 0.3})` : `rgba(235,170,120,${0.08 + (v - 0.5) * 0.3})`; g.fillRect(x, y, 1.5, 1.5); }
      for (let i = 0; i < 700; i++) { const x = Math.random() * S, y = Math.random() * S, r = 1.5 + Math.random() * 3.5; const tone = 120 + Math.random() * 90; g.fillStyle = `rgb(${tone},${tone * 0.62},${tone * 0.42})`; g.beginPath(); g.ellipse(x, y, r, r * 0.75, Math.random() * 3, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,230,200,.35)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 7); g.fill();
        h.fillStyle = `rgba(230,230,230,.9)`; h.beginPath(); h.arc(x, y, r, 0, 7); h.fill(); }
    }, true);
    t.repeat.set(1 / 9, 1 / 9);
    // bump from the height canvas: pebbles stand up, wheel tracks sink
    const bump = new THREE.CanvasTexture(hc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(1 / 9, 1 / 9);
    return M({ map: t, bumpMap: bump, bumpScale: 2.2, roughness: 1, envMapIntensity: 0.2 });
  }
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#C9C6BE'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,118,112' : '235,233,226'},${0.06 + Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.strokeStyle = 'rgba(70,70,70,.35)'; g.lineWidth = 2; for (const p of [0, 128]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,40,40,.12)'; g.fillRect(90 + Math.random() * 70, 0, 6 + Math.random() * 10, 256); }   // rubber from landings
  }, true);
  t.repeat.set(1 / 10, 1 / 10);
  return M({ map: t, normalMap: tex.asphaltN || null, roughness: 0.85, envMapIntensity: 0.35 });
}

/**
 * Sets up everything for this race. H: { mergeGeos, rockGeometry, flagTexture, roadW, BOOST_V }.
 * Installs on the race: lifeTick(now, dt), jumpTick(k, dt, isAI), avoidLane(k), wallAt(lateral), lifeStop().
 */
export function buildLife(R, H) {
  const C = R.circuit, N = R.samples.length, RW = H.roadW, T = R.tier;
  const isGP = C.id === 'gp';
  const P = R.samples, TN = R.tangents;
  const wrap = (s) => ((s % N) + N) % N;
  const at = (s, lat) => { const i = Math.floor(wrap(s)), j = (i + 1) % N, f = wrap(s) - i; const t = TN[i], x = P[i].x + (P[j].x - P[i].x) * f, z = P[i].z + (P[j].z - P[i].z) * f; return [x - t.z * lat, z + t.x * lat]; };
  const head = (s) => { const t = TN[Math.floor(wrap(s))]; return Math.atan2(t.x, t.z); };
  const straight = (s) => { let b = 0; for (let d = -10; d <= 10; d++) b += 1 - TN[wrap(s + d)].dot(TN[wrap(s)]); return b; };
  const bridges = (C.bridges || []).map((b) => b.s);
  const busy = []; // samples already used by something, so things do not pile up
  const free = (s, gap) => !busy.some((b) => Math.min(Math.abs(b - s), N - Math.abs(b - s)) < gap) && !bridges.some((b) => Math.min(Math.abs(b - s), N - Math.abs(b - s)) < 18) && s > 50 && s < N - 30;
  const pickStraight = (from, to, gap) => { let best = -1, bs = 1e9; for (let s = Math.floor(from * N); s < to * N; s += 3) { if (!free(s, gap)) continue; const v = straight(s); if (v < bs) { bs = v; best = s; } } if (best >= 0) busy.push(best); return best; };
  const life = R.life = { pickups: 0, stunts: 0, hazards: [], obstacles: [], cows: [] };
  const surface = C.surface || 'asphalt';
  R.wallAt = (lat) => (surface === 'dirt' ? RW / 2 + 14 : surface === 'concrete' ? RW / 2 + 24 : null);

  if (surface === 'dirt') bushWorld(R, H, { at, head, N, RW });
  if (C.airfield) airfield(R, H, { at, head, N, RW });

  /* ------------------------------ stunt ramps ------------------------------ */
  const ramps = [];
  const rampCount = isGP ? 0 : C.ramps != null ? C.ramps : surface === 'asphalt' ? 2 : 3;
  const rampTex = canvasTex(128, 256, (g) => { g.fillStyle = '#1A1A1E'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#FFC21A'; for (let y = -40; y < 256; y += 56) { g.beginPath(); g.moveTo(10, y + 40); g.lineTo(64, y); g.lineTo(118, y + 40); g.lineTo(118, y + 62); g.lineTo(64, y + 22); g.lineTo(10, y + 62); g.closePath(); g.fill(); } g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 8, 256); g.fillRect(120, 0, 8, 256); });
  const rampM = M({ map: rampTex, roughness: 0.6, emissive: '#FFC21A', emissiveMap: rampTex, emissiveIntensity: R.env && R.env.night ? 0.6 : 0.08 });
  const postM = M({ color: '#6C4A2A', roughness: 0.9 });
  for (let i = 0; i < rampCount; i++) {
    const s = pickStraight((i + 0.15) / rampCount, (i + 0.85) / rampCount, 40); if (s < 0) continue;
    const L = 8.5, h = 1.35, w = 5, lat = [0, -RW / 4, RW / 4][i % 3];
    const g = new THREE.Group(); R.placeAlong(g, s, lat);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, Math.hypot(L, h)), rampM); slab.rotation.x = -Math.atan2(h, L); slab.position.set(0, h / 2, 0); slab.castShadow = slab.receiveShadow = true; g.add(slab);
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, 0.25), postM); p.position.set(x, h / 2, L / 2 - 0.2); g.add(p); }
    R.scene.add(g);
    const [cx, cz] = at(s, lat), t = TN[s];
    ramps.push({ s, lat, L, h, w, cx, cz, fx: t.x, fz: t.z, rx: -t.z, rz: t.x });
  }
  life.ramps = ramps;

  /* ------------------------------ coins ------------------------------ */
  const coinPos = [];
  const groups = isGP ? 8 : 10;
  for (let i = 0; i < groups; i++) {
    const s0 = Math.floor(((i + 0.5) / groups) * N); if (s0 < 30 || s0 > N - 20) continue;
    if (ramps.some((r) => Math.min(Math.abs(r.s - s0), N - Math.abs(r.s - s0)) < 12)) continue;
    const lat0 = rnd(-RW / 2 + 2.5, RW / 2 - 2.5), curve = rnd(-0.6, 0.6);
    for (let k = 0; k < 5; k++) { const [x, z] = at(s0 + k * 2, lat0 + curve * k); coinPos.push([x, 1.0, z]); }
  }
  // an arc of coins over every ramp's landing: only reachable in the air
  for (const r of ramps) { const vy = 30 * 0.24 + 1.5; [6, 12, 18, 24].forEach((d) => { const t = d / 30, y = r.h + vy * t - 11 * t * t + 0.4; const [x, z] = [r.cx + r.fx * (r.L / 2 + d), r.cz + r.fz * (r.L / 2 + d)]; coinPos.push([x, Math.max(1, y), z]); }); }
  const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20); coinGeo.rotateX(Math.PI / 2);
  const coinMesh = new THREE.InstancedMesh(coinGeo, M({ color: '#F5C542', metalness: 1, roughness: 0.22, emissive: '#6B4A00', emissiveIntensity: 0.55 }), Math.max(1, coinPos.length));
  coinMesh.count = coinPos.length; R.scene.add(coinMesh);
  const coins = coinPos.map(([x, y, z]) => ({ x, y, z, taken: false }));
  life.coins = coins;
  let coinLap = 1;
  const hudChip = document.createElement('div'); hudChip.className = 'kart-chip kart-coins'; hudChip.textContent = '🪙 0'; hudChip.style.display = 'none';
  const hud = R.el.querySelector('.kart-hud'); if (hud) hud.appendChild(hudChip);
  const addPickups = (n) => { life.pickups += n; hudChip.style.display = ''; hudChip.textContent = '🪙 ' + life.pickups; hudChip.classList.remove('pop'); void hudChip.offsetWidth; hudChip.classList.add('pop'); };
  life.addPickups = addPickups;

  /* ------------------------------ cattle and their herders ------------------------------ */
  const herdCount = isGP ? 0 : C.cattle != null ? C.cattle : 2;
  const herds = [];
  if (herdCount) {
    const { bodyG, hornG, legG, coat } = cowGeometry();
    const per = []; for (let h = 0; h < herdCount; h++) per.push(Math.round(rnd(5, 8)));
    const total = per.reduce((a, b) => a + b, 0);
    const hide = M({ color: '#FFFFFF', map: coat, vertexColors: true, roughness: 0.9, envMapIntensity: 0.3 });
    const bodies = new THREE.InstancedMesh(bodyG, hide, total);
    const horns = new THREE.InstancedMesh(hornG, M({ vertexColors: true, roughness: 0.6, envMapIntensity: 0.2 }), total);
    const legs = new THREE.InstancedMesh(legG, hide, total * 4);
    [bodies, horns, legs].forEach((m) => { m.castShadow = T !== 'low'; m.frustumCulled = false; R.scene.add(m); });
    const col = new THREE.Color(); let ci = 0;
    const COATS = ['#F4F1EA', '#F7F5EF', '#EAE4D6', '#F0EBE0', '#B5582E', '#A34E28', '#E6E0D2', '#C0703F'];
    for (let h = 0; h < herdCount; h++) {
      const s = pickStraight(h / herdCount + 0.02, (h + 1) / herdCount - 0.02, 50); if (s < 0) continue;
      const side = C.twin ? 1 : Math.random() < 0.5 ? 1 : -1, verge = side * (RW / 2 + (surface === 'asphalt' ? 4.2 : 5));
      const herd = { s, side, verge, dir: Math.random() < 0.5 ? 1 : -1, cows: [], next: rnd(8, 30), crossing: false, warned: false, herder: herder(R), stick: 0 };
      for (let k = 0; k < per[h]; k++) {
        const coat = COATS[Math.floor(Math.random() * COATS.length)];
        const c = { idx: ci++, da: (k - per[h] / 2) * 2.6 + rnd(-0.8, 0.8), off: rnd(-1.4, 1.4), lat: verge + rnd(-1.4, 1.4), target: null, wait: 0, phase: Math.random() * 6, speed: rnd(1.1, 1.6), home: 0, hitAt: 0, x: 0, z: 0, h: 0 };
        c.home = verge + c.off; c.lat = c.home;
        bodies.setColorAt(c.idx, col.set(coat)); for (let l = 0; l < 4; l++) legs.setColorAt(c.idx * 4 + l, col.set(coat).multiplyScalar(0.92));
        herd.cows.push(c); life.cows.push(c);
      }
      herds.push(herd);
    }
    bodies.count = horns.count = ci; legs.count = ci * 4;
    life.herds = herds;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
    const LEGS = [[0.2, 0.86, 0.6], [-0.2, 0.86, 0.6], [0.2, 0.86, -0.66], [-0.2, 0.86, -0.66]];
    life.drawCows = (now, dt) => {
      for (const herd of herds) {
        let moving = false;
        herd.s = wrap(herd.s + (herd.dir * 0.8 * dt) / 4);
        for (const c of herd.cows) {
          let latSpeed = 0;
          if (c.target != null) {
            if (c.wait > 0) c.wait -= dt;
            else { const d = c.target - c.lat, stp = Math.sign(d) * Math.min(Math.abs(d), c.speed * dt * (now - c.hitAt < 2500 ? 2.2 : 1)); c.lat += stp; latSpeed = stp / Math.max(dt, 1e-3);
              if (Math.abs(d) < 0.05) { if (c.target === c.home) c.target = null; else { c.target = c.home; c.wait = rnd(2.5, 6); } } }
          }
          const sc = herd.s + c.da / 4; const [x, z] = at(sc, c.lat); c.x = x; c.z = z; c.s = sc;
          const walkAlong = herd.dir > 0 ? head(sc) : head(sc) + Math.PI; const crossH = head(sc) + (latSpeed > 0 ? -Math.PI / 2 : Math.PI / 2);
          const want = Math.abs(latSpeed) > 0.05 ? crossH : walkAlong; let d = want - c.h; d = Math.atan2(Math.sin(d), Math.cos(d)); c.h += d * Math.min(1, dt * 3);
          c.phase += dt * (Math.abs(latSpeed) > 0.05 ? 7 : 4.5); if (Math.abs(latSpeed) > 0.05) moving = true;
          q.setFromAxisAngle(Y, c.h); m4.compose(v.set(x, Math.abs(Math.sin(c.phase)) * 0.03, z), q, one); bodies.setMatrixAt(c.idx, m4); horns.setMatrixAt(c.idx, m4);
          LEGS.forEach(([lx, ly, lz], l) => { lq.setFromAxisAngle(X, Math.sin(c.phase + (l % 2 === (l < 2 ? 0 : 1) ? 0 : Math.PI)) * 0.38); lm.compose(v.set(lx, ly, lz), lq, one); legs.setMatrixAt(c.idx * 4 + l, tmpM.multiplyMatrices(m4, lm)); });
        }
        // the herder: walks behind the herd on the verge, stick across the shoulders; steps to the kerb and waves when they cross
        const hs = herd.s - herd.dir * (herd.cows.length * 1.6 + 3) / 4; const crossing = herd.cows.some((c) => c.target != null);
        const hLat = crossing ? herd.side * (RW / 2 + 1.2) : herd.verge + herd.side * 1.5; const [hx, hz] = at(hs, hLat);
        const g = herd.herder; g.position.set(hx, Math.abs(Math.sin(now / 170)) * 0.05, hz); g.rotation.y = crossing ? head(hs) + (herd.side > 0 ? -Math.PI / 2 : Math.PI / 2) : herd.dir > 0 ? head(hs) : head(hs) + Math.PI;
        g.userData.stick.rotation.z = crossing ? Math.PI / 2 + Math.sin(now / 180) * 0.5 : Math.PI / 2;
        herd.moving = moving;
      }
      bodies.instanceMatrix.needsUpdate = horns.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = true;
    };
    life.drawCows(performance.now(), 0);
  }

  /* ------------------------------ the police checkpoint ------------------------------ */
  let checkpoint = null;
  if (!isGP && C.checkpoint !== false) {
    const s = pickStraight(0.55, 0.75, 40);
    if (s >= 0) {
      const drumTex = canvasTex(64, 64, (g) => { g.fillStyle = '#1E4FB8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#F4F4F4'; g.fillRect(0, 14, 64, 9); g.fillRect(0, 38, 64, 9); });
      const drumG = new THREE.CylinderGeometry(0.33, 0.33, 0.92, 14); drumG.translate(0, 0.46, 0);
      const drums = []; const half = RW / 2 - 0.6;
      for (let l = half; l > 0.9; l -= 0.95) drums.push([s, l]);
      for (let l = -half; l < -0.9; l += 0.95) drums.push([s + 6, l]);
      const dm = new THREE.InstancedMesh(drumG, M({ map: drumTex, roughness: 0.5, emissive: '#FFFFFF', emissiveMap: drumTex, emissiveIntensity: R.env && R.env.night ? 0.35 : 0.03 }), drums.length); dm.castShadow = T !== 'low';
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
      drums.forEach(([ds, l], i) => { const [x, z] = at(ds, l); m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(Y, head(ds)), one); dm.setMatrixAt(i, m4); life.obstacles.push({ x, z, r: 0.45, s: ds, lat: l, i, down: false }); });
      R.scene.add(dm); life.drumMesh = dm;
      // the patrol van parked on the verge with its lights going, two officers, and the sign
      const van = policeCar(R); R.placeAlong(van, s - 4, RW / 2 + 5); van.rotation.y += Math.PI; R.scene.add(van);
      const officers = [RW / 2 + 1.8, RW / 2 + 3.2].map((l, i) => { const o = officer(); R.placeAlong(o, s + 2 + i * 3, l); o.rotation.y += Math.PI / 2; R.scene.add(o); return o; });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), new THREE.MeshStandardMaterial({ map: canvasTex(256, 112, (g) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 112); g.strokeStyle = '#1E3A8A'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 104); g.fillStyle = '#1E3A8A'; g.font = '900 34px Inter, system-ui'; g.textAlign = 'center'; g.fillText('POLICE', 128, 44); g.font = '800 22px Inter, system-ui'; g.fillText('CHECKPOINT · SLOW DOWN', 128, 84); }) }));
      const sg = new THREE.Group(); sg.add(sign); sign.position.y = 1.8; const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), M({ color: '#555' })); leg.position.y = 0.6; sg.add(leg); R.placeAlong(sg, s - 22, RW / 2 + 2.2); sg.rotation.y += Math.PI; R.scene.add(sg);
      checkpoint = { s, van, officers };
      life.checkpoint = checkpoint;
    }
  }

  /* ------------------------------ the police chase ------------------------------ */
  const chaseOn = !isGP && R.mode !== 'room' && C.police !== false;
  const chase = { state: 'idle', at: rnd(20000, 45000), car: null, s: 0, lat: 0, v: 0, since: 0 };
  if (chaseOn) { chase.car = policeCar(R); chase.car.visible = false; R.scene.add(chase.car); }   // built now so its shaders compile before the race
  let siren = null;
  const sirenStart = () => {
    const a = R.audio; if (!a || !a.ctx || siren) return; const c = a.ctx;
    const o = c.createOscillator(); o.type = 'square'; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2; const g = c.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(a.sfx || a.master); o.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 1.6; const lg = c.createGain(); lg.gain.value = 170; lfo.connect(lg); lg.connect(o.frequency); o.frequency.value = 820; lfo.type = 'triangle'; lfo.start();
    siren = { o, lfo, g };
  };
  const sirenLevel = (v) => { if (siren && R.audio.ctx) siren.g.gain.setTargetAtTime(v, R.audio.ctx.currentTime, 0.1); };
  const sirenStop = () => { if (!siren) return; try { siren.g.gain.setTargetAtTime(0, R.audio.ctx.currentTime, 0.2); const s = siren; setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch {} }, 900); } catch {} siren = null; };
  R.lifeStop = () => { try { sirenStop(); } catch {} R.el.querySelector('#stage')?.classList.remove('kart-police'); };

  /* ------------------------------ the Abuja light rail, overhead ------------------------------ */
  let rail = null;
  try { rail = buildRail(R, { at, head, N, RW, pickStraight, straight, free, busy, wrap }); } catch (e) { console.warn('rail', e); }
  life.rail = rail;

  /* ------------------------------ plane overhead (airport) ------------------------------ */
  let plane = null;
  if (C.airfield) { plane = airliner(R, true); plane.visible = false; R.scene.add(plane); plane.userData.next = performance.now() + 9000; }

  /* ------------------------------ helpers the race calls ------------------------------ */
  const latOf = (k) => { const p = P[k.idx], t = TN[k.idx]; return (k.position.x - p.x) * -t.z + (k.position.z - p.z) * t.x; };
  const ahead = (from, s) => wrap(s - from);   // samples from 'from' forward to 's'
  /** Obstacles on the road within a window ahead, as lateral positions. */
  const hazardsAhead = (k, near, far) => {
    const out = [];
    for (const c of life.cows) if (Math.abs(c.lat) < RW / 2 + 1 && ahead(k.idx, c.s) > near && ahead(k.idx, c.s) < far) out.push(c.lat);
    for (const o of life.obstacles) if (!o.down && ahead(k.idx, o.s) > near && ahead(k.idx, o.s) < far) out.push(o.lat);
    return out;
  };
  R.avoidLane = (k) => {
    const hz = hazardsAhead(k, 1, 14); if (!hz.length) return k.lane;
    if (hz.every((l) => Math.abs(l - k.lane) > 2.4)) return k.lane;
    let best = k.lane, bd = 1e9; for (let c = -RW / 2 + 1.6; c <= RW / 2 - 1.6; c += 0.8) { if (hz.some((l) => Math.abs(l - c) < 2.4)) continue; const d = Math.abs(c - k.lane); if (d < bd) { bd = d; best = c; } }
    return best;
  };

  /** Ramps and flight: called from drive() for every kart after it has moved. */
  R.jumpTick = (k, dt, isAI) => {
    if (!k.air) {
      let onRamp = null, ys = 0;
      for (const r of ramps) {
        const dx = k.position.x - (r.cx - r.fx * r.L / 2), dz = k.position.z - (r.cz - r.fz * r.L / 2);
        const along = dx * r.fx + dz * r.fz, lat = (k.position.x - r.cx) * r.rx + (k.position.z - r.cz) * r.rz;
        if (along >= 0 && along <= r.L && Math.abs(lat) <= r.w / 2 + 0.3) { onRamp = r; ys = (r.h * along) / r.L; k._top = along > r.L * 0.8; break; }
      }
      if (onRamp) k.y = ys;
      else if (k._top && k.v > 8) { k.air = true; k.vy = Math.min(11, k.v * 0.24 + 1.5); k.airT = 0; k.trick = 0; k.trickTo = 0; k._top = false; if (!isAI) { R.audio.noise(0.3, 0.12, 600, 0, 'bandpass'); R.buzz && R.buzz(15); } }
      else { k.y = 0; k._top = false; }
    } else {
      k.vy -= 22 * dt; k.y += k.vy * dt; k.airT += dt;
      // a tap of 🔥 (or a steer) in the air starts a full 360° spin; holding it keeps spinning. Each spin finishes by itself.
      if (!isAI && (R.input.drift || R.input.l || R.input.r)) { if (!k.trickTo) k.trickDir = R.input.r && !R.input.l ? -1 : 1; const done = Math.abs(k.trick); if (done >= (k.trickTo || 0) - 0.9) k.trickTo = (Math.floor(done / (Math.PI * 2) + 1e-6) + 1) * Math.PI * 2; }
      if (k.trickTo && Math.abs(k.trick) < k.trickTo) k.trick = (k.trickDir || 1) * Math.min(k.trickTo, Math.abs(k.trick) + dt * 11.5);
      if (k.y <= 0) {
        k.y = 0; k.air = false; let turns = Math.abs(k.trick) / (Math.PI * 2); if (k.trickTo && Math.abs(k.trick) > k.trickTo - 0.9) turns = k.trickTo / (Math.PI * 2);   // nearly round counts
        if (!isAI) {
          R.audio.bump(); R.shake = 0.25;
          if (turns >= 0.95) { const n = Math.round(turns); k.boost = Math.max(k.boost, 1.5 * (k.boostMul || 1)); R.audio.boost(); life.stunts++; addPickups(5 * n); R.callout(`🤸 ${n > 1 ? n + '× ' : ''}STUNT! +${10 * n} 🪙`, true); }
          else if (turns > 0.15) { k.v *= 0.55; k.slow = 0.8; R.callout('Bad landing', false); }
          else if (k.airT > 0.55) { k.boost = Math.max(k.boost, 0.6); R.callout('✈️ Big air!', true); }
        }
        k.trick = 0; k.trickTo = 0;
      }
    }
    k.position.y = k.y || 0;
    if (k.air) { k.rotation.y += k.trick; k.rotation.x = Math.max(-0.35, Math.min(0.3, -k.vy * 0.03)); }
  };

  const hit = (k, x, z, r) => { const dx = k.position.x - x, dz = k.position.z - z; return dx * dx + dz * dz < (r + 0.95) ** 2 && (k.y || 0) < 1.1; };
  /** Everything that moves by itself, once a frame. */
  R.lifeTick = (now, dt) => {
    const racing = R.phase === 'race', karts = [R.player, ...R.bots];
    // coins spin; the player collects them; they come back every lap
    const pl = R.player;
    if (pl.lap !== coinLap) { coinLap = pl.lap; coins.forEach((c) => { c.taken = false; }); }
    const { m4, q, v, one, zero } = TMP;
    q.setFromAxisAngle(Y, now / 260);
    coins.forEach((c, i) => {
      if (!c.taken && racing) { const dx = pl.position.x - c.x, dz = pl.position.z - c.z, dy = (pl.y || 0) + 0.6 - c.y; if (dx * dx + dz * dz < 2.6 && Math.abs(dy) < 1.5) { c.taken = true; addPickups(1); R.audio.tone(1320, 0.08, 'triangle', 0.14); R.audio.tone(1760, 0.14, 'triangle', 0.12, 0.06); } }
      m4.compose(v.set(c.x, c.y + Math.sin(now / 300 + i) * 0.12, c.z), q, c.taken ? zero : one); coinMesh.setMatrixAt(i, m4);
    });
    coinMesh.instanceMatrix.needsUpdate = true;

    // cattle: decide when each herd wanders onto the road
    if (life.drawCows) {
      const tRace = R.t0 ? now - R.t0 : 0;
      for (const herd of herds) {
        if (racing && !herd.crossing && tRace / 1000 > herd.next) {
          herd.crossing = true; herd.warned = false;
          herd.cows.forEach((c, i) => { if (Math.random() < 0.75 || i === 0) { c.target = rnd(-RW / 2 + 1.2, RW / 2 - 1.2) * (C.twin ? 0.9 : 1); c.wait = rnd(0, 3.5); } });
        }
        if (herd.crossing && herd.cows.every((c) => c.target == null)) { herd.crossing = false; herd.next = tRace / 1000 + rnd(20, 45); }
        // a warning when you are coming up on cows in the road
        if (herd.crossing && !herd.warned && racing && herd.cows.some((c) => Math.abs(c.lat) < RW / 2) && ahead(pl.idx, herd.s) < 45) { herd.warned = true; R.callout('🐄 Cows on the road!', false); moo(R, 0.5); }
      }
      life.drawCows(now, dt);
      for (const k of karts) {
        if (k._cowT && now - k._cowT < 1200) continue;
        for (const c of life.cows) if (Math.abs(c.lat) < RW / 2 + 2.2 && hit(k, c.x, c.z, 0.85)) {
          k._cowT = now; k.v = Math.min(k.v, 5); k.slow = Math.max(k.slow || 0, 1.1); k.boost = 0;
          c.hitAt = now; c.target = c.lat > 0 ? RW / 2 + 5 : -(RW / 2 + 5); if (C.twin && c.target < 0) c.target = c.home; c.wait = 0;
          if (k === pl) { R.audio.bump(); moo(R, 0.9); R.shake = 0.5; R.callout('🐄 Hit a cow! Slow down', false); R.buzz && R.buzz(60); }
          break;
        }
      }
    }
    // checkpoint drums: knocked over when you hit them, and they slow you
    for (const o of life.obstacles) {
      if (o.down) continue;
      for (const k of karts) if (hit(k, o.x, o.z, o.r)) {
        o.down = true; k.v *= 0.5; if (k === pl) { R.audio.bump(); R.shake = 0.35; R.callout('🛢️ Drums!', false); }
        const m = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, head(o.s) + rnd(-1, 1), 0)); m.compose(new THREE.Vector3(o.x + rnd(-1, 1), 0.33, o.z + rnd(-1, 1)), qq, new THREE.Vector3(1, 1, 1)); life.drumMesh.setMatrixAt(o.i, m); life.drumMesh.instanceMatrix.needsUpdate = true;
        break;
      }
    }
    if (checkpoint) { const on = Math.floor(now / 260) % 2; checkpoint.van.userData.lights.forEach((l, i) => { l.material.emissiveIntensity = (i % 2) === on ? 6 : 0.3; }); checkpoint.officers[0].userData.arm.rotation.z = -1.2 + Math.sin(now / 200) * 0.6; }

    // the police chase
    if (chaseOn && racing) {
      const tRace = now - R.t0;
      if (chase.state === 'idle' && tRace > chase.at && !pl.air) {
        chase.state = 'on'; chase.since = now; chase.el = 0; chase.s = wrap(pl.idx - 22); chase.lat = latOf(pl); chase.v = Math.max(pl.v, 20);
        if (!chase.car) { chase.car = policeCar(R); R.scene.add(chase.car); }
        chase.car.visible = true; sirenStart(); R.callout('🚨 Police! Don\'t let them catch you', false); R.el.querySelector('#stage')?.classList.add('kart-police');
      }
      if (chase.state !== 'idle' && chase.state !== 'gone') {
        const gap = ahead(chase.s, pl.idx) * 4;   // metres from the police car forward to you
        const sm = R.speedMul || 1;
        chase.el = (chase.el || 0) + dt;   // counted in race time, so a slow phone gets the same chase
        if (chase.state === 'on') {
          chase.v += (Math.min(H.BOOST_V * sm * 0.93, Math.max(pl.v + 5, 27 * sm)) - chase.v) * Math.min(1, dt * 1.5);
          chase.lat += Math.sign(latOf(pl) - chase.lat) * Math.min(Math.abs(latOf(pl) - chase.lat), 3.2 * dt);
          if (gap < 3.4 && Math.abs(latOf(pl) - chase.lat) < 2.3 && !pl.air) { chase.state = 'caught'; chase.since = now; chase.el = 0; chase.s = wrap(pl.idx - 1.4); chase.lat = latOf(pl); chase.v = 0; pl.v = 0; pl.held = 1.8; pl.boost = 0; R.audio.bump(); R.shake = 0.5; R.callout('🚔 Caught! Stopped for checks', false); R.buzz && R.buzz(80); }
          else if (chase.el > 20) { chase.state = 'escaped'; chase.since = now; chase.el = 0; addPickups(5); life.escapes = (life.escapes || 0) + 1; R.callout('😅 You escaped! +10 🪙', true); }
          else if (gap > 260) { chase.state = 'escaped'; chase.since = now; chase.el = 0; addPickups(5); life.escapes = (life.escapes || 0) + 1; R.callout('😅 Lost them! +10 🪙', true); }
        } else { chase.v = Math.max(0, chase.v - dt * (chase.state === 'caught' ? 30 : 12)); chase.lat += ((RW / 2 + 3) - chase.lat) * Math.min(1, dt); if (chase.el > 6) { chase.state = 'gone'; chase.car.visible = false; sirenStop(); R.el.querySelector('#stage')?.classList.remove('kart-police'); } }
        chase.s = wrap(chase.s + (chase.v * dt) / 4);
        const [x, z] = at(chase.s, chase.lat); chase.car.position.set(x, 0, z); chase.car.rotation.y = head(chase.s);
        const on = Math.floor(now / 180) % 2; chase.car.userData.lights.forEach((l, i) => { l.material.emissiveIntensity = (i % 2) === on ? 8 : 0.4; });
        sirenLevel(chase.state === 'gone' ? 0 : Math.max(0, 0.16 * (1 - Math.min(1, gap / 220))) + 0.02);
      }
    }
    if (rail) rail.update(now, dt);
    // an airliner coming in low over the runway every half minute or so
    if (plane) {
      const u = plane.userData;
      if (!plane.visible && now > u.next) { plane.visible = true; u.t0 = now; R.audio.noise(6, 0.08, 220, 0, 'lowpass'); }
      if (plane.visible) {
        const t = (now - u.t0) / 1000, x = 1500 - t * 85, y = Math.max(28, 180 - t * 9);
        plane.position.set(x, y, C.airfield.runwayZ - 40); plane.rotation.set(0, -Math.PI / 2, 0.03);
        if (x < -1500) { plane.visible = false; u.next = now + rnd(22000, 38000); }
      }
    }
  };
  return life;
}



/* ================================== the Abuja light rail ================================== */
/**
 * An elevated line crossing the circuit on a concrete viaduct, and the green-and-white Abuja light rail train
 * running across it every half minute or so, so you race underneath. The viaduct is fused with the scenery;
 * the train is one mesh (three cars) that slides along the deck.
 */
function buildRail(R, { at, head, N, RW, straight, free, busy, wrap }) {
  const C = R.circuit, P = R.samples, TN = R.tangents;
  const L = 560, H = 9.6, latC = C.twin ? -(RW + C.twin.median) / 2 : 0;
  const marks = C.landmarks || [];
  // a straight stretch away from the start, where the deck clears every landmark
  let s = -1, best = 1e9;
  for (let k = Math.floor(N * 0.28); k < N * 0.8; k += 5) {
    if (!free(k, 45)) continue;
    const t = TN[k], [cx, cz] = at(k, latC); let ok = true;
    for (let d = -L / 2; d <= L / 2 && ok; d += 20) { const x = cx - t.z * -d, z = cz + t.x * -d; if (marks.some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 70 * 70)) ok = false; }
    if (!ok) continue; const v = straight(k) + Math.abs(k / N - 0.42) * 0.3; if (v < best) { best = v; s = k; }
  }
  if (s < 0) return null; busy.push(s);
  const g = new THREE.Group(); R.placeAlong(g, s, latC);
  const concrete = M({ color: '#CFCAC0', roughness: 0.85, map: R.tex.pave }), dark = M({ color: '#4C4F55', roughness: 0.4, metalness: 0.7 }), rail = M({ color: '#8E9197', roughness: 0.35, metalness: 0.9 });
  const box = (w, h, d, m, x, y, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  box(L, 1.3, 8, concrete, 0, H - 0.65);
  for (const z of [-3.9, 3.9]) { box(L, 1.1, 0.25, concrete, 0, H + 0.55, z); box(L, 0.08, 0.08, dark, 0, H + 1.15, z); }   // parapets with a handrail
  for (const z of [-2.2, -0.8, 0.8, 2.2]) box(L, 0.16, 0.12, rail, 0, H + 0.08, z);
  for (let x = -L / 2; x <= L / 2; x += 4) box(0.3, 0.1, 5.6, dark, x, H + 0.02, 0);   // sleepers
  // piers every 32 m, left out wherever one would stand on the circuit
  g.updateMatrixWorld(true);
  for (let x = -L / 2 + 10; x <= L / 2 - 10; x += 32) {
    const w = g.localToWorld(new THREE.Vector3(x, 0, 0)); if (!R.clearOfTrack(w.x, w.z, RW / 2 + 7)) continue;
    box(2.4, H - 1.3, 3.4, concrete, x, (H - 1.3) / 2); box(3.2, 0.9, 8.4, concrete, x, H - 1.75);
  }
  R.scene.add(g);
  // the train: white body, a green band and green-framed cab ends with a dark windscreen, as on the Abuja Metro
  const parts = [];
  const add = (geo, hex) => { const c = new THREE.Color(hex); geo = geo.index ? geo.toNonIndexed() : geo; const a = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(geo); return geo; };
  const bx = (w, h, d, hex, x, y, z = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); return add(b, hex); };
  const CAR = 20, GAP = 1.2;
  for (let c = 0; c < 3; c++) {
    const x0 = -c * (CAR + GAP);
    bx(CAR, 2.7, 2.8, '#F2F3F1', x0, 2.35);                    // body
    const roof = new THREE.CylinderGeometry(1.4, 1.4, CAR, 14, 1, false, 0, Math.PI); roof.rotateZ(Math.PI / 2); roof.rotateX(Math.PI / 2); roof.scale(1, 0.28, 1); roof.translate(x0, 3.7, 0); add(roof, '#E9EBEA');
    bx(CAR + 0.02, 0.9, 2.84, '#1C2A33', x0, 2.9);             // window band
    bx(CAR + 0.02, 0.28, 2.86, '#0E8A4A', x0, 1.55);           // green waist stripe
    bx(CAR - 1, 0.7, 2.4, '#2A2D31', x0, 0.75);                // underframe
    for (const bxo of [-CAR / 2 + 3.2, CAR / 2 - 3.2]) bx(2.4, 0.8, 2.3, '#1A1B1E', x0 + bxo, 0.45);   // bogies
    for (const dx of [-4, 3]) bx(1.1, 1.9, 2.88, '#DADCDA', x0 + dx, 2.1);   // doors
  }
  // cab ends: a sloped green-framed nose with a black windscreen and headlights, at both ends
  for (const [x, dir] of [[CAR / 2, 1], [-(2 * (CAR + GAP)) - CAR / 2, -1]]) {
    const nose = new THREE.BoxGeometry(2.4, 3.0, 2.8, 2, 2, 1); const p = nose.attributes.position;
    for (let i = 0; i < p.count; i++) { const lx = p.getX(i), ly = p.getY(i); if (lx > 0) p.setX(i, lx - (ly > 0 ? 0.9 : 0.1) * (ly + 1.5) / 3); }   // raked windscreen
    nose.computeVertexNormals(); if (dir < 0) nose.rotateY(Math.PI); nose.translate(x + dir * 1.1, 2.4, 0); add(nose, '#0E8A4A');
    const ws = new THREE.PlaneGeometry(2.3, 1.2); ws.rotateY(dir > 0 ? Math.PI / 2 : -Math.PI / 2); ws.rotateZ(dir * -0.35); ws.translate(x + dir * 2.05, 3.0, 0); add(ws, '#0B0F14');
    for (const z of [-0.95, 0.95]) bx(0.12, 0.22, 0.42, '#FFF6D0', x + dir * 2.3, 1.75, z);
  }
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) { const size = parts[0].attributes[name].itemSize; const arr = new Float32Array(parts.reduce((n, q) => n + q.attributes[name].array.length, 0)); let o = 0; parts.forEach((q) => { arr.set(q.attributes[name].array, o); o += q.attributes[name].array.length; }); merged.setAttribute(name, new THREE.BufferAttribute(arr, size)); }
  const train = new THREE.Mesh(merged, M({ vertexColors: true, roughness: 0.35, metalness: 0.15, envMapIntensity: 0.8 }));
  train.castShadow = true; train.userData.dynamic = true; train.visible = false; train.frustumCulled = false; g.add(train);
  const TL = 3 * CAR + 2 * GAP;
  const state = { x: 0, dir: 1, next: performance.now() + 6000, running: false, honked: false };
  return {
    s, state, update(now, dt) {
      if (!state.running) { if (now < state.next) return; state.running = true; state.dir = -state.dir; state.x = state.dir > 0 ? -L / 2 - 10 : L / 2 + 10; train.rotation.y = state.dir > 0 ? 0 : Math.PI; train.visible = true; state.honked = false; }
      state.x += state.dir * 17 * dt; train.position.set(state.x, H + 0.15, state.dir > 0 ? -1.5 : 1.5);
      // a double horn as it comes over the road, when you are near
      if (!state.honked && Math.abs(state.x) < 90 && R.player) { const d = Math.hypot(R.player.position.x - g.position.x, R.player.position.z - g.position.z); if (d < 160) { state.honked = true; R.audio.tone(330, 0.5, 'sawtooth', 0.07); R.audio.tone(415, 0.5, 'sawtooth', 0.06); R.audio.tone(330, 0.7, 'sawtooth', 0.07, 0.6); R.audio.tone(415, 0.7, 'sawtooth', 0.06, 0.6); R.audio.noise(3.5, 0.05, 160, 0, 'lowpass'); } }
      const tail = state.x - state.dir * TL;
      if ((state.dir > 0 && tail > L / 2) || (state.dir < 0 && tail < -L / 2)) { state.running = false; train.visible = false; state.next = now + 9000 + Math.random() * 12000; }
      // the part of the train beyond the ends of the deck is hidden by keeping it short of them
      train.visible = !(state.dir > 0 ? state.x - TL > L / 2 : state.x + TL < -L / 2);
    },
  };
}

/* ================================== the cow ================================== */
/** Merge geometries keeping vertex colours (white where a piece has none). */
function mergeC(list) {
  const geos = list.map((g) => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } return g; });
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) { const size = geos[0].attributes[name].itemSize; const arr = new Float32Array(geos.reduce((n, g) => n + g.attributes[name].count * size, 0)); let o = 0; geos.forEach((g) => { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }); out.setAttribute(name, new THREE.BufferAttribute(arr, size)); }
  return out;
}
const paint = (g, hex) => { const c = new THREE.Color(hex); g = g.index ? g.toNonIndexed() : g; const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
/**
 * A White Fulani (Bunaji) cow, the breed on every Abuja roadside: a deep rounded body, the hump over the shoulders,
 * a hanging dewlap, a long face with a dark muzzle, and tall lyre-shaped horns. Built from smooth revolved shapes,
 * not boxes, and coloured per animal by the instance colour (white, cream, or the red of the Bororo).
 */
function cowGeometry() {
  const parts = [];
  // the barrel of the body: a revolved profile from rump to chest, deeper than it is wide
  const prof = [[0.02, -1.0], [0.2, -0.97], [0.33, -0.86], [0.4, -0.66], [0.43, -0.4], [0.44, -0.1], [0.43, 0.2], [0.41, 0.5], [0.36, 0.72], [0.24, 0.86], [0.02, 0.9]];
  const barrel = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 12); barrel.rotateX(Math.PI / 2); barrel.scale(0.84, 1.08, 1); barrel.translate(0, 1.13, 0); parts.push(barrel);
  // hip bones and the hump over the withers
  for (const s of [-1, 1]) { const hip = new THREE.SphereGeometry(0.16, 7, 5); hip.translate(s * 0.26, 1.42, -0.72); parts.push(hip); }
  const hump = new THREE.SphereGeometry(0.28, 10, 7); hump.scale(0.8, 1.05, 1.25); hump.translate(0, 1.5, 0.5); parts.push(hump);
  // neck, falling towards the head, with the loose dewlap underneath
  const neck = new THREE.CylinderGeometry(0.17, 0.26, 0.62, 9, 1, true); neck.rotateX(-1.05); neck.translate(0, 1.3, 0.98); parts.push(neck);
  const dew = new THREE.SphereGeometry(0.3, 8, 6); dew.scale(0.28, 0.9, 1.1); dew.translate(0, 0.98, 0.92); parts.push(dew);
  // the long face: skull, then a narrower muzzle, dark at the nose
  const skull = new THREE.CapsuleGeometry(0.14, 0.28, 3, 9); skull.rotateX(1.05); skull.scale(0.95, 1, 1); skull.translate(0, 1.32, 1.3); parts.push(skull);
  const muzzle = paint(new THREE.CapsuleGeometry(0.11, 0.12, 3, 8), '#3A2E2A'); muzzle.rotateX(1.2); muzzle.translate(0, 1.13, 1.5); parts.push(muzzle);
  for (const s of [-1, 1]) { const eye = paint(new THREE.SphereGeometry(0.03, 4, 3), '#141010'); eye.translate(s * 0.12, 1.4, 1.34); parts.push(eye);
    const ear = new THREE.ConeGeometry(0.07, 0.24, 5); ear.scale(1, 1, 0.45); ear.rotateZ(s * 1.8); ear.translate(s * 0.22, 1.43, 1.2); parts.push(ear); }
  // tail with a dark tuft
  const tail = new THREE.CylinderGeometry(0.025, 0.04, 0.8, 4, 1, true); tail.translate(0, 1.0, -1.0); parts.push(tail);
  const tuft = paint(new THREE.SphereGeometry(0.07, 5, 4), '#2B2220'); tuft.scale(1, 1.8, 1); tuft.translate(0, 0.58, -1.0); parts.push(tuft);
  const bodyG = mergeC(parts);
  // lyre-shaped horns: up and out, then in, pale with darker tips
  const horn = (sx) => { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.1, 1.46, 1.2), new THREE.Vector3(sx * 0.3, 1.6, 1.18), new THREE.Vector3(sx * 0.38, 1.9, 1.08), new THREE.Vector3(sx * 0.26, 2.18, 0.98)]), 8, 0.045, 5);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), uv = g.attributes.uv; for (let i = 0; i < n; i++) { const t = uv.getX(i); const k = t > 0.8 ? 0.35 : 0.95 - t * 0.15; c[i * 3] = k * 0.98; c[i * 3 + 1] = k * 0.93; c[i * 3 + 2] = k * 0.82; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const hornG = mergeC([horn(1), horn(-1)]);
  // a leg: tapered upper and lower parts with a knee, and a dark hoof; pivots at the top
  const up = new THREE.CylinderGeometry(0.075, 0.1, 0.45, 6, 1, true); up.translate(0, -0.22, 0);
  const knee = new THREE.SphereGeometry(0.075, 6, 4); knee.translate(0, -0.46, 0.01);
  const low = new THREE.CylinderGeometry(0.05, 0.065, 0.36, 6, 1, true); low.translate(0, -0.64, 0);
  const hoof = paint(new THREE.CylinderGeometry(0.06, 0.07, 0.09, 6), '#2A2320'); hoof.translate(0, -0.84, 0.01);
  const legG = mergeC([up, knee, low, hoof]);
  // a subtle hide: short hair and a little dust, so the white is not flat plastic
  const coat = canvasTex(128, 128, (g) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { const v = 200 + Math.random() * 55; g.strokeStyle = `rgba(${v},${v - 6},${v - 16},.5)`; g.lineWidth = 1; const x = Math.random() * 128, y = Math.random() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + 3 + Math.random() * 3); g.stroke(); } for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(150,110,80,.08)'; g.beginPath(); g.arc(Math.random() * 128, 90 + Math.random() * 38, 6 + Math.random() * 14, 0, 7); g.fill(); } }, true);
  return { bodyG, hornG, legG, coat };
}

/* ================================== people and vehicles ================================== */
function herder(R) {
  const g = new THREE.Group(); const robes = ['#E9E4D6', '#2A3D6B', '#6B4A2A', '#3C6E47', '#8A2F2F'];
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 1.25, 10), M({ color: robes[Math.floor(Math.random() * robes.length)], roughness: 0.9 })); robe.position.y = 0.63; g.add(robe);
  const skin = M({ color: '#4A2E1C', roughness: 0.7 });
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin); headM.position.y = 1.43; g.add(headM);
  const straw = M({ color: '#C8A15A', roughness: 0.9 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 18), straw); brim.position.y = 1.53; g.add(brim);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 12), straw); crown.position.y = 1.7; g.add(crown);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 8), M({ color: '#5A3A1E', roughness: 0.8 })); tip.position.y = 1.86; g.add(tip);   // the leather top of the Fulani hat
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6), M({ color: '#6E4B2A', roughness: 0.8 })); stick.rotation.z = Math.PI / 2; stick.position.y = 1.32; g.add(stick);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), skin); arm.position.set(s * 0.34, 1.42, 0); g.add(arm); }
  g.userData.stick = stick; g.userData.dynamic = true; g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); R.scene.add(g); return g;
}
function officer() {
  const g = new THREE.Group(); const uni = M({ color: '#1C2B4A', roughness: 0.8 }), skin = M({ color: '#4A2E1C', roughness: 0.7 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.22), uni); legs.position.y = 0.43; g.add(legs);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.26), uni); body.position.y = 1.16; g.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.28), M({ color: '#C6F23A', roughness: 0.5, emissive: '#6B8A00', emissiveIntensity: 0.3 })); vest.position.y = 1.2; g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin); head.position.y = 1.62; g.add(head);
  const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12), M({ color: '#111', roughness: 0.8 })); beret.position.y = 1.74; g.add(beret);
  const arm = new THREE.Group(); const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), uni); a.position.y = -0.27; arm.add(a); arm.position.set(0.28, 1.4, 0); g.add(arm);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), uni); arm2.position.set(-0.28, 1.13, 0); g.add(arm2);
  g.userData.arm = arm; g.userData.dynamic = true; return g;
}
/** A Nigeria Police patrol pickup: dark blue, POLICE on the doors, a red and blue light bar. */
export function policeCar(R) {
  const g = new THREE.Group(); const body = M({ color: '#16254A', roughness: 0.35, metalness: 0.5 }), dark = M({ color: '#111317', roughness: 0.4 }), glass = M({ color: '#1C2A35', roughness: 0.1, metalness: 0.8 });
  const b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  b(1.95, 0.75, 5.0, body, 0, 0.78, 0); b(1.8, 0.7, 1.9, body, 0, 1.5, 0.55); b(1.82, 0.5, 1.7, glass, 0, 1.55, 0.58);
  b(1.95, 0.5, 1.9, body, 0, 1.3, -1.5); b(1.7, 0.1, 1.8, dark, 0, 1.06, -1.5);   // the open bed
  b(2.0, 0.25, 0.3, M({ color: '#DDD', metalness: 0.8, roughness: 0.3 }), 0, 0.55, 2.55);
  for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.5], [0.95, -1.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.4, z); g.add(w); }
  const lights = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.26), new THREE.MeshStandardMaterial({ color: i % 2 ? '#2A5CFF' : '#FF2A2A', emissive: i % 2 ? '#2A5CFF' : '#FF2A2A', emissiveIntensity: 2 })); m.position.set(-0.6 + i * 0.4, 1.94, 0.55); g.add(m); lights.push(m); }
  const t = canvasTex(256, 64, (x) => { x.fillStyle = '#16254A'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#FFFFFF'; x.font = '900 40px Inter, system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', 128, 34); x.fillStyle = '#C8102E'; x.fillRect(0, 56, 256, 8); });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 })); p.position.set(s * 0.985, 0.85, 0.3); p.rotation.y = s * Math.PI / 2; g.add(p); }
  const hood = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: t })); hood.rotation.x = -Math.PI / 2; hood.position.set(0, 1.16, 1.9); g.add(hood);
  g.userData.lights = lights; g.userData.dynamic = true; return g;
}
/** A twin-engine airliner, white with a green tail. */
function airliner(R, gearUp = false) {
  const g = new THREE.Group(); const white = M({ color: '#F2F3F5', roughness: 0.35, metalness: 0.3 }), green = M({ color: '#0C7A45', roughness: 0.4 }), grey = M({ color: '#9AA0A8', roughness: 0.4, metalness: 0.6 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 36, 16), white); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.rotation.x = Math.PI / 2; nose.position.z = 18; nose.scale.y = 1.6; g.add(nose);
  const tailc = new THREE.Mesh(new THREE.ConeGeometry(2, 7, 16), white); tailc.rotation.x = -Math.PI / 2; tailc.position.z = -21.5; g.add(tailc);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 5), white); wing.position.set(0, -0.8, 1); g.add(wing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 5), green); fin.position.set(0, 5, -20); g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 3), white); stab.position.set(0, 1, -21); g.add(stab);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.1, 4.5, 14), grey); e.rotation.x = Math.PI / 2; e.position.set(s * 7, -2, 2.5); g.add(e); }
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 30, 16, 1, true, Math.PI * 0.35, Math.PI * 0.3), green); stripe.rotation.x = Math.PI / 2; g.add(stripe);
  if (!gearUp) for (const [x, z] of [[0, 12], [-3, -1], [3, -1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 12), M({ color: '#111' })); w.rotation.z = Math.PI / 2; w.position.set(x, -3.6, z); g.add(w); const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), grey); l.position.set(x, -2.6, z); g.add(l); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); if (gearUp) g.userData.dynamic = true;   // parked ones are fused with the scenery
  return g;
}
/** A cow's moo: a low sawtooth sliding down, through a soft filter. */
function moo(R, vol) {
  const a = R.audio; if (!a || !a.ctx) return; const c = a.ctx, t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(128, t + 0.25); o.frequency.linearRampToValueAtTime(105, t + 1.0);
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(900, t + 0.3); f.frequency.linearRampToValueAtTime(350, t + 1.0);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.12); g.gain.linearRampToValueAtTime(0.18 * vol, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 1.1);
  o.connect(f); f.connect(g); g.connect(a.sfx || a.master); o.start(t); o.stop(t + 1.2);
}

/* ================================== the bush path ================================== */
function bushWorld(R, H, { at, head, N, RW }) {
  const T = R.tier; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const clear = (x, z, r) => R.clearOfTrack(x, z, r);
  // savanna grass: thousands of tufts in dry greens and golds, thicker away from the road
  // savanna grass: clumps of drawn blades on two crossed cards (4 triangles a clump), dry gold and olive
  const bladeTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 46; i++) { const x = 20 + Math.random() * 88, h = 50 + Math.random() * 74, lean = (Math.random() - 0.5) * 50, w = 1.5 + Math.random() * 2.5;
      const tone = 150 + Math.random() * 90; g.strokeStyle = `rgb(${tone},${tone * 0.82},${tone * 0.42})`; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h); g.stroke(); }
    for (let i = 0; i < 10; i++) { const x = 25 + Math.random() * 78, y = 10 + Math.random() * 40; g.fillStyle = 'rgba(200,170,110,.9)'; g.beginPath(); g.ellipse(x, y, 2.5, 7, Math.random(), 0, 7); g.fill(); }   // seed heads
  });
  const card = new THREE.PlaneGeometry(1.6, 1.3); card.translate(0, 0.62, 0); const card2 = card.clone(); card2.rotateY(Math.PI / 2);
  const tuft = mergeC([card, card2]);
  const GN = T === 'low' ? 140 : T === 'medium' ? 700 : 1600;   // see-through cards cost a lot of pixel work on phones: keep them few
  const gm = new THREE.InstancedMesh(tuft, M({ map: bladeTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.15 }), GN); let n = 0;
  for (let tries = 0; tries < GN * 3 && n < GN; tries++) {
    const s = Math.random() * N, side = Math.random() < 0.5 ? -1 : 1, off = side * (RW / 2 + 0.8 + Math.pow(Math.random(), 1.7) * 55);
    const [x, z] = at(s, off); if (!clear(x, z, RW / 2 + 0.5)) continue;
    const k = 0.7 + Math.random() * 0.9; m4.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, Math.random() * 6), sc.set(k, k * (0.8 + Math.random() * 0.6), k)); gm.setMatrixAt(n, m4);
    gm.setColorAt(n, col.setHSL(0.1 + Math.random() * 0.06, 0.25 + Math.random() * 0.2, 0.62 + Math.random() * 0.2)); n++;
  }
  gm.count = n; R.scene.add(gm);
  // the road's edge frays into the grass instead of stopping on a hard line
  const fray = (flip) => canvasTex(64, 64, (g) => { const id = g.createImageData(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const u = flip ? 1 - x / 63 : x / 63; const a = Math.max(0, Math.min(1, 1 - u * 1.25 + (Math.random() - 0.5) * 0.45)); const k = (y * 64 + x) * 4; id.data[k] = 168; id.data[k + 1] = 96; id.data[k + 2] = 58; id.data[k + 3] = Math.round(a * 235); } g.putImageData(id, 0, 0); }, true);
  for (const [a, b, flip] of [[RW / 2 - 0.2, RW / 2 + 2.6, false], [-RW / 2 - 2.6, -RW / 2 + 0.2, true]]) { const t = fray(flip); t.wrapS = THREE.ClampToEdgeWrapping; t.repeat.set(1 / 2.8, 1 / 4); const m = new THREE.Mesh(R.ribbon(a, b, 0.025), M({ map: t, transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.2 })); m.renderOrder = 1; m.receiveShadow = true; R.scene.add(m); }
  // shea and acacia trees: a thin trunk and a wide flat crown
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 4, 6); trunk.translate(0, 2, 0);
  const fol = H.foliageGeometries ? H.foliageGeometries() : null; const leafF = fol ? H.foliageMaterial('leaves') : null;
  let crown; if (fol) { crown = fol.crown.clone(); crown.scale(0.9, 0.42, 0.9); crown.translate(0, 1.75, 0); } else { crown = new THREE.SphereGeometry(3, 10, 6); crown.scale(1, 0.42, 1); crown.translate(0, 4.6, 0); }   // the flat umbrella of an acacia
  const TNn = T === 'low' ? 60 : T === 'medium' ? 110 : 170; const tm = new THREE.InstancedMesh(trunk, M({ color: '#5E4630', roughness: 0.9 }), TNn), cm = new THREE.InstancedMesh(crown, leafF ? leafF.m : M({ color: '#FFFFFF', roughness: 0.95 }), TNn); let nt = 0; if (leafF) cm.customDepthMaterial = leafF.depth;
  for (let tries = 0; tries < TNn * 4 && nt < TNn; tries++) {
    const s = Math.random() * N, side = Math.random() < 0.5 ? -1 : 1, off = side * (RW / 2 + 7 + Math.random() * 110);
    const [x, z] = at(s, off); if (!clear(x, z, RW / 2 + 5)) continue;
    const k = 0.7 + Math.random() * 0.8; m4.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, Math.random() * 6), sc.set(k, k, k)); tm.setMatrixAt(nt, m4); cm.setMatrixAt(nt, m4); cm.setColorAt(nt, col.setHSL(0.2 + Math.random() * 0.06, 0.3, leafF ? 0.62 + Math.random() * 0.15 : 0.3)); nt++;
  }
  tm.count = cm.count = nt; [tm, cm].forEach((m) => { m.castShadow = T !== 'low'; R.scene.add(m); });
  // a few baobabs: fat trunks and stubby branches
  const bark = M({ color: '#8A7A68', roughness: 0.95, map: R.tex.rock });
  for (let i = 0; i < 6; i++) {
    const s = (i + 0.3) * N / 6, side = i % 2 ? 1 : -1; const [x, z] = at(s, side * (RW / 2 + 16 + Math.random() * 20)); if (!clear(x, z, RW / 2 + 10)) continue;
    const g = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 8, 12), bark); tr.position.y = 4; g.add(tr);
    for (let b = 0; b < 6; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 4, 6), bark); br.position.set(Math.cos(b) * 1.4, 8.6, Math.sin(b) * 1.4); br.rotation.set(Math.sin(b) * 0.7, 0, -Math.cos(b) * 0.7); g.add(br); }
    g.position.set(x, 0, z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); R.scene.add(g);
  }
  // round mud huts with thatched roofs: villages at the landmarks, and a few along the road
  const spots = [];
  for (const l of R.circuit.landmarks || []) if (l.id === 'village') for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + Math.random() * 0.3, r = 14 + Math.random() * 22; spots.push([l.x + Math.cos(a) * r, l.z + Math.sin(a) * r]); }
  for (let s = 40; s < N; s += Math.floor(N / 9)) for (let k = 0; k < 3; k++) { const [x, z] = at(s + k * 4, (s % 2 ? 1 : -1) * (RW / 2 + 16 + k * 7)); spots.push([x, z]); }
  const ok = spots.filter(([x, z]) => clear(x, z, RW / 2 + 6));
  const wall = new THREE.CylinderGeometry(2.4, 2.5, 2.3, 14); wall.translate(0, 1.15, 0);
  const roof = new THREE.ConeGeometry(3.3, 2.8, 14); roof.translate(0, 3.6, 0);
  const door = new THREE.BoxGeometry(0.9, 1.5, 0.2); door.translate(0, 0.75, 2.45);
  const wm = new THREE.InstancedMesh(wall, M({ color: '#FFFFFF', roughness: 1, map: R.tex.rock }), ok.length), rm = new THREE.InstancedMesh(roof, M({ color: '#FFFFFF', roughness: 1 }), ok.length), dm = new THREE.InstancedMesh(door, M({ color: '#2A1A10', roughness: 1 }), ok.length);
  ok.forEach(([x, z], i) => { const k = 0.8 + Math.random() * 0.35; m4.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, Math.random() * 6), sc.set(k, k, k)); wm.setMatrixAt(i, m4); rm.setMatrixAt(i, m4); dm.setMatrixAt(i, m4); wm.setColorAt(i, col.set(['#A0522D', '#B5653A', '#9A5A34', '#C27A4A'][i % 4])); rm.setColorAt(i, col.setHSL(0.11 + Math.random() * 0.03, 0.45, 0.45 + Math.random() * 0.1)); });
  [wm, rm, dm].forEach((m) => { m.castShadow = T !== 'low'; R.scene.add(m); });
  // granite outcrops close to the road, the way the hills rise out of the bush round Abuja
  const rock = M({ map: R.tex.rock, normalMap: R.tex.rockN, roughness: 0.95, color: '#A8A092' });
  for (let i = 0; i < 7; i++) { const s = (i + 0.6) * N / 7, side = i % 2 ? -1 : 1; const [x, z] = at(s, side * (RW / 2 + 70 + Math.random() * 90)); if (!clear(x, z, 60)) continue; const m = new THREE.Mesh(H.rockGeometry(R.tier === 'low' ? 2 : 3, 0.7, 11 + i * 2.3), rock); m.scale.set(30 + Math.random() * 30, 26 + Math.random() * 30, 26 + Math.random() * 26); m.position.set(x, -2, z); m.castShadow = true; R.scene.add(m); }
}

/* ================================== the airfield ================================== */
function airfield(R, H, { at, head, N, RW }) {
  const C = R.circuit, A = C.airfield, P = R.samples, TN = R.tangents;
  const isRunway = (i) => Math.abs(P[i].z - A.runwayZ) < 3 && Math.abs(P[i].x) < A.half;
  const isTaxi = (i) => Math.abs(P[i].z - A.taxiZ) < 3 && Math.abs(P[i].x) < A.half;
  // markings: runway centreline dashes, edge lines, the threshold "piano keys" and runway numbers; a yellow taxiway line
  const white = [], yellow = [];
  const quad = (arr, i, lat, w, len = 1) => { const j = (i + len) % N; const a = P[i], b = P[j], t = TN[i]; arr.push([a.x - t.z * (lat - w), a.z + t.x * (lat - w), a.x - t.z * (lat + w), a.z + t.x * (lat + w), b.x - t.z * (lat - w), b.z + t.x * (lat - w), b.x - t.z * (lat + w), b.z + t.x * (lat + w)]); };
  for (let i = 0; i < N; i++) {
    if (isRunway(i)) { quad(white, i, RW / 2 - 0.8, 0.25); quad(white, i, -RW / 2 + 0.8, 0.25); if (i % 12 < 7) quad(white, i, 0, 0.45); }
    else if (isTaxi(i)) quad(yellow, i, 0, 0.18);
  }
  const rw = []; for (let i = 0; i < N; i++) if (isRunway(i)) rw.push(i);
  if (rw.length) { const ends = [rw.find((i) => !isRunway((i - 1 + N) % N)), rw.find((i) => !isRunway((i + 1) % N))];
    ends.forEach((e, k) => { const s0 = k ? e - 16 : e + 2; for (let b = -5; b <= 5; b++) if (b) for (let d = 0; d < 8; d++) quad(white, (s0 + d) % N, b * 2.1, 0.6); });
    const num = (text, s, flip) => { const t = canvasTex(256, 256, (g) => { g.clearRect(0, 0, 256, 256); g.fillStyle = '#FFFFFF'; g.font = '900 170px Inter, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 138); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = -head(s) + (flip ? 0 : Math.PI); const [x, z] = at(s, 0); m.position.set(x, 0.06, z); R.scene.add(m); };
    num('04', ends[0] + 14, true); num('22', ends[1] - 22, false); }
  const toMesh = (arr, colr) => { if (!arr.length) return; const pos = [], idx = []; arr.forEach((q) => { const v0 = pos.length / 3; pos.push(q[0], 0.05, q[1], q[2], 0.05, q[3], q[4], 0.05, q[5], q[6], 0.05, q[7]); idx.push(v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); R.scene.add(new THREE.Mesh(g, M({ color: colr, roughness: 0.5, side: THREE.DoubleSide }))); };
  toMesh(white, '#F4F4F0'); toMesh(yellow, '#F2C21A');
  // edge lights: white along the runway, blue along the taxiway
  const lg = new THREE.SphereGeometry(0.22, 6, 4); const wl = [], bl = [];
  for (let i = 0; i < N; i += 4) for (const s of [-1, 1]) { const [x, z] = at(i, s * (RW / 2 + 2)); (isRunway(i) ? wl : isTaxi(i) ? bl : wl).push([x, z]); }
  [[wl, '#FFF6D8'], [bl, '#3A6BFF']].forEach(([list, c]) => { if (!list.length) return; const m = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(R.env && R.env.night ? 6 : 1.6), toneMapped: false }), list.length); list.forEach(([x, z], i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.35, z))); R.scene.add(m); });
  // paved shoulders either side
  const sh = M({ map: R.tex.asphalt, color: '#8D8A84', roughness: 0.95 }); for (const [a, b] of [[RW / 2, RW / 2 + 7], [-RW / 2 - 7, -RW / 2]]) { const m = new THREE.Mesh(R.ribbon(a, b, 0.015), sh); m.receiveShadow = true; R.scene.add(m); }
  // the apron beyond the taxiway: concrete, parked airliners nose-in to the terminal, and hangars
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(1300, 150), M({ map: R.roadMat.map, color: '#D8D5CE', roughness: 0.9 })); apron.material.map = R.roadMat.map.clone(); apron.material.map.needsUpdate = true; apron.material.map.repeat.set(130, 15); apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.012, A.taxiZ + 105); apron.receiveShadow = true; R.scene.add(apron);
  [-420, -170, 170, 420].forEach((x, i) => { const p = airliner(R); p.position.set(x, 4.2, A.taxiZ + 120); p.rotation.y = Math.PI; R.scene.add(p); });
  const hangar = M({ color: '#B9C0C8', roughness: 0.5, metalness: 0.5 });
  for (const x of [-620, 620]) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(70, 12, 50), hangar); b.position.y = 6; g.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(35, 35, 50, 20, 1, false, 0, Math.PI), hangar); r.rotation.z = Math.PI / 2; r.rotation.y = Math.PI / 2; r.scale.set(1, 1, 0.3); r.position.y = 12; g.add(r); g.position.set(x, 0, A.taxiZ + 150); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); R.scene.add(g); }
  // a windsock beside the runway
  const ws = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), M({ color: '#DDD' })); pole.position.y = 3.5; ws.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.2, 12, 1, true), M({ color: '#FF6A1A', side: THREE.DoubleSide, roughness: 0.7 })); sock.rotation.z = Math.PI / 2 - 0.2; sock.position.set(1.6, 6.8, 0); ws.add(sock); ws.position.set(-300, 0, A.runwayZ - 45); R.scene.add(ws);
}
