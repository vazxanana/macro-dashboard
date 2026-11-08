// node --test tests/macro-page.test.mjs — the standalone Macro desk page (macro-desk.html, 8 Nov 2026) is built, routed, linked
// from the council pane and reads the files the two macro members write.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');

test('macro page: reads the members\' files, has every section, and the inline script parses', () => {
  for (const f of ['macro/forecast.json', 'macro/veteran.json', 'macro/cache.json', 'macro/veteran-ledger.json']) assert.ok(html.includes(`get('${f}')`), f);
  for (const id of ['strip', 'strat', 'vet', 'debate', 'insights', 'cot', 'gauges', 'news', 'events', 'src', 'ledger']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /<title>Macro desk · Meridian X<\/title>/); assert.match(html, /There is no insider information here/);
  const s = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')); new Function(s);
  assert.match(html, /@media \(max-width: 600px\)/); assert.match(html, /prefers-reduced-motion/);
});

test('macro page: built, routed at /macro-desk, in the deploy-skip list, linked from the council Macro pane', () => {
  assert.match(fs.readFileSync(new URL('../scripts/build.sh', import.meta.url), 'utf8'), /macro-desk\.html out\//);
  assert.match(fs.readFileSync(new URL('../scripts/vercel-ignore.sh', import.meta.url), 'utf8'), /macro-desk\.html/);
  const vj = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vj.rewrites.some((r) => r.source === '/macro-desk' && r.destination === '/macro-desk.html'));
  const ms = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(ms, /<a class="md-full" href="macro-desk\.html"/);
});
