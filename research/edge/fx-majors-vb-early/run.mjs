// Edge research · fx-majors-vb-early: gold's T1 breakout on the five forex majors other than USD/JPY, 2005-2015
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/fx-majors-vb-early/run.mjs fetch <dir>
//   node research/edge/fx-majors-vb-early/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, summary, normP, holm } from '../index-vol-breakout/original.mjs';
import { ORIG_SHA, SEEDS, COMM, SLIP_PIPS } from '../fx-vol-breakout/run.mjs';
import { trades, placeboTrades, windowOf, W as WE, FETCH } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
export const W = { ALL: WE.ALL, H1: WE.H1, H2: WE.H2 };
export const MIN_POOL = 5000, MIN_MARKET = 1000;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

// one series (the pool or a market): the four pre-registered checks; `adj` = its Holm-adjusted p (markets only)
export function judge(tr, pl, minN) {
  const s = (w) => summary(tr.filter((t) => inW(t.day, w))), all = s(W.ALL), h1 = s(W.H1), h2 = s(W.H2);
  const beaten = pl.filter((v) => all.netR > v).length, p = normP(all.t);
  if (all.n < minN) return { all, h1, h2, beaten, p: r3(p), tooFew: true, checks: {}, pass: false };
  const checks = { bothHalves: h1.netR > 0 && h2.netR > 0, t2: all.t >= 2, cost2x: all.net2R > 0, placebo: beaten >= 38 };
  return { all, h1, h2, beaten, p: r3(p), pRaw: p, checks, pass: Object.values(checks).every(Boolean) };
}
// per market, check 2 also needs Holm-adjusted p < 0.05 over the five
export function holmMarkets(series, keys) {
  const adj = holm(keys.map((k) => series[k].pRaw ?? normP(series[k].all.t)));
  keys.forEach((k, i) => {
    const r = series[k]; r.holm = r3(adj[i]); delete r.pRaw;
    if (!r.tooFew) { r.checks.t2 = r.checks.t2 && adj[i] < 0.05; r.pass = Object.values(r.checks).every(Boolean); }
  });
  return series;
}
export function report(R) {
  const L = ['# Gold\'s T1 breakout on the five other forex majors, 2005-2015 (20 Nov 2026)', '',
    'Paper research only. Markets, rule, cost, window and pass bar were fixed in `PREREGISTRATION.md` (pushed alone before any candle of this window was fetched). Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    '| Series | n | Win | Net R/trade | Gross R/trade | Net 2x cost | 2005-10 net | 2011-15 net | Month t | Holm p | Placebos beaten | Max DD R | All checks |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, r] of Object.entries(R.series)) L.push(`| ${k} | ${r.all.n} | ${(r.all.win * 100).toFixed(1)} % | ${sg(r.all.netR)} | ${sg(r.all.grossR)} | ${sg(r.all.net2R)} | ${sg(r.h1.netR)} | ${sg(r.h2.netR)} | ${sg(r.all.t, 2)} | ${r.holm == null ? '—' : r.holm.toFixed(3)} | ${r.beaten} of 40 | ${sg(r.all.maxDD, 1)} | ${r.tooFew ? 'too few' : r.pass ? 'yes' : 'no'} |`);
  const P = R.series.pool, passed = MARKETS.filter((k) => R.series[k].pass);
  L.push('', `The pool is the one test (Holm is over the five markets only). Pool checks: ${Object.entries(P.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ') || 'none (too few)'}.`, '',
    '**Reading, as pre-registered.** ' + (P.tooFew ? 'Too few trades to judge.' : P.pass
      ? 'The rule worked on the other majors in 2005-15 and failed on them in 2016-26 (`fx-vol-breakout`): evidence of a decayed effect, not of a current one. No forward record or proposal follows for these five.'
      : 'The rule did not work on the other majors in 2005-15 either. USD/JPY\'s result stands alone among the six majors in both decades (with `yen-crosses-vol-breakout`: one market of eleven); its forward record (`usdjpy-vol-breakout-forward`) remains the judge.') +
    (passed.length ? ` Markets clearing every check on their own: ${passed.join(', ')}: a hypothesis only, already contradicted by the same market's 2016-26 result (net R at or below zero in \`fx-vol-breakout\`); not an edge, no proposal.` : ' No market clears every check on its own.'), '',
    `Beside the verdict, reported and not a test: before costs the pool is ${sg(P.all.grossR)}R a trade and it beats ${P.beaten} of 40 random-entry placebos, so the entry carried a small positive tilt in this decade (as on the yen crosses), strongest in 2005-10; it is smaller than a doubled cost and its month t is under 1, so nothing can be built on it.`, '',
    `Cost: commission ${COMM} of the entry + ${SLIP_PIPS} pip a round trip (2x shown): today's demo cost charged on 2005-15, when retail spreads were wider, so net R here is if anything flattering. No financing (out at 21:00 UTC; nights counted: ${R.nights}).`, '',
    `Data: OANDA mid M5, ${R.data.map((d) => `${d.k} ${d.first} → ${d.last} (${d.candles} candles, judged ${d.window[0]} → ${d.window[1]})`).join('; ')}.`, '');
  return L.join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, FROM = Date.parse(FETCH.from) / 1000, END = Date.parse(FETCH.to) / 1000;
  fs.mkdirSync(dir, { recursive: true });
  for (const k of MARKETS) {
    const out = path.join(dir, `${k}-5m-early.json.gz`); if (fs.existsSync(out)) continue;
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
    fs.writeFileSync(out, zlib.gzipSync(JSON.stringify([...m.values()].sort((p, q) => p[0] - q[0])))); console.log(`${k}: ${m.size} candles`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const series = {}, all = [], plAll = Array.from({ length: SEEDS }, () => []), data = []; let nights = 0;
    for (const k of MARKETS) {
      const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m-early.json.gz`)))); rows.sort((a, b) => a[0] - b[0]);
      const days = buildDays(rows).filter((d) => d.day <= W.ALL[1]), win = windowOf(days), inWin = days.filter((d) => inW(d.day, win));
      const tr = trades(k, inWin), pl = []; nights += tr.reduce((s, x) => s + (x.nights || 0), 0);
      for (let s = 1; s <= SEEDS; s++) { const p = placeboTrades(k, inWin, s); pl.push(mean(p.map((x) => x.net))); plAll[s - 1].push(...p); }
      series[k] = judge(tr, pl, MIN_MARKET); all.push(...tr);
      data.push({ k, first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10), candles: rows.length, window: win });
    }
    all.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const plPool = plAll.map((p) => mean(p.map((x) => x.net))), pool = judge(all, plPool, MIN_POOL); delete pool.pRaw; pool.holm = null;
    holmMarkets(series, MARKETS);
    const passed = MARKETS.filter((k) => series[k].pass);
    const verdict = pool.tooFew ? `TOO FEW TO JUDGE: pool n ${pool.all.n} under ${MIN_POOL}` :
      `${pool.pass ? 'PASS' : 'FAIL'}: T1 on five forex majors (no USD/JPY) pooled 2005-2015 ${sg(pool.all.netR)}R a trade net (n ${pool.all.n}, month t ${sg(pool.all.t, 2)}; gross ${sg(pool.all.grossR)}R; 2x cost ${sg(pool.all.net2R)}R; 2005-10 ${sg(pool.h1.netR)}R, 2011-15 ${sg(pool.h2.netR)}R; ${pool.beaten} of 40 placebos beaten)` +
      (pool.pass ? '' : `; fails: ${Object.entries(pool.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`) + `; markets clearing every check alone: ${passed.join(', ') || 'none'}`;
    const R = { study: 'fx-majors-vb-early', title: 'T1 breakout on five forex majors (no USD/JPY), 2005-2015', built: '2026-11-20', verdict,
      cost: { comm: COMM, slipPips: SLIP_PIPS }, nights, data, series: { pool, ...series }, placeboPool: plPool.map(r3) };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
