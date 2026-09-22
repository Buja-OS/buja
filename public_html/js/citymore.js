// Buja: office queues, commute sharing, the rent index, and Learn analytics for the admin. Registered by app.js.
export function registerCityMore({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon, avatar } = ui;
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const ago = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 60 ? 'just now' : d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  const naira = (n) => '₦' + Number(n).toLocaleString();
  function here(ms = 4000) { if (!navigator.geolocation) return Promise.resolve(null); return new Promise((res) => { let d = false; const f = (v) => { if (!d) { d = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 120000 }); }); }
  const CROWDCOL = { empty: 'var(--green-dark)', busy: 'var(--orange-dark)', packed: '#D92D20', closed: 'var(--ink-3)' };
  const stars = (r) => r && r.count ? `★ ${Number(r.stars).toFixed(1)} (${r.count})` : 'no ratings yet';

  /* ================================ QUEUES ================================ */
  route('/queues', { auth: true, tabs: '' }, async () => {
    const at = await here(3500); const f = Object.fromEntries(q().entries());
    const d = await api.queues({ ...(at || {}), service: f.service || '' });
    return `${topbar('Office queues', '/home', `<a class="iconbtn" href="#/queues/add" aria-label="Add an office" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <div class="row" style="gap:8px;padding:0 16px;overflow-x:auto;scrollbar-width:none"><a class="chip ${!f.service ? 'on' : ''}" href="#/queues">All</a>${Object.entries(d.services).map(([k, l]) => `<a class="chip ${f.service === k ? 'on' : ''}" href="#/queues?service=${k}">${h(l)}</a>`).join('')}</div>
    <main class="pad stack" style="gap:10px">
      <div class="small muted">NIN, passport, licence, VIO. How long the queue is right now, from the last person who stood in it. ${at ? 'Nearest first.' : ''}</div>
      ${d.offices.map((o) => `<div class="card stack" style="padding:12px 14px;gap:8px">
        <div class="row" style="gap:10px"><div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${h(o.name)}</div><div class="small muted">${h(o.serviceLabel)} · ${h(o.district)}${o.km != null ? ' · ' + o.km + ' km' : ''}</div></div>${o.today ? `<span class="tag" style="background:var(--surface);color:${CROWDCOL[o.today.crowd]};font-weight:700">${h(o.today.crowdLabel)}</span>` : ''}</div>
        ${o.today ? `<div class="row" style="gap:12px;font-size:14px"><span><strong>${o.today.crowd === 'closed' ? '—' : o.today.wait + ' min'}</strong> <span class="small muted">wait</span></span><span class="grow"></span><span class="small" style="color:var(--green-dark)">${h(o.today.by)}, ${ago(o.today.at)} · ${o.today.n} report${o.today.n === 1 ? '' : 's'} today</span></div>${o.today.note ? `<div class="small" style="color:var(--ink-2)">“${h(o.today.note)}”</div>` : ''}` : `<div class="small muted">No reports in the last 12 hours.</div>`}
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline grow" data-report="${o.id}" data-name="${h(o.name)}">I am here, report the queue</button>${o.lat != null ? `<a class="iconbtn" href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener" style="width:34px;height:34px" aria-label="Map">${icon('location-dot')}</a>` : ''}</div>
      </div>`).join('')}
      <div id="sheet"></div>
      <div class="small muted" style="line-height:1.5">The wait shown is the middle of today's reports, so one exaggeration cannot move it. Reports expire after 12 hours.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => {
        el.querySelector('#sheet').innerHTML = `<div class="card stack" style="padding:16px;gap:12px;position:fixed;left:12px;right:12px;bottom:calc(12px + var(--safe-b));z-index:60;box-shadow:0 16px 40px rgba(0,0,0,.3)"><div class="row"><div class="h-sm grow">${b.dataset.name}</div><button class="iconbtn" id="qx" style="width:34px;height:34px">${icon('xmark')}</button></div>
          <div class="row" style="gap:6px;flex-wrap:wrap" id="qc">${Object.entries(CROWDCOL).map(([k], i) => `<button type="button" class="chip ${i === 1 ? 'on' : ''}" data-c="${k}">${{ empty: 'Walked in', busy: 'Busy', packed: 'Packed', closed: 'Closed' }[k]}</button>`).join('')}</div>
          <div class="field" style="margin:0"><label for="qw">How long did you wait, in minutes?</label><input class="input" id="qw" type="number" inputmode="numeric" placeholder="45"></div>
          <div class="field" style="margin:0"><label for="qn">Tip for the next person (optional)</label><input class="input" id="qn" maxlength="200" placeholder="Come before 8, bring photocopies"></div>
          <button class="btn btn-primary" id="qs">Post it</button></div>`;
        let cv = 'busy'; const sh = el.querySelector('#sheet');
        sh.querySelectorAll('[data-c]').forEach((c) => c.addEventListener('click', () => { cv = c.dataset.c; sh.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === c)); }));
        sh.querySelector('#qx').addEventListener('click', () => { sh.innerHTML = ''; });
        sh.querySelector('#qs').addEventListener('click', async (e) => { const btn = e.currentTarget; busy(btn, true); try { await api.queueReport(b.dataset.report, { crowd: cv, waitMin: sh.querySelector('#qw').value, note: sh.querySelector('#qn').value }); toast('Posted. Thank you.'); location.reload(); } catch (err) { busy(btn, false); failed(el, err); } });
      }));
    }
  });
  route('/queues/add', { auth: true, tabs: '' }, async () => { const d = await api.queues({}); return `${topbar('Add an office', '/queues')}<form id="of" class="pad stack" style="gap:14px">${field({ id: 'name', label: 'Office name', placeholder: 'NIMC enrolment centre, Kubwa' })}<div class="field"><label for="service">Service</label><select class="input" id="service">${Object.entries(d.services).map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('')}</select></div><div class="small muted">Stand at the office when you add it; Buja pins it where you are.</div><button class="btn btn-primary" type="submit">${icon('location-dot')} Add it here</button></form>`; }, {
    mount(el) { clearOnInput(el); el.querySelector('#of').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); const p = await here(10000); try { await api.queueOffice({ name: el.querySelector('#name').value, service: el.querySelector('#service').value, lat: p?.lat, lng: p?.lng }); toast('Added'); go('/queues'); } catch (err) { busy(btn, false); failed(el, err); } }); }
  });

  /* ================================ COMMUTE SHARE ================================ */
  const rideCard = (r) => `<div class="card stack" style="padding:12px 14px;gap:8px">
    <div class="row" style="gap:10px">${r.driver.avatar ? `<img src="${h(r.driver.avatar)}" alt="" style="width:40px;height:40px;border-radius:20px;object-fit:cover;flex-shrink:0">` : avatar(r.driver.name, 40)}<div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${h(r.from)} → ${h(r.to)}</div><div class="small muted">Leaves ${h(r.leavesAt)} · ${h(r.days)} · ${r.left} of ${r.seats} seat${r.seats === 1 ? '' : 's'} free</div></div><div style="text-align:right"><div style="font-weight:800">${r.share ? naira(r.share) : 'Free'}</div><div class="small muted">per seat</div></div></div>
    <div class="row small" style="gap:8px"><a href="#/people/${r.driver.id}" style="font-weight:650">${h(r.driver.name)}</a>${r.driver.verified ? `<span class="tag green">${icon('circle-check')} Selfie verified</span>` : ''}<span class="muted">${stars(r.driver.rating)}</span></div>
    ${r.note ? `<div class="small" style="color:var(--ink-2)">${h(r.note)}</div>` : ''}
    ${r.mine ? `<div class="stack" style="gap:6px">${(r.requests || []).length ? r.requests.map((x) => `<div class="row small" style="gap:8px"><a href="#/people/${x.id}" class="grow" style="font-weight:650">${h(x.name)} <span class="muted" style="font-weight:400">${stars(x.rating)}</span></a>${x.status === 'asked' ? `<button class="btn btn-sm btn-ink" data-decide="${r.id}" data-user="${x.id}" data-accept="1" style="width:auto">Accept</button><button class="btn btn-sm btn-outline" data-decide="${r.id}" data-user="${x.id}" data-accept="0" style="width:auto">No</button>` : `<span class="tag ${x.status === 'accepted' ? 'green' : ''}">${x.status}</span>`}</div>`).join('') : `<div class="small muted">No requests yet.</div>`}<button class="btn btn-sm btn-outline" data-stop="${r.id}">Stop offering this ride</button></div>`
    : r.my === 'accepted' ? `<div class="row" style="gap:8px"><span class="tag green">Seat confirmed</span><button class="btn btn-sm btn-ink grow" data-ask="${r.id}">${icon('message')} Message ${h(r.driver.name)}</button></div>` : r.my === 'asked' ? `<div class="row" style="gap:8px"><span class="tag">Asked, waiting</span><button class="btn btn-sm btn-outline grow" data-ask="${r.id}">${icon('message')} Message</button></div>` : r.my === 'declined' ? `<span class="tag">Not this time</span>` : r.left ? `<button class="btn btn-sm btn-primary" data-ask="${r.id}">Ask for a seat</button>` : `<span class="tag">Full</span>`}
  </div>`;
  route('/rides', { auth: true, tabs: '' }, async () => {
    const f = Object.fromEntries(q().entries());
    const [d, mine] = await Promise.all([api.rides(f), api.rides({ mine: 1 })]);
    return `${topbar('Commute share', '/home', `<a class="iconbtn" href="#/rides/new" aria-label="Offer seats" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <main class="pad stack" style="gap:12px">
      <div class="card stack" style="padding:14px;gap:10px;background:var(--night);color:#fff;border-color:var(--night)"><div style="font-size:15px;font-weight:700">Same route, same time, split the cost</div><div class="small" style="color:#B5B5BC;line-height:1.5">Drivers with empty seats offer them along their own commute. Riders ask, drivers choose, both are rated afterwards. Not a taxi: nobody drives out of their way and there is no meter.</div><a class="btn btn-sm" href="#/rides/new" style="width:auto;background:var(--green);color:#101014;border:none">I drive, offer my seats</a></div>
      <form id="rf" class="row" style="gap:8px"><input class="input" id="from" placeholder="From (e.g. Kubwa)" value="${h(f.fromName || '')}" style="flex:1"><input class="input" id="to" placeholder="To (e.g. Wuse)" value="${h(f.toName || '')}" style="flex:1"><button class="iconbtn" type="submit" style="width:46px;height:46px;flex-shrink:0">${icon('magnifying-glass')}</button></form>
      ${mine.rides.length ? `<div class="section">MINE</div>${mine.rides.map(rideCard).join('')}` : ''}
      <div class="section">${f.from || f.to ? 'MATCHING RIDES' : 'ALL RIDES'}</div>
      ${d.rides.filter((r) => !mine.rides.some((m) => m.id === r.id)).map(rideCard).join('') || `<div class="small muted" style="padding:10px 0">No rides offered on this route yet. Post a saved search in Waka and you will be told when one appears.</div>`}
      <div class="small muted" style="line-height:1.5">Only selfie-verified drivers can offer seats. Share your trip on Buja when you get in, and never pay before the ride.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelector('#rf').addEventListener('submit', async (e) => { e.preventDefault(); const fromName = el.querySelector('#from').value.trim(), toName = el.querySelector('#to').value.trim(); const p = new URLSearchParams(); if (fromName) { const r = await api.wakaPlaces(fromName); if (r.places && r.places[0]) { p.set('from', r.places[0].id); p.set('fromName', r.places[0].name); } } if (toName) { const r = await api.wakaPlaces(toName); if (r.places && r.places[0]) { p.set('to', r.places[0].id); p.set('toName', r.places[0].name); } } go('/rides?' + p); });
      el.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.rideAsk(b.dataset.ask); go('/inbox/' + r.threadId); } catch (err) { busy(b, false); failed(el, err); } }));
      el.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { await api.rideDecide(b.dataset.decide, { userId: +b.dataset.user, accept: b.dataset.accept === '1' }); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
      el.querySelectorAll('[data-stop]').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Stop offering this ride?')) return; await api.rideStop(b.dataset.stop); location.reload(); }));
    }
  });
  route('/rides/:id', { auth: true, tabs: '' }, async ({ id }) => { if (id === 'new') return ''; const d = await api.rides({ mine: 1 }); const all = await api.rides({}); const r = [...d.rides, ...all.rides].find((x) => String(x.id) === String(id)); return `${topbar('Ride', '/rides')}<main class="pad">${r ? rideCard(r) : '<div class="small muted">This ride is no longer offered.</div>'}</main>`; }, {
    mount(el) { el.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', async () => { const r = await api.rideAsk(b.dataset.ask); go('/inbox/' + r.threadId); })); el.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', async () => { await api.rideDecide(b.dataset.decide, { userId: +b.dataset.user, accept: b.dataset.accept === '1' }); location.reload(); })); el.querySelectorAll('[data-stop]').forEach((b) => b.addEventListener('click', async () => { await api.rideStop(b.dataset.stop); go('/rides'); })); }
  });
  route('/rides/new', { auth: true, tabs: '' }, async () => `${topbar('Offer seats', '/rides')}<form id="nf" class="pad stack" style="gap:14px">
      ${state.user.selfieVerified ? '' : `<div class="card" style="padding:12px 14px;background:var(--orange-tint);border-color:var(--orange)"><div class="small" style="line-height:1.5"><strong>Verify with a selfie first.</strong> Riders are getting into your car; they need to know you are real. It takes a minute under Me → Verify.</div><a class="btn btn-sm btn-ink" href="#/me/verify" style="width:auto;margin-top:8px">Verify now</a></div>`}
      ${field({ id: 'fromName', label: 'Leaving from', placeholder: 'Kubwa', hint: 'A Waka place; Buja matches it as you type.' })}<div id="fromPick" class="row" style="gap:6px;flex-wrap:wrap"></div>
      ${field({ id: 'toName', label: 'Going to', placeholder: 'Wuse' })}<div id="toPick" class="row" style="gap:6px;flex-wrap:wrap"></div>
      <div class="row" style="gap:10px">${field({ id: 'leavesAt', label: 'Leaves at', type: 'time', value: '07:15' })}${field({ id: 'days', label: 'Days', value: 'Mon-Fri' })}</div>
      <div class="row" style="gap:10px">${field({ id: 'seats', label: 'Seats', type: 'number', value: '2', inputmode: 'numeric' })}${field({ id: 'share', label: 'Cost share ₦ per seat', type: 'number', placeholder: '500', inputmode: 'numeric', hint: 'Fuel money, not a fare. 0 is fine.' })}</div>
      <div class="field"><label for="note">Anything riders should know (optional)</label><textarea class="input" id="note" maxlength="300" placeholder="Pickup by Berger junction, no smoking, I leave on the dot." style="height:80px;padding:12px 14px;resize:none"></textarea></div>
      <button class="btn btn-primary" type="submit" ${state.user.selfieVerified ? '' : 'disabled'}>${icon('car')} Offer these seats</button></form>`, {
    mount(el) {
      clearOnInput(el); const pick = { from: null, to: null };
      for (const k of ['from', 'to']) { const inp = el.querySelector('#' + k + 'Name'); let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => { const r = await api.wakaPlaces(inp.value); el.querySelector('#' + k + 'Pick').innerHTML = (r.places || []).slice(0, 5).map((p) => `<button type="button" class="chip" data-p="${p.id}" data-n="${h(p.name)}">${h(p.name)}</button>`).join(''); el.querySelectorAll('#' + k + 'Pick [data-p]').forEach((c) => c.addEventListener('click', () => { pick[k] = +c.dataset.p; inp.value = c.dataset.n; el.querySelectorAll('#' + k + 'Pick .chip').forEach((x) => x.classList.toggle('on', x === c)); })); }, 300); }); }
      el.querySelector('#nf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { await api.rideCreate({ from: pick.from, to: pick.to, leavesAt: el.querySelector('#leavesAt').value, days: el.querySelector('#days').value, seats: el.querySelector('#seats').value, share: el.querySelector('#share').value, note: el.querySelector('#note').value }); toast('Offered. Riders on this route can now ask.'); go('/rides'); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });

  /* ================================ RENT INDEX ================================ */
  route('/rent-index', { auth: true, tabs: '' }, async () => {
    const d = await api.rentIndex();
    return `${topbar('Rent index', '/homes')}<main class="pad stack" style="gap:10px">
      <div class="small muted" style="line-height:1.5">What landlords on Buja are asking per year, by district and bedrooms. The middle value of ${d.listings} live listing${d.listings === 1 ? '' : 's'}, with the range. Asking is not agreed: use it to know whether a price is normal, not what to pay.</div>
      ${d.index.length ? d.index.map((r) => `<div class="card stack" style="padding:12px 14px;gap:6px"><div style="font-size:15px;font-weight:700">${h(r.district)}</div>${r.beds.map((b) => `<div class="row small" style="gap:8px"><span style="width:56px">${b.beds} bed</span><span class="grow" style="font-weight:700">${naira(b.median)}</span><span class="muted">${b.n === 1 ? 'one listing' : naira(b.low) + ' to ' + naira(b.high) + ' · ' + b.n}</span></div>`).join('')}</div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('house')}</div><div class="h-md">No rentals listed yet</div></div>`}
    </main>`;
  });

  /* ================================ ADMIN: LEARN ANALYTICS ================================ */
  route('/admin/learn', { auth: true, tabs: '' }, async () => {
    const d = await api.adminLearn();
    return `${topbar('Learn analytics', '/admin')}<main class="pad stack" style="gap:12px">
      <div class="row" style="gap:8px">${[['Learners', d.learners], ['Active, 7 days', d.last7], ['Certificates', d.certificates]].map(([l, v]) => `<div class="card grow" style="padding:12px;text-align:center"><div style="font-size:22px;font-weight:800">${v}</div><div class="small muted">${l}</div></div>`).join('')}</div>
      ${d.courses.map((c) => `<div class="card stack" style="padding:12px 14px;gap:8px">
        <div class="row"><div class="grow"><div style="font-size:15px;font-weight:700">${h(c.title)}</div><div class="small muted">${h(c.level)} · ${c.starters} started · ${c.certificates} finished · ${c.completion}% completion</div></div></div>
        ${c.starters ? `<div class="stack" style="gap:3px">${c.lessons.map((l) => `<div class="row small" style="gap:8px;align-items:center"><span style="width:20px;color:var(--ink-3)">${l.index + 1}</span><span class="grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(l.title)}</span><span style="width:110px;height:6px;border-radius:3px;background:var(--surface)"><span style="display:block;height:6px;border-radius:3px;background:${l.dropFromPrev >= 40 ? '#D92D20' : 'var(--green)'};width:${c.starters ? Math.round(l.done / c.starters * 100) : 0}%"></span></span><span style="width:34px;text-align:right;font-weight:650">${l.done}</span>${l.dropFromPrev >= 40 && l.done < (c.lessons[l.index - 1]?.done ?? 0) ? `<span class="tag" style="background:#FDECEA;color:#D92D20">-${l.dropFromPrev}%</span>` : `<span style="width:52px"></span>`}</div>`).join('')}</div><div class="small muted">Bars: how many who started the course finished each lesson. Red: where more than 40% of the previous lesson's finishers stopped.</div>` : `<div class="small muted">Nobody has started this one yet.</div>`}
      </div>`).join('')}
    </main>`;
  });

  /* ================================ ADMIN: WAKA PRICING ================================ */
  route('/admin/waka-pricing', { auth: true, tabs: '' }, async () => {
    if (!state.user.admin) return `${topbar('', '/admin')}<div class="placeholder"><div class="h-md">Admins only</div></div>`;
    const p = await api.wakaPricing();
    return `${topbar('Waka pricing', '/admin')}<main class="pad stack" style="gap:14px">
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Petrol price in Abuja</div><div class="small muted" style="line-height:1.5">Every Waka estimate moves with this. Check it when fuel news breaks, or monthly: NNPC and Dangote station prices in Abuja. Last set ${h(p.reviewedAt || 'never')}.</div>
        <div class="row" style="gap:8px"><span style="font-size:20px;font-weight:800">₦</span><input class="input" id="pump" type="number" inputmode="numeric" value="${p.pumpPrice}" style="font-size:20px;font-weight:800;flex:1"><span class="small muted">per litre</span></div></div>
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Fine-tune by mode</div><div class="small muted" style="line-height:1.5">Only if riders keep reporting fares above or below Waka's estimate on many routes. Percent, plus or minus.</div>
        ${[['along', 'Along cabs'], ['bus', 'Buses'], ['keke', 'Keke'], ['bolt', 'Bolt and inDrive']].map(([k, l]) => `<div class="row" style="gap:10px"><span class="grow small" style="font-weight:600">${l}</span><span class="small muted">x${p.factors[k]}</span><input class="input" data-adj="${k}" type="number" value="${p.adjust[k]}" style="width:90px;text-align:right"><span class="small muted">%</span></div>`).join('')}</div>
      <div class="card list" id="ex">${Object.entries(p.examples).map(([k, v]) => `<div class="item"><div class="grow small">${h(k)}</div><strong>₦${Number(v).toLocaleString()}</strong></div>`).join('')}</div>
      <button class="btn btn-primary" id="save">Save and update every estimate</button>
      <div class="small muted" style="line-height:1.5">Stretches with ${p.crowdMin} or more rider reports in 30 days show what riders paid instead, whatever is set here.</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelector('#save')?.addEventListener('click', async (e) => {
        const b = e.currentTarget; busy(b, true);
        const adjust = {}; el.querySelectorAll('[data-adj]').forEach((i) => { adjust[i.dataset.adj] = +i.value || 0; });
        try { const p = await api.setWakaPricing({ pumpPrice: +el.querySelector('#pump').value, adjust }); el.querySelector('#ex').innerHTML = Object.entries(p.examples).map(([k, v]) => `<div class="item"><div class="grow small">${h(k)}</div><strong>₦${Number(v).toLocaleString()}</strong></div>`).join(''); toast('Saved. Every estimate now uses ₦' + p.pumpPrice.toLocaleString()); } catch (err) { failed(el, err); }
        busy(b, false);
      });
    }
  });
}
