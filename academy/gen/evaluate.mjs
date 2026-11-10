// MeridianX Academy: does the decision policy add anything over taking every setup?
//
//   ACADEMY_CANDLES=<folder outside the repo> node academy/gen/evaluate.mjs        # writes academy/data/eval.json
//
// For each edge the TRAIN-pool candidates that are not flagged (rule.clockShift, rule.pre2020) are walked in time order.
// Each one gets the decision the page would show: MXA.decide(snapshot, { history, edgeDef: { version, cost }, lessons: [] })
// where the snapshot is the one academy/gen/features.mjs builds (closed bars only) and `history` holds the earlier train
// cases whose trade had FINISHED before this signal, exactly what GET /api/academy?get=history returns. Then the result of
// each candidate (out-<edge>.json) is read and the trades the policy would TAKE are set against the ones it would WAIT on.
//
// What this is: a measurement of the policy as built (MXA.POLICY_VERSION), with no lessons and no model. Nothing is tuned
// here. Exam-pool candidates are never read past their pool tag, so the exam results stay unseen.
// An order that never filled (missed / expired / cancelled) is not a trade: it is counted apart and is in no average.
// Verdict per edge, on net R a trade of TAKE against WAIT (Welch t):  t >= 2 "adds value", t <= -2 "worse", otherwise
// "no measurable difference". Seven edges are tested, so one t near 2 among them is weak evidence by itself.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { EDGES } from '../edges.mjs';
import { DATA_DIR, loadSeries, calendar, buildSnapshot, featuresOf, isFlagged, isFilled, dataVersionOf, readJson } from './features.mjs';

const MXA = createRequire(import.meta.url)('../../assets/academy-core.js');
export const EVAL_RECIPE = 'eval-1';
export const T_LINE = 2;
const rd = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) + 0 : null);

// ---- statistics ---------------------------------------------------------------------------------------------------------
// n, mean, total and the one-sample t of the mean against zero (null under 2 values or with no spread)
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, avg: null, total: 0, t: null, win: null };
  const total = a.reduce((s, x) => s + x, 0), avg = total / n, v = n > 1 ? a.reduce((s, x) => s + (x - avg) * (x - avg), 0) / (n - 1) : 0;
  return { n, avg: rd(avg), total: rd(total, 2), t: n > 1 && v > 0 ? rd(avg / Math.sqrt(v / n), 2) : null, win: rd(a.filter((x) => x > 0).length / n) };
}
// Welch's t for mean(a) - mean(b), with its degrees of freedom
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: a.length && b.length ? rd(mean(a) - mean(b)) : null, t: null, df: null };
  const ma = mean(a), mb = mean(b), va = variance(a, ma) / a.length, vb = variance(b, mb) / b.length, se = Math.sqrt(va + vb);
  if (!(se > 0)) return { diff: rd(ma - mb), t: null, df: null };
  return { diff: rd(ma - mb), t: rd((ma - mb) / se, 2), df: rd((va + vb) * (va + vb) / (va * va / (a.length - 1) + vb * vb / (b.length - 1)), 1) };
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const variance = (a, m) => a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);

// One block of the report from decided rows [{ action, filled, netR, gates[], evidenceWait, topCon, confidence }]
export function block(rows) {
  const take = rows.filter((r) => r.action !== 'WAIT'), wait = rows.filter((r) => r.action === 'WAIT'), R = (a) => a.filter((r) => r.filled).map((r) => r.netR);
  const side = (a) => ({ orders: a.length, unfilled: a.filter((r) => !r.filled).length, ...stat(R(a)) });
  const d = welch(R(take), R(wait)), mech = stat(R(rows)), tk = side(take), wt = side(wait);
  return { orders: rows.length, unfilled: rows.filter((r) => !r.filled).length, mechanical: mech, take: tk, wait: wt, takeShare: rows.length ? rd(take.length / rows.length) : null,
    diff: { takeMinusWait: d.diff, t: d.t, df: d.df, takeMinusMechanical: tk.avg !== null && mech.avg !== null ? rd(tk.avg - mech.avg) : null } };
}
export function verdictOf(b) {
  const tk = b.take, wt = b.wait, d = b.diff;
  if (tk.n < 2 || wt.n < 2 || d.t === null) return { verdict: 'no measurable difference', why: `the policy ${tk.n < 2 ? 'took' : 'skipped'} too few filled trades to compare (TAKE n ${tk.n}, WAIT n ${wt.n})` };
  const base = `TAKE n ${tk.n} at ${tk.avg} R a trade against WAIT n ${wt.n} at ${wt.avg} R, difference ${d.takeMinusWait} R, Welch t ${d.t}`;
  if (d.t >= T_LINE) return { verdict: 'adds value', why: base + (wt.total > 0 ? `; the skipped trades still made ${wt.total} R in total, so fewer trades earned less in total` : '') };
  if (d.t <= -T_LINE) return { verdict: 'worse', why: base + ': the trades it skipped were better than the ones it took' };
  return { verdict: 'no measurable difference', why: base + ` (|t| under ${T_LINE})` };
}
const tally = (list) => { const m = new Map(); for (const k of list) m.set(k, (m.get(k) || 0) + 1); return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n || (a.k < b.k ? -1 : 1)); };
function waitSummary(rows) {
  const w = rows.filter((r) => r.action === 'WAIT');
  return { n: w.length, gateOnly: w.filter((r) => r.gates.length && !r.evidenceWait).length, evidenceOnly: w.filter((r) => !r.gates.length && r.evidenceWait).length, both: w.filter((r) => r.gates.length && r.evidenceWait).length,
    gates: tally(w.flatMap((r) => r.gates)).map((x) => ({ code: x.k, n: x.n })), topContradiction: tally(w.map((r) => r.topCon).filter(Boolean)).slice(0, 6).map((x) => ({ factor: x.k, n: x.n })) };
}
export function report(rows) {
  const b = block(rows), t0 = rows.length ? rows[0].t : null, t1 = rows.length ? rows[rows.length - 1].t : null, cut = rows.length ? Math.round(t0 + 0.7 * (t1 - t0)) : null;
  const conf = {}; for (const c of ['low', 'medium', 'high']) conf[c] = stat(rows.filter((r) => r.action !== 'WAIT' && r.filled && r.confidence === c).map((r) => r.netR));
  return { from: t0, to: t1, ...b, ...verdictOf(b), split: { cut, first70: block(rows.filter((r) => r.t <= cut)), last30: block(rows.filter((r) => r.t > cut)) }, waits: waitSummary(rows), takeByConfidence: conf };
}

// ---- the walk -----------------------------------------------------------------------------------------------------------
// rows of one edge, in time order. `history` grows as trades finish: a case is visible only once its exit lies before t.
export function walkEdge({ edge, cands, outs, series, cal, dataVersion }) {
  const use = cands.filter((c) => c.pool === 'train' && !isFlagged(c)).sort((a, b) => a.t - b.t), done = [], rows = [];
  const edgeDef = { version: edge.version, cost: edge.costPerRoundTrip };
  for (const cand of use) {
    const snapshot = buildSnapshot({ edge, cand, series, cal, dataVersion });
    const history = done.filter((h) => h.t < cand.t && h.exitT < cand.t).map((h) => ({ t: h.t, exitT: h.exitT, features: h.lite, netR: h.netR }));
    const d = MXA.decide(snapshot, { history, edgeDef, lessons: [] });
    // only now is the result read, to score the decision that was already made
    const o = outs[cand.id]; if (!o) throw new Error('no outcome for ' + cand.id);
    const filled = isFilled(o), ev = d.evidence;
    rows.push({ id: cand.id, t: cand.t, action: d.action, filled, netR: filled ? o.netR : null, gates: d.gates.map((g) => g.code), evidenceWait: ev.margin < ev.needMargin || ev.support < ev.needSupport,
      topCon: d.contradicting.length ? d.contradicting[0].factor : null, confidence: d.confidence, similarN: d.similar ? d.similar.n : 0 });
    if (filled) done.push({ t: cand.t, exitT: o.exitT, netR: o.netR, lite: MXA.lite(featuresOf(snapshot)) });
  }
  return rows;
}

async function main() {
  const meta = readJson(path.join(DATA_DIR, 'meta.json')), cal = await calendar(), dataVersion = dataVersionOf(meta);
  const series = await loadSeries(process.env.ACADEMY_CANDLES), edges = {}, all = [], h = crypto.createHash('sha256');
  for (const edge of EDGES) {
    const cands = readJson(path.join(DATA_DIR, `cand-${edge.id}.json`)), outs = readJson(path.join(DATA_DIR, `out-${edge.id}.json`));
    const rows = walkEdge({ edge, cands, outs, series: series[edge.market], cal, dataVersion });
    for (const r of rows) { h.update(`${r.id}:${r.action}\n`); all.push(r); }
    edges[edge.id] = { name: edge.name, edgeVersion: edge.version, cost: edge.costPerRoundTrip, pool: 'train', excluded: { exam: cands.filter((c) => c.pool === 'exam').length, flaggedTrain: cands.filter((c) => c.pool === 'train' && isFlagged(c)).length }, ...report(rows) };
    const e = edges[edge.id];
    console.error(edge.id.padEnd(9), 'mech n', String(e.mechanical.n).padStart(4), String(e.mechanical.avg).padStart(7), 't', String(e.mechanical.t).padStart(6), '| take n', String(e.take.n).padStart(4), String(e.take.avg).padStart(7),
      '| wait n', String(e.wait.n).padStart(4), String(e.wait.avg).padStart(7), '| diff t', String(e.diff.t).padStart(6), '|', e.verdict);
  }
  all.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  const overall = report(all);
  console.error('overall  ', 'mech n', overall.mechanical.n, overall.mechanical.avg, 't', overall.mechanical.t, '| take n', overall.take.n, overall.take.avg, '| wait n', overall.wait.n, overall.wait.avg, '| diff t', overall.diff.t, '|', overall.verdict);
  const out = {
    version: h.digest('hex').slice(0, 12), generated: meta.generated, recipe: EVAL_RECIPE, policy: MXA.POLICY_VERSION, core: MXA.VERSION, dataVersion,
    what: 'The decision policy as built, with no lessons and no model, on the train-pool setups that are not flagged, in time order. TAKE = it would have taken the setup, WAIT = it would not. R figures are net of costs, per trade, on filled trades only.',
    method: { history: 'earlier train cases whose trade had finished before the signal (the rows of GET /api/academy?get=history)', edgeDef: 'version and cost per round trip from academy/edges.mjs', lessons: 'none', model: 'none',
      split: 'first70 / last30 = before and after the point 70 % of the way through the period, by time', t: 'one-sample t of net R against zero; diff.t = Welch t of TAKE minus WAIT',
      verdictRule: `diff.t >= ${T_LINE} adds value; diff.t <= -${T_LINE} worse; otherwise no measurable difference`, unfilled: 'limit orders that never filled are counted in orders / unfilled and are in no average',
      caution: 'Seven edges are tested at once: a single t near 2 is weak evidence. Small samples (gtrend, mosha-bo) cannot show a difference.' },
    edges, overall,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'eval.json'), JSON.stringify(out, null, 1) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e.stack || e); process.exit(1); });
