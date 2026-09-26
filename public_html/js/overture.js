// Buja: reads Overture Maps business listings for the FCT straight from Overture's public tile archive,
// in the admin's browser (Buja's server is refused by some map services), and sorts each place into a Buja
// category. Only places that are open, named, and confident enough are kept. Loaded only on the admin screen.
import { PMTiles, VectorTile, Pbf } from './vendor/ovt.js';

export const TILES_BASE = 'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles';
export const FCT = { south: 8.85, west: 7.15, north: 9.25, east: 7.65 };
export const MIN_CONFIDENCE = 0.6;

/** The newest release that still has tiles. Overture removes old ones, so it is looked up each time. */
export async function latestRelease() {
  try {
    const res = await fetch(`${new URL(TILES_BASE).origin}/?list-type=2&delimiter=%2F&prefix=tiles%2F`);
    if (res.ok) {
      const ids = [...(await res.text()).matchAll(/<Prefix>tiles\/([^<]+?)\/?<\/Prefix>/g)].map((m) => m[1]).filter((r) => /^\d{4}-\d{2}-\d{2}\.\d+$/.test(r));
      ids.sort((a, b) => (a.split('.')[0] === b.split('.')[0] ? Number(b.split('.')[1]) - Number(a.split('.')[1]) : a < b ? 1 : -1));
      if (ids.length) return ids[0];
    }
  } catch {}
  const res = await fetch('https://stac.overturemaps.org/catalog.json');
  const j = await res.json();
  if (typeof j.latest === 'string') return j.latest;
  throw new Error('Could not find the latest Overture release');
}

/** Tile x/y numbers covering a box at zoom z (standard web map tiles). */
export function tilesFor(b, z) {
  const n = 2 ** z;
  const x = (lng) => Math.floor(((lng + 180) / 360) * n);
  const y = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n); };
  const out = [];
  for (let tx = x(b.west); tx <= x(b.east); tx++) for (let ty = y(b.north); ty <= y(b.south); ty++) out.push([tx, ty]);
  return out;
}

const parse = (v) => { if (v == null || typeof v !== 'string') return v; const s = v.trim(); if (!s || (s[0] !== '{' && s[0] !== '[')) return v; try { return JSON.parse(s); } catch { return v; } };

// Order matters: a bar is also "food and drink", a hotel restaurant is still a hotel's business, and so on.
// Each rule tests the words of Overture's category path (e.g. "food and drink restaurant casual eatery").
const RULES = [
  ['worship', /\b(church|cathedral|chapel|parish|mosque|masjid|religious|place of worship|worship|temple|synagogue|ministry|ministries)\b/, (w, name) => {
    const christian = /\b(church|cathedral|chapel|parish|christian|ministry|ministries|catholic|anglican|baptist|methodist|pentecostal|evangelical)\b/.test(w) || /church|chapel|cathedral|parish|redeemed|winners|deeper life|living faith|assembly|ministr|christ/i.test(name);
    const muslim = /\b(mosque|masjid|islamic|muslim)\b/.test(w) || /mosque|masjid|jumm?a|islamic/i.test(name);
    return { amenity: 'place_of_worship', religion: christian ? 'christian' : muslim ? 'muslim' : undefined };
  }],
  ['health', /\b(hospital|clinic|pharmacy|drugstore|chemist|doctor|doctors|dentist|dental|medical|health center|health centre|laboratory|diagnostic|maternity|optometrist|optician|physiotherapy|surgery|healthcare|health and medical)\b/, (w) => ({
    amenity: /\b(pharmacy|drugstore|chemist)\b/.test(w) ? 'pharmacy' : /\bhospital\b/.test(w) ? 'hospital' : /\b(dentist|dental)\b/.test(w) ? 'dentist' : /\b(laboratory|diagnostic)\b/.test(w) ? 'laboratory' : 'clinic' })],
  ['nightlife', /\b(night club|nightclub|dance club|karaoke|disco)\b/, () => ({ amenity: 'nightclub' })],
  ['lounge', /\b(bar|bars|lounge|pub|beer|brewery|wine bar|cocktail|hookah|shisha|sports bar)\b/, () => ({ amenity: 'bar' })],
  ['hotel', /\b(hotel|motel|guest house|guesthouse|hostel|lodging|lodge|resort|inn|accommodation|bed and breakfast|serviced apartment|holiday rental)\b/, () => ({ tourism: 'hotel' })],
  ['food', /\b(restaurant|restaurants|eatery|fast food|cafe|coffee|bakery|food court|pizza|burger|grill|buffet|ice cream|dessert|suya|shawarma|diner|bistro|canteen|catering|juice|smoothie|seafood|barbecue|bbq|pepper soup|amala|jollof|chop)\b/, (w) => ({ amenity: /\b(fast food|burger|pizza|shawarma|chicken)\b/.test(w) ? 'fast_food' : /\b(cafe|coffee)\b/.test(w) ? 'cafe' : /\bbakery\b/.test(w) ? 'bakery' : 'restaurant' })],
  ['kids', /\b(playground|amusement|zoo|water park|theme park|kids|children|trampoline|arcade|family fun|indoor play)\b/, () => ({ leisure: 'playground' })],
  ['culture', /\b(museum|gallery|art gallery|theater|theatre|cinema|movie|library|monument|landmark|cultural|heritage|historic|arts center|arts centre|performing arts|concert)\b/, (w) => ({ tourism: /\b(cinema|movie)\b/.test(w) ? 'cinema' : /\b(theater|theatre|performing arts|concert)\b/.test(w) ? 'theatre' : /\bgallery\b/.test(w) ? 'gallery' : /\blibrary\b/.test(w) ? 'library' : /\b(monument|landmark|historic|heritage)\b/.test(w) ? 'attraction' : 'museum' })],
  ['services', /\b(salon|barber|barbershop|hair|nail|nails|makeup|tailor|tailoring|beauty salon)\b/, (w) => ({ shop: /\b(barber|barbershop)\b/.test(w) ? 'barber' : /\btailor/.test(w) ? 'tailor' : 'beauty' })],   // before "spa": Overture files salons under beauty and spa
  ['relax', /\b(park|garden|gardens|spa|massage|beach|lake|nature|recreation area|picnic|botanical|golf|swimming pool|country club)\b/, (w) => ({ leisure: /\b(spa|massage)\b/.test(w) ? 'spa' : /\b(garden|gardens|botanical)\b/.test(w) ? 'garden' : /\b(golf|country club|swimming pool)\b/.test(w) ? 'sports_centre' : 'park' })],
  ['shopping', /\b(shopping|mall|supermarket|grocery|market|department store|convenience store|boutique|retail|store|shop|shops|plaza|provisions)\b/, (w) => ({ shop: /\b(mall|shopping center|shopping centre|plaza)\b/.test(w) ? 'mall' : /\b(supermarket|grocery|provisions)\b/.test(w) ? 'supermarket' : /\bmarket\b/.test(w) ? 'marketplace' : 'store' })],
  ['food', /\b(food and drink|food|chicken)\b/, () => ({ amenity: 'restaurant' })],   // the broad "food and drink" group, once shops are ruled out
  ['services', /\b(bank|atm|gas station|fuel|filling station|petrol|car wash|auto repair|car repair|automotive repair|mechanic|tire|tyre|vulcanizer|laundry|dry cleaning|laundromat|salon|beauty|barber|barbershop|hair|tailor|phone repair|electronics repair|courier|post office|printing|photocopy)\b/, (w) => ({ amenity: /\b(bank|atm)\b/.test(w) ? 'bank' : /\b(gas station|fuel|filling station|petrol)\b/.test(w) ? 'fuel' : /\bcar wash\b/.test(w) ? 'car_wash' : /\b(auto repair|car repair|automotive repair|mechanic|tire|tyre|vulcanizer)\b/.test(w) ? 'car_repair' : /\b(laundry|dry cleaning|laundromat)\b/.test(w) ? 'laundry' : 'service' })],
];

/** Turns one Overture feature into the shape Buja's saver expects, or null when it should be left out. */
export function classify(p, lng, lat) {
  const names = parse(p.names);
  const name = String(p['@name'] || (names && names.primary) || '').trim();
  if (!name || name.length > 70) return null;
  const status = String(p.operating_status || 'open');
  if (status !== 'open') return null;
  const conf = p.confidence == null ? null : Number(p.confidence);
  if (conf != null && conf < MIN_CONFIDENCE) return null;
  const tax = parse(p.taxonomy) || {};
  const path = [].concat(tax.hierarchy || [], tax.primary || [], p.basic_category || [], (parse(p.categories) || {}).primary || []).join(' ');
  const words = ' ' + path.replace(/_/g, ' ').toLowerCase() + ' ';
  if (words.trim() === '' || /\b(parking|car park)\b/.test(words)) return null;
  for (const [cat, rx, tagsFor] of RULES) {
    if (!rx.test(words)) continue;
    const t = tagsFor(words, name);
    const phones = parse(p.phones), sites = parse(p.websites), addr = parse(p.addresses);
    const tags = { name, ...t, 'overture:category': (tax.primary || p.basic_category || '').toString().slice(0, 40) };
    if (Array.isArray(phones) && phones[0]) tags.phone = String(phones[0]);
    if (Array.isArray(sites) && sites[0]) tags.website = String(sites[0]);
    if (Array.isArray(addr) && addr[0] && addr[0].freeform) tags['addr:street'] = String(addr[0].freeform);
    Object.keys(tags).forEach((k) => tags[k] === undefined && delete tags[k]);
    return { category: cat, element: { type: 'overture', id: String(p.id || name + '@' + lat.toFixed(5) + ',' + lng.toFixed(5)), lat, lon: lng, tags } };
  }
  return null;
}

/**
 * Reads every tile over the FCT and returns places grouped by Buja category.
 * onProgress(done, total, found) is called as tiles arrive.
 */
export async function readFct(release, onProgress = () => {}, { concurrency = 8, box = FCT } = {}) {
  const archive = new PMTiles(`${TILES_BASE}/${release}/places.pmtiles`);
  const header = await archive.getHeader();
  const z = Math.max(header.minZoom, Math.min(14, header.maxZoom));
  const list = tilesFor(box, z);
  const byCat = {}; const seen = new Set(); let done = 0, found = 0, failed = 0;
  const one = async ([x, y]) => {
    let r = null;
    for (let tries = 0; tries < 3 && !r; tries++) { try { r = await archive.getZxy(z, x, y); break; } catch { await new Promise((ok) => setTimeout(ok, 800 * (tries + 1))); } }
    if (r === null && failed < 1e9) { /* empty tile or unreachable */ }
    if (r && r.data) {
      const vt = new VectorTile(new Pbf(new Uint8Array(r.data)));
      for (const layerName of Object.keys(vt.layers)) {
        const layer = vt.layers[layerName];
        for (let i = 0; i < layer.length; i++) {
          const f = layer.feature(i); if (f.type !== 1) continue;
          const g = f.toGeoJSON(x, y, z); const [lng, lat] = g.geometry.type === 'Point' ? g.geometry.coordinates : g.geometry.coordinates[0];
          if (lat < box.south || lat > box.north || lng < box.west || lng > box.east) continue;
          const c = classify(f.properties, lng, lat); if (!c) continue;
          if (seen.has(c.element.id)) continue; seen.add(c.element.id);
          (byCat[c.category] = byCat[c.category] || []).push(c.element); found++;
        }
      }
    }
    done++; onProgress(done, list.length, found);
  };
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (next < list.length) { const t = list[next++]; await one(t); } }));
  return { byCat, found, tiles: list.length, zoom: z };
}
