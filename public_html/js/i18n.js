// Buja in English, Pidgin, Hausa and Yoruba.
// The screens are written in English. When another language is chosen, this watches the page and swaps every
// piece of text it has a translation for, the moment it appears, so no screen needs rewriting. Anything without
// a translation (people's posts, names, rarer screens) simply stays in English.
export const LANGS = [['en', 'English', 'English'], ['pcm', 'Pidgin', 'Naijá'], ['ha', 'Hausa', 'Hausa'], ['yo', 'Yoruba', 'Yorùbá']];

let lang = 'en';
let dict = null;          // exact text → translation
let pats = [];            // "Good morning, {name}" style entries, as regular expressions
let observer = null;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'SVG', 'svg']);
const ATTRS = ['placeholder', 'title'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

try { lang = localStorage.getItem('buja_lang') || 'en'; } catch {}
if (!LANGS.some(([k]) => k === lang)) lang = 'en';
document.documentElement.lang = lang === 'pcm' ? 'pcm' : lang;

export const currentLang = () => lang;

/** Translate one string (used by code that builds text itself, like toasts and confirms). */
export function t(s) {
  if (!dict || s == null) return s;
  const k = norm(String(s)); if (!k) return s;
  if (dict[k] != null) return dict[k];
  for (const [rx, out] of pats) { const m = k.match(rx); if (m) return out.replace(/\{(\w+)\}/g, (_, n) => m.groups[n] ?? ''); }
  return s;
}

function textNode(n) {
  const orig = n.__bujaEn ?? n.data;
  if (!dict) { if (n.__bujaEn != null && n.data !== n.__bujaEn) n.data = n.__bujaEn; return; }
  const k = norm(orig); if (!k || k.length > 400 || !/[A-Za-z]/.test(k)) return;
  const out = t(k);
  if (out !== k) {
    if (n.__bujaEn == null) n.__bujaEn = orig;
    const lead = orig.match(/^\s*/)[0], tail = orig.match(/\s*$/)[0];
    const next = lead + out + tail; if (n.data !== next) n.data = next;
  } else if (n.__bujaEn != null && n.data !== n.__bujaEn) n.data = n.__bujaEn;
}
function element(el) {
  for (const a of ATTRS) {
    const key = '__bujaEn_' + a;
    if (!el.hasAttribute(a) && el[key] == null) continue;
    const orig = el[key] ?? el.getAttribute(a);
    const out = dict ? t(orig) : orig;
    if (out !== orig && el[key] == null) el[key] = orig;
    if (el.getAttribute(a) !== out) el.setAttribute(a, out);
  }
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) { if (!SKIP.has(root.parentNode?.nodeName)) textNode(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName) || root.closest?.('[data-noi18n],[contenteditable]')) return;
  element(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.nodeName) || n.hasAttribute('data-noi18n') || n.isContentEditable)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) textNode(n); else element(n); }
}

async function load(l) {
  if (l === 'en') { dict = null; pats = []; return; }
  const m = await import(`./i18n/${l}.js`);
  dict = {}; pats = [];
  for (const [k, v] of Object.entries(m.default)) {
    if (k.includes('{')) {
      const rx = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\w+)\\?\}/g, (_, n) => `(?<${n}>.+?)`) + '$');
      pats.push([rx, v]);
    } else dict[norm(k)] = v;
  }
}

function watch() {
  if (observer) return;
  observer = new MutationObserver((list) => {
    if (!dict && lang === 'en') return;
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'attributes' && ATTRS.includes(m.attributeName)) {
        const el = m.target, key = '__bujaEn_' + m.attributeName, v = el.getAttribute(m.attributeName);
        if (dict && v !== t(el[key] ?? '')) { el[key] = v; const out = t(v); if (out !== v) el.setAttribute(m.attributeName, out); }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
}

/** Switch language now, and remember it on this phone. The server copy is saved by the caller. */
export async function setLang(l) {
  if (!LANGS.some(([k]) => k === l)) l = 'en';
  lang = l; try { localStorage.setItem('buja_lang', l); } catch {}
  document.documentElement.lang = l;
  try { await load(l); } catch { dict = null; }
  walk(document.body);
  watch();
}

/** Start with whatever this phone chose last time. */
export function startI18n() {
  if (lang === 'en') { watch(); return Promise.resolve(); }
  return load(lang).then(() => { walk(document.body); watch(); }).catch(() => { dict = null; });
}
window.bujaT = t;
