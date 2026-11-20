// Prep record (20 Nov 2026): a forward record of one question, "did the Cleveland Fed nowcast point the right way against the
// calendar consensus?". The Week ahead puts the nowcast beside the consensus before each US CPI / PCE release (week-ahead.mjs
// `prepFor`); nobody has measured whether the side the model leans to is the side the print lands on. This module keeps that
// score honestly, in the veteran's capture discipline (macro/veteran-expectations.json):
//  - capture: the FIRST time a release still in the future is seen with a consensus and a nowcast, one record is appended and
//    never edited again (a later nowcast or consensus goes to `last`, clearly apart; the judged side is the first capture's);
//  - resolve: once the nowcast file shows the month's "Actual" print for that series, the result is attached once and never
//    rewritten (a later revision of the print changes nothing);
//  - score: hits out of judged, "too few to judge" under MIN_JUDGE, else the hit rate with a two-sided binomial p against 50 %.
// Pure functions (inputs handed in, clock `now`), plus `updateFile` for the one append-only file. A record, not a rule: no
// forecast, call, size or trade reads it, and a good hit rate here is a forward record, not a tested edge.
import { readJson, writeIfChanged } from './jsonio.mjs';

export const IN_LINE = 0.05, MIN_JUDGE = 20;   // IN_LINE = week-ahead.mjs IN_LINE (a test compares them)
export const LABEL = 'Forward record: the Cleveland Fed nowcast against the calendar consensus before US CPI / PCE releases, captured once before the release and resolved once on the first print on file. Append-only; not a tested edge.';
const SERIES = { CPI: ['cpi', 'coreCpi'], PCE: ['pce', 'corePce'] };
const iso = (t) => new Date(t * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
const sideOf = (x, cons) => Math.abs(x - cons) < IN_LINE - 1e-9 ? 'in line' : x > cons ? 'above' : 'below';
const listOf = (prev) => (Array.isArray(prev) ? prev : prev && Array.isArray(prev.records) ? prev.records : []);

// '<type>:<nowcast month, else the release's UTC day>:<core|headline>'
export function idOf(r) {
  const key = r.nowcast && /^\d{4}-\d{2}$/.test(r.nowcast.month || '') ? r.nowcast.month : new Date(r.t * 1000).toISOString().slice(0, 10);
  return `${r.type}:${key}:${r.prep.core ? 'core' : 'headline'}`;
}

// Add one record per release of the Week ahead build that carries `prep` and is still to come. Returns a NEW list; the records
// already there are returned as they are, except `last` (the latest pre-release reading, when it differs from the one before).
export function capture(prev, wa, now) {
  const out = listOf(prev).slice(), at = new Map(out.map((x, i) => [x.id, i]));
  const rels = wa && Array.isArray(wa.days) ? wa.days.flatMap((d) => (d && Array.isArray(d.releases) ? d.releases : [])) : [];
  for (const r of rels) {
    const p = r && r.prep;
    if (!p || !SERIES[r.type] || !Number.isFinite(r.t) || !(r.t > now)) continue;
    if (!Number.isFinite(p.nowcast) || !Number.isFinite(p.consensus) || !p.side) continue;
    if (/y\/y|year/i.test(r.title || '')) continue;   // the nowcast is month on month: a yearly consensus is another quantity
    const id = idOf(r), read = { nowcast: p.nowcast, consensus: p.consensus, gap: p.gap, side: p.side };
    if (!at.has(id)) {
      at.set(id, out.length);
      out.push({ id, type: r.type, core: !!p.core, month: (r.nowcast && r.nowcast.month) || null, title: String(r.title || '').slice(0, 80), t: r.t, capturedAt: iso(now), ...read });
      continue;
    }
    const i = at.get(id), x = out[i];
    if (x.actual != null || !(x.t > now)) continue;   // resolved or released: nothing more is read
    const cur = x.last || x;
    if (cur.nowcast !== read.nowcast || cur.consensus !== read.consensus) out[i] = { ...x, last: { at: iso(now), ...read } };
  }
  return out;
}

// Attach the first print once: the nowcast file's "Actual" for the record's month and series, read after the release time.
// The print is compared as published (one decimal) with the captured consensus; hit = the captured side was the print's side
// (null when the capture was in line: the model leaned nowhere, so there is nothing to judge).
export function resolve(records, hd, now) {
  const N = hd && hd.nowcast && Array.isArray(hd.nowcast.months) ? hd.nowcast.months : [];
  return listOf(records).map((x) => {
    if (!x || x.actual != null || !x.month || !SERIES[x.type] || !(now >= x.t)) return x;
    const m = N.find((y) => y && y.month === x.month), k = SERIES[x.type][x.core ? 1 : 0];
    const a = m && m.actual ? m.actual[k] : null; if (a == null || !Number.isFinite(a)) return x;
    const print = Math.round(a * 10) / 10, actualSide = sideOf(print, x.consensus);
    return { ...x, actual: a, print, actualSide, hit: x.side === 'in line' ? null : x.side === actualSide, resolvedAt: iso(now) };
  });
}

// two-sided exact binomial p against 50 %: the probability of a count at least as unlikely as k of n
export function binomP(k, n) {
  if (!(n > 0)) return null;
  const pm = []; let c = 1;
  for (let i = 0; i <= n; i++) { pm.push(c * Math.pow(0.5, n)); c = c * (n - i) / (i + 1); }
  let p = 0; for (const q of pm) if (q <= pm[k] * (1 + 1e-9)) p += q;
  return Math.min(1, p);
}

export function score(records) {
  const L = listOf(records), res = L.filter((x) => x.actual != null), J = res.filter((x) => x.hit === true || x.hit === false);
  const hits = J.filter((x) => x.hit).length, n = J.length, out = { captured: L.length, resolved: res.length, judged: n, hits,
    inLine: res.length - n, open: L.length - res.length, minJudge: MIN_JUDGE, rate: null, p: null };
  if (n < MIN_JUDGE) out.text = `Nowcast against consensus: too few to judge (n ${n}); ${L.length} captured, ${res.length} resolved. A forward record, not a tested edge.`;
  else {
    out.rate = Math.round(hits / n * 1000) / 1000; out.p = Math.round(binomP(hits, n) * 1000) / 1000;
    out.text = `Nowcast against consensus: the nowcast pointed the right way on ${hits} of ${n} releases (${Math.round(hits / n * 100)}%), two-sided binomial p ${out.p < 0.001 ? 'under 0.001' : out.p.toFixed(3)} against 50%; a forward record, not a tested edge.`;
  }
  return out;
}

// The file step: read macro/prep-record.json, resolve, capture, write only on a change. A file that exists but does not parse is
// never overwritten (nothing is captured that run; returns { error }). Returns { score, records, written } otherwise.
export function updateFile(file, wa, hd, now) {
  const f = readJson(file, null);
  if (f.state === 'corrupt') return { error: `the file does not parse (${f.error}); left as it is, nothing recorded` };
  if (f.state === 'ok' && !Array.isArray(f.value) && !(f.value && Array.isArray(f.value.records))) return { error: 'the file has no records list; left as it is, nothing recorded' };
  const records = capture(resolve(f.value, hd, now), wa, now);
  const written = (f.state === 'ok' || records.length > 0) && writeIfChanged(file, JSON.stringify({ v: 1, label: LABEL, records }, null, 1));
  return { score: score(records), records, written };
}
