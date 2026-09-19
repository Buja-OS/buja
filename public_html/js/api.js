// Buja API client. Talks to /api on your hosting.
// If the API is unreachable (for example in the design preview), it falls back to a local mock
// so the whole flow can still be tapped through. The mock never leaves this device.
const HEADERS = { 'Content-Type': 'application/json', 'X-Buja-Client': 'pwa' };
let mock = (typeof window !== 'undefined' && window.BUJA_MOCK === true);

async function request(method, path, body) {
  if (mock) return mockRequest(method, path, body);
  let res;
  try {
    res = await fetch('/api' + path, { method, headers: HEADERS, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw { error: 'network', message: navigator.onLine ? 'Could not reach Buja. Please try again.' : 'You are offline.' };
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw (data || { error: 'http_' + res.status, message: 'Something went wrong (' + res.status + ').' });
  return data;
}

export const api = {
  health:   () => request('GET', '/health'),
  me:       () => request('GET', '/me'),
  register: (b) => request('POST', '/auth/register', b),
  login:    (b) => request('POST', '/auth/login', b),
  google:   (credential) => request('POST', '/auth/google', { credential }),
  logout:   () => request('POST', '/auth/logout'),
  updateMe: (b) => request('PATCH', '/me', b),
  isMock:   () => mock,
};

/* Detect the API once at boot. If /api/health is not there, switch to mock mode and say so. */
export async function detectApi() {
  if (mock) return 'mock';
  try {
    const h = await request('GET', '/health');
    return h && h.ok ? 'live' : 'degraded';
  } catch (e) {
    if (e && e.error === 'network' && !navigator.onLine) return 'offline';
    mock = true;
    return 'mock';
  }
}

/* ---------- Local mock (preview only) ---------- */
const MK = 'buja.mock';
function mdb() { try { return JSON.parse(localStorage.getItem(MK)) || { users: [], session: null, seq: 1 }; } catch { return { users: [], session: null, seq: 1 }; } }
function msave(d) { localStorage.setItem(MK, JSON.stringify(d)); }
const pub = (u) => ({ id: u.id, kind: u.kind, name: u.name, email: u.email, phone: u.phone || null, district: u.district || null, avatar: u.avatar || null, verified: !!u.google, google: !!u.google });
const ngPhone = (v) => { const d = (v || '').replace(/\D+/g, ''); if (d.startsWith('234') && d.length === 13) return '+' + d; if (d.startsWith('0') && d.length === 11) return '+234' + d.slice(1); if (d.length === 10) return '+234' + d; return null; };

async function mockRequest(method, path, body) {
  await new Promise((r) => setTimeout(r, 350));
  const d = mdb();
  const me = () => d.users.find((u) => u.id === d.session) || null;
  if (path === '/health') return { ok: true, app: 'buja', phase: 1, db: 'mock' };
  if (path === '/me' && method === 'GET') return { user: me() ? pub(me()) : null };
  if (path === '/auth/register') {
    const f = {};
    if (!body.name || body.name.trim().length < 2) f.name = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || '')) f.email = 'Enter a valid email address.';
    if (!ngPhone(body.phone)) f.phone = 'Enter a valid Nigerian phone number.';
    if ((body.password || '').length < 8) f.password = 'Password must be at least 8 characters.';
    if (!body.agree) f.agree = 'You need to agree to the terms.';
    if (Object.keys(f).length) throw { error: 'validation', fields: f };
    if (d.users.some((u) => u.email === body.email.toLowerCase())) throw { error: 'validation', fields: { email: 'An account with this email already exists. Sign in instead.' } };
    const u = { id: d.seq++, kind: 'resident', name: body.name.trim(), email: body.email.toLowerCase(), phone: ngPhone(body.phone), password: body.password };
    d.users.push(u); d.session = u.id; msave(d);
    return { user: pub(u), next: 'onboarding' };
  }
  if (path === '/auth/login') {
    const id = (body.identifier || '').trim().toLowerCase();
    const u = d.users.find((x) => x.email === id || x.phone === ngPhone(id));
    if (!u || u.password !== body.password) throw { error: 'invalid_credentials', message: 'That email or phone and password do not match.' };
    d.session = u.id; msave(d);
    return { user: pub(u), next: u.district ? 'home' : 'onboarding' };
  }
  if (path === '/auth/google') {
    let u = d.users.find((x) => x.google);
    if (!u) { u = { id: d.seq++, kind: 'resident', name: 'Google user', email: 'google.user@example.com', google: true }; d.users.push(u); }
    d.session = u.id; msave(d);
    return { user: pub(u), next: u.district ? 'home' : 'onboarding' };
  }
  if (path === '/auth/logout') { d.session = null; msave(d); return { ok: true }; }
  if (path === '/me' && method === 'PATCH') {
    const u = me(); if (!u) throw { error: 'unauthenticated', message: 'Please sign in.' };
    Object.assign(u, body); msave(d); return { user: pub(u) };
  }
  throw { error: 'not_found', message: 'No such endpoint.' };
}
