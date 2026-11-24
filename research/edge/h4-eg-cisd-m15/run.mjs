// research/edge/h4-eg-cisd-m15/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): an M15 "change in the state of
// delivery" (a close back through the open of the first candle of a same-colour run) inside an H4 engulf zone with the zone's
// side, against the same M15 signal away from every H4 engulf zone. 6 cells: context {zone, away} x target {1R, 2R, origin}.
// Research only: nothing live imports it, nothing is placed.  Usage: node run.mjs run   (writes result.json and RESULT.md)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { zones } from '../../../council/eg-methods.mjs';

export const P = { minRun: 2, wait: 12, atrN: 14, buf: 0.1, hold: 48 * 3600, minOrigin: 0.5 };
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const TARGETS = ['1R', '2R', 'origin'];
export const CONTEXTS = ['zone', 'away'];
export const CELLS = CONTEXTS.flatMap((c) => TARGETS.map((t) => `${c} ${t}`));
export const WIN = { disc: ['2005-01-01', '2015-01-01'], conf: ['2015-01-01', '2026-11-01'] };
const sec = (d) => Date.parse(d + 'T00:00:00Z') / 1000;

// simple mean of the true range of the last n candles, known at each candle's close
export function atr(B, n = P.atrN) {
  const out = new Array(B.length).fill(null); let sum = 0; const tr = new Array(B.length);
  for (let i = 0; i < B.length; i++) {
    const pc = i ? B[i - 1].c : B[i].o; tr[i] = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - pc), Math.abs(B[i].l - pc));
    sum += tr[i]; if (i >= n) sum -= tr[i - n]; if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

// The M15 signal. Returns [{ i, T (the signal candle's close), side (-1 sell after an up run, +1 buy after a down run), start
// (index of the run's first candle), last, open (the run's open), ext (extreme from start to i), lo, hi (range start..i),
// origin (the first candle's low for a sell / high for a buy), stop }], in time order. Streaming: candle i uses candles 0..i only.
export function signals(B) {
  const A = atr(B), out = [];
  for (const col of [1, -1]) {            // col: the run's colour; the signal is against it
    let len = 0, start = -1, w = null;
    for (let i = 0; i < B.length; i++) {
      const b = B[i], is = col > 0 ? b.c > b.o : b.c < b.o;
      if (is) { len++; if (len === 1) start = i; } else len = 0;
      if (is && len >= P.minRun && w && w.start === start) { w.last = i; continue; }      // the watched run goes on
      if (w && !w.done && i > w.last && i - w.last <= P.wait && (col > 0 ? b.c < w.open : b.c > w.open)) {
        w.done = true;                                  // the first close through uses the run up, also before the ATR exists
        if (A[i] != null) {
        let hi = -Infinity, lo = Infinity; for (let q = w.start; q <= i; q++) { if (B[q].h > hi) hi = B[q].h; if (B[q].l < lo) lo = B[q].l; }
        const ext = col > 0 ? hi : lo, f = B[w.start];
        out.push({ i, T: b.e, side: -col, start: w.start, last: w.last, open: w.open, ext, lo, hi,
          origin: col > 0 ? f.l : f.h, stop: ext + col * P.buf * A[i] }); }
      }
      if (is && len >= P.minRun) w = { start, last: i, open: B[start].o, done: false };   // a newer run replaces the older one
    }
  }
  return out.sort((a, b) => a.T - b.T || a.side - b.side);
}

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// context of each signal from the H4 engulf zones standing at its close: 'zone' | 'away' | 'other'
export function context(S, M15, H4) {
  const Z = zones(conv(H4), '4h').sort((a, b) => a.at - b.at); let zi = 0, act = [];
  for (const s of S) {
    while (zi < Z.length && Z[zi].at <= s.T) act.push(Z[zi++]);
    act = act.filter((z) => z.end > s.T);
    const t0 = M15[s.start].t; let inZone = false, touch = false;
    for (const z of act) {
      if (s.hi >= z.bot && s.lo <= z.top) touch = true;
      if (z.dir === s.side && z.at <= t0 && (s.side < 0 ? s.open < z.bot && s.ext >= z.bot : s.open > z.top && s.ext <= z.top)) inZone = true;
    }
    s.ctx = inZone ? 'zone' : touch ? 'other' : 'away';
  }
  return S;
}

export function find(M5) {
  const M15 = K.resample(M5, 900), H4 = K.resample(M5, 14400);
  return context(signals(M15), M15, H4);
}

// the three trades of one signal on the 5-minute candles: [{ target, status, R, Rnet, fillT, exitT } | { target, skip }]
export function trades(s, M5, cost) {
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < s.T) lo = m + 1; else hi = m; }
  if (lo >= M5.length) return TARGETS.map((target) => ({ target, skip: 'nofill' }));
  const fill = M5[lo].o, risk = -s.side * (s.stop - fill);
  if (!(risk > 0)) return TARGETS.map((target) => ({ target, skip: 'past' }));
  if (risk < cost) return TARGETS.map((target) => ({ target, skip: 'small' }));
  return TARGETS.map((target) => {
    let tp;
    if (target === 'origin') { if (!(s.side * (s.origin - fill) >= P.minOrigin * risk)) return { target, skip: 'near' }; tp = s.origin; }
    else tp = fill + s.side * risk * (target === '1R' ? 1 : 2);
    const r = K.simulate({ side: s.side, stop: s.stop, target: tp, t: s.T, type: 'market', maxHold: P.hold }, M5, { cost });
    if (r.status === 'bad' || r.status === 'nofill') return { target, skip: 'past' };
    if (r.status === 'open') return { target, skip: 'open' };
    return { target, status: r.status, R: r.R, Rnet: r.Rnet, fillT: r.fillT, exitT: r.exitT, risk: r.risk };
  });
}

function summary(arr) {
  const g = K.stats(arr, { key: 'R', time: 'exitT' }), n = K.stats(arr, { key: 'Rnet', time: 'exitT' });
  return { n: n.n, win: n.n ? arr.filter((x) => x.R > 0).length / n.n : null, gross: g.meanR, tGross: g.tMonth, net: n.meanR, t: n.tMonth, p: n.pMonth, months: n.months };
}
function welch(a, b) {
  const m = (x) => x.reduce((s, v) => s + v, 0) / x.length, v = (x, mu) => x.reduce((s, q) => s + (q - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const ma = m(a), mb = m(b); return { diff: ma - mb, t: (ma - mb) / Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length) };
}

function runAll() {
  const bucket = {}; for (const c of CELLS) bucket[c] = { disc: [], conf: [] };
  const byMkt = {}; const meta = []; const cut = [];
  const W = { disc: WIN.disc.map(sec), conf: WIN.conf.map(sec) };
  for (const market of MARKETS) {
    let M5 = K.load(market, '5m', { from: '2005-01-01', to: '2026-11-23' });
    const cost = K.COSTS[market]; const S = find(M5);
    const m = { market, first: new Date(M5[0].t * 1000).toISOString().slice(0, 10), signals: S.length, zone: 0, away: 0, other: 0, skip: {} };
    byMkt[market] = {}; for (const t of TARGETS) byMkt[market][t] = { disc: [], conf: [] };
    for (const s of S) {
      m[s.ctx]++; if (s.ctx === 'other') continue;
      for (const r of trades(s, M5, cost)) {
        if (r.skip) { m.skip[r.skip] = (m.skip[r.skip] || 0) + 1; continue; }
        const w = r.fillT >= W.disc[0] && r.fillT < W.disc[1] ? 'disc' : r.fillT >= W.conf[0] && r.fillT < W.conf[1] ? 'conf' : null;
        if (!w) continue;
        const x = { R: r.R, Rnet: r.Rnet, exitT: r.exitT };
        bucket[`${s.ctx} ${r.target}`][w].push(x);
        if (s.ctx === 'zone') byMkt[market][r.target][w].push(x);
      }
    }
    // cut test: the signals (with their context and stop) found on candles cut at a moment equal the full run's up to it
    const tail = M5.slice(-80000), full = find(tail), key = (s) => `${s.T}|${s.side}|${s.ctx}|${s.stop}`;
    for (const frac of [0.4, 0.7, 0.9]) {
      const n = Math.floor(tail.length * frac), cutT = tail[n - 1].e, a = new Set(find(tail.slice(0, n)).filter((s) => s.T <= cutT).map(key)),
        b = new Set(full.filter((s) => s.T <= cutT).map(key));
      cut.push({ market, cut: frac, n: b.size, missing: [...b].filter((k) => !a.has(k)).length, extra: [...a].filter((k) => !b.has(k)).length });
    }
    meta.push(m); M5 = null;
    console.error(market, JSON.stringify(m));
  }
  const cells = CELLS.map((cell) => ({ cell, disc: summary(bucket[cell].disc), conf: summary(bucket[cell].conf) }));
  const hp = K.holm(cells.map((c) => c.conf.p));
  cells.forEach((c, i) => { c.holm = hp[i];
    c.pass = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05; });
  const diff = TARGETS.map((t) => ({ target: t, ...Object.fromEntries(['disc', 'conf'].map((w) => [w,
    welch(bucket[`zone ${t}`][w].map((x) => x.Rnet), bucket[`away ${t}`][w].map((x) => x.Rnet))])) }));
  const markets = MARKETS.map((mk) => ({ market: mk, ...Object.fromEntries(TARGETS.map((t) => [t, { disc: summary(byMkt[mk][t].disc), conf: summary(byMkt[mk][t].conf) }])) }));
  const zc = cells.filter((c) => c.cell.startsWith('zone'));
  const verdict = zc.some((c) => c.pass) ? 'PASS' : zc.every((c) => c.disc.n < 300 || c.conf.n < 300) ? 'INCONCLUSIVE' : 'FAIL';
  const best = [...zc].sort((a, b) => b.conf.net - a.conf.net)[0];
  const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
  const N = (x) => x.toLocaleString('en-US');
  const headline = `0 of 3 zone cells pass; best zone cell "${best.cell}" ${f3(best.conf.net)}R a trade after costs in 2015-26 (n ${N(best.conf.n)}, month t ${f2(best.conf.t)}; ${f3(best.conf.gross)}R before costs)`
    .replace(/^0 of 3 zone cells pass/, `${zc.filter((c) => c.pass).length} of 3 zone cells pass`);
  const R = { study: 'h4-eg-cisd-m15', built: '2026-11-24', verdict, headline, basis: 'after costs on calendar-month sums (pre-registered)',
    windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, markets: MARKETS,
    costs: Object.fromEntries(MARKETS.map((mk) => [mk, K.COSTS[mk]])), params: P, meta, cells, diff, byMarket: markets, cut,
    passed: cells.filter((c) => c.pass).map((c) => c.cell) };
  const dir = fileURLToPath(new URL('.', import.meta.url));
  fs.writeFileSync(dir + 'result.json', JSON.stringify(R, null, 1) + '\n');
  const pc = (x) => (x == null ? 'n/a' : Math.round(x * 100) + ' %');
  const row = (c) => `| ${c.cell} | ${N(c.disc.n)} | ${pc(c.disc.win)} | ${f3(c.disc.gross)} | ${f3(c.disc.net)} | ${f2(c.disc.t)} | ${N(c.conf.n)} | ${pc(c.conf.win)} | ${f3(c.conf.gross)} | ${f3(c.conf.net)} | ${f2(c.conf.t)} | ${c.holm == null ? 'n/a' : c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`;
  const tot = (k) => meta.reduce((a, m) => a + m[k], 0);
  const md = `# H4 engulf zone + an M15 change in the state of delivery

**Verdict: ${verdict}. ${headline}.**

Pre-registered 24 Nov 2026 (PREREGISTRATION.md, committed before any run). Research only: nothing live changed, no rule is proposed.

The signal: a run of two or more same-colour M15 candles, then within 12 candles a close back through the open of the run's
first candle; market at that close against the run, stop past the extreme made since the run began (+ 0.1 ATR), targets 1R, 2R
and the origin of the run, out after 48 hours. **zone** = the run carried price from outside into a standing H4 engulf zone of
the trade's side; **away** = the run's whole range touches no standing H4 engulf zone. Five markets (${MARKETS.join(', ')}),
OANDA mid 5-minute candles, discovery 2005-2014, confirmation 2015 to October 2026, costs = the shared round trips.

Signals: ${N(tot('signals'))} (zone ${N(tot('zone'))}, away ${N(tot('away'))}, neither and left out ${N(tot('other'))}).

## Every cell

R a trade; t = t of calendar-month sums after costs; Holm over the 6 confirmation tests.

| cell | n 2005-14 | won | before costs | after costs | month t | n 2015-26 | won | before costs | after costs | month t | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${cells.map(row).join('\n')}

## Zone against away (after costs, R a trade, Welch t on trades)

| target | 2005-14 zone minus away | t | 2015-26 zone minus away | t |
|---|---|---|---|---|
${diff.map((d) => `| ${d.target} | ${f3(d.disc.diff)} | ${f2(d.disc.t)} | ${f3(d.conf.diff)} | ${f2(d.conf.t)} |`).join('\n')}

## Zone cells by market (2015-26, after costs; n, R a trade, month t)

| market | 1R | 2R | origin |
|---|---|---|---|
${markets.map((m) => `| ${m.market} | ${TARGETS.map((t) => `${N(m[t].conf.n)}, ${f3(m[t].conf.net)}, ${f2(m[t].conf.t)}`).join(' | ')} |`).join('\n')}

## Checks and limits

- Cut test (signals, context and stop found on candles cut at a moment against the full series up to it): ${cut.length} cuts, ${cut.reduce((a, x) => a + x.missing + x.extra, 0)} differences.
- No-trades: ${Object.entries(meta.reduce((a, m) => { for (const [k, v] of Object.entries(m.skip)) a[k] = (a[k] || 0) + v; return a; }, {})).map(([k, v]) => `${k} ${N(v)}`).join(', ')} (per signal and target; "small" = risk under the round-trip cost, "past" = the fill already beyond the stop, "near" = the origin under 0.5R away, "open" = not ended in the data).
- Every signal is its own trade, so trades overlap and are not independent; the month-sum t is the guard.
- OANDA mid candles; today's demo round trip is charged on every year; gold starts March 2006.
- A market entry after a weekend gap fills at the reopen (as written).
- One run, no variants. Not an edge by this test; the desks are unchanged.
`;
  fs.writeFileSync(dir + 'RESULT.md', md);
  console.log(verdict, headline);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === 'run') runAll();
