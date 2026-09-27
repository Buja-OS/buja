#!/usr/bin/env python3
"""
Buja smoke tests: about fifty quick checks that the main things still work after a change.

  Local (full, creates test data):  python3 tests/smoke.py http://localhost:8091
  Live (read-only, safe anytime):   python3 tests/smoke.py https://buja.onrender.com --live

Local mode expects the test database with the usual test people (password "correct horse"):
kemi (customer), tunde (admin), chidi (a business on Buja), and the server started with
PAYSTACK_MOCK=1 and SMS_MOCK=1 so nothing real is charged or texted.
No packages needed: plain Python 3.
"""
import json, sys, time, random, http.cookiejar, urllib.request, urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'http://localhost:8091').rstrip('/')
LIVE = '--live' in sys.argv
PASSWORD = 'correct horse'
results = []


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect())

    def call(self, method, path, body=None, raw=False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(path if path.startswith('http') else BASE + '/api' + path,
                                     data=data, method=method, headers={'Content-Type': 'application/json', 'X-Buja-Client': 'pwa', 'Origin': BASE})
        try:
            r = self.op.open(req, timeout=40); code, text = r.status, r.read()
        except urllib.error.HTTPError as e:
            code, text = e.code, e.read()
        if raw: return code, text
        try: return code, json.loads(text.decode() or 'null')
        except Exception: return code, None

    def login(self, who):
        return self.call('POST', '/auth/login', {'identifier': who + '@example.com', 'password': PASSWORD})


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('  PASS ' if ok else '  FAIL ') + name + ('' if ok else '  -> ' + str(detail)[:200]))
    return ok


def section(t): print('\n' + t)


# ---------------------------------------------------------------- read-only checks (live and local)
anon = Client()
section('Server')
c, h = anon.call('GET', '/health'); check('health answers', c == 200 and h and h.get('ok'), (c, h))
check('database reachable', h and h.get('db') == 'ok', h)
c, t = anon.call('GET', '/ping', raw=True); check('keep-alive ping', c == 200 and t.startswith(b'ok'), c)
c, t = anon.call('GET', BASE + '/', raw=True); check('app shell loads', c == 200 and b'<div id="app"' in t, c)
c, t = anon.call('GET', BASE + '/sw.js', raw=True); check('service worker served', c == 200 and b'VERSION' in t, c)
c, t = anon.call('GET', BASE + '/p/', raw=True); check('public pages load', c in (200, 301, 302), c)
c, r = anon.call('GET', '/me'); check('signed-out /me has nobody', c == 200 and r and r.get('user') is None, (c, r))
c, _ = anon.call('GET', '/safety/trip/notarealtoken'); check('bad trip link says not found', c == 404, c)
c, _ = anon.call('POST', '/auth/login', {'identifier': 'nobody@example.com', 'password': 'wrong password'}); check('wrong password refused', c in (401, 429), c)
c, _ = anon.call('GET', '/admin/system'); check('admin pages need sign-in', c == 401, c)

if LIVE:
    fails = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(fails)} of {len(results)} passed (live, read-only).')
    sys.exit(1 if fails else 0)

# ---------------------------------------------------------------- local: full flows
kemi, tunde, chidi = Client(), Client(), Client()
section('Sign in')
c, r = kemi.login('kemi'); check('email sign-in', c == 200 and r.get('user'), (c, r))
c, r = tunde.login('tunde'); check('admin sign-in', c == 200, (c, r))
c, r = chidi.login('chidi'); check('business sign-in', c == 200, (c, r))
c, r = kemi.call('GET', '/me'); check('/me returns the person', c == 200 and r['user']['name'], r)
c, r = kemi.call('PATCH', '/me', {'lang': 'pcm'}); check('language saves (Pidgin)', c == 200 and r['user'].get('lang') == 'pcm', r)
kemi.call('PATCH', '/me', {'lang': 'en'})

section('Phone sign-in')
phone = '0809' + str(random.randint(1000000, 9999999))
p = Client()
c, r = p.call('POST', '/auth/otp/request', {'phone': phone})
if check('code is sent', c == 200 and r.get('sent'), (c, r)) and r.get('devCode'):
    code = r['devCode']
    c, r2 = p.call('POST', '/auth/otp/verify', {'phone': phone, 'code': '000000' if code != '000000' else '111111'}); check('wrong code refused', c == 422, (c, r2))
    c, r2 = p.call('POST', '/auth/otp/verify', {'phone': phone, 'code': code}); check('new number asks for a name', c == 200 and r2.get('needName'), (c, r2))
    c, r2 = p.call('POST', '/auth/otp/verify', {'phone': phone, 'code': code, 'name': 'Smoke Test', 'agree': True}); check('account created from phone', c == 201 and r2['user']['phoneVerified'], (c, r2))
    check('phone account has no fake email showing', r2['user'].get('email') is None, r2)
    c, r2 = p.call('POST', '/auth/otp/verify', {'phone': phone, 'code': code}); check('a used code cannot be reused', c == 422, (c, r2))
else:
    check('SMS_MOCK is on for local tests', False, 'start the server with SMS_MOCK=1')

section('Every screen answers (no server errors)')
c, r = kemi.call('GET', '/jobs'); check('Work: jobs list', c == 200, c)
c, r = kemi.call('GET', '/waka/routes'); check('Waka: routes', c == 200, c)
c, r = kemi.call('GET', '/me/today'); check('Home: today', c == 200, c)
c, r = kemi.call('GET', '/notifications'); check('Notifications', c == 200, c)
c, r = kemi.call('GET', '/inbox'); check('Inbox', c == 200, c)
c, r = kemi.call('GET', '/safety'); check('Trip Share', c == 200, c)
c, r = kemi.call('GET', '/service-jobs'); check('My jobs', c == 200, c)
c, r = kemi.call('GET', '/kart/me'); check('Buja Kart profile', c in (200, 404), c)
c, r = tunde.call('GET', '/admin/overview'); check('Admin dashboard', c == 200, c)
c, r = tunde.call('GET', '/admin/launch'); check('Launch checklist', c == 200, c)
c, r = tunde.call('GET', '/admin/system'); check('System check', c == 200 and r.get('checks'), c)
m045 = next((x for x in (r or {}).get('checks', []) if x['id'] == 'm045'), None)
check('migration 045 installed', m045 and m045['ok'], m045)
c, r = kemi.call('GET', '/admin/system'); check('non-admins kept out of System', c == 403, c)

section('Errors and backup')
c, r = kemi.call('POST', '/errors', {'message': 'SmokeTest: fake error ' + str(int(time.time())), 'where': 'smoke.py:1:1', 'path': '/home'}); check('phone error accepted', c == 200, (c, r))
c, r = tunde.call('GET', '/admin/errors'); check('error appears for the admin', c == 200 and any('SmokeTest' in e['message'] for e in r['errors']), c)
c, t = tunde.call('GET', '/admin/backup?media=0', raw=True); check('backup downloads (gzip)', c == 200 and t[:2] == b'\x1f\x8b', (c, t[:20]))

section('SOS')
kemi.call('POST', '/safety/end', {'status': 'safe'})
c, r = kemi.call('GET', '/safety')
if not r['contacts']: kemi.call('POST', '/safety/contacts', {'name': 'Smoke contact', 'phone': '08031112233'})
c, r = kemi.call('POST', '/safety/sos', {'lat': 9.06, 'lng': 7.49}); check('SOS raised', c in (200, 201) and r['trip']['status'] == 'sos', (c, r))
token = (r or {}).get('trip', {}).get('token')
if token:
    c, r2 = anon.call('GET', '/safety/trip/' + token); check('contact link shows SOS without sign-in', c == 200 and r2['trip']['status'] == 'sos', (c, r2))
c, r = kemi.call('POST', '/safety/ping', {'lat': 9.061, 'lng': 7.491}); check('SOS keeps receiving positions', c == 200 and r.get('active'), (c, r))
c, r = kemi.call('POST', '/safety/end', {'status': 'safe'}); check('SOS ends with "I am safe"', c == 200 and r['trip']['status'] == 'safe', (c, r))

section('Artisan job, Buja Guarantee')
chidi_id = chidi.call('GET', '/me')[1]['user']['id']
for j in kemi.call('GET', '/service-jobs')[1]['jobs']:
    if j['status'] in ('requested', 'accepted', 'enroute', 'arrived') and j['role'] == 'customer': kemi.call('POST', f"/service-jobs/{j['id']}/cancel")
c, r = kemi.call('POST', '/service-jobs', {'artisanId': chidi_id, 'problem': 'Smoke test: kitchen tap leaking', 'lat': 9.06, 'lng': 7.49}); check('job requested', c == 201, (c, r))
jid = (r or {}).get('id')
if jid:
    c, r = chidi.call('POST', f'/service-jobs/{jid}/accept'); check('artisan accepts', c == 200 and r['job']['status'] == 'accepted', (c, r))
    c, r = chidi.call('POST', f'/service-jobs/{jid}/quote', {'amount': 12000, 'note': 'tap and fitting'}); check('artisan sends a price', c == 200, (c, r))
    c, r = kemi.call('POST', f'/service-jobs/{jid}/quote/accept'); check('customer accepts the price', c == 200 and r['job']['guarantee']['canPay'], (c, r))
    c, r = kemi.call('POST', f'/service-jobs/{jid}/pay', {'pay': 'transfer'}); check('pay by bank transfer starts', c == 201 and r.get('payUrl'), (c, r))
    if r and r.get('payUrl'):
        c, _ = anon.call('GET', r['payUrl'], raw=True); check('payment settles (mock)', c in (301, 302), c)
    c, r = kemi.call('GET', f'/service-jobs/{jid}'); check('money is held by Buja', r['job']['guarantee']['held'] and r['job']['pay']['status'] == 'paid', r['job'].get('pay'))
    c, r = kemi.call('POST', f'/service-jobs/{jid}/noshow'); check('no-show too early is refused', c == 422, (c, r))
    c, r = chidi.call('POST', f'/service-jobs/{jid}/start', {'lat': 9.07, 'lng': 7.48}); check('artisan sets off (live tracking)', c == 200 and r['job']['status'] == 'enroute', (c, r))
    c, r = chidi.call('POST', f'/service-jobs/{jid}/ping', {'lat': 9.065, 'lng': 7.485}); check('arrival tracking ping', c == 200, (c, r))
    c, r = chidi.call('POST', f'/service-jobs/{jid}/arrived'); check('artisan arrives', c == 200 and r['job']['status'] == 'arrived', (c, r))
    c, r = kemi.call('POST', f'/service-jobs/{jid}/received'); check('customer confirms, money released', c == 200 and r['job']['pay']['status'] == 'released', (c, r))

section('Summary')
fails = [r for r in results if not r[1]]
print(f'{len(results) - len(fails)} of {len(results)} passed.')
for n, _, d in fails: print('  FAILED: ' + n)
sys.exit(1 if fails else 0)
