# The same index trades on CME micro futures: pre-registration (14 Nov 2026)

Written and pushed **alone**, before any futures number below was computed. **Cost accounting only, in the style of
`research/edge/gold-carry`: no trading rule is tested and no verdict on any rule is made or remade.** No entry, exit, stop,
filter, size or window is changed or chosen; no live rule, size, filter, stop, config, cost constant, council member or
mirror setting changes, whatever the outcome. Paper only. ICT is not involved.

## Why

Three index studies of 13-14 Nov 2026 (branches, not on `main` when this was written) found an effect that is positive
**before** costs and lost after a CFD round-trip spread and overnight CFD financing:

| study (branch, PR) | rule | published gross | published CFD costs |
|---|---|---|---|
| `index-overnight` (#891) | long US500 / NAS100 CFD from the New York cash close to the next 09:30 open, stop 1 x ATR20 | US500 +0.023R, NAS100 +0.026R a trade (2016-26) | spread 0.027 / 0.020R, financing 0.017 / 0.013R |
| `index-ibs` (#895) | buy the 16:00 close when IBS < 0.2, sell the next close, stop 1 x ATR20; SPX500, NAS100, US30 | +0.05 to +0.10R a trade | cost 0.03-0.04R, financing about 0.015R |
| `turn-of-month` (#826) | buy the close of TD-2, sell the close of TD+3, stop 2 x ATR20; SPX500, US30, NAS100 | +0.10 % (SPX500), +0.39 % (NAS100) a trade (2016-26) | 0.04-0.05 % round trip, about 0.08 % financing |

A CFD is not the only way to hold these trades. CME micro index futures (MES, MNQ, MYM) charge no overnight financing line:
the cost of carry sits in the futures price (the basis), which a long pays as the basis decays. They are priced in ticks
with a per-contract commission. The council already sends micro-futures tickets (MNQ / MGC, `council/futures.mjs`).

## The question (fixed now)

What do **the same trades** (byte-identical trade lists: same signals, entries, stops, exits, gross R) net on micro
futures? Every trade is re-costed, never re-selected.

## Trade lists (step 1)

- None of the three result.json files holds every trade with its entry price and stop distance (index-overnight holds
  none, index-ibs and turn-of-month hold date, exit kind and R / %). So each study's own `run.mjs` (and `fetch.mjs`), taken
  unchanged from its branch with `git archive`, is run in a temporary directory outside git on OANDA candles fetched by its
  own fetch code through the site's candle proxy (kept out of git). `dump.mjs` (this folder) imports those unchanged files
  from that temporary directory and writes per-trade rows: date, entry and exit time, entry, stop, exit, how, gross R (or
  gross %), the study's own CFD cost and financing, CFD net, and the study's own rollover nights. Rows are kept in
  `rows.json.gz` here so the tests run offline.
- **Gates (all must hold, else stop and say so):** (G1) each study's unchanged `run.mjs`, re-run, writes a result.json
  byte-identical to the one on its branch (index-ibs, turn-of-month), or for index-overnight equal in every figure of its
  `tests` block (it writes its own build date); (G2) the stored rows reproduce each study's published n, mean gross, mean
  CFD net and month-sum t (or trade t for turn-of-month) per test and window, to the decimals published; (G3) the placebo
  draws rebuilt in `dump.mjs` reproduce each study's published placebo figures under its own CFD cost.
- Studies, tests and windows as published: index-overnight T1 (US500) and T2 (NAS100), decisive 2016-26, replication
  2005-15 (the T3 cash-session control is not re-costed: it is not a test); index-ibs T1 SPX500, T2 NAS100, T3 US30 and the
  pooled P, decisive 2016-now, replication 2005-15 (long rule only; the mirror short control is not re-costed);
  turn-of-month SPX500 (primary), US30, NAS100, out of sample 2016-now, in sample 2008-15.

## The futures cost model (step 2), written down before computing

Contract per market (CME micros): SPX500 / US500 → **MES** ($5 a point, tick 0.25 pt); NAS100 → **MNQ** ($2 a point, tick
0.25 pt); US30 → **MYM** ($0.50 a point, tick 1 pt). The OANDA index CFD level is taken as the index level, and a stop
distance in CFD points as the same distance in futures points.

Per trade, in index points, then divided by the trade's own 1R (entry − stop, points) or by its entry price for
turn-of-month, which was published in % of price:

1. **Price move**: the study's own gross R (or gross %), unchanged. The OANDA US index CFDs are treated as tracking the
   cash index (they charge overnight financing, which a futures-priced CFD would not; stated, not verified).
2. **Spread-equivalent**: **1 tick a side**, 2 ticks a round trip (MES 0.50 pt, MNQ 0.50 pt, MYM 2 pt).
3. **Commission and fees**: **$0.62 a side** a micro contract, $1.24 a round trip, the figure
   `research/edge/costs/RESULT.md` already uses for CME micros (its "$1.24 round-trip commission and fees"; behind
   `council/digest.mjs` / `research/portfolio.mjs` `ICT_COST_PTS`). Broker-dependent: an exchange's and a broker's fee
   schedule change; not verified here. In points: 1.24 / dollar-per-point (MES 0.248, MNQ 0.62, MYM 2.48 pt).
4. **Cost of carry**: a long future is priced above (or below) the index by about (r − q) × time to expiry × index; as
   time passes that basis decays, so a long pays **(r − q) × days held / 365 × entry price** compared with holding the
   index. **r** = the 2-year Treasury yield (FRED `DGS2`, weekly, the last value on or before the entry date), copied
   into `rates.json` from `research/edge/gold-carry/rates.json` on `main` (council-data's FRED cache); before its first
   value (6 Jan 2006) **3.85 %**, the 2005 figure index-ibs stated. A 2-year yield, not the 3-month rate a front future
   actually discounts: stated. **q** = the index's dividend yield, a yearly approximation **from memory, not verified,
   marked as such**, in `rates.json` `divYield` (S&P 500, Nasdaq 100, Dow 30, 2005-2026). **Not floored**: when q > r the
   carry is a credit to the long (2009-2021 mostly), and it is shown. **days held**: index-overnight exact (exit time −
   entry time); index-ibs and turn-of-month the calendar days between the entry date and the exit date (their rows carry
   dates; turn-of-month's exit date is the stop's date when stopped, index-ibs's the planned exit date).
5. **Rolls**: one more round trip (items 2 + 3) for each quarterly roll date strictly between the entry date and the exit
   date (8 days before the third Friday of March, June, September, December, the `council/futures.mjs` MNQ rule, used
   for all three). With one-day and four-day holds this should be (almost) never; counted anyway.

**Futures net = gross − ticks − commission − carry − rolls**, each component reported in R (in % for turn-of-month).

- Micro contracts started trading in May 2019; for the years before, the micro tick and fee schedule is assumed anyway (a
  hypothetical instrument; the E-mini of each index existed with the same tick in points and ten times the dollars a
  point, so a lower commission in points, but a contract too large for the book's sizes). Said in RESULT.md.
- Sizing to whole contracts is ignored (every trade is 1R, as in the studies). One micro MES contract at a 1 x ATR stop
  risks about $250-450 at 2026 levels: said in RESULT.md.

### Reported beside it (pre-registered, not judged)

- **F2 all-in**: the repository's all-in micro round trip `ICT_COST_PTS` (MES 1.00, MNQ 1.37, MYM 5.5 pt: 1 tick spread +
  1 tick slip each way + $1.24) instead of items 2-3.
- **F3 no dividend**: carry at r alone (q = 0), the case against the long.
- **CFD with the dividend credit**: the published CFD net plus q × days / 365 × entry (a CFD long is credited dividends;
  the published CFD figures leave this out). So the two routes are compared on the same footing.

## Output per study (step 3)

Per test and window: n, gross R (%), CFD net as published, futures net (F1), each futures component, F2, F3, CFD + dividend;
**month-sum t** of each (the trades' net summed by entry month; for index-ibs every calendar month counts with empty months
0, its own definition; index-overnight its own monthSums of months with a trade); turn-of-month also its own **trade t**.

**Its own bar, futures instead of CFD costs.** Each study's pre-registered pass conditions are evaluated once more with the
F1 futures net in place of the CFD net, condition by condition, and nothing else changed:
- index-overnight: n ≥ 300 both windows; net > 0 and month-sum t ≥ 2 on 2016-26; net > 0 on 2005-15; Holm p < 0.05 over
  T1, T2; net above the 95th percentile of its placebo's seed means (placebo windows re-costed the same way: the random
  trades of its own `placebo`, re-run in `dump.mjs` with its seeds); net > 0 at twice the trading cost (items 2-3 doubled,
  the futures form of "2x spread"); and the pooled condition (pooled month t ≥ 2, both windows' pooled mean month > 0).
- index-ibs: (a) n ≥ 100, (b) net > 0, (c) month-sum t ≥ 2 and Holm p < 0.05 over T1-T3, (d) 2005-15 net > 0, (e) beats
  ≥ 38 of 40 placebo seeds re-costed the same way; and P pooled (b, c without Holm, d, e).
- turn-of-month: T1 net > 0 and trade t ≥ 2 (2016-now), T2 placebo ≥ 38 of 40 seeds (re-costed), T3 turn days against the
  rest (before costs: unchanged by any cost), Holm p < 0.05 over the three markets; verdict on SPX500.

**Whatever comes out, RESULT.md says plainly**: a micro future is a different instrument, this is not a re-test of the
rule and no verdict of the three studies changes; a condition met on futures costs on the same history built the rule's
case on, with a route chosen after seeing the CFD loss, is not evidence of an edge; a futures route would need its own
pre-registration and its own forward record before anyone calls it one.

## Files

`PREREGISTRATION.md` (this, pushed alone first), `rates.json`, `dump.mjs`, `rows.json.gz`, `run.mjs`, `RESULT.md`,
`result.json`; test `tests/index-futures-cost.test.mjs` (offline: the gates from the stored rows, the cost components on
hand-made trades, RESULT.md against result.json). To repeat: `git archive` each branch into a temporary directory, run its
fetch and run steps, then `node research/edge/index-futures-cost/dump.mjs <tmp> <candles>` and `node
research/edge/index-futures-cost/run.mjs`.
