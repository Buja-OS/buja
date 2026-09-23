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

  route('/news', { auth: true, tabs: '' }, async () => {
    const cat = q().get('category') || 'all';
    const { news, categories } = await api.news(cat);
    const top = news.filter((n) => n.priority >= 3).slice(0, 1)[0];
    const rest = news.filter((n) => n !== top);
    return `${topbar('Abuja news', '/home', `<button class="iconbtn" id="refresh" aria-label="Refresh">${icon('route')}</button>`)}
    <div class="row" style="gap:8px;padding:4px 16px 0;overflow-x:auto;scrollbar-width:none">${categories.map((c) => `<a class="chip ${cat === c ? 'on' : ''}" href="#/news?category=${c}">${c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}</a>`).join('')}</div>
    <main class="pad stack" style="gap:12px;padding-top:12px">
      ${top ? `<a class="card dark stack" href="#/news/${top.id}" style="padding:0;gap:0;overflow:hidden">
        ${top.image ? `<img src="${h(top.image)}" alt="" loading="lazy" style="width:100%;height:170px;object-fit:cover;display:block" onerror="this.remove()">` : ''}
        <span class="stack" style="padding:16px;gap:8px">
        <div class="row" style="gap:8px"><span class="tag" style="background:var(--orange);color:#fff">${icon('triangle-exclamation')} Worth knowing</span><span class="small" style="color:#B5B5BC">${h(top.source)} · ${ago(top.at)}</span></div>
        <div style="font-size:18px;font-weight:700;line-height:1.35">${h(top.title)}</div>
        ${top.summary ? `<div class="small" style="color:#B5B5BC;line-height:1.5">${h(top.summary.slice(0, 180))}</div>` : ''}</span></a>` : ''}
      ${rest.length ? rest.map((n) => `<a class="card row" href="#/news/${n.id}" style="padding:12px;gap:12px;align-items:flex-start">
        ${n.image ? `<img src="${h(n.image)}" alt="" loading="lazy" style="width:84px;height:64px;border-radius:12px;object-fit:cover;flex-shrink:0;background:var(--surface)" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'mi',style:'width:84px;height:64px;border-radius:12px;background:var(--surface)'}))">` : `<div style="width:84px;height:64px;border-radius:12px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--ink-3);flex-shrink:0">${icon(CATICON[n.category] || 'circle-info')}</div>`}
        <div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:650;line-height:1.4">${h(n.title)}</div><div class="small muted" style="margin-top:4px">${h(n.source)} · ${ago(n.at)}${n.category !== 'general' ? ' · ' + n.category : ''}</div></div></a>`).join('')
      : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('circle-info')}</div><div class="h-md">No Abuja stories yet</div><div class="small muted" style="max-width:280px;line-height:1.5">Buja reads the Nigerian papers every half hour and keeps what is about Abuja. Pull to refresh in a moment.</div></div>`}
      <div class="small muted" style="line-height:1.5;padding-bottom:6px">Headlines from Punch, Premium Times, Daily Trust, Vanguard, Guardian, Channels, Leadership and TheCable, filtered to Abuja and the FCT. Only urgent stories send a notification, at most three a day.</div>
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
  /* ---------- Reading a story inside Buja ---------- */
  route('/news/:id', { auth: true, tabs: '' }, async ({ id }) => {
    let d; try { d = await api.newsItem(id); } catch (err) { return `${topbar('Story', '/news')}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('circle-info')}</div><div class="h-md">${h((err && err.message) || 'This story is gone')}</div><a class="btn btn-ink" href="#/news" style="width:auto">Back to the news</a></div>`; }
    const n = d.item;
    return `${topbar('', '/news', `<button class="iconbtn" id="share" aria-label="Share">${icon('paper-plane')}</button>`)}
    <main class="pad stack" style="gap:14px">
      ${n.image ? `<img src="${h(n.image)}" alt="" style="width:100%;border-radius:16px;max-height:230px;object-fit:cover" onerror="this.remove()">` : ''}
      <div><div class="row small muted" style="gap:8px"><strong style="color:var(--orange-dark)">${h(n.source)}</strong><span>${ago(n.at)}</span>${n.minutes ? `<span>· ${n.minutes} min read</span>` : ''}</div>
        <h1 style="font-size:24px;line-height:1.3;margin:8px 0 0">${h(n.title)}</h1></div>
      ${n.body ? `<article style="font-size:16px;line-height:1.7;color:var(--ink-2)">${n.body.split('\n\n').map((p) => `<p style="margin:0 0 14px">${h(p)}</p>`).join('')}</article>`
        : `<div class="card stack" style="padding:16px;gap:10px"><div class="small" style="line-height:1.6;color:var(--ink-2)">${h(n.summary || 'This publisher does not allow Buja to show the full story.')}</div><a class="btn btn-primary" href="${h(n.url)}" target="_blank" rel="noopener">Read it on ${h(n.source)}</a></div>`}
      <div class="card row" style="padding:12px 14px;gap:10px;background:var(--surface);border:none"><div class="grow small muted" style="line-height:1.5">Reported by <strong>${h(n.source)}</strong>. Buja shows it here so you do not lose your place, and sends no data to the publisher until you open the original.</div></div>
      <a class="btn btn-outline" href="${h(n.url)}" target="_blank" rel="noopener">${icon('arrow-right')} Open the original</a>
      ${d.more && d.more.length ? `<div class="section">MORE LIKE THIS</div>${d.more.map((m) => `<a class="card row" href="#/news/${m.id}" style="padding:10px 12px;gap:10px;align-items:flex-start">${m.image ? `<img src="${h(m.image)}" alt="" loading="lazy" style="width:64px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0" onerror="this.remove()">` : ''}<span class="grow" style="min-width:0"><span style="display:block;font-size:13px;font-weight:650;line-height:1.4">${h(m.title)}</span><span class="small muted">${h(m.source)} · ${ago(m.at)}</span></span></a>`).join('')}` : ''}
    </main>`;
  }, {
    mount(el, { id }) {
      el.querySelector('#share')?.addEventListener('click', async () => {
        const t = el.querySelector('h1')?.textContent || 'A story on Buja';
        const url = location.origin + '/#/news/' + id;
        if (navigator.share) navigator.share({ title: t, text: t, url }).catch(() => {});
        else { try { await navigator.clipboard.writeText(t + ' ' + url); toast('Link copied'); } catch { toast(url, 5000); } }
      });
    }
  });

  route('/radio', { auth: true, tabs: '' }, async () => {
    const { stations } = await api.radio();
    const live = stations.filter((s) => s.stream), off = stations.filter((s) => !s.stream);
    const row = (s) => `<div class="item" style="gap:12px">
      <div style="width:52px;height:44px;border-radius:12px;background:${s.stream ? 'var(--night)' : 'var(--surface)'};color:${s.stream ? '#7ED957' : 'var(--ink-3)'};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:14px;font-weight:700;line-height:1">${h(s.frequency)}</span><span style="font-size:8px;letter-spacing:1px;opacity:.7">FM</span></div>
      <div class="grow" style="min-width:0"><div class="t">${h(s.name)}</div><div class="s">${h(s.genre || '')}</div></div>
      ${s.stream ? `<button class="iconbtn" data-station='${JSON.stringify({ id: s.id, name: s.name, frequency: s.frequency, stream: s.stream }).replace(/'/g, '&#39;')}' aria-label="Play ${h(s.name)}" style="background:var(--orange);border-color:var(--orange);color:#fff;width:40px;height:40px">${icon('play')}</button>`
      : s.website ? `<a class="btn btn-sm btn-outline" href="${h(s.website)}" target="_blank" rel="noopener" style="width:auto;height:34px;font-size:12px">Site</a>` : `<span class="small muted">FM only</span>`}</div>`;
    return `${topbar('Abuja radio', '/home')}
    <main class="pad stack" style="gap:12px">
      <div class="small muted">${live.length} stations play right here in Buja. Start one and it keeps playing while you use the rest of the app.</div>
      <div class="card list">${live.map(row).join('')}</div>
      ${off.length ? `<div class="section">NO STREAM YET</div><div class="card list">${off.map(row).join('')}</div><div class="small muted" style="line-height:1.5">These broadcast on FM but do not publish an online stream. If you find one that works, send it and it goes in.</div>` : ''}
    </main>`;
  }, { mount(el) { const all = [...el.querySelectorAll('[data-station]')].map((b) => JSON.parse(b.dataset.station)); el.querySelectorAll('[data-station]').forEach((b) => b.addEventListener('click', () => radio.play(JSON.parse(b.dataset.station), all))); } });
}
