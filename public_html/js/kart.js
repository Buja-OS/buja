// Buja Kart: a go-kart race round central Abuja. three.js (vendored, loaded only here), low-poly and instanced so it
// holds 60 fps on ordinary phones. Solo and bot races run entirely on the phone; rooms sync through /kart/rooms.
import * as THREE from './vendor/three.module.min.js';
import { Sky } from './vendor/three-sky.js';

const LAPS = 3;
const ROAD_W = 16;                     // metres
const MAX_V = 36, OFF_V = 15, BOOST_V = 46; // m/s
let SAMPLES = 600;                    // set from the real circuit when it loads (one point every 4 m)
const CIRCUIT_URL = '/assets/kart/abuja-circuit.json';
const TEX = '/assets/kart/';
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
      <div class="card row" style="padding:12px 14px;gap:10px"><div class="grow"><div style="font-weight:700">Graphics</div><div class="small muted">Auto picks what your phone can run smoothly</div></div><select class="input" id="gfx" style="width:auto;height:40px">${['auto', 'low', 'medium', 'high'].map((g) => `<option value="${g}" ${((() => { try { return localStorage.getItem('buja_kart_gfx'); } catch { return null; } })() || 'auto') === g ? 'selected' : ''}>${g[0].toUpperCase() + g.slice(1)}</option>`).join('')}</select></div>
      <div class="card stack" style="padding:12px 14px;gap:10px">
        ${[['buja_kart_orient', 'Screen', [['portrait', 'Upright'], ['landscape', 'Sideways']], 'portrait'], ['buja_kart_steer', 'Steering', [['buttons', 'Buttons'], ['tilt', 'Tilt the phone']], 'buttons'], ['buja_kart_sfx', 'Sound effects', [['1', 'On'], ['0', 'Off']], '1'], ['buja_kart_music', 'Music', [['1', 'On'], ['0', 'Off']], '1']].map(([key, label, opts, def]) => { const cur = (() => { try { return localStorage.getItem(key) || def; } catch { return def; } })(); return `<div class="row" style="gap:10px"><div class="grow" style="font-weight:600">${label}</div><select class="input" data-set="${key}" style="width:auto;height:38px">${opts.map(([v, t]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`; }).join('')}
      </div>
      <div class="small muted" style="line-height:1.5">The circuit follows real central Abuja streets (Independence Avenue, Herbert Macaulay Way, Sani Abacha Way, Tafawa Balewa Way), compressed for a raceable lap. Road data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, ODbL. Engine and drive-by sounds recorded by alex_jauk and kontraa.</div>
      <div class="small muted" style="line-height:1.5">Controls: tap the left and right halves of the bottom bar to steer. The kart drives itself forward; hold 🔥 while turning to drift, and let go for a boost. On a keyboard: arrow keys and space.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
      el.querySelector('#gfx')?.addEventListener('change', (e) => { try { localStorage.setItem('buja_kart_gfx', e.target.value); } catch {} toast('Graphics: ' + e.target.value); });
      el.querySelectorAll('[data-set]').forEach((s) => s.addEventListener('change', (e) => { try { localStorage.setItem(s.dataset.set, e.target.value); } catch {} }));
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
      <button class="kart-quit" id="pause" aria-label="Pause">❚❚</button>
      <div class="kart-lines" id="lines"></div>
      <div class="kart-wrong" id="wrong">WRONG WAY</div>
      <div class="kart-callout" id="callout"></div>
      <div class="kart-pause" id="pausebox"></div>
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
    this.audio = new KartAudio(); this.paused = false; this.steerMode = (() => { try { return localStorage.getItem('buja_kart_steer') || 'buttons'; } catch { return 'buttons'; } })(); this.tilt = 0; this.shake = 0;
  }

  /* ------------------------------ setup ------------------------------ */
  async start() {
    const canvas = this.el.querySelector('#kc');
    this.tier = pickTier();
    const T = this.tier;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: T === 'high', powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T === 'high' ? 1.6 : T === 'medium' ? 1.25 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.78;
    this.renderer.shadowMap.enabled = T !== 'low'; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 6000);
    // A physically based sky with the Abuja afternoon sun; it also lights and reflects on everything (image-based lighting).
    const sky = new Sky(); sky.scale.setScalar(9000); const su = sky.material.uniforms;
    su.turbidity.value = 7; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82; // a touch of harmattan haze
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(205));
    su.sunPosition.value.copy(this.sunDir);
    const pm = new THREE.PMREMGenerator(this.renderer); const envScene = new THREE.Scene(); const s2 = sky.clone(); envScene.add(s2);
    this.scene.environment = pm.fromScene(envScene, 0, 0.1, 10000).texture; pm.dispose();
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog('#C9DCE6', 500, T === 'low' ? 1500 : 2600);
    this.scene.add(new THREE.HemisphereLight('#E4F1FF', '#8A7A55', 0.35));
    this.sun = new THREE.DirectionalLight('#FFF0D8', 2.4); this.sun.position.copy(this.sunDir).multiplyScalar(300);
    if (T !== 'low') { const sh = this.sun.shadow; sh.mapSize.set(T === 'high' ? 2048 : 1024, T === 'high' ? 2048 : 1024); sh.camera.left = sh.camera.bottom = -70; sh.camera.right = sh.camera.top = 70; sh.camera.near = 50; sh.camera.far = 700; sh.bias = -0.0004; sh.normalBias = 0.6; this.sun.castShadow = true; }
    this.scene.add(this.sun, this.sun.target);
    this.tex = await loadTextures(this.renderer, T);
    this.circuit = await (await fetch(CIRCUIT_URL)).json();
    SAMPLES = this.circuit.lap.length;
    this.buildTrack(); this.buildWorld(); this.buildLandmarks(); this.buildBarriers();
    this.fx = new KartFX(this.scene, this.tier);
    this.audio.wake();
    if (((() => { try { return localStorage.getItem('buja_kart_orient'); } catch { return null; } })()) === 'landscape') this.setLandscape(true, true);
    if (this.steerMode === 'tilt') this.enableTilt(true);
    this.player = this.makeKart('#FF5A00', true);
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
  stop() { this.audio.stop(); try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch {} try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} window.removeEventListener('deviceorientation', this._tilt); document.removeEventListener('visibilitychange', this._vis); this.running = false; window.removeEventListener('resize', this._onResize); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); try { this.renderer.dispose(); } catch {} }
  resize() { const w = this.el.clientWidth || innerWidth, hgt = this.el.clientHeight || innerHeight; this.renderer.setSize(w, hgt, false); this.camera.aspect = w / hgt; this.camera.updateProjectionMatrix(); }

  /* ------------------------------ the circuit: real Abuja streets ------------------------------ */
  buildTrack() {
    const C = this.circuit; const T = this.tier;
    this.samples = C.lap.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.tangents = this.samples.map((_, i) => this.samples[(i + 1) % SAMPLES].clone().sub(this.samples[(i - 1 + SAMPLES) % SAMPLES]).normalize());
    this.length = C.lengthM;
    // a ribbon between two offsets from the centre line, with UVs in metres so textures keep their real size
    const ribbon = (a, b, y, closed = true, pts = this.samples, tans = this.tangents) => {
      const n = pts.length, pos = [], uv = [], idx = []; let dist = 0;
      for (let i = 0; i <= (closed ? n : n - 1); i++) {
        const p = pts[i % n], t = tans[i % n], nx = -t.z, nz = t.x;
        if (i > 0) dist += pts[i % n].distanceTo(pts[(i - 1) % n]);
        pos.push(p.x + nx * a, y, p.z + nz * a, p.x + nx * b, y, p.z + nz * b); uv.push(0, dist, (b - a), dist);
        if (i < (closed ? n : n - 1)) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    this.ribbon = ribbon;
    const asphalt = new THREE.MeshStandardMaterial({ map: this.tex.asphalt, normalMap: T === 'low' ? null : this.tex.asphaltN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.88, metalness: 0 });
    const road = new THREE.Mesh(ribbon(-ROAD_W / 2, ROAD_W / 2, 0.02), asphalt); road.receiveShadow = true; this.scene.add(road);
    // kerbs: red and white blocks, slightly raised
    const kc = [], kp = [], ki = [];
    for (const side of [-1, 1]) for (let i = 0; i < SAMPLES; i += 1) {
      const a = this.samples[i], b = this.samples[(i + 1) % SAMPLES], t = this.tangents[i], nx = -t.z, nz = t.x, o1 = side * ROAD_W / 2, o2 = side * (ROAD_W / 2 + 1.2), v = kp.length / 3;
      kp.push(a.x + nx * o1, 0.08, a.z + nz * o1, a.x + nx * o2, 0.08, a.z + nz * o2, b.x + nx * o1, 0.08, b.z + nz * o1, b.x + nx * o2, 0.08, b.z + nz * o2);
      const c = Math.floor(i / 1) % 2 ? [0.78, 0.1, 0.1] : [0.95, 0.95, 0.95]; for (let q = 0; q < 4; q++) kc.push(...c);
      ki.push(...(side > 0 ? [v, v + 1, v + 2, v + 1, v + 3, v + 2] : [v, v + 2, v + 1, v + 1, v + 2, v + 3]));
    }
    const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3)); kg.setAttribute('color', new THREE.Float32BufferAttribute(kc, 3)); kg.setIndex(ki); kg.computeVertexNormals();
    this.scene.add(new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
    // pavements beyond the kerbs, then the city begins
    const pave = new THREE.MeshStandardMaterial({ map: this.tex.pave, roughness: 0.95 });
    for (const [a, b] of [[ROAD_W / 2 + 1.2, ROAD_W / 2 + 6], [-ROAD_W / 2 - 6, -ROAD_W / 2 - 1.2]]) { const m = new THREE.Mesh(ribbon(a, b, 0.12), pave); m.receiveShadow = true; this.scene.add(m); }
    // painted lines: a dashed centre line and solid edge lines, as separate crisp quads
    const lp = [], li = [];
    const quad = (a, b, off, w) => { const t = a.clone().sub(b).normalize(), nx = -t.z, nz = t.x, v = lp.length / 3; for (const p of [a, b]) lp.push(p.x + nx * (off - w), 0.05, p.z + nz * (off - w), p.x + nx * (off + w), 0.05, p.z + nz * (off + w)); li.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); };
    for (let i = 0; i < SAMPLES; i++) { const a = this.samples[i], b = this.samples[(i + 1) % SAMPLES]; quad(a, b, ROAD_W / 2 - 0.6, 0.12); quad(a, b, -ROAD_W / 2 + 0.6, 0.12); if (i % 3 === 0) quad(a, this.samples[(i + 2) % SAMPLES], 0, 0.14); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setIndex(li); lg.computeVertexNormals();
    this.scene.add(new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: '#F2F2EC', roughness: 0.5 })));
    // start/finish: chequered strip and a gantry
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16; const cx = cv.getContext('2d'); for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cx.fillRect(i * 4, j * 4, 4, 4); }
    const ct = new THREE.CanvasTexture(cv); ct.magFilter = THREE.NearestFilter; ct.colorSpace = THREE.SRGBColorSpace;
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2.5), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.6 })); fin.rotation.x = -Math.PI / 2; fin.rotation.z = -Math.atan2(this.tangents[0].x, this.tangents[0].z) + Math.PI / 2; fin.position.copy(this.samples[0]).setY(0.06); this.scene.add(fin);
    const gm = new THREE.MeshStandardMaterial({ color: '#15151A', roughness: 0.4, metalness: 0.6 }), g1 = new THREE.Group();
    [-ROAD_W / 2 - 2.5, ROAD_W / 2 + 2.5].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), gm); p.position.set(x, 4, 0); p.castShadow = true; g1.add(p); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6, 1.8, 0.9), new THREE.MeshStandardMaterial({ color: '#FF7A1A', roughness: 0.35, metalness: 0.2 })); beam.position.set(0, 8.4, 0); beam.castShadow = true; g1.add(beam);
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 64; const bg = bc.getContext('2d'); bg.fillStyle = '#FF7A1A'; bg.fillRect(0, 0, 512, 64); bg.fillStyle = '#fff'; bg.font = '900 42px Inter, system-ui, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText('BUJA KART · ABUJA', 256, 34);
    const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; const banner = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 5, 1.6), new THREE.MeshBasicMaterial({ map: bt })); banner.position.set(0, 8.4, -0.46); banner.rotation.y = Math.PI; g1.add(banner);
    const banner2 = banner.clone(); banner2.position.z = 0.46; banner2.rotation.y = 0; g1.add(banner2);
    this.placeAlong(g1, 0, 0); this.scene.add(g1);
    // boost pads: glowing chevrons
    const padC = document.createElement('canvas'); padC.width = 64; padC.height = 128; const pg = padC.getContext('2d'); pg.fillStyle = '#1a3d10'; pg.fillRect(0, 0, 64, 128); pg.strokeStyle = '#7ED957'; pg.lineWidth = 10; for (let y = 16; y < 128; y += 36) { pg.beginPath(); pg.moveTo(8, y + 20); pg.lineTo(32, y); pg.lineTo(56, y + 20); pg.stroke(); }
    const padT = new THREE.CanvasTexture(padC); padT.colorSpace = THREE.SRGBColorSpace;
    const padM = new THREE.MeshStandardMaterial({ map: padT, emissive: '#7ED957', emissiveMap: padT, emissiveIntensity: 0.9, roughness: 0.4 });
    this.pads = BOOSTS.map((t) => { const s = Math.floor(t * SAMPLES); const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 7), padM); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(this.tangents[s].x, this.tangents[s].z); m.position.copy(this.samples[s]).setY(0.07); this.scene.add(m); return s; });
    // the real streets around the circuit: not driveable, but they make the city grid read correctly
    const ctxMat = new THREE.MeshStandardMaterial({ map: this.tex.asphalt, roughness: 0.92, color: '#DDDDDD' });
    const geos = [];
    for (const c of C.context) {
      if (c.p.length < 2) continue;
      const pts = c.p.map(([x, z]) => new THREE.Vector3(x, 0, z)); const tans = pts.map((p, i) => (pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)])).normalize());
      // skip stretches that run under the circuit itself
      if (pts.every((p) => this.nearest(p.x, p.z).dist < ROAD_W)) continue;
      geos.push(ribbon(-c.w / 2, c.w / 2, 0.01, false, pts, tans));
    }
    if (geos.length) { const merged = mergeGeos(geos); const m = new THREE.Mesh(merged, ctxMat); m.receiveShadow = true; this.scene.add(m); }
  }
  placeAlong(obj, s, offset, face = true) { const i = ((Math.round(s) % SAMPLES) + SAMPLES) % SAMPLES; const p = this.samples[i], t = this.tangents[i]; obj.position.set(p.x - t.z * offset, 0, p.z + t.x * offset); if (face) obj.rotation.y = Math.atan2(t.x, t.z); }
  nearest(x, z, hint = null) {
    let best = -1, bd = Infinity; const scan = (from, to) => { for (let k = from; k <= to; k++) { const i = ((k % SAMPLES) + SAMPLES) % SAMPLES; const p = this.samples[i]; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } };
    if (hint != null) scan(hint - 30, hint + 30); if (hint == null || bd > 900) scan(0, SAMPLES - 1);
    const t = this.tangents[best], p = this.samples[best];
    return { i: best, lateral: (x - p.x) * -t.z + (z - p.z) * t.x, dist: Math.sqrt(bd) };
  }

  /* ------------------------------ the city ------------------------------ */
  buildWorld() {
    const T = this.tier;
    const gt = this.tex.grass; gt.repeat.set(380, 380);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3200, 48), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const clearOfTrack = (x, z, r) => { for (let i = 0; i < SAMPLES; i += 3) { const p = this.samples[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return false; } return true; };
    const CLEAR = { assembly: 135, mosque: 105, eagle: 90, christian: 80, nnpc: 75, cbn: 70, tower: 60, millennium: 70 }; // each landmark's own space
    const nearLandmark = (x, z) => this.circuit.landmarks.some((l) => l.id !== 'aso' && (l.x - x) ** 2 + (l.z - z) ** 2 < (CLEAR[l.id] || 85) ** 2);
    // Buildings: one instanced mesh, facades from a texture sheet, floors and bays repeating to each building's real size.
    const N = T === 'low' ? 140 : T === 'medium' ? 240 : 340;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const style = new Float32Array(N);
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.facades, roughness: 0.55, metalness: 0.15 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aStyle; varying float vStyle; varying vec2 vRep; varying float vRoof;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vStyle = aStyle; float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
          vRoof = step(0.5, abs(normal.y)); float w = abs(normal.x) > 0.5 ? sz : sx; vRep = vec2(max(1.0, floor(w / 11.0)), max(1.0, floor(sy / 3.6)));`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStyle; varying vec2 vRep; varying float vRoof;')
        .replace('#include <map_fragment>', `vec2 fu = fract(vMapUv * vRep); vec4 sampledDiffuseColor = texture2D(map, vec2((vStyle + fu.x) / 4.0, fu.y));
          if (vRoof > 0.5) sampledDiffuseColor = vec4(0.62, 0.60, 0.57, 1.0);
          diffuseColor *= sampledDiffuseColor;`);
    };
    const bm = new THREE.InstancedMesh(geo, mat, N); bm.castShadow = T === 'high'; bm.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let n = 0, tries = 0;
    while (n < N && tries < N * 12) {
      tries++; const s = Math.floor(Math.random() * SAMPLES), side = Math.random() < 0.5 ? -1 : 1, off = side * (ROAD_W / 2 + 14 + Math.random() * 70);
      const p = this.samples[s], t = this.tangents[s], x = p.x - t.z * off, z = p.z + t.x * off;
      const w = 16 + Math.random() * 22, d = 14 + Math.random() * 20;
      if (!clearOfTrack(x, z, ROAD_W / 2 + 6 + Math.max(w, d) * 0.6) || nearLandmark(x, z)) continue;
      const tall = Math.random() < 0.18; const hgt = tall ? 45 + Math.random() * 45 : 10 + Math.random() * 24;
      const st = tall ? (Math.random() < 0.6 ? 0 : 2) : [1, 1, 2, 3, 3][Math.floor(Math.random() * 5)];
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t.x, t.z));
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, hgt, d)); bm.setMatrixAt(n, m4); style[n] = st; n++;
    }
    bm.count = n; geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 1)); this.scene.add(bm);
    // Trees along the verges: royal palms and neem, instanced
    const palmTrunk = new THREE.CylinderGeometry(0.22, 0.38, 9, 7); palmTrunk.translate(0, 4.5, 0);
    const frond = new THREE.ConeGeometry(3.4, 1.6, 7, 1, true); frond.translate(0, 9.2, 0);
    const neem = new THREE.IcosahedronGeometry(3.6, 1); neem.translate(0, 6, 0); const neemTrunk = new THREE.CylinderGeometry(0.35, 0.5, 4.5, 6); neemTrunk.translate(0, 2.25, 0);
    const TN = T === 'low' ? 160 : 300;
    const trunkM = new THREE.MeshStandardMaterial({ color: '#8C7A5E', roughness: 0.9 }), leafM = new THREE.MeshStandardMaterial({ color: '#3F7A34', roughness: 0.8 }), neemM = new THREE.MeshStandardMaterial({ color: '#4E8A3A', roughness: 0.85, flatShading: true });
    const pt = new THREE.InstancedMesh(palmTrunk, trunkM, TN), pf = new THREE.InstancedMesh(frond, leafM, TN), nt = new THREE.InstancedMesh(neemTrunk, trunkM, TN), nc = new THREE.InstancedMesh(neem, neemM, TN);
    let np = 0, nn = 0; const col = new THREE.Color();
    for (let s = 0; s < SAMPLES; s += 3) for (const side of [-1, 1]) {
      const p = this.samples[s], t = this.tangents[s], off = side * (ROAD_W / 2 + 8.5), x = p.x - t.z * off, z = p.z + t.x * off;
      if (!clearOfTrack(x, z, ROAD_W / 2 + 7.5)) continue;
      const sc = 0.85 + Math.random() * 0.35; m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(sc, sc, sc));
      if ((s / 3) % 2 === 0) { if (np < TN) { pt.setMatrixAt(np, m4); pf.setMatrixAt(np, m4); np++; } } else if (nn < TN) { nt.setMatrixAt(nn, m4); nc.setMatrixAt(nn, m4); nc.setColorAt(nn, col.setHSL(0.27 + Math.random() * 0.05, 0.45, 0.28 + Math.random() * 0.08)); nn++; }
    }
    pt.count = pf.count = np; nt.count = nc.count = nn; [pt, pf, nt, nc].forEach((m) => { m.castShadow = T !== 'low'; this.scene.add(m); });
    // Street lamps every 30 m, alternating sides, like Abuja's avenues
    const pole = new THREE.CylinderGeometry(0.12, 0.16, 9, 6); pole.translate(0, 4.5, 0); const arm = new THREE.BoxGeometry(0.12, 0.12, 2.6); arm.translate(0, 9, 1.2); const lamp = new THREE.BoxGeometry(0.5, 0.18, 0.9); lamp.translate(0, 8.9, 2.4);
    const lampG = mergeGeos([pole, arm, lamp]); const LN = Math.floor(SAMPLES / 8) + 2;
    const lm = new THREE.InstancedMesh(lampG, new THREE.MeshStandardMaterial({ color: '#5A5F66', roughness: 0.45, metalness: 0.7 }), LN); let nl = 0;
    for (let s = 0; s < SAMPLES && nl < LN; s += 8) { const side = (s / 8) % 2 ? 1 : -1; const p = this.samples[s], t = this.tangents[s], off = side * (ROAD_W / 2 + 3); const x = p.x - t.z * off, z = p.z + t.x * off; if (!clearOfTrack(x, z, ROAD_W / 2 + 2)) continue; m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t.x, t.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2)), new THREE.Vector3(1, 1, 1)); lm.setMatrixAt(nl++, m4); }
    lm.count = nl; lm.castShadow = T === 'high'; this.scene.add(lm);
    // Zuma Rock on the western horizon
    const zg = rockGeometry(3, 1.25, 11); const zuma = new THREE.Mesh(zg, new THREE.MeshStandardMaterial({ map: this.tex.rock, roughness: 0.95, color: '#B8A690' })); zuma.scale.set(260, 230, 210); zuma.position.set(-2400, -8, -700); this.scene.add(zuma);
    this.addLabel('Zuma Rock', -2400, 330, -700, 2.4);
  }

  /* ------------------------------ Abuja's landmarks ------------------------------ */
  buildLandmarks() {
    const S = (o) => new THREE.MeshStandardMaterial(o);
    const stone = S({ color: '#EEE7D8', roughness: 0.75 }), white = S({ color: '#F5F2EA', roughness: 0.6 });
    const gold = S({ color: '#E0A93A', metalness: 1, roughness: 0.22 }), glass = S({ color: '#4E7FA6', metalness: 0.9, roughness: 0.08 });
    const copper = S({ color: '#2F8F68', metalness: 0.55, roughness: 0.35 }), dark = S({ color: '#20242A', metalness: 0.4, roughness: 0.4 });
    const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); b.castShadow = b.receiveShadow = true; return b; };
    const make = {
      eagle: () => { const g = new THREE.Group(); g.add(box(90, 0.5, 60, S({ color: '#E7E1D4', roughness: 0.85 })));
        const stand = box(70, 9, 9, white, 0, 0, -26); g.add(stand); const roof = box(76, 0.8, 13, S({ color: '#1E7A46', roughness: 0.5, metalness: 0.2 }), 0, 10, -26); g.add(roof);
        for (let i = -3; i <= 3; i++) g.add(box(0.8, 10, 0.8, white, i * 11, 0, -20));
        this.flags = []; [-30, 0, 30].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 20, 8), S({ color: '#DDD', metalness: 0.8, roughness: 0.3 })); p.position.set(x, 10, 16); g.add(p); const f = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.6, 12, 1), new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.7 })); f.position.set(x + 3, 18, 16); g.add(f); this.flags.push(f); });
        const eagleM = new THREE.Mesh(new THREE.ConeGeometry(3.2, 7, 5), gold); eagleM.position.set(-38, 6.5, 12); g.add(eagleM); const ped = box(4, 3, 4, stone, -38, 0, 12); g.add(ped); return g; },
      christian: () => { const g = new THREE.Group(); g.add(box(34, 20, 60, stone)); const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 24, 16, 4, 1), S({ color: '#6E8FB5', roughness: 0.5, metalness: 0.3 })); roof.rotation.y = Math.PI / 4; roof.scale.set(0.72, 1, 1.25); roof.position.y = 28; roof.castShadow = true; g.add(roof);
        [-10, 10].forEach((x) => { g.add(box(7, 30, 7, stone, x, 0, 30)); const sp = new THREE.Mesh(new THREE.ConeGeometry(4.4, 26, 8), stone); sp.position.set(x, 43, 30); sp.castShadow = true; g.add(sp); });
        const main = new THREE.Mesh(new THREE.ConeGeometry(6, 52, 8), stone); main.position.set(0, 46, 34); main.castShadow = true; g.add(main); g.add(box(12, 20, 12, stone, 0, 0, 34));
        const cross = new THREE.Group(); cross.add(box(0.8, 7, 0.8, gold), box(4, 0.8, 0.8, gold, 0, 4.6, 0)); cross.position.set(0, 72, 34); g.add(cross); return g; },
      nnpc: () => { const g = new THREE.Group(); const frame = S({ color: '#D8DEE3', roughness: 0.5, metalness: 0.3 });
        [[-13, -13], [13, -13], [-13, 13], [13, 13]].forEach(([x, z]) => { const t = box(16, 75, 16, glass, x, 0, z); g.add(t); for (let y = 6; y < 75; y += 6) g.add(box(16.3, 0.7, 16.3, frame, x, y, z)); g.add(box(17, 2, 17, frame, x, 75, z)); });
        g.add(box(46, 12, 46, frame)); return g; },
      mosque: () => { const g = new THREE.Group(); g.add(box(56, 18, 56, white));
        for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) { g.add(box(6, 9, 0.6, S({ color: '#C8B99A', roughness: 0.7 }), i * 10, 3, s * 28.2)); g.add(box(0.6, 9, 6, S({ color: '#C8B99A', roughness: 0.7 }), s * 28.2, 3, i * 10)); }
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 7, 40), white); drum.position.y = 21.5; drum.castShadow = true; g.add(drum);
        const dome = new THREE.Mesh(lathe([[17, 0], [17.3, 3], [16.6, 8], [14.6, 13], [11.4, 17.5], [7.4, 21], [3.4, 23.4], [0.8, 24.4], [0, 24.6]], 48), gold); dome.position.y = 25; dome.castShadow = true; g.add(dome);
        const fin = new THREE.Mesh(lathe([[0.9, 0], [0.9, 2], [0.4, 3], [1.2, 4.5], [0, 7]]), gold); fin.position.y = 49.5; g.add(fin);
        [[-31, -31], [31, -31], [-31, 31], [31, 31]].forEach(([x, z]) => { const m = new THREE.Mesh(lathe([[2.4, 0], [2.1, 30], [3.2, 30.4], [3.2, 31.6], [1.9, 32], [1.7, 48], [2.8, 48.4], [2.8, 49.4], [1.5, 50]], 16), white); m.position.set(x, 0, z); m.castShadow = true; g.add(m);
          const cap = new THREE.Mesh(lathe([[1.6, 0], [1.5, 1.8], [0.8, 3.6], [0, 5.2]], 16), gold); cap.position.set(x, 50, z); g.add(cap); });
        return g; },
      millennium: () => { const g = new THREE.Group(); const water = new THREE.Mesh(new THREE.CircleGeometry(30, 40), S({ color: '#2F7FAE', metalness: 0.2, roughness: 0.05 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.3; g.add(water);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(30, 0.8, 8, 48), stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.5; g.add(rim);
        for (let i = 0; i < 5; i++) { const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.9, 5 + i, 8), S({ color: '#DDEFFF', transparent: true, opacity: 0.55, roughness: 0.1 })); jet.position.set(Math.cos(i * 1.26) * 12, 3, Math.sin(i * 1.26) * 12); g.add(jet); }
        return g; },
      assembly: () => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(38, 42, 20, 40), white); body.position.y = 10; body.castShadow = body.receiveShadow = true; g.add(body);
        for (let a = 0; a < 24; a++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 20, 8), stone); c.position.set(Math.cos(a / 24 * Math.PI * 2) * 43, 10, Math.sin(a / 24 * Math.PI * 2) * 43); c.castShadow = true; g.add(c); }
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 2, 40), stone); ring.position.y = 21; g.add(ring);
        const dome = new THREE.Mesh(lathe([[26, 0], [25, 6], [21, 12], [15, 16.5], [8, 19], [0, 20]], 48), copper); dome.position.y = 22; dome.castShadow = true; g.add(dome);
        const lan = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 8, 12), stone); lan.position.y = 46; g.add(lan); const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10), gold); top.position.y = 51; g.add(top); return g; },
      cbn: () => { const g = new THREE.Group(); g.add(box(40, 95, 26, glass)); for (let y = 8; y < 95; y += 8) g.add(box(40.4, 1.4, 26.4, stone, 0, y, 0)); g.add(box(14, 95, 28, stone, 0, 0, 0)); g.add(box(60, 14, 40, stone)); return g; },
      tower: () => { const g = new THREE.Group(); const shaft = new THREE.Mesh(lathe([[5, 0], [3.2, 100], [2.2, 150], [0.6, 172], [0, 175]], 24), S({ color: '#E8ECEF', metalness: 0.6, roughness: 0.25 })); shaft.castShadow = true; g.add(shaft);
        const pod = new THREE.Mesh(lathe([[1, 0], [9, 2], [10, 5], [8, 8], [1, 9]], 32), glass); pod.position.y = 118; pod.castShadow = true; g.add(pod); g.add(box(26, 5, 26, stone)); return g; },
      aso: () => { const m = new THREE.Mesh(rockGeometry(4, 0.82, 5), new THREE.MeshStandardMaterial({ map: this.tex.rock, roughness: 0.95, color: '#C4B3A0' })); m.scale.set(330, 300, 260); m.castShadow = false; const g = new THREE.Group(); g.add(m); return g; },
    };
    this.landmarkAt = [];
    for (const l of this.circuit.landmarks) {
      if (!make[l.id]) continue;
      const g = make[l.id](); g.position.set(l.x, 0, l.z);
      const t = this.tangents[l.s]; g.rotation.y = Math.atan2(t.x, t.z);
      this.scene.add(g); this.landmarkAt.push({ s: l.s, name: l.name });
      const top = { aso: 290, tower: 185, cbn: 108, nnpc: 90, christian: 82, assembly: 60, mosque: 64, eagle: 26, millennium: 16 }[l.id] || 60;
      this.addLabel(l.name, l.x, top, l.z, l.id === 'aso' ? 2.2 : 1);
    }
  }
  addLabel(text, x, y, z, scale = 1) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = 'rgba(16,16,20,.72)'; const w = Math.min(500, 44 + text.length * 25); g.beginPath(); g.roundRect((512 - w) / 2, 16, w, 64, 32); g.fill();
    g.fillStyle = '#fff'; g.font = '700 36px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 49);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false })); s.scale.set(48 * scale, 9 * scale, 1); s.position.set(x, y, z); this.scene.add(s);
  }

  /* ------------------------------ karts ------------------------------ */
  makeKart(colour, isPlayer = false, ghost = false) {
    const g = new THREE.Group(); const T = this.tier;
    const paint = ghost ? new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.32, depthWrite: false })
      : T === 'high' ? new THREE.MeshPhysicalMaterial({ color: colour, metalness: 0.1, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.6 }) : new THREE.MeshStandardMaterial({ color: colour, metalness: 0.1, roughness: 0.45, envMapIntensity: 0.6 });
    const dark = ghost ? paint : new THREE.MeshStandardMaterial({ color: '#17181C', roughness: 0.55, metalness: 0.3 });
    const tyre = ghost ? paint : new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.92 }), rim = ghost ? paint : new THREE.MeshStandardMaterial({ color: '#C9CDD2', metalness: 0.9, roughness: 0.25 });
    // body: a side profile extruded across the width, with rounded edges
    const sp = new THREE.Shape(); sp.moveTo(-1.55, 0.25); sp.lineTo(1.35, 0.25); sp.quadraticCurveTo(1.85, 0.3, 1.9, 0.5); sp.lineTo(1.2, 0.72); sp.lineTo(0.2, 0.78); sp.lineTo(-0.9, 0.95); sp.lineTo(-1.5, 0.9); sp.lineTo(-1.62, 0.5); sp.lineTo(-1.55, 0.25);
    const bodyG = new THREE.ExtrudeGeometry(sp, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 }); bodyG.translate(0, 0, -0.6); bodyG.rotateY(-Math.PI / 2);
    const body = new THREE.Mesh(bodyG, paint); g.add(body);
    const pods = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.2), paint); pods.position.set(0, 0.42, -0.1); g.add(pods);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.45), dark); wing.position.set(0, 1.18, -1.5); g.add(wing); [-0.8, 0.8].forEach((x) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.3), dark); s.position.set(x, 1.0, -1.5); g.add(s); });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.6), dark); seat.position.set(0, 0.95, -0.55); g.add(seat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), ghost ? paint : new THREE.MeshStandardMaterial({ color: '#F2F2F2', metalness: 0.1, roughness: 0.15 })); head.position.set(0, 1.5, -0.4); g.add(head);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.335, 20, 10, -0.9, 1.8, 1.1, 0.8), ghost ? paint : new THREE.MeshStandardMaterial({ color: '#0E1116', metalness: 0.9, roughness: 0.05 })); visor.position.copy(head.position); g.add(visor);
    const wg = new THREE.CylinderGeometry(0.4, 0.4, 0.36, 18); wg.rotateZ(Math.PI / 2); const rg = new THREE.CylinderGeometry(0.22, 0.22, 0.38, 10); rg.rotateZ(Math.PI / 2);
    g.wheels = [[-0.95, 1.1], [0.95, 1.1], [-0.98, -1.1], [0.98, -1.1]].map(([x, z]) => { const w = new THREE.Group(); w.add(new THREE.Mesh(wg, tyre), new THREE.Mesh(rg, rim)); w.position.set(x, 0.4, z); g.add(w); return w; });
    g.traverse((o) => { if (o.isMesh && !ghost) o.castShadow = true; });
    if (!ghost && T === 'low') { const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.8), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; g.add(sh); }
    if (isPlayer) { g.flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 10), new THREE.MeshBasicMaterial({ color: '#FFB020' })); g.flame.rotation.x = -Math.PI / 2; g.flame.position.set(0, 0.6, -2.1); g.flame.visible = false; g.add(g.flame); }
    g.rotation.order = 'YXZ'; g.wheels.forEach((w) => { w.rotation.order = 'YXZ'; });
    g.v = 0; g.h = 0; g.lap = 1; g.s = 0; g.boost = 0; g.drift = 0; g.idx = 0; g.lean = 0; g.pitch = 0;
    this.scene.add(g); return g;
  }
  placeOnGrid(k, slot) {
    const row = Math.floor(slot / 2), col = slot % 2 ? 1 : -1;
    const s = (SAMPLES - 4 - row * 3 + SAMPLES) % SAMPLES; this.placeAlong(k, s, col * 3.4);
    k.h = Math.atan2(this.tangents[s].x, this.tangents[s].z); k.rotation.y = k.h; k.idx = s; k.startS = s; k.passedHalf = false;
  }

  /* ------------------------------ controls ------------------------------ */
  bindControls() {
    const hold = (id, key) => { const b = this.el.querySelector('#' + id); const on = (e) => { e.preventDefault(); this.input[key] = 1; b.classList.add('on'); }; const off = (e) => { e && e.preventDefault(); this.input[key] = 0; b.classList.remove('on'); };
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off); };
    hold('kl', 'l'); hold('kr', 'r'); hold('kb', 'brake'); hold('kd', 'drift');
    const wake = () => this.audio.wake(); this.el.addEventListener('touchstart', wake, { passive: true }); this.el.addEventListener('mousedown', wake);
    this.el.querySelector('#pause').addEventListener('click', () => this.togglePause());
    this._vis = () => { if (document.hidden && this.phase === 'race' && this.mode !== 'room' && !this.paused) this.togglePause(); }; document.addEventListener('visibilitychange', this._vis);
    const map = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowDown: 'brake', s: 'brake', S: 'brake', ' ': 'drift', Shift: 'drift' };
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') this.togglePause(); });
    this._kd = (e) => { if (map[e.key]) { this.input[map[e.key]] = 1; e.preventDefault(); } }; this._ku = (e) => { if (map[e.key]) this.input[map[e.key]] = 0; };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);

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
    if (Math.abs(on.lateral) > ROAD_W / 2 + 9) { const t = this.tangents[on.i], back = Math.sign(on.lateral) * (Math.abs(on.lateral) - (ROAD_W / 2 + 9)); k.position.x += t.z * back; k.position.z -= t.x * back; if (!isAI && k.v > 8 && !k._hit) { this.audio.bump(); this.shake = 0.35; this.buzz(30); } k._hit = true; k.v *= 0.9; } else k._hit = false;
    if (this.pads.some((p) => Math.abs(p - on.i) < 4) && Math.abs(on.lateral) < 3) { if (!isAI && k.boost <= 0) this.audio.boost(); k.boost = Math.max(k.boost, 1.1); }
    // lean into turns, dip under braking, front wheels steer
    const lean = -steer * Math.min(1, k.v / 22) * (drift ? 0.11 : 0.07); k.lean += (lean - k.lean) * 0.15;
    const pitch = brake ? 0.035 : (k.boost > 0 ? -0.03 : -0.01 * Math.min(1, k.v / 30)); k.pitch += (pitch - k.pitch) * 0.12;
    k.rotation.z = k.lean; k.rotation.x = k.pitch; k.wheels[0].rotation.y = k.wheels[1].rotation.y = steer * 0.38;
    if (this.fx && (isAI ? Math.random() < 0.3 : true)) {
      const back = -1.15, sx = Math.sin(k.h), cz = Math.cos(k.h), px = Math.cos(k.h), pz = -Math.sin(k.h);
      const drifting = drift && Math.abs(steer) > 0 && k.v > 12;
      if (drifting || (off && k.v > 6)) for (const side of [-0.95, 0.95]) {
        const x = k.position.x + sx * back + px * side, z = k.position.z + cz * back + pz * side;
        if (Math.random() < (drifting ? 0.8 : 0.5)) this.fx.puff(x, 0.35, z, off ? [0.62, 0.43, 0.28] : [0.88, 0.88, 0.88], off ? 1.6 : 1.3, off ? 0.8 : 1.4);
        if (drifting && !off) this.fx.mark(x, z, k.h);
      }
      if (!isAI) { k._drifting = drifting; k._off = off; }
    }
    k.rotation.y = k.h + (drift && Math.abs(steer) > 0 ? steer * 0.35 : 0);
    k.wheels.forEach((w) => { w.rotation.x += k.v * dt / 0.42; });
    // laps: must pass the far side before the line counts
    const prog = on.i / SAMPLES; if (prog > 0.45 && prog < 0.55) k.passedHalf = true;
    if (k.lastProg != null && k.lastProg > 0.9 && prog < 0.1 && k.passedHalf) { k.passedHalf = false; k.lapEvent = true; }
    k.lastProg = prog; k.s = (k.lap - 1) + prog; return on;
  }
  aiDrive(k, dt) {
    const look = (k.idx + 5 + Math.floor(k.v / 6)) % SAMPLES, p = this.samples[look], t = this.tangents[look];
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
        if (left !== this._lastLeft) { this._lastLeft = left; if (left >= 1 && left <= 3) this.audio.beep(false); else if (left <= 0) this.audio.beep(true); }
        count.innerHTML = left > 3 ? '' : left > 0 ? `<b class="pop">${left}</b>` : '<b class="pop go">GO!</b>';
        if (left <= 0) { this.phase = 'race'; this.t0 = startAt; this.lapStart = startAt; this.buzz(40); setTimeout(() => { count.innerHTML = ''; }, 700); } }
      else count.innerHTML = '<b style="font-size:22px">Waiting for the host…</b>';
    }
    if (this.paused) { this.audio.update(0, false, false, false, true); this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.loop); return; }
    if (this.phase === 'race' || this.phase === 'done') {
      const steer = this.steerMode === 'tilt' ? Math.max(-1, Math.min(1, this.tilt)) : (this.input.l ? 1 : 0) - (this.input.r ? 1 : 0);
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
      if (this.fx) this.fx.update(dt);
      const P = this.player; this.audio.update(P.v, !this.input.brake, P._drifting, P._off, false);
      // wrong way: facing against the circuit for more than a second
      const t = this.tangents[P.idx], dot = Math.sin(P.h) * t.x + Math.cos(P.h) * t.z;
      // counted in real time, so a slow phone shows it as quickly as a fast one
      if (dot < -0.3 && P.v > 4 && this.phase === 'race') { this._wrongSince = this._wrongSince || now; } else this._wrongSince = 0;
      this.el.querySelector('#wrong').classList.toggle('on', !!this._wrongSince && now - this._wrongSince > 1000);
      // overtakes and being overtaken
      if (this.phase === 'race' && (this.bots.length || Object.keys(this.remotes).length)) { const place = this.placing(); if (this._place && place !== this._place && now - (this._placeAt || 0) > 900) { this.callout(place < this._place ? '▲ ' + this.ord(place) : '▼ ' + this.ord(place), place < this._place); this.audio.overtake(place < this._place); this._placeAt = now; } this._place = place; }
      this.el.querySelector('#lines').classList.toggle('on', P.boost > 0);
      const others = [...this.bots, ...Object.values(this.remotes).map((r) => r.kart).filter(Boolean)];
      for (const o of others) {
        const dx = o.position.x - P.position.x, dz = o.position.z - P.position.z, dist = Math.hypot(dx, dz);
        const ahead = dx * Math.sin(P.h) + dz * Math.cos(P.h), side = dx * Math.cos(P.h) - dz * Math.sin(P.h);
        if (o._ahead != null && Math.sign(ahead) !== Math.sign(o._ahead) && dist < 9) this.audio.passBy(Math.max(-1, Math.min(1, -side / 4)), Math.abs((o.v || 0) - P.v));
        o._ahead = ahead;
      }
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
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const s = this.shake * 0.6; this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s; }
    if (this.sun.castShadow) { this.sun.position.copy(k.position).addScaledVector(this.sunDir, 300); this.sun.target.position.copy(k.position); } // shadows follow the kart
    this.camera.lookAt(k.position.x + Math.sin(k.h) * 12, 1.2, k.position.z + Math.cos(k.h) * 12);
    const fov = 62 + Math.min(14, k.v * 0.3) + (k.boost > 0 ? 6 : 0); if (Math.abs(fov - this.camera.fov) > 0.3) { this.camera.fov += (fov - this.camera.fov) * 0.1; this.camera.updateProjectionMatrix(); }
    if (k.flame) { k.flame.visible = k.boost > 0 || k.drift > 0.55; k.flame.material.color.set(k.boost > 0 ? '#FFB020' : '#40B4FF'); k.flame.scale.z = 0.8 + Math.random() * 0.5; }
  }
  separate() {
    const all = [this.player, ...this.bots];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j]; const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, d = Math.hypot(dx, dz); if (d > 0 && d < 2.6) { const push = (2.6 - d) / 2; a.position.x -= dx / d * push; a.position.z -= dz / d * push; b.position.x += dx / d * push; b.position.z += dz / d * push; a.v *= 0.985; b.v *= 0.985; } }
  }
  flagWave(now) { if (this.flags) this.flags.forEach((f, i) => { const p = f.geometry.attributes.position; for (let j = 0; j < p.count; j++) { const x = p.getX(j); p.setZ(j, Math.sin(now / 260 + x * 1.3 + i) * 0.25 * (x + 3) / 6); } p.needsUpdate = true; }); }

  completeLap(now) {
    const k = this.player; k.lapEvent = false;
    const lapMs = Math.round(now - this.lapStart); this.lapStart = now; this.lapTimes.push(lapMs);
    const pb = this.bestLap == null || lapMs < this.bestLap;
    if (pb) { this.bestLap = lapMs; this.bestPath = this.recording.filter((_, i) => i % 6 === 0); }
    this.recording = [];
    k.lap++;
    if (k.lap <= LAPS) this.audio.lap();
    this.flash(k.lap > LAPS ? 'FINISH!' : `LAP ${k.lap}/${LAPS}${pb && this.lapTimes.length > 1 ? ' · best lap!' : ''}`);
    if (k.lap > LAPS) this.finish(now);
  }
  async finish(now) {
    this.phase = 'done'; const raceMs = Math.round(now - this.t0);
    const place = this.placing(); this.buzz(80); this.audio.finish(this.mode === 'solo' || place === 1);
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
  nearLandmark(i) { const l = this.landmarkAt.find((x) => Math.abs(x.s - i) < 22 || Math.abs(x.s - i) > SAMPLES - 22); const box = this.el.querySelector('#land'); const name = l ? l.name : ''; if (name !== this._land) { this._land = name; box.textContent = name; box.classList.toggle('on', !!name); } }
  buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }
  callout(text, good) { const c = this.el.querySelector('#callout'); c.textContent = text; c.className = 'kart-callout on ' + (good ? 'up' : 'down'); clearTimeout(this._co); this._co = setTimeout(() => { c.className = 'kart-callout'; }, 1300); }

  /** Pause: freezes the race and its clock. Online races keep going for everyone else, so they only show the menu. */
  togglePause() {
    if (this.phase === 'done') return;
    const box = this.el.querySelector('#pausebox'); const online = this.mode === 'room';
    if (!this.paused && !box.classList.contains('on')) {
      if (!online) { this.paused = true; this._pausedAt = performance.now(); }
      const L = (() => { try { return localStorage.getItem('buja_kart_orient'); } catch { return null; } })() === 'landscape';
      box.innerHTML = `<div class="kart-card"><div class="kart-big">${online ? 'Menu' : 'Paused'}</div>${online ? '<div class="kart-sub">The race carries on for your friends.</div>' : ''}
        <div class="kart-actions">
          <button class="btn btn-primary" data-p="resume">▶ Resume</button>
          ${online ? '' : '<button class="btn btn-outline" data-p="restart">↻ Restart race</button>'}
          <div class="kart-toggles">
            <button class="kart-tg ${this.audio.sfxOn ? 'on' : ''}" data-p="sfx">🔊 Sound</button><button class="kart-tg ${this.audio.musicOn ? 'on' : ''}" data-p="music">🎵 Music</button>
            <button class="kart-tg ${L ? 'on' : ''}" data-p="rotate">⟲ Landscape</button><button class="kart-tg ${this.steerMode === 'tilt' ? 'on' : ''}" data-p="tilt">📱 Tilt to steer</button>
          </div>
          <button class="btn btn-ghost" data-p="quit">Leave the race</button></div></div>`;
      box.classList.add('on');
      box.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', async () => {
        this.audio.wake(); this.audio.click(); const a = b.dataset.p;
        if (a === 'resume') this.togglePause();
        else if (a === 'restart') location.reload();
        else if (a === 'quit') this.go(online ? '/kart/room/' + this.code : '/kart');
        else if (a === 'sfx') { this.audio.setSfx(!this.audio.sfxOn); b.classList.toggle('on', this.audio.sfxOn); }
        else if (a === 'music') { this.audio.setMusic(!this.audio.musicOn); b.classList.toggle('on', this.audio.musicOn); }
        else if (a === 'rotate') { const on = !b.classList.contains('on'); b.classList.toggle('on', on); await this.setLandscape(on); }
        else if (a === 'tilt') { const on = this.steerMode !== 'tilt'; const ok = await this.enableTilt(on); b.classList.toggle('on', ok && on); }
      }));
    } else {
      box.classList.remove('on'); box.innerHTML = '';
      if (this.paused) { const gap = performance.now() - this._pausedAt; this.paused = false; if (this.t0) this.t0 += gap; if (this.lapStart) this.lapStart += gap; if (this.countFrom) this.countFrom += gap; this.clock.getDelta(); this.bots.forEach((b) => { if (b.finished) b.finished += 0; }); }
    }
  }
  /** Landscape: full screen and locked sideways where the phone allows it (Android, installed app); otherwise ask to rotate. */
  async setLandscape(on, quiet = false) {
    try { localStorage.setItem('buja_kart_orient', on ? 'landscape' : 'portrait'); } catch {}
    try {
      if (on) { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); }
      else { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); if (document.fullscreenElement) await document.exitFullscreen(); }
    } catch { if (on && !quiet) this.toast('Turn your phone sideways. On iPhone, switch off rotation lock first.'); }
    setTimeout(() => this.resize(), 400);
  }
  /** Tilt steering: lean the phone like a steering wheel. iPhones ask permission first. */
  async enableTilt(on) {
    if (!on) { this.steerMode = 'buttons'; try { localStorage.setItem('buja_kart_steer', 'buttons'); } catch {} window.removeEventListener('deviceorientation', this._tilt); this.el.classList.remove('kart-tiltmode'); return true; }
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { this.toast('Tilt needs motion access. Using buttons.'); return false; } } } catch {}
    this._tilt = (e) => { const landscape = innerWidth > innerHeight; const a = landscape ? (e.beta || 0) * ((screen.orientation && screen.orientation.angle === 270) ? -1 : 1) : (e.gamma || 0); this.tilt = -Math.max(-1, Math.min(1, a / 22)); if (Math.abs(this.tilt) < 0.08) this.tilt = 0; };
    window.addEventListener('deviceorientation', this._tilt);
    this.steerMode = 'tilt'; try { localStorage.setItem('buja_kart_steer', 'tilt'); } catch {} this.el.classList.add('kart-tiltmode'); return true;
  }
  /** Guard rails where the track edge stops you: red and white Armco panels, one draw call. */
  buildBarriers() {
    const pos = [], col = [], idx = []; const off = ROAD_W / 2 + 9.4;
    for (const side of [-1, 1]) for (let i = 0; i < SAMPLES; i++) {
      const a = this.samples[i], b = this.samples[(i + 1) % SAMPLES], t = this.tangents[i], nx = -t.z * side * off, nz = t.x * side * off, v = pos.length / 3;
      if (this.nearest(a.x + nx, a.z + nz).dist < off - 3) continue;   // where another part of the track comes close, no rail across it
      pos.push(a.x + nx, 0.35, a.z + nz, a.x + nx, 1.15, a.z + nz, b.x + nx, 0.35, b.z + nz, b.x + nx, 1.15, b.z + nz);
      const c = Math.floor(i / 2) % 2 ? [0.8, 0.12, 0.12] : [0.93, 0.93, 0.93]; for (let q = 0; q < 4; q++) col.push(...c);
      idx.push(...(side > 0 ? [v, v + 1, v + 2, v + 1, v + 3, v + 2] : [v, v + 2, v + 1, v + 1, v + 2, v + 3]));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide })); m.castShadow = this.tier === 'high'; this.scene.add(m);
  }

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

/* ================================================================================================ */
/*                                     helpers for the world                                        */
/* ================================================================================================ */
/** Graphics quality: low for small or weak phones, high for strong ones; the menu can override it. */
function pickTier() {
  const saved = (() => { try { return localStorage.getItem('buja_kart_gfx'); } catch { return null; } })();
  if (saved && saved !== 'auto') return saved;
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  let gpu = ''; try { const c = document.createElement('canvas').getContext('webgl'); const e = c.getExtension('WEBGL_debug_renderer_info'); gpu = e ? String(c.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch {}
  if (/SwiftShader|llvmpipe/i.test(gpu)) return 'low';
  if (mem <= 3 || cores <= 4 || /Mali-(G5[0-9]|T|4)|PowerVR|Adreno \(TM\) [3-5]/i.test(gpu)) return mem >= 4 && !/Mali-(T|4)|PowerVR/i.test(gpu) ? 'medium' : 'low';
  return mem >= 6 && cores >= 8 ? 'high' : 'medium';
}
async function loadTextures(renderer, tier) {
  const L = new THREE.TextureLoader(); const aniso = Math.min(tier === 'low' ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
  const get = (f, srgb = true, rep = [1, 1]) => new Promise((res) => L.load(TEX + f, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(...rep); res(t); }, undefined, () => res(null)));
  const [asphalt, asphaltN, grass, pave, rock, facades] = await Promise.all([get('asphalt.jpg'), tier === 'low' ? null : get('asphalt_n.jpg', false), get('grass.jpg'), get('pave.jpg'), get('rock.jpg'), get('facades.jpg')]);
  // road textures repeat every 8 m along the road; UVs are in metres
  [asphalt, asphaltN].forEach((t) => t && t.repeat.set(1 / 8, 1 / 8)); pave && pave.repeat.set(1 / 3, 1 / 3);
  if (facades) { facades.wrapS = facades.wrapT = THREE.ClampToEdgeWrapping; }
  return { asphalt, asphaltN, grass, pave, rock, facades };
}
/** A rock mass: a sphere pushed out by layered noise, flattened at the base (Aso Rock, Zuma Rock). */
function rockGeometry(detail, flat, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail); const p = g.attributes.position; const v = new THREE.Vector3();
  const n3 = (x, y, z) => Math.sin(x * 3.1 + seed) * Math.cos(y * 2.3 - seed) * 0.5 + Math.sin(z * 4.7 + x * 1.3 + seed * 2) * 0.3 + Math.sin((x + y + z) * 9.1) * 0.08;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const r = 1 + 0.22 * n3(v.x, v.y, v.z); v.multiplyScalar(r); if (v.y < 0) v.y *= 0.08; else v.y *= flat; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function flagTexture() { const c = document.createElement('canvas'); c.width = 96; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#008751'; g.fillRect(0, 0, 96, 48); g.fillStyle = '#FFFFFF'; g.fillRect(32, 0, 32, 48); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
/** Merge plain BufferGeometries (position/normal/uv) into one, so many pieces cost one draw call. */
function mergeGeos(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g)); const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    if (!geos.every((g) => g.attributes[name])) continue;
    const size = geos[0].attributes[name].itemSize; const total = geos.reduce((s, g) => s + g.attributes[name].array.length, 0); const arr = new Float32Array(total); let o = 0;
    geos.forEach((g) => { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }); out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  if (!out.attributes.normal) out.computeVertexNormals(); return out;
}

/* ================================================================================================ */
/*                     Sound: generated live with Web Audio, nothing to download                     */
/* ================================================================================================ */
class KartAudio {
  constructor() {
    const pref = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } };
    this.sfxOn = pref('buja_kart_sfx', true); this.musicOn = pref('buja_kart_music', true); this.ctx = null;
  }
  /** Browsers only allow sound after a tap, so this is called from the first touch and from the menu buttons. */
  wake() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
        this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
        this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0; this.mus.connect(this.master);
        const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
        // engine: two detuned oscillators through a low-pass filter that opens with revs
        this.eng = c.createGain(); this.eng.gain.value = 0; this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 500; this.engF.Q.value = 3;
        this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'square'; this.o2.detune.value = 9;
        const og = c.createGain(); og.gain.value = 0.45; this.o1.connect(this.engF); this.o2.connect(og); og.connect(this.engF); this.engF.connect(this.eng); this.eng.connect(this.sfx); this.o1.start(); this.o2.start();
        // tyre squeal: band-passed noise
        this.sk = c.createGain(); this.sk.gain.value = 0; const sn = c.createBufferSource(); sn.buffer = nb; sn.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6; sn.connect(bp); bp.connect(this.sk); this.sk.connect(this.sfx); sn.start();
        // tyres on grass or laterite: low rumble
        this.rum = c.createGain(); this.rum.gain.value = 0; const rn = c.createBufferSource(); rn.buffer = nb; rn.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; rn.connect(lp); lp.connect(this.rum); this.rum.connect(this.sfx); rn.start();
        if (this.musicOn) this.startMusic();
        this.loadSamples();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {}
  }
  /** Real recordings: a go-kart engine loop, a drive-by and a rev. The generated engine stays as the fallback. */
  async loadSamples() {
    const c = this.ctx; const get = async (f) => { try { const r = await fetch(TEX + 'sfx/' + f); const data = await r.arrayBuffer(); return await new Promise((res, rej) => c.decodeAudioData(data, res, rej)); } catch { return null; } };
    const [engine, pass, rev] = await Promise.all([get('engine.mp3'), get('pass.mp3'), get('rev.mp3')]);
    this.bufPass = pass; this.bufRev = rev;
    if (engine && this.ctx) {
      this.engS = c.createGain(); this.engS.gain.value = 0; this.engS.connect(this.sfx);
      this.engSrc = c.createBufferSource(); this.engSrc.buffer = engine; this.engSrc.loop = true; this.engSrc.connect(this.engS); this.engSrc.start();
      this.eng.gain.setTargetAtTime(0, c.currentTime, 0.2); this.sampled = true;          // the recording takes over from the generated note
    }
  }
  play(buf, { vol = 0.6, rate = 1, pan = 0 } = {}) {
    if (!this.ctx || !buf) return false; const c = this.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); s.connect(g); g.connect(p); p.connect(this.sfx); } else { s.connect(g); g.connect(this.sfx); }
    s.start(); return true;
  }
  /** A kart going past: pan follows the side it passes on, pitch follows how fast it is closing. */
  passBy(pan, closing) { if (this._passAt && performance.now() - this._passAt < 1400) return; this._passAt = performance.now(); if (!this.play(this.bufPass, { vol: 0.55, rate: Math.max(0.8, Math.min(1.35, 1 + closing / 40)), pan })) this.tone(300, 0.5, 'sawtooth', 0.06, 0, -180); }
  rev() { if (!this.play(this.bufRev, { vol: 0.5, rate: 1.05 })) this.tone(120, 0.6, 'sawtooth', 0.08, 0, 260); }
  setSfx(on) { this.sfxOn = on; try { localStorage.setItem('buja_kart_sfx', on ? '1' : '0'); } catch {} if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on) { this.musicOn = on; try { localStorage.setItem('buja_kart_music', on ? '1' : '0'); } catch {} if (!this.ctx) return; this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.1); if (on) this.startMusic(); }
  /** Called every frame: engine pitch follows speed, squeal follows drift, rumble follows grass. */
  update(v, throttle, drifting, offroad, paused) {
    if (!this.ctx) return; const t = this.ctx.currentTime, r = Math.min(1, v / 40);
    const f = 48 + r * 150 + (throttle ? 8 : 0); this.o1.frequency.setTargetAtTime(f, t, 0.06); this.o2.frequency.setTargetAtTime(f * 2.005, t, 0.06);
    this.engF.frequency.setTargetAtTime(380 + r * 1700 + (throttle ? 250 : 0), t, 0.08);
    if (this.sampled) { this.engSrc.playbackRate.setTargetAtTime(0.6 + r * 0.9 + (throttle ? 0.05 : 0), t, 0.08); this.engS.gain.setTargetAtTime(paused ? 0 : 0.32 + r * 0.3, t, 0.1); }
    else this.eng.gain.setTargetAtTime(paused ? 0 : 0.07 + r * 0.09, t, 0.1);
    this.sk.gain.setTargetAtTime(!paused && drifting && v > 12 ? 0.07 : 0, t, 0.05);
    this.rum.gain.setTargetAtTime(!paused && offroad && v > 3 ? 0.35 * r + 0.08 : 0, t, 0.08);
  }
  tone(freq, dur, type = 'sine', vol = 0.25, when = 0, slide = 0, out = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(out || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.2, freq = 1000, when = 0, type = 'bandpass', out = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  beep(go) { this.tone(go ? 880 : 440, go ? 0.55 : 0.22, 'square', 0.14); if (go) this.rev(); }
  boost() { this.noise(0.5, 0.18, 900, 0, 'highpass'); this.rev(); }
  bump() { this.tone(90, 0.18, 'sine', 0.35, 0, -40); this.noise(0.12, 0.2, 300, 0, 'lowpass'); }
  lap() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.2, i * 0.11)); }
  overtake(up) { this.tone(up ? 660 : 330, 0.16, 'triangle', 0.15); this.tone(up ? 990 : 262, 0.2, 'triangle', 0.15, 0.1); }
  finish(win) { const n = win ? [523, 659, 784, 1047, 784, 1047] : [392, 494, 587, 784]; n.forEach((f, i) => this.tone(f, 0.34, 'triangle', 0.22, i * 0.14)); this.tone(win ? 1047 : 784, 1.2, 'sine', 0.12, n.length * 0.14); }
  click() { this.tone(1200, 0.05, 'square', 0.05); }
  /** A light groove to race to: kick, clap, shaker, a talking-drum bend and a bass line, scheduled ahead of time. */
  startMusic() {
    if (!this.ctx || this._musicT) return; const c = this.ctx, bpm = 112, step = 60 / bpm / 4; let n = 0, next = c.currentTime + 0.1;
    const bass = [55, 0, 0, 65.4, 0, 73.4, 0, 0, 55, 0, 82.4, 0, 73.4, 0, 65.4, 0];
    const tick = () => {
      if (!this.musicOn) { this._musicT = null; return; }
      while (next < c.currentTime + 0.25) {
        const s = n % 16, w = next - c.currentTime;
        if (s % 8 === 0) this.tone(58, 0.35, 'sine', 0.9, w, -30, this.mus);                    // kick
        if (s === 4 || s === 12) this.noise(0.14, 0.5, 1400, w, 'bandpass', this.mus);           // clap
        this.noise(0.05, s % 2 ? 0.12 : 0.22, 8000, w, 'highpass', this.mus);                    // shaker
        if (s === 6 || s === 14 || s === 10) this.tone(s === 10 ? 330 : 220, 0.22, 'sine', 0.35, w, s === 10 ? -140 : 120, this.mus); // talking drum bend
        if (bass[s]) this.tone(bass[s], step * 1.8, 'triangle', 0.55, w, 0, this.mus);
        next += step; n++;
      }
      this._musicT = setTimeout(tick, 60);
    };
    tick();
  }
  stop() { try { this.musicOn = false; clearTimeout(this._musicT); this._musicT = null; this.ctx && this.ctx.close(); } catch {} this.ctx = null; }
}

/* ================================================================================================ */
/*                  Effects: smoke, dust and skid marks, each a single draw call                     */
/* ================================================================================================ */
class KartFX {
  constructor(scene, tier) {
    this.scene = scene; const N = this.N = tier === 'low' ? 60 : 140;
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.size = new Float32Array(N); this.alpha = new Float32Array(N); this.life = new Float32Array(N); this.vel = new Float32Array(N * 3); this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { scale: { value: 400 } },
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.0, d)); }' });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
    // skid marks: a ring of thin dark quads laid on the road
    const S = this.S = tier === 'low' ? 120 : 260; this.si = 0;
    const q = new THREE.PlaneGeometry(0.34, 1.1); q.rotateX(-Math.PI / 2);
    this.skid = new THREE.InstancedMesh(q, new THREE.MeshBasicMaterial({ color: '#0d0d0f', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), S);
    this.skid.count = 0; this.skid.frustumCulled = false; scene.add(this.skid); this.m4 = new THREE.Matrix4(); this.qq = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0);
  }
  puff(x, y, z, colour, size, vy = 1.2) {
    const i = this.next++ % this.N; this.pos.set([x, y, z], i * 3); this.col.set(colour, i * 3); this.size[i] = size; this.alpha[i] = 0.55; this.life[i] = 1;
    this.vel.set([(Math.random() - 0.5) * 1.5, vy * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 1.5], i * 3);
  }
  mark(x, z, heading) {
    const i = this.si++ % this.S; this.qq.setFromAxisAngle(this.up, heading); this.m4.compose(new THREE.Vector3(x, 0.07, z), this.qq, new THREE.Vector3(1, 1, 1));
    this.skid.setMatrixAt(i, this.m4); this.skid.count = Math.min(this.S, this.si); this.skid.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.N; i++) { if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt * 0.9; this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += dt * 2.2; this.alpha[i] = Math.max(0, this.life[i] * 0.55); }
    const g = this.points.geometry; g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = g.attributes.color.needsUpdate = true;
  }
}
