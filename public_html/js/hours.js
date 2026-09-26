// Buja: a simple opening-hours picker. Each day open or closed, with from and to times, and shortcuts for
// "same every day" and "open 24 hours". It writes the short form Buja reads ("Mo-Fr 08:00-18:00; Sa 09:00-14:00; Su off").
export const DAYS = [['Mo', 'Mon'], ['Tu', 'Tue'], ['We', 'Wed'], ['Th', 'Thu'], ['Fr', 'Fri'], ['Sa', 'Sat'], ['Su', 'Sun']];

/** Reads the short form back into seven days, when it is simple enough; otherwise a sensible default. */
export function parse(str) {
  const out = DAYS.map(([k], i) => ({ k, open: i < 6, from: '08:00', to: '20:00' }));
  const s = String(str || '').trim(); if (!s) return out;
  if (s === '24/7') return out.map((d) => ({ ...d, open: true, from: '00:00', to: '24:00' }));
  const idx = Object.fromEntries(DAYS.map(([k], i) => [k, i]));
  const seen = new Set();
  for (const part of s.split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Z][a-z](?:-[A-Z][a-z])?)\s+(off|closed|(\d{2}:\d{2})-(\d{2}:\d{2}))$/); if (!m) return out;
    const [a, b] = m[1].split('-'); const from = idx[a], to = b ? idx[b] : idx[a]; if (from == null || to == null) return out;
    for (let i = from; ; i = (i + 1) % 7) { seen.add(i); out[i] = { k: DAYS[i][0], open: m[2] !== 'off' && m[2] !== 'closed', from: m[3] || '08:00', to: m[4] || '20:00' }; if (i === to) break; }
  }
  DAYS.forEach((_, i) => { if (!seen.has(i)) out[i].open = false; });
  return out;
}

/** Seven days into the short form, grouping neighbouring days with the same times. */
export function format(days) {
  if (days.every((d) => d.open && d.from === '00:00' && (d.to === '24:00' || d.to === '23:59'))) return '24/7';
  const key = (d) => (d.open ? d.from + '-' + d.to : 'off');
  const parts = []; let i = 0;
  while (i < 7) { let j = i; while (j + 1 < 7 && key(days[j + 1]) === key(days[i])) j++; parts.push((i === j ? days[i].k : days[i].k + '-' + days[j].k) + ' ' + key(days[i])); i = j + 1; }
  return parts.join('; ');
}

/** Draws the picker into host; returns { value() } giving the short form. */
export function picker(host, initial, { h }) {
  let days = parse(initial);
  const draw = () => {
    host.innerHTML = `<div class="stack hrs" style="gap:8px">
      <div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" class="chip" data-hq="same">Same hours every day</button><button type="button" class="chip" data-hq="weekdays">Weekdays only</button><button type="button" class="chip" data-hq="allday">Open 24 hours</button></div>
      ${days.map((d, i) => `<div class="row hrs-row" style="gap:8px;align-items:center"><label class="row small" style="gap:6px;width:66px;flex-shrink:0"><input type="checkbox" data-open="${i}" ${d.open ? 'checked' : ''}> ${DAYS[i][1]}</label>
        ${d.open ? `<input class="input" type="time" data-from="${i}" value="${h(d.from)}" style="height:38px;flex:1;min-width:0"><span class="small muted">to</span><input class="input" type="time" data-to="${i}" value="${h(d.to === '24:00' ? '23:59' : d.to)}" style="height:38px;flex:1;min-width:0">` : '<span class="small muted grow">Closed</span>'}</div>`).join('')}
      <div class="small muted">Closing after midnight? Put the later time, like 18:00 to 02:00.</div></div>`;
  };
  draw();
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.open) { days[+t.dataset.open].open = t.checked; draw(); }
    if (t.dataset.from) days[+t.dataset.from].from = t.value || '08:00';
    if (t.dataset.to) days[+t.dataset.to].to = t.value || '20:00';
  });
  host.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hq]'); if (!b) return;
    const first = days.find((d) => d.open) || { from: '08:00', to: '20:00' };
    if (b.dataset.hq === 'same') days = days.map((d) => ({ ...d, open: true, from: first.from, to: first.to }));
    if (b.dataset.hq === 'weekdays') days = days.map((d, i) => ({ ...d, open: i < 5, from: first.from, to: first.to }));
    if (b.dataset.hq === 'allday') days = days.map((d) => ({ ...d, open: true, from: '00:00', to: '24:00' }));
    draw();
  });
  return { value: () => format(days) };
}
