// Buja saved searches: keep a search and be told when something new matches. Registered by app.js.
export function registerAlerts({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy } = ui;
  const ICON = { work: 'briefcase', homes: 'house-chimney', declutter: 'tags' };

  route('/alerts', { auth: true, tabs: 'Me' }, async () => {
    const { searches } = await api.savedSearches();
    return `${topbar('Saved searches', '/me')}
    <main class="pad stack" style="gap:14px">
      ${searches.length ? `<div class="stack" style="gap:10px">${searches.map((s) => `
        <div class="card stack" style="padding:14px;gap:10px">
          <div class="row" style="gap:12px">
            <span style="width:38px;height:38px;border-radius:12px;background:var(--surface);color:var(--ink-3);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(ICON[s.module] || 'magnifying-glass')}</span>
            <div class="grow" style="min-width:0"><div style="font-size:14px;font-weight:650">${h(s.label)}</div><div class="small muted">${h(s.moduleLabel)}${s.hits ? ' · ' + s.hits + ' since you saved it' : ' · nothing new yet'}</div></div>
            <button class="iconbtn" data-del="${s.id}" aria-label="Delete this search" style="width:34px;height:34px">${icon('xmark')}</button>
          </div>
          <div class="row" style="gap:10px">
            <a class="btn btn-sm btn-outline grow" href="#${h(s.url)}">Open it</a>
            <button class="btn btn-sm ${s.alerts ? 'btn-ink' : 'btn-outline'}" data-alert="${s.id}" data-on="${s.alerts ? 1 : 0}" style="width:auto">${icon(s.alerts ? 'circle-check' : 'circle-info')} ${s.alerts ? 'Alerts on' : 'Alerts off'}</button>
          </div>
        </div>`).join('')}</div>`
      : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('magnifying-glass')}</div><div class="h-md">No saved searches yet</div><div class="small muted" style="max-width:290px;line-height:1.55">Search in Work, Homes or Declutter, set your filters, then tap Save this search. Buja will tell you the moment something new matches, so you stop checking.</div>
        <div class="row" style="gap:8px;margin-top:6px"><a class="btn btn-sm btn-outline" href="#/work" style="width:auto">Work</a><a class="btn btn-sm btn-outline" href="#/homes" style="width:auto">Homes</a><a class="btn btn-sm btn-outline" href="#/declutter" style="width:auto">Declutter</a></div></div>`}
      ${searches.length ? `<div class="small muted" style="line-height:1.5">Alerts arrive as a notification. Turn them off here to keep a search without being told about it.</div>` : ''}
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { try { await api.removeSearch(b.dataset.del); toast('Removed'); location.reload(); } catch (err) { failed(el, err); } }));
      el.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', async () => {
        const on = b.dataset.on === '1';
        busy(b, true);
        try { await api.alertToggle(b.dataset.alert, !on); toast(on ? 'Alerts off for that search' : 'Alerts on'); location.reload(); }
        catch (err) { busy(b, false); failed(el, err); }
      }));
    }
  });
}

/**
 * The Save this search control that sits on a results screen. Pass the module and the filters currently
 * applied, and it writes them down so Buja can watch for new matches.
 */
export function saveSearchBar({ module, filters, api, ui, go }) {
  const { icon, h } = ui;
  const active = Object.entries(filters || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (!active.length) return '';
  return `<button class="card row" id="savesearch" data-module="${module}" data-filters="${h(JSON.stringify(Object.fromEntries(active)))}" style="padding:12px 14px;gap:10px;width:100%;text-align:left;border-style:dashed">
    <span style="width:32px;height:32px;border-radius:10px;background:var(--orange-tint);color:var(--orange-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('bell')}</span>
    <span class="grow"><span style="display:block;font-size:13px;font-weight:650">Save this search</span><span class="small muted">Be told when something new matches</span></span>
  </button>`;
}

export function bindSaveSearch(el, { api, ui, go }) {
  const { toast } = ui;
  const b = el.querySelector('#savesearch'); if (!b) return;
  b.addEventListener('click', async () => {
    try {
      await api.saveSearch({ module: b.dataset.module, filters: JSON.parse(b.dataset.filters), alerts: true });
      toast('Saved. Buja will tell you when something new matches.');
      b.outerHTML = '';
    } catch (err) { toast((err && err.message) || 'Could not save that search'); }
  });
}
