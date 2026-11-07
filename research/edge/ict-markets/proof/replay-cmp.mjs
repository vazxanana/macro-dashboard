// before/after proof for the replay: old vs new replay.mjs on the same stubbed history and clock; replay.json must be identical
// once the new paper-market fields (shadowByVariant.silver, totalsByVariant.silver, shadowSrc) are removed.
//   node replay-cmp.mjs <oldReplay> <newReplay> <stubDir> <nowISO> <workDir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [OLD, NEW, STUB, NOW, WORK] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = {};
for (const [k, f] of [['old', OLD], ['new', NEW]]) {
  const d = path.join(WORK, 'replay-' + k); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  const log = execFileSync(process.execPath, ['--import', path.join(HERE, 'stub.mjs'), f, d], { env: { ...process.env, NOW, STUB_DIR: STUB }, stdio: 'pipe', maxBuffer: 1 << 26 }).toString();
  console.log(k, log.trim().split('\n').slice(-3).join('\n'));
  out[k] = fs.readFileSync(path.join(d, 'replay.json'), 'utf8');
}
const o = JSON.parse(out.old), n = JSON.parse(out.new), sil = n.shadowByVariant.silver;
delete n.shadowByVariant.silver; delete n.totalsByVariant.silver; delete n.shadowSrc; delete n.paperVariants;
const same = JSON.stringify(o) === JSON.stringify(n);
const c = sil.filter((x) => x.closed), R = c.reduce((a, x) => a + x.R, 0);
console.log(JSON.stringify({ identical: same, bytesOld: out.old.length, liveTrades: o.trades.length, totalsA: o.totalsA, totalsByVariantOld: o.totalsByVariant,
  silver: { n: c.length, wins: c.filter((x) => x.R > 0).length, R: +R.toFixed(2), exp: +(R / c.length).toFixed(3), buys: sil.filter((x) => x.side === 'buy').length, allFlagged: sil.every((x) => x.shadow === true && x.variant === 'silver' && x.market === 'xag' && x.size === 1 && x.be == null) } }));
