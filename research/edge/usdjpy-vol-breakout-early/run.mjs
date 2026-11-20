// Edge research · usdjpy-vol-breakout-early: gold's T1 breakout on USD/JPY 2005-2015, the follow-up fx-vol-breakout's
// pre-registration asked for (PREREGISTRATION.md, pushed alone first). Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/usdjpy-vol-breakout-early/run.mjs fetch <dir>
//   node research/edge/usdjpy-vol-breakout-early/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, summary } from '../index-vol-breakout/original.mjs';
import { trades, placeboTrades, SEEDS } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const W = { ALL: ['2005-01-04', '2015-12-31'], H1: ['2005-01-04', '2010-12-31'], H2: ['2011-01-01', '2015-12-31'] };
export const FETCH = { from: '2004-12-01T00:00:00Z', to: '2016-01-08T00:00:00Z' }, MIN_N = 1000;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

// the window starts at the first complete month with candles (pre-registered)
export function windowOf(days) {
  const first = days.find((d) => d.day >= W.ALL[0]); if (!first) return null;
  if (first.day <= '2005-01-31') return W.ALL;
  const m = first.day.slice(0, 7), [y, mo] = m.split('-').map(Number), next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  return [first.day.slice(8) === '01' || first.day.slice(8) <= '04' ? first.day : next, W.ALL[1]];
}
export function decide(tr, pl, win) {
  const s = (w) => summary(tr.filter((t) => inW(t.day, w))), all = s(win), h1 = s([win[0], W.H1[1]]), h2 = s(W.H2);
  const beaten = pl.filter((v) => all.netR > v).length;
  if (all.n < MIN_N) return { all, h1, h2, beaten, tooFew: true, pass: false, checks: {} };
  const checks = { bothHalves: h1.netR > 0 && h2.netR > 0, t2: all.t >= 2, cost2x: all.net2R > 0, placebo: beaten >= 38 };
  return { all, h1, h2, beaten, checks, pass: Object.values(checks).every(Boolean) };
}
export function report(R) {
  const d = R.decision, row = (n, x) => `| ${n} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.t, 2)} | ${sg(x.maxDD, 2)} |`;
  return ['# USD/JPY: gold\'s T1 breakout on 2005-2015 (20 Nov 2026)', '',
    'Paper research only. The follow-up `fx-vol-breakout` named: rule, cost, window and pass bar fixed in `PREREGISTRATION.md` before any candle of this window was fetched. Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    '| Window | n | Win | Net R/trade | Gross R/trade | Net 2x cost | Month t | Max DD R |', '|---|---|---|---|---|---|---|---|',
    row(`${R.window[0]} → ${R.window[1]}`, d.all), row(`→ 2010`, d.h1), row('2011-2015', d.h2), '',
    `Placebo (40 seeds): the rule beats ${d.beaten} of 40 (38 needed). Checks: ${Object.entries(d.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ') || 'none (too few)'}.`, '',
    `Data: OANDA mid M5 usdjpy ${R.data.first} → ${R.data.last}, ${R.data.candles} candles. Cost: 0.000045 of the entry + 0.005 a round trip.`, ''].join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, END = Date.parse(FETCH.to) / 1000, m = new Map();
  for (let a = Date.parse(FETCH.from) / 1000; a < END;) {
    const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${base}bars?sym=usdjpy&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
    }
    if (!j) throw new Error(`usdjpy ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await new Promise((s) => setTimeout(s, 120));
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'usdjpy-5m-early.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
  console.log(`usdjpy 5m early: ${rows.length} candles`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'usdjpy-5m-early.json.gz')))); rows.sort((a, b) => a[0] - b[0]);
    const days = buildDays(rows).filter((d) => d.day <= W.ALL[1]), win = windowOf(days), inWin = days.filter((d) => inW(d.day, win));
    const tr = trades('usdjpy', inWin), pl = [];
    for (let s = 1; s <= SEEDS; s++) pl.push(mean(placeboTrades('usdjpy', inWin, s).map((x) => x.net)));
    const d = decide(tr, pl, win);
    const verdict = d.tooFew ? `TOO FEW TO JUDGE: n ${d.all.n} under ${MIN_N}` :
      `${d.pass ? 'PASS' : 'FAIL'}: USD/JPY T1 ${win[0].slice(0, 4)}-2015 ${sg(d.all.netR)}R a trade net (n ${d.all.n}, month t ${sg(d.all.t, 2)}; gross ${sg(d.all.grossR)}R; halves ${sg(d.h1.netR)}R / ${sg(d.h2.netR)}R; ${d.beaten} of 40 placebos beaten)` +
      (d.pass ? '' : `; fails: ${Object.entries(d.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    const R = { study: 'usdjpy-vol-breakout-early', title: 'USD/JPY T1 breakout, 2005-2015', built: '2026-11-20', verdict, window: win, decision: d,
      placebo: pl.map((v) => Math.round(v * 1000) / 1000),
      data: { first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10), candles: rows.length } };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
