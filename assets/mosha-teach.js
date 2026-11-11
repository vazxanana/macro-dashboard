// Mosha desk, teaching (owner, 10 Nov 2026: the Mosha desk "will be main page of" Luxus, "he will train u, allow him to send
// you trades images so u can learn"; then "He needs to be 100% teachable"). Everything a teacher does here, and everything the
// desk gives back so the teacher can check it:
//   - a lesson: a trade as screenshots with a caption each, or in words only, with the trade's own levels when the teacher has them;
//   - the conversation under it: the desk writes what it understood, the teacher says "right" or "not right" and why, the desk
//     answers again; "See it on the chart" opens the desk's reading (or the levels) in the replay above;
//   - the book, "What the desk knows": terms, steps, rules and things to avoid. The desk proposes lines; the teacher confirms,
//     corrects or erases them, or writes one directly. A confirmed or corrected line is the teacher's word.
// The server (api/mosha-lessons.js) decides who may do what and checks every picture and level; this file only draws.
// Pure pieces are on MS_MOSHA_TEACH and tested in tests/mosha-lessons.test.mjs. Lessons only: nothing here places a trade.
(function (root) {
  'use strict';
  // Words go through L(): English is the key, assets/mosha-i18n.js holds the teacher's other language (trading terms stay English).
  var L = function (s, v) { var I = root.MS_MOSHA_I18N; s = I ? I.tr(s) : s; return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s; };
  var loc = function () { var I = root.MS_MOSHA_I18N; return I && I.lang() === 'fr' ? 'fr-FR' : undefined; };
  var MAX_SIDE = 1800, MAX_PICK = 8, MAX_BYTES = 1.4 * 1024 * 1024;
  // the size a picture is sent at: the longer side at most `max`, never enlarged
  function fit(w, h, max) { var k = Math.min(1, max / Math.max(w, h, 1)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }; }
  // a first caption from the file name, when the name says something ("m5 vr.png" does, "IMG_2041.jpg" does not)
  function captionOf(name) {
    var s = String(name || '').replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || /^(img|image|photo|screenshot|screen shot|capture|pxl|dsc|wa\d*|whatsapp image|telegram|signal|file)\b/i.test(s) || /^[\d\s.:()at]+$/i.test(s) || !/[A-Za-z]{2}/.test(s)) return '';
    return s.slice(0, 200);
  }
  // Where a lesson stands (the same rule as the server's stateOf): new = the desk has not answered; more = the teacher added
  // something or said "not right", so the desk owes an answer; read = the desk answered and waits for the teacher's word;
  // agreed = the teacher said it is right.
  function stateOf(l) {
    var th = l.thread || [], la = null, i; for (i = th.length - 1; i >= 0; i--) if (th[i].by === 'assistant') { la = th[i]; break; }
    if (!la) return 'new'; if ((la.shots || 0) < (l.shots || []).length || la.verdict === 'wrong') return 'more';
    if (th.slice(i + 1).some(function (m) { return !(la.verdict === 'right' && la.vat && m.at <= la.vat); })) return 'more';
    if ((la.ask || []).some(function (x) { return x.a != null && !(la.verdict === 'right' && la.vat && x.aat <= la.vat); })) return 'more';   // he answered a question: the desk reads it
    return la.verdict === 'right' ? 'agreed' : 'read';
  }
  var STATE = { 'new': 'Not read yet', more: 'Waiting for the desk', read: 'The desk answered: is it right?', agreed: 'Understood' };
  var KIND = { term: 'Terms', step: 'Steps', rule: 'Rules', avoid: 'What to avoid' }, KINDS = ['term', 'step', 'rule', 'avoid'];
  function summary(list) { var shots = 0, c = { 'new': 0, more: 0, read: 0, agreed: 0 }; (list || []).forEach(function (l) { shots += (l.shots || []).length; c[stateOf(l)]++; }); return { lessons: (list || []).length, shots: shots, unread: c['new'] + c.more, toJudge: c.read, agreed: c.agreed }; }
  // the one line over the lessons: how many, where they stand, and how often the desk was right first time
  function scoreLine(s) {
    if (!s || !s.lessons) return '';
    var out = [s.lessons === 1 ? L('1 lesson') : L('{n} lessons', { n: s.lessons }), L('{n} understood', { n: s.agreed })]; if (s.waiting) out.push(L('{n} waiting for the desk', { n: s.waiting }));
    out.push(s.judged ? L('right first time {a} of {b}', { a: s.right, b: s.judged }) : L('none judged yet')); return out.join(' · ');
  }
  function bookLine(book) { var n = (book || []).length, t = (book || []).filter(function (b) { return b.status !== 'proposed'; }).length; return n ? (n === 1 ? L('1 line') : L('{n} lines', { n: n })) + ' · ' + L('{n} in the teacher\'s words', { n: t }) + ' · ' + L('{n} still the desk\'s own reading', { n: n - t }) : ''; }
  var bookGroups = function (book) { return KINDS.map(function (k) { return { kind: k, name: KIND[k], items: (book || []).filter(function (b) { return b.kind === k; }) }; }).filter(function (g) { return g.items.length; }); };
  // the trade a teacher typed with a lesson: null when the fold was left empty; times are the teacher's local clock
  function tradeFrom(v) {
    if (!v || (!v.side && !v.entry && !v.stop && !v.target)) return null;
    var at = v.at ? Math.floor(new Date(v.at).getTime() / 1000) : null; return { market: v.market || 'xau', side: v.side || '', entry: v.entry, stop: v.stop, target: v.target || '', at: at };
  }
  // What waits on the teacher: the desk's answers to check (their own lessons; every lesson for the owner) and the lines of the
  // book that are still the desk's own reading; `waiting` = lessons the desk has not answered yet.
  function todo(lessons, book, who, canTeach) {
    var judge = [], wait = 0; (lessons || []).forEach(function (l) { if (who !== 'owner' && l.by !== who) return; var s = stateOf(l); if (s === 'read') judge.push(l.id); else if (s !== 'agreed') wait++; });
    return { judge: canTeach ? judge : [], book: canTeach ? (book || []).filter(function (b) { return b.status === 'proposed'; }).length : 0, waiting: wait };
  }
  var FLT = { all: 'All', turn: 'Your turn', wait: 'Waiting for the desk', done: 'Understood' };
  function filterLessons(list, f) { return (list || []).filter(function (l) { var s = stateOf(l); return f === 'turn' ? s === 'read' : f === 'wait' ? s === 'new' || s === 'more' : f === 'done' ? s === 'agreed' : true; }); }
  // Captions to tap instead of typing: the ones this teacher used most, then the usual ones (at most 8, no repeats).
  var CAPS = ['H4', 'H1', 'M30 sweep high', 'M15 vr', 'M5 vr', 'M5 cf for sell', 'Entry after BO', 'Result'];
  function captionIdeas(lessons, who) {
    var n = {}, first = {}; (lessons || []).forEach(function (l) { if (who && who !== 'owner' && l.by !== who) return; (l.shots || []).forEach(function (s) { if (/^chronostrade replay/i.test(String(s.caption || '').trim())) return; String(s.caption || '').split(/\s*[,·;]\s*/).forEach(function (c) { c = c.trim(); var k = c.toLowerCase(); if (!c || c.length > 30) return; n[k] = (n[k] || 0) + 1; if (!first[k]) first[k] = c; }); }); });
    var out = Object.keys(n).sort(function (a, b) { return n[b] - n[a] || (a < b ? -1 : 1); }).slice(0, 5).map(function (k) { return first[k]; });
    CAPS.forEach(function (c) { if (out.length < 8 && !out.some(function (x) { return x.toLowerCase() === c.toLowerCase(); })) out.push(c); }); return out;
  }
  // a tapped caption joins what is already typed
  function addCaption(cur, idea) { cur = String(cur || '').trim(); return !cur ? idea : cur.toLowerCase().indexOf(idea.toLowerCase()) >= 0 ? cur : (cur + ', ' + idea).slice(0, 200); }
  // The tutorial: the five things a teacher does, in order, and which of them this teacher has already done (read from the
  // lessons and the book, so it is right on every device). `next` = the first one that is theirs to do now.
  var STEPS = [
    { k: 'send', t: 'Send a trade', go: 'Show me', p: 'Choose your screenshots (or drop or paste them), tap a caption on each one, like "M30 sweep high" or "M5 vr", and write in a few words what the desk should learn. Then press Send. No picture? Just write: a rule in words is a lesson too.' },
    { k: 'wait', t: 'The desk answers', go: 'Show me', p: 'The desk reads your lesson and writes under it what it understood, in your own terms. It does not read the second you send: it can take a while. The "Your turn" strip at the top tells you when an answer is waiting.' },
    { k: 'judge', t: 'Say right, or not right', go: 'Show me', p: 'Read the answer. If it is what you meant, press "That is right". If not, press "Not right…" and say what is wrong, the way you would tell a student. The desk answers again until it has it.' },
    { k: 'book', t: 'Check what the desk knows', go: 'Show me', p: 'The book is everything the desk holds about your trading, one line at a time. On each line press Right, Correct or Erase. Your words replace the desk\'s, and you can teach a new line directly.' },
    { k: 'replay', t: 'Backtest, and teach from the replay', go: 'Open ChronosTrade', p: 'In ChronosTrade, replay any day and take your trades. When one closes, press "Teach this trade" on the chart (or the T key): it comes here with its chart, entry, stop, target and result.' }];
  function guide(lessons, book, who) {
    var own = (lessons || []).filter(function (l) { return who === 'owner' || l.by === who; }), desk = function (f) { return own.some(function (l) { return (l.thread || []).some(function (m) { return m.by === 'assistant' && f(m); }); }); };
    var done = { send: own.length > 0, wait: desk(function () { return true; }), judge: desk(function (m) { return !!m.verdict; }), book: (book || []).some(function (b) { return b.status !== 'proposed'; }), replay: own.some(function (l) { return !!(l.trade && l.trade.src === 'replay'); }) };
    var can = { send: true, wait: false, judge: own.some(function (l) { return stateOf(l) === 'read'; }), book: (book || []).length > 0, replay: true }, next = null;
    var steps = STEPS.map(function (s) { if (!next && !done[s.k] && can[s.k]) next = s.k; return { k: s.k, done: done[s.k] }; });
    return { steps: steps, next: next, done: steps.filter(function (x) { return x.done; }).length, of: steps.length };
  }
  // base64 length of a data URL -> bytes
  function bytesOf(dataUrl) { var i = String(dataUrl).indexOf(','), b = String(dataUrl).length - i - 1; return i < 0 ? 0 : Math.floor(b * 3 / 4); }
  var API = { MAX_SIDE: MAX_SIDE, MAX_PICK: MAX_PICK, fit: fit, captionOf: captionOf, stateOf: stateOf, STATE: STATE, KIND: KIND, summary: summary, scoreLine: scoreLine, bookLine: bookLine, bookGroups: bookGroups, tradeFrom: tradeFrom, bytesOf: bytesOf, todo: todo, FLT: FLT, filterLessons: filterLessons, captionIdeas: captionIdeas, addCaption: addCaption, guide: guide, STEPS: STEPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_TEACH = API;
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var URL_ = '/api/mosha-lessons', T = { lessons: null, book: [], score: null, canTeach: false, who: null, picks: [], busy: false, open: null, loading: false, err: null, flt: 'all', wrong: null, bookOnly: false, drafted: false, guideOpen: null };
  var day = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }); };
  var api = function (body) { return fetch(URL_, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error ? L(j.error) : r.status === 429 ? L('too many requests: wait a minute') : r.status === 413 ? L('that picture is too large') : L('the desk did not take it ({n})', { n: r.status })); return j; }); }); };
  var mine = function (l) { return T.canTeach && l.by === T.who; }, mod = function () { return T.who === 'owner'; };   // the teacher's own lessons; the owner may only remove one
  var byId = function (id) { return (T.lessons || []).filter(function (x) { return x.id === id; })[0] || null; };

  function load() {
    if (T.loading) return; T.loading = true;
    fetch(URL_, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error ? L(j.error) : L('the lessons could not be read')); }); })
      .then(function (j) { T.lessons = Array.isArray(j.lessons) ? j.lessons : []; T.book = Array.isArray(j.book) ? j.book : []; T.score = j.score || null; T.canTeach = !!j.canTeach; T.who = j.who || null; T.err = null; firstLang(); })
      .catch(function (e) { T.err = e.message || L('the lessons could not be read'); })
      .then(function () { T.loading = false; draw(); });
  }
  var utc = function (t) { return new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; };
  // The desk's questions under one of its answers. Under its LAST answer the lesson's teacher answers each with one tap (Yes / No,
  // when the desk marked it so) or a few words; an answer can be changed until the desk answers again. Elsewhere they are read only.
  var said = function (a) { return a === 'yes' ? L('Yes') : a === 'no' ? L('No') : a; };
  function askOpen(m) { return (m.ask || []).filter(function (x) { return x.a == null; }).length; }
  function askHTML(l, m, live) {
    if (!m.ask || !m.ask.length) return '';
    return '<div class="mo-q"><b class="mo-q-h">' + L('The desk asks') + (live && askOpen(m) ? ' <small>' + L('one tap each, in any order') + '</small>' : '') + '</b><ol>' + m.ask.map(function (x, i) {
      var k = l.id + ':' + i, edit = live && (x.a == null || T.qedit === k), dv = (T.qd && T.qd[k]) || '';
      return '<li' + (x.a != null ? ' class="mo-q-done"' : '') + '><span class="mo-q-t">' + esc(x.q) + '</span>'
        + (x.a != null && !edit ? '<span class="mo-q-a"><b>' + esc(said(x.a)) + '</b>' + (live ? '<button type="button" class="mo-l-x" data-qedit="' + esc(k) + '">' + L('Change') + '</button>' : '') + '</span>' : '')
        + (edit ? '<form class="mo-q-f" data-q="' + esc(l.id) + '" data-i="' + i + '">' + (x.yn ? '<button type="button" class="ms-tbtn mo-q-y" data-qa="yes">' + L('Yes') + '</button><button type="button" class="ms-tbtn mo-q-n" data-qa="no">' + L('No') + '</button>' : '')
          + '<input name="a" maxlength="600" autocomplete="off" aria-label="' + esc(L('Your answer')) + '" placeholder="' + esc(x.yn ? L('or in your words') : L('Your answer')) + '" value="' + esc(dv) + '"><button type="submit" class="ms-tbtn">' + L('Send') + '</button></form>' : '')
        + (x.a == null && !live ? '<span class="mo-q-a mo-q-none">' + L('not answered') + '</span>' : '') + '</li>'; }).join('') + '</ol></div>';
  }
  function talkHTML(l, own) {
    var th = l.thread || [], st = stateOf(l), la = null; th.forEach(function (m) { if (m.by === 'assistant') la = m; });
    // He may still judge the desk's answer after answering its questions (that alone moves the lesson to "Waiting for the desk").
    var judge = !!la && (st === 'read' || (st === 'more' && !la.verdict && (la.shots || 0) >= (l.shots || []).length && th[th.length - 1] === la)), wrong = T.wrong === l.id && judge;
    var rows = th.map(function (m) { var desk = m.by === 'assistant';
      return '<li class="' + (desk ? 'mo-l-desk' : 'mo-l-you') + '"><b>' + (desk ? L('The desk understood') : esc(m.name || m.by)) + '</b><small>' + esc(day(m.at)) + '</small><p>' + esc(m.text) + '</p>' + (desk ? askHTML(l, m, own && m === la) : '') + (desk && m.verdict ? '<span class="mo-l-v mo-l-v-' + m.verdict + '">' + (m.verdict === 'right' ? L('Marked right') : L('Marked not right')) + '</span>' : '') + '</li>'; }).join('');
    return '<div class="mo-l-reply"><ol class="mo-l-talk">' + (rows || '<li class="mo-l-desk"><p class="mo-l-wait">' + L('The desk has not read this lesson yet.') + '</p></li>') + '</ol>'
      + (own && judge ? '<div class="mo-l-judge"><span>' + L('Did the desk get it right?') + '</span><button type="button" class="ms-tbtn mo-l-yes" data-right="' + esc(l.id) + '">' + L('That is right') + '</button><button type="button" class="ms-tbtn" data-wrong="' + esc(l.id) + '">' + L('Not right…') + '</button></div>' : '')
      + (own ? '<form class="mo-l-say" data-say="' + esc(l.id) + '"' + (wrong ? ' data-wrong="1"' : '') + '><label class="mo-f"><span>' + (wrong ? L('What is not right? The desk learns from your words') : la ? L('Tell the desk more, or correct it') : L('Add words for the desk')) + '</span><textarea name="text" rows="2" maxlength="2000" placeholder="' + esc(la ? L('The VR starts at the high, not at…') : L('What else should it see here?')) + '"></textarea></label><span class="mo-l-sayb">' + (wrong ? '<button type="button" class="mo-l-x" data-unwrong="1">' + L('Cancel') + '</button>' : '') + '<button type="submit" class="ms-tbtn">' + (wrong ? L('Send: not right') : L('Send')) + '</button></span></form>' : '')
      + '</div>';
  }
  function lessonHTML(l, open) {
    var st = stateOf(l), own = mine(l), t = l.trade, n = l.shots.length, canChart = !!(l.chart || t);
    return '<details class="mo-l" data-id="' + esc(l.id) + '"' + (open ? ' open' : '') + '><summary><span class="mo-l-t">' + esc(l.title) + '</span><span class="mo-l-m">' + esc(l.name || l.by) + ' · ' + esc(day(l.at)) + ' · ' + (n ? (n === 1 ? L('1 picture') : L('{n} pictures', { n: n })) : L('in words')) + '</span><span class="mo-l-st mo-l-' + st + '">' + L(STATE[st]) + '</span></summary>'
      + '<div class="mo-l-b">' + (l.note ? '<p class="mo-l-note">' + esc(l.note) + '</p>' : '')
      + (t ? '<p class="mo-l-trade"><b>' + (t.side === 'sell' ? 'Sell' : 'Buy') + ' ' + esc(t.entry) + '</b> · stop ' + esc(t.stop) + (t.target != null ? ' · target ' + esc(t.target) : '') + ' · ' + esc(String(t.market || '').toUpperCase()) + ' · ' + esc(utc(t.at)) + (t.exit != null ? ' · ' + L('closed') + ' ' + esc(t.exit) + ' (' + (t.R > 0 ? '+' : '') + esc(t.R) + 'R)' : '') + (t.src === 'replay' ? ' · <span class="mo-l-src">' + L('from a ChronosTrade replay') + (t.tf ? ', ' + esc(t.tf) : '') + '</span>' : '') + '</p>' : '')
      + (n ? '<div class="mo-l-shots">' + l.shots.map(function (s, i) { return '<figure><button type="button" class="mo-l-img" data-img="' + esc(s.img) + '" aria-label="' + L('Open picture {n}', { n: i + 1 }) + (s.caption ? ': ' + esc(s.caption) : '') + '"><img alt="' + esc(s.caption || L('Trade screenshot {n}', { n: i + 1 })) + '" data-src="' + URL_ + '?img=' + encodeURIComponent(s.img) + '" width="320" height="200" decoding="async"></button><figcaption>' + (s.caption ? esc(s.caption) : '<i>' + L('no caption') + '</i>') + (own ? ' <button type="button" class="mo-l-x" data-cap="' + esc(s.img) + '">' + L('Caption') + '</button>' : '') + (own || mod() ? ' <button type="button" class="mo-l-x" data-rm-img="' + esc(s.img) + '">' + L('Remove') + '</button>' : '') + '</figcaption></figure>'; }).join('') + '</div>' : '')
      + (canChart ? '<div class="mo-l-acts"><button type="button" class="ms-tbtn mo-l-chart" data-chart="' + esc(l.id) + '">' + (l.chart ? L('See the desk\'s reading on the chart') : L('See the levels on the chart')) + '</button></div>' : '')
      + talkHTML(l, own)
      + (own ? '<div class="mo-l-acts"><button type="button" class="ms-tbtn" data-more="' + esc(l.id) + '">' + L('Add pictures') + '</button><button type="button" class="ms-tbtn" data-note="' + esc(l.id) + '">' + L('Edit the note') + '</button><button type="button" class="ms-tbtn" data-levels="' + esc(l.id) + '">' + (t ? L('Change the levels') : L('Give the levels')) + '</button><button type="button" class="ms-tbtn" data-rm="' + esc(l.id) + '">' + L('Remove the lesson') + '</button></div>' : mod() ? '<div class="mo-l-acts"><button type="button" class="ms-tbtn" data-rm="' + esc(l.id) + '">' + L('Remove the lesson') + '</button></div>' : '')
      + '</div></details>';
  }
  function showImgs(det) { Array.prototype.forEach.call(det.querySelectorAll('img[data-src]'), function (im) { if (im.getAttribute('src')) return; im.onerror = function () { if (im.dataset.retry) { im.alt = L('This picture could not be loaded'); return; } im.dataset.retry = '1'; setTimeout(function () { im.src = im.dataset.src + '&r=1'; }, 20000); }; im.src = im.dataset.src; }); }
  // the desk's first wording of a corrected line: one of its own seed lines is shown in the reader's language, like the line itself was
  var wasOf = function (b) { var I = root.MS_MOSHA_I18N; return I && I.tr ? I.tr(b.was) : b.was; };
  var seen = function (b) { var I = root.MS_MOSHA_I18N; return I && I.seed ? I.seed(b) : b.text; };
  function bookHTML() {
    var can = T.canTeach, left = T.book.filter(function (b) { return b.status === 'proposed'; }); if (!left.length) T.bookOnly = false;
    var g = bookGroups(T.bookOnly ? left : T.book), only = T.bookOnly ? '<p class="mo-tc-to"><span>' + (left.length === 1 ? L('Only the 1 line you have not checked yet.') : L('Only the {n} lines you have not checked yet.', { n: left.length })) + '</span><button type="button" class="mo-l-x" data-b-all="1">' + L('Show every line') + '</button></p>' : '';
    return only + (g.length ? g.map(function (grp) { return '<section class="mo-b-g"><h3>' + L(grp.name) + '</h3><ul>' + grp.items.map(function (b) {
      var chip = b.status === 'proposed' ? '<span class="mo-b-s mo-b-prop">' + L('The desk\'s reading, not confirmed') + '</span>' : b.status === 'corrected' ? '<span class="mo-b-s mo-b-ok">' + L('Corrected by the teacher') + '</span>' : '<span class="mo-b-s mo-b-ok">' + (b.by === 'assistant' ? L('Confirmed') : L('Taught by {name}', { name: esc(b.name || b.by) })) + '</span>';
      return '<li data-b="' + esc(b.id) + '"><p>' + esc(seen(b)) + '</p>' + chip + (b.was ? '<small>' + L('The desk had:') + ' ' + esc(wasOf(b)) + '</small>' : '')
        + (can ? '<span class="mo-b-acts">' + (b.status === 'proposed' ? '<button type="button" class="mo-l-x" data-b-ok="' + esc(b.id) + '">' + L('Right') + '</button>' : '') + '<button type="button" class="mo-l-x" data-b-fix="' + esc(b.id) + '">' + (b.status === 'proposed' ? L('Correct') : L('Change')) + '</button><button type="button" class="mo-l-x" data-b-rm="' + esc(b.id) + '">' + L('Erase') + '</button></span>' : '') + '</li>'; }).join('') + '</ul></section>'; }).join('')
      : '<div class="ct-empty">' + L('The book is empty.') + ' ' + (can ? L('Teach the first line below.') : L('It fills as the teacher teaches.')) + '</div>')
      + (can ? '<form class="mo-b-add" id="mo-b-form"><label class="mo-f"><span>' + L('Teach a line') + '</span><select name="kind" aria-label="' + L('What kind of line') + '"><option value="rule">' + L('Rule') + '</option><option value="term">' + L('Term') + '</option><option value="step">' + L('Step') + '</option><option value="avoid">' + L('What to avoid') + '</option></select></label><label class="mo-f mo-b-text"><span>' + L('In your words') + '</span><input type="text" name="text" maxlength="600" placeholder="' + esc(L('Never sell before the M5 CF closes.')) + '"></label><button type="submit" class="ms-tbtn">' + L('Teach it') + '</button></form>' : '');
  }
  function draw() {
    var card = $('mo-lessons'), body = $('mo-l-body'), teach = $('mo-teach'), bk = $('mo-b-body'); if (!card || !body) return;
    if (teach) teach.hidden = !T.canTeach;
    var sub = $('mo-l-sub'), keyBox = $('mo-l-key'); if (keyBox) keyBox.hidden = T.who !== 'owner';
    if (T.err && !T.lessons) { body.innerHTML = '<div class="ct-empty">' + esc(T.err.charAt(0).toUpperCase() + T.err.slice(1)) + '.</div>'; if (sub) sub.textContent = ''; if (bk) bk.innerHTML = ''; return; }
    if (!T.lessons) return;
    if (sub) sub.textContent = scoreLine(T.score);
    var td = todo(T.lessons, T.book, T.who, T.canTeach), strip = $('mo-todo'), still = td.waiting === 1 ? L('The desk still has 1 lesson to read.') : L('The desk still has {n} lessons to read.', { n: td.waiting });
    if (strip) { strip.hidden = !T.canTeach; var bits = (td.judge.length ? '<button type="button" class="ms-tbtn" data-todo="judge">' + (td.judge.length === 1 ? L('1 answer to check') : L('{n} answers to check', { n: td.judge.length })) + '</button>' : '') + (td.book ? '<button type="button" class="ms-tbtn" data-todo="book">' + (td.book === 1 ? L('1 line of the book to check') : L('{n} lines of the book to check', { n: td.book })) + '</button>' : '');
      strip.classList.toggle('calm', !bits); strip.innerHTML = bits ? '<span>' + L('Your turn') + '</span>' + bits + (td.waiting ? '<small>' + still + '</small>' : '') : '<span>' + L('Nothing waits on you.') + '</span><small>' + (td.waiting ? still : L('Send a trade whenever you have one.')) + '</small>'; }
    var fl = $('mo-l-flt'); if (fl) { fl.hidden = T.lessons.length < 4; if (fl.hidden) T.flt = 'all'; else fl.innerHTML = Object.keys(FLT).map(function (k) { var c = filterLessons(T.lessons, k).length; return '<button type="button" data-flt="' + k + '" aria-pressed="' + (T.flt === k) + '">' + L(FLT[k]) + ' <small>' + c + '</small></button>'; }).join(''); }
    var shown = filterLessons(T.lessons, T.flt), firstTurn = shown.filter(function (l) { return td.judge.indexOf(l.id) >= 0; })[0];
    var openId = T.open || (firstTurn || shown[0] || {}).id, keep = {};   // the lesson that waits on the teacher opens first; what is being typed survives a redraw
    Array.prototype.forEach.call(body.querySelectorAll('form.mo-l-say'), function (f) { if (f.elements.text.value) keep[f.dataset.say] = f.elements.text.value; });
    body.innerHTML = T.lessons.length && !shown.length ? '<div class="ct-empty">' + L('No lessons here.') + '</div>' : T.lessons.length ? shown.map(function (l) { return lessonHTML(l, l.id === openId); }).join('')
      : '<div class="ct-empty">' + (T.canTeach ? L('No lessons yet. Choose screenshots above, or just write what the desk should learn, and press Send.') : L('No lessons yet. They appear here when the desk\'s teacher sends a trade.')) + '</div>';
    Array.prototype.forEach.call(body.querySelectorAll('details.mo-l'), function (d) { if (d.open) showImgs(d); d.addEventListener('toggle', function () { if (d.open) { T.open = d.dataset.id; showImgs(d); } }); });
    Array.prototype.forEach.call(body.querySelectorAll('form.mo-l-say'), function (f) { if (keep[f.dataset.say]) f.elements.text.value = keep[f.dataset.say]; });
    if (bk) { var typed = $('mo-b-form') && $('mo-b-form').elements.text.value; bk.innerHTML = bookHTML(); if (typed && $('mo-b-form')) $('mo-b-form').elements.text.value = typed; var bs = $('mo-b-sub'); if (bs) bs.textContent = bookLine(T.book); }
    var sel = document.querySelector('#mo-t-form select[name="lesson"]'); if (sel) { var cur = sel.value; sel.innerHTML = '<option value="">' + L('A new lesson') + '</option>' + T.lessons.filter(mine).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.title) + '</option>'; }).join(''); if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur; target(); }
    draft(); drawGuide();
    var lt = $('mo-lang-top'); if (lt) { lt.hidden = !T.canTeach; lt.innerHTML = T.canTeach ? langHTML() : ''; }
  }
  function firstLang() { var I = root.MS_MOSHA_I18N; if (!I || T.langSet || !T.who) return; T.langSet = true; I.who(T.who); if (!I.stored(T.who)) { var mineL = (T.lessons || []).filter(function (l) { return l.by === T.who && l.lang; })[0]; if (mineL && mineL.lang === 'fr') I.set('fr', T.who); } I.apply($('v-mosha')); }
  // The tutorial card. It opens by itself for a teacher until they hide it or have done every step; "How to teach" brings it back.
  var GKEY = function () { return 'msMoGuide:' + (T.who || ''); };
  function drawGuide() {
    var box = $('mo-guide'); if (!box) return; if (!T.canTeach || !T.lessons) { box.hidden = true; return; }
    var g = guide(T.lessons, T.book, T.who), hid = false; try { hid = localStorage.getItem(GKEY()) === 'hide'; } catch (e) {}
    var open = T.guideOpen != null ? T.guideOpen : (T.who !== 'owner' && !hid && g.done < g.of); box.hidden = !open; if (!open) return;
    var sent = g.steps[0].done, tut = root.MS_MOSHA_TUTOR ? root.MS_MOSHA_TUTOR.state(T.who) : { at: 0, done: false }; box.classList.toggle('full', T.guideOpen === true);   // shown by itself, a done step is one line; asked for, every step is in full
    box.innerHTML = '<div class="mo-g-h"><h2>' + L('How to teach the desk') + '</h2><span class="mo-g-n">' + (g.done === g.of ? L('You have done every step.') : L('{a} of {b} done', { a: g.done, b: g.of })) + '</span>' + langHTML() + '<button type="button" class="mo-l-x" data-g-hide="1">' + L('Hide the guide') + '</button></div>'
      + '<div class="mo-g-tut"><button type="button" class="u-btn" data-g-tut="1">' + (tut.done ? L('Read the tutorial again') : tut.at ? L('Continue the tutorial') : L('Start the tutorial')) + '</button><span>' + L('About 8 minutes, in nine short chapters. It shows how to give lessons the desk learns from fastest.') + '</span></div>'
      + '<div class="mo-g-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + g.of + '" aria-valuenow="' + g.done + '" aria-label="' + L('Steps done') + '"><i style="width:' + Math.round(100 * g.done / g.of) + '%"></i></div><ol class="mo-g-steps">'
      + STEPS.map(function (s, i) { var st = g.steps[i], nx = g.next === s.k, label = st.done ? L('Done') : nx ? L('Next') : s.k === 'wait' ? (sent ? L('The desk is reading') : L('After you send')) : s.k === 'judge' ? L('When the desk has answered') : L('To do');
        return '<li class="' + (st.done ? 'done' : nx ? 'next' : '') + '"><span class="mo-g-num" aria-hidden="true">' + (st.done ? '✓' : i + 1) + '</span><div><h3>' + L(s.t) + ' <span class="mo-g-st">' + label + '</span></h3><p>' + esc(L(s.p)) + '</p></div>'
          + (s.k === 'replay' ? '<a class="ms-tbtn" href="/backtest">' + L(s.go) + '</a>' : '<button type="button" class="ms-tbtn" data-g-go="' + s.k + '">' + L(s.go) + '</button>') + '</li>'; }).join('')
      + '</ol><p class="ms-note mo-g-foot">' + L('Lessons only: nothing here places, copies or changes a trade. Explain it the way you would to a student: the higher timeframe first, then the entry. You can open this guide again with "How to teach".') + '</p>';
  }
  function langHTML() { var I = root.MS_MOSHA_I18N; if (!I) return ''; var cur = I.lang(); return '<span class="mo-lang" role="group" aria-label="Language / Langue">' + I.LANGS.map(function (k) { return '<button type="button" data-lang="' + k + '" aria-pressed="' + (cur === k) + '" lang="' + k + '">' + I.NAMES[k] + '</button>'; }).join('') + '</span>'; }
  function setLang(k) { var I = root.MS_MOSHA_I18N; if (!I || I.lang() === k) return; I.set(k, T.who); I.apply($('v-mosha')); draw(); drawPicks(); }
  // "Show me": the part of the page a step is about, brought into view and outlined for a moment
  function showPart(k) {
    var jd = todo(T.lessons, T.book, T.who, T.canTeach).judge[0], el = k === 'send' ? $('mo-teach') : k === 'book' ? $('mo-book') : k === 'judge' && jd ? (T.open = jd, T.flt = 'all', draw(), document.querySelector('#mo-l-body details.mo-l[data-id="' + jd + '"]')) : k === 'wait' ? ($('mo-todo') && !$('mo-todo').hidden ? $('mo-todo') : $('mo-lessons')) : $('mo-lessons');
    if (!el) return; if (el.scrollIntoView) el.scrollIntoView({ block: k === 'wait' ? 'center' : 'start', behavior: 'smooth' }); el.classList.add('mo-show'); setTimeout(function () { el.classList.remove('mo-show'); }, 2200);
    if (k === 'send') { var fi = $('mo-t-file'); if (fi) fi.focus({ preventScroll: true }); }
  }
  // which lesson the pictures go to, said in words (the select itself sits in the fold)
  function target() { var f = $('mo-t-form'), row = $('mo-t-to'); if (!f || !row) return; var l = byId(f.elements.lesson.value); row.hidden = !l; if (l) row.querySelector('b').textContent = l.title; var s = $('mo-t-send'); if (s) s.disabled = !canSend(); }
  // What the teacher typed is kept on this device until it is sent (a phone that switches apps reloads the page).
  var DKEY = function () { return 'msMoDraft:' + (T.who || ''); }, dTimer = 0;
  function draft() { var f = $('mo-t-form'); if (T.drafted || !f || !T.who || !T.canTeach) return; T.drafted = true; try { var d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); if (d && !f.elements.note.value && !f.elements.title.value) { f.elements.note.value = String(d.note || '').slice(0, 2000); f.elements.title.value = String(d.title || '').slice(0, 80); if (f.elements.title.value) $('mo-t-more').open = true; var s = $('mo-t-send'); if (s) s.disabled = !canSend(); } } catch (e) {} }
  function keepDraft() { clearTimeout(dTimer); dTimer = setTimeout(function () { var f = $('mo-t-form'); if (!f || !T.who) return; try { var d = { note: f.elements.note.value, title: f.elements.title.value }; if (d.note || d.title) localStorage.setItem(DKEY(), JSON.stringify(d)); else localStorage.removeItem(DKEY()); } catch (e) {} }, 400); }
  function dropDraft() { clearTimeout(dTimer); try { localStorage.removeItem(DKEY()); } catch (e) {} }
  var toCard = function (el) { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };

  // ─── sending ───
  function say(txt, bad) { var m = $('mo-t-msg'); if (m) { m.textContent = txt || ''; m.classList.toggle('mo-err-t', !!bad); } }
  function canSend() { var f = $('mo-t-form'); return !!f && !T.busy && (T.picks.length > 0 || (!f.elements.lesson.value && !!f.elements.note.value.trim())); }
  function drawPicks() {
    var ol = $('mo-t-picks'), send = $('mo-t-send'); if (!ol) return;
    var ideas = T.picks.length ? captionIdeas(T.lessons, T.who) : [];
    ol.innerHTML = T.picks.map(function (p, i) { return '<li><img src="' + esc(p.url) + '" alt="" width="96" height="60"><label class="mo-f"><span>' + L('Caption for picture {n}', { n: i + 1 }) + '</span><input type="text" maxlength="200" data-pick="' + i + '" value="' + esc(p.caption) + '" placeholder="M5 vr · M30 sweep high · entry after BO sell"></label><button type="button" class="ms-tbtn" data-drop="' + i + '" aria-label="' + L('Take picture {n} out', { n: i + 1 }) + '">' + L('Take out') + '</button><span class="mo-cap-ideas" role="group" aria-label="' + L('Captions to tap for picture {n}', { n: i + 1 }) + '">' + ideas.map(function (c) { return '<button type="button" data-idea="' + i + '" data-text="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</span></li>'; }).join('');
    if (send) send.disabled = !canSend();
  }
  function addFiles(files) {
    var took = 0, skipped = 0; Array.prototype.forEach.call(files || [], function (f) {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { skipped++; return; } if (T.picks.length >= MAX_PICK) { skipped++; return; }
      T.picks.push({ file: f, url: URL.createObjectURL(f), caption: captionOf(f.name) }); took++; });
    drawPicks(); say(skipped ? (took ? L('Some files were left out:') : L('Not added:')) + ' ' + L('send PNG, JPEG or WebP pictures, {n} at a time.', { n: MAX_PICK }) : took ? (T.picks.length === 1 ? L('1 picture ready. Add a caption or a few words, then send.') : L('{n} pictures ready. Add a caption or a few words, then send.', { n: T.picks.length })) : '', skipped && !took);
    if (took) toCard($('mo-teach'));
  }
  // one picture, as a JPEG data URL small enough to send (screenshots stay sharp: only the longest side is limited)
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var im = new Image(), u = URL.createObjectURL(file);
      im.onload = function () { try { var side = MAX_SIDE, q = .88, out, n = 0;
          do { var d = fit(im.naturalWidth, im.naturalHeight, side), c = document.createElement('canvas'); c.width = d.w; c.height = d.h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, d.w, d.h); x.drawImage(im, 0, 0, d.w, d.h); out = c.toDataURL('image/jpeg', q); q -= .12; if (q < .6) { q = .8; side = Math.round(side * .8); } }
          while (bytesOf(out) > MAX_BYTES && ++n < 8);
          URL.revokeObjectURL(u); if (bytesOf(out) > MAX_BYTES) bad(new Error(L('that picture is too large to send'))); else ok(out); } catch (e) { URL.revokeObjectURL(u); bad(new Error(L('that picture could not be read'))); } };
      im.onerror = function () { URL.revokeObjectURL(u); bad(new Error(L('that file is not a picture this browser can read'))); }; im.src = u; });
  }
  function levelsOf(f) { var e = f.elements; return tradeFrom({ side: e.side.value, market: e.market.value, at: e.at.value, entry: e.entry.value, stop: e.stop.value, target: e.target.value }); }
  function send(ev) {
    ev.preventDefault(); var f = $('mo-t-form'); if (!f || T.busy) return;
    var lesson = f.elements.lesson.value || null, title = f.elements.title.value.trim(), note = f.elements.note.value.trim(), total = T.picks.length, done = 0, trade = lesson ? null : levelsOf(f);
    if (!total && (lesson || !note)) { say(lesson ? L('Choose the pictures to add. To add words, write under the lesson itself.') : L('Add a screenshot, or write what the desk should learn.'), true); return; }
    if (trade && (!trade.side || !trade.entry || !trade.stop || !trade.at)) { say(L('The levels need a side, the entry, the stop and the entry time. Every trade has a stop.'), true); return; }
    T.busy = true; drawPicks(); f.setAttribute('aria-busy', 'true');
    var first = function (extra) { var a = { lesson: lesson, title: title, note: done === 0 ? note : undefined, trade: done === 0 && trade ? trade : undefined, lang: root.MS_MOSHA_I18N ? root.MS_MOSHA_I18N.lang() : 'en' }; for (var k in extra) a[k] = extra[k]; return api({ add: a }); };
    var next = function () {
      if (!T.picks.length) return Promise.resolve();
      var p = T.picks[0]; say(L('Sending picture {a} of {b}…', { a: done + 1, b: total }));
      return shrink(p.file).then(function (data) { return first({ caption: p.caption, image: data }); })
        .then(function (j) { lesson = j.lesson.id; T.open = lesson; done++; URL.revokeObjectURL(p.url); T.picks.shift(); drawPicks(); return next(); });
    };
    (total ? next() : first({}).then(function (j) { T.open = j.lesson.id; }))
      .then(function () { say((total > 1 ? L('{n} pictures sent.', { n: total }) : L('Sent.')) + ' ' + L('The desk will read it and write back what it understood.')); f.reset(); dropDraft(); $('mo-t-more').open = false; T.flt = 'all'; })
      .catch(function (e) { say((done ? L('{a} of {b} sent, then:', { a: done, b: total }) : L('Not sent:')) + ' ' + (e.message || L('something went wrong')) + '. ' + L('The rest is still here; send again.'), true); })
      .then(function () { T.busy = false; f.removeAttribute('aria-busy'); drawPicks(); load(); });
  }
  function ask(label, value, opt) { return root.msAsk ? root.msAsk(label, value, opt) : Promise.resolve(null); }
  function sure(msg, opt) { return root.msConfirm ? root.msConfirm(msg, opt) : Promise.resolve(false); }
  function act(p) { return p.then(function () { load(); }).catch(function (e) { if (root.msAlert) root.msAlert((e && e.message) || L('That did not work.')); load(); }); }
  function view(img) {
    var d = $('mo-l-dlg'); if (!d) { d = document.createElement('dialog'); d.id = 'mo-l-dlg'; d.className = 'mo-l-dlg'; d.innerHTML = '<form method="dialog"><button class="ms-tbtn" aria-label="' + L('Close the picture') + '">' + L('Close') + '</button></form><img alt=""><p></p>'; document.body.appendChild(d); d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); }
    var src = img.getAttribute('src'); if (!src) return; d.querySelector('img').src = src; d.querySelector('img').alt = img.alt; d.querySelector('p').textContent = img.alt; if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  // the levels of a lesson, given or changed afterwards (the server refuses a trade without its stop)
  function levelsDialog(l) {
    var d = $('mo-lv-dlg'); if (!d) { d = document.createElement('dialog'); d.id = 'mo-lv-dlg'; d.className = 'own-dlg mo-lv-dlg'; document.body.appendChild(d); }
    var t = l.trade || {}, loc = t.at ? new Date(t.at * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    d.innerHTML = '<form method="dialog" class="mo-lv"><h3>' + L('The levels of this trade') + '</h3><p class="ms-note">' + L('With them the desk can put the trade on the chart. Every trade has a stop.') + '</p>'
      + '<label class="mo-f"><span>' + L('Side') + '</span><select name="side"><option value="sell"' + (t.side !== 'buy' ? ' selected' : '') + '>Sell</option><option value="buy"' + (t.side === 'buy' ? ' selected' : '') + '>Buy</option></select></label>'
      + '<label class="mo-f"><span>' + L('Market') + '</span><select name="market">' + [['xau', 'XAU/USD'], ['xag', 'XAG/USD'], ['eurusd', 'EUR/USD'], ['gbpusd', 'GBP/USD'], ['nas100', 'NAS100']].concat([['spx500', 'S&P 500'], ['us30', 'Dow 30'], ['de40', 'DAX 40'], ['usdjpy', 'USD/JPY'], ['audusd', 'AUD/USD'], ['usdcad', 'USD/CAD'], ['usdchf', 'USD/CHF'], ['nzdusd', 'NZD/USD'], ['gbpjpy', 'GBP/JPY'], ['bco', 'Brent oil'], ['wtico', 'WTI oil']].filter(function (m) { return m[0] === t.market; })).map(function (m) { return '<option value="' + m[0] + '"' + ((t.market || 'xau') === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>'
      + '<label class="mo-f"><span>' + L('Entry time') + ' <small>' + L('your local time') + '</small></span><input type="datetime-local" name="at" value="' + esc(loc) + '" required></label>'
      + '<label class="mo-f"><span>Entry</span><input type="number" name="entry" inputmode="decimal" step="any" min="0" value="' + esc(t.entry != null ? t.entry : '') + '" required></label>'
      + '<label class="mo-f"><span>Stop <small>' + L('required') + '</small></span><input type="number" name="stop" inputmode="decimal" step="any" min="0" value="' + esc(t.stop != null ? t.stop : '') + '" required></label>'
      + '<label class="mo-f"><span>Target <small>' + L('optional') + '</small></span><input type="number" name="target" inputmode="decimal" step="any" min="0" value="' + esc(t.target != null ? t.target : '') + '"></label>'
      + '<p class="mo-err-t" id="mo-lv-msg" role="alert"></p><div class="own-acts">' + (l.trade ? '<button type="button" id="mo-lv-clear">' + L('Take the levels off') + '</button>' : '') + '<button type="button" id="mo-lv-cancel">' + L('Cancel') + '</button><button type="submit" class="pri">' + L('Save') + '</button></div></form>';
    var f = d.querySelector('form'), msg = d.querySelector('#mo-lv-msg');
    f.onsubmit = function (ev) { ev.preventDefault(); api({ edit: { id: l.id, trade: Object.assign({}, l.trade ? { exit: l.trade.exit, exitAt: l.trade.exitAt, tf: l.trade.tf, src: l.trade.src } : {}, levelsOf(f) || {}) } }).then(function () { d.close(); load(); }).catch(function (e) { msg.textContent = (e.message || L('Not saved')).replace(/^./, function (c) { return c.toUpperCase(); }) + '.'; }); };
    d.querySelector('#mo-lv-cancel').onclick = function () { d.close(); }; var cl = d.querySelector('#mo-lv-clear'); if (cl) cl.onclick = function () { d.close(); act(api({ edit: { id: l.id, trade: null } })); };
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  // one answer to one of the desk's questions
  function answer(f, a) { var k = f.dataset.q + ':' + f.dataset.i; if (T.qd) delete T.qd[k]; T.qedit = null; var lg = root.MS_MOSHA_I18N ? root.MS_MOSHA_I18N.lang() : 'en'; act(api({ say: { id: f.dataset.q, answers: [{ i: +f.dataset.i, a: a }], lang: lg } })); }
  function wire() {
    var card = $('mo-lessons'); if (!card || card.dataset.wired) return; card.dataset.wired = '1';
    card.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; var l = b.closest('details.mo-l'), id = l && l.dataset.id;
      if (b.dataset.img) { var im = b.querySelector('img'); if (im) view(im); }
      else if (b.dataset.chart) { var Lc = byId(b.dataset.chart); if (Lc && root.msMoshaReplayLesson) root.msMoshaReplayLesson(Lc); }
      else if (b.dataset.right) act(api({ say: { id: b.dataset.right, verdict: 'right' } }));
      else if (b.dataset.wrong) { T.wrong = b.dataset.wrong; draw(); var tx = card.querySelector('form.mo-l-say[data-say="' + b.dataset.wrong + '"] textarea'); if (tx) tx.focus(); }   // typed in place, under the desk's answer
      else if (b.dataset.unwrong) { T.wrong = null; draw(); }
      else if (b.dataset.qedit) { T.qedit = b.dataset.qedit; draw(); var qi = card.querySelector('form.mo-q-f[data-q="' + b.dataset.qedit.split(':')[0] + '"][data-i="' + b.dataset.qedit.split(':')[1] + '"] input'); if (qi) qi.focus(); }
      else if (b.dataset.qa) { var qf = b.closest('form.mo-q-f'); if (qf) answer(qf, b.dataset.qa); }
      else if (b.dataset.flt) { T.flt = b.dataset.flt; T.open = null; draw(); }
      else if (b.dataset.rmImg) sure(L('Remove this picture from the lesson?'), { title: L('Remove the picture'), ok: L('Remove'), danger: true }).then(function (y) { if (y) act(api({ remove: { id: id, img: b.dataset.rmImg } })); });
      else if (b.dataset.cap) { var s = ((byId(id) || { shots: [] }).shots.filter(function (x) { return x.img === b.dataset.cap; })[0]); ask(L('Caption'), s ? s.caption : '', { title: L('Caption of this picture'), ok: L('Save'), max: 200 }).then(function (v) { if (v != null) act(api({ edit: { id: id, img: b.dataset.cap, caption: v } })); }); }
      else if (b.dataset.rm) sure(L('Remove this lesson and its pictures? This cannot be undone.'), { title: L('Remove the lesson'), ok: L('Remove'), danger: true }).then(function (y) { if (y) act(api({ remove: { id: b.dataset.rm } })); });
      else if (b.dataset.note) { var cur = byId(b.dataset.note); ask(L('What should the desk learn from it'), cur ? cur.note : '', { title: L('Note of this lesson'), ok: L('Save'), max: 2000 }).then(function (v) { if (v != null) act(api({ edit: { id: b.dataset.note, note: v } })); }); }
      else if (b.dataset.levels) { var lv = byId(b.dataset.levels); if (lv) levelsDialog(lv); }
      else if (b.dataset.more) { var f = $('mo-t-form'); if (f) { f.elements.lesson.value = b.dataset.more; target(); toCard($('mo-teach')); var fi = $('mo-t-file'); if (fi) { fi.focus(); fi.click(); } } }   // straight to the picker
      else if (b.id === 'mo-l-keybtn') { b.disabled = true; fetch(URL_ + '?get=reader', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { var o = $('mo-l-keyout'); if (!o) return; o.hidden = false; var inp = o.querySelector('input'); if (j.key) { inp.value = j.key; inp.focus(); inp.select(); o.querySelector('small').textContent = 'Host: ' + (j.host || 'meridianx.dev') + '. Paste the key only into the secure form the assistant opens for that host, never into a chat. With it one can read the lessons, answer them and propose lines for the book, nothing else.'; } else { inp.value = ''; o.querySelector('small').textContent = j.off ? 'The key is switched off on the server (MOSHA_READER=off).' : (j.error || 'The server has no session secret yet, so there is no key.'); } }).catch(function () {}).then(function () { b.disabled = false; }); }
      else if (b.id === 'mo-l-keycopy') { var k = $('mo-l-keyout').querySelector('input'); if (k.value && root.msCopy) root.msCopy(k.value); else if (k.value && navigator.clipboard) navigator.clipboard.writeText(k.value); }
    });
    card.addEventListener('input', function (ev) { var qf = ev.target.closest && ev.target.closest('form.mo-q-f'); if (qf) { T.qd = T.qd || {}; T.qd[qf.dataset.q + ':' + qf.dataset.i] = ev.target.value; } });   // a half-written answer survives a redraw
    card.addEventListener('submit', function (ev) { var qf = ev.target.closest('form.mo-q-f'); if (qf) { ev.preventDefault(); var qv = qf.elements.a.value.trim(); if (!qv) { qf.elements.a.focus(); return; } answer(qf, qv); return; }
      var f = ev.target.closest('form.mo-l-say'); if (!f) return; ev.preventDefault(); var v = f.elements.text.value.trim(); if (!v) { f.elements.text.focus(); return; } f.elements.text.value = ''; var wrong = !!f.dataset.wrong; T.wrong = null; var lg = root.MS_MOSHA_I18N ? root.MS_MOSHA_I18N.lang() : 'en'; act(api({ say: wrong ? { id: f.dataset.say, verdict: 'wrong', text: v, lang: lg } : { id: f.dataset.say, text: v, lang: lg } })); });
    var view_ = $('v-mosha'), strip = $('mo-todo'), gd = $('mo-guide'), gopen = $('mo-guide-open');
    if (gd) gd.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.lang) setLang(b.dataset.lang);
      else if (b.dataset.gTut) { if (root.MS_MOSHA_TUTOR) root.MS_MOSHA_TUTOR.open(T.who, { onLang: setLang, onClose: drawGuide, go: function (k) { showPart(k); } }); }
      else if (b.dataset.gHide) { T.guideOpen = false; try { localStorage.setItem(GKEY(), 'hide'); } catch (e) {} drawGuide(); if (gopen) gopen.focus(); }
      else if (b.dataset.gGo) showPart(b.dataset.gGo); });
    var ltop = $('mo-lang-top'); if (ltop) ltop.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-lang]'); if (b) setLang(b.dataset.lang); });
    if (gopen) gopen.addEventListener('click', function () { T.guideOpen = true; try { localStorage.removeItem(GKEY()); } catch (e) {} drawGuide(); if (gd && gd.scrollIntoView) gd.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    // Ctrl / Cmd + Enter sends whatever is being written on the desk
    if (view_) view_.addEventListener('keydown', function (ev) { if (ev.key !== 'Enter' || !(ev.ctrlKey || ev.metaKey) || !ev.target.closest) return; var f = ev.target.closest('form.mo-l-say, #mo-t-form, #mo-b-form'); if (!f) return; ev.preventDefault(); if (f.requestSubmit) f.requestSubmit(); });
    if (strip) strip.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-todo]'); if (!b) return;
      if (b.dataset.todo === 'book') { T.bookOnly = true; draw(); if ($('mo-book').scrollIntoView) $('mo-book').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      else { var id = todo(T.lessons, T.book, T.who, T.canTeach).judge[0]; if (!id) return; T.flt = 'all'; T.open = id; draw(); var d = card.querySelector('details.mo-l[data-id="' + id + '"]'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    var book = $('mo-book'); if (book) {
      book.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.bAll) { T.bookOnly = false; draw(); }
        else if (b.dataset.bOk) act(api({ book: { id: b.dataset.bOk, confirm: true } }));
        else if (b.dataset.bFix) { var it = T.book.filter(function (x) { return x.id === b.dataset.bFix; })[0]; ask(L('Say it the way you mean it'), it ? seen(it) : '', { title: L('Correct this line'), ok: L('Save'), max: 600 }).then(function (v) { if (v != null && String(v).trim()) act(api({ book: { id: b.dataset.bFix, text: v } })); }); }
        else if (b.dataset.bRm) sure(L('Erase this line from what the desk knows?'), { title: L('Erase the line'), ok: L('Erase'), danger: true }).then(function (y) { if (y) act(api({ book: { id: b.dataset.bRm, remove: true } })); }); });
      book.addEventListener('submit', function (ev) { var f = ev.target.closest('#mo-b-form'); if (!f) return; ev.preventDefault(); var v = f.elements.text.value.trim(); if (v.length < 4) return; var kind = f.elements.kind.value; f.elements.text.value = ''; act(api({ learn: { kind: kind, text: v } })); });
    }
    var f = $('mo-t-form'); if (!f) return;
    f.addEventListener('submit', send); f.addEventListener('input', function (ev) { var s = $('mo-t-send'); if (s) s.disabled = !canSend(); if (ev.target.name === 'note' || ev.target.name === 'title') keepDraft(); }); f.addEventListener('reset', function () { setTimeout(function () { drawPicks(); target(); }, 0); });
    f.elements.lesson.addEventListener('change', target); $('mo-t-new').addEventListener('click', function () { f.elements.lesson.value = ''; target(); });
    $('mo-t-file').addEventListener('change', function (ev) { addFiles(ev.target.files); ev.target.value = ''; });
    $('mo-t-picks').addEventListener('input', function (ev) { var i = ev.target.dataset.pick; if (i != null && T.picks[+i]) T.picks[+i].caption = ev.target.value; });
    $('mo-t-picks').addEventListener('click', function (ev) { var idea = ev.target.closest('button[data-idea]'); if (idea) { var pk = T.picks[+idea.dataset.idea], inp = $('mo-t-picks').querySelector('input[data-pick="' + idea.dataset.idea + '"]'); if (pk && inp) { pk.caption = inp.value = addCaption(inp.value, idea.dataset.text); } return; }
      var b = ev.target.closest('button[data-drop]'); if (!b || T.busy) return; var p = T.picks.splice(+b.dataset.drop, 1)[0]; if (p) URL.revokeObjectURL(p.url); drawPicks(); });
    // a screenshot dropped anywhere on the desk, or pasted from the clipboard, lands in the form (a teacher's page only)
    var hasFiles = function (ev) { var t = ev.dataTransfer && ev.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; };
    if (view_) { ['dragenter', 'dragover'].forEach(function (n) { view_.addEventListener(n, function (ev) { if (!T.canTeach || !hasFiles(ev)) return; ev.preventDefault(); view_.classList.add('mo-over'); }); });
      view_.addEventListener('dragleave', function (ev) { if (!ev.relatedTarget || !view_.contains(ev.relatedTarget)) view_.classList.remove('mo-over'); });
      view_.addEventListener('drop', function (ev) { view_.classList.remove('mo-over'); if (!T.canTeach || !hasFiles(ev)) return; ev.preventDefault(); addFiles(ev.dataTransfer.files); }); }
    document.addEventListener('paste', function (ev) { var v = $('v-mosha'), fs = ev.clipboardData && ev.clipboardData.files; if (!v || v.hidden || !T.canTeach || !fs || !fs.length || document.querySelector('dialog[open]')) return; ev.preventDefault(); addFiles(fs); });
  }
  root.msMoshaTeach = function () { wire(); if (root.MS_MOSHA_I18N) root.MS_MOSHA_I18N.apply($('v-mosha')); if (!T.lessons) draw(); load(); };
  { var v0 = $('v-mosha'); if (v0 && !v0.hidden) root.msMoshaTeach(); }   // the desk was already open when this file ran
})(typeof window !== 'undefined' ? window : globalThis);
