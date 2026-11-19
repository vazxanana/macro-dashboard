// How to use the charts (19 Nov 2026): the guide on the Desk's Charts. Display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const SRC = fs.readFileSync('assets/ms-charts-guide.js', 'utf8'), PAGE = fs.readFileSync('market-structure.html', 'utf8');

test('the guide is loaded on the Desk, hidden for guests, and changes nothing', () => {
  assert.match(PAGE, /<script src="\/assets\/ms-charts-guide\.js" defer><\/script>/);
  assert.match(SRC, /html\[data-role="public"\] \.ch-help \{ display: none; \}/);
  assert.doesNotMatch(SRC, /fetch\(|XMLHttpRequest|sendBeacon|\.stop\s*=|msPaperDraftAt\(/);
  const keys = [...SRC.matchAll(/store\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ['ms-ch-guide']);
});

test('every "Show me" points at a part of the page that exists, and every text is 12 px or more', () => {
  const sels = [...SRC.matchAll(/show: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(sels.length >= 8);
  for (const s of sels) {
    const id = s.match(/#([\w-]+)/)[1];
    assert.ok(PAGE.includes(`id="${id}"`) || SRC.includes(`'${id}'`), s);
    for (const c of s.replace(/#[\w-]+/g, '').match(/\.[\w-]+/g) || []) assert.ok(PAGE.includes(c.slice(1)), c);
  }
  for (const m of SRC.matchAll(/(\d+(?:\.\d+)?)px\/?[\d.]*\s+var\(--(?:sans|mono)/g)) assert.ok(+m[1] >= 12, m[0]);
  for (const m of SRC.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(+m[1] >= 12, m[0]);
});
