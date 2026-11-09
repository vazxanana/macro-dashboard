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
    if (!t || !t.closest('.bv, .pfv, .jt')) { if (!tipEl.hidden) tipEl.hidden = true; return; } tipEl.innerHTML = t.getAttribute('data-tip'); tipEl.hidden = false; tipAt = performance.now();
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

  // ---- vertical bars (weekdays): rows [{k, v (net R), n, w (wins), net}]; the value is written on every bar with its sign ----
  function cols(el, rows, o = {}) {
    if (!rows || !rows.length) return empty(el, o.empty || 'No trades yet.');
    const w = W(el), h = 200, L = 8, Rr = 8, T = 22, B = 40, m = Math.max(0.1, ...rows.map((r) => Math.abs(r.v))), anyNeg = rows.some((r) => r.v < 0), anyPos = rows.some((r) => r.v > 0);
    const top = anyPos ? m : 0, bot = anyNeg ? -m : 0, sy = (v) => T + (top - v) / ((top - bot) || 1) * (h - T - B - (anyNeg ? 16 : 0)), cw = (w - L - Rr) / rows.length, bw = Math.min(56, cw * 0.62);
    let b = `<line class="bv-zero" x1="${L}" x2="${w - Rr}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}"/>`;
    rows.forEach((r, i) => { const cx = L + cw * i + cw / 2, y0 = sy(0), y1 = sy(r.v), up = r.v >= 0, hh = Math.max(1.5, Math.abs(y1 - y0)), wr = r.n ? Math.round(r.w / r.n * 100) : 0;
      b += `<rect class="bv-bar ${up ? 'up' : 'dn'}" x="${(cx - bw / 2).toFixed(1)}" y="${(up ? y0 - hh : y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" tabindex="0" data-tip="<b>${esc(r.full || r.k)}</b><br>${r.n} trade${r.n === 1 ? '' : 's'} · ${wr}% won<br>${esc(sR(r.v))} · ${esc(money(r.net))}"/>`;
      b += `<text class="bv-val" x="${cx.toFixed(1)}" y="${(up ? y0 - hh - 6 : y0 + hh + 15).toFixed(1)}" text-anchor="middle">${esc(sR(r.v))}</text>`;
      b += `<text class="bv-lab" x="${cx.toFixed(1)}" y="${h - 22}" text-anchor="middle">${esc(r.k)}</text><text class="bv-ax" x="${cx.toFixed(1)}" y="${h - 6}" text-anchor="middle">${r.n} · ${wr}%</text>`; });
    el.innerHTML = svg(w, h, b, o.label || 'Net R by group') + `<div class="bv-leg"><span><i class="sw up"></i>Net R won (+)</span><span><i class="sw dn"></i>Net R lost (−)</span><span>under each bar: trades · % won</span></div>`;
  }

  // ---- Monte Carlo fan: percentiles of the account (% of the start) after each trade, target and floor drawn ----
  function fan(el, f, o = {}) {
    if (!f || !f.steps) return empty(el, 'Run the simulation to see the spread of outcomes.');
    let L0 = f.done.findIndex((d) => d >= 0.95); L0 = L0 < 0 ? f.steps : Math.min(f.steps, Math.max(20, Math.ceil((L0 + 1) * 1.1)));
    const P = [5, 25, 50, 75, 95], S = (p) => f.p[p].slice(0, L0), tg = o.target, fl = o.floor;
    const w = W(el), h = 240, L = 50, Rr = 100, T = 12, B = 26, all = P.flatMap(S).concat([0, tg ?? 0, fl ?? 0]);
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.06 || 1, y0 = lo - pad, y1 = hi + pad;
    const sx = (i) => L + (i + 1) / L0 * (w - L - Rr), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B), pc = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
    const line = (a) => a.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`), band = (a, z) => [`${sx(-1).toFixed(1)},${sy(0).toFixed(1)}`].concat(line(a)).concat(line(z).reverse()).join(' ');
    let b = ticks(y0, y1, 4).map((v) => `<line class="bv-grid" x1="${L}" x2="${w - Rr}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="bv-ax" x="${L - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${esc(pc(v))}</text>`).join('');
    b += `<line class="bv-base" x1="${L}" x2="${w - Rr}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}"/>`;
    b += `<polygon class="bv-fan1" points="${band(S(95), S(5))}"/><polygon class="bv-fan2" points="${band(S(75), S(25))}"/>`;
    b += `<polyline class="bv-fanm" points="${sx(-1).toFixed(1)},${sy(0).toFixed(1)} ${line(S(50)).join(' ')}"/>`;
    if (tg != null) b += `<line class="bv-tgt" x1="${L}" x2="${w - Rr}" y1="${sy(tg).toFixed(1)}" y2="${sy(tg).toFixed(1)}"/><text class="bv-tgtt" x="${L + 4}" y="${(sy(tg) - 5).toFixed(1)}">✓ Target ${esc(pc(tg))}</text>`;
    if (fl != null) b += `<line class="bv-flr" x1="${L}" x2="${w - Rr}" y1="${sy(fl).toFixed(1)}" y2="${sy(fl).toFixed(1)}"/><text class="bv-flrt" x="${L + 4}" y="${(sy(fl) + 15).toFixed(1)}">✕ Max loss ${esc(pc(fl))}${o.trailing ? ' (trailing: can sit higher)' : ''}</text>`;
    // right-hand labels, pushed apart so they never overlap
    const lab = P.map((p) => ({ p, v: f.p[p][L0 - 1], y: sy(f.p[p][L0 - 1]) })).sort((a, z) => a.y - z.y); for (let i = 1; i < lab.length; i++) lab[i].y = Math.max(lab[i].y, lab[i - 1].y + 14);
    const over = lab[lab.length - 1].y - (h - B); if (over > 0) lab.forEach((x) => { x.y -= over; }); for (let i = lab.length - 2; i >= 0; i--) lab[i].y = Math.min(lab[i].y, lab[i + 1].y - 14);
    b += lab.map((x) => `<text class="${x.p === 50 ? 'bv-val' : 'bv-ax'}" x="${(w - Rr + 6).toFixed(1)}" y="${(x.y + 4).toFixed(1)}">${x.p === 50 ? 'median' : x.p + 'th'} ${esc(pc(x.v))}</text>`).join('');
    const st = (w - L - Rr) / L0; b += S(50).map((_, i) => `<rect class="bv-hit" x="${(sx(i) - st / 2).toFixed(1)}" y="${T}" width="${Math.max(2, st).toFixed(1)}" height="${h - T - B}" data-tip="<b>After ${i + 1} trade${i ? 's' : ''}</b><br>95th ${esc(pc(f.p[95][i]))} · 75th ${esc(pc(f.p[75][i]))}<br>median ${esc(pc(f.p[50][i]))}<br>25th ${esc(pc(f.p[25][i]))} · 5th ${esc(pc(f.p[5][i]))}<br>${Math.round(f.done[i] * 100)}% of runs already passed or failed"/>`).join('');
    b += ticks(1, L0, 5).filter((v) => v >= 1 && Number.isInteger(v)).map((v) => `<text class="bv-ax" x="${sx(v - 1).toFixed(1)}" y="${h - 6}" text-anchor="middle">${v}</text>`).join('') + `<text class="bv-ax" x="${(w - Rr + 6).toFixed(1)}" y="${h - 6}">trades</text>`;
    el.innerHTML = svg(w, h, b, `Spread of the simulated accounts over ${L0} trades: median ${pc(f.p[50][L0 - 1])}, 5th percentile ${pc(f.p[5][L0 - 1])}, 95th ${pc(f.p[95][L0 - 1])}`) +
      `<div class="bv-leg"><span><i class="sw fan1"></i>9 runs in 10 (5th–95th)</span><span><i class="sw fan2"></i>Middle half (25th–75th)</span><span><i class="sw fanm"></i>Median run</span><span><i class="sw tgt"></i>Target</span><span><i class="sw flr"></i>Max loss</span></div>`;
  }

  // ---- pass rate by risk per trade (BT.bestRisk curve), the best and the chosen risk marked ----
  function riskCurve(el, curve, o = {}) {
    if (!curve || curve.length < 2) return empty(el, 'Not enough trades to compare risk sizes.');
    const w = W(el), h = 224, L = 44, Rr = 14, T = 52, B = 30, xm = Math.max(3, ...curve.map((c) => c.risk * 100)) * 1.04;
    const sx = (r) => L + r * 100 / xm * (w - L - Rr), sy = (v) => T + (1 - v) * (h - T - B), pc = (v) => Math.round(v * 100) + '%', rk = (r) => (r * 100).toFixed(2) + '%';
    let b = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line class="bv-grid" x1="${L}" x2="${w - Rr}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="bv-ax" x="${L - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${pc(v)}</text>`).join('');
    b += [0.5, 1, 1.5, 2, 2.5, 3].map((r) => `<text class="bv-ax" x="${sx(r / 100).toFixed(1)}" y="${h - 10}" text-anchor="middle">${r}%</text>`).join('');
    b += `<polyline class="bv-rc" points="${curve.map((c) => `${sx(c.risk).toFixed(1)},${sy(c.pass).toFixed(1)}`).join(' ')}"/>`;
    b += curve.map((c) => `<circle class="bv-rcp" cx="${sx(c.risk).toFixed(1)}" cy="${sy(c.pass).toFixed(1)}" r="4" tabindex="0" data-tip="<b>${rk(c.risk)} risk per trade</b><br>passes ${pc(c.pass)} · fails ${pc(c.fail)}${c.unfinished ? ` · unfinished ${pc(c.unfinished)}` : ''}"/>`).join('');
    // markers on the curve; their words sit in two lines above the plot (never on top of each other, whatever the width)
    const same = o.best && o.chosen && Math.abs(o.best.risk - o.chosen.risk) < 1e-9, line = [];
    if (o.best && !same) { b += `<circle class="bv-rcb" cx="${sx(o.best.risk).toFixed(1)}" cy="${sy(o.best.pass).toFixed(1)}" r="8"/>`; line.push(['rcb', `Best: ${rk(o.best.risk)} per trade passes ${pc(o.best.pass)}`]); }
    if (o.chosen) { const x = sx(o.chosen.risk), y = sy(o.chosen.pass); b += (same ? `<circle class="bv-rcb" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/>` : '') + `<path class="bv-rcy" d="M${x.toFixed(1)} ${(y - 7).toFixed(1)}l7 7-7 7-7-7z"/>`; line.unshift(['rcy', `Yours: ${rk(o.chosen.risk)} per trade passes ${pc(o.chosen.pass)}${same ? ' (also the best)' : ''}`]); }
    b += line.map(([k, t], i) => (k === 'rcb' ? `<circle class="bv-rcb" cx="${L + 6}" cy="${12 + i * 18}" r="5"/>` : `<path class="bv-rcy" d="M${L + 6} ${6 + i * 18}l6 6-6 6-6-6z"/>`) + `<text class="bv-val" x="${L + 18}" y="${16 + i * 18}">${esc(t)}</text>`).join('');
    el.innerHTML = svg(w, h, b, `Pass rate by risk per trade${o.best ? `; best ${rk(o.best.risk)} at ${pc(o.best.pass)}` : ''}${o.chosen ? `; yours ${rk(o.chosen.risk)} at ${pc(o.chosen.pass)}` : ''}`) +
      `<div class="bv-leg"><span><i class="sw rc"></i>Pass rate</span><span><i class="sw rcb"></i>Best risk</span><span><i class="sw rcy"></i>Your risk</span><span>risk per trade, % of the start</span></div>`;
  }

  // ---- semicircle gauge (prop-firm buffers): o = {left, of, label, note, breached}; returns HTML; words say the state ----
  function gauge(o) {
    const f = o.of > 0 ? Math.max(0, Math.min(1, o.left / o.of)) : 0, st = o.breached ? ['bad', 'Breached'] : f > 0.5 ? ['ok', 'Plenty of room'] : f > 0.25 ? ['mid', 'Getting close'] : ['bad', 'Nearly out'];
    const r = 54, cx = 70, cy = 66, a = Math.PI * (1 - f), ex = cx + r * Math.cos(a), ey = cy - r * Math.sin(a);
    const arc = f > 0.001 ? `<path class="g-fill ${st[0]}" d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}"/>` : '';
    return `<div class="pfg ${st[0]}" tabindex="0" data-tip="<b>${esc(o.label)}</b><br>${esc(money(o.left))} left of ${esc(money(o.of))} (${Math.round(f * 100)}%)${o.note ? '<br>' + esc(o.note) : ''}"><svg viewBox="0 0 140 78" width="140" height="78" role="img" aria-label="${esc(o.label)}: ${esc(money(o.left))} left of ${esc(money(o.of))}, ${st[1]}">` +
      `<path class="g-bg" d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}"/>${arc}<text class="g-v" x="${cx}" y="${cy - 10}" text-anchor="middle">${Math.round(f * 100)}%</text><text class="g-s" x="${cx}" y="${cy + 9}" text-anchor="middle">left</text></svg>` +
      `<b>${esc(o.label)}</b><span>${esc(money(o.left))} of ${esc(money(o.of))}</span><em>${o.breached ? '✕' : f > 0.5 ? '✓' : '!'} ${st[1]}</em></div>`;
  }

  // ---- journal thumbnail: closes around the trade, entry / stop / target lines, entry and exit dots (SVG string, 96 × 36) ----
  function mini(bars, t, last) {
    if (!bars || !bars.length || !t) return '';
    const bs = (x) => { let lo = 0, hi = bars.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < x) lo = m + 1; else hi = m; } return lo; };
    const i0 = bs(t.openedAt), i1 = Math.max(i0, bs(t.closedAt)), a = Math.max(0, i0 - 6), z = Math.max(i1, Math.min(last == null ? bars.length - 1 : last, bars.length - 1, i1 + 3)), stp = Math.max(1, Math.ceil((z - a + 1) / 60));
    const pts = []; for (let i = a; i <= z; i += stp) pts.push([i, bars[i].close]); if (pts[pts.length - 1][0] !== z) pts.push([z, bars[z].close]);
    const lv = [t.entry, t.stop, t.exit].concat(t.target != null ? [t.target] : []).filter(Number.isFinite), ps = pts.map((p) => p[1]).concat(lv), lo = Math.min(...ps), hi = Math.max(...ps), W0 = 96, H0 = 36, pd = 3;
    const sx = (i) => pd + (i - a) / Math.max(1, z - a) * (W0 - 2 * pd), sy = (v) => pd + (1 - (v - lo) / ((hi - lo) || 1)) * (H0 - 2 * pd), win = t.net > 0;
    const hl = (v, c) => `<line class="${c}" x1="${sx(i0).toFixed(1)}" x2="${Math.max(sx(i1), sx(i0) + 4).toFixed(1)}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/>`;
    return `<svg viewBox="0 0 ${W0} ${H0}" width="${W0}" height="${H0}" aria-hidden="true"><rect class="m-span" x="${sx(i0).toFixed(1)}" y="0" width="${Math.max(3, sx(i1) - sx(i0)).toFixed(1)}" height="${H0}"/>` +
      hl(t.stop, 'm-sl') + (t.target != null ? hl(t.target, 'm-tp') : '') + hl(t.entry, 'm-en') + `<polyline class="m-px" points="${pts.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')}"/>` +
      `<circle class="m-in" cx="${sx(i0).toFixed(1)}" cy="${sy(t.entry).toFixed(1)}" r="2.6"/><circle class="m-out ${win ? 'w' : 'l'}" cx="${sx(i1).toFixed(1)}" cy="${sy(t.exit).toFixed(1)}" r="3"/></svg>`;
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

  window.BTR = { equity, hist, heat, hbars, cols, fan, riskCurve, gauge, mini, reportPNG, sR, money };
})();
