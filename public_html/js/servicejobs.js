// Buja: artisans on a map, "ask them to come", and live tracking while they travel. Registered lazily by app.js.
import { createMap, pinHtml, facePinHtml, spreadSame, groupChips, carHtml, avatarHtml, meHtml, bottomSheet, keepAwake, metres, TRADE_ICON, TRADE_COLOR } from './map.js';

export function registerJobs({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy, avatar, field, showErrors } = ui;
  const stars = (r) => r && r.count ? `★ ${Number(r.stars).toFixed(1)} (${r.count})` : 'New';
  const starsShort = (r) => r && r.count ? `★ ${Number(r.stars).toFixed(1)}` : 'New';
  const clock = (iso) => new Date(String(iso).replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const here = (ms = 8000) => new Promise((res) => { if (!navigator.geolocation) return res(null); let done = false; const f = (v) => { if (!done) { done = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 30000 }); });
  const NOUN = { mechanic: ['mechanic', 'mechanics'], vulcanizer: ['tyre man', 'tyre men'], towing: ['tow truck', 'tow trucks'], electrician: ['electrician', 'electricians'], plumber: ['plumber', 'plumbers'], hair: ['barber', 'barbers'], tailor: ['tailor', 'tailors'], ac: ['AC repairer', 'AC repairers'], locksmith: ['locksmith', 'locksmiths'], '': ['artisan', 'artisans'] };
  const noun = (t, n) => (NOUN[t] || ['artisan', 'artisans'])[n === 1 ? 0 : 1];
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
      let me = await here(6000);
      // Buja covers the FCT. A computer often guesses its position from the internet connection and lands in
      // Kaduna or Lagos; measuring "km away" from there is nonsense, so such a fix is set aside with a note.
      const inFct = (p) => p && p.lat > 8.35 && p.lat < 9.65 && p.lng > 6.7 && p.lng < 7.95;
      let outside = false; if (me && !inFct(me)) { outside = true; me = null; }
      const map = await createMap(box, { center: me ? [me.lng, me.lat] : undefined, zoom: me ? 13 : 12 });
      if (outside) toast('Your location looks outside Abuja, so distances are hidden. On a phone with GPS this is exact.', 6000);
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
        const roadside = !trade || ['mechanic', 'vulcanizer', 'towing'].includes(trade);
        const sos = roadside ? `<a class="card row" href="#/breakdown${trade ? '?trade=' + trade : ''}" style="padding:14px;gap:12px;margin:2px 0 14px;background:#D92D20;border-color:#D92D20;color:#fff;text-decoration:none">
          <span style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('car-side')}</span>
          <span class="grow"><span style="display:block;font-size:16px;font-weight:800">My car broke down</span><span class="small" style="opacity:.9">Pin where you are. The nearest ${trade === 'towing' ? 'tow truck' : trade === 'vulcanizer' ? 'tyre man' : 'mechanic'} who accepts comes to you.</span></span>${icon('chevron-right')}</a>` : '';
        sheet.body.innerHTML = sos + `<div class="row" style="padding:2px 0 10px"><div class="grow"><div style="font-size:17px;font-weight:800">${list.length ? list.length + ' ' + noun(trade, list.length) + ' near you' : 'Nobody here yet'}</div><div class="small muted">${me ? 'Closest first. Tap one on the map or below.' : 'Turn on location to see who is closest.'}</div></div></div>
          ${list.length ? list.map((a) => `<button class="row card" data-a="${a.id}" style="width:100%;text-align:left;padding:10px 12px;gap:12px;margin-bottom:8px;background:var(--card)"><span class="lst-face" style="--c:${TRADE_COLOR[a.trade] || '#FF7A1A'}">${a.photo ? `<img src="${h(a.photo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${h((a.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase())}</b><i>${icon(TRADE_ICON[a.trade] || 'wrench')}</i></span><span class="grow" style="min-width:0"><span style="display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(a.name)}</span><span class="small muted">${h(a.tradeLabel)}${a.km != null ? ' · ' + a.km + ' km' : ''}</span></span><span class="small" style="font-weight:700;color:#B7791F">${starsShort(a.rating)}</span></button>`).join('') : `<div class="small muted" style="line-height:1.5">No ${trade ? 'one in this trade' : 'artisans'} listed near you yet. Know a good one? Ask them to list themselves under Artisans.</div><a class="btn btn-outline" href="#/artisans/me" style="margin-top:10px">List my own trade</a>`}`;
        sheet.body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => detail(list.find((x) => String(x.id) === b.dataset.a))));
      };
      const load = async () => {
        el.querySelectorAll('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.t === trade));
        try { const r = await api.artisans({ trade, lat: me?.lat || '', lng: me?.lng || '' }); list = (r.artisans || []).filter((a) => a.lat != null || !map); } catch (err) { failed(el, err); return; }
        if (map) {
          map.clearMarkers('a'); map.clearMarkers('grp');
          const at = spreadSame(list, (a) => a.lat != null ? { lat: a.lat, lng: a.lng } : null);
          list.forEach((a) => { if (a.lat == null) return; const grouped = !!at.get(a); map.marker('a' + a.id, { lng: a.lng, lat: a.lat, offset: at.get(a), z: 2, html: facePinHtml({ photo: a.photo, name: grouped ? '' : a.name, sub: `${starsShort(a.rating)}${a.km != null ? ' · ' + a.km + ' km' : ''}`, color: TRADE_COLOR[a.trade] || '#FF7A1A', iconName: TRADE_ICON[a.trade] || 'wrench', verified: a.verified, dim: !a.available }), onClick: () => detail(a) }); });
          groupChips(list, (a) => a.lat != null ? { lat: a.lat, lng: a.lng } : null).forEach((g, gi) => map.marker('grp' + gi, { lng: g.lng, lat: g.lat, anchor: 'top', offset: [0, 4], z: 1, html: `<div class="bm-label" style="margin:0"><strong>${g.n} ${noun(trade, g.n)} here</strong><span>tap a face</span></div>` }));
          const pts = list.filter((a) => a.lat != null).slice(0, 8).map((a) => [a.lng, a.lat]); if (me) pts.push([me.lng, me.lat]);
          map.fit(pts, { bottom: window.innerHeight * 0.48, top: 150, side: 60 });
        }
        renderList();
      };
      el.querySelectorAll('#chips .chip').forEach((c) => c.addEventListener('click', () => { trade = c.dataset.t; history.replaceState(null, '', '#/artisans/map' + (trade ? '?trade=' + trade : '')); load(); }));
      el.querySelector('#locate').addEventListener('click', async () => { const p = await here(8000); if (p && map) { map.marker('me', { ...p, html: meHtml(), anchor: 'center', z: 3 }); map.center(p.lng, p.lat, 14); } else toast('Could not find you. Is location on?'); });
      load();
    }
  });

  /* ============================== REGISTER AS A MECHANIC (or any trade) ============================== */
  const SERVICES = {
    mechanic: ['Engine', 'Electrical and wiring', 'Brakes', 'Suspension', 'Gearbox', 'AC', 'Diagnostics scan', 'Battery', 'Oil service', 'Overheating', 'Body work', 'Towing arranged'],
    vulcanizer: ['Puncture', 'Tyre change', 'Wheel balancing', 'Alignment', 'Tube and tubeless'],
    towing: ['Tow truck', 'Flatbed', 'Jump start', 'Fuel delivery'],
    electrician: ['House wiring', 'Faults and trips', 'Inverter', 'Meters', 'Lighting'],
  };
  const BRANDS = ['All makes', 'Toyota', 'Honda', 'Lexus', 'Hyundai', 'Kia', 'Nissan', 'Mercedes', 'Ford', 'Peugeot', 'Volkswagen', 'Mitsubishi'];
  const shrinkImg = async (f, max = 1100) => { const b = await createImageBitmap(f).catch(() => null); if (!b) return f; const s = Math.min(1, max / Math.max(b.width, b.height)); const c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); const bl = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); return new File([bl], 'photo.jpg', { type: 'image/jpeg' }); };

  route('/artisans/register', { auth: true, tabs: '' }, async () => {
    const [{ artisan: me }, meta] = await Promise.all([api.artisanMe().catch(() => ({ artisan: null })), api.artisans({}).catch(() => ({ trades: {} }))]);
    const f = new URLSearchParams(location.hash.split('?')[1] || ''); const startTrade = (me && me.trade) || f.get('trade') || 'mechanic';
    const trades = meta.trades || {};
    return `${topbar(me ? 'My artisan profile' : 'Join as an artisan', '/artisans')}
    <div class="pad" style="padding-bottom:0"><div class="row" style="gap:6px" id="steps">${[1, 2, 3].map((n) => `<div style="flex:1;height:5px;border-radius:3px;background:${n === 1 ? 'var(--orange)' : 'var(--line)'}" data-bar="${n}"></div>`).join('')}</div></div>
    <form id="af" class="pad stack" style="gap:14px" novalidate>
      <section data-step="1" class="stack" style="gap:14px">
        <div><div class="h-md">You and your work</div><div class="small muted">Step 1 of 3. Customers see this before they call you.</div></div>
        ${field({ id: 'ownerName', label: 'Your full name', value: (me && me.owner) || state.user.name || '' })}
        ${field({ id: 'business', label: 'Workshop or business name (optional)', value: (me && me.name !== me.person ? me.name : '') || '', placeholder: 'Musa Auto Clinic' })}
        <div class="field" style="margin:0"><label for="trade">Your trade</label><select class="input" id="trade">${Object.entries(trades).map(([k, l]) => `<option value="${k}" ${k === startTrade ? 'selected' : ''}>${h(l)}</option>`).join('')}</select><div class="error" data-error="trade"></div></div>
        <div class="field" style="margin:0"><label>What you fix</label><div class="row" id="svc" style="gap:6px;flex-wrap:wrap"></div></div>
        <div class="field" style="margin:0" id="brandsbox"><label>Car makes you know</label><div class="row" id="brands" style="gap:6px;flex-wrap:wrap">${BRANDS.map((b) => `<button type="button" class="chip ${me && (me.brands || []).includes(b) ? 'on' : ''}" data-b="${h(b)}">${h(b)}</button>`).join('')}</div></div>
        <div class="row" style="gap:10px">${field({ id: 'years', label: 'Years of experience', type: 'number', value: me ? me.years : '', inputmode: 'numeric' })}${field({ id: 'calloutFee', label: 'Call-out fee ₦ (optional)', type: 'number', value: me && me.calloutFee != null ? me.calloutFee : '', inputmode: 'numeric', placeholder: '2000' })}</div>
        <div class="field" style="margin:0"><label for="about">About your work (optional)</label><textarea class="input" id="about" maxlength="600" style="height:84px;padding:12px 14px;resize:none" placeholder="Toyota and Honda specialist, 12 years, genuine parts, I explain the fault before I fix it.">${h((me && me.about) || '')}</textarea></div>
        <button type="button" class="btn btn-primary" data-next="2">Next: where you work</button>
      </section>
      <section data-step="2" class="stack" style="gap:14px;display:none">
        <div><div class="h-md">Where you work</div><div class="small muted">Step 2 of 3. Put the pin exactly on your workshop. Breakdowns near it will reach you first.</div></div>
        <div id="pinmap" style="height:260px;border-radius:16px;overflow:hidden;position:relative"></div>
        <div class="row" style="gap:8px"><button type="button" class="btn btn-sm btn-outline grow" id="gps">${icon('location-crosshairs')} I am at my workshop now</button></div>
        <div class="small muted" id="pinnote">Drag the pin, or tap the map, to move it.</div><div class="error" data-error="lat"></div>
        ${field({ id: 'address', label: 'Address (optional)', value: (me && me.address) || '', placeholder: 'Plot 12, Mechanic Village, Kugbo' })}
        ${field({ id: 'landmark', label: 'Landmark', value: (me && me.landmark) || '', placeholder: 'Opposite the Total filling station' })}
        <div class="row" style="gap:10px">${field({ id: 'phone', label: 'Phone', value: (me && me.phone) || state.user.phone || '', inputmode: 'tel' })}${field({ id: 'whatsapp', label: 'WhatsApp (optional)', value: (me && me.whatsapp) || '', inputmode: 'tel' })}</div>
        <div class="row" style="gap:10px"><div class="field grow" style="margin:0"><label for="radiusKm">How far you travel</label><select class="input" id="radiusKm">${[5, 10, 15, 20, 30, 45].map((n) => `<option value="${n}" ${(me ? me.radiusKm : 15) === n ? 'selected' : ''}>${n} km</option>`).join('')}</select></div>${field({ id: 'hours', label: 'Working hours', value: (me && me.hours) || '', placeholder: 'Mon to Sat, 7am to 7pm' })}</div>
        <label class="check" style="align-items:center"><input type="checkbox" id="mobileService" ${!me || me.mobileService ? 'checked' : ''}>I come to the customer (roadside and home repairs)</label>
        <label class="check" style="align-items:center"><input type="checkbox" id="emergency" ${me && me.emergency ? 'checked' : ''}>I take night and weekend emergencies</label>
        <div class="row" style="gap:8px"><button type="button" class="btn btn-outline" data-next="1" style="width:auto">Back</button><button type="button" class="btn btn-primary grow" data-next="3">Next: photos</button></div>
      </section>
      <section data-step="3" class="stack" style="gap:14px;display:none">
        <div><div class="h-md">Photos</div><div class="small muted">Step 3 of 3. Customers trust a face, and it shows on the map while you drive to them.</div></div>
        <div class="row" style="gap:14px;align-items:center"><div id="facebox" style="width:88px;height:88px;border-radius:44px;background:var(--surface);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0">${me && me.photo ? `<img src="${h(me.photo)}" alt="" style="width:100%;height:100%;object-fit:cover">` : icon('user')}</div>
          <div class="stack" style="gap:6px"><label class="btn btn-sm btn-primary" style="width:auto;cursor:pointer">${icon('camera')} ${me && me.photo ? 'Change photo' : 'Add a photo of your face'}<input type="file" accept="image/*" capture="user" id="face" style="display:none"></label><div class="small muted">Clear, facing the camera, no sunglasses.</div></div></div>
        <div class="error" data-error="photo"></div>
        <div class="card stack" style="padding:12px 14px;gap:8px"><div style="font-size:14px;font-weight:700">ID for the verified badge (optional)</div><div class="small muted" style="line-height:1.5">A photo of your NIN slip, driver's licence or voter's card. Only Buja admins see it. Verified mechanics are shown first and get more jobs.</div>
          <label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('shield-halved')} ${me && me.hasId ? 'Replace ID photo' : 'Add ID photo'}<input type="file" accept="image/*" id="idp" style="display:none"></label><div class="small" id="idname">${me && me.hasId ? 'ID on file' : ''}</div></div>
        <label class="check" style="align-items:center"><input type="checkbox" id="available" ${!me || me.available ? 'checked' : ''}>I am taking jobs now</label>
        <div class="row" style="gap:8px"><button type="button" class="btn btn-outline" data-next="2" style="width:auto">Back</button><button class="btn btn-primary grow" type="submit">${icon('circle-check')} ${me ? 'Save my profile' : 'Register'}</button></div>
        <div class="small muted" style="line-height:1.5">Once registered, keep notifications on. When a car breaks down near you, your phone rings with the job, and the first mechanic to accept gets it.</div>
      </section>
    </form>`;
  }, {
    async mount(el) {
      const { artisan: me } = await api.artisanMe().catch(() => ({ artisan: null }));
      let pin = me && me.lat != null ? { lat: me.lat, lng: me.lng } : null, photoId = null, idId = null;
      const picked = new Set(me ? me.services : []);
      const drawSvc = () => { const t = el.querySelector('#trade').value; el.querySelector('#svc').innerHTML = (SERVICES[t] || []).map((s) => `<button type="button" class="chip ${picked.has(s) ? 'on' : ''}" data-s="${h(s)}">${h(s)}</button>`).join('') || '<span class="small muted">Describe it under About.</span>'; el.querySelector('#brandsbox').style.display = ['mechanic', 'vulcanizer', 'towing'].includes(t) ? '' : 'none'; el.querySelectorAll('#svc [data-s]').forEach((b) => b.addEventListener('click', () => { picked.has(b.dataset.s) ? picked.delete(b.dataset.s) : picked.add(b.dataset.s); b.classList.toggle('on'); })); };
      el.querySelector('#trade').addEventListener('change', drawSvc); drawSvc();
      el.querySelectorAll('#brands [data-b]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('on')));
      let map = null;
      const show = async (n) => {
        el.querySelectorAll('[data-step]').forEach((s) => { s.style.display = s.dataset.step === String(n) ? '' : 'none'; });
        el.querySelectorAll('[data-bar]').forEach((b) => { b.style.background = +b.dataset.bar <= n ? 'var(--orange)' : 'var(--line)'; });
        window.scrollTo(0, 0);
        if (n === 2 && !map) {
          if (!pin) { const p = await here(6000); if (p) pin = p; }
          map = await createMap(el.querySelector('#pinmap'), { center: pin ? [pin.lng, pin.lat] : undefined, zoom: pin ? 16 : 12 });
          const put = (p) => { pin = p; if (map) map.marker('ws', { lng: p.lng, lat: p.lat, z: 3, draggable: true, html: pinHtml({ iconName: TRADE_ICON[el.querySelector('#trade').value] || 'wrench', color: '#FF7A1A', label: 'My workshop' }), onDragEnd: (lng, lat) => { pin = { lng, lat }; el.querySelector('#pinnote').textContent = 'Pin set. ' + lat.toFixed(5) + ', ' + lng.toFixed(5); } }); el.querySelector('#pinnote').textContent = 'Pin set. Drag it if it is not exactly on your workshop.'; };
          if (map) { if (pin) put(pin); map.raw.on('click', (e) => put({ lng: e.lngLat.lng, lat: e.lngLat.lat })); }
          el.querySelector('#gps').onclick = async () => { const p = await here(10000); if (!p) { toast('Could not find you. Is location on?'); return; } put(p); map && map.center(p.lng, p.lat, 17); };
        }
      };
      el.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.next === '2' && el.querySelector('#ownerName').value.trim().length < 3) { showErrors(el, { ownerName: 'Your full name.' }); return; }
        if (b.dataset.next === '3' && !pin) { showErrors(el, { lat: 'Put the pin on your workshop first.' }); return; }
        showErrors(el, {}); show(+b.dataset.next);
      }));
      el.querySelector('#face').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; el.querySelector('#facebox').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="" style="width:100%;height:100%;object-fit:cover">`; try { const r = await api.upload(await shrinkImg(f, 800), 'image'); photoId = r.upload.id; } catch (err) { failed(el, err); } });
      el.querySelector('#idp').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; el.querySelector('#idname').textContent = 'Uploading…'; try { const r = await api.upload(await shrinkImg(f, 1400), 'image'); idId = r.upload.id; el.querySelector('#idname').textContent = 'ID attached. Only admins will see it.'; } catch (err) { el.querySelector('#idname').textContent = ''; failed(el, err); } });
      el.querySelector('#af').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        try {
          await api.artisanSave({ ownerName: el.querySelector('#ownerName').value, business: el.querySelector('#business').value, trade: el.querySelector('#trade').value, services: [...picked],
            brands: [...el.querySelectorAll('#brands .on')].map((b) => b.dataset.b), years: el.querySelector('#years').value, calloutFee: el.querySelector('#calloutFee').value, about: el.querySelector('#about').value,
            lat: pin && pin.lat, lng: pin && pin.lng, address: el.querySelector('#address').value, landmark: el.querySelector('#landmark').value, phone: el.querySelector('#phone').value, whatsapp: el.querySelector('#whatsapp').value,
            radiusKm: el.querySelector('#radiusKm').value, hours: el.querySelector('#hours').value, mobileService: el.querySelector('#mobileService').checked, emergency: el.querySelector('#emergency').checked,
            available: el.querySelector('#available').checked, uploadId: photoId, idUploadId: idId, source: new URLSearchParams(location.hash.split('?')[1] || '').get('src') || null });
          const r = await api.me(); state.user = r.user;
          toast(me ? 'Saved' : 'You are registered. Keep notifications on so you never miss a breakdown.');
          go('/artisans/dashboard');
        } catch (err) {
          busy(btn, false);
          const fl = (err && err.fields) || {}; if (fl.ownerName || fl.trade) show(1); else if (fl.lat || fl.phone) show(2);
          failed(el, err);
        }
      });
    }
  });

  /* ============================== MY CAR BROKE DOWN ============================== */
  const PROBLEMS = { mechanic: ['Will not start', 'Overheating', 'Battery flat', 'Strange noise', 'Brakes', 'Accident'], vulcanizer: ['Flat tyre', 'Puncture', 'Tyre burst'], towing: ['Needs towing', 'Accident', 'Stuck'], electrician: ['No power', 'Sparks', 'Burning smell'] };
  route('/breakdown', { auth: true, tabs: '' }, async () => `<div class="bm-screen"><div class="bm-mapbox" id="map"></div>
    <div class="bm-top"><a class="bm-fab" href="#/artisans/map?trade=mechanic" aria-label="Back to mechanics near me">${icon('arrow-left')}</a><div class="bm-pill" id="pill">Where exactly are you?</div></div>
    <button class="bm-fab bm-locate" id="locate" aria-label="Where am I" style="top:calc(70px + var(--safe-t,0px))">${icon('location-crosshairs')}</button></div>`, {
    async mount(el) {
      const screen = el.querySelector('.bm-screen'); const pill = el.querySelector('#pill');
      const sheet = bottomSheet(screen, { peek: 200, half: 0.56, start: 'half' });
      let trade = new URLSearchParams(location.hash.split('?')[1] || '').get('trade') || 'mechanic'; let pos = null, acc = null; const chosen = new Set();
      sheet.body.innerHTML = `<div class="small muted" style="padding:8px 0">Finding your exact location…</div>`;
      const fix = await new Promise((res) => { if (!navigator.geolocation) return res(null); let best = null; const t = setTimeout(() => { navigator.geolocation.clearWatch(w); res(best); }, 9000); const w = navigator.geolocation.watchPosition((p) => { if (!best || p.coords.accuracy < best.acc) best = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }; if (best.acc <= 25) { clearTimeout(t); navigator.geolocation.clearWatch(w); res(best); } }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 9000 }); });
      if (fix) { pos = { lat: fix.lat, lng: fix.lng }; acc = fix.acc; }
      const map = await createMap(el.querySelector('#map'), { center: pos ? [pos.lng, pos.lat] : undefined, zoom: pos ? 17 : 12 });
      const put = (p, note) => {
        pos = p;
        if (map) { map.marker('me', { lng: p.lng, lat: p.lat, z: 4, draggable: true, html: pinHtml({ iconName: 'car-side', color: '#D92D20', size: 46, label: 'My car is here' }), onDragEnd: (lng, lat) => { pos = { lng, lat }; acc = null; map.removeLine('acc'); pill.textContent = 'Pin moved. That is where they will come.'; } }); 
          // Centre the car in the part of the map the sheet leaves visible, not behind it.
          const sh = el.querySelector('.bm-sheet'); const top = sh ? sh.getBoundingClientRect().top : window.innerHeight * 0.5;
          map.raw.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.raw.getZoom(), 16), padding: { top: 80, bottom: Math.max(0, window.innerHeight - top + 20), left: 20, right: 20 }, duration: 500 }); if (acc) map.circle('acc', p.lng, p.lat, acc, { color: '#1F5FBF' }); }
        pill.textContent = note || (acc && acc > 60 ? `GPS is rough (±${acc} m). Drag the pin to your car.` : 'Drag the pin if it is not exactly on your car');
      };
      if (map && pos) put(pos);
      if (map) map.raw.on('click', (e) => { acc = null; map.removeLine('acc'); put({ lng: e.lngLat.lng, lat: e.lngLat.lat }, 'Pin set. That is where they will come.'); });
      el.querySelector('#locate').addEventListener('click', async () => { const p = await here(9000); if (!p) { toast('Could not find you. Is location on?'); return; } acc = null; put(p); map && map.center(p.lng, p.lat, 17); });
      const draw = () => {
        sheet.body.innerHTML = `<div class="stack" style="gap:12px;padding-top:2px">
          <div style="font-size:18px;font-weight:800">Get help to you now</div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${[['mechanic', 'Mechanic'], ['vulcanizer', 'Tyres'], ['towing', 'Towing']].map(([k, l]) => `<button type="button" class="chip ${k === trade ? 'on' : ''}" data-tr="${k}">${icon(TRADE_ICON[k])} ${l}</button>`).join('')}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${(PROBLEMS[trade] || []).map((p) => `<button type="button" class="chip ${chosen.has(p) ? 'on' : ''}" data-p="${h(p)}">${h(p)}</button>`).join('')}</div>
          <textarea class="input" id="prob" maxlength="400" placeholder="Anything else? Car make, what happened" style="height:64px;padding:10px 12px;resize:none"></textarea>
          <input class="input" id="lm" maxlength="160" placeholder="Landmark: beside the NNPC station, blue Corolla">
          <button class="btn btn-primary" id="send" style="background:#D92D20;height:54px;font-size:16px">${icon('bolt')} Send to the nearest ${trade === 'vulcanizer' ? 'vulcanizers' : trade === 'towing' ? 'tow trucks' : 'mechanics'}</button>
          <div class="small muted" style="line-height:1.5">The three closest available get it at once; if nobody answers in a minute, the next ones do. The first to accept comes to your pin, and you watch them on the map. Agree the price on the phone before work starts.</div>
          <a class="btn btn-ghost small" href="#/artisans/map?trade=${trade}">Or choose one yourself on the map</a></div>`;
        sheet.body.querySelectorAll('[data-tr]').forEach((b) => b.addEventListener('click', () => { trade = b.dataset.tr; chosen.clear(); draw(); }));
        sheet.body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { chosen.has(b.dataset.p) ? chosen.delete(b.dataset.p) : chosen.add(b.dataset.p); b.classList.toggle('on'); }));
        sheet.body.querySelector('#send').addEventListener('click', async (e) => {
          const b = e.currentTarget; if (!pos) { toast('Put the pin on your car first'); return; }
          const problem = [...chosen].concat(sheet.body.querySelector('#prob').value.trim() ? [sheet.body.querySelector('#prob').value.trim()] : []).join('. ');
          if (problem.length < 5) { toast('Tap what is wrong, or describe it'); return; }
          busy(b, true);
          try { const r = await api.jobNearest({ trade, problem, lat: pos.lat, lng: pos.lng, accuracy: acc, landmark: sheet.body.querySelector('#lm').value }); go('/jobs/' + r.id); }
          catch (err) { busy(b, false); if (err && err.id) { go('/jobs/' + err.id); return; } failed(el, err); }
        });
      };
      draw();
    }
  });

  /* ============================== MECHANIC DASHBOARD ============================== */
  const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
  const naira = (n) => '₦' + Number(n || 0).toLocaleString();
  const hr = (x) => { const h = Math.floor(x), m = Math.round((x - h) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
  route('/artisans/dashboard', { auth: true, tabs: 'Me' }, async () => {
    const d = await api.artisanDashboard();
    if (!d.artisan) return `${topbar('Mechanic dashboard', '/me')}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('wrench')}</div><div class="h-md">You are not registered as a mechanic yet</div><div class="small muted">Five minutes: your name, a face photo and your workshop pin.</div><a class="btn btn-primary" href="#/artisans/register?trade=mechanic" style="width:auto">Register my trade</a></div>`;
    const a = d.artisan, R = d.reliability, sch = a.schedule || {};
    const pct = (x) => Math.round((x || 0) * 100) + '%';
    return `${topbar('Mechanic dashboard', '/me', `<a class="iconbtn" href="#/artisans/register" aria-label="Edit my profile">${icon('user')}</a>`)}
    <main class="pad stack" style="gap:14px">
      <div class="card row" style="padding:14px;gap:12px">${a.photo ? `<img src="${h(a.photo)}" alt="" style="width:54px;height:54px;border-radius:27px;object-fit:cover">` : avatar(a.name, 54)}
        <div class="grow" style="min-width:0"><div style="font-size:17px;font-weight:800">${h(a.name)}</div><div class="small muted">${h(a.trade)}${a.verified ? ' · <span style="color:var(--green-dark);font-weight:700">Verified</span>' : a.idSent ? ' · ID sent, awaiting check' : ' · <a href="#/artisans/register">send your ID for the Verified badge</a>'}</div></div></div>
      <div class="card stack" style="padding:16px;gap:10px;background:${a.available ? 'var(--green-tint)' : 'var(--surface)'};border-color:${a.available ? 'var(--green)' : 'var(--line)'}">
        <div class="row" style="gap:12px"><div class="grow"><div style="font-size:16px;font-weight:800">${a.available ? (a.onDuty ? 'You are taking jobs' : 'On, but outside your hours') : 'You are off'}</div>
          <div class="small muted">${a.available ? (a.onDuty ? 'Your phone rings when a breakdown is near. Keep Buja open.' : 'You will be alerted again when your hours start.') : 'No alerts until you switch on.'}</div></div>
          <button class="switch ${a.available ? 'on' : ''}" id="onoff" role="switch" aria-checked="${a.available}" aria-label="Taking jobs" style="flex-shrink:0"><span></span></button></div></div>
      <div class="kpis">${[['Jobs this week', d.week.jobs], ['Earned this week', naira(d.week.earned)], ['Done this month', d.month.done], ['Earned this month', naira(d.month.earned)]].map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">How you are doing</div>
        ${[['Answer rate', R.offered >= 3 ? pct(R.responseRate) : 'New', R.offered >= 3 ? `${R.answered} of ${R.offered} alerts answered in 60 days` : 'Shows after your first few alerts', R.offered < 3 || R.responseRate >= 0.7],
           ['Rating', R.ratings ? '★ ' + Number(R.stars).toFixed(1) : 'New', R.ratings ? R.ratings + ' customer review' + (R.ratings === 1 ? '' : 's') : 'Finish a job and ask for a rating', !R.ratings || R.stars >= 4],
           ['Jobs dropped', String(R.dropped), R.dropped ? 'Accepted, then cancelled. This moves you down the list.' : 'None. Keep it that way.', !R.dropped]].map(([l, v, s, good]) => `<div class="row" style="gap:10px"><div class="grow"><div style="font-size:14px;font-weight:650">${l}</div><div class="small muted">${s}</div></div><div style="font-size:17px;font-weight:800;color:${good ? 'var(--green-dark)' : '#D92D20'}">${v}</div></div>`).join('')}
        <div class="small muted" style="line-height:1.5">Buja alerts the nearest mechanics first, then moves quick, well-rated mechanics up and ones who drop jobs down.</div></div>
      ${d.offers.length ? `<div class="section">RINGING NOW</div>${d.offers.map((o) => `<a class="card row" href="#/jobs/${o.id}" style="padding:12px 14px;gap:10px;border-color:#D92D20"><span style="width:40px;height:40px;border-radius:20px;background:#D92D20;color:#fff;display:flex;align-items:center;justify-content:center">${icon('wrench')}</span><span class="grow"><span style="display:block;font-weight:700">${o.km < 1 ? 'Under 1' : o.km} km away</span><span class="small muted">${h(o.problem)}</span></span>${icon('chevron-right')}</a>`).join('')}` : ''}
      <div class="card stack" style="padding:14px;gap:10px"><div class="row"><div class="h-sm grow">Working hours</div><label class="small row" style="gap:6px"><input type="checkbox" id="anytime" ${a.schedule ? '' : 'checked'}> Any time</label></div>
        <div class="stack" id="hours" style="gap:6px;${a.schedule ? '' : 'opacity:.45;pointer-events:none'}">${DAYS.map(([k, l]) => `<div class="row" style="gap:6px;min-width:0"><label class="row small" style="gap:4px;width:50px;flex-shrink:0"><input type="checkbox" data-day="${k}" ${sch[k] || !a.schedule ? 'checked' : ''}> ${l}</label><input class="input" type="time" data-from="${k}" value="${hr((sch[k] || [8, 18])[0])}" style="height:38px;flex:1 1 0;min-width:0;padding:0 4px;font-size:12.5px"><span class="small muted" style="flex-shrink:0">–</span><input class="input" type="time" data-to="${k}" value="${hr((sch[k] || [8, 18])[1])}" style="height:38px;flex:1 1 0;min-width:0;padding:0 4px;font-size:12.5px"></div>`).join('')}</div>
        <button class="btn btn-sm btn-ink" id="savehours">Save hours</button><div class="small muted">Outside these hours you are not alerted, even when switched on. A night shift like 20:00 to 06:00 works too.</div></div>
      <div class="section">RECENT JOBS</div>
      ${d.recent.length ? `<div class="card list">${d.recent.map((r) => `<a class="item" href="#/jobs/${r.id}"><div class="grow"><div class="t">${h(r.customer)}: ${h(r.problem)}</div><div class="s">${r.at.slice(0, 10)} · ${h(STATUS[r.status] ? STATUS[r.status][0] : r.status)}${r.price ? ' · ' + naira(r.price) : ''}</div></div>${icon('chevron-right')}</a>`).join('')}</div>` : `<div class="small muted">No jobs yet. Keep Buja open with notifications on, and the first breakdown near you will ring.</div>`}
      <div class="card stack" style="padding:14px;gap:8px"><div class="h-sm">Get more customers</div><div class="small muted">Send your Buja profile to your regular customers. Their ratings help new ones choose you.</div><button class="btn btn-sm btn-outline" id="share">${icon('paper-plane')} Share my profile</button></div>
    </main>`;
  }, {
    mount(el) {
      const tg = el.querySelector('#onoff'); if (!tg) return;
      tg.addEventListener('click', async () => { tg.disabled = true; const on = !tg.classList.contains('on'); tg.classList.toggle('on', on); try { await api.artisanSchedule({ available: on, schedule: readHours() }); toast(on ? 'You are taking jobs' : 'Switched off'); location.reload(); } catch (err) { tg.disabled = false; failed(el, err); } });
      const readHours = () => { if (el.querySelector('#anytime').checked) return null; const s = {}; el.querySelectorAll('[data-day]').forEach((c) => { if (!c.checked) return; const k = c.dataset.day; const f = el.querySelector(`[data-from="${k}"]`).value.split(':'), t = el.querySelector(`[data-to="${k}"]`).value.split(':'); s[k] = [+f[0] + (+f[1] || 0) / 60, +t[0] + (+t[1] || 0) / 60]; }); return Object.keys(s).length ? s : null; };
      el.querySelector('#anytime').addEventListener('change', (e) => { const box = el.querySelector('#hours'); box.style.opacity = e.target.checked ? .45 : 1; box.style.pointerEvents = e.target.checked ? 'none' : ''; });
      el.querySelector('#savehours').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { await api.artisanSchedule({ schedule: readHours() }); toast('Hours saved'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } });
      el.querySelector('#share').addEventListener('click', async () => { const d = await api.artisanDashboard(); const t = `${d.artisan.name}, ${d.artisan.trade.toLowerCase()} on Buja. See my reviews and call me: ${d.artisan.profileUrl}`; if (navigator.share) navigator.share({ title: d.artisan.name, text: t }).catch(() => {}); else { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast(d.artisan.profileUrl, 5000); } } });
    }
  });

  /* ============================== MY JOBS ============================== */
  const STATUS = { requested: ['Waiting for a reply', '#B7791F'], accepted: ['Accepted', '#1F5FBF'], enroute: ['On the way', '#2E7D1E'], arrived: ['Arrived', '#2E7D1E'], done: ['Done', '#6B6B73'], declined: ['Declined', '#D92D20'], cancelled: ['Cancelled', '#6B6B73'], expired: ['No reply', '#6B6B73'] };
  route('/jobs', { auth: true, tabs: '' }, async () => {
    try { const r = await api.me(); state.user = r.user; } catch {}
    const { jobs } = await api.jobs();
    const art = state.user.artisan;
    return `${topbar('My jobs', '/me', `<a class="iconbtn" href="#/artisans/map?trade=mechanic" aria-label="Find someone">${icon('map-location-dot')}</a>`)}<main class="pad stack" style="gap:10px">
      ${art ? `<div class="card row" style="padding:14px;gap:12px;border:2px solid ${art.available ? 'var(--green)' : 'var(--line)'}"><div class="grow"><div style="font-size:16px;font-weight:800">${art.available ? 'You are online' : 'You are offline'}</div><div class="small muted">${art.available ? 'Breakdowns near you will ring your phone.' : 'You will not get new jobs until you switch on.'}</div></div>
        <button class="toggle ${art.available ? 'on' : ''}" id="online" role="switch" aria-checked="${art.available}" aria-label="Taking jobs"><span></span></button></div>
        <a class="card row" href="#/artisans/register" style="padding:12px 14px;gap:10px"><span class="grow small" style="font-weight:600">Edit my profile, photo and workshop pin</span>${icon('chevron-right')}</a>`
      : `<a class="card row" href="#/artisans/register" style="padding:14px;gap:12px;border-style:dashed"><span style="width:40px;height:40px;border-radius:12px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center">${icon('wrench')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:700">Are you a mechanic or artisan?</span><span class="small muted">Register in three steps and get breakdown jobs near you.</span></span>${icon('chevron-right')}</a>`}
      ${jobs.length ? jobs.map((j) => `<a class="card row" href="#/jobs/${j.id}" style="padding:12px 14px;gap:12px"><span style="width:42px;height:42px;border-radius:21px;background:${TRADE_COLOR[j.trade] || '#FF7A1A'};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(TRADE_ICON[j.trade] || 'wrench')}</span><span class="grow" style="min-width:0"><span style="display:block;font-size:14px;font-weight:700">${h(j.role === 'customer' ? j.other.name : j.tradeLabel + ' job for ' + j.other.name)}</span><span class="small muted" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(j.problem)}</span></span><span class="tag" style="color:${STATUS[j.status][1]}">${STATUS[j.status][0]}</span></a>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('wrench')}</div><div class="h-md">No jobs yet</div><div class="small muted" style="max-width:280px;line-height:1.5">Car broke down, lights out, a tap that will not stop? Find the nearest trusted hand and watch them come to you.</div><a class="btn btn-primary" href="#/artisans/map?trade=mechanic" style="width:auto">Find a mechanic near me</a></div>`}
    </main>`;
  }, {
    mount(el) {
      el.querySelector('#online')?.addEventListener('click', async (e) => {
        const b = e.currentTarget; const next = !b.classList.contains('on'); b.disabled = true;
        try { await api.artisanOnline(next); const r = await api.me(); state.user = r.user; toast(next ? 'You are online. Keep Buja open or notifications on.' : 'You are offline'); location.reload(); } catch (err) { b.disabled = false; failed(el, err); }
      });
    }
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
        if (j.role === 'customer' && j.status === 'requested' && j.mode === 'nearest') {
          if (!map.has('radar')) map.marker('radar', { lng: j.place.lng, lat: j.place.lat, z: 1, anchor: 'center', html: `<div class="bm-radar"></div>` });
        } else map.remove('radar');
        map.marker('dest', { lng: j.place.lng, lat: j.place.lat, z: 2, draggable: j.role === 'customer' && ['requested', 'accepted'].includes(j.status), onDragEnd: async (lng, lat) => { try { const r = await api.jobWhere(id, { lat, lng }); toast('Pin moved. They will come to the new spot.'); job = r.job; } catch (err) { failed(el, err); } }, html: j.place.exact ? pinHtml({ iconName: j.role === 'customer' ? 'person' : 'flag-checkered', color: '#101014', label: j.role === 'customer' ? 'You' : 'Customer', sub: j.landmark || '' }) : `<div style="width:120px;height:120px;border-radius:50%;background:rgba(255,122,26,.18);border:2px dashed #FF7A1A"></div>`, anchor: j.place.exact ? 'bottom' : 'center' });
        if (j.live) {
          if (map.has('art')) map.move('art', j.live.lng, j.live.lat, { heading: j.live.heading, ms: 3500 });
          else map.marker('art', { lng: j.live.lng, lat: j.live.lat, z: 4, anchor: 'center', html: j.role === 'customer' ? avatarHtml(j.photo || j.other.avatar, color, (j.other.name || '?').slice(0, 1).toUpperCase()) : carHtml(color, j.trade === 'mechanic' || j.trade === 'towing' || j.trade === 'vulcanizer' ? 'car-side' : tIcon) });
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
        if (j.status === 'requested' && j.mode === 'nearest' && j.role === 'customer') return j.dispatch && j.dispatch.alerted ? `${j.dispatch.alerted} ${j.dispatch.alerted === 1 ? 'mechanic' : 'mechanics'} alerted` : 'Finding a mechanic';
        if (j.status === 'requested') return j.role === 'customer' ? `Waiting for ${n} to reply` : 'New job request';
        if (j.status === 'accepted') return j.role === 'customer' ? `${n} accepted` : 'You accepted. Set off when ready';
        if (j.status === 'enroute' && L) { if (L.lost) return `Signal lost ${Math.round(L.age / 60)} min ago`; if (L.stopped) return `${j.role === 'customer' ? n + ' has' : 'You have'} stopped for ${L.stoppedMin} min`; return L.etaMin != null ? `${L.etaMin <= 1 ? 'Arriving now' : L.etaMin + ' min away'}` : 'On the way'; }
        if (j.status === 'enroute') return 'On the way';
        if (j.status === 'arrived') return j.role === 'customer' ? `${n} has arrived` : 'You have arrived';
        return STATUS[j.status][0];
      };

      /* Agreeing the price in the app, before the work. */
      const priceBlock = (j) => {
        const Q = j.quote, live = ['accepted', 'enroute', 'arrived'].includes(j.status);
        if (j.role === 'artisan') {
          if (!live && !Q) return '';
          if (Q && Q.status === 'accepted') return `<div class="card row" style="padding:12px 14px;gap:10px;background:var(--green-tint);border-color:var(--green)"><span class="grow"><span class="small muted" style="display:block">Agreed price</span><strong style="font-size:18px">${naira(Q.amount)}</strong>${Q.note ? ` <span class="small muted">${h(Q.note)}</span>` : ''}</span>${icon('circle-check')}</div>`;
          if (!live) return '';
          return `<div class="card stack" style="padding:12px 14px;gap:8px"><div class="small" style="font-weight:700">${Q ? (Q.status === 'declined' ? 'Your price was declined. Send a new one:' : 'Waiting for your customer to accept ' + naira(Q.amount) + '. Change it:') : 'Send your price before you start'}</div>
            <div class="row" style="gap:8px"><span style="font-weight:800;align-self:center">₦</span><input class="input" id="qamt" type="number" inputmode="numeric" placeholder="15000" value="${Q ? Q.amount : ''}" style="flex:1"><button class="btn btn-sm btn-primary" id="qsend" style="width:auto">Send</button></div>
            <input class="input" id="qnote" maxlength="200" placeholder="What it covers, e.g. new battery and fitting" value="${h(Q && Q.note || '')}"></div>`;
        }
        if (!Q) return live ? `<div class="small muted">Your ${h(j.tradeLabel.toLowerCase())} will send a price here before starting. Do not pay for work you have not agreed.</div>` : '';
        if (Q.status === 'sent') return `<div class="card stack" style="padding:14px;gap:10px;border-color:var(--orange);background:var(--orange-tint)"><div><span class="small muted">Price for this job</span><div style="font-size:24px;font-weight:900">${naira(Q.amount)}</div>${Q.note ? `<div class="small">${h(Q.note)}</div>` : ''}</div>
          <div class="row" style="gap:8px"><button class="btn btn-primary grow" data-q="accept">Accept price</button><button class="btn btn-outline" data-q="decline" style="width:auto">Decline</button></div></div>`;
        if (Q.status === 'accepted') return `<div class="card row" style="padding:12px 14px;gap:10px;background:var(--green-tint);border-color:var(--green)"><span class="grow"><span class="small muted" style="display:block">You agreed</span><strong style="font-size:18px">${naira(Q.amount)}</strong>${Q.note ? ` <span class="small muted">${h(Q.note)}</span>` : ''}</span>${icon('circle-check')}</div>`;
        return `<div class="small muted">You declined ${naira(Q.amount)}. Talk to them; they can send a new price.</div>`;
      };
      const bindPrice = () => {
        sheet.body.querySelector('#qsend')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.jobQuote(id, { amount: +sheet.body.querySelector('#qamt').value, note: sheet.body.querySelector('#qnote').value }); toast('Price sent'); render(r.job); } catch (err) { busy(b, false); failed(el, err); } });
        sheet.body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.jobQuoteAnswer(id, b.dataset.q); toast(b.dataset.q === 'accept' ? 'Price agreed' : 'Declined'); render(r.job); } catch (err) { busy(b, false); failed(el, err); } }));
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
          if (j.status === 'requested' && j.mode === 'nearest') body = `<div class="stack" style="gap:8px"><div style="font-size:15px;font-weight:700">Alerting the nearest ${h(j.tradeLabel.toLowerCase())}s</div>
            <div class="small muted" style="line-height:1.5">${j.dispatch ? `${j.dispatch.alerted} alerted so far, round ${Math.max(1, j.dispatch.ring)} of ${j.dispatch.maxRings}.` : ''} The first to accept comes to your pin. If nobody answers in a minute, Buja asks the next ones further out.</div>
            <div style="height:6px;border-radius:3px;background:var(--surface);overflow:hidden"><div style="height:6px;background:var(--orange);width:${j.dispatch ? Math.round(j.dispatch.ring / j.dispatch.maxRings * 100) : 10}%;transition:width .6s"></div></div>
            <div class="small muted">Not exactly where your car is? Drag the red pin.</div></div>
            <button class="btn btn-outline" data-act="cancel">Cancel request</button>`;
          else if (j.status === 'requested') body = `<div class="small muted" style="line-height:1.5">They have your rough area, not your exact spot, until they accept. Requests expire after 20 minutes.</div><button class="btn btn-outline" data-act="cancel">Cancel request</button>`;
          else if (j.status === 'accepted') body = `<div class="small muted" style="line-height:1.5">They can now see where you are. When they set off you will see them move on the map.</div><button class="btn btn-outline" data-act="cancel">Cancel</button>`;
          else if (j.status === 'enroute') body = `${eta}<button class="btn btn-outline" data-act="cancel">Cancel</button>`;
          else if (j.status === 'arrived') body = `<div class="small muted">When the work is finished, mark it done and rate them.</div><button class="btn btn-primary" data-rate>${icon('star')} Fixed. Rate ${h(j.other.name)}</button>`;
          else if (j.status === 'done' && !j.rated) body = `<button class="btn btn-primary" data-rate>${icon('star')} Rate ${h(j.other.name)}</button>`;
          else if (j.status === 'done') body = `<div class="small muted">Thank you for rating. It helps the next person choose.</div>`;
          else body = `<a class="btn btn-primary" href="#/artisans/map?trade=${h(j.trade)}">Find someone else nearby</a>`;
        } else {
          if (j.status === 'requested' && j.mode === 'nearest') body = `<div class="card" style="padding:12px;background:var(--orange-tint);border-color:var(--orange)"><div class="small" style="font-weight:700;color:var(--orange-dark)">Breakdown near you. First to accept gets it.</div><div style="font-size:15px;font-weight:600;margin-top:4px">${h(j.problem)}</div><div class="small muted" style="margin-top:6px">${j.km != null ? 'About ' + (j.km < 1 ? 'under 1' : j.km) + ' km from your workshop. ' : ''}You see the exact spot once you accept.</div></div><div class="row" style="gap:8px"><button class="btn btn-primary grow" data-act="accept" style="height:52px">Accept and go</button><button class="btn btn-outline" data-act="decline" style="width:auto">Not now</button></div>`;
          else if (j.status === 'requested') body = `<div class="card" style="padding:12px;background:var(--surface);border:none"><div class="small muted">Problem</div><div style="font-size:15px;font-weight:600;margin-top:2px">${h(j.problem)}</div><div class="small muted" style="margin-top:6px">${j.km != null ? 'About ' + (j.km < 1 ? 'under 1' : j.km) + ' km from your workshop. ' : ''}You will see the exact spot once you accept.</div></div><div class="row" style="gap:8px"><button class="btn btn-primary grow" data-act="accept">Accept</button><button class="btn btn-outline" data-act="decline" style="width:auto">Decline</button></div>`;
          else if (j.status === 'accepted') body = `<div class="card" style="padding:12px;background:var(--surface);border:none"><div class="small muted">Problem</div><div style="font-size:15px;font-weight:600">${h(j.problem)}</div>${j.landmark ? `<div class="small" style="margin-top:4px">Landmark: ${h(j.landmark)}</div>` : ''}</div><button class="btn btn-primary" data-start>${icon('car-side')} I am setting off</button><div class="small muted" style="line-height:1.5">Your customer will see you move on the map with your arrival time. Keep this screen open while you travel.</div>`;
          else if (j.status === 'enroute') body = `${eta}<a class="btn btn-outline" href="https://www.google.com/maps/dir/?api=1&destination=${j.place.lat},${j.place.lng}&travelmode=driving" target="_blank" rel="noopener">${icon('route')} Directions in Google Maps</a><button class="btn btn-primary" data-act="arrived">I have arrived</button><div class="small muted" id="share">${watch != null ? 'Sharing your location' : 'Location not being shared'}</div>`;
          else if (j.status === 'arrived') body = `<div class="small muted">When the work is finished:</div><button class="btn btn-primary" data-act="done">${icon('circle-check')} Job done</button>`;
          else body = `<div class="small muted">${j.status === 'done' ? 'Well done. Their rating will show on your profile.' : 'This job is closed.'}</div>`;
        }
        sheet.body.innerHTML = `<div class="stack" style="gap:14px;padding-top:4px">${who}${j.role === 'customer' || j.status !== 'requested' ? `<div class="small" style="color:var(--ink-2)"><strong>${h(j.tradeLabel)}:</strong> ${h(j.problem)}</div>` : ''}${priceBlock(j)}${body}</div>`;
        sheet.body.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
          const a = b.dataset.act; if ((a === 'cancel' || a === 'decline') && !confirm(a === 'cancel' ? 'Cancel this job?' : 'Decline this job?')) return;
          busy(b, true);
          try { const r = await api.jobAct(id, a); if (r.declined) { toast('Declined'); go('/jobs'); return; } if (a === 'arrived' || a === 'done' || a === 'cancel') stopSharing(); draw(r.job); render(r.job); }
          catch (err) { busy(b, false); if (err && (err.error === 'taken' || err.error === 'not_found')) { toast('Another mechanic took this one'); go('/jobs'); return; } failed(el, err); }
        }));
        sheet.body.querySelector('[data-start]')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); const p = await here(10000); try { const r = await api.jobAct(id, 'start', p || {}); startSharing(); draw(r.job); render(r.job); } catch (err) { busy(b, false); failed(el, err); } });
        bindPrice();
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
        if (!document.hidden) { try { const r = await api.job(id); draw(r.job); if (JSON.stringify(r.job) !== JSON.stringify(job) || sheet.body.querySelector('#rs') == null) { if (!sheet.body.querySelector('#rs') && !(document.activeElement && ['qamt', 'qnote'].includes(document.activeElement.id))) render(r.job); else job = r.job; } } catch {} }
        timer = setTimeout(tick, job && job.status === 'enroute' ? 3000 : 4000); // quicker while someone is on the way
      };
      draw(job); render(job);
      if (job.role === 'artisan' && job.status === 'enroute') startSharing(); // reopened mid-journey
      timer = setTimeout(tick, 4000);
    }
  });
}
