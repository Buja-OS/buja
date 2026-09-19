// Buja messages, interviews and push. Registered into the app router by app.js.
export function registerMessages({ route, go, state, setState, api, ui, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon } = ui;
  const when = (iso) => { const d = new Date(iso.replace(' ', 'T') + 'Z'); const now = new Date(); const same = d.toDateString() === now.toDateString(); return same ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const pretty = (at) => new Date(at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const colors = ['#1F4E9C', '#2E7D1E', '#8E44AD', '#C0392B', '#0E7C86', '#E8620E'];
  const color = (s) => colors[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];

  /* ---------- Inbox ---------- */
  route('/inbox', { auth: true, tabs: 'Inbox' }, async () => {
    const { threads } = await api.inbox();
    return `
    ${topbar('Inbox', '')}
    <main class="pad stack" style="gap:10px">
      ${threads.length ? `<div class="card list">${threads.map((t) => `<a class="item" href="#/inbox/${t.id}" style="gap:12px">${avatar(t.title, 48, color(t.title))}<div class="grow" style="min-width:0"><div class="row" style="justify-content:space-between"><span class="t" style="font-weight:${t.unread ? 700 : 600}">${h(t.title)}</span><span class="small ${t.unread ? '' : 'muted'}" style="${t.unread ? 'color:var(--orange-dark);font-weight:600' : ''}">${when(t.lastAt)}</span></div><div class="s" style="${t.unread ? 'color:var(--ink);font-weight:500' : ''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(t.preview)}</div>${t.subtitle ? `<div class="s" style="font-size:11px">${h(t.subtitle)}</div>` : ''}</div>${t.unread ? `<span style="min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--orange);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${t.unread}</span>` : ''}</a>`).join('')}</div>`
      : `<div class="placeholder" style="padding:60px 0"><div class="mi card">${icon('message')}</div><div class="h-md">No conversations yet</div><div class="small muted" style="max-width:280px;line-height:1.5">${state.user.kind === 'company' ? 'Open an applicant on a vacancy and tap Message to start one.' : 'Companies you apply to can message you here. Matches, buyers and landlords join later.'}</div></div>`}
    </main>`;
  });

  /* ---------- Thread ---------- */
  function bubble(m) {
    if (m.type === 'interview' || m.type === 'inspection') {
      const s = m.meta.status; const mine = m.mine; const label = m.type === 'inspection' ? 'Inspection request' : 'Interview invitation';
      return `<div class="card" style="align-self:${mine ? 'flex-end' : 'flex-start'};max-width:300px;overflow:hidden" data-invite="${m.id}">
        <div class="row" style="padding:12px 14px;background:var(--green-tint);color:var(--green-dark);gap:10px;font-size:13px;font-weight:700">${icon('calendar-check')} ${label} ${s === 'confirmed' ? '· Confirmed' : s === 'suggested' ? '· Time suggested' : ''}</div>
        <div class="stack" style="padding:14px;gap:8px;font-size:14px">
          <div class="row" style="gap:10px">${icon('clock')}<strong>${h(pretty(m.meta.at))}</strong></div>
          <div class="row" style="gap:10px">${icon('location-dot')}<span>${h(m.meta.place)}</span></div>
          ${m.meta.with ? `<div class="row" style="gap:10px">${icon('users')}<span>With ${h(m.meta.with)}</span></div>` : ''}
          ${m.meta.note ? `<div class="small muted" style="line-height:1.5">${h(m.meta.note)}</div>` : ''}
          ${!mine && s === 'pending' ? `<div class="row" style="gap:8px;margin-top:6px"><button class="btn btn-sm btn-ink" style="flex:1" data-respond="confirm">Confirm</button><button class="btn btn-sm btn-outline" style="flex:1" data-respond="suggest">Suggest time</button></div>` : ''}
          ${mine && s === 'pending' ? `<div class="small muted">Waiting for ${m.type === 'inspection' ? 'the landlord' : 'a reply'}</div>` : ''}
        </div></div>`;
    }
    return `<div style="align-self:${m.mine ? 'flex-end' : 'flex-start'};max-width:280px;padding:12px 14px;border-radius:${m.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};font-size:14px;line-height:1.5;${m.mine ? 'background:var(--ink);color:var(--surface)' : 'background:var(--card);border:1px solid var(--line)'};white-space:pre-line">${h(m.body)}<div class="small" style="opacity:.6;margin-top:4px;text-align:right">${when(m.createdAt)}</div></div>`;
  }

  route('/inbox/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const t = await api.thread(id);
    const c = t.context;
    return `
    ${topbar(t.title, '/inbox', t.canSchedule ? `<button class="iconbtn" id="sched" aria-label="Schedule interview" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('calendar-check')}</button>` : t.canRequestInspection ? `<button class="iconbtn" id="inspect" aria-label="Request inspection" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('calendar-check')}</button>` : '')}
    ${t.kind === 'homes' && c ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${icon('house-chimney')}<span class="grow">${c.isOwner ? `${h(t.other.name)} · enquiring about <strong style="color:var(--ink)">${h(c.title)}</strong>` : `<strong style="color:var(--ink)">${h(c.title)}</strong> · ${h(c.district)}`}</span><a href="#/homes/${c.propertyId}" style="color:var(--orange-dark);font-weight:600">Open</a></div>` : ''}
    ${t.kind === 'match' ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${avatar(t.other.name, 28, color(t.other.name))}<span class="grow">You matched on Buja</span><a href="#/match/profile/${t.other.id}" style="color:var(--orange-dark);font-weight:600">Profile</a></div>` : ''}
    ${c && t.kind !== 'homes' ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${avatar(t.other.name, 28, color(t.other.name))}<span class="grow">${state.user.kind === 'company' ? `${h(t.other.name)} · applied for <strong style="color:var(--ink)">${h(c.jobTitle)}</strong> · ${c.match}% match` : `Recruiting for <strong style="color:var(--ink)">${h(c.jobTitle)}</strong>`}</span><a href="#/work/${state.user.kind === 'company' ? 'company/job/' + c.jobId : 'job/' + c.jobId}" style="color:var(--orange-dark);font-weight:600">Open</a></div>` : ''}
    <main id="msgs" class="stack" style="padding:8px 16px 0;gap:12px;flex:1" data-last="${t.messages.length ? t.messages[t.messages.length - 1].id : 0}">${t.messages.map(bubble).join('')}</main>
    <div id="sheet"></div>
    <form id="compose" class="row" style="gap:10px;padding:10px 16px calc(10px + var(--safe-b));background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      <label for="body" style="position:absolute;left:-9999px">Message</label>
      <input class="input" id="body" name="body" placeholder="Message ${h(t.title)}" autocomplete="off" style="height:46px;border-radius:23px;flex:1">
      <button class="iconbtn" type="submit" aria-label="Send" style="background:var(--orange);border-color:var(--orange);color:#fff;width:46px;height:46px">${icon('paper-plane')}</button>
    </form>`;
  }, {
    mount(el, { id }) {
      const box = el.querySelector('#msgs'); let last = +box.dataset.last || 0;
      const scroll = () => window.scrollTo(0, document.body.scrollHeight);
      scroll();
      const bindResponds = () => el.querySelectorAll('[data-respond]').forEach((b) => { if (b.dataset.bound) return; b.dataset.bound = 1; b.addEventListener('click', async () => {
        const mid = b.closest('[data-invite]').dataset.invite; const action = b.dataset.respond;
        let note = '';
        if (action === 'suggest') { note = prompt('Which day and time works for you?') || ''; if (!note.trim()) return; }
        busy(b, true);
        try { await api.respond(mid, { action, note }); toast(action === 'confirm' ? 'Interview confirmed' : 'Suggestion sent'); location.reload(); } catch (err) { busy(b, false); failed(el, err); }
      }); });
      bindResponds();
      const poll = async () => {
        if (document.hidden) return;
        try { const t = await api.thread(id, last); if (t.messages.length) { box.insertAdjacentHTML('beforeend', t.messages.map(bubble).join('')); last = t.messages[t.messages.length - 1].id; bindResponds(); scroll(); } } catch {}
      };
      const timer = setInterval(poll, 5000);
      window.addEventListener('hashchange', () => clearInterval(timer), { once: true });
      el.querySelector('#compose').addEventListener('submit', async (e) => {
        e.preventDefault(); const i = el.querySelector('#body'); const v = i.value.trim(); if (!v) return; i.value = '';
        try { const r = await api.sendMessage(id, v); box.insertAdjacentHTML('beforeend', bubble(r.message)); last = r.message.id; scroll(); } catch (err) { i.value = v; failed(el, err); }
      });
      if (new URLSearchParams(location.hash.split('?')[1] || '').get('schedule') === '1') setTimeout(() => el.querySelector('#sched')?.click(), 50);
      if (new URLSearchParams(location.hash.split('?')[1] || '').get('inspect') === '1') setTimeout(() => el.querySelector('#inspect')?.click(), 50);
      el.querySelector('#inspect')?.addEventListener('click', () => {
        const d = new Date(Date.now() + 2 * 86400000); const def = d.toISOString().slice(0, 10);
        el.querySelector('#sheet').innerHTML = `<form id="ins" class="card stack" style="margin:8px 16px 12px;padding:16px;gap:12px">
          <div class="row"><div class="grow h-sm">Request an inspection</div><button type="button" class="iconbtn" id="closeins" aria-label="Close" style="width:36px;height:36px">${icon('xmark')}</button></div>
          <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="date">Date</label><input class="input" id="date" type="date" value="${def}" min="${new Date().toISOString().slice(0, 10)}"></div><div class="field" style="flex:1"><label for="time">Time</label><input class="input" id="time" type="time" value="14:00"></div></div>
          <div class="error" data-error="at"></div>
          ${field({ id: 'note', label: 'Anything the landlord should know (optional)', placeholder: 'I can only do afternoons' })}
          <button class="btn btn-primary" type="submit">${icon('paper-plane')} Send request</button>
          <div class="small muted">The landlord confirms or suggests another time. You both get it on your Today list.</div></form>`;
        clearOnInput(el.querySelector('#sheet')); scroll();
        el.querySelector('#closeins').addEventListener('click', () => { el.querySelector('#sheet').innerHTML = ''; });
        el.querySelector('#ins').addEventListener('submit', async (e) => {
          e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
          const localAt = new Date(f.date.value + 'T' + f.time.value); const at = new Date(localAt.getTime() - localAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
          try { await api.requestInspection(id, { at, note: f.note.value }); toast('Request sent'); if (location.hash === '#/inbox/' + id) location.reload(); else location.hash = '#/inbox/' + id; } catch (err) { busy(btn, false); failed(el, err); }
        });
      });
      el.querySelector('#sched')?.addEventListener('click', () => {
        const d = new Date(Date.now() + 3 * 86400000); const def = d.toISOString().slice(0, 10);
        el.querySelector('#sheet').innerHTML = `
        <form id="inv" class="card stack" style="margin:8px 16px 12px;padding:16px;gap:12px">
          <div class="row"><div class="grow h-sm">Schedule an interview</div><button type="button" class="iconbtn" id="closeinv" aria-label="Close" style="width:36px;height:36px">${icon('xmark')}</button></div>
          <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="date">Date</label><input class="input" id="date" type="date" value="${def}" min="${new Date().toISOString().slice(0, 10)}"></div><div class="field" style="flex:1"><label for="time">Time</label><input class="input" id="time" type="time" value="10:00"></div></div>
          <div class="error" data-error="at"></div>
          ${field({ id: 'place', label: 'Where', placeholder: 'Zenith Bank, Maitama branch' })}
          ${field({ id: 'with', label: 'With (optional)', placeholder: 'Ngozi Eze, Branch Manager' })}
          ${field({ id: 'note', label: 'Anything to bring or know (optional)', placeholder: 'Bring a valid ID' })}
          <button class="btn btn-primary" type="submit">${icon('paper-plane')} Send invitation</button>
          <div class="small muted">They get a push notification and an email, and can confirm or suggest another time.</div>
        </form>`;
        clearOnInput(el.querySelector('#sheet')); scroll();
        el.querySelector('#closeinv').addEventListener('click', () => { el.querySelector('#sheet').innerHTML = ''; });
        el.querySelector('#inv').addEventListener('submit', async (e) => {
          e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
          const localAt = new Date(f.date.value + 'T' + f.time.value); const at = new Date(localAt.getTime() - localAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
          try { await api.invite(id, { at, place: f.place.value, with: f.with.value, note: f.note.value }); toast('Invitation sent'); if (location.hash === '#/inbox/' + id) location.reload(); else location.hash = '#/inbox/' + id; } catch (err) { busy(btn, false); failed(el, err); }
        });
      });
    }
  });

  /* ---------- Forgot / reset ---------- */
  route('/forgot', { guest: true }, async () => `
    ${topbar('', '/signin')}
    <form id="f" class="pad stack" style="gap:18px" novalidate>
      <div><div class="h-xl">Reset your password</div><div class="muted" style="margin-top:4px">Enter your email and we'll send a link that works for 30 minutes.</div></div>
      ${field({ id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' })}
      <button class="btn btn-primary" type="submit">Send reset link</button>
    </form>`, { mount(el) { clearOnInput(el); el.querySelector('#f').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { const r = await api.forgot(e.target.email.value); toast(r.configured ? 'If that email exists, a link is on its way' : 'Email is not set up on this server yet'); go('/signin'); } catch (err) { busy(btn, false); failed(el, err); } }); } });

  route('/reset', { guest: true }, async () => `
    ${topbar('', '/signin')}
    <form id="f" class="pad stack" style="gap:18px" novalidate>
      <div><div class="h-xl">Choose a new password</div></div>
      ${field({ id: 'password', label: 'New password', type: 'password', placeholder: 'At least 8 characters', autocomplete: 'new-password' })}
      <button class="btn btn-primary" type="submit">Save and sign in</button>
    </form>`, { mount(el) { clearOnInput(el); const token = new URLSearchParams(location.hash.split('?')[1] || '').get('token') || ''; el.querySelector('#f').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true); try { const r = await api.reset(token, e.target.password.value); setState({ user: r.user }); toast('Password updated'); go('/home'); } catch (err) { busy(btn, false); failed(el, err); } }); } });

  /* ---------- Push helpers used by Settings ---------- */
  const b64ToArr = (s) => { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...b].map((c) => c.charCodeAt(0))); };
  return {
    pushSupported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    async enablePush() {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission(); if (perm !== 'granted') throw { message: 'Notifications were not allowed. You can enable them in your phone settings for this site.' };
      const { key } = await api.pushKey();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToArr(key) });
      await api.pushSubscribe(sub.toJSON());
    },
    async disablePush() {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (sub) { await api.pushUnsubscribe(sub.endpoint); await sub.unsubscribe(); }
    },
    async pushState() {
      try { const reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()); } catch { return false; }
    },
  };
}
