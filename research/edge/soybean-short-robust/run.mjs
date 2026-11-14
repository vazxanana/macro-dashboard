// Soybean short, frozen robustness checks: research/edge/soybean-short-robust. Pre-registered in PREREGISTRATION.md (committed
// alone, before any new figure was computed). The rule is the grain-seasonality study's T2, run by that study's own code, copied
// byte for byte as frozen.mjs and never edited. Paper research only: nothing here is read by the council, the mirror or any page.
//   node run.mjs fetch <dir>   copies council-data research/daily/soybn.json (git show, no network)
//   node run.mjs full <dir>    gate, then R1-R4, writes result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { P, TESTS, prep, windowOf, trade, runTest, summarize, tStat } from './frozen.mjs';

export const FROZEN_SHA256 = 'e9ba1c2776dacb6df7f2759ea4f7caa5644e156cca7d51308438cccc90b80159';
// the published T2 figures of grain-seasonality's result.json (branch grain-seasonality, commit dde599ff)
export const PUBLISHED = {
  decisive: { n: 11, won: 8, meanNet: 0.52, perm: 0.01195 },
  replication: { n: 13, won: 7, meanNet: 1.186, perm: 0.00067 },
};
export const SHIFTS = [-10, -5, 5, 10];
export const STOPS = [2, 4];
export const R4_SOURCES = [
  { name: 'stooq daily CSV zs.f', host: 'stooq.com' },
  { name: 'Yahoo chart API ZS=F', host: 'query1.finance.yahoo.com' },
  { name: 'CNBC bars @S.1 daily', host: 'ts-api.cnbc.com' },
];
const T2 = TESTS.find((t) => t.id === 'T2');
const DAY = 86400;
const r3 = (x) => x == null ? null : +x.toFixed(3);
const r4 = (x) => x == null ? null : +x.toFixed(4);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// run fn with the frozen stop multiple set to k, then put it back
export function withK(k, fn) { const k0 = P.K; P.K = k; try { return fn(); } finally { P.K = k0; } }

// the frozen July-September window [i0, i1] moved by s weekday candles at both ends; null when it leaves the data
export function shifted(B, year, s, m0 = T2.m0) {
  const w = windowOf(B, year, m0);
  if (!w) return null;
  const i0 = w[0] + s, i1 = w[1] + s;
  if (i0 < P.ATR + 1 || i1 >= B.length) return null;
  return [i0, i1];
}

// one base-cost trade a year on the (shifted) window, stop k x ATR(20)
export function rowsFor(B, years, { s = 0, k = P.K } = {}) {
  return withK(k, () => {
    const out = [];
    for (const y of years) {
      const w = shifted(B, y, s);
      if (!w) continue;
      const t = trade(B, w[0], w[1], 1);
      if (!t) continue;
      out.push({ year: y, entryDay: ymd(t.t), exitDay: ymd(t.exitT), entry: r4(t.entry), stop: r4(t.stop), exit: r4(t.exit), why: t.why, g: r3(t.g), cost: r3(t.cost), fin: r3(t.fin), net: r3(t.net), _net: t.net, _g: t.g });
    }
    return out;
  });
}
export function stats(rows) {
  if (!rows.length) return { n: 0 };
  const net = rows.map((r) => r._net ?? r.net), g = rows.map((r) => r._g ?? r.g);
  return { n: rows.length, won: net.filter((x) => x > 0).length, stopped: rows.filter((r) => r.why !== 'window').length, meanG: r3(mean(g)), meanNet: r3(mean(net)), t: r3(tStat(net)) };
}
const clean = (rows) => rows.map(({ _net, _g, ...r }) => r);

// April-June move: close of the last weekday candle of June / open of the first weekday candle of April - 1
export function aprJun(B, year) { const w = windowOf(B, year, 4); return w ? B[w[1]].close / B[w[0]].open - 1 : null; }

export function verdictOf(r1, r2, r4) {
  const ok = r1.every((v) => v.decisive.meanNet > 0) && r2.every((v) => v.decisive.meanNet > 0) && (!r4.available || r4.decisive.meanNet > 0);
  return ok ? 'ROBUST' : 'FRAGILE';
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (dir) => prep(JSON.parse(fs.readFileSync(path.join(dir, 'soybn.json'), 'utf8')).rows);
const years = (a, b) => { const o = []; for (let y = a; y <= b; y++) o.push(y); return o; };

export function gateOf(B) {
  const first = new Date(B[0].time * 1000).getUTCFullYear(), out = {};
  for (const [s, ys] of [['decisive', years(P.DECISIVE[0], P.DECISIVE[1])], ['replication', years(first, P.REPLICATION_TO)]]) {
    const S = summarize(runTest(B, T2, ys), T2);
    out[s] = { n: S.n, won: S.won, meanNet: S.meanNet, perm: S.perm[1], published: PUBLISHED[s] };
    out[s].match = out[s].n === PUBLISHED[s].n && out[s].won === PUBLISHED[s].won && out[s].meanNet === PUBLISHED[s].meanNet && out[s].perm === PUBLISHED[s].perm;
  }
  out.pass = out.decisive.match && out.replication.match;
  return out;
}

function full(dir) {
  const sha = createHash('sha256').update(fs.readFileSync(path.join(HERE, 'frozen.mjs'))).digest('hex');
  if (sha !== FROZEN_SHA256) throw new Error(`frozen.mjs changed: ${sha}`);
  const B = load(dir), first = new Date(B[0].time * 1000).getUTCFullYear();
  const DEC = years(P.DECISIVE[0], P.DECISIVE[1]), REP = years(first, P.REPLICATION_TO);
  const gate = gateOf(B);
  console.log('gate', JSON.stringify(gate));
  const J = { topic: 'soybean-short-robust', built: '2026-11-14', title: 'Soybean short: frozen robustness checks of the grain-seasonality pass',
    system: 'soybeans short July-September (grain-seasonality T2), frozen; OANDA mid daily candles, council-data research/daily/soybn.json',
    frozen: { file: 'frozen.mjs', sha256: sha, from: 'research/edge/grain-seasonality/run.mjs @ dde599ff' }, candles: B.length, first: ymd(B[0].time), last: ymd(B[B.length - 1].time), gate };
  if (!gate.pass) { J.verdict = 'GATE FAILED'; fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(J, null, 1) + '\n'); console.log('gate failed'); return; }
  const block = (opts) => { const d = rowsFor(B, DEC, opts), r = rowsFor(B, REP, opts); return { decisive: stats(d), replication: stats(r), years: { decisive: clean(d), replication: clean(r) } }; };
  const base = block({});
  const r1 = SHIFTS.map((s) => ({ shift: s, ...block({ s }) }));
  const r2 = STOPS.map((k) => ({ k, ...block({ k }) }));
  const R3 = {};
  for (const [name, ys] of [['decisive', DEC], ['replication', REP]]) {
    const rows = base.years[name].map((r) => ({ year: r.year, aprJun: r4(aprJun(B, r.year)), net: r.net }));
    const rose = rows.filter((r) => r.aprJun > 0), fell = rows.filter((r) => !(r.aprJun > 0));
    R3[name] = { rose: { ...stats(rose.map((r) => ({ net: r.net, g: r.net, why: 'window' }))), years: rose }, fell: { ...stats(fell.map((r) => ({ net: r.net, g: r.net, why: 'window' }))), years: fell } };
    for (const h of ['rose', 'fell']) { delete R3[name][h].meanG; delete R3[name][h].stopped; }
  }
  const R4 = { available: false, tried: R4_SOURCES.map((x) => ({ ...x, answer: 'connection refused by the sandbox network proxy (connect_rejected), 14 Nov 2026' })),
    why: 'every pre-registered source was refused by the sandbox network proxy; no other soybean series exists in council-data; no data was invented' };
  const verdict = verdictOf(r1, r2, R4);
  Object.assign(J, { base, r1, r2, r3: R3, r4: R4, verdict });
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(J, null, 1) + '\n');
  console.log('base', JSON.stringify(base.decisive), JSON.stringify(base.replication));
  for (const v of r1) console.log('R1', v.shift, JSON.stringify(v.decisive), JSON.stringify(v.replication));
  for (const v of r2) console.log('R2', v.k, JSON.stringify(v.decisive), JSON.stringify(v.replication));
  for (const s of ['decisive', 'replication']) console.log('R3', s, JSON.stringify({ rose: { ...R3[s].rose, years: undefined }, fell: { ...R3[s].fell, years: undefined } }));
  console.log('verdict', verdict);
}

function fetchSoy(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'soybn.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, execFileSync('git', ['show', 'origin/council-data:research/daily/soybn.json'], { maxBuffer: 1 << 28 }));
  console.log('saved', f);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchSoy(dir);
  else if (mode === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch <dir> | full <dir>'); process.exit(1); }
}
