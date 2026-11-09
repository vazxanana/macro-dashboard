// ChronosTrade review charts (journal analytics + session report). Pure drawing: the numbers come from the page
// (BT.trades / BT.stats); nothing here touches the simulation. SVG charts read the page's colour tokens, so they follow
// the light and dark themes; one shared tooltip serves every element with data-tip (mouse, touch and keyboard focus).
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => v == null ? '—' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const sR = (v) => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R';
  const W = (el, min) => Math.max(min || 280, Math.round(el.clientWidth || el.getBoundingClientRect().width || 600));
  const svg = (w, h, body, label) => `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const empty = (el, msg) => { el.innerHTML = `<div class="bv-empty">${esc(msg)}</div>`; };
  const ticks = (lo, hi, n) => { const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || raw; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10)); return out; };

  // ---- shared tooltip ----
  let tipEl = null, tipAt = 0;
  function tip(e) { const t = e.target.closest && e.target.closest('[data-tip]'); if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'bv-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    if (!t || !t.closest('.bv')) { tipEl.hidden = true; return; } tipEl.innerHTML = t.getAttribute('data-tip'); tipEl.hidden = false; tipAt = performance.now();
    let x, y; if (e.type === 'focusin') { const r = t.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; } else { x = e.clientX; y = e.clientY; }
    const r = tipEl.getBoundingClientRect(); tipEl.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x - r.width / 2)) + 'px'; tipEl.style.top = Math.max(6, y - r.height - 12) + 'px'; }
  ['pointermove', 'pointerdown', 'focusin'].forEach((k) => document.addEventListener(k, tip, { passive: true }));
  document.addEventListener('pointerleave', () => { if (tipEl) tipEl.hidden = true; });
  addEventListener('scroll', () => { if (tipEl && performance.now() - tipAt > 250) tipEl.hidden = true; }, { passive: true });

  // ---- equity curve with drawdown shading (area between the running peak and equity) ----
  function equity(el, curve, start) {
    if (!curve || curve.length < 2) return empty(el, 'Close a few trades to see the equity curve.');
    const w = W(el), h = 220, L = 58, R = 10, T = 12, B = 24, n = curve.length; let peak = -Infinity;
    const pts = curve.map((p, i) => { peak = Math.max(peak, p.eq); return { i, eq: p.eq, peak, dd: peak - p.eq, t: p.t }; });
    const lo = Math.min(start, ...pts.map((p) => p.eq)), hi = Math.max(start, ...pts.map((p) => p.peak)), pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1;
    const y0 = lo - pad, y1 = hi + pad, sx = (i) => L + i / (n - 1) * (w - L - R), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
    const tk = ticks(y0, y1, 4); let b = tk.map((v) => `<line class="bv-grid" x1="${L}" x2="${w - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="bv-ax" x="${L - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${esc(money(v))}</text>`).join('');
    b += `<line class="bv-base" x1="${L}" x2="${w - R}" y1="${sy(start).toFixed(1)}" y2="${sy(start).toFixed(1)}"/>`;
    const peakPath = pts.map((p) => `${sx(p.i).toFixed(1)},${sy(p.peak).toFixed(1)}`), eqPath = pts.map((p) => `${sx(p.i).toFixed(1)},${sy(p.eq).toFixed(1)}`);
    b += `<polygon class="bv-dd" points="${peakPath.join(' ')} ${eqPath.slice().reverse().join(' ')}"/>`;
    const up = pts[n - 1].eq >= start; b += `<polyline class="bv-line ${up ? 'up' : 'dn'}" points="${eqPath.join(' ')}"/>`;
    const maxDD = pts.reduce((a, p) => p.dd > a.dd ? p : a, pts[0]); if (maxDD.dd > 0) b += `<circle class="bv-ddpt" cx="${sx(maxDD.i).toFixed(1)}" cy="${sy(maxDD.eq).toFixed(1)}" r="4"/>`;
    const step = (w - L - R) / (n - 1); b += pts.map((p) => `<rect class="bv-hit" x="${(sx(p.i) - step / 2).toFixed(1)}" y="${T}" width="${Math.max(2, step).toFixed(1)}" height="${h - T - B}" data-tip="${esc(p.i ? `<b>After trade ${p.i}</b>` : '<b>Start</b>')}<br>Equity ${esc(money(p.eq))}${p.dd > 0 ? `<br>Drawdown ${esc(money(-p.dd))}` : '<br>At a new high'}"/>`).join('');
    b += `<text class="bv-ax" x="${L}" y="${h - 6}">trade 0</text><text class="bv-ax" x="${w - R}" y="${h - 6}" text-anchor="end">trade ${n - 1}</text>`;
    el.innerHTML = svg(w, h, b, `Equity curve over ${n - 1} trades, from ${money(start)} to ${money(pts[n - 1].eq)}; deepest drawdown ${money(maxDD.dd)}`) +
      `<div class="bv-leg"><span><i class="sw ${up ? 'up' : 'dn'}"></i>Equity (closed trades)</span><span><i class="sw dd"></i>Drawdown from the peak</span><span><i class="sw base"></i>Start balance</span>${maxDD.dd > 0 ? `<span><i class="sw ddpt"></i>Deepest point ${esc(money(-maxDD.dd))}</span>` : ''}</div>`;
  }

  // ---- R distribution: 0.5R bins, losses and wins coloured, the average marked ----
  function hist(el, Rs) {
    if (!Rs || !Rs.length) return empty(el, 'No trades with a stop yet.');
    const w = W(el), h = 190, L = 30, Rr = 8, T = 16, B = 26, bw = 0.5, cap = (v) => Math.max(-3, Math.min(6, v));
    const lo = Math.min(-1, Math.floor(cap(Math.min(...Rs)) / bw) * bw), hi = Math.max(1, Math.ceil(cap(Math.max(...Rs)) / bw + 1e-9) * bw), nb = Math.round((hi - lo) / bw);
    const bins = Array.from({ length: nb }, (_, k) => ({ a: lo + k * bw, n: 0 })); for (const r of Rs) { let k = Math.floor((cap(r) - lo) / bw); if (k >= nb) k = nb - 1; if (k < 0) k = 0; bins[k].n++; }
    const m = Math.max(...bins.map((x) => x.n)), sx = (v) => L + (v - lo) / (hi - lo) * (w - L - Rr), sy = (c) => T + (1 - c / m) * (h - T - B), avg = Rs.reduce((s, x) => s + x, 0) / Rs.length;
    let b = ticks(0, m, 3).map((c) => `<line class="bv-grid" x1="${L}" x2="${w - Rr}" y1="${sy(c).toFixed(1)}" y2="${sy(c).toFixed(1)}"/><text class="bv-ax" x="${L - 5}" y="${(sy(c) + 4).toFixed(1)}" text-anchor="end">${c}</text>`).join('');
    b += bins.map((x) => { const x0 = sx(x.a) + 1, x1 = sx(x.a + bw) - 1, neg = x.a < 0; return `<rect class="bv-bar ${neg ? 'dn' : 'up'}" x="${x0.toFixed(1)}" y="${sy(x.n).toFixed(1)}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${(sy(0) - sy(x.n)).toFixed(1)}" rx="2" tabindex="0" data-tip="<b>${x.a.toFixed(1)}R to ${(x.a + bw).toFixed(1)}R</b>${x.a <= -3 ? ' (and below)' : x.a + bw >= 6 ? ' (and above)' : ''}<br>${x.n} trade${x.n === 1 ? '' : 's'}"/>`; }).join('');
    for (let v = Math.ceil(lo); v <= hi; v++) b += `<text class="bv-ax" x="${sx(v).toFixed(1)}" y="${h - 8}" text-anchor="middle">${v}R</text>`;
    b += `<line class="bv-zero" x1="${sx(0).toFixed(1)}" x2="${sx(0).toFixed(1)}" y1="${T - 6}" y2="${h - B}"/>`;
    const ax = sx(Math.max(lo, Math.min(hi, avg))); b += `<line class="bv-avg" x1="${ax.toFixed(1)}" x2="${ax.toFixed(1)}" y1="${T - 6}" y2="${h - B}"/><text class="bv-avgt" x="${(ax + 4).toFixed(1)}" y="${T - 4}">avg ${esc(sR(avg))}</text>`;
    el.innerHTML = svg(w, h, b, `R distribution of ${Rs.length} trades, average ${sR(avg)}`) + `<div class="bv-leg"><span><i class="sw dn"></i>Losing trades</span><span><i class="sw up"></i>Winning trades</span><span><i class="sw avg"></i>Average R</span></div>`;
  }

  // ---- weekday × hour heatmap of net R (diverging: loss … 0 … win) ----
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function heat(el, trades) {
    if (!trades || !trades.length) return empty(el, 'No trades yet.');
    const g = {}; for (const t of trades) { const d = new Date(t.openedAt * 1000), k = d.getUTCDay() + ':' + d.getUTCHours(); const c = g[k] = g[k] || { n: 0, R: 0, net: 0, w: 0 }; c.n++; c.R += t.R || 0; c.net += t.net; if (t.net > 0) c.w++; }
    const rows = [1, 2, 3, 4, 5].concat([0, 6].filter((d) => trades.some((t) => new Date(t.openedAt * 1000).getUTCDay() === d)));
    const w = W(el), L = 34, T = 4, cw = Math.max(9, (w - L - 4) / 24), ch = Math.min(26, Math.max(16, cw)), h = T + rows.length * ch + 20, m = Math.max(0.5, ...Object.values(g).map((c) => Math.abs(c.R)));
    let b = '';
    rows.forEach((d, ri) => { b += `<text class="bv-ax" x="${L - 6}" y="${(T + ri * ch + ch / 2 + 4).toFixed(1)}" text-anchor="end">${DAYS[d]}</text>`;
      for (let hr = 0; hr < 24; hr++) { const c = g[d + ':' + hr], x = L + hr * cw, y = T + ri * ch;
        if (!c) { b += `<rect class="bv-cell0" x="${(x + 1).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" rx="3"/>`; continue; }
        const a = Math.round(18 + 72 * Math.min(1, Math.abs(c.R) / m)); b += `<rect class="bv-cell" x="${(x + 1).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" rx="3" style="fill:color-mix(in srgb, var(${c.R >= 0 ? '--buy' : '--sell'}) ${a}%, var(--panel-raised))" tabindex="0" data-tip="<b>${DAYS[d]} ${String(hr).padStart(2, '0')}:00 UTC</b><br>${c.n} trade${c.n === 1 ? '' : 's'} · ${Math.round(c.w / c.n * 100)}% won<br>${esc(sR(c.R))} · ${esc(money(c.net))}"/>`; } });
    for (let hr = 0; hr < 24; hr += 3) b += `<text class="bv-ax" x="${(L + hr * cw + cw / 2).toFixed(1)}" y="${h - 4}" text-anchor="middle">${hr}</text>`;
    el.innerHTML = svg(w, h, b, 'Net R by weekday and hour opened (UTC)') + `<div class="bv-leg"><span class="grad"><small>${esc(sR(-m))}</small><i class="gr"></i><small>${esc(sR(m))}</small></span><span><i class="sw c0"></i>No trades</span><span>hour opened, UTC</span></div>`;
  }

  // ---- horizontal diverging bars (setups, rule compliance): rows [{k, v, n, sub}] with v in R ----
  function hbars(el, rows, o = {}) {
    if (!rows || !rows.length) return empty(el, o.empty || 'Nothing to compare yet.');
    const w = W(el), lw = Math.min(150, Math.round(w * 0.36)), vw = 64, rh = 30, h = rows.length * rh + 4, m = Math.max(0.1, ...rows.map((r) => Math.abs(r.v))), anyNeg = rows.some((r) => r.v < 0);
    const x0 = lw + (anyNeg ? (w - lw - vw) / 2 : 6), span = anyNeg ? (w - lw - vw) / 2 - 6 : w - lw - vw - 12;
    const b = rows.map((r, i) => { const y = 2 + i * rh, len = Math.abs(r.v) / m * span, x = r.v >= 0 ? x0 : x0 - len;
      return `<text class="bv-lab" x="${lw - 8}" y="${y + 13}" text-anchor="end">${esc(r.k.length > 20 ? r.k.slice(0, 19) + '…' : r.k)}</text><text class="bv-ax" x="${lw - 8}" y="${y + 25}" text-anchor="end">${esc(r.sub || '')}</text>` +
        `<rect class="bv-bar ${r.v >= 0 ? 'up' : 'dn'}" x="${x.toFixed(1)}" y="${y + 5}" width="${Math.max(1.5, len).toFixed(1)}" height="${rh - 12}" rx="3" tabindex="0" data-tip="<b>${esc(r.k)}</b><br>${esc(r.tip || '')}"/><text class="bv-val" x="${w - 4}" y="${y + 18}" text-anchor="end">${esc(o.fmt ? o.fmt(r.v) : sR(r.v))}</text>`; }).join('') +
      `<line class="bv-zero" x1="${x0}" x2="${x0}" y1="0" y2="${h}"/>`;
    el.innerHTML = svg(w, h, b, o.label || 'Comparison') + (o.legend ? `<div class="bv-leg">${o.legend}</div>` : '');
  }

  // ---- session report as an image (1200 × 675 canvas) ----
  function reportPNG(d) {
    const cs = getComputedStyle(document.documentElement), v = (k, f) => (cs.getPropertyValue(k) || '').trim() || f;
    const C = { bg: v('--panel', '#0f1116'), ink: v('--ink', '#eceef2'), dim: v('--ink-dim', '#a4abb8'), faint: v('--ink-faint', '#8a92a1'), line: v('--line-strong', '#333'), buy: v('--buy', '#2fbf8f'), sell: v('--sell', '#f2576f'), gold: v('--gold', '#e0a526') };
    const c = document.createElement('canvas'), Wd = 1200, Hd = 675; c.width = Wd; c.height = Hd; const x = c.getContext('2d'), F = 'Figtree, -apple-system, Segoe UI, sans-serif', M = '"JetBrains Mono", ui-monospace, monospace';
    x.fillStyle = C.bg; x.fillRect(0, 0, Wd, Hd); x.fillStyle = C.gold; x.fillRect(0, 0, Wd, 6);
    x.fillStyle = C.ink; x.font = `700 34px ${F}`; x.fillText(d.title, 48, 66); x.fillStyle = C.dim; x.font = `500 18px ${F}`; x.fillText(d.sub, 48, 96);
    x.fillStyle = C.faint; x.font = `600 14px ${F}`; x.textAlign = 'right'; x.fillText('ChronosTrade · session report', Wd - 48, 66); x.textAlign = 'left';
    const tone = (t) => t === 'pos' ? C.buy : t === 'neg' ? C.sell : C.ink;
    d.kpis.slice(0, 8).forEach(([k, val, t], i) => { const cx = 48 + (i % 4) * 276, cy = 128 + Math.floor(i / 4) * 92; x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, 260, 78, 10) : x.rect(cx, cy, 260, 78); x.stroke();
      x.fillStyle = C.faint; x.font = `500 14px ${F}`; x.fillText(k, cx + 16, cy + 27); x.fillStyle = tone(t); x.font = `600 26px ${M}`; x.fillText(String(val), cx + 16, cy + 62); });
    // curve
    const cv = d.curve || [], gx = 48, gy = 330, gw = 640, gh = 290; x.fillStyle = C.faint; x.font = `600 14px ${F}`; x.fillText('Equity (closed trades)', gx, gy - 8);
    x.strokeStyle = C.line; x.strokeRect(gx + .5, gy + .5, gw, gh);
    if (cv.length > 1) { const ys = cv.map((p) => p.eq), lo = Math.min(...ys), hi = Math.max(...ys), sx = (i) => gx + 12 + i / (cv.length - 1) * (gw - 24), sy = (q) => gy + gh - 14 - (hi === lo ? 0.5 : (q - lo) / (hi - lo)) * (gh - 28);
      let pk = -Infinity; x.fillStyle = C.sell + '33'; x.beginPath(); cv.forEach((p, i) => { pk = Math.max(pk, p.eq); i ? x.lineTo(sx(i), sy(pk)) : x.moveTo(sx(i), sy(pk)); }); for (let i = cv.length - 1; i >= 0; i--) x.lineTo(sx(i), sy(cv[i].eq)); x.closePath(); x.fill();
      x.strokeStyle = ys[ys.length - 1] >= ys[0] ? C.buy : C.sell; x.lineWidth = 3; x.beginPath(); cv.forEach((p, i) => { i ? x.lineTo(sx(i), sy(p.eq)) : x.moveTo(sx(i), sy(p.eq)); }); x.stroke(); }
    else { x.fillStyle = C.faint; x.font = `500 16px ${F}`; x.fillText('No closed trades yet', gx + 20, gy + gh / 2); }
    // right column: best / worst / mistakes
    let ry = 330; const rx = 724, line = (label, val, col) => { x.fillStyle = C.faint; x.font = `600 13px ${F}`; x.fillText(label.toUpperCase(), rx, ry); ry += 24; x.fillStyle = col || C.ink; x.font = `500 18px ${F}`; for (const s of [].concat(val)) { x.fillText(s.length > 46 ? s.slice(0, 45) + '…' : s, rx, ry); ry += 24; } ry += 10; };
    line('Best trade', d.best || '—', C.buy); line('Worst trade', d.worst || '—', C.sell); line('Mistakes', d.mistakes.length ? d.mistakes.slice(0, 4) : ['None marked'], C.ink);
    x.fillStyle = C.faint; x.font = `500 13px ${F}`; x.fillText(d.foot || '', 48, Hd - 22);
    return c.toDataURL('image/png');
  }

  window.BTR = { equity, hist, heat, hbars, reportPNG, sR, money };
})();
