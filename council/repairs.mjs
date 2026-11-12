import { findDuplicates, markDuplicate } from './dedupe.mjs';
// One-time data repairs for the council Trader (data hygiene only: no trading rule, threshold, entry or exit changes).
// Each repair runs once: its key goes into config.repairs and a line into config.history (by 'repair'). Running the same
// repair again changes nothing. Split out of trader.mjs (7 Nov) so it can be tested on copies of the council-data files.

// 4 Nov 15:21-23:47 UTC: replica research signals on the markets quoted with 4-5 decimals (the five forex pairs, plus one
// XRP signal) were stored with prices rounded to 2 decimals (the pxr rounding bug, fixed since), so entry == stop or one
// 0.01 tick apart: R came out -1, null or 0 for "wins". They are kept for the record but marked void, and every research
// stat skips void records.
const ROUNDED_FROM = Date.parse('2026-11-04T15:21:00Z') / 1000, ROUNDED_TO = Date.parse('2026-11-04T23:48:00Z') / 1000;
const at2dp = (v) => isFinite(v) && Math.round(v * 100) / 100 === v;
export const isRoundedReplica = (x) => x && x.k === 'replica' && x.market !== 'xau' && (x.dec ?? 2) >= 4
  && x.opened >= ROUNDED_FROM && x.opened < ROUNDED_TO && at2dp(x.entry) && at2dp(x.stop) && Math.abs(x.entry - x.stop) < 0.0101;

export function voidRoundedReplicas(research, config, nowISO) {
  const key = 'void-rounded-replica-2026-11-04';
  config.repairs = config.repairs || []; config.history = config.history || [];
  if (config.repairs.includes(key)) return 0;
  const why = 'Prices were rounded to 2 decimals on markets quoted with 4-5 decimals (pxr bug, fixed), so entry equalled the stop (or sat one 0.01 tick from it) and R was -1, null or 0 for a "win".';
  let n = 0; const mk = {};
  for (const x of research) if (!x.void && isRoundedReplica(x)) { x.void = true; x.voidWhy = 'rounded prices: entry == stop (pxr bug, 4 Nov 15:21-23:47 UTC)'; n++; mk[x.market] = (mk[x.market] || 0) + 1; }
  config.repairs.push(key);
  config.history.push({ at: nowISO, by: 'repair', change: `Research: ${n} replica signals of 4 Nov 15:21-23:47 UTC marked void (${Object.entries(mk).map(([m, c]) => `${m} ${c}`).join(', ') || 'none found'}); research stats skip void records`, why });
  return n;
}

// config.history only described crypto trend v1 (pairs-best, 5 Nov 00:41); the code has run v2 / v3 since 5 Nov without a
// history entry. One catch-up line that says what the code does (no change to the system).
export function historyCatchUp(config, nowISO) {
  config.repairs = config.repairs || []; config.history = config.history || [];
  let n = 0;
  if (!config.repairs.includes('history-crypto-trend-v3')) {
    config.history.push({ at: nowISO, by: 'repair',
      change: 'Crypto trend as the code runs it (v2/v3 since 5 Nov): two slots per coin (BTC, ETH, SOL, XRP), long only. A daily close above the prior 55 daily highs, or above the prior 100 daily highs, buys at market on the next run (one open trade per slot). Catastrophe stop 5 x ATR(20) below the entry, fixed. Exit: a daily close under the ratcheting midpoint of that slot\'s own 55- or 100-day channel (high+low)/2, at market. One add per trade at +1R (cryptoAdd), with its own 5 ATR stop, leaving with the first trade. A coin stops opening trend trades once its forward trend total reaches -8R (cryptoTrendStopR). Trades opened before v3 keep their own rule (kATR trail, out under the 27/50-day low).',
      why: 'history catch-up: code changed without a history entry (the 5 Nov pairs-best entry still describes v1: 55-day breakout, 4 ATR trail, out under the 27-day low).' });
    config.repairs.push('history-crypto-trend-v3'); n++;
  }
  if (!config.repairs.includes('history-pairs-dormant') && !(config.history || []).some((h) => /dormant/i.test(h.change || '') && /pair/i.test(h.change || ''))) {
    const live = (config.replicaLive || []).filter((m) => m !== 'xau');
    if (!live.length && (config.pairsLiveAt != null || config.pairVolPct != null || config.pairStopR != null)) {
      config.history.push({ at: nowISO, by: 'repair',
        change: `Pairs replica settings are dormant: pairsLiveAt, pairVolPct (${config.pairVolPct}) and pairStopR (${config.pairStopR}) are kept, but no pair is in replicaLive (${JSON.stringify(config.replicaLive || [])}), so no pair trades the replica live. They only label the pairs' research signals (calm, pairStop) and the Pairs card's gate.`,
        why: 'history catch-up: since pairs-best (5 Nov) put forex back to research only, nothing said these settings no longer trade.' });
      n++;
    }
    config.repairs.push('history-pairs-dormant');
  }
  return n;
}

// 4-6 Nov: the gold M30 → M1 setup (m30m1) fires on the same M1 entry as the Scalp, so the same trade was recorded twice (once as
// scalp, once as m30m1). The Trader has dropped the m30m1 copy since 6 Nov 18:03 UTC (#259: same market, side, minute and
// entry), but the 29 copies recorded before that stayed in trades.json and counted in every shadow stat (the shadow book,
// the m30m1 Coach rules, the scoreboard): 26 of the 28 m30m1 trades closed in the week of 2-8 Nov were Scalp copies
// (research/edge/shadow-audit). The copies are kept for the record with status 'duplicate' (no tally counts that status),
// `dupOf` naming the trade they copy and `void`; their R is left as it was. The Scalp record is untouched.
export const M30_DEDUPE_AT = Date.parse('2026-11-06T18:03:24Z') / 1000;
export const m30Twin = (x, trades) => (x && x.k === 'm30m1' && trades.find((y) => y !== x && y.market === x.market && y.k !== 'm30m1' && y.side === x.side && y.opened === x.opened && y.entry === x.entry)) || null;

export function voidM30Twins(trades, config, nowISO) {
  const key = 'void-m30m1-twins-2026-11-06';
  config.repairs = config.repairs || []; config.history = config.history || [];
  if (config.repairs.includes(key)) return 0;
  let n = 0, R = 0;
  for (const x of trades) {
    if (x.k !== 'm30m1' || !(x.opened < M30_DEDUPE_AT) || x.dupOf) continue;
    const tw = m30Twin(x, trades); if (!tw) continue;
    x.dupOf = tw.id; x.void = true; x.voidWhy = `m30m1 copy of the Scalp ${tw.id} (same market, side, minute and entry), recorded before the 6 Nov dedupe`;
    if (['win', 'loss', 'be'].includes(x.status)) R += +x.R || 0;
    x.status = 'duplicate'; n++;
  }
  config.repairs.push(key);
  config.history.push({ at: nowISO, by: 'repair', change: `Shadow: ${n} m30m1 trades of 4-6 Nov marked duplicate (copies of a Scalp entry, ${R >= 0 ? '+' : '−'}${Math.abs(R).toFixed(2)}R gross); no stat counts them`,
    why: 'm30m1 fires on the same M1 entry as the Scalp. The Trader drops the copy since 6 Nov 18:03 UTC (#259); the copies recorded before that still counted the same trade twice in the shadow book and in the m30m1 rules.' });
  return n;
}

// 12 Nov 2026 (owner approved: "count duplicates once"): records that are EXACT duplicates (council/dedupe.mjs: same market,
// side, second, entry, stop and target; on 1-12 Nov five Scalp records that copy an Intraday order) are marked, never deleted:
// status 'duplicate', `dupOf`, `void`, `voidWhy`, as voidM30Twins does. R is kept for the record; a duplicate still open or
// pending is closed at the repair's time (it is no longer managed: its twin carries the order). The live one of a pair is kept.
// Records with the same entry and stop but another target are distinct trades and are never touched here.
export const EXACT_TWINS_KEY = 'void-exact-twins-2026-11-12';
export function voidExactTwins(trades, config, nowISO) {
  config.repairs = config.repairs || []; config.history = config.history || [];
  if (config.repairs.includes(EXACT_TWINS_KEY)) return 0;
  const now = Math.floor(Date.parse(nowISO) / 1000);
  let n = 0, R = 0, live = 0; const ks = {};
  for (const { dup, keep } of findDuplicates(trades)) {
    const was = dup.status;
    markDuplicate(dup, keep, `the same order as ${keep.id} (same market, side, second, entry, stop and target) under the ${keep.k} setup; recorded once since 12 Nov 2026`);
    if (was === 'open' || was === 'pending') dup.closed = now;
    if (['win', 'loss', 'be'].includes(was)) R += +dup.R || 0;
    if (!dup.shadow) live++;
    const pk = `${dup.k} of ${keep.k}`; ks[pk] = (ks[pk] || 0) + 1; n++;
  }
  config.repairs.push(EXACT_TWINS_KEY);
  config.history.push({ at: nowISO, by: 'repair', change: `Trades: ${n} exact duplicate record${n === 1 ? '' : 's'} marked duplicate (${Object.entries(ks).map(([k, c]) => `${c} ${k}`).join(', ') || 'none found'}; ${live} live; ${R >= 0 ? '+' : '−'}${Math.abs(R).toFixed(2)}R gross counted twice); no stat counts them`,
    why: 'Two setups produced the same order (same market, side, second, entry, stop and target) and it was recorded and counted twice. Owner, 12 Nov 2026: count duplicates once. The Trader records such an order once from now on.' });
  return n;
}

// 7 Nov (owner decision, #568): crypto paper trades pay the CFD round trip (0.04% of price), not Kraken spot fees. Trades closed
// before that keep a Kraken-sized costR (0.8%+ of price: 1.6R and more on a 0.5% stop), so the shadow book, the week report and
// the scoreboard still showed the old venue. The repair clears costR / Rnet / costSrc on closed crypto trades once; the Trader's
// annotateCosts (same round) recomputes them under the CFD model. R (gross) is untouched; nothing is added or removed.
export const RECOST_KEY = 'recost-crypto-cfd-2026-11-07';
export function recostCrypto(trades, markets, config, nowISO) {
  config.repairs = config.repairs || []; config.history = config.history || [];
  if (config.repairs.includes(RECOST_KEY)) return 0;
  let n = 0, was = 0;
  for (const x of trades) {
    const M = markets[x.market]; if (!M || M.group !== 'Crypto' || x.costR == null) continue;
    was += +x.costR || 0; delete x.costR; delete x.Rnet; delete x.costSrc; n++;
  }
  config.repairs.push(RECOST_KEY);
  config.history.push({ at: nowISO, by: 'repair', change: `Costs: ${n} closed crypto paper trades re-costed under the CFD model (0.04% a round trip); they had carried ${was.toFixed(1)}R of Kraken spot fees in total. Gross R unchanged.`,
    why: 'Owner decision 7 Nov: the council trades through cTrader (CFD), so Kraken spot fees were the wrong venue (research/edge/shadow-audit: 300R of a −288R paper week).' });
  return n;
}
