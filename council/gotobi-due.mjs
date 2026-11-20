// Gotobi trigger from the council loop (20 Nov 2026): should the loop start gotobi.yml now?
// The gotobi job (council/gotobi.mjs, owner decision item 61) must be running before 00:55 UTC on a gotobi morning. Its two
// GitHub crons (00:22, 00:37) fire late at times (20 Nov: no run by 00:31, the morning was missed), and the Worker's timer
// (api/_gotobi-kick.js) needs GH_DISPATCH_TOKEN, which is not set (the 20 Nov deploy log: "skip GH_DISPATCH_TOKEN"). The loop
// already has actions: write, so after each round it asks this file and dispatches when the answer is yes. The same window and
// rules as the Worker's (its `decide`, imported): a weekday 00:25-00:49 UTC, no gotobi run queued or running, none started in
// the last 60 minutes; and, here, only on a gotobi day (the study's calendar). This file only DECIDES and only READS (one GET
// of the run list): it starts nothing, writes nothing and touches no order. Not sure is "no".
//   node council/gotobi-due.mjs     exit 0 = due (the caller dispatches), exit 1 = not due or not sure
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isGotobi } from './gotobi-calendar.mjs';

const require = createRequire(import.meta.url);
const K = require('../api/_gotobi-kick.js');

export async function main({ env = process.env, now = Date.now(), fetchFn = fetch } = {}) {
  if (!K.inWindow(now)) return { due: false, why: 'outside 00:25-00:49 UTC on a weekday' };
  const day = new Date(now).toISOString().slice(0, 10);   // 00:25-00:49 UTC is 09:25-09:49 in Tokyo: the same date
  if (!isGotobi(day)) return { due: false, why: `${day} is not a gotobi day` };
  const runs = await K.listRuns({ token: env.GH_TOKEN || env.GITHUB_TOKEN, fetchFn });
  const d = K.decide({ runs, now });
  return { due: d.start, why: d.why };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((d) => { console.log(`Gotobi trigger: ${d.due ? 'DUE' : 'not due'} (${d.why})`); process.exit(d.due ? 0 : 1); }, () => process.exit(1));
}
