// The Mosha method, replayed on the last two weeks (20 Nov 2026, owner: "try to replicate the last 2 weeks", "show the trades
// like the council and logs"). The desk's own reading of the method's two entries, walked over past gold candles one closed
// candle at a time (nothing after a candle is read to decide it), listed like the council's trades with a log per trade:
//   1. the sequence: a BO on one timeframe, the VR (the first break against it one timeframe lower), the CF (the break back
//      with the BO), the pullback into the CF zone, an EG, stop past the pullback's extreme, target the VR's extreme;
//   2. the barrier entry: a fresh D1, H4, H1 or M15 barrier, price comes to it, the CF is a QM (BO Structure) with the barrier
//      on the method's own confirmation timeframe (D1 on H1, H4 on M15, H1 on M5, M15 on M1), entry on the pullback to the
//      level that CF broke, stop past the extreme made at the barrier; the target (3R) is the replay's own choice.
// In the sequence the VR and the CF must each be a BO Structure (a QM), never a continuation break (21 Nov 2026).
// DISPLAY ONLY. A replay on past candles: no order, no stored trade, no council file, nothing sent anywhere. It is not
// Luxus's record and not a tested rule; the mechanical Mosha studies failed (CLAUDE.md "Mosha level reversal study").
(function (root) {
  'use strict';
  var SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '30m': 1800, '15m': 900, '5m': 300, '1m': 60 };
  var NAME = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '30m': 'M30', '15m': 'M15', '5m': 'M5', '1m': 'M1' };
  var LADDER = [['1d', '4h'], ['4h', '1h'], ['1h', '30m'], ['30m', '15m'], ['15m', '5m']];   // the VR forms exactly one timeframe lower
  var BACK = { '1d': 1500, '4h': 260, '1h': 90, '30m': 60, '15m': 40, '5m': 24, '1m': 16 };  // days of candles each timeframe needs
  var DAYS = 14, PIVOT = 6, WIN = 1500, BUF = 0.3, BARRIER_R = 3, MIN_JUDGE = 20;
  // the barrier entry's confirmation timeframe (21 Nov 2026, the method's own table: D1 on H1, H4 on M15, H1 on M5, M15 on M1);
  // the CF is watched for BARRIER_WATCH confirmation candles from the first touch and its pullback for BARRIER_FILL more
  var BARRIER = [['1d', '1h'], ['4h', '15m'], ['1h', '5m'], ['15m', '1m']], BARRIER_WATCH = 60, BARRIER_FILL = 12;
  var f2 = function (v) { return (+v).toFixed(2); };
  // More markets (21 Nov 2026, owner: "more trades"): the SAME reading on other markets, no new entry rule. The gold sizes
  // (stop buffer, smallest and largest risk, smallest barrier) were written in dollars near REF; another market takes the
  // same share of its own price. Gold keeps its dollar figures exactly.
  var MARKETS = { xau: { name: 'Gold', dec: 2 }, xag: { name: 'Silver', dec: 3 }, eurusd: { name: 'EUR/USD', dec: 5 }, gbpusd: { name: 'GBP/USD', dec: 5 }, nas100: { name: 'Nasdaq 100', dec: 1 } };
  // every market a desk tracker may record (the LIT desk reads more than the Mosha five); MARKETS stays the Mosha tracker's list
  var ALL = { xau: MARKETS.xau, xag: MARKETS.xag, eurusd: MARKETS.eurusd, gbpusd: MARKETS.gbpusd, nas100: MARKETS.nas100, usdjpy: { name: 'USD/JPY', dec: 3 }, audusd: { name: 'AUD/USD', dec: 5 }, usdcad: { name: 'USD/CAD', dec: 5 },
    spx500: { name: 'S&P 500', dec: 1 }, us30: { name: 'Dow 30', dec: 1 }, de40: { name: 'DAX 40', dec: 1 } };
  var REF = 4000, mkOf = function (k) { return ALL[k] ? k : 'xau'; };
  var sizes = function (k, px) { var q = mkOf(k) === 'xau' ? 1 : px / REF; return { buf: BUF * q, rmin: 0.8 * q, rmax: 25 * q, zmin: 0.5 * q }; };
  var fmt = function (k) { var d = ALL[mkOf(k)].dec; return function (v) { return (+v).toFixed(d); }; };
  var unit = function (k) { return mkOf(k) === 'xau' ? '$' : ''; };
  var utc = function (s) { return s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'; };
  var word = function (d) { return d > 0 ? 'buy' : 'sell'; };

  // where a trade ended on the finest candles: the stop first when one candle holds both
  function outcome(tr, bars, after, limit) {
    var d = tr.side, r0 = Math.abs(tr.entry - tr.stop), o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 };
    if (!(r0 > 0)) return o;
    for (var i = 0; i < bars.length; i++) { var b = bars[i]; if (b.time < after) continue;
      if (d > 0 ? b.low <= tr.stop : b.high >= tr.stop) { var px = b.time > after && (d > 0 ? b.open < tr.stop : b.open > tr.stop) ? b.open : tr.stop;   // a candle that opens beyond the stop exits at its open
        o.status = 'stopped'; o.R = (d > 0 ? px - tr.entry : tr.entry - px) / r0; o.endT = b.time; o.exit = px; return o; }
      if (limit && b.time === after) continue;   // a limit fills inside its candle: only the stop counts on that candle, never the target or the best-so-far
      if (d > 0 ? b.high >= tr.target : b.low <= tr.target) { o.status = 'target'; o.R = Math.abs(tr.target - tr.entry) / r0; o.endT = b.time; o.exit = tr.target; return o; }
      o.mfe = Math.max(o.mfe, (d > 0 ? b.high - tr.entry : tr.entry - b.low) / r0); }
    if (bars.length) { var c = bars[bars.length - 1].close; o.float = (d > 0 ? c - tr.entry : tr.entry - c) / r0; }
    return o;
  }

  // 1. the sequence, every step of the ladder. B = { tf: closed candles, oldest first }, F = the page's own functions.
  function sopTrades(B, F, o) {
    o = o || {}; var from = o.from, piv = o.pivot || PIVOT, win = o.win || WIN, fine = B['5m'] || [], map = {}, cfSeen = {}, out = [], mk = mkOf(o.market), f2 = fmt(mk), U = unit(mk), pre = mk === 'xau' ? '' : mk + ':';
    LADDER.forEach(function (p) {
      var h = p[0], l = p[1], H = B[h], L = B[l]; if (!H || !L || !H.length || !L.length) return;
      var hN = -1, HA = null, Hw = null, n = 0;
      for (var i = 0; i < L.length; i++) { var t = L[i].time + SEC[l]; if (t < from) continue; if (o.until && t > o.until) break;
        while (n < H.length && H[n].time + SEC[h] <= t) n++;
        if (n !== hN) { Hw = H.slice(Math.max(0, n - win), n); HA = Hw.length ? F.msAnalyze(Hw, piv) : null; hN = n; }
        if (!HA || !HA.trend) continue;
        var A = HA, mv = A.last && A.last.dir === A.trend ? A.last : A.events.slice().reverse().find(function (e) { return e.dir === A.trend; }); if (!mv) continue;
        var Lw = L.slice(Math.max(0, i + 1 - win), i + 1), LA = F.msAnalyze(Lw, piv), boT = Hw[mv.breakIdx].time;
        var M = F.msMosha({ dir: A.trend, level: mv.level, t: boT, ext: A.ext ? A.ext.p : NaN, far: A.trend > 0 ? mv.bot : mv.top },
          { events: LA.events.map(function (e) { return { dir: e.dir, level: e.level, structure: e.structure, t: Lw[e.breakIdx] ? Lw[e.breakIdx].time : Infinity, fromT: Lw[e.fromIdx] ? Lw[e.fromIdx].time : 0, top: e.top, bot: e.bot }; }), bars: Lw }, o.buf == null ? sizes(mk, L[i].close).buf : o.buf);
        // a trade is recorded only AT the candle whose close is its EG, as the chart read then: the window slides, so a later
        // look could re-read an old stretch and "find" an entry days after the fact (21 Nov 2026, independent audit)
        // the method's own entry at the CF is the BARRIER entry (the pages: "before CF or after CF, using the barrier entry"):
        // each clean CF zone is handed over once, at the candle that first shows it, for barrierTrades to read as a barrier
        if (o.cfOut && M && M.cf && M.vr && M['case'] !== 2 && !cfSeen[l + '|' + M.cf.t]) { cfSeen[l + '|' + M.cf.t] = 1;
          o.cfOut.push({ tf: l, dir: A.trend, lo: M.cf.lo, hi: M.cf.hi, kind: 'cf', known: L[i].time + SEC[l], of: NAME[h], tgt: M.vr.ext }); }
        if (!M || !M.trade || M.trade.fillT !== L[i].time || !(M.trade.fillT + SEC[l] >= from)) continue;
        // a CF INSIDE the VR is the method's "likely to fail" case: wait, do not enter (21 Nov 2026, the documents checked page by page)
        if (M['case'] === 2 && !o.case2) continue;
        var k = h + '|' + boT + '|' + M.trade.fillT; if (map[k]) continue;
        var tr = map[k] = { id: pre + 'sop-' + l + '-' + M.trade.fillT, market: mk, kind: 'sop', h: h, l: l, side: M.trade.side, t: M.trade.fillT + SEC[l], entry: M.trade.entry, stop: M.trade.stop, target: M.trade.target,
          r0: Math.abs(M.trade.entry - M.trade.stop), 'case': M['case'], again: !!(M.cf && M.cf.again), deep: M.deep == null ? null : !!M.deep };
        tr.log = [
          { t: boT + SEC[h], text: NAME[h] + ' BO ' + word(A.trend) + ': a candle closed ' + (A.trend > 0 ? 'above ' : 'below ') + f2(mv.level) + '.' },
          { t: M.vr.t + SEC[l], text: NAME[l] + ' VR: the first BO Structure (QM) against the BO. The VR runs ' + f2(M.vr.lo) + ' to ' + f2(M.vr.hi) + '; its extreme ' + f2(M.vr.ext) + ' is the target.' },
          { t: M.cf.t + SEC[l], text: NAME[l] + ' CF' + (M.cf.again ? ' (a new one, after the first failed)' : '') + ': the BO Structure (QM) back with the BO' + (M.p50 != null ? (M.deep ? ', after the pullback reached 50% of the range (' + f2(M.p50) + ')' : ', before the pullback reached 50% of the range (' + f2(M.p50) + ')') : '') + '. The CF zone is ' + f2(M.cf.lo) + ' to ' + f2(M.cf.hi) + (M['case'] === 2 ? ', inside the VR: the kind that often fails.' : ', clear of the VR.') },
          { t: tr.t, text: 'Price pulled back into the CF zone and an EG closed with the BO: ' + word(tr.side) + ' ' + f2(tr.entry) + ', stop ' + f2(tr.stop) + ' (' + U + f2(sizes(mk, tr.entry).buf) + ' past the pullback\'s extreme, risk ' + U + f2(tr.r0) + '), target ' + f2(tr.target) + ' (' + (Math.abs(tr.target - tr.entry) / tr.r0).toFixed(1) + 'R).' }];
        // what the chart draws for this trade (assets/mosha-replay.js): the BO level, the VR box, the CF zone, each from the moment it was known
        tr.marks = [{ kind: 'level', p: mv.level, a: boT, at: boT + SEC[h], label: NAME[h] + ' BO' },
          { kind: A.trend > 0 ? 'vr' : 'bvr', top: M.vr.hi, bot: M.vr.lo, a: M.vr.t, at: M.vr.t + SEC[l], label: NAME[l] + ' VR' },
          { kind: 'zone', top: M.cf.hi, bot: M.cf.lo, a: M.cf.t, at: M.cf.t + SEC[l], label: NAME[l] + ' CF zone' }];
        if (M.p50 != null) tr.marks.push({ kind: 'level', p: M.p50, a: boT, at: M.vr.t + SEC[l], label: '50% of the range', under: A.trend > 0 });
        out.push(tr);
      }
    });
    out.forEach(function (tr) { finish(tr, outcome(tr, fine, tr.t)); });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // every barrier of one timeframe with the moment it was known and the moment price first came back to it
  function zonesOf(tf, B, F) {
    var H = B[tf]; if (!H || !H.length) return [];
    var A = F.msAnalyze(H, PIVOT), brk = A.events.map(function (e) { return { dir: e.dir, fromIdx: e.fromIdx, breakIdx: e.breakIdx, kind: 'bo' }; })
      .concat(F.msInternal(H, H.length, 3).map(function (e) { return { dir: e.dir, fromIdx: e.fromIdx, breakIdx: e.breakIdx, kind: 'ibo' }; }))
      .sort(function (x, y) { return x.breakIdx - y.breakIdx; });   // msZones keeps one zone a candle, the first listed: the EARLIEST break of an origin, so a later BO never makes a visited zone fresh again
    return F.msZones(H, brk, H.length).map(function (z) { return { tf: tf, dir: z.dir, lo: z.lo, hi: z.hi, kind: z.kind, known: H[z.breakIdx].time + SEC[tf], touch: z.touchIdx != null ? H[z.touchIdx].time : null }; });
  }
  // 2. the barrier entry. A zone's box is drawn from candles up to its break only; `touch` says when price came back, never which zone.
  function barrierTrades(B, F, o) {
    o = o || {}; var from = o.from, rows = [], mk = mkOf(o.market), f2 = fmt(mk), U = unit(mk), pre = mk === 'xau' ? '' : mk + ':';
    var fk = B['1m'] && B['1m'].length ? '1m' : '5m', fine = B[fk] || [];
    var at = function (A, t) { var lo = 0, hi = A.length; while (lo < hi) { var m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
    // The method: a barrier WITH the direction runs, one against it "only gives a rejection". The direction here is the
    // structure of the timeframe above the barrier's (D1 over H4, H4 over H1, H1 over M15; a D1 barrier has none), read on its
    // candles CLOSED when price came back. Recorded on the trade (`withDir`) and named in its label and log; the entry, the
    // stop and the 3R target are the same either way (the method gives no other target), so the record shows the two apart.
    var UP = { '4h': '1d', '1h': '4h', '15m': '1h' }, dirMemo = {};
    var dirAt = function (tf, t) { var H = B[tf] || [], n = at(H, t - SEC[tf] + 1), k = tf + n; if (!(k in dirMemo)) { var Hw = H.slice(Math.max(0, n - WIN), n), A = Hw.length > 20 ? F.msAnalyze(Hw, PIVOT) : null; dirMemo[k] = A && A.trend ? A.trend : 0; } return dirMemo[k]; };
    BARRIER.forEach(function (pair) {
      var zt = pair[0], ctf = pair[1], C = B[ctf] || []; if (!C.length || !(B[zt] || []).length) return;
      // the CF zones the sequence handed over (o.extra): the first candle after the zone was known that trades into it is its return
      var own = (o.extra || []).filter(function (z) { return z.tf === zt; }).map(function (z) { var Z = B[zt], q = at(Z, z.known), tch = null;
        for (; q < Z.length; q++) if (z.dir < 0 ? Z[q].high >= z.lo : Z[q].low <= z.hi) { tch = Z[q].time; break; }
        return { tf: zt, dir: z.dir, lo: z.lo, hi: z.hi, kind: 'cf', known: z.known, touch: tch, of: z.of, tgt: z.tgt }; });
      zonesOf(zt, B, F).concat(own).filter(function (z) { return z.touch && z.touch + SEC[zt] > from - BARRIER_WATCH * SEC[ctf] && z.hi - z.lo > sizes(mk, z.hi).zmin && (!o.until || z.touch < o.until); }).forEach(function (z) {
        var d = z.dir, t0 = z.touch, x = d < 0 ? -Infinity : Infinity, sig = null, h = z.hi - z.lo, i;
        // z.touch is the OPEN time of the barrier-timeframe candle that came back: the moment itself is read on the finest candles
        // that reach back to it, and the confirmation is looked for from the candle that holds that moment, never before it
        // (until 21 Nov 2026 a QM that closed earlier inside that candle, before price was at the barrier, was taken)
        var TF = fine.length && fine[0].time <= t0 ? fine : (B['5m'] || []), q = at(TF, t0), hit = -1;
        for (; q < TF.length && TF[q].time < t0 + SEC[zt]; q++) if (d < 0 ? TF[q].high >= z.lo : TF[q].low <= z.hi) { hit = q; break; }
        if (hit < 0) return; t0 = TF[hit].time;
        var lim = t0 + BARRIER_WATCH * SEC[ctf];
        for (i = at(C, t0 - SEC[ctf] + 1); i < C.length && C[i].time < lim; i++) { var c = C[i]; if (o.until && c.time + SEC[ctf] > o.until) break; x = d < 0 ? Math.max(x, c.high) : Math.min(x, c.low);
          if (d < 0 ? c.close > z.hi + h : c.close < z.lo - h) break;                                  // closed well through the barrier: it did not hold
          var W = C.slice(Math.max(0, i - 240), i + 1), ev = F.msInternal(W, W.length, 3), e = ev[ev.length - 1];
          if (e && e.dir === d && e.structure && e.breakIdx === W.length - 1 && W[e.fromIdx].time >= t0 - 30 * SEC[ctf]) { sig = { i: i, level: e.level, t: c.time + SEC[ctf] }; break; } }
        if (!sig) return;
        // the pullback entry: a limit at the level the CF broke, for the next BARRIER_FILL confirmation candles, read on the finest candles
        var end = sig.t + BARRIER_FILL * SEC[ctf], fi = -1;
        for (i = at(fine, sig.t); i < fine.length && fine[i].time < end; i++) { var b = fine[i]; if (o.until && b.time + SEC[fk] > o.until) break;
          if (d < 0 ? b.high >= sig.level : b.low <= sig.level) { fi = i; break; }
          x = d < 0 ? Math.max(x, b.high) : Math.min(x, b.low); }
        if (fi < 0 || !(fine[fi].time >= from)) return;
        var entry = sig.level, Z0 = sizes(mk, entry), stop = d < 0 ? x + Z0.buf : x - Z0.buf, r0 = Math.abs(entry - stop); if (!(r0 > Z0.rmin) || r0 > Z0.rmax || (d < 0 ? stop <= entry : stop >= entry)) return;
        var cf = z.kind === 'cf', src = z.kind === 'bo' ? 'BO' : 'iBO', up = UP[zt], ud = up ? dirAt(up, t0) : 0, wd = ud ? ud === d : null;
        var tr = { id: pre + 'bar-' + (cf ? 'cf-' : '') + zt + '-' + fine[fi].time, market: mk, kind: 'barrier', label: (cf ? NAME[zt] + ' CF barrier · ' + z.of + ' BO' : NAME[zt] + ' barrier · ' + src + ' origin') + (wd == null ? '' : wd ? ' · with ' + NAME[up] : ' · against ' + NAME[up]), withDir: wd, h: zt, l: ctf, side: d, t: fine[fi].time, entry: entry, stop: stop, target: d < 0 ? entry - BARRIER_R * r0 : entry + BARRIER_R * r0, r0: r0, zone: z };
        // a CF barrier keeps the sequence's own target, the VR's extreme, when that is at least 1R away on the winning side
        var vrT = cf && isFinite(z.tgt) && d * (z.tgt - entry) >= r0; if (vrT) tr.target = z.tgt;
        tr.log = [
          { t: z.known, text: NAME[zt] + ' barrier: a fresh ' + (d < 0 ? 'supply' : 'demand') + ' zone ' + f2(z.lo) + ' to ' + f2(z.hi) + (cf ? ', the CF zone of the ' + z.of + ' BO ' + word(d) + ' (the sequence\'s own entry, taken as a barrier).' : ', the origin of ' + (z.kind === 'bo' ? 'a BO' : 'an internal BO') + ' ' + word(d) + '.') },
          { t: t0, text: 'Price came back to the barrier for the first time. Its confirmation is read on ' + NAME[ctf] + '.' + (wd == null ? '' : wd ? ' The barrier is with the ' + NAME[up] + ' direction (' + word(ud) + ').' : ' The barrier is AGAINST the ' + NAME[up] + ' direction (' + word(ud) + '): the method expects only a rejection from it.') },
          { t: sig.t, text: NAME[ctf] + ' CF: a QM (BO Structure) ' + word(d) + ', a candle closed ' + (d > 0 ? 'above ' : 'below ') + f2(sig.level) + '. A ' + word(d) + ' limit rests at that level for the pullback.' },
          { t: tr.t, text: 'Price pulled back to the level: ' + word(d) + ' ' + f2(entry) + ', stop ' + f2(stop) + ' (' + U + f2(Z0.buf) + ' past the extreme ' + f2(x) + ' made at the barrier, risk ' + U + f2(r0) + '), target ' + f2(tr.target) + (vrT ? ' (the VR\'s extreme, ' + (Math.abs(tr.target - entry) / r0).toFixed(1) + 'R).' : ' (' + BARRIER_R + 'R: the replay\'s own choice, the method names no fixed target here).') }];
        tr.marks = [{ kind: 'zone', top: z.hi, bot: z.lo, a: z.known - SEC[zt], at: z.known, label: NAME[zt] + (cf ? ' CF zone (barrier)' : ' barrier') },
          { kind: 'level', p: sig.level, a: t0, at: sig.t, label: NAME[ctf] + ' CF (QM)', under: d < 0 },
          { kind: 'level', p: x, a: t0, at: sig.t, label: 'Extreme at the barrier', under: d > 0 }];
        tr._f = fi; rows.push(tr);
      });
    });
    rows.sort(function (a, b) { return a.t - b.t; });
    var keep = []; rows.forEach(function (r) { if (!keep.some(function (k) { return k.side === r.side && Math.abs(k.t - r.t) < 1200; })) keep.push(r); });   // barriers of two timeframes often overlap: one entry
    keep.forEach(function (tr) { delete tr._f; finish(tr, outcome(tr, fine, tr.t, true)); });
    return keep;
  }
  function finish(tr, oc) {
    tr.status = oc.status; tr.R = oc.R; tr.endT = oc.endT; tr.exit = oc.exit; tr.mfe = oc.mfe; tr['float'] = oc['float'];
    tr.log.push(oc.status === 'target' ? { t: oc.endT, text: 'Target reached: ' + (tr.R >= 0 ? '+' : '') + tr.R.toFixed(2) + 'R.' }
      : oc.status === 'stopped' ? { t: oc.endT, text: 'Stopped: −1.00R' + (oc.mfe >= 1 ? ' after running +' + oc.mfe.toFixed(1) + 'R first.' : '.') }
      : { t: null, text: 'Still open on the last candle read' + (oc['float'] != null ? ' (' + (oc['float'] >= 0 ? '+' : '−') + Math.abs(oc['float']).toFixed(2) + 'R now).' : '.') });
  }
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
    return '<h3 class="mo-sop-h mo-cal-k">P&amp;L calendar <small>closed R by the UTC day each trade ended · open trades not added in · before costs</small>' + nav + '</h3><div class="mo-cal">' + grid + '</div>' + list;
  }
  var API = { calMonth: calMonth, calHTML: calHTML, MARKETS: MARKETS, ALL: ALL, sizes: sizes, fmt: fmt, unit: unit, SEC: SEC, LADDER: LADDER, BACK: BACK, DAYS: DAYS, BARRIER_R: BARRIER_R, BARRIER: BARRIER, MIN_JUDGE: MIN_JUDGE, outcome: outcome, sopTrades: sopTrades, barrierTrades: barrierTrades, zonesOf: zonesOf, summary: summary, byDay: byDay,
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
      if (j && !force) { S.rows = j.records.slice().sort(function (a, b) { return b.t - a.t; }); S.file = { at: j.at, through: j.through, since: j.since }; S.state = 'done'; S.at = Date.now(); draw(); return; }
      S.file = null; S.state = 'idle'; replay();
    });
  }
  function replay() {
    var F = fns(); if (S.state === 'busy') return; if (!F) { S.state = 'failed'; S.err = 'no page functions'; draw(); return; } S.state = 'busy'; S.err = ''; draw();
    var now = Math.floor(Date.now() / 1000), B = {}, p = Promise.resolve();
    Object.keys(BACK).forEach(function (tf) { p = p.then(function () { return bars(tf, now).then(function (a) { B[tf] = a; }); }); });
    p.then(function () { return new Promise(function (ok) { setTimeout(ok, 30); }); }).then(function () {
      if (!B['5m'].length) throw new Error('no candles');
      var from = B['5m'][B['5m'].length - 1].time - DAYS * 86400, cfz = [], a = sopTrades(B, F, { from: from, cfOut: cfz });
      return new Promise(function (ok) { setTimeout(function () { ok(a.concat(barrierTrades(B, F, { from: from, extra: cfz }))); }, 30); });
    }).then(function (rows) { S.rows = rows.sort(function (a, b) { return b.t - a.t; }); S.state = 'done'; S.at = Date.now(); }, function (e) { S.state = 'failed'; S.err = String(e && e.message || e); }).then(draw);
  }
  function line(name, rows, extra) {
    var s = summary(rows), parts = [s.n + (s.n === 1 ? ' entry' : ' entries')];
    if (s.closed) parts.push(s.wins + ' reached target, ' + (s.closed - s.wins) + ' stopped', fR(s.total) + ' before costs'); if (s.open) parts.push(s.open + ' still open');
    return '<p class="mo-sys-l"><b>' + esc(name) + '</b>: ' + esc(parts.join(' · ')) + '. ' + (s.closed < MIN_JUDGE ? 'Too few to judge (' + s.closed + ' of ' + MIN_JUDGE + ' closed).' : 'One reading on past candles, not a tested rule (t ' + (s.t == null ? 'n/a' : s.t.toFixed(2)) + ').') + (extra ? ' ' + esc(extra) : '') + '</p>';
  }
  function rowHTML(r) {
    var res = r.status === 'target' ? '<b class="pos">' + fR(r.R) + '</b> · target' : r.status === 'stopped' ? '<b class="neg">' + fR(r.R) + '</b> · stopped' : '<b>Open</b>' + (r['float'] != null ? ' · ' + fR(r['float']) + ' now' : '');
    var op = !!S.open[r.id], kind = r.kind === 'sop' ? NAME[r.h] + ' BO → ' + NAME[r.l] + ' VR, CF' + (r['case'] === 2 ? ' · CF inside the VR' : '') : NAME[r.h] + (/CF barrier/.test(r.label || '') ? ' CF barrier → ' : ' barrier → ') + NAME[r.l] + ' QM' + (r.withDir == null ? '' : r.withDir ? ' · with the direction' : ' · against the direction');
    return '<tr><td class="mo-c-time"><span class="mo-when">' + utc(r.t) + '</span><small>' + esc(kind) + ' · ' + esc(ALL[mkR(r)].name) + '</small></td>' +
      '<td class="mo-c-side"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span>' + (r.src ? ' <small class="mo-sop-src">' + (r.src === 'live' ? 'live' : 'replay') + '</small>' : '') + '</td>' +
      '<td class="n" data-l="Entry">' + fP(r, r.entry) + '</td><td class="n" data-l="Stop">' + fP(r, r.stop) + '</td><td class="n" data-l="Target">' + fP(r, r.target) + '</td>' +
      '<td class="mo-c-res"><div class="mo-ex">' + res + '<small>' + (r.endT ? 'ended ' + utc(r.endT) + ' · ' : '') + 'risk ' + unit(mkR(r)) + fP(r, r.r0) + '</small></div>' +
      '<div class="mo-sop-a"><button type="button" class="mo-sop-b" data-sop-log="' + esc(r.id) + '" aria-expanded="' + op + '">' + (op ? 'Hide the log' : 'Log') + '</button><button type="button" class="mo-sop-b" data-sop-chart="' + esc(r.id) + '">Chart</button></div>' +
      (op ? '<ol class="mo-sop-log">' + r.log.map(function (x) { return '<li>' + (x.t ? '<span>' + utc(x.t) + '</span> ' : '') + esc(x.text) + '</li>'; }).join('') + '</ol>' : '') + '</td></tr>';
  }
  // Open now (21 Nov 2026, owner: "the same panel with active trades like ict desk"): one card per open paper trade of the
  // tracker's record, every market, whatever filter the table below is on. R now is the tracker's last reading, not a live quote.
  function openCard(r) {
    var m = mkR(r), tR = Math.abs(r.target - r.entry) / (r.r0 || Math.abs(r.entry - r.stop)), fl = r['float'], hi = Math.max(3, Math.ceil(tR)), lo = -1;
    var pc = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1); }, z = pc(0);
    var fill = fl == null ? '' : '<i class="' + (fl >= 0 ? 'up' : 'dn') + '" style="left:' + (fl >= 0 ? z : pc(fl)) + '%;width:' + Math.abs(pc(fl) - z).toFixed(1) + '%"></i>';
    var kind = r.kind === 'sop' ? NAME[r.h] + ' BO → ' + NAME[r.l] + ' VR, CF' : NAME[r.h] + (/CF barrier/.test(r.label || '') ? ' CF barrier → ' : ' barrier → ') + NAME[r.l] + ' QM' + (r.withDir == null ? '' : r.withDir ? ' · with the direction' : ' · against the direction');
    return '<li data-sop-chart="' + esc(r.id) + '" tabindex="0" role="button" aria-label="' + esc(word(r.side) + ' ' + ALL[m].name + ', ' + (fl == null ? 'no reading yet' : fR(fl) + ' at the last reading') + ', open, view the chart') + '">' +
      '<div class="r1"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span><b class="mk">' + esc(ALL[m].name) + '</b><span class="pl">' + esc(kind) + '</span>' + (r.src ? '<span class="pl">' + (r.src === 'live' ? 'live' : 'replay') + '</span>' : '') +
      '<span class="live ' + (fl == null ? '' : fl >= 0 ? 'pos' : 'neg') + '">' + (fl == null ? '<small>no reading yet</small>' : fR(fl) + '<small>at the last reading</small>') + '</span></div>' +
      '<div class="trk" aria-hidden="true">' + fill + '<span style="left:' + z + '%"></span><span style="left:' + pc(Math.min(hi, tR)) + '%"></span></div>' +
      '<div class="trk-l" aria-hidden="true"><span style="left:0">−1R stop</span><span style="left:' + z + '%">0</span><span style="left:100%">' + (tR <= hi ? 'target ' : '') + '+' + hi + 'R</span></div>' +
      '<dl><div><dt>Entry</dt><dd>' + fP(r, r.entry) + '</dd></div><div><dt>Stop</dt><dd>' + fP(r, r.stop) + '</dd></div><div><dt>Target</dt><dd>' + fP(r, r.target) + ' · ' + tR.toFixed(1) + 'R</dd></div><div><dt>Best so far</dt><dd>' + (r.mfe != null ? '+' + (+r.mfe).toFixed(2) + 'R' : '—') + '</dd></div></dl>' +
      '<p class="nt">Open since ' + utc(r.t) + ' · risk ' + unit(m) + fP(r, r.r0) + '</p></li>';
  }
  function openPanel(open) {
    var box = $('mo-open'), l = $('mo-open-l'), n = $('mo-open-n'); if (!box || !l) return;
    var ok = API.visible(document.documentElement.dataset); box.hidden = !ok; if (!ok) return;
    if (S.state !== 'done') { l.innerHTML = '<li class="empty">' + (S.state === 'failed' ? 'The open trades could not be read.' : 'Reading the open trades…') + '</li>'; if (n) n.textContent = ''; return; }
    open = open.slice().sort(function (a, b) { return b.t - a.t; });
    if (n) n.textContent = open.length ? open.length + ' open · paper only' + (S.file && S.file.at ? ' · last reading ' + utc(Math.floor(Date.parse(S.file.at) / 1000)) : '') : '';
    l.innerHTML = open.length ? open.map(openCard).join('') : '<li class="empty">No trade is open now. ' + (S.file ? 'The tracker reads gold, silver, EUR/USD, GBP/USD and the Nasdaq 100 about every 35 minutes' + (S.file.at ? ' (last reading ' + utc(Math.floor(Date.parse(S.file.at) / 1000)) + ')' : '') + '; a new entry shows here until its stop or target.' : 'A new entry shows here until its stop or target.') + '</li>';
  }
  API.openCard = openCard;
  function draw() {
    var box = $('mo-sopr'); if (!box) return; var ok = API.visible(document.documentElement.dataset); box.hidden = !ok; if (!ok) return;
    if (S.state !== 'done') openPanel([]);
    var head = '<div class="ms-k"><span>Mosha trades</span><small>the method as the course documents write it, on gold and four more markets · recorded by the desk\'s tracker like the ICT desk · paper only · each trade with its log</small></div>';
    if (S.state === 'idle' || S.state === 'busy') { box.innerHTML = head + '<div class="ct-empty">' + (S.state === 'busy' ? 'Reading the trades…' : 'The trades load when the desk opens.') + '</div>'; return; }
    if (S.state === 'failed') { box.innerHTML = head + '<div class="ct-empty">The tracker has no stored trades yet and the candles could not be read, so there is nothing to show. <button type="button" class="mo-sop-b" data-sop-run>Try again</button></div>'; return; }
    var every = S.rows || [], nLive = every.filter(function (r) { return r.src === 'live'; }).length, bySrc = S.file && S.src !== 'both' ? every.filter(function (r) { return (r.src === 'live') === (S.src === 'live'); }) : every, mks = Object.keys(MARKETS).filter(function (k) { return bySrc.some(function (r) { return mkR(r) === k; }); }), all = S.mk === 'all' || mks.indexOf(S.mk) < 0 ? bySrc : bySrc.filter(function (r) { return mkR(r) === S.mk; }), sop = all.filter(function (r) { return r.kind === 'sop'; }), bar = all.filter(function (r) { return r.kind === 'barrier'; });
    var list = S.flt === 'sop' ? sop : S.flt === 'barrier' ? bar : all, shown = S.all ? list : list.slice(0, 30);
    var chip = function (k, t, n) { return '<button type="button" class="mo-sop-b" data-sop-flt="' + k + '" aria-pressed="' + (S.flt === k) + '">' + t + ' (' + n + ')</button>'; };
    var sm = summary(list), open = all.filter(function (r) { return r.R == null; }), last = all[0];
    var ans = (open.length ? open.length + (open.length === 1 ? ' trade is' : ' trades are') + ' open now. ' : 'No trade is open now. ') + (last ? 'Latest entry: ' + ALL[mkR(last)].name + ' ' + word(last.side) + ' at ' + fP(last, last.entry) + ', ' + utc(last.t) + '.' : '');
    var tile = function (k, v, sub, cls) { return '<div class="mo-sop-tile"><small>' + k + '</small><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b><span>' + sub + '</span></div>'; };
    var tiles = '<div class="mo-sop-tiles">' + tile('Entries', sm.n, sm.open + ' open') + tile('Reached target', sm.closed ? sm.wins + ' of ' + sm.closed : '—', sm.closed ? Math.round(100 * sm.wins / sm.closed) + '% of closed' : 'none closed') +
      tile('Total, before costs', sm.closed ? fR(sm.total) : '—', sm.closed ? fR(sm.mean) + ' a trade' : 'none closed', sm.total > 0 ? 'pos' : sm.total < 0 ? 'neg' : '') + tile('Can it be judged?', sm.closed < MIN_JUDGE ? 'Too few' : 'Not a test', sm.closed < MIN_JUDGE ? sm.closed + ' of ' + MIN_JUDGE + ' closed' : 't ' + (sm.t == null ? 'n/a' : sm.t.toFixed(2)) + ' · a paper record') + '</div>';
    var openHTML = ''; openPanel(every.filter(function (r) { return r.R == null; }));
    var cal = calHTML(list, S, 'data-sop-chart', function (r) { return ALL[mkR(r)].name + ' · ' + (r.kind === 'sop' ? NAME[r.h] + ' BO, ' + NAME[r.l] + ' VR and CF' : NAME[r.h] + ' barrier, ' + NAME[r.l] + ' QM'); });
    box.innerHTML = head + '<p class="mo-sop-ans">' + esc(ans) + '</p>' +
      '<div class="mo-sop-a mo-sop-f">' + chip('all', 'All', all.length) + chip('sop', 'BO, VR, CF', sop.length) + chip('barrier', 'Barrier entry', bar.length) + (S.file ? '<span class="mo-sop-sep" aria-hidden="true"></span>' + ['both', 'live', 'replay'].map(function (k) { return '<button type="button" class="mo-sop-b" data-sop-src="' + k + '" aria-pressed="' + (S.src === k) + '">' + (k === 'both' ? 'Both' : k === 'live' ? 'Live (' + nLive + ')' : 'Replay (' + (every.length - nLive) + ')') + '</button>'; }).join('') : '') +
      '<button type="button" class="mo-sop-b" data-sop-run>Refresh</button></div>' +
      (mks.length > 1 ? '<div class="mo-sop-a mo-sop-f">' + ['all'].concat(mks).map(function (k) { return '<button type="button" class="mo-sop-b" data-sop-mk="' + k + '" aria-pressed="' + ((S.mk === k) || (k === 'all' && mks.indexOf(S.mk) < 0)) + '">' + (k === 'all' ? 'All markets' : esc(MARKETS[k].name)) + ' (' + (k === 'all' ? bySrc.length : bySrc.filter(function (r) { return mkR(r) === k; }).length) + ')</button>'; }).join('') + '</div>' : '') +
      '<p class="ms-note mo-sop-st">' + (S.file ? 'Recorded by the tracker in the council loop, about every 35 minutes' + (S.file.at ? ' · last run ' + utc(Math.floor(Date.parse(S.file.at) / 1000)) : '') + (S.file.since ? ' · trades since ' + utc(S.file.since).slice(0, 10) : '') + '. Live = the tracker recorded it within an hour of its entry; Replay = worked out afterwards from the same closed candles.' : 'The tracker has no stored trades yet, so these were worked out in this browser from the last two weeks of candles.') + '</p>' +
      tiles + openHTML +
      '<h3 class="mo-sop-h">Trades</h3>' +
      (shown.length ? '<div class="ct-tw"><table class="ct-t mo-t" aria-label="Replayed trades of the Mosha reading"><thead><tr><th>Entry time</th><th>Side</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th>Result and log</th></tr></thead><tbody>' + shown.map(rowHTML).join('') + '</tbody></table></div>' +
        (list.length > shown.length ? '<p class="ms-note"><button type="button" class="mo-sop-b" data-sop-all>Show all ' + list.length + '</button></p>' : '') : '<div class="ct-empty">No trade to show.</div>') +
      cal +
      '<details class="mo-sop-more"><summary>By entry type, and what this is</summary>' + line('BO, VR, CF', sop) + line('Barrier entry', bar, 'It takes every fresh barrier; the method says to mark the best one, and that choice is not in the replay.') +
      (bar.some(function (r) { return r.withDir != null; }) ? line('Barrier with the direction of the timeframe above', bar.filter(function (r) { return r.withDir === true; })) + line('Barrier against it', bar.filter(function (r) { return r.withDir === false; }), 'The method expects only a rejection from a barrier against the direction; the replay gives both the same 3R target, so the two are shown apart.') : '') +
      '<p class="ms-note">A replay on past candles of how the desk reads the method: every step uses closed candles only and nothing after a candle decides it. Results are before costs, a stop is counted first when one candle holds both. On a market other than gold the stop buffer and the size limits are the same share of price as on gold: the desk\'s own choice. These are not Luxus\'s trades and not the council\'s, nothing was traded, and a replay of one reading cannot show whether a rule makes money: the fixed-rule studies of this method failed (<a href="/edge-lab.html#mosha-sweep">the sweep study</a>).</p></details>';
  }
  function byId(id) { return (S.rows || []).filter(function (r) { return r.id === id; })[0]; }
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#mo-open li[data-sop-chart]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#mo-open [data-sop-chart], #mo-sopr [data-cal-m], #mo-sopr [data-cal-day], #mo-sopr [data-sop-log], #mo-sopr [data-sop-chart], #mo-sopr [data-sop-flt], #mo-sopr [data-sop-src], #mo-sopr [data-sop-mk], #mo-sopr [data-sop-run], #mo-sopr [data-sop-all]') : null; if (!b) return;
    if (b.hasAttribute('data-cal-m')) { if (b.getAttribute('data-cal-m')) { S.calM = b.getAttribute('data-cal-m'); S.calDay = null; draw(); } return; }
    if (b.hasAttribute('data-cal-day')) { var cd = b.getAttribute('data-cal-day'); S.calDay = S.calDay === cd ? null : cd; draw(); var nd = document.querySelector('#mo-sopr [data-cal-day="' + cd + '"]'); if (nd) nd.focus(); return; }
    if (b.hasAttribute('data-sop-src')) { S.src = b.getAttribute('data-sop-src'); S.all = false; draw(); return; }
    if (b.hasAttribute('data-sop-mk')) { S.mk = b.getAttribute('data-sop-mk'); S.all = false; draw(); return; }
    if (b.hasAttribute('data-sop-run')) { S.all = false; run(); return; }
    if (b.hasAttribute('data-sop-all')) { S.all = true; draw(); return; }
    if (b.hasAttribute('data-sop-flt')) { S.flt = b.getAttribute('data-sop-flt'); S.all = false; draw(); return; }
    var id = b.getAttribute('data-sop-log') || b.getAttribute('data-sop-chart'), r = byId(id); if (!r) return;
    if (b.hasAttribute('data-sop-log')) { S.open[id] = !S.open[id]; draw(); var nb = document.querySelector('#mo-sopr [data-sop-log="' + id + '"]'); if (nb) nb.focus(); return; }
    var T = { replayed: true, name: (r.kind === 'sop' ? NAME[r.h] + ' BO, ' + NAME[r.l] + ' VR and CF' : NAME[r.h] + ' barrier, ' + NAME[r.l] + ' QM'), marks: r.marks || [], steps: (r.log || []).filter(function (x) { return x.t; }), id: r.id, market: mkR(r), side: word(r.side), at: r.t, entry: +fP(r, r.entry), stop: +fP(r, r.stop), target: +fP(r, r.target), status: r.R != null ? 'closed' : 'open', exit: r.exit != null ? +fP(r, r.exit) : null, exitAt: r.endT, R: r.R, how: r.status };
    if (typeof root.msMoshaReplayDialog === 'function') root.msMoshaReplayDialog(T, document.getElementById('v-mosha')); else if (typeof root.msMoshaReplayTrade === 'function') root.msMoshaReplayTrade(T);
  });
  function go() { var v = $('v-mosha'); if (!v || v.hidden) return; if (API.visible(document.documentElement.dataset) && S.state === 'idle') run(); else draw(); }
  var prev = root.renderMosha;
  root.renderMosha = function () { if (prev) prev(); go(); };
  root.msMoshaSop = go;
  go();
})(typeof window !== 'undefined' ? window : globalThis);
