// Accounting, not a study: the rules of this repository that passed a pre-registered test, put side by side as one paper book
// at 1R a trade each, from the trade lists their own studies committed. No rule is tested, nothing is chosen, no verdict.
// Mostly in-sample years: the forward records are the judges (research/proposals/2026-11-23-edge-book.md).
//   node research/proposals/2026-11-23-edge-book.mjs   -> 2026-11-23-edge-book.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge', p), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };

// Each source: [day 'YYYY-MM-DD', R after the study's own costs] per trade.
export const SOURCES = {
  goldVB: { name: 'Gold volatility breakout T1', file: 'gold-vol-breakout-forward/baseline.json', cost: 'measured hourly spread + 0.05 x M slippage (C1)',
    rows: (j) => j.rows.map(([d, r]) => [d, r]) },
  usdjpyVB: { name: 'USD/JPY volatility breakout T1', file: 'usdjpy-vol-breakout-forward/baseline.json', cost: 'demo commission + 0.5 pip (pre-set)',
    rows: (j) => j.rows.map(([d, r]) => [d, r]) },
  gotobi: { name: 'Gotobi fade T2 (USD/JPY)', file: 'gotobi-exec/result.json', cost: 'the demo broker\'s own bid / ask at 00:55 and 06:00 UTC, commission',
    rows: (j) => j.trades.map((t) => [t.day, t.E]) },
  preHoliday: { name: 'Gold before a US holiday T1', file: 'gold-pre-holiday/result.json', cost: 'assumed $0.60 an ounce a round trip (not measured)',
    rows: (j) => j.tests.T1.trades.map((t) => [t.day, t.net]) },
  turnaround: { name: 'Turnaround Tuesday R2 (NAS100)', file: 'turnaround-tuesday/result.json', cost: 'assumed 0.05 % of price a round trip + one night of financing (not measured)',
    rows: (j) => j.cells['nas100-r2'].trades.map((t) => [t[1], t[6]]) },
};

export function monthKeys(from, to) {
  const out = []; let [y, m] = from.slice(0, 7).split('-').map(Number); const [Y, M] = to.slice(0, 7).split('-').map(Number);
  while (y < Y || (y === Y && m <= M)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
export function maxDD(series) { let peak = 0, cum = 0, dd = 0; for (const v of series) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); } return dd; }
const tOf = (x) => (sd(x) > 0 ? mean(x) / (sd(x) / Math.sqrt(x.length)) : 0);
export function corr(a, b) { const ma = mean(a), mb = mean(b); return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / ((a.length - 1) * sd(a) * sd(b)); }

// One stream (or a book: rows of several rules joined) inside [from, to], every calendar month counted (a month with no trade = 0).
export function stats(rows, from, to) {
  const keys = monthKeys(from, to), inW = rows.filter(([d]) => d >= from && d <= to).sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
  const mm = new Map(keys.map((k) => [k, 0])), daily = new Map(), years = {};
  for (const [d, r] of inW) { mm.set(d.slice(0, 7), mm.get(d.slice(0, 7)) + r); daily.set(d, (daily.get(d) || 0) + r); years[d.slice(0, 4)] = (years[d.slice(0, 4)] || 0) + r; }
  const m = keys.map((k) => mm.get(k)), tot = inW.reduce((s, [, r]) => s + r, 0);
  const full = Object.keys(years).filter((y) => `${y}-01-01` >= from && `${y}-12-31` <= to);
  return { trades: inW.length, R: r3(tot), perTrade: inW.length ? r3(tot / inW.length) : null, perYear: r3(mean(m) * 12), monthT: r3(tOf(m)),
    worstMonth: r3(Math.min(...m)), maxDD: r3(maxDD([...daily.keys()].sort().map((d) => daily.get(d)))),
    years: Object.fromEntries(Object.entries(years).sort().map(([y, v]) => [y, r3(v)])),
    losingFullYears: full.filter((y) => years[y] < 0).length, fullYears: full.length, monthly: m };
}

export function risk(s) {
  return [0.1, 0.25, 0.5].map((pct) => ({ pctPerTrade: pct, pctPerYear: r3(s.perYear * pct), worstDDpct: r3(s.maxDD * pct), worstMonthPct: r3(s.worstMonth * pct) }));
}

export function windowOf(all, keys, books, from, to) {
  const per = Object.fromEntries(keys.map((k) => [k, stats(all[k], from, to)]));
  const matrix = Object.fromEntries(keys.map((a) => [a, Object.fromEntries(keys.map((b) => [b, r3(corr(per[a].monthly, per[b].monthly))]))]));
  const out = { from, to, months: monthKeys(from, to).length, rules: {}, monthlyCorr: matrix, books: {} };
  for (const k of keys) { const { monthly, ...rest } = per[k]; out.rules[k] = rest; }
  for (const [name, ks] of Object.entries(books)) {
    const { monthly, ...rest } = stats(ks.flatMap((k) => all[k]), from, to);
    out.books[name] = { rules: ks, ...rest, risk: risk(rest) };
  }
  return out;
}

export function build() {
  const all = Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, s.rows(read(s.file))]));
  const span = Object.fromEntries(Object.entries(all).map(([k, r]) => [k, { first: r.map((x) => x[0]).sort()[0], last: r.map((x) => x[0]).sort().at(-1), n: r.length }]));
  return {
    built: '2026-11-23',
    what: 'Accounting only. The rules that passed a pre-registered test and committed a trade list, at 1R a trade each, after each study\'s own costs. Mostly in-sample years; the forward records judge.',
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, { name: s.name, file: `research/edge/${s.file}`, cost: s.cost, ...span[k] }])),
    A: windowOf(all, ['goldVB', 'usdjpyVB', 'preHoliday', 'turnaround'],
      { core: ['goldVB', 'usdjpyVB'], coreHoliday: ['goldVB', 'usdjpyVB', 'preHoliday'], allFour: ['goldVB', 'usdjpyVB', 'preHoliday', 'turnaround'] },
      '2021-01-01', '2026-10-31'),
    B: windowOf(all, ['goldVB', 'usdjpyVB', 'gotobi', 'preHoliday', 'turnaround'],
      { core: ['goldVB', 'usdjpyVB'], candidate: ['goldVB', 'usdjpyVB', 'gotobi', 'preHoliday'], allFive: ['goldVB', 'usdjpyVB', 'gotobi', 'preHoliday', 'turnaround'] },
      '2023-11-01', '2026-10-31'),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = build();
  fs.writeFileSync(path.join(HERE, '2026-11-23-edge-book.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ A: { rules: out.A.rules, books: out.A.books, corr: out.A.monthlyCorr }, B: { rules: out.B.rules, books: out.B.books, corr: out.B.monthlyCorr } }, (k, v) => (k === 'years' ? undefined : v), 1));
}
