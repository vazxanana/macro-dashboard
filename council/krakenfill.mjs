// Council · Kraken backfill: fills the replay's per-day Kraken trade-history cache (council/krakenhist.mjs) in time-boxed runs,
// so the nightly replay (backtest.mjs) can read crypto from Kraken, the feed the live Trader trades on, instead of Binance.
// Why: Kraken's public Trades endpoint answers ~1 call a second at 1,000 trades a call. BTC needs ~175 calls a day, ~5,600 for
// the replay's 30-day window plus warm-up (about two hours); the nightly replay spends at most 300 calls a coin (and lost its
// progress whenever a run was cancelled), so BTC's cache could never catch up. This runs from kraken-backfill.yml every 30 min:
// one runner, calls paced 1.1 s apart, stopped at the time box with each pair's cursor saved (.part.json), resumed next run.
// Reads and writes only the cache directory; changes no trading rule and no council-data file.
// Usage: node council/krakenfill.mjs <cacheDir> [days=30] [minutes=25]
//        node council/krakenfill.mjs --merge <fromDir> <intoDir>   (union of two cache copies, see mergeCacheDirs)
//        node council/krakenfill.mjs --status <cacheDir> [days=30] (coverage only, no network)
import fs from 'node:fs';
import path from 'node:path';
import { krakenMinutes, krakenCoverage, mergeCacheDirs } from './krakenhist.mjs';

// the replay's Kraken markets (backtest.mjs MARKETS): the four coins, then PAXG (gold's fallback when OANDA can't be read)
export const PAIRS = { btc: 'XBTUSD', eth: 'ETHUSD', sol: 'SOLUSD', xrp: 'XRPUSD', xau: 'PAXGUSD' };
// calls a whole day took, measured on Kraken (7 Nov runs); the run's own measurement replaces it once it finishes a day
export const CALLS_PER_DAY = { XBTUSD: 175, ETHUSD: 48, SOLUSD: 38, XRPUSD: 29, PAXGUSD: 5 };
export const KEEP_DAYS = 60;   // crypto day files older than this are pruned (the replay reads 31 days; research replays keep their own cache)

// The first day the replay of `days` days may need, with a day of margin: backtest.mjs needs 1m candles from the day
// before its window starts (startT - 1 day), and its window ends at the time it runs, after this.
export const targetDay = (now, days) => Math.floor((now - (days + 2) * 86400) / 86400) * 86400;

// Plan: pairs ordered by days still missing, fewest first, so the coins closest to coverage switch to Kraken soonest.
export function plan(cacheDir, days, now = Date.now() / 1000, pairs = PAIRS) {
  const target = targetDay(now, days), today = Math.floor(now / 86400) * 86400;
  return Object.entries(pairs).map(([key, pair]) => {
    const c = krakenCoverage(pair, cacheDir, now);
    const missing = Math.max(0, Math.round(((c.fromT == null ? today : c.fromT) - target) / 86400));
    return { key, pair, target, missing, coverage: c };
  }).sort((a, b) => a.missing - b.missing);
}

// One time-boxed run: each pair in plan order reads back from today to the target day until covered or out of time.
export async function backfill(cacheDir, { days = 30, minutes = 25, now = Date.now() / 1000, pairs = PAIRS, log = console.log } = {}) {
  const deadline = Date.now() + minutes * 60000, rows = [];
  for (const p of plan(cacheDir, days, now, pairs)) {
    const t0 = Date.now();
    let K = null, err = null;
    try { K = await krakenMinutes(p.pair, p.target, now, { cacheDir, budget: Infinity, deadline, now }); } catch (e) { err = String(e.message || e).slice(0, 200); }
    const c = krakenCoverage(p.pair, cacheDir, now);
    const covered = c.fromT != null && c.fromT <= p.target;
    const measured = K && K.days.filter((d) => d.calls > 1);
    const perDay = measured && measured.length ? Math.round(measured.reduce((s, d) => s + d.calls, 0) / measured.length) : null;
    const left = covered ? 0 : Math.max(0, Math.round(((c.fromT == null ? Math.floor(now / 86400) * 86400 : c.fromT) - p.target) / 86400));
    const row = { key: p.key, pair: p.pair, from: c.from, target: new Date(p.target * 1000).toISOString().slice(0, 10), covered, daysLeft: left,
      calls: K ? K.calls : 0, daysDone: K ? K.days.map((d) => `${d.day}:${d.calls}`) : [], callsPerDay: perDay, inside: c.partial, secs: Math.round((Date.now() - t0) / 1000), error: err };
    row.callsLeft = left * (perDay || CALLS_PER_DAY[p.pair] || 100);
    rows.push(row);
    log(`${p.key} ${p.pair}: cache from ${c.from || '-'} (target ${row.target})${covered ? ' covers the replay window' : `, ${left} days left (~${row.callsLeft} calls)`}; ${row.calls} calls in ${row.secs}s${row.daysDone.length ? `; days finished (calls): ${row.daysDone.join(' ')}` : ''}${c.partial ? `; inside ${c.partial.day} at ${c.partial.at} (${c.partial.calls} calls so far)` : ''}${err ? `; error: ${err}` : ''}`);
  }
  return rows;
}

// crypto day files older than KEEP_DAYS, and temp files a killed run left behind
export function prune(cacheDir, now = Date.now() / 1000, keepDays = KEEP_DAYS, pairs = PAIRS) {
  if (!fs.existsSync(cacheDir)) return 0;
  const cut = new Date((now - keepDays * 86400) * 1000).toISOString().slice(0, 10), names = new Set(Object.values(pairs));
  let n = 0;
  for (const f of fs.readdirSync(cacheDir)) {
    const m = f.match(/^kraken-([A-Z]+)-(\d{4}-\d{2}-\d{2})(\.part)?\.json$/);
    if ((m && names.has(m[1]) && m[2] < cut) || f.endsWith('.tmp')) { fs.rmSync(path.join(cacheDir, f), { force: true }); n++; }
  }
  return n;
}

function summary(rows, minutes) {
  const capacity = Math.floor((minutes * 60000) / 1100);   // calls one run can make
  const lines = ['| coin | Kraken cache from | target | covered | calls this run | calls/day (measured) | days left | runs left (~) |', '|---|---|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.key} | ${r.from || '-'} | ${r.target} | ${r.covered ? 'yes' : 'no'} | ${r.calls} | ${r.callsPerDay ?? '-'} | ${r.daysLeft} | ${r.covered ? 0 : Math.ceil(r.callsLeft / capacity)} |`);
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const a = process.argv.slice(2);
  if (a[0] === '--merge') {
    console.log(`merged ${mergeCacheDirs(a[1], a[2])} files from ${a[1]} into ${a[2]}`);
  } else if (a[0] === '--status') {
    for (const p of plan(a[1] || '.duka-cache', +(a[2] || 30))) console.log(`${p.key} ${p.pair}: cache from ${p.coverage.from || '-'}, ${p.missing} days to go${p.coverage.partial ? ` (inside ${p.coverage.partial.day} at ${p.coverage.partial.at})` : ''}`);
  } else {
    const dir = a[0] || '.duka-cache', days = +(a[1] || 30), minutes = +(a[2] || 25);
    console.log(`pruned ${prune(dir)} old files`);
    const rows = await backfill(dir, { days, minutes });
    const md = summary(rows, minutes);
    console.log(md);
    if (process.env.GITHUB_STEP_SUMMARY) try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Kraken backfill\n\n${md}\n`); } catch (e) {}
    // save the cache only when this run moved a backfill on (a day finished, or calls toward a window not covered yet): once every
    // coin is covered, a run only tops up today's trades, which the replay reads itself, so most runs save nothing
    const save = rows.some((r) => r.daysDone.length > 0 || (!r.covered && r.calls > 0));
    console.log(`cache save: ${save ? 'yes' : 'no (nothing new beyond today\'s trades)'}`);
    if (process.env.GITHUB_OUTPUT) try { fs.appendFileSync(process.env.GITHUB_OUTPUT, `save=${save}\n`); } catch (e) {}
  }
}
