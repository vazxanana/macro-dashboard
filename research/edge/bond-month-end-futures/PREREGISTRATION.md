# Pre-registration: the bond month-end rule at Treasury futures cost (14 Nov 2026)

Written and pushed **alone**, before any futures number of this study is computed. A **cost scenario**, stated plainly: the
council's demo accounts trade CFDs, so a pass here would NOT make the rule tradable on the current account; it would only say
the effect is large enough to be worth a Treasury futures route, which the owner would have to decide on. Research only: no
rule, size, filter, stop, config, cost constant, council member or mirror setting changes, whatever the outcome. Not an ICT
study, not mixed with any council system.

## Why

`research/edge/bond-month-end` (branch `bond-month-end`, PR #939, 14 Nov 2026) tested buying the US 10-year (T1, `usb10y`) and
30-year (T2, `usb30y`) Treasury CFDs at the close of the month's fourth-to-last US trading day and selling at the close of its
last, stop 2 x ATR(20). FAIL, 0 of 2. Before costs the 10-year window made +0.107R a trade (t 2.31, 2016-26), the best of 18
three-day windows of the month on every US maturity; the CFD's fixed round-trip spread (0.03 % / 0.05 % of price) and 3 % a
year financing took about 0.07R of it. A Treasury future charges no financing line (its carry is in its price) and is quoted
in ticks with a per-contract fee. The question: does the same frozen rule, re-costed at futures cost, pass the same bar?

## The trades (frozen, never re-selected)

- `frozen.mjs` = #939's `research/edge/bond-month-end/run.mjs`, copied byte for byte from `origin/bond-month-end`
  (sha256 `624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144`, pinned in the test). It is imported, never
  edited, and its `full` command is never run (it would write over this folder's result.json).
- Candles: council-data `research/daily/usb10y.json`, `usb30y.json` (and `_index.json`) at council-data commit
  `f6288251e85eb98814514be7f32c667f4f0667e3` (the 7 Nov weekly cache #939 read, last candle 6 Nov 2026), read with
  `git show`, no network, kept out of git.
- **Gate (must hold, else stop and say so):** (G1) `frozen.mjs` `runMarket` on those candles reproduces #939's published
  `result.json` `markets.usb10y` and `markets.usb30y` objects exactly (deep equality of every field: decisive and
  replication rows, cost table, placebo means, profile, roll row, gaps, per year, every trade row), and `verdictOf` its
  `tests` block; (G2) this study's own placebo loop (below), run with the frozen CFD net, reproduces #939's 40 placebo means.

## The futures cost model (fixed now)

Contracts: T1 `usb10y` -> **ZN** (CBOT 10-Year T-Note), T2 `usb30y` -> **ZB** (CBOT U.S. Treasury Bond). UB (Ultra T-Bond)
has the same tick and fee, so its cost in price points is the same as ZB's; only the price mapping below would differ.
All are $100,000 face, quoted in points of par: 1 point = $1,000.

| Item | ZN | ZB (and UB) | Source |
|---|---|---|---|
| Minimum tick | 1/2 of 1/32 point = 0.015625 pt = $15.625 | 1/32 point = 0.03125 pt = $31.25 | CME Group contract specifications and "Basics of US Treasury futures" (cmegroup.com), seen as web search summaries on 14 Nov 2026; the pages themselves could not be opened from the build sandbox (proxy refused cmegroup.com) |
| Bid / ask | one tick, paid once a round trip (the CFD candles are mid prices: buying at the ask and selling at the bid costs half a tick each side) | same | assumption, the normal quoted spread of the front contract in liquid hours; not measured |
| Exchange + clearing + NFA fees | $1.00 a side ($0.80 exchange, $0.19 clearing, $0.01 NFA) | same, assumed equal to ZN's | a retail broker's ZN fee listing (ninjatrader.com margin details, symbol ZN), seen as a web search summary on 14 Nov 2026, page not opened; the ZB figure is assumed equal (from memory, not opened) |
| Broker commission | $0.85 a side | same | a typical discount-broker futures commission, **from memory, not opened** |
| Round trip, fees + commission | 2 x $1.85 = $3.70 = 0.0037 pt | 0.0037 pt | the two lines above |
| **Round trip, total (F1)** | **0.015625 + 0.0037 = 0.019325 pt** | **0.03125 + 0.0037 = 0.03495 pt** | |

- **Financing: zero.** A futures position has no overnight financing line: the cost (or gain) of carry is in the futures
  price itself, which converges to the cheapest-to-deliver bond's forward price, so it is already inside any price move the
  rule earns or loses. Stated weakness: if the OANDA bond CFD tracks a cash-like price rather than the futures price, the
  futures' path over three trading days differs from it by about (coupon income - repo) x 3 / 365 of the price, a few
  thousandths of a point; not modelled.
- **Rolls: no extra charge.** The trade is entered in whichever contract is the most traded on the entry day; in February,
  May, August and November the volume has moved to the next contract before the month's fourth-to-last day (first notice is
  the month's last business day), so the trade is entered directly in that contract and needs no roll. A sensitivity row
  (reported, NOT judged) charges one more full round trip on every trade entered in those four months.
- **Price mapping (the main weakness).** The cost is in futures price points; it is turned into R with each trade's own
  stop distance on the CFD price: **cost R = round-trip points / (entry - stop)**, where entry - stop = 2 x ATR(20) in CFD
  points. This treats one CFD point as one futures point. The OANDA USB10Y / USB30Y CFDs are quoted in points of par at
  levels close to the front ZN / ZB contracts (about 107 to 140 on USB10Y over 2016-26), but they are not proven to be the
  futures price: if a CFD point moves more or less than a futures point (another duration, a cash bond), the cost in R is
  off by that ratio. The 2 x row below covers a mapping error up to a factor of two. UB would be mapped the same way onto
  USB30Y, which its longer deliverable bonds make less true than for ZB, so UB is named, not tested.
- **Futures net R = gross R (frozen, unchanged) - round-trip points / (entry - stop).** Gross R is the frozen trade's own.

## Tests (T1 `usb10y` at ZN cost, T2 `usb30y` at ZB cost) and the bar (#939's, unchanged)

Same trades, same windows (decisive: entered January 2016 to October 2026; replication: 2003 to December 2015). A test passes
when ALL hold:
1. mean futures net R a trade > 0 in the decisive window AND in the replication window;
2. decisive one-sample t on per-trade futures net R >= 2;
3. Holm at 5 % over T1 and T2 of the one-sided p of the decisive t (normal approximation, the frozen `pOneSided` / `holm`):
   adjusted p < 0.05;
4. random-day placebo, #939's design re-costed: 40 seeds (1 to 40), per decisive year as many trades as the rule took, each
   entered at the close of a US trading day drawn by the frozen `rng(seed)` exactly as the frozen `placebo` does, held three
   trading days with the same stop, each costed by this futures model (financing zero). The rule's decisive mean futures net
   R must be above the 95th percentile of the 40 seed means.

**Verdict wording (fixed): PASSES AT FUTURES COST** when T1 or T2 passes (the count is stated), else **FAILS AT FUTURES
COST**. Either way: not tradable on the current CFD demo accounts; a pass is a reason for the owner to consider a futures
route, never a live change.

Also reported, not judged: 0 x, 1 x (base) and 2 x the futures cost; the roll-month extra round trip row; the cost in R a
trade beside #939's CFD spread and financing; per-year futures net. No other entry day, hold, stop, market or cost is tried
and reported as a finding.

## After

`run.mjs`, `result.json`, `RESULT.md` (verdict first; the gate; the cost table; the re-costed rows; what it means for the
owner), `tests/bond-month-end-futures.test.mjs`. No proposal is written whatever the verdict (a futures route is the owner's
decision, outside rule 2's paper / demo accounts as they stand).
