// research/edge/_lib/phase.mjs - the phase reader: where price is in the market cycle on each timeframe (23 Nov 2026).
// Pure ES module on research/edge/_lib/edgekit.mjs. Research only: nothing live imports it, it places nothing, reads no
// council file and fetches nothing. A READING of structure in this repository's own words, not a tested rule.
//
// readPhase(barsByTf, t, opts) -> {
//   t, tf: { '1d' | '4h' | '1h' | '15m': {
//     side +1 | -1 | 0, confirmed (the last break was a BO, not only a ChoCh), stage 'move' | 'pullback' | 'continuation' | 'range',
//     lastBO, lastChoCh ({ t, dir, level } or null), external { hi, lo }, internal { hi, lo }, pos, posInternal,
//     depth (how far price has come back from the leg's extreme, 0..1 of the external range), rangeUsed 'external' | 'internal',
//     half (the 50% level of the range used), box { hi, lo, state }, story { tf, step 'BO' | 'VR' | 'CF' | 'none', bo, vr, cf },
//     price, n } },
//   agree { all, '1d/4h', '4h/1h', '1h/15m' }, summary (one plain line) }
// barsByTf: { '1d', '4h', '1h', '15m', '5m'? } candles { t, o, h, l, c, e } (e = close time; use edgekit dailyNY for '1d' and
// resample for the rest). Only candles CLOSED by t (e <= t) are read: a later candle, or a change to one, cannot move the
// reading (tests/phase.test.mjs). '5m' is read only as the timeframe under M15 (its storyline and pullback).
//
// Definitions (plain words; the owner's lessons as this repository reads them):
// - Structure: edgekit `structure(bars, K)`: a close beyond the last confirmed swing (K a side) is a break; against the side
//   held before it a ChoCh, with it a BO. A ChoCh is only a hint: `confirmed` is false until a BO follows it.
// - External range = the leg of the last break: for a break up, from the lowest low between the broken swing and the break
//   to the highest high since (a break down mirrors). Internal range = the last swing high and swing low confirmed with one
//   candle (`KI` 1) inside that leg, after its extreme or, with none there yet, the last ones in the leg.
// - 50% rule: when price has come back at least half the external range from its extreme the external range is the one in
//   use, else the internal range ("what matters is having a sufficient range").
// - Stage, read against the timeframe below: 'pullback' = the timeframe below broke AGAINST this side after this timeframe's
//   last break (an H1 ChoCh against H4 = the H4 pullback has started); 'continuation' = after that, the timeframe below broke
//   back WITH this side; 'move' = the timeframe below has not broken against it since; 'range' = no break yet, or the last two
//   breaks were both ChoChs with no BO before them (the side flipped and flipped back). After a BO, a ChoCh against it and a
//   ChoCh back is the old side holding (`failedChoCh` true), read by the rule above. With no timeframe below (M15 without M5) the
//   internal one-candle structure of the same timeframe stands in.
// - Box = edgekit `boxesHL` (a swing low to a swing high, ended by a close outside): state 'inside' (open box), else none.
// - Storyline on the timeframe below: BO = this timeframe's last break; VR = the first QM (BO Structure) against it on the
//   timeframe below after the BO's close; CF = the first QM with it after the VR. Levels and zones as edgekit `qms` gives them.

import { closedBy, structure, swings, boxesHL, qms } from './edgekit.mjs';

export const TFS = ['1d', '4h', '1h', '15m'];
export const BELOW = { '1d': '4h', '4h': '1h', '1h': '15m', '15m': '5m' };
export const NAME = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
const DEF = { K: 3, KI: 1, window: 600 };

const r = (x) => (x == null || !Number.isFinite(x) ? null : +x.toPrecision(8));
const clamp01 = (x) => (x == null || !Number.isFinite(x) ? null : Math.max(0, Math.min(1, x)));
const ev = (e) => (e ? { t: e.t, dir: e.dir, level: r(e.level), kind: e.kind } : null);

// The last `window` candles closed by t (a fixed-length tail keeps the work small; it only ever drops OLDER candles).
function tail(bars, t, window) { const c = closedBy(bars || [], t); return c.length > window ? c.slice(c.length - window) : c; }

// One timeframe's own reading (no timeframe below yet).
export function readTf(bars, opts = {}) {
  const { K, KI } = { ...DEF, ...opts };
  const n = bars.length;
  const out = { side: 0, confirmed: false, stage: 'range', lastBO: null, lastChoCh: null, external: null, internal: null,
    pos: null, posInternal: null, depth: null, rangeUsed: null, half: null, box: { hi: null, lo: null, state: 'none' },
    price: n ? r(bars[n - 1].c) : null, failedChoCh: false, n, _last: null };
  if (n < 2 * K + 2) return out;
  const { events } = structure(bars, K);
  const last = events[events.length - 1] || null;
  out._last = last;
  out.lastBO = ev([...events].reverse().find((e) => e.kind === 'BO'));
  out.lastChoCh = ev([...events].reverse().find((e) => e.kind === 'ChoCh'));
  const bx = boxesHL(bars, K); const b = bx[bx.length - 1];
  if (b && b.dir === 0) out.box = { hi: r(b.hi), lo: r(b.lo), state: 'inside' };
  else if (b) out.box = { hi: r(b.hi), lo: r(b.lo), state: b.dir > 0 ? 'broke-up' : 'broke-down' };
  if (!last) return out;
  const d = last.dir; out.side = d; out.confirmed = last.kind === 'BO';
  const prev = events[events.length - 2];
  // range: two ChoChs in a row with no BO among the last three breaks. Two ChoChs after a BO (a ChoCh against the trend that
  // failed, then a ChoCh back the trend's way) is not a range: the old side held (`failedChoCh`), still not confirmed by a new BO.
  const prev2 = events[events.length - 3];
  const twoChoCh = last.kind === 'ChoCh' && prev && prev.kind === 'ChoCh';
  out._range = twoChoCh && !(prev2 && prev2.kind === 'BO' && prev2.dir === d);
  out.failedChoCh = twoChoCh && !out._range;
  // external range of the break's leg
  let hi = -Infinity, lo = Infinity, xi = last.i;
  if (d > 0) {
    for (let i = last.from; i <= last.i; i++) lo = Math.min(lo, bars[i].l);
    for (let i = last.from; i < n; i++) if (bars[i].h >= hi) { hi = bars[i].h; xi = i; }
  } else {
    for (let i = last.from; i <= last.i; i++) hi = Math.max(hi, bars[i].h);
    for (let i = last.from; i < n; i++) if (bars[i].l <= lo) { lo = bars[i].l; xi = i; }
  }
  out.external = { hi: r(hi), lo: r(lo) };
  const px = bars[n - 1].c, span = hi - lo;
  out.pos = span > 0 ? clamp01((px - lo) / span) : null;
  // how far price came back from the extreme (closes and wicks after the extreme)
  let back = d > 0 ? hi : lo;
  for (let i = xi + 1; i < n; i++) back = d > 0 ? Math.min(back, bars[i].l) : Math.max(back, bars[i].h);
  out.depth = span > 0 ? clamp01(d > 0 ? (hi - back) / span : (back - lo) / span) : null;
  // internal range: one-candle swings inside the leg
  const sw = swings(bars, KI).filter((s) => s.ci < n && s.i >= last.from);
  const after = sw.filter((s) => s.i > xi);
  const pick = (arr, type) => { for (let k = arr.length - 1; k >= 0; k--) if (arr[k].type === type) return arr[k]; return null; };
  let iH = pick(after, 'H'), iL = pick(after, 'L');
  if (!iH || !iL) { iH = iH || pick(sw, 'H'); iL = iL || pick(sw, 'L'); }
  if (d > 0 && xi > (iH ? iH.i : -1)) iH = { price: hi };
  if (d < 0 && xi > (iL ? iL.i : -1)) iL = { price: lo };
  if (iH && iL && iH.price > iL.price) {
    out.internal = { hi: r(iH.price), lo: r(iL.price) };
    out.posInternal = clamp01((px - iL.price) / (iH.price - iL.price));
  }
  out.rangeUsed = out.depth != null && out.depth >= 0.5 ? 'external' : out.internal ? 'internal' : 'external';
  const R = out.rangeUsed === 'internal' ? out.internal : out.external;
  out.half = r((R.hi + R.lo) / 2);
  // internal one-candle structure of the same timeframe (stand-in for a missing timeframe below)
  out._inner = structure(bars, KI).events.filter((e) => e.t > last.t);
  return out;
}

// Stage of `up` given the breaks of the timeframe below after up's last break.
function stageOf(up, lowerEvents) {
  if (!up._last) return 'range';
  if (up._range) return 'range';
  const d = up.side, after = (lowerEvents || []).filter((e) => e.t > up._last.t);
  let against = -1;
  for (let k = 0; k < after.length; k++) if (after[k].dir === -d) { against = k; break; }
  if (against < 0) return 'move';
  return after.slice(against + 1).some((e) => e.dir === d) ? 'continuation' : 'pullback';
}

// Storyline on the timeframe below: BO = up's last break, VR = first QM against it after the BO, CF = first QM with it after the VR.
function storyOf(up, lower, tfBelow, K) {
  const s = { tf: tfBelow, step: 'none', bo: null, vr: null, cf: null };
  if (!up._last) return s;
  s.step = 'BO'; s.bo = ev(up._last);
  if (!lower || lower.length < 2 * K + 2) return s;
  const d = up.side, list = qms(lower, K).filter((q) => q.t > up._last.t);
  const vr = list.find((q) => q.side === -d);
  if (!vr) return s;
  const z = (q) => ({ t: q.t, level: r(q.level), head: r(q.head), zone: { lo: r(q.zone.lo), hi: r(q.zone.hi) } });
  s.step = 'VR'; s.vr = z(vr);
  const cf = list.find((q) => q.side === d && q.t > vr.t);
  if (cf) { s.step = 'CF'; s.cf = z(cf); }
  return s;
}

const word = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'no side');
const pct = (x) => (x == null ? '?' : Math.round(x * 100) + '%');

export function readPhase(barsByTf, t, opts = {}) {
  const o = { ...DEF, ...opts };
  const C = {};
  for (const k of [...TFS, '5m']) C[k] = tail(barsByTf[k], t, o.window);
  const own = {};
  for (const k of [...TFS, '5m']) own[k] = readTf(C[k], o);
  const tf = {};
  for (const k of TFS) {
    const below = BELOW[k], u = own[k];
    const lowerEv = C[below].length ? structure(C[below], o.K).events : null;
    const stage = stageOf(u, lowerEv || u._inner);
    const story = storyOf(u, C[below].length ? C[below] : null, NAME[below], o.K);
    const { _last, _range, _inner, ...pub } = u;
    tf[k] = { ...pub, stage, story, belowRead: lowerEv ? NAME[below] : 'own one-candle structure' };
  }
  const sides = TFS.map((k) => tf[k].side);
  const agree = {
    all: sides.every((s) => s !== 0 && s === sides[0]),
    '1d/4h': sides[0] !== 0 && sides[0] === sides[1],
    '4h/1h': sides[1] !== 0 && sides[1] === sides[2],
    '1h/15m': sides[2] !== 0 && sides[2] === sides[3],
  };
  const parts = TFS.map((k) => {
    const x = tf[k];
    return NAME[k] + ' ' + word(x.side) + (x.side && !x.confirmed ? (x.failedChoCh ? ' (a ChoCh against it failed)' : ' (ChoCh only)') : '') + ', ' + x.stage + ', at ' + pct(x.pos) +
      ' of its range' + (x.story.step !== 'none' && x.story.step !== 'BO' ? ', ' + x.story.tf + ' ' + x.story.step : '');
  });
  const summary = parts.join('; ') + (agree.all ? '. All four agree.' : '.');
  return { t, tf, agree, summary };
}
