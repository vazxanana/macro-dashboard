// One-time copy of the Vercel Blob store to the Cloudflare R2 bucket the Worker reads (15 Nov 2026, the move to Cloudflare;
// docs/cloudflare.md). Run by .github/workflows/blob-to-r2.yml; by hand:
//   BLOB_READ_WRITE_TOKEN=… node --use-env-proxy scripts/blob-to-r2.mjs export <dir>   every blob → <dir>/<pathname>
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/blob-to-r2.mjs import <dir>   every file → R2, same key
// The R2 key is the Vercel pathname exactly (the Worker's Blob shim keys objects that way). The exported files hold password
// hashes, profiles and lessons: keep the directory out of git and delete it when done. Prints counts, never a token.
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BUCKET = 'meridianx-blob';
export const WRANGLER = 'wrangler@4.140.0';

// A Vercel pathname is used as a relative path below <dir>: refuse anything that could leave it.
export function safePath(p) {
  const s = String(p || '');
  if (!s || s.startsWith('/') || s.includes('\\') || s.includes('\0')) return null;
  if (s.split('/').some((part) => part === '' || part === '.' || part === '..')) return null;
  return s;
}

async function listAll(list, token) {
  const out = [];
  let cursor;
  do {
    const page = await list({ token, cursor, limit: 1000 });
    out.push(...(page.blobs || []));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function exportBlobs(dir, { token, list, fetchFn = fetch, log = console.log } = {}) {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const blobs = await listAll(list, token);
  let written = 0, bytes = 0, skipped = 0;
  for (const b of blobs) {
    const rel = safePath(b.pathname);
    if (!rel) { skipped++; log('skipped one blob with an unsafe pathname'); continue; }
    const res = await fetchFn(b.downloadUrl || b.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`download failed for ${rel}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(dir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buf);
    written++; bytes += buf.length;
  }
  log(`export: ${blobs.length} blobs listed, ${written} written (${bytes} bytes), ${skipped} skipped`);
  return { listed: blobs.length, written, bytes, skipped };
}

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(f, base));
    else if (e.isFile()) out.push(path.relative(base, f).split(path.sep).join('/'));
  }
  return out.sort();
}

const npx = (args) => execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'] });

export async function importFiles(dir, { run = npx, log = console.log } = {}) {
  await stat(dir);
  const files = await walk(dir);
  let uploaded = 0;
  for (const rel of files) {
    if (!safePath(rel)) continue;
    run(['--yes', WRANGLER, 'r2', 'object', 'put', `${BUCKET}/${rel}`, '--file', path.join(dir, rel), '--remote']);
    uploaded++;
  }
  log(`import: ${files.length} files found, ${uploaded} uploaded to ${BUCKET}`);
  return { found: files.length, uploaded };
}

async function main() {
  const [mode, dir] = process.argv.slice(2);
  if (!['export', 'import'].includes(mode) || !dir) {
    console.error('usage: node scripts/blob-to-r2.mjs export <dir> | import <dir>');
    process.exit(2);
  }
  if (mode === 'export') {
    const { list } = await import('@vercel/blob');
    await exportBlobs(dir, { token: process.env.BLOB_READ_WRITE_TOKEN, list });
  } else {
    await importFiles(dir);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`blob-to-r2: ${e.message}`); process.exit(1); });
}
