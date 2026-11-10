// MeridianX Academy replay layer (MXR). Contract: docs/academy/ARCHITECTURE.md, sections 5 (data shapes) and 6 (API).
// One dependency-free file for the browser (<script> sets window.MXR) and for Node (require / createRequire in tests).
//
// What it does: loads candles from /md/bars in chunks, tells which bars are CLOSED at a simulated time t, builds
// higher-timeframe bars from lower ones on UTC boundaries, builds the Snapshot a decision is allowed to see, hashes it,
// runs the replay clock and serialises a replay position. It places no orders and knows nothing about outcomes.
//
// The one rule everything here serves: NO LOOK-AHEAD. A bar is { time, open, high, low, close } with time = the bar's
// OPEN in UTC seconds, so a bar is closed at t only when time + tfSec <= t. The bar still forming at t never enters a
// snapshot; formingAt() returns it for DISPLAY only, flagged forming: true, and guard() throws when it finds one.
(function (root) {
  'use strict';

  const VERSION = '1.0.0';
  const TF = Object.freeze({ '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 });
  const SPEEDS = Object.freeze([1, 5, 10, 50, 100]);
  const KEEP = 300;                                   // bars kept per timeframe in a snapshot unless the caller says otherwise
  const SNAP_TFS = Object.freeze(['5m', '15m', '1h', '4h', '1d']);   // always present in Snapshot.bars (empty when not supplied)
  const CHUNK_BARS = 4999;                            // /md/bars keeps the END of a window longer than 4,999 bar widths (5,000 candles)
  const MAX_CONCURRENCY = 3;
  const CACHE_MAX = 64;                               // chunks kept in memory (least recently used goes first)
  const LIVE_TTL_MS = 30000;                          // a chunk that still touches "now" is only reused for this long

  function fail(code, msg, extra) { const e = new Error(msg); e.name = 'MXRError'; e.code = code; if (extra) Object.assign(e, extra); return e; }
  // a timeframe as seconds: accepts a key of MXR.TF ('1h') or a positive whole number of seconds
  function secOf(tf) {
    if (typeof tf === 'string' && Object.prototype.hasOwnProperty.call(TF, tf)) return TF[tf];
    if (typeof tf === 'number' && Number.isInteger(tf) && tf > 0) return tf;
    throw fail('BAD_TF', 'unknown timeframe: ' + String(tf) + ' (use one of ' + Object.keys(TF).join(', ') + ' or seconds)');
  }
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? +v : NaN);
  const partial = (b) => b.forming === true || b.live === true;   // a bar that is not final (display bar, or the feed's open candle)
  const pick = (b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close });

  // A well-formed Bar with exactly the contract's five fields, or null: whole positive time, finite positive prices,
  // high and low really the extremes.
  function cleanBar(b) {
    if (!isObj(b)) return null;
    const time = num(b.time), open = num(b.open), high = num(b.high), low = num(b.low), close = num(b.close);
    if (!Number.isInteger(time) || time <= 0) return null;
    if (!(Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close))) return null;
    if (!(low > 0) || high < low || high < Math.max(open, close) || low > Math.min(open, close)) return null;
    return { time, open, high, low, close };
  }

  // ---- closed bars ------------------------------------------------------------------------------------------------
  // bars must be sorted by time, oldest first (load() returns them that way).
  // How many bars are closed at t: the count of bars with time + tfSec <= t (binary search).
  function closedCount(bars, tf, t) {
    const lim = t - secOf(tf); let lo = 0, hi = bars.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (bars[m].time <= lim) lo = m + 1; else hi = m; }
    while (lo > 0 && partial(bars[lo - 1])) lo--;     // a display bar left at the end of an array is never "closed"
    return lo;
  }
  // The bars closed at or before t (a new array; the bar forming at t is never in it).
  function closedAt(bars, tf, t) {
    if (!Array.isArray(bars)) throw fail('BAD_BARS', 'closedAt needs an array of bars');
    if (!Number.isFinite(t)) throw fail('BAD_TIME', 'closedAt needs a finite time t (UTC seconds)');
    return bars.slice(0, closedCount(bars, tf, t));
  }
  const firstAtOrAfter = (bars, time) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (bars[m].time < time) lo = m + 1; else hi = m; } return lo; };

  // ---- higher timeframes from lower ones --------------------------------------------------------------------------
  // Buckets start at whole multiples of toTf since the epoch, which is 00:00 UTC for 4h (00, 04, 08 …) and 1d: the same
  // alignment api/bars.js asks the feed for (dailyAlignment 0, UTC). A bucket exists when at least one lower bar is in it
  // (so a weekend leaves a gap, and the short Sunday session is its own daily bar, as on the feed).
  // Only COMPLETE buckets are returned:
  //   with t      → lower bars closed at t only, and a bucket only when its end (time + toTf) <= t;
  //   without t   → the last bucket only when the lower bars reach its end. Pass t whenever you have it: before a
  //                 weekend or a daily break the lower bars stop early and only t can say the bucket is over.
  function aggregate(bars, fromTf, toTf, t) {
    if (!Array.isArray(bars)) throw fail('BAD_BARS', 'aggregate needs an array of bars');
    const a = secOf(fromTf), b = secOf(toTf);
    if (b < a || b % a !== 0) throw fail('BAD_TF', 'cannot build ' + b + 's bars from ' + a + 's bars');
    const hasT = t != null;
    if (hasT && !Number.isFinite(t)) throw fail('BAD_TIME', 'aggregate needs a finite time t (UTC seconds)');
    const n = hasT ? closedCount(bars, a, t) : bars.length, out = [];
    let cur = null, reach = 0;
    for (let i = 0; i < n; i++) {
      const x = bars[i]; if (partial(x)) continue;
      const s = Math.floor(x.time / b) * b;
      if (!cur || cur.time !== s) { cur = { time: s, open: x.open, high: x.high, low: x.low, close: x.close }; out.push(cur); }
      else { if (x.high > cur.high) cur.high = x.high; if (x.low < cur.low) cur.low = x.low; cur.close = x.close; }
      reach = x.time + a;
    }
    if (cur) { const end = cur.time + b; if (hasT ? end > t : reach < end) out.pop(); }
    return out;
  }
  // The smallest spacing between neighbouring bars around index i: the lower timeframe when the caller did not give it.
  function spacing(bars, i) {
    let best = 0;
    for (let k = Math.max(1, i - 64); k < Math.min(bars.length, i + 64); k++) { const d = bars[k].time - bars[k - 1].time; if (d > 0 && (!best || d < best)) best = d; }
    if (!best) throw fail('BAD_TF', 'cannot tell the lower timeframe from the bars: pass lowerTf');
    return best;
  }
  // DISPLAY ONLY: the bar of timeframe tf that is still forming at t, built from the lower bars already closed at t.
  // Returns { time, open, high, low, close, forming: true } or null (nothing of that bar has closed yet, e.g. t is
  // exactly on its open). Never put it in a series you hand to snapshot(); guard() throws on a forming bar.
  function formingAt(lowerBars, tf, t, lowerTf) {
    if (!Array.isArray(lowerBars)) throw fail('BAD_BARS', 'formingAt needs an array of bars');
    if (!Number.isFinite(t)) throw fail('BAD_TIME', 'formingAt needs a finite time t (UTC seconds)');
    const b = secOf(tf), s = Math.floor(t / b) * b, i0 = firstAtOrAfter(lowerBars, s);
    if (i0 >= lowerBars.length) return null;
    const a = lowerTf != null ? secOf(lowerTf) : spacing(lowerBars, i0);
    const n = closedCount(lowerBars, a, t); let f = null;
    for (let i = i0; i < n; i++) {
      const x = lowerBars[i]; if (partial(x)) continue;
      if (!f) f = { time: s, open: x.open, high: x.high, low: x.low, close: x.close, forming: true };
      else { if (x.high > f.high) f.high = x.high; if (x.low < f.low) f.low = x.low; f.close = x.close; }
    }
    return f;
  }

  // Holes in a series: [{ from, to, missing, kind }] where from = the first missing bar's open, to = the next bar present.
  // kind is a display hint, not a verdict: 'weekend' (the hole covers a Saturday), 'break' (up to four hours starting
  // 20:00 to 23:59 UTC: the daily maintenance break of gold and index CFDs), else 'gap' (holiday or missing data).
  // Data-quality grading is academy/quality.mjs's job.
  function gaps(bars, tf) {
    const sec = secOf(tf), out = [];
    for (let i = 1; i < bars.length; i++) {
      const from = bars[i - 1].time + sec, to = bars[i].time; if (to <= from) continue;
      const d0 = Math.floor(from / 86400), d1 = Math.floor((to - 1) / 86400);
      let weekend = d1 - d0 >= 6; for (let d = d0; d <= d1 && !weekend; d++) if ((d + 4) % 7 === 6) weekend = true;   // 1 Jan 1970 was a Thursday
      const hour = Math.floor((from % 86400) / 3600);
      out.push({ from, to, missing: Math.round((to - from) / sec), kind: weekend ? 'weekend' : (to - from <= 4 * 3600 && hour >= 20 ? 'break' : 'gap') });
    }
    return out;
  }

  // ---- candle loading ---------------------------------------------------------------------------------------------
  const _cache = new Map();   // key base|sym|tf|chunk → { p: Promise<{ bars, src, inst, dropped }>, complete, at }
  const cache = { clear() { _cache.clear(); }, size() { return _cache.size; } };

  async function fetchChunk(f, url, signal, retries) {
    let last = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      let r;
      try { r = await f(url, signal ? { signal } : undefined); }
      catch (e) {
        if (signal && signal.aborted) throw fail('ABORTED', 'candle loading was cancelled');
        last = fail('NETWORK', 'could not reach the candle service: ' + String((e && e.message) || e)); continue;
      }
      if (!r || !r.ok) {
        const status = r ? r.status : 0; let detail = '';
        try { const j = await r.json(); if (j && j.error) detail = String(j.error).slice(0, 160); } catch (_) { /* no JSON body */ }
        const tail = detail ? ' (' + detail + ')' : '';
        if (status === 503) throw fail('NO_SOURCE', 'no candle data source is configured on the server: /md/bars answered 503' + tail + '. Replay candles are unavailable until the market-data token is set.', { status });
        if (status === 400) throw fail('BAD_REQUEST', 'the candle service refused the request: 400' + tail, { status });
        if (status === 401 || status === 403) throw fail('FORBIDDEN', 'the candle service refused access: ' + status + tail, { status });
        last = fail('UPSTREAM', 'the candle service failed: ' + status + tail, { status }); continue;   // 502 / 504: the feed behind the proxy; worth one more try
      }
      let j;
      try { j = await r.json(); } catch (_) { last = fail('BAD_RESPONSE', 'the candle service did not answer with JSON'); continue; }
      if (!j || !Array.isArray(j.bars)) throw fail('BAD_RESPONSE', 'the candle service answered without a bars list');
      return j;
    }
    throw last;
  }

  // MXR.load({ sym, tf, from, to, fetch, base, now, concurrency, cache, retries, signal, onProgress })
  //   sym, tf      /md/bars names ('xau', '5m'); from, to = UTC seconds. Returns the bars that OPEN in [from, to).
  //   fetch        injected in tests; defaults to the global fetch. base = URL prefix ('' → same origin).
  //   now          () => milliseconds (default Date.now): nothing after now exists, and a bar still open at now is dropped.
  // The server answers at most 5,000 candles a call and keeps the END of the window, so the range is walked from `from`
  // forward in fixed chunks of 4,999 bar widths. Chunks sit on a grid (chunk k = [k·span, (k+1)·span]) so the same URL,
  // and the same cache entry, serves every range that touches it. At most 3 calls run at once.
  // Resolves to the Bar[] (oldest first, de-duplicated by time, malformed bars dropped) which ALSO carries, as
  // non-enumerable properties, { bars (itself), src, inst, sym, tf, gaps, dropped, calls, chunks }: both
  // `const bars = await MXR.load(…)` and `const { bars, src, gaps } = await MXR.load(…)` work.
  async function load(o) {
    o = o || {};
    const sym = String(o.sym == null ? '' : o.sym), tf = String(o.tf == null ? '' : o.tf);
    if (!sym) throw fail('BAD_REQUEST', 'load needs a market (sym)');
    if (!Object.prototype.hasOwnProperty.call(TF, tf)) throw fail('BAD_TF', 'unknown timeframe: ' + tf + ' (use one of ' + Object.keys(TF).join(', ') + ')');
    const sec = TF[tf], nowMs = typeof o.now === 'function' ? +o.now() : Date.now(), nowSec = Math.floor(nowMs / 1000);
    const from = Math.floor(num(o.from)), toAsk = o.to == null ? nowSec : Math.ceil(num(o.to));
    if (!(from > 0) || !(toAsk > from)) throw fail('BAD_RANGE', 'load needs from > 0 and to > from (UTC seconds)');
    const f = typeof o.fetch === 'function' ? o.fetch : (typeof root.fetch === 'function' ? (u, i) => root.fetch(u, i) : null);
    if (!f) throw fail('NO_FETCH', 'no fetch available: pass one to load');
    const base = String(o.base || '').replace(/\/+$/, ''), useCache = o.cache !== false;
    const limit = Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(o.concurrency) || MAX_CONCURRENCY));
    const retries = o.retries == null ? 1 : Math.max(0, Math.min(3, Math.floor(o.retries) || 0));
    const to = Math.min(toAsk, nowSec), span = CHUNK_BARS * sec, ks = [];
    if (to > from) for (let k = Math.floor(from / span); k * span < to; k++) ks.push(k);   // a window wholly after now: no call
    let calls = 0;

    function chunk(k) {
      const key = [base, sym, tf, k].join('|'), cFrom = Math.max(1, k * span), cTo = (k + 1) * span;
      if (useCache) {
        const hit = _cache.get(key);
        if (hit && (hit.complete || nowMs - hit.at < LIVE_TTL_MS)) { _cache.delete(key); _cache.set(key, hit); return hit.p; }
      }
      calls++;
      const url = base + '/md/bars?sym=' + encodeURIComponent(sym) + '&tf=' + encodeURIComponent(tf) + '&from=' + cFrom + '&to=' + cTo;
      const p = fetchChunk(f, url, o.signal, retries).then((j) => {
        const bars = []; let dropped = 0;
        for (const raw of j.bars) { if (raw && raw.live === true) continue; const b = cleanBar(raw); if (b) bars.push(b); else dropped++; }
        return { bars, dropped, src: j.src == null ? null : String(j.src), inst: j.inst == null ? null : String(j.inst) };
      });
      if (useCache) {
        _cache.set(key, { p, complete: cTo <= nowSec - 2 * sec, at: nowMs });
        p.catch(() => { const cur = _cache.get(key); if (cur && cur.p === p) _cache.delete(key); });   // a failure is never remembered
        while (_cache.size > CACHE_MAX) _cache.delete(_cache.keys().next().value);
      }
      return p;
    }

    const parts = new Array(ks.length); let next = 0, done = 0, failed = null;
    const worker = async () => {
      while (!failed && next < ks.length) {
        const i = next++;
        try { parts[i] = await chunk(ks[i]); done++; if (typeof o.onProgress === 'function') o.onProgress(done, ks.length); }
        catch (e) { failed = failed || e; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, ks.length) }, worker));
    if (failed) throw failed;

    const byTime = new Map(), srcs = []; let dropped = 0, inst = null;
    for (const part of parts) {
      dropped += part.dropped; if (part.src && !srcs.includes(part.src)) srcs.push(part.src); if (part.inst) inst = part.inst;
      for (const b of part.bars) if (b.time >= from && b.time < to && b.time + sec <= nowSec) byTime.set(b.time, b);
    }
    const bars = Array.from(byTime.values()).sort((x, y) => x.time - y.time).map(pick);
    const meta = { bars, src: srcs.length ? srcs.join(' + ') : null, inst, sym, tf, gaps: gaps(bars, sec), dropped, calls, chunks: ks.length };
    for (const k of Object.keys(meta)) Object.defineProperty(bars, k, { value: meta[k], enumerable: false, writable: true, configurable: true });
    return bars;
  }

  // ---- snapshot, guard, hash --------------------------------------------------------------------------------------
  const OUTCOME_KEYS = ['R', 'netR', 'exitT', 'exit', 'mfeR', 'maeR', 'outcome'];   // never on a Candidate (contract, section 5)
  const tfOrder = (keys) => keys.slice().sort((x, y) => secOf(x) - secOf(y));

  // MXR.snapshot({ edge, market, t, cand, series, inter, events, dataVersion, keep })
  //   series  { tf: Bar[] } FULL arrays, oldest first; the builder keeps only bars closed at t (time + tfSec <= t) and
  //           at most the last `keep` of them per timeframe (a number, or { tf: number }; default MXR.KEEP = 300).
  //   inter   { name: { tf: Bar[] } }, optional (e.g. the dollar index), sliced the same way.
  //   events  [{ t, title, impact }], optional; events later than t are dropped.
  //   cand    the Candidate that fired at t, or null between signals. A candidate from the future, or one carrying
  //           outcome fields, is refused.
  // Returns the contract's Snapshot (v: 1). Snapshot.bars always has '5m', '15m', '1h', '4h', '1d' (empty when not
  // supplied) plus any other MXR.TF key given in series ('1m'). The result has already passed guard().
  function snapshot(o) {
    o = o || {};
    const t = o.t;
    if (!Number.isFinite(t)) throw fail('BAD_TIME', 'snapshot needs a finite decision time t (UTC seconds)');
    const keepOf = (tf) => {
      const k = typeof o.keep === 'number' ? o.keep : (isObj(o.keep) && o.keep[tf] != null ? o.keep[tf] : KEEP);
      if (!Number.isInteger(k) || k < 1) throw fail('BAD_KEEP', 'keep must be a whole number of bars, at least 1');
      return k;
    };
    const cut = (arr, tf) => {
      if (!Array.isArray(arr)) throw fail('BAD_BARS', 'series ' + tf + ' must be an array of bars');
      const n = closedCount(arr, tf, t), out = [];
      for (let i = Math.max(0, n - keepOf(tf)); i < n; i++) if (!partial(arr[i])) out.push(pick(arr[i]));
      return out;
    };
    const series = isObj(o.series) ? o.series : {}, bars = {};
    const keys = Object.keys(series); keys.forEach(secOf);   // an unknown timeframe key throws here
    for (const tf of Object.keys(TF)) if (SNAP_TFS.includes(tf) || keys.includes(tf)) bars[tf] = keys.includes(tf) ? cut(series[tf], tf) : [];
    const snap = { v: 1, edge: o.edge == null ? null : o.edge, market: o.market == null ? null : o.market, t, cand: o.cand == null ? null : JSON.parse(JSON.stringify(o.cand)), bars };
    if (o.inter != null) {
      if (!isObj(o.inter)) throw fail('BAD_BARS', 'inter must be { name: { tf: Bar[] } }');
      snap.inter = {};
      for (const name of Object.keys(o.inter).sort()) {
        const s = o.inter[name]; if (!isObj(s)) throw fail('BAD_BARS', 'inter.' + name + ' must be { tf: Bar[] }');
        snap.inter[name] = {}; for (const tf of tfOrder(Object.keys(s))) snap.inter[name][tf] = cut(s[tf], tf);
      }
    }
    if (o.events != null) {
      if (!Array.isArray(o.events)) throw fail('BAD_EVENTS', 'events must be an array');
      snap.events = o.events.filter((e) => isObj(e) && Number.isFinite(e.t) && e.t <= t)
        .map((e) => ({ t: e.t, title: e.title == null ? '' : String(e.title), impact: e.impact == null ? null : e.impact }))
        .sort((x, y) => x.t - y.t || (x.title < y.title ? -1 : x.title > y.title ? 1 : 0));
    }
    snap.dataVersion = o.dataVersion == null ? null : o.dataVersion;
    return guard(snap);
  }

  // MXR.guard(snapshot): throws when the snapshot could show the future. The page calls it before every decision.
  //   code 'LOOKAHEAD'    a bar in bars or inter that ends after snapshot.t, a bar flagged forming / live, an event
  //                       later than t, a candidate that fired after t or that carries outcome fields
  //   code 'BAD_SNAPSHOT' not a v: 1 snapshot, an unknown timeframe key, bars out of order or repeated
  // Returns the snapshot, so a caller can write decide(MXR.guard(snapshot)).
  function guard(snap) {
    if (!isObj(snap) || snap.v !== 1 || !Number.isFinite(snap.t) || !isObj(snap.bars)) throw fail('BAD_SNAPSHOT', 'not a v: 1 snapshot (needs t and bars)');
    const t = snap.t;
    const check = (arr, tf, where) => {
      let sec; try { sec = secOf(tf); } catch (_) { throw fail('BAD_SNAPSHOT', where + ': unknown timeframe key'); }
      if (!Array.isArray(arr)) throw fail('BAD_SNAPSHOT', where + ': not an array of bars');
      let prev = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i];
        if (!isObj(b) || !Number.isFinite(b.time)) throw fail('BAD_SNAPSHOT', where + '[' + i + ']: not a bar');
        if (partial(b)) throw fail('LOOKAHEAD', where + '[' + i + ']: a forming bar (time ' + b.time + ') is in the snapshot', { series: where, time: b.time });
        if (b.time + sec > t) throw fail('LOOKAHEAD', where + '[' + i + ']: the bar opened at ' + b.time + ' closes at ' + (b.time + sec) + ', after the decision time ' + t, { series: where, time: b.time });
        if (b.time <= prev) throw fail('BAD_SNAPSHOT', where + '[' + i + ']: bars out of order or repeated at ' + b.time);
        prev = b.time;
      }
    };
    for (const tf of Object.keys(snap.bars)) check(snap.bars[tf], tf, 'bars.' + tf);
    if (snap.inter != null) {
      if (!isObj(snap.inter)) throw fail('BAD_SNAPSHOT', 'inter must be { name: { tf: Bar[] } }');
      for (const name of Object.keys(snap.inter)) {
        if (!isObj(snap.inter[name])) throw fail('BAD_SNAPSHOT', 'inter.' + name + ' must be { tf: Bar[] }');
        for (const tf of Object.keys(snap.inter[name])) check(snap.inter[name][tf], tf, 'inter.' + name + '.' + tf);
      }
    }
    if (snap.events != null) {
      if (!Array.isArray(snap.events)) throw fail('BAD_SNAPSHOT', 'events must be an array');
      snap.events.forEach((e, i) => {
        if (!isObj(e) || !Number.isFinite(e.t)) throw fail('BAD_SNAPSHOT', 'events[' + i + ']: no time');
        if (e.t > t) throw fail('LOOKAHEAD', 'events[' + i + ']: the event at ' + e.t + ' is after the decision time ' + t, { series: 'events', time: e.t });
      });
    }
    if (snap.cand != null) {
      if (!isObj(snap.cand)) throw fail('BAD_SNAPSHOT', 'cand must be a Candidate or null');
      if (!Number.isFinite(snap.cand.t)) throw fail('BAD_SNAPSHOT', 'cand has no time t');
      if (snap.cand.t > t) throw fail('LOOKAHEAD', 'the candidate fired at ' + snap.cand.t + ', after the decision time ' + t, { series: 'cand', time: snap.cand.t });
      const leak = OUTCOME_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(snap.cand, k));
      if (leak.length) throw fail('LOOKAHEAD', 'the candidate carries outcome fields: ' + leak.join(', '), { series: 'cand' });
    }
    return snap;
  }

  // Canonical JSON: object keys sorted, undefined and functions left out, numbers that are not finite written as null.
  function canonical(v) {
    if (v === null || v === undefined) return 'null';
    const ty = typeof v;
    if (ty === 'number') return Number.isFinite(v) ? JSON.stringify(v === 0 ? 0 : v) : 'null';
    if (ty === 'boolean') return v ? 'true' : 'false';
    if (ty === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (ty === 'object') {
      const parts = [];
      for (const k of Object.keys(v).sort()) { const x = v[k]; if (x === undefined || typeof x === 'function' || typeof x === 'symbol') continue; parts.push(JSON.stringify(k) + ':' + canonical(x)); }
      return '{' + parts.join(',') + '}';
    }
    return 'null';
  }
  // FNV-1a, 32 bits, over the UTF-8 bytes of a string → unsigned integer. seed defaults to the standard offset basis.
  function fnv1a(str, seed) {
    let h = seed == null ? 0x811c9dc5 : seed >>> 0;
    const eat = (byte) => { h = Math.imul(h ^ byte, 0x01000193) >>> 0; };
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c < 0x80) eat(c);
      else if (c < 0x800) { eat(0xc0 | (c >> 6)); eat(0x80 | (c & 63)); }
      else if (c < 0x10000) { eat(0xe0 | (c >> 12)); eat(0x80 | ((c >> 6) & 63)); eat(0x80 | (c & 63)); }
      else { eat(0xf0 | (c >> 18)); eat(0x80 | ((c >> 12) & 63)); eat(0x80 | ((c >> 6) & 63)); eat(0x80 | (c & 63)); }
    }
    return h >>> 0;
  }
  const hex8 = (n) => ('00000000' + (n >>> 0).toString(16)).slice(-8);
  // MXR.hash(snapshot) → 16 hex characters: two FNV-1a passes (standard basis, then a second basis) over the canonical
  // JSON. The same decision point always gives the same hash; any change to a bar, an event or the candidate changes it.
  function hash(snap) { const s = canonical(snap); return hex8(fnv1a(s)) + hex8(fnv1a(s, 0xcbf29ce4)); }

  // ---- replay clock -----------------------------------------------------------------------------------------------
  // MXR.clock({ from, to, stepSec, speed, onTick, onBatch, onDone, now, setTimer, clearTimer, baseMs, minFrameMs, t })
  //   from, to     simulated UTC seconds; the clock starts at from (or at t, when resuming) and never passes to.
  //   stepSec      one candle (seconds or an MXR.TF key). Every step lands on the next whole multiple of stepSec, so
  //                the simulated time sits on a candle boundary: the bar that just closed is time = t - stepSec.
  //                Only the last step can be shorter, when to itself is not on a boundary.
  //   speed        1, 5, 10, 50 or 100 candles per baseMs (default 1,000 ms) of real time.
  //   onTick(t, info)       once per candle step; info = { kind: 'play'|'step'|'jump'|'restart', i, n } (step i of a
  //                         batch of n). Pausing or jumping from inside onTick stops the rest of the batch at once.
  //   onBatch(t, n, kind)   once after every change of t (n = candle steps taken, 0 for a jump or restart): draw here.
  //   onDone(t)             once when the clock reaches to.
  //   now, setTimer, clearTimer   injected in tests: now() → ms, setTimer(fn, ms) → handle, clearTimer(handle).
  // One timer runs while playing, whatever the speed. It fires every baseMs / speed (never faster than minFrameMs,
  // default 50 ms) and advances as many candles as the real time since the last fire is worth: at 100x that is a batch
  // of 5 candles every 50 ms, not 100 timers. A long stall (a background tab) is not caught up in one jump.
  // Returns { play, pause, resume, step(n), jump(t), setSpeed(x), restart, state() }; each returns state():
  // { t, from, to, stepSec, speed, playing, done, steps }.
  function clock(o) {
    o = o || {};
    const from = num(o.from), to = num(o.to), stepSec = secOf(o.stepSec);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) throw fail('BAD_RANGE', 'clock needs from and to (UTC seconds) with to >= from');
    const speedOk = (x) => { if (!SPEEDS.includes(x)) throw fail('BAD_SPEED', 'speed must be one of ' + SPEEDS.join(', ')); return x; };
    const cb = (fn) => (typeof fn === 'function' ? fn : null);
    const onTick = cb(o.onTick), onBatch = cb(o.onBatch), onDone = cb(o.onDone);
    const now = cb(o.now) || (() => Date.now());
    const setT = cb(o.setTimer) || ((fn, ms) => setTimeout(fn, ms));
    const clearT = cb(o.clearTimer) || (cb(o.setTimer) ? null : (h) => clearTimeout(h));
    const baseMs = o.baseMs > 0 ? +o.baseMs : 1000, minFrameMs = o.minFrameMs > 0 ? +o.minFrameMs : 50;
    const clamp = (x) => Math.min(to, Math.max(from, x));
    const start = o.t == null ? from : clamp(num(o.t));
    if (!Number.isFinite(start)) throw fail('BAD_TIME', 'clock needs a finite start time t');
    let t = start, speed = speedOk(o.speed == null ? 1 : o.speed), playing = false, steps = 0;
    let gen = 0, handle = null, last = 0, accMs = 0, doneSaid = false;

    const state = () => ({ t, from, to, stepSec, speed, playing, done: t >= to, steps });
    const period = () => Math.min(baseMs, Math.max(minFrameMs, baseMs / speed));
    function disarm() { gen++; if (handle != null && clearT) clearT(handle); handle = null; }
    function schedule() { disarm(); const g = gen; handle = setT(() => { if (g === gen && playing) fire(g); }, period()); }
    function begin() { last = now(); accMs = 0; schedule(); }
    function halt() { playing = false; disarm(); }
    function one(info) {   // one candle forward; false at the end
      if (t >= to) return false;
      const next = (Math.floor(t / stepSec) + 1) * stepSec;
      t = next > to ? to : next; steps++;
      if (onTick) onTick(t, info);
      return true;
    }
    function settle(n, kind) {   // after any change of t
      if (onBatch) onBatch(t, n, kind);
      if (t < to) { doneSaid = false; return; }
      halt();
      if (!doneSaid) { doneSaid = true; if (onDone) onDone(t); }
    }
    function fire(g) {
      handle = null;
      const at = now(); let el = at - last; last = at;
      if (!(el > 0)) el = 0;
      el = Math.min(el, Math.max(period() * 4, 250));   // a stalled tab does not leap forward
      accMs += el * speed;
      const n = Math.floor(accMs / baseMs); accMs -= n * baseMs;
      let did = 0;
      try { for (let i = 0; i < n && playing && g === gen; i++) { if (!one({ kind: 'play', i: i + 1, n })) break; did++; } }
      catch (e) { halt(); throw e; }
      const mine = g === gen;   // false when onTick paused, jumped or changed the speed: that call already settled things
      if (did || t >= to) settle(did, 'play');
      if (mine && g === gen && playing) schedule();
    }

    function play() { if (!playing && t < to) { playing = true; begin(); } return state(); }
    function pause() { halt(); return state(); }
    function step(n) {
      const k = n == null ? 1 : Math.floor(n);
      if (!(k >= 1)) throw fail('BAD_STEP', 'step needs a count of at least 1 (use jump to go back)');
      halt(); let did = 0;
      for (let i = 0; i < k; i++) { if (!one({ kind: 'step', i: i + 1, n: k })) break; did++; }
      settle(did, 'step'); return state();
    }
    function jump(x) {
      const v = num(x); if (!Number.isFinite(v)) throw fail('BAD_TIME', 'jump needs a finite time (UTC seconds)');
      const was = playing; disarm(); t = clamp(v);
      if (onTick) onTick(t, { kind: 'jump', i: 0, n: 0 });
      settle(0, 'jump');
      if (was && playing) begin();
      return state();
    }
    function setSpeed(x) { speed = speedOk(x); if (playing) begin(); return state(); }
    function restart() {   // back to from (the start of the replay window, even after resuming at a later t), paused
      halt(); t = from; steps = 0; doneSaid = false;
      if (onTick) onTick(t, { kind: 'restart', i: 0, n: 0 });
      settle(0, 'restart'); return state();
    }
    return { play, pause, resume: play, step, jump, setSpeed, restart, state };
  }

  // ---- replay position (session) ----------------------------------------------------------------------------------
  // MXR.session.save(state) → a plain JSON-safe object for the API to store; MXR.session.restore(json) → the same object
  // back from that object or its JSON text. Both validate and throw on a position that cannot be replayed.
  //   { v: 1, kind: 'mxr-session', id, edge, market, tf, t, from, to, speed, balance, risk, costs, difficulty, mode,
  //     openDecisions: [ids], savedAt }
  // save() accepts `open` as another name for openDecisions. savedAt and id are the caller's (nothing here reads a clock).
  const SESSION_KIND = 'mxr-session';
  const plain = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));
  function sessionSave(s) {
    if (!isObj(s)) throw fail('BAD_SESSION', 'session.save needs the replay state');
    const need = (k) => { if (typeof s[k] !== 'string' || !s[k]) throw fail('BAD_SESSION', 'session: ' + k + ' is required'); return s[k]; };
    const edge = need('edge'), market = need('market'), tf = need('tf');
    if (!Object.prototype.hasOwnProperty.call(TF, tf)) throw fail('BAD_SESSION', 'session: unknown timeframe ' + tf);
    const t = num(s.t), from = num(s.from), to = num(s.to);
    if (!(Number.isFinite(t) && Number.isFinite(from) && Number.isFinite(to)) || !(from <= t && t <= to)) throw fail('BAD_SESSION', 'session: needs from <= t <= to (UTC seconds)');
    const speed = s.speed == null ? 1 : s.speed;
    if (!SPEEDS.includes(speed)) throw fail('BAD_SESSION', 'session: speed must be one of ' + SPEEDS.join(', '));
    const ids = s.openDecisions != null ? s.openDecisions : (s.open != null ? s.open : []);
    if (!Array.isArray(ids)) throw fail('BAD_SESSION', 'session: openDecisions must be a list of ids');
    const open = []; for (const id of ids) { const k = String(id); if (id != null && k && !open.includes(k)) open.push(k); }
    const balance = s.balance == null ? null : num(s.balance);
    if (balance !== null && !Number.isFinite(balance)) throw fail('BAD_SESSION', 'session: balance must be a number');
    return { v: 1, kind: SESSION_KIND, id: s.id == null ? null : String(s.id), edge, market, tf, t, from, to, speed, balance,
      risk: plain(s.risk), costs: plain(s.costs), difficulty: s.difficulty == null ? null : String(s.difficulty),
      mode: s.mode == null ? 'train' : String(s.mode), openDecisions: open, savedAt: typeof s.savedAt === 'number' || typeof s.savedAt === 'string' ? s.savedAt : null };
  }
  function sessionRestore(json) {
    let o = json;
    if (typeof json === 'string') { try { o = JSON.parse(json); } catch (_) { throw fail('BAD_SESSION', 'session.restore: not JSON'); } }
    if (!isObj(o) || o.v !== 1 || o.kind !== SESSION_KIND) throw fail('BAD_SESSION', 'session.restore: not a saved replay position (v: 1)');
    return sessionSave(o);
  }
  const session = { save: sessionSave, restore: sessionRestore };

  const MXR = { VERSION, TF, SPEEDS, KEEP, CHUNK_BARS, load, cache, cleanBar, gaps, closedAt, closedCount, aggregate, formingAt, snapshot, guard, hash, fnv1a, canonical, clock, session };
  if (typeof module !== 'undefined' && module.exports) module.exports = MXR; else root.MXR = MXR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
