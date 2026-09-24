// Buja messages, interviews and push. Registered into the app router by app.js.
export function registerMessages({ route, go, state, setState, api, ui, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon, attachmentHtml, youtubeEmbed, linkify } = ui;
  const when = (iso) => { const d = new Date(iso.replace(' ', 'T') + 'Z'); const now = new Date(); const same = d.toDateString() === now.toDateString(); return same ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const pic = (url, name, size, col) => url ? `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;object-fit:cover;flex-shrink:0">` : avatar(name, size, col);
  const pretty = (at) => new Date(at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const colors = ['#1F4E9C', '#2E7D1E', '#8E44AD', '#C0392B', '#0E7C86', '#E8620E'];
  const color = (s) => colors[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];

  /* ---------- Inbox ---------- */
  route('/inbox', { auth: true, tabs: 'Inbox' }, async () => {
    const { threads } = await api.inbox();
    return `
    ${topbar('Inbox', '')}
    <main class="pad stack" style="gap:10px">
      ${threads.length ? `<div class="card list">${threads.map((t) => `<a class="item" href="#/inbox/${t.id}" style="gap:12px">${pic(t.avatar, t.title, 48, color(t.title))}<div class="grow" style="min-width:0"><div class="row" style="justify-content:space-between"><span class="t" style="font-weight:${t.unread ? 700 : 600}">${h(t.title)}</span><span class="small ${t.unread ? '' : 'muted'}" style="${t.unread ? 'color:var(--orange-dark);font-weight:600' : ''}">${when(t.lastAt)}</span></div><div class="s" style="${t.unread ? 'color:var(--ink);font-weight:500' : ''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(t.preview)}</div>${t.subtitle ? `<div class="s" style="font-size:11px">${h(t.subtitle)}</div>` : ''}</div>${t.unread ? `<span style="min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--orange);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${t.unread}</span>` : ''}</a>`).join('')}</div>`
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
          <div class="row" style="gap:10px">${icon(m.meta.virtual ? 'video' : 'location-dot')}<span>${h(m.meta.place)}</span></div>
          ${m.meta.virtual && m.meta.room ? `<a class="btn btn-sm btn-primary" href="#/rtc/${h(m.meta.room)}" style="margin-top:2px">${icon('video')} Join the call</a><div class="small muted">Open any time. Both of you can join early or late.</div>` : ''}
          ${m.meta.with ? `<div class="row" style="gap:10px">${icon('users')}<span>With ${h(m.meta.with)}</span></div>` : ''}
          ${m.meta.note ? `<div class="small muted" style="line-height:1.5">${h(m.meta.note)}</div>` : ''}
          ${!mine && s === 'pending' ? `<div class="row" style="gap:8px;margin-top:6px"><button class="btn btn-sm btn-ink" style="flex:1" data-respond="confirm">Confirm</button><button class="btn btn-sm btn-outline" style="flex:1" data-respond="suggest">Suggest time</button></div>` : ''}
          ${mine && s === 'pending' ? `<div class="small muted">Waiting for ${m.type === 'inspection' ? 'the landlord' : 'a reply'}</div>` : ''}
        </div></div>`;
    }
    if (m.type === 'offer') {
      const s = m.meta.status; const mine = m.mine;
      return `<div class="card" style="align-self:${mine ? 'flex-end' : 'flex-start'};max-width:280px;overflow:hidden" data-offer="${m.id}">
        <div class="row" style="padding:10px 14px;background:${s === 'accepted' ? 'var(--green-tint)' : s === 'declined' ? 'var(--surface)' : 'var(--orange-tint)'};color:${s === 'accepted' ? 'var(--green-dark)' : s === 'declined' ? 'var(--ink-3)' : 'var(--orange-dark)'};gap:10px;font-size:13px;font-weight:700">${icon('naira-sign')} Offer ${s === 'accepted' ? '· Accepted' : s === 'declined' ? '· Declined' : ''}</div>
        <div class="stack" style="padding:14px;gap:6px"><div style="font-size:24px;font-weight:700">₦${Number(m.meta.amount).toLocaleString('en-NG')}</div><div class="small muted">Asking ₦${Number(m.meta.asking).toLocaleString('en-NG')}</div>
        ${!mine && s === 'pending' ? `<div class="row" style="gap:8px;margin-top:6px"><button class="btn btn-sm btn-ink" style="flex:1" data-offer-act="accept">Accept</button><button class="btn btn-sm btn-outline" style="flex:1" data-offer-act="decline">Decline</button></div>` : ''}
        ${mine && s === 'pending' ? `<div class="small muted">Waiting for the seller</div>` : ''}</div></div>`;
    }
    if (m.type === 'call') {
      const meta = m.meta || {};
      const started = meta.startsAt ? new Date(meta.startsAt.replace(' ', 'T') + 'Z') : null;
      const soon = true;
      return `<div class="card stack" style="align-self:${m.mine ? 'flex-end' : 'flex-start'};max-width:280px;padding:14px;gap:10px;border-color:var(--orange)">
        <div class="row" style="gap:10px"><span style="width:34px;height:34px;border-radius:17px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center">${icon(meta.mode === 'audio' ? 'phone' : 'video')}</span><div class="grow"><div style="font-size:14px;font-weight:700">${h(m.body)}</div>${started ? `<div class="small muted">${started.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>` : '<div class="small muted">Now</div>'}</div></div>
        <a class="btn btn-sm btn-primary" href="#/rtc/${h(meta.room)}">${icon(meta.mode === 'audio' ? 'phone' : 'video')} Join the call</a>
        <div class="small" style="opacity:.6;text-align:right">${when(m.createdAt)}</div></div>`;
    }
    const att = m.attachment ? attachmentHtml(m.attachment, { max: 260 }) : '';
    const yt = youtubeEmbed(m.body || '');
    if (att && !m.body) return `<div style="align-self:${m.mine ? 'flex-end' : 'flex-start'};max-width:280px">${att}<div class="small muted" style="text-align:right;margin-top:3px">${when(m.createdAt)}</div></div>`;
    return `<div style="align-self:${m.mine ? 'flex-end' : 'flex-start'};max-width:280px;padding:${att || yt ? '8px 8px 10px' : '12px 14px'};border-radius:${m.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};font-size:14px;line-height:1.5;${m.mine ? 'background:var(--ink);color:var(--surface)' : 'background:var(--card);border:1px solid var(--line)'}">${att ? `<div style="margin-bottom:8px">${att}</div>` : ''}${yt ? `<div style="margin-bottom:8px">${yt}</div>` : ''}<div style="white-space:pre-line;${att || yt ? 'padding:0 6px' : ''}">${linkify(h(m.body || ''))}</div><div class="small" style="opacity:.6;margin-top:4px;text-align:right;${att || yt ? 'padding:0 6px' : ''}">${when(m.createdAt)}</div></div>`;
  }

  route('/inbox/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const t = await api.thread(id);
    const c = t.context;
    return `
    ${topbar('', '/inbox', `${t.other && t.other.id ? `<button class="iconbtn" id="vcall" aria-label="Video call" style="width:38px;height:38px">${icon('video')}</button><button class="iconbtn" id="acall" aria-label="Voice call" style="width:38px;height:38px">${icon('phone')}</button>` : ''}` + (t.canSchedule ? `<button class="iconbtn" id="sched" aria-label="Schedule interview" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('calendar-check')}</button>` : t.canRequestInspection ? `<button class="iconbtn" id="inspect" aria-label="Request inspection" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('calendar-check')}</button>` : t.canOffer ? `<button class="iconbtn" id="mkoffer" aria-label="Make an offer" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('naira-sign')}</button>` : ''))}
    ${t.other && t.other.id ? `<a href="#/people/${t.other.id}" class="row" style="position:absolute;left:64px;top:calc(12px + var(--safe-t));gap:10px;text-decoration:none;color:var(--ink);max-width:calc(100% - 200px)">${pic(t.other.avatar, t.title, 36, color(t.title))}<span style="font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(t.title)}</span></a>` : `<div style="position:absolute;left:64px;top:calc(18px + var(--safe-t));font-size:17px;font-weight:700">${h(t.title)}</div>`}
    ${t.kind === 'declutter' && c ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${icon('tags')}<span class="grow">${c.isSeller ? `${h(t.other.name)} · about your <strong style="color:var(--ink)">${h(c.title)}</strong>` : `<strong style="color:var(--ink)">${h(c.title)}</strong> · ₦${Number(c.price).toLocaleString('en-NG')}`}${c.status !== 'active' ? ' · <strong>' + c.status + '</strong>' : ''}</span><a href="#/declutter/${c.listingId}" style="color:var(--orange-dark);font-weight:600">Open</a></div>` : ''}
    ${t.kind === 'homes' && c ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${icon('house-chimney')}<span class="grow">${c.isOwner ? `${h(t.other.name)} · enquiring about <strong style="color:var(--ink)">${h(c.title)}</strong>` : `<strong style="color:var(--ink)">${h(c.title)}</strong> · ${h(c.district)}`}</span><a href="#/homes/${c.propertyId}" style="color:var(--orange-dark);font-weight:600">Open</a></div>` : ''}
    ${t.kind === 'match' ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${pic(t.other.avatar, t.other.name, 28, color(t.other.name))}<span class="grow">You matched on Buja</span></div>
    <a class="pad" href="#/safety/start?with=${encodeURIComponent(t.other.name.split(' ')[0])}&user=${t.other.id}" style="display:block;padding-top:0;padding-bottom:8px"><span class="card row" style="padding:10px 12px;gap:10px;background:#E7F6EC;border-color:#BFE3CB"><span style="color:var(--green-dark)">${icon('shield-halved')}</span><span class="grow small" style="line-height:1.4;color:var(--ink)"><b>Meeting ${h(t.other.name.split(' ')[0])}?</b> Share your live location with a friend until you check in safe.</span>${icon('chevron-right')}</span></a><div style="display:none"><a href="#/match/profile/${t.other.id}" style="color:var(--orange-dark);font-weight:600">Profile</a></div>` : ''}
    ${c && t.kind !== 'homes' && t.kind !== 'declutter' ? `<div class="pad row small muted" style="padding-bottom:8px;gap:8px">${pic(t.other.avatar, t.other.name, 28, color(t.other.name))}<span class="grow">${state.user.kind === 'company' ? `${h(t.other.name)} · applied for <strong style="color:var(--ink)">${h(c.jobTitle)}</strong> · ${c.match}% match` : `Recruiting for <strong style="color:var(--ink)">${h(c.jobTitle)}</strong>`}</span><a href="#/work/${state.user.kind === 'company' ? 'company/job/' + c.jobId : 'job/' + c.jobId}" style="color:var(--orange-dark);font-weight:600">Open</a></div>` : ''}
    <main id="msgs" class="stack" style="padding:8px 16px 0;gap:12px;flex:1" data-last="${t.messages.length ? t.messages[t.messages.length - 1].id : 0}">${t.messages.map(bubble).join('')}</main>
    <div id="sheet"></div>
    <div id="attachbar"></div>
    <form id="compose" class="row" style="gap:8px;padding:10px 16px calc(10px + var(--safe-b));background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      <label for="body" style="position:absolute;left:-9999px">Message</label>
      <button type="button" class="iconbtn" id="plus" aria-label="Attach" style="width:42px;height:42px;flex-shrink:0">${icon('plus')}</button>
      <button type="button" class="iconbtn" id="mic" aria-label="Record a voice note" style="width:42px;height:42px;flex-shrink:0">${icon('microphone')}</button>
      <input class="input" id="body" name="body" placeholder="Message ${h(t.title)}" autocomplete="off" style="height:46px;border-radius:23px;flex:1;min-width:0">
      <button class="iconbtn" type="submit" aria-label="Send" style="background:var(--orange);border-color:var(--orange);color:#fff;width:46px;height:46px;flex-shrink:0">${icon('paper-plane')}</button>
      <input type="file" id="fphoto" accept="image/*" style="display:none"><input type="file" id="fvideo" accept="video/*" style="display:none"><input type="file" id="ffile" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none">
    </form>`;
  }, {
    mount(el, { id }) {
      const box = el.querySelector('#msgs'); let last = +box.dataset.last || 0;
      const scroll = () => window.scrollTo(0, document.body.scrollHeight);
      scroll();
      const bindOffers = () => el.querySelectorAll('[data-offer-act]').forEach((b) => { if (b.dataset.bound) return; b.dataset.bound = 1; b.addEventListener('click', async () => { const mid = b.closest('[data-offer]').dataset.offer; busy(b, true); try { await api.respondOffer(mid, b.dataset.offerAct); toast(b.dataset.offerAct === 'accept' ? 'Offer accepted' : 'Offer declined'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }); });
      bindOffers();
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
        try { const t = await api.thread(id, last); if (t.messages.length) { box.insertAdjacentHTML('beforeend', t.messages.map(bubble).join('')); last = t.messages[t.messages.length - 1].id; bindResponds(); bindOffers(); scroll(); } } catch {}
      };
      const timer = setInterval(poll, 5000);
      window.addEventListener('hashchange', () => clearInterval(timer), { once: true });
      /* ---- attachments ---- */
      let pending = null;
      const bar = el.querySelector('#attachbar');
      const showPending = () => { bar.innerHTML = pending ? `<div class="row" style="gap:10px;padding:10px 16px;background:var(--surface);border-top:1px solid var(--line);align-items:center"><div style="flex:1;min-width:0">${attachmentHtml(pending, { max: 160 })}</div><button class="iconbtn" id="dropatt" aria-label="Remove attachment" style="width:34px;height:34px">${icon('xmark')}</button></div>` : ''; bar.querySelector('#dropatt')?.addEventListener('click', () => { pending = null; showPending(); }); scroll(); };
      async function shrinkImg(file) { const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file; const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)); const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85)); return new File([blob], 'photo.jpg', { type: 'image/jpeg' }); }
      const pick = async (input, kind) => { const f = input.files[0]; if (!f) return; input.value = ''; toast('Uploading…'); try { const file = kind === 'image' ? await shrinkImg(f) : f; const r = await api.upload(file, kind); pending = r.upload; showPending(); } catch (err) { failed(el, err); } };
      el.querySelector('#fphoto').addEventListener('change', (e) => pick(e.target, 'image'));
      el.querySelector('#fvideo').addEventListener('change', (e) => pick(e.target, 'video'));
      el.querySelector('#ffile').addEventListener('change', (e) => pick(e.target, 'file'));
      el.querySelector('#plus').addEventListener('click', () => {
        el.querySelector('#sheet').innerHTML = `<div class="card list" style="margin:8px 16px 10px">
          <button class="item" data-att="photo"><div class="mi">${icon('camera')}</div><div class="grow"><div class="t">Photo</div><div class="s">From your camera or gallery</div></div></button>
          <button class="item" data-att="video"><div class="mi">${icon('bolt')}</div><div class="grow"><div class="t">Video</div><div class="s">Up to 40 MB</div></div></button>
          <button class="item" data-att="file"><div class="mi">${icon('file-arrow-up')}</div><div class="grow"><div class="t">Document</div><div class="s">PDF, Word, Excel, text</div></div></button>
          <button class="item" data-att="location"><div class="mi">${icon('location-dot')}</div><div class="grow"><div class="t">My location</div><div class="s">Share where you are now</div></div></button></div>`;
        el.querySelectorAll('[data-att]').forEach((b) => b.addEventListener('click', async () => {
          const what = b.dataset.att; el.querySelector('#sheet').innerHTML = '';
          if (what === 'photo') el.querySelector('#fphoto').click();
          else if (what === 'video') el.querySelector('#fvideo').click();
          else if (what === 'file') el.querySelector('#ffile').click();
          else {
            if (!navigator.geolocation) { toast('This phone cannot share location.'); return; }
            toast('Finding you…');
            navigator.geolocation.getCurrentPosition(async (pos) => { try { const r = await api.pinLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Shared location' }); pending = r.upload; showPending(); } catch (err) { failed(el, err); } },
              () => toast('Could not get your location. Check the permission for this site.'), { enableHighAccuracy: true, timeout: 12000 });
          }
        }));
      });
      /* ---- voice notes ---- */
      let rec = null, chunks = [], started = 0, recTimer = null;
      const mic = el.querySelector('#mic');
      mic.addEventListener('click', async () => {
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast('This browser cannot record voice notes.'); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          rec = new MediaRecorder(stream); chunks = []; started = Date.now();
          rec.ondataavailable = (e) => chunks.push(e.data);
          rec.onstop = async () => {
            clearInterval(recTimer); stream.getTracks().forEach((t) => t.stop());
            mic.innerHTML = icon('microphone'); mic.style.background = ''; mic.style.color = '';
            const secs = Math.round((Date.now() - started) / 1000);
            if (secs < 1) { toast('Too short'); return; }
            const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            toast('Uploading…');
            try { const r = await api.upload(new File([blob], 'voice.webm', { type: blob.type }), 'audio', { seconds: secs }); pending = r.upload; showPending(); } catch (err) { failed(el, err); }
          };
          rec.start();
          mic.style.background = '#D92D20'; mic.style.color = '#fff';
          recTimer = setInterval(() => { const s = Math.round((Date.now() - started) / 1000); mic.textContent = s + 's'; if (s >= 180) rec.stop(); }, 500);
          toast('Recording. Tap again to stop.');
        } catch { toast('Microphone permission is needed for voice notes.'); }
      });
      api.ratingStatus(id).then((rs) => {
        if (!rs.canRate) return;
        const box = document.createElement('div');
        box.innerHTML = `<a class="card row" href="#/rate/${id}" style="margin:10px 16px;padding:12px 14px;gap:10px;border-style:dashed"><span style="width:32px;height:32px;border-radius:10px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">★</span><span class="grow"><span style="display:block;font-size:13px;font-weight:650">How did it go with ${h(rs.other.name)}?</span><span class="small muted">Your rating helps the next person</span></span></a>`;
        el.querySelector('#attachbar')?.before(box.firstElementChild);
      }).catch(() => {});
      const ring = async (mode) => { try { const r = await api.startCall(id, mode); go('/rtc/' + r.call.room); } catch (err) { failed(el, err); } };
      el.querySelector('#vcall')?.addEventListener('click', () => ring('video'));
      el.querySelector('#acall')?.addEventListener('click', () => ring('audio'));
      el.querySelector('#compose').addEventListener('submit', async (e) => {
        e.preventDefault(); const i = el.querySelector('#body'); const v = i.value.trim(); if (!v && !pending) return; i.value = '';
        const att = pending; pending = null; showPending();
        try { const r = await api.sendMessage(id, v, att ? att.id : null); box.insertAdjacentHTML('beforeend', bubble(r.message)); last = r.message.id; scroll(); } catch (err) { i.value = v; pending = att; showPending(); failed(el, err); }
      });
      if (new URLSearchParams(location.hash.split('?')[1] || '').get('schedule') === '1') setTimeout(() => el.querySelector('#sched')?.click(), 50);
      if (new URLSearchParams(location.hash.split('?')[1] || '').get('inspect') === '1') setTimeout(() => el.querySelector('#inspect')?.click(), 50);
      if (new URLSearchParams(location.hash.split('?')[1] || '').get('offer') === '1') setTimeout(() => el.querySelector('#mkoffer')?.click(), 50);
      el.querySelector('#mkoffer')?.addEventListener('click', () => {
        el.querySelector('#sheet').innerHTML = `<form id="off" class="card stack" style="margin:8px 16px 12px;padding:16px;gap:12px"><div class="row"><div class="grow h-sm">Make an offer</div><button type="button" class="iconbtn" id="closeoff" aria-label="Close" style="width:36px;height:36px">${icon('xmark')}</button></div>
          <div class="field"><label for="amount">Your offer (₦)</label><input class="input" id="amount" inputmode="numeric" placeholder="380,000"><div class="error" data-error="amount"></div></div>
          <button class="btn btn-primary" type="submit">${icon('naira-sign')} Send offer</button><div class="small muted">The seller accepts or declines. No money moves here; pay only when you have the item.</div></form>`;
        clearOnInput(el.querySelector('#sheet')); scroll(); el.querySelector('#amount').focus();
        el.querySelector('#closeoff').addEventListener('click', () => { el.querySelector('#sheet').innerHTML = ''; });
        el.querySelector('#off').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { await api.offer(id, el.querySelector('#amount').value); toast('Offer sent'); if (location.hash === '#/inbox/' + id) location.reload(); else location.hash = '#/inbox/' + id; } catch (err) { busy(btn, false); failed(el, err); } });
      });
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
          const localAt = new Date(f.date.value + 'T' + f.time.value); const at = localAt.toISOString();
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
          <div class="field"><label>How</label><div class="seg" id="how"><button type="button" data-v="0" class="on">In person</button><button type="button" data-v="1">Video call on Buja</button></div><div class="hint" id="howhint">They come to your office.</div></div>
          ${field({ id: 'with', label: 'With (optional)', placeholder: 'Ngozi Eze, Branch Manager' })}
          ${field({ id: 'note', label: 'Anything to bring or know (optional)', placeholder: 'Bring a valid ID' })}
          <button class="btn btn-primary" type="submit">${icon('paper-plane')} Send invitation</button>
          <div class="small muted">They get a push notification and an email, and can confirm or suggest another time.</div>
        </form>`;
        clearOnInput(el.querySelector('#sheet')); scroll();
        el.querySelector('#closeinv').addEventListener('click', () => { el.querySelector('#sheet').innerHTML = ''; });
        const how = el.querySelector('#how');
        how?.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-v]'); if (!b) return;
          how.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          const virtual = b.dataset.v === '1';
          const hint = el.querySelector('#howhint'); if (hint) hint.textContent = virtual ? 'Buja creates a private video room. Both of you join from inside the app, nothing to install.' : 'They come to your office.';
          const place = el.querySelector('#place');
          if (place) { const wrap = place.closest('.field'); if (wrap) wrap.style.display = virtual ? 'none' : ''; if (virtual) place.value = ''; }
        });
        el.querySelector('#inv').addEventListener('submit', async (e) => {
          e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
          const localAt = new Date(f.date.value + 'T' + f.time.value); const at = localAt.toISOString();
          const virtual = el.querySelector('#how button.on')?.dataset.v === '1';
          try { await api.scheduleInterview(id, { at, virtual, place: f.place.value, with: f.with.value, note: f.note.value }); toast('Invitation sent'); if (location.hash === '#/inbox/' + id) location.reload(); else location.hash = '#/inbox/' + id; } catch (err) { busy(btn, false); failed(el, err); }
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
