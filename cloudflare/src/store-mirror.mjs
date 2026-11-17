// Keeps the D1 file store (src/store-d1.mjs) a near-live copy of the Vercel Blob store, so the switch STORE=d1 can be thrown.
// Runs from the crons (worker.mjs `scheduled`). Reads the Vercel store only (the real package, never the switch), at most
// PER_RUN files / BYTES_PER_RUN bytes a run (Workers limit the requests of one run), and goes on next run.
// - STORE not 'd1' (Vercel is the site's store), 10-minute cron: copy every Vercel file that is new or changed (uploadedAt /
//   size), delete the copies of files Vercel no longer has; a file the site wrote here in an earlier D1 period (src 'd1') is
//   never overwritten or deleted (counted as `kept`). A run that finishes with nothing left and nothing failed records
//   `ready` (the D1 store then holds a complete copy; D1 mode refuses to serve until it does).
// - STORE = 'd1': ONE final pass copies only Vercel files newer than their D1 row and newer than any delete made here, and
//   removes copies of files Vercel deleted before the switch; writes made after the switch are never overwritten (the commit
//   itself checks it). It runs on the minute cron too during the first hour after the switch is seen, then on the 10-minute
//   one; once complete (`final.done`) the mirror stops. STORE_MIRROR=off stops it in either mode.
import { d1Store, isD1, mirrorOff, MAX_BYTES } from './store-d1.mjs';

export const TEN = '*/10 * * * *';
export const PER_RUN = 100;
export const BYTES_PER_RUN = 48 * 1024 * 1024;
export const FAST_MS = 3600e3;
const MEMO = new WeakMap();   // per database object, per isolate: { finalDone, cleared }
const memoOf = (db) => { let m = MEMO.get(db); if (!m) MEMO.set(db, (m = {})); return m; };

export async function storeMirror(env, deps = {}) {
  const db = env && env.STORE_DB, every = (deps.cron || TEN) === TEN, d1 = isD1(env);
  if (!db) return { skip: 'no STORE_DB binding', quiet: !every };
  const memo = memoOf(db), now = deps.now != null ? deps.now : Date.now(), iso = new Date(now).toISOString();
  const st = d1Store(db, { now: () => now });
  if (!every && !d1) {
    // the minute cron with the switch off: once an isolate, forget a finished D1 period (a switch back), so the next switch
    // to D1 gets its own final pass
    if (!memo.cleared) { await st.ensure(); const s = await st.state(); if (s.final || s.switchedAt) await st.setState({ ...s, final: null, switchedAt: null }); memo.cleared = true; }
    return { quiet: true };
  }
  if (d1 && memo.finalDone && !every) return { quiet: true };
  await st.ensure();
  let state = await st.state();
  const out = { at: iso, mode: d1 ? 'd1' : 'mirror' };
  const done = !!(state.final && state.final.done);
  if (every) out.housekeeping = await st.housekeep(now, !d1 || done);   // tombstones are only needed by a final pass
  if (mirrorOff(env)) return { ...out, skip: 'STORE_MIRROR is off', quiet: !every };
  if (d1) {
    if (done) { memo.finalDone = true; return { ...out, skip: 'final pass done', final: state.final.done, quiet: !every }; }
    if (!state.switchedAt) { state = { ...state, switchedAt: iso }; await st.setState(state); }
    if (!every && now - Date.parse(state.switchedAt) > FAST_MS) return { quiet: true };
  } else if (state.final || state.switchedAt) state = { ...state, final: null, switchedAt: null };
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ...out, skip: 'no BLOB_READ_WRITE_TOKEN' };
  const list = deps.list || (await import('vercel-blob-real')).list, F = deps.fetch || fetch;
  const perRun = deps.perRun || PER_RUN;

  const vercel = [];
  let cursor;
  do { const r = await list({ token, cursor, limit: 1000 }); vercel.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  const rows = new Map((await st.rows()).map((r) => [r.pathname, r])), gone = new Map((await st.gone()).map((g) => [g.pathname, g.at]));
  const seen = new Set(), copy = [], errors = [];
  let failed = 0;
  for (const b of vercel) {
    seen.add(b.pathname);
    const up = new Date(b.uploadedAt).getTime(), r = rows.get(b.pathname);
    if (!Number.isFinite(up)) { failed++; errors.push(`${b.pathname}: no upload time`); continue; }
    if (d1) { if (r ? r.uploaded_at < up : !(gone.has(b.pathname) && gone.get(b.pathname) >= up)) copy.push([b, up]); }
    else if (!r || (r.src === 'vercel' && (r.uploaded_at !== up || r.size !== b.size))) copy.push([b, up]);
  }
  const kept = d1 ? undefined : [...rows.values()].filter((r) => r.src !== 'vercel').length;
  const drop = [...rows.values()].filter((r) => r.src === 'vercel' && !seen.has(r.pathname)).map((r) => r.pathname);
  let left = Math.max(0, drop.length - perRun);
  const del = drop.slice(0, perRun);
  if (del.length) await st.dropMirrored(del);
  let copied = 0, skipped = 0, bytes = 0;
  for (const [b, up] of copy) {
    if (copied + skipped + failed >= perRun || bytes >= BYTES_PER_RUN) { left++; continue; }
    try {
      if (b.size > MAX_BYTES) throw new Error(`larger than the store keeps (${MAX_BYTES} bytes)`);
      const u = new URL(b.url); u.searchParams.set('cache', '0');
      const r = await F(u.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!r.ok) throw new Error(`read ${r.status}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length !== b.size) throw new Error(`changed while copied (${buf.length} of ${b.size} bytes)`);
      const w = await st.write(b.pathname, buf, { mode: d1 ? 'final' : 'follow', contentType: r.headers.get('content-type') || 'application/octet-stream', uploadedAt: up });
      if (w.applied) { copied++; bytes += buf.length; } else skipped++;
    } catch (e) { failed++; if (errors.length < 5) errors.push(`${b.pathname}: ${e && e.message || e}`); }
  }
  const complete = left === 0 && failed === 0;
  const last = { at: iso, mode: out.mode, blobs: vercel.length, copied, skipped, deleted: del.length, kept, failed, left, bytes };
  if (complete) { state.ready = state.ready || iso; if (d1) { state.final = { done: iso }; memo.finalDone = true; } }
  state.last = last;
  await st.setState(state);
  return { ...out, ...last, complete, ready: state.ready || null, ...(errors.length ? { errors } : {}) };
}
