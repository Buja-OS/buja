import { createMap, pinHtml, meHtml, bottomSheet } from './map.js';
// Buja city signals: what the crowd knows right now. Registered by app.js.
export function registerCitySignals({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon, avatar , placeHref } = ui;
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const ago = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 60 ? 'just now' : d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  const naira = (n) => '₦' + Number(n).toLocaleString();
  const tel = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');
  function here(ms = 4000) { if (!navigator.geolocation) return Promise.resolve(null); return new Promise((res) => { let d = false; const f = (v) => { if (!d) { d = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 120000 }); }); }
  async function shrink(f, max = 1200) { const b = await createImageBitmap(f).catch(() => null); if (!b) return f; const s = Math.min(1, max / Math.max(b.width, b.height)); const c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); const bl = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); return new File([bl], 'photo.jpg', { type: 'image/jpeg' }); }

  /* ================================ LIGHT WATCH ================================ */
  const lightDot = (d) => d.state === null ? 'var(--line)' : d.mixed ? 'var(--orange)' : d.state ? 'var(--green)' : '#D92D20';
  route('/light', { auth: true, tabs: '' }, async () => {
    const d = await api.light();
    const mine = d.districts.find((x) => x.district === d.district);
    return `${topbar('Light Watch', '/home')}
    <main class="pad stack" style="gap:12px">
      <div class="card stack" style="padding:16px;gap:12px;background:var(--night);color:#fff;border-color:var(--night)">
        <div class="row" style="gap:12px"><span style="width:14px;height:14px;border-radius:7px;background:${mine ? lightDot(mine) : 'var(--line)'};flex-shrink:0;box-shadow:0 0 0 4px rgba(255,255,255,.08)"></span><div class="grow"><div style="font-size:18px;font-weight:700">${h(d.district || 'Set your district under Me')}</div><div class="small" style="color:#B5B5BC">${mine ? h(mine.label) + (mine.n ? ` · ${mine.n} report${mine.n === 1 ? '' : 's'}, last ${ago(mine.last)}` : '') : 'No reports yet'}</div></div></div>
        <div style="font-size:14px;font-weight:600">Do you have light right now?</div>
        <div class="row" style="gap:8px"><button class="btn" id="lon" style="flex:1;background:var(--green);color:#101014;border:none">${icon('bolt')} Yes, light is on</button><button class="btn" id="loff" style="flex:1;background:#D92D20;color:#fff;border:none">No, it is off</button></div>
        <div class="small" style="color:#9AA0AB;line-height:1.5">${d.mine ? `You said ${d.mine.state ? 'on' : 'off'} ${ago(d.mine.at)}. Tap again if it changed.` : "One tap. Your report joins those of your neighbours and expires in three hours. Generator or inverter? Report what NEPA is doing, not your house."}</div>
      </div>
      ${d.history.length ? `<div class="card stack" style="padding:14px;gap:8px"><div class="h-sm">${h(d.district)}, this week</div><div class="row" style="gap:6px;align-items:flex-end;height:70px">${d.history.map((x) => `<div style="flex:1;text-align:center"><div style="height:${Math.max(4, x.hoursOn / Math.max(1, x.hoursSeen) * 52)}px;background:var(--green);border-radius:6px 6px 2px 2px;margin:0 auto;width:70%"></div><div class="small muted" style="margin-top:4px">${h(x.day)}</div></div>`).join('')}</div><div class="small muted">Share of reported hours with light. Only hours somebody reported count.</div></div>` : ''}
      <div class="section">ACROSS ABUJA</div>
      <div class="card list">${d.districts.filter((x) => x.district !== d.district).map((x) => `<div class="item"><span style="width:12px;height:12px;border-radius:6px;background:${lightDot(x)};flex-shrink:0;margin:0 6px"></span><div class="grow"><div class="t">${h(x.district)}</div><div class="s">${h(x.label)}${x.n ? ` · ${x.n} · ${ago(x.last)}` : ''}</div></div>${x.confidence ? `<span class="small muted">${x.confidence}%</span>` : ''}</div>`).join('')}</div>
      <div class="small muted" style="line-height:1.5">Buja cannot sense electricity. It weighs what people say: fresh reports count more than old ones, many count more than one, and a district with fewer than three fresh reports is shown as unknown rather than guessed. You get a notification when your district flips.</div>
    </main>`;
  }, {
    mount(el) {
      const send = async (state, b) => { busy(b, true); const p = await here(3000); try { await api.lightReport({ state, lat: p?.lat, lng: p?.lng, source: 'tap' }); toast('Thank you. Your neighbours can see it.'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } };
      el.querySelector('#lon').addEventListener('click', (e) => send(true, e.currentTarget));
      el.querySelector('#loff').addEventListener('click', (e) => send(false, e.currentTarget));
    }
  });

  /** Runs once at startup: the charging signal, from around home only, and the once-a-day Home prompt. */
  window.bujaLightWatch = () => {
    if (!state.user || !navigator.getBattery) return;
    navigator.getBattery().then((bat) => {
      let last = 0;
      const push = async () => { if (Date.now() - last < 600000) return; last = Date.now(); const p = await here(3000); if (!p) return; api.lightReport({ state: bat.charging, lat: p.lat, lng: p.lng, source: 'charging' }).catch(() => {}); };
      bat.addEventListener('chargingchange', push);
    }).catch(() => {});
  };

  /* ================================ FUEL BOARD ================================ */
  const QLABEL = { none: 'No queue', short: 'Short queue', long: 'Long queue', closed: 'No fuel' };
  const QCOL = { none: 'var(--green-dark)', short: 'var(--orange-dark)', long: '#D92D20', closed: 'var(--ink-3)' };
  route('/fuel', { auth: true, tabs: '' }, async () => {
    const at = await here(3500);
    const d = await api.fuel(at || {});
    return `${topbar('Fuel board', '/home', `<a class="iconbtn" href="#/fuel/map" aria-label="Fuel on the map" style="margin-right:6px">${icon('map-location-dot')}</a><a class="iconbtn" href="#/fuel/add" aria-label="Add a station" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <main class="pad stack" style="gap:10px">
      <div class="small muted row" style="gap:6px">${icon('location-dot')} ${at ? 'Nearest first' : 'Turn on location to sort by distance'} · ${d.count} station${d.count === 1 ? '' : 's'} known</div>
      ${d.stations.length ? d.stations.map((s) => `<div class="card stack" style="padding:12px 14px;gap:8px">
        <div class="row" style="gap:10px"><div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${h(s.name)}</div><div class="small muted">${s.brand ? h(s.brand) + ' · ' : ''}${h(s.district)}${s.km != null ? ' · ' + s.km + ' km' : ''}</div></div>${s.report ? `<span class="tag" style="background:var(--surface);color:${QCOL[s.report.queue]};font-weight:700">${QLABEL[s.report.queue]}</span>` : ''}</div>
        ${s.report ? `<div class="row" style="gap:14px;font-size:14px">${s.report.petrol ? `<span><strong>${naira(s.report.petrol)}</strong> <span class="small muted">petrol</span></span>` : ''}${s.report.diesel ? `<span><strong>${naira(s.report.diesel)}</strong> <span class="small muted">diesel</span></span>` : ''}<span class="grow"></span><span class="small ${s.report.stale ? 'muted' : ''}" style="${s.report.stale ? '' : 'color:var(--green-dark)'}">${h(s.report.by)}, ${ago(s.report.at)}</span></div>` : `<div class="small muted">Nobody has reported here yet.</div>`}
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline grow" data-report="${s.id}" data-name="${h(s.name)}">I am here, update it</button><a class="iconbtn" href="${h(placeHref({ lat: s.lat, lng: s.lng, name: s.name, sub: s.district || '' }))}" style="width:34px;height:34px" aria-label="Map">${icon('location-dot')}</a></div>
      </div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('bolt')}</div><div class="h-md">No stations yet</div><div class="small muted" style="max-width:290px;line-height:1.55">An admin can pull every station in the FCT from OpenStreetMap in one tap, or add the one you are standing at.</div></div>`}
      <div id="sheet"></div>
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => {
        el.querySelector('#sheet').innerHTML = `<div class="card stack" style="padding:16px;gap:12px;position:fixed;left:12px;right:12px;bottom:calc(12px + var(--safe-b));z-index:60;box-shadow:0 16px 40px rgba(0,0,0,.3)"><div class="row"><div class="h-sm grow">${h(b.dataset.name)}</div><button class="iconbtn" id="fx" style="width:34px;height:34px">${icon('xmark')}</button></div>
          <div class="row" style="gap:6px;flex-wrap:wrap" id="fq">${Object.entries(QLABEL).map(([k, l], i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-q="${k}">${l}</button>`).join('')}</div>
          <div class="row" style="gap:8px"><div class="field grow" style="margin:0"><label for="fp">Petrol ₦/litre</label><input class="input" id="fp" type="number" inputmode="numeric" placeholder="1,050"></div><div class="field grow" style="margin:0"><label for="fd">Diesel ₦/litre</label><input class="input" id="fd" type="number" inputmode="numeric" placeholder="optional"></div></div>
          <button class="btn btn-primary" id="fs">Post it</button></div>`;
        let qv = 'none'; const sh = el.querySelector('#sheet');
        sh.querySelectorAll('[data-q]').forEach((c) => c.addEventListener('click', () => { qv = c.dataset.q; sh.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === c)); }));
        sh.querySelector('#fx').addEventListener('click', () => { sh.innerHTML = ''; });
        sh.querySelector('#fs').addEventListener('click', async (e) => { busy(e.currentTarget, true); try { await api.fuelReport(b.dataset.report, { queue: qv, petrol: sh.querySelector('#fp').value, diesel: sh.querySelector('#fd').value }); toast('Posted. Thank you.'); location.reload(); } catch (err) { busy(e.currentTarget, false); failed(el, err); } });
      }));
    }
  });
  route('/fuel/map', { auth: true, tabs: '' }, async () => `<div class="bm-screen"><div class="bm-mapbox" id="map"></div>
    <div class="bm-top"><a class="bm-fab" href="#/fuel" aria-label="Back to the list">${icon('arrow-left')}</a><div class="bm-pill">Fuel near you</div></div></div>`, {
    async mount(el) {
      const screen = el.querySelector('.bm-screen'); const sheet = bottomSheet(screen, { peek: 160, half: 0.42, start: 'half' });
      sheet.body.innerHTML = `<div class="small muted" style="padding:6px 0">Finding stations…</div>`;
      const at = await here(4000);
      const map = await createMap(el.querySelector('#map'), { center: at ? [at.lng, at.lat] : undefined, zoom: at ? 13 : 12 });
      const d = await api.fuel(at || {});
      const COL = { none: '#2E7D1E', short: '#B7791F', long: '#D92D20', closed: '#9AA0AB' };
      if (map) {
        if (at) map.marker('me', { ...at, html: meHtml(), anchor: 'center', z: 5 });
        d.stations.forEach((s) => map.marker('f' + s.id, { lng: s.lng, lat: s.lat, z: s.report && !s.report.stale ? 3 : 1, html: pinHtml({ iconName: 'gas-pump', color: s.report && !s.report.stale ? COL[s.report.queue] : '#6B6B73', size: 34, label: s.report && s.report.petrol ? naira(s.report.petrol) : s.name, sub: s.report ? QLABEL[s.report.queue] : 'no report' }), onClick: () => show(s) }));
        map.fit((at ? [[at.lng, at.lat]] : []).concat(d.stations.slice(0, 6).map((s) => [s.lng, s.lat])), { bottom: window.innerHeight * 0.44 });
      }
      const list = () => {
        sheet.body.innerHTML = `<i data-sheet-list hidden></i><div class="row" style="padding:2px 0 8px"><div class="grow"><div style="font-size:17px;font-weight:800">${d.stations.length} stations</div><div class="small muted">Green: no queue · amber: short · red: long · grey: no fuel or no recent report</div></div></div>
          ${d.stations.slice(0, 12).map((s) => `<button class="row card" data-s="${s.id}" style="width:100%;text-align:left;padding:10px 12px;gap:10px;margin-bottom:8px;background:var(--card)"><span style="width:36px;height:36px;border-radius:18px;background:${s.report && !s.report.stale ? COL[s.report.queue] : '#9AA0AB'};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('gas-pump')}</span><span class="grow" style="min-width:0"><span style="display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(s.name)}</span><span class="small muted">${s.km != null ? s.km + ' km · ' : ''}${s.report ? QLABEL[s.report.queue] + ' · ' + ago(s.report.at) : 'no report yet'}</span></span>${s.report && s.report.petrol ? `<strong>${naira(s.report.petrol)}</strong>` : ''}</button>`).join('')}`;
        sheet.body.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => show(d.stations.find((x) => String(x.id) === b.dataset.s))));
      };
      const show = (s) => {
        if (map) map.center(s.lng, s.lat, 15);
        sheet.body.innerHTML = `<div class="stack" style="gap:10px;padding-top:4px"><div><div style="font-size:18px;font-weight:800">${h(s.name)}</div><div class="small muted">${s.brand ? h(s.brand) + ' · ' : ''}${h(s.district)}${s.km != null ? ' · ' + s.km + ' km' : ''}</div></div>
          ${s.report ? `<div class="row" style="gap:14px;font-size:15px">${s.report.petrol ? `<span><strong>${naira(s.report.petrol)}</strong> <span class="small muted">petrol</span></span>` : ''}${s.report.diesel ? `<span><strong>${naira(s.report.diesel)}</strong> <span class="small muted">diesel</span></span>` : ''}<span class="tag">${QLABEL[s.report.queue]}</span></div><div class="small muted">${h(s.report.by)}, ${ago(s.report.at)}</div>` : '<div class="small muted">Nobody has reported here yet.</div>'}
          <a class="btn btn-primary" href="${h(placeHref({ lat: s.lat, lng: s.lng, name: s.name, sub: s.district || '', icon: 'gas-pump' }))}">${icon('route')} Directions</a>
          <a class="btn btn-outline" href="#/fuel">I am here, update it</a><button class="btn btn-ghost small" id="back">Back</button></div>`;
        sheet.set('half'); sheet.body.querySelector('#back').addEventListener('click', list);
      };
      list();
    }
  });
  route('/fuel/add', { auth: true, tabs: '' }, async () => `${topbar('Add a station', '/fuel')}
    <form id="ff" class="pad stack" style="gap:14px">${field({ id: 'name', label: 'Station name', placeholder: 'NNPC, Airport Road by Lugbe' })}${field({ id: 'brand', label: 'Brand (optional)', placeholder: 'NNPC, Conoil, TotalEnergies, AA Rano' })}
      <div class="small muted" style="line-height:1.5">Stand at the station when you add it; Buja pins it where you are.</div><button class="btn btn-primary" type="submit">${icon('location-dot')} Add it here</button></form>`, {
    mount(el) { clearOnInput(el); el.querySelector('#ff').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); const p = await here(10000); if (!p) { busy(btn, false); toast('Could not get your location.'); return; } try { await api.fuelStation({ name: el.querySelector('#name').value, brand: el.querySelector('#brand').value, lat: p.lat, lng: p.lng }); toast('Added'); go('/fuel'); } catch (err) { busy(btn, false); failed(el, err); } }); }
  });

  /* ================================ BLOOD ================================ */
  route('/blood', { auth: true, tabs: '' }, async () => {
    const d = await api.blood();
    return `${topbar('Blood donors', '/home', `<a class="iconbtn" href="#/blood/request" aria-label="Request blood" style="background:#D92D20;border-color:#D92D20;color:#fff">${icon('plus')}</a>`)}
    <main class="pad stack" style="gap:12px">
      <a class="card row" href="#/blood/request" style="padding:14px;gap:12px;background:#D92D20;color:#fff;border-color:#D92D20"><span style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800">+</span><span class="grow"><span style="display:block;font-size:15px;font-weight:700">Someone needs blood now?</span><span class="small" style="opacity:.85">Post it and matching donors nearby are alerted in seconds.</span></span>${icon('chevron-right')}</a>
      ${d.donor ? `<div class="card row" style="padding:14px;gap:12px"><span style="width:48px;height:48px;border-radius:14px;background:var(--green-tint);color:var(--green-dark);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800">${h(d.donor.group)}</span><div class="grow"><div style="font-size:14px;font-weight:650">You are ${d.donor.willing ? 'a registered donor' : 'registered, but paused'}</div><div class="small muted">Alerted within ${d.donor.radiusKm} km${d.donor.lastDonated ? ' · last gave ' + d.donor.lastDonated : ''}</div></div><a class="btn btn-sm btn-outline" href="#/blood/me" style="width:auto">Edit</a></div>`
      : `<a class="card row" href="#/blood/me" style="padding:14px;gap:12px;border-style:dashed"><span style="width:44px;height:44px;border-radius:14px;background:var(--green-tint);color:var(--green-dark);display:flex;align-items:center;justify-content:center">${icon('heart')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:650">Become a donor</span><span class="small muted">Register your blood group once. ${d.donors} people in Abuja already have.</span></span>${icon('chevron-right')}</a>`}
      <div class="section">OPEN REQUESTS</div>
      ${d.requests.length ? d.requests.map((r) => `<div class="card stack" style="padding:14px;gap:8px;${r.canGive ? 'border-color:var(--green)' : ''}">
        <div class="row" style="gap:12px"><span style="width:46px;height:46px;border-radius:14px;background:#FDECEA;color:#D92D20;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;flex-shrink:0">${h(r.group)}</span><div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${r.units} unit${r.units === 1 ? '' : 's'} at ${h(r.hospital)}</div><div class="small muted">${h(r.district)}${r.km != null ? ' · ' + r.km + ' km' : ''} · ${r.urgency === 'today' ? 'needed today' : r.urgency === '48h' ? 'within 2 days' : 'this week'} · ${ago(r.at)}</div></div></div>
        ${r.note ? `<div class="small" style="color:var(--ink-2);line-height:1.5">${h(r.note)}</div>` : ''}
        <div class="row small" style="gap:8px"><span class="muted">${r.responders} ${r.responders === 1 ? 'person has' : 'people have'} offered</span><span class="grow"></span>${r.canGive ? `<span class="tag green">You match</span>` : ''}</div>
        <div class="row" style="gap:8px">${r.mine ? `<button class="btn btn-sm btn-ink grow" data-close="${r.id}" data-f="1">Got it, thank you</button><button class="btn btn-sm btn-outline" data-close="${r.id}" data-f="0" style="width:auto">Close</button>` : r.responded ? `<a class="btn btn-sm btn-primary grow" href="${tel(r.phone)}">${icon('phone')} Call ${h(r.by)}</a>` : `<button class="btn btn-sm btn-primary grow" data-respond="${r.id}">${icon('heart')} I can donate</button>`}</div>
      </div>`).join('') : `<div class="small muted" style="padding:10px 0">No open requests right now. Good.</div>`}
      <div class="small muted" style="line-height:1.5">Donors see the hospital and district, never the patient's details. When you offer, the requester gets your first name and, if you allow it, your phone. Only compatible groups are alerted.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-respond]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.bloodRespond(b.dataset.respond); toast('They have been told. Thank you.'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
      el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', async () => { try { await api.bloodClose(b.dataset.close, b.dataset.f === '1'); location.reload(); } catch (err) { failed(el, err); } }));
    }
  });
  route('/blood/me', { auth: true, tabs: '' }, async () => {
    const d = await api.blood(); const m = d.donor;
    return `${topbar('Donor card', '/blood')}<form id="bf" class="pad stack" style="gap:14px">
      <div class="field"><label>Blood group</label><div class="row" style="gap:6px;flex-wrap:wrap" id="bg">${d.groups.map((g) => `<button type="button" class="chip ${m && m.group === g ? 'on' : ''}" data-g="${g}" style="min-width:56px;justify-content:center;font-weight:700">${g}</button>`).join('')}</div></div>
      <div class="field"><label for="radiusKm">Alert me within</label><select class="input" id="radiusKm">${[5, 10, 20, 35, 50].map((n) => `<option value="${n}" ${(m ? m.radiusKm : 10) === n ? 'selected' : ''}>${n} km</option>`).join('')}</select></div>
      ${field({ id: 'lastDonated', label: 'Last donated (optional)', type: 'date', value: m ? (m.lastDonated || '') : '' })}
      <label class="check" style="align-items:center"><input type="checkbox" id="willing" ${!m || m.willing ? 'checked' : ''}>Alert me when someone nearby needs my group</label>
      <label class="check" style="align-items:center"><input type="checkbox" id="sharePhone" ${!m || m.sharePhone ? 'checked' : ''}>Share my phone number when I offer to donate</label>
      <button class="btn btn-primary" type="submit">${icon('heart')} Save</button>
      <div class="small muted" style="line-height:1.55">Healthy adults can give whole blood every three months. Buja will not alert you within 8 weeks of the date you gave.</div></form>`;
  }, {
    mount(el) {
      clearOnInput(el); let g = el.querySelector('#bg .on')?.dataset.g || '';
      el.querySelectorAll('#bg [data-g]').forEach((b) => b.addEventListener('click', () => { g = b.dataset.g; el.querySelectorAll('#bg [data-g]').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelector('#bf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { await api.donorSave({ group: g, radiusKm: el.querySelector('#radiusKm').value, lastDonated: el.querySelector('#lastDonated').value, willing: el.querySelector('#willing').checked, sharePhone: el.querySelector('#sharePhone').checked }); toast('Saved. Thank you for this.'); go('/blood'); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });
  route('/blood/request', { auth: true, tabs: '' }, async () => {
    const d = await api.blood();
    return `${topbar('Request blood', '/blood')}<form id="rf" class="pad stack" style="gap:14px">
      <div class="field"><label>Group needed</label><div class="row" style="gap:6px;flex-wrap:wrap" id="bg">${d.groups.map((g) => `<button type="button" class="chip" data-g="${g}" style="min-width:56px;justify-content:center;font-weight:700">${g}</button>`).join('')}</div><div class="error" data-error="group"></div></div>
      <div class="row" style="gap:10px">${field({ id: 'units', label: 'Units', type: 'number', value: '1', inputmode: 'numeric' })}<div class="field grow"><label for="urgency">How soon</label><select class="input" id="urgency"><option value="today">Today</option><option value="48h">Within 2 days</option><option value="week">This week</option></select></div></div>
      ${field({ id: 'hospital', label: 'Hospital', placeholder: 'National Hospital, Central Area' })}
      <div class="field"><label for="district">District</label><select class="input" id="district">${DISTRICTS.map((x) => `<option ${x === state.user.district ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      ${field({ id: 'phone', label: 'Phone donors should call', value: state.user.phone || '', inputmode: 'tel' })}
      <div class="field"><label for="note">Anything donors should know (optional)</label><textarea class="input" id="note" maxlength="500" placeholder="Ask for the blood bank at the emergency entrance. Surgery is 2pm." style="height:90px;padding:12px 14px;resize:none"></textarea></div>
      <button class="btn btn-primary" type="submit" style="background:#D92D20">${icon('paper-plane')} Alert matching donors</button>
      <div class="small muted" style="line-height:1.55">Compatible donors within reach get a push notification straight away, closest first. Close the request when you have enough so people stop coming.</div></form>`;
  }, {
    mount(el) {
      clearOnInput(el); let g = '';
      el.querySelectorAll('#bg [data-g]').forEach((b) => b.addEventListener('click', () => { g = b.dataset.g; el.querySelectorAll('#bg [data-g]').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelector('#rf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); const p = await here(3000); try { const r = await api.bloodRequest({ group: g, units: el.querySelector('#units').value, urgency: el.querySelector('#urgency').value, hospital: el.querySelector('#hospital').value, district: el.querySelector('#district').value, phone: el.querySelector('#phone').value, note: el.querySelector('#note').value, lat: p?.lat, lng: p?.lng }); toast(r.told ? `${r.told} matching donor${r.told === 1 ? '' : 's'} alerted.` : 'Posted. No registered donors match yet; share the link too.'); go('/blood'); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });

  /* ================================ LOST AND FOUND ================================ */
  route('/lostfound', { auth: true, tabs: '' }, async () => {
    const f = Object.fromEntries(q().entries());
    const d = await api.lostFound(f);
    return `${topbar('Lost and found', '/home', `<a class="iconbtn" href="#/lostfound/new" aria-label="Post" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <form id="lf" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px">${icon('magnifying-glass')}<input name="q" type="search" value="${h(f.q || '')}" placeholder="Name on the document, place, colour" style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div></form>
    <div class="row" style="gap:8px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none"><a class="chip ${!f.kind ? 'on' : ''}" href="#/lostfound?${new URLSearchParams({ ...f, kind: '' })}">All</a><a class="chip ${f.kind === 'lost' ? 'on' : ''}" href="#/lostfound?${new URLSearchParams({ ...f, kind: 'lost' })}">Lost</a><a class="chip ${f.kind === 'found' ? 'on' : ''}" href="#/lostfound?${new URLSearchParams({ ...f, kind: 'found' })}">Found</a>${Object.entries(d.types).map(([k, l]) => `<a class="chip ${f.item === k ? 'on' : ''}" href="#/lostfound?${new URLSearchParams({ ...f, item: f.item === k ? '' : k })}">${h(l)}</a>`).join('')}</div>
    <main class="pad stack" style="gap:10px;padding-top:12px">
      ${d.items.length ? d.items.map((i) => `<div class="card stack" style="padding:12px 14px;gap:8px">
        <div class="row" style="gap:10px"><span class="tag" style="background:${i.kind === 'found' ? 'var(--green-tint)' : '#FDECEA'};color:${i.kind === 'found' ? 'var(--green-dark)' : '#D92D20'};font-weight:700">${i.kind.toUpperCase()}</span><div class="grow"><div style="font-size:15px;font-weight:700">${h(i.itemLabel)}${i.nameOnIt ? ` · ${h(i.nameOnIt)}` : ''}</div><div class="small muted">${h(i.district)}${i.place ? ' · ' + h(i.place) : ''} · ${ago(i.at)}</div></div></div>
        ${i.photo ? `<img src="${i.photo}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px">` : ''}
        <div style="font-size:14px;line-height:1.5;color:var(--ink-2)">${h(i.description)}</div>
        <div class="row" style="gap:8px">${i.mine ? `<button class="btn btn-sm btn-outline grow" data-close="${i.id}">Mark as resolved</button>` : `<button class="btn btn-sm btn-ink grow" data-contact="${i.id}">${icon('message')} ${i.kind === 'found' ? 'That is mine' : 'I found it'}</button>`}</div>
      </div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('magnifying-glass')}</div><div class="h-md">Nothing here yet</div><div class="small muted" style="max-width:290px;line-height:1.55">Lost your NIN slip, licence or keys? Found a phone in a keke? Post it. When a found item carries a name that matches a lost post, Buja tells the owner.</div></div>`}
      <div class="small muted" style="line-height:1.5">When you post something you found, cover the numbers on the photo. Meet in public to hand it over, and never pay to get your own document back.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelector('#lf').addEventListener('submit', (e) => { e.preventDefault(); const p = q(); p.set('q', e.target.q.value); go('/lostfound?' + p); });
      el.querySelectorAll('[data-contact]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.lostFoundContact(b.dataset.contact); go('/inbox/' + r.threadId); } catch (err) { busy(b, false); failed(el, err); } }));
      el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', async () => { try { await api.lostFoundClose(b.dataset.close); toast('Glad it worked out.'); location.reload(); } catch (err) { failed(el, err); } }));
    }
  });
  route('/lostfound/new', { auth: true, tabs: '' }, async () => {
    const d = await api.lostFound({});
    return `${topbar('Post it', '/lostfound')}<form id="nf" class="pad stack" style="gap:14px">
      <div class="seg" id="kind"><button type="button" class="on" data-k="lost">I lost something</button><button type="button" data-k="found">I found something</button></div>
      <div class="field"><label for="item">What</label><select class="input" id="item">${Object.entries(d.types).map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('')}</select></div>
      ${field({ id: 'nameOnIt', label: 'Name on it (if any)', placeholder: 'As printed on the document', hint: 'This is how Buja matches a found document to whoever lost it.' })}
      <div class="field"><label for="district">District</label><select class="input" id="district">${DISTRICTS.map((x) => `<option ${x === state.user.district ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      ${field({ id: 'place', label: 'Where exactly (optional)', placeholder: 'In a keke from Berger, a bench at Jabi Lake' })}
      <div class="field"><label for="description">Describe it</label><textarea class="input" id="description" maxlength="800" placeholder="Colour, what was inside, when, anything that proves it is yours" style="height:110px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="description"></div></div>
      <div class="row" style="gap:8px;align-items:center"><label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} Photo<input type="file" accept="image/*" id="pic" style="display:none"></label><span class="small muted" id="picname">Cover any numbers first.</span></div>
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} Post</button></form>`;
  }, {
    mount(el) {
      clearOnInput(el); let kind = 'lost', picId = null;
      el.querySelectorAll('#kind button').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.k; el.querySelectorAll('#kind button').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelector('#pic').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; el.querySelector('#picname').textContent = 'Uploading…'; try { const up = await api.upload(await shrink(f), 'image'); picId = up.upload.id; el.querySelector('#picname').textContent = 'Photo attached'; } catch (err) { failed(el, err); } });
      el.querySelector('#nf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { await api.lostFoundCreate({ kind, item: el.querySelector('#item').value, nameOnIt: el.querySelector('#nameOnIt').value, district: el.querySelector('#district').value, place: el.querySelector('#place').value, description: el.querySelector('#description').value, uploadId: picId }); toast('Posted'); go('/lostfound'); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });

  /* ================================ ONE-CHANCE PLATES ================================ */
  route('/plates', { auth: true, tabs: '' }, async () => `${topbar('Check a plate', '/home', `<a class="iconbtn" href="#/plates/report" aria-label="Report" style="background:#D92D20;border-color:#D92D20;color:#fff">${icon('plus')}</a>`)}
    <main class="pad stack" style="gap:12px">
      <div class="card stack" style="padding:16px;gap:10px"><div class="h-md">Before you enter that taxi</div><div class="small muted" style="line-height:1.5">Type the plate number. Buja tells you if anyone has reported this vehicle for one-chance, robbery or harassment.</div>
        <form id="pf" class="row" style="gap:8px"><input class="input" id="plate" placeholder="ABC 123 XY" autocapitalize="characters" autocomplete="off" style="flex:1;font-size:20px;letter-spacing:3px;text-align:center;height:54px;font-weight:700"><button class="btn btn-ink" type="submit" style="width:auto;height:54px">Check</button></form>
        <div id="res"></div></div>
      <div class="small muted" style="line-height:1.5">Reports are anonymous and only what the reporter saw. No reports is not proof of safety. Prefer registered taxis, share your trip on Buja, and sit by the door.</div>
    </main>`, {
    mount(el) {
      el.querySelector('#pf').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true);
        try { const r = await api.plateCheck(el.querySelector('#plate').value); const bad = r.reports > 0;
          el.querySelector('#res').innerHTML = `<div style="padding:14px;border-radius:12px;background:${bad ? '#FDECEA' : 'var(--green-tint)'};color:${bad ? '#D92D20' : 'var(--green-dark)'}"><div style="font-size:16px;font-weight:800;letter-spacing:2px">${h(r.plate)}</div><div style="font-size:14px;font-weight:600;margin-top:4px">${h(r.verdict)}</div>${r.items.map((i) => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.08);font-size:13px;line-height:1.5"><strong>${h(i.when)}${i.district ? ', ' + h(i.district) : ''}${i.hurt ? ', someone was hurt' : ''}</strong>${i.vehicle ? ' · ' + h(i.vehicle) : ''}<br>${h(i.what)}</div>`).join('')}</div>`;
        } catch (err) { failed(el, err); } busy(btn, false);
      });
    }
  });
  route('/plates/report', { auth: true, tabs: '' }, async () => `${topbar('Report a vehicle', '/plates')}<form id="rf" class="pad stack" style="gap:14px">
      ${field({ id: 'plate', label: 'Plate number', placeholder: 'ABC 123 XY' })}${field({ id: 'vehicle', label: 'Vehicle (optional)', placeholder: 'Grey Toyota Corolla, tinted' })}
      <div class="row" style="gap:10px"><div class="field grow"><label for="district">Where</label><select class="input" id="district">${DISTRICTS.map((x) => `<option ${x === state.user.district ? 'selected' : ''}>${x}</option>`).join('')}</select></div>${field({ id: 'happened', label: 'When', type: 'date', value: new Date().toISOString().slice(0, 10) })}</div>
      <div class="field"><label for="what">What happened</label><textarea class="input" id="what" maxlength="600" placeholder="Only what you saw or experienced yourself. Boarded at Berger going to Wuse, driver diverted towards Life Camp, two men inside demanded phones." style="height:130px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="what"></div></div>
      <label class="check" style="align-items:center"><input type="checkbox" id="hurt">Somebody was hurt</label>
      <label class="check" style="align-items:center"><input type="checkbox" id="toldPolice">I reported it to the police</label>
      <button class="btn btn-primary" type="submit" style="background:#D92D20">${icon('triangle-exclamation')} Report</button>
      <div class="small muted" style="line-height:1.55">Your name is never shown. A false report can ruin an innocent driver and is removed by moderators. For an emergency, call 112 first.</div></form>`, {
    mount(el) { clearOnInput(el); el.querySelector('#rf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { await api.plateReport({ plate: el.querySelector('#plate').value, vehicle: el.querySelector('#vehicle').value, district: el.querySelector('#district').value, happened: el.querySelector('#happened').value, what: el.querySelector('#what').value, hurt: el.querySelector('#hurt').checked, toldPolice: el.querySelector('#toldPolice').checked }); toast('Reported. Thank you.'); go('/plates'); } catch (err) { busy(btn, false); failed(el, err); } }); }
  });

  /* ================================ MARKET PRICES ================================ */
  route('/prices', { auth: true, tabs: '' }, async () => {
    const d = await api.prices();
    return `${topbar('Market prices', '/home', `<a class="iconbtn" href="#/prices/report" aria-label="Report a price" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <main class="pad stack" style="gap:10px">
      <div class="small muted">${d.reports} price${d.reports === 1 ? '' : 's'} reported in the last two weeks. Just paid for something? Tap + and tell the city.</div>
      ${d.staples.map((s) => `<div class="card stack" style="padding:12px 14px;gap:6px">
        <div class="row"><div class="grow" style="font-size:14px;font-weight:700">${h(s.label)}</div>${s.cheapest ? `<div style="font-size:16px;font-weight:800;color:var(--green-dark)">${naira(s.cheapest.price)}</div>` : `<span class="small muted">no reports</span>`}</div>
        ${s.markets.length ? `<div class="stack" style="gap:3px">${s.markets.slice(0, 4).map((m, i) => `<div class="row small" style="gap:8px"><span class="grow ${i === 0 ? '' : 'muted'}">${h(m.market)}</span><span style="font-weight:${i === 0 ? 700 : 400}">${naira(m.price)}</span><span class="muted" style="width:58px;text-align:right">${ago(m.at)}</span></div>`).join('')}${s.spread ? `<div class="small muted">Up to ${naira(s.spread)} cheaper at the best market.</div>` : ''}</div>` : ''}
      </div>`).join('')}
      <div class="small muted" style="line-height:1.5">Each price is the middle of the last five reports at that market, so one strange number cannot move it. Reports expire after two weeks.</div>
    </main>`;
  });
  route('/prices/report', { auth: true, tabs: '' }, async () => {
    const d = await api.prices();
    return `${topbar('What did you pay?', '/prices')}<form id="pf" class="pad stack" style="gap:14px">
      <div class="field"><label for="item">Item</label><select class="input" id="item">${d.staples.map((s) => `<option value="${s.key}">${h(s.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="market">Market</label><select class="input" id="market">${d.markets.map((m) => `<option>${h(m)}</option>`).join('')}</select></div>
      ${field({ id: 'price', label: 'Price paid ₦', type: 'number', placeholder: '85,000', inputmode: 'numeric' })}
      <button class="btn btn-primary" type="submit">${icon('tags')} Report it</button>
      <div class="small muted" style="line-height:1.5">Report what you actually paid, today or yesterday. Bulk or wholesale prices belong under Supermarket only if that is where you bought it.</div></form>`;
  }, {
    mount(el) { clearOnInput(el); el.querySelector('#pf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { await api.priceReport({ item: el.querySelector('#item').value, market: el.querySelector('#market').value, price: el.querySelector('#price').value }); toast('Thank you. That helps everyone.'); go('/prices'); } catch (err) { busy(btn, false); failed(el, err); } }); }
  });
}
