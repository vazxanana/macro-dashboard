# What it costs to hold a gold buy, route by route: pre-registration

Written and committed **before** any number below was computed (12 Nov 2026). The routes, the data, the arithmetic and the
statements this study will make are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **No trading rule is tested**: no entry, exit, gate, filter, stop or size of any system is changed or
compared (owner decision 44 stopped those tests on this book; this study is cost accounting, the one question decision 46
left open: "what your broker charges overnight on a gold buy, against two other brokers"). No live rule, size, filter, stop,
config, cost constant (`council/fills.mjs` `FIN`) or mirror setting changes, whatever the outcome.

## Why

The live paper book (Gold trend + Gold daily engulf, long gold only) made +59.3R, +5.2R a year, on untouched 2006-07 to
2017-12 after costs and overnight financing on every unit at the demo broker's rate of 11 Nov 2026 (`research/edge/
supported-book`, t 1.86 on daily book R; 20.5R of financing). Without financing the same book has t 2.43, at half the rate
2.15. So the cost of holding a long gold position is the one lever left, and it depends on how the position is held.

## What is already known (seen before this was written)

- The demo broker's XAUUSD long swap: 0.000148 of price a rollover (`FIN`), about 5.4 % a year when a week counts seven
  rollovers (Monday-Friday 22:00 UTC, Wednesday three).
- The supported-book result above, and its unit records `research/edge/supported-book/legs.json` (963 units).
- That the council-data branch holds: the macro strategist's FRED cache (`macro/cache.json`: weekly 2-year Treasury yield
  `DGS2` since January 2006 in `score.fred`; daily `SOFR` and `EFFR` since August 2025 in `fred`); 22 files of one-minute
  prints of COMEX gold December 2026 (`GCZ26`, symbol in each file) from 1 Jan to 4 Nov 2026 (`research/probe/cnbc-gc/`).
  None of these was read for a number before this file.
- That the session cannot reach FRED, the US Treasury, the New York Fed, CME, broker sites or most publisher pages directly
  (their hosts are refused by the network); web search result summaries can be read. The OANDA candle proxy is reachable.

## Routes (each is an annual carrying rate, applied per rollover night)

A route's financing of one unit = Σ over the rollovers strictly inside its hold (the `council/fills.mjs` `nights` rule:
Monday-Friday 22:00 UTC, Wednesday three) of `rate(that night) / 365 × entry ÷ r0`, in R. With a constant rate this equals
`nights(t, c) × rate / 365 × entry ÷ r0`; the demo route at `FIN.xau.long × 365` must reproduce the supported-book F1 figures
exactly (gate below).

| key | route | rate a year | history (2006-17) |
|---|---|---|---|
| `none` | no financing (reference, the supported-book F0) | 0 | 0 |
| `demo` | the demo broker's CFD swap today | `FIN.xau.long × 365` | flat (the supported-book verdict's basis) |
| `demo-h` | the same broker, rate following short rates | | `DGS2(as of the night) + markup`, markup = demo rate − SOFR on 11 Nov 2026 (latest on or before) |
| `cfd-<name>` | other retail CFD brokers' published XAUUSD long swap | $ a 100-ounce lot a night ÷ (100 × OANDA gold daily close on the source's date) × 365 | flat, and `-h`: `DGS2 + markup` as above, markup = its rate − SOFR on its date |
| `mgc` | CME micro gold futures (10 oz), carry in the futures-spot basis | `k_now` measured (below) | flat, and `mgc-h`: `DGS2(as of)`, lease rate taken as 0 (it cannot be reached) |
| `etf-<name>` | a spot-gold-backed ETF, statement charge | the expense ratio | flat |
| `etf-<name>-e` | the same, true carrying cost (the whole price is paid in cash, which then earns nothing) | expense ratio + SOFR today | expense ratio + `DGS2(as of)` |

- **History proxy:** the overnight dollar rate before August 2025 cannot be reached from here; `DGS2` (FRED, weekly, the
  council's own cache) is the only rate history at hand. It is used as of the latest weekly value on or before each night
  (no later value). RESULT.md must say it is a 2-year yield, not an overnight rate, and compare the two on the overlap.
  Rates are floored at 0.
- **Futures commissions and rolls** (added to that route only, per unit, in R): one round trip at entry of `MGC_RT` dollars a
  contract ÷ 10 ounces, and at every roll strictly inside the hold one more round trip plus one tick ($0.10 an ounce). Rolls
  are `council/futures.mjs`'s dates (8 days before the first day of each even month). `MGC_RT` = the all-in round trip a
  public source states (quoted with its source); if none can be found, $2.50 and said so. Contract size (10 oz) is ignored
  for sizing (the book's 1R units are fractional): said in RESULT.md.
- **CFD and ETF figures** come only from what the session can read (search result summaries of publisher pages), each with
  its source, its date and "not opened, not verified". No figure from memory. A broker figure that cannot be found is
  listed as not found.
- The flat round trip ($0.30 a unit, x1) stays on every route; only financing and the futures commissions differ.

## The futures basis (`k`), measured

For each UTC weekday of 2026 in the GCZ26 files: the one-minute GC prints between 14:00 and 17:00 UTC with volume ≥ 1 that
have an OANDA XAU_USD one-minute bar at the same minute (candle proxy, `node --use-env-proxy run.mjs fetch`); daily
`b = median ln(F / S)` (needs at least 5 matched minutes). `τ` = years from the minute to 29 Dec 2026 (the contract's last
trading day). Daily implied carry `k = b / τ`. Reported: monthly medians, the whole-year median, and **`k_now` = the median
over the last 20 measured days** (used by `mgc`). Sensitivity: τ to 1 Dec 2026 (first delivery day). Implied lease =
SOFR (same day) − k, where SOFR exists. Days with τ under 30 days are excluded (none expected).

## Book figures, per route

The supported book S2 (`gtrend` + `geg`), units from `legs.json`, the supported-book study's own functions imported
(`positions`, `bookStats`, `bootstrap`; that study is not edited). Each route's financing is subtracted from each unit's
gross R before booking (`fin: 0` passed, so the study's own financing is off). Per route, on **W1 untouched 2006-07 to
2017-12** (the windows of that study): positions, total net R, R a year, t on daily book R, worst drawdown closed and
marked, financing taken in R and R a year, the two halves; and the same on W3 (2020-01 to 2026-10, in sample for the rules,
shown, never evidence).

**Gate:** `demo` must reproduce supported-book `W1.S2.x1F1` (total, t daily, max drawdown) and `none` its `x1F0`, to the
decimals published. If not, stop and say so.

**Rate grid:** the same book at flat rates 0 to 7 % a year in 0.5 % steps; the **break-even rate** = the highest flat
rate at which t on daily book R is at least 2 on W1 (linear between grid points).

Also reported: median and mean rollover nights per position and per unit (S2, W1), and what one night and one median
holding cost in % of price per route.

## Statements fixed now

1. A table: route → rate a year → the book's R a year, t and drawdown on W1, flat and with history where defined.
2. **The cheapest honest route** = the lowest **true carrying cost** (the rate counting the interest the cash it needs could
   earn: CFD swap, futures `k`, ETF expense ratio + SOFR), stated with its practical limits (stops, hours, lot size).
3. Whether any route's flat rate today is below the break-even rate (then the book's t would read 2 or more at that route's
   cost on untouched data). This is **not** a new verdict on the book: the supported-book verdict stands as it was fixed,
   and a t of 2 on a past window built with a cost picked after seeing it proves nothing new. Said in RESULT.md.

## Not done here

No order, no account change, no change to `FIN`, the mirror, `council/futures.mjs` or any rule. Changing the route is the
owner's decision (proposal `research/proposals/2026-11-12-gold-carry.md`, `docs/owner-decisions.md`).
