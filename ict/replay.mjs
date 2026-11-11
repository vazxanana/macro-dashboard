// ICT desk replay (owner, 6 Nov 2026): the tracker's own H1 iFVG model run over the year so far (from 1 Jan 2026) of CNBC futures
// candles (5m where CNBC still has them, H1 otherwise), so the desk calendar and stats have history before the live
// tracker started. Same signal code (signals() in tracker.mjs), entry at the inversion candle's close, stop 2 ticks
// beyond the sweep, 3R target with the 2R mark recorded, 36 trading hours max, one trade per market at a time. Writes
// council-data ict/replay.json; every record carries replay: true. Never mixed with the council's data.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { MARKETS, P, MIN_GRADE, cnbcBars, cnbcDaily, closedBar, agg, signals, letter, isASetup, isAPlus, sizeOf, SHADOW, isDip, VARIANTS, variantRule, variantTags, loadMeridian, SHADOW_MARKETS, mdBars, dailyNY, strailLevel } from './tracker.mjs';

const DATA0 = process.argv[2] || 'data/ict';
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
// The back-fill join (pure; 11 Nov 2026 so it can be tested): the fill's 5m candles `d5` are scaled to the futures level by the
// median close ratio over the 20 days after the feed's first candle, and put before it. Both the boundary (`first`) and the
// scale (`k`) depend on which candles the feed returned in THIS run: on 8 and 11 Nov 2026 gold's boundary was 1 Mar 23:00 and
// 27 Feb 00:00 UTC and its scale 1.02967 and 1.02950, which moved every level of the months before by about $0.80. They are
// written to replay.json (`src.<market>.cnbcFrom`, `.fill`) so a moved boundary or scale can be seen; booked history no longer
// follows them (see "Frozen history" below).
export function scaleFill(h1, m5, d5, warm, from) {
  if (!d5.length || !h1.length) return null;
  const dh = agg(d5, 3600), byT = new Map(dh.map((b) => [b.time, b])), first = h1[0].time;
  const ratios = h1.filter((b) => b.time < first + 20 * 86400 && byT.has(b.time)).map((b) => b.close / byT.get(b.time).close).sort((a, b) => a - b);
  if (ratios.length < 20) return { first, k: null, overlap: ratios.length, n: 0, h1, m5 };
  const k = ratios[Math.floor(ratios.length / 2)], sc = (b) => ({ time: b.time, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k });
  const fill = dh.filter((b) => b.time >= warm && b.time < first).map(sc);
  return { first, k, overlap: ratios.length, n: fill.length, h1: dedupe(fill.concat(h1)), m5: dedupe(d5.filter((b) => b.time >= from && b.time < first).map(sc).concat(m5)) };
}
async function history(M) {
  // Signals need H1 only: CNBC 1H over the whole period (10-day requests). 5m (2-day requests) is used only for exits where
  // CNBC still has it; H1 gaps are filled from 5m. Each request's candle count is logged so coverage can be checked.
  const warm = FROM - 40 * 86400;
  for (const sym of M.cnbc) {
    let h1 = [], m5 = [], log = [], fillInfo = null;
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
    // FX: HistData M1 files in council-data research/candles/<PAIR>/ (EST, no DST -> UTC), aggregated to 5m, used the same way
    const HD = { EURUSD: 'EURUSD', GBPUSD: 'GBPUSD' }[M.short];
    const XAU = M.short === 'GC' ? path.join(DATA0, '..', 'research', 'candles', 'xau-jan-jun.json.gz') : null;   // spot gold 1m, 20 Dec 2025 - 7 Jun 2026
    if ((DUKA || HD || XAU) && h1.length && h1[0].time > FROM) {
      let d5 = [];
      const yrs = [...new Set([warm, now].map((t) => new Date(t * 1000).getUTCFullYear()))]; for (let y = yrs[0]; y <= yrs.at(-1); y++) if (!yrs.includes(y)) yrs.push(y);
      if (DUKA) for (const y of yrs) {
        const f = path.join(DATA0, '..', 'research', 'candles', 'idx', `${DUKA}_${y}.json.gz`);
        try { d5 = d5.concat(JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))); } catch (e) { /* not there yet */ }
      }
      if (HD) { const dir = path.join(DATA0, '..', 'research', 'candles', HD); let m1 = [];
        let files = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz') && yrs.some((y) => f.includes(`_M1_${y}`))); } catch (e) { files = []; }
        for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) { if (!ln) continue; const [d, o, h, l, c] = ln.split(';');
          const t = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13)) / 1000 + 5 * 3600; if (t >= warm) m1.push({ time: t, open: +o, high: +h, low: +l, close: +c }); }
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
      const sf = scaleFill(h1, m5, d5, warm, FROM), name = DUKA ? 'duka ' + DUKA : HD ? 'histdata ' + HD : 'spot gold';
      if (sf && sf.k != null) {
        h1 = sf.h1; m5 = sf.m5; fillInfo = { src: name, scale: +sf.k.toFixed(5), h1: sf.n, overlap: sf.overlap };
        log.push(`${name} fill ${sf.n} H1 before ${new Date(sf.first * 1000).toISOString().slice(0, 10)}, scale ${sf.k.toFixed(4)}`);
      } else if (sf) log.push(`${DUKA || HD || 'spot gold'}: overlap too small (${sf.overlap})`);
    }
    console.log(M.short, sym, 'H1', h1.length, 'M5', m5.length, log.join(' '));
    if (h1.length + m5.length < 500) continue;
    const have = new Set(h1.map((b) => b.time)), H = dedupe(h1.concat(agg(m5, 3600).filter((b) => !have.has(b.time)))).filter((b) => b.time + 3600 <= now);
    // daily candles back-adjusted across contract rolls (tracker.mjs rollAdjust; research/edge/futures-roll)
    const daily = await cnbcDaily(M, sym, FROM - 500 * 86400, now + 86400), D = daily.d1.filter((b) => b.time + 86400 <= now);
    // 5m counts as exit data from the first day with a near-full 5m session onwards
    const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
    const full = [...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d).sort((a, b) => a - b);
    return { sym, m5, H, D, rolls: daily.rolls, m5from: full.length ? full[0] * 86400 : null, m5days: new Set(full), cnbcFrom: cnbc1, fill: fillInfo };
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

// ONE booked outcome for every surface (11 Nov 2026): a closed record is a win, a loss or break-even by the sign of its stored
// per-unit R (`Rraw`, else `R`), exactly as it was booked; display rounding or sizing never changes it. The desk page
// (MS_ICT.outcome) and the connector (api/mcp.js outcome) use the same rule; tests/ict-trace.test.mjs compares the three.
// "Near-flat" is a research label only, with a published tolerance: |per-unit R| <= NEAR_FLAT. It never replaces the outcome.
export const NEAR_FLAT = 0.05;
export const unitR = (t) => (typeof t.Rraw === 'number' ? t.Rraw : typeof t.R === 'number' ? t.R : null);
export const booked = (t) => !!t && t.status !== 'open' && unitR(t) != null && (!!t.closed || ['win', 'loss', 'be'].includes(t.status));
export function outcomeOf(t) { if (!booked(t)) return 'open'; const r = unitR(t); return r > 0 ? 'win' : r < 0 ? 'loss' : 'be'; }
export const nearFlat = (t) => outcomeOf(t) !== 'open' && Math.abs(unitR(t)) <= NEAR_FLAT;
export function tally(list) {
  const o = { n: 0, wins: 0, losses: 0, be: 0, nearFlat: 0, open: 0, R: 0 };
  for (const t of list) { const k = outcomeOf(t); if (k === 'open') { o.open++; continue; } o.n++; o[k === 'win' ? 'wins' : k === 'loss' ? 'losses' : 'be']++; if (nearFlat(t)) o.nearFlat++; o.R += t.R; }
  o.R = +o.R.toFixed(2); return o;
}
// The correction log (council-data ict/replay-log.json): what a run changed against the file it replaces, so a changed result can
// always be explained. `resolved` = a record that was unresolved and is now booked (its first and only exit); `corrected` = a
// booked result that differs; `removed` / `added` = records that left or joined the list. A run that changes nothing writes no
// entry, so running twice books everything once. The file being replaced stays in council-data's git history at `prevAt`.
const BOOKED = ['status', 'R', 'Rraw', 'R2', 'closed', 'exit', 'exitPx', 'entry', 'stop', 'size'];
const bookedOf = (t) => Object.fromEntries(BOOKED.filter((k) => t[k] !== undefined).map((k) => [k, t[k]]));
export function replayDiff(prev, next, at) {
  const P0 = new Map(((prev && prev.trades) || []).map((t) => [t.id, t])), N0 = new Map(next.trades.map((t) => [t.id, t]));
  const e = { at, prevAt: (prev && prev.at) || null, resolved: [], corrected: [], removed: [], added: 0, totalsFrom: prev ? tally(prev.trades || []) : null, totalsTo: tally(next.trades) };
  for (const [id, t] of N0) { const o = P0.get(id); if (!o) { e.added++; continue; }
    const a = bookedOf(o), b = bookedOf(t); if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (!o.closed && t.closed) e.resolved.push({ id, through: o.through ?? null, markR: o.markR ?? null, to: b });
    else if (o.closed) e.corrected.push({ id, from: a, to: b }); }
  for (const [id, o] of P0) if (!N0.has(id)) e.removed.push({ id, from: bookedOf(o) });
  e.changed = e.resolved.length + e.corrected.length + e.removed.length > 0 || (!!prev && e.added > 0);
  return e;
}
export function appendLog(log, entry, keep = 200) { const runs = (log && Array.isArray(log.runs) ? log.runs : []); return entry.changed ? { runs: runs.concat([entry]).slice(-keep) } : { runs }; }

// audit (7 Nov): a hole in the candle history longer than any exchange holiday (4 days) inside a trade's window means the
// exit cannot be known (gold before CNBC's continuous history had holes of 1-3 weeks: one trade was "held" 17 days)
export const MAX_GAP = 4 * 86400;
// opt.strail (shadow 'strail' only): the structure trail [from R, swing candles each side] replaces the 1.5R trail
export function simulate(g, M, key, src, at = now, opt = {}) {
  const s = g.side, f = (v) => +(+v).toFixed(M.dec), entry = g.entry, r0 = g.r0, t2 = entry + s * P.mark * r0;
  const hb = src.H.filter((b) => b.time >= g.close).slice(0, P.holdH), end = hb.length === P.holdH ? hb[hb.length - 1].time + 3600 : Math.max(g.close + P.holdH * 3600, hb.length ? hb[hb.length - 1].time + 3600 : 0);   // P.holdH closed H1 candles; with fewer on file (the window is still running, e.g. across a weekend), every candle on file is processed, not only the first 36 clock hours
  { let p = g.close; for (const b of hb) { if (b.time - p > MAX_GAP) return null; p = b.time + 3600; } }
  const use5 = src.m5days && src.m5days.has(Math.floor(g.close / 86400)) && src.m5days.has(Math.floor((g.close + 86400) / 86400));
  const bars = use5 ? src.m5.filter((b) => b.time >= g.close && b.time < end) : src.H.filter((b) => b.time >= g.close && b.time < end);
  const step = use5 ? 300 : 3600;
  // same exit as the tracker: no fixed target; from +2R the stop trails 1.5R behind the best price (checked before the
  // candle's own new high moves it, i.e. conservatively); 36 trading hours max
  let status = 'open', R = null, closed = null, exit = null, exitPx = null, mark2 = null, mfe = 0, stop = g.stop, moved = false, beMoved = false;
  const beAt = M.aRule ? null : P.be;   // break-even from +1.5R on index futures, as the tracker
  const trail = opt.strail ? null : P.trail; let sk = 0;
  let seen = null;   // the last candle processed for exits: the record's checkpoint (`through`)
  for (const b of bars) {
    seen = b;
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
  // checkpoint (11 Nov 2026, Fred's audit): how far this record's candles were processed, and, while it is unresolved, the stop in
  // force there and the R at that candle's close. The desk shows an open replay record "as of" this time, never against a newer price.
  const through = closed || (seen ? seen.time + step : g.close);
  const mark = status === 'open' ? { stopNow: f(stop), markPx: seen ? f(seen.close) : f(entry), markR: seen ? +((s * (seen.close - entry)) / r0).toFixed(2) : 0, ...(beMoved ? { beMoved: true } : {}), ...(moved ? { trailMoved: true } : {}) } : {};
  // research: the next 72 H1 candles after the entry as [best, worst, close] in R (sign-adjusted), to study other exits offline
  const path = src.H.filter((b) => b.time >= g.close && b.time < g.close + 72 * 3600).map((b) => [+(((s > 0 ? b.high : -b.low) - s * entry) / r0).toFixed(2), +(((s > 0 ? b.low : -b.high) - s * entry) / r0).toFixed(2), +((s * (b.close - entry)) / r0).toFixed(2)]);
  return { id: `${key}-${s > 0 ? 'b' : 's'}-${g.t}-r`, market: key, label: M.label, short: M.short, side: s > 0 ? 'buy' : 'sell', model: 'H1 iFVG reversal', replay: true, res: step === 300 ? '5m' : '1h', ...(src.cnbcFrom && g.close < src.cnbcFrom ? { cash: true } : {}),
    signalAt: g.close, signalPx: f(entry), entry: f(entry), stop: f(g.stop), stop0: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: null, trail, ...(opt.strail ? { strail: opt.strail } : {}), be: beAt, t2: f(t2), opened: g.close, status, R, R2, closed, exit, exitPx: exitPx == null ? null : f(exitPx), through, ...mark, mfe: +mfe.toFixed(2), path,
    sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid, feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) } };
}

// Frozen history (11 Nov 2026). The feed does not return the same candles for the same past hours on every run: the first candle of
// its continuous history moves (so the back-fill boundary and scale move), single stray candles come and go, an old candle is
// revised by a tick. A replay that rebuilds everything each day therefore "corrects" months-old results that nothing new was learned
// about (8 -> 11 Nov: 26 corrected, 11 removed, 8 added, about +23.6R, with no rule change). So a booked record that closed more
// than SETTLE before the END of the previous run is carried from the previous file exactly as it was booked, and no new record is
// started inside that settled stretch; only what is still open, what closed in the last SETTLE and what is new is computed from
// this run's candles. Nothing is edited: a carried record is the replay's own earlier booking, byte for byte.
// Everything is recomputed (and the run is written to the correction log as a rebuild) when ICT_REPLAY_REBUILD=on, when the
// replay's start date differs, or when the ICT code changed (`ruleCode`: a rule change must show over the whole history).
export const SETTLE = 3 * 86400;
export function rulesHash() { const h = crypto.createHash('sha256'); for (const f of ['tracker.mjs', 'calendar.mjs', 'replay.mjs']) h.update(fs.readFileSync(new URL('./' + f, import.meta.url))); return h.digest('hex').slice(0, 16); }
export function freezePlan(prev, o) {
  if (!prev || !Array.isArray(prev.trades)) return { on: false, why: 'no previous file: everything computed from this run\'s candles' };
  if (o.rebuild) return { on: false, rebuild: 'asked', why: 'rebuild asked for (ICT_REPLAY_REBUILD): everything recomputed from this run\'s candles' };
  if (prev.from !== o.from) return { on: false, rebuild: 'start', why: `replay start changed (${prev.from} -> ${o.from}): everything recomputed` };
  if (prev.ruleCode && prev.ruleCode !== o.ruleCode) return { on: false, rebuild: 'code', why: 'the ICT code changed since the previous file: everything recomputed' };
  const through = typeof prev.through === 'number' ? prev.through : Math.floor(Date.parse(prev.at) / 1000);
  if (!Number.isFinite(through)) return { on: false, why: 'the previous file has no date: everything computed from this run\'s candles' };
  return { on: true, cut: through - SETTLE, baseAt: prev.at || null, adopted: !prev.ruleCode,
    why: `booked records closed by ${new Date((through - SETTLE) * 1000).toISOString().slice(0, 16)}Z are carried from the file of ${prev.at} as booked; the feed returns different candles for old hours from run to run` };
}
// one stream of one market: `list` = its records in the previous file (null = nothing frozen)
export function freezer(list, cut) {
  const on = !!list && cut != null, frozen = new Map(), known = new Set(), st = { carried: 0, ignored: 0 };
  if (on) for (const t of list) { known.add(t.id); if (booked(t) && t.closed && t.closed <= cut) frozen.set(t.id, t); }
  st.carried = frozen.size;
  // true = do not compute this signal: its record is carried, or it would start a record the previous file does not have inside settled history
  const skip = (id, close) => { if (!on) return false; if (frozen.has(id)) return true; if (close <= cut && !known.has(id)) { st.ignored++; return true; } return false; };
  return { on, frozen, st, skip, carried: () => [...frozen.values()] };
}
const recId = (key, g, v) => `${key}-${g.side > 0 ? 'b' : 's'}-${g.t}${v ? '-' + v : ''}-r`;

// o (tests): data dir, now, from, history / paperHistory (fake feeds), markets / shadowMarkets, ruleCode, rebuild
export async function run(o = {}) {
  const DATA = o.data || DATA0, at = o.now || now, from = o.from || FROM, hist = o.history || history, paper = o.paperHistory || paperHistory;
  const MK = o.markets || MARKETS, SMK = o.shadowMarkets || SHADOW_MARKETS;
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return null; } };
  const PREV = rd('replay.json'), ruleCode = o.ruleCode || rulesHash(), fromDay = new Date(from * 1000).toISOString().slice(0, 10);
  const plan = freezePlan(PREV, { from: fromDay, ruleCode, rebuild: o.rebuild != null ? o.rebuild : process.env.ICT_REPLAY_REBUILD === 'on' });
  const FZ = { carried: {}, ignored: {}, shadowCarried: 0 };
  // a market the previous run could not read (its records were kept, its shadow lists left empty) is frozen only up to the last run
  // that did read it; a shadow stream that failed last time is recomputed whole
  const cutOf = (key, shadow) => { if (!plan.on) return null; const failed = PREV.errors && PREV.errors[key];
    if (shadow) return failed || Object.keys(PREV.shadowErrors || {}).some((k) => k.startsWith(key + '-')) ? null : plan.cut;
    if (!failed) return plan.cut; const c = PREV.marketThrough && PREV.marketThrough[key]; return typeof c === 'number' ? c - SETTLE : null; };
  const fz = (list, key, shadow) => { const cut = cutOf(key, shadow); return freezer(cut == null ? null : (list || []).filter((t) => t.market === key), cut); };
  const out = { at: o.now ? new Date(at * 1000).toISOString() : new Date().toISOString(), from: fromDay, ruleCode, src: {}, errors: {}, gaps: {}, marketThrough: {}, trades: [], shadow: [], shadowByVariant: Object.fromEntries(VARIANTS.map((v) => [v, []])) };
  for (const [key, M] of Object.entries(MK)) {
    try {
      const src = await hist(M);
      out.src[key] = { sym: src.sym, h1: src.H.length, m5: src.m5.length, m5from: src.m5from ? new Date(src.m5from * 1000).toISOString().slice(0, 10) : null, d1: src.D.length, d1Rolls: src.rolls,
        cnbcFrom: src.cnbcFrom ? new Date(src.cnbcFrom * 1000).toISOString().slice(0, 13) + 'Z' : null, fill: src.fill || null };   // the back-fill boundary and scale of THIS run
      const sig = signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => g.close >= from && g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
      const F = fz(PREV && PREV.trades, key), mine = [];
      let busyAll = 0, busyA = 0;   // same rule as the tracker: an A-setup is only blocked by an open A-setup
      // each A-setup carries the shadow variants' verdicts (vr), for the Coach's ICT filter verdicts; a failure here only loses the tags
      let vctx = null; try { vctx = { H: src.H, D: src.D, ms: await loadMeridian() }; } catch (e) { (out.shadowErrors = out.shadowErrors || {})[`${key}-vr`] = String(e.message || e); }
      for (const g of sig) { const a = isASetup(g, key); if (F.skip(recId(key, g), g.close)) continue; if (g.close < (a ? busyA : busyAll)) continue; const t = simulate(g, M, key, src, at); if (!t) { out.gaps[key] = (out.gaps[key] || 0) + 1; continue; } t.aset = a; t.aplus = isAPlus(g, key); t.size = a ? sizeOf(g, key) : 1;
        if (a && vctx) { try { t.vr = variantTags(g, key, vctx); } catch (e) {} }
        if (t.size !== 1 && t.R != null) { t.Rraw = t.R; t.R = +(t.R * t.size).toFixed(2); if (t.R2 != null) t.R2 = +(t.R2 * t.size).toFixed(2); }
        mine.push(t);
        const end = t.closed || Infinity; busyAll = Math.max(busyAll, end); if (a) busyA = end; }
      out.trades.push(...F.carried(), ...mine); out.marketThrough[key] = at; if (F.on) { FZ.carried[key] = F.st.carried; FZ.ignored[key] = F.st.ignored; }
      // shadow 'dip' (paper comparison only, research/edge/ict-index-longonly): its own stream with its own one-open-trade rule, size 1,
      // no break-even (simulate() skips break-even when the market has an aRule), gold exit. Kept in out.shadow, never in out.trades.
      if (SHADOW.dip.markets.includes(key)) { let busy = 0; const Fd = fz(PREV && PREV.shadow, key, true); out.shadow.push(...Fd.carried()); FZ.shadowCarried += Fd.st.carried;
        for (const g of sig) { if (g.close < busy || !isDip(g, key, src.D) || Fd.skip(recId(key, g, 'dip'), g.close)) continue; const t = simulate(g, { ...M, aRule: 'dip' }, key, src, at); if (!t) continue;
          Object.assign(t, { id: t.id.replace(/-r$/, '-dip-r'), shadow: true, variant: 'dip', aset: false, size: 1 }); out.shadow.push(t); busy = t.closed || Infinity; } }
      // shadow 'nofri' / 'h1opp' / 'strail' (paper comparison only): the A-setup rule plus one condition ('strail': the structure-trail
      // exit instead), each its own stream with its own one-open rule, A-setup sizing and break-even on indices, as the live tracker;
      // kept in out.shadowByVariant without the 72-candle path
      for (const v of VARIANTS) { if (!SHADOW[v].markets.includes(key)) continue;
        try { const ctx = { H: src.H, D: src.D, ms: v === 'h1opp' ? await loadMeridian() : null }; let busy = 0; const Fv = fz(PREV && PREV.shadowByVariant && PREV.shadowByVariant[v], key, true); out.shadowByVariant[v].push(...Fv.carried()); FZ.shadowCarried += Fv.st.carried;
          for (const g of sig) { if (g.close < busy || !variantRule(v, g, key, ctx) || Fv.skip(recId(key, g, v), g.close)) continue; const t = simulate(g, M, key, src, at, v === 'strail' ? { strail: [SHADOW.strail.from, SHADOW.strail.piv] } : {}); if (!t) continue;
            delete t.path; Object.assign(t, { id: t.id.replace(/-r$/, `-${v}-r`), shadow: true, variant: v, aset: true, aplus: isAPlus(g, key), size: sizeOf(g, key) });
            if (t.size !== 1 && t.R != null) { t.Rraw = t.R; t.R = +(t.R * t.size).toFixed(2); if (t.R2 != null) t.R2 = +(t.R2 * t.size).toFixed(2); }
            out.shadowByVariant[v].push(t); busy = t.closed || Infinity; }
        } catch (e) { (out.shadowErrors = out.shadowErrors || {})[`${key}-${v}`] = String(e.message || e); } }
      console.log(key, JSON.stringify(out.src[key]), 'signals', sig.length, 'trades', out.trades.filter((x) => x.market === key).length);
    } catch (e) { out.errors[key] = String(e.message || e); console.log(key, out.errors[key]); const c = PREV && PREV.marketThrough && PREV.marketThrough[key]; if (typeof c === 'number') out.marketThrough[key] = c; else delete out.marketThrough[key]; }
  }
  // paper-only markets (SHADOW_MARKETS, research/ict-markets.md): OANDA mid history through the site's market-data proxy, the market's
  // own variant stream in out.shadowByVariant[variant] (gold-rule sizing and exits, one open trade at a time). Never in out.trades.
  out.paperVariants = Object.values(SMK).map((M) => M.variant);   // variants that are other markets, not filters of the A-stream
  for (const [key, M] of Object.entries(SMK)) {
    const v = M.variant;
    try {
      const src = await paper(M);
      (out.shadowSrc = out.shadowSrc || {})[key] = { sym: `oanda ${M.md}`, h1: src.H.length, m5: src.m5.length, d1: src.D.length };
      const sig = signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => g.close >= from && g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
      let busy = 0; const Fp = fz(PREV && PREV.shadowByVariant && PREV.shadowByVariant[v], key, true), got = [];
      for (const g of sig) { if (g.close < busy || !variantRule(v, g, key, src) || Fp.skip(recId(key, g, v), g.close)) continue; const t = simulate(g, M, key, src, at); if (!t) continue;
        delete t.path; Object.assign(t, { id: t.id.replace(/-r$/, `-${v}-r`), shadow: true, variant: v, paperMarket: true, aset: true, aplus: false, size: 1 });
        got.push(t); busy = t.closed || Infinity; }
      (out.shadowByVariant[v] = out.shadowByVariant[v] || []).push(...Fp.carried(), ...got); FZ.shadowCarried += Fp.st.carried;
      console.log(key, 'paper', JSON.stringify(out.shadowSrc[key]), 'signals', sig.length, 'trades', out.shadowByVariant[v].length);
    } catch (e) { (out.shadowErrors = out.shadowErrors || {})[`${key}-${v}`] = String(e.message || e); console.log(key, 'paper', String(e.message || e)); }
  }
  // a market whose feed failed this run keeps the records of the file being replaced (11 Nov 2026): missing coverage is not a
  // correction, and a failed download must never empty the record. They stay exactly as they were, unresolved ones included.
  for (const key of Object.keys(out.errors)) { const keep = ((PREV && PREV.trades) || []).filter((t) => t.market === key); if (!keep.length) continue;
    out.trades = out.trades.filter((t) => t.market !== key).concat(keep); (out.kept = out.kept || {})[key] = keep.length; console.log(key, 'feed failed: kept', keep.length, 'records of the previous file'); }
  out.trades.sort((a, b) => a.opened - b.opened);
  const C = out.trades.filter((x) => x.closed);
  const CA = C.filter((x) => x.aset);
  out.totalsA = { n: CA.length, wins: CA.filter((x) => x.R > 0).length, R: +CA.reduce((a, x) => a + x.R, 0).toFixed(2) };
  out.shadow.sort((a, b) => a.opened - b.opened);
  { const SC = out.shadow.filter((x) => x.closed); out.totalsDip = { n: SC.length, wins: SC.filter((x) => x.R > 0).length, R: +SC.reduce((a, x) => a + x.R, 0).toFixed(2) }; }
  out.totalsByVariant = {};
  for (const [v, a] of [['dip', out.shadow], ...Object.entries(out.shadowByVariant)]) { a.sort((x, y) => x.opened - y.opened); const SC = a.filter((x) => x.closed);
    out.totalsByVariant[v] = { n: SC.length, wins: SC.filter((x) => x.R > 0).length, R: +SC.reduce((q, x) => q + x.R, 0).toFixed(2) }; }
  { const tl = tally(out.trades); out.totals = { n: tl.n, wins: tl.wins, losses: tl.losses, be: tl.be, nearFlat: tl.nearFlat, open: tl.open, R: tl.R, R2: +C.reduce((a, x) => a + (x.R2 ?? x.R), 0).toFixed(2) }; }
  out.outcome = { rule: 'sign of the stored per-unit R (Rraw, else R) of a closed record', nearFlat: NEAR_FLAT };
  // what was carried and why (frozen history, above). `gaps` counts only the signals this run computed.
  out.frozen = plan.on ? { on: true, cut: plan.cut, settleDays: SETTLE / 86400, baseAt: plan.baseAt, ...(plan.adopted ? { adopted: true } : {}), why: plan.why, carried: FZ.carried, ignored: FZ.ignored, shadowCarried: FZ.shadowCarried }
    : { on: false, ...(plan.rebuild ? { rebuild: plan.rebuild } : {}), why: plan.why };
  out.through = at;   // candles up to here were read; an unresolved record carries its own `through`
  fs.mkdirSync(DATA, { recursive: true });
  // what this run changes against the file it replaces goes to the correction log first
  // a rebuild is always written to the log, also when it changed nothing (that is the proof the history is stable)
  try { const entry = replayDiff(PREV, out, out.at); if (out.kept) entry.kept = out.kept;
    if (plan.rebuild) { entry.rebuild = plan.rebuild; entry.changed = true; } else if (plan.on) entry.frozen = { cut: plan.cut, carried: Object.values(FZ.carried).reduce((a, n) => a + n, 0) };
    const lg = appendLog(rd('replay-log.json'), entry);
    if (entry.changed) { fs.writeFileSync(path.join(DATA, 'replay-log.json'), JSON.stringify(lg)); console.log('log', JSON.stringify({ rebuild: entry.rebuild || null, resolved: entry.resolved, corrected: entry.corrected.length, removed: entry.removed.length, added: entry.added })); }
  } catch (e) { console.log('replay log:', String(e.message || e)); }
  fs.writeFileSync(path.join(DATA, 'replay.json'), JSON.stringify(out));
  console.log('frozen', JSON.stringify(out.frozen));
  console.log('totals', JSON.stringify(out.totals), 'A', JSON.stringify(out.totalsA), 'shadow', JSON.stringify(out.totalsByVariant));
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('replay.mjs')) await run();
