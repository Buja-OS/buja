// Buja city: News, Abuja Social, Radio. Registered into the app router by app.js.
export function registerCity({ route, go, state, api, ui, DISTRICTS, failed, radio }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon, attachmentHtml, youtubeEmbed, linkify } = ui;
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const ago = (iso) => { const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 60 ? 'just now' : d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  const colors = ['#1F4E9C', '#2E7D1E', '#8E44AD', '#C0392B', '#0E7C86', '#E8620E'];
  const color = (s) => colors[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  async function shrink(file, max = 1600, q = 0.85) {
    if (!/^image\//.test(file.type) || file.type === 'image/gif') return file;
    const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file;
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)); if (s === 1 && file.size < 900000) return file;
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', q));
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  }
  const face = (a, size = 36) => a.avatar ? `<img src="${a.avatar}" alt="" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;object-fit:cover;flex-shrink:0">` : avatar(a.name, size, color(a.name));

  /* ---------------- News ---------------- */
  const CATICON = { transport: 'bus', security: 'shield-halved', power: 'bolt', housing: 'house-chimney', jobs: 'briefcase', life: 'star', general: 'circle-info' };
  /** Up to six photos: one fills the width, two sit side by side, more become a grid with a +N on the last. */
  const photoGrid = (imgs, id) => {
    if (!imgs || !imgs.length) return '';
    const show = imgs.slice(0, 4); const extra = imgs.length - show.length;
    const cols = show.length === 1 ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)';
    const rows = show.length === 1 ? '' : 'grid-auto-rows:110px;';
    return `<div class="pgrid" style="display:grid;gap:4px;border-radius:14px;overflow:hidden;grid-template-columns:${cols};${rows}" data-gal="${id}" data-imgs="${h(JSON.stringify(imgs))}">
      ${show.map((src, i) => `<button type="button" data-i="${i}" style="border:none;padding:0;background:#000;position:relative;${show.length === 1 ? 'aspect-ratio:16/10;' : 'height:100%;'}${show.length === 3 && i === 0 ? 'grid-row:span 2;' : ''}">
        <img src="${h(src)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">
        ${extra && i === show.length - 1 ? `<span style="position:absolute;inset:0;background:rgba(0,0,0,.5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800">+${extra}</span>` : ''}</button>`).join('')}
    </div>`;
  };
  /** Full-screen viewer: swipe or tap the arrows. */
  function openGallery(imgs, start = 0) {
    let i = start;
    const v = document.createElement('div'); v.id = 'gallery';
    v.style.cssText = 'position:fixed;inset:0;background:#000;z-index:90;display:flex;flex-direction:column';
    const draw = () => { v.innerHTML = `<div class="row" style="padding:calc(10px + var(--safe-t,0px)) 12px;color:#fff"><span class="small grow">${i + 1} of ${imgs.length}</span><button class="iconbtn" id="gx" aria-label="Close" style="background:rgba(255,255,255,.15);border:none;color:#fff">${icon('xmark')}</button></div>
      <div class="grow" style="display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${h(imgs[i])}" alt="" style="max-width:100%;max-height:100%;object-fit:contain"></div>
      ${imgs.length > 1 ? `<div class="row" style="gap:10px;padding:14px 12px calc(20px + var(--safe-b,0px));justify-content:center"><button class="btn btn-sm" id="gp" style="width:auto;background:rgba(255,255,255,.15);color:#fff;border:none">${icon('arrow-left')}</button><button class="btn btn-sm" id="gn" style="width:auto;background:rgba(255,255,255,.15);color:#fff;border:none">${icon('arrow-right')}</button></div>` : ''}`;
      v.querySelector('#gx').addEventListener('click', () => v.remove());
      v.querySelector('#gp')?.addEventListener('click', () => { i = (i - 1 + imgs.length) % imgs.length; draw(); });
      v.querySelector('#gn')?.addEventListener('click', () => { i = (i + 1) % imgs.length; draw(); });
    };
    draw(); document.body.appendChild(v);
    let x0 = null; v.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; });
    v.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50 && imgs.length > 1) { i = (i + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length; draw(); } x0 = null; });
  }
  // One listener for every photo grid, whichever screen drew it.
  if (!window.__bujaGal) {
    window.__bujaGal = 1;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.pgrid [data-i]'); if (!btn) return;
      const grid = btn.closest('.pgrid'); let imgs = [];
      try { imgs = JSON.parse(grid.dataset.imgs || '[]'); } catch {}
      if (!imgs.length) imgs = [...grid.querySelectorAll('img')].map((i) => i.src);
      if (imgs.length) { e.preventDefault(); openGallery(imgs, +btn.dataset.i || 0); }
    });
  }

  // A little colour per paper, so the eye learns the sources
  const SRCOL = { 'Punch': '#C0392B', 'Premium Times': '#1F4E9C', 'Daily Trust': '#0E7C86', 'Vanguard': '#B7791F', 'Guardian': '#1B1B1F', 'Channels': '#2E7D1E', 'Leadership': '#7A3E96', 'TheCable': '#E8620E' };
  const srcTag = (src) => { const c = SRCOL[src] || '#55555F'; return `<span class="nw-src" style="--c:${c}"><i>${h((src || '?').replace(/^The/, '').trim()[0] || '?')}</i>${h(src)}</span>`; };
  const dayOf = (iso) => { const d = new Date(iso.replace(' ', 'T') + 'Z'), n = new Date(); const y = new Date(n); y.setDate(n.getDate() - 1); return d.toDateString() === n.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }); };
  const img = (src, cls, fallbackIcon) => src ? `<img class="${cls}" src="${h(src)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;${cls} nw-noimg&quot;></span>'">` : `<span class="${cls} nw-noimg">${icon(fallbackIcon)}</span>`;
  route('/news', { auth: true, tabs: '' }, async () => {
    const cat = q().get('category') || 'all';
    const { news, categories } = await api.news(cat);
    const lead = news.find((n) => n.priority >= 3 && n.image) || news.find((n) => n.image) || news[0];
    const rest = news.filter((n) => n !== lead);
    const top = rest.filter((n) => n.image).slice(0, 6), list = rest.filter((n) => !top.includes(n));
    let lastDay = '';
    const row = (n) => { const d = dayOf(n.at); const head = d !== lastDay ? `<div class="section nw-day">${d.toUpperCase()}</div>` : ''; lastDay = d;
      return `${head}<a class="nw-row" href="#/news/${n.id}"><span class="grow" style="min-width:0">${srcTag(n.source)}<span class="nw-rtitle">${h(n.title)}</span><span class="nw-meta">${ago(n.at)}${n.category !== 'general' ? ' · ' + h(n.category) : ''}${n.hasBody ? ' · read in Buja' : ''}</span></span>${img(n.image, 'nw-thumb', CATICON[n.category] || 'newspaper')}</a>`; };
    return `${topbar('Abuja news', '/home', `<button class="iconbtn" id="refresh" aria-label="Check for new stories">${icon('arrows-rotate')}</button>`)}
    <div class="nw-chips">${categories.map((c) => `<a class="chip ${cat === c ? 'on' : ''}" href="#/news?category=${c}">${c === 'all' ? 'All' : `${icon(CATICON[c] || 'newspaper')} ${c[0].toUpperCase() + c.slice(1)}`}</a>`).join('')}</div>
    <main class="pad stack" style="gap:14px;padding-top:12px">
      ${lead ? `<a class="nw-lead" href="#/news/${lead.id}">${img(lead.image, 'nw-leadimg', CATICON[lead.category] || 'newspaper')}<span class="nw-leadtxt">
        ${lead.priority >= 3 ? `<span class="nw-flag">${icon('triangle-exclamation')} Worth knowing</span>` : ''}
        <span class="nw-leadtitle">${h(lead.title)}</span><span class="nw-leadmeta">${h(lead.source)} · ${ago(lead.at)}</span></span></a>` : ''}
      ${top.length ? `<div><div class="section" style="margin:2px 0 8px">TOP STORIES</div><div class="nw-strip">${top.map((n) => `<a class="nw-card" href="#/news/${n.id}">${img(n.image, 'nw-cardimg', CATICON[n.category] || 'newspaper')}<span class="nw-cardbody">${srcTag(n.source)}<span class="nw-cardtitle">${h(n.title)}</span><span class="nw-meta">${ago(n.at)}</span></span></a>`).join('')}</div></div>` : ''}
      ${list.length ? `<div class="nw-list">${list.map(row).join('')}</div>` : ''}
      ${!news.length ? `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('newspaper')}</div><div class="h-md">No Abuja stories ${cat === 'all' ? 'yet' : 'in ' + h(cat)}</div><div class="small muted" style="max-width:280px;line-height:1.5">Buja reads the Nigerian papers every half hour and keeps what is about Abuja. Tap refresh to check now.</div></div>` : ''}
      <div class="small muted" style="line-height:1.5;padding-bottom:6px">From Punch, Premium Times, Daily Trust, Vanguard, Guardian, Channels, Leadership and TheCable, filtered to Abuja and the FCT. Only urgent stories send a notification, at most three a day.</div>
    </main>`;
  }, { mount(el) { el.querySelector('#refresh')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.refreshNews(); toast(r.added ? r.added + ' new stor' + (r.added === 1 ? 'y' : 'ies') : 'Nothing new yet'); location.reload(); } catch (err) { busy(e.currentTarget, false); failed(el, err); } }); } });

  /* ---------------- Abuja Social ---------------- */
  const BOARDICON = { general: 'message', ask: 'circle-info', traffic: 'route', power: 'bolt', events: 'star', market: 'tags', housing: 'house-chimney', jobs: 'briefcase', banter: 'heart' };
  function postCard(p) {
    return `<a class="card stack" href="#/social/${p.id}" style="padding:14px;gap:10px">
      <div class="row" style="gap:10px">${face(p.author, 36)}<div class="grow" style="min-width:0"><div class="row" style="gap:6px"><span style="font-size:13px;font-weight:650">${h(p.author.name)}</span>${p.author.verified ? icon('circle-check') : ''}${p.author.plus ? `<span class="tag green" style="font-size:9px;padding:2px 6px">PLUS</span>` : ''}</div><div class="small muted">${h(p.author.district || 'Abuja')} · ${ago(p.at)}</div></div><span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(p.boardLabel)}</span></div>
      <div><div style="font-size:15px;font-weight:700;line-height:1.35">${h(p.title)}</div><div class="small" style="color:var(--ink-2);margin-top:4px;line-height:1.5">${h(p.body.slice(0, 140))}${p.body.length > 140 ? '…' : ''}</div></div>
      ${p.images && p.images.length ? photoGrid(p.images, 'p' + p.id) : (p.attachment ? attachmentHtml(p.attachment, { max: 999 }) : '')}
      <div class="row small muted" style="gap:16px">${icon('heart')} ${p.likes} · ${icon('message')} ${p.replies}${p.district ? ` · ${icon('location-dot')} ${h(p.district)}` : ''}</div></a>`;
  }
  route('/social', { auth: true, tabs: '' }, async () => {
    const f = Object.fromEntries(q().entries());
    const { posts, boards } = await api.social(f);
    return `${topbar('Abuja Social', '/home', `<a class="iconbtn" href="#/social/new" aria-label="New post">${icon('plus')}</a>`)}
    <div class="row" style="gap:8px;padding:2px 16px 0;overflow-x:auto;scrollbar-width:none">${['', ...Object.keys(boards)].map((b) => `<a class="chip ${(f.board || '') === b ? 'on' : ''}" href="#/social?${new URLSearchParams({ ...f, board: b })}">${b ? boards[b] : 'All'}</a>`).join('')}</div>
    <div class="row small" style="gap:14px;padding:12px 16px 0"><a href="#/social?${new URLSearchParams({ ...f, sort: 'latest' })}" style="font-weight:600;color:${f.sort === 'top' ? 'var(--ink-3)' : 'var(--ink)'}">Latest</a><a href="#/social?${new URLSearchParams({ ...f, sort: 'top' })}" style="font-weight:600;color:${f.sort === 'top' ? 'var(--ink)' : 'var(--ink-3)'}">Most liked</a><a href="#/social?${new URLSearchParams({ ...f, district: f.district === 'mine' ? '' : 'mine' })}" style="font-weight:600;color:${f.district === 'mine' ? 'var(--orange-dark)' : 'var(--ink-3)'}">${h(state.user.district || 'My district')} only</a></div>
    <main class="pad stack" style="gap:12px;padding-top:12px">
      ${posts.length ? posts.map(postCard).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('message')}</div><div class="h-md">Nothing here yet</div><div class="small muted" style="max-width:280px;line-height:1.5">Start it. Ask where to fix a phone screen, warn people about a road, or share what is happening this weekend.</div><a class="btn btn-ink" href="#/social/new" style="width:auto">Write the first post</a></div>`}
    </main>
    <a href="#/social/new" style="position:fixed;right:16px;bottom:calc(var(--tab-h) + var(--safe-b) + 16px);height:52px;padding:0 20px;display:flex;align-items:center;gap:10px;background:var(--orange);color:#fff;border-radius:26px;font-size:15px;font-weight:700;box-shadow:0 8px 24px rgba(255,122,26,.35);z-index:15">${icon('plus')} Post</a>`;
  });

  route('/social/new', { auth: true, tabs: '' }, async () => {
    const { boards } = await api.social({});
    const pre = q().get('board') || 'general';
    return `${topbar('New post', '/social')}
    <form id="pf" class="pad stack" style="gap:14px">
      <div class="field"><label for="board">Board</label><select class="input" id="board">${Object.entries(boards).map(([k, v]) => `<option value="${k}" ${k === pre ? 'selected' : ''}>${v}</option>`).join('')}</select><div class="error" data-error="board"></div></div>
      ${field({ id: 'title', label: 'Title', placeholder: 'Kubwa expressway this morning' })}
      <div class="field"><label for="body">What do you want to say</label><textarea class="input" id="body" maxlength="4000" placeholder="Keep it useful. People in your district will read it." style="height:160px;padding:12px 14px;resize:none"></textarea><div class="error" data-error="body"></div></div>
      <div class="stack" style="gap:8px"><div class="row" id="pthumbs" style="gap:8px;flex-wrap:wrap"></div><div class="row" style="gap:8px"><label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} Photos or video<input type="file" accept="image/*,video/*" id="pmedia" multiple style="display:none"></label><span class="small muted" id="pmname"></span></div><div id="ppreview"></div><div class="small muted">A YouTube link anywhere in your post turns into a player.</div></div>
      <label class="check" style="align-items:center"><input type="checkbox" id="tagdistrict" checked>Tag it to ${h(state.user.district || 'my district')}</label>
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} Post</button>
      <div class="small muted" style="line-height:1.5">Your first name and initial are shown, never your full name, phone or email.</div>
    </form>`;
  }, { mount(el) {
    clearOnInput(el); let uploadId = null; const shots = []; // several photos, or a single video
    const thumbs = () => {
      const box = el.querySelector('#pthumbs'); if (!box) return;
      box.innerHTML = shots.map((s, i) => `<span style="position:relative;display:inline-block"><img src="${s.url}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;display:block"><button type="button" data-rm="${i}" aria-label="Remove" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:11px;background:#101014;color:#fff;border:2px solid #fff;font-size:12px;line-height:1;cursor:pointer">&times;</button></span>`).join('');
      box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { shots.splice(+b.dataset.rm, 1); thumbs(); el.querySelector('#pmname').textContent = shots.length ? shots.length + ' photo' + (shots.length === 1 ? '' : 's') + ' attached' : ''; }));
    };
    el.querySelector('#pmedia').addEventListener('change', async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      const vid = files.find((f) => f.type.startsWith('video'));
      if (!vid) {
        const room = 6 - shots.length;
        if (files.length > room) toast(`Six photos at most, so the first ${room} were kept`);
        el.querySelector('#pmname').textContent = 'Uploading…';
        for (const f of files.slice(0, Math.max(0, room))) {
          try { const r = await api.upload(await shrink(f), 'image'); shots.push({ id: r.upload.id, url: URL.createObjectURL(f) }); } catch (err) { failed(el, err); }
        }
        el.querySelector('#pmname').textContent = shots.length ? shots.length + ' photo' + (shots.length === 1 ? '' : 's') + ' attached' : '';
        thumbs(); e.target.value = ''; return;
      }
      const f = vid;
      const kind = 'video';
      el.querySelector('#pmname').textContent = 'Uploading…';
      try { const file = kind === 'image' ? await shrink(f) : f; const r = await api.upload(file, kind); uploadId = r.upload.id; el.querySelector('#pmname').textContent = kind === 'video' ? 'Video attached' : 'Photo attached'; el.querySelector('#ppreview').innerHTML = attachmentHtml(r.upload, { max: 240 }); }
      catch (err) { el.querySelector('#pmname').textContent = ''; failed(el, err); }
    });
    el.querySelector('#pf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { const r = await api.createPost({ uploadIds: shots.map((s) => s.id), board: el.querySelector('#board').value, title: el.querySelector('#title').value, body: el.querySelector('#body').value, district: el.querySelector('#tagdistrict').checked ? state.user.district : null, uploadId }); toast('Posted'); go('/social/' + r.post.id); } catch (err) { busy(btn, false); failed(el, err); } });
  } });

  route('/social/:id', { auth: true, tabs: '' }, async ({ id }) => {
    if (id === 'new') return '';
    const { post: p, replies } = await api.post(id);
    return `${topbar(p.boardLabel, '/social', p.mine || state.user.admin || state.user.role === 'moderator' ? `<button class="iconbtn" id="del" aria-label="Delete">${icon('xmark')}</button>` : '')}
    <main class="pad stack" style="gap:14px">
      <div class="row" style="gap:10px">${face(p.author, 44)}<div class="grow"><div class="row" style="gap:6px"><span style="font-size:14px;font-weight:700">${h(p.author.name)}</span>${p.author.verified ? icon('circle-check') : ''}</div><div class="small muted">${h(p.author.district || 'Abuja')} · ${ago(p.at)} · ${p.views} view${p.views === 1 ? '' : 's'}</div></div></div>
      <div><div class="h-lg" style="font-size:22px;line-height:1.3">${h(p.title)}</div><p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:var(--ink-2);white-space:pre-line">${linkify(h(p.body))}</p></div>
      ${p.images && p.images.length ? photoGrid(p.images, 'p' + p.id) : (p.attachment ? attachmentHtml(p.attachment, { max: 999 }) : '')}
      ${youtubeEmbed(p.body)}
      <div class="row" style="gap:10px"><button class="btn btn-sm ${p.liked ? 'btn-ink' : 'btn-outline'}" data-like="post" data-id="${p.id}" style="width:auto">${icon('heart')} <span data-count>${p.likes}</span></button><span class="small muted grow">${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}</span>${p.mine ? '' : `<a class="small" href="#/report/post/${p.id}" style="color:var(--ink-3);font-weight:600">${icon('triangle-exclamation')} Report</a>`}</div>
      <div class="stack" style="gap:10px">${replies.map((r) => `<div class="card stack" style="padding:12px 14px;gap:8px"><div class="row" style="gap:10px">${face(r.author, 30)}<div class="grow"><div class="row" style="gap:6px"><span style="font-size:13px;font-weight:650">${h(r.author.name)}</span>${r.author.verified ? icon('circle-check') : ''}</div><div class="small muted">${h(r.author.district || 'Abuja')} · ${ago(r.at)}</div></div></div><div style="font-size:14px;line-height:1.55;white-space:pre-line">${linkify(h(r.body))}</div>${r.attachment ? attachmentHtml(r.attachment, { max: 240 }) : ''}${youtubeEmbed(r.body)}<button class="btn btn-sm ${r.liked ? 'btn-ink' : 'btn-outline'}" data-like="reply" data-id="${r.id}" style="width:auto;height:32px;font-size:12px">${icon('heart')} <span data-count>${r.likes}</span></button></div>`).join('')}</div>
    </main>
    <form id="rf" class="row" style="gap:10px;padding:10px 16px calc(10px + var(--safe-b));background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      <label for="rb" style="position:absolute;left:-9999px">Reply</label>
      <label class="iconbtn" style="cursor:pointer;width:42px;height:42px;flex-shrink:0" aria-label="Attach">${icon('camera')}<input type="file" accept="image/*,video/*" id="rmedia" style="display:none"></label>
      <input class="input" id="rb" placeholder="Write a reply" autocomplete="off" style="height:46px;border-radius:23px;flex:1">
      <button class="iconbtn" type="submit" aria-label="Send" style="background:var(--orange);border-color:var(--orange);color:#fff;width:46px;height:46px">${icon('paper-plane')}</button>
    </form>`;
  }, {
    mount(el, { id }) {
      el.querySelectorAll('[data-like]').forEach((b) => b.addEventListener('click', async () => { try { const r = await api.likeSocial(b.dataset.like, b.dataset.id); b.querySelector('[data-count]').textContent = r.likes; b.classList.toggle('btn-ink', r.liked); b.classList.toggle('btn-outline', !r.liked); } catch (err) { failed(el, err); } }));
      let rUpload = null;
      el.querySelector('#rmedia')?.addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; const kind = f.type.startsWith('video') ? 'video' : 'image'; toast('Uploading…'); try { const file = kind === 'image' ? await shrink(f) : f; const r = await api.upload(file, kind); rUpload = r.upload.id; toast(kind === 'video' ? 'Video ready, send it' : 'Photo ready, send it'); } catch (err) { failed(el, err); } });
      el.querySelector('#rf')?.addEventListener('submit', async (e) => { e.preventDefault(); const i = el.querySelector('#rb'); const v = i.value.trim(); if (!v && !rUpload) return; busy(e.target.querySelector('[type=submit]'), true); try { await api.replyPost(id, v, rUpload); i.value = ''; rUpload = null; location.reload(); } catch (err) { failed(el, err); } });
      el.querySelector('#del')?.addEventListener('click', async () => { if (!confirm('Delete this post?')) return; try { await api.deletePost(id); toast('Deleted'); go('/social'); } catch (err) { failed(el, err); } });
    }
  });

  /* ---------------- Radio ---------------- */
  /* ---------- Reading a story inside Buja: text size, read aloud, reading progress ---------- */
  route('/news/:id', { auth: true, tabs: '' }, async ({ id }) => {
    let d; try { d = await api.newsItem(id); } catch (err) { return `${topbar('Story', '/news')}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('newspaper')}</div><div class="h-md">${h((err && err.message) || 'This story is gone')}</div><a class="btn btn-ink" href="#/news" style="width:auto">Back to the news</a></div>`; }
    const n = d.item;
    return `<div class="nw-progress" id="prog"></div>${topbar('', '/news', `${n.body && 'speechSynthesis' in window ? `<button class="iconbtn" id="listen" aria-label="Read it aloud">${icon('volume-high')}</button>` : ''}<button class="iconbtn" id="size" aria-label="Text size" style="font-weight:800;font-size:14px">Aa</button><button class="iconbtn" id="share" aria-label="Share">${icon('share-nodes')}</button>`)}
    <main class="pad stack" style="gap:14px">
      ${n.image ? `<img src="${h(n.image)}" alt="" class="nw-hero" onerror="this.remove()">` : ''}
      <div>${srcTag(n.source)}<h1 class="nw-h1">${h(n.title)}</h1>
        <div class="nw-meta">${ago(n.at)}${n.minutes ? ` · ${n.minutes} min read` : ''}${n.category && n.category !== 'general' ? ' · ' + h(n.category) : ''}</div></div>
      ${n.body ? `<article class="nw-body" id="body">${n.body.split('\n\n').map((p) => `<p>${h(p)}</p>`).join('')}</article>`
        : `<div class="card stack" style="padding:16px;gap:10px"><div class="small" style="line-height:1.6;color:var(--ink-2)">${h(n.summary || 'This publisher does not allow Buja to show the full story.')}</div><a class="btn btn-primary" href="${h(n.url)}" target="_blank" rel="noopener">Read it on ${h(n.source)}</a></div>`}
      <div class="card row" style="padding:12px 14px;gap:10px;background:var(--surface);border:none"><div class="grow small muted" style="line-height:1.5">Reported by <strong>${h(n.source)}</strong>. Buja shows it here so you do not lose your place, and sends no data to the publisher until you open the original.</div></div>
      <a class="btn btn-outline" href="${h(n.url)}" target="_blank" rel="noopener">${icon('arrow-up-right-from-square')} Open the original on ${h(n.source)}</a>
      ${d.more && d.more.length ? `<div class="section">MORE LIKE THIS</div><div class="nw-list">${d.more.map((m) => `<a class="nw-row" href="#/news/${m.id}"><span class="grow" style="min-width:0">${srcTag(m.source)}<span class="nw-rtitle">${h(m.title)}</span><span class="nw-meta">${ago(m.at)}</span></span>${img(m.image, 'nw-thumb', 'newspaper')}</a>`).join('')}</div>` : ''}
    </main>`;
  }, {
    mount(el, { id }) {
      const body = el.querySelector('#body');
      // text size: three steps, remembered on this phone
      const SIZES = [16, 18, 20]; let sz = (() => { try { return +localStorage.getItem('buja_news_size') || 0; } catch { return 0; } })();
      const apply = () => { if (body) body.style.fontSize = SIZES[sz] + 'px'; };
      apply();
      el.querySelector('#size')?.addEventListener('click', () => { sz = (sz + 1) % SIZES.length; apply(); try { localStorage.setItem('buja_news_size', String(sz)); } catch {} toast(['Normal text', 'Larger text', 'Largest text'][sz]); });
      // read aloud with the phone's own voice
      const listen = el.querySelector('#listen');
      if (listen) {
        const stopTalk = () => { try { speechSynthesis.cancel(); } catch {} listen.classList.remove('on'); listen.innerHTML = icon('volume-high'); };
        listen.addEventListener('click', () => {
          if (speechSynthesis.speaking) { stopTalk(); return; }
          const u = new SpeechSynthesisUtterance((el.querySelector('.nw-h1')?.textContent || '') + '. ' + body.innerText);
          const v = speechSynthesis.getVoices().find((x) => /en-NG/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang)); if (v) u.voice = v;
          u.rate = 1; u.onend = stopTalk; u.onerror = stopTalk;
          speechSynthesis.speak(u); listen.classList.add('on'); listen.innerHTML = icon('pause'); toast('Reading the story aloud');
        });
        window.addEventListener('hashchange', stopTalk, { once: true });
      }
      // reading progress along the top
      const prog = el.querySelector('#prog');
      const onScroll = () => { if (!document.body.contains(el)) { window.removeEventListener('scroll', onScroll); return; } const max = document.documentElement.scrollHeight - innerHeight; prog.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + '%'; };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
      el.querySelector('#share')?.addEventListener('click', async () => {
        const t = el.querySelector('h1')?.textContent || 'A story on Buja';
        const url = location.origin + '/#/news/' + id;
        if (navigator.share) navigator.share({ title: t, text: t, url }).catch(() => {});
        else { try { await navigator.clipboard.writeText(t + ' ' + url); toast('Link copied'); } catch { toast(url, 5000); } }
      });
    }
  });

  /* Radio: a big "now playing" player on top, filters, favourites and recently played, then every station as a card.
     Favourites and recents live on this phone only (they are a personal shortcut, not shared with anyone). */
  const RGROUPS = [['all', 'All'], ['fav', 'Favourites'], ['news', 'News & talk'], ['music', 'Music'], ['local', 'Hausa, Igbo, Pidgin'], ['sport', 'Sport']];
  const inGroup = (s, g) => { const t = (s.genre || '').toLowerCase() + ' ' + s.name.toLowerCase();
    return g === 'news' ? /news|talk|current affairs|advocacy|complaint|traffic|frcn/.test(t) : g === 'music' ? /music|afro|pop|hip-hop|urban|hits|classic/.test(t) : g === 'local' ? /hausa|igbo|pidgin|yoruba|wazobia|oganiru/.test(t) : g === 'sport' ? /sport|brila/.test(t) : true; };
  const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  route('/radio', { auth: true, tabs: '' }, async () => {
    const { stations } = await api.radio();
    return `${topbar('Abuja radio', '/home')}
    <main class="pad stack" style="gap:14px" id="radio" data-st='${JSON.stringify(stations.map((s) => ({ id: s.id, name: s.name, frequency: s.frequency, genre: s.genre || '', stream: s.stream || '', website: s.website || '' }))).replace(/'/g, '&#39;')}'>
      <section class="rp-hero" id="hero"></section>
      <div class="row rp-chips" id="chips">${RGROUPS.map(([k, t]) => `<button class="chip" data-g="${k}">${t}</button>`).join('')}</div>
      <div id="recent"></div>
      <div class="rp-grid" id="grid"></div>
      <div id="offair"></div>
    </main>`;
  }, {
    mount(el) {
      const fnum = (s) => { const f = parseFloat(s.frequency); return isFinite(f) ? f : 999; };
      const all = JSON.parse(el.querySelector('#radio').dataset.st).sort((a, b) => fnum(a) - fnum(b));   // FM by frequency, online-only last
      const live = all.filter((s) => s.stream), off = all.filter((s) => !s.stream);
      let group = store('buja_radio_group', 'all'), favs = store('buja_radio_favs', []);
      const freq = (s) => s.frequency && s.frequency !== '—' ? `<b>${h(s.frequency)}</b><i>FM</i>` : '<b style="font-size:13px">WEB</b><i>ONLINE</i>';
      const eq = '<span class="rp-eq"><i></i><i></i><i></i><i></i></span>';
      const hero = () => {
        const st = radio.station, playing = radio.playing, note = radio.note;
        const recent0 = store('buja_radio_recent', [])[0];
        const pick = st || live.find((s) => s.id === recent0) || live.find((s) => favs.includes(s.id)) || live.find((s) => /cool fm/i.test(s.name)) || live[0];
        if (!pick) { el.querySelector('#hero').innerHTML = '<div class="small" style="color:#AEB4BE">No station has a stream yet.</div>'; return; }
        const sleepLeft = radio.sleepAt ? Math.max(1, Math.round((radio.sleepAt - Date.now()) / 60000)) : 0;
        el.querySelector('#hero').innerHTML = `
          <div class="row" style="gap:14px;align-items:center">
            <div class="rp-dial${playing ? ' on' : ''}">${freq(pick)}</div>
            <div class="grow" style="min-width:0">
              <div class="rp-kicker">${st ? (playing ? `${eq} LIVE NOW` : note ? h(note).toUpperCase() : 'PAUSED') : 'TAP PLAY TO LISTEN'}</div>
              <div class="rp-name">${h(pick.name)}</div>
              <div class="rp-genre">${h(pick.genre || 'Abuja radio')}</div>
            </div>
            <button class="rp-fav${favs.includes(pick.id) ? ' on' : ''}" data-fav="${pick.id}" aria-label="${favs.includes(pick.id) ? 'Remove from favourites' : 'Add to favourites'}">${icon('star')}</button>
          </div>
          <div class="row rp-ctl">
            <button class="rp-b" id="hprev" aria-label="Previous station">${icon('backward-step')}</button>
            <button class="rp-play" id="hplay" aria-label="${playing ? 'Pause' : 'Play'}">${icon(playing ? 'pause' : 'play')}</button>
            <button class="rp-b" id="hnext" aria-label="Next station">${icon('forward-step')}</button>
          </div>
          <div class="row rp-sleep"><span>${icon('moon')} ${sleepLeft ? `Sleep in ${sleepLeft} min` : 'Sleep timer'}</span>${[15, 30, 60].map((m) => `<button data-sleep="${m}">${m} min</button>`).join('')}${sleepLeft ? '<button data-sleep="0">Off</button>' : ''}</div>`;
        el.querySelector('#hplay').onclick = () => { if (radio.station) radio.play(radio.station, live); else radio.play(pick, live); };
        el.querySelector('#hprev').onclick = () => { if (!radio.station) radio.play(pick, live); radio.step(-1); };
        el.querySelector('#hnext').onclick = () => { if (!radio.station) radio.play(pick, live); radio.step(1); };
        el.querySelectorAll('#hero [data-sleep]').forEach((b) => { b.onclick = () => { if (!radio.station && +b.dataset.sleep) { toast('Start a station first'); return; } radio.sleep(+b.dataset.sleep); toast(+b.dataset.sleep ? `Radio stops in ${b.dataset.sleep} minutes` : 'Sleep timer off'); }; });
      };
      const card = (s) => { const on = radio.station && radio.station.id === s.id; return `<button class="rp-card${on ? ' on' : ''}" data-play="${s.id}" aria-label="${on && radio.playing ? 'Pause' : 'Play'} ${h(s.name)}">
          <span class="rp-freq">${freq(s)}</span>
          <span class="rp-cname">${h(s.name)}${favs.includes(s.id) ? ` <span class="rp-cfav">${icon('star')}</span>` : ''}</span><span class="rp-cgenre">${h(s.genre)}</span>
          <span class="rp-cplay">${on && radio.playing ? eq : icon('play')}</span></button>`; };
      const grid = () => {
        el.querySelectorAll('#chips [data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === group));
        const list = live.filter((s) => group === 'fav' ? favs.includes(s.id) : inGroup(s, group));
        el.querySelector('#grid').innerHTML = list.length ? list.map(card).join('') : `<div class="small muted" style="grid-column:1/-1;padding:14px 2px;line-height:1.5">${group === 'fav' ? 'Tap the star on a station to keep it here.' : 'No station in this group plays online yet.'}</div>`;
        const recent = store('buja_radio_recent', []).map((id) => live.find((s) => s.id === id)).filter(Boolean).slice(0, 6);
        el.querySelector('#recent').innerHTML = recent.length > 1 && group === 'all' ? `<div class="section" style="margin:0 0 8px">RECENTLY PLAYED</div><div class="row rp-recent">${recent.map((s) => `<button class="rp-mini${radio.station && radio.station.id === s.id ? ' on' : ''}" data-play="${s.id}"><span>${h(s.frequency !== '—' ? s.frequency : 'WEB')}</span>${h(s.name)}</button>`).join('')}</div>` : '';
      };
      const offair = () => { el.querySelector('#offair').innerHTML = off.length ? `<details class="card" style="padding:12px 14px"><summary style="font-weight:650;font-size:14px;cursor:pointer">${off.length} more stations on FM only</summary><div class="small muted" style="line-height:1.5;margin:8px 0">These broadcast on FM in Abuja but do not publish an online stream Buja can play.</div>${off.map((s) => `<div class="row" style="gap:10px;padding:8px 0;border-top:1px solid var(--line)"><span style="font-weight:700;width:52px">${h(s.frequency)}</span><span class="grow" style="min-width:0"><span style="display:block;font-size:14px;font-weight:600">${h(s.name)}</span><span class="small muted">${h(s.genre)}</span></span></div>`).join('')}</details>` : ''; };
      const draw = () => { hero(); grid(); };
      el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-fav]'); if (f) { const id = +f.dataset.fav; favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; keep('buja_radio_favs', favs); draw(); return; }
        const g = e.target.closest('[data-g]'); if (g) { group = g.dataset.g; keep('buja_radio_group', group); grid(); return; }
        const p = e.target.closest('[data-play]'); if (p) { const s = live.find((x) => x.id === +p.dataset.play); if (s) radio.play(s, live); }
      });
      const onRadio = () => { if (document.body.contains(el)) draw(); else window.removeEventListener('buja-radio', onRadio); };
      window.addEventListener('buja-radio', onRadio);
      const tick = setInterval(() => { if (!document.body.contains(el)) { clearInterval(tick); return; } if (radio.sleepAt) hero(); }, 30000);
      draw(); offair();
    },
  });
}
