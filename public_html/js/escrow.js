// Buy safely (Declutter escrow): my orders, one order's steps, where sellers get paid, and the admin escrow desk.
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
    if (buyer && o.status === 'paid') actions = `<div class="small muted" style="line-height:1.5">Meet ${h(o.seller.name)} and check the item. The seller cannot be paid until you confirm, and you get your money back if it is never handed over.</div><button class="btn btn-primary" data-act="confirm">${icon('circle-check')} I received it, pay the seller</button><button class="btn btn-ghost" data-act="dispute">Report a problem</button>`;
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
      <div class="stack" style="gap:10px" id="acts">${actions}</div>
    </main>`;
  }, {
    mount(el, { id }) {
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
    return `${topbar('Escrow', '/admin')}<main class="pad stack" style="gap:12px">
      <div class="row" style="gap:10px"><div class="card grow" style="padding:12px 14px"><div class="small muted">Held for buyers</div><div style="font:800 20px Inter">${naira(d.held)}</div></div><div class="card grow" style="padding:12px 14px"><div class="small muted">Owed to sellers</div><div style="font:800 20px Inter">${naira(d.owed)}</div></div></div>
      <div class="small muted">${d.transfersOn ? 'Payouts go out automatically by Paystack transfer.' : 'Automatic payouts are off: pay sellers from your bank app, then tap Mark paid. Set PAYSTACK_TRANSFERS=1 in Render to send them automatically.'}</div>
      <div class="section">PROBLEMS TO DECIDE (${d.disputes.length})</div>
      ${d.disputes.map((o) => row(o, `<button class="btn btn-sm btn-primary" data-a="release" data-id="${o.id}" style="width:auto">Pay the seller</button><button class="btn btn-sm btn-outline" data-a="refund" data-id="${o.id}" style="width:auto">Refund the buyer</button>`)).join('') || '<div class="small muted">None.</div>'}
      <div class="section">PAYOUTS WAITING (${d.payouts.length})</div>
      ${d.payouts.map((o) => row(o, `<button class="btn btn-sm btn-primary" data-a="paid" data-id="${o.id}" style="width:auto">Mark paid</button>${d.transfersOn ? `<button class="btn btn-sm btn-outline" data-a="retry" data-id="${o.id}" style="width:auto">Retry transfer</button>` : ''}`)).join('') || '<div class="small muted">None.</div>'}
      <div class="section">RECENT</div>
      ${d.recent.map((o) => `<a class="card row" href="#/orders/${o.id}" style="padding:10px 12px;gap:10px"><span class="grow small"><b>#${o.id}</b> ${h(o.listing ? o.listing.title : '')}<br><span class="muted">${h(o.buyer.name)} → ${h(o.seller.name)} · ${naira(o.total)}</span></span>${badge(o.status)}</a>`).join('') || '<div class="small muted">No orders yet.</div>'}
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
        const words = { release: 'Pay the seller for this order?', refund: 'Refund the buyer in full?', paid: 'Confirm you have paid this seller from your bank?', retry: 'Try the transfer again?' };
        if (!confirm(words[b.dataset.a])) return; busy(b, true);
        try { await api.adminEscrowAct(b.dataset.id, b.dataset.a); toast('Done'); location.reload(); } catch (err) { busy(b, false); failed(el, err); }
      }));
    }
  });
}
