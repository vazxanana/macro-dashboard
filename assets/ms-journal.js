// The owner's decision journal (23 Nov 2026; design: research/proposals/2026-11-20-discretion.md). Pure pieces, no imports, no
// network, shared by the server (api/_journal.js re-exports this file) and the Desk page (loaded with defer: window.MS_JOURNAL).
// One copy of the rules: the page and the server judge a call the same way.
//   check(body, nowS)     a call as sent by the page -> { call } or { error }; the SERVER stamps `at`, never the page.
//   outcome(call, bars)   the call's result on candles that START at or after `at` only. The entry must be REACHED first (a
//                         candle whose range holds it; until then 'pending', never scored): an entry already left behind at the
//                         stamp cannot book a result from prices seen before it (review, 23 Nov 2026). On the fill candle only
//                         the stop counts; after it, stop first when one candle holds both, then the target, else open (marked
//                         at the last close). R before costs. A 'skip' is scored the same way (the counterfactual).
//   joinBars(fine, coarse, fineSec)  5-minute candles, then hourly ones only from the end of the last 5-minute candle, so a call
//                         keeps the result its first 14 days gave when it grows older (the hourly read alone could change it).
//   stats(rows)           taken vs skipped (resolved calls only: stop or target): n, mean R, Welch t; by method and by
//                         confidence; "too few to judge" under MIN_SIDE (20) a side.
// A record of choices, not an order: nothing here places, sizes, blocks or copies a trade.
(function (root) {
  const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nas100', 'xag'];
  const TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
  const MIN_SIDE = 20, DELETE_S = 120, METHOD_N = 40, REASON_N = 300, NOTE_N = 500;
  const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const px = (v) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) && n > 0 && n < 1e7 ? +n.toFixed(6) : null; };

  function check(b, nowS) {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'bad request' };
    const market = String(b.market || '').toLowerCase(); if (!MARKETS.includes(market)) return { error: 'unknown market' };
    const side = b.side === 'buy' || b.side === 'sell' ? b.side : null; if (!side) return { error: 'choose buy or sell' };
    const action = b.action === 'take' || b.action === 'skip' ? b.action : null; if (!action) return { error: 'choose take or skip' };
    const entry = px(b.entry), stop = px(b.stop);
    if (entry == null) return { error: 'the entry price is missing' };
    if (stop == null) return { error: 'every call needs a stop: the stop price is missing' };
    if (side === 'buy' ? stop >= entry : stop <= entry) return { error: side === 'buy' ? 'a buy needs its stop below the entry' : 'a sell needs its stop above the entry' };
    let target = null;
    if (b.target != null && b.target !== '') { target = px(b.target); if (target == null) return { error: 'the target is not a price' };
      if (side === 'buy' ? target <= entry : target >= entry) return { error: side === 'buy' ? 'a buy needs its target above the entry' : 'a sell needs its target below the entry' }; }
    const conf = Math.round(Number(b.confidence)); if (!(conf >= 1 && conf <= 5)) return { error: 'confidence is 1 to 5' };
    const tf = TFS.includes(b.tf) ? b.tf : null;
    let source = null;
    if (b.source && typeof b.source === 'object' && !Array.isArray(b.source)) { const desk = clean(b.source.desk, 20), id = clean(b.source.id, 80); if (desk || id) source = { desk, id }; }
    const r0 = Math.abs(entry - stop);
    return { call: { market, side, action, entry, stop, target, planRR: target != null ? +(Math.abs(target - entry) / r0).toFixed(2) : null,
      tf, method: clean(b.method, METHOD_N), reason: clean(b.reason, REASON_N), confidence: conf, source, at: Math.floor(nowS), note: '' } };
  }

  // bars: [{ time (start, unix s), open, high, low, close, live? }]. A candle that started before `at` is never read (it may hold
  // prices from before the decision); a forming candle (`live`) is not read either.
  function outcome(c, bars) {
    const s = c.side === 'sell' ? -1 : 1, r0 = Math.abs(c.entry - c.stop);
    if (!(r0 > 0)) return { status: 'invalid', R: null };
    const B = (Array.isArray(bars) ? bars : []).filter((b) => b && !b.live && Number.isFinite(b.time) && b.time >= c.at).sort((a, b) => a.time - b.time);
    const f = B.findIndex((b) => b.low <= c.entry && b.high >= c.entry);   // the entry reached from the stamp on
    if (f < 0) return { status: 'pending', R: null, endT: null, best: 0, n: B.length };
    let best = 0;
    for (let i = f; i < B.length; i++) {
      const b = B[i], hitStop = s > 0 ? b.low <= c.stop : b.high >= c.stop, hitT = i > f && c.target != null && (s > 0 ? b.high >= c.target : b.low <= c.target);
      if (hitStop) { const gap = i > f && (s > 0 ? b.open < c.stop : b.open > c.stop), fill = gap ? b.open : c.stop;   // a gap through the stop fills at the open (not on the fill candle: its open came first)
        return { status: 'stop', R: +((s * (fill - c.entry)) / r0).toFixed(3), fillT: B[f].time, endT: b.time, best: +best.toFixed(3), n: B.length }; }
      if (hitT) return { status: 'target', R: +((s * (c.target - c.entry)) / r0).toFixed(3), fillT: B[f].time, endT: b.time, best: +Math.max(best, (s * (c.target - c.entry)) / r0).toFixed(3), n: B.length };
      if (i > f) best = Math.max(best, (s * ((s > 0 ? b.high : b.low) - c.entry)) / r0);
    }
    const last = B[B.length - 1];
    return { status: 'open', R: +((s * (last.close - c.entry)) / r0).toFixed(3), fillT: B[f].time, endT: null, best: +best.toFixed(3), n: B.length };
  }
  function joinBars(fine, coarse, fineSec = 300) {
    const F = (Array.isArray(fine) ? fine : []).filter((b) => b && Number.isFinite(b.time)).sort((a, b) => a.time - b.time);
    if (!F.length) return [];   // never the coarse candles alone: they could give another result
    const end = F[F.length - 1].time + fineSec;
    return F.concat((Array.isArray(coarse) ? coarse : []).filter((b) => b && Number.isFinite(b.time) && b.time >= end).sort((a, b) => a.time - b.time));
  }

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1)); };
  function welch(a, b) {
    if (a.length < 2 || b.length < 2) return null; const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
    if (!(va + vb > 0)) return null; return (mean(a) - mean(b)) / Math.sqrt(va + vb);
  }
  const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3));
  function side(rows) { const R = rows.map((x) => x.R); return { n: R.length, meanR: r3(mean(R)), totalR: r3(R.reduce((x, y) => x + y, 0)) }; }
  function compare(rows) {
    const T = rows.filter((x) => x.action === 'take'), K = rows.filter((x) => x.action === 'skip');
    const out = { taken: side(T), skipped: side(K), diff: T.length && K.length ? r3(mean(T.map((x) => x.R)) - mean(K.map((x) => x.R))) : null,
      t: r3(welch(T.map((x) => x.R), K.map((x) => x.R))), judged: T.length >= MIN_SIDE && K.length >= MIN_SIDE };
    out.verdict = !out.judged ? `too few to judge (${T.length} taken, ${K.length} skipped; ${MIN_SIDE} a side needed)`
      : out.t != null && Math.abs(out.t) >= 2 ? (out.diff > 0 ? 'taken beat skipped (t at least 2): a record of choices, not a tested edge' : 'skipped beat taken (t at least 2)')
      : 'no clear difference yet (t under 2)';
    return out;
  }
  // rows: [{ action, method, confidence, R, status }] with the outcome joined; only resolved calls (stop / target) count
  function stats(rows) {
    const done = (Array.isArray(rows) ? rows : []).filter((x) => x && !x.withdrawn && (x.status === 'stop' || x.status === 'target') && Number.isFinite(x.R));
    const group = (key) => { const m = {}; done.forEach((x) => { const k = String(x[key] == null || x[key] === '' ? '(none)' : x[key]); (m[k] = m[k] || []).push(x); });
      return Object.keys(m).sort().map((k) => ({ key: k, ...compare(m[k]) })); };
    return { all: compare(done), byMethod: group('method'), byConfidence: group('confidence'), resolved: done.length,
      open: (rows || []).filter((x) => x && !x.withdrawn && x.status === 'open').length, pending: (rows || []).filter((x) => x && !x.withdrawn && x.status === 'pending').length,
      withdrawn: (rows || []).filter((x) => x && x.withdrawn).length, note: 'R before costs. A skip is scored as if it had been taken. Not a tested edge.' };
  }

  const api = { MARKETS, TFS, MIN_SIDE, DELETE_S, NOTE_N, check, outcome, joinBars, stats, welch, clean };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MS_JOURNAL = api;
})(typeof window !== 'undefined' ? window : globalThis);
