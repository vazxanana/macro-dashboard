// The Mosha desk's lessons (owner, 10 Nov 2026: the Mosha desk "will be main page of" Luxus, "he will train u, allow him to send
// you trades images so u can learn"). A lesson is one trade or scenario: a title, a note and up to 12 screenshots, each with
// its own caption, the way the teacher sends them ("M30 sweep high", "M5 vr", "i just took entry after bo sell"). The site's
// assistant reads the lessons and writes back what it understood, so the teacher can correct it.
//   GET  /api/mosha-lessons                 a reader -> { lessons (newest first), canTeach, who }
//   GET  /api/mosha-lessons?img=<id>        a reader -> the screenshot itself
//   GET  /api/mosha-lessons?get=reader      the owner's session -> { key } (the assistant's key, below)
//   POST { add: { lesson?, title?, note?, caption?, image } }     a teacher: a new lesson, or one more screenshot on their own
//   POST { edit: { id, title?, note?, img?, caption? } }          the lesson's teacher or the owner
//   POST { remove: { id, img? } }                                 the lesson's teacher or the owner: a lesson, or one screenshot
//   POST { reply: { id, text } }                                  the assistant or the owner: what was understood
// Readers: the owner, a member who may open the Mosha desk (api/mosha.js moshaLevel), and the assistant. Teachers: the owner
// and a member whose Mosha level is 'teach'.
// The assistant has no account: it sends "Authorization: Bearer <key>". The key is derived from the server's session secret
// (nothing new to set) and shown to the owner's session only; with it one can read the lessons and write a reply, nothing else.
//   MOSHA_READER=off        switches the key off          MOSHA_READER_SALT=<x>   changes the key (the old one stops working)
// Stored privately in the Blob store: mosha/lessons.json (300 kept) and mosha/shots/<id>.<ext>. Screenshots must be real JPEG,
// PNG or WebP files (checked by their first bytes) of at most 1.5 MB; they are served with their own image type and nosniff.
// Lessons only: nothing here places, copies or changes a trade, and no council member reads it.
const crypto = require('node:crypto');
const S = require('./_session.js');
const G = require('./_guard.js');
const { moshaLevel } = require('./mosha.js');

const KEEP = 300, MAX_SHOTS = 12, MAX_BYTES = 1.5 * 1024 * 1024, DAY_MAX = 80, ID_RE = /^[0-9]{17}[a-z0-9]{4}$/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const READER = { u: 'assistant', name: 'The desk\'s assistant', role: 'assistant' };

function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, P = 'mosha/lessons.json', IMG = 'mosha/shots/';
  const find = async (path) => { const { blobs } = await B().list({ prefix: path, token }); return blobs.find((x) => x.pathname === path) || null; };
  const read = async (b) => { const r = await F(b.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(`mosha lessons read ${r.status}`); return r; };
  return {
    async get() { const b = await find(P); if (!b) return []; const j = await (await read(b)).json(); return Array.isArray(j) ? j : []; },   // a failed read throws: a save must never overwrite the lessons with an empty list
    async put(list) { await B().put(P, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
    async putImg(id, type, buf) { await B().put(`${IMG}${id}.${TYPES[type]}`, buf, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: type, token }); },
    async getImg(id, type) { const b = await find(`${IMG}${id}.${TYPES[type]}`); if (!b) return null; return Buffer.from(await (await read(b)).arrayBuffer()); },
    async delImg(id, type) { const b = await find(`${IMG}${id}.${TYPES[type]}`); if (b) await B().del(b.url, { token }); },
  };
}

// the assistant's key, or null when the server has no session secret or the key is switched off
const off = (env) => /^(off|0|false|no)$/i.test(String((env && env.MOSHA_READER) || '').trim());
function readerKey(env = process.env) {
  if (off(env)) return null; const base = S.secret(env); if (!base) return null;
  return 'mr' + crypto.createHmac('sha256', base).update(`meridian-x/mosha-reader/v1|${String(env.MOSHA_READER_SALT || '')}`).digest('hex').slice(0, 40);
}

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const newId = (now) => new Date(now).toISOString().replace(/\D/g, '').slice(0, 17) + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
// a data URL -> { type, buf } when it really is a JPEG, PNG or WebP of an allowed size; { error } otherwise
function imageOf(dataUrl) {
  const m = typeof dataUrl === 'string' && dataUrl.length < MAX_BYTES * 1.4 + 64 ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/) : null;
  if (!m) return { error: 'send a JPEG, PNG or WebP picture of at most 1.5 MB' };
  const buf = Buffer.from(m[2], 'base64'); if (buf.length < 100 || buf.length > MAX_BYTES) return { error: 'send a JPEG, PNG or WebP picture of at most 1.5 MB' };
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), isWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const real = isJpg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null;
  if (real !== m[1]) return { error: 'that file is not the picture it says it is' };
  return { type: real, buf };
}
// what a reader sees of a lesson (the stored record as it is: it holds no secret)
const view = (l) => ({ id: l.id, by: l.by, name: l.name, at: l.at, edited: l.edited || null, title: l.title, note: l.note, shots: (l.shots || []).map((s) => ({ img: s.img, caption: s.caption, at: s.at })), reply: l.reply || null });

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })), now = d.now || Date.now();
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    let q = req.query; if (!q || typeof q !== 'object') { try { q = Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams); } catch (e) { q = {}; } }
    // who is asking: the assistant's key first (a wrong key is counted like a wrong password), else the session
    const auth = req.headers && req.headers.authorization; let acct = null, bot = false;
    if (auth) {
      const secs = G.wait(req, now); if (secs) return G.tooMany(res, secs);
      if (!G.bearerOk(auth, readerKey(env))) { G.failed(req, now); return res.status(401).json({ error: 'key not accepted' }); }
      acct = READER; bot = true;
    } else {
      if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
      acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    }
    const owner = acct.u === 'owner', level = bot ? 'read' : moshaLevel(acct);
    if (!level) return res.status(403).json({ error: 'the Mosha desk is not open to this account' });
    const teach = !bot && level === 'teach';

    if (req.method === 'GET' && q.get === 'reader') {
      if (!owner) return res.status(403).json({ error: 'only the owner sees the assistant\'s key' });
      const key = readerKey(env); return res.status(200).json({ key, off: off(env), host: String((req.headers && req.headers.host) || 'meridianx.dev').replace(/[^A-Za-z0-9.:-]/g, '').slice(0, 120) });
    }
    const list = await store.get();
    if (req.method === 'GET' && q.img != null) {
      const id = String(q.img); if (!ID_RE.test(id)) return res.status(400).json({ error: 'bad picture id' });
      let shot = null; for (const l of list) { shot = (l.shots || []).find((s) => s.img === id); if (shot) break; }
      const buf = shot && TYPES[shot.type] ? await store.getImg(id, shot.type) : null; if (!buf) return res.status(404).json({ error: 'no such picture' });
      res.setHeader('Content-Type', shot.type); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
      return res.status(200).send(buf);
    }
    if (req.method === 'GET') return res.status(200).json({ lessons: list.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).map(view), canTeach: teach, who: acct.u });

    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'bad request' });
    const obj = (v) => v && typeof v === 'object' && !Array.isArray(v), stamp = new Date(now).toISOString();
    const mine = (l) => owner || (teach && l.by === acct.u);   // a teacher changes only their own lessons

    if (obj(b.reply)) {   // what the assistant understood (the owner may write or clear it too)
      if (!bot && !owner) return res.status(403).json({ error: 'only the assistant writes the reply' });
      const l = list.find((x) => x.id === String(b.reply.id)); if (!l) return res.status(404).json({ error: 'no such lesson' });
      const text = clean(b.reply.text, 3000); l.reply = text ? { text, at: stamp, shots: (l.shots || []).length } : null;
      await store.put(list); return res.status(200).json({ ok: true, lesson: view(l) });
    }
    if (bot) return res.status(403).json({ error: 'the assistant\'s key reads the lessons and writes a reply, nothing else' });
    if (!teach) return res.status(403).json({ error: 'this account cannot send lessons' });

    if (obj(b.add)) {
      const a = b.add, im = imageOf(a.image); if (im.error) return res.status(400).json({ error: im.error });
      const day = list.reduce((n, l) => n + (l.shots || []).filter((s) => l.by === acct.u && now - Date.parse(s.at) < 86400e3).length, 0);
      if (!owner && day >= DAY_MAX) return res.status(429).json({ error: `that is ${DAY_MAX} pictures in a day: send the rest tomorrow` });
      let l = a.lesson ? list.find((x) => x.id === String(a.lesson)) : null;
      if (a.lesson && !l) return res.status(404).json({ error: 'no such lesson' });
      if (l && !mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      if (l && (l.shots || []).length >= MAX_SHOTS) return res.status(400).json({ error: `a lesson holds ${MAX_SHOTS} pictures: start a new one` });
      if (!l && list.length >= KEEP) return res.status(400).json({ error: `the desk holds ${KEEP} lessons: remove old ones first` });
      const caption = clean(a.caption, 200), img = newId(now);
      await store.putImg(img, im.type, im.buf);   // the picture first: a lesson never points at a picture that is not there
      if (!l) { l = { id: newId(now), by: acct.u, name: clean(acct.name || acct.u, 24), at: stamp, edited: null, title: clean(a.title, 80) || caption.slice(0, 80) || 'A trade', note: clean(a.note, 2000), shots: [], reply: null }; list.push(l); }
      else { l.edited = stamp; if (a.note != null && clean(a.note, 2000)) l.note = clean(a.note, 2000); }
      l.shots.push({ img, type: im.type, caption, at: stamp, bytes: im.buf.length });
      await store.put(list); return res.status(200).json({ ok: true, lesson: view(l), img });
    }
    if (obj(b.edit)) {
      const l = list.find((x) => x.id === String(b.edit.id)); if (!l) return res.status(404).json({ error: 'no such lesson' });
      if (!mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      if (b.edit.title != null) l.title = clean(b.edit.title, 80) || l.title; if (b.edit.note != null) l.note = clean(b.edit.note, 2000);
      if (b.edit.img != null) { const s = (l.shots || []).find((x) => x.img === String(b.edit.img)); if (!s) return res.status(404).json({ error: 'no such picture' }); s.caption = clean(b.edit.caption, 200); }
      l.edited = stamp; await store.put(list); return res.status(200).json({ ok: true, lesson: view(l) });
    }
    if (obj(b.remove)) {
      const l = list.find((x) => x.id === String(b.remove.id)); if (!l) return res.status(404).json({ error: 'no such lesson' });
      if (!mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      const gone = b.remove.img != null ? (l.shots || []).filter((s) => s.img === String(b.remove.img)) : (l.shots || []).slice();
      if (b.remove.img != null && !gone.length) return res.status(404).json({ error: 'no such picture' });
      const next = b.remove.img != null ? list : list.filter((x) => x !== l);
      if (b.remove.img != null) { l.shots = l.shots.filter((s) => s.img !== String(b.remove.img)); l.edited = stamp; }
      await store.put(next);   // the list first, then the files: a picture the list no longer names is only wasted space
      for (const s of gone) { try { await store.delImg(s.img, s.type); } catch (e) { /* left behind, never served: no lesson names it */ } }
      return res.status(200).json({ ok: true, removed: gone.length, lesson: b.remove.img != null ? view(l) : null });
    }
    return res.status(400).json({ error: 'nothing to do' });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'the Mosha lessons are unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
Object.assign(module.exports, { handle, blobStore, readerKey, imageOf, view, KEEP, MAX_SHOTS, MAX_BYTES, DAY_MAX });
