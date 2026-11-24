// Edge research · usdcnh-vol-breakout: gold's T1 breakout, unchanged, on USD/CNH (PREREGISTRATION.md, pushed alone first).
// Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/usdcnh-vol-breakout/run.mjs fetch <dir>
//   node research/edge/usdcnh-vol-breakout/run.mjs run <dir>          (USD/JPY from the shared candle cache, EDGE_DATA)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, rng, summary } from '../index-vol-breakout/original.mjs';
import { ORIG_SHA, charge as jpyCharge, K, SEEDS, PLACEBO } from '../fx-vol-breakout/run.mjs';
import { DATA_DIR } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), IVB = path.join(HERE, '..', 'index-vol-breakout');
export const COMM = 0.000045, SLIP = 0.0003;           // ASSUMED round trip: commission share of price + 3 pips
export const W = { DISC: ['2011-02-01', '2017-12-31'], CONF: ['2018-01-01', '2099-12-31'] }, MIN_N = 200;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
export const costPx = (entry) => COMM * entry + SLIP;
export function charge(x) { const c = costPx(x.entry); return { ...x, net: x.R - c / x.r, net2: x.R - 2 * c / x.r }; }

export function trades(days, ch = charge) {
  const tr = [];
  for (const d of days) {
    if (daySkip(d)) continue;
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    tr.push({ day: d.day, ...ch(x) });
  }
  return tr;
}
// the original's placebo construction (seeded, same rand() order)
export function placeboTrades(days, seed) {
  const P = days.filter((x) => !daySkip(x)), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), tr = [];
  for (const d of P) {
    const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (!x) continue;
    tr.push(charge(x));
  }
  return tr;
}
// discovery starts at the first complete month with candles
export function discStart(days) {
  const f = days.find((d) => d.day >= W.DISC[0]); if (!f) return W.DISC[0];
  if (f.day.slice(8) === '01') return f.day;
  const [y, m] = f.day.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
export function decide(tr, pl, disc) {
  const d = summary(tr.filter((t) => inW(t.day, disc))), c = summary(tr.filter((t) => inW(t.day, W.CONF)));
  const beaten = pl.filter((v) => c.netR > v).length;
  const checks = { bothWindows: d.netR > 0 && c.netR > 0, t2: c.t >= 2, cost2x: c.net2R > 0, n200: c.n >= MIN_N, placebo: beaten >= 38 };
  return { disc: d, conf: c, beaten, checks, tooFew: c.n < MIN_N, pass: Object.values(checks).every(Boolean) };
}
export function monthly(tr) { const m = {}; for (const x of tr) { const k = x.day.slice(0, 7); m[k] = (m[k] || 0) + x.net; } return m; }
export function corr(a, b, from = '0000') {
  const ks = Object.keys(a).filter((k) => k in b && k >= from).sort(), x = ks.map((k) => a[k]), y = ks.map((k) => b[k]);
  const mx = mean(x), my = mean(y); let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
  return { months: ks.length, r: r3(sxy / Math.sqrt(sx * sy)) };
}
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const D = R.decision, row = (n, x) => `| ${n} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${sg(x.t, 2)} | ${sg(x.grossT, 2)} | ${sg(x.maxDD, 2)} | ${x.medianStop} |`;
  const yr = Object.entries(R.all.byYear).map(([y, v]) => `${y} ${sg(v.netR)} (n ${v.n})`).join(' · ');
  return ['# USD/CNH: gold\'s T1 volatility breakout, unchanged (24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, cost, windows and bar fixed in `PREREGISTRATION.md` (pushed alone before any USD/CNH candle was fetched). The rule\'s functions are imported from `index-vol-breakout/original.mjs` (sha256 checked). Nothing live changed; not an edge.', '',
    '| Window | n | Win | Net R/trade | Gross R/trade | Net 2x cost | Cost R/trade | Month t (net) | Month t (gross) | Max DD R | Median stop |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    row(`Discovery ${R.disc[0]} → 2017`, D.disc), row(`Confirmation 2018 → ${R.data.last}`, D.conf), row('Whole span', R.all), '',
    `Placebo (40 seeds, confirmation window): the rule beats ${D.beaten} of 40 (38 needed). Checks: ${Object.entries(D.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}.`, '',
    `By year (net R a trade): ${yr}.`, '',
    `Buys / sells (whole span): ${R.all.buys.n} at ${sg(R.all.buys.netR)}R, ${R.all.sells.n} at ${sg(R.all.sells.netR)}R.`, '',
    `**Correlation with USD/JPY T1 (descriptive)**: monthly net R, whole common span r ${sg(R.corr.all.r, 2)} over ${R.corr.all.months} months; 2018 → r ${sg(R.corr.conf.r, 2)} over ${R.corr.conf.months} months. USD/JPY T1 over the same days: ${R.jpy.n} trades, ${sg(R.jpy.netR)}R net, month t ${sg(R.jpy.t, 2)} (its own cost: 0.000045 of the entry + 0.5 pip).`, '',
    '**Reading.** ' + R.reading, '',
    `Cost (ASSUMED, not measured; the demo broker has no USDCNH): ${COMM} of the entry + ${SLIP} a round trip. Data: OANDA mid M5 usdcnh ${R.data.first} → ${R.data.last}, ${R.data.candles} candles; ${R.data.days} trading days from ${R.disc[0]}, ${R.data.skipped} skipped by the original's day rules.`, ''].join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, FROM = Date.parse('2011-02-01T00:00:00Z') / 1000, END = Math.floor(Date.now() / 1000 / 300) * 300;
  const out = path.join(dir, 'usdcnh-5m.json.gz'); if (fs.existsSync(out)) return;
  const m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
    for (let t = 0; t < 6 && !j; t++) {
      try {
        const r = await fetch(`${base}bars?sym=usdcnh&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
      } catch (e) { err = String(e.message || e); }
      if (!j) await new Promise((s) => setTimeout(s, 2000 * (t + 1)));
    }
    if (!j) throw new Error(`usdcnh ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await new Promise((s) => setTimeout(s, 120));
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(rows))); console.log(`usdcnh: ${rows.length} candles`);
}
function jpyRows(from, to) {
  const dir = path.join(DATA_DIR, 'usdjpy'), rows = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('5m-')).sort())
    for (const r of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))) if (r[0] >= from && r[0] < to) rows.push(r);
  return rows.sort((a, b) => a[0] - b[0]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(IVB, 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'usdcnh-5m.json.gz')))); rows.sort((a, b) => a[0] - b[0]);
    const lastDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
    const days0 = buildDays(rows).filter((d) => d.day < lastDay), disc = [discStart(days0), W.DISC[1]];
    const days = days0.filter((d) => d.day >= disc[0]), tr = trades(days);
    const conf = days.filter((d) => inW(d.day, W.CONF)), pl = [];
    for (let s = 1; s <= SEEDS; s++) pl.push(mean(placeboTrades(conf, s).map((x) => x.net)));
    const D = decide(tr, pl, disc), all = summary(tr);
    // USD/JPY T1 on the same span, its own cost (fx-vol-breakout's charge)
    const jr = jpyRows(rows[0][0] - 10 * 86400, rows.at(-1)[0]);
    const jd = buildDays(jr).filter((d) => d.day >= disc[0] && d.day < lastDay), jt = trades(jd, (x) => jpyCharge('usdjpy', x));
    const mc = monthly(tr), mj = monthly(jt), C = { all: corr(mc, mj), conf: corr(mc, mj, '2018-01') };
    const fails = Object.entries(D.checks).filter(([, v]) => !v).map(([k]) => k);
    const verdict = D.tooFew ? `TOO FEW TO JUDGE: confirmation n ${D.conf.n} under ${MIN_N}` :
      `${D.pass ? 'PASS' : 'FAIL'}: USD/CNH T1 confirmation 2018 → ${sg(D.conf.netR)}R a trade net (n ${D.conf.n}, month t ${sg(D.conf.t, 2)}; gross ${sg(D.conf.grossR)}R), discovery ${sg(D.disc.netR)}R (n ${D.disc.n}, t ${sg(D.disc.t, 2)}); ${D.beaten} of 40 placebos beaten` + (D.pass ? '' : `; fails: ${fails.join(', ')}`);
    const reading = D.pass ? 'A pass on the pre-registered bar at an ASSUMED cost: a hypothesis for a forward paper record with a measured USD/CNH cost, never a live rule and never an edge.' :
      (D.conf.grossR > 0 && D.conf.netR <= 0 ? 'Positive before costs and not after: a before-cost tilt is not an edge, and the cost here is assumed. ' : '') +
      (fails.length === 1 && fails[0] === 'cost2x' ? `Every check passed but the 2x-cost one (confirmation ${sg(D.conf.net2R)}R a trade at 2x, month t ${sg(D.conf.t2x, 2)}). The single cost (about ${(COMM * 7 * 1e4 + SLIP * 1e4).toFixed(1)} pips a round trip at 7.0) is ASSUMED, below the about 9.2 pips \`cnh-fix\` assumed for the same pair, and the result lives or dies on it: the cost takes about half the gross R. The net R also fades: 2018-22 positive every year, 2023 → about zero or negative (by year above). By the pre-registration this is a FAIL; at most a before-cost tilt whose after-cost value is unknown until the pair's spread is measured. ` : '') +
      `Discovery is in practice ${tr[0].day} → 2017 (USD/CNH 5-minute candles are too thin before that for the original's 200-candle day rule). ` +
      'USD/CNH does not join gold and USD/JPY; the breakout stays where it was found. Nothing live changed.';
    const R = { study: 'usdcnh-vol-breakout', title: 'Gold T1 breakout on USD/CNH', built: '2026-11-24', verdict, reading, origSha: sha, cost: { comm: COMM, slip: SLIP, assumed: true }, disc, decision: D, all,
      placebo: pl.map(r3), jpy: summary(jt), corr: C,
      data: { first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last: lastDay, candles: rows.length, days: days.length, skipped: days.filter((d) => daySkip(d)).length } };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
