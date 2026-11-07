// Edge research (ict-concepts): merge the window and long-history runs of run.mjs into result.json (summaries only, no
// trades) and print the markdown tables used in RESULT.md.
// Usage: node research/edge/ict-concepts/report.mjs <window.json> <long.json> [result.json]
import fs from 'node:fs';

const [W, L] = [process.argv[2], process.argv[3]].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const OUT = process.argv[4] || new URL('./result.json', import.meta.url).pathname;
const ORDER = ['A', 'eqts-raw', 'eqts-ict', 'eqts-floor', 'eqts-ict+floor', 'lbh-raw', 'lbh-ict', 'lbh-floor', 'lbh-ict+floor', 'gap-nwog', 'gap-nwog-floor', 'gap-ndog', 'gap-ndog-floor'];
// NDOG robustness: the window result without its 5 biggest trades (stub-candle stops)
const nd = W.trades.filter((t) => t.stream === 'gap-ndog').map((t) => t.R).sort((a, b) => a - b);
const res = { generated: W.at, window: { range: W.window, mid: W.mid, src: W.src, summary: W.summary }, long: { range: L.window, mid: L.mid, src: L.src, summary: L.summary }, cost: W.cost,
  ndogWithoutTop5: { n: nd.length - 5, R: +nd.slice(0, -5).reduce((a, x) => a + x, 0).toFixed(1), median: nd[nd.length >> 1] },
  passes: Object.entries(W.summary).filter(([k, s]) => k !== 'A' && s.pass).map(([k]) => k) };
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));

const sg = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
const cell = (s) => (s && s.n ? `${s.n} / ${sg(s.exp)} / ${sg(s.R, 1)}` : '0');
for (const [name, X, mk] of [['window', W, ['nq', 'es', 'ym', 'gc']], ['long', L, ['nq', 'es', 'gc']]]) {
  console.log(`\n### ${name} ${X.window.join(' -> ')} (halves split ${X.mid})\n`);
  console.log(`| stream | n | win% | R/trade | total R | max DD | t | 1st half n / R/tr / R | 2nd half n / R/tr / R | ${mk.map((k) => k.toUpperCase()).join(' | ')} | bar |`);
  console.log(`|---|---|---|---|---|---|---|---|---|${mk.map(() => '---').join('|')}|---|`);
  for (const k of ORDER) { const s = X.summary[k]; if (!s) continue; const a = s.all;
    console.log(`| ${k} | ${a.n} | ${(a.wr * 100).toFixed(0)}% | ${sg(a.exp)} | ${sg(a.R, 1)} | ${a.maxDD.toFixed(1)} | ${a.t.toFixed(2)} | ${cell(s.h1)} | ${cell(s.h2)} | ${mk.map((m) => cell(s.byMarket[m])).join(' | ')} | ${k === 'A' ? '(baseline)' : s.pass ? '**pass**' : 'fail'} |`); }
}
console.log('\nNDOG window without its 5 biggest trades:', JSON.stringify(res.ndogWithoutTop5), '\npasses:', res.passes);
