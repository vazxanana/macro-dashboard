// Mosha cycle (11 Nov 2026, owner: "H4 move, H1 ChoCh tells pullback or retracement started, M15 / M5 to entry and target H4 or
// H1, but since we know the H4 we can target it; H4 tells retracement of daily, M15 retracement of H1, M5 of M15"; "the ai should
// trade with the bot", as a main system). Pure: the Trader hands in the BO events it already builds (council/engine.mjs
// msAnalyze, closed candles only) and the H1 candles; this returns the trades the cycle calls for right now. Nothing here fetches.
//
//   H4 move    = the last H4 BO (dir d): its origin edge `far` (where the move started), the broken level `origin`.
//   pullback   = the first H1 BO the other way after it (the H1 ChoCh): the retracement of the H4 move has started.
//   ext        = the H4 move's extreme, from the H4 break to the H1 ChoCh (H1 candles).
//   leg 'pull' = the first M15 or M5 BO WITH the pullback after the H1 ChoCh: trade the retracement, target the H4 50% (between
//                `far` and `ext`), the pullback's own target.
//   leg 'main' = after that, the first M15 or M5 structure flip (ChoCh) back WITH the H4: the pullback is over, trade with the H4,
//                target the H4 extreme `ext` ("since we know the H4 we can target it").
// A target nearer than MIN_R (1R) is not a main-system trade: the Trader records it as a shadow ('room').
// Entry: a limit at the broken M15 / M5 level (the zone of the break), stop BUF past that break's origin, valid 24 h, out after
// 72 h. Every trade has a stop on the losing side of its entry (absolute rule 1): a signal without one is never returned.
import { ownStream } from './fills.mjs';

export const BUF = 0.3, MIN_R = 1, FRESH = 3600, MIN_RISK = 0.5;

const first = (E, f) => { for (const e of E || []) if (f(e)) return e; return null; };
const r2 = (v) => +(+v).toFixed(2);

// where the cycle stands (status for the site and the tests), and the H4 numbers the targets come from
export function cycleState(E4 = [], E1 = [], h1 = []) {
  const e4 = E4.length ? E4[E4.length - 1] : null;
  if (!e4) return { stage: 'none' };
  const d = e4.dir, far = d < 0 ? e4.top : e4.bot, ch = first(E1, (e) => e.t > e4.t && e.dir === -d);
  // the move's extreme: H1 candles from the H4 break candle to the H1 ChoCh (or to now while the move runs)
  let ext = null; const until = ch ? ch.t : Infinity;
  for (const b of h1) { if (b.time + 3600 <= e4.t - 14400 || b.time >= until) continue; const p = d < 0 ? b.low : b.high; if (ext == null || (d < 0 ? p < ext : p > ext)) ext = p; }
  const base = { dir: d, h4: { t: e4.t, level: r2(e4.level), far: r2(far) }, ext: ext == null ? null : r2(ext), p50: ext == null ? null : r2((far + ext) / 2) };
  if (!ch) return { stage: 'move', ...base };
  return { stage: 'pullback', ...base, choch: { t: ch.t, level: r2(ch.level) } };
}

// the lower-timeframe events after t, M15 and M5 merged in time order, each marked with its timeframe
const lower = (E15, E5, t) => [...(E15 || []).map((e) => ({ ...e, tf: '15m' })), ...(E5 || []).map((e) => ({ ...e, tf: '5m' }))].filter((e) => e.t > t).sort((a, b) => a.t - b.t || (a.tf === '15m' ? -1 : 1));

function order(e, side, target, leg, st, now) {
  const s = side < 0 ? -1 : 1, entry = r2(e.level), stop = r2(s < 0 ? e.top + BUF : e.bot - BUF), r0 = Math.abs(entry - stop);
  if (!(r0 >= MIN_RISK) || !(s < 0 ? stop > entry : stop < entry)) return null;   // no stop on the losing side, no trade
  const room = target == null ? 0 : (target - entry) * s / r0;
  return { leg, tf: e.tf, t: e.t, side: s < 0 ? 'sell' : 'buy', entry, stop, r0: r2(r0), t1: target == null ? null : r2(target), rr: +room.toFixed(2),
    room: room >= MIN_R, fresh: now - e.t <= FRESH, h4: st.h4, choch: st.choch, ext: st.ext, p50: st.p50 };
}

// the cycle's trades: at most one 'pull' and one 'main' per H4 move (each keyed by the H4 break and the H1 ChoCh)
export function cycleTrades({ E4, E1, E15, E5, h1 }, now) {
  const st = cycleState(E4, E1, h1);
  if (st.stage !== 'pullback' || st.ext == null) return { state: st, trades: [] };
  const d = st.dir, L = lower(E15, E5, st.choch.t), out = [];
  const ep = L.find((e) => e.dir === -d);
  if (ep) { const o = order(ep, -d, st.p50, 'pull', st, now); if (o) out.push(o); }
  const em = ep && L.find((e) => e.t > ep.t && e.dir === d && e.flip);
  if (em) { const o = order(em, d, st.ext, 'main', st, now); if (o) out.push(o); }
  return { state: { ...st, stage: em ? 'resumed' : st.stage }, trades: out };
}

// why a new cycle signal is recorded as a shadow (12 Nov 2026): 'room' (target under 1R), 'cap' (the leg already has an open or
// pending trade of the system's OWN stream, fills.mjs ownStream: live, or owner-shadow while the owner keeps it on paper), 'price'
// (price already past the stop), 'owner-shadow' (config.ownerShadow.mcycle: every new trade is a paper shadow, as the other
// owner-shadowable systems; a trade already open stays live to its own exit). An empty list = a live main-system trade.
export function cycleBlockers(o, trades, price, ownerShadow = false) {
  const d = o.side === 'sell' ? -1 : 1;
  const busy = (trades || []).some((x) => x.k === 'mcycle' && x.leg === o.leg && ownStream(x) && (x.status === 'open' || x.status === 'pending'));
  return [!o.room && 'room', busy && 'cap', !(d < 0 ? price < o.stop : price > o.stop) && 'price', !!ownerShadow && 'owner-shadow'].filter(Boolean);
}

// one line for the site
export function cycleText(st) {
  const side = (v) => (v < 0 ? 'down' : 'up');
  if (!st || st.stage === 'none') return 'Mosha cycle: waiting for an H4 move.';
  if (st.stage === 'move') return `Mosha cycle: H4 moving ${side(st.dir)} from ${st.h4.level}; waiting for the H1 ChoCh that starts the pullback.`;
  if (st.stage === 'pullback') return `Mosha cycle: H1 ChoCh at ${st.choch.level}, the H4 move ${side(st.dir)} is pulling back (target 50% ${st.p50}); M15 / M5 trade the pullback, then the ChoCh back with H4 (target ${st.ext}).`;
  return `Mosha cycle: the pullback is over, M15 / M5 broke back ${side(st.dir)}; target the H4 extreme ${st.ext}.`;
}
