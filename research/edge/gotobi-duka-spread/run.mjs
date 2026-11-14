// Edge research · gotobi-duka-spread: the gotobi T2 fade (sell at 00:55 UTC on gotobi days, buy back at 06:00 UTC) filled on
// Dukascopy BID and ASK minute candles (PREREGISTRATION.md). Step 1 is a coverage probe: one BID and one ASK minute file per
// symbol on three gotobi days. The pre-registration says the study stops there when the host cannot be reached, with no
// figure of the measurement or the test; this file runs that probe and writes result.json and RESULT.md.
//   node --use-env-proxy research/edge/gotobi-duka-spread/run.mjs          (probe, writes the report)
//   node research/edge/gotobi-duka-spread/run.mjs --from-result           (rebuilds RESULT.md from result.json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const HOST = 'https://datafeed.dukascopy.com/datafeed';
export const SYMBOLS = ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY'];
export const SIDES = ['BID', 'ASK'];
export const PROBE_DAYS = ['2010-01-05', '2016-02-05', '2026-11-10'];   // gotobi days of 2010, 2016 and 2026 (the frozen calendar)
const p2 = (n) => String(n).padStart(2, '0');

// the Dukascopy minute file of one symbol, side and UTC day (months 0-based in the path)
export function minuteUrl(sym, side, ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${HOST}/${sym}/${y}/${p2(m - 1)}/${p2(d)}/${side}_candles_min_1.bi5`;
}
export function probeUrls() {
  const out = [];
  for (const day of PROBE_DAYS) for (const sym of SYMBOLS) for (const side of SIDES) out.push({ day, sym, side, url: minuteUrl(sym, side, day) });
  return out;
}

// one request: node fetch (through the environment's proxy when run with --use-env-proxy), then curl; the answer is what
// happened, never a guess. ok = an HTTP 200 with a body.
async function tryFetch(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: '*/*' } });
    const buf = Buffer.from(await r.arrayBuffer());
    return { via: 'fetch', status: r.status, bytes: buf.length };
  } catch (e) {
    return { via: 'fetch', status: null, error: `${e.message}${e.cause ? ` (${e.cause.code || ''} ${e.cause.message || e.cause})`.replace(/\(\s+/, '(').replace(/\s+\)/, ')') : ''}` };
  }
}
function tryCurl(url) {
  const tmp = path.join(os.tmpdir(), `gds-${process.pid}-${Math.random().toString(36).slice(2)}`);
  try {
    const out = execFileSync('curl', ['-sS', '--max-time', '20', '-o', tmp, '-w', '%{http_code}', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { via: 'curl', status: +out || null, bytes: fs.existsSync(tmp) ? fs.statSync(tmp).size : 0 };
  } catch (e) {
    return { via: 'curl', status: null, error: String(e.stderr || e.message || e).split('\n').filter(Boolean)[0] || 'curl failed' };
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}
async function probeOne(u) {
  const a = await tryFetch(u.url);
  if (a.status === 200 && a.bytes > 0) return { ...u, ok: true, tries: [a] };
  const b = tryCurl(u.url);
  return { ...u, ok: b.status === 200 && b.bytes > 0, tries: [a, b] };
}

// the probe's outcome under the pre-registration: not reachable when every file fails (nothing arrived on either side)
export function classifyProbe(rows) {
  const ok = rows.filter((r) => r.ok), bySide = Object.fromEntries(SIDES.map((s) => [s, rows.filter((r) => r.side === s && r.ok).length]));
  const errors = [...new Set(rows.flatMap((r) => r.tries.map((t) => t.error || (t.status ? `HTTP ${t.status}` : null))).filter(Boolean))];
  if (!ok.length) return { reachable: false, ok: 0, of: rows.length, bySide, errors };
  return { reachable: true, ok: ok.length, of: rows.length, bySide, errors };
}

export function verdictOf(probe) {
  if (!probe.reachable) return `NOT MEASURABLE (inconclusive: Dukascopy's datafeed host refused every connection from this build sandbox, ${probe.of} of ${probe.of} probe files failed; no bid / ask candle could be read)`;
  return null;   // reachable: the measurement and the test run under the pre-registration (not reached in this run)
}

export function report(o) {
  const L = [], P = o.probe;
  L.push('# Gotobi on bid and ask: the fade after the 09:55 Tokyo fix filled on the side that trades', '');
  L.push(`**Verdict: ${o.verdict}.** The pre-registered coverage probe (step 1) asked for ${P.of} Dukascopy minute files (BID and ASK, ${SYMBOLS.length} yen pairs, ${PROBE_DAYS.length} gotobi days) and received ${P.ok}. By the pre-registration the study stops here: no spread at 00:55 or 06:00 UTC, no bid / ask trade, no feed check and no placebo was computed, and no other source was put in Dukascopy's place. The gotobi T2 result and \`gotobi-cost\`'s break-evens (3.73 pips a round trip at net 0, 1.95 at month t 2 on USD/JPY 2016-now; 3.20 / 1.81 on the crosses pooled) stand as they were, still on unmeasured spreads. Pre-registered in PREREGISTRATION.md (first commit of the branch); the rule is frozen.mjs, byte for byte (sha256 \`${o.frozen.sha256}\`). Paper research only; nothing live changed.`, '');
  L.push('## Coverage probe', '');
  L.push(`Run ${o.probedAt} from the build sandbox with \`node --use-env-proxy\` (node fetch through the environment's HTTPS proxy, then curl through the same proxy).`, '');
  L.push('| Day | Symbol | BID | ASK |', '|---|---|---|---|');
  const cell = (r) => (r.ok ? `ok (${r.tries.at(-1).bytes} bytes)` : `failed: ${r.tries.map((t) => `${t.via} ${t.error || `HTTP ${t.status}`}`).join('; ')}`);
  for (const day of PROBE_DAYS) for (const sym of SYMBOLS) {
    const b = o.rows.find((r) => r.day === day && r.sym === sym && r.side === 'BID'), a = o.rows.find((r) => r.day === day && r.sym === sym && r.side === 'ASK');
    L.push(`| ${day} | ${sym} | ${cell(b)} | ${cell(a)} |`);
  }
  L.push('', `Distinct failures: ${P.errors.map((e) => `\`${e}\``).join(', ') || 'none'}.`, '');
  L.push('## What was not computed, and why', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

export const NOTES = [
  'Measurement A (the quoted spread at 00:55 and 06:00 UTC by pair and year, gotobi against other days, and the one-minute mid change), Test B (the frozen T2 signals on mid, filled at BID / bought back at ASK, commission USD 22.5 per million a side, plus 0.3 pip a side of extra slippage; streams USD/JPY 2016-now, USD/JPY 2010-15, crosses pooled 2010-now; Holm), the feed check against gotobi-cost/trades.json and the 40-seed placebo: none was run, because no candle could be read.',
  'Not substituted, on purpose: OANDA through the site\'s candle proxy is mid only (api/bars.js asks for price "M"; api/ was not changed); council-data\'s HistData USD/JPY M1 files (2018-2026) carry one side only, so no spread can be taken from them; the crosses have no minute file in council-data at all.',
  'The proxy\'s own log named the refusal for every request: "connect_rejected", the gateway answering 403 to CONNECT datafeed.dukascopy.com:443 (also www.dukascopy.com and freeserv.dukascopy.com). Dukascopy itself was never reached, so this says nothing about whether it serves these files: council-data\'s research/probe/cnbc2/duka.txt shows a GitHub Actions runner received a Dukascopy file (HTTP 200) earlier.',
  'One departure from the order in the brief, said plainly: a few reachability requests (the USDJPY BID and ASK minute files and the 00h tick file of 5 Jan 2016, and the home pages of www.dukascopy.com and freeserv.dukascopy.com) were made before PREREGISTRATION.md was written, and all were refused the same way; nothing was downloaded, so no figure could have shaped the pre-registration.',
  'How to run it where the host is reachable: a runner that can reach datafeed.dukascopy.com (a GitHub Actions job, as the ICT back-fills used) runs the pre-registered steps 1-5 unchanged, with the minute files cached outside git; this probe script then reports them reachable and stops without a verdict, so the measurement code must be added under this same pre-registration before any figure is read.',
];

async function main() {
  const args = process.argv.slice(2);
  let o;
  if (args[0] === '--from-result') o = JSON.parse(fs.readFileSync(path.join(HERE, 'result.json'), 'utf8'));
  else {
    const rows = [];
    for (const u of probeUrls()) rows.push(await probeOne(u));
    const probe = classifyProbe(rows), verdict = verdictOf(probe);
    if (!verdict) { console.log('Dukascopy reachable:', probe.ok, 'of', probe.of, '- run the pre-registered steps 2-5; no verdict written'); return; }
    const sha = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(path.join(HERE, 'frozen.mjs'))).digest('hex');
    o = {
      study: 'gotobi-duka-spread', built: '2026-11-14', verdict, probedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      original: { branch: 'gotobi', commit: '5f341e069', test: 'T2', pr: 878, replication: 889, cost: 'gotobi-cost' },
      frozen: { file: 'frozen.mjs', from: 'research/edge/gotobi-cost/frozen.mjs', sha256: sha },
      data: { source: 'Dukascopy BID and ASK minute candles', host: HOST, symbols: SYMBOLS, probeDays: PROBE_DAYS, gotobi: PROBE_DAYS.every((d) => F.gotobiSet(2010, 2026).has(d)) },
      probe, rows: rows.map((r) => ({ day: r.day, sym: r.sym, side: r.side, ok: r.ok, tries: r.tries })),
      computed: { measurementA: null, testB: null, feedCheck: null, placebo: null },
      notes: NOTES,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n');
  }
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(o));
  console.log(o.verdict);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
