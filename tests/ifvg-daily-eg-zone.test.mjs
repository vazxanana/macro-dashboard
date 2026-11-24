// tests/ifvg-daily-eg-zone.test.mjs - the H1 inversion-gap reversal inside a Daily engulf zone: pre-registration, the signal
// and its class on seeded candles (no look-ahead, stop on the losing side), RESULT.md agrees with result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { setups, trade, classAt, dailyZones, mstat, headline, f3, CLASSES, TARGETS, EF_DAYS } from '../research/edge/ifvg-daily-eg-zone/run.mjs';

const DIR = new URL('../research/edge/ifvg-daily-eg-zone/', import.meta.url);
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

function seeded(n, seed = 11) { // 5-minute candles of a random walk around 100, weekdays only
  const r = K.rng(seed), out = []; let p = 100, t = Date.UTC(2021, 0, 4) / 1000;
  while (out.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 6 && wd !== 0) { const o = p, c = o + (r() - 0.5) * 0.3, h = Math.max(o, c) + r() * 0.08, l = Math.min(o, c) - r() * 0.08; out.push({ t, o, h, l, c, e: t + 300 }); p = c; }
    t += 300;
  }
  return out;
}
const M5 = seeded(60000);
const S = setups(M5, 'xau');

test('pre-registration fixes the cells, the windows and the bar', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', '9 tested cells', 'n >= 300', 'stop counts', 'BEFORE any run'])
    assert.ok(pre.includes(w), w);
  assert.equal(CLASSES.length * TARGETS.length, 9);
});

test('seeded candles give signals of every class with the stop on the losing side', () => {
  assert.ok(S.length > 50, 'signals ' + S.length);
  assert.ok(S.some((s) => s.cls.in) && S.some((s) => s.cls.out));
  for (const s of S) {
    assert.ok(s.side * (s.sigEntry - s.stop) > 0, 'stop side');
    assert.equal(s.cls.in, s.cls.eg || s.cls.ef); assert.equal(s.cls.out, !s.cls.in);
    for (const r of trade(s, M5, 0.3)) {
      if (r.status === 'bad' || r.status === 'nofill') continue;
      assert.ok(s.side * (r.fill - s.stop) > 0, 'fill on the right side of the stop');
      assert.ok(r.fillT >= s.t, 'fill after the H1 close');
      if (r.reason === 'stop') assert.ok(r.R <= -1 + 1e-9);
      if (r.Rnet != null) assert.ok(r.Rnet < r.R);
    }
  }
});

test('no look-ahead: a signal and its class are the same when every later candle is cut off or changed', () => {
  const picks = S.filter((_, i) => i % 7 === 3).slice(0, 12);
  for (const s of picks) {
    const cut = M5.filter((b) => b.e <= s.t);
    const again = setups(cut, 'xau').find((x) => x.t === s.t && x.side === s.side);
    assert.ok(again, 'signal still there at its own close');
    assert.deepEqual({ stop: again.stop, x: again.x, cls: again.cls }, { stop: s.stop, x: s.x, cls: s.cls });
    const bent = M5.map((b) => (b.e <= s.t ? b : { ...b, o: b.o + 7, h: b.h + 9, l: b.l + 5, c: b.c + 8 }));
    const third = setups(bent, 'xau').find((x) => x.t === s.t && x.side === s.side);
    assert.ok(third); assert.deepEqual(third.cls, s.cls); assert.equal(third.stop, s.stop);
  }
});

test('the class reads a zone only once it is known, and a failed zone turns for 60 days', () => {
  const day = (i, o, h, l, c) => ({ t: i * 86400, o, h, l, c, e: (i + 1) * 86400 });
  // day 1 red (base 10..12), day 2 green closes above 12: a buy zone 10..12 known at the close of day 2
  const D = [day(0, 11, 11.5, 10.5, 11.2), day(1, 11.8, 12, 10, 10.4), day(2, 10.4, 13, 10.3, 12.8), day(3, 12.8, 13.5, 12.5, 13.2),
    day(4, 13.2, 13.3, 9, 9.5), day(5, 9.5, 9.8, 9, 9.4)];   // day 4 closes under 10: the zone failed
  const dz = dailyZones(D);
  assert.ok(dz.Z.some((z) => z.dir === 1 && z.bot === 10 && z.top === 12));
  assert.equal(classAt(dz, 1, 11, 3 * 86400 - 1).eg, false, 'not known before the completing close');
  assert.equal(classAt(dz, 1, 11, 3 * 86400).eg, true);
  assert.equal(classAt(dz, 1, 12.5, 3 * 86400).eg, false, 'outside the box');
  assert.equal(classAt(dz, 1, 11, 5 * 86400).eg, false, 'failed');
  assert.equal(classAt(dz, -1, 11, 5 * 86400 - 1).ef, false);
  assert.equal(classAt(dz, -1, 11, 5 * 86400).ef, true, 'a failed buy zone is a sell zone');
  assert.equal(classAt(dz, -1, 11, 5 * 86400 + (EF_DAYS + 1) * 86400).ef, false, 'for 60 days');
});

test('month statistics count empty months', () => {
  const t = Date.UTC(2020, 0, 15) / 1000, m0 = 2020 * 12;
  const s = mstat([{ t, R: 1, Rnet: 0.9 }, { t: t + 40 * 86400, R: -1, Rnet: -1.1 }], m0, m0 + 3);
  assert.equal(s.months, 4); assert.equal(s.n, 2); assert.ok(Math.abs(s.net + 0.1) < 1e-12);
});

test('RESULT.md agrees with result.json and the verdict follows the bar', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  assert.equal(md[2], headline(R));
  assert.match(md[2], /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. /);
  assert.equal(R.tested.length, 9);
  const pass = R.tested.filter((n) => { const c = R.cells[n]; return c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.tMonth >= 2 && c.conf.tMonth >= 2 && c.holm < 0.05; });
  assert.deepEqual(pass, R.passed);
  assert.equal(R.verdict, pass.length ? 'PASS' : R.tested.some((n) => R.cells[n].disc.n >= 300 && R.cells[n].conf.n >= 300) ? 'FAIL' : 'INCONCLUSIVE');
  const b = R.cells[R.best];
  assert.ok(md[2].includes(f3(b.conf.net) + 'R') && md[2].includes(b.conf.tMonth.toFixed(2)));
  const row = md.find((l) => l.startsWith('| ' + R.best + ' |'));
  assert.ok(row.includes(f3(b.conf.gross)) && row.includes(f3(b.conf.net)) && row.includes(String(b.conf.n)));
  for (const n of Object.keys(R.cells)) for (const w of ['disc', 'conf']) if (R.cells[n][w].n) assert.ok(R.cells[n][w].net < R.cells[n][w].gross, 'costs lower R');
});
