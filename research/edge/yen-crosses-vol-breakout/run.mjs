// Edge research · yen-crosses-vol-breakout: gold's T1 breakout on the five yen crosses, 2005 → now (PREREGISTRATION.md, pushed
// alone first). Paper research only.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/yen-crosses-vol-breakout/run.mjs fetch <dir>
//   node research/edge/yen-crosses-vol-breakout/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, summary, normP, holm } from '../index-vol-breakout/original.mjs';
import { ORIG_SHA, SEEDS } from '../fx-vol-breakout/run.mjs';
import { trades, placeboTrades } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['eurjpy', 'gbpjpy', 'audjpy', 'cadjpy', 'chfjpy'];
export const W = { ALL: ['2005-01-01', '2099-12-31'], A: ['2005-01-01', '2015-12-31'], B: ['2016-01-01', '2099-12-31'] };
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

export function judge(tr, pl) {
  const s = (w) => summary(tr.filter((t) => inW(t.day, w))), all = s(W.ALL), a = s(W.A), b = s(W.B), beaten = pl.filter((v) => all.netR > v).length;
  const checks = { bothWindows: a.netR > 0 && b.netR > 0, t2: all.t >= 2, cost2x: all.net2R > 0, placebo: beaten >= 38 };
  return { all, a, b, beaten, p: r3(normP(all.t)), checks, pass: Object.values(checks).every(Boolean) };
}
export function report(R) {
  const L = ['# Gold\'s T1 breakout on the five yen crosses, 2005 → now (20 Nov 2026)', '',
    'Paper research only. Markets, rule, cost, windows and pass bar fixed in `PREREGISTRATION.md` before any candle was fetched. Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    '| Series | n | Net R/trade | Gross R/trade | Net 2x cost | 2005-15 net | 2016→ net | Month t | Holm p | Placebos | All checks |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, r] of Object.entries(R.series)) L.push(`| ${k} | ${r.all.n} | ${sg(r.all.netR)} | ${sg(r.all.grossR)} | ${sg(r.all.net2R)} | ${sg(r.a.netR)} | ${sg(r.b.netR)} | ${sg(r.all.t, 2)} | ${r.holm == null ? '—' : r.holm.toFixed(3)} | ${r.beaten} of 40 | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', `Reading, as pre-registered: ${R.series.pool.pass ? 'the effect is the yen\'s; T1 stays a candidate on the yen pairs, for a forward record only.' : 'the pool fails, so the effect is not the yen\'s in general: USD/JPY\'s result stands alone (one market of eleven tested), which weakens that lead without ending it; its forward record is the judge.'}`, '',
    `Cost: 0.000045 of the entry + 0.005 a round trip (the crosses\' real spreads are wider; 2x shown). Data: OANDA mid M5, ${R.data.map((d) => `${d.k} ${d.first} → ${d.last}`).join('; ')}.`, '');
  return L.join('\n');
}

async function fetchM5(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', SEC = 300, FROM = Date.parse('2004-12-01T00:00:00Z') / 1000, END = Math.floor(Date.now() / 1000 / SEC) * SEC;
  fs.mkdirSync(dir, { recursive: true });
  for (const k of MARKETS) {
    const out = path.join(dir, `${k}-5m.json.gz`); if (fs.existsSync(out)) continue;
    const m = new Map();
    for (let a = FROM; a < END;) {
      const b = Math.min(END, a + 4999 * SEC); let j = null, err = null;
      for (let t = 0; t < 6 && !j; t++) {
        try { const r = await fetch(`${base}bars?sym=${k}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
        catch (e) { err = String(e.message || e); }
        if (!j) await new Promise((s) => setTimeout(s, 2000 * (t + 1)));
      }
      if (!j) throw new Error(`${k} ${new Date(a * 1000).toISOString()}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await new Promise((s) => setTimeout(s, 100));
    }
    fs.writeFileSync(out, zlib.gzipSync(JSON.stringify([...m.values()].sort((p, q) => p[0] - q[0])))); console.log(`${k}: ${m.size} candles`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('index-vol-breakout/original.mjs is not the pinned copy');
  if (cmd === 'fetch') await fetchM5(dir);
  else if (cmd === 'run') {
    const series = {}, all = [], plAll = Array.from({ length: SEEDS }, () => []), data = [];
    for (const k of MARKETS) {
      const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m.json.gz`)))); rows.sort((a, b) => a[0] - b[0]);
      const last = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
      const days = buildDays(rows).filter((d) => d.day < last && d.day >= W.ALL[0]), tr = trades(k, days), pl = [];
      for (let s = 1; s <= SEEDS; s++) { const p = placeboTrades(k, days, s); pl.push(mean(p.map((x) => x.net))); plAll[s - 1].push(...p); }
      series[k] = judge(tr, pl); all.push(...tr);
      data.push({ k, first: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), last, candles: rows.length });
    }
    all.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const pool = judge(all, plAll.map((p) => mean(p.map((x) => x.net)))), adj = holm(MARKETS.map((k) => series[k].p));
    MARKETS.forEach((k, i) => { series[k].holm = r3(adj[i]); });
    pool.holm = null;
    const verdict = `${pool.pass ? 'PASS' : 'FAIL'}: T1 on five yen crosses pooled 2005 → now ${sg(pool.all.netR)}R a trade net (n ${pool.all.n}, month t ${sg(pool.all.t, 2)}; 2005-15 ${sg(pool.a.netR)}R, 2016→ ${sg(pool.b.netR)}R; ${pool.beaten} of 40 placebos)` +
      (pool.pass ? '' : `; fails: ${Object.entries(pool.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    const R = { study: 'yen-crosses-vol-breakout', title: 'Gold T1 breakout on the yen crosses', built: '2026-11-20', verdict, data,
      series: { pool, ...series } };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(verdict);
  } else console.log('usage: run.mjs fetch|run <dir>');
}
