// Edge research · gold-vol-breakout-with-book: a DESCRIPTIVE note, no rule tested. How the daily gold volatility breakout's
// paper record (the gold-vol-breakout study's T1, functions from original.mjs, a verbatim copy) and the supported gold book's
// recorded positions (research/edge/supported-book: its legs.json through its own positions() / bookStats(), imported) sit
// side by side, as fixed in PREREGISTRATION.md. Nothing of the book is tested, gated, filtered or sized.
//   node research/edge/gold-vol-breakout-with-book/run.mjs <dir>   (<dir>/xau-5m.json.gz, OANDA mid M5 rows, out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';
import { bookStats, weekdays, drawdown, tOf, corr } from '../supported-book/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const T1 = O.TESTS.T1;
export const BOOK = ['gtrend', 'geg'], BOOK_OPT = { mult: 1, fin: 1 };
export const WINDOWS = {
  A: { label: '2007-2017, the book\'s untouched window', from: '2007-01-01', to: '2017-12-31' },
  B: { label: '2018 to 2026-10, built-on years for the book (description only)', from: '2018-01-01', to: '2026-10-31' },
};
const DAY = 86400;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r1 = rN(1), r2 = rN(2), r3 = rN(3);
export const yearsOf = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400e3 / 365.25 + 1 / 365.25;   // supported-book's

// the breakout's T1 trades on every day the original could trade (no window: the caller places them on weekdays)
export function breakoutTrades(days) {
  const tr = [];
  for (const d of days) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { ...T1, prevRange: d.prevRange });
    if (!x.skip) tr.push({ day: d.day, net: x.net, R: x.R, side: x.side });
  }
  return tr;
}
// a daily series on the window's weekdays: each trade's net R on its trade day, 0 elsewhere
export function breakoutDaily(tr, days) {
  const ix = new Map(days.map((d, i) => [d, i])), v = new Array(days.length).fill(0); let n = 0;
  for (const x of tr) { const i = ix.get(x.day); if (i != null) { v[i] += x.net; n++; } }
  return { v, n };
}
export function monthly(v, days) { const m = new Map(); days.forEach((d, i) => m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) || 0) + v[i])); return [...m.values()]; }
// the reported figures of one daily series
export function stats(v, days, n, yrs) {
  const total = sum(v), dd = drawdown(v), mv = monthly(v, days);
  return { n, total: r1(total), perYear: r2(total / yrs), maxDD: r1(dd.dd), longestUnder: dd.longest,
    posMonths: r3(mv.filter((x) => x > 0).length / mv.length), months: mv.length, tMonthly: r2(tOf(mv)) };
}
export function combine(book, brk, days, yrs) {
  const v = book.v.map((x, i) => x + brk.v[i]);
  const b = stats(book.v, days, book.n, yrs), k = stats(brk.v, days, brk.n, yrs), c = stats(v, days, book.n + brk.n, yrs);
  const ddSum = drawdown(book.v).dd + drawdown(brk.v).dd;
  return { book: b, breakout: k, combined: c,
    corr: { daily: r3(corr(book.v, brk.v)), monthly: r3(corr(monthly(book.v, days), monthly(brk.v, days))) },
    ddRatio: ddSum > 0 ? r3(drawdown(v).dd / ddSum) : null };
}

// ─── report (RESULT.md is this function of result.json) ───
const s1 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(R) {
  const a = R.windows.A;
  return `DESCRIPTIVE, no rule tested: 2007-17 the breakout and the gold book correlate ${s2(a.corr.monthly)} by month; side by side their worst drawdown is ${Math.round(a.ddRatio * 100)} % of the two drawdowns added`;
}
export function report(R) {
  const L = [];
  L.push('# Gold: the daily volatility breakout beside the supported gold book (descriptive)', '');
  L.push('A descriptive note. **No rule is tested, there is no pass or fail, and nothing live changes.** It is not a gate, exit, entry or size of the live gold book (owner decision 44 holds) and it is not a sizing proposal. The book\'s positions are its supported-book records, read through that study\'s own `positions()` / `bookStats()`; the breakout is the `gold-vol-breakout` T1 from `original.mjs`, a verbatim copy (sha256 in `result.json`). Any use of the breakout is the owner\'s decision (see the forward-record proposal on branch `gold-vol-breakout-proposal`). The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  for (const [wk, w] of Object.entries(R.windows)) {
    L.push(`## Window ${wk}: ${w.label}`, '');
    L.push(`${w.from} to ${w.to}, ${w.weekdays} weekdays, ${w.years} years. Equal size: 1R a book unit, 1R a breakout trade.`, '');
    L.push('| Record | n | Total R | R a year | Worst drawdown R (closed) | Longest under water (weekdays) | Positive months | Month-sum t |', '|---|---|---|---|---|---|---|---|');
    for (const [k, name] of [['book', 'Book (Gold trend + Gold daily engulf), positions'], ['breakout', 'Breakout T1, trades'], ['combined', 'Both, side by side']]) {
      const x = w[k]; L.push(`| ${name} | ${x.n} | ${s1(x.total)} | ${s2(x.perYear)} | ${x.maxDD.toFixed(1)} | ${x.longestUnder} | ${(x.posMonths * 100).toFixed(0)} % of ${x.months} | ${s2(x.tMonthly)} |`);
    }
    L.push('', `- Correlation of the two: daily ${s2(w.corr.daily)}, monthly ${s2(w.corr.monthly)}.`);
    L.push(`- Combined worst drawdown ÷ (book drawdown + breakout drawdown) = ${w.ddRatio.toFixed(3)} (${w.combined.maxDD.toFixed(1)} ÷ (${w.book.maxDD.toFixed(1)} + ${w.breakout.maxDD.toFixed(1)})).`);
    L.push(`- Check: the book's month-sum t and drawdown here equal \`bookStats\`' own for this window (${s2(w.check.tMonthly)}, ${w.check.maxDD.toFixed(1)}R): ${w.check.ok ? 'yes' : 'NO'}.`, '');
  }
  L.push('## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- Book: ${R.book}`);
  L.push(`- Breakout: ${R.breakout}`);
  L.push('- Daily series on weekdays; the combined series is the plain sum. Drawdown, longest stretch under water, month-sum t and correlation are supported-book\'s own `drawdown`, `tOf` and `corr`.');
  L.push('- To repeat: `node research/edge/gold-vol-breakout-with-book/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD, the replication study\'s cache, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz'))));
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  const odays = O.buildDays(rows.filter((r) => r[0] < lastFull)), tr = breakoutTrades(odays);
  const legs = JSON.parse(fs.readFileSync(path.join(HERE, '../supported-book/legs.json'), 'utf8')).units;
  const out = {};
  for (const [wk, W] of Object.entries(WINDOWS)) {
    const { out: bs, days, v } = bookStats(legs, BOOK, { ...W, halves: [] }, BOOK_OPT);
    if (days.join() !== weekdays(W.from, W.to).join()) throw new Error('weekday grid');
    const yrs = yearsOf(W.from, W.to), brk = breakoutDaily(tr, days);
    const c = combine({ v, n: bs.positions }, brk, days, yrs);
    out[wk] = { ...W, weekdays: days.length, years: r2(yrs), ...c,
      check: { tMonthly: bs.tMonthly, maxDD: bs.maxDD, ok: bs.tMonthly === c.book.tMonthly && bs.maxDD === c.book.maxDD } };
  }
  const plan = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const A = out.A, B = out.B;
  const reading = `In 2007-17 the two records barely move together (daily ${s2(A.corr.daily)}, monthly ${s2(A.corr.monthly)}): the book is a few long gold positions held for days to weeks, the breakout one intraday trade most weekdays, either side. `
    + `Side by side at equal size the worst drawdown was ${A.combined.maxDD.toFixed(1)}R against ${A.book.maxDD.toFixed(1)}R (book) and ${A.breakout.maxDD.toFixed(1)}R (breakout) alone, ${(A.ddRatio * 100).toFixed(0)} % of the two added; the longest stretch under water ${A.combined.longestUnder} weekdays against ${A.book.longestUnder} and ${A.breakout.longestUnder}; month-sum t ${s2(A.combined.tMonthly)} against ${s2(A.book.tMonthly)} and ${s2(A.breakout.tMonthly)}. `
    + `In 2018-26 (built-on years for the book, description only) the correlation was daily ${s2(B.corr.daily)}, monthly ${s2(B.corr.monthly)}, and the combined drawdown ${(B.ddRatio * 100).toFixed(0)} % of the two added. `
    + `At 1R each the breakout carries about ${Math.round(A.breakout.n / A.book.n)} times as many trades as the book has positions, so it sets most of the combined figures; the combined month-sum t is a description of these two paths, not evidence of anything. `
    + 'These are two independent paper records laid side by side, not a test:the breakout\'s own evidence is its replication study (2007-15) and the original study (2016-26), the book\'s is supported-book (a FAIL on its t). Equal size is a reporting convention, not a weight; the figures change nothing in the book, its forward-test protocol or its stop lines, and they are not a sizing proposal.';
  const result = { study: 'gold-vol-breakout-with-book', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-with-book/PREREGISTRATION.md', planSha256: plan,
    kind: 'descriptive', test: 'none', originalSha256: ORIG_SHA, dataEnd: new Date((lastFull - DAY) * 1000).toISOString().slice(0, 10),
    book: 'Gold trend + Gold daily engulf from research/edge/supported-book/legs.json through its positions() / bookStats() (x1F1: $0.30 a unit, financing on every unit), net R a position booked on its close day, 1R a unit',
    breakout: `gold-vol-breakout T1 (UTC open ± 0.5 x the previous folded day's range, stop at the open, out at 20:55 UTC) from original.mjs on OANDA mid M5 XAU/USD, $${O.COST.toFixed(2)} a round trip, net R a trade on its trade day, 1R a trade; ${tr.length} trades ${tr[0].day} → ${tr.at(-1).day}`,
    windows: out, reading };
  result.verdict = verdictLine(result);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict, result.verdict.length);
  for (const wk of Object.keys(out)) console.log(wk, JSON.stringify({ book: out[wk].book, brk: out[wk].breakout, comb: out[wk].combined, corr: out[wk].corr, ratio: out[wk].ddRatio, check: out[wk].check }));
}
