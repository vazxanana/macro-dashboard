# Meridian X

**A trading desk run by an automated council: gold, forex, index futures and crypto, traded on paper around the clock and
tested before it is trusted.** Live at [meridianx.dev](https://meridianx.dev).

**Read this first.** Everything here is paper trading or a broker's demo account. No real money is traded and no order ever
goes to a live account. Nothing here is proven to be profitable: most ideas we tested failed their test, and the ones that
did not fail are still unproven (see "What the research found"). Not financial advice.

Updated 11 Nov 2026 and checked against the code that day. What waits for your decision:
[docs/owner-decisions.md](docs/owner-decisions.md).

## The three main pages

One sign-in. The switch at the top of every page reads **Desk | Macro | ChronosTrade**.

| Page | What you do there |
|---|---|
| **Desk** | Watch the markets, the council's paper trades and charts, the demo accounts and the research. |
| **Macro** | Read the big picture: the strategist, the veteran, their dated predictions and how often they were right. |
| **ChronosTrade** | Practise by replaying past markets candle by candle, including prop-firm challenges. |

**Inside the Desk**
- **Home**: today's result, open positions, the setup now.
- **Charts**: every market, with one markup at a time: Meridian (our structure), ICT, or Clean. A bell on the chart sets
  price alerts that reach your phone.
- **Council**: the council's trades, its systems, loss reviews, research, the Macro desk and a weekly report.
- **Desks**: ICT, Gold, Mosha, Crypto, LIT, and NQ SDV (a placeholder: nothing there is a signal).
- **Profile**: your photo and name, the demo accounts' results, the ChatGPT connector (if you have it) and, for the owner,
  notifications to all members and the ChronosTrade sounds.
- A **bell** in the header shows notices from the owner.

**Other pages**
- **Academy** (`/academy`, owner only): a trading school built on seven of the council's systems (the seven that traded live until 11 Nov 2026). See below.
- **Gold terminal** (`/gold`): live gold price, chart and macro drivers.
- **Edge lab**: every research study with its verdict.
- `/macro`: today's macro read on one screen. `/veteran/`: the veteran's library.

## The council

Automated members that run on GitHub's free servers (GitHub Actions). A full round takes about 11 to 12 minutes, and in
between the Trader looks at the markets again every minute. If that loop stops, a backup on the website's own host (Vercel)
takes over by itself. When the owner's always-on server is running, it runs the Trader instead, every 30 seconds.

- **Analyst**: reads market structure from the daily chart down to the 1-minute chart. Writes a short post-mortem of every
  losing trade.
- **Trader**: places, manages and closes **paper** trades. Every trade has a stop-loss, no exceptions.
- **Coach**: tracks what works, tests rule ideas on paper first, and proposes. The owner decides; the main systems and the
  owner's own rules are outside the Coach's reach.
- **Macro strategist** (about every 70 minutes): yields, the dollar, Fed pricing, the calendar and positioning. It runs the
  **Gold Macro Score**, a reading built from four rate and dollar measures. It can say "buy" or "wait", never "sell".
- **Macro veteran**: argues with the strategist topic by topic and makes dated calls with a % chance (see below).
- **COT desk**: what the big speculators hold in each market (the US regulator's weekly positioning report) and how that
  changed since last week.
- **ICT desk tracker** (about every 35 minutes): a separate method, described below.

**The council's own systems** (all on paper). Since 11 Nov 2026, by your decision on that day's review of the edges, two
trade live on paper: **Gold trend** (the 20-day breakout) and **Gold daily engulf**. The other five are followed as
**paper shadows** from that date (the same rules and stops, every trade recorded and managed, never alerted, no futures
ticket): Gold replica, Gold momentum pullback, the NQ New York open run, Gold H4 trendline and Mosha BO. "Gold trend fast"
and "Crypto trend" have been shadows since 7 Nov. A trade one of them took live before its date stays in the record as the
live trade it was. None of the nine has proven an edge on data it was not built on; the two that stay live are the nearest
(positive on 2006-17, not yet beyond luck). The old scalp engine was retired on 4 Nov after it showed no edge.

**Costs.** Every closed paper trade is shown before and after costs: the spread, slippage on market orders and, for
trades closed since 11 Nov 2026, the **overnight financing** a gold buy pays for each night it is held (0.0148% of the
price a night at the demo broker's rate of that day, about 5.3% a year). Trades closed before that date keep the cost
they were recorded with. The backtests those records are measured against (the edge-decay baselines, "What to expect",
the scoreboard's replay rows) carry the same financing charge on gold buys.

**Demo accounts.** Trades are copied at the same time to **cTrader demo accounts**, one per book (council, ICT, shadows,
LIT, replica), with the same stop and target. A copied position never sits without a stop: if the broker refuses the stop,
the position is closed at once. Nothing is ever copied to a live account. Since 11 Nov 2026 the Replica demo account takes
no new copies of the replica's forex and crypto paper trades (that stream was losing before costs); gold replica copies
continue, and positions already copied are managed to their close. It is looked at again once 200 of those paper trades
have closed with a positive total before costs.

## Alerts on your phone

- **Trade alerts** for the council's live paper trades. Gold and NQ alerts carry a ready-made micro-futures ticket you
  could type into TradingView by hand (the council itself never trades there).
- **One daily digest** each weekday evening from 21:15 UTC, and a Sunday "week ahead", instead of many messages.
- **Watchdog and data health**: one alert when the loop stops, a price feed goes stale or a data file breaks, and one when it
  is back. Note: the watchdog's own timer depends on GitHub's scheduler, which often fires late (owner decisions 15 and 31).
- **Price alerts** you set yourself on a chart. On iPhone they need the installed app (below).

## The veteran: what he does

- **At a glance**: one sentence for the week, a bias meter (supportive / neutral / against, compared with the usual odds),
  the event that matters most and the two price levels to watch.
- **Next release card**: for each big release (inflation, jobs report, Fed decision) in the next three days: what is
  expected, what a hot / in-line / cool number would likely mean, how gold reacted to past releases of that kind, and one
  scored call ("gold closes up on the day").
- **Briefing**: 3 to 6 key points from public data only, ranked by how unusual each one is; past weeks that looked like
  this one and what gold did next; a ladder of price levels; 2 to 3 dated hypotheses with a % chance.
- **Calls with a % chance** for the next week and month, plus calls from positioning signals that passed their test.
- **Track record**: every call is recorded once and scored when it comes due. The page shows the hit rate and an accuracy
  score.
- **Self-calibration**: once 30 calls are scored over at least 4 weeks, he checks whether his "70 %" calls really come true
  70 % of the time and adjusts future numbers to match. Until then he leaves them as they are.
- **What changed since last week**, and **release discipline**: he writes down the forecast before each release and never
  edits it, so a "surprise" is measured against what was really expected.

All of this is reading only: nothing trades or sizes on it. His record is still too short to judge.

## The desks

- **ICT desk**: an hourly reversal model on index futures (NQ, ES, YM, RTY) and gold futures. It is kept apart from the
  council's rules and reports. Each signal can have two results, one from the live tracker and one from the daily replay
  of history; the desk shows both side by side and never mixes them up. A replay result that is not final yet says
  "update pending". Old replay results are kept as they were booked (before 11 Nov they could shift from day to day
  because the price feed returned slightly different old candles on each run).
  - **Fred has full control of the ICT method** (your decision, 10 Nov). Through his ChatGPT connector he can backtest
    ideas on 2020-to-now data, and change the ICT method's own files without your review once the automatic checks pass.
    He cannot touch anything else. A check he cannot edit makes sure every ICT trade keeps its stop. Paper and demo only.
    You can switch this off on the Users page at any time.
  - The ICT method is **not proven**: its replay since August 2025 is positive, but the same rule on ten earlier years
    (2008-17) only broke even.
- **Gold desk**: the owner's gold playbook as a checklist, backtest and calendar. A guide, not a council system.
- **Mosha desk**: the place for the Mosha method.
  - **Luxus is the teacher, the desk is his student.** He lands on this desk when he signs in. He sends trades as
    screenshots or in words, the desk writes back what it understood, and he says "right" or "not right". What the desk
    has been taught is kept line by line in "What the desk knows". He can also teach from a ChronosTrade replay. A full
    tutorial is on his page, in English or French. Only Luxus can teach.
  - **Your trade log**: write down your own Mosha trades as you take them (a trade without a stop is refused). Only
    trades logged while still open count. The desk says "too few to judge" until 20 are closed.
  - **The method written as fixed rules failed its tests**: five studies on 10 Nov, none profitable (see below). The
    lessons and the log measure how a person trades it; they are not proof either.
  - The desk's assistant reads the lessons only when a session is run for it; nothing is read automatically.
- **Crypto desk**: Bitcoin, Ether, Solana and XRP scalping setups and results. Paper only; the scalp engine showed no edge.
- **LIT**: a paper "shadow" stream on gold (tracked, never traded or alerted). Its study was inconclusive and what could
  be measured was negative.

## The Academy (owner only)

A school on top of seven of the council's systems: the seven that traded live on paper until 11 Nov 2026 (two still do, five
are paper shadows since; the school teaches all seven rules as before). You pick a system and a period, the market is replayed, and the clock
stops at each setup. A fixed, rule-based engine gives its answer (take or wait); you agree or correct it, and a correction
becomes a written lesson that is then checked on setups it has never seen. Other tabs show lessons, progress, a blind test,
research and costs. An optional "analyst" can give a second opinion in words through your own assistant; no paid service is
used and none has been called.

Honest status: the engine's "wait" decisions have **not** been shown to beat simply taking every setup (0 of 16 tests
passed). The 20 statistical scorers that were trained were all rejected; none is used. The Academy is for learning, on
paper, and is cut off from the council and the broker.

## ChronosTrade (practice by replay)

- Replay any market from any date at 1x to 12x speed, with undo and a jump to any moment. Timeframes from 1 minute to
  1 day, and up to four charts side by side on different timeframes, none of which shows the future.
- **Instant Buy / Sell** (or keys B / S): opens at once with a default stop and target. If the price moved, the trade is
  taken where the price is now with the same stop distance; it is never refused. Every order needs a stop.
- A clean chart: entry, stop and target lines you can drag, red and green risk / reward zones, a live profit-and-loss pill,
  closed trades drawn with their result.
- Drawings (lines, trend lines, boxes), session shading, previous-day high and low.
- **Prop-firm challenges**: FTMO, FundingPips, Topstep and Lucid rules checked on every candle (check the firm's own
  current rules), and a test that reshuffles your results 2,000 times to estimate your chance of passing.
- **Review**: a journal with filters, tags, notes and screenshots; charts of your results; mistakes; a session report.
- Effects and sounds on targets and stop-outs (the owner picks the sounds on the Profile page).
- For Luxus: a "Teach this trade" button sends a replay trade to the Mosha desk as a lesson.

Replay trades are practice on past candles. They are never counted as a track record.

## Install the app

Meridian X installs like an app (needed for price alerts on iPhone):
- **iPhone / iPad**: open meridianx.dev in Safari → Share → **Add to Home Screen**.
- **Android**: Chrome → menu → **Install app**.
- **Computer**: Chrome or Edge → the install icon in the address bar.

Prices and trades always need a connection; offline you see a short "You're offline" page. If a device ever looks stuck on
an old version, open any page with `?sw-reset` at the end of the address.

## Members and what they see

- **Owner**: sees and changes everything; adds members on the Users page and decides, member by member, what each one can
  see and do.
- **Fred** (reviewer): sees the council, writes loss reviews, works the ICT desk, has the ChatGPT connector and full control
  of the ICT method (above).
- **Orlando** (reviewer): sees the council and reads the ICT desk.
- **Luxus** (viewer): a smaller read-only site, plus the Mosha desk, where he teaches.
- **Carlos** (viewer): a smaller read-only site.
- **Demo results** (Fred, Orlando, Carlos and the owner) show labels only, never account numbers.
- **Guests** (no sign-in): clean charts of any market, the current gold trade of the main system, its results and a
  profit-and-loss calendar. No rules, system names or notes.

Sign-in is checked on the server; passwords never reach the page, and too many wrong tries block sign-in for a few
minutes. One open point: passwords should be changed, because their scrambled form was public until 9 Nov (owner
decision 1).

## Ground rules

- Paper trading and demo accounts only. No live money.
- Every trade has a stop-loss.
- The owner approves every live rule change. The one exception, made by the owner: Fred and the ICT method.
- Tests cover 2020 to now, are written down before they run, and count costs. An idea counts as an edge only if it also
  works on data it was not built on.
- No paid services beyond the hosting already in use.

## What the research found

Each study is written down before it runs and judged against that plan. Of 69 studies in the Edge lab on 11 Nov, 3 passed
(all weakly), 46 failed and 20 were inconclusive or descriptive. In one line each:

**Did not fail, but not proven**
- **Gold trend and Gold trend fast**: positive after costs on 2006-17 data they were not built on (about +0.5R and +0.4R a
  position; +0.40R and +0.29R once overnight financing is counted), but just short of the bar for "robust", and much weaker than in recent years. They depend on gold trending.
- **Gold Macro Score**: a real but small lean for gold over the next 4 weeks; a reading only. Used as a filter on our
  trades, it **failed**.
- **ICT "skip Fridays"**: passed, weakly. Running as a paper shadow.
- **ICT "sweep into a higher-timeframe gap"**: failed on 9 Nov, then passed, weakly, after the candle-clock correction of
  10 Nov. One pass out of nine tries can be luck. Recorded on paper only (owner decision 20).
- **ICT dip-buys on index futures**: passed on 2018-26, then **failed** on 2008-17. Paper only.
- **NQ open run**: worked from 2023 on, flat before, and on no other market. Paper only.

**Failed (no change made)**
- **Mosha written as fixed rules** (five studies, 33 tests, gold 2006-26): none profitable. The best version broke even;
  the rest lost. No simple condition picked out the winners.
- **Mosha BO**: rebuilt on earlier years it makes nothing; a paper shadow since 11 Nov (owner decisions 33 and 37).
- **ICT A-setup rule on 2008-17**, data it never saw: about break-even after costs. The ICT desk stays paper only.
- **ICT rule changes, filters and new markets** (exits, sessions, macro regime, trend side, grades, more markets): none
  passed, apart from the two weak passes above.
- **Gold replica before 2023**: lost money; it was fitted on 2023-26.
- **Three gold-system changes** (time exit, a cost limit, switching sessions off): none helped. Keep the rules.
- **The old scalp / retrace engine**: no edge on any market; retired on 4 Nov.
- **Positioning (COT)**: no general signal; only two narrow cases.
- **Gold after an inflation release follows the dollar's first move**: no (34 of 73). Release-day figures are shown as
  history, not as an edge.
- **News filters, seasonality, position-sizing tricks, the Coach's learning**: no improvement.
- **LIT**: too few trades to judge, and what can be measured is negative. Kept on paper for now (owner decision 12).
- **Academy**: the decision engine's changes (0 of 16 tests) and all 20 trained scorers: none passed.

**A correction worth knowing.** On 10 Nov we found that the historical research candles had been read on the wrong clock
(an hour off for part of each year). It was fixed and the affected studies were re-run; one verdict changed (the ICT
gap variant above). A few old studies have not been re-run and say so (owner decision 23).

## Under the hood

Web pages on Vercel with small server functions; users, profiles, alerts, notices, the Mosha log and lessons and the
Academy's records in private Vercel storage. The council runs on GitHub Actions (and on the owner's always-on server when
it is running) and publishes its results to a separate data branch of the repository. Prices come from OANDA through the
site, with exchange feeds as a fallback. Developer notes: `CLAUDE.md`.
