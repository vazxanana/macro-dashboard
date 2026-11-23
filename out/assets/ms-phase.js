/* Market phase panel on the Desk's Charts (23 Nov 2026; draft, display only). For the page's own market it shows, per
   timeframe (D1, H4, H1, M15), the phase reader's side, stage (move / pullback / continuation / range), where price sits in
   its range and the storyline step on the timeframe below, computed in the browser from the panes' own CLOSED candles.
   The pure part below is a copy of research/edge/_lib/phase.mjs and the edgekit pieces it uses (closedBy, swings, boxesHL,
   qms, structure); tests/ms-phase.test.mjs runs both on the same candles and fails on any difference. Change the two together.
   A READING of structure, not a tested rule: no request, nothing stored, nothing traded, no council member reads it.
   The D1 here is the chart's own daily candle (the research reader is run on 17:00 New York days). */
(function (root) {
  'use strict';

  // ---- edgekit copies ---------------------------------------------------------------------------------------------
  function closedCount(bars, t) { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].e <= t) lo = m + 1; else hi = m; } return lo; }
  const closedBy = (bars, t) => bars.slice(0, closedCount(bars, t));

  function swings(bars, K = 3) {
    const out = [];
    for (let i = K; i + K < bars.length; i++) {
      let hi = true, lo = true;
      for (let j = 1; j <= K && (hi || lo); j++) {
        if (!(bars[i].h > bars[i - j].h && bars[i].h >= bars[i + j].h)) hi = false;
        if (!(bars[i].l < bars[i - j].l && bars[i].l <= bars[i + j].l)) lo = false;
      }
      if (hi) out.push({ i, t: bars[i].t, type: 'H', price: bars[i].h, ci: i + K, ct: bars[i + K].e });
      if (lo) out.push({ i, t: bars[i].t, type: 'L', price: bars[i].l, ci: i + K, ct: bars[i + K].e });
    }
    return out;
  }

  function boxesHL(bars, K = 3) {
    const sw = swings(bars, K).sort((a, b) => a.ci - b.ci || a.i - b.i);
    const out = []; let after = -1, H = null, L = null, k = 0, box = null;
    for (let j = 0; j < bars.length; j++) {
      while (k < sw.length && sw[k].ci <= j) {
        const s = sw[k++];
        if (s.i <= after) continue;
        if (s.type === 'H') H = s; else L = s;
      }
      if (!box && H && L) { box = { hiI: H.i, loI: L.i, hi: H.price, lo: L.price, s: Math.max(H.ci, L.ci), dir: 0, bi: -1, bt: null }; continue; }
      if (box && j > box.s) {
        const c = bars[j].c, dir = c > box.hi ? 1 : c < box.lo ? -1 : 0;
        if (dir) { box.dir = dir; box.bi = j; box.bt = bars[j].e; out.push(box); after = Math.max(box.hiI, box.loI); box = null; H = null; L = null; }
      }
    }
    if (box) out.push(box);
    return out;
  }

  function qms(bars, K = 3) {
    const sw = swings(bars, K).sort((a, b) => a.ci - b.ci || a.i - b.i);
    const out = []; const hs = [], ls = []; let k = 0;
    const armed = { 1: null, '-1': null };
    for (let j = 0; j < bars.length; j++) {
      while (k < sw.length && sw[k].ci < j) {
        const s = sw[k++];
        (s.type === 'H' ? hs : ls).push(s);
        if (s.type === 'H' && hs.length >= 2) {
          const h1 = s, h0 = hs[hs.length - 2]; const l1 = [...ls].reverse().find((x) => x.i < h1.i && x.i > h0.i);
          armed[1] = h1.price < h0.price && l1 ? { level: h1.price, li: h1.i, shoulder: l1.price, head: Infinity, headI: -1, broke: false, from: h1.i } : null;
        }
        if (s.type === 'L' && ls.length >= 2) {
          const l1 = s, l0 = ls[ls.length - 2]; const h1 = [...hs].reverse().find((x) => x.i < l1.i && x.i > l0.i);
          armed[-1] = l1.price > l0.price && h1 ? { level: l1.price, li: l1.i, shoulder: h1.price, head: -Infinity, headI: -1, broke: false, from: l1.i } : null;
        }
      }
      const b = bars[j];
      const A = armed[1];
      if (A && j > A.li) {
        if (A.headI < 0) for (let x = A.from + 1; x < j; x++) if (bars[x].l < A.head) { A.head = bars[x].l; A.headI = x; }
        if (b.l < A.head) { A.head = b.l; A.headI = j; }
        if (A.head < A.shoulder) A.broke = true;
        if (A.broke && b.c > A.level) { out.push({ side: 1, i: j, t: b.e, level: A.level, shoulder: A.shoulder, head: A.head, headI: A.headI, zone: { lo: A.head, hi: A.shoulder } }); armed[1] = null; }
      }
      const S = armed[-1];
      if (S && j > S.li) {
        if (S.headI < 0) for (let x = S.from + 1; x < j; x++) if (bars[x].h > S.head) { S.head = bars[x].h; S.headI = x; }
        if (b.h > S.head) { S.head = b.h; S.headI = j; }
        if (S.head > S.shoulder) S.broke = true;
        if (S.broke && b.c < S.level) { out.push({ side: -1, i: j, t: b.e, level: S.level, shoulder: S.shoulder, head: S.head, headI: S.headI, zone: { lo: S.shoulder, hi: S.head } }); armed[-1] = null; }
      }
    }
    return out;
  }

  function structure(bars, K = 3) {
    const sw = swings(bars, K).sort((a, b) => a.ci - b.ci || a.i - b.i);
    const events = []; const side = new Array(bars.length).fill(0);
    let H = null, L = null, s = 0, k = 0;
    for (let j = 0; j < bars.length; j++) {
      while (k < sw.length && sw[k].ci < j) { const x = sw[k++]; if (x.type === 'H') H = x; else L = x; }
      const c = bars[j].c;
      if (H && c > H.price) { events.push({ i: j, t: bars[j].e, dir: 1, kind: s === 1 ? 'BO' : 'ChoCh', level: H.price, from: H.i }); s = 1; H = null; }
      else if (L && c < L.price) { events.push({ i: j, t: bars[j].e, dir: -1, kind: s === -1 ? 'BO' : 'ChoCh', level: L.price, from: L.i }); s = -1; L = null; }
      side[j] = s;
    }
    return { events, side };
  }

  // ---- phase.mjs copy -----------------------------------------------------------------------------------------------
  const TFS = ['1d', '4h', '1h', '15m'];
  const BELOW = { '1d': '4h', '4h': '1h', '1h': '15m', '15m': '5m' };
  const NAME = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
  const DEF = { K: 3, KI: 1, window: 600 };
  const r = (x) => (x == null || !Number.isFinite(x) ? null : +x.toPrecision(8));
  const clamp01 = (x) => (x == null || !Number.isFinite(x) ? null : Math.max(0, Math.min(1, x)));
  const ev = (e) => (e ? { t: e.t, dir: e.dir, level: r(e.level), kind: e.kind } : null);
  function tail(bars, t, window) { const c = closedBy(bars || [], t); return c.length > window ? c.slice(c.length - window) : c; }

  function readTf(bars, opts = {}) {
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
    const prev2 = events[events.length - 3];
    const twoChoCh = last.kind === 'ChoCh' && prev && prev.kind === 'ChoCh';
    out._range = twoChoCh && !(prev2 && prev2.kind === 'BO' && prev2.dir === d);
    out.failedChoCh = twoChoCh && !out._range;
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
    let back = d > 0 ? hi : lo;
    for (let i = xi + 1; i < n; i++) back = d > 0 ? Math.min(back, bars[i].l) : Math.max(back, bars[i].h);
    out.depth = span > 0 ? clamp01(d > 0 ? (hi - back) / span : (back - lo) / span) : null;
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
    out._inner = structure(bars, KI).events.filter((e) => e.t > last.t);
    return out;
  }

  function stageOf(up, lowerEvents) {
    if (!up._last) return 'range';
    if (up._range) return 'range';
    const d = up.side, after = (lowerEvents || []).filter((e) => e.t > up._last.t);
    let against = -1;
    for (let k = 0; k < after.length; k++) if (after[k].dir === -d) { against = k; break; }
    if (against < 0) return 'move';
    return after.slice(against + 1).some((e) => e.dir === d) ? 'continuation' : 'pullback';
  }

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

  function readPhase(barsByTf, t, opts = {}) {
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

  // The page's chart candles ({ time (shifted by the viewer's time zone TZ), open, high, low, close }) as the reader's candles,
  // closed by `now` only (the forming candle never counts).
  function fromChart(bars, sec, TZ, now) {
    const out = [];
    for (const b of bars || []) {
      const t = b.time - (TZ || 0), e = t + sec;
      if (e > now) break;
      if (![b.open, b.high, b.low, b.close].every(Number.isFinite)) continue;
      out.push({ t, o: b.open, h: b.high, l: b.low, c: b.close, e });
    }
    return out;
  }

  const MS_PHASE = { TFS, BELOW, NAME, closedBy, swings, boxesHL, qms, structure, readTf, readPhase, fromChart };
  if (typeof module !== 'undefined' && module.exports) { module.exports = MS_PHASE; return; }
  root.MS_PHASE = MS_PHASE;

  // ---- the panel (browser only) ----------------------------------------------------------------------------------------
  const doc = root.document;
  if (!doc) return;
  const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 };
  let box = null, sig = '', last = null;
  const guest = () => doc.documentElement.getAttribute('data-role') === 'public';
  const el = (tag, cls, text) => { const x = doc.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
  const STAGE = { move: 'Move', pullback: 'Pullback', continuation: 'Continuation', range: 'Range' };
  const STEP = { none: 'none', BO: 'BO only', VR: 'VR', CF: 'CF' };

  function charts() {
    const L = (root.msCharts && root.msCharts.list) || [];
    const by = {};
    for (const cx of L) if (SEC[cx.id] && !by[cx.id]) by[cx.id] = cx;
    return by;
  }

  function mount() {
    if (box && box.isConnected) return box;
    const view = doc.getElementById('v-charts'); if (!view) return null;
    const anchor = doc.getElementById('ms-pp') || view.querySelector('.ms-grid4'); if (!anchor || !anchor.parentNode) return null;
    box = el('details', 'mph'); box.id = 'ms-phase';
    // closed until a person opens it (review, 23 Nov 2026: opened by default, it grew from one line to the whole table about 10 s
    // after load and pushed the charts down a screen; the summary line already gives the reading)
    const sum = el('summary', 'mph-s');
    sum.appendChild(el('span', 'mph-t', 'Market phase'));
    sum.appendChild(el('span', 'mph-one', 'Reading the charts…'));
    box.appendChild(sum);
    const body = el('div', 'mph-b'); box.appendChild(body);
    anchor.parentNode.insertBefore(box, anchor);
    return box;
  }

  function render(P, cx) {
    const b = mount(); if (!b) return;
    const one = b.querySelector('.mph-one'), body = b.querySelector('.mph-b');
    const fmt = (v) => (v == null ? '—' : cx && cx.fmt ? cx.fmt(v) : String(v));
    body.textContent = '';
    if (!P) { one.textContent = 'Waiting for candles'; body.appendChild(el('p', 'mph-n', 'The panel reads the D1, H4, H1, M15 and M5 charts once their candles are in.')); return; }
    const up = P.tf['1d'].side, ag = P.agree.all;
    one.textContent = ag ? 'All four ' + (up > 0 ? 'up' : 'down') : TFS.map((k) => NAME[k] + ' ' + (P.tf[k].side > 0 ? '▲' : P.tf[k].side < 0 ? '▼' : '–')).join('  ');
    const tbl = el('table', 'mph-tb'); const th = el('thead'); const hr = el('tr');
    ['', 'Side', 'Stage', 'In its range', 'Storyline below'].forEach((h) => { const c = el('th', null, h); c.scope = 'col'; hr.appendChild(c); });
    th.appendChild(hr); tbl.appendChild(th);
    const tb = el('tbody');
    for (const k of TFS) {
      const x = P.tf[k], tr = el('tr');
      const h = el('th', null, NAME[k]); h.scope = 'row'; tr.appendChild(h);
      const side = el('td', 'mph-side ' + (x.side > 0 ? 'up' : x.side < 0 ? 'dn' : ''), (x.side > 0 ? '▲ Up' : x.side < 0 ? '▼ Down' : 'No side'));
      if (x.side && !x.confirmed) side.appendChild(el('small', null, x.failedChoCh ? 'a ChoCh against it failed' : 'ChoCh only'));
      tr.appendChild(side);
      const st = el('td', null, STAGE[x.stage] || x.stage);
      st.appendChild(el('small', null, 'read on ' + x.belowRead));
      tr.appendChild(st);
      const pos = el('td', null, x.pos == null ? '—' : Math.round(x.pos * 100) + '% of the leg');
      if (x.half != null) pos.appendChild(el('small', null, '50% of the ' + (x.rangeUsed === 'internal' ? 'internal' : 'external') + ' range: ' + fmt(x.half)));
      tr.appendChild(pos);
      const s = x.story, sd = el('td', null, s.step === 'none' ? '—' : s.tf + ' ' + (STEP[s.step] || s.step));
      const lv = s.cf ? s.cf.level : s.vr ? s.vr.level : null;
      if (lv != null) sd.appendChild(el('small', null, (s.cf ? 'CF' : 'VR') + ' level ' + fmt(lv)));
      tr.appendChild(sd); tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    const wrap = el('div', 'mph-w'); wrap.appendChild(tbl); body.appendChild(wrap);
    body.appendChild(el('p', 'mph-n', 'Closed candles only. A reading of structure, not a tested rule, and not advice.'));
  }

  function tick() {
    if (guest()) { if (box) box.hidden = true; return; }
    const view = doc.getElementById('v-charts');
    if (!view || view.hidden) return;
    const by = charts(); const cx = by['1h'] || by['15m'];
    if (!cx) return;
    const now = Date.now() / 1000, B = {};
    let s = (cx.market && cx.market()) || '';
    for (const k of Object.keys(SEC)) {
      const c = by[k]; const raw = c ? c.bars() : [];
      B[k] = fromChart(raw, SEC[k], c ? c.TZ : 0, now);
      const z = B[k][B[k].length - 1]; s += '|' + k + ':' + B[k].length + ':' + (z ? z.t + ':' + z.c : '');
    }
    if (s === sig && box && box.isConnected) return;
    sig = s;
    const ready = TFS.every((k) => B[k].length >= 8);
    try { last = ready ? readPhase(B, now) : null; } catch (e) { last = null; }
    render(last, cx);
  }

  root.msPhase = () => (last ? JSON.parse(JSON.stringify(last)) : null);   // read-only view
  // the panes register before this deferred script runs (their 'ms:chart' events are already gone), so read again every 1.5 s
  // until every timeframe has its candles (at most a minute), then every 10 s (review, 23 Nov 2026)
  const start = () => { tick(); let n = 0; const fast = setInterval(() => { if (!doc.hidden) tick(); if (last || ++n >= 40) clearInterval(fast); }, 1500);
    setInterval(() => { if (!doc.hidden) tick(); }, 10e3); doc.addEventListener('ms:chart', () => setTimeout(tick, 1500)); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
