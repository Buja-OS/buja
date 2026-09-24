// Buja Kart: a go-kart race round central Abuja. three.js (vendored, loaded only here), low-poly and instanced so it
// holds 60 fps on ordinary phones. Solo and bot races run entirely on the phone; rooms sync through /kart/rooms.
import * as THREE from './vendor/three.module.min.js';

const LAPS = 3;
const ROAD_W = 16;                     // metres
const MAX_V = 36, OFF_V = 15, BOOST_V = 46; // m/s
const SAMPLES = 900;

/* The circuit: the real order and rough layout of central Abuja's landmarks, compressed into a raceable lap.
   x east, z south, in metres. Start/finish in front of Eagle Square. */
const LAYOUT = [
  [0, 0], [120, -20], [230, -90], [300, -200], [330, -330], [300, -450], [210, -520], [80, -540], [-40, -600],
  [-170, -610], [-280, -540], [-330, -420], [-300, -290], [-360, -170], [-330, -40], [-230, 40], [-110, 50],
];
const LANDMARKS = [
  { id: 'eagle', name: 'Eagle Square', at: 0.005, side: 1, dist: 48 },
  { id: 'nnpc', name: 'NNPC Towers', at: 0.12, side: -1, dist: 60 },
  { id: 'christian', name: 'National Christian Centre', at: 0.24, side: 1, dist: 58 },
  { id: 'assembly', name: 'National Assembly', at: 0.38, side: 1, dist: 70 },
  { id: 'aso', name: 'Aso Rock', at: 0.44, side: 1, dist: 240 },
  { id: 'millennium', name: 'Millennium Park', at: 0.58, side: -1, dist: 55 },
  { id: 'mosque', name: 'National Mosque', at: 0.74, side: -1, dist: 66 },
  { id: 'gate', name: 'City Gate', at: 0.9, side: 0, dist: 0 },
];
const BOOSTS = [0.1, 0.33, 0.52, 0.8];

export function registerKart({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy, avatar } = ui;
  const fmt = (ms) => { if (ms == null) return '–'; const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ':' + s.toFixed(2).padStart(5, '0'); };
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th');

  /* ============================== MENU ============================== */
  route('/kart', { auth: true, tabs: '' }, async () => {
    const b = await api.kartBoard({ span: 'week' }).catch(() => ({ rows: [], me: null }));
    return `${topbar('Buja Kart', '/home', `<a class="iconbtn" href="#/kart/board" aria-label="Leaderboard">${icon('star')}</a>`)}
    <main class="pad stack" style="gap:14px">
      <div class="kart-hero"><div class="kart-hero-sky"></div><div class="kart-hero-rock"></div><div class="kart-hero-dome"></div><div class="kart-hero-road"></div>
        <div class="kart-hero-text"><div class="kart-logo">BUJA <span>KART</span></div><div>Race round Eagle Square, the National Mosque, NNPC Towers and Aso Rock.</div></div></div>
      ${b.me ? `<div class="card row" style="padding:12px 14px;gap:10px"><span style="font-size:22px">🏁</span><div class="grow"><div style="font-weight:700">Your best lap this week: ${fmt(b.me.best)}</div><div class="small muted">${b.me.rank ? ord(b.me.rank) + ' in Abuja this week' : 'Set a time to get on the board'}</div></div><a class="btn btn-sm btn-outline" href="#/kart/board" style="width:auto">Board</a></div>` : ''}
      <button class="kart-btn kart-btn-go" data-go="/kart/play?mode=bots"><b>Race</b><span>You against three Abuja drivers</span></button>
      <button class="kart-btn" data-go="/kart/play?mode=solo"><b>Time trial</b><span>Beat your own ghost, lap after lap</span></button>
      <button class="kart-btn" data-go="/kart/play?mode=solo&ghost=best"><b>Chase the champion</b><span>Race the fastest lap in Abuja</span></button>
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Race your friends</div>
        <button class="btn btn-primary" id="newroom">${icon('flag-checkered')} Start a race room</button>
        <div class="row" style="gap:8px"><input class="input" id="code" maxlength="5" placeholder="Room code" autocapitalize="characters" style="flex:1;text-transform:uppercase;letter-spacing:3px;font-weight:700"><button class="btn btn-ink" id="joinroom" style="width:auto">Join</button></div>
        <div class="small muted">Invite friends by their Buja Tag. Chat while you race.</div></div>
      <div class="small muted" style="line-height:1.5">Controls: tap the left and right halves of the bottom bar to steer. The kart drives itself forward; hold 🔥 while turning to drift, and let go for a boost. On a keyboard: arrow keys and space.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
      el.querySelector('#newroom').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.kartNewRoom({ track: 'abuja' }); go('/kart/room/' + r.code); } catch (err) { busy(b, false); failed(el, err); } });
      el.querySelector('#joinroom').addEventListener('click', () => { const c = el.querySelector('#code').value.trim().toUpperCase(); if (c.length === 5) go('/kart/room/' + c); else toast('Room codes have 5 letters'); });
    }
  });

  /* ============================== LEADERBOARD ============================== */
  route('/kart/board', { auth: true, tabs: '' }, async () => {
    const span = new URLSearchParams(location.hash.split('?')[1] || '').get('span') || 'week';
    const b = await api.kartBoard({ span });
    return `${topbar('Leaderboard', '/kart')}<main class="pad stack" style="gap:12px">
      <div class="row" style="gap:8px"><a class="chip ${span === 'week' ? 'on' : ''}" href="#/kart/board?span=week">This week</a><a class="chip ${span === 'all' ? 'on' : ''}" href="#/kart/board?span=all">All time</a></div>
      <div class="small muted">${h(b.trackName)} · best lap per driver</div>
      ${b.rows.length ? `<div class="card list">${b.rows.map((r) => `<a class="item" href="#/@${h(r.tag || '')}" style="${r.me ? 'background:var(--orange-tint)' : ''}"><div style="width:30px;font-weight:900;font-size:16px;color:${r.rank <= 3 ? ['#D4A017', '#9AA0AB', '#B87333'][r.rank - 1] : 'var(--ink-3)'}">${r.rank}</div>${r.avatar ? `<img src="${h(r.avatar)}" alt="" style="width:34px;height:34px;border-radius:17px;object-fit:cover">` : avatar(r.name, 34)}<div class="grow"><div class="t">${h(r.name)}${r.me ? ' (you)' : ''}</div><div class="s">@${h(r.tag || '')}</div></div><div style="font:800 15px ui-monospace,Menlo,monospace">${fmt(r.lapMs)}</div></a>`).join('')}</div>` : `<div class="placeholder" style="padding:40px 0"><div class="h-md">No laps yet ${span === 'week' ? 'this week' : ''}</div><a class="btn btn-primary" href="#/kart/play?mode=solo" style="width:auto">Set the first time</a></div>`}
      ${b.me && !b.me.rank ? `<div class="small muted">Your best: ${fmt(b.me.best)}</div>` : ''}
    </main>`;
  });

  /* ============================== ROOM LOBBY ============================== */
  route('/kart/room/:code', { auth: true, tabs: '' }, async ({ code }) => `${topbar('Race room', '/kart')}<main class="pad stack" style="gap:12px" id="lobby"><div class="small muted">Joining room ${h(code)}…</div></main>`, {
    async mount(el, { code }) {
      let d; try { d = await api.kartJoin(code); } catch (err) { el.querySelector('#lobby').innerHTML = `<div class="placeholder" style="padding:50px 0"><div class="h-md">${h((err && err.message) || 'Could not join')}</div><a class="btn btn-primary" href="#/kart" style="width:auto">Back to Buja Kart</a></div>`; return; }
      let chatAfter = 0, alive = true; const chat = [];
      const draw = () => {
        const r = d.room;
        if (r.status === 'racing') { alive = false; go('/kart/play?mode=room&code=' + r.code); return; }
        d.chat.forEach((c) => { chat.push(c); chatAfter = Math.max(chatAfter, c.id); });
        el.querySelector('#lobby').innerHTML = `
          <div class="card row" style="padding:14px;gap:12px"><div class="grow"><div class="small muted">Room code</div><div style="font:900 28px ui-monospace,Menlo,monospace;letter-spacing:6px">${h(r.code)}</div></div><button class="btn btn-sm btn-outline" id="share" style="width:auto">${icon('paper-plane')} Share</button></div>
          <div class="card stack" style="padding:12px 14px;gap:8px"><div class="h-sm">Invite by Buja Tag</div>
            <div class="row" style="gap:8px"><input class="input" id="tag" placeholder="@friend" autocapitalize="off" autocomplete="off" style="flex:1"><button class="btn btn-ink" id="inv" style="width:auto">Invite</button></div><div id="tagsug" class="row" style="gap:6px;flex-wrap:wrap"></div></div>
          <div class="section">DRIVERS (${d.players.length}/6)</div>
          <div class="card list">${d.players.map((p) => `<div class="item"><span style="width:14px;height:14px;border-radius:7px;background:${p.colour};flex-shrink:0"></span>${p.avatar ? `<img src="${h(p.avatar)}" alt="" style="width:32px;height:32px;border-radius:16px;object-fit:cover">` : avatar(p.name, 32)}<div class="grow"><div class="t">${h(p.name)}${p.me ? ' (you)' : ''}</div><div class="s">@${h(p.tag || '')}</div></div>${p.ready ? '<span class="tag green">Ready</span>' : '<span class="tag">Waiting</span>'}</div>`).join('')}</div>
          <div class="row" style="gap:8px"><button class="btn btn-outline grow" id="ready">${d.players.find((p) => p.me)?.ready ? 'Not ready' : "I'm ready"}</button>${r.host ? `<button class="btn btn-primary grow" id="start" ${d.players.length < 2 ? 'disabled' : ''}>${icon('flag-checkered')} Start race</button>` : ''}</div>
          ${r.host && d.players.length < 2 ? '<div class="small muted">Invite at least one friend to start. You can also race the bots from the Buja Kart menu.</div>' : ''}
          <div class="section">CHAT</div>
          <div class="card stack" style="padding:10px 12px;gap:6px;max-height:220px;overflow-y:auto" id="chatlog">${chat.slice(-30).map((c) => `<div class="small"><b style="color:${c.me ? 'var(--orange-dark)' : 'var(--ink)'}">${h(c.name)}:</b> ${h(c.body)}</div>`).join('') || '<div class="small muted">Say hello.</div>'}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${(d.quick || []).map((q) => `<button class="chip" data-q="${h(q)}">${h(q)}</button>`).join('')}</div>
          <div class="row" style="gap:8px"><input class="input" id="msg" maxlength="140" placeholder="Message" style="flex:1"><button class="btn btn-ink" id="send" style="width:auto">Send</button></div>`;
        const log = el.querySelector('#chatlog'); log.scrollTop = log.scrollHeight;
        el.querySelector('#share').addEventListener('click', async () => { const t = `Race me on Buja Kart! Room ${r.code}: ${location.origin}/#/kart/room/${r.code}`; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast(t, 6000); } } });
        const inv = async () => { const t = el.querySelector('#tag').value.trim(); if (!t) return; try { const x = await api.kartInvite(r.code, t); toast('Invited ' + x.name); el.querySelector('#tag').value = ''; } catch (err) { failed(el, err); } };
        el.querySelector('#inv').addEventListener('click', inv);
        let sugT; el.querySelector('#tag').addEventListener('input', (e) => { clearTimeout(sugT); const q = e.target.value.replace('@', ''); sugT = setTimeout(async () => { if (q.length < 2) { el.querySelector('#tagsug').innerHTML = ''; return; } const { cards } = await api.tagSearch(q).catch(() => ({ cards: [] })); el.querySelector('#tagsug').innerHTML = cards.filter((c) => !c.self).map((c) => `<button class="chip" data-t="${h(c.tag)}">@${h(c.tag)} · ${h(c.person)}</button>`).join(''); el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { el.querySelector('#tag').value = '@' + b.dataset.t; inv(); })); }, 300); });
        el.querySelector('#ready').addEventListener('click', async () => { d = await api.kartSync(r.code, { ready: !d.players.find((p) => p.me)?.ready, chatAfter }); draw(); });
        el.querySelector('#start')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { d = await api.kartStart(r.code); draw(); } catch (err) { failed(el, err); } });
        const send = async (body) => { if (!body) return; try { await api.kartChat(r.code, body); el.querySelector('#msg').value = ''; tick(true); } catch (err) { failed(el, err); } };
        el.querySelector('#send').addEventListener('click', () => send(el.querySelector('#msg').value.trim()));
        el.querySelector('#msg').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(e.target.value.trim()); });
        el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
      };
      const tick = async (once) => {
        if (!alive || !document.body.contains(el)) return;
        const focus = document.activeElement && ['tag', 'msg'].includes(document.activeElement.id);
        try { const nd = await api.kartSync(d.room.code, { chatAfter }); if (!focus || nd.room.status === 'racing' || nd.chat.length) { const typed = { tag: el.querySelector('#tag')?.value, msg: el.querySelector('#msg')?.value }; d = nd; draw(); if (focus) { const i = el.querySelector('#' + document.activeElement?.id); } if (typed.tag) el.querySelector('#tag').value = typed.tag; if (typed.msg) el.querySelector('#msg').value = typed.msg; } } catch {}
        if (!once) setTimeout(() => tick(), 2000);
      };
      draw(); setTimeout(() => tick(), 2000);
    }
  });

  /* ============================== THE RACE ============================== */
  route('/kart/play', { auth: true, tabs: '' }, async () => `<div class="kart-stage" id="stage">
      <canvas id="kc"></canvas>
      <div class="kart-hud"><div class="kart-chip" id="lap">LAP 1/${LAPS}</div><div class="kart-chip" id="pos"></div><div class="kart-chip kart-time" id="time">0:00.00</div><canvas id="mini" width="112" height="112"></canvas></div>
      <div class="kart-land" id="land"></div>
      <div class="kart-count" id="count"></div>
      <div class="kart-bubbles" id="bubbles"></div>
      <button class="kart-quit" id="quit" aria-label="Leave the race">${icon('xmark')}</button>
      <button class="kart-chatbtn" id="chatbtn" aria-label="Chat" style="display:none">${icon('message')}</button>
      <div class="kart-speed"><b id="spd">0</b><span>km/h</span><i id="boostbar"></i></div>
      <div class="kart-pad"><button id="kl" aria-label="Steer left">◀</button><button id="kr" aria-label="Steer right">▶</button><div class="grow"></div><button id="kb" aria-label="Brake">■</button><button id="kd" class="kart-drift" aria-label="Drift and boost">🔥</button></div>
      <div class="kart-chatbox" id="chatbox"></div>
      <div class="kart-result" id="result"></div>
    </div>`, {
    async mount(el) {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      const mode = q.get('mode') || 'bots', code = q.get('code');
      document.body.classList.add('kart-on');
      const game = new Race(el, { mode, code, ghostWho: q.get('ghost') === 'best' ? 'best' : 'me', api, me: state.user, go, toast, h, fmt, ord });
      try { await game.start(); } catch (e) { console.error(e); el.querySelector('#count').innerHTML = `<div style="font-size:18px;max-width:280px;text-align:center">This phone could not start 3D graphics. ${h(e.message || '')}</div>`; }
      const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); game.stop(); document.body.classList.remove('kart-on'); } });
      obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }
  });
}

/* ================================================================================================ */
/*                                          THE ENGINE                                              */
/* ================================================================================================ */
class Race {
  constructor(el, o) {
    Object.assign(this, o); this.el = el; this.running = false; this.input = { l: 0, r: 0, brake: 0, drift: 0 };
    this.remotes = {}; this.chatAfter = 0; this.lastSync = 0; this.recording = []; this.bestLap = null; this.lapTimes = [];
  }

  /* ------------------------------ setup ------------------------------ */
  async start() {
    const canvas = this.el.querySelector('#kc');
    const low = (navigator.hardwareConcurrency || 4) <= 4 || Math.min(screen.width, screen.height) < 400;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9FD1F5');
    this.scene.fog = new THREE.Fog('#BFE0F7', 260, 900);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2000);
    this.scene.add(new THREE.HemisphereLight('#DDEFFF', '#6B8E4E', 1.1));
    const sun = new THREE.DirectionalLight('#FFF1D6', 1.6); sun.position.set(-200, 300, 120); this.scene.add(sun);
    this.buildTrack(); this.buildWorld(); this.buildLandmarks();
    this.player = this.makeKart(this.me && this.me.id ? '#FF7A1A' : '#FF7A1A', true);
    this.resize(); this._onResize = () => this.resize(); window.addEventListener('resize', this._onResize);
    this.bindControls();
    this.placeOnGrid(this.player, 0);
    this.minimap();

    if (this.mode === 'bots') this.bots = [['Musa', '#1F5FBF', 0.95], ['Ngozi', '#2E7D1E', 0.985], ['Tunde', '#7A3E96', 1.0]].map(([n, c, skill], i) => { const k = this.makeKart(c); k.name = n; k.skill = skill; k.lane = (i - 1) * 4; this.placeOnGrid(k, i + 1); k.v = 0; k.s = k.startS; k.lap = 1; return k; });
    else this.bots = [];
    if (this.mode === 'solo') { try { const g = (await this.api.kartGhost({ who: this.ghostWho })).ghost; if (g && g.path && g.path.length > 10) { this.ghost = { ...g, kart: this.makeKart('#FFFFFF', false, true) }; this.toast('Racing ' + g.name + ': ' + this.fmt(g.lapMs)); } } catch {} }
    if (this.mode === 'room') { this.el.querySelector('#chatbtn').style.display = ''; this.bindChat(); await this.syncRoom(true); }

    window.__bujaKart = this; // lets tests and support look inside a race
    this.clock = new THREE.Clock(); this.running = true;
    this.phase = 'count'; this.countFrom = this.mode === 'room' && this.room && this.room.startAt ? null : performance.now() + 3200;
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  stop() { this.running = false; window.removeEventListener('resize', this._onResize); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); try { this.renderer.dispose(); } catch {} }
  resize() { const w = this.el.clientWidth || innerWidth, hgt = this.el.clientHeight || innerHeight; this.renderer.setSize(w, hgt, false); this.camera.aspect = w / hgt; this.camera.updateProjectionMatrix(); }

  /* ------------------------------ the circuit ------------------------------ */
  buildTrack() {
    const pts = LAYOUT.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.samples = this.curve.getSpacedPoints(SAMPLES); this.samples.pop();
    this.tangents = this.samples.map((_, i) => this.samples[(i + 1) % SAMPLES].clone().sub(this.samples[(i - 1 + SAMPLES) % SAMPLES]).normalize());
    this.length = this.curve.getLength();
    const strip = (half, y, colourFn, uvScale) => {
      const pos = [], col = [], uv = [], idx = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const p = this.samples[i % SAMPLES], t = this.tangents[i % SAMPLES], n = new THREE.Vector3(-t.z, 0, t.x);
        const a = p.clone().addScaledVector(n, half[0]), b = p.clone().addScaledVector(n, half[1]);
        pos.push(a.x, y, a.z, b.x, y, b.z); const c = colourFn(i); col.push(...c, ...c); uv.push(0, i * uvScale, 1, i * uvScale);
        if (i < SAMPLES) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } // counter-clockwise from above, so the faces point up
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const asphalt = new THREE.Mesh(strip([-ROAD_W / 2, ROAD_W / 2], 0.02, () => [0.23, 0.24, 0.27], 0.5), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.scene.add(asphalt);
    // centre line and kerbs as vertex-coloured strips: no textures, one draw call each
    // Centre line: separate quads, so each dash is crisp instead of blending into the gap beside it.
    const dp = [], di = [];
    for (let i = 0; i < SAMPLES; i += 6) {
      const a = this.samples[i], b = this.samples[(i + 3) % SAMPLES], t = this.tangents[i], n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(0.28), v = dp.length / 3;
      dp.push(a.x - n.x, 0.05, a.z - n.z, a.x + n.x, 0.05, a.z + n.z, b.x - n.x, 0.05, b.z - n.z, b.x + n.x, 0.05, b.z + n.z); di.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setIndex(di);
    const dash = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: '#EDEDE6' }));
    const kerbC = (i) => (Math.floor(i / 2) % 2 ? [0.85, 0.12, 0.13] : [0.96, 0.96, 0.96]);
    this.scene.add(dash, new THREE.Mesh(strip([ROAD_W / 2, ROAD_W / 2 + 1.4], 0.06, kerbC, 1), new THREE.MeshLambertMaterial({ vertexColors: true })), new THREE.Mesh(strip([-ROAD_W / 2 - 1.4, -ROAD_W / 2], 0.06, kerbC, 1), new THREE.MeshLambertMaterial({ vertexColors: true })));
    // start/finish chequers
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 16; const cx = cv.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cx.fillRect(i * 4, j * 4, 4, 4); }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 3), new THREE.MeshBasicMaterial({ map: tex })); fin.rotation.x = -Math.PI / 2;
    fin.position.copy(this.samples[0]).setY(0.07); fin.rotation.z = -Math.atan2(this.tangents[0].x, this.tangents[0].z) + Math.PI / 2; fin.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    this.scene.add(fin);
    // gantry over the start
    const gm = new THREE.MeshLambertMaterial({ color: '#101014' }); const g1 = new THREE.Group();
    [-ROAD_W / 2 - 2, ROAD_W / 2 + 2].forEach((x) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), gm); post.position.set(x, 4.5, 0); g1.add(post); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 5, 1.6, 0.9), new THREE.MeshLambertMaterial({ color: '#FF7A1A' })); beam.position.set(0, 9, 0); g1.add(beam);
    this.placeAlong(g1, 0, 0); this.scene.add(g1);
    // boost pads: glowing arrows
    const padM = new THREE.MeshBasicMaterial({ color: '#7ED957', transparent: true, opacity: 0.9 });
    this.pads = BOOSTS.map((t) => { const s = Math.floor(t * SAMPLES); const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 7), padM); m.rotation.x = -Math.PI / 2; m.position.copy(this.samples[s]).setY(0.08); m.rotation.z = -Math.atan2(this.tangents[s].x, this.tangents[s].z); this.scene.add(m); return s; });
  }
  placeAlong(obj, s, offset, face = true) { const i = ((Math.round(s) % SAMPLES) + SAMPLES) % SAMPLES; const p = this.samples[i], t = this.tangents[i]; obj.position.set(p.x - t.z * offset, 0, p.z + t.x * offset); if (face) obj.rotation.y = Math.atan2(t.x, t.z); }
  nearest(x, z, hint = null) {
    // local search around the last index keeps this cheap; a full scan only when lost
    let best = -1, bd = Infinity; const scan = (from, to) => { for (let k = from; k <= to; k++) { const i = ((k % SAMPLES) + SAMPLES) % SAMPLES; const p = this.samples[i]; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } };
    if (hint != null) scan(hint - 40, hint + 40); if (hint == null || bd > 900) scan(0, SAMPLES - 1);
    const t = this.tangents[best], p = this.samples[best];
    return { i: best, lateral: (x - p.x) * -t.z + (z - p.z) * t.x, dist: Math.sqrt(bd) };
  }

  /* ------------------------------ the city ------------------------------ */
  buildWorld() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), new THREE.MeshLambertMaterial({ color: '#7FA65A' })); ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    // Abuja's red earth verges along the road
    const verge = new THREE.Mesh(new THREE.RingGeometry(0, 1, 3), new THREE.MeshBasicMaterial({ color: '#B5653D' })); verge.visible = false; this.scene.add(verge);
    // Buildings and trees: InstancedMesh, one draw call each however many there are.
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const bMat = new THREE.MeshLambertMaterial({ vertexColors: false });
    const N = 150, bm = new THREE.InstancedMesh(box, bMat, N), m4 = new THREE.Matrix4(), col = new THREE.Color();
    const palette = ['#E8E1D3', '#D9CBB2', '#C9D6DF', '#EDE7DA', '#BFC9CF', '#D7C4A3', '#E4D6C2'];
    let n = 0;
    for (let s = 0; s < SAMPLES && n < N; s += 13) {
      if (LANDMARKS.some((l) => Math.abs(l.at * SAMPLES - s) < 40)) continue;
      for (const side of [-1, 1]) { if (n >= N) break;
        const off = side * (ROAD_W / 2 + 22 + Math.random() * 30); const w = 12 + Math.random() * 16, d = 12 + Math.random() * 16, hgt = 8 + Math.random() * (s % 5 === 0 ? 55 : 22);
        const p = this.samples[s], t = this.tangents[s]; m4.compose(new THREE.Vector3(p.x - t.z * off, 0, p.z + t.x * off), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t.x, t.z)), new THREE.Vector3(w, hgt, d));
        bm.setMatrixAt(n, m4); bm.setColorAt(n, col.set(palette[n % palette.length])); n++; }
    }
    bm.count = n; this.scene.add(bm);
    const trunk = new THREE.CylinderGeometry(0.3, 0.4, 2.4, 5); trunk.translate(0, 1.2, 0);
    const crown = new THREE.ConeGeometry(2.6, 6, 6); crown.translate(0, 5.5, 0);
    const T = 240, tm = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: '#6B4A2E' }), T), cm = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ color: '#3F7A3A' }), T);
    let k = 0;
    for (let s = 0; s < SAMPLES && k < T; s += 4) { const side = (s / 4) % 2 ? 1 : -1; const off = side * (ROAD_W / 2 + 6 + Math.random() * 6); const p = this.samples[s], t = this.tangents[s]; const sc = 0.8 + Math.random() * 0.6; m4.compose(new THREE.Vector3(p.x - t.z * off, 0, p.z + t.x * off), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc)); tm.setMatrixAt(k, m4); cm.setMatrixAt(k, m4); cm.setColorAt(k, col.set(k % 3 ? '#3F7A3A' : '#4E8E3F')); k++; }
    tm.count = cm.count = k; this.scene.add(tm, cm);
    // Zuma Rock on the western horizon: the 1,000-ton monolith every Abuja arrival passes
    const zg = new THREE.SphereGeometry(1, 20, 14); const zp = zg.attributes.position;
    for (let i = 0; i < zp.count; i++) { const y = zp.getY(i); zp.setY(i, y < 0 ? y * 0.1 : y * 1.25); zp.setX(i, zp.getX(i) * (1 + 0.07 * Math.sin(i * 1.7))); }
    zg.computeVertexNormals();
    const zuma = new THREE.Mesh(zg, new THREE.MeshLambertMaterial({ color: '#8A7968' })); zuma.scale.set(170, 150, 140); zuma.position.set(-900, 0, -250); this.scene.add(zuma);
    this.addLabel('Zuma Rock', -900, 210, -250, 1.4);
  }

  /* ------------------------------ Abuja's landmarks, low-poly ------------------------------ */
  buildLandmarks() {
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    const make = {
      eagle: () => { const g = new THREE.Group(); const plaza = new THREE.Mesh(new THREE.BoxGeometry(70, 0.6, 46), L('#E9E4DA')); plaza.position.y = 0.3; g.add(plaza);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(56, 8, 8), L('#F2F2F2')); stand.position.set(0, 4, -20); g.add(stand);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 11), L('#2E7D1E')); roof.position.set(0, 9, -20); g.add(roof);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 22, 6), L('#DDD')); pole.position.set(0, 11, 8); g.add(pole);
        const flag = new THREE.Group(); [['#008751', 0], ['#FFFFFF', 3], ['#008751', 6]].forEach(([c, x]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.1), L(c)); f.position.set(1.5 + x, 19.5, 8); flag.add(f); }); g.add(flag); this.flag = flag;
        const eagle = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 4), L('#C9A23A')); eagle.position.set(-22, 6, 10); g.add(eagle); return g; },
      nnpc: () => { const g = new THREE.Group(); const glass = L('#5C8FB8'), frame = L('#E6EDF2');
        [[-12, -8], [12, -8], [-12, 12], [12, 12]].forEach(([x, z], i) => { const hgt = 70 + (i % 2) * 8; const t = new THREE.Mesh(new THREE.BoxGeometry(14, hgt, 14), glass); t.position.set(x, hgt / 2, z); g.add(t);
          for (let y = 8; y < hgt; y += 8) { const band = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.8, 14.4), frame); band.position.set(x, y, z); g.add(band); } });
        const base = new THREE.Mesh(new THREE.BoxGeometry(44, 10, 36), frame); base.position.y = 5; g.add(base); return g; },
      christian: () => { const g = new THREE.Group(); const wall = L('#F1ECE2');
        const nave = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 50), wall); nave.position.y = 9; g.add(nave);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(24, 18, 4), L('#8C2F2F')); roof.rotation.y = Math.PI / 4; roof.scale.set(0.9, 1, 1.5); roof.position.y = 27; g.add(roof);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(4, 40, 8), wall); spire.position.set(0, 40, 24); g.add(spire);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), L('#D4A017')); cross.position.set(0, 63, 24); g.add(cross); const arm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 0.8), L('#D4A017')); arm.position.set(0, 64, 24); g.add(arm); return g; },
      assembly: () => { const g = new THREE.Group(); const white = L('#F4F1EA');
        const body = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 18, 12), white); body.position.y = 9; g.add(body);
        for (let a = 0; a < 12; a++) { const c = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 2), L('#D8D2C4')); c.position.set(Math.cos(a / 12 * Math.PI * 2) * 38.5, 9, Math.sin(a / 12 * Math.PI * 2) * 38.5); g.add(c); }
        const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), L('#2E8B57')); dome.position.y = 18; g.add(dome);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 7, 8), L('#D4A017')); tip.position.y = 41; g.add(tip); return g; },
      aso: () => { const geo = new THREE.IcosahedronGeometry(1, 2); const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y < 0 ? y * 0.15 : y * 0.9); const n = 1 + 0.12 * Math.sin(p.getX(i) * 7) * Math.cos(p.getZ(i) * 5); p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n); }
        geo.computeVertexNormals(); const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#7D6A58', flatShading: true })); m.scale.set(210, 170, 150); const g = new THREE.Group(); g.add(m); return g; },
      millennium: () => { const g = new THREE.Group(); const water = new THREE.Mesh(new THREE.CircleGeometry(26, 24), new THREE.MeshLambertMaterial({ color: '#3C8DBC' })); water.rotation.x = -Math.PI / 2; water.position.y = 0.2; g.add(water);
        const fount = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3, 6, 10), L('#EEE')); fount.position.y = 3; g.add(fount);
        for (let a = 0; a < 10; a++) { const tr = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), L(a % 2 ? '#3E7F3A' : '#57A04A')); tr.position.set(Math.cos(a) * 36, 6, Math.sin(a) * 36); g.add(tr); } return g; },
      mosque: () => { const g = new THREE.Group(); const white = L('#F6F3EC'), gold = new THREE.MeshLambertMaterial({ color: '#D9A62E', emissive: '#3A2A05' });
        const hall = new THREE.Mesh(new THREE.BoxGeometry(44, 16, 44), white); hall.position.y = 8; g.add(hall);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6, 20), white); drum.position.y = 19; g.add(drum);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.y = 22; dome.scale.y = 1.25; g.add(dome);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(1, 6, 6), gold); fin.position.y = 43; g.add(fin);
        [[-26, -26], [26, -26], [-26, 26], [26, 26]].forEach(([x, z]) => { const mnr = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 52, 8), white); mnr.position.set(x, 26, z); g.add(mnr); const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 8), gold); cap.position.set(x, 55, z); g.add(cap); const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 8), white); ring.position.set(x, 44, z); g.add(ring); });
        return g; },
      gate: () => { const g = new THREE.Group(); const stone = L('#E6DCC8'), green = L('#008751');
        [-ROAD_W / 2 - 3, ROAD_W / 2 + 3].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(4, 16, 4), stone); p.position.set(x, 8, 0); g.add(p); const cap = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), green); cap.position.set(x, 17, 0); g.add(cap); });
        const top = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 12, 3, 4), stone); top.position.y = 17.5; g.add(top);
        const band = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 12.2, 1, 4.2), green); band.position.y = 16; g.add(band); return g; },
    };
    this.landmarkAt = [];
    for (const l of LANDMARKS) {
      const g = make[l.id](); const s = Math.floor(l.at * SAMPLES);
      this.placeAlong(g, s, l.side * l.dist, l.id === 'gate'); if (l.id !== 'gate') g.rotation.y = Math.atan2(this.tangents[s].x, this.tangents[s].z) + (l.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.scene.add(g); this.landmarkAt.push({ s, name: l.name });
      const top = l.id === 'aso' ? 190 : l.id === 'nnpc' ? 92 : l.id === 'christian' ? 72 : 62;
      if (l.id !== 'gate') this.addLabel(l.name, g.position.x, top, g.position.z, l.id === 'aso' ? 1.3 : 1);
    }
  }
  addLabel(text, x, y, z, scale = 1) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = 'rgba(16,16,20,.78)'; const w = Math.min(500, 40 + text.length * 26); g.beginPath(); g.roundRect((512 - w) / 2, 14, w, 68, 34); g.fill();
    g.fillStyle = '#fff'; g.font = '700 38px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 49);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false })); s.scale.set(48 * scale, 9 * scale, 1); s.position.set(x, y, z); this.scene.add(s);
  }

  /* ------------------------------ karts ------------------------------ */
  makeKart(colour, isPlayer = false, ghost = false) {
    const g = new THREE.Group();
    const paint = ghost ? new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35, depthWrite: false }) : new THREE.MeshLambertMaterial({ color: colour });
    const dark = ghost ? paint : new THREE.MeshLambertMaterial({ color: '#1B1B1F' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 3), paint); body.position.y = 0.55; g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.9), paint); nose.position.set(0, 0.55, 1.8); g.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.5), dark); wing.position.set(0, 1.05, -1.45); g.add(wing);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), dark); seat.position.set(0, 0.95, -0.4); g.add(seat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), ghost ? paint : new THREE.MeshLambertMaterial({ color: '#FFFFFF' })); head.position.set(0, 1.55, -0.25); g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.2), dark); visor.position.set(0, 1.57, 0.08); g.add(visor);
    const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.42, 12); wheelG.rotateZ(Math.PI / 2);
    g.wheels = [[-0.95, 1.05], [0.95, 1.05], [-0.95, -1.05], [0.95, -1.05]].map(([x, z]) => { const w = new THREE.Mesh(wheelG, dark); w.position.set(x, 0.42, z); g.add(w); return w; });
    if (!ghost) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.8), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; g.add(sh); }
    if (isPlayer) { g.flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8), new THREE.MeshBasicMaterial({ color: '#FFB020' })); g.flame.rotation.x = -Math.PI / 2; g.flame.position.set(0, 0.6, -2.2); g.flame.visible = false; g.add(g.flame); }
    g.v = 0; g.h = 0; g.lap = 1; g.s = 0; g.boost = 0; g.drift = 0; g.idx = 0;
    this.scene.add(g); return g;
  }
  placeOnGrid(k, slot) {
    const row = Math.floor(slot / 2), col = slot % 2 ? 1 : -1;
    const s = (SAMPLES - 8 - row * 7 + SAMPLES) % SAMPLES; this.placeAlong(k, s, col * 3.6);
    k.h = Math.atan2(this.tangents[s].x, this.tangents[s].z); k.rotation.y = k.h; k.idx = s; k.startS = s; k.passedHalf = false;
  }

  /* ------------------------------ controls ------------------------------ */
  bindControls() {
    const hold = (id, key) => { const b = this.el.querySelector('#' + id); const on = (e) => { e.preventDefault(); this.input[key] = 1; b.classList.add('on'); }; const off = (e) => { e && e.preventDefault(); this.input[key] = 0; b.classList.remove('on'); };
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off); };
    hold('kl', 'l'); hold('kr', 'r'); hold('kb', 'brake'); hold('kd', 'drift');
    const map = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowDown: 'brake', s: 'brake', S: 'brake', ' ': 'drift', Shift: 'drift' };
    this._kd = (e) => { if (map[e.key]) { this.input[map[e.key]] = 1; e.preventDefault(); } }; this._ku = (e) => { if (map[e.key]) this.input[map[e.key]] = 0; };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    this.el.querySelector('#quit').addEventListener('click', () => { if (this.phase === 'race' && !confirm('Leave this race?')) return; this.go(this.mode === 'room' ? '/kart/room/' + this.code : '/kart'); });
  }

  /* ------------------------------ physics ------------------------------ */
  drive(k, dt, steer, brake, drift, isAI = false) {
    const on = this.nearest(k.position.x, k.position.z, k.idx); k.idx = on.i;
    const off = Math.abs(on.lateral) > ROAD_W / 2 + 1.2;
    let top = off ? OFF_V : MAX_V * (isAI ? k.skill : 1); if (k.boost > 0) { top = BOOST_V; k.boost -= dt; }
    const accel = brake ? -28 : (k.v < top ? 13 : -9);
    k.v = Math.max(0, Math.min(k.boost > 0 ? BOOST_V : top + 2, k.v + accel * dt));
    const grip = drift && Math.abs(steer) > 0 ? 1.55 : 1;
    const turn = steer * grip * (0.9 + 0.8 * Math.min(1, k.v / 18)) * dt * (k.v > 1 ? 1 : k.v);
    k.h += turn * 1.05;
    if (!isAI) { if (drift && Math.abs(steer) > 0 && k.v > 14) k.drift = Math.min(2.2, k.drift + dt); else if (k.drift > 0.55) { k.boost = Math.min(1.6, k.drift * 0.7); k.drift = 0; this.buzz(20); } else k.drift = 0; }
    k.position.x += Math.sin(k.h) * k.v * dt; k.position.z += Math.cos(k.h) * k.v * dt;
    // walls: slide along instead of stopping dead
    if (Math.abs(on.lateral) > ROAD_W / 2 + 9) { const t = this.tangents[on.i], back = Math.sign(on.lateral) * (Math.abs(on.lateral) - (ROAD_W / 2 + 9)); k.position.x += t.z * back; k.position.z -= t.x * back; k.v *= 0.9; }
    if (this.pads.some((p) => Math.abs(p - on.i) < 4) && Math.abs(on.lateral) < 3) k.boost = Math.max(k.boost, 1.1);
    k.rotation.y = k.h + (drift && Math.abs(steer) > 0 ? steer * 0.35 : 0);
    k.wheels.forEach((w) => { w.rotation.x += k.v * dt / 0.42; });
    // laps: must pass the far side before the line counts
    const prog = on.i / SAMPLES; if (prog > 0.45 && prog < 0.55) k.passedHalf = true;
    if (k.lastProg != null && k.lastProg > 0.9 && prog < 0.1 && k.passedHalf) { k.passedHalf = false; k.lapEvent = true; }
    k.lastProg = prog; k.s = (k.lap - 1) + prog; return on;
  }
  aiDrive(k, dt) {
    const look = (k.idx + 14 + Math.floor(k.v / 3)) % SAMPLES, p = this.samples[look], t = this.tangents[look];
    const tx = p.x - t.z * k.lane, tz = p.z + t.x * k.lane;
    const want = Math.atan2(tx - k.position.x, tz - k.position.z); let diff = want - k.h; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    const lead = k.s - this.player.s; k.skill = Math.max(0.86, Math.min(1.04, k.baseSkill ?? (k.baseSkill = k.skill)) - (lead > 0.25 ? 0.05 : lead < -0.25 ? -0.04 : 0)); // gentle rubber band
    this.drive(k, dt, Math.max(-1, Math.min(1, diff * 2.2)), false, false, true);
    if (k.lapEvent) { k.lapEvent = false; k.lap++; if (k.lap > LAPS && !k.finished) { k.finished = performance.now() - this.t0; } }
  }

  /* ------------------------------ the loop ------------------------------ */
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const count = this.el.querySelector('#count');
    if (this.phase === 'count') {
      const startAt = this.countFrom ?? (this.room && this.room.startAt ? performance.now() + (this.room.startAt - (Date.now() + (this.skew || 0))) : null);
      if (startAt != null) { this.countFrom = startAt; const left = Math.ceil((startAt - performance.now()) / 1000);
        count.innerHTML = left > 3 ? '' : left > 0 ? `<b class="pop">${left}</b>` : '<b class="pop go">GO!</b>';
        if (left <= 0) { this.phase = 'race'; this.t0 = startAt; this.lapStart = startAt; this.buzz(40); setTimeout(() => { count.innerHTML = ''; }, 700); } }
      else count.innerHTML = '<b style="font-size:22px">Waiting for the host…</b>';
    }
    if (this.phase === 'race' || this.phase === 'done') {
      const steer = (this.input.l ? 1 : 0) - (this.input.r ? 1 : 0);
      if (this.phase === 'race') {
        const on = this.drive(this.player, dt, steer, this.input.brake, this.input.drift);
        this.recording.push([Math.round(this.player.position.x * 10) / 10, Math.round(this.player.position.z * 10) / 10, Math.round(this.player.h * 100) / 100]);
        if (this.player.lapEvent) this.completeLap(now);
        this.nearLandmark(on.i);
      } else { this.player.v *= 0.97; this.drive(this.player, dt, 0, true, false); }
      this.bots.forEach((b) => this.aiDrive(b, dt));
      this.separate();
      if (this.ghost && this.phase === 'race') this.playGhost(now);
      if (this.mode === 'room') { this.moveRemotes(now); if (now - this.lastSync > 200) { this.lastSync = now; this.syncRoom(); } }
      this.hud(now);
    }
    this.flagWave(now);
    this.chase(dt);
    this.renderer.render(this.scene, this.camera);
    if (!this._mini || now - this._mini > 120) { this._mini = now; this.drawMini(); }
    requestAnimationFrame(this.loop);
  }
  chase(dt) {
    const k = this.player, back = 9.5 + k.v * 0.07, up = 4.6 + k.v * 0.03;
    const want = new THREE.Vector3(k.position.x - Math.sin(k.h) * back, up, k.position.z - Math.cos(k.h) * back);
    this.camera.position.lerp(want, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(k.position.x + Math.sin(k.h) * 12, 1.2, k.position.z + Math.cos(k.h) * 12);
    const fov = 62 + Math.min(14, k.v * 0.3) + (k.boost > 0 ? 6 : 0); if (Math.abs(fov - this.camera.fov) > 0.3) { this.camera.fov += (fov - this.camera.fov) * 0.1; this.camera.updateProjectionMatrix(); }
    if (k.flame) { k.flame.visible = k.boost > 0 || k.drift > 0.55; k.flame.material.color.set(k.boost > 0 ? '#FFB020' : '#40B4FF'); k.flame.scale.z = 0.8 + Math.random() * 0.5; }
  }
  separate() {
    const all = [this.player, ...this.bots];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j]; const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, d = Math.hypot(dx, dz); if (d > 0 && d < 2.6) { const push = (2.6 - d) / 2; a.position.x -= dx / d * push; a.position.z -= dz / d * push; b.position.x += dx / d * push; b.position.z += dz / d * push; a.v *= 0.985; b.v *= 0.985; } }
  }
  flagWave(now) { if (this.flag) this.flag.children.forEach((f, i) => { f.rotation.y = Math.sin(now / 300 + i) * 0.25; }); }

  completeLap(now) {
    const k = this.player; k.lapEvent = false;
    const lapMs = Math.round(now - this.lapStart); this.lapStart = now; this.lapTimes.push(lapMs);
    const pb = this.bestLap == null || lapMs < this.bestLap;
    if (pb) { this.bestLap = lapMs; this.bestPath = this.recording.filter((_, i) => i % 6 === 0); }
    this.recording = [];
    k.lap++;
    this.flash(k.lap > LAPS ? 'FINISH!' : `LAP ${k.lap}/${LAPS}${pb && this.lapTimes.length > 1 ? ' · best lap!' : ''}`);
    if (k.lap > LAPS) this.finish(now);
  }
  async finish(now) {
    this.phase = 'done'; const raceMs = Math.round(now - this.t0);
    const place = this.placing(); this.buzz(80);
    let saved = null;
    try { saved = await this.api.kartSaveTime({ track: 'abuja', lapMs: this.bestLap, raceMs, mode: this.mode, ghost: this.bestPath }); } catch {}
    if (this.mode === 'room') { try { await this.api.kartFinish(this.code, raceMs); } catch {} }
    const r = this.el.querySelector('#result');
    r.innerHTML = `<div class="kart-card"><div class="kart-place">${this.mode === 'solo' ? '🏁' : place === 1 ? '🏆' : '🏁'}</div>
      <div class="kart-big">${this.mode === 'solo' ? 'Race complete' : this.ord(place) + ' place'}</div>
      <div class="kart-row"><span>Race</span><b>${this.fmt(raceMs)}</b></div><div class="kart-row"><span>Best lap</span><b>${this.fmt(this.bestLap)}</b></div>
      ${saved ? `<div class="kart-row"><span>Abuja ranking, all time</span><b>${this.ord(saved.rank)}</b></div>${saved.personalBest ? '<div class="kart-pb">New personal best!</div>' : `<div class="kart-sub">Your best: ${this.fmt(saved.previousBest)}</div>`}` : ''}
      <div class="kart-actions"><button class="btn btn-primary" id="again">${this.mode === 'room' ? 'Back to the room' : 'Race again'}</button><a class="btn btn-outline" href="#/kart/board">Leaderboard</a><a class="btn btn-ghost" href="#/kart">Menu</a></div></div>`;
    r.classList.add('on');
    r.querySelector('#again').addEventListener('click', () => { if (this.mode === 'room') this.go('/kart/room/' + this.code); else location.reload(); });
  }
  placing() {
    const me = this.player.s + (this.phase === 'done' ? 10 : 0);
    const others = [...this.bots.map((b) => b.finished ? 10 + (1e7 - b.finished) / 1e8 : b.s), ...Object.values(this.remotes).map((r) => r.finish ? 10 + (1e7 - r.finish) / 1e8 : r.s || 0)];
    if (this.phase === 'done') return 1 + others.filter((o) => o >= 10).length; // those who finished before me
    return 1 + others.filter((o) => o > me).length;
  }
  hud(now) {
    const k = this.player; const lap = Math.min(k.lap, LAPS);
    this.el.querySelector('#lap').textContent = `LAP ${lap}/${LAPS}`;
    this.el.querySelector('#time').textContent = this.fmt(Math.max(0, Math.round(now - (this.t0 || now))));
    const racers = this.bots.length + Object.keys(this.remotes).length;
    this.el.querySelector('#pos').textContent = racers ? `${this.ord(this.placing())} / ${racers + 1}` : (this.bestLap ? 'BEST ' + this.fmt(this.bestLap) : 'TIME TRIAL');
    this.el.querySelector('#spd').textContent = Math.round(k.v * 3.6);
    this.el.querySelector('#boostbar').style.width = Math.min(100, (k.boost > 0 ? 100 : k.drift / 2.2 * 100)) + '%';
  }
  flash(t) { const c = this.el.querySelector('#count'); c.innerHTML = `<b class="pop" style="font-size:40px">${this.h(t)}</b>`; clearTimeout(this._fl); this._fl = setTimeout(() => { if (this.phase !== 'count') c.innerHTML = ''; }, 1400); }
  nearLandmark(i) { const l = this.landmarkAt.find((x) => Math.abs(x.s - i) < 30 || Math.abs(x.s - i) > SAMPLES - 30); const box = this.el.querySelector('#land'); const name = l ? l.name : ''; if (name !== this._land) { this._land = name; box.textContent = name; box.classList.toggle('on', !!name); } }
  buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

  /* ------------------------------ ghost ------------------------------ */
  playGhost(now) {
    const g = this.ghost, path = g.path, per = g.lapMs / path.length;
    const t = (now - this.lapStart) / per; const i = Math.floor(t) % path.length, j = (i + 1) % path.length, f = t - Math.floor(t);
    const a = path[i], b = path[j]; if (!a || !b) return;
    g.kart.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f); g.kart.rotation.y = a[2] + (b[2] - a[2]) * f;
  }

  /* ------------------------------ mini-map ------------------------------ */
  minimap() {
    const c = this.el.querySelector('#mini'); this.mini = c.getContext('2d');
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity; this.samples.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
    const sc = 96 / Math.max(maxX - minX, maxZ - minZ); this.mm = (x, z) => [8 + (x - minX) * sc, 8 + (z - minZ) * sc];
  }
  drawMini() {
    const g = this.mini; g.clearRect(0, 0, 112, 112); g.fillStyle = 'rgba(16,16,20,.55)'; g.beginPath(); g.roundRect(0, 0, 112, 112, 14); g.fill();
    g.strokeStyle = '#E8E8EC'; g.lineWidth = 4; g.beginPath(); this.samples.forEach((p, i) => { const [x, y] = this.mm(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke();
    const dot = (k, c, r = 3.5) => { const [x, y] = this.mm(k.position.x, k.position.z); g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    this.bots.forEach((b) => dot(b, b.children[0].material.color.getStyle()));
    Object.values(this.remotes).forEach((r) => r.kart && dot(r.kart, r.colour));
    if (this.ghost) dot(this.ghost.kart, 'rgba(255,255,255,.7)');
    dot(this.player, '#FF7A1A', 5);
  }

  /* ------------------------------ friends (rooms) ------------------------------ */
  async syncRoom(first = false) {
    if (this._syncing) return; this._syncing = true;
    try {
      const k = this.player; const body = { chatAfter: this.chatAfter };
      if (this.phase === 'race') body.state = [k.position.x.toFixed(1), k.position.z.toFixed(1), k.h.toFixed(2), k.v.toFixed(1), k.lap, (k.idx / SAMPLES).toFixed(3)].join(',');
      const d = await this.api.kartSync(this.code, body);
      this.room = d.room; this.skew = d.room.now - Date.now();
      if (first && d.room.status !== 'racing') { this.go('/kart/room/' + this.code); return; }
      const seen = new Set();
      d.players.forEach((p) => {
        if (p.me) { const i = d.players.indexOf(p); if (first) this.placeOnGrid(this.player, i); this.player.children[0].material.color.set(p.colour); return; }
        seen.add(p.id); let r = this.remotes[p.id];
        if (!r) { r = this.remotes[p.id] = { kart: this.makeKart(p.colour), colour: p.colour, name: p.name }; this.placeOnGrid(r.kart, d.players.indexOf(p)); this.addTag(r); }
        r.finish = p.finishMs;
        if (p.state) { r.prev = r.next || { x: p.state[0], z: p.state[1], h: p.state[2], t: performance.now() - 200 }; r.next = { x: p.state[0], z: p.state[1], h: p.state[2], t: performance.now() }; r.s = (p.state[4] - 1) + p.state[5]; }
      });
      Object.keys(this.remotes).forEach((id) => { if (!seen.has(+id)) { this.scene.remove(this.remotes[id].kart); delete this.remotes[id]; } });
      d.chat.forEach((c) => { this.chatAfter = Math.max(this.chatAfter, c.id); if (!first) this.bubble(c); });
      if (first) this.quick = d.quick || [];
    } catch {} finally { this._syncing = false; }
  }
  moveRemotes(now) {
    Object.values(this.remotes).forEach((r) => { if (!r.next) return; const a = r.prev || r.next, b = r.next; const span = Math.max(80, b.t - a.t); const f = Math.min(1.5, (now - b.t) / span + 1) - 1;
      // extrapolate a little past the last update so friends glide instead of jumping every 200 ms
      const x = b.x + (b.x - a.x) * f, z = b.z + (b.z - a.z) * f; r.kart.position.x += (x - r.kart.position.x) * 0.35; r.kart.position.z += (z - r.kart.position.z) * 0.35; r.kart.rotation.y = b.h; r.kart.wheels.forEach((w) => { w.rotation.x += 0.3; }); });
  }
  addTag(r) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = r.colour; g.beginPath(); g.roundRect(8, 8, 240, 48, 24); g.fill(); g.fillStyle = '#fff'; g.font = '700 30px Inter, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.name, 128, 33); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(4, 1, 1); s.position.y = 2.8; r.kart.add(s); }
  bubble(c) { const box = this.el.querySelector('#bubbles'); const d = document.createElement('div'); d.className = 'kart-bubble' + (c.me ? ' me' : ''); d.innerHTML = `<b>${this.h(c.name)}</b> ${this.h(c.body)}`; box.appendChild(d); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4800); while (box.children.length > 4) box.firstChild.remove(); }
  bindChat() {
    const box = this.el.querySelector('#chatbox');
    this.el.querySelector('#chatbtn').addEventListener('click', () => {
      if (box.classList.toggle('on')) {
        box.innerHTML = `<div class="kart-quick">${(this.quick || ['GG', 'Nice one', "Let's go!"]).map((q) => `<button data-q="${this.h(q)}">${this.h(q)}</button>`).join('')}</div><div class="kart-chatrow"><input id="kmsg" maxlength="140" placeholder="Message"><button id="ksend">Send</button></div>`;
        const send = async (t) => { if (!t) return; box.classList.remove('on'); try { await this.api.kartChat(this.code, t); this.syncRoom(); } catch {} };
        box.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
        box.querySelector('#ksend').addEventListener('click', () => send(box.querySelector('#kmsg').value.trim()));
        box.querySelector('#kmsg').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(e.target.value.trim()); e.stopPropagation(); });
      }
    });
  }
}
