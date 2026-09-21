// Buja fingerprint / face sign-in, built on the phone's own authenticator (WebAuthn).
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));

export function passkeySupported() { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create); }

/** Can this phone do fingerprint/face for a website (platform authenticator)? */
export async function passkeyAvailable() {
  if (!passkeySupported()) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

/** Registers this phone for the signed-in person. */
export async function registerPasskey(api, label) {
  const { token, options } = await api.passkeyRegisterOptions();
  const pub = { ...options, challenge: unb64u(options.challenge), user: { ...options.user, id: unb64u(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) };
  const cred = await navigator.credentials.create({ publicKey: pub });
  return api.passkeyRegister({ token, id: cred.id, rawId: b64u(cred.rawId), label: label || defaultLabel(), response: { clientDataJSON: b64u(cred.response.clientDataJSON), attestationObject: b64u(cred.response.attestationObject) } });
}

/** Signs in with a touch. Pass an email or phone to narrow it; leave empty and the phone offers the saved account. */
export async function loginWithPasskey(api, identifier) {
  const { token, options } = await api.passkeyLoginOptions(identifier || '');
  const pub = { ...options, challenge: unb64u(options.challenge), allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) };
  const cred = await navigator.credentials.get({ publicKey: pub });
  return api.passkeyLogin({ token, id: cred.id, response: { clientDataJSON: b64u(cred.response.clientDataJSON), authenticatorData: b64u(cred.response.authenticatorData), signature: b64u(cred.response.signature) } });
}

function defaultLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone'; if (/iPad/.test(ua)) return 'iPad'; if (/Android/.test(ua)) return 'Android phone'; if (/Windows/.test(ua)) return 'Windows'; if (/Mac/.test(ua)) return 'Mac';
  return 'This device';
}
