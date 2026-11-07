// Regime switch study (pre-registered in preregistration.md, committed 75458a96 before any indicator met any trade).
// Can a simple causal indicator (VOL: trailing 12-month realised-vol percentile, TREND: 6-month trend strength,
// META: the system's own trailing 12-month net R) tell in advance when the council's edges work? Thresholds are chosen on the
// first half of each history and judged on the second half. Paper research only; nothing live reads this.
//
//   node research/edge/regime-switch/run.mjs build <ict trades.json> <replica trades.json> <d1 cache dir>
//        -> research/edge/regime-switch/inputs.json (compact trades + daily closes; fetches OANDA D1 via the site proxy)
//   node research/edge/regime-switch/run.mjs
//        -> research/edge/regime-switch/result.json + the RESULT.md tables on stdout (reads inputs.json only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EDGE = path.join(HERE, '..');
const INPUTS = path.join(HERE, 'inputs.json'), DAY = 86400, YEAR = 365 * DAY;
const utc = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

// ---------- build: compact inputs from the existing trade histories + OANDA daily candles ----------
async function fetchD1(sym, dir) {
  const file = path.join(dir, `d1-${sym}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const got = new Map();
  for (let y = 2003; y <= 2026; y++) {
    const a = Date.UTC(y, 0, 1) / 1000, b = Date.UTC(y + 1, 0, 1) / 1000;
    let j = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=1d&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); if (r.ok) j = await r.json(); } catch { /* retry */ } if (!j) await new Promise((r) => setTimeout(r, 1500 * (k + 1))); }
    if (!j) throw new Error('fetch failed ' + sym + ' ' + y);
    for (const x of j.bars || []) if (!x.live && x.time >= a && x.time < b) got.set(x.time, [x.time, x.close]);
  }
  const rows = [...got.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(rows));
  return rows;
}

async function build([ictFile, repFile, d1Dir]) {
  const r3 = (x) => +x.toFixed(3);
  const S = {};
  // ICT A-setups (ict-oos-2008 run.mjs output): [market, cfg, side, close, aset, aplus, size, Rraw, costR, session, atrR, grade, exit, res, closed]
  const J = JSON.parse(fs.readFileSync(ictFile, 'utf8')), ci = Object.fromEntries(J.cols.map((c, i) => [c, i]));
  S.ict = J.trades.filter((r) => r[ci.cfg] === 'rule' && r[ci.aset] && r[ci.close] < utc('2026-11-01'))
    .map((r) => [r[ci.close], r[ci.closed], r3(r[ci.size] * (r[ci.Rraw] - r[ci.costR])), r3(r[ci.size] * (r[ci.Rraw] - 2 * r[ci.costR])), r[ci.market]]);
  // NQ New York open run (nq-open-oos result.json): d = ET date, m = entry minute of the ET day, exit 11:00 ET.
  // ET is taken as UTC-5 for the timestamps; only ordering against other days and against 00:00 UTC daily closes matters.
  const NQ = JSON.parse(fs.readFileSync(path.join(EDGE, 'nq-open-oos/result.json'), 'utf8'));
  S.nqopen = NQ.trades.map((x) => [utc(x.d) + (x.m + 300) * 60, utc(x.d) + (660 + 300) * 60, r3(x.R), r3(x.gross - 2 / x.r0), 'nq']);
  // gold systems (gold-systems-oos result.json positions, UTC ISO minutes); open-at-end positions are left out
  const G = JSON.parse(fs.readFileSync(path.join(EDGE, 'gold-systems-oos/result.json'), 'utf8'));
  for (const k of ['gtrend', 'gtrend5', 'gtl', 'geg']) S[k] = G.positions.filter((p) => p.sys === k && !p.atEnd)
    .map((p) => [Date.parse(p.t + 'Z') / 1000, Date.parse(p.c + 'Z') / 1000, p.n, p.n2, 'gc']);
  // gold replica (replica-oos replay.mjs trades.json): legs carry their close times; net = sum (R - cost / r0) x size
  const RP = JSON.parse(fs.readFileSync(repFile, 'utf8'));
  S.replica = RP.positions.map((p) => [p.T, Math.max(...p.legs.map((l) => l.closed)), r3(p.legs.reduce((a, l) => a + (l.R - 0.30 / l.r0) * l.size, 0)),
    r3(p.legs.reduce((a, l) => a + (l.R - 0.60 / l.r0) * l.size, 0)), 'gc']);
  for (const k in S) S[k].sort((a, b) => a[0] - b[0]);
  const d1 = {};
  for (const [m, sym] of Object.entries({ gc: 'xau', nq: 'nas100', es: 'spx500', ym: 'us30' })) {
    // drop candles that start on a Saturday or Sunday (UTC): OANDA's Sunday stub
    d1[m] = (await fetchD1(sym, d1Dir)).filter(([t]) => { const w = new Date(t * 1000).getUTCDay(); return w !== 0 && w !== 6; });
  }
  fs.writeFileSync(INPUTS, JSON.stringify({ built: new Date().toISOString(), cols: ['entry', 'exit', 'net', 'net2', 'market'], d1Cols: ['start', 'close'], d1, systems: S }));
  console.log('inputs ->', INPUTS, Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.length])), Object.fromEntries(Object.entries(d1).map(([k, v]) => [k, [v.length, new Date(v[0][0] * 1000).toISOString().slice(0, 10)]])));
}

// ---------- analysis ----------
const SYS = {   // declared histories and the calendar-midpoint split (preregistration.md)
  ict: { from: '2008-01-01', to: '2026-11-01', split: '2017-06-01', signedTrend: false, name: 'ICT A-setups (GC/NQ/ES/YM pooled)' },
  nqopen: { from: '2004-01-01', to: '2026-11-04', split: '2015-06-01', signedTrend: false, name: 'NQ New York open run' },
  gtrend: { from: '2006-07-01', to: '2026-11-07', split: '2016-09-01', signedTrend: true, name: 'Gold trend (N20 + add)' },
  gtrend5: { from: '2006-07-01', to: '2026-11-07', split: '2016-09-01', signedTrend: true, name: 'Gold trend fast (N5 + add)' },
  gtl: { from: '2006-07-01', to: '2026-11-07', split: '2016-09-01', signedTrend: true, name: 'Gold H4 trendline' },
  geg: { from: '2006-07-01', to: '2026-11-07', split: '2016-09-01', signedTrend: true, name: 'Gold daily engulf' },
  replica: { from: '2017-01-01', to: '2026-11-07', split: '2022-01-01', signedTrend: false, name: 'Gold replica' },
};
// eras of the earlier studies (#511, #526, #530, #512), for a descriptive ON/OFF table only (added after the verdict was computed)
const ERAS = { ict: [[2008, 2017], [2018, 2026]], nqopen: [[2004, 2013], [2014, 2022], [2023, 2026]], gtrend: [[2006, 2017], [2018, 2026]], gtrend5: [[2006, 2017], [2018, 2026]],
  gtl: [[2006, 2017], [2018, 2026]], geg: [[2006, 2017], [2018, 2026]], replica: [[2017, 2022], [2023, 2026]] };
const IND = ['VOL', 'TREND', 'META'], NTESTS = Object.keys(SYS).length * IND.length, BONF = 2.83;

function series(rows) {   // daily closes -> RV252 (annualised) and 6-month trend strength at each index
  const t = rows.map((r) => r[0]), c = rows.map((r) => r[1]), n = c.length, ret = [NaN];
  for (let i = 1; i < n; i++) ret.push(Math.log(c[i] / c[i - 1]));
  const sd = (a, b) => { let s = 0, q = 0; for (let k = a; k <= b; k++) { s += ret[k]; q += ret[k] ** 2; } const m = s / (b - a + 1); return Math.sqrt((q - (b - a + 1) * m * m) / (b - a)); };
  const rv = new Array(n).fill(null), ts = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i >= 252) rv[i] = sd(i - 251, i) * Math.sqrt(252);
    if (i >= 126) ts[i] = Math.log(c[i] / c[i - 126]) / (sd(i - 125, i) * Math.sqrt(126));
  }
  return { t, rv, ts };
}
const lastClosed = (S, T) => { let lo = 0, hi = S.t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (S.t[m] + DAY <= T) lo = m + 1; else hi = m; } return lo - 1; };

function stats(a, f = 'net') {
  const n = a.length; if (!n) return { n: 0, R: 0, exp: null, t: null, maxDD: 0, win: null };
  const v = a.map((x) => x[f]), R = v.reduce((p, x) => p + x, 0), m = R / n, sd = n > 1 ? Math.sqrt(v.reduce((p, x) => p + (x - m) ** 2, 0) / (n - 1)) : 0;
  let eq = 0, pk = 0, dd = 0; for (const x of [...a].sort((p, q) => p.exit - q.exit)) { eq += x[f]; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, R: +R.toFixed(1), exp: +m.toFixed(3), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, maxDD: +dd.toFixed(1), win: +(v.filter((x) => x > 0).length / n).toFixed(2) };
}
function welch(a, b, f = 'net') {
  if (a.length < 2 || b.length < 2) return null;
  const mv = (x) => { const v = x.map((y) => y[f]), m = v.reduce((p, y) => p + y, 0) / v.length; return [m, v.reduce((p, y) => p + (y - m) ** 2, 0) / (v.length - 1)]; };
  const [m1, v1] = mv(a), [m2, v2] = mv(b), se = Math.sqrt(v1 / a.length + v2 / b.length);
  return se > 0 ? +((m1 - m2) / se).toFixed(2) : null;
}
const yearOf = (T) => new Date(T * 1000).getUTCFullYear();
function years(on, all, from, to, f = 'net') {   // calendar years of a window: switched book positive / flat / negative
  const ys = []; for (let y = yearOf(from); y <= yearOf(to - 1); y++) ys.push(y);
  const by = (a) => Object.fromEntries(ys.map((y) => [y, +a.filter((x) => yearOf(x.entry) === y).reduce((p, x) => p + x[f], 0).toFixed(1)]));
  const s = by(on), b = by(all), cnt = (o) => ({ pos: ys.filter((y) => o[y] > 0).length, flat: ys.filter((y) => o[y] === 0).length, neg: ys.filter((y) => o[y] < 0).length });
  return { years: ys.length, switched: cnt(s), alwaysOn: cnt(b), byYear: Object.fromEntries(ys.map((y) => [y, { switched: s[y], alwaysOn: b[y] }])) };
}
// descriptive robustness (not a pre-registered test): trades inside one regime spell are not independent, so resample whole
// calendar months (10,000 draws, fixed seed) and count the separate OFF spells (runs of consecutive OFF trades)
function blocks(a, isOn) {
  const by = new Map(); for (const x of a) { const k = new Date(x.entry * 1000).toISOString().slice(0, 7); if (!by.has(k)) by.set(k, [0, 0, 0, 0]); const b = by.get(k); if (isOn(x)) { b[0] += x.net; b[1]++; } else { b[2] += x.net; b[3]++; } }
  const M = [...by.values()]; let seed = 20261107, le = 0, draws = 0; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let d = 0; d < 10000; d++) { let s1 = 0, n1 = 0, s0 = 0, n0 = 0; for (let k = 0; k < M.length; k++) { const b = M[Math.floor(rnd() * M.length)]; s1 += b[0]; n1 += b[1]; s0 += b[2]; n0 += b[3]; } if (!n1 || !n0) continue; draws++; if (s1 / n1 - s0 / n0 <= 0) le++; }
  let spells = 0, prev = true; for (const x of [...a].sort((p, q) => p.entry - q.entry)) { const o = isOn(x); if (!o && prev) spells++; prev = o; }
  const offMonths = [...by.values()].filter((b) => b[3] > 0 && b[1] === 0).length, mixed = [...by.values()].filter((b) => b[3] > 0 && b[1] > 0).length;
  return { months: M.length, monthsAllOff: offMonths, monthsMixed: mixed, offSpells: spells, monthBlockP: draws ? +(le / draws).toFixed(3) : null };
}
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return +(sxy / Math.sqrt(sx * sy)).toFixed(2); };

function analyse() {
  const I = JSON.parse(fs.readFileSync(INPUTS, 'utf8'));
  const D = Object.fromEntries(Object.entries(I.d1).map(([m, rows]) => [m, series(rows)]));
  const out = { built: new Date().toISOString().slice(0, 10), preregistration: 'research/edge/regime-switch/preregistration.md (commit 75458a96)', tests: NTESTS, bonferroniT: BONF,
    data: Object.fromEntries(Object.entries(I.d1).map(([m, r]) => [m, { days: r.length, from: new Date(r[0][0] * 1000).toISOString().slice(0, 10), to: new Date(r.at(-1)[0] * 1000).toISOString().slice(0, 10) }])), systems: {} };
  for (const [key, cfg] of Object.entries(SYS)) {
    const from = utc(cfg.from), to = utc(cfg.to), split = utc(cfg.split);
    const all = I.systems[key].map(([entry, exit, net, net2, market]) => ({ entry, exit, net, net2, market }));
    // META: trailing 365-day sum of the stream's own net R over trades closed before entry (per market for ICT)
    for (const x of all) x.meta = all.filter((y) => y.market === x.market && y.exit < x.entry && y.exit >= x.entry - YEAR).reduce((p, y) => p + y.net, 0);
    // VOL calibration: RV252 on every trading day of the first half, per market
    const calib = {};
    for (const m of new Set(all.map((x) => x.market))) calib[m] = D[m].rv.filter((v, i) => v != null && D[m].t[i] >= from && D[m].t[i] < split).sort((a, b) => a - b);
    const pct = (m, v) => { const a = calib[m]; let lo = 0, hi = a.length; while (lo < hi) { const k = (lo + hi) >> 1; if (a[k] <= v) lo = k + 1; else hi = k; } return 100 * lo / a.length; };
    for (const x of all) {
      const S = D[x.market], i = lastClosed(S, x.entry);
      x.rv = i >= 0 ? S.rv[i] : null; x.VOL = x.rv != null ? pct(x.market, x.rv) : null;
      const ts = i >= 0 ? S.ts[i] : null; x.TREND = ts == null ? null : cfg.signedTrend ? ts : Math.abs(ts); x.META = x.meta;
    }
    const inHist = all.filter((x) => x.entry >= from && x.entry < to), study = inHist.filter((x) => x.VOL != null && x.TREND != null);
    const H1 = study.filter((x) => x.entry < split), H2 = study.filter((x) => x.entry >= split);
    const res = { name: cfg.name, history: [cfg.from, cfg.to], split: cfg.split, trendUsed: cfg.signedTrend ? 'signed TS (long-only system)' : '|TS| (two-sided system)',
      trades: { declared: inHist.length, study: study.length, warmupExcluded: inHist.length - study.length, firstHalf: H1.length, secondHalf: H2.length,
        studyFrom: study.length ? new Date(study[0].entry * 1000).toISOString().slice(0, 10) : null },
      alwaysOn: { firstHalf: stats(H1), secondHalf: stats(H2), secondHalfX2: stats(H2, 'net2'), full: stats(study) }, indicators: {} };
    // does a good year predict a good year? (descriptive)
    { const ys = []; for (let y = yearOf(from); y <= yearOf(to - 1); y++) ys.push(+inHist.filter((x) => yearOf(x.entry) === y).reduce((p, x) => p + x.net, 0).toFixed(1));
      res.yearlyR = ys; res.yearlyLag1Corr = corr(ys.slice(0, -1), ys.slice(1)); }
    for (const ind of IND) {
      let rule;
      if (ind === 'META') rule = { cut: 0, dir: '>=', fitted: false, note: 'fixed a priori: ON unless the trailing 12-month sum is negative' };
      else {
        const v = H1.map((x) => x[ind]).sort((a, b) => a - b), cands = [];
        for (const p of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
          const cut = v[Math.round(p * (v.length - 1))];
          for (const dir of ['>=', '<']) {
            const on = H1.filter((x) => (dir === '>=' ? x[ind] >= cut : x[ind] < cut)), off = H1.filter((x) => !(dir === '>=' ? x[ind] >= cut : x[ind] < cut));
            const on1 = stats(on), off1 = stats(off);
            cands.push({ p, cut: +cut.toFixed(3), dir, onShare: +(on.length / H1.length).toFixed(2), t: welch(on, off), diff: on1.n && off1.n ? +(on1.exp - off1.exp).toFixed(3) : null });
          }
        }
        const ok = cands.filter((c) => c.t != null && c.diff > 0).sort((a, b) => b.t - a.t || b.onShare - a.onShare);
        rule = ok.length ? { cut: ok[0].cut, dir: ok[0].dir, pctOfFirstHalf: ok[0].p, fitted: true, firstHalfT: ok[0].t } : null;
        if (!rule) { res.indicators[ind] = { rule: null, note: 'no candidate with a positive first-half difference: no switch', candidates: cands }; continue; }
        rule.candidates = cands;
      }
      const isOn = (x) => (rule.dir === '>=' ? x[ind] >= rule.cut : x[ind] < rule.cut);
      const part = (a) => ({ on: a.filter(isOn), off: a.filter((x) => !isOn(x)) });
      const p1 = part(H1), p2 = part(H2), pf = part(study);
      const s2on = stats(p2.on), s2off = stats(p2.off), aon = res.alwaysOn.secondHalf;
      const t2 = welch(p2.on, p2.off), t2x2 = welch(p2.on, p2.off, 'net2');
      const S1 = s2on.n >= 10 && s2off.n >= 10 && s2on.exp > s2off.exp && t2 >= 2.0;
      const S2 = s2on.n > 0 && s2on.exp >= aon.exp && s2on.maxDD <= aon.maxDD;
      const S3 = s2on.n >= 2 && s2off.n >= 2 && stats(p2.on, 'net2').exp > stats(p2.off, 'net2').exp;
      res.indicators[ind] = {
        rule,
        firstHalf: { on: stats(p1.on), off: stats(p1.off), welchT: welch(p1.on, p1.off) },
        secondHalf: { on: s2on, off: s2off, welchT: t2, onShare: +(p2.on.length / Math.max(1, H2.length)).toFixed(2), x2: { on: stats(p2.on, 'net2'), off: stats(p2.off, 'net2'), welchT: t2x2 },
          switched: { ...s2on, years: years(p2.on, H2, split, to) }, alwaysOn: { ...aon, years: years(H2, H2, split, to).alwaysOn } },
        fullHistoryReference: { note: ind === 'META' ? 'META is not fitted: the full history is out of sample for it' : 'in-sample contaminated (first half chose the cut)', on: stats(pf.on), off: stats(pf.off), welchT: welch(pf.on, pf.off), switchedYears: years(pf.on, study, from, to).switched, alwaysOnYears: years(study, study, from, to).alwaysOn },
        robustness: blocks(H2, isOn),
        byEraDescriptive: Object.fromEntries(ERAS[key].map(([a, b]) => { const q = part(study.filter((x) => yearOf(x.entry) >= a && yearOf(x.entry) <= b)); return [`${a}-${b}`, { on: stats(q.on), off: stats(q.off), welchT: welch(q.on, q.off) }]; })),
        tests: { S1, S2, S3, pass: S1 && S2 && S3, survivesMultipleTesting: S1 && S2 && S3 && t2 >= BONF },
      };
      if (key === 'ict') res.indicators[ind].perMarketSecondHalf = Object.fromEntries(['gc', 'nq', 'es', 'ym'].map((m) => { const q = part(H2.filter((x) => x.market === m)); return [m, { on: stats(q.on), off: stats(q.off), welchT: welch(q.on, q.off) }]; }));
    }
    // where each switch stands at the end of the data (for the record; nothing live reads it)
    { const T = to, now = {};
      for (const m of new Set(all.map((x) => x.market))) { const S = D[m], i = lastClosed(S, T), ts = S.ts[i], meta = all.filter((y) => y.market === m && y.exit >= T - YEAR).reduce((p, y) => p + y.net, 0);
        const v = { VOL: pct(m, S.rv[i]), TREND: cfg.signedTrend ? ts : Math.abs(ts), META: meta }, st = {};
        for (const ind of IND) { const r = res.indicators[ind].rule; st[ind] = { value: +v[ind].toFixed(2), on: r ? (r.dir === '>=' ? v[ind] >= r.cut : v[ind] < r.cut) : null }; }
        now[m] = { asOf: new Date(S.t[i] * 1000).toISOString().slice(0, 10), ...st }; }
      res.now = now; }
    out.systems[key] = res;
  }
  const cells = Object.entries(out.systems).flatMap(([k, s]) => IND.map((i) => ({ k, i, x: s.indicators[i] })));
  const passes = cells.filter((c) => c.x.tests?.pass), surv = cells.filter((c) => c.x.tests?.survivesMultipleTesting);
  out.verdict = { answer: surv.length ? 'yes' : passes.length ? 'weak' : 'no', nominalPasses: passes.map((c) => `${c.k}/${c.i}`), survivors: surv.map((c) => `${c.k}/${c.i}`),
    systemsWithUsableSwitch: [...new Set(passes.map((c) => c.k))] };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  print(out);
}

function print(out) {
  const f = (x, d = 3) => (x == null ? '–' : (x > 0 ? '+' : '') + x.toFixed(d));
  const yrs = (y) => `${y.pos}/${y.flat}/${y.neg}`;
  console.log('\n## Second half, per system x indicator (net R, x1)\n');
  console.log('| System | Indicator | Rule (chosen on first half) | 1st-half ON-OFF t | 2nd ON n / R a trade | 2nd OFF n / R a trade | Welch t | x2 ON-OFF | Switched: R / DD / yrs +/0/- | Always on: R / DD / yrs +/0/- | Verdict |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(out.systems)) for (const i of IND) {
    const x = s.indicators[i]; if (!x.rule) { console.log(`| ${k} | ${i} | no switch (no positive first-half split) | | | | | | | | – |`); continue; }
    const r = x.rule, h = x.secondHalf, d2 = h.x2.on.exp != null && h.x2.off.exp != null ? h.x2.on.exp - h.x2.off.exp : null;
    const v = x.tests.survivesMultipleTesting ? '**PASS (survives)**' : x.tests.pass ? 'pass (nominal)' : 'fail';
    console.log(`| ${k} | ${i} | ON if ${i} ${r.dir} ${r.cut}${r.fitted ? ` (p${r.pctOfFirstHalf * 100})` : ' (fixed)'} | ${f(x.firstHalf.welchT, 2)} | ${h.on.n} / ${f(h.on.exp)} | ${h.off.n} / ${f(h.off.exp)} | ${f(h.welchT, 2)} | ${f(d2)} | ${f(h.switched.R, 1)} / ${h.switched.maxDD} / ${yrs(h.switched.years.switched)} | ${f(h.alwaysOn.R, 1)} / ${h.alwaysOn.maxDD} / ${yrs(h.alwaysOn.years)} | ${v} |`);
  }
  console.log('\n## Robustness of the second-half split (descriptive): month-block bootstrap P(ON-OFF <= 0), OFF spells\n');
  console.log('| System | Indicator | trade Welch t | month-block P(ON-OFF<=0) | months (all-OFF / mixed) | OFF spells | 1st-half ON-OFF t |');
  console.log('|---|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(out.systems)) for (const i of IND) { const x = s.indicators[i]; if (!x.rule) continue; const b = x.robustness; console.log(`| ${k} | ${i} | ${f(x.secondHalf.welchT, 2)} | ${b.monthBlockP} | ${b.months} (${b.monthsAllOff} / ${b.monthsMixed}) | ${b.offSpells} | ${f(x.firstHalf.welchT, 2)} |`); }
  console.log('\n## ON vs OFF by the earlier studies\' eras (descriptive, full study; cut as frozen on the first half)\n');
  console.log('| System | Indicator | era: ON n / R a trade — OFF n / R a trade (Welch t) |');
  console.log('|---|---|---|');
  for (const [k, s] of Object.entries(out.systems)) for (const i of IND) { const x = s.indicators[i]; if (!x.rule) continue; console.log(`| ${k} | ${i} | ${Object.entries(x.byEraDescriptive).map(([e, q]) => `${e}: ${q.on.n} / ${f(q.on.exp)} — ${q.off.n} / ${f(q.off.exp)} (${f(q.welchT, 2)})`).join('; ')} |`); }
  console.log('\n## Always on, halves (net R x1)\n');
  console.log('| System | study trades (from) | warm-up excluded | 1st half n / R a trade / t | 2nd half n / R a trade / t / DD | yearly R lag-1 corr |');
  console.log('|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(out.systems)) { const a = s.alwaysOn; console.log(`| ${k} | ${s.trades.study} (${s.trades.studyFrom}) | ${s.trades.warmupExcluded} | ${a.firstHalf.n} / ${f(a.firstHalf.exp)} / ${a.firstHalf.t} | ${a.secondHalf.n} / ${f(a.secondHalf.exp)} / ${a.secondHalf.t} / ${a.secondHalf.maxDD} | ${s.yearlyLag1Corr} |`); }
  console.log('\n## META over the full history (unfitted, so all out of sample)\n');
  console.log('| System | ON n / R a trade | OFF n / R a trade | Welch t | Switched yrs +/0/- | Always-on yrs +/0/- |');
  console.log('|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(out.systems)) { const m = s.indicators.META.fullHistoryReference; console.log(`| ${k} | ${m.on.n} / ${f(m.on.exp)} | ${m.off.n} / ${f(m.off.exp)} | ${f(m.welchT, 2)} | ${yrs(m.switchedYears)} | ${yrs(m.alwaysOnYears)} |`); }
  console.log('\n## ICT per market, second half (pooled rule)\n');
  for (const i of IND) { const x = out.systems.ict.indicators[i]; if (!x.perMarketSecondHalf) continue; console.log(i, Object.entries(x.perMarketSecondHalf).map(([m, q]) => `${m}: ON ${q.on.n} ${f(q.on.exp)} / OFF ${q.off.n} ${f(q.off.exp)} t ${f(q.welchT, 2)}`).join(' | ')); }
  console.log('\n## Where each switch stands at the end of the data\n');
  for (const [k, s] of Object.entries(out.systems)) console.log(k, Object.entries(s.now).map(([m, v]) => `${m} ${v.asOf}: ` + IND.map((i) => `${i} ${v[i].value} ${v[i].on == null ? '-' : v[i].on ? 'ON' : 'OFF'}`).join(', ')).join(' | '));
  console.log('\nverdict', JSON.stringify(out.verdict));
}

if (process.argv[2] === 'build') await build(process.argv.slice(3)); else analyse();
