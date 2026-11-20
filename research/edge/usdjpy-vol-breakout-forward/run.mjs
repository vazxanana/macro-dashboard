// Edge research · usdjpy-vol-breakout-forward: the forward record of T1 on USD/JPY from 2026-11-20 (PREREGISTRATION.md, pushed
// alone first). Paper research only: nothing trades, nothing live reads it.
//   node research/edge/usdjpy-vol-breakout-forward/run.mjs baseline <dir>   (once: baseline.json from <dir>/usdjpy-5m.json.gz)
//   MD_BASE=… node --use-env-proxy research/edge/usdjpy-vol-breakout-forward/run.mjs fetch <dir>
//   node research/edge/usdjpy-vol-breakout-forward/run.mjs run <dir> [out.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, monthT } from '../index-vol-breakout/original.mjs';
import { trades } from '../usdjpy-vol-breakout-early/run.mjs';
import { ORIG_SHA } from '../fx-vol-breakout/run.mjs';
import { bands, monthsOf, reading, checkAt, CHECKS, MIN_N } from '../gold-vol-breakout-forward/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FXV = path.join(HERE, '..', 'fx-vol-breakout');
export const START = '2026-11-20', WARM = '2026-11-01T00:00:00Z', BASE_END = '2026-11-19';
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

export function checkCopy() {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
}
// complete days only: the last calendar day on file may be forming
export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const last = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
  return { days: buildDays(rows).filter((d) => d.day < last), dataEnd: buildDays(rows).filter((d) => d.day < last).map((d) => d.day).at(-1) || null };
}
export function forwardTrades(days) {
  return trades('usdjpy', days.filter((d) => d.day >= START)).map((x) => ({ day: x.day, side: x.side > 0 ? 'buy' : 'sell', how: x.how, entry: x.entry, r: r3(x.r), R: r3(x.R), net: r3(x.net) }));
}
function maxDD(c) { let eq = 0, hi = 0, dd = 0; for (const x of c) { eq += x.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); } return r2(dd); }
export function build(tr, base, dataEnd, prev) {
  const months = monthsOf(base.rows), n = tr.length, total = tr.reduce((s, x) => s + x.net, 0);
  const A = bands(months, n), B = bands(months, n, { shift: base.mean });
  const t = n > 1 ? monthT(tr).t : NaN, read = reading(n, total, A, B);
  const crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (n >= c && !crossed[c]) crossed[c] = { at: dataEnd, n, total: r2(total), reading: checkAt(c, total, A, B, t) };
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]], tail = `forward record from ${START}: ${read}, n ${n}, total ${total >= 0 ? '+' : ''}${r2(total)}R after the pre-set cost`;
  const verdict = last && last.reading === 'fails' ? `FAIL (${tail})` : last && last.reading === 'confirmed' ? `PASS (${tail})` : `INCONCLUSIVE so far (${tail})`;
  return { study: 'usdjpy-vol-breakout-forward', start: START, dataEnd, n, wins: tr.filter((x) => x.net > 0).length, netR: r3(mean(tr.map((x) => x.net))),
    grossR: r3(mean(tr.map((x) => x.R))), total: r2(total), monthT: r2(t), maxDD: maxDD(tr), bands: { A, B }, reading: read, crossed, verdict, trades: tr };
}
const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  return [`# USD/JPY breakout T1: the forward record (from ${R.start})`, '',
    'Paper research only: nothing is traded, alerted or copied. Rule, cost, expected range and readings were fixed in `PREREGISTRATION.md` before any forward trade was computed. Written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `${R.n} closed trade${R.n === 1 ? '' : 's'} on candles through ${R.dataEnd || '—'}, total ${fmt(R.total)}R after the pre-set cost.`, '',
    '| | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured 2016-26 (+0.063R a trade) | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`, `| B, no edge | — | — | ${fmt(R.bands.B.p95)} |`, '',
    `Too few under ${MIN_N} trades; checkpoints at ${CHECKS[0]} and ${CHECKS[1]} trades.`, '',
    '| Day | Side | Exit | R before costs | R after |', '|---|---|---|---|---|', ...R.trades.map((x) => `| ${x.day} | ${x.side} | ${x.how} | ${fmt(x.R, 3)} | ${fmt(x.net, 3)} |`), ''].join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, END = Math.floor(Date.now() / 1000 / SEC) * SEC, m = new Map();
  for (let a = Date.parse(WARM) / 1000; a < END;) {
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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  checkCopy();
  const [cmd, dir, out] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'baseline') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'usdjpy-5m.json.gz'))));
    const { days } = daysOf(rows), tr = trades('usdjpy', days.filter((d) => d.day >= '2016-01-01' && d.day <= BASE_END));
    const want = JSON.parse(fs.readFileSync(path.join(FXV, 'result.json'), 'utf8')).series.usdjpy.all, got = { n: tr.length, netR: r3(mean(tr.map((x) => x.net))) };
    if (got.n !== want.n || got.netR !== want.netR) throw new Error(`baseline gate failed: ${JSON.stringify(got)} vs n ${want.n} netR ${want.netR}`);
    const rowsOut = tr.map((x) => [x.day, r3(x.net)]);
    fs.writeFileSync(path.join(HERE, 'baseline.json'), JSON.stringify({ window: `2016-01-01 → ${BASE_END}`, gate: got, mean: r3(mean(rowsOut.map((r) => r[1]))), rows: rowsOut }) + '\n');
    console.log('baseline', got);
  } else if (cmd === 'run') {
    const base = JSON.parse(fs.readFileSync(path.join(HERE, 'baseline.json'), 'utf8')), outPath = out || path.join(HERE, 'result.json');
    const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'usdjpy-5m.json.gz')))));
    const R = build(forwardTrades(days), base, dataEnd, prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!out) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict);
  } else console.log('usage: run.mjs baseline|fetch|run <dir> [out.json]');
}
