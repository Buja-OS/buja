// Buja Ask: the AI guide, grounded on Buja's places. Registered into the app router by app.js.
export function registerAsk({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon , placeHref } = ui;
  const stars = (n) => `<span style="color:var(--orange)">${'★'.repeat(Math.round(n || 0))}</span><span style="color:var(--line)">${'★'.repeat(5 - Math.round(n || 0))}</span>`;
  const catIcon = { food: 'utensils', lounge: 'martini-glass', relax: 'seedling', nightlife: 'moon', shopping: 'bag-shopping', kids: 'users', worship: 'church', health: 'hospital', services: 'building', hotel: 'hotel', culture: 'building-columns' };
  /** The phone's position if it answers quickly. Never holds an answer for more than four seconds. */
  let fix = null;
  function here() {
    if (fix && Date.now() - fix.at < 120000) return Promise.resolve(fix);
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((res) => {
      let done = false; const finish = (v) => { if (!done) { done = true; res(v); } };
      setTimeout(() => finish(null), 4000);
      navigator.geolocation.getCurrentPosition((p) => { fix = { lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() }; finish(fix); }, () => finish(null), { enableHighAccuracy: true, timeout: 4000, maximumAge: 120000 });
    });
  }
  const far = (km) => km == null ? '' : km < 1 ? Math.round(km * 1000 / 10) * 10 + ' m away' : km + ' km away';
  const tel = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');

  const SUGGEST = ['Late-night suya near me', 'Good restaurant near me', 'Church near me', 'Pharmacy open now', 'Serene place to relax', 'Cheapest lounge in Jabi', 'Where can kids play on Sunday'];

  /** A real photo when Buja has one (a resident's, or a matched Wikimedia Commons photo); otherwise the map, labelled as a map. */
  function thumbHtml(s, size = 64) {
    const box = `width:${size}px;height:${size}px;border-radius:14px;flex-shrink:0;overflow:hidden;position:relative`;
    const photo = s.photos && s.photos.length ? s.photos[0].url : s.photo ? s.photo.url : null;
    if (photo) return `<div style="${box};background:var(--surface)"><img src="${h(photo)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentNode.classList.add('ph-broken');this.remove()"></div>`;
    if (!s.thumb) return `<div style="${box};background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center">${icon(catIcon[s.category] || 'location-dot')}</div>`;
    const x = Math.round(size / 2 - s.thumb.fx * 256), y = Math.round(size / 2 - s.thumb.fy * 256);
    return `<div style="${box};background:#E8EDE4">
      <img src="${s.thumb.url}" alt="" loading="lazy" style="position:absolute;left:${x}px;top:${y}px;width:256px;height:256px;max-width:none">
      <span style="position:absolute;left:50%;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:6px;background:var(--orange);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>
      <span class="ask-maplbl">MAP</span></div>`;
  }
  const openTag = (o) => o == null ? '' : o.open ? `<span class="ask-open on">${o.allDay ? 'Open 24 hours' : 'Open now' + (o.until ? ' · till ' + h(o.until) : '')}</span>` : `<span class="ask-open">Closed${o.opens ? ' · opens ' + h(o.opens) : ''}</span>`;
  const way = (s) => placeHref({ lat: s.lat, lng: s.lng, name: s.name, sub: [s.kind, s.district].filter(Boolean).join(' · '), icon: catIcon[s.category] || 'location-dot' });

  function spotCard(s) {
    return `<div class="card ask-card">
      <a class="row" href="#/ask/place/${s.id}" style="gap:12px;align-items:flex-start;color:var(--ink);text-decoration:none">
        ${thumbHtml(s)}
        <div class="grow" style="min-width:0">
          <div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start"><span style="font-size:15px;font-weight:750;line-height:1.3">${h(s.name)}</span>${s.rating ? `<span class="small" style="font-weight:700;white-space:nowrap">${icon('star')} ${s.rating}</span>` : ''}</div>
          <div class="small muted" style="margin-top:2px">${h(s.kind || s.categoryLabel)} · ${h(s.district)}${s.away != null ? ` · <strong style="color:var(--ink)">${far(s.away)}</strong>` : ''}</div>
          ${s.why ? `<div class="small" style="margin-top:5px;color:var(--ink-2);line-height:1.45">${h(s.why)}</div>` : openTag(s.open) ? `<div style="margin-top:6px">${openTag(s.open)}</div>` : ''}
        </div></a>
      <div class="row ask-acts">
        ${s.lat != null ? `<a class="btn btn-sm btn-primary" href="${h(way(s))}">${icon('route')} Find the way${s.driveMin ? ` <span style="opacity:.8;font-weight:600">· ${s.walkMin ? s.walkMin + ' min walk' : s.driveMin + ' min drive'}</span>` : ''}</a>` : ''}
        ${s.phone ? `<a class="btn btn-sm btn-outline" href="${tel(s.phone)}" aria-label="Call ${h(s.name)}">${icon('phone')} Call</a>` : ''}
      </div>
      ${s.photo && !(s.photos && s.photos.length) ? `<div class="ask-credit">${h(s.photo.credit)}</div>` : ''}
    </div>`;
  }
  /** Buja businesses and artisans who do what was asked: order, message or call them inside Buja. */
  function providerCard(a) {
    return `<div class="card ask-card ask-biz">
      <a class="row" href="#/artisans/${a.id}" style="gap:12px;align-items:center;color:var(--ink);text-decoration:none">
        ${a.photo ? `<img src="${h(a.photo)}" alt="" style="width:52px;height:52px;border-radius:14px;object-fit:cover;flex-shrink:0">` : `<span style="width:52px;height:52px;border-radius:14px;background:var(--orange-tint);display:flex;align-items:center;justify-content:center;color:var(--orange-dark);flex-shrink:0">${icon('store')}</span>`}
        <span class="grow" style="min-width:0"><span class="row" style="gap:6px"><span style="font-weight:750;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(a.name)}</span>${a.verified ? `<span style="color:var(--green-dark);display:flex">${icon('circle-check')}</span>` : ''}</span>
          <span class="small muted" style="display:block">${h(a.tradeLabel)}${a.km != null ? ' · ' + (a.km < 1 ? 'under 1 km' : a.km + ' km') : ''}${a.rating && a.rating.count ? ' · ' + a.rating.avg + '★' : ''}${a.online ? ' · <span style="color:var(--green-dark);font-weight:650">online now</span>' : ''}</span></span></a>
      <div class="row ask-acts">
        ${a.orderable ? `<a class="btn btn-sm btn-primary" href="#/artisans/${a.id}${a.menuCount ? '?menu=1' : ''}">${icon('bag-shopping')} ${a.menuCount ? 'See menu & order' : 'Order'}</a>` : `<a class="btn btn-sm btn-primary" href="#/artisans/${a.id}">${icon('phone')} Book or call</a>`}
        <button class="btn btn-sm btn-outline" data-msg="${a.id}">${icon('message')} Message</button>
      </div></div>`;
  }

  /* ---------- Chat ---------- */
  route('/ask', { auth: true, tabs: 'Ask' }, async () => `
    <header class="topbar"><a class="iconbtn" href="#/home" aria-label="Home">${icon('arrow-left')}</a><h1 class="row" style="gap:8px">Ask Buja <span class="tag orange">${icon('wand-magic-sparkles')} AI</span></h1><a class="iconbtn" href="#/ask/places" aria-label="Browse places">${icon('magnifying-glass')}</a><a class="iconbtn" href="#/ask/add" aria-label="Add a place">${icon('plus')}</a></header>
    <main id="chat" class="stack" style="padding:6px 16px 0;gap:12px;flex:1">
      <button class="ask-where" id="where">${icon('location-crosshairs')} <span>Finding where you are…</span></button>
      <div class="row" style="gap:10px;align-items:flex-start"><div class="ask-bot">${icon('wand-magic-sparkles')}</div><div class="card" style="padding:12px 14px;font-size:14px;line-height:1.5;border-radius:4px 16px 16px 16px">Ask for anything nearby: food, a church or mosque, a pharmacy, somewhere to relax. I answer only from real places on the map and on Buja, with how far they are, whether they are open by their listed hours, and the way there.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap" id="suggest">${SUGGEST.map((s) => `<button class="chip" data-q="${h(s)}">${h(s)}</button>`).join('')}</div>
    </main>
    <form id="ask" class="row" style="gap:10px;padding:10px 16px calc(10px + var(--safe-b));background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      <label for="qq" style="position:absolute;left:-9999px">Ask Buja</label>
      <input class="input" id="qq" placeholder="Late-night suya, a pharmacy, a quiet park…" autocomplete="off" style="height:46px;border-radius:23px;flex:1">
      <button class="iconbtn" type="submit" aria-label="Ask" style="background:var(--orange);border-color:var(--orange);color:#fff;width:46px;height:46px">${icon('paper-plane')}</button>
    </form>`, {
    mount(el) {
      const chat = el.querySelector('#chat'); const input = el.querySelector('#qq');
      const scroll = () => window.scrollTo(0, document.body.scrollHeight);
      // where you are, found as the screen opens so the first answer is already local
      const whereBtn = el.querySelector('#where');
      const showWhere = (txt, ok) => { whereBtn.querySelector('span').textContent = txt; whereBtn.classList.toggle('ok', !!ok); };
      const locate = async () => { showWhere('Finding where you are…'); const f = await here(); showWhere(f ? 'Searching near you' : (state.user.district ? `Location off · searching around ${state.user.district}. Tap to use your location` : 'Location off · tap to use your location'), !!f); return f; };
      whereBtn.addEventListener('click', () => { fix = null; locate(); });
      locate();
      const bot = `<div class="ask-bot">${icon('wand-magic-sparkles')}</div>`;
      const send = async (q) => {
        q = q.trim(); if (!q) return; input.value = '';
        chat.insertAdjacentHTML('beforeend', `<div style="align-self:flex-end;max-width:280px;padding:12px 14px;background:var(--ink);color:var(--surface);border-radius:16px 16px 4px 16px;font-size:14px;line-height:1.5">${h(q)}</div>`);
        const think = document.createElement('div'); think.className = 'row'; think.style.cssText = 'gap:10px;align-items:flex-start'; think.innerHTML = `${bot}<div class="card small muted" style="padding:10px 14px;border-radius:4px 16px 16px 16px">Looking on the map near you…</div>`;
        chat.appendChild(think); scroll();
        try {
          const r = await api.ask(q, null, await here());
          if (r.where && r.where.source !== 'gps') showWhere(`Searching around ${r.where.label}. Tap to use your location`, false); else if (r.where) showWhere('Searching near you · ' + r.where.label.replace(/^you \(|\)$/g, ''), true);
          think.innerHTML = `${bot}<div class="grow stack" style="gap:10px;min-width:0">
            <div class="card" style="padding:12px 14px;font-size:14px;line-height:1.55;border-radius:4px 16px 16px 16px">${h(r.answer)}</div>
            ${(r.providers || []).length ? `<div class="section" style="margin:4px 0 0">ON BUJA · ORDER OR BOOK IN THE APP</div>${r.providers.map(providerCard).join('')}` : ''}
            ${r.spots.length ? `${(r.providers || []).length ? '<div class="section" style="margin:4px 0 0">PLACES ON THE MAP</div>' : ''}${r.spots.map(spotCard).join('')}` : ''}
            <div class="small muted row" style="gap:6px;align-items:flex-start;line-height:1.45">${icon('circle-info')} <span>Places come from OpenStreetMap, Overture Maps business listings and Buja residents. Hours and "open now" are only shown when the place lists them. See something wrong? Open the place and tell us.</span></div>
            ${r.followups.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${r.followups.map((f) => `<button class="chip" data-q="${h(f)}">${h(f)}</button>`).join('')}</div>` : ''}</div>`;
        } catch (err) { think.querySelector('.card').textContent = (err && err.message) || 'Something went wrong. Try again.'; }
        scroll();
      };
      el.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-q]'); if (c) { send(c.dataset.q); return; }
        const m = e.target.closest('[data-msg]'); if (m) { busy(m, true); try { const r = await api.artisanChat(m.dataset.msg); go('/inbox/' + r.threadId); } catch (err) { busy(m, false); failed(el, err); } }
      });
      el.querySelector('#ask').addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
      const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('q'); if (pre) send(pre);
    }
  });

  /* ---------- Place ---------- */
  route('/ask/place/:id', { auth: true, tabs: 'Ask' }, async ({ id }) => {
    const at = await here();
    const { spot: s, reviews } = await api.spot(id, at);
    return `${topbar(s.name, '/ask')}
    <main class="pad stack" style="gap:14px">
      ${s.photos && s.photos.length ? `<div class="row" id="gal" style="gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">${s.photos.map((p) => `<div style="position:relative;flex-shrink:0"><img src="${p.url}" alt="" loading="lazy" style="width:${s.photos.length === 1 ? '100%' : '176px'};height:132px;object-fit:cover;border-radius:14px;display:block"><button data-delphoto="${p.id}" aria-label="Remove photo" style="position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:13px;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:11px">${icon('xmark')}</button></div>`).join('')}</div>` : ''}
      ${!(s.photos && s.photos.length) && s.photo ? `<figure style="margin:0"><img src="${h(s.photo.url)}" alt="" style="width:100%;height:190px;object-fit:cover;border-radius:16px;display:block" onerror="this.parentNode.remove()"><figcaption class="ask-credit" style="margin-top:4px">${h(s.photo.credit)}</figcaption></figure>` : ''}
      <label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} ${s.photos && s.photos.length ? 'Add another photo' : 'Add a photo you took here'}<input type="file" accept="image/*" id="spotpic" style="display:none"></label>
      <div class="row" style="gap:8px">${s.lat != null ? `<a class="btn btn-primary grow" href="${h(way(s))}">${icon('route')} Find the way${s.away != null ? ` · ${far(s.away).replace(' away', '')}` : ''}</a>` : ''}${s.phone ? `<a class="btn btn-outline" href="${tel(s.phone)}" style="width:auto">${icon('phone')} Call</a>` : ''}</div>
      ${s.thumb ? `<a href="${h(placeHref({ lat: s.lat, lng: s.lng, name: s.name }))}" style="display:block;height:150px;border-radius:16px;overflow:hidden;position:relative;background:#E8EDE4">
        <img src="${s.thumb.url}" alt="" style="position:absolute;left:calc(50% - ${Math.round(s.thumb.fx * 256)}px);top:calc(50% - ${Math.round(s.thumb.fy * 256)}px);width:256px;height:256px;max-width:none">
        <span style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:8px;background:var(--orange);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>
        <span style="position:absolute;right:10px;bottom:10px;background:rgba(255,255,255,.9);border-radius:8px;padding:4px 8px;font-size:11px;font-weight:600;color:var(--ink)">See it on the map</span></a>` : ''}
      <div class="small muted row" style="gap:6px;flex-wrap:wrap">${icon(catIcon[s.category] || 'location-dot')} ${h(s.kind || s.categoryLabel)} · ${h(s.district)}${s.area ? ' · ' + h(s.area) : ''} · ${s.priceLabel ? s.priceLabel : ''}${s.priceNote ? ' · ' + h(s.priceNote) : ''}${s.verified ? ` · <span class="tag green">${icon('circle-check')} Verified</span>` : s.source === 'osm' ? ' · from OpenStreetMap' : s.source === 'overture' ? ' · from Overture Maps' : ' · added by a resident'}</div>
      <div class="card row" style="padding:14px 16px;gap:14px"><div><div style="font-size:30px;font-weight:700">${s.rating ?? '–'}</div><div class="small muted">${s.ratings} rating${s.ratings === 1 ? '' : 's'}</div></div><div class="grow">${stars(s.rating)}<div class="small muted" style="margin-top:4px">${s.hours ? icon('clock') + ' ' + h(s.hours) : 'Hours not listed'}</div>${openTag(s.open) ? `<div style="margin-top:6px">${openTag(s.open)}</div>` : ''}</div></div>
      ${s.website ? `<a class="small" href="${h(s.website)}" target="_blank" rel="noopener" style="color:var(--orange-dark);font-weight:650">${icon('arrow-up-right-from-square')} ${h(s.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : ''}
      <p style="margin:0;font-size:14px;line-height:1.55;color:var(--ink-2)">${h(s.description)}</p>
      ${s.tags.length ? `<div class="row" style="flex-wrap:wrap;gap:6px">${s.tags.map((t) => `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(t)}</span>`).join('')}</div>` : ''}
      <a class="btn btn-outline" href="#/waka?toq=${encodeURIComponent(s.wakaTo)}">${icon('bus')} Go by bus or taxi (Waka)</a>
      <form id="rate" class="card stack" style="padding:16px;gap:12px"><div class="h-sm">${s.myRating ? 'Your rating' : 'Been here? Rate it'}</div>
        <div class="row" style="gap:6px" id="starpick">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} stars" style="font-size:30px;background:none;border:none;color:${n <= (s.myRating || 0) ? 'var(--orange)' : 'var(--line)'};line-height:1">★</button>`).join('')}</div>
        <div class="field"><label for="comment">A line for others (optional)</label><input class="input" id="comment" maxlength="300" placeholder="Go early, the good stuff finishes by 2pm"></div>
        <div class="error" data-error="stars"></div>
        <button class="btn btn-primary" type="submit">Save rating</button></form>
      ${reviews.length ? `<div class="stack" style="gap:10px"><div class="section">WHAT PEOPLE SAY</div><div class="card list">${reviews.map((r) => `<div class="item"><div class="grow"><div class="t" style="font-size:14px">${stars(r.stars)} <span class="small muted">${h(r.name)} · ${r.at}</span></div>${r.comment ? `<div class="s" style="color:var(--ink-2);margin-top:2px">${h(r.comment)}</div>` : ''}</div></div>`).join('')}</div></div>` : ''}
    </main>`;
  }, {
    mount(el, { id }) {
      el.querySelector('#spotpic')?.addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return; toast('Uploading…');
        try {
          const bmp = await createImageBitmap(f).catch(() => null);
          let file = f;
          if (bmp) { const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)); const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85)); file = new File([blob], 'place.jpg', { type: 'image/jpeg' }); }
          const up = await api.upload(file, 'image');
          await api.addSpotPhoto(id, up.upload.id);
          toast('Photo added. Thank you.'); location.reload();
        } catch (err) { failed(el, err); }
      });
      el.querySelectorAll('[data-delphoto]').forEach((b) => b.addEventListener('click', async (e) => { e.preventDefault(); if (!confirm('Remove this photo?')) return; try { await api.removeSpotPhoto(b.dataset.delphoto); location.reload(); } catch (err) { failed(el, err); } }));
      let n = 0; const btns = el.querySelectorAll('#starpick button');
      btns.forEach((b) => { if (b.style.color.includes('orange')) n = +b.dataset.n; b.addEventListener('click', () => { n = +b.dataset.n; btns.forEach((x) => { x.style.color = +x.dataset.n <= n ? 'var(--orange)' : 'var(--line)'; }); }); });
      el.querySelector('#rate').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); if (!n) { showErrors(el, { stars: 'Pick 1 to 5 stars.' }); return; } busy(btn, true); try { await api.rateSpot(id, n, el.querySelector('#comment').value); toast('Thanks, rating saved'); location.reload(); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });

  /* ---------- Browse: every place in Abuja by kind, nearest first ---------- */
  route('/ask/places', { auth: true, tabs: 'Ask' }, async () => {
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    const qq = p.get('q') || '', cat = p.get('c') || '';
    const at = await here();
    const d = await api.spots(qq, { category: cat, lat: at ? at.lat.toFixed(5) : '', lng: at ? at.lng.toFixed(5) : '' });
    const b = d.browse || {};
    return `${topbar('Places in Abuja', '/ask', `<a class="iconbtn" href="#/ask/add" aria-label="Add a place">${icon('plus')}</a>`)}
    <form id="s" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px">${icon('magnifying-glass')}<label for="sq" style="position:absolute;left:-9999px">Search places</label><input id="sq" name="q" type="search" placeholder="Name, district or what it serves" value="${h(qq)}" style="flex:1;border:none;background:transparent;outline:none;font-size:14px;color:var(--ink)"></div></form>
    <div class="ask-cats">${Object.entries(b).map(([k, v]) => `<a class="ask-cat${cat === k ? ' on' : ''}" href="#/ask/places?c=${cat === k ? '' : k}">${icon(v.icon)}<span>${h(v.label)}</span></a>`).join('')}</div>
    <main class="pad stack" style="gap:10px;padding-top:6px"><div class="small muted">${d.spots.length ? `${d.spots.length === 1 ? '1 result' : d.spots.length + ' ' + (cat && b[cat] ? h(b[cat].label.toLowerCase()) : 'places')}${at && !qq ? ', nearest first' : ''}` : ''}${d.total ? ` · ${d.total.toLocaleString('en-NG')} places on Buja in all` : ''}</div>${d.spots.map(spotCard).join('') || `<div class="placeholder" style="padding:40px 0"><div class="h-md">Nothing found${at ? ' near you' : ''}</div><div class="small muted" style="max-width:280px;line-height:1.5">Buja adds places from the map every few hours. If you know one, add it.</div><a class="btn btn-ink" href="#/ask/add" style="width:auto">Add a place</a></div>`}</main>`;
  }, { mount(el) { el.querySelector('#s').addEventListener('submit', (e) => { e.preventDefault(); go('/ask/places?q=' + encodeURIComponent(e.target.q.value)); }); } });

  route('/ask/add', { auth: true, tabs: 'Ask' }, async () => {
    const { categories } = await api.spots('', { category: 'none' });
    return `${topbar('Add a place', '/ask')}
    <form id="af" class="pad stack" style="gap:14px">
      <div class="muted small" style="line-height:1.5">Places you add show up in Ask answers straight away, marked community added until the Buja team verifies them.</div>
      ${field({ id: 'name', label: 'Name', placeholder: 'Iya Basira Amala Spot' })}
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="category">Category</label><select class="input" id="category"><option value="">Choose</option>${Object.entries(categories).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><div class="error" data-error="category"></div></div><div class="field" style="flex:1"><label for="district">District</label><select class="input" id="district"><option value="">Choose</option>${DISTRICTS.map((d) => `<option ${state.user.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="error" data-error="district"></div></div></div>
      ${field({ id: 'area', label: 'Area or landmark (optional)', placeholder: 'Zone 4, behind the mosque' })}
      <label class="card row" style="padding:12px 14px;gap:12px;align-items:center;cursor:pointer"><input type="checkbox" id="pinme" style="width:20px;height:20px"><span class="grow"><span style="display:block;font-weight:650;font-size:14px">I am there now: pin it where I am standing</span><span class="small muted" id="pinnote">So people can find the way. Leave it off if you are not at the place.</span></span></label>
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="priceLevel">Price level</label><select class="input" id="priceLevel">${[[1, 'Budget'], [2, 'Moderate'], [3, 'Pricey'], [4, 'Premium']].map(([k, v]) => `<option value="${k}" ${k === 2 ? 'selected' : ''}>${v}</option>`).join('')}</select></div>${field({ id: 'priceNote', label: 'Typical spend (optional)', placeholder: '₦1,000 – ₦2,000' })}</div>
      ${field({ id: 'hours', label: 'Hours (optional)', placeholder: '11:00 – 20:00' })}
      ${field({ id: 'tags', label: 'Tags, comma separated', placeholder: 'amala, ewedu, cheap, lunch' })}
      <div class="field"><label for="description">What it is known for</label><textarea class="input" id="description" maxlength="400" placeholder="One or two lines" style="height:80px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="description"></div></div>
      <button class="btn btn-primary" type="submit">Add to Buja</button></form>`;
  }, { mount(el) { clearOnInput(el); el.querySelector('#af').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); const v = (s) => el.querySelector(s).value; try { let pos = null; if (el.querySelector('#pinme').checked) { fix = null; pos = await here(); if (!pos) { busy(btn, false); el.querySelector('#pinnote').textContent = 'Could not get your location. Allow location for Buja, or untick this.'; return; } }
          const r = await api.addSpot({ name: v('#name'), category: v('#category'), district: v('#district'), area: v('#area'), priceLevel: +v('#priceLevel'), priceNote: v('#priceNote'), hours: v('#hours'), tags: v('#tags').split(',').map((t) => t.trim()).filter(Boolean), description: v('#description'), ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }); toast('Added. Thank you.'); go('/ask/place/' + r.spot.id); } catch (err) { busy(btn, false); failed(el, err); } }); } });
}
