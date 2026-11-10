// Academy policy investigation, stage 1: the decisions (needs the research candles; stage 2, run.mjs, does not).
//
//   ACADEMY_CANDLES=<folder outside the repo> node research/edge/academy-policy/walk.mjs     # writes decisions.json, ~20 s
//
// One walk through each edge's usable train setups (train pool, not flagged) in time order, exactly the walk of
// academy/gen/evaluate.mjs (the same function): closed bars only, "similar past cases" = earlier train trades that had
// finished before the signal, no lessons, no model. For every setup the decision's votes, gates, margin and confidence are
// written to decisions.json. That file holds NO outcome: a decision record is made before the setup's result is read, and
// the writer refuses any outcome key.
//
// The exam pool: an exam setup is never decided here, and its outcome is dropped from memory as soon as the outcome file
// is parsed (only usable train ids are kept). PREREGISTRATION.md, section 6.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EDGES } from '../../../academy/edges.mjs';
import { DATA_DIR, loadSeries, calendar, featuresOf, isFlagged, dataVersionOf, readJson } from '../../../academy/gen/features.mjs';
import { walkEdge } from '../../../academy/gen/evaluate.mjs';
import { digestOf, actionOf, OUTCOME_KEYS } from './lib.mjs';

const MXA = createRequire(import.meta.url)('../../../assets/academy-core.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DECISIONS = path.join(HERE, 'decisions.json');

// the outcomes of usable train setups only: everything else (exam, flagged) is dropped here and never looked at
export function trainOutcomes(cands, outs) {
  const keep = {}; for (const c of cands) if (c.pool === 'train' && !isFlagged(c) && outs[c.id]) keep[c.id] = outs[c.id];
  return keep;
}
// decisions.json as text: one record a line
export function decisionsText(doc) {
  const { edges, ...head } = doc, lines = Object.entries(head).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const blocks = Object.entries(edges).map(([id, rows]) => `  ${JSON.stringify(id)}: [\n${rows.map((r) => '   ' + JSON.stringify(r)).join(',\n')}\n  ]`);
  return `{\n${lines.join('\n')}\n "edges": {\n${blocks.join(',\n')}\n }\n}\n`;
}

async function main() {
  const meta = readJson(path.join(DATA_DIR, 'meta.json')), cal = await calendar(), dataVersion = dataVersionOf(meta);
  const series = await loadSeries(process.env.ACADEMY_CANDLES), edges = {};
  for (const edge of EDGES) {
    const cands = readJson(path.join(DATA_DIR, `cand-${edge.id}.json`)), outs = trainOutcomes(cands, readJson(path.join(DATA_DIR, `out-${edge.id}.json`))), recs = [];
    const rows = walkEdge({ edge, cands, outs, series: series[edge.market], cal, dataVersion, onDecision: ({ cand, decision, snapshot }) => recs.push(digestOf(edge.id, cand, decision, featuresOf(snapshot))) });
    if (recs.length !== rows.length) throw new Error(edge.id + ': a decision was not recorded');
    for (const r of recs) {
      for (const k of Object.keys(r)) if (OUTCOME_KEYS.includes(k)) throw new Error(`${r.id}: a decision record may not carry ${k}`);
      const want = r.action === 'WAIT' ? 'WAIT' : 'TAKE';
      if (actionOf('C0', r) !== want) throw new Error(`${r.id}: the record does not reproduce the policy's own action (${r.action})`);
    }
    edges[edge.id] = recs.map(({ edge: _e, ...r }) => r);   // the edge is the key the rows sit under
    console.error(edge.id.padEnd(9), 'setups', String(recs.length).padStart(4), 'take', recs.filter((r) => r.action !== 'WAIT').length);
  }
  const doc = { generated: meta.generated, policy: MXA.POLICY_VERSION, core: MXA.VERSION, dataVersion,
    what: 'One record per usable train setup (train pool, not flagged): what the decision policy saw as evidence and what it answered, with no lessons and no model. Made before the setup\'s result was read. No outcome field, no exam setup.',
    keys: 'sup / con = [factor, weight] votes for and against; gates = gate codes; support, contradiction, margin and the two thresholds; confidence; similarN = similar past cases; regime and volRatio = the two features candidate C3 needs',
    edges };
  fs.writeFileSync(DECISIONS, decisionsText(doc));
  console.error('decisions.json', (fs.statSync(DECISIONS).size / 1024).toFixed(0), 'KB');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e.stack || e); process.exit(1); });
