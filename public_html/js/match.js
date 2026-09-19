// Buja Match: profile setup, discovery, matches, likes. Registered into the app router by app.js.
export function registerMatch({ route, go, state, api, ui, DISTRICTS, failed }) {
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon } = ui;
  const tag = (t, cls = '') => `<span class="tag ${cls}" style="${cls ? '' : 'background:var(--surface);color:var(--ink-2)'}">${t}</span>`;
  const prox = (p) => p === 'same' ? 'Same district' : p === 'nearby' ? 'Nearby' : 'Abuja';
  const ph = (url, extra = '') => url ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;${extra}">` : `<div style="width:100%;height:100%;background:linear-gradient(180deg,#5E4A3A,#2B211B);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:12px;font-weight:600;letter-spacing:1px">NO PHOTO</div>`;
  const guardCompany = () => state.user.kind === 'company' ? `${topbar('Match', '/home')}<div class="placeholder"><div class="mi card">${icon('heart')}</div><div class="h-md">Match is for resident accounts</div><div class="small muted" style="max-width:280px">Hiring accounts cannot use Match. Sign in with a resident account.</div></div>` : null;

  /* Compress on the phone: longest side 1200px, JPEG 0.82. Keeps uploads around 150 to 300 KB. */
  async function compress(file) {
    const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file;
    const max = 1200; const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  }
  async function uploadPhoto(input, el) {
    const f = input.files[0]; if (!f) return null;
    try { const small = await compress(f); const r = await api.addPhoto(small); toast('Photo added'); return r.photos; }
    catch (err) { failed(el, err); return null; }
  }

  /* ---------- Entry: decides between setup and discovery ---------- */
  route('/match', { auth: true, tabs: '' }, async () => {
    const g = guardCompany(); if (g) return g;
    const { profile } = await api.matchMe();
    if (!profile || !profile.photos.length) { go('/match/setup'); return ''; }
    go('/match/discover'); return '';
  });

  /* ---------- Setup wizard ---------- */
  route('/match/setup', { auth: true, tabs: '' }, async () => {
    const g = guardCompany(); if (g) return g;
    const { profile: p, options } = await api.matchMe();
    const step = new URLSearchParams(location.hash.split('?')[1] || '').get('step') || (p ? (p.photos.length ? '3' : '2') : '1');
    const dots = `<div class="row" style="gap:6px;justify-content:center;padding:6px 0 2px">${[1, 2, 3, 4].map((i) => `<span style="width:${+step === i ? 22 : 8}px;height:8px;border-radius:4px;background:${+step >= i ? 'var(--orange)' : 'var(--line)'}"></span>`).join('')}</div>`;
    if (step === '1') return `${topbar('About you', '/home')}${dots}
      <form id="f" class="pad stack" style="gap:14px;padding-top:8px" novalidate>
        <div class="muted small">Buja Match is for adults living in Abuja. Your exact birthday is private; people see your age.</div>
        <div class="field"><label for="birthdate">Date of birth</label><input class="input" id="birthdate" type="date" value="${p?.birthdate || ''}" max="${new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}"><div class="error" data-error="birthdate"></div></div>
        <div class="field"><label>I am a</label><div class="seg" id="gender">${[['woman', 'Woman'], ['man', 'Man']].map(([k, v]) => `<button type="button" data-v="${k}" class="${p?.gender === k ? 'on' : ''}">${v}</button>`).join('')}</div><div class="error" data-error="gender"></div></div>
        <div class="field"><label>I want to meet</label><div class="seg" id="seeking">${[['women', 'Women'], ['men', 'Men'], ['everyone', 'Everyone']].map(([k, v]) => `<button type="button" data-v="${k}" class="${p?.seeking === k ? 'on' : ''}">${v}</button>`).join('')}</div><div class="error" data-error="seeking"></div></div>
        <div class="field"><label for="district">Your district</label><select class="input" id="district">${DISTRICTS.map((d) => `<option ${state.user.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="hint">People see your district, never your street.</div></div>
        <button class="btn btn-primary" type="submit">Continue</button>
      </form>`;
    if (step === '2') return `${topbar('Your photos', '/match/setup?step=1')}${dots}
      <div class="pad stack" style="gap:14px;padding-top:8px">
        <div class="muted small">At least one clear photo of your face. Up to six. Photos are resized on your phone before upload.</div>
        <div id="grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${photoGrid(p?.photos || [])}</div>
        <div class="error" data-error="photo"></div>
        <a class="btn btn-primary" href="#/match/setup?step=3" id="next" style="${(p?.photos || []).length ? '' : 'opacity:.55;pointer-events:none'}">Continue</a>
      </div>`;
    if (step === '3') return `${topbar('A bit more', '/match/setup?step=2')}${dots}
      <form id="f" class="pad stack" style="gap:16px;padding-top:8px" novalidate>
        <div class="field"><label for="bio">About you</label><textarea class="input" id="bio" maxlength="300" placeholder="Two lines that sound like you" style="height:80px;padding:12px 14px;resize:none">${h(p?.bio || '')}</textarea></div>
        <div class="field"><label>Interests (up to 8)</label><div class="row" style="flex-wrap:wrap;gap:8px" id="interests">${options.interests.map((i) => `<button type="button" class="chip ${(p?.interests || []).includes(i) ? 'on' : ''}" data-i="${h(i)}">${h(i)}</button>`).join('')}</div><div class="error" data-error="interests"></div></div>
        <div class="field"><label>Prompts (answer up to 3)</label><div class="stack" style="gap:10px" id="prompts">${options.prompts.map((q) => { const a = (p?.prompts || []).find((x) => x.q === q)?.a || ''; return `<div class="card" style="padding:12px 14px"><div class="small" style="font-weight:600;color:var(--ink-2);margin-bottom:6px">${h(q)}</div><input class="input" data-q="${h(q)}" value="${h(a)}" maxlength="160" placeholder="Your answer" style="height:44px"></div>`; }).join('')}</div></div>
        <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="faith">Faith</label><select class="input" id="faith">${options.faith.map((v) => `<option value="${h(v)}" ${(p?.faith || '') === v ? 'selected' : ''}>${v || 'Prefer not to say'}</option>`).join('')}</select></div><div class="field" style="flex:1"><label for="kids">Kids</label><select class="input" id="kids">${options.kids.map((v) => `<option value="${h(v)}" ${(p?.kids || '') === v ? 'selected' : ''}>${v || 'Skip'}</option>`).join('')}</select></div></div>
        <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="drinking">Drinking</label><select class="input" id="drinking">${options.habit.map((v) => `<option value="${h(v)}" ${(p?.drinking || '') === v ? 'selected' : ''}>${v || 'Skip'}</option>`).join('')}</select></div><div class="field" style="flex:1"><label for="smoking">Smoking</label><select class="input" id="smoking">${options.habit.map((v) => `<option value="${h(v)}" ${(p?.smoking || '') === v ? 'selected' : ''}>${v || 'Skip'}</option>`).join('')}</select></div></div>
        <div class="row" style="gap:10px">${field({ id: 'work', label: 'Work', placeholder: 'Product designer', value: p?.work || '' })}${field({ id: 'height', label: 'Height (cm)', type: 'number', placeholder: '168', value: p?.height || '' })}</div>
        <div class="row" style="gap:10px">${field({ id: 'education', label: 'School', placeholder: 'UNILAG', value: p?.education || '' })}${field({ id: 'languages', label: 'Languages', placeholder: 'Igbo, English', value: p?.languages || '' })}</div>
        <button class="btn btn-primary" type="submit">Continue</button>
      </form>`;
    return `${topbar('Who you see', '/match/setup?step=3')}${dots}
      <form id="f" class="pad stack" style="gap:16px;padding-top:8px" novalidate>
        <div class="card stack" style="padding:16px;gap:12px">
          <div class="h-sm">Age range</div>
          <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="ageMin">From</label><input class="input" id="ageMin" type="number" min="18" max="80" value="${p?.ageMin || 21}"></div><div class="field" style="flex:1"><label for="ageMax">To</label><input class="input" id="ageMax" type="number" min="18" max="90" value="${p?.ageMax || 40}"></div></div>
        </div>
        <div class="card stack" style="padding:16px;gap:12px">
          <div class="h-sm">Distance</div>
          <div class="seg" id="nearby"><button type="button" data-v="0" class="${p?.nearbyOnly ? '' : 'on'}">All of Abuja</button><button type="button" data-v="1" class="${p?.nearbyOnly ? 'on' : ''}">My district and nearby</button></div>
          <div class="small muted">Nearby means the districts that touch yours, for example Wuse 2 reaches Jabi, Utako and Maitama.</div>
        </div>
        <div class="card row" style="padding:14px 16px"><div class="grow"><div style="font-size:15px;font-weight:600">Show my profile</div><div class="small muted">Turn off to pause without deleting anything</div></div><button type="button" class="switch ${p?.visible === false ? '' : 'on'}" id="visible" role="switch" aria-checked="${p?.visible !== false}" aria-label="Show my profile"><span></span></button></div>
        <button class="btn btn-primary" type="submit">${icon('heart')} Start matching</button>
      </form>`;
  }, {
    mount(el) {
      clearOnInput(el);
      const step = new URLSearchParams(location.hash.split('?')[1] || '').get('step') || '1';
      el.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); })));
      const segVal = (id) => el.querySelector('#' + id + ' button.on')?.dataset.v || '';
      el.querySelector('#interests')?.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; if (!b.classList.contains('on') && el.querySelectorAll('#interests .chip.on').length >= 8) { toast('Up to 8 interests'); return; } b.classList.toggle('on'); });
      const sw = el.querySelector('#visible'); sw?.addEventListener('click', () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on); });
      bindPhotoGrid(el, () => { const n = el.querySelector('#next'); if (n) { n.style.opacity = ''; n.style.pointerEvents = ''; } });
      el.querySelector('#f')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        let body = {};
        if (step === '1') { body = { birthdate: el.querySelector('#birthdate').value, gender: segVal('gender'), seeking: segVal('seeking') }; try { if (el.querySelector('#district').value !== state.user.district) { const r = await api.updateMe({ district: el.querySelector('#district').value }); state.user = r.user; } } catch (err) { busy(btn, false); failed(el, err); return; } }
        if (step === '3') body = { bio: el.querySelector('#bio').value, interests: [...el.querySelectorAll('#interests .chip.on')].map((b) => b.dataset.i), prompts: [...el.querySelectorAll('#prompts input')].map((i) => ({ q: i.dataset.q, a: i.value })).filter((x) => x.a.trim()), faith: el.querySelector('#faith').value, kids: el.querySelector('#kids').value, drinking: el.querySelector('#drinking').value, smoking: el.querySelector('#smoking').value, work: el.querySelector('#work').value, height: +el.querySelector('#height').value || 0, education: el.querySelector('#education').value, languages: el.querySelector('#languages').value };
        if (step === '4') body = { ageMin: +el.querySelector('#ageMin').value, ageMax: +el.querySelector('#ageMax').value, nearbyOnly: segVal('nearby') === '1', visible: sw.classList.contains('on') };
        try { await api.matchUpdate(body); if (step === '4') { toast('You are on Match'); go('/match/discover'); } else go('/match/setup?step=' + (+step + 1)); }
        catch (err) { busy(btn, false); failed(el, err); }
      });
    }
  });

  function photoGrid(photos) {
    const cells = photos.map((p, i) => `<div style="position:relative;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:var(--card)" data-photo="${p.id}">${ph(p.url)}${i === 0 ? '<span class="tag green" style="position:absolute;top:6px;left:6px">MAIN</span>' : ''}<button type="button" class="iconbtn" data-del="${p.id}" aria-label="Remove" style="position:absolute;top:6px;right:6px;width:32px;height:32px;background:rgba(0,0,0,.55);border:none;color:#fff">${icon('xmark')}</button></div>`);
    while (cells.length < 6) cells.push(`<label style="aspect-ratio:3/4;border-radius:14px;border:2px dashed var(--line);background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:11px;font-weight:600;color:var(--ink-3);cursor:pointer">${icon(cells.length === 0 ? 'camera' : 'plus')}${cells.length === 0 ? 'Add' : ''}<input type="file" accept="image/*" data-add style="display:none"></label>`);
    return cells.join('');
  }
  function bindPhotoGrid(el, onChange) {
    const grid = el.querySelector('#grid'); if (!grid) return;
    grid.addEventListener('change', async (e) => { const i = e.target.closest('[data-add]'); if (!i) return; const photos = await uploadPhoto(i, el); if (photos) { grid.innerHTML = photoGrid(photos); onChange?.(photos); } });
    grid.addEventListener('click', async (e) => { const b = e.target.closest('[data-del]'); if (!b) return; if (!confirm('Remove this photo?')) return; try { const r = await api.deletePhoto(b.dataset.del); grid.innerHTML = photoGrid(r.photos); onChange?.(r.photos); } catch (err) { failed(el, err); } });
  }

  /* ---------- Discovery ---------- */
  function card(c) {
    return `<div class="card" data-card="${c.id}" style="position:relative;flex:1;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;min-height:420px">
      <div style="position:absolute;inset:0">${ph(c.photos[0]?.url)}</div>
      <div style="position:absolute;top:16px;left:16px;display:flex;gap:8px"><span class="tag" style="background:var(--green);color:#101014">${c.match.score}% match</span><span class="tag" style="background:rgba(0,0,0,.45);color:#fff">${prox(c.match.proximity)}</span></div>
      <a href="#/match/profile/${c.id}" aria-label="Open profile" style="position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:20px;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff">${icon('circle-info')}</a>
      <div style="position:relative;padding:60px 20px 20px;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.78) 100%);color:#fff;display:flex;flex-direction:column;gap:6px">
        <div class="row" style="gap:8px"><span style="font-size:26px;font-weight:700">${h(c.name)}, ${c.age}</span>${c.phoneVerified ? icon('circle-check') : ''}</div>
        <div style="font-size:14px;color:#D0D0D6" class="row">${icon('location-dot')} ${h(c.district)}${c.work ? ' · ' + h(c.work) : ''}</div>
        ${c.bio ? `<div style="font-size:14px;color:#D0D0D6;line-height:1.4">${h(c.bio)}</div>` : ''}
        ${c.interests.length ? `<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:4px">${c.interests.map((i) => `<span class="tag" style="background:rgba(255,255,255,${c.match.shared.includes(i) ? '.32' : '.15'});color:#fff">${c.match.shared.includes(i) ? icon('circle-check') + ' ' : ''}${h(i)}</span>`).join('')}</div>` : ''}
      </div></div>`;
  }
  route('/match/discover', { auth: true, tabs: '' }, async () => {
    const g = guardCompany(); if (g) return g;
    return `
    <header class="topbar"><a class="iconbtn" href="#/home" aria-label="Home">${icon('arrow-left')}</a><h1>Match</h1>
      <a class="iconbtn" href="#/match/likes" aria-label="Who liked you">${icon('regular/heart')}</a><a class="iconbtn" href="#/match/matches" aria-label="Matches">${icon('message')}</a><a class="iconbtn" href="#/match/edit" aria-label="My profile">${icon('user')}</a></header>
    <main class="stack" style="padding:0 16px;gap:14px;flex:1">
      <div id="stack" style="flex:1;display:flex;flex-direction:column"><div class="card" style="flex:1;border-radius:24px;min-height:420px"></div></div>
      <div id="actions" class="row" style="justify-content:center;gap:18px;padding-bottom:6px;display:none">
        <button class="iconbtn" data-act="pass" aria-label="Pass" style="width:64px;height:64px;font-size:24px">${icon('xmark')}</button>
        <button class="iconbtn" data-act="superlike" aria-label="Super like" style="width:48px;height:48px;color:#1F4E9C">${icon('star')}</button>
        <button class="iconbtn" data-act="like" aria-label="Like" style="width:64px;height:64px;background:var(--orange);border-color:var(--orange);color:#fff;font-size:26px">${icon('heart')}</button>
      </div>
      <div class="small muted center" id="superleft"></div>
    </main>
    <div id="matchoverlay"></div>`;
  }, {
    mount(el) {
      let cards = []; let left = 0;
      const stack = el.querySelector('#stack');
      const load = async () => { try { const r = await api.discover(); cards = r.cards; left = r.superlikesLeft; show(); } catch (err) { if (err.error === 'no_profile' || err.error === 'no_photo') { go('/match/setup'); return; } failed(el, err); } };
      const show = () => { if (!cards.length) { stack.innerHTML = empty(); el.querySelector('#actions').style.display = 'none'; return; } stack.innerHTML = card(cards[0]); el.querySelector('#actions').style.display = ''; el.querySelector('#superleft').textContent = left ? '1 super like left today' : 'Super like used for today'; };
      load();
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        const c = cards[0]; if (!c) return; const act = b.dataset.act;
        const node = stack.querySelector('[data-card]'); if (node) { node.style.transition = 'transform .25s ease, opacity .25s'; node.style.transform = act === 'pass' ? 'translateX(-120%) rotate(-8deg)' : 'translateX(120%) rotate(8deg)'; node.style.opacity = '0'; }
        cards.shift();
        try { const r = await api.swipe(c.id, act); left = r.superlikesLeft; if (r.matched && r.matched.name) showMatch(el, c, r.matched); if (cards.length < 3) await load(); else show(); }
        catch (err) { failed(el, err); show(); }
      }));
    }
  });
  const empty = () => `<div class="placeholder card" style="flex:1;border-radius:24px"><div class="mi" style="background:var(--orange-tint);color:var(--orange-dark)">${icon('heart')}</div><div class="h-md">That's everyone for now</div><div class="small muted" style="max-width:260px;line-height:1.5">Widen your age range or switch to all of Abuja in your profile, and check back as more people join.</div><a class="btn btn-outline" href="#/match/edit" style="width:auto">Adjust who I see</a></div>`;
  function showMatch(el, c, m) {
    el.querySelector('#matchoverlay').innerHTML = `<div style="position:fixed;inset:0;background:var(--night);color:#fff;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center">
      <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#7ED957,#FF7A1A)"></div>
      <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:#7ED957">IT'S A MATCH</div>
      <div style="font-size:28px;font-weight:700;line-height:1.2">You and ${h(m.name)} like each other</div>
      <div class="row" style="margin:8px 0">${avatar(state.user.name, 120, '#2E7D1E').replace('class="avatar"', 'class="avatar" style="width:120px;height:120px;font-size:40px;border:4px solid #7ED957;background:#2E7D1E"')}<div style="width:48px;height:48px;border-radius:24px;background:var(--orange);display:flex;align-items:center;justify-content:center;margin:0 -16px;z-index:1;border:4px solid var(--night)">${icon('heart')}</div><div style="width:120px;height:120px;border-radius:60px;overflow:hidden;border:4px solid var(--orange)">${ph(m.photo)}</div></div>
      <div style="font-size:14px;color:#B5B5BC">${m.score}% match on interests, faith and where you both are.</div>
      <a class="btn btn-primary" href="#/inbox/${m.threadId}">${icon('paper-plane')} Send a message</a>
      <button class="btn btn-ghost" id="keep" style="color:#B5B5BC">Keep swiping</button></div>`;
    el.querySelector('#keep').addEventListener('click', () => { el.querySelector('#matchoverlay').innerHTML = ''; });
  }

  /* ---------- Full profile ---------- */
  route('/match/profile/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const { profile: p } = await api.matchProfile(id);
    const facts = [p.work && ['briefcase', p.work], p.education && ['building', p.education], p.height && ['user', p.height + ' cm'], p.faith && ['circle-check', p.faith], p.drinking && ['circle-info', 'Drinks: ' + p.drinking.toLowerCase()], p.smoking && ['circle-info', 'Smokes: ' + p.smoking.toLowerCase()], p.kids && ['heart', p.kids], p.languages && ['message', p.languages]].filter(Boolean);
    return `
    <div style="position:relative;height:440px;background:#2B211B" id="gallery">
      ${p.photos.map((x, i) => `<div data-slide="${i}" style="position:absolute;inset:0;${i ? 'display:none' : ''}">${ph(x.url)}</div>`).join('') || ph(null)}
      <a class="iconbtn" href="#/match/discover" aria-label="Back" style="position:absolute;top:14px;left:16px;background:rgba(0,0,0,.4);border:none;color:#fff">${icon('arrow-left')}</a>
      <button class="iconbtn" id="more" aria-label="Report or block" style="position:absolute;top:14px;right:16px;background:rgba(0,0,0,.4);border:none;color:#fff">${icon('ellipsis')}</button>
      ${p.photos.length > 1 ? `<div style="position:absolute;bottom:12px;left:16px;right:16px;display:flex;gap:4px">${p.photos.map((x, i) => `<span data-dot="${i}" style="flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,${i ? .4 : 1})"></span>`).join('')}</div>` : ''}
      <span class="tag" style="position:absolute;bottom:28px;left:16px;background:var(--green);color:#101014">${p.match.score}% match</span>
    </div>
    <main class="pad stack" style="gap:14px;padding-top:18px">
      <div><div class="row" style="gap:8px"><span class="h-lg" style="font-size:26px">${h(p.name)}, ${p.age}</span>${p.phoneVerified ? `${icon('circle-check')}<span class="small" style="font-weight:700;color:var(--green-dark)">PHONE VERIFIED</span>` : ''}</div><div class="muted small row" style="gap:6px;margin-top:4px">${icon('location-dot')} ${h(p.district)} · ${prox(p.match.proximity)}${p.likedYou ? ' · <strong style="color:var(--orange-dark)">Liked you</strong>' : ''}</div></div>
      ${p.bio ? `<p style="margin:0;font-size:15px;line-height:1.5">${h(p.bio)}</p>` : ''}
      ${facts.length ? `<div class="row" style="flex-wrap:wrap;gap:8px">${facts.map(([ic, t]) => `<span class="tag" style="background:var(--card);border:1px solid var(--line);color:var(--ink-2)">${icon(ic)} ${h(t)}</span>`).join('')}</div>` : ''}
      ${p.interests.length ? `<div class="row" style="flex-wrap:wrap;gap:8px">${p.interests.map((i) => tag((p.match.shared.includes(i) ? icon('circle-check') + ' ' : '') + h(i), p.match.shared.includes(i) ? 'green' : '')).join('')}</div>` : ''}
      ${p.prompts.map((x) => `<div class="card" style="padding:16px"><div class="small muted" style="font-weight:600;margin-bottom:6px">${h(x.q)}</div><div style="font-size:17px;font-weight:600;line-height:1.4">${h(x.a)}</div></div>`).join('')}
      <div id="menu"></div>
    </main>
    <div class="row" style="justify-content:center;gap:18px;padding:12px 20px 18px;background:var(--card);border-top:1px solid var(--line);position:sticky;bottom:0">
      ${p.threadId ? `<a class="btn btn-primary" href="#/inbox/${p.threadId}">${icon('message')} Message ${h(p.name)}</a>` : p.yourAction ? `<div class="small muted">You ${p.yourAction === 'pass' ? 'passed on' : 'liked'} ${h(p.name)}</div>` : `
      <button class="iconbtn" data-act="pass" aria-label="Pass" style="width:60px;height:60px;font-size:22px">${icon('xmark')}</button>
      <button class="iconbtn" data-act="superlike" aria-label="Super like" style="width:60px;height:60px;color:#1F4E9C">${icon('star')}</button>
      <button class="iconbtn" data-act="like" aria-label="Like" style="width:60px;height:60px;background:var(--orange);border-color:var(--orange);color:#fff;font-size:24px">${icon('heart')}</button>`}
    </div>
    <div id="matchoverlay"></div>`;
  }, {
    mount(el, { id }) {
      const slides = el.querySelectorAll('[data-slide]'); let i = 0;
      el.querySelector('#gallery').addEventListener('click', (e) => { if (e.target.closest('a,button') || slides.length < 2) return; i = (i + (e.clientX > innerWidth / 2 ? 1 : slides.length - 1)) % slides.length; slides.forEach((s, k) => { s.style.display = k === i ? '' : 'none'; }); el.querySelectorAll('[data-dot]').forEach((d, k) => { d.style.background = `rgba(255,255,255,${k === i ? 1 : .4})`; }); });
      el.querySelector('#more').addEventListener('click', () => { el.querySelector('#menu').innerHTML = `<div class="card list"><button class="item" data-block><div class="mi">${icon('eye-slash')}</div><div class="grow"><div class="t">Block</div><div class="s">They will not see you and you will not see them</div></div></button><button class="item" data-report><div class="mi">${icon('triangle-exclamation')}</div><div class="grow"><div class="t">Report</div><div class="s">Fake profile, harassment, scam</div></div></button></div>`;
        el.querySelector('[data-block]').addEventListener('click', async () => { if (!confirm('Block this person?')) return; await api.block(id); toast('Blocked'); go('/match/discover'); });
        el.querySelector('[data-report]').addEventListener('click', async () => { const reason = prompt('What happened? This goes to the Buja team.'); if (!reason?.trim()) return; try { await api.report(id, reason); toast('Reported and blocked. Thank you.'); go('/match/discover'); } catch (err) { failed(el, err); } }); });
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.swipe(id, b.dataset.act); if (r.matched && r.matched.name) { showMatch(el, null, r.matched); } else { toast(b.dataset.act === 'pass' ? 'Passed' : 'Liked'); go('/match/discover'); } } catch (err) { busy(b, false); failed(el, err); } }));
    }
  });

  /* ---------- Matches ---------- */
  route('/match/matches', { auth: true, tabs: '' }, async () => {
    const { matches } = await api.matches();
    return `${topbar('Matches', '/match/discover')}
    <main class="pad stack" style="gap:12px">
      ${matches.length ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${matches.map((m) => `<a class="card" href="#/inbox/${m.threadId}" style="overflow:hidden;position:relative;aspect-ratio:3/4">${ph(m.photo)}<div style="position:absolute;left:0;right:0;bottom:0;padding:30px 12px 12px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.75));color:#fff"><div style="font-size:15px;font-weight:700">${h(m.name)}, ${m.age}</div><div class="small" style="color:#D0D0D6">${h(m.district)}${m.new ? ' · <strong style="color:#7ED957">Say hello</strong>' : ''}</div></div></a>`).join('')}</div>`
      : `<div class="placeholder" style="padding:60px 0"><div class="mi card">${icon('heart')}</div><div class="h-md">No matches yet</div><div class="small muted" style="max-width:260px">When someone you like likes you back, they appear here and in your Inbox.</div></div>`}
    </main>`;
  });

  /* ---------- Likes you ---------- */
  route('/match/likes', { auth: true, tabs: '' }, async () => {
    const { likes, total } = await api.likes();
    return `${topbar('Liked you', '/match/discover')}
    <main class="pad stack" style="gap:14px">
      <div class="small muted">${total ? `<strong style="color:var(--ink)">${total} ${total === 1 ? 'person' : 'people'}</strong> liked you. The newest is shown in full; super likes are always shown.` : 'Nobody yet. Likes show up here as they come in.'}</div>
      ${likes.length ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${likes.map((l) => l.locked ? `<div class="card" style="aspect-ratio:3/4;overflow:hidden;position:relative;background:linear-gradient(180deg,#3E5C76,#1C1C22)"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);font-size:24px">${icon('eye-slash')}</div></div>` : `<a class="card" href="#/match/profile/${l.id}" style="aspect-ratio:3/4;overflow:hidden;position:relative">${ph(l.photo)}${l.superlike ? `<span class="tag" style="position:absolute;top:8px;left:8px;background:#1F4E9C;color:#fff">${icon('star')} Super like</span>` : ''}<div style="position:absolute;left:0;right:0;bottom:0;padding:30px 12px 12px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.75));color:#fff"><div style="font-size:15px;font-weight:700">${h(l.name)}, ${l.age}</div><div class="small" style="color:#D0D0D6">${h(l.district)}</div></div></a>`).join('')}</div>` : ''}
      ${likes.some((l) => l.locked) ? `<div class="card dark stack" style="padding:18px;gap:10px"><div class="row" style="gap:10px"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#7ED957">BUJA PLUS</span><span class="small" style="color:#B5B5BC">coming soon</span></div><div style="font-size:14px;line-height:1.5">See everyone who liked you, unlimited likes, five super likes a day and a weekly boost.</div></div>` : ''}
    </main>`;
  });

  /* ---------- Edit ---------- */
  route('/match/edit', { auth: true, tabs: 'Me' }, async () => {
    const { profile: p } = await api.matchMe(); if (!p) { go('/match/setup'); return ''; }
    const done = [p.photos.length, p.bio, p.interests.length, p.prompts.length, p.faith || p.kids || p.work].filter(Boolean).length; const pct = Math.round(done / 5 * 100);
    return `${topbar('My Match profile', '/match/discover', `<a class="iconbtn" href="#/match/profile/${p.id}" aria-label="Preview">${icon('eye')}</a>`)}
    <main class="pad stack" style="gap:16px">
      <div class="card row" style="padding:14px 16px"><div style="width:52px;height:52px;border-radius:26px;background:conic-gradient(var(--green) 0 ${pct}%,var(--line) ${pct}% 100%);display:flex;align-items:center;justify-content:center"><div style="width:42px;height:42px;border-radius:21px;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${pct}%</div></div><div class="grow"><div class="h-sm">Profile ${pct}% complete</div><div class="small muted">${pct < 100 ? 'Photos, bio, interests, prompts and basics all count.' : 'Looking good.'}</div></div></div>
      <div class="stack" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="section">PHOTOS</span><span class="small muted">${p.photos.length} of 6</span></div><div id="grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${photoGrid(p.photos)}</div><div class="error" data-error="photo"></div></div>
      <div class="card list">
        <a class="item" href="#/match/setup?step=1"><div class="mi">${icon('user')}</div><div class="grow"><div class="t">Basics</div><div class="s">${p.age} · ${p.gender === 'woman' ? 'Woman' : 'Man'} · wants to meet ${p.seeking} · ${h(p.district)}</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/match/setup?step=3"><div class="mi">${icon('camera')}</div><div class="grow"><div class="t">Bio, interests, prompts</div><div class="s">${p.interests.length} interests · ${p.prompts.length} prompts</div></div>${icon('chevron-right')}</a>
        <a class="item" href="#/match/setup?step=4"><div class="mi">${icon('sliders')}</div><div class="grow"><div class="t">Who you see</div><div class="s">${p.ageMin} to ${p.ageMax} · ${p.nearbyOnly ? 'My district and nearby' : 'All of Abuja'}${p.visible ? '' : ' · <strong>profile hidden</strong>'}</div></div>${icon('chevron-right')}</a>
      </div>
    </main>`;
  }, { mount(el) { bindPhotoGrid(el); } });
}
