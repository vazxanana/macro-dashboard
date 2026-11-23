// tests/combo-grid-2-result.test.mjs - RESULT.md of research/edge/combo-grid-2 says what result.json holds (counts, both bases).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/combo-grid-2/result.json', import.meta.url), 'utf8'));
const md = fs.readFileSync(new URL('../research/edge/combo-grid-2/RESULT.md', import.meta.url), 'utf8');
const n = (x) => x.toLocaleString('en-GB');

test('verdict line follows the confirmed counts: before costs leads, after costs beside it', () => {
  const line = md.split('\n')[2];
  assert.match(line, /^\*\*Verdict: /);
  assert.equal(R.gross.confirmed > 0, /PASS before costs/.test(line));
  assert.match(line, new RegExp(`FAIL after costs, ${R.confirmed} confirmed`));
  assert.equal(R.confirmed, 0);
  assert.match(R.verdict, /^PASS before costs/);
});

test('the counts table equals result.json on both bases', () => {
  const row = (label) => md.split('\n').find((l) => l.startsWith('| ' + label));
  assert.ok(row('Cells tested').includes(n(R.tested)));
  assert.equal(row('Positive in 2020-23'), `| Positive in 2020-23 with month t >= 2 | ${n(R.gross.discovery)} | ${n(R.discovery)} |`);
  assert.equal(row('Of those'), `| Of those, also positive with month t >= 2 in 2024-now | ${n(R.gross.rawOOS)} | ${n(R.rawOOS)} |`);
  assert.equal(row('Confirmed after Holm'), `| Confirmed after Holm | **${R.gross.confirmed}** | **${R.confirmed}** |`);
  assert.ok(row('Expected by chance').includes(n(Math.round(R.gross.expectedByChance))) && row('Expected by chance').includes(n(Math.round(R.expectedByChance))));
  assert.ok(row('Placebo').endsWith(`${n(R.placebo.discovery)} / ${R.placebo.rawOOS} / ${R.placebo.confirmed} |`));
  assert.equal(R.placebo.basis, 'after costs only');
});

test('the confirmed rule, the markets and the piece tables are the ones on file', () => {
  assert.equal(R.gross.confirmedList.length, R.gross.confirmed);
  const c = R.gross.confirmedList[0];
  assert.ok(md.includes(`n ${n(c.oosN)}, +${c.oosMean.toFixed(3)}R, month t ${c.oosT}, Holm p ${c.holm}`));
  assert.ok(c.holm < 0.05 && c.oosT >= 2 && c.oosMean > 0);
  assert.equal(Object.keys(R.markets).length, 18);
  for (const m of Object.keys(R.markets)) assert.ok(md.includes(`| ${m} |`), m);
  const s = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  for (const [m, o] of Object.entries(R.pieces.market)) assert.ok(md.includes(`| ${m} | ${s(o.gIs)} / ${s(o.gOos)} | ${s(o.is)} / ${s(o.oos)} |`), m);
  assert.ok(!/\bis an edge\b/i.test(md));
});
