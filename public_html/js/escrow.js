// Buy safely (Declutter escrow): my orders, one order's steps, where sellers get paid, and the admin escrow desk.
import { createMap, carHtml, avatarHtml, pinHtml, keepAwake, metres } from './map.js';
export function registerEscrow({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy } = ui;
  const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
  const when = (iso) => { if (!iso) return ''; const d = new Date(String(iso).replace(' ', 'T') + 'Z'); return d.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); };
  const LABEL = { paid: ['Paid, held by Buja', 'orange'], shipped: ['Handed over', 'orange'], released: ['Complete', 'green'], disputed: ['Problem reported', 'red'], refunded: ['Refunded', ''], cancelled: ['Cancelled', ''], pending: ['Waiting for payment', ''] };
  const badge = (s) => `<span class="tag ${LABEL[s] ? LABEL[s][1] : ''}">${h(LABEL[s] ? LABEL[s][0] : s)}</span>`;
  const thumb = (o) => o.listing && o.listing.photo ? `<img src="${h(o.listing.photo)}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0">` : `<span style="width:56px;height:56px;border-radius:12px;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('tags')}</span>`;

  /* ---------- my orders ---------- */
  route('/orders', { auth: true, tabs: 'Me' }, async () => {
    const d = await api.escrowOrders();
    const tab = new URLSearchParams(location.hash.split('?')[1] || '').get('tab') || (d.buying.length || !d.selling.length ? 'buying' : 'selling');
    const list = tab === 'buying' ? d.buying : d.selling;
    return `${topbar('Buy safely orders', '/me')}<main class="pad stack" style="gap:12px">
      <div class="row" style="gap:8px"><a class="chip ${tab === 'buying' ? 'on' : ''}" href="#/orders?tab=buying">Buying (${d.buying.length})</a><a class="chip ${tab === 'selling' ? 'on' : ''}" href="#/orders?tab=selling">Selling (${d.selling.length})</a></div>
      ${tab === 'selling' ? `<a class="card row" href="#/payout" style="padding:12px 14px;gap:10px">${icon('building-columns')}<span class="grow"><b>${d.payoutAccount ? h(d.payoutAccount.bank) + ' ····' + h(d.payoutAccount.last4) : 'Add the bank account you get paid into'}</b><br><span class="small muted">${d.payoutAccount ? h(d.payoutAccount.name) : 'Needed before Buja can send you money from a sale'}</span></span>${icon('chevron-right')}</a>` : ''}
      ${list.length ? list.map((o) => `<a class="card row" href="#/orders/${o.id}" style="padding:12px;gap:12px">${thumb(o)}<span class="grow" style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(o.listing ? o.listing.title : 'Item')}</b><span class="small muted">${naira(tab === 'buying' ? o.total : o.price)} · ${tab === 'buying' ? 'from ' + h(o.seller.name) : 'to ' + h(o.buyer.name)}</span><br>${badge(o.status)}</span>${icon('chevron-right')}</a>`).join('')
        : `<div class="placeholder" style="padding:40px 0"><div class="mi card">${icon('shield-halved')}</div><div class="h-md">${tab === 'buying' ? 'Nothing bought safely yet' : 'No safe sales yet'}</div><div class="small muted" style="max-width:290px;text-align:center;line-height:1.5">With Buy safely, the buyer pays into Buja. The seller is paid when the buyer confirms the item arrived.</div><a class="btn btn-primary" href="#/declutter" style="width:auto">Browse Declutter</a></div>`}
    </main>`;
  });

  /* ---------- one order ---------- */
  route('/orders/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const { order: o, hasPayoutAccount } = await api.escrowOrder(id);
    const paidNow = new URLSearchParams(location.hash.split('?')[1] || '').get('paid');
    const steps = [['Paid and held by Buja', o.paidAt], ['Seller handed it over', o.shippedAt], [o.status === 'refunded' ? 'Refunded to the buyer' : 'Seller paid', o.releasedAt || o.refundedAt]];
    const buyer = o.role === 'buyer', seller = o.role === 'seller';
    let actions = '';
    if (buyer && o.status === 'paid') actions = `<div class="small muted" style="line-height:1.5">${o.handover === 'delivery' ? 'When ' + h(o.seller.name) + ' brings it, check the item.' : 'Meet ' + h(o.seller.name) + ' and check the item.'} The seller cannot be paid until you confirm, and you get your money back if it is never handed over.</div><button class="btn btn-primary" data-act="confirm">${icon('circle-check')} I received it, pay the seller</button><button class="btn btn-ghost" data-act="dispute">Report a problem</button>`;
    if (buyer && o.status === 'shipped') actions = `<div class="small muted" style="line-height:1.5">If it is in your hands and as described, confirm to pay ${h(o.seller.name)}. If there is a problem, report it before <b>${when(o.releaseAt)}</b>; after that the payment releases by itself.</div><button class="btn btn-primary" data-act="confirm">${icon('circle-check')} I received it, pay the seller</button><button class="btn btn-ghost" data-act="dispute">Report a problem</button>`;
    if (seller && o.status === 'paid') actions = `<div class="small muted" style="line-height:1.5">${h(o.buyer.name)} paid ${naira(o.price)} and Buja is holding it. Hand the item over, then tap below. You are paid when they confirm, or automatically 3 days after handover if they report no problem.</div>${hasPayoutAccount ? '' : `<a class="card row" href="#/payout" style="padding:10px 12px;gap:10px;background:var(--orange-tint);border-color:var(--orange)">${icon('building-columns')}<span class="grow small"><b>Add your bank account</b> so the money can reach you</span>${icon('chevron-right')}</a>`}<button class="btn btn-primary" data-act="ship">${icon('box')} I have handed it over</button><button class="btn btn-ghost" data-act="cancel">I can't sell it any more (refund the buyer)</button>`;
    if (seller && o.status === 'shipped') actions = `<div class="small muted" style="line-height:1.5">Waiting for ${h(o.buyer.name)} to confirm. If they say nothing, you are paid automatically on <b>${when(o.releaseAt)}</b>.</div>${hasPayoutAccount ? '' : `<a class="btn btn-outline" href="#/payout">Add your bank account</a>`}`;
    if (o.status === 'disputed') actions = `<div class="card" style="padding:12px 14px;background:#FDECEA;border-color:#F5C2C0"><div class="small" style="line-height:1.5"><b>Problem reported:</b> "${h(o.note || '')}"<br>Buja is holding the money and will decide within 2 working days. You will get a notification.</div></div>`;
    if (o.status === 'released') actions = `<div class="card" style="padding:12px 14px;background:#E7F6EC;border-color:#BFE3CB"><div class="small" style="line-height:1.5">${seller ? `${naira(o.price)} released to you. ${o.payout && o.payout.status === 'sent' ? 'Sent to your bank.' : hasPayoutAccount ? 'On its way to your bank.' : '<b>Add your bank account</b> so we can send it.'}` : `Complete. ${h(o.seller.name)} has been paid. Enjoy it!`}</div></div>${seller && !hasPayoutAccount ? '<a class="btn btn-primary" href="#/payout">Add your bank account</a>' : ''}`;
    if (o.status === 'refunded') actions = `<div class="card" style="padding:12px 14px"><div class="small" style="line-height:1.5">${h(o.note || 'Refunded.')} ${buyer ? naira(o.total) + ' goes back to how you paid, usually within 5 working days.' : ''}</div></div>`;
    return `${topbar('Order #' + o.id, '/orders')}<main class="pad stack" style="gap:14px">
      ${paidNow === '1' && buyer ? `<div class="card" style="padding:12px 14px;background:#E7F6EC;border-color:#BFE3CB"><b>Payment received.</b> <span class="small">Buja is holding it until you confirm the item arrived.</span></div>` : ''}
      ${paidNow === '0' ? `<div class="card" style="padding:12px 14px;background:#FDECEA;border-color:#F5C2C0"><b>The payment did not go through.</b> <span class="small">Nothing was taken. You can try again from the listing.</span></div>` : ''}
      <a class="card row" href="#/declutter/${o.listing ? o.listing.id : ''}" style="padding:12px;gap:12px">${thumb(o)}<span class="grow"><b>${h(o.listing ? o.listing.title : 'Item')}</b><br><span class="small muted">${buyer ? 'Seller: ' + h(o.seller.name) : 'Buyer: ' + h(o.buyer.name)}</span></span>${badge(o.status)}</a>
      <div class="card stack" style="padding:12px 14px;gap:6px">
        <div class="row small"><span class="grow muted">Item</span><b>${naira(o.price)}</b></div>
        ${buyer ? `<div class="row small"><span class="grow muted">Buyer protection</span><b>${naira(o.fee)}</b></div><div class="row"><span class="grow"><b>You paid</b></span><b>${naira(o.total)}</b></div>` : `<div class="row small"><span class="grow muted">You receive</span><b>${naira(o.price)}</b></div>`}
      </div>
      <div class="card stack" style="padding:12px 14px;gap:10px">${steps.map(([t, at], i) => `<div class="row" style="gap:10px;align-items:flex-start"><span style="width:22px;height:22px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font:800 12px Inter;${at ? 'background:var(--green);color:#101014' : 'background:var(--surface);color:var(--muted)'}">${at ? '✓' : i + 1}</span><span class="grow small"><b style="${at ? '' : 'color:var(--muted)'}">${t}</b>${at ? `<br><span class="muted">${when(at)}</span>` : ''}</span></div>`).join('')}</div>
      ${o.handover === 'delivery' && ['paid', 'shipped'].includes(o.status) && (buyer || seller) ? `<div class="card stack" id="deliv" style="padding:0;gap:0;overflow:hidden"><div id="dmap" style="height:230px;background:var(--surface)"></div><div class="stack" id="dinfo" style="padding:12px 14px;gap:10px"></div></div>` : ''}
      <div class="stack" style="gap:10px" id="acts">${actions}</div>
    </main>`;
  }, {
    mount(el, { id }) {
      if (el.querySelector('#deliv')) deliveryPanel(el, id);
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        const a = b.dataset.act; let note;
        if (a === 'confirm' && !confirm('Confirm you have the item and it is as described? The seller will be paid.')) return;
        if (a === 'cancel' && !confirm('Cancel the sale? The buyer gets a full refund.')) return;
        if (a === 'dispute') { note = prompt('What went wrong? Buja will hold the money while we check.'); if (!note) return; }
        busy(b, true);
        try { await api.escrowAct(id, a, note ? { note } : {}); toast({ confirm: 'The seller has been paid. Thank you!', ship: 'Marked as handed over', dispute: 'Problem reported. Buja is holding the money.', cancel: 'Cancelled. The buyer will be refunded.' }[a]); location.reload(); }
        catch (err) { busy(b, false); failed(el, err); }
      }));
    }
  });

  /* ---------- delivery: the buyer watches the seller bring it; the seller shares their location on the way ---------- */
  async function deliveryPanel(el, id) {
    const info = el.querySelector('#dinfo'); const box = el.querySelector('#dmap');
    let o = (await api.escrowOrder(id)).order; const buyer = o.role === 'buyer';
    const map = await createMap(box, { center: o.drop ? [o.drop.lng, o.drop.lat] : undefined, zoom: 14 });
    if (!map) box.style.display = 'none';
    let watch = null, wake = null, lastSent = 0, lastPos = null, timer = null, fitted = false;
    const gone = () => !document.body.contains(el);
    const clock = (iso) => new Date(String(iso).replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const stop = () => { if (watch != null) { navigator.geolocation.clearWatch(watch); watch = null; } try { wake && wake.release(); } catch {} wake = null; };
    const here = (ms = 9000) => new Promise((res) => { if (!navigator.geolocation) return res(null); let d = false; const f = (v) => { if (!d) { d = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 30000 }); });
    const draw = () => {
      if (!map) return; const T = o.track, L = T && T.live;
      if (o.drop && (!map.has('dest') || draw._at !== o.drop.lat + ',' + o.drop.lng)) { draw._at = o.drop.lat + ',' + o.drop.lng; map.marker('dest', { lng: o.drop.lng, lat: o.drop.lat, z: 2, html: pinHtml({ iconName: 'location-dot', color: '#D92D20' }) }); }
      if (L) {
        if (map.has('c')) map.move('c', L.lng, L.lat, { heading: L.heading, ms: 3500 });
        else map.marker('c', { lng: L.lng, lat: L.lat, z: 4, anchor: 'center', html: buyer ? avatarHtml(null, '#FF7A1A', (o.seller.name || '?').slice(0, 1).toUpperCase()) : carHtml('#FF7A1A', 'box') });
        if (T.route && T.route.length > 1) map.line('r', T.route, { color: '#FF7A1A', width: 5 }); else if (o.drop) map.line('r', [[L.lng, L.lat], [o.drop.lng, o.drop.lat]], { color: '#FF7A1A', width: 4, dashed: true });
        if (o.drop) map.fit([[L.lng, L.lat], [o.drop.lng, o.drop.lat]], { bottom: 40, top: 40, side: 40, ms: fitted ? 900 : 0, maxZoom: 16 }); fitted = true;
      } else { map.remove('c'); map.removeLine('r'); if (o.drop && !fitted) { map.center(o.drop.lng, o.drop.lat, 15); fitted = true; } }
    };
    const render = () => {
      const T = o.track, L = T && T.live, on = T && T.status === 'enroute', arrived = T && T.status === 'arrived';
      const etaLine = L && L.etaMin != null ? `<div style="font-size:26px;font-weight:900;letter-spacing:-.5px">${L.etaMin <= 1 ? 'Arriving now' : L.etaMin + ' min away'}</div><div class="small muted">${L.etaAt ? 'about ' + clock(L.etaAt) + ' · ' : ''}${L.metres >= 1000 ? (L.metres / 1000).toFixed(1) + ' km' : L.metres + ' m'} to go</div>` : '';
      const warn = L && L.lost ? `<div class="small" style="color:#D92D20"><b>No location for ${Math.round(L.age / 60)} min.</b> ${buyer ? 'Their phone may have lost data. Message or call them.' : 'Keep this screen open so the buyer can follow you.'}</div>` : L && L.stopped ? `<div class="small" style="color:var(--orange-dark)"><b>Stopped for ${L.stoppedMin} min.</b> ${buyer ? 'Could be traffic.' : 'The buyer can see you have stopped.'}</div>` : '';
      let html = '';
      if (buyer) {
        if (!o.drop) html = `<div class="small muted">Tell the seller where to bring it, so you can watch it come.</div><button class="btn btn-primary" id="setdrop">Use my location for delivery</button>`;
        else if (arrived) html = `<div style="font-weight:800;font-size:17px">${h(o.seller.name)} has arrived</div><div class="small muted">Check the item before you confirm below.</div>`;
        else if (on) html = `${etaLine || `<div style="font-weight:700">${h(o.seller.name)} is on the way</div>`}${warn}`;
        else html = `<div style="font-weight:700">Delivery to your pin</div><div class="small muted">You will see ${h(o.seller.name)} move on the map when they set off.${o.drop.note ? ' Landmark: ' + h(o.drop.note) : ''}</div><button class="btn btn-outline btn-sm" id="setdrop" style="width:auto">Move the pin to where I am now</button>`;
      } else {
        if (!o.drop) html = `<div class="small muted">The buyer has not set where to deliver yet. Message them, or meet up and hand it over.</div>`;
        else if (on || arrived) html = `${arrived ? `<div style="font-weight:800;font-size:17px">You have arrived</div><div class="small muted">Hand it over, then tap "I have handed it over" below.</div>` : etaLine}${warn}<a class="btn btn-outline" href="https://www.google.com/maps/dir/?api=1&destination=${o.drop.lat},${o.drop.lng}&travelmode=driving" target="_blank" rel="noopener">${icon('route')} Directions in Google Maps</a><div class="small muted" id="sharing">${watch != null ? 'Sharing your location with the buyer' : 'Location not being shared. Keep this screen open.'}</div>`;
        else if (o.status === 'paid') html = `<div style="font-weight:700">Deliver to ${h(o.buyer.name)}</div>${o.drop.note ? `<div class="small">Landmark: ${h(o.drop.note)}</div>` : ''}<button class="btn btn-primary" id="deliver">${icon('car-side')} Start delivery</button><div class="small muted">The buyer sees you move on the map with your arrival time. Keep this screen open while you travel.</div>`;
      }
      info.innerHTML = html;
      info.querySelector('#setdrop')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); const p = await here(); if (!p) { busy(b, false); toast('Turn on location first'); return; } try { o = (await api.escrowAct(id, 'where', p)).order; toast('Delivery spot saved'); fitted = false; draw(); render(); } catch (err) { busy(b, false); failed(el, err); } });
      info.querySelector('#deliver')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); const p = await here(); try { o = (await api.escrowAct(id, 'deliver', p || {})).order; share(); draw(); render(); } catch (err) { busy(b, false); failed(el, err); } });
    };
    const share = async () => {
      if (watch != null || !navigator.geolocation) return; wake = await keepAwake();
      watch = navigator.geolocation.watchPosition(async (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }, now = Date.now();
        if (now - lastSent < 4000 && lastPos && metres(lastPos, pos) < 20) return; lastSent = now; lastPos = pos;
        try { const r = await api.escrowAct(id, 'ping', { ...pos, heading: p.coords.heading != null && !isNaN(p.coords.heading) ? Math.round(p.coords.heading) : null, speed: p.coords.speed }); if (r.stop) stop(); if (!gone()) { o = r.order; draw(); render(); } } catch {}
      }, () => toast('Location is off. The buyer cannot see you.'), { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
    };
    const tick = async () => {
      if (gone()) { stop(); return; }
      if (!document.hidden) { try { const r = await api.escrowOrder(id); if (JSON.stringify(r.order) !== JSON.stringify(o)) { o = r.order; draw(); if (!(document.activeElement && info.contains(document.activeElement))) render(); } } catch {} }
      timer = setTimeout(tick, o.track && o.track.status === 'enroute' ? 3000 : 5000);
    };
    draw(); render();
    if (!buyer && o.track && o.track.status !== 'ended' && o.status === 'paid') share();   // reopened mid-journey
    timer = setTimeout(tick, 4000);
  }

  /* ---------- where sellers get paid ---------- */
  route('/payout', { auth: true, tabs: 'Me' }, async () => {
    const [{ account }, banks] = await Promise.all([api.escrowAccount(), api.escrowBanks().catch(() => ({ banks: [] }))]);
    return `${topbar('Get paid', '/orders?tab=selling')}<main class="pad stack" style="gap:14px">
      ${account ? `<div class="card row" style="padding:12px 14px;gap:10px;background:#E7F6EC;border-color:#BFE3CB">${icon('circle-check')}<span class="grow"><b>${h(account.bank)} ····${h(account.last4)}</b><br><span class="small">${h(account.name)}</span></span></div><div class="section">CHANGE ACCOUNT</div>` : '<div class="small muted" style="line-height:1.5">Money from your Buy safely sales goes into this account. The name must match your bank records.</div>'}
      <div class="field"><label for="bank">Bank</label><select class="input" id="bank"><option value="">Choose your bank</option>${(banks.banks || []).map((b) => `<option value="${h(b.code)}">${h(b.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="number">Account number</label><input class="input" id="number" inputmode="numeric" maxlength="10" placeholder="10 digits" autocomplete="off"></div>
      <div id="who" class="small" style="min-height:18px"></div>
      <button class="btn btn-primary" id="save" disabled>Save account</button>
      <div class="small muted" style="line-height:1.5">${icon('lock')} Buja keeps only the last four digits. The full number is held by Paystack, our payment provider.</div>
    </main>`;
  }, {
    mount(el) {
      const bank = el.querySelector('#bank'), num = el.querySelector('#number'), who = el.querySelector('#who'), save = el.querySelector('#save'); let t;
      const check = () => { save.disabled = true; clearTimeout(t); num.value = num.value.replace(/\D/g, '').slice(0, 10); if (!bank.value || num.value.length !== 10) { who.textContent = ''; return; }
        who.textContent = 'Checking with the bank…'; who.style.color = 'var(--muted)';
        t = setTimeout(async () => { try { const r = await api.escrowAccountCheck(bank.value, num.value); if (r.name) { who.innerHTML = `${icon('circle-check')} <b>${h(r.name)}</b>`; who.style.color = 'var(--green-dark)'; save.disabled = false; } else { who.textContent = 'That number does not match this bank.'; who.style.color = '#D92D20'; } } catch (err) { who.textContent = (err && err.message) || 'Could not check right now.'; who.style.color = '#D92D20'; } }, 400); };
      bank.addEventListener('change', check); num.addEventListener('input', check);
      save.addEventListener('click', async () => { busy(save, true); try { await api.escrowSaveAccount({ bank: bank.value, number: num.value }); toast('Account saved'); location.reload(); } catch (err) { busy(save, false); failed(el, err); } });
    }
  });

  /* ---------- the admin escrow desk ---------- */
  route('/admin/escrow', { auth: true, tabs: '' }, async () => {
    const d = await api.adminEscrow();
    const row = (o, btns) => `<div class="card stack" style="padding:12px 14px;gap:8px"><div class="row" style="gap:10px">${thumb(o)}<span class="grow"><b>#${o.id} ${h(o.listing ? o.listing.title : '')}</b><br><span class="small muted">${h(o.buyer.name)} → ${h(o.seller.name)} · ${naira(o.price)} · paid ${naira(o.total)}</span></span>${badge(o.status)}</div>
      ${o.note ? `<div class="small" style="line-height:1.4">"${h(o.note)}"</div>` : ''}${o.sellerBank ? `<div class="small muted">${icon('building-columns')} ${h(o.sellerBank)}</div>` : o.payout ? '<div class="small" style="color:#D92D20">The seller has not added a bank account yet</div>' : ''}
      ${o.payout && o.payout.error ? `<div class="small muted">Payout: ${h(o.payout.status)} · ${h(o.payout.error)}</div>` : ''}<div class="row" style="gap:8px;flex-wrap:wrap">${btns}</div></div>`;
    const opRow = (o, line, btns) => `<div class="card stack" style="padding:12px 14px;gap:8px"><div><b>${h(o.business)}</b> <span class="small muted">· order #${o.jobId || '?'} · ${h(o.customer)} paid ${naira(o.total)}</span></div><div class="small" style="line-height:1.4">${h(line)}</div>${o.bank ? `<div class="small muted">${icon('building-columns')} ${h(o.bank)}</div>` : '<div class="small" style="color:#D92D20">The business has not added a bank account yet.</div>'}<div class="row" style="gap:8px;flex-wrap:wrap">${btns}</div></div>`;
    return `${topbar('Escrow', '/admin')}<main class="pad stack" style="gap:12px">
      <div class="row" style="gap:10px"><div class="card grow" style="padding:12px 14px"><div class="small muted">Held for buyers</div><div style="font:800 20px Inter">${naira(d.held)}</div></div><div class="card grow" style="padding:12px 14px"><div class="small muted">Owed to sellers</div><div style="font:800 20px Inter">${naira(d.owed)}</div></div></div>
      <div class="small muted">${d.transfersOn ? 'Payouts go out automatically by Paystack transfer.' : 'Automatic payouts are off: pay sellers from your bank app, then tap Mark paid. Set PAYSTACK_TRANSFERS=1 in Render to send them automatically.'}</div>
      <div class="section">PROBLEMS TO DECIDE (${d.disputes.length})</div>
      ${d.disputes.map((o) => row(o, `<button class="btn btn-sm btn-primary" data-a="release" data-id="${o.id}" style="width:auto">Pay the seller</button><button class="btn btn-sm btn-outline" data-a="refund" data-id="${o.id}" style="width:auto">Refund the buyer</button>`)).join('') || '<div class="small muted">None.</div>'}
      <div class="section">PAYOUTS WAITING (${d.payouts.length})</div>
      ${d.payouts.map((o) => row(o, `<button class="btn btn-sm btn-primary" data-a="paid" data-id="${o.id}" style="width:auto">Mark paid</button>${d.transfersOn ? `<button class="btn btn-sm btn-outline" data-a="retry" data-id="${o.id}" style="width:auto">Retry transfer</button>` : ''}`)).join('') || '<div class="small muted">None.</div>'}
      ${d.orders ? `<div class="section">FOOD AND SHOP ORDERS PAID IN THE APP</div>
      <div class="card" style="padding:12px 14px"><div class="small muted">Held for customers</div><div style="font:800 20px Inter">${naira(d.orders.held)}</div></div>
      ${d.orders.disputes.map((o) => opRow(o, 'Problem: ' + (o.note || ''), `<button class="btn btn-sm btn-primary" data-op="release" data-id="${o.id}" style="width:auto">Pay the business</button><button class="btn btn-sm btn-outline" data-op="refund" data-id="${o.id}" style="width:auto">Refund the customer</button>`)).join('')}
      ${d.orders.payouts.map((o) => opRow(o, 'Owed to the business: ' + naira(o.owed) + (o.payoutError ? ' · ' + o.payoutError : ''), `<button class="btn btn-sm btn-primary" data-op="paid" data-id="${o.id}" style="width:auto">Mark paid</button>${d.transfersOn ? `<button class="btn btn-sm btn-outline" data-op="retry" data-id="${o.id}" style="width:auto">Try transfer again</button>` : ''}`)).join('')}
      ${d.orders.recent.length ? `<div class="card list">${d.orders.recent.map((o) => `<a class="item" href="#/jobs/${o.jobId || ''}"><div class="grow"><div class="t">${h(o.customer)} → ${h(o.business)} · ${naira(o.total)}</div><div class="s">${h(o.status)}${o.payout && o.payout !== 'none' ? ' · payout ' + h(o.payout) : ''}</div></div></a>`).join('')}</div>` : '<div class="small muted">No paid orders yet.</div>'}` : ''}
      <div class="section">RECENT</div>
      ${d.recent.map((o) => `<a class="card row" href="#/orders/${o.id}" style="padding:10px 12px;gap:10px"><span class="grow small"><b>#${o.id}</b> ${h(o.listing ? o.listing.title : '')}<br><span class="muted">${h(o.buyer.name)} → ${h(o.seller.name)} · ${naira(o.total)}</span></span>${badge(o.status)}</a>`).join('') || '<div class="small muted">No orders yet.</div>'}
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', async () => {
        const words = { release: 'Pay the business for this order?', refund: 'Refund the customer in full?', paid: 'Confirm you have paid this business from your bank?', retry: 'Try the transfer again?' };
        if (!confirm(words[b.dataset.op])) return; busy(b, true);
        try { await api.adminOrderPayAct(b.dataset.id, b.dataset.op); toast('Done'); location.reload(); } catch (err) { busy(b, false); failed(el, err); }
      }));
      el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
        const words = { release: 'Pay the seller for this order?', refund: 'Refund the buyer in full?', paid: 'Confirm you have paid this seller from your bank?', retry: 'Try the transfer again?' };
        if (!confirm(words[b.dataset.a])) return; busy(b, true);
        try { await api.adminEscrowAct(b.dataset.id, b.dataset.a); toast('Done'); location.reload(); } catch (err) { busy(b, false); failed(el, err); }
      }));
    }
  });
}
