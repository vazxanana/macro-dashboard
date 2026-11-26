// The Mosha method, replayed on the last two weeks (20 Nov 2026, owner: "try to replicate the last 2 weeks", "show the trades
// like the council and logs"). The desk's own reading of the method's two entries, walked over past gold candles one closed
// candle at a time (nothing after a candle is read to decide it), listed like the council's trades with a log per trade:
//   1. the sequence: a BO on one timeframe, the VR (the first break against it one timeframe lower), the CF (the break back
//      with the BO), the pullback into the CF zone, an EG, stop past the pullback's extreme, target the VR's extreme;
//   2. the barrier entry: a fresh D1, H4, H1 or M15 barrier, price comes to it, the CF is a QM (BO Structure) with the barrier
//      on the method's own confirmation timeframe (D1 on H1, H4 on M15, H1 on M5, M15 on M1), entry on the pullback to the
//      level that CF broke, stop past the extreme made at the barrier; the target (1R since 22 Nov 2026, the owner's choice; 3R before) is the replay's own.
// In the sequence the VR and the CF must each be a BO Structure (a QM), never a continuation break (21 Nov 2026).
// The owner's four readings (21 Nov 2026, after comparing the desk with his own example trades), each recorded under its own label:
//   - the VR box runs from the extreme to the NEAREST internal swing before it (msMosha o.near; on by default here, o.near: false
//     reads the protected swing as before); the CF and its cases read that box;
//   - entry AT THE ZONE: besides the limit at the level the QM broke, a second limit at the barrier zone's near side (the bottom
//     of a supply zone, the top of a demand zone), placed only when the QM's candle closed outside the zone ("· at the zone");
//   - M5 CONFIRM: H4 and M15 barriers are also confirmed on M5 (the table's own timeframe for H1), "· M5 confirm";
//   - SWEEP barrier: a swing high (low) of 3 candles a side that a later candle trades beyond and then CLOSES back at or below
//     (at or above) it; the zone runs from the swing to the sweep's wick, the confirmation is read once that candle has closed;
//     a close beyond the swing is a break, not a sweep. SECOND VISIT: a zone taken again after price left it (a closed candle of
//     the barrier's timeframe wholly outside it, on the side price came from) and came back, before it was broken: one entry per
//     visit, labelled "· second visit" (visit 3 and later "· visit n").
// The method's pages applied to the detail (21 Nov 2026, owner: "build"; each has an option that reads it the older way):
//   - the VR, the CF and the QM at a barrier are breaks of the chart's SMALL swings (3 candles a side): a QM is the close through
//     the last swing BEFORE the extreme (the swing the last leg came from), as the pages draw it, never a pivot formed after
//     the extreme (o.vr: 'major' reads the 6-a-side protected swing as before; o.qm: 'internal' the barrier QM as before);
//   - a barrier's BOX runs from the swing level the break took to the origin extreme of the leg (o.box: 'candle' = the last
//     opposite candle at the origin, the charts' own zone);
//   - the JANDA's limit rests at the engulf zone (the engulfed candle and the candle that engulfs it) inside the second BO's
//     leg (o.janda: 'level' = at the level that BO broke);
//   - the second confirmation table: H4 on M30, H1 on M15, M30 barriers on M5 (M15 on M5 was already read: "· M5 confirm");
//   - REPEAT THE SOP: after the QM at a barrier, a VR and its CF one timeframe lower are a confirmation of their own
//     (id "bar-sop-", label "· repeat SOP"; o.rsop: false leaves it out). At the sequence's own CF zone the repeat is the
//     other page's: after the CF with NO QM first, a VR and then a CF one timeframe lower whose zone sits inside the parent
//     CF zone (id "bar-sop-cf-", flag nested).
// Review of 21 Nov 2026: one order (same market, side, fill, entry and stop) is recorded once (uniq, with its fixed priority);
// an entry at a close whose next candle opens beyond the stop books that gap (outcome); a sequence whose CF sits inside the VR
// is recorded as its own reading ("sop-c2-", case2) instead of being skipped; every sequence record carries two tags that
// change no trade (withWeekly, er20: dayTags).
// DISPLAY ONLY. A replay on past candles: no order, no stored trade, no council file, nothing sent anywhere. It is not
// Luxus's record and not a tested rule; the mechanical Mosha studies failed (CLAUDE.md "Mosha level reversal study").
(function (root) {
  'use strict';
  var SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '30m': 1800, '15m': 900, '5m': 300, '1m': 60 };
  var NAME = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '30m': 'M30', '15m': 'M15', '5m': 'M5', '1m': 'M1' };
  // scalp / intraday / swing (owner, 22 Nov 2026: "Yrs" to the engulfing table's tag): by the trade's TOP timeframe, the BO's for a
  // sequence (the main BO's for a SOP inside the SOP) and the barrier's for a barrier; D1 swing, H4 intraday, H1 and lower scalp,
  // the same split as the Engulfing desk's three chains. A label only: read from h / up, nothing stored, no rule reads it.
  var styleOf = function (r) { var t = (r && (r.up || r.h)) || ''; return t === '1d' ? 'swing' : t === '4h' ? 'intraday' : t ? 'scalp' : ''; };
  var LADDER = [['1d', '4h'], ['4h', '1h'], ['1h', '30m'], ['30m', '15m'], ['15m', '5m']];   // the VR forms exactly one timeframe lower
  var BACK = { '1d': 1500, '4h': 260, '1h': 90, '30m': 60, '15m': 40, '5m': 24, '1m': 16 };  // days of candles each timeframe needs
  // BARRIER_R: 3 until 22 Nov 2026. Owner ("keep the best rr for each individual one"): a 1R target did best on the barrier
  // entries' own closed 2026 records (1R-4R, each replayed alone on 5-minute candles, before costs). Picked in sample, not a tested result.
  var DAYS = 14, PIVOT = 6, WIN = 1500, BUF = 0.3, BARRIER_R = 1, MIN_JUDGE = 20;
  // the barrier entry's confirmation timeframe (21 Nov 2026, the method's own table: D1 on H1, H4 on M15, H1 on M5, M15 on M1);
  // the CF is watched for BARRIER_WATCH confirmation candles from the first touch and its pullback for BARRIER_FILL more
  var BARRIER = [['1d', '1h'], ['4h', '15m'], ['1h', '5m'], ['15m', '1m']], BARRIER_WATCH = 60, BARRIER_FILL = 12, CF_LIMIT = 24;   // CF_LIMIT: candles of the CF timeframe a limit at the CF line rests (the desk's choice)
  // the second table (21 Nov 2026): an H4 barrier is also confirmed on M30 and an H1 barrier on M15 (ALT2), an M30 barrier on M5
  // (BARRIER30); M15 on M5 is M5_ALT below. LOWER = one step down the ladder, for the repeat of the SOP at a barrier.
  var ALT2 = { '4h': '30m', '1h': '15m' }, BARRIER30 = [['30m', '5m']], DOWN = { '4h': '1h', '1h': '30m', '30m': '15m', '15m': '5m' }, LOWER = { '1h': '30m', '30m': '15m', '15m': '5m', '5m': '1m' };
  // the method's own timeframe table for the sequence (owner, 22 Nov 2026): the CF is read ONE TIMEFRAME LOWER than the VR
  // (BO → VR → CF: D1 → H4 → H1, H4 → H1 → M15, H1 → M30 → M15, M30 → M15 → M5, M15 → M5 → M1; M1 stays M1). CFTF: the VR's timeframe → the CF's.
  // Owner, 22 Nov 2026, later: "one of them is h4 h1 m15 (not m30)": under an H1 VR the CF is read on M15.
  var CFTF = { '4h': '1h', '1h': '15m', '30m': '15m', '15m': '5m', '5m': '1m', '1m': '1m' };
  var JANDA_ALT = { '4h': '1m', '1h': '1m' };   // the Janda's own table: H4 on M15 or M1, H1 on M5 or M1 (the simple CF keeps the one timeframe)
  // 22 Nov 2026 (owner: "H1 barrier → M1 BO at the tap ... m1 is only entry to confirm the trade, h1 barrier we need m15 bo
  // pullback then m1 bo entry"): at an H1 barrier the tap entry first needs an M15 BO Structure with the barrier; then price
  // pulls back and the first M1 BO Structure with the barrier whose leg starts after the M15 BO is the entry.
  var TAP_FIRST = { '1h': '15m' };
  var f2 = function (v) { return (+v).toFixed(2); };
  // More markets (21 Nov 2026, owner: "more trades"): the SAME reading on other markets, no new entry rule. The gold sizes
  // (stop buffer, smallest and largest risk, smallest barrier) were written in dollars near REF; another market takes the
  // same share of its own price. Gold keeps its dollar figures exactly.
  var MARKETS = { xau: { name: 'Gold', dec: 2 }, xag: { name: 'Silver', dec: 3 }, eurusd: { name: 'EUR/USD', dec: 5 }, gbpusd: { name: 'GBP/USD', dec: 5 }, nas100: { name: 'Nasdaq 100', dec: 1 } };
  // every market a desk tracker may record (the LIT desk reads more than the Mosha five); MARKETS stays the Mosha tracker's list
  // the Mosha desk's own markets (owner, 21 Nov 2026: "mosha keep gold and eurusd and gbpusd"); MARKETS stays the Engulfing desk's five
  var MOSHA = ['xau'];   // owner, 22 Nov 2026: "mosha drop GU keep only gold" (EUR/USD and GBP/USD leave the Mosha desk)
  var ALL = { xau: MARKETS.xau, xag: MARKETS.xag, eurusd: MARKETS.eurusd, gbpusd: MARKETS.gbpusd, nas100: MARKETS.nas100, usdjpy: { name: 'USD/JPY', dec: 3 }, audusd: { name: 'AUD/USD', dec: 5 }, usdcad: { name: 'USD/CAD', dec: 5 },
    spx500: { name: 'S&P 500', dec: 1 }, us30: { name: 'Dow 30', dec: 1 }, de40: { name: 'DAX 40', dec: 1 },
    // three more markets for the desks of the seven studies that passed (23 Nov 2026); the LIT and MSNR desks keep their eleven (ELEVEN in the tracker)
    nzdusd: { name: 'NZD/USD', dec: 5 }, usdchf: { name: 'USD/CHF', dec: 5 }, eurjpy: { name: 'EUR/JPY', dec: 3 },
    gbpjpy: { name: 'GBP/JPY', dec: 3 }, audjpy: { name: 'AUD/JPY', dec: 3 }, cadjpy: { name: 'CAD/JPY', dec: 3 }, eurgbp: { name: 'EUR/GBP', dec: 5 }, euraud: { name: 'EUR/AUD', dec: 5 } };
  var REF = 4000, mkOf = function (k) { return ALL[k] ? k : 'xau'; };
  var sizes = function (k, px) { var q = mkOf(k) === 'xau' ? 1 : px / REF; return { buf: BUF * q, rmin: 0.8 * q, rmax: 25 * q, zmin: 0.5 * q }; };
  var fmt = function (k) { var d = ALL[mkOf(k)].dec; return function (v) { return (+v).toFixed(d); }; };
  var unit = function (k) { return mkOf(k) === 'xau' ? '$' : ''; };
  var utc = function (s) { return s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'; };
  var word = function (d) { return d > 0 ? 'buy' : 'sell'; };

  // The chart's small-swing breaks (3 candles a side). A BO Structure (QM) is the close through the swing the LAST leg to the
  // extreme came from: that level moves only when a new extreme is made (a continuation break), never to a pivot that forms
  // after the extreme (a dip and a lower high under a top do not give a new level; the pages draw the VR from the extreme to
  // the last swing BEFORE it, and that swing is the one broken). This is the page's protected-swing reading (msAnalyze) at 3 a
  // side; only what an event carries at its own candle is read (level, swing, break, structure), never what msAnalyze adds later.
  // The box of a break: from the level it took to the extreme behind it (for a QM, the extreme of the move it ends: the
  // highest high or lowest low since the break before it). An event at candle i reads candles up to i only.
  function swingEv(F, W) {
    var ev = F.msAnalyze(W, 3).events, out = [];
    for (var k = 0; k < ev.length; k++) { var e = ev[k], a = e.structure && k ? Math.min(e.fromIdx, ev[k - 1].breakIdx) : e.fromIdx, lo = Infinity, hi = -Infinity;
      for (var q = a; q <= e.breakIdx; q++) { lo = Math.min(lo, W[q].low); hi = Math.max(hi, W[q].high); }
      out.push({ dir: e.dir, level: e.level, structure: !!e.structure, fromIdx: e.fromIdx, breakIdx: e.breakIdx, lo: lo, hi: hi }); }
    return out;
  }
  // the same breaks in the shape msMosha reads
  function smallEv(F, W) {
    return swingEv(F, W).map(function (e) { return { dir: e.dir, level: e.level, structure: e.structure, t: W[e.breakIdx].time, fromT: W[e.fromIdx].time, top: e.dir > 0 ? e.level : e.hi, bot: e.dir > 0 ? e.lo : e.level }; });
  }
  // M30 candles from M15 ones, where a caller hands none: only whole half hours (both quarters closed)
  function m30of(A) {
    var out = []; (A || []).forEach(function (b) { var t = b.time - (b.time % 1800), q = out[out.length - 1];
      if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; q.n++; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, n: 1 }); });
    var last = A && A.length ? A[A.length - 1].time + 900 : 0;
    return out.filter(function (b) { return b.time + 1800 <= last; }).map(function (b) { return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; });
  }
  // where a trade ended on the finest candles: the stop first when one candle holds both. `after` is the fill candle of a
  // limit (that candle can only stop it, at the stop) or, for an entry at a close, the open time of the NEXT candle: if that
  // candle already opens beyond the stop the trade exits at its open, worse than −1R, as a later candle does for a limit
  // (until 21 Nov 2026 a market entry's first candle booked exactly −1R whatever its open).
  function outcome(tr, bars, after, limit) {
    var d = tr.side, r0 = Math.abs(tr.entry - tr.stop), o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 };
    if (!(r0 > 0)) return o;
    for (var i = 0; i < bars.length; i++) { var b = bars[i]; if (b.time < after) continue;
      if (d > 0 ? b.low <= tr.stop : b.high >= tr.stop) { var px = (b.time > after || !limit) && (d > 0 ? b.open < tr.stop : b.open > tr.stop) ? b.open : tr.stop;   // a candle that opens beyond the stop exits at its open
        o.status = 'stopped'; o.R = (d > 0 ? px - tr.entry : tr.entry - px) / r0; o.endT = b.time; o.exit = px; return o; }
      if (limit && b.time === after) continue;   // a limit fills inside its candle: only the stop counts on that candle, never the target or the best-so-far
      if (d > 0 ? b.high >= tr.target : b.low <= tr.target) { o.status = 'target'; o.R = Math.abs(tr.target - tr.entry) / r0; o.endT = b.time; o.exit = tr.target; return o; }
      o.mfe = Math.max(o.mfe, (d > 0 ? b.high - tr.entry : tr.entry - b.low) / r0); }
    if (bars.length) { var c = bars[bars.length - 1].close; o.float = (d > 0 ? c - tr.entry : tr.entry - c) / r0; }
    return o;
  }

  // ONE ORDER, RECORDED ONCE (21 Nov 2026, independent review). Two readings can end in the very same order: the same market,
  // side, fill time, entry and stop. It is recorded once, under the first id by this fixed priority:
  //   1. a sequence record (kind 'sop') before a barrier record (so the sequence before the repeat of the SOP at a barrier);
  //   2. the major-BO sequence before the internal-BO one ("sop-" before "sop-i-");
  //   3. the higher upper timeframe before the lower (the M30 → M15 VR retest before the M15 → M5 one);
  //   4. else the order the rows came in.
  // A CF-inside-the-VR record ("sop-c2-") is its own reading: compared only with its own kind. So is the limit at the CF line ("sop-l-").
  // A SOP inside the SOP ("sop-nv-", "sop-nc-", 22 Nov 2026) comes last of all: when it is the very order another reading
  // already gave, the other record is kept.
  function orderKey(r) { return [mkOf(r.market), r.case2 ? 'c2' : r.cfLimit ? 'lim' : '', r.side, r.t, (+r.entry).toPrecision(10), (+r.stop).toPrecision(10)].join('|'); }
  // The structure each reading uses (22 Nov 2026, owner: "keep the good ones and replace the bad ones"). The owner's own marks
  // count a new high / low of a running move once ONE candle has closed after it (msAnalyze's third argument); the desk read it
  // after six. Both were run on the last 60 days of gold, EUR/USD and GBP/USD: the one-candle structure is kept where it did
  // better (the CF limit, the CF inside the VR, the VR retest, the SOP inside the CF, the barrier with its 3R target, the M1 BO
  // at the tap, the repeat of the SOP) and the six-candle one where it did worse (the EG entry, the SOP inside the VR, the
  // barrier with its 1R target). Picked on those 60 days, before costs: a choice, not a tested result.
  var ONE_N = 1;
  function oneCandle(F) { var o = {}; for (var k in F) o[k] = F[k]; o.msAnalyze = function (b, N) { return F.msAnalyze(b, N, ONE_N); }; return o; }
  function sixCandle(r) { var id = String(r.id || '').replace(/^[a-z0-9]+:/, '');
    if (/^sop-nv-/.test(id)) return true; if (/^sop-(l|c2|vr|vc|nc)-/.test(id)) return false; if (/^sop-/.test(id)) return true;
    return /^bar-/.test(id) && !/^bar-(old|r6|tap|sop)-/.test(id); }
  function deskTrades(B, F, o) {
    o = o || {}; var F1 = oneCandle(F), c6 = [], c1 = [], base = { from: o.from, market: o.market, tapFirst: o.tapFirst };
    var w = function (x) { var r = {}; for (var k in base) if (base[k] !== undefined) r[k] = base[k]; for (var k2 in x) r[k2] = x[k2]; return r; };
    // through API so a caller (the tracker's tests) can swap a reading in
    var s6 = API.sopTrades(B, F, w({ cfOut: c6 })).filter(sixCandle), s1 = API.sopTrades(B, F1, w({ cfOut: c1 })).filter(function (r) { return !sixCandle(r); });
    var b6 = API.barrierTrades(B, F, w({ extra: c6 })).filter(sixCandle), b1 = API.barrierTrades(B, F1, w({ extra: c1 })).filter(function (r) { return !sixCandle(r); });
    var tag = function (rows, n) { rows.forEach(function (r) { r.structN = n; }); return rows; };
    return uniq(tag(s6, 6).concat(tag(s1, ONE_N), tag(b6, 6), tag(b1, ONE_N))).concat(tag(API.oldBarrierTrades(B, F1, w({ extra: c1 })), ONE_N), tag(API.r6BarrierTrades(B, F1, w({ extra: c1 })), ONE_N));
  }
  function uniq(rows) {
    var idx = rows.map(function (r, i) { return i; }), rk = function (r) { return (r.kind === 'sop' ? 0 : 4e9) + (r.ibo ? 2e9 : 0) + (r.nest ? 8e9 : 0) + (1e6 - (SEC[r.h] || 0)); }, seen = {}, keep = {};
    idx.sort(function (a, b) { return rk(rows[a]) - rk(rows[b]) || a - b; });
    idx.forEach(function (i) { var k = orderKey(rows[i]); if (!seen[k]) { seen[k] = 1; keep[i] = 1; } });
    return rows.filter(function (r, i) { return keep[i]; });
  }
  // Two tags on every sequence record that change NO trade (21 Nov 2026), both from the Daily candles CLOSED by the entry
  // (time + 1 day <= the entry), weekend-dated candles left out (a Sunday stub is not a trading day):
  //   withWeekly: the last completed week (Monday to Friday, UTC days, a week before the entry's own) closed above the week
  //     before it = the weekly direction is up, below = down; true when the trade's side agrees, false when not, null when
  //     two completed weeks are not on file or the two closes are equal;
  //   er20: the 20-day efficiency ratio of the Daily closes, |close now − close 20 days back| / the sum of the 20 daily
  //     |changes|, 2 decimals; null under 21 closed days.
  function dayTags(D1, t, side) {
    var C = [], i; for (i = 0; i < (D1 || []).length; i++) { var b = D1[i]; if (b.time + SEC['1d'] > t) break; var wd = new Date(b.time * 1000).getUTCDay(); if (wd !== 0 && wd !== 6) C.push(b); }
    var n = C.length, er = null;
    if (n >= 21) { var path = 0; for (i = n - 20; i < n; i++) path += Math.abs(C[i].close - C[i - 1].close); er = path > 0 ? +(Math.abs(C[n - 1].close - C[n - 21].close) / path).toFixed(2) : null; }
    var wk = function (ts) { return Math.floor((Math.floor(ts / 86400) + 3) / 7); }, cur = wk(t), lw = null, lc = null, pc = null;
    for (i = n - 1; i >= 0; i--) { var w = wk(C[i].time); if (w >= cur) continue; if (lw == null) { lw = w; lc = C[i].close; continue; } if (w < lw) { pc = C[i].close; break; } }
    return { withWeekly: pc == null || lc === pc ? null : (lc > pc) === (side > 0), er20: er };
  }

  // 1. the sequence, every step of the ladder. B = { tf: closed candles, oldest first }, F = the page's own functions.
  // The pages enter internal breaks the same way as external ones ("BO, VR, CF" for both, 21 Nov 2026): with o.ibo !== false a
  // newer internal BO (msInternal, 3 a side) of the upper timeframe than its last major BO starts its own sequence, recorded
  // apart (id "sop-i-", label "… iBO → …").
  // WHERE THE CF MAY FORM (22 Nov 2026, owner: "Both", on the method's own drawing: BO, the VR at the extreme, price comes back
  // near where the BO broke, the CF forms there): a CF counts only once price, after the VR, has traded back to the level the BO
  // broke (a buy BO: a low at or below it), on closed candles up to the CF's own candle. An earlier break with the BO is not a
  // CF (it is handed to msMosha as a continuation break, so a close past the VR's extreme still ends the move); a later one,
  // after price got back there, is. E = the chart's breaks, W its candles, d and level the BO's, t0 its time. o.cfBack false =
  // as before.
  function backEv(E, W, d, level, t0) {
    var V = null, i; for (i = 0; i < E.length; i++) { var e = E[i]; if (e.t > t0 && e.dir === -d && e.structure !== false) { V = e; break; } }
    if (!V) return { ev: E, backT: null };
    var backT = null; for (i = 0; i < W.length; i++) { var b = W[i]; if (b.time > V.t && (d > 0 ? b.low <= level : b.high >= level)) { backT = b.time; break; } }
    return { backT: backT, ev: E.map(function (x) { return x.dir === d && x.t > V.t && x.structure !== false && !(backT != null && backT <= x.t) ? { dir: x.dir, level: x.level, structure: false, t: x.t, fromT: x.fromT, top: x.top, bot: x.bot } : x; }) };
  }
  var notCf = function (x) { return { dir: x.dir, level: x.level, structure: false, t: x.t, fromT: x.fromT, top: x.top, bot: x.bot }; };
  // A SECOND ENTRY, A LIMIT AT THE CF LINE (same day, "Both"): beside the EG entry, a plain limit at the level the CF's break took
  // ("sop-l-", cfLimit: true), known when the CF candle closes. It rests until price reaches the VR's extreme (the move is done),
  // a candle of the CF timeframe closes through the CF zone's far side (the CF failed) or CF_LIMIT such candles pass. Stop: past
  // the CF zone's far side by the buffer; target the VR's extreme. The fill is the first finer candle that reaches the line; that
  // candle can only stop the trade. Not for a CF inside the VR. Only where the CF is read on its own timeframe (not with
  // cf 'same'). o.cfLimit false leaves it out.
  // A SOP INSIDE THE SOP (22 Nov 2026, owner: "you need to repeat sop inside sop"): the VR and the CF of the sequence are each
  // read as a BO one timeframe lower (H4 → H1, H1 → M30, M30 → M15, M15 → M5, M5 → M1), and a whole BO, VR, CF is waited for there:
  //   the VR leg ("sop-nv-", nest 'vr'): the VR's break is against BO1, so its sequence SELLS under a bullish BO1 and BUYS under
  //     a bearish one. Read until the main CF forms, or a lower candle closes back beyond the main VR's extreme;
  //   the CF leg ("sop-nc-", nest 'cf'): the CF's break is with BO1, so its sequence trades with BO1. Read until a lower candle
  //     closes through the CF zone's far side. A CF inside the VR (the "likely to fail" case) starts one too, said in its log
  //     (cfIn: true); o.case2 false leaves those out, as it leaves that case out of the main sequence.
  // Both are read for at most BARRIER_WATCH candles of the sequence's own timeframe. Entry, stop and target are the sequence's
  // own (the pullback into the nested CF zone, then an EG; stop past the pullback's extreme; target the nested VR's extreme); a
  // nested CF inside its VR is skipped. The main sequence is unchanged. One record a main sequence and leg. No hindsight: a leg
  // starts at the candle whose close shows its VR (CF), is walked one closed lower candle at a time with the main sequence as it
  // stood at the last closed candle of its timeframe, and the entry is taken only AT the candle whose close is its EG.
  // o.nest false leaves them out.
  function sopTrades(B, F, o) {
    o = o || {}; var at = function (A, t) { var lo = 0, hi = A.length; while (lo < hi) { var m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
    var from = o.from, piv = o.pivot || PIVOT, win = o.win || WIN, fine = B['5m'] || [], map = {}, cfSeen = {}, rt = {}, out = [], mk = mkOf(o.market), f2 = fmt(mk), U = unit(mk), pre = mk === 'xau' ? '' : mk + ':';
    LADDER.forEach(function (p) {
      var h = p[0], l = p[1], H = B[h], L = B[l]; if (!H || !H.length || !L || !L.length) return;
      var hN = -1, HA = null, Hw = null, HI = null, HT = null, n = 0, LE = null, turnT = null, turnAt = {};
      var tfBars = function (tf) { return B[tf] && B[tf].length ? B[tf] : tf === '30m' ? m30of(B['15m']) : []; };
      var low = LOWER[l] || DOWN[l], Lc = o.nest === false || !low ? [] : tfBars(low), legs = [], legAt = {};
      // THE CF ONE TIMEFRAME LOWER (22 Nov 2026, the method's own table, CFTF): the BO on h and the VR on l are read as before
      // (the same VR event, the same box, the same extreme), and the CF, the pullback into its zone, the EG, the stop and the
      // fill are read on the timeframe under l. o.cf 'same' reads the CF on l, as until then; with no candles of that
      // timeframe the CF is read on l too and the log says so. Each sequence with a VR gets a WALKER over the CF timeframe's
      // closed candles: msMosha is handed the VR as its first event and the CF timeframe's small breaks after it; the entry is
      // taken only AT the candle whose close is its EG. The walker reads the candles closed by each closed l candle with the
      // sequence as the l candle before left it (which BO is the last, whether the chart has turned), then the rest.
      var ctf = o.cf === 'same' ? l : (CFTF[l] || l), Cc = ctf === l ? L : tfBars(ctf), cfFall = false;
      if (!Cc.length) { cfFall = ctf !== l; ctf = l; Cc = L; }
      var split = ctf !== l, lowC = LOWER[ctf] || DOWN[ctf] || ctf, LcC = !split || o.nest === false ? [] : lowC === ctf ? Cc : tfBars(lowC), walkers = [], wAt = {};
      function walkAdd(S0, M0, now) {
        var boT = Hw[S0.idx].time, key = (S0.ibo ? 'i|' : '') + boT + '|' + M0.vr.t; if (wAt[key]) return wAt[key];
        var v = M0.vr, k0 = at(Cc, v.t + SEC[l]);
        var w = wAt[key] = { dir: S0.dir, ibo: !!S0.ibo, boT: boT, level: S0.level, far: S0.far, ext: S0.ext, reg: now, k: k0, k0: k0, b0: Math.max(0, at(Cc, boT) - 1), done: false, blocked: false, seen: -1, cfs: {}, lims: [], backT: null, evs: [], ei: 0, EV: null, evEnd: 0,
          vr: { level: v.level, t: v.t, fromT: v.fromT, ext: v.ext, extT: v.extT, lo: v.lo, hi: v.hi, near: !!v.near },
          V: { dir: -S0.dir, level: v.level, structure: true, t: v.t + SEC[l] - SEC[ctf], fromT: v.fromT, top: v.hi, bot: v.lo } };
        walkers.push(w); return w;
      }
      function walkRun(w, T) {
        if (w.done) return; var D = w.dir, tag = w.ibo ? 'iBO' : 'BO', lim = o.until ? Math.min(T, o.until) : T;
        for (; w.k < Cc.length; w.k++) { var c = Cc[w.k], tc = c.time + SEC[ctf]; if (tc > lim) break;
          // the CF timeframe's small breaks, read in blocks from 240 candles before the VR (an event at a candle reads nothing after it)
          if (w.k >= w.evEnd) { var a0 = Math.max(0, w.k0 - 240); w.evEnd = w.k + 400; w.EV = smallEv(F, Cc.slice(a0, w.evEnd)); }
          if (w.backT == null && (D > 0 ? c.low <= w.level : c.high >= w.level)) w.backT = c.time;   // price back at the level the BO broke, after the VR
          while (w.ei < w.EV.length && w.EV[w.ei].t <= c.time) { var e0 = w.EV[w.ei++]; if (e0.t > w.V.t) w.evs.push(o.cfBack !== false && e0.dir === D && e0.structure !== false && w.backT == null ? notCf(e0) : e0); }
          // the limits resting at a CF line: the first finer candle that reaches the line fills; the VR's extreme first, a close
          // through the CF zone's far side or CF_LIMIT candles end the wait
          for (var li = 0; li < w.lims.length; li++) { var p = w.lims[li]; if (p.done) continue;
            var FB = ctf === '1m' ? Cc : fine, fT = null;
            for (var fi = at(FB, c.time); fi < FB.length && FB[fi].time < tc; fi++) { var fb = FB[fi];
              if (D > 0 ? fb.low <= p.entry : fb.high >= p.entry) { fT = fb.time; break; }
              if (D > 0 ? fb.high >= p.target : fb.low <= p.target) { p.done = true; break; } }
            if (fT == null) { if (!p.done && ((D > 0 ? c.close < p.far : c.close > p.far) || ++p.n >= CF_LIMIT)) p.done = true; continue; }
            p.done = true; var lid = pre + 'sop-l-' + (w.ibo ? 'i-' : '') + l + '-' + (D > 0 ? 'b' : 's') + fT;
            if (!(tc >= w.reg) || w.blocked || !(fT + (ctf === '1m' ? 60 : SEC['5m']) >= from) || map[lid]) continue;
            var tl = map[lid] = { id: lid, market: mk, kind: 'sop', h: h, l: l, ll: ctf, side: D, t: fT, known: tc, entry: p.entry, stop: p.stop, target: p.target, r0: Math.abs(p.entry - p.stop), 'case': 1, cfLimit: true, near: !!w.vr.near, again: p.again, deep: p.deep,
              label: NAME[h] + ' ' + tag + ' → ' + NAME[l] + ' VR → ' + NAME[ctf] + ' CF · limit at the CF line' };
            if (w.ibo) tl.ibo = true; if (o.cfBack !== false) tl.back = true;
            tl.log = [
              { t: w.boT + SEC[h], text: NAME[h] + ' ' + tag + ' ' + word(D) + ': a candle closed ' + (D > 0 ? 'above ' : 'below ') + f2(w.level) + '.' },
              { t: w.vr.t + SEC[l], text: NAME[l] + ' VR: the first BO Structure (QM) against the BO. The VR runs ' + f2(w.vr.lo) + ' to ' + f2(w.vr.hi) + '; its extreme ' + f2(w.vr.ext) + ' is the target.' },
              { t: p.known, text: NAME[ctf] + ' CF, one timeframe under the VR\'s: the BO Structure (QM) back with the BO' + (o.cfBack !== false ? ', after price came back to the BO level ' + f2(w.level) : '') + '. The CF zone is ' + f2(p.lo) + ' to ' + f2(p.hi) + ', clear of the VR; a ' + word(D) + ' limit rests at the CF line ' + f2(p.entry) + '.' },
              { t: fT, text: 'Price pulled back to the CF line: the limit filled, ' + word(D) + ' ' + f2(p.entry) + ', stop ' + f2(p.stop) + ' (' + U + f2(Math.abs(p.stop - p.far)) + ' past the CF zone\'s far side ' + f2(p.far) + ', risk ' + U + f2(tl.r0) + '), target ' + f2(p.target) + ' (the VR\'s extreme, ' + (Math.abs(p.target - p.entry) / tl.r0).toFixed(1) + 'R).' }];
            tl.marks = [{ kind: 'level', p: w.level, a: w.boT, at: w.boT + SEC[h], label: NAME[h] + ' ' + tag },
              { kind: D > 0 ? 'vr' : 'bvr', top: w.vr.hi, bot: w.vr.lo, a: w.vr.t, at: w.vr.t + SEC[l], label: NAME[l] + ' VR' },
              { kind: 'zone', top: p.hi, bot: p.lo, a: p.cfT, at: p.known, label: NAME[ctf] + ' CF zone' },
              { kind: 'level', p: p.entry, a: p.cfT, at: p.known, label: 'CF line · entry', under: D < 0 }];
            finish(tl, outcome(tl, FB, fT, true)); out.push(tl); }
          var M = F.msMosha({ dir: D, level: w.level, t: w.boT, ext: w.ext, far: w.far }, { events: [w.V].concat(w.evs), bars: Cc.slice(w.b0, w.k + 1) }, o.buf == null ? sizes(mk, c.close).buf : o.buf, { near: false });
          if (!M || !M.vr) continue;
          // the VR is the l timeframe's own: its box, its extreme and the "CF inside the VR" case are judged against that one
          M.vr = w.vr; if (M.cf) M['case'] = M.cf.hi >= w.vr.lo && M.cf.lo <= w.vr.hi ? 2 : 1;
          var live = tc >= w.reg && !w.blocked;   // a walker first seen late takes nothing from before it was seen; a turned chart gives no entry the old way
          if (M.cf && M.cf.t === c.time && !w.cfs[M.cf.t]) { w.cfs[M.cf.t] = 1;
            var gv = legAt['vr|' + (w.ibo ? 'i|' : '') + w.boT + '|' + w.vr.t]; if (gv && gv.endT === Infinity) gv.endT = tc;   // the SOP inside the VR ends with the CF
            if (live && o.cfOut && M['case'] !== 2 && M.state !== 'cf-failed' && M.state !== 'vr-broken' && !cfSeen[ctf + '|' + M.cf.t + '|' + D]) { cfSeen[ctf + '|' + M.cf.t + '|' + D] = 1;
              var of = NAME[h] + (w.ibo ? ' iBO' : ' BO');
              o.cfOut.push({ tf: ctf, dir: D, lo: M.cf.lo, hi: M.cf.hi, kind: 'cf', known: tc, of: of, tgt: w.vr.ext });
              o.cfOut.push({ tf: l, dir: -D, lo: w.vr.lo, hi: w.vr.hi, kind: 'vr', known: tc, of: of, tgt: D > 0 ? M.cf.hi : M.cf.lo }); }
            if (live && o.cfLimit !== false && M['case'] !== 2 && M.state !== 'cf-failed' && M.state !== 'vr-broken') { var Zl = sizes(mk, M.cf.level), bl = o.buf == null ? Zl.buf : o.buf, farL = D > 0 ? M.cf.lo : M.cf.hi, stL = D > 0 ? farL - bl : farL + bl, rl = Math.abs(M.cf.level - stL);
              if (rl > Zl.rmin && rl <= Zl.rmax && (D > 0 ? stL < M.cf.level && w.vr.ext > M.cf.level : stL > M.cf.level && w.vr.ext < M.cf.level))
                w.lims.push({ cfT: M.cf.t, known: tc, entry: M.cf.level, far: farL, stop: stL, target: w.vr.ext, lo: M.cf.lo, hi: M.cf.hi, n: 0, done: false, again: !!M.cf.again, deep: M.deep == null ? null : !!M.deep }); }
            if (live && LcC.length && !(M['case'] === 2 && o.case2 === false)) nestAdd('cf', w, w.vr, { t: M.cf.t, level: M.cf.level, lo: M.cf.lo, hi: M.cf.hi, c2: M['case'] === 2 }, tc, ctf, lowC, LcC); }
          if (M.state === 'bo-on' || M.state === 'vr-broken') { w.done = true; return; }   // the move is done: nothing more comes of this VR
          if (!live || !M.trade || M.trade.fillT !== c.time || !(tc >= from)) continue;
          if (M['case'] === 2 && o.case2 === false) continue;
          var c2 = M['case'] === 2 && o.case2 !== true, k = (c2 ? 'c2|' : '') + (w.ibo ? 'i|' : '') + h + '|' + w.boT + '|' + M.trade.fillT; if (map[k]) continue;
          var tr = map[k] = { id: pre + (c2 ? 'sop-c2-' : 'sop-') + (w.ibo ? 'i-' : '') + l + '-' + M.trade.fillT, market: mk, kind: 'sop', h: h, l: l, ll: ctf, side: M.trade.side, t: tc, entry: M.trade.entry, stop: M.trade.stop, target: M.trade.target,
            r0: Math.abs(M.trade.entry - M.trade.stop), 'case': M['case'], near: !!w.vr.near, again: !!M.cf.again, deep: M.deep == null ? null : !!M.deep,
            label: NAME[h] + ' ' + tag + ' → ' + NAME[l] + ' VR → ' + NAME[ctf] + ' CF' + (c2 ? ' · CF inside the VR' : '') };
          if (w.ibo) tr.ibo = true; if (c2) tr.case2 = true; if (o.cfBack !== false) tr.back = true;
          tr.log = [
            { t: w.boT + SEC[h], text: NAME[h] + ' ' + tag + ' ' + word(D) + ': a candle closed ' + (D > 0 ? 'above ' : 'below ') + f2(w.level) + (w.ibo ? ' (an internal break: the pages enter it with the same BO, VR, CF).' : '.') },
            { t: w.vr.t + SEC[l], text: NAME[l] + ' VR: the first BO Structure (QM) against the BO. The VR runs ' + f2(w.vr.lo) + ' to ' + f2(w.vr.hi) + (w.vr.near ? ' (from the extreme to the nearest swing before it)' : '') + '; its extreme ' + f2(w.vr.ext) + ' is the target.' },
            { t: M.cf.t + SEC[ctf], text: NAME[ctf] + ' CF' + (M.cf.again ? ' (a new one, after the first failed)' : '') + ', one timeframe under the VR\'s: the BO Structure (QM) back with the BO' + (o.cfBack !== false ? ', after price came back to the BO level ' + f2(w.level) : '') + (M.p50 != null ? (M.deep ? ', after the pullback reached 50% of the range (' + f2(M.p50) + ')' : ', before the pullback reached 50% of the range (' + f2(M.p50) + ')') : '') + '. The CF zone is ' + f2(M.cf.lo) + ' to ' + f2(M.cf.hi) + (M['case'] === 2 ? ', inside the VR: the kind that often fails.' : ', clear of the VR.') },
            { t: tr.t, text: 'Price pulled back into the CF zone and an EG closed with the BO on ' + NAME[ctf] + ': ' + word(tr.side) + ' ' + f2(tr.entry) + ', stop ' + f2(tr.stop) + ' (' + U + f2(sizes(mk, tr.entry).buf) + ' past the pullback\'s extreme, risk ' + U + f2(tr.r0) + '), target ' + f2(tr.target) + ' (' + (Math.abs(tr.target - tr.entry) / tr.r0).toFixed(1) + 'R).' }];
          tr.marks = [{ kind: 'level', p: w.level, a: w.boT, at: w.boT + SEC[h], label: NAME[h] + ' ' + tag },
            { kind: D > 0 ? 'vr' : 'bvr', top: w.vr.hi, bot: w.vr.lo, a: w.vr.t, at: w.vr.t + SEC[l], label: NAME[l] + ' VR' },
            { kind: 'zone', top: M.cf.hi, bot: M.cf.lo, a: M.cf.t, at: M.cf.t + SEC[ctf], label: NAME[ctf] + ' CF zone' }];
          if (M.p50 != null) tr.marks.push({ kind: 'level', p: M.p50, a: w.boT, at: w.vr.t + SEC[l], label: '50% of the range', under: D > 0 });
          finish(tr, outcome(tr, ctf === '1m' ? Cc : fine, tc)); out.push(tr);
        }
      }
      // a leg of the SOP inside the SOP, registered the first time the main sequence shows its VR (CF); what it reads is frozen then
      function nestAdd(leg, S0, vr, cf, now, par, lowX, LcX) {
        var D = S0.dir, boT = S0.boT, brk = leg === 'vr' ? vr.t : cf.t, key = leg + '|' + (S0.ibo ? 'i|' : '') + boT + '|' + brk;
        if (!LcX || !LcX.length) return null; if (legAt[key]) return legAt[key];
        var known = brk + SEC[par], k0 = at(LcX, known);
        var g = legAt[key] = { leg: leg, d: leg === 'vr' ? -D : D, D: D, ibo: !!S0.ibo, boT: boT, boLevel: S0.level, level: leg === 'vr' ? vr.level : cf.level, xs: leg === 'vr' ? vr.ext : D > 0 ? cf.lo : cf.hi,
          par: par, low: lowX, Lc: LcX, t0: known - SEC[lowX], known: known, k: k0, k0: k0, endT: Infinity, capT: known + BARRIER_WATCH * SEC[l], reg: now, done: false,
          vr: { t: vr.t, level: vr.level, ext: vr.ext, lo: vr.lo, hi: vr.hi }, cf: leg === 'cf' ? { t: cf.t, level: cf.level, lo: cf.lo, hi: cf.hi, c2: !!cf.c2 } : null };
        legs.push(g); return g;
      }
      // walk a leg over the lower candles closed by T (and by its own end): the repeat of the SOP's own no-hindsight walk
      function nestRun(g, T) {
        if (g.done) return;
        var lim = Math.min(T, g.endT, g.capT); if (o.until) lim = Math.min(lim, o.until);
        if (!g.EV) { var a0 = Math.max(0, g.k0 - 240); g.b0 = Math.max(a0, g.k0 - 9); g.EV = smallEv(F, g.Lc.slice(a0, at(g.Lc, g.capT))); g.ei = 0; g.evs = []; }
        var d = g.d;
        for (; g.k < g.Lc.length; g.k++) { var lc = g.Lc[g.k], tq = lc.time + SEC[g.low]; if (tq > lim) break;
          if (d > 0 ? lc.close < g.xs : lc.close > g.xs) { g.done = true; return; }   // a close back through the extreme (the zone's far side) the break was made from
          if (g.Vt != null && g.backT == null && lc.time > g.Vt && (d > 0 ? lc.low <= g.level : lc.high >= g.level)) g.backT = lc.time;   // price back at the level this leg's BO broke
          while (g.ei < g.EV.length && g.EV[g.ei].t <= lc.time) { var ne = g.EV[g.ei++];
            if (ne.t > g.t0 && ne.structure !== false) { if (g.Vt == null) { if (ne.dir === -d) g.Vt = ne.t; } else if (o.cfBack !== false && ne.dir === d && !(g.backT != null && g.backT <= ne.t)) ne = notCf(ne); }
            g.evs.push(ne); }
          var Mq = F.msMosha({ dir: d, level: g.level, t: g.t0, ext: NaN, far: g.xs }, { events: g.evs, bars: g.Lc.slice(g.b0, g.k + 1) }, o.buf == null ? sizes(mk, lc.close).buf : o.buf, { near: o.near !== false });
          if (!Mq || !Mq.vr) continue;
          if (Mq.state === 'bo-on' || Mq.state === 'vr-broken') { g.done = true; return; }   // the move went on past the nested VR with no entry
          if (!Mq.trade || Mq.trade.fillT !== lc.time || Mq['case'] === 2) continue;
          g.done = true;
          var q = Mq.trade, Zq = sizes(mk, q.entry), rq = Math.abs(q.entry - q.stop), tag = g.ibo ? 'iBO' : 'BO', D = g.D, v = g.leg === 'vr';
          // a leg first seen late (its break is known only once the candle that made the BO, or a new CF, has closed) takes no entry from before it was seen
          if (!(tq >= g.reg) || !(tq >= from) || !(rq > Zq.rmin) || rq > Zq.rmax || (d < 0 ? q.stop <= q.entry || q.target >= q.entry : q.stop >= q.entry || q.target <= q.entry)) return;
          var tr = { id: pre + (v ? 'sop-nv-' : 'sop-nc-') + g.low + '-' + (d > 0 ? 'b' : 's') + tq, market: mk, kind: 'sop', h: g.par, l: g.low, up: h, side: d, of: D, nest: g.leg, t: tq, entry: q.entry, stop: q.stop, target: q.target, r0: rq, 'case': Mq['case'],
            label: NAME[h] + ' ' + tag + ' → ' + NAME[g.par] + (v ? ' VR → ' : ' CF → ') + NAME[g.low] + ' SOP inside the ' + (v ? 'VR' : 'CF') };
          if (g.ibo) tr.ibo = true; if (!v && g.cf.c2) tr.cfIn = true; if (o.cfBack !== false) tr.back = true;
          tr.log = [{ t: g.boT + SEC[h], text: NAME[h] + ' ' + tag + ' ' + word(D) + ': a candle closed ' + (D > 0 ? 'above ' : 'below ') + f2(g.boLevel) + '.' },
            { t: g.vr.t + SEC[l], text: NAME[l] + ' VR: the first BO Structure (QM) against the ' + tag + ', through ' + f2(g.vr.level) + ' (its extreme ' + f2(g.vr.ext) + ').' + (v ? ' That break is read as a BO ' + word(d) + ' one timeframe lower: a VR and its CF on ' + NAME[g.low] + ' are waited for, against the ' + NAME[h] + ' ' + tag + '.' : '') }];
          if (!v) tr.log.push({ t: g.cf.t + SEC[g.par], text: NAME[g.par] + ' CF: the BO Structure (QM) back with the ' + tag + '; the CF zone is ' + f2(g.cf.lo) + ' to ' + f2(g.cf.hi) + (g.cf.c2 ? ', inside the VR: the kind that often fails' : '') + '. That break is read as a BO ' + word(d) + ' one timeframe lower: a VR and its CF on ' + NAME[g.low] + ' are waited for, with the ' + NAME[h] + ' ' + tag + '.' });
          tr.log.push({ t: Mq.vr.t + SEC[g.low], text: NAME[g.low] + ' VR: the first BO Structure (QM) against the ' + NAME[g.par] + (v ? ' VR' : ' CF') + '. It runs ' + f2(Mq.vr.lo) + ' to ' + f2(Mq.vr.hi) + '; its extreme ' + f2(Mq.vr.ext) + ' is the target.' },
            { t: Mq.cf.t + SEC[g.low], text: NAME[g.low] + ' CF' + (Mq.cf.again ? ' (a new one, after the first failed)' : '') + ': the BO Structure (QM) back the ' + word(d) + ' way' + (o.cfBack !== false ? ', after price came back to the level ' + f2(g.level) + ' that BO broke' : '') + '. The CF zone is ' + f2(Mq.cf.lo) + ' to ' + f2(Mq.cf.hi) + ', clear of the VR.' },
            { t: tq, text: 'Price pulled back into the ' + NAME[g.low] + ' CF zone and an EG closed ' + word(d) + ': ' + word(d) + ' ' + f2(q.entry) + ', stop ' + f2(q.stop) + ' (' + U + f2(Zq.buf) + ' past the pullback\'s extreme, risk ' + U + f2(rq) + '), target ' + f2(q.target) + ' (the ' + NAME[g.low] + ' VR\'s extreme, ' + (Math.abs(q.target - q.entry) / rq).toFixed(1) + 'R).' });
          tr.marks = [{ kind: 'level', p: g.boLevel, a: g.boT, at: g.boT + SEC[h], label: NAME[h] + ' ' + tag },
            { kind: D > 0 ? 'vr' : 'bvr', top: g.vr.hi, bot: g.vr.lo, a: g.vr.t, at: g.vr.t + SEC[l], label: NAME[l] + ' VR' }];
          if (!v) tr.marks.push({ kind: 'zone', top: g.cf.hi, bot: g.cf.lo, a: g.cf.t, at: g.cf.t + SEC[g.par], label: NAME[g.par] + ' CF zone' });
          tr.marks.push({ kind: d > 0 ? 'vr' : 'bvr', top: Mq.vr.hi, bot: Mq.vr.lo, a: Mq.vr.t, at: Mq.vr.t + SEC[g.low], label: NAME[g.low] + ' VR (inside)' },
            { kind: 'zone', top: Mq.cf.hi, bot: Mq.cf.lo, a: Mq.cf.t, at: Mq.cf.t + SEC[g.low], label: NAME[g.low] + ' CF zone · entry' });
          finish(tr, outcome(tr, g.low === '1m' ? g.Lc : fine, tq)); out.push(tr); return; }
        if (g.k < g.Lc.length && g.Lc[g.k].time + SEC[g.low] > Math.min(g.endT, g.capT)) g.done = true;
      }
      // the VR retest (owner, 21 Nov 2026: "the top of vr or entry on new cf made once touch and cf box high is the sl"; target
      // "the last low"). Once the upper timeframe has turned against the BO, the VR's level (the low the VR broke, for a buy BO)
      // is sold when price first comes back to it: (A) a limit AT the level, stop past the VR's top (its extreme); (B) after that
      // touch, at the close of the first new CF (a BO Structure the new way on this chart), stop past that CF box's high.
      // Target for both: the last low (the lowest low between the VR and the touch). A close past the VR's top before an entry ends
      // it. Read on closed candles only; the fill of (A) is the first 5-minute candle that reaches the level.
      function retest(S0, M, i) {
        var D = S0.dir, E = -D, boT = Hw[S0.idx].time, vr = M.vr, vrK = vr.t + SEC[l], key = h + '|' + boT + '|' + vr.t, st = rt[key] || (rt[key] = { touch: null, ext: null, dead: false, a: false, b: false });
        var c = L[i], lvl = vr.level, top = vr.ext, buf = o.buf == null ? sizes(mk, c.close).buf : o.buf;
        if (o.retest === false || st.dead || c.time < vrK) return false;
        // the last low so far: the lowest low from the VR's candle to the candle before this one (closed candles, kept as the
        // clock moves); a close past the VR's top in between ends the idea (the BO goes on)
        if (st.j == null) { st.j = i; while (st.j > 0 && L[st.j - 1].time >= vr.t) st.j--; }
        for (; st.j < i; st.j++) { var b = L[st.j];
          if (E < 0 ? b.close > top : b.close < top) { st.dead = true; return false; }
          st.run = st.run == null ? (E < 0 ? b.low : b.high) : (E < 0 ? Math.min(st.run, b.low) : Math.max(st.run, b.high)); }
        // ARMED once price has gone at least 1R (the VR's top to its level) beyond the level: from then the old BO gives no more
        // entries (a normal pullback also breaks small swings of the chart above, so the turn alone does not stop them)
        var armed = st.run != null && (E < 0 ? st.run < lvl : st.run > lvl) && Math.abs(st.run - lvl) >= Math.abs(top - lvl);
        if (!armed) return false;
        if (st.touch == null) {
          if (!(c.time >= turnT && (E < 0 ? c.high >= lvl : c.low <= lvl))) return true;
          st.ext = st.run;
          var fi = -1; for (var q = 0; q < fine.length; q++) { var fb = fine[q]; if (fb.time < c.time) continue; if (fb.time >= c.time + SEC[l]) break; if (E < 0 ? fb.high >= lvl : fb.low <= lvl) { fi = q; break; } }
          st.touch = c.time; if (fi < 0) return true;
          var stopA = E < 0 ? top + buf : top - buf, fT = fine[fi].time;
          if (!(fT + SEC['5m'] >= from) || map['vr|' + key]) return true;
          var trA = map['vr|' + key] = { id: pre + 'sop-vr-' + l + '-' + (E > 0 ? 'b' : 's') + fT, market: mk, kind: 'sop', h: h, l: l, side: E, t: fT, entry: lvl, stop: stopA, target: st.ext, r0: Math.abs(lvl - stopA), retest: 'level', label: NAME[h] + ' turned → ' + NAME[l] + ' VR retest' };
          trA.log = retestLog(S0, M, trA, 'A ' + word(E) + ' limit at the VR level ' + f2(lvl) + ' filled as price came back to it: stop ' + f2(stopA) + ' (past the VR\'s ' + (E < 0 ? 'top ' : 'bottom ') + f2(top) + '), target the last ' + (E < 0 ? 'low ' : 'high ') + f2(st.ext) + ' (' + (Math.abs(st.ext - lvl) / trA.r0).toFixed(1) + 'R).');
          trA.marks = retestMarks(S0, M, trA, st.ext);
          finish(trA, outcome(trA, fine, fT, true)); out.push(trA); return true;
        }
        if (st.b) return true;
        var e = null; for (var k = LE.length - 1; k >= 0; k--) { var x = LE[k]; if (x.t === c.time && x.dir === E && x.structure !== false && x.t > st.touch) { e = x; break; } }
        if (!e) return true;
        st.b = true;
        var boxHi = E < 0 ? e.top : e.bot, stopB = E < 0 ? boxHi + buf : boxHi - buf, entB = c.close, tB = c.time + SEC[l];
        if (!(E < 0 ? st.ext < entB && stopB > entB : st.ext > entB && stopB < entB) || !(tB >= from)) return true;
        var trB = { id: pre + 'sop-vc-' + l + '-' + (E > 0 ? 'b' : 's') + tB, market: mk, kind: 'sop', h: h, l: l, side: E, t: tB, entry: entB, stop: stopB, target: st.ext, r0: Math.abs(entB - stopB), retest: 'cf', label: NAME[h] + ' turned → ' + NAME[l] + ' VR retest, new CF' };
        trB.log = retestLog(S0, M, trB, 'After the touch, a new ' + NAME[l] + ' CF ' + word(E) + ' (a BO Structure, a candle closed ' + (E < 0 ? 'below ' : 'above ') + f2(e.level) + '): ' + word(E) + ' ' + f2(entB) + ' at its close, stop ' + f2(stopB) + ' (past the CF box ' + (E < 0 ? 'high ' : 'low ') + f2(boxHi) + '), target the last ' + (E < 0 ? 'low ' : 'high ') + f2(st.ext) + ' (' + (Math.abs(st.ext - entB) / trB.r0).toFixed(1) + 'R).');
        trB.marks = retestMarks(S0, M, trB, st.ext).concat([{ kind: 'zone', top: Math.max(e.top, e.bot), bot: Math.min(e.top, e.bot), a: e.fromT || e.t, at: tB, label: NAME[l] + ' new CF' }]);
        finish(trB, outcome(trB, fine, tB)); out.push(trB); return true;
      }
      function retestLog(S0, M, tr, last) {
        var D = S0.dir, boT = Hw[S0.idx].time;
        return [{ t: boT + SEC[h], text: NAME[h] + ' BO ' + word(D) + ': a candle closed ' + (D > 0 ? 'above ' : 'below ') + f2(S0.level) + '.' },
          { t: M.vr.t + SEC[l], text: NAME[l] + ' VR: the first BO Structure against the BO, through ' + f2(M.vr.level) + ' (its extreme ' + f2(M.vr.ext) + ').' },
          { t: turnT, text: NAME[h] + ' turned ' + word(-D) + ': its newest break (3 candles a side) is the other way, so the ' + word(D) + ' BO gives no more entries; the VR level is ' + (D > 0 ? 'sold' : 'bought') + ' on the retest.' },
          { t: tr.t, text: last }].sort(function (a, b) { return a.t - b.t; });
      }
      function retestMarks(S0, M, tr, ext) {
        var boT = Hw[S0.idx].time;
        return [{ kind: 'level', p: S0.level, a: boT, at: boT + SEC[h], label: NAME[h] + ' BO' },
          { kind: S0.dir > 0 ? 'vr' : 'bvr', top: M.vr.hi, bot: M.vr.lo, a: M.vr.t, at: M.vr.t + SEC[l], label: NAME[l] + ' VR' },
          { kind: 'level', p: M.vr.level, a: M.vr.t, at: M.vr.t + SEC[l], label: 'VR level · retest', under: tr.side > 0 },
          { kind: 'level', p: ext, a: M.vr.t, at: tr.t, label: (tr.side < 0 ? 'Last low' : 'Last high') + ' · target', under: tr.side < 0 }];
      }
      for (var i = 0; i < L.length; i++) { var t = L[i].time + SEC[l]; if (t < from) continue; if (o.until && t > o.until) break;
        while (n < H.length && H[n].time + SEC[h] <= t) n++;
        if (n !== hN) { Hw = H.slice(Math.max(0, n - win), n); HA = Hw.length ? F.msAnalyze(Hw, piv) : null; HT = Hw.length ? F.msInternal(Hw, Hw.length, 3) : []; HI = o.ibo === false ? [] : HT; hN = n; }
        // the legs of the SOP inside the SOP read the lower candles closed by now FIRST, with the main sequence as the candle before left it
        if (walkers.length) { for (var wi = 0; wi < walkers.length; wi++) walkRun(walkers[wi], t); }
        if (legs.length) { for (var gi = 0; gi < legs.length; gi++) nestRun(legs[gi], t); legs = legs.filter(function (g) { return !g.done; }); }
        if (!HA) continue;
        var A = HA, Lw = null, LE = null, srcs = [];
        var mv = A.trend ? (A.last && A.last.dir === A.trend ? A.last : A.events.slice().reverse().find(function (e) { return e.dir === A.trend; })) : null;
        if (mv) srcs.push({ ibo: false, dir: A.trend, level: mv.level, idx: mv.breakIdx, far: A.trend > 0 ? mv.bot : mv.top, ext: A.ext ? A.ext.p : NaN });
        var ie = HI.length ? HI[HI.length - 1] : null;
        if (ie && (!mv || ie.breakIdx > mv.breakIdx)) { var lo = Infinity, hi = -Infinity; for (var q = ie.fromIdx; q <= ie.breakIdx; q++) { lo = Math.min(lo, Hw[q].low); hi = Math.max(hi, Hw[q].high); }
          srcs.push({ ibo: true, dir: ie.dir, level: ie.level, idx: ie.breakIdx, far: ie.dir > 0 ? lo : hi, ext: NaN }); }
        // the upper timeframe TURNED (owner, 21 Nov 2026, "this should be a sell", on a EUR/USD buy): its newest internal break
        // (3 candles a side) is the other way and later than the last major BO, so that BO gives no more entries the old way; its
        // VR level is sold (bought) on the retest instead (retest(), below)
        // once turned it stays turned for that BO (a later small break back is a pullback, not a turn back); only a close past the
        // VR's top (the retest's stop) ends it, in retest(). A new major BO starts afresh.
        var tk = mv ? h + '|' + Hw[mv.breakIdx].time : null, te = HT.length ? HT[HT.length - 1] : null;
        if (mv && te && te.breakIdx > mv.breakIdx && te.dir !== mv.dir && !turnAt[tk]) turnAt[tk] = Hw[te.breakIdx].time + SEC[h];
        var turned = !!(tk && turnAt[tk]); turnT = turned ? turnAt[tk] : null;
        for (var si = 0; si < srcs.length; si++) { var S0 = srcs[si], D = S0.dir, boT = Hw[S0.idx].time, tag = S0.ibo ? 'iBO' : 'BO';
          if (!Lw) { Lw = L.slice(Math.max(0, i + 1 - win), i + 1); // the VR and the CF are breaks of this chart's small swings (the pages draw the VR at the small swing right before the
            // extreme); o.vr 'major' reads the protected swing (6 a side), as the replay did until 21 Nov 2026
            if (o.vr === 'major') { var LA = F.msAnalyze(Lw, piv); LE = LA.events.map(function (e) { return { dir: e.dir, level: e.level, structure: e.structure, t: Lw[e.breakIdx] ? Lw[e.breakIdx].time : Infinity, fromT: Lw[e.fromIdx] ? Lw[e.fromIdx].time : 0, top: e.top, bot: e.bot }; }); }
            else LE = smallEv(F, Lw); }
          var M = F.msMosha({ dir: D, level: S0.level, t: boT, ext: S0.ext, far: S0.far }, { events: o.cfBack === false ? LE : backEv(LE, Lw, D, S0.level, boT).ev, bars: Lw }, o.buf == null ? sizes(mk, L[i].close).buf : o.buf, { near: o.near !== false });
          var SN = { dir: D, ibo: S0.ibo, boT: boT, level: S0.level };
          if (Lc.length && M && M.vr) { var gv = nestAdd('vr', SN, M.vr, null, t, l, low, Lc); if (gv && !split && M.cf && gv.endT === Infinity) gv.endT = M.cf.t + SEC[l]; if (gv) nestRun(gv, t); }
          if (split) {   // the CF, the entry and the hand-over are the walker's, on the CF timeframe
            if (M && M.vr) { var ww = walkAdd(S0, M, t); ww.seen = i; ww.blocked = !!(!S0.ibo && turned && retest(S0, M, i)); walkRun(ww, t); }
            continue; }
          if (!S0.ibo && turned && M && M.vr && retest(S0, M, i)) continue;
          if (Lc.length && M && M.vr && M.cf && !(M['case'] === 2 && o.case2 === false)) { var gc = nestAdd('cf', SN, M.vr, { t: M.cf.t, level: M.cf.level, lo: M.cf.lo, hi: M.cf.hi, c2: M['case'] === 2 }, t, l, low, Lc); if (gc) nestRun(gc, t); }
          // the method's own entry at the CF is the BARRIER entry (the pages: "before CF or after CF, using the barrier entry"):
          // each clean CF zone is handed over once, ON the candle whose close made it (a CF from before the window is never handed
          // over with a later moment), and never once that CF has failed or the move reached the VR's extreme. Its VR box goes
          // with it: the pages call the VR, the CF and the origin the strongest barriers (a market that cannot break the VR or the
          // CF is sideways, entered barrier style), so the VR is a barrier the other way from the moment the CF made it a range.
          if (o.cfOut && M && M.cf && M.vr && M['case'] !== 2 && M.cf.t === L[i].time && M.state !== 'cf-failed' && M.state !== 'vr-broken' && !cfSeen[l + '|' + M.cf.t + '|' + D]) { cfSeen[l + '|' + M.cf.t + '|' + D] = 1;
            var kn = L[i].time + SEC[l], of = NAME[h] + (S0.ibo ? ' iBO' : ' BO');
            o.cfOut.push({ tf: l, dir: D, lo: M.cf.lo, hi: M.cf.hi, kind: 'cf', known: kn, of: of, tgt: M.vr.ext });
            o.cfOut.push({ tf: l, dir: -D, lo: M.vr.lo, hi: M.vr.hi, kind: 'vr', known: kn, of: of, tgt: D > 0 ? M.cf.hi : M.cf.lo }); }
          // a trade is recorded only AT the candle whose close is its EG, as the chart read then: the window slides, so a later
          // look could re-read an old stretch and "find" an entry days after the fact (21 Nov 2026, independent audit)
          if (!M || !M.trade || M.trade.fillT !== L[i].time || !(M.trade.fillT + SEC[l] >= from)) continue;
          // a CF INSIDE the VR is the method's "likely to fail" case: the method waits. It is recorded as its OWN reading (id
          // "sop-c2-", label "· CF inside the VR", case2: true), never under the ids of the clean sequence, so the record can
          // show the case apart (21 Nov 2026). o.case2 false leaves it out; o.case2 true (research) reads it as an ordinary entry.
          if (M['case'] === 2 && o.case2 === false) continue;
          var c2 = M['case'] === 2 && o.case2 !== true;
          var k = (c2 ? 'c2|' : '') + (S0.ibo ? 'i|' : '') + h + '|' + boT + '|' + M.trade.fillT; if (map[k]) continue;
          var tr = map[k] = { id: pre + (c2 ? 'sop-c2-' : 'sop-') + (S0.ibo ? 'i-' : '') + l + '-' + M.trade.fillT, market: mk, kind: 'sop', h: h, l: l, side: M.trade.side, t: M.trade.fillT + SEC[l], entry: M.trade.entry, stop: M.trade.stop, target: M.trade.target,
            r0: Math.abs(M.trade.entry - M.trade.stop), 'case': M['case'], near: !!M.vr.near, again: !!(M.cf && M.cf.again), deep: M.deep == null ? null : !!M.deep };
          if (o.cfBack !== false) tr.back = true;
          if (S0.ibo) { tr.ibo = true; tr.label = NAME[h] + ' iBO → ' + NAME[l] + ' VR, CF'; }
          if (c2) { tr.case2 = true; tr.label = NAME[h] + ' ' + tag + ' → ' + NAME[l] + ' VR, CF · CF inside the VR'; }
          tr.log = [
            { t: boT + SEC[h], text: NAME[h] + ' ' + tag + ' ' + word(D) + ': a candle closed ' + (D > 0 ? 'above ' : 'below ') + f2(S0.level) + (S0.ibo ? ' (an internal break: the pages enter it with the same BO, VR, CF).' : '.') },
            { t: M.vr.t + SEC[l], text: NAME[l] + ' VR: the first BO Structure (QM) against the BO. The VR runs ' + f2(M.vr.lo) + ' to ' + f2(M.vr.hi) + (M.vr.near ? ' (from the extreme to the nearest swing before it)' : '') + '; its extreme ' + f2(M.vr.ext) + ' is the target.' },
            { t: M.cf.t + SEC[l], text: NAME[l] + ' CF' + (M.cf.again ? ' (a new one, after the first failed)' : '') + (cfFall ? ' (no ' + NAME[CFTF[l]] + ' candles on file: the CF is read on ' + NAME[l] + ')' : '') + ': the BO Structure (QM) back with the BO' + (o.cfBack !== false ? ', after price came back to the BO level ' + f2(S0.level) : '') + (M.p50 != null ? (M.deep ? ', after the pullback reached 50% of the range (' + f2(M.p50) + ')' : ', before the pullback reached 50% of the range (' + f2(M.p50) + ')') : '') + '. The CF zone is ' + f2(M.cf.lo) + ' to ' + f2(M.cf.hi) + (M['case'] === 2 ? ', inside the VR: the kind that often fails.' : ', clear of the VR.') },
            { t: tr.t, text: 'Price pulled back into the CF zone and an EG closed with the BO: ' + word(tr.side) + ' ' + f2(tr.entry) + ', stop ' + f2(tr.stop) + ' (' + U + f2(sizes(mk, tr.entry).buf) + ' past the pullback\'s extreme, risk ' + U + f2(tr.r0) + '), target ' + f2(tr.target) + ' (' + (Math.abs(tr.target - tr.entry) / tr.r0).toFixed(1) + 'R).' }];
          // what the chart draws for this trade (assets/mosha-replay.js): the BO level, the VR box, the CF zone, each from the moment it was known
          tr.marks = [{ kind: 'level', p: S0.level, a: boT, at: boT + SEC[h], label: NAME[h] + ' ' + tag },
            { kind: D > 0 ? 'vr' : 'bvr', top: M.vr.hi, bot: M.vr.lo, a: M.vr.t, at: M.vr.t + SEC[l], label: NAME[l] + ' VR' },
            { kind: 'zone', top: M.cf.hi, bot: M.cf.lo, a: M.cf.t, at: M.cf.t + SEC[l], label: NAME[l] + ' CF zone' }];
          if (M.p50 != null) tr.marks.push({ kind: 'level', p: M.p50, a: boT, at: M.vr.t + SEC[l], label: '50% of the range', under: D > 0 });
          out.push(tr);
        }
        // a sequence the chart no longer reads (a newer BO took its place) gives nothing more
        if (walkers.length) { walkers = walkers.filter(function (w) { if (w.seen !== i) w.done = true; return !w.done; });
          for (var gj = 0; gj < legs.length; gj++) nestRun(legs[gj], t); }   // a leg the walker started on this candle
      }
      walkers.forEach(function (w) { walkRun(w, Infinity); });
      legs.forEach(function (g) { nestRun(g, Infinity); });   // the lower candles closed after the last closed candle of this timeframe
    });
    out = uniq(out);   // one order under two ids (the BO's and the iBO's sequence, the VR retest of two ladder steps) is recorded once
    out.forEach(function (tr) { if (tr.status == null) finish(tr, outcome(tr, fine, tr.t));
      var tg = dayTags(B['1d'], tr.t, tr.side); tr.withWeekly = tg.withWeekly; tr.er20 = tg.er20; });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // every barrier of one timeframe with the moment it was known and the moment price first came back to it; `visits` = the
  // later returns (price left the zone, a closed candle wholly outside it on the side it came from, and traded back into it),
  // each before the zone was broken (a close through its far side) and read on candles closed by then only
  // The box (21 Nov 2026, the pages' pictures): from the swing level the break took (the near side, where price comes back) to
  // the origin extreme of the leg (the lowest low between that swing and a break up; the highest high before a break down).
  // First touch and break are read as the charts read their zones: the first later candle that trades into the box, a close
  // through its far side. o.box 'candle' = the charts' own zone (msZones: the last opposite candle at the origin), as before.
  function boxesOf(H, brk) {
    var out = [], seen = {};
    brk.forEach(function (e) { if (!(e.fromIdx >= 0) || e.fromIdx >= e.breakIdx || !isFinite(e.level)) return;
      var up = e.dir > 0, oi = e.fromIdx, j, k;
      for (j = e.fromIdx; j < e.breakIdx; j++) if (up ? H[j].low < H[oi].low : H[j].high > H[oi].high) oi = j;
      if (seen[e.dir + '|' + oi]) return; seen[e.dir + '|' + oi] = 1;   // one box an origin, its earliest break
      var z = { dir: e.dir, lo: up ? H[oi].low : e.level, hi: up ? e.level : H[oi].high, i: oi, breakIdx: e.breakIdx, kind: e.kind, touchIdx: null, brokenIdx: null };
      if (!(z.hi > z.lo)) return;
      for (k = e.breakIdx + 1; k < H.length; k++) { var b = H[k];
        if (z.touchIdx == null && (up ? b.low <= z.hi : b.high >= z.lo)) z.touchIdx = k;
        if (up ? b.close < z.lo : b.close > z.hi) { z.brokenIdx = k; break; } }
      out.push(z); });
    return out;
  }
  // AN ENGULF (EG) ZONE IS A BARRIER TOO (owner, 21 Nov 2026: "a barrier can be an eg as well"). The engulf is the desks' one
  // definition (council/eg-methods.mjs `engulfAt` / `zones`, copied here because the page cannot load that file; a test compares
  // the two): the base is the last candle of the other colour; the FIRST later coloured candle that closes beyond its high (a
  // buy) or its low (a sell) completes it; a close through the base's other side before that cancels it; a doji is never a base.
  // The box is the base candle wick to wick, known from the completing candle's close; first touch and break as the other boxes.
  var EG_SPAN = 3;   // the engulf completes within three candles of its first candle (owner, 22 Nov 2026: "Change to 3 candles"), as council/eg-methods.mjs
  function egBoxes(H) {
    var out = [], i, j, q, k;
    for (i = 1; i < H.length; i++) { var c = H[i], dir = c.close > c.open ? 1 : c.close < c.open ? -1 : 0, p = null; if (!dir) continue;
      for (j = i - 1; j >= 0 && j >= i - EG_SPAN; j--) { var b0 = H[j]; if (dir > 0 ? b0.open > b0.close : b0.open < b0.close) { p = b0; break; } }
      if (!p || !(dir > 0 ? c.close > p.high : c.close < p.low)) continue;
      var gone = false; for (q = j + 1; q < i && !gone; q++) { var m = H[q]; gone = dir > 0 ? (m.close > m.open && m.close > p.high) || m.close < p.low : (m.close < m.open && m.close < p.low) || m.close > p.high; }
      if (gone || !(p.high > p.low)) continue;
      var z = { dir: dir, lo: p.low, hi: p.high, i: j, breakIdx: i, kind: 'eg', touchIdx: null, brokenIdx: null };
      for (k = i + 1; k < H.length; k++) { var b = H[k];
        if (z.touchIdx == null && (dir > 0 ? b.low <= z.hi : b.high >= z.lo)) z.touchIdx = k;
        if (dir > 0 ? b.close < z.lo : b.close > z.hi) { z.brokenIdx = k; break; } }
      out.push(z); }
    return out;
  }
  function zonesOf(tf, B, F, o) {
    var H = B[tf]; if (!H || !H.length) return [];
    var A = F.msAnalyze(H, PIVOT), brk = A.events.map(function (e) { return { dir: e.dir, fromIdx: e.fromIdx, breakIdx: e.breakIdx, level: e.level, kind: 'bo' }; })
      .concat(F.msInternal(H, H.length, 3).map(function (e) { return { dir: e.dir, fromIdx: e.fromIdx, breakIdx: e.breakIdx, level: e.level, kind: 'ibo' }; }))
      .sort(function (x, y) { return x.breakIdx - y.breakIdx; });   // msZones keeps one zone a candle, the first listed: the EARLIEST break of an origin, so a later BO never makes a visited zone fresh again
    // the EG zones come after the BO origins: of two records of one order the BO origin's is the one kept (o.eg false: none)
    return (o && o.box === 'candle' ? F.msZones(H, brk, H.length) : boxesOf(H, brk)).concat(o && (o.eg === false || o.box === 'candle') ? [] : egBoxes(H)).map(function (z) {
      var vis = [];
      if (z.touchIdx != null) { var end = z.brokenIdx != null ? z.brokenIdx : H.length - 1, out = false;
        for (var k = z.touchIdx + 1; k <= end && k < H.length; k++) { var b = H[k];
          if (!out) { if (z.dir < 0 ? b.high < z.lo : b.low > z.hi) out = true; continue; }
          if (z.dir < 0 ? b.high >= z.lo : b.low <= z.hi) { vis.push(b.time); out = false; } } }
      return { tf: tf, dir: z.dir, lo: z.lo, hi: z.hi, kind: z.kind, known: H[z.breakIdx].time + SEC[tf], touch: z.touchIdx != null ? H[z.touchIdx].time : null, visits: vis };
    });
  }
  // swept swings of one timeframe as barriers: a swing high (3 candles a side) that a later candle trades above and then closes
  // at or below is a sell barrier from the swing to that wick (a swing low mirrored, a buy barrier); the first candle beyond it
  // decides: a close beyond is a break, not a sweep. Known as a level once the swing is confirmed; the confirmation is read only
  // from the close of the sweeping candle (`wait`), and the extreme made at the barrier starts at its wick (`x0`).
  var SWEEP_N = 3;
  function sweepsOf(tf, B) {
    var H = B[tf] || [], out = [], N = SWEEP_N;
    for (var j = N; j + N < H.length; j++) for (var s = -1; s <= 1; s += 2) {
      var hi = s < 0, ok = true, p = hi ? H[j].high : H[j].low;
      for (var k = 1; k <= N && ok; k++) if (hi ? H[j - k].high > p || H[j + k].high >= p : H[j - k].low < p || H[j + k].low <= p) ok = false;
      if (!ok) continue;
      for (var q = j + N + 1; q < H.length; q++) { var b = H[q]; if (hi ? !(b.high > p) : !(b.low < p)) continue;
        if (hi ? b.close <= p : b.close >= p) out.push({ tf: tf, dir: s, lo: hi ? p : b.low, hi: hi ? b.high : p, kind: 'sweep', level: p, known: H[j + N].time + SEC[tf], touch: b.time, wait: b.time + SEC[tf], x0: hi ? b.high : b.low });
        break; } }
    return out;
  }
  // 2. the barrier entry. A zone's box is drawn from candles up to its break only; `touch` says when price came back, never which zone.
  // Two confirmations, both from the pages, each its own record:
  //   simple: the CF is a QM (BO Structure) with the barrier; a limit at the level that QM broke;
  //   Janda (21 Nov 2026): after that QM, the NEXT break the same way, a normal BO (continuation, not another QM); a limit at the
  //     level that second BO broke. A break the other way in between ends it. Id "bar-j-", label "… · Janda".
  // Zones handed over by the sequence (o.extra): kind 'cf' (the CF zone, with the BO) and kind 'vr' (the VR box, against it).
  // The owner's readings of 21 Nov 2026 (see the top of the file) are each their own record with their own id part and label:
  // "sw-" sweep barrier, "-m5-" M5 confirm, "-v<n>-" a later visit, "-z-" the limit at the zone's near side.
  // The second table (21 Nov 2026): "-c30-" / "-c15-" = an H4 barrier confirmed on M30, an H1 barrier on M15; an M30 barrier
  // (h "30m") is confirmed on M5; "bar-sop-" = the repeat of the SOP after the QM (a VR and its CF one timeframe lower).
  var M5_ALT = { '4h': '5m', '15m': '5m' };
  function barrierTrades(B0, F, o) {
    o = o || {}; var B = {}, tfk; for (tfk in B0) B[tfk] = B0[tfk];
    if (!(B['30m'] || []).length && (B['15m'] || []).length) B['30m'] = m30of(B['15m']);
    var from = o.from, rows = [], mk = mkOf(o.market), f2 = fmt(mk), U = unit(mk), pre = mk === 'xau' ? '' : mk + ':';
    var fk = B['1m'] && B['1m'].length ? '1m' : '5m', fine = B[fk] || [];
    var BR = o.rr > 0 ? +o.rr : BARRIER_R;   // rr: 3 reads the target the older way (the pinned tests)
    var at = function (A, t) { var lo = 0, hi = A.length; while (lo < hi) { var m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
    // The method: a barrier WITH the direction runs, one against it "only gives a rejection". The direction here is the
    // structure of the timeframe above the barrier's (D1 over H4, H4 over H1, H1 over M15; a D1 barrier has none), read on its
    // candles CLOSED when price came back. Recorded on the trade (`withDir`) and named in its label and log; the entry, the
    // stop and the 3R target are the same either way (the pages name no other target), so the record shows the two apart.
    var UP = { '4h': '1d', '1h': '4h', '30m': '1h', '15m': '1h' }, dirMemo = {};
    var dirAt = function (tf, t) { var H = B[tf] || [], n = at(H, t - SEC[tf] + 1), k = tf + n; if (!(k in dirMemo)) { var Hw = H.slice(Math.max(0, n - WIN), n), A = Hw.length > 20 ? F.msAnalyze(Hw, PIVOT) : null; dirMemo[k] = A && A.trend ? A.trend : 0; } return dirMemo[k]; };
    BARRIER.concat(o.table2 === false ? [] : BARRIER30).forEach(function (pair) {
      var zt = pair[0], ctf = pair[1], C = B[ctf] || []; if (!(B[zt] || []).length) return;
      // the zones the sequence handed over (o.extra): the first candle after the zone was known that trades into it is its return
      var own = (o.extra || []).filter(function (z) { return z.tf === zt; }).map(function (z) { var Z = B[zt], q = at(Z, z.known), tch = null;
        for (; q < Z.length; q++) if (z.dir < 0 ? Z[q].high >= z.lo : Z[q].low <= z.hi) { tch = Z[q].time; break; }
        return { tf: zt, dir: z.dir, lo: z.lo, hi: z.hi, kind: z.kind === 'vr' ? 'vr' : 'cf', known: z.known, touch: tch, of: z.of, tgt: z.tgt }; });
      // REPEAT THE SOP AFTER THE CF (21 Nov 2026, the method's own page on it; until then a CF zone got the barrier's QM-first
      // repeat below, which is another page's rule for barriers). The parent CF's own break is read as the BO: NO QM comes
      // first. One timeframe lower (the desk's choice: the page says the timeframe is "what the VR gives"), a VR forms (the
      // first BO Structure against the CF) and then a CF (the BO Structure back with it) whose zone sits INSIDE the parent CF
      // zone, both sides; a nested CF anywhere else is not this entry. The entry is the sequence's own (the pullback into the
      // nested CF zone, then an EG; stop past the pullback's extreme; target the nested VR's extreme). It ends with a close
      // through the parent zone's far side (the parent CF failed), once price reached the parent VR's extreme (the move is
      // done), or once the nested move ran past its VR. Walked one closed lower candle at a time from the parent CF's close;
      // the entry is taken only AT the candle whose close is its EG. One record a CF zone. Not read: a nested CF one more
      // timeframe down (the page allows it), which the replay does not look for.
      if (o.rsop !== false && DOWN[zt] && (B[DOWN[zt]] || []).length) own.forEach(function (z) { if (z.kind !== 'cf') return;
        var d = z.dir, low = DOWN[zt], Lc = B[low], k0 = at(Lc, z.known), a0 = Math.max(0, k0 - 240), kEnd = Math.min(Lc.length, at(Lc, z.known + 2 * BARRIER_WATCH * SEC[low])), Wl = Lc.slice(a0, kEnd), EV = smallEv(F, Wl), ei = 0, evs = [];
        for (var kk = k0; kk < kEnd; kk++) { var lc = Lc[kk]; if (o.until && lc.time + SEC[low] > o.until) break;
          if (d > 0 ? lc.close < z.lo : lc.close > z.hi) break;
          if (isFinite(z.tgt) && (d > 0 ? lc.high >= z.tgt : lc.low <= z.tgt)) break;
          while (ei < EV.length && EV[ei].t <= lc.time) evs.push(EV[ei++]);
          var Mq = F.msMosha({ dir: d, level: d > 0 ? z.hi : z.lo, t: z.known - SEC[low], ext: NaN, far: d > 0 ? z.lo : z.hi }, { events: evs, bars: Wl.slice(0, kk - a0 + 1) }, sizes(mk, lc.close).buf, { near: true });
          if (!Mq || !Mq.vr) continue;
          if (Mq.state === 'bo-on' || Mq.state === 'vr-broken') break;
          if (!Mq.trade || Mq.trade.fillT !== lc.time || Mq['case'] === 2) continue;
          if (!(Mq.cf.lo >= z.lo && Mq.cf.hi <= z.hi)) continue;   // the nested CF is not inside the parent CF zone
          var q = Mq.trade, tq = lc.time + SEC[low], Zq = sizes(mk, q.entry), rq = Math.abs(q.entry - q.stop);
          if (!(tq >= from) || !(rq > Zq.rmin) || rq > Zq.rmax || (d < 0 ? q.stop <= q.entry || q.target >= q.entry : q.stop >= q.entry || q.target <= q.entry)) break;
          var up = UP[zt], ud = up ? dirAt(up, z.known) : 0, wd = ud ? ud === d : null;
          var ts = { id: pre + 'bar-sop-cf-' + zt + '-' + (d > 0 ? 'b' : 's') + tq, market: mk, kind: 'barrier', label: NAME[zt] + ' CF barrier · ' + z.of + ' · repeat SOP' + (wd == null ? '' : wd ? ' · with ' + NAME[up] : ' · against ' + NAME[up]),
            withDir: wd, janda: false, jandaM1: false, m5: false, alt: null, rsop: true, nested: true, mkt: true, sweep: false, visit: 1, atZone: false, h: zt, l: low, ll: low, side: d, t: tq, entry: q.entry, stop: q.stop, target: q.target, r0: rq, zone: z, 'case': Mq['case'] };
          ts.log = [
            { t: z.known, text: NAME[zt] + ' CF ' + word(d) + ' of the ' + z.of + ': its zone runs ' + f2(z.lo) + ' to ' + f2(z.hi) + '. The SOP is repeated after the CF, one timeframe lower: the ' + NAME[low] + ' VR, then the ' + NAME[low] + ' CF inside this zone (no QM first).' + (wd == null ? '' : wd ? ' The zone is with the ' + NAME[up] + ' direction (' + word(ud) + ').' : ' The zone is AGAINST the ' + NAME[up] + ' direction (' + word(ud) + ').') },
            { t: Mq.vr.t + SEC[low], text: NAME[low] + ' VR: the first BO Structure (QM) against the ' + NAME[zt] + ' CF. The VR runs ' + f2(Mq.vr.lo) + ' to ' + f2(Mq.vr.hi) + '; its extreme ' + f2(Mq.vr.ext) + ' is the target.' },
            { t: Mq.cf.t + SEC[low], text: NAME[low] + ' CF' + (Mq.cf.again ? ' (a new one, after the first failed)' : '') + ': the BO Structure (QM) back with the ' + NAME[zt] + ' CF. Its zone ' + f2(Mq.cf.lo) + ' to ' + f2(Mq.cf.hi) + ' sits inside the ' + NAME[zt] + ' CF zone, clear of the VR.' },
            { t: tq, text: 'Price pulled back into the ' + NAME[low] + ' CF zone and an EG closed ' + word(d) + ': ' + word(d) + ' ' + f2(q.entry) + ', stop ' + f2(q.stop) + ' (' + U + f2(Zq.buf) + ' past the pullback\'s extreme, risk ' + U + f2(rq) + '), target ' + f2(q.target) + ' (the VR\'s extreme, ' + (Math.abs(q.target - q.entry) / rq).toFixed(1) + 'R).' }];
          ts.marks = [{ kind: 'zone', top: z.hi, bot: z.lo, a: z.known - SEC[zt], at: z.known, label: NAME[zt] + ' CF zone (parent)' },
            { kind: d > 0 ? 'vr' : 'bvr', top: Mq.vr.hi, bot: Mq.vr.lo, a: Mq.vr.t, at: Mq.vr.t + SEC[low], label: NAME[low] + ' VR' },
            { kind: 'zone', top: Mq.cf.hi, bot: Mq.cf.lo, a: Mq.cf.t, at: Mq.cf.t + SEC[low], label: NAME[low] + ' CF zone' }];
          rows.push(ts); break; } });
      var zs = []; zonesOf(zt, B, F, o).forEach(function (z) { zs.push(z); (z.visits || []).forEach(function (t, n) { var v = {}; for (var key in z) v[key] = z[key]; v.touch = t; v.visit = n + 2; zs.push(v); }); });
      // a CF zone or VR box the sequence handed over is often the very box of this chart's small break (the same level, the same
      // extreme): it is read first, so of two records of one order the one that says what the zone is (and keeps the
      // sequence's own target) is the one kept. With box 'candle' the order is as it was.
      (o.box === 'candle' ? zs.concat(sweepsOf(zt, B), own) : own.concat(zs, sweepsOf(zt, B))).filter(function (z) { return z.touch && z.touch + SEC[zt] > from - BARRIER_WATCH * SEC[ctf] && z.hi - z.lo > sizes(mk, z.hi).zmin && (!o.until || z.touch < o.until); }).forEach(function (z) {
        var d = z.dir, t0 = z.touch, h = z.hi - z.lo, i;
        // z.touch is the OPEN time of the barrier-timeframe candle that came back: the moment itself is read on the finest candles
        // that reach back to it, and the confirmation is looked for from the candle that holds that moment, never before it
        // (until 21 Nov 2026 a QM that closed earlier inside that candle, before price was at the barrier, was taken)
        var TF = fine.length && fine[0].time <= t0 ? fine : (B['5m'] || []), q = at(TF, t0), hit = -1;
        for (; q < TF.length && TF[q].time < t0 + SEC[zt]; q++) if (d < 0 ? TF[q].high >= z.lo : TF[q].low <= z.hi) { hit = q; break; }
        if (hit < 0) return; t0 = TF[hit].time;
        var start = Math.max(t0, z.wait || 0);   // a sweep is a sweep only once its candle closed back inside: the confirmation starts there
        // mode 'table' = the method's table (simple CF and Janda); 'm1' = the Janda's own M1 alternative (Janda only);
        // 'm5' = the owner's M5 confirmation of H4 and M15 barriers (simple CF and Janda)
        var run = function (ctf, C, mode) {
        var alt = mode === 'm1', m5 = mode === 'm5', a2 = mode === 'alt';
        var lim = start + BARRIER_WATCH * SEC[ctf], x = z.x0 != null ? z.x0 : d < 0 ? -Infinity : Infinity, sig = null, jan = null, xs = null;
        for (i = at(C, start - SEC[ctf] + 1); i < C.length && C[i].time < lim; i++) { var c = C[i]; if (o.until && c.time + SEC[ctf] > o.until) break; x = d < 0 ? Math.max(x, c.high) : Math.min(x, c.low);
          if (d < 0 ? c.close > z.hi + h : c.close < z.lo - h) break;                                  // closed well through the barrier: it did not hold
          // the QM is the break of the swing the last leg came from (swingEv); o.qm 'internal' = any newer small pivot, as before
          var W = C.slice(Math.max(0, i - 240), i + 1), ev = o.qm === 'internal' ? F.msInternal(W, W.length, 3) : swingEv(F, W), e = ev[ev.length - 1];
          if (!e || e.breakIdx !== W.length - 1) continue;
          if (!sig) { if (e.dir === d && e.structure && W[e.fromIdx].time >= t0 - 30 * SEC[ctf]) { sig = { i: i, level: e.level, t: c.time + SEC[ctf], close: c.close }; xs = x; } continue; }
          // after the QM: the next break the same way that is NOT another QM is the Janda's BO; a break the other way ends it
          if (e.dir !== d) break;
          if (!e.structure && (d > 0 ? e.level > sig.level : e.level < sig.level)) { jan = { i: i, level: e.level, t: c.time + SEC[ctf] };
            // the engulf zone inside this second BO's leg (the pages: "the engulfing candle within the 2nd BO"): the PAIR, the last
            // candle against the break at or before the leg's pullback extreme (out to that extreme) and the first candle after
            // it that closes beyond its far side (the candle that engulfs it); the limit rests at the pair's near side, which
            // must lie on the pullback side of the BO candle's close (no pair, or price already in it at the BO: no Janda)
            if (o.janda !== 'level') { var jz = F.msZones(W, [{ dir: d, fromIdx: e.fromIdx, breakIdx: e.breakIdx }], W.length)[0], jl = NaN, jh = NaN, je = -1, jq;
              if (jz) for (jq = jz.i + 1; jq <= e.breakIdx; jq++) if (d < 0 ? W[jq].close < W[jz.i].low : W[jq].close > W[jz.i].high) { je = jq; break; }
              if (je >= 0) { jl = Math.min(jz.lo, W[je].low); jh = Math.max(jz.hi, W[je].high); }
              var jp = d < 0 ? jl : jh;
              jan.zone = je >= 0 && (d < 0 ? jp > c.close : jp < c.close) ? { lo: jl, hi: jh, px: jp, t: W[jz.i].time } : null; }
            break; } }
        if (!sig && !(mode === 'tap' && TAP_FIRST[zt] && o.tapFirst !== false)) return;
        var cf = z.kind === 'cf', vr = z.kind === 'vr', sw = z.kind === 'sweep', eg = z.kind === 'eg', src = z.kind === 'bo' ? 'BO' : 'iBO', up = UP[zt], ud = up ? dirAt(up, t0) : 0, wd = ud ? ud === d : null, vn = z.visit || 1;
        // what every record of this barrier and confirmation timeframe shares: its name, the id and label parts, the first two log lines
        var name = cf ? NAME[zt] + ' CF barrier · ' + z.of : vr ? NAME[zt] + ' VR barrier · ' + z.of : sw ? NAME[zt] + ' sweep barrier · swing ' + (d < 0 ? 'high ' : 'low ') + f2(z.level) : eg ? NAME[zt] + ' EG barrier' : NAME[zt] + ' barrier · ' + src + ' origin';
        var idK = (cf ? 'cf-' : vr ? 'vr-' : sw ? 'sw-' : eg ? 'eg-' : '') + zt + '-' + (alt ? '1m-' : '') + (m5 ? 'm5-' : '') + (a2 ? (ctf === '30m' ? 'c30-' : 'c15-') : '') + (vn > 1 ? 'v' + vn + '-' : '');
        var labK = (m5 ? ' · M5 confirm' : '') + (a2 ? ' · ' + NAME[ctf] + ' confirm' : '') + (vn > 1 ? (vn === 2 ? ' · second visit' : ' · visit ' + vn) : ''), labD = wd == null ? '' : wd ? ' · with ' + NAME[up] : ' · against ' + NAME[up];
        var how = m5 ? (zt === '15m' ? ' (the second table\'s M5, besides the first table\'s ' + NAME[pair[1]] + ')' : ' (the owner\'s M5 confirmation, besides the table\'s ' + NAME[pair[1]] + ')') : a2 ? ' (the second table\'s ' + NAME[ctf] + ', besides the first table\'s ' + NAME[pair[1]] + ')' : '';
        var head = function () { return [
          { t: z.known, text: NAME[zt] + ' barrier: ' + (sw ? 'the swing ' + (d < 0 ? 'high ' : 'low ') + f2(z.level) + ' (a ' + word(d) + ' barrier once swept).' : 'a fresh ' + (d < 0 ? 'supply' : 'demand') + ' zone ' + f2(z.lo) + ' to ' + f2(z.hi) + (cf ? ', the CF zone of the ' + z.of + ' ' + word(d) + ' (the sequence\'s own entry, taken as a barrier).' : vr ? ', the VR box of the ' + z.of + ' ' + word(-d) + ', a range once its CF formed: a barrier the other way.' : (eg ? ', an engulf (EG) zone: the last ' + (d > 0 ? 'down' : 'up') + ' candle before a close ' + (d > 0 ? 'above its high.' : 'below its low.') : ', the origin of ' + (z.kind === 'bo' ? 'a BO' : 'an internal BO') + ' ' + word(d) + '.'))) },
          { t: t0, text: (sw ? 'Price swept the swing: a wick ' + (d < 0 ? 'above ' : 'below ') + f2(z.level) + ' to ' + f2(d < 0 ? z.hi : z.lo) + ', and the ' + NAME[zt] + ' candle closed back ' + (d < 0 ? 'at or below' : 'at or above') + ' it. The sweep barrier runs ' + f2(z.lo) + ' to ' + f2(z.hi) + '.' : vn > 1 ? 'Price left the barrier and came back to it (visit ' + vn + ').' : 'Price came back to the barrier for the first time.') + ' Its confirmation is read on ' + NAME[ctf] + how + '.' + (wd == null ? '' : wd ? ' The barrier is with the ' + NAME[up] + ' direction (' + word(ud) + ').' : ' The barrier is AGAINST the ' + NAME[up] + ' direction (' + word(ud) + '): the method expects only a rejection from it.') }]; };
        var zoneMark = { kind: 'zone', top: z.hi, bot: z.lo, a: z.known - SEC[zt], at: z.wait || z.known, label: NAME[zt] + (cf ? ' CF zone (barrier)' : vr ? ' VR box (barrier)' : sw ? ' sweep barrier' : eg ? ' EG zone (barrier)' : ' barrier') };
        // the limits: at the level the confirmation broke and, for the simple CF, at the barrier zone's near side (the owner's
        // reading): placed only when the QM's candle closed outside the zone, never the same price as the level's limit.
        // The Janda's limit rests at the engulf zone inside its second BO's leg (o.janda 'level': at the level that BO broke).
        // 22 Nov 2026 (owner, on a GBP/USD chart: "when tap he could wait M1 BO buy to take the trade, SL at M1 BO low"): at the
        // tap of a barrier, the first M1 BO Structure with the barrier is the entry, at that candle's close (a market entry, no
        // pullback limit); stop past the low (high for a sell) the BO came from, the extreme made at the barrier; target the
        // desk's barrier target (the owner named none). A reading of its own: id "bar-tap-", label "· M1 BO at the tap".
        var tapHi = null;
        if (mode === 'tap' && TAP_FIRST[zt] && o.tapFirst !== false) {
          // the M15 BO first (the same QM test as the table's confirmation), then the pullback, then the M1 BO
          var hc = TAP_FIRST[zt], H = B[hc] || [], hb = null, hx = d < 0 ? -Infinity : Infinity;
          for (var hi_ = at(H, start - SEC[hc] + 1); hi_ < H.length && H[hi_].time < start + BARRIER_WATCH * SEC[hc]; hi_++) { var hcn = H[hi_]; if (o.until && hcn.time + SEC[hc] > o.until) break;
            hx = d < 0 ? Math.max(hx, hcn.high) : Math.min(hx, hcn.low);
            if (d < 0 ? hcn.close > z.hi + h : hcn.close < z.lo - h) break;
            var HW = H.slice(Math.max(0, hi_ - 240), hi_ + 1), hev = swingEv(F, HW), he = hev[hev.length - 1];
            if (he && he.breakIdx === HW.length - 1 && he.dir === d && he.structure && HW[he.fromIdx].time >= t0 - 30 * SEC[hc]) { hb = { t: hcn.time + SEC[hc], level: he.level, x: hx }; break; } }
          if (!hb) return;
          var M = C, pe = d < 0 ? -Infinity : Infinity, mb = null;
          for (i = at(M, hb.t); i < M.length && M[i].time < hb.t + BARRIER_FILL * SEC[hc]; i++) { var mc = M[i]; if (o.until && mc.time + 60 > o.until) break;
            pe = d < 0 ? Math.max(pe, mc.high) : Math.min(pe, mc.low);
            if (d < 0 ? mc.close > hb.x : mc.close < hb.x) break;                    // closed past the extreme made at the barrier: no trade
            var MW = M.slice(Math.max(0, i - 240), i + 1), mev = swingEv(F, MW), me = mev[mev.length - 1];
            if (me && me.breakIdx === MW.length - 1 && me.dir === d && me.structure && MW[me.fromIdx].time >= hb.t) { mb = { t: mc.time + 60, level: me.level, close: mc.close, x: pe }; break; } }
          if (!mb) return;
          tapHi = hb; sig = { t: mb.t, level: mb.level, close: mb.close }; xs = mb.x; }
        if (mode === 'tap') { var Zt = sizes(mk, sig.close), et = sig.close, st_ = d < 0 ? xs + Zt.buf : xs - Zt.buf, rt = Math.abs(et - st_);
          if (!(sig.t >= from) || !(rt > Zt.rmin) || rt > Zt.rmax || (d < 0 ? st_ <= et : st_ >= et)) return;
          var tt = { id: pre + 'bar-tap-' + idK + (d > 0 ? 'b' : 's') + sig.t, market: mk, kind: 'barrier', label: name + (tapHi ? ' · M15+M1 BO' : ' · M1 BO at the tap') + labK + labD,
            withDir: wd, janda: false, jandaM1: false, m5: false, alt: null, tap: true, mkt: true, sweep: sw, eg: eg, visit: vn, atZone: false, h: zt, l: ctf, side: d, t: sig.t, entry: et, stop: st_, target: d < 0 ? et - BR * rt : et + BR * rt, r0: rt, zone: z };
          tt.log = head().concat((tapHi ? [{ t: tapHi.t, text: NAME[TAP_FIRST[zt]] + ' BO ' + word(d) + ': a QM (BO Structure), a candle closed ' + (d > 0 ? 'above ' : 'below ') + f2(tapHi.level) + '. Now a pullback and an M1 BO are waited for.' }] : []).concat([{ t: sig.t, text: (tapHi ? 'After the pullback, the ' : '') + 'M1 BO ' + word(d) + (tapHi ? ' with the barrier: a candle closed ' : ' at the tap: a candle closed ') + (d > 0 ? 'above ' : 'below ') + f2(sig.level) + '. ' + word(d).charAt(0).toUpperCase() + word(d).slice(1) + ' at that close ' + f2(et) + ', stop ' + f2(st_) + ' (' + U + f2(Zt.buf) + ' past the M1 BO\'s ' + (d > 0 ? 'low ' : 'high ') + f2(xs) + ', risk ' + U + f2(rt) + '), target ' + f2(tt.target) + ' (' + BR + 'R: the replay\'s own choice, no target was named).' }]));
          tt.marks = [zoneMark].concat(tapHi ? [{ kind: 'level', p: tapHi.level, a: t0, at: tapHi.t, label: NAME[TAP_FIRST[zt]] + ' BO', under: d < 0 }] : []).concat([{ kind: 'level', p: sig.level, a: t0, at: sig.t, label: 'M1 BO', under: d < 0 }, { kind: 'level', p: xs, a: t0, at: sig.t, label: 'M1 BO ' + (d > 0 ? 'low' : 'high') + ' · stop', under: d > 0 }]);
          rows.push(tt); return; }
        var nearPx = d < 0 ? z.lo : z.hi, legs = [];
        (alt ? [] : [{ j: false, s: sig, x: xs }]).concat([{ j: true, s: jan, x: x }]).forEach(function (m) {
          if (!m.s) return;
          if (m.j && o.janda !== 'level') { if (m.s.zone) legs.push({ m: m, px: m.s.zone.px, zn: false, jz: m.s.zone }); return; }
          legs.push({ m: m, px: m.s.level, zn: false });
          if (!m.j && (d < 0 ? sig.close < nearPx : sig.close > nearPx) && Math.abs(nearPx - m.s.level) > 1e-9 * Math.abs(nearPx)) legs.push({ m: m, px: nearPx, zn: true }); });
        legs.forEach(function (lg) { var m = lg.m, px = lg.px, zn = lg.zn, jz = lg.jz;
          // the pullback entry: a limit for the next BARRIER_FILL confirmation candles, read on the finest candles
          var xx = m.x, end = m.s.t + BARRIER_FILL * SEC[ctf], fi = -1, k;
          for (k = at(fine, m.s.t); k < fine.length && fine[k].time < end; k++) { var b = fine[k]; if (o.until && b.time + SEC[fk] > o.until) break;
            if (d < 0 ? b.high >= px : b.low <= px) { fi = k; break; }
            xx = d < 0 ? Math.max(xx, b.high) : Math.min(xx, b.low); }
          if (fi < 0 || !(fine[fi].time >= from)) return;
          // the sequence's own rule for its CF: no entry once price has reached the VR's extreme (the target) since the CF was
          // known; the move is done (read on the finest candles before the fill)
          if (cf && isFinite(z.tgt)) { for (k = at(fine, z.known); k < fi; k++) if (d > 0 ? fine[k].high >= z.tgt : fine[k].low <= z.tgt) return; }
          var entry = px, Z0 = sizes(mk, entry), stop = d < 0 ? xx + Z0.buf : xx - Z0.buf, r0 = Math.abs(entry - stop); if (!(r0 > Z0.rmin) || r0 > Z0.rmax || (d < 0 ? stop <= entry : stop >= entry)) return;
          var tr = { id: pre + 'bar-' + (m.j ? 'j-' : '') + idK + (zn ? 'z-' : '') + (d > 0 ? 'b' : 's') + fine[fi].time, market: mk, kind: 'barrier',
            label: name + (m.j ? ' · Janda' + (alt ? ' (M1)' : '') : '') + labK + (zn ? ' · at the zone' : '') + labD,
            withDir: wd, janda: m.j, jandaM1: !!alt, m5: m5, alt: a2 ? ctf : null, sweep: sw, eg: eg, visit: vn, atZone: zn, h: zt, l: ctf, side: d, t: fine[fi].time, entry: entry, stop: stop, target: d < 0 ? entry - BR * r0 : entry + BR * r0, r0: r0, zone: z };
          // a CF barrier keeps the sequence's own target, the VR's extreme; a VR barrier the CF zone's near side (the other side
          // of the range): each only when at least 1R away on the winning side, else the replay's BR
          var own1 = (cf || vr) && isFinite(z.tgt) && d * (z.tgt - entry) >= r0; if (own1) tr.target = z.tgt;
          tr.log = head().concat([
            { t: sig.t, text: NAME[ctf] + ' CF: a QM (BO Structure) ' + word(d) + ', a candle closed ' + (d > 0 ? 'above ' : 'below ') + f2(sig.level) + '.' + (m.j ? '' : zn ? ' A ' + word(d) + ' limit rests at the barrier zone\'s near side ' + f2(entry) + ' for the pullback.' : ' A ' + word(d) + ' limit rests at that level for the pullback.') }]);
          if (m.j) tr.log.push({ t: m.s.t, text: NAME[ctf] + ' Janda: the next break ' + word(d) + ' is a normal BO, a candle closed ' + (d > 0 ? 'above ' : 'below ') + f2(m.s.level) + '. ' + (jz ? 'The engulf zone inside that BO\'s leg runs ' + f2(jz.lo) + ' to ' + f2(jz.hi) + ': a ' + word(d) + ' limit rests at its near side ' + f2(entry) + ' for the pullback.' : 'A ' + word(d) + ' limit rests at that level for the pullback.') });
          tr.log.push({ t: tr.t, text: 'Price pulled back to the ' + (jz ? 'engulf zone' : zn ? 'zone\'s near side' : 'level') + ': ' + word(d) + ' ' + f2(entry) + ', stop ' + f2(stop) + ' (' + U + f2(Z0.buf) + ' past the extreme ' + f2(xx) + ' made at the barrier, risk ' + U + f2(r0) + '), target ' + f2(tr.target) + (own1 ? (cf ? ' (the VR\'s extreme, ' : ' (the CF zone, the other side of the range, ') + (Math.abs(tr.target - entry) / r0).toFixed(1) + 'R).' : ' (' + BR + 'R: the replay\'s own choice, the method names no fixed target here).') });
          tr.marks = [zoneMark,
            { kind: 'level', p: sig.level, a: t0, at: sig.t, label: NAME[ctf] + ' CF (QM)', under: d < 0 }];
          if (m.j) tr.marks.push({ kind: 'level', p: m.s.level, a: sig.t, at: m.s.t, label: NAME[ctf] + ' Janda BO', under: d < 0 });
          if (jz) tr.marks.push({ kind: 'zone', top: jz.hi, bot: jz.lo, a: jz.t, at: m.s.t, label: NAME[ctf] + ' Janda EG zone' });
          if (zn) tr.marks.push({ kind: 'level', p: entry, a: sig.t, at: sig.t, label: 'Zone\'s near side · entry', under: d > 0 });
          tr.marks.push({ kind: 'level', p: xx, a: t0, at: m.s.t, label: 'Extreme at the barrier', under: d > 0 });
          rows.push(tr);
        });
        // REPEAT THE SOP (21 Nov 2026, the pages' second "best confirmation"): the QM at the barrier is read as a BO, and its VR
        // (the first BO Structure against it) and CF (the BO Structure back with it) are waited for one timeframe lower; the
        // entry is the sequence's own (the pullback into the CF zone, then an EG; stop past the pullback's extreme; target the
        // VR's extreme). A CF inside the VR is skipped, as in the sequence. Walked one closed lower candle at a time: the small
        // breaks are read once on candles from 240 before the QM (an event at a candle reads nothing after it) and the entry is
        // taken only AT the candle whose close is its EG. One record a barrier visit and confirmation timeframe. The wait ends
        // with a close through the extreme the QM was made from, or once the move ran past the VR with no entry.
        var low = LOWER[ctf], Lc = low ? (B[low] || []) : [];
        if (alt || o.rsop === false || !Lc.length || z.kind === 'cf') return;   // a CF zone has its own repeat, after the CF with no QM (above)
        var k0 = at(Lc, sig.t), a0 = Math.max(0, k0 - 240), kEnd = Math.min(Lc.length, at(Lc, sig.t + BARRIER_WATCH * SEC[ctf])), Wl = Lc.slice(a0, kEnd), EV = smallEv(F, Wl), ei = 0, evs = [];
        var cq = at(C, sig.t), qf = null;
        for (var kk = k0; kk < kEnd; kk++) { var lc = Lc[kk]; if (o.until && lc.time + SEC[low] > o.until) break;
          if (d > 0 ? lc.close < xs : lc.close > xs) break;   // a close through the extreme the QM was made from: the QM no longer stands
          while (ei < EV.length && EV[ei].t <= lc.time) evs.push(EV[ei++]);
          var Mq = F.msMosha({ dir: d, level: sig.level, t: sig.t - SEC[low], ext: NaN, far: xs }, { events: evs, bars: Wl.slice(0, kk - a0 + 1) }, sizes(mk, lc.close).buf, { near: true });
          if (!Mq || !Mq.vr) continue;
          // 22 Nov 2026 (owner, on a GBP/USD buy of 20 Nov: "this should be a sell", "there is no new BO, the recent high closed
          // below"): at a barrier AGAINST the direction of the timeframe above, once a candle of the confirmation timeframe, after
          // the VR, closes back through the QM level, the QM made no new BO and its repeat is over (o.fail false = as before; a
          // barrier with the direction is unchanged: there a pullback through the QM level is the sequence's own). That close is
          // the CF with the direction: the trade is taken that way at that close, stop past the VR's extreme
          // (the top the rejection made), target the last low (high) made since price came back to the barrier.
          if (o.fail !== false && wd === false) { while (!qf && cq < C.length && C[cq].time + SEC[ctf] <= lc.time + SEC[low]) { var cb = C[cq++]; if (cb.time >= Mq.vr.t && (d > 0 ? cb.close < sig.level : cb.close > sig.level)) qf = cb; }
            if (qf) { { var tf_ = qf.time + SEC[ctf], Zf = sizes(mk, qf.close), ef = qf.close, sf = d > 0 ? Mq.vr.ext + Zf.buf : Mq.vr.ext - Zf.buf, rf = Math.abs(ef - sf), tg = NaN, ci;
                for (ci = at(C, t0); ci < cq; ci++) tg = d > 0 ? (tg < C[ci].low ? tg : C[ci].low) : (tg > C[ci].high ? tg : C[ci].high);
                if (tf_ >= from && rf > Zf.rmin && rf <= Zf.rmax && (d > 0 ? sf > ef && tg < ef : sf < ef && tg > ef)) {
                  var tfl = { id: pre + 'bar-sop-f-' + idK + (d > 0 ? 's' : 'b') + tf_, market: mk, kind: 'barrier', label: name + ' · QM failed · with ' + NAME[up] + labK,
                    withDir: true, janda: false, jandaM1: false, m5: m5, alt: a2 ? ctf : null, rsop: true, qmFail: true, mkt: true, sweep: sw, eg: eg, visit: vn, atZone: false, h: zt, l: ctf, ll: low, side: -d, t: tf_, entry: ef, stop: sf, target: tg, r0: rf, zone: z };
                  tfl.log = head().concat([
                    { t: sig.t, text: NAME[ctf] + ' QM ' + word(d) + ' at the barrier, a candle closed ' + (d > 0 ? 'above ' : 'below ') + f2(sig.level) + '.' },
                    { t: Mq.vr.t + SEC[low], text: NAME[low] + ' VR: the first BO Structure against that QM. The VR runs ' + f2(Mq.vr.lo) + ' to ' + f2(Mq.vr.hi) + '.' },
                    { t: tf_, text: 'No new BO ' + word(d) + ': a ' + NAME[ctf] + ' candle closed back ' + (d > 0 ? 'below ' : 'above ') + f2(sig.level) + '. The barrier is against the ' + NAME[up] + ' direction, so this close is the CF with it: ' + word(-d) + ' ' + f2(ef) + ', stop ' + f2(sf) + ' (' + U + f2(Zf.buf) + ' past the VR\'s extreme, risk ' + U + f2(rf) + '), target ' + f2(tg) + ' (the last ' + (d > 0 ? 'low' : 'high') + ' since price came back to the barrier, ' + (Math.abs(tg - ef) / rf).toFixed(1) + 'R).' }]);
                  tfl.marks = [zoneMark, { kind: 'level', p: sig.level, a: t0, at: sig.t, label: NAME[ctf] + ' QM (failed)', under: d < 0 },
                    { kind: d > 0 ? 'vr' : 'bvr', top: Mq.vr.hi, bot: Mq.vr.lo, a: Mq.vr.t, at: Mq.vr.t + SEC[low], label: NAME[low] + ' VR' },
                    { kind: 'level', p: tg, a: t0, at: tf_, label: (d > 0 ? 'Last low' : 'Last high') + ' · target', under: d > 0 }];
                  rows.push(tfl); } }
              break; } }
          if (Mq.state === 'bo-on' || Mq.state === 'vr-broken') break;   // the move went on past the VR with no entry: this repeat is over
          if (!Mq.trade || Mq.trade.fillT !== lc.time || Mq['case'] === 2) continue;
          var q = Mq.trade, tq = lc.time + SEC[low], Zq = sizes(mk, q.entry), rq = Math.abs(q.entry - q.stop);
          if (!(tq >= from) || !(rq > Zq.rmin) || rq > Zq.rmax || (d < 0 ? q.stop <= q.entry || q.target >= q.entry : q.stop >= q.entry || q.target <= q.entry)) break;
          var ts = { id: pre + 'bar-sop-' + idK + (d > 0 ? 'b' : 's') + tq, market: mk, kind: 'barrier', label: name + ' · repeat SOP' + labK + labD,
            withDir: wd, janda: false, jandaM1: false, m5: m5, alt: a2 ? ctf : null, rsop: true, mkt: true, sweep: sw, eg: eg, visit: vn, atZone: false, h: zt, l: ctf, ll: low, side: d, t: tq, entry: q.entry, stop: q.stop, target: q.target, r0: rq, zone: z, 'case': Mq['case'] };
          ts.log = head().concat([
            { t: sig.t, text: NAME[ctf] + ' CF: a QM (BO Structure) ' + word(d) + ', a candle closed ' + (d > 0 ? 'above ' : 'below ') + f2(sig.level) + '. The SOP is repeated one timeframe lower: a ' + NAME[low] + ' VR and its CF are waited for.' },
            { t: Mq.vr.t + SEC[low], text: NAME[low] + ' VR: the first BO Structure (QM) against the ' + NAME[ctf] + ' QM. The VR runs ' + f2(Mq.vr.lo) + ' to ' + f2(Mq.vr.hi) + '; its extreme ' + f2(Mq.vr.ext) + ' is the target.' },
            { t: Mq.cf.t + SEC[low], text: NAME[low] + ' CF' + (Mq.cf.again ? ' (a new one, after the first failed)' : '') + ': the BO Structure (QM) back with the ' + NAME[ctf] + ' QM. The CF zone is ' + f2(Mq.cf.lo) + ' to ' + f2(Mq.cf.hi) + ', clear of the VR.' },
            { t: tq, text: 'Price pulled back into the CF zone and an EG closed ' + word(d) + ': ' + word(d) + ' ' + f2(q.entry) + ', stop ' + f2(q.stop) + ' (' + U + f2(Zq.buf) + ' past the pullback\'s extreme, risk ' + U + f2(rq) + '), target ' + f2(q.target) + ' (the VR\'s extreme, ' + (Math.abs(q.target - q.entry) / rq).toFixed(1) + 'R).' }]);
          ts.marks = [zoneMark, { kind: 'level', p: sig.level, a: t0, at: sig.t, label: NAME[ctf] + ' CF (QM)', under: d < 0 },
            { kind: d > 0 ? 'vr' : 'bvr', top: Mq.vr.hi, bot: Mq.vr.lo, a: Mq.vr.t, at: Mq.vr.t + SEC[low], label: NAME[low] + ' VR' },
            { kind: 'zone', top: Mq.cf.hi, bot: Mq.cf.lo, a: Mq.cf.t, at: Mq.cf.t + SEC[low], label: NAME[low] + ' CF zone' }];
          rows.push(ts); break; }
        };
        if (C.length) { run(ctf, C, 'table'); if (JANDA_ALT[zt] && (B['1m'] || []).length) run('1m', B['1m'], 'm1'); }
        if (M5_ALT[zt] && (B['5m'] || []).length) run('5m', B['5m'], 'm5');
        if (o.tap !== false && o.box !== 'candle' && (B['1m'] || []).length) run('1m', B['1m'], 'tap');
        if (o.table2 !== false && ALT2[zt] && (B[ALT2[zt]] || []).length) run(ALT2[zt], B[ALT2[zt]], 'alt');
      });
    });
    rows.sort(function (a, b) { return a.t - b.t; });
    // barriers of two timeframes often overlap: one entry a side within 20 minutes, per reading (a simple CF and a Janda are two
    // entries; so is each of the owner's readings of 21 Nov 2026, compared only with its own kind, so the older records stay as they were)
    var sigOf = function (r) { return [r.janda, !!r.jandaM1, !!r.m5, !!r.atZone, (r.visit || 1) > 1, !!r.sweep, r.alt || '', !!r.rsop, r.h === '30m', !!r.eg, !!r.qmFail, !!r.tap].join('|'); };
    var isNew = function (r) { return !!(r.jandaM1 || r.m5 || r.atZone || (r.visit || 1) > 1 || r.sweep || r.alt || r.rsop || r.h === '30m' || r.eg || r.tap); };   // an M1 Janda is a reading of its own too
    var keep = []; rows.forEach(function (r) { if (!keep.some(function (k) { return k.side === r.side && sigOf(k) === sigOf(r) && Math.abs(k.t - r.t) < 1200; })) keep.push(r); });
    // and a new reading that gives exactly an order already recorded (same side, price and fill) is not recorded twice
    var olds = keep.filter(function (r) { return !isNew(r); }), out = olds.slice();
    keep.filter(isNew).forEach(function (r) { if (!out.some(function (k) { return k.side === r.side && k.t === r.t && Math.abs(k.entry - r.entry) <= 1e-9 * Math.abs(r.entry); })) out.push(r); });
    out.sort(function (a, b) { return a.t - b.t; });
    // the finest candles may start after an entry (one-minute history is short): such a trade is read on the 5-minute candles,
    // never on candles that begin weeks later (22 Nov 2026: a repeat-SOP entry from before them was booked at their first candle)
    out.forEach(function (tr) { finish(tr, outcome(tr, fine.length && fine[0].time <= tr.t ? fine : (B['5m'] || []), tr.t, !tr.mkt)); });   // a limit's fill candle can only stop it; the repeat-SOP entry is at a close
    return out;
  }
  function finish(tr, oc) {
    tr.status = oc.status; tr.R = oc.R; tr.endT = oc.endT; tr.exit = oc.exit; tr.mfe = oc.mfe; tr['float'] = oc['float'];
    tr.log.push(oc.status === 'target' ? { t: oc.endT, text: 'Target reached: ' + (tr.R >= 0 ? '+' : '') + tr.R.toFixed(2) + 'R.' }
      : oc.status === 'stopped' ? { t: oc.endT, text: 'Stopped: ' + (tr.R > 0 ? '+' : '−') + Math.abs(tr.R).toFixed(2) + 'R' + (tr.R < -1.005 ? ' (the candle opened beyond the stop)' : '') + (oc.mfe >= 1 ? ' after running +' + oc.mfe.toFixed(1) + 'R first.' : '.') }
      : { t: null, text: 'Still open on the last candle read' + (oc['float'] != null ? ' (' + (oc['float'] >= 0 ? '+' : '−') + Math.abs(oc['float']).toFixed(2) + 'R now).' : '.') });
  }
  // After costs (26 Nov 2026, owner: "on all edges add the option after costs"). Display only. One round trip a trade, in price
  // units, taken off the R on the risk the trade opened with: the demo broker's measured figures where the desk has them (gold,
  // the majors, the Nasdaq), ASSUMED for the rest (the studies' own cost table).
  // No financing. The choice lives in memory for the visit (window.MS_DESK_COSTS), shared by every desk; nothing is stored.
  var COSTS = { xau: 0.30, xag: 0.03, eurusd: 0.00006, gbpusd: 0.00008, usdjpy: 0.008, audusd: 0.00006, nzdusd: 0.00007, usdcad: 0.00007, usdchf: 0.00007,
    eurjpy: 0.010, gbpjpy: 0.014, audjpy: 0.010, cadjpy: 0.010, eurgbp: 0.00009, euraud: 0.00013, nas100: 1.0, spx500: 0.4, us30: 3, de40: 1.5 };
  function costR(r) { var c = COSTS[r.market || 'xau'], d = Math.abs(r.entry - r.stop); return c > 0 && d > 0 ? c / d : 0; }
  function costsOn() { return typeof window !== 'undefined' && !!window.MS_DESK_COSTS; }
  function costsSet(v) { if (typeof window !== 'undefined') window.MS_DESK_COSTS = !!v; }
  function costed(rows, on) { if (!(on === undefined ? costsOn() : on)) return rows || [];
    return (rows || []).map(function (r) { var c = costR(r), o = {}; for (var k in r) o[k] = r[k]; o.costR = c; if (r.R != null) { o.grossR = r.R; o.R = r.R - c; } if (r['float'] != null) o['float'] = r['float'] - c; return o; }); }
  function costsBtn(attr) { return '<button type="button" class="mo-sop-b" ' + attr + ' aria-pressed="' + costsOn() + '" title="Take one round-trip cost off every trade">After costs</button>'; }
  function costsWord() { return costsOn() ? 'after costs' : 'before costs'; }
  function summary(rows) {
    var cl = rows.filter(function (r) { return r.R != null; }), n = cl.length, sum = cl.reduce(function (s, r) { return s + r.R; }, 0), m = n ? sum / n : 0, t = null;
    if (n > 1) { var v = cl.reduce(function (s, r) { return s + (r.R - m) * (r.R - m); }, 0) / (n - 1); t = v > 0 ? m / Math.sqrt(v / n) : null; }
    return { n: rows.length, closed: n, open: rows.length - n, wins: cl.filter(function (r) { return r.R > 0; }).length, total: sum, mean: n ? m : null, t: t };
  }
  // closed R by the UTC day a trade ended, for the desk's calendar; open trades are never added in
  function byDay(rows) {
    var m = {}; rows.forEach(function (r) { if (r.R == null || !r.endT) return; var d = new Date(r.endT * 1000).toISOString().slice(0, 10), x = m[d] || (m[d] = { day: d, n: 0, R: 0 }); x.n++; x.R += r.R; });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  // P&L calendar (21 Nov 2026, owner: "Calendar as well"): one month of closed R by the UTC day a trade ended, like the ICT desk's.
  // calMonth is pure; calHTML writes the month grid, its arrows and the chosen day's trades (chartAttr = the desk's own "Chart" hook).
  function calMonth(rows, ym) {
    var days = byDay(rows), by = {}, months = []; days.forEach(function (d) { by[d.day] = d; var m = d.day.slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
    if (!months.length) return { ym: null, months: [], cells: [], n: 0, R: 0 };
    if (months.indexOf(ym) < 0) ym = months[months.length - 1];
    var y = +ym.slice(0, 4), mo = +ym.slice(5, 7), first = new Date(Date.UTC(y, mo - 1, 1)), len = new Date(Date.UTC(y, mo, 0)).getUTCDate(), lead = (first.getUTCDay() + 6) % 7, cells = [], n = 0, R = 0, max = 0, i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (i = 1; i <= len; i++) { var key = ym + '-' + (i < 10 ? '0' : '') + i, d = by[key], wd = new Date(Date.UTC(y, mo - 1, i)).getUTCDay(); cells.push({ day: key, d: i, n: d ? d.n : 0, R: d ? d.R : 0, we: wd === 0 || wd === 6 }); if (d) { n += d.n; R += d.R; max = Math.max(max, Math.abs(d.R)); } }
    var at = months.indexOf(ym);
    return { ym: ym, label: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), months: months, prev: at > 0 ? months[at - 1] : null, next: at < months.length - 1 ? months[at + 1] : null, cells: cells, n: n, R: R, max: max };
  }
  function calHTML(rows, st, chartAttr, nameOf) {
    var e = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var r2 = function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; }, rc = function (v) { var a = Math.abs(v); return (v > 0 ? '+' : v < 0 ? '−' : '') + (a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2)); };
    var M = calMonth(rows, st.calM); if (!M.ym) return ''; st.calM = M.ym; var today = new Date().toISOString().slice(0, 10);
    var nav = '<span class="mo-cal-nav"><button type="button" class="mo-sop-b" data-cal-m="' + (M.prev || '') + '"' + (M.prev ? '' : ' disabled') + ' aria-label="Previous month">‹</button><b aria-live="polite">' + e(M.label) + ' <small class="' + (M.R > 0 ? 'pos' : M.R < 0 ? 'neg' : '') + '">' + (M.n ? r2(M.R) + ' · ' + M.n + (M.n === 1 ? ' trade' : ' trades') : 'no closed trades') + '</small></b><button type="button" class="mo-sop-b" data-cal-m="' + (M.next || '') + '"' + (M.next ? '' : ' disabled') + ' aria-label="Next month">›</button></span>';
    var grid = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) { return '<span class="mo-cal-h">' + d + '</span>'; }).join('') + M.cells.map(function (c) {
      if (!c) return '<span></span>';
      return '<button type="button" class="mo-cal-d' + (c.n ? (c.R > 0 ? ' up' : c.R < 0 ? ' dn' : '') : '') + (c.we ? ' we' : '') + (c.day === today ? ' today' : '') + (st.calDay === c.day ? ' sel' : '') + '"' + (c.n ? ' data-cal-day="' + c.day + '" style="--heat:' + (M.max ? Math.min(1, Math.abs(c.R) / M.max).toFixed(2) : 0) + '"' : ' disabled') +
        ' aria-label="' + e(c.day + (c.n ? ': ' + r2(c.R) + ' on ' + c.n + (c.n === 1 ? ' trade' : ' trades') : ': no closed trade')) + '"><span class="d">' + c.d + '</span>' + (c.n ? '<b>' + rc(c.R) + '</b><small>' + c.n + (c.n === 1 ? ' trade' : ' trades') + '</small>' : '') + '</button>'; }).join('');
    var list = '';
    if (st.calDay && st.calDay.slice(0, 7) === M.ym) { var day = rows.filter(function (r) { return r.R != null && r.endT && new Date(r.endT * 1000).toISOString().slice(0, 10) === st.calDay; }).sort(function (a, b) { return a.endT - b.endT; });
      list = '<ul class="mo-cal-day">' + day.map(function (r) { return '<li ' + chartAttr + '="' + e(r.id) + '" title="Open this trade on the chart"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span><span>' + e(nameOf ? nameOf(r) : '') + '</span><b class="' + (r.R > 0 ? 'pos' : r.R < 0 ? 'neg' : '') + '">' + r2(r.R) + '</b><small>ended ' + utc(r.endT) + '</small><button type="button" class="mo-sop-b" ' + chartAttr + '="' + e(r.id) + '">Chart</button></li>'; }).join('') + '</ul>'; }
    return '<h3 class="mo-sop-h mo-cal-k">P&amp;L calendar <small>closed R by the UTC day each trade ended · open trades not added in · ' + costsWord() + '</small>' + nav + '</h3><div class="mo-cal">' + grid + '</div>' + list;
  }
  // The barrier with its OLDER, higher target, kept as a reading of its own beside the current one (owner, 22 Nov 2026: "add the
  // old barrier as different separate", "the old barrier I mean is the one with higher R"): the SAME barrier entries as the
  // current reading (same zones, confirmations, entry and stop), with the 3R target the desk used until 22 Nov 2026 instead of
  // 1R. Entries whose target is not the fixed one (a CF / VR barrier's structural target, the repeat of the SOP, a failed QM)
  // are the same trade under both and are not recorded twice. Ids "bar-old-…", label "· 3R target", flag `old`; never compared
  // with a current record (joined after the current list, its own reading in the 20-minute rule).
  var OLD_BARRIER = { rr: 3 };
  function oldBarrierTrades(B, F, o) {
    o = o || {}; var q = { from: o.from, market: o.market, until: o.until, extra: o.extra, rr: OLD_BARRIER.rr, tapFirst: o.tapFirst };
    return uniq(barrierTrades(B, F, q)).filter(function (r) { return Math.abs(Math.abs(r.target - r.entry) / r.r0 - OLD_BARRIER.rr) < 1e-6; })
      .map(function (r) { r.id = String(r.id).replace('bar-', 'bar-old-'); r.old = true; r.label = (r.label || '') + ' · 3R target'; return r; });
  }
  // the same barrier entries with a 6R target (owner, 22 Nov 2026: "Yes add the 6r target", after a 60-day look at 3R to 6R on
  // gold, EUR/USD and GBP/USD before costs, where 6R did best; picked in sample, not a tested result). Ids "bar-r6-…", label
  // "· 6R target", flag `r6`; a reading of its own beside the 1R and 3R ones, never compared with them in the 20-minute rule.
  var R6_BARRIER = { rr: 6 };
  function r6BarrierTrades(B, F, o) {
    o = o || {}; var q = { from: o.from, market: o.market, until: o.until, extra: o.extra, rr: R6_BARRIER.rr, tapFirst: o.tapFirst };
    return uniq(barrierTrades(B, F, q)).filter(function (r) { return Math.abs(Math.abs(r.target - r.entry) / r.r0 - R6_BARRIER.rr) < 1e-6; })
      .map(function (r) { r.id = String(r.id).replace('bar-', 'bar-r6-'); r.r6 = true; r.label = (r.label || '') + ' · 6R target'; return r; });
  }
  // which of the owner's readings of 21 Nov 2026 a barrier record is, from its flags or, for a stored record, from its id
  function readings(r) {
    var id0 = String(r.id || ''), old = !!r.old || /(^|:)bar-old-/.test(id0), r6 = !!r.r6 || /(^|:)bar-r6-/.test(id0), id1 = id0.replace('bar-old-', 'bar-').replace('bar-r6-', 'bar-'), id = id1.replace('bar-sop-f-', 'bar-sop-').replace('bar-tap-', 'bar-'), v = /-v(\d+)-/.exec(id);
    var c = /-c(30|15)-/.exec(id);
    return { old: old, r6: r6, sweep: !!r.sweep || /bar-(j-|sop-)?sw-/.test(id), eg: !!r.eg || /bar-(j-|sop-)?eg-/.test(id), m5: !!r.m5 || /-m5-/.test(id), atZone: !!r.atZone || /-z-[bs]?\d+$/.test(id), visit: r.visit > 1 ? r.visit : v ? +v[1] : 1,
      alt: r.alt || (c ? c[1] + 'm' : null), rsop: !!r.rsop || /bar-sop-/.test(id), qmFail: !!r.qmFail || /bar-sop-f-/.test(id1), tap: !!r.tap || /bar-tap-/.test(id1), m30: r.h === '30m' || /bar-(j-|sop-)?((cf|vr|sw|eg)-)?30m-/.test(id) };
  }
  // a stored record's log and chart marks live in one file per UTC day of its entry (council/desk-store.mjs, 21 Nov 2026):
  // read only when a trade's log or chart is opened. A record that already carries them (an older file, a browser replay) is
  // handed back as it is; a day file that cannot be read leaves them empty and says so.
  function withDetail(detail, r) {
    if (!r || r.log) return Promise.resolve(r);
    if (!detail || !detail.dir) { r.log = []; r.marks = r.marks || []; return Promise.resolve(r); }
    var D = root.msData, day = new Date(r.t * 1000).toISOString().slice(0, 10);
    if (!D || typeof D.json !== 'function') { r.log = []; r.marks = []; return Promise.resolve(r); }
    return Promise.resolve(D.json(detail.dir + '/' + day + '.json')).then(function (j) { var x = j && j[r.id]; r.log = x && x.log || []; r.marks = x && x.marks || []; if (!x) r.noDetail = true; return r; },
      function () { r.log = []; r.marks = []; r.noDetail = true; return r; });
  }
  var API = { deskTrades: deskTrades, sixCandle: sixCandle, oneCandle: oneCandle, ONE_N: ONE_N, styleOf: styleOf, backEv: backEv, CF_LIMIT: CF_LIMIT, egBoxes: egBoxes, MOSHA: MOSHA, withDetail: withDetail, calMonth: calMonth, calHTML: calHTML, MARKETS: MARKETS, ALL: ALL, sizes: sizes, fmt: fmt, unit: unit, SEC: SEC, LADDER: LADDER, BACK: BACK, DAYS: DAYS, BARRIER_R: BARRIER_R, BARRIER: BARRIER, JANDA_ALT: JANDA_ALT, M5_ALT: M5_ALT, ALT2: ALT2, BARRIER30: BARRIER30, LOWER: LOWER, DOWN: DOWN, CFTF: CFTF, smallEv: smallEv, swingEv: swingEv, m30of: m30of, SWEEP_N: SWEEP_N, sweepsOf: sweepsOf, readings: readings, MIN_JUDGE: MIN_JUDGE, outcome: outcome, uniq: uniq, orderKey: orderKey, dayTags: dayTags, sopTrades: sopTrades, barrierTrades: barrierTrades, oldBarrierTrades: oldBarrierTrades, OLD_BARRIER: OLD_BARRIER, r6BarrierTrades: r6BarrierTrades, R6_BARRIER: R6_BARRIER, zonesOf: zonesOf, summary: summary, COSTS: COSTS, costR: costR, costed: costed, costsOn: costsOn, costsSet: costsSet, costsBtn: costsBtn, costsWord: costsWord, byDay: byDay,
    visible: function (ds) { return !!ds && ds.role !== 'public' && !(ds.mosha === 'teach' && ds.role !== 'owner'); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_SOP = API;
  if (typeof document === 'undefined') return;

  // ─── the card (#mo-sopr) ───
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var S = { state: 'idle', rows: null, at: 0, err: '', open: {}, flt: 'all', src: 'both', mk: 'all', all: false, file: null };
  var mkR = function (r) { return mkOf(r.market); }, fP = function (r, v) { return fmt(mkR(r))(v); };
  function fns() { return typeof root.msAnalyze === 'function' && typeof root.msMosha === 'function' && typeof root.msZones === 'function' && typeof root.msInternal === 'function' ? { msAnalyze: root.msAnalyze, msMosha: root.msMosha, msZones: root.msZones, msInternal: root.msInternal } : null; }
  function bars(tf, now) {
    var from = now - BACK[tf] * 86400, wins = [], to = now; while (to > from) { var f = Math.max(from, to - 4000 * SEC[tf]); wins.push([f, to]); to = f; }
    var out = {}, p = Promise.resolve();
    wins.forEach(function (w) { p = p.then(function () { return fetch('/md/bars?sym=xau&tf=' + tf + '&from=' + w[0] + '&to=' + w[1], { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('candles ' + r.status); return r.json(); })
      .then(function (j) { (j.bars || j || []).forEach(function (b) { out[b.time] = b; }); }); }); });
    return p.then(function () { return Object.keys(out).map(function (k) { return out[k]; }).sort(function (a, b) { return a.time - b.time; }).filter(function (b) { return b.time + SEC[tf] <= now; }); });
  }
  // the tracker's stored record (council/mosha-desk.mjs -> council-data mosha/desk.json), as the ICT desk reads its own
  function stored() {
    var D = root.msData; if (!D || typeof D.json !== 'function') return Promise.resolve(null);
    return Promise.resolve(D.json('mosha/desk.json')).then(function (j) { return j && Array.isArray(j.records) && j.records.length ? j : null; }, function () { return null; });
  }
  function run(force) {
    if (S.state === 'busy') return; S.state = 'busy'; S.err = ''; draw();
    stored().then(function (j) {
      if (j && !force) { S.rows = j.records.filter(function (r) { return MOSHA.indexOf(mkR(r)) >= 0; }).sort(function (a, b) { return b.t - a.t; }); S.file = { at: j.at, through: j.through, since: j.since, detail: j.detail || null }; S.state = 'done'; S.at = Date.now(); draw(); return; }
      S.file = null; S.state = 'idle'; replay();
    });
  }
  function replay() {
    var F = fns(); if (S.state === 'busy') return; if (!F) { S.state = 'failed'; S.err = 'no page functions'; draw(); return; } S.state = 'busy'; S.err = ''; draw();
    var now = Math.floor(Date.now() / 1000), B = {}, p = Promise.resolve();
    Object.keys(BACK).forEach(function (tf) { p = p.then(function () { return bars(tf, now).then(function (a) { B[tf] = a; }); }); });
    p.then(function () { return new Promise(function (ok) { setTimeout(ok, 30); }); }).then(function () {
      if (!B['5m'].length) throw new Error('no candles');
      var from = B['5m'][B['5m'].length - 1].time - DAYS * 86400;
      return new Promise(function (ok) { setTimeout(function () { ok(deskTrades(B, F, { from: from })); }, 30); });
    }).then(function (rows) { S.rows = rows.sort(function (a, b) { return b.t - a.t; }); S.state = 'done'; S.at = Date.now(); }, function (e) { S.state = 'failed'; S.err = String(e && e.message || e); }).then(draw);
  }
  function line(name, rows, extra) {
    var s = summary(rows), parts = [s.n + (s.n === 1 ? ' entry' : ' entries')];
    if (s.closed) parts.push(s.wins + ' reached target, ' + (s.closed - s.wins) + ' stopped', fR(s.total) + ' ' + costsWord()); if (s.open) parts.push(s.open + ' still open');
    return '<p class="mo-sys-l"><b>' + esc(name) + '</b>: ' + esc(parts.join(' · ')) + '. ' + (s.closed < MIN_JUDGE ? 'Too few to judge (' + s.closed + ' of ' + MIN_JUDGE + ' closed).' : 'One reading on past candles, not a tested rule (t ' + (s.t == null ? 'n/a' : s.t.toFixed(2)) + ').') + (extra ? ' ' + esc(extra) : '') + '</p>';
  }
  // what kind of entry a row is: the sequence (major or internal BO), or the barrier with its kind and its confirmation
  // a stored record keeps its id and a label cut to 56 characters: the owner's readings of 21 Nov 2026 are read from the id
  function kindText(r) {
    var lb = r.label || '', g = readings(r);
    if (isNest(r)) return /SOP inside/.test(lb) ? lb : NAME[r.h] + (isNest(r) === 'vr' ? ' VR → ' : ' CF → ') + NAME[r.l] + ' SOP inside the ' + (isNest(r) === 'vr' ? 'VR' : 'CF');
    if (r.kind === 'sop' && /^\S+ i?BO → \S+ VR → \S+ CF/.test(lb)) return lb;
    if (r.kind === 'sop') return NAME[r.h] + (r.ibo || / iBO /.test(lb) ? ' iBO → ' : ' BO → ') + NAME[r.l] + ' VR, CF' + (isC2(r) || r['case'] === 2 ? ' · CF inside the VR' : '');
    if (r.nested || (/bar-sop-cf-/.test(String(r.id)) && r.l === DOWN[r.h])) return NAME[r.h] + ' CF → ' + NAME[r.l] + ' VR, CF inside it (repeat SOP)' + (r.withDir == null ? '' : r.withDir ? ' · with the direction' : ' · against the direction');
    return NAME[r.h] + (/CF barrier/.test(lb) ? ' CF barrier → ' : /VR barrier/.test(lb) ? ' VR barrier → ' : g.sweep ? ' sweep barrier → ' : ' barrier → ') + NAME[r.l] + (g.tap ? ' BO at the tap' : g.qmFail ? ' QM failed, trade with the direction' : g.rsop ? ' QM, repeat SOP' : r.janda || / · Janda/.test(lb) ? ' QM, Janda' : ' QM') +
      (g.m5 ? ' · M5 confirm' : '') + (g.alt ? ' · ' + NAME[g.alt] + ' confirm' : '') + (g.visit > 1 ? (g.visit === 2 ? ' · second visit' : ' · visit ' + g.visit) : '') + (g.atZone ? ' · at the zone' : '') + (g.r6 ? ' · 6R target' : g.old ? ' · 3R target' : '') + (r.withDir == null ? '' : r.withDir ? ' · with the direction' : ' · against the direction') + (g.old ? ' · 3R target' : '');
  }
  // a SOP inside the SOP, read from the id (a stored record keeps no flag): 'vr', 'cf' or ''
  var isNest = function (r) { var m = /(^|:)sop-n([vc])-/.exec(String(r.id || '')); return m ? (m[2] === 'v' ? 'vr' : 'cf') : ''; };
  var isLim = function (r) { return !!r.cfLimit || /(^|:)sop-l-/.test(String(r.id || '')); };
  var isC2 = function (r) { return !!r.case2 || /(^|:)sop-c2-/.test(String(r.id || '')); };
  function rowHTML(r) {
    var res = r.status === 'target' ? '<b class="pos">' + fR(r.R) + '</b> · target' : r.status === 'stopped' ? '<b class="neg">' + fR(r.R) + '</b> · stopped' : '<b>Open</b>' + (r['float'] != null ? ' · ' + fR(r['float']) + ' now' : '');
    var op = !!S.open[r.id], kind = kindText(r);
    return '<tr><td class="mo-c-time"><span class="mo-when">' + utc(r.t) + '</span><small>' + esc(kind) + ' · ' + esc(ALL[mkR(r)].name) + '</small></td>' +
      '<td class="mo-c-side"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span>' + (r.src ? ' <small class="mo-sop-src">' + (r.src === 'live' ? 'live' : 'replay') + '</small>' : '') + '</td>' +
      '<td class="n" data-l="Entry">' + fP(r, r.entry) + '</td><td class="n" data-l="Stop">' + fP(r, r.stop) + '</td><td class="n" data-l="Target">' + fP(r, r.target) + '</td>' +
      '<td class="mo-c-res"><div class="mo-ex">' + res + '<small>' + (r.endT ? 'ended ' + utc(r.endT) + ' · ' : '') + 'risk ' + unit(mkR(r)) + fP(r, r.r0) + '</small></div>' +
      '<div class="mo-sop-a"><button type="button" class="mo-sop-b" data-sop-log="' + esc(r.id) + '" aria-expanded="' + op + '">' + (op ? 'Hide the log' : 'Log') + '</button><button type="button" class="mo-sop-b" data-sop-chart="' + esc(r.id) + '">Chart</button></div>' + dcSlot('mosha', r, kind) +
      (op ? '<ol class="mo-sop-log">' + (r.log ? (r.noDetail ? '<li>The log of this trade could not be read.</li>' : '') + r.log.map(function (x) { return '<li>' + (x.t ? '<span>' + utc(x.t) + '</span> ' : '') + esc(x.text) + '</li>'; }).join('') : '<li>Reading the log…</li>') + '</ol>' : '') + '</td></tr>';
  }
  // Open now (21 Nov 2026, owner: "the same panel with active trades like ict desk"): one card per open paper trade of the
  // tracker's record, every market, whatever filter the table below is on. R now is the tracker's last reading, not a live quote.
  function openCard(r) {
    var m = mkR(r), tR = Math.abs(r.target - r.entry) / (r.r0 || Math.abs(r.entry - r.stop)), fl = r['float'], hi = Math.max(3, Math.ceil(tR)), lo = -1;
    var pc = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1); }, z = pc(0);
    var fill = fl == null ? '' : '<i class="' + (fl >= 0 ? 'up' : 'dn') + '" style="left:' + (fl >= 0 ? z : pc(fl)) + '%;width:' + Math.abs(pc(fl) - z).toFixed(1) + '%"></i>';
    var kind = kindText(r);
    // the card's button is an inner element, so the Take / Skip slot after it is not nested inside a button (review, 23 Nov 2026)
    return '<li><div class="oc-b" data-sop-chart="' + esc(r.id) + '" tabindex="0" role="button" aria-label="' + esc(word(r.side) + ' ' + ALL[m].name + ', ' + (fl == null ? 'no reading yet' : fR(fl) + ' at the last reading') + ', open, view the chart') + '">' +
      '<div class="r1"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span><b class="mk">' + esc(ALL[m].name) + '</b><span class="pl">' + esc(kind) + '</span>' + (r.src ? '<span class="pl">' + (r.src === 'live' ? 'live' : 'replay') + '</span>' : '') +
      '<span class="live ' + (fl == null ? '' : fl >= 0 ? 'pos' : 'neg') + '">' + (fl == null ? '<small>no reading yet</small>' : fR(fl) + '<small>at the last reading</small>') + '</span></div>' +
      '<div class="trk" aria-hidden="true">' + fill + '<span style="left:' + z + '%"></span><span style="left:' + pc(Math.min(hi, tR)) + '%"></span></div>' +
      '<div class="trk-l" aria-hidden="true"><span style="left:0">−1R stop</span><span style="left:' + z + '%">0</span><span style="left:100%">' + (tR <= hi ? 'target ' : '') + '+' + hi + 'R</span></div>' +
      '<dl><div><dt>Entry</dt><dd>' + fP(r, r.entry) + '</dd></div><div><dt>Stop</dt><dd>' + fP(r, r.stop) + '</dd></div><div><dt>Target</dt><dd>' + fP(r, r.target) + ' · ' + tR.toFixed(1) + 'R</dd></div><div><dt>Best so far</dt><dd>' + (r.mfe != null ? '+' + (+r.mfe).toFixed(2) + 'R' : '—') + '</dd></div></dl>' +
      '<p class="nt">Open since ' + utc(r.t) + ' · risk ' + unit(m) + fP(r, r.r0) + '</p></div>' + dcSlot('mosha', r, kind) + '</li>';
  }
  // On a phone (22 Nov 2026, owner: "organise better the open trades or put like a dropdown, it is long going all the way down to
  // see the calendar"): the cards are one line each and only the first OPEN_PHONE show, with a button for the rest. Display only.
  var OPEN_PHONE = 3;
  function openMore(card, n) {
    if (!card) return; var b = card.querySelector('.mo-open-more');
    if (n <= OPEN_PHONE) { if (b) b.remove(); card.removeAttribute('data-all'); return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'mo-sop-b mo-open-more'; card.appendChild(b); }
    var all = card.hasAttribute('data-all'); b.setAttribute('aria-expanded', String(all));
    b.textContent = all ? 'Show fewer' : 'Show all ' + n + ' open trades';
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.mo-open-more') : null; if (!b) return;
    var card = b.closest('.mo-open-c'); if (!card) return;
    if (card.hasAttribute('data-all')) card.removeAttribute('data-all'); else card.setAttribute('data-all', '');
    openMore(card, card.querySelectorAll('.mo-open li:not(.empty)').length);
    if (!card.hasAttribute('data-all') && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' });
  });
  function openPanel(open) {
    var box = $('mo-open'), l = $('mo-open-l'), n = $('mo-open-n'); if (!box || !l) return;
    var ok = API.visible(document.documentElement.dataset); box.hidden = !ok; if (!ok) return;
    if (S.state !== 'done') { l.innerHTML = '<li class="empty">' + (S.state === 'failed' ? 'The open trades could not be read.' : 'Reading the open trades…') + '</li>'; if (n) n.textContent = ''; return; }
    open = open.slice().sort(function (a, b) { return b.t - a.t; });
    if (n) n.textContent = open.length ? open.length + ' open · paper only' + (S.file && S.file.at ? ' · last reading ' + utc(Math.floor(Date.parse(S.file.at) / 1000)) : '') : '';
    l.innerHTML = open.length ? open.map(openCard).join('') : '<li class="empty">No trade is open now. ' + (S.file ? 'The tracker reads gold, EUR/USD and GBP/USD about every 35 minutes' + (S.file.at ? ' (last reading ' + utc(Math.floor(Date.parse(S.file.at) / 1000)) + ')' : '') + '; a new entry shows here until its stop or target.' : 'A new entry shows here until its stop or target.') + '</li>';
    openMore(box, open.length);
  }
  // the trade history as one dropdown (22 Nov 2026, owner: "and the trades history"): closed by default; its open state is kept
  // in memory on the desk's state (S.hist) so a redraw (a filter, a new reading) leaves it as the person left it. Display only.
  function histOpen(st, n) {
    return '<details class="mo-hist" data-hist' + (st && st.hist ? ' open' : '') + '><summary>Trade history <small>' + n + (n === 1 ? ' trade' : ' trades') + ', newest first</small></summary>';
  }
  if (typeof document !== 'undefined') document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.matches || !d.matches('details[data-hist]')) return;
    var v = d.closest('[id^="v-"]'); if (!v) return;
    if (v.id === 'v-mosha') S.hist = d.open; else if (root.MS_EDGE_DESKS && root.MS_EDGE_DESKS.hist) root.MS_EDGE_DESKS.hist(v.id.slice(2), d.open);
  }, true);
  // Take / Skip on an open signal (23 Nov 2026): an empty slot the decision journal fills (market-structure.html #ms-jr-js) for
  // members who may use it; it carries the record's own levels and kind label. Nothing for a closed record; nothing for guests.
  function dcSlot(desk, r, method) {
    if (!r || r.R != null) return '';
    var o = { id: r.id, market: r.market || 'xau', side: r.side, entry: r.entry, stop: r.stop, target: r.target == null ? null : r.target, l: r.l || null, label: method || r.label || r.kind || '' };
    return '<span class="dc" data-dc="' + esc(desk) + '" data-dc-r="' + esc(JSON.stringify(o)) + '"></span>';
  }
  API.dcSlot = dcSlot;
  API.openCard = openCard; API.openMore = openMore; API.OPEN_PHONE = OPEN_PHONE; API.histOpen = histOpen;
  function draw() {
    var box = $('mo-sopr'); if (!box) return; var ok = API.visible(document.documentElement.dataset); box.hidden = !ok; if (!ok) return;
    if (S.state !== 'done') openPanel([]);
    var head = '<div class="ms-k"><span>Mosha trades</span><small>the method as the course documents write it, on gold, EUR/USD and GBP/USD · recorded by the desk\'s tracker like the ICT desk · paper only · each trade with its log</small></div>';
    if (S.state === 'idle' || S.state === 'busy') { box.innerHTML = head + '<div class="ct-empty">' + (S.state === 'busy' ? 'Reading the trades…' : 'The trades load when the desk opens.') + '</div>'; return; }
    if (S.state === 'failed') { box.innerHTML = head + '<div class="ct-empty">The tracker has no stored trades yet and the candles could not be read, so there is nothing to show. <button type="button" class="mo-sop-b" data-sop-run>Try again</button></div>'; return; }
    var every = costed(S.rows || []), nLive = every.filter(function (r) { return r.src === 'live'; }).length, bySrc = S.file && S.src !== 'both' ? every.filter(function (r) { return (r.src === 'live') === (S.src === 'live'); }) : every, mks = MOSHA.filter(function (k) { return bySrc.some(function (r) { return mkR(r) === k; }); }), all = S.mk === 'all' || mks.indexOf(S.mk) < 0 ? bySrc : bySrc.filter(function (r) { return mkR(r) === S.mk; }), sop = all.filter(function (r) { return r.kind === 'sop'; }), barAll = all.filter(function (r) { return r.kind === 'barrier'; }), bar = barAll.filter(function (r) { var g = readings(r); return !g.old && !g.r6; }), barOld = barAll.filter(function (r) { return readings(r).old; }), barR6 = barAll.filter(function (r) { return readings(r).r6; });
    var list = S.flt === 'sop' ? sop : S.flt === 'barrier' ? bar : S.flt === 'old' ? barOld : S.flt === 'r6' ? barR6 : all, shown = S.all ? list : list.slice(0, 30);
    var chip = function (k, t, n) { return '<button type="button" class="mo-sop-b" data-sop-flt="' + k + '" aria-pressed="' + (S.flt === k) + '">' + t + ' (' + n + ')</button>'; };
    var sm = summary(list), open = all.filter(function (r) { return r.R == null; }), last = all[0];
    var ans = (open.length ? open.length + (open.length === 1 ? ' trade is' : ' trades are') + ' open now. ' : 'No trade is open now. ') + (last ? 'Latest entry: ' + ALL[mkR(last)].name + ' ' + word(last.side) + ' at ' + fP(last, last.entry) + ', ' + utc(last.t) + '.' : '');
    var tile = function (k, v, sub, cls) { return '<div class="mo-sop-tile"><small>' + k + '</small><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b><span>' + sub + '</span></div>'; };
    var tiles = '<div class="mo-sop-tiles">' + tile('Entries', sm.n, sm.open + ' open') + tile('Reached target', sm.closed ? sm.wins + ' of ' + sm.closed : '—', sm.closed ? Math.round(100 * sm.wins / sm.closed) + '% of closed' : 'none closed') +
      tile('Total, ' + costsWord(), sm.closed ? fR(sm.total) : '—', sm.closed ? fR(sm.mean) + ' a trade' : 'none closed', sm.total > 0 ? 'pos' : sm.total < 0 ? 'neg' : '') + tile('Can it be judged?', sm.closed < MIN_JUDGE ? 'Too few' : 'Not a test', sm.closed < MIN_JUDGE ? sm.closed + ' of ' + MIN_JUDGE + ' closed' : 't ' + (sm.t == null ? 'n/a' : sm.t.toFixed(2)) + ' · a paper record') + '</div>';
    var openHTML = ''; openPanel(every.filter(function (r) { return r.R == null; }));
    var cal = calHTML(list, S, 'data-sop-chart', function (r) { return ALL[mkR(r)].name + ' · ' + kindText(r); });
    box.innerHTML = head + '<p class="mo-sop-ans">' + esc(ans) + '</p>' +
      '<div class="mo-sop-a mo-sop-f">' + chip('all', 'All', all.length) + chip('sop', 'BO, VR, CF', sop.length) + chip('barrier', 'Barrier entry', bar.length) + chip('old', 'Barrier, 3R target', barOld.length) + chip('r6', 'Barrier, 6R target', barR6.length) + (S.file ? '<span class="mo-sop-sep" aria-hidden="true"></span>' + ['both', 'live', 'replay'].map(function (k) { return '<button type="button" class="mo-sop-b" data-sop-src="' + k + '" aria-pressed="' + (S.src === k) + '">' + (k === 'both' ? 'Both' : k === 'live' ? 'Live (' + nLive + ')' : 'Replay (' + (every.length - nLive) + ')') + '</button>'; }).join('') : '') +
      costsBtn('data-sop-costs') + '<button type="button" class="mo-sop-b" data-sop-run>Refresh</button></div>' +
      (mks.length > 1 ? '<div class="mo-sop-a mo-sop-f">' + ['all'].concat(mks).map(function (k) { return '<button type="button" class="mo-sop-b" data-sop-mk="' + k + '" aria-pressed="' + ((S.mk === k) || (k === 'all' && mks.indexOf(S.mk) < 0)) + '">' + (k === 'all' ? 'All markets' : esc(MARKETS[k].name)) + ' (' + (k === 'all' ? bySrc.length : bySrc.filter(function (r) { return mkR(r) === k; }).length) + ')</button>'; }).join('') + '</div>' : '') +
      '<p class="ms-note mo-sop-st">' + (S.file ? 'Recorded by the tracker in the council loop, about every 35 minutes' + (S.file.at ? ' · last run ' + utc(Math.floor(Date.parse(S.file.at) / 1000)) : '') + (S.file.since ? ' · trades since ' + utc(S.file.since).slice(0, 10) : '') + '. Live = the tracker recorded it within an hour of its entry; Replay = worked out afterwards from the same closed candles.' : 'The tracker has no stored trades yet, so these were worked out in this browser from the last two weeks of candles.') + '</p>' +
      tiles + openHTML +
      histOpen(S, list.length) +
      (shown.length ? '<div class="ct-tw"><table class="ct-t mo-t" aria-label="Replayed trades of the Mosha reading"><thead><tr><th>Entry time</th><th>Side</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th>Result and log</th></tr></thead><tbody>' + shown.map(rowHTML).join('') + '</tbody></table></div>' +
        (list.length > shown.length ? '<p class="ms-note"><button type="button" class="mo-sop-b" data-sop-all>Show all ' + list.length + '</button></p>' : '') : '<div class="ct-empty">No trade to show.</div>') + '</details>' +
      cal +
      '<details class="mo-sop-more"><summary>By entry type, and what this is</summary>' + line('BO, VR, CF: entry on the EG', sop.filter(function (r) { return !isC2(r) && !isNest(r) && !isLim(r); })) + line('BO, VR, CF: limit at the CF line', sop.filter(isLim), 'The owner\'s reading of 22 Nov 2026: a plain limit at the level the CF\'s break took, stop past the CF zone, recorded beside the EG entry so the two can be compared.') + line('BO, VR, CF with the CF inside the VR', sop.filter(isC2), 'The method calls this CF likely to fail and waits; it is recorded apart so the record can show the case.') +
      line('SOP inside the VR (against the BO)', sop.filter(function (r) { return isNest(r) === 'vr'; }), 'The owner\'s reading of 22 Nov 2026: the VR\'s break is read as a BO one timeframe lower and a whole BO, VR, CF is traded there, against the first BO, until the CF forms.') +
      line('SOP inside the CF (with the BO)', sop.filter(function (r) { return isNest(r) === 'cf'; }), 'The CF\'s break is read as a BO one timeframe lower and a whole BO, VR, CF is traded there, with the first BO; the main sequence is recorded beside it.') + line('Barrier entry', bar, 'It takes every fresh barrier; the method says to mark the best one, and that choice is not in the replay.') +
      ['swing', 'intraday', 'scalp'].map(function (st) { return line(st === 'swing' ? 'Swing (D1 top timeframe)' : st === 'intraday' ? 'Intraday (H4 top timeframe)' : 'Scalp (H1 and lower top timeframe)', all.filter(function (r) { return styleOf(r) === st; })); }).join('') +
      line('Barrier with the older 3R target', barOld, 'The same barrier entries and stops as the current reading, with the 3R target the desk used until 22 Nov 2026 instead of 1R. Recorded beside the current reading, never mixed into it.') +
      line('Barrier with a 6R target', barR6, 'The same barrier entries and stops with a 6R target, added on 22 Nov 2026 after 6R did best of 3R to 6R on the 60 days before (before costs, picked after looking, so not a tested result). Recorded beside the other two, never mixed into them.') +
      line('Barrier, limit at the level the QM broke', bar.filter(function (r) { return !readings(r).atZone; })) +
      line('Barrier, limit at the zone\'s near side', bar.filter(function (r) { return readings(r).atZone; }), 'The owner\'s reading: a second limit at the barrier zone\'s near side, recorded beside the one at the broken level.') +
      line('Barrier confirmed on M5 (H4 and M15 barriers)', bar.filter(function (r) { return readings(r).m5; }), 'M15 on M5 is in the method\'s second table; H4 on M5 is the owner\'s reading.') +
      line('Second table: H4 on M30, H1 on M15, M30 barriers on M5', bar.filter(function (r) { var g = readings(r); return g.alt || g.m30; }), 'The confirmation timeframes the method\'s second table adds, each recorded beside the first table\'s.') +
      line('Repeat of the SOP at the barrier', bar.filter(function (r) { return readings(r).rsop; }), 'After the QM at the barrier, a VR and its CF one timeframe lower; after the sequence\'s own CF, with no QM first, a VR and then a CF inside that CF zone. The entry is the sequence\'s own.') +
      line('M1 BO at the tap', bar.filter(function (r) { return readings(r).tap; }), 'The owner\'s reading of 22 Nov 2026: at the tap of a barrier, a market entry at the close of the first M1 BO Structure with the barrier, stop past that BO\'s low or high.') +
      line('QM failed at a barrier against the direction', bar.filter(function (r) { return readings(r).qmFail; }), 'The owner\'s reading of 22 Nov 2026: no new BO was made, so the close back through the QM level is traded with the direction, stop past the VR, target the last low or high.') +
      line('Sweep barrier', bar.filter(function (r) { return readings(r).sweep; }), 'A swing high or low that a candle traded beyond and closed back inside; read once that candle closed.') +
      line('Second and later visits', bar.filter(function (r) { return readings(r).visit > 1; }), 'A zone taken again after price left it and came back, before it was broken.') +
      (bar.some(function (r) { return r.withDir != null; }) ? line('Barrier with the direction of the timeframe above', bar.filter(function (r) { return r.withDir === true; })) + line('Barrier against it', bar.filter(function (r) { return r.withDir === false; }), 'The method expects only a rejection from a barrier against the direction; the replay gives both the same 3R target, so the two are shown apart.') : '') +
      '<p class="ms-note">A replay on past candles of how the desk reads the method: every step uses closed candles only and nothing after a candle decides it. Results are before costs, a stop is counted first when one candle holds both. On a market other than gold the stop buffer and the size limits are the same share of price as on gold: the desk\'s own choice. These are not Luxus\'s trades and not the council\'s, nothing was traded, and a replay of one reading cannot show whether a rule makes money: the fixed-rule studies of this method failed (<a href="/edge-lab.html#mosha-sweep">the sweep study</a>).</p></details>';
  }
  function byId(id) { return (S.rows || []).filter(function (r) { return r.id === id; })[0]; }
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#mo-open [data-sop-chart][role="button"]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#mo-open [data-sop-chart], #mo-sopr [data-cal-m], #mo-sopr [data-cal-day], #mo-sopr [data-sop-log], #mo-sopr [data-sop-chart], #mo-sopr [data-sop-flt], #mo-sopr [data-sop-src], #mo-sopr [data-sop-mk], #mo-sopr [data-sop-run], #mo-sopr [data-sop-costs], #mo-sopr [data-sop-all]') : null; if (!b) return;
    if (b.hasAttribute('data-cal-m')) { if (b.getAttribute('data-cal-m')) { S.calM = b.getAttribute('data-cal-m'); S.calDay = null; draw(); } return; }
    if (b.hasAttribute('data-cal-day')) { var cd = b.getAttribute('data-cal-day'); S.calDay = S.calDay === cd ? null : cd; draw(); var nd = document.querySelector('#mo-sopr [data-cal-day="' + cd + '"]'); if (nd) nd.focus(); return; }
    if (b.hasAttribute('data-sop-src')) { S.src = b.getAttribute('data-sop-src'); S.all = false; draw(); return; }
    if (b.hasAttribute('data-sop-mk')) { S.mk = b.getAttribute('data-sop-mk'); S.all = false; draw(); return; }
    if (b.hasAttribute('data-sop-costs')) { costsSet(!costsOn()); draw(); if (typeof document !== 'undefined') document.dispatchEvent(new Event('ms:desk-costs')); return; }
    if (b.hasAttribute('data-sop-run')) { S.all = false; run(); return; }
    if (b.hasAttribute('data-sop-all')) { S.all = true; draw(); return; }
    if (b.hasAttribute('data-sop-flt')) { S.flt = b.getAttribute('data-sop-flt'); S.all = false; draw(); return; }
    var id = b.getAttribute('data-sop-log') || b.getAttribute('data-sop-chart'), r = byId(id); if (!r) return;
    var fileD = S.file && S.file.detail;
    if (b.hasAttribute('data-sop-log')) { S.open[id] = !S.open[id]; var refocus = function () { draw(); var nb = document.querySelector('#mo-sopr [data-sop-log="' + id + '"]'); if (nb) nb.focus(); };
      refocus(); if (S.open[id] && !r.log) withDetail(fileD, r).then(refocus); return; }
    withDetail(fileD, r).then(function (r) {
    var T = { replayed: true, name: kindText(r), marks: r.marks || [], steps: (r.log || []).filter(function (x) { return x.t; }), id: r.id, market: mkR(r), side: word(r.side), at: r.t, entry: +fP(r, r.entry), stop: +fP(r, r.stop), target: +fP(r, r.target), status: r.R != null ? 'closed' : 'open', exit: r.exit != null ? +fP(r, r.exit) : null, exitAt: r.endT, R: r.R, how: r.status };
    if (typeof root.msMoshaReplayDialog === 'function') root.msMoshaReplayDialog(T, document.getElementById('v-mosha')); else if (typeof root.msMoshaReplayTrade === 'function') root.msMoshaReplayTrade(T);
    });
  });
  function go() { var v = $('v-mosha'); if (!v || v.hidden) return; if (API.visible(document.documentElement.dataset) && S.state === 'idle') run(); else draw(); }
  var prev = root.renderMosha;
  root.renderMosha = function () { if (prev) prev(); go(); };
  root.msMoshaSop = go;
  go();
})(typeof window !== 'undefined' ? window : globalThis);
