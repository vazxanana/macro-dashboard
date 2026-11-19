# Gold's daily reopen gap (NDOG): fade, follow, or magnet? (pre-registration)

Written and pushed alone, before any trade of this study was computed. Paper research only.

**A new stand-alone intraday rule, not a gate, exit, entry or size of the gold book** (Gold trend + Gold daily engulf). Item 44
of `docs/owner-decisions.md` is respected: nothing here reads, filters or changes the book's trades, no candle before
2015-12-01 is read (December 2015 only as the warm-up of the 20-day ATR), and no live rule, config, council member or mirror
setting changes whatever the result.

## Dedupe: what was already tested, and what is new here

Read before writing (RESULT.md of each):
- `gold-weekend-gap` (branch): fading gold's SUNDAY reopen gap to Friday's close. FAIL (2020 on −0.109R, n 41). The weekend is
  left out here.
- `weekend-gap-duka`, `weekend-gap-late-entry`, `index-weekend-gap`, `fx-weekend-gap*`: weekend gaps on other feeds / markets.
- `gap-fill` (branch): the cash-session opening gap of NAS100 / SPX500. FAIL. Not gold, not the 17:00-18:00 break.
- `gold-session-drift`, `gold-us-asia`, `gold-late-ny`, `gold-asia-break` (branches): session drifts and session-to-session
  links on gold; none uses the 17:00 → 18:00 reopen gap as the signal. All FAIL.
- `ict-concepts` (main): `gap-ndog` faded the 17:00-halt gap as an ICT concept, **pooled with NQ / ES / YM** on HistData /
  Dukascopy cash proxies, entry toward the fill with a stop beyond the first H1 candle's extreme. FAIL; its positive total was
  stub-candle artefacts (stops of 0.005-0.009 x ATR). Gold alone had 20 trades in its window.
- `ict-nwog` (branch): whether an ICT A-setup's sweep ran into an open NWOG / NDOG (a filter on the desk's entries). FAIL.
- `ict-equal-lows` (main) named NWOG / NDOG as untested; `ict-nwog` then tested them as a filter only.

New here: gold alone, OANDA M5 spot, 2016 on, the daily (Monday-Thursday evening) reopen gap as a **stand-alone** trade with a
stop sized from the daily ATR (not the first candle's extreme, the artefact `ict-concepts` found), three ways: fade it in the
Asian session, follow it to 02:00, and its midpoint as a target in London.

## What the data shows before any trade (counted, no price after the reopen read)

OANDA spot gold prints through CME's 17:00-18:00 New York break almost never (22 M5 candles in that hour since December 2015).
Of 2,174 evenings with both a 16:55 candle and an 18:00 candle (weekend excluded), 69 have a gap of exactly zero; the median
|gap| is $0.44, the 90th percentile $2.14, the 99th $11.54. Against the 20-day ATR: 311 evenings (2016 → Nov 2026) have
|gap| ≥ 0.05 x ATR, 49 have ≥ 0.1 x ATR. So most "NDOGs" on spot gold are within a spread or two of nothing. The eligibility
line is 0.05 x ATR (0.1 x ATR would leave about 10 trades a year at best).

## Definitions (New York wall-clock time, US daylight time by `council/histdata.mjs` `nyOffsetH`)

- **Evening E** = a Monday-Thursday New York date from 2016-01-04 on. Sunday (the weekend reopen) and Friday (no evening
  session) are never evenings.
- **Prior close C** = close of the M5 candle starting 16:55 on E. **Reopen R** = the first M5 candle starting at or after 18:00
  on E and before 18:30; its open is **O**. Both must be on file.
- E is skipped (and counted) when `ict/calendar.mjs` `cmeShut` (read only) is true at 16:55 or at 18:00 of E (early closes,
  full holidays and their eves).
- **Gap G** = O − C. **NDOG** = the zone between C and O; **midpoint M** = (C + O) / 2.
- **Trading day** = 18:00 New York to 17:00 the next day (built from the M5 candles). **ATR** = mean true range of the 20
  complete trading days that ended at or before 17:00 of E. No trade before 20 exist.
- **Eligible**: |G| ≥ 0.05 x ATR.

## The tests (3, fixed)

| # | Name | Side | Entry | Target | Stop | Out |
|---|---|---|---|---|---|---|
| T1 | Fade the gap in Asia | toward C (gap up → sell) | market at R's close (18:05) | C (limit) | 0.25 x ATR beyond the entry | close of the 01:55 candle (02:00) |
| T2 | Follow the gap to 02:00 | with the gap (gap up → buy) | market at R's close (18:05) | none | 0.25 x ATR beyond the entry | close of the 01:55 candle (02:00) |
| T3 | NDOG midpoint as a London magnet | toward M | market at the open of the 03:00 candle | M (limit) | 0.25 x ATR beyond the entry | close of the 07:55 candle (08:00) |

- T1 and T2 trade every eligible evening, except T1 is skipped when R itself already traded through C (the gap filled in the
  first five minutes) and T2 when R closed back beyond C (on the other side of the prior close from O).
- T3 trades an eligible evening only when no M5 candle from R through the 02:55 candle traded through M (the midpoint still
  untouched at London's open) and the 03:00 open is at least 0.05 x ATR from M.
- **Every trade has a stop.** Fills: the trade's M5 candles in order from the candle after entry (T1, T2) or the entry candle
  itself (T3, entered at its open). A long is stopped when a candle's low ≤ stop, filled at min(candle open, stop) (a gap
  through fills at the open); a short when high ≥ stop, at max(open, stop). A target is reached when the candle trades
  through it, filled at the target. **Stop checked first** when one candle holds both. A hole of over 30 minutes inside a
  trade window drops that trade (counted).
- **R** = side x (exit − entry) / (0.25 x ATR).
- **Costs:** $0.30 spread a round trip plus half a spread ($0.15) of slippage on each MARKET order: the entry, and a stop or
  time exit; a target exit is a limit and pays no slippage. So $0.60 a round trip, $0.45 when the target is reached. At 2x
  costs both double.
- **Financing:** `council/fills.mjs` `nights` x `FIN.xau.long` x entry / risk on longs (shorts pay and receive nothing). It is
  computed for every long and reported; the 22:00 UTC rollover falls outside every window, so it is expected to be 0.
- **Net R** = R − cost / risk − financing.

## Data

OANDA mid M5 XAU/USD through the site's keyless candle proxy (`https://meridianx.dev/md/bars?sym=xau&tf=5m`), 2015-12-01 to the
end of the latest complete day: `node --use-env-proxy research/edge/gold-gap-open/fetch.mjs <dir>` (file `xau-5m.json.gz`,
rows `[t, o, h, l, c]`, kept out of git). A file of the same shape fetched earlier the same way may be used; `run.mjs` reads
nothing before 2015-12-01.

## Windows

- **In sample:** evenings 2016-01-04 → 2020-12-31.
- **Out of sample (decides):** evenings 2021-01-01 → end of data.

## Statistics and the pass bar

- Per test and window: n, buys / sells, gross R, net R, net R at 2x costs, total, win rate, exits (stop / target / time),
  worst closed drawdown, and **t on calendar-month sums** of net R (every month of the window, 0 for a month without a trade);
  one-sided p from Student t with months − 1 degrees of freedom. A trade's month is its evening's.
- **Holm** over the 3 tests on the out-of-sample one-sided p.
- **Placebo (40 seeds, mulberry32, seeds 1..40):** each test's own trade days and entries, the side drawn at random per trade,
  the stop 0.25 x ATR on the drawn side, a target (T1, T3) at the same distance from the entry on the drawn side, the same exit
  time and costs. Reported as p5 / p50 / p95 of the seeds' out-of-sample mean net R.
- **A test passes** when all hold: out-of-sample net R > 0; out-of-sample month-sum t ≥ 2; Holm-adjusted p < 0.05; in-sample
  net R > 0; out-of-sample net R at 2x costs > 0; out-of-sample n ≥ 60 (T1, T2) or ≥ 30 (T3); out-of-sample mean net R above
  the placebo's p95.
- **Verdict:** PASS if at least one test passes, else FAIL.
- **Descriptive, not tests:** how many evenings have a zero gap, a gap within the $0.30 spread, ≥ 0.05 and ≥ 0.1 x ATR; how
  many M5 candles OANDA printed inside 17:00-18:00; of eligible evenings, the share whose gap filled (C touched) by 02:00 and by
  12:00 New York, and whose midpoint was touched by 02:55 and by 12:00, per window.

Nothing else is tested. No parameter is changed after a result is seen; a variant that looks better afterwards needs its own
pre-registration on other data.
