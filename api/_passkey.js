// Face ID / fingerprint sign-in with passkeys (WebAuthn), the pure part (17 Nov 2026, owner: "Face ID or fingerprint login").
// Files starting with "_" under api/ are modules, not endpoints; api/passkey.js is the endpoint. No npm dependency: CBOR, COSE
// keys, authenticator data and DER signatures are read here, and signatures are checked with WebCrypto (crypto.subtle), which
// Node 22 and the Cloudflare Worker both have.
//
// What is checked (registration and sign-in alike): the client data's type, its challenge (an HMAC-signed, 5-minute token made
// by this server for this operation and, for a registration, this account), its origin (the request's own https origin, or
// http(s)://localhost), the authenticator data's RP ID hash (rpFor), the user-present AND user-verified flags (UV = the face or
// the fingerprint, never a bare tap), and on sign-in the signature over authenticatorData || SHA-256(clientDataJSON) and the
// sign counter (a counter that does not grow is refused once it is non-zero). Attestation is not verified: the server asks
// for 'none' (no device certificate is wanted or stored); the public key comes from the authenticator data.
const crypto = require('node:crypto');

const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || crypto.webcrypto.subtle;
const b64u = (b) => Buffer.from(b).toString('base64url');
const unb64u = (s) => { if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(s) || s.length > 20000) throw new Error('bad base64url'); return new Uint8Array(Buffer.from(s, 'base64url')); };
const sha256 = (b) => new Uint8Array(crypto.createHash('sha256').update(b).digest());

// ---- CBOR (RFC 8949), the subset WebAuthn uses: definite lengths only; maps come back as Map (COSE keys are integers) ----
function cborDecode(buf, start = 0, depth = 0) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let p = start;
  if (depth > 16) throw new Error('cbor: too deep');
  const need = (n) => { if (p + n > u.length) throw new Error('cbor: truncated'); };
  need(1); const ib = u[p++], mt = ib >> 5, ai = ib & 31;
  const len = () => {
    if (ai < 24) return ai;
    if (ai === 24) { need(1); return u[p++]; }
    if (ai === 25) { need(2); const v = (u[p] << 8) | u[p + 1]; p += 2; return v; }
    if (ai === 26) { need(4); const v = ((u[p] << 24) >>> 0) + (u[p + 1] << 16) + (u[p + 2] << 8) + u[p + 3]; p += 4; return v; }
    if (ai === 27) { need(8); let v = 0; for (let i = 0; i < 8; i++) v = v * 256 + u[p + i]; p += 8; if (!Number.isSafeInteger(v)) throw new Error('cbor: integer too large'); return v; }
    throw new Error('cbor: indefinite or reserved length');
  };
  if (mt === 7) {
    if (ai === 20) return [false, p]; if (ai === 21) return [true, p]; if (ai === 22) return [null, p]; if (ai === 23) return [undefined, p];
    if (ai === 25) { need(2); const h = (u[p] << 8) | u[p + 1]; p += 2; const e = (h >> 10) & 31, f = h & 1023, s = h >> 15 ? -1 : 1;
      return [s * (e === 0 ? f * 2 ** -24 : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * 2 ** (e - 15)), p]; }
    if (ai === 26) { need(4); const v = new DataView(u.buffer, u.byteOffset + p, 4).getFloat32(0); p += 4; return [v, p]; }
    if (ai === 27) { need(8); const v = new DataView(u.buffer, u.byteOffset + p, 8).getFloat64(0); p += 8; return [v, p]; }
    if (ai < 24) return [ai, p];
    throw new Error('cbor: unsupported simple value');
  }
  const n = len();
  if (mt === 0) return [n, p];
  if (mt === 1) return [-1 - n, p];
  if (mt === 2) { need(n); const v = u.slice(p, p + n); p += n; return [v, p]; }
  if (mt === 3) { need(n); const v = Buffer.from(u.slice(p, p + n)).toString('utf8'); p += n; return [v, p]; }
  if (mt === 4) { if (n > 1000) throw new Error('cbor: array too long'); const a = []; for (let i = 0; i < n; i++) { const [v, q] = cborDecode(u, p, depth + 1); a.push(v); p = q; } return [a, p]; }
  if (mt === 5) { if (n > 1000) throw new Error('cbor: map too long'); const m = new Map(); for (let i = 0; i < n; i++) { const [k, q] = cborDecode(u, p, depth + 1); const [v, r] = cborDecode(u, q, depth + 1); m.set(k, v); p = r; } return [m, p]; }
  if (mt === 6) return cborDecode(u, p, depth + 1);   // a tag: its content
  throw new Error('cbor: bad major type');
}
const cbor = (buf) => { const [v, end] = cborDecode(buf); if (end !== buf.length) throw new Error('cbor: trailing bytes'); return v; };
const mget = (m, k) => (m instanceof Map ? m.get(k) : m && m[k]);

// ---- authenticator data (WebAuthn §6.1) ----
const FLAG = { UP: 0x01, UV: 0x04, AT: 0x40, ED: 0x80 };
function parseAuthData(ad) {
  if (!(ad instanceof Uint8Array) || ad.length < 37) throw new Error('authenticator data too short');
  const out = { rpIdHash: ad.slice(0, 32), flags: ad[32], counter: new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0) };
  if (ad[32] & FLAG.AT) {
    if (ad.length < 55) throw new Error('attested credential data too short');
    const L = (ad[53] << 8) | ad[54]; if (L < 16 || L > 1023 || ad.length < 55 + L) throw new Error('bad credential id length');
    out.aaguid = ad.slice(37, 53); out.credId = ad.slice(55, 55 + L);
    const [key, end] = cborDecode(ad, 55 + L); out.cose = key;
    if (!(ad[32] & FLAG.ED) && end !== ad.length) throw new Error('trailing bytes after the public key');
  }
  return out;
}

// ---- COSE key -> JWK (ES256 on P-256 and RS256 only: the algorithms the options ask for) ----
const ALGS = [-7, -257];
function coseToJwk(m) {
  const kty = mget(m, 1), alg = mget(m, 3);
  if (kty === 2 && alg === -7 && mget(m, -1) === 1) { const x = mget(m, -2), y = mget(m, -3);
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) throw new Error('bad EC key');
    return { alg: -7, jwk: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) } }; }
  if (kty === 3 && alg === -257) { const n = mget(m, -1), e = mget(m, -2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array) || n.length < 256 || n.length > 512 || e.length > 8) throw new Error('bad RSA key');
    return { alg: -257, jwk: { kty: 'RSA', n: b64u(n), e: b64u(e) } }; }
  throw new Error('unsupported key type');
}
const algParams = (alg) => (alg === -7 ? { imp: { name: 'ECDSA', namedCurve: 'P-256' }, ver: { name: 'ECDSA', hash: 'SHA-256' } }
  : alg === -257 ? { imp: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, ver: { name: 'RSASSA-PKCS1-v1_5' } } : null);
async function importKey(alg, jwk) { const P = algParams(alg); if (!P) throw new Error('unsupported algorithm'); return subtle().importKey('jwk', { ...jwk, ext: true }, P.imp, false, ['verify']); }

// ECDSA signatures in WebAuthn are DER (SEQUENCE { INTEGER r, INTEGER s }); WebCrypto wants raw r || s, 32 bytes each
function derToRaw(der, size = 32) {
  const d = der instanceof Uint8Array ? der : new Uint8Array(der); let p = 0;
  const len = () => { let l = d[p++]; if (l & 0x80) { const n = l & 0x7f; if (n < 1 || n > 2) throw new Error('bad DER length'); l = 0; for (let i = 0; i < n; i++) l = (l << 8) | d[p++]; } return l; };
  if (d[p++] !== 0x30) throw new Error('bad DER sequence'); const total = len(); if (p + total !== d.length) throw new Error('bad DER length');
  const int = () => { if (d[p++] !== 0x02) throw new Error('bad DER integer'); const l = len(); if (l < 1 || l > size + 1 || p + l > d.length) throw new Error('bad DER integer length'); let v = d.slice(p, p + l); p += l;
    while (v.length > size && v[0] === 0) v = v.slice(1); if (v.length > size) throw new Error('DER integer too large'); const o = new Uint8Array(size); o.set(v, size - v.length); return o; };
  const r = int(), s = int(); if (p !== d.length) throw new Error('trailing DER bytes');
  const out = new Uint8Array(size * 2); out.set(r, 0); out.set(s, size); return out;
}
async function verifySig(alg, jwk, sig, data) {
  const P = algParams(alg); if (!P) return false;
  try { const key = await importKey(alg, jwk); return await subtle().verify(P.ver, key, alg === -7 ? derToRaw(sig) : sig, data); } catch (e) { return false; }
}

// ---- RP ID and origin: one passkey for aureumdesk.co.uk and www; the Worker's own host and localhost as themselves ----
const SITE = 'aureumdesk.co.uk', HOSTS = ['meridianx.meridianx-cloudflare.workers.dev', 'localhost'];
function hostOf(req) { return String((req && req.headers && req.headers.host) || '').toLowerCase().trim(); }
function rpFor(host, env = {}) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '');
  if (h === SITE || h === 'www.' + SITE) return SITE;
  const extra = String(env.PASSKEY_HOSTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return HOSTS.includes(h) || extra.includes(h) ? h : null;
}
function originOk(origin, host) {
  const h = String(host || '').toLowerCase(); if (typeof origin !== 'string' || !h) return false;
  if (origin === `https://${h}`) return true;
  return /^localhost(:\d+)?$/.test(h) && origin === `http://${h}`;
}

// ---- challenges: stateless, HMAC-signed with a key derived from the session key, 5 minutes, one use (the nonce is kept) ----
const CHALLENGE_MS = 5 * 60e3;
const ckey = (secret) => crypto.createHmac('sha256', secret).update('aureum/passkey-challenge/v1').digest();
function makeChallenge(secret, { t, u, rp }, now = Date.now()) {
  const body = b64u(JSON.stringify({ k: 'pk', t, u: u || null, rp, n: b64u(crypto.randomBytes(18)), exp: now + CHALLENGE_MS }));
  const tok = `${body}.${b64u(crypto.createHmac('sha256', ckey(secret)).update(body).digest())}`;
  return b64u(Buffer.from(tok, 'utf8'));   // the bytes the browser signs over, as base64url
}
function readChallenge(secret, ch, now = Date.now()) {
  let tok; try { tok = Buffer.from(unb64u(ch)).toString('utf8'); } catch (e) { return null; }
  const [body, m, extra] = tok.split('.'); if (!body || !m || extra !== undefined) return null;
  const want = b64u(crypto.createHmac('sha256', ckey(secret)).update(body).digest());
  if (want.length !== m.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(m))) return null;
  let o; try { o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  return o && o.k === 'pk' && typeof o.n === 'string' && o.exp > now && o.exp <= now + CHALLENGE_MS + 60e3 ? o : null;
}
// the opaque user handle the authenticator keeps: never the account key itself
const userHandle = (secret, u) => b64u(crypto.createHmac('sha256', secret).update(`aureum/passkey-user|${u}`).digest().subarray(0, 16));

// the client data: type, challenge and origin
function clientData(b64, type, host) {
  const raw = unb64u(b64); let c; try { c = JSON.parse(Buffer.from(raw).toString('utf8')); } catch (e) { throw new Error('client data is not JSON'); }
  if (!c || c.type !== type) throw new Error('wrong client data type');
  if (c.crossOrigin === true) throw new Error('cross-origin');
  if (!originOk(c.origin, host)) throw new Error('wrong origin');
  return { raw, c };
}
const flagsOk = (f) => !!(f & FLAG.UP) && !!(f & FLAG.UV);

// a label for the device a passkey was made on, from its User-Agent (editable by the member)
function deviceLabel(ua) {
  const s = String(ua || '');
  if (/iPhone/.test(s)) return 'iPhone'; if (/iPad/.test(s)) return 'iPad'; if (/Android/.test(s)) return 'Android phone';
  if (/Macintosh|Mac OS X/.test(s)) return 'Mac'; if (/Windows/.test(s)) return 'Windows PC'; if (/CrOS/.test(s)) return 'Chromebook'; if (/Linux/.test(s)) return 'Linux computer';
  return 'This device';
}
const cleanName = (s) => String(s == null ? '' : s).replace(/[<>"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

module.exports = { b64u, unb64u, sha256, cborDecode, cbor, parseAuthData, coseToJwk, importKey, derToRaw, verifySig, rpFor, originOk, hostOf,
  makeChallenge, readChallenge, userHandle, clientData, flagsOk, deviceLabel, cleanName, FLAG, ALGS, CHALLENGE_MS, SITE };
