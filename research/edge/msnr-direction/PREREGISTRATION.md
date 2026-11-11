# MSNR direction call: pre-registration

Written and committed on 11 Nov 2026, before any number of this study was computed. Paper research only: no live rule,
size, filter, council member, page or mirror setting is changed by this study, whatever it finds.

## Why

The owner's "MSNR direction SOP" skill (kept privately, not in this repository; everything below is my own wording of it)
gives a way to call the market's direction: buy, sell, or not decided. In short: on the working timeframe, find a breakout
that switches the structure, and accept it only when it is an *external* one and price had first reached a key level of the
timeframe one step above. Until the opposite sequence completes, the call stays where it was.

The skill covers direction only: no entry, stop or target. So this is a **direction filter test**, not a trading system. No
entry, stop or exit is simulated. The one question: computed mechanically and with no look-ahead, does the call say anything
about where gold's daily close goes next, beyond what gold did anyway in the same period?

What I already know, said plainly. Gold rose strongly in 2020-26, so a "buy" call followed by a rise proves nothing; every
comparison below is against the base rate of the same window. The Daily-ER filter of the gold playbook failed the council's
own test (6 Nov), and five Mosha studies of 10 Nov found no edge in break-of-swing rules on gold. I have not computed this
call, or anything like it, on any data before writing this file. I looked at eight H4 candles of June 2006 and 45 candle
times of September 2026 to see how the candle proxy aligns H4 candles (00:00, 04:00, ... UTC, a Sunday 20:00 candle); no
price outcome was read.

## Data and windows

- OANDA spot gold (XAU/USD) mid candles, H4, UTC-aligned, through the candle proxy (`/md/bars?sym=xau&tf=4h`), from
  1 June 2006 to the day of the run, fetched in windows of at most 4,999 candles, cached outside git. Complete candles only.
- **One source, three timeframes.** Daily and weekly candles are built from those H4 candles, so no timeframe can know more
  than another: a **day** is the UTC date of the H4 candle's open, with Sunday's candles counted into Monday; a **week** is
  the Monday-to-Friday run of those days. The daily close is the close of the day's last H4 candle.
- **Window A: 1 Jan 2007 to 31 Dec 2019** (untouched by any test of this repository's last days on this rule family at
  H4 / Daily / Weekly). **Window B: 1 Jan 2020 to 31 Oct 2026** (absolute rule 4). June to December 2006 is warm-up only.
- No parameter is chosen from either window: everything is fixed in this file. Both windows are therefore tests. **B is the
  confirmation window** (the verdict's t is read there); **A is the replication window** (the sign must agree).

## The call, mechanically (written for a switch to BUY; SELL is the mirror image)

Constants: `K = 2` (swing size on every timeframe), `ZONE_AGE = 60` higher-timeframe candles, `WAIT = 10` higher-timeframe
candles.

Two ladders, both the skill's own steps (working timeframe, then one step above):

- **L1: working H4, key levels on the Daily** (the skill's worked examples).
- **L2: working Daily, key levels on the Weekly.**

Everything is computed candle by candle in time order; a decision at a candle's close uses only candles closed by then. A
higher-timeframe candle counts as closed when the first working candle of the next day (week) opens.

1. **Swing levels (working timeframe).** A swing high ("A-level") is a candle whose high is not below the 2 highs before it
   and above the 2 highs after it. It exists from the close of the 2nd candle after it. A swing low ("V-level") is the mirror.
2. **Plain breakouts (working timeframe).** A candle that closes above the most recent existing A-level not yet closed above
   is a breakout up (each level breaks once). Mirror for a breakout down. The **structure** is the side of the last plain
   breakout.
3. **Key levels, one timeframe above.** Four kinds, each a price zone `[bottom, top]`, known from the close of the
   higher-timeframe candle that completes it. Support zones (for a buy):
   - **Swing zone**: a higher-timeframe V-level (rule 1 on that timeframe): from the swing candle's low up to the bottom of
     its body (the lower of its open and close). This holds both the wick level and the open-close level.
   - **Engulfing zone**: a rising candle that closes above the high of the falling candle before it: from the lower of the
     two lows up to the falling candle's high (the repository's existing engulf zone, as in the Mosha studies).
   - **Failed engulfing zone**: a bearish engulfing zone (the mirror of the above) that a later higher-timeframe candle
     closes above: same prices, a support zone from that close.
   - **Dominant zone**: two rising candles in a row, the second with a higher high and a close above the first's high: the
     first candle's body (open to close).
   A support zone is **live** from the moment it is known until a higher-timeframe candle closes below its bottom, and for
   at most 60 higher-timeframe candles. The skill does not define the engulfing and failed-engulfing zones in the session
   it comes from; the two definitions above are mine and are part of what is tested.
4. **Tap.** A working candle that opens after a support zone is known, while the zone is live, and whose range overlaps the
   zone (low at or below the top, high at or above the bottom) taps it. Only the **first** tap of each zone counts.
5. **The external level.** At a zone's first tap, if the structure at that candle's open is DOWN (the last plain breakout
   was a breakout down), the most recent A-level that existed at that candle's open and has not been closed above is frozen
   as that tap's external level. No such level, or the structure is not down: the tap gives nothing. A-levels that form
   after the tap are internal: breaking them changes nothing.
6. **The switch.** The first working candle after the tap candle that closes above the frozen external level, while the
   zone is still live and within 10 higher-timeframe candles of the tap, sets the call to **BUY** from that candle's close.
7. **Persistence.** The call is `none` until the first switch, then stays as it is until a full switch the other way
   (resistance zone tapped while the structure is up, then a close below the frozen external V-level).

The no-look-ahead property is tested directly: computing the call on the candles up to t gives the same call at t as
computing it on the whole file.

## What is measured

For each ladder, at each daily close `t` inside a window, the call `s_t` (+1 buy, -1 sell, 0 none) as known at that close,
and the forward log return of gold over the next `h` daily closes, `r_t,h = ln(C_t+h / C_t)`, for `h = 1, 5, 20`. Returns
whose end falls outside the window are dropped.

- **Excess** `e_t = s_t x (r_t,h - m_h)` on the days with a call, where `m_h` is the mean `r_t,h` over **all** days of the
  same window (call or no call). Following a buy call in a rising market earns nothing here unless the days called buy rose
  by more than the average day. **Statistic: the mean of `e_t`, tested > 0** (one-sided).
- **t**: Newey-West (Bartlett kernel), lag `max(5, 2 x (h - 1))`, because forward windows overlap and the call persists.
  Also reported, as a check only: the plain t on non-overlapping samples (every h-th day).
- **Hit rate vs base**: the share of call days where `s_t x r_t,h > 0`, against the hit rate the same number of buy and
  sell days would have had if the call knew nothing (`n_buy x P(up) + n_sell x P(down)`, over `n`, with P from all days of
  the window). Reported with n, the number of buy and sell days, and the number of switches.

## Tests (fixed: six)

`2 ladders x 3 horizons = 6` tests: L1-h1, L1-h5, L1-h20, L2-h1, L2-h5, L2-h20. Each is computed on A and on B. Holm
correction over the six one-sided p-values of window B (normal approximation of the Newey-West t).

Reported but **not tests** (descriptive, never a verdict, never promoted): the share of days in each state; the number of
switches; and the same six cells for a "breakout only" call that drops rules 3 to 6 (the call is simply the structure of
rule 2), to show whether the key-level tap and the external rule add anything to a plain break of swing.

## Verdict (fixed here)

A test **passes** when all three hold: Newey-West `t >= 2.0` in window B; mean excess > 0 in window A as well; Holm-adjusted
p < 0.05 over the six window-B tests.

- **PASS**: at least one of the six tests passes.
- **FAIL**: no test has `t >= 2.0` in window B together with a positive mean excess in window A.
- **INCONCLUSIVE**: anything else (a test reaches `t >= 2.0` in B with the same sign in A but does not survive Holm).

A cell that looks good outside this bar (one horizon, one window, the breakout-only call) is a hypothesis for a new
pre-registration, not a result.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner is to record the call as a paper tag on gold trades
(as the NQ regime tag), never as a filter before a forward record exists. On FAIL or INCONCLUSIVE the result is published as
it is. If a bug is found after the run, it is fixed, said in RESULT.md, and everything is re-run.
