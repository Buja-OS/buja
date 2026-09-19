// Buja Ask: the AI guide, grounded on Buja's places. Registered into the app router by app.js.
export function registerAsk({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon } = ui;
  const stars = (n) => `<span style="color:var(--orange)">${'★'.repeat(Math.round(n || 0))}</span><span style="color:var(--line)">${'★'.repeat(5 - Math.round(n || 0))}</span>`;
  const catIcon = { food: 'bus', lounge: 'wine-glass', relax: 'route', nightlife: 'bolt', shopping: 'tags', kids: 'users', worship: 'circle-check', services: 'gear', hotel: 'house-chimney', culture: 'camera' };
  const SUGGEST = ['Best amala near me', 'Serene place to relax', 'Cheapest lounge in Jabi', 'Somewhere fancy for a date', 'Where can kids play on Sunday', 'Late-night suya'];

  function spotCard(s) {
    return `<a class="card row" href="#/ask/place/${s.id}" style="padding:12px;gap:12px;align-items:flex-start">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(catIcon[s.category] || 'location-dot')}</div>
      <div class="grow" style="min-width:0">
        <div class="row" style="justify-content:space-between;gap:8px"><span style="font-size:14px;font-weight:700">${h(s.name)}</span>${s.rating ? `<span class="small" style="font-weight:700;white-space:nowrap">${icon('star')} ${s.rating}</span>` : `<span class="small muted" style="white-space:nowrap">no ratings</span>`}</div>
        <div class="small muted" style="margin-top:2px">${h(s.district)}${s.area ? ' · ' + h(s.area) : ''} · ${s.priceLabel}${s.priceNote ? ' · ' + h(s.priceNote) : ''}</div>
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
        const think = document.createElement('div'); think.className = 'row'; think.style.cssText = 'gap:10px;align-items:flex-start'; think.innerHTML = `<div style="width:30px;height:30px;border-radius:9px;background:var(--night);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7ED957">${icon('wand-magic-sparkles')}</div><div class="card small muted" style="padding:10px 14px;border-radius:4px 16px 16px 16px">Looking through Buja's places…</div>`;
        chat.appendChild(think); scroll();
        try {
          const r = await api.ask(q);
          think.innerHTML = `<div style="width:30px;height:30px;border-radius:9px;background:var(--night);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7ED957">${icon('wand-magic-sparkles')}</div><div class="grow stack" style="gap:10px"><div class="card" style="padding:12px 14px;font-size:14px;line-height:1.5;border-radius:4px 16px 16px 16px">${h(r.answer)}</div>${r.spots.map(spotCard).join('')}${r.mode === 'rules' ? `<div class="small muted row" style="gap:6px">${icon('circle-info')} Keyword match. Add an AI key to get natural answers.</div>` : `<div class="small muted row" style="gap:6px">${icon('circle-info')} Ranked from places and ratings on Buja. Tell us if one is wrong.</div>`}${r.followups.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${r.followups.map((f) => `<button class="chip" data-q="${h(f)}">${h(f)}</button>`).join('')}</div>` : ''}</div>`;
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
