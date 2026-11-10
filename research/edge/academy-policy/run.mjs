// Academy policy investigation, stage 2: the analysis (offline: committed files only, no candles, no network).
//
//   node research/edge/academy-policy/run.mjs            # writes result.json, prints a short summary
//   node research/edge/academy-policy/run.mjs --md       # also prints the report's tables as markdown
//
// Reads decisions.json (stage 1, no outcomes), the candidate files and the outcome files of academy/data. An outcome is
// kept only when it belongs to a usable train setup; exam and flagged outcomes are dropped as the file is parsed and never
// looked at (the test swaps every one of them for a wild value and gets the same bytes back).
// Everything pre-registered (the split, the candidates, the acceptance rule) is in lib.mjs and PREREGISTRATION.md.
// Deterministic: the same committed files give the same result.json. Paper research; nothing here places an order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPLIT, MIN_SIDE, T_LINE, ALPHA_ONE, ALPHA_TWO, AUDIT_T, HARD_GATES, JUDGEMENT_GATES, EDGE_IDS, CUTS, PARTS, CANDIDATES, C3_TABLE,
  rd, stat, welch, holm, spearman, setStat, splitOf, actionOf, votesOf, auditVotes, testOf, verdictOf, candidateVerdict, mde, zOfP } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const FILES = { data: path.join(ROOT, 'academy/data'), decisions: path.join(HERE, 'decisions.json'), out: path.join(HERE, 'result.json') };
const UNFILLED = ['missed', 'expired', 'cancelled'];
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const isFlagged = (c) => !!(c.rule && (c.rule.clockShift || c.rule.pre2020));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const NAMES = { replica: 'Gold replica', 'mosha-bo': 'Mosha BO', gtrend: 'Gold trend', gtl: 'Gold H4 trendline', geg: 'Gold daily engulf', gmp: 'Gold momentum pullback', 'nq-open': 'NQ New York open run' };

// ---- load: decisions joined to the train outcomes -------------------------------------------------------------------------
// rows of one edge in time order: { id, edge, t, part, rec, filled, netR, exitT }. An exam or flagged outcome never gets here.
export function load({ dataDir = FILES.data, decisionsFile = FILES.decisions } = {}) {
  const dec = readJson(decisionsFile), meta = readJson(path.join(dataDir, 'meta.json')), edges = {}, counts = {};
  for (const id of EDGE_IDS) {
    const cands = readJson(path.join(dataDir, `cand-${id}.json`)), usable = cands.filter((c) => c.pool === 'train' && !isFlagged(c)), ok = new Set(usable.map((c) => c.id)), outs = {};
    { const all = readJson(path.join(dataDir, `out-${id}.json`)); for (const k of Object.keys(all)) if (ok.has(k)) outs[k] = all[k]; }   // the rest is dropped unread
    const recs = dec.edges[id]; if (!recs) throw new Error('decisions.json has no ' + id);
    if (recs.length !== usable.length || recs.some((r) => !ok.has(r.id))) throw new Error(`${id}: decisions.json does not list exactly the usable train setups (run walk.mjs again)`);
    const sp = splitOf(usable);
    if (sp.cut !== CUTS[id] || sp.discovery.length !== PARTS[id][0] || sp.validation.length !== PARTS[id][1]) throw new Error(`${id}: the split no longer equals the pre-registered cut (${sp.cut} against ${CUTS[id]})`);
    edges[id] = recs.map((r) => {
      const o = outs[r.id]; if (!o) throw new Error('no outcome for ' + r.id);
      const filled = !UNFILLED.includes(o.reason), rec = { ...r, edge: id };
      return { id: r.id, edge: id, t: r.t, part: r.t < CUTS[id] ? 'discovery' : 'validation', rec, filled, netR: filled ? o.netR : null, exitT: filled ? o.exitT : null };
    }).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    counts[id] = { usableTrain: usable.length, examNeverRead: cands.filter((c) => c.pool === 'exam').length, flaggedTrain: cands.filter((c) => c.pool === 'train' && isFlagged(c)).length };
  }
  return { edges, counts, meta, dec };
}

// ---- pieces --------------------------------------------------------------------------------------------------------------
const trades = (rows) => rows.filter((r) => r.filled);
const inPart = (rows, part) => (part === 'all' ? rows : rows.filter((r) => r.part === part));
// one policy on one set of rows: mechanical / take / wait with drawdown, the difference and its Welch t
function blockOf(rows, policy, ctx, pooled = false) {
  const tr = trades(rows), take = tr.filter((r) => actionOf(policy, r.rec, ctx) === 'TAKE'), wait = tr.filter((r) => actionOf(policy, r.rec, ctx) !== 'TAKE');
  const orders = rows.length, takeOrders = rows.filter((r) => actionOf(policy, r.rec, ctx) === 'TAKE').length;
  return { orders, unfilled: orders - tr.length, takeOrders, ...testOf({ take, wait, pooled }) };
}
const slim = (b) => { const { pOne, pTwo, ...rest } = b; return { ...rest, pOne: rd(pOne, 5), pTwo: rd(pTwo, 5) }; };

// why policy-1.0 waited, and what the waited trades made
function waitsOf(rows) {
  const w = rows.filter((r) => r.rec.action === 'WAIT'), ev = (r) => r.rec.margin < r.rec.needMargin || r.rec.support < r.rec.needSupport, R = (a) => stat(trades(a).map((r) => r.netR));
  const cls = (r) => (r.rec.gates.length && ev(r) ? 'both' : r.rec.gates.length ? 'gateOnly' : 'evidenceOnly'), by = (f) => { const m = {}; for (const r of w) { const k = f(r); if (k === null) continue; (m[k] = m[k] || []).push(r); } return m; };
  const table = (m) => Object.entries(m).map(([k, a]) => ({ k, orders: a.length, share: rd(a.length / (w.length || 1)), ...R(a) })).sort((a, b) => b.orders - a.orders || (a.k < b.k ? -1 : 1));
  const short = (r) => (!ev(r) ? null : r.rec.margin < r.rec.needMargin && r.rec.support < r.rec.needSupport ? 'margin and support' : r.rec.margin < r.rec.needMargin ? 'margin only' : 'support only');
  return { orders: w.length, shareOfSetups: rd(w.length / (rows.length || 1)), ...R(w), decidedBy: table(by(cls)), evidenceShort: table(by(short)), topContradiction: table(by((r) => (r.rec.con.length ? r.rec.con[0][0] : null))),
    gates: JUDGEMENT_GATES.concat(HARD_GATES).map((g) => { const a = w.filter((r) => r.rec.gates.includes(g)); return a.length ? { k: g, orders: a.length, share: rd(a.length / (w.length || 1)), ...R(a) } : null; }).filter(Boolean) };
}
function marginOf(rows) {
  const tr = trades(rows), s = spearman(tr.map((r) => r.rec.margin), tr.map((r) => r.netR));
  const band = (name, f) => ({ band: name, ...stat(tr.filter(f).map((r) => r.netR)) });
  return { spearman: s, bands: [band('margin below 0', (r) => r.rec.margin < 0), band('0 to under the line', (r) => r.rec.margin >= 0 && r.rec.margin < r.rec.needMargin), band('at or over the line', (r) => r.rec.margin >= r.rec.needMargin)] };
}
function diagnosisOf(rows) {
  const out = {};
  for (const part of ['discovery', 'validation']) {
    const p = inPart(rows, part), tr = trades(p);
    out[part] = { setups: p.length, trades: tr.length, policy: slim(blockOf(p, 'C0')), waits: waitsOf(p), margin: marginOf(p), votes: auditVotes(tr.map((r) => ({ rec: r.rec, netR: r.netR }))),
      voteShareOfSetups: Object.fromEntries([...new Set(p.flatMap((r) => votesOf(r.rec)))].sort().map((k) => [k, rd(p.filter((r) => votesOf(r.rec).includes(k)).length / p.length)])) };
  }
  // every discovery vote with its validation line beside it (nothing re-fitted)
  out.signs = out.discovery.votes.map((d) => { const v = out.validation.votes.find((x) => x.vote === d.vote) || null;
    return { vote: d.vote, kind: d.kind, discovery: { nWith: d.nWith, nWithout: d.nWithout, diff: d.diff, t: d.t, wrongSigned: d.wrongSigned }, validation: v ? { nWith: v.nWith, nWithout: v.nWithout, diff: v.diff, t: v.t, wrongSigned: v.wrongSigned } : null,
      sameSign: d.diff !== null && v && v.diff !== null ? Math.sign(d.diff) === Math.sign(v.diff) : null }; });
  return out;
}

// ---- the whole study -----------------------------------------------------------------------------------------------------
export function build(opts = {}) {
  const L = load(opts), E = L.edges, all = EDGE_IDS.flatMap((id) => E[id]);
  // pooled tests use net R with the edge's discovery mechanical mean taken out
  const discMean = {}; for (const id of EDGE_IDS) { const a = trades(inPart(E[id], 'discovery')).map((r) => r.netR); discMean[id] = a.length ? mean(a) : 0; }
  for (const r of all) r.adj = r.filled ? r.netR - discMean[r.edge] : null;
  const scopes = EDGE_IDS.map((id) => ({ scope: id, rows: E[id], pooled: false })).concat([{ scope: 'pooled', rows: all, pooled: true }]);

  // ---- diagnosis (discovery, then the same table on validation) and C4's drop list (discovery only) ----
  const diagnosis = {}, drops = {};
  for (const id of EDGE_IDS) { diagnosis[id] = diagnosisOf(E[id]); drops[id] = diagnosis[id].discovery.votes.filter((v) => v.drop).map((v) => v.vote); }
  const ctx = { drops };

  // ---- the incumbent on both parts, and the harm check on validation (two-sided, Holm) ----
  const incumbent = {};
  for (const s of scopes) incumbent[s.scope] = { discovery: slim(blockOf(inPart(s.rows, 'discovery'), 'C0', ctx, s.pooled)), validation: blockOf(inPart(s.rows, 'validation'), 'C0', ctx, s.pooled), all: slim(blockOf(s.rows, 'C0', ctx, s.pooled)) };
  { const fam = scopes.filter((s) => incumbent[s.scope].validation.testable), adj = holm(fam.map((s) => incumbent[s.scope].validation.pTwo));
    fam.forEach((s, i) => { const v = incumbent[s.scope].validation; v.pTwoHolm = rd(adj[i], 5); v.harm = adj[i] <= ALPHA_TWO && v.diff < 0 ? 'measurably worse' : 'no measurable difference'; });
    for (const s of scopes) { const v = incumbent[s.scope].validation; if (!v.testable) { v.pTwoHolm = null; v.harm = 'cannot be tested: too few trades on one side'; } incumbent[s.scope].validation = slim(v); } }

  // ---- candidates ----
  const cands = CANDIDATES.map((c) => ({ ...c, scopes: scopes.map((s) => {
    const changed = s.rows.filter((r) => actionOf(c.id, r.rec, ctx) !== actionOf('C0', r.rec, ctx)).length;
    return { scope: s.scope, changedSetups: changed, discovery: blockOf(inPart(s.rows, 'discovery'), c.id, ctx, s.pooled), validation: blockOf(inPart(s.rows, 'validation'), c.id, ctx, s.pooled) };
  }) }));
  // the Holm family: every candidate x scope that differs from policy-1.0 there and can be tested on validation
  const family = []; for (const c of cands) for (const s of c.scopes) if (s.changedSetups > 0 && s.validation.testable) family.push({ c, s });
  const adj = holm(family.map((x) => x.s.validation.pOne)), barT = family.length ? zOfP(ALPHA_ONE / family.length) : null;
  family.forEach((x, i) => { x.s.pHolm = adj[i]; });
  for (const c of cands) {
    for (const s of c.scopes) {
      const inFam = s.pHolm !== undefined, v = s.validation;
      s.tested = inFam; s.verdict = s.changedSetups === 0 ? 'identical to policy-1.0 here: not a test' : verdictOf(v, inFam ? s.pHolm : 1);
      const sd = stat(trades(inPart(scopes.find((q) => q.scope === s.scope).rows, 'discovery')).map((r) => (s.scope === 'pooled' ? r.adj : r.netR))).sd;
      s.power = { sdDiscovery: sd, mdeAtT2: mde(sd, v.take.n, v.wait.n, T_LINE), mdeAfterHolm: barT ? mde(sd, v.take.n, v.wait.n, barT) : null };
      s.pHolm = inFam ? rd(s.pHolm, 5) : null; s.discovery = slim(s.discovery); s.validation = slim(s.validation);
    }
    c.verdict = candidateVerdict(c.scopes);
    c.acceptedScopes = c.scopes.filter((s) => s.verdict === 'accepted').map((s) => s.scope);
    // the two lines the Edge lab page reads: the pooled take-set on discovery (in sample) and validation (out of sample)
    const p = c.scopes.find((s) => s.scope === 'pooled'), lab = (b) => ({ n: b.take.n, exp: b.take.avg, R: b.take.total, wr: b.take.win, maxDD: b.take.maxDD, t: b.take.t });
    c.rule = `${c.id} ${c.name}`; c.is = lab(p.discovery); c.oos = lab(p.validation);
  }
  const accepted = cands.filter((c) => c.verdict === 'accepted');

  // ---- hypotheses of the diagnosis, read off the tables ----
  const vote = (id, part, key) => diagnosis[id][part].votes.find((v) => v.vote === key) || null, share = (id, part, key) => diagnosis[id][part].voteShareOfSetups[key] || 0;
  const notWorse = (v) => (v && v.t !== null ? v.diff >= 0 || Math.abs(v.t) < T_LINE : null);
  const line = (id, key) => ({ vote: key, discovery: { share: share(id, 'discovery', key), ...pick(vote(id, 'discovery', key)) }, validation: { share: share(id, 'validation', key), ...pick(vote(id, 'validation', key)) } });
  function pick(v) { return v ? { nWith: v.nWith, nWithout: v.nWithout, rWith: v.rWith, rWithout: v.rWithout, diff: v.diff, t: v.t } : { nWith: 0, nWithout: null, rWith: null, rWithout: null, diff: null, t: null }; }
  const H = {};
  { const a = line('gmp', 'con:displacement'), b = line('gmp', 'con:oppLiq');
    H.H1 = { claim: 'gmp: displacement against and oppLiq in the way each fire on at least 40 % of discovery setups, and trades carrying them are not worse', lines: [a, b],
      holdsDiscovery: [a, b].every((x) => x.discovery.share >= 0.4) && [vote('gmp', 'discovery', 'con:displacement'), vote('gmp', 'discovery', 'con:oppLiq')].every((v) => notWorse(v) === true),
      shareAtLeast40: [a, b].map((x) => x.discovery.share >= 0.4), notWorseDiscovery: [notWorse(vote('gmp', 'discovery', 'con:displacement')), notWorse(vote('gmp', 'discovery', 'con:oppLiq'))], notWorseValidation: [notWorse(vote('gmp', 'validation', 'con:displacement')), notWorse(vote('gmp', 'validation', 'con:oppLiq'))] }; }
  { const a = line('gmp', 'gate:volatility'), b = line('gmp', 'con:volatility');
    H.H2 = { claim: 'gmp: trades the volatility gate holds back are not worse than the rest', lines: [a, b], holdsDiscovery: notWorse(vote('gmp', 'discovery', 'gate:volatility')), holdsValidation: notWorse(vote('gmp', 'validation', 'gate:volatility')) }; }
  { const a = line('replica', 'con:location'), top = diagnosis.replica.discovery.waits.topContradiction[0] || null;
    H.H3 = { claim: 'replica: poor location is the leading wait reason and trades carrying it are not worse than the rest', lines: [a], leadingTopContradictionDiscovery: top ? top.k : null,
      holdsDiscovery: !!top && top.k === 'location' && notWorse(vote('replica', 'discovery', 'con:location')) === true, notWorseValidation: notWorse(vote('replica', 'validation', 'con:location')) }; }
  { const m = (id, part) => diagnosis[id][part].margin.spearman, notPos = (s) => (s.t === null ? null : !(s.rho > 0 && s.t >= T_LINE));
    H.H4 = { claim: 'the evidence margin does not rank trades: its rank correlation with net R is not positive on replica and gmp', replica: { discovery: m('replica', 'discovery'), validation: m('replica', 'validation') }, gmp: { discovery: m('gmp', 'discovery'), validation: m('gmp', 'validation') },
      holdsDiscovery: notPos(m('replica', 'discovery')) && notPos(m('gmp', 'discovery')), holdsValidation: notPos(m('replica', 'validation')) && notPos(m('gmp', 'validation')),
      everyEdge: Object.fromEntries(EDGE_IDS.map((id) => [id, { discovery: m(id, 'discovery'), validation: m(id, 'validation') }])) }; }
  { const rowsH5 = []; for (const id of EDGE_IDS) for (const key of ['sup:similar', 'con:similar']) { const d = vote(id, 'discovery', key), v = vote(id, 'validation', key); if (d || v) rowsH5.push({ edge: id, vote: key, discovery: pick(d), validation: pick(v) }); }
    const sep = (x) => x.t !== null && Math.abs(x.t) >= T_LINE;   // the vote separates, the right way round, at the t line
    H.H5 = { claim: 'the similar-cases vote does not separate better trades from worse on any edge', lines: rowsH5,
      holdsDiscovery: rowsH5.every((r) => !(sep(r.discovery) && (r.vote.startsWith('sup') ? r.discovery.diff > 0 : r.discovery.diff < 0))), holdsValidation: rowsH5.every((r) => !(sep(r.validation) && (r.vote.startsWith('sup') ? r.validation.diff > 0 : r.validation.diff < 0))) }; }
  { const g = []; for (const id of EDGE_IDS) for (const code of JUDGEMENT_GATES) for (const part of ['discovery', 'validation']) { const a = trades(inPart(E[id], part)).filter((r) => r.rec.gates.includes(code)).map((r) => r.netR); if (a.length) g.push({ edge: id, gate: code, part, ...stat(a), enough: a.length >= MIN_SIDE }); }
    const neg = (part) => g.filter((x) => x.part === part && x.enough && x.avg < 0);
    H.H6 = { claim: 'none of the four judgement gates marks a group of trades with negative net R on any edge with at least 20 gated trades', groups: g, negativeDiscovery: neg('discovery'), negativeValidation: neg('validation'), holdsDiscovery: neg('discovery').length === 0, holdsValidation: neg('validation').length === 0 }; }

  // ---- power, restated with the discovery SD ----
  const power = scopes.map((s) => { const d = trades(inPart(s.rows, 'discovery')).map((r) => (s.pooled ? r.adj : r.netR)), v = trades(inPart(s.rows, 'validation')), sd = stat(d).sd, half = Math.floor(v.length / 2), mechAll = stat(trades(s.rows).map((r) => r.netR));
    return { scope: s.scope, sdDiscovery: sd, validationTrades: v.length, evenSplitTestable: half >= MIN_SIDE, mdeAtT2EvenSplit: half >= MIN_SIDE ? mde(sd, half, v.length - half, T_LINE) : null, mdeAfterHolmEvenSplit: half >= MIN_SIDE && barT ? mde(sd, half, v.length - half, barT) : null, edgeMean: mechAll.avg }; });

  const tested = family.length, nAccepted = cands.reduce((n, c) => n + c.acceptedScopes.length, 0);
  const verdict = accepted.length
    ? `Pass on validation: ${accepted.map((c) => `${c.id} (${c.acceptedScopes.join(', ')})`).join('; ')} met the pre-registered rule. The exam read decides (see exam).`
    : `No candidate passes: 0 of ${tested} candidate x scope tests on validation is accepted after the Holm correction. policy-1.0 stays; the exam pool was not read.`;
  const result = {
    title: 'Academy decision policy against taking every setup: diagnosis and five pre-registered candidates', built: L.meta.generated,
    system: 'MeridianX Academy decision policy (policy-1.0, no lessons, no model) on the seven edges\' usable train setups; net R a trade after costs',
    variantsTried: CANDIDATES.length, verdict,
    preregistration: { file: 'research/edge/academy-policy/PREREGISTRATION.md', split: SPLIT, minSide: MIN_SIDE, tLine: T_LINE, alphaOneSided: ALPHA_ONE, alphaTwoSided: ALPHA_TWO, auditT: AUDIT_T, hardGates: HARD_GATES, judgementGates: JUDGEMENT_GATES, c3Table: C3_TABLE, amendments: [] },
    data: { policy: L.dec.policy, core: L.dec.core, dataVersion: L.dec.dataVersion, generated: L.dec.generated, pool: 'train, not flagged', counts: L.counts },
    splits: Object.fromEntries(EDGE_IDS.map((id) => [id, { name: NAMES[id], cut: CUTS[id], cutUtc: new Date(CUTS[id] * 1000).toISOString().slice(0, 16).replace('T', ' '), discoverySetups: PARTS[id][0], validationSetups: PARTS[id][1], discoveryTrades: trades(inPart(E[id], 'discovery')).length, validationTrades: trades(inPart(E[id], 'validation')).length, discoveryMean: rd(discMean[id]) }])),
    null: 'mechanical = take every setup, on the same trades',
    incumbent, diagnosis, hypotheses: H, c4Drops: drops,
    holm: { tests: tested, family: family.map((x) => `${x.c.id}:${x.s.scope}`), tNeededForTheSmallestP: barT, note: 'one-sided p of every candidate x scope test that differs from policy-1.0 and has 20 trades on each side on validation' },
    candidates: cands, baseline: { is: labStat(blockOf(inPart(all, 'discovery'), 'C1', ctx).mechanical), oos: labStat(blockOf(inPart(all, 'validation'), 'C1', ctx).mechanical) },
    power: { note: 'smallest take-minus-wait difference that reaches the t line on validation, from the discovery SD; "even split" is the best case', scopes: power },
    exam: { reads: 0, ledger: 'academy/data/exam-ledger.json', note: accepted.length ? 'a candidate passed validation: the exam read is logged in the ledger before it is made' : 'no candidate passed validation, so the exam pool was not read' },
    counts: { candidates: CANDIDATES.length, tests: tested, accepted: nAccepted, rejected: cands.filter((c) => c.verdict === 'rejected').length, inconclusive: cands.filter((c) => c.verdict === 'inconclusive').length },
    reproduce: ['ACADEMY_CANDLES=<folder outside the repo> node research/edge/academy-policy/walk.mjs', 'node research/edge/academy-policy/run.mjs'],
  };
  return result;
}
function labStat(s) { return { n: s.n, exp: s.avg, R: s.total, wr: s.win, maxDD: s.maxDD, t: s.t }; }
export const render = (result) => JSON.stringify(result, null, 1) + '\n';

// ---- markdown tables for RESULT.md -----------------------------------------------------------------------------------------
const sg = (x, d = 2) => (x === null || x === undefined ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const nf = (x, d = 2) => (x === null || x === undefined ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const set = (s) => (s.n ? `${s.n}, ${sg(s.avg)}, ${nf(s.t)}, ${s.win === null ? 'n/a' : Math.round(s.win * 100) + ' %'}, ${nf(s.maxDD)}` : '0');
export function markdown(R) {
  const o = [], P = (s) => o.push(s);
  P('### Splits\n'); P('| Edge | Cut (UTC) | Discovery setups / trades | Validation setups / trades |'); P('|---|---|---|---|');
  for (const [id, s] of Object.entries(R.splits)) P(`| ${id} | ${s.cutUtc} | ${s.discoverySetups} / ${s.discoveryTrades} | ${s.validationSetups} / ${s.validationTrades} |`);
  for (const part of ['discovery', 'validation', 'all']) {
    P(`\n### policy-1.0 against taking every setup: ${part}\n`); P('Each set: n, net R a trade, t, win rate, max drawdown in R.\n');
    P('| Scope | Every setup | Policy takes | Policy waits | Take minus wait | Welch t |' + (part === 'validation' ? ' Harm check (two-sided, Holm) |' : '')); P('|---|---|---|---|---|---|' + (part === 'validation' ? '---|' : ''));
    for (const [id, x] of Object.entries(R.incumbent)) { const b = x[part]; P(`| ${id} | ${set(b.mechanical)} | ${set(b.take)} | ${set(b.wait)} | ${sg(b.diff)} | ${nf(b.t)} |` + (part === 'validation' ? ` ${b.harm}${b.pTwoHolm !== null ? ' (adjusted p ' + nf(b.pTwoHolm, 3) + ')' : ''} |` : '')); }
  }
  for (const id of ['replica', 'gmp', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'nq-open']) {
    const D = R.diagnosis[id];
    P(`\n### Diagnosis: ${id}\n`);
    for (const part of ['discovery', 'validation']) {
      const w = D[part].waits;
      P(`**${part}**: ${D[part].setups} setups, ${D[part].trades} trades; policy-1.0 waited on ${w.orders} (${Math.round(w.shareOfSetups * 100)} %), and those trades made ${sg(w.avg)} R a trade (n ${w.n}, t ${nf(w.t)}).`);
      P(`Decided by: ${w.decidedBy.map((x) => `${x.k} ${x.orders} (${sg(x.avg)} R, n ${x.n})`).join('; ') || 'n/a'}. Evidence short on: ${w.evidenceShort.map((x) => `${x.k} ${x.orders} (${sg(x.avg)} R, n ${x.n})`).join('; ') || 'n/a'}.`);
      P(`Top contradiction of a wait: ${w.topContradiction.map((x) => `${x.k} ${x.orders} (${sg(x.avg)} R, n ${x.n}, t ${nf(x.t)})`).join('; ') || 'n/a'}.`);
      P(`Gates among waits: ${w.gates.map((x) => `${x.k} ${x.orders} (${sg(x.avg)} R, n ${x.n}, t ${nf(x.t)})`).join('; ') || 'none'}.`);
      const m = D[part].margin; P(`Margin against net R: Spearman ${nf(m.spearman.rho, 3)} (t ${nf(m.spearman.t)}, n ${m.spearman.n}); ${m.bands.map((b) => `${b.band}: n ${b.n}, ${sg(b.avg)} R`).join('; ')}.\n`);
    }
    P('| Vote | Kind | Discovery: n with / without | R with | R without | Diff | t | Wrong-signed | Validation: n with / without | Diff | t | Wrong-signed | Dropped by C4 |'); P('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const d of D.discovery.votes) { const v = D.validation.votes.find((x) => x.vote === d.vote);
      P(`| ${d.vote} | ${d.kind} | ${d.nWith} / ${d.nWithout} | ${sg(d.rWith)} | ${sg(d.rWithout)} | ${sg(d.diff)} | ${nf(d.t)} | ${d.wrongSigned === null ? 'too few' : d.wrongSigned ? 'yes' : 'no'} | ${v ? v.nWith + ' / ' + v.nWithout : '0'} | ${v ? sg(v.diff) : 'n/a'} | ${v ? nf(v.t) : 'n/a'} | ${!v || v.wrongSigned === null ? 'too few' : v.wrongSigned ? 'yes' : 'no'} | ${d.drop ? 'yes' : ''} |`); }
  }
  P('\n### Candidates on validation (the decision) and discovery (for information)\n'); P('Each set: n, net R a trade, t, win rate, max drawdown in R. p is one-sided.\n');
  for (const c of R.candidates) {
    P(`\n**${c.id} ${c.name}: ${c.verdict}.** ${c.what}\n`);
    P('| Scope | Part | Every setup | Takes | Waits | Take minus wait | Welch t | p | Holm p | Above baseline | Drawdown not worse | Smallest detectable diff (t 2 / after Holm) | Verdict |'); P('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const s of c.scopes) {
      if (s.changedSetups === 0) { P(`| ${s.scope} | both | | | | | | | | | | | identical to policy-1.0 |`); continue; }
      const d = s.discovery, v = s.validation;
      P(`| ${s.scope} | discovery | ${set(d.mechanical)} | ${set(d.take)} | ${set(d.wait)} | ${sg(d.diff)} | ${nf(d.t)} | ${nf(d.pOne, 3)} | | | | | (information) |`);
      P(`| ${s.scope} | validation | ${set(v.mechanical)} | ${set(v.take)} | ${set(v.wait)} | ${sg(v.diff)} | ${nf(v.t)} | ${nf(v.pOne, 3)} | ${s.pHolm === null ? 'not tested' : nf(s.pHolm, 3)} | ${v.aboveMechanical === null ? 'n/a' : v.aboveMechanical ? 'yes' : 'no'} | ${v.drawdownNotWorse === null ? 'n/a' : v.drawdownNotWorse ? 'yes' : 'no'} | ${nf(s.power.mdeAtT2)} / ${nf(s.power.mdeAfterHolm)} | ${s.verdict} |`);
    }
  }
  P('\n### Power\n'); P('| Scope | SD of net R on discovery | Validation trades | Smallest difference at t = 2, even split | After Holm | The edge\'s own mean (whole train pool) |'); P('|---|---|---|---|---|---|');
  for (const p of R.power.scopes) P(`| ${p.scope} | ${nf(p.sdDiscovery)} | ${p.validationTrades} | ${p.evenSplitTestable ? nf(p.mdeAtT2EvenSplit) + ' R' : 'cannot be tested'} | ${p.evenSplitTestable ? nf(p.mdeAfterHolmEvenSplit) + ' R' : 'cannot be tested'} | ${sg(p.edgeMean)} R |`);
  return o.join('\n') + '\n';
}

function main() {
  const R = build(), text = render(R); fs.writeFileSync(FILES.out, text);
  console.error(`result.json ${(text.length / 1024).toFixed(0)} KB · ${R.holm.tests} tests · ${R.verdict}`);
  for (const c of R.candidates) console.error(' ', c.id, c.name.padEnd(28), c.verdict, '|', c.scopes.filter((s) => s.tested).map((s) => `${s.scope} t ${s.validation.t} pHolm ${s.pHolm} ${s.verdict}`).join('; '));
  if (process.argv.includes('--md')) process.stdout.write(markdown(R));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
