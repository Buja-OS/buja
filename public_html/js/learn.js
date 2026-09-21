// Buja Learn: interactive courses with an editor, tests that run in a sandbox, AI-graded prompt work,
// and a premium certificate with a QR code that verifies it. Registered by app.js.
export function registerLearn({ route, go, state, api, ui, failed }) {
  const { h, toast, topbar, icon, busy } = ui;
  const TRACK = { frontend: 'Frontend', backend: 'Backend', fullstack: 'Full-stack', prompt: 'Prompt engineering', ai: 'AI' };
  const KIND = { read: ['book-open', 'Read'], quiz: ['circle-check', 'Quiz'], code: ['code', 'Code'], prompt: ['wand-magic-sparkles', 'Prompt lab'] };

  /* ---------------------------------- Course list ---------------------------------- */
  route('/learn', { auth: true, tabs: '' }, async () => {
    const d = await api.learn();
    return `${topbar('Buja Learn', '/home', `<a class="iconbtn" href="#/learn/certificates" aria-label="My certificates">${icon('award')}</a>`)}
    <main class="pad stack" style="gap:14px">
      <div style="padding:4px 2px"><div class="h-lg" style="font-size:22px">Learn to build. For free.</div><div class="small muted" style="margin-top:4px;line-height:1.5">Write real code on your phone, pass the tests, earn a certificate anyone can verify. ${d.learners ? d.learners + ' people learning.' : ''}</div></div>
      ${['frontend', 'backend', 'fullstack', 'prompt', 'ai'].map((track) => { const cs = d.courses.filter((c) => c.track === track); if (!cs.length) return ''; return `
        <div class="section" style="margin-top:6px">${h(TRACK[track].toUpperCase())}${cs.length > 1 ? ' · ' + cs.length + ' levels' : ''}</div>
        ${cs.map((c) => { const locked = c.after && !c.afterDone; return `<a class="card" href="${locked ? '#/learn/' + c.after : '#/learn/' + c.slug}" style="display:block;overflow:hidden;${locked ? 'opacity:.72' : ''}">
        <div style="height:150px;background:url('${c.thumb}') center/cover;position:relative">${locked ? `<div style="position:absolute;inset:0;background:rgba(16,16,20,.35);display:flex;align-items:center;justify-content:center"><span style="background:#fff;color:#101014;border-radius:20px;padding:8px 14px;font-size:12px;font-weight:700">${icon('lock')} Finish ${h(c.afterTitle)} first</span></div>` : ''}</div>
        <div class="stack" style="padding:14px;gap:8px">
          <div class="row" style="gap:8px"><span class="tag" style="background:${c.color}1a;color:${c.color}">${h(c.level)}</span><span class="small muted">${c.lessons} lessons · ${c.hours} h</span></div>
          <div style="font-size:16px;font-weight:700">${h(c.title)}</div>
          <div class="small" style="color:var(--ink-2);line-height:1.5">${h(c.blurb)}</div>
          ${c.certificate ? `<div class="row small" style="gap:6px;color:var(--green-dark);font-weight:650">${icon('award')} Certificate earned</div>` : c.done ? `<div><div style="height:6px;border-radius:3px;background:var(--surface)"><div style="height:6px;border-radius:3px;background:${c.color};width:${c.pct}%"></div></div><div class="small muted" style="margin-top:4px">${c.pct}% · ${c.done} of ${c.lessons} done</div></div>` : ''}
        </div></a>`; }).join('')}`; }).join('')}
      <div class="small muted" style="line-height:1.5">Each lesson ends with a check. Exercises run in a sandbox on your phone, so they work on a poor connection. Prompt work is graded by an AI against a rubric.</div>
    </main>`;
  });

  route('/learn/certificates', { auth: true, tabs: '' }, async () => {
    const { certificates } = await api.myCertificates();
    return `${topbar('My certificates', '/learn')}<main class="pad stack" style="gap:10px">
      ${certificates.length ? certificates.map((c) => `<a class="card row" href="#/learn/${c.course}/certificate" style="padding:14px;gap:12px"><span style="width:44px;height:44px;border-radius:12px;background:var(--night);color:#7ED957;display:flex;align-items:center;justify-content:center">${icon('award')}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:700">${h(c.title)}</span><span class="small muted">${c.score}% · ${c.at.slice(0, 10)} · ${h(c.code)}</span></span>${icon('chevron-right')}</a>`).join('') : `<div class="placeholder" style="padding:50px 0"><div class="mi card">${icon('award')}</div><div class="h-md">No certificates yet</div><div class="small muted">Finish every lesson in a course and it appears here.</div></div>`}
    </main>`;
  });

  /* ---------------------------------- Course page ---------------------------------- */
  route('/learn/:slug', { auth: true, tabs: '' }, async ({ slug }) => {
    if (slug === 'certificates') return '';
    const { course: c, lessons } = await api.learnCourse(slug);
    if (c.after && !c.afterDone) return `${topbar('', '/learn')}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('lock')}</div><div class="h-md">${h(c.title)}</div><div class="small muted" style="max-width:290px;line-height:1.5">This is the ${h(c.level.toLowerCase())} tier. Earn the certificate for ${h(c.afterTitle)} first; everything here builds on it.</div><a class="btn btn-ink" href="#/learn/${c.after}" style="width:auto">Go to ${h(c.afterTitle)}</a></div>`;
    return `${topbar('', '/learn')}
    <div style="margin:0 16px;border-radius:18px;overflow:hidden;height:170px;background:url('${c.thumb}') center/cover"></div>
    <main class="pad stack" style="gap:14px">
      <div><span class="tag" style="background:${c.color}1a;color:${c.color}">${h(TRACK[c.track])} · ${h(c.level)}</span><div class="h-lg" style="font-size:22px;margin-top:8px">${h(c.title)}</div><div class="small" style="color:var(--ink-2);line-height:1.5;margin-top:6px">${h(c.blurb)}</div></div>
      <div class="card stack" style="padding:14px;gap:8px"><div class="section" style="margin:0">YOU WILL BE ABLE TO</div>${c.outcomes.map((o) => `<div class="row small" style="gap:8px;align-items:flex-start"><span style="color:var(--green-dark);flex-shrink:0;margin-top:2px">${icon('circle-check')}</span><span>${h(o)}</span></div>`).join('')}</div>
      ${c.certificate ? `<a class="btn btn-ink" href="#/learn/${c.slug}/certificate">${icon('award')} View your certificate</a>` : `<a class="btn btn-primary" href="#/learn/${c.slug}/${c.next}" style="background:${c.color}">${c.done ? 'Continue: ' + h(lessons[c.next].title) : 'Start the first lesson'}</a>`}
      <div class="row" style="gap:10px"><div class="grow"><div style="height:6px;border-radius:3px;background:var(--surface)"><div style="height:6px;border-radius:3px;background:${c.color};width:${c.pct}%"></div></div></div><span class="small muted">${c.done}/${c.lessons} · ${c.minutes} min</span></div>
      <div class="card list">${lessons.map((l) => `<a class="item" href="${l.locked ? '#' : '#/learn/' + c.slug + '/' + l.index}" style="${l.locked ? 'opacity:.5' : ''}"><div class="mi" style="${l.done ? 'background:var(--green-tint);color:var(--green-dark)' : ''}">${icon(l.done ? 'circle-check' : l.locked ? 'lock' : KIND[l.kind][0])}</div><div class="grow"><div class="t">${l.index + 1}. ${h(l.title)}</div><div class="s">${KIND[l.kind][1]} · ${l.minutes} min${l.done && l.score != null ? ' · ' + l.score + '%' : ''}</div></div>${l.locked ? '' : icon('chevron-right')}</a>`).join('')}</div>
    </main>`;
  });

  /* ---------------------------------- Certificate ---------------------------------- */
  route('/learn/:slug/certificate', { auth: true, tabs: '' }, async ({ slug }) => {
    let c; try { c = (await api.learnCertificate(slug)).certificate; } catch (err) { return `${topbar('Certificate', '/learn/' + slug)}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('lock')}</div><div class="h-md">${h((err && err.message) || 'Not yet')}</div><a class="btn btn-ink" href="#/learn/${slug}" style="width:auto">Back to the course</a></div>`; }
    return `${topbar('Your certificate', '/learn/' + slug)}
    <main class="pad stack" style="gap:12px">
      <div id="certwrap" style="border-radius:14px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.18);background:#fff"><canvas id="cert" style="width:100%;display:block"></canvas></div>
      <div class="small muted" id="certnote" style="text-align:center">Drawing…</div>
      <div class="row" style="gap:8px"><button class="btn btn-primary grow" id="dlpng">${icon('file-arrow-up')} Download image</button><button class="btn btn-ink grow" id="dlpdf">${icon('file-arrow-up')} Download PDF</button></div>
      <button class="btn btn-outline" id="share">${icon('paper-plane')} Share the verification link</button>
      <div class="card stack" style="padding:14px;gap:6px"><div class="row small"><span class="muted">Certificate code</span><span class="grow"></span><strong style="letter-spacing:2px">${h(c.code)}</strong></div><div class="row small"><span class="muted">Issued</span><span class="grow"></span><strong>${h(c.issuedAt.slice(0, 10))}</strong></div><div class="row small"><span class="muted">Score</span><span class="grow"></span><strong>${c.score}%</strong></div><div class="small muted" style="line-height:1.5;margin-top:4px">Anyone can scan the QR code or open <code style="font-size:11px">${h(c.verifyUrl)}</code> to confirm this certificate is real and belongs to you.</div></div>
    </main>`;
  }, {
    async mount(el, { slug }) {
      let c; try { c = (await api.learnCertificate(slug)).certificate; } catch { return; }
      const canvas = el.querySelector('#cert'); if (!canvas) return;
      try { await loadScript('/js/vendor/qrcode.js'); } catch {}
      await drawCertificate(canvas, c);
      el.querySelector('#certnote').textContent = 'Tap and hold the image to save it, or use the buttons.';
      const file = `Buja-certificate-${c.code}`;
      el.querySelector('#dlpng').addEventListener('click', () => { canvas.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png'); });
      el.querySelector('#dlpdf').addEventListener('click', async (e) => {
        const pdfBtn = e.currentTarget; busy(pdfBtn, true);
        try { await loadScript('/js/vendor/jspdf.umd.min.js'); const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210); pdf.setProperties({ title: 'Buja Learn certificate ' + c.code, subject: c.course, author: 'Buja Learn' }); pdf.save(file + '.pdf'); }
        catch (err) { toast('Could not build the PDF. The image download works offline.'); }
        busy(pdfBtn, false);
      });
      el.querySelector('#share').addEventListener('click', () => { const t = `${c.holder} completed ${c.course} on Buja Learn. Verify: ${c.verifyUrl}`; if (navigator.share) navigator.share({ title: 'Buja Learn certificate', text: t }).catch(() => {}); else { navigator.clipboard?.writeText(t); toast('Copied'); } });
    }
  });

  /* ---------------------------------- Public verification ---------------------------------- */
  route('/cert/:code', { tabs: '' }, async ({ code }) => {
    let d; try { d = await api.verifyCertificate(code); } catch (err) { d = { valid: false, message: (err && err.message) || 'Not found' }; }
    if (!d.valid && !d.code) return `${topbar('Verify a certificate', state.user ? '/learn' : '/welcome')}<div class="placeholder" style="padding:60px 20px"><div class="mi card" style="color:#D92D20">${icon('triangle-exclamation')}</div><div class="h-md">Not a Buja certificate</div><div class="small muted" style="max-width:280px;line-height:1.5">${h(d.message || 'No certificate with this code was issued by Buja Learn.')}</div></div>`;
    return `${topbar('Verify a certificate', state.user ? '/learn' : '/welcome')}
    <main class="pad stack" style="gap:12px">
      <div class="card stack" style="padding:18px;gap:12px;border:2px solid ${d.valid ? 'var(--green)' : '#D92D20'}">
        <div class="row" style="gap:12px"><span style="width:48px;height:48px;border-radius:14px;background:${d.valid ? 'var(--green-tint)' : '#FDECEA'};color:${d.valid ? 'var(--green-dark)' : '#D92D20'};display:flex;align-items:center;justify-content:center;font-size:20px">${icon(d.valid ? 'circle-check' : 'triangle-exclamation')}</span><div><div class="h-md">${d.valid ? 'Verified' : 'Revoked'}</div><div class="small muted">Issued by Buja Learn, Abuja</div></div></div>
        <div><div class="small muted">Awarded to</div><div style="font-size:20px;font-weight:700">${h(d.holder)}</div></div>
        <div><div class="small muted">For completing</div><div style="font-size:16px;font-weight:650">${h(d.course)}</div><div class="small muted">${d.lessons} lessons · about ${d.hours} hours · final score ${d.score}%</div></div>
        <div class="row small"><span class="muted">Issued</span><span class="grow"></span><strong>${h(d.issuedAt.slice(0, 10))}</strong></div>
        <div class="row small"><span class="muted">Code</span><span class="grow"></span><strong style="letter-spacing:2px">${h(d.code)}</strong></div>
      </div>
      ${d.outcomes && d.outcomes.length ? `<div class="card stack" style="padding:14px;gap:6px"><div class="section" style="margin:0">WHAT THIS COURSE COVERS</div>${d.outcomes.map((o) => `<div class="small" style="color:var(--ink-2)">• ${h(o)}</div>`).join('')}</div>` : ''}
      <div class="small muted" style="line-height:1.5">This page is served by Buja and cannot be edited by the certificate holder. If the details above do not match the document you were shown, treat it as a forgery.</div>
      ${state.user ? '' : `<a class="btn btn-outline" href="#/welcome">What is Buja?</a>`}
    </main>`;
  });

  /* ---------------------------------- Lesson ---------------------------------- */
  route('/learn/:slug/:n', { auth: true, tabs: '' }, async ({ slug, n }) => {
    if (n === 'certificate' || slug === 'certificates') return '';
    let l; try { l = (await api.learnLesson(slug, n)).lesson; } catch (err) { return `${topbar('', '/learn/' + slug)}<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('lock')}</div><div class="h-md">${h((err && err.message) || 'Locked')}</div><a class="btn btn-ink" href="#/learn/${slug}" style="width:auto">Back to the course</a></div>`; }
    const pct = Math.round((l.index) / l.total * 100);
    return `${topbar('', '/learn/' + slug, `<span class="small muted" style="white-space:nowrap">${l.index + 1} / ${l.total}</span>`)}
    <div style="margin:0 16px;height:4px;border-radius:2px;background:var(--surface)"><div style="height:4px;border-radius:2px;background:${l.color};width:${pct}%"></div></div>
    <main class="pad stack" style="gap:14px">
      <div><span class="tag" style="background:${l.color}1a;color:${l.color}">${KIND[l.kind][1]} · ${l.minutes} min</span><div class="h-lg" style="font-size:22px;margin-top:8px;line-height:1.25">${h(l.title)}</div></div>
      <div class="lesson" style="font-size:15px;line-height:1.65;color:var(--ink-2)">${l.body}</div>
      ${l.kind === 'code' ? `
        <div class="card" style="padding:0;overflow:hidden;background:#101014">
          <div class="row" style="padding:8px 12px;gap:8px;background:#16161B;color:#B5B5BC;font-size:12px"><span>${l.lang === 'html' ? 'index.html' : 'script.js'}</span><span class="grow"></span><button class="btn btn-sm" id="reset" style="width:auto;height:28px;font-size:11px;background:transparent;color:#B5B5BC;border:1px solid #2A2F3A">Reset</button><button class="btn btn-sm" id="run" style="width:auto;height:28px;font-size:12px;background:#7ED957;color:#101014;border:none">${icon('play')} Run</button></div>
          <textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" style="width:100%;min-height:260px;background:#101014;color:#E8E8EC;border:none;padding:12px;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical;outline:none;tab-size:2">${h(l.starter || '')}</textarea>
        </div>
        ${l.lang === 'html' ? `<div class="card" style="padding:0;overflow:hidden"><div class="small muted" style="padding:6px 12px;background:var(--surface)">Preview</div><iframe id="preview" sandbox="allow-scripts allow-forms" style="width:100%;height:220px;border:none;background:#fff"></iframe></div>` : `<div class="card" style="padding:10px 12px;background:#16161B;color:#B5B5BC;font:12px/1.5 ui-monospace,monospace;min-height:44px;white-space:pre-wrap" id="console">Console output appears here.</div>`}
        <div class="card stack" style="padding:12px 14px;gap:6px" id="tests"><div class="small muted">Run your code to check it against ${(l.tests || []).length} tests.</div></div>`
      : l.kind === 'prompt' ? `
        <div class="card stack" style="padding:14px;gap:8px"><div class="section" style="margin:0">THE RUBRIC</div>${(l.rubric || []).map((r) => `<div class="row small" style="gap:8px;align-items:flex-start"><span style="color:var(--ink-3);flex-shrink:0">○</span><span>${h(r)}</span></div>`).join('')}</div>
        <textarea id="prompt" spellcheck="true" style="width:100%;min-height:240px;padding:14px;border:1px solid var(--line);border-radius:14px;font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;outline:none;background:var(--card);color:var(--ink)" placeholder="Write the prompt exactly as you would give it to the model.">${h(l.starter || '')}</textarea>
        <div id="grade"></div>`
      : ''}
      ${l.check ? `<div class="card stack" style="padding:14px;gap:14px" id="quiz"><div class="section" style="margin:0">CHECK YOUR UNDERSTANDING</div>${l.check.map((q, qi) => `<div class="stack" style="gap:8px" data-q="${qi}"><div style="font-size:14px;font-weight:650;line-height:1.4">${qi + 1}. ${h(q.q)}</div>${q.options.map((o, oi) => `<button type="button" class="opt" data-o="${oi}" style="text-align:left;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);font-size:14px;color:var(--ink)">${h(o)}</button>`).join('')}<div class="small" data-why style="display:none;line-height:1.45"></div></div>`).join('')}</div>` : ''}
      <div id="result"></div>
      <div class="row" style="gap:8px">
        ${l.index > 0 ? `<a class="btn btn-outline" href="#/learn/${slug}/${l.index - 1}" style="width:auto">${icon('arrow-left')}</a>` : ''}
        <button class="btn btn-primary grow" id="next" style="background:${l.color}" ${l.done || (l.kind === 'read' && !l.check) ? '' : 'disabled'}>${l.done ? (l.nextTitle ? 'Next: ' + h(l.nextTitle) : 'Finish the course') : (l.kind === 'code' ? 'Pass the tests to continue' : l.kind === 'prompt' ? 'Submit for grading' : 'Answer to continue')}</button>
      </div>
      <style>.lesson p{margin:0 0 12px}.lesson ul,.lesson ol{margin:0 0 12px;padding-left:20px}.lesson li{margin:4px 0}.lesson pre{background:#101014;color:#E8E8EC;padding:12px;border-radius:12px;overflow-x:auto;font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 12px}.lesson code{background:var(--surface);padding:1px 5px;border-radius:5px;font:.92em ui-monospace,monospace}.lesson pre code{background:none;padding:0}.opt{position:relative;padding-right:44px !important;transition:all .12s}.opt.on{border-color:var(--orange);border-width:2px;background:var(--orange-tint);font-weight:700}.opt.on::after{content:'✓';position:absolute;right:12px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:12px;background:var(--orange);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center}.opt.right{border-color:var(--green);background:var(--green-tint)}.opt.wrong{border-color:#D92D20;background:#FDECEA}</style>
    </main>`;
  }, {
    async mount(el, { slug, n }) {
      if (n === 'certificate' || slug === 'certificates') return;
      let l; try { l = (await api.learnLesson(slug, n)).lesson; } catch { return; }
      const next = el.querySelector('#next'); let passed = l.done; const answers = {};
      const finish = async (extra = {}) => {
        busy(next, true);
        try {
          const r = await api.learnComplete(slug, n, { answers, ...extra });
          if (!r.passed) { busy(next, false); showResult(el, r, false); if (r.detail && l.check) paintQuiz(el, r.detail); return; }
          showResult(el, r, true); if (r.detail && l.check) paintQuiz(el, r.detail);
          if (r.finished && r.certificate) { toast('Course complete. Your certificate is ready.'); setTimeout(() => go('/learn/' + slug + '/certificate'), 1200); return; }
          next.disabled = false; busy(next, false); next.textContent = r.next != null ? 'Next: ' + (l.nextTitle || 'lesson ' + (r.next + 1)) : 'Back to the course'; next.onclick = () => go(r.next != null ? '/learn/' + slug + '/' + r.next : '/learn/' + slug);
        } catch (err) { busy(next, false); failed(el, err); }
      };
      // Quiz
      if (l.check) {
        const total = l.check.length;
        el.querySelector('#quiz').addEventListener('click', (e) => {
          const o = e.target.closest('.opt'); if (!o) return;
          const qb = o.closest('[data-q]'); qb.querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === o));
          answers[qb.dataset.q] = +o.dataset.o;
          const n = Object.keys(answers).length;
          if (passed) return;
          if (n >= total) { next.disabled = false; next.textContent = 'Check my answers'; }
          else next.textContent = `${n} of ${total} answered`;
        });
        if (!passed) next.onclick = () => finish();
      }
      // Read without a check
      if (l.kind === 'read' && !l.check && !passed) next.onclick = () => finish();
      // Code
      if (l.kind === 'code') {
        const ta = el.querySelector('#code'); let saveT = null;
        ta.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; } });
        ta.addEventListener('input', () => { clearTimeout(saveT); saveT = setTimeout(() => api.learnSave(slug, n, ta.value).catch(() => {}), 1200); });
        el.querySelector('#reset').addEventListener('click', async () => { if (!confirm('Reset to the starter code?')) return; const fresh = (await api.learnLesson(slug, n)).lesson; ta.value = l.starterOriginal || fresh.starter || ''; });
        el.querySelector('#run').addEventListener('click', async (e) => {
          const runBtn = e.currentTarget; busy(runBtn, true);
          const r = await runInSandbox(el, l, ta.value);
          busy(runBtn, false);
          const box = el.querySelector('#tests');
          box.innerHTML = r.results.map((t) => `<div class="row small" style="gap:8px;align-items:flex-start"><span style="color:${t.ok ? 'var(--green-dark)' : '#D92D20'};flex-shrink:0">${icon(t.ok ? 'circle-check' : 'xmark')}</span><span>${h(t.msg)}${t.err ? ` <span class="muted">(${h(t.err)})</span>` : ''}</span></div>`).join('') + (r.results.every((t) => t.ok) ? `<div class="small" style="color:var(--green-dark);font-weight:700;margin-top:4px">All ${r.results.length} tests pass.</div>` : `<div class="small muted" style="margin-top:4px">${r.results.filter((t) => t.ok).length} of ${r.results.length} passing.</div>`);
          if (r.results.every((t) => t.ok) && !passed) { next.disabled = false; next.textContent = 'Continue'; next.onclick = () => finish({ passed: true, code: ta.value }); }
        });
      }
      // Prompt
      if (l.kind === 'prompt') {
        const ta = el.querySelector('#prompt');
        ta.addEventListener('input', () => { if (ta.value.trim().length >= 60 && !passed) next.disabled = false; });
        if (ta.value.trim().length >= 60 && !passed) next.disabled = false;
        if (!passed) next.onclick = () => finish({ prompt: ta.value });
      }
      if (passed) next.onclick = () => go(l.nextTitle ? '/learn/' + slug + '/' + (l.index + 1) : '/learn/' + slug);
    }
  });

  function showResult(el, r, ok) {
    const box = el.querySelector('#result');
    box.innerHTML = `<div class="card stack" style="padding:14px;gap:8px;border-color:${ok ? 'var(--green)' : '#D92D20'}">
      <div style="font-size:15px;font-weight:700;color:${ok ? 'var(--green-dark)' : '#D92D20'}">${ok ? (r.score != null ? 'Passed, ' + r.score + '%' : 'Passed') : h(r.message || 'Not yet')}</div>
      ${r.feedback ? `<div class="small" style="line-height:1.5;color:var(--ink-2)">${h(r.feedback)}</div>` : ''}
      ${r.detail && r.detail[0] && r.detail[0].item ? r.detail.map((d) => `<div class="row small" style="gap:8px;align-items:flex-start"><span style="color:${d.ok === true ? 'var(--green-dark)' : d.ok === false ? '#D92D20' : 'var(--ink-3)'};flex-shrink:0">${icon(d.ok === true ? 'circle-check' : d.ok === false ? 'xmark' : 'circle-info')}</span><span>${h(d.item)}${d.note ? ` <span class="muted">${h(d.note)}</span>` : ''}</span></div>`).join('') : ''}
    </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function paintQuiz(el, detail) {
    el.querySelectorAll('#quiz [data-q]').forEach((qb, i) => { const d = detail[i]; if (!d) return; qb.querySelectorAll('.opt').forEach((o) => { o.classList.remove('right', 'wrong'); if (+o.dataset.o === d.answer) o.classList.add('right'); else if (o.classList.contains('on') && !d.ok) o.classList.add('wrong'); }); const why = qb.querySelector('[data-why]'); why.style.display = ''; why.style.color = d.ok ? 'var(--green-dark)' : '#D92D20'; why.textContent = (d.ok ? 'Right. ' : 'Not quite. ') + d.why; });
  }

  /* ---------------------------------- Sandbox runner ---------------------------------- */
  function runInSandbox(el, l, code) {
    return new Promise((resolve) => {
      const id = 'run' + Date.now();
      const tests = JSON.stringify(l.tests || []).replace(/<\//g, '<\\/');
      const harness = `<script>(async () => {
        const T = ${tests}; const out = []; const q = (s) => document.querySelector(s); const qa = (s) => document.querySelectorAll(s);
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        for (const t of T) {
          let ok = false, err = '';
          try {
            if (t.expr) { ok = !!(await new AsyncFunction('return (' + t.expr + ')')()); }
            else {
              if (t.type) { const i = q(t.type); if (i) { i.value = t.value; i.dispatchEvent(new Event('input', { bubbles: true })); } }
              if (t.submit) { const f = q(t.submit); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
              if (t.wait) await sleep(t.wait);
              if (t.click) { const times = t.clicks || 1; for (let k = 0; k < times; k++) { const b = q(t.click); if (b) b.click(); } }
              if (t.wait2) await sleep(t.wait2);
              if (t.src) ok = ${JSON.stringify(code).replace(/<\//g, '<\\/')}.toLowerCase().includes(t.src.toLowerCase());
              else if (t.css) { const n = q(t.css); if (!n) err = 'no element matches ' + t.css; else { const v = getComputedStyle(n)[t.prop]; if (t.is != null) ok = String(v) === String(t.is); else if (t.not != null) ok = String(v) !== String(t.not); else if (t.min != null) ok = parseFloat(v) >= t.min; if (!ok && !err) err = t.prop + ' is ' + v; } }
              else if (t.sel) { const nodes = qa(t.sel); if (t.count != null) { ok = t.exact ? nodes.length === t.count : nodes.length >= t.count; if (!ok) err = 'found ' + nodes.length; } else if (t.text != null) { ok = nodes.length > 0 && (nodes[0].textContent || '').trim().toLowerCase().includes(String(t.text).toLowerCase()); if (!ok) err = nodes.length ? 'text is "' + (nodes[0].textContent || '').trim().slice(0, 30) + '"' : 'no element matches'; } else if (t.valueIs != null) { ok = nodes.length > 0 && nodes[0].value === t.valueIs; } else { ok = nodes.length > 0; if (!ok) err = 'no element matches ' + t.sel; } }
            }
          } catch (e) { err = String(e && e.message || e).slice(0, 80); }
          out.push({ msg: t.msg, ok, err });
        }
        parent.postMessage({ id: '${id}', results: out, log: (window.__log || []).join('\\n') }, '*');
      })();<\/script>`;
      const logger = `<script>window.__log = []; const __c = console.log; console.log = (...a) => { window.__log.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); __c(...a); }; window.onerror = (m) => { window.__log.push('Error: ' + m); };<\/script>`;
      const setup = l.setup ? `<script>${l.setup}<\/script>` : '';
      let doc;
      if (l.lang === 'html') doc = `<!doctype html><html><head><meta charset="utf-8">${logger}${setup}</head><body>${code}${harness}</body></html>`;
      else doc = `<!doctype html><html><head><meta charset="utf-8">${logger}${setup}</head><body><script>\n${code}\n<\/script>${harness}</body></html>`;
      let frame = el.querySelector('#preview');
      const temp = !frame;
      if (temp) { frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts allow-forms'); frame.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none'; document.body.appendChild(frame); }
      const timer = setTimeout(() => { done({ results: (l.tests || []).map((t) => ({ msg: t.msg, ok: false, err: 'timed out; is there an infinite loop?' })), log: '' }); }, 6000);
      const onMsg = (e) => { if (e.data && e.data.id === id) done(e.data); };
      const done = (d) => { clearTimeout(timer); window.removeEventListener('message', onMsg); if (temp) frame.remove(); const c = el.querySelector('#console'); if (c) c.textContent = d.log || 'No output.'; resolve(d); };
      window.addEventListener('message', onMsg);
      frame.srcdoc = doc;
    });
  }

  function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  /* ---------------------------------- Certificate drawing ---------------------------------- */
  async function drawCertificate(canvas, c) {
    const W = 1754, H = 1240; // A4 landscape at 150 dpi
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    // paper
    g.fillStyle = '#FBF9F4'; g.fillRect(0, 0, W, H);
    // subtle texture lines
    g.strokeStyle = 'rgba(0,0,0,0.025)'; g.lineWidth = 1; for (let y = 0; y < H; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // night band on the left
    const band = 420; const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#16161B'); grad.addColorStop(1, '#0B0B0E');
    g.fillStyle = grad; g.fillRect(0, 0, band, H);
    // brand stripe
    const stripe = g.createLinearGradient(band, 0, band, H); stripe.addColorStop(0, '#7ED957'); stripe.addColorStop(1, '#FF7A1A');
    g.fillStyle = stripe; g.fillRect(band, 0, 10, H);
    // gold frame
    g.strokeStyle = '#C9A94B'; g.lineWidth = 3; g.strokeRect(band + 60, 60, W - band - 120, H - 120);
    g.strokeStyle = 'rgba(201,169,75,0.45)'; g.lineWidth = 1; g.strokeRect(band + 72, 72, W - band - 144, H - 144);
    // logo
    try { const img = new Image(); img.src = '/assets/icons/mark-dark.svg'; await new Promise((r) => { img.onload = r; img.onerror = r; }); if (img.width) { const s = 200 / img.width; g.drawImage(img, (band - 200) / 2, 110, 200, img.height * s); } } catch {}
    g.fillStyle = '#FFFFFF'; g.font = '700 46px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Buja', band / 2, 420);
    g.fillStyle = '#7ED957'; g.font = '600 20px Inter, system-ui, sans-serif'; g.letterSpacing = '6px'; g.fillText('L E A R N', band / 2, 458);
    g.fillStyle = '#9AA0AB'; g.font = '400 18px Inter, system-ui, sans-serif'; g.letterSpacing = '0px';
    wrap(g, 'Free, verifiable courses for people who build things in Abuja.', band / 2, 520, band - 80, 26);
    // track badge
    g.fillStyle = c.color || '#FF7A1A'; roundRect(g, band / 2 - 120, H - 300, 240, 44, 22); g.fill();
    g.fillStyle = '#101014'; g.font = '700 18px Inter, system-ui, sans-serif'; g.fillText((TRACK[c.track] || c.track).toUpperCase(), band / 2, H - 271);
    g.fillStyle = '#6B6B73'; g.font = '400 16px Inter, system-ui, sans-serif'; g.fillText(c.lessons + ' lessons · ' + c.hours + ' hours', band / 2, H - 230);
    g.fillText('buja.onrender.com', band / 2, H - 130);
    // main text
    const cx = band + (W - band) / 2;
    g.textAlign = 'center';
    g.fillStyle = '#8A7A45'; g.font = '600 22px Inter, system-ui, sans-serif'; g.letterSpacing = '8px'; g.fillText('CERTIFICATE OF COMPLETION', cx, 190); g.letterSpacing = '0px';
    g.fillStyle = '#6B6B73'; g.font = '400 24px Georgia, "Times New Roman", serif'; g.fillText('This certifies that', cx, 300);
    g.fillStyle = '#1B1B1F'; g.font = 'italic 700 ' + fitSize(g, c.holder, W - band - 240, 96, 56, 'italic 700 %spx Georgia, "Times New Roman", serif') + 'px Georgia, "Times New Roman", serif'; g.fillText(c.holder, cx, 420);
    g.strokeStyle = '#C9A94B'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 260, 452); g.lineTo(cx + 260, 452); g.stroke();
    g.fillStyle = '#6B6B73'; g.font = '400 24px Georgia, "Times New Roman", serif'; g.fillText('has successfully completed the course', cx, 530);
    g.fillStyle = '#1B1B1F'; g.font = '700 ' + fitSize(g, c.course, W - band - 260, 56, 36, '700 %spx Inter, system-ui, sans-serif') + 'px Inter, system-ui, sans-serif'; g.fillText(c.course, cx, 610);
    g.fillStyle = '#6B6B73'; g.font = '400 22px Inter, system-ui, sans-serif';
    g.fillText('with a final score of ' + c.score + '%, having passed every lesson, exercise and assessment.', cx, 670);
    // date + code
    const d = new Date(c.issuedAt.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    g.textAlign = 'left'; g.fillStyle = '#9AA0AB'; g.font = '600 14px Inter, system-ui, sans-serif'; g.letterSpacing = '3px';
    g.fillText('ISSUED', band + 130, 880); g.fillText('CERTIFICATE NO.', band + 130, 980);
    g.letterSpacing = '0px'; g.fillStyle = '#1B1B1F'; g.font = '600 26px Inter, system-ui, sans-serif'; g.fillText(d, band + 130, 916); g.font = '700 26px ui-monospace, Menlo, Consolas, monospace'; g.letterSpacing = '4px'; g.fillText(c.code, band + 130, 1016); g.letterSpacing = '0px';
    // signature
    g.textAlign = 'center'; const sx = cx + 40;
    g.fillStyle = '#1B1B1F'; g.font = 'italic 400 40px Georgia, "Times New Roman", serif'; g.fillText('Buja Learn', sx, 960);
    g.strokeStyle = '#1B1B1F'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx - 170, 980); g.lineTo(sx + 170, 980); g.stroke();
    g.fillStyle = '#9AA0AB'; g.font = '600 14px Inter, system-ui, sans-serif'; g.letterSpacing = '3px'; g.fillText('ISSUING AUTHORITY, ABUJA', sx, 1008); g.letterSpacing = '0px';
    // QR
    try {
      const qr = window.qrcode(0, 'M'); qr.addData(c.verifyUrl); qr.make();
      const size = 210, n = qr.getModuleCount(), cell = size / n, qx = W - 60 - 40 - size, qy = H - 60 - 40 - size - 30;
      g.fillStyle = '#FFFFFF'; roundRect(g, qx - 14, qy - 14, size + 28, size + 28, 12); g.fill(); g.strokeStyle = '#E5E5DF'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#101014'; for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) g.fillRect(qx + col * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
      g.fillStyle = '#6B6B73'; g.font = '600 13px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('SCAN TO VERIFY', qx + size / 2, qy + size + 34);
    } catch {}
    // watermark seal
    g.save(); g.translate(W - 210, 200); g.rotate(-0.2); g.strokeStyle = 'rgba(201,169,75,0.55)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(201,169,75,0.9)'; g.font = '700 14px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('VERIFIED', 0, -6); g.font = '600 11px Inter, system-ui, sans-serif'; g.fillText('BUJA LEARN', 0, 14); g.restore();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, x, y, maxW, lh) { const words = text.split(' '); let line = ''; for (const w of words) { const t = line + w + ' '; if (g.measureText(t).width > maxW && line) { g.fillText(line.trim(), x, y); line = w + ' '; y += lh; } else line = t; } g.fillText(line.trim(), x, y); }
  function fitSize(g, text, maxW, start, min, tpl) { for (let s = start; s >= min; s -= 2) { g.font = tpl.replace('%s', s); if (g.measureText(text).width <= maxW) return s; } return min; }
}
