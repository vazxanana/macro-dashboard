// MeridianX Academy store (module, not an endpoint): small JSON files in the private Vercel Blob store, the same pattern as
// api/notify.js. Everything lives under academy/ (academy-preview/ on a preview deployment, see rootFor):
//   lessons.json · attempts/<edge>.json · corrections/<edge>.json · sessions/index.json + sessions/<id>.json ·
//   seen/<edge>.json (candidate ids ever shown, with mode) · exams/<edge>.json · blind.json · dataset/<edge>.json (Layer B rows) ·
//   notebook.json · models.json · cost.json · llm-cache.json · audit/<YYYY-MM>.json
//
// Rules of the store:
//   - A missing file reads as the fallback. A FAILED read throws (never looks empty: the next write would wipe the file).
//   - update / tx are read-modify-write under a per-process queue per key, so two requests in one function instance cannot
//     interleave on a file. tx reads every file it needs BEFORE it writes any: a failed read means nothing was written.
//   - Row files ({ v, archives, rows }) have a size cap. Past the cap the oldest rows move to <name>-archive-<n>.json (written
//     before the trimmed file), they are never dropped.
//   - memoryStore() and fileStore(dir) are the same API over a Map / a folder, for tests and local runs.
// Limit, stated honestly: the queue is per function instance. Two instances that both read a file and then both write it within
// the same few milliseconds can still lose one of the writes, so the page sends its writes one at a time. Reads ask the origin
// (see blobBackend), which closes the minute-long window; what is left is the gap between a read and its write. The Blob client
// has a conditional write (`ifMatch` with the listed ETag) that would close that too; it is NOT used yet because it could not be
// tried against the real service from the build sandbox, and a wrong ETag form would refuse every save.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'academy/';
// A preview or development deployment shares the project's Blob store with production, so it gets its own folder: nothing a
// preview writes can touch (or be mistaken for) the production Academy's files. Production and local runs keep academy/.
const PREVIEW_ROOT = 'academy-preview/';
const rootFor = (env) => { const e = env && env.VERCEL_ENV; return e && e !== 'production' ? PREVIEW_ROOT : ROOT; };
const KEY_RE = /^[a-z0-9][a-z0-9_.-]*(\/[a-z0-9][a-z0-9_.-]*)*\.json$/;
function checkKey(k) { if (typeof k !== 'string' || k.length > 160 || !KEY_RE.test(k) || k.includes('..')) throw new Error(`bad store key: ${String(k).slice(0, 80)}`); return k; }
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const fail = (what, e) => Object.assign(new Error(`academy store: ${what} failed${e && e.message ? ` (${e.message})` : ''}`), { store: true, status: 503 });

// ---- row files ------------------------------------------------------------------------------------------------------
const emptyRows = () => ({ v: 1, archives: 0, rows: [] });
// a stored row file as { v, archives, rows }; anything else is corrupt and throws (never treated as empty)
function asRows(doc, key) {
  if (doc == null) return emptyRows();
  if (Array.isArray(doc)) return { v: 1, archives: 0, rows: doc };
  if (typeof doc !== 'object' || !Array.isArray(doc.rows)) throw fail(`read ${key || 'rows'}: not a row file`);
  return { ...doc, v: 1, archives: Number.isInteger(doc.archives) && doc.archives > 0 ? doc.archives : 0 };
}
const archiveKey = (key, n) => key.replace(/\.json$/, `-archive-${n}.json`);
// past the cap: keep the newest half, move the rest to the next archive file. -> { doc, archive: { key, value } | null }
function roll(key, doc, cap) {
  if (!(cap > 0) || !doc || !Array.isArray(doc.rows) || doc.rows.length <= cap) return { doc, archive: null };
  const keep = Math.max(1, Math.ceil(cap / 2)), n = (doc.archives || 0) + 1, cut = doc.rows.length - keep;
  return { doc: { ...doc, archives: n, rows: doc.rows.slice(cut) }, archive: { key: archiveKey(key, n), value: { v: 1, of: key, n, rows: doc.rows.slice(0, cut) } } };
}

// ---- the store over a backend { read(key) -> value | undefined (missing; throws on failure), write(key, value) } ----------------
function make(backend, tails = new Map()) {
  async function acquire(k) {
    const prev = tails.get(k) || Promise.resolve(); let release; const mine = new Promise((r) => { release = r; });
    const tail = prev.then(() => mine); tails.set(k, tail); await prev;
    return () => { release(); if (tails.get(k) === tail) tails.delete(k); };
  }
  // keys are taken in sorted order, so two multi-file writes can never wait on each other
  async function locked(keys, fn) {
    const ks = [...new Set(keys.map(checkKey))].sort(), rel = [];
    try { for (const k of ks) rel.push(await acquire(k)); return await fn(); } finally { rel.reverse().forEach((r) => r()); }
  }
  const read = async (key, fallback) => { let v; try { v = await backend.read(checkKey(key)); } catch (e) { throw e && e.store ? e : fail(`read ${key}`, e); } return v === undefined || v === null ? clone(fallback) : v; };
  const write = async (key, value) => { try { await backend.write(checkKey(key), value); } catch (e) { throw fail(`write ${key}`, e); } };
  const S = {
    backend,
    get: (key, fallback = null) => read(key, fallback),
    put: (key, value) => locked([key], () => write(key, value)),
    // fn(current) -> the next value; returning undefined leaves the file as it is
    update: (key, fallback, fn) => locked([key], async () => { const cur = await read(key, fallback), next = await fn(cur); if (next === undefined) return cur; await write(key, next); return next; }),
    // Several files as one step. spec: { name: [key, fallback, cap?] }. fn(values by name) -> { write: { name: value }, result }.
    // Every file is read first (a failed read: nothing written); row files past their cap are rolled into an archive.
    tx: (spec, fn) => locked(Object.values(spec).map((s) => s[0]), async () => {
      // what each file held before the step (as text, so nothing fn does to a value can change it): undefined = no file
      const names = Object.keys(spec), before = new Map(), vals = {};
      const got = await Promise.all(names.map(async (n) => { const k = checkKey(spec[n][0]); let v; try { v = await backend.read(k); } catch (e) { throw e && e.store ? e : fail(`read ${k}`, e); } const none = v === undefined || v === null; before.set(k, none ? undefined : JSON.stringify(v)); return none ? clone(spec[n][1]) : v; }));
      names.forEach((n, i) => { vals[n] = got[i]; });
      const out = (await fn(vals)) || {}, w = out.write || {}, steps = [];
      for (const name of Object.keys(w)) {
        const s = spec[name]; if (!s) throw new Error(`tx: ${name} was not declared`);
        const r = s[2] ? roll(s[0], w[name], s[2]) : { doc: w[name], archive: null };
        if (r.archive) steps.unshift([r.archive.key, r.archive.value]);   // archives first: a crash in between duplicates rows, it never loses them
        steps.push([s[0], r.doc]);
      }
      // all or nothing: when a later write fails, the files already written are put back (a file the step created is removed).
      // The undo is best effort; the audit file is the last write of every step, so a step that did not finish has no audit row.
      const done = [];
      try { for (const [k, v] of steps) { await write(k, v); done.push(k); } } catch (e) {
        for (const k of done.reverse()) { try { const old = before.get(k); if (old !== undefined) await backend.write(k, JSON.parse(old)); else if (backend.remove) await backend.remove(k); } catch (e2) { /* the failure itself is what is reported */ } }
        throw e;
      }
      return out.result;
    }),
    // append rows to a row file (with its cap)
    append: (key, rows, cap) => S.tx({ f: [key, emptyRows(), cap] }, ({ f }) => { const d = asRows(f, key); return { write: { f: { ...d, rows: d.rows.concat(rows) } }, result: d.rows.length + rows.length }; }),
    // the rows of a row file; all = true also reads its archives (oldest first)
    async rows(key, all = false) {
      const d = asRows(await read(key, null), key); if (!all || !d.archives) return d.rows;
      let out = []; for (let n = 1; n <= d.archives; n++) { const a = await read(archiveKey(key, n), null); if (a && Array.isArray(a.rows)) out = out.concat(a.rows); }
      return out.concat(d.rows);
    },
  };
  return S;
}

// ---- backends ---------------------------------------------------------------------------------------------------------
// In memory (tests): raw is the Map of key -> JSON text. Patch store.backend.read / .write to simulate failures.
function memoryStore(seed = {}) {
  const raw = new Map(Object.entries(seed).map(([k, v]) => [checkKey(k), JSON.stringify(v)]));
  const backend = { read: async (k) => (raw.has(k) ? JSON.parse(raw.get(k)) : undefined), write: async (k, v) => { raw.set(k, JSON.stringify(v)); }, remove: async (k) => { raw.delete(k); } };
  return Object.assign(make(backend), { raw, keys: () => [...raw.keys()].sort(), peek: (k) => (raw.has(k) ? JSON.parse(raw.get(k)) : undefined) });
}
// A folder of JSON files (local runs: env ACADEMY_STORE_DIR). A file that exists but cannot be read or parsed throws.
function fileStore(dir) {
  const at = (k) => path.join(dir, ...k.split('/'));
  const backend = {
    async read(k) { let txt; try { txt = await fs.promises.readFile(at(k), 'utf8'); } catch (e) { if (e && e.code === 'ENOENT') return undefined; throw e; } return JSON.parse(txt); },
    async write(k, v) { const f = at(k), tmp = `${f}.${process.pid}.tmp`; await fs.promises.mkdir(path.dirname(f), { recursive: true }); await fs.promises.writeFile(tmp, JSON.stringify(v)); await fs.promises.rename(tmp, f); },
    async remove(k) { try { await fs.promises.unlink(at(k)); } catch (e) { if (!e || e.code !== 'ENOENT') throw e; } },
  };
  return Object.assign(make(backend), { dir });
}
// The private Blob store. Same options as api/notify.js. io = { blob, fetch } for tests.
// A function instance remembers what it wrote for a minute: a read straight after an overwrite can otherwise be served the old
// bytes. Its own copy is used only while the listing shows no newer upload by someone else.
// Every other read asks the ORIGIN (`?cache=0`, what the Blob client's own get(..., { useCache: false }) sends for a private
// file), never the CDN copy: an overwritten file is served from the CDN with its old bytes for up to a minute, so ANOTHER
// instance (a new deployment, a second region) read a file without the row just stored ("no such attempt for this edge",
// 11 Nov 2026), and a write made from such a read would have dropped that row for good.
const BLOB_TAILS = new Map(), RECENT = new Map(), RECENT_MS = 60e3;
function blobBackend(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, recent = io.recent || RECENT, now = io.now || Date.now, ROOT = rootFor(env), BASE = io.root || ROOT;   // io.root: another feature's own folder set in code (the edge analyst), never from a request
  return {
    async read(k) {
      const P = BASE + k, { blobs } = await B().list({ prefix: P, token }), b = blobs.find((x) => x.pathname === P); if (!b) return undefined;
      const mine = recent.get(P), up = b.uploadedAt ? new Date(b.uploadedAt).getTime() : NaN;
      // Its own copy only while the file in the store is still the one it wrote: by the ETag the write returned when the service
      // gives one (exact), else by the upload time. The time rule alone let a write by ANOTHER instance within 1.5 s of this
      // one's go unseen for a minute, and this instance's next write then dropped it (11 Nov 2026).
      if (mine && now() - mine.at < RECENT_MS && (mine.etag && b.etag ? b.etag === mine.etag : !(up > mine.at + 1500))) return JSON.parse(mine.json);
      const u = new URL(b.url); u.searchParams.set('cache', '0');
      const r = await F(u.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`blob read ${r.status}`);   // a failed read never looks empty
      return r.json();
    },
    async write(k, v) {
      const P = BASE + k, json = JSON.stringify(v);
      const done = await B().put(P, json, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token });
      recent.set(P, { json, at: now(), etag: (done && done.etag) || null }); if (recent.size > 200) recent.delete(recent.keys().next().value);
    },
    // only ever a file this same step created a moment ago (the undo of a write step that failed half way)
    async remove(k) { const P = BASE + k, { blobs } = await B().list({ prefix: P, token }), b = blobs.find((x) => x.pathname === P); recent.delete(P); if (b) await B().del(b.url, { token }); },
  };
}
const blobStore = (env, io = {}) => make(blobBackend(env, io), io.tails || BLOB_TAILS);

module.exports = { ROOT, PREVIEW_ROOT, rootFor, checkKey, emptyRows, asRows, roll, archiveKey, make, memoryStore, fileStore, blobStore, blobBackend };
