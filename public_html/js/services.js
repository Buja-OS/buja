// Buja city services: Meetup, Artisans, Citizen Report. Registered by app.js.
export function registerCityServices({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon, attachmentHtml, linkify } = ui;
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const when = (iso) => new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const day = (iso) => new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const naira = (n) => n ? '₦' + Number(n).toLocaleString() : 'Free';
  const rating = (r) => window.bujaRating ? window.bujaRating(r) : '';
  const tel = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');
  const wa = (p) => 'https://wa.me/' + String(p).replace(/^0/, '234').replace(/[^\d]/g, '');
  async function shrink(f, max = 1400) { const b = await createImageBitmap(f).catch(() => null); if (!b) return f; const s = Math.min(1, max / Math.max(b.width, b.height)); const c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); const bl = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); return new File([bl], 'photo.jpg', { type: 'image/jpeg' }); }
  function here(ms = 4000) { if (!navigator.geolocation) return Promise.resolve(null); return new Promise((res) => { let d = false; const f = (v) => { if (!d) { d = true; res(v); } }; setTimeout(() => f(null), ms); navigator.geolocation.getCurrentPosition((p) => f({ lat: p.coords.latitude, lng: p.coords.longitude }), () => f(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 120000 }); }); }

  /* =============================== MEETUP =============================== */
  const CATICON = { tech: 'bolt', business: 'briefcase', party: 'star', faith: 'building-columns', sport: 'route', arts: 'camera', food: 'tags', learning: 'circle-info', community: 'users', family: 'house-chimney', celebration: 'heart', other: 'calendar-days' };
  function eventCard(e) {
    return `<a class="card" href="#/meetup/${e.id}" style="overflow:hidden;display:block;${e.status === 'cancelled' ? 'opacity:.55' : ''}">
      ${e.cover ? `<div style="height:140px;background:url('${e.cover}') center/cover"></div>` : `<div style="height:84px;background:linear-gradient(135deg,#1B1B1F,#2A2F3A);display:flex;align-items:center;padding:0 16px;color:#7ED957;gap:10px;font-size:22px">${icon(CATICON[e.category] || 'calendar-days')}<span style="font-size:12px;letter-spacing:2px;font-weight:700;color:#B5B5BC">${h(e.categoryLabel.toUpperCase())}</span></div>`}
      <div class="stack" style="padding:14px;gap:8px">
        <div class="row" style="gap:10px;align-items:flex-start"><div style="min-width:48px;text-align:center;background:var(--orange-tint);border-radius:12px;padding:6px 4px"><div style="font-size:11px;font-weight:700;color:var(--orange-dark);letter-spacing:1px">${new Date(e.startsAt.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</div><div style="font-size:20px;font-weight:800;line-height:1;color:var(--ink)">${new Date(e.startsAt.replace(' ', 'T') + 'Z').getDate()}</div></div>
          <div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700;line-height:1.3">${h(e.title)}</div><div class="small muted" style="margin-top:3px">${when(e.startsAt)} · ${h(e.venue)}${e.online ? ' · online' : ''}</div></div></div>
        <div class="row small" style="gap:10px"><span class="tag ${e.price ? '' : 'green'}" style="${e.price ? 'background:var(--surface);color:var(--ink-2)' : ''}">${naira(e.price)}</span><span class="muted">${e.going} going${e.capacity ? ' of ' + e.capacity : ''}${e.full ? ' · full' : ''}</span><span class="grow"></span>${e.my && e.my.status === 'going' ? `<span class="tag green">${icon('circle-check')} You are going</span>` : e.my && e.my.status === 'waitlist' ? `<span class="tag" style="background:var(--surface)">Waitlisted</span>` : ''}</div>
      </div></a>`;
  }
  route('/meetup', { auth: true, tabs: '' }, async () => {
    const f = Object.fromEntries(q().entries()); f.when = f.when || 'upcoming';
    const { events, categories } = await api.events(f);
    const tabs = [['upcoming', 'Upcoming'], ['weekend', 'This weekend'], ['mine', 'Going'], ['hosting', 'Hosting']];
    return `${topbar('Meetup', '/home', `<a class="iconbtn" href="#/meetup/new" aria-label="Create an event" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <div class="row" style="gap:8px;padding:2px 16px 0;overflow-x:auto;scrollbar-width:none">${tabs.map(([k, l]) => `<a class="chip ${f.when === k ? 'on' : ''}" href="#/meetup?${new URLSearchParams({ ...f, when: k })}">${l}</a>`).join('')}</div>
    <div class="row" style="gap:8px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none"><a class="chip ${!f.category ? 'on' : ''}" href="#/meetup?${new URLSearchParams({ ...f, category: '' })}">All</a>${Object.entries(categories).map(([k, l]) => `<a class="chip ${f.category === k ? 'on' : ''}" href="#/meetup?${new URLSearchParams({ ...f, category: k })}">${h(l)}</a>`).join('')}</div>
    <main class="pad stack" style="gap:12px;padding-top:12px">
      ${events.length ? events.map(eventCard).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('calendar-days')}</div><div class="h-md">${f.when === 'hosting' ? 'You are not hosting anything' : f.when === 'mine' ? 'Nothing on your list yet' : 'Nothing listed yet'}</div><div class="small muted" style="max-width:290px;line-height:1.55">Meetups, launches, concerts, owambe, hangouts, classes. Anyone in Abuja can post one and people register to attend.</div><a class="btn btn-ink" href="#/meetup/new" style="width:auto">Post an event</a></div>`}
    </main>`;
  });

  route('/meetup/new', { auth: true, tabs: '' }, async () => {
    const { categories } = await api.events({ when: 'hosting' });
    return `${topbar('Post an event', '/meetup')}
    <form id="ef" class="pad stack" style="gap:14px">
      ${field({ id: 'title', label: 'Event name', placeholder: 'Abuja Tech Meetup, September edition' })}
      <div class="field"><label for="category">Category</label><select class="input" id="category">${Object.entries(categories).map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('')}</select></div>
      <div class="row" style="gap:10px"><div class="field grow"><label for="date">Date</label><input class="input" id="date" type="date"></div><div class="field grow"><label for="time">Starts</label><input class="input" id="time" type="time"></div></div>
      <div class="field"><label for="endtime">Ends (optional)</label><input class="input" id="endtime" type="time"></div>
      ${field({ id: 'venue', label: 'Venue', placeholder: 'Ventures Platform, Jabi' })}
      <div class="field"><label for="district">District</label><select class="input" id="district"><option value="">Choose</option>${DISTRICTS.map((d) => `<option ${d === state.user.district ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      ${field({ id: 'onlineUrl', label: 'Online link (optional)', placeholder: 'https://meet.google.com/…' , hint: 'Shown only to people who register.' })}
      <div class="row" style="gap:10px">${field({ id: 'capacity', label: 'Spaces (optional)', type: 'number', placeholder: '50', inputmode: 'numeric' })}${field({ id: 'price', label: 'Ticket ₦ (0 = free)', type: 'number', placeholder: '0', inputmode: 'numeric' })}</div>
      <div class="field"><label for="repeat">Repeats</label><select class="input" id="repeat"><option value="none">One-off</option><option value="weekly">Every week</option><option value="fortnightly">Every two weeks</option><option value="monthly">Every month</option></select><div class="hint">Buja creates the next eight dates for you. Cancel one or the whole series later.</div></div>
      <div class="small muted" id="feehint" style="line-height:1.5"></div>
      <div class="field"><label for="description">What to expect</label><textarea class="input" id="description" maxlength="4000" placeholder="Who it is for, what will happen, what to bring, dress code" style="height:130px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="description"></div></div>
      <div class="row" style="gap:8px;align-items:center"><label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} Cover photo<input type="file" accept="image/*" id="cover" style="display:none"></label><span class="small muted" id="covername"></span></div>
      <button class="btn btn-primary" type="submit">${icon('calendar-days')} Publish</button>
      <div class="small muted" style="line-height:1.5">Buja lists it, people register, you see who is coming and can message them all. For paid events, collect payment yourself at the door or by transfer; Buja does not take a cut.</div>
    </form>`;
  }, {
    mount(el) {
      clearOnInput(el); let coverId = null;
      el.querySelector('#price').addEventListener('input', (e) => { const p = +e.target.value || 0; el.querySelector('#feehint').textContent = p > 0 ? `Buja keeps 5% + ₦100 per ticket (₦${Math.round(p * 0.05) + 100} on ₦${p.toLocaleString()}). You get ₦${(p - Math.round(p * 0.05) - 100).toLocaleString()} per ticket, paid after the event.` : ''; });
      el.querySelector('#cover').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; el.querySelector('#covername').textContent = 'Uploading…'; try { const up = await api.upload(await shrink(f, 1600), 'image'); coverId = up.upload.id; el.querySelector('#covername').textContent = 'Cover ready'; } catch (err) { el.querySelector('#covername').textContent = ''; failed(el, err); } });
      el.querySelector('#ef').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        const d = el.querySelector('#date').value, t = el.querySelector('#time').value, et = el.querySelector('#endtime').value;
        const startsAt = d && t ? new Date(d + 'T' + t).toISOString() : '';
        const endsAt = d && et ? new Date(d + 'T' + et).toISOString() : '';
        const body = { title: el.querySelector('#title').value, category: el.querySelector('#category').value, startsAt, endsAt, venue: el.querySelector('#venue').value, district: el.querySelector('#district').value, onlineUrl: el.querySelector('#onlineUrl').value, capacity: el.querySelector('#capacity').value, price: el.querySelector('#price').value, description: el.querySelector('#description').value, coverUploadId: coverId, repeat: el.querySelector('#repeat').value };
        try { const r = await api.createEvent(body); toast('Published'); go('/meetup/' + r.event.id); } catch (err) { busy(btn, false); failed(el, err); }
      });
    }
  });

  route('/meetup/:id', { auth: true, tabs: '' }, async ({ id }) => {
    if (id === 'new') return '';
    const { event: e } = await api.event(id);
    const going = e.my && e.my.status === 'going', waiting = e.my && e.my.status === 'waitlist';
    return `${topbar('', '/meetup', `<button class="iconbtn" id="share" aria-label="Share">${icon('paper-plane')}</button>`)}
    ${e.cover ? `<div style="height:190px;background:url('${e.cover}') center/cover;margin:0 16px;border-radius:18px"></div>` : ''}
    <main class="pad stack" style="gap:14px">
      ${e.status === 'cancelled' ? `<div style="padding:12px 14px;background:#FDECEA;color:#D92D20;border-radius:12px;font-size:14px;font-weight:600">This event was cancelled by the host.</div>` : ''}
      <div><span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(e.categoryLabel)}</span><div class="h-lg" style="font-size:24px;line-height:1.25;margin-top:8px">${h(e.title)}</div></div>
      <div class="card stack" style="padding:14px;gap:10px">
        <div class="row" style="gap:12px">${icon('calendar-days')}<div><div style="font-size:14px;font-weight:650">${when(e.startsAt)}</div>${e.endsAt ? `<div class="small muted">until ${new Date(e.endsAt.replace(' ', 'T') + 'Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}</div><span class="grow"></span><a class="btn btn-sm btn-outline" href="/api/events/${e.id}/ics" style="width:auto;height:32px;font-size:12px">Add to calendar</a></div>
        <div class="row" style="gap:12px">${icon('location-dot')}<div><div style="font-size:14px;font-weight:650">${h(e.venue)}</div><div class="small muted">${h(e.district)}${e.lat ? ` · <a href="https://www.google.com/maps?q=${e.lat},${e.lng}" target="_blank" rel="noopener" style="color:var(--orange-dark)">map</a>` : ''}</div></div></div>
        ${e.onlineUrl ? `<div class="row" style="gap:12px">${icon('video')}<a href="${h(e.onlineUrl)}" target="_blank" rel="noopener" style="color:var(--orange-dark);font-weight:600;font-size:14px;word-break:break-all">Join online</a></div>` : e.online ? `<div class="row small muted" style="gap:12px">${icon('video')} Online. The link appears once you register.</div>` : ''}
        <div class="row" style="gap:12px">${icon('ticket')}<div style="font-size:14px;font-weight:650">${naira(e.price)}</div><span class="grow"></span><span class="small muted">${e.going} going${e.capacity ? ' of ' + e.capacity : ''}${e.waitlist ? ' · ' + e.waitlist + ' waiting' : ''}</span></div>
      </div>
      ${e.isHost ? `<div class="row" style="gap:8px"><a class="btn btn-sm btn-ink grow" href="#/meetup/${e.id}/attendees">${icon('users')} Who is coming (${e.going})</a>${e.status !== 'cancelled' ? `<button class="btn btn-sm btn-outline" id="cancel" style="width:auto;color:#D92D20">Cancel event</button>` : ''}</div>`
      : e.status === 'cancelled' ? '' : going ? `<div class="row" style="gap:8px"><div class="btn btn-sm grow" style="background:var(--green-tint);color:var(--green-dark);border:none">${icon('circle-check')} You are going${e.my.guests ? ' +' + e.my.guests : ''}</div><button class="btn btn-sm btn-outline" id="unrsvp" style="width:auto">Can't make it</button></div>`
      : waiting ? `<div class="row" style="gap:8px"><div class="btn btn-sm grow" style="background:var(--surface);border:none">On the waitlist</div><button class="btn btn-sm btn-outline" id="unrsvp" style="width:auto">Leave</button></div>`
      : e.price > 0 ? `<div class="card row" style="padding:12px;gap:10px"><div class="field" style="margin:0;width:110px"><label for="qty" class="small">Tickets</label><select class="input" id="qty" style="height:40px">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></div><button class="btn btn-primary grow" id="buy" ${e.full ? 'disabled' : ''}>${icon('ticket')} ${e.full ? 'Sold out' : 'Buy · ' + naira(e.price)}</button></div>`
      : `<div class="card row" style="padding:12px;gap:10px"><div class="field" style="margin:0;width:110px"><label for="guests" class="small">Bringing</label><select class="input" id="guests" style="height:40px">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n === 0 ? 'Just me' : '+' + n}</option>`).join('')}</select></div><button class="btn btn-primary grow" id="rsvp">${icon('ticket')} ${e.full ? 'Join the waitlist' : 'I am going'}</button></div>`}
      ${e.myTicket ? `<div class="card" style="padding:0;overflow:hidden;border:2px dashed var(--orange)"><div style="background:var(--night);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;letter-spacing:2px;font-weight:700;color:#7ED957">YOUR TICKET</span><span class="small" style="color:#B5B5BC">${e.myTicket.qty} ${e.myTicket.qty === 1 ? 'person' : 'people'}</span></div><div style="padding:18px 16px;text-align:center"><div style="font-size:34px;font-weight:800;letter-spacing:6px;font-family:ui-monospace,monospace">${h(e.myTicket.code)}</div><div class="small muted" style="margin-top:6px">${e.myTicket.status === 'used' ? 'Already checked in' : 'Show this at the door. One use only.'}</div></div></div>` : ''}
      ${e.isHost && e.price > 0 ? `<div class="row" style="gap:8px"><a class="btn btn-sm btn-outline grow" href="#/meetup/${e.id}/door">${icon('ticket')} Door scanner</a><a class="btn btn-sm btn-outline grow" href="#/meetup/${e.id}/sales">${icon('naira-sign')} Sales</a></div>` : ''}
      ${e.repeat !== 'none' ? `<div class="small muted row" style="gap:6px">${icon('calendar-days')} Repeats ${h(e.repeat)}. ${e.isHost ? 'Cancelling can remove the rest of the series too.' : ''}</div>` : ''}
      <div class="card row" style="padding:12px 14px;gap:12px">${e.host.photo ? `<img src="${e.host.photo}" alt="" style="width:40px;height:40px;border-radius:12px;object-fit:cover">` : avatar(e.host.name, 40, '#1B1B1F')}<div class="grow"><div style="font-size:14px;font-weight:650">Hosted by ${h(e.host.name)}</div><div class="small">${rating(e.host.rating)}</div></div>${!e.isHost ? `<button class="btn btn-sm btn-outline" id="msghost" style="width:auto">Message</button>` : ''}</div>
      <div><div class="section">ABOUT</div><p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:var(--ink-2);white-space:pre-line">${linkify(h(e.description))}</p></div>
      ${e.attendees.length ? `<div><div class="section">GOING (${e.going})</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${e.attendees.slice(0, 24).map((a) => a.avatar ? `<img src="${a.avatar}" alt="${h(a.name)}" title="${h(a.name)}" style="width:34px;height:34px;border-radius:17px;object-fit:cover">` : avatar(a.name, 34, '#2A2F3A')).join('')}${e.attendees.length > 24 ? `<span class="small muted" style="align-self:center">+${e.attendees.length - 24}</span>` : ''}</div></div>` : ''}
      <div><div class="section">DISCUSSION</div>
        <div class="stack" style="gap:8px;margin-top:8px" id="posts">${e.posts.length ? e.posts.map((p) => `<div class="card stack" style="padding:12px 14px;gap:4px;${p.update ? 'border-color:var(--orange)' : ''}"><div class="row small"><strong>${h(p.by)}</strong>${p.update ? `<span class="tag" style="background:var(--orange-tint);color:var(--orange-dark);margin-left:8px">Host update</span>` : ''}<span class="grow"></span><span class="muted">${when(p.at)}</span></div><div style="font-size:14px;line-height:1.5;white-space:pre-line">${linkify(h(p.body))}</div></div>`).join('') : `<div class="small muted">No comments yet. Ask the host anything.</div>`}</div>
        <form id="pf" class="row" style="gap:8px;margin-top:10px"><input class="input" id="pbody" placeholder="${e.isHost ? 'Post an update to everyone going' : 'Ask a question'}" style="flex:1;height:44px"><button class="iconbtn" type="submit" style="background:var(--orange);border-color:var(--orange);color:#fff;width:44px;height:44px">${icon('paper-plane')}</button></form>
      </div>
    </main>`;
  }, {
    mount(el, { id }) {
      if (id === 'new') return;
      const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); location.reload(); } catch (err) { failed(el, err); } };
      el.querySelector('#rsvp')?.addEventListener('click', (e) => { busy(e.currentTarget, true); act(() => api.rsvpEvent(id, { going: true, guests: +el.querySelector('#guests').value }), 'You are on the list'); });
      el.querySelector('#unrsvp')?.addEventListener('click', () => act(() => api.rsvpEvent(id, { going: false }), 'Removed'));
      el.querySelector('#cancel')?.addEventListener('click', async () => { const { event: e } = await api.event(id); const series = e.repeat !== 'none' && confirm('This event repeats. Cancel the whole series from here on? Cancel = just this one.'); if (confirm('Cancel? Everyone registered will be told.')) act(() => api.cancelEventSeries(id, series), 'Cancelled'); });
      el.querySelector('#buy')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.buyTicket(id, +el.querySelector('#qty').value); if (r.mock) { toast('Test payment done'); location.reload(); } else location.href = r.url; } catch (err) { busy(e.currentTarget, false); failed(el, err); } });
      el.querySelector('#pf')?.addEventListener('submit', (e) => { e.preventDefault(); const v = el.querySelector('#pbody').value.trim(); if (!v) return; act(() => api.eventPost(id, v)); });
      el.querySelector('#msghost')?.addEventListener('click', async () => { try { const { event: e } = await api.event(id); const r = await api.artisanChat(e.host.id).catch(() => null); if (r) go('/inbox/' + r.threadId); else toast('Message the host through the discussion below.'); } catch (err) { failed(el, err); } });
      el.querySelector('#share')?.addEventListener('click', async () => { const { event: e } = await api.event(id); const t = `${e.title} · ${when(e.startsAt)} · ${e.venue}. Register on Buja: ${location.origin}/#/meetup/${e.id}`; if (navigator.share) navigator.share({ title: e.title, text: t }).catch(() => {}); else { navigator.clipboard?.writeText(t); toast('Copied'); } });
    }
  });

  route('/meetup/:id/attendees', { auth: true, tabs: '' }, async ({ id }) => {
    const { event: e } = await api.event(id);
    if (!e.isHost) return `${topbar('Attendees', '/meetup/' + id)}<div class="placeholder"><div class="small muted">Only the host sees the full list.</div></div>`;
    return `${topbar('Who is coming', '/meetup/' + id)}
    <main class="pad stack" style="gap:10px">
      <div class="small muted">${e.going} going${e.capacity ? ' of ' + e.capacity : ''}${e.waitlist ? ' · ' + e.waitlist + ' on the waitlist' : ''}. Tap a name at the door to check them in.</div>
      <div class="card list">${e.attendees.map((a) => `<div class="item"><div class="mi">${a.avatar ? `<img src="${a.avatar}" alt="" style="width:100%;height:100%;border-radius:10px;object-fit:cover">` : icon('user')}</div><div class="grow"><div class="t">${h(a.name)}${a.guests ? ` <span class="small muted">+${a.guests}</span>` : ''}</div></div><button class="btn btn-sm btn-outline" data-in="${a.id}" style="width:auto;height:32px;font-size:12px">Check in</button></div>`).join('') || `<div class="small muted" style="padding:14px">Nobody yet.</div>`}</div>
    </main>`;
  }, { mount(el, { id }) { el.querySelectorAll('[data-in]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { await api.checkinEvent(id, b.dataset.in); b.outerHTML = `<span class="tag green">${icon('circle-check')} In</span>`; } catch (err) { busy(b, false); failed(el, err); } })); } });

  route('/meetup/:id/door', { auth: true, tabs: '' }, async ({ id }) => `${topbar('Door', '/meetup/' + id)}
    <main class="pad stack" style="gap:14px">
      <div class="card stack" style="padding:18px;gap:12px"><div class="h-md">Type the ticket code</div><input class="input" id="code" placeholder="ABCD1234" autocapitalize="characters" autocomplete="off" style="font-size:24px;letter-spacing:5px;text-align:center;height:60px;font-family:ui-monospace,monospace"><button class="btn btn-primary" id="check">${icon('ticket')} Check</button><div id="res" style="min-height:52px"></div></div>
      <div class="small muted" style="line-height:1.5">Each code works once. Ask the guest to show the ticket screen; the code is the big letters.</div>
    </main>`, {
    mount(el, { id }) {
      const run = async () => { const r = await api.scanTicket(id, el.querySelector('#code').value).catch((e) => e); const ok = r && r.ok; el.querySelector('#res').innerHTML = `<div style="padding:14px;border-radius:12px;background:${ok ? 'var(--green-tint)' : '#FDECEA'};color:${ok ? 'var(--green-dark)' : '#D92D20'};font-size:15px;font-weight:700;text-align:center">${h((r && r.message) || 'Could not check')}</div>`; if (ok) { el.querySelector('#code').value = ''; if (navigator.vibrate) navigator.vibrate(120); } };
      el.querySelector('#check').addEventListener('click', run);
      el.querySelector('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    }
  });
  route('/meetup/:id/sales', { auth: true, tabs: '' }, async ({ id }) => {
    const { sales: s } = await api.eventSales(id);
    return `${topbar('Sales', '/meetup/' + id)}
    <main class="pad stack" style="gap:12px">
      <div class="grid2">${[['Tickets sold', s.tickets], ['Orders', s.orders], ['Money in', naira(s.gross)], ['Checked in', s.checkedIn]].map(([l, v]) => `<div class="card" style="padding:14px"><div class="small muted">${l}</div><div style="font-size:24px;font-weight:800;margin-top:2px">${v}</div></div>`).join('')}</div>
      <div class="card stack" style="padding:16px;gap:6px"><div class="row" style="justify-content:space-between"><span class="small muted">Buja fee (5% + ₦100 a ticket)</span><span style="font-weight:600">${naira(s.fee)}</span></div><div class="row" style="justify-content:space-between;font-size:18px;font-weight:800"><span>You are owed</span><span style="color:var(--green-dark)">${naira(s.payout)}</span></div></div>
      <div class="small muted" style="line-height:1.55">Paid to you by bank transfer within three working days after the event. Buja will message you for your account details the first time.</div>
    </main>`;
  });

  /* =============================== ARTISANS =============================== */
  const TRADEICON = { mechanic: 'car', vulcanizer: 'car', towing: 'car', electrician: 'bolt', plumber: 'house-chimney', mason: 'house-chimney', carpenter: 'screwdriver-wrench', painter: 'screwdriver-wrench', tiler: 'house-chimney', welder: 'screwdriver-wrench', ac: 'bolt', generator: 'bolt', solar: 'bolt', cctv: 'camera', dstv: 'camera', phone: 'phone', laptop: 'display', carwash: 'car', laundry: 'tags', cleaning: 'house-chimney', errand: 'route', cook: 'tags', hair: 'user', tailor: 'tags', gardener: 'house-chimney', pest: 'house-chimney', locksmith: 'shield-halved', movers: 'bus' };
  function artisanCard(a) {
    return `<a class="card row" href="#/artisans/${a.id}" style="padding:12px;gap:12px;align-items:flex-start">
      ${a.photo ? `<img src="${a.photo}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;flex-shrink:0">` : `<div style="width:56px;height:56px;border-radius:14px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">${icon(TRADEICON[a.trade] || 'screwdriver-wrench')}</div>`}
      <div class="grow" style="min-width:0">
        <div class="row" style="gap:6px"><span style="font-size:15px;font-weight:700">${h(a.name)}</span>${a.bujaVerified ? `<span class="tag green" style="font-size:10px;padding:2px 6px">Buja verified</span>` : a.verified ? icon('circle-check') : ''}</div>
        <div class="small muted">${h(a.tradeLabel)} · ${h(a.district)}${a.years ? ' · ' + a.years + ' yrs' : ''}</div>
        <div class="row small" style="gap:8px;margin-top:4px">${rating(a.rating)}${a.km != null ? `<strong style="color:var(--green-dark)">${a.km < 1 ? 'under 1 km' : a.km + ' km'} away</strong>` : ''}</div>
      </div>
      <div class="stack" style="gap:6px"><button type="button" class="iconbtn" data-call="${h(tel(a.phone))}" aria-label="Call" style="background:var(--green);border-color:var(--green);color:#101014;width:38px;height:38px">${icon('phone')}</button><button type="button" class="iconbtn" data-wa="${h(wa(a.whatsapp))}" aria-label="WhatsApp" style="width:38px;height:38px;color:#25D366">${icon('whatsapp')}</button></div></a>`;
  }
  route('/artisans', { auth: true, tabs: '' }, async () => {
    const f = Object.fromEntries(q().entries());
    const at = f.lat ? { lat: +f.lat, lng: +f.lng } : await here(3500);
    const { artisans, trades } = await api.artisans({ ...f, lat: at ? at.lat : '', lng: at ? at.lng : '' });
    return `${topbar('Artisans', '/home', `<a class="iconbtn" href="#/artisans/map${f.trade ? '?trade=' + encodeURIComponent(f.trade) : ''}" aria-label="See them on the map" style="margin-right:6px">${icon('map-location-dot')}</a><a class="iconbtn" href="#/artisans/register" aria-label="List yourself" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <form id="af" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px">${icon('magnifying-glass')}<input id="aq" name="q" type="search" value="${h(f.q || '')}" placeholder="Mechanic, plumber, DStv installer" style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div></form>
    <div class="row" style="gap:8px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none"><a class="chip ${!f.trade ? 'on' : ''}" href="#/artisans?${new URLSearchParams({ ...f, trade: '' })}">All</a>${Object.entries(trades).map(([k, l]) => `<a class="chip ${f.trade === k ? 'on' : ''}" href="#/artisans?${new URLSearchParams({ ...f, trade: k })}">${h(l)}</a>`).join('')}</div>
    <main class="pad stack" style="gap:10px;padding-top:12px">
      <div class="small muted row" style="gap:6px">${icon('location-dot')} ${at ? 'Nearest to where you are now' : 'Turn on location to sort by distance'}</div>
      ${artisans.length ? artisans.map(artisanCard).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('screwdriver-wrench')}</div><div class="h-md">No one listed for that yet</div><div class="small muted" style="max-width:290px;line-height:1.55">Mechanics, plumbers, electricians, installers, laundries and errand people list themselves here so you can find the nearest one when you are stuck. Know a good one? Tell them to register.</div><a class="btn btn-ink" href="#/artisans/register" style="width:auto">List yourself</a></div>`}
    </main>`;
  }, { mount(el) {
    el.querySelector('#af').addEventListener('submit', (e) => { e.preventDefault(); const p = q(); p.set('q', e.target.q.value); go('/artisans?' + p); });
    el.querySelectorAll('[data-call]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); location.href = b.dataset.call; }));
    el.querySelectorAll('[data-wa]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.open(b.dataset.wa, '_blank', 'noopener'); }));
  } });

  // /artisans/register now lives in servicejobs.js: the full mechanic registration with a map pin.
  route('/artisans/:id', { auth: true, tabs: '' }, async ({ id }) => {
    if (id === 'register') return '';
    const { artisan: a } = await api.artisan(id);
    return `${topbar(a.tradeLabel, '/artisans')}
    <main class="pad stack" style="gap:14px">
      <div class="card row" style="padding:16px;gap:14px">${a.photo ? `<img src="${a.photo}" alt="" style="width:72px;height:72px;border-radius:18px;object-fit:cover">` : `<div style="width:72px;height:72px;border-radius:18px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;font-size:26px">${icon(TRADEICON[a.trade] || 'screwdriver-wrench')}</div>`}
        <div class="grow"><div class="row" style="gap:6px"><span class="h-md">${h(a.name)}</span>${a.verified ? `<span class="tag green">${icon('circle-check')} Verified</span>` : ''}</div><div class="small muted">${a.person && a.person !== a.name ? h(a.person) + ' · ' : ''}${h(a.district)} · travels up to ${a.radiusKm} km${a.years ? ' · ' + a.years + ' years' : ''}</div><div class="small" style="margin-top:4px"><a href="#/people/${a.id}">${rating(a.rating)}</a>${a.km != null ? ` · <strong style="color:var(--green-dark)">${a.km < 1 ? 'under 1 km' : a.km + ' km'} from you</strong>` : ''}</div></div></div>
      ${!a.available ? `<div style="padding:10px 14px;background:var(--surface);border-radius:12px;font-size:13px;color:var(--ink-2)">Marked as not available right now. You can still call.</div>` : ''}
      <div class="row" style="gap:8px">
        <a class="btn btn-primary grow" href="${tel(a.phone)}" style="background:var(--green);color:#101014">${icon('phone')} Call</a>
        <a class="btn btn-outline grow" href="${wa(a.whatsapp)}" target="_blank" rel="noopener" style="color:#128C7E">${icon('whatsapp')} WhatsApp</a>
      </div>
      <div class="row" style="gap:8px"><button class="btn btn-outline grow" id="msg">${icon('message')} Message in Buja</button><button class="btn btn-outline grow" id="bcall">${icon('video')} Buja call</button></div>
      ${a.about ? `<div><div class="section">ABOUT</div><p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:var(--ink-2);white-space:pre-line">${h(a.about)}</p></div>` : ''}
      ${a.lat ? `<a class="btn btn-outline" href="https://www.google.com/maps?q=${a.lat},${a.lng}" target="_blank" rel="noopener">${icon('location-dot')} Where the shop is</a>` : ''}
      <div class="card stack" style="padding:14px;gap:6px"><div class="h-sm">Before you pay</div><div class="small muted" style="line-height:1.55">Agree the price before work starts. Pay when the job is done. If something goes wrong, rate them here so the next person knows. ${a.rating.count ? '' : 'Nobody has rated this person on Buja yet.'}</div></div>
      <div class="small muted">${a.jobs} people have contacted them through Buja.</div>
    </main>`;
  }, {
    mount(el, { id }) {
      if (id === 'register') return;
      const open = async () => { const r = await api.artisanChat(id); return r.threadId; };
      el.querySelector('#msg')?.addEventListener('click', async () => { try { go('/inbox/' + (await open())); } catch (err) { failed(el, err); } });
      el.querySelector('#bcall')?.addEventListener('click', async () => { try { const t = await open(); const r = await api.startCall(t, 'audio'); go('/rtc/' + r.call.room); } catch (err) { failed(el, err); } });
    }
  });

  /* =============================== CITIZEN REPORT =============================== */
  route('/report', { auth: true, tabs: '' }, async () => {
    const cat = q().get('category') || '';
    const { agencies, categories, checked } = await api.agencies(cat);
    return `${topbar('Report to the city', '/home', `<a class="iconbtn" href="#/report/mine" aria-label="My reports">${icon('file-arrow-up')}</a>`)}
    <main class="pad stack" style="gap:12px">
      <a class="card row" href="${tel('112')}" style="padding:14px;gap:12px;background:#D92D20;color:#fff;border-color:#D92D20"><span style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800">112</span><span class="grow"><span style="display:block;font-size:15px;font-weight:700">Emergency? Call 112 now</span><span class="small" style="opacity:.85">Free on every network. Police, fire, ambulance, disaster.</span></span>${icon('phone')}</a>
      <div class="field" style="margin:0"><label for="cat">What do you want to report?</label><select class="input" id="cat"><option value="">Choose the problem</option>${Object.entries(categories).map(([k, l]) => `<option value="${k}" ${cat === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
      ${cat ? `<div class="small muted">${agencies.length} ${agencies.length === 1 ? 'body handles' : 'bodies handle'} this.</div>` : `<div class="small muted">Pick a problem and Buja shows exactly who handles it in Abuja, with numbers checked on ${h(checked)}.</div>`}
      ${agencies.map((a) => `<div class="card stack" style="padding:14px;gap:10px;${a.tier === 3 ? 'opacity:.85' : ''}">
        <div class="row" style="gap:10px"><span style="width:40px;height:40px;border-radius:12px;background:var(--surface);color:var(--ink-2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;text-align:center;line-height:1.1">${h(a.short)}</span><div class="grow"><div style="font-size:14px;font-weight:700">${h(a.name)}</div><div class="small muted">${a.tier === 1 ? "Verified on the agency's own website" : a.tier === 2 ? 'Official, confirm before relying on it' : 'No reliable phone published'}</div></div></div>
        <div class="small" style="line-height:1.5;color:var(--ink-2)">${h(a.note)}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${a.phones.map((p) => `<a class="btn btn-sm" href="${tel(p)}" style="width:auto;height:36px;background:var(--green);color:#101014;border:none">${icon('phone')} ${h(p)}</a>`).join('')}${(a.whatsapp || []).map((p) => `<a class="btn btn-sm btn-outline" href="${wa(p)}" target="_blank" rel="noopener" style="width:auto;height:36px;color:#128C7E">${icon('whatsapp')} WhatsApp</a>`).join('')}${a.emails.map((m) => `<a class="btn btn-sm btn-outline" href="mailto:${h(m)}?subject=${encodeURIComponent('Report from a resident, ' + (state.user.district || 'Abuja'))}" style="width:auto;height:36px">${icon('paper-plane')} Email</a>`).join('')}${a.web ? `<a class="btn btn-sm btn-outline" href="${h(a.web)}" target="_blank" rel="noopener" style="width:auto;height:36px">Website</a>` : ''}</div>
        <a class="btn btn-sm btn-ink" href="#/report/write?agency=${a.id}&category=${cat || a.cats[0]}">${icon('file-arrow-up')} Write it up and keep a record</a>
      </div>`).join('')}
      <div class="small muted" style="line-height:1.5;padding-bottom:6px">Buja does not stand between you and the agency; the call or email goes straight to them. We keep a copy of what you wrote, with a reference number, so you can follow up. Numbers change; if one fails, tell us with the report button.</div>
    </main>`;
  }, { mount(el) { el.querySelector('#cat').addEventListener('change', (e) => go('/report?category=' + e.target.value)); } });

  route('/report/write', { auth: true, tabs: '' }, async () => {
    const p = q(); const { agencies, categories } = await api.agencies('');
    const a = agencies.find((x) => x.id === p.get('agency')) || agencies[0];
    return `${topbar('Write your report', '/report?category=' + (p.get('category') || ''))}
    <form id="wf" class="pad stack" style="gap:14px">
      <div class="card row" style="padding:12px 14px;gap:10px"><span class="tag" style="background:var(--surface)">${h(a.short)}</span><span class="small">${h(a.name)}</span></div>
      <div class="field"><label for="category">Problem</label><select class="input" id="category">${Object.entries(categories).map(([k, l]) => `<option value="${k}" ${p.get('category') === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="body">What happened, where, and when</label><textarea class="input" id="body" maxlength="2000" placeholder="Refuse has been piling at the junction of 3rd Avenue and 21 Road, Gwarinpa, for two weeks. It blocks the drain when it rains." style="height:150px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="body"></div></div>
      <div class="row" style="gap:8px;align-items:center"><label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} Add a photo<input type="file" accept="image/*" id="pic" style="display:none"></label><span class="small muted" id="picname"></span></div>
      <button type="button" class="btn btn-outline" id="pin">${icon('location-dot')} <span>Attach my location</span></button>
      <div class="field"><label>Then send it by</label><div class="row" style="gap:8px;flex-wrap:wrap" id="chan">${[a.phones.length ? ['call', 'Phone call', icon('phone')] : null, a.emails.length ? ['email', 'Email', icon('paper-plane')] : null, (a.whatsapp || []).length ? ['whatsapp', 'WhatsApp', icon('whatsapp')] : null, a.web ? ['web', 'Their website', icon('circle-info')] : null].filter(Boolean).map(([k, l, ic], i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-c="${k}">${ic} ${l}</button>`).join('')}</div></div>
      <button class="btn btn-primary" type="submit">${icon('file-arrow-up')} Save and send</button>
      <div class="small muted" style="line-height:1.5">Buja saves your report with a reference number, then opens the phone, email or WhatsApp with your text ready. What you write is not published anywhere.</div>
    </form>`;
  }, {
    mount(el) {
      clearOnInput(el); const p = q(); let pos = null, picId = null, chan = el.querySelector('#chan .chip')?.dataset.c || 'call';
      el.querySelectorAll('#chan .chip').forEach((b) => b.addEventListener('click', () => { chan = b.dataset.c; el.querySelectorAll('#chan .chip').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelector('#pin').addEventListener('click', async (e) => { busy(e.currentTarget, true); pos = await here(10000); busy(e.currentTarget, false); e.currentTarget.querySelector('span').textContent = pos ? 'Location attached' : 'Could not get location'; if (pos) e.currentTarget.classList.add('btn-ink'); });
      el.querySelector('#pic').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; el.querySelector('#picname').textContent = 'Uploading…'; try { const up = await api.upload(await shrink(f), 'image'); picId = up.upload.id; el.querySelector('#picname').textContent = 'Photo attached'; } catch (err) { failed(el, err); } });
      el.querySelector('#wf').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        const body = el.querySelector('#body').value;
        try {
          const { agencies } = await api.agencies(''); const a = agencies.find((x) => x.id === p.get('agency')) || agencies[0];
          const r = await api.citizenReport({ agency: a.id, category: el.querySelector('#category').value, body, channel: chan, uploadId: picId, lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined, district: state.user.district });
          const text = `${body}\n\n${pos ? 'Location: https://www.google.com/maps?q=' + pos.lat.toFixed(5) + ',' + pos.lng.toFixed(5) + '\n' : ''}Reported via Buja, ref ${r.report.ref}.`;
          toast('Saved as ' + r.report.ref);
          if (chan === 'call' && a.phones[0]) location.href = tel(a.phones[0]);
          else if (chan === 'email' && a.emails[0]) location.href = 'mailto:' + a.emails[0] + '?subject=' + encodeURIComponent((el.querySelector('#category').selectedOptions[0].text) + ' in ' + (state.user.district || 'Abuja') + ', ref ' + r.report.ref) + '&body=' + encodeURIComponent(text);
          else if (chan === 'whatsapp' && a.whatsapp && a.whatsapp[0]) window.open(wa(a.whatsapp[0]) + '?text=' + encodeURIComponent(text), '_blank');
          else if (a.web) window.open(a.web, '_blank');
          setTimeout(() => go('/report/mine'), 800);
        } catch (err) { busy(btn, false); failed(el, err); }
      });
    }
  });

  route('/report/mine', { auth: true, tabs: '' }, async () => {
    const { reports } = await api.myReports();
    return `${topbar('My reports', '/report')}
    <main class="pad stack" style="gap:10px">
      ${reports.length ? reports.map((r) => `<div class="card stack" style="padding:14px;gap:6px"><div class="row small"><span class="tag" style="background:var(--surface)">${h(r.ref)}</span><span class="grow"></span><span class="muted">${when(r.at)}</span></div><div style="font-size:14px;font-weight:650">${h(r.category)} · ${h(r.agency)}</div><div class="small" style="color:var(--ink-2);line-height:1.5">${h(r.body)}</div>${r.attachment ? attachmentHtml(r.attachment, { max: 200 }) : ''}<div class="small muted">Sent by ${h(r.channel)}. Quote the reference if you follow up.</div></div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="small muted">Nothing reported yet.</div></div>`}
    </main>`;
  });

  /* =============================== MY TICKETS =============================== */
  route('/tickets', { auth: true, tabs: 'Me' }, async () => {
    const { tickets } = await api.myTickets();
    return `${topbar('My tickets', '/me')}
    <main class="pad stack" style="gap:12px">
      ${tickets.length ? tickets.map((t) => `<a class="card" href="#/meetup/${t.eventId}" style="padding:0;overflow:hidden;display:block;border:2px dashed ${t.status === 'used' ? 'var(--line)' : 'var(--orange)'}"><div style="background:var(--night);color:#fff;padding:10px 14px;display:flex;justify-content:space-between"><span style="font-size:13px;font-weight:700">${h(t.title)}</span><span class="small" style="color:#B5B5BC">${t.qty} ${t.qty === 1 ? 'person' : 'people'}</span></div><div style="padding:14px;display:flex;align-items:center;gap:14px"><div style="font-size:26px;font-weight:800;letter-spacing:4px;font-family:ui-monospace,monospace">${h(t.code)}</div><div class="grow small muted">${when(t.startsAt)}<br>${h(t.venue)}</div>${t.status === 'used' ? `<span class="tag">Used</span>` : ''}</div></a>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('ticket')}</div><div class="h-md">No tickets yet</div><div class="small muted">Paid events you register for show up here, with the code you show at the door.</div><a class="btn btn-ink" href="#/meetup" style="width:auto">Browse events</a></div>`}
    </main>`;
  });

  /* =============================== ADMIN: the new modules =============================== */
  route('/admin/meetups', { auth: true, tabs: '' }, async () => {
    const { items } = await api.adminMeetups();
    return `${topbar('Events', '/admin')}<main class="pad stack" style="gap:10px">${items.length ? items.map((m) => `<div class="card stack" style="padding:12px 14px;gap:8px;${m.hidden ? 'opacity:.6' : ''}"><div class="row" style="gap:8px"><a class="grow" href="#/meetup/${m.id}" style="font-size:14px;font-weight:650">${h(m.title)}</a>${m.status === 'cancelled' ? '<span class="tag">Cancelled</span>' : m.hidden ? '<span class="tag">Hidden</span>' : ''}</div><div class="small muted">${h(m.host)} · ${when(m.startsAt)} · ${h(m.district)} · ${m.going} going${m.price ? ' · ' + naira(m.price) + ' · ' + m.tickets + ' tickets · owed ' + naira(m.sales) : ''}</div><div class="row" style="gap:6px"><button class="btn btn-sm btn-outline" data-act="${m.hidden ? 'show' : 'hide'}" data-id="${m.id}" style="width:auto">${m.hidden ? 'Show' : 'Hide'}</button>${m.status !== 'cancelled' ? `<button class="btn btn-sm btn-outline" data-act="cancel" data-id="${m.id}" style="width:auto;color:#D92D20">Cancel</button>` : ''}<a class="btn btn-sm btn-outline" href="#/admin/users/${m.hostId}" style="width:auto">Host</a></div></div>`).join('') : '<div class="small muted">Nothing upcoming.</div>'}</main>`;
  }, { mount(el) { el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { if (b.dataset.act === 'cancel' && !confirm('Cancel this event and tell everyone?')) return; try { await api.adminMeetup(b.dataset.id, b.dataset.act); location.reload(); } catch (err) { failed(el, err); } })); } });

  route('/admin/artisans', { auth: true, tabs: '' }, async () => {
    const { items, bySource } = await api.adminArtisans();
    const pending = items.filter((a) => a.pending), rest = items.filter((a) => !a.pending);
    const card = (a) => `<div class="card stack" style="padding:12px 14px;gap:10px;${a.hidden ? 'opacity:.6' : ''}${a.pending ? 'border-color:var(--orange)' : ''}">
      <div class="row" style="gap:10px"><div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${h(a.name)}</div><div class="small muted">${h(a.trade)} · ${h(a.person || '')}${a.source ? ' · from ' + h(a.source) : ''}</div></div>
        ${a.verified ? '<span class="tag green">Verified</span>' : a.pending ? '<span class="tag" style="background:var(--orange-tint)">Waiting for you</span>' : '<span class="tag">No ID sent</span>'}${a.hidden ? '<span class="tag">Hidden</span>' : ''}</div>
      ${a.photo || a.idPhoto ? `<div class="row" style="gap:10px">${a.photo ? `<figure style="margin:0"><img src="${h(a.photo)}" alt="" style="width:110px;height:110px;object-fit:cover;border-radius:12px"><figcaption class="small muted">Face</figcaption></figure>` : ''}${a.idPhoto ? `<figure style="margin:0"><a href="${h(a.idPhoto)}" target="_blank" rel="noopener"><img src="${h(a.idPhoto)}" alt="" style="width:170px;height:110px;object-fit:cover;border-radius:12px"></a><figcaption class="small muted">ID (tap to enlarge)</figcaption></figure>` : ''}</div>` : ''}
      ${a.pending ? `<div class="small muted">Verify when the face matches the ID and the name on the ID matches the owner.</div>` : ''}
      <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn btn-sm btn-outline" href="#/artisans/${a.id}" style="width:auto">Profile</a>
        <button class="btn btn-sm ${a.verified ? 'btn-outline' : 'btn-primary'}" data-act="${a.verified ? 'unverify' : 'verify'}" data-id="${a.id}" style="width:auto">${a.verified ? 'Remove badge' : 'Verify'}</button>
        <button class="btn btn-sm btn-outline" data-act="${a.hidden ? 'show' : 'hide'}" data-id="${a.id}" style="width:auto">${a.hidden ? 'Show' : 'Hide'}</button></div></div>`;
    return `${topbar('Artisans', '/admin')}<main class="pad stack" style="gap:10px">
      <div class="kpis">${[['Listed', items.length], ['Waiting for a check', pending.length], ['Verified', items.filter((a) => a.verified).length], ['Hidden', items.filter((a) => a.hidden).length]].map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      ${bySource && bySource.length ? `<div class="card stack" style="padding:12px 14px;gap:6px"><div class="h-sm">Where they signed up</div>${bySource.map((s) => `<div class="row small" style="justify-content:space-between"><span>${h(s.source === 'app' ? 'In the app' : s.source === 'web' ? 'Recruiting page' : s.source.charAt(0).toUpperCase() + s.source.slice(1) + ' flyer')}</span><strong>${s.n}</strong></div>`).join('')}<div class="small muted">Print a flyer for a village: <a href="/p/mechanics/flyer?src=apo" target="_blank">Apo</a> · <a href="/p/mechanics/flyer?src=kugbo" target="_blank">Kugbo</a>. Any word after src= makes a new one, e.g. src=mabushi.</div></div>` : ''}
      ${pending.length ? `<div class="section">WAITING FOR A CHECK</div>${pending.map(card).join('')}` : ''}
      <div class="section">EVERYONE</div>${rest.length ? rest.map(card).join('') : '<div class="small muted">No artisans yet.</div>'}
    </main>`;
  }, { mount(el) { el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { await api.adminArtisan(b.dataset.id, b.dataset.act); toast(b.dataset.act === 'verify' ? 'Verified' : 'Done'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } })); } });

  route('/admin/citizen', { auth: true, tabs: '' }, async () => {
    const d = await api.adminCitizen();
    return `${topbar('Citizen reports', '/admin')}<main class="pad stack" style="gap:12px">
      <div class="card stack" style="padding:14px;gap:6px"><div class="h-sm">Last 30 days, by problem</div>${d.byCategory.length ? d.byCategory.map((c) => `<div class="row small" style="justify-content:space-between"><span>${h(c.category)}</span><strong>${c.n}</strong></div>`).join('') : '<div class="small muted">Nothing yet.</div>'}</div>
      <div class="section">RECENT</div>
      ${d.recent.map((r) => `<div class="card stack" style="padding:12px 14px;gap:4px"><div class="row small"><span class="tag" style="background:var(--surface)">${h(r.ref)}</span><span class="grow"></span><span class="muted">${h(r.by)} · ${when(r.at)}</span></div><div style="font-size:14px;font-weight:650">${h(r.category)} → ${h(r.agency)}</div><div class="small" style="color:var(--ink-2)">${h(r.body)}</div><div class="small muted">${h(r.district || '')} · by ${h(r.channel)}</div></div>`).join('') || '<div class="small muted">No reports yet.</div>'}
      <div class="small muted" style="line-height:1.5">These are copies residents kept for themselves; the report went straight to the agency. Useful for spotting a district with a recurring problem and for knowing which agencies people actually reach for.</div>
    </main>`;
  });
}
