// Edge research · turnaround-tuesday-forward: the forward record of turnaround-tuesday's R2 on NAS100 for weeks after
// 2026-11-12 (PREREGISTRATION.md, pushed alone first). Paper research only: nothing trades, nothing live reads it.
//   node --use-env-proxy research/edge/turnaround-tuesday-forward/run.mjs fetch <dir>   OANDA mid NAS100 H1 from 2026-09-01
//   node research/edge/turnaround-tuesday-forward/run.mjs run <dir> [out.json]          the record -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nyParts } from '../../../ict/calendar.mjs';
import { tradingDays, weekPairs, buildDays, dayChg, ruleOn, trade, MARKETS, RULES, rng } from '../turnaround-tuesday/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(HERE, '..', 'turnaround-tuesday');
export const SRC_SHA = '74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871';
export const AFTER = '2026-11-12', FROM = '2026-09-01', DRAWS = 20000, SEED = 20261120, MIN_N = 10, CHECKS = [20, 40];
const H = 3600;
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null), r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };

export function checkSource() {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(SRC, 'run.mjs'))).digest('hex');
  if (sha !== SRC_SHA) throw new Error('turnaround-tuesday/run.mjs is not the pinned copy');
}
// the study's own out-of-sample NAS100 R2 trades (R after costs): world A
export function baseline() {
  const r = JSON.parse(fs.readFileSync(path.join(SRC, 'result.json'), 'utf8'));
  return r.cells['nas100-r2'].trades.filter((t) => t[0] >= '2016-01-01').map((t) => t[6]);
}
// the frozen 2-year yield: the last value of the study's rates.json
export function frozenRate() {
  const r = JSON.parse(fs.readFileSync(path.join(SRC, 'rates.json'), 'utf8')).DGS2, last = r[r.length - 1][1];
  return () => last;
}
export function bands(base, n, { draws = DRAWS, seed = SEED, shift = 0 } = {}) {
  if (!(n > 0)) return { p5: 0, p50: 0, p95: 0 };
  const R = rng(seed), tot = [];
  for (let d = 0; d < draws; d++) { let s = 0; for (let i = 0; i < n; i++) s += base[Math.floor(R() * base.length)] - shift; tot.push(s); }
  tot.sort((a, b) => a - b); const q = (p) => tot[Math.min(tot.length - 1, Math.floor(p * (tot.length - 1)))];
  return { p5: r2(q(0.05)), p50: r2(q(0.5)), p95: r2(q(0.95)) };
}
export function reading(n, total, A, B) {
  if (n < MIN_N) return 'too few';
  if (total < A.p5) return 'below the measured range';
  if (total > B.p95) return 'ahead of a no-edge rule';
  return 'undecided';
}
export function checkAt(c, total, A, B, t) {
  if (c === CHECKS[1]) return total < A.p5 ? 'fails' : (total > B.p95 && t >= 2 ? 'confirmed' : 'not shown either way');
  return total < A.p5 ? 'fails' : 'holds so far';
}
// forward trades: weeks whose first trading day is after `after` and whose exit day is closed in the candles
export function forwardTrades(bars, after = AFTER) {
  const first = nyParts(bars[0][0]).ymd, last = nyParts(bars[bars.length - 1][0]).ymd;
  const days = tradingDays(first, last), D = buildDays(bars, days), opt = { cost: MARKETS.nas100.cost, rate: frozenRate() };
  const out = [], skipped = [];
  for (const p of weekPairs(days)) {
    const d = days[p.m]; if (d <= after) continue;
    if (D[p.x].close == null) continue;                                // exit day not closed yet (or a hole)
    const chg = dayChg(D, p.m); if (!ruleOn(chg, RULES.r2.drop)) continue;
    const t = trade(bars, D, p.m, p.x, opt);
    if (!t) { skipped.push({ day: d, why: 'trade could not be built (no ATR or a missing close)' }); continue; }
    out.push({ day: d, exitD: t.exitD, change: r3(100 * chg), how: t.how, grossR: r3(t.grossR), R: r3(t.R) });
  }
  return { trades: out, skipped, dataEnd: last };
}
export function build(ev, base, prev) {
  const n = ev.trades.length, xs = ev.trades.map((x) => x.R), total = xs.reduce((s, v) => s + v, 0);
  const bm = mean(base), A = bands(base, n), B = bands(base, n, { shift: bm });
  const t = n > 1 && sd(xs) > 0 ? mean(xs) / (sd(xs) / Math.sqrt(n)) : NaN;
  const crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (n >= c && !crossed[c]) crossed[c] = { at: ev.dataEnd, n, total: r2(total), reading: checkAt(c, total, A, B, t) };
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]], read = reading(n, total, A, B);
  const tail = `forward record from ${AFTER}: ${read}, n ${n}, total ${total >= 0 ? '+' : ''}${r2(total)}R`;
  const verdict = last && last.reading === 'fails' ? `FAIL (${tail})` : last && last.reading === 'confirmed' ? `PASS (${tail})` : `INCONCLUSIVE so far (${tail})`;
  return { study: 'turnaround-tuesday-forward', after: AFTER, dataEnd: ev.dataEnd, n, total: r2(total), R: r3(mean(xs)), t: r2(t),
    baseline: { n: base.length, R: r3(bm) }, bands: { A, B }, reading: read, crossed, verdict, trades: ev.trades, skipped: ev.skipped };
}
const fmt = (v, d = 2) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  return [`# Turnaround Tuesday on NAS100 (R2): the forward record (weeks after ${R.after})`, '',
    'Paper research only: nothing is traded, alerted or copied. The rule, cost, expected range and readings were fixed before any forward week was computed (`PREREGISTRATION.md`). This page is written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `${R.n} trade${R.n === 1 ? '' : 's'} on candles through ${R.dataEnd}; the study's out-of-sample record was ${fmt(R.baseline.R, 3)}R a trade (n ${R.baseline.n}). Too few under ${MIN_N}; checkpoints at ${CHECKS[0]} and ${CHECKS[1]} trades.`, '',
    '| | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured 2016-26 | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`, `| B, no edge | — | — | ${fmt(R.bands.B.p95)} |`, '',
    '| Monday | Its change % | Exit | R before costs | R after |', '|---|---|---|---|---|',
    ...R.trades.map((x) => `| ${x.day} | ${fmt(x.change)} | ${x.how} | ${fmt(x.grossR, 3)} | ${fmt(x.R, 3)} |`),
    ...(R.skipped.length ? ['', 'Skipped: ' + R.skipped.map((s) => `${s.day} (${s.why})`).join('; ') + '.'] : []), ''].join('\n');
}

async function fetchH1(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', from = Math.floor(Date.parse(FROM) / 1000), now = Math.floor(Date.now() / 1000), all = [];
  for (let a = from; a < now;) {
    const b = Math.min(now, a + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 5 && !j; k++) {
      try { const r = await fetch(`${base}bars?sym=nas100&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? x.error : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
    }
    if (!j) throw new Error(`candles: ${err}`);
    for (const x of j.bars) if (!x.live) all.push([x.time, x.open, x.high, x.low, x.close]);
    a = b;
  }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'nas100-h1-forward.json'), JSON.stringify(rows));
  console.log(`nas100 H1: ${rows.length} candles`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir, out] = process.argv.slice(2);
  checkSource();
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'nas100-h1-forward.json'), 'utf8'));
    const outPath = out || path.join(HERE, 'result.json'), prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const R = build(forwardTrades(rows), baseline(), prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!out) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict);
  } else console.log('usage: run.mjs fetch|run <dir> [out.json]');
}
