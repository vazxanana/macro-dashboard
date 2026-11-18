// Files two api/ handlers read from the project on Node and Vercel (vercel.json `includeFiles`), bundled into the Worker,
// which has no project files. wrangler.jsonc `rules` makes each file below a text module: a string inside the Worker's
// script, never a static asset, so only the handlers' own checks decide what leaves the API.
//   Academy  the registry and the generated files api/academy.js reads (./academy-data.mjs reads them the same way).
//            Outcomes stay behind the API's "decide first" check; nothing of academy/archive/ is imported.
//   Bridge   the two EA sources api/bridge.js hands to the owner.
// The handlers take them through useData / useFiles; on Node and Vercel nothing calls those and the disk is read as before.
import academy from '../../api/academy.js';
import bridge from '../../api/bridge.js';
import { EDGES } from '../../academy/edges.mjs';
import { bundledData } from './academy-data.mjs';

import calendar from '../../academy/data/calendar.json';
import research from '../../academy/data/research.json';
import evaluation from '../../academy/data/eval.json';
import training from '../../ml/models/index.json';
import candReplica from '../../academy/data/cand-replica.json';
import outReplica from '../../academy/data/out-replica.json';
import featReplica from '../../academy/data/feat-replica.json';
import candMoshaBo from '../../academy/data/cand-mosha-bo.json';
import outMoshaBo from '../../academy/data/out-mosha-bo.json';
import featMoshaBo from '../../academy/data/feat-mosha-bo.json';
import candGtrend from '../../academy/data/cand-gtrend.json';
import outGtrend from '../../academy/data/out-gtrend.json';
import featGtrend from '../../academy/data/feat-gtrend.json';
import candGtl from '../../academy/data/cand-gtl.json';
import outGtl from '../../academy/data/out-gtl.json';
import featGtl from '../../academy/data/feat-gtl.json';
import candGeg from '../../academy/data/cand-geg.json';
import outGeg from '../../academy/data/out-geg.json';
import featGeg from '../../academy/data/feat-geg.json';
import candGmp from '../../academy/data/cand-gmp.json';
import outGmp from '../../academy/data/out-gmp.json';
import featGmp from '../../academy/data/feat-gmp.json';
import candNqOpen from '../../academy/data/cand-nq-open.json';
import outNqOpen from '../../academy/data/out-nq-open.json';
import featNqOpen from '../../academy/data/feat-nq-open.json';

import eaMt5 from '../../mt5/CouncilBridge.mq5';
import eaCtrader from '../../ctrader/CouncilBridge.cs';

export const ACADEMY_TEXTS = {
  'academy/data/calendar.json': calendar,
  'academy/data/research.json': research,
  'academy/data/eval.json': evaluation,
  'ml/models/index.json': training,
  'academy/data/cand-replica.json': candReplica,
  'academy/data/out-replica.json': outReplica,
  'academy/data/feat-replica.json': featReplica,
  'academy/data/cand-mosha-bo.json': candMoshaBo,
  'academy/data/out-mosha-bo.json': outMoshaBo,
  'academy/data/feat-mosha-bo.json': featMoshaBo,
  'academy/data/cand-gtrend.json': candGtrend,
  'academy/data/out-gtrend.json': outGtrend,
  'academy/data/feat-gtrend.json': featGtrend,
  'academy/data/cand-gtl.json': candGtl,
  'academy/data/out-gtl.json': outGtl,
  'academy/data/feat-gtl.json': featGtl,
  'academy/data/cand-geg.json': candGeg,
  'academy/data/out-geg.json': outGeg,
  'academy/data/feat-geg.json': featGeg,
  'academy/data/cand-gmp.json': candGmp,
  'academy/data/out-gmp.json': outGmp,
  'academy/data/feat-gmp.json': featGmp,
  'academy/data/cand-nq-open.json': candNqOpen,
  'academy/data/out-nq-open.json': outNqOpen,
  'academy/data/feat-nq-open.json': featNqOpen,
};
export const BRIDGE_TEXTS = {
  'mt5/CouncilBridge.mq5': eaMt5,
  'ctrader/CouncilBridge.cs': eaCtrader,
};

academy.useData(bundledData(ACADEMY_TEXTS, EDGES));
bridge.useFiles(BRIDGE_TEXTS);
