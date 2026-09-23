// Buja ads. Off until an admin switches them on (Admin -> Ads). One layer, three outlets:
//
//  - Web and installed PWA: Google AdSense. Display banners, in-feed units between list cards, and the
//    Ad Placement API (adBreak) for interstitial and rewarded breaks, which is Google's supported web format.
//  - Native wrapper: Google AdMob, through a bridge the wrapper injects. Android (WebView wrapper) exposes
//    window.BujaAds.show(json); iOS (the PWABuilder Xcode project) exposes
//    window.webkit.messageHandlers.bujaAds.postMessage(json). The wrapper replies by calling
//    window.bujaAdResult({ id, shown, rewarded }). Buja never assumes a wrapper exists.
//  - Nowhere on screens where an ad would be unsafe or unkind (breakdowns, tracking, Trip Share, calls,
//    payments, lessons, sign-in, admin), and never for Buja Plus members.
//
// Frequency: in-feed every N cards, interstitials only after M screen changes, never twice within a few
// minutes, never in the first minutes of a visit, app-open at most every few hours.

let cfg = null, loading = null, screens = 0, lastBreak = 0, started = Date.now(), adsenseReady = null, pending = {};
const PLACE_OF = (path) => ({ social: 'social', news: 'news', work: 'work', homes: 'homes', declutter: 'declutter', meetup: 'meetup', waka: 'waka', learn: 'learn' })[(path.split('/')[1] || '')];

export async function adsConfig(api) {
  if (cfg) return cfg;
  if (!loading) loading = api.adsConfig().then((r) => (cfg = r.ads || { enabled: false })).catch(() => (cfg = { enabled: false }));
  return loading;
}
const nativeBridge = () => (window.BujaAds && typeof window.BujaAds.show === 'function') ? (m) => window.BujaAds.show(JSON.stringify(m))
  : (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bujaAds) ? (m) => window.webkit.messageHandlers.bujaAds.postMessage(m) : null;
export const isNative = () => !!nativeBridge();
window.bujaAdResult = (r) => { const p = r && pending[r.id]; if (p) { delete pending[r.id]; p(r); } };
function askNative(kind, unit) {
  const send = nativeBridge(); if (!send) return Promise.resolve({ shown: false });
  const id = kind + Date.now();
  return new Promise((res) => { pending[id] = res; setTimeout(() => { if (pending[id]) { delete pending[id]; res({ shown: false }); } }, 30000); try { send({ id, kind, unit }); } catch { delete pending[id]; res({ shown: false }); } });
}
function loadAdsense(client) {
  if (adsenseReady) return adsenseReady;
  adsenseReady = new Promise((res) => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    s.onload = () => { try { window.adConfig({ preloadAdBreaks: 'on', sound: 'off' }); } catch {} res(true); }; s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  return adsenseReady;
}
const allowed = (path) => cfg && cfg.enabled && !(cfg.never || []).some((p) => path === p || path.startsWith(p + '/')) && !!cfg.places && !!cfg.places[PLACE_OF(path)];

/** Called by the router after every screen. Places in-feed units between cards, and maybe an interstitial. */
export async function afterScreen(api, path, el) {
  await adsConfig(api);
  screens++;
  if (!allowed(path)) return;
  const native = isNative();
  // In-feed: web only (native ad views cannot live inside a web page). Between the cards of a list.
  if (!native && cfg.adsenseClient && cfg.infeedSlot) {
    const main = el.querySelector('main'); if (main && !main.querySelector('.ad-slot')) {
      const cards = [...main.children].filter((c) => c.classList && c.classList.contains('card'));
      const every = cfg.infeedEvery || 6;
      if (cards.length > every) {
        await loadAdsense(cfg.adsenseClient);
        for (let i = every; i < cards.length; i += every) {
          const slot = document.createElement('div'); slot.className = 'ad-slot';
          slot.innerHTML = `<div class="small muted" style="font-size:10px;letter-spacing:1px;margin-bottom:4px">SPONSORED</div><ins class="adsbygoogle" style="display:block" data-ad-format="fluid" data-ad-layout-key="-fb+5w+4e-db+86" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${cfg.infeedSlot}"></ins>`;
          cards[i].before(slot); try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
        }
      }
    }
  }
  // Anchored banner: native wrappers show their own AdMob banner above the tab bar while on an allowed screen.
  if (native && cfg.native && cfg.admobBanner) askNative('banner', cfg.admobBanner);
  // Interstitial: after enough screens, not too often, never early in a visit.
  const now = Date.now();
  const due = screens % (cfg.interstitialEveryScreens || 8) === 0 && now - lastBreak > (cfg.interstitialMinGapSec || 240) * 1000 && now - started > (cfg.sessionGraceSec || 120) * 1000;
  if (!due) return;
  lastBreak = now;
  if (native && cfg.native && cfg.admobInterstitial) { askNative('interstitial', cfg.admobInterstitial); return; }
  if (!native && cfg.webBreaks && cfg.adsenseClient) { await loadAdsense(cfg.adsenseClient); try { window.adBreak({ type: 'next', name: 'screen-' + PLACE_OF(path) }); } catch {} }
}
/** Leaving an allowed screen: native wrappers hide their banner. */
export function hideBanner() { if (isNative()) askNative('hide-banner', ''); }

/**
 * A rewarded ad the person chooses to watch, for a stated reward. Resolves true only when the ad network
 * confirms the reward, so nothing is granted for an ad that did not play.
 */
export async function rewarded(api, reason) {
  await adsConfig(api);
  if (!cfg.enabled) return false;
  if (isNative() && cfg.native && cfg.admobRewarded) { const r = await askNative('rewarded', cfg.admobRewarded); return !!r.rewarded; }
  if (cfg.webBreaks && cfg.adsenseClient) {
    await loadAdsense(cfg.adsenseClient);
    return new Promise((res) => { let got = false; try { window.adBreak({ type: 'reward', name: reason, beforeReward: (show) => show(), adViewed: () => { got = true; }, adDismissed: () => {}, adBreakDone: () => res(got) }); } catch { res(false); } });
  }
  return false;
}
/** App open: native only, once every few hours. */
export async function appOpen(api) {
  await adsConfig(api);
  if (!cfg.enabled || !isNative() || !cfg.native || !cfg.admobAppOpen) return;
  const k = 'buja_appopen'; let last = 0; try { last = +localStorage.getItem(k) || 0; } catch {}
  if (Date.now() - last < (cfg.appOpenGapSec || 14400) * 1000) return;
  try { localStorage.setItem(k, String(Date.now())); } catch {}
  askNative('app-open', cfg.admobAppOpen);
}
