// Buja trust and money: Plus, verification, admin. Registered into the app router by app.js.
export function registerTrust({ route, go, state, setState, api, ui, failed }) {
  const { h, toast, topbar, busy, avatar, icon } = ui;
  const naira = (n) => '₦' + Number(n).toLocaleString('en-NG');

  /* ---------- Buja Plus ---------- */
  route('/plus', { auth: true, tabs: 'Me' }, async () => {
    const s = await api.payStatus();
    const paid = new URLSearchParams(location.hash.split('?')[1] || '').get('paid');
    if (paid === '1') { try { const r = await api.me(); setState({ user: r.user }); } catch {} setTimeout(() => toast('Buja Plus is on. Thank you.'), 100); }
    if (paid === '0') setTimeout(() => toast('The payment did not go through.'), 100);
    return `${topbar('Buja Plus', '/me')}
    <main class="pad stack" style="gap:16px">
      <div class="card dark stack" style="padding:20px;gap:12px">
        <div class="row" style="gap:10px"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#7ED957">BUJA PLUS</span><span class="small" style="color:#B5B5BC">${naira(s.plus.price)} for ${s.plus.days} days</span></div>
        ${s.plus.active ? `<div style="font-size:18px;font-weight:700">Active until ${new Date(s.plus.until.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>` : `<div style="font-size:18px;font-weight:700">More of Match, less waiting</div>`}
        <div class="stack" style="gap:8px;font-size:14px">
          ${['See everyone who liked you', 'Five super likes a day instead of one', 'Invisible mode: browse without being seen', 'Support Buja staying independent and ad-free'].map((t) => `<div class="row" style="gap:10px">${icon('circle-check')} ${t}</div>`).join('')}
        </div>
        ${s.plus.active ? `<button class="btn btn-outline" id="buy" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff">Extend by ${s.plus.days} days</button>` : s.configured ? `<button class="btn btn-primary" id="buy">Get Buja Plus · ${naira(s.plus.price)}</button>` : `<div class="small" style="color:#B5B5BC;padding:10px 12px;background:rgba(255,255,255,.08);border-radius:10px">Payments are not switched on yet. Plus arrives with Paystack.</div>`}
        <div class="small" style="color:#8A8A90;text-align:center">Pay with card, bank transfer or USSD via Paystack. No auto-renewal; it simply ends after ${s.plus.days} days.</div>
      </div>
      ${s.payments.length ? `<div class="stack" style="gap:10px"><div class="section">PAYMENTS</div><div class="card list">${s.payments.map((p) => `<div class="item"><div class="grow"><div class="t" style="font-size:14px">${p.purpose === 'plus' ? 'Buja Plus' : p.purpose} · ${naira(p.amount)}</div><div class="s">${p.created_at.slice(0, 10)}</div></div><span class="tag ${p.status === 'paid' ? 'green' : p.status === 'failed' ? '' : 'orange'}" style="${p.status === 'failed' ? 'background:var(--surface);color:var(--ink-3)' : ''}">${p.status}</span></div>`).join('')}</div></div>` : ''}
    </main>`;
  }, { mount(el) { el.querySelector('#buy')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.payPlus(); location.href = r.url; } catch (err) { busy(b, false); failed(el, err); } }); } });

  /* ---------- Verification ---------- */
  route('/verify', { auth: true, tabs: 'Me' }, async () => {
    const v = await api.verifyStatus();
    const block = (title, sub, v, kind, accept, hint) => `<div class="card stack" style="padding:16px;gap:12px">
      <div class="row"><div class="grow"><div class="h-sm">${title}</div><div class="small muted">${sub}</div></div>${v.verified ? `<span class="tag green">${icon('circle-check')} Verified</span>` : v.request?.status === 'pending' ? `<span class="tag orange">In review</span>` : v.request?.status === 'rejected' ? `<span class="tag" style="background:var(--surface);color:var(--ink-3)">Not approved</span>` : ''}</div>
      ${v.request?.status === 'rejected' && v.request.note ? `<div class="small" style="padding:10px 12px;background:var(--orange-tint);color:var(--orange-dark);border-radius:10px">${h(v.request.note)}</div>` : ''}
      ${v.verified ? '' : v.request?.status === 'pending' ? `<div class="small muted">Submitted ${v.request.createdAt.slice(0, 10)}. The Buja team reviews within a day.</div>` : `<label class="btn btn-ink" style="cursor:pointer">${icon('camera')} ${kind === 'selfie' ? 'Take a selfie' : 'Upload the document'}<input type="file" accept="${accept}" ${kind === 'selfie' ? 'capture="user"' : ''} data-verify="${kind}" style="display:none"></label><div class="small muted" style="line-height:1.5">${hint}</div>`}
      <div class="error" data-error="file"></div></div>`;
    return `${topbar('Verification', '/me')}
    <main class="pad stack" style="gap:14px">
      <div class="small muted" style="line-height:1.5">Verification earns the badge people look for before they trust a profile, a landlord or a seller. What you send is seen only by the Buja team and deleted once approved.</div>
      ${block('Selfie', 'Proves your Match photos are you', v.selfie, 'selfie', 'image/*', 'Face the camera in good light. We compare it with your first Match photo and then delete the selfie.')}
      ${v.landlord.applicable ? block('Property ownership', 'Verified landlord badge on every listing', v.landlord, 'landlord', 'image/*,application/pdf', 'A photo or PDF of a title document, C of O, deed of assignment, or a recent tenancy agreement in your name. Cover account numbers.') : ''}
      <div class="card row" style="padding:14px 16px;gap:12px">${icon('circle-check')}<div class="grow small"><div style="font-weight:600">Phone ${state.user.phone ? 'verified' : 'not added'} · Email ${state.user.verified ? 'confirmed' : 'not confirmed'}</div><div class="muted">These are shown on Declutter and Homes as your baseline trust.</div></div></div>
    </main>`;
  }, { mount(el) { el.querySelectorAll('[data-verify]').forEach((i) => i.addEventListener('change', async () => { const f = i.files[0]; if (!f) return; toast('Uploading…'); try { await api.verifySubmit(i.dataset.verify, f); toast('Sent for review'); location.reload(); } catch (err) { failed(el, err); } })); } });

  /* ---------- Admin ---------- */
  const guard = () => state.user.admin ? null : `${topbar('Admin', '/me')}<div class="placeholder"><div class="mi card">${icon('shield-halved')}</div><div class="h-md">Admins only</div></div>`;
  route('/admin', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(); if (g) return g;
    const o = await api.adminOverview();
    const tile = (l, v, c) => `<div class="card" style="padding:12px 14px"><div class="small muted" style="font-weight:600">${l}</div><div style="font-size:24px;font-weight:700;margin-top:2px;color:${c || 'var(--ink)'}">${v}</div></div>`;
    const inDb = Object.values(o.storage.inDb).reduce((a, b) => a + b, 0);
    return `${topbar('Buja admin', '/me')}
    <main class="pad stack" style="gap:14px">
      <div class="section">QUEUES</div>
      <div class="card list">
        <a class="item" href="#/admin/verifications"><div class="mi">${icon('shield-halved')}</div><div class="grow"><div class="t">Verifications</div><div class="s">Selfies and landlord documents</div></div>${o.queues.verifications ? `<span class="tag orange">${o.queues.verifications}</span>` : ''}${icon('chevron-right')}</a>
        <a class="item" href="#/admin/reports"><div class="mi">${icon('triangle-exclamation')}</div><div class="grow"><div class="t">Reports</div><div class="s">Blocked and reported users</div></div>${o.queues.reports ? `<span class="tag orange">${o.queues.reports}</span>` : ''}${icon('chevron-right')}</a>
        <a class="item" href="#/admin/spots"><div class="mi">${icon('wand-magic-sparkles')}</div><div class="grow"><div class="t">Places to verify</div><div class="s">Community-added Ask places</div></div>${o.queues.spots ? `<span class="tag orange">${o.queues.spots}</span>` : ''}${icon('chevron-right')}</a>
      </div>
      <div class="section">BUJA TODAY</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${tile('Users', o.counts.users)}${tile('Plus', o.counts.plus, 'var(--green-dark)')}${tile('Revenue', naira(o.payments.revenue), 'var(--green-dark)')}${tile('Open jobs', o.counts.jobs)}${tile('Applications', o.counts.applications)}${tile('Matches', o.counts.matches)}${tile('Homes', o.counts.properties)}${tile('Listings', o.counts.listings)}${tile('Fare reports', o.counts.fareReports)}${tile('Asks', o.counts.asks)}${tile('Places', o.counts.spots)}</div>
      <div class="section">STORAGE AND PAYMENTS</div>
      <div class="card stack" style="padding:16px;gap:10px">
        <div class="row"><div class="grow"><div style="font-size:14px;font-weight:600">Object storage (R2)</div><div class="small muted">${o.storage.configured ? 'Configured' : 'Not configured; files stay in the database'} · ${inDb} file${inDb === 1 ? '' : 's'} still in the database</div></div>${o.storage.configured ? `<span class="tag green">On</span>` : `<span class="tag" style="background:var(--surface);color:var(--ink-3)">Off</span>`}</div>
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline" id="stest">Test storage</button>${o.storage.configured && inDb ? `<button class="btn btn-sm btn-ink" id="smig">Move 20 files to R2</button>` : ''}</div>
        <div class="small muted" id="sout"></div>
        <div class="row" style="padding-top:8px;border-top:1px solid var(--line)"><div class="grow"><div style="font-size:14px;font-weight:600">Paystack</div><div class="small muted">${o.payments.configured ? `Configured · ${o.payments.paid} paid` : 'Not configured; Plus shows as coming soon'}</div></div>${o.payments.configured ? `<span class="tag green">On</span>` : `<span class="tag" style="background:var(--surface);color:var(--ink-3)">Off</span>`}</div>
      </div>
    </main>`;
  }, { mount(el) { el.querySelector('#stest')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.adminStorageTest(); el.querySelector('#sout').textContent = r.message; } catch (err) { failed(el, err); } busy(e.currentTarget, false); }); el.querySelector('#smig')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.adminMigrate(); el.querySelector('#sout').textContent = `Moved ${r.moved}. ${r.remaining} remaining.`; } catch (err) { failed(el, err); } busy(e.currentTarget, false); }); } });

  route('/admin/verifications', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(); if (g) return g; const { items } = await api.adminVerifications();
    return `${topbar('Verifications', '/admin')}<main class="pad stack" style="gap:12px">${items.length ? items.map((i) => `<div class="card stack" style="padding:14px;gap:10px" data-v="${i.id}">
      <div class="row"><div class="grow"><div class="h-sm">${h(i.user.name)}</div><div class="small muted">${i.kind === 'selfie' ? 'Selfie' : 'Property document'} · ${h(i.user.district || '')} · ${h(i.user.email)} · ${i.createdAt.slice(0, 10)}</div></div></div>
      <div class="row" style="gap:8px">${i.mime === 'application/pdf' ? `<a class="btn btn-sm btn-outline" href="${i.fileUrl}" target="_blank" rel="noopener">${icon('file-arrow-up')} Open PDF</a>` : `<div style="flex:1;aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:var(--surface)"><img src="${i.fileUrl}" alt="Submitted" style="width:100%;height:100%;object-fit:cover"></div>`}${i.comparePhoto ? `<div style="flex:1;aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:var(--surface)"><img src="${i.comparePhoto}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover"></div>` : ''}</div>
      ${i.comparePhoto ? `<div class="small muted">Left: submitted. Right: first Match photo.</div>` : ''}
      <input class="input" data-note placeholder="Note to the user if rejecting (optional)" style="height:44px">
      <div class="row" style="gap:8px"><button class="btn btn-sm btn-ink" data-act="approve" style="flex:1">${icon('circle-check')} Approve</button><button class="btn btn-sm btn-outline" data-act="reject" style="flex:1">Reject</button></div></div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="h-md">Queue is empty</div></div>`}</main>`;
  }, { mount(el) { el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { const card = b.closest('[data-v]'); busy(b, true); try { await api.adminDecide(card.dataset.v, b.dataset.act, card.querySelector('[data-note]').value); card.remove(); toast(b.dataset.act === 'approve' ? 'Approved' : 'Rejected'); } catch (err) { busy(b, false); failed(el, err); } })); } });

  route('/admin/reports', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(); if (g) return g; const { items } = await api.adminReports();
    return `${topbar('Reports', '/admin')}<main class="pad stack" style="gap:12px">${items.length ? items.map((i) => `<div class="card stack" style="padding:14px;gap:10px" data-r="${i.id}"><div class="row"><div class="grow"><div class="h-sm">${h(i.reported.name)}</div><div class="small muted">${h(i.reported.email)} · ${i.reported.totalReports} report${i.reported.totalReports === 1 ? '' : 's'} in total · by ${h(i.reporter)} · ${i.createdAt.slice(0, 10)}</div></div></div><div class="small" style="padding:10px 12px;background:var(--surface);border-radius:10px;line-height:1.5">“${h(i.reason)}”</div><div class="row" style="gap:8px"><button class="btn btn-sm btn-outline" data-act="dismiss" style="flex:1">Dismiss</button><button class="btn btn-sm btn-ink" data-act="suspend" style="flex:1;background:#D92D20">Suspend account</button></div></div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="h-md">No open reports</div></div>`}</main>`;
  }, { mount(el) { el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { if (b.dataset.act === 'suspend' && !confirm('Suspend this account? They are signed out everywhere and their listings are hidden.')) return; const card = b.closest('[data-r]'); busy(b, true); try { await api.adminDecideReport(card.dataset.r, b.dataset.act); card.remove(); toast('Done'); } catch (err) { busy(b, false); failed(el, err); } })); } });

  route('/admin/spots', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(); if (g) return g; const { items } = await api.adminSpots();
    return `${topbar('Places to verify', '/admin')}<main class="pad stack" style="gap:12px">${items.length ? items.map((i) => `<div class="card stack" style="padding:14px;gap:8px" data-s="${i.id}"><div class="h-sm">${h(i.name)}</div><div class="small muted">${i.category} · ${h(i.district)}${i.area ? ' · ' + h(i.area) : ''} · added by ${h(i.addedBy || 'Buja')} · ${i.createdAt.slice(0, 10)}</div><div class="small" style="line-height:1.5">${h(i.description)}</div>${i.tags.length ? `<div class="row" style="flex-wrap:wrap;gap:6px">${i.tags.map((t) => `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(t)}</span>`).join('')}</div>` : ''}<div class="row" style="gap:8px"><button class="btn btn-sm btn-ink" data-act="verify" style="flex:1">${icon('circle-check')} Verify</button><button class="btn btn-sm btn-outline" data-act="remove" style="flex:1">Remove</button></div></div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="h-md">Nothing to verify</div></div>`}</main>`;
  }, { mount(el) { el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { const card = b.closest('[data-s]'); busy(b, true); try { await api.adminDecideSpot(card.dataset.s, b.dataset.act); card.remove(); toast('Done'); } catch (err) { busy(b, false); failed(el, err); } })); } });
}
