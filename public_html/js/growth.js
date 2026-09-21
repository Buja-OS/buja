// Buja growth: search, invites, install, reporting, legal. Registered by app.js.
export function registerGrowth({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, icon } = ui;
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');

  /* ---------------- Search ---------------- */
  const TYPE = { job: ['briefcase', 'Job'], home: ['house-chimney', 'Home'], item: ['tags', 'For sale'], place: ['location-dot', 'Place'], post: ['message', 'Social'], stop: ['route', 'Waka'], event: ['calendar-days', 'Meetup'], artisan: ['screwdriver-wrench', 'Artisan'], agency: ['building-columns', 'Report to'] };
  route('/search', { auth: true, tabs: '' }, async () => {
    const term = q().get('q') || '';
    const r = term ? await api.search(term) : { results: [] };
    const groups = {};
    r.results.forEach((x) => { (groups[x.type] ||= []).push(x); });
    return `${topbar('Search Buja', '/home')}
    <form id="sf" class="pad" style="padding-bottom:0"><div class="card row" style="height:50px;padding:0 16px;gap:10px">${icon('magnifying-glass')}<label for="sq" style="position:absolute;left:-9999px">Search</label><input id="sq" name="q" type="search" value="${h(term)}" placeholder="Jobs, homes, items, places, posts" autofocus style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div></form>
    <main class="pad stack" style="gap:14px;padding-top:14px">
      ${!term ? `<div class="stack" style="gap:10px"><div class="small muted">Try one of these</div><div class="row" style="flex-wrap:wrap;gap:8px">${['2 bedroom Jabi', 'customer service', 'iPhone', 'amala', 'Kubwa', 'generator'].map((s) => `<a class="chip" href="#/search?q=${encodeURIComponent(s)}">${s}</a>`).join('')}</div></div>`
      : r.results.length ? Object.entries(groups).map(([t, rows]) => `<div class="stack" style="gap:8px"><div class="section">${(TYPE[t] || ['circle-info', t])[1].toUpperCase()}</div><div class="card list">${rows.map((x) => `<a class="item" href="#${x.url}"><div class="mi">${icon((TYPE[x.type] || ['circle-info'])[0])}</div><div class="grow"><div class="t">${h(x.title)}</div><div class="s">${h(x.sub)}</div></div>${icon('chevron-right')}</a>`).join('')}</div></div>`).join('')
      : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('magnifying-glass')}</div><div class="h-md">Nothing for "${h(term)}"</div><div class="small muted" style="max-width:280px;line-height:1.5">Buja only knows what people have put in it. Try a shorter word, or be the one who posts it.</div></div>`}
    </main>`;
  }, { mount(el) { el.querySelector('#sf').addEventListener('submit', (e) => { e.preventDefault(); go('/search?q=' + encodeURIComponent(e.target.q.value)); }); } });

  /* ---------------- Invite ---------------- */
  route('/invite', { auth: true, tabs: 'Me' }, async () => {
    const d = await api.myInvite();
    return `${topbar('Invite friends', '/me')}
    <main class="pad stack" style="gap:16px">
      <div class="card dark stack" style="padding:20px;gap:12px">
        <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#7ED957">YOUR INVITE</div>
        <div style="font-size:34px;font-weight:700;letter-spacing:4px">${h(d.code)}</div>
        <div class="small" style="color:#B5B5BC;line-height:1.5">Buja is only as good as the people on it. A job board with no jobs, a market with nothing for sale, that is the problem every new city app has. You fix it by bringing the people you know.</div>
        <button class="btn btn-primary" id="share">${icon('paper-plane')} Send the invite</button>
        <button class="btn btn-outline" id="copy" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff">Copy the link</button>
      </div>
      <div class="card stack" style="padding:16px;gap:8px"><div class="h-sm">${d.count} ${d.count === 1 ? 'person has' : 'people have'} joined through you</div>
        ${d.friends.length ? `<div class="stack" style="gap:6px">${d.friends.map((f) => `<div class="row small" style="justify-content:space-between"><span>${h(f.name)}</span><span class="muted">${h(f.district || 'Abuja')} · ${f.at.slice(0, 10)}</span></div>`).join('')}</div>` : `<div class="small muted">Nobody yet. Send it to five people who live in your district and watch what happens to the feed.</div>`}
      </div>
    </main>`;
  }, {
    mount(el) {
      const msg = async () => { const d = await api.myInvite(); return `I am using Buja for Abuja: jobs, houses without agents, what things cost on the bus, buying and selling nearby. Join with my link: ${d.link}`; };
      el.querySelector('#share').addEventListener('click', async () => { const t = await msg(); if (navigator.share) navigator.share({ title: 'Buja', text: t }).catch(() => {}); else { navigator.clipboard?.writeText(t); toast('Copied. Paste it anywhere.'); } });
      el.querySelector('#copy').addEventListener('click', async () => { const d = await api.myInvite(); navigator.clipboard?.writeText(d.link); toast('Link copied'); });
    }
  });

  /* Landing for an invite link, before sign-up */
  route('/join/:code', { guest: true, tabs: '' }, async ({ code }) => {
    let from = null; try { from = (await api.inviteInfo(code)).from; } catch {}
    sessionStorage.setItem('buja_ref', code);
    return `<main class="pad stack" style="gap:18px;padding-top:40px">
      <div class="center stack" style="gap:10px"><div style="font-size:26px;font-weight:700;letter-spacing:4px">BUJA</div><div class="muted">Everything Abuja, in one app</div></div>
      <div class="card stack" style="padding:20px;gap:12px">
        <div class="h-md">${from ? h(from.name) + ' invited you' : 'You were invited'}</div>
        <div class="small muted" style="line-height:1.6">${from && from.district ? h(from.district) + ' is on Buja. ' : ''}Jobs across the city, homes direct from landlords with no agent fee, what the bus actually costs, people near you, things to buy and sell, and a guide to where to eat.</div>
        <a class="btn btn-primary" href="#/signup">Create my account</a>
        <a class="btn btn-ghost" href="#/signin">I already have one</a>
      </div>
    </main>`;
  });

  /* ---------------- Report anything ---------------- */
  route('/report/:kind/:id', { auth: true, tabs: '' }, async ({ kind, id }) => `
    ${topbar('Report', '')}
    <form id="rf" class="pad stack" style="gap:14px">
      <div class="muted small" style="line-height:1.55">Tell the Buja team what is wrong. Reports go to a moderator, not to the person. If it is a person on Match, reporting also blocks them.</div>
      <div class="field"><label>What is wrong</label><div class="stack" style="gap:8px" id="preset">${['It is a scam or fraud', 'It is fake or misleading', 'Wrong or offensive content', 'It is already gone or sold', 'Harassment or abuse', 'Something else'].map((r) => `<button type="button" class="btn btn-outline" data-r="${h(r)}" style="justify-content:flex-start;height:44px">${h(r)}</button>`).join('')}</div></div>
      <div class="field"><label for="reason">Anything to add</label><textarea class="input" id="reason" maxlength="500" placeholder="A line or two helps the moderator" style="height:90px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="reason"></div></div>
      <button class="btn btn-ink" type="submit">${icon('triangle-exclamation')} Send report</button>
    </form>`, {
    mount(el, { kind, id }) {
      clearOnInput(el);
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { const t = el.querySelector('#reason'); t.value = b.dataset.r + (t.value ? '. ' + t.value : ''); el.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('btn-ink', x === b)); }));
      el.querySelector('#rf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { const r = await api.report(kind, id, el.querySelector('#reason').value); toast(r.message); history.back(); } catch (err) { busy(btn, false); failed(el, err); } });
    }
  });

  /* ---------------- Install Buja ---------------- */
  route('/install', { auth: true, tabs: 'Me' }, async () => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `${topbar('Install Buja', '/me')}
    <main class="pad stack" style="gap:16px">
      ${standalone ? `<div class="card row" style="padding:16px;gap:12px;border-color:var(--green)">${icon('circle-check')}<div class="grow"><div class="h-sm">Already installed</div><div class="small muted">You are using Buja as an app. Notifications work.</div></div></div>`
      : `<div class="card stack" style="padding:18px;gap:10px">
        <div class="h-md">Put Buja on your home screen</div>
        <div class="small muted" style="line-height:1.6">It opens like a normal app, without the browser bars, works when the network is poor, and it is the only way to get notifications${ios ? ' on an iPhone' : ''}.</div>
        ${ios ? `<div class="stack" style="gap:8px;margin-top:4px">${['Tap the share button at the bottom of Safari', 'Scroll down and tap Add to Home Screen', 'Tap Add at the top right'].map((s, i) => `<div class="row" style="gap:10px;align-items:flex-start"><span style="width:22px;height:22px;border-radius:11px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i + 1}</span><span style="font-size:14px;line-height:1.5">${s}</span></div>`).join('')}</div><div class="small muted">It must be Safari. Chrome on iPhone cannot add apps.</div>`
        : `<button class="btn btn-primary" id="doinstall">${icon('plus')} Add Buja to my home screen</button><div class="small muted" id="hint">If nothing happens, run the check below and send me what it says.</div>`}
      </div>`}
      <div class="card stack" style="padding:16px;gap:10px">
        <div class="row"><div class="grow"><div class="h-sm">Why will it not install?</div><div class="small muted">Checks the five things a browser insists on</div></div><button class="btn btn-sm btn-ink" id="diag" style="width:auto">Run check</button></div>
        <div id="diagout" class="stack" style="gap:6px"></div>
      </div>
      <div class="card stack" style="padding:16px;gap:8px"><div class="h-sm">Why it matters</div><div class="small muted" style="line-height:1.6">Buja is a website that behaves like an app, so there is nothing to download from Play Store and no 60 MB of data. Installed, it keeps its own space on your phone and can wake you for an interview invitation or a match.</div></div>
    </main>`;
  }, {
    mount(el) {
      const b = el.querySelector('#doinstall');
      b?.addEventListener('click', async () => {
        const evt = window.__bujaInstall;
        if (!evt) { el.querySelector('#hint').textContent = 'Your browser did not offer the prompt. Run the check below and send me the result.'; return; }
        evt.prompt(); const res = await evt.userChoice; window.__bujaInstall = null;
        toast(res.outcome === 'accepted' ? 'Installing. Look for Buja on your home screen.' : 'No problem, you can do it any time.');
      });
      el.querySelector('#diag').addEventListener('click', async (e) => {
        busy(e.currentTarget, true);
        const out = el.querySelector('#diagout'); const lines = [];
        const row = (ok, label, detail) => `<div class="row" style="gap:10px;align-items:flex-start"><span style="color:${ok ? 'var(--green-dark)' : '#D92D20'};flex-shrink:0">${icon(ok ? 'circle-check' : 'triangle-exclamation')}</span><span style="font-size:13px;line-height:1.5"><strong>${label}</strong>${detail ? '<br><span class="muted">' + h(detail) + '</span>' : ''}</span></div>`;
        lines.push(row(location.protocol === 'https:', 'Secure connection', location.protocol));
        let reg = null;
        try { reg = await navigator.serviceWorker.getRegistration(); } catch {}
        lines.push(row(!!reg, 'Service worker registered', reg ? 'scope ' + reg.scope + (navigator.serviceWorker.controller ? ', controlling this page' : ', not controlling yet, reload once') : 'none found'));
        let man = null, manOk = false, manDetail = '';
        try {
          const r = await fetch('/manifest.webmanifest', { cache: 'no-cache' });
          manDetail = r.status + ' ' + (r.headers.get('content-type') || 'no content type');
          man = await r.json(); manOk = r.ok && !!man.name && !!man.start_url && man.display === 'standalone';
        } catch (err) { manDetail = 'could not read it'; }
        lines.push(row(manOk, 'Manifest readable', manDetail));
        const icons = (man && man.icons || []).filter((i) => (i.type || '').includes('png'));
        let iconOk = false, iconDetail = 'no PNG icons listed';
        if (icons.length) {
          const checks = await Promise.all(icons.map(async (i) => { try { const r = await fetch(i.src, { cache: 'no-cache' }); return { src: i.src, ok: r.ok && (r.headers.get('content-type') || '').includes('image'), info: r.status + ' ' + (r.headers.get('content-type') || '?') }; } catch { return { src: i.src, ok: false, info: 'failed' }; } }));
          iconOk = checks.every((c) => c.ok);
          iconDetail = checks.map((c) => c.src.split('/').pop() + ' ' + c.info).join(' · ');
        }
        lines.push(row(iconOk, 'PNG icons load', iconDetail));
        const prompted = !!window.__bujaInstall;
        const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        lines.push(row(prompted || standalone, 'Browser offered installation', standalone ? 'already installed' : prompted ? 'yes, the button works' : 'not yet. Chrome sometimes waits until you have used the site a little, or is on an old cached copy. Close Chrome fully, reopen, use it for a minute, then look in the menu again.'));
        out.innerHTML = lines.join('');
        busy(e.currentTarget, false);
      });
    }
  });

  /* ---------------- Legal ---------------- */
  const legal = (title, body) => `${topbar(title, '/settings')}<main class="pad stack" style="gap:14px"><div class="small muted">Last updated 20 September 2026</div>${body}</main>`;
  const para = (t) => `<p style="margin:0;font-size:14px;line-height:1.65;color:var(--ink-2)">${t}</p>`;
  const head = (t) => `<div class="h-sm" style="margin-top:6px">${t}</div>`;
  route('/terms', { tabs: '' }, async () => legal('Terms of use', [
    para('Buja is a place for people in Abuja to find work, homes, transport, things to buy and people to meet. By using it you agree to these terms. If you do not, please stop using it.'),
    head('Who can use Buja'), para('You must be 18 or older. One account per person. Give real information: a fake profile, a fake vacancy or a fake listing gets the account suspended.'),
    head('What you post'), para('What you write, photograph or upload stays yours. You give Buja permission to show it to other users as part of the app. Do not post anything illegal, stolen, hateful, sexual, or anything about a person who has not agreed to be there.'),
    head('Money and deals'), para('Buja introduces people. It is not the employer, the landlord, the seller or the driver, and it does not hold your money. Agree terms directly, inspect before you pay, and never send a deposit to hold an item or a flat. Buja Plus is a subscription for features inside the app and is not a refundable service once the period has started.'),
    head('Safety'), para('Meet in public. Tell someone where you are going, which is what Trip Share is for. Report anything wrong and a moderator will look at it. In an emergency call 112.'),
    head('Ending it'), para('You can stop using Buja whenever you like and ask us to delete your account. We can suspend an account that breaks these terms, and we will say why.'),
    head('Honest limits'), para('Buja is built by a small team and runs on free and low-cost services. It will sometimes be slow or down. Fares, jobs and listings come from other people and can be wrong. Use your judgement.'),
  ].join('')));
  route('/privacy', { tabs: '' }, async () => legal('Privacy', [
    para('The short version: Buja keeps what it needs to work, shows other people as little as possible, and does not sell anything about you.'),
    head('What Buja keeps'), para('Your name, email, phone and district. What you post: vacancies, applications, listings, properties, messages, posts, ratings. Photos and files you attach. Your rough location if you turn it on, stored to about 100 metres and only ever shown to others as a distance.'),
    head('What other people see'), para('On Match: your first name, age, district, photos and what you wrote. On Declutter and Social: your first name and initial. On Work: your name and CV, but only to a company you applied to. Never your phone number, email or exact position unless you send it yourself.'),
    head('Trip Share'), para('The link you send shows a first name, where you said you were going and your last position. It stops the moment you end the trip. Nobody else can open it without the link.'),
    head('Who Buja shares with'), para('Nobody, except the services that make it run: the database, the file storage, the payment processor when you buy Plus, and the notification service to send a push. No advertisers, no data brokers.'),
    head('Your choices'), para('Turn notifications off per module in Settings. Turn location off and Buja falls back to districts. Hide your Match profile without deleting it. Ask for your account and everything in it to be deleted, and it goes.'),
    head('Children'), para('Buja is for adults, 18 and over.'),
  ].join('')));
}
