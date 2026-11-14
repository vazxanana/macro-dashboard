// Luxus's record (owner, 14 Nov 2026: "Ask Luxus and log his trades"). The trades the teacher sends as lessons, with their levels,
// measured on our own candles. Display only: nothing here places, copies or changes a trade, and no council member reads it.
// Who sees it: the owner and the desk's readers. Never the teacher himself: the desk never judges his trades to him (the same rule
// that hides "What the fixed rules said" and "The cycle" from him). Owner-English on purpose: it is never shown to the teacher, so
// it is not in the French dictionary.
// What counts (the owner's log rule, `pre`): a lesson with whole levels (market, side, entry time, entry, a stop on the losing side,
// a target), not from a ChronosTrade replay (`src: 'replay'` is practice on past candles), whose levels were given BEFORE the
// trade's outcome. Since 14 Nov 2026 the server stamps the levels themselves (`trade.setAt`, moved by any change of market, side,
// time, entry, stop or target; `exitSetAt` for his exit, which may come after the outcome: it is his close, not the levels). A
// lesson stored before that has no `setAt`: the lesson's own time (`at`) stands for its levels and the row says "levels not
// time-stamped (older lesson)". Levels set after the outcome are "added afterwards", never in the record.
// Outcome: our 5-minute candles (MS_MOSHA.replay: entry traded within 30 minutes of the given time, the stop first when one
// candle holds both); where neither level is reached before the teacher's own exit, his exit stands (a hand close).
(function (root) {
  'use strict';
  var D = root.MS_MOSHA || (typeof require === 'function' ? require('./mosha-desk.js') : null);
  var TEACHER = 'luxus';                 // keep in step with TEACHER in api/mosha.js
  var COST = { xau: 0.60 };              // a round trip in price, gold only; other markets are shown before costs
  var SPAN = 7 * 86400;                  // how long after the entry the candles are read when the teacher gave no exit
  var MIN_JUDGE = D ? D.MIN_JUDGE : 20;

  var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
  var secOf = function (iso) { var t = Date.parse(iso); return isFinite(t) ? Math.floor(t / 1000) : null; };
  // who may see the card, from the page's own attributes (html data-role / data-mosha)
  function visible(ds) { ds = ds || {}; return !(ds.mosha === 'teach' && ds.role !== 'owner'); }
  // { ok: true } when a lesson carries a trade the record may measure, else { ok: false, why }
  function eligible(l) {
    if (!l || l.by !== TEACHER) return { ok: false, why: 'not a lesson of the teacher' };
    var t = l.trade; if (!t) return { ok: false, why: 'no levels' };
    if (t.src === 'replay') return { ok: false, why: 'a ChronosTrade replay trade (practice on past candles)' };
    var e = num(t.entry), s = num(t.stop), g = num(t.target);
    if (t.side !== 'buy' && t.side !== 'sell') return { ok: false, why: 'no side' };
    if (e == null || s == null) return { ok: false, why: 'no entry or no stop' };
    if (t.side === 'sell' ? s <= e : s >= e) return { ok: false, why: 'the stop is not on the losing side' };
    if (g == null) return { ok: false, why: 'no target' };
    if (!t.market || num(t.at) == null) return { ok: false, why: 'no market or no entry time' };
    if (secOf(l.at) == null) return { ok: false, why: 'no time on the lesson' };
    return { ok: true };
  }
  // the trade in the shape MS_MOSHA.replay reads (it stops at the teacher's exit when he gave one)
  function asTrade(t) { return { side: t.side, entry: t.entry, stop: t.stop, target: t.target, at: t.at, status: num(t.exitAt) != null ? 'closed' : 'open', exitAt: num(t.exitAt) }; }
  function hisR(t) { if (num(t.exit) == null) return null; var r0 = Math.abs(t.entry - t.stop); return +(((t.side === 'sell' ? -1 : 1) * (t.exit - t.entry)) / r0).toFixed(3); }
  // One lesson and its candle check -> a row. status: closed | open | unfilled | nocandles | pending (not checked yet).
  // `out` = when the outcome was known (the start of the candle that reached the level, else the teacher's exit time);
  // `pre` = the lesson was made before it. An open trade is pre by nature (no outcome yet) but is not in the numbers.
  function judge(l, c) {
    var t = l.trade, sent = secOf(l.at), r0 = Math.abs(t.entry - t.stop), his = hisR(t);
    var setAt = num(t.setAt), ref = setAt != null ? setAt : sent;   // when the levels are proven to exist
    var row = { id: l.id, title: l.title, sent: sent, setAt: setAt, stamped: setAt != null, market: t.market, side: t.side, at: t.at, entry: t.entry, stop: t.stop, target: t.target, his: his, hisAt: num(t.exitAt), status: 'pending', R: null, net: null, by: null, out: null, pre: null, cost: COST[t.market] != null };
    if (!c) return row;
    if (!c.ok) { row.status = 'nocandles'; row.why = c.why; }
    else if (!c.filled) { row.status = 'unfilled'; row.why = c.why; }
    else if (c.outcome === 'stop' || c.outcome === 'target') { row.status = 'closed'; row.R = c.R; row.by = 'candles'; row.out = c.when; }
    else if (his != null && row.hisAt != null) { row.status = 'closed'; row.R = his; row.by = 'his exit'; row.out = row.hisAt; }
    else row.status = 'open';
    if (row.status === 'closed') { row.pre = ref != null && ref < row.out; row.net = +(row.R - (COST[t.market] || 0) / r0).toFixed(3); }
    else if (row.hisAt != null) row.pre = ref != null && ref < row.hisAt;   // an unchecked trade he closed: was the lesson before his exit?
    else row.pre = row.status === 'open' ? true : null;
    return row;
  }
  // the record from the rows: the headline counts closed trades sent before their outcome, in outcome order
  function record(rows) {
    var closed = rows.filter(function (r) { return r.status === 'closed'; }).sort(function (a, b) { return a.out - b.out; });
    var pre = closed.filter(function (r) { return r.pre; }), post = closed.filter(function (r) { return !r.pre; });
    var gross = D.stats(pre.map(function (r) { return r.R; })), net = D.stats(pre.map(function (r) { return r.net; }));
    return { gross: gross, net: net, verdict: D.verdict(gross), verdictNet: D.verdict(net), pre: pre, post: post,
      open: rows.filter(function (r) { return r.status === 'open'; }), other: rows.filter(function (r) { return r.status === 'unfilled' || r.status === 'nocandles'; }),
      pending: rows.filter(function (r) { return r.status === 'pending'; }), costOther: pre.some(function (r) { return !r.cost; }) };
  }
  // lessons -> { use: eligible lessons, out: [{ id, title, why }] }
  function sort(lessons) {
    var use = [], out = [];
    (lessons || []).forEach(function (l) { if (!l || l.by !== TEACHER) return; var e = eligible(l); if (e.ok) use.push(l); else if (l.trade) out.push({ id: l.id, title: l.title, why: e.why }); });
    return { use: use, out: out };
  }
  var API = { TEACHER: TEACHER, COST: COST, SPAN: SPAN, MIN_JUDGE: MIN_JUDGE, visible: visible, eligible: eligible, asTrade: asTrade, hisR: hisR, judge: judge, record: record, sort: sort };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_REC = API;
  if (typeof document === 'undefined') return;

  // ─── the card (#mo-lux) ───
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var cls = function (v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; };
  var utc = function (s) { return s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'; };
  var px = function (v) { return v == null ? '—' : String(+(+v).toFixed(5)); };
  var S = { lessons: null, err: null, checks: {}, tried: {}, busy: false };
  var keyOf = function (l) { var t = l.trade; return [l.id, t.market, t.side, t.at, t.entry, t.stop, t.target, t.exit, t.exitAt].join('|'); };
  function shown() { return visible(document.documentElement.dataset); }

  function fetchCheck(l) {
    var t = l.trade, now = Math.floor(Date.now() / 1000), end = num(t.exitAt) != null ? t.exitAt : t.at + SPAN;
    var from = t.at - 900, to = Math.min(now, end + 600, from + 4900 * 300);
    return fetch('/md/bars?sym=' + encodeURIComponent(t.market) + '&tf=5m&from=' + from + '&to=' + to, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var bars = j && Array.isArray(j.bars) ? j.bars.filter(function (b) { return !b.live; }).map(function (b) { return { time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }; }) : null;
        return bars && bars.length ? D.replay(asTrade(t), bars, 300) : { ok: false, why: 'no candles came back for that time' }; })
      .catch(function () { return { ok: false, why: 'the candle feed did not answer' }; });
  }
  // one candle request at a time, only for lessons not checked yet. A trade still open on our candles is read again on the next
  // read of the lessons (msMoshaRecord), never on every draw: `tried` holds what this read already asked for (a draw follows each
  // check, so without it an open trade was asked for again and again, about 300 requests a second).
  function checkAll(use) {
    if (S.busy) return; var todo = use.filter(function (l) { var k = keyOf(l), c = S.checks[k]; return !S.tried[k] && (!c || (c.ok && c.filled && c.outcome === 'neither')); }).slice(0, 60);
    if (!todo.length) return; S.busy = true; todo.forEach(function (l) { S.tried[keyOf(l)] = 1; });
    var next = function (i) { if (i >= todo.length) { S.busy = false; draw(); return; } fetchCheck(todo[i]).then(function (c) { S.checks[keyOf(todo[i])] = c; if (i % 4 === 3) draw(); next(i + 1); }); };
    next(0);
  }
  function tiles(g, n) {
    var pct = g.win == null ? '—' : Math.round(g.win * 100) + '%';
    return '<div class="ct-stats"><div><span>Closed</span><b>' + g.n + '</b></div><div><span>Winners</span><b>' + pct + '</b></div>' +
      '<div><span>R a trade</span><b class="' + (g.n ? 'ct-' + cls(g.avg) : '') + '">' + (g.n ? fR(g.avg) : '—') + '</b></div><div><span>Total</span><b class="' + (g.n ? 'ct-' + cls(g.total) : '') + '">' + (g.n ? fR(g.total) : '—') + '</b></div>' +
      '<div><span>t</span><b>' + (g.t == null ? '—' : g.t.toFixed(2)) + '</b></div><div><span>After costs</span><b class="' + (n.n ? 'ct-' + cls(n.avg) : '') + '">' + (n.n ? fR(n.avg) + ' a trade' : '—') + '</b></div></div>';
  }
  function rowHTML(r) {
    var res = r.status === 'closed' ? '<b class="' + cls(r.R) + '">' + fR(r.R) + '</b><small>' + (r.by === 'candles' ? (r.R < 0 ? 'stop first on our candles' : 'target on our candles') : 'his exit (neither level on our candles)') + ' · ' + utc(r.out) + '</small>'
      : r.status === 'open' ? 'Open on our candles' : r.status === 'pending' ? 'Reading our candles…' : esc(r.why || '');
    var his = r.his != null ? '<small>He sent: exit ' + fR(r.his) + (r.hisAt ? ' at ' + utc(r.hisAt) : '') + '</small>' : '';
    // the cells carry the log's classes and labels, so on a phone (under 760 px) the row becomes the log's card, not a squeezed grid
    return '<tr><td class="mo-c-time"><span class="mo-when">' + utc(r.at) + '</span><small>' + esc(r.market.toUpperCase()) + (r.stamped ? ' · levels set ' + utc(r.setAt) : ' · sent ' + utc(r.sent) + ' · levels not time-stamped (older lesson)') + '</small></td><td class="mo-c-side"><span class="chip ' + r.side + '">' + r.side.toUpperCase() + '</span></td>' +
      '<td class="n" data-l="Entry">' + px(r.entry) + '</td><td class="n" data-l="Stop">' + px(r.stop) + '</td><td class="n" data-l="Target">' + px(r.target) + '</td><td class="mo-c-res">' + res + his + '</td></tr>';
  }
  function table(rows, cap) { return rows.length ? '<div class="ct-tw"><table class="ct-t mo-t" aria-label="' + esc(cap) + '"><thead><tr><th>Entry time</th><th>Side</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th>Result</th></tr></thead><tbody>' + rows.map(rowHTML).join('') + '</tbody></table></div>' : ''; }
  function draw() {
    var box = $('mo-lux'); if (!box) return; box.hidden = !shown(); if (box.hidden) return;
    var head = '<div class="ms-k"><span>Luxus\'s record</span><small>his trades sent as lessons before their result · judged on our 5-minute candles</small></div>';
    if (S.err) { box.innerHTML = head + '<p class="mo-err" role="alert">The lessons could not be read: ' + esc(S.err) + '</p>'; return; }
    if (!S.lessons) { box.innerHTML = head + '<div class="ct-empty">Loading the lessons…</div>'; return; }
    var srt = sort(S.lessons), rows = srt.use.map(function (l) { return judge(l, S.checks[keyOf(l)] || null); }), R = record(rows), g = R.gross;
    var v = R.verdict, vt = v.key === 'few' ? 'Too few to judge: ' + g.n + ' of ' + MIN_JUDGE + ' closed trades' : v.text;
    var net = R.net.n ? 'After $0.60 a round trip on gold: ' + fR(R.net.avg) + ' a trade, ' + fR(R.net.total) + ' in total, t ' + (R.net.t == null ? 'n/a' : R.net.t.toFixed(2)) + (R.costOther ? ' (other markets before costs)' : '') + '. The tiles are before costs.' : 'The tiles are before costs; after costs = less $0.60 a round trip on gold.';
    var more = [];
    if (R.pending.length) more.push(R.pending.length + ' still being read');
    if (R.open.length) more.push(R.open.length + ' open on our candles');
    if (R.other.length) more.push(R.other.length + ' not measurable (entry not traded near its time, or no candles)');
    if (srt.out.length) more.push(srt.out.length + ' lesson' + (srt.out.length > 1 ? 's' : '') + ' with levels left out (' + srt.out.map(function (x) { return x.why; }).filter(function (w, i, a) { return a.indexOf(w) === i; }).join('; ') + ')');
    box.innerHTML = head + '<p class="mo-verdict mo-' + v.key + '">' + esc(vt) + '</p>' + tiles(g, R.net) + '<p class="ms-note">' + esc(net) + '</p>' +
      (R.pre.length ? '<details class="mo-fold"><summary>The ' + R.pre.length + ' trade' + (R.pre.length > 1 ? 's' : '') + ' in the record</summary>' + table(R.pre.slice().reverse(), 'Trades in the record') + '</details>' : '<div class="ct-empty">No trade in the record yet. A trade counts once Luxus sends it as a lesson with its entry, stop and target before its result, and our candles reach the stop or the target (or he sends his exit).</div>') +
      (R.open.length || R.other.length || R.pending.length ? '<details class="mo-fold"><summary>Open, not measurable or still being read</summary>' + table(R.open.concat(R.other, R.pending), 'Trades not in the record yet') + '</details>' : '') +
      (R.post.length ? '<details class="mo-fold"><summary>Added afterwards, kept apart: ' + R.post.length + ', ' + fR(D.stats(R.post.map(function (r) { return r.R; })).total) + ' in total</summary><p class="ms-note">The levels were given (or last changed) after the result on our candles (or after his exit), so they cannot measure how he chooses.</p>' + table(R.post, 'Added afterwards') + '</details>' : '') +
      '<p class="ms-note mo-foot">' + esc((more.length ? more.join(' · ') + '. ' : '') + 'Timing is the time the server stamped on the levels when they were last given or changed (his exit may come later: it is his close). Lessons from before 14 Nov 2026 carry no such stamp: there the lesson\'s own time stands for the levels, which an edit may have given later. Replay trades from ChronosTrade never count. Even a strong edge usually needs about 150 such trades to show (research/proposals/2026-11-14-luxus-record-power.md, arithmetic, not evidence). A description of his trades, not a tested edge.') + '</p>';
    checkAll(srt.use);
  }
  // called by assets/mosha-teach.js each time the lessons are read
  root.msMoshaRecord = function (lessons, err) { S.tried = {}; S.lessons = Array.isArray(lessons) ? lessons : S.lessons; S.err = lessons ? null : err || null; draw(); };
})(typeof window !== 'undefined' ? window : globalThis);
