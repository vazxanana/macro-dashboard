// Fred's connector checks the syntax of a proposed ICT module. On Node it runs `node --check`; on Cloudflare Workers (no child
// process, 16 Nov 2026) it parses the module instead (acorn, bundled with the Worker). Offline; acorn is injected here because
// CI installs no packages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { syntaxCheck } = require('../api/mcp.js').lib;

test('on Node a proposed module is checked by node --check, and a syntax error is reported from it', () => {
  assert.equal(syntaxCheck('ict/x.mjs', 'export const a = 1;\n'), 'node --check ok');
  assert.throws(() => syntaxCheck('ict/x.mjs', 'export const = ;\n'), /syntax error in ict\/x\.mjs/);
  assert.equal(syntaxCheck('ict/x.json', '{"a":1}'), 'JSON ok');
  assert.throws(() => syntaxCheck('ict/x.json', '{a:1}'), /not valid JSON/);
  assert.equal(syntaxCheck('ict/x.md', 'anything'), null);
});

test('without a child process the module is parsed instead, and a parse error still refuses the change', () => {
  const seen = [];
  const ok = (s) => { seen.push(s); };
  assert.equal(syntaxCheck('ict/x.mjs', 'export const a = 1;\n', { noChild: true, parser: ok }), 'syntax parsed ok (acorn)');
  assert.deepEqual(seen, ['export const a = 1;\n']);
  const bad = () => { throw new SyntaxError('Unexpected token (1:13)'); };
  assert.throws(() => syntaxCheck('ict/x.mjs', 'export const = ;', { noChild: true, parser: bad }), /syntax error in ict\/x\.mjs:\nUnexpected token \(1:13\)/);
});

test('the Worker bundles the parser and allows its own address on the connector', () => {
  const w = fs.readFileSync(new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(w, /"acorn": "\.\/node_modules\/acorn"/);
  assert.equal(JSON.parse(fs.readFileSync(new URL('../cloudflare/package.json', import.meta.url), 'utf8')).dependencies.acorn, '8.15.0');
  const { originOk } = require('../api/mcp.js').lib;
  assert.equal(originOk('https://meridianx.meridianx-cloudflare.workers.dev', {}), true);
  assert.equal(originOk('https://meridianx.dev', {}), true);
  assert.equal(originOk('https://other.meridianx-cloudflare.workers.dev', {}), false);
  assert.equal(originOk('https://evil.example', {}), false);
});
