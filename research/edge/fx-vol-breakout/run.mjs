// Edge research · fx-vol-breakout: gold-vol-breakout's T1 rule, unchanged, on six forex majors at the demo broker's cost
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/fx-vol-breakout/run.mjs fetch <dir>
//   node research/edge/fx-vol-breakout/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, normP, holm, rng, summary } from '../index-vol-breakout/original.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), IVB = path.join(HERE, '..', 'index-vol-breakout');
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const MARKETS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
export const COMM = 0.000045;                       // ctrader/symbols.json commissionRT, every forex major (20 Nov 2026)
export const pipOf = (k) => (k.endsWith('jpy') ? 0.01 : 0.0001);
export const SLIP_PIPS = 0.5;                       // round trip, spread + slippage allowance
export const K = 0.5, W = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2099-12-31'], ALL: ['2016-01-01', '2099-12-31'] };
export const SEEDS = 40, PLACEBO = { from: 3600, to: 18 * 3600 };
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

export function costPx(k, entry) { return COMM * entry + SLIP_PIPS * pipOf(k); }
export function charge(k, x) { const c = costPx(k, x.entry); return { ...x, net: x.R - c / x.r, net2: x.R - 2 * c / x.r }; }
export function pool(days) { return days.filter((d) => inW(d.day, W.ALL) && !daySkip(d)); }
export function trades(k, days) {
  const tr = [];
  for (const d of pool(days)) {
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    tr.push({ day: d.day, mk: k, ...charge(k, x) });
  }
  return tr;
}
// the original's placebo construction (seeded, same rand() order), per seed: the trades of one market
export function placeboTrades(k, days, seed) {
  const P = pool(days), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), tr = [];
  for (const d of P) {
    const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (!x) continue;
    tr.push(charge(k, x));
  }
  return tr;
}
export function judge(tr, pl) {
  const s = (w) => summary(tr.filter((t) => inW(t.day, w))), all = s(W.ALL), is = s(W.IS), oos = s(W.OOS);
  const beaten = pl.filter((v) => all.netR > v).length;
  return { all, is, oos, beaten, p: normP(all.t) };
}
export function decide(series) {
  const keys = Object.keys(series), adj = holm(keys.map((k) => series[k].p));
  keys.forEach((k, i) => {
    const r = series[k]; r.holm = r3(adj[i]);
    r.checks = { bothWindows: r.is.netR > 0 && r.oos.netR > 0, t2: r.all.t >= 2 && adj[i] < 0.05, cost2x: r.all.net2R > 0, placebo: r.beaten >= 38, n30: r.is.n >= 30 && r.oos.n >= 30 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  return series;
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# Gold\'s T1 volatility breakout on six forex majors at the demo\'s cost (20 Nov 2026)', '',
    'Paper research only. Rule, markets, cost, windows and pass bar were fixed in `PREREGISTRATION.md` (pushed before any forex candle was fetched). Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    '| Series | n | Win | Net R/trade | Gross R/trade | Net 2x cost | 2016-20 net | 2021→ net | Month t | Holm p | Placebos beaten | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, r] of Object.entries(R.series)) L.push(`| ${k} | ${r.all.n} | ${(r.all.win * 100).toFixed(1)} % | ${sg(r.all.netR)} | ${sg(r.all.grossR)} | ${sg(r.all.net2R)} | ${sg(r.is.netR)} | ${sg(r.oos.netR)} | ${sg(r.all.t, 2)} | ${r.holm.toFixed(3)} | ${r.beaten} of 40 | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', `Cost: commission ${COMM} of the entry price + ${SLIP_PIPS} pip a round trip (2x reported). Financing: none (every trade is out at 21:00 UTC, before the 22:00 rollover; nights counted: ${R.nights}).`,
    '**Reading, as pre-registered.** The pool fails, so the rule does not work on forex. One market passing alone (USD/JPY) is a hypothesis for its own pre-registration on data not used here (for example the demo broker\'s own ticks, or years before 2016), not an edge: with six markets, one clearing Holm on 2016-26 is the kind of result that needs a second, independent look. Gross R is near zero or negative on five of six pairs, so the cost is not what sinks them.', '',
    `Data: OANDA mid M5, ${R.data.map((d) => `${d.k} ${d.first} → ${d.last} (${d.candles})`).join('; ')}.`, '');
  return L.join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, FROM = Date.parse('2015-12-01T00:00:00Z') / 1000, END = Math.floor(Date.now() / 1000 / 300) * 300;
  fs.mkdirSync(dir, { recursive: true });
  for (const k of MARKETS) {
    const out = path.join(dir, `${k}-5m.json.gz`); if (fs.existsSync(out)) continue;
    const m = new Map();
    for (let a = FROM; a < END;) {
      const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
      for (let t = 0; t < 6 && !j; t++) {
        try { const r = await fetch(`${base}bars?sym=${k}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
        catch (e) { err = String(e.message || e); }
        if (!j) await new Promise((s) => setTimeout(s, 2000 * (t + 1)));
      }
      if (!j) throw new Error(`${k} ${new Date(a * 1000).toISOString()}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await new Promise((s) => setTimeout(s, 120));
    }
    const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(rows))); console.log(`${k}: ${rows.length} candles`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(IVB, 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const series = {}, all = [], plAll = Array.from({ length: SEEDS }, () => []), data = []; let nights = 0;
    for (const k of MARKETS) {
      const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m.json.gz`)))); rows.sort((a, b) => a[0] - b[0]);
      // only complete days: drop the last calendar day on file
      const lastDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
      const days = buildDays(rows).filter((d) => d.day < lastDay), tr = trades(k, days); nights += tr.reduce((s, x) => s + x.nights, 0);
      const pl = [];
      for (let s = 1; s <= SEEDS; s++) { const p = placeboTrades(k, days, s); pl.push(mean(p.map((x) => x.net))); plAll[s - 1].push(...p); }
      series[k] = judge(tr, pl); all.push(...tr);
      data.push({ k, first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last: lastDay, candles: rows.length });
    }
    all.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const res = decide({ pool: judge(all, plAll.map((p) => mean(p.map((x) => x.net)))), ...series }), P = res.pool;
    const verdict = `${P.pass ? 'PASS' : 'FAIL'}: T1 on six forex majors pooled ${sg(P.all.netR)}R a trade net (n ${P.all.n}, month t ${sg(P.all.t, 2)}; gross ${sg(P.all.grossR)}R; 2016-20 ${sg(P.is.netR)}R, 2021→ ${sg(P.oos.netR)}R; ${P.beaten} of 40 placebos beaten)` +
      `; markets passing: ${MARKETS.filter((k) => res[k].pass).join(', ') || 'none'}`;
    const R = { study: 'fx-vol-breakout', title: 'Gold T1 breakout on six forex majors', built: '2026-11-20', verdict, cost: { comm: COMM, slipPips: SLIP_PIPS }, nights, data,
      series: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, { all: r.all, is: r.is, oos: r.oos, beaten: r.beaten, p: r3(r.p), holm: r.holm, checks: r.checks, pass: r.pass }])) };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
