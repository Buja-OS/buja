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
    map = new ml.Map({ container: el, style: STYLE, center, zoom, attributionControl: false, interactive, pitchWithRotate: false, dragRotate: false, maxBounds: [[5.5, 7.8], [9.5, 10.4]] });
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
    marker(id, { lng, lat, html, onClick, anchor = 'bottom', z = 1, draggable = false, onDragEnd }) {
      api.remove(id);
      const node = document.createElement('div'); node.innerHTML = html; node.style.zIndex = z;
      const m = new ml.Marker({ element: node, anchor, draggable }).setLngLat([lng, lat]).addTo(map);
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
export function bottomSheet(host, { peek = 150, half = 0.48, start = 'half' } = {}) {
  const el = document.createElement('div'); el.className = 'bm-sheet';
  el.innerHTML = `<div class="bm-handle" aria-hidden="true"><span></span></div><div class="bm-sheet-body"></div>`;
  host.appendChild(el);
  const H = () => host.clientHeight || window.innerHeight;
  const pos = { peek: () => H() - peek, half: () => H() * (1 - half), full: () => 64 };
  let state = start, y0 = 0, t0 = 0, dragging = false;
  const place = (px, animate = true) => { el.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none'; el.style.transform = `translateY(${Math.max(56, px)}px)`; };
  const set = (s) => { state = s; place(pos[s]()); el.dataset.state = s; };
  const handle = el.querySelector('.bm-handle');
  handle.addEventListener('pointerdown', (e) => { dragging = true; y0 = e.clientY; t0 = pos[state](); handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => { if (dragging) place(t0 + (e.clientY - y0), false); });
  handle.addEventListener('pointerup', (e) => {
    if (!dragging) return; dragging = false; const y = t0 + (e.clientY - y0);
    if (Math.abs(e.clientY - y0) < 6) { set(state === 'full' ? 'half' : state === 'half' ? 'full' : 'half'); return; } // a tap cycles
    const cands = Object.entries(pos).map(([k, f]) => [k, Math.abs(f() - y)]).sort((a, b) => a[1] - b[1]);
    set(cands[0][0]);
  });
  window.addEventListener('resize', () => set(state));
  requestAnimationFrame(() => set(start));
  return { el, body: el.querySelector('.bm-sheet-body'), set, get state() { return state; } };
}

/** Screen wake lock while live tracking, so the phone does not sleep and stop sending its position. */
export async function keepAwake() {
  try { if ('wakeLock' in navigator) { const l = await navigator.wakeLock.request('screen'); document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && l.released) { try { await navigator.wakeLock.request('screen'); } catch {} } }); return l; } } catch {}
  return null;
}

export const TRADE_ICON = { mechanic: 'wrench', vulcanizer: 'life-ring', towing: 'truck-pickup', electrician: 'bolt', plumber: 'faucet-drip', mason: 'trowel-bricks', carpenter: 'hammer', painter: 'paint-roller', tiler: 'border-all', welder: 'fire-flame-simple', ac: 'snowflake', generator: 'gear', solar: 'solar-panel', cctv: 'video', dstv: 'satellite-dish', phone: 'mobile-screen-button', laptop: 'laptop', carwash: 'spray-can-sparkles', laundry: 'jug-detergent', cleaning: 'broom', errand: 'box', cook: 'utensils', hair: 'scissors', tailor: 'shirt', gardener: 'seedling', pest: 'bug', locksmith: 'key', movers: 'truck-moving' };
export const TRADE_COLOR = { mechanic: '#1F5FBF', vulcanizer: '#1F5FBF', towing: '#1F5FBF', carwash: '#1F5FBF', electrician: '#B7791F', solar: '#B7791F', generator: '#B7791F', ac: '#0E7C86', plumber: '#0E7C86', hair: '#C2185B', tailor: '#C2185B', laundry: '#7A3E96', cleaning: '#7A3E96' };
