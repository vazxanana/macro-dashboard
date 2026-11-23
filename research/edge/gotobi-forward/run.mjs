// Edge research · gotobi-forward: the forward record of the gotobi study's T2 (the USD/JPY fade after the 09:55 Tokyo fix) on
// gotobi days from 2026-11-21 (PREREGISTRATION.md, committed alone first). Paper research only: nothing trades, nothing live
// reads it; the cTrader demo job (council/gotobi.mjs) is a separate record.
//   MD_BASE=… node --use-env-proxy research/edge/gotobi-forward/run.mjs fetch <dir> [fromISO]   OANDA mid USD/JPY M5
//   node research/edge/gotobi-forward/run.mjs baseline <dir>     once: baseline.json (candles from 2015-11-01), gated
//   node research/edge/gotobi-forward/run.mjs run <dir> [out.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gotobiSet, index, windowMove, stopDist, trade, legTimes, runPair, summary, monthT, mulberry32 } from '../gotobi/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(HERE, '..', 'gotobi');
export const SRC_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';
export const START = '2026-11-21', WARM = '2026-10-01T00:00:00Z', BASE_FROM = '2015-11-01T00:00:00Z';
export const BASE_WIN = ['2016-01-01', '2026-11-11'];
export const COST = 0.008132;                         // gotobi-exec: 0.8132 pip a round trip, commission included, frozen
export const DRAWS = 20000, SEED = 20261123, MIN_N = 20, CHECKS = [120, 240];
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null), r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

export function checkSource() {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(SRC, 'run.mjs'))).digest('hex');
  if (sha !== SRC_SHA) throw new Error('gotobi/run.mjs is not the pinned copy');
}
// net R at the frozen measured cost (the rule's gross R less 0.008132 yen over D)
export const netAt = (t) => t.R - COST / t.D;

// the study's decisive T2 trades under its own cost, for the gate; rows recharged at the frozen cost
export function baselineFrom(bars) {
  const { G, all } = runPair(bars, 'fade', BASE_WIN[1]);
  const tr = [...all.values()].filter((t) => G.has(t.day) && t.day >= BASE_WIN[0] && t.day <= BASE_WIN[1]);
  const s = summary(tr), rows = tr.map((t) => [t.day, r3(netAt(t))]);
  return { gate: { n: s.n, netR: s.netR, totalR: s.totalR }, rows };
}

// forward trades: gotobi days from START whose 06:00 UTC exit the candles reach
export function forwardTrades(bars) {
  const ix = index(bars), lastT = bars.at(-1)[0], moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, windowMove(ix, 'fade', d)); return moves.get(d); };
  const lastY = +new Date(lastT * 1000).toISOString().slice(0, 4);
  const days = [...gotobiSet(+START.slice(0, 4), lastY)].filter((d) => d >= START).sort();
  const out = [], skipped = [];
  let dataEnd = null;
  for (const d of days) {
    if (lastT < legTimes('fade', d).exit) continue;                  // not complete yet
    dataEnd = d;
    const D = stopDist(moveOf, d);
    if (!(D > 0)) { skipped.push({ day: d, why: 'no stop distance (fewer than 15 of the 20 prior days)' }); continue; }
    const t = trade(ix, 'fade', d, D);
    if (!t) { skipped.push({ day: d, why: 'no 00:55 candle or no 06:00 price' }); continue; }
    out.push({ day: d, entry: t.entry, stop: r3(t.stop), D: r3(t.D), exit: t.exit, how: t.how, R: r3(t.R), net: r3(netAt(t)) });
  }
  return { trades: out, skipped, dataEnd };
}

export function bands(base, n, { draws = DRAWS, seed = SEED, shift = 0 } = {}) {
  if (!(n > 0)) return { p5: 0, p50: 0, p95: 0 };
  const R = mulberry32(seed), tot = [];
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
export function build(ev, base, prev) {
  const xs = base.rows.map((r) => r[1]), bm = mean(xs), n = ev.trades.length, total = ev.trades.reduce((s, x) => s + x.net, 0);
  const A = bands(xs, n), B = bands(xs, n, { shift: bm });
  const mt = n > 2 ? monthT(ev.trades).t : null, t = mt == null ? NaN : mt, read = reading(n, total, A, B);
  const crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (n >= c && !crossed[c]) crossed[c] = { at: ev.dataEnd, n, total: r2(total), reading: checkAt(c, total, A, B, t) };
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]];
  const tail = `forward record from ${START}: ${read}, n ${n}, total ${total >= 0 ? '+' : ''}${r2(total)}R after the measured cost`;
  const verdict = last && last.reading === 'fails' ? `FAIL (${tail})` : last && last.reading === 'confirmed' ? `PASS (${tail})` : `INCONCLUSIVE so far (${tail})`;
  return { study: 'gotobi-forward', start: START, dataEnd: ev.dataEnd, cost: COST, n, wins: ev.trades.filter((x) => x.net > 0).length,
    netR: r3(mean(ev.trades.map((x) => x.net))), grossR: r3(mean(ev.trades.map((x) => x.R))), total: r2(total), monthT: r2(t),
    baseline: { n: xs.length, netR: r3(bm), gate: base.gate }, bands: { A, B }, reading: read, crossed, verdict, trades: ev.trades, skipped: ev.skipped };
}
const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  return [`# Gotobi fade (T2): the forward record (gotobi days from ${R.start})`, '',
    'Paper research only: nothing is traded, alerted or copied (the cTrader demo job is a separate record). Rule, cost, expected range and readings were fixed in `PREREGISTRATION.md` before any forward trade was computed. Written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `${R.n} trade${R.n === 1 ? '' : 's'} on gotobi days through ${R.dataEnd || '—'}, total ${fmt(R.total)}R after the measured cost (0.8132 pip a round trip, frozen). The study's 2016-26 trades at that cost: ${fmt(R.baseline.netR, 3)}R a trade (n ${R.baseline.n}; gate: n ${R.baseline.gate.n}, ${fmt(R.baseline.gate.netR, 4)}R under the study's own cost).`, '',
    '| | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured 2016-26 | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`, `| B, no edge | — | — | ${fmt(R.bands.B.p95)} |`, '',
    `Too few under ${MIN_N} trades; checkpoints at ${CHECKS[0]} and ${CHECKS[1]} trades; the first crossing of each stands.`, '',
    '| Gotobi day | Entry | Exit | How | R before costs | R after |', '|---|---|---|---|---|---|',
    ...R.trades.map((x) => `| ${x.day} | ${x.entry} | ${x.exit} | ${x.how} | ${fmt(x.R, 3)} | ${fmt(x.net, 3)} |`),
    ...(R.skipped.length ? ['', 'Skipped: ' + R.skipped.map((s) => `${s.day} (${s.why})`).join('; ') + '.'] : []), ''].join('\n');
}

async function fetchM5(dir, fromIso = WARM) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, END = Math.floor(Date.now() / 1000 / SEC) * SEC, m = new Map();
  for (let a = Date.parse(fromIso) / 1000; a < END;) {
    const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${base}bars?sym=usdjpy&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
    }
    if (!j) throw new Error(`usdjpy ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b;
  }
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'usdjpy-5m.json.gz'), zlib.gzipSync(JSON.stringify([...m.values()].sort((p, q) => p[0] - q[0]))));
  console.log(`usdjpy 5m: ${m.size} candles`);
}
const load = (dir) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'usdjpy-5m.json.gz')))).sort((a, b) => a[0] - b[0]);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  checkSource();
  const [cmd, dir, out] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchM5(dir, out || WARM);
  else if (cmd === 'baseline') {
    const b = baselineFrom(load(dir)), want = JSON.parse(fs.readFileSync(path.join(SRC, 'result.json'), 'utf8')).tests.T2.decisive;
    if (b.gate.n !== want.n || b.gate.netR !== want.netR) throw new Error(`baseline gate failed: ${JSON.stringify(b.gate)} vs n ${want.n} netR ${want.netR}`);
    fs.writeFileSync(path.join(HERE, 'baseline.json'), JSON.stringify({ window: `${BASE_WIN[0]} → ${BASE_WIN[1]}`, cost: COST, gate: b.gate, mean: r3(mean(b.rows.map((r) => r[1]))), rows: b.rows }) + '\n');
    console.log('baseline', b.gate, 'at the measured cost', r3(mean(b.rows.map((r) => r[1]))));
  } else if (cmd === 'run') {
    const base = JSON.parse(fs.readFileSync(path.join(HERE, 'baseline.json'), 'utf8')), outPath = out || path.join(HERE, 'result.json');
    const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const R = build(forwardTrades(load(dir)), base, prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!out) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict);
  } else console.log('usage: run.mjs fetch|baseline|run <dir> [out.json | fromISO]');
}
