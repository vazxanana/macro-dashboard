// Mosha structure engine for the council trader (Node). Generated from the market-structure page
// (scratchpad gen_engine.py): the same msAnalyze + setup rules, so the always-on trader and the page agree.
// ═══ MOSHA STRUCTURE ENGINE (pure functions, no DOM) ═══
function msAnalyze(bars, N) {
  const H = bars.map(b=>b.high), L = bars.map(b=>b.low), C = bars.map(b=>b.close), n = bars.length;
  const maxIn = (a,b) => { let m=-Infinity, k=a; for (let j=a;j<=b;j++) if (H[j]>m){m=H[j];k=j;} return [m,k]; };
  const minIn = (a,b) => { let m=Infinity, k=a; for (let j=a;j<=b;j++) if (L[j]<m){m=L[j];k=j;} return [m,k]; };
  const pivH = (j,w) => { for (let k=1;k<=w;k++){ if (j-k<0||j+k>=n||H[j-k]>H[j]||H[j+k]>=H[j]) return false; } return true; };
  const pivL = (j,w) => { for (let k=1;k<=w;k++){ if (j-k<0||j+k>=n||L[j-k]<L[j]||L[j+k]<=L[j]) return false; } return true; };

  const events = [];
  let trend = 0, ext = null, prot = null, lastPH = null, lastPL = null;

  function makeEvent(dir, level, fromIdx, i, structure) {
    let start, top, topIdx, bot, botIdx;
    if (dir < 0) {
      const [pt, pti] = maxIn(fromIdx, i), h = pt - level;
      start = fromIdx;
      for (let j = i-1; j > pti; j--) if (L[j] <= level + 0.15*h && maxIn(j+1, i)[0] >= level + 0.5*h) { start = j; break; }
      [top, topIdx] = maxIn(start, i); bot = level; botIdx = fromIdx;
    } else {
      const [pb, pbi] = minIn(fromIdx, i), h = level - pb;
      start = fromIdx;
      for (let j = i-1; j > pbi; j--) if (H[j] >= level - 0.15*h && minIn(j+1, i)[0] <= level - 0.5*h) { start = j; break; }
      [bot, botIdx] = minIn(start, i); top = level; topIdx = fromIdx;
    }
    const e = { dir, level, fromIdx, breakIdx: i, structure, start, top, bot,
      protIdx: dir < 0 ? topIdx : botIdx, prot: dir < 0 ? top : bot, vr: null, cf: [], endIdx: null };
    events.push(e);
    return e;
  }

  for (let i = 0; i < n; i++) {
    const cj = i - N;
    if (cj >= 0) { if (pivH(cj,N)) lastPH = { i: cj, p: H[cj] }; if (pivL(cj,N)) lastPL = { i: cj, p: L[cj] }; }

    if (trend === 0) {
      if (lastPH && C[i] > lastPH.p) {
        const e = makeEvent(1, lastPH.p, lastPH.i, i, false); trend = 1;
        prot = { p: e.bot, i: e.protIdx }; ext = { i, p: H[i], fixed: false };
      } else if (lastPL && C[i] < lastPL.p) {
        const e = makeEvent(-1, lastPL.p, lastPL.i, i, false); trend = -1;
        prot = { p: e.top, i: e.protIdx }; ext = { i, p: L[i], fixed: false };
      }
      continue;
    }

    if (trend < 0) {
      if (C[i] > prot.p) {
        const prev = events[events.length-1];
        const e = makeEvent(1, prot.p, prot.i, i, true); trend = 1;
        if (prev.endIdx === null) prev.endIdx = i;
        prot = { p: e.bot, i: e.protIdx }; ext = { i, p: H[i], fixed: false };
        continue;
      }
      if (!ext.fixed) {
        if (L[i] < ext.p) ext = { i, p: L[i], fixed: false };
        else if (i - ext.i >= N) { ext.fixed = true; events[events.length-1].vr = { i: ext.i, p: ext.p }; }
      }
      if (ext.fixed && C[i] < ext.p) {
        const e = makeEvent(-1, ext.p, ext.i, i, false);
        prot = { p: e.top, i: e.protIdx }; ext = { i, p: L[i], fixed: false };
      }
    } else {
      if (C[i] < prot.p) {
        const prev = events[events.length-1];
        const e = makeEvent(-1, prot.p, prot.i, i, true); trend = -1;
        if (prev.endIdx === null) prev.endIdx = i;
        prot = { p: e.top, i: e.protIdx }; ext = { i, p: L[i], fixed: false };
        continue;
      }
      if (!ext.fixed) {
        if (H[i] > ext.p) ext = { i, p: H[i], fixed: false };
        else if (i - ext.i >= N) { ext.fixed = true; events[events.length-1].vr = { i: ext.i, p: ext.p }; }
      }
      if (ext.fixed && C[i] > ext.p) {
        const e = makeEvent(1, ext.p, ext.i, i, false);
        prot = { p: e.bot, i: e.protIdx }; ext = { i, p: H[i], fixed: false };
      }
    }
  }

  // Origin invalidation, VR box, CF boxes
  const w = Math.max(2, Math.round(N/2));
  events.forEach((e, k) => {
    const h = e.top - e.bot;
    for (let j = e.breakIdx+1; j < n && e.endIdx === null; j++) {
      if ((e.dir < 0 && C[j] > e.top) || (e.dir > 0 && C[j] < e.bot)) e.endIdx = j;
    }
    if (e.vr) {
      // VR runs from the extreme to the last internal swing before it; a body close back through that swing confirms the reversal
      const nextBrk = events[k+1] ? events[k+1].breakIdx : n - 1;
      let lvl = null;
      for (let j = e.vr.i - 1; j > e.breakIdx; j--) {
        if (e.dir < 0 ? pivH(j, 2) : pivL(j, 2)) { lvl = e.dir < 0 ? H[j] : L[j]; break; }
      }
      if (lvl !== null && (e.dir < 0 ? lvl >= e.level : lvl <= e.level)) lvl = null;
      if (lvl !== null) {
        for (let j = e.vr.i + 1; j <= nextBrk && j < n; j++) if (e.dir < 0 ? C[j] > lvl : C[j] < lvl) { e.vrConfirmIdx = j; break; }
        e.vrBox = e.dir < 0 ? { lo: e.vr.p, hi: lvl } : { lo: lvl, hi: e.vr.p };
      } else {
        const d = Math.max(0.3*h, Math.abs(e.level - e.vr.p) * 0.25);
        e.vrBox = e.dir < 0 ? { lo: e.vr.p, hi: e.vr.p + d } : { lo: e.vr.p - d, hi: e.vr.p };
      }
    }
    const stop = Math.min(n-1-w, events[k+1] ? events[k+1].breakIdx : n-1);
    for (let j = e.start+1; j <= stop; j++) {
      const isPiv = e.dir < 0 ? pivH(j,w) : pivL(j,w);
      if (!isPiv) continue;
      const px = e.dir < 0 ? H[j] : L[j];
      if (px < e.bot - 0.02*h || px > e.top + 0.02*h) continue;
      const post = j > e.breakIdx;
      if (post && e.vr && j < e.vr.i) continue;
      e.cf.push({ i: j, p: px, post,
        lo: e.dir < 0 ? Math.max(e.bot, px - 0.35*h) : px,
        hi: e.dir < 0 ? px : Math.min(e.top, px + 0.35*h) });
    }
    e.cf = e.cf.slice(-4);
  });

  const last = events[events.length-1];
  return { events, trend, ext, prot, last, n };
}

function msNextSetup(bars, A) {
  const e = A.last, n = bars.length, price = bars[n-1].close;
  if (!e) return null;
  const sell = e.dir < 0, h = e.top - e.bot;
  const inOrigin = price <= e.top && price >= e.bot;
  const brokenAway = sell ? price < e.bot : price > e.top;
  let phase, steps;
  const dp = (typeof window !== 'undefined' && window.MS_DEC) || 1;
  const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const zone = `${fmt(e.bot)} – ${fmt(e.top)}`;
  if (!A.ext.fixed && brokenAway) {
    phase = sell ? 'Extension after BO Sell' : 'Extension after BO Buy';
    steps = [
      `Wait for the H1 VR: price ${sell ? 'stops making lower lows and reverses' : 'stops making higher highs and reverses'} near ${fmt(A.ext.p)}.`,
      `Let it retrace back into the Origin ${zone}. Do not chase the move.`,
      `Inside the Origin, wait for an H1 CF (${sell ? 'lower high' : 'higher low'}), then ${sell ? 'sell' : 'buy'} the pullback on M15/M5.`,
    ];
  } else if (brokenAway) {
    phase = 'VR formed, retracing to Origin';
    steps = [
      `VR is in at ${fmt(A.ext.p)}. Price is moving back toward the Origin.`,
      `Mark the Origin ${zone} and wait for price to enter it.`,
      `${sell ? 'Sell' : 'Buy'} from the H1 CF inside the Origin, or wait for the CF to confirm and enter after it.`,
    ];
  } else if (inOrigin) {
    phase = 'Price inside Origin, CF watch';
    steps = [
      `Price is trading inside the Origin ${zone}.`,
      `Drop to H1: look for a CF (${sell ? 'lower high with an internal BO Sell' : 'higher low with an internal BO Buy'}).`,
      `Enter on the pullback after the CF. Stop just past the CF swing.`,
    ];
  } else {
    phase = 'Origin under pressure';
    steps = [`Price is beyond the Origin. A close past ${fmt(sell ? e.top : e.bot)} flips structure. Stand aside until the next BO.`];
  }
  const target = A.ext.p;
  const proj = [];
  if (brokenAway) {
    const vrP = A.ext.fixed ? A.ext.p : (sell ? Math.min(A.ext.p, price) - 0.25*h : Math.max(A.ext.p, price) + 0.25*h);
    const cfP = sell ? e.bot + 0.45*h : e.top - 0.45*h;
    const endP = sell ? vrP - 0.5*h : vrP + 0.5*h;
    proj.push({ l: n-1, p: price });
    if (!A.ext.fixed) proj.push({ l: n+4, p: vrP, t: '① VR' });
    proj.push({ l: n+(A.ext.fixed ? 7 : 13), p: cfP, t: `② H1 CF · ${sell ? 'SELL' : 'BUY'}` });
    proj.push({ l: n+(A.ext.fixed ? 17 : 23), p: endP, t: '③ Target' });
  }
  return { sell, phase, steps, zone, invalid: sell ? e.top : e.bot, target, proj, e, price };
}



let CUR = { dec: 2, group: 'Crypto' };
const panes = {};
const fmt = (v) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: CUR.dec, maximumFractionDigits: CUR.dec });
const sizeText = () => '';
// Council rules (stop buffer, paused setups, minimum R) — the Coach tunes these; the page loads them from the council data
const CFG = { buf: 0.15, minRR: 1.2, minRisk: 0.6, paused: {} };
const PAIRS = [
  { k: 'position', name: 'Position', h: '1d',  l: '1h',  e: 'H1 / M5', up: null },
  { k: 'swing',    name: 'Swing',    h: '4h',  l: '1h',  e: 'M15 / M1', up: '1d' },
  { k: 'intraday', name: 'Intraday', h: '1h',  l: '5m',  e: 'M5 / M1', up: '4h' },
  { k: 'scalp',    name: 'Scalp',    h: '15m', l: '1m',  e: 'M1',  up: '1h' },
];
const LBL = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5', '1m': 'M1' };
// Average true range of the last n candles: sizes the stop buffer to how much the timeframe actually moves
function atr(bars, n = 14) {
  const m = bars.length; let s = 0, k = 0;
  for (let i = Math.max(1, m - n); i < m; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); k++; }
  return k ? s / k : 0;
}
// Smallest buffer worth placing: about one typical spread for the market
const spreadOf = (price) => CUR.group === 'Forex' ? 0.0001 : CUR.spot ? 0.3 : price * 0.0002;
function buildSetup(pr, price, src = panes) {
  const hp = src[pr.h], lp = src[pr.l];
  if (!hp || !lp || !hp.A || !hp.A.last || !lp.A || !lp.bars) return null;
  const e = hp.A.last, dir = e.dir, sell = dir < 0, sgn = sell ? -1 : 1, h = e.top - e.bot;
  const H = LBL[pr.h], Lo = LBL[pr.l], word = sell ? 'sell' : 'buy';
  const breakT = hp.bars[e.breakIdx].time;
  const beyond = sell ? price > e.top : price < e.bot;
  const inOrigin = price >= e.bot && price <= e.top;
  const after = lp.A.events.filter((x) => lp.bars[x.breakIdx].time >= breakT);
  const vr = !!e.vr || after.some((x) => x.dir === -dir);
  // 50% line: halfway between the Origin edge where the move started and the VR extreme. Under it is internal structure, past it is main structure
  const vrP = e.vr ? e.vr.p : hp.A.ext.p, far = sell ? e.top : e.bot, fib = (far + vrP) / 2;
  let touchT = null;
  for (const b of lp.bars) if (b.time > breakT && (sell ? b.high >= e.bot : b.low <= e.top)) { touchT = b.time; break; }
  const touched = touchT !== null;
  const ll = lp.A.last;
  // CF: once price is back inside the Origin, the lower timeframe breaks in the trade's direction
  const cf = touched && vr && ll && ll.dir === dir && lp.bars[ll.breakIdx].time >= touchT;
  const model = null;
  const ext = lp.bars.filter((b) => b.time > breakT).reduce((m, b) => sell ? Math.max(m, b.high) : Math.min(m, b.low), sell ? -Infinity : Infinity);
  const retr = vr && isFinite(ext) && far !== vrP ? Math.max(0, Math.min(1.5, (ext - vrP) / (far - vrP))) : null;
  // Stop: just past the swing the confirming BO started from (the CF zone), padded by a slice of that timeframe's ATR and at least one spread.
  // Before the CF there is no CF swing yet, so the planned stop sits past the HTF Origin edge instead.
  const spr = spreadOf(price);
  let entry, stop, anchor, buf, stopWhy;
  if (cf) {
    anchor = sell ? ll.top : ll.bot; buf = Math.max(CFG.buf * atr(lp.bars), spr);
    entry = ll.level; stop = anchor + (sell ? buf : -buf);
    stopWhy = `${Lo} CF ${sell ? 'high' : 'low'} ${fmt(anchor)}`;
    // never closer than minRisk × ATR: a stop inside one normal candle is just noise
    const floor = Math.max(CFG.minRisk * atr(lp.bars), 5 * spr);   // and never inside 5 spreads, for quiet markets
    if (Math.abs(entry - stop) < floor) { stop = entry + (sell ? floor : -floor); buf = Math.abs(stop - anchor); stopWhy += ` (widened to the minimum stop)`; }
  } else {
    anchor = sell ? e.top : e.bot; buf = Math.max(0.1 * atr(hp.bars), spr);
    entry = sell ? e.bot + 0.5 * h : e.top - 0.5 * h; stop = anchor + (sell ? buf : -buf);
    stopWhy = `${H} Origin ${sell ? 'top' : 'bottom'} ${fmt(anchor)} (moves to the ${Lo} CF swing once it forms)`;
  }
  const r = Math.abs(stop - entry);
  let t1 = hp.A.ext.p;
  if ((t1 - entry) * sgn < r) t1 = entry + sgn * 2 * r;
  const t2 = t1 + sgn * h, rr = Math.abs(t1 - entry) / r;
  const dist = Math.abs(price - entry);
  let state, cls, next;
  if (beyond) { state = 'INVALID'; cls = 'bad'; next = `Price is beyond the ${H} Origin. Wait for the next ${H} BO.`; }
  else if (cf) { state = 'READY'; cls = 'ready'; next = `${Lo} CF confirmed inside the ${H} Origin${retr !== null ? `, ${retr >= 0.5 ? 'in main structure (past the 50% line)' : 'in internal structure (under the 50% line)'}` : ''}. ${sell ? 'Sell' : 'Buy'} the pullback to ${fmt(entry)}, stop past ${fmt(stop)}.`; }
  else if (touched) { state = 'IN ORIGIN'; cls = 'near'; next = `Price is in the ${H} Origin. Wait for ${Lo} to break ${sell ? 'down' : 'up'} (the CF), then ${word} the pullback.`; }
  else if (vr) { state = 'WAIT RETRACE'; cls = ''; next = `${H} VR is in. Wait for price to come back ${sell ? 'up' : 'down'} into the Origin ${fmt(e.bot)} – ${fmt(e.top)} (${fmt(dist)} away). Under the 50% line (${fmt(fib)}) is internal structure, past it is main structure.`; }
  else { state = 'WAIT VR'; cls = ''; next = `${H} just broke ${sell ? 'down' : 'up'}. Let the move finish and reverse on ${Lo} before planning the ${word}.`; }
  const upP = pr.up && src[pr.up];
  const align = !upP || !upP.A ? null : upP.A.trend === dir;
  return { k: pr.k, name: pr.name, pair: `${H} → ${Lo}`, sell, entry, stop, t1, t2, rr, r, state, cls, next, align, upL: pr.up ? LBL[pr.up] : '', size: sizeText(r, price), invalid: beyond, model, retr, fib, stopWhy, buf,
    sig: `${pr.k}|${hp.bars[e.start].time}|${cf ? lp.bars[ll.breakIdx].time : ''}` };
}
// ─── Retracement trades: while the HTF pulls back toward its Origin, trade the lower timeframe against the main direction ───
// e.g. H4 is a sell and has made its VR: an H1 BO Buy is a buy up to the 50% line / Origin, where the sells resume.
const RETR = [
  { k: 'rswing', name: 'Retrace', h: '4h',  l: '1h' },
  { k: 'rintra', name: 'Retrace', h: '1h',  l: '5m' },
  { k: 'rscalp', name: 'Retrace', h: '15m', l: '1m' },
];
function buildRetrace(pr, price, src = panes) {
  const hp = src[pr.h], lp = src[pr.l];
  if (!hp || !lp || !hp.A || !hp.A.last || !hp.A.ext || !lp.A || !lp.bars || lp.bars.length < 20) return null;
  const e = hp.A.last, dir = e.dir, sell = dir < 0, rdir = -dir, buy = rdir > 0, sgn = buy ? 1 : -1;
  const H = LBL[pr.h], Lo = LBL[pr.l], word = buy ? 'buy' : 'sell', main = sell ? 'sells' : 'buys', way = buy ? 'up' : 'down';
  const breakT = hp.bars[e.breakIdx].time;
  const vrP = e.vr ? e.vr.p : hp.A.ext.p, vrI = e.vr ? e.vr.i : hp.A.ext.i;
  const vrT = hp.bars[Math.min(vrI, hp.bars.length - 1)].time;
  const far = sell ? e.top : e.bot, fib = (far + vrP) / 2, near = e.level;
  const after = lp.A.events.filter((x) => lp.bars[x.breakIdx].time >= breakT);
  const vr = !!e.vr || after.some((x) => x.dir === rdir);
  const beyond = sell ? price > e.top : price < e.bot;
  const reached = sell ? price >= e.bot : price <= e.top;
  const ll = lp.A.last;
  const conf = vr && ll && ll.dir === rdir && lp.bars[ll.breakIdx].time >= vrT;
  const spr = spreadOf(price);
  let entry, stop, anchor, buf, stopWhy;
  if (conf) {
    anchor = buy ? ll.bot : ll.top; buf = Math.max(CFG.buf * atr(lp.bars), spr);
    entry = ll.level; stop = anchor - sgn * buf;
    stopWhy = `${Lo} ${buy ? 'low' : 'high'} ${fmt(anchor)}`;
    const floor = Math.max(CFG.minRisk * atr(lp.bars), 5 * spr);   // and never inside 5 spreads, for quiet markets
    if (Math.abs(entry - stop) < floor) { stop = entry - sgn * floor; buf = Math.abs(stop - anchor); stopWhy += ` (widened to the minimum stop)`; }
  } else {
    anchor = vrP; buf = Math.max(0.1 * atr(hp.bars), spr);
    entry = vrP + sgn * 0.2 * Math.abs(near - vrP); stop = anchor - sgn * buf;
    stopWhy = `${H} VR ${fmt(vrP)} (moves to the ${Lo} swing once ${Lo} breaks ${way})`;
  }
  const r = Math.abs(entry - stop);
  if (!(r > 0)) return null;
  // Targets: the 50% line and the Origin edge, nearest first; never past the Origin, that's where the main trend resumes
  const tg = [fib, near].sort((a, b) => (a - b) * sgn);
  let t1 = tg[0], t2 = tg[1];
  if ((t1 - entry) * sgn <= 0) t1 = t2;
  if ((t2 - t1) * sgn <= 0) t2 = t1;
  const rr = Math.max(0, (t1 - entry) * sgn) / r;
  let state, cls, next, invalid = false;
  if (beyond) { state = 'INVALID'; cls = 'bad'; invalid = true; next = `Price broke beyond the ${H} Origin, so the ${H} structure has flipped. No retracement trade.`; }
  else if (reached) { state = 'PLAYED OUT'; cls = ''; invalid = true; next = `The retracement already reached the ${H} Origin ${fmt(e.bot)} – ${fmt(e.top)}. Look for ${main} there instead (the main setup cards).`; }
  else if (!vr) { state = 'WAIT VR'; cls = ''; invalid = true; next = `${H} is still extending ${sell ? 'down' : 'up'}. A retracement ${word} only comes after the ${H} VR.`; }
  else if (conf && (price - t1) * sgn >= 0) { state = 'PLAYED OUT'; cls = ''; invalid = true; next = `This ${Lo} ${word} already reached ${fmt(t1)}. Wait for the next ${Lo} break, or the ${main} at the Origin.`; }
  else if (conf) { state = 'READY'; cls = 'ready'; next = `${H} made its VR and ${Lo} broke ${way}. ${buy ? 'Buy' : 'Sell'} the pullback to ${fmt(entry)}, stop past ${fmt(stop)}. Take profit at ${fmt(t1)}${t2 !== t1 ? ` then ${fmt(t2)}` : ''}, and be out before the Origin: that's where the ${H} ${main} resume.`; }
  else { state = 'WAIT BO'; cls = 'near'; next = `${H} VR is in at ${fmt(vrP)}. Wait for ${Lo} to print a BO ${buy ? 'Buy' : 'Sell'}, then ${word} the retracement ${way} to the 50% line ${fmt(fib)} and the Origin ${fmt(near)}.`; }
  return { k: pr.k, name: pr.name, pair: `${H} → ${Lo}`, sell: !buy, entry, stop, t1, t2, rr, r, state, cls, next, align: null, upL: H,
    size: sizeText(r, price), invalid, model: null, retr: null, fib, stopWhy, buf, retrace: true,
    sig: `${pr.k}|${vrT}|${conf ? lp.bars[ll.breakIdx].time : ''}` };
}

export function setMarket(m) { CUR = m; }
export { msAnalyze, CFG, PAIRS, RETR, LBL, buildSetup, buildRetrace };
