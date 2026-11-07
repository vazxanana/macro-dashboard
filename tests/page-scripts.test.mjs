// node --test tests/page-scripts.test.mjs — every inline <script> of the single-file pages must at least parse: one stray bracket
// in market-structure.html blanks the whole dashboard (council, ICT desk, alerts) with no error anywhere but the browser console.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PAGES = ['market-structure.html', 'gold-trading.html', 'edge-lab.html'];
for (const page of PAGES) {
  test(`${page}: inline scripts parse`, () => {
    const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8'), re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    let m, n = 0;
    while ((m = re.exec(html))) {
      const attrs = m[1] || '', code = m[2];
      if (/\bsrc=/.test(attrs) || /type=["']?(module|application\/(ld\+)?json|text\/template)/i.test(attrs) || !code.trim()) continue;
      const line = html.slice(0, m.index).split('\n').length;
      assert.doesNotThrow(() => new vm.Script(code, { filename: `${page}:${line}` }), `script at ${page} line ${line}`);
      n++;
    }
    assert.ok(n > 0, `no inline scripts found in ${page}`);
  });
}
