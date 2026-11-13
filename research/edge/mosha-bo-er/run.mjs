// Edge research · mosha-bo-er (PREREGISTRATION.md, committed first): three questions on the live Mosha BO, 2020 -> now, OANDA gold.
//   A. the Daily regime split: ER20 of 17:00 New York daily closes >= 0.2 at the order's time, kept vs blocked
//   B. a market entry on the close of the M15 confirmation vs the live limit at the broken level (same stop price)
//   C. descriptive: the confirmation formed back inside the pullback's reversal range ("case 2") vs beyond it
// Paper research only: nothing here edits a live rule, file or setting.
//   node --use-env-proxy research/edge/mosha-bo-er/fetch.mjs <candleDir>   OANDA candles (keep <candleDir> out of git)
//   node research/edge/mosha-bo-er/run.mjs replay <candleDir> <outDir>    both arms + the parity run of mosha-oos itself
//   node research/edge/mosha-bo-er/run.mjs study <candleDir> <outDir>     -> result.json next to this file
// The trades come from research/edge/mosha-oos/run.mjs's replay, loaded from that file's own text (not edited); the market arm
// changes only the order line (fill at the last closed M5 close, same stop price). Imports, never copies: er (gold-drd-er),
// days (gold-drd-long), welch / maxDD / placebo / splitStats (cycle-gate, merged from origin/cycle-gate-study), holm (shadow-best),
// FIN / nights (council/fills.mjs).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
// cycle-gate and shadow-best run their own command lines on import: hide ours from them
const ARGV = SELF ? process.argv.slice(2) : [];
process.argv.length = Math.min(process.argv.length, 2);
const CG = await import('../cycle-gate/run.mjs');
const SB = await import('../shadow-best/run.mjs');
const { er } = await import('../gold-drd-er/run.mjs');
const { days } = await import('../gold-drd-long/run.mjs');
const { FIN, nights } = await import('../../../council/fills.mjs');

export const K = { FROM: Date.UTC(2020, 0, 1) / 1000, SPLIT: Date.UTC(2024, 0, 1) / 1000, ER_MIN: 0.2, ER_N: 20, COST: 0.30, T_MIN: 2, ALPHA: 0.05, MIN_KEPT: 30, MIN_BLOCKED: 10, PLACEBO: 40 };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3));
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(4));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');

// ─── the replay: mosha-oos's own text, wrapped in a function ───
const OOS = path.join(HERE, '../mosha-oos/run.mjs');
const PATCH = {
  head: "if (MODE === 'replay') {\n  const DIR = process.env.CANDLES, OUT = process.env.OUT_DIR || '.';",
  wk: '    const wEv = weeklyEvents(nd, now), w1 = (before(wEv, e3.t) || { dir: 0 }).dir;',
  push: '    push(tr); chains.push({ id, t: now, d, r0: fx(r0), blk });',
  write: "  fs.writeFileSync(path.join(OUT, 'trades.json'), JSON.stringify({ cfg: CFG, chains: chains.length, legs }));",
};
let REPLAY = null;
export async function loadReplay() {
  if (REPLAY) return REPLAY;
  const src = fs.readFileSync(OOS, 'utf8'), a = src.indexOf(PATCH.head), b = src.indexOf('// ─── analyze ───');
  for (const [k, s] of Object.entries(PATCH)) if (src.split(s).length !== 2) throw new Error(`mosha-oos/run.mjs changed shape (${k}): re-check this study against it`);
  const imports = src.slice(0, src.indexOf('// ─── fetch ───')).replace('const MODE = process.argv[2];', '');
  let body = src.slice(a + PATCH.head.length, b).trimEnd();
  if (!body.endsWith('}')) throw new Error('mosha-oos/run.mjs: replay block end not found');
  body = body.slice(0, -1)
    .replace(PATCH.wk, `    if (OPT.vr) OPT.vr.set(\`xau-moshabo-\${e3.t}\`, OPT.vrOf(h1Window(p1(c), j), e1, e2, e3, d));\n${PATCH.wk}`)
    .replace(PATCH.push, `    if (OPT.market) { const me = fx(M5[j].close), mr = Math.abs(me - stop);
      if (!(d < 0 ? me < stop : me > stop) || !(mr > 0)) { OPT.wrongSide = (OPT.wrongSide || 0) + 1; continue; }
      Object.assign(tr, { entry: me, r0: mr, t1: fx(me + d * 10 * mr), tp1: fx(me + d * CFG.moshaRun.atR * mr), status: 'open', filled: M5[j].time + 300, entryMode: 'market', limitAt: entry, ptr: j + 1 }); }
${PATCH.push}`)
    .replace('  fs.mkdirSync(OUT, { recursive: true });\n' + PATCH.write, '  return { cfg: CFG, chains: chains.length, legs };');
  if (!body.includes('return { cfg: CFG')) throw new Error('mosha-oos/run.mjs: the write lines changed shape');
  const mod = `${imports.replace(/^\/\/.*$/gm, '')}\nexport function replay(DIR, OPT = {}) {\n  const console = { error() {} };\n${body}\n}\n`;
  const tmp = path.join(path.dirname(OOS), `.mosha-bo-er-${process.pid}.mjs`);
  fs.writeFileSync(tmp, mod);
  try { REPLAY = (await import(pathToFileURL(tmp).href)).replay; } finally { fs.unlinkSync(tmp); }
  return REPLAY;
}

// ─── arm C: the pullback's reversal range on the H1 window at the run ───
export function vrOf(hb, e1, e2, e3, d) {
  let ext = d > 0 ? -Infinity : Infinity;
  for (const b of hb) if (b.time >= e1.t - 14400 && b.time < e2.t) ext = d > 0 ? Math.max(ext, b.high) : Math.min(ext, b.low);
  if (!Number.isFinite(ext)) return null;
  const lo = Math.min(ext, e2.level), hi = Math.max(ext, e2.level);
  return { ext: r3(ext), box: [r3(lo), r3(hi)], cf: r3(e3.level), case2: e3.level >= lo && e3.level <= hi };
}

// ─── arm A: ER20 of the 17:00 New York days that had closed at time T ───
// days(h1) from gold-drd-long: day i has closed at T when day i + 1's first H1 candle started at or before T
export function erAt(ds, T, n = K.ER_N) {
  let a = 0, b = ds.length;   // first index whose day started after T
  while (a < b) { const m = (a + b) >> 1; if (ds[m].t <= T) a = m + 1; else b = m; }
  const i = a - 2;            // ds[a - 1] is the day T falls in (forming); the one before it has closed
  return i >= 0 ? er(ds, i, n) : null;
}

// ─── positions: the first unit + its add, net of $0.30 a unit and financing on buy units ───
export function positions(legs) {
  const by = new Map();
  for (const x of legs) { if (x.shadow || x.status === 'expired' || x.status === 'missed') continue; const r = x.addOf || x.id; if (!by.has(r)) by.set(r, []); by.get(r).push(x); }
  const out = [];
  for (const [id, L] of by) {
    const f = L.find((x) => !x.addOf); if (!f || f.filled == null) continue;
    let g = 0, n = 0, fin = 0;
    for (const x of L) {
      if (!(x.r0 > 0) || x.stop == null) throw new Error(`${x.id}: a unit without a stop`);
      const s = x.size || 1, fr = x.side === 'buy' ? nights(x.filled, x.closed) * FIN.xau.long * x.entry / x.r0 : 0;
      g += x.R * s; n += (x.R - K.COST / x.r0 - fr) * s; fin += fr * s;
    }
    out.push({ id, side: f.side === 'sell' ? -1 : 1, o: f.opened, t: f.filled, c: Math.max(...L.map((x) => x.closed)), g, R: n, fin, r0: f.r0, add: L.length > 1, atEnd: L.some((x) => x.atEnd), mode: f.entryMode, limitAt: f.limitAt ?? f.entry, entry: f.entry });
  }
  return out.filter((p) => p.t >= K.FROM).sort((p, q) => p.t - q.t);
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : null; };
export function block(P) {
  const R = P.map((x) => x.R), s = sd(R);
  return { n: P.length, avg: r4(mean(R)), total: r3(R.reduce((a, x) => a + x, 0)), t: P.length > 1 && s > 0 ? r3(mean(R) / s * Math.sqrt(P.length)) : null,
    win: P.length ? r3(P.filter((x) => x.R > 0).length / P.length) : null, gross: r4(mean(P.map((x) => x.g))), maxDD: r3(CG.maxDD(P)) };
}
const halves = (P) => ({ all: block(P), h1: block(P.filter((x) => x.t < K.SPLIT)), h2: block(P.filter((x) => x.t >= K.SPLIT)) });
// every calendar month from 2020-01 to the month of `end`: the sum of R of the positions filled in it (0 when none)
export function monthSums(P, end) {
  const keys = [], d = new Date(K.FROM * 1000), e = new Date(end * 1000).toISOString().slice(0, 7);
  for (;;) { const k = d.toISOString().slice(0, 7); keys.push(k); if (k >= e) break; d.setUTCMonth(d.getUTCMonth() + 1); }
  const m = new Map(keys.map((k) => [k, 0]));
  for (const x of P) { const k = new Date(x.t * 1000).toISOString().slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + x.R); }
  return [...m.values()];
}
const wl = (w) => ({ diff: r4(w.diff), t: r3(w.t), df: r3(w.df), p: w.p == null ? null : +w.p.toPrecision(4) });

export function armA(P, ds, end) {
  for (const x of P) x.er = erAt(ds, x.o);
  const mask = P.map((x) => x.er == null || x.er >= K.ER_MIN), kept = P.filter((_, i) => mask[i]), blocked = P.filter((_, i) => !mask[i]);
  const S = CG.splitStats(P, mask), wT = CG.welch(kept.map((x) => x.R), blocked.map((x) => x.R)), wM = CG.welch(monthSums(kept, end), monthSums(P, end));
  const pl = CG.placebo(P, blocked.length, K.PLACEBO, 7);
  return { all: halves(P), kept: halves(kept), blocked: halves(blocked), noEr: P.filter((x) => x.er == null).length, welchTrades: wl(wT), welchMonths: wl(wM), placebo: pl,
    rules: { halves: S.rules.halves, t: wT.t != null && wT.t >= K.T_MIN, monthT: wM.t != null && wM.t >= K.T_MIN, dd: CG.maxDD(kept) <= CG.maxDD(P) + 1e-9,
      n: kept.length >= K.MIN_KEPT && blocked.length >= K.MIN_BLOCKED, placebo: wT.t != null && pl.t95 != null && wT.t > pl.t95 } };
}
export function armB(Pm, Pl, end) {
  const M = halves(Pm), L = halves(Pl), wT = CG.welch(Pm.map((x) => x.R), Pl.map((x) => x.R)), wM = CG.welch(monthSums(Pm, end), monthSums(Pl, end));
  const gt = (a, b) => a.n > 0 && b.n > 0 && a.avg > b.avg;
  return { market: M, limit: L, welchTrades: wl(wT), welchMonths: wl(wM),
    rules: { halves: gt(M.h1, L.h1) && gt(M.h2, L.h2), t: wT.t != null && wT.t >= K.T_MIN, monthT: wM.t != null && wM.t >= K.T_MIN, dd: CG.maxDD(Pm) <= CG.maxDD(Pl) + 1e-9 } };
}
export function armC(P, vr) {
  const c2 = P.filter((x) => vr.get(x.id)?.case2 === true), rest = P.filter((x) => vr.get(x.id)?.case2 === false);
  return { case2: halves(c2), beyond: halves(rest), unknown: P.length - c2.length - rest.length, welch: wl(CG.welch(c2.map((x) => x.R), rest.map((x) => x.R))) };
}

// ─── commands ───
const loadTf = (dir, tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
async function doReplay(cdir, odir) {
  fs.mkdirSync(odir, { recursive: true });
  const run = await loadReplay(), vr = new Map();
  const live = run(cdir, { vr, vrOf }); fs.writeFileSync(path.join(odir, 'live.json'), JSON.stringify(live));
  fs.writeFileSync(path.join(odir, 'vr.json'), JSON.stringify([...vr]));
  const mOpt = { market: true }, mkt = run(cdir, mOpt); mkt.wrongSide = mOpt.wrongSide || 0; fs.writeFileSync(path.join(odir, 'market.json'), JSON.stringify(mkt));
  // parity: mosha-oos's own replay, as a separate process, on the same candles
  const pdir = path.join(odir, 'mosha-oos'); fs.mkdirSync(pdir, { recursive: true });
  execFileSync(process.execPath, [OOS, 'replay'], { env: { ...process.env, CANDLES: cdir, OUT_DIR: pdir }, stdio: 'inherit' });
  console.log('replayed: live legs', live.legs.length, 'market legs', mkt.legs.length, 'market entries on the wrong side', mkt.wrongSide);
}
function study(cdir, odir) {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(odir, f), 'utf8'));
  const live = J('live.json'), mkt = J('market.json'), ref = J('mosha-oos/trades.json'), vr = new Map(J('vr.json'));
  if (JSON.stringify(ref.legs) !== JSON.stringify(live.legs)) throw new Error('parity gate: the live arm differs from mosha-oos/run.mjs replay');
  const h1 = loadTf(cdir, '1h'), m5 = loadTf(cdir, '5m'), end = m5.at(-1).time + 300, ds = days(h1);
  const Pl = positions(live.legs), Pm = positions(mkt.legs);
  const A = armA(Pl, ds, end), B = armB(Pm, Pl, end), C = { limit: armC(Pl, vr), market: armC(Pm, vr) };
  const adj = SB.holm([A.welchTrades.p, B.welchTrades.p]);
  A.pHolm = adj[0] == null ? null : +adj[0].toPrecision(4); B.pHolm = adj[1] == null ? null : +adj[1].toPrecision(4);
  A.rules.holm = A.pHolm != null && A.pHolm <= K.ALPHA; B.rules.holm = B.pHolm != null && B.pHolm <= K.ALPHA;
  A.pass = Object.values(A.rules).every(Boolean); B.pass = Object.values(B.rules).every(Boolean);
  const missed = (r) => Object.entries(r).filter(([, v]) => !v).map(([k]) => k);
  // B diagnostics: which chains each arm took
  const lim = new Set(Pl.map((x) => x.id)), mk = new Set(Pm.map((x) => x.id));
  const onlyMarket = Pm.filter((x) => !lim.has(x.id)), both = Pm.filter((x) => lim.has(x.id));
  const deep = Pm.map((x) => ({ x, gap: Math.abs(x.entry - x.limitAt) / x.r0 }));
  const verdict = `A (Daily ER20 >= 0.2): ${A.pass ? 'PASS' : `FAIL (${missed(A.rules).join(', ')})`}; B (market on the confirmation close): ${B.pass ? 'PASS' : `FAIL (${missed(B.rules).join(', ')})`}`;
  const out = { study: 'mosha-bo-er', topic: 'mosha-bo-er', title: 'Mosha BO: the Daily regime filter, a market entry on the confirmation, and where the confirmation forms', built: '2026-11-13',
    preregistration: 'research/edge/mosha-bo-er/PREREGISTRATION.md', system: 'Mosha BO (live rule, a paper shadow since 11 Nov 2026), OANDA gold 2020 to now',
    rule: 'paper research only: no live rule, size, filter, stop or config changes', verdict,
    params: K, window: { from: '2020-01-01', split: '2024-01-01', candlesTo: iso(end), parity: 'live arm equals mosha-oos/run.mjs replay leg for leg' },
    counts: { liveLegs: live.legs.length, marketLegs: mkt.legs.length, marketWrongSide: mkt.wrongSide, limitPositions: Pl.length, marketPositions: Pm.length, both: both.length, onlyMarket: onlyMarket.length, onlyLimit: Pl.filter((x) => !mk.has(x.id)).length },
    A, B, C,
    Bdetail: { marketOnlyChains: block(onlyMarket), sameChainsMarket: block(both), sameChainsLimit: block(Pl.filter((x) => mk.has(x.id))),
      medianR0: { limit: r3(Pl.map((x) => x.r0).sort((a, b) => a - b)[Pl.length >> 1]), market: r3(Pm.map((x) => x.r0).sort((a, b) => a - b)[Pm.length >> 1]) },
      medianGapR: r3(deep.map((d) => d.gap).sort((a, b) => a - b)[deep.length >> 1]) },
    financing: { limit: r3(Pl.reduce((s, x) => s + x.fin, 0)), market: r3(Pm.reduce((s, x) => s + x.fin, 0)) },
    marked: { limit: Pl.filter((x) => x.atEnd).length, market: Pm.filter((x) => x.atEnd).length } };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict, A: { all: A.all, kept: A.kept, blocked: A.blocked, w: A.welchTrades, m: A.welchMonths, pl: A.placebo, pH: A.pHolm, rules: A.rules }, B: { m: B.market, l: B.limit, w: B.welchTrades, wm: B.welchMonths, pH: B.pHolm, rules: B.rules }, C, counts: out.counts, Bdetail: out.Bdetail }, null, 1));
}

if (SELF) {
  const [cmd, a1, a2] = ARGV;
  if (cmd === 'replay') await doReplay(a1, a2);
  else if (cmd === 'study') study(a1, a2);
  else console.error('usage: run.mjs replay <candleDir> <outDir> | study <candleDir> <outDir>');
}
