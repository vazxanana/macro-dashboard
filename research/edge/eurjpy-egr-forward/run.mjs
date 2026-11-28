// Edge research · eurjpy-egr-forward: the forward record of the EUR/JPY engulf-retest sell from 2026-11-30 (PREREGISTRATION.md,
// pushed alone first). Paper research only: nothing trades, nothing live reads it.
//   node research/edge/eurjpy-egr-forward/run.mjs baseline           (once: baseline.json from the exec study's candles, EDGE_DATA)
//   MD_BASE=… node --use-env-proxy research/edge/eurjpy-egr-forward/run.mjs fetch <dir>
//   node research/edge/eurjpy-egr-forward/run.mjs run <dir> [out.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { loadMarket, toArrays, prep } from '../auto-researcher/engine.mjs';
import { orders, finR, G, FROM, TO } from '../eurjpy-egr-exec/orders.mjs';
import { monthT } from '../index-vol-breakout/original.mjs';
import { bands, monthsOf, reading, checkAt, CHECKS, MIN_N } from '../gold-vol-breakout-forward/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EXEC = path.join(HERE, '..', 'eurjpy-egr-exec');
export const START = '2026-11-30', COMM = 0.000045, WARM = '2025-06-01T00:00:00Z';
const START_S = Date.parse(START + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the exit time of one order on the same candles (orders() keeps only R): the start of the candle that stopped or reached the
// target, else the close of the last hold candle; used only for the swap's nights
export function exitAt(D, o, g = G) {
  let i = 0; while (i < D.n && D.t[i] < o.ts) i++;
  for (let j = i; j < i + g.hold && j < D.n; j++) { const op = j === i ? o.fillM : D.o[j];
    if (op >= o.stop || D.h[j] >= o.stop || D.l[j] <= o.tgt) return D.t[j]; }
  return D.t[Math.min(i + g.hold - 1, D.n - 1)] + 3600;
}
// a closed order after the pre-set cost: midR (already less D.cost) less commission and the short's swap
export function costed(D, o) {
  const at = exitAt(D, o), cut = (COMM * o.fillM) / o.D + finR(o, at);
  return { day: day(o.ts), ts: o.ts, entry: o.fillM, how: o.timeExit ? 'time' : o.midR > 0 ? 'target' : 'stop', R: r3(o.midR), net: r3(o.midR - cut), R2: r3(o.midR - 2 * cut - D.cost / o.D) };
}
// counted once every hold candle is on file (deadEnd = the last hold candle's close)
export function forwardTrades(D) {
  const lastClose = D.t[D.n - 1] + 3600;
  return orders(D, G, START_S, Infinity).filter((o) => o.deadEnd <= lastClose).map((o) => costed(D, o));
}
function maxDD(c) { let eq = 0, hi = 0, dd = 0; for (const x of c) { eq += x.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); } return r2(dd); }
export function build(tr, base, dataEnd, prev) {
  const months = monthsOf(base.rows), n = tr.length, total = tr.reduce((s, x) => s + x.net, 0), total2 = tr.reduce((s, x) => s + x.R2, 0);
  const A = bands(months, n), B = bands(months, n, { shift: base.mean });
  const t = n > 1 ? monthT(tr).t : NaN, read = reading(n, total, A, B), crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (n >= c && !crossed[c]) { let rd = checkAt(c, total, A, B, t); if (rd === 'confirmed' && !(total2 > 0)) rd = 'not shown either way'; crossed[c] = { at: dataEnd, n, total: r2(total), total2x: r2(total2), reading: rd }; }
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]], tail = `forward record from ${START}: ${read}, n ${n}, total ${total >= 0 ? '+' : ''}${r2(total)}R after the pre-set cost`;
  const verdict = last && last.reading === 'fails' ? `FAIL (${tail})` : last && last.reading === 'confirmed' ? `PASS (${tail})` : `INCONCLUSIVE so far (${tail})`;
  return { study: 'eurjpy-egr-forward', start: START, dataEnd, n, wins: tr.filter((x) => x.net > 0).length, netR: r3(mean(tr.map((x) => x.net))),
    grossR: r3(mean(tr.map((x) => x.R))), total: r2(total), total2x: r2(total2), monthT: r2(t), maxDD: maxDD(tr), bands: { A, B }, reading: read, crossed, verdict, trades: tr };
}
const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  return [`# EUR/JPY engulf-retest sell: the forward record (from ${R.start})`, '',
    'Paper research only: nothing is traded, alerted or copied. Rule, cost, expected range and readings were fixed in `PREREGISTRATION.md` before any forward trade was computed. Written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `${R.n} closed trade${R.n === 1 ? '' : 's'} on candles through ${R.dataEnd || '—'}, total ${fmt(R.total)}R after the pre-set cost (${fmt(R.total2x)}R at twice the cost). The rule was picked among about 1.1 million looks, so the measured range is optimistic. About three trades a month: 20 take about half a year.`, '',
    '| | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured 2023-12 to 2026-11 | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`, `| B, no edge | — | — | ${fmt(R.bands.B.p95)} |`, '',
    `Too few under ${MIN_N} trades; checkpoints at ${CHECKS[0]} and ${CHECKS[1]} trades.`, '',
    '| Day | Exit | R before costs | R after |', '|---|---|---|---|', ...R.trades.map((x) => `| ${x.day} | ${x.how} | ${fmt(x.R, 3)} | ${fmt(x.net, 3)} |`), ''].join('\n');
}

async function fetchH1(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', now = Math.floor(Date.now() / 1000), span = 4900 * 3600, m = new Map();
  for (let a = Date.parse(WARM) / 1000; a < now; a += span) {
    const b = Math.min(now, a + span); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${base}bars?sym=eurjpy&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
    }
    if (!j) throw new Error(`eurjpy ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time + 3600 <= now) m.set(+x.time, { t: +x.time, o: +x.open, h: +x.high, l: +x.low, c: +x.close });
  }
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'eurjpy-1h.json.gz'), zlib.gzipSync(JSON.stringify([...m.values()].sort((p, q) => p.t - q.t))));
  console.log(`eurjpy 1h: ${m.size} candles`);
}
export const marketOf = (rows) => prep(toArrays(rows), 'eurjpy');

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir, out] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'baseline') {
    const D = await loadMarket('eurjpy', process.env.EDGE_DATA || '.'), o = orders(D, G, FROM, TO);
    const want = JSON.parse(fs.readFileSync(path.join(EXEC, 'result.json'), 'utf8')).primary, got = { n: o.length, mid: Math.round(mean(o.map((x) => x.midR)) * 1e4) / 1e4 };
    if (got.n !== want.orders || got.mid !== want.mid.mean) throw new Error(`baseline gate failed: ${JSON.stringify(got)} vs n ${want.orders} mid ${want.mid.mean}`);
    const rows = o.map((x) => { const c = costed(D, x); return [c.day, c.net]; });
    fs.writeFileSync(path.join(HERE, 'baseline.json'), JSON.stringify({ window: '2023-12-01 → 2026-11-20', gate: got, cost: D.cost, mean: r3(mean(rows.map((r) => r[1]))), rows }) + '\n');
    console.log('baseline', got, 'net mean', r3(mean(rows.map((r) => r[1]))));
  } else if (cmd === 'run') {
    const base = JSON.parse(fs.readFileSync(path.join(HERE, 'baseline.json'), 'utf8')), outPath = out || path.join(HERE, 'result.json');
    const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const D = marketOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'eurjpy-1h.json.gz')))));
    if (D.cost !== base.cost) throw new Error(`the engine's EUR/JPY cost changed: ${D.cost} vs ${base.cost}`);
    const R = build(forwardTrades(D), base, day(D.t[D.n - 1]), prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!out) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict);
  } else console.log('usage: run.mjs baseline|fetch|run <dir> [out.json]');
}
