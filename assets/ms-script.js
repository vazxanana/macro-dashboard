/* Custom indicators written by members (24 Nov 2026, owner: "users … do their own indicators in pine language and
   metatrader language"). Two small interpreters, written here: a subset of Pine Script (v4 / v5 style) and a subset of
   MQL4 / MQL5 custom indicators. Nothing is handed to eval or Function: the code is parsed to a tree and walked, with a
   step budget, so a script cannot reach the page, the network or storage, and cannot hang the tab.
   Display only: a script draws lines on a chart. It never places, changes or refuses an order and no council member reads it.
   Pure (no DOM): window.MS_SCRIPT in the page, module.exports in tests.
     MS_SCRIPT.run(lang, code, bars) -> { name, overlay, plots: [{ title, color, w, hist, dots, v: [], cols? }], hlines: [{ price, color, title }], notes: [] }
     bars = [{ time, open, high, low, close, volume }] oldest first. Errors are thrown as Error with .line (1-based) when known. */
(function (root) {
  'use strict';
  var BUDGET = 6e6;
  function fail(msg, line) { var e = new Error(msg + (line ? ' (line ' + line + ')' : '')); e.line = line || null; e.script = true; return e; }
  var isNum = function (v) { return typeof v === 'number' && isFinite(v); };

  // ───────────────────────────── shared maths (arrays oldest first, null = no value) ─────────────────────────────
  var M = {
    sma: function (a, n) { var o = new Array(a.length).fill(null), s = 0, c = 0; for (var i = 0; i < a.length; i++) { if (a[i] == null) { s = 0; c = 0; continue; } s += a[i]; c++; if (c > n) { s -= a[i - n]; c = n; } if (c === n) o[i] = s / n; } return o; },
    ema: function (a, n, alpha) { var o = new Array(a.length).fill(null), k = alpha == null ? 2 / (n + 1) : alpha, v = null, s = 0, c = 0; for (var i = 0; i < a.length; i++) { if (a[i] == null) continue; if (v == null) { s += a[i]; c++; if (c === n) { v = s / n; o[i] = v; } } else { v = a[i] * k + v * (1 - k); o[i] = v; } } return o; },
    rma: function (a, n) { return M.ema(a, n, 1 / n); },
    wma: function (a, n) { var o = new Array(a.length).fill(null), d = n * (n + 1) / 2; for (var i = n - 1; i < a.length; i++) { var s = 0, ok = true; for (var j = 0; j < n; j++) { if (a[i - j] == null) { ok = false; break; } s += a[i - j] * (n - j); } if (ok) o[i] = s / d; } return o; },
    std: function (a, n) { var m = M.sma(a, n); return a.map(function (_, i) { if (m[i] == null) return null; var s = 0; for (var j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) * (a[j] - m[i]); return Math.sqrt(s / n); }); },
    tr: function (B) { return B.map(function (b, i) { return i ? Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close)) : b.high - b.low; }); },
    rsi: function (a, n) { var u = [null], d = [null]; for (var i = 1; i < a.length; i++) { var c = a[i] == null || a[i - 1] == null ? null : a[i] - a[i - 1]; u.push(c == null ? null : Math.max(c, 0)); d.push(c == null ? null : Math.max(-c, 0)); } var U = M.rma(u, n), D = M.rma(d, n); return a.map(function (_, i) { return U[i] == null || D[i] == null ? null : D[i] === 0 ? 100 : 100 - 100 / (1 + U[i] / D[i]); }); },
    hh: function (a, n) { return a.map(function (_, i) { if (i < n - 1) return null; var m = -Infinity; for (var j = i - n + 1; j <= i; j++) { if (a[j] == null) return null; if (a[j] > m) m = a[j]; } return m; }); },
    ll: function (a, n) { return a.map(function (_, i) { if (i < n - 1) return null; var m = Infinity; for (var j = i - n + 1; j <= i; j++) { if (a[j] == null) return null; if (a[j] < m) m = a[j]; } return m; }); },
    ma: function (a, n, method) { return method === 1 ? M.ema(a, n) : method === 2 ? M.rma(a, n) : method === 3 ? M.wma(a, n) : M.sma(a, n); },
    price: function (B, p) { return B.map(function (b) { return p === 1 ? b.open : p === 2 ? b.high : p === 3 ? b.low : p === 4 ? (b.high + b.low) / 2 : p === 5 ? (b.high + b.low + b.close) / 3 : p === 6 ? (b.high + b.low + 2 * b.close) / 4 : b.close; }); },
    cci: function (a, n) { var m = M.sma(a, n); return a.map(function (_, i) { if (m[i] == null) return null; var d = 0; for (var j = i - n + 1; j <= i; j++) d += Math.abs(a[j] - m[i]); d /= n; return d ? (a[i] - m[i]) / (0.015 * d) : 0; }); }
  };
  var COLORS = { red: '#f23645', green: '#089981', blue: '#2962ff', orange: '#ff9800', yellow: '#fdd835', purple: '#9c27b0', aqua: '#00bcd4', teal: '#00897b', lime: '#00e676', fuchsia: '#e040fb', maroon: '#880e4f', navy: '#311b92', olive: '#808000', silver: '#b2b5be', gray: '#787b86', white: '#ffffff', black: '#363a45', pink: '#e91e63', magenta: '#e040fb', gold: '#e0a526', brown: '#795548', violet: '#7e57c2', cyan: '#00bcd4' };
  function withAlpha(c, transp) { var m = /^#([0-9a-f]{6})$/i.exec(c || ''); if (!m || !(transp > 0)) return c; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, 1 - transp / 100)).toFixed(2) + ')'; }

  // ───────────────────────────────────────── tokens (both languages) ─────────────────────────────────────────
  function lex(src, line, pine) {
    var out = [], i = 0, n = src.length, ln = line;
    while (i < n) {
      var c = src[i];
      if (c === '\n') { ln++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') ln++; i++; } i += 2; continue; }
      if (c === '"' || c === "'") { var j = i + 1, s = ''; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; s += src[j]; j++; } out.push({ t: 'str', v: s, ln: ln }); i = j + 1; continue; }
      if (pine && c === '#' && /^#[0-9a-fA-F]{6}/.test(src.slice(i, i + 7))) { var h = /^#[0-9a-fA-F]{6,8}/.exec(src.slice(i, i + 9))[0]; out.push({ t: 'col', v: h.slice(0, 7).toLowerCase(), ln: ln }); i += h.length; continue; }
      var m = /^(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+)/.exec(src.slice(i, i + 40));
      if (m) { out.push({ t: 'num', v: +m[1], ln: ln }); i += m[1].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 80));
      if (m) { out.push({ t: 'id', v: m[0], ln: ln }); i += m[0].length; continue; }
      var three = src.slice(i, i + 3), two = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', ':=', '+=', '-=', '*=', '/=', '=>', '&&', '||', '++', '--'].indexOf(two) >= 0) { out.push({ t: 'op', v: two, ln: ln }); i += 2; continue; }
      if ('+-*/%<>=!?:,()[]{}.;&'.indexOf(c) >= 0) { out.push({ t: 'op', v: c, ln: ln }); i++; continue; }
      throw fail('Unexpected character "' + c + '"', ln); void three;
    }
    return out;
  }

  // ════════════════════════════════════════════ PINE ════════════════════════════════════════════
  var PINE_TYPES = { int: 1, float: 1, bool: 1, color: 1, string: 1, series: 1, simple: 1, const: 1, input: 1, var: 1, varip: 1 };
  function pineParse(code) {
    var raw = String(code).replace(/\r/g, '').split('\n'), lines = [], nid = 0;
    // logical lines: comments out, an open bracket joins the next line
    for (var i = 0; i < raw.length; i++) {
      var txt = raw[i], ln = i + 1; if (/^\s*\/\/@/.test(txt)) continue;
      var ind = 0, k = 0; while (k < txt.length && (txt[k] === ' ' || txt[k] === '\t')) { ind += txt[k] === '\t' ? 4 : 1; k++; }
      var toks = lex(txt, ln, true); if (!toks.length) continue;
      var depth = function (T) { var d = 0; T.forEach(function (t) { if (t.t === 'op') { if (t.v === '(' || t.v === '[') d++; else if (t.v === ')' || t.v === ']') d--; } }); return d; };
      while (depth(toks) > 0 && i + 1 < raw.length) { i++; toks = toks.concat(lex(raw[i], i + 1, true)); }
      lines.push({ ind: Math.floor(ind / 4), toks: toks, ln: ln });
    }
    function P(toks) { // expression parser over one token list
      var p = 0, ln = toks.length ? toks[0].ln : 0;
      var peek = function () { return toks[p]; }, isOp = function (v) { return toks[p] && toks[p].t === 'op' && toks[p].v === v; }, isId = function (v) { return toks[p] && toks[p].t === 'id' && toks[p].v === v; };
      var eat = function (v) { if (!isOp(v)) throw fail('Expected "' + v + '"', (toks[p] || toks[toks.length - 1] || { ln: ln }).ln); p++; };
      var node = function (o) { o.id = ++nid; o.ln = (toks[Math.min(p, toks.length - 1)] || { ln: ln }).ln; return o; };
      function ternary() { var c = or(); if (isOp('?')) { p++; var a = ternary(); eat(':'); var b = ternary(); return node({ k: 'tern', c: c, a: a, b: b }); } return c; }
      function or() { var a = and(); while (isId('or')) { p++; a = node({ k: 'or', a: a, b: and() }); } return a; }
      function and() { var a = not(); while (isId('and')) { p++; a = node({ k: 'and', a: a, b: not() }); } return a; }
      function not() { if (isId('not')) { p++; return node({ k: 'not', a: not() }); } return cmp(); }
      function cmp() { var a = add(); while (toks[p] && toks[p].t === 'op' && ['==', '!=', '<', '>', '<=', '>='].indexOf(toks[p].v) >= 0) { var o = toks[p++].v; a = node({ k: 'bin', o: o, a: a, b: add() }); } return a; }
      function add() { var a = mul(); while (isOp('+') || isOp('-')) { var o = toks[p++].v; a = node({ k: 'bin', o: o, a: a, b: mul() }); } return a; }
      function mul() { var a = unary(); while (isOp('*') || isOp('/') || isOp('%')) { var o = toks[p++].v; a = node({ k: 'bin', o: o, a: a, b: unary() }); } return a; }
      function unary() { if (isOp('-')) { p++; return node({ k: 'neg', a: unary() }); } if (isOp('+')) { p++; return unary(); } return post(); }
      function post() {
        var a = prim();
        for (;;) {
          if (isOp('.')) { p++; var t = toks[p++]; if (!t || t.t !== 'id') throw fail('Expected a name after "."', ln); if (a.k !== 'name') throw fail('Unexpected "."', ln); a = node({ k: 'name', v: a.v + '.' + t.v }); continue; }
          if (isOp('(')) { p++; var args = [], named = {}; while (!isOp(')')) { if (toks[p] && toks[p].t === 'id' && toks[p + 1] && toks[p + 1].t === 'op' && toks[p + 1].v === '=') { var nm = toks[p].v; p += 2; named[nm] = ternary(); } else args.push(ternary()); if (isOp(',')) p++; else if (!isOp(')')) throw fail('Expected "," or ")"', (toks[p] || { ln: ln }).ln); } p++; a = node({ k: 'call', f: a, args: args, named: named }); continue; }
          if (isOp('[')) { p++; var ix = ternary(); eat(']'); a = node({ k: 'idx', a: a, i: ix, hist: [] }); continue; }
          return a;
        }
      }
      function prim() {
        var t = toks[p]; if (!t) throw fail('Unexpected end of line', ln);
        if (t.t === 'num') { p++; return node({ k: 'lit', v: t.v }); }
        if (t.t === 'str') { p++; return node({ k: 'lit', v: t.v }); }
        if (t.t === 'col') { p++; return node({ k: 'lit', v: t.v }); }
        if (t.t === 'id') { p++; if (t.v === 'true') return node({ k: 'lit', v: true }); if (t.v === 'false') return node({ k: 'lit', v: false }); if (t.v === 'na' && !isOp('(')) return node({ k: 'lit', v: null }); return node({ k: 'name', v: t.v }); }
        if (isOp('(')) { p++; var e = ternary(); eat(')'); return e; }
        if (isOp('[')) { p++; var it = []; while (!isOp(']')) { it.push(ternary()); if (isOp(',')) p++; } p++; return node({ k: 'tuple', items: it }); }
        throw fail('Unexpected "' + t.v + '"', t.ln);
      }
      return { expr: function () { var e = ternary(); if (p < toks.length) throw fail('Unexpected "' + toks[p].v + '"', toks[p].ln); return e; } };
    }
    var topAssign = function (T) { var d = 0; for (var q = 0; q < T.length; q++) { var t = T[q]; if (t.t !== 'op') continue; if (t.v === '(' || t.v === '[') d++; else if (t.v === ')' || t.v === ']') d--; else if (d === 0 && ['=', ':=', '+=', '-=', '*=', '/=', '=>'].indexOf(t.v) >= 0) return q; } return -1; };
    function stmt(L) {
      var T = L.toks, ln = L.ln, first = T[0];
      if (first.t === 'id' && first.v === 'if') return { k: 'if', c: P(T.slice(1)).expr(), body: [], els: null, ln: ln };
      if (first.t === 'id' && first.v === 'else') { if (T[1] && T[1].t === 'id' && T[1].v === 'if') return { k: 'elif', c: P(T.slice(2)).expr(), body: [], ln: ln }; return { k: 'else', body: [], ln: ln }; }
      if (first.t === 'id' && first.v === 'for') { var eq = topAssign(T), to = T.findIndex(function (t) { return t.t === 'id' && t.v === 'to'; }), by = T.findIndex(function (t) { return t.t === 'id' && t.v === 'by'; }); if (eq < 0 || to < 0) throw fail('for needs "for i = a to b"', ln); return { k: 'for', v: T[1].v, a: P(T.slice(eq + 1, to)).expr(), b: P(T.slice(to + 1, by < 0 ? T.length : by)).expr(), s: by < 0 ? null : P(T.slice(by + 1)).expr(), body: [], ln: ln }; }
      if (first.t === 'id' && first.v === 'while') return { k: 'while', c: P(T.slice(1)).expr(), body: [], ln: ln };
      if (first.t === 'id' && (first.v === 'switch' || first.v === 'import' || first.v === 'type' || first.v === 'method' || first.v === 'export')) throw fail('"' + first.v + '" is not supported here', ln);
      var q = topAssign(T);
      if (q > 0) {
        var op = T[q].v, L0 = T.slice(0, q), R = T.slice(q + 1);
        if (op === '=>') { if (L0.length < 3 || L0[1].v !== '(') throw fail('A function is written name(a, b) => expression', ln); var ps = L0.slice(2, -1).filter(function (t) { return t.t === 'id' && !PINE_TYPES[t.v]; }).map(function (t) { return t.v; }); return { k: 'fn', name: L0[0].v, params: ps, e: R.length ? P(R).expr() : null, body: [], ln: ln }; }
        if (R.length && R[0].t === 'id' && (R[0].v === 'if' || R[0].v === 'switch' || R[0].v === 'for')) throw fail('"x = ' + R[0].v + ' …" is not supported: write the ' + R[0].v + ' on its own lines', ln);
        if (L0[0].t === 'op' && L0[0].v === '[') { if (op !== '=') throw fail('A tuple is declared with "="', ln); return { k: 'tup', names: L0.filter(function (t) { return t.t === 'id'; }).map(function (t) { return t.v; }), e: P(R).expr(), ln: ln }; }
        var ids = L0.filter(function (t) { return t.t === 'id'; }), name = ids[ids.length - 1];
        if (!name || L0.some(function (t) { return t.t !== 'id'; })) throw fail('Cannot assign to this', ln);
        var isVar = ids.some(function (t) { return t.v === 'var' || t.v === 'varip'; });
        return { k: op === '=' ? 'decl' : 'set', name: name.v, op: op, isVar: isVar, e: P(R).expr(), ln: ln, id: ++nid };
      }
      return { k: 'expr', e: P(T).expr(), ln: ln };
    }
    // blocks by indentation
    var pos = 0;
    function block(ind) {
      var out = [];
      while (pos < lines.length && lines[pos].ind >= ind) {
        if (lines[pos].ind > ind) throw fail('Unexpected indentation', lines[pos].ln);
        var s = stmt(lines[pos]); pos++;
        if (s.body && !(s.k === 'fn' && s.e)) { s.body = pos < lines.length && lines[pos].ind > ind ? block(ind + 1) : []; if (!s.body.length && s.k !== 'fn') throw fail('This line needs an indented block under it', s.ln); if (s.k === 'fn' && !s.body.length) throw fail('The function has no body', s.ln); }
        if (s.k === 'elif' || s.k === 'else') { var prev = out[out.length - 1]; while (prev && prev.els && prev.els.k === 'if') prev = prev.els; if (!prev || prev.k !== 'if' || prev.els) throw fail('"else" without an "if" above it', s.ln); prev.els = s.k === 'else' ? { k: 'block', body: s.body } : { k: 'if', c: s.c, body: s.body, els: null }; continue; }
        out.push(s);
      }
      return out;
    }
    return block(0);
  }

  var PINE_ALIAS = { sma: 1, ema: 1, rma: 1, wma: 1, vwma: 1, rsi: 1, atr: 1, stdev: 1, highest: 1, lowest: 1, change: 1, crossover: 1, crossunder: 1, cross: 1, macd: 1, bb: 1, stoch: 1, cci: 1, mom: 1, roc: 1, cum: 1, barssince: 1, valuewhen: 1, tr: 1, vwap: 1, supertrend: 1, pivothigh: 1, pivotlow: 1, dev: 1, swma: 1, hma: 1, linreg: 1, rising: 1, falling: 1 };
  var PINE_MATH = { abs: Math.abs, sqrt: Math.sqrt, log: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, sign: Math.sign, sin: Math.sin, cos: Math.cos, tan: Math.tan, log10: Math.log10 };
  var PINE_IGNORED = { bgcolor: 1, fill: 1, barcolor: 1, alertcondition: 1, alert: 1, plotchar: 1, plotarrow: 1, plotcandle: 1, plotbar: 1, 'label.new': 1, 'line.new': 1, 'box.new': 1, 'table.new': 1, 'runtime.error': 1, 'log.info': 1 };

  function pineRun(code, B) {
    var prog = pineParse(code), n = B.length, steps = 0, bar = 0;
    var out = { name: 'Pine script', overlay: false, plots: [], hlines: [], notes: [] }, plotOf = {}, hlineOf = {}, ignored = {};
    var G = {}, fns = {}, sites = {}, path = '';   // G: name -> { v, hist, isVar, init }
    var S = function (node, key) { var id = path + '/' + node.id + (key || ''); return sites[id] || (sites[id] = {}); };
    var num = function (v) { return isNum(v) ? v : null; };
    var arg = function (c, i, name, env, def) { if (c.args[i] !== undefined) return ev(c.args[i], env); if (name && c.named[name] !== undefined) return ev(c.named[name], env); return def; };
    var src0 = function (name) { var b = B[bar]; switch (name) { case 'open': return b.open; case 'high': return b.high; case 'low': return b.low; case 'close': return b.close; case 'volume': return b.volume || 0; case 'hl2': return (b.high + b.low) / 2; case 'hlc3': return (b.high + b.low + b.close) / 3; case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4; case 'hlcc4': return (b.high + b.low + 2 * b.close) / 4; case 'time': return b.time * 1000; case 'bar_index': case 'n': return bar; } return undefined; };
    var SERIES = { open: 1, high: 1, low: 1, close: 1, volume: 1, hl2: 1, hlc3: 1, ohlc4: 1, hlcc4: 1, time: 1, bar_index: 1 };
    // incremental studies, one state per call site
    var T = {
      win: function (st, v, len) { var q = st.q || (st.q = []); q.push(v); if (q.length > len) q.shift(); return q; },
      sma: function (st, v, len) { var q = T.win(st, v, len); if (q.length < len) return null; var s = 0; for (var i = 0; i < len; i++) { if (q[i] == null) return null; s += q[i]; } return s / len; },
      ema: function (st, v, len, alpha) { if (v == null) return st.v == null ? null : st.v; var k = alpha == null ? 2 / (len + 1) : alpha; if (st.v == null) { st.s = (st.s || 0) + v; st.c = (st.c || 0) + 1; if (st.c >= len) st.v = st.s / st.c; return st.v == null ? null : st.v; } st.v = v * k + st.v * (1 - k); return st.v; },
      prev: function (st, v, len) { var q = st.q || (st.q = []); q.push(v); if (q.length > len + 1) q.shift(); return q.length > len ? q[0] : null; },
      sub: function (st, k) { return st[k] || (st[k] = {}); }
    };
    function ta(name, c, env, node) {
      var st = S(node), a = function (i, nm, d) { return arg(c, i, nm, env, d); }, b = B[bar], v, len, x, y;
      switch (name) {
        case 'sma': return T.sma(st, num(a(0, 'source')), a(1, 'length'));
        case 'ema': return T.ema(st, num(a(0, 'source')), a(1, 'length'));
        case 'rma': len = a(1, 'length'); return T.ema(st, num(a(0, 'source')), len, 1 / len);
        case 'wma': case 'vwma': case 'swma': case 'hma': { len = name === 'swma' ? 4 : a(1, 'length'); v = num(a(0, 'source'));
          if (name === 'hma') { var h1 = T.sub(st, 'a'), h2 = T.sub(st, 'b'), h3 = T.sub(st, 'c'), wm = function (s2, val, L) { var q = T.win(s2, val, L); if (q.length < L) return null; var s = 0, d = L * (L + 1) / 2; for (var i = 0; i < L; i++) { if (q[i] == null) return null; s += q[i] * (i + 1); } return s / d; }; x = wm(h1, v, Math.max(1, Math.floor(len / 2))); y = wm(h2, v, len); return wm(h3, x == null || y == null ? null : 2 * x - y, Math.max(1, Math.round(Math.sqrt(len)))); }
          var q = T.win(st, name === 'vwma' ? (v == null ? null : [v, b.volume || 1]) : v, len); if (q.length < len) return null; var s = 0, d = 0;
          for (var i = 0; i < len; i++) { if (q[i] == null) return null; if (name === 'vwma') { s += q[i][0] * q[i][1]; d += q[i][1]; } else { s += q[i] * (i + 1); d += i + 1; } } return d ? s / d : null; }
        case 'stdev': case 'dev': { len = a(1, 'length'); var q2 = T.win(st, num(a(0, 'source')), len); if (q2.length < len || q2.some(function (z) { return z == null; })) return null; var mm = q2.reduce(function (s3, z) { return s3 + z; }, 0) / len; return name === 'dev' ? q2.reduce(function (s3, z) { return s3 + Math.abs(z - mm); }, 0) / len : Math.sqrt(q2.reduce(function (s3, z) { return s3 + (z - mm) * (z - mm); }, 0) / len); }
        case 'highest': case 'lowest': { var one = c.args.length < 2 && c.named.length == null && c.named.source === undefined; len = one ? a(0, 'length') : a(1, 'length'); v = one ? (name === 'highest' ? b.high : b.low) : num(a(0, 'source')); var q3 = T.win(st, v, len); if (q3.length < len || q3.some(function (z) { return z == null; })) return null; return name === 'highest' ? Math.max.apply(null, q3) : Math.min.apply(null, q3); }
        case 'change': case 'mom': case 'roc': { v = num(a(0, 'source')); len = a(1, 'length', 1); x = T.prev(st, v, len); if (v == null || x == null) return null; return name === 'roc' ? (x ? 100 * (v - x) / x : null) : v - x; }
        case 'rising': case 'falling': { v = num(a(0, 'source')); len = a(1, 'length', 1); var q4 = T.win(st, v, len + 1); if (q4.length < len + 1) return false; for (var r = 1; r < q4.length; r++) { if (q4[r] == null || q4[r - 1] == null || (name === 'rising' ? q4[r] <= q4[r - 1] : q4[r] >= q4[r - 1])) return false; } return true; }
        case 'rsi': { v = num(a(0, 'source')); len = a(1, 'length'); x = st.p; st.p = v; if (v == null || x == null) return null; var u = T.ema(T.sub(st, 'u'), Math.max(v - x, 0), len, 1 / len), dn = T.ema(T.sub(st, 'd'), Math.max(x - v, 0), len, 1 / len); return u == null || dn == null ? null : dn === 0 ? 100 : 100 - 100 / (1 + u / dn); }
        case 'tr': return bar ? Math.max(b.high - b.low, Math.abs(b.high - B[bar - 1].close), Math.abs(b.low - B[bar - 1].close)) : b.high - b.low;
        case 'atr': len = a(0, 'length'); return T.ema(st, ta('tr', c, env, node), len, 1 / len);
        case 'crossover': case 'crossunder': case 'cross': { x = num(a(0)); y = num(a(1)); var px = st.x, py = st.y; st.x = x; st.y = y; if (x == null || y == null || px == null || py == null) return false; var up = x > y && px <= py, dnn = x < y && px >= py; return name === 'crossover' ? up : name === 'crossunder' ? dnn : up || dnn; }
        case 'macd': { v = num(a(0, 'source')); var f = T.ema(T.sub(st, 'f'), v, a(1, 'fastlen')), sl = T.ema(T.sub(st, 's'), v, a(2, 'slowlen')), mc = f == null || sl == null ? null : f - sl, sg = mc == null ? null : T.ema(T.sub(st, 'g'), mc, a(3, 'siglen')); return [mc, sg, mc == null || sg == null ? null : mc - sg]; }
        case 'bb': { v = num(a(0, 'series')); len = a(1, 'length'); var mult = a(2, 'mult', 2), q5 = T.win(st, v, len); if (q5.length < len || q5.some(function (z) { return z == null; })) return [null, null, null]; var m5 = q5.reduce(function (s3, z) { return s3 + z; }, 0) / len, sd = Math.sqrt(q5.reduce(function (s3, z) { return s3 + (z - m5) * (z - m5); }, 0) / len); return [m5, m5 + mult * sd, m5 - mult * sd]; }
        case 'stoch': { v = num(a(0)); len = a(3, 'length'); var qh = T.win(T.sub(st, 'h'), num(a(1)), len), ql = T.win(T.sub(st, 'l'), num(a(2)), len); if (qh.length < len || v == null) return null; var hi = Math.max.apply(null, qh), lo = Math.min.apply(null, ql); return hi > lo ? 100 * (v - lo) / (hi - lo) : 0; }
        case 'cci': { v = num(a(0, 'source')); len = a(1, 'length'); var q6 = T.win(st, v, len); if (q6.length < len || q6.some(function (z) { return z == null; })) return null; var m6 = q6.reduce(function (s3, z) { return s3 + z; }, 0) / len, d6 = q6.reduce(function (s3, z) { return s3 + Math.abs(z - m6); }, 0) / len; return d6 ? (v - m6) / (0.015 * d6) : 0; }
        case 'cum': v = num(a(0)); st.s = (st.s || 0) + (v || 0); return st.s;
        case 'barssince': if (a(0)) st.c = 0; else if (st.c != null) st.c++; return st.c == null ? null : st.c;
        case 'valuewhen': { var occ = a(2, 'occurrence', 0), L2 = st.l || (st.l = []); if (a(0)) { L2.unshift(a(1)); if (L2.length > 50) L2.pop(); } return L2[occ] === undefined ? null : L2[occ]; }
        case 'vwap': { v = c ? num(arg(c, 0, 'source', env, (b.high + b.low + b.close) / 3)) : (b.high + b.low + b.close) / 3; var day = Math.floor(b.time / 86400); if (st.day !== day) { st.day = day; st.pv = 0; st.vv = 0; } var w = b.volume > 0 ? b.volume : 1; st.pv += v * w; st.vv += w; return st.pv / st.vv; }
        case 'supertrend': { var fac = a(0, 'factor'); len = a(1, 'atrPeriod'); var atr = T.ema(T.sub(st, 'a'), ta('tr', c, env, node), len, 1 / len); if (atr == null) return [null, null]; var mid = (b.high + b.low) / 2, ub = mid + fac * atr, lb = mid - fac * atr, pc = bar ? B[bar - 1].close : b.close; if (st.ub != null) { ub = ub < st.ub || pc > st.ub ? ub : st.ub; lb = lb > st.lb || pc < st.lb ? lb : st.lb; } var dir = st.dir == null ? 1 : st.dir === 1 ? (b.close > ub ? -1 : 1) : (b.close < lb ? 1 : -1); st.ub = ub; st.lb = lb; st.dir = dir; return [dir === -1 ? lb : ub, dir]; }
        case 'pivothigh': case 'pivotlow': { var three = c.args.length >= 3, lf = a(three ? 1 : 0, 'leftbars'), rt = a(three ? 2 : 1, 'rightbars'); v = three ? num(a(0)) : (name === 'pivothigh' ? b.high : b.low); var q7 = T.win(st, v, lf + rt + 1); if (q7.length < lf + rt + 1) return null; var mid2 = q7[lf]; if (mid2 == null) return null; for (var z2 = 0; z2 < q7.length; z2++) { if (z2 === lf) continue; if (q7[z2] == null || (name === 'pivothigh' ? q7[z2] >= mid2 : q7[z2] <= mid2)) return null; } return mid2; }
        case 'linreg': { len = a(1, 'length'); var off = a(2, 'offset', 0), q8 = T.win(st, num(a(0, 'source')), len); if (q8.length < len || q8.some(function (z) { return z == null; })) return null; var sx = 0, sy = 0, sxy = 0, sxx = 0; for (var u2 = 0; u2 < len; u2++) { sx += u2; sy += q8[u2]; sxy += u2 * q8[u2]; sxx += u2 * u2; } var slope = (len * sxy - sx * sy) / (len * sxx - sx * sx || 1), ic = (sy - slope * sx) / len; return ic + slope * (len - 1 - off); }
      }
      throw fail('ta.' + name + ' is not supported', node.ln);
    }
    function color(name, c, env, node) {
      if (name === 'color.new') return withAlpha(arg(c, 0, 'color', env), arg(c, 1, 'transp', env, 0));
      if (name === 'color.rgb') { var h = '#' + [0, 1, 2].map(function (i) { return ('0' + Math.max(0, Math.min(255, Math.round(arg(c, i, null, env, 0)))).toString(16)).slice(-2); }).join(''); return withAlpha(h, arg(c, 3, 'transp', env, 0)); }
      throw fail(name + ' is not supported', node.ln);
    }
    function lookup(name, env, node) {
      for (var e = env; e; e = e.up) if (Object.prototype.hasOwnProperty.call(e.v, name)) return e.v[name];
      if (Object.prototype.hasOwnProperty.call(G, name)) return G[name].v;
      var s = src0(name); if (s !== undefined) return s;
      if (name.indexOf('color.') === 0 && COLORS[name.slice(6)]) return COLORS[name.slice(6)];
      if (name === 'ta.tr') return ta('tr', null, env, node); if (name === 'ta.vwap' || name === 'vwap') return ta('vwap', null, env, node);
      if (name === 'math.pi') return Math.PI; if (name === 'math.e') return Math.E;
      if (/^(plot|shape|location|size|hline|display|format|scale|position|extend|xloc|yloc|line|label|text|barmerge|timeframe|syminfo|session|currency|order|alert|strategy|input)\./.test(name)) return name;
      if (name === 'barstate.islast') return bar === n - 1; if (name === 'barstate.isfirst') return bar === 0; if (name === 'barstate.isconfirmed' || name === 'barstate.ishistory') return true; if (name === 'barstate.isnew' ) return true; if (name === 'barstate.isrealtime') return false;
      throw fail('Unknown name "' + name + '"', node.ln);
    }
    function call(c, env) {
      var f = c.f.v, a = function (i, nm, d) { return arg(c, i, nm, env, d); };
      if (f == null) throw fail('This cannot be called', c.ln);
      if (fns[f]) { var fn = fns[f], loc = { v: {}, up: null }, keep = path; fn.params.forEach(function (pn, i) { loc.v[pn] = c.args[i] === undefined ? (c.named[pn] === undefined ? null : ev(c.named[pn], env)) : ev(c.args[i], env); }); path = path + '/' + c.id; var r = fn.e ? ev(fn.e, loc) : run(fn.body, loc, true); path = keep; return r; }
      if (f.indexOf('ta.') === 0) return ta(f.slice(3), c, env, c);
      if (PINE_ALIAS[f]) return ta(f, c, env, c);
      if (f.indexOf('math.') === 0) { var mf = f.slice(5), x = a(0);
        if (PINE_MATH[mf]) return isNum(x) ? PINE_MATH[mf](x) : null;
        if (mf === 'max' || mf === 'min' || mf === 'avg') { var vs = c.args.map(function (q) { return ev(q, env); }); if (vs.some(function (q) { return !isNum(q); })) return null; return mf === 'avg' ? vs.reduce(function (s, q) { return s + q; }, 0) / vs.length : Math[mf].apply(null, vs); }
        if (mf === 'pow') { var y = a(1); return isNum(x) && isNum(y) ? Math.pow(x, y) : null; }
        if (mf === 'round') { var d = a(1, 'precision', 0); if (!isNum(x)) return null; var k = Math.pow(10, d); return Math.round(x * k) / k; }
        if (mf === 'sum') { var st = S(c), q = T.win(st, num(x), a(1, 'length')); if (q.length < a(1, 'length') || q.some(function (z) { return z == null; })) return null; return q.reduce(function (s, z) { return s + z; }, 0); }
        throw fail(f + ' is not supported', c.ln); }
      if (f.indexOf('color.') === 0) return color(f, c, env, c);
      switch (f) {
        case 'indicator': case 'study': case 'strategy': { var t = a(0, 'title'); if (typeof t === 'string') out.name = t.slice(0, 60); var ov = c.named.overlay ? ev(c.named.overlay, env) : arg(c, 2, null, env, false); out.overlay = ov === true; if (f === 'strategy') ignored.strategy = 1; return null; }
        case 'input': case 'input.int': case 'input.float': case 'input.bool': case 'input.string': case 'input.source': case 'input.color': case 'input.price': case 'input.time': case 'input.timeframe': case 'input.session': case 'input.symbol': return a(0, 'defval', null);
        case 'nz': { var v1 = a(0); return v1 == null || (typeof v1 === 'number' && !isFinite(v1)) ? a(1, 'replacement', 0) : v1; }
        case 'na': { var v2 = a(0); return v2 == null || (typeof v2 === 'number' && isNaN(v2)); }
        case 'fixnan': { var st2 = S(c), v3 = a(0); if (v3 != null) st2.v = v3; return st2.v == null ? null : st2.v; }
        case 'abs': case 'sqrt': case 'log': case 'exp': case 'floor': case 'ceil': case 'sign': { var v4 = a(0); return isNum(v4) ? PINE_MATH[f](v4) : null; }
        case 'max': case 'min': { var v5 = c.args.map(function (q) { return ev(q, env); }); return v5.some(function (q) { return !isNum(q); }) ? null : Math[f].apply(null, v5); }
        case 'pow': return Math.pow(a(0), a(1)); case 'round': return isNum(a(0)) ? Math.round(a(0)) : null;
        case 'int': { var v6 = a(0); return isNum(v6) ? Math.trunc(v6) : null; } case 'float': return a(0); case 'bool': return !!a(0);
        case 'str.tostring': case 'tostring': return String(a(0));
        case 'timestamp': case 'time': case 'time_close': return B[bar].time * 1000;
        case 'hour': return new Date(B[bar].time * 1000).getUTCHours(); case 'minute': return new Date(B[bar].time * 1000).getUTCMinutes(); case 'dayofweek': return new Date(B[bar].time * 1000).getUTCDay() + 1;
        case 'plot': case 'plotshape': {
          var p = plotOf[path + '/' + c.id]; if (!p) { if (out.plots.length >= 24) throw fail('Too many plots (24 at most)', c.ln); p = plotOf[path + '/' + c.id] = { title: '', color: null, w: 1.5, hist: false, dots: false, v: new Array(n).fill(null), cols: null }; out.plots.push(p); }
          var val = a(0, 'series'), ttl = a(1, 'title'), col = c.named.color ? ev(c.named.color, env) : arg(c, 2, null, env, null), lw = arg(c, 3, 'linewidth', env, null), sty = arg(c, 4, 'style', env, null);
          if (f === 'plotshape') { var locn = c.named.location ? ev(c.named.location, env) : 'location.abovebar'; val = val ? (locn === 'location.belowbar' ? B[bar].low : locn === 'location.absolute' ? val : B[bar].high) : null; p.dots = true; col = c.named.color ? ev(c.named.color, env) : null; ttl = c.named.title ? ev(c.named.title, env) : ttl; }
          if (typeof val === 'boolean') val = val ? 1 : 0;
          p.v[bar] = isNum(val) ? val : null; if (typeof ttl === 'string') p.title = ttl.slice(0, 40); if (isNum(lw)) p.w = Math.max(1, Math.min(4, lw));
          if (typeof sty === 'string') { if (/histogram|columns|area/.test(sty)) p.hist = true; if (/circles|cross/.test(sty)) p.dots = true; }
          if (typeof col === 'string' && /^(#|rgba?\()/.test(col)) { if (p.color == null) p.color = col; else if (col !== p.color && !p.cols) { p.cols = new Array(n).fill(p.color); } if (p.cols) p.cols[bar] = col; }
          return null; }
        case 'hline': { var hk = path + '/' + c.id; if (!hlineOf[hk] && out.hlines.length < 12) { var pr = a(0, 'price'); if (isNum(pr)) { hlineOf[hk] = { price: pr, title: typeof a(1, 'title') === 'string' ? a(1, 'title').slice(0, 30) : '', color: typeof arg(c, 2, 'color', env, null) === 'string' ? arg(c, 2, 'color', env, null) : null }; out.hlines.push(hlineOf[hk]); } } return null; }
      }
      if (PINE_IGNORED[f] || /^(strategy|label|line|box|table|array|matrix|map|str|request|ticker|alert|log)\./.test(f)) { if (/^(request|array|matrix|map)\./.test(f)) throw fail(f + ' is not supported', c.ln); ignored[f.split('.')[0]] = 1; return null; }
      throw fail('Unknown function "' + f + '"', c.ln);
    }
    function ev(x, env) {
      if (++steps > BUDGET) throw fail('The script takes too long to run');
      switch (x.k) {
        case 'lit': return x.v;
        case 'name': return lookup(x.v, env, x);
        case 'neg': { var a = ev(x.a, env); return isNum(a) ? -a : null; }
        case 'not': return !ev(x.a, env);
        case 'and': return !!ev(x.a, env) && !!ev(x.b, env);
        case 'or': return !!ev(x.a, env) || !!ev(x.b, env);
        case 'tern': return ev(x.c, env) ? ev(x.a, env) : ev(x.b, env);
        case 'tuple': return x.items.map(function (q) { return ev(q, env); });
        case 'bin': { var l = ev(x.a, env), r = ev(x.b, env);
          if (x.o === '==') return l === r; if (x.o === '!=') return l !== r;
          if (x.o === '+' && (typeof l === 'string' || typeof r === 'string')) return String(l) + String(r);
          if (typeof l === 'boolean') l = l ? 1 : 0; if (typeof r === 'boolean') r = r ? 1 : 0;
          if (!isNum(l) || !isNum(r)) return x.o === '<' || x.o === '>' || x.o === '<=' || x.o === '>=' ? false : null;
          switch (x.o) { case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return r === 0 ? null : l / r; case '%': return r === 0 ? null : l % r; case '<': return l < r; case '>': return l > r; case '<=': return l <= r; case '>=': return l >= r; }
          return null; }
        case 'call': return call(x, env);
        case 'idx': { var k = ev(x.i, env); if (!isNum(k) || k < 0) throw fail('The history index must be 0 or more', x.ln); k = Math.round(k);
          if (x.a.k === 'name') { var nm = x.a.v, inEnv = false; for (var e = env; e; e = e.up) if (Object.prototype.hasOwnProperty.call(e.v, nm)) inEnv = true;
            if (!inEnv && G[nm]) return k === 0 ? G[nm].v : bar - k < 0 ? null : (G[nm].hist[bar - k] === undefined ? null : G[nm].hist[bar - k]);
            if (!inEnv && SERIES[nm]) { if (bar - k < 0) return null; var keep = bar; bar -= k; var v = src0(nm); bar = keep; return v; } }
          var cur = ev(x.a, env), H = x.histBy || (x.histBy = {}), hh = H[path] || (H[path] = []); hh[bar] = cur; return k === 0 ? cur : bar - k < 0 || hh[bar - k] === undefined ? null : hh[bar - k]; }
      }
      throw fail('Cannot evaluate this', x.ln);
    }
    function setVar(name, v, env, ln) { for (var e = env; e; e = e.up) if (Object.prototype.hasOwnProperty.call(e.v, name)) { e.v[name] = v; return; } if (G[name]) { G[name].v = v; return; } throw fail('"' + name + '" is not declared: use = first, then :=', ln); }
    function run(body, env, isFn) {
      var last = null;
      for (var i = 0; i < body.length; i++) {
        var s = body[i]; if (++steps > BUDGET) throw fail('The script takes too long to run');
        switch (s.k) {
          case 'fn': fns[s.name] = s; break;
          case 'decl': if (env) { last = env.v[s.name] = ev(s.e, env); } else { var g = G[s.name] || (G[s.name] = { v: null, hist: [], isVar: s.isVar, init: false }); if (!s.isVar || !g.init) { g.v = ev(s.e, env); g.init = true; } last = g.v; } break;
          case 'set': { var cur = s.op === ':=' ? null : lookup(s.name, env, s), r = ev(s.e, env), nv = s.op === ':=' ? r : !isNum(cur) || !isNum(r) ? null : s.op === '+=' ? cur + r : s.op === '-=' ? cur - r : s.op === '*=' ? cur * r : r === 0 ? null : cur / r; setVar(s.name, nv, env, s.ln); last = nv; break; }
          case 'tup': { var tv = ev(s.e, env); if (!Array.isArray(tv)) throw fail('The right side does not return several values', s.ln); s.names.forEach(function (nm, q) { if (env) env.v[nm] = tv[q]; else { (G[nm] || (G[nm] = { v: null, hist: [] })).v = tv[q] === undefined ? null : tv[q]; } }); break; }
          case 'if': { var node = s, done = false; while (node && !done) { if (node.k === 'block') { last = run(node.body, { v: {}, up: env }); done = true; } else if (ev(node.c, env)) { last = run(node.body, { v: {}, up: env }); done = true; } else node = node.els; } break; }
          case 'for': { var a = ev(s.a, env), b = ev(s.b, env), st = s.s ? ev(s.s, env) : (a <= b ? 1 : -1); if (!isNum(a) || !isNum(b) || !st) break; st = Math.abs(st) * (a <= b ? 1 : -1); var loc = { v: {}, up: env }; for (var q = a; st > 0 ? q <= b : q >= b; q += st) { loc.v[s.v] = q; last = run(s.body, loc); } break; }
          case 'while': { var loc2 = { v: {}, up: env }; while (ev(s.c, env)) last = run(s.body, loc2); break; }
          case 'expr': last = ev(s.e, env); break;
        }
      }
      return isFn ? last : last;
    }
    for (bar = 0; bar < n; bar++) { path = ''; run(prog, null); for (var nm in G) G[nm].hist[bar] = G[nm].v; }
    out.plots.forEach(function (p, i) { if (!p.title) p.title = out.name + (out.plots.length > 1 ? ' ' + (i + 1) : ''); });
    var ig = Object.keys(ignored); if (ig.length) out.notes.push('Not drawn here: ' + ig.join(', ') + '.');
    if (!out.plots.length && !out.hlines.length) throw fail('The script draws nothing: add a plot(…) line');
    return out;
  }

  // ════════════════════════════════════════════ MQL ════════════════════════════════════════════
  var MQL_TYPES = { int: 1, double: 1, bool: 1, string: 1, datetime: 1, color: 1, long: 1, float: 1, uint: 1, ulong: 1, short: 1, char: 1, void: 1, ENUM_MA_METHOD: 1, ENUM_APPLIED_PRICE: 1, ENUM_TIMEFRAMES: 1 };
  var EMPTY = 2147483647;
  var MQL_CONST = { MODE_SMA: 0, MODE_EMA: 1, MODE_SMMA: 2, MODE_LWMA: 3, PRICE_CLOSE: 0, PRICE_OPEN: 1, PRICE_HIGH: 2, PRICE_LOW: 3, PRICE_MEDIAN: 4, PRICE_TYPICAL: 5, PRICE_WEIGHTED: 6, MODE_MAIN: 0, MODE_SIGNAL: 1, MODE_UPPER: 1, MODE_LOWER: 2, MODE_OPEN: 0, MODE_LOW: 1, MODE_HIGH: 2, MODE_CLOSE: 3, MODE_VOLUME: 4, DRAW_LINE: 0, DRAW_SECTION: 1, DRAW_HISTOGRAM: 2, DRAW_ARROW: 3, DRAW_ZIGZAG: 4, DRAW_NONE: 12, STYLE_SOLID: 0, STYLE_DASH: 1, STYLE_DOT: 2, STYLE_DASHDOT: 3, STYLE_DASHDOTDOT: 4, EMPTY_VALUE: EMPTY, EMPTY: -1, INIT_SUCCEEDED: 0, INIT_FAILED: 1, NULL: 0, 'true': true, 'false': false, INDICATOR_DATA: 0, INDICATOR_COLOR_INDEX: 1, INDICATOR_CALCULATIONS: 2, PERIOD_CURRENT: 0, DBL_MAX: 1.7976931348623157e308, INT_MAX: 2147483647, M_PI: Math.PI, PLOT_DRAW_TYPE: 100, PLOT_LINE_COLOR: 101, PLOT_LINE_WIDTH: 102, PLOT_LABEL: 103, PLOT_EMPTY_VALUE: 104, PLOT_DRAW_BEGIN: 105, PLOT_LINE_STYLE: 106, INDICATOR_SHORTNAME: 200, INDICATOR_DIGITS: 201, MAIN_LINE: 0, SIGNAL_LINE: 1, UPPER_BAND: 1, LOWER_BAND: 2, BASE_LINE: 0, WHOLE_ARRAY: 0 };
  var MQL_CLR = { clrred: 'red', clrgreen: 'green', clrblue: 'blue', clrorange: 'orange', clryellow: 'yellow', clrpurple: 'purple', clraqua: 'aqua', clrlime: 'lime', clrmagenta: 'magenta', clrfuchsia: 'fuchsia', clrmaroon: 'maroon', clrnavy: 'navy', clrolive: 'olive', clrsilver: 'silver', clrgray: 'gray', clrwhite: 'white', clrblack: 'black', clrpink: 'pink', clrgold: 'gold', clrbrown: 'brown', clrviolet: 'violet', clrteal: 'teal', clrdodgerblue: 'blue', clrroyalblue: 'blue', clrdeepskyblue: 'aqua', clrcrimson: 'red', clrtomato: 'red', clrorangered: 'orange', clrlimegreen: 'green', clrforestgreen: 'green', clrseagreen: 'teal', clrdarkorange: 'orange', clrgoldenrod: 'gold', clrdarkviolet: 'violet', clrmediumseagreen: 'teal', clrfirebrick: 'maroon', clrslategray: 'gray', clrdimgray: 'gray', clrlightgray: 'silver', clrsteelblue: 'blue', clrcyan: 'cyan', clrkhaki: 'yellow', clrindianred: 'red', clrdarkgreen: 'green', clrmediumvioletred: 'pink', clrnone: null };
  function mqlColor(name) { var k = String(name).toLowerCase(); if (k.indexOf('clr') !== 0) k = 'clr' + k; if (k in MQL_CLR) return MQL_CLR[k] ? COLORS[MQL_CLR[k]] : null; return undefined; }

  function mqlParse(code) {
    var props = {}, body = [];
    String(code).replace(/\r/g, '').split('\n').forEach(function (l) { var m = /^\s*#property\s+(\w+)\s*(.*?)\s*$/.exec(l); if (m) { props[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); body.push(''); } else if (/^\s*#/.test(l)) body.push(''); else body.push(l); });
    var T = lex(body.join('\n'), 1, false), p = 0, nid = 0;
    var isOp = function (v) { return T[p] && T[p].t === 'op' && T[p].v === v; }, isId = function (v) { return T[p] && T[p].t === 'id' && (v == null || T[p].v === v); };
    var lnOf = function () { return (T[p] || T[T.length - 1] || { ln: 0 }).ln; };
    var eat = function (v) { if (!isOp(v)) throw fail('Expected "' + v + '"' + (T[p] ? ' before "' + T[p].v + '"' : ''), lnOf()); p++; };
    var node = function (o) { o.id = ++nid; o.ln = lnOf(); return o; };
    function expr() { return assign(); }
    function assign() { var a = tern(); if (T[p] && T[p].t === 'op' && ['=', '+=', '-=', '*=', '/='].indexOf(T[p].v) >= 0) { var o = T[p++].v; if (a.k !== 'name' && a.k !== 'idx') throw fail('Cannot assign to this', a.ln); return node({ k: 'asg', o: o, a: a, b: assign() }); } return a; }
    function tern() { var c = or(); if (isOp('?')) { p++; var a = assign(); eat(':'); var b = assign(); return node({ k: 'tern', c: c, a: a, b: b }); } return c; }
    function or() { var a = and(); while (isOp('||')) { p++; a = node({ k: 'or', a: a, b: and() }); } return a; }
    function and() { var a = cmp(); while (isOp('&&')) { p++; a = node({ k: 'and', a: a, b: cmp() }); } return a; }
    function cmp() { var a = add(); while (T[p] && T[p].t === 'op' && ['==', '!=', '<', '>', '<=', '>='].indexOf(T[p].v) >= 0) { var o = T[p++].v; a = node({ k: 'bin', o: o, a: a, b: add() }); } return a; }
    function add() { var a = mul(); while (isOp('+') || isOp('-')) { var o = T[p++].v; a = node({ k: 'bin', o: o, a: a, b: mul() }); } return a; }
    function mul() { var a = un(); while (isOp('*') || isOp('/') || isOp('%')) { var o = T[p++].v; a = node({ k: 'bin', o: o, a: a, b: un() }); } return a; }
    function un() {
      if (isOp('-')) { p++; return node({ k: 'neg', a: un() }); } if (isOp('+')) { p++; return un(); } if (isOp('!')) { p++; return node({ k: 'not', a: un() }); }
      if (isOp('++') || isOp('--')) { var o = T[p++].v, a = un(); return node({ k: 'inc', o: o, a: a, pre: true }); }
      if (isOp('(') && T[p + 1] && T[p + 1].t === 'id' && MQL_TYPES[T[p + 1].v] && T[p + 2] && T[p + 2].v === ')') { var ty = T[p + 1].v; p += 3; return node({ k: 'cast', ty: ty, a: un() }); }
      return post();
    }
    function post() {
      var a = prim();
      for (;;) {
        if (isOp('(')) { p++; var args = []; while (!isOp(')')) { args.push(assign()); if (isOp(',')) p++; else if (!isOp(')')) throw fail('Expected "," or ")"', lnOf()); } p++; a = node({ k: 'call', f: a.v, args: args }); continue; }
        if (isOp('[')) { p++; var ix = expr(); eat(']'); a = node({ k: 'idx', a: a, i: ix }); continue; }
        if (isOp('++') || isOp('--')) { var o = T[p++].v; a = node({ k: 'inc', o: o, a: a, pre: false }); continue; }
        return a;
      }
    }
    function prim() {
      var t = T[p]; if (!t) throw fail('Unexpected end of the code', lnOf());
      if (t.t === 'num' || t.t === 'str') { p++; return node({ k: 'lit', v: t.v }); }
      if (t.t === 'id') { p++; return node({ k: 'name', v: t.v }); }
      if (isOp('(')) { p++; var e = expr(); eat(')'); return e; }
      throw fail('Unexpected "' + t.v + '"', t.ln);
    }
    var skipMods = function () { while (isId() && ['const', 'static', 'input', 'extern', 'sinput', 'unsigned'].indexOf(T[p].v) >= 0) p++; };
    function declRest(first) { // after a type: name [= e] | name[] | name[n], ...
      var out = [];
      for (;;) { if (isOp('&')) p++; var nm = T[p]; if (!nm || nm.t !== 'id') throw fail('Expected a name', lnOf()); p++; var arr = false, size = null, init = null;
        while (isOp('[')) { p++; arr = true; if (!isOp(']')) size = expr(); eat(']'); }
        if (isOp('=')) { p++; if (isOp('{')) { p++; var items = []; while (!isOp('}')) { items.push(assign()); if (isOp(',')) p++; } p++; init = node({ k: 'list', items: items }); } else init = assign(); }
        out.push({ name: nm.v, arr: arr, size: size, init: init, ln: nm.ln }); if (isOp(',')) { p++; continue; } break; }
      eat(';'); return { k: 'decl', vars: out, ln: first };
    }
    function statement() {
      var ln = lnOf();
      if (isOp('{')) { p++; var b = []; while (!isOp('}')) { if (p >= T.length) throw fail('A "{" is not closed', ln); b.push(statement()); } p++; return { k: 'block', body: b, ln: ln }; }
      if (isOp(';')) { p++; return { k: 'block', body: [], ln: ln }; }
      if (isId('if')) { p++; eat('('); var c = expr(); eat(')'); var a = statement(), e = null; if (isId('else')) { p++; e = statement(); } return { k: 'if', c: c, a: a, b: e, ln: ln }; }
      if (isId('for')) { p++; eat('('); var init = null; if (!isOp(';')) { skipMods(); if (isId() && MQL_TYPES[T[p].v] && T[p + 1] && T[p + 1].t === 'id') { p++; init = declRest(ln); } else { init = { k: 'expr', e: exprList(), ln: ln }; eat(';'); } } else p++; var cond = isOp(';') ? null : expr(); eat(';'); var step = isOp(')') ? null : exprList(); eat(')'); return { k: 'for', init: init, c: cond, step: step, body: statement(), ln: ln }; }
      if (isId('while')) { p++; eat('('); var wc = expr(); eat(')'); return { k: 'while', c: wc, body: statement(), ln: ln }; }
      if (isId('return')) { p++; var r = null; if (!isOp(';')) r = expr(); eat(';'); return { k: 'ret', e: r, ln: ln }; }
      if (isId('break')) { p++; eat(';'); return { k: 'brk', ln: ln }; } if (isId('continue')) { p++; eat(';'); return { k: 'cont', ln: ln }; }
      if (isId('switch') || isId('do') || isId('class') || isId('struct') || isId('enum')) throw fail('"' + T[p].v + '" is not supported here', ln);
      var save = p; skipMods();
      if (isId() && MQL_TYPES[T[p].v] && T[p + 1] && (T[p + 1].t === 'id' || T[p + 1].v === '&')) { p++; return declRest(ln); }
      p = save; var ex = { k: 'expr', e: exprList(), ln: ln }; eat(';'); return ex;
    }
    function exprList() { var e = expr(); while (isOp(',')) { p++; e = node({ k: 'seq', a: e, b: expr() }); } return e; }
    var prog = { props: props, globals: [], fns: {}, inputs: [] };
    while (p < T.length) {
      var ln = lnOf(), isInput = isId('input') || isId('extern') || isId('sinput'); skipMods();
      if (!isId() || !(MQL_TYPES[T[p].v])) throw fail('Expected a declaration' + (T[p] ? ', found "' + T[p].v + '"' : ''), ln);
      p++;
      if (T[p] && T[p].t === 'id' && T[p + 1] && T[p + 1].v === '(') { var name = T[p].v; p += 2; var params = []; while (!isOp(')')) { skipMods(); if (isId() && MQL_TYPES[T[p].v]) p++; if (isOp('&')) p++; if (isId()) { params.push(T[p].v); p++; } while (isOp('[')) { p++; if (!isOp(']')) expr(); eat(']'); } if (isOp('=')) { p++; assign(); } if (isOp(',')) p++; else if (!isOp(')')) throw fail('Bad parameter list', lnOf()); } p++; if (isOp(';')) { p++; continue; } var bd = statement(); prog.fns[name] = { params: params, body: bd, ln: ln }; continue; }
      var d = declRest(ln); d.input = isInput; prog.globals.push(d);
    }
    return prog;
  }

  function mqlRun(code, B) {
    var prog = mqlParse(code), n = B.length, steps = 0, P = prog.props;
    var mql4 = !/\bCopyBuffer\s*\(|indicator_plots|\bPlotIndexSet|\bArraySetAsSeries\s*\(/.test(code);   // MetaTrader 4 conventions (arrays newest first) unless the code is plainly MetaTrader 5
    var out = { name: (P.indicator_shortname || 'MQL indicator'), overlay: 'indicator_chart_window' in P || !('indicator_separate_window' in P), plots: [], hlines: [], notes: [] };
    // an array is always stored oldest first; `series` only turns the index round (0 = the newest), as ArraySetAsSeries does
    var ARR = function (a, series) { return { arr: true, a: a, series: series }; };
    var price = function (f) { return B.map(function (b) { return f(b); }); };
    var SER = { Open: price(function (b) { return b.open; }), High: price(function (b) { return b.high; }), Low: price(function (b) { return b.low; }), Close: price(function (b) { return b.close; }), Volume: price(function (b) { return b.volume || 0; }), Time: price(function (b) { return b.time; }) };
    var G = {}, bufs = [], style = {}, handles = [], memo = {};
    for (var s in SER) G[s] = ARR(SER[s], true);
    var digits = (function () { var c = B.length ? B[B.length - 1].close : 1; return c > 500 ? 2 : c > 20 ? 3 : 5; })();
    G.Bars = n; G.Point = Math.pow(10, -digits); G._Point = G.Point; G.Digits = digits; G._Digits = digits; G._Symbol = ''; G._Period = 0;
    var RET = { ret: true, v: null }, BRK = { brk: true }, CONT = { cont: true };
    var idxOf = function (A, i, ln) { i = Math.round(i); var k = A.series ? A.a.length - 1 - i : i; if (!(k >= 0 && k < A.a.length)) throw fail('Array index ' + i + ' is out of range (the array has ' + A.a.length + ' values)', ln); return k; };
    var memoArr = function (key, f) { return memo[key] || (memo[key] = f()); };
    var at = function (a, shift) { var k = n - 1 - Math.round(shift); return k >= 0 && k < n && a[k] != null ? a[k] : 0; };
    var study = function (name, args) { // -> [arrays oldest first], one per line
      var key = name + ':' + args.join(',');
      return memoArr(key, function () {
        switch (name) {
          case 'iMA': return [M.ma(M.price(B, args[2] || 0), args[0], args[1] || 0)];
          case 'iRSI': return [M.rsi(M.price(B, args[1] || 0), args[0])];
          case 'iATR': return [M.rma(M.tr(B), args[0])];
          case 'iCCI': return [M.cci(M.price(B, args[1] == null ? 5 : args[1]), args[0])];
          case 'iMomentum': { var a = M.price(B, args[1] || 0); return [a.map(function (v, i) { return i >= args[0] && a[i - args[0]] ? 100 * v / a[i - args[0]] : null; })]; }
          case 'iStdDev': return [M.std(M.price(B, args[2] || 0), args[0])];
          case 'iBands': { var c = M.price(B, args[2] || 0), m = M.sma(c, args[0]), sd = M.std(c, args[0]); return [m, m.map(function (v, i) { return v == null ? null : v + args[1] * sd[i]; }), m.map(function (v, i) { return v == null ? null : v - args[1] * sd[i]; })]; }
          case 'iMACD': { var cc = M.price(B, args[3] || 0), f = M.ema(cc, args[0]), sl = M.ema(cc, args[1]), mc = cc.map(function (_, i) { return f[i] == null || sl[i] == null ? null : f[i] - sl[i]; }); return [mc, M.sma(mc, args[2])]; }
          case 'iStochastic': { var hh = M.hh(SER.High, args[0]), ll = M.ll(SER.Low, args[0]), k = SER.Close.map(function (v, i) { return hh[i] == null ? null : hh[i] > ll[i] ? 100 * (v - ll[i]) / (hh[i] - ll[i]) : 0; }); k = M.sma(k, args[2] || 1); return [k, M.sma(k, args[1] || 1)]; }
        }
        throw fail(name + ' is not supported');
      });
    };
    var F = {
      SetIndexBuffer: function (a) { if (!a[1] || !a[1].arr) throw fail('SetIndexBuffer needs an array'); var i = Math.round(a[0]); a[1].a = new Array(n).fill(mql4 ? EMPTY : 0); if (mql4) a[1].series = true; bufs[i] = { A: a[1], kind: a[2] || 0 }; return true; },
      SetIndexStyle: function (a) { var st = style[a[0]] || (style[a[0]] = {}); st.type = a[1]; if (a[3] != null && a[3] > 0) st.w = a[3]; if (typeof a[4] === 'string') st.color = a[4]; return null; },
      SetIndexLabel: function (a) { (style[a[0]] || (style[a[0]] = {})).label = a[1]; return null; },
      PlotIndexSetInteger: function (a) { var st = style[a[0]] || (style[a[0]] = {}); if (a[1] === 100) st.type = a[2]; else if (a[1] === 102) st.w = a[2]; else if (a[1] === 101) st.color = a.length > 3 ? a[3] : a[2]; return true; },
      PlotIndexSetString: function (a) { if (a[1] === 103) (style[a[0]] || (style[a[0]] = {})).label = a[2]; return true; },
      PlotIndexSetDouble: function () { return true; }, IndicatorSetInteger: function () { return true; }, IndicatorSetDouble: function () { return true; },
      IndicatorSetString: function (a) { if (a[0] === 200 && typeof a[1] === 'string') out.name = a[1].slice(0, 60); return true; },
      IndicatorShortName: function (a) { if (typeof a[0] === 'string') out.name = a[0].slice(0, 60); return null; },
      IndicatorBuffers: function () { return null; }, IndicatorDigits: function () { return null; }, SetIndexDrawBegin: function () { return null; }, SetIndexEmptyValue: function () { return null; }, SetIndexArrow: function () { return null; }, SetIndexShift: function () { return null; }, SetLevelValue: function (a) { if (isNum(a[1])) out.hlines.push({ price: a[1], title: '', color: null }); return null; }, SetLevelStyle: function () { return null; },
      IndicatorCounted: function () { return 0; }, Period: function () { return 0; }, Symbol: function () { return ''; }, Print: function () { return null; }, Comment: function () { return null; }, Alert: function () { return null; }, PlaySound: function () { return null; }, GetLastError: function () { return 0; }, ResetLastError: function () { return null; }, IsStopped: function () { return false; }, RefreshRates: function () { return true; }, TimeCurrent: function () { return n ? B[n - 1].time : 0; }, iBars: function () { return n; }, BarsCalculated: function () { return n; }, IndicatorRelease: function () { return true; },
      ArraySetAsSeries: function (a) { if (a[0] && a[0].arr) a[0].series = !!a[1]; return true; }, ArrayGetAsSeries: function (a) { return !!(a[0] && a[0].series); },
      ArrayInitialize: function (a) { if (a[0] && a[0].arr) a[0].a.fill(a[1]); return null; }, ArrayResize: function (a) { if (a[0] && a[0].arr) { var k = Math.max(0, Math.min(200000, Math.round(a[1]))); while (a[0].a.length < k) a[0].a.push(0); a[0].a.length = k; } return a[1]; },
      ArraySize: function (a) { return a[0] && a[0].arr ? a[0].a.length : 0; }, ArrayRange: function (a) { return a[0] && a[0].arr ? a[0].a.length : 0; }, ArrayFree: function () { return null; },
      ArrayMaximum: function (a) { return mqlExt(a, 1); }, ArrayMinimum: function (a) { return mqlExt(a, -1); },
      MathAbs: function (a) { return Math.abs(a[0]); }, MathMax: function (a) { return Math.max(a[0], a[1]); }, MathMin: function (a) { return Math.min(a[0], a[1]); }, MathSqrt: function (a) { return Math.sqrt(a[0]); }, MathPow: function (a) { return Math.pow(a[0], a[1]); }, MathLog: function (a) { return Math.log(a[0]); }, MathLog10: function (a) { return Math.log10(a[0]); }, MathExp: function (a) { return Math.exp(a[0]); }, MathRound: function (a) { return Math.round(a[0]); }, MathFloor: function (a) { return Math.floor(a[0]); }, MathCeil: function (a) { return Math.ceil(a[0]); }, MathMod: function (a) { return a[0] % a[1]; }, MathSin: function (a) { return Math.sin(a[0]); }, MathCos: function (a) { return Math.cos(a[0]); },
      fabs: function (a) { return Math.abs(a[0]); }, fmax: function (a) { return Math.max(a[0], a[1]); }, fmin: function (a) { return Math.min(a[0], a[1]); }, sqrt: function (a) { return Math.sqrt(a[0]); }, pow: function (a) { return Math.pow(a[0], a[1]); }, log: function (a) { return Math.log(a[0]); }, exp: function (a) { return Math.exp(a[0]); }, round: function (a) { return Math.round(a[0]); }, floor: function (a) { return Math.floor(a[0]); }, ceil: function (a) { return Math.ceil(a[0]); }, fmod: function (a) { return a[0] % a[1]; },
      NormalizeDouble: function (a) { var k = Math.pow(10, a[1]); return Math.round(a[0] * k) / k; }, DoubleToString: function (a) { return Number(a[0]).toFixed(a[1] == null ? 8 : a[1]); }, DoubleToStr: function (a) { return Number(a[0]).toFixed(a[1] == null ? 4 : a[1]); }, IntegerToString: function (a) { return String(Math.round(a[0])); }, StringConcatenate: function (a) { return a.join(''); }, StringFormat: function (a) { return String(a[0]); },
      iClose: function (a) { return at(SER.Close, a[2]); }, iOpen: function (a) { return at(SER.Open, a[2]); }, iHigh: function (a) { return at(SER.High, a[2]); }, iLow: function (a) { return at(SER.Low, a[2]); }, iVolume: function (a) { return at(SER.Volume, a[2]); }, iTime: function (a) { return at(SER.Time, a[2]); },
      iHighest: function (a) { return hiLo(a, 1); }, iLowest: function (a) { return hiLo(a, -1); },
      iMAOnArray: function (a) { var A = a[0]; if (!A || !A.arr) throw fail('iMAOnArray needs an array'); var chron = A.a.slice(), clean = chron.map(function (v) { return v === EMPTY ? null : v; }), m = M.ma(clean, a[2], a[4] || 0), k = chron.length - 1 - Math.round(a[5]); return k >= 0 && m[k] != null ? m[k] : 0; },
      CopyBuffer: function (a) { var h = handles[a[0]]; if (!h) throw fail('CopyBuffer: unknown handle'); var src = h[Math.round(a[1])] || h[0], A = a[4]; if (!A || !A.arr) throw fail('CopyBuffer needs an array'); var start = Math.round(a[2]), cnt = Math.min(n - start, Math.round(a[3])); if (cnt <= 0) return 0; var chunk = src.slice(n - start - cnt, n - start).map(function (v) { return v == null ? 0 : v; }); if (bufs.some(function (b) { return b && b.A === A; }) && A.a.length === n) { for (var i = 0; i < cnt; i++) A.a[n - start - cnt + i] = chunk[i]; } else A.a = chunk; return cnt; },
      CopyClose: function (a) { return copySer(a, SER.Close); }, CopyOpen: function (a) { return copySer(a, SER.Open); }, CopyHigh: function (a) { return copySer(a, SER.High); }, CopyLow: function (a) { return copySer(a, SER.Low); }, CopyTime: function (a) { return copySer(a, SER.Time); }
    };
    function copySer(a, src) { var A = a[4]; if (!A || !A.arr) throw fail('The copy needs an array'); var start = Math.round(a[2]), cnt = Math.min(n - start, Math.round(a[3])); if (cnt <= 0) return 0; A.a = src.slice(n - start - cnt, n - start); return cnt; }
    function mqlExt(a, sign) { var A = a[0]; if (!A || !A.arr) return -1; var cnt, start; if (mql4) { cnt = a[1]; start = a[2]; } else { start = a[1]; cnt = a[2]; } start = Math.round(start || 0); cnt = !cnt || cnt < 0 ? A.a.length - start : Math.round(cnt); var best = -1, bv = sign > 0 ? -Infinity : Infinity; for (var i = start; i < start + cnt && i < A.a.length; i++) { var v = A.a[idxOf(A, i)]; if (sign > 0 ? v > bv : v < bv) { bv = v; best = i; } } return best; }
    function hiLo(a, sign) { var src = [SER.Open, SER.Low, SER.High, SER.Close, SER.Volume][Math.round(a[2])] || (sign > 0 ? SER.High : SER.Low), cnt = Math.round(a[3]), start = Math.round(a[4] || 0), best = -1, bv = sign > 0 ? -Infinity : Infinity; for (var i = start; i < start + cnt; i++) { var k = n - 1 - i; if (k < 0) break; if (sign > 0 ? src[k] > bv : src[k] < bv) { bv = src[k]; best = i; } } return best; }
    var STUDY_ARGS = { iMA: { m4: 7, pick: function (a) { return [a[2], a[4], a[5]]; }, shift: function (a) { return a[6]; }, m5: function (a) { return [a[2], a[4], a[5]]; } }, iRSI: { m4: 5, pick: function (a) { return [a[2], a[3]]; }, shift: function (a) { return a[4]; }, m5: function (a) { return [a[2], a[3]]; } }, iATR: { m4: 4, pick: function (a) { return [a[2]]; }, shift: function (a) { return a[3]; }, m5: function (a) { return [a[2]]; } }, iCCI: { m4: 5, pick: function (a) { return [a[2], a[3]]; }, shift: function (a) { return a[4]; }, m5: function (a) { return [a[2], a[3]]; } }, iMomentum: { m4: 5, pick: function (a) { return [a[2], a[3]]; }, shift: function (a) { return a[4]; }, m5: function (a) { return [a[2], a[3]]; } }, iStdDev: { m4: 7, pick: function (a) { return [a[2], a[4], a[5]]; }, shift: function (a) { return a[6]; }, m5: function (a) { return [a[2], a[4], a[5]]; } }, iBands: { m4: 8, pick: function (a) { return [a[2], a[3], a[5]]; }, shift: function (a) { return a[7]; }, line: function (a) { return a[6]; }, m5: function (a) { return [a[2], a[4], a[5]]; } }, iMACD: { m4: 8, pick: function (a) { return [a[2], a[3], a[4], a[5]]; }, shift: function (a) { return a[7]; }, line: function (a) { return a[6]; }, m5: function (a) { return [a[2], a[3], a[4], a[5]]; } }, iStochastic: { m4: 10, pick: function (a) { return [a[2], a[3], a[4]]; }, shift: function (a) { return a[9]; }, line: function (a) { return a[8]; }, m5: function (a) { return [a[2], a[3], a[4]]; } } };
    function callFn(name, args, ln) {
      if (prog.fns[name]) { var fn = prog.fns[name], env = { v: {}, up: null }; fn.params.forEach(function (pn, i) { env.v[pn] = args[i] === undefined ? 0 : args[i]; }); var r = exec(fn.body, env); return r && r.ret ? r.v : null; }
      var sa = STUDY_ARGS[name];
      if (sa) { if (args.length >= sa.m4) { var L = study(name, sa.pick(args)), line = sa.line ? Math.round(sa.line(args)) : 0; return at(L[line] || L[0], sa.shift(args)); } handles.push(study(name, sa.m5(args))); return handles.length - 1; }
      if (F[name]) return F[name](args);
      throw fail('Unknown function "' + name + '"', ln);
    }
    function lookup(name, env, ln) {
      for (var e = env; e; e = e.up) if (Object.prototype.hasOwnProperty.call(e.v, name)) return e.v[name];
      if (Object.prototype.hasOwnProperty.call(G, name)) return G[name];
      if (Object.prototype.hasOwnProperty.call(MQL_CONST, name)) return MQL_CONST[name];
      var c = /^clr/i.test(name) ? mqlColor(name) : (COLORS[name.toLowerCase()] && /^[A-Z]/.test(name) ? COLORS[name.toLowerCase()] : undefined); if (c !== undefined) return c;
      if (/^(PERIOD|TIME|SYMBOL|ACCOUNT|TERMINAL|MQL|CHART|OBJ|OBJPROP|ANCHOR|ALIGN|TRADE|ORDER|POSITION|DEAL|SERIES|VOLUME|ERR)_/.test(name)) return 0;
      throw fail('Unknown name "' + name + '"', ln);
    }
    function store(x, v, env) {
      if (x.k === 'name') { for (var e = env; e; e = e.up) if (Object.prototype.hasOwnProperty.call(e.v, x.v)) { e.v[x.v] = v; return; } if (Object.prototype.hasOwnProperty.call(G, x.v)) { G[x.v] = v; return; } throw fail('"' + x.v + '" is not declared', x.ln); }
      var A = ev(x.a, env); if (!A || !A.arr) throw fail('This is not an array', x.ln); A.a[idxOf(A, ev(x.i, env), x.ln)] = v;
    }
    function ev(x, env) {
      if (++steps > BUDGET) throw fail('The indicator takes too long to run');
      switch (x.k) {
        case 'lit': return x.v;
        case 'name': return lookup(x.v, env, x.ln);
        case 'neg': return -ev(x.a, env);
        case 'not': return !ev(x.a, env);
        case 'cast': { var cv = ev(x.a, env); return /int|long|short|char/.test(x.ty) ? Math.trunc(cv) : x.ty === 'bool' ? !!cv : cv; }
        case 'and': return !!ev(x.a, env) && !!ev(x.b, env);
        case 'or': return !!ev(x.a, env) || !!ev(x.b, env);
        case 'tern': return ev(x.c, env) ? ev(x.a, env) : ev(x.b, env);
        case 'seq': ev(x.a, env); return ev(x.b, env);
        case 'list': return x.items.map(function (q) { return ev(q, env); });
        case 'bin': { var l = ev(x.a, env), r = ev(x.b, env); if (typeof l === 'boolean') l = l ? 1 : 0; if (typeof r === 'boolean') r = r ? 1 : 0;
          switch (x.o) { case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return r === 0 ? 0 : l / r; case '%': return r === 0 ? 0 : l % r; case '<': return l < r; case '>': return l > r; case '<=': return l <= r; case '>=': return l >= r; case '==': return l === r; case '!=': return l !== r; } return 0; }
        case 'idx': { var A = ev(x.a, env); if (!A || !A.arr) throw fail('This is not an array', x.ln); var v = A.a[idxOf(A, ev(x.i, env), x.ln)]; return v === undefined ? 0 : v; }
        case 'asg': { var nv = ev(x.b, env); if (x.o !== '=') { var cur = ev(x.a, env); nv = x.o === '+=' ? cur + nv : x.o === '-=' ? cur - nv : x.o === '*=' ? cur * nv : nv === 0 ? 0 : cur / nv; } store(x.a, nv, env); return nv; }
        case 'inc': { var c0 = ev(x.a, env), c1 = c0 + (x.o === '++' ? 1 : -1); store(x.a, c1, env); return x.pre ? c1 : c0; }
        case 'call': return callFn(x.f, x.args.map(function (q) { return ev(q, env); }), x.ln);
      }
      throw fail('Cannot evaluate this', x.ln);
    }
    function declare(d, env) {
      d.vars.forEach(function (v) {
        var val;
        if (v.arr) { var size = v.size ? Math.max(0, Math.min(200000, Math.round(ev(v.size, env)))) : 0, init = v.init ? ev(v.init, env) : null; val = ARR(Array.isArray(init) ? init.slice() : new Array(size).fill(0), false); }
        else val = v.init ? ev(v.init, env) : 0;
        if (env) env.v[v.name] = val; else G[v.name] = val;
      });
    }
    function exec(s, env) {
      if (++steps > BUDGET) throw fail('The indicator takes too long to run');
      switch (s.k) {
        case 'block': { var loc = { v: {}, up: env }; for (var i = 0; i < s.body.length; i++) { var r = exec(s.body[i], loc); if (r) return r; } return null; }
        case 'decl': declare(s, env); return null;
        case 'expr': ev(s.e, env); return null;
        case 'if': return ev(s.c, env) ? exec(s.a, env) : s.b ? exec(s.b, env) : null;
        case 'for': { var lf = { v: {}, up: env }; if (s.init) exec(s.init, lf); while (!s.c || ev(s.c, lf)) { var r2 = exec(s.body, lf); if (r2 && r2.brk) break; if (r2 && r2.ret) return r2; if (s.step) ev(s.step, lf); } return null; }
        case 'while': { while (ev(s.c, env)) { var r3 = exec(s.body, env); if (r3 && r3.brk) break; if (r3 && r3.ret) return r3; } return null; }
        case 'ret': return { ret: true, v: s.e ? ev(s.e, env) : null };
        case 'brk': return BRK; case 'cont': return CONT;
      }
      return null;
    }
    void RET;
    prog.globals.forEach(function (d) { declare(d, null); });
    var entry = prog.fns.OnCalculate ? 'OnCalculate' : prog.fns.start ? 'start' : null;
    if (!entry) throw fail('The indicator needs an OnCalculate (or start) function');
    if (prog.fns.OnInit) callFn('OnInit', []); else if (prog.fns.init) callFn('init', []);
    if (entry === 'OnCalculate') { var ps = prog.fns.OnCalculate.params, ser = mql4, mk = function (a) { return ARR(a, ser); };
      if (ps.length <= 4) callFn('OnCalculate', [n, 0, 0, mk(SER.Close)]);
      else callFn('OnCalculate', [n, 0, mk(SER.Time), mk(SER.Open), mk(SER.High), mk(SER.Low), mk(SER.Close), mk(SER.Volume), mk(SER.Volume), mk(new Array(n).fill(0))]); }
    else callFn('start', []);
    var PAL = ['#2962ff', '#ff9800', '#9c27b0', '#00bcd4', '#e91e63', '#4caf50', '#795548', '#607d8b'];
    bufs.forEach(function (b, i) {
      if (!b || b.kind === 2 || b.kind === 1) return; var st = style[i] || {}, type = st.type != null ? st.type : (function () { var t = P['indicator_type' + (i + 1)]; return t && MQL_CONST[t] != null ? MQL_CONST[t] : 0; })();
      if (type === 12) return;
      var vals = b.A.a.slice().map(function (v) { return v === EMPTY || !isNum(v) || (v === 0 && out.overlay) ? null : v; });
      while (vals.length < n) vals.unshift(null); if (vals.length > n) vals = vals.slice(vals.length - n);
      var f0 = vals.findIndex(function (v) { return v != null && v !== 0; }); for (var z = 0; z < (f0 < 0 ? vals.length : f0); z++) vals[z] = null;   // the zeros a study gives before it has enough candles are not drawn
      var pc = P['indicator_color' + (i + 1)], col = st.color || (pc ? (mqlColor(pc.split(',')[0].trim()) || null) : null) || PAL[i % PAL.length];
      out.plots.push({ title: (st.label || P['indicator_label' + (i + 1)] || out.name + (bufs.length > 1 ? ' ' + (i + 1) : '')).slice(0, 40), color: col, w: Math.max(1, Math.min(4, +(st.w || P['indicator_width' + (i + 1)] || 1.5))), hist: type === 2, dots: type === 3, v: vals, cols: null });
    });
    for (var q = 1; q <= 8; q++) { var lv = P['indicator_level' + q]; if (lv != null && isFinite(+lv)) out.hlines.push({ price: +lv, title: '', color: null }); }
    if (!out.plots.length) throw fail('The indicator filled no buffer: use SetIndexBuffer and write values into it');
    out.dialect = mql4 ? 'MQL4' : 'MQL5';
    return out;
  }

  var EXAMPLES = {
    pine: '//@version=5\nindicator("My EMA cross", overlay=true)\nfast = input.int(9, "Fast")\nslow = input.int(21, "Slow")\na = ta.ema(close, fast)\nb = ta.ema(close, slow)\nplot(a, "Fast EMA", color=color.orange)\nplot(b, "Slow EMA", color=color.blue, linewidth=2)\nplotshape(ta.crossover(a, b), title="Cross up", location=location.belowbar, color=color.green)\nplotshape(ta.crossunder(a, b), title="Cross down", location=location.abovebar, color=color.red)\n',
    mql: '#property indicator_separate_window\n#property indicator_buffers 1\n#property indicator_color1 clrDodgerBlue\n#property indicator_level1 70\n#property indicator_level2 30\n\ninput int RsiPeriod = 14;\ndouble Rsi[];\n\nint OnInit()\n  {\n   SetIndexBuffer(0, Rsi);\n   IndicatorShortName("My RSI");\n   return(INIT_SUCCEEDED);\n  }\n\nint OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[],\n                const double &open[], const double &high[], const double &low[], const double &close[],\n                const long &tick_volume[], const long &volume[], const int &spread[])\n  {\n   for(int i = rates_total - RsiPeriod - 2; i >= 0; i--)\n      Rsi[i] = iRSI(NULL, 0, RsiPeriod, PRICE_CLOSE, i);\n   return(rates_total);\n  }\n'
  };
  function run(lang, code, bars) {
    if (typeof code !== 'string' || !code.trim()) throw fail('Write some code first');
    if (code.length > 20000) throw fail('The script is too long (20,000 characters at most)');
    var B = (bars || []).filter(function (b) { return b && isNum(b.open) && isNum(b.high) && isNum(b.low) && isNum(b.close); });
    if (B.length < 5) throw fail('No candles to run on yet');
    try { return lang === 'mql' ? mqlRun(code, B) : pineRun(code, B); }
    catch (e) { if (e && e.script) throw e; throw fail(e instanceof RangeError ? 'The script nests too deeply' : 'The script could not be run: ' + (e && e.message || e)); }
  }
  var API = { run: run, EXAMPLES: EXAMPLES, M: M, guess: function (code) { return /#property|OnCalculate|SetIndexBuffer|\bint\s+start\s*\(/.test(code || '') ? 'mql' : 'pine'; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MS_SCRIPT = API;
})(typeof window !== 'undefined' ? window : null);
