// The Mosha desk (owner, 10 Nov 2026: "And a place to mosha"): the owner's own Mosha trades, logged with their stop and measured.
// Pure pieces (statistics, the check of a trade on our candles) sit on MS_MOSHA and are tested in tests/mosha-desk.test.mjs;
// the rest draws the desk in market-structure.html (#v-mosha) from /api/mosha. A log only: nothing here places or changes a trade.
(function (root) {
  'use strict';
  var MIN_JUDGE = 20;   // under this many closed trades the desk says "too few to judge"
  var HOW = { cf: 'At the CF', zone: 'Zone of the break', retest: 'Retest of the level', other: 'Other' };
  var MKT = { xau: 'XAU/USD', xag: 'XAG/USD', eurusd: 'EUR/USD', gbpusd: 'GBP/USD', nas100: 'NAS100' };

  function rOf(t) { var s = t.side === 'sell' ? -1 : 1, r0 = Math.abs(t.entry - t.stop); return r0 > 0 && t.exit != null ? +((s * (t.exit - t.entry)) / r0).toFixed(3) : null; }
  function sessionOf(ts) { var h = new Date(ts * 1000).getUTCHours(); return h >= 21 || h < 7 ? 'asia' : h < 12 ? 'london' : 'new york'; }
  // n, winners, R a trade, total, t and the deepest drawdown of a list of R results in time order
  function stats(rs) {
    var n = rs.length; if (!n) return { n: 0, win: null, avg: null, total: 0, t: null, maxDD: 0 };
    var sum = 0, wins = 0, cum = 0, peak = 0, dd = 0, i;
    for (i = 0; i < n; i++) { sum += rs[i]; if (rs[i] > 0) wins++; cum += rs[i]; if (cum > peak) peak = cum; if (peak - cum > dd) dd = peak - cum; }
    var m = sum / n, v = 0; for (i = 0; i < n; i++) v += (rs[i] - m) * (rs[i] - m);
    var sd = n > 1 ? Math.sqrt(v / (n - 1)) : 0;
    return { n: n, win: +(wins / n).toFixed(3), avg: +m.toFixed(3), total: +sum.toFixed(2), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, maxDD: +dd.toFixed(2) };
  }
  // what a record of n trades may be called: never an edge without n and t
  function verdict(s) {
    if (!s.n) return { key: 'none', text: 'No closed trade yet' };
    if (s.n < MIN_JUDGE) return { key: 'few', text: 'Too few to judge: ' + s.n + ' of ' + MIN_JUDGE + ' closed trades' };
    if (s.avg > 0 && s.t != null && s.t >= 2) return { key: 'pos', text: 'Positive so far (t ' + s.t.toFixed(2) + ' over ' + s.n + ' trades)' };
    if (s.avg > 0) return { key: 'luck', text: 'Positive, but not yet apart from luck (t ' + (s.t == null ? 'n/a' : s.t.toFixed(2)) + ' over ' + s.n + ' trades)' };
    return { key: 'neg', text: 'Negative so far (t ' + (s.t == null ? 'n/a' : s.t.toFixed(2)) + ' over ' + s.n + ' trades)' };
  }
  // the whole record: headline = trades written down BEFORE their result (pre); trades added afterwards are shown apart
  function summary(trades) {
    var closed = (trades || []).filter(function (t) { return t.status === 'closed' && typeof t.R === 'number'; }).sort(function (a, b) { return (a.exitAt || a.at) - (b.exitAt || b.at); });
    var R = function (l) { return l.map(function (t) { return t.R; }); }, pre = closed.filter(function (t) { return t.pre; }), post = closed.filter(function (t) { return !t.pre; });
    var split = function (list, key, order) { var out = []; order.forEach(function (k) { var l = list.filter(function (t) { return key(t) === k; }); if (l.length) out.push({ key: k, stats: stats(R(l)) }); }); return out; };
    var cum = 0, curve = pre.map(function (t) { cum += t.R; return { t: t.exitAt || t.at, r: +cum.toFixed(3) }; });
    return { open: (trades || []).filter(function (t) { return t.status === 'open'; }).length, closed: closed.length, pre: stats(R(pre)), post: stats(R(post)), all: stats(R(closed)), curve: curve,
      by: { how: split(pre, function (t) { return t.how; }, ['cf', 'zone', 'retest', 'other']), h4: split(pre, function (t) { return t.h4; }, ['with', 'against', '']),
        session: split(pre, function (t) { return sessionOf(t.at); }, ['asia', 'london', 'new york']), side: split(pre, function (t) { return t.side; }, ['sell', 'buy']) } };
  }
  // One logged trade on our own candles (bars oldest first, { time, open, high, low, close }, `sec` seconds each): was the entry
  // price traded near the logged time, and which came first afterwards, the stop or the target? The stop counts first when one
  // candle holds both. Up to the logged exit time for a closed trade.
  function replay(t, bars, sec) {
    sec = sec || 300; var s = t.side === 'sell' ? -1 : 1, r0 = Math.abs(t.entry - t.stop), i0 = -1, i;
    if (!(r0 > 0) || !bars || !bars.length) return { ok: false, why: 'no candles for that time' };
    for (i = 0; i < bars.length; i++) { var b = bars[i]; if (b.time + sec <= t.at) continue; if (b.time > t.at + 6 * sec) break; if (b.low <= t.entry && b.high >= t.entry) { i0 = i; break; } }
    if (i0 < 0) return { ok: true, filled: false, why: 'our candles never traded at the entry price within 30 minutes of the logged time' };
    var end = t.status === 'closed' && t.exitAt ? t.exitAt : Infinity, worst = 0, best = 0;
    for (i = i0; i < bars.length; i++) { var c = bars[i]; if (c.time > end) break;
      var adv = (s < 0 ? c.high - t.entry : t.entry - c.low) / r0, fav = (s < 0 ? t.entry - c.low : c.high - t.entry) / r0;
      if (adv > worst) worst = adv;
      if (s < 0 ? c.high >= t.stop : c.low <= t.stop) return { ok: true, filled: true, at: bars[i0].time, outcome: 'stop', when: c.time, R: -1, worst: +Math.min(worst, 1).toFixed(2), best: +best.toFixed(2) };
      if (fav > best) best = fav;
      if (t.target != null && (s < 0 ? c.low <= t.target : c.high >= t.target)) return { ok: true, filled: true, at: bars[i0].time, outcome: 'target', when: c.time, R: +(Math.abs(t.target - t.entry) / r0).toFixed(2), worst: +worst.toFixed(2), best: +best.toFixed(2) };
    }
    return { ok: true, filled: true, at: bars[i0].time, outcome: 'neither', R: null, worst: +worst.toFixed(2), best: +best.toFixed(2) };
  }
  function csv(trades) {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var iso = function (s) { return s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ') : ''; };
    var rows = [['entry time (UTC)', 'market', 'side', 'entry', 'stop', 'target', 'plan R:R', 'entry type', 'timeframe', 'H4', 'swept', 'status', 'exit', 'exit time (UTC)', 'R', 'logged before the result', 'note']];
    (trades || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (t) { rows.push([iso(t.at), t.market, t.side, t.entry, t.stop, t.target, t.planRR, t.how, t.tf, t.h4, t.swept, t.status, t.exit, iso(t.exitAt), t.R, t.pre ? 'yes' : 'no', t.note]); });
    return rows.map(function (r) { return r.map(q).join(','); }).join('\n') + '\n';
  }
  var API = { MIN_JUDGE: MIN_JUDGE, HOW: HOW, MKT: MKT, rOf: rOf, sessionOf: sessionOf, stats: stats, verdict: verdict, summary: summary, replay: replay, csv: csv };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA = API;
  if (typeof document === 'undefined') return;

  // ─── the desk ───
  // What a reader of the log sees goes through L(): English is the key, assets/mosha-i18n.js holds the teacher's other language
  // (the method's words stay English). The owner's own form and prompts are not translated.
  var L = function (s, v) { var I = root.MS_MOSHA_I18N; s = I ? I.tr(s) : s; return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s; };
  var loc = function () { var I = root.MS_MOSHA_I18N; return I && I.lang() === 'fr' ? 'fr-FR' : undefined; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var URL_API = /^https?:$/.test(location.protocol) && !/github\.io$/.test(location.hostname) ? '/api/mosha' : null;
  var M = { trades: null, canWrite: false, edit: null, busy: false, checks: {}, err: null };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var cls = function (v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; };
  var when = function (s) { if (!s) return '—'; var d = new Date(s * 1000), o = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }; if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric'; return d.toLocaleString(loc(), o); };
  var num = function (v) { return v == null ? '—' : String(+(+v).toFixed(5)); };
  var toLocalInput = function (s) { var d = new Date(s * 1000), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  var fromLocalInput = function (v) { var d = v ? new Date(v) : null; return d && !isNaN(d) ? Math.floor(d.getTime() / 1000) : null; };

  function call(method, body) {
    return fetch(URL_API, { method: method, cache: 'no-store', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || (r.status === 401 ? L('Sign in first.') : r.status === 429 ? L('Too many requests: wait a minute, then open the desk again.') : L('The log is unavailable ({n}).', { n: r.status }))); return j; }); });
  }
  function load() {
    if (!URL_API) { M.err = 'The trade log needs the live site (meridianx.dev): this copy has no server behind it.'; M.trades = []; draw(); return; }
    call('GET').then(function (j) { M.trades = j.trades || []; M.canWrite = !!j.canWrite; M.err = null; draw(); }).catch(function (e) { M.err = e.message; if (!M.trades) M.trades = []; draw(); });
  }

  // cumulative R of the trades written down before their result, as one line (labels are HTML, so text never scales)
  function curveSvg(pts) {
    if (!pts.length) return ''; pts = [{ r: 0 }].concat(pts);   // the line starts at zero, before the first trade
    var W = 600, H = 120, lo = 0, hi = 0; pts.forEach(function (p) { if (p.r < lo) lo = p.r; if (p.r > hi) hi = p.r; });
    var span = hi - lo || 1, x = function (i) { return (i / (pts.length - 1)) * W; }, y = function (r) { return 6 + (1 - (r - lo) / span) * (H - 12); };
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.r).toFixed(1); }).join(' '), last = pts[pts.length - 1].r;
    return '<figure class="mo-curve" aria-label="Running total of R, trades written down before their result: ' + fR(last) + ' after ' + (pts.length - 1) + ' trade' + (pts.length > 2 ? 's' : '') + '"><div class="mo-curve-y"><span>' + fR(hi) + '</span><span>' + fR(lo) + '</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="' + W + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" class="mo-zero"/><path d="' + d + '" class="mo-line ' + (last >= 0 ? 'up' : 'dn') + '" vector-effect="non-scaling-stroke"/></svg>' +
      '<figcaption>' + L('Running total, trade by trade · now {r}', { r: fR(last) }) + '</figcaption></figure>';
  }
  function tiles(s) {
    var pct = s.win == null ? '—' : Math.round(s.win * 100) + '%';
    return '<div class="ct-stats"><div><span>' + L('Closed') + '</span><b>' + s.n + '</b></div><div><span>' + L('Winners') + '</span><b>' + pct + '</b></div><div><span>' + L('R a trade') + '</span><b class="' + (s.n ? 'ct-' + cls(s.avg) : '') + '">' + (s.n ? fR(s.avg) : '—') + '</b></div>' +
      '<div><span>' + L('Total') + '</span><b class="' + (s.n ? 'ct-' + cls(s.total) : '') + '">' + (s.n ? fR(s.total) : '—') + '</b></div><div><span>t</span><b>' + (s.t == null ? '—' : s.t.toFixed(2)) + '</b></div><div><span>' + L('Deepest drawdown') + '</span><b>' + (s.n ? (s.maxDD > 0 ? '−' : '') + s.maxDD.toFixed(2) + 'R' : '—') + '</b></div></div>';
  }
  function splits(S) {
    var names = { cf: HOW.cf, zone: HOW.zone, retest: HOW.retest, other: HOW.other, 'with': 'With the H4', against: 'Against the H4', '': 'H4 not noted', asia: 'Asia', london: 'London', 'new york': 'New York', sell: 'Sells', buy: 'Buys' };
    var groups = [['Entry', S.by.how], ['H4', S.by.h4], ['Session of the entry', S.by.session], ['Side', S.by.side]], rows = '';
    groups.forEach(function (g) { g[1].forEach(function (r, i) { var s = r.stats, thin = s.n < 10;
      rows += '<tr' + (thin ? ' class="mo-thin"' : '') + '><td>' + (i ? '' : esc(L(g[0]))) + '</td><td>' + esc(L(names[r.key])) + '</td><td class="n">' + s.n + '</td><td class="n">' + Math.round(s.win * 100) + '%</td><td class="n"><b class="' + cls(s.avg) + '">' + fR(s.avg) + '</b></td><td class="n">' + fR(s.total) + '</td><td>' + (thin ? L('under 10 trades') : '') + '</td></tr>'; }); });
    return rows ? '<details class="mo-fold"><summary>' + L('Split by entry, H4, session and side') + '</summary><div class="ct-tw"><table class="ct-t"><thead><tr><th>' + L('By') + '</th><th></th><th class="n">Trades</th><th class="n">' + L('Winners') + '</th><th class="n">' + L('R a trade') + '</th><th class="n">' + L('Total') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="ms-note">' + L('A split of a small record is a description, not a finding: read the count first.') + '</p></details>' : '';
  }
  function drawRecord() {
    var box = $('mo-rec'); if (!box) return; var S = summary(M.trades), v = verdict(S.pre);
    var p = S.pre, tt = p.t == null ? 'n/a' : p.t.toFixed(2), vt = { none: L('No closed trade yet'), few: L('Too few to judge: {n} of {m} closed trades', { n: p.n, m: MIN_JUDGE }), pos: L('Positive so far (t {t} over {n} trades)', { t: tt, n: p.n }), luck: L('Positive, but not yet apart from luck (t {t} over {n} trades)', { t: tt, n: p.n }), neg: L('Negative so far (t {t} over {n} trades)', { t: tt, n: p.n }) }[v.key] || v.text;
    // a reader's foot note says whose log it is and never "you": the log is the owner's
    var foot = M.canWrite ? null : L('{n} open now.', { n: S.open }) + ' ' + (S.post.n ? L('Added afterwards, kept apart: {n}, {r} in total. A trade logged once its result is known is not in the numbers above.', { n: S.post.n, r: fR(S.post.total) }) : L('A trade counts here when it is logged while still open; one added after it closed is listed below but kept out of these numbers.'));
    box.innerHTML = '<div class="ms-k"><span>' + (M.canWrite ? 'Your record' : L('The logged trades')) + '</span><small>' + (M.canWrite ? '' : L('the owner\'s log') + ' · ') + L('trades written down before their result') + '</small></div>' +
      '<p class="mo-verdict mo-' + v.key + '">' + esc(vt) + '</p>' + tiles(S.pre) + curveSvg(S.curve) +
      '<p class="ms-note mo-foot">' + (foot != null ? foot + '</p>' + splits(S) : '') + (foot != null ? '' : S.open + ' open now. ' + (S.post.n ? 'Added afterwards, kept apart: ' + S.post.n + ' trade' + (S.post.n > 1 ? 's' : '') + ', ' + fR(S.post.total) + ' in total. A trade logged once its result is known cannot measure how you choose, so it is not in the numbers above.' : 'A trade counts here when you log it while it is still open; one added after it closed is listed below but kept out of these numbers.') + '</p>' + splits(S));
  }
  function checkLine(id) {
    var c = M.checks[id]; if (!c) return ''; if (c === 'busy') return '<div class="mo-check">' + L('Reading our candles…') + '</div>';
    if (!c.ok) return '<div class="mo-check">' + L('Could not check:') + ' ' + esc(L(c.why)) + '.</div>';
    if (!c.filled) return '<div class="mo-check">' + L('On our candles:') + ' ' + esc(L(c.why)) + '.</div>';
    var t = function (s) { return new Date(s * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' UTC'; };
    var head = c.outcome === 'stop' ? L('the stop was touched first, at {t}', { t: t(c.when) }) : c.outcome === 'target' ? L('the target was reached at {t} ({r})', { t: t(c.when), r: fR(c.R) }) : L('neither the stop nor the target was touched in the time checked');
    return '<div class="mo-check">' + L('On our candles (5-minute, stop first when one candle holds both):') + ' ' + head + '. ' + L('Worst point {w}R against, best {b}R in favour.', { w: c.worst.toFixed(2), b: c.best.toFixed(2) }) + '</div>';
  }
  function drawList() {
    var box = $('mo-list'); if (!box) return; if (!M.trades) { box.innerHTML = '<div class="ms-k"><span>Trades</span></div><div class="ct-empty">' + L('Loading the log…') + '</div>'; return; } var T = M.trades;
    var row = function (t) {
      var tags = [L(HOW[t.how] || ''), t.tf, t.h4 ? (t.h4 === 'with' ? L('with H4') : L('against H4')) : '', t.swept ? L('swept:') + ' ' + t.swept : ''].filter(Boolean).map(esc).join(' · ');
      var acts = (M.canWrite && t.status === 'open' ? '<button type="button" class="ms-tbtn mo-go" data-mo-close="' + esc(t.id) + '">Close it</button>' : '') + '<button type="button" class="ms-tbtn" data-mo-replay="' + esc(t.id) + '" title="' + esc(L('Open this trade on the chart and replay it')) + '">Replay</button>' + '<button type="button" class="ms-tbtn" data-mo-check="' + esc(t.id) + '" title="' + esc(L('Did the stop or the target come first on our 5-minute candles?')) + '">' + L('Check candles') + '</button>' + (M.canWrite ? '<button type="button" class="ms-tbtn" data-mo-edit="' + esc(t.id) + '">Edit</button><button type="button" class="ms-tbtn" data-mo-del="' + esc(t.id) + '">Delete</button>' : '');
      return '<tr><td class="mo-c-time"><span class="mo-when">' + when(t.at) + '</span><small>' + esc(MKT[t.market] || t.market) + '</small></td><td class="mo-c-side"><span class="chip ' + t.side + '">' + t.side.toUpperCase() + '</span></td><td class="n" data-l="Entry">' + num(t.entry) + '</td><td class="n" data-l="Stop">' + num(t.stop) + '</td><td class="n" data-l="Target">' + num(t.target) + '</td><td class="n" data-l="' + esc(L('Plan R:R')) + '">' + (t.planRR != null ? t.planRR.toFixed(1) : '—') + '</td>' +
        '<td class="mo-c-res">' + (t.status === 'open' ? L('Open') : L('Closed at') + ' ' + num(t.exit) + ' <b class="' + cls(t.R) + '">' + fR(t.R) + '</b>') + '<small>' + (t.pre ? L('logged before the result') : L('added afterwards')) + '</small></td>' +
        '<td class="mo-tags">' + tags + (t.note ? '<small>' + esc(t.note) + '</small>' : '') + checkLine(t.id) + '</td><td class="mo-acts">' + acts + '</td></tr>';
    };
    box.innerHTML = '<div class="ms-k"><span>Trades</span><small>' + L('{n} logged', { n: T.length }) + '</small>' + (T.length ? '<button type="button" class="ms-tbtn" id="mo-csv">' + L('Download CSV') + '</button>' : '') + '</div>' +
      (M.err ? '<p class="mo-err" role="alert">' + esc(M.err) + '</p>' : '') +
      (T.length ? '<div class="ct-tw"><table class="ct-t mo-t"><thead><tr><th>' + L('Entry time') + '</th><th>' + L('Side') + '</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th class="n">' + L('Plan R:R') + '</th><th>' + L('Result') + '</th><th>' + L('What it was') + '</th><th></th></tr></thead><tbody>' + T.map(row).join('') + '</tbody></table></div>'
        : '<div class="ct-empty">' + (M.canWrite ? 'Nothing logged yet. Write the next Mosha trade down as you take it: side, entry, stop and target. Close it here when it is over, and the record above starts counting.' : L('Nothing logged yet.')) + '</div>');
  }
  function draw() { var fc = $('mo-form-card'); if (fc) fc.hidden = !M.canWrite; drawRecord(); drawList(); }

  // ─── the form ───
  var F = function (n) { var f = $('mo-form'); return f ? f.elements[n] : null; };
  function formState() {
    var side = F('side').value, entry = parseFloat(F('entry').value), stop = parseFloat(F('stop').value), target = parseFloat(F('target').value), closed = F('status').value === 'closed', out = $('mo-calc'), msg = '';
    $('mo-exit-row').hidden = !closed;
    if (isFinite(entry) && isFinite(stop)) {
      var bad = side === 'sell' ? stop <= entry : stop >= entry;
      if (bad) msg = side === 'sell' ? 'A sell needs its stop above the entry.' : 'A buy needs its stop below the entry.';
      else { var r0 = Math.abs(entry - stop); msg = 'Risk ' + (+r0.toFixed(5)) + ' a unit';
        if (isFinite(target)) msg += (side === 'sell' ? target < entry : target > entry) ? ' · plan 1 : ' + (Math.abs(target - entry) / r0).toFixed(1) : ' · the target is on the wrong side';
        if (closed && isFinite(parseFloat(F('exit').value))) msg += ' · result ' + fR(rOf({ side: side, entry: entry, stop: stop, exit: parseFloat(F('exit').value) })); }
    } else msg = 'Every trade needs a stop.';
    out.textContent = msg;
  }
  function fillForm(t, closing) {
    var f = $('mo-form'); if (!f) return; M.edit = t ? t.id : null; var now = Math.floor(Date.now() / 1000), locked = !!t && t.status === 'closed';
    F('side').value = t ? t.side : 'sell'; F('market').value = t ? t.market : 'xau'; F('at').value = toLocalInput(t ? t.at : now);
    F('entry').value = t ? t.entry : ''; F('stop').value = t ? t.stop : ''; F('target').value = t && t.target != null ? t.target : '';
    F('how').value = t ? t.how : 'cf'; F('tf').value = t ? t.tf : 'M5'; F('h4').value = t ? t.h4 : ''; F('swept').value = t ? t.swept : ''; F('note').value = t ? t.note : '';
    F('status').value = t && (t.status === 'closed' || closing) ? 'closed' : 'open'; F('exit').value = t && t.exit != null ? t.exit : ''; F('exitAt').value = toLocalInput(t && t.exitAt ? t.exitAt : now);
    ['side', 'market', 'at', 'entry', 'stop', 'target'].forEach(function (n) { var el = F(n); if (el.length && !el.tagName) Array.prototype.forEach.call(el, function (x) { x.disabled = locked; }); else el.disabled = locked; });
    $('mo-form-h').textContent = !t ? 'Log a trade' : closing ? 'Close the trade' : locked ? 'Edit the notes of a closed trade' : 'Edit the open trade';
    $('mo-save').textContent = !t ? 'Save the trade' : closing ? 'Close it' : 'Save changes'; $('mo-cancel').hidden = !t; $('mo-msg').textContent = locked ? 'A closed trade keeps its side, entry, stop and target.' : '';
    formState(); if (t) { $('mo-form-card').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); var first = closing ? F('exit') : F('note'); setTimeout(function () { first.focus(); }, 50); }
  }
  function submit(ev) {
    ev.preventDefault(); if (M.busy) return; var msg = $('mo-msg'), btn = $('mo-save');
    var b = { side: F('side').value, market: F('market').value, at: fromLocalInput(F('at').value), entry: F('entry').value, stop: F('stop').value, target: F('target').value, how: F('how').value, tf: F('tf').value, h4: F('h4').value, swept: F('swept').value, note: F('note').value, status: F('status').value };
    if (M.edit) b.id = M.edit; if (b.status === 'closed') { b.exit = F('exit').value; b.exitAt = fromLocalInput(F('exitAt').value); }
    M.busy = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); msg.textContent = 'Saving…';
    call('POST', { save: b }).then(function (j) { var t = j.trade, i = M.trades.findIndex(function (x) { return x.id === t.id; }); if (i >= 0) M.trades[i] = t; else M.trades.unshift(t);
      M.trades.sort(function (a, c) { return c.at - a.at; }); fillForm(null); msg.textContent = t.status === 'closed' ? 'Saved: ' + fR(t.R) + '.' : 'Saved. Close it here when the trade is over.'; draw(); })
      .catch(function (e) { msg.textContent = e.message; })
      .then(function () { M.busy = false; btn.disabled = false; btn.removeAttribute('aria-busy'); });
  }
  function check(id) {
    var t = M.trades.find(function (x) { return x.id === id; }); if (!t) return; M.checks[id] = 'busy'; drawList();
    var now = Math.floor(Date.now() / 1000), from = t.at - 900, to = Math.min(now, (t.status === 'closed' && t.exitAt ? t.exitAt : t.at + 3 * 86400) + 600, from + 4900 * 300);
    fetch('/md/bars?sym=' + encodeURIComponent(t.market) + '&tf=5m&from=' + from + '&to=' + to, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var bars = j && Array.isArray(j.bars) ? j.bars.filter(function (b) { return !b.live; }).map(function (b) { return { time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }; }) : null;
        M.checks[id] = bars && bars.length ? replay(t, bars, 300) : { ok: false, why: 'no candles came back for that time' }; })
      .catch(function () { M.checks[id] = { ok: false, why: 'the candle feed did not answer: check the connection and try again' }; }).then(drawList);
  }
  function wire() {
    var f = $('mo-form'), view = $('v-mosha'); if (!view || view.dataset.wired) return; view.dataset.wired = '1';
    if (f) { f.addEventListener('submit', submit); f.addEventListener('input', formState); f.addEventListener('change', formState); $('mo-cancel').addEventListener('click', function () { fillForm(null); }); fillForm(null); }
    view.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; var find = function (id) { return M.trades.find(function (x) { return x.id === id; }); };
      if (b.dataset.moCheck) check(b.dataset.moCheck);
      else if (b.dataset.moReplay) { var rt = find(b.dataset.moReplay); if (rt && root.msMoshaReplayTrade) root.msMoshaReplayTrade(rt); }
      else if (b.dataset.moEdit) fillForm(find(b.dataset.moEdit));
      else if (b.dataset.moClose) fillForm(find(b.dataset.moClose), true);
      else if (b.dataset.moDel) { var id = b.dataset.moDel, t = find(id); if (!t) return;
        var ask = root.msConfirm ? root.msConfirm('Delete the ' + t.side + ' of ' + when(t.at) + '? It leaves the record for good.', { title: 'Delete this trade', ok: 'Delete', danger: true }) : Promise.resolve(true);
        Promise.resolve(ask).then(function (yes) { if (!yes) return; call('POST', { remove: id }).then(function () { M.trades = M.trades.filter(function (x) { return x.id !== id; }); if (M.edit === id) fillForm(null); draw(); }).catch(function (e) { M.err = e.message; draw(); }); }); }
      else if (b.id === 'mo-csv') { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv(M.trades)], { type: 'text/csv' })); a.download = 'mosha-trades.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    });
  }
  root.msMoshaDeskLang = function () { if (M.trades) draw(); };
  root.renderMosha = function () { wire(); if (!M.trades) draw(); load(); if (root.msMoshaReplay) root.msMoshaReplay(); if (root.msMoshaTeach) root.msMoshaTeach(); };
  { var v0 = $('v-mosha'); if (v0 && !v0.hidden) root.renderMosha(); }   // opened straight on #mosha before this file ran
})(typeof window !== 'undefined' ? window : globalThis);
