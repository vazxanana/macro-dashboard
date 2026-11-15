// Guest cuts made by the council loop (15 Nov 2026). The site's /cdata function used to cut each guest file on every visitor
// request (api/_guestcut.js: JSON.parse of a 1.6 MB trades.json and a 2 MB ict/replay.json); on a host that allows a few ms of
// CPU a request that is too much. The loop (council.yml, after each full round's save) runs this once a round instead:
//   node scripts/guest-cut.mjs <council-data dir>
// For each of G.CUT_FILES it writes guest/<same path> = G.cut(p, source, key) (only when the bytes changed) and
// guest/_index.json = { at, key, files: { <p>: { srcSha, sha } | { error } } } (hex sha256 of the source and of the cut).
// api/data.js serves guest/<p> to a visitor while the index is under 30 minutes old and the cut's sha matches, else cuts on the
// fly as before. A file that is missing or does not parse keeps its old cut, is marked { error } (so data.js cuts on the fly
// for it) and the script still exits 0: it must never fail the round.
// Key: env GUEST_ID_KEY, else the session secret data.js would use (api/data.js guestKey: the same rule on both sides).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { writeIfChanged, writeAtomic } from '../council/jsonio.mjs';
const require = createRequire(import.meta.url);
const G = require('../api/_guestcut.js');
const { guestKey } = require('../api/data.js');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

export function makeCuts(dir, env = process.env, now = Date.now()) {
  const key = guestKey(env), files = {}, written = [];
  for (const p of G.CUT_FILES) {
    let src;
    try { src = fs.readFileSync(path.join(dir, p)); } catch (e) { files[p] = { error: 'missing' }; continue; }
    let out;
    try { out = G.cut(p, src, key); } catch (e) { files[p] = { error: String(e.message || e).slice(0, 120) }; continue; }
    if (writeIfChanged(path.join(dir, 'guest', p), out.toString('utf8'))) written.push(p);
    files[p] = { srcSha: sha(src), sha: sha(out) };
  }
  const index = { at: new Date(now).toISOString(), keyed: !!env.GUEST_ID_KEY, files };
  writeAtomic(path.join(dir, 'guest', '_index.json'), JSON.stringify(index, null, 1) + '\n');
  return { index, written };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) { console.log('usage: node scripts/guest-cut.mjs <council-data dir>'); process.exit(0); }
  try {
    const { index, written } = makeCuts(dir);
    const bad = Object.entries(index.files).filter(([, v]) => v.error).map(([p, v]) => `${p} (${v.error})`);
    console.log(`Guest cuts: ${written.length} written${bad.length ? `; kept old for ${bad.join(', ')}` : ''}`);
  } catch (e) { console.log('Guest cuts failed: ' + String(e.message || e)); }
  process.exit(0);
}
