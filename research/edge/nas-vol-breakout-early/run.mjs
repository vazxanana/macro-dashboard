// Edge research · nas-vol-breakout-early: gold's T1 volatility breakout on NAS100, 2010-2015, at the demo's measured hourly
// cost (PREREGISTRATION.md, pushed alone first). Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/nas-vol-breakout-early/run.mjs fetch <dir>
//   node research/edge/nas-vol-breakout-early/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, rng, summary } from '../index-vol-breakout/original.mjs';
import { T1, SEEDS, PLACEBO } from '../index-vol-breakout/run.mjs';
import { hourCost, medRange, charge, CONDS } from '../index-vol-breakout-hourcost/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), IVB = path.join(HERE, '..', 'index-vol-breakout');
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const W = { ALL: ['2010-01-01', '2015-12-31'], H1: ['2010-01-01', '2012-12-31'], H2: ['2013-01-01', '2015-12-31'], LATE: ['2012-01-01', '2015-12-31'] };
export const FETCH = { from: '2009-12-01T00:00:00Z', to: '2016-01-08T00:00:00Z' };
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

export function frozenCost() {
  const r = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout-hourcost', 'result.json'), 'utf8')).profile.nas100;
  return { hp: r.hourProfile, comm: r.commissionRT || 0, at: r.at, commit: r.commit };
}
export function pool(days, w = W.ALL) { return days.filter((d) => inW(d.day, w) && !daySkip(d)); }
export function trades(days, hp, comm, cond = CONDS.C1) {
  const tr = [];
  for (const d of pool(days)) {
    const x = vbTrade(d.bars, { k: T1.k, sides: T1.sides, prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT), h = Math.floor(x.fillMin / 60);
    tr.push({ day: d.day, ...charge(x, hourCost(hp, comm, cond, x.entry, h, medRange(d.bars, i))) });
  }
  return tr;
}
// the original's placebo construction (same seeds, same order of rand() calls), on this window's pool
export function placebo(days, hp, comm, cond = CONDS.C1, seeds = SEEDS) {
  const P = pool(days), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const d of P) {
      const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
      const x = placeboTrade(d.bars, { startT, side, dist: T1.k * d.prevRange, cost: 0 }); if (!x) continue;
      const i = d.bars.findIndex((b) => b.t >= startT), h = Math.floor((d.bars[i].t - d.d0) / 3600);
      tr.push(charge(x, hourCost(hp, comm, cond, x.entry, h, medRange(d.bars, i))));
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}
export function decide(tr, pl) {
  const s = (w) => summary(tr.filter((t) => inW(t.day, w))), all = s(W.ALL), h1 = s(W.H1), h2 = s(W.H2), late = s(W.LATE);
  const beaten = pl.filter((v) => all.netR > v).length;
  const checks = { pos: all.netR > 0, h1Pos: h1.netR > 0, h2Pos: h2.netR > 0, t2: all.t >= 2, cost2x: all.net2R > 0, placebo: beaten >= 38, n30: h1.n >= 30 && h2.n >= 30 };
  return { all, h1, h2, late, placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const row = (n, x) => `| ${n} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.t, 2)} | ${sg(x.maxDD, 2)} |`;
  return ['# NAS100: gold\'s T1 volatility breakout on 2010-2015 at the demo\'s measured cost (20 Nov 2026)', '',
    'Paper research only. The rule, cost, window and pass bar were fixed in `PREREGISTRATION.md` (pushed before any candle of the window was fetched). Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    '| Window | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | t (month sums) | Max DD R |', '|---|---|---|---|---|---|---|---|',
    row('2010-2015', R.decision.all), row('2010-2012', R.decision.h1), row('2013-2015', R.decision.h2), row('2012-2015 (reported)', R.decision.late), '',
    `Placebo (40 seeds, random entries, same costs): median ${sg(R.placebo.median)}R, 95th percentile ${sg(R.placebo.p95)}R; the rule beats ${R.decision.placeboBeaten} of 40 (38 needed).`, '',
    'Checks: ' + Object.entries(R.decision.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ') + '.', '',
    `Cost: the NAS100 hour profile measured on the demo (probe of ${R.cost.at}), charged on every year. Data: OANDA mid M5 ${R.data.first} → ${R.data.last}, ${R.data.candles} candles, ${R.data.flatPct} % flat.`, ''].join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, END = Date.parse(FETCH.to) / 1000, m = new Map();
  for (let a = Date.parse(FETCH.from) / 1000; a < END;) {
    const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${base}bars?sym=nas100&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
    }
    if (!j) throw new Error(`nas100 ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await new Promise((s) => setTimeout(s, 150));
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'nas100-5m-early.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
  console.log(`nas100 5m: ${rows.length} candles`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(IVB, 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'nas100-5m-early.json.gz')))); rows.sort((a, b) => a[0] - b[0]);
    const days = buildDays(rows), cost = frozenCost(), tr = trades(days, cost.hp, cost.comm), pl = placebo(days, cost.hp, cost.comm), d = decide(tr, pl);
    const sorted = [...pl].sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
    const flat = rows.filter((r) => r[2] === r[3]).length;
    const verdict = `${d.pass ? 'PASS' : 'FAIL'}: NAS100 T1 2010-2015 at the measured cost ${sg(d.all.netR)}R a trade net (n ${d.all.n}, month t ${sg(d.all.t, 2)}; 2010-12 ${sg(d.h1.netR)}R, 2013-15 ${sg(d.h2.netR)}R; ${d.placeboBeaten} of 40 placebos beaten)` +
      (d.pass ? '' : `; fails: ${Object.entries(d.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    const R = { study: 'nas-vol-breakout-early', title: 'NAS100 T1 breakout, 2010-2015, measured cost', built: '2026-11-20', verdict, window: W, decision: d,
      placebo: { means: pl, median: q(0.5), p95: q(0.95) }, cost: { at: cost.at, commit: cost.commit, comm: cost.comm }, data: { first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10), candles: rows.length, flatPct: +(100 * flat / rows.length).toFixed(1) } };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
