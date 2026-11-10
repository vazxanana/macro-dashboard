// MeridianX Academy: the release calendar the page uses, written once so the page and the dataset read the same list.
//
//   node academy/gen/calendar.mjs      ->  academy/data/calendar.json
//
// The list is the one academy/gen/features.mjs gives every dataset row (CPI, payrolls and FOMC from January 2022, read from
// council/events.mjs, which is only read here). Each item is { t, title, impact }: the scheduled time of a public release,
// never its result. Deterministic: the same calendar gives the same file.
import { calendar } from './features.mjs';
import { writeJson } from './study.mjs';

const cal = await calendar();
writeJson('calendar.json', { source: 'council/events.mjs (read only)', types: cal.types, from: cal.from, to: cal.to, n: cal.n, hash: cal.hash,
  note: 'Scheduled release times only. A snapshot at t may hold releases of the last 7 days (events) and those due within 72 hours (schedule); outside from..to it holds neither.', items: cal.items });
console.log(`calendar.json: ${cal.n} releases, ${new Date(cal.from * 1000).toISOString().slice(0, 10)} to ${new Date(cal.to * 1000).toISOString().slice(0, 10)}, hash ${cal.hash}`);
