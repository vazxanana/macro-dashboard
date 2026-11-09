# Meridian X

**A trading desk run by an automated council: gold, forex, index futures and crypto, paper-traded around the clock and tested
before it is trusted.** Live at [meridianx.dev](https://meridianx.dev). Paper trading and demo accounts only. Not financial advice.

Updated 9 Nov 2026. Decisions waiting for the owner: [docs/owner-decisions.md](docs/owner-decisions.md).

## The three desks

One sign-in, three desks. The switch at the top of every page reads **Desk | Macro | ChronosTrade**.

| Desk | What you do there |
|---|---|
| **Desk** | Watch the markets, the council's trades and charts, your demo accounts and the research. |
| **Macro** | Read the big picture: the strategist, the veteran, their dated predictions and how often they were right. |
| **ChronosTrade** | Practise by replaying past markets candle by candle, including prop-firm challenges. |

**Inside the Desk**
- **Home**: today's result, open positions, the setup now.
- **Charts**: every market with three markups to choose from: Meridian (our structure), ICT, or Clean. A bell sets price alerts
  that reach your phone.
- **Council**: the council's trades, its systems, loss reviews, research, the Macro desk and a weekly report.
- **Desks**: ICT, Gold, Crypto, LIT and NQ SDV (coming later; nothing there is a signal yet).
- **Profile**: your photo and name, the demo accounts' results, the ChatGPT connector (if you have it) and, for the owner,
  notifications to all members and the ChronosTrade sounds.
- A **bell** in the header shows notices from the owner.

**Side pages**: the **gold terminal** (`/gold`: live gold price, chart and macro drivers), the **Edge lab** (every research
study with its verdict), `/macro` (today's macro read in one screen) and `/veteran/` (the veteran's library).

## The council

Automated members that run on GitHub Actions. A full round takes about 11 minutes, and the Trader looks at the markets again
every minute in between.

- **Analyst**: reads market structure from the daily chart down to the 1-minute: breakouts, origins, the next setup. Writes a
  short post-mortem of every losing trade.
- **Trader**: places, manages and closes **paper** trades. Every trade has a stop-loss, no exceptions.
- **Coach**: tracks what works, tests rule ideas on paper first, and proposes. The owner decides; the main systems and the
  owner's own rules are outside the Coach's reach.
- **Macro strategist**: yields, the dollar, Fed pricing, the calendar and positioning. It runs the **Gold Macro Score**, a
  reading built from four rate and dollar measures that has held up from 2007 to 2026. It can say "buy" or "wait", never "sell".
- **Macro veteran**: argues with the strategist topic by topic and makes dated calls with a % chance (see below).
- **COT desk**: what the big speculators hold in each market (the CFTC's weekly Commitments of Traders report) and how that
  changed since last week.
- **Watchdog and data health**: one phone alert when the loop stops, a price feed goes stale or a data file breaks.
- **Daily digest**: one phone message each weekday evening (and a Sunday "week ahead") instead of many alerts.

Trades are copied at the same time to **cTrader demo accounts** (one per book: council, ICT, shadows, LIT, replica), with the
same stop and target. A copied position never sits without a stop: if the broker refuses the stop, the position is closed.
Nothing is ever copied to a live account.

## The veteran: what he can do now

- **At a glance**: one sentence for the week, a bias meter (supportive / neutral / against, compared with the usual odds), the
  event that matters most and the two price levels to watch.
- **Next release card**: for each big release (CPI, jobs report, Fed decision) in the next three days: what is expected, what a
  hot / in-line / cool print would likely mean, how gold reacted to past releases of that kind, and one scored call
  ("gold closes up on the day").
- **Briefing**: 3-6 key points from public data only, ranked by how unusual each one is; past weeks that looked like this one
  ("analogs") and what gold did next; a ladder of price levels; 2-3 dated hypotheses with a % chance.
- **Calls with a % chance** for the next week and month: closes above today, touches a level, stays in a range, big move,
  dollar direction, plus calls from positioning signals that passed their test.
- **Track record**: every call is recorded once, scored when it comes due (hit rate and Brier score, a standard accuracy score
  where lower is better), and shown as a running chart.
- **Self-calibration**: once 30 calls are scored over at least 4 weeks, he checks whether his "70%" calls really come true 70% of the time and shrinks
  or stretches future %s to match. Until then he leaves them as they are.
- **What changed since last week**: bias, levels, new and dropped points, how last week's hypotheses turned out.
- **Release discipline**: he writes down the forecast before each release and never edits it, so a "surprise" is always
  measured against what was really expected.

All of this is paper only: nothing trades or sizes on it.

## Separate edges

- **ICT desk**: an hourly reversal model (a sweep of a swing, then a fair-value-gap inversion) on index futures and gold. It is
  kept apart from the council's rules. Fred works on it, and through his ChatGPT connector he can backtest ideas on 2020-to-now
  data and send proposals; a proposal is a draft change the owner reviews and merges, or not.
- **Gold desk**: the owner's gold playbook as a checklist, backtest and calendar.
- **Crypto desk**: Bitcoin, Ether, Solana and XRP scalping setups and results.
- **LIT and NQ "trend-on"**: paper "shadow" streams (tracked, never traded) for other approaches.

## ChronosTrade (practice by replay)

- Replay any market from any date, 1x to 12x speed, with undo and a jump to any moment.
- **Instant Buy / Sell** (or B / S): opens at once with a default stop and target. If the price moved, the trade is taken where
  the price is now, keeping the same stop distance; it is never refused. Shift+B / Shift+S, or Shift+drag on the chart, sets an
  order up first.
- A clean chart: entry, stop and target lines with handles to drag, red and green risk / reward zones labelled in R, a live
  profit-and-loss pill, closed trades drawn as entry-to-exit lines with their result, a two-row legend in UTC time.
- Drawings (lines, trend lines, boxes), a higher-timeframe chart, session shading, previous-day high and low.
- **Prop-firm challenges**: FTMO, FundingPips, Topstep and Lucid rules checked on every candle, and a Monte Carlo test (2,000
  re-shuffles of your results) that estimates your chance of passing and suggests a risk per trade.
- **Review**: a journal with filters, tags, notes and screenshots; charts of equity, the spread of results in R, results by weekday and hour;
  mistakes; a session report you can copy, save as an image or print.
- Effects and sounds on targets and stop-outs (the owner picks the sounds on the Profile page).

## Install the app

Meridian X installs like an app (it is needed for price alerts on iPhone):
- **iPhone / iPad**: open meridianx.dev in Safari → Share → **Add to Home Screen**.
- **Android**: Chrome → menu → **Install app**.
- **Computer**: Chrome or Edge → the install icon in the address bar.

Prices and trades always need a connection; offline you see a short "You're offline" page. If a device ever looks stuck on an
old version, open any page with `?sw-reset` at the end of the address.

## Members and permissions

- **Owner**: sees and changes everything; adds members on the Users page and decides, member by member, what each one can see
  and do (charts, scanner, journal, desks, council, macro, demo results, ChatGPT connector, ICT: none / read / write).
- **Reviewers** (Fred, Orlando): see the council and write loss reviews. Fred also works the ICT desk and has the ChatGPT
  connector; Orlando reads the ICT desk.
- **Viewers** (Luxus, Carlos): a smaller read-only site.
- **Demo results** show labels only, never account numbers.
- **Guests** (no sign-in): a live gold chart with the current trade, the main system's results and a P&L calendar.

Sign-in is checked on the server; passwords never reach the page, and too many wrong tries lock the sign-in for a few minutes.

## Ground rules

- Paper trading and demo accounts only. No live money.
- Every trade has a stop-loss.
- The owner approves every live rule change.
- Backtests cover 2020 to now. An idea counts as an edge only if it also works on data it was not built on ("out of sample"),
  after costs.
- No paid services beyond the hosting already in use.

## What the research found

Each study is written down before it runs and judged against that plan. Full list: the Edge lab. In one line each:

**Held up (with caveats)**
- **Gold trend and Gold trend fast**: positive after costs from 2020 to now (+1.2R and +1.1R a trade), but their strength depends on
  the market's mood: weaker in older data.
- **Gold Macro Score**: a real but small lean for gold over the next 4 weeks; a reading only. Used as a filter on our trades,
  it failed.
- **ICT "skip Fridays"**: passed, but weakly. Running as a paper shadow.
- **ICT dip-buys on index futures**: passed on 2018-26, then **failed** on 2008-17. Paper only.
- **NQ open run**: worked from 2023 on, flat before, and on no other market. Paper only.

**Failed (no change made)**
- **ICT A-setup rule on 2008-17**, data it never saw: about break-even after costs. The ICT desk stays paper only.
- **Five ICT rule changes** (stop cap, kill zones, higher-timeframe gap, premium/discount, break-even at +1R): none better.
- **ICT filters by session, macro regime, trend side, dollar regime, grade; new ICT markets**: none passed.
- **Gold replica before 2023**: lost money; it was fitted on 2023-26.
- **Three gold-system changes** (time exit at the open, a cost limit, switching sessions off): none helped. Keep the rules.
- **The old scalp / retrace engine**: no edge on any market; retired on 4 Nov. Most of its paper streams cost more than 0.10R a
  trade, so they lose after costs.
- **Positioning (COT)**: no general signal; only two narrow cases (AUD/USD and GBP/USD extremes).
- **Gold after CPI follows the dollar's first move**: no (34 of 72). Release-day figures are shown as history, not as an edge.
- **News filters, seasonality, position-sizing tricks, the Coach's learning**: no improvement; the Coach's flips were mostly noise.
- **LIT**: too few trades to judge, and what can be measured is negative. Kept on paper for now.

## Under the hood

Static pages on Vercel with small server functions under `/api`; users, profiles, alerts and notices in private Vercel Blob
storage. The council runs on GitHub Actions (and on the owner's always-on server when it is running) and publishes to the
`council-data` branch. Prices come from OANDA through the site, with exchange feeds as a fallback. Developer notes: `CLAUDE.md`.
