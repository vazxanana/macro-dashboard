// Mosha desk, the chart (owner, 10 Nov 2026: "Check the screenshots of trades I've sent you so you can understand and replicate them
// now in the charts and replay"). The owner's five example trades, with the owner's own marks read off the screenshots and placed
// on our 5-minute candles: the purple level line, the red "5 mn" VR box (from the extreme to the last swing before it), the
// lavender zone of the break, the red stop band and the grey target band. A replay walks each one candle by candle and names the
// step it has reached. A logged trade opens in the same chart (levels only). Times are UTC; the screenshots' clock is New York
// (UTC-4 until 1 Nov 2026, UTC-5 after). Pure pieces are on MS_MOSHA_RP and tested in tests/mosha-replay.test.mjs.
// Same day, owner: "And do the same of the previous": the earlier screenshots' higher-timeframe pictures (STUDIES below), the
// H4 / H1 / M15 story the trades sit in, on the same chart with the same replay.
// A picture of past trades only: nothing here places or changes a trade.
(function (root) {
  'use strict';
  var T = function (s) { return Date.parse(s + ':00Z') / 1000; };
  // kind: level = a purple line; vr = the red "5 mn" box (a sell's VR); bvr = the green box (a buy's VR); zone = the lavender
  // zone of the break; htf = a higher-timeframe zone (the target area). `a`..`b` = when the mark starts and ends.
  var EXAMPLES = [
    { id: 'nov10', title: '10 Nov sell', label: 'This is how I was expecting Mosha to work', market: 'xau', side: 'sell', entry: 4120.42, stop: 4128.92, target: 4072.84,
      from: T('2026-11-09T15:00'), to: T('2026-11-10T11:30'), fillFrom: T('2026-11-10T05:00'), yours: '+5.6R, target reached',
      marks: [
        { kind: 'level', label: 'Your level 4146.9', p: 4146.9, a: T('2026-11-09T15:00'), b: T('2026-11-09T20:30') },
        { kind: 'vr', label: '5 mn', top: 4148.71, bot: 4127.0, a: T('2026-11-09T20:00'), b: T('2026-11-10T02:15'), at: T('2026-11-09T20:30') },
        { kind: 'level', under: true, label: 'Low 4121.65', p: 4121.65, a: T('2026-11-10T00:55'), b: T('2026-11-10T02:30') },
        { kind: 'zone', label: 'Zone of the break', top: 4128.3, bot: 4121.65, a: T('2026-11-10T02:30'), b: T('2026-11-10T05:40') },
        { kind: 'htf', label: 'H4 zone', top: 4079, bot: 4061, a: T('2026-11-09T15:00'), b: T('2026-11-10T11:30') }],
      steps: [
        { t: T('2026-11-09T15:00'), text: 'Your level at 4146.9 is above price. Wait for it.' },
        { t: T('2026-11-09T20:25'), text: 'The sweep: price trades through the level to 4148.71 and does not hold above it.' },
        { t: T('2026-11-09T20:30'), text: 'The M5 VR, your red "5 mn" box: from the extreme 4148.71 down to the last swing low before it, about 4127.' },
        { t: T('2026-11-10T00:30'), text: 'The CF: an M5 candle closes below the VR. The low it leaves is 4121.65.' },
        { t: T('2026-11-10T02:30'), text: 'BO sell on M5: a close below 4121.65. The zone of the break runs from 4121.65 up to 4128.3.' },
        { t: 'fill', text: 'The return to the zone: sell 4120.42, stop 4128.92 above the zone, target 4072.84 at the H4 zone. Plan 1 : 5.6.' },
        { t: 'exit', text: 'The target is reached.' }] },
    { id: 'oct28', title: '28 Oct sell', label: 'M5 cf for sell · 2000 pips', market: 'xau', side: 'sell', entry: 4048.59, stop: 4076.69, target: 3971.09,
      from: T('2026-10-28T12:00'), to: T('2026-10-30T09:00'), fillFrom: T('2026-10-29T00:15'), yours: '+2.8R, target reached',
      marks: [
        { kind: 'level', label: 'H4 BO sell level, about 4066', p: 4066, a: T('2026-10-28T12:00'), b: T('2026-10-28T20:05') },
        { kind: 'vr', label: '5 mn', top: 4076.69, bot: 4048.59, a: T('2026-10-28T20:00'), b: T('2026-10-29T02:00'), at: T('2026-10-28T20:15') }],
      steps: [
        { t: T('2026-10-28T12:00'), text: 'The H4 is a sell (BO sell on 22 Oct, below about 4066). Price is pulling back up to that level.' },
        { t: T('2026-10-28T20:00'), text: 'The pullback ends with a spike to 4082.8, over the earlier highs, straight back down.' },
        { t: T('2026-10-28T20:15'), text: 'The M5 VR, your red "5 mn" box: from the highs at 4076.7 down to the last swing low before them, 4048.6.' },
        { t: T('2026-10-29T00:00'), text: 'The CF for the sell: an M5 candle closes below the VR, at 4047.7.' },
        { t: 'fill', text: 'Price comes back up to the VR low: sell 4048.59, stop 4076.69 above the VR, target 3971.09. Plan 1 : 2.8.' },
        { t: 'exit', text: 'The target is reached: the main trade, with the H4.' }] },
    { id: 'oct29', title: '29 Oct sell', label: 'Janda', market: 'xau', side: 'sell', entry: 4035.72, stop: 4045.96, target: 3988.44,
      from: T('2026-10-28T18:00'), to: T('2026-10-30T06:00'), fillFrom: T('2026-10-29T09:00'), yours: '+4.6R, target reached',
      marks: [
        { kind: 'vr', label: '5 mn', top: 4076.69, bot: 4048.59, a: T('2026-10-28T20:00'), b: T('2026-10-29T02:00'), at: T('2026-10-28T20:15') },
        { kind: 'level', under: true, label: 'Low 4036.2', p: 4035.72, a: T('2026-10-29T01:00'), b: T('2026-10-29T05:40') },
        { kind: 'zone', label: 'Zone of the break', top: 4045.96, bot: 4035.72, a: T('2026-10-29T05:40'), b: T('2026-10-29T16:30') }],
      steps: [
        { t: T('2026-10-28T18:00'), text: 'Same move as the 28 Oct sell: the spike, the M5 VR and its CF.' },
        { t: T('2026-10-29T01:00'), text: 'After the CF the market leaves a low at 4036.2. That is the next level to break.' },
        { t: T('2026-10-29T05:40'), text: 'BO sell: an M5 close below it. The zone of the break runs from 4035.72 up to 4045.96.' },
        { t: 'fill', text: 'The return to the zone: sell 4035.72, stop 4045.96 above the zone, target 3988.44. Plan 1 : 4.6.' },
        { t: 'exit', text: 'The target is reached.' }] },
    { id: 'nov2s', title: '2 Nov sell', label: 'M30 sweep high · i just took entry after bo sell', market: 'xau', side: 'sell', entry: 3908.27, stop: 3916.10, target: 3878.42,
      from: T('2026-11-01T23:00'), to: T('2026-11-02T10:00'), fillFrom: T('2026-11-02T07:00'), exit: { p: 3891.46, t: T('2026-11-02T08:20') }, yours: '+2.1R, closed by hand at 3891.46',
      marks: [
        { kind: 'level', label: 'M30 high 3915.2', p: 3915.2, a: T('2026-11-02T01:15'), b: T('2026-11-02T05:40') },
        { kind: 'vr', label: 'M5 VR', top: 3919.51, bot: 3906.5, a: T('2026-11-02T05:30'), b: T('2026-11-02T07:00'), at: T('2026-11-02T05:45') },
        { kind: 'zone', label: 'Zone of the break', top: 3909.2, bot: 3903.7, a: T('2026-11-02T06:45'), b: T('2026-11-02T08:45') },
        { kind: 'htf', label: 'Zone below', top: 3886.5, bot: 3869.5, a: T('2026-11-01T23:00'), b: T('2026-11-02T10:00') }],
      steps: [
        { t: T('2026-11-01T23:00'), text: 'An M30 high stands at 3915.2.' },
        { t: T('2026-11-02T05:40'), text: 'M30 sweep high: price takes it, to 3919.5.' },
        { t: T('2026-11-02T05:45'), text: 'The M5 VR: from the extreme 3919.5 down to the last swing low before it, about 3906.5.' },
        { t: T('2026-11-02T06:35'), text: 'BO sell: an M5 close below the VR. The zone of the break is 3903.7 to 3909.2.' },
        { t: 'fill', text: 'Entry after the BO sell: sell 3908.27, stop 3916.10, first target 3878.42 at the zone below.' },
        { t: 'exit', text: 'You closed by hand at 3891.46. Price never reached 3878.42, and later went back through the stop.' }] },
    { id: 'nov2b', title: '2 Nov buy', label: 'Learn this and let it be your new guide', market: 'xau', side: 'buy', entry: 3900.709, stop: 3896.786, target: 3965.077,
      from: T('2026-11-02T05:00'), to: T('2026-11-02T16:00'), fillFrom: T('2026-11-02T13:20'), yours: '+16.4R, target reached',
      marks: [
        { kind: 'bvr', label: 'VR', top: 3907.0, bot: 3891.26, a: T('2026-11-02T08:25'), b: T('2026-11-02T13:20'), at: T('2026-11-02T08:45') },
        { kind: 'level', label: '3900', p: 3900.0, a: T('2026-11-02T06:30'), b: T('2026-11-02T08:15') }],
      steps: [
        { t: T('2026-11-02T05:00'), text: 'The sell before it is done. Price is falling back to the lows.' },
        { t: T('2026-11-02T08:25'), text: 'The low: 3891.26. From here the market holds in a range, your green box.' },
        { t: T('2026-11-02T12:15'), text: 'The range builds for four hours between 3891 and 3907.' },
        { t: 'fill', text: 'Buy 3900.71, stop 3896.79 (3.9 a unit), target 3965.08. Plan 1 : 16.4. On our feed the lows at 13:00 and 13:15 UTC were 3896.47 and 3896.53, under your stop by 0.3: a stop this tight depends on the price feed.' },
        { t: 'exit', text: 'The target is reached in a little over an hour.' }] }
  ];
  // The earlier screenshots (2 Nov 2026): "POV 26 October" on H4 and H1, "M15 vr", "2000 pips"; then "H1" and "no vr just after
  // gave M5 vr m5 cf for sell". Levels and times are our own candles' highs, lows and closes; a box edge that is not one of those
  // is read off the screenshot (within about 2 dollars). `base` = the candles fetched, `tfs` = the candle sizes offered, `view` =
  // the size it opens on, `h4off` = where the H4 candles start (17:00 New York = 21:00 UTC in October), `handFrom` = where the
  // ChronosTrade hand-over starts, `relabel` = a line's name once the break is in, `left` / `under` / `over` = where a mark's name
  // sits, `keep` = its name stays on a phone, `watch` = the moment a picture without a
  // position points at (what price did after it is measured on the candles).
  var STUDIES = [
    { id: 'cycle', title: '22–30 Oct, top-down', label: 'POV 26 October · M15 vr · 2000 pips', market: 'xau', side: 'sell', entry: 4048.59, stop: 4076.69, target: 3971.09,
      base: '15m', tfs: [900, 3600, 14400], view: 3600, h4off: 3600, handFrom: T('2026-10-28T20:15'),
      from: T('2026-10-06T00:00'), to: T('2026-10-30T21:00'), fillFrom: T('2026-10-29T00:15'), yours: '+2.8R on the sell, target reached; the whole fall is your "2000 pips"',
      marks: [
        { kind: 'level', under: true, keep: true, label: 'H4 low 4066.5', relabel: { at: T('2026-10-22T17:00'), label: 'BO sell 4066.5' }, p: 4066.5, a: T('2026-10-07T12:45'), b: T('2026-10-22T17:00'), at: T('2026-10-07T13:00') },
        { kind: 'level', label: 'High 4217.4', p: 4217.4, a: T('2026-10-12T01:00'), b: T('2026-10-28T20:00'), at: T('2026-10-12T05:00') },
        { kind: 'level', left: true, label: 'Low 3986.7', p: 3986.7, a: T('2026-10-23T02:00'), b: T('2026-10-27T13:00'), at: T('2026-10-23T03:00') },
        { kind: 'bvr', label: 'M15 VR', top: 4034.1, bot: 3975.65, a: T('2026-10-23T13:15'), b: T('2026-10-27T14:00'), at: T('2026-10-23T14:45') },
        { kind: 'vr', label: '5 mn', top: 4076.69, bot: 4048.59, a: T('2026-10-28T20:00'), b: T('2026-10-29T02:00'), at: T('2026-10-28T20:15') }],
      steps: [
        { t: T('2026-10-07T13:00'), text: 'An H4 low forms at 4066.5. While it holds, the H4 is not a sell.' },
        { t: T('2026-10-12T05:00'), text: 'The high: 4217.4 on 12 Oct. Price does not get above it again.' },
        { t: T('2026-10-22T17:00'), text: 'BO sell: the H4 candle closes at 4038, below 4066.5 (H1 had closed below it at 12:00). The H4 is a sell from here.' },
        { t: T('2026-10-23T14:45'), text: 'The fall stops at 3975.7, just under the morning low of 3986.7. Your M15 VR, the green box: from that extreme up to the last swing high before it, 4034.1.' },
        { t: T('2026-10-26T02:00'), text: 'The range holds: the lows of 26 Oct (3983.3 and 3978.2) stay above 3975.7.' },
        { t: T('2026-10-27T14:15'), text: 'The CF: an M15 candle closes above the VR, at 4035.9. The pullback up has started.' },
        { t: T('2026-10-27T17:45'), text: 'The pullback reaches the H4 BO sell level from below: highs of 4064.9 and 4065.7 against 4066.5.' },
        { t: T('2026-10-28T20:15'), text: 'It ends with a spike to 4082.8, straight back down. The M5 VR, your red "5 mn" box: 4076.7 down to 4048.6.' },
        { t: T('2026-10-29T00:00'), text: 'The CF for the sell: an M5 candle closes below the VR, at 4047.7.' },
        { t: 'fill', text: 'Price comes back to the VR low: sell 4048.59, stop 4076.69, target 3971.09. The main trade, with the H4.' },
        { t: 'exit', text: 'The target is reached.' },
        { t: T('2026-10-30T20:00'), text: 'Price runs on to 3870.3 by the end of the week: 206 dollars below the VR high, your "2000 pips".' }] },
    { id: 'oct29e', title: '29 Oct evening', label: 'no vr just after gave M5 vr m5 cf for sell', market: 'xau', side: 'sell', entry: null, stop: null, target: null,
      base: '5m', tfs: [300, 900, 3600], view: 900, handFrom: T('2026-10-29T20:15'), watch: { t: T('2026-10-29T23:45'), side: 'sell' },
      from: T('2026-10-28T16:00'), to: T('2026-10-30T16:00'), fillFrom: T('2026-10-29T23:50'), yours: 'no position is drawn on this screenshot',
      marks: [
        { kind: 'level', under: true, label: 'H1 low 4024.7', relabel: { at: T('2026-10-29T08:00'), label: 'BO sell 4024.7' }, p: 4024.7, a: T('2026-10-28T18:00'), b: T('2026-10-29T08:00'), at: T('2026-10-28T19:00') },
        { kind: 'level', label: 'High 4082.8', p: 4082.8, a: T('2026-10-28T20:00'), b: T('2026-10-29T18:00'), at: T('2026-10-28T20:15') },
        { kind: 'level', under: true, label: 'Low 4015.8', relabel: { at: T('2026-10-29T18:00'), label: 'BO sell 4015.8' }, p: 4015.8, a: T('2026-10-29T08:00'), b: T('2026-10-29T17:40'), at: T('2026-10-29T09:00') },
        { kind: 'zone', under: true, label: 'Under the level, no VR', top: 4018, bot: 4005.4, a: T('2026-10-29T17:30'), b: T('2026-10-29T20:30'), at: T('2026-10-29T18:35') },
        { kind: 'zone', over: true, keep: true, label: 'M5 VR', top: 4032.6, bot: 4009.7, a: T('2026-10-29T19:10'), b: T('2026-10-30T02:00'), at: T('2026-10-29T20:15') }],
      steps: [
        { t: T('2026-10-28T19:00'), text: 'On H1: a low at 4024.7, just before the spike up.' },
        { t: T('2026-10-28T20:15'), text: 'The high: 4082.8. The sells of 28 and 29 Oct start from here.' },
        { t: T('2026-10-29T09:00'), text: 'BO sell on H1: the 07:00 candle closes at 4023.1, below 4024.7. The next one leaves a new low at 4015.8.' },
        { t: T('2026-10-29T18:00'), text: 'BO sell again: the H1 candle closes at 4007.2, below 4015.8. No VR here: price only slides under the level, so there is nothing to trade yet.' },
        { t: T('2026-10-29T20:15'), text: 'Just after, the pullback gives one: up from 4009.7 to 4032.6, then turned. That range is the M5 VR.' },
        { t: T('2026-10-29T23:50'), text: 'The M5 CF for the sell: a candle closes below the VR, at 4007.7.' },
        { t: T('2026-10-30T00:50'), text: 'Price comes back into the VR, to 4019.0, and does not get above it.' },
        { t: T('2026-10-30T14:30'), text: 'By the New York morning it is at 3891.6.' }] }
  ];
  var ALL = EXAMPLES.concat(STUDIES), BASE = { '5m': 300, '15m': 900 };
  // the candle sizes a picture offers (never smaller than the candles fetched for it)
  function tfsOf(spec) { var b = BASE[spec.base] || 300; return (spec.tfs || [300, 900, 3600]).filter(function (s) { return s >= b; }); }

  function aggBars(bars, sec, off) {
    if (sec <= 300) return bars; var out = [], c = null; off = off || 0;
    for (var i = 0; i < bars.length; i++) { var b = bars[i], k = Math.floor((b.time - off) / sec) * sec + off; if (!c || c.time !== k) { c = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(c); } else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; } }
    return out;
  }
  // index of the last bar that starts at or before t (-1 when none)
  function barAt(bars, t) { var a = 0, b = bars.length; while (a < b) { var m = (a + b) >> 1; if (bars[m].time <= t) a = m + 1; else b = m; } return a - 1; }
  // The trade on the 5-minute candles: where the entry price is first traded at or after fillFrom, and how it ends (a hand exit,
  // else stop or target, stop first when one candle holds both).
  function outcome(spec, bars) {
    var s = spec.side === 'sell' ? -1 : 1, r0 = Math.abs(spec.entry - spec.stop), i, fi = -1;
    if (!(r0 > 0) || !bars || !bars.length) return { fill: null };
    for (i = 0; i < bars.length; i++) if (bars[i].time >= spec.fillFrom && bars[i].low <= spec.entry && bars[i].high >= spec.entry) { fi = i; break; }
    if (fi < 0) return { fill: null };
    var out = { fill: bars[fi].time, fillI: fi, exit: null, exitI: null, kind: 'open', R: null, worst: 0 };
    for (i = fi; i < bars.length; i++) { var b = bars[i], adv = (s < 0 ? b.high - spec.entry : spec.entry - b.low) / r0;
      if (spec.exit && b.time >= spec.exit.t) { out.exit = b.time; out.exitI = i; out.kind = 'hand'; out.px = spec.exit.p; out.R = +((s * (spec.exit.p - spec.entry)) / r0).toFixed(2); break; }
      if (adv > out.worst) out.worst = adv;
      if (s < 0 ? b.high >= spec.stop : b.low <= spec.stop) { out.exit = b.time; out.exitI = i; out.kind = 'stop'; out.px = spec.stop; out.R = -1; out.worst = 1; break; }
      if (spec.target != null && (s < 0 ? b.low <= spec.target : b.high >= spec.target)) { out.exit = b.time; out.exitI = i; out.kind = 'target'; out.px = spec.target; out.R = +(Math.abs(spec.target - spec.entry) / r0).toFixed(2); break; } }
    out.worst = +out.worst.toFixed(2); return out;
  }
  // steps with their times resolved ('fill' / 'exit' come from the candles); a step without a time yet is dropped
  function stepsOf(spec, oc) { return (spec.steps || []).map(function (s) { var t = s.t === 'fill' ? oc && oc.fill : s.t === 'exit' ? oc && oc.exit : s.t; return t == null ? null : { t: t, text: s.text }; }).filter(Boolean); }
  function stepAt(steps, t) { var k = -1; for (var i = 0; i < steps.length; i++) if (steps[i].t <= t) k = i; return k; }
  // what is on the chart when the replay stands at time t: a mark shows from its `at` (else its start), cut at t
  function marksAt(spec, t) { return (spec.marks || []).filter(function (m) { return (m.at != null ? m.at : m.a) <= t; }).map(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c.b = Math.min(m.b, t); if (m.relabel && m.relabel.at <= t) c.label = m.relabel.label; return c; }); }
  // a picture without a position: what price did after the candle it points at (`watch.t`, measured from that candle's close):
  // the furthest it went with the side, and the furthest against it on the way there
  function follow(spec, bars) {
    var w = spec.watch; if (!w || !bars || !bars.length) return null; var i = barAt(bars, w.t); if (i < 0 || bars[i].time !== w.t) return null;
    var s = w.side === 'sell' ? -1 : 1, px = bars[i].close, best = 0, bi = i, worst = 0, j;
    for (j = i + 1; j < bars.length; j++) { var fav = s < 0 ? px - bars[j].low : bars[j].high - px; if (fav > best) { best = fav; bi = j; } }
    for (j = i + 1; j <= bi; j++) { var adv = s < 0 ? bars[j].high - px : px - bars[j].low; if (adv > worst) worst = adv; }
    return { t: w.t, px: px, best: +best.toFixed(2), bestT: bars[bi].time, bestPx: s < 0 ? bars[bi].low : bars[bi].high, worst: +worst.toFixed(2) };
  }
  // a logged trade as a chart spec (levels only)
  function specOfTrade(t, now) {
    var end = t.status === 'closed' && t.exitAt ? t.exitAt + 2 * 3600 : Math.min(now, t.at + 3 * 86400);
    return { id: 'log-' + t.id, title: (t.side === 'sell' ? 'Sell' : 'Buy') + ' of ' + new Date(t.at * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', label: 'From your log', market: t.market, side: t.side, entry: t.entry, stop: t.stop, target: t.target,
      from: t.at - 12 * 3600, to: Math.max(end, t.at + 3600), fillFrom: t.at - 300, exit: t.status === 'closed' && t.exit != null ? { p: t.exit, t: t.exitAt } : null, marks: [],
      yours: t.status === 'closed' && t.R != null ? (t.R > 0 ? '+' : t.R < 0 ? '−' : '') + Math.abs(t.R).toFixed(2) + 'R, closed at ' + t.exit : 'still open',
      steps: [{ t: t.at - 12 * 3600, text: 'The twelve hours before your entry.' }, { t: 'fill', text: (t.side === 'sell' ? 'Sell ' : 'Buy ') + t.entry + ', stop ' + t.stop + (t.target != null ? ', target ' + t.target : '') + '.' }, { t: 'exit', text: 'The trade ends here.' }] };
  }
  // A lesson as a chart: the desk's own reading when it has drawn one (its marks and steps, checked by the server), else the
  // teacher's levels alone. null when the lesson has neither. H4 candles start at 17:00 New York (21:00 or 22:00 UTC).
  function usSummer(t) { var d = new Date(t * 1000), y = d.getUTCFullYear(), nth = function (m, n) { var f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - f) % 7) + 7 * (n - 1), 7) / 1000; }; return t >= nth(2, 2) && t < nth(10, 1); }
  function specOfLesson(l, now) {
    var c = l && l.chart, t = l && l.trade;
    if (c) return { id: 'lesson-' + l.id, lesson: true, title: l.title, label: 'The desk\'s reading of this lesson', market: c.market, side: c.side || (t && t.side) || 'sell', entry: c.entry, stop: c.stop, target: c.target,
      base: c.base, tfs: c.base === '15m' ? [900, 3600, 14400] : [300, 900, 3600], h4off: usSummer(c.from) ? 3600 : 7200, from: c.from, to: c.to, fillFrom: c.fillFrom != null ? c.fillFrom : c.from, yours: 'the levels as the desk read them', marks: c.marks || [], steps: c.steps || [] };
    if (!t) return null;
    var s = specOfTrade({ id: l.id, market: t.market, side: t.side, at: t.at, entry: t.entry, stop: t.stop, target: t.target, status: 'open' }, now);
    s.id = 'lesson-' + l.id; s.lesson = true; s.title = l.title; s.label = 'The levels of this lesson'; s.yours = 'the levels you gave'; return s;
  }
  // the hand-over to ChronosTrade: the same market from the moment before the entry forms, with the marks already known then
  function handoff(spec, now) {
    var vr = (spec.marks || []).filter(function (m) { return m.kind === 'vr' || m.kind === 'bvr'; })[0], start = spec.handFrom || (vr ? (vr.at || vr.a) : spec.fillFrom - 3600), draw = [];
    (spec.marks || []).forEach(function (m) { if ((m.at != null ? m.at : m.a) > start) return; var b = Math.min(m.b, start), a = Math.max(m.a, start - 86400); if (b <= a) return;   // a line from weeks back starts a day before: ChronosTrade loads about a day of candles before the start
      if (m.kind === 'level') draw.push({ type: 't', t1: a, p1: m.p, t2: b, p2: m.p }); else draw.push({ type: 'r', t1: a, p1: m.top, t2: b, p2: m.bot }); });
    return { made: now, sym: spec.market, tf: '5m', start: start, days: 3, name: 'Mosha ' + spec.title + (spec.entry != null ? ' · ' + spec.entry + ' / ' + spec.stop + (spec.target != null ? ' / ' + spec.target : '') : ''), draw: draw };
  }
  var API = { EXAMPLES: EXAMPLES, STUDIES: STUDIES, tfsOf: tfsOf, follow: follow, specOfLesson: specOfLesson, usSummer: usSummer, aggBars: aggBars, barAt: barAt, outcome: outcome, stepsOf: stepsOf, stepAt: stepAt, marksAt: marksAt, specOfTrade: specOfTrade, handoff: handoff };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_RP = API;
  if (typeof document === 'undefined') return;

  // ─── the chart ───
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TFS = [[300, 'M5'], [900, 'M15'], [3600, 'H1'], [14400, 'H4']], SPEEDS = [[1, 420], [3, 140], [10, 40]];
  var R = { spec: null, base: null, bars: null, oc: null, steps: [], tf: 300, cur: 0, timer: 0, speed: 1, chart: null, series: null, cache: {}, lo: 0, hi: 0, token: 0 };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var utc = function (t) { return new Date(t * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' UTC'; };
  var css = function (n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; };
  var light = function () { return document.documentElement.dataset.theme === 'light'; };
  var candleCols = function () { return light() ? { upColor: '#c9ccd2', downColor: '#131722', borderUpColor: '#131722', borderDownColor: '#131722', wickUpColor: '#131722', wickDownColor: '#131722' } : { upColor: '#089981', downColor: '#f23645', borderUpColor: '#089981', borderDownColor: '#f23645', wickUpColor: '#089981', wickDownColor: '#f23645' }; };
  var COL = function () { return light()
    ? { level: '#8e24aa', vr: '#d32f2f', vrF: 'rgba(211,47,47,.05)', bvr: '#2e7d32', bvrF: 'rgba(46,125,50,.06)', zone: 'rgba(126,87,194,.22)', zoneS: 'rgba(126,87,194,.55)', htf: 'rgba(126,87,194,.10)', stop: 'rgba(233,30,99,.20)', tgt: 'rgba(84,96,116,.22)', ink: '#131722', tag: '#ffffff' }
    : { level: '#ce93d8', vr: '#ff6b6b', vrF: 'rgba(255,107,107,.07)', bvr: '#66bb6a', bvrF: 'rgba(102,187,106,.08)', zone: 'rgba(179,157,219,.24)', zoneS: 'rgba(179,157,219,.6)', htf: 'rgba(179,157,219,.10)', stop: 'rgba(244,95,119,.24)', tgt: 'rgba(160,170,190,.20)', ink: '#e8eaf0', tag: '#12151c' }; };

  function build() {
    var host = $('mo-rp-chart'); if (!host || R.chart || !root.LightweightCharts) return !!R.chart;
    var LW = root.LightweightCharts, ink = css('--ink-dim', '#9aa3b2'), line = css('--line', 'rgba(128,128,128,.2)');
    R.chart = LW.createChart(host, { autoSize: true, layout: { background: { color: 'transparent' }, textColor: ink, fontSize: 12 }, grid: { vertLines: { color: 'transparent' }, horzLines: { color: line } },
      rightPriceScale: { borderColor: line }, timeScale: { borderColor: line, timeVisible: true, secondsVisible: false, rightOffset: 2 }, crosshair: { mode: 0 }, handleScale: { axisPressedMouseMove: false } });
    R.series = R.chart.addCandlestickSeries(Object.assign({ priceLineVisible: false, lastValueVisible: true, autoscaleInfoProvider: function () { return R.hi > R.lo ? { priceRange: { minValue: R.lo, maxValue: R.hi } } : null; } }, candleCols()));
    R.chart.timeScale().subscribeVisibleLogicalRangeChange(function () { paint(); });
    if (root.ResizeObserver) new ResizeObserver(function () { paint(); }).observe(host);
    new MutationObserver(function () { if (!R.chart) return; R.series.applyOptions(candleCols()); R.chart.applyOptions({ layout: { textColor: css('--ink-dim', '#9aa3b2') }, grid: { horzLines: { color: css('--line', 'rgba(128,128,128,.2)') } } }); paint(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return true;
  }
  // the marks, on a canvas over the chart (redrawn on every move of the chart or the replay)
  function paint() {
    var cv = $('mo-rp-ov'), host = $('mo-rp-chart'); if (!cv || !host || !R.chart || !R.bars || !R.spec) return;
    var dpr = Math.min(root.devicePixelRatio || 1, 2), W = host.clientWidth, H = host.clientHeight; if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    var ts = R.chart.timeScale(), plotW = ts.width(), plotH = H - 26, C = COL(), now = R.bars[R.cur].time + R.tf - 1, sp = R.spec;
    var X = function (t) { var i = barAt(R.bars, t); if (i < 0) i = 0; var v = ts.logicalToCoordinate(i); return v == null ? null : v; }, Y = function (p) { var v = R.series.priceToCoordinate(p); return v == null ? null : v; };
    x.save(); x.beginPath(); x.rect(0, 0, plotW, plotH); x.clip(); x.font = '600 12px ' + css('--sans', 'system-ui, sans-serif'); x.textBaseline = 'middle';
    var narrow = plotW < 520;   // a phone: only the labels that carry the trade
    var tag = function (txt, px, py, col) { var w = x.measureText(txt).width + 10; px = Math.max(2, Math.min(px, plotW - w - 2)); py = Math.max(10, Math.min(py, plotH - 10)); x.fillStyle = C.tag; x.globalAlpha = .85; x.fillRect(px, py - 9, w, 18); x.globalAlpha = 1; x.fillStyle = col; x.fillText(txt, px + 5, py + .5); };
    marksAt(sp, now).forEach(function (m) {
      var x1 = X(m.a), x2 = X(m.b); if (x1 == null || x2 == null) return; if (x2 < x1 + 2) x2 = x1 + 2;
      if (m.kind === 'level') { var y = Y(m.p); if (y == null) return; x.strokeStyle = C.level; x.lineWidth = 2; x.beginPath(); x.moveTo(x1, y); x.lineTo(x2, y); x.stroke(); if (!(narrow && m.under && !m.keep)) tag(m.label, m.left ? x1 - x.measureText(m.label).width - 14 : x1 + 4, m.left ? y : y + (m.under ? 12 : -12), C.level); return; }
      var yt = Y(m.top), yb = Y(m.bot); if (yt == null || yb == null) return;
      if (m.kind === 'vr' || m.kind === 'bvr') { var col = m.kind === 'vr' ? C.vr : C.bvr; x.fillStyle = m.kind === 'vr' ? C.vrF : C.bvrF; x.fillRect(x1, yt, x2 - x1, yb - yt); x.strokeStyle = col; x.lineWidth = 1.5; x.strokeRect(x1 + .5, yt + .5, x2 - x1, yb - yt); if (!(narrow && x2 - x1 < 30)) tag(m.label, (x1 + x2) / 2 - 16, yt - 11, col); }
      else if (m.kind === 'zone') { x.fillStyle = C.zone; x.fillRect(x1, yt, x2 - x1, yb - yt); x.fillStyle = C.zoneS; x.fillRect(x1, yt, 2, yb - yt); if (!narrow || m.keep) tag(m.label, x1 + 6, m.under ? yb + 11 : m.over ? yt - 11 : (yt + yb) / 2, C.level); }
      else { x.fillStyle = C.htf; x.fillRect(x1, yt, x2 - x1, yb - yt); tag(m.label, x1 + 6, (yt + yb) / 2, C.level); }
    });
    // the position: red band entry to stop, grey band entry to target, from the fill to the exit (or to now)
    var oc = R.oc; if (oc && oc.fill != null && oc.fill <= now) {
      var a = X(oc.fill), b = X(oc.exit != null && oc.exit <= now ? oc.exit : now), ye = Y(sp.entry), ys = Y(sp.stop), yg = sp.target != null ? Y(sp.target) : null;
      if (a != null && b != null && ye != null && ys != null) { if (b < a + 6) b = a + 6;
        x.fillStyle = C.stop; x.fillRect(a, Math.min(ye, ys), b - a, Math.abs(ys - ye)); if (yg != null) { x.fillStyle = C.tgt; x.fillRect(a, Math.min(ye, yg), b - a, Math.abs(yg - ye)); }
        x.strokeStyle = C.ink; x.lineWidth = 1; x.beginPath(); x.moveTo(a, ye + .5); x.lineTo(b, ye + .5); x.stroke();
        if (b - a >= 200) tag('Stop ' + sp.stop, b - 96, ys + (sp.side === 'sell' ? 11 : -11), light() ? '#c2185b' : '#ff8fab'); else if (!narrow) tag('Stop ' + sp.stop, b + 6, ys, light() ? '#c2185b' : '#ff8fab');   /* a position too narrow on screen for its tags: the stop's goes beside it (on a phone the line above the chart names it) */ tag((sp.side === 'sell' ? 'Sell ' : 'Buy ') + sp.entry, a + 4, ye + (sp.side === 'sell' ? -11 : 11), C.ink); if (yg != null) tag('Target ' + sp.target, b - 108, yg + (sp.side === 'sell' ? -11 : 11), C.ink);
        if (oc.exit != null && oc.exit <= now && oc.px != null) { var yx = Y(oc.px); if (yx != null) { x.fillStyle = oc.R > 0 ? css('--buy', '#089981') : css('--sell', '#f23645'); x.beginPath(); x.arc(b, yx, 5, 0, 7); x.fill(); } } }
    }
    x.restore();
  }
  function caption() {
    if (!R.bars || !R.bars.length) return;
    var now = R.bars[R.cur].time + R.tf - 1, k = stepAt(R.steps, now), box = $('mo-rp-cap'), st = $('mo-rp-steps');
    if (box) { var txt = k < 0 ? 'Press play, or step through.' : (k + 1) + ' of ' + R.steps.length + ' · ' + R.steps[k].text; if (box.textContent !== txt) box.textContent = txt; }
    if (st) Array.prototype.forEach.call(st.children, function (b, i) { b.setAttribute('aria-current', i === k ? 'step' : 'false'); b.classList.toggle('done', i < k); });
    var clock = $('mo-rp-clock'); if (clock) clock.textContent = utc(R.bars[R.cur].time); var sl = $('mo-rp-slider'); if (sl && +sl.value !== R.cur) sl.value = R.cur;
    var pl = $('mo-rp-play'); if (pl) { pl.textContent = R.timer ? 'Pause' : R.cur >= R.bars.length - 1 ? 'Play again' : 'Play'; pl.setAttribute('aria-pressed', R.timer ? 'true' : 'false'); }
  }
  function show(i) { if (!R.bars) return; R.cur = Math.max(0, Math.min(R.bars.length - 1, i)); R.series.setData(R.bars.slice(0, R.cur + 1)); caption(); requestAnimationFrame(paint); }
  function stop() { if (R.timer) { clearInterval(R.timer); R.timer = 0; } caption(); }
  function play() { if (!R.bars) return; if (R.timer) return stop(); if (R.cur >= R.bars.length - 1) show(0);
    var ms = (SPEEDS.filter(function (s) { return s[0] === R.speed; })[0] || SPEEDS[0])[1] * (R.tf <= 300 ? 1 : R.tf <= 900 ? 1.6 : 2.4);
    R.timer = setInterval(function () { if (R.cur >= R.bars.length - 1 || !$('mo-rp-chart') || $('v-mosha').hidden) return stop(); show(R.cur + 1); }, ms); caption(); }
  function setTf(sec, keep) {
    var t = keep && R.bars ? R.bars[R.cur].time : null; R.tf = sec; R.bars = aggBars(R.base, sec, sec === 14400 ? R.spec.h4off : 0);
    var lo = Infinity, hi = -Infinity; R.bars.forEach(function (b) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; });
    [R.spec.entry, R.spec.stop, R.spec.target].concat((R.spec.marks || []).filter(function (m) { return m.kind !== 'htf'; }).map(function (m) { return m.p != null ? m.p : m.top; })).forEach(function (p) { if (p == null) return; if (p < lo) lo = p; if (p > hi) hi = p; });
    var pad = (hi - lo) * .04; R.lo = lo - pad; R.hi = hi + pad;
    var sl = $('mo-rp-slider'); if (sl) sl.max = R.bars.length - 1;
    Array.prototype.forEach.call(document.querySelectorAll('#mo-rp-tf button'), function (b) { b.setAttribute('aria-pressed', String(+b.dataset.tf === sec)); });
    show(t != null ? Math.max(0, barAt(R.bars, t)) : R.bars.length - 1); R.chart.timeScale().setVisibleLogicalRange({ from: -1, to: R.bars.length + 3 });
  }
  function result() {
    var el = $('mo-rp-res'), oc = R.oc, sp = R.spec; if (!el) return;
    if (sp.entry == null && !sp.watch) { el.innerHTML = '<b>' + esc(sp.title) + '</b> · marks only, no position<small>' + esc(sp.label || '') + '.</small>'; return; }   // a lesson the desk marked without a trade
    if (sp.entry == null) { var f = follow(sp, R.base), dn = sp.side === 'sell';   // a picture without a position
      el.innerHTML = '<b>' + esc(sp.title) + '</b> · no position is drawn on this screenshot<small>On our candles: ' + esc(!f ? 'the candle it points at is not in the feed' : 'the ' + utc(f.t) + ' candle closed at ' + f.px.toFixed(1) + '. After it price went ' + f.worst.toFixed(1) + ' ' + (dn ? 'up' : 'down') + ' at most, then ' + f.best.toFixed(1) + ' ' + (dn ? 'down' : 'up') + ', to ' + f.bestPx.toFixed(1) + ' at ' + utc(f.bestT)) + '.</small>'; return; }
    var ours = !oc || oc.fill == null ? 'the entry price was not traded on our candles at that time' : oc.kind === 'target' ? 'filled ' + utc(oc.fill) + ', target reached ' + utc(oc.exit) + ' (' + fR(oc.R) + '), worst point ' + oc.worst.toFixed(2) + 'R against'
      : oc.kind === 'stop' ? 'filled ' + utc(oc.fill) + ', stopped ' + utc(oc.exit) : oc.kind === 'hand' ? 'filled ' + utc(oc.fill) + ', closed ' + utc(oc.exit) + ' (' + fR(oc.R) + '), worst point ' + oc.worst.toFixed(2) + 'R against' : 'filled ' + utc(oc.fill) + ', neither stop nor target by the end of the window';
    el.innerHTML = '<b>' + esc(sp.title) + '</b> · ' + (sp.side === 'sell' ? 'sell ' : 'buy ') + esc(sp.entry) + ' · stop ' + esc(sp.stop) + (sp.target != null ? ' · target ' + esc(sp.target) : '') + '<small>' + (sp.lesson ? 'The lesson: ' : 'You: ') + esc(sp.yours || '—') + '. On our candles: ' + esc(ours) + '.</small>';
  }
  function open(spec, scroll) {
    var card = $('mo-replay'); if (!card) return; stop(); R.spec = spec; var tk = ++R.token, msg = $('mo-rp-msg');
    Array.prototype.forEach.call(document.querySelectorAll('#mo-rp-pick button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.ex === spec.id)); });
    $('mo-rp-label').textContent = spec.label ? '"' + spec.label + '"' : '';
    if (scroll) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (!root.LightweightCharts) { msg.hidden = false; msg.textContent = 'The chart library did not load. Reload the page.'; return; }
    var done = function (m5) { if (tk !== R.token) return; if (!m5 || m5.length < 20) { msg.hidden = false; msg.textContent = 'No candles came back for that time. The chart needs the live site and an open candle feed.'; return; }
      msg.hidden = true; build(); R.base = m5; R.oc = outcome(spec, m5); R.steps = stepsOf(spec, R.oc);
      var list = tfsOf(spec); if (spec.view && R.viewOf !== spec.id) R.tf = spec.view; if (list.indexOf(R.tf) < 0) R.tf = list[0]; R.viewOf = spec.id;   // a bigger picture opens on its own candle size
      $('mo-rp-tf').innerHTML = TFS.filter(function (t) { return list.indexOf(t[0]) >= 0; }).map(function (t) { return '<button type="button" data-tf="' + t[0] + '" aria-pressed="' + (t[0] === R.tf) + '">' + t[1] + '</button>'; }).join('');
      $('mo-rp-steps').innerHTML = R.steps.map(function (s, i) { return '<button type="button" data-step="' + i + '" title="' + esc(s.text) + '">' + (i + 1) + '</button>'; }).join('');
      result(); setTf(R.tf); };
    var ck = spec.id + ':' + spec.from + ':' + spec.to + ':' + (spec.base || '5m');   // a lesson's chart can change: the candles are kept per window
    if (R.cache[ck]) return done(R.cache[ck]);
    msg.hidden = false; msg.textContent = 'Loading the candles…';
    fetch('/md/bars?sym=' + encodeURIComponent(spec.market) + '&tf=' + (BASE[spec.base] ? spec.base : '5m') + '&from=' + spec.from + '&to=' + spec.to, { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var bars = j && Array.isArray(j.bars) ? j.bars.filter(function (b) { return !b.live; }).map(function (b) { return { time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }; }) : null; if (bars && bars.length >= 20) R.cache[ck] = bars; done(bars); })
      .catch(function () { done(null); });
  }
  function wire() {
    var card = $('mo-replay'); if (!card || card.dataset.wired) return; card.dataset.wired = '1';
    var pick = function (e) { return '<button type="button" data-ex="' + e.id + '" aria-pressed="false">' + esc(e.title) + '</button>'; };
    $('mo-rp-pick').innerHTML = EXAMPLES.map(pick).join('') + '<span class="mo-rp-k mo-rp-sep">The bigger picture</span>' + STUDIES.map(pick).join('');
    $('mo-rp-speed').innerHTML = SPEEDS.map(function (s) { return '<button type="button" data-sp="' + s[0] + '" aria-pressed="' + (s[0] === R.speed) + '">' + s[0] + '×</button>'; }).join('');
    card.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.ex) open(ALL.filter(function (e) { return e.id === b.dataset.ex; })[0]);
      else if (b.dataset.tf) { if (R.base) { stop(); setTf(+b.dataset.tf, true); } }
      else if (b.dataset.sp) { R.speed = +b.dataset.sp; Array.prototype.forEach.call(document.querySelectorAll('#mo-rp-speed button'), function (x) { x.setAttribute('aria-pressed', String(+x.dataset.sp === R.speed)); }); if (R.timer) { stop(); play(); } }
      else if (b.dataset.step != null) { if (R.bars) { stop(); show(Math.max(0, barAt(R.bars, R.steps[+b.dataset.step].t))); } }
      else if (b.id === 'mo-rp-play') play();
      else if (b.id === 'mo-rp-start') { stop(); show(0); }
      else if (b.id === 'mo-rp-back') { stop(); show(R.cur - 1); }
      else if (b.id === 'mo-rp-fwd') { stop(); show(R.cur + 1); }
      else if (b.id === 'mo-rp-end') { stop(); if (R.bars) show(R.bars.length - 1); }
      else if (b.id === 'mo-rp-ct') { if (!R.spec) return; try { localStorage.setItem('btLab:handoff', JSON.stringify(handoff(R.spec, Date.now()))); } catch (e) {} location.href = '/backtest'; }
    });
    $('mo-rp-slider').addEventListener('input', function (ev) { var v = +ev.target.value; stop(); show(v); });   // read the value first: stop() redraws the slider at the old place
    card.addEventListener('keydown', function (ev) { if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) && ev.target.id !== 'mo-rp-slider') return; if (ev.key === 'ArrowRight' && ev.target.id !== 'mo-rp-slider') { stop(); show(R.cur + 1); ev.preventDefault(); } else if (ev.key === 'ArrowLeft' && ev.target.id !== 'mo-rp-slider') { stop(); show(R.cur - 1); ev.preventDefault(); } });
  }
  root.msMoshaReplay = function () { wire(); if (!R.spec) open(EXAMPLES[0]); else requestAnimationFrame(paint); };
  root.msMoshaReplayTrade = function (t) { wire(); open(specOfTrade(t, Math.floor(Date.now() / 1000)), true); };
  root.msMoshaReplayLesson = function (l) { var sp = specOfLesson(l, Math.floor(Date.now() / 1000)); if (!sp) return false; wire(); open(sp, true); return true; };
  root.msMoshaReplayStop = stop;
  { var v0 = $('v-mosha'); if (v0 && !v0.hidden) root.msMoshaReplay(); }   // the desk was already open when this file ran
})(typeof window !== 'undefined' ? window : globalThis);
