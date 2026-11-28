// Edge lab: the "Forward records" card shows the seven live paper forward records side by side (display only, offline test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../edge-lab.html', import.meta.url), 'utf8');
const RECORDS = ['gold-vol-breakout', 'usdjpy-vol-breakout', 'turnaround-tuesday', 'gold-pre-holiday', 'vb-early', 'gotobi', 'eurjpy-egr'];
const card = page.slice(page.indexOf('function forwardCard('), page.indexOf('function summary('));

test('the card lists the seven forward records, each linking to its study row', () => {
  const sec = page.slice(page.indexOf('<section class="fwc'), page.indexOf('</section>', page.indexOf('<section class="fwc')));
  assert.match(sec, /<h2 id="fwc-h">Forward records<\/h2>/);
  for (const r of RECORDS) {
    assert.ok(fs.existsSync(new URL(`../research/edge/${r}-forward/`, import.meta.url)), `${r}-forward is a study`);
    assert.ok(sec.includes(`data-fwc="${r}-forward"><a href="#${r}-forward">`), `${r} has a cell and a row link`);
  }
  assert.equal((sec.match(/data-fwc=/g) || []).length, 7);
  assert.ok(page.indexOf('id="fwc"') < page.indexOf('id="flt"'), 'the card sits above the studies');
  assert.doesNotMatch(sec.replace(/not an edge/g, ''), /\bedge\b/i, 'no record is called an edge');
});

test('the card reads through the same cached request as the rows, only for a signed-in member', () => {
  assert.equal((page.match(/'\/cdata\/research\/forward\/'/g) || []).length, 1, 'one fetch path');
  assert.match(page, /function fwdGet\(t, f\)/);
  assert.match(card, /fwdGet\(t, f\)/);
  assert.match(card, /if \(!who\) \{ out\(\); return; \}/);
  assert.match(card, /Sign in on the desk to see this record\./);
  assert.match(card, /could not be read/);
  assert.match(page, /forwardCard\(me\);/, 'forwardLive fills the card too');
});

test('every value goes in as text, with the reading exactly as the file states it', () => {
  assert.doesNotMatch(card, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.match(card, /dd\.textContent = r\[1\]/);
  assert.match(card, /\['Reading', typeof j\.reading === 'string' && j\.reading \? j\.reading/);
  assert.match(card, /j\.early && j\.late/, 'the split record (vb-early) counts both sides');
  assert.match(card, /'Early − late, a trade'/);
  assert.match(card, /j\.start/); assert.match(card, /j\.after/); assert.match(card, /j\.total/); assert.match(card, /j\.n\b/);
  assert.doesNotMatch(card, /localStorage|sessionStorage/);
});

test('the card styles use page tokens, no colour literals and nothing under 12 px', () => {
  const css = page.slice(page.indexOf('/* forward records card'), page.indexOf('/* study groups */'));
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px var\(--sans\)|font-size: (\d+(?:\.\d+)?)px/g)) {
    const v = Number(m[1] || m[2]);
    assert.ok(v >= 12, `font ${v}px`);
  }
  assert.match(css, /min-height: var\(--tap\)/);
  assert.match(css, /@media \(max-width: 520px\)[^\n]*grid-template-columns: minmax\(0, 1fr\)/);
});
