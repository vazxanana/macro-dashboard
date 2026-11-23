// research/edge/fade-breaks-holdout/report.mjs - the pre-registered bar over the per-market files of run.mjs -> result.json.
//   node research/edge/fade-breaks-holdout/report.mjs <dir>   -> result.json
// The gate first: each grid cell's faded trades on 2010-2019 must equal the grid's own placebo figures (n per half, mean R to
// 4 decimals, month t to 2 decimals); if one does not, the report says so and no holdout figure is judged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from './run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const PRIMARY_SETS = ['A', 'B'];

export function expected() { // the grids' own placebo figures of the picked cells (2010-14 / 2015-19, before costs)
  const p = JSON.parse(fs.readFileSync(path.join(HERE, 'picks.json'), 'utf8'));
  const b = p.box.top[0], d = p.dom.top[0], m = p.mosha.top[0];
  return {
    F1: { h1: { n: b.n1014, meanR: b.mean1014, tMonth: b.t1014 }, h2: { n: b.n1519, meanR: b.mean1519, tMonth: b.t1519 } },
    F2: { h1: { n: d.h2010.n, meanR: d.h2010.before, tMonth: d.h2010.tBefore }, h2: { n: d.h2015.n, meanR: d.h2015.before, tMonth: d.h2015.tBefore } },
    F3: { h1: { n: m.n1014, meanR: m.mean1014, tMonth: m.t1014 }, h2: { n: m.n1519, meanR: m.mean1519, tMonth: m.t1519 } },
  };
}
const same = (a, e) => a.n === e.n && Math.abs(a.meanR - e.meanR) < 5.1e-5 && Math.abs(a.tMonth - e.tMonth) < 0.0051;

export function buildResult(dir) {
  const G = R.load(dir, 'gate'), E = expected(), gate = {};
  for (const rule of ['F1', 'F2', 'F3']) {
    const rows = Object.values(G).flatMap((x) => x.rows[rule].filter((r) => r.pl === 1));
    const h1 = R.statOf(rows, y(2010), y(2015)), h2 = R.statOf(rows, y(2015), y(2020));
    gate[rule] = { got: { h1, h2 }, want: E[rule], ok: same(h1, E[rule].h1) && same(h2, E[rule].h2) };
  }
  { const rows = Object.values(G).flatMap((x) => x.rows.F4.filter((r) => r.pl === 1));
    gate.F4 = { got: { h1: R.statOf(rows, y(2010), y(2015)), h2: R.statOf(rows, y(2015), y(2020)) }, want: null, ok: true, note: 'plain rule, no grid figure to reproduce: its 2010-19 figures for reference' }; }
  const gateOk = ['F1', 'F2', 'F3'].every((r) => gate[r].ok);

  const sets = {}, data = {};
  for (const s of ['A', 'B', 'C']) { data[s] = R.load(dir, s);
    sets[s] = { markets: Object.keys(data[s]), assumedCosts: !!R.SETS[s].assumedCosts,
      window: `${new Date(R.SETS[s].from * 1000).toISOString().slice(0, 10)} to ${new Date(R.SETS[s].to * 1000).toISOString().slice(0, 10)} (fills)`,
      rules: Object.fromEntries(R.RULES.map((r) => [r, { faded: R.setStats(data[s], s, r, 1), real: R.setStats(data[s], s, r, 0) }])) }; }
  const primary = []; for (const r of R.RULES) for (const s of PRIMARY_SETS) primary.push({ rule: r, set: s, stat: sets[s].rules[r].faded.pooled });
  const J = R.judge(primary);
  const C = Object.fromEntries(R.RULES.map((r) => [r, R.ok(sets.C.rules[r].faded.pooled)]));
  const cut = fs.readdirSync(dir).filter((f) => f.endsWith('.cut.json')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).map((c) => ({ file: f.replace('.cut.json', ''), ...c })));
  const cutBad = cut.reduce((a, c) => a + c.missing + c.extra, 0);
  const verdict = gateOk ? J.verdict : 'INCONCLUSIVE';
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  const nn = (x) => x.toLocaleString('en-US');
  const best = R.RULES.map((r) => ({ r, a: sets.A.rules[r].faded.pooled, b: sets.B.rules[r].faded.pooled })).sort((p, q) => Math.min(q.a.tMonth, q.b.tMonth) - Math.min(p.a.tMonth, p.b.tMonth))[0];
  const passTxt = J.passed.length ? `${J.passed.length} of 4 faded rules pass on A and B` : '0 of 4 faded rules pass on both A and B';
  const net = (s) => `${s} ${f(sets[s].rules[best.r].faded.pooled.netR)}R (t ${sets[s].rules[best.r].faded.pooled.tNet.toFixed(2)})`;
  const headline = `${verdict}: ${passTxt} before costs (${best.r}: A ${f(best.a.meanR)}R a trade, n ${nn(best.a.n)}, month t ${best.a.tMonth.toFixed(2)}; B ${f(best.b.meanR)}R, n ${nn(best.b.n)}, t ${best.b.tMonth.toFixed(2)}; C ${C[best.r] ? 'repeated' : 'not repeated'}); after costs ${best.r} loses: ${net('A')}, ${net('B')}, ${net('C')}`;
  return { study: 'fade-breaks-holdout', built: '2026-11-23', verdict, headline, gateOk,
    basis: 'judged before costs (pre-registered), month-sum t, Holm over the 8 primary tests (4 rules x sets A and B); after costs beside; set B costs ASSUMED',
    rules: R.RULE_NAME, cells: R.CELLS, plain: R.GEN, gate, primary: primary.map((x) => ({ rule: x.rule, set: x.set, n: x.stat.n, meanR: x.stat.meanR, tMonth: x.stat.tMonth, pOne: x.stat.pOne, holm: x.holm, pass: x.pass })),
    byRule: Object.fromEntries(R.RULES.map((r) => [r, { ...J.byRule[r], C: C[r] }])), sets,
    cut: { checks: cut.length, mismatches: cutBad, rows: cut } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = buildResult(process.argv[2]);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(out.headline);
}
