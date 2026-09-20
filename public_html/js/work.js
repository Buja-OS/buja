// Buja Work module: seeker and company screens. Registered into the app router by app.js.
import { saveSearchBar, bindSaveSearch } from './alerts.js';

export function registerWork({ route, go, state, setState, api, ui, DISTRICTS, failed }) {
  const shrinkImg = async (f, max = 800) => { const b = await createImageBitmap(f).catch(() => null); if (!b) return f; const s = Math.min(1, max / Math.max(b.width, b.height)); const c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); const bl = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86)); return new File([bl], 'logo.jpg', { type: 'image/jpeg' }); };
  const { h, toast, topbar, field, showErrors, clearOnInput, busy, avatar, icon } = ui;
  const naira = (n) => n == null ? '' : '₦' + Number(n).toLocaleString('en-NG');
  const pay = (j) => j.salaryMin == null ? 'Salary not stated' : j.salaryMax && j.salaryMax !== j.salaryMin ? `${naira(j.salaryMin)} – ${naira(j.salaryMax)}` : naira(j.salaryMin);
  const ago = (iso) => { const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 3600 ? Math.max(1, Math.round(d / 60)) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  const kb = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  const TYPES = { full_time: 'Full time', part_time: 'Part time', contract: 'Contract', internship: 'Internship', remote: 'Remote' };
  const STATUS = { new: ['New', ''], shortlisted: ['Shortlisted', 'orange'], interview: ['Interview', 'green'], rejected: ['Not selected', ''], hired: ['Hired', 'green'] };
  const stag = (s) => { const [t, c] = STATUS[s] || [s, '']; return `<span class="tag ${c}">${t}</span>`; };
  const colors = ['#1F4E9C', '#2E7D1E', '#8E44AD', '#C0392B', '#0E7C86', '#E8620E', '#2C2C33'];
  const color = (s) => colors[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  const isCompany = () => state.user && state.user.kind === 'company';
  const cvAllowed = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  function jobCard(j, link = true) {
    return `<${link ? `a href="#/work/job/${j.id}"` : 'div'} class="card" style="display:flex;flex-direction:column;gap:12px;padding:16px">
      <div class="row">${j.company.logo ? `<img src="${j.company.logo}" alt="" style="width:44px;height:44px;border-radius:12px;object-fit:cover;flex-shrink:0">` : avatar(j.company.name, 44, color(j.company.name))}
        <div class="grow"><div class="h-sm">${h(j.title)}</div><div class="small muted">${h(j.company.name)}${j.company.verified ? ' ' + icon('circle-check') : ''} · ${ago(j.createdAt)}</div></div>
        <button class="iconbtn" data-save="${j.id}" aria-label="${j.saved ? 'Unsave' : 'Save'}" style="width:40px;height:40px;border:none;background:transparent;color:${j.saved ? 'var(--orange)' : 'var(--ink-4)'}">${icon(j.saved ? 'bookmark' : 'regular/bookmark')}</button>
      </div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <span class="tag" style="background:var(--surface);color:var(--ink-2)">${icon('location-dot')} ${h(j.district)}</span>
        <span class="tag" style="background:var(--surface);color:var(--ink-2)">${TYPES[j.type] || j.type}</span>
        <span class="tag green">${pay(j)}</span>
        ${j.applied ? `<span class="tag orange">${icon('circle-check')} Applied</span>` : j.applicants ? `<span class="tag" style="background:var(--surface);color:var(--ink-3)">${j.applicants} applied</span>` : ''}
      </div>
    </${link ? 'a' : 'div'}>`;
  }
  function bindSaves(el) {
    el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      const on = b.getAttribute('aria-label') === 'Unsave';
      try { on ? await api.unsaveJob(b.dataset.save) : await api.saveJob(b.dataset.save); b.setAttribute('aria-label', on ? 'Save' : 'Unsave'); b.style.color = on ? 'var(--ink-4)' : 'var(--orange)'; b.innerHTML = icon(on ? 'regular/bookmark' : 'bookmark'); toast(on ? 'Removed from saved' : 'Saved'); }
      catch (err) { failed(el, err); }
    }));
  }

  /* ---------- Seeker: feed ---------- */
  route('/work', { auth: true, tabs: '' }, async () => {
    if (isCompany()) { go('/work/company'); return ''; }
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const f = { q: q.get('q') || '', district: q.get('district') || '', type: q.get('type') || '' };
    const r = await api.jobs(f);
    const mine = state.user.district;
    const chips = ['', ...(mine ? [mine] : []), ...DISTRICTS.filter((d) => d !== mine).slice(0, 8)];
    return `
    ${topbar('Work', '/home', `<a class="iconbtn" href="#/work/profile" aria-label="My CV and applications">${icon('user')}</a>`)}
    <form id="q" class="pad" style="padding-bottom:0"><div class="card row" style="height:48px;padding:0 16px;gap:10px"><label for="qq" style="position:absolute;left:-9999px">Search jobs</label>${icon('magnifying-glass')}<input id="qq" name="q" type="search" placeholder="Search roles, companies, skills" value="${h(f.q)}" style="flex:1;border:none;background:transparent;font-size:14px;outline:none;color:var(--ink)"></div></form>
    <div class="row" style="gap:8px;padding:12px 16px 4px;overflow-x:auto;scrollbar-width:none">${chips.map((d) => `<a class="chip ${f.district === d ? 'on' : ''}" href="#/work?${new URLSearchParams({ ...f, district: d })}">${d || 'All Abuja'}</a>`).join('')}</div>
    <main class="stack" style="padding:10px 16px 0;gap:12px">
      <div class="row small muted" style="justify-content:space-between"><span>${r.total} open role${r.total === 1 ? '' : 's'}${f.district ? ' in ' + h(f.district) : ''}</span><span>Newest first</span></div>
      ${saveSearchBar({ module: 'work', filters: f, ui: { icon, h } })}
      ${r.jobs.length ? r.jobs.map((j) => jobCard(j)).join('') : `<div class="placeholder" style="padding:40px 0"><div class="mi card">${icon('briefcase')}</div><div class="h-md">No roles match yet</div><div class="small muted">Try another district or clear the search. New vacancies appear here the moment a company posts them.</div></div>`}
    </main>`;
  }, { mount(el) { bindSaves(el); bindSaveSearch(el, { api, ui: { toast } }); el.querySelector('#q')?.addEventListener('submit', (e) => { e.preventDefault(); const q = new URLSearchParams(location.hash.split('?')[1] || ''); q.set('q', e.target.q.value); go('/work?' + q); }); } });

  /* ---------- Seeker: job detail + apply ---------- */
  route('/work/job/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const { job: j } = await api.job(id);
    const closed = j.status !== 'open' || (j.deadline && j.deadline < new Date().toISOString().slice(0, 10));
    const reqs = j.requirements || [];
    const sheet = isCompany() ? '' : j.application ? `
      <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:8px"><div class="row"><div class="grow h-sm">Your application</div>${stag(j.application.status)}</div><div class="small muted">Sent ${ago(j.application.createdAt)} · ${j.application.match}% match on their requirements.</div><div class="row" style="gap:8px;margin-top:6px"><button class="btn btn-outline" style="flex:1" data-thread="${j.application.id}">${icon('message')} Message ${h(j.company.name)}</button><a class="btn btn-ghost" href="#/work/profile" style="flex:1">My applications</a></div></div>`
    : closed ? `<div class="card" style="padding:16px"><div class="h-sm">This vacancy is closed</div><div class="small muted">Applications are no longer accepted.</div></div>`
    : `
      <form id="apply" class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px;border-radius:24px 24px 0 0;border-bottom:0">
        <div class="h-md">Apply with your CV</div>
        ${reqs.length ? `<div class="stack" style="gap:8px"><div class="small" style="font-weight:600;color:var(--ink-2)">Tick what you meet. This is how the company ranks applicants; be honest, they see your CV next to it.</div>${reqs.map((r) => `<label class="opt" style="padding:12px 14px;gap:12px"><input type="checkbox" name="met" value="${r.id}"><div class="grow" style="font-size:14px;font-weight:500">${h(r.label)}</div><span class="tag" style="background:var(--surface);color:var(--ink-3)">${r.weight}</span></label>`).join('')}<div class="small muted" id="matchline">Match: 0%</div></div>` : ''}
        ${j.cv ? `<div class="row card" style="padding:12px 14px">${icon('file-arrow-up')}<div class="grow"><div style="font-size:14px;font-weight:600">${h(j.cv.name)}</div><div class="small muted">${kb(j.cv.size)} · on file</div></div><a href="#/work/profile" class="small" style="font-weight:600;color:var(--orange-dark)">Change</a></div>`
               : `<div class="row card" style="padding:12px 14px;border-color:var(--orange)">${icon('file-arrow-up')}<div class="grow"><div style="font-size:14px;font-weight:600">No CV on file</div><div class="small muted">PDF or Word, up to 2 MB</div></div><label class="btn btn-sm btn-ink" style="cursor:pointer">Add CV<input type="file" id="cvfile" accept="${cvAllowed}" style="display:none"></label></div><div class="error" data-error="cv"></div>`}
        <div class="field"><label for="note">Short note to the employer (optional)</label><textarea class="input" id="note" name="note" maxlength="600" placeholder="Why you fit this role, in two lines" style="height:72px;padding:12px 14px;resize:none"></textarea></div>
        <button class="btn btn-primary" type="submit">${icon('paper-plane')} Submit application</button>
      </form>`;
    return `
    ${topbar('', '/work', `<button class="iconbtn" data-save="${j.id}" aria-label="${j.saved ? 'Unsave' : 'Save'}" style="color:${j.saved ? 'var(--orange)' : 'var(--ink)'}">${icon(j.saved ? 'bookmark' : 'regular/bookmark')}</button>`)}
    <main class="pad stack" style="gap:16px">
      <div class="row" style="gap:14px">${j.company.logo ? `<img src="${j.company.logo}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0">` : avatar(j.company.name, 56, color(j.company.name))}<div><div class="h-lg" style="font-size:22px">${h(j.title)}</div><div class="muted" style="margin-top:2px">${h(j.company.name)}${j.company.verified ? ' ' + icon('circle-check') : ''} · ${h(j.district)}</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
        <div class="card" style="padding:12px"><div class="small muted" style="font-weight:600">PAY</div><div style="font-size:13px;font-weight:700;margin-top:4px">${pay(j)}</div></div>
        <div class="card" style="padding:12px"><div class="small muted" style="font-weight:600">TYPE</div><div style="font-size:14px;font-weight:700;margin-top:4px">${TYPES[j.type] || j.type}</div></div>
        <div class="card" style="padding:12px"><div class="small muted" style="font-weight:600">CLOSES</div><div style="font-size:14px;font-weight:700;margin-top:4px">${j.deadline ? new Date(j.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Open'}</div></div>
      </div>
      <div><div class="h-sm" style="margin-bottom:8px">About the role</div><p style="margin:0;font-size:14px;line-height:1.55;color:var(--ink-2);white-space:pre-line">${h(j.description)}</p></div>
      ${reqs.length ? `<div><div class="h-sm" style="margin-bottom:8px">What they're looking for</div><div class="stack" style="gap:6px">${reqs.map((r) => `<div class="row small" style="gap:10px">${icon('circle-check')}<span class="grow">${h(r.label)}</span><span class="muted">${r.weight}%</span></div>`).join('')}</div></div>` : ''}
      <div class="small muted">${j.applicants} applicant${j.applicants === 1 ? '' : 's'} so far · ${j.openings} opening${j.openings === 1 ? '' : 's'}</div>
    </main>
    <div style="padding:16px 16px 0">${sheet}</div>`;
  }, {
    mount(el, { id }) {
      bindSaves(el);
      el.querySelector('[data-thread]')?.addEventListener('click', async (e) => { busy(e.currentTarget, true); try { const r = await api.openThread(e.currentTarget.dataset.thread); go('/inbox/' + r.threadId); } catch (err) { busy(e.currentTarget, false); failed(el, err); } });
      const f = el.querySelector('#apply'); if (!f) return;
      const boxes = [...f.querySelectorAll('input[name=met]')]; const line = f.querySelector('#matchline');
      const weights = Object.fromEntries(boxes.map((b) => [b.value, +b.closest('label').querySelector('.tag').textContent]));
      const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
      boxes.forEach((b) => b.addEventListener('change', () => { b.closest('label').classList.toggle('on', b.checked); if (line) line.textContent = 'Match: ' + Math.round(boxes.filter((x) => x.checked).reduce((a, x) => a + weights[x.value], 0) * 100 / total) + '%'; }));
      f.querySelector('#cvfile')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 2 * 1048576) { showErrors(el, { cv: 'CV must be 2 MB or smaller.' }); return; }
        try { await api.uploadCv(file); toast('CV added'); location.reload(); } catch (err) { failed(el, err); }
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = f.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        try { const r = await api.apply(id, { note: f.note.value, met: boxes.filter((b) => b.checked).map((b) => +b.value) }); toast(`Application sent · ${r.application.match}% match`); location.reload(); }
        catch (err) { busy(btn, false); failed(el, err); }
      });
    }
  });

  /* ---------- Seeker: profile, CV, applications ---------- */
  route('/work/profile', { auth: true, tabs: 'Me' }, async () => {
    const [{ profile: p }, { applications: apps }] = await Promise.all([api.seeker(), api.myApplications()]);
    const u = state.user;
    return `
    ${topbar('My CV and applications', '/work')}
    <main class="pad stack" style="gap:16px">
      <div class="row" style="gap:14px">${avatar(u.name, 64)}<div class="grow"><div class="h-lg" style="font-size:20px">${h(u.name)}</div><div class="muted small">${h(p.headline || 'Add a headline')} · ${p.years} yr${p.years === 1 ? '' : 's'} · ${h(u.district || 'Abuja')}</div><div class="row" style="gap:6px;margin-top:6px">${p.openToWork ? '<span class="tag green">OPEN TO WORK</span>' : '<span class="tag" style="background:var(--surface);color:var(--ink-3)">Not looking</span>'}</div></div></div>
      <div class="stack" style="gap:10px"><div class="section">CV ON FILE</div>
        <div class="card stack" style="padding:16px;gap:12px">
          ${p.cv ? `<div class="row"><div style="width:44px;height:44px;border-radius:12px;background:var(--orange-tint);display:flex;align-items:center;justify-content:center;color:var(--orange-dark)">${icon('file-arrow-up')}</div><div class="grow"><div style="font-size:14px;font-weight:700">${h(p.cv.name)}</div><div class="small muted">${kb(p.cv.size)} · updated ${ago(p.cv.updatedAt)} · used in ${p.cv.usedIn} application${p.cv.usedIn === 1 ? '' : 's'}</div></div></div>
            <div class="row" style="gap:8px"><label class="btn btn-sm btn-ink" style="cursor:pointer;flex:1">Replace CV<input type="file" id="cvfile" accept="${cvAllowed}" style="display:none"></label><a class="btn btn-sm btn-outline" href="/api/cv/${p.cv.id}" target="_blank" rel="noopener" style="flex:1">Preview</a><button class="btn btn-sm btn-outline" data-delcv style="flex:1;color:#D92D20">Remove</button></div>`
          : `<div class="row"><div style="width:44px;height:44px;border-radius:12px;background:var(--orange-tint);display:flex;align-items:center;justify-content:center;color:var(--orange-dark)">${icon('file-arrow-up')}</div><div class="grow"><div style="font-size:14px;font-weight:700">No CV yet</div><div class="small muted">PDF or Word, up to 2 MB. You need one to apply.</div></div></div><label class="btn btn-ink" style="cursor:pointer">Add CV<input type="file" id="cvfile" accept="${cvAllowed}" style="display:none"></label>`}
          <div class="error" data-error="cv"></div>
          <div class="small muted row" style="gap:8px">${icon('shield-halved')} Only companies you apply to can open your CV. It is never shown on Match.</div>
        </div>
      </div>
      <form id="pf" class="stack" style="gap:10px"><div class="section">ABOUT YOU</div>
        <div class="card stack" style="padding:16px;gap:14px">
          ${field({ id: 'headline', label: 'Headline', placeholder: 'Customer care · 3 years · MTN', value: p.headline || '' })}
          <div class="row" style="gap:10px"><div class="field" style="flex:1"><label for="years">Years of experience</label><input class="input" id="years" name="years" type="number" min="0" max="50" inputmode="numeric" value="${p.years}"></div>
          <div class="field" style="flex:1"><label>Open to work</label><button type="button" class="switch ${p.openToWork ? 'on' : ''}" id="open" role="switch" aria-checked="${p.openToWork}" aria-label="Open to work"><span></span></button></div></div>
          <div class="field"><label for="skill">Skills</label><div class="row" style="flex-wrap:wrap;gap:8px" id="skills">${p.skills.map((s) => `<span class="chip" data-skill="${h(s)}">${h(s)} <button type="button" aria-label="Remove ${h(s)}" style="border:none;background:none;color:var(--ink-3);padding:0 0 0 4px;display:inline-flex">${icon('xmark')}</button></span>`).join('')}</div>
          <div class="row" style="gap:8px"><input class="input" id="skill" placeholder="Add a skill, e.g. Hausa" style="height:44px"><button type="button" class="btn btn-sm btn-outline" id="addskill">${icon('plus')} Add</button></div><div class="error" data-error="skills"></div></div>
          <button class="btn btn-ink" type="submit">Save profile</button>
        </div>
      </form>
      <div class="stack" style="gap:10px"><div class="section">APPLICATIONS</div>
        <div class="card list">${apps.length ? apps.map((a) => `<a class="item" href="#/work/job/${a.job.id}">${avatar(a.job.company, 36, color(a.job.company))}<div class="grow"><div class="t" style="font-weight:600">${h(a.job.title)}</div><div class="s">${h(a.job.company)} · ${h(a.job.district)} · ${a.match}% match</div></div>${stag(a.status)}</a>`).join('') : `<div class="item"><div class="grow small muted">No applications yet. Roles you apply to show up here with their status.</div></div>`}</div>
      </div>
    </main>`;
  }, {
    mount(el) {
      clearOnInput(el);
      const skills = () => [...el.querySelectorAll('[data-skill]')].map((s) => s.dataset.skill);
      const addSkill = () => { const i = el.querySelector('#skill'); const v = i.value.trim(); if (!v) return; if (skills().length >= 20) { showErrors(el, { skills: 'Up to 20 skills.' }); return; } el.querySelector('#skills').insertAdjacentHTML('beforeend', `<span class="chip" data-skill="${h(v)}">${h(v)} <button type="button" aria-label="Remove" style="border:none;background:none;color:var(--ink-3);padding:0 0 0 4px;display:inline-flex">${icon('xmark')}</button></span>`); i.value = ''; };
      el.querySelector('#addskill').addEventListener('click', addSkill);
      el.querySelector('#skill').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } });
      el.querySelector('#skills').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.closest('[data-skill]').remove(); });
      const sw = el.querySelector('#open'); sw.addEventListener('click', () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on); });
      el.querySelector('#pf').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true);
        try { await api.updateSeeker({ headline: el.querySelector('#headline').value, years: +el.querySelector('#years').value, openToWork: sw.classList.contains('on'), skills: skills() }); toast('Profile saved'); location.reload(); }
        catch (err) { busy(btn, false); failed(el, err); }
      });
      el.querySelector('#cvfile')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 2 * 1048576) { showErrors(el, { cv: 'CV must be 2 MB or smaller.' }); return; }
        try { await api.uploadCv(file); toast('CV saved'); location.reload(); } catch (err) { failed(el, err); }
      });
      el.querySelector('[data-delcv]')?.addEventListener('click', async () => { if (!confirm('Remove your CV? You will need to add one again before applying.')) return; try { await api.deleteCv(); toast('CV removed'); location.reload(); } catch (err) { failed(el, err); } });
    }
  });

  /* ---------- Company: profile + dashboard ---------- */
  route('/work/company', { auth: true, tabs: '' }, async () => {
    if (!isCompany()) return `${topbar('Hiring', '/work')}<div class="placeholder"><div class="mi card">${icon('building')}</div><div class="h-md">This is for hiring accounts</div><div class="small muted" style="max-width:280px">Your account is set up as a resident. To post vacancies, create a separate account and choose "I'm hiring" at onboarding.</div></div>`;
    const { company: c } = await api.company();
    if (!c) return `
      ${topbar('Your company', '/home')}
      <form id="cf" class="pad stack" style="gap:14px">
        <div><div class="h-xl">Set up your company</div><div class="muted" style="margin-top:4px">Applicants see this on every vacancy you post.</div></div>
        ${field({ id: 'name', label: 'Company name', placeholder: 'Zenith Bank' })}
        <div class="field"><label for="district">District of your office</label><select class="input" id="district" name="district"><option value="">Choose a district</option>${DISTRICTS.map((d) => `<option ${state.user.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="error" data-error="district"></div></div>
        ${field({ id: 'website', label: 'Website (optional)', placeholder: 'zenithbank.com' })}
        <div class="field"><label for="about">About (optional)</label><textarea class="input" id="about" name="about" maxlength="1000" placeholder="What you do and where, in two or three sentences" style="height:90px;padding:12px 14px;resize:none"></textarea></div>
        <button class="btn btn-primary" type="submit">Save and continue</button>
      </form>`;
    const { jobs } = await api.companyJobs();
    const sum = (k) => jobs.reduce((a, j) => a + (j[k] || 0), 0);
    return `
    ${topbar(c.name, '/home', `<a class="iconbtn" href="#/work/company/edit" aria-label="Edit company">${icon('gear')}</a>`)}
    <main class="pad stack" style="gap:16px">
      <div class="card row" style="padding:14px;gap:14px"><label style="position:relative;cursor:pointer;flex-shrink:0">${c.logo ? `<img src="${c.logo}" alt="" style="width:64px;height:64px;border-radius:14px;object-fit:cover;display:block">` : `<span style="width:64px;height:64px;border-radius:14px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--ink-3)">${icon('camera')}</span>`}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:12px;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid var(--card)">${icon('camera')}</span><input type="file" accept="image/*" id="logopick" style="display:none"></label>
        <div class="grow"><div style="font-size:15px;font-weight:700">${h(c.name)}</div><div class="small muted row" style="gap:6px;margin-top:2px">${icon('location-dot')} ${h(c.district)}</div><div class="small muted" style="margin-top:4px">${c.logo ? 'Your logo shows on every vacancy.' : 'Add a logo. Seekers trust a vacancy with one.'}</div></div>
        ${c.verified ? `<span class="tag green">${icon('circle-check')} Verified</span>` : ''}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        ${[['APPLICANTS', sum('applicants'), ''], ['80%+ MATCH', sum('strong'), 'var(--green-dark)'], ['SHORTLISTED', sum('shortlisted'), 'var(--orange-dark)'], ['INTERVIEWS', sum('interviews'), '']].map(([l, v, col]) => `<div class="card" style="padding:14px 16px"><div class="small muted" style="font-weight:600">${l}</div><div style="font-size:28px;font-weight:700;margin-top:4px;color:${col || 'var(--ink)'}">${v}</div></div>`).join('')}
      </div>
      <a class="btn btn-primary" href="#/work/company/post">${icon('plus')} Post a vacancy</a>
      <div class="section">VACANCIES</div>
      <div class="stack" style="gap:10px">${jobs.length ? jobs.map((j) => `<a class="card" href="#/work/company/job/${j.id}" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px"><div class="row"><div class="grow"><div class="h-sm">${h(j.title)}</div><div class="small muted">${h(j.district)} · ${TYPES[j.type]} · ${pay(j)}</div></div><span class="tag ${j.status === 'open' ? 'green' : ''}" style="${j.status === 'open' ? '' : 'background:var(--surface);color:var(--ink-3)'}">${j.status === 'open' ? 'Open' : 'Closed'}</span></div><div class="row small muted" style="gap:14px"><span><strong style="color:var(--ink)">${j.applicants}</strong> applied</span><span><strong style="color:var(--green-dark)">${j.strong}</strong> strong</span><span><strong style="color:var(--orange-dark)">${j.shortlisted}</strong> shortlisted</span><span><strong style="color:var(--ink)">${j.interviews}</strong> interview</span></div></a>`).join('') : `<div class="card" style="padding:16px"><div class="h-sm">No vacancies yet</div><div class="small muted">Post your first one. Seekers in your district see it immediately.</div></div>`}</div>
    </main>`;
  }, {
    mount(el) {
      clearOnInput(el);
      el.querySelector('#logopick')?.addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; toast('Uploading…'); try { const up = await api.upload(await shrinkImg(f), 'image'); await api.setCompanyLogo(up.upload.id); toast('Logo saved'); location.reload(); } catch (err) { failed(el, err); } });
      el.querySelector('#cf')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
        try { await api.saveCompany({ name: f.name.value, district: f.district.value, website: f.website.value, about: f.about.value }); toast('Company saved'); location.reload(); }
        catch (err) { busy(btn, false); failed(el, err); }
      });
    }
  });

  route('/work/company/edit', { auth: true, tabs: '' }, async () => {
    const { company: c } = await api.company(); if (!c) { go('/work/company'); return ''; }
    return `
    ${topbar('Edit company', '/work/company')}
    <form id="cf" class="pad stack" style="gap:14px">
      ${field({ id: 'name', label: 'Company name', value: c.name })}
      <div class="field"><label for="district">District</label><select class="input" id="district" name="district">${DISTRICTS.map((d) => `<option ${c.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      ${field({ id: 'website', label: 'Website', value: c.website || '' })}
      <div class="field"><label for="about">About</label><textarea class="input" id="about" name="about" maxlength="1000" style="height:110px;padding:12px 14px;resize:none">${h(c.about || '')}</textarea></div>
      <button class="btn btn-ink" type="submit">Save</button>
    </form>`;
  }, { mount(el) { el.querySelector('#cf').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; busy(f.querySelector('[type=submit]'), true); try { await api.saveCompany({ name: f.name.value, district: f.district.value, website: f.website.value, about: f.about.value }); toast('Saved'); go('/work/company'); } catch (err) { busy(f.querySelector('[type=submit]'), false); failed(el, err); } }); } });

  /* ---------- Company: post / edit vacancy ---------- */
  function jobForm(j) {
    const reqs = j?.requirements?.length ? j.requirements : [{ label: '', weight: 40 }, { label: '', weight: 30 }, { label: '', weight: 30 }];
    return `
    <form id="jf" class="pad stack" style="gap:14px">
      ${field({ id: 'title', label: 'Job title', placeholder: 'Customer Service Officer', value: j?.title || '' })}
      <div class="row" style="gap:10px">
        <div class="field" style="flex:1"><label for="district">District</label><select class="input" id="district" name="district"><option value="">Choose</option>${DISTRICTS.map((d) => `<option ${(j?.district || state.user.district) === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="error" data-error="district"></div></div>
        <div class="field" style="flex:1"><label for="type">Type</label><select class="input" id="type" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${(j?.type || 'full_time') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="row" style="gap:10px">
        <div class="field" style="flex:1"><label for="salaryMin">Salary from (₦/month)</label><input class="input" id="salaryMin" name="salaryMin" inputmode="numeric" placeholder="180,000" value="${j?.salaryMin ?? ''}"><div class="error" data-error="salaryMin"></div></div>
        <div class="field" style="flex:1"><label for="salaryMax">Salary to</label><input class="input" id="salaryMax" name="salaryMax" inputmode="numeric" placeholder="220,000" value="${j?.salaryMax ?? ''}"><div class="error" data-error="salaryMax"></div></div>
      </div>
      <div class="row" style="gap:10px">
        <div class="field" style="flex:1"><label for="deadline">Application deadline</label><input class="input" id="deadline" name="deadline" type="date" value="${j?.deadline || ''}"><div class="error" data-error="deadline"></div></div>
        <div class="field" style="flex:1"><label for="openings">Openings</label><input class="input" id="openings" name="openings" type="number" min="1" max="500" value="${j?.openings || 1}"></div>
      </div>
      <div class="field"><label for="description">About the role</label><textarea class="input" id="description" name="description" maxlength="4000" placeholder="What the person will do, who they report to, hours and location." style="height:120px;padding:12px 14px;resize:none">${h(j?.description || '')}</textarea><div class="error" data-error="description"></div></div>
      <div class="card stack" style="padding:16px;gap:10px">
        <div><div class="h-sm">Requirements</div><div class="small muted" style="line-height:1.5">Each has a weight. Weights add to 100 and produce the match percentage you'll see on every applicant.</div></div>
        <div id="reqs" class="stack" style="gap:8px">${reqs.map((r) => reqRow(r)).join('')}</div>
        <div class="row"><button type="button" class="btn btn-sm btn-outline" id="addreq">${icon('plus')} Add requirement</button><div class="grow"></div><div class="small" id="reqsum" style="font-weight:700">Total 0</div></div>
        <div class="error" data-error="requirements"></div>
      </div>
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} ${j ? 'Save changes' : 'Publish vacancy'}</button>
    </form>`;
  }
  const reqRow = (r) => `<div class="row" style="gap:8px" data-req><input class="input" placeholder="e.g. 2+ years customer care" value="${h(r.label || '')}" style="height:44px;flex:1" data-label><input class="input" type="number" min="0" max="100" value="${r.weight ?? 0}" style="height:44px;width:72px;text-align:center" data-weight aria-label="Weight"><button type="button" class="iconbtn" aria-label="Remove" style="width:40px;height:40px" data-rm>${icon('xmark')}</button></div>`;
  function mountJobForm(el, onSubmit) {
    clearOnInput(el);
    const box = el.querySelector('#reqs'), sum = el.querySelector('#reqsum');
    const recalc = () => { const t = [...box.querySelectorAll('[data-weight]')].reduce((a, i) => a + (+i.value || 0), 0); sum.textContent = 'Total ' + t; sum.style.color = t === 100 ? 'var(--green-dark)' : t === 0 ? 'var(--ink-3)' : 'var(--orange-dark)'; };
    box.addEventListener('input', recalc); box.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { b.closest('[data-req]').remove(); recalc(); } });
    el.querySelector('#addreq').addEventListener('click', () => { if (box.children.length >= 12) return; box.insertAdjacentHTML('beforeend', reqRow({ label: '', weight: 0 })); box.lastElementChild.querySelector('[data-label]').focus(); recalc(); });
    recalc();
    el.querySelector('#jf').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('[type=submit]'); showErrors(el, {}); busy(btn, true);
      const body = { title: f.title.value, district: f.district.value, type: f.type.value, salaryMin: f.salaryMin.value, salaryMax: f.salaryMax.value, deadline: f.deadline.value, openings: +f.openings.value, description: f.description.value,
        requirements: [...box.querySelectorAll('[data-req]')].map((r) => ({ label: r.querySelector('[data-label]').value, weight: +r.querySelector('[data-weight]').value })).filter((r) => r.label.trim()) };
      try { await onSubmit(body); } catch (err) { busy(btn, false); failed(el, err); }
    });
  }
  route('/work/company/post', { auth: true, tabs: '' }, async () => `${topbar('Post a vacancy', '/work/company')}${jobForm(null)}`, { mount(el) { mountJobForm(el, async (b) => { const r = await api.createJob(b); toast('Vacancy published'); go('/work/company/job/' + r.job.id); }); } });
  route('/work/company/job/:id/edit', { auth: true, tabs: '' }, async ({ id }) => { const { job } = await api.applicants(id); return `${topbar('Edit vacancy', '/work/company/job/' + id)}${jobForm(job)}`; }, { mount(el, { id }) { mountJobForm(el, async (b) => { await api.updateJob(id, b); toast('Saved'); go('/work/company/job/' + id); }); } });

  /* ---------- Company: applicants ---------- */
  route('/work/company/job/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const status = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || '';
    const { job: j, applications: apps } = await api.applicants(id, status);
    const reqById = Object.fromEntries((j.requirements || []).map((r) => [r.id, r]));
    return `
    ${topbar('', '/work/company', `<a class="iconbtn" href="#/work/company/job/${j.id}/edit" aria-label="Edit vacancy">${icon('sliders')}</a>`)}
    <main class="pad stack" style="gap:14px">
      <div><div class="h-lg" style="font-size:22px">${h(j.title)}</div><div class="muted small" style="margin-top:2px">${h(j.district)} · ${TYPES[j.type]} · ${pay(j)}${j.deadline ? ' · closes ' + new Date(j.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</div></div>
      <div class="row" style="gap:8px"><button class="btn btn-sm ${j.status === 'open' ? 'btn-outline' : 'btn-ink'}" data-toggle="${j.status === 'open' ? 'closed' : 'open'}">${j.status === 'open' ? 'Close vacancy' : 'Reopen vacancy'}</button><span class="small muted">${j.status === 'open' ? 'Accepting applications' : 'Closed to new applicants'}</span></div>
      <div class="row" style="gap:8px;overflow-x:auto;scrollbar-width:none">${[['', 'All'], ['new', 'New'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['rejected', 'Not selected']].map(([k, v]) => `<a class="chip ${status === k ? 'on' : ''}" href="#/work/company/job/${j.id}${k ? '?status=' + k : ''}">${v}</a>`).join('')}</div>
      <div class="stack" style="gap:10px">${apps.length ? apps.map((a) => `
        <div class="card stack" style="padding:14px 16px;gap:10px" data-app="${a.id}">
          <div class="row">${avatar(a.applicant.name, 44, color(a.applicant.name))}<div class="grow"><div class="h-sm">${h(a.applicant.name)}</div><div class="small muted">${h(a.applicant.headline || 'No headline')} · ${a.applicant.years} yr${a.applicant.years === 1 ? '' : 's'} · ${h(a.applicant.district || 'Abuja')}</div></div><div style="text-align:right"><div style="font-size:20px;font-weight:700;color:${a.match >= 80 ? 'var(--green-dark)' : 'var(--ink)'}">${a.match}%</div><div class="small muted">match</div></div></div>
          ${a.met.length ? `<div class="row" style="flex-wrap:wrap;gap:6px">${a.met.map((m) => reqById[m] ? `<span class="tag green">${icon('circle-check')} ${h(reqById[m].label)}</span>` : '').join('')}</div>` : ''}
          ${a.applicant.skills.length ? `<div class="small muted">Skills: ${a.applicant.skills.map(h).join(', ')}</div>` : ''}
          ${a.note ? `<div class="small" style="padding:10px 12px;background:var(--surface);border-radius:10px;line-height:1.5">“${h(a.note)}”</div>` : ''}
          <div class="row" style="gap:8px;flex-wrap:wrap">
            ${a.cv ? `<a class="btn btn-sm btn-outline" href="/api/cv/${a.cv.id}" target="_blank" rel="noopener">${icon('file-arrow-up')} CV</a>` : ''}
            <button class="btn btn-sm btn-outline" data-thread="${a.id}">${icon('message')} Message</button>
            ${stag(a.status)}<div class="grow"></div>
            ${a.status !== 'shortlisted' && a.status !== 'interview' && a.status !== 'hired' ? `<button class="btn btn-sm btn-outline" data-status="shortlisted">Shortlist</button>` : ''}
            ${a.status !== 'interview' && a.status !== 'hired' ? `<button class="btn btn-sm btn-ink" data-thread="${a.id}" data-schedule="1">${icon('calendar-check')} Interview</button>` : ''}
            ${a.status === 'interview' ? `<button class="btn btn-sm btn-ink" data-status="hired">Mark hired</button>` : ''}
            ${a.status !== 'rejected' && a.status !== 'hired' ? `<button class="btn btn-sm btn-outline" data-status="rejected" style="color:var(--ink-3)">Pass</button>` : ''}
          </div>
          <div class="small muted">${a.applicant.email}${a.applicant.phone ? ' · ' + a.applicant.phone : ''} · applied ${ago(a.createdAt)}</div>
        </div>`).join('') : `<div class="card" style="padding:16px"><div class="h-sm">No applicants ${status ? 'with this status' : 'yet'}</div><div class="small muted">Applicants appear here ranked by how much of your requirements they meet.</div></div>`}</div>
      <div class="small muted" style="line-height:1.5">Interview opens the conversation with a scheduling card. Applicants get a push notification and an email, and can confirm or suggest another time.</div>
    </main>`;
  }, {
    mount(el, { id }) {
      el.querySelector('[data-toggle]')?.addEventListener('click', async (e) => { const b = e.currentTarget; busy(b, true); try { await api.updateJob(id, { status: b.dataset.toggle }); toast(b.dataset.toggle === 'open' ? 'Vacancy reopened' : 'Vacancy closed'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } });
      el.querySelectorAll('[data-thread]').forEach((b) => b.addEventListener('click', async () => { busy(b, true); try { const r = await api.openThread(b.dataset.thread); go('/inbox/' + r.threadId + (b.dataset.schedule ? '?schedule=1' : '')); } catch (err) { busy(b, false); failed(el, err); } }));
      el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => { const card = b.closest('[data-app]'); busy(b, true); try { await api.setApplication(card.dataset.app, b.dataset.status); toast('Updated'); location.reload(); } catch (err) { busy(b, false); failed(el, err); } }));
    }
  });
}
