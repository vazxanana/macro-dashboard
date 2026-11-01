// Council · Trade review (post-mortem)
// Every closed trade gets studied: what the market did before, during and AFTER it, and a verdict:
//   system — our rules caused or worsened the loss (stop too tight, stop hunted, gave back profit,
//            late entry, against the higher trend): something to change.
//   market — the setup was taken as designed and the market simply did something else
//            (real reversal, news spike, gap): an accepted cost of trading.
// After the exit the review keeps watching price for a while, because that is what tells a
// "right idea, bad stop" loss apart from a "the market really turned" loss.

// How long to keep watching after the exit, by the higher timeframe of the pair
export const WATCH = { '15m': 4 * 3600, '1h': 12 * 3600, '4h': 2 * 86400, '1d': 5 * 86400 };

export const spreadFor = (M, price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
export function atrOf(bars, n = 14) {
  const b = bars.slice(-n - 1); let s = 0, c = 0;
  for (let i = 1; i < b.length; i++) { s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); c++; }
  return c ? s / c : 0;
}

// Conditions at the signal, saved with the trade so the review can judge it later
export function entryContext(t, src, def, M, price) {
  const lb = src[def.l].bars, a = atrOf(lb), r = Math.abs(t.entry - t.stop), sp = spreadFor(M, price);
  const cfT = +String(t.sig).split('|')[2] || 0;
  return {
    atr: +a.toPrecision(5), stopAtr: a ? +(r / a).toFixed(2) : null, spread: sp, stopSpreads: +(r / sp).toFixed(1),
    planned: t.entry, sigAge: cfT ? Math.round((lb.at(-1).time - cfT) / (lb.at(-1).time - lb.at(-2).time)) : null,
    trend: { '1d': src['1d'].A.trend, '4h': src['4h'].A.trend, '1h': src['1h'].A.trend },
  };
}

// High-impact news for this market's currencies in a time window (ForexFactory weekly calendar)
const CUR = { xau: ['USD'], btc: ['USD'], eth: ['USD'], sol: ['USD'], xrp: ['USD'] };
export function newsNear(key, label, news, from, to) {
  if (!Array.isArray(news)) return [];
  const cur = CUR[key] || String(label).split('/');
  return news.filter((e) => e.impact === 'High' && cur.includes(e.country)).map((e) => ({ t: Math.floor(Date.parse(e.date) / 1000), title: e.title, country: e.country }))
    .filter((e) => e.t >= from && e.t <= to);
}

// Called when a trade closes: the facts we know right away
export function startReview(tr, exitBar, key, news) {
  const s = tr.side === 'sell' ? -1 : 1, r0 = tr.r0 || Math.abs(tr.entry - tr.stop) || 1e-9;
  const pm = { phase: 'watch', until: tr.closed + (WATCH[tr.h] || 86400), checked: tr.closed, after: { best: 0, worst: 0, hitT1: null } };
  // the exit candle opened beyond the stop: price gapped, the fill was worse than the stop
  if (exitBar && (tr.status === 'loss' || tr.status === 'be')) {
    const slip = (tr.stop - exitBar.open) * s / r0;   // > 0 means the open was already past the stop
    if (slip > 0.2) pm.gap = +slip.toFixed(2);
  }
  pm.news = newsNear(key, tr.label, news, (tr.filled || tr.opened) - 1800, tr.closed + 300);
  if (tr.filled && tr.ctx && tr.ctx.planned != null) pm.slip = +((tr.entry - tr.ctx.planned) * s / r0).toFixed(2);   // < 0: we paid worse than planned
  tr.pm = pm;
}

// Called every run while the review is still watching: what price did after the exit
export function watchReview(tr, bars) {
  const pm = tr.pm; if (!pm || pm.phase !== 'watch') return;
  const s = tr.side === 'sell' ? -1 : 1, r0 = tr.r0 || Math.abs(tr.entry - tr.stop) || 1e-9;
  for (const b of bars) {
    if (b.time <= pm.checked || b.time > pm.until) continue;
    const fav = ((s > 0 ? b.high : b.low) - tr.entry) * s / r0, adv = (tr.entry - (s > 0 ? b.low : b.high)) * s / r0;
    pm.after.best = +Math.max(pm.after.best, fav).toFixed(2);
    pm.after.worst = +Math.max(pm.after.worst, adv).toFixed(2);
    if (pm.after.hitT1 == null && (s > 0 ? b.high >= tr.t1 : b.low <= tr.t1)) { pm.after.hitT1 = b.time; pm.after.worstPre = pm.after.worst; }
    if (pm.after.hitT1 == null && fav >= 1.5 && pm.after.worst15 == null) pm.after.worst15 = pm.after.worst;
    pm.checked = b.time;
  }
  if (bars.length && bars.at(-1).time >= pm.until) pm.phase = 'done';
  Object.assign(pm, judge(tr));
}

// The verdict. Ordered: the first matching cause is the main one; every match is kept as a factor.
export function judge(tr) {
  const pm = tr.pm || {}, c = tr.ctx || {}, a = pm.after || { best: 0, worst: 0 }, mfe = tr.mfe || 0;
  const tRR = tr.rr || 0, done = pm.phase === 'done';
  const f = [];   // [verdict, cause, title, detail, lesson]
  if (tr.status === 'loss') {
    if (pm.news && pm.news.length) f.push(['market', 'news', 'News spike', `${pm.news.map((n) => `${n.country} ${n.title}`).join(', ')} came out during the trade.`, 'Avoid holding scalps and intraday trades through high-impact news: check the calendar before entering.']);
    if (pm.gap) f.push(['market', 'gap', 'Price gapped through the stop', `The exit candle opened ${pm.gap}R past the stop, so the fill was worse than planned.`, 'Gaps happen at reopens and on news; size so a gap is survivable.']);
    if ((c.stopAtr != null && c.stopAtr < 0.5) || (c.stopSpreads != null && c.stopSpreads < 5)) f.push(['system', 'noise', 'Stop too tight for the market', `The stop was ${c.stopAtr}× ATR (${c.stopSpreads} spreads) from the entry: inside one normal candle.`, 'Keep the stop at least 0.6× ATR away, past the CF swing.']);
    // only a hunt if price turned soon after the stop (no more than ~0.6R past it) and then went our way
    const pre = a.hitT1 != null ? a.worstPre : a.worst15;
    if ((a.hitT1 != null || a.best >= Math.max(1.5, tRR * 0.8)) && pre != null && pre <= 1.6) f.push(['system', 'hunt', 'Right idea, stopped out first', `After the stop, price went to ${a.hitT1 != null ? 'the target' : `+${a.best}R`}: the direction was right but the stop sat where the market sweeps before moving.`, 'Put the stop past the next swing or the liquidity just beyond the CF, or wait for the sweep before entering.']);
    if (mfe >= 1) f.push(['system', 'gaveback', 'Gave back the profit', `The trade was +${mfe}R before it turned and hit the stop.`, 'Move the stop to break-even or take a partial at +1R.']);
    if (pm.slip != null && pm.slip < -0.25) f.push(['system', 'late', 'Late entry', `Filled ${Math.abs(pm.slip)}R worse than the planned entry: the move had already started.`, 'Only take fresh signals at the planned price; skip if price is already through it.']);
    else if (c.sigAge != null && c.sigAge > 8) f.push(['system', 'late', 'Late entry', `The signal was ${c.sigAge} candles old at entry.`, 'Take signals within the first few candles after the CF.']);
    if (tr.feat && tr.feat.d1 === 'against' && !/^r/.test(tr.k)) f.push(['system', 'against', 'Against the D1 trend', 'The trade went against the daily trend.', 'Favour trades with the D1 trend, or demand more reward:risk against it.']);
    if (/^r/.test(tr.k) && mfe < 0.3) f.push(['market', 'retrace-fail', 'The retracement never came', 'This counter-trend retracement trade never got going: the higher timeframe trend simply carried on.', 'Retracement trades work best right after a strong HTF VR; skip them when the HTF move is still impulsive.']);
    if (done && mfe < 0.3 && a.worst >= 2) f.push(['market', 'reversal', 'The market turned for real', `Price never went for us (best +${mfe}R) and carried on ${a.worst}R against the entry after the stop.`, 'Valid loss: the stop did its job. Nothing to fix unless this setup keeps doing it.']);
    if (!f.length) f.push(['market', 'normal', 'Normal loss', `Rules followed: best +${mfe}R, then the stop. ${done ? `After the exit price went +${a.best}R / −${a.worst}R.` : ''}`.trim(), 'An accepted cost of trading. Count it, don\'t change the rules for it.']);
  } else if (tr.status === 'be') {
    if (a.hitT1 != null) f.push(['system', 'becost', 'Break-even cost a win', 'Stopped at the entry, then price went on to the target.', 'Move to break-even later (e.g. +1.5R) or only after a new structure break.']);
    else f.push(['market', 'besaved', 'Break-even saved a loss', `Price came back to the entry${done && a.worst >= 1 ? ` and went on ${a.worst}R against` : ''}.`, 'The break-even rule protected this one.']);
  } else if (tr.status === 'win') {
    const more = +(a.best - tRR).toFixed(2);
    if (done && more >= 1) f.push(['system', 'leftmoney', 'Target left money on the table', `After the target price ran another ${more}R.`, 'Consider holding part of the position for the next target.']);
    else f.push(['market', 'clean', 'Clean win', `Target hit${done ? `; price went only ${Math.max(0, more)}R further` : ''}.`, 'The setup worked as designed.']);
  }
  if (!f.length) return {};
  const [verdict, cause, title, detail, lesson] = f[0];
  return { verdict, cause, title, detail, lesson, factors: f.slice(1).map((x) => x[1]) };
}

// The Coach's summary of every review in a window
export function lessons(trades, now, days = 30) {
  const rv = trades.filter((x) => x.pm && x.pm.cause && now - x.closed < days * 86400);
  const losses = rv.filter((x) => x.status === 'loss');
  const by = {};
  for (const x of rv) {
    const g = by[x.pm.cause] = by[x.pm.cause] || { n: 0, R: 0, verdict: x.pm.verdict, title: x.pm.title, lesson: x.pm.lesson, live: 0, shadow: 0 };
    g.n++; g.R = +(g.R + (x.R || 0)).toFixed(2); x.shadow ? g.shadow++ : g.live++;
  }
  const sys = losses.filter((x) => x.pm.verdict === 'system').length;
  const top = Object.entries(by).filter(([, g]) => g.verdict === 'system').sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([k, g]) => `${g.title} (${g.n}×): ${g.lesson}`);
  return { n: rv.length, losses: losses.length, system: sys, market: losses.length - sys, byCause: by, top };
}
