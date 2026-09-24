import { mountAdminPerson } from './engage.js';
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
    if (window.BUJA_ANDROID) return `${topbar('Buja Plus', '/me')}<main class="pad stack" style="gap:16px"><div class="card dark stack" style="padding:20px;gap:12px"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#7ED957">BUJA PLUS</span>
      ${s.plus.active ? `<div style="font-size:18px;font-weight:700">Active until ${new Date(s.plus.until.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div class="small" style="color:#B5B5BC">Everything in Buja Plus works here: who liked you, five super likes a day, invisible mode.</div>` : `<div style="font-size:15px;line-height:1.5">Buja Plus isn't available to buy in this app.</div>`}</div></main>`;
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
  const guard = (adminOnly = false) => (state.user.admin || (!adminOnly && state.user.role === 'moderator')) ? null : `${topbar('Admin', '/me')}<div class="placeholder"><div class="mi card">${icon('shield-halved')}</div><div class="h-md">${adminOnly ? 'Admins only' : 'Admins and moderators only'}</div></div>`;
  const ago = (iso) => { if (!iso) return 'never'; const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 3600 ? Math.max(1, Math.round(d / 60)) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  route('/admin', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(); if (g) return g;
    const o = await api.adminOverview();
    const tile = (l, v, c) => `<div class="card" style="padding:12px 14px"><div class="small muted" style="font-weight:600">${l}</div><div style="font-size:24px;font-weight:700;margin-top:2px;color:${c || 'var(--ink)'}">${v}</div></div>`;
    const inDb = Object.values(o.storage.inDb).reduce((a, b) => a + b, 0);
    return `${topbar(state.user.admin ? 'Buja admin' : 'Moderation', '/me')}
    <main class="pad stack" style="gap:14px">
      ${state.user.admin ? `<div class="section">RUN BUJA</div>
      <a class="card row" href="#/admin/launch" style="padding:14px;gap:12px;border:2px solid var(--orange)"><span style="width:40px;height:40px;border-radius:12px;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center">${icon('circle-check')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:700">Launch checklist</span><span class="small muted">What is switched on, what is not, and the exact next step for each</span></span>${icon('chevron-right')}</a>
      <div class="card list">
        <a class="item" href="#/admin/meetups"><div class="mi">${icon('calendar-days')}</div><div class="grow"><div class="t">Events</div><div class="s">${o.city ? o.city.meetups + ' upcoming' : ''}${o.city && o.city.ticketSales ? ' · ₦' + o.city.ticketSales.toLocaleString() + ' in tickets · Buja earned ₦' + o.city.bujaFees.toLocaleString() : ''}</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/artisans"><div class="mi">${icon('screwdriver-wrench')}</div><div class="grow"><div class="t">Artisans</div><div class="s">${o.city ? o.city.artisans + ' listed, verify the ones you have called' : ''}</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/citizen"><div class="mi">${icon('building-columns')}</div><div class="grow"><div class="t">Citizen reports</div><div class="s">${o.city ? o.city.reports30 + ' in the last 30 days' : ''}</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/social"><div class="mi">${icon('message')}</div><div class="grow"><div class="t">Social posts</div><div class="s">Hide, restore or pin what people post</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/news"><div class="mi">${icon('circle-info')}</div><div class="grow"><div class="t">News feed</div><div class="s">What the papers gave us, and what reads inside Buja</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/broadcast"><div class="mi" style="background:var(--orange-tint);color:var(--orange-dark)">${icon('paper-plane')}</div><div class="grow"><div class="t">Send a notification</div><div class="s">To everyone, a district, learners, or people without notifications on</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/waka-pricing"><div class="mi">${icon('gas-pump')}</div><div class="grow"><div class="t">Waka pricing</div><div class="s">Petrol price that every fare estimate follows</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/learners"><div class="mi">${icon('user')}</div><div class="grow"><div class="t">Learners</div><div class="s">Each person's courses, lessons, scores and certificates</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/learn"><div class="mi">${icon('book-open')}</div><div class="grow"><div class="t">Learn analytics</div><div class="s">Who starts, who finishes, where they stop</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/analytics"><div class="mi">${icon('chart-simple')}</div><div class="grow"><div class="t">Analytics</div><div class="s">Active users, sign-ups, usage by module</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/users"><div class="mi">${icon('users')}</div><div class="grow"><div class="t">Users</div><div class="s">${o.counts.users} accounts · search, roles, suspend</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/admin/invite"><div class="mi">${icon('paper-plane')}</div><div class="grow"><div class="t">Invite a moderator or admin</div><div class="s">By email, with a sign-up link</div></div>${icon('chevron-right')}</a>
      </div>` : ''}
      <div class="section">QUEUES</div>
      <div class="card list">
        <a class="item" href="#/admin/verifications"><div class="mi">${icon('shield-halved')}</div><div class="grow"><div class="t">Verifications</div><div class="s">Selfies and landlord documents</div></div>${o.queues.verifications ? `<span class="tag orange">${o.queues.verifications}</span>` : ''}${icon('chevron-right')}</a>
        <a class="item" href="#/admin/reports"><div class="mi">${icon('triangle-exclamation')}</div><div class="grow"><div class="t">Reports</div><div class="s">Blocked and reported users</div></div>${o.queues.reports ? `<span class="tag orange">${o.queues.reports}</span>` : ''}${icon('chevron-right')}</a>
        <a class="item" href="#/admin/spots"><div class="mi">${icon('wand-magic-sparkles')}</div><div class="grow"><div class="t">Places to verify</div><div class="s">Community-added Ask places</div></div>${o.queues.spots ? `<span class="tag orange">${o.queues.spots}</span>` : ''}${icon('chevron-right')}</a>
      </div>
      ${state.user.admin ? `<div class="section">BUJA TODAY</div>` : ''}
      ${state.user.admin ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${tile('Users', o.counts.users)}${tile('Plus', o.counts.plus, 'var(--green-dark)')}${tile('Revenue', naira(o.payments.revenue), 'var(--green-dark)')}${tile('Open jobs', o.counts.jobs)}${tile('Applications', o.counts.applications)}${tile('Matches', o.counts.matches)}${tile('Homes', o.counts.properties)}${tile('Listings', o.counts.listings)}${tile('Fare reports', o.counts.fareReports)}${tile('Asks', o.counts.asks)}${tile('Places', o.counts.spots)}</div>` : ''}
      ${state.user.admin ? `<div class="section">STORAGE AND PAYMENTS</div>
      <div class="card stack" style="padding:16px;gap:10px">
        <div class="row"><div class="grow"><div style="font-size:14px;font-weight:600">Object storage (R2)</div><div class="small muted">${o.storage.configured ? 'Configured' : 'Not configured; files stay in the database'} · ${inDb} file${inDb === 1 ? '' : 's'} still in the database</div></div>${o.storage.configured ? `<span class="tag green">On</span>` : `<span class="tag" style="background:var(--surface);color:var(--ink-3)">Off</span>`}</div>
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline" id="stest">Test storage</button>${o.storage.configured && inDb ? `<button class="btn btn-sm btn-ink" id="smig">Move 20 files to R2</button>` : ''}</div>
        <div class="small muted" id="sout"></div>
        <div class="row" style="padding-top:8px;border-top:1px solid var(--line)"><div class="grow"><div style="font-size:14px;font-weight:600">Ask Buja</div><div class="small muted">${o.ask.keys.length ? `Using <strong>${o.ask.provider}</strong>${o.ask.keys.length > 1 ? ', falling back to ' + o.ask.keys.filter((k) => k !== o.ask.provider).join(' then ') : ''} · ${o.ask.today} question${o.ask.today === 1 ? '' : 's'} today` : `No AI key set, answering by keyword · ${o.ask.today} question${o.ask.today === 1 ? '' : 's'} today`}</div><div class="small muted">${Object.entries(o.ask.byMode).map(([m, n]) => m + ' ' + n).join(' · ') || 'nothing in the last 7 days'}</div></div>${o.ask.keys.length ? `<span class="tag green">On</span>` : `<span class="tag" style="background:var(--surface);color:var(--ink-3)">Keyword</span>`}</div>
        <div class="row" style="padding-top:8px;border-top:1px solid var(--line)"><div class="grow"><div style="font-size:14px;font-weight:600">Abuja radio streams</div><div class="small muted">Pulls the live stream for every FCT station from Radio Garden</div></div><button class="btn btn-sm btn-ink" id="rsync" style="width:auto">Sync</button></div>
        <div class="small muted" id="rout"></div>
        <div class="row" style="padding-top:8px;border-top:1px solid var(--line)"><div class="grow"><div style="font-size:14px;font-weight:600">Paystack</div><div class="small muted">${o.payments.configured ? `Configured · ${o.payments.paid} paid` : 'Not configured; Plus shows as coming soon'}</div></div>${o.payments.configured ? `<span class="tag green">On</span>` : `<span class="tag" style="background:var(--surface);color:var(--ink-3)">Off</span>`}</div>
      </div>` : ''}
    </main>`;
  }, { mount(el) { el.querySelector('#stest')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.adminStorageTest(); el.querySelector('#sout').textContent = r.message; } catch (err) { failed(el, err); } busy(e.currentTarget, false); }); el.querySelector('#rsync')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.syncRadio(); el.querySelector('#rout').textContent = r.message; toast(r.message); } catch (err) { failed(el, err); } busy(e.currentTarget, false); });
    el.querySelector('#smig')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.adminMigrate(); el.querySelector('#sout').textContent = `Moved ${r.moved}. ${r.remaining} remaining.`; } catch (err) { failed(el, err); } busy(e.currentTarget, false); }); } });

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
    return `${topbar('Reports', '/admin')}<main class="pad stack" style="gap:12px">${items.length ? items.map((i) => `<div class="card stack" style="padding:14px;gap:10px" data-r="${i.id}"><div class="row"><div class="grow"><div class="h-sm">${h(i.reported.name)}</div><div class="small muted">${h(i.reported.email)} · ${i.reported.totalReports} report${i.reported.totalReports === 1 ? '' : 's'} in total · by ${h(i.reporter)} · ${i.createdAt.slice(0, 10)}</div></div></div>${i.target ? `<a class="card row" href="#${i.target.url}" style="padding:10px 12px;gap:10px"><span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(i.kind)}</span><span class="grow" style="font-size:13px;font-weight:600">${h(i.target.title)}</span>${icon('chevron-right')}</a>` : ''}
        <div class="small" style="padding:10px 12px;background:var(--surface);border-radius:10px;line-height:1.5">“${h(i.reason)}”</div>
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline" data-act="dismiss" style="flex:1">Dismiss</button>${i.target ? `<button class="btn btn-sm btn-ink" data-act="hide" style="flex:1">Take it down</button>` : ''}<button class="btn btn-sm btn-ink" data-act="suspend" style="flex:1;background:#D92D20">Suspend</button></div></div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="h-md">No open reports</div></div>`}</main>`;
  }, { mount(el) { el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { if (b.dataset.act === 'suspend' && !confirm('Suspend this account? They are signed out everywhere and their listings are hidden.')) return; const card = b.closest('[data-r]'); busy(b, true); try { await api.adminDecideReport(card.dataset.r, b.dataset.act); card.remove(); toast('Done'); } catch (err) { busy(b, false); failed(el, err); } })); } });

  route('/admin/spots', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(); if (g) return g; const { items } = await api.adminSpots();
    return `${topbar('Places to verify', '/admin')}<div class="pad" style="padding-bottom:0"><div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Fill the directory from OpenStreetMap</div><div class="small muted" style="line-height:1.5">Pulls every named place of a category across the FCT. Real places, real coordinates, marked as unreviewed until somebody rates them. Run each once; running again only adds what is new.</div><div class="row" style="gap:6px;flex-wrap:wrap">${['food', 'lounge', 'nightlife', 'relax', 'shopping', 'kids', 'worship', 'hotel', 'culture', 'services'].map((c) => `<button class="btn btn-sm btn-outline" data-import="${c}" style="width:auto">${c}</button>`).join('')}</div><div class="small" id="importres"></div><div class="row" style="gap:8px;margin-top:4px"><button class="btn btn-sm btn-ink" id="fuelimport" style="width:auto">Import fuel stations</button><span class="small muted">for the Fuel board</span></div></div></div>
    <main class="pad stack" style="gap:12px">${items.length ? items.map((i) => `<div class="card stack" style="padding:14px;gap:8px" data-s="${i.id}"><div class="h-sm">${h(i.name)}</div><div class="small muted">${i.category} · ${h(i.district)}${i.area ? ' · ' + h(i.area) : ''} · added by ${h(i.addedBy || 'Buja')} · ${i.createdAt.slice(0, 10)}</div><div class="small" style="line-height:1.5">${h(i.description)}</div>${i.tags.length ? `<div class="row" style="flex-wrap:wrap;gap:6px">${i.tags.map((t) => `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(t)}</span>`).join('')}</div>` : ''}<div class="row" style="gap:8px"><button class="btn btn-sm btn-ink" data-act="verify" style="flex:1">${icon('circle-check')} Verify</button><button class="btn btn-sm btn-outline" data-act="remove" style="flex:1">Remove</button></div></div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="h-md">Nothing to verify</div></div>`}</main>`;
  }, { mount(el) {
      el.querySelector('#fuelimport')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); el.querySelector('#importres').textContent = 'Asking the map server…'; try { const r = await api.fuelImport(); el.querySelector('#importres').textContent = r.result.error ? 'Map server said: ' + r.result.error : `${r.result.added} new stations (${r.result.seen} found). ${r.total} on the board.`; } catch (err) { el.querySelector('#importres').textContent = (err && err.message) || 'Failed'; } busy(e.currentTarget, false); });
      el.querySelectorAll('[data-import]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); el.querySelector('#importres').textContent = 'Asking the map server, up to 30 seconds…'; try { const r = await api.importSpots(b.dataset.import); el.querySelector('#importres').textContent = r.result.error ? 'Map server said: ' + r.result.error + '. Try again in a minute.' : `${r.result.added} new ${b.dataset.import} places added (${r.result.seen} found). Directory now has ${r.total}.`; } catch (err) { el.querySelector('#importres').textContent = (err && err.message) || 'Failed'; } busy(b, false); }));
       el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { const card = b.closest('[data-s]'); busy(b, true); try { await api.adminDecideSpot(card.dataset.s, b.dataset.act); card.remove(); toast('Done'); } catch (err) { busy(b, false); failed(el, err); } })); } });

  /* ---------- Users ---------- */
  route('/admin/users', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(true); if (g) return g;
    const f = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '').entries());
    const r = await api.adminUsers(f);
    const chip = (k, v) => `<a class="chip ${(f.kind || '') === k ? 'on' : ''}" href="#/admin/users?${new URLSearchParams({ ...f, kind: k, page: 1 })}">${v}</a>`;
    return `${topbar('Users', '/admin')}
    <form id="s" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px">${icon('magnifying-glass')}<label for="uq" style="position:absolute;left:-9999px">Search users</label><input id="uq" name="q" type="search" placeholder="Name, email or phone" value="${h(f.q || '')}" style="flex:1;border:none;background:transparent;outline:none;font-size:14px;color:var(--ink)"></div></form>
    <div class="row" style="gap:8px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none">${chip('', 'All')}${chip('resident', 'Residents')}${chip('company', 'Companies')}${chip('landlord', 'Landlords')}${chip('staff', 'Staff')}${chip('suspended', 'Suspended')}</div>
    <main class="pad stack" style="gap:10px;padding-top:12px"><div class="small muted">${r.total} account${r.total === 1 ? '' : 's'}</div>
      <div class="card list">${r.users.map((u) => `<a class="item" href="#/admin/users/${u.id}" style="gap:12px">${u.avatar ? `<img src="${u.avatar}" alt="" style="width:40px;height:40px;border-radius:20px;object-fit:cover">` : avatar(u.name, 40, '#3E5C76')}<div class="grow" style="min-width:0"><div class="t row" style="gap:6px">${h(u.name)}${u.role !== 'user' ? `<span class="tag orange">${u.role}</span>` : ''}${u.plus ? `<span class="tag green">Plus</span>` : ''}${u.suspended ? `<span class="tag" style="background:#D92D20;color:#fff">Suspended</span>` : ''}</div><div class="s" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.kind} · ${h(u.district || 'no district')} · ${h(u.email)} · seen ${ago(u.lastSeenAt)}</div></div>${icon('chevron-right')}</a>`).join('') || `<div class="item"><div class="s">No accounts match.</div></div>`}</div>
      ${r.total > 30 ? `<div class="row" style="justify-content:space-between">${r.page > 1 ? `<a class="btn btn-sm btn-outline" href="#/admin/users?${new URLSearchParams({ ...f, page: r.page - 1 })}" style="width:auto">Previous</a>` : '<span></span>'}${r.page * 30 < r.total ? `<a class="btn btn-sm btn-outline" href="#/admin/users?${new URLSearchParams({ ...f, page: r.page + 1 })}" style="width:auto">Next</a>` : ''}</div>` : ''}
    </main>`;
  }, { mount(el) { el.querySelector('#s')?.addEventListener('submit', (e) => { e.preventDefault(); const p = new URLSearchParams(location.hash.split('?')[1] || ''); p.set('q', e.target.q.value); p.set('page', '1'); go('/admin/users?' + p); }); } });

  route('/admin/users/:id', { auth: true, tabs: 'Me' }, async ({ id }) => {
    const g = guard(true); if (g) return g;
    const { user: u, activity, sessions } = await api.adminUser(id);
    const act = Object.entries(activity).filter(([k, v]) => v);
    return `${topbar(u.name, '/admin/users')}
    <main class="pad stack" style="gap:14px">
      <div class="card row" style="padding:14px;gap:12px">${u.avatar ? `<img src="${u.avatar}" alt="" style="width:52px;height:52px;border-radius:26px;object-fit:cover">` : avatar(u.name, 52, '#3E5C76')}<div class="grow"><div class="h-sm row" style="gap:6px">${h(u.name)}${u.suspended ? `<span class="tag" style="background:#D92D20;color:#fff">Suspended</span>` : ''}</div><div class="small muted">${u.kind} · ${h(u.district || 'no district')} · joined ${u.createdAt.slice(0, 10)} · seen ${ago(u.lastSeenAt)}</div></div></div>
      <div class="card list">
        <div class="item"><div class="grow"><div class="t" style="font-size:13px">Email</div><div class="s">${h(u.email || '')} ${u.emailVerified ? '· confirmed' : '· not confirmed'}${u.google ? ' · Google' : ''}</div></div></div>
        <div class="item"><div class="grow"><div class="t" style="font-size:13px">Phone</div><div class="s">${h(u.phone || 'none')}</div></div></div>
        <div class="item"><div class="grow"><div class="t" style="font-size:13px">Trust</div><div class="s">${u.selfieVerified ? 'Selfie verified' : 'Not selfie verified'} · ${u.plusUntil && u.plusUntil > new Date().toISOString() ? 'Plus until ' + u.plusUntil.slice(0, 10) : 'Free'} · ${sessions} active session${sessions === 1 ? '' : 's'}</div></div></div>
        ${act.length ? `<div class="item"><div class="grow"><div class="t" style="font-size:13px">Activity</div><div class="s">${act.map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(' · ')}</div></div></div>` : ''}
      </div>
      <div id="learning" class="stack" style="gap:14px"><div class="card small muted" style="padding:14px">Loading learning…</div></div>
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Role</div><div class="seg" id="role">${['user', 'moderator', 'admin'].map((r) => `<button type="button" data-role="${r}" class="${u.role === r ? 'on' : ''}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div><div class="small muted">Moderators work the queues. Admins see everything, including this page.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-outline" data-act="signout" style="flex:1">Sign out everywhere</button>
        ${u.suspended ? `<button class="btn btn-sm btn-ink" data-act="restore" style="flex:1">Restore account</button>` : `<button class="btn btn-sm btn-ink" data-act="suspend" style="flex:1;background:#D92D20">Suspend</button>`}
        <button class="btn btn-sm btn-outline" data-act="delete" style="flex-basis:100%;color:#D92D20;border-color:#D92D20">Delete account and all their data</button>
      </div>
    </main>`;
  }, { mount(el, { id }) {
    mountAdminPerson(el, id, { api, h, icon, toast, busy });
    el.querySelectorAll('#role button').forEach((b) => b.addEventListener('click', async () => { try { await api.adminUserAction(id, { role: b.dataset.role }); el.querySelectorAll('#role button').forEach((x) => x.classList.toggle('on', x === b)); toast('Role updated'); } catch (err) { failed(el, err); } }));
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { const a = b.dataset.act; if ((a === 'suspend' || a === 'delete') && !confirm(a === 'delete' ? 'Delete this account permanently, with their listings, photos, messages and matches? This cannot be undone.' : 'Suspend this account? They are signed out and their listings are hidden.')) return; busy(b, true); try { const r = await api.adminUserAction(id, { action: a }); toast('Done'); if (r.deleted) go('/admin/users'); else location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
  } });

  route('/admin/invite', { auth: true, tabs: 'Me' }, async () => { const g = guard(true); if (g) return g; return `${topbar('Invite', '/admin')}
    <form id="inv" class="pad stack" style="gap:14px"><div class="muted small" style="line-height:1.5">They get an email with a sign-up link that carries the role. If they already have a Buja account, the role is applied straight away.</div>
      <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" placeholder="person@example.com" autocomplete="off"><div class="error" data-error="email"></div></div>
      <div class="field"><label>Role</label><div class="seg" id="irole"><button type="button" data-v="moderator" class="on">Moderator</button><button type="button" data-v="admin">Admin</button></div></div>
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} Send invitation</button>
      <div class="card" id="out" style="padding:12px 14px;display:none;font-size:13px;line-height:1.5;word-break:break-all"></div></form>`; },
    { mount(el) { el.querySelectorAll('#irole button').forEach((b) => b.addEventListener('click', () => el.querySelectorAll('#irole button').forEach((x) => x.classList.toggle('on', x === b)))); el.querySelector('#inv').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { const r = await api.adminInvite(el.querySelector('#email').value, el.querySelector('#irole button.on').dataset.v); const out = el.querySelector('#out'); out.style.display = ''; out.innerHTML = h(r.message) + (r.link ? `<br><strong>Link:</strong> ${h(r.link)}` : ''); toast(r.message); busy(btn, false); } catch (err) { busy(btn, false); failed(el, err); } }); } });

  /* ---------- Analytics ---------- */
  route('/admin/analytics', { auth: true, tabs: 'Me' }, async () => {
    const g = guard(true); if (g) return g;
    const days = +(new URLSearchParams(location.hash.split('?')[1] || '').get('days') || 30);
    const a = await api.adminAnalytics(days);
    const bars = (key, color) => { const max = Math.max(1, ...a.series.map((s) => s[key])); return `<div style="display:flex;align-items:flex-end;gap:2px;height:90px">${a.series.map((s) => `<div title="${s.d}: ${s[key]}" style="flex:1;height:${Math.max(2, s[key] / max * 90)}px;background:${color};border-radius:3px 3px 0 0;opacity:${s[key] ? 1 : .25}"></div>`).join('')}</div><div class="row small muted" style="justify-content:space-between"><span>${a.series[0].d.slice(5)}</span><span>peak ${max}</span><span>${a.series[a.series.length - 1].d.slice(5)}</span></div>`; };
    const mods = Object.entries(a.modules).sort((x, y) => y[1].events - x[1].events);
    return `${topbar('Analytics', '/admin', `<div class="seg" style="height:36px">${[7, 30, 90].map((d) => `<a href="#/admin/analytics?days=${d}" class="${days === d ? 'on' : ''}" style="padding:0 10px;text-decoration:none;display:flex;align-items:center;font-size:12px">${d}d</a>`).join('')}</div>`)}
    <main class="pad stack" style="gap:14px">
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${[['Active today', a.active.today], ['Active 7 days', a.active.week], ['Active 30 days', a.active.month]].map(([l, v]) => `<div class="card" style="padding:12px 14px"><div class="small muted" style="font-weight:600">${l}</div><div style="font-size:24px;font-weight:700">${v}</div></div>`).join('')}</div>
      <div class="card stack" style="padding:14px;gap:8px"><div class="row" style="justify-content:space-between"><span class="h-sm">Active users per day</span><span class="small muted">${a.totalUsers} accounts in total</span></div>${bars('active', 'var(--green)')}</div>
      <div class="card stack" style="padding:14px;gap:8px"><div class="row" style="justify-content:space-between"><span class="h-sm">Sign-ups per day</span><span class="small muted">${a.signupsInRange} in ${a.days} days</span></div>${bars('signups', 'var(--orange)')}</div>
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Usage by module, last ${a.days} days</div>${mods.length ? mods.map(([m, v]) => `<div><div class="row" style="justify-content:space-between;font-size:13px"><strong>${m}</strong><span class="muted">${v.events} actions</span></div><div style="height:6px;border-radius:3px;background:var(--line);margin:4px 0"><div style="width:${Math.round(v.events / mods[0][1].events * 100)}%;height:100%;border-radius:3px;background:var(--ink)"></div></div><div class="small muted">${Object.entries(v.actions).map(([k, x]) => `${k} ${x.events} (${x.users} people)`).join(' · ')}</div></div>`).join('') : `<div class="small muted">No activity recorded yet. Events start counting from this version.</div>`}</div>
      <div class="row" style="gap:8px"><div class="card stack" style="padding:14px;gap:6px;flex:1"><div class="h-sm">Accounts</div>${Object.entries(a.kinds).map(([k, v]) => `<div class="row small" style="justify-content:space-between"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><div class="card stack" style="padding:14px;gap:6px;flex:1"><div class="h-sm">Top districts</div>${a.districts.slice(0, 6).map((d) => `<div class="row small" style="justify-content:space-between"><span>${h(d.district)}</span><strong>${d.users}</strong></div>`).join('') || '<div class="small muted">none yet</div>'}</div></div>
      ${a.revenueByMonth.length ? `<div class="card stack" style="padding:14px;gap:6px"><div class="h-sm">Revenue by month</div>${a.revenueByMonth.map((r) => `<div class="row small" style="justify-content:space-between"><span>${r.month}</span><strong>${naira(r.naira)} · ${r.payments} payment${r.payments === 1 ? '' : 's'}</strong></div>`).join('')}</div>` : ''}
    </main>`;
  });
}

export function registerLaunch({ route, api, ui, failed }) {
  const { h, topbar, icon, toast } = ui;
  route('/admin/launch', { auth: true, tabs: '' }, async () => {
    const d = await api.launch();
    const pct = Math.round(d.score / d.max * 100);
    const tone = pct >= 80 ? 'var(--green-dark)' : pct >= 50 ? 'var(--orange-dark)' : '#D92D20';
    const sorted = [...d.checks].sort((a, b) => (a.ok - b.ok) || (b.weight - a.weight));
    return `${topbar('Launch checklist', '/admin')}
    <main class="pad stack" style="gap:12px">
      <div class="card row" style="padding:16px;gap:16px;align-items:center"><div style="width:72px;height:72px;border-radius:36px;border:6px solid ${tone};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:${tone}">${pct}%</div><div class="grow"><div class="h-md">${pct >= 80 ? 'Ready to invite people' : pct >= 50 ? 'Nearly there' : 'Not ready yet'}</div><div class="small muted">${d.people.users} accounts, ${d.people.active7} active this week. ${sorted.filter((c) => !c.ok).length} thing${sorted.filter((c) => !c.ok).length === 1 ? '' : 's'} to do, most important first.</div></div></div>
      ${sorted.map((c) => `<div class="card stack" style="padding:14px;gap:6px;${c.ok ? 'opacity:.75' : (c.weight === 3 ? 'border-color:#D92D20' : 'border-color:var(--orange)')}">
        <div class="row" style="gap:10px"><span style="color:${c.ok ? 'var(--green-dark)' : (c.weight === 3 ? '#D92D20' : 'var(--orange-dark)')};flex-shrink:0">${icon(c.ok ? 'circle-check' : 'triangle-exclamation')}</span><span style="font-size:14px;font-weight:700" class="grow">${h(c.title)}</span>${!c.ok && c.weight === 3 ? '<span class="tag" style="background:#FDECEA;color:#D92D20">Blocks launch</span>' : ''}</div>
        <div class="small" style="color:var(--ink-2);line-height:1.5">${h(c.detail)}</div>
        ${c.ok ? '' : `<div class="small" style="line-height:1.5;padding:8px 10px;background:var(--surface);border-radius:10px"><strong>Do this:</strong> ${h(c.fix)}</div>`}
      </div>`).join('')}
      <div class="card stack" style="padding:14px;gap:8px"><div class="h-sm">The three URLs a scheduler should call</div>
        ${[['Every 10 minutes', d.urls.ping], ['Every hour', d.urls.tidy], ['Weekly, Monday 07:00', d.urls.digest]].map(([w, u]) => `<div><div class="small muted">${w}</div><div class="row" style="gap:6px"><code style="font-size:11px;word-break:break-all;flex:1">${h(u)}</code><button class="btn btn-sm btn-outline" data-copy="${h(u)}" style="width:auto;height:30px;font-size:11px">Copy</button></div></div>`).join('')}
        <div class="small muted" style="line-height:1.5">Replace YOUR_ADMIN_KEY with the value in Render. cron-job.org is free and does all three.</div>
      </div>
    </main>`;
  }, { mount(el) { el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => { navigator.clipboard?.writeText(b.dataset.copy); toast('Copied'); })); } });
}
