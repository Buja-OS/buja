// Buja maps. MapLibre GL (vendored, loaded only when a map opens) on OpenFreeMap vector tiles: free, no key,
// fair for production, unlike openstreetmap.org's own tile server. Markers are HTML so every pin can carry a
// Font Awesome icon, a name and a rating, and moving markers glide between updates like Bolt's cars.
import { icon, h } from './ui.js';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ABUJA = [7.4700, 9.0570];
let lib = null;

export function loadMapLib() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (lib) return lib;
  lib = new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/js/vendor/maplibre-gl.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = '/js/vendor/maplibre-gl.js';
    s.onload = () => resolve(window.maplibregl); s.onerror = () => { lib = null; reject(new Error('map library')); };
    document.head.appendChild(s);
  });
  return lib;
}

/** One pin: a round bubble with an icon, and a label chip underneath (name, rating) that hides when zoomed out. */
export function pinHtml({ iconName = 'location-dot', color = '#FF7A1A', label = '', sub = '', size = 40, ring = false, badge = '' }) {
  return `<div class="bm-pin${ring ? ' bm-ring' : ''}" style="--c:${color}">
    <div class="bm-bubble" style="width:${size}px;height:${size}px">${icon(iconName)}${badge ? `<span class="bm-badge">${h(badge)}</span>` : ''}</div>
    ${label ? `<div class="bm-label"><strong>${h(label)}</strong>${sub ? `<span>${h(sub)}</span>` : ''}</div>` : ''}
  </div>`;
}
/** A top-down vehicle that rotates to its heading. */
export function carHtml(color = '#101014', iconName = 'car-side') {
  return `<div class="bm-car" style="--c:${color}"><div class="bm-rot"><div class="bm-carbody">${icon(iconName)}</div><div class="bm-arrow"></div></div></div>`;
}
/** The person on their way: their face in a coloured ring that turns with their heading. */
export function avatarHtml(photo, color = '#1F5FBF', initials = '') {
  const face = photo ? `<img src="${h(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">` : `<span style="font:800 15px Inter,system-ui,sans-serif;color:#fff">${h(initials)}</span>`;
  return `<div class="bm-car bm-face" style="--c:${color}"><div class="bm-rot"><div class="bm-arrow"></div></div><div class="bm-facebody">${face}</div></div>`;
}
/** A person on the map: their photo in a ring of their trade's colour, a small trade badge, and a name chip.
 *  Falls back to initials when there is no photo, and to them if the photo fails to load. */
export function facePinHtml({ photo, name = '', sub = '', color = '#1F5FBF', iconName = 'wrench', verified = false, dim = false }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  const face = photo
    ? `<img src="${h(photo)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'bm-ini',textContent:'${h(initials).replace(/'/g, '')}'}))">`
    : `<span class="bm-ini">${h(initials)}</span>`;
  return `<div class="bm-pin bm-person${dim ? ' bm-dim' : ''}" style="--c:${color}">
    <div class="bm-photo">${face}<span class="bm-trade">${icon(iconName)}</span>${verified ? '<span class="bm-badge">✓</span>' : ''}</div>
    ${name ? `<div class="bm-label"><strong>${h(name)}</strong>${sub ? `<span>${h(sub)}</span>` : ''}</div>` : ''}
  </div>`;
}
/** Several people at the same spot (a mechanic village, one workshop) would sit on top of each other. Returns a
 *  pixel offset per item, a small ring that stays the same size at every zoom; their real position is unchanged. */
export function spreadSame(items, getLL, px = 30) {
  const groups = {};
  items.forEach((it) => { const p = getLL(it); if (!p) return; const k = p.lat.toFixed(4) + ',' + p.lng.toFixed(4); (groups[k] = groups[k] || []).push(it); });
  const out = new Map();
  Object.values(groups).forEach((g) => {
    if (g.length === 1) { out.set(g[0], null); return; }
    const r = px * Math.max(1, g.length / 4);
    // Two or three sit side by side; more form a ring. Grouped pins drop their own name chip (see groupChips).
    g.forEach((it, i) => {
      if (g.length <= 3) out.set(it, [Math.round((i - (g.length - 1) / 2) * px * 1.9), 0]);
      else { const t = (2 * Math.PI * i) / g.length - Math.PI / 2; out.set(it, [Math.round(r * Math.cos(t)), Math.round(r * Math.sin(t))]); }
    });
  });
  return out;
}
/** One chip under each group of people at the same spot: "3 mechanics here". Returns [{ lat, lng, n }]. */
export function groupChips(items, getLL) {
  const groups = {};
  items.forEach((it) => { const p = getLL(it); if (!p) return; const k = p.lat.toFixed(4) + ',' + p.lng.toFixed(4); (groups[k] = groups[k] || { ...p, n: 0 }).n++; });
  return Object.values(groups).filter((g) => g.n > 1);
}
export const meHtml = () => `<div class="bm-me"><span></span></div>`;

/**
 * Creates a map in `el`. Resolves to a controller, or null when maps cannot run on this phone (no WebGL, or the
 * library could not load), in which case the caller keeps showing its list.
 */
export async function createMap(el, { center = ABUJA, zoom = 12, interactive = true } = {}) {
  let ml;
  try { ml = await loadMapLib(); } catch { return null; }
  el.classList.add('bm-host');
  let map;
  try {
    map = new ml.Map({ container: el, style: STYLE, center, zoom, attributionControl: false, interactive, pitchWithRotate: true, dragRotate: true, maxPitch: 65, maxBounds: [[5.5, 7.8], [9.5, 10.4]] });
  } catch { return null; }
  map.addControl(new ml.AttributionControl({ compact: true, customAttribution: 'OpenFreeMap · © OpenStreetMap' }));
  // No street style (offline, or the tile server unreachable): switch to a plain background so pins, the moving
  // vehicle and the camera keep working. MapLibre does not animate at all without a loaded style.
  let styleOk = false; map.once('style.load', () => { styleOk = true; });
  const plain = () => { if (styleOk) return; styleOk = true; try { map.setStyle({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#E9E7DF' } }] }); } catch {} el.classList.add('bm-offline'); };
  map.on('error', (e) => { if (!styleOk && e && e.error && /fetch|style|load/i.test(String(e.error.message || e.error))) plain(); });
  setTimeout(() => { if (!map.isStyleLoaded()) plain(); }, 12000);
  const loaded = new Promise((r) => { if (map.isStyleLoaded()) r(); else map.once('style.load', r); setTimeout(r, 13000); });
  const markers = {};
  const anims = {};
  const setLabels = () => el.classList.toggle('bm-far', map.getZoom() < 12.5);
  map.on('zoom', setLabels); setLabels();

  const api = {
    raw: map,
    /** Adds or replaces a marker. */
    marker(id, { lng, lat, html, onClick, anchor = 'bottom', z = 1, draggable = false, onDragEnd, offset = null }) {
      api.remove(id);
      const node = document.createElement('div'); node.innerHTML = html; node.style.zIndex = z;
      const m = new ml.Marker({ element: node, anchor, draggable, ...(offset ? { offset } : {}) }).setLngLat([lng, lat]).addTo(map);
      if (draggable && onDragEnd) m.on('dragend', () => { const p = m.getLngLat(); if (markers[id]) { markers[id].lng = p.lng; markers[id].lat = p.lat; } onDragEnd(p.lng, p.lat); });
      if (onClick) node.addEventListener('click', (e) => { e.stopPropagation(); onClick(id); });
      markers[id] = { m, node, lng, lat };
      return node;
    },
    has: (id) => !!markers[id],
    element: (id) => markers[id] && markers[id].node,
    /** Glides a marker to a new position over `ms`, turning a car to face its direction of travel. */
    move(id, lng, lat, { ms = 1800, heading = null } = {}) {
      const mk = markers[id]; if (!mk) return;
      const from = { lng: mk.lng, lat: mk.lat }; const start = performance.now();
      const hdg = heading != null ? heading : ((Math.abs(lng - from.lng) + Math.abs(lat - from.lat) > 1e-6) ? bearing(from, { lng, lat }) : null);
      const rot = mk.node.querySelector('.bm-rot'); if (rot && hdg != null) rot.style.transform = `rotate(${hdg}deg)`;
      cancelAnimationFrame(anims[id]);
      const step = (t) => { const k = Math.min(1, (t - start) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; const x = from.lng + (lng - from.lng) * e, y = from.lat + (lat - from.lat) * e; mk.m.setLngLat([x, y]); if (k < 1) anims[id] = requestAnimationFrame(step); };
      anims[id] = requestAnimationFrame(step);
      mk.lng = lng; mk.lat = lat;
    },
    remove(id) { const mk = markers[id]; if (mk) { cancelAnimationFrame(anims[id]); mk.m.remove(); delete markers[id]; } },
    clearMarkers(prefix = '') { Object.keys(markers).filter((k) => k.startsWith(prefix)).forEach(api.remove); },
    /** Draws or updates a line. coords: [[lng, lat], ...] */
    async line(id, coords, { color = '#FF7A1A', width = 6, dashed = false, casing = true } = {}) {
      await loaded;
      const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} };
      if (map.getSource(id)) { map.getSource(id).setData(data); return; }
      try {
        map.addSource(id, { type: 'geojson', data });
        if (casing) map.addLayer({ id: id + '-case', type: 'line', source: id, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': width + 4, 'line-opacity': .9 } });
        map.addLayer({ id, type: 'line', source: id, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': width, ...(dashed ? { 'line-dasharray': [1.5, 1.5] } : {}) } });
      } catch {}
    },
    /** A translucent circle of `metres` around a point: the GPS accuracy, or the search radius. */
    async circle(id, lng, lat, metres, { color = '#1F5FBF', opacity = 0.14 } = {}) {
      await loaded;
      const pts = []; const R = 6371000;
      for (let i = 0; i <= 48; i++) { const b = (i / 48) * 2 * Math.PI; const dLat = (metres * Math.cos(b)) / R; const dLng = (metres * Math.sin(b)) / (R * Math.cos(lat * Math.PI / 180)); pts.push([lng + dLng * 180 / Math.PI, lat + dLat * 180 / Math.PI]); }
      const data = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] }, properties: {} };
      if (map.getSource(id)) { map.getSource(id).setData(data); return; }
      try { map.addSource(id, { type: 'geojson', data }); map.addLayer({ id, type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': opacity } }); map.addLayer({ id: id + '-edge', type: 'line', source: id, paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': .6 } }); } catch {}
    },
    removeLine(id) { try { for (const l of [id, id + '-case', id + '-edge']) if (map.getLayer(l)) map.removeLayer(l); if (map.getSource(id)) map.removeSource(id); } catch {} },
    /** Frames a set of [lng, lat] points, leaving room for a bottom sheet. */
    fit(points, { bottom = 220, top = 90, side = 40, maxZoom = 15, ms = 700 } = {}) {
      const pts = points.filter((p) => p && isFinite(p[0]) && isFinite(p[1])); if (!pts.length) return;
      if (pts.length === 1) { map.easeTo({ center: pts[0], zoom: Math.min(maxZoom, 15), duration: ms, padding: { top, bottom, left: side, right: side } }); return; }
      const b = new ml.LngLatBounds(pts[0], pts[0]); pts.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: { top, bottom, left: side, right: side }, maxZoom, duration: ms });
    },
    /** Real 3D buildings from OpenStreetMap heights (OpenFreeMap's building layer), with the map tilted to see them. */
    async set3d(on) {
      await loaded;
      try {
        if (on && !map.getLayer('bj-3d') && map.getSource('openmaptiles')) {
          const before = (map.getStyle().layers || []).find((l) => l.type === 'symbol')?.id;
          map.addLayer({ id: 'bj-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14.5, filter: ['!=', ['get', 'hide_3d'], true],
            paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#E6E0D4', 40, '#C9CFD6', 120, '#9DB3C8'],
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.2, ['coalesce', ['get', 'render_height'], 8]], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.88 } }, before);
        }
        if (map.getLayer('bj-3d')) map.setLayoutProperty('bj-3d', 'visibility', on ? 'visible' : 'none');
      } catch {}
      map.easeTo({ pitch: on ? 58 : 0, bearing: on ? -18 : 0, zoom: on ? Math.max(map.getZoom(), 15.6) : map.getZoom(), duration: 900 });
      return on;
    },
    center(lng, lat, zoom) { map.easeTo({ center: [lng, lat], zoom: zoom ?? map.getZoom(), duration: 600 }); },
    on: (ev, fn) => map.on(ev, fn),
    resize: () => map.resize(),
    destroy() { Object.keys(anims).forEach((k) => cancelAnimationFrame(anims[k])); try { map.remove(); } catch {} },
  };
  // A map inside a screen that is replaced must release its WebGL context, or phones run out after a few screens.
  const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); api.destroy(); } });
  obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  return api;
}

export function bearing(a, b) {
  const t = (d) => d * Math.PI / 180, lat1 = t(a.lat), lat2 = t(b.lat), dl = t(b.lng - a.lng);
  const y = Math.sin(dl) * Math.cos(lat2), x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
export function metres(a, b) {
  const t = (d) => d * Math.PI / 180, R = 6371000, dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * A Bolt-style bottom sheet over a full-screen map: drag the handle between peek, half and full.
 * Returns { el, set(state), body } where body is where content goes.
 */
/**
 * A draggable sheet over the map with three stops: peek, half and full. Two rules keep every button reachable:
 * 1. Detail content (a place, a job, a person) opens tall enough to show all of it, up to 85% of the screen, so
 *    its buttons are never cut off. Lists (content containing an element with data-sheet-list) keep the fixed
 *    "half" so the map stays visible above them.
 * 2. The sheet is only ever as tall as the part on screen, so whatever does not fit scrolls inside it instead of
 *    hiding below the bottom edge of the phone.
 */
export function bottomSheet(host, { peek = 150, half = 0.48, start = 'half' } = {}) {
  const el = document.createElement('div'); el.className = 'bm-sheet';
  el.innerHTML = `<div class="bm-handle" aria-hidden="true"><span></span></div><div class="bm-sheet-body"></div>`;
  host.appendChild(el);
  const body = el.querySelector('.bm-sheet-body'), handle = el.querySelector('.bm-handle');
  const H = () => host.clientHeight || window.innerHeight;
  /** How tall the content really is, from the top of the sheet to the bottom of its last element, plus breathing room. */
  const contentH = () => {
    const kids = [...body.children].filter((k) => k.offsetParent !== null || k.getClientRects().length);
    if (!kids.length) return peek;
    const top = body.getBoundingClientRect().top - body.scrollTop, bottom = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
    return Math.ceil(handle.offsetHeight + (bottom - top) + 20);
  };
  const isList = () => !!body.querySelector('[data-sheet-list]');
  const pos = {
    peek: () => { if (isList()) return H() - peek; const c = contentH(); return H() - Math.max(peek, Math.min(c, H() * 0.45)); },
    half: () => { if (isList()) return H() * (1 - half); const c = contentH(); return H() - Math.max(peek, Math.min(c, H() * 0.85, H() - 128)); },   // 128: the back button, top bar and locate button stay tappable
    full: () => 64,
  };
  let state = start, y0 = 0, t0 = 0, dragging = false, shrinkT = null;
  const place = (px, animate = true) => {
    const top = Math.max(56, px), h = Math.max(120, H() - top);
    el.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = `translateY(${top}px)`;
    // grow at once, shrink after the slide, so the content never jumps while it moves
    clearTimeout(shrinkT);
    if (!animate || h >= el.offsetHeight) el.style.height = h + 'px'; else shrinkT = setTimeout(() => { el.style.height = h + 'px'; }, 290);
  };
  const set = (s) => { state = s; place(pos[s]()); el.dataset.state = s; };
  handle.addEventListener('pointerdown', (e) => { dragging = true; y0 = e.clientY; t0 = pos[state](); el.style.height = H() + 'px'; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => { if (dragging) { el.style.transition = 'none'; el.style.transform = `translateY(${Math.max(56, t0 + (e.clientY - y0))}px)`; } });
  handle.addEventListener('pointerup', (e) => {
    if (!dragging) return; dragging = false; const y = t0 + (e.clientY - y0);
    if (Math.abs(e.clientY - y0) < 6) { set(state === 'full' ? 'half' : state === 'half' ? 'full' : 'half'); return; } // a tap cycles
    const cands = Object.entries(pos).map(([k, f]) => [k, Math.abs(f() - y)]).sort((a, b) => a[1] - b[1]);
    set(cands[0][0]);
  });
  // When the content changes (a list turns into a detail card, a job moves on), refit so its buttons stay in view.
  let refit = 0;
  new MutationObserver(() => { if (dragging || state === 'full') return; cancelAnimationFrame(refit); refit = requestAnimationFrame(() => { const want = pos[state](); const now = new DOMMatrix(getComputedStyle(el).transform).m42; if (Math.abs(want - now) > 4) place(want); }); }).observe(body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', () => set(state));
  requestAnimationFrame(() => set(start));
  return { el, body, set, get state() { return state; } };
}

/** Screen wake lock while live tracking, so the phone does not sleep and stop sending its position. */
export async function keepAwake() {
  try { if ('wakeLock' in navigator) { const l = await navigator.wakeLock.request('screen'); document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && l.released) { try { await navigator.wakeLock.request('screen'); } catch {} } }); return l; } } catch {}
  return null;
}

export const TRADE_ICON = { restaurant: 'utensils', suya: 'fire-flame-simple', bakery: 'bowl-food', drinks: 'martini-glass', grocery: 'basket-shopping', water: 'faucet-drip', gas: 'fire-flame-simple', events: 'star', printing: 'paint-roller', photography: 'camera', mechanic: 'wrench', vulcanizer: 'life-ring', towing: 'truck-pickup', electrician: 'bolt', plumber: 'faucet-drip', mason: 'trowel-bricks', carpenter: 'hammer', painter: 'paint-roller', tiler: 'border-all', welder: 'fire-flame-simple', ac: 'snowflake', generator: 'gear', solar: 'solar-panel', cctv: 'video', dstv: 'satellite-dish', phone: 'mobile-screen-button', laptop: 'laptop', carwash: 'spray-can-sparkles', laundry: 'jug-detergent', cleaning: 'broom', errand: 'box', cook: 'utensils', hair: 'scissors', tailor: 'shirt', gardener: 'seedling', pest: 'bug', locksmith: 'key', movers: 'truck-moving' };
export const TRADE_COLOR = { restaurant: '#E8620E', suya: '#C0392B', bakery: '#B7791F', drinks: '#7A3E96', grocery: '#2E7D1E', water: '#0E7C86', gas: '#C0392B', cook: '#E8620E', events: '#C2185B', printing: '#1F4E9C', photography: '#101014', mechanic: '#1F5FBF', vulcanizer: '#1F5FBF', towing: '#1F5FBF', carwash: '#1F5FBF', electrician: '#B7791F', solar: '#B7791F', generator: '#B7791F', ac: '#0E7C86', plumber: '#0E7C86', hair: '#C2185B', tailor: '#C2185B', laundry: '#7A3E96', cleaning: '#7A3E96' };
