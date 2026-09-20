// Buja calls: video and audio, held inside the app. Registered by app.js.
export function registerCall({ route, go, state, api, ui, failed }) {
  const { h, toast, icon, busy } = ui;
  const DOMAIN_SCRIPT = (d) => `https://${d}/external_api.js`;
  let api_ = null; // the Jitsi instance

  function loadJitsi(domain) {
    if (window.JitsiMeetExternalAPI) return Promise.resolve(true);
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = DOMAIN_SCRIPT(domain); s.async = true;
      s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
      setTimeout(() => res(!!window.JitsiMeetExternalAPI), 12000);
    });
  }

  route('/call/:room', { auth: true, tabs: '' }, async ({ room }) => {
    let c;
    try { c = (await api.call(room)).call; }
    catch (err) {
      const msg = (err && err.message) || 'That call could not be opened.';
      return `<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('triangle-exclamation')}</div><div class="h-md">${h(msg)}</div><a class="btn btn-ink" href="#/inbox" style="width:auto">Back to inbox</a></div>`;
    }
    return `
    <div style="position:fixed;inset:0;background:#101014;display:flex;flex-direction:column;z-index:60">
      <div class="row" style="padding:calc(10px + var(--safe-t)) 16px 10px;gap:12px;color:#fff;flex-shrink:0">
        <button class="iconbtn" id="leave" aria-label="Leave call" style="background:rgba(255,255,255,.12);border:none;color:#fff;width:38px;height:38px">${icon('chevron-left')}</button>
        <div class="grow" style="min-width:0"><div style="font-size:15px;font-weight:700">${c.kind === 'interview' ? 'Interview' : 'Call'} with ${h(c.with)}</div><div class="small" style="color:#B5B5BC" id="status">Connecting…</div></div>
        <span class="tag" style="background:rgba(255,255,255,.12);color:#fff">${c.mode === 'audio' ? 'Audio' : 'Video'}</span>
      </div>
      <div id="stage" class="grow" style="position:relative;background:#101014"></div>
      <div class="row" style="padding:12px 16px calc(12px + var(--safe-b));gap:10px;flex-shrink:0">
        <button class="btn btn-outline grow" id="hangup" style="background:#D92D20;border-color:#D92D20;color:#fff">${icon('xmark')} End call</button>
      </div>
    </div>`;
  }, {
    async mount(el, { room }) {
      const stage = el.querySelector('#stage'); if (!stage) return;
      const status = el.querySelector('#status');
      let c; try { c = (await api.call(room)).call; } catch { return; }
      const ok = await loadJitsi(c.domain);
      if (!ok) { status.textContent = 'Could not reach the call service'; stage.innerHTML = `<div class="placeholder" style="height:100%;color:#B5B5BC;padding:24px;text-align:center"><div class="small">Buja could not load the call. Check your connection and try again.</div></div>`; return; }
      api_ = new window.JitsiMeetExternalAPI(c.domain, {
        roomName: c.room,
        parentNode: stage,
        width: '100%', height: '100%',
        userInfo: { displayName: c.me },
        configOverwrite: {
          startWithVideoMuted: c.mode === 'audio',
          prejoinPageEnabled: false,
          disableDeepLinking: true,      // keep people in Buja rather than bouncing to the Jitsi app
          disableInviteFunctions: true,
          enableClosePage: false,
          toolbarButtons: c.mode === 'audio'
            ? ['microphone', 'hangup', 'tileview', 'settings', 'raisehand', 'chat']
            : ['microphone', 'camera', 'hangup', 'tileview', 'settings', 'raisehand', 'chat', 'desktop'],
        },
        interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false, SHOW_BRAND_WATERMARK: false, HIDE_INVITE_MORE_HEADER: true, DISABLE_JOIN_LEAVE_NOTIFICATIONS: false },
      });
      api_.addListener('videoConferenceJoined', () => { status.textContent = 'Connected. Waiting for ' + c.with + '…'; });
      api_.addListener('participantJoined', () => { status.textContent = c.with + ' joined'; });
      api_.addListener('participantLeft', () => { status.textContent = c.with + ' left the call'; });
      api_.addListener('readyToClose', () => leave(c));
      const leave = async (call) => {
        try { api_?.dispose(); } catch {} api_ = null;
        try { await api.endCall(room); } catch {}
        go('/inbox/' + call.threadId);
      };
      el.querySelector('#hangup').addEventListener('click', () => leave(c));
      el.querySelector('#leave').addEventListener('click', () => { try { api_?.dispose(); } catch {} api_ = null; go('/inbox/' + c.threadId); });
      window.addEventListener('hashchange', () => { try { api_?.dispose(); } catch {} api_ = null; }, { once: true });
    }
  });
}
