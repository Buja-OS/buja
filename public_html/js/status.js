// Buja status updates: text on a colour or a photo, for 24 hours, seen by your Buja friends, with a list of who viewed.
// The row of circles sits at the top of the Inbox (see statusRow); the viewer and the composer are full screen here.
export function registerStatus({ route, go, api, ui, failed }) {
  const { h, icon, toast, avatar } = ui;
  const BGS = ['#1F5FBF', '#2E7D1E', '#7A3E96', '#C2185B', '#E8620E', '#0E7C86', '#101014', '#B7791F'];
  const ago = (iso) => { const s = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; const d = new Date(iso.replace(' ', 'T') + 'Z'); return (s < 86400 && d.toDateString() === new Date().toDateString() ? 'today ' : 'yesterday ') + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const face = (url, name, size) => url ? `<img src="${h(url)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block">` : avatar(name, size);
  async function shrink(file) { const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file; const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)); const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.86)); return new File([blob], 'status.jpg', { type: 'image/jpeg' }); }

  /* ---------------------------- the viewer ---------------------------- */
  // #/status/view?u=<userId or "me">&i=<index>
  route('/status/view', { auth: true, tabs: '' }, async () => `<div class="stv" id="stv"><div class="stv-bars" id="bars"></div>
      <div class="stv-top"><button class="stv-x" id="close" aria-label="Close">${icon('xmark')}</button><span id="who" class="row" style="gap:10px;min-width:0"></span></div>
      <div class="stv-body" id="body"></div>
      <div class="stv-foot" id="foot"></div><div class="stv-sheet" id="sheet"></div></div>`, {
    async mount(el) {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      let d; try { d = await api.statuses(); } catch (err) { failed(el, err); return; }
      const people = [...(d.mine.length ? [{ user: { ...d.me, label: 'My status' }, items: d.mine, mine: true }] : []), ...d.friends];
      let p = q.get('u') === 'me' ? 0 : Math.max(0, people.findIndex((x) => !x.mine && String(x.user.id) === q.get('u')));
      if (!people.length || !people[p]) { go('/inbox'); return; }
      let i = Math.min(+q.get('i') || 0, people[p].items.length - 1);
      if (!q.get('i') && !people[p].mine) { const firstNew = people[p].items.findIndex((x) => !x.seen); if (firstNew > 0) i = firstNew; }
      let timer = null, t0 = 0, dur = 5000, left = 5000, paused = false, raf = 0;
      const close = () => { cancelAnimationFrame(raf); clearTimeout(timer); history.length > 1 ? history.back() : go('/inbox'); };
      el.querySelector('#close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
      const bars = el.querySelector('#bars'), body = el.querySelector('#body'), foot = el.querySelector('#foot'), sheet = el.querySelector('#sheet');
      const progress = () => { const b = bars.children[i]; if (b && !paused) { const k = Math.min(1, 1 - (left - (performance.now() - t0)) / dur); b.firstElementChild.style.width = (k * 100) + '%'; } raf = requestAnimationFrame(progress); };
      const next = () => { if (i < people[p].items.length - 1) { i++; show(); } else if (p < people.length - 1) { p++; i = 0; show(); } else close(); };
      const prev = () => { if (i > 0) { i--; show(); } else if (p > 0) { p--; i = people[p].items.length - 1; show(); } else show(); };
      const run = (ms) => { clearTimeout(timer); dur = ms; left = ms; t0 = performance.now(); timer = setTimeout(next, ms); };
      const pause = (on) => { if (on === paused) return; paused = on; if (on) { clearTimeout(timer); left -= performance.now() - t0; } else { t0 = performance.now(); timer = setTimeout(next, Math.max(200, left)); } };
      function show() {
        clearTimeout(timer); sheet.classList.remove('on');
        const who = people[p], s = who.items[i];
        bars.innerHTML = who.items.map((_, k) => `<span><i style="width:${k < i ? 100 : 0}%"></i></span>`).join('');
        el.querySelector('#who').innerHTML = `<span class="stv-av">${face(who.user.avatar, who.user.name, 34)}</span><span style="min-width:0"><span style="display:block;font-weight:700;font-size:15px">${h(who.user.label || who.user.name)}</span><span style="display:block;font-size:12px;opacity:.75">${ago(s.at)}</span></span>`;
        el.querySelector('#stv').style.background = s.kind === 'text' ? (s.bg || '#1F5FBF') : '#000';
        body.innerHTML = s.kind === 'text' ? `<div class="stv-text" style="font-size:${s.body.length > 160 ? 20 : s.body.length > 60 ? 26 : 32}px">${h(s.body)}</div>`
          : `<img src="${h(s.image)}" alt="" class="stv-img">${s.body ? `<div class="stv-cap">${h(s.body)}</div>` : ''}`;
        foot.innerHTML = who.mine ? `<button class="stv-views" id="views">${icon('eye')} ${s.views || 0} ${s.views === 1 ? 'view' : 'views'}</button><button class="stv-del" id="del" aria-label="Delete this status">${icon('trash-can')}</button>`
          : `<a class="stv-reply" href="#/friends" id="reply">${icon('message')} Reply in chat</a>`;
        if (who.mine) {
          foot.querySelector('#views').addEventListener('click', async (e) => {
            e.stopPropagation(); pause(true); sheet.classList.add('on'); sheet.innerHTML = '<div class="small" style="padding:18px;color:#AEB4BF">Loading…</div>';
            try { const { viewers } = await api.statusViewers(s.id);
              sheet.innerHTML = `<div class="stv-sh"><div class="row" style="padding:14px 16px 6px"><strong class="grow">Viewed by ${viewers.length}</strong><button class="stv-x" id="shx" aria-label="Close" style="background:rgba(255,255,255,.1)">${icon('xmark')}</button></div>
                ${viewers.length ? viewers.map((v) => `<div class="row" style="gap:12px;padding:10px 16px">${face(v.avatar, v.name, 40)}<span class="grow"><span style="display:block;font-weight:650">${h(v.name)}</span><span class="small" style="color:#AEB4BF">${ago(v.at)}</span></span></div>`).join('') : '<div class="small" style="padding:6px 16px 20px;color:#AEB4BF;line-height:1.5">Nobody has seen this yet. Your Buja friends see it at the top of their Inbox.</div>'}</div>`;
              sheet.querySelector('#shx').addEventListener('click', (ev) => { ev.stopPropagation(); sheet.classList.remove('on'); pause(false); });
            } catch (err) { sheet.classList.remove('on'); pause(false); failed(el, err); }
          });
          foot.querySelector('#del').addEventListener('click', async (e) => {
            e.stopPropagation(); pause(true);
            if (!confirm('Delete this status?')) { pause(false); return; }
            try { await api.deleteStatus(s.id); toast('Deleted'); who.items.splice(i, 1); if (!who.items.length) { close(); return; } i = Math.min(i, who.items.length - 1); paused = false; show(); } catch (err) { pause(false); failed(el, err); }
          });
        } else {
          foot.querySelector('#reply').addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); try { const r = await api.friendChat(who.user.id); go('/inbox/' + r.threadId); } catch (err) { failed(el, err); } });
          if (!s.seen) { s.seen = true; api.viewStatus(s.id).catch(() => {}); }
        }
        paused = false;
        if (s.kind === 'image') { const im = body.querySelector('img'); const go2 = () => run(6000); if (im.complete) go2(); else { im.onload = go2; im.onerror = go2; t0 = performance.now(); left = dur = 60000; } }
        else run(Math.min(9000, 4000 + (s.body || '').length * 40));
      }
      // tap the right side for the next one, the left for the one before; hold anywhere to pause
      let downAt = 0;
      const stv = el.querySelector('#stv');
      stv.addEventListener('pointerdown', (e) => { if (e.target.closest('button,a,.stv-sheet')) return; downAt = performance.now(); pause(true); });
      stv.addEventListener('pointerup', (e) => { if (e.target.closest('button,a,.stv-sheet') || !downAt) return; const held = performance.now() - downAt; downAt = 0; if (held > 350) { pause(false); return; } if (e.clientX > window.innerWidth * 0.35) next(); else prev(); });
      document.addEventListener('keydown', function k(e) { if (!document.body.contains(el)) { document.removeEventListener('keydown', k); return; } if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'Escape') close(); });
      const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); cancelAnimationFrame(raf); clearTimeout(timer); } });
      obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
      show(); progress();
    },
  });

  /* ---------------------------- the composer ---------------------------- */
  route('/status/new', { auth: true, tabs: '' }, async () => `<div class="stv" id="stn" style="background:${BGS[0]}">
      <div class="stv-top"><button class="stv-x" id="close" aria-label="Close">${icon('xmark')}</button><span class="grow"></span>
        <button class="stv-tool" id="colour" aria-label="Change colour">${icon('palette')}</button><button class="stv-tool" id="photo" aria-label="Post a photo instead">${icon('camera')}</button></div>
      <div class="stv-body" id="body"><textarea id="text" class="stv-input" maxlength="700" placeholder="Type a status"></textarea></div>
      <div class="stv-foot"><span class="small" id="hint" style="color:rgba(255,255,255,.75)">Your Buja friends see it for 24 hours</span><button class="stv-send" id="post" aria-label="Post">${icon('paper-plane')}</button></div>
      <input type="file" id="file" accept="image/*" style="display:none"></div>`, {
    mount(el) {
      let bg = 0, upload = null, busyPost = false;
      const root = el.querySelector('#stn'), body = el.querySelector('#body');
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      el.querySelector('#close').addEventListener('click', () => (history.length > 1 ? history.back() : go('/inbox')));
      el.querySelector('#colour').addEventListener('click', () => { if (upload) return; bg = (bg + 1) % BGS.length; root.style.background = BGS[bg]; });
      const file = el.querySelector('#file');
      el.querySelector('#photo').addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files[0]; file.value = ''; if (!f) return;
        if (!/^image\//.test(f.type)) { toast('Choose a photo.'); return; }
        const url = URL.createObjectURL(f);
        root.style.background = '#000'; el.querySelector('#colour').style.display = 'none';
        body.innerHTML = `<img src="${url}" alt="" class="stv-img"><input id="cap" class="stv-capin" maxlength="700" placeholder="Add a caption">`;
        el.querySelector('#hint').textContent = 'Uploading…';
        try { const r = await api.upload(await shrink(f), 'image'); upload = r.upload; el.querySelector('#hint').textContent = 'Your Buja friends see it for 24 hours'; }
        catch (err) { el.querySelector('#hint').textContent = 'The photo did not upload. Try again.'; failed(el, err); }
      });
      el.querySelector('#post').addEventListener('click', async (e) => {
        if (busyPost) return;
        const b = e.currentTarget;
        const text = (el.querySelector('#text') || el.querySelector('#cap'))?.value.trim() || '';
        if (!upload && !text) { toast('Write something or add a photo.'); return; }
        if (el.querySelector('#hint').textContent === 'Uploading…') { toast('Wait for the photo to finish uploading.'); return; }
        busyPost = true; b.disabled = true;
        try { await api.postStatus(upload ? { kind: 'image', uploadId: upload.id, body: text } : { kind: 'text', body: text, bg: BGS[bg] }); toast('Status posted'); go('/inbox'); }
        catch (err) { busyPost = false; b.disabled = false; failed(el, err); }
      });
      if (q.get('photo') === '1') setTimeout(() => file.click(), 60); else el.querySelector('#text')?.focus();
    },
  });
}

/** The row of status circles at the top of the Inbox. Filled in after the Inbox has drawn, so it never slows it down. */
export async function statusRow(host, { api, ui, go }) {
  const { h, icon, avatar } = ui;
  let d; try { d = await api.statuses(); } catch { host.remove(); return; }
  const face = (url, name) => url ? `<img src="${h(url)}" alt="">` : avatar(name, 56);
  const ring = (items, seenAll, mine) => { const n = items.length; if (!n) return ''; const gap = n > 1 ? 4 : 0; const seg = 360 / n; return `<svg class="st-ring" viewBox="0 0 64 64" aria-hidden="true">${items.map((it, k) => { const a0 = k * seg + gap / 2 - 90, a1 = (k + 1) * seg - gap / 2 - 90; const r = 30, rad = Math.PI / 180, x0 = 32 + r * Math.cos(a0 * rad), y0 = 32 + r * Math.sin(a0 * rad), x1 = 32 + r * Math.cos(a1 * rad), y1 = 32 + r * Math.sin(a1 * rad); const col = mine || it.seen || seenAll ? '#B9BEC7' : '#2FBF4E'; return n === 1 ? `<circle cx="32" cy="32" r="30" fill="none" stroke="${col}" stroke-width="3"/>` : `<path d="M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`; }).join('')}</svg>`; };
  const mine = d.mine.length
    ? `<a class="st-item" href="#/status/view?u=me">${ring(d.mine, true, true)}<span class="st-face">${face(d.me.avatar, d.me.name)}</span><span class="st-name">My status</span></a>`
    : `<a class="st-item" href="#/status/new">${'<span class="st-add">' + icon('plus') + '</span>'}<span class="st-face">${face(d.me.avatar, d.me.name)}</span><span class="st-name">Add status</span></a>`;
  const friends = d.friends.map((f) => `<a class="st-item" href="#/status/view?u=${f.user.id}">${ring(f.items, !f.unseen, false)}<span class="st-face">${face(f.user.avatar, f.user.name)}</span><span class="st-name"${f.unseen ? ' style="font-weight:700"' : ''}>${h(f.user.name)}</span></a>`).join('');
  host.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center;margin:0 2px 8px"><span class="section" style="margin:0">STATUS</span>${d.mine.length ? `<span class="row" style="gap:6px"><a class="iconbtn" href="#/status/new" aria-label="New text status" style="width:34px;height:34px">${icon('pen')}</a><a class="iconbtn" href="#/status/new?photo=1" aria-label="New photo status" style="width:34px;height:34px">${icon('camera')}</a></span>` : ''}</div>
    <div class="st-row">${mine}${friends}${!d.hasFriends ? `<a class="st-item st-empty" href="#/friends"><span class="st-face" style="background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--ink-3)">${icon('user-plus')}</span><span class="st-name">Add friends</span></a>` : ''}</div>
    ${!d.hasFriends ? '<div class="small muted" style="margin:6px 2px 0;line-height:1.45">Statuses are shared with your Buja friends. Add people by their Buja tag to see theirs and let them see yours.</div>' : ''}`;
}
