// Buja Declutter: buy and sell nearby. Registered into the app router by app.js.
import { saveSearchBar, bindSaveSearch } from './alerts.js';

export function registerDeclutter({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon } = ui;
  const naira = (n) => n == null ? '' : '₦' + Number(n).toLocaleString('en-NG');
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const ph = (url) => url ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">` : `<div style="width:100%;height:100%;background:linear-gradient(180deg,#3A3A42,#1C1C22);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:11px;font-weight:600;letter-spacing:1px">NO PHOTO</div>`;
  const colors = ['#7A3E96', '#1F4E9C', '#2E7D1E', '#0E7C86', '#E8620E'];
  const color = (s) => colors[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  const ago = (iso) => { const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 3600 ? Math.max(1, Math.round(d / 60)) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  async function compress(file) { const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file; const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82)); return new File([blob], 'photo.jpg', { type: 'image/jpeg' }); }

  function card(l) {
    return `<a class="card" href="#/declutter/${l.id}" style="overflow:hidden;display:flex;flex-direction:column">
      <div style="position:relative;aspect-ratio:1">${ph(l.photos[0]?.url)}<button class="iconbtn" data-save="${l.id}" aria-label="${l.saved ? 'Unsave' : 'Save'}" style="position:absolute;top:8px;right:8px;width:32px;height:32px;background:rgba(255,255,255,.92);border:none;color:${l.saved ? 'var(--orange)' : 'var(--ink)'};font-size:14px">${icon(l.saved ? 'heart' : 'regular/heart')}</button></div>
      <div style="padding:10px 12px 12px"><div style="font-size:15px;font-weight:700">${naira(l.price)}</div><div style="font-size:13px;color:var(--ink-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(l.title)}</div><div class="small muted row" style="gap:6px;margin-top:4px">${icon('location-dot')} ${h(l.district)} · ${l.conditionLabel}</div></div></a>`;
  }
  function bindSaves(el) {
    el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); const on = b.getAttribute('aria-label') === 'Unsave'; try { on ? await api.dUnsave(b.dataset.save) : await api.dSave(b.dataset.save); b.setAttribute('aria-label', on ? 'Save' : 'Unsave'); b.style.color = on ? 'var(--ink)' : 'var(--orange)'; b.innerHTML = icon(on ? 'regular/heart' : 'heart'); toast(on ? 'Removed' : 'Saved'); } catch (err) { failed(el, err); } }));
  }

  /* ---------- Feed ---------- */
  route('/declutter', { auth: true, tabs: '' }, async () => {
    const f = Object.fromEntries(q().entries()); f.sort = f.sort || 'nearby';
    const r = await api.declutter(f);
    return `
    ${topbar('Declutter', '/home', `<a class="iconbtn" href="#/declutter/saved" aria-label="Saved">${icon('regular/heart')}</a><a class="iconbtn" href="#/declutter/mine" aria-label="My listings">${icon('tags')}</a>`)}
    <form id="q" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px"><label for="qq" style="position:absolute;left:-9999px">Search items</label>${icon('magnifying-glass')}<input id="qq" name="q" type="search" placeholder="Phones, furniture, generators" value="${h(f.q || '')}" style="flex:1;border:none;background:transparent;font-size:14px;outline:none;color:var(--ink)"></div></form>
    <div class="row" style="gap:8px;padding:12px 16px 4px;overflow-x:auto;scrollbar-width:none">${['', ...r.categories].map((c) => `<a class="chip ${(f.category || '') === c ? 'on' : ''}" href="#/declutter?${new URLSearchParams({ ...f, category: c })}">${c || 'All'}</a>`).join('')}</div>
    <main class="pad stack" style="gap:12px;padding-top:10px">
      <div class="row small muted" style="justify-content:space-between"><span>${r.total} item${r.total === 1 ? '' : 's'}</span><span class="row" style="gap:10px">${[['nearby', 'Near me'], ['newest', 'Newest'], ['cheapest', 'Cheapest']].map(([k, v]) => `<a href="#/declutter?${new URLSearchParams({ ...f, sort: k })}" style="font-weight:600;color:${f.sort === k ? 'var(--ink)' : 'var(--ink-3)'}">${v}</a>`).join('')}</span></div>
      ${saveSearchBar({ module: 'declutter', filters: f, ui: { icon, h } })}
      ${r.listings.length ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${r.listings.map(card).join('')}</div>` : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('tags')}</div><div class="h-md">Nothing here yet</div><div class="small muted" style="max-width:280px;line-height:1.5">Be the first to list something. Items near ${h(state.user.district || 'you')} show first.</div></div>`}
    </main>
    <a href="#/declutter/sell" style="position:fixed;right:16px;bottom:calc(var(--tab-h) + var(--safe-b) + 16px);height:52px;padding:0 20px;display:flex;align-items:center;gap:10px;background:var(--orange);color:#fff;border-radius:26px;font-size:15px;font-weight:700;box-shadow:0 8px 24px rgba(255,122,26,.35);z-index:15">${icon('plus')} Sell</a>`;
  }, { mount(el) { bindSaves(el); bindSaveSearch(el, { api, ui: { toast } }); el.querySelector('#q')?.addEventListener('submit', (e) => { e.preventDefault(); const p = q(); p.set('q', e.target.q.value); go('/declutter?' + p); }); } });

  route('/declutter/saved', { auth: true, tabs: '' }, async () => { const { listings } = await api.dSaved(); return `${topbar('Saved items', '/declutter')}<main class="pad">${listings.length ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${listings.map(card).join('')}</div>` : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('regular/heart')}</div><div class="h-md">Nothing saved</div></div>`}</main>`; }, { mount: bindSaves });

  route('/declutter/mine', { auth: true, tabs: '' }, async () => {
    const { listings } = await api.dMine();
    return `${topbar('My listings', '/declutter')}<main class="pad stack" style="gap:12px">
      <a class="btn btn-primary" href="#/declutter/sell">${icon('plus')} Sell something</a>
      ${listings.length ? `<div class="stack" style="gap:10px">${listings.map((l) => `<a class="card row" href="#/declutter/${l.id}" style="padding:12px;gap:12px"><div style="width:64px;height:64px;border-radius:10px;overflow:hidden;flex-shrink:0">${ph(l.photos[0]?.url)}</div><div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(l.title)}</div><div class="small muted">${naira(l.price)} · ${l.views} views · ${l.chats} chat${l.chats === 1 ? '' : 's'}${l.offers ? ` · <strong style="color:var(--orange-dark)">${l.offers} offer${l.offers === 1 ? '' : 's'} waiting</strong>` : ''}</div></div><span class="tag ${l.status === 'active' ? 'green' : ''}" style="${l.status === 'active' ? '' : 'background:var(--surface);color:var(--ink-3)'}">${l.status === 'active' ? 'Live' : l.status}</span></a>`).join('')}</div>` : `<div class="card" style="padding:16px"><div class="h-sm">Nothing listed yet</div><div class="small muted">Photograph it, price it, post it. Takes a minute.</div></div>`}</main>`;
  });

  /* ---------- Item ---------- */
  route('/declutter/:id', { auth: true, tabs: '' }, async ({ id }) => {
    if (!/^\d+$/.test(id)) return '';
    const { listing: l } = await api.dItem(id);
    return `
    <div style="position:relative;height:340px;background:#1C1C22" id="gallery">${l.photos.map((x, i) => `<div data-slide="${i}" style="position:absolute;inset:0;${i ? 'display:none' : ''}">${ph(x.url)}</div>`).join('') || ph(null)}
      <a class="iconbtn" href="#${l.mine ? '/declutter/mine' : '/declutter'}" aria-label="Back" style="position:absolute;top:14px;left:16px;background:rgba(0,0,0,.4);border:none;color:#fff">${icon('arrow-left')}</a>
      ${l.mine ? `<a class="iconbtn" href="#/declutter/edit/${l.id}" aria-label="Edit" style="position:absolute;top:14px;right:16px;background:rgba(0,0,0,.4);border:none;color:#fff">${icon('sliders')}</a>` : `<button class="iconbtn" data-save="${l.id}" aria-label="${l.saved ? 'Unsave' : 'Save'}" style="position:absolute;top:14px;right:16px;background:rgba(0,0,0,.4);border:none;color:${l.saved ? 'var(--orange)' : '#fff'}">${icon(l.saved ? 'heart' : 'regular/heart')}</button>`}
      ${l.photos.length ? `<span style="position:absolute;right:14px;bottom:22px;background:rgba(0,0,0,.5);color:#fff;border-radius:12px;padding:4px 9px;font:600 12px Inter,system-ui;pointer-events:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap">${icon('camera')} ${l.photos.length} photo${l.photos.length === 1 ? '' : 's'}</span>` : ''}
      ${l.photos.length > 1 ? `<div style="position:absolute;bottom:12px;left:16px;right:16px;display:flex;gap:4px">${l.photos.map((x, i) => `<span data-dot="${i}" style="flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,${i ? .4 : 1})"></span>`).join('')}</div>` : ''}
    </div>
    <main class="pad stack" style="gap:14px;padding-top:16px">
      ${l.status !== 'active' ? `<span class="tag orange" style="align-self:flex-start">${l.status === 'sold' ? 'Sold' : 'Hidden'}</span>` : ''}
      <div><div style="font-size:26px;font-weight:700;letter-spacing:-.4px">${naira(l.price)}</div><div style="font-size:16px;font-weight:600;margin-top:4px">${h(l.title)}</div><div class="small muted row" style="gap:6px;margin-top:4px">${icon('location-dot')} ${h(l.district)} · posted ${ago(l.createdAt)} · ${l.views} view${l.views === 1 ? '' : 's'}</div></div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><span class="tag green">${l.conditionLabel}</span><span class="tag" style="background:var(--surface);color:var(--ink-2)">${l.category}</span><span class="tag" style="background:var(--surface);color:var(--ink-2)">${l.delivery === 'pickup' ? 'Pickup only' : l.delivery === 'delivery' ? 'Delivery' : 'Pickup or delivery'}</span>${l.negotiable ? `<span class="tag orange">Price negotiable</span>` : ''}${l.escrowOk ? `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${icon('shield-halved')} Buy safely with Buja escrow</span>` : ''}</div>
      <p style="margin:0;font-size:14px;line-height:1.55;color:var(--ink-2);white-space:pre-line">${h(l.description)}</p>
      <div class="card row" style="padding:14px;gap:12px">${avatar(l.seller.name, 44, color(l.seller.name))}<div class="grow"><div style="font-size:14px;font-weight:700" class="row" style="gap:6px">${h(l.seller.name)}${l.seller.verified ? ' ' + icon('circle-check') : ''}</div><div class="small muted">${l.seller.verified ? 'Verified with a selfie' : (l.seller.phoneAdded ? 'Phone on file' : 'No phone on file')} · ${window.bujaRating ? window.bujaRating(l.seller.rating) : ''} · ${l.seller.sold} sold · ${l.seller.active} listed · ${h(l.seller.district || 'Abuja')} · since ${l.seller.since}</div></div></div>
      ${l.mine ? '' : `<a class="small" href="#/report/listing/${l.id}" style="color:var(--ink-3);font-weight:600">${icon('triangle-exclamation')} Report this listing</a>`}
      <div class="row" style="gap:10px;padding:12px 14px;background:var(--orange-tint);border-radius:12px;font-size:12px;color:var(--orange-dark);line-height:1.5">${icon('shield-halved')}<span><strong>Stay safe.</strong> Meet in a public place, test before paying, and never send a deposit to reserve an item.</span></div>
    </main>
    ${l.mine || l.status !== 'active' ? '' : `<div class="row" style="gap:10px;padding:12px 20px 16px;background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      ${l.escrowOk ? `<button class="btn btn-ink" id="buysafe" data-delivery="${h(l.delivery || 'pickup')}" style="flex:1.2">${icon('shield-halved')} Buy safely</button>` : ''}
      <button class="btn btn-outline" data-chat="${l.id}" data-offer="1" style="flex:1">${icon('naira-sign')} Make offer</button>
      <button class="btn btn-primary" data-chat="${l.id}" style="flex:1.3">${icon('message')} Chat with ${h(l.seller.name.split(' ')[0])}</button></div>
    ${l.escrowOk ? `<div class="small muted" style="padding:0 20px 14px;background:var(--card);line-height:1.4">${icon('shield-halved')} <b>Buy safely:</b> pay into Buja, and ${h(l.seller.name.split(' ')[0])} is paid only when you confirm the item arrived. Small protection fee.</div>` : ''}`}`;
  }, {
    mount(el) {
      /* Buy safely: if the seller delivers, the buyer chooses delivery and drops a pin, so they can watch it come */
      const here = (ms = 8000) => new Promise((res) => { if (!navigator.geolocation) return res(null); let d = false; const f = (v) => { if (!d) { d = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 60000 }); });
      const pay = async (b, body) => { busy(b, true); try { const r = await api.escrowBuy(el.dataset.lid || location.hash.split('/')[2].split('?')[0], body); if (!confirm(`Pay ₦${Number(r.total).toLocaleString('en-NG')}? That is ₦${Number(r.price).toLocaleString('en-NG')} for the item plus ₦${Number(r.fee).toLocaleString('en-NG')} buyer protection. Buja holds it until you confirm the item arrived.`)) { busy(b, false); return; } location.href = r.url; } catch (err) { busy(b, false); failed(el, err); } };
      el.querySelector('#buysafe')?.addEventListener('click', async (e) => {
        const b = e.currentTarget; const dl = b.dataset.delivery;
        if (dl === 'pickup') return pay(b, { handover: 'pickup' });
        if (el.querySelector('#howget')) return;
        b.closest('.row').insertAdjacentHTML('afterend', `<div class="card stack" id="howget" style="padding:12px 14px;gap:8px;margin-top:10px"><div style="font-weight:700">How do you want it?</div>
          <button class="btn btn-primary" id="getdeliver">${icon('location-dot')} Deliver to me <span class="small" style="opacity:.8;font-weight:500">(you can watch it come)</span></button>
          ${dl === 'both' ? `<button class="btn btn-outline" id="getpickup">I will pick it up</button>` : ''}
          <input class="input" id="dropnote" maxlength="160" placeholder="Landmark for the seller (optional), e.g. blue gate beside the pharmacy"></div>`);
        el.querySelector('#getpickup')?.addEventListener('click', (ev) => pay(ev.currentTarget, { handover: 'pickup' }));
        el.querySelector('#getdeliver').addEventListener('click', async (ev) => { const x = ev.currentTarget; busy(x, true); const pos = await here(); busy(x, false); if (!pos) { toast('Turn on location so the seller can find you'); return; } pay(x, { handover: 'delivery', lat: pos.lat, lng: pos.lng, note: el.querySelector('#dropnote').value }); });
      });
      bindSaves(el);
      const slides = el.querySelectorAll('[data-slide]'); let i = 0;
      // tap: open the photos full screen; swipe: next or previous right here
      const gal = el.querySelector('#gallery'); const urls = [...slides].map((s) => s.querySelector('img')?.src).filter(Boolean);
      const go2 = (k) => { i = (k + slides.length) % slides.length; slides.forEach((s, n) => { s.style.display = n === i ? '' : 'none'; }); el.querySelectorAll('[data-dot]').forEach((d, n) => { d.style.background = `rgba(255,255,255,${n === i ? 1 : .4})`; }); };
      let sx = null, sy = 0, swiped = false;
      gal?.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiped = false; }, { passive: true });
      gal?.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (slides.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go2(i + (dx < 0 ? 1 : -1)); } });
      gal?.addEventListener('click', (e) => { if (e.target.closest('a,button') || swiped) { swiped = false; return; } if (urls.length) ui.viewImages(urls, i); });
      el.querySelectorAll('[data-chat]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.dChat(b.dataset.chat); go('/inbox/' + r.threadId + (b.dataset.offer ? '?offer=1' : '')); } catch (err) { busy(b, false); failed(el, err); } }));
    }
  });

  /* ---------- Sell / edit ---------- */
  function form(l, cats, conds) {
    return `<form id="sf" class="pad stack" style="gap:14px">
      ${l ? `<div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="section">PHOTOS</span><span class="small muted">${l.photos.length} of 8</span></div><div id="grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${grid(l.photos)}</div><div class="error" data-error="photo"></div></div>` : `<div class="small muted row" style="gap:8px">${icon('camera')} Save first, then add up to 8 photos. Listings with photos sell four times faster.</div>`}
      ${field({ id: 'title', label: 'Title', placeholder: 'iPhone 13, 128GB, UK used', value: l?.title || '' })}
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="category">Category</label><select class="input" id="category"><option value="">Choose</option>${cats.map((c) => `<option ${l?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select><div class="error" data-error="category"></div></div><div class="field" style="flex:1"><label for="condition">Condition</label><select class="input" id="condition"><option value="">Choose</option>${Object.entries(conds).map(([k, v]) => `<option value="${k}" ${l?.condition === k ? 'selected' : ''}>${v}</option>`).join('')}</select><div class="error" data-error="condition"></div></div></div>
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="price">Price (₦)</label><input class="input" id="price" inputmode="numeric" placeholder="420,000" value="${l?.price || ''}"><div class="error" data-error="price"></div></div><div class="field" style="flex:1"><label>Negotiable?</label><div class="seg" id="neg"><button type="button" data-v="1" class="${l?.negotiable === false ? '' : 'on'}">Yes</button><button type="button" data-v="0" class="${l?.negotiable === false ? 'on' : ''}">Fixed</button></div></div></div>
      <div class="field"><label for="district">Where is it</label><select class="input" id="district"><option value="">Choose</option>${DISTRICTS.map((d) => `<option ${(l?.district || state.user.district) === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="hint">Buyers see your district, never your street.</div><div class="error" data-error="district"></div></div>
      <div class="field"><label>Handover</label><div class="seg" id="del">${[['pickup', 'Pickup'], ['delivery', 'Delivery'], ['both', 'Either']].map(([k, v]) => `<button type="button" data-v="${k}" class="${(l?.delivery || 'pickup') === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="field"><label for="description">Description</label><textarea class="input" id="description" maxlength="2000" placeholder="Age, what's included, why you're selling, where you can meet" style="height:100px;padding:12px 14px;resize:none">${h(l?.description || '')}</textarea><div class="error" data-error="description"></div></div>
      <label class="check" style="align-items:center"><input type="checkbox" id="escrow" ${l?.escrowOk ? 'checked' : ''}>Happy to use Buja escrow when payments launch (buyer's money is held until they confirm the item)</label>
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} ${l ? 'Save changes' : 'Post listing'}</button>
      ${l ? `<div class="row" style="gap:8px">${l.status === 'active' ? `<button type="button" class="btn btn-sm btn-ink" data-status="sold" style="flex:1">Mark as sold</button><button type="button" class="btn btn-sm btn-outline" data-status="hidden" style="flex:1">Hide</button>` : `<button type="button" class="btn btn-sm btn-ink" data-status="active" style="flex:1">Relist</button>`}</div>` : ''}
    </form>`;
  }
  const grid = (photos) => { const cells = photos.map((x, i) => `<div style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden">${ph(x.url)}${i === 0 ? '<span class="tag green" style="position:absolute;top:4px;left:4px;font-size:9px;padding:3px 6px">MAIN</span>' : ''}<button type="button" class="iconbtn" data-del="${x.id}" aria-label="Remove" style="position:absolute;top:4px;right:4px;width:26px;height:26px;background:rgba(0,0,0,.55);border:none;color:#fff;font-size:12px">${icon('xmark')}</button></div>`); while (cells.length < 8) cells.push(`<label style="aspect-ratio:1;border-radius:10px;border:2px dashed var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-3);cursor:pointer">${icon(cells.length === 0 ? 'camera' : 'plus')}<input type="file" accept="image/*" data-add style="display:none"></label>`); return cells.join(''); };
  function mountForm(el, id) {
    clearOnInput(el);
    el.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)))));
    el.querySelector('#sf').addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
      const v = (s) => el.querySelector(s).value;
      const body = { title: v('#title'), category: v('#category'), condition: v('#condition'), price: v('#price'), negotiable: el.querySelector('#neg button.on').dataset.v === '1', district: v('#district'), delivery: el.querySelector('#del button.on').dataset.v, description: v('#description'), escrowOk: el.querySelector('#escrow').checked };
      try { if (id) { await api.dUpdate(id, body); toast('Saved'); go('/declutter/' + id); } else { const r = await api.dCreate(body); toast('Posted. Now add photos.'); go('/declutter/edit/' + r.listing.id); } } catch (err) { busy(btn, false); failed(el, err); }
    });
    el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { await api.dUpdate(id, { status: b.dataset.status }); toast('Updated'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
    const g = el.querySelector('#grid'); if (!g) return;
    g.addEventListener('change', async (e) => { const i = e.target.closest('[data-add]'); if (!i || !i.files[0]) return; try { const r = await api.dAddPhoto(id, await compress(i.files[0])); g.innerHTML = grid(r.photos); toast('Photo added'); } catch (err) { failed(el, err); } });
    g.addEventListener('click', async (e) => { const b = e.target.closest('[data-del]'); if (!b || !confirm('Remove this photo?')) return; try { const r = await api.dDeletePhoto(b.dataset.del); g.innerHTML = grid(r.photos); } catch (err) { failed(el, err); } });
  }
  route('/declutter/sell', { auth: true, tabs: '' }, async () => { const { categories, conditions } = await api.declutter({}); return `${topbar('Sell an item', '/declutter')}${form(null, categories, conditions)}`; }, { mount(el) { mountForm(el, null); } });
  route('/declutter/edit/:id', { auth: true, tabs: '' }, async ({ id }) => { const [{ listing: l }, { categories, conditions }] = await Promise.all([api.dItem(id), api.declutter({})]); return `${topbar('Edit listing', '/declutter/' + id)}${form(l, categories, conditions)}`; }, { mount(el, { id }) { mountForm(el, id); } });
}
