// Equity exposure timed by the VIX term structure (VIX / VIX3M), out of sample. Rules: PREREGISTRATION.md (committed first).
// Paper research only: nothing here is read by the council, and no live rule changes whatever the outcome.
//
//   node --use-env-proxy research/edge/vix-term/run.mjs fetch <dir>   Cboe VIX + VIX3M CSVs → <dir> (outside git), and
//                                                                     SPX500 / NAS100 / the 2Y cache from origin/council-data
//   node research/edge/vix-term/run.mjs full <dir>                    → result.json + RESULT.md
// A Cboe file that could not be fetched makes the study INCONCLUSIVE ("data not reachable"): no other source is used.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CBOE, parseCboeCsv } from '../../../council/macro.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const P = {
  atrN: 20, atrK: 2,
  cost: { spx500: 1.0, nas100: 4.0 },          // index points a side (entry and exit), conservative
  finSpread: 0.025,                             // financing = 2Y yield + 2.5 % a year, per calendar night held
  W1: ['2008-01-01', '2015-12-31'], W2: ['2016-01-01', null],
  draws: 2000, seed: 20261113, pBar: 0.9,
};
const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// Ratio by Cboe date: [{ t, r }] sorted, only dates both files have.
export function ratios(vix, vix3m) {
  const m = new Map(vix3m.map((o) => [o.t, o.v]));
  return vix.filter((o) => m.has(o.t)).map((o) => ({ t: o.t, r: o.v / m.get(o.t) }));
}
// Signal for the candle of UTC day D: the ratio of the LAST Cboe date strictly before D (yesterday's close only).
// Returns 1 (long, contango), 0 (flat) or 0 when no ratio exists. `rs` sorted by t.
export function signalAt(rs, D) {
  let lo = 0, hi = rs.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (rs[m].t < D) { k = m; lo = m + 1; } else hi = m - 1; }
  return k < 0 ? 0 : rs[k].r < 1 ? 1 : 0;
}
// Last value dated before t (step function); null when none.
export function stepAt(series, t) {
  let v = null; for (const o of series) { if (o.t < t) v = o.v; else break; } return v;
}
// Simple mean true range of the n candles before index i.
export function atrBefore(bars, i, n = P.atrN) {
  if (i < n + 1) return null;
  let s = 0;
  for (let j = i - n; j < i; j++) { const b = bars[j], pc = bars[j - 1].c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / n;
}

// One account, day by day. bars [{ t, o, h, l, c }] (UTC days, sorted); sig(i) → 1 / 0 for bar i; rate(t) → annual
// financing rate for the night after t. timed=false = buy-and-hold (always long, no stop, entry cost once, no exit).
// Returns { days: [{ t, ret, long }], entries, stops, costPct, finPct, inMarket }.
export function simulate(bars, { sig, rate, costPts, from = 0, to = bars.length - 1, timed = true }) {
  const days = []; let pos = null, entries = 0, stops = 0, costPct = 0, finPct = 0, inMkt = 0;
  for (let i = from; i <= to; i++) {
    const b = bars[i], prev = bars[i - 1];
    let ret = 0, held = false;
    const want = timed ? sig(i) === 1 : true;
    if (!pos && want) {
      const atr = atrBefore(bars, i);
      if (atr != null || !timed) { pos = { entry: b.o, stop: timed ? b.o - P.atrK * atr : -Infinity, fresh: true }; entries++; ret -= costPts / b.o; costPct += costPts / b.o; }
    }
    if (pos) {
      held = true; inMkt++;
      const base = pos.fresh ? b.o : prev.c;   // entry day: from the open; later days: from the prior close
      pos.fresh = false;
      if (b.o <= pos.stop) { ret += b.o / base - 1; ret -= costPts / b.o; costPct += costPts / b.o; stops++; pos = null; }
      else if (b.l <= pos.stop) { ret += pos.stop / base - 1; ret -= costPts / b.o; costPct += costPts / b.o; stops++; pos = null; }
      else {
        ret += b.c / base - 1;
        const nextWant = timed ? (i + 1 <= to ? sig(i + 1) === 1 : false) : true;
        if (timed && !nextWant) { ret -= costPts / b.c; costPct += costPts / b.c; pos = null; }
        else if (i + 1 < bars.length) {                                       // held overnight: financing for each calendar night
          const nights = Math.round((bars[i + 1].t - b.t) / DAY), f = (rate(b.t) || 0) * nights / 365;
          ret -= f; finPct += f;
        }
      }
    }
    days.push({ t: b.t, ret, long: held });
  }
  return { days, entries, stops, costPct, finPct, inMarket: days.length ? inMkt / days.length : 0 };
}

export function sharpe(rets) {
  const n = rets.length; if (n < 2) return null;
  const m = rets.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return sd > 0 ? (m / sd) * Math.sqrt(252) : null;
}
export function maxDD(rets) {
  let eq = 1, pk = 1, dd = 0;
  for (const r of rets) { eq *= 1 + r; pk = Math.max(pk, eq); dd = Math.min(dd, eq / pk - 1); }
  return -dd;
}
export function cagr(days) {
  if (!days.length) return null;
  const eq = days.reduce((a, d) => a * (1 + d.ret), 1), yrs = (days[days.length - 1].t - days[0].t) / (365.25 * DAY);
  return yrs > 0 ? eq ** (1 / yrs) - 1 : null;
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
// Paired monthly block bootstrap: P(Sharpe A > Sharpe B). a, b = day arrays of the same days.
export function bootstrap(a, b, draws = P.draws, seed = P.seed) {
  const months = new Map();
  a.forEach((d, i) => { const k = iso(d.t).slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(i); });
  const blocks = [...months.values()], R = rng(seed); let win = 0;
  for (let k = 0; k < draws; k++) {
    const ra = [], rb = [];
    for (let j = 0; j < blocks.length; j++) { const blk = blocks[Math.floor(R() * blocks.length)]; for (const i of blk) { ra.push(a[i].ret); rb.push(b[i].ret); } }
    const sa = sharpe(ra), sb = sharpe(rb); if (sa != null && sb != null && sa > sb) win++;
  }
  return win / draws;
}
const r3 = (x) => x == null ? null : Math.round(x * 1000) / 1000;
function summary(sim) {
  const rets = sim.days.map((d) => d.ret);
  return { days: rets.length, sharpe: r3(sharpe(rets)), maxDD: r3(maxDD(rets)), cagr: r3(cagr(sim.days)), inMarket: r3(sim.inMarket),
    entries: sim.entries, stops: sim.stops, costPct: r3(sim.costPct), finPct: r3(sim.finPct) };
}
// One window: indices of bars in [from, to]; timed and buy-and-hold on the same days.
export function windowRun(bars, rs, rate, costPts, [f, t]) {
  const lo = bars.findIndex((b) => b.t >= ts(f)), hiT = t ? ts(t) : Infinity;
  let hi = bars.length - 1; while (hi >= 0 && bars[hi].t > hiT) hi--;
  const lastR = rs.length ? rs[rs.length - 1].t : 0;
  while (hi >= 0 && bars[hi].t > lastR + DAY) hi--;                           // stop where the ratio file ends
  if (lo < 0 || hi <= lo) return null;
  const sig = (i) => signalAt(rs, bars[i].t);
  const tm = simulate(bars, { sig, rate, costPts, from: lo, to: hi }), bh = simulate(bars, { sig, rate, costPts, from: lo, to: hi, timed: false });
  return { from: iso(bars[lo].t), to: iso(bars[hi].t), timed: summary(tm), hold: summary(bh), pBetter: r3(bootstrap(tm.days, bh.days)) };
}

export function verdictOf(res) {
  if (!res || res.data !== 'ok') return { verdict: 'INCONCLUSIVE', why: 'data not reachable' };
  const w2 = res.spx500.W2, w1 = res.spx500.W1;
  const c2 = w2 && w2.timed.sharpe > w2.hold.sharpe && w2.timed.maxDD < w2.hold.maxDD && w2.pBetter >= P.pBar;
  const c1 = w1 && w1.timed.sharpe > w1.hold.sharpe && w1.timed.maxDD < w1.hold.maxDD;
  return { verdict: c1 && c2 ? 'PASS' : 'FAIL', why: `W2 bar ${c2 ? 'met' : 'missed'}, W1 bar ${c1 ? 'met' : 'missed'}` };
}

// ---- files ----
const daily = (j) => j.rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
function gitShow(p) { return execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: HERE, maxBuffer: 1 << 28 }).toString(); }

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const log = { at: new Date().toISOString(), files: {} };
  for (const [key, url] of [['VIX', CBOE.VIXCLS], ['VIX3M', CBOE.VXVCLS]]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30e3) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text(); const rows = parseCboeCsv(txt);
      if (!rows.length) throw new Error('no rows parsed');
      fs.writeFileSync(path.join(dir, `${key}.csv`), txt); log.files[key] = { ok: true, url, rows: rows.length };
    } catch (e) { log.files[key] = { ok: false, url, error: String((e && e.cause && e.cause.message) || (e && e.message) || e) }; }
  }
  for (const k of ['spx500', 'nas100']) fs.writeFileSync(path.join(dir, `${k}.json`), gitShow(`research/daily/${k}.json`));
  fs.writeFileSync(path.join(dir, 'cache.json'), gitShow('macro/cache.json'));
  fs.writeFileSync(path.join(dir, 'fetch.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log, null, 1));
}

export function rateFn(cache) {
  const w = ((cache.score && cache.score.fred && cache.score.fred.DGS2) || []).map(([d, v]) => ({ t: ts(d), v }));
  const d = ((cache.fred && cache.fred.DGS2) || []).map((o) => Array.isArray(o) ? { t: ts(o[0]), v: o[1] } : { t: o.t, v: o.v });
  const s = [...w, ...d].sort((a, b) => a.t - b.t);
  return (t) => { const y = stepAt(s, t + DAY); return y == null ? null : y / 100 + P.finSpread; };
}

function full(dir) {
  const fl = fs.existsSync(path.join(dir, 'fetch.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'fetch.json'))) : null;
  const have = ['VIX', 'VIX3M'].every((k) => fs.existsSync(path.join(dir, `${k}.csv`)));
  let res;
  if (!have) {
    res = { topic: 'vix-term', data: 'not reachable', fetch: fl || { files: {} },
      note: 'Cboe VIX / VIX3M history could not be fetched from this environment; per the pre-registration no other source is used and no number is reported.' };
  } else {
    const vix = parseCboeCsv(fs.readFileSync(path.join(dir, 'VIX.csv'), 'utf8')), v3 = parseCboeCsv(fs.readFileSync(path.join(dir, 'VIX3M.csv'), 'utf8'));
    const rs = ratios(vix, v3), rate = rateFn(JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))));
    res = { topic: 'vix-term', data: 'ok', fetch: fl, ratioFrom: iso(rs[0].t), ratioTo: iso(rs[rs.length - 1].t),
      contangoShare: r3(rs.filter((o) => o.r < 1).length / rs.length) };
    for (const k of ['spx500', 'nas100']) {
      const bars = daily(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`))));
      res[k] = { W1: windowRun(bars, rs, rate, P.cost[k], P.W1), W2: windowRun(bars, rs, rate, P.cost[k], P.W2) };
    }
  }
  res.params = P; res.prereg = 'PREREGISTRATION.md';
  Object.assign(res, verdictOf(res));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(res.verdict, res.why);
}

export function report(res) {
  const L = [];
  if (res.data !== 'ok') {
    const f = (res.fetch && res.fetch.files) || {};
    L.push(`**Verdict:** INCONCLUSIVE, data not reachable: the Cboe VIX and VIX3M history files could not be fetched from the build environment, so the pre-registered rule was not run and no Sharpe, drawdown or bootstrap figure exists.`, '',
      '# Equity exposure timed by the VIX term structure (13 Nov 2026)', '',
      'Paper research only; nothing live changed. The rule, costs, windows and pass bar are in `PREREGISTRATION.md` (committed first).', '',
      '## What happened', '');
    for (const k of Object.keys(f)) L.push(`- ${k}: ${f[k].ok ? `fetched, ${f[k].rows} rows` : `not fetched (${f[k].error})`}, ${f[k].url}`);
    if (res.fetch && res.fetch.at) L.push(`- Attempted ${res.fetch.at} through the session's proxy (\`node --use-env-proxy\`); the proxy refused the host (CONNECT 403). FRED (\`VXVCLS\`) was refused too.`);
    L.push('', 'No substitute was used, as pre-registered: no unofficial mirror of the series, and the macro strategist\'s cache (`macro/cache.json`, about 300 recent days of `VIXCLS` / `VXVCLS`) covers neither window.', '',
      '## To finish it', '', 'From a machine that can reach `cdn.cboe.com`:', '',
      '```sh', 'node --use-env-proxy research/edge/vix-term/run.mjs fetch <dir>   # outside git', 'node research/edge/vix-term/run.mjs full <dir>', '```', '',
      'The code, the tests of its signal lag (yesterday\'s close only), stop and costs, and the pass bar are in place; the first run with the data decides the verdict. No proposal is written.');
    return L.join('\n') + '\n';
  }
  const pct = (x) => x == null ? 'n/a' : (x * 100).toFixed(1) + ' %';
  const row = (n, s) => `| ${n} | ${s.sharpe} | ${pct(s.maxDD)} | ${pct(s.cagr)} | ${pct(s.inMarket)} | ${s.entries} | ${s.stops} | ${pct(s.costPct)} | ${pct(s.finPct)} |`;
  L.push(`**Verdict:** ${res.verdict} (${res.why}).`, '', '# Equity exposure timed by the VIX term structure (13 Nov 2026)', '',
    `Paper research only; nothing live changed. Rules in \`PREREGISTRATION.md\` (committed first). Ratio history ${res.ratioFrom} to ${res.ratioTo}, contango on ${pct(res.contangoShare)} of days.`, '');
  for (const k of ['spx500', 'nas100']) {
    L.push(`## ${k === 'spx500' ? 'SPX500 (decides)' : 'NAS100 (descriptive only)'}`, '');
    for (const w of ['W1', 'W2']) {
      const x = res[k][w]; if (!x) continue;
      L.push(`${w} ${x.from} to ${x.to}; bootstrap P(timed Sharpe better) ${x.pBetter}`, '',
        '| | Sharpe | max DD | CAGR | in market | entries | stops | spread paid | financing |', '|---|---|---|---|---|---|---|---|---|',
        row('timed', x.timed), row('buy and hold', x.hold), '');
    }
  }
  return L.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') await fetchAll(dir); else if (mode === 'full') full(dir); else { console.error('mode?'); process.exit(2); }
}
