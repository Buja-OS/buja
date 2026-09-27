// SOS: press and hold, and the people you trust get your live location at once, by text, push and email,
// with one-tap WhatsApp messages and a call to 112 right there. Built on Trip Share, so the link they open
// is the same live map, with a red SOS banner.
import { waLink } from './ui.js';

export function registerSos({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy } = ui;
  const where = (ms = 7000) => new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: ms, maximumAge: 20000 }); });

  route('/sos', { auth: true, tabs: '' }, async () => {
    const d = await api.safety();
    const live = d.active && d.active.sos;
    return `${topbar('SOS', '/home')}
    <main class="pad stack" style="gap:16px;padding-bottom:30px" id="sosmain">
      ${live ? '' : `<div class="center stack" style="gap:18px;align-items:center;padding-top:6px">
        <div class="small muted center" style="max-width:320px;line-height:1.5">Press and hold for two seconds. Buja sends your live location to your trusted contacts straight away.</div>
        <button class="sos-hold" id="hold" aria-label="Press and hold for SOS"><svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="301.6" stroke-dashoffset="301.6" id="arc" transform="rotate(-90 50 50)" stroke-linecap="round"/></svg>SOS<small>Hold</small></button>
        <a class="btn btn-outline" href="tel:112" style="width:auto;padding:0 22px">${icon('phone')} Call 112 now</a>
      </div>`}
      <div id="state"></div>
      <div class="stack" style="gap:8px"><div class="section">TRUSTED CONTACTS</div>
        <div class="card list" id="clist">${d.contacts.length ? d.contacts.map((c) => `<div class="item"><div class="mi">${icon('user')}</div><div class="grow"><div class="t" data-noi18n>${h(c.name)}</div><div class="s" data-noi18n>${h(c.phone || c.email || '')}</div></div>${c.phone ? `<a class="iconbtn" href="tel:${h(c.phone)}" aria-label="Call">${icon('phone')}</a>` : ''}</div>`).join('')
          : `<div class="item"><div class="mi" style="background:#FDECEA;color:#D92D20">${icon('triangle-exclamation')}</div><div class="grow"><div class="t">No trusted contacts yet</div><div class="s">SOS still works: you can send the live link on WhatsApp yourself. Add someone so Buja can text them for you.</div></div></div>`}</div>
        ${d.contacts.length < 5 ? `<form class="card stack" id="addc" style="padding:14px;gap:10px"><div class="h-sm">Add someone you trust</div>
          <input class="input" id="cn" maxlength="60" placeholder="Name, e.g. Mum or Tunde" autocomplete="off">
          <div class="row" style="gap:10px"><span class="prefix">+234</span><input class="input" id="cp" type="tel" inputmode="tel" placeholder="803 000 0000"></div>
          <button class="btn btn-primary" type="submit">Add contact</button></form>` : ''}
      </div>
      <div class="small muted" style="line-height:1.55">Texts go out when Buja's SMS is switched on; push alerts reach contacts who use Buja; emails reach anyone with an email saved. Keep this screen open while you can, so your position keeps updating.</div>
    </main>`;
  }, {
    async mount(el) {
      let trip = null, told = null, watch = null, lastPing = 0, wake = null;
      const stop = () => { if (watch != null) navigator.geolocation.clearWatch(watch); watch = null; try { wake && wake.release(); } catch {} wake = null; };
      const gone = () => !document.body.contains(el);
      const follow = async () => {
        if (watch != null || !navigator.geolocation) return;
        try { wake = await navigator.wakeLock?.request('screen'); } catch {}
        watch = navigator.geolocation.watchPosition((p) => {
          if (gone()) { stop(); return; }
          if (Date.now() - lastPing < 12000) return; lastPing = Date.now();
          api.pingTrip(p.coords.latitude, p.coords.longitude).then((r) => { if (r && r.active === false) stop(); }).catch(() => {});
        }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
      };
      const paint = () => {
        const box = el.querySelector('#state'); if (!trip) { box.innerHTML = ''; return; }
        const first = (state.user.name || '').split(' ')[0];
        const msg = `SOS from ${first}. I need help. My live location on Buja: ${trip.link}`;
        const contacts = (window.__sosContacts || []).filter((c) => c.phone);
        box.innerHTML = `<div class="card stack sos-live sos-pulse" style="padding:18px;gap:10px">
            <div style="font-size:22px;font-weight:900">SOS is on</div>
            <div class="small" style="line-height:1.5">${told ? `Sent: ${told.sms} text${told.sms === 1 ? '' : 's'}, ${told.push} app alert${told.push === 1 ? '' : 's'}, ${told.email} email${told.email === 1 ? '' : 's'}. ` : ''}Your trusted contacts can follow you live on the link. Now send it on WhatsApp too.</div>
          </div>
          <div class="stack" style="gap:8px">
            ${contacts.map((c) => `<a class="btn btn-primary" style="background:#25D366;color:#073B1C" href="${h(waLink(msg, c.phone))}" target="_blank" rel="noopener">WhatsApp ${h(c.name)}</a>`).join('')}
            <button class="btn ${contacts.length ? 'btn-outline' : 'btn-primary'}" id="wa" ${contacts.length ? '' : 'style="background:#25D366;color:#073B1C"'}>Send on WhatsApp to anyone</button>
            <a class="btn btn-ink" href="tel:112">${icon('phone')} Call 112 (police, fire, ambulance)</a>
            <button class="btn btn-outline" id="copy">Copy the live link</button>
            <button class="btn btn-ghost" id="safe" style="color:var(--green-dark);font-weight:800">${icon('circle-check')} I am safe now. End SOS</button>
          </div>`;
        box.querySelector('#wa').addEventListener('click', () => window.open(waLink(msg), '_blank', 'noopener'));
        box.querySelector('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(msg); toast('Copied'); } catch { prompt('Copy this:', msg); } });
        box.querySelector('#safe').addEventListener('click', async (e) => { if (!confirm('End the SOS and tell your contacts you are safe?')) return; busy(e.currentTarget, true); try { await api.endTrip({ status: 'safe' }); stop(); toast('SOS ended. Your contacts have been told you are safe.'); go('/home'); } catch (err) { busy(e.currentTarget, false); failed(el, err); } });
      };
      const fire = async () => {
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {}
        const hold = el.querySelector('#hold'); const was = hold ? hold.innerHTML : ''; if (hold) { hold.disabled = true; hold.querySelector('small').textContent = 'Sending…'; }
        const p = await where(6000);
        try {
          const r = await api.sos(p || {}); trip = r.trip; told = r.told;
          el.querySelector('#hold')?.closest('.center')?.remove();
          paint(); follow();
          if (!p) toast('Location is off, so contacts see your last known place. Turn location on.', 6000);
        } catch (err) { if (hold) { hold.disabled = false; hold.innerHTML = was; } failed(el, err); }
      };

      // contacts for the WhatsApp buttons
      try { const d = await api.safety(); window.__sosContacts = d.contacts; if (d.active && d.active.sos) { trip = d.active; paint(); follow(); } } catch {}

      const hold = el.querySelector('#hold');
      if (hold) {
        const arcEl = () => el.querySelector('#arc'); let t0 = 0, raf = 0;
        const reset = () => { cancelAnimationFrame(raf); t0 = 0; arcEl()?.setAttribute('stroke-dashoffset', '301.6'); };
        const tick = () => { if (!t0) return; const k = Math.min(1, (performance.now() - t0) / 2000); arcEl()?.setAttribute('stroke-dashoffset', String(301.6 * (1 - k))); if (k >= 1) { t0 = 0; fire(); return; } raf = requestAnimationFrame(tick); };
        hold.addEventListener('pointerdown', (e) => { e.preventDefault(); if (hold.disabled) return; t0 = performance.now(); try { navigator.vibrate && navigator.vibrate(30); } catch {} tick(); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, () => { if (t0) { reset(); toast('Keep holding for two seconds'); } }));
        hold.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && confirm('Send SOS to your trusted contacts now?')) fire(); });
        hold.addEventListener('contextmenu', (e) => e.preventDefault());
      }
      el.querySelector('#addc')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const b = e.target.querySelector('[type=submit]'); busy(b, true);
        try { await api.addContact({ name: el.querySelector('#cn').value, phone: el.querySelector('#cp').value }); toast('Added'); window.dispatchEvent(new HashChangeEvent('hashchange')); }
        catch (err) { busy(b, false); toast((err && err.fields && (err.fields.name || err.fields.phone)) || (err && err.message) || 'Could not add'); }
      });
    },
  });
}
