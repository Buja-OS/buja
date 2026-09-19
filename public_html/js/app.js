// Buja app: hash router and Phase 1 screens.
import { state, setState, subscribe, applyTheme } from './store.js';
import { api, detectApi } from './api.js';
import { h, toast, mark, markAuto, topbar, tabbar, field, showErrors, bindEyes, clearOnInput, busy, avatar, icon } from './ui.js';
import { registerWork } from './work.js';
import { registerMessages } from './messages.js';
import { registerMatch } from './match.js';
import { registerWaka } from './waka.js';
import { registerHomes } from './homes.js';

const DISTRICTS = ['Asokoro', 'Maitama', 'Wuse', 'Wuse 2', 'Garki', 'Central Area', 'Jabi', 'Utako', 'Gwarinpa', 'Life Camp', 'Kado', 'Katampe', 'Guzape', 'Durumi', 'Apo', 'Lokogoma', 'Galadimawa', 'Lugbe', 'Kubwa', 'Jahi', 'Nyanya', 'Karu', 'Jikwoyi', 'Kuje', 'Gwagwalada'];
const app = document.getElementById('app');

/* ---------------- Router ---------------- */
const routes = {};
function route(path, opts, render, extra) { routes[path] = { ...opts, ...(extra || {}), render, keys: (path.match(/:\w+/g) || []).map((k) => k.slice(1)), rx: new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$') }; }
function go(path) { location.hash = '#' + path; }
function current() { return (location.hash.replace(/^#/, '') || '/').split('?')[0]; }
function match(path) {
  if (routes[path]) return { r: routes[path], params: {} };
  for (const r of Object.values(routes)) { const m = r.keys.length && path.match(r.rx); if (m) return { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; }
  return { r: routes['/404'], params: {} };
}

let renderSeq = 0;
async function render() {
  if (!state.booted) return;
  const seq = ++renderSeq;
  const path = current();
  const { r, params } = match(path);
  if (r.auth && !state.user) { go('/welcome'); return; }
  if (r.guest && state.user) { go(state.user.district ? '/home' : '/onboarding'); return; }
  const el = document.createElement('div');
  el.className = 'screen screen-enter' + (r.tabs ? '' : ' no-tabs');
  let html;
  try { html = await r.render(params); }
  catch (err) { html = null; if (seq !== renderSeq) return; el.innerHTML = `${topbar('', '/home')}<div class="placeholder"><div class="mi card">${icon('triangle-exclamation')}</div><div class="h-md">${h((err && err.message) || 'Something went wrong')}</div><a class="btn btn-ink" href="#/home" style="width:auto">Go home</a></div>`; }
  if (seq !== renderSeq) return;
  if (html !== null) el.innerHTML = html;
  app.innerHTML = '';
  app.appendChild(el);
  if (r.tabs) app.insertAdjacentHTML('beforeend', tabbar(r.tabs, state.unread || 0));
  if (r.mount) r.mount(el, params);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
let lastKey = '';
const stateKey = () => JSON.stringify([state.user && [state.user.id, state.user.kind, state.user.district, state.user.name, state.user.verified], state.theme]);
subscribe(() => { const k = stateKey(); if (k === lastKey) return; lastKey = k; if (['/home', '/me', '/settings'].includes(current())) render(); });

/* ---------------- Screens ---------------- */
route('/', { guest: true }, async () => { go('/welcome'); return ''; });

route('/welcome', { guest: true }, async () => `
  <section class="hero">
    ${mark(96, '#FAFAF7')}
    <div class="word">Buja</div>
    <div class="sub">Jobs, people and movement across Abuja</div>
    <div class="pills"><span>${icon('briefcase')} Work</span><span>${icon('heart')} Match</span><span>${icon('route')} Waka</span></div>
    <div class="pills"><span>${icon('house-chimney')} Homes</span><span>${icon('tags')} Declutter</span><span>${icon('wand-magic-sparkles')} Ask</span></div>
  </section>
  <div class="pad stack" style="padding-top:24px;padding-bottom:28px">
    <div id="gsi-welcome"></div>
    <button class="btn btn-outline" data-google>
      <span class="gmark">G</span>Continue with Google
    </button>
    <a class="btn btn-ink" href="#/signup">${icon('user')} Create an account</a>
    <a class="btn btn-ghost" href="#/signin">I already have an account</a>
    <p class="small muted center" style="margin:0;line-height:1.5">By continuing you agree to Buja's Terms and Privacy Policy. Buja is for residents of Abuja and the FCT.</p>
  </div>`, { mount: mountGoogle });

route('/signin', { guest: true }, async () => `
  ${topbar('', '/welcome')}
  <main class="pad stack" style="gap:22px;padding-top:8px">
    <div>${markAuto(40)}<div class="h-xl" style="margin-top:16px">Welcome back</div><div class="muted" style="margin-top:4px">Sign in to pick up where you left off.</div></div>
    <button class="btn btn-outline" data-google><span class="gmark">G</span>Continue with Google</button>
    <div class="divider">OR</div>
    <form id="f" class="stack" style="gap:16px" novalidate>
      ${field({ id: 'identifier', label: 'Email or phone', placeholder: 'you@example.com or 0803 000 0000', autocomplete: 'username' })}
      ${field({ id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' })}
      <div class="row" style="justify-content:space-between">
        <label class="check" style="align-items:center"><input type="checkbox" name="keep" checked>Keep me signed in</label>
        <a href="#/forgot" style="font-size:13px;font-weight:600;color:var(--orange-dark)">Forgot password?</a>
      </div>
      <button class="btn btn-primary" type="submit">Sign in</button>
    </form>
    <div class="center small muted">New to Buja? <a href="#/signup" style="color:var(--orange-dark);font-weight:600">Create an account</a></div>
  </main>`, {
  mount(el) {
    mountGoogle(el); bindEyes(el); clearOnInput(el);
    el.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]');
      showErrors(el, {}); busy(btn, true);
      try {
        const r = await api.login({ identifier: val(f, 'identifier'), password: val(f, 'password') });
        await signedIn(r);
      } catch (err) { busy(btn, false); failed(el, err); }
    });
  }
});

route('/signup', { guest: true }, async () => `
  ${topbar('', '/welcome')}
  <main class="pad stack" style="gap:16px">
    <div><div class="h-xl">Create your account</div><div class="muted" style="margin-top:4px">One account for Work, Match, Waka, Homes, Declutter and Ask.</div></div>
    <button class="btn btn-outline" data-google><span class="gmark">G</span>Sign up with Google</button>
    <div class="divider">OR</div>
    <form id="f" class="stack" style="gap:14px" novalidate>
      ${field({ id: 'name', label: 'Full name', placeholder: 'Tunde Bello', autocomplete: 'name' })}
      ${field({ id: 'email', label: 'Email', type: 'email', placeholder: 'tunde@example.com', autocomplete: 'email' })}
      <div class="field" data-field="phone">
        <label for="phone">Phone number</label>
        <div class="row" style="gap:10px"><span class="prefix">+234</span><input class="input" id="phone" name="phone" type="tel" inputmode="tel" placeholder="803 000 0000" autocomplete="tel-national"></div>
        <div class="error" data-error="phone"></div>
      </div>
      ${field({ id: 'password', label: 'Password', type: 'password', placeholder: 'At least 8 characters', autocomplete: 'new-password' })}
      <div class="strength" id="strength"><span></span><span></span><span></span><span></span></div>
      <label class="check"><input type="checkbox" name="agree" id="agree"><span>I agree to the Terms of Use and Privacy Policy, and confirm I am 18 or older and live in Abuja or the FCT.</span></label>
      <div class="error" data-error="agree"></div>
      <button class="btn btn-primary" type="submit">Continue ${icon('chevron-right')}</button>
    </form>
    <div class="center small muted" style="padding-bottom:28px">Already have an account? <a href="#/signin" style="color:var(--orange-dark);font-weight:600">Sign in</a></div>
  </main>`, {
  mount(el) {
    mountGoogle(el); bindEyes(el); clearOnInput(el);
    const pw = el.querySelector('#password'), bars = el.querySelectorAll('#strength span');
    pw.addEventListener('input', () => {
      const v = pw.value; let s = 0; if (v.length >= 8) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) || v.length >= 14) s++;
      bars.forEach((b, i) => { b.className = i < s ? 'on' + (s <= 1 ? ' weak' : '') : ''; });
    });
    el.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]');
      showErrors(el, {}); busy(btn, true);
      try {
        const r = await api.register({ name: val(f, 'name'), email: val(f, 'email'), phone: val(f, 'phone'), password: val(f, 'password'), agree: f.querySelector('#agree').checked });
        await signedIn(r);
      } catch (err) { busy(btn, false); failed(el, err); }
    });
  }
});

route('/onboarding', { auth: true }, async () => {
  const u = state.user;
  return `
  <div class="pad" style="padding-top:40px;display:flex;flex-direction:column;align-items:center;gap:8px">${markAuto(64)}<div style="font-size:30px;font-weight:700;letter-spacing:1px;margin-top:8px">Buja</div><div class="muted small">Hi ${h(u.name.split(' ')[0])}, two quick things.</div></div>
  <form id="f" class="pad stack" style="padding-top:32px;gap:12px;flex:1">
    <div class="h-md">How will you use Buja?</div>
    <label class="opt on"><input type="radio" name="kind" value="resident" checked><div class="grow"><div class="t">I'm a resident</div><div class="s">Find work, meet people, get around, rent a home, buy and sell</div></div>${icon('user')}</label>
    <label class="opt"><input type="radio" name="kind" value="company"><div class="grow"><div class="t">I'm hiring</div><div class="s">Post vacancies, review CVs, schedule interviews</div></div>${icon('building')}</label>
    <label class="opt"><input type="radio" name="kind" value="landlord"><div class="grow"><div class="t">I have property to rent or sell</div><div class="s">List homes, take enquiries, confirm inspections</div></div>${icon('house-chimney')}</label>
    <div class="field" style="margin-top:12px" data-field="district">
      <label for="district">Your district</label>
      <select class="input" id="district" name="district"><option value="">Choose your district</option>${DISTRICTS.map((d) => `<option ${u.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <div class="hint">Buja shows your district, never your street.</div>
      <div class="error" data-error="district"></div>
    </div>
    ${u.phone ? '' : `<div class="field" data-field="phone"><label for="phone">Phone number</label><div class="row" style="gap:10px"><span class="prefix">+234</span><input class="input" id="phone" name="phone" type="tel" inputmode="tel" placeholder="803 000 0000"></div><div class="error" data-error="phone"></div></div>`}
    <div style="flex:1"></div>
    <button class="btn btn-ink" type="submit" style="margin-bottom:28px">Continue</button>
  </form>`;
}, {
  mount(el) {
    el.querySelectorAll('.opt input').forEach((r) => r.addEventListener('change', () => { el.querySelectorAll('.opt').forEach((o) => o.classList.toggle('on', o.querySelector('input').checked)); }));
    el.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]');
      showErrors(el, {}); busy(btn, true);
      const body = { kind: f.querySelector('input[name=kind]:checked').value, district: val(f, 'district') };
      if (f.querySelector('#phone')) body.phone = val(f, 'phone');
      try { const r = await api.updateMe(body); setState({ user: r.user }); toast('Welcome to Buja, ' + r.user.name.split(' ')[0]); go('/home'); }
      catch (err) { busy(btn, false); failed(el, err); }
    });
  }
});

route('/home', { auth: true, tabs: 'Home' }, async () => {
  const u = state.user; const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const modules = [
    ['/work', 'briefcase', 'var(--green-tint)', 'var(--green-dark)', 'Work', u.kind === 'company' ? 'Your vacancies and applicants' : 'Jobs across Abuja'],
    ['/match', 'heart', 'var(--orange-tint)', 'var(--orange-dark)', 'Match', u.kind === 'company' ? 'Residents only' : 'People near you'],
    ['/waka', 'route', 'rgba(126,217,87,.14)', '#7ED957', 'Waka', 'Routes, fares, riders now', true],
    ['/homes', 'house-chimney', '#E7EEF8', '#1F4E9C', 'Homes', u.kind === 'landlord' ? 'Your listings and enquiries' : 'Rent direct, no agent fee'],
    ['/declutter', 'tags', '#F3E8F8', '#7A3E96', 'Declutter', 'Buy and sell nearby'],
    ['/ask', 'wand-magic-sparkles', 'var(--orange-tint)', 'var(--orange-dark)', 'Ask', 'Best amala, lounges, spots'],
  ];
  return `
  <header class="topbar" style="padding-top:8px">
    ${markAuto(30)}<h1 style="letter-spacing:1px;font-size:22px">Buja</h1>
    <a class="iconbtn" href="#/settings" aria-label="Settings">${icon('gear')}</a>
    <button class="iconbtn" aria-label="Notifications">${icon('regular/bell')}<span class="dot"></span></button>
  </header>
  <main class="pad stack" style="gap:16px;padding-top:4px">
    <div><div class="h-lg">${greet}, ${h(u.name.split(' ')[0])}</div><div class="muted small" style="margin-top:3px;display:flex;align-items:center;gap:6px">${icon('location-dot')} ${h(u.district || 'Abuja')}${api.isMock() ? ' · preview mode' : ''}</div></div>
    <a class="card askbar" href="#/ask">${icon('wand-magic-sparkles')}<span class="grow">Ask Buja anything about Abuja</span>${icon('microphone')}</a>
    <div class="grid2">${modules.map(([href, ic, bg, fg, t, s, dark]) => `<a class="card mod ${dark ? 'dark' : ''}" href="#${href}"><div class="mi" style="background:${bg};color:${fg}">${icon(ic)}</div><div><div class="t">${t}</div><div class="s">${s}</div></div></a>`).join('')}</div>
    <div class="section">TODAY</div>
    <div id="today" class="stack" style="gap:10px"><div class="card" style="padding:14px 16px"><div class="row">${icon('circle-info')}<div class="grow"><div style="font-size:14px;font-weight:600">Nothing yet</div><div class="small muted">Interviews, inspections and fare changes will show up here.</div></div></div></div></div>
  </main>`;
}, { async mount(el) {
  try {
    const t = await api.today(); state.unread = t.unread; setBadge(t.unread);
    const box = el.querySelector('#today'); const items = [];
    if (t.unread) items.push(`<a class="card row" href="#/inbox" style="padding:13px 16px">${icon('message')}<div class="grow"><div style="font-size:14px;font-weight:600">${t.unread} unread message${t.unread === 1 ? '' : 's'}</div><div class="small muted">Open your inbox</div></div>${icon('chevron-right')}</a>`);
    for (const i of t.items) items.push(`<a class="card row" href="#${i.url}" style="padding:13px 16px">${icon('calendar-check')}<div class="grow"><div style="font-size:14px;font-weight:600">${h(i.title)}</div><div class="small muted">${h(i.sub)}</div></div>${icon('chevron-right')}</a>`);
    if (items.length) box.innerHTML = items.join('');
  } catch {}
} });

for (const [p, ic, name, blurb, phase] of [
  ['/declutter', 'tags', 'Declutter', 'Buy and sell nearby with escrow.', 6],
  ['/ask', 'wand-magic-sparkles', 'Ask', 'Your AI guide to the city.', 7],
]) {
  route(p, { auth: true, tabs: name === 'Ask' ? 'Ask' : name === 'Inbox' ? 'Inbox' : '' }, async () => `
    ${topbar(name, '/home')}
    <div class="placeholder">
      <div class="mi card">${icon(ic)}</div>
      <div class="h-md">${name} arrives in Phase ${phase}</div>
      <div class="muted small" style="max-width:280px;line-height:1.5">${blurb}</div>
    </div>`);
}

route('/me', { auth: true, tabs: 'Me' }, async () => {
  const u = state.user;
  const v = new URLSearchParams(location.hash.split('?')[1] || '').get('verified');
  if (v === '1') { try { const r = await api.me(); setState({ user: r.user }); } catch {} setTimeout(() => toast('Email confirmed'), 100); }
  if (v === '0') setTimeout(() => toast('That confirmation link has expired. Send a new one.'), 100);
  return `
  ${topbar('Me', '', `<a class="iconbtn" href="#/settings" aria-label="Settings">${icon('gear')}</a>`)}
  <main class="pad stack" style="gap:14px">
    <div class="card dark row" style="padding:16px;gap:14px">${avatar(u.name, 56)}<div class="grow"><div class="h-md">${h(u.name)}</div><div class="small" style="color:#B5B5BC;margin-top:2px">${h(u.district || 'Abuja')} · ${h(kindLabel(u.kind))}</div><div class="row" style="gap:6px;margin-top:8px">${u.verified ? `<span class="tag green">${icon('circle-check')} Email verified</span>` : `<span class="tag orange">Email not verified</span>`}${u.google ? `<span class="tag" style="background:rgba(255,255,255,.12);color:#fff">Google</span>` : ''}</div></div></div>
    ${state.user.verified ? '' : `<div class="card row" style="padding:12px 14px;border-color:var(--orange)">${icon('triangle-exclamation')}<div class="grow"><div style="font-size:14px;font-weight:600">Confirm your email</div><div class="small muted">Check your inbox for the link from Buja.</div></div><button class="btn btn-sm btn-outline" data-resend>Resend</button></div>`}
    <div class="card list">
      <div class="item"><div class="mi">${icon('user')}</div><div class="grow"><div class="t">Account</div><div class="s">${h(u.email)}${u.phone ? ' · ' + h(u.phone) : ''}</div></div></div>
      ${u.kind === 'company' ? '' : `<a class="item" href="#/match/edit"><div class="mi">${icon('heart')}</div><div class="grow"><div class="t">My Match profile</div><div class="s">Photos, bio, who you see</div></div>${icon('chevron-right')}</a>`}
      <a class="item" href="#${u.kind === 'landlord' ? '/homes/landlord' : '/homes/saved'}"><div class="mi">${icon('house-chimney')}</div><div class="grow"><div class="t">${u.kind === 'landlord' ? 'My properties' : 'Saved homes'}</div><div class="s">Homes</div></div>${icon('chevron-right')}</a>
      <a class="item" href="#/waka"><div class="mi">${icon('route')}</div><div class="grow"><div class="t">Saved routes</div><div class="s">Waka</div></div>${icon('chevron-right')}</a>
      <a class="item" href="#${u.kind === 'company' ? '/work/company' : '/work/profile'}"><div class="mi">${icon('briefcase')}</div><div class="grow"><div class="t">${u.kind === 'company' ? 'Company and vacancies' : 'My CV and applications'}</div><div class="s">Work</div></div>${icon('chevron-right')}</a>
      <a class="item" href="#/settings"><div class="mi">${icon('gear')}</div><div class="grow"><div class="t">Settings</div><div class="s">Appearance, notifications, privacy</div></div>${icon('chevron-right')}</a>
      <button class="item" data-logout><div class="mi">${icon('right-from-bracket')}</div><div class="grow"><div class="t">Sign out</div><div class="s">On this device</div></div></button>
    </div>
  </main>`;
}, { mount(el) {
  el.querySelector('[data-logout]').addEventListener('click', async () => { await api.logout(); setState({ user: null }); toast('Signed out'); go('/welcome'); });
  el.querySelector('[data-resend]')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.resendVerify(); toast(r.configured ? 'Confirmation email sent' : 'Email is not set up on this server yet'); } catch (err) { failed(el, err); } busy(e.currentTarget, false); });
} });

route('/settings', { auth: true, tabs: 'Me' }, async () => `
  ${topbar('Settings', '/me')}
  <main class="pad stack" style="gap:18px">
    <div class="stack" style="gap:10px"><div class="section">APPEARANCE</div>
      <div class="card stack" style="padding:16px;gap:14px">
        <div class="seg" id="theme">
          <button data-theme="light" class="${state.theme === 'light' ? 'on' : ''}">${icon('sun')} Light</button>
          <button data-theme="dark" class="${state.theme === 'dark' ? 'on' : ''}">${icon('moon')} Dark</button>
          <button data-theme="system" class="${state.theme === 'system' ? 'on' : ''}">${icon('mobile-screen')} System</button>
        </div>
        <div class="small muted" style="line-height:1.5">System follows your phone. Waka's map stays dark in both modes so vehicles read clearly.</div>
      </div>
    </div>
    <div class="stack" style="gap:10px"><div class="section">NOTIFICATIONS</div>
      <div class="card list" id="notif">
        <div class="item"><div class="mi">${icon('bell')}</div><div class="grow"><div class="t">Push notifications on this device</div><div class="s" id="pushs">Checking…</div></div><button class="switch" id="pushtoggle" role="switch" aria-checked="false" aria-label="Push notifications"><span></span></button></div>
        ${[['work', 'briefcase', 'Interviews, messages and applications'], ['match', 'heart', 'New matches and messages'], ['waka', 'route', 'Fare changes on saved routes'], ['offers', 'bolt', 'Buja Plus offers']].map(([k, ic, t]) => `<div class="item"><div class="mi">${icon(ic)}</div><div class="grow"><div class="t">${t}</div></div><button class="switch" data-pref="${k}" role="switch" aria-checked="false" aria-label="${t}"><span></span></button></div>`).join('')}
      </div>
      <div class="small muted" id="pushhint">Push works in Chrome on Android and on iPhone once Buja is added to the Home Screen.</div>
    </div>
    <div class="stack" style="gap:10px"><div class="section">ABOUT</div>
      <div class="card list"><div class="item"><div class="mi">${icon('circle-info')}</div><div class="grow"><div class="t">Buja</div><div class="s">Phase 1 · ${api.isMock() ? 'preview mode, data stays on this device' : 'connected to your API'}</div></div></div></div>
    </div>
  </main>`, {
  mount(el) {
    el.querySelectorAll('#theme button').forEach((b) => b.addEventListener('click', () => { applyTheme(b.dataset.theme); el.querySelectorAll('#theme button').forEach((x) => x.classList.toggle('on', x === b)); }));
    (async () => {
      let prefs = { work: true, match: true, waka: true, offers: false }; let pushed = false;
      try { const t = await api.today(); prefs = t.notifications; pushed = t.pushEnabled; } catch {}
      el.querySelectorAll('[data-pref]').forEach((s) => { const on = !!prefs[s.dataset.pref]; s.classList.toggle('on', on); s.setAttribute('aria-checked', on); s.addEventListener('click', async () => { const next = !s.classList.contains('on'); s.classList.toggle('on', next); s.setAttribute('aria-checked', next); try { await api.notifications({ [s.dataset.pref]: next }); } catch (err) { s.classList.toggle('on', !next); failed(el, err); } }); });
      const tg = el.querySelector('#pushtoggle'), st = el.querySelector('#pushs');
      if (!push.pushSupported() || api.isMock()) { st.textContent = api.isMock() ? 'Needs the live site' : 'Not supported in this browser'; tg.disabled = true; return; }
      const local = await push.pushState(); tg.classList.toggle('on', local); tg.setAttribute('aria-checked', local); st.textContent = local ? 'On' : (pushed ? 'On for another device' : 'Off');
      tg.addEventListener('click', async () => { const next = !tg.classList.contains('on'); tg.disabled = true; try { next ? await push.enablePush() : await push.disablePush(); tg.classList.toggle('on', next); tg.setAttribute('aria-checked', next); st.textContent = next ? 'On' : 'Off'; if (next) { toast('Notifications on. Sending a test…'); api.pushTest().catch(() => {}); } } catch (err) { toast(err.message || 'Could not change notifications'); } tg.disabled = false; });
    })();
  }
});

registerWork({ route, go, state, setState, api, ui: { h, toast, topbar, tabbar, field, showErrors, clearOnInput, busy, avatar, icon }, DISTRICTS, failed });
registerHomes({ route, go, state, api, ui: { h, toast, topbar, tabbar, field, showErrors, clearOnInput, busy, avatar, icon }, DISTRICTS, failed });
registerWaka({ route, go, state, api, ui: { h, toast, topbar, tabbar, field, showErrors, clearOnInput, busy, avatar, icon }, failed });
registerMatch({ route, go, state, api, ui: { h, toast, topbar, tabbar, field, showErrors, clearOnInput, busy, avatar, icon }, DISTRICTS, failed });
const push = registerMessages({ route, go, state, setState, api, ui: { h, toast, topbar, tabbar, field, showErrors, clearOnInput, busy, avatar, icon }, failed });

route('/404', {}, async () => `${topbar('Not found', '/home')}<div class="placeholder"><div class="h-md">That page does not exist</div><a class="btn btn-ink" href="#/home" style="width:auto">Go home</a></div>`);

/* ---------------- Helpers ---------------- */
function setBadge(n) { const tab = document.querySelector('.tab[aria-label="Inbox"]'); if (!tab) return; tab.querySelector('.tab-badge')?.remove(); if (n) tab.insertAdjacentHTML('beforeend', `<span class="tab-badge">${n}</span>`); }
const val = (f, id) => (f.querySelector('#' + id) || {}).value || '';
function kindLabel(k) { return k === 'company' ? 'Hiring' : k === 'landlord' ? 'Landlord' : 'Resident'; }

async function signedIn(r) { setState({ user: r.user }); go(r.next === 'onboarding' ? '/onboarding' : '/home'); }

function failed(el, err) {
  if (err && err.fields) { showErrors(el, err.fields); return; }
  toast((err && err.message) || 'Something went wrong. Please try again.');
}

/* Google Identity Services. Needs google_client_id in api/config.php and a <meta name="google-client-id"> on the page.
   In preview mode the button signs in a local demo account instead. */
function mountGoogle(el) {
  const btns = el.querySelectorAll('[data-google]');
  const clientId = document.querySelector('meta[name="google-client-id"]')?.content;
  btns.forEach((b) => b.addEventListener('click', async () => {
    if (api.isMock()) { busy(b, true); try { await signedIn(await api.google('mock')); } catch (e) { busy(b, false); failed(el, e); } return; }
    if (!clientId || !window.google?.accounts?.id) { toast('Google sign-in is not set up yet. Add your Google client ID in config.'); return; }
    window.google.accounts.id.initialize({ client_id: clientId, callback: async (resp) => { busy(b, true); try { await signedIn(await api.google(resp.credential)); } catch (e) { busy(b, false); failed(el, e); } }, ux_mode: 'popup' });
    window.google.accounts.id.prompt((n) => { if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) toast('Google sign-in did not open. Check pop-ups, or use email.'); });
  }));
}

/* ---------------- Boot ---------------- */
(async function boot() {
  applyTheme(state.theme);
  const mode = await detectApi();
  if (mode === 'mock') toast('Preview mode: no server, data stays on this phone', 3200);
  try { const r = await api.me(); state.user = r.user; } catch { state.user = null; }
  setState({ booted: true });
  if (!location.hash) go(state.user ? '/home' : '/welcome');
  render();
  setInterval(async () => { if (state.user && !document.hidden && !api.isMock()) { try { const t = await api.today(); if (t.unread !== state.unread) { state.unread = t.unread; setBadge(t.unread); } } catch {} } }, 60000);
  if ('serviceWorker' in navigator && !api.isMock() && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
