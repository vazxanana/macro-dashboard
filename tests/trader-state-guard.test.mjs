// Bug hunt 9 Nov: a council-data file cut short (a member killed mid-write: the live runner's 240-s child timeout, a cancelled job)
// was read by the Trader as "missing": trades.json came back as [] and the round wrote it out empty (every paper trade, open or
// closed, gone), config.json as the defaults (the owner's rules gone). The Trader now stops on such a file and writes nothing.
// Offline: it stops before its first network call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TRADER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'council', 'trader.mjs');
const run = (dir) => spawnSync(process.execPath, [TRADER, dir], { encoding: 'utf8', timeout: 60000,
  env: { ...process.env, COUNCIL_ALERTS: 'off', MD_BASE: 'http://127.0.0.1:9/md/', NTFY_TOPIC: '', TELEGRAM_BOT_TOKEN: '' } });

for (const [file, cut] of [['trades.json', '[{"id":"xau-scalp-1","market":"xau","status":"op'], ['config.json', '{"focus":["xau"],"litShadow":tr'], ['state.json', '{"seen":{"a":1'], ['research.json', '[{"id":"nq-open-2026-11-06","sta']]) {
  test(`Trader: a ${file} that does not parse is never overwritten (exit non-zero, nothing written)`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trader-guard-'));
    try {
      fs.writeFileSync(path.join(dir, file), cut);
      if (file !== 'trades.json') fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify([{ id: 'kept-1', market: 'xau', side: 'buy', entry: 1, stop: 0.5, t1: 2, status: 'loss', R: -1, opened: 1, closed: 2 }]));
      const before = Object.fromEntries(fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
      const r = run(dir);
      assert.notEqual(r.status, 0, 'the round must not go on');
      assert.match(r.stderr + r.stdout, new RegExp(file.replace('.', '\\.')));
      for (const [f, text] of Object.entries(before)) assert.equal(fs.readFileSync(path.join(dir, f), 'utf8'), text, `${f} untouched`);
      assert.deepEqual(fs.readdirSync(dir).sort(), Object.keys(before).sort(), 'no file written');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
