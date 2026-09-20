// Buja Homes: search, property detail, landlord dashboard. Registered into the app router by app.js.
export function registerHomes({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon } = ui;
  const naira = (n) => n == null ? '' : '₦' + Number(n).toLocaleString('en-NG');
  const short = (n) => n >= 1e6 ? '₦' + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'm' : n >= 1e3 ? '₦' + Math.round(n / 1e3) + 'k' : naira(n);
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const ph = (url) => url ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">` : `<div style="width:100%;height:100%;background:linear-gradient(180deg,#4E6E58,#2B3A31);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:12px;font-weight:600;letter-spacing:1px">NO PHOTO</div>`;
  const colors = ['#1F4E9C', '#2E7D1E', '#8E44AD', '#0E7C86', '#E8620E'];
  const color = (s) => colors[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  const isLandlord = () => state.user.kind === 'landlord';

  async function compress(file) {
    const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file;
    const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82)); return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  }

  function card(p) {
    return `<a class="card" href="#/homes/${p.id}" style="overflow:hidden;display:flex;flex-direction:column">
      <div style="position:relative;height:170px">${ph(p.photos[0]?.url)}
        <div style="position:absolute;top:10px;left:10px;display:flex;gap:6px">${p.direct ? `<span class="tag" style="background:var(--green);color:#101014">${icon('circle-check')} Direct from landlord</span>` : `<span class="tag" style="background:rgba(255,255,255,.92);color:var(--ink-2)">${icon('building')} Real estate company</span>`}</div>
        <button class="iconbtn" data-save="${p.id}" aria-label="${p.saved ? 'Unsave' : 'Save'}" style="position:absolute;top:8px;right:8px;width:36px;height:36px;background:rgba(255,255,255,.92);border:none;color:${p.saved ? 'var(--orange)' : 'var(--ink)'}">${icon(p.saved ? 'heart' : 'regular/heart')}</button>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:5px">
        <div class="row" style="justify-content:space-between;align-items:baseline"><span style="font-size:17px;font-weight:700">${naira(p.price)}${p.period ? `<span class="small muted" style="font-weight:500"> / year</span>` : ''}</span>${p.landlord?.verified ? `<span class="small" style="font-weight:700;color:var(--green-dark)">${icon('circle-check')} Verified</span>` : ''}</div>
        <div style="font-size:14px;font-weight:600">${h(p.title)}</div>
        <div class="small muted row" style="gap:12px"><span>${icon('location-dot')} ${h(p.district)}</span>${p.beds ? `<span>${p.beds} bed</span>` : ''}${p.baths ? `<span>${p.baths} bath</span>` : ''}${p.minutesToCentre ? `<span>${p.minutesToCentre} min to Central</span>` : ''}</div>
      </div></a>`;
  }
  function bindSaves(el) {
    el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); const on = b.getAttribute('aria-label') === 'Unsave'; try { on ? await api.homesUnsave(b.dataset.save) : await api.homesSave(b.dataset.save); b.setAttribute('aria-label', on ? 'Save' : 'Unsave'); b.style.color = on ? 'var(--ink)' : 'var(--orange)'; b.innerHTML = icon(on ? 'regular/heart' : 'heart'); toast(on ? 'Removed' : 'Saved'); } catch (err) { failed(el, err); } }));
  }

  /* ---------- Search ---------- */
  route('/homes', { auth: true, tabs: '' }, async () => {
    if (isLandlord()) { go('/homes/landlord'); return ''; }
    const f = Object.fromEntries(q().entries()); f.kind = f.kind || 'rent';
    const r = await api.homes(f);
    const active = ['type', 'district', 'priceMax', 'beds', 'facilities', 'near'].filter((k) => f[k]).length;
    return `
    ${topbar('Homes', '/home', `<a class="iconbtn" href="#/homes/saved" aria-label="Saved homes">${icon('regular/heart')}</a>`)}
    <div class="pad row" style="gap:8px">
      <div class="seg" style="flex:1"><a href="#/homes?${new URLSearchParams({ ...f, kind: 'rent' })}" class="${f.kind === 'rent' ? 'on' : ''}" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Rent</a><a href="#/homes?${new URLSearchParams({ ...f, kind: 'sale' })}" class="${f.kind === 'sale' ? 'on' : ''}" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Buy</a></div>
      <button class="btn btn-sm btn-outline" id="filters" style="height:48px">${icon('sliders')} Filters${active ? ` <span class="tag orange">${active}</span>` : ''}</button>
    </div>
    <main class="pad stack" style="gap:12px;padding-top:12px">
      <div class="row small muted" style="justify-content:space-between"><span>${r.total} home${r.total === 1 ? '' : 's'} · <strong style="color:var(--green-dark)">${r.direct} direct from landlords</strong></span><span>${f.near ? 'Closest to Central first' : 'Newest first'}</span></div>
      ${r.properties.length ? r.properties.map(card).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('house-chimney')}</div><div class="h-md">Nothing matches yet</div><div class="small muted" style="max-width:280px;line-height:1.5">Loosen a filter, or check back. Landlords list here directly, so new homes appear the moment they post.</div></div>`}
    </main>
    <div id="sheet"></div>`;
  }, {
    mount(el) {
      bindSaves(el);
      const f = Object.fromEntries(q().entries()); f.kind = f.kind || 'rent';
      el.querySelector('#filters')?.addEventListener('click', async () => {
        const { facilities, types } = await api.homes({ kind: f.kind });
        const sel = (f.district || '').split(',').filter(Boolean), fac = (f.facilities || '').split(',').filter(Boolean);
        el.querySelector('#sheet').innerHTML = `<div style="position:fixed;inset:0;background:var(--surface);z-index:30;display:flex;flex-direction:column;max-width:480px;margin:0 auto;overflow-y:auto">
          <header class="topbar"><button class="iconbtn" id="fclose" aria-label="Close">${icon('xmark')}</button><h1>Filters</h1><a href="#/homes?kind=${f.kind}" class="small" style="font-weight:600;color:var(--orange-dark)">Clear</a></header>
          <form id="ff" class="pad stack" style="gap:16px;padding-bottom:28px">
            <div class="field"><label for="type">Type</label><select class="input" id="type"><option value="">Any</option>${Object.entries(types).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="priceMax">Max price (₦${f.kind === 'rent' ? '/year' : ''})</label><input class="input" id="priceMax" inputmode="numeric" placeholder="${f.kind === 'rent' ? '2,500,000' : '80,000,000'}" value="${f.priceMax || ''}"></div><div class="field" style="flex:1"><label for="beds">Bedrooms, at least</label><select class="input" id="beds"><option value="">Any</option>${[1, 2, 3, 4, 5].map((n) => `<option ${f.beds == n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
            <div class="field"><label>Districts</label><div class="row" style="flex-wrap:wrap;gap:8px" id="dl">${DISTRICTS.map((d) => `<button type="button" class="chip ${sel.includes(d) ? 'on' : ''}" data-d="${d}">${d}</button>`).join('')}</div></div>
            <div class="field"><label>Must have</label><div class="row" style="flex-wrap:wrap;gap:8px" id="fl">${facilities.map((x) => `<button type="button" class="chip ${fac.includes(x) ? 'on' : ''}" data-f="${h(x)}">${h(x)}</button>`).join('')}</div></div>
            <label class="check" style="align-items:center"><input type="checkbox" id="near" ${f.near ? 'checked' : ''}>Sort by proximity to Central Area</label>
            <button class="btn btn-primary" type="submit">Show homes</button>
          </form></div>`;
        const sh = el.querySelector('#sheet');
        sh.querySelector('#fclose').addEventListener('click', () => { sh.innerHTML = ''; });
        sh.querySelectorAll('#dl .chip, #fl .chip').forEach((c) => c.addEventListener('click', () => c.classList.toggle('on')));
        sh.querySelector('#ff').addEventListener('submit', (e) => { e.preventDefault(); const p = new URLSearchParams({ kind: f.kind }); const t = sh.querySelector('#type').value; if (t) p.set('type', t); const pm = sh.querySelector('#priceMax').value.replace(/\D+/g, ''); if (pm) p.set('priceMax', pm); const bd = sh.querySelector('#beds').value; if (bd) p.set('beds', bd); const ds = [...sh.querySelectorAll('#dl .chip.on')].map((c) => c.dataset.d); if (ds.length) p.set('district', ds.join(',')); const fs = [...sh.querySelectorAll('#fl .chip.on')].map((c) => c.dataset.f); if (fs.length) p.set('facilities', fs.join(',')); if (sh.querySelector('#near').checked) p.set('near', '1'); go('/homes?' + p); });
      });
    }
  });

  /* ---------- Saved ---------- */
  route('/homes/saved', { auth: true, tabs: '' }, async () => { const { properties } = await api.homesSaved(); return `${topbar('Saved homes', '/homes')}<main class="pad stack" style="gap:12px">${properties.length ? properties.map(card).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('regular/heart')}</div><div class="h-md">Nothing saved yet</div><div class="small muted">Tap the heart on a home to keep it here.</div></div>`}</main>`; }, { mount: bindSaves });

  /* ---------- Property ---------- */
  route('/homes/:id', { auth: true, tabs: '' }, async ({ id }) => {
    if (!/^\d+$/.test(id)) return null;
    const { property: p } = await api.home(id);
    const facts = [[p.beds, 'Beds'], [p.baths, 'Baths'], [p.typeLabel, 'Type'], [p.upfront ? p.upfront + ' yr' : (p.kind === 'sale' ? 'Sale' : '1 yr'), p.kind === 'sale' ? 'Kind' : 'Upfront']];
    return `
    <div style="position:relative;height:300px;background:#2B3A31" id="gallery">${p.photos.map((x, i) => `<div data-slide="${i}" style="position:absolute;inset:0;${i ? 'display:none' : ''}">${ph(x.url)}</div>`).join('') || ph(null)}
      <a class="iconbtn" href="#${p.mine ? '/homes/landlord' : '/homes'}" aria-label="Back" style="position:absolute;top:14px;left:16px;background:rgba(0,0,0,.4);border:none;color:#fff">${icon('arrow-left')}</a>
      ${p.mine ? `<a class="iconbtn" href="#/homes/landlord/edit/${p.id}" aria-label="Edit" style="position:absolute;top:14px;right:16px;background:rgba(0,0,0,.4);border:none;color:#fff">${icon('sliders')}</a>` : `<button class="iconbtn" data-save="${p.id}" aria-label="${p.saved ? 'Unsave' : 'Save'}" style="position:absolute;top:14px;right:16px;background:rgba(0,0,0,.4);border:none;color:${p.saved ? 'var(--orange)' : '#fff'}">${icon(p.saved ? 'heart' : 'regular/heart')}</button>`}
      ${p.photos.length > 1 ? `<div style="position:absolute;bottom:12px;left:16px;right:16px;display:flex;gap:4px">${p.photos.map((x, i) => `<span data-dot="${i}" style="flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,${i ? .4 : 1})"></span>`).join('')}</div>` : ''}
      <div style="position:absolute;bottom:28px;left:16px">${p.direct ? `<span class="tag" style="background:var(--green);color:#101014">${icon('circle-check')} Direct from landlord · no agent fee</span>` : `<span class="tag" style="background:rgba(255,255,255,.92);color:var(--ink-2)">${icon('building')} Listed by a real estate company</span>`}</div>
    </div>
    <main class="pad stack" style="gap:14px;padding-top:16px">
      ${p.status !== 'available' ? `<div class="tag orange" style="align-self:flex-start">${p.status === 'let' ? 'Already let' : p.status === 'sold' ? 'Sold' : 'Hidden'}</div>` : ''}
      <div><div class="row" style="gap:6px;align-items:baseline"><span style="font-size:26px;font-weight:700;letter-spacing:-.4px">${naira(p.price)}</span>${p.period ? `<span class="muted small">/ year</span>` : ''}</div><div style="font-size:16px;font-weight:600;margin-top:4px">${h(p.title)}</div><div class="small muted row" style="gap:6px;margin-top:4px">${icon('location-dot')} ${h(p.district)}${p.area ? ', ' + h(p.area) : ''}${p.minutesToCentre ? ` · ${p.minutesToCentre} min to Central Area` : ''}</div></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${facts.map(([v, l]) => `<div class="card" style="padding:10px;text-align:center"><div style="font-size:15px;font-weight:700">${h(String(v))}</div><div class="small muted">${l}</div></div>`).join('')}</div>
      ${p.facilities.length ? `<div class="row" style="flex-wrap:wrap;gap:8px">${p.facilities.map((x) => `<span class="tag" style="background:var(--card);border:1px solid var(--line);color:var(--ink-2)">${icon('circle-check')} ${h(x)}</span>`).join('')}</div>` : ''}
      <p style="margin:0;font-size:14px;line-height:1.55;color:var(--ink-2);white-space:pre-line">${h(p.description)}</p>
      ${p.landlord ? `<div class="card row" style="padding:14px;gap:12px">${p.landlord.photo ? `<img src="${p.landlord.photo}" alt="" style="width:44px;height:44px;border-radius:22px;object-fit:cover;flex-shrink:0">` : avatar(p.landlord.name, 44, color(p.landlord.name))}<div class="grow"><div style="font-size:14px;font-weight:700" class="row" style="gap:6px">${h(p.landlord.name)}${p.landlord.verified ? ' ' + icon('circle-check') : ''}</div><div class="small muted">${p.landlord.isCompany ? 'Real estate company' : 'Landlord'}${p.landlord.verified ? ' · title document checked' : ' · verification coming'} · ${p.landlord.listings} listing${p.landlord.listings === 1 ? '' : 's'}</div></div></div>` : ''}
      ${p.kind === 'rent' ? `<div class="row" style="gap:10px;padding:12px 14px;background:var(--green-tint);border-radius:12px;font-size:12px;color:var(--green-dark);line-height:1.5">${icon('naira-sign')}<span><strong>${p.direct ? `You save about ${naira(p.agentFeeSaved)}.` : 'Agency fee may apply.'}</strong> ${p.legalFee != null || p.cautionFee != null ? `Legal fee ${p.legalFee != null ? naira(p.legalFee) : 'not stated'}, caution fee ${p.cautionFee != null ? naira(p.cautionFee) : 'not stated'}, stated by the landlord before you inspect.` : 'Ask about legal and caution fees before you inspect.'}</span></div>` : ''}
      <div class="small muted">${p.views} view${p.views === 1 ? '' : 's'}</div>
    </main>
    ${p.mine || p.status !== 'available' ? '' : `<div class="row" style="gap:10px;padding:12px 20px 16px;background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      <button class="btn btn-outline" data-enquire="${p.id}" style="flex:1">${icon('message')} Message</button>
      <button class="btn btn-primary" data-enquire="${p.id}" data-inspect="1" style="flex:1.4">${icon('calendar-check')} Request inspection</button></div>`}`;
  }, {
    mount(el) {
      bindSaves(el);
      const slides = el.querySelectorAll('[data-slide]'); let i = 0;
      el.querySelector('#gallery')?.addEventListener('click', (e) => { if (e.target.closest('a,button') || slides.length < 2) return; i = (i + (e.clientX > innerWidth / 2 ? 1 : slides.length - 1)) % slides.length; slides.forEach((s, k) => { s.style.display = k === i ? '' : 'none'; }); el.querySelectorAll('[data-dot]').forEach((d, k) => { d.style.background = `rgba(255,255,255,${k === i ? 1 : .4})`; }); });
      el.querySelectorAll('[data-enquire]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.enquire(b.dataset.enquire); go('/inbox/' + r.threadId + (b.dataset.inspect ? '?inspect=1' : '')); } catch (err) { busy(b, false); failed(el, err); } }));
    }
  });

  /* ---------- Landlord ---------- */
  route('/homes/landlord', { auth: true, tabs: '' }, async () => {
    if (!isLandlord()) return `${topbar('Listing a home', '/homes')}<div class="placeholder"><div class="mi card">${icon('house-chimney')}</div><div class="h-md">This is for landlord accounts</div><div class="small muted" style="max-width:280px;line-height:1.5">To list property, create a separate account and choose "I have property to rent or sell" at onboarding.</div></div>`;
    const { landlord: l } = await api.landlordMe();
    if (!l) return `${topbar('Your landlord profile', '/home')}
      <form id="lf" class="pad stack" style="gap:14px">
        <div><div class="h-xl">List direct, no agent</div><div class="muted" style="margin-top:4px">People looking for a home see this on every listing you post.</div></div>
        ${field({ id: 'displayName', label: 'Your name or company name', placeholder: 'Mr Okonkwo, or Jabi Prime Estates' })}
        <div class="field"><label>You are</label><div class="seg" id="co"><button type="button" data-v="0" class="on">A landlord</button><button type="button" data-v="1">A real estate company</button></div></div>
        <div class="field"><label for="about">About (optional)</label><textarea class="input" id="about" maxlength="600" placeholder="How many properties, where, how long you have let them" style="height:90px;padding:12px 14px;resize:none"></textarea></div>
        <div class="small muted row" style="gap:8px">${icon('shield-halved')} Verification with a title document comes in a later phase and earns the Verified badge.</div>
        <button class="btn btn-primary" type="submit">Save and continue</button></form>`;
    const { properties, savedByOthers } = await api.landlordProperties();
    const sum = (k) => properties.reduce((a, p) => a + (p[k] || 0), 0);
    return `${topbar(l.displayName, '/home', `<a class="iconbtn" href="#/homes/landlord/profile" aria-label="Edit profile">${icon('gear')}</a>`)}
    <main class="pad stack" style="gap:16px">
      <div class="card row" style="padding:14px;gap:14px"><label style="position:relative;cursor:pointer;flex-shrink:0">${l.photo ? `<img src="${l.photo}" alt="" style="width:64px;height:64px;border-radius:32px;object-fit:cover;display:block">` : `<span style="width:64px;height:64px;border-radius:32px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--ink-3)">${icon('camera')}</span>`}<span style="position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:12px;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid var(--card)">${icon('camera')}</span><input type="file" accept="image/*" id="llphoto" style="display:none"></label><div class="grow"><div style="font-size:15px;font-weight:700">${h(l.displayName)}</div><div class="small muted">${l.photo ? 'Your photo shows on every listing.' : 'Add a photo or your company logo. People rent faster from a face.'}</div></div></div>
      <div class="small muted">${l.isCompany ? 'Real estate company' : 'Landlord'}${l.verified ? ` · <span class="tag green">${icon('circle-check')} Verified</span>` : ` · <a href="#/verify" style="color:var(--orange-dark);font-weight:600">Get verified with a title document</a>`}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${[['VIEWS', sum('views'), ''], ['ENQUIRIES', sum('enquiries'), 'var(--orange-dark)'], ['INSPECTIONS', sum('inspections'), ''], ['SAVED BY OTHERS', savedByOthers, 'var(--green-dark)']].map(([t, v, c]) => `<div class="card" style="padding:14px 16px"><div class="small muted" style="font-weight:600">${t}</div><div style="font-size:28px;font-weight:700;margin-top:4px;color:${c || 'var(--ink)'}">${v}</div></div>`).join('')}</div>
      <a class="btn btn-primary" href="#/homes/landlord/post">${icon('plus')} Post a property</a>
      <div class="section">MY PROPERTIES</div>
      <div class="stack" style="gap:10px">${properties.length ? properties.map((p) => `<a class="card row" href="#/homes/${p.id}" style="padding:12px;gap:12px"><div style="width:72px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0">${ph(p.photos[0]?.url)}</div><div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(p.title)}</div><div class="small muted">${h(p.district)} · ${short(p.price)}${p.period ? '/yr' : ''} · ${p.views} views · ${p.enquiries} enquir${p.enquiries === 1 ? 'y' : 'ies'}</div></div><span class="tag ${p.status === 'available' ? 'green' : ''}" style="${p.status === 'available' ? '' : 'background:var(--surface);color:var(--ink-3)'}">${p.status === 'available' ? 'Available' : p.status}</span></a>`).join('') : `<div class="card" style="padding:16px"><div class="h-sm">No properties yet</div><div class="small muted">Post your first one. It is live the moment you save it.</div></div>`}</div>
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('#co button').forEach((b) => b.addEventListener('click', () => el.querySelectorAll('#co button').forEach((x) => x.classList.toggle('on', x === b))));
      el.querySelector('#llphoto')?.addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; toast('Uploading…'); try { const up = await api.upload(await compress(f), 'image'); await api.landlordSave({ uploadId: up.upload.id }); toast('Photo saved'); location.reload(); } catch (err) { failed(el, err); } });
      el.querySelector('#lf')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { await api.landlordSave({ displayName: el.querySelector('#displayName').value, isCompany: el.querySelector('#co button.on').dataset.v === '1', about: el.querySelector('#about').value }); toast('Profile saved'); location.reload(); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });
  route('/homes/landlord/profile', { auth: true, tabs: '' }, async () => { const { landlord: l } = await api.landlordMe(); if (!l) { go('/homes/landlord'); return ''; } return `${topbar('Landlord profile', '/homes/landlord')}<form id="lf" class="pad stack" style="gap:14px">${field({ id: 'displayName', label: 'Name or company name', value: l.displayName })}<div class="field"><label>You are</label><div class="seg" id="co"><button type="button" data-v="0" class="${l.isCompany ? '' : 'on'}">A landlord</button><button type="button" data-v="1" class="${l.isCompany ? 'on' : ''}">A real estate company</button></div></div><div class="field"><label for="about">About</label><textarea class="input" id="about" maxlength="600" style="height:110px;padding:12px 14px;resize:none">${h(l.about || '')}</textarea></div><button class="btn btn-ink" type="submit">Save</button></form>`; },
    { mount(el) { el.querySelectorAll('#co button').forEach((b) => b.addEventListener('click', () => el.querySelectorAll('#co button').forEach((x) => x.classList.toggle('on', x === b)))); el.querySelector('#lf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { await api.landlordSave({ displayName: el.querySelector('#displayName').value, isCompany: el.querySelector('#co button.on').dataset.v === '1', about: el.querySelector('#about').value }); toast('Saved'); go('/homes/landlord'); } catch (err) { busy(btn, false); failed(el, err); } }); } });

  /* ---------- Post / edit property ---------- */
  function form(p, types, facilities) {
    const fac = p?.facilities || [];
    return `<form id="pf" class="pad stack" style="gap:14px">
      <div class="field"><label>Listing</label><div class="seg" id="kind"><button type="button" data-v="rent" class="${(p?.kind || 'rent') === 'rent' ? 'on' : ''}">For rent</button><button type="button" data-v="sale" class="${p?.kind === 'sale' ? 'on' : ''}">For sale</button></div></div>
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="type">Type</label><select class="input" id="type">${Object.entries(types).map(([k, v]) => `<option value="${k}" ${(p?.type || 'flat') === k ? 'selected' : ''}>${v}</option>`).join('')}</select><div class="error" data-error="type"></div></div><div class="field" style="flex:1"><label for="district">District</label><select class="input" id="district"><option value="">Choose</option>${DISTRICTS.map((d) => `<option ${(p?.district || state.user.district) === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="error" data-error="district"></div></div></div>
      ${field({ id: 'title', label: 'Title', placeholder: '2-bedroom flat, upstairs, own compound', value: p?.title || '' })}
      ${field({ id: 'area', label: 'Area or landmark (not the street address)', placeholder: 'Behind Jabi Lake Mall', value: p?.area || '' })}
      <div class="row" style="gap:10px"><div class="field" style="flex:1.4"><label for="price">Price (₦)<span id="per" class="muted"> / year</span></label><input class="input" id="price" inputmode="numeric" placeholder="2,200,000" value="${p?.price || ''}"><div class="error" data-error="price"></div></div><div class="field" style="flex:1"><label for="beds">Beds</label><input class="input" id="beds" type="number" min="0" max="20" value="${p?.beds ?? 2}"></div><div class="field" style="flex:1"><label for="baths">Baths</label><input class="input" id="baths" type="number" min="0" max="20" value="${p?.baths ?? 1}"></div></div>
      <div class="row" style="gap:10px" id="rentonly"><div class="field" style="flex:1"><label for="upfront">Years upfront</label><select class="input" id="upfront">${[1, 2, 3].map((n) => `<option ${(p?.upfront || 1) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="field" style="flex:1"><label for="legalFee">Legal fee (₦)</label><input class="input" id="legalFee" inputmode="numeric" placeholder="optional" value="${p?.legalFee ?? ''}"></div><div class="field" style="flex:1"><label for="cautionFee">Caution fee (₦)</label><input class="input" id="cautionFee" inputmode="numeric" placeholder="optional" value="${p?.cautionFee ?? ''}"></div></div>
      <div class="field"><label>Facilities</label><div class="row" style="flex-wrap:wrap;gap:8px" id="fl">${facilities.map((x) => `<button type="button" class="chip ${fac.includes(x) ? 'on' : ''}" data-f="${h(x)}">${h(x)}</button>`).join('')}</div></div>
      <div class="field"><label for="description">Description</label><textarea class="input" id="description" maxlength="3000" placeholder="Floor, compound, power and water situation, what is included, when it is available." style="height:120px;padding:12px 14px;resize:none">${h(p?.description || '')}</textarea><div class="error" data-error="description"></div></div>
      ${p ? `<div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="section">PHOTOS</span><span class="small muted">${p.photos.length} of 10</span></div><div id="grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${grid(p.photos)}</div><div class="error" data-error="photo"></div></div>` : `<div class="small muted row" style="gap:8px">${icon('camera')} Save first, then add up to 10 photos.</div>`}
      <button class="btn btn-primary" type="submit">${p ? 'Save changes' : 'Post property'}</button>
      ${p ? `<div class="row" style="gap:8px">${p.status === 'available' ? `<button type="button" class="btn btn-sm btn-outline" data-status="${p.kind === 'rent' ? 'let' : 'sold'}" style="flex:1">Mark as ${p.kind === 'rent' ? 'let' : 'sold'}</button><button type="button" class="btn btn-sm btn-outline" data-status="hidden" style="flex:1">Hide</button>` : `<button type="button" class="btn btn-sm btn-ink" data-status="available" style="flex:1">Make available again</button>`}</div>` : ''}
    </form>`;
  }
  const grid = (photos) => { const cells = photos.map((x, i) => `<div style="position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden">${ph(x.url)}${i === 0 ? '<span class="tag green" style="position:absolute;top:6px;left:6px">MAIN</span>' : ''}<button type="button" class="iconbtn" data-del="${x.id}" aria-label="Remove" style="position:absolute;top:6px;right:6px;width:30px;height:30px;background:rgba(0,0,0,.55);border:none;color:#fff">${icon('xmark')}</button></div>`); while (cells.length < 10) cells.push(`<label style="aspect-ratio:4/3;border-radius:12px;border:2px dashed var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-3);cursor:pointer">${icon(cells.length === 0 ? 'camera' : 'plus')}<input type="file" accept="image/*" data-add style="display:none"></label>`); return cells.join(''); };
  function mountForm(el, id) {
    clearOnInput(el);
    const seg = el.querySelector('#kind'); const sync = () => { const rent = seg.querySelector('button.on').dataset.v === 'rent'; el.querySelector('#rentonly').style.display = rent ? '' : 'none'; el.querySelector('#per').textContent = rent ? ' / year' : ''; };
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); sync(); })); sync();
    el.querySelector('#fl').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); });
    el.querySelector('#pf').addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
      const v = (s) => el.querySelector(s).value;
      const body = { kind: seg.querySelector('button.on').dataset.v, type: v('#type'), district: v('#district'), title: v('#title'), area: v('#area'), price: v('#price'), beds: +v('#beds'), baths: +v('#baths'), upfront: +v('#upfront'), legalFee: v('#legalFee'), cautionFee: v('#cautionFee'), facilities: [...el.querySelectorAll('#fl .chip.on')].map((c) => c.dataset.f), description: v('#description') };
      try { if (id) { await api.updateHome(id, body); toast('Saved'); go('/homes/' + id); } else { const r = await api.createHome(body); toast('Posted. Now add photos.'); go('/homes/landlord/edit/' + r.property.id); } } catch (err) { busy(btn, false); failed(el, err); }
    });
    el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { await api.updateHome(id, { status: b.dataset.status }); toast('Updated'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
    const g = el.querySelector('#grid'); if (!g) return;
    g.addEventListener('change', async (e) => { const i = e.target.closest('[data-add]'); if (!i || !i.files[0]) return; try { const small = await compress(i.files[0]); const r = await api.addHomePhoto(id, small); g.innerHTML = grid(r.photos); toast('Photo added'); } catch (err) { failed(el, err); } });
    g.addEventListener('click', async (e) => { const b = e.target.closest('[data-del]'); if (!b || !confirm('Remove this photo?')) return; try { const r = await api.deleteHomePhoto(b.dataset.del); g.innerHTML = grid(r.photos); } catch (err) { failed(el, err); } });
  }
  route('/homes/landlord/post', { auth: true, tabs: '' }, async () => { const { types, facilities } = await api.landlordMe(); return `${topbar('Post a property', '/homes/landlord')}${form(null, types, facilities)}`; }, { mount(el) { mountForm(el, null); } });
  route('/homes/landlord/edit/:id', { auth: true, tabs: '' }, async ({ id }) => { const [{ property: p }, { types, facilities }] = await Promise.all([api.home(id), api.landlordMe()]); return `${topbar('Edit property', '/homes/' + id)}${form(p, types, facilities)}`; }, { mount(el, { id }) { mountForm(el, id); } });
}
