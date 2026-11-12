// Council · What to expect (8 Nov 2026, owner: "what should each live system do, and when can I judge it?")
// Per LIVE system, what the untouched-data studies say to expect, not the in-sample backtest the rule was built on:
//   gold systems        research/edge/gold-systems-oos (2006-17 out of sample) + the 2018-26 rebuilds (robustness/out)
//   NQ open run         research/edge/nq-open-oos (2004-22 untouched vs 2023-26 built on)
//   gold replica        research/edge/replica-oos (2017-22 vs 2023-26)
//   ICT A-setups        research/edge/ict-oos-2008 (2008-17 vs 2018-26)
//   Mosha BO            research/edge/gold-systems + the robustness audit's independent 2018-26 rebuild
//   crypto trend        research/edge/crypto-trend-decay (shadow since 7 Nov)
//   gold momentum       robustness rebuild 2018-22 vs 2023-26
// The study numbers live in council/expect-base.json, written by research/edge/expectations/build.mjs from the studies' own
// per-position records (so the test can check them against each result.json). This module is pure maths over that file and
// the decay monitor's reading of the forward record (coach.json decay, council/decay.mjs). It changes nothing: no rule, no
// size, no filter; the owner decides.
//
// Per system (all R net of costs, one point = one position):
//   perTrade   the honest window's R a trade with a 5-95% band of the ESTIMATE: exp ± 1.645 · sd / √n
//   perYear    what ONE YEAR of trades at that edge can show: N·exp ± 1.645 · sd · √N, N = the window's trades a year
//   dd         the drawdown to plan for, from the 95th percentile of reshuffled orders of the baseline record (decay.mjs
//              mcDrawdown, council/decay-base.json mcDD: what luck alone does if the backtest regime holds) to the worst the
//              untouched history produced; shown "−x to −y R"
//   verdict    trades until the forward record can be judged: n at which t ≥ 2 if the edge is what the study says,
//              n = (2 · sd / exp)², converted to time at the window's trade rate, capped at 2 years; given for the honest edge
//              and for the backtest edge the decay monitor watches (decay-base ref)
//   forward    the live record so far (decay `fwd`: n, exp) against the honest band for that n: 'above' | 'below' | null;
//              judged from 10 trades. The daily digest names a live system only when it is outside its band.
import fs from 'node:fs';

export const EX = {
  z: 1.645,        // 5-95% two-sided band
  tBar: 2,         // a verdict is t >= 2 on the forward record
  capYears: 2,     // "trades until a verdict" is reported up to 2 years; beyond that: no verdict within 2 years
  minFwd: 10,      // fewer forward trades than this: the record is not placed against its band
};
export const BASE_FILE = new URL('./expect-base.json', import.meta.url);
export function loadExpectBase(file = BASE_FILE) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

const num = (v) => typeof v === 'number' && Number.isFinite(v);
export const r2 = (v) => num(v) ? Math.round(v * 100) / 100 : v;
export const r3 = (v) => num(v) ? Math.round(v * 1000) / 1000 : v;
export const fR = (v, d = 2) => num(v) ? `${v > 0.5 * 10 ** -d ? '+' : v < -0.5 * 10 ** -d ? '−' : ''}${Math.abs(v).toFixed(d)}R` : '—';
// a band as the owner reads it: "−3 to +10R" (one decimal below 10R, none above)
export const fBand = (lo, hi, d) => { const f = (v) => { const a = Math.abs(v), s = a.toFixed(num(d) ? d : a < 10 ? 1 : 0); return `${v < 0 && +s !== 0 ? '−' : v > 0 && +s !== 0 ? '+' : ''}${s}`; }; return `${f(lo)} to ${f(hi)}R`; };
export const fDD = (lo, hi) => { const f = (v) => Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(0); return lo === hi ? `−${f(lo)}R` : `−${f(lo)} to −${f(hi)}R`; };
export const fTime = (years) => { if (!num(years)) return ''; const m = Math.round(years * 12); return m < 1 ? 'under a month' : m < 24 ? `about ${m} month${m === 1 ? '' : 's'}` : `about ${(years).toFixed(1)} years`; };

// ─── statistics (own copy: this module must not import decay.mjs, digest.mjs imports this one) ───
export function describe(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: 0, sd: 0, t: 0, sum: 0 };
  const sum = xs.reduce((s, x) => s + x, 0), mean = sum / n, sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, sum };
}
export function drawdown(xs) { let eq = 0, pk = 0, max = 0; for (const x of xs) { eq += x; if (eq > pk) pk = eq; if (pk - eq > max) max = pk - eq; } return { cur: pk - eq, max }; }
// 5-95% band of the mean of n draws with this sd (the estimate's band, or the band a forward record of n trades should sit in)
export function seBand(exp, sd, n, z = EX.z) { const h = n > 0 && sd > 0 ? z * sd / Math.sqrt(n) : 0; return { lo: exp - h, hi: exp + h }; }
// what one year of N trades can realise: N·exp ± z · sd · √N
export function yearBand(exp, sd, N, z = EX.z) { const h = N > 0 && sd > 0 ? z * sd * Math.sqrt(N) : 0; return { trades: N, exp: exp * N, lo: exp * N - h, hi: exp * N + h }; }
// trades until t >= tBar if the edge is exp with this sd: n = (tBar · sd / exp)²; null when exp <= 0 (never)
export function nVerdict(exp, sd, perYear, { tBar = EX.tBar, capYears = EX.capYears } = {}) {
  if (!(exp > 0) || !(sd > 0)) return { n: null, years: null, within: false };
  const n = Math.ceil((tBar * sd / exp) ** 2), years = perYear > 0 ? n / perYear : null;
  return { n, years: num(years) ? r2(years) : null, within: num(years) && years <= capYears };
}
// the forward record against the honest band for its own n
export function forwardCheck(fwd, honest, { minFwd = EX.minFwd } = {}) {
  if (!fwd || !num(fwd.n) || fwd.n <= 0 || !num(fwd.exp)) return null;
  const b = seBand(honest.exp, honest.sd, fwd.n);
  const judged = fwd.n >= minFwd, out = judged ? (fwd.exp > b.hi ? 'above' : fwd.exp < b.lo ? 'below' : null) : null;
  return { n: fwd.n, exp: r2(fwd.exp), R: num(fwd.R) ? r2(fwd.R) : r2(fwd.exp * fwd.n), lo: r2(b.lo), hi: r2(b.hi), judged, out };
}

// ─── one system ───
export const NEVER_YEARS = 50;   // an edge that needs more than 50 years of trades for t >= 2 is reported as one that cannot be proven
const provable = (x) => x && x.n && num(x.years) && x.years <= NEVER_YEARS;
export function verdictText(v, honest, backtest) {
  if (v.honest.within) return `${v.honest.n} trades (${fTime(v.honest.years)}) at its out-of-sample edge of ${fR(honest.exp)} a trade`;
  const bt = v.backtest.within ? `${v.backtest.n} trades (${fTime(v.backtest.years)}) if it repeats its backtest (${fR(backtest.exp)} a trade)` : null;
  const hn = provable(v.honest) ? `the out-of-sample edge (${fR(honest.exp)}) would need ${v.honest.n.toLocaleString('en-GB')} trades, ${fTime(v.honest.years)}` : `an edge of ${fR(honest.exp)} a trade out of sample cannot be proven`;
  if (bt) return `${bt}; ${hn}`;
  return `no verdict within 2 years: ${hn}${provable(v.backtest) ? `; even its backtest edge (${fR(backtest.exp)}) would need ${v.backtest.n.toLocaleString('en-GB')} trades, ${fTime(v.backtest.years)}` : ''}`;
}
export function lineOf(s) {
  const h = s.honest, y = s.perYear, d = s.dd;
  const fw = s.forward ? (s.forward.judged ? `Forward so far ${fR(s.forward.exp)} a trade over ${s.forward.n}: ${s.forward.out === 'above' ? 'above' : s.forward.out === 'below' ? 'below' : 'inside'} the band ${fBand(s.forward.lo, s.forward.hi, 2)}.`
    : `Forward so far ${fR(s.forward.exp)} a trade over ${s.forward.n}: too few to place.`) : 'No forward trade yet.';
  return `Expect ${fR(h.exp)} a ${s.fin && s.fin.everyUnit ? 'position' : 'trade'}${s.fin ? (s.fin.everyUnit ? ' after financing on every unit' : ' after financing') : ''} (${fBand(s.perTrade.lo, s.perTrade.hi, 2)}) over about ${Math.round(y.trades)} trades a year, so ${fBand(y.lo, y.hi)} in a year; plan for a drawdown of ${fDD(d.lo, d.hi)}. ${fw} Verdict: ${s.verdict.text}.`;
}
// b: the base entry; dsys: this system's decay reading (for the forward record); now for the stamp
export function expectOne(b, dsys) {
  const h = b.honest, bt = b.backtest || {}, N = h.perYear;
  const pt = seBand(h.exp, h.sd, h.n), py = yearBand(h.exp, h.sd, N);
  const ddLo = Math.min(b.dd.mc95, b.dd.worst), ddHi = Math.max(b.dd.mc95, b.dd.worst);
  const v = { honest: nVerdict(h.exp, h.sd, N), backtest: nVerdict(bt.exp, bt.sd, bt.perYear) };
  const fwd = dsys && dsys.fwd ? forwardCheck(dsys.fwd, h) : null;
  const since = (dsys && dsys.shadowSince) || b.shadowSince || null;
  const o = { id: b.id, name: (dsys && dsys.name) || b.name, desk: (dsys && dsys.desk) || b.desk, live: dsys ? !!dsys.live : !!b.live, ...(since ? { shadowSince: since } : {}),
    // overnight financing (11 Nov 2026): what it takes per position in the honest window and the figure before it; null = not in this system's figures
    fin: b.fin || null,
    honest: { src: h.src, window: h.window, n: h.n, exp: r3(h.exp), sd: r3(h.sd), t: r2(h.t), perYear: r2(N), maxDD: r2(h.maxDD), study: b.study },
    backtest: { src: bt.src, window: bt.window, n: bt.n, exp: r3(bt.exp), sd: r3(bt.sd), perYear: r2(bt.perYear), maxDD: r2(bt.maxDD), mcDD: r2(bt.mcDD) },
    perTrade: { exp: r3(h.exp), lo: r3(pt.lo), hi: r3(pt.hi) },
    perYear: { trades: r2(N), exp: r2(py.exp), lo: r2(py.lo), hi: r2(py.hi) },
    dd: { lo: r2(ddLo), hi: r2(ddHi), mc95: r2(b.dd.mc95), worst: r2(b.dd.worst) },
    verdict: { ...v, text: '' },
    regime: b.regime || '',
    forward: fwd };
  o.verdict.text = verdictText(v, o.honest, o.backtest);
  o.line = lineOf(o);
  return o;
}

// ─── all systems: coach.json `expect` ───
// decay: coach.json decay (council/decay.mjs buildDecay); base: council/expect-base.json
export function buildExpect(decay, { now = Math.floor(Date.now() / 1000), base = loadExpectBase() } = {}) {
  const at = new Date(now * 1000).toISOString();
  if (!base || !Array.isArray(base.systems) || !base.systems.length) return { at, v: 1, error: 'no expectations file (council/expect-base.json)', systems: [], out: [] };
  const D = new Map(((decay && decay.systems) || []).filter((s) => s && s.id).map((s) => [s.id, s]));
  const systems = [];
  for (const b of base.systems) {
    let o; try { o = expectOne(b, D.get(b.id)); } catch (e) { o = { id: b.id, name: b.name, desk: b.desk, live: !!b.live, error: `could not read: ${e.message}`, forward: null }; }
    systems.push(o);
  }
  return { at, v: 1, baseAt: base.at, rule: 'expectations only: nothing here changes a rule, a size or a filter; the owner decides', systems,
    out: systems.filter((s) => s.live && s.forward && s.forward.out).map((s) => s.id) };
}
// daily digest: one line naming the LIVE systems whose forward record sits outside its out-of-sample band, or null
export function expectLine(expect) {
  const S = (expect && Array.isArray(expect.systems) ? expect.systems : []).filter((s) => s && s.live && s.forward && s.forward.out);
  if (!S.length) return null;
  const one = (s) => `${s.name} ${fR(s.forward.exp)} a trade over ${s.forward.n}, ${s.forward.out} its band ${fBand(s.forward.lo, s.forward.hi, 2)}`;
  const txt = S.slice(0, 2).map(one).join('; ');
  return `Expectations: ${txt.length > 160 ? txt.slice(0, 159).trimEnd() + '…' : txt}${S.length > 2 ? ` +${S.length - 2} more` : ''}. What the untouched data said to expect; no rule changed.`;
}
