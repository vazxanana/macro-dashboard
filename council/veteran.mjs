// Council · Macro veteran (8 Nov 2026, owner: "add this as macro veteran so he will discuss with the macro of the council").
//
// A code port of the owner's gptmacro_v.1 research skill (research/macro-veteran/: SKILL.md, the gold driver map, the
// cross-asset regime framework, the probability-calibration playbook and the forecast-ledger schema). The veteran reads
// what the Macro strategist already fetched (macro/forecast.json, macro/cache.json, the council's daily candles) and never
// fetches anything itself, so a run costs nothing and is deterministic. It does four things the strategist does not:
//   1. Shock fingerprint (framework §2): names the candidate shock behind the week's cross-asset moves, the strongest
//      competing explanation and the gold implication to test, from matched 1-week changes, not levels.
//   2. Gold driver panel (driver map): one row per causal channel with the observation, its as-of date, a freshness flag,
//      a lean for gold and what the observation cannot establish.
//   3. The discussion: topic by topic, what the strategist says (its drivers, score, regime) and what the veteran says,
//      with a stance (agree / qualify / disagree) and why; a consensus verdict with named invalidation levels; the
//      hypothesis card (framework §7). The strategist's tested Gold Macro Score keeps the direction; the veteran can
//      lower conviction, never flip it, and a gold SELL is never a macro call (as in the strategist).
//   4. A forecast ledger (calibration playbook): one binary forecast a week that can fail clearly ("gold's daily close 20
//      trading days on is above today's close"), with the probability, its base rate, the strategist's score as the named
//      comparator, then the resolution and Brier scores. Append-only; records are never edited.
// Paper only: writes macro/veteran.json, macro/veteran-ledger.json and its own block in analysis/latest.md; changes no
// rule, trade or mirror setting.
// Usage: node council/veteran.mjs [dataDir]   (dataDir = the council-data checkout, default "data")
import fs from 'node:fs';
import path from 'node:path';
import { injectSection } from './analyst.mjs';
import { dailyRows, dxyDaily, isoDay } from './macroscore.mjs';
import { outlook } from './outlook.mjs';

const DAY = 86400;
// the batch revision this port follows (research/macro-veteran/SKILL.md); 1.2 = the owner's 8 Nov evening upload
export const SKILL_VERSION = '1.2';
// the batch's own real forecast: October 2026 core CPI m/m, issued 8 Nov 2026 14:12 UTC, resolved by the BLS first print of 10 Nov.
// Read from the repository copy of the ledger when it is there (the Vercel bundle has no research/; then null).
export function cpiPilot(file = new URL('../research/macro-veteran/references/cpi-pilot-forecast-ledger.jsonl', import.meta.url)) {
  try {
    const recs = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    const iss = recs.find((r) => r.record_type === 'issued'); if (!iss) return null;
    const res = recs.find((r) => (r.record_type === 'resolved' || r.record_type === 'resolution') && r.forecast_id === iss.forecast_id), f = iss.forecast || {};
    return { forecastId: iss.forecast_id, issuedAt: f.issued_at_utc, point: f.distribution && f.distribution.point_estimate, unit: 'percent m/m', reference: 'October 2026', releaseUtc: '2026-11-10T13:30:00Z', status: res ? 'resolved' : 'unresolved', outcome: res ? (res.resolution && res.resolution.outcome) ?? null : null };
  } catch (e) { return null; }
}
export const VET_START = '<!-- veteran:start -->', VET_END = '<!-- veteran:end -->';
export const HORIZON_DAYS = 20;   // trading days: the 4-week horizon the Gold Macro Score was tested on
export const P_BOUNDS = [0.4, 0.7];   // a weekly directional call never leaves this band (calibration humility)
const r2 = (v, d = 2) => (v == null || !Number.isFinite(+v) ? null : +(+v).toFixed(d));
// the Saturday that starts a ledger week (Sat..Fri: the Gold Macro Score closes on Friday)
export const weekKey = (t) => { const d = Math.floor(t / DAY) * DAY, wd = new Date(d * 1000).getUTCDay(); return isoDay(d - ((wd + 1) % 7) * DAY); };
const sg = (v, d = 2, unit = '') => (v == null ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}${unit}`);

// ---- series helpers --------------------------------------------------------------------------------------------------
// macro/cache.json keeps FRED as [[date, value]] (daily, last 300 obs); the council's daily candles as { rows }.
export const fromCache = (arr) => (Array.isArray(arr) ? arr.map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v: +v })).filter((o) => Number.isFinite(o.t) && Number.isFinite(o.v)) : []);
// value now and the change over n observations back, with the as-of date and a freshness flag (older than maxAge days: stale)
export function window(series, now, { n1 = 5, n4 = 20, maxAge = 6 } = {}) {
  const s = (series || []).filter((o) => o.t <= now && Number.isFinite(o.v));
  if (!s.length) return null;
  const last = s[s.length - 1], b1 = s[s.length - 1 - n1], b4 = s[s.length - 1 - n4];
  return { v: last.v, asOf: isoDay(last.t), stale: now - last.t > maxAge * DAY, chg1: b1 ? +(last.v - b1.v).toFixed(4) : null, chg4: b4 ? +(last.v - b4.v).toFixed(4) : null,
    pct1: b1 && b1.v ? +((last.v / b1.v - 1) * 100).toFixed(2) : null, pct4: b4 && b4.v ? +((last.v / b4.v - 1) * 100).toFixed(2) : null };
}
// n-observation-ahead up rate and return quantiles of a daily close series: the reference class for the ledger
export function baseRates(closes, { horizon = HORIZON_DAYS, years = 10, now = Infinity } = {}) {
  const s = (closes || []).filter((o) => o.t <= now && o.t >= now - years * 365 * DAY);
  const rets = []; for (let i = 0; i + horizon < s.length; i++) rets.push(s[i + horizon].v / s[i].v - 1);
  if (rets.length < 100) return null;
  const up = rets.filter((r) => r > 0).length / rets.length, q = rets.slice().sort((a, b) => a - b), qt = (p) => q[Math.min(q.length - 1, Math.floor(p * q.length))];
  return { n: rets.length, upRate: +up.toFixed(3), median: +(qt(0.5) * 100).toFixed(2), q10: +(qt(0.1) * 100).toFixed(2), q90: +(qt(0.9) * 100).toFixed(2), from: isoDay(s[0].t), to: isoDay(s[s.length - 1].t), horizon };
}

// ---- 1. shock fingerprint (cross-asset regime framework §2) ------------------------------------------------------------
// Inputs are matched 1-week changes: d2 (policy path, bp), ry (10y real, bp), be (10y breakeven, bp), curve (10y−3m, bp),
// dxy (%), hy (HY OAS, bp), vix (level and 1-week change), funding (SOFR−EFFR bp, VIX term ratio). Directions are the
// framework's diagnostic tendencies, so the output always names the strongest competing explanation.
export function fingerprint(c) {
  const has = (k) => c[k] != null;
  const out = (shock, clues, goldTest, competing, confidence) => ({ shock, clues, goldTest, competing, confidence });
  const stress = (has('hy') && c.hy >= 15) || (has('vix') && c.vix >= 28) || (has('vixTs') && c.vixTs > 1);
  if (has('sofrBps') && c.sofrBps >= 15) {
    return out('Dollar funding / liquidity shock', [`SOFR−EFFR ${c.sofrBps} bp`, `VIX/VIX3M ${c.vixTs ?? 'n/a'}`, `HY ${sg(c.hy, 0, ' bp')} on the week`, `DXY ${sg(c.dxy, 2, '%')}`],
      'Gold may fall first on margin calls and cash demand even if haven demand supports it later; watch funding quantities and persistence, not one print.',
      'Ordinary risk aversion without funding scarcity, or a quarter-end / settlement technical.', 'medium');
  }
  if (has('vixTs') && c.vixTs > 1 && has('hy') && c.hy >= 10) {
    return out('Risk-off / de-risking, funding still calm', [`VIX/VIX3M ${c.vixTs}`, `HY ${sg(c.hy, 0, ' bp')} on the week`, `SOFR−EFFR ${c.sofrBps ?? 'n/a'} bp`, `DXY ${sg(c.dxy, 2, '%')}`],
      'Gold whipsaws: sold with risk assets first, then the haven bid if funding stays calm. The test is whether funding spreads widen; while they do not, this is risk aversion, not a liquidity squeeze.',
      'A dollar funding squeeze building underneath (SOFR−EFFR and the FX swap basis would widen next), or forced de-grossing of crowded positions.', 'medium');
  }
  if (has('d2') && c.d2 >= 8 && has('ry') && c.ry >= 4 && (!has('curve') || c.curve <= 0)) {
    return out('Hawkish policy shock', [`2Y ${sg(c.d2, 0, ' bp')}`, `10Y real ${sg(c.ry, 0, ' bp')}`, `curve ${sg(c.curve, 0, ' bp')}`, `DXY ${sg(c.dxy, 2, '%')}`],
      'Higher real yields and a firmer dollar pressure gold, all else equal; the response is offset if the move carries a stronger-economy message.',
      'A central-bank information shock (a stronger outlook revealed alongside the path): yields up with equities up points there, not to pure tightening.', 'medium');
  }
  if (has('d2') && c.d2 <= -8 && has('ry') && c.ry <= -4) {
    return out(stress ? 'Dovish repricing driven by growth fear' : 'Dovish policy shock', [`2Y ${sg(c.d2, 0, ' bp')}`, `10Y real ${sg(c.ry, 0, ' bp')}`, `HY ${sg(c.hy, 0, ' bp')}`, `VIX ${c.vix ?? 'n/a'}`],
      stress ? 'Lower real yields support gold, but a panic easing can coincide with liquidation and cash demand first.' : 'Lower real yields and a softer dollar support gold; the test is whether the dollar follows.',
      stress ? 'Benign disinflation rather than growth fear: check employment, orders and earnings revisions.' : 'A dovish repricing caused by deteriorating growth rather than benign disinflation.', 'medium');
  }
  if (has('be') && c.be >= 5 && has('ry') && Math.abs(c.ry) < 4) {
    return out('Inflation surprise / inflation-risk shock', [`10Y breakeven ${sg(c.be, 0, ' bp')}`, `10Y real ${sg(c.ry, 0, ' bp')}`, `2Y ${sg(c.d2, 0, ' bp')}`],
      'Not mechanically bullish for gold: it falls if real yields and the dollar reprice higher, rises if inflation-risk demand dominates. Which path won shows up in real yields, not in the headline.',
      'An energy / supply shock rather than broad demand or wage persistence: inspect the release composition.', 'low');
  }
  if (has('d10') && has('d2') && c.d10 >= 8 && c.d10 - c.d2 >= 6) {
    return out('Sovereign duration / term-premium shock', [`10Y ${sg(c.d10, 0, ' bp')}`, `2Y ${sg(c.d2, 0, ' bp')}`, `curve ${sg(c.curve, 0, ' bp')}`, `DXY ${sg(c.dxy, 2, '%')}`],
      'Gold may gain as a currency / debt hedge, or fall if real yields and the dollar rise with the long end. It is not a pure fiscal-stress hedge.',
      'Stronger expected growth or a higher future policy path: compare surveys, policy pricing and term-premium estimates.', 'low');
  }
  if (has('ry') && c.ry <= -4 && has('hy') && c.hy >= 8 && has('vix') && c.vixChg != null && c.vixChg > 0) {
    return out('Negative growth / demand shock', [`10Y real ${sg(c.ry, 0, ' bp')}`, `HY ${sg(c.hy, 0, ' bp')}`, `VIX ${sg(c.vixChg, 1)} on the week`],
      'Lower real yields and defensive demand favour gold unless the squeeze turns into a dash for cash.', 'Disinflation lowering yields while risk premia widen for another reason.', 'medium');
  }
  if (has('ry') && c.ry >= 4 && has('hy') && c.hy <= -5 && has('vixChg') && c.vixChg < 0) {
    return out('Positive growth / demand news', [`10Y real ${sg(c.ry, 0, ' bp')}`, `HY ${sg(c.hy, 0, ' bp')}`, `VIX ${sg(c.vixChg, 1)} on the week`],
      'Gold weakens if higher real yields dominate, holds if currency or portfolio demand offsets.', 'Inflation pressure or central-bank information can raise yields too; rising stocks with yields do not prove a growth shock.', 'low');
  }
  return out('Mixed / no dominant shock', [`2Y ${sg(c.d2, 0, ' bp')}`, `10Y real ${sg(c.ry, 0, ' bp')}`, `breakeven ${sg(c.be, 0, ' bp')}`, `DXY ${sg(c.dxy, 2, '%')}`, `HY ${sg(c.hy, 0, ' bp')}`, `VIX ${c.vix ?? 'n/a'}`],
    'No single channel dominates the week: treat gold moves as range / noisy repricing until price, real yields, the dollar and flows line up for several sessions.',
    'Several small shocks offsetting each other, or the week\'s moves are inside normal noise.', 'low');
}

// ---- 2. gold driver panel (gold driver map: channel, observation, as-of, freshness, lean, what it cannot establish) ------
export function channels(S, now) {
  const W = (k, o) => window(S[k], now, o), ry = W('DFII10'), be = W('T10YIE'), d2 = W('DGS2'), d10 = W('DGS10'), cv = W('T10Y3M'), hy = W('BAMLH0A0HYM2'), vix = W('VIXCLS'), vx3 = W('VXVCLS');
  const dxy = W('dxy'), broad = W('DTWEXBGS'), gold = W('gold'), sofr = W('SOFR'), effr = W('EFFR');
  const bp = (x) => (x == null ? null : Math.round(x * 100));
  const row = (k, name, obs, lean, asOf, stale, cannot) => ({ k, name, obs, lean, asOf: asOf || null, stale: !!stale, cannot });
  const list = [];
  list.push(row('real', 'Real-rate opportunity cost', ry ? `10Y TIPS ${ry.v.toFixed(2)}%, ${sg(bp(ry.chg1), 0, ' bp')} on the week, ${sg(bp(ry.chg4), 0, ' bp')} over 4 weeks` : 'no observation',
    ry && ry.chg4 != null ? (ry.chg4 <= -0.1 ? 1 : ry.chg4 >= 0.1 ? -1 : 0) : null, ry && ry.asOf, ry && ry.stale,
    'The level alone does not forecast daily returns; the regime-dependent sensitivity is read from changes, and a nominal yield move is not a real-yield move.'));
  list.push(row('infl', 'Inflation expectations', be ? `10Y breakeven ${be.v.toFixed(2)}%, ${sg(bp(be.chg1), 0, ' bp')} on the week` : 'no observation',
    be && be.chg1 != null ? (Math.abs(be.chg1) < 0.03 ? 0 : be.chg1 > 0 && ry && ry.chg1 != null && ry.chg1 <= 0 ? 1 : be.chg1 > 0 ? 0 : -1) : null, be && be.asOf, be && be.stale,
    'Breakevens carry inflation-risk and TIPS-liquidity premia; a hot print is not mechanically bullish for gold if real yields and the dollar reprice higher.'));
  list.push(row('usd', 'US dollar', dxy ? `DXY ${dxy.v.toFixed(2)}, ${sg(dxy.pct1, 2, '%')} on the week, ${sg(dxy.pct4, 2, '%')} over 4 weeks${broad && broad.pct4 != null ? ` · broad USD ${sg(broad.pct4, 2, '%')} over 4 weeks` : ''}` : 'no observation',
    dxy && dxy.pct4 != null ? (dxy.pct4 <= -1 ? 1 : dxy.pct4 >= 1 ? -1 : 0) : null, dxy && dxy.asOf, dxy && dxy.stale,
    'USD and gold can rise together under stress or fall together when cash is wanted; gold in EUR, JPY, INR and CNY terms is not checked here, so the USD quote may hide a different local story.'));
  list.push(row('policy', 'Central-bank path', d2 ? `2Y ${d2.v.toFixed(2)}%, ${sg(bp(d2.chg1), 0, ' bp')} on the week, ${sg(bp(d2.chg4), 0, ' bp')} over 4 weeks${cv ? ` · 10Y−3M ${cv.v.toFixed(2)}%` : ''}` : 'no observation',
    d2 && d2.chg4 != null ? (d2.chg4 <= -0.15 ? 1 : d2.chg4 >= 0.15 ? -1 : 0) : null, d2 && d2.asOf, d2 && d2.stale,
    'The 2Y mixes expected policy and term premium; a cut that was priced is not a dovish surprise, and the reaction to a decision is the signal, not the decision.'));
  const vts = vix && vx3 && vx3.v > 0 && vix.asOf === vx3.asOf ? +(vix.v / vx3.v).toFixed(3) : null, fund = sofr && effr && sofr.asOf === effr.asOf ? Math.round((sofr.v - effr.v) * 100) : null;
  list.push(row('risk', 'Risk, safe haven and liquidity', vix || hy ? `${vix ? `VIX ${vix.v.toFixed(1)}${vts != null ? ` (VIX/VIX3M ${vts.toFixed(2)})` : ''}` : ''}${hy ? ` · HY OAS ${hy.v.toFixed(2)}%, ${sg(bp(hy.chg1), 0, ' bp')} on the week` : ''}${fund != null ? ` · SOFR−EFFR ${fund} bp` : ''}` : 'no observation',
    vix ? (vts != null && vts > 1 ? 0 : vix.v >= 22 ? 1 : 0) : null, (vix && vix.asOf) || (hy && hy.asOf), (vix && vix.stale) || (hy && hy.stale),
    'Safe-haven behaviour is conditional: in a liquidity squeeze gold is sold for cash first (BIS WP 1380: the effect depends on financial conditions). An inverted VIX curve is stress, not a direction.'));
  const cot = S.cot;
  list.push(row('pos', 'Investment flows and positioning', cot ? `COT managed money ${Math.round(cot.net / 1000)}k net, ${sg(cot.chg4w / 1000, 0, 'k')} over 4 weeks, ${cot.pct}th percentile (positions as of ${cot.asOf})` : 'no observation',
    cot ? 0 : null, cot && cot.asOf, cot && now - Date.parse(cot.asOf + 'T00:00:00Z') / 1000 > 12 * DAY,
    'COT is a Tuesday snapshot of reportable futures, published Friday: crowding and fragility context, not direction. ETF tonnage and options dealer positioning are not observed by the council.'));
  list.push(row('official', 'Official reserves and physical demand', 'not observed by the council (WGC monthly reserves run two months in arrears; quarterly demand is partly estimated)', null, null, false,
    'Reported reserve values rise with the price; value growth is not purchases. Exchange stocks, London vaults and ETF metal are different inventories and must not be added.'));
  list.push(row('price', 'Price confirmation', gold ? `gold ${gold.v.toFixed(2)}, ${sg(gold.pct1, 2, '%')} on the week, ${sg(gold.pct4, 2, '%')} over 4 weeks${S.avg10w ? ` · ${gold.v > S.avg10w ? 'above' : 'below'} the 10-week average ${S.avg10w.toFixed(0)}` : ''}` : 'no observation',
    gold && S.avg10w ? (gold.v > S.avg10w ? 1 : -1) : null, gold && gold.asOf, gold && gold.stale,
    'A trend state is a tiebreaker (score > +0.25 and above the 10-week average won 70% vs 68%), never the direction; plain trend had no 4-week edge in the 2007-26 test.'));
  const have = list.filter((r) => r.lean != null), tally = have.reduce((a, r) => a + r.lean, 0);
  return { list, tally, have: have.length, lean: have.length < 3 ? null : tally >= 2 ? 1 : tally <= -2 ? -1 : 0,
    changes: { d2: d2 && bp(d2.chg1), ry: ry && bp(ry.chg1), be: be && bp(be.chg1), d10: d10 && bp(d10.chg1), curve: cv && bp(cv.chg1), dxy: dxy && dxy.pct1, hy: hy && bp(hy.chg1), vix: vix && r2(vix.v, 1), vixChg: vix && r2(vix.chg1, 1), vixTs: vts, sofrBps: fund } };
}

// ---- 3. the discussion with the Macro strategist ----------------------------------------------------------------------
const stanceOf = (m, v) => (m == null || v == null ? 'qualify' : m === v ? 'agree' : m === 0 || v === 0 ? 'qualify' : 'disagree');
const leanWord = (v) => (v == null ? 'no reading' : v > 0 ? 'supportive for gold' : v < 0 ? 'against gold' : 'neutral');
export function debate(fc, ch, fp, { now, base } = {}) {
  const topics = [], gs = fc && fc.goldScore, dr = (k) => ((fc && fc.drivers) || []).find((d) => d.k === k), gold = fc && fc.assets && fc.assets.gold;
  const C = Object.fromEntries(ch.list.map((r) => [r.k, r]));
  const push = (topic, macro, veteran, stance, why, m = null, v = null) => topics.push({ topic, macro, veteran, stance, why, m: m == null ? null : Math.sign(m), v: v == null ? null : Math.sign(v) });
  // direction
  const mDir = gs && gs.ok ? (gs.bias === 'BUY' ? 1 : 0) : gold && gold.pUp != null ? (gold.pUp - (gold.fit ? gold.fit.base : 0.5) > 0.03 ? 1 : gold.pUp - (gold.fit ? gold.fit.base : 0.5) < -0.03 ? -1 : 0) : null;
  const vDir = ch.lean;
  push('Direction for gold', gs && gs.ok ? `Gold Macro Score ${sg(gs.score)} → ${gs.label}${gold && gold.pUp != null ? `; next-day P(up) ${Math.round(gold.pUp * 100)}%` : ''}` : gold && gold.pUp != null ? `next-day P(up) ${Math.round(gold.pUp * 100)}% (base ${Math.round((gold.fit ? gold.fit.base : 0.5) * 100)}%)` : 'no reading',
    `${ch.have} of ${ch.list.length} channels observed; tally ${sg(ch.tally, 0)} → ${leanWord(vDir)}`, stanceOf(mDir, vDir),
    gs && gs.ok ? 'The score is the only directional engine that passed a 20-year test (IC +0.15, > +0.25 up 69%); the channel tally is a narrative check that can lower conviction, not flip the call. A negative tally is not a sell.' : 'Without the tested score the veteran treats direction as an auction unless the channels agree strongly.', mDir, vDir);
  // real yields: level vs change
  const mry = dr('ry'), ryz = gs && gs.ok && gs.z ? gs.z.ry4w : null, cr = C.real;
  push('Real yields', mry ? `${mry.detail} (vote ${mry.vote > 0 ? 'up' : mry.vote < 0 ? 'down' : 'flat'})${ryz != null ? `; score z (4-week fall) ${sg(ryz)}` : ''}` : 'no reading', cr.obs + (cr.stale ? ' (stale)' : ''),
    mry && mry.vote != null && cr.lean != null ? (mry.vote === cr.lean ? 'agree' : mry.vote === 0 || cr.lean === 0 ? 'qualify' : 'disagree') : 'qualify',
    mry && cr.lean != null && mry.vote < 0 && cr.lean >= 0 ? 'The strategist reads the level (a high TIPS yield is bearish); the driver map says short-horizon direction comes from changes, and the 4-week change is not rising. Both are true: a high level caps the upside, a falling change sets the near-term lean.'
      : 'Both read the same TIPS series; the question is level versus change, and the Chicago Fed daily model explains little of daily variation either way.', mry && mry.vote, cr.lean);
  // dollar
  const mdx = dr('dxymom'), dz = gs && gs.ok && gs.z ? gs.z.dxy4w : null, cu = C.usd;
  push('US dollar', mdx ? `${mdx.detail} (vote ${mdx.vote > 0 ? 'up' : mdx.vote < 0 ? 'down' : 'flat'})${dz != null ? `; score z (4-week fall) ${sg(dz)}` : ''}` : 'no reading', cu.obs,
    mdx && mdx.vote != null && cu.lean != null ? stanceOf(mdx.vote, cu.lean) : 'qualify',
    'A 5-day momentum vote and a 4-week change can disagree without either being wrong; the veteran weights the 4-week window the score was tested on and notes that local-currency gold is not checked.', mdx && mdx.vote, cu.lean);
  // inflation and the next event
  const mbe = dr('be'), ci = C.infl, ev = (fc && fc.playbook || []).find((e) => now == null || Date.parse(e.at) / 1000 >= now);
  const evIn72 = ev && now != null && Date.parse(ev.at) / 1000 - now <= 72 * 3600;
  push('Inflation and the next release', mbe ? `${mbe.detail} (vote ${mbe.vote > 0 ? 'up' : mbe.vote < 0 ? 'down' : 'flat'})${ev ? `; playbook: ${ev.title} ${ev.at.slice(0, 16).replace('T', ' ')} UTC` : ''}` : 'no reading',
    `${ci.obs}. ${evIn72 ? `A red-folder event lands within 72 hours (${ev.title}): the view is conditional and the plan is to read real yields and the dollar after the print, not before.` : 'No red-folder event within 72 hours.'}`,
    mbe && mbe.vote != null && ci.lean != null ? stanceOf(mbe.vote, ci.lean) : 'qualify',
    'A hot print has two opposing paths (inflation-protection demand versus a stronger policy response lifting real yields and the dollar); the observed move shows which won, not which wins next.', mbe && mbe.vote, ci.lean);
  // positioning
  const mct = dr('cot'), cp = C.pos;
  push('Positioning', mct ? `${mct.detail} (vote ${mct.vote > 0 ? 'up' : mct.vote < 0 ? 'down' : 'flat'})` : 'no reading', cp.obs + (cp.stale ? ' (lagged more than 12 days)' : ''), mct && mct.vote ? 'qualify' : 'agree',
    'COT is crowding and fragility context on a Tuesday snapshot of reportable futures; the 2007-26 test found no 4-week edge in positioning, so it sizes and times, it never directs.');
  // regime
  const rg = fc && fc.regime;
  push('Regime', rg ? rg.label : 'no reading', `${fp.shock} (${fp.confidence} confidence) · clues: ${fp.clues.join(', ')}`,
    rg && /stress|draining|inverted/i.test(rg.label) === /funding|liquidity|growth fear|Negative growth/i.test(fp.shock) ? 'agree' : 'qualify',
    `Strongest competing explanation: ${fp.competing}`);
  // verdict: the score's direction, conviction lowered by disagreement, never flipped; never a sell
  const dis = topics.filter((t) => t.stance === 'disagree').length, qual = topics.filter((t) => t.stance === 'qualify').length;
  let bias = 'AUCTION', conviction = null, note;
  if (gs && gs.ok && gs.bias === 'BUY') {
    bias = 'BUY'; conviction = gs.conviction || 'Medium';
    // only the channels' overall lean moves conviction; a disagreement on one topic is reported, not acted on
    if (vDir === -1) { conviction = 'Low'; note = `The strategist's tested score says BUY; the veteran's channels lean the other way (${dis} topic${dis === 1 ? '' : 's'} in open disagreement), so the consensus keeps the direction at low conviction: quarter size, and act after the next release.`; }
    else if (vDir === 1) note = `Agreed: the tested score and ${ch.have} observed channels point the same way${dis ? ` (${dis} topic${dis === 1 ? '' : 's'} read differently, see the table)` : ''}. Full planned risk per the score's rule; the trend tiebreaker ${C.price.lean > 0 ? 'confirms' : 'does not confirm'}.`;
    else { conviction = conviction === 'High' ? 'Medium' : conviction; note = 'The score says BUY, the veteran\'s channels are mixed: keep the direction, one notch lower conviction, half the planned risk.'; }
  } else if (vDir === 1 && gs && gs.ok) note = 'The veteran\'s channels lean supportive but the tested score shows no edge: auction. A supportive narrative without the score is the hand-judged bias that was right 3 times in 14 at turning points.';
  else if (vDir === -1) note = 'Channels lean against gold and the score shows no edge: auction, and never a macro sell (shorts had no edge in any sub-period). A short needs a separate short-term reason at quarter size.';
  else note = 'No macro edge from either member: auction. Direction comes from the technical systems; the macro layer sets event risk and size only.';
  if (evIn72) note += ` Event within 72 hours (${ev.title}): the bias is conditional until the print.`;
  // invalidation: named levels from the observations
  const ry = C.real, inv = [];
  if (ry.obs !== 'no observation') { const lvl = +ry.obs.match(/TIPS ([\d.]+)%/)[1]; inv.push(`10Y TIPS real yield above ${(lvl + 0.15).toFixed(2)}% (+15 bp from ${lvl.toFixed(2)}%) ends the real-rate support`); }
  if (C.usd.obs !== 'no observation') { const lvl = +C.usd.obs.match(/DXY ([\d.]+)/)[1]; inv.push(`DXY above ${(lvl * 1.015).toFixed(1)} (+1.5%) says the dollar channel has turned`); }
  if (C.price.obs !== 'no observation' && ch.changes && C.price.obs.includes('10-week')) { const a = C.price.obs.match(/10-week average (\d+)/); if (a) inv.push(`a weekly close below the 10-week average ${a[1]} removes the trend tiebreaker`); }
  const verdict = { bias, conviction, note, agree: topics.filter((t) => t.stance === 'agree').length, qualify: qual, disagree: dis, invalidation: inv, eventWithin72h: evIn72 ? { title: ev.title, at: ev.at } : null };
  const card = hypothesisCard({ fc, fp, ch, verdict, now, base });
  return { topics, verdict, card };
}

// ---- hypothesis card (framework §7), filled from data ------------------------------------------------------------------
export function hypothesisCard({ fc, fp, ch, verdict, now, base }) {
  const gs = fc && fc.goldScore, ev = verdict.eventWithin72h;
  return {
    claim: `${verdict.bias === 'BUY' ? 'Gold higher' : 'No directional macro claim for gold'} over ${HORIZON_DAYS} trading days (the score's tested horizon)`,
    shock: fp.shock,
    surprise: ev ? `Pending: ${ev.title} at ${ev.at.slice(0, 16).replace('T', ' ')} UTC against the consensus captured before it` : 'No scheduled red-folder release inside 72 hours; the week\'s moves are judged against their own 1-week windows',
    observed: fp.clues.join(' · '),
    decomposition: 'TIPS real yield observed (DFII10); breakeven = 10Y nominal − TIPS, carrying inflation-risk and liquidity premia; no ACM term-premium estimate in the council\'s data',
    mechanism: fp.goldTest,
    alternative: fp.competing,
    confounders: `Overlapping releases and speakers in the window; COT as of a Tuesday; the council's gold quote is a broker CFD mid, not the LBMA benchmark`,
    falsifier: verdict.invalidation.join('; ') || 'none named (channels unobserved)',
    nextReview: ev ? `after ${ev.title}` : 'Friday close (the score is weekly)',
    forecastId: now != null ? `xau-4w-${weekKey(now)}` : null,
    confidence: `${verdict.conviction || 'none'}; ${ch.list.length - ch.have} of ${ch.list.length} channels unobserved (${ch.list.filter((r) => r.lean == null).map((r) => r.k).join(', ') || 'none'}); base rate ${base ? `${Math.round(base.upRate * 100)}% up over ${base.horizon} days (${base.from}..${base.to}, n ${base.n})` : 'n/a'}`,
  };
}

// ---- 4. forecast ledger (calibration playbook): one binary forecast a week, append-only, scored after resolution ---------
export function probability(verdict, base, gs) {
  const b = base ? base.upRate : 0.55;
  let p = b;
  if (verdict.bias === 'BUY') p = b + (verdict.conviction === 'High' ? 0.12 : verdict.conviction === 'Medium' ? 0.08 : 0.04);
  else if (verdict.disagree === 0 && verdict.agree >= 3) p = b;   // agreed auction: the base rate
  if (verdict.bias !== 'BUY' && verdict.note && /lean against/.test(verdict.note)) p = b - 0.04;   // never below the band; never a sell
  if (verdict.eventWithin72h) p = b + (p - b) / 2;   // half the tilt into an event
  return +Math.min(P_BOUNDS[1], Math.max(P_BOUNDS[0], p)).toFixed(3);
}
export function ledgerIssue(ledger, { now, gold, verdict, base, gs, card }) {
  const L = Array.isArray(ledger) ? ledger : [], wk = weekKey(now);
  if (L.some((r) => r.record_type === 'issued' && r.week === wk)) return { ledger: L, issued: null };
  const closes = (gold || []).filter((o) => o.t <= now); if (!closes.length) return { ledger: L, issued: null };
  const at = closes[closes.length - 1], issuedAt = new Date(now * 1000).toISOString(), p = probability(verdict, base, gs);
  const comparatorP = gs && gs.ok ? (gs.score > 0.5 ? 0.74 : gs.score > 0.25 ? 0.69 : 0.52) : null;   // the score rule's tested hit rates (2007-26)
  const rec = { record_id: `vet-${wk}-issued`, forecast_id: `xau-4w-${wk}`, record_type: 'issued', recorded_at_utc: issuedAt, previous_record_id: null, week: wk,
    forecast: { issued_at_utc: issuedAt, information_cutoff_utc: issuedAt,
      target: { variable: 'XAU/USD daily close', instrument_or_population: 'council daily gold candles (OANDA spot mid), research/daily/xau.json', unit: 'USD per troy ounce',
        outcome_description: `The daily close ${HORIZON_DAYS} trading days after ${isoDay(at.t)} is above ${at.v.toFixed(2)} (the close of ${isoDay(at.t)})`, observation_start_utc: new Date(at.t * 1000).toISOString(), deadline_utc: new Date((at.t + 30 * DAY) * 1000).toISOString(), timezone_note: `UTC day candles; the deadline is the ${HORIZON_DAYS}th trading-day close, about 28-30 calendar days on` },
      horizon: `${HORIZON_DAYS} trading days`, resolution_rule: { publisher: 'council-data', dataset_or_instrument: 'research/daily/xau.json', field_or_price_convention: 'row close (index 4)', rule: `true if close[t0 + ${HORIZON_DAYS} rows] > close[t0]`, revision_policy: 'candles are not revised; a missing day leaves the record unresolved until the next close', specified_vintage: isoDay(at.t) },
      distribution: { kind: 'binary_event', event_probability: p },
      comparator: { type: comparatorP != null ? 'model_rule' : 'none', description: comparatorP != null ? `Gold Macro Score rule: score ${sg(gs.score)} → tested 4-week up rate` : 'no score this week', probability_or_value: comparatorP, sample_size: comparatorP != null ? gs.weeks : null, captured_at_utc: issuedAt, source_url: null, limitations: 'tested hit rates are in-sample averages over 2007-26, not a live probability' },
      base_rate: base ? { probability: base.upRate, description: `unconditional ${HORIZON_DAYS}-day up rate, ${base.from}..${base.to}, n ${base.n}` } : null,
      rationale: verdict.note, disconfirming_evidence: card.falsifier, method_version: 'veteran-1', author_or_model: 'council/veteran.mjs (code port of gptmacro_v.1)', tags: ['gold', 'paper-only', verdict.bias.toLowerCase()] },
    anchor: { t: at.t, close: at.v } };
  return { ledger: L.concat([rec]), issued: rec };
}
export function ledgerResolve(ledger, gold) {
  const L = Array.isArray(ledger) ? ledger.slice() : [], closes = gold || [], idx = new Map(closes.map((o, i) => [o.t, i]));
  const resolvedIds = new Set(L.filter((r) => r.record_type === 'resolved').map((r) => r.forecast_id));
  for (const r of L.filter((x) => x.record_type === 'issued' && !resolvedIds.has(x.forecast_id))) {
    const i = idx.get(r.anchor.t); if (i == null || i + HORIZON_DAYS >= closes.length) continue;
    const end = closes[i + HORIZON_DAYS], y = end.v > r.anchor.close ? 1 : 0, p = r.forecast.distribution.event_probability, cp = r.forecast.comparator.probability_or_value, bp = r.forecast.base_rate && r.forecast.base_rate.probability;
    L.push({ record_id: `vet-${r.week}-resolved`, forecast_id: r.forecast_id, record_type: 'resolved', recorded_at_utc: new Date(end.t * 1000).toISOString(), previous_record_id: r.record_id, week: r.week,
      resolution: { resolved_at_utc: new Date(end.t * 1000).toISOString(), outcome: !!y, realized_value: end.v, return_pct: +((end.v / r.anchor.close - 1) * 100).toFixed(2),
        scores: { brier: +((p - y) ** 2).toFixed(4), brier_comparator: cp != null ? +((cp - y) ** 2).toFixed(4) : null, brier_base: bp != null ? +((bp - y) ** 2).toFixed(4) : null, log_loss: +(-(y * Math.log(p) + (1 - y) * Math.log(1 - p))).toFixed(4) } } });
  }
  return L;
}
export function ledgerSummary(ledger) {
  const L = Array.isArray(ledger) ? ledger : [], res = L.filter((r) => r.record_type === 'resolved'), n = res.length;
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const b = mean(res.map((r) => r.resolution.scores.brier)), bb = mean(res.filter((r) => r.resolution.scores.brier_base != null).map((r) => r.resolution.scores.brier_base)), bc = mean(res.filter((r) => r.resolution.scores.brier_comparator != null).map((r) => r.resolution.scores.brier_comparator));
  return { issued: L.filter((r) => r.record_type === 'issued').length, resolved: n, brier: r2(b, 4), brierBase: r2(bb, 4), brierScore: r2(bc, 4), skillVsBase: b != null && bb ? r2(1 - b / bb, 3) : null, hit: n ? r2(res.filter((r) => r.resolution.outcome).length / n, 3) : null,
    note: n < 20 ? `${n} resolved: too few to judge calibration (20 weekly forecasts is the minimum the playbook asks for)` : 'Brier below the base rate\'s means the tilt adds information' };
}

// ---- build / render ----------------------------------------------------------------------------------------------------
// ---- the argument's record: weekly debates, resolved at the horizon, who was right per topic -------------------------------
// Each side's lean per topic (+1 / −1; 0 or null abstains) is scored against gold's direction over HORIZON_DAYS. The scoreboard
// is the owner's view of the strategist catching up: as the strategist adopts the veteran's challengers (macro/lessons.json),
// its per-topic hits should converge on the veteran's.
export function debatesIssue(hist, { now, gold, topics }) {
  const H = Array.isArray(hist) ? hist : [], wk = weekKey(now);
  if (H.some((r) => r.week === wk)) return { hist: H, issued: null };
  const closes = (gold || []).filter((o) => o.t <= now); if (!closes.length) return { hist: H, issued: null };
  const at = closes[closes.length - 1];
  const rec = { week: wk, at: new Date(now * 1000).toISOString(), anchor: { t: at.t, close: at.v }, topics: topics.map((t) => ({ topic: t.topic, stance: t.stance, m: t.m ?? null, v: t.v ?? null })), resolved: null };
  return { hist: H.concat([rec]), issued: rec };
}
export function debatesResolve(hist, gold) {
  const H = Array.isArray(hist) ? hist.map((r) => ({ ...r })) : [], closes = gold || [], idx = new Map(closes.map((o, i) => [o.t, i]));
  for (const r of H) { if (r.resolved) continue; const i = idx.get(r.anchor.t); if (i == null || i + HORIZON_DAYS >= closes.length) continue;
    const end = closes[i + HORIZON_DAYS], dir = end.v > r.anchor.close ? 1 : -1;
    r.resolved = { at: new Date(end.t * 1000).toISOString(), close: end.v, dir, returnPct: +((end.v / r.anchor.close - 1) * 100).toFixed(2) }; }
  return H;
}
export function scoreboard(hist) {
  const by = {}, tot = { strategist: { n: 0, hit: 0 }, veteran: { n: 0, hit: 0 } };
  for (const r of (Array.isArray(hist) ? hist : []).filter((x) => x.resolved)) for (const t of r.topics) {
    const b = by[t.topic] || (by[t.topic] = { strategist: { n: 0, hit: 0 }, veteran: { n: 0, hit: 0 } });
    for (const [side, lean] of [['strategist', t.m], ['veteran', t.v]]) if (lean) { b[side].n++; tot[side].n++; if (lean === r.resolved.dir) { b[side].hit++; tot[side].hit++; } }
  }
  const rate = (x) => ({ n: x.n, hit: x.n ? +(x.hit / x.n).toFixed(3) : null });
  return { weeks: (hist || []).filter((x) => x.resolved).length, pending: (hist || []).filter((x) => !x.resolved).length, byTopic: Object.fromEntries(Object.entries(by).map(([k, b]) => [k, { strategist: rate(b.strategist), veteran: rate(b.veteran) }])), strategist: rate(tot.strategist), veteran: rate(tot.veteran) };
}
// what the strategist has taken from the veteran so far (macro/forecast.json learned, written by council/macro.mjs lessons())
export function teaching(fc) {
  const L = fc && fc.learned; if (!L) return { adopted: [], pending: [], recent: [], line: 'The strategist does not run the veteran\'s challengers yet.' };
  const ch = L.challengers || {}, adopted = (L.active || []), pending = Object.entries(ch).filter(([c]) => !adopted.includes(c)).map(([c, x]) => ({ k: c, vs: x.vs, challenger: x.challenger, incumbent: x.incumbent }));
  const fmt = (x) => (x ? `hit ${Math.round(x.hit * 100)}%, t ${x.t}` : 'no record yet');
  const line = `${adopted.length ? `The strategist adopted ${adopted.join(', ')} (the veteran's 4-week readings now carry their incumbents' weight, the incumbents keep half).` : 'The strategist has adopted none of the veteran\'s challengers yet.'} ${pending.map((x) => `${x.k} ${fmt(x.challenger)} vs ${x.vs} ${fmt(x.incumbent)}`).join('; ')}${pending.length ? '.' : ''} A challenger is adopted when it is proven on the replay (t ≥ 3, n ≥ 30) and beats its incumbent; it is handed back when it stops being proven.`;
  return { adopted, pending, recent: L.recent || [], line };
}

export function build({ fc, cache, daily, ledger = [], debates = [], now }) {
  const S = {}; for (const id of ['DFII10', 'T10YIE', 'DGS2', 'DGS10', 'T10Y3M', 'BAMLH0A0HYM2', 'VIXCLS', 'VXVCLS', 'DTWEXBGS', 'SOFR', 'EFFR']) S[id] = fromCache(cache && cache.fred && cache.fred[id]);
  const gold = (daily && daily.gold) || [];
  S.gold = gold; S.dxy = daily && daily.dxy ? daily.dxy : [];
  if (gold.length >= 50) { const w = gold.filter((o) => o.t <= now).slice(-50); S.avg10w = w.reduce((a, o) => a + o.v, 0) / w.length; }
  const cotRows = (cache && cache.cot || []).filter((r) => r.t <= now - 4 * DAY);
  if (cotRows.length >= 5) { const w = cotRows.slice(-60), cur = w[w.length - 1], m4 = w[Math.max(0, w.length - 5)], s = w.map((r) => r.net).sort((a, b) => a - b);
    S.cot = { net: cur.net, chg4w: cur.net - m4.net, pct: Math.round(Math.max(0, s.findIndex((v) => v >= cur.net)) / Math.max(1, s.length - 1) * 100), asOf: isoDay(cur.t) }; }
  const ch = channels(S, now), fp = fingerprint(ch.changes), base = baseRates(gold, { now });
  const { topics, verdict, card } = debate(fc, ch, fp, { now, base });
  let L = ledgerResolve(ledger, gold); const { ledger: L2, issued } = ledgerIssue(L, { now, gold, verdict, base, gs: fc && fc.goldScore, card }); L = L2;
  let Dh = debatesResolve(debates, gold); Dh = debatesIssue(Dh, { now, gold, topics }).hist;
  const board = scoreboard(Dh), teach = teaching(fc);
  const v = { v: 1, at: new Date(now * 1000).toISOString(), paperOnly: true, strategistAt: fc && fc.at || null, shock: fp, channels: ch.list, tally: { sum: ch.tally, observed: ch.have, lean: ch.lean },
    debate: topics, verdict, card, base, ledger: { ...ledgerSummary(L), issuedNow: issued ? issued.forecast_id : null, lastProbability: issued ? issued.forecast.distribution.event_probability : (L.filter((r) => r.record_type === 'issued').at(-1) || {}).forecast?.distribution?.event_probability ?? null },
    scoreboard: board, teaching: teach,
    cpiPilot: cpiPilot(), skillVersion: SKILL_VERSION,
    source: `council/veteran.mjs: a code port of the owner's gptmacro_v.1 skill, revision ${SKILL_VERSION} (research/macro-veteran/); reads the strategist's data only, fetches nothing` };
  { const pr = probability(verdict, base, fc && fc.goldScore); v.outlook = outlook({ gold, dxy: S.dxy, now, tilt20: base ? pr - base.upRate : 0, ch, fc }); }
  v.brief = briefOf(v);
  return { v, ledger: L, debates: Dh };
}
export function briefOf(v) {
  const d = v.verdict, dis = v.debate.filter((t) => t.stance === 'disagree').map((t) => t.topic), q = v.debate.filter((t) => t.stance === 'qualify').map((t) => t.topic);
  const sb = v.scoreboard, sbTxt = sb && sb.weeks ? ` Scoreboard over ${sb.weeks} resolved week${sb.weeks === 1 ? '' : 's'}: veteran ${sb.veteran.hit == null ? 'n/a' : Math.round(sb.veteran.hit * 100) + '%'} vs strategist ${sb.strategist.hit == null ? 'n/a' : Math.round(sb.strategist.hit * 100) + '%'} right on direction per topic.` : '';
  return `Macro veteran, ${v.at.slice(0, 16).replace('T', ' ')} UTC. Shock: ${v.shock.shock} (${v.shock.confidence}). Consensus with the strategist: ${d.bias}${d.conviction ? ` ${d.conviction}` : ''} · ${d.agree} agree, ${d.qualify} qualify, ${d.disagree} disagree${dis.length ? ` (${dis.join(', ')})` : ''}${q.length ? `; qualified: ${q.join(', ')}` : ''}. ${d.note} Fails if ${d.invalidation.length ? d.invalidation.join('; ') : 'n/a'}.${v.ledger.lastProbability != null ? ` Ledger: P(gold up over ${HORIZON_DAYS} days) ${Math.round(v.ledger.lastProbability * 100)}%${v.base ? ` vs base ${Math.round(v.base.upRate * 100)}%` : ''}, ${v.ledger.resolved} resolved${v.ledger.brier != null ? `, Brier ${v.ledger.brier}${v.ledger.brierBase != null ? ` vs base ${v.ledger.brierBase}` : ''}` : ''}.` : ''}${sbTxt}${v.teaching ? ` Teaching: ${v.teaching.line}` : ''}`;
}
export function veteranSection(v) {
  if (!v || !v.debate) return '';
  const out = [VET_START, '## Macro veteran', '', `Built by the Macro veteran at ${v.at.slice(0, 16).replace('T', ' ')} UTC from the strategist's data (paper only; full view in macro/veteran.json). Shock fingerprint: **${v.shock.shock}** (${v.shock.confidence} confidence). Consensus: **${v.verdict.bias}${v.verdict.conviction ? ` ${v.verdict.conviction}` : ''}**.`, '',
    '| Topic | Macro strategist | Macro veteran | Stance |', '|---|---|---|---|'];
  for (const t of v.debate) out.push(`| ${t.topic} | ${t.macro.replace(/\|/g, '/')} | ${t.veteran.replace(/\|/g, '/')} | ${t.stance} |`);
  out.push('', v.verdict.note.replace(/\|/g, '/'), '', `Fails if: ${v.verdict.invalidation.join('; ') || 'n/a'}.`, '', `Channels: ${v.channels.map((c) => `${c.name} ${c.lean == null ? 'n/a' : c.lean > 0 ? '+' : c.lean < 0 ? '−' : '0'}${c.stale ? ' (stale)' : ''}`).join(' · ')}.`);
  if (v.ledger) out.push('', `Forecast ledger: ${v.ledger.issued} issued, ${v.ledger.resolved} resolved${v.ledger.brier != null ? `, Brier ${v.ledger.brier} (base ${v.ledger.brierBase ?? 'n/a'}, score rule ${v.ledger.brierScore ?? 'n/a'})` : ''}. ${v.ledger.note}`);
  if (v.scoreboard) out.push('', `Scoreboard (who was right on gold's direction per topic, ${HORIZON_DAYS} trading days on): ${v.scoreboard.weeks} resolved week${v.scoreboard.weeks === 1 ? '' : 's'}, ${v.scoreboard.pending} pending${v.scoreboard.weeks ? ` · veteran ${v.scoreboard.veteran.hit == null ? 'n/a' : Math.round(v.scoreboard.veteran.hit * 100) + '%'} (${v.scoreboard.veteran.n}) vs strategist ${v.scoreboard.strategist.hit == null ? 'n/a' : Math.round(v.scoreboard.strategist.hit * 100) + '%'} (${v.scoreboard.strategist.n})` : ''}.`);
  if (v.teaching) out.push('', `Teaching: ${v.teaching.line.replace(/\|/g, '/')}`);
  out.push(VET_END);
  return out.join('\n');
}

export function run({ dir = 'data', now = Math.floor(Date.now() / 1000), log = console.log } = {}) {
  const M = path.join(dir, 'macro'); fs.mkdirSync(M, { recursive: true });
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const fc = rd(path.join(M, 'forecast.json'), null), cache = rd(path.join(M, 'cache.json'), {}), ledger = rd(path.join(M, 'veteran-ledger.json'), []), debates = rd(path.join(M, 'veteran-debates.json'), []);
  if (!fc || !fc.assets) { log('Macro veteran: no strategist forecast yet (macro/forecast.json); nothing to discuss.'); return null; }
  const daily = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) daily[k] = dailyRows(rd(path.join(dir, 'research', 'daily', `${k}.json`), null));
  const dx = dxyDaily(daily), gold = dailyRows(rd(path.join(dir, 'research', 'daily', 'xau.json'), null));
  const { v, ledger: L, debates: Dh } = build({ fc, cache, daily: { gold, dxy: dx }, ledger, debates, now });
  const w = (f, val) => { const s = JSON.stringify(val, null, 1), p = path.join(M, f); let old = null; try { old = fs.readFileSync(p, 'utf8'); } catch (e) {} if (old !== s) fs.writeFileSync(p, s); };
  w('veteran.json', v); w('veteran-ledger.json', L); w('veteran-debates.json', Dh);
  try { const fA = path.join(dir, 'analysis', 'latest.md');
    if (fs.existsSync(fA)) { const md = fs.readFileSync(fA, 'utf8'), nx = injectSection(md, veteranSection(v), VET_START, VET_END); if (nx !== md) fs.writeFileSync(fA, nx); } } catch (e) { log('veteran: analysis section skipped:', e.message); }
  log(v.brief);
  return v;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { run({ dir: process.argv[2] || 'data' }); } catch (e) { console.error('Macro veteran failed:', (e && e.stack) || e); process.exitCode = 1; }
}
