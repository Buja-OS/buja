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

async function upload(path, formData) {
  if (mock) throw { error: 'mock', message: 'This needs the live server.' };
  let res;
  try { res = await fetch('/api' + path, { method: 'POST', headers: { 'X-Buja-Client': 'pwa' }, credentials: 'same-origin', body: formData }); }
  catch { throw { error: 'network', message: navigator.onLine ? 'Could not reach Buja. Please try again.' : 'You are offline.' }; }
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) throw (data || { error: 'http_' + res.status, message: 'Something went wrong (' + res.status + ').' });
  return data;
}
const qs = (o) => { const p = Object.entries(o || {}).filter(([, v]) => v !== '' && v != null); return p.length ? '?' + new URLSearchParams(p).toString() : ''; };

export const api = {
  health:   () => request('GET', '/health'),
  me:       () => request('GET', '/me'),
  register: (b) => request('POST', '/auth/register', b),
  login:    (b) => request('POST', '/auth/login', b),
  google:   (credential) => request('POST', '/auth/google', { credential }),
  logout:   () => request('POST', '/auth/logout'),
  updateMe: (b) => request('PATCH', '/me', b),
  isMock:   () => mock,
  // Work
  jobs:            (f) => request('GET', '/jobs' + qs(f)),
  job:             (id) => request('GET', '/jobs/' + id),
  apply:           (id, b) => request('POST', '/jobs/' + id + '/apply', b),
  saveJob:         (id) => request('POST', '/jobs/' + id + '/save'),
  unsaveJob:       (id) => request('DELETE', '/jobs/' + id + '/save'),
  myApplications:  () => request('GET', '/me/applications'),
  seeker:          () => request('GET', '/me/seeker'),
  updateSeeker:    (b) => request('PATCH', '/me/seeker', b),
  uploadCv:        (file) => { const fd = new FormData(); fd.append('cv', file); return upload('/me/cv', fd); },
  deleteCv:        () => request('DELETE', '/me/cv'),
  company:         () => request('GET', '/company'),
  saveCompany:     (b) => request('POST', '/company', b),
  companyJobs:     () => request('GET', '/company/jobs'),
  createJob:       (b) => request('POST', '/company/jobs', b),
  updateJob:       (id, b) => request('PATCH', '/company/jobs/' + id, b),
  applicants:      (id, status) => request('GET', '/company/jobs/' + id + '/applications' + qs({ status })),
  setApplication:  (id, status) => request('PATCH', '/company/applications/' + id, { status }),
  // Messages, interviews, push, account
  inbox:           () => request('GET', '/inbox'),
  thread:          (id, after) => request('GET', '/threads/' + id + qs({ after })),
  sendMessage:     (id, body) => request('POST', '/threads/' + id + '/messages', { body }),
  openThread:      (applicationId) => request('POST', '/applications/' + applicationId + '/thread'),
  invite:          (threadId, b) => request('POST', '/threads/' + threadId + '/interview', b),
  respond:         (messageId, b) => request('POST', '/messages/' + messageId + '/respond', b),
  today:           () => request('GET', '/me/today'),
  pushKey:         () => request('GET', '/push/key'),
  pushSubscribe:   (sub) => request('POST', '/push/subscribe', sub),
  pushUnsubscribe: (endpoint) => request('DELETE', '/push/subscribe', { endpoint }),
  pushTest:        () => request('POST', '/push/test'),
  notifications:   (b) => request('PATCH', '/me/notifications', b),
  forgot:          (email) => request('POST', '/auth/forgot', { email }),
  reset:           (token, password) => request('POST', '/auth/reset', { token, password }),
  resendVerify:    () => request('POST', '/auth/resend-verification'),
  // Match
  matchMe:         () => request('GET', '/match/me'),
  matchUpdate:     (b) => request('PATCH', '/match/me', b),
  addPhoto:        (file) => { const fd = new FormData(); fd.append('photo', file); return upload('/match/photos', fd); },
  deletePhoto:     (id) => request('DELETE', '/match/photos/' + id),
  reorderPhotos:   (order) => request('PATCH', '/match/photos', { order }),
  discover:        () => request('GET', '/match/discover'),
  matchProfile:    (id) => request('GET', '/match/profile/' + id),
  swipe:           (to, action) => request('POST', '/match/swipe', { to, action }),
  matches:         () => request('GET', '/match/matches'),
  likes:           () => request('GET', '/match/likes'),
  block:           (user) => request('POST', '/match/block', { user }),
  report:          (user, reason) => request('POST', '/match/report', { user, reason }),
  // Waka
  wakaPlaces:      (q) => request('GET', '/waka/places' + qs({ q })),
  wakaRoutes:      () => request('GET', '/waka/routes'),
  wakaRoute:       (id) => request('GET', '/waka/routes/' + id),
  wakaPlan:        (from, to) => request('GET', '/waka/plan' + qs({ from, to })),
  wakaReportFare:  (routeId, from, to, amount) => request('POST', '/waka/fares', { routeId, from, to, amount }),
  wakaCheckin:     (routeId) => request('POST', '/waka/checkin', { routeId }),
  wakaSaved:       () => request('GET', '/waka/saved'),
  wakaSave:        (from, to, label) => request('POST', '/waka/saved', { from, to, label }),
  wakaUnsave:      (id) => request('DELETE', '/waka/saved/' + id),
  // Homes
  homes:           (f) => request('GET', '/homes' + qs(f)),
  home:            (id) => request('GET', '/homes/' + id),
  homesSaved:      () => request('GET', '/homes/saved'),
  homesSave:       (id) => request('POST', '/homes/' + id + '/save'),
  homesUnsave:     (id) => request('DELETE', '/homes/' + id + '/save'),
  enquire:         (id) => request('POST', '/homes/' + id + '/enquire'),
  requestInspection: (threadId, b) => request('POST', '/threads/' + threadId + '/inspection', b),
  landlordMe:      () => request('GET', '/landlord/me'),
  landlordSave:    (b) => request('POST', '/landlord/me', b),
  landlordProperties: () => request('GET', '/landlord/properties'),
  createHome:      (b) => request('POST', '/homes', b),
  updateHome:      (id, b) => request('PATCH', '/homes/' + id, b),
  addHomePhoto:    (id, file) => { const fd = new FormData(); fd.append('photo', file); return upload('/homes/' + id + '/photos', fd); },
  deleteHomePhoto: (id) => request('DELETE', '/homes/photos/' + id),
  // Declutter
  declutter:       (f) => request('GET', '/declutter' + qs(f)),
  dItem:           (id) => request('GET', '/declutter/' + id),
  dSaved:          () => request('GET', '/declutter/saved'),
  dMine:           () => request('GET', '/declutter/mine'),
  dSave:           (id) => request('POST', '/declutter/' + id + '/save'),
  dUnsave:         (id) => request('DELETE', '/declutter/' + id + '/save'),
  dChat:           (id) => request('POST', '/declutter/' + id + '/chat'),
  dCreate:         (b) => request('POST', '/declutter', b),
  dUpdate:         (id, b) => request('PATCH', '/declutter/' + id, b),
  dAddPhoto:       (id, file) => { const fd = new FormData(); fd.append('photo', file); return upload('/declutter/' + id + '/photos', fd); },
  dDeletePhoto:    (id) => request('DELETE', '/declutter/photos/' + id),
  offer:           (threadId, amount) => request('POST', '/threads/' + threadId + '/offer', { amount }),
  respondOffer:    (messageId, action) => request('POST', '/messages/' + messageId + '/offer-response', { action }),
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
  if (path.startsWith('/jobs') || path.startsWith('/company') || path.startsWith('/me/') || path.startsWith('/inbox') || path.startsWith('/threads') || path.startsWith('/push') || path.startsWith('/messages') || path.startsWith('/applications') || path.startsWith('/match') || path.startsWith('/waka') || path.startsWith('/homes') || path.startsWith('/landlord') || path.startsWith('/declutter')) throw { error: 'mock', message: 'Work needs the live server. Open buja.onrender.com.' };
  if (path === '/me' && method === 'PATCH') {
    const u = me(); if (!u) throw { error: 'unauthenticated', message: 'Please sign in.' };
    Object.assign(u, body); msave(d); return { user: pub(u) };
  }
  throw { error: 'not_found', message: 'No such endpoint.' };
}
