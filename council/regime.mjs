// Regime tags for the NQ New York open run (research/edge/regime-switch, RESULT.md "Proposal", 8 Nov 2026). Pure, offline;
// tested in tests/nq-regime.test.mjs against the study's own definitions (run.mjs `series` / META).
//
//   TREND = 6-month trend strength of NAS100: ln(C / C 126 trading days ago) / (sd of those 126 daily log returns x sqrt 126),
//           taken as |TS| (two-sided system), from OANDA daily closes (the site's /md/bars proxy, tf 1d, UTC days). A trade sees
//           only candles closed before its entry (start + 24 h <= entry); Saturday / Sunday-start candles (OANDA's Sunday stub)
//           and the forming candle are dropped, as in the study.
//   META  = the stream's own net R over its trades closed in the 365 days before the entry (Rnet where a record has it, else R).
//
// Both are recorded on every live nyflip trade as `regime: { trend, ts, trendAsOf, meta, metaN, on, cut }`. The live rule reads
// neither. The paper shadow stream 'nyflip-trend' (user rule nq-regime-shadow, blockedBy 'regime-shadow') mirrors the live trade
// only when |TS| >= 0.295, the cut frozen on the first half of 2004-26 (p20 of first-half readings; second half ON +0.119R vs
// OFF -0.200R a trade, Welch t 2.73, nominal only). The study's own verdict: a loss filter for dead regimes, not a regime
// detector, and in 2023-26 the trades it skips were winners. Paper only; the owner decides.
import { ownStream } from './fills.mjs';
export const REGIME = { sym: 'nas100', window: 126, trendMin: 0.295, year: 365 * 86400 };
const DAY = 86400;
const r3 = (x) => +x.toFixed(3);

// OANDA /md/bars candles -> [[start, close]] on weekday starts, closed candles only, sorted, one per start
export function dailyRows(bars) {
  const got = new Map();
  for (const b of bars || []) {
    if (!b || b.live || !Number.isFinite(+b.time) || !Number.isFinite(+b.close)) continue;
    const t = +b.time, w = new Date(t * 1000).getUTCDay();
    if (w === 0 || w === 6) continue;
    got.set(t, [t, +b.close]);
  }
  return [...got.values()].sort((p, q) => p[0] - q[0]);
}
// index of the last daily candle closed before T (start + 24 h <= T), -1 when none
export function lastClosed(rows, T) {
  let lo = 0, hi = rows.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m][0] + DAY <= T) lo = m + 1; else hi = m; }
  return lo - 1;
}
// 6-month trend strength at the last candle closed before T: { ts (signed), abs, asOf } or null without 127 closes
export function trendStrength(rows, T, n = REGIME.window) {
  const i = lastClosed(rows, T);
  if (i < n) return null;
  const c = rows.map((r) => r[1]);
  let s = 0, q = 0;
  for (let k = i - n + 1; k <= i; k++) { const r = Math.log(c[k] / c[k - 1]); s += r; q += r * r; }
  const m = s / n, sd = Math.sqrt(Math.max(0, (q - n * m * m) / (n - 1)));
  if (!(sd > 0)) return null;
  const ts = Math.log(c[i] / c[i - n]) / (sd * Math.sqrt(n));
  return { ts, abs: Math.abs(ts), asOf: new Date(rows[i][0] * 1000).toISOString().slice(0, 10) };
}
// the stream's own net R over trades closed in [T - year, T): closed nyflip records only
// (since the owner made the open run a paper shadow on 11 Nov 2026 its own records carry blockedBy ['owner-shadow']: still the stream)
export const isNyflipClosed = (x) => !!x && x.k === 'nq-open' && x.session === 'nyflip' && !x.void && ownStream(x)
  && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && Number.isFinite(x.closed) && Number.isFinite(x.R);
export const netOf = (x) => (Number.isFinite(x.Rnet) ? x.Rnet : x.R);
export function metaR(trades, T, year = REGIME.year) {
  const a = (trades || []).filter((x) => isNyflipClosed(x) && x.closed < T && x.closed >= T - year);
  return { R: r3(a.reduce((p, x) => p + netOf(x), 0)), n: a.length };
}
export const trendOn = (trend, cut = REGIME.trendMin) => Number.isFinite(trend) && trend >= cut;
// the tag written on a live nyflip trade entered at T; rows null (no daily data) -> trend null, no shadow
export function regimeOf(rows, trades, T, cfg) {
  const cut = cfg && Number.isFinite(cfg.trendMin) ? cfg.trendMin : REGIME.trendMin;
  const t = rows && rows.length ? trendStrength(rows, T) : null, m = metaR(trades, T);
  return { trend: t ? r3(t.abs) : null, ts: t ? r3(t.ts) : null, trendAsOf: t ? t.asOf : null, meta: m.R, metaN: m.n, on: trendOn(t ? t.abs : null, cut), cut };
}
// the shadow copy of a live nyflip trade: same entry, stop, target, runner and exit, managed by the same open-trade loop; or null
export function regimeShadow(live, regime, cfg) {
  if (!live || !cfg || !regime || !trendOn(regime.trend, Number.isFinite(cfg.trendMin) ? cfg.trendMin : REGIME.trendMin)) return null;
  const sh = structuredClone(live);
  Object.assign(sh, { id: `nq-nyflipt-${live.day}`, session: 'nyflip-trend', name: 'NQ open run, trend-on only', shadow: true, blockedBy: ['regime-shadow'], of: live.id,
    note: `Shadow (paper, regime-shadow): a copy of ${live.id}, taken because NAS100's 6-month trend strength |TS| ${regime.trend} (to ${regime.trendAsOf}) is at or above the regime study's frozen cut ${regime.cut}. Not our system: the forward record of "trend-on only" next to the live rule.` });
  return sh;
}
// OANDA daily closes through the site proxy; null on any failure (the tag then carries trend null and no shadow is taken)
export async function fetchDaily(base, fetchFn = globalThis.fetch, sym = REGIME.sym, n = 400) {
  try {
    const r = await fetchFn(`${base}bars?sym=${sym}&tf=1d&n=${n}`, { signal: AbortSignal.timeout(10000) });
    const j = r && r.ok ? await r.json() : null;
    if (!j || j.src !== 'OANDA' || !Array.isArray(j.bars) || j.bars.length < REGIME.window + 2) return null;
    const rows = dailyRows(j.bars);
    return rows.length > REGIME.window ? rows : null;
  } catch (e) { return null; }
}
