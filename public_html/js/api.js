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
  sendMessage:     (id, body, uploadId) => request('POST', '/threads/' + id + '/messages', { body, uploadId }),
  openThread:      (applicationId) => request('POST', '/applications/' + applicationId + '/thread'),
  scheduleInterview: (threadId, b) => request('POST', '/threads/' + threadId + '/interview', b),
  respond:         (messageId, b) => request('POST', '/messages/' + messageId + '/respond', b),
  today:           () => request('GET', '/me/today'),
  pushKey:         () => request('GET', '/push/key'),
  pushSubscribe:   (sub) => request('POST', '/push/subscribe', sub),
  pushUnsubscribe: (endpoint) => request('DELETE', '/push/subscribe', { endpoint }),
  pushTest:        () => request('POST', '/push/test'),
  saveNotifyPrefs: (b) => request('PATCH', '/me/notifications', b),
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
  reportMatch:     (user, reason) => request('POST', '/match/report', { user, reason }),
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
  // Ask
  ask:             (question, history, at) => request('POST', '/ask', { question, history, lat: at ? at.lat : undefined, lng: at ? at.lng : undefined }),
  spots:           (q) => request('GET', '/spots' + qs({ q })),
  spot:            (id) => request('GET', '/spots/' + id),
  rateSpot:        (id, stars, comment) => request('POST', '/spots/' + id + '/rate', { stars, comment }),
  addSpot:         (b) => request('POST', '/spots', b),
  // Trust and money
  payStatus:       () => request('GET', '/pay/status'),
  payPlus:         () => request('POST', '/pay/plus'),
  verifyStatus:    () => request('GET', '/verify/status'),
  verifySubmit:    (kind, file) => { const fd = new FormData(); fd.append('file', file); return upload('/verify/' + kind, fd); },
  adminOverview:   () => request('GET', '/admin/overview'),
  adminVerifications: () => request('GET', '/admin/verifications'),
  adminDecide:     (id, action, note) => request('POST', '/admin/verifications/' + id, { action, note }),
  adminReports:    () => request('GET', '/admin/reports'),
  adminDecideReport: (id, action) => request('POST', '/admin/reports/' + id, { action }),
  adminSpots:      () => request('GET', '/admin/spots'),
  adminDecideSpot: (id, action) => request('POST', '/admin/spots/' + id, { action }),
  adminStorageTest: () => request('POST', '/admin/storage/test'),
  adminMigrate:    () => request('POST', '/admin/storage/migrate', { batch: 20 }),
  syncRadio:       () => request('POST', '/admin/radio/sync'),
  upload:          (file, kind, extra) => { const fd = new FormData(); fd.append('file', file); fd.append('kind', kind); if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v)); return upload('/uploads', fd); },
  pinLocation:     (b) => request('POST', '/uploads/location', b),
  setCompanyLogo:  (uploadId) => request('POST', '/company/logo', { uploadId }),
  notifications:   () => request('GET', '/notifications'),
  readNotifications: (b) => request('POST', '/notifications/read', b),
  uploadAvatar:    (file) => { const fd = new FormData(); fd.append('photo', file); return upload('/me/avatar', fd); },
  deleteAvatar:    () => request('DELETE', '/me/avatar'),
  adminUsers:      (f) => request('GET', '/admin/users' + qs(f)),
  adminUser:       (id) => request('GET', '/admin/users/' + id),
  adminUserAction: (id, b) => request('POST', '/admin/users/' + id, b),
  adminInvite:     (email, role) => request('POST', '/admin/invite', { email, role }),
  adminAnalytics:  (days) => request('GET', '/admin/analytics' + qs({ days })),
  // City: news, social, radio
  news:            (category) => request('GET', '/news' + qs({ category })),
  refreshNews:     () => request('POST', '/news/refresh'),
  social:          (f) => request('GET', '/social' + qs(f)),
  post:            (id) => request('GET', '/social/' + id),
  createPost:      (b) => request('POST', '/social', b),
  newsItem:        (id) => request('GET', '/news/' + id),
  adminSocial:     (f) => request('GET', '/admin/social' + qs(f)),
  adminSocialAct:  (id, a) => request('POST', '/admin/social/' + id + '/' + a),
  adminNews:       () => request('GET', '/admin/news'),
  adminNewsAct:    (id, a) => request('POST', '/admin/news/' + id + '/' + a),
  replyPost:       (id, body, uploadId) => request('POST', '/social/' + id + '/reply', { body, uploadId }),
  likeSocial:      (kind, id) => request('POST', '/social/' + kind + '/' + id + '/like'),
  deletePost:      (id) => request('DELETE', '/social/' + id),
  radio:           () => request('GET', '/radio'),
  setStream:       (id, stream) => request('PATCH', '/radio/' + id, { stream }),
  matchSuggest:    () => request('POST', '/match/suggest'),
  setLocation:     (lat, lng) => request('POST', '/me/location', { lat, lng }),
  clearLocation:   () => request('DELETE', '/me/location'),
  safety:          () => request('GET', '/safety'),
  addContact:      (b) => request('POST', '/safety/contacts', b),
  removeContact:   (id) => request('DELETE', '/safety/contacts/' + id),
  startTrip:       (b) => request('POST', '/safety/start', b),
  pingTrip:        (lat, lng) => request('POST', '/safety/ping', { lat, lng }),
  endTrip:         (b) => request('POST', '/safety/end', b),
  publicTrip:      (token) => request('GET', '/safety/trip/' + token),
  startRide:       (b) => request('POST', '/safety/ride', b),
  boardCheck:      (f) => request('GET', '/safety/board' + qs(f)),
  fareAsked:       (id) => request('POST', '/safety/fare-asked', { id }),
  search:          (q) => request('GET', '/search' + qs({ q })),
  myInvite:        () => request('GET', '/me/invite'),
  inviteInfo:      (code) => request('GET', '/invite/' + code),
  report:          (kind, id, reason) => request('POST', '/report', { kind, id, reason }),
  startCall:       (threadId, mode, startsAt) => request('POST', '/threads/' + threadId + '/call', { mode, startsAt }),
  call:            (room) => request('GET', '/call/' + room),
  endCall:         (room) => request('POST', '/call/' + room + '/end'),
  callSignal:      (room, kind, payload) => request('POST', '/call/' + room + '/signal', { kind, payload }),
  callSignals:     (room, since) => request('GET', '/call/' + room + '/signals' + qs({ since })),
  incomingCall:    () => request('GET', '/calls/incoming'),
  declineCall:     (room) => request('POST', '/call/' + room + '/decline'),
  weather:         () => request('GET', '/weather'),
  addSpotPhoto:    (id, uploadId) => request('POST', '/spots/' + id + '/photos', { uploadId }),
  removeSpotPhoto: (id) => request('DELETE', '/spots/photos/' + id),
  savedSearches:   () => request('GET', '/saved-searches'),
  saveSearch:      (b) => request('POST', '/saved-searches', b),
  alertToggle:     (id, alerts) => request('PATCH', '/saved-searches/' + id, { alerts }),
  removeSearch:    (id) => request('DELETE', '/saved-searches/' + id),
  userRatings:     (id) => request('GET', '/users/' + id + '/ratings'),
  ratingStatus:    (id) => request('GET', '/threads/' + id + '/rating'),
  rateThread:      (id, b) => request('POST', '/threads/' + id + '/rate', b),
  wakaAlerts:      () => request('GET', '/waka/alerts'),
  reportAlert:     (b) => request('POST', '/waka/alerts', b),
  voteAlert:       (id, vote) => request('POST', '/waka/alerts/' + id + '/vote', { vote }),
  digest:          () => request('GET', '/me/digest'),
  events:          (f) => request('GET', '/events' + qs(f)),
  event:           (id) => request('GET', '/events/' + id),
  createEvent:     (b) => request('POST', '/events', b),
  rsvpEvent:       (id, b) => request('POST', '/events/' + id + '/rsvp', b),
  eventPost:       (id, body) => request('POST', '/events/' + id + '/posts', { body }),
  cancelEvent:     (id) => request('POST', '/events/' + id + '/cancel'),
  cancelEventSeries: (id, series) => request('POST', '/events/' + id + '/cancel', { series }),
  checkinEvent:    (id, userId) => request('POST', '/events/' + id + '/checkin', { userId }),
  artisans:        (f) => request('GET', '/artisans' + qs(f)),
  artisan:         (id) => request('GET', '/artisans/' + id),
  artisanMe:       () => request('GET', '/artisans/me'),
  artisanSave:     (b) => request('POST', '/artisans/me', b),
  artisanDashboard:() => request('GET', '/artisans/dashboard'),
  artisanSchedule: (b) => request('POST', '/artisans/schedule', b),
  jobQuote:        (id, b) => request('POST', '/service-jobs/' + id + '/quote', b),
  jobQuoteAnswer:  (id, answer) => request('POST', '/service-jobs/' + id + '/quote/' + answer),
  deleteMe:        (confirm) => request('POST', '/me/delete', { confirm }),
  artisanOnline:   (available) => request('POST', '/artisans/me/online', { available }),
  jobNearest:      (b) => request('POST', '/service-jobs/nearest', b),
  adsConfig:       () => request('GET', '/ads/config'),
  adminAds:        () => request('GET', '/admin/ads'),
  adminAdsSave:    (b) => request('POST', '/admin/ads', b),
  jobOffers:       () => request('GET', '/service-jobs/offers'),
  jobWhere:        (id, b) => request('POST', '/service-jobs/' + id + '/where', b),
  artisanChat:     (id) => request('POST', '/artisans/' + id + '/chat'),
  serviceJobs:     () => request('GET', '/service-jobs'),
  friends:         () => request('GET', '/friends'),
  friendAdd:       (b) => request('POST', '/friends', b),
  friendAct:       (id, action) => request('POST', '/friends/' + id + '/' + action),
  myArtisans:      () => request('GET', '/artisans/mine'),
  saveArtisan:     (id) => request('POST', '/artisans/' + id + '/save'),
  kartGarage:      () => request('GET', '/kart/garage'),
  kartUpgrade:     (stat) => request('POST', '/kart/garage/upgrade', { stat }),
  kartPaint:       (paint) => request('POST', '/kart/garage/paint', { paint }),
  myTag:           (tryTag) => request('GET', '/me/tag' + (tryTag != null ? '?try=' + encodeURIComponent(tryTag) : '')),
  setTag:          (tag) => request('POST', '/me/tag', { tag }),
  tagFind:         (tag) => request('GET', '/tag/' + encodeURIComponent(tag.replace(/^@/, ''))),
  tagSearch:       (q) => request('GET', '/tags?q=' + encodeURIComponent(q.replace(/^@/, ''))),
  kartBoard:       (f) => request('GET', '/kart/board' + qs(f)),
  kartSaveTime:    (b) => request('POST', '/kart/times', b),
  kartGhost:       (f) => request('GET', '/kart/ghost' + qs(f)),
  kartNewRoom:     (b) => request('POST', '/kart/rooms', b),
  kartJoin:        (code) => request('POST', '/kart/rooms/' + code + '/join'),
  kartInvite:      (code, tag) => request('POST', '/kart/rooms/' + code + '/invite', { tag }),
  kartSync:        (code, b) => request('POST', '/kart/rooms/' + code + '/sync', b || {}),
  kartStart:       (code) => request('POST', '/kart/rooms/' + code + '/start'),
  kartFinish:      (code, ms) => request('POST', '/kart/rooms/' + code + '/finish', { ms }),
  kartChat:        (code, body) => request('POST', '/kart/rooms/' + code + '/chat', { body }),
  serviceJob:      (id) => request('GET', '/service-jobs/' + id),
  jobCreate:       (b) => request('POST', '/service-jobs', b),
  jobAct:          (id, action, b) => request('POST', '/service-jobs/' + id + '/' + action, b || {}),
  jobPing:         (id, b) => request('POST', '/service-jobs/' + id + '/ping', b),
  jobRate:         (id, b) => request('POST', '/service-jobs/' + id + '/rate', b),
  wakaPricing:     () => request('GET', '/waka/pricing'),
  setWakaPricing:  (b) => request('POST', '/admin/waka/pricing', b),
  road:            (pts) => request('GET', '/route?pts=' + pts.map((p) => p[0] + ',' + p[1]).join(';')),
  agencies:        (category) => request('GET', '/citizen/agencies' + qs({ category })),
  citizenReport:   (b) => request('POST', '/citizen/reports', b),
  myReports:       () => request('GET', '/citizen/reports'),
  buyTicket:       (id, qty) => request('POST', '/events/' + id + '/tickets', { qty }),
  scanTicket:      (id, code) => request('POST', '/events/' + id + '/scan', { code }),
  eventSales:      (id) => request('GET', '/events/' + id + '/sales'),
  myTickets:       () => request('GET', '/tickets/mine'),
  adminMeetups:    () => request('GET', '/admin/meetups'),
  adminMeetup:     (id, action) => request('POST', '/admin/meetups/' + id, { action }),
  adminArtisans:   () => request('GET', '/admin/artisans'),
  adminArtisan:    (id, action) => request('POST', '/admin/artisans/' + id, { action }),
  adminCitizen:    () => request('GET', '/admin/citizen'),
  passkeys:        () => request('GET', '/auth/passkeys'),
  launch:          () => request('GET', '/admin/launch'),
  importSpots:     (category) => request('POST', '/admin/spots-import', { category }),
  light:           () => request('GET', '/light'),
  lightReport:     (b) => request('POST', '/light/report', b),
  fuel:            (f) => request('GET', '/fuel' + qs(f)),
  fuelStation:     (b) => request('POST', '/fuel/stations', b),
  fuelReport:      (id, b) => request('POST', '/fuel/' + id + '/report', b),
  fuelImport:      () => request('POST', '/fuel/import'),
  blood:           () => request('GET', '/blood'),
  donorSave:       (b) => request('POST', '/blood/me', b),
  bloodRequest:    (b) => request('POST', '/blood/request', b),
  bloodRespond:    (id) => request('POST', '/blood/requests/' + id + '/respond'),
  bloodClose:      (id, fulfilled) => request('POST', '/blood/requests/' + id + '/close', { fulfilled }),
  lostFound:       (f) => request('GET', '/lostfound' + qs(f)),
  lostFoundCreate: (b) => request('POST', '/lostfound', b),
  lostFoundClose:  (id) => request('POST', '/lostfound/' + id + '/close'),
  lostFoundContact:(id) => request('POST', '/lostfound/' + id + '/contact'),
  plateCheck:      (plate) => request('GET', '/plates/check' + qs({ plate })),
  plateReport:     (b) => request('POST', '/plates/report', b),
  prices:          () => request('GET', '/prices'),
  priceReport:     (b) => request('POST', '/prices/report', b),
  learn:           () => request('GET', '/learn'),
  learnCourse:     (slug) => request('GET', '/learn/' + slug),
  learnLesson:     (slug, n) => request('GET', '/learn/' + slug + '/' + n),
  learnSave:       (slug, n, code) => request('POST', '/learn/' + slug + '/' + n + '/save', { code }),
  learnComplete:   (slug, n, b) => request('POST', '/learn/' + slug + '/' + n + '/complete', b),
  learnCertificate:(slug) => request('GET', '/learn/' + slug + '/certificate'),
  myCertificates:  () => request('GET', '/learn/certificates'),
  verifyCertificate:(code) => request('GET', '/cert/' + encodeURIComponent(code)),
  queues:          (f) => request('GET', '/queues' + qs(f)),
  queueReport:     (id, b) => request('POST', '/queues/' + id + '/report', b),
  queueOffice:     (b) => request('POST', '/queues/offices', b),
  rides:           (f) => request('GET', '/rides' + qs(f)),
  rideCreate:      (b) => request('POST', '/rides', b),
  rideAsk:         (id) => request('POST', '/rides/' + id + '/ask'),
  rideDecide:      (id, b) => request('POST', '/rides/' + id + '/decide', b),
  rideStop:        (id) => request('POST', '/rides/' + id + '/stop'),
  rentIndex:       () => request('GET', '/rent-index'),
  adminLearn:      () => request('GET', '/admin/learn'),
  adminLearners:   (f) => request('GET', '/admin/learners' + qs(f)),
  adminUserLearning:(id) => request('GET', '/admin/users/' + id + '/learning'),
  adminNotifyUser: (id, b) => request('POST', '/admin/users/' + id + '/notify', b),
  adminNudgeUser:  (id) => request('POST', '/admin/users/' + id + '/nudge'),
  adminSubmission: (id, course, n) => request('GET', '/admin/users/' + id + '/learning/' + course + '/' + n),
  learnContinue:   () => request('GET', '/learn/continue'),
  adminBroadcasts: () => request('GET', '/admin/broadcasts'),
  adminBroadcastCount:(f) => request('GET', '/admin/broadcasts/count' + qs(f)),
  adminBroadcastSend:(b) => request('POST', '/admin/broadcasts', b),
  meEngage:        () => request('GET', '/me/engage'),
  pushAsked:       () => request('POST', '/me/engage/asked'),
  passkeyRegisterOptions: () => request('POST', '/auth/passkey/register/options'),
  passkeyRegister: (b) => request('POST', '/auth/passkey/register', b),
  passkeyLoginOptions: (identifier) => request('POST', '/auth/passkey/login/options', { identifier }),
  passkeyLogin:    (b) => request('POST', '/auth/passkey/login', b),
  passkeyRemove:   (id) => request('DELETE', '/auth/passkeys/' + id),
};

/* Detect the API once at boot. If /api/health is not there, switch to mock mode and say so. */
export const serverInfo = { googleClientId: '' };
export async function detectApi() {
  if (mock) return 'mock';
  try {
    const h = await request('GET', '/health');
    if (h && h.googleClientId) serverInfo.googleClientId = h.googleClientId;
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
  if (path.startsWith('/jobs') || path.startsWith('/company') || path.startsWith('/me/') || path.startsWith('/inbox') || path.startsWith('/threads') || path.startsWith('/push') || path.startsWith('/messages') || path.startsWith('/applications') || path.startsWith('/match') || path.startsWith('/waka') || path.startsWith('/homes') || path.startsWith('/landlord') || path.startsWith('/declutter') || path.startsWith('/ask') || path.startsWith('/spots') || path.startsWith('/pay') || path.startsWith('/verify') || path.startsWith('/admin') || path.startsWith('/notifications') || path.startsWith('/avatar') || path.startsWith('/news') || path.startsWith('/social') || path.startsWith('/radio') || path.startsWith('/uploads') || path.startsWith('/safety') || path.startsWith('/search') || path.startsWith('/report') || path.startsWith('/invite') || path.startsWith('/call') || path.startsWith('/weather') || path.startsWith('/saved-searches') || path.startsWith('/spots') || path.startsWith('/users') || path.startsWith('/waka/alerts') || path.startsWith('/events') || path.startsWith('/artisans') || path.startsWith('/citizen') || path.startsWith('/tickets') || path.startsWith('/light') || path.startsWith('/fuel') || path.startsWith('/blood') || path.startsWith('/lostfound') || path.startsWith('/plates') || path.startsWith('/prices') || path.startsWith('/learn') || path.startsWith('/cert/') || path.startsWith('/queues') || path.startsWith('/rides') || path.startsWith('/rent-index') || path.startsWith('/service-jobs') || path.startsWith('/route') || path.startsWith('/kart') || path.startsWith('/tag') || path.startsWith('/me/tag') || path.startsWith('/friends') || path.startsWith('/artisans/mine')) throw { error: 'mock', message: 'Work needs the live server. Open buja.onrender.com.' };
  if (path === '/me' && method === 'PATCH') {
    const u = me(); if (!u) throw { error: 'unauthenticated', message: 'Please sign in.' };
    Object.assign(u, body); msave(d); return { user: pub(u) };
  }
  throw { error: 'not_found', message: 'No such endpoint.' };
}
