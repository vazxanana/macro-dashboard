// MeridianX Academy core (owner, 10 Nov 2026: "edges generate candidates; the apprentice decides whether a technically valid
// candidate should be taken, delayed, refused or managed, shows the evidence for and against, admits uncertainty and changes
// its behaviour from the mentor's saved lessons").
//
// What this file is, said plainly: a TRANSPARENT EVIDENCE-WEIGHING POLICY (fixed, documented weights per edge) plus an
// EXPLICIT RULE MEMORY (the mentor's lessons, matched on features). It is not a trained mind. Nothing in here is fitted to
// data, and the only things that change its behaviour are the inputs the caller passes in: the list of lessons, the history
// of earlier candidates, the risk engine's verdict and, optionally, a manually promoted scorer.
//
// Pure and deterministic: no network, no clock (time is snapshot.t), no randomness, no storage. The same snapshot and the
// same options always give the same decision. Browser: window.MXA (a plain <script>); Node: require().
// Contract: docs/academy/ARCHITECTURE.md (sections 3, 5 and 6). The Academy places no orders.
(function (root) {
  'use strict';

  const VERSION = '1.0.0';
  const POLICY_VERSION = 'policy-1.0';      // bump whenever a weight, threshold or gate below changes
  const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800 };
  const LOOK = 300;                         // every feature reads at most the last 300 bars of a timeframe
  const MIN_SIG = 60;                       // bars needed on the signal timeframe
  const MIN_CTX = { '1d': 20, '4h': 30, '1h': 40, '15m': 40, '5m': 40, '1m': 40 };   // bars needed on a context timeframe

  // Every threshold of the policy in one place. decide(…, { limits }) can override any of them (the owner's call).
  const LIMITS = {
    similarMin: 20,        // fewer similar past cases than this: "too few to rely on", confidence capped at medium
    unfamiliarN: 5,        // gate "unfamiliar regime": fewer past cases than this in the current regime …
    historyMin: 30,        // … once the edge has at least this many past cases in total (before that everything is unfamiliar)
    volGate: 2.0,          // gate "abnormal volatility": ATR14 at or above this multiple of its 100-bar median
    minRrNet: 1.0,         // gate: reward to risk after costs below this
    eventAheadH: 12,       // a scheduled high-impact release within the next 12 hours …
    eventBehindH: 2,       // … or one that came out in the last 2 hours counts as "event near"
    tolR: 0.1,             // compare / grade: a level matches when it is within 0.1 of the risk distance
  };

  // ---- small helpers --------------------------------------------------------------------------------------------
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const rd = (v, d = 3) => (fin(v) ? Math.round(v * Math.pow(10, d)) / Math.pow(10, d) + 0 : null);   // "+ 0" turns -0 into 0
  const rp = (v) => rd(v, 5);                                    // prices
  const fmt = (v, d = 2) => (fin(v) ? String(rd(v, d)) : 'n/a');
  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  // canonical JSON (sorted keys) so a hash does not depend on key order
  function stable(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  function fnv1a(s, seed) { let h = (seed === undefined ? 0x811c9dc5 : seed) >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  const hex8 = (n) => ('0000000' + n.toString(16)).slice(-8);
  const hash = (v) => { const s = typeof v === 'string' ? v : stable(v); return hex8(fnv1a(s)) + hex8(fnv1a(s, 0x9747b28c)); };
  function normTf(tf) {
    if (tf == null) return null;
    if (typeof tf === 'number') { const k = Object.keys(TF).find((x) => TF[x] === tf * 60 || TF[x] === tf); return k || null; }
    let s = String(tf).trim().toLowerCase();
    if (TF[s]) return s;
    let m = /^([mhdw])(\d+)$/.exec(s); if (m) s = m[2] + m[1];
    if (s === 'd' || s === 'daily' || s === '1day' || s === 'day') s = '1d';
    if (s === '60m') s = '1h'; if (s === '240m') s = '4h';
    return TF[s] ? s : null;
  }
  const tail = (bars, n) => (Array.isArray(bars) ? (bars.length > (n || LOOK) ? bars.slice(-(n || LOOK)) : bars) : []);
  const actOf = (side) => (side === 'buy' ? 'BUY' : side === 'sell' ? 'SELL' : null);
  const isTake = (a) => a === 'BUY' || a === 'SELL';

  // ---- 1. no look-ahead -----------------------------------------------------------------------------------------
  // Throws when the snapshot holds anything from after snapshot.t:
  //   - a bar that had not closed at t (bar.time + tfSec > t), in snapshot.bars or snapshot.inter.*;
  //   - a candidate dated after t, or a candidate carrying outcome fields (R, netR, exitT, …);
  //   - an item of snapshot.events (releases that are OUT) dated after t;
  //   - an item of snapshot.schedule carrying any key other than t / title / impact.
  // snapshot.schedule is the public calendar of releases still to come: "CPI is due in 3 hours" is knowledge a trader has
  // at t, so those items may be later than t. Their results are not knowledge at t, which is why only the three plain keys
  // are let through.
  const OUTCOME_KEYS = ['R', 'netR', 'exitT', 'exit', 'mfeR', 'maeR', 'outcome', 'result'];
  const SCHEDULE_KEYS = ['t', 'title', 'impact'];
  function assertNoFuture(snapshot) {
    const s = snapshot;
    if (!s || !fin(s.t)) throw new Error('MXA.assertNoFuture: snapshot.t (UTC seconds) is required');
    const chk = (set, where) => {
      for (const tf of Object.keys(set || {})) {
        const sec = TF[tf], b = set[tf];
        if (!sec) throw new Error(`MXA.assertNoFuture: unknown timeframe "${tf}" in ${where}: cannot prove its bars are closed`);
        if (!Array.isArray(b)) continue;
        for (let i = 0; i < b.length; i++) if (!(b[i] && b[i].time + sec <= s.t)) throw new Error(`MXA.assertNoFuture: ${where}.${tf}[${i}] closes at ${b[i] && b[i].time + sec}, after the decision time ${s.t}`);
      }
    };
    chk(s.bars, 'bars');
    for (const k of Object.keys(s.inter || {})) chk(s.inter[k], 'inter.' + k);
    if (s.cand) {
      if (fin(s.cand.t) && s.cand.t > s.t) throw new Error(`MXA.assertNoFuture: the candidate is dated ${s.cand.t}, after the decision time ${s.t}`);
      for (const k of OUTCOME_KEYS) if (s.cand[k] !== undefined) throw new Error(`MXA.assertNoFuture: the candidate carries the outcome field "${k}"`);
    }
    for (const ev of Array.isArray(s.events) ? s.events : []) {
      if (!ev || !fin(ev.t)) throw new Error('MXA.assertNoFuture: snapshot.events holds an item without a time: it cannot be shown to be at or before t');
      if (ev.t > s.t) throw new Error(`MXA.assertNoFuture: event "${ev.title || ''}" at ${ev.t} is later than the decision time ${s.t} (releases still to come belong in snapshot.schedule)`);
    }
    for (const it of Array.isArray(s.schedule) ? s.schedule : []) {
      if (!it || typeof it !== 'object') throw new Error('MXA.assertNoFuture: snapshot.schedule holds something that is not a calendar item');
      for (const k of Object.keys(it)) if (SCHEDULE_KEYS.indexOf(k) < 0) throw new Error(`MXA.assertNoFuture: schedule item "${it.title || ''}" carries the key "${k}": only t, title and impact are allowed (never a result)`);
    }
    return true;
  }

  // ---- indicators (all on closed bars, all window-local) ----------------------------------------------------------
  const trueRange = (b, p) => (p ? Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)) : b.high - b.low);
  // ATR(n) = plain mean of the last n true ranges (not Wilder's: a plain mean depends only on the last n + 1 bars)
  function atrSeries(bars, n) {
    n = n || 14; const out = new Array(bars.length).fill(null);
    for (let i = n; i < bars.length; i++) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += trueRange(bars[j], bars[j - 1]); out[i] = s / n; }
    return out;
  }
  function smaClose(bars, n) { if (bars.length < n) return null; let s = 0; for (let i = bars.length - n; i < bars.length; i++) s += bars[i].close; return s / n; }
  // Fractal pivots: bar i is a swing high when its high is above the k bars on its left and not below the k bars on its right.
  // A pivot at i is only known once bar i + k has closed; every bar here is closed, so nothing is taken from the future.
  function swings(bars, k) {
    k = k || 2; const out = [];
    for (let i = k; i < bars.length - k; i++) {
      let hi = true, lo = true;
      for (let j = 1; j <= k; j++) {
        if (!(bars[i].high > bars[i - j].high && bars[i].high >= bars[i + j].high)) hi = false;
        if (!(bars[i].low < bars[i - j].low && bars[i].low <= bars[i + j].low)) lo = false;
      }
      if (hi) out.push({ i, type: 'H', price: bars[i].high });
      if (lo) out.push({ i, type: 'L', price: bars[i].low });
    }
    return out;
  }
  // alternate highs and lows: of two pivots of the same kind in a row, keep the more extreme one
  function zigzag(piv) {
    const z = [];
    for (const p of piv) {
      const q = z[z.length - 1];
      if (q && q.type === p.type) { if (p.type === 'H' ? p.price >= q.price : p.price <= q.price) z[z.length - 1] = p; } else z.push(p);
    }
    return z;
  }
  // Swing structure of one timeframe: 'up' = higher high AND higher low (HH/HL), 'down' = lower high AND lower low (LH/LL),
  // 'mixed' otherwise, or when the last close has already broken the last swing low of an up structure (and the mirror).
  function structureOf(bars, k) {
    const none = { label: null, lastHigh: null, lastLow: null };
    if (!Array.isArray(bars) || bars.length < 12) return none;
    const b = tail(bars, 120), z = zigzag(swings(b, k || 2)), H = z.filter((p) => p.type === 'H'), L = z.filter((p) => p.type === 'L');
    if (H.length < 2 || L.length < 2) return { label: null, lastHigh: H.length ? H[H.length - 1].price : null, lastLow: L.length ? L[L.length - 1].price : null };
    const h1 = H[H.length - 2], h2 = H[H.length - 1], l1 = L[L.length - 2], l2 = L[L.length - 1], c = b[b.length - 1].close;
    let label = h2.price > h1.price && l2.price > l1.price ? 'up' : h2.price < h1.price && l2.price < l1.price ? 'down' : 'mixed';
    if (label === 'up' && c < l2.price) label = 'mixed';
    if (label === 'down' && c > h2.price) label = 'mixed';
    return { label, lastHigh: h2.price, lastLow: l2.price };
  }
  function maPos(bars) {
    const m20 = smaClose(bars, 20); if (m20 === null) return null;
    const m50 = smaClose(bars, 50), c = bars[bars.length - 1].close;
    if (c > m20 && (m50 === null || c > m50)) return 'above';
    if (c < m20 && (m50 === null || c < m50)) return 'below';
    return 'between';
  }

  // ---- 3. regimes -------------------------------------------------------------------------------------------------
  // QUANTITATIVE DEFINITIONS (C = close, e = the last closed bar, n = 20, r_i = ln(C_i / C_i-1)):
  //   trend strength  ts = ln(C_e / C_e-n) / (sd(r over the last n bars) * sqrt(n))        signed; about N(0, 1) for a random walk
  //   efficiency      er = |C_e - C_e-n| / sum(|C_i - C_i-1| over the last n bars)          0 = pure noise, 1 = a straight line
  //   ATR percentile  p  = share of the last 100 ATR14 values that are below the current ATR14
  //   vol ratio       vr = ATR14 now / median of the last 100 ATR14 values
  // One label, the first that applies:
  //   high-vol   vr >= 1.8
  //   reversal   the highest high of the last 30 bars was made 2..10 bars ago, the 20 bars into it trended up (ts >= 1.0),
  //              and price has since fallen >= 2 ATR AND given back >= half of that 20-bar leg (mirror for a low)
  //   breakout   the last close is beyond the high / low of the 20 bars that ended 3 bars ago, and those 20 bars were
  //              not themselves trending (their efficiency er < 0.35)
  //   trending   |ts| >= 1.0 and er >= 0.30
  //   low-vol    p <= 0.10
  //   ranging    none of the above
  // vol = 'high' (p >= 0.8) | 'low' (p <= 0.2) | 'normal'.  trend = 'up' | 'down' | 'flat' (the direction of the reversal or
  // breakout, otherwise ts >= 1 / ts <= -1).  'event' is not decided here: features() sets it when eventNear is true.
  const REGIME_DEF = {
    n: 20, atrN: 14, pctWindow: 100, minBars: 60,
    highVolRatio: 1.8, trendTs: 1.0, trendEr: 0.30, lowVolPctile: 0.10, volHighPctile: 0.8, volLowPctile: 0.2,
    breakoutBars: 3, breakoutPriorEr: 0.35,
    reversalLookback: 30, reversalMinAge: 2, reversalMaxAge: 10, reversalPriorTs: 1.0, reversalMoveAtr: 2.0, reversalRetrace: 0.5,
    order: ['high-vol', 'reversal', 'breakout', 'trending', 'low-vol', 'ranging'],
    text: {
      'high-vol': 'ATR14 is at least 1.8 times its 100-bar median',
      reversal: 'a 30-bar extreme 2 to 10 bars ago after a trending 20-bar leg (ts >= 1), then >= 2 ATR and >= half of that leg given back',
      breakout: 'the last close is beyond the 20-bar range that ended 3 bars ago, and that range was not trending (er < 0.35)',
      trending: 'trend strength |ln(C/C-20)| / (sd * sqrt(20)) >= 1.0 with efficiency ratio >= 0.30',
      'low-vol': 'ATR14 is in the lowest 10 % of its last 100 values',
      ranging: 'none of the other definitions applies',
      event: 'a high-impact release due within the next 12 hours (snapshot.schedule) or out in the last 2 hours (snapshot.events); set by features, not by regime',
    },
  };
  function trendStats(bars, e, n) {
    if (e - n < 0) return null;
    const r = []; let path = 0;
    for (let i = e - n + 1; i <= e; i++) { r.push(Math.log(bars[i].close / bars[i - 1].close)); path += Math.abs(bars[i].close - bars[i - 1].close); }
    const m = sum(r) / n, sd = Math.sqrt(sum(r, (x) => (x - m) * (x - m)) / (n - 1));
    const net = Math.log(bars[e].close / bars[e - n].close);
    return { ts: sd > 0 ? net / (sd * Math.sqrt(n)) : 0, er: path > 0 ? Math.abs(bars[e].close - bars[e - n].close) / path : 0 };
  }
  function volStats(atrS, e, win) {
    const cur = atrS[e]; if (!fin(cur)) return null;
    const w = []; for (let i = Math.max(0, e - win + 1); i <= e; i++) if (fin(atrS[i])) w.push(atrS[i]);
    if (w.length < 30) return null;
    const below = w.filter((x) => x < cur).length, s = w.slice().sort((a, b) => a - b), med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { atr: cur, pctile: below / (w.length - 1 || 1), ratio: med > 0 ? cur / med : null };
  }
  function regime(bars) {
    const D = REGIME_DEF, none = { label: null, trend: null, vol: null, detail: { text: `needs at least ${D.minBars} closed bars` } };
    if (!Array.isArray(bars) || bars.length < D.minBars) return none;
    const b = tail(bars), e = b.length - 1, n = D.n, atrS = atrSeries(b, D.atrN), T = trendStats(b, e, n), V = volStats(atrS, e, D.pctWindow);
    if (!T || !V || !(V.atr > 0)) return none;
    let label = null, dir = null;
    if (V.ratio !== null && V.ratio >= D.highVolRatio) label = 'high-vol';
    if (!label) {                                              // reversal
      let iH = e, iL = e;
      for (let i = e - D.reversalLookback + 1; i <= e; i++) { if (i < 0) continue; if (b[i].high > b[iH].high) iH = i; if (b[i].low < b[iL].low) iL = i; }
      const tryRev = (ix, up) => {
        const age = e - ix; if (age < D.reversalMinAge || age > D.reversalMaxAge || ix - n < 0) return false;
        const P = trendStats(b, ix, n); if (!P || (up ? P.ts < D.reversalPriorTs : P.ts > -D.reversalPriorTs)) return false;
        let base = up ? Infinity : -Infinity; for (let i = ix - n; i <= ix; i++) base = up ? Math.min(base, b[i].low) : Math.max(base, b[i].high);
        const leg = up ? b[ix].high - base : base - b[ix].low, back = up ? b[ix].high - b[e].close : b[e].close - b[ix].low;
        return back >= D.reversalMoveAtr * V.atr && leg > 0 && back >= D.reversalRetrace * leg;
      };
      const rH = tryRev(iH, true), rL = tryRev(iL, false);
      if (rH && (!rL || iH >= iL)) { label = 'reversal'; dir = 'down'; } else if (rL) { label = 'reversal'; dir = 'up'; }
    }
    if (!label) {                                              // breakout
      const e0 = e - D.breakoutBars, P = trendStats(b, e0, n);
      if (P && e0 - n + 1 >= 0) {
        let hi = -Infinity, lo = Infinity; for (let i = e0 - n + 1; i <= e0; i++) { hi = Math.max(hi, b[i].high); lo = Math.min(lo, b[i].low); }
        if (P.er < D.breakoutPriorEr && b[e].close > hi) { label = 'breakout'; dir = 'up'; } else if (P.er < D.breakoutPriorEr && b[e].close < lo) { label = 'breakout'; dir = 'down'; }
      }
    }
    if (!label && Math.abs(T.ts) >= D.trendTs && T.er >= D.trendEr) label = 'trending';
    if (!label && V.pctile <= D.lowVolPctile) label = 'low-vol';
    if (!label) label = 'ranging';
    const trend = dir || (T.ts >= D.trendTs ? 'up' : T.ts <= -D.trendTs ? 'down' : 'flat');
    const vol = V.pctile >= D.volHighPctile ? 'high' : V.pctile <= D.volLowPctile ? 'low' : 'normal';
    return { label, trend, vol, detail: { ts: rd(T.ts), er: rd(T.er), atrPctile: rd(V.pctile), volRatio: rd(V.ratio), n, text: `${label}: ${D.text[label]} (ts ${fmt(T.ts)}, er ${fmt(T.er)}, ATR percentile ${fmt(V.pctile)}, ATR / median ${fmt(V.ratio)})` } };
  }

  // ---- per-edge relevance ---------------------------------------------------------------------------------------
  // Which factors matter for an edge and how much: w[factor] = [weight when it supports, weight when it contradicts].
  // These numbers are the author's stated priors about each system's logic (a trend follower buys strength, so "premium"
  // costs it nothing; a reversal edge should not buy the top of the range). They are NOT fitted to results. A lesson or an
  // owner-approved policy version is the way to change behaviour, and POLICY_VERSION records which table decided.
  //   tf: the edge's signal timeframe (features are measured on it) · takeMargin: support must beat contradiction by this
  //   minSupport: least total support for a TAKE · allowConflict: opposite lower-timeframe structure is part of the setup
  //   sessions / badSessions: where the edge is meant to trade · regimes.good / .bad · waitFor: what the thesis waits for
  const DEFAULT_PROFILE = {
    name: 'Edge', kind: 'generic', tf: '15m', takeMargin: 1.5, minSupport: 2.5, allowConflict: false, volGate: null,
    sessions: ['london', 'overlap', 'newyork'], badSessions: ['late'],
    regimes: { good: ['trending', 'breakout'], bad: ['high-vol'] },
    waitFor: 'a candidate from the edge that agrees with the higher-timeframe bias, with a confirmed trigger and room to the target',
    w: { htf: [2, 2], ltf: [1, 1], sweep: [1, 1], displacement: [1, 1], momentum: [1, 1], location: [0.75, 0.75], confirm: [1, 1.5],
      rr: [0.5, 1], stop: [0, 0.75], oppLiq: [0.5, 1], vol: [0, 0.75], session: [0.5, 0.75], regime: [1, 1], dxy: [0.75, 1],
      similar: [1, 1], thesis: [0.5, 1], model: [1, 1], event: [0, 2] },
  };
  const EDGE_PROFILE = {
    // Gold replica: an intraday reversal (a run into an extreme, then a change of character). Location and the sweep carry
    // it; momentum against the trade is the setup itself, so it is not penalised.
    replica: { name: 'Gold replica', kind: 'reversal', tf: '15m', allowConflict: true, regimes: { good: ['reversal', 'ranging'], bad: ['high-vol'] },
      waitFor: 'a run into an extreme that takes liquidity, then a change of character back the other way',
      w: { htf: [1, 1], ltf: [0.5, 0], sweep: [1.5, 0.5], momentum: [0.5, 0], location: [1.25, 1.25], confirm: [1.25, 1.5] } },
    // Mosha BO: a D1 / H4 / H1 breakout chain. It buys strength: premium location is free, a sweep that closed back is a
    // failed break and counts against it.
    'mosha-bo': { name: 'Mosha BO', kind: 'breakout', tf: '1h', regimes: { good: ['breakout', 'trending'], bad: ['ranging', 'reversal'] },
      waitFor: 'a break of the level on H1 in line with D1 and H4, closing beyond it with displacement',
      w: { displacement: [1.5, 1], location: [0, 0], sweep: [0.5, 1.5] } },
    // Gold trend (D1, 20-day): pure trend following. Lower timeframes, sessions and location do not matter to it.
    gtrend: { name: 'Gold trend', kind: 'trend', tf: '1d', allowConflict: true, sessions: [], badSessions: [], regimes: { good: ['trending', 'breakout'], bad: ['ranging', 'reversal'] },
      waitFor: 'a daily close that confirms the 20-day trend',
      w: { htf: [2.5, 2.5], ltf: [0, 0], momentum: [1.25, 1.25], location: [0, 0], sweep: [0, 0.5], confirm: [0.5, 0.5], session: [0, 0] } },
    // Gold H4 trendline: trend continuation off an H4 line.
    gtl: { name: 'Gold H4 trendline', kind: 'trend', tf: '4h', allowConflict: true, sessions: [], badSessions: [], regimes: { good: ['trending', 'breakout'], bad: ['ranging'] },
      waitFor: 'a touch and hold of the H4 trendline in the direction of the daily trend',
      w: { ltf: [0.5, 0.5], location: [0.25, 0], session: [0, 0] } },
    // Gold daily engulf: the engulfing day is the confirmation, so the trigger bar carries most of the weight.
    geg: { name: 'Gold daily engulf', kind: 'momentum', tf: '1d', allowConflict: true, sessions: [], badSessions: [], regimes: { good: ['trending', 'breakout', 'reversal'], bad: [] },
      waitFor: 'a daily candle that engulfs the previous one and closes strong',
      w: { htf: [1.5, 1.5], ltf: [0, 0], confirm: [1.5, 1.5], displacement: [1.25, 0.5], location: [0.5, 0.5], session: [0, 0] } },
    // Gold momentum pullback (H1 momentum, M5 pullback entry): the entry bar runs against the lower timeframe by design.
    gmp: { name: 'Gold momentum pullback', kind: 'pullback', tf: '5m', allowConflict: true, regimes: { good: ['trending'], bad: ['ranging', 'high-vol'] },
      waitFor: 'an H1 momentum leg, then an M5 pullback into the zone that holds',
      w: { ltf: [0.5, 0], momentum: [0.5, 0], location: [1, 0.5] } },
    // NQ New York open run: a session edge. The open is always more volatile than the night, so its volatility gate is wider.
    'nq-open': { name: 'NQ New York open run', kind: 'session', tf: '5m', volGate: 4, sessions: ['overlap', 'newyork'], badSessions: ['asia', 'london', 'late'],
      regimes: { good: ['breakout', 'trending', 'high-vol'], bad: ['low-vol'] },
      waitFor: 'the New York open to take one side of the overnight range and run the other way',
      w: { htf: [1, 1], sweep: [1.5, 0.5], displacement: [1.25, 0.75], location: [0, 0], session: [1, 2], vol: [0, 0.25], dxy: [0, 0] } },
  };
  function profileOf(edge) {
    const p = Object.prototype.hasOwnProperty.call(EDGE_PROFILE, edge) ? EDGE_PROFILE[edge] : null;
    return Object.assign({}, DEFAULT_PROFILE, p || {}, { id: p ? edge : 'default', w: Object.assign({}, DEFAULT_PROFILE.w, (p && p.w) || {}) });
  }

  // ---- 2. features ------------------------------------------------------------------------------------------------
  // Every key that features() returns, in plain English. "ATR" is ATR14 of the signal timeframe (sigTf). Keys marked
  // [price] are raw price levels: useful to draw and to anchor a stop, but a lesson may not condition on them (a raw price
  // does not generalise). Keys marked [cand] need a candidate and are null between signals. Missing inputs give null.
  const FEATURE_DOC = {
    // data
    barsOk: 'true when the signal timeframe and every context timeframe at or above it have enough closed bars',
    missingTf: 'comma-separated timeframes that are missing or too short ("" when none)',
    sigTf: 'the timeframe the local features are measured on: the candidate\'s tf when the snapshot has it, else the edge\'s own',
    lastClose: '[price] close of the last closed sigTf bar',
    atr: '[price] ATR14 of sigTf (mean of the last 14 true ranges)',
    // higher-timeframe structure and bias
    structD1: 'D1 swing structure: up (HH/HL) | down (LH/LL) | mixed',
    structH4: 'H4 swing structure: up | down | mixed',
    structH1: 'H1 swing structure: up | down | mixed',
    structM15: 'M15 swing structure: up | down | mixed',
    maPosD1: 'last D1 close against its 20- and 50-day means: above (both) | below (both) | between',
    maPosH4: 'last H4 close against its 20- and 50-bar means: above | below | between',
    distMa20D1: '(last D1 close - 20-day mean) / D1 ATR14',
    htfScore: 'bias score -6..6: D1 structure +-2, H4 structure +-1, D1 means +-2 (between 0), H4 means +-1',
    htfBias: 'up (htfScore >= 2) | down (<= -2) | neutral',
    ltfBias: 'lower-timeframe bias from H1 (x2) and M15 structure: up | down | neutral',
    htfLtfConflict: 'true when htfBias and ltfBias point opposite ways',
    htfSwingHigh: '[price] last confirmed D1 swing high (H4 when D1 has none)',
    htfSwingLow: '[price] last confirmed D1 swing low (H4 when D1 has none)',
    // liquidity
    pdh: '[price] prior day high (the last closed D1 bar)', pdl: '[price] prior day low',
    pwh: '[price] prior week high (the last complete week of D1 bars)', pwl: '[price] prior week low',
    sessHigh: '[price] high of the previous session window (see MXA.SESSIONS)', sessLow: '[price] low of the previous session window',
    eqHigh: '[price] nearest unbroken equal highs (two swing highs within 0.1 ATR) in the last 60 bars', eqLow: '[price] nearest unbroken equal lows',
    eqHighs: 'true when unbroken equal highs exist', eqLows: 'true when unbroken equal lows exist',
    distPdh: '(pdh - lastClose) / ATR: positive while price is below the prior day high', distPdl: '(lastClose - pdl) / ATR: positive while price is above the prior day low',
    distPwh: '(pwh - lastClose) / ATR', distPwl: '(lastClose - pwl) / ATR',
    distSessHigh: '(sessHigh - lastClose) / ATR', distSessLow: '(lastClose - sessLow) / ATR',
    distEqHigh: '(eqHigh - lastClose) / ATR', distEqLow: '(lastClose - eqLow) / ATR',
    // sweeps
    sweep: 'high | low | none: in the last 12 bars a wick went through a prior swing / day / week / session level and the bar closed back (high = buy-side liquidity taken, a bearish sign)',
    sweepAge: 'bars since the sweep bar (0 = the last closed bar)', sweepOf: 'which level was swept: swing | pdh | pdl | pwh | pwl | session',
    sweepDepth: 'how far the wick went through the level, in ATR', sweepLevel: '[price] the swept level',
    // displacement
    displacement: 'up | down | none: in the last 6 bars a body >= 1.2 ATR that is >= 60 % of its bar',
    dispAge: 'bars since the displacement bar', dispSize: 'its body in ATR', dispFvg: 'true when the displacement left a fair-value gap behind',
    fvg: 'bull | bear | none: the most recent unfilled three-bar gap in the last 10 bars', fvgSize: 'its size in ATR',
    // momentum
    roc: '(lastClose - close 10 bars ago) / ATR', consec: 'consecutive closes up (+) or down (-)', momentum: 'up (roc >= 1) | down (roc <= -1) | flat',
    // volatility
    atrPct: 'ATR as a percentage of price', atrPctile: 'share (0..1) of the last 100 ATR values below the current one',
    volRatio: 'ATR / median of the last 100 ATR values', volState: 'low (atrPctile <= 0.2) | normal | high (>= 0.8)', volAbnormal: 'true when volRatio >= 2',
    // time
    session: 'asia 00-07 | london 07-12 | overlap 12-16 | newyork 16-21 | late 21-24 (UTC, from snapshot.t)', dow: 'day of week from snapshot.t (UTC): mon..sun', hourUtc: 'hour of day 0..23 (UTC)',
    // support / resistance and location
    nearRes: '[price] nearest swing high / day / week level above lastClose', nearSup: '[price] nearest swing low / day / week level below lastClose',
    distRes: '(nearRes - lastClose) / ATR', distSup: '(lastClose - nearSup) / ATR', distSR: 'the smaller of distRes and distSup',
    entryLoc: 'where the entry (or lastClose without a candidate) sits in the 50-bar range: 0 = the low, 1 = the high',
    entryZone: 'discount (entryLoc <= 0.4) | equilibrium | premium (>= 0.6)',
    // regime
    regime: 'trending | ranging | breakout | reversal | high-vol | low-vol on sigTf (MXA.REGIME_DEF), or event when eventNear',
    regimeBase: 'the regime label before the event override', regimeTrend: 'up | down | flat from MXA.regime', trendStrength: 'signed trend strength ts', effRatio: 'efficiency ratio er',
    regimeHtf: 'regime label one step up (4h for intraday sigTf, 1d otherwise)',
    // candidate geometry and the candidate against its context
    side: '[cand] buy | sell', rr: '[cand] |target - entry| / |entry - stop| (null without a target)', stopAtr: '[cand] |entry - stop| / ATR', targetAtr: '[cand] |target - entry| / ATR',
    entryOffset: '[cand] (entry - lastClose) / ATR in the trade direction: positive = entering beyond the last close, negative = a pullback entry',
    geomOk: '[cand] true when the stop is on the losing side of the entry and the target on the winning side',
    biasAlign: '[cand] with | against | neutral: the side against htfBias', ltfAlign: '[cand] with | against | neutral: the side against ltfBias',
    sweepFor: '[cand] with (the sweep took the liquidity behind the trade: a low sweep for a buy) | against | none',
    dispFor: '[cand] with | against | none: the displacement against the side', momFor: '[cand] with | against | flat: momentum against the side',
    locFor: '[cand] good (buying discount / selling premium) | poor | mid',
    confirm: '[cand] strong (the trigger bar closed in the trade direction, in the best third of its range, body >= half) | weak | against',
    trigCloseLoc: '[cand] where the trigger bar closed in its range, 0..1 in the trade direction', trigBodyAtr: '[cand] trigger bar body in ATR, signed in the trade direction',
    oppLiq: '[cand] number of resting levels (swing, day, week, session, equal highs / lows) between entry and target (entry + 2R without a target)',
    oppLiqFrac: '[cand] how far along the way to the target the first of them sits, 0..1',
    // intermarket (gold only)
    dxyTrend: 'dollar index trend from snapshot.inter.dxy: up | down | flat (null when absent)', dxyStrength: 'its signed trend strength',
    dxyConflict: '[cand] gold only: true for a gold buy with the dollar rising or a gold sell with the dollar falling (null when absent)',
    // calendar
    eventNear: 'true when a high-impact release in snapshot.schedule is due within the next 12 h, or one in snapshot.events came out in the last 2 h (null when neither list was given)',
    eventMins: 'minutes to the nearest such release (negative = already out)', eventTitle: 'its title',
    eventInH: 'hours to the next scheduled high-impact release, however far (null when no schedule was given or it holds none)',
  };
  const PRICE_KEYS = ['lastClose', 'atr', 'htfSwingHigh', 'htfSwingLow', 'pdh', 'pdl', 'pwh', 'pwl', 'sessHigh', 'sessLow', 'eqHigh', 'eqLow', 'sweepLevel', 'nearRes', 'nearSup'];
  const SESSIONS = { asia: [0, 7], london: [7, 12], overlap: [12, 16], newyork: [16, 21], late: [21, 24] };   // UTC hours
  const SESS_NAMES = ['asia', 'london', 'overlap', 'newyork', 'late'], SESS_EDGE = [0, 7, 12, 16, 21, 24];
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const isGold = (m) => /xau|gold/i.test(String(m || ''));
  const isHigh = (imp) => imp === 3 || ['high', '3', 'red'].indexOf(String(imp).toLowerCase()) >= 0;

  function dayLevels(B, t) {
    const o = { pdh: null, pdl: null, pwh: null, pwl: null, sessHigh: null, sessLow: null, dayFrom: null, sessFrom: null };
    const d = B['1d'];
    if (Array.isArray(d) && d.length) {
      const y = d[d.length - 1]; o.pdh = y.high; o.pdl = y.low; o.dayFrom = y.time + TF['1d'];
      // weeks start on Monday 00:00 UTC; a D1 bar belongs to the week of its midpoint (so a Sunday-evening open counts as Monday)
      const wk = (x) => Math.floor((x + 3 * 86400) / 604800), cur = wk(t); let pw = null, hi = -Infinity, lo = Infinity;
      for (let i = d.length - 1; i >= 0 && i >= d.length - 15; i--) {
        const w = wk(d[i].time + 43200); if (w >= cur) continue;
        if (pw === null) pw = w; if (w !== pw) break;
        hi = Math.max(hi, d[i].high); lo = Math.min(lo, d[i].low);
      }
      if (pw !== null) { o.pwh = hi; o.pwl = lo; }
    }
    const day0 = Math.floor(t / 86400) * 86400, h = (t - day0) / 3600; let k = 0; while (k < 4 && h >= SESS_EDGE[k + 1]) k++;
    const s0 = day0 + SESS_EDGE[k] * 3600, p0 = k > 0 ? day0 + SESS_EDGE[k - 1] * 3600 : day0 - 3 * 3600;
    o.sessFrom = s0; o.session = SESS_NAMES[k];
    const iTf = ['15m', '5m', '1h'].find((tf) => Array.isArray(B[tf]) && B[tf].length);
    if (iTf) {
      const b = B[iTf]; let hi = -Infinity, lo = Infinity;
      for (let i = b.length - 1; i >= 0 && b[i].time >= p0; i--) if (b[i].time + TF[iTf] <= s0) { hi = Math.max(hi, b[i].high); lo = Math.min(lo, b[i].low); }
      if (hi > -Infinity) { o.sessHigh = hi; o.sessLow = lo; }
    }
    return o;
  }
  // a level is "intact" up to bar j when no bar from index a to j - 1 traded through it
  function intact(b, a, j, level, high) { for (let i = Math.max(0, a); i < j; i++) if (high ? b[i].high > level : b[i].low < level) return false; return true; }
  function findSweep(b, atr, L) {
    const e = b.length - 1, sw = swings(b, 2), rank = { pwh: 5, pwl: 5, pdh: 4, pdl: 4, session: 3, swing: 1 };
    const firstAt = (t0) => { if (!fin(t0)) return -1; for (let i = 0; i < b.length; i++) if (b[i].time >= t0) return i; return -1; };
    const iDay = firstAt(L.dayFrom), iSess = firstAt(L.sessFrom);
    const named = [['pdh', L.pdh, true, iDay, 'pdh'], ['pwh', L.pwh, true, iDay, 'pwh'], ['pdl', L.pdl, false, iDay, 'pdl'], ['pwl', L.pwl, false, iDay, 'pwl'], ['sh', L.sessHigh, true, iSess, 'session'], ['sl', L.sessLow, false, iSess, 'session']];
    for (let j = e; j > e - 12 && j >= 3; j--) {
      const bar = b[j], c = [];
      const through = (level, high) => (high ? bar.high > level && bar.close < level : bar.low < level && bar.close > level);
      const held = (level, high) => { for (let m = j + 1; m <= e; m++) if (high ? b[m].close > level : b[m].close < level) return false; return true; };
      for (const p of sw) {
        if (p.i + 2 >= j || j - p.i > 80) continue;                       // the pivot must have been confirmed before bar j
        const high = p.type === 'H';
        if (through(p.price, high) && intact(b, p.i + 1, j, p.price, high) && held(p.price, high)) c.push({ side: high ? 'high' : 'low', of: 'swing', level: p.price });
      }
      for (const [, level, high, i0, of] of named) {
        if (!fin(level) || i0 < 0 || j < i0) continue;
        if (through(level, high) && intact(b, i0, j, level, high) && held(level, high)) c.push({ side: high ? 'high' : 'low', of, level });
      }
      if (!c.length) continue;
      c.sort((x, y) => rank[y.of] - rank[x.of] || (x.side === 'high' ? y.level - x.level : x.level - y.level));
      const s = c[0];
      return { side: s.side, of: s.of, level: s.level, age: e - j, depth: (s.side === 'high' ? bar.high - s.level : s.level - bar.low) / atr };
    }
    return null;
  }
  function equalLevel(b, atr, high, last) {
    const w = tail(b, 60), piv = swings(w, 2).filter((p) => p.type === (high ? 'H' : 'L')), tol = 0.1 * atr; let best = null;
    for (let x = 0; x < piv.length; x++) for (let y = x + 1; y < piv.length; y++) {
      if (Math.abs(piv[x].price - piv[y].price) > tol) continue;
      const level = high ? Math.max(piv[x].price, piv[y].price) : Math.min(piv[x].price, piv[y].price);
      let broken = false; for (let i = piv[y].i + 1; i < w.length; i++) if (high ? w[i].high > level : w[i].low < level) { broken = true; break; }
      if (!broken && (best === null || Math.abs(level - last) < Math.abs(best - last))) best = level;
    }
    return best;
  }
  function emptyFeatures() { const f = {}; for (const k of Object.keys(FEATURE_DOC)) f[k] = null; return f; }

  // build(): the features plus the profile; internal, so decide / thesis / manage compute the features once
  function build(snapshot) {
    const s = snapshot || {}, B = s.bars || {}, cand = s.cand || null, P = profileOf(s.edge), t = s.t, f = emptyFeatures();
    const candTf = cand ? normTf(cand.tf) : null;
    const sigTf = candTf && Array.isArray(B[candTf]) && B[candTf].length >= MIN_SIG ? candTf : P.tf;
    const need = uniq([sigTf].concat(['1h', '4h', '1d'].filter((tf) => TF[tf] >= TF[sigTf])));
    const missing = need.filter((tf) => !(Array.isArray(B[tf]) && B[tf].length >= (tf === sigTf ? MIN_SIG : MIN_CTX[tf])));
    f.sigTf = sigTf; f.missingTf = missing.join(','); f.barsOk = missing.length === 0;

    // time
    const L = dayLevels(B, t);
    f.session = L.session; f.dow = DOW[(Math.floor(t / 86400) + 4) % 7]; f.hourUtc = Math.floor((t - Math.floor(t / 86400) * 86400) / 3600);

    // structure and bias (each timeframe on its own; a missing timeframe is null, never guessed)
    const st = {}; for (const tf of ['1d', '4h', '1h', '15m']) st[tf] = Array.isArray(B[tf]) && B[tf].length >= MIN_CTX[tf] ? structureOf(B[tf], 2) : { label: null, lastHigh: null, lastLow: null };
    f.structD1 = st['1d'].label; f.structH4 = st['4h'].label; f.structH1 = st['1h'].label; f.structM15 = st['15m'].label;
    const d1 = tail(B['1d']), h4 = tail(B['4h']);
    f.maPosD1 = d1.length >= MIN_CTX['1d'] ? maPos(d1) : null; f.maPosH4 = h4.length >= MIN_CTX['4h'] ? maPos(h4) : null;
    if (d1.length >= 20) { const a = atrSeries(d1)[d1.length - 1], m = smaClose(d1, 20); f.distMa20D1 = a > 0 ? rd((d1[d1.length - 1].close - m) / a) : null; }
    const sg = (x, up, dn) => (x === up ? 1 : x === dn ? -1 : 0);
    if (f.structD1 !== null || f.structH4 !== null || f.maPosD1 !== null || f.maPosH4 !== null) {
      f.htfScore = 2 * sg(f.structD1, 'up', 'down') + sg(f.structH4, 'up', 'down') + 2 * sg(f.maPosD1, 'above', 'below') + sg(f.maPosH4, 'above', 'below');
      f.htfBias = f.htfScore >= 2 ? 'up' : f.htfScore <= -2 ? 'down' : 'neutral';
    }
    if (f.structH1 !== null || f.structM15 !== null) { const v = 2 * sg(f.structH1, 'up', 'down') + sg(f.structM15, 'up', 'down'); f.ltfBias = v >= 2 ? 'up' : v <= -2 ? 'down' : 'neutral'; }
    if (f.htfBias !== null && f.ltfBias !== null) f.htfLtfConflict = (f.htfBias === 'up' && f.ltfBias === 'down') || (f.htfBias === 'down' && f.ltfBias === 'up');
    const hs = st['1d'].lastHigh !== null || st['1d'].lastLow !== null ? st['1d'] : st['4h'];
    f.htfSwingHigh = rp(hs.lastHigh); f.htfSwingLow = rp(hs.lastLow);

    // prior day / week / session levels
    f.pdh = rp(L.pdh); f.pdl = rp(L.pdl); f.pwh = rp(L.pwh); f.pwl = rp(L.pwl); f.sessHigh = rp(L.sessHigh); f.sessLow = rp(L.sessLow);

    // intermarket: the dollar index (context for gold)
    const dx = s.inter && s.inter.dxy ? s.inter.dxy : null;
    if (dx) {
      const db = Array.isArray(dx['1h']) && dx['1h'].length >= 30 ? dx['1h'] : Array.isArray(dx['1d']) && dx['1d'].length >= 30 ? dx['1d'] : null;
      if (db) { const T = trendStats(db, db.length - 1, 20); if (T) { f.dxyStrength = rd(T.ts); f.dxyTrend = T.ts >= 0.75 ? 'up' : T.ts <= -0.75 ? 'down' : 'flat'; } }
    }

    // calendar: releases already out (snapshot.events, at or before t) and releases still to come (snapshot.schedule)
    const hasEv = Array.isArray(s.events), hasSch = Array.isArray(s.schedule);
    if (hasEv || hasSch) {
      let best = null, next = null;
      for (const ev of hasSch ? s.schedule : []) {
        if (!ev || !fin(ev.t) || !isHigh(ev.impact) || ev.t <= t) continue;
        if (!next || ev.t < next.t) next = ev;
        if (ev.t - t <= LIMITS.eventAheadH * 3600 && (!best || Math.abs(ev.t - t) < Math.abs(best.t - t))) best = ev;
      }
      for (const ev of hasEv ? s.events : []) {
        if (!ev || !fin(ev.t) || !isHigh(ev.impact) || ev.t > t || t - ev.t > LIMITS.eventBehindH * 3600) continue;
        if (!best || Math.abs(ev.t - t) < Math.abs(best.t - t)) best = ev;
      }
      f.eventNear = !!best;
      if (best) { f.eventMins = Math.round((best.t - t) / 60) + 0; f.eventTitle = String(best.title || '').slice(0, 40); }
      if (next) f.eventInH = rd((next.t - t) / 3600, 2);
    }

    // local features on the signal timeframe
    const sb = tail(B[sigTf]), e = sb.length - 1;
    if (sb.length) f.lastClose = rp(sb[e].close);
    const atrS = sb.length >= MIN_SIG ? atrSeries(sb) : [], atr = atrS.length && atrS[e] > 0 ? atrS[e] : null, last = sb.length ? sb[e].close : null;
    const side = cand && (cand.side === 'buy' || cand.side === 'sell') ? cand.side : null, dir = side === 'buy' ? 1 : side === 'sell' ? -1 : 0;
    f.side = side;
    if (atr !== null) {
      const A = (x) => (fin(x) ? rd(x / atr) : null);
      f.atr = rp(atr); f.atrPct = rd(atr / last * 100, 4);
      const V = volStats(atrS, e, 100);
      if (V) { f.atrPctile = rd(V.pctile); f.volRatio = rd(V.ratio); f.volState = V.pctile >= 0.8 ? 'high' : V.pctile <= 0.2 ? 'low' : 'normal'; f.volAbnormal = V.ratio !== null && V.ratio >= 2; }
      const R = regime(sb);
      if (R.label) { f.regimeBase = R.label; f.regime = f.eventNear === true ? 'event' : R.label; f.regimeTrend = R.trend; f.trendStrength = R.detail.ts; f.effRatio = R.detail.er; }
      const upTf = TF[sigTf] < TF['4h'] ? '4h' : '1d';
      if (upTf !== sigTf && Array.isArray(B[upTf])) f.regimeHtf = regime(B[upTf]).label; else if (upTf === sigTf) f.regimeHtf = f.regimeBase;

      // liquidity
      f.distPdh = fin(L.pdh) ? A(L.pdh - last) : null; f.distPdl = fin(L.pdl) ? A(last - L.pdl) : null;
      f.distPwh = fin(L.pwh) ? A(L.pwh - last) : null; f.distPwl = fin(L.pwl) ? A(last - L.pwl) : null;
      f.distSessHigh = fin(L.sessHigh) ? A(L.sessHigh - last) : null; f.distSessLow = fin(L.sessLow) ? A(last - L.sessLow) : null;
      const eqH = equalLevel(sb, atr, true, last), eqL = equalLevel(sb, atr, false, last);
      f.eqHighs = eqH !== null; f.eqLows = eqL !== null; f.eqHigh = rp(eqH); f.eqLow = rp(eqL);
      f.distEqHigh = eqH !== null ? A(eqH - last) : null; f.distEqLow = eqL !== null ? A(last - eqL) : null;

      // sweeps
      const sw = findSweep(sb, atr, L);
      f.sweep = sw ? sw.side : 'none';
      if (sw) { f.sweepAge = sw.age; f.sweepOf = sw.of; f.sweepDepth = rd(sw.depth); f.sweepLevel = rp(sw.level); }

      // displacement and fair-value gaps
      f.displacement = 'none'; f.dispFvg = false; f.fvg = 'none';
      for (let j = e; j > e - 6 && j >= 15; j--) {
        const b = sb[j], body = b.close - b.open, rng = b.high - b.low, a0 = atrS[j - 1];
        if (!(a0 > 0) || Math.abs(body) < 1.2 * a0 || Math.abs(body) < 0.6 * rng) continue;
        f.displacement = body > 0 ? 'up' : 'down'; f.dispAge = e - j; f.dispSize = rd(Math.abs(body) / a0);
        f.dispFvg = j + 1 <= e && j - 1 >= 0 && (body > 0 ? sb[j + 1].low > sb[j - 1].high : sb[j + 1].high < sb[j - 1].low);
        break;
      }
      for (let i = e - 1; i > e - 10 && i >= 1; i--) {                    // i = the middle bar of the three
        const bull = sb[i + 1].low > sb[i - 1].high, bear = sb[i + 1].high < sb[i - 1].low; if (!bull && !bear) continue;
        const edge = bull ? sb[i - 1].high : sb[i - 1].low; let filled = false;
        for (let m = i + 2; m <= e; m++) if (bull ? sb[m].low <= edge : sb[m].high >= edge) { filled = true; break; }
        if (filled) continue;
        f.fvg = bull ? 'bull' : 'bear'; f.fvgSize = rd((bull ? sb[i + 1].low - sb[i - 1].high : sb[i - 1].low - sb[i + 1].high) / atr); break;
      }

      // momentum
      f.roc = e >= 10 ? A(last - sb[e - 10].close) : null; f.momentum = f.roc === null ? null : f.roc >= 1 ? 'up' : f.roc <= -1 ? 'down' : 'flat';
      let cc = 0; for (let i = e; i >= 1; i--) { const up = sb[i].close > sb[i - 1].close, dn = sb[i].close < sb[i - 1].close; if (cc >= 0 && up) cc++; else if (cc <= 0 && dn) cc--; else break; }
      f.consec = cc;

      // support / resistance
      const piv = swings(tail(sb, 120), 3), above = [], below = [];
      for (const p of piv) (p.price > last ? above : below).push(p.price);
      for (const x of [L.pdh, L.pdl, L.pwh, L.pwl]) if (fin(x) && x !== last) (x > last ? above : below).push(x);
      const res = above.length ? Math.min.apply(null, above) : null, sup = below.length ? Math.max.apply(null, below) : null;
      f.nearRes = rp(res); f.nearSup = rp(sup); f.distRes = res !== null ? A(res - last) : null; f.distSup = sup !== null ? A(last - sup) : null;
      f.distSR = f.distRes === null ? f.distSup : f.distSup === null ? f.distRes : Math.min(f.distRes, f.distSup);

      // location in the 50-bar range
      const rb = tail(sb, 50); let hi = -Infinity, lo = Infinity; for (const b of rb) { hi = Math.max(hi, b.high); lo = Math.min(lo, b.low); }
      const ref = cand && fin(cand.entry) ? cand.entry : last;
      if (hi > lo) { f.entryLoc = rd(Math.min(1, Math.max(0, (ref - lo) / (hi - lo)))); f.entryZone = f.entryLoc >= 0.6 ? 'premium' : f.entryLoc <= 0.4 ? 'discount' : 'equilibrium'; }

      // the candidate against its context
      if (dir) {
        const en = cand.entry, sl = cand.stop, tp = cand.target;
        f.geomOk = fin(en) && fin(sl) && dir * (en - sl) > 0 && (tp == null || (fin(tp) && dir * (tp - en) > 0));
        if (fin(en) && fin(sl)) { f.stopAtr = A(Math.abs(en - sl)); f.entryOffset = A(dir * (en - last)); }
        if (fin(en) && fin(tp)) { f.targetAtr = A(Math.abs(tp - en)); if (fin(sl) && en !== sl) f.rr = rd(Math.abs(tp - en) / Math.abs(en - sl)); }
        const al = (bias) => (bias === null ? null : bias === 'neutral' ? 'neutral' : (bias === 'up') === (dir > 0) ? 'with' : 'against');
        f.biasAlign = al(f.htfBias); f.ltfAlign = al(f.ltfBias);
        f.sweepFor = f.sweep === 'none' ? 'none' : (f.sweep === 'low') === (dir > 0) ? 'with' : 'against';
        f.dispFor = f.displacement === 'none' ? 'none' : (f.displacement === 'up') === (dir > 0) ? 'with' : 'against';
        f.momFor = f.momentum === null ? null : f.momentum === 'flat' ? 'flat' : (f.momentum === 'up') === (dir > 0) ? 'with' : 'against';
        if (f.entryZone) f.locFor = f.entryZone === 'equilibrium' ? 'mid' : (f.entryZone === 'discount') === (dir > 0) ? 'good' : 'poor';
        const tb = sb[e], rng = tb.high - tb.low, body = dir * (tb.close - tb.open), loc = rng > 0 ? (dir > 0 ? (tb.close - tb.low) / rng : (tb.high - tb.close) / rng) : 0.5;
        f.trigCloseLoc = rd(loc); f.trigBodyAtr = A(body);
        f.confirm = rng > 0 && body > 0 && loc >= 0.67 && body >= 0.5 * rng ? 'strong' : rng > 0 && body < 0 && -body >= 0.5 * rng ? 'against' : 'weak';
        if (fin(en) && fin(sl) && f.geomOk) {
          const far = fin(tp) ? tp : en + dir * 2 * Math.abs(en - sl), lv = [];
          const w120 = tail(sb, 120);                                   // only swing levels nothing has traded through since: liquidity still resting
          for (const p of swings(w120, 2)) if (p.type === (dir > 0 ? 'H' : 'L') && intact(w120, p.i + 1, w120.length, p.price, dir > 0)) lv.push(p.price);
          for (const x of dir > 0 ? [L.pdh, L.pwh, L.sessHigh, eqH] : [L.pdl, L.pwl, L.sessLow, eqL]) if (fin(x)) lv.push(x);
          const inWay = lv.filter((x) => dir * (x - en) > 0.1 * atr && dir * (far - x) > 0.1 * atr).sort((a, b) => dir * (a - b)), merged = [];
          for (const x of inWay) if (!merged.length || Math.abs(x - merged[merged.length - 1]) > 0.25 * atr) merged.push(x);
          f.oppLiq = merged.length; f.oppLiqFrac = merged.length ? rd(Math.abs(merged[0] - en) / Math.abs(far - en)) : null;
        }
        if (isGold(s.market) && f.dxyTrend !== null) f.dxyConflict = (dir > 0 && f.dxyTrend === 'up') || (dir < 0 && f.dxyTrend === 'down');
      }
    }
    return { f, P, sigTf, dir };
  }
  function features(snapshot) { return build(snapshot).f; }
  // the few buckets "similar past cases" are matched on; the caller stores this with each candidate's outcome
  const SIMILAR_KEYS = ['regime', 'session', 'biasAlign'];
  function lite(f) { const o = {}; for (const k of ['regime', 'session', 'biasAlign', 'volState', 'side', 'htfBias']) o[k] = f && f[k] !== undefined ? f[k] : null; return o; }

  // ---- 10. scorer (optional, off unless a promoted model is passed in) ----------------------------------------------
  // The JSON a gradient-boosted-trees model is exported to. A Python LightGBM dump_model() converts directly:
  //   tree_info[i].tree_structure -> trees[i];  split_feature -> f;  threshold -> t;  left_child / right_child -> left / right;
  //   default_left -> defaultLeft;  leaf_value -> v (shrinkage already applied, as dump_model gives it).
  // A row goes LEFT when x <= t, and when x is missing it goes left unless defaultLeft is false. String features are turned
  // into numbers with encoders[name][value] (an unknown value counts as missing); booleans are 1 / 0.
  const MODEL_SCHEMA = {
    version: 'string: the model\'s id in the registry',
    promoted: 'boolean: true only after the owner promoted it by hand; decide() ignores a model without it',
    calibrated: 'boolean: true when p was checked against outcomes on later data; decide() shows modelScore only then',
    featureNames: 'string[]: keys of MXA.features, in the column order the trees index',
    encoders: 'optional { featureName: { category: number } } for string features',
    baseScore: 'number added to the sum of the leaves (0 when absent)',
    link: '"logit": p = 1 / (1 + exp(-raw)) | "identity": p = raw',
    platt: 'optional [a, b]: p = 1 / (1 + exp(-(a * raw + b))) instead of the plain link',
    trees: 'node[]: a node is { f: feature index, t: threshold, left: node, right: node, defaultLeft?: boolean } or a leaf { v: number }',
  };
  function encodeFeature(model, name, v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const enc = model.encoders && model.encoders[name];
    return enc && Object.prototype.hasOwnProperty.call(enc, v) && fin(enc[v]) ? enc[v] : null;
  }
  function score(model, f) {
    if (!model) return null;
    if (!Array.isArray(model.featureNames) || !Array.isArray(model.trees)) throw new Error('MXA.score: a model needs featureNames[] and trees[] (see MXA.MODEL_SCHEMA)');
    const x = model.featureNames.map((name) => encodeFeature(model, name, f ? f[name] : null));
    let raw = fin(model.baseScore) ? model.baseScore : 0;
    for (const tree of model.trees) {
      let n = tree && tree.root ? tree.root : tree, guard = 0;
      while (n && n.v === undefined) {
        if (++guard > 4096 || !fin(n.f) || !fin(n.t)) throw new Error('MXA.score: malformed tree');
        const xv = x[n.f]; n = (xv === null || xv === undefined ? n.defaultLeft !== false : xv <= n.t) ? n.left : n.right;
      }
      if (!n || !fin(n.v)) throw new Error('MXA.score: malformed tree (no leaf value)');
      raw += n.v;
    }
    const sig = (z) => 1 / (1 + Math.exp(-z));
    const p = Array.isArray(model.platt) ? sig(model.platt[0] * raw + model.platt[1]) : model.link === 'identity' ? raw : sig(raw);
    return { raw: rd(raw, 6), p: rd(p, 6) };
  }

  // ---- 4. the decision --------------------------------------------------------------------------------------------
  // Hard uncertainty gates. "overridable" = a mentor's TAKE / FLIP lesson may pass it, but only a lesson whose own conditions
  // name one of the gate's features (so the mentor has said "take it even with this"). The others never yield to a lesson.
  const GATES = {
    data: { overridable: false, features: [], text: 'a needed timeframe is missing or too short' },
    geometry: { overridable: false, features: [], text: 'the candidate has no valid stop / target (never a trade without a stop)' },
    rr: { overridable: false, features: [], text: 'reward to risk after costs is below 1' },
    risk: { overridable: false, features: [], text: 'the risk engine blocked the order' },
    'lesson-conflict': { overridable: false, features: [], text: 'two matching lessons demand opposite actions' },
    event: { overridable: true, features: ['eventNear', 'eventMins', 'eventInH'], text: 'a high-impact event is near' },
    volatility: { overridable: true, features: ['volAbnormal', 'volRatio', 'volState', 'atrPctile'], text: 'volatility is abnormal' },
    unfamiliar: { overridable: true, features: ['regime'], text: 'too few past cases in this regime' },
    conflict: { overridable: true, features: ['htfLtfConflict', 'biasAlign', 'ltfAlign'], text: 'higher and lower timeframes disagree' },
  };
  const ZH = { up: 'up (HH/HL)', down: 'down (LH/LL)', mixed: 'mixed' };
  const SIDE_WORD = { buy: 'buy', sell: 'sell' };

  // similar past cases: from opts.history only, and only entries that were finished before t
  function similarOf(history, f, t, lim) {
    if (!Array.isArray(history)) return { n: 0, winRate: null, avgR: null, note: 'no history was supplied: there is no sample to lean on', level: null, total: 0, regimeN: 0, undated: 0 };
    // an entry counts only when it is dated before t and (when its exit time is given) its trade had finished by t
    const past = history.filter((h) => h && fin(h.netR) && fin(h.t) && h.t < t && (!fin(h.exitT) || h.exitT <= t));
    const undated = history.filter((h) => h && !fin(h.t)).length;
    const lf = (h) => h.features || h.f || h;
    const at = (keys) => past.filter((h) => keys.every((k) => f[k] !== null && f[k] !== undefined && lf(h)[k] === f[k]));
    const levels = [SIMILAR_KEYS, ['regime', 'biasAlign'], ['regime']];
    let pick = null, keys = null;
    for (const ks of levels) { const m = at(ks); if (m.length >= lim.similarMin) { pick = m; keys = ks; break; } }
    const byRegime = at(['regime']);
    if (!pick) { pick = byRegime; keys = ['regime']; }
    const n = pick.length, wins = pick.filter((h) => h.netR > 0).length;
    const note = n === 0 ? 'no similar past case (same regime) before this decision'
      : n < lim.similarMin ? `only ${n} similar past case${n === 1 ? '' : 's'} (same ${keys.join(' + ')}): too few to rely on`
        : `${n} similar past cases (same ${keys.join(' + ')})`;
    return { n, winRate: n ? rd(wins / n) : null, avgR: n ? rd(sum(pick, (h) => h.netR) / n) : null, note, level: keys.join('+'), total: past.length, regimeN: byRegime.length, undated };
  }
  function costPriceOf(edgeDef, risk) {
    if (!edgeDef) return null;
    if (fin(edgeDef.costR) && fin(risk)) return edgeDef.costR * risk;
    if (fin(edgeDef.costPrice)) return edgeDef.costPrice;
    if (fin(edgeDef.cost)) return edgeDef.cost;
    if (edgeDef.cost && fin(edgeDef.cost.price)) return edgeDef.cost.price;
    return null;
  }
  function rrNetOf(entry, stop, target, edgeDef) {
    if (!fin(entry) || !fin(stop) || !fin(target)) return null;
    const risk = Math.abs(entry - stop), reward = Math.abs(target - entry), c = costPriceOf(edgeDef, risk) || 0;
    return risk + c > 0 ? (reward - c) / (risk + c) : null;
  }

  // evidence for and against taking the candidate: every item names its factor, says it in plain English with the
  // numbers, and carries the weight from the edge's profile
  function evidenceOf(f, P, x) {
    const sup = [], con = [], w = P.w, side = SIDE_WORD[f.side] || 'trade';
    const S = (factor, wt, text) => { if (wt > 0) sup.push({ factor, text, weight: rd(wt, 2) }); };
    const C = (factor, wt, text) => { if (wt > 0) con.push({ factor, text, weight: rd(wt, 2) }); };
    const htfTxt = `D1 structure ${ZH[f.structD1] || 'unknown'}, H4 ${ZH[f.structH4] || 'unknown'}, price ${f.maPosD1 || 'n/a'} the 20/50-day means (bias ${f.htfBias}, score ${f.htfScore})`;
    if (f.biasAlign === 'with') S('htfBias', w.htf[0], `The higher timeframes agree with the ${side}: ${htfTxt}.`);
    else if (f.biasAlign === 'against') C('htfBias', w.htf[1], `The ${side} goes against the higher timeframes: ${htfTxt}.`);
    else if (f.biasAlign === 'neutral' && (P.kind === 'trend' || P.kind === 'breakout')) C('htfBias', 0.4 * w.htf[1], `No clear higher-timeframe bias for a ${P.kind} edge: ${htfTxt}.`);
    const ltfTxt = `H1 ${ZH[f.structH1] || 'unknown'}, M15 ${ZH[f.structM15] || 'unknown'}`;
    if (f.ltfAlign === 'with') S('ltfStructure', w.ltf[0], `Lower-timeframe structure is with the ${side}: ${ltfTxt}.`);
    else if (f.ltfAlign === 'against') C('ltfStructure', w.ltf[1], `Lower-timeframe structure is against the ${side}: ${ltfTxt}.`);
    const swTxt = `a wick through the ${f.sweepOf} level ${fmt(f.sweepLevel, 5)} ${f.sweepAge} bar${f.sweepAge === 1 ? '' : 's'} ago that closed back (${fmt(f.sweepDepth)} ATR through)`;
    if (f.sweepFor === 'with') S('sweep', w.sweep[0], `Liquidity behind the trade was taken first: ${swTxt}.`);
    else if (f.sweepFor === 'against') C('sweep', w.sweep[1], `The last sweep took the liquidity the ${side} needs to run to: ${swTxt}.`);
    if (f.dispFor === 'with') S('displacement', w.displacement[0], `Displacement in the trade direction ${f.dispAge} bar${f.dispAge === 1 ? '' : 's'} ago: a body of ${fmt(f.dispSize)} ATR${f.dispFvg ? ' that left a fair-value gap' : ''}.`);
    else if (f.dispFor === 'against') C('displacement', w.displacement[1], `The last displacement was against the ${side}: a body of ${fmt(f.dispSize)} ATR ${f.dispAge} bar${f.dispAge === 1 ? '' : 's'} ago.`);
    if (f.momFor === 'with') S('momentum', w.momentum[0], `Momentum is with the ${side}: ${fmt(f.roc)} ATR over 10 bars, ${Math.abs(f.consec)} consecutive close${Math.abs(f.consec) === 1 ? '' : 's'} ${f.consec >= 0 ? 'up' : 'down'}.`);
    else if (f.momFor === 'against') C('momentum', w.momentum[1], `Momentum is against the ${side}: ${fmt(f.roc)} ATR over 10 bars.`);
    if (f.locFor === 'good') S('location', w.location[0], `Good location: the entry is at ${fmt(f.entryLoc)} of the 50-bar range (${f.entryZone}).`);
    else if (f.locFor === 'poor') C('location', w.location[1], `Poor location: a ${side} at ${fmt(f.entryLoc)} of the 50-bar range (${f.entryZone}).`);
    if (f.confirm === 'strong') S('confirmation', w.confirm[0], `The trigger bar closed strong in the trade direction (close at ${fmt(f.trigCloseLoc)} of its range, body ${fmt(f.trigBodyAtr)} ATR).`);
    else if (f.confirm === 'against') C('confirmation', w.confirm[1], `The trigger bar closed against the ${side} (body ${fmt(f.trigBodyAtr)} ATR).`);
    else if (f.confirm === 'weak') C('confirmation', 0.5 * w.confirm[1], `The trigger bar did not close strong (close at ${fmt(f.trigCloseLoc)} of its range, body ${fmt(f.trigBodyAtr)} ATR).`);
    if (fin(x.rr)) { if (x.rr >= 2) S('rr', w.rr[0], `Reward to risk ${fmt(x.rr)} (${fmt(x.rrNet)} after costs).`); else if (x.rr < 1.5) C('rr', w.rr[1], `Thin reward to risk: ${fmt(x.rr)} (${fmt(x.rrNet)} after costs).`); }
    if (fin(x.stopAtr)) { if (x.stopAtr < 0.5) C('stop', w.stop[1], `The stop is inside normal noise: ${fmt(x.stopAtr)} ATR from the entry.`); else if (x.stopAtr > 4) C('stop', w.stop[1], `The stop is very wide: ${fmt(x.stopAtr)} ATR from the entry.`); }
    if (f.oppLiq !== null) { if (f.oppLiq === 0) S('oppLiq', w.oppLiq[0], 'No resting level between the entry and the target.'); else if (f.oppLiqFrac !== null && f.oppLiqFrac <= 0.6) C('oppLiq', w.oppLiq[1], `${f.oppLiq} resting level${f.oppLiq === 1 ? '' : 's'} between the entry and the target, the first only ${fmt(f.oppLiqFrac * 100, 0)} % of the way.`); }
    if (f.volState === 'high') C('volatility', w.vol[1], `Volatility is high: ATR in the top ${fmt((1 - f.atrPctile) * 100, 0)} % of its last 100 values (${fmt(f.volRatio)} times its median).`);
    if (f.session && P.sessions.indexOf(f.session) >= 0) S('session', w.session[0], `The ${f.session} session is one this edge is meant to trade.`);
    else if (f.session && P.badSessions.indexOf(f.session) >= 0) C('session', w.session[1], `The ${f.session} session is outside this edge's hours.`);
    if (f.regime && P.regimes.good.indexOf(f.regime) >= 0) S('regime', w.regime[0], `Regime ${f.regime} suits a ${P.kind} edge (trend strength ${fmt(f.trendStrength)}, efficiency ${fmt(f.effRatio)}).`);
    else if (f.regime && P.regimes.bad.indexOf(f.regime) >= 0) C('regime', w.regime[1], `Regime ${f.regime} is a poor fit for a ${P.kind} edge (trend strength ${fmt(f.trendStrength)}, efficiency ${fmt(f.effRatio)}).`);
    if (f.dxyConflict === true) C('dxy', w.dxy[1], `The dollar index is trending ${f.dxyTrend} (strength ${fmt(f.dxyStrength)}), against a gold ${side}.`);
    else if (f.dxyConflict === false && f.dxyTrend !== 'flat') S('dxy', w.dxy[0], `The dollar index is trending ${f.dxyTrend} (strength ${fmt(f.dxyStrength)}), in favour of a gold ${side}.`);
    if (f.eventNear === true) C('event', w.event[1], `High-impact event near: ${f.eventTitle || 'event'} ${f.eventMins >= 0 ? 'in ' + f.eventMins + ' min' : Math.abs(f.eventMins) + ' min ago'}.`);
    const sm = x.similar;
    if (sm && sm.n >= x.lim.similarMin) { if (sm.avgR >= 0.1) S('similar', w.similar[0], `${sm.n} similar past cases averaged ${fmt(sm.avgR)} R net (${fmt(sm.winRate * 100, 0)} % winners).`); else if (sm.avgR <= -0.1) C('similar', w.similar[1], `${sm.n} similar past cases averaged ${fmt(sm.avgR)} R net (${fmt(sm.winRate * 100, 0)} % winners).`); }
    const th = x.thesis;
    if (th && (th.bias === 'up' || th.bias === 'down') && f.side) { if ((th.bias === 'up') === (f.side === 'buy')) S('thesis', w.thesis[0], `In line with the running thesis (bias ${th.bias} since ${th.startedAt}).`); else C('thesis', w.thesis[1], `Against the running thesis (bias ${th.bias} since ${th.startedAt}).`); }
    if (x.modelScore && fin(x.modelScore.p)) { const p = x.modelScore.p; if (p >= 0.55) S('model', Math.min(w.model[0], (p - 0.5) * 10 * w.model[0]), `The promoted scorer gives ${fmt(p * 100, 0)} % (calibrated).`); else if (p <= 0.45) C('model', Math.min(w.model[1], (0.5 - p) * 10 * w.model[1]), `The promoted scorer gives ${fmt(p * 100, 0)} % (calibrated).`); }
    const byW = (a, b) => b.weight - a.weight || (a.factor < b.factor ? -1 : a.factor > b.factor ? 1 : 0);
    return { sup: sup.sort(byW), con: con.sort(byW) };
  }
  const WAIT_FOR = {
    htfBias: 'the higher timeframes to turn the trade\'s way, or a candidate on the side of the bias',
    ltfStructure: 'lower-timeframe structure to turn the trade\'s way',
    sweep: 'the swept level to be reclaimed, or liquidity taken on the other side first',
    displacement: 'displacement in the trade direction',
    momentum: 'momentum to stop running against the trade',
    location: 'price to come back to the right side of the range',
    confirmation: 'a trigger bar that closes strong in the trade direction',
    rr: 'an entry or target that pays at least 1.5 times the risk',
    stop: 'a stop that sits beyond structure at a sensible distance',
    oppLiq: 'the level in the way to be cleared, or a target in front of it',
    volatility: 'volatility to settle',
    session: 'the edge\'s own session',
    regime: 'a regime that suits the edge',
    dxy: 'the dollar index to stop pushing the other way',
    event: 'the event to pass',
    similar: 'conditions in which this edge has paid before',
    thesis: 'the running thesis to change, with a reason',
    model: 'a setup the scorer rates better',
  };
  function invalidationOf(f, side, entry, stop) {
    const out = [], dir = side === 'buy' ? 1 : side === 'sell' ? -1 : 0, p = (x) => fmt(x, 5);
    if (dir && fin(stop)) out.push(`price ${dir > 0 ? 'at or below' : 'at or above'} the stop ${p(stop)}`);
    if (dir && f.sweepFor === 'with' && fin(f.sweepLevel)) out.push(`a ${f.sigTf} close back ${dir > 0 ? 'below' : 'above'} the swept ${f.sweepOf} level ${p(f.sweepLevel)}`);
    if (dir > 0 && fin(f.nearSup) && (!fin(stop) || f.nearSup > stop)) out.push(`a ${f.sigTf} close below the nearest support ${p(f.nearSup)}`);
    if (dir < 0 && fin(f.nearRes) && (!fin(stop) || f.nearRes < stop)) out.push(`a ${f.sigTf} close above the nearest resistance ${p(f.nearRes)}`);
    const bias = dir ? (dir > 0 ? 'up' : 'down') : f.htfBias;
    if (bias === 'up' && fin(f.htfSwingLow)) out.push(`a daily close below the last higher-timeframe swing low ${p(f.htfSwingLow)}`);
    if (bias === 'down' && fin(f.htfSwingHigh)) out.push(`a daily close above the last higher-timeframe swing high ${p(f.htfSwingHigh)}`);
    if (dir && f.dxyTrend !== null && f.dxyConflict !== null) out.push(`the dollar index turning ${dir > 0 ? 'up' : 'down'} (now ${f.dxyTrend})`);
    if (dir && f.eventNear === false) out.push('a high-impact event appearing on the calendar before the trade is done');
    return out;
  }
  function whyOf(f) {
    const w = [];
    if (f.structD1) w.push(`D1 structure ${ZH[f.structD1]}`);
    if (f.structH4) w.push(`H4 structure ${ZH[f.structH4]}`);
    if (f.maPosD1) w.push(`price ${f.maPosD1} the 20/50-day means`);
    if (f.regime) w.push(`${f.sigTf} regime ${f.regime}`);
    if (f.sweep && f.sweep !== 'none') w.push(`${f.sweep} sweep of the ${f.sweepOf} level ${f.sweepAge} bars ago`);
    if (f.dxyTrend) w.push(`dollar index ${f.dxyTrend}`);
    if (f.eventNear) w.push(`event near: ${f.eventTitle}`);
    return w;
  }
  const expectingOf = (P, bias) => `${bias === 'up' ? 'a long setup' : bias === 'down' ? 'a short setup' : 'a setup on either side'} from ${P.name}: ${P.waitFor}`;

  function usableModel(m) { return m && m.promoted === true && m.calibrated === true ? m : null; }
  function confidenceOf(action, margin, need, sim, uncertainty, lim) {
    if (uncertainty.length) return 'low';
    const d = action === 'WAIT' ? need - margin : margin - need;      // how far the evidence is past the line, on the action's side
    let c = d >= 2.5 ? 'high' : d >= 1 ? 'medium' : 'low';
    if (c === 'high' && sim.n < lim.similarMin) c = 'medium';           // strong evidence on a thin sample is not "high"
    if (c !== 'low' && sim.n < lim.unfamiliarN) c = 'low';
    return c;
  }
  function decisionId(d) { return 'D-' + hash([d.edge, d.market, d.t, d.candidateId, d.action, d.entry, d.stop, d.target, d.featuresHash, d.policyVersion, (d.lessonsApplied || []).map((l) => l.id + '@' + l.version + ':' + (l.applied ? 1 : 0))]).slice(0, 12); }

  function decide(snapshot, opts) {
    opts = opts || {};
    assertNoFuture(snapshot);                                           // a snapshot holding the future never gets a decision
    const lim = Object.assign({}, LIMITS, opts.limits || {});
    if (opts.position) return manageDecision(snapshot, opts, lim);
    const B = build(snapshot), f = B.f, P = B.P, cand = snapshot.cand || null, edgeDef = opts.edgeDef || null;
    const model = usableModel(opts.model), ms = model ? score(model, f) : null;
    const d = {
      id: null, edge: snapshot.edge || null, market: snapshot.market || null, t: snapshot.t, action: 'WAIT', side: f.side,
      entry: cand && fin(cand.entry) ? cand.entry : null, stop: cand && fin(cand.stop) ? cand.stop : null, target: cand && fin(cand.target) ? cand.target : null,
      candidateId: cand ? cand.id || null : null, thesis: '', supporting: [], contradicting: [], waitReasons: [], waitingFor: [], invalidation: [],
      risk: { rr: null, rrNet: null, stopAtr: null, riskPct: opts.risk && fin(opts.risk.riskPct) ? opts.risk.riskPct : null, allowed: opts.risk ? opts.risk.allowed !== false : null, blocks: opts.risk && Array.isArray(opts.risk.blocks) ? opts.risk.blocks.slice() : [] },
      similar: null, lessonsApplied: [], confidence: 'low', uncertainty: [], gates: [], notes: [], refused: false,
      evidence: { support: 0, contradiction: 0, margin: 0, needMargin: P.takeMargin, needSupport: P.minSupport },
      modelVersion: model ? model.version || null : null, modelScore: ms ? ms.p : null,
      policyVersion: POLICY_VERSION, edgeVersion: (cand && cand.edgeVersion) || (edgeDef && edgeDef.version) || null, dataVersion: snapshot.dataVersion === undefined ? null : snapshot.dataVersion,
      featuresHash: hash(f),
    };
    if (opts.model && !model) d.notes.push('a model was passed but it is not promoted and calibrated: it was not used');
    const gate = (code, text) => { d.gates.push({ code, hard: true, overridable: GATES[code].overridable, text }); d.uncertainty.push(text); };
    const bias = f.htfBias || 'unknown';

    // ---- no candidate: nothing to take; keep the running thesis ----
    if (!cand) {
      d.similar = { n: 0, winRate: null, avgR: null, note: 'no candidate: nothing to compare', level: null, total: 0, regimeN: 0, undated: 0 };
      if (!f.barsOk) gate('data', `missing data: ${f.missingTf || f.sigTf}`);
      const th = opts.thesis || null, why = whyOf(f);
      d.waitReasons.push(`no candidate from ${P.name} at this time`);
      d.waitingFor.push(P.waitFor);
      d.invalidation = invalidationOf(f, null, null, null);
      d.thesis = `WAIT. Bias ${bias}${why.length ? ' (' + why.slice(0, 3).join('; ') + ')' : ''}. Waiting for ${expectingOf(P, f.htfBias)}.` + (th && th.bias && th.bias !== bias ? ` The bias has changed since the thesis began (${th.bias} to ${bias}).` : '');
      d.confidence = d.uncertainty.length ? 'low' : 'medium';
      d.id = decisionId(d);
      return d;
    }

    // ---- candidate: gates, evidence, base action ----
    const sim = similarOf(opts.history, f, snapshot.t, lim); d.similar = sim;
    let entry = d.entry, stop = d.stop, target = d.target, side = f.side, rr = f.rr, stopAtr = f.stopAtr, rrNet = rrNetOf(entry, stop, target, edgeDef);
    if (!f.barsOk || f.atr === null) gate('data', `missing data: ${f.missingTf || f.sigTf}`);
    if (!side || !fin(stop) || !fin(entry)) gate('geometry', 'the candidate has no side, entry or stop: never a trade without a stop');
    else if (f.geomOk === false) gate('geometry', 'the candidate\'s stop or target is on the wrong side of the entry');
    if (f.eventNear === true) gate('event', `event risk: ${f.eventTitle || 'a high-impact event'} ${f.eventMins >= 0 ? 'in ' + f.eventMins + ' min' : Math.abs(f.eventMins) + ' min ago'}`);
    const vg = fin(P.volGate) && !(opts.limits && fin(opts.limits.volGate)) ? P.volGate : lim.volGate;
    if (fin(f.volRatio) && f.volRatio >= vg) gate('volatility', `abnormal volatility: ATR is ${fmt(f.volRatio)} times its 100-bar median (limit ${vg})`);
    if (sim.total >= lim.historyMin && sim.regimeN < lim.unfamiliarN) gate('unfamiliar', `unfamiliar regime: only ${sim.regimeN} of ${sim.total} past cases were in a ${f.regime} regime`);
    if (f.htfLtfConflict === true && !P.allowConflict) gate('conflict', `higher and lower timeframes disagree: bias ${f.htfBias} against H1 ${f.structH1}, M15 ${f.structM15}`);
    // reward to risk after costs is judged on the FINAL levels (a lesson may move the stop or target), so it is gated below
    const rrBad0 = fin(rrNet) && rrNet < lim.minRrNet;
    if (target === null) d.notes.push('no fixed target: reward to risk cannot be judged up front');
    if (rrNet !== null && costPriceOf(edgeDef, 1) === null) d.notes.push('costs unknown: reward to risk is shown gross');
    if (sim.n < lim.similarMin) d.notes.push(sim.note);
    if (sim.undated) d.notes.push(`${sim.undated} history entr${sim.undated === 1 ? 'y has' : 'ies have'} no time (t) and were ignored: they cannot be shown to come before this decision`);

    const ev = evidenceOf(f, P, { rr, rrNet, stopAtr, similar: sim, thesis: opts.thesis || null, modelScore: ms, lim });
    d.supporting = ev.sup; d.contradicting = ev.con;
    const Sx = rd(sum(ev.sup, (i) => i.weight), 2), Cx = rd(sum(ev.con, (i) => i.weight), 2), margin = rd(Sx - Cx, 2);
    d.evidence = { support: Sx, contradiction: Cx, margin, needMargin: P.takeMargin, needSupport: P.minSupport };
    const evidenceTake = margin >= P.takeMargin && Sx >= P.minSupport;
    let action = evidenceTake && d.gates.length === 0 && !rrBad0 ? actOf(side) : 'WAIT';
    if (d.gates.length) for (const g of d.gates) d.waitReasons.push('uncertainty: ' + g.text);
    if (!evidenceTake) {
      d.waitReasons.push(margin < P.takeMargin
        ? `the evidence for the ${side || 'trade'} (${Sx}) does not beat the evidence against it (${Cx}) by the ${P.takeMargin} this edge needs`
        : `too little positive evidence: ${Sx} of the ${P.minSupport} this edge needs`);
      for (const c of ev.con.slice(0, 3)) d.waitReasons.push(c.text);
    }

    // ---- lessons: the mentor's saved rules, applied in specificity order ----
    const ret = lessons.retrieve(opts.lessons || [], f, snapshot.edge);
    const rec = (L, applied, effect) => d.lessonsApplied.push({ id: L.id, version: L.version, effect, applied, action: (L.then && L.then.action) || null, correctionId: (L.source && L.source.correctionId) || null, title: L.title || null });
    let lessonLed = false;
    if (ret.conflicts.length) {
      // two matching lessons demand opposite actions: this is NOT resolved silently; the decision waits and names them
      action = 'WAIT';
      const inConflict = {};
      for (const c of ret.conflicts) { inConflict[c.a] = c.b; inConflict[c.b] = c.a; const text = `conflicting lessons: ${c.a} vs ${c.b}`; d.gates.push({ code: 'lesson-conflict', hard: true, overridable: false, text }); d.uncertainty.push(text); d.waitReasons.unshift(`${text} (${c.aAction} against ${c.bAction}): the mentor has to settle which one holds here`); }
      for (const L of ret.matched) rec(L, false, inConflict[L.id] ? `not applied: conflicts with lesson ${inConflict[L.id]}` : 'not applied: the decision is held at WAIT by a lesson conflict');
    } else if (ret.matched.length) {
      const leader = ret.matched.find((L) => L.then && L.then.action), la = leader ? leader.then.action : null;
      const sameAct = ret.matched.filter((L) => L.then && L.then.action && L !== leader);
      const adjust = {}, adjBy = {};
      for (const L of ret.matched) for (const k of ['entry', 'stop', 'target']) if (L.then && L.then.adjust && L.then.adjust[k] && !adjust[k]) { adjust[k] = L.then.adjust[k]; adjBy[k] = L; }
      const effects = new Map(); const eff = (L, applied, text) => { const x = effects.get(L) || { applied: false, parts: [] }; x.applied = x.applied || applied; x.parts.push(text); effects.set(L, x); };
      if (la === 'WAIT' || la === 'SKIP') {
        const skip = la === 'SKIP' || sameAct.some((L) => L.then.action === 'SKIP');
        const was = action; action = 'WAIT'; d.refused = skip; lessonLed = true;
        d.waitReasons.unshift(`lesson "${leader.title || leader.id}": ${(leader.then.note || leader.text || (skip ? 'refuse this setup' : 'wait')).trim()}`);
        eff(leader, true, was === 'WAIT' ? `${la}: agrees with the policy, which was already waiting` : `${la}: changed ${was} to WAIT${skip ? ' (refused)' : ''}`);
        for (const L of sameAct) eff(L, true, `${L.then.action}: agrees with lesson ${leader.id}`);
      } else if (la === 'TAKE' || la === 'FLIP') {
        // a mentor's "take it" passes an overridable gate only when one of the same-action lessons names that gate's features
        const group = [leader].concat(sameAct), addresses = (g) => group.some((L) => (L.when || []).some((c) => GATES[g.code].features.indexOf(c.f) >= 0));
        const blocking = d.gates.filter((g) => !g.overridable || !addresses(g));
        if (!side) { eff(leader, false, `${la} not applied: the candidate has no side`); }
        else if (blocking.length) { eff(leader, false, `${la} not applied: blocked by ${blocking.map((g) => g.code).join(', ')} (${blocking.some((g) => g.overridable) ? 'the lesson does not name that condition' : 'a lesson cannot override it'})`); for (const L of sameAct) eff(L, false, `${L.then.action} not applied: blocked with lesson ${leader.id}`); }
        else {
          const was = action;
          for (const g of d.gates) { g.hard = false; g.overriddenBy = leader.id; }
          d.uncertainty = d.uncertainty.map((u) => `${u} (taken anyway on lesson ${leader.id})`);
          d.waitReasons = [];
          if (la === 'FLIP') { side = side === 'buy' ? 'sell' : 'buy'; if (fin(stop)) stop = entry + (entry - stop); if (fin(target)) target = entry - (target - entry); }
          action = actOf(side); lessonLed = true;
          eff(leader, true, la === 'FLIP' ? `FLIP: took the other side (${action}), stop and target mirrored around the entry` : was === action ? 'TAKE: agrees with the policy, which was already taking it' : `TAKE: changed ${was} to ${action}`);
          for (const L of sameAct) eff(L, true, `${L.then.action}: agrees with lesson ${leader.id}`);
        }
      }
      // level adjustments (rules relative to features, never raw prices); only when the decision is a trade
      if (isTake(action) && (adjust.entry || adjust.stop || adjust.target)) {
        const dir = side === 'buy' ? 1 : -1, risk0 = Math.abs(entry - stop), c0 = { entry, stop, target };
        const run = (k, riskUnit, cur) => { const v = applyRule(adjust[k], { dir, f, entry: cur.entry, stop: cur.stop, target: cur.target, risk: riskUnit }); if (v === null) eff(adjBy[k], false, `${k} rule not applied: ${adjust[k].ref} is not available here`); return v; };
        const n = { entry, stop, target };
        if (adjust.entry) { const v = run('entry', risk0, c0); if (v !== null) n.entry = v; }
        if (adjust.stop) { const v = run('stop', risk0, { entry: n.entry, stop: c0.stop, target: c0.target }); if (v !== null) n.stop = v; }
        if (adjust.target) { const v = run('target', Math.abs(n.entry - n.stop), { entry: n.entry, stop: n.stop, target: c0.target }); if (v !== null) n.target = v; }
        const ok = fin(n.entry) && fin(n.stop) && dir * (n.entry - n.stop) > 0 && (n.target === null || (fin(n.target) && dir * (n.target - n.entry) > 0));
        for (const k of ['entry', 'stop', 'target']) {
          if (!adjust[k] || n[k] === c0[k]) continue;
          if (ok) eff(adjBy[k], true, `${k} ${fmt(c0[k], 5)} to ${fmt(n[k], 5)} (${ruleText(adjust[k], k)})`);
          else eff(adjBy[k], false, `${k} rule rejected: it would put the stop or target on the wrong side of the entry`);
        }
        if (ok) { entry = rp(n.entry); stop = rp(n.stop); target = n.target === null ? null : rp(n.target); }
      } else for (const k of ['entry', 'stop', 'target']) if (adjust[k]) eff(adjBy[k], false, `${k} rule not applied: the decision is WAIT`);
      for (const L of ret.matched) { const x = effects.get(L); rec(L, x ? x.applied : false, x ? x.parts.join('; ') : 'matched, nothing to change'); }
    }

    // ---- final geometry, the reward-to-risk gate again (a lesson may have moved the levels), then the risk engine ----
    const riskDist = fin(entry) && fin(stop) ? Math.abs(entry - stop) : null;
    rr = fin(target) && riskDist > 0 ? rd(Math.abs(target - entry) / riskDist) : null; rrNet = rrNetOf(entry, stop, target, edgeDef);
    stopAtr = riskDist !== null && f.atr ? rd(riskDist / f.atr) : null;
    if (fin(rrNet) && rrNet < lim.minRrNet) { const text = `reward to risk after costs is ${fmt(rrNet)}, below ${lim.minRrNet}`; d.gates.push({ code: 'rr', hard: true, overridable: false, text }); d.uncertainty.push(text); action = 'WAIT'; d.waitReasons.unshift('uncertainty: ' + text); }
    if (opts.risk && opts.risk.allowed === false) {
      action = 'WAIT'; const text = `risk engine: ${d.risk.blocks.length ? d.risk.blocks.join('; ') : 'order not allowed'}`;
      d.gates.push({ code: 'risk', hard: true, overridable: false, text }); d.waitReasons.unshift(text);
    }
    d.action = action; d.side = side; d.entry = entry; d.stop = stop; d.target = target;
    d.risk.rr = rr; d.risk.rrNet = rd(rrNet); d.risk.stopAtr = stopAtr;
    d.invalidation = invalidationOf(f, side, entry, stop);
    if (action === 'WAIT') { d.waitingFor = uniq(ev.con.slice(0, 4).map((c) => WAIT_FOR[c.factor]).filter(Boolean)); if (!d.waitReasons.length) d.waitReasons.push('held at WAIT'); }
    d.confidence = confidenceOf(action, margin, P.takeMargin, sim, d.uncertainty, lim);
    const top = (a) => (a.length ? a[0].text : 'none');
    d.thesis = isTake(action)
      ? `${action} the ${P.name} candidate${lessonLed ? ' on the mentor\'s lesson' : ''}. Bias ${bias}, ${f.sigTf} regime ${f.regime || 'unknown'}. Evidence for ${Sx}, against ${Cx}. Strongest reason: ${top(ev.sup)} Main doubt: ${top(ev.con)}`
      : `WAIT on the ${side || ''} candidate from ${P.name}${d.refused ? ' (refused)' : ''}: ${d.waitReasons[0]}. Bias ${bias}, ${f.sigTf} regime ${f.regime || 'unknown'}. Evidence for ${Sx}, against ${Cx}.`;
    d.id = decisionId(d);
    return d;
  }

  // ---- MANAGE: advice on an open position. It may hold, tighten or advise an exit; it never loosens a stop. -------------
  // position = { side, entry, stop, target?, initialStop?, tf?, id?, candidateId? }
  function manageDecision(snapshot, opts, lim) {
    const pos = opts.position, pseudo = Object.assign({}, snapshot, { cand: { id: pos.id || null, side: pos.side, entry: pos.entry, stop: fin(pos.initialStop) ? pos.initialStop : pos.stop, target: fin(pos.target) ? pos.target : null, tf: pos.tf || (snapshot.cand ? snapshot.cand.tf : undefined), edgeVersion: snapshot.cand ? snapshot.cand.edgeVersion : undefined } });
    const B = build(pseudo), f = B.f, P = B.P, dir = pos.side === 'buy' ? 1 : pos.side === 'sell' ? -1 : 0, price = f.lastClose;
    const risk0 = fin(pos.entry) && fin(fin(pos.initialStop) ? pos.initialStop : pos.stop) ? Math.abs(pos.entry - (fin(pos.initialStop) ? pos.initialStop : pos.stop)) : null;
    const openR = dir && fin(price) && risk0 > 0 ? dir * (price - pos.entry) / risk0 : null;
    const reasons = []; let advice = 'hold', newStop = fin(pos.stop) ? pos.stop : null;
    const tighten = (level, why) => { if (fin(level) && fin(price) && newStop !== null && dir * (level - newStop) > 0 && dir * (price - level) > 0) { newStop = rp(level); advice = 'tighten'; reasons.push(why); } };
    if (!dir || newStop === null) { advice = 'exit'; reasons.push('the position has no stop or no side: never hold a trade without a stop'); }
    else if (!fin(price)) reasons.push('no closed bar to judge the position on: hold with the stop in place');
    else if (dir * (price - pos.stop) <= 0) { advice = 'exit'; reasons.push(`price ${fmt(price, 5)} is at or through the stop ${fmt(pos.stop, 5)}`); }
    else {
      const sigStruct = f.sigTf === '1d' ? f.structD1 : f.sigTf === '4h' ? f.structH4 : f.sigTf === '1h' ? f.structH1 : f.sigTf === '15m' ? f.structM15 : null;
      const structAgainst = sigStruct !== null && sigStruct === (dir > 0 ? 'down' : 'up');
      if (structAgainst && f.dispFor === 'against' && f.dispAge <= 3) { advice = 'exit'; reasons.push(`${f.sigTf} structure has turned ${sigStruct} and the last displacement (${fmt(f.dispSize)} ATR, ${f.dispAge} bars ago) is against the position`); }
      else {
        if (openR !== null && openR >= 1) tighten(pos.entry, `the position is ${fmt(openR)} R in profit: stop to breakeven`);
        if (openR !== null && openR >= 2 && fin(f.atr)) tighten(dir > 0 ? (fin(f.nearSup) ? f.nearSup - 0.25 * f.atr : null) : (fin(f.nearRes) ? f.nearRes + 0.25 * f.atr : null), `the position is ${fmt(openR)} R in profit: trail the stop behind the nearest ${dir > 0 ? 'support' : 'resistance'}`);
        if (f.sweepFor === 'against' && f.sweepAge <= 3 && openR !== null && openR >= 0.5) tighten(pos.entry, `a ${f.sweep} sweep of the ${f.sweepOf} level ${f.sweepAge} bars ago closed back against the position: stop to breakeven`);
        if (f.eventNear === true && f.eventMins >= 0 && openR !== null && openR >= 0.5) tighten(pos.entry, `${f.eventTitle || 'a high-impact event'} in ${f.eventMins} min: stop to breakeven before it`);
        if (f.biasAlign === 'against') reasons.push(`the higher-timeframe bias is now ${f.htfBias}, against the position: hold only with the stop where it is or tighter`);
        if (advice === 'hold' && !reasons.length) reasons.push(`nothing has changed against the position (open ${fmt(openR)} R): hold, stop unchanged`);
      }
    }
    if (newStop !== null && fin(pos.stop) && dir * (newStop - pos.stop) < 0) newStop = pos.stop;      // belt and braces: never looser
    const sim = { n: 0, winRate: null, avgR: null, note: 'not used for position management', level: null, total: 0, regimeN: 0, undated: 0 };
    const ev = evidenceOf(f, P, { rr: null, rrNet: null, stopAtr: null, similar: sim, thesis: opts.thesis || null, modelScore: null, lim });
    const Sx = rd(sum(ev.sup, (i) => i.weight), 2), Cx = rd(sum(ev.con, (i) => i.weight), 2);
    const d = {
      id: null, edge: snapshot.edge || null, market: snapshot.market || null, t: snapshot.t, action: 'MANAGE', side: pos.side || null,
      entry: fin(pos.entry) ? pos.entry : null, stop: newStop, target: fin(pos.target) ? pos.target : null, candidateId: pos.candidateId || pos.id || null,
      thesis: `MANAGE: ${advice}. ${reasons[0] || ''}`, supporting: ev.sup, contradicting: ev.con, waitReasons: [], waitingFor: [], invalidation: invalidationOf(f, pos.side, pos.entry, newStop),
      risk: { rr: null, rrNet: null, stopAtr: fin(f.atr) && newStop !== null && fin(pos.entry) ? rd(Math.abs(pos.entry - newStop) / f.atr) : null, riskPct: null, allowed: null, blocks: [] },
      similar: sim, lessonsApplied: [], confidence: !f.barsOk ? 'low' : advice === 'exit' ? 'medium' : 'low', uncertainty: f.barsOk ? [] : [`missing data: ${f.missingTf || f.sigTf}`], gates: [], notes: ['lessons are not applied to position management'], refused: false,
      evidence: { support: Sx, contradiction: Cx, margin: rd(Sx - Cx, 2), needMargin: P.takeMargin, needSupport: P.minSupport },
      manage: { advice, reasons, stop: newStop, stopFrom: fin(pos.stop) ? pos.stop : null, openR: rd(openR) },
      modelVersion: null, modelScore: null, policyVersion: POLICY_VERSION, edgeVersion: (snapshot.cand && snapshot.cand.edgeVersion) || (opts.edgeDef && opts.edgeDef.version) || null,
      dataVersion: snapshot.dataVersion === undefined ? null : snapshot.dataVersion, featuresHash: hash(f),
    };
    d.id = decisionId(d);
    return d;
  }

  // ---- 5. the running thesis (pure: every call returns a new object) ---------------------------------------------------
  const CAP = { changes: 60, decisions: 40, biasHistory: 40 };
  function thesisLevels(f) { return { below: f.htfBias === 'up' && fin(f.htfSwingLow) ? f.htfSwingLow : null, above: f.htfBias === 'down' && fin(f.htfSwingHigh) ? f.htfSwingHigh : null }; }
  const thesis = {
    start(snapshot) {
      assertNoFuture(snapshot);
      const B = build(snapshot), f = B.f, bias = f.htfBias || 'unknown';
      return { id: 'th-' + hash([snapshot.edge, snapshot.market, snapshot.t]).slice(0, 12), edge: snapshot.edge || null, market: snapshot.market || null, startedAt: snapshot.t, updatedAt: snapshot.t,
        status: 'waiting', bias, expecting: expectingOf(B.P, f.htfBias), why: whyOf(f), invalidation: invalidationOf(f, null, null, null), levels: thesisLevels(f),
        changes: [], decisions: [], biasHistory: [{ t: snapshot.t, bias }] };
    },
    update(th, snapshot, decision) {
      assertNoFuture(snapshot);
      const n = clone(th), t = snapshot.t, B = build(snapshot), f = B.f, bias = f.htfBias || 'unknown', d = decision || null;
      const change = (c) => { n.changes.push(Object.assign({ t }, c)); };
      const refresh = () => { n.expecting = expectingOf(B.P, f.htfBias); n.why = whyOf(f); n.invalidation = invalidationOf(f, null, null, null); n.levels = thesisLevels(f); };
      n.updatedAt = t; n.changes = n.changes || []; n.decisions = n.decisions || []; n.biasHistory = n.biasHistory || [];
      const lv = th.levels || {};
      if (fin(f.lastClose) && ((fin(lv.below) && f.lastClose < lv.below) || (fin(lv.above) && f.lastClose > lv.above))) {
        change({ kind: 'invalidation', text: `invalidation hit: close ${fmt(f.lastClose, 5)} is ${fin(lv.below) && f.lastClose < lv.below ? 'below ' + fmt(lv.below, 5) : 'above ' + fmt(lv.above, 5)}, the level the ${th.bias} thesis rested on` });
        n.status = 'invalidated'; refresh();
      }
      if (bias !== th.bias) {
        change({ kind: 'bias', from: th.bias, to: bias, text: `bias ${th.bias} to ${bias}: ${whyOf(f).slice(0, 3).join('; ') || 'higher-timeframe reading changed'}` });
        n.bias = bias; n.biasHistory.push({ t, bias }); refresh(); if (n.status === 'invalidated') n.status = 'waiting';
      }
      if (d) {
        const why = d.action === 'WAIT' ? (d.waitReasons && d.waitReasons[0]) || 'waiting' : d.action === 'MANAGE' ? (d.manage ? d.manage.advice + ': ' + (d.manage.reasons[0] || '') : 'manage') : (d.supporting && d.supporting[0] ? d.supporting[0].text : 'taken');
        if (isTake(d.action)) { change({ kind: 'entered', text: `entered ${d.action} at ${fmt(d.entry, 5)}, stop ${fmt(d.stop, 5)}: ${why}` }); n.status = 'in-trade'; }
        else if (d.action === 'MANAGE') change({ kind: 'manage', text: why });
        else if (d.candidateId) change({ kind: 'rejected', text: `${d.refused ? 'refused' : 'rejected'} candidate ${d.candidateId}: ${why}` });
        else {
          const text = `still waiting for ${n.expecting}`, lastC = n.changes[n.changes.length - 1];
          if (lastC && lastC.kind === 'waiting' && lastC.text === text) n.changes[n.changes.length - 1] = Object.assign({}, lastC, { until: t, n: (lastC.n || 1) + 1 });
          else change({ kind: 'waiting', text });
        }
        n.decisions.push({ t, id: d.id || null, action: d.action, candidateId: d.candidateId || null, why });
      }
      n.changes = n.changes.slice(-CAP.changes); n.decisions = n.decisions.slice(-CAP.decisions); n.biasHistory = n.biasHistory.slice(-CAP.biasHistory);
      return n;
    },
  };

  // ---- 6. lessons: the rule memory -------------------------------------------------------------------------------------
  // A lesson is "when these features look like this, do that". It is the only thing that changes the engine's behaviour
  // between two attempts on the same snapshot, and every application is written into decision.lessonsApplied.
  const OPS = ['eq', 'ne', 'gte', 'lte', 'in', 'between'];
  const LESSON_ACTIONS = ['WAIT', 'SKIP', 'TAKE', 'FLIP'];
  // Which features a mentor's reason proposes as conditions. Side-relative keys on purpose (biasAlign, not htfBias), so a
  // lesson learned on a buy also fires on the mirror-image sell.
  const REASON_FEATURES = {
    'missing-confirmation': ['confirm', 'dispFor'],
    'wrong-structure': ['ltfAlign', 'regime'],
    liquidity: ['sweepFor', 'oppLiq'],
    'htf-bias': ['biasAlign', 'htfLtfConflict'],
    session: ['session'],
    volatility: ['volState'],
    rr: ['rr', 'stopAtr'],
    news: ['eventNear'],
    late: ['entryOffset', 'locFor'],
    early: ['confirm', 'sweepFor'],
    other: [],
  };
  const REASON_DEFAULT = ['biasAlign', 'regime'];          // used when the reasons name no feature at all
  // half-width of the band a numeric feature gets around the observed value
  const NUM_TOL = { eventInH: 2, eventMins: 60, rr: 0.5, stopAtr: 0.5, targetAtr: 1, entryOffset: 0.5, trigCloseLoc: 0.2, entryLoc: 0.15, atrPctile: 0.15, volRatio: 0.4, oppLiqFrac: 0.2, roc: 1, trendStrength: 0.75, effRatio: 0.15, hourUtc: 1 };
  // Anchors a level rule may refer to. "Behind" = on the losing side of the trade (below a buy), "ahead" = on the winning side.
  const ADJUST_REFS = ['entry', 'stop', 'target', 'lastClose', 'sweepLevel', 'levelBehind', 'levelAhead', 'dayBehind', 'dayAhead', 'weekBehind', 'weekAhead', 'sessBehind', 'sessAhead', 'eqBehind', 'eqAhead'];
  const REF_WORD = { entry: 'the entry', stop: 'the edge\'s stop', target: 'the edge\'s target', lastClose: 'the last close', sweepLevel: 'the swept level', levelBehind: 'the nearest level behind the trade', levelAhead: 'the nearest level ahead', dayBehind: 'the prior day level behind the trade', dayAhead: 'the prior day level ahead', weekBehind: 'the prior week level behind the trade', weekAhead: 'the prior week level ahead', sessBehind: 'the previous session level behind the trade', sessAhead: 'the previous session level ahead', eqBehind: 'the equal highs / lows behind the trade', eqAhead: 'the equal highs / lows ahead' };
  function anchorOf(ref, c) {
    const f = c.f, up = c.dir > 0;
    switch (ref) {
      case 'entry': return fin(c.entry) ? c.entry : null;
      case 'stop': return fin(c.stop) ? c.stop : null;
      case 'target': return fin(c.target) ? c.target : null;
      case 'lastClose': return f.lastClose;
      case 'sweepLevel': return f.sweepLevel;
      case 'levelBehind': return up ? f.nearSup : f.nearRes;
      case 'levelAhead': return up ? f.nearRes : f.nearSup;
      case 'dayBehind': return up ? f.pdl : f.pdh;
      case 'dayAhead': return up ? f.pdh : f.pdl;
      case 'weekBehind': return up ? f.pwl : f.pwh;
      case 'weekAhead': return up ? f.pwh : f.pwl;
      case 'sessBehind': return up ? f.sessLow : f.sessHigh;
      case 'sessAhead': return up ? f.sessHigh : f.sessLow;
      case 'eqBehind': return up ? f.eqLow : f.eqHigh;
      case 'eqAhead': return up ? f.eqHigh : f.eqLow;
      default: return null;
    }
  }
  // A rule { ref, k, unit }: price = anchor + direction * k * unit. k is measured in the trade's direction (negative =
  // behind the anchor). unit 'atr' = ATR of sigTf; unit 'r' = the risk distance (for a target: of the final entry and stop).
  function applyRule(rule, c) {
    if (!rule || ADJUST_REFS.indexOf(rule.ref) < 0 || !fin(rule.k)) return null;
    const a = anchorOf(rule.ref, c), u = rule.unit === 'r' ? c.risk : c.f.atr;
    return fin(a) && fin(u) ? a + c.dir * rule.k * u : null;
  }
  const ruleText = (rule, field) => `${field} = ${Math.abs(rule.k) < 1e-9 ? 'at' : fmt(Math.abs(rule.k)) + (rule.unit === 'r' ? ' R ' : ' ATR ') + (rule.k < 0 ? 'behind' : 'beyond')} ${REF_WORD[rule.ref] || rule.ref}`;
  function deriveRule(field, price, c) {
    const atr = c.f.atr; if (!fin(atr) || !(atr > 0) || !fin(price)) return null;
    const near = (refs, maxAtr, sideOk) => {
      let best = null;
      for (const ref of refs) { const a = anchorOf(ref, c); if (!fin(a)) continue; const k = c.dir * (price - a) / atr; if (Math.abs(k) > maxAtr || (sideOk && !sideOk(k))) continue; if (!best || Math.abs(k) < Math.abs(best.k)) best = { ref, k: rd(k, 4), unit: 'atr' }; }
      return best;
    };
    let r = null;
    if (field === 'stop') r = near((c.f.sweepLevel !== null && c.sweepWith ? ['sweepLevel'] : []).concat(['levelBehind', 'dayBehind', 'sessBehind', 'weekBehind', 'eqBehind']), 1, (k) => k <= 0) || { ref: 'entry', k: rd(c.dir * (price - c.entry) / atr, 4), unit: 'atr' };
    else if (field === 'target') { const risk = Math.abs(c.entry - c.stop); r = near(['levelAhead', 'dayAhead', 'sessAhead', 'weekAhead', 'eqAhead'], 0.5) || (risk > 0 ? { ref: 'entry', k: rd(c.dir * (price - c.entry) / risk, 4), unit: 'r' } : null); }
    else r = near(['sweepLevel', 'levelBehind', 'levelAhead', 'dayBehind', 'dayAhead'], 0.5) || { ref: 'lastClose', k: rd(c.dir * (price - c.f.lastClose) / atr, 4), unit: 'atr' };
    if (r) r.text = ruleText(r, field);
    return r;
  }
  function condFor(key, v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      if (key === 'oppLiq' || key === 'sweepAge' || key === 'dispAge') return v > 0 ? { f: key, op: 'gte', v: 1 } : { f: key, op: 'eq', v: 0 };
      const tol = NUM_TOL[key] !== undefined ? NUM_TOL[key] : Math.max(0.25, Math.abs(v) * 0.25);
      return { f: key, op: 'between', v: [rd(v - tol, 4), rd(v + tol, 4)] };
    }
    return { f: key, op: 'eq', v };
  }
  function matches(lesson, f) {
    if (!lesson || !Array.isArray(lesson.when) || !f) return false;
    for (const c of lesson.when) {
      const x = f[c.f];
      if (x === null || x === undefined) { if (c.op === 'eq' && c.v === null) continue; return false; }      // a missing feature never matches
      if (c.op === 'eq') { if (x !== c.v) return false; }
      else if (c.op === 'ne') { if (x === c.v) return false; }
      else if (c.op === 'gte') { if (!(x >= c.v)) return false; }
      else if (c.op === 'lte') { if (!(x <= c.v)) return false; }
      else if (c.op === 'in') { if (!Array.isArray(c.v) || c.v.indexOf(x) < 0) return false; }
      else if (c.op === 'between') { if (!Array.isArray(c.v) || !(x >= c.v[0] && x <= c.v[1])) return false; }
      else return false;
    }
    return true;
  }
  const opposed = (a, b) => { const stay = (x) => x === 'WAIT' || x === 'SKIP'; return !!a && !!b && a !== b && !(stay(a) && stay(b)); };
  const lessons = {
    OPS, ACTIONS: LESSON_ACTIONS,
    matches,
    // (decision, correction, features) -> a Lesson draft. The mentor's text is kept word for word; the conditions are a
    // PROPOSAL from the features in the groups the mentor's reasons name, for the mentor to edit before saving.
    fromCorrection(decision, correction, f) {
      const d = decision || {}, k = correction || {}, edge = k.edge || d.edge || '*';
      const candSide = d.side || (f && f.side) || (fin(d.entry) && fin(d.stop) ? (d.stop < d.entry ? 'buy' : 'sell') : null);
      const dTook = isTake(d.action);
      let mAct = k.action || null;
      if (k.verdict === 'approve') mAct = d.action === 'MANAGE' ? null : d.action;
      else if (k.verdict === 'reject' && !mAct) mAct = dTook ? 'WAIT' : actOf(candSide);
      let act = null;
      if (mAct === 'WAIT') act = k.verdict === 'reject' && dTook && !k.action ? 'SKIP' : 'WAIT';
      else if (isTake(mAct)) act = !candSide || actOf(candSide) === mAct ? 'TAKE' : 'FLIP';
      // level rules (only when the mentor's answer is a trade)
      const adjust = {};
      if (isTake(mAct) && f) {
        const dir = mAct === 'BUY' ? 1 : -1, flipped = act === 'FLIP';
        const base = { entry: d.entry, stop: flipped && fin(d.stop) && fin(d.entry) ? d.entry + (d.entry - d.stop) : d.stop, target: flipped && fin(d.target) && fin(d.entry) ? d.entry - (d.target - d.entry) : d.target };
        const mE = fin(k.entry) ? k.entry : base.entry, mS = fin(k.stop) ? k.stop : base.stop, eps = fin(f.atr) ? 0.02 * f.atr : 0;
        const c = { dir, f, entry: mE, stop: mS, target: base.target, sweepWith: f.sweep !== 'none' && f.sweep !== null && (f.sweep === 'low') === (dir > 0) };
        if (fin(k.entry) && (!fin(base.entry) || Math.abs(k.entry - base.entry) > eps)) { const r = deriveRule('entry', k.entry, Object.assign({}, c, { entry: base.entry, stop: base.stop })); if (r) adjust.entry = r; }
        if (fin(k.stop) && (!fin(base.stop) || Math.abs(k.stop - base.stop) > eps)) { const r = deriveRule('stop', k.stop, c); if (r) adjust.stop = r; }
        if (fin(k.target) && (!fin(base.target) || Math.abs(k.target - base.target) > eps)) { const r = deriveRule('target', k.target, c); if (r) adjust.target = r; }
      }
      // proposed conditions
      const keys = [];
      for (const r of Array.isArray(k.reasons) ? k.reasons : []) for (const key of REASON_FEATURES[r] || []) keys.push(key);
      // a "take it" that has to pass a gate the decision hit must name that gate's feature, or the gate would still stand
      if ((act === 'TAKE' || act === 'FLIP') && Array.isArray(d.gates)) for (const g of d.gates) if (GATES[g.code] && GATES[g.code].overridable) keys.push(GATES[g.code].features[0]);
      let when = uniq(keys).map((key) => condFor(key, f ? f[key] : null)).filter(Boolean);
      if (!when.length) when = REASON_DEFAULT.map((key) => condFor(key, f ? f[key] : null)).filter(Boolean);
      const reasons = (Array.isArray(k.reasons) ? k.reasons : []).join(', ') || 'mentor correction';
      const note = k.verdict === 'approve' ? `Mentor approved ${d.action}.` : `Mentor: ${mAct || 'adjust the levels'} instead of ${d.action} (${reasons}).`;
      const at = fin(k.at) ? k.at : fin(d.t) ? d.t : null;
      return {
        id: 'L-' + hash([edge, d.id || null, k.id || null, act, when]).slice(0, 10), edge, version: 1, active: true,
        title: `${act || 'Adjust'} · ${edge}: ${reasons}`, text: k.text || '', createdAt: at, updatedAt: at,
        when, then: { action: act, adjust, note },
        source: { attemptId: k.attemptId || null, correctionId: k.id || null, candidateId: d.candidateId || null, sessionId: k.sessionId || null },
        supersedes: null,
        stats: { applied: 0, replayPass: 0, replayFail: 0, examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 },
      };
    },
    // Active lessons for this edge (or '*') whose conditions all hold, ranked: more conditions first, then the newer version.
    // Versions: revise() keeps the id and adds 1 to the version. Of several entries with one id only the HIGHEST version
    // counts, and only if it is active (deactivating the newest version does not bring an older one back).
    retrieve(list, f, edge) {
      const newest = {}, replaced = {};
      for (const L of Array.isArray(list) ? list : []) { if (!L || !L.id) continue; if (!newest[L.id] || (L.version || 0) > (newest[L.id].version || 0)) newest[L.id] = L; }
      for (const id of Object.keys(newest)) { const L = newest[id]; if (L.active !== false && L.supersedes && L.supersedes !== L.id) replaced[L.supersedes] = true; }
      const matched = Object.keys(newest).map((id) => newest[id])
        .filter((L) => L.active !== false && !replaced[L.id] && (L.edge === '*' || L.edge === edge) && matches(L, f))
        .sort((a, b) => b.when.length - a.when.length || (b.version || 0) - (a.version || 0) || (b.updatedAt || 0) - (a.updatedAt || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const conflicts = [];
      for (let i = 0; i < matched.length; i++) for (let j = i + 1; j < matched.length; j++) {
        const a = matched[i].then && matched[i].then.action, b = matched[j].then && matched[j].then.action;
        if (opposed(a, b)) conflicts.push({ a: matched[i].id, b: matched[j].id, aAction: a, bAction: b, text: `${matched[i].id} (${a}) vs ${matched[j].id} (${b})` });
      }
      return { matched, conflicts };
    },
    // a new version: same id, version + 1, supersedes = the id it replaces; the old object is untouched (the store keeps it)
    revise(lesson, patch, at) {
      const n = clone(lesson), p = patch || {};
      for (const key of ['title', 'text', 'when', 'then', 'edge', 'active']) if (p[key] !== undefined) n[key] = clone(p[key]);
      n.version = (lesson.version || 1) + 1; n.supersedes = lesson.id; n.active = p.active === undefined ? true : !!p.active;
      n.updatedAt = fin(p.updatedAt) ? p.updatedAt : fin(at) ? at : lesson.updatedAt;
      n.stats = { applied: 0, replayPass: 0, replayFail: 0, examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 };
      return n;
    },
    deactivate(lesson, at) { const n = clone(lesson); n.active = false; if (fin(at)) n.updatedAt = at; return n; },
    validate(lesson) {
      const err = [], L = lesson || {};
      if (!L.id) err.push('id is missing');
      if (!L.edge) err.push('edge is missing (use "*" for every edge)');
      if (!(L.version >= 1)) err.push('version must be 1 or more');
      if (!Array.isArray(L.when) || !L.when.length) err.push('when needs at least one condition (a lesson with none would fire on everything)');
      for (const c of Array.isArray(L.when) ? L.when : []) {
        if (!c || !Object.prototype.hasOwnProperty.call(FEATURE_DOC, c.f)) { err.push(`unknown feature key "${c && c.f}"`); continue; }
        if (PRICE_KEYS.indexOf(c.f) >= 0) err.push(`"${c.f}" is a raw price level: a lesson cannot condition on it (it would not generalise)`);
        if (OPS.indexOf(c.op) < 0) { err.push(`bad op "${c.op}" on ${c.f}`); continue; }
        if (c.op === 'in' && !Array.isArray(c.v)) err.push(`op "in" on ${c.f} needs a list`);
        if (c.op === 'between' && !(Array.isArray(c.v) && c.v.length === 2 && fin(c.v[0]) && fin(c.v[1]) && c.v[0] <= c.v[1])) err.push(`op "between" on ${c.f} needs [low, high]`);
        if ((c.op === 'gte' || c.op === 'lte') && !fin(c.v)) err.push(`op "${c.op}" on ${c.f} needs a number`);
      }
      const th = L.then;
      if (!th || typeof th !== 'object') err.push('then is missing');
      else {
        if (th.action !== null && th.action !== undefined && LESSON_ACTIONS.indexOf(th.action) < 0) err.push(`bad action "${th.action}"`);
        const adj = th.adjust || {}, has = ['entry', 'stop', 'target'].filter((key) => adj[key]);
        for (const key of has) { const r = adj[key]; if (ADJUST_REFS.indexOf(r.ref) < 0) err.push(`${key} rule: unknown anchor "${r.ref}"`); if (!fin(r.k)) err.push(`${key} rule: k must be a number`); if (r.unit !== 'atr' && r.unit !== 'r') err.push(`${key} rule: unit must be "atr" or "r"`); }
        for (const key of Object.keys(adj)) if (['entry', 'stop', 'target'].indexOf(key) < 0) err.push(`adjust has an unknown field "${key}"`);
        if (!th.action && !has.length) err.push('then does nothing: give an action or a level rule');
      }
      return err;
    },
  };

  // ---- 7. grading and comparison ----------------------------------------------------------------------------------------
  // what the mentor asked for, given the decision the correction was made on
  function expectedOf(correction, original) {
    const k = correction || {}, o = original || {}, oTook = isTake(o.action);
    let action = k.action || null;
    if (k.verdict === 'approve') action = action || o.action || null;
    else if (!action && k.verdict === 'reject') action = oTook ? 'WAIT' : actOf(o.side);
    else if (!action && k.verdict === 'change') action = o.action || null;
    const lv = (key) => (!isTake(action) ? null : fin(k[key]) ? k[key] : k.verdict === 'approve' && fin(o[key]) ? o[key] : null);
    return { action, entry: lv('entry'), stop: lv('stop'), target: lv('target') };
  }
  function gradeWith(decision, exp, tolR) {
    const d = decision || {}, tr = fin(tolR) ? tolR : LIMITS.tolR;
    const risk = fin(exp.entry) && fin(exp.stop) && exp.entry !== exp.stop ? Math.abs(exp.entry - exp.stop) : fin(d.entry) && fin(d.stop) && d.entry !== d.stop ? Math.abs(d.entry - d.stop) : null;
    const tol = risk !== null ? tr * risk : 0, errR = {}, m = { action: exp.action === null ? null : d.action === exp.action };
    for (const key of ['entry', 'stop', 'target']) {
      if (exp[key] === null || exp[key] === undefined) { m[key] = null; errR[key] = null; continue; }
      errR[key] = fin(d[key]) && risk ? rd(Math.abs(d[key] - exp[key]) / risk) : null;
      m[key] = fin(d[key]) && Math.abs(d[key] - exp[key]) <= tol + 1e-9;
    }
    const lv = ['entry', 'stop', 'target'].filter((key) => m[key] !== null), lvOk = lv.filter((key) => m[key]).length;
    const score = m.action === false ? 0 : lv.length ? rd(0.5 + 0.5 * lvOk / lv.length) : 1;
    return { action: m.action, entry: m.entry, stop: m.stop, target: m.target, errR, score, grade: score >= 1 ? 'match' : score > 0 ? 'partial' : 'miss', expected: exp };
  }
  // how one decision stands against the mentor's correction of THAT decision
  function gradeAgainst(decision, correction, opts) { return gradeWith(decision, expectedOf(correction, decision), opts && opts.tolR); }
  const decOf = (a) => (a && a.decision ? a.decision : a) || {};
  // attempt A (before the lesson) against attempt B (after) on the same decision point, judged by the mentor's correction of A
  function compare(attemptA, attemptB, correction, opts) {
    const A = decOf(attemptA), Bd = decOf(attemptB), k = correction || {}, changed = [];
    const ids = (d) => (d.lessonsApplied || []).filter((l) => l.applied !== false).map((l) => l.id + '@' + l.version);
    for (const field of ['action', 'entry', 'stop', 'target', 'confidence']) if (stable(A[field]) !== stable(Bd[field])) changed.push({ field, from: A[field] === undefined ? null : A[field], to: Bd[field] === undefined ? null : Bd[field] });
    for (const field of ['waitReasons', 'uncertainty']) if (stable(A[field] || []) !== stable(Bd[field] || [])) changed.push({ field, from: A[field] || [], to: Bd[field] || [] });
    if (stable(ids(A)) !== stable(ids(Bd))) changed.push({ field: 'lessonsApplied', from: ids(A), to: ids(Bd) });
    const g = gradeWith(Bd, expectedOf(k, A), opts && opts.tolR), gA = gradeWith(A, expectedOf(k, A), opts && opts.tolR);
    const before = ids(A), applied = (Bd.lessonsApplied || []).filter((l) => l.applied !== false && ((k.id && l.correctionId === k.id) || before.indexOf(l.id + '@' + l.version) < 0));
    const lessonIds = uniq(applied.map((l) => l.id)), lessonApplied = lessonIds.length > 0;
    const levelsOk = ['entry', 'stop', 'target'].every((key) => g[key] !== false), full = g.action !== false && levelsOk;
    let verdict, note;
    if (k.verdict === 'approve') { verdict = full ? 'learned' : 'not-learned'; note = full ? 'the approved decision was repeated' : 'the approved decision was not repeated'; }
    else if (full && lessonApplied) { verdict = 'learned'; note = 'the second attempt matches the correction and a lesson from it was applied'; }
    else if (full) { verdict = 'partly'; note = 'the second attempt matches the correction, but no new lesson was applied: the change did not come from the lesson'; }
    else if (g.action === true || g.score > gA.score || (lessonApplied && changed.length > 0)) { verdict = 'partly'; note = g.action === true ? 'the action matches the correction but a level does not' : 'the lesson changed the decision, but not to what the mentor asked for'; }
    else { verdict = 'not-learned'; note = lessonApplied ? 'a lesson was applied but the decision still does not match the correction' : 'no lesson was applied and the decision did not change towards the correction'; }
    return { changed, matchesCorrection: { action: g.action, entry: g.entry, stop: g.stop, target: g.target }, lessonApplied, lessonIds, verdict, note, score: g.score, scoreBefore: gA.score };
  }

  // ---- 8. error classes --------------------------------------------------------------------------------------------------
  const ERROR_CLASSES = ['premature-entry', 'late-entry', 'incorrect-bias', 'misidentified-structure', 'missed-liquidity', 'false-confirmation', 'poor-stop', 'unrealistic-target', 'overtrading', 'ignored-contradiction', 'failure-to-wait', 'failure-to-recognise-uncertainty', 'none'];
  const MISS_CLASSES = ['correct-rejection', 'missed-valid-opportunity', 'correct-wait', 'premature-entry', 'late-entry', 'false-positive', 'false-negative', 'correct-entry'];
  const wsum = (a) => sum(Array.isArray(a) ? a : [], (i) => (fin(i.weight) ? i.weight : 0));
  // the class and the reasoning behind it; classifyError returns only the class
  function explainError(decision, correction, outcome) {
    const d = decision || {}, k = correction || null, o = outcome || null, dTook = isTake(d.action), R = (cls, why) => ({ cls, why });
    if (k) {
      if (k.verdict === 'approve') return R('none', 'the mentor approved the decision');
      const exp = expectedOf(k, d), reasons = Array.isArray(k.reasons) ? k.reasons : [], has = (r) => reasons.indexOf(r) >= 0, kTook = isTake(exp.action);
      const dir = d.side === 'buy' || d.action === 'BUY' ? 1 : -1;
      if (dTook && kTook && d.action !== exp.action) return R('incorrect-bias', `took ${d.action} where the mentor would ${exp.action}`);
      if (dTook && (k.bias === 'up' || k.bias === 'down') && (k.bias === 'up') !== (d.action === 'BUY')) return R('incorrect-bias', `took ${d.action} against the mentor's ${k.bias} bias`);
      if (dTook && exp.action === 'WAIT') {
        if (has('early')) return R('premature-entry', 'the mentor would wait: the entry came before the setup was complete');
        if (has('late')) return R('late-entry', 'the mentor would not chase: the move had already gone');
        if (has('missing-confirmation')) return R('false-confirmation', 'the trigger was read as confirmation and the mentor says it was not');
        if (has('htf-bias')) return R('incorrect-bias', 'the trade went against the higher-timeframe bias the mentor reads');
        if (has('wrong-structure')) return R('misidentified-structure', 'the structure was read wrongly');
        if (has('liquidity')) return R('missed-liquidity', 'liquidity in the way, or not yet taken, was missed');
        if (has('news') || has('volatility')) return R('failure-to-recognise-uncertainty', 'event or volatility risk was not treated as a reason to stand aside');
        if (has('rr')) return R('unrealistic-target', 'the reward on offer did not justify the risk');
        if (has('session')) return R('overtrading', 'a trade outside the hours the setup belongs to');
        if (wsum(d.contradicting) >= 2 && wsum(d.contradicting) >= 0.6 * wsum(d.supporting)) return R('ignored-contradiction', `the decision listed contradicting evidence (${fmt(wsum(d.contradicting))} against ${fmt(wsum(d.supporting))}) and took the trade anyway`);
        return R('failure-to-wait', 'the mentor would have waited here');
      }
      if (dTook && kTook) {
        const g = gradeWith(d, exp);
        if (has('early')) return R('premature-entry', 'right side, entered too early');
        if (has('late')) return R('late-entry', 'right side, entered too late');
        if (g.stop === false) return R('poor-stop', `the mentor's stop is ${fmt(exp.stop, 5)}, not ${fmt(d.stop, 5)}`);
        if (g.target === false) return R('unrealistic-target', `the mentor's target is ${fmt(exp.target, 5)}, not ${fmt(d.target, 5)}`);
        if (g.entry === false) return dir * (d.entry - exp.entry) > 0 ? R('late-entry', 'the entry paid a worse price than the mentor\'s: chasing') : R('premature-entry', 'the entry came before the price the mentor would wait for');
        return R('none', 'the decision matches the correction');
      }
      if (!dTook && kTook) {
        if (has('htf-bias')) return R('incorrect-bias', 'the bias reading kept the engine out of a trade the mentor would take');
        if (has('wrong-structure')) return R('misidentified-structure', 'the structure was read wrongly and the trade was passed');
        if (has('liquidity')) return R('missed-liquidity', 'the liquidity that made the setup was not recognised');
        if (has('missing-confirmation')) return R('false-confirmation', 'the confirmation that was there was not accepted');
        return R('late-entry', 'the mentor would take it here: waiting means entering late or not at all');
      }
      return R('none', 'no difference in action');
    }
    if (o && dTook && fin(o.netR) && o.netR < 0) {
      if (wsum(d.contradicting) >= 2 && wsum(d.contradicting) >= 0.6 * wsum(d.supporting)) return R('ignored-contradiction', 'the trade lost and the decision had listed heavy contradicting evidence');
      if (fin(o.mfeR) && o.mfeR >= 1) return R('unrealistic-target', `the trade was ${fmt(o.mfeR)} R in profit before it lost: the target asked for too much`);
      return R('none', 'a losing trade taken for documented reasons is not by itself an error');
    }
    return R('none', 'nothing to classify');
  }
  function classifyError(decision, correction, outcome) { return explainError(decision, correction, outcome).cls; }
  // Was the decision a miss? Judged ONLY from what was known at the decision time (the decision's own evidence and
  // uncertainty). The outcome picks between "the candidate won" and "it lost"; it never turns a justified WAIT into an error.
  function classifyMiss(decision, outcome, f) {
    const d = decision || {}, o = outcome || {}, ft = f || {}, sup = wsum(d.supporting), con = wsum(d.contradicting), won = fin(o.netR) && o.netR > 0;
    const unc = Array.isArray(d.uncertainty) ? d.uncertainty : [], blocked = d.risk && d.risk.allowed === false;
    const R = (cls, why, justified) => ({ cls, why, justified: !!justified, hindsight: false });
    if (d.action === 'WAIT') {
      if (!d.candidateId && !fin(d.entry)) return R('correct-wait', 'there was no candidate to take', true);
      const justified = blocked || unc.length > 0 || (con >= 2 && con >= sup);
      const basis = blocked ? 'the risk engine blocked the order' : unc.length ? `documented uncertainty (${unc[0]})` : `documented contradictions (${fmt(con)} against ${fmt(sup)} for)`;
      if (!fin(o.netR)) return R('correct-wait', 'no outcome to judge against; the wait stands on its reasons', justified);
      if (!won) return R('correct-rejection', `the candidate went on to lose ${fmt(o.netR)} R; it was rejected on ${basis}`, true);
      if (justified) return R('correct-wait', `price later ran (${fmt(o.netR)} R), but the WAIT rested on ${basis}. Judged on what was known at the time it is not a mistake: the outcome was not available then.`, true);
      if (sup > con) return R('missed-valid-opportunity', `the evidence at the time favoured the trade (${fmt(sup)} for, ${fmt(con)} against) and it won ${fmt(o.netR)} R: the bar for taking it was too high here`, false);
      return R('false-negative', `the case against was thin (${fmt(con)} against ${fmt(sup)} for, no stated uncertainty) and the candidate won ${fmt(o.netR)} R`, false);
    }
    if (isTake(d.action)) {
      if (!fin(o.netR)) return R('correct-entry', 'no outcome to judge against', true);
      if (won) return fin(o.maeR) && Math.abs(o.maeR) >= 0.8 ? R('premature-entry', `the trade won ${fmt(o.netR)} R but first went ${fmt(Math.abs(o.maeR))} R against the entry: a later entry was available`, false) : R('correct-entry', `taken and won ${fmt(o.netR)} R`, true);
      if (ft.confirm === 'weak' || ft.confirm === 'against') return R('premature-entry', `taken before the trigger bar confirmed (confirmation ${ft.confirm}) and lost ${fmt(o.netR)} R`, false);
      if ((fin(ft.entryOffset) && ft.entryOffset >= 1) || ft.locFor === 'poor') return R('late-entry', `taken after the move had gone (entry ${fmt(ft.entryOffset)} ATR beyond the last close, location ${ft.locFor || 'n/a'}) and lost ${fmt(o.netR)} R`, false);
      return R('false-positive', `the evidence at the time favoured the trade (${fmt(sup)} for, ${fmt(con)} against) and it lost ${fmt(o.netR)} R`, con < sup);
    }
    return R('correct-wait', 'position management is not graded here', true);
  }

  // ---- 9. counterfactuals (EVALUATION ONLY) -----------------------------------------------------------------------------
  // Walks bars that come AFTER the decision. It exists to grade alternatives once a decision is stored; decide() never calls
  // it and never sees its input. Conservative on purpose:
  //   - bars are taken as bid prices; a buy pays the spread on the way in, a sell on the way out (the triggers below use it);
  //   - a resting entry fills at its own price, never better; a stop-type entry that gaps fills at the bar's open (worse);
  //   - when one bar touches both the stop and the target, the stop is taken;
  //   - on the bar that fills a resting order only the stop can be hit (the target and favourable excursion count from the next bar);
  //   - a stop that gaps is filled at the open (worse than the stop);
  //   - costs (price units per round trip): spread + commission + 2 x slippage, charged on every filled trade.
  // alternatives: [{ label, side, entry, stop, target, afterBars, type?: 'market'|'limit'|'stop', expireBars? }]
  // Returns per alternative { label, filled, R, netR, exitT, reason: 'stop'|'target'|'open'|'no-fill'|'no-trade'|'bad-stop', mfeR, maeR, entryT, fill }.
  // exitT / entryT are the OPEN time of the bar where it happened. maeR is zero or negative.
  function simulate(alternatives, futureBars, costs) {
    const c = costs || {}, spread = fin(c.spread) ? c.spread : 0, cost = spread + (fin(c.commission) ? c.commission : 0) + 2 * (fin(c.slippage) ? c.slippage : 0);
    const bars = Array.isArray(futureBars) ? futureBars : [];
    return (Array.isArray(alternatives) ? alternatives : []).map((a) => simOne(a || {}, bars, spread, cost));
  }
  function simOne(a, bars, spread, cost) {
    const out = { label: a.label === undefined ? null : a.label, filled: false, R: 0, netR: 0, exitT: null, reason: 'no-fill', mfeR: 0, maeR: 0, entryT: null, fill: null };
    const dir = a.side === 'buy' ? 1 : a.side === 'sell' ? -1 : 0;
    if (!dir) return Object.assign(out, { reason: 'no-trade' });
    if (!fin(a.stop)) return Object.assign(out, { reason: 'bad-stop' });
    const start = Math.max(0, a.afterBars | 0); if (start >= bars.length) return out;
    const first = bars[start], endFill = fin(a.expireBars) ? Math.min(bars.length, start + a.expireBars) : bars.length;
    let fill = null, iFill = -1, market = false;
    const type = !fin(a.entry) || a.type === 'market' ? 'market' : a.type === 'limit' || a.type === 'stop' ? a.type : dir * (a.entry - first.open) < 0 ? 'limit' : dir * (a.entry - first.open) > 0 ? 'stop' : 'market';
    if (type === 'market') { fill = first.open; iFill = start; market = true; }
    else for (let i = start; i < endFill; i++) {
      const b = bars[i];
      if (type === 'limit') { if (dir > 0 ? b.low <= a.entry - spread : b.high >= a.entry) { fill = a.entry; iFill = i; break; } }
      else if (dir > 0 ? b.high + spread >= a.entry : b.low <= a.entry) { fill = dir > 0 ? Math.max(a.entry, b.open) : Math.min(a.entry, b.open); iFill = i; break; }
    }
    if (fill === null) return out;
    const risk = dir * (fill - a.stop); if (!(risk > 0)) return Object.assign(out, { reason: 'bad-stop' });
    let mfe = 0, mae = 0, R = null, exitT = null, reason = null;
    for (let i = iFill; i < bars.length; i++) {
      const b = bars[i], fb = i === iFill;
      if (dir > 0 ? b.low <= a.stop : b.high + spread >= a.stop) {                       // stop first
        let px = a.stop;
        if (!fb) { if (dir > 0 && b.open < a.stop) px = b.open; if (dir < 0 && b.open + spread > a.stop) px = b.open + spread; }
        R = dir * (px - fill) / risk; reason = 'stop'; exitT = b.time; mae = Math.min(mae, R); break;
      }
      mae = Math.min(mae, (dir > 0 ? b.low - fill : fill - b.high) / risk);
      if (!fb || market) {
        const hit = fin(a.target) && (dir > 0 ? b.high >= a.target : b.low + spread <= a.target);
        mfe = Math.max(mfe, hit ? dir * (a.target - fill) / risk : (dir > 0 ? b.high - fill : fill - b.low) / risk);
        if (hit) { R = dir * (a.target - fill) / risk; reason = 'target'; exitT = b.time; break; }
      }
    }
    if (R === null) { const b = bars[bars.length - 1]; R = dir * (b.close - fill) / risk; reason = 'open'; exitT = b.time; }
    return Object.assign(out, { filled: true, R: rd(R, 4), netR: rd(R - cost / risk, 4), exitT, reason, mfeR: rd(mfe, 4), maeR: rd(mae, 4), entryT: bars[iFill].time, fill: rp(fill) });
  }

  // ---- difficulty of a decision point, from how much the evidence conflicts ------------------------------------------------
  // balance = lighter side / heavier side (0 = one-sided, 1 = evenly split): < 0.2 beginner, < 0.45 intermediate, < 0.75
  // advanced, else expert; one step harder for each of: stated uncertainty, HTF against LTF, an event near, abnormal volatility.
  function difficulty(f, decisionEvidence) {
    const ev = decisionEvidence || {}, ft = f || {}, s = wsum(ev.supporting), c = wsum(ev.contradicting), hi = Math.max(s, c), bal = hi > 0 ? Math.min(s, c) / hi : 0;
    let lvl = bal < 0.2 ? 0 : bal < 0.45 ? 1 : bal < 0.75 ? 2 : 3;
    if (Array.isArray(ev.uncertainty) && ev.uncertainty.length) lvl++;
    if (ft.htfLtfConflict === true) lvl++;
    if (ft.eventNear === true) lvl++;
    if (ft.volAbnormal === true) lvl++;
    return ['beginner', 'intermediate', 'advanced', 'expert'][Math.min(3, lvl)];
  }

  const MXA = {
    VERSION, POLICY_VERSION, TF, LIMITS, SESSIONS,
    assertNoFuture,
    features, FEATURE_DOC, PRICE_KEYS, SIMILAR_KEYS, lite,
    regime, REGIME_DEF,
    decide, EDGE_PROFILE, DEFAULT_PROFILE, GATES,
    thesis,
    lessons, REASON_FEATURES, ADJUST_REFS,
    compare, gradeAgainst,
    classifyError, explainError, classifyMiss, ERROR_CLASSES, MISS_CLASSES,
    simulate,
    score, MODEL_SCHEMA, difficulty,
    hash, stable, fnv1a,
    _internals: { swings, zigzag, structureOf, atrSeries, applyRule, deriveRule, expectedOf },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MXA; else root.MXA = MXA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
