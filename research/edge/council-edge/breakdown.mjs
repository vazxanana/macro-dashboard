// Council edge · performance breakdown of the council's paper records (read only; changes no file of the council).
//   node research/edge/council-edge/breakdown.mjs <council-data dir> [--json out.json] [--md out.md]
// Reads trades.json (live + shadow), research.json (research paper: replica signals, NQ open run, cycle) and, as context only,
// research/replay-2w.json (system replays, not forward). Every closed trade (win / loss / be) is counted at its cost-adjusted R:
// Rnet where the Trader stamped one, else R less council/fills.mjs tradeCost (spread + half a spread of slippage per market
// order) for gold / forex / crypto, the CME micro round trip (digest ICT_COST_PTS) for NQ. A trade's R is already x size.
// Tables: by book, then within each book by system, market, session (entry time, UTC), setup family, hold time and exit reason;
// each row n, win % with its Wilson 95% interval, expectancy with its 95% t interval, t, total, max drawdown, profit factor.
// A row is flagged NEGATIVE when its 95% interval of the expectancy lies wholly below 0 (n >= 5).
import fs from 'node:fs';
import path from 'node:path';
import { tradeCost } from '../../../council/fills.mjs';
import { summarize, groupBy, sessionOf, holdBucket } from './stats.mjs';

export const SYS_K = ['replica', 'mosha-bo', 'trend', 'gtrend', 'gtrend5', 'gtl', 'geg', 'gmp'];
export const ENGINE = ['scalp', 'intraday', 'swing', 'position', 'rscalp', 'rintra', 'rswing', 'm30m1'];
const DONE = new Set(['win', 'loss', 'be']);
const GROUP = { xau: 'Metals', btc: 'Crypto', eth: 'Crypto', sol: 'Crypto', xrp: 'Crypto', eurusd: 'Forex', gbpusd: 'Forex', audusd: 'Forex', usdcad: 'Forex', usdchf: 'Forex' };
const M = (m) => GROUP[m] ? { group: GROUP[m], spot: m === 'xau' } : null;
const NQ_COST_PTS = { nq: 1.37, es: 1.0 };

// net R of one closed record
export function netR(x) {
  if (Number.isFinite(x.Rnet)) return x.Rnet;
  const size = x.rawR != null && x.size ? x.size : 1;
  if (Number.isFinite(x.costR)) return x.R - x.costR * size;
  if (NQ_COST_PTS[x.market]) { const r0 = +x.r0 || Math.abs(x.entry - (x.stop0 != null ? x.stop0 : x.stop)); return r0 > 0 ? x.R - NQ_COST_PTS[x.market] / r0 * size : x.R; }
  const c = tradeCost(x, M(x.market)); return c ? x.R - c.costR * size : x.R;
}
export const family = (k) => SYS_K.includes(k) ? 'main system' : ENGINE.includes(k) ? 'legacy engine' : k === 'nq-open' ? 'NQ open run' : k === 'lit' ? 'LIT' : 'other research';
export function exitOf(x) {
  if (x.exitKind) return x.exitKind;
  if (/trail/.test(x.exit || '')) return 'trail';
  if (/\d+ h$|16:00|21:00|time/.test(x.exit || '')) return 'time';
  if (x.status === 'be') return 'break-even';
  if (x.status === 'win' && Number.isFinite(x.rr) && Math.abs((x.rawR ?? x.R) - x.rr) <= 0.02) return 'target';
  if (x.status === 'loss' && (x.rawR ?? x.R) <= -0.98) return 'stop';
  if (x.exit === 'retired') return 'retired';
  return x.status === 'win' ? 'other win' : 'other';
}

// closed rows with the fields the tables group on
export function collectRows({ trades = [], research = [], replay = [] } = {}) {
  const rows = [];
  const push = (x, book) => {
    if (!x || !DONE.has(x.status) || x.R == null || !Number.isFinite(+x.R)) return;
    const t0 = x.filled || x.opened, t1 = x.closed;
    rows.push({ id: x.id, book, k: x.k, family: family(x.k), market: x.market, side: x.side, session: Number.isFinite(t0) ? sessionOf(t0) : null,
      hold: holdBucket(t1 - t0), exit: exitOf(x), R: +x.R, net: +netR(x).toFixed(3), t: t0, closed: t1 });
  };
  for (const x of trades) if (x.status !== 'duplicate') push(x, x.shadow ? 'shadow' : 'live');
  for (const x of research) push(x, 'research paper');
  for (const x of replay) push(x, 'replay (backtest)');
  rows.sort((a, b) => a.closed - b.closed);
  return rows;
}

export const NOFLAG = ['exit', 'hold time'];
const DIMS = [['system', (r) => r.k], ['family', (r) => r.family], ['market', (r) => r.market], ['session', (r) => r.session],
  ['hold time', (r) => r.hold], ['exit', (r) => r.exit], ['side', (r) => r.side]];

export function breakdown(rows) {
  const out = { books: {} };
  for (const [book, rs] of groupBy(rows, (r) => r.book)) {
    const b = { all: { ...summarize(rs.map((r) => r.net)), gross: summarize(rs.map((r) => r.R)).mean, from: rs[0].t, to: rs.at(-1).closed }, by: {} };
    for (const [dim, fn] of DIMS) {
      b.by[dim] = [...groupBy(rs, fn)].map(([key, a]) => ({ key, ...summarize(a.map((r) => r.net)), gross: summarize(a.map((r) => r.R)).mean }))
        .sort((x, y) => y.n - x.n);
    }
    out.books[book] = b;
  }
  out.negative = [];
  for (const [book, b] of Object.entries(out.books)) {
    if (b.all.neg) out.negative.push({ book, dim: 'all', key: 'all', n: b.all.n, mean: b.all.mean, hi: b.all.hi });
    // exit and hold time describe how a trade ended (a stop is always a loss), so they are not candidates to switch off
    for (const [dim, list] of Object.entries(b.by)) if (!NOFLAG.includes(dim)) for (const r of list) if (r.neg) out.negative.push({ book, dim, key: r.key, n: r.n, mean: r.mean, hi: r.hi });
  }
  return out;
}

const f2 = (v) => v == null || !Number.isFinite(v) ? '–' : (v > 0 ? '+' : '') + v.toFixed(2);
const pc = (v) => v == null || !Number.isFinite(v) ? '–' : Math.round(v * 100) + '%';
export function rowMd(key, s, flag = true) {
  return `| ${key} | ${s.n} | ${pc(s.win)} (${pc(s.winLo)}–${pc(s.winHi)}) | ${f2(s.mean)} (${f2(s.lo)} to ${f2(s.hi)}) | ${f2(s.t)} | ${f2(s.total)} | ${f2(s.maxDD)} | ${s.pf == null ? '–' : s.pf.toFixed(2)} | ${flag && s.neg ? '**NEGATIVE**' : ''} |`;
}
export const HEAD = '| group | n | win % (95% CI) | net R a trade (95% CI) | t | total net R | max DD | PF | flag |\n|---|---|---|---|---|---|---|---|---|';

export function toMarkdown(bd, dims = ['system', 'market', 'session', 'hold time', 'exit']) {
  const L = [];
  L.push('### By book (net of costs)', '', HEAD);
  for (const [book, b] of Object.entries(bd.books)) L.push(rowMd(book, b.all));
  for (const [book, b] of Object.entries(bd.books)) {
    L.push('', `### ${book}`);
    for (const d of dims) { L.push('', `By ${d}:`, '', HEAD); for (const r of b.by[d]) if (r.n >= 3) L.push(rowMd(r.key, r, !NOFLAG.includes(d))); }
  }
  return L.join('\n');
}

export function load(dir) {
  const rd = (p) => { try { return JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8')); } catch { return null; } };
  const rep = rd('research/replay-2w.json');
  return { trades: rd('trades.json') || [], research: rd('research.json') || [], replay: (rep && rep.trades) || [] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node breakdown.mjs <council-data dir> [--json out] [--md out]'); process.exit(2); }
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const bd = breakdown(collectRows(load(dir)));
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(bd, null, 1));
  const md = toMarkdown(bd);
  if (arg('--md')) fs.writeFileSync(arg('--md'), md); else console.log(md);
  console.error('negative rows:', bd.negative.length);
}
