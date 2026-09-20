// Buja Trip Share: tell a friend where you are while you meet someone. Registered by app.js.
export function registerSafety({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon } = ui;
  const when = (iso) => new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const left = (iso) => { const m = Math.round((new Date(iso.replace(' ', 'T') + 'Z') - Date.now()) / 60000); return m <= 0 ? 'overdue by ' + Math.abs(m) + ' min' : m < 60 ? m + ' min left' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min left'; };

  /* ---------- Hub ---------- */
  route('/safety', { auth: true, tabs: 'Me' }, async () => {
    const d = await api.safety();
    const t = d.active;
    return `${topbar('Trip Share', '/me')}
    <main class="pad stack" style="gap:16px">
      ${t ? `<div class="card stack" style="padding:18px;gap:12px;border:2px solid ${t.status === 'overdue' ? '#D92D20' : 'var(--green)'}">
        <div class="row"><span class="tag ${t.status === 'overdue' ? '' : 'green'}" style="${t.status === 'overdue' ? 'background:#D92D20;color:#fff' : ''}">${t.status === 'overdue' ? 'OVERDUE' : 'TRIP RUNNING'}</span><div class="grow"></div><span class="small muted">${left(t.expectedEnd)}</span></div>
        <div><div class="h-md">${h(t.place)}</div><div class="small muted" style="margin-top:2px">${t.with ? 'Meeting ' + h(t.with) + ' · ' : ''}due back ${when(t.expectedEnd)}${t.contact ? ' · ' + h(t.contact) + ' can see you' : ''}</div></div>
        <div style="height:170px;border-radius:14px;overflow:hidden;background:#ECEEE8" id="map"></div>
        <div class="row" style="gap:8px"><button class="btn btn-sm btn-outline" id="share" style="flex:1">${icon('paper-plane')} Send the link</button><button class="btn btn-sm btn-outline" id="extend" style="flex:1">+1 hour</button></div>
        <button class="btn btn-ink" id="safe">${icon('circle-check')} I am home safe</button>
        <button class="btn" id="alarm" style="background:#D92D20;color:#fff">${icon('triangle-exclamation')} Something is wrong</button>
        <div class="small muted" style="line-height:1.5">Your position updates every two minutes while this screen or the app is open. In real danger call 112 first, then hit the red button.</div>
      </div>` : `
      <div class="card stack" style="padding:18px;gap:10px">
        <div class="h-md">Going to meet someone?</div>
        <div class="small muted" style="line-height:1.55">Start a trip and one friend gets a private link showing where you are and when you are due back. They do not need Buja. If you do not end the trip in time, the link tells them.</div>
        <a class="btn btn-primary" href="#/safety/start">${icon('location-dot')} Start a trip</a>
      </div>`}

      <div class="stack" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="section">TRUSTED CONTACTS</span><span class="small muted">${d.contacts.length} of 5</span></div>
        ${d.contacts.length ? `<div class="card list">${d.contacts.map((c) => `<div class="item"><div class="mi">${icon('user')}</div><div class="grow"><div class="t">${h(c.name)}</div><div class="s">${h(c.phone || c.email || '')}</div></div><button class="iconbtn" data-del="${c.id}" aria-label="Remove ${h(c.name)}" style="width:34px;height:34px">${icon('xmark')}</button></div>`).join('')}</div>` : ''}
        <form id="cf" class="card stack" style="padding:14px;gap:10px">
          <div class="h-sm">Add someone you trust</div>
          <div class="row" style="gap:10px">${field({ id: 'name', label: 'Name', placeholder: 'Sister Ada' })}${field({ id: 'phone', label: 'Phone', placeholder: '0803 000 0000' })}</div>
          <button class="btn btn-sm btn-outline" type="submit">Add contact</button>
          <div class="small muted">Buja does not message them for you. You send the link yourself on WhatsApp, which is faster and free.</div>
        </form>
      </div>

      ${d.past.length ? `<div class="stack" style="gap:10px"><div class="section">PAST TRIPS</div><div class="card list">${d.past.map((p) => `<div class="item"><div class="mi">${icon(p.status === 'alarm' ? 'triangle-exclamation' : 'circle-check')}</div><div class="grow"><div class="t">${h(p.place)}</div><div class="s">${when(p.startedAt)}${p.with ? ' · ' + h(p.with) : ''}</div></div><span class="tag ${p.status === 'safe' ? 'green' : ''}" style="${p.status === 'safe' ? '' : 'background:var(--surface);color:var(--ink-3)'}">${p.status}</span></div>`).join('')}</div></div>` : ''}
    </main>`;
  }, {
    mount(el) {
      clearOnInput(el);
      el.querySelector('#cf')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { await api.addContact({ name: el.querySelector('#name').value, phone: el.querySelector('#phone').value }); toast('Contact added'); location.reload(); } catch (err) { busy(btn, false); failed(el, err); } });
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { try { await api.removeContact(b.dataset.del); location.reload(); } catch (err) { failed(el, err); } }));
      const act = async (status, hours) => { try { const r = await api.endTrip({ status, hours }); toast(status === 'safe' ? 'Glad you are back' : status === 'alarm' ? 'Alarm raised. Call 112 if you are in danger.' : 'Another hour added'); if (status === 'extend') location.reload(); else go('/safety'); } catch (err) { failed(el, err); } };
      el.querySelector('#safe')?.addEventListener('click', () => act('safe'));
      el.querySelector('#alarm')?.addEventListener('click', () => { if (confirm('Raise the alarm? Your contact link will show it immediately.')) act('alarm'); });
      el.querySelector('#extend')?.addEventListener('click', () => act('extend', 1));
      el.querySelector('#share')?.addEventListener('click', async () => {
        const d = await api.safety(); if (!d.active) return;
        const msg = `I am meeting someone at ${d.active.place}. If you do not hear from me by ${when(d.active.expectedEnd)}, check this: ${d.active.link}`;
        if (navigator.share) { navigator.share({ title: 'My Buja trip', text: msg }).catch(() => {}); }
        else { navigator.clipboard?.writeText(msg); toast('Message copied. Paste it to your friend.'); }
      });
      drawTrip(el);
    }
  });

  async function drawTrip(el, data) {
    const box = el.querySelector('#map'); if (!box) return;
    const d = data || (await api.safety()).active; if (!d || !d.last) { box.innerHTML = `<div class="placeholder" style="height:100%"><div class="small muted">Waiting for your first position…</div></div>`; return; }
    const ok = await loadLeaflet(); if (!ok) { box.innerHTML = `<div class="placeholder" style="height:100%;padding:16px"><div class="small muted">Last seen at ${d.last.lat.toFixed(4)}, ${d.last.lng.toFixed(4)}</div></div>`; return; }
    box.innerHTML = ''; const map = L.map(box, { zoomControl: false }).setView([d.last.lat, d.last.lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    if (d.track && d.track.length > 1) L.polyline(d.track.map((p) => [p.lat, p.lng]), { color: '#FF7A1A', weight: 5, opacity: .85 }).addTo(map);
    L.circleMarker([d.last.lat, d.last.lng], { radius: 10, color: '#fff', weight: 3, fillColor: d.status === 'alarm' ? '#D92D20' : '#FF7A1A', fillOpacity: 1 }).addTo(map);
    setTimeout(() => map.invalidateSize(), 200);
  }
  let leafletReady = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(true);
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((res) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
      setTimeout(() => res(!!window.L), 6000);
    });
    return leafletReady;
  }

  /* ---------- Start a trip ---------- */
  route('/safety/start', { auth: true, tabs: 'Me' }, async () => {
    const d = await api.safety();
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    return `${topbar('Start a trip', '/safety')}
    <form id="tf" class="pad stack" style="gap:14px">
      ${field({ id: 'place', label: 'Where are you meeting', placeholder: 'Jabi Lake Mall, the cinema side', value: q.get('place') || '' })}
      ${field({ id: 'withName', label: 'Who with (optional)', placeholder: 'Their first name', value: q.get('with') || '' })}
      <div class="field"><label for="hours">Tell my friend to worry after</label><select class="input" id="hours">${[1, 2, 3, 4, 6, 8].map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} hour${n > 1 ? 's' : ''}</option>`).join('')}</select></div>
      <div class="field"><label for="contactId">Who can see the link</label><select class="input" id="contactId"><option value="">Just me for now</option>${d.contacts.map((c) => `<option value="${c.id}">${h(c.name)}</option>`).join('')}</select>${d.contacts.length ? '' : `<div class="hint">You have no trusted contacts yet. You can still start the trip and send the link to anyone.</div>`}</div>
      ${field({ id: 'note', label: 'Anything else (optional)', placeholder: 'His name is Tunde, we met on Buja Match' })}
      <button class="btn btn-primary" type="submit">${icon('location-dot')} Start and share</button>
      <div class="small muted" style="line-height:1.55">Buja asks your phone for your position now and every two minutes while the trip runs. Only the person with your link sees it, and it stops the moment you end the trip.</div>
      <input type="hidden" id="withUserId" value="${h(q.get('user') || '')}">
    </form>`;
  }, {
    mount(el) {
      clearOnInput(el);
      el.querySelector('#tf').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        const body = { place: el.querySelector('#place').value, withName: el.querySelector('#withName').value, hours: +el.querySelector('#hours').value, contactId: el.querySelector('#contactId').value || null, note: el.querySelector('#note').value, withUserId: el.querySelector('#withUserId').value || null };
        const go2 = async () => { try { await api.startTrip(body); toast('Trip started. Send the link now.'); go('/safety'); } catch (err) { busy(btn, false); failed(el, err); } };
        if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { body.lat = p.coords.latitude; body.lng = p.coords.longitude; go2(); }, () => go2(), { enableHighAccuracy: true, timeout: 8000 });
        else go2();
      });
    }
  });

  /* ---------- The friend's page, no sign-in ---------- */
  route('/trip/:token', { guest: true, tabs: '' }, async ({ token }) => {
    let t; try { t = (await api.publicTrip(token)).trip; } catch { return `<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('triangle-exclamation')}</div><div class="h-md">This link is not valid</div><div class="small muted">Ask them to send it again.</div></div>`; }
    const tone = t.status === 'alarm' ? ['#D92D20', 'ALARM RAISED'] : t.status === 'overdue' ? ['#D92D20', 'OVERDUE'] : t.status === 'safe' ? ['#2E7D1E', 'HOME SAFE'] : ['#FF7A1A', 'ON A TRIP'];
    return `
    <header class="topbar"><h1 class="row" style="gap:8px">${icon('shield-halved')} Buja Trip Share</h1></header>
    <main class="pad stack" style="gap:14px">
      <div class="card stack" style="padding:18px;gap:10px;border:2px solid ${tone[0]}">
        <span class="tag" style="background:${tone[0]};color:#fff;align-self:flex-start">${tone[1]}</span>
        <div class="h-lg" style="font-size:22px">${h(t.person)} is at ${h(t.place)}</div>
        <div class="small muted" style="line-height:1.55">${t.with ? 'Meeting ' + h(t.with) + '. ' : ''}Due back ${when(t.expectedEnd)}.${t.note ? ' ' + h(t.note) : ''}</div>
        ${t.status === 'alarm' ? `<div style="padding:12px 14px;background:#FDECEA;color:#D92D20;border-radius:12px;font-size:14px;line-height:1.5"><strong>They pressed the alarm.</strong> Call them now. If you cannot reach them, call the police on 112 and give the last position below.</div>`
        : t.status === 'overdue' ? `<div style="padding:12px 14px;background:#FDECEA;color:#D92D20;border-radius:12px;font-size:14px;line-height:1.5"><strong>They are past their time and have not checked in.</strong> Try calling. This may be nothing, but check.</div>`
        : t.status === 'safe' ? `<div style="padding:12px 14px;background:var(--green-tint);color:var(--green-dark);border-radius:12px;font-size:14px">They marked themselves home safe.</div>` : ''}
      </div>
      <div style="height:300px;border-radius:16px;overflow:hidden;background:#ECEEE8" id="map"></div>
      ${t.last ? `<a class="btn btn-outline" href="https://www.google.com/maps?q=${t.last.lat},${t.last.lng}" target="_blank" rel="noopener">${icon('location-dot')} Open last position in maps</a><div class="small muted center">Last update ${when(t.last.at)}</div>` : `<div class="small muted center">No position shared yet.</div>`}
      <div class="small muted center" style="line-height:1.5;padding-bottom:10px">This page updates by itself. Buja shows only a first name and a position, nothing else about them.</div>
    </main>`;
  }, {
    mount(el, { token }) {
      const paint = async () => { try { const t = (await api.publicTrip(token)).trip; await drawTrip(el, t); } catch {} };
      paint();
      const timer = setInterval(async () => { if (document.hidden) return; try { const t = (await api.publicTrip(token)).trip; if (t.status !== 'active') { location.reload(); return; } await drawTrip(el, t); } catch {} }, 60000);
      window.addEventListener('hashchange', () => clearInterval(timer), { once: true });
    }
  });
}
