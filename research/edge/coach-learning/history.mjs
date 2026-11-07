// Reconstruct the Coach's live rule state over time from council-data config.json git history.
// Usage (from the repo root):
//   git log --reverse --format='%H %cI' origin/council-data -- config.json > commits.txt
//   node research/edge/coach-learning/history.mjs commits.txt out/history.json
// Reads every version with one `git cat-file --batch` call and lists each field-level change of the condition filters
// (d1, struct, noSession, noMarket, minRR...) and of the global knobs (minRR, minRisk, buf, be, newsGuard), with its time.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [, , list, out] = process.argv;
const commits = fs.readFileSync(list, 'utf8').trim().split('\n').map((l) => l.split(' '));
const buf = execFileSync('git', ['cat-file', '--batch'], { input: commits.map(([h]) => `${h}:config.json`).join('\n') + '\n', maxBuffer: 2e9 });
let p = 0; const snaps = [];
for (const [h, at] of commits) {
  const nl = buf.indexOf(10, p), hdr = buf.slice(p, nl).toString(); const size = +hdr.split(' ')[2];
  const body = buf.slice(nl + 1, nl + 1 + size).toString(); p = nl + 1 + size + 1;
  let c; try { c = JSON.parse(body); } catch { continue; }
  snaps.push({ h: h.slice(0, 8), at, filters: c.filters || {}, minRR: c.minRR, minRisk: c.minRisk, buf: c.buf, be: c.be, paused: c.paused || {}, newsGuard: !!c.newsGuard });
}
const keyState = (fl) => { const s = {}; if (!fl) return s;
  for (const f of ['d1', 'struct', 'cf', 'choch', 'm15c', 'minRR', 'maxRR', 'off']) if (fl[f] != null && fl[f] !== false) s[f] = String(fl[f]);
  for (const v of fl.noSession || []) s['session:' + v] = 'skip';
  for (const v of fl.noMarket || []) s['market:' + v] = 'skip';
  return s; };
const srcOf = (fl, f) => { const src = typeof fl.src === 'string' ? { d1: fl.src, struct: fl.src } : (fl.src || {}); return src[f] || src[f.split(':')[0]] || (f.startsWith('market:') ? src.noMarket : null) || 'coach'; };
const events = []; let prev = {}, pg = null;
const glob = (s) => ({ minRR: s.minRR, minRisk: s.minRisk, buf: s.buf, be: s.be, newsGuard: s.newsGuard });
for (const s of snaps) {
  const cur = {};
  for (const [k, fl] of Object.entries(s.filters)) for (const [f, v] of Object.entries(keyState(fl))) cur[`${k}.${f}`] = { v, src: srcOf(fl, f) };
  for (const key of new Set([...Object.keys(prev), ...Object.keys(cur)])) {
    const a = prev[key] && prev[key].v, b = cur[key] && cur[key].v;
    if (a !== b) events.push({ at: s.at, key, from: a || null, to: b || null, src: (cur[key] || prev[key]).src });
  }
  const g = glob(s); if (pg) for (const k of Object.keys(g)) if (pg[k] !== g[k]) events.push({ at: s.at, key: 'global.' + k, from: pg[k], to: g[k], src: 'coach' });
  pg = g; prev = cur;
}
const per = {}; for (const e of events) (per[e.key] = per[e.key] || []).push(e);
const flips = Object.fromEntries(Object.entries(per).map(([k, a]) => [k, { changes: a.length, reversals: a.filter((e, i) => i > 0 && e.to === a[i - 1].from).length, src: a[a.length - 1].src, times: a.map((e) => `${e.at.slice(5, 16)} ${e.from ?? '-'}→${e.to ?? '-'}`) }]));
fs.writeFileSync(out, JSON.stringify({ commits: snaps.length, first: snaps[0].at, last: snaps[snaps.length - 1].at, events, flips }, null, 1));
console.log(snaps.length, 'snapshots', snaps[0].at, '→', snaps[snaps.length - 1].at, events.length, 'changes');
for (const [k, f] of Object.entries(flips).sort((a, b) => b[1].changes - a[1].changes)) console.log(k.padEnd(28), f.changes, 'rev', f.reversals, f.src, '|', f.times.join(' ; '));
