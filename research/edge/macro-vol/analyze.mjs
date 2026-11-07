// Macro strategist volatility study (paper only): which simple model forecasts tomorrow's absolute open-to-close move
// better than the naive 20-day mean? Walk-forward with no look-ahead, scored on MAE and QLIKE, on all days and on CPI / NFP /
// FOMC days (council/events.mjs). The models and the selection protocol live in council/macro.mjs (volEngine, volSelect),
// so this study and every live run apply the same rule. This script only runs them and writes the tables.
//
// Protocol: each asset's walk-forward rows are split at the middle date. First half (selection): among the candidates that
// beat naive on MAE and QLIKE, on all days and on event days, the one with the largest loss gap is picked. Second half
// (confirmation): it is used only if it beats naive again. Otherwise naive is kept. Every model tried is reported, the
// losers too.
//
// Usage: node research/edge/macro-vol/analyze.mjs [barsDir] [macroCache.json]
//   barsDir: d_<sym>.json files saved from meridianx.dev/md/bars?tf=1d&n=1400 (fetched when missing)
//   macroCache.json: the council-data macro/cache.json, for VIX (FRED VIXCLS) when FRED itself is not reachable
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS, AK, MD_BASE, VOL_TRIED, VOL_NAMES, VIX_ASSETS, volEngine, volSelect, volKeys, beatsNaive, parseFredCsv, fredView } from '../../../council/macro.mjs';

const OUT = path.dirname(new URL(import.meta.url).pathname);
const [barsDir, cacheFile] = process.argv.slice(2);

async function bars(sym) {
  const f = barsDir && path.join(barsDir, `d_${sym}.json`);
  if (f && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).bars;
  const r = await fetch(`${MD_BASE}bars?sym=${sym}&tf=1d&n=1400`, { signal: AbortSignal.timeout(30000) });
  return (await r.json()).bars;
}
async function vix() {
  try { const r = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS&cosd=2021-01-01', { signal: AbortSignal.timeout(20000) });
    const o = parseFredCsv(await r.text()); if (o.length > 500) return { obs: o, src: `FRED VIXCLS (${o.length} days)` }; } catch (e) { /* fall through */ }
  if (cacheFile && fs.existsSync(cacheFile)) { const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8')).fred.VIXCLS || [];
    return { obs: c.map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v })), src: `council-data macro/cache.json, ${c.length} days from ${c.length ? c[0][0] : '—'} (FRED was not reachable)` }; }
  return { obs: [], src: 'none' };
}

const V = await vix(), fred = { VIXCLS: V.obs }, vixAt = (t) => { const v = fredView(fred, 'VIXCLS', t).last; return v ? v.v : null; };
const res = {};
for (const k of AK) res[k] = volSelect(volEngine(await bars(ASSETS[k].sym), { vixAt: VIX_ASSETS.includes(k) ? vixAt : null }).rows, k);

const L = ['# Macro strategist: move-size models vs the naive 20-day mean', '',
  `Walk-forward, no look-ahead: each forecast uses only the daily candles before its day (OANDA via meridianx.dev). Event days are CPI / NFP / FOMC days from council/events.mjs. VIX: ${V.src}.`,
  `Models tried: ${VOL_TRIED.length} (${VOL_TRIED.map((m) => `${m} = ${VOL_NAMES[m]}`).join('; ')}). The VIX model is only for ES and NQ. Reference rows: naive (the baseline) and cur (the model before this change).`,
  'MAE is in % of price (lower is better). QLIKE = ln h + r²/h with h = (π/2)·forecast² (lower is better). DM is the Diebold-Mariano t of the loss gap vs naive (positive = better than naive; |t| ≥ 2 is significant).', '',
  '| Market | Picked on the first half | Used | Why |', '|---|---|---|---|',
  ...AK.map((k) => `| ${ASSETS[k].label} | ${res[k].picked || '—'} | ${res[k].used} | ${res[k].reason} |`), ''];
const cell = (x, key) => (x ? `${x[key]} / ${x[key + 'Naive']}` : '—');
for (const [title, part] of [['Full walk-forward window', 'full'], ['Selection half', 'selection'], ['Confirmation half', 'confirmation']]) {
  L.push(`## ${title}`, '');
  for (const k of AK) {
    const c = res[k][part]; if (!c) continue;
    L.push(`### ${ASSETS[k].label} (${c.from} to ${c.to}; ${c.n} days, ${c.eventDays} event days; average move ${c.eventAvgAbs}% on event days vs ${c.otherAvgAbs}% on other days)`, '',
      '| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |', '|---|---|---|---|---|---|---|---|');
    for (const m of ['cur', ...volKeys(k)]) { const x = c.models[m]; if (!x || !x.all) { L.push(`| ${m} | no forecasts in this window | | | | | | |`); continue; }
      L.push(`| ${m}${x.all.n < c.n ? ` (n ${x.all.n})` : ''} | ${cell(x.all, 'mae')} | ${cell(x.all, 'qlike')} | ${x.all.dmMae} / ${x.all.dmQlike} | ${cell(x.event, 'mae')} | ${cell(x.event, 'qlike')} | ${x.event ? `${x.event.dmMae} / ${x.event.dmQlike}` : '—'} | ${m !== 'cur' && beatsNaive(x) ? 'yes' : 'no'} |`); }
    L.push('');
  }
}
fs.writeFileSync(path.join(OUT, 'tables.md'), L.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ topic: 'macro-vol', paperOnly: true, tried: VOL_TRIED, vix: V.src, assets: res }, null, 1) + '\n');
console.log(L.slice(6, 8 + AK.length).join('\n'));
