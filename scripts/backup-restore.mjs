// Restore a backup made on the Profile page ("Download a backup", api/backup.js). Runs on any computer with Node 18+.
//   node scripts/backup-restore.mjs check <backup.json>          what the file holds (no write)
//   node scripts/backup-restore.mjs files <backup.json> <dir>    every stored file written under <dir> at its own path (for any platform)
//   BLOB_READ_WRITE_TOKEN=... node scripts/backup-restore.mjs blob <backup.json>
//                                                                 every file put back into a Vercel Blob store at the same path
// The backup holds the user list with its password hashes, cTrader link tokens and the rest of the private store: keep it off
// GitHub and any shared folder. Guide: docs/platform-backup.md.
import fs from 'node:fs';
import path from 'node:path';

export function read(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!j || j.v !== 1 || !Array.isArray(j.files)) throw new Error('not a Meridian X backup (v 1)');
  return j;
}
export const bytes = (f) => Buffer.from(f.data, f.enc === 'base64' ? 'base64' : 'utf8');
// a stored path is plain segments: never absolute, never "..", so a file can only land inside <dir>
export function safePath(p) {
  const s = String(p || '');
  if (!s || s.startsWith('/') || s.includes('\\') || s.split('/').some((x) => !x || x === '.' || x === '..')) throw new Error(`refused path: ${s}`);
  return s;
}
export function check(j) {
  const n = j.files.length, sz = j.files.reduce((s, f) => s + bytes(f).length, 0), bad = j.files.filter((f) => bytes(f).length !== f.size).map((f) => f.pathname);
  return { at: j.at, files: n, bytes: sz, storeCount: j.store && j.store.count, complete: !!(j.store && j.store.count === n), sizeMismatch: bad, flags: j.flags || {}, envSet: j.env || {} };
}
export function toDir(j, dir) {
  for (const f of j.files) { const p = path.join(dir, safePath(f.pathname)); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, bytes(f)); }
  fs.writeFileSync(path.join(dir, '_backup-info.json'), JSON.stringify({ at: j.at, store: j.store, flags: j.flags || {}, env: j.env || {}, files: j.files.map((f) => ({ pathname: f.pathname, size: f.size, contentType: f.contentType, uploadedAt: f.uploadedAt })) }, null, 2));
  return j.files.length;
}
export async function toBlob(j, token, put) {
  if (!token) throw new Error('set BLOB_READ_WRITE_TOKEN to the new store\'s token');
  put = put || (await import('@vercel/blob')).put;
  let n = 0;
  for (const f of j.files) { await put(safePath(f.pathname), bytes(f), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: f.contentType || undefined, token }); n++; }
  return n;
}

const [cmd, file, dir] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (!cmd || !file) throw new Error('usage: check|files|blob <backup.json> [dir]');
    const j = read(file), c = check(j);
    console.log(`backup of ${c.at}: ${c.files} files, ${c.bytes} bytes${c.complete ? '' : ` (the store had ${c.storeCount}: INCOMPLETE)`}`);
    if (c.sizeMismatch.length) throw new Error(`files whose size does not match: ${c.sizeMismatch.join(', ')}`);
    if (cmd === 'check') console.log(JSON.stringify({ flags: c.flags, envSet: c.envSet }, null, 2));
    else if (cmd === 'files') { if (!dir) throw new Error('give a folder'); console.log(`${toDir(j, dir)} files written under ${dir}`); }
    else if (cmd === 'blob') console.log(`${await toBlob(j, process.env.BLOB_READ_WRITE_TOKEN)} files put into the Blob store`);
    else throw new Error(`unknown command ${cmd}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
