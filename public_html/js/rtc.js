// Buja chat calls: the two phones connect directly. Buja only passes the handshake, and never sees the
// audio or video. Registered by app.js.
export function registerRtc({ route, go, state, api, ui, failed }) {
  const { h, toast, icon } = ui;

  route('/rtc/:room', { auth: true, tabs: '' }, async ({ room }) => {
    let c;
    try { c = (await api.call(room)).call; }
    catch (err) { return `<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('phone-slash')}</div><div class="h-md">${h((err && err.message) || 'That call could not be opened')}</div><a class="btn btn-ink" href="#/inbox" style="width:auto">Back to inbox</a></div>`; }
    const video = c.mode !== 'audio';
    const initial = h((c.with || '?')[0].toUpperCase());
    return `
    <div id="callui" style="position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 0%, #1E2430 0%, #0B0B0E 60%);color:#fff;z-index:70;overflow:hidden">
      <video id="remote" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent;opacity:0;transition:opacity .4s"></video>

      <div id="face" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;transition:opacity .4s">
        <div id="pulse" style="width:132px;height:132px;border-radius:66px;background:linear-gradient(145deg,#7ED957,#FF7A1A);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:#101014;box-shadow:0 0 0 0 rgba(126,217,87,.45)">${initial}</div>
        <div style="text-align:center"><div style="font-size:24px;font-weight:700">${h(c.with)}</div><div class="small" id="sub" style="color:#9AA0AB;margin-top:4px">${c.kind === 'interview' ? 'Interview on Buja' : 'Buja call'}</div></div>
      </div>

      <video id="local" autoplay playsinline muted style="position:absolute;right:14px;top:calc(14px + var(--safe-t));width:98px;height:134px;object-fit:cover;border-radius:16px;border:2px solid rgba(255,255,255,.28);background:#000;display:none;box-shadow:0 8px 24px rgba(0,0,0,.4)"></video>

      <div style="position:absolute;left:0;right:0;top:0;padding:calc(18px + var(--safe-t)) 20px 30px;background:linear-gradient(180deg,rgba(0,0,0,.55),transparent);display:flex;align-items:center;gap:12px">
        <button id="back" aria-label="Back" style="width:36px;height:36px;border-radius:18px;border:none;background:rgba(255,255,255,.14);color:#fff">${icon('chevron-left')}</button>
        <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(c.with)}</div><div class="small" id="state" style="color:#C9C9D1">${c.caller ? 'Ringing…' : 'Connecting…'}</div></div>
      </div>

      <div style="position:absolute;left:0;right:0;bottom:0;padding:26px 18px calc(28px + var(--safe-b));background:linear-gradient(0deg,rgba(0,0,0,.72) 40%,transparent)">
        <div class="row" style="justify-content:center;gap:9px;flex-wrap:nowrap">
          <button id="mute" class="rtcb" aria-label="Mute">${icon('microphone')}<span>Mute</span></button>
          <button id="spk" class="rtcb" aria-label="Speaker">${icon('volume-high')}<span>Speaker</span></button>
          <button id="cam" class="rtcb" aria-label="Camera">${icon('video')}<span>Camera</span></button>
          <button id="flip" class="rtcb" aria-label="Flip camera">${icon('camera-rotate')}<span>Flip</span></button>
          <button id="share" class="rtcb" aria-label="Share screen" style="display:none">${icon('display')}<span>Share</span></button>
        </div>
        <div class="row" style="justify-content:center;margin-top:22px">
          <button id="hang" aria-label="End call" style="width:68px;height:68px;border-radius:34px;border:none;background:#D92D20;color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(217,45,32,.45)">${icon('phone-slash')}</button>
        </div>
      </div>

      <style>
        .rtcb{width:58px;background:none;border:none;color:#fff;display:flex;flex-direction:column;align-items:center;gap:7px;font-size:11px;font-weight:600}
        .rtcb svg{width:19px;height:19px}
        .rtcb::before{content:'';position:absolute}
        .rtcb > svg{padding:14px;border-radius:25px;background:rgba(255,255,255,.16);box-sizing:content-box}
        .rtcb.on > svg{background:#fff;color:#101014}
        .rtcb[disabled]{opacity:.35}
        #pulse.ring{animation:bjring 1.6s ease-out infinite}
        @keyframes bjring{0%{box-shadow:0 0 0 0 rgba(126,217,87,.45)}70%{box-shadow:0 0 0 28px rgba(126,217,87,0)}100%{box-shadow:0 0 0 0 rgba(126,217,87,0)}}
      </style>
    </div>`;
  }, {
    async mount(el, { room }) {
      if (!el.querySelector('#callui')) return;
      let c; try { c = (await api.call(room)).call; } catch { return; }
      const $ = (s) => el.querySelector(s);
      const say = (t) => { const n = $('#state'); if (n) n.textContent = t; };
      const wantVideo = c.mode !== 'audio';
      let pc = null, local = null, since = 0, poll = null, timer = null, started = 0, closed = false, facing = 'user', camTrack = null;

      $('#pulse')?.classList.add('ring');
      if (wantVideo) { $('#cam').classList.add('on'); }
      else { $('#cam').style.display = 'none'; $('#flip').style.display = 'none'; }

      const stop = async (tellServer = true) => {
        if (closed) return; closed = true;
        clearInterval(poll); clearInterval(timer);
        try { local?.getTracks().forEach((t) => t.stop()); } catch {}
        try { pc?.close(); } catch {}
        if (tellServer) { try { await api.endCall(room); } catch {} }
        go('/inbox/' + c.threadId);
      };

      try { local = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo ? { facingMode: facing } : false }); }
      catch { toast(wantVideo ? 'Buja needs camera and microphone permission.' : 'Buja needs microphone permission.'); stop(); return; }
      camTrack = local.getVideoTracks()[0] || null;
      if (wantVideo) { $('#local').srcObject = local; $('#local').style.display = 'block'; }

      pc = new RTCPeerConnection({ iceServers: c.ice, iceCandidatePoolSize: 2 });
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      const remoteStream = new MediaStream();
      const remoteEl = $('#remote'); remoteEl.srcObject = remoteStream;
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach((t) => { remoteStream.addTrack(t); });
        if (remoteStream.getVideoTracks().length) { remoteEl.style.opacity = '1'; $('#face').style.opacity = '0'; }
      };
      pc.onicecandidate = (e) => { if (e.candidate) api.callSignal(room, 'ice', e.candidate.toJSON()).catch(() => {}); };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') {
          $('#pulse')?.classList.remove('ring');
          started = started || Date.now(); say('Connected'); clearInterval(timer);
          timer = setInterval(() => { const n = Math.floor((Date.now() - started) / 1000); say(String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')); }, 1000);
        } else if (s === 'failed') { say('Could not connect'); toast('The call could not connect on this network.'); setTimeout(() => stop(), 1600); }
        else if (s === 'disconnected') say('Reconnecting…');
      };

      if (c.caller) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: wantVideo });
        await pc.setLocalDescription(offer);
        await api.callSignal(room, 'offer', { sdp: offer.sdp, type: offer.type });
      } else { say('Connecting…'); await api.callSignal(room, 'accept', {}); }

      const pendingIce = [];
      poll = setInterval(async () => {
        if (closed) return;
        let r; try { r = await api.callSignals(room, since); } catch { return; }
        if (r.ended) { toast('Call ended'); stop(false); return; }
        for (const s of r.signals) {
          since = Math.max(since, s.id);
          try {
            if (s.kind === 'offer' && !c.caller) {
              await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
              for (const cand of pendingIce.splice(0)) await pc.addIceCandidate(cand).catch(() => {});
              const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
              await api.callSignal(room, 'answer', { sdp: ans.sdp, type: ans.type });
            } else if (s.kind === 'answer' && c.caller) {
              await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
              for (const cand of pendingIce.splice(0)) await pc.addIceCandidate(cand).catch(() => {});
            } else if (s.kind === 'accept' && c.caller) { say('Connecting…'); }
            else if (s.kind === 'ice') {
              const cand = new RTCIceCandidate(s.payload);
              if (pc.remoteDescription) await pc.addIceCandidate(cand).catch(() => {}); else pendingIce.push(cand);
            }
          } catch {}
        }
      }, 900);

      setTimeout(() => { if (!closed && pc.connectionState !== 'connected' && c.caller) { say('No answer'); toast(c.with + ' did not pick up.'); stop(); } }, 45000);

      /* ---- controls ---- */
      $('#mute').addEventListener('click', (e) => {
        const t = local.getAudioTracks()[0]; t.enabled = !t.enabled;
        const b = e.currentTarget; b.classList.toggle('on', !t.enabled);
        b.querySelector('svg').outerHTML = icon(t.enabled ? 'microphone' : 'microphone-slash');
        b.querySelector('span').textContent = t.enabled ? 'Mute' : 'Unmute';
      });
      $('#cam')?.addEventListener('click', (e) => {
        const t = local.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled;
        const b = e.currentTarget; b.classList.toggle('on', t.enabled);
        b.querySelector('svg').outerHTML = icon(t.enabled ? 'video' : 'video-slash');
        b.querySelector('span').textContent = t.enabled ? 'Camera' : 'Camera off';
        $('#local').style.opacity = t.enabled ? '1' : '.35';
      });
      // Speaker: browsers route a call to the earpiece by default on some phones. setSinkId moves it.
      let loud = true;
      $('#spk').classList.add('on');
      $('#spk').addEventListener('click', async (e) => {
        const b = e.currentTarget;
        loud = !loud;
        b.classList.toggle('on', loud);
        b.querySelector('svg').outerHTML = icon(loud ? 'volume-high' : 'volume-xmark');
        b.querySelector('span').textContent = loud ? 'Speaker' : 'Earpiece';
        try {
          if (remoteEl.setSinkId) {
            const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
            const pick = outs.find((d) => loud ? /speaker/i.test(d.label) : /earpiece|receiver/i.test(d.label));
            await remoteEl.setSinkId(pick ? pick.deviceId : 'default');
          } else { remoteEl.volume = loud ? 1 : 0.55; }
        } catch { toast('This phone does not let the browser switch the speaker.'); }
      });
      $('#flip')?.addEventListener('click', async () => {
        facing = facing === 'user' ? 'environment' : 'user';
        try {
          const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
          const track = ns.getVideoTracks()[0];
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) await sender.replaceTrack(track);
          local.getVideoTracks().forEach((t) => { local.removeTrack(t); t.stop(); });
          local.addTrack(track); camTrack = track; $('#local').srcObject = local;
        } catch { toast('This phone has only one camera.'); }
      });
      // Screen sharing, for interviews mostly. Only shown where the browser supports it.
      if (navigator.mediaDevices?.getDisplayMedia && wantVideo) {
        const sh = $('#share'); sh.style.display = '';
        let sharing = false;
        sh.addEventListener('click', async () => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video'); if (!sender) return;
          if (sharing) { await sender.replaceTrack(camTrack); sharing = false; sh.classList.remove('on'); sh.querySelector('span').textContent = 'Share'; return; }
          try {
            const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = ds.getVideoTracks()[0];
            await sender.replaceTrack(track);
            sharing = true; sh.classList.add('on'); sh.querySelector('span').textContent = 'Sharing';
            track.onended = async () => { await sender.replaceTrack(camTrack); sharing = false; sh.classList.remove('on'); sh.querySelector('span').textContent = 'Share'; };
          } catch { toast('Screen sharing was not allowed.'); }
        });
      }
      $('#hang').addEventListener('click', () => stop());
      $('#back').addEventListener('click', () => stop());
      window.addEventListener('hashchange', () => { if (!closed) { closed = true; clearInterval(poll); clearInterval(timer); try { local?.getTracks().forEach((t) => t.stop()); pc?.close(); } catch {} api.endCall(room).catch(() => {}); } }, { once: true });
    }
  });
}

/** The banner that appears anywhere in the app when somebody rings you. */
export function watchIncoming({ api, go, ui, state }) {
  const { icon, h } = ui;
  let shown = null;
  const tick = async () => {
    if (!state.user || document.hidden || location.hash.startsWith('#/rtc/') || location.hash.startsWith('#/call/')) return;
    let call; try { call = (await api.incomingCall()).call; } catch { return; }
    if (!call) { if (shown) { document.getElementById('ringing')?.remove(); shown = null; } return; }
    if (shown === call.room) return;
    shown = call.room;
    const bar = document.createElement('div');
    bar.id = 'ringing';
    bar.innerHTML = `<div style="position:fixed;left:10px;right:10px;top:calc(10px + var(--safe-t));max-width:460px;margin:0 auto;background:linear-gradient(135deg,#1B1B1F,#2A2F3A);color:#fff;border-radius:20px;padding:14px 14px;display:flex;align-items:center;gap:12px;z-index:80;box-shadow:0 16px 40px rgba(0,0,0,.45);animation:bjdrop .25s ease-out">
      <span style="width:46px;height:46px;border-radius:23px;background:linear-gradient(145deg,#7ED957,#FF7A1A);display:flex;align-items:center;justify-content:center;color:#101014;font-weight:700;font-size:19px;flex-shrink:0">${h((call.from || '?')[0].toUpperCase())}</span>
      <span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(call.from)}</span><span class="small" style="color:#AEB4BE">Incoming ${call.mode === 'audio' ? 'Buja call' : 'video call'}</span></span>
      <button id="decl" aria-label="Decline" style="width:46px;height:46px;border-radius:23px;border:none;background:#D92D20;color:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center">${icon('phone-slash')}</button>
      <button id="acc" aria-label="Answer" style="width:46px;height:46px;border-radius:23px;border:none;background:#2FBF4E;color:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center;animation:bjpulse 1.5s ease-out infinite">${icon(call.mode === 'audio' ? 'phone' : 'video')}</button>
    </div>
    <style>@keyframes bjdrop{from{transform:translateY(-16px);opacity:0}to{transform:none;opacity:1}}@keyframes bjpulse{0%{box-shadow:0 0 0 0 rgba(47,191,78,.55)}70%{box-shadow:0 0 0 16px rgba(47,191,78,0)}100%{box-shadow:0 0 0 0 rgba(47,191,78,0)}}</style>`;
    document.body.appendChild(bar);
    bar.querySelector('#acc').addEventListener('click', () => { bar.remove(); shown = null; go('/rtc/' + call.room); });
    bar.querySelector('#decl').addEventListener('click', async () => { bar.remove(); shown = null; try { await api.declineCall(call.room); } catch {} });
    setTimeout(() => { if (document.getElementById('ringing')) { document.getElementById('ringing').remove(); shown = null; } }, 40000);
  };
  setInterval(tick, 5000);
}
