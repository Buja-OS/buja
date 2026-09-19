// Tiny app state with subscriptions. No framework.
const listeners = new Set();
export const state = {
  user: null,          // { id, kind, name, email, phone, district, avatar, verified, google }
  booted: false,
  theme: 'system',     // 'light' | 'dark' | 'system'
  online: navigator.onLine,
};
export function setState(patch) { Object.assign(state, patch); listeners.forEach((fn) => fn(state)); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Theme is a first-class setting: light, dark, or follow the phone.
const mq = matchMedia('(prefers-color-scheme: dark)');
export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('buja.theme', theme); } catch {}
  setState({ theme });
}
mq.addEventListener('change', () => { if (state.theme === 'system') applyTheme('system'); });
try { state.theme = localStorage.getItem('buja.theme') || 'system'; } catch {}

window.addEventListener('online',  () => setState({ online: true }));
window.addEventListener('offline', () => setState({ online: false }));
