// ICT lab for the MCP server (owner, 9 Nov 2026: "make a proper good MCP for Fred for him to be able to work on the ICT with
// ChatGPT"). Candles and the desk's OWN backtest engine: signals() / isASetup() / sizeOf() / P from ict/tracker.mjs and simulate()
// from ict/replay.mjs, exactly what the replay and the research scripts (research/edge/ict-universe) drive. Paper research only:
// parameter overrides live for one synchronous run and are put back before anything else can run; the live rules never change.
//
// Candles: OANDA mid H1 (the site's own source, api/bars.js; env OANDA_TOKEN / OANDA_ENV) for 2020-now, in fixed 4800-candle chunks
// cached per instance (finished chunks 6 h, the open one 5 min). Desk markets map to OANDA's cash CFDs (NQ → NAS100, ES → SPX500,
// YM → US30, RTY → US2000, GC → XAU spot, XAG spot): the levels differ from the futures, the structure is the same. Without
// OANDA, NQ / ES / YM fall back to the Dukascopy cash-index 5m files in council-data research/candles/idx/ (2023 on), and the
// answer says so. D1 = the 17:00 New York day built from the H1 candles (tracker dailyNY, as the paper markets use).
const zlib = require('node:zlib');
const { SYM, DEC, GROUP } = require('./_oanda');

const TF = { '5m': ['M5', 300], '15m': ['M15', 900], '1h': ['H1', 3600], '4h': ['H4', 14400], '1d': ['D', 86400] };
const LAB_FROM = Date.UTC(2020, 0, 1) / 1000;
const DESK = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000', gc: 'xau', xag: 'xag' };
const DUKA = { nq: 'USATECHIDXUSD', es: 'USA500IDXUSD', ym: 'USA30IDXUSD' };
// round-trip cost a trade in price units (spread + slippage on the OANDA CFDs; research/edge/ict-universe for gold / silver / FX)
const COST = { nq: 1.5, es: 0.5, ym: 3, rty: 0.4, gc: 0.5, xag: 0.03 };
const nowS = () => Math.floor(Date.now() / 1000);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const iso = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') : null);

let ENGINE = null;
async function engine() {
  if (!ENGINE) { const [t, r] = await Promise.all([import('../ict/tracker.mjs'), import('../ict/replay.mjs')]); ENGINE = { ...t, simulate: r.simulate }; }
  return ENGINE;
}

// ---- markets ----
// a desk key (nq, es, ym, rty, gc), the paper market xag, or any OANDA key from api/_oanda.js (those use the index A-setup rule)
function marketOf(key, E) {
  const k = String(key || '').toLowerCase().trim();
  if (E.MARKETS[k]) return { key: k, M: E.MARKETS[k], sym: DESK[k], kind: 'desk' };
  if (E.SHADOW_MARKETS[k]) return { key: k, M: E.SHADOW_MARKETS[k], sym: DESK[k] || E.SHADOW_MARKETS[k].md, kind: 'paper' };
  if (SYM[k]) { const dec = DEC[k]; return { key: k, M: { label: SYM[k], short: k.toUpperCase(), tick: +(10 ** -dec).toFixed(dec), dec }, sym: k, kind: 'other' }; }
  return null;
}
const symOf = (key) => { const k = String(key || '').toLowerCase().trim(); return DESK[k] || (SYM[k] ? k : null); };
const costOf = (mk, price) => COST[mk.key] ?? (GROUP[mk.sym] === 'fx' ? (/jpy/.test(mk.sym) ? 0.015 : 0.00015) : price * 0.0001);

// ---- candles ----
const CHUNK = 4800, BARS = new Map(), BARS_MAX = 140;
async function oanda(sym, tf, from, to, env) {
  const tok = env.OANDA_TOKEN; if (!tok) { const e = new Error('OANDA_TOKEN is not set on the server'); e.nodata = true; throw e; }
  const host = env.OANDA_ENV === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com';
  const p = new URLSearchParams({ granularity: TF[tf][0], price: 'M', dailyAlignment: '0', alignmentTimezone: 'Etc/UTC', weeklyAlignment: 'Monday', from: String(from), to: String(to) });
  const r = await fetch(`https://${host}/v3/instruments/${SYM[sym]}/candles?${p}`, { headers: { Authorization: `Bearer ${tok}`, 'Accept-Datetime-Format': 'UNIX' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) { const e = new Error(`OANDA ${r.status}`); e.nodata = r.status === 401 || r.status === 403; throw e; }
  const j = await r.json();
  return (j.candles || []).filter((c) => c.mid).map((c) => ({ time: Math.floor(+c.time), open: +c.mid.o, high: +c.mid.h, low: +c.mid.l, close: +c.mid.c, volume: c.volume, ...(c.complete ? {} : { live: true }) }));
}
async function chunk(sym, tf, k, env) {
  const sec = TF[tf][1], from = k * CHUNK * sec, end = from + CHUNK * sec, now = nowS(), key = `${sym}:${tf}:${k}`, c = BARS.get(key);
  const done = end <= now - 2 * sec;
  if (c && Date.now() - c.at < (done ? 6 * 3600e3 : 300e3)) return c.v;
  const v = await oanda(sym, tf, from, Math.min(end, now), env);
  BARS.delete(key); BARS.set(key, { at: Date.now(), v }); while (BARS.size > BARS_MAX) BARS.delete(BARS.keys().next().value);
  return v;
}
// candles of one OANDA key over [from, to), chunk by chunk (3 at a time), within the deadline
async function candles(sym, tf, from, to, env, deadline = Date.now() + 40e3) {
  const sec = TF[tf][1], ks = []; for (let k = Math.floor(from / (CHUNK * sec)); k <= Math.floor((to - 1) / (CHUNK * sec)); k++) ks.push(k);
  const parts = new Array(ks.length); let i = 0;
  const worker = async () => { while (i < ks.length) { const q = i++; if (Date.now() > deadline) throw Object.assign(new Error('candle download ran out of time; try a shorter range or fewer markets'), { timeout: true }); parts[q] = await chunk(sym, tf, ks[q], env); } };
  await Promise.all([worker(), worker(), worker()]);
  const m = new Map(); for (const p of parts) for (const b of p) if (b.time >= from && b.time < to) m.set(b.time, b);
  return [...m.values()].sort((a, b) => a.time - b.time);
}
// the Dukascopy cash-index fallback (council-data research/candles/idx/<SYM>_<year>.json.gz, 5m rows [t, o, h, l, c]), H1
const DK = new Map();
async function dukaH1(mkKey, from, to, io, E) {
  const sym = DUKA[mkKey]; if (!sym || !io.dataBuf) return null;
  let m5 = [];
  for (let y = Math.max(2023, new Date(from * 1000).getUTCFullYear()); y <= new Date(to * 1000).getUTCFullYear(); y++) {
    const p = `research/candles/idx/${sym}_${y}.json.gz`; let rows = DK.get(p);
    if (!rows) { const buf = await io.dataBuf(p); if (!buf) continue; rows = JSON.parse(zlib.gunzipSync(buf)); DK.set(p, rows); }
    for (const r of rows) if (r[0] >= from && r[0] < to) m5.push({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] });
  }
  return m5.length ? E.agg(m5.sort((a, b) => a.time - b.time), 3600) : null;
}
// H1 + D1 for the backtest: complete candles only, the 17:00 New York hour dropped (as the tracker's feeds)
async function labSource(mk, from, to, env, io, E, deadline) {
  const clean = (a) => a.filter((b) => !b.live && [b.open, b.high, b.low, b.close, b.time].every((v) => isFinite(v) && v > 0) && !E.inHalt(b.time))
    .map((b) => ({ time: b.time, open: +b.open, high: Math.max(b.high, b.open, b.close), low: Math.min(b.low, b.open, b.close), close: +b.close }));
  const warm = from - 140 * 86400, end = Math.min(nowS(), to + 12 * 86400);
  let H = null, src = null, note = null;
  try { H = clean(await candles(mk.sym, '1h', warm, end, env, deadline)); src = `OANDA ${SYM[mk.sym]} H1 (mid)`; }
  catch (e) {
    if (e.timeout || !e.nodata) throw e;
    H = await dukaH1(mk.key, warm, end, io, E); if (!H) throw new Error(`no candles for ${mk.key}: ${e.message}, and no council-data research file covers it`);
    H = clean(H); src = `Dukascopy ${DUKA[mk.key]} cash index 5m → H1 (council-data research/candles/idx)`; note = `OANDA is not available here (${e.message}); used the council-data research candles, which start in 2023`;
  }
  const D = E.dailyNY(H).filter((b) => b.time + 86400 <= end);
  return { H, D, src, note, first: H.length ? H[0].time : null };
}

// ---- options ----
const PARAM_SPEC = { piv: [1, 6, true], look: [24, 240, true], vmax: [1, 12, true], maxAtr: [1, 20], holdH: [6, 120, true], be: [0, 5], mark: [1, 5], trail_from: [0, 6], trail_dist: [0.25, 5] };
const SESSIONS = ['Asia', 'London', 'NY AM', 'NY PM', 'Close'];
function cleanParams(p = {}) {
  const out = {};
  for (const [k, v] of Object.entries(p || {})) {
    const s = PARAM_SPEC[k]; if (!s) throw new Error(`unknown parameter ${k}; allowed: ${Object.keys(PARAM_SPEC).join(', ')}`);
    if (typeof v !== 'number' || !isFinite(v) || v < s[0] || v > s[1] || (s[2] && !Number.isInteger(v))) throw new Error(`${k} must be ${s[2] ? 'an integer' : 'a number'} from ${s[0]} to ${s[1]}`);
    out[k] = v;
  }
  return out;
}
// the tracker's P with the overrides applied (be 0 = no break-even; trail_from 0 = no trail)
function effectiveP(P, o) {
  const e = { ...P, trail: P.trail && [...P.trail] };
  for (const k of ['piv', 'look', 'vmax', 'maxAtr', 'holdH', 'mark']) if (o[k] != null) e[k] = o[k];
  if (o.be != null) e.be = o.be > 0 ? o.be : null;
  if (o.trail_from != null || o.trail_dist != null) { const from = o.trail_from ?? (P.trail ? P.trail[0] : 2), dist = o.trail_dist ?? (P.trail ? P.trail[1] : 1.5); e.trail = from > 0 ? [from, dist] : null; }
  return e;
}
function filterFn(f = {}, E, mk) {
  const nf = (t) => E.nyFriday(t);
  const room = (g) => (g.dol != null && g.r0 > 0 ? ((g.side > 0 ? 1 : -1) * (g.dol - g.entry)) / g.r0 : null);
  return (g) => {
    if (f.min_grade != null && g.grade.total < f.min_grade) return false;
    if (f.sides && f.sides.length && !f.sides.includes(g.side > 0 ? 'buy' : 'sell')) return false;
    if (f.sessions && f.sessions.length && !f.sessions.includes(g.feat.session)) return false;
    if (f.atr_min != null && !(g.feat.atrR != null && g.feat.atrR >= f.atr_min)) return false;
    if (f.atr_max != null && !(g.feat.atrR != null && g.feat.atrR < f.atr_max)) return false;
    if (f.bias && f.bias !== 'any' && g.feat.bias !== f.bias) return false;
    if (f.zone && f.zone !== 'any' && g.feat.zone !== f.zone) return false;
    if (f.min_body != null && !(g.feat.body >= f.min_body)) return false;
    if (f.max_speed != null && !(g.feat.speed <= f.max_speed)) return false;
    if (f.htf_fvg && !g.feat.htfFvg) return false;
    if (f.skip_friday && nf(g.close)) return false;
    if (f.min_room_r != null && !(room(g) != null && room(g) >= f.min_room_r)) return false;
    return true;
  };
}

// ---- statistics ----
function stats(rs) {
  const n = rs.length; if (!n) return { n: 0, wins: 0, losses: 0, winRate: null, avgR: null, netR: 0, pf: null, maxDD: 0, t: null, worstStreak: 0 };
  const net = rs.reduce((a, x) => a + x, 0), m = net / n, sd = Math.sqrt(rs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1));
  const gp = rs.filter((x) => x > 0).reduce((a, x) => a + x, 0), gl = -rs.filter((x) => x < 0).reduce((a, x) => a + x, 0);
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of rs) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wins: rs.filter((x) => x > 0).length, losses: rs.filter((x) => x < 0).length, winRate: +(rs.filter((x) => x > 0).length / n).toFixed(3), avgR: +m.toFixed(3), netR: +net.toFixed(2),
    pf: gl > 0 ? +(gp / gl).toFixed(2) : gp > 0 ? null : 0, maxDD: +dd.toFixed(2), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, worstStreak: ws };
}
// IS / OOS split, by year, by side, and the out-of-sample screen (a screen, not a proof: the owner decides)
function summarize(trades, oosFrom) {
  const c = trades.filter((t) => t.R != null).sort((a, b) => a.t - b.t), R = (a) => a.map((t) => t.R);
  const is = c.filter((t) => t.t < oosFrom), oos = c.filter((t) => t.t >= oosFrom);
  const years = {}; for (const t of c) { const y = new Date(t.t * 1000).getUTCFullYear(); (years[y] = years[y] || []).push(t.R); }
  const byYear = Object.fromEntries(Object.entries(years).map(([y, a]) => { const s = stats(a); return [y, { n: s.n, netR: s.netR, avgR: s.avgR, winRate: s.winRate }]; }));
  const oosYears = Object.keys(years).filter((y) => Date.UTC(+y, 11, 31) / 1000 >= oosFrom), posOos = oosYears.filter((y) => byYear[y].netR > 0).length;
  const S = { all: stats(R(c)), is: stats(R(is)), oos: stats(R(oos)), byYear, bySide: { buy: stats(R(c.filter((t) => t.side === 'buy'))), sell: stats(R(c.filter((t) => t.side === 'sell'))) },
    gross: stats(c.map((t) => t.gross)), open: trades.length - c.length };
  const checks = { oos_n_at_least_30: S.oos.n >= 30, oos_avgR_positive: S.oos.avgR > 0, is_avgR_positive: S.is.avgR > 0, oos_years_positive: `${posOos} of ${oosYears.length}`, oos_t_at_least_2: S.oos.t != null && S.oos.t >= 2 };
  const pass = checks.oos_n_at_least_30 && checks.oos_avgR_positive && checks.is_avgR_positive && posOos * 3 >= oosYears.length * 2;
  return { ...S, checks, verdict: pass ? (checks.oos_t_at_least_2 ? 'passes the out-of-sample screen (t >= 2)' : 'passes the out-of-sample screen, weakly (t < 2)') : 'does NOT pass the out-of-sample screen' };
}

// ---- one market, one rule set: synchronous, so the P overrides can never leak into another run ----
function runMarket(E, mk, src, o) {
  const { from, to, rule, filters, sizing, costOn, at } = o, P = E.P, saved = { ...P, trail: P.trail && [...P.trail] }, eff = effectiveP(P, o.params || {});
  const minGrade = Math.max(E.MIN_GRADE, (filters && filters.min_grade) || 0), keep = filterFn(filters, E, mk);
  const isA = (g) => (mk.kind === 'paper' ? E.isPaperA(g, mk.key) : E.isASetup(g, mk.key));
  const size = (g) => (sizing === 'flat' || rule !== 'A' || mk.kind === 'paper' ? 1 : E.sizeOf(g, mk.key));
  Object.assign(P, eff);
  try {
    const sig = E.signals(src.H, src.D, 1, mk.M.tick).concat(E.signals(src.H, src.D, -1, mk.M.tick)).filter((g) => g.close >= from && g.close < to && g.grade.total >= minGrade).sort((a, b) => a.close - b.close);
    const H = src.H, out = []; let busy = 0, gaps = 0, considered = 0;
    const firstAt = (t) => { let lo = 0, hi = H.length; while (lo < hi) { const m = (lo + hi) >> 1; if (H[m].time < t) lo = m + 1; else hi = m; } return lo; };
    for (const g of sig) {
      if (g.close < busy || (rule === 'A' && !isA(g)) || !keep(g)) continue; considered++;
      const i = firstAt(g.close), sub = { H: H.slice(i, i + P.holdH + 160) };
      const t = E.simulate(g, mk.M, mk.key, sub, at); if (!t) { gaps++; continue; }
      const sz = size(g), cost = costOn ? costOf(mk, g.entry) / g.r0 : 0;
      out.push({ id: t.id, t: g.close, signal: iso(g.close), side: t.side, entry: t.entry, stop: t.stop, r0: t.r0, status: t.status, exit: t.exit, closed: iso(t.closed), Rraw: t.R, size: sz,
        gross: t.R == null ? null : +(sz * t.R).toFixed(3), R: t.R == null ? null : +(sz * (t.R - cost)).toFixed(3), grade: t.grade.letter, session: g.feat.session, atrR: g.feat.atrR, bias: g.feat.bias, aSetup: isA(g) });
      busy = t.closed || Infinity;
    }
    return { trades: out, signals: sig.length, considered, gaps, P: { piv: P.piv, look: P.look, vmax: P.vmax, maxAtr: P.maxAtr, holdH: P.holdH, be: mk.M.aRule ? null : P.be, trail: P.trail, mark: P.mark } };
  } finally { for (const k of Object.keys(P)) delete P[k]; Object.assign(P, saved); }
}

// ---- the tool ----
const RESULTS = new Map();   // per instance, 15 min: the same question twice costs nothing
function window_(a) {
  const now = nowS(), from = a.from ? Date.parse(a.from) / 1000 : LAB_FROM, to = a.to ? Date.parse(a.to) / 1000 + 86400 : now;
  if (!isFinite(from) || !isFinite(to)) throw new Error('from / to must be dates like 2020-01-01');
  if (from < LAB_FROM) throw new Error('from must be 2020-01-01 or later');
  if (to <= from + 30 * 86400) throw new Error('the window must be longer than 30 days');
  const oos = a.oos_from ? Date.parse(a.oos_from) / 1000 : Date.UTC(2024, 0, 1) / 1000; if (!isFinite(oos)) throw new Error('oos_from must be a date');
  return { from, to: Math.min(to, now), oos };
}
function marketsOf(a, E) {
  const list = Array.isArray(a.markets) ? a.markets : a.market ? [a.market] : ['nq', 'es', 'ym', 'rty', 'gc'];
  if (!list.length || list.length > 5) throw new Error('1 to 5 markets per run');
  return [...new Set(list.map((k) => String(k).toLowerCase()))].map((k) => { const m = marketOf(k, E); if (!m) throw new Error(`unknown market ${k}: desk nq, es, ym, rty, gc, the paper market xag, or an OANDA key like eurusd / de40`); return m; });
}
async function prepare(a, env, io, deadline) {
  const E = await engine(), w = window_(a), mks = marketsOf(a, E), params = cleanParams(a.params), filters = a.filters || {};
  for (const s of filters.sessions || []) if (!SESSIONS.includes(s)) throw new Error(`session must be one of ${SESSIONS.join(', ')}`);
  const srcs = {}; for (const mk of mks) srcs[mk.key] = await labSource(mk, w.from, w.to, env, io, E, deadline);
  return { E, w, mks, params, filters, srcs };
}
function runAll(ctx, o) {
  const { E, w, mks, srcs } = ctx, per = {}, all = [], notes = [];
  for (const mk of mks) {
    const src = srcs[mk.key], r = runMarket(E, mk, src, { from: w.from, to: w.to, at: nowS(), rule: o.rule, filters: o.filters, params: o.params, sizing: o.sizing, costOn: o.cost });
    if (src.note) notes.push(`${mk.key}: ${src.note}`);
    if (src.first && src.first > w.from + 7 * 86400) notes.push(`${mk.key}: candles start ${day(src.first)}, after the window start`);
    for (const t of r.trades) t.market = mk.key;
    all.push(...r.trades);
    per[mk.key] = { source: src.src, h1Candles: src.H.length, signals: r.signals, considered: r.considered, gaps: r.gaps, params: r.P, ...summarize(r.trades, w.oos) };
  }
  return { per, all, notes };
}
const NOTE = 'Paper research on cash candles (OANDA mid CFDs, or the research files where noted); the live desk trades futures from CNBC, so levels differ. Same engine as ict/replay.mjs; nothing here changes the live rules.';
const lean = (S) => ({ all: S.all, is: S.is, oos: S.oos, byYear: S.byYear, checks: S.checks, verdict: S.verdict });
async function backtest(a, env = process.env, io = {}) {
  const key = 'bt:' + JSON.stringify(a), c = RESULTS.get(key); if (c && Date.now() - c.at < 900e3) return { ...c.v, cached: true };
  const ctx = await prepare(a, env, io, Date.now() + (io.budgetMs || 40e3)), rule = a.rule === 'all' ? 'all' : 'A';
  const o = { rule, filters: ctx.filters, params: ctx.params, sizing: a.sizing === 'flat' ? 'flat' : 'live', cost: a.cost !== false };
  const { per, all, notes } = runAll(ctx, o), n = Math.min(Math.max(a.sample_size ?? 20, 0), 50);
  const sorted = all.filter((t) => t.R != null).sort((x, y) => y.t - x.t);
  const pick = a.sample === 'worst' ? [...sorted].sort((x, y) => x.R - y.R) : a.sample === 'best' ? [...sorted].sort((x, y) => y.R - x.R) : sorted;
  const v = { window: { from: day(ctx.w.from), to: day(ctx.w.to - 1), oos_from: day(ctx.w.oos), in_sample: `${day(ctx.w.from)} to ${day(ctx.w.oos - 86400)}`, out_of_sample: `${day(ctx.w.oos)} to ${day(ctx.w.to - 1)}` },
    rule: rule === 'A' ? 'A-setups (the live rule of each market)' : 'every signal graded >= the minimum', params_overridden: ctx.params, filters: ctx.filters, sizing: o.sizing, cost: o.cost ? 'net of a round-trip cost a trade (spread + slippage)' : 'gross',
    combined: summarize(all, ctx.w.oos), markets: Object.fromEntries(Object.entries(per).map(([k, S]) => [k, { source: S.source, h1Candles: S.h1Candles, signals: S.signals, trades: S.all.n, open: S.open, gaps: S.gaps, params: S.params, ...lean(S), bySide: S.bySide, gross: S.gross }])),
    sample: pick.slice(0, n).map(({ t, gross, ...x }) => x), notes: [...notes, NOTE] };
  v.combined = lean(v.combined);
  RESULTS.set(key, { at: Date.now(), v }); while (RESULTS.size > 60) RESULTS.delete(RESULTS.keys().next().value);
  return v;
}
// the live rule (A-setups, today's parameters) vs a proposal, on the same candles and window
async function compare(a, env = process.env, io = {}) {
  const key = 'cmp:' + JSON.stringify(a), c = RESULTS.get(key); if (c && Date.now() - c.at < 900e3) return { ...c.v, cached: true };
  const ctx = await prepare(a, env, io, Date.now() + (io.budgetMs || 40e3)), cost = a.cost !== false;
  const base = runAll(ctx, { rule: 'A', filters: {}, params: {}, sizing: 'live', cost });
  const prop = runAll(ctx, { rule: a.rule === 'all' ? 'all' : 'A', filters: ctx.filters, params: ctx.params, sizing: a.sizing === 'flat' ? 'flat' : 'live', cost });
  const B = summarize(base.all, ctx.w.oos), Q = summarize(prop.all, ctx.w.oos), d = (x, y) => (x == null || y == null ? null : +(y - x).toFixed(3));
  const delta = Object.fromEntries(['all', 'is', 'oos'].map((k) => [k, { n: Q[k].n - B[k].n, avgR: d(B[k].avgR, Q[k].avgR), netR: d(B[k].netR, Q[k].netR), winRate: d(B[k].winRate, Q[k].winRate), pf: d(B[k].pf, Q[k].pf), maxDD: d(B[k].maxDD, Q[k].maxDD) }]));
  const years = [...new Set([...Object.keys(B.byYear), ...Object.keys(Q.byYear)])].sort();
  const better = Q.oos.n >= 30 && Q.oos.avgR != null && B.oos.avgR != null && Q.oos.avgR > B.oos.avgR && Q.is.avgR > B.is.avgR;
  const v = { window: { from: day(ctx.w.from), to: day(ctx.w.to - 1), oos_from: day(ctx.w.oos) }, markets: ctx.mks.map((m) => m.key), proposal: { rule: a.rule === 'all' ? 'all' : 'A', params: ctx.params, filters: ctx.filters },
    live: lean(B), proposed: lean(Q), delta, byYear: years.map((y) => ({ year: +y, live: B.byYear[y] || null, proposed: Q.byYear[y] || null })),
    byMarket: Object.fromEntries(ctx.mks.map((m) => { const b = summarize(base.all.filter((t) => t.market === m.key), ctx.w.oos), q = summarize(prop.all.filter((t) => t.market === m.key), ctx.w.oos); return [m.key, { live: { n: b.all.n, avgR: b.all.avgR, oosAvgR: b.oos.avgR }, proposed: { n: q.all.n, avgR: q.all.avgR, oosAvgR: q.oos.avgR } }]; })),
    verdict: better ? 'the proposal beats the live rule both in sample and out of sample (n >= 30 OOS): worth a proposal with tests' : 'the proposal does not beat the live rule both in and out of sample: not a rule change yet',
    notes: [...new Set([...base.notes, ...prop.notes, NOTE])] };
  RESULTS.set(key, { at: Date.now(), v }); while (RESULTS.size > 60) RESULTS.delete(RESULTS.keys().next().value);
  return v;
}
// OHLC candles for a market / timeframe / window, compact rows, capped
async function bars(a, env = process.env) {
  const sym = symOf(a.market); if (!sym) throw new Error('unknown market: nq, es, ym, rty, gc, xag or an OANDA key like eurusd');
  const tf = TF[a.tf || '1h'] ? a.tf || '1h' : null; if (!tf) throw new Error(`tf must be one of ${Object.keys(TF).join(', ')}`);
  const sec = TF[tf][1], cap = Math.min(Math.max(a.count || 300, 1), 1500), now = nowS();
  let to = a.to ? Date.parse(a.to) / 1000 + (a.to.length <= 10 ? 86400 : 0) : now, from = a.from ? Date.parse(a.from) / 1000 : to - cap * sec * 1.6;
  if (!isFinite(from) || !isFinite(to) || to <= from) throw new Error('from / to must be dates (YYYY-MM-DD or ISO time) with from before to');
  if (from < LAB_FROM - 365 * 86400) throw new Error('from must be 2019-01-01 or later'); to = Math.min(to, now);
  if ((to - from) / sec > 20000) throw new Error('window too long for this timeframe (over 20 000 candles): narrow it or use a bigger timeframe');
  let b = await candles(sym, tf, from, to, env, Date.now() + 20e3); const total = b.length, cut = total > cap; if (cut) b = a.from && !a.to ? b.slice(0, cap) : b.slice(-cap);
  return { market: String(a.market).toLowerCase(), instrument: SYM[sym], source: 'OANDA mid', tf, from: b.length ? iso(b[0].time) : null, to: b.length ? iso(b.at(-1).time) : null, count: b.length, ...(cut ? { note: `${total} candles in the window; ${cap} returned (count caps it at 1500)` } : {}),
    cols: ['time_utc', 'open', 'high', 'low', 'close', 'volume'], rows: b.map((x) => [iso(x.time), x.open, x.high, x.low, x.close, x.volume ?? null]), ...(b.length && b.at(-1).live ? { lastIsForming: true } : {}) };
}

module.exports = { engine, marketOf, symOf, cleanParams, effectiveP, filterFn, stats, summarize, runMarket, backtest, compare, bars, candles, TF, SESSIONS, PARAM_SPEC, BARS, RESULTS, LAB_FROM, DESK };
