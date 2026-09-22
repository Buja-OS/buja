// Buja: artisans on a map, "ask them to come", and live tracking while they travel. Registered lazily by app.js.
import { createMap, pinHtml, carHtml, meHtml, bottomSheet, keepAwake, metres, TRADE_ICON, TRADE_COLOR } from './map.js';

export function registerJobs({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy, avatar } = ui;
  const stars = (r) => r && r.count ? `★ ${Number(r.stars).toFixed(1)} (${r.count})` : 'New';
  const starsShort = (r) => r && r.count ? `★ ${Number(r.stars).toFixed(1)}` : 'New';
  const clock = (iso) => new Date(String(iso).replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const here = (ms = 8000) => new Promise((res) => { if (!navigator.geolocation) return res(null); let done = false; const f = (v) => { if (!done) { done = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 30000 }); });
  const QUICK = [['mechanic', 'Mechanic'], ['vulcanizer', 'Tyres'], ['towing', 'Towing'], ['electrician', 'Electrician'], ['plumber', 'Plumber'], ['hair', 'Barber & hair'], ['tailor', 'Tailor'], ['ac', 'AC repair'], ['locksmith', 'Locksmith'], ['', 'All']];

  /* ============================== ARTISANS ON THE MAP ============================== */
  route('/artisans/map', { auth: true, tabs: '' }, async () => `<div class="bm-screen"><div class="bm-mapbox" id="map"></div>
    <div class="bm-top"><a class="bm-fab" href="#/artisans" aria-label="Back to the list">${icon('arrow-left')}</a><div class="bm-chips" id="chips"></div></div>
    <button class="bm-fab bm-locate" id="locate" aria-label="Where am I" style="top:calc(70px + var(--safe-t,0px))">${icon('location-crosshairs')}</button></div>`, {
    async mount(el) {
      const f = new URLSearchParams(location.hash.split('?')[1] || ''); let trade = f.get('trade') || '';
      const box = el.querySelector('#map'); const screen = el.querySelector('.bm-screen');
      const sheet = bottomSheet(screen, { peek: 170, half: 0.46, start: 'half' });
      sheet.body.innerHTML = `<div class="small muted" style="padding:6px 0">Finding where you are…</div>`;
      el.querySelector('#chips').innerHTML = QUICK.map(([k, l]) => `<button class="chip ${k === trade ? 'on' : ''}" data-t="${k}">${l}</button>`).join('');
      const me = await here(6000);
      const map = await createMap(box, { center: me ? [me.lng, me.lat] : undefined, zoom: me ? 13 : 12 });
      if (!map) box.innerHTML = `<div class="placeholder" style="height:100%;padding-top:90px"><div class="small muted">The map could not load on this phone. The list below still works.</div></div>`;
      if (map && me) map.marker('me', { ...me, html: meHtml(), anchor: 'center', z: 3 });
      let list = [];
      const detail = (a) => {
        el.querySelectorAll('.bm-pin.on').forEach((p) => p.classList.remove('on')); map && map.element('a' + a.id)?.querySelector('.bm-pin')?.classList.add('on');
        sheet.body.innerHTML = `<div class="stack" style="gap:12px;padding-top:4px">
          <div class="row" style="gap:12px">${a.photo ? `<img src="${h(a.photo)}" alt="" style="width:56px;height:56px;border-radius:16px;object-fit:cover">` : `<span style="width:56px;height:56px;border-radius:16px;background:${TRADE_COLOR[a.trade] || '#FF7A1A'};color:#fff;display:flex;align-items:center;justify-content:center">${icon(TRADE_ICON[a.trade] || 'wrench')}</span>`}
            <div class="grow" style="min-width:0"><div style="font-size:17px;font-weight:800">${h(a.name)}</div><div class="small muted">${h(a.tradeLabel)}${a.km != null ? ' · ' + a.km + ' km away' : ''} · ${h(a.district || '')}</div>
            <div class="row small" style="gap:8px;margin-top:3px"><strong style="color:#B7791F">${stars(a.rating)}</strong>${a.jobs ? `<span class="muted">${a.jobs} jobs</span>` : ''}${a.verified ? `<span class="tag green">${icon('circle-check')} Verified</span>` : ''}</div></div></div>
          ${a.about ? `<div class="small" style="color:var(--ink-2);line-height:1.5">${h(a.about)}</div>` : ''}
          ${a.rating && a.rating.top && a.rating.top.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${a.rating.top.slice(0, 3).map((t) => `<span class="tag">${h(t.tag || t)}</span>`).join('')}</div>` : ''}
          <button class="btn btn-primary" id="askcome" ${a.available ? '' : 'disabled'}>${icon('location-dot')} ${a.available ? 'Ask them to come to me' : 'Not taking jobs right now'}</button>
          <div class="row" style="gap:8px">${a.phone ? `<a class="btn btn-outline grow" href="tel:${h(a.phone)}">${icon('phone')} Call</a>` : ''}<button class="btn btn-outline grow" id="msg">${icon('message')} Message</button><a class="btn btn-outline" href="#/artisans/${a.id}" style="width:auto">Profile</a></div>
          <button class="btn btn-ghost small" id="backlist">Back to everyone nearby</button></div>`;
        sheet.set('half');
        if (map && a.lat != null) map.fit([[a.lng, a.lat], me ? [me.lng, me.lat] : null].filter(Boolean), { bottom: window.innerHeight * 0.5 });
        sheet.body.querySelector('#backlist').addEventListener('click', () => renderList());
        sheet.body.querySelector('#msg').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.artisanChat(a.id); go('/inbox/' + r.threadId); } catch (err) { busy(b, false); failed(el, err); } });
        sheet.body.querySelector('#askcome')?.addEventListener('click', () => requestForm(a));
      };
      const requestForm = (a) => {
        sheet.body.innerHTML = `<div class="stack" style="gap:12px;padding-top:4px"><div class="h-md">Ask ${h(a.name)} to come</div>
          <div class="field" style="margin:0"><label for="prob">What is wrong?</label><textarea class="input" id="prob" maxlength="400" placeholder="${a.trade === 'mechanic' ? 'Car will not start. Battery light came on.' : 'Describe the problem in a few words'}" style="height:84px;padding:12px 14px;resize:none"></textarea></div>
          <div class="field" style="margin:0"><label for="lm">A landmark so they find you (optional)</label><input class="input" id="lm" maxlength="160" placeholder="Beside the filling station, blue gate"></div>
          <div class="small muted" style="line-height:1.5">They see only your rough area until they accept. Then they see your exact spot and you can watch them come. Agree the price on the phone before work starts.</div>
          <button class="btn btn-primary" id="send">${icon('paper-plane')} Send request</button><button class="btn btn-ghost small" id="cancelreq">Back</button></div>`;
        sheet.set('full');
        sheet.body.querySelector('#cancelreq').addEventListener('click', () => detail(a));
        sheet.body.querySelector('#send').addEventListener('click', async (e) => {
          const b = e.currentTarget; busy(b, true);
          const pos = me || await here(10000);
          if (!pos) { busy(b, false); toast('Turn on location so they can find you'); return; }
          try { const r = await api.jobCreate({ artisanId: a.id, problem: sheet.body.querySelector('#prob').value, landmark: sheet.body.querySelector('#lm').value, lat: pos.lat, lng: pos.lng }); go('/jobs/' + r.id); }
          catch (err) { busy(b, false); failed(el, err); }
        });
      };
      const renderList = () => {
        el.querySelectorAll('.bm-pin.on').forEach((p) => p.classList.remove('on'));
        sheet.body.innerHTML = `<div class="row" style="padding:2px 0 10px"><div class="grow"><div style="font-size:17px;font-weight:800">${list.length ? list.length + ' ' + (trade ? (QUICK.find((q) => q[0] === trade) || [0, 'artisans'])[1].toLowerCase() : 'artisans') + ' near you' : 'Nobody here yet'}</div><div class="small muted">${me ? 'Closest first. Tap one on the map or below.' : 'Turn on location to see who is closest.'}</div></div></div>
          ${list.length ? list.map((a) => `<button class="row card" data-a="${a.id}" style="width:100%;text-align:left;padding:10px 12px;gap:12px;margin-bottom:8px;background:var(--card)"><span style="width:40px;height:40px;border-radius:20px;background:${TRADE_COLOR[a.trade] || '#FF7A1A'};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(TRADE_ICON[a.trade] || 'wrench')}</span><span class="grow" style="min-width:0"><span style="display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(a.name)}</span><span class="small muted">${h(a.tradeLabel)}${a.km != null ? ' · ' + a.km + ' km' : ''}</span></span><span class="small" style="font-weight:700;color:#B7791F">${starsShort(a.rating)}</span></button>`).join('') : `<div class="small muted" style="line-height:1.5">No ${trade ? 'one in this trade' : 'artisans'} listed near you yet. Know a good one? Ask them to list themselves under Artisans.</div><a class="btn btn-outline" href="#/artisans/me" style="margin-top:10px">List my own trade</a>`}`;
        sheet.body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => detail(list.find((x) => String(x.id) === b.dataset.a))));
      };
      const load = async () => {
        el.querySelectorAll('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.t === trade));
        try { const r = await api.artisans({ trade, lat: me?.lat || '', lng: me?.lng || '' }); list = (r.artisans || []).filter((a) => a.lat != null || !map); } catch (err) { failed(el, err); return; }
        if (map) {
          map.clearMarkers('a');
          list.forEach((a) => { if (a.lat == null) return; map.marker('a' + a.id, { lng: a.lng, lat: a.lat, z: 2, html: pinHtml({ iconName: TRADE_ICON[a.trade] || 'wrench', color: a.available ? (TRADE_COLOR[a.trade] || '#FF7A1A') : '#9AA0AB', label: a.name, sub: `${starsShort(a.rating)}${a.km != null ? ' · ' + a.km + ' km' : ''}`, badge: a.verified ? '✓' : '' }), onClick: () => detail(a) }); });
          const pts = list.filter((a) => a.lat != null).slice(0, 8).map((a) => [a.lng, a.lat]); if (me) pts.push([me.lng, me.lat]);
          map.fit(pts, { bottom: window.innerHeight * 0.48 });
        }
        renderList();
      };
      el.querySelectorAll('#chips .chip').forEach((c) => c.addEventListener('click', () => { trade = c.dataset.t; history.replaceState(null, '', '#/artisans/map' + (trade ? '?trade=' + trade : '')); load(); }));
      el.querySelector('#locate').addEventListener('click', async () => { const p = await here(8000); if (p && map) { map.marker('me', { ...p, html: meHtml(), anchor: 'center', z: 3 }); map.center(p.lng, p.lat, 14); } else toast('Could not find you. Is location on?'); });
      load();
    }
  });

  /* ============================== MY JOBS ============================== */
  const STATUS = { requested: ['Waiting for a reply', '#B7791F'], accepted: ['Accepted', '#1F5FBF'], enroute: ['On the way', '#2E7D1E'], arrived: ['Arrived', '#2E7D1E'], done: ['Done', '#6B6B73'], declined: ['Declined', '#D92D20'], cancelled: ['Cancelled', '#6B6B73'], expired: ['No reply', '#6B6B73'] };
  route('/jobs', { auth: true, tabs: '' }, async () => {
    const { jobs } = await api.jobs();
    return `${topbar('My jobs', '/me', `<a class="iconbtn" href="#/artisans/map?trade=mechanic" aria-label="Find someone">${icon('map-location-dot')}</a>`)}<main class="pad stack" style="gap:10px">
      ${jobs.length ? jobs.map((j) => `<a class="card row" href="#/jobs/${j.id}" style="padding:12px 14px;gap:12px"><span style="width:42px;height:42px;border-radius:21px;background:${TRADE_COLOR[j.trade] || '#FF7A1A'};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(TRADE_ICON[j.trade] || 'wrench')}</span><span class="grow" style="min-width:0"><span style="display:block;font-size:14px;font-weight:700">${h(j.role === 'customer' ? j.other.name : j.tradeLabel + ' job for ' + j.other.name)}</span><span class="small muted" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(j.problem)}</span></span><span class="tag" style="color:${STATUS[j.status][1]}">${STATUS[j.status][0]}</span></a>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('wrench')}</div><div class="h-md">No jobs yet</div><div class="small muted" style="max-width:280px;line-height:1.5">Car broke down, lights out, a tap that will not stop? Find the nearest trusted hand and watch them come to you.</div><a class="btn btn-primary" href="#/artisans/map?trade=mechanic" style="width:auto">Find a mechanic near me</a></div>`}
    </main>`;
  });

  /* ============================== LIVE TRACKING ============================== */
  route('/jobs/:id', { auth: true, tabs: '' }, async () => `<div class="bm-screen"><div class="bm-mapbox" id="map"></div>
    <div class="bm-top"><a class="bm-fab" href="#/jobs" aria-label="Back">${icon('arrow-left')}</a><div class="bm-pill" id="pill">…</div></div></div>`, {
    async mount(el, { id }) {
      const screen = el.querySelector('.bm-screen'); const box = el.querySelector('#map'); const pill = el.querySelector('#pill');
      const sheet = bottomSheet(screen, { peek: 190, half: 0.42, start: 'half' });
      let job; try { job = (await api.job(id)).job; } catch (err) { sheet.body.innerHTML = `<div class="small" style="color:#D92D20;padding:10px 0">${h((err && err.message) || 'Could not load this job')}</div>`; return; }
      const map = await createMap(box, { center: [job.place.lng, job.place.lat], zoom: 14 });
      if (!map) box.innerHTML = `<div class="placeholder" style="height:100%;padding-top:90px"><div class="small muted">Map unavailable on this phone. Status updates below still work.</div></div>`;
      else {
        const rc = document.createElement('button'); rc.className = 'bm-fab bm-locate'; rc.style.cssText = 'top:calc(70px + var(--safe-t,0px));display:none'; rc.setAttribute('aria-label', 'Follow again'); rc.innerHTML = icon('location-crosshairs'); screen.appendChild(rc);
        map.raw.on('dragstart', () => { follow = false; rc.style.display = ''; });
        rc.addEventListener('click', () => { follow = true; rc.style.display = 'none'; fitted = false; draw(job); });
      }
      let watch = null, lastSent = 0, lastSentPos = null, wake = null, timer = null, alive = true, fitted = false, follow = true, lastAt = null;
      const color = TRADE_COLOR[job.trade] || '#FF7A1A', tIcon = TRADE_ICON[job.trade] || 'wrench';
      const stopSharing = () => { if (watch != null) { navigator.geolocation.clearWatch(watch); watch = null; } try { wake && wake.release(); } catch {} wake = null; };
      const gone = () => !document.body.contains(el);

      const draw = (j) => {
        if (!map) return;
        map.marker('dest', { lng: j.place.lng, lat: j.place.lat, z: 2, html: j.place.exact ? pinHtml({ iconName: j.role === 'customer' ? 'person' : 'flag-checkered', color: '#101014', label: j.role === 'customer' ? 'You' : 'Customer', sub: j.landmark || '' }) : `<div style="width:120px;height:120px;border-radius:50%;background:rgba(255,122,26,.18);border:2px dashed #FF7A1A"></div>`, anchor: j.place.exact ? 'bottom' : 'center' });
        if (j.live) {
          if (map.has('art')) map.move('art', j.live.lng, j.live.lat, { heading: j.live.heading, ms: 3500 });
          else map.marker('art', { lng: j.live.lng, lat: j.live.lat, z: 4, anchor: 'center', html: carHtml(color, j.trade === 'mechanic' || j.trade === 'towing' || j.trade === 'vulcanizer' ? 'car-side' : tIcon) });
          if (j.route && j.route.length > 1) map.line('route', j.route, { color, width: 5 }); else map.line('route', [[j.live.lng, j.live.lat], [j.place.lng, j.place.lat]], { color, width: 4, dashed: true });
          // Follow like Bolt: frame the vehicle, where it is gliding from, and the destination, on every update.
          if (follow || !fitted) {
            const sheetTop = sheet.el.getBoundingClientRect().top || window.innerHeight * 0.58;
            const pts = [[j.live.lng, j.live.lat], [j.place.lng, j.place.lat]]; if (lastAt) pts.push(lastAt);
            map.fit(pts, { bottom: window.innerHeight - sheetTop + 50, top: 96, side: 64, ms: 900, maxZoom: 16 });
            fitted = true;
          }
          lastAt = [j.live.lng, j.live.lat];
        } else { map.remove('art'); map.removeLine('route'); if (!fitted) { map.center(j.place.lng, j.place.lat, j.place.exact ? 15 : 14); fitted = true; } }
      };

      const headline = (j) => {
        const n = j.other.name; const L = j.live;
        if (j.status === 'requested') return j.role === 'customer' ? `Waiting for ${n} to reply` : 'New job request';
        if (j.status === 'accepted') return j.role === 'customer' ? `${n} accepted` : 'You accepted. Set off when ready';
        if (j.status === 'enroute' && L) { if (L.lost) return `Signal lost ${Math.round(L.age / 60)} min ago`; if (L.stopped) return `${j.role === 'customer' ? n + ' has' : 'You have'} stopped for ${L.stoppedMin} min`; return L.etaMin != null ? `${L.etaMin <= 1 ? 'Arriving now' : L.etaMin + ' min away'}` : 'On the way'; }
        if (j.status === 'enroute') return 'On the way';
        if (j.status === 'arrived') return j.role === 'customer' ? `${n} has arrived` : 'You have arrived';
        return STATUS[j.status][0];
      };

      const render = (j) => {
        job = j; pill.textContent = headline(j);
        const L = j.live, C = j.role === 'customer';
        const who = `<div class="row" style="gap:12px">${j.other.avatar ? `<img src="${h(j.other.avatar)}" alt="" style="width:48px;height:48px;border-radius:24px;object-fit:cover">` : avatar(j.other.name, 48)}<div class="grow" style="min-width:0"><div style="font-size:16px;font-weight:800">${h(j.other.name)}</div><div class="small muted">${C ? h(j.tradeLabel) + ' · ' : ''}<strong style="color:#B7791F">${stars(j.other.rating)}</strong></div></div>
          ${j.other.phone ? `<a class="bm-fab" href="tel:${h(j.other.phone)}" aria-label="Call" style="width:46px;height:46px;background:var(--green-tint);color:var(--green-dark);box-shadow:none">${icon('phone')}</a>` : ''}${j.threadId ? `<a class="bm-fab" href="#/inbox/${j.threadId}" aria-label="Message" style="width:46px;height:46px;background:var(--surface);box-shadow:none">${icon('message')}</a>` : ''}</div>`;
        const eta = L && L.etaMin != null && j.status === 'enroute' ? `<div class="row" style="gap:10px"><div class="grow"><div style="font-size:28px;font-weight:900;letter-spacing:-.5px">${L.etaMin <= 1 ? 'Now' : L.etaMin + ' min'}</div><div class="small muted">arriving about ${clock(L.etaAt)} · ${L.metres >= 1000 ? (L.metres / 1000).toFixed(1) + ' km' : L.metres + ' m'} away${L.speedKmh ? ' · ' + L.speedKmh + ' km/h' : ''}</div></div></div>
          ${L.stopped ? `<div class="card" style="padding:10px 12px;background:var(--orange-tint);border-color:var(--orange)"><div class="small"><strong>Stopped for ${L.stoppedMin} min.</strong> ${C ? 'Could be traffic or a quick errand. Call if it goes on.' : 'Your customer can see you have stopped.'}</div></div>` : ''}
          ${L.lost ? `<div class="card" style="padding:10px 12px;background:#FDECEA;border-color:#D92D20"><div class="small"><strong>No location for ${Math.round(L.age / 60)} min.</strong> ${C ? 'Their phone may have locked or lost data. Call them.' : 'Keep Buja open on this screen so your customer can follow you.'}</div></div>` : ''}` : '';
        let body = '';
        if (C) {
          if (j.status === 'requested') body = `<div class="small muted" style="line-height:1.5">They have your rough area, not your exact spot, until they accept. Requests expire after 20 minutes.</div><button class="btn btn-outline" data-act="cancel">Cancel request</button>`;
          else if (j.status === 'accepted') body = `<div class="small muted" style="line-height:1.5">They can now see where you are. When they set off you will see them move on the map.</div><button class="btn btn-outline" data-act="cancel">Cancel</button>`;
          else if (j.status === 'enroute') body = `${eta}<button class="btn btn-outline" data-act="cancel">Cancel</button>`;
          else if (j.status === 'arrived') body = `<div class="small muted">When the work is finished, mark it done and rate them.</div><button class="btn btn-primary" data-rate>${icon('star')} Fixed. Rate ${h(j.other.name)}</button>`;
          else if (j.status === 'done' && !j.rated) body = `<button class="btn btn-primary" data-rate>${icon('star')} Rate ${h(j.other.name)}</button>`;
          else if (j.status === 'done') body = `<div class="small muted">Thank you for rating. It helps the next person choose.</div>`;
          else body = `<a class="btn btn-primary" href="#/artisans/map?trade=${h(j.trade)}">Find someone else nearby</a>`;
        } else {
          if (j.status === 'requested') body = `<div class="card" style="padding:12px;background:var(--surface);border:none"><div class="small muted">Problem</div><div style="font-size:15px;font-weight:600;margin-top:2px">${h(j.problem)}</div><div class="small muted" style="margin-top:6px">${j.km != null ? 'About ' + (j.km < 1 ? 'under 1' : j.km) + ' km from your workshop. ' : ''}You will see the exact spot once you accept.</div></div><div class="row" style="gap:8px"><button class="btn btn-primary grow" data-act="accept">Accept</button><button class="btn btn-outline" data-act="decline" style="width:auto">Decline</button></div>`;
          else if (j.status === 'accepted') body = `<div class="card" style="padding:12px;background:var(--surface);border:none"><div class="small muted">Problem</div><div style="font-size:15px;font-weight:600">${h(j.problem)}</div>${j.landmark ? `<div class="small" style="margin-top:4px">Landmark: ${h(j.landmark)}</div>` : ''}</div><button class="btn btn-primary" data-start>${icon('car-side')} I am setting off</button><div class="small muted" style="line-height:1.5">Your customer will see you move on the map with your arrival time. Keep this screen open while you travel.</div>`;
          else if (j.status === 'enroute') body = `${eta}<a class="btn btn-outline" href="https://www.google.com/maps/dir/?api=1&destination=${j.place.lat},${j.place.lng}&travelmode=driving" target="_blank" rel="noopener">${icon('route')} Directions in Google Maps</a><button class="btn btn-primary" data-act="arrived">I have arrived</button><div class="small muted" id="share">${watch != null ? 'Sharing your location' : 'Location not being shared'}</div>`;
          else if (j.status === 'arrived') body = `<div class="small muted">When the work is finished:</div><button class="btn btn-primary" data-act="done">${icon('circle-check')} Job done</button>`;
          else body = `<div class="small muted">${j.status === 'done' ? 'Well done. Their rating will show on your profile.' : 'This job is closed.'}</div>`;
        }
        sheet.body.innerHTML = `<div class="stack" style="gap:14px;padding-top:4px">${who}${j.role === 'customer' || j.status !== 'requested' ? `<div class="small" style="color:var(--ink-2)"><strong>${h(j.tradeLabel)}:</strong> ${h(j.problem)}</div>` : ''}${body}</div>`;
        sheet.body.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
          const a = b.dataset.act; if ((a === 'cancel' || a === 'decline') && !confirm(a === 'cancel' ? 'Cancel this job?' : 'Decline this job?')) return;
          busy(b, true); try { const r = await api.jobAct(id, a); if (a === 'arrived' || a === 'done' || a === 'cancel') stopSharing(); draw(r.job); render(r.job); } catch (err) { busy(b, false); failed(el, err); }
        }));
        sheet.body.querySelector('[data-start]')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); const p = await here(10000); try { const r = await api.jobAct(id, 'start', p || {}); startSharing(); draw(r.job); render(r.job); } catch (err) { busy(b, false); failed(el, err); } });
        sheet.body.querySelector('[data-rate]')?.addEventListener('click', () => rateForm());
      };

      const rateForm = () => {
        const TAGS = ['Came quickly', 'Fixed it properly', 'Fair price', 'Honest about the problem', 'Overcharged', 'Did not fix it', 'Did not turn up', 'Damaged something'];
        let n = 0; const pick = new Set();
        sheet.body.innerHTML = `<div class="stack" style="gap:14px;padding-top:4px"><div class="h-md">How did ${h(job.other.name)} do?</div>
          <div class="row" id="st" style="gap:6px;justify-content:center">${[1, 2, 3, 4, 5].map((i) => `<button data-s="${i}" aria-label="${i} stars" style="border:none;background:none;font-size:38px;color:var(--line);cursor:pointer">★</button>`).join('')}</div>
          <div class="row" id="tg" style="gap:6px;flex-wrap:wrap">${TAGS.map((t) => `<button class="chip" data-t="${h(t)}">${h(t)}</button>`).join('')}</div>
          <textarea class="input" id="cm" maxlength="400" placeholder="Anything else? (optional)" style="height:70px;padding:12px 14px;resize:none"></textarea>
          <button class="btn btn-primary" id="rs" disabled>Submit rating</button></div>`;
        sheet.set('full');
        sheet.body.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { n = +b.dataset.s; sheet.body.querySelectorAll('[data-s]').forEach((x) => { x.style.color = +x.dataset.s <= n ? '#F5A623' : 'var(--line)'; }); sheet.body.querySelector('#rs').disabled = false; }));
        sheet.body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.t; pick.has(t) ? pick.delete(t) : pick.add(t); b.classList.toggle('on'); }));
        sheet.body.querySelector('#rs').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.jobRate(id, { stars: n, tags: [...pick], comment: sheet.body.querySelector('#cm').value }); toast('Thank you'); sheet.set('half'); render(r.job); } catch (err) { busy(b, false); failed(el, err); } });
      };

      /* The artisan's phone sends its position at most every 4 s, or when it has moved 20 m, and only while on the way. */
      const startSharing = async () => {
        if (watch != null || !navigator.geolocation) return;
        wake = await keepAwake();
        watch = navigator.geolocation.watchPosition(async (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude }; const now = Date.now();
          if (now - lastSent < 4000 && lastSentPos && metres(lastSentPos, pos) < 20) return;
          lastSent = now; lastSentPos = pos;
          try { const r = await api.jobPing(id, { ...pos, heading: p.coords.heading != null && !isNaN(p.coords.heading) ? Math.round(p.coords.heading) : null, speed: p.coords.speed }); if (r.stop) { stopSharing(); } if (!gone()) { draw(r.job); render(r.job); } } catch {}
        }, () => { toast('Location is off. Your customer cannot see you.'); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
        const s = el.querySelector('#share'); if (s) s.textContent = 'Sharing your location';
      };

      /* Both sides poll every 4 s while this screen is open and visible. */
      const tick = async () => {
        if (!alive) return; if (gone()) { alive = false; stopSharing(); return; }
        if (!document.hidden) { try { const r = await api.job(id); draw(r.job); if (JSON.stringify(r.job) !== JSON.stringify(job) || sheet.body.querySelector('#rs') == null) { if (!sheet.body.querySelector('#rs')) render(r.job); else job = r.job; } } catch {} }
        timer = setTimeout(tick, 4000);
      };
      draw(job); render(job);
      if (job.role === 'artisan' && job.status === 'enroute') startSharing(); // reopened mid-journey
      timer = setTimeout(tick, 4000);
    }
  });
}
