// Buja trust and roads: rating the people you dealt with, and live alerts from the streets.
export function registerTrustAlerts({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy, field, showErrors, clearOnInput } = ui;
  const ago = (iso) => { const d = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000; return d < 60 ? 'just now' : d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
  const stars = (n, size = 14) => `<span style="color:var(--orange);font-size:${size}px;letter-spacing:1px">${'★'.repeat(Math.round(n || 0))}<span style="color:var(--line)">${'★'.repeat(5 - Math.round(n || 0))}</span></span>`;

  /** The small badge that goes next to somebody's name anywhere in Buja. */
  window.bujaRating = (r) => {
    if (!r || !r.count) return `<span class="small muted">no ratings yet</span>`;
    return `<span class="small" style="font-weight:650">${stars(r.stars, 12)} ${r.stars} <span class="muted" style="font-weight:400">(${r.count})</span></span>`;
  };

  /* ---------- Somebody's ratings ---------- */
  route('/people/:id', { auth: true, tabs: '' }, async ({ id }) => {
    const d = await api.userRatings(id);
    return `${topbar(d.name, '')}
    <main class="pad stack" style="gap:14px">
      <div class="card row" style="padding:16px;gap:16px;align-items:center">
        <div style="text-align:center"><div style="font-size:34px;font-weight:700;line-height:1">${d.summary.stars ?? '–'}</div><div class="small muted">${d.summary.count} rating${d.summary.count === 1 ? '' : 's'}</div></div>
        <div class="grow">${stars(d.summary.stars, 18)}
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${d.summary.top.map((t) => `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(t)}</span>`).join('') || '<span class="small muted">Nobody has left a comment yet.</span>'}</div>
        </div>
      </div>
      ${d.ratings.length ? d.ratings.map((r) => `<div class="card stack" style="padding:14px;gap:8px">
        <div class="row" style="justify-content:space-between"><span>${stars(r.stars)}</span><span class="small muted">${h(r.by)} · ${h(r.module)} · ${h(r.at)}</span></div>
        ${r.tags.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${r.tags.map((t) => `<span class="tag" style="background:var(--surface);color:var(--ink-2)">${h(t)}</span>`).join('')}</div>` : ''}
        ${r.comment ? `<div style="font-size:14px;line-height:1.55;color:var(--ink-2)">${h(r.comment)}</div>` : ''}
      </div>`).join('') : `<div class="placeholder" style="padding:40px 0"><div class="small muted" style="max-width:280px;line-height:1.5">No ratings yet. People can rate each other after they have actually dealt with one another on Buja.</div></div>`}
      <div class="small muted" style="line-height:1.5">Ratings come only from people who held a real conversation here, one rating each, so they cannot be bought or spammed.</div>
    </main>`;
  });

  /* ---------- Rate the person from a conversation ---------- */
  route('/rate/:threadId', { auth: true, tabs: '' }, async ({ threadId }) => {
    const d = await api.ratingStatus(threadId);
    if (!d.canRate) return `${topbar('Rate', '/inbox/' + threadId)}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('circle-check')}</div><div class="h-md">${d.rated ? 'You already rated this one' : 'Not yet'}</div><div class="small muted" style="max-width:280px;line-height:1.5">${d.rated ? 'Thank you. One rating per conversation keeps it honest.' : 'You can rate each other once you have both spoken here.'}</div><a class="btn btn-ink" href="#/inbox/${h(threadId)}" style="width:auto">Back</a></div>`;
    return `${topbar('How did it go?', '/inbox/' + threadId)}
    <main class="pad stack" style="gap:16px">
      <div class="card stack" style="padding:18px;gap:14px">
        <div><div class="h-md">Rating ${h(d.other.name)}</div><div class="small muted" style="margin-top:2px">Only you two can see who said what, but the stars are public.</div></div>
        <div class="row" id="stars" style="gap:10px;justify-content:center">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-s="${n}" style="width:50px;height:50px;border-radius:25px;border:1px solid var(--line);background:var(--card);font-size:22px;color:var(--line)">★</button>`).join('')}</div>
        <div class="small muted center" id="slabel">Tap the stars</div>
      </div>
      <div class="stack" style="gap:8px"><div class="section">WHAT HAPPENED</div>
        <div class="row" style="gap:8px;flex-wrap:wrap" id="tags">${d.tags.map((t) => `<button type="button" class="chip" data-t="${h(t)}">${h(t)}</button>`).join('')}</div>
      </div>
      <div class="field"><label for="comment">Anything to add (optional)</label><textarea class="input" id="comment" maxlength="400" placeholder="Kept to the time, price was as agreed" style="height:90px;padding:12px 14px;resize:none"></textarea></div>
      <button class="btn btn-primary" id="send" disabled>${icon('paper-plane')} Send rating</button>
      <div class="small muted" style="line-height:1.5">Be fair. A rating stays on somebody's profile and shapes whether strangers will deal with them.</div>
    </main>`;
  }, {
    mount(el, { threadId }) {
      let picked = 0; const chosen = new Set();
      const labels = { 1: 'Bad, would warn others', 2: 'Poor', 3: 'Fine', 4: 'Good', 5: 'Excellent, would deal again' };
      el.querySelectorAll('#stars [data-s]').forEach((b) => b.addEventListener('click', () => {
        picked = +b.dataset.s;
        el.querySelectorAll('#stars [data-s]').forEach((x) => { const on = +x.dataset.s <= picked; x.style.color = on ? 'var(--orange)' : 'var(--line)'; x.style.borderColor = on ? 'var(--orange)' : 'var(--line)'; });
        el.querySelector('#slabel').textContent = labels[picked];
        el.querySelector('#send').disabled = false;
      }));
      el.querySelectorAll('#tags [data-t]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.t; if (chosen.has(t)) { chosen.delete(t); b.classList.remove('on'); } else { chosen.add(t); b.classList.add('on'); } }));
      el.querySelector('#send').addEventListener('click', async (e) => {
        busy(e.currentTarget, true);
        try { await api.rateThread(threadId, { stars: picked, tags: [...chosen], comment: el.querySelector('#comment').value }); toast('Thank you. That helps the next person.'); go('/inbox/' + threadId); }
        catch (err) { busy(e.currentTarget, false); failed(el, err); }
      });
    }
  });

  /* ---------- Live road alerts ---------- */
  const AICON = { traffic: 'route', blocked: 'triangle-exclamation', accident: 'triangle-exclamation', flood: 'triangle-exclamation', police: 'shield-halved', fuel: 'bolt', protest: 'users', nofare: 'bus', clear: 'circle-check' };
  route('/waka/alerts', { auth: true, tabs: '' }, async () => {
    const { alerts, kinds } = await api.wakaAlerts();
    return `${topbar('Roads right now', '/waka', `<a class="iconbtn" href="#/waka/alerts/new" aria-label="Report" style="background:var(--orange);border-color:var(--orange);color:#fff">${icon('plus')}</a>`)}
    <main class="pad stack" style="gap:12px">
      ${alerts.length ? alerts.map((a) => `<div class="card stack" style="padding:14px;gap:10px;${a.kind === 'clear' ? 'border-color:var(--green)' : ''}">
        <div class="row" style="gap:12px">
          <span style="width:38px;height:38px;border-radius:12px;background:${a.kind === 'clear' ? 'var(--green-tint)' : 'var(--orange-tint)'};color:${a.kind === 'clear' ? 'var(--green-dark)' : 'var(--orange-dark)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(AICON[a.kind] || 'triangle-exclamation')}</span>
          <div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${h(a.label)}${a.place ? ' at ' + h(a.place) : ''}</div><div class="small muted">${h(a.district || 'Abuja')} · ${ago(a.at)} · ${a.confirms} ${a.confirms === 1 ? 'person' : 'people'} said so</div></div>
        </div>
        ${a.note ? `<div style="font-size:14px;line-height:1.5;color:var(--ink-2)">${h(a.note)}</div>` : ''}
        <div class="row" style="gap:8px"><button class="btn btn-sm ${a.my_vote === 1 ? 'btn-ink' : 'btn-outline'}" data-vote="1" data-id="${a.id}" style="flex:1">Still there</button><button class="btn btn-sm ${a.my_vote === -1 ? 'btn-ink' : 'btn-outline'}" data-vote="-1" data-id="${a.id}" style="flex:1">It has cleared</button></div>
      </div>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('route')}</div><div class="h-md">Roads are quiet</div><div class="small muted" style="max-width:290px;line-height:1.55">Nobody has reported anything. If you are stuck somewhere, tell the city and everyone on that route hears within seconds.</div><a class="btn btn-ink" href="#/waka/alerts/new" style="width:auto">Report something</a></div>`}
      ${alerts.length ? `<div class="small muted" style="line-height:1.5">Alerts fade on their own, faster when people say it has cleared. Only riders on that route and people nearby are told.</div>` : ''}
    </main>`;
  }, {
    mount(el) {
      el.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', async () => {
        busy(b, true);
        try { await api.voteAlert(b.dataset.id, +b.dataset.vote); toast(+b.dataset.vote === 1 ? 'Confirmed' : 'Marked as cleared'); location.reload(); }
        catch (err) { busy(b, false); failed(el, err); }
      }));
    }
  });

  route('/waka/alerts/new', { auth: true, tabs: '' }, async () => {
    const { kinds } = await api.wakaAlerts();
    const { places } = await api.wakaPlaces('');
    return `${topbar('What is happening?', '/waka/alerts')}
    <form id="af" class="pad stack" style="gap:14px">
      <div class="row" style="gap:8px;flex-wrap:wrap" id="kind">${Object.entries(kinds).map(([k, label], i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-k="${k}">${h(label)}</button>`).join('')}</div>
      <div class="field"><label for="placeId">Where</label><select class="input" id="placeId"><option value="">My district</option>${places.map((p) => `<option value="${p.id}">${h(p.name)} · ${h(p.district)}</option>`).join('')}</select></div>
      ${field({ id: 'note', label: 'Anything to add (optional)', placeholder: 'Stuck since 7am, tanker fell across the road' })}
      <button class="btn btn-primary" type="submit">${icon('paper-plane')} Tell the city</button>
      <div class="small muted" style="line-height:1.55">This goes to people who saved a route through there and people in that district, not to everybody. Please only report what you can see yourself.</div>
    </form>`;
  }, {
    mount(el) {
      clearOnInput(el);
      let kind = el.querySelector('#kind [data-k]').dataset.k;
      el.querySelectorAll('#kind [data-k]').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.k; el.querySelectorAll('#kind [data-k]').forEach((x) => x.classList.toggle('on', x === b)); }));
      el.querySelector('#af').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); busy(btn, true);
        try { const r = await api.reportAlert({ kind, placeId: el.querySelector('#placeId').value || null, note: el.querySelector('#note').value }); toast(r.merged ? 'Somebody already said that. Yours confirms it.' : 'Reported. Thank you.'); go('/waka/alerts'); }
        catch (err) { busy(btn, false); failed(el, err); }
      });
    }
  });
}

/**
 * The ringing sound. Made with the browser's own audio, so there is no file to download and it works
 * offline: a Nigerian-style double ring for an incoming call, a softer single tone while you wait.
 */
export function ringer() {
  let ctx = null, timer = null, playing = false;
  const beep = (freq, start, length, gain = 0.18) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.04);
    g.gain.setValueAtTime(gain, ctx.currentTime + start + length - 0.05);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + length);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + length + 0.02);
  };
  return {
    start(mode = 'incoming') {
      if (playing) return;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      playing = true;
      const cycle = () => {
        if (!playing) return;
        try {
          if (mode === 'incoming') { beep(480, 0, 0.4); beep(620, 0.5, 0.4); }
          else { beep(420, 0, 0.9, 0.09); }
        } catch {}
        if (mode === 'incoming' && navigator.vibrate) navigator.vibrate([400, 200, 400]);
      };
      cycle();
      timer = setInterval(cycle, mode === 'incoming' ? 2600 : 3200);
    },
    stop() {
      playing = false; clearInterval(timer); timer = null;
      if (navigator.vibrate) navigator.vibrate(0);
    },
  };
}
