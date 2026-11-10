// ICT desk replay (owner, 6 Nov 2026): the tracker's own H1 iFVG model run over the year so far (from 1 Jan 2026) of CNBC futures
// candles (5m where CNBC still has them, H1 otherwise), so the desk calendar and stats have history before the live
// tracker started. Same signal code (signals() in tracker.mjs), entry at the inversion candle's close, stop 2 ticks
// beyond the sweep, 3R target with the 2R mark recorded, 36 trading hours max, one trade per market at a time. Writes
// council-data ict/replay.json; every record carries replay: true. Never mixed with the council's data.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, P, MIN_GRADE, cnbcBars, cnbcDaily, closedBar, agg, signals, letter, isASetup, isAPlus, sizeOf, SHADOW, isDip, VARIANTS, variantRule, variantTags, loadMeridian, SHADOW_MARKETS, mdBars, dailyNY, strailLevel } from './tracker.mjs';
import { histStampUtc } from '../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const DATA = process.argv[2] || 'data/ict';
const FROM = Date.parse(process.argv[3] || '2025-08-01T00:00:00Z') / 1000;   // owner, 7 Nov: 5 more months (was 1 Jan 2026)
const now = Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dedupe = (a) => { const m = new Map(); for (const b of a) m.set(b.time, b); return [...m.values()].sort((x, y) => x.time - y.time); };

// futures-roll (research/edge/futures-roll, 7 Nov 2026): CNBC's intraday '.1' history is the CURRENT contract's own candles, so
// before CNBC made it the front month (14 Sep 2026 for the indices, 31 Jul for gold) it is a deferred contract: 0.01-3 % of the front
// month's hourly volume, with 15-100 % one-print (flat) H1 candles in Mar-Aug 2026 for the indices. Its sweeps and gaps are not the
// market the desk trades (the "4 Jun 2026" NQ/ES glitch). CNBC's intraday candles are used only from the first day of their last
// stretch with a daily median hourly volume >= LIQ.min x the median hourly volume of the last LIQ.ref trading days (each day's
// value is the median of it and its neighbours, so one quiet holiday does not cut the series); the hours before go to the back-fill.
export const LIQ = { min: 0.2, ref: 20 };
const nyDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
export function liquidFrom(h1) {
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const days = []; for (const b of h1) { const k = nyDay.format(new Date((b.time + 6 * 3600) * 1000)); if (!days.length || days.at(-1).k !== k) days.push({ k, t: b.time, v: [] }); days.at(-1).v.push(b.volume || 0); }
  if (days.length < LIQ.ref + 2) return null;
  const dm = days.map((d) => med(d.v)), ref = med(days.slice(-LIQ.ref).flatMap((d) => d.v));
  if (!(ref > 0)) return null;
  const sm = dm.map((v, i) => med(dm.slice(Math.max(0, i - 1), i + 2)));
  let i = days.length - 1; while (i > 0 && sm[i] < LIQ.min * ref) i--;   // a thin last day (holiday, partial session) is not the start
  while (i > 0 && sm[i - 1] >= LIQ.min * ref) i--;
  return days[i].t;
}
async function history(M) {
  // Signals need H1 only: CNBC 1H over the whole period (10-day requests). 5m (2-day requests) is used only for exits where
  // CNBC still has it; H1 gaps are filled from 5m. Each request's candle count is logged so coverage can be checked.
  const warm = FROM - 40 * 86400;
  for (const sym of M.cnbc) {
    let h1 = [], m5 = [], log = [];
    for (let t = warm; t < now; t += 10 * 86400) {
      let got = []; try { got = await cnbcBars(sym, '1H', t, Math.min(now + 3600, t + 10 * 86400)); } catch (e) { got = []; }
      h1 = h1.concat(got); log.push(`1H ${new Date(t * 1000).toISOString().slice(0, 10)}:${got.length}`); await sleep(300);
    }
    for (let t = FROM; t < now; t += 2 * 86400) {
      let got = []; try { got = await cnbcBars(sym, '5M', t, Math.min(now + 300, t + 2 * 86400)); } catch (e) { got = []; }
      m5 = m5.concat(got); await sleep(250);
    }
    h1 = dedupe(h1); m5 = dedupe(m5);
    // 7 Nov: CNBC returns a few stray hourly bars months before its continuous history; keep only the continuous part
    // (the last run of 10-day chunks with >= 50 bars each) so the back-fill below starts where CNBC really starts
    { const ch = new Map(); for (const b of h1) { const c = Math.floor((b.time - FROM) / (10 * 86400)); ch.set(c, (ch.get(c) || 0) + 1); }
      const ks = [...ch.keys()].sort((a, b) => a - b); let c0 = ks.at(-1); while (c0 > 0 && (ch.get(c0 - 1) || 0) >= 50) c0--;
      if (ks.length && c0 > ks[0]) { const t0 = FROM + c0 * 10 * 86400, before = h1.length; h1 = h1.filter((b) => b.time >= t0); log.push(`stray CNBC bars before ${new Date(t0 * 1000).toISOString().slice(0, 10)} dropped (${before - h1.length})`); } }
    // futures-roll (7 Nov 2026): the earlier hours are a deferred contract's thin prints, not the front month; they go to the back-fill.
    // 8 Nov, owner: OFF by default ("keep the 812 / +123.7R record"); the cut was not pre-registered and swapped a third of the replay's
    // signals for cash-proxy ones. ICT_REPLAY_LIQUID=on turns it back on for research runs. The daily roll adjustment and the live
    // open-trade shift (stage 1) stay.
    { const t0 = process.env.ICT_REPLAY_LIQUID === 'on' ? liquidFrom(h1) : null;
      if (t0 && h1.length && t0 > h1[0].time) { const before = h1.length; h1 = h1.filter((b) => b.time >= t0); m5 = m5.filter((b) => b.time >= t0); log.push(`deferred-contract CNBC bars before ${new Date(t0 * 1000).toISOString().slice(0, 10)} dropped (${before - h1.length})`); } }
    const cnbc1 = h1.length ? h1[0].time : null;   // signals before this come from the Dukascopy cash-index fill
    // CNBC keeps only ~6 months of intraday candles: fill the earlier part from the research probe's Dukascopy cash-index
    // 5m files (council-data research/candles/idx/), scaled to the futures level by the median ratio over the overlap
    const DUKA = { NQ: 'USATECHIDXUSD', ES: 'USA500IDXUSD', YM: 'USA30IDXUSD' }[M.short];
    // FX: HistData M1 files in council-data research/candles/<PAIR>/ (converted with council/histdata.mjs; no ICT market uses this path today), aggregated to 5m, used the same way
    const HD = { EURUSD: 'EURUSD', GBPUSD: 'GBPUSD' }[M.short];
    const XAU = M.short === 'GC' ? path.join(DATA, '..', 'research', 'candles', 'xau-jan-jun.json.gz') : null;   // spot gold 1m, 20 Dec 2025 - 7 Jun 2026
    if ((DUKA || HD || XAU) && h1.length && h1[0].time > FROM) {
      let d5 = [];
      const yrs = [...new Set([warm, now].map((t) => new Date(t * 1000).getUTCFullYear()))]; for (let y = yrs[0]; y <= yrs.at(-1); y++) if (!yrs.includes(y)) yrs.push(y);
      if (DUKA) for (const y of yrs) {
        const f = path.join(DATA, '..', 'research', 'candles', 'idx', `${DUKA}_${y}.json.gz`);
        try { d5 = d5.concat(JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))); } catch (e) { /* not there yet */ }
      }
      if (HD) { const dir = path.join(DATA, '..', 'research', 'candles', HD); let m1 = [];
        let files = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz') && yrs.some((y) => f.includes(`_M1_${y}`))); } catch (e) { files = []; }
        for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) { if (!ln) continue; const [d, o, h, l, c] = ln.split(';');
          const t = histStampUtc(d); if (t >= warm) m1.push({ time: t, open: +o, high: +h, low: +l, close: +c }); }
        d5 = agg(m1.sort((a, b) => a.time - b.time), 300); }
      if (XAU) { try { d5 = agg(JSON.parse(zlib.gunzipSync(fs.readFileSync(XAU))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })).filter((b) => b.time >= warm), 300); } catch (e) { d5 = []; } }
      // futures-roll: the files end before CNBC's front-month candles start (spot gold 7 Jun 2026, Dukascopy 5 Nov 2026, while the next
      // index roll moves the start to mid-December): OANDA mid 5m (the paper markets' source, site proxy) fills the hole and the 20
      // days the scale is measured on. RTY has no OANDA symbol and no fill.
      const MD = { NQ: 'nas100', ES: 'spx500', YM: 'us30', GC: 'xau' }[M.short], end = d5.length ? d5.at(-1).time + 300 : warm, upto = Math.min(now, h1[0].time + 21 * 86400);
      if (MD && h1[0].time - end > 86400) { let o = []; try { for (let t = end; t < upto; t += 4999 * 300) { o = o.concat(await mdBars(MD, '5m', `from=${t}&to=${Math.min(upto, t + 4999 * 300)}`)); await sleep(200); } } catch (e) { o = []; log.push(`oanda ${MD} gap fill failed: ${e.message || e}`); }
        if (o.length) { d5 = dedupe(d5.concat(o.filter((b) => b.time >= end))); log.push(`oanda ${MD} gap fill ${o.length} 5m`); } }
      // calendar audit: the cash / spot fills trade through CME half-day afternoons and holiday eves (spot gold on MLK afternoon);
      // the futures did not, so those bars are dropped exactly as cnbcBars() drops the feed's flat candles there
      d5 = dedupe(d5).filter((b) => !closedBar(b.time));
      if (d5.length) {
        const dh = agg(d5, 3600), byT = new Map(dh.map((b) => [b.time, b])), first = h1[0].time;
        const ratios = h1.filter((b) => b.time < first + 20 * 86400 && byT.has(b.time)).map((b) => b.close / byT.get(b.time).close).sort((a, b) => a - b);
        if (ratios.length >= 20) {
          const k = ratios[Math.floor(ratios.length / 2)], sc = (b) => ({ time: b.time, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k });
          const fill = dh.filter((b) => b.time >= warm && b.time < first).map(sc);
          h1 = dedupe(fill.concat(h1)); m5 = dedupe(d5.filter((b) => b.time >= FROM && b.time < first).map(sc).concat(m5));
          log.push(`${DUKA ? 'duka ' + DUKA : HD ? 'histdata ' + HD : 'spot gold'} fill ${fill.length} H1 before ${new Date(first * 1000).toISOString().slice(0, 10)}, scale ${k.toFixed(4)}`);
        } else log.push(`${DUKA || HD || 'spot gold'}: overlap too small (${ratios.length})`);
      }
    }
    console.log(M.short, sym, 'H1', h1.length, 'M5', m5.length, log.join(' '));
    if (h1.length + m5.length < 500) continue;
    const have = new Set(h1.map((b) => b.time)), H = dedupe(h1.concat(agg(m5, 3600).filter((b) => !have.has(b.time)))).filter((b) => b.time + 3600 <= now);
    // daily candles back-adjusted across contract rolls (tracker.mjs rollAdjust; research/edge/futures-roll)
    const daily = await cnbcDaily(M, sym, FROM - 500 * 86400, now + 86400), D = daily.d1.filter((b) => b.time + 86400 <= now);
    // 5m counts as exit data from the first day with a near-full 5m session onwards
    const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
    const full = [...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d).sort((a, b) => a - b);
    return { sym, m5, H, D, rolls: daily.rolls, m5from: full.length ? full[0] * 86400 : null, m5days: new Set(full), cnbcFrom: cnbc1 };
  }
  throw new Error(`no CNBC history for ${M.short}`);
}

// paper-only markets: OANDA mid 1h (signals, D1 at the 17:00 New York rollover) and 5m (exits) through the proxy, in windows of
// 4999 candles (OANDA's cap); 5m counts as exit data on days with >= 200 candles, as history() does
async function paperHistory(M) {
  const get = async (tf, sec, from) => { let a = [];
    for (let t = from; t < now; t += 4999 * sec) { a = a.concat(await mdBars(M.md, tf, `from=${t}&to=${Math.min(now, t + 4999 * sec)}`)); await sleep(200); }
    return dedupe(a); };
  const H = (await get('1h', 3600, FROM - 400 * 86400)).filter((b) => b.time + 3600 <= now), m5 = (await get('5m', 300, FROM - 2 * 86400)).filter((b) => b.time + 300 <= now);
  const D = dailyNY(H).filter((b) => b.time + 86400 <= now);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  if (H.length < 1000 || D.length < 60) throw new Error(`md ${M.md}: short history (H1 ${H.length}, D1 ${D.length})`);
  return { H, m5, D, m5days: new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d)) };
}

// audit (7 Nov): a hole in the candle history longer than any exchange holiday (4 days) inside a trade's window means the
// exit cannot be known (gold before CNBC's continuous history had holes of 1-3 weeks: one trade was "held" 17 days)
export const MAX_GAP = 4 * 86400;
// opt.strail (shadow 'strail' only): the structure trail [from R, swing candles each side] replaces the 1.5R trail
export function simulate(g, M, key, src, at = now, opt = {}) {
  const s = g.side, f = (v) => +(+v).toFixed(M.dec), entry = g.entry, r0 = g.r0, t2 = entry + s * P.mark * r0;
  const hb = src.H.filter((b) => b.time >= g.close).slice(0, P.holdH), end = hb.length === P.holdH ? hb[hb.length - 1].time + 3600 : g.close + P.holdH * 3600;   // P.holdH closed H1 candles
  { let p = g.close; for (const b of hb) { if (b.time - p > MAX_GAP) return null; p = b.time + 3600; } }
  const use5 = src.m5days && src.m5days.has(Math.floor(g.close / 86400)) && src.m5days.has(Math.floor((g.close + 86400) / 86400));
  const bars = use5 ? src.m5.filter((b) => b.time >= g.close && b.time < end) : src.H.filter((b) => b.time >= g.close && b.time < end);
  const step = use5 ? 300 : 3600;
  // same exit as the tracker: no fixed target; from +2R the stop trails 1.5R behind the best price (checked before the
  // candle's own new high moves it, i.e. conservatively); 36 trading hours max
  let status = 'open', R = null, closed = null, exit = null, exitPx = null, mark2 = null, mfe = 0, stop = g.stop, moved = false, beMoved = false;
  const beAt = M.aRule ? null : P.be;   // break-even from +1.5R on index futures, as the tracker
  const trail = opt.strail ? null : P.trail; let sk = 0;
  for (const b of bars) {
    // 'strail': at each H1 close since the signal (hb), from +strail[0] R the stop moves to the last confirmed H1 swing when tighter (as the tracker)
    if (opt.strail) while (sk < hb.length && hb[sk].time + 3600 <= b.time) { sk++;
      if (mfe >= opt.strail[0]) { const ns = strailLevel(hb, sk, s, opt.strail[1]); if (ns != null && (ns - stop) * s > 0) { stop = ns; moved = true; } } }
    if (!mark2 && (s > 0 ? b.high >= t2 : b.low <= t2)) mark2 = b.time + step;
    if (s > 0 ? b.low <= stop : b.high >= stop) { R = +((s * (stop - entry)) / r0).toFixed(2); status = R > 0.001 ? 'win' : R < -0.001 ? 'loss' : 'be'; closed = b.time + step; exit = moved ? 'trail' : beMoved ? 'breakeven' : 'stop'; exitPx = stop; break; }
    mfe = Math.max(mfe, ((s > 0 ? b.high : -b.low) - s * entry) / r0);
    if (beAt && !beMoved && mfe >= beAt && (entry - stop) * s > 0) { stop = entry; beMoved = true; }
    if (trail && mfe >= trail[0]) { const ns = entry + s * (mfe - trail[1]) * r0; if ((ns - stop) * s > 0) { stop = ns; moved = true; } }
  }
  // the time exit needs all P.holdH candles: before, a window cut short by the end of the data (a weekend run) closed at
  // 36 CLOCK hours, i.e. on Friday's last bar
  if (status === 'open' && hb.length === P.holdH && end <= at && bars.length) { const last = bars.at(-1); R = +((s * (last.close - entry)) / r0).toFixed(2); status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; closed = last.time + step; exit = 'time'; exitPx = last.close; }
  const R2 = closed ? (mark2 && mark2 <= closed ? 2 : R) : null;
  // research: the next 72 H1 candles after the entry as [best, worst, close] in R (sign-adjusted), to study other exits offline
  const path = src.H.filter((b) => b.time >= g.close && b.time < g.close + 72 * 3600).map((b) => [+(((s > 0 ? b.high : -b.low) - s * entry) / r0).toFixed(2), +(((s > 0 ? b.low : -b.high) - s * entry) / r0).toFixed(2), +((s * (b.close - entry)) / r0).toFixed(2)]);
  return { id: `${key}-${s > 0 ? 'b' : 's'}-${g.t}-r`, market: key, label: M.label, short: M.short, side: s > 0 ? 'buy' : 'sell', model: 'H1 iFVG reversal', replay: true, res: step === 300 ? '5m' : '1h', ...(src.cnbcFrom && g.close < src.cnbcFrom ? { cash: true } : {}),
    signalAt: g.close, signalPx: f(entry), entry: f(entry), stop: f(g.stop), stop0: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: null, trail, ...(opt.strail ? { strail: opt.strail } : {}), be: beAt, t2: f(t2), opened: g.close, status, R, R2, closed, exit, exitPx: exitPx == null ? null : f(exitPx), mfe: +mfe.toFixed(2), path,
    sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid, feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) } };
}

if (process.argv[1] && process.argv[1].endsWith('replay.mjs')) {
  const out = { at: new Date().toISOString(), from: new Date(FROM * 1000).toISOString().slice(0, 10), src: {}, errors: {}, gaps: {}, trades: [], shadow: [], shadowByVariant: Object.fromEntries(VARIANTS.map((v) => [v, []])) };
  for (const [key, M] of Object.entries(MARKETS)) {
    try {
      const src = await history(M);
      out.src[key] = { sym: src.sym, h1: src.H.length, m5: src.m5.length, m5from: src.m5from ? new Date(src.m5from * 1000).toISOString().slice(0, 10) : null, d1: src.D.length, d1Rolls: src.rolls };
      const sig = signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => g.close >= FROM && g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
      let busyAll = 0, busyA = 0;   // same rule as the tracker: an A-setup is only blocked by an open A-setup
      // each A-setup carries the shadow variants' verdicts (vr), for the Coach's ICT filter verdicts; a failure here only loses the tags
      let vctx = null; try { vctx = { H: src.H, D: src.D, ms: await loadMeridian() }; } catch (e) { (out.shadowErrors = out.shadowErrors || {})[`${key}-vr`] = String(e.message || e); }
      for (const g of sig) { const a = isASetup(g, key); if (g.close < (a ? busyA : busyAll)) continue; const t = simulate(g, M, key, src); if (!t) { out.gaps[key] = (out.gaps[key] || 0) + 1; continue; } t.aset = a; t.aplus = isAPlus(g, key); t.size = a ? sizeOf(g, key) : 1;
        if (a && vctx) { try { t.vr = variantTags(g, key, vctx); } catch (e) {} }
        if (t.size !== 1 && t.R != null) { t.Rraw = t.R; t.R = +(t.R * t.size).toFixed(2); if (t.R2 != null) t.R2 = +(t.R2 * t.size).toFixed(2); }
        out.trades.push(t);
        const end = t.closed || Infinity; busyAll = Math.max(busyAll, end); if (a) busyA = end; }
      // shadow 'dip' (paper comparison only, research/edge/ict-index-longonly): its own stream with its own one-open-trade rule, size 1,
      // no break-even (simulate() skips break-even when the market has an aRule), gold exit. Kept in out.shadow, never in out.trades.
      if (SHADOW.dip.markets.includes(key)) { let busy = 0;
        for (const g of sig) { if (g.close < busy || !isDip(g, key, src.D)) continue; const t = simulate(g, { ...M, aRule: 'dip' }, key, src); if (!t) continue;
          Object.assign(t, { id: t.id.replace(/-r$/, '-dip-r'), shadow: true, variant: 'dip', aset: false, size: 1 }); out.shadow.push(t); busy = t.closed || Infinity; } }
      // shadow 'nofri' / 'h1opp' / 'strail' (paper comparison only): the A-setup rule plus one condition ('strail': the structure-trail
      // exit instead), each its own stream with its own one-open rule, A-setup sizing and break-even on indices, as the live tracker;
      // kept in out.shadowByVariant without the 72-candle path
      for (const v of VARIANTS) { if (!SHADOW[v].markets.includes(key)) continue;
        try { const ctx = { H: src.H, D: src.D, ms: v === 'h1opp' ? await loadMeridian() : null }; let busy = 0;
          for (const g of sig) { if (g.close < busy || !variantRule(v, g, key, ctx)) continue; const t = simulate(g, M, key, src, now, v === 'strail' ? { strail: [SHADOW.strail.from, SHADOW.strail.piv] } : {}); if (!t) continue;
            delete t.path; Object.assign(t, { id: t.id.replace(/-r$/, `-${v}-r`), shadow: true, variant: v, aset: true, aplus: isAPlus(g, key), size: sizeOf(g, key) });
            if (t.size !== 1 && t.R != null) { t.Rraw = t.R; t.R = +(t.R * t.size).toFixed(2); if (t.R2 != null) t.R2 = +(t.R2 * t.size).toFixed(2); }
            out.shadowByVariant[v].push(t); busy = t.closed || Infinity; }
        } catch (e) { (out.shadowErrors = out.shadowErrors || {})[`${key}-${v}`] = String(e.message || e); } }
      console.log(key, JSON.stringify(out.src[key]), 'signals', sig.length, 'trades', out.trades.filter((x) => x.market === key).length);
    } catch (e) { out.errors[key] = String(e.message || e); console.log(key, out.errors[key]); }
  }
  // paper-only markets (SHADOW_MARKETS, research/ict-markets.md): OANDA mid history through the site's market-data proxy, the market's
  // own variant stream in out.shadowByVariant[variant] (gold-rule sizing and exits, one open trade at a time). Never in out.trades.
  out.paperVariants = Object.values(SHADOW_MARKETS).map((M) => M.variant);   // variants that are other markets, not filters of the A-stream
  for (const [key, M] of Object.entries(SHADOW_MARKETS)) {
    const v = M.variant;
    try {
      const src = await paperHistory(M);
      (out.shadowSrc = out.shadowSrc || {})[key] = { sym: `oanda ${M.md}`, h1: src.H.length, m5: src.m5.length, d1: src.D.length };
      const sig = signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => g.close >= FROM && g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
      let busy = 0;
      for (const g of sig) { if (g.close < busy || !variantRule(v, g, key, src)) continue; const t = simulate(g, M, key, src); if (!t) continue;
        delete t.path; Object.assign(t, { id: t.id.replace(/-r$/, `-${v}-r`), shadow: true, variant: v, paperMarket: true, aset: true, aplus: false, size: 1 });
        out.shadowByVariant[v].push(t); busy = t.closed || Infinity; }
      console.log(key, 'paper', JSON.stringify(out.shadowSrc[key]), 'signals', sig.length, 'trades', out.shadowByVariant[v].length);
    } catch (e) { (out.shadowErrors = out.shadowErrors || {})[`${key}-${v}`] = String(e.message || e); console.log(key, 'paper', String(e.message || e)); }
  }
  out.trades.sort((a, b) => a.opened - b.opened);
  const C = out.trades.filter((x) => x.closed);
  const CA = C.filter((x) => x.aset);
  out.totalsA = { n: CA.length, wins: CA.filter((x) => x.R > 0).length, R: +CA.reduce((a, x) => a + x.R, 0).toFixed(2) };
  out.shadow.sort((a, b) => a.opened - b.opened);
  { const SC = out.shadow.filter((x) => x.closed); out.totalsDip = { n: SC.length, wins: SC.filter((x) => x.R > 0).length, R: +SC.reduce((a, x) => a + x.R, 0).toFixed(2) }; }
  out.totalsByVariant = {};
  for (const [v, a] of [['dip', out.shadow], ...Object.entries(out.shadowByVariant)]) { a.sort((x, y) => x.opened - y.opened); const SC = a.filter((x) => x.closed);
    out.totalsByVariant[v] = { n: SC.length, wins: SC.filter((x) => x.R > 0).length, R: +SC.reduce((q, x) => q + x.R, 0).toFixed(2) }; }
  out.totals = { n: C.length, wins: C.filter((x) => x.R > 0).length, R: +C.reduce((a, x) => a + x.R, 0).toFixed(2), R2: +C.reduce((a, x) => a + (x.R2 ?? x.R), 0).toFixed(2) };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'replay.json'), JSON.stringify(out));
  console.log('totals', JSON.stringify(out.totals), 'A', JSON.stringify(out.totalsA), 'shadow', JSON.stringify(out.totalsByVariant));
}
