# Gotobi fade: can a resting sell limit placed before the fix capture the 00:55 result? (pre-registration)

Written and pushed before any figure of this study was computed. An execution study on a frozen rule, paper only: no live
rule, order, config or council member changes, and it makes no live proposal. It is not an edge verdict.

## Why

The gotobi fade (research/edge/gotobi, #878, T2: on gotobi days sell USD/JPY at the 00:55 UTC M5 open, the Tokyo 09:55 fix,
buy back at 06:00 UTC) made +0.148R a trade net, month t 2.74 (2016-now). gotobi-timing (#908) showed on OANDA M1 that the
result sits on the 00:55 minute: entering one minute late (00:56) makes +0.048R, one minute early (00:54) +0.072R; the exit
minute hardly matters. gotobi-minute-histdata (#912) showed the same minute profile on HistData. A live copy cannot reliably
fill a market order at exactly 00:55:00. The question here: does a SELL LIMIT resting before the fix capture most of it?

## Frozen pieces (not changed, not chosen)

- `frozen.mjs` = gotobi-timing's `frozen.mjs` byte for byte, sha256
  `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32` (pinned in the test). Its calendar, stop distance,
  cost model (`costPx`: 0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million) and statistics (`summary`,
  `monthT`) are used as they are.
- The day universe: the gotobi days of 2016-01-01 to 2026-11-11 on which gotobi-timing's M1 base trade (entry 00:55 M1
  open, exit 06:00) exists, i.e. its 771 trades. The stop distance D of each day = the frozen D from #878's M5 file
  (`stopDist` on the fade window), exactly as gotobi-timing computed it.
- Exit: the 06:00 UTC M1 open, else the close of the last M1 candle starting up to 15 minutes before it (gotobi-timing's
  `tradeM1` exit). Stop: D above the fill price. Every trade has a stop.
- Costs: the frozen model on every variant, also on the limit fills (no rebate for a resting order: conservative).

## Data

OANDA mid USD/JPY M1, 00:40-06:15 UTC on every gotobi day 2016-26 (gotobi-timing's cache `usdjpy-1m-gotobi.json.gz`), and
#878's OANDA M5 file `usdjpy-5m.json.gz` for D. Kept out of git; refetched through the proxy as gotobi-timing did if missing.

## Gate (before any variant is read)

E3 below, run by this study's code on these files, must equal gotobi-timing's published M1 base row exactly: n 771, net R a
trade +0.1481, month t +2.74. If not, nothing below is interpreted.

## Entry variants (all pre-registered rows)

- **E1(k), k = 0, 1, 2 pips (three rows):** at the close of the 00:53 M1 candle (00:54:00) a SELL LIMIT rests at
  L = that close + k pips (1 pip = 0.01). It is live for the M1 candles starting 00:54, 00:55, 00:56 and 00:57.
  - *Lenient fill:* the first of those candles whose high reaches L (high >= L) fills it.
  - *Strict fill:* the first of those candles whose high trades at least 0.3 pip THROUGH the limit (high >= L + 0.003) fills it.
  - The fill price is L in both (also when the candle opened above L: no price improvement is credited). No candle in
    00:54-00:57 meeting the rule = no trade that day (0R). A day without a 00:53 candle = no order, no trade (0R), counted.
  - Stop L + D. Management from the fill candle: in the fill candle itself, a high at or above the stop counts as stopped at
    the stop (the order inside the candle is unknown: the worse case is taken); from the next candle on, gotobi-timing's
    checks in order (open at or above the stop = out at that open; high at or above the stop = out at the stop); else the exit.
- **E2:** a market sell at the 00:54 M1 open (one minute early), the conservative reference (gotobi-timing's `tradeM1` at
  00:54).
- **E3:** a market sell at the 00:55 M1 open, the ideal reference (gotobi-timing's `tradeM1` at 00:55 = the gate row).

## What is reported, per variant (E1 lenient and strict, E2, E3)

Fill rate (filled days / universe days), net R per filled trade, net R per universe day (unfilled days count 0), month t on
calendar-month sums of net R per day (unfilled days 0, every month of the universe present), total net R, and the share of
E3's net R per day kept (variant net R per day / E3 net R per day). Also: how many E1 fills came in each minute 00:54-00:57,
and the mean net R of E3 on the days E1 did NOT fill (what the misses cost).

## Pre-registered reading (on the STRICT fill rule; lenient shown only)

- **CAPTURABLE**: some E1 variant under the strict fill rule keeps at least 70 % of E3's net R per day, with month t >= 2.
- **PARTLY**: otherwise, some E1 variant under the strict fill rule keeps at least 40 % of E3's net R per day.
- **NOT CAPTURABLE**: otherwise.

No row is chosen or proposed from this; any live use would need its own proposal and the owner (absolute rule 3).

## Honest limits, stated before the run

- A limit filled at a candle's high on M1 data is optimistic: the high may have lasted a moment and the queue may not have
  reached the order. The strict rule (0.3 pip through) is the stricter reading; neither is a measured broker fill.
- OANDA mid prices: a sell limit on a real account fills on the bid, about half a spread under the mid.
- k is three fixed rows; nothing between them is tried, and no other placement time is tested.
