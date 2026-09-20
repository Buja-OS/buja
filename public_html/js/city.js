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
  route('/news', { auth: true, tabs: '' }, async () => {
    const cat = q().get('category') || 'all';
    const { news, categories } = await api.news(cat);
    const top = news.filter((n) => n.priority >= 3).slice(0, 1)[0];
    const rest = news.filter((n) => n !== top);
    return `${topbar('Abuja news', '/home', `<button class="iconbtn" id="refresh" aria-label="Refresh">${icon('route')}</button>`)}
    <div class="row" style="gap:8px;padding:4px 16px 0;overflow-x:auto;scrollbar-width:none">${categories.map((c) => `<a class="chip ${cat === c ? 'on' : ''}" href="#/news?category=${c}">${c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}</a>`).join('')}</div>
    <main class="pad stack" style="gap:12px;padding-top:12px">
      ${top ? `<a class="card dark stack" href="${h(top.url)}" target="_blank" rel="noopener" style="padding:18px;gap:8px">
        <div class="row" style="gap:8px"><span class="tag" style="background:var(--orange);color:#fff">${icon('triangle-exclamation')} Worth knowing</span><span class="small" style="color:#B5B5BC">${h(top.source)} · ${ago(top.at)}</span></div>
        <div style="font-size:18px;font-weight:700;line-height:1.35">${h(top.title)}</div>
        ${top.summary ? `<div class="small" style="color:#B5B5BC;line-height:1.5">${h(top.summary.slice(0, 180))}</div>` : ''}</a>` : ''}
      ${rest.length ? rest.map((n) => `<a class="card row" href="${h(n.url)}" target="_blank" rel="noopener" style="padding:14px;gap:12px;align-items:flex-start">
        <div style="width:38px;height:38px;border-radius:12px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--ink-3);flex-shrink:0">${icon(CATICON[n.category] || 'circle-info')}</div>
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
      ${p.attachment ? attachmentHtml(p.attachment, { max: 999 }) : ''}
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
      <div class="stack" style="gap:8px"><div class="row" style="gap:8px"><label class="btn btn-sm btn-outline" style="width:auto;cursor:pointer">${icon('camera')} Photo or video<input type="file" accept="image/*,video/*" id="pmedia" style="display:none"></label><span class="small muted" id="pmname"></span></div><div id="ppreview"></div><div class="small muted">A YouTube link anywhere in your post turns into a player.</div></div>
      <label class="check" style="align-items:center"><input type="checkbox" id="tagdistrict" checked>Tag it to ${h(state.user.district || 'my district')}</label>
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} Post</button>
      <div class="small muted" style="line-height:1.5">Your first name and initial are shown, never your full name, phone or email.</div>
    </form>`;
  }, { mount(el) {
    clearOnInput(el); let uploadId = null;
    el.querySelector('#pmedia').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const kind = f.type.startsWith('video') ? 'video' : 'image';
      el.querySelector('#pmname').textContent = 'Uploading…';
      try { const file = kind === 'image' ? await shrink(f) : f; const r = await api.upload(file, kind); uploadId = r.upload.id; el.querySelector('#pmname').textContent = kind === 'video' ? 'Video attached' : 'Photo attached'; el.querySelector('#ppreview').innerHTML = attachmentHtml(r.upload, { max: 240 }); }
      catch (err) { el.querySelector('#pmname').textContent = ''; failed(el, err); }
    });
    el.querySelector('#pf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true); try { const r = await api.createPost({ board: el.querySelector('#board').value, title: el.querySelector('#title').value, body: el.querySelector('#body').value, district: el.querySelector('#tagdistrict').checked ? state.user.district : null, uploadId }); toast('Posted'); go('/social/' + r.post.id); } catch (err) { busy(btn, false); failed(el, err); } });
  } });

  route('/social/:id', { auth: true, tabs: '' }, async ({ id }) => {
    if (id === 'new') return '';
    const { post: p, replies } = await api.post(id);
    return `${topbar(p.boardLabel, '/social', p.mine || state.user.admin || state.user.role === 'moderator' ? `<button class="iconbtn" id="del" aria-label="Delete">${icon('xmark')}</button>` : '')}
    <main class="pad stack" style="gap:14px">
      <div class="row" style="gap:10px">${face(p.author, 44)}<div class="grow"><div class="row" style="gap:6px"><span style="font-size:14px;font-weight:700">${h(p.author.name)}</span>${p.author.verified ? icon('circle-check') : ''}</div><div class="small muted">${h(p.author.district || 'Abuja')} · ${ago(p.at)} · ${p.views} view${p.views === 1 ? '' : 's'}</div></div></div>
      <div><div class="h-lg" style="font-size:22px;line-height:1.3">${h(p.title)}</div><p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:var(--ink-2);white-space:pre-line">${linkify(h(p.body))}</p></div>
      ${p.attachment ? attachmentHtml(p.attachment, { max: 999 }) : ''}
      ${youtubeEmbed(p.body)}
      <div class="row" style="gap:10px"><button class="btn btn-sm ${p.liked ? 'btn-ink' : 'btn-outline'}" data-like="post" data-id="${p.id}" style="width:auto">${icon('heart')} <span data-count>${p.likes}</span></button><span class="small muted">${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}</span></div>
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
  route('/radio', { auth: true, tabs: '' }, async () => {
    const { stations } = await api.radio();
    const live = stations.filter((s) => s.stream), off = stations.filter((s) => !s.stream);
    const row = (s) => `<div class="item" style="gap:12px">
      <div style="width:52px;height:44px;border-radius:12px;background:${s.stream ? 'var(--night)' : 'var(--surface)'};color:${s.stream ? '#7ED957' : 'var(--ink-3)'};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:14px;font-weight:700;line-height:1">${h(s.frequency)}</span><span style="font-size:8px;letter-spacing:1px;opacity:.7">FM</span></div>
      <div class="grow" style="min-width:0"><div class="t">${h(s.name)}</div><div class="s">${h(s.genre || '')}</div></div>
      ${s.stream ? `<button class="iconbtn" data-station='${JSON.stringify({ id: s.id, name: s.name, frequency: s.frequency, stream: s.stream }).replace(/'/g, '&#39;')}' aria-label="Play ${h(s.name)}" style="background:var(--orange);border-color:var(--orange);color:#fff;width:40px;height:40px">${icon('bolt')}</button>`
      : s.website ? `<a class="btn btn-sm btn-outline" href="${h(s.website)}" target="_blank" rel="noopener" style="width:auto;height:34px;font-size:12px">Site</a>` : `<span class="small muted">FM only</span>`}</div>`;
    return `${topbar('Abuja radio', '/home')}
    <main class="pad stack" style="gap:12px">
      <div class="small muted">${live.length} stations play right here in Buja. Start one and it keeps playing while you use the rest of the app.</div>
      <div class="card list">${live.map(row).join('')}</div>
      ${off.length ? `<div class="section">NO STREAM YET</div><div class="card list">${off.map(row).join('')}</div><div class="small muted" style="line-height:1.5">These broadcast on FM but do not publish an online stream. If you find one that works, send it and it goes in.</div>` : ''}
    </main>`;
  }, { mount(el) { el.querySelectorAll('[data-station]').forEach((b) => b.addEventListener('click', () => radio.play(JSON.parse(b.dataset.station)))); } });
}
