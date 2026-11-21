// The desks' stored records, kept light (21 Nov 2026). Each desk file held every trade's log and chart marks (three quarters
// of mosha/desk.json's 20 MB), so opening a desk on a phone downloaded and parsed all of them. Now:
//   <desk>/desk.json            every record WITHOUT `log` and `marks`, plus `detail: { dir, by: 'day' }`
//   <desk>/detail/<YYYY-MM-DD>.json   { <record id>: { log, marks } } for the records whose entry `t` falls on that UTC day
// The page reads desk.json, and one day file only when a trade's log or chart is opened. The trackers read the whole record
// back with readDesk (a day file that is missing or does not parse stops the run: a write from a part could lose logs).
// A desk.json of the older shape (records with their logs) is read as it is. A day file is written only when it changes, and
// one no record points at any more is removed. Paper records only; nothing here trades.
import fs from 'node:fs';
import path from 'node:path';
import { writeAtomic, writeIfChanged } from './jsonio.mjs';

export const PARTS = ['log', 'marks'];
export const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const DAY_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

// { lite, days: { 'YYYY-MM-DD': { id: { log, marks } } } }
export function split(out, name) {
  const days = {}, records = [];
  for (const r of out.records || []) {
    const { log, marks, ...rest } = r; records.push(rest);
    if ((log && log.length) || (marks && marks.length)) { const d = dayOf(r.t); (days[d] || (days[d] = {}))[r.id] = { log: log || [], marks: marks || [] }; }
  }
  return { lite: { ...out, detail: { dir: name + '/detail', by: 'day' }, records }, days };
}

// the stored record of one desk with every log and mark joined back, or null when there is none
export function readDesk(dir, name) {
  const file = path.join(dir, name, 'desk.json');
  if (!fs.existsSync(file)) return null;
  let j; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error(`${name}/desk.json does not parse: left as it is`); }
  if (!j || !Array.isArray(j.records) || !j.detail) return j;
  const cache = {};
  const day = (d) => { if (d in cache) return cache[d];
    const f = path.join(dir, name, 'detail', d + '.json');
    if (!fs.existsSync(f)) return (cache[d] = null);
    try { return (cache[d] = JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { throw new Error(`${name}/detail/${d}.json does not parse: left as it is`); } };
  j.records = j.records.map((r) => { const x = (day(dayOf(r.t)) || {})[r.id]; return x ? { ...r, log: x.log || [], marks: x.marks || [] } : { ...r, log: [], marks: [] }; });
  delete j.detail;
  return j;
}

// writes the light desk.json and the day files; returns { written, removed } (day files)
export function writeDesk(dir, name, out) {
  const { lite, days } = split(out, name), ddir = path.join(dir, name, 'detail');
  let written = 0, removed = 0;
  fs.mkdirSync(ddir, { recursive: true });
  for (const [d, o] of Object.entries(days)) if (writeIfChanged(path.join(ddir, d + '.json'), JSON.stringify(o))) written++;
  writeAtomic(path.join(dir, name, 'desk.json'), JSON.stringify(lite));   // before any removal: a kill in between leaves a day file too many, never one too few
  for (const f of fs.readdirSync(ddir)) if (DAY_RE.test(f) && !days[f.slice(0, 10)]) { fs.rmSync(path.join(ddir, f), { force: true }); removed++; }
  return { written, removed };
}
