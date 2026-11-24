// research/proposals/2026-11-24-desk-cost-audit.mjs - cost in R per trade of every desk reading, from the stored desk files (no new
// test, arithmetic only). node research/proposals/2026-11-24-desk-cost-audit.mjs <dir with mosha.json eg.json msnr.json lit.json>
// (the files: git show origin/council-data:<desk>/desk.json). Writes the .json beside this file.
import fs from 'node:fs';
import { COSTS } from '../edge/combo-grid-2/run.mjs';
const D = process.argv[2], out = [];
const mosha = (id) => { const s = id.replace(/^[a-z0-9]+:/, '');
  if (s.startsWith('sop-nv')) return 'SOP inside the VR'; if (s.startsWith('sop-nc')) return 'SOP inside the CF';
  if (s.startsWith('sop-l')) return 'BO-VR-CF limit at CF line'; if (s.startsWith('sop-c2')) return 'CF inside the VR';
  if (s.startsWith('sop-vr') || s.startsWith('sop-vc')) return 'VR retest'; if (s.startsWith('sop')) return 'BO-VR-CF EG entry';
  const t = s.includes('-r6-') || s.startsWith('bar-r6') ? ' 6R' : s.startsWith('bar-old') || s.includes('-old-') ? ' 3R' : ' 1R';
  if (s.includes('sop-f')) return 'barrier QM failed (with dir)'; if (s.includes('bar-sop')) return 'barrier repeat SOP';
  if (s.includes('tap')) return 'barrier M1/M15+M1 BO at tap' + t; if (s.includes('-j-')) return 'barrier Janda' + t;
  if (s.includes('-cf-')) return 'CF barrier'; if (s.includes('-vr')) return 'VR barrier'; return 'barrier QM' + t; };
const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];
for (const desk of ['mosha', 'eg', 'msnr', 'lit']) {
  const J = JSON.parse(fs.readFileSync(`${D}/${desk}.json`)); const g = new Map();
  for (const r of J.records) { const mk = r.market || 'xau', c = COSTS[mk], r0 = r.r0 || Math.abs(r.entry - r.stop);
    if (!(r0 > 0) || c == null || !Number.isFinite(r.R) || r.status === 'open') continue;
    const k = desk === 'mosha' ? mosha(r.id) : (r.label || r.kind).replace(/^(D1|H4|H1) engulf zone$/, 'engulf rule $1') + (desk === 'msnr' && r.kind?.startsWith('msnr-') && !r.kind.includes('sop') && !r.kind.includes('qm') ? ' (' + r.kind + ')' : '');
    const cr = c / r0; if (!g.has(k)) g.set(k, { n: 0, cr: [], R: 0, net: 0 }); const x = g.get(k); x.n++; x.cr.push(cr); x.R += r.R; x.net += r.R - cr; (x.v ||= []).push(r.R - cr); (x.mo ||= new Map()).set(Math.floor(r.t/2629800), ((x.mo.get(Math.floor(r.t/2629800))||0) + r.R - cr)); }
  for (const [k, x] of g) { x.cr.sort((a, b) => a - b); out.push({ desk, reading: k, n: x.n, med: pct(x.cr, 0.5), p90: pct(x.cr, 0.9), over: x.cr.filter((v) => v > 0.1).length / x.n, R: x.R / x.n, net: x.net / x.n, t: (() => { const m = x.net / x.n, sd = Math.sqrt(x.v.reduce((a, b) => a + (b - m) ** 2, 0) / (x.n - 1)); return m / (sd / Math.sqrt(x.n)); })(), mt: (() => { const a = [...x.mo.values()], m = a.reduce((p, q) => p + q, 0) / a.length, sd = Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length - 1)); return m / (sd / Math.sqrt(a.length)); })(), months: x.mo.size }); }
}
fs.writeFileSync(new URL('./2026-11-24-desk-cost-audit.json', import.meta.url), JSON.stringify({ built: '2026-11-24', costs: 'combo-grid-2 COSTS (ASSUMED for xag, nas100)', rows: out.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v]))) }, null, 1) + '\n');
for (const o of out.sort((a, b) => a.desk.localeCompare(b.desk) || b.med - a.med)) console.log([o.desk, o.reading, o.n, o.med.toFixed(3), o.p90.toFixed(3), (o.over * 100).toFixed(0) + '%', o.R.toFixed(3), o.net.toFixed(3), o.t.toFixed(2), o.mt.toFixed(2), o.months].join('\t'));
