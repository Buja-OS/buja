// Buja Waka: routes, fares, planner. Registered into the app router by app.js.
export function registerWaka({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon } = ui;
  const naira = (n) => n == null ? '₦?' : '₦' + Number(n).toLocaleString('en-NG');
  const modeIcon = { bus: 'bus', keke: 'car', taxi: 'car', train: 'route' };
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');

  /* ---------- Leaflet, loaded once, from cdnjs. Falls back to a list if it cannot load. ---------- */
  let leafletReady = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(true);
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((res) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
      setTimeout(() => res(!!window.L), 6000);
    });
    return leafletReady;
  }
  async function drawMap(el, legs, focus) {
    const box = el.querySelector('#map'); if (!box) return;
    const ok = await loadLeaflet();
    if (!ok) { box.innerHTML = `<div class="placeholder" style="height:100%;padding:20px"><div class="small muted">Map could not load on this connection. The route steps below still work.</div></div>`; return; }
    box.innerHTML = '';
    const map = L.map(box, { zoomControl: false, attributionControl: true }).setView([9.06, 7.45], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    const bounds = [];
    legs.forEach((leg) => {
      const pts = leg.path.map((p) => [p.lat, p.lng]); bounds.push(...pts);
      const line = leg.geometry && leg.geometry.length > 1 ? leg.geometry : pts;
      L.polyline(line, { color: leg.color || '#7ED957', weight: 6, opacity: .9, lineJoin: 'round' }).addTo(map);
      leg.path.forEach((p, i) => { const end = i === 0 || i === leg.path.length - 1; L.circleMarker([p.lat, p.lng], { radius: end ? 8 : 5, color: '#fff', weight: 2, fillColor: end ? '#1B1B1F' : (leg.color || '#7ED957'), fillOpacity: 1 }).addTo(map).bindTooltip(p.name, { direction: 'top', offset: [0, -8] }); });
      if (leg.ridersNow) { const mid = leg.path[Math.floor(leg.path.length / 2)]; L.marker([mid.lat, mid.lng], { icon: L.divIcon({ className: '', html: `<div style="background:#1B1B1F;color:#fff;border-radius:12px;padding:3px 8px;font:700 11px Inter,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">${leg.ridersNow} rider${leg.ridersNow === 1 ? '' : 's'} now</div>`, iconAnchor: [30, 12] }) }).addTo(map); }
    });
    if (focus) { bounds.push([focus.lat, focus.lng]); L.circleMarker([focus.lat, focus.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#FF7A1A', fillOpacity: 1 }).addTo(map).bindTooltip(focus.name); }
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    setTimeout(() => map.invalidateSize(), 200);
  }

  /* ---------- Place picker ---------- */
  function picker(el, onPick) {
    const sheet = el.querySelector('#picker');
    return async (title) => {
      const { places } = await api.wakaPlaces();
      sheet.innerHTML = `<div style="position:fixed;inset:0;background:var(--surface);z-index:30;display:flex;flex-direction:column;max-width:480px;margin:0 auto">
        <header class="topbar"><button class="iconbtn" id="pclose" aria-label="Close">${icon('arrow-left')}</button><h1>${h(title)}</h1></header>
        <div class="pad"><div class="card row" style="height:48px;padding:0 16px"><label for="pq" style="position:absolute;left:-9999px">Search places</label>${icon('magnifying-glass')}<input id="pq" type="search" placeholder="Park, junction, landmark" autofocus style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div></div>
        <div id="plist" class="pad stack" style="gap:6px;padding-top:12px;overflow-y:auto;flex:1"></div></div>`;
      const list = sheet.querySelector('#plist');
      const render = (v) => { const vv = v.trim().toLowerCase(); const rows = places.filter((p) => !vv || p.name.toLowerCase().includes(vv) || p.district.toLowerCase().includes(vv)); list.innerHTML = rows.map((p) => `<button class="card row" data-p="${p.id}" style="padding:12px 14px;text-align:left;width:100%;gap:12px"><span class="iconbtn" style="width:36px;height:36px;font-size:14px;color:${p.kind === 'park' ? 'var(--orange-dark)' : 'var(--ink-3)'}">${icon(p.kind === 'park' ? 'bus' : 'location-dot')}</span><span class="grow"><span style="font-size:15px;font-weight:600;display:block">${h(p.name)}</span><span class="small muted">${h(p.district)}${p.kind === 'park' ? ' · motor park' : ''}</span></span></button>`).join('') || `<div class="small muted center" style="padding:30px 0">No place found. More stops are added as riders suggest them.</div>`; };
      render('');
      sheet.querySelector('#pq').addEventListener('input', (e) => render(e.target.value));
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
        <div class="row" style="gap:10px"><div style="flex:1;height:1px;background:var(--line)"></div><button class="iconbtn" id="swap" aria-label="Swap" style="width:36px;height:36px">${icon('sliders')}</button></div>
        <button class="row" id="to" style="height:52px;padding:0 14px;background:var(--surface);border:1px solid var(--line);border-radius:14px;width:100%;text-align:left;gap:12px"><span style="width:10px;height:10px;border-radius:5px;background:var(--orange)"></span><span class="grow" id="toName" style="font-size:15px;color:var(--ink-3)">Where to?</span></button>
        <button class="btn btn-primary" id="plan" disabled>${icon('route')} Find the way</button>
      </div>
      ${saved.length ? `<div class="stack" style="gap:10px"><div class="section">SAVED</div><div class="card list">${saved.map((s) => `<a class="item" href="#/waka/plan?from=${s.from}&to=${s.to}"><div class="mi">${icon('bookmark')}</div><div class="grow"><div class="t">${h(s.label || s.fromName + ' to ' + s.toName)}</div><div class="s">${h(s.fromName)} → ${h(s.toName)}</div></div>${icon('chevron-right')}</a>`).join('')}</div></div>` : ''}
      <div class="stack" style="gap:10px"><div class="section">ROUTES RIGHT NOW</div>
        <div class="card list">${busy_.map((r) => `<a class="item" href="#/waka/route/${r.id}"><div class="mi" style="color:${r.color}">${icon(modeIcon[r.mode])}</div><div class="grow"><div class="t">${h(r.name)}</div><div class="s">${r.modeLabel} · ${naira(r.fare.amount)}${r.fare.confirmed ? '' : ' est.'} · ${r.stops.length} stops</div></div>${r.ridersNow ? `<span class="tag green">${r.ridersNow} now</span>` : ''}${icon('chevron-right')}</a>`).join('')}</div>
        <div class="small muted" style="line-height:1.5">Fares marked est. are starting estimates. When riders report what they paid, the real fare replaces them.</div>
      </div>
    </main>
    <div id="picker"></div>`;
  }, {
    mount(el) {
      let from = null, to = null; const pick = picker(el, () => {});
      const set = () => { el.querySelector('#fromName').textContent = from ? from.name : 'Where from?'; el.querySelector('#fromName').style.color = from ? 'var(--ink)' : ''; el.querySelector('#toName').textContent = to ? to.name : 'Where to?'; el.querySelector('#toName').style.color = to ? 'var(--ink)' : ''; el.querySelector('#plan').disabled = !(from && to && from.id !== to.id); };
      el.querySelector('#from').addEventListener('click', () => picker(el, (p) => { from = p; set(); })('Where from?'));
      el.querySelector('#to').addEventListener('click', () => picker(el, (p) => { to = p; set(); })('Where to?'));
      el.querySelector('#swap').addEventListener('click', () => { [from, to] = [to, from]; set(); });
      el.querySelector('#plan').addEventListener('click', () => go(`/waka/plan?from=${from.id}&to=${to.id}`));
    }
  });

  /* ---------- Plan results ---------- */
  function legRow(l, i, showActions) {
    return `<div class="row" style="gap:14px;align-items:flex-start">
      <div style="display:flex;flex-direction:column;align-items:center;width:36px"><div style="width:36px;height:36px;border-radius:18px;background:${l.color || 'var(--ink)'};display:flex;align-items:center;justify-content:center;color:#fff">${icon(modeIcon[l.mode])}</div></div>
      <div class="grow"><div class="row" style="justify-content:space-between;gap:10px"><div style="font-size:15px;font-weight:700">${h(l.routeName)}</div><div style="font-size:15px;font-weight:700">${naira(l.fare.amount)}<span class="small muted" style="font-weight:500">${l.fare.confirmed ? ` · ${l.fare.reports} report${l.fare.reports === 1 ? '' : 's'}` : ' est.'}</span></div></div>
        <div class="small muted" style="margin-top:3px;line-height:1.45">${h(l.from.name)} → ${h(l.to.name)} · ${l.km} km · about ${l.minutes} min${l.ridersNow ? ` · <strong style="color:var(--green-dark)">${l.ridersNow} rider${l.ridersNow === 1 ? '' : 's'} on it now</strong>` : ''}</div>
        <div class="small" style="margin-top:3px">${h(l.say)}</div>
        ${showActions && l.routeId ? `<div class="row" style="gap:8px;margin-top:8px"><a class="btn btn-sm btn-outline" href="#/waka/route/${l.routeId}?from=${l.from.id}&to=${l.to.id}">Route details</a><button class="btn btn-sm btn-outline" data-report="${l.routeId}" data-from="${l.from.id}" data-to="${l.to.id}">${icon('naira-sign')} Report fare</button><button class="btn btn-sm btn-ink" data-checkin="${l.routeId}">${icon('bus')} I'm on this</button></div>` : ''}
      </div></div>`;
  }
  route('/waka/plan', { auth: true, tabs: '' }, async () => {
    const from = +q().get('from'), to = +q().get('to');
    const d = await api.wakaPlan(from, to);
    const all = [...d.options, d.taxi];
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
        <button class="btn btn-sm btn-outline" data-expand>Show steps</button>
      </div>`).join('')}
      ${!d.options.length ? `<div class="card" style="padding:16px"><div class="h-sm">No bus or keke route on record yet</div><div class="small muted" style="line-height:1.5">Buja knows ${'the main parks and junctions'} so far. Tell us how you make this trip and we add it: Me → Suggest a route.</div></div>` : ''}
      <div class="small muted" style="line-height:1.5;padding-bottom:8px">Times assume Abuja traffic and waiting at the park. Report the fare you paid and it updates for everyone.</div>
    </main>
    <div id="sheet"></div>`;
  }, {
    mount(el) {
      const from = +q().get('from'), to = +q().get('to');
      api.wakaPlan(from, to).then((d) => drawMap(el, (d.options[0] || d.taxi).legs));
      el.querySelectorAll('[data-expand]').forEach((b) => b.addEventListener('click', () => { const box = b.closest('[data-opt]').querySelector('[data-legs]'); const open = box.style.display === 'none'; box.style.display = open ? '' : 'none'; b.textContent = open ? 'Hide steps' : 'Show steps'; if (open) { const i = +b.closest('[data-opt]').dataset.opt; api.wakaPlan(from, to).then((d) => drawMap(el, [...d.options, d.taxi][i].legs)); } }));
      bindLegActions(el);
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
