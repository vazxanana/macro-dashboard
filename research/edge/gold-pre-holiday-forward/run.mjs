// Edge research · gold-pre-holiday-forward: the forward record of gold-pre-holiday's T1 on holidays after 2026-10-31
// (PREREGISTRATION.md, pushed alone first). Paper research only: nothing trades, nothing live reads it.
//   node --use-env-proxy research/edge/gold-pre-holiday-forward/run.mjs fetch <dir>   OANDA mid H1 gold from 2026-09-01
//   node research/edge/gold-pre-holiday-forward/run.mjs run <dir> [out.json]          the record -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { holidays, buildDays, eventDays, trade, OOS_END, rng } from '../gold-pre-holiday/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(HERE, '..', 'gold-pre-holiday');
export const SRC_SHA = '8b5586c0302b99e8949ff1cde11be7345f541063f7e25d2df860d86463c62825';
export const FROM = '2026-09-01', DRAWS = 20000, SEED = 20261120, MIN_N = 10, CHECKS = [20, 40];
const D = 86400, H = 3600;
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null), r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);

export function checkSource() {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(SRC, 'run.mjs'))).digest('hex');
  if (sha !== SRC_SHA) throw new Error('gold-pre-holiday/run.mjs is not the pinned copy');
}
// the study's own out-of-sample T1 nets (2017 to its end): world A
export function baseline() {
  const r = JSON.parse(fs.readFileSync(path.join(SRC, 'result.json'), 'utf8'));
  return r.tests.T1.trades.filter((x) => x.date >= '2017-01-01' && x.date <= OOS_END).map((x) => x.net);
}
// bootstrap of the total of n events (single events, with replacement)
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
// the forward events: holidays after OOS_END whose event day is closed in the candles
export function forwardEvents(h1raw, now, after = OOS_END) {
  const h1 = h1raw.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = buildDays(h1), y0 = +after.slice(0, 4), y1 = new Date(now * 1000).getUTCFullYear() + 1;
  const hols = []; for (let y = y0 - 1; y <= y1; y++) hols.push(...holidays(y));
  const holSet = new Set(hols.map((h) => h.d)), lastD = Date.parse(after) / 1000 / D;
  const out = [], skipped = [];
  for (const h of hols) {
    if (h.d <= lastD) continue;
    const e = eventDays(ds, h, holSet);
    if (!e) { if (h.d * D < now) skipped.push({ date: h.date, holiday: h.name, why: 'no candles after the holiday yet' }); continue; }
    const a = e.pre1;
    if (a == null) { skipped.push({ date: h.date, holiday: h.name, why: 'no trading day before it in the candles' }); continue; }
    if (a + 1 >= ds.length) continue;                                   // the event day is not closed yet
    const tr = trade(h1, ds, a, a);
    if (!tr) { skipped.push({ date: h.date, holiday: h.name, why: 'no ATR (too few days before)' }); continue; }
    out.push({ date: h.date, holiday: h.name, day: ymd(ds[a].d), entry: r2(tr.entry), exit: r2(tr.exit), atr: r2(tr.atr), stopped: tr.stopped, gross: r3(tr.gross), net: r3(tr.net) });
  }
  return { events: out, skipped, dataEnd: ds.length ? ymd(ds[ds.length - 1].d) : null };
}
export function build(ev, base, prev) {
  const n = ev.events.length, nets = ev.events.map((x) => x.net), total = nets.reduce((s, v) => s + v, 0);
  const bm = mean(base), A = bands(base, n), B = bands(base, n, { shift: bm });
  const t = n > 1 && sd(nets) > 0 ? mean(nets) / (sd(nets) / Math.sqrt(n)) : NaN;
  const crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (n >= c && !crossed[c]) crossed[c] = { at: ev.dataEnd, n, total: r2(total), reading: checkAt(c, total, A, B, t) };
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]], read = reading(n, total, A, B);
  const tail = `forward record from ${OOS_END}: ${read}, n ${n}, total ${total >= 0 ? '+' : ''}${r2(total)}R`;
  const verdict = last && last.reading === 'fails' ? `FAIL (${tail})` : last && last.reading === 'confirmed' ? `PASS (${tail})` : `INCONCLUSIVE so far (${tail})`;
  return { study: 'gold-pre-holiday-forward', after: OOS_END, dataEnd: ev.dataEnd, n, total: r2(total), netR: r3(mean(nets)), t: r2(t),
    baseline: { n: base.length, netR: r3(bm) }, bands: { A, B }, reading: read, crossed, verdict, events: ev.events, skipped: ev.skipped };
}
const fmt = (v, d = 2) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  return [`# Gold before US holidays (T1): the forward record (holidays after ${R.after})`, '',
    'Paper research only: nothing is traded, alerted or copied. The rule, cost, expected range and readings were fixed before any forward holiday (`PREREGISTRATION.md`). This page is written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `${R.n} event${R.n === 1 ? '' : 's'} on candles through ${R.dataEnd || '—'}; the study's out-of-sample record was ${fmt(R.baseline.netR, 3)}R a trade (n ${R.baseline.n}). Too few under ${MIN_N}; checkpoints at ${CHECKS[0]} and ${CHECKS[1]} events.`, '',
    '| | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured 2017-26 | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`, `| B, no edge | — | — | ${fmt(R.bands.B.p95)} |`, '',
    '| Holiday | Event day | R before costs | R after | Stopped |', '|---|---|---|---|---|',
    ...R.events.map((x) => `| ${x.holiday} ${x.date} | ${x.day} | ${fmt(x.gross, 3)} | ${fmt(x.net, 3)} | ${x.stopped ? 'yes' : 'no'} |`),
    ...(R.skipped.length ? ['', 'Skipped: ' + R.skipped.map((s) => `${s.holiday} ${s.date} (${s.why})`).join('; ') + '.'] : []), ''].join('\n');
}

async function fetchH1(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', from = Math.floor(Date.parse(FROM) / 1000), now = Math.floor(Date.now() / 1000), all = [];
  for (let a = from; a < now;) {
    const b = Math.min(now, a + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 5 && !j; k++) {
      try { const r = await fetch(`${base}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? x.error : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
    }
    if (!j) throw new Error(`candles: ${err}`);
    for (const x of j.bars) if (!x.live) all.push([x.time, x.open, x.high, x.low, x.close]);
    a = b;
  }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'xau-h1-forward.json'), JSON.stringify(rows));
  console.log(`xau H1: ${rows.length} candles`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir, out] = process.argv.slice(2);
  checkSource();
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1-forward.json'), 'utf8'));
    const outPath = out || path.join(HERE, 'result.json'), prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const R = build(forwardEvents(rows, Math.floor(Date.now() / 1000)), baseline(), prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!out) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict);
  } else console.log('usage: run.mjs fetch|run <dir> [out.json]');
}
