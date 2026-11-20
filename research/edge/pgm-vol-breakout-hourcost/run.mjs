// Edge research · pgm-vol-breakout-hourcost: pgm-vol-breakout's trades charged the demo broker's measured hourly spread
// (route C1 of index-vol-breakout-hourcost), PREREGISTRATION.md (pushed alone first). Paper research only.
//   node research/edge/pgm-vol-breakout-hourcost/run.mjs <candleDir> <probeDir> [probeCommit]
//   (<candleDir> = pgm-vol-breakout's fetch: xpt/xpd-5m.json.gz; <probeDir>/ticks-<NAME>.json from the tick probe)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, rng, normP, holm } from '../index-vol-breakout/original.mjs';
import { SEEDS, K, PLACEBO } from '../fx-vol-breakout/run.mjs';
import { judge, trades as origTrades, MARKETS } from '../pgm-vol-breakout/run.mjs';
import { hourCost, medRange, measurable, CONDS } from '../index-vol-breakout-hourcost/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EVB = path.join(HERE, '..', 'pgm-vol-breakout');
export const NAMES = { xpt: ['XPTUSD'], xpd: ['XPDUSD'] };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

// the first broker name listed (a probe file without an error and with an hour profile), in the pre-registered order
export function pickProbe(k, files) {
  for (const n of NAMES[k]) { const P = files[n]; if (P && !P.error && Array.isArray(P.hourProfile) && P.hourProfile.length) return { name: n, P }; }
  return null;
}
const chargeH = (x, c) => ({ ...x, cost: c, net: x.R - c / x.r, net2: x.R - 2 * c / x.r });
export function tradesH(days, hp, comm) {
  const tr = [];
  for (const d of days.filter((x) => !daySkip(x))) {
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT);
    tr.push({ day: d.day, ...chargeH(x, hourCost(hp, comm, CONDS.C1, x.entry, Math.floor(x.fillMin / 60), medRange(d.bars, i))) });
  }
  return tr;
}
export function placeboH(days, hp, comm, seed) {
  const P = days.filter((x) => !daySkip(x)), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), tr = [];
  for (const d of P) { const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (!x) continue;
    const i = d.bars.findIndex((b) => b.t >= startT); tr.push(chargeH(x, hourCost(hp, comm, CONDS.C1, x.entry, Math.floor((d.bars[i].t - d.d0) / 3600), medRange(d.bars, i)))); }
  return tr;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cdir, pdir, commit] = process.argv.slice(2);
  const orig = JSON.parse(fs.readFileSync(path.join(EVB, 'result.json'), 'utf8')), files = {};
  for (const n of Object.values(NAMES).flat()) { const f = path.join(pdir, `ticks-${n}.json`); if (fs.existsSync(f)) files[n] = JSON.parse(fs.readFileSync(f, 'utf8')); }
  const series = {}, all = [], plAll = Array.from({ length: SEEDS }, () => []), gate = {}, prof = {}, left = {};
  for (const k of MARKETS) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, `${k}-5m.json.gz`)))); rows.sort((a, b) => a[0] - b[0]);
    const last = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10), days = buildDays(rows).filter((d) => d.day < last && d.day >= '2016-01-01' && d.day <= orig.data.find((x) => x.k === k).last);
    const og = judge(origTrades(k, days), []).all; gate[k] = { n: og.n, netR: og.netR, t: og.t, want: { n: orig.series[k].all.n, netR: orig.series[k].all.netR, t: orig.series[k].all.t } };
    if (og.n !== gate[k].want.n || og.netR !== gate[k].want.netR) throw new Error(`harness gate failed for ${k}: ${JSON.stringify(gate[k])}`);
    const pk = pickProbe(k, files); if (!pk) { left[k] = 'no broker name listed'; continue; }
    const hp = pk.P.hourProfile, why = measurable(hp); if (why) { left[k] = `${pk.name}: ${why}`; continue; }
    prof[k] = { name: pk.name, at: pk.P.at, frac: hp.map((h) => (h ? h.frac : null)), comm: 0 };
    const tr = tradesH(days, hp, 0), pl = [];
    for (let s = 1; s <= SEEDS; s++) { const p = placeboH(days, hp, 0, s); pl.push(mean(p.map((x) => x.net))); plAll[s - 1].push(...p); }
    series[k] = judge(tr, pl); all.push(...tr);
  }
  const ks = Object.keys(series);
  let verdict, pool = null;
  if (!ks.length) verdict = `NOT MEASURABLE: ${JSON.stringify(left)}`;
  else {
    all.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    pool = judge(all, plAll.map((p) => mean(p.map((x) => x.net)))); const adj = holm(ks.map((k) => series[k].p)); ks.forEach((k, i) => { series[k].holm = r3(adj[i]); });
    verdict = `${pool.pass ? 'PASS' : 'FAIL'}: T1 on ${ks.join(', ')} at the demo's measured hourly spread, pooled ${sg(pool.all.netR)}R a trade net (n ${pool.all.n}, month t ${sg(pool.all.t, 2)}; 2016-20 ${sg(pool.a.netR)}R, 2021→ ${sg(pool.b.netR)}R; ${pool.beaten} of 40 placebos)` +
      (pool.pass ? '' : `; fails: ${Object.entries(pool.checks).filter(([, v]) => !v).map(([x]) => x).join(', ')}`) + (Object.keys(left).length ? `; left out: ${Object.keys(left).join(', ')}` : '');
  }
  const R = { study: 'pgm-vol-breakout-hourcost', built: '2026-11-20', verdict, probe: { commit: commit || null }, gate, profile: prof, leftOut: left, series: pool ? { pool, ...series } : {} };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  const L = ['# Gold\'s T1 breakout on platinum and palladium at the demo broker\'s measured spread (20 Nov 2026)', '',
    'Paper research only. Method and bar fixed in `PREREGISTRATION.md` before any platinum or palladium quote of the broker was read. Nothing live changed.', '', `**Verdict: ${verdict}**`, ''];
  if (pool) { L.push('| Series | n | Net R/trade | Gross R/trade | Net 2x | 2016-20 | 2021→ | Month t | Placebos | All checks |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const [k, r] of Object.entries(R.series)) L.push(`| ${k}${prof[k] ? ` (${prof[k].name})` : ''} | ${r.all.n} | ${sg(r.all.netR)} | ${sg(r.all.grossR)} | ${sg(r.all.net2R)} | ${sg(r.a.netR)} | ${sg(r.b.netR)} | ${sg(r.all.t, 2)} | ${r.beaten} of 40 | ${r.pass ? 'yes' : 'no'} |`); }
  L.push('', `Spread profiles (median quoted spread as a share of the mid, by UTC hour 00-20): ${Object.entries(prof).map(([k, p]) => `${k} (${p.name}) ${p.frac.slice(0, 21).map((f) => (f == null ? '—' : (f * 1e4).toFixed(1))).join(' ')} bp`).join('; ') || 'none'}. Commission: 0 (none listed in the council\'s symbols file; the demo charges gold a commission, so this may understate the cost).`,
    `Harness gate (the original assumed costs reproduce pgm-vol-breakout): ${JSON.stringify(gate)}.`, Object.keys(left).length ? `Left out: ${JSON.stringify(left)}.` : '', '');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n'));
  console.log(verdict);
}
