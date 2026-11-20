/* Volume profile on the Desk's charts (18 Nov 2026, owner: "i want volume profile"). When the indicator "Volume Profile" is in
   the list, every chart draws a horizontal volume histogram on its right edge for the candles IN VIEW (pan or zoom and it follows):
   each candle's volume is spread over the rows its range covers and split into buying and selling by where it closed in its range
   (estimated: the feeds give a volume per candle, not the trades at the bid and the ask). The value area (default 70 % of the
   volume around the busiest row) is drawn stronger, the point of control (POC) as a line with its price, VAH / VAL as dashes.
   Display only: no request, nothing stored but the indicator's own settings. */
(function (root) {
  'use strict';
  // the profile of a run of candles: rows from low to high, buy / sell per row, POC index, value area [lo, hi] (row indexes)
  function profile(bars, rows = 60, va = 70) {
    if (!bars || bars.length < 2) return null; rows = Math.max(10, Math.min(200, Math.round(rows) || 60)); va = Math.max(10, Math.min(99, +va || 70));
    let lo = Infinity, hi = -Infinity; for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
    if (!(hi > lo)) return null; const st = (hi - lo) / rows, buy = Array(rows).fill(0), sell = Array(rows).fill(0);
    for (const b of bars) { const w = b.volume > 0 ? b.volume : 1, r = b.high - b.low, f = r > 0 ? (b.close - b.low) / r : 0.5;
      const i0 = Math.max(0, Math.min(rows - 1, Math.floor((b.low - lo) / st))), i1 = Math.max(0, Math.min(rows - 1, Math.floor((b.high - lo) / st))), k = w / (i1 - i0 + 1);
      for (let i = i0; i <= i1; i++) { buy[i] += k * f; sell[i] += k * (1 - f); } }
    const tot = buy.map((v, i) => v + sell[i]); let poc = 0; tot.forEach((v, i) => { if (v > tot[poc]) poc = i; });
    const all = tot.reduce((s, v) => s + v, 0); let a = poc, z = poc, acc = tot[poc];
    while (acc < all * va / 100 && (a > 0 || z < rows - 1)) { const dn = a > 0 ? tot[a - 1] : -1, up = z < rows - 1 ? tot[z + 1] : -1; if (up >= dn) acc += tot[++z]; else acc += tot[--a]; }
    return { lo, hi, st, rows, buy, sell, tot, poc, vaLo: a, vaHi: z, max: tot[poc], pocPx: lo + (poc + 0.5) * st, vah: lo + (z + 1) * st, val: lo + a * st };
  }
  const VP = { profile };
  if (typeof module !== 'undefined' && module.exports) { module.exports = VP; return; }
  root.MS_VPROF = VP;

  const on = () => { const L = root.msInd && root.msInd.list ? root.msInd.list() : []; return L.find((x) => x.type === 'vprof') || null; };
  const rgba = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return `rgba(242,153,0,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const SIG = new WeakMap();
  function canvasOf(cx) { if (cx.vpc && cx.vpc.isConnected) return cx.vpc; const c = document.createElement('canvas'); c.className = 'ms-vp-cv'; c.setAttribute('aria-hidden', 'true'); cx.el.appendChild(c); cx.vpc = c; return c; }
  function paint(cx, force) {
    const set = on(); if (!cx.el || !cx.el.isConnected) return;
    if (!set) { if (cx.vpc) { cx.vpc.remove(); cx.vpc = null; } SIG.delete(cx); return; }
    if (!cx.visible()) return;
    const B = cx.bars(), ts = cx.chart.timeScale(); let lr = null; try { lr = ts.getVisibleLogicalRange(); } catch (e) {}
    if (!B.length || !lr) return; const i0 = Math.max(0, Math.floor(lr.from)), i1 = Math.min(B.length - 1, Math.ceil(lr.to)), last = B[B.length - 1];
    // where the price scale puts two prices is part of the key (20 Nov 2026): a drag of the price axis, or a rescale, moves the
    // candles without changing the candles in view, and the profile stayed where it was drawn until the next price
    let ya = null, yb = null; try { ya = cx.series.priceToCoordinate(last.close); yb = cx.series.priceToCoordinate(last.close * 1.01); } catch (e) {}
    const W = ts.width(), H = cx.el.clientHeight, sig = [i0, i1, last.time, last.close, last.volume, W, H, set.rows, set.va, set.color, document.documentElement.dataset.theme, ya, yb, typeof cx.market === 'function' ? cx.market() : ''].join('|');
    if (!force && SIG.get(cx) === sig) return; SIG.set(cx, sig);
    const c = canvasOf(cx), dpr = devicePixelRatio || 1, w = cx.el.clientWidth;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(H * dpr); c.style.width = w + 'px'; c.style.height = H + 'px'; }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, H);
    const P = profile(B.slice(i0, i1 + 1), set.rows, set.va); if (!P) return;
    const y = (p) => cx.series.priceToCoordinate(p), maxW = Math.min(240, W * 0.28), cs = getComputedStyle(document.documentElement);
    const up = (cs.getPropertyValue('--buy').trim() || '#089981'), dn = (cs.getPropertyValue('--sell').trim() || '#f23645'), col = set.color || '#f29900';
    x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
    for (let i = 0; i < P.rows; i++) { if (!P.tot[i]) continue; const yt = y(P.lo + (i + 1) * P.st), yb = y(P.lo + i * P.st); if (yt == null || yb == null) continue;
      const h = Math.max(1, yb - yt - 1), inVa = i >= P.vaLo && i <= P.vaHi, a = inVa ? 0.42 : 0.18, wb = P.buy[i] / P.max * maxW, ws = P.sell[i] / P.max * maxW;
      x.fillStyle = rgba(up, a); x.fillRect(W - wb, yt, wb, h); x.fillStyle = rgba(dn, a); x.fillRect(W - wb - ws, yt, ws, h);
      if (i === P.poc) { x.strokeStyle = col; x.lineWidth = 1; x.strokeRect(W - wb - ws + 0.5, yt + 0.5, wb + ws - 1, h - 1); } }
    const line = (p, dash, txt) => { const yy = y(p); if (yy == null) return; x.setLineDash(dash); x.strokeStyle = col; x.lineWidth = dash.length ? 1 : 1.5; x.beginPath(); x.moveTo(0, Math.round(yy) + 0.5); x.lineTo(W, Math.round(yy) + 0.5); x.stroke(); x.setLineDash([]);
      x.font = '600 12px Figtree, system-ui, sans-serif'; const tw = x.measureText(txt).width + 10; x.fillStyle = col; x.fillRect(W - maxW - tw - 6, yy - 9, tw, 18); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(txt, W - maxW - tw - 1, yy); };
    const f = (p) => (typeof cx.fmt === 'function' ? cx.fmt(p) : p.toFixed(2));
    line(P.vah, [4, 4], 'VAH ' + f(P.vah)); line(P.val, [4, 4], 'VAL ' + f(P.val)); line(P.pocPx, [], 'POC ' + f(P.pocPx));
    x.restore();
  }
  const list = () => (root.msCharts ? root.msCharts.list : []);
  let raf = 0; const all = (force) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => list().forEach((cx) => { try { paint(cx, force); } catch (e) {} })); };
  function attach(cx) { try { cx.chart.timeScale().subscribeVisibleLogicalRangeChange(() => all()); } catch (e) {} }
  list().forEach(attach); document.addEventListener('ms:chart', (e) => attach(e.detail));
  setInterval(() => all(), 1000); root.addEventListener('resize', () => all(true)); document.addEventListener('fullscreenchange', () => setTimeout(() => all(true), 150));
  root.msVprofRepaint = () => all(true);
  root.msVprofState = () => list().filter((cx) => cx.vpc && cx.visible()).map((cx) => { const B = cx.bars(), lr = cx.chart.timeScale().getVisibleLogicalRange(), s = on(); const P = s && lr ? profile(B.slice(Math.max(0, Math.floor(lr.from)), Math.min(B.length - 1, Math.ceil(lr.to)) + 1), s.rows, s.va) : null; return { id: cx.id, poc: P && P.pocPx, vah: P && P.vah, val: P && P.val }; });
})(typeof window !== 'undefined' ? window : globalThis);
