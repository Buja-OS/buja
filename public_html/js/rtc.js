// Buja chat calls: the two phones connect directly. Buja only passes the handshake, and never sees the
// audio or video. Registered by app.js.
import { ringer } from './trustalerts.js';

export function registerRtc({ route, go, state, api, ui, failed }) {
  const ringBack = ringer();
  const { h, toast, icon } = ui;

  route('/rtc/:room', { auth: true, tabs: '' }, async ({ room }) => {
    let c;
    try { c = (await api.call(room)).call; }
    catch (err) { const back = document.referrer || ''; return `<div class="placeholder" style="padding:60px 20px"><div class="mi card">${icon(err && err.error === 'early' ? 'clock' : 'phone-slash')}</div><div class="h-md" style="max-width:300px;line-height:1.35">${h((err && err.message) || 'That call could not be opened')}</div><button class="btn btn-ink" onclick="history.length > 1 ? history.back() : (location.hash = '#/inbox')" style="width:auto">Back to the conversation</button></div>`; }
    const video = c.mode !== 'audio';
    const initial = h((c.with || '?')[0].toUpperCase());
    return `
    <div id="callui" style="position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 0%, #1E2430 0%, #0B0B0E 60%);color:#fff;z-index:70;overflow:hidden">
      <video id="remote" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent;opacity:0;transition:opacity .4s"></video>
      <video id="rscreen" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;display:none"></video>

      <div id="face" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;transition:opacity .4s">
        <div id="pulse" style="width:132px;height:132px;border-radius:66px;background:linear-gradient(145deg,#7ED957,#FF7A1A);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:#101014;box-shadow:0 0 0 0 rgba(126,217,87,.45);overflow:hidden">${c.withAvatar ? `<img src="${h(c.withAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover">` : initial}</div>
        <div style="text-align:center"><div style="font-size:24px;font-weight:700">${h(c.with)}</div><div class="small" id="sub" style="color:#9AA0AB;margin-top:4px">${c.kind === 'interview' ? 'Interview on Buja' : 'Buja call'}</div></div>
      </div>

      <video id="local" autoplay playsinline muted style="position:absolute;right:14px;top:calc(14px + var(--safe-t));width:98px;height:134px;object-fit:cover;border-radius:16px;border:2px solid rgba(255,255,255,.28);background:#000;display:none;box-shadow:0 8px 24px rgba(0,0,0,.4)"></video>

      <div style="position:absolute;left:0;right:0;top:0;padding:calc(18px + var(--safe-t)) 20px 30px;background:linear-gradient(180deg,rgba(0,0,0,.55),transparent);display:flex;align-items:center;gap:12px">
        <button id="back" aria-label="Back" style="width:36px;height:36px;border-radius:18px;border:none;background:rgba(255,255,255,.14);color:#fff">${icon('chevron-left')}</button>
        <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(c.with)}</div><div class="small" id="state" style="color:#C9C9D1">${c.caller ? 'Ringing…' : 'Connecting…'}</div></div>
      </div>

      <div id="sharebar" style="position:absolute;left:50%;transform:translateX(-50%);top:calc(78px + var(--safe-t));display:none;align-items:center;gap:8px;background:rgba(255,122,26,.96);color:#101014;border-radius:24px;padding:6px 6px 6px 12px;font-size:13px;font-weight:700;white-space:nowrap;z-index:3;box-shadow:0 6px 18px rgba(0,0,0,.35);max-width:calc(100% - 20px)">
        <img id="presthumb" alt="" style="display:none;width:34px;height:34px;border-radius:8px;object-fit:cover;background:#101014">
        <span id="sharetxt">You are sharing your screen</span>
        <span id="presnav" style="display:none;gap:4px"><button class="pb" id="presprev" aria-label="Previous photo">${icon('chevron-left')}</button><button class="pb" id="presnext" aria-label="Next photo">${icon('chevron-right')}</button><button class="pb" id="presadd" aria-label="Add photos">${icon('plus')}</button></span>
        <button id="stopshare" style="border:none;background:#101014;color:#fff;border-radius:18px;padding:7px 12px;font-weight:700;font-size:12px">Stop</button></div>
      <div id="sharepick" style="position:absolute;inset:0;z-index:5;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5)">
        <div style="background:#1B1E26;border-radius:22px 22px 0 0;padding:20px 18px calc(22px + var(--safe-b));width:100%;max-width:480px;display:flex;flex-direction:column;gap:10px">
          <div style="font-size:17px;font-weight:700">Share with ${h(c.with)}</div>
          <div class="row" style="gap:8px;align-items:center;margin:2px 0 4px"><span class="small grow" style="color:#AEB4BF">Your camera while you share</span><span class="spseg"><button data-camopt="1" class="on">${icon('video')} On</button><button data-camopt="0">${icon('video-slash')} Off</button></span></div>
          <button class="sp-opt" id="sp-screen">${icon('display')}<span><b>Share my screen</b><em id="sp-screen-note">Everything on your screen, live</em></span></button>
          <button class="sp-opt" id="sp-photos">${icon('camera')}<span><b>Show photos or screenshots</b><em>Pick from your gallery and go through them together, full screen on their phone</em></span></button>
          <input type="file" id="sp-file" accept="image/*" multiple style="display:none">
          <button id="spcancel" style="border:none;background:none;color:#C9C9D1;font-weight:600;padding:10px">Cancel</button>
        </div>
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
        .sp-opt{display:flex;align-items:center;gap:14px;text-align:left;border:none;border-radius:16px;background:rgba(255,255,255,.08);color:#fff;padding:14px}
        .sp-opt svg{width:20px;height:20px;flex-shrink:0}
        .sp-opt[disabled]{opacity:.45}
        .spseg{display:flex;background:rgba(255,255,255,.08);border-radius:14px;padding:3px}
        .spseg button{border:none;background:none;color:#C9C9D1;font-weight:700;font-size:12px;padding:7px 12px;border-radius:11px;display:flex;align-items:center;gap:6px}
        .spseg button svg{width:13px;height:13px}
        .spseg button.on{background:#fff;color:#101014}
        .pb{width:32px;height:32px;border-radius:16px;border:none;background:rgba(16,16,20,.14);color:#101014;display:flex;align-items:center;justify-content:center;padding:0}
        .pb svg{width:14px;height:14px}
        .sp-opt b{display:block;font-size:15px} .sp-opt em{display:block;font-style:normal;font-size:12px;color:#AEB4BF;margin-top:2px}
        #callui.rshare #remote{inset:auto !important;left:14px !important;top:calc(84px + var(--safe-t)) !important;width:96px !important;height:132px !important;border-radius:16px;border:2px solid rgba(255,255,255,.28);z-index:2;box-shadow:0 8px 24px rgba(0,0,0,.4);background:#000 !important}
        #callui.rcamoff #remote{opacity:0 !important}
        #callui.rcamoff:not(.rshare) #face{opacity:1 !important}
        #callui.rshare #face{opacity:0 !important}
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
      let screenTx = null, screenTrack = null, sharing = false, restarts = 0, dropT = null, watchdog = null;   // screen sharing rides on its own video channel, so your camera can stay on beside it

      $('#pulse')?.classList.add('ring');
      if (c.caller) ringBack.start('outgoing');
      if (wantVideo) { $('#cam').classList.add('on'); }
      else { $('#cam').style.display = 'none'; $('#flip').style.display = 'none'; }

      const stop = async (tellServer = true) => {
        if (closed) return; closed = true;
        ringBack.stop();
        clearInterval(poll); clearInterval(timer); clearTimeout(watchdog); clearTimeout(dropT);
        try { local?.getTracks().forEach((t) => t.stop()); screenTrack?.stop(); } catch {}
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
      // the caller opens a second video channel up front for screen sharing, so sharing later needs no new handshake
      if (c.caller && wantVideo) { try { screenTx = pc.addTransceiver('video', { direction: 'sendrecv' }); } catch {} }
      const remoteStream = new MediaStream(), remoteScreen = new MediaStream();
      const remoteEl = $('#remote'); remoteEl.srcObject = remoteStream; $('#rscreen').srcObject = remoteScreen;
      const videoTx = () => pc.getTransceivers().filter((t) => t.receiver.track && t.receiver.track.kind === 'video');
      const camSender = () => { const t = videoTx().find((x) => x !== screenTx); return t ? t.sender : null; };
      pc.ontrack = (e) => {
        const vids = videoTx();
        if (e.track.kind === 'video' && vids.length > 1 && e.transceiver === vids[1]) { remoteScreen.addTrack(e.track); return; }   // their screen channel
        if (!remoteStream.getTracks().includes(e.track)) remoteStream.addTrack(e.track);
        if (remoteStream.getVideoTracks().length) { remoteEl.style.opacity = '1'; $('#face').style.opacity = '0'; }
      };
      pc.onicecandidate = (e) => { if (e.candidate) api.callSignal(room, 'ice', e.candidate.toJSON()).catch(() => {}); };
      // A dropped or blocked path is retried with a fresh ICE round (the caller re-offers, the other phone answers).
      const restart = async () => {
        if (closed || !c.caller || restarts >= 2) return false;
        restarts++; say('Reconnecting…');
        try { const o = await pc.createOffer({ iceRestart: true }); await pc.setLocalDescription(o); await api.callSignal(room, 'offer', { sdp: o.sdp, type: o.type }); return true; } catch { return false; }
      };
      const giveUp = () => {
        if (closed || pc.connectionState === 'connected') return;
        say('Could not connect');
        toast(c.relay ? 'The call could not get through. One of you may have a weak or blocked connection: try Wi-Fi, or call again in a moment.'
          : 'The call could not get through. Calls on mobile data need Buja\'s call relay, which is not switched on yet. It works when both phones are on the same Wi-Fi.');
        setTimeout(() => stop(), 5000);
      };
      // once both phones have joined, the call should connect within about 25 s; if not, retry, then explain
      const armWatchdog = () => { clearTimeout(watchdog); watchdog = setTimeout(async () => { if (closed || pc.connectionState === 'connected') return; if (await restart()) watchdog = setTimeout(giveUp, 20000); else if (!c.caller) watchdog = setTimeout(giveUp, 20000); else giveUp(); }, 25000); };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') {
          ringBack.stop(); clearTimeout(dropT); clearTimeout(watchdog);
          $('#pulse')?.classList.remove('ring');
          started = started || Date.now(); clearInterval(timer);
          timer = setInterval(() => { const n = Math.floor((Date.now() - started) / 1000); say(String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')); }, 1000);
          say('Connected');
        } else if (s === 'failed') { clearInterval(timer); restart().then((ok) => { if (!ok && !c.caller) say('Reconnecting…'); else if (!ok) giveUp(); }); if (!c.caller) { clearTimeout(watchdog); watchdog = setTimeout(giveUp, 20000); } }
        else if (s === 'disconnected') { say('Reconnecting…'); clearTimeout(dropT); dropT = setTimeout(() => { if (pc.connectionState === 'disconnected') restart(); }, 5000); }
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
              if (wantVideo && !screenTx) { const v = videoTx(); if (v.length > 1) { screenTx = v[1]; try { screenTx.direction = 'sendrecv'; } catch {} } }
              for (const cand of pendingIce.splice(0)) await pc.addIceCandidate(cand).catch(() => {});
              const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
              await api.callSignal(room, 'answer', { sdp: ans.sdp, type: ans.type });
              if (pc.connectionState !== 'connected') armWatchdog();
            } else if (s.kind === 'answer' && c.caller) {
              await pc.setRemoteDescription(new RTCSessionDescription(s.payload)); if (pc.connectionState !== 'connected') armWatchdog();
              for (const cand of pendingIce.splice(0)) await pc.addIceCandidate(cand).catch(() => {});
            } else if (s.kind === 'accept' && c.caller) { say('Connecting…'); }
            else if (s.kind === 'media') showRemote(s.payload || {});
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
      // tell the other phone what we are sending (screen on or off, camera on or off) so it can lay the call out
      const sendMedia = () => api.callSignal(room, 'media', { share: sharing, cam: !!(camTrack && camTrack.enabled), fallback: sharing && !screenTx }).catch(() => {});
      const setCam = (on, tell = true) => {
        const t = camTrack; if (!t) return; t.enabled = on;
        const b = $('#cam'); b.classList.toggle('on', on);
        b.querySelector('svg').outerHTML = icon(on ? 'video' : 'video-slash');
        b.querySelector('span').textContent = on ? 'Camera' : 'Camera off';
        $('#local').style.opacity = on ? '1' : '.35';
        if (tell) sendMedia();
      };
      $('#cam')?.addEventListener('click', () => setCam(!(camTrack && camTrack.enabled)));
      let lastShare = false;
      function showRemote(p) {
        const ui = $('#callui'); if (!ui) return;
        const share = !!p.share && !p.fallback;
        ui.classList.toggle('rshare', share); ui.classList.toggle('rcamoff', p.cam === false);
        $('#rscreen').style.display = share ? 'block' : 'none';
        remoteEl.style.objectFit = p.share && p.fallback ? 'contain' : 'cover';
        if (p.share && !lastShare) toast(c.with + ' is sharing their screen'); lastShare = !!p.share;
      }
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
          const on = !camTrack || camTrack.enabled; track.enabled = on;
          const sender = camSender();
          if (sender && !(sharing && !screenTx)) await sender.replaceTrack(track);
          local.getVideoTracks().forEach((t) => { local.removeTrack(t); t.stop(); });
          local.addTrack(track); camTrack = track; $('#local').srcObject = local;
        } catch { toast('This phone has only one camera.'); }
      });
      // Sharing. A computer can share its screen. Phone browsers cannot (Chrome for Android, Safari on iPhone and
      // Firefox all refuse it), so a phone shows photos or screenshots instead: they are drawn onto a canvas whose
      // live picture goes down the same channel a screen would, full screen on the other phone.
      if (wantVideo) {
        const sh = $('#share'); sh.style.display = '';
        const canShare = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        let camChoice = true, mode = null, pres = null;   // mode: 'screen' | 'photos'
        if (!canShare) { $('#sp-screen').disabled = true; $('#sp-screen-note').textContent = 'Needs a computer: phone browsers cannot share their screen'; }
        el.querySelectorAll('[data-camopt]').forEach((b) => b.addEventListener('click', () => { camChoice = b.dataset.camopt === '1'; el.querySelectorAll('[data-camopt]').forEach((x) => x.classList.toggle('on', x === b)); }));
        const label = () => {
          sh.classList.toggle('on', sharing); sh.querySelector('span').textContent = sharing ? 'Stop' : 'Share';
          $('#sharebar').style.display = sharing ? 'flex' : 'none';
          $('#presnav').style.display = sharing && mode === 'photos' ? 'flex' : 'none';
          $('#presthumb').style.display = sharing && mode === 'photos' ? 'block' : 'none';
          $('#sharetxt').textContent = mode === 'photos' && pres ? `Photo ${pres.i + 1} of ${pres.imgs.length}` : 'You are sharing your screen';
        };
        const send = async (track) => {
          if (screenTx) await screenTx.sender.replaceTrack(track);
          else { const cs = camSender(); if (!cs) throw new Error('no sender'); await cs.replaceTrack(track); }
        };
        const stopShare = async () => {
          if (!sharing) return; sharing = false;
          try { if (screenTx) await screenTx.sender.replaceTrack(null); else { const cs = camSender(); if (cs) await cs.replaceTrack(camTrack); } } catch {}
          try { screenTrack && screenTrack.stop(); } catch {} screenTrack = null;
          if (pres) { clearInterval(pres.timer); pres.imgs.forEach((im) => URL.revokeObjectURL(im.src)); pres = null; }
          mode = null; label(); sendMedia();
        };
        const begin = (track, m) => { screenTrack = track; sharing = true; mode = m; track.addEventListener('ended', stopShare); setCam(camChoice, false); label(); sendMedia(); };
        const shareScreen = async () => {
          $('#sharepick').style.display = 'none';
          let ds; try { ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false }); }
          catch { toast('Screen sharing was not allowed.'); return; }
          const track = ds.getVideoTracks()[0]; if (!track) return;
          try { track.contentHint = 'detail'; } catch {}
          try { await send(track); } catch { track.stop(); toast('Screen sharing could not start on this call.'); return; }
          begin(track, 'screen');
        };
        // photos: each picked image is fitted onto the canvas; the canvas is redrawn twice a second so the picture stays live
        const loadImgs = (files) => Promise.all([...files].filter((f) => /^image\//.test(f.type)).slice(0, 30).map((f) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = URL.createObjectURL(f); }))).then((a) => a.filter(Boolean));
        const draw = () => {
          if (!pres) return; if (closed) { clearInterval(pres.timer); return; }
          const im = pres.imgs[pres.i]; const cv = pres.cv, x = pres.x;
          const long = 1280, sc = Math.min(1, long / Math.max(im.naturalWidth, im.naturalHeight));
          const w = Math.max(2, Math.round(im.naturalWidth * sc / 2) * 2), hh = Math.max(2, Math.round(im.naturalHeight * sc / 2) * 2);
          if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
          x.fillStyle = '#000'; x.fillRect(0, 0, w, hh); x.drawImage(im, 0, 0, w, hh);
          $('#presthumb').src = im.src;
        };
        const showPhotos = async (files) => {
          const imgs = await loadImgs(files); if (!imgs.length) { toast('Those files are not photos.'); return; }
          if (pres) { pres.imgs.push(...imgs); pres.i = pres.imgs.length - imgs.length; draw(); label(); return; }   // "+" adds to the set
          const cv = document.createElement('canvas'); const x = cv.getContext('2d');
          if (!cv.captureStream) { imgs.forEach((im) => URL.revokeObjectURL(im.src)); toast('This phone cannot show photos in a call. Try updating Chrome.'); return; }
          pres = { imgs, i: 0, cv, x, timer: null }; draw();
          const track = cv.captureStream(10).getVideoTracks()[0];
          try { track.contentHint = 'detail'; } catch {}
          try { await send(track); } catch { track.stop(); imgs.forEach((im) => URL.revokeObjectURL(im.src)); pres = null; toast('Photos could not be shown on this call.'); return; }
          pres.timer = setInterval(draw, 500);
          begin(track, 'photos');
        };
        const step = (d) => { if (!pres) return; pres.i = (pres.i + d + pres.imgs.length) % pres.imgs.length; draw(); label(); };
        sh.addEventListener('click', () => {
          if (sharing) { stopShare(); return; }
          if (pc.connectionState !== 'connected') { toast('Wait for the call to connect, then share.'); return; }
          $('#sharepick').style.display = 'flex';
        });
        $('#sp-screen').addEventListener('click', () => { if (canShare) shareScreen(); });
        $('#sp-photos').addEventListener('click', () => { $('#sharepick').style.display = 'none'; $('#sp-file').click(); });
        $('#sp-file').addEventListener('change', (e) => { const f = e.target.files; if (f && f.length) showPhotos(f); e.target.value = ''; });
        $('#presprev').addEventListener('click', () => step(-1));
        $('#presnext').addEventListener('click', () => step(1));
        $('#presadd').addEventListener('click', () => $('#sp-file').click());
        $('#spcancel').addEventListener('click', () => { $('#sharepick').style.display = 'none'; });
        $('#sharepick').addEventListener('click', (e) => { if (e.target.id === 'sharepick') e.target.style.display = 'none'; });
        $('#stopshare').addEventListener('click', stopShare);
        // swipe on your own phone while showing photos: left for the next one, right for the one before
        let sx = null; el.querySelector('#callui').addEventListener('touchstart', (e) => { sx = mode === 'photos' ? e.touches[0].clientX : null; }, { passive: true });
        el.querySelector('#callui').addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); }, { passive: true });
      }
      $('#hang').addEventListener('click', () => stop());
      $('#back').addEventListener('click', () => stop());
      window.addEventListener('hashchange', () => { if (!closed) { closed = true; clearInterval(poll); clearInterval(timer); try { local?.getTracks().forEach((t) => t.stop()); screenTrack?.stop(); pc?.close(); } catch {} api.endCall(room).catch(() => {}); } }, { once: true });
    }
  });
}

/** The banner that appears anywhere in the app when somebody rings you. */
export function watchIncoming({ api, go, ui, state, ring }) {
  const { icon, h } = ui;
  let shown = null;
  // One small check every 3 s while Buja is open: it marks you online (for chat) and catches a ringing call.
  // When the app is closed the call arrives as an urgent notification instead.
  let busyTick = false;
  const tick = async () => {
    if (!state.user || document.hidden || busyTick) return;
    busyTick = true;
    let call; try { call = (await api.pulse()).call; } catch { busyTick = false; return; }
    busyTick = false;
    if (location.hash.startsWith('#/rtc/') || location.hash.startsWith('#/call/')) return;
    if (!call) { if (shown) { document.getElementById('ringing')?.remove(); shown = null; ring?.stop(); } return; }
    if (shown === call.room) return;
    shown = call.room;
    const bar = document.createElement('div');
    bar.id = 'ringing';
    bar.innerHTML = `<div style="position:fixed;left:10px;right:10px;top:calc(10px + var(--safe-t));max-width:460px;margin:0 auto;background:linear-gradient(135deg,#1B1B1F,#2A2F3A);color:#fff;border-radius:20px;padding:14px 14px;display:flex;align-items:center;gap:12px;z-index:80;box-shadow:0 16px 40px rgba(0,0,0,.45);animation:bjdrop .25s ease-out">
      <span style="width:46px;height:46px;border-radius:23px;background:linear-gradient(145deg,#7ED957,#FF7A1A);display:flex;align-items:center;justify-content:center;color:#101014;font-weight:700;font-size:19px;flex-shrink:0;overflow:hidden">${call.fromAvatar ? `<img src="${h(call.fromAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover">` : h((call.from || '?')[0].toUpperCase())}</span>
      <span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(call.from)}</span><span class="small" style="color:#AEB4BE">Incoming ${call.mode === 'audio' ? 'Buja call' : 'video call'}</span></span>
      <button id="decl" aria-label="Decline" style="width:46px;height:46px;border-radius:23px;border:none;background:#D92D20;color:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center">${icon('phone-slash')}</button>
      <button id="acc" aria-label="Answer" style="width:46px;height:46px;border-radius:23px;border:none;background:#2FBF4E;color:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center;animation:bjpulse 1.5s ease-out infinite">${icon(call.mode === 'audio' ? 'phone' : 'video')}</button>
    </div>
    <style>@keyframes bjdrop{from{transform:translateY(-16px);opacity:0}to{transform:none;opacity:1}}@keyframes bjpulse{0%{box-shadow:0 0 0 0 rgba(47,191,78,.55)}70%{box-shadow:0 0 0 16px rgba(47,191,78,0)}100%{box-shadow:0 0 0 0 rgba(47,191,78,0)}}</style>`;
    document.body.appendChild(bar);
    ring?.start('incoming');
    bar.querySelector('#acc').addEventListener('click', () => { ring?.stop(); bar.remove(); shown = null; go('/rtc/' + call.room); });
    bar.querySelector('#decl').addEventListener('click', async () => { ring?.stop(); bar.remove(); shown = null; try { await api.declineCall(call.room); } catch {} });
    setTimeout(() => { if (document.getElementById('ringing')) { ring?.stop(); document.getElementById('ringing').remove(); shown = null; } }, 40000);
  };
  setInterval(tick, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('focus', tick);
  tick();
}
