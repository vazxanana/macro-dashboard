# The owner's market cycle as an entry on commodity CFDs (not gold): pre-registration

Written and committed on 14 Nov 2026, before any trade of this study was computed. Paper research only: no live rule, size,
filter, stop, config or mirror setting is changed by this study, whatever it finds.

## Why

The owner's rule, in his words: "if we are bullish on H4 and the pullback finished, focus only on buys, and vice versa" (the
market-cycle reading: an H4 move, an H1 ChoCh starts the pullback, the H1 breaking back with the H4 ends it). As an ENTRY it
failed on US indices (`index-cycle`, branch `index-cycle`, result `748fb9c79`), on five forex majors (`fx-cycle`, result
`cfd928e8d`) and on BTC / ETH / SOL (`crypto-cycle`, result `0ac837fc0`); as a gate on the council's own systems it improved
none of eleven (`cycle-gate-study`, result `bd35f7a06`). It has never been run on commodities other than gold. This study runs
the same rule, frozen, on six commodity CFDs as a last out-of-market check.

**Gold is out of this study** (absolute rule 4 and owner item 44: no new gate / exit / entry / size test on the gold book's
2006-17 window; the gold readings of this cycle were already tested in mosha-retrace / mosha-cycle).

What I already know, said plainly: I have read the four results above. I have NOT computed anything of this rule on commodity
candles. Nothing is tuned; every constant is the frozen file's.

## The frozen rule

`frozen.mjs` is `research/edge/crypto-cycle/run.mjs` of branch `crypto-cycle` (commit `0ac837fc0`), copied byte for byte,
sha256 `a2c714701e2faf486c5a77677359cb815bb05babed277041cf085dd8a2905f5b` (pinned in `tests/commodity-cycle.test.mjs`). It is
never edited. Why that file: it is the most recent of the three (index-cycle has a pre-registration only and no code on its
branch; fx-cycle's `run.mjs` is the source crypto-cycle copied). The rule itself does not differ between fx-cycle and
crypto-cycle: a `diff` of the two files shows the eleven steps' code (`swings`, `boEvents`, H4 bucketing, `atrAt`, `cycles`,
`plan` apart from its skip window, `simulate`) identical; they differ only in markets, data loading, windows, step 6's skip
window (fx: rollover and weekend; crypto: none, 24/7) and the cost model. So "the latest" and "the owner's latest wording" are
the same rule whichever is frozen.

`run.mjs` imports from `frozen.mjs`: the constants `K` (W4 3, W1 1, ATR 14, buffer 0.1 x ATR, min 1R, fixed 2R, hold 48 H1
candles, 72 h max wait, 40 seeds), `boEvents`, `toH4`, `cycles`, `plan`, `simulate`, `biasAtOpen` and every statistic
(`mean`, `tOf`, `monthly`, `summary`, `pTwo`, `holm`, `pct`, `rng`). The rule's eleven steps are therefore the frozen file's
code, verbatim (they are written out in `research/edge/crypto-cycle/PREREGISTRATION.md`, steps 1-11; not repeated here).
What `run.mjs` adds, and only this:

1. **Step 6's skip window**: these CFDs, like forex and unlike crypto, close for the 17:00 New York rollover and the weekend.
   So the skip window is fx-cycle's, copied: no entry when the entry candle starts at 21:00-22:59 UTC or while
   `council/fills.mjs` `spotClosed` says the weekend (Friday 17:00 - Sunday 17:00 New York). It is checked before the frozen
   `plan` (a skipped signal gives no trade; it does not wait). Every other part of step 6 (next H1 candle in the data, 72 h
   at most) is the frozen `plan`.
2. **Costs** (below), the per-trade function, the one-at-a-time loop and the placebo, written with the frozen file's code
   shape because the frozen `trade` / `runMarket` / `placebo` call its own crypto `costR` internally.

## Gate (before any commodity figure is read)

`node run.mjs gate <cryptoDir>` runs the frozen file's own `study()` on crypto-cycle's own data (the Binance 5-minute candles
of council-data `research/candles/crypto5m`, copied with crypto-cycle's `fetch.mjs`) and must reproduce crypto-cycle's
published `result.json` exactly: Exit A n 830, net R -65.42, monthly t -1.80; Exit B n 1717, net R -94.28, monthly t -1.79,
and every other field. If it does not, the study stops and says so.

## Data

- OANDA mid H1 candles through the site's keyless candle proxy (`/md/bars`, 4,999-candle windows, complete candles only), from
  1 Jan 2004 or the market's first candle to 13 Nov 2026 21:00 UTC (`fetch.mjs <dir>`, kept out of git, rows `[t, o, h, l, c]`).
- **Pooled markets (six, fixed here):** `xag` (silver), `xpt` (platinum), `xpd` (palladium), `xcu` (copper), `wtico` (WTI
  crude), `bco` (Brent crude). Keys from CLAUDE.md's OANDA symbol map.
- `natgas` (natural gas) is fetched and **reported only**: never pooled, never in a Holm family, never decisive (the brief
  makes it optional; its CFD has large contract-roll steps).
- H4 candles from H1 in UTC buckets (the frozen `toH4`). Dukascopy is not reachable; no other feed is used.

## Windows

A trade belongs to a window by its EXIT time (as the frozen file). **Decisive: 1 Jan 2016 to the last candle.**
**Replication: 1 Jan 2007 to 31 Dec 2015** (as early as all six markets allow with warm-up: OANDA's metals start in 2006;
candles before 2007 are warm-up only; a market whose data starts later contributes from its own first trade).

## Costs (per trade, in price units, then divided by r0) — assumptions, not measurements

No broker measurement of these markets exists in the repository (the demo account's symbol file covers gold, forex and indices
the council trades). The frozen model charges one flat round trip as a fraction of the entry price (crypto: 0.04 %, of which
0.02 % is the spread) and no separate slippage. The same shape here: **round trip = 2 x an assumed typical spread** (the spread
plus an equal allowance for slippage), as a fraction of the entry price:

| Market | Assumed typical spread | Round trip charged |
|---|---|---|
| xag | 0.05 % | 0.10 % |
| xpt | 0.15 % | 0.30 % |
| xpd | 0.25 % | 0.50 % |
| xcu | 0.10 % | 0.20 % |
| wtico | 0.05 % | 0.10 % |
| bco | 0.05 % | 0.10 % |
| natgas (reported only) | 0.15 % | 0.30 % |

(Order of magnitude of a retail CFD broker's quoted commodity spreads today; silver's 0.10 % round trip equals the "mid"
cost of `research/edge/trend-breadth-h1`.)

**Financing**: the frozen file charges `rate x entry` for every rollover held, no credit ever. These CFDs roll like gold, so
the nights are `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC, Wednesday three; the crypto every-calendar-day count is
crypto's). Rate: **long 0.00015 of the entry price a night** (`trend-breadth-h1`'s assumption for non-gold longs, next to the
measured gold rate `FIN.xau.long` 0.000148); **short 0** (charged nothing, credited nothing: `FIN.xau.short` and
`trend-breadth-h1`'s rule). Real carry is not measured.

`net R = gross R - (round trip + financing) / r0`. Cost lines: 0 (gross), base, 2x (every cost doubled).

## Primary test (the frozen design, unchanged)

The frozen study's primary test is the per-exit pass bar on the pooled stream; the "ungated" comparison is its placebo (the
same number of trades, entered at random H1 candles that carry the same H4 bias, i.e. the bias without the "pullback
finished" timing). Copied verbatim from index-cycle / fx-cycle, with "replication 2010-2015" read as this study's replication
window:

> **Pass bar (per exit).** All of: decisive pooled mean net R a trade > 0; monthly t >= 2; Holm-adjusted p < 0.05 (over the 2
> exits); replication pooled mean net R a trade > 0; decisive mean net R a trade above the placebo's 95th percentile.
> **Verdict: PASS if at least one exit passes every line, else FAIL.**

Statistics as frozen: per exit stream the six markets pooled, one row per trade; t for the verdict on calendar-month sums of
net R (months by exit, every calendar month of the window counted, empty months 0); p two-sided normal; Holm over Exit A and
Exit B.

**NOT MEASURABLE (inconclusive)** if fewer than four of the six markets can be fetched, or the decisive pooled stream of either
exit has fewer than 100 trades.

## Secondary (reported, never decisive)

Per market and exit: n, mean R at 0 / base / 2x cost, monthly t, Holm p over the 12 market x exit tests (at base cost);
replication per market; exit reasons; sides; years; natural gas on its own line.

## Placebo (40 seeds, the frozen design)

For each exit and seed 1-40: every real decisive trade is replaced by one on the same market and side, entered at the open of a
random H1 candle of the decisive window whose H4 bias at its open equals the trade's side, whose open is not in the skip window
above, and that has 48 candles of data after it; same stop distance r0 in price, same target in R (Exit A: the trade's planned
R multiple; Exit B: 2R), same 48-candle exit, fills, costs and financing; independent trades. Statistic: mean net R a trade;
the bar is the 95th percentile of the 40 (linear between ranks); 5th / 50th / 95th reported. This is the brief's "random gate
of the same on/off frequency": the same trade count and side mix, timing random within the bias.

## What follows

A PASS is unreplicated outside these markets and is a proposal to the owner at most, never a live rule (absolute rule 3). A
FAIL ends this reading on commodities: no parameter will be varied after seeing the result.
