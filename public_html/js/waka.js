import { createMap, pinHtml, meHtml, bottomSheet } from './map.js';
// Buja Waka: routes, fares, planner. Registered into the app router by app.js.
export function registerWaka({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon , placeHref } = ui;
  const naira = (n) => n == null ? '₦?' : '₦' + Number(n).toLocaleString('en-NG');
  const modeIcon = { bus: 'bus', along: 'car', keke: 'car', taxi: 'car', train: 'route' };
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');

  const MODE_ICON = { bus: 'bus', along: 'car-side', keke: 'motorcycle', taxi: 'car-side', train: 'train' };
  const MODE_COLOR = { bus: '#2E7D1E', along: '#FF7A1A', keke: '#B7791F', taxi: '#101014', train: '#1F5FBF' };
  /** Draws journey legs on the shared Buja map: real road lines through each leg's stops, a pin per boarding and
   *  alighting point with the mode's icon, small dots for the stops in between, and riders on board right now. */
  async function drawMap(el, legs, focus) {
    const box = el.querySelector('#map'); if (!box) return;
    const map = await createMap(box, { zoom: 12, interactive: true });
    if (!map) { box.innerHTML = `<div class="placeholder" style="height:100%;padding:20px"><div class="small muted">Map could not load on this phone. The route steps below still work.</div></div>`; return; }
    const all = [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i]; const path = (leg.path && leg.path.length ? leg.path : [leg.from, leg.to]).filter(Boolean);
      const color = leg.color || MODE_COLOR[leg.mode] || '#FF7A1A';
      path.forEach((p) => all.push([p.lng, p.lat]));
      let coords = leg.geometry && leg.geometry.length > 1 ? leg.geometry.map((p) => [p[1], p[0]]) : null;
      if (!coords) {
        const pts = path.length > 12 ? path.filter((_, k) => k === 0 || k === path.length - 1 || k % Math.ceil(path.length / 10) === 0).slice(0, 12) : path;
        try { const r = await api.road(pts.map((p) => [p.lat, p.lng])); if (r.coords && r.coords.length > 1 && r.source !== 'straight') coords = r.coords; } catch {}
      }
      map.line('leg' + i, coords || path.map((p) => [p.lng, p.lat]), { color, width: 6, dashed: !coords || leg.mode === 'taxi' });
      path.forEach((p, k) => {
        const end = k === 0 || k === path.length - 1;
        if (end) map.marker(`s${i}_${k}`, { lng: p.lng, lat: p.lat, z: 3, html: pinHtml({ iconName: k === 0 ? (MODE_ICON[leg.mode] || 'location-dot') : (i === legs.length - 1 ? 'flag-checkered' : 'arrow-right'), color: k === 0 ? color : '#101014', size: 34, label: p.name, sub: k === 0 ? (leg.modeLabel || '') : '', badge: k === 0 && leg.ridersNow ? leg.ridersNow + ' on it' : '' }) });
        else map.marker(`s${i}_${k}`, { lng: p.lng, lat: p.lat, z: 1, anchor: 'center', html: `<div title="${h(p.name)}" style="width:12px;height:12px;border-radius:6px;background:#fff;border:3px solid ${color}"></div>` });
      });
    }
    if (focus) { all.push([focus.lng, focus.lat]); map.marker('focus', { lng: focus.lng, lat: focus.lat, z: 4, html: pinHtml({ iconName: 'location-dot', color: '#FF7A1A', label: focus.name }) }); }
    map.fit(all, { bottom: 30, top: 30 });
  }

  /* ---------- Place picker ---------- */
  const kmBetween = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const distTxt = (d) => d < 1 ? Math.round(d * 1000 / 10) * 10 + ' m' : d.toFixed(1) + ' km';
  const here = (ms = 8000) => new Promise((res) => { if (!navigator.geolocation) return res(null); let done = false; const f = (v) => { if (!done) { done = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 60000 }); });
  function picker(el, onPick, me) {
    const sheet = el.querySelector('#picker');
    return async (title) => {
      let { places } = await api.wakaPlaces();
      if (me) places = places.map((p) => ({ ...p, _d: kmBetween(me.lat, me.lng, p.lat, p.lng) })).sort((a, b) => a._d - b._d);
      sheet.innerHTML = `<div style="position:fixed;inset:0;background:var(--surface);z-index:30;display:flex;flex-direction:column;max-width:480px;margin:0 auto">
        <header class="topbar"><button class="iconbtn" id="pclose" aria-label="Close">${icon('arrow-left')}</button><h1>${h(title)}</h1></header>
        <div class="pad stack" style="gap:10px"><div class="card row" style="height:48px;padding:0 16px"><label for="pq" style="position:absolute;left:-9999px">Search places</label>${icon('magnifying-glass')}<input id="pq" type="search" placeholder="Park, junction, landmark" autofocus style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div>
        <button class="btn btn-outline" id="pgps" style="height:46px">${icon('location-dot')} Use where I am now</button><div class="small muted center" id="pgpsmsg"></div></div>
        <div id="plist" class="pad stack" style="gap:6px;padding-top:12px;overflow-y:auto;flex:1"></div></div>`;
      const list = sheet.querySelector('#plist');
      const render = (v) => { const vv = v.trim().toLowerCase(); const rows = places.filter((p) => !vv || p.name.toLowerCase().includes(vv) || p.district.toLowerCase().includes(vv)); list.innerHTML = rows.map((p) => `<button class="card row" data-p="${p.id}" style="padding:12px 14px;text-align:left;width:100%;gap:12px"><span class="iconbtn" style="width:36px;height:36px;font-size:14px;color:${p.kind === 'park' ? 'var(--orange-dark)' : 'var(--ink-3)'}">${icon(p.kind === 'park' ? 'bus' : 'location-dot')}</span><span class="grow"><span style="font-size:15px;font-weight:600;display:block">${h(p.name)}</span><span class="small muted">${h(p.district)}${p.kind === 'park' ? ' · motor park' : ''}${p._d != null ? ' · ' + distTxt(p._d) + ' away' : ''}</span></span></button>`).join('') || `<div class="small muted center" style="padding:30px 0">No place found. More stops are added as riders suggest them.</div>`; };
      render('');
      sheet.querySelector('#pq').addEventListener('input', (e) => render(e.target.value));
      sheet.querySelector('#pgps').addEventListener('click', (e) => {
        const btn = e.currentTarget, msg = sheet.querySelector('#pgpsmsg');
        if (!navigator.geolocation) { msg.textContent = 'This phone cannot share location.'; return; }
        busy(btn, true); msg.textContent = 'Finding you…';
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude: la, longitude: lo } = pos.coords;
          const km = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
          const ranked = places.map((p) => ({ p, d: km(la, lo, p.lat, p.lng) })).sort((x, y) => x.d - y.d);
          const near = ranked.slice(0, 6);
          busy(btn, false);
          msg.textContent = near[0].d < 1 ? `You are about ${Math.round(near[0].d * 1000)} m from ${near[0].p.name}` : `Nearest stop is ${near[0].p.name}, about ${near[0].d.toFixed(1)} km away`;
          list.innerHTML = near.map(({ p, d }) => `<button class="card row" data-p="${p.id}" style="padding:12px 14px;text-align:left;width:100%;gap:12px"><span class="iconbtn" style="width:36px;height:36px;font-size:14px;color:${p.kind === 'park' ? 'var(--orange-dark)' : 'var(--ink-3)'}">${icon(p.kind === 'park' ? 'bus' : 'location-dot')}</span><span class="grow"><span style="font-size:15px;font-weight:600;display:block">${h(p.name)}</span><span class="small muted">${h(p.district)} · ${d < 1 ? Math.round(d * 1000) + ' m away' : d.toFixed(1) + ' km away'}</span></span></button>`).join('');
          api.setLocation(la, lo).catch(() => {});
        }, () => { busy(btn, false); msg.textContent = 'Could not get your location. Check the permission for this site.'; }, { enableHighAccuracy: true, timeout: 12000 });
      });
      sheet.querySelector('#pclose').addEventListener('click', () => { sheet.innerHTML = ''; });
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; const p = places.find((x) => x.id === +b.dataset.p); sheet.innerHTML = ''; onPick(p); });
    };
  }

  /* ---------- Home of Waka: plan a trip ---------- */
  route('/waka', { auth: true, tabs: '' }, async () => {
    const [{ saved }, { routes }] = await Promise.all([api.wakaSaved(), api.wakaRoutes()]);
    const busy_ = routes.slice().sort((a, b) => b.ridersNow - a.ridersNow).slice(0, 6);
    return `
    ${topbar('Waka', '/home', `<a class="iconbtn" href="#/waka/routes" aria-label="All routes">${icon('route')}</a>`)}
    <main class="pad stack" style="gap:16px">
      <div class="card stack" style="padding:16px;gap:10px">
        <button class="row" id="from" style="height:52px;padding:0 14px;background:var(--surface);border:1px solid var(--line);border-radius:14px;width:100%;text-align:left;gap:12px"><span style="width:10px;height:10px;border-radius:5px;background:var(--ink)"></span><span class="grow" id="fromName" style="font-size:15px;color:var(--ink-3)">Where from?</span></button>
        <div class="row" style="gap:10px"><div style="flex:1;height:1px;background:var(--line)"></div><button class="iconbtn" id="swap" aria-label="Swap from and to" style="width:36px;height:36px">${icon('arrows-up-down')}</button></div>
        <button class="row" id="to" style="height:52px;padding:0 14px;background:var(--surface);border:1px solid var(--line);border-radius:14px;width:100%;text-align:left;gap:12px"><span style="width:10px;height:10px;border-radius:5px;background:var(--orange)"></span><span class="grow" id="toName" style="font-size:15px;color:var(--ink-3)">Where to?</span></button>
        <div class="small muted" id="nearmsg" style="line-height:1.45;margin-top:-2px"></div>
        <button class="btn btn-primary" id="plan" disabled>${icon('route')} Find the way</button>
        <div id="popular"></div>
        <a class="row" href="#/waka/map" style="gap:10px;padding:10px 12px;border-radius:14px;background:var(--night);color:#fff;text-decoration:none"><span style="width:34px;height:34px;border-radius:10px;background:rgba(126,217,87,.16);color:#7ED957;display:flex;align-items:center;justify-content:center">${icon('map-location-dot')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:700">Live Waka map</span><span class="small" style="color:#9AA0AB">Stops near you, road alerts, riders on routes now</span></span>${icon('chevron-right')}</a>
      </div>
      <div id="recent"></div>
      ${saved.length ? `<div class="stack" style="gap:10px"><div class="section">SAVED</div><div class="card list">${saved.map((s) => `<a class="item" href="#/waka/plan?from=${s.from}&to=${s.to}"><div class="mi">${icon('bookmark')}</div><div class="grow"><div class="t">${h(s.label || s.fromName + ' to ' + s.toName)}</div><div class="s">${h(s.fromName)} → ${h(s.toName)}</div></div>${icon('chevron-right')}</a>`).join('')}</div></div>` : ''}
      <div class="stack" style="gap:10px"><div class="section">ROUTES RIGHT NOW</div>
        <div class="card list">${busy_.map((r) => `<a class="item" href="#/waka/route/${r.id}"><div class="mi" style="color:${r.color}">${icon(modeIcon[r.mode])}</div><div class="grow"><div class="t">${h(r.name)}</div><div class="s">${r.modeLabel} · ${naira(r.fare.amount)}${r.fare.confirmed ? '' : ' est.'} · ${r.stops.length} stops</div></div>${r.ridersNow ? `<span class="tag green">${r.ridersNow} now</span>` : ''}${icon('chevron-right')}</a>`).join('')}</div>
        <a class="card row" href="#/waka/alerts" style="padding:14px;gap:12px"><span style="width:38px;height:38px;border-radius:12px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('triangle-exclamation')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:650">Roads right now</span><span class="small muted">Traffic, floods, checkpoints, reported by riders</span></span>${icon('chevron-right')}</a>
      <div class="card stack" style="padding:14px;gap:8px"><div class="h-sm">How fares work here</div><div class="small muted" style="line-height:1.55"><strong style="color:var(--ink)">Green bus</strong> is the government AUMTCO bus. Cheapest by far, but few run, so expect a queue.<br><strong style="color:var(--ink)">Along cab</strong> is the shared taxi, four passengers, often someone going to work anyway. Three to five times the bus fare but it leaves when it fills.<br><strong style="color:var(--ink)">Light rail</strong> is free at the moment, four trips a day, weekdays only.<br>Fares marked est. are starting points; when riders report what they paid, the real fare replaces them.</div></div>
      </div>
    </main>
    <div id="picker"></div>`;
  }, {
    async mount(el) {
      let from = null, to = null, me = null, auto = false;
      const RK = 'buja_waka_recent';
      const recents = () => { try { return JSON.parse(localStorage.getItem(RK) || '[]') || []; } catch { return []; } };
      const qf = q().get('from'), qt = q().get('to'), toq = q().get('toq');
      const set = () => {
        el.querySelector('#fromName').textContent = from ? from.name : 'Where from?'; el.querySelector('#fromName').style.color = from ? 'var(--ink)' : '';
        el.querySelector('#toName').textContent = to ? to.name : 'Where to?'; el.querySelector('#toName').style.color = to ? 'var(--ink)' : '';
        el.querySelector('#plan').disabled = !(from && to && from.id !== to.id);
        const m = el.querySelector('#nearmsg');
        if (m) m.innerHTML = from && me ? (() => { const d = kmBetween(me.lat, me.lng, from.lat, from.lng); const walk = Math.max(1, Math.round(d * 1000 / 80)); return `${auto ? 'Starting from the nearest stop to you, ' : ''}${h(from.name)} is ${distTxt(d)} from you${d < 3 ? ', about ' + walk + ' min on foot' : ''}. <a href="${h(placeHref({ lat: from.lat, lng: from.lng, name: from.name, sub: from.district || '', icon: from.kind === 'park' ? 'bus' : 'location-dot', color: '#2E7D1E' }))}" style="font-weight:700;color:var(--orange-dark)">Walk there</a>`; })() : '';
      };
      const drawRecent = () => {
        const box = el.querySelector('#recent'); if (!box) return; const r = recents();
        box.innerHTML = r.length ? `<div class="stack" style="gap:10px"><div class="row"><div class="section grow" style="margin:0">RECENT TRIPS</div><button class="btn btn-ghost btn-sm" id="rclear" style="width:auto">Clear</button></div><div class="card list">${r.map((t) => `<a class="item" href="#/waka/plan?from=${t.from.id}&to=${t.to.id}"><div class="mi">${icon('clock-rotate-left')}</div><div class="grow"><div class="t">${h(t.from.name)} → ${h(t.to.name)}</div></div><button class="iconbtn" data-back="${t.from.id}|${t.to.id}" aria-label="Plan the way back" title="The way back" style="width:34px;height:34px">${icon('arrows-up-down')}</button></a>`).join('')}</div></div>` : '';
        box.querySelector('#rclear')?.addEventListener('click', () => { try { localStorage.removeItem(RK); } catch {} drawRecent(); });
        box.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const [f, t] = b.dataset.back.split('|'); go(`/waka/plan?from=${t}&to=${f}`); }));
      };
      drawRecent();
      el.querySelector('#from').addEventListener('click', () => picker(el, (p) => { from = p; auto = false; set(); }, me)('Where from?'));
      el.querySelector('#to').addEventListener('click', () => picker(el, (p) => { to = p; set(); }, me)('Where to?'));
      el.querySelector('#swap').addEventListener('click', () => { [from, to] = [to, from]; auto = false; set(); });
      el.querySelector('#plan').addEventListener('click', () => {
        try { const r = recents().filter((t) => !(t.from.id === from.id && t.to.id === to.id)); r.unshift({ from: { id: from.id, name: from.name }, to: { id: to.id, name: to.name } }); localStorage.setItem(RK, JSON.stringify(r.slice(0, 5))); } catch {}
        go(`/waka/plan?from=${from.id}&to=${to.id}`);
      });
      let places = [];
      try { places = (await api.wakaPlaces()).places || []; } catch { return; }
      if (qf) from = places.find((p) => String(p.id) === qf) || null;
      if (qt) to = places.find((p) => String(p.id) === qt) || null;
      if (toq) { const p = places.find((x) => x.district === toq) || places.find((x) => x.name.toLowerCase().includes(toq.toLowerCase())); if (p) to = p; }
      set();
      const pop = places.filter((p) => p.kind === 'park').slice(0, 8);
      const pb = el.querySelector('#popular');
      if (pb && pop.length) { pb.innerHTML = `<div class="small muted" style="margin-bottom:6px">Popular stops</div><div class="row" style="gap:6px;overflow-x:auto;padding-bottom:2px">${pop.map((p) => `<button class="chip" data-pop="${p.id}" style="flex-shrink:0">${h(p.name)}</button>`).join('')}</div>`; pb.querySelectorAll('[data-pop]').forEach((b) => b.addEventListener('click', () => { const p = places.find((x) => String(x.id) === b.dataset.pop); if (!from || from.id === p.id) { if (!from) { from = p; auto = false; } else to = p; } else to = p; set(); })); }
      me = await here(8000);
      if (!el.isConnected || !me) return;
      if (!from && places.length) { from = places.map((p) => ({ p, d: kmBetween(me.lat, me.lng, p.lat, p.lng) })).sort((a, b) => a.d - b.d)[0].p; auto = true; }
      set();
    }
  });

  /* ---------- Live Waka map: stops near you, road alerts, plan from a stop ---------- */
  route('/waka/map', { auth: true, tabs: '' }, async () => `<div class="bm-screen"><div class="bm-mapbox" id="map"></div>
    <div class="bm-top"><a class="bm-fab" href="#/waka" aria-label="Back">${icon('arrow-left')}</a><div class="bm-pill">Live Waka map</div></div>
    <button class="bm-fab bm-locate" id="locate" aria-label="Where am I" style="top:calc(70px + var(--safe-t,0px))">${icon('location-crosshairs')}</button>
    <button class="bm-fab bm-locate" id="tilt" aria-label="3D buildings" style="top:calc(122px + var(--safe-t,0px));font:900 13px Inter,system-ui">3D</button></div>`, {
    async mount(el) {
      const screen = el.querySelector('.bm-screen');
      const sheet = bottomSheet(screen, { peek: 160, half: 0.44, start: 'half' });
      sheet.body.innerHTML = `<div class="small muted" style="padding:6px 0">Loading stops and alerts…</div>`;
      const pos = await new Promise((res) => { if (!navigator.geolocation) return res(null); let d = false; const f = (v) => { if (!d) { d = true; res(v); } }; setTimeout(() => f(null), 5000); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }); });
      const map = await createMap(el.querySelector('#map'), { center: pos ? [pos.lng, pos.lat] : undefined, zoom: pos ? 13.5 : 11.5 });
      const [{ places }, al] = await Promise.all([api.wakaPlaces(), api.wakaAlerts().catch(() => ({ alerts: [] }))]);
      const alerts = (al.alerts || []).filter((a) => a.lat != null);
      const dist = (p) => pos ? Math.hypot((p.lat - pos.lat) * 111, (p.lng - pos.lng) * 111 * Math.cos(pos.lat * Math.PI / 180)) : null;
      places.forEach((p) => { p.km = dist(p); });
      const near = places.slice().sort((a, b) => (a.km ?? 99) - (b.km ?? 99)).slice(0, 8);
      if (map) {
        if (pos) map.marker('me', { ...pos, html: meHtml(), anchor: 'center', z: 5 });
        places.forEach((p) => map.marker('p' + p.id, { lng: p.lng, lat: p.lat, z: 1, html: pinHtml({ iconName: p.kind === 'station' ? 'train' : p.kind === 'airport' ? 'plane' : 'bus', color: p.kind === 'station' ? '#1F5FBF' : '#2E7D1E', size: 28, label: p.name }), onClick: () => stop(p) }));
        alerts.forEach((a) => map.marker('al' + a.id, { lng: a.lng, lat: a.lat, z: 4, html: pinHtml({ iconName: 'triangle-exclamation', color: '#D92D20', size: 36, label: a.label, sub: a.place || '', badge: a.confirms > 1 ? String(a.confirms) : '' }), onClick: () => alertCard(a) }));
        map.fit((pos ? [[pos.lng, pos.lat]] : []).concat(near.slice(0, 5).map((p) => [p.lng, p.lat])), { bottom: window.innerHeight * 0.46 });
      }
      const listView = () => {
        sheet.body.innerHTML = `<div class="stack" style="gap:10px;padding-top:2px">
          ${alerts.length ? `<div class="section" style="margin:0">ON THE ROAD NOW</div>${alerts.slice(0, 4).map((a) => `<button class="row card" data-al="${a.id}" style="width:100%;text-align:left;padding:10px 12px;gap:10px;background:var(--card)"><span style="width:34px;height:34px;border-radius:17px;background:#FDECEA;color:#D92D20;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('triangle-exclamation')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:700">${h(a.label)}</span><span class="small muted">${h(a.place || a.district || '')} · ${a.confirms} confirmed</span></span></button>`).join('')}` : `<div class="small muted">No road alerts reported right now.</div>`}
          <div class="section" style="margin:6px 0 0">${pos ? 'STOPS NEAR YOU' : 'STOPS'}</div>
          ${near.map((p) => `<button class="row card" data-p="${p.id}" style="width:100%;text-align:left;padding:10px 12px;gap:10px;background:var(--card)"><span style="width:34px;height:34px;border-radius:17px;background:var(--green-tint);color:var(--green-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(p.kind === 'station' ? 'train' : 'bus')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:700">${h(p.name)}</span><span class="small muted">${h(p.district || '')}${p.km != null ? ' · ' + (p.km < 1 ? Math.round(p.km * 1000) + ' m' : p.km.toFixed(1) + ' km') : ''}</span></span>${icon('chevron-right')}</button>`).join('')}
          <a class="btn btn-outline" href="#/waka">Plan a journey</a></div>`;
        sheet.body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => stop(places.find((x) => String(x.id) === b.dataset.p))));
        sheet.body.querySelectorAll('[data-al]').forEach((b) => b.addEventListener('click', () => alertCard(alerts.find((x) => String(x.id) === b.dataset.al))));
      };
      const stop = (p) => {
        if (map) map.center(p.lng, p.lat, 15);
        sheet.body.innerHTML = `<div class="stack" style="gap:12px;padding-top:4px"><div><div style="font-size:18px;font-weight:800">${h(p.name)}</div><div class="small muted">${h(p.district || '')}${p.km != null ? ' · ' + (p.km < 1 ? Math.round(p.km * 1000) + ' m from you' : p.km.toFixed(1) + ' km from you') : ''}</div></div>
          <div class="row" style="gap:8px"><a class="btn btn-primary grow" href="#/waka?from=${p.id}">From here</a><a class="btn btn-ink grow" href="#/waka?to=${p.id}">To here</a></div>
          <a class="btn btn-outline" href="${h(placeHref({ lat: p.lat, lng: p.lng, name: p.name, sub: p.district || '', icon: 'bus', color: '#1F5FBF', walk: true }))}">${icon('route')} Walk there</a>
          <button class="btn btn-ghost small" id="back">Back</button></div>`;
        sheet.set('half'); sheet.body.querySelector('#back').addEventListener('click', listView);
      };
      const alertCard = (a) => {
        if (map) map.center(a.lng, a.lat, 15);
        sheet.body.innerHTML = `<div class="stack" style="gap:12px;padding-top:4px"><div class="row" style="gap:10px"><span style="width:44px;height:44px;border-radius:22px;background:#FDECEA;color:#D92D20;display:flex;align-items:center;justify-content:center">${icon('triangle-exclamation')}</span><div><div style="font-size:18px;font-weight:800">${h(a.label)}</div><div class="small muted">${h(a.place || a.district || '')}</div></div></div>
          ${a.note ? `<div class="small" style="color:var(--ink-2)">${h(a.note)}</div>` : ''}<div class="small muted">${a.confirms} ${a.confirms === 1 ? 'person says' : 'people say'} it is still there · ${a.cleared} say it cleared</div>
          <a class="btn btn-outline" href="#/waka/alerts">Confirm or clear it</a><button class="btn btn-ghost small" id="back">Back</button></div>`;
        sheet.set('half'); sheet.body.querySelector('#back').addEventListener('click', listView);
      };
      el.querySelector('#locate').addEventListener('click', () => { if (pos && map) map.center(pos.lng, pos.lat, 15); else toast('Turn on location to see stops near you'); });
      let three = false; el.querySelector('#tilt').addEventListener('click', async (e) => { if (!map) return; three = !three; e.currentTarget.style.background = three ? '#101014' : ''; e.currentTarget.style.color = three ? '#fff' : ''; await map.set3d(three); });
      listView();
    }
  });

  /* ---------- Boarding a vehicle: check the plate, see the district's history, share the ride ---------- */
  async function boardFlow(el, { mode, routeName, routeId, from, to, minutes }) {
    const sh = el.querySelector('#sheet'); if (!sh) return;
    const { contacts } = await api.safety().catch(() => ({ contacts: [] }));
    const draw = (check) => {
      sh.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:40;display:flex;align-items:flex-end;justify-content:center" id="bx"><div class="card stack" style="width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:18px 16px calc(24px + var(--safe-b,0px));gap:12px;max-height:90vh;overflow-y:auto">
        <div class="row"><div class="h-md grow">Before you enter</div><button class="iconbtn" id="bclose" aria-label="Close" style="width:34px;height:34px">${icon('xmark')}</button></div>
        <div class="small muted" style="line-height:1.5">${h(routeName || 'Your journey')}${to ? ' to ' + h(to.name) : ''}. Type the plate on the vehicle and Buja checks it against reports from other riders.</div>
        <div class="row" style="gap:8px"><input class="input" id="bplate" placeholder="ABC 123 XY" autocapitalize="characters" autocomplete="off" style="flex:1;font-size:18px;letter-spacing:2px;text-align:center;height:50px;font-weight:700" value="${h((check && check.plate) || '')}"><button class="btn btn-ink" id="bcheck" style="width:auto;height:50px">Check</button></div>
        ${check ? `<div style="padding:12px;border-radius:12px;background:${check.reports ? '#FDECEA' : 'var(--green-tint)'};color:${check.reports ? '#D92D20' : 'var(--green-dark)'}">
          <div style="font-size:14px;font-weight:700">${h(check.verdict)}</div>
          ${check.items.map((i) => `<div class="small" style="margin-top:6px;line-height:1.45"><strong>${h(i.when)}${i.district ? ', ' + h(i.district) : ''}</strong> ${h(i.what)}</div>`).join('')}</div>` : ''}
        ${check && check.tips ? `<div class="stack" style="gap:6px">${check.tips.map((t) => `<div class="row small" style="gap:8px;align-items:flex-start"><span style="color:var(--orange-dark);flex-shrink:0">${icon('shield-halved')}</span><span style="line-height:1.45">${h(t)}</span></div>`).join('')}</div>` : ''}
        <div class="field" style="margin:0"><label for="bwho">Tell somebody you are on the way</label><select class="input" id="bwho">${contacts && contacts.length ? contacts.map((c) => `<option value="${c.id}">${h(c.name)}</option>`).join('') : '<option value="">No trusted contact saved yet</option>'}</select></div>
        <button class="btn btn-primary" id="bstart">${icon('shield-halved')} Start the ride and share it</button>
        ${contacts && contacts.length ? '' : `<a class="btn btn-outline small" href="#/safety">Add a trusted contact first</a>`}
        <div class="small muted" style="line-height:1.5">They get a link with your live position, the plate and where you are heading. Buja asks if you arrived, and ends the trip when you say so.</div></div></div>`;
      const close = () => { sh.innerHTML = ''; };
      sh.querySelector('#bclose').addEventListener('click', close);
      sh.querySelector('#bx').addEventListener('click', (e) => { if (e.target.id === 'bx') close(); });
      sh.querySelector('#bcheck').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.boardCheck({ plate: sh.querySelector('#bplate').value, district: (from && from.district) || '' }); draw(r); } catch (err) { busy(b, false); failed(el, err); } });
      sh.querySelector('#bstart').addEventListener('click', async (e) => {
        const b = e.currentTarget; busy(b, true);
        const pos = await new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 6000 }); });
        try {
          const r = await api.startRide({ plate: sh.querySelector('#bplate').value, mode, routeId, from: from && from.id, to: to && to.id, minutes, contactId: sh.querySelector('#bwho').value || null, lat: pos && pos.lat, lng: pos && pos.lng });
          close();
          const text = `I am on a ${h(mode === 'along' ? 'taxi' : mode || 'vehicle')}${r.trip.plate ? ', plate ' + r.trip.plate : ''}${to ? ', going to ' + to.name : ''}. Follow me: ${r.trip.link}`;
          if (navigator.share) navigator.share({ title: 'My Buja trip', text }).catch(() => {}); else { try { await navigator.clipboard.writeText(text); toast('Link copied. Send it to someone.'); } catch { toast('Share this link: ' + r.trip.link, 6000); } }
          go('/safety');
        } catch (err) { busy(b, false); failed(el, err); }
      });
    };
    draw(null);
  }

  /* ---------- Plan results ---------- */
  function legRow(l, i, showActions) {
    return `<div class="row" style="gap:14px;align-items:flex-start">
      <div style="display:flex;flex-direction:column;align-items:center;width:36px"><div style="width:36px;height:36px;border-radius:18px;background:${l.color || 'var(--ink)'};display:flex;align-items:center;justify-content:center;color:#fff">${icon(modeIcon[l.mode])}</div></div>
      <div class="grow"><div class="row" style="justify-content:space-between;gap:10px"><div style="font-size:15px;font-weight:700">${h(l.routeName)}</div><div style="font-size:15px;font-weight:700">${l.fare.amount != null ? naira(l.fare.amount) : '?'}</div></div>
        <div class="small" style="margin-top:2px;color:${l.fare.confirmed ? 'var(--green-dark)' : 'var(--ink-3)'}">${l.fare.confirmed ? `${l.fare.reports} riders paid this, last 30 days` : l.fare.lowConfidence ? 'Reported fare, confirm at the station' : `Estimate from distance and today's fuel price${l.fare.hint ? ` · a rider paid ${naira(l.fare.hint)}` : ''}`}</div><div></div>
        <div class="small muted" style="margin-top:3px;line-height:1.45">${h(l.from.name)} → ${h(l.to.name)} · ${l.km} km · about ${l.minutes} min${l.ridersNow ? ` · <strong style="color:var(--green-dark)">${l.ridersNow} rider${l.ridersNow === 1 ? '' : 's'} on it now</strong>` : ''}</div>
        <div class="small" style="margin-top:3px">${h(l.say)}</div>
        ${showActions && l.routeId ? `<div class="row" style="gap:8px;margin-top:8px"><a class="btn btn-sm btn-outline" href="#/waka/route/${l.routeId}?from=${l.from.id}&to=${l.to.id}">Route details</a><button class="btn btn-sm btn-outline" data-report="${l.routeId}" data-from="${l.from.id}" data-to="${l.to.id}">${icon('naira-sign')} Report fare</button><button class="btn btn-sm btn-ink" data-checkin="${l.routeId}">${icon('bus')} I'm on this</button></div>` : ''}
      </div></div>`;
  }
  route('/waka/plan', { auth: true, tabs: '' }, async () => {
    { const qq = new URLSearchParams(location.hash.split('?')[1] || ''); if (!qq.get('from') || !qq.get('to') || qq.get('from') === qq.get('to')) { go('/waka'); return ''; } }
    const from = +q().get('from'), to = +q().get('to');
    const d = await api.wakaPlan(from, to);
    const all = d.options.length ? d.options : [d.taxi];
    const RIDE_ICON = { drop: 'car-side', bolt: 'bolt', indrive: 'hand-holding-dollar' };
    return `
    <div style="position:relative;height:300px;background:#ECEEE8;flex-shrink:0"><div id="map" style="position:absolute;inset:0"></div>
      <a class="iconbtn" href="#/waka" aria-label="Back" style="position:absolute;top:12px;left:12px;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.15)">${icon('arrow-left')}</a>
      <button class="iconbtn" id="save" aria-label="Save route" style="position:absolute;top:12px;right:12px;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.15)">${icon('regular/bookmark')}</button>
    </div>
    <main class="pad stack" style="gap:12px;padding-top:14px;border-radius:24px 24px 0 0;margin-top:-20px;background:var(--surface);position:relative">
      <div class="row" style="justify-content:space-between;align-items:baseline"><div class="h-md">${h(d.from.name)} → ${h(d.to.name)}</div><div class="small muted">${d.km} km</div></div>
      ${all.map((o, i) => `<div class="card stack" data-opt="${i}" style="padding:14px;gap:10px;${i === 0 && o.tag ? 'border:2px solid var(--green);background:var(--green-tint)' : ''}">
        <div class="row" style="justify-content:space-between;gap:10px"><div class="row" style="gap:6px">${o.legs.map((l, k) => `${k ? '<span class="muted">›</span>' : ''}<span style="width:28px;height:28px;border-radius:14px;background:${l.color || 'var(--ink)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">${icon(modeIcon[l.mode])}</span>`).join('')}</div><div style="text-align:right"><div style="font-size:18px;font-weight:700;color:${o.confirmed ? 'var(--green-dark)' : 'var(--ink)'}">${naira(o.fare)}</div><div class="small" style="font-weight:700;color:var(--ink-3);letter-spacing:.5px">${(o.tag || '').toUpperCase()}</div></div></div>
        <div style="font-size:15px;font-weight:600">${o.taxi ? 'Taxi drop, direct' : o.legs.map((l) => l.routeName).join(', then ')}</div>
        <div class="small muted">about ${o.minutes} min · ${o.transfers ? o.transfers + ' transfer' : 'no transfer'}${o.confirmed ? ' · fares confirmed by riders' : ' · estimated fare'}${o.ridersNow ? ` · ${o.ridersNow} riding now` : ''}</div>
        <div class="stack" style="gap:12px;display:none" data-legs>${o.legs.map((l, k) => legRow(l, k, !o.taxi)).join('')}</div>
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline grow" data-expand>Show steps</button><button class="btn btn-sm btn-ink" data-board="${i}" style="width:auto">${icon('shield-halved')} Board safely</button></div>
      </div>`).join('')}
      ${d.rides ? `<div class="section" style="margin:6px 0 0">DOOR TO DOOR</div>
      <div class="card list">${d.rides.map((r) => `<div class="item" style="align-items:flex-start"><div class="mi" style="background:${r.kind === 'bolt' ? '#E7F6EC' : r.kind === 'indrive' ? '#EEF7D9' : 'var(--surface)'};color:${r.kind === 'bolt' ? '#2E7D1E' : r.kind === 'indrive' ? '#4C7A0E' : 'var(--ink)'}">${icon(RIDE_ICON[r.kind])}</div><div class="grow"><div class="row" style="justify-content:space-between;gap:8px"><div class="t">${h(r.label)}</div><div style="font-size:15px;font-weight:800">${naira(r.fare)}${r.range && r.range[1] > r.fare ? `<span class="small muted" style="font-weight:500"> to ${naira(r.range[1])}</span>` : ''}</div></div><div class="s" style="line-height:1.45">about ${r.minutes} min · ${h(r.note)}</div></div></div>`).join('')}</div>
      <button class="btn btn-ghost small" id="howfares" style="align-self:flex-start">${icon('circle-info')} How Waka works out fares</button>` : ''}
      ${!d.options.length ? `<div class="card" style="padding:16px"><div class="h-sm">No bus or keke route on record yet</div><div class="small muted" style="line-height:1.5">Buja knows ${'the main parks and junctions'} so far. Tell us how you make this trip and we add it: Me → Suggest a route.</div></div>` : ''}
      <div class="small muted" style="line-height:1.5;padding-bottom:8px">Times assume Abuja traffic and waiting at the park. Report the fare you paid and it updates for everyone.</div>
    </main>
    <div id="sheet"></div>`;
  }, {
    mount(el) {
      const from = +q().get('from'), to = +q().get('to');
      if (!from || !to || from === to) return;
      api.wakaPlan(from, to).then((d) => drawMap(el, (d.options[0] || d.taxi).legs)).catch(() => {});
      el.querySelectorAll('[data-expand]').forEach((b) => b.addEventListener('click', () => { const box = b.closest('[data-opt]').querySelector('[data-legs]'); const open = box.style.display === 'none'; box.style.display = open ? '' : 'none'; b.textContent = open ? 'Hide steps' : 'Show steps'; if (open) { const i = +b.closest('[data-opt]').dataset.opt; api.wakaPlan(from, to).then((d) => drawMap(el, [...d.options, d.taxi][i].legs)); } }));
      bindLegActions(el);
      el.querySelectorAll('[data-board]').forEach((b) => b.addEventListener('click', async () => {
        const d2 = await api.wakaPlan(from, to); const opts = d2.options.length ? d2.options : [d2.taxi]; const o = opts[+b.dataset.board] || opts[0]; const leg = o.legs[0];
        boardFlow(el, { mode: leg.mode, routeName: o.legs.map((l) => l.routeName).join(', then '), routeId: leg.routeId || null, from: leg.from, to: o.legs[o.legs.length - 1].to, minutes: o.minutes });
      }));
      el.querySelector('#howfares')?.addEventListener('click', async () => {
        const p = await api.wakaPricing(); const sh = el.querySelector('#sheet');
        sh.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:40;display:flex;align-items:flex-end;justify-content:center" id="fx"><div class="card stack" style="width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:18px 16px calc(24px + var(--safe-b,0px));gap:10px;max-height:85vh;overflow-y:auto">
          <div class="h-md">How Waka works out fares</div>
          <div class="small" style="line-height:1.6;color:var(--ink-2)"><p style="margin:0 0 8px"><strong>Riders first.</strong> When ${p.crowdMin} or more people report what they paid on a stretch in the last 30 days, Waka shows the middle of what they paid.</p><p style="margin:0 0 8px"><strong>Otherwise, an estimate</strong> from the distance and today's petrol price (₦${Number(p.pumpPrice).toLocaleString()} a litre, checked ${h(p.reviewedAt || '')}). Along cabs follow a line fitted to fares Abuja riders paid in March 2026; buses, keke and the light rail use their own bands. When fuel rises, fares rise about half as much, which is how the market has moved since 2023.</p><p style="margin:0 0 8px"><strong>Door to door</strong> prices are estimates: a charter is about four along seats, Bolt uses its published rate card adjusted for fuel, and inDrive's figure is a fair opening offer. Uber no longer operates in Nigeria.</p><p style="margin:0">Keke and okada are not allowed in the city centre; Waka only suggests keke inside estates and satellite towns.</p></div>
          <div class="card list">${Object.entries(p.examples).map(([k, v]) => `<div class="item"><div class="grow small">${h(k)}</div><strong>₦${Number(v).toLocaleString()}</strong></div>`).join('')}</div>
          <button class="btn btn-ink" id="fclose">Got it</button></div></div>`;
        const close = () => { sh.innerHTML = ''; }; sh.querySelector('#fclose').addEventListener('click', close); sh.querySelector('#fx').addEventListener('click', (e) => { if (e.target.id === 'fx') close(); });
      });
      if (!el.querySelector('#save')) return;
      el.querySelector('#save').addEventListener('click', async () => { const label = prompt('Name this route (optional), e.g. Home to work') ?? null; if (label === null) return; try { await api.wakaSave(from, to, label); toast('Route saved'); } catch (err) { failed(el, err); } });
    }
  });

  function bindLegActions(el) {
    el.querySelectorAll('[data-checkin]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.wakaCheckin(b.dataset.checkin); toast(`Thanks. ${r.ridersNow} rider${r.ridersNow === 1 ? '' : 's'} on this route now.`); busy(b, false); b.innerHTML = icon('circle-check') + ' On it'; } catch (err) { busy(b, false); failed(el, err); } }));
    el.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => {
      el.querySelector('#sheet').innerHTML = `<form id="fare" class="card stack" style="margin:8px 16px 16px;padding:16px;gap:12px"><div class="row"><div class="grow h-sm">What did you pay?</div><button type="button" class="iconbtn" id="fclose" aria-label="Close" style="width:36px;height:36px">${icon('xmark')}</button></div>
        <div class="field"><label for="amount">Fare, in naira, for this leg</label><input class="input" id="amount" inputmode="numeric" placeholder="400"><div class="error" data-error="amount"></div></div>
        <button class="btn btn-primary" type="submit">${icon('naira-sign')} Report fare</button><div class="small muted">Buja shows the middle value of what riders paid in the last 30 days.</div></form>`;
      el.querySelector('#sheet').scrollIntoView({ behavior: 'smooth' }); el.querySelector('#amount').focus();
      el.querySelector('#fclose').addEventListener('click', () => { el.querySelector('#sheet').innerHTML = ''; });
      el.querySelector('#fare').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { const r = await api.wakaReportFare(b.dataset.report, b.dataset.from, b.dataset.to, el.querySelector('#amount').value); toast(`Thanks. Fare is now ${naira(r.fare.amount)} from ${r.fare.reports} report${r.fare.reports === 1 ? '' : 's'}.`); location.reload(); } catch (err) { busy(btn, false); failed(el, err); } });
    }));
  }

  /* ---------- Route detail ---------- */
  route('/waka/route/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const { route: r } = await api.wakaRoute(id);
    const f = +q().get('from') || r.origin, t = +q().get('to') || r.dest;
    const fromS = r.stops.find((s) => s.id === f) || r.stops[0], toS = r.stops.find((s) => s.id === t) || r.stops[r.stops.length - 1];
    return `
    <div style="position:relative;height:260px;background:#ECEEE8;flex-shrink:0"><div id="map" style="position:absolute;inset:0"></div><a class="iconbtn" href="#/waka" aria-label="Back" style="position:absolute;top:12px;left:12px;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.15)">${icon('arrow-left')}</a></div>
    <main class="pad stack" style="gap:14px;padding-top:14px;border-radius:24px 24px 0 0;margin-top:-20px;background:var(--surface);position:relative">
      <div class="row" style="gap:12px"><div style="width:44px;height:44px;border-radius:22px;background:${r.color};display:flex;align-items:center;justify-content:center;color:#fff">${icon(modeIcon[r.mode])}</div><div class="grow"><div class="h-md">${h(r.name)}</div><div class="small muted">${r.modeLabel} · ${r.stops.length} stops${r.ridersNow ? ` · <strong style="color:var(--green-dark)">${r.ridersNow} riding now</strong>` : ''}</div></div></div>
      ${r.notes ? `<div class="small" style="padding:12px 14px;background:var(--orange-tint);color:var(--orange-dark);border-radius:12px;line-height:1.5">${h(r.notes)}</div>` : ''}
      <div class="card" style="padding:16px"><div class="row" style="justify-content:space-between;align-items:baseline"><div><div class="small muted" style="font-weight:600">FULL ROUTE FARE</div><div style="font-size:28px;font-weight:700;color:${r.fare.confirmed ? 'var(--green-dark)' : 'var(--ink)'}">${naira(r.fare.amount)}</div></div><div class="small muted" style="text-align:right">${r.fare.confirmed ? `Median of ${r.fare.reports} rider report${r.fare.reports === 1 ? '' : 's'}, last 30 days` : 'Starting estimate, not yet confirmed'}</div></div></div>
      <div class="row" style="gap:8px"><button class="btn btn-ink" id="ck" style="flex:1" ${r.myCheckin ? 'disabled' : ''}>${icon('bus')} ${r.myCheckin ? 'You are on it' : "I'm on this route now"}</button><button class="btn btn-outline" data-report="${r.id}" data-from="${fromS.id}" data-to="${toS.id}" style="flex:1">${icon('naira-sign')} Report fare</button></div>
      <div class="stack" style="gap:10px"><div class="section">STOPS</div><div class="card" style="padding:16px 16px 8px">${r.stops.map((s, i) => `<div class="row" style="gap:14px;align-items:stretch"><div style="display:flex;flex-direction:column;align-items:center;width:20px"><div style="width:${i === 0 || i === r.stops.length - 1 ? 14 : 10}px;height:${i === 0 || i === r.stops.length - 1 ? 14 : 10}px;border-radius:7px;background:${i === 0 ? 'var(--ink)' : i === r.stops.length - 1 ? 'var(--orange)' : r.color};margin-top:6px"></div>${i < r.stops.length - 1 ? `<div style="width:3px;flex:1;background:var(--line);min-height:18px;margin:4px 0"></div>` : ''}</div><div class="grow" style="padding-bottom:12px"><div style="font-size:14px;font-weight:600">${h(s.name)}</div><div class="small muted">${h(s.district)}</div></div></div>`).join('')}</div></div>
      ${r.recentReports.length ? `<div class="stack" style="gap:10px"><div class="section">RECENT FARE REPORTS</div><div class="card list">${r.recentReports.map((x) => `<div class="item"><div class="grow"><div class="t" style="font-size:14px">${naira(x.amount)}</div><div class="s">${h(x.from)} → ${h(x.to)}</div></div><span class="small muted">${x.at.slice(0, 10)}</span></div>`).join('')}</div></div>` : ''}
      <div id="sheet"></div>
    </main>`;
  }, {
    mount(el, { id }) {
      api.wakaRoute(id).then(({ route: r }) => drawMap(el, [{ path: r.stops, color: r.color, ridersNow: r.ridersNow, geometry: r.geometry ? r.geometry.flat() : null }]));
      el.querySelector('#ck').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.wakaCheckin(id); toast(`Thanks. ${r.ridersNow} on this route now.`); location.reload(); } catch (err) { busy(b, false); failed(el, err); } });
      bindLegActions(el);
    }
  });

  /* ---------- All routes ---------- */
  route('/waka/routes', { auth: true, tabs: '' }, async () => {
    const { routes } = await api.wakaRoutes();
    return `${topbar('All routes', '/waka')}<main class="pad stack" style="gap:10px"><div class="card list">${routes.map((r) => `<a class="item" href="#/waka/route/${r.id}"><div class="mi" style="color:${r.color}">${icon(modeIcon[r.mode])}</div><div class="grow"><div class="t">${h(r.name)}</div><div class="s">${r.modeLabel} · ${naira(r.fare.amount)}${r.fare.confirmed ? '' : ' est.'} · ${r.stops.length} stops</div></div>${r.ridersNow ? `<span class="tag green">${r.ridersNow} now</span>` : ''}${icon('chevron-right')}</a>`).join('')}</div><div class="small muted" style="line-height:1.5">Missing a route you take? Tell Buja and it gets added with your stops and fare.</div></main>`;
  });
}
