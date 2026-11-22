// Desk examples for the Academy (22 Nov 2026, owner: "put 4 trades examples for each one of the edges … into the academy,
// 2 loss 2 wins of each ones and from there i will guide you and write and do drawing on the same chart").
// Reads the stored records of the Mosha and Engulfing desks from a council-data checkout and writes
// academy/desk-examples.json: per reading, two closed winners and two closed losers with their log and chart marks.
// Run BY HAND after a desk rebuild (node council/desk-examples.mjs <council-data dir>), never in the loop: the owner
// writes and draws on these examples, so the set must stay the same while he does. Paper records, PICKED examples:
// they show what a reading did, never how often it wins. Nothing here trades or changes a desk record.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesk } from './desk-store.mjs';
import { writeAtomic } from './jsonio.mjs';

export const PER_SIDE = 2;   // winners and losers a reading

const bare = (id) => String(id).replace(/^[a-z0-9]+:/, '');
// one row per reading: [key, title, test(record, bare id)]. The FIRST match wins, so the special ids come before the plain ones.
export const GROUPS = {
  mosha: [
    ['mosha-nest-vr', 'SOP inside the VR (against the BO)', (r, id) => /^sop-nv-/.test(id)],
    ['mosha-nest-cf', 'SOP inside the CF (with the BO)', (r, id) => /^sop-nc-/.test(id)],
    ['mosha-seq-limit', 'BO, VR, CF: limit at the CF line', (r, id) => /^sop-l-/.test(id)],
    ['mosha-seq-retest', 'VR retest after the chart turned', (r, id) => /^sop-v[rc]-/.test(id)],
    ['mosha-seq-case2', 'BO, VR, CF: CF inside the VR', (r, id) => /^sop-c2-/.test(id)],
    ['mosha-seq-eg', 'BO, VR, CF: entry on the EG', (r, id) => /^sop-/.test(id)],
    ['mosha-bar-3r', 'Barrier entry, 3R target', (r, id) => /^bar-old-/.test(id)],
    ['mosha-bar-tap', 'Barrier: M1 BO at the tap', (r, id) => /^bar-tap-/.test(id)],
    ['mosha-bar-qmfail', 'Barrier: QM failed, traded with the direction', (r, id) => /^bar-sop-f-/.test(id)],
    ['mosha-bar-rsop', 'Barrier: repeat of the SOP', (r, id) => /^bar-sop-/.test(id)],
    ['mosha-bar-1r', 'Barrier entry, 1R target', (r, id) => /^bar-/.test(id)],
  ],
  eg: [
    ['eg-sop3-1d', 'Three-timeframe SOP: Daily, H4, H1 (swing)', (r) => r.kind === 'eg-sop3' && r.h === '1d'],
    ['eg-sop3-4h', 'Three-timeframe SOP: H4, H1, M15 (intraday)', (r) => r.kind === 'eg-sop3' && r.h === '4h'],
    ['eg-sop3-1h', 'Three-timeframe SOP: H1, M15, M5 (scalp)', (r) => r.kind === 'eg-sop3' && r.h === '1h'],
    ['eg-1d', 'Engulf rule on the Daily', (r) => r.kind === 'eg-1d'],
    ['eg-4h', 'Engulf rule on H4', (r) => r.kind === 'eg-4h'],
    ['eg-1h', 'Engulf rule on H1', (r) => r.kind === 'eg-1h'],
    ['eg-plan', 'Plan (engulf within three candles)', (r) => r.kind === 'eg-plan'],
    ['eg-plan-n', 'Plan, next-candle engulf', (r) => r.kind === 'eg-plan-n'],
    ['eg-simple', 'Short method (engulf within three candles)', (r) => r.kind === 'eg-simple'],
    ['eg-simple-n', 'Short method, next-candle engulf', (r) => r.kind === 'eg-simple-n'],
    ['eg-m1', 'M15 EG zone, M1 EF entry', (r) => r.kind === 'eg-m1'],
    ['eg-direct', 'Direct entry', (r) => r.kind === 'eg-direct'],
  ],
};

export function groupOf(desk, r) {
  const id = bare(r.id);
  for (const [k, , test] of GROUPS[desk] || []) if (test(r, id)) return k;
  return null;
}

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
// a closed record with a stop on the losing side of its entry and a result; anything else is never an example
export function usable(r) {
  if (!r || r.status === 'open' || !fin(r.R) || !fin(r.entry) || !fin(r.stop) || !fin(r.t) || !fin(r.endT)) return false;
  if (r.side !== 1 && r.side !== -1) return false;
  if (r.settled || r.void) return false;
  return r.side === 1 ? r.stop < r.entry : r.stop > r.entry;
}

// the n most recent of rows, one market and one UTC day at a time where the record allows it
export function pick(rows, n = PER_SIDE) {
  const sorted = rows.slice().sort((a, b) => b.t - a.t || (a.id < b.id ? -1 : 1));
  const out = [], day = (r) => Math.floor(r.t / 86400);
  const take = (ok) => { for (const r of sorted) { if (out.length >= n) return; if (!out.includes(r) && ok(r)) out.push(r); } };
  take((r) => (r.marks || []).length && !out.some((x) => x.market === r.market) && !out.some((x) => day(x) === day(r)));
  take((r) => (r.marks || []).length && !out.some((x) => day(x) === day(r)));
  take((r) => (r.marks || []).length);
  take(() => true);
  return out;
}

const KEEP = ['id', 'market', 'side', 'label', 'kind', 'h', 'l', 'll', 'style', 't', 'entry', 'stop', 'target', 'status', 'R', 'endT', 'exit', 'mfe'];
export function exampleOf(r, market) {
  const o = {};
  for (const k of KEEP) if (r[k] !== undefined && r[k] !== null) o[k] = r[k];
  if (!o.market) o.market = market || 'xau';
  o.outcome = r.R > 0 ? 'win' : 'loss';
  o.log = (r.log || []).slice(0, 40).map((x) => ({ t: x.t, text: String(x.text || '').slice(0, 400) }));
  o.marks = (r.marks || []).slice(0, 8);
  return o;
}

// desks = { mosha: <desk file with logs joined>, eg: … }
export function build(desks, now = Date.now()) {
  const groups = [];
  for (const desk of Object.keys(GROUPS)) {
    const d = desks[desk]; if (!d || !Array.isArray(d.records)) continue;
    const by = {};
    for (const r of d.records) { if (!usable(r)) continue; const k = groupOf(desk, r); if (k) (by[k] || (by[k] = [])).push(r); }
    for (const [k, title] of GROUPS[desk]) {
      const rows = by[k] || [];
      const wins = pick(rows.filter((r) => r.R > 0)), losses = pick(rows.filter((r) => r.R < 0));
      const ex = losses.concat(wins).map((r) => exampleOf(r, d.market));
      if (ex.length) groups.push({ k, desk, title, closed: rows.length, examples: ex });
    }
  }
  return { v: 1, at: new Date(now).toISOString(),
    note: 'Picked examples of paper records, two that lost and two that won a reading: they show what a reading did, never how often it wins. Before costs.',
    groups };
}

export function main(dir) {
  const desks = { mosha: readDesk(dir, 'mosha'), eg: readDesk(dir, 'eg') };
  const out = build(desks);
  writeAtomic(path.join(dir, 'academy', 'desk-examples.json'), JSON.stringify(out));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node council/desk-examples.mjs <council-data dir>'); process.exit(2); }
  const out = main(dir);
  for (const g of out.groups) console.log(g.k.padEnd(18), g.examples.map((e) => e.outcome[0] + ' ' + e.market + ' ' + new Date(e.t * 1000).toISOString().slice(0, 10)).join(' | '));
  console.log(`${out.groups.length} readings, ${out.groups.reduce((s, g) => s + g.examples.length, 0)} examples`);
}
