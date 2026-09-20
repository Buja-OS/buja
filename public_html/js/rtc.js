// Buja chat calls: the two phones connect directly. Buja only passes the handshake, and never sees the
// audio or video. Registered by app.js.
export function registerRtc({ route, go, state, api, ui, failed }) {
  const { h, toast, icon } = ui;

  route('/rtc/:room', { auth: true, tabs: '' }, async ({ room }) => {
    let c;
    try { c = (await api.call(room)).call; }
    catch (err) { return `<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon('triangle-exclamation')}</div><div class="h-md">${h((err && err.message) || 'That call could not be opened')}</div><a class="btn btn-ink" href="#/inbox" style="width:auto">Back to inbox</a></div>`; }
    const video = c.mode !== 'audio';
    return `
    <div id="callui" style="position:fixed;inset:0;background:#0B0B0E;color:#fff;z-index:70;overflow:hidden">
      <video id="remote" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0B0B0E;${video ? '' : 'display:none'}"></video>
      <div id="audioface" style="position:absolute;inset:0;display:${video ? 'none' : 'flex'};flex-direction:column;align-items:center;justify-content:center;gap:16px">
        <div style="width:110px;height:110px;border-radius:55px;background:linear-gradient(135deg,#7ED957,#FF7A1A);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;color:#101014">${h((c.with || '?')[0])}</div>
        <div style="font-size:22px;font-weight:700">${h(c.with)}</div>
      </div>
      <video id="local" autoplay playsinline muted style="position:absolute;right:14px;top:calc(14px + var(--safe-t));width:96px;height:132px;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,.35);background:#000;${video ? '' : 'display:none'}"></video>

      <div style="position:absolute;left:0;right:0;top:0;padding:calc(16px + var(--safe-t)) 18px 26px;background:linear-gradient(180deg,rgba(0,0,0,.6),transparent)">
        <div style="font-size:20px;font-weight:700">${h(c.with)}</div>
        <div class="small" id="state" style="color:#C9C9D1;margin-top:2px">${c.caller ? 'Ringing…' : 'Connecting…'}</div>
      </div>

      <div style="position:absolute;left:0;right:0;bottom:0;padding:22px 22px calc(26px + var(--safe-b));background:linear-gradient(0deg,rgba(0,0,0,.7),transparent);display:flex;justify-content:center;gap:18px">
        <button id="mute" class="rtcbtn" aria-label="Mute" style="background:rgba(255,255,255,.16)">${icon('microphone')}</button>
        ${video ? `<button id="cam" class="rtcbtn" aria-label="Camera off" style="background:rgba(255,255,255,.16)">${icon('camera')}</button><button id="flip" class="rtcbtn" aria-label="Switch camera" style="background:rgba(255,255,255,.16)">${icon('route')}</button>` : ''}
        <button id="hang" class="rtcbtn" aria-label="End call" style="background:#D92D20">${icon('xmark')}</button>
      </div>
      <style>.rtcbtn{width:58px;height:58px;border-radius:29px;border:none;color:#fff;font-size:19px;display:flex;align-items:center;justify-content:center}.rtcbtn.off{background:#fff!important;color:#101014!important}</style>
    </div>`;
  }, {
    async mount(el, { room }) {
      if (!el.querySelector('#callui')) return;
      let c; try { c = (await api.call(room)).call; } catch { return; }
      const stateLine = el.querySelector('#state');
      const say = (t) => { if (stateLine) stateLine.textContent = t; };
      const wantVideo = c.mode !== 'audio';
      let pc = null, local = null, since = 0, poll = null, timer = null, started = 0, closed = false, facing = 'user';

      const stop = async (tellServer = true) => {
        if (closed) return; closed = true;
        clearInterval(poll); clearInterval(timer);
        try { local?.getTracks().forEach((t) => t.stop()); } catch {}
        try { pc?.close(); } catch {}
        if (tellServer) { try { await api.endCall(room); } catch {} }
        go('/inbox/' + c.threadId);
      };

      try {
        local = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo ? { facingMode: facing } : false });
      } catch {
        toast(wantVideo ? 'Buja needs camera and microphone permission for a call.' : 'Buja needs microphone permission for a call.');
        stop(); return;
      }
      const localEl = el.querySelector('#local'); if (localEl) localEl.srcObject = local;

      pc = new RTCPeerConnection({ iceServers: c.ice, iceCandidatePoolSize: 2 });
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      const remoteStream = new MediaStream();
      el.querySelector('#remote').srcObject = remoteStream;
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
        if (!wantVideo) { const a = document.createElement('audio'); a.autoplay = true; a.srcObject = remoteStream; el.appendChild(a); }
      };
      pc.onicecandidate = (e) => { if (e.candidate) api.callSignal(room, 'ice', e.candidate.toJSON()).catch(() => {}); };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') {
          started = started || Date.now(); say('Connected');
          clearInterval(timer);
          timer = setInterval(() => { const n = Math.floor((Date.now() - started) / 1000); say(String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')); }, 1000);
        } else if (s === 'failed') {
          say('Could not connect');
          toast('The call could not connect on this network.');
          setTimeout(() => stop(), 1500);
        } else if (s === 'disconnected') say('Reconnecting…');
      };

      // The caller makes the offer; the other side answers when they pick up.
      if (c.caller) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: wantVideo });
        await pc.setLocalDescription(offer);
        await api.callSignal(room, 'offer', { sdp: offer.sdp, type: offer.type });
      } else {
        say('Connecting…');
        await api.callSignal(room, 'accept', {});
      }

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
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              await api.callSignal(room, 'answer', { sdp: ans.sdp, type: ans.type });
            } else if (s.kind === 'answer' && c.caller) {
              await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
              for (const cand of pendingIce.splice(0)) await pc.addIceCandidate(cand).catch(() => {});
            } else if (s.kind === 'accept' && c.caller) {
              say('Connecting…');
            } else if (s.kind === 'ice') {
              const cand = new RTCIceCandidate(s.payload);
              if (pc.remoteDescription) await pc.addIceCandidate(cand).catch(() => {});
              else pendingIce.push(cand);
            }
          } catch (err) { /* a late or duplicate signal is harmless */ }
        }
      }, 900);

      // Nobody picked up
      setTimeout(() => { if (!closed && pc.connectionState !== 'connected' && c.caller) { say('No answer'); toast(c.with + ' did not pick up.'); stop(); } }, 45000);

      el.querySelector('#mute').addEventListener('click', (e) => {
        const on = local.getAudioTracks()[0]; on.enabled = !on.enabled;
        e.currentTarget.classList.toggle('off', !on.enabled);
      });
      el.querySelector('#cam')?.addEventListener('click', (e) => {
        const v = local.getVideoTracks()[0]; if (!v) return; v.enabled = !v.enabled;
        e.currentTarget.classList.toggle('off', !v.enabled);
      });
      el.querySelector('#flip')?.addEventListener('click', async () => {
        facing = facing === 'user' ? 'environment' : 'user';
        try {
          const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
          const track = ns.getVideoTracks()[0];
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) await sender.replaceTrack(track);
          local.getVideoTracks().forEach((t) => t.stop());
          local.removeTrack(local.getVideoTracks()[0]); local.addTrack(track);
          el.querySelector('#local').srcObject = local;
        } catch { toast('This phone has only one camera.'); }
      });
      el.querySelector('#hang').addEventListener('click', () => stop());
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
    bar.innerHTML = `<div style="position:fixed;left:12px;right:12px;top:calc(12px + var(--safe-t));max-width:456px;margin:0 auto;background:var(--night);color:#fff;border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:12px;z-index:80;box-shadow:0 10px 30px rgba(0,0,0,.35)">
      <span style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,#7ED957,#FF7A1A);display:flex;align-items:center;justify-content:center;color:#101014;font-weight:700">${h((call.from || '?')[0])}</span>
      <span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:700">${h(call.from)}</span><span class="small" style="color:#B5B5BC">Incoming ${call.mode === 'audio' ? 'call' : 'video call'}</span></span>
      <button id="decl" aria-label="Decline" style="width:40px;height:40px;border-radius:20px;border:none;background:#D92D20;color:#fff">${icon('xmark')}</button>
      <button id="acc" aria-label="Answer" style="width:40px;height:40px;border-radius:20px;border:none;background:var(--green);color:#101014">${icon('microphone')}</button>
    </div>`;
    document.body.appendChild(bar);
    bar.querySelector('#acc').addEventListener('click', () => { bar.remove(); shown = null; go('/rtc/' + call.room); });
    bar.querySelector('#decl').addEventListener('click', async () => { bar.remove(); shown = null; try { await api.declineCall(call.room); } catch {} });
    setTimeout(() => { if (document.getElementById('ringing')) { document.getElementById('ringing').remove(); shown = null; } }, 40000);
  };
  setInterval(tick, 5000);
}
