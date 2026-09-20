import { icon } from './icons.js';

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function mark(h, crossbar) {
  const w = Math.round(h * 400 / 320); const id = 'g' + h + (crossbar === '#FAFAF7' ? 'l' : 'd');
  return `<svg viewBox="0 0 400 320" style="width:${w}px;height:${h}px" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7ED957"/><stop offset="100%" stop-color="#FF7A1A"/></linearGradient></defs><path d="M110,15 L150,15 L150,150 C150,235 140,285 122,310 L6,310 C70,285 105,235 110,150 Z" fill="url(#${id})"/><path d="M290,15 L250,15 L250,150 C250,235 260,285 278,310 L394,310 C330,285 295,235 290,150 Z" fill="url(#${id})"/><rect x="110" y="120" width="180" height="22" fill="${crossbar}"/><path d="M152,34 L200,73 L152,112 Z" fill="${crossbar}"/><path d="M248,34 L200,73 L248,112 Z" fill="${crossbar}"/></svg>`;
}
export const markAuto = (h) => `<span class="mark-light">${mark(h, '#FAFAF7')}</span><span class="mark-dark">${mark(h, '#1B1B1F')}</span>`;

export function topbar(title, back, right) {
  return `<header class="topbar">
    ${back ? `<a class="iconbtn" href="#${back}" aria-label="Back">${icon('arrow-left')}</a>` : ''}
    <h1>${h(title)}</h1>
    ${right || ''}
  </header>`;
}

export function tabbar(active, unread = 0) {
  const tabs = [['/home', 'house', 'Home'], ['/ask', 'wand-magic-sparkles', 'Ask'], ['/inbox', 'message', 'Inbox'], ['/me', 'user', 'Me']];
  return `<nav class="tabbar" aria-label="Main">${tabs.map(([href, ic, label]) =>
    `<a class="tab ${active === label ? 'on' : ''}" href="#${href}" aria-label="${label}" ${active === label ? 'aria-current="page"' : ''} style="position:relative">${icon(ic)}<span>${label}</span>${label === 'Inbox' && unread ? `<span class="tab-badge">${unread}</span>` : ''}</a>`).join('')}</nav>`;
}

export function field({ id, label, type = 'text', placeholder = '', value = '', hint = '', autocomplete = '', inputmode = '' }) {
  return `<div class="field" data-field="${id}">
    <label for="${id}">${h(label)}</label>
    ${type === 'password'
      ? `<div class="input-wrap"><input class="input" id="${id}" name="${id}" type="password" placeholder="${h(placeholder)}" autocomplete="${autocomplete}"><button type="button" class="eye" data-eye="${id}" aria-label="Show password">${icon('eye')}</button></div>`
      : `<input class="input" id="${id}" name="${id}" type="${type}" placeholder="${h(placeholder)}" value="${h(value)}" autocomplete="${autocomplete}" ${inputmode ? `inputmode="${inputmode}"` : ''}>`}
    ${hint ? `<div class="hint">${h(hint)}</div>` : ''}
    <div class="error" data-error="${id}"></div>
  </div>`;
}

export function showErrors(root, fields) {
  root.querySelectorAll('[data-error]').forEach((e) => { e.textContent = ''; });
  root.querySelectorAll('.input.err').forEach((e) => e.classList.remove('err'));
  let first = null;
  for (const [k, msg] of Object.entries(fields || {})) {
    const e = root.querySelector(`[data-error="${k}"]`); if (e) e.textContent = msg;
    const i = root.querySelector(`#${CSS.escape(k)}`); if (i) { i.classList.add('err'); first ??= i; }
  }
  if (first) first.focus();
}

export function clearOnInput(root) {
  root.querySelectorAll('.input').forEach((i) => i.addEventListener('input', () => { i.classList.remove('err'); const e = root.querySelector(`[data-error="${i.id}"]`); if (e) e.textContent = ''; }));
}

export function bindEyes(root) {
  root.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
    const i = root.querySelector('#' + CSS.escape(b.dataset.eye)); const show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eye-slash' : 'eye'); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));
}

export function busy(btn, on) {
  if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.label || btn.innerHTML; btn.disabled = false; }
}

export const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
export const avatar = (name, size, bg = '#2E7D1E') => `<span class="avatar" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * .38)}px">${h(initials(name))}</span>`;
export { icon };


/* ---------- Attachments ---------- */
export function attachmentHtml(a, opts = {}) {
  if (!a) return '';
  const w = opts.max || 260;
  if (a.kind === 'image') return `<a href="${a.url}" target="_blank" rel="noopener" style="display:block;border-radius:14px;overflow:hidden;max-width:${w}px"><img src="${a.url}" alt="Attachment" loading="lazy" style="width:100%;display:block;max-height:340px;object-fit:cover"></a>`;
  if (a.kind === 'video') return `<video controls preload="metadata" playsinline src="${a.url}" style="width:100%;max-width:${w}px;border-radius:14px;display:block;background:#000"></video>`;
  if (a.kind === 'audio') return `<div class="row" style="gap:10px;padding:8px 10px;background:var(--surface);border-radius:14px;max-width:${w}px"><audio controls preload="metadata" src="${a.url}" style="width:100%;height:36px"></audio></div>`;
  if (a.kind === 'file') return `<a class="row" href="${a.url}" target="_blank" rel="noopener" style="gap:10px;padding:12px 14px;background:var(--surface);border-radius:14px;max-width:${w}px"><span style="width:34px;height:34px;border-radius:10px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px">${icon('file-arrow-up')}</span><span class="grow" style="min-width:0"><span style="display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(a.name || 'Document').replace(/[<>&]/g, '')}</span><span class="small muted">${Math.max(1, Math.round((a.size || 0) / 1024))} KB</span></span></a>`;
  if (a.kind === 'location') { const m = a.meta || {}; return `<a class="row" href="https://www.google.com/maps?q=${m.lat},${m.lng}" target="_blank" rel="noopener" style="gap:10px;padding:12px 14px;background:var(--green-tint);border-radius:14px;max-width:${w}px"><span style="color:var(--green-dark)">${icon('location-dot')}</span><span class="grow"><span style="display:block;font-size:13px;font-weight:600;color:var(--green-dark)">${(m.label || 'Shared location').replace(/[<>&]/g, '')}</span><span class="small muted">${(+m.lat).toFixed(4)}, ${(+m.lng).toFixed(4)} · open in maps</span></span></a>`; }
  return '';
}

/** Turns the first YouTube link in a body into an embedded player. */
export function youtubeEmbed(text) {
  const m = String(text || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
  if (!m) return '';
  return `<div style="position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="YouTube video" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div>`;
}

/** Makes plain links clickable in user text that has already been escaped. */
export function linkify(escaped) {
  return String(escaped).replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener" style="color:var(--orange-dark);word-break:break-all">${m}</a>`);
}
