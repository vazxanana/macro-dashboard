// Edge lab: a forward-record row shows the latest council-data reading to a signed-in member (display only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../edge-lab.html', import.meta.url), 'utf8');
const wf = fs.readFileSync(new URL('../.github/workflows/vb-forward.yml', import.meta.url), 'utf8');

test('the page reads research/forward/<study>.json only after /api/me names a member', () => {
  const block = page.slice(page.indexOf('function forwardLive()'), page.indexOf('function summary('));
  assert.match(block, /window\.MX_ME/);
  assert.match(block, /if \(!who\) return;/);
  assert.match(block, /'\/cdata\/research\/forward\/' \+ f \+ '\.json'/);
  assert.match(block, /esc\(j\.verdict\)/, 'the verdict is escaped');
  assert.doesNotMatch(block, /localStorage|sessionStorage/);
  assert.match(page, /forwardLive\(\);\n {4}deepLink\(\);\n {2}\}/, 'render still ends with the deep link');
});

test('every forward-record study is refreshed by the workflow under the file name the page asks for', () => {
  const dirs = fs.readdirSync(new URL('../research/edge/', import.meta.url)).filter((d) => d.endsWith('-forward'));
  assert.ok(dirs.length >= 3);
  for (const d of dirs) {
    const f = d.replace(/-forward$/, '');
    assert.ok(wf.includes(`research/edge/${d}/run.mjs`), `${d} runs in vb-forward.yml`);
    assert.ok(wf.includes(`data/research/forward/${f}.json`) || (d === 'gold-vol-breakout-forward' && wf.includes('research/forward/gold-vol-breakout.json')), `${d} writes ${f}.json`);
  }
});
