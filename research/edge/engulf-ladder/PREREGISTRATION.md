# Engulf ladder on gold (Daily → H4 → H1): pre-registration

Written and committed on 13 Nov 2026, alone, before any candle of this study was read and before any trade of this rule was
simulated. Paper research only: no live rule, size, filter, stop, config, council member, page or mirror setting is changed by
this study, whatever it finds.

## What this is, and what it is not

A **new, stand-alone rule**, never tested in this repository: an engulf zone on the Daily, price coming back into it, an H4
engulf inside that zone, an H1 engulf inside the H4 zone, and a limit order in the middle of the H1 zone. It comes from the
owner's course material on engulf zones (kept privately; everything below is my own wording, nothing is quoted).

It is **not** the live Gold daily engulf (`geg`) and does not touch it: the owner's rule of 12 Nov 2026 (docs/owner-decisions.md
item 44) forbids testing new gates, exits, entries or sizes on that book. Nothing here reads or changes `council/trader.mjs`, the
`geg` block, `council/decay-base.json`, `council/expect-base.json` or the forward-test protocol. The only council code imported is
`council/fills.mjs` (`nights`, `FIN`) for the overnight financing charge.

## What I already know, said plainly

- In the owner's own 14-year gold tests (from the course material): an H4 engulf zone confirmed by an H1 engulf did **worse**
  than the plain zone (profit factor 0.78-0.90), and raw engulf zones on their own had **no edge** (profit factor about 1.0).
  So I expect this ladder to fail; it is run because the owner asked for this exact rule, with a Daily zone on top and a
  stop under the H4 zone, which those tests did not cover.
- `research/edge/msnr-entry` (11 Nov): an M15 → M5 engulf entry on gold lost after costs (−0.11 to −0.17R a trade, 0 of 3).
- `research/edge/geg-variants` and `gold-weekend` read the live Daily engulf; this rule differs (three timeframes, limit in the
  H1 zone, stop under the H4 zone, 2R, 5 days).
- Gold rose strongly in 2020-26: a buy stream that makes money proves little; the placebo below is matched in side for that.
- I have not computed an engulf zone, a ladder or a trade of this rule on any data before writing this file.

## Data

- OANDA spot gold (XAU/USD) **mid H1** candles through the keyless candle proxy (`/md/bars?sym=xau&tf=1h`), from 1 Jul 2019
  (six months of warm-up for the zones) to the last complete candle at the run; kept out of git (`node --use-env-proxy
  run.mjs fetch <dir>`). Candles still forming (`live`) are dropped.
- **One source, every timeframe.** Daily and H4 are built from the H1 file on the **17:00 New York trading day**
  (`research/edge/gold-drd-long` `nyDay`: hours of Friday 17:00 to Sunday 17:00 New York are dropped, Sunday evening belongs to
  Monday). So there is no Sunday stub candle (the problem `foldWeekend` solves for the live engulf does not arise). H4 candles are
  the 4-hour blocks of that day starting 17:00, 21:00, 01:00, 05:00, 09:00, 13:00 New York.
- A Daily or H4 candle exists for the rule only from the end of its last H1 hour (closed candles only).
- **Window: trades whose fill is from 1 Jan 2020 to the end of the data. Halves: 2020-01-01 to 2023-12-31 | 2024-01-01 on.**
  Nothing is fitted: every number is fixed in this file.

## The rule (buy side; sell is the mirror)

**Engulf buy zone** on a timeframe (Daily, H4 or H1): a **red** base candle (close < open). If one of the **next one to three
candles** closes its body **above the base candle's high** (close > high), and no candle before it closed below the base's low,
the zone is born at that candle's close. Zone = the base candle's **low to high** (wicks included). It stays **live until a later
candle of the same timeframe closes below the zone's low** (the far side). Sell zone: a green base, a close below its low within
1-3 candles, zone = low to high, dead on a close above the high.

**Ladder**
1. A **live Daily buy zone** D (born before, not dead).
2. **Return**: the first H1 candle after D's birth whose low reaches D's high or lower ("the touch"). From the touch the ladder
   looks for 10 trading days, or until D dies, whichever comes first. One touch per Daily zone (a zone is used once).
3. **H4 engulf inside D**: an H4 buy zone F whose base candle opens at or after the touch candle's H4 block and whose **base low
   lies inside D** (D.low ≤ base low ≤ D.high), born inside the 10-day window while D is live. The first such F is used.
4. **H1 engulf inside F**: an H1 buy zone G whose base candle opens after F's birth, whose **base low lies inside F**, born within
   **24 H1 candles** of F's birth while F is live. The first such G is used.
5. **Order**: a buy limit at the **50 % of G** ((G.high + G.low) / 2), placed at G's birth close, valid for 24 H1 candles,
   cancelled if F dies first. **Stop: $0.30 under F's low** (never just under G). Risk = entry − stop; an order with risk under
   $1.00 is not placed. **Target 2R. Out at the close of the 5th trading day after the fill day.**
6. Fills on H1 candles after the order: filled when a candle's low reaches the limit (at the limit; at the open if the candle
   opens beyond it). In any candle that reaches both stop and target the stop is taken first; a fill candle that also reaches the
   stop is a loss. A stop through a gap fills at the open.
7. **One at a time**: an order is ignored while another order of the study is pending or a position is open. Signals are taken
   in time order of G's birth; buys and sells share the one slot.

Costs: **$0.30 a round trip** on every trade, plus **overnight financing on buys**: `nights(fill, exit) x FIN.xau.long x entry /
risk` (council/fills.mjs, today's demo rate charged for every year; sells are charged and credited nothing). R is per unit of
initial risk; result `net = R − 0.30 / risk − financing`.

**Sideways approach** (for T2): the efficiency ratio of the **last 12 closed H4 candles before the touch candle's H4 block**:
`ER = |close12 − close0| / Σ|close(k) − close(k−1)|` over the 13 closes ending at the last H4 candle closed before the touch.
**Sideways if ER < 0.30, momentum otherwise.** The cut is fixed here and not moved.

## Tests (three, Holm over the three)

- **T1, the ladder** (50 % entry, buys and sells together). Pass needs all of: net R a trade > 0 in **2020-23** and in
  **2024-on**; t ≥ 2 on **calendar-month sums** of net R over the whole window (every month counts, a month without a trade is
  0); Holm-adjusted p < 0.05 (two-sided normal p from that t); and the ladder's mean net R above **38 of 40** placebo means.
- **T2, sideways vs momentum approach** (same trades as T1, split by the ER cut). Pre-specified direction: sideways better.
  Pass: Welch t of (sideways − momentum) mean net R ≥ 2, the difference positive in both halves, Holm p < 0.05.
- **T3, 50 % entry vs the zone's near edge** (G's high for a buy, G's low for a sell; same signals as T1's one-at-a-time list,
  same stop, 2R from that entry, same hold and costs). Pre-specified direction: the 50 % better. Pass: Welch t of
  (50 % − near edge) mean net R ≥ 2, positive in both halves, Holm p < 0.05. Also shown: R per signal with unfilled = 0.

**Placebo for T1**: for every T1 trade, one random entry per seed: the open of a random H1 candle in the **same calendar month**
(trading hours), the **same side**, the **same stop distance** in dollars, 2R, 5 trading days, same costs. 40 seeds (fixed
seeds 1-40); each seed's mean net R is one placebo mean.

**Verdict**: PASS only if T1 passes. T2 and T3 are read only as splits; they cannot turn a T1 fail into a pass. Also reported
(descriptive, not tests): buys and sells apart, by year, win rate, profit factor, worst drawdown, the funnel (Daily zones,
touches, H4 confirmations, H1 confirmations, orders, fills).

**If T1 passes**: a proposal in `research/proposals/2026-11-13-engulf-ladder.md` for the owner (paper shadow first). **If not**:
no proposal, nothing changes. Either way no live change.

## Not decided by this test

Hand-chosen zones, zone quality grades, the course's other zone kinds (failed engulfs, dominant zones), a session filter, other
markets, trade management by hand. Each would need its own pre-registration.
