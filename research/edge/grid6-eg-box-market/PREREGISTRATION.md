# Grid 6: engulf zones on D1 / H4, the working-timeframe box, market entries only (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

When price comes back to an engulf zone of the Daily or the H4 chart (a fresh zone, any visit, or a failed zone traded the
other way), and a box on H1 or M15 then closes out with the zone's side (or breaks against it and closes back in), optionally
confirmed by an engulf or a structure break, does a MARKET entry give trades that are positive before costs in 2010-2014 AND
again in 2015-2019? Every combination of the factors below is one cell; every cell is run per market and pooled.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes built from the 5-minute candles
by `combo-grid-3` `frames` (imported): M15, H1, H4 (UTC-aligned `resample`) and the Daily trading day (`dailyNY`, 17:00 New
York). The data-quality exclusions (`combo-grid-3` `exclusions`, from `research/edge/data-quality/quality.json`) drop any
trade that fills inside a listed interval. Costs: `combo-grid-2` `COSTS` (round trip in price units).

## Factors and levels

1. **Zone timeframe** (2): `D1` or `H4`.
2. **Zone state** (3). Zones = `combo-grid-3` `buildZones('eg', L)` (imported, not edited; it uses `council/eg-methods.mjs`
   `engulfAt` with a span of 3: a candle of one colour, then within 3 candles a close beyond its high for a buy / its low for a
   sell; zone = the first candle wick to wick), known from the close that completes the engulf, alive until a close of the
   zone timeframe through its far side (or 120 candles of that timeframe). Failed zones = `buildZones('ef', L)`: a zone closed
   through, serving the OTHER side from that close for 20 days or until a close back through it. Visits: a touch = the first
   working-timeframe candle that trades into the zone; a visit ends at a closed working candle wholly outside it; at most 3
   visits a zone. Levels: `fresh` (an engulf zone, first visit), `any` (an engulf zone, visits 1-3), `ef` (a failed zone,
   visits 1-3, traded with the side it now serves).
3. **Box** (2 x 2 = 4): timeframe `H1` or `M15`; box = `edgekit` `boxesHL(T, 2)` (from a swing low to a swing high, 2
   candles a side, ended by a close outside it). Event `out`: the first box, inside 24 working candles from the touch candle,
   that ends with a close out of it WITH the zone's side (that candle is the event). Event `false`: the first box in that
   window that ends with a close out AGAINST the side, followed within 6 candles by a close back inside past the broken edge
   (that close is the event).
4. **Confirmation** (3), on the box timeframe, from the event candle e: `none` (the event candle), `eg` (the first engulf of
   the side, `engulfAt(C, j, 3)`, completed on candles e .. e+3), `sb` (the first structure break of the side, `edgekit`
   `structure(T, 2)`, on candles e .. e+3). Signal time ts = the close of that candle, which must start before the zone dies.
5. **Session** (3): UTC hour of ts: `london` 07-12, `ny` 12-17, `other`.
6. **Stop** (2): `box` (`out`: past the box's other side; `false`: past the extreme of the false break) or `zone` (past the
   zone's far side, plus 0.1 x the ATR(14) of the zone timeframe from the last closed candle at ts); each plus half the round
   trip.
7. **Exit** (5): `1R`, `2R`, `3R`, `trail` (the stop trails 1R behind the best price once +1R is reached), `opp` (a target at
   the nearest zone of the other side of the zone timeframe, engulf or failed, standing at ts beyond the entry, when it is 1R or
   more away, else 2R). Every exit is also out at the close of the 5-minute candle 2 days after the fill.

Entry: MARKET only, the open of the first 5-minute candle starting at or after ts (that candle counts fully). No limits.

Cells: 2 x 3 x 2 x 2 x 3 x 3 x 2 x 5 = 2,160 per scope; scopes = pooled + the 5 markets (12,960 in all).

## Trades

- Management: `dom-trade-through` `manage` (imported; stop first when one candle holds both; a gap past the stop exits at the
  open). Every trade has its stop on the losing side of its entry (else the run stops with an error); a planned risk (from the
  signal candle's close) under 2 x the round trip, or a filled risk under the round trip, is not taken.
- Signals read closed candles only. A cut test on real data (each market cut at five moments) must give the same signals
  before each cut as the full run; it is recorded in result.json.
- Overlap said beforehand: grid5-msnr-box's confirmed cell (Daily engulf zone, H1 box out, structure break within 6 candles,
  New York, market entry, box stop) is close to one cell here (`D1` / `any` / `H1` / `out` / `sb` / `ny` / `box`) but not the
  same (3 visits here, a 3-candle window). It is not singled out: this grid is judged as a whole by the bar below.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months, empty months count as 0); month-sum t.
- **Discovery 2010-2014** (by fill time): n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 50, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
  one-sided p of the confirmation month t, < 0.05.
- Against chance: the discovery count against 2.3 % of the cells tested, the raw confirmation count against 2.3 % of the
  discovery winners.
- **Side-flipped placebo**: every trade also taken the other way, the stop mirrored around the signal candle's close (the same
  stop distance), the same exits and costs; the placebo cells go through the same bar, counts reported beside.

## Verdict

- **PASS**: at least one cell confirmed after Holm AND the real cells confirm more cells than the placebo.
- **INCONCLUSIVE**: cells are confirmed, but the placebo confirms as many or more.
- **FAIL**: no cell confirmed after Holm.

A pass is a before-cost tilt on 2010-2019, never an edge: nothing changes on any desk from it, and its after-cost line is
reported beside. No factor, level or threshold changes after the first run.
