// Edge research · gotobi-limit-entry: can a SELL LIMIT resting from 00:54 UTC (placed at the 00:53 M1 close + k pips) capture
// the frozen gotobi fade's 00:55 result (research/edge/gotobi T2, #878; minute profile from gotobi-timing, #908)? An execution
// study on a frozen rule (PREREGISTRATION.md), paper only, no edge verdict, no live proposal. The rule's functions come from
// frozen.mjs (byte copy of gotobi-timing's, sha256 pinned in the test); gotobiDays / tradeM1 / frozenD are copied from
// gotobi-timing's run.mjs (branch gotobi-timing), not imported.
//   node --use-env-proxy research/edge/gotobi-limit-entry/run.mjs fetch <m1Dir>   (OANDA M1, one request per gotobi day)
//   node research/edge/gotobi-limit-entry/run.mjs <m1Dir> <usdjpy-5m.json.gz>     (writes result.json and RESULT.md here)
// Keep the candle files out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2016-01-01', LAST = '2026-11-11';     // #878's decisive window, as gotobi-timing
export const WIN = [40, 375];                              // fetched minutes after 00:00 UTC: 00:40 -> 06:15
export const EXIT = 360;                                   // 06:00 UTC
export const GRACE_M1 = F.EXIT_GRACE / 60;
export const PLACE = 53;                                   // the limit is priced off the close of the 00:53 M1 candle
export const LIVE = [54, 55, 56, 57];                      // the M1 candles the limit rests through
export const KS = [0, 1, 2];                               // pips above the 00:53 close
export const STRICT_PIPS = 0.3;                            // strict fill: the high trades this far THROUGH the limit
export const GATE = { n: 771, netR: 0.1481, t: 2.74 };     // gotobi-timing's M1 base row
export const CAPT = 0.70, PART = 0.40, T_BAR = 2;
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ---- copied from gotobi-timing's run.mjs ---------------------------------------------------------------------------------
export function gotobiDays(from = FROM, to = LAST) {
  const G = F.gotobiSet(+from.slice(0, 4) - 1, +to.slice(0, 4));
  return [...G].filter((d) => d >= from && d <= to).sort();
}
function exitM1(ix, exit) {
  const xi = ix.at.get(exit); if (xi != null) return ix.bars[xi][1];
  for (let k = 1; k <= GRACE_M1; k++) { const j = ix.at.get(exit - 60 * k); if (j != null) return ix.bars[j][4]; }
  return null;
}
// one fade trade on M1 candles: entry at the open of the M1 candle at entryMin, stop D above it, exit at 06:00 (or grace)
export function tradeM1(ix, ymd, D, entryMin, exitMin = EXIT) {
  if (!(D > 0)) return null;
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000, entry = day0 + entryMin * 60, exit = day0 + exitMin * 60;
  const ei = ix.at.get(entry); if (ei == null) return null;
  const xp = exitM1(ix, exit); if (xp == null) return null;
  const side = -1, epx = ix.bars[ei][1], stop = epx - side * D;
  let out = xp, how = 'time';
  for (let i = ei; i < ix.bars.length && ix.bars[i][0] < exit; i++) {
    const [, o, h] = ix.bars[i];
    if (o >= stop) { out = o; how = 'gap'; break; }
    if (h >= stop) { out = stop; how = 'stop'; break; }
  }
  const R = side * (out - epx) / D, cR = F.costPx(epx) / D;
  return { day: ymd, entryT: entry, exitT: exit, entry: epx, stop, D, exit: out, how, R, costR: cR, net: R - cR };
}
export function frozenD(m5) {
  const ix = F.index(m5), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, 'fade', d)); return moves.get(d); };
  const out = new Map();
  for (const d of gotobiDays()) { if (!F.isTokyoBusinessDay(d)) continue; out.set(d, F.stopDist(moveOf, d)); }
  return out;
}
// ---- end of the copy -----------------------------------------------------------------------------------------------------

// E1: sell limit at the 00:53 close + k pips, live 00:54-00:57; fill at L when the high reaches L (+ `through` for strict).
// Returns { trade } or { miss: 'no-order' | 'no-fill' | 'no-exit' }.
export function limitTrade(ix, ymd, D, k, through = 0, exitMin = EXIT) {
  if (!(D > 0)) return { miss: 'no-d' };
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000, exit = day0 + exitMin * 60;
  const pi = ix.at.get(day0 + PLACE * 60); if (pi == null) return { miss: 'no-order' };
  const L = ix.bars[pi][4] + k * F.PIP, need = L + through - 1e-9;
  let fi = null;
  for (const m of LIVE) { const i = ix.at.get(day0 + m * 60); if (i != null && ix.bars[i][2] >= need) { fi = i; break; } }
  if (fi == null) return { miss: 'no-fill' };
  const xp = exitM1(ix, exit); if (xp == null) return { miss: 'no-exit' };
  const stop = L + D;
  let out = xp, how = 'time';
  if (ix.bars[fi][2] >= stop) { out = stop; how = 'stop'; }         // fill candle: order inside it unknown, worse case
  else for (let i = fi + 1; i < ix.bars.length && ix.bars[i][0] < exit; i++) {
    const [, o, h] = ix.bars[i];
    if (o >= stop) { out = o; how = 'gap'; break; }
    if (h >= stop) { out = stop; how = 'stop'; break; }
  }
  const R = -(out - L) / D, cR = F.costPx(L) / D;
  return { trade: { day: ymd, entryT: ix.bars[fi][0], fillMin: Math.round((ix.bars[fi][0] - day0) / 60), exitT: exit, entry: L, stop, D, exit: out, how, R, costR: cR, net: R - cR } };
}

const r4 = (v) => Math.round(v * 1e4) / 1e4, r2 = (v) => Math.round(v * 100) / 100;
// per-day statistics over the universe (unfilled days 0R, every month present)
export function perDay(universe, trades) {
  const by = new Map(trades.map((t) => [t.day, t])), rows = universe.map((d) => ({ day: d, net: by.has(d) ? by.get(d).net : 0 }));
  const mt = F.monthT(rows), sum = rows.reduce((s, v) => s + v.net, 0);
  return { days: rows.length, netPerDay: r4(sum / rows.length), totalR: r2(sum), months: mt.months, t: mt.t == null ? null : r2(mt.t) };
}

export function study(m1, m5) {
  const Dm = frozenD(m5), ix = F.index(m1);
  const e3 = []; for (const [d, D] of Dm) { const t = tradeM1(ix, d, D, 55); if (t) e3.push(t); }
  const universe = e3.map((t) => t.day), Dof = new Map(e3.map((t) => [t.day, t.D]));
  const s3 = F.summary(e3), p3 = perDay(universe, e3);
  const gate = { n: s3.n, netR: s3.netR, t: s3.t, expect: GATE };
  gate.pass = s3.n === GATE.n && Math.abs(s3.netR - GATE.netR) < 5e-5 && Math.abs(s3.t - GATE.t) < 5e-3;
  const e3By = new Map(e3.map((t) => [t.day, t]));
  const row = (id, name, trades, extra = {}) => {
    const s = F.summary(trades), p = perDay(universe, trades);
    return { id, name, ...extra, filled: trades.length, fillRate: r4(trades.length / universe.length), perTrade: s, perDay: p, keep: r4(p.netPerDay / p3.netPerDay) };
  };
  const rows = [];
  for (const k of KS) for (const [mode, thr] of [['lenient', 0], ['strict', STRICT_PIPS * F.PIP]]) {
    const tr = [], miss = { 'no-order': 0, 'no-fill': 0, 'no-exit': 0 }, byMin = Object.fromEntries(LIVE.map((m) => [hhmm(m), 0]));
    for (const d of universe) { const x = limitTrade(ix, d, Dof.get(d), k, thr); if (x.trade) { tr.push(x.trade); byMin[hhmm(x.trade.fillMin)]++; } else miss[x.miss]++; }
    const filledSet = new Set(tr.map((t) => t.day)), missed = universe.filter((d) => !filledSet.has(d)).map((d) => e3By.get(d).net);
    const missedE3 = missed.length ? r4(missed.reduce((s, v) => s + v, 0) / missed.length) : null;
    const filledE3 = tr.length ? r4(tr.reduce((s, t) => s + e3By.get(t.day).net, 0) / tr.length) : null;
    rows.push(row(`E1 k=${k} ${mode}`, `Sell limit at the 00:53 close + ${k} pip${k === 1 ? '' : 's'}, ${mode} fill`, tr,
      { variant: 'E1', k, fill: mode, misses: miss, fillsByMinute: byMin, e3OnMissedDays: missedE3, e3OnFilledDays: filledE3 }));
  }
  const e2 = []; for (const d of universe) { const t = tradeM1(ix, d, Dof.get(d), 54); if (t) e2.push(t); }
  rows.push(row('E2', 'Market sell at the 00:54 M1 open (one minute early)', e2, { variant: 'E2' }));
  rows.push(row('E3', 'Market sell at the 00:55 M1 open (the ideal, gotobi-timing\'s base)', e3, { variant: 'E3' }));
  const strict = rows.filter((r) => r.fill === 'strict');
  const capt = strict.filter((r) => r.keep >= CAPT && r.perDay.t != null && r.perDay.t >= T_BAR);
  const part = strict.filter((r) => r.keep >= PART);
  const reading = !gate.pass ? 'NOT INTERPRETED (gate broken)' : capt.length ? 'CAPTURABLE' : part.length ? 'PARTLY' : 'NOT CAPTURABLE';
  const best = [...strict].sort((a, b) => b.keep - a.keep)[0];
  // descriptive, read after the reading: how far the 00:55 open sits above the 00:53 close (pips)
  const rise = universe.map((d) => { const d0 = Date.parse(d + 'T00:00:00Z') / 1000, a = ix.at.get(d0 + PLACE * 60), b = ix.at.get(d0 + 55 * 60); return (ix.bars[b][1] - ix.bars[a][4]) / F.PIP; }).sort((p, q) => p - q);
  const riseOut = { meanPips: r2(rise.reduce((s, v) => s + v, 0) / rise.length), medianPips: r2(rise[Math.floor(rise.length / 2)]), aboveShare: r4(rise.filter((v) => v > 0).length / rise.length) };
  return { gate, universe: universe.length, rows, reading, by: (capt[0] || part[0] || best).id, e3: p3, rise: riseOut };
}

// ---- report ----------------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const pct = (v) => v == null ? 'n/a' : `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)} %`;
export function report(o) {
  const L = [], R = Object.fromEntries(o.rows.map((r) => [r.id, r])), e3 = R.E3, by = R[o.readingBy];
  L.push('# Gotobi fade: can a resting sell limit placed before the fix capture the 00:55 result?', '');
  L.push(`**Verdict: ${o.reading}.** Read on the strict fill rule as pre-registered: ${by.id} keeps ${pct(by.keep)} of E3's net R per day (${fmt(by.perDay.netPerDay, 4)}R against ${fmt(e3.perDay.netPerDay, 4)}R), month t ${fmt(by.perDay.t, 2)}, filling ${pct(by.fillRate)} of days. An execution study on the frozen gotobi fade (#878 T2), not an edge verdict, and no live proposal. Paper research only; nothing live changed.`, '');
  L.push(`**Gate: ${o.gate.pass ? 'PASSED' : 'FAILED'}.** E3 on these files gives n ${o.gate.n}, ${fmt(o.gate.netR, 4)}R a trade, month t ${fmt(o.gate.t, 2)} (gotobi-timing's M1 base: ${o.gate.expect.n}, ${fmt(o.gate.expect.netR, 4)}, ${fmt(o.gate.expect.t, 2)}). Universe: ${o.universe} gotobi days 2016-01-01 to 2026-11-11.`, '');
  L.push('## Every variant', '');
  L.push('| Row | Fill rate | Net R per filled trade | Gross R | Cost R | Trade month t | Net R per day | Day month t | Total net R | Share of E3 per day | Stopped % |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of o.rows) { const s = r.perTrade, p = r.perDay;
    L.push(`| ${r.id} | ${pct(r.fillRate)} | ${fmt(s.netR, 4)} | ${fmt(s.grossR, 4)} | ${s.costR == null ? 'n/a' : s.costR.toFixed(4)} | ${fmt(s.t, 2)} | ${fmt(p.netPerDay, 4)} | ${fmt(p.t, 2)} | ${fmt(p.totalR, 1)} | ${pct(r.keep)} | ${s.stopShare == null ? 'n/a' : (s.stopShare * 100).toFixed(1)} |`); }
  L.push('', '"Net R per day" counts every universe day, an unfilled one as 0R; "Day month t" is on calendar-month sums of that. "Trade month t" is the frozen `monthT` over filled trades only.', '');
  L.push('## The limit\'s fills and misses', '');
  L.push('| Row | Fills at 00:54 | 00:55 | 00:56 | 00:57 | No 00:53 candle | Not filled | E3 net R on the filled days | E3 net R on the missed days |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of o.rows.filter((x) => x.variant === 'E1')) { const b = r.fillsByMinute;
    L.push(`| ${r.id} | ${b['00:54']} | ${b['00:55']} | ${b['00:56']} | ${b['00:57']} | ${r.misses['no-order']} | ${r.misses['no-fill']} | ${fmt(r.e3OnFilledDays, 4)} | ${fmt(r.e3OnMissedDays, 4)} |`); }
  L.push('', '## Notes', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

// ---- fetch (gotobi-timing's, same file name) ---------------------------------------------------------------------------------
async function fetchM1(dir) {
  const BASEURL = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'usdjpy-1m-gotobi.json.gz');
  if (fs.existsSync(file)) { console.log(`${file} exists`); return; }
  const rows = [];
  for (const d of gotobiDays()) {
    const a = Date.parse(d + 'T00:00:00Z') / 1000 + WIN[0] * 60, b = Date.parse(d + 'T00:00:00Z') / 1000 + WIN[1] * 60;
    let got = null, err = null;
    for (let t = 0; t < 6 && !got; t++) {
      try {
        const r = await fetch(`${BASEURL}bars?sym=usdjpy&tf=1m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
        const x = r.ok ? await r.json() : null;
        if (x && Array.isArray(x.bars)) got = x.bars.filter((q) => !q.live && q.time >= a && q.time < b).map((q) => [+q.time, +q.open, +q.high, +q.low, +q.close]);
        else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
      } catch (e) { err = String(e.message || e); }
      if (!got) await sleep(2000 * (t + 1));
    }
    if (!got) throw new Error(`${d}: ${err}`);
    rows.push(...got); await sleep(250);
  }
  const all = new Map(); for (const r of rows) all.set(r[0], r);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify([...all.values()].sort((p, q) => p[0] - q[0]))));
}

export function load(f) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); }

async function main() {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') return fetchM1(b);
  if (!a || !b) throw new Error('usage: node run.mjs fetch <m1Dir> | node run.mjs <m1Dir> <usdjpy-5m.json.gz>');
  const m1 = load(path.join(a, 'usdjpy-1m-gotobi.json.gz')), m5 = load(b);
  const res = study(m1, m5);
  const out = {
    study: 'gotobi-limit-entry', built: '2026-11-14', kind: 'execution study on a frozen rule (no edge verdict, no live proposal)',
    reading: res.reading, readingBy: res.by,
    rule: 'Frozen T2 of research/edge/gotobi (#878): on gotobi days sell USD/JPY, buy back at 06:00 UTC; stop D = 1.5 x the 20-business-day median absolute move of the 00:55-06:00 window (M5); net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side. Only the entry differs between rows.',
    frozen: { file: 'frozen.mjs', from: 'origin/gotobi-timing:research/edge/gotobi-timing/frozen.mjs', sha256: '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32' },
    data: { m1: 'OANDA mid M1 through the /md/bars proxy, 00:40-06:15 UTC on each gotobi day (gotobi-timing\'s cache)', m5: "OANDA mid M5 (#878's file) for the stop distance D", from: FROM, lastDay: LAST, m1Candles: m1.length },
    variants: { E1: { place: '00:53 M1 close', liveMinutes: LIVE.map(hhmm), ks: KS, strictThroughPips: STRICT_PIPS, fillPrice: 'the limit' }, E2: '00:54 M1 open, market', E3: '00:55 M1 open, market' },
    bar: { capturable: { keep: CAPT, dayMonthT: T_BAR, fill: 'strict' }, partly: { keep: PART, fill: 'strict' } },
    gate: res.gate, universe: res.universe, rows: res.rows, rise0053to0055: res.rise,
  };
  const R = Object.fromEntries(res.rows.map((r) => [r.id, r])), f = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  out.notes = [
    'The fill rules are on M1 highs: a high may have lasted a moment and a real queue may not have reached the order, so even the strict rule (0.3 pip through) is an estimate, not a measured broker fill. Mid prices: a real sell limit fills on the bid, about half a spread lower.',
    'A fill is credited at the limit price even when the candle opened above it (no price improvement), and a stop reached inside the fill candle counts as stopped (the order inside the candle is unknown). Both are the worse case.',
    'The frozen costs (spread plus 0.5 pip slippage a side) are charged on the limit fills too: no rebate is taken for a resting order.',
    `What the misses cost: on the days E1 k=0 strict did not fill, E3 made ${f(R['E1 k=0 strict'].e3OnMissedDays, 4)}R a trade; on the days it filled, E3 made ${f(R['E1 k=0 strict'].e3OnFilledDays, 4)}R. A limit above the market fills on the days the price ticks up into the fix, which are not a random half of the days.`,
    `Read after the reading, descriptive only: most fills come in the 00:54 candle, before the fix minute. The 00:55 open sits on average ${f(res.rise.meanPips, 2)} pips from the 00:53 close (median ${f(res.rise.medianPips, 2)}, above it on ${(res.rise.aboveShare * 100).toFixed(1)} % of days), and E2 (00:54 market) already loses about half of E3. A limit near the 00:53 close sells at roughly the 00:54 price, not the 00:55 one; a higher limit fills less often and misses days E3 made money on.`,
    'Month t on per-day net R is a measure of noise, not a test: no Holm, no placebo. Nothing here is chosen; any live use would need its own proposal and the owner.',
  ];
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log('gate', JSON.stringify(res.gate), 'reading', res.reading, res.by);
  for (const r of res.rows) console.log(r.id, r.fillRate, r.perTrade.netR, r.perDay.netPerDay, r.perDay.t, r.keep);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
