// Buja engagement: what each person is learning (for the admin), messages to one person or many,
// and the nudge that gets people to switch notifications on. Registered by app.js.

const ago = (iso) => { if (!iso) return 'never'; const d = (Date.now() - new Date(String(iso).replace(' ', 'T') + 'Z')) / 1000; return d < 60 ? 'just now' : d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };

/** The Learning and Message blocks on the admin's view of one person. Called from trust.js. */
export async function mountAdminPerson(el, id, { api, h, icon, toast, busy }) {
  const box = el.querySelector('#learning'); if (!box) return;
  let d;
  try { d = await api.adminUserLearning(id); } catch { box.innerHTML = `<div class="card small muted" style="padding:14px">Learning data could not be loaded.</div>`; return; }
  const L = d.learning, u = d.user;
  const status = { certified: ['Certified', 'var(--green-dark)', 'var(--green-tint)'], finished: ['Finished', 'var(--green-dark)', 'var(--green-tint)'], in_progress: ['In progress', 'var(--orange-dark)', 'var(--orange-tint)'] };
  box.innerHTML = `<div class="card stack" style="padding:14px;gap:12px">
    <div class="row"><div class="h-sm grow">Learning</div><span class="small muted">${L.lessonsDone} lesson${L.lessonsDone === 1 ? '' : 's'} · ${L.certificates} certificate${L.certificates === 1 ? '' : 's'} · last active ${ago(L.last)}</span></div>
    ${L.courses.length ? L.courses.map((c) => `<div class="stack" style="gap:6px;padding-top:10px;border-top:1px solid var(--line)">
      <div class="row" style="gap:8px"><div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:700">${h(c.title)}</div><div class="small muted">${h(c.level)} · ${c.done} of ${c.lessons} lessons${c.avg != null ? ' · average ' + c.avg + '%' : ''} · ${c.attempts} attempt${c.attempts === 1 ? '' : 's'} · ${ago(c.last)}</div></div><span class="tag" style="background:${status[c.status][2]};color:${status[c.status][1]}">${status[c.status][0]}</span></div>
      <div style="height:6px;border-radius:3px;background:var(--surface)"><div style="height:6px;border-radius:3px;background:var(--green);width:${c.pct}%"></div></div>
      ${c.next ? `<div class="small">Next: <strong>${h(c.next.title)}</strong> <span class="muted">(${c.next.kind}, ${c.next.minutes} min)</span></div>` : ''}
      ${c.certificate ? `<div class="row small" style="gap:8px">${icon('award')} <span class="grow">Certificate <strong style="letter-spacing:1px">${h(c.certificate.code)}</strong> · ${c.certificate.score}% · ${h(c.certificate.at.slice(0, 10))}</span><a href="#/cert/${h(c.certificate.code)}" style="font-weight:650">Verify</a></div>` : ''}
      <details><summary class="small" style="cursor:pointer;color:var(--ink-2)">Every lesson</summary><div class="stack" style="gap:3px;margin-top:6px">${c.detail.map((x) => `<div class="row small" style="gap:8px"><span style="width:18px;color:${x.done ? 'var(--green-dark)' : 'var(--ink-3)'}">${x.done ? '✓' : x.index + 1}</span><span class="grow" style="${x.done ? '' : 'color:var(--ink-3)'}">${h(x.title)}</span>${x.done ? `<span class="muted">${x.score}%${x.attempts > 1 ? ' · ' + x.attempts + ' tries' : ''}</span>` : ''}${x.hasAnswer ? `<a href="#" data-ans="${h(c.slug)}|${x.index}" style="font-weight:650;margin-left:6px">Answer</a>` : ''}</div><div data-ansbox="${h(c.slug)}|${x.index}"></div>`).join('')}</div></details>
    </div>`).join('') : `<div class="small muted">Has not started a course.</div>`}
    <div class="row small muted" style="gap:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--line)"><span>Reminders ${u.remindersOn ? 'on' : 'switched off by them'}</span><span>· last sent ${ago(u.lastReminder)}</span><span>· ${u.pushDevices ? u.pushDevices + ' device' + (u.pushDevices === 1 ? '' : 's') + ' with notifications' : 'notifications not switched on'}</span></div>
    ${L.courses.some((c) => c.status === 'in_progress') ? `<button class="btn btn-sm btn-outline" id="nudgenow">${icon('bell')} Send their learning reminder now</button>` : ''}
  </div>
  <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Send ${h(u.name.split(' ')[0])} a notification</div>
    <input class="input" id="mt" maxlength="120" placeholder="Title">
    <textarea class="input" id="mb" maxlength="300" placeholder="Message" style="height:80px;padding:12px 14px;resize:none"></textarea>
    <select class="input" id="mu"><option value="/#/home">Opens: Home</option><option value="/#/learn">Opens: Buja Learn</option><option value="/#/me">Opens: their profile</option><option value="/#/settings">Opens: Settings</option><option value="/#/inbox">Opens: Messages</option></select>
    <button class="btn btn-sm btn-ink" id="msend">${icon('paper-plane')} Send</button>
    <div class="small muted">Shows in their notifications, and on their phone if they switched push on. Falls back to email when they have no push device.</div>
  </div>`;
  box.querySelectorAll('[data-ans]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault(); const [course, n] = a.dataset.ans.split('|'); const slot = box.querySelector(`[data-ansbox="${a.dataset.ans}"]`);
    if (slot.innerHTML) { slot.innerHTML = ''; return; }
    slot.innerHTML = '<div class="small muted" style="padding:6px 0">Loading…</div>';
    try {
      const r = await api.adminSubmission(id, course, n);
      slot.innerHTML = `<div class="stack" style="gap:6px;margin:6px 0 10px;padding:10px;border-radius:10px;background:var(--surface)">
        <div class="small muted">${r.lesson.kind === 'prompt' ? 'Their prompt' : 'Their code'}${r.answer ? ', last saved ' + ago(r.answer.at) : ''}${r.progress ? ' · scored ' + r.progress.score + '% after ' + r.progress.attempts + ' attempt' + (r.progress.attempts === 1 ? '' : 's') : ''}</div>
        <pre style="margin:0;max-height:260px;overflow:auto;background:#101014;color:#E8E8EC;padding:10px;border-radius:8px;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word">${h(r.answer ? r.answer.text : '(nothing saved)')}</pre>
        ${r.lesson.rubric ? `<div class="small"><strong>Rubric</strong><ul style="margin:4px 0 0;padding-left:18px">${r.lesson.rubric.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>` : ''}
        ${r.lesson.tests ? `<div class="small"><strong>Tests it had to pass</strong><ul style="margin:4px 0 0;padding-left:18px">${r.lesson.tests.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>` : ''}</div>`;
    } catch (err) { slot.innerHTML = `<div class="small" style="color:#D92D20">${h((err && err.message) || 'Could not load')}</div>`; }
  }));
  box.querySelector('#nudgenow')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.adminNudgeUser(id); toast(r.ok ? 'Reminder sent' : r.message); } catch (err) { toast((err && err.message) || 'Failed'); } busy(b, false); });
  box.querySelector('#msend').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { await api.adminNotifyUser(id, { title: box.querySelector('#mt').value, body: box.querySelector('#mb').value, url: box.querySelector('#mu').value }); toast('Sent'); box.querySelector('#mt').value = ''; box.querySelector('#mb').value = ''; } catch (err) { toast((err && err.message) || 'Failed'); } busy(b, false); });
}

export function registerEngage({ route, go, state, api, ui, failed, push }) {
  const { h, toast, topbar, icon, busy, avatar } = ui;
  const guard = () => (state.user && state.user.admin) ? null : `${topbar('', '/me')}<div class="placeholder"><div class="h-md">Admins only</div><div class="small muted">This screen is for Buja administrators. Ask an admin if you think you need access.</div></div>`;

  /* ---------------- Learners ---------------- */
  route('/admin/learners', { auth: true, tabs: '' }, async () => {
    const g = guard(); if (g) return g;
    const f = new URLSearchParams(location.hash.split('?')[1] || '');
    const d = await api.adminLearners({ q: f.get('q') || '', filter: f.get('filter') || '' });
    const chip = (k, l) => `<a class="chip ${(f.get('filter') || '') === k ? 'on' : ''}" href="#/admin/learners?filter=${k}${f.get('q') ? '&q=' + encodeURIComponent(f.get('q')) : ''}">${l}</a>`;
    return `${topbar('Learners', '/admin')}
    <form id="sf" class="pad" style="padding-bottom:0"><div class="card row" style="height:46px;padding:0 14px;gap:10px">${icon('magnifying-glass')}<input name="q" type="search" value="${h(f.get('q') || '')}" placeholder="Name or email" style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div></form>
    <div class="row" style="gap:8px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none">${chip('', 'All')}${chip('active', 'Active this week')}${chip('stuck', 'Stuck 7+ days')}${chip('certified', 'Certified')}</div>
    <main class="pad stack" style="gap:8px;padding-top:12px">
      <div class="small muted">${d.learners.length} ${d.learners.length === 1 ? 'person' : 'people'}. Tap anyone to see every lesson, their certificates, and to message them.</div>
      ${d.learners.map((p) => `<a class="card row" href="#/admin/users/${p.id}" style="padding:12px 14px;gap:12px">${p.avatar ? `<img src="${h(p.avatar)}" alt="" style="width:42px;height:42px;border-radius:21px;object-fit:cover;flex-shrink:0">` : avatar(p.name, 42)}
        <div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:700">${h(p.name)}</div>
        <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.current ? h(p.current.title) + ' · ' + p.current.done + '/' + p.current.lessons : ''}${p.district ? ' · ' + h(p.district) : ''}</div>
        <div class="small" style="color:${p.idleDays > 7 ? '#D92D20' : p.idleDays > 2 ? 'var(--orange-dark)' : 'var(--green-dark)'}">${p.idleDays === 0 ? 'Active today' : 'Idle ' + p.idleDays + ' day' + (p.idleDays === 1 ? '' : 's')} · ${p.lessons} lessons${p.certificates ? ' · ' + p.certificates + ' certificate' + (p.certificates === 1 ? '' : 's') : ''}</div></div>${icon('chevron-right')}</a>`).join('') || `<div class="small muted" style="padding:20px 0">Nobody matches.</div>`}
    </main>`;
  }, { mount(el) { el.querySelector('#sf').addEventListener('submit', (e) => { e.preventDefault(); const f = new URLSearchParams(location.hash.split('?')[1] || ''); f.set('q', e.target.q.value); go('/admin/learners?' + f); }); } });

  /* ---------------- Broadcast ---------------- */
  route('/admin/broadcast', { auth: true, tabs: '' }, async () => {
    const g = guard(); if (g) return g;
    const d = await api.adminBroadcasts();
    return `${topbar('Send a notification', '/admin')}
    <main class="pad stack" style="gap:14px">
      <div class="card stack" style="padding:14px;gap:12px">
        <div class="field" style="margin:0"><label for="aud">Who gets it</label><select class="input" id="aud">${Object.entries(d.audiences).map(([k, l]) => `<option value="${k}">${h(l)}${d.counts[k] != null ? ' (' + d.counts[k] + ')' : ''}</option>`).join('')}</select></div>
        <div class="field" style="margin:0;display:none" id="distwrap"><label for="dist">District</label><select class="input" id="dist">${d.districts.map((x) => `<option>${h(x)}</option>`).join('')}</select></div>
        <div class="field" style="margin:0"><label for="bt">Title</label><input class="input" id="bt" maxlength="120" placeholder="New jobs in Wuse this week"><div class="error" data-error="title"></div></div>
        <div class="field" style="margin:0"><label for="bb">Message</label><textarea class="input" id="bb" maxlength="300" placeholder="Twelve companies are hiring. Tap to see them." style="height:90px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="body"></div><div class="small muted" id="cc">0 / 300</div></div>
        <div class="field" style="margin:0"><label for="bu">Tapping it opens</label><select class="input" id="bu">${[['/#/home', 'Home'], ['/#/work', 'Work'], ['/#/homes', 'Homes'], ['/#/learn', 'Buja Learn'], ['/#/meetup', 'Meetup'], ['/#/light', 'Light Watch'], ['/#/rides', 'Commute share'], ['/#/settings', 'Settings (for switching on notifications)']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="card" style="padding:12px;background:var(--surface);border:none"><div class="small muted" style="margin-bottom:6px">Preview</div><div class="row" style="gap:10px;align-items:flex-start"><img src="/assets/icons/icon-192.png" alt="" style="width:34px;height:34px;border-radius:8px"><div><div style="font-size:14px;font-weight:700" id="pt">Title</div><div class="small" style="color:var(--ink-2)" id="pb">Message</div></div></div></div>
        <div class="row" style="gap:8px"><button class="btn btn-outline" id="test" style="flex:1">Send to me first</button><button class="btn btn-primary" id="go" style="flex:1">${icon('paper-plane')} Send to <span id="n">${d.counts.all}</span></button></div>
        <div class="small muted" style="line-height:1.5">Everyone sees it in their notifications list; people who switched push on also get it on their phone. Large audiences go out forty at a time over a few minutes. There is no undo.</div>
      </div>
      <div class="section">SENT</div>
      ${d.history.length ? d.history.map((b) => `<div class="card stack" style="padding:12px 14px;gap:4px"><div class="row"><div class="grow" style="font-size:14px;font-weight:700">${h(b.title)}</div><span class="small muted">${ago(b.at)}</span></div><div class="small" style="color:var(--ink-2)">${h(b.body)}</div><div class="small muted">${h(b.audienceLabel)} · ${b.recipients} ${b.recipients === 1 ? 'person' : 'people'}${b.waiting ? ` · <span style="color:var(--orange-dark)">${b.waiting} still sending</span>` : ' · delivered'}</div></div>`).join('') : `<div class="small muted">Nothing sent yet.</div>`}
    </main>`;
  }, {
    async mount(el) {
      const $ = (s) => el.querySelector(s);
      if (!$('#aud')) return;
      const d = await api.adminBroadcasts().catch(() => null);
      const upd = () => { $('#pt').textContent = $('#bt').value || 'Title'; $('#pb').textContent = $('#bb').value || 'Message'; $('#cc').textContent = $('#bb').value.length + ' / 300'; };
      const count = async () => { const a = $('#aud').value; $('#distwrap').style.display = a === 'district' ? '' : 'none'; if (a !== 'district' && d) { $('#n').textContent = d.counts[a]; return; } try { const r = await api.adminBroadcastCount({ audience: a, district: $('#dist').value }); $('#n').textContent = r.count; } catch {} };
      $('#bt').addEventListener('input', upd); $('#bb').addEventListener('input', upd); $('#aud').addEventListener('change', count); $('#dist').addEventListener('change', count);
      const payload = (test) => ({ audience: $('#aud').value, district: $('#dist').value, title: $('#bt').value, body: $('#bb').value, url: $('#bu').value, test });
      $('#test').addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.adminBroadcastSend(payload(true)); toast(r.message); } catch (err) { failed(el, err); } busy(b, false); });
      $('#go').addEventListener('click', async (e) => { const b = e.currentTarget; if (!confirm(`Send "${$('#bt').value}" to ${$('#n').textContent} people? This cannot be undone.`)) return; busy(b, true); try { const r = await api.adminBroadcastSend(payload(false)); toast(r.message); location.reload(); } catch (err) { busy(b, false); failed(el, err); } });
    }
  });

  /* ---------------- The setup card on Home ----------------
     One card at most, the one that matters for this phone:
       1. iPhone in the browser: notifications only work once Buja is on the Home Screen, so explain that first
       2. push supported but not on: switch it on (or, if blocked, how to unblock)
       3. Android with an install offer waiting: install Buja
     Once a day at most per card, weekly after three dismissals. */
  const seen = (k) => { let s = {}; try { s = JSON.parse(localStorage.getItem(k) || '{}'); } catch {} return s; };
  const due = (k) => { const s = seen(k); if (s.on) return false; const gap = (s.n || 0) >= 3 ? 7 * 86400000 : 86400000; return !s.at || Date.now() - s.at >= gap; };
  const dismiss = (k) => { const s = seen(k); try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), n: (s.n || 0) + 1 })); } catch {} };
  const done = (k) => { try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), n: 0, on: 1 })); } catch {} };
  const place = (html) => { const slot = document.getElementById('weather'); if (!slot || document.getElementById('setupcard')) return null; const c = document.createElement('div'); c.id = 'setupcard'; c.innerHTML = html; slot.after(c); return c; };
  const shell = (iconName, title, text, btn) => `<div class="card stack" style="padding:14px;gap:10px;margin-bottom:10px;border:2px solid var(--orange)">
      <div class="row" style="gap:12px;align-items:flex-start"><span style="width:40px;height:40px;border-radius:12px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(iconName)}</span>
      <div class="grow"><div style="font-size:15px;font-weight:700">${title}</div><div class="small" style="color:var(--ink-2);line-height:1.5;margin-top:2px">${text}</div></div>
      <button class="iconbtn" data-x aria-label="Not now" style="width:30px;height:30px;background:transparent;border:none">${icon('xmark')}</button></div>
      ${btn || ''}</div>`;

  /** Continue-learning card on Home, under the setup card. Hidden for the rest of the day once closed. */
  window.bujaContinue = async () => {
    if (!state.user || api.isMock()) return;
    const k = 'buja_cont_' + new Date().toISOString().slice(0, 10); try { if (localStorage.getItem(k)) return; } catch {}
    let r; try { r = await api.learnContinue(); } catch { return; }
    const c = r && r.course; const slot = document.getElementById('weather');
    if (!c || !slot || document.getElementById('contcard')) return;
    const left = c.lessons - c.done;
    const el = document.createElement('div'); el.id = 'contcard';
    el.innerHTML = `<div class="card stack" style="padding:14px;gap:10px;margin-bottom:10px;background:var(--night);color:#fff;border-color:var(--night)">
      <div class="row" style="gap:12px"><span style="width:40px;height:40px;border-radius:12px;background:rgba(126,217,87,.15);color:#7ED957;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('book-open')}</span>
      <div class="grow" style="min-width:0"><div class="small" style="color:#9AA0AB">Continue learning · ${c.done} of ${c.lessons}</div><div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(c.title)}</div></div>
      <button class="iconbtn" data-x aria-label="Hide for today" style="width:30px;height:30px;background:transparent;border:none;color:#fff">${icon('xmark')}</button></div>
      <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.12)"><div style="height:5px;border-radius:3px;background:#7ED957;width:${c.pct}%"></div></div>
      <a class="btn" href="#/learn/${h(c.slug)}/${c.next.index}" style="background:#7ED957;color:#101014;border:none">Next: ${h(c.next.title)} · ${c.next.minutes} min</a>
      ${left <= 2 ? `<div class="small" style="color:#B5B5BC">${left === 1 ? 'One lesson' : 'Two lessons'} from your certificate.</div>` : ''}</div>`;
    const after = document.getElementById('setupcard') || slot; after.after(el);
    el.querySelector('[data-x]').addEventListener('click', () => { try { localStorage.setItem(k, '1'); } catch {} el.remove(); });
  };

  window.bujaPushNudge = async () => {
    if (!state.user || api.isMock()) return;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    // 1. iPhone in the browser
    if (ios && !standalone) {
      if (!due('buja_ios')) return;
      const v = ua.match(/OS (\d+)_(\d+)/); const old = v && (+v[1] < 16 || (+v[1] === 16 && +v[2] < 4));
      const c = place(shell('bell', 'Add Buja to your Home Screen', old
        ? 'Your iPhone needs iOS 16.4 or newer for Buja notifications. Update it in Settings, General, Software Update, then come back here.'
        : 'On iPhone, notifications only work when Buja is on your Home Screen. It takes ten seconds:'
        + '<ol style="margin:8px 0 0;padding-left:18px"><li>Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow pointing up).</li><li>Scroll and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li><li>Open Buja from the new icon and switch notifications on.</li></ol>',
        `<a class="btn btn-primary" href="#/install">Show me with pictures</a>`));
      if (!c) return;
      api.pushAsked().catch(() => {});
      c.querySelector('[data-x]').addEventListener('click', () => { dismiss('buja_ios'); c.remove(); });
      return;
    }

    // 2. Notifications
    if (push && push.pushSupported()) {
      const on = await Promise.race([push.pushState(), new Promise((r) => setTimeout(() => r(false), 3000))]); // never wait forever on a stuck service worker
      if (!on) {
        if (!due('buja_pn')) return;
        const blocked = ('Notification' in window) && Notification.permission === 'denied';
        const c = place(shell('bell', blocked ? 'Notifications are blocked for Buja' : 'Switch on notifications', blocked
          ? 'Your browser is blocking them, so you will miss messages, interview calls and seat requests. Tap the lock or ⓘ icon beside the address bar, then Notifications, then Allow. Come back and tap Check again.'
          : 'So you do not miss messages, interview calls, seat requests and your learning reminders. One tap, and you can switch any kind off later in Settings.',
          `<button class="btn btn-primary" data-go>${blocked ? 'Check again' : 'Switch on'}</button>`));
        if (!c) return;
        api.pushAsked().catch(() => {});
        c.querySelector('[data-x]').addEventListener('click', () => { dismiss('buja_pn'); c.remove(); });
        c.querySelector('[data-go]').addEventListener('click', async (e) => {
          const b = e.currentTarget; busy(b, true);
          try { await push.enablePush(); toast('Notifications are on'); done('buja_pn'); c.remove(); }
          catch (err) { busy(b, false); toast((err && err.message) || 'Not switched on'); if ('Notification' in window && Notification.permission === 'denied') { c.remove(); window.bujaPushNudge(); } }
        });
        return;
      }
    }

    // 3. Android: an install offer is waiting
    if (!standalone && window.__bujaInstall && due('buja_inst')) {
      const c = place(shell('file-arrow-up', 'Install Buja', 'It opens like an app from your home screen, starts faster, and works on a poor connection. No app store, about 1 MB.', `<button class="btn btn-primary" data-go>Install</button>`));
      if (!c) return;
      c.querySelector('[data-x]').addEventListener('click', () => { dismiss('buja_inst'); c.remove(); });
      c.querySelector('[data-go]').addEventListener('click', async () => { const ev = window.__bujaInstall; window.__bujaInstall = null; try { ev.prompt(); const r = await ev.userChoice; if (r && r.outcome === 'accepted') { done('buja_inst'); toast('Installing'); } else dismiss('buja_inst'); } catch {} c.remove(); });
    }
  };
}
