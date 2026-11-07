// Edge research · setups-promote: walk-forward analysis of the replay trades (replay.mjs output).
//   node analyze.mjs <outDir> <resultDir>
// In-sample 2018-07 .. 2023-12 (rules are chosen here only), out-of-sample 2024-01 .. 2026-10 (untouched).
// Every trade: closed, filled, net R = R (stop/first target, no break-even: the live config has be = null) minus one spread in R.
// The live global rule reward:risk >= 1.2 (config.minRR) applies to every row.
import fs from 'node:fs';
import path from 'node:path';

const [OUT, RES] = process.argv.slice(2);
const SPLIT = Date.UTC(2024, 0, 1) / 1000;
const rows = [];
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, f)));
  for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); o.market = j.key; rows.push(o); }
}
const T = rows.filter((x) => x.status === 'closed' && x.R != null && x.rr >= 1.2).map((x) => ({ ...x, net: x.R - x.cost, gross: x.R, year: new Date(x.opened * 1000).getUTCFullYear() }));
T.sort((a, b) => a.opened - b.opened);

function stats(a, f = 'net') {
  const n = a.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  let s = 0, s2 = 0, w = 0, eq = 0, pk = 0, dd = 0, ls = 0, cur = 0;
  for (const x of a) { const r = x[f]; s += r; s2 += r * r; if (r > 0) w++; eq += r; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); if (r < 0) { cur++; ls = Math.max(ls, cur); } else cur = 0; }
  const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m));
  return { n, wr: +(w / n).toFixed(3), exp: +m.toFixed(3), R: +s.toFixed(1), maxDD: +dd.toFixed(1), streak: ls, t: sd > 0 ? +(m / sd * Math.sqrt(n)).toFixed(2) : null };
}
const IS = (a) => a.filter((x) => x.opened < SPLIT), OOS = (a) => a.filter((x) => x.opened >= SPLIT);
const years = (a) => Object.fromEntries([...new Set(a.map((x) => x.year))].sort().map((y) => [y, stats(a.filter((x) => x.year === y))]));
const block = (a) => ({ is: stats(IS(a)), oos: stats(OOS(a)), isGross: stats(IS(a), 'gross'), oosGross: stats(OOS(a), 'gross'), years: years(a) });

// current config.filters (council-data config.json, 7 Nov 2026)
const CUR = {
  rscalp: (x) => x.session !== 'newyork' && x.rr >= 3,
  intraday: (x) => x.d1 === 'against' && x.rr <= 10 && x.session !== 'asia',
  rintra: (x) => x.session !== 'late' && x.market !== 'usdchf',
  swing: (x) => x.d1 === 'against',
  position: () => false,                          // off
  m30m1: (x) => x.d1 === 'with',
  scalp: (x) => x.d1 === 'against' && x.session !== 'asia' && x.session !== 'overlap' && x.market !== 'audusd',
  rswing: () => true,
};
// the owner's research-150d rule set (config.history 3 Nov 2026), per setup (the dollar cap is portfolio-wide: not testable per setup)
const R150 = {
  position: { rule: 'Position off', f: () => false },
  swing: { rule: 'Swing only against D1', f: (x) => x.d1 === 'against' },
  intraday: { rule: 'Intraday reward:risk <= 10', f: (x) => x.rr <= 10 },
  scalp: { rule: 'Scalp skips AUD/USD', f: (x) => x.market !== 'audusd' },
  rscalp: { rule: 'Retrace M15->M1 only at reward:risk >= 3', f: (x) => x.rr >= 3 },
  rintra: { rule: 'Retrace H1->M5 skips USD/CHF', f: (x) => x.market !== 'usdchf' },
};
// single conditions searched in-sample
const MK = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'], SES = ['asia', 'london', 'overlap', 'newyork', 'late'];
const CONDS = [];
for (const [c, vals] of [['d1', ['with', 'against']], ['h4', ['with', 'against']], ['align', ['with', 'against']], ['struct', ['main', 'internal']], ['cf', ['choch', 'bo']], ['choch', ['yes', 'no']], ['m15c', ['yes', 'no']], ['side', ['buy', 'sell']]])
  for (const v of vals) CONDS.push([`${c} = ${v}`, (x) => x[c] === v]);
for (const s of SES) { CONDS.push([`session = ${s}`, (x) => x.session === s]); CONDS.push([`skip session ${s}`, (x) => x.session !== s]); }
for (const m of MK) { CONDS.push([`market = ${m}`, (x) => x.market === m]); CONDS.push([`skip ${m}`, (x) => x.market !== m]); }
for (const v of [1.5, 2, 2.5, 3, 4]) CONDS.push([`rr >= ${v}`, (x) => x.rr >= v]);
for (const v of [2, 3, 5, 10]) CONDS.push([`rr <= ${v}`, (x) => x.rr <= v]);
CONDS.push(['market fill only', (x) => x.mkt === 1], ['limit fill only', (x) => x.mkt === 0]);

const SLOW = new Set(['swing', 'position', 'rswing']);
const SETUPS = ['rscalp', 'intraday', 'rintra', 'swing', 'position', 'm30m1', 'rswing', 'scalp'];
const result = { topic: 'setups-promote', system: 'MERIDIAN council engine setups (council/engine.mjs), HistData M1 2018-07..2026-10, 6 markets', split: 'IS 2018-07..2023-12 | OOS 2024-01..2026-10', setups: {}, candidates: [], variantsTried: 0 };
function verdict(k, cand, base) {
  const o = cand.oos, minN = SLOW.has(k) ? 50 : 100, posY = Object.entries(cand.years).filter(([y]) => +y >= 2024);
  const yp = posY.filter(([, s]) => s.R > 0).length;
  const ok = o.n >= minN && o.exp > 0 && o.exp > base.oos.exp && yp >= Math.ceil(posY.length * 2 / 3);
  return { pass: ok, why: `OOS n ${o.n} (min ${minN}), exp ${o.exp} vs baseline ${base.oos.exp}, positive OOS years ${yp}/${posY.length}` };
}
for (const k of SETUPS) {
  let all = T.filter((x) => x.k === k);
  if (!all.length) continue;
  const res = { n: all.length, raw: block(all), current: block(all.filter(CUR[k])) };
  if (k === 'm30m1') {
    res.note = 'gold only; trader.mjs drops an m30m1 signal that duplicates a Scalp entry (same side, minute, entry): those rows are removed here';
    res.dupScalp = all.filter((x) => x.dupScalp).length;
    all = all.filter((x) => !x.dupScalp);
    res.raw = block(all); res.current = block(all.filter(CUR[k]));
    res.d1with = block(all.filter((x) => x.d1 === 'with')); res.d1against = block(all.filter((x) => x.d1 === 'against'));
    res.d1withInclDup = block(T.filter((x) => x.k === k && x.d1 === 'with')); res.d1againstInclDup = block(T.filter((x) => x.k === k && x.d1 === 'against'));
  }
  res.byMarket = Object.fromEntries([...new Set(all.map((x) => x.market))].map((m) => { const a = all.filter((x) => x.market === m); return [m, { is: stats(IS(a)), oos: stats(OOS(a)) }]; }));
  if (R150[k]) { const r = R150[k]; res.research150 = { rule: r.rule, kept: block(all.filter(r.f)), dropped: block(all.filter((x) => !r.f(x))) }; }
  // in-sample choice: the single condition with the best IS t-stat among those keeping >= 20% of IS trades and >= 100 (50 slow) IS trades
  const isAll = IS(all), minIS = Math.max(SLOW.has(k) ? 50 : 100, Math.round(0.2 * isAll.length));
  const scored = CONDS.map(([name, f]) => { const s = stats(isAll.filter(f)); return { name, f, s }; }).filter((c) => c.s.n >= minIS && c.s.t != null);
  result.variantsTried += CONDS.length;
  scored.sort((a, b) => b.s.t - a.s.t);
  res.isRanking = scored.slice(0, 8).map((c) => ({ rule: c.name, is: c.s, oos: stats(OOS(all).filter(c.f)) }));
  const best = scored[0];
  if (best) {
    const cand = block(all.filter(best.f)), v = verdict(k, cand, res.raw), vc = verdict(k, cand, res.current);
    res.best = { rule: best.name, ...cand, verdictVsRaw: v, verdictVsCurrent: vc };
    result.candidates.push({ setup: k, rule: `${k}: ${best.name}`, is: cand.is, oos: cand.oos, years: Object.fromEntries(Object.entries(cand.years).map(([y, s]) => [y, s.R])),
      verdict: v.pass && vc.pass ? 'PASS' : 'FAIL', why: v.why + `; current-config OOS exp ${res.current.oos.exp}` });
  }
  result.setups[k] = res;
}
result.baseline = Object.fromEntries(Object.entries(result.setups).map(([k, v]) => [k, { raw: { is: v.raw.is, oos: v.raw.oos }, current: { is: v.current.is, oos: v.current.oos } }]));
fs.mkdirSync(RES, { recursive: true });
result.notes = 'baseline = current config.filters per setup (council-data config.json 7 Nov 2026) on top of the global reward:risk >= 1.2; raw = no setup filter. Stats are net of one spread per round trip (forex 1 pip, gold 0.30); stop or first target, no break-even (live be = null). Each setup is judged alone: no MAX_OPEN, duplicate, dollar-cap or re-entry rules. Candidate = the single condition with the best in-sample t among those keeping >= 20% of in-sample trades; verdict per PREAMBLE (OOS n >= 100, >= 50 for swing/position/rswing; OOS exp > 0; beats raw and current OOS; positive in >= 2/3 of OOS years).';
const slim = JSON.parse(JSON.stringify(result)); for (const v of Object.values(slim.setups)) for (const b of Object.values(v)) if (b && typeof b === 'object') { delete b.isGross; }
fs.writeFileSync(path.join(RES, 'result.json'), JSON.stringify(slim, null, 1));
const fmt = (s) => s.n ? `n${s.n} wr${s.wr} exp${s.exp >= 0 ? '+' : ''}${s.exp} R${s.R} DD${s.maxDD} t${s.t}` : 'n0';
for (const [k, v] of Object.entries(result.setups)) {
  console.log(`\n== ${k} (${v.n} trades)`);
  console.log(`  raw      IS ${fmt(v.raw.is)} | OOS ${fmt(v.raw.oos)}   gross OOS ${v.raw.oosGross.exp}`);
  console.log(`  current  IS ${fmt(v.current.is)} | OOS ${fmt(v.current.oos)}`);
  if (v.research150) console.log(`  150d "${v.research150.rule}" kept IS ${fmt(v.research150.kept.is)} | OOS ${fmt(v.research150.kept.oos)}\n      dropped IS ${fmt(v.research150.dropped.is)} | OOS ${fmt(v.research150.dropped.oos)}`);
  if (v.d1with) console.log(`  D1 with    IS ${fmt(v.d1with.is)} | OOS ${fmt(v.d1with.oos)}\n  D1 against IS ${fmt(v.d1against.is)} | OOS ${fmt(v.d1against.oos)}  (dupScalp removed: ${v.dupScalp})`);
  if (v.d1with) { for (const [nm, b] of [["with", v.d1with], ["against", v.d1against], ["with incl. Scalp duplicates", v.d1withInclDup], ["against incl. Scalp duplicates", v.d1againstInclDup]]) console.log(`  D1 ${nm} by year: ` + Object.entries(b.years).map(([y, s]) => `${y} ${s.R}(${s.n})`).join("  ") + `   IS ${fmt(b.is)} | OOS ${fmt(b.oos)}`); }
  console.log("  by market raw: " + Object.entries(v.byMarket).map(([m, s]) => `${m} IS ${s.is.exp}(${s.is.n}) OOS ${s.oos.exp}(${s.oos.n})`).join(" | "));
  if (v.best) console.log(`  best IS "${v.best.rule}" IS ${fmt(v.best.is)} | OOS ${fmt(v.best.oos)} -> ${v.best.verdictVsRaw.pass && v.best.verdictVsCurrent.pass ? 'PASS' : 'FAIL'} (${v.best.verdictVsRaw.why})`);
  console.log('  years raw: ' + Object.entries(v.raw.years).map(([y, s]) => `${y} ${s.R}(${s.n})`).join('  '));
  console.log('  years cur: ' + Object.entries(v.current.years).map(([y, s]) => `${y} ${s.R}(${s.n})`).join('  '));
  for (const c of v.isRanking.slice(0, 5)) console.log(`    ${c.rule.padEnd(22)} IS ${fmt(c.is)} | OOS ${fmt(c.oos)}`);
}
console.log('\nvariants tried', result.variantsTried);
