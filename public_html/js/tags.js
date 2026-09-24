// Buja Tag screens: my tag (with a QR code to show people), anyone's tag card, and finding people by tag.
export function registerTags({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy, avatar } = ui;
  const loadQR = () => window.qrcode ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/js/vendor/qrcode.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const KIND = { person: ['user', 'Person'], company: ['briefcase', 'Business'], artisan: ['wrench', 'Artisan'] };

  /* ---------- My tag ---------- */
  route('/tag', { auth: true, tabs: 'Me' }, async () => {
    const t = await api.myTag();
    return `${topbar('Your Buja Tag', '/me')}<main class="pad stack" style="gap:14px">
      <div class="card stack" style="padding:20px;gap:12px;align-items:center;text-align:center">
        <div class="tagbig"><span>@</span>${h(t.tag)}</div>
        <div class="small muted" style="max-width:280px;line-height:1.5">Anyone can find you on Buja with this: to race you in Buja Kart, hire you, see your business, or say hi.</div>
        <div id="qr" style="padding:12px;background:#fff;border-radius:16px"></div>
        <div class="row" style="gap:8px;width:100%"><button class="btn btn-primary grow" id="share">${icon('paper-plane')} Share my tag</button><button class="btn btn-outline" id="copy" style="width:auto">Copy</button></div></div>
      <div class="card stack" style="padding:14px;gap:10px"><div class="h-sm">Change your tag</div>
        <div class="row" style="gap:6px"><span style="font-size:20px;font-weight:800;align-self:center;color:var(--orange)">@</span><input class="input" id="newtag" maxlength="20" autocapitalize="off" autocomplete="off" value="${h(t.tag)}" style="flex:1"></div>
        <div class="small" id="check" style="min-height:18px"></div>
        <button class="btn btn-ink" id="save" disabled>Save</button>
        <div class="small muted">3 to 20 letters, numbers or _. You can change it 3 times a month, so people can still find you.</div></div>
      <a class="card row" href="#/find" style="padding:14px;gap:12px"><span class="mi" style="width:40px;height:40px;border-radius:20px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center">${icon('magnifying-glass')}</span><span class="grow"><b>Find someone by their tag</b><br><span class="small muted">Friends, businesses, mechanics</span></span>${icon('chevron-right')}</a>
    </main>`;
  }, {
    async mount(el) {
      const t = await api.myTag();
      try { await loadQR(); const q = window.qrcode(0, 'M'); q.addData(t.link); q.make(); el.querySelector('#qr').innerHTML = q.createImgTag(6, 0); } catch {}
      el.querySelector('#share').addEventListener('click', async () => { const text = `Find me on Buja: @${t.tag} ${t.link}`; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast(text, 5000); } } });
      el.querySelector('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText('@' + t.tag); toast('Copied @' + t.tag); } catch { toast('@' + t.tag); } });
      const inp = el.querySelector('#newtag'), chk = el.querySelector('#check'), save = el.querySelector('#save'); let timer;
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20); save.disabled = true; clearTimeout(timer); const v = inp.value.toLowerCase();
        if (v === t.tag) { chk.textContent = ''; return; } chk.textContent = 'Checking…'; chk.style.color = 'var(--muted)';
        timer = setTimeout(async () => { const r = await api.myTag(v).catch(() => null); if (!r || inp.value.toLowerCase() !== v) return; if (r.try.problem) { chk.textContent = r.try.problem; chk.style.color = '#D92D20'; } else { chk.textContent = '@' + v + ' is free'; chk.style.color = 'var(--green-dark)'; save.disabled = false; } }, 350); });
      save.addEventListener('click', async () => { busy(save, true); try { const r = await api.setTag(inp.value); toast('You are now @' + r.tag); location.reload(); } catch (err) { busy(save, false); failed(el, err); } });
    }
  });

  /* ---------- Find by tag ---------- */
  route('/find', { auth: true, tabs: '' }, async () => `${topbar('Find on Buja', '/home')}<main class="pad stack" style="gap:12px">
      <div class="card row" style="height:52px;padding:0 14px;gap:8px"><span style="font-size:22px;font-weight:900;color:var(--orange)">@</span><input id="q" type="search" autocapitalize="off" autocomplete="off" placeholder="Their Buja Tag" style="flex:1;border:none;background:transparent;outline:none;font-size:17px;color:var(--ink)" autofocus></div>
      <div id="res" class="stack" style="gap:8px"><div class="small muted" style="line-height:1.5">Type a tag to find a friend to race, a business, a mechanic or anyone else on Buja. Tags look like @kemi or @jabimotors.</div></div>
    </main>`, {
    mount(el) {
      const res = el.querySelector('#res'); let timer;
      const card = (c) => `<a class="card row" href="#/t/${h(c.tag)}" style="padding:12px 14px;gap:12px">${c.avatar ? `<img src="${h(c.avatar)}" alt="" style="width:44px;height:44px;border-radius:22px;object-fit:cover">` : avatar(c.name, 44)}<span class="grow" style="min-width:0"><span style="display:block;font-weight:700">${h(c.name)}${c.verified ? ' ' + icon('circle-check') : ''}</span><span class="small muted">@${h(c.tag)} · ${h(c.artisan ? c.artisan.tradeLabel : KIND[c.kind][1])}${c.district ? ' · ' + h(c.district) : ''}</span></span>${icon('chevron-right')}</a>`;
      el.querySelector('#q').addEventListener('input', (e) => { clearTimeout(timer); const q = e.target.value.replace(/^@/, '').trim(); timer = setTimeout(async () => {
        if (q.length < 2) { res.innerHTML = '<div class="small muted">Keep typing…</div>'; return; }
        const { cards } = await api.tagSearch(q).catch(() => ({ cards: [] }));
        res.innerHTML = cards.length ? cards.map(card).join('') : `<div class="small muted">Nobody's tag starts with @${h(q)}. Check the spelling with them.</div>`; }, 250); });
      const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('q'); if (pre) { el.querySelector('#q').value = pre; el.querySelector('#q').dispatchEvent(new Event('input')); }
    }
  });

  /* ---------- Anyone's tag ---------- */
  route('/t/:tag', { auth: true, tabs: '' }, async ({ tag }) => {
    let d; try { d = await api.tagFind(tag); } catch (err) {
      const s = (err && err.suggestions) || [];
      return `${topbar('', '/find')}<div class="placeholder" style="padding:50px 20px"><div class="mi card">${icon('magnifying-glass')}</div><div class="h-md">${h((err && err.message) || 'Not found')}</div>${s.length ? `<div class="small muted">Did you mean</div><div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center">${s.map((c) => `<a class="chip" href="#/t/${h(c.tag)}">@${h(c.tag)}</a>`).join('')}</div>` : ''}<a class="btn btn-ink" href="#/find" style="width:auto">Search again</a></div>`;
    }
    const c = d.card;
    const actions = [];
    if (c.artisan) actions.push(`<a class="btn btn-primary" href="#/artisans/${c.id}">${icon('wrench')} ${c.artisan.available ? 'Ask them to come' : 'See their profile'}</a>`);
    if (c.company) actions.push(`<a class="btn btn-primary" href="#/work?q=${encodeURIComponent(c.companyName || c.name)}">${icon('briefcase')} See their ${c.company.openJobs} open job${c.company.openJobs === 1 ? '' : 's'}</a>`);
    if (!c.self) actions.push(`<button class="btn btn-outline" id="race">🏁 Race them in Buja Kart</button>`);
    if (c.match) actions.push(`<a class="btn btn-outline" href="#/match/profile/${c.id}">${icon('heart')} See them on Match</a>`);
    if (c.kind === 'person' && !c.self) actions.push(`<a class="btn btn-ghost" href="#/people/${c.id}">Profile and ratings</a>`);
    if (c.self) actions.push(`<a class="btn btn-outline" href="#/tag">This is you. Share or change your tag</a>`);
    return `${topbar('', '/find', `<button class="iconbtn" id="share" aria-label="Share">${icon('paper-plane')}</button>`)}<main class="pad stack" style="gap:14px">
      <div class="card stack" style="padding:20px;gap:10px;align-items:center;text-align:center">
        ${c.avatar ? `<img src="${h(c.avatar)}" alt="" style="width:88px;height:88px;border-radius:44px;object-fit:cover">` : avatar(c.name, 88)}
        <div><div style="font-size:21px;font-weight:800">${h(c.name)}${c.verified ? ' <span style="color:var(--green-dark)">' + icon('circle-check') + '</span>' : ''}</div><div class="tagbig" style="font-size:18px"><span>@</span>${h(c.tag)}</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center"><span class="tag">${icon(KIND[c.kind][0])} ${h(c.artisan ? c.artisan.tradeLabel : KIND[c.kind][1])}</span>${c.district ? `<span class="tag">${icon('location-dot')} ${h(c.district)}</span>` : ''}${c.artisan && c.artisan.rating && c.artisan.rating.count ? `<span class="tag">★ ${Number(c.artisan.rating.stars).toFixed(1)}</span>` : ''}${c.kart ? `<span class="tag">🏁 ${Math.floor(c.kart.bestLapMs / 60000)}:${((c.kart.bestLapMs % 60000) / 1000).toFixed(2).padStart(5, '0')}</span>` : ''}</div></div>
      <div class="stack" style="gap:8px">${actions.join('')}</div>
    </main>`;
  }, {
    mount(el, { tag }) {
      el.querySelector('#share')?.addEventListener('click', async () => { const t = `@${tag} on Buja: ${location.origin}/#/@${tag}`; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch {} } });
      el.querySelector('#race')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { const r = await api.kartNewRoom({ track: 'abuja' }); await api.kartInvite(r.code, tag); toast('Challenge sent'); go('/kart/room/' + r.code); } catch (err) { busy(b, false); failed(el, err); } });
    }
  });
}
