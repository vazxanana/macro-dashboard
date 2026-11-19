// Builds council/consensus-history.json from the community copy of the Forex Factory calendar
// (Hugging Face dataset Ehsanrs2/Forex_Factory_Calendar, file forex_factory_cache.csv, 2007 to 7 Apr 2025, tagged MIT by its
// uploader). Keeps only US releases of the red folder study's types (council/redfolder.mjs typeOf) from 2018, and only the
// calendar's own consensus ("Forecast"), actual and previous, as printed. Run by hand:
//   node scripts/consensus-history.mjs <path to forex_factory_cache.csv>
// The CSV is untrusted data: it is parsed as text, nothing in it is run.
import fs from 'node:fs';
import { typeOf } from '../council/redfolder.mjs';
import { zonedToUtc } from '../council/events.mjs';

// The dataset's clock is not reliable: about half the rows carry 00:00 in place of the release time, and its UTC offset is that
// of the collector's display zone. The DATE in the timestamp, read in that zone, is the release day in New York for every
// US release (08:30 ET is 16:00-17:00 there, 14:00 ET 21:30-22:30), so each row is put on its release's own New York time
// on that date: 08:30 for every type but the ISM (10:00) and the Fed decision (14:00). The two unscheduled Fed moves of March
// 2020 carry no consensus and are left out (their time is not 14:00).
const ET = (title) => (/ISM/i.test(title) ? '10:00' : /Funds Rate/i.test(title) ? '14:00' : '08:30');
export function releaseAt(title, raw) {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(String(raw || '')); if (!m) return null;
  const wd = new Date(m[1] + 'T12:00:00Z').getUTCDay(); if (wd === 0 || wd === 6) return null;
  return zonedToUtc(m[1], ET(title), 'America/New_York');
}

export function parseCsv(text) {
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.length > 1 || row[0]) out.push(row); row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

export function pick(rows, from = '2018-01-01') {
  const [h, ...body] = rows, ix = Object.fromEntries(h.map((k, i) => [k.trim(), i])), seen = new Set(), out = [];
  for (const r of body) {
    const title = (r[ix.Event] || '').trim(), cur = (r[ix.Currency] || '').trim();
    if (cur !== 'USD' || !typeOf(title, 'USD')) continue;
    if (/Funds Rate/i.test(title) && !(r[ix.Forecast] || '').trim()) continue;
    const u = releaseAt(title, r[ix.DateTime]); if (u == null) continue;
    const at = new Date(u * 1000).toISOString().replace('.000Z', 'Z'); if (at < from) continue;
    const k = title + '|' + at; if (seen.has(k)) continue; seen.add(k);
    const v = (c) => { const s = (r[ix[c]] || '').trim(); return s || null; };
    out.push([title, at, v('Forecast'), v('Actual'), v('Previous')]);
  }
  return out.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1));
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const rows = pick(parseCsv(fs.readFileSync(process.argv[2], 'utf8')));
  const doc = { v: 1, source: 'Forex Factory via a community dataset',
    dataset: 'huggingface.co/datasets/Ehsanrs2/Forex_Factory_Calendar (forex_factory_cache.csv)', license: 'MIT, as tagged by the uploader',
    note: 'The economic-calendar consensus (Forex Factory "Forecast"), actual and previous as the calendar showed them; collected by a third party, not checked against the agencies. A calendar consensus, not a verified survey.',
    from: rows.length ? rows[0][1] : null, to: rows.length ? rows[rows.length - 1][1] : null,
    cols: ['title', 'at', 'consensus', 'actual', 'previous'], rows };
  fs.writeFileSync(new URL('../council/consensus-history.json', import.meta.url), JSON.stringify(doc).replace(/\],\[/g, '],\n[') + '\n');
  console.log(rows.length, 'rows', doc.from, '→', doc.to);
}
