import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Review of 23 Nov 2026: these studies' gold buys pay no overnight financing; each report must say so (CLAUDE.md "Financing").
for (const d of ['box-touch-trend', 'storyline-qm-sop', 'trendline-qm', 'eg-chain-50']) {
  test(`${d}: the report states that gold-buy financing is not charged, with its measured size`, () => {
    const md = fs.readFileSync(new URL(`../research/edge/${d}/RESULT.md`, import.meta.url), 'utf8');
    assert.match(md, /## Financing not charged \(23 Nov 2026, review\)/);
    assert.match(md, /\d\.\d{3}R a( gold)? buy/);
  });
}
