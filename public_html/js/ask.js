// Buja Ask: the AI guide, grounded on Buja's places. Registered into the app router by app.js.
export function registerAsk({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon , placeHref } = ui;
  const stars = (n) => `<span style="color:var(--orange)">${'★'.repeat(Math.round(n || 0))}</span><span style="color:var(--line)">${'★'.repeat(5 - Math.round(n || 0))}</span>`;
  const catIcon = { food: 'bus', lounge: 'wine-glass', relax: 'route', nightlife: 'bolt', shopping: 'tags', kids: 'users', worship: 'circle-check', services: 'gear', hotel: 'house-chimney', culture: 'camera' };
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
  const far = (km) => km == null ? '' : km < 1 ? Math.round(km * 1000) + ' m away' : km + ' km away';

  const SUGGEST = ['Good restaurant near me', 'Serene place to relax', 'Serene place to relax', 'Cheapest lounge in Jabi', 'Somewhere fancy for a date', 'Where can kids play on Sunday', 'Late-night suya'];

  /** A real map tile, shifted so the place sits in the middle, with a pin over it. */
  function thumbHtml(s, size = 56) {
    if (s.photos && s.photos.length) return `<div style="width:${size}px;height:${size}px;border-radius:12px;flex-shrink:0;overflow:hidden;background:var(--surface)"><img src="${s.photos[0].url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
    if (!s.thumb) return `<div style="width:${size}px;height:${size}px;border-radius:12px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(catIcon[s.category] || 'location-dot')}</div>`;
    const x = Math.round(size / 2 - s.thumb.fx * 256), y = Math.round(size / 2 - s.thumb.fy * 256);
    return `<div style="width:${size}px;height:${size}px;border-radius:12px;flex-shrink:0;position:relative;overflow:hidden;background:#E8EDE4">
      <img src="${s.thumb.url}" alt="" loading="lazy" style="position:absolute;left:${x}px;top:${y}px;width:256px;height:256px;max-width:none">
      <span style="position:absolute;left:50%;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:6px;background:var(--orange);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>
    </div>`;
  }

  function spotCard(s) {
    return `<a class="card row" href="#/ask/place/${s.id}" style="padding:12px;gap:12px;align-items:flex-start">
      ${thumbHtml(s)}
      <div class="grow" style="min-width:0">
        <div class="row" style="justify-content:space-between;gap:8px"><span style="font-size:14px;font-weight:700">${h(s.name)}</span>${s.rating ? `<span class="small" style="font-weight:700;white-space:nowrap">${icon('star')} ${s.rating}</span>` : `<span class="small muted" style="white-space:nowrap">no ratings</span>`}</div>
        <div class="small muted" style="margin-top:2px">${s.away != null ? `<strong style="color:var(--ink)">${far(s.away)}</strong> · ` : ''}${h(s.district)}${s.area ? ' · ' + h(s.area) : ''} · ${s.priceLabel}${s.source === 'osm' ? ' · from the map' : ''}</div>
        ${s.why ? `<div class="small" style="margin-top:4px;color:var(--ink-2)">${h(s.why)}</div>` : ''}
        <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${s.hours ? `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${icon('clock')} ${h(s.hours)}</span>` : ''}<span class="tag" style="background:var(--night);color:#fff" data-waka="${h(s.wakaTo)}">${icon('route')} Waka there</span></div>
      </div></a>`;
  }

  /* ---------- Chat ---------- */
  route('/ask', { auth: true, tabs: 'Ask' }, async () => `
    <header class="topbar"><a class="iconbtn" href="#/home" aria-label="Home">${icon('arrow-left')}</a><h1 class="row" style="gap:8px">Ask Buja <span class="tag orange">${icon('wand-magic-sparkles')} AI</span></h1><a class="iconbtn" href="#/ask/places" aria-label="Browse places">${icon('magnifying-glass')}</a><a class="iconbtn" href="#/ask/add" aria-label="Add a place">${icon('plus')}</a></header>
    <main id="chat" class="stack" style="padding:6px 16px 0;gap:12px;flex:1">
      <div class="row" style="gap:10px;align-items:flex-start"><div style="width:30px;height:30px;border-radius:9px;background:var(--night);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7ED957">${icon('wand-magic-sparkles')}</div><div class="card" style="padding:12px 14px;font-size:14px;line-height:1.5;border-radius:4px 16px 16px 16px">Ask me where to eat, relax, shop or take the kids in Abuja. I only suggest places residents have added to Buja, so if I don't know one, add it and I will from then on.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap" id="suggest">${SUGGEST.map((s) => `<button class="chip" data-q="${h(s)}">${h(s)}</button>`).join('')}</div>
    </main>
    <form id="ask" class="row" style="gap:10px;padding:10px 16px calc(10px + var(--safe-b));background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      <label for="qq" style="position:absolute;left:-9999px">Ask Buja</label>
      <input class="input" id="qq" placeholder="Ask about anywhere in Abuja" autocomplete="off" style="height:46px;border-radius:23px;flex:1">
      <button class="iconbtn" type="submit" aria-label="Ask" style="background:var(--orange);border-color:var(--orange);color:#fff;width:46px;height:46px">${icon('paper-plane')}</button>
    </form>`, {
    mount(el) {
      const chat = el.querySelector('#chat'); const input = el.querySelector('#qq');
      const scroll = () => window.scrollTo(0, document.body.scrollHeight);
      const send = async (q) => {
        q = q.trim(); if (!q) return; input.value = '';
        chat.insertAdjacentHTML('beforeend', `<div style="align-self:flex-end;max-width:280px;padding:12px 14px;background:var(--ink);color:var(--surface);border-radius:16px 16px 4px 16px;font-size:14px;line-height:1.5">${h(q)}</div>`);
        const think = document.createElement('div'); think.className = 'row'; think.style.cssText = 'gap:10px;align-items:flex-start'; think.innerHTML = `<div style="width:30px;height:30px;border-radius:9px;background:var(--night);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7ED957">${icon('wand-magic-sparkles')}</div><div class="card small muted" style="padding:10px 14px;border-radius:4px 16px 16px 16px">Finding places near you…</div>`;
        chat.appendChild(think); scroll();
        try {
          const r = await api.ask(q, null, await here());
          think.innerHTML = `<div style="width:30px;height:30px;border-radius:9px;background:var(--night);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7ED957">${icon('wand-magic-sparkles')}</div><div class="grow stack" style="gap:10px"><div class="card" style="padding:12px 14px;font-size:14px;line-height:1.5;border-radius:4px 16px 16px 16px">${h(r.answer)}</div>${r.spots.map(spotCard).join('')}${r.mode === 'rules' ? `<div class="small muted row" style="gap:6px">${icon('circle-info')} Answered by keyword match, not AI.</div>` : `<div class="small muted row" style="gap:6px">${icon('circle-info')} Only places on Buja are ever suggested. Tell us if one is wrong.</div>`}${r.followups.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${r.followups.map((f) => `<button class="chip" data-q="${h(f)}">${h(f)}</button>`).join('')}</div>` : ''}</div>`;
          bindWaka(think);
        } catch (err) { think.querySelector('.card').textContent = (err && err.message) || 'Something went wrong. Try again.'; }
        scroll();
      };
      const bindWaka = (root) => root.querySelectorAll('[data-waka]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); go('/waka?toq=' + encodeURIComponent(b.dataset.waka)); }));
      el.addEventListener('click', (e) => { const c = e.target.closest('[data-q]'); if (c) send(c.dataset.q); });
      el.querySelector('#ask').addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
      const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('q'); if (pre) send(pre);
    }
  });

  /* ---------- Place ---------- */
  route('/ask/place/:id', { auth: true, tabs: 'Ask' }, async ({ id }) => {
    const { spot: s, reviews } = await api.spot(id);
    return `${topbar(s.name, '/ask')}
    <main class="pad stack" style="gap:14px">
      ${s.photos && s.photos.length ? `<div class="row" id="gal" style="gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">${s.photos.map((p) => `<div style="position:relative;flex-shrink:0"><img src="${p.url}" alt="" loading="lazy" style="width:${s.photos.length === 1 ? '100%' : '176px'};height:132px;object-fit:cover;border-radius:14px;display:block"><button data-delphoto="${p.id}" aria-label="Remove photo" style="position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:13px;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:11px">${icon('xmark')}</button></div>`).join('')}</div>` : ''}
      <label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} ${s.photos && s.photos.length ? 'Add another photo' : 'Add the first photo'}<input type="file" accept="image/*" id="spotpic" style="display:none"></label>
      ${s.thumb ? `<a href="${h(placeHref({ lat: s.lat, lng: s.lng, name: s.name }))}" style="display:block;height:150px;border-radius:16px;overflow:hidden;position:relative;background:#E8EDE4">
        <img src="${s.thumb.url}" alt="" style="position:absolute;left:calc(50% - ${Math.round(s.thumb.fx * 256)}px);top:calc(50% - ${Math.round(s.thumb.fy * 256)}px);width:256px;height:256px;max-width:none">
        <span style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:8px;background:var(--orange);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>
        <span style="position:absolute;right:10px;bottom:10px;background:rgba(255,255,255,.9);border-radius:8px;padding:4px 8px;font-size:11px;font-weight:600;color:var(--ink)">Open in maps</span></a>` : ''}
      <div class="small muted row" style="gap:6px;flex-wrap:wrap">${icon(catIcon[s.category] || 'location-dot')} ${s.categoryLabel} · ${h(s.district)}${s.area ? ' · ' + h(s.area) : ''} · ${s.priceLabel}${s.priceNote ? ' · ' + h(s.priceNote) : ''}${s.verified ? ` · <span class="tag green">${icon('circle-check')} Verified</span>` : ' · community added'}</div>
      <div class="card row" style="padding:14px 16px;gap:14px"><div><div style="font-size:30px;font-weight:700">${s.rating ?? '–'}</div><div class="small muted">${s.ratings} rating${s.ratings === 1 ? '' : 's'}</div></div><div class="grow">${stars(s.rating)}<div class="small muted" style="margin-top:4px">${s.hours ? icon('clock') + ' ' + h(s.hours) : 'Hours not listed'}</div></div></div>
      <p style="margin:0;font-size:14px;line-height:1.55;color:var(--ink-2)">${h(s.description)}</p>
      ${s.tags.length ? `<div class="row" style="flex-wrap:wrap;gap:6px">${s.tags.map((t) => `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(t)}</span>`).join('')}</div>` : ''}
      <a class="btn btn-ink" href="#/waka?toq=${encodeURIComponent(s.wakaTo)}">${icon('route')} Waka there</a>
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

  /* ---------- Browse + add ---------- */
  route('/ask/places', { auth: true, tabs: 'Ask' }, async () => {
    const qq = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
    const { spots, categories } = await api.spots(qq);
    return `${topbar('Places on Buja', '/ask', `<a class="iconbtn" href="#/ask/add" aria-label="Add a place">${icon('plus')}</a>`)}
    <form id="s" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px">${icon('magnifying-glass')}<label for="sq" style="position:absolute;left:-9999px">Search places</label><input id="sq" name="q" type="search" placeholder="Name, district or tag" value="${h(qq)}" style="flex:1;border:none;background:transparent;outline:none;font-size:14px;color:var(--ink)"></div></form>
    <main class="pad stack" style="gap:10px;padding-top:12px"><div class="small muted">${spots.length} place${spots.length === 1 ? '' : 's'}</div>${spots.map(spotCard).join('') || `<div class="placeholder" style="padding:40px 0"><div class="h-md">Nothing found</div><a class="btn btn-ink" href="#/ask/add" style="width:auto">Add it</a></div>`}</main>`;
  }, { mount(el) { el.querySelector('#s').addEventListener('submit', (e) => { e.preventDefault(); go('/ask/places?q=' + encodeURIComponent(e.target.q.value)); }); el.querySelectorAll('[data-waka]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); go('/waka?toq=' + encodeURIComponent(b.dataset.waka)); })); } });

  route('/ask/add', { auth: true, tabs: 'Ask' }, async () => {
    const { categories } = await api.spots('');
    return `${topbar('Add a place', '/ask')}
    <form id="af" class="pad stack" style="gap:14px">
      <div class="muted small" style="line-height:1.5">Places you add show up in Ask answers straight away, marked community added until the Buja team verifies them.</div>
      ${field({ id: 'name', label: 'Name', placeholder: 'Iya Basira Amala Spot' })}
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="category">Category</label><select class="input" id="category"><option value="">Choose</option>${Object.entries(categories).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><div class="error" data-error="category"></div></div><div class="field" style="flex:1"><label for="district">District</label><select class="input" id="district"><option value="">Choose</option>${DISTRICTS.map((d) => `<option ${state.user.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="error" data-error="district"></div></div></div>
      ${field({ id: 'area', label: 'Area or landmark (optional)', placeholder: 'Zone 4, behind the mosque' })}
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="priceLevel">Price level</label><select class="input" id="priceLevel">${[[1, 'Budget'], [2, 'Moderate'], [3, 'Pricey'], [4, 'Premium']].map(([k, v]) => `<option value="${k}" ${k === 2 ? 'selected' : ''}>${v}</option>`).join('')}</select></div>${field({ id: 'priceNote', label: 'Typical spend (optional)', placeholder: '₦1,000 – ₦2,000' })}</div>
      ${field({ id: 'hours', label: 'Hours (optional)', placeholder: '11:00 – 20:00' })}
      ${field({ id: 'tags', label: 'Tags, comma separated', placeholder: 'amala, ewedu, cheap, lunch' })}
      <div class="field"><label for="description">What it is known for</label><textarea class="input" id="description" maxlength="400" placeholder="One or two lines" style="height:80px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="description"></div></div>
      <button class="btn btn-primary" type="submit">Add to Buja</button></form>`;
  }, { mount(el) { clearOnInput(el); el.querySelector('#af').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); const v = (s) => el.querySelector(s).value; try { const r = await api.addSpot({ name: v('#name'), category: v('#category'), district: v('#district'), area: v('#area'), priceLevel: +v('#priceLevel'), priceNote: v('#priceNote'), hours: v('#hours'), tags: v('#tags').split(',').map((t) => t.trim()).filter(Boolean), description: v('#description') }); toast('Added. Thank you.'); go('/ask/place/' + r.spot.id); } catch (err) { busy(btn, false); failed(el, err); } }); } });
}
