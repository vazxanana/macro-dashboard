// Edge research · copper-vol-breakout: gold's T1 breakout on copper (PREREGISTRATION.md, pushed alone first). Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/copper-vol-breakout/run.mjs fetch <dir>
//   node research/edge/copper-vol-breakout/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, rng, summary, monthT } from '../index-vol-breakout/original.mjs';
import { ORIG_SHA, SEEDS, K, PLACEBO } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKET = 'xcu', COST = 0.0006, COST_GROUP = 0.001;   // ASSUMED 0.06 % of the entry a round trip (no copper symbol on the demo)
export const W = { D: ['2000-01-01', '2015-12-31'], C: ['2016-01-01', '2099-12-31'] };
export const EARLY_S = 6 * 3600;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const charge = (x) => ({ ...x, net: x.R - COST * x.entry / x.r, net2: x.R - 2 * COST * x.entry / x.r, net10: x.R - COST_GROUP * x.entry / x.r });
export function trades(days) {
  const tr = [];
  for (const d of days.filter((x) => !daySkip(x))) {
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (!x.skip) tr.push({ day: d.day, mk: MARKET, early: x.fillT - d.d0 < EARLY_S, ...charge(x) });
  }
  return tr;
}
export function placeboTrades(days, seed) {
  const P = days.filter((x) => !daySkip(x)), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), tr = [];
  for (const d of P) { const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (x) tr.push(charge(x)); }
  return tr;
}
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const sub = (tr) => ({ n: tr.length, netR: r3(mean(tr.map((x) => x.net))), grossR: r3(mean(tr.map((x) => x.R))), t: tr.length > 1 ? r2(monthT(tr).t) : null });

export function judge(tr, plMeans) {
  const d = summary(tr.filter((t) => inW(t.day, W.D))), c = summary(tr.filter((t) => inW(t.day, W.C)));
  const cTr = tr.filter((t) => inW(t.day, W.C)), net10C = r3(mean(cTr.map((x) => x.net10))), t10C = r2(monthT(cTr, 'net10').t);
  const beaten = plMeans.filter((v) => c.netR > v).length;
  const checks = { bothWindows: d.netR > 0 && c.netR > 0, t2: c.t >= 2, cost2x: c.net2R > 0, placebo: beaten >= 38, n200: c.n >= 200 };
  const timing = {};
  for (const [k, w] of Object.entries(W)) { const a = tr.filter((t) => inW(t.day, w)); timing[k] = { early: sub(a.filter((x) => x.early)), late: sub(a.filter((x) => !x.early)) }; }
  return { d, c, net10C, t10C, beaten, checks, pass: Object.values(checks).every(Boolean), timing };
}

export function report(R) {
  const J = R.judged, row = (name, s) => `| ${name} | ${s.n} | ${sg(s.grossR)} | ${sg(s.netR)} | ${sg(s.net2R)} | ${sg(s.costR)} | ${sg(s.t, 2)} | ${sg(s.grossT, 2)} | ${sg(s.t2x, 2)} | ${s.stops} / ${s.time} | ${r2(s.maxDD)} | ${s.medianStop} |`;
  const L = ['# Gold\'s T1 breakout on copper (24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, cost, windows and pass bar fixed in `PREREGISTRATION.md` (pushed alone before any copper candle was fetched). `vbTrade` imported unchanged from `research/edge/index-vol-breakout/original.mjs` (sha256 checked at run time). Nothing live changed; no proposal.', '',
    '## Results (net of the ASSUMED 0.06 % round trip; R of the stop at the UTC open)', '',
    '| Window | n | Gross R | Net R | Net 2x cost | Cost R | Month t net | Month t gross | Month t 2x | Stops / time | Max DD R | Median stop ($) |', '|---|---|---|---|---|---|---|---|---|---|---|---|',
    row(`Discovery ${R.data.first} → 2015`, J.d), row('Confirmation 2016 → now', J.c), '',
    `Placebo (confirmation, 40 seeds, random side and start 01:00-18:00 UTC, same stop distance): the rule's mean net beats ${J.beaten} of 40 seed means.`,
    `At the repository's 0.10 % group cost (reported, not judged): confirmation ${sg(J.net10C)}R a trade, month t ${sg(J.t10C, 2)}.`, '',
    `Checks: ${Object.entries(J.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'NO'}`).join(', ')}.`, '',
    '## Early (fill before 06:00 UTC) against late fills, descriptive', '',
    '| Window | Early n | Early net R | Early month t | Late n | Late net R | Late month t |', '|---|---|---|---|---|---|---|'];
  for (const [k, n] of [['D', 'Discovery'], ['C', 'Confirmation']]) { const x = J.timing[k]; L.push(`| ${n} | ${x.early.n} | ${sg(x.early.netR)} | ${sg(x.early.t, 2)} | ${x.late.n} | ${sg(x.late.netR)} | ${sg(x.late.t, 2)} |`); }
  L.push('', '## By year (net R a trade)', '', '| Year | n | Net R | Total R |', '|---|---|---|---|');
  for (const s of [J.d, J.c]) for (const [y, v] of Object.entries(s.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.netR)} | ${sg(v.total, 2)} |`);
  L.push('', `Sides, confirmation: buys n ${J.c.buys.n} ${sg(J.c.buys.netR)}R, sells n ${J.c.sells.n} ${sg(J.c.sells.netR)}R; discovery: buys n ${J.d.buys.n} ${sg(J.d.buys.netR)}R, sells n ${J.d.sells.n} ${sg(J.d.sells.netR)}R.`, '',
    `Data: OANDA mid M5 XCU/USD, ${R.data.first} → ${R.data.last}, ${R.data.candles} candles; days on file ${R.data.days}, traded days ${R.data.tradable} (the rest skipped by the original's \`daySkip\`: ${Object.entries(R.data.skips).map(([k, v]) => `${k} ${v}`).join(', ')}).`, '',
    'Caveats: the cost is ASSUMED (the demo broker lists no copper symbol, so no spread has been measured); OANDA mid candles, not broker quotes. ' +
    (J.c.grossR > 0 && !R.pass ? 'A before-cost tilt is not an edge. ' : '') + 'Never call this an edge.', '');
  return L.join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, FROM = Date.parse('2005-01-01T00:00:00Z') / 1000, END = Math.floor(Date.now() / 1000 / SEC) * SEC;
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${MARKET}-5m.json.gz`); if (fs.existsSync(out)) return;
  const m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
    for (let t = 0; t < 6 && !j; t++) {
      try { const r = await fetch(`${base}bars?sym=${MARKET}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (t + 1)));
    }
    if (!j) throw new Error(`${MARKET} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await new Promise((s) => setTimeout(s, 100));
  }
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify([...m.values()].sort((p, q) => p[0] - q[0])))); console.log(`${MARKET}: ${m.size} candles`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${MARKET}-5m.json.gz`)))); rows.sort((a, b) => a[0] - b[0]);
    const last = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
    const days = buildDays(rows).filter((d) => d.day < last), tr = trades(days);
    const skips = {}; for (const d of days) { const s = daySkip(d); if (s) skips[s] = (skips[s] || 0) + 1; }
    const cDays = days.filter((d) => inW(d.day, W.C)), pl = [];
    for (let s = 1; s <= SEEDS; s++) pl.push(mean(placeboTrades(cDays, s).map((x) => x.net)));
    const judged = judge(tr, pl), J = judged;
    const verdict = `${J.pass ? 'PASS' : 'FAIL'}: T1 on copper, confirmation 2016 → now ${sg(J.c.netR)}R a trade after an assumed 0.06 % (n ${J.c.n}, month t ${sg(J.c.t, 2)}; gross ${sg(J.c.grossR)}R; 2x cost ${sg(J.c.net2R)}R); discovery ${sg(J.d.netR)}R (n ${J.d.n}, t ${sg(J.d.t, 2)}); ${J.beaten} of 40 placebos` +
      (J.pass ? '' : `; fails: ${Object.entries(J.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    const R = { study: 'copper-vol-breakout', title: 'Gold T1 breakout on copper', built: '2026-11-24', verdict, pass: J.pass, origSha: ORIG_SHA,
      cost: { assumed: true, rt: COST, x2: 2 * COST, group: COST_GROUP },
      prereg: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
      data: { first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last, candles: rows.length, days: days.length, tradable: days.length - Object.values(skips).reduce((s, v) => s + v, 0), skips },
      placebo: pl.map(r3), judged };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
