// MeridianX Academy: the "Desk examples" section (window.MXAX), registered with MXAC.registerTab like the other sections.
//
// What it is (22 Nov 2026, owner: "put 4 trades examples for each one of the edges … into the academy, 2 loss 2 wins … i
// will guide you and write and do drawing on the same chart what u should had done"): for every reading of the Mosha and
// Engulfing desks, four stored paper trades (two that won, two that lost) on a chart with the record's own marks and log.
// The owner writes what should have been done, ticks a quick verdict and DRAWS on that chart (trend line, level, box,
// arrow, text). His note is saved on the server and can be copied as plain text, or the chart downloaded as a picture,
// for his assistant.
//
// Where things come from:
//   the examples   /cdata/academy/desk-examples.json, a generated file written by hand after a desk rebuild (never by
//                  the loop, so the set stays the same while he writes on it). Read only.
//   candles        /md/bars through MXR.load (assets/academy-replay.js), a window around the trade for each timeframe
//   his notes      /api/academy: GET ?get=example-notes, POST example.note with { id, text, chips, draw }
//
// Rules kept here: display and notes only. No rule, desk record or trade is changed by anything on this section, the
// examples are PICKED (two winners and two losers a reading), so they show what a reading did and never how often it
// wins. Nothing is kept in the browser: a note lives on the server or, until Save is pressed, in this page's memory.
// Shapes are stored as [UTC seconds, price] points, so a drawing stays in place on every timeframe.
//
// The pure helpers at the top are also loaded by Node (tests/academy-examples.test.mjs).
(function (root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports;
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);

  // ---- pure pieces -----------------------------------------------------------------------------------------------------
  const FILE = '/cdata/academy/desk-examples.json';
  const TFS = [['1m', 60, 'M1'], ['5m', 300, 'M5'], ['15m', 900, 'M15'], ['1h', 3600, 'H1'], ['4h', 14400, 'H4'], ['1d', 86400, 'D1']];
  const secOf = (tf) => (TFS.find((x) => x[0] === tf) || TFS[1])[1];
  const PRE = { '1m': 300, '5m': 300, '15m': 300, '1h': 300, '4h': 240, '1d': 200 };   // candles shown before the entry
  const MAX_BARS = 4500;                                                                // one window stays under the candle service's limit
  // the quick verdicts: the keys are the server's (api/academy.js EX_CHIPS), the words are the page's
  const CHIPS = [['entry-right', 'Entry was right'], ['wrong-side', 'Wrong side'], ['entry-early', 'Entry too early'], ['entry-late', 'Entry too late'], ['stop-wrong', 'Stop wrong'], ['target-wrong', 'Target wrong'], ['no-trade', 'Should not have been taken']];
  const TEXT_MAX = 2000, SHAPE_MAX = 60, SHAPE_TEXT = 120;
  const TOOLS = [['cur', 'Select'], ['t', 'Trend line'], ['h', 'Level'], ['r', 'Box'], ['a', 'Arrow'], ['x', 'Text']];
  const COLS = [['draw', 'Blue'], ['up', 'Green'], ['dn', 'Red'], ['gold', 'Amber'], ['ink', 'Ink']];
  const SHAPE_WORD = { t: 'Trend line', h: 'Level', r: 'Box', a: 'Arrow', x: 'Text' };
  const MARKETS = { xau: ['XAU/USD', 2], xag: ['XAG/USD', 3], eurusd: ['EUR/USD', 5], gbpusd: ['GBP/USD', 5], nas100: ['Nasdaq 100', 1] };
  const DESKS = { mosha: 'Mosha desk', eg: 'Engulfing desk' };

  const marketName = (m) => (MARKETS[m] ? MARKETS[m][0] : String(m || '').toUpperCase());
  const decOf = (m, v) => (MARKETS[m] ? MARKETS[m][1] : fin(v) && Math.abs(v) < 20 ? 5 : 2);
  const fmtPx = (v, m) => (fin(v) ? v.toFixed(decOf(m, v)) : 'n/a');
  const fmtR = (r) => (fin(r) ? (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2) + 'R' : 'n/a');
  const fmtT = (t) => (fin(t) ? new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'n/a');
  const fmtDay = (t) => (fin(t) ? new Date(t * 1000).toISOString().slice(0, 10) : 'n/a');
  const sideWord = (s) => (s < 0 ? 'Sell' : 'Buy');
  const outcomeWord = (ex) => (ex && ex.outcome === 'win' ? 'Win' : ex && ex.outcome === 'loss' ? 'Loss' : fin(ex && ex.R) ? (ex.R > 0 ? 'Win' : 'Loss') : 'n/a');
  const STATUS_WORD = { target: 'target reached', stopped: 'stopped', trail: 'closed by the trailed stop', time: 'closed at the time limit' };

  // the file as the page uses it: only groups with a key and usable examples (an id, a market, an entry time and price, a stop)
  function cleanFile(j) {
    const out = { at: j && typeof j.at === 'string' ? j.at : null, note: j && typeof j.note === 'string' ? j.note : '', groups: [] };
    for (const g of (j && Array.isArray(j.groups) ? j.groups : [])) {
      if (!g || typeof g.k !== 'string') continue;
      const ex = (Array.isArray(g.examples) ? g.examples : []).filter((e) => e && typeof e.id === 'string' && typeof e.market === 'string' && fin(e.t) && fin(e.entry) && fin(e.stop));
      if (ex.length) out.groups.push({ k: g.k, desk: g.desk === 'eg' ? 'eg' : 'mosha', title: String(g.title || g.k), examples: ex });
    }
    return out;
  }
  const findExample = (file, id) => { for (const g of (file ? file.groups : [])) for (const e of g.examples) if (e.id === id) return { group: g, ex: e }; return null; };

  // the candle window of an example on a timeframe: PRE candles before the entry, the whole trade, a margin after it.
  // A trade longer than one window can hold is cut at the end (cut: true); the entry always stays in.
  function windowFor(ex, tf) {
    const sec = secOf(tf), end = fin(ex.endT) && ex.endT > ex.t ? ex.endT : ex.t, from = Math.floor(ex.t / sec) * sec - PRE[tf] * sec;
    let to = Math.ceil(end / sec) * sec + Math.max(40 * sec, Math.round((end - ex.t) * 0.15));
    const cut = (to - from) / sec > MAX_BARS; if (cut) to = from + MAX_BARS * sec;
    return { from, to, sec, cut };
  }
  // the chart opens on M5; a trade too long for an M5 window opens on the first timeframe that holds all of it
  function defaultTf(ex) { for (const tf of ['5m', '15m', '1h', '4h', '1d']) if (!windowFor(ex, tf).cut) return tf; return '1d'; }
  // "Before": only the candles CLOSED at the entry
  const cutBefore = (bars, sec, t) => (Array.isArray(bars) ? bars.filter((b) => b.time + sec <= t) : []);
  // the record's marks as known at t (all of them when t is null); a mark needs its prices and a start time
  function marksAt(marks, t) {
    return (Array.isArray(marks) ? marks : []).filter((m) => m && fin(m.a) && (m.kind === 'level' ? fin(m.p) : fin(m.top) && fin(m.bot)) && (t == null || (fin(m.at) ? m.at : m.a) <= t));
  }
  // what a mark IS, read from its label (the desk chart's own rule): a failed zone, the entry zone, a CF, a VR, then the timeframe
  function hueKey(label) {
    const t = String(label || '');
    if (/\bEF\b|failed/i.test(t)) return 'ef'; if (/entry/i.test(t)) return 'entry'; if (/\bCF\b/.test(t)) return 'cf'; if (/\bVR\b/.test(t)) return 'vr'; if (/50\s?%/.test(t)) return 'half';
    if (/Daily|\bD1\b/.test(t)) return 'd1'; if (/\bH4\b/.test(t)) return 'h4'; if (/\bH1\b/.test(t)) return 'h1'; if (/\bM30\b/.test(t)) return 'm30'; if (/\bM15\b/.test(t)) return 'm15'; if (/\bM5\b/.test(t)) return 'm5'; if (/\bM1\b/.test(t)) return 'm1';
    if (/\bBO\b|level/i.test(t)) return 'bo'; return null;
  }
  const HUES = { ef: ['#c62828', '#ff6b6b'], entry: ['#1565c0', '#5aa7ff'], cf: ['#2e7d32', '#5ed08a'], vr: ['#d84315', '#ff9f5a'], bo: ['#6d4c41', '#d7b899'], half: ['#546074', '#a0aabe'],
    d1: ['#6a1b9a', '#c792ea'], h4: ['#b26a00', '#ffc857'], h1: ['#00796b', '#4dd0c4'], m30: ['#ad1457', '#ff7eb6'], m15: ['#ad1457', '#ff7eb6'], m5: ['#00838f', '#5fd3e6'], m1: ['#00838f', '#5fd3e6'] };

  // a drawing as the server takes it: the five shapes, finite points, whole seconds, a text's words on one line
  function cleanDraw(list) {
    const out = [];
    for (const d of (Array.isArray(list) ? list : [])) {
      if (!d || !SHAPE_WORD[d.type]) continue;
      const need = d.type === 'h' ? ['price'] : d.type === 'x' ? ['t1', 'p1'] : ['t1', 'p1', 't2', 'p2']; if (!need.every((k) => fin(d[k]))) continue;
      const o = { type: d.type }; for (const k of need) o[k] = k[0] === 't' ? Math.round(d[k]) : d[k];
      if (need.some((k) => k[0] === 't' && !(o[k] > 0))) continue;
      if (d.type === 'x') { const txt = typeof d.text === 'string' ? d.text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SHAPE_TEXT) : ''; if (!txt) continue; o.text = txt; }
      if (COLS.some((c) => c[0] === d.col) && d.col !== 'draw') o.col = d.col;
      if (d.w === 2 || d.w === 3) o.w = d.w; if (d.ls === 'dash') o.ls = 'dash';
      out.push(o); if (out.length >= SHAPE_MAX) break;
    }
    return out;
  }
  // a note as the page works on it (from a stored one, or empty)
  const noteOf = (n) => ({ text: n && typeof n.text === 'string' ? n.text : '', chips: n && Array.isArray(n.chips) ? n.chips.filter((c) => CHIPS.some((x) => x[0] === c)) : [], draw: cleanDraw(n && n.draw) });
  const hasNote = (n) => !!n && !!(String(n.text || '').trim() || (n.chips || []).length || (n.draw || []).length);
  const noteKey = (n) => { const x = noteOf(n); return JSON.stringify([x.text.trim(), x.chips.slice().sort(), x.draw]); };
  const sameNote = (a, b) => noteKey(a) === noteKey(b);

  // one drawing in words, for the assistant: its kind, its [UTC time, price] points, its text
  function shapeText(d, market) {
    const pt = (t, p) => `[${fmtT(t)}, ${fmtPx(p, market)}]`, col = d.col && d.col !== 'draw' ? ` (${(COLS.find((c) => c[0] === d.col) || ['', d.col])[1].toLowerCase()})` : '';
    if (d.type === 'h') return `Level${col} at ${fmtPx(d.price, market)}`;
    if (d.type === 'x') return `Text${col} "${d.text}" at ${pt(d.t1, d.p1)}`;
    if (d.type === 'r') return `Box${col} from ${pt(d.t1, Math.max(d.p1, d.p2))} to ${pt(d.t2, Math.min(d.p1, d.p2))}`;
    return `${SHAPE_WORD[d.type]}${col} from ${pt(d.t1, d.p1)} to ${pt(d.t2, d.p2)}`;
  }
  // one example with the owner's note as plain text
  function noteText(group, ex, note) {
    const n = noteOf(note), m = ex.market, L = [];
    L.push(`Desk example ${ex.id}`);
    L.push(`Reading: ${group ? group.title : 'n/a'} (${group ? DESKS[group.desk] || group.desk : 'n/a'})` + (ex.label ? ` · ${ex.label}` : ''));
    L.push(`Trade: ${sideWord(ex.side)} ${marketName(m)}, entry ${fmtPx(ex.entry, m)} at ${fmtT(ex.t)}, stop ${fmtPx(ex.stop, m)}, target ${fin(ex.target) ? fmtPx(ex.target, m) : 'none'}`);
    L.push(`Result: ${outcomeWord(ex)}, ${fmtR(ex.R)}` + (STATUS_WORD[ex.status] ? ` (${STATUS_WORD[ex.status]}${fin(ex.exit) ? ' at ' + fmtPx(ex.exit, m) : ''}${fin(ex.endT) ? ', ' + fmtT(ex.endT) : ''})` : ''));
    L.push('Quick verdict: ' + (n.chips.length ? n.chips.map((c) => (CHIPS.find((x) => x[0] === c) || [c, c])[1]).join('; ') : 'none'));
    L.push('What should have been done:'); L.push(n.text.trim() || '(nothing written)');
    if (n.draw.length) { L.push('Drawings on the chart (times in UTC, then the price):'); n.draw.forEach((d, i) => L.push(`${i + 1}. ${shapeText(d, m)}`)); } else L.push('Drawings on the chart: none');
    return L.join('\n');
  }
  // every example that has a note, in the file's order; notes whose example is no longer in the file come last, by id
  function allNotesText(file, notes) {
    const N = notes || {}, parts = [], seen = new Set();
    for (const g of (file ? file.groups : [])) for (const e of g.examples) if (hasNote(N[e.id])) { seen.add(e.id); parts.push(noteText(g, e, N[e.id])); }
    for (const id of Object.keys(N).sort()) if (!seen.has(id) && hasNote(N[id])) { const n = noteOf(N[id]); parts.push([`Desk example ${id} (no longer in the examples file)`, 'What should have been done:', n.text.trim() || '(nothing written)', n.draw.length ? `Drawings: ${n.draw.length}` : 'Drawings: none'].join('\n')); }
    return parts.length ? `${parts.length} desk example${parts.length === 1 ? '' : 's'} with my notes\n\n` + parts.join('\n\n----\n\n') : '';
  }
  // a failed save in words: nothing was lost, and what to do
  function saveFailure(e) {
    const s = e && e.status, tail = ' Nothing was lost: your note and drawings are still on this page.';
    if (s === 0) return 'Not saved: the Academy could not be reached. Check the connection, then press Try again.' + tail;
    if (s === 401 || s === 403) return 'Not saved: you are signed out. Sign in on the Desk in another tab, then press Try again.' + tail;
    if (s === 429) return 'Not saved: the server is limiting requests. Wait a minute, then press Try again.' + tail;
    if (s === 409 || s === 400 || s === 413) return `Not saved: ${(e && e.message) || 'the note was refused'}.` + tail;
    return 'Not saved: the store did not answer. Press Try again.' + tail;
  }
  const countNotes = (file, notes) => { let n = 0; for (const g of (file ? file.groups : [])) for (const e of g.examples) if (hasNote((notes || {})[e.id])) n++; return n; };

  const MXAX = { VERSION: '1.0.0', FILE, TFS, CHIPS, TOOLS, COLS, TEXT_MAX, SHAPE_MAX, PRE, MAX_BARS, secOf, cleanFile, findExample, windowFor, defaultTf, cutBefore, marksAt, hueKey, HUES, cleanDraw, noteOf, hasNote, sameNote, shapeText, noteText, allNotesText, saveFailure, countNotes,
    marketName, fmtPx, fmtR, fmtT, sideWord, outcomeWord };
  if (NODE) { module.exports = MXAX; return; }
  root.MXAX = MXAX;
  const MXAC = root.MXAC;
  if (typeof document === 'undefined' || !MXAC || typeof MXAC.registerTab !== 'function' || !MXAC.kit) return;

  // ---- the page --------------------------------------------------------------------------------------------------------
  const K = MXAC.kit, el = K.el, clear = K.clear, css = K.css, BT = () => root.BT;
  const S = { file: null, notes: null, sel: null, tf: '5m', before: false, work: noteOf(null), tool: 'cur', col: 'draw', pick: -1, bars: [], all: [], sec: 300, win: null, token: 0, saving: false, failed: false, words: '', api: null };
  const UI = {};   // the nodes built once (the chart must outlive a redraw of the section)
  let G = null;    // the gesture in hand: { kind: 'new' | 'move' | 'resize', … }
  const cur = () => (S.sel ? findExample(S.file, S.sel) : null);
  const dirty = () => !!S.sel && !!S.notes && !sameNote(S.work, S.notes[S.sel]);
  const say = (node, text) => { if (node) node.textContent = text || ''; };
  const isLight = () => { const m = /^#?([0-9a-f]{6})$/i.exec(css('--au-bg') || ''); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 140; };
  const inkOf = (c) => ({ draw: css('--au-accent') || '#5aa7ff', up: css('--au-gain') || '#4cc38a', dn: css('--au-loss') || '#f2726a', gold: css('--au-warn') || '#e8b04b', ink: css('--au-ink') || '#ececec' }[c || 'draw']);
  const alpha = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim()); if (!m) return hex; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // one question before a half-written note is left (the page's shared guard: the first press says so, a second one leaves)
  const leaveOk = K.leaveGuard({ unsaved: dirty, tell: () => say(UI.state, 'Your note on this example is not saved. Press Save, or choose again to leave it.') });
  K.watchUnsaved(dirty);

  // ---- reading ---------------------------------------------------------------------------------------------------------
  async function readFile() {
    let r; try { r = await fetch(FILE, { credentials: 'same-origin', cache: 'no-store' }); } catch (e) { throw Object.assign(new Error('the examples file could not be reached'), { kind: 'net' }); }
    if (r.status === 404) return null;
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('you are signed out'), { kind: 'auth' });
    if (!r.ok) throw Object.assign(new Error('the examples file answered ' + r.status), { kind: 'http' });
    let j; try { j = await r.json(); } catch (e) { throw Object.assign(new Error('the examples file is not readable'), { kind: 'parse' }); }
    return cleanFile(j);
  }
  async function render(sec, ctx) {
    S.api = ctx.api;
    if (!UI.root) build();
    if (UI.root.parentNode !== sec) { clear(sec); sec.appendChild(UI.root); }
    if (S.file && S.notes) { drawList(); return; }
    await load();
  }
  async function load() {
    clear(UI.list).appendChild(el('p', { class: 'ac-status', role: 'status', text: 'Reading the examples…' })); UI.main.hidden = true; UI.none.hidden = true;
    let file, notes;
    try { [file, notes] = await Promise.all([readFile(), S.api.get({ get: 'example-notes' })]); }
    catch (e) {
      clear(UI.list).appendChild(el('p', { class: 'ac-err', text: (e && e.kind === 'auth' ? 'The examples could not be read: you are signed out. Sign in on the Desk, then come back.' : `The examples could not be read: ${(e && e.message) || e}.`) }));
      UI.list.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', text: 'Try again', onclick: load })));
      return;
    }
    S.notes = notes && notes.notes && typeof notes.notes === 'object' ? notes.notes : {};
    S.file = file || { at: null, note: '', groups: [] };
    if (S.sel && !cur()) S.sel = null;
    drawList();
  }

  // ---- the list --------------------------------------------------------------------------------------------------------
  function drawList() {
    const box = clear(UI.list), F = S.file;
    if (!F.groups.length) {
      box.appendChild(el('div', { class: 'ac-empty', id: 'ex-empty' }, el('p', { text: 'No examples yet: they are written after the next desk rebuild.' }), el('p', { class: 'note', text: 'Each reading of the Mosha and Engulfing desks will show four stored paper trades here, two that won and two that lost, for you to write and draw on.' })));
      UI.main.hidden = true; UI.none.hidden = true; UI.wrap.classList.remove('ex-open'); return;
    }
    const n = countNotes(F, S.notes), total = F.groups.reduce((s, g) => s + g.examples.length, 0);
    box.appendChild(el('p', { class: 'note', id: 'ex-count', text: `${total} examples in ${F.groups.length} readings · your notes on ${n}` + (F.at ? ` · picked ${String(F.at).slice(0, 10)}` : '') }));
    for (const desk of ['mosha', 'eg']) {
      const gs = F.groups.filter((g) => g.desk === desk); if (!gs.length) continue;
      box.appendChild(el('h3', { class: 'ex-desk', text: DESKS[desk] }));
      for (const g of gs) {
        const mine = g.examples.filter((e) => hasNote(S.notes[e.id])).length, open = g.examples.some((e) => e.id === S.sel);
        const d = el('details', { class: 'ex-g', 'data-g': g.k, open }, el('summary', {}, el('span', { class: 'ex-g-t', text: g.title }), el('small', { text: mine ? `${mine} of ${g.examples.length} with your notes` : `${g.examples.length} examples` })));
        const ul = el('ul', { class: 'ex-rows' });
        for (const e of g.examples) {
          const win = outcomeWord(e) === 'Win';
          ul.appendChild(el('li', {}, el('button', { type: 'button', class: 'ex-row', 'data-id': e.id, 'aria-pressed': e.id === S.sel ? 'true' : 'false', onclick: () => choose(e.id) },
            el('span', { class: 'tag ' + (win ? 'ok' : 'bad'), text: outcomeWord(e) }),
            el('span', { class: 'ex-row-m' }, el('b', { text: marketName(e.market) }), ' ' + sideWord(e.side)),
            el('span', { class: 'ex-row-r', text: fmtR(e.R) }),
            el('span', { class: 'ex-row-d', text: fmtDay(e.t) }),
            hasNote(S.notes[e.id]) ? el('span', { class: 'ex-row-n', text: 'your notes' }) : null)));
        }
        d.appendChild(ul); box.appendChild(d);
      }
    }
    if (F.note) box.appendChild(el('p', { class: 'note', text: F.note }));
    box.appendChild(el('div', { class: 'f-actions' },
      el('button', { type: 'button', class: 'btn sm', id: 'ex-copy-all', text: 'Copy all my notes', disabled: !n && !dirty(), onclick: copyAll }),
      el('button', { type: 'button', class: 'btn sm', id: 'ex-reload', text: 'Read again', onclick: () => { if (!leaveOk()) return; S.file = null; S.notes = null; load(); } }),
      (UI.listMsg = el('span', { class: 'ac-status', role: 'status', 'aria-live': 'polite' }))));
    box.appendChild((UI.outAll = el('textarea', { class: 'ex-out', id: 'ex-out-all', rows: '8', readonly: true, hidden: true, 'aria-label': 'The text to copy' })));
    UI.main.hidden = !S.sel; UI.none.hidden = !!S.sel; UI.wrap.classList.toggle('ex-open', !!S.sel);
    if (S.sel) drawMain(false);
  }
  function choose(id) {
    if (id === S.sel) { K.showNode(UI.main); return; }
    if (!leaveOk()) return;
    const f = findExample(S.file, id); if (!f) return;
    S.sel = id; S.work = noteOf(S.notes[id]); S.pick = -1; S.tool = 'cur'; S.before = false; S.tf = defaultTf(f.ex); S.failed = false; S.words = ''; G = null; leaveOk.reset();
    drawList(); drawMain(true); K.showNode(UI.main);
  }
  function back() { if (!leaveOk()) return; S.sel = null; G = null; drawList(); const t = document.getElementById('tab-examples'); if (t) t.scrollIntoView({ block: 'start' }); }

  // ---- the section, built once -----------------------------------------------------------------------------------------
  function seg(id, label, items, onpick) {
    const box = el('span', { class: 'seg inline ex-seg', id, role: 'group', 'aria-label': label });
    for (const [v, text, title] of items) box.appendChild(el('button', { type: 'button', class: 'btn sm', 'data-v': v, 'aria-pressed': 'false', title: title || null, text, onclick: () => onpick(v) }));
    return box;
  }
  const press = (box, v) => box.querySelectorAll('button[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  function build() {
    UI.list = el('div', { class: 'card ex-list', id: 'ex-list' });
    UI.none = el('div', { class: 'card ex-none', id: 'ex-pick' }, el('h2', { class: 'c-h' }, 'Desk examples', el('small', { text: 'four stored trades a reading: two that won, two that lost' })),
      el('p', { text: 'Choose an example in the list. It opens on a chart with what the desk saw. Then write what should have been done and draw it on the same chart: your note is saved, and you can copy it or download the chart for your assistant.' }),
      el('p', { class: 'note', text: 'Paper records, picked as examples: they show what a reading did, never how often it wins. Nothing here changes a rule, a desk record or a trade.' }));
    UI.title = el('b', { id: 'ex-title' }); UI.sub = el('span', { class: 'chart-meta', id: 'ex-sub' });
    UI.facts = el('dl', { class: 'kv lvl ex-facts', id: 'ex-facts' });
    UI.tf = seg('ex-tf', 'Timeframe', TFS.map((t) => [t[0], t[2]]), (v) => { if (v === S.tf) return; S.tf = v; drawMain(true); });
    UI.ba = seg('ex-ba', 'Before or after the entry', [['0', 'After', 'The whole trade'], ['1', 'Before', 'Only the candles closed at the entry']], (v) => { S.before = v === '1'; showBars(true); drawLog(); syncBars(); });
    UI.tools = seg('ex-tools', 'Drawing tools', TOOLS.map((t) => [t[0], t[1]]), setTool);
    UI.cols = el('span', { class: 'ex-cols', id: 'ex-cols', role: 'group', 'aria-label': 'Colour' });
    for (const [c, name] of COLS) UI.cols.appendChild(el('button', { type: 'button', class: 'ex-col', 'data-v': c, 'aria-label': name, title: name, 'aria-pressed': 'false', onclick: () => setCol(c) }));
    UI.words = el('input', { type: 'text', id: 'ex-words', maxlength: String(SHAPE_TEXT), placeholder: 'Words to put on the chart', 'aria-label': 'Words to put on the chart', oninput: (e) => wordsIn(e.target.value) });
    UI.wordsRow = el('label', { class: 'ex-words', hidden: true }, UI.words);
    UI.del = el('button', { type: 'button', class: 'btn sm danger', id: 'ex-del', text: 'Delete', disabled: true, onclick: delPick });
    UI.wipe = el('button', { type: 'button', class: 'btn sm', id: 'ex-wipe', text: 'Remove all drawings', disabled: true, onclick: wipe });
    UI.hint = el('span', { class: 'ac-status', id: 'ex-hint', role: 'status', 'aria-live': 'polite' });
    UI.host = el('div', { class: 'chart ex-chart', id: 'ex-chart' }); UI.cv = el('canvas', { class: 'ex-ov', id: 'ex-ov', 'aria-hidden': 'true' });
    UI.load = el('p', { class: 'ac-status ex-load', id: 'ex-load', role: 'status', 'aria-live': 'polite' });
    UI.log = el('ol', { class: 'ex-log', id: 'ex-log' });
    UI.chips = el('div', { class: 'chips', id: 'ex-chips', role: 'group', 'aria-label': 'Quick verdict' });
    for (const [k, text] of CHIPS) UI.chips.appendChild(el('button', { type: 'button', class: 'chip', 'data-v': k, 'aria-pressed': 'false', text, onclick: () => { const i = S.work.chips.indexOf(k); if (i >= 0) S.work.chips.splice(i, 1); else S.work.chips.push(k); syncNote(); } }));
    UI.text = el('textarea', { id: 'ex-text', rows: '6', maxlength: String(TEXT_MAX), placeholder: 'In your own words: what should have been done here, and why.', oninput: (e) => { S.work.text = e.target.value; syncNote(true); } });
    UI.count = el('small', { class: 'note', id: 'ex-len' });
    UI.save = el('button', { type: 'button', class: 'btn primary', id: 'ex-save', text: 'Save', onclick: save });
    UI.state = el('span', { class: 'ac-status', id: 'ex-state', role: 'status', 'aria-live': 'polite' });
    UI.copy = el('button', { type: 'button', class: 'btn', id: 'ex-copy', text: 'Copy for the assistant', onclick: copyOne });
    UI.png = el('button', { type: 'button', class: 'btn', id: 'ex-png', text: 'Download chart image', onclick: download });
    UI.out = el('textarea', { class: 'ex-out', id: 'ex-out', rows: '8', readonly: true, hidden: true, 'aria-label': 'The text to copy' });
    UI.main = el('div', { class: 'ex-main', id: 'ex-main', hidden: true },
      el('div', { class: 'card chart-card' },
        el('button', { type: 'button', class: 'btn sm ex-back', id: 'ex-back', text: 'Back to the list', onclick: back }),
        el('div', { class: 'chart-head' }, UI.title, UI.sub),
        UI.facts,
        el('div', { class: 'ex-bar' }, UI.tf, UI.ba),
        el('div', { class: 'ex-bar ex-bar-draw' }, UI.tools, UI.cols, UI.wordsRow, UI.del, UI.wipe),
        UI.hint,
        el('div', { class: 'chart-wrap ex-wrap-chart' }, UI.host, UI.cv),
        UI.load,
        el('h3', { text: 'What the desk saw, step by step' }), UI.log),
      el('div', { class: 'card ex-note', id: 'ex-note' },
        el('h2', { class: 'c-h' }, 'What should have been done', el('small', { text: 'your words and your drawings are saved together' })),
        el('p', { class: 'note', text: 'Quick verdict (optional)' }), UI.chips,
        el('label', { class: 'f ex-text' }, el('span', { text: 'Your note' }), UI.text), UI.count,
        el('div', { class: 'f-actions' }, UI.save, UI.state),
        el('div', { class: 'f-actions ex-share' }, UI.copy, UI.png),
        UI.out));
    UI.side = el('div', { class: 'ex-side' }, UI.list);
    UI.wrap = el('div', { class: 'ex-wrap', id: 'ex-wrap' }, UI.side, el('div', { class: 'ex-col-main' }, UI.none, UI.main));
    UI.root = UI.wrap;
    wire();
  }

  // ---- the chart -------------------------------------------------------------------------------------------------------
  function ensureChart() {
    if (UI.c) return true;
    try { UI.c = K.newChart(UI.host); } catch (e) { say(UI.load, 'The chart could not be drawn: ' + e.message + '.'); return false; }
    const s = UI.c.series;
    s.applyOptions({ autoscaleInfoProvider: (orig) => { const r = orig(); const f = cur(); if (!r || !r.priceRange || !f) return r; const v = [f.ex.entry, f.ex.stop].concat(fin(f.ex.target) ? [f.ex.target] : [], !S.before && fin(f.ex.exit) ? [f.ex.exit] : []);
      return { priceRange: { minValue: Math.min(r.priceRange.minValue, ...v), maxValue: Math.max(r.priceRange.maxValue, ...v) }, margins: r.margins }; } });
    UI.c.chart.timeScale().subscribeVisibleLogicalRangeChange(paint);
    // the overlay follows the candles on every move: a drag of the price axis changes no time range, so each frame, while the
    // chart is on screen, where the scale puts two prices is compared with the frame before
    let last = '';
    (function tick() { if (UI.host.offsetParent !== null && S.bars.length) { let k = ''; try { const b0 = S.bars[0], lr = UI.c.chart.timeScale().getVisibleLogicalRange(); k = (lr ? lr.from + ':' + lr.to : '') + '|' + s.priceToCoordinate(b0.low) + '|' + s.priceToCoordinate(b0.high) + '|' + UI.host.clientWidth + 'x' + UI.host.clientHeight; } catch (e) { /* not drawn yet */ } if (k !== last) { last = k; paint(); } } root.requestAnimationFrame(tick); })();
    const mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: light)') : null; if (mq && mq.addEventListener) mq.addEventListener('change', () => { priceFormat(); paint(); });
    return true;
  }
  function priceFormat() { const f = cur(); if (!f || !UI.c) return; const d = decOf(f.ex.market, f.ex.entry); UI.c.series.applyOptions({ priceFormat: { type: 'price', precision: d, minMove: Math.pow(10, -d) } }); }
  const free = (on) => { try { UI.c.chart.applyOptions(on ? { handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true } : { handleScroll: false, handleScale: false }); } catch (e) { /* no chart */ } };

  function drawMain(reload) {
    const f = cur(); if (!f) return; const ex = f.ex, m = ex.market;
    UI.main.hidden = false; UI.none.hidden = true;
    say(UI.title, `${outcomeWord(ex)} · ${sideWord(ex.side)} ${marketName(m)} · ${fmtR(ex.R)}`);
    say(UI.sub, `${f.group.title} · ${DESKS[f.group.desk]}` + (ex.label ? ` · ${ex.label}` : ''));
    clear(UI.facts);
    for (const [k, v] of [['Entry', fmtPx(ex.entry, m)], ['Stop', fmtPx(ex.stop, m)], ['Target', fin(ex.target) ? fmtPx(ex.target, m) : 'none'], ['Result', fmtR(ex.R) + (STATUS_WORD[ex.status] ? ', ' + STATUS_WORD[ex.status] : '')]]) { UI.facts.appendChild(el('dt', { text: k })); UI.facts.appendChild(el('dd', { text: v })); }
    press(UI.tf, S.tf); press(UI.ba, S.before ? '1' : '0'); syncTools(); syncNote(); drawLog();
    UI.text.value = S.work.text; UI.out.hidden = true;
    if (reload) loadBars();
  }
  async function loadBars() {
    const f = cur(); if (!f || !ensureChart()) return;
    const my = ++S.token, w = windowFor(f.ex, S.tf); S.win = w; S.sec = w.sec;
    say(UI.load, 'Loading candles…');
    let bars;
    try { bars = await root.MXR.load({ sym: f.ex.market, tf: S.tf, from: w.from, to: w.to }); }
    catch (e) { if (my !== S.token) return; S.all = []; S.bars = []; UI.c.setBars([]); UI.c.clearLines(); paint(); say(UI.load, `The candles could not be loaded: ${(e && e.message) || e}. Your note and drawings are kept: choose the timeframe again to retry.`); return; }
    if (my !== S.token) return;
    S.all = Array.from(bars || []);
    showBars(true); syncBars();
  }
  function syncBars() {
    const f = cur(); if (!f) return;
    if (!S.all.length) { say(UI.load, 'No candles came back for this window: the market may have been closed. Try another timeframe.'); return; }
    say(UI.load, (S.before ? 'Before: only the candles closed at the entry. ' : '') + (S.win && S.win.cut && !S.before ? `This trade is longer than one ${(TFS.find((t) => t[0] === S.tf) || [])[2]} chart can hold: its end is on a higher timeframe.` : ''));
  }
  function showBars(fit) {
    const f = cur(); if (!f || !UI.c) return; const ex = f.ex, m = ex.market;
    S.bars = S.before ? cutBefore(S.all, S.sec, ex.t) : S.all;
    priceFormat(); UI.c.setBars(S.bars); UI.c.clearLines();
    const up = css('--ac-up') || css('--buy'), dn = css('--ac-down') || css('--sell'), ink = css('--au-ink-2') || css('--ink-dim');
    UI.c.line(ex.entry, 'Entry', ink, true); UI.c.line(ex.stop, 'Stop', dn, false); if (fin(ex.target)) UI.c.line(ex.target, 'Target', up, false);
    // the entry and the exit as markers on their candles
    const at = (t) => { let k = -1; for (let i = 0; i < S.bars.length; i++) { if (S.bars[i].time <= t) k = i; else break; } return k >= 0 && t < S.bars[k].time + S.sec ? S.bars[k].time : null; };
    const mk = [], te = at(ex.t), tx = !S.before && fin(ex.endT) ? at(ex.endT) : null, buy = !(ex.side < 0);
    if (te != null) mk.push({ time: te, position: buy ? 'belowBar' : 'aboveBar', shape: buy ? 'arrowUp' : 'arrowDown', color: ink, text: sideWord(ex.side) });
    if (tx != null) mk.push({ time: tx, position: buy ? 'aboveBar' : 'belowBar', shape: 'circle', color: ex.R > 0 ? up : dn, text: 'Exit ' + fmtR(ex.R) });
    mk.sort((a, b) => a.time - b.time); try { UI.c.series.setMarkers(mk); } catch (e) { /* markers are an extra */ }
    if (fit && S.bars.length) {
      const B = BT(), n = S.bars.length, a = B.tfLogical(S.bars, n, S.sec, ex.t), b = B.tfLogical(S.bars, n, S.sec, fin(ex.endT) ? ex.endT : ex.t);
      const from = S.before ? n - 140 : Math.max(-2, a - 110), to = S.before ? n + 8 : Math.max(b + 14, a + 40);
      try { UI.c.chart.timeScale().setVisibleLogicalRange({ from, to }); } catch (e) { UI.c.fit(); }
    }
    paint();
  }
  function drawLog() {
    const f = cur(); if (!f) return; const rows = (Array.isArray(f.ex.log) ? f.ex.log : []).filter((x) => x && x.text && (!S.before || !fin(x.t) || x.t <= f.ex.t));
    clear(UI.log);
    if (!rows.length) { UI.log.appendChild(el('li', { class: 'none', text: 'This record carries no log.' })); return; }
    for (const x of rows) UI.log.appendChild(el('li', {}, el('small', { text: fin(x.t) ? fmtT(x.t) : '' }), el('span', { text: String(x.text) })));
  }

  // ---- geometry --------------------------------------------------------------------------------------------------------
  // The chart library places whole candle indexes only, so a time inside a candle is placed between its neighbours.
  const l2x = (lg) => { const ts = UI.c.chart.timeScale(), k = Math.floor(lg), a = ts.logicalToCoordinate(k), b = ts.logicalToCoordinate(k + 1); return a == null || b == null ? null : a + (lg - k) * (b - a); };
  const x2l = (x) => { const ts = UI.c.chart.timeScale(), k = ts.coordinateToLogical(x); if (k == null) return null; const a = ts.logicalToCoordinate(k), b = ts.logicalToCoordinate(k + 1); return a == null || b == null || b === a ? k : k + (x - a) / (b - a); };
  const X = (t) => { if (!S.bars.length) return null; const lg = BT().tfLogical(S.bars, S.bars.length, S.sec, t); return lg == null ? null : l2x(lg); };
  const Y = (p) => { const v = UI.c.series.priceToCoordinate(p); return v == null ? null : v; };
  const T = (x) => { if (!S.bars.length) return null; const lg = x2l(x); return lg == null ? null : BT().tfTimeAt(S.bars, S.bars.length, S.sec, lg); };
  const P = (y) => { const v = UI.c.series.coordinateToPrice(y); return v == null ? null : v; };
  const plot = () => { const ts = UI.c.chart.timeScale(); return { W: ts.width(), H: UI.host.clientHeight - ts.height() }; };
  const geo = (d) => { const p = plot(); return BT().drawGeom(d, X, Y, p.W, p.H); };

  // ---- painting --------------------------------------------------------------------------------------------------------
  function paint() {
    const cv = UI.cv, host = UI.host; if (!UI.c || !cv) return;
    const dpr = Math.min(root.devicePixelRatio || 1, 2), W = host.clientWidth, H = host.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const f = cur(); if (!f || !S.bars.length) return;
    const pl = plot(), light = isLight(), plate = css('--au-surface') || (light ? '#ffffff' : '#1a1c1f'), sans = css('--au-font-ui') || css('--sans') || 'system-ui, sans-serif';
    x.save(); x.beginPath(); x.rect(0, 0, pl.W, pl.H); x.clip(); x.textBaseline = 'middle'; x.font = '600 12px ' + sans;
    const placed = [];
    const tag = (txt, px, py, col) => {
      const w = x.measureText(txt).width + 10; px = Math.max(2, Math.min(px, pl.W - w - 2)); py = Math.max(10, Math.min(py, pl.H - 10));
      const hit = (yy) => placed.some((q) => px < q.x + q.w + 2 && px + w + 2 > q.x && Math.abs(yy - q.y) < 19);
      if (hit(py)) for (let k = 1; k <= 8; k++) { const yy = py + Math.ceil(k / 2) * 20 * (k % 2 ? 1 : -1); if (yy >= 10 && yy <= pl.H - 10 && !hit(yy)) { py = yy; break; } }
      placed.push({ x: px, y: py, w }); x.globalAlpha = .88; x.fillStyle = plate; x.fillRect(px, py - 9, w, 18); x.globalAlpha = 1; x.fillStyle = col; x.fillText(txt, px + 5, py + .5);
    };
    // the record's own marks: zones as boxes, levels as lines, each named, coloured by what it is
    const ex = f.ex, base = css('--au-ink-2') || '#b4b8bf', edge = { up: 0, dn: 0 }, narrow = pl.W < 520;
    for (const m of marksAt(ex.marks, S.before ? ex.t : null)) {
      const h = HUES[hueKey(m.label)], col = h ? h[light ? 0 : 1] : base, label = String(m.label || (m.kind === 'level' ? 'Level' : 'Zone'));
      let x1 = X(m.a); if (x1 == null) continue; x1 = Math.max(0, x1); const x2 = pl.W;
      const yA = Y(m.kind === 'level' ? m.p : m.top), yB = Y(m.kind === 'level' ? m.p : m.bot); if (yA == null || yB == null) continue;
      if (Math.max(yA, yB) < 0 || Math.min(yA, yB) > pl.H) { const up = Math.max(yA, yB) < 0, n = up ? edge.up++ : edge.dn++; if (n < (narrow ? 1 : 3)) tag((up ? '▲ ' : '▼ ') + label + ' ' + (m.kind === 'level' ? fmtPx(m.p, ex.market) : fmtPx(m.bot, ex.market) + ' – ' + fmtPx(m.top, ex.market)), 6, up ? 12 + n * 20 : pl.H - 12 - n * 20, col); continue; }
      if (m.kind === 'level') { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(x1, yA); x.lineTo(x2, yA); x.stroke(); tag(label, x1 + 4, yA + (m.under ? 12 : -12), col); continue; }
      x.fillStyle = alpha(col, .16); x.fillRect(x1, yA, x2 - x1, yB - yA); x.strokeStyle = alpha(col, .7); x.lineWidth = 1; x.strokeRect(x1 + .5, Math.min(yA, yB) + .5, x2 - x1 - 1, Math.abs(yB - yA) - 1);
      x.fillStyle = alpha(col, .8); x.fillRect(x1, Math.min(yA, yB), 2, Math.abs(yB - yA)); tag(label, x1 + 6, (yA + yB) / 2, col);
    }
    // the position: from the entry to the exit, the risk in red and the way to the target in green
    { const a = X(ex.t), b = S.before ? (a == null ? null : a + 90) : X(fin(ex.endT) ? ex.endT : ex.t), ye = Y(ex.entry), ys = Y(ex.stop), yg = fin(ex.target) ? Y(ex.target) : null;
      if (a != null && b != null && ye != null && ys != null) { const bb = Math.max(b, a + 6); x.fillStyle = alpha(css('--ac-down') || '#f2576f', .13); x.fillRect(a, Math.min(ye, ys), bb - a, Math.abs(ys - ye)); if (yg != null) { x.fillStyle = alpha(css('--ac-up') || '#2fbf8f', .11); x.fillRect(a, Math.min(ye, yg), bb - a, Math.abs(yg - ye)); } } }
    // the owner's drawings, then the one being placed
    S.work.draw.forEach((d, i) => shape(x, d, i === S.pick, sans, plate));
    if (G && G.kind === 'new' && G.d) shape(x, G.d, false, sans, plate, true);
    x.restore();
  }
  function shape(x, d, picked, sans, plate, ghost) {
    const g = geo(d); if (!g) return; const col = inkOf(d.col), w = d.w || 2;
    x.save(); x.globalAlpha = ghost ? .7 : 1; x.strokeStyle = col; x.fillStyle = col; x.lineWidth = picked ? w + 1 : w; x.lineCap = 'round'; x.setLineDash(d.ls === 'dash' ? [6, 5] : []);
    if (d.type === 'r') { x.fillStyle = alpha(col, .14); x.fillRect(g.x1, g.y1, g.x2 - g.x1, g.y2 - g.y1); x.strokeRect(g.x1, g.y1, g.x2 - g.x1, g.y2 - g.y1); }
    else if (d.type === 'x') { x.font = `600 ${g.fs}px ${sans}`; const tw = x.measureText(d.text).width; g.x2 = g.x1 + tw + 8; x.globalAlpha = .88; x.fillStyle = plate; x.fillRect(g.x1 - 2, g.y2, tw + 10, g.y1 - g.y2); x.globalAlpha = 1; x.fillStyle = col; x.textBaseline = 'middle'; x.fillText(d.text, g.x1 + 3, (g.y1 + g.y2) / 2 + .5); if (picked) { x.lineWidth = 1; x.strokeRect(g.x1 - 2.5, g.y2 - .5, tw + 11, g.y1 - g.y2 + 1); } }
    else { x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(g.x2, g.y2); x.stroke();
      if (d.type === 'a') { const an = Math.atan2(g.y2 - g.y1, g.x2 - g.x1), L = 11 + w; x.setLineDash([]); x.beginPath(); x.moveTo(g.x2, g.y2); x.lineTo(g.x2 - L * Math.cos(an - .45), g.y2 - L * Math.sin(an - .45)); x.lineTo(g.x2 - L * Math.cos(an + .45), g.y2 - L * Math.sin(an + .45)); x.closePath(); x.fill(); }
      if (d.type === 'h') { const f = cur(), txt = fmtPx(d.price, f ? f.ex.market : null); x.font = '600 12px ' + sans; x.textBaseline = 'middle'; const tw = x.measureText(txt).width + 10; x.setLineDash([]); x.globalAlpha = .9; x.fillStyle = plate; x.fillRect(g.x2 - tw - 4, g.y1 - 9, tw, 18); x.globalAlpha = 1; x.fillStyle = col; x.fillText(txt, g.x2 - tw + 1, g.y1 + .5); } }
    if (picked) { x.setLineDash([]); x.lineWidth = 2; for (const [, px, py] of g.pts) { x.beginPath(); x.arc(px, py, 5, 0, 7); x.fillStyle = plate; x.fill(); x.strokeStyle = col; x.stroke(); } }
    x.restore();
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------------
  const HINT = { cur: '', t: 'Press where the line starts and drag to where it ends.', h: 'Press the chart at the price of the level.', r: 'Press one corner of the box and drag to the other.', a: 'Press where the arrow starts and drag to its point.', x: 'Type the words, then press the chart where they go.' };
  function setTool(v) { S.tool = v; G = null; if (v !== 'cur') S.pick = -1; syncTools(); paint(); if (v === 'x') UI.words.focus(); }
  function setCol(c) { S.col = c; if (S.pick >= 0 && S.work.draw[S.pick]) { const d = { ...S.work.draw[S.pick] }; if (c === 'draw') delete d.col; else d.col = c; S.work.draw[S.pick] = d; syncNote(); } syncTools(); paint(); }
  function wordsIn(v) { S.words = v; const d = S.work.draw[S.pick]; if (S.tool === 'cur' && d && d.type === 'x') { const t = v.replace(/\s+/g, ' ').trim().slice(0, SHAPE_TEXT); if (t) { S.work.draw[S.pick] = { ...d, text: t }; syncNote(true); paint(); } } }
  function delPick() { if (S.pick < 0) return; S.work.draw.splice(S.pick, 1); S.pick = -1; syncTools(); syncNote(); paint(); }
  function wipe() { if (!S.work.draw.length) return; if (UI.wipe.dataset.sure !== '1') { UI.wipe.dataset.sure = '1'; UI.wipe.textContent = 'Press again to remove all'; root.setTimeout(() => { UI.wipe.dataset.sure = ''; UI.wipe.textContent = 'Remove all drawings'; }, 4000); return; } UI.wipe.dataset.sure = ''; UI.wipe.textContent = 'Remove all drawings'; S.work.draw = []; S.pick = -1; syncTools(); syncNote(); paint(); }
  function syncTools() {
    press(UI.tools, S.tool); const d = S.work.draw[S.pick], isText = !!d && d.type === 'x';
    UI.cols.querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.v === (d ? d.col || 'draw' : S.col))); b.style.setProperty('--c', inkOf(b.dataset.v)); });
    UI.wordsRow.hidden = !(S.tool === 'x' || isText); if (isText && document.activeElement !== UI.words) UI.words.value = d.text; else if (S.tool === 'x' && document.activeElement !== UI.words) UI.words.value = S.words;
    UI.del.disabled = S.pick < 0; UI.wipe.disabled = !S.work.draw.length;
    UI.host.classList.toggle('arm', S.tool !== 'cur' || S.pick >= 0); UI.host.dataset.tool = S.tool;
    say(UI.hint, S.work.draw.length >= SHAPE_MAX && S.tool !== 'cur' ? `${SHAPE_MAX} drawings at most on one example: delete one first.` : HINT[S.tool] || (S.pick >= 0 ? 'Drag it to move, drag a round handle to resize, or press Delete.' : ''));
    if (UI.c) free(S.tool === 'cur' && !G);
  }
  function hitAt(px, py, coarse) {
    const tol = coarse ? 14 : 6, hTol = coarse ? 22 : 8, order = S.work.draw.map((d, i) => i).reverse(); if (S.pick >= 0) { order.splice(order.indexOf(S.pick), 1); order.unshift(S.pick); }
    for (const i of order) { const d = S.work.draw[i], g = geo(d); if (!g) continue; if (d.type === 'x') { const c = UI.cv.getContext('2d'); c.save(); c.font = `600 ${g.fs}px sans-serif`; g.x2 = g.x1 + c.measureText(d.text).width + 8; c.restore(); }
      const part = BT().drawHit(i === S.pick ? g : { ...g, pts: [] }, px, py, tol, hTol); if (part) return { i, part }; }
    return null;
  }
  function wire() {
    const host = UI.host, at = (e) => { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const inPlot = (p) => { const pl = plot(); return p.x >= 0 && p.y >= 0 && p.x <= pl.W && p.y <= pl.H; };
    const finish = (d) => { const c = cleanDraw([d])[0]; G = null; if (c && S.work.draw.length < SHAPE_MAX) { S.work.draw.push(c); S.pick = S.work.draw.length - 1; } S.tool = 'cur'; syncTools(); syncNote(); paint(); };
    host.addEventListener('pointerdown', (e) => {
      if (!UI.c || !S.bars.length || !BT() || (e.button != null && e.button > 0)) return;
      const p = at(e), coarse = e.pointerType === 'touch'; if (!inPlot(p)) return;
      const t = T(p.x), pr = P(p.y); if (t == null || pr == null) return;
      if (G && G.kind === 'new' && G.sticky) { e.preventDefault(); finish({ ...G.d, t2: t, p2: pr }); return; }   // the second click of a two-click shape
      if (S.tool === 'cur') {
        const h = hitAt(p.x, p.y, coarse);
        if (!h) { if (S.pick >= 0) { S.pick = -1; syncTools(); paint(); } return; }
        S.pick = h.i; G = { kind: h.part === 'body' ? 'move' : 'resize', part: h.part, x0: p.x, y0: p.y, orig: { ...S.work.draw[h.i] }, moved: false };
        free(false); syncTools(); paint(); e.preventDefault(); try { host.setPointerCapture(e.pointerId); } catch (x) { /* not capturable */ } return;
      }
      if (S.work.draw.length >= SHAPE_MAX) { syncTools(); return; }
      e.preventDefault(); const col = S.col === 'draw' ? {} : { col: S.col };
      if (S.tool === 'h') { finish({ type: 'h', price: pr, ...col }); return; }
      if (S.tool === 'x') { const words = String(S.words || UI.words.value || '').replace(/\s+/g, ' ').trim(); if (!words) { say(UI.hint, 'Type the words first, then press the chart where they go.'); UI.words.focus(); return; } finish({ type: 'x', t1: t, p1: pr, text: words, ...col }); S.words = ''; return; }
      G = { kind: 'new', x0: p.x, y0: p.y, d: { type: S.tool, t1: t, p1: pr, t2: t, p2: pr, ...col }, moved: false };
      try { host.setPointerCapture(e.pointerId); } catch (x) { /* not capturable */ } paint();
    }, true);
    host.addEventListener('pointermove', (e) => {
      if (!UI.c || !S.bars.length) return; const p = at(e);
      if (!G) { if (S.tool === 'cur') { const h = S.work.draw.length ? hitAt(p.x, p.y, false) : null; host.dataset.cur = h ? (h.part === 'body' ? 'move' : 'grab') : ''; } return; }
      const t = T(p.x), pr = P(p.y); if (t == null || pr == null) return;
      if (Math.hypot(p.x - G.x0, p.y - G.y0) > 4) G.moved = true;
      if (G.kind === 'new') G.d = { ...G.d, t2: t, p2: pr };
      else if (!G.moved) return;
      else if (G.kind === 'resize') S.work.draw[S.pick] = BT().drawResize(G.orig, G.part, t, pr);
      else { const dx = p.x - G.x0, dy = p.y - G.y0; S.work.draw[S.pick] = BT().drawMove(G.orig, (tt) => { const xx = X(tt), v = xx == null ? null : T(xx + dx); return v == null ? tt : v; }, (pp) => { const yy = Y(pp), v = yy == null ? null : P(yy + dy); return v == null ? pp : v; }); }
      paint();
    }, true);
    const up = (e) => {
      if (!G) return;
      if (G.kind === 'new') { if (G.sticky) return; if (!G.moved) { G.sticky = true; say(UI.hint, 'Now press where it ends.'); return; } finish(G.d); return; }
      const moved = G.moved; G = null; if (moved) { const c = cleanDraw([S.work.draw[S.pick]])[0]; if (c) S.work.draw[S.pick] = c; else { S.work.draw.splice(S.pick, 1); S.pick = -1; } syncNote(); }
      syncTools(); paint(); if (e && e.type === 'pointercancel') return;
    };
    root.addEventListener('pointerup', up, true); root.addEventListener('pointercancel', up, true);
    document.addEventListener('keydown', (e) => {
      if (!UI.root || !UI.root.isConnected || UI.root.offsetParent === null || UI.main.hidden || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || document.querySelector('dialog[open]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && S.pick >= 0) { e.preventDefault(); delPick(); }
      else if (e.key === 'Escape' && (G || S.tool !== 'cur' || S.pick >= 0)) { G = null; S.pick = -1; S.tool = 'cur'; syncTools(); paint(); }
    });
  }

  // ---- the note --------------------------------------------------------------------------------------------------------
  function syncNote(typing) {
    UI.chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(S.work.chips.indexOf(b.dataset.v) >= 0)));
    say(UI.count, `${S.work.text.length} of ${TEXT_MAX} characters · ${S.work.draw.length} drawing${S.work.draw.length === 1 ? '' : 's'} on the chart`);
    UI.wipe.disabled = !S.work.draw.length;
    const d = dirty(), stored = S.sel && S.notes ? S.notes[S.sel] : null;
    if (typing) S.failed = false;   // he is writing again: the failure line gives way, the button stays ready
    UI.save.textContent = S.failed ? 'Try again' : 'Save'; UI.save.disabled = S.saving || !(d || S.failed);
    if (!S.saving && !S.failed) say(UI.state, d ? 'Not saved yet.' : stored && hasNote(stored) ? `Saved${stored.at ? ' · ' + fmtT(Date.parse(stored.at) / 1000) : ''}.` : 'Nothing written yet.');
    if (!d) leaveOk.reset();
  }
  async function save() {
    const id = S.sel; if (!id || S.saving) return;
    const body = { action: 'example.note', id, text: S.work.text.trim(), chips: S.work.chips.slice(), draw: cleanDraw(S.work.draw) };
    S.saving = true; S.failed = false; UI.save.disabled = true; say(UI.state, 'Saving…');
    try {
      const r = await S.api.post(body);
      if (r && r.note) S.notes[id] = r.note; else delete S.notes[id];
      S.saving = false;
      if (S.sel === id) { S.work = { text: S.work.text, chips: body.chips, draw: body.draw }; if (S.pick >= S.work.draw.length) S.pick = -1; syncNote(); paint(); if (!hasNote(S.notes[id])) say(UI.state, 'Saved: this example has no note now.'); }
      markRows();
    } catch (e) { S.saving = false; S.failed = true; UI.save.disabled = false; UI.save.textContent = 'Try again'; say(UI.state, saveFailure(e)); }
  }
  // the list's "your notes" marks, without drawing the list again (an open group stays open)
  function markRows() {
    if (!S.file || !UI.list) return;
    UI.list.querySelectorAll('button.ex-row').forEach((b) => { const has = hasNote(S.notes[b.dataset.id]), m = b.querySelector('.ex-row-n'); if (has && !m) b.appendChild(el('span', { class: 'ex-row-n', text: 'your notes' })); else if (!has && m) m.remove(); });
    for (const g of S.file.groups) { const d = UI.list.querySelector(`details[data-g="${g.k}"] summary small`); if (d) { const mine = g.examples.filter((e) => hasNote(S.notes[e.id])).length; d.textContent = mine ? `${mine} of ${g.examples.length} with your notes` : `${g.examples.length} examples`; } }
    const n = countNotes(S.file, S.notes), c = document.getElementById('ex-count'), all = document.getElementById('ex-copy-all');
    if (c) c.textContent = c.textContent.replace(/your notes on \d+/, 'your notes on ' + n); if (all) all.disabled = !n;
  }

  // ---- for the assistant -----------------------------------------------------------------------------------------------
  async function copyText(text, msg, okText, out) {
    let ok = false;
    try { if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) { await root.navigator.clipboard.writeText(text); ok = true; } } catch (e) { /* the box below is the fallback */ }
    out.value = text; out.hidden = ok;
    if (!ok) { out.focus(); out.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } }
    say(msg, ok ? okText : 'The browser did not allow copying: the text is in the box, select it and copy it by hand.');
  }
  function copyOne() { const f = cur(); if (!f) return; copyText(noteText(f.group, f.ex, S.work), UI.state, 'Copied: this example with your note' + (dirty() ? ' (as written here, not saved yet).' : '.'), UI.out); }
  function copyAll() {
    const notes = { ...S.notes }; if (S.sel && dirty()) notes[S.sel] = S.work;   // what is on the page counts, saved or not
    const text = allNotesText(S.file, notes); if (!text) { say(UI.listMsg, 'No note yet: open an example and write one.'); return; }
    const n = countNotes(S.file, notes); copyText(text, UI.listMsg, `Copied: ${n} example${n === 1 ? '' : 's'} with your notes.`, UI.outAll);
  }
  // the chart as a picture: the candles, then the marks and drawings over them
  function download() {
    const f = cur(); if (!f || !UI.c) return;
    try {
      const pick = S.pick; S.pick = -1; paint();
      const shot = UI.c.chart.takeScreenshot(), out = document.createElement('canvas'); out.width = shot.width; out.height = shot.height;
      const x = out.getContext('2d'); x.fillStyle = css('--au-surface') || '#1a1c1f'; x.fillRect(0, 0, out.width, out.height); x.drawImage(shot, 0, 0); x.drawImage(UI.cv, 0, 0, out.width, out.height);
      S.pick = pick; paint();
      const name = `desk-example-${f.ex.id.replace(/[^a-z0-9]+/gi, '-')}-${S.tf}.png`;
      out.toBlob((b) => { if (!b) { say(UI.state, 'The picture could not be made in this browser.'); return; } const a = el('a', { href: URL.createObjectURL(b), download: name }); document.body.appendChild(a); a.click(); a.remove(); root.setTimeout(() => URL.revokeObjectURL(a.href), 4000); say(UI.state, 'Picture downloaded: ' + name); }, 'image/png');
    } catch (e) { say(UI.state, 'The picture could not be made: ' + ((e && e.message) || e) + '.'); }
  }
  MXAX.state = () => ({ sel: S.sel, tf: S.tf, before: S.before, tool: S.tool, bars: S.bars.length, draw: S.work.draw.slice(), dirty: dirty(), notes: S.notes ? Object.keys(S.notes).length : null });   // read-only view, for the audit

  MXAC.registerTab('examples', { title: 'Desk examples', render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
