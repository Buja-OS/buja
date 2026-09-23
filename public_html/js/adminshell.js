// Buja admin on a computer: a sidebar and a wide sheet on big screens, the same screens on a phone.
// Also the two moderation screens the dashboard was missing: Social posts and the news feed.

const NAV = [
  ['Overview', [['/admin', 'gauge-high', 'Dashboard'], ['/admin/analytics', 'chart-line', 'Analytics'], ['/admin/launch', 'circle-check', 'Launch checklist']]],
  ['People', [['/admin/users', 'user', 'Users'], ['/admin/verifications', 'shield-halved', 'Verifications'], ['/admin/reports', 'triangle-exclamation', 'Reports'], ['/admin/invite', 'paper-plane', 'Invites']]],
  ['Content', [['/admin/social', 'message', 'Social posts'], ['/admin/news', 'circle-info', 'News feed'], ['/admin/spots', 'location-dot', 'Places'], ['/admin/meetups', 'ticket', 'Events'], ['/admin/artisans', 'screwdriver-wrench', 'Artisans'], ['/admin/citizen', 'building-columns', 'Citizen reports']]],
  ['Learning', [['/admin/learn', 'book-open', 'Learn analytics'], ['/admin/learners', 'user', 'Learners']]],
  ['Send', [['/admin/broadcast', 'paper-plane', 'Notifications']]],
  ['Settings', [['/admin/waka-pricing', 'gas-pump', 'Waka pricing']]],
];

export function registerAdminShell({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy, avatar } = ui;
  const guard = () => (state.user && (state.user.admin || state.user.role === 'moderator')) ? null : `${topbar('', '/me')}<div class="placeholder"><div class="h-md">Admins only</div><div class="small muted">Ask an admin if you think you need access.</div></div>`;
  const ago = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(String(iso).replace(' ', 'T') + 'Z')) / 1000; return d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };

  /** The sidebar lives outside the screen, so it survives navigation between admin pages. */
  function shell(path) {
    const isAdmin = path.startsWith('/admin');
    document.body.classList.toggle('admin-wide', isAdmin);
    let nav = document.querySelector('.adminnav');
    if (!isAdmin) { nav && nav.remove(); return; }
    if (!nav) {
      nav = document.createElement('nav'); nav.className = 'adminnav';
      nav.innerHTML = `<div class="brand">${icon('shield-halved')} Buja admin</div>
        ${NAV.map(([sect, items]) => `<div class="sect">${sect.toUpperCase()}</div>${items.map(([href, ic, label]) => `<a href="#${href}" data-nav="${href}">${icon(ic)} ${label}</a>`).join('')}`).join('')}
        <div class="back"><a href="#/home">${icon('arrow-left')} Back to Buja</a></div>`;
      document.body.appendChild(nav);
    }
    nav.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === path || (a.dataset.nav !== '/admin' && path.startsWith(a.dataset.nav))));
  }
  window.addEventListener('hashchange', () => shell((location.hash.slice(1) || '/').split('?')[0]));
  shell((location.hash.slice(1) || '/').split('?')[0]);

  /* ---------------- Social moderation ---------------- */
  route('/admin/social', { auth: true, tabs: '' }, async () => {
    const g = guard(); if (g) return g;
    const f = new URLSearchParams(location.hash.split('?')[1] || '');
    const d = await api.adminSocial({ q: f.get('q') || '', filter: f.get('filter') || '' });
    const chip = (k, l) => `<a class="chip ${(f.get('filter') || '') === k ? 'on' : ''}" href="#/admin/social?filter=${k}${f.get('q') ? '&q=' + encodeURIComponent(f.get('q')) : ''}">${l}</a>`;
    return `${topbar('Social posts', '/admin')}
    <main class="pad stack" style="gap:12px">
      <div class="kpis">${[['Live', d.counts.live], ['Hidden', d.counts.hidden], ['Today', d.counts.today], ['Showing', d.posts.length]].map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <form id="sf"><div class="card row" style="height:46px;padding:0 14px;gap:10px">${icon('magnifying-glass')}<input name="q" type="search" value="${h(f.get('q') || '')}" placeholder="Search title or body" style="flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--ink)"></div></form>
      <div class="row" style="gap:8px;overflow-x:auto;scrollbar-width:none">${chip('', 'All')}${chip('live', 'Live')}${chip('hidden', 'Hidden')}</div>
      ${d.posts.map((p) => `<div class="card stack" style="padding:12px 14px;gap:8px;${p.hidden ? 'opacity:.6' : ''}">
        <div class="row" style="gap:10px"><div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${h(p.title)}</div>
          <div class="small muted">${h(p.board)} · <a href="#/admin/users/${p.author.id}">${h(p.author.name)}</a> · ${ago(p.at)} · ${p.replies} replies · ${p.likes} likes · ${p.views} views</div></div>
          ${p.pinned ? `<span class="tag">Pinned</span>` : ''}${p.hidden ? `<span class="tag" style="background:#FDECEA;color:#D92D20">Hidden</span>` : ''}</div>
        <div class="small" style="color:var(--ink-2);line-height:1.5">${h(p.body)}${p.body.length >= 240 ? '…' : ''}</div>
        ${p.images.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${p.images.map((i) => `<img src="${h(i)}" alt="" loading="lazy" style="width:70px;height:70px;object-fit:cover;border-radius:8px">`).join('')}</div>` : ''}
        <div class="row" style="gap:8px"><a class="btn btn-sm btn-outline" href="#/social/${p.id}" style="width:auto">Open</a>
          <button class="btn btn-sm btn-outline" data-act="${p.hidden ? 'show' : 'hide'}" data-id="${p.id}" style="width:auto">${p.hidden ? 'Restore' : 'Hide'}</button>
          <button class="btn btn-sm btn-outline" data-act="${p.pinned ? 'unpin' : 'pin'}" data-id="${p.id}" style="width:auto">${p.pinned ? 'Unpin' : 'Pin'}</button></div>
      </div>`).join('') || `<div class="small muted">No posts match.</div>`}
    </main>`;
  }, {
    mount(el) {
      el.querySelector('#sf')?.addEventListener('submit', (e) => { e.preventDefault(); const p = new URLSearchParams(location.hash.split('?')[1] || ''); p.set('q', e.target.q.value); go('/admin/social?' + p); });
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        busy(b, true); try { await api.adminSocialAct(b.dataset.id, b.dataset.act); toast(b.dataset.act === 'hide' ? 'Hidden, and the author was told' : 'Done'); location.reload(); } catch (err) { busy(b, false); failed(el, err); }
      }));
    }
  });

  /* ---------------- News feed ---------------- */
  route('/admin/news', { auth: true, tabs: '' }, async () => {
    const g = guard(); if (g) return g;
    const d = await api.adminNews();
    return `${topbar('News feed', '/admin', `<button class="iconbtn" id="pull" aria-label="Pull the feeds">${icon('route')}</button>`)}
    <main class="pad stack" style="gap:12px">
      <div class="kpis">${[['Stories', d.counts.total], ['Added today', d.counts.today], ['With a picture', d.counts.withImage], ['Readable in Buja', d.counts.readable]].map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="small muted" style="line-height:1.5">Buja reads eight Nigerian papers and keeps what mentions Abuja or the FCT. Stories open inside Buja when the publisher allows it, with the source named and a link to the original. Hide anything wrong or duplicated.</div>
      ${d.news.map((n) => `<div class="card row" style="padding:10px 12px;gap:10px;align-items:flex-start;${n.hidden ? 'opacity:.55' : ''}">
        ${n.image ? `<img src="${h(n.image)}" alt="" loading="lazy" style="width:76px;height:58px;border-radius:10px;object-fit:cover;flex-shrink:0" onerror="this.remove()">` : `<div style="width:76px;height:58px;border-radius:10px;background:var(--surface);flex-shrink:0"></div>`}
        <div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:650;line-height:1.35">${h(n.title)}</div>
          <div class="small muted">${h(n.source)} · ${ago(n.at)} · ${h(n.category)}${n.priority >= 3 ? ' · urgent' : ''} · ${n.reads} reads${n.hasBody ? ' · readable' : ''}</div>
          <div class="row" style="gap:6px;margin-top:6px"><a class="btn btn-sm btn-outline" href="#/news/${n.id}" style="width:auto">Open</a><button class="btn btn-sm btn-outline" data-act="${n.hidden ? 'show' : 'hide'}" data-id="${n.id}" style="width:auto">${n.hidden ? 'Restore' : 'Hide'}</button></div></div>
      </div>`).join('')}
    </main>`;
  }, {
    mount(el) {
      el.querySelector('#pull')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.refreshNews(); toast(r.added ? r.added + ' new' : 'Nothing new'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } });
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { await api.adminNewsAct(b.dataset.id, b.dataset.act); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
    }
  });
}
