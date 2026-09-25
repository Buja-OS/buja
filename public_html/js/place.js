import { createMap, pinHtml, facePinHtml, meHtml, bottomSheet, metres } from './map.js';
// Buja place view: any "where is it" link opens here instead of Google Maps. The place's pin, where you are,
// the road between you, how far and how long, and it keeps up as you move. Registered by app.js.
export function registerPlace({ route, go, api, ui }) {
  const { h, icon, toast } = ui;
  const km = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km');
  const mins = (n) => (n < 60 ? n + ' min' : Math.floor(n / 60) + ' h ' + (n % 60 ? (n % 60) + ' min' : ''));

  route('/place', { tabs: '' }, async () => {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const lat = +q.get('lat'), lng = +q.get('lng');
    if (!isFinite(lat) || !isFinite(lng) || !lat || !lng) return `<div class="placeholder" style="padding:60px 20px"><div class="h-md">That place has no map position.</div><button class="btn btn-ink" onclick="history.back()">Go back</button></div>`;
    return `<div class="bm-screen"><div class="bm-mapbox" id="map"></div>
      <div class="bm-top"><button class="bm-fab" id="back" aria-label="Back">${icon('arrow-left')}</button><div class="bm-pill" style="max-width:calc(100% - 64px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(q.get('n') || 'On the map')}</div></div></div>`;
  }, {
    async mount(el) {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      const P = { lat: +q.get('lat'), lng: +q.get('lng') }; if (!P.lat || !P.lng) return;
      const name = q.get('n') || 'This place', sub = q.get('s') || '', walk = q.get('w') === '1';
      const iconName = /^[a-z0-9-]{2,30}$/.test(q.get('i') || '') ? q.get('i') : 'location-dot';
      const color = /^#[0-9a-f]{3,6}$/i.test(q.get('c') || '') ? q.get('c') : '#FF7A1A';
      const photo = /^\/(uploads|api)\/[\w\-./?=&%]+$/.test(q.get('ph') || '') ? q.get('ph') : '';   // only our own pictures
      el.querySelector('#back').addEventListener('click', () => (history.length > 1 ? history.back() : go('/')));

      const screen = el.querySelector('.bm-screen');
      const sheet = bottomSheet(screen, { peek: 150, half: 0.36, start: 'half' });
      const map = await createMap(el.querySelector('#map'), { center: [P.lng, P.lat], zoom: 15 });
      if (map) map.marker('place', { ...P, z: 4, html: photo ? facePinHtml({ photo, name, color, iconName }) : pinHtml({ iconName, color, label: name, sub, size: 44 }) });

      let me = null, lastRouteAt = null, routeInfo = null, watch = null, follow = false, fitted = false;
      const alive = () => document.body.contains(el);
      const draw = () => {
        const straight = me ? metres(me, P) : null;
        let how;
        if (!me) how = navigator.geolocation ? '<span class="muted">Finding where you are…</span>' : '<span class="muted">This phone cannot share its location.</span>';
        else if (straight < 60) how = `<strong style="color:var(--green-dark)">You are here</strong>`;
        else if (routeInfo && routeInfo.source !== 'straight') {
          const t = walk ? Math.max(1, Math.round(routeInfo.km / 4.8 * 60)) : Math.max(1, routeInfo.minutes);
          how = `<strong>${km(routeInfo.km * 1000)}</strong> by road · about <strong>${mins(t)}</strong> ${walk ? 'on foot' : 'by car'}`;
        } else how = `<strong>${km(straight)}</strong> away${routeInfo ? ' (straight line)' : ''}`;
        sheet.body.innerHTML = `<div class="stack" style="gap:12px;padding-top:2px">
          <div class="row" style="gap:12px;align-items:flex-start">
            <span style="width:42px;height:42px;border-radius:21px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(iconName)}</span>
            <div class="grow" style="min-width:0"><div style="font-size:18px;font-weight:800;line-height:1.25">${h(name)}</div>${sub ? `<div class="small muted" style="margin-top:2px">${h(sub)}</div>` : ''}</div>
          </div>
          <div style="font-size:15px;line-height:1.45" id="how">${how}</div>
          <div class="row" style="gap:8px">
            <button class="btn btn-primary grow" id="both">${icon('route')} ${me ? 'Route' : 'Find me'}</button>
            <button class="btn btn-outline grow" id="there">${icon('location-dot')} Place</button>
          </div>
          <button class="btn btn-ghost small" id="follow" style="${me ? '' : 'display:none'}">${follow ? 'Stop following me' : 'Follow me as I go'}</button>
        </div>`;
        sheet.body.querySelector('#both').addEventListener('click', () => { if (!me) { locate(true); return; } follow = false; fitBoth(); draw(); });
        sheet.body.querySelector('#there').addEventListener('click', () => { follow = false; if (map) map.center(P.lng, P.lat, 16.5); sheet.set('peek'); draw(); });
        sheet.body.querySelector('#follow').addEventListener('click', () => { follow = !follow; if (follow && me && map) { map.center(me.lng, me.lat, 16.5); sheet.set('peek'); } draw(); });
      };
      const fitBoth = () => { if (map && me) map.fit([[me.lng, me.lat], [P.lng, P.lat]].concat(routeInfo && routeInfo.coords ? routeInfo.coords : []), { bottom: window.innerHeight * 0.4, top: 150, side: 60, maxZoom: 16 }); };
      // the road route: at the start, then again after you have moved 300 m (never more often than every 25 s)
      const reroute = async () => {
        if (!me || metres(me, P) < 60) return;
        if (lastRouteAt && (metres(lastRouteAt.at, me) < 300 || Date.now() - lastRouteAt.t < 25000)) return;
        lastRouteAt = { at: { ...me }, t: Date.now() };
        try {
          const r = await api.road([[me.lat, me.lng], [P.lat, P.lng]]); if (!alive()) return;
          routeInfo = r;
          if (map && r.coords && r.coords.length > 1) map.line('way', r.coords, { color: walk ? '#1F5FBF' : '#FF7A1A', width: 6, dashed: walk || r.source === 'straight' });
          if (!fitted) { fitted = true; fitBoth(); }
        } catch { routeInfo = routeInfo || { source: 'straight' }; }
        draw();
      };
      const onPos = (p, first) => {
        if (!alive()) { if (watch != null) navigator.geolocation.clearWatch(watch); return; }
        me = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (map) { if (map.has('me')) map.move('me', me.lng, me.lat, { ms: 900 }); else map.marker('me', { ...me, html: meHtml(), anchor: 'center', z: 5 }); if (follow) map.center(me.lng, me.lat); }
        if (first && !fitted && map) fitBoth();
        draw(); reroute();
      };
      const locate = (asked) => {
        if (!navigator.geolocation) { draw(); return; }
        navigator.geolocation.getCurrentPosition((p) => onPos(p, true), () => { if (asked) toast('Allow location for Buja to see how far it is.'); draw(); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
        if (watch == null) watch = navigator.geolocation.watchPosition((p) => onPos(p, false), () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
      };
      // stop watching the GPS as soon as this screen is left
      const obs = new MutationObserver(() => { if (!alive()) { obs.disconnect(); if (watch != null) navigator.geolocation.clearWatch(watch); } });
      obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
      draw(); locate(false);
    },
  });
}
