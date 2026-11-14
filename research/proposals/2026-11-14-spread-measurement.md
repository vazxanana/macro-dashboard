# Measuring the spreads the two open leads depend on (proposal, 14 Nov 2026)

**For the owner. A proposal only: no code, workflow, API file, config or trading rule was changed to write it, and nothing
here asks for one to change without your approval.** Paper trading and cTrader demo accounts only. No edge is claimed for
either lead below.

## The question

After about 145 studies, two leads are still standing, and both stand or fall on a spread nobody has measured:

| Lead | When it trades | What is known | What is missing |
|---|---|---|---|
| **Gotobi fade** (branches `gotobi`, `gotobi-cost`) | sells USD/JPY at **00:55 UTC** (09:55 Tokyo) on gotobi days, buys back at **06:00 UTC** (15:00 Tokyo) | `gotobi-cost`: breaks even at **3.73 pips** a round trip (spread + 2 x slippage, commission on top) on USD/JPY 2016-now; the month t falls under 2 above **1.95 pips**; the crosses pooled 3.20 / 1.81 | the quoted spread at those two minutes. The demo account holds no yen pair at all; the broker's own published averages (0.08 pip on USD/JPY) are all-day figures, not 09:55 Tokyo |
| **Forex Sunday-gap fade, Rule G** (branches `fx-weekend-gap*`, `weekend-reopen-cost`, #944) | enters at the close of the first M5 candle after **Sunday 17:00 New York** (17:05 New York), the widest-spread minute of the forex week | #944: the headline keeps a monthly t of 2 only while the majors' entry spread averages under about 1.4 pips (R1 under about 5.3, S2 under about 4.3) | the spread at the reopen. The broker file holds **one** Sunday (8 Nov 2026) and five pairs: USD/CHF read **14.5 pips** and USD/CAD **4.6 pips** at the first read, 4-5 minutes after the entry minute |

Two ways to measure them were tried from the research sandbox and blocked:

- **OANDA bid / ask**: the site's candle proxy (`api/bars.js`) asks OANDA for `price: 'M'` and keeps `c.mid` only.
- **Dukascopy**: the sandbox's egress proxy refuses every Dukascopy host (`connect_rejected`, branches `weekend-gap-duka` and
  `gotobi-duka-spread`, both "NOT MEASURABLE"). A GitHub Actions runner did receive a Dukascopy file earlier
  (council-data `research/probe/cnbc2/duka.txt`: `duka 200 16736`), and `council/duka.mjs` already reads Dukascopy BID files
  on GitHub's runners for the backtest workflow.

Below are three routes that are left, each free (absolute rule 5: keyless or already-paid data, the existing Vercel plan,
free GitHub Actions minutes on this public repository).

---

## Route A: log the demo broker's quotes at the minutes that matter

**What it measures:** the spread on the venue the council actually trades on (the Fusion demo, a raw-spread account that
charges a commission instead), at the exact minutes of both leads, from now on.

### What would change

`council/ctrader-symbols.mjs` already opens a **read-only, demo-only** session every full council round: it goes through
`api/ctrader-link.js`'s read session, whose `READ_ONLY` allowlist holds no trading message (auth, account list, trader,
asset and symbol lists, conversion chain, **tick data**, expected margin, leverage tiers); it refuses unless
`CTRADER_MIRROR=on`, `CTRADER_ENV=demo` and the account reports `isLive: false`. It reads the last bid / ask of each symbol
with `GET_TICKDATA_REQ` over the last 15 minutes and keeps the last tick.

The proposal adds, in the same file and the same session:

1. **A watch list of its own, not the mirror's map.** `SYMBOLS` in `council/ctrader-mirror.mjs` is what the mirror trades;
   it stays as it is. A new `SPREAD_WATCH` list names the symbols to log: the five yen pairs of the gotobi tests (USDJPY,
   GBPJPY, AUDJPY, CADJPY, CHFJPY) and the eighteen pairs of Rule G's three headline sets (M: EURUSD, GBPUSD, USDJPY,
   AUDUSD, USDCHF, EURJPY; X: EURGBP, GBPJPY, AUDJPY, EURAUD, GBPAUD, EURCHF; N: NZDUSD, USDCAD, CADJPY, NZDJPY, AUDNZD,
   AUDCAD): nineteen symbols in all. A symbol the broker does not list is written under `missing`, as the file does today.
2. **Windows, read from the broker's tick history, not at the minute.** The tick request takes a `fromTimestamp` and a
   `toTimestamp`, so a read does not have to land on the minute: a round that runs after a window has closed asks for that
   window's bid and ask ticks and reduces them to one row a minute (last bid, last ask and their spread at the minute's
   close, the widest spread inside the minute, the tick count). Each round catches up every window that closed since the
   last one logged.
3. **The windows**, written in the time zone each lead lives in, so daylight saving cannot move them:

   | Window | Defined as | UTC | Days |
   |---|---|---|---|
   | Gotobi entry | 09:50-10:05 Tokyo | **00:50-01:05 UTC** all year (Japan keeps no summer time) | every Tokyo business weekday, so gotobi days can be compared with the others |
   | Gotobi exit | 14:55-15:05 Tokyo | **05:55-06:05 UTC** all year | same |
   | Sunday reopen | Sunday **16:55-18:30 New York** | **21:55-23:30 UTC** while New York is on standard time (first Sunday of November to the second Sunday of March); **20:55-22:30 UTC** while it is on summer time | every Sunday the broker reopens |

   The brief asked for 21:55-23:30 UTC on Sundays: that is right for the winter half of the year only. In summer the reopen
   is at 21:00 UTC and Rule G enters at 21:05 UTC, so a fixed UTC window would miss every summer entry. The broker's own
   schedule (`symbols.json` `scheduleTimeZone: America/New_York`) opens forex at **Sunday 17:02 New York**, three minutes
   before Rule G's entry candle closes: the log would show what the first three minutes of quotes look like.
4. **A separate output file**, council-data `ctrader/spreads.json` (`{ at, windows: { <window id>: { <symbol>: [[minute,
   bid, ask, spread, maxSpread, ticks], …] } }, missing, errors }`, append-only, a few KB a day, about 1-2 MB a year). **Not
   inside `symbols.json`**: the Trader's cost model reads `symbols.json` `spreadTypical`, the median of the reads outside
   21:00-22:59 UTC, and adding hundreds of 00:55 and Sunday 23:00 reads there would move the cost of every live and shadow
   trade. The cost model, `spreadFields`, the mirror and every trading figure stay exactly as they are.

### Sketch (in this document only, not applied)

```js
// council/ctrader-symbols.mjs (sketch)
export const SPREAD_WATCH = ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'EURJPY', 'NZDJPY',
  'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCHF', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURAUD', 'GBPAUD', 'EURCHF', 'AUDNZD', 'AUDCAD'];
// windows due since `since` (unix s), each { id, from, to } in unix s; pure, tested on dates either side of both DST switches
export function spreadWindows(since, now) {
  const out = [];
  for (let d = Math.floor(since / 86400) * 86400; d <= now; d += 86400) {
    const wd = new Date(d * 1000).getUTCDay();
    if (wd >= 1 && wd <= 5 && tokyoBusinessDay(d)) {
      out.push({ id: `gtb-in:${ymd(d)}`, from: d + 50 * 60, to: d + 65 * 60 });            // 00:50-01:05 UTC
      out.push({ id: `gtb-out:${ymd(d)}`, from: d + 355 * 60, to: d + 365 * 60 });         // 05:55-06:05 UTC
    }
    if (wd === 0) { const ny = nyOffsetH(d + 12 * 3600);                                    // -5 winter, -4 summer
      out.push({ id: `sun:${ymd(d)}`, from: d + (16 * 60 + 55 - ny * 60) * 60, to: d + (18 * 60 + 30 - ny * 60) * 60 }); }
  }
  return out.filter((w) => w.to <= now);
}
// per window and symbol: two tick requests (bid, ask), paged while hasMore, 250 ms apart (the API allows 5 a second)
async function windowTicks(s, P, ctid, symbolId, w) { /* GET_TICKDATA_REQ type 1 and 2, fromTimestamp w.from*1000, toTimestamp w.to*1000 */ }
export function perMinute(bids, asks, w) { /* last bid / ask at each minute close, max spread inside the minute, tick count */ }
```

`nyOffsetH` is the existing New York offset in `council/histdata.mjs` (pure, no imports); `tokyoBusinessDay` would come from the
gotobi study's frozen calendar or be written fresh with its own test. The new reads run after the existing per-symbol loop,
in the same session, with their own error list (`soft`), so a failed window never touches `symbols.json`.

### Which tests would cover it

- `tests/ctrader-symbols.test.mjs`: its fake broker already answers `GET_TICKDATA_REQ` from `fromTimestamp` / `toTimestamp`;
  it would get window cases (a window with ticks, an empty one, `hasMore` paging, a symbol the broker does not list) and the
  check that `symbols.json` comes out byte-identical with and without the watch list.
- `tests/ctrader-link.test.js`: the `READ_ONLY` allowlist is unchanged (no new message type is needed: tick data is already
  in it).
- `tests/forex-spread.test.mjs`: the cost model and `spreadFields` give the same numbers on the pinned 12 Nov fixture (proof
  that the cost model is not fed the new reads).
- New: `tests/spread-windows.test.mjs` for `spreadWindows` (Sundays either side of the second Sunday of March and the first
  Sunday of November, a Tokyo holiday, catch-up after a long gap) and `perMinute`.
- `council/datahealth.mjs` `FILES` would get an entry for `ctrader/spreads.json` (warn when no Sunday window was logged by
  Monday 06:00 UTC), covered by `tests/datahealth.test.mjs`.

### Which loop or runner would do the reads

The full council round (`council.yml`, about 11-12 minutes a round) runs `timeout 90 node council/ctrader-symbols.mjs data`
every round; the quick pass (every minute of the 4-minute wait) runs only the Trader and the mirror; the owner's VPS runner
(`council/live.mjs`, every 30 s) runs only the Trader and the mirror and does not run `ctrader-symbols.mjs`. Because the
windows are read **from tick history after they close**, the cadence decides only how soon a window is logged, not how
close to the minute: the full round is enough, and nothing needs to go into the quick pass or the VPS runner (where it would
compete with the mirror for the one minute that matters for stops). To keep the round safe, the window reads would be a
separate invocation with its own cap (for example `timeout 120 node council/ctrader-symbols.mjs data --windows`, after the
existing line, `|| echo …`), so it can never fail or hold up the round or delay the specs the mirror sizes with. A Sunday
window of 19 symbols is 38 tick requests plus paging (the reopen is busy), about 15-40 seconds.

**One thing to check first, not checked here** (the build sandbox has no broker connection): how far back the demo serves
tick history, and the request limits on its period. If it keeps weeks or months, the first run can also back-fill those
past windows; if it keeps only hours, a window must be read within those hours, which the full round does anyway while the
loop runs. A loop outage longer than the history the broker keeps would lose those windows (reported, never guessed).

### Cost, reach, time, risks

- **Cost**: none. The broker session is already open each round; GitHub Actions minutes are free on this public repo.
- **Can measure**: the real quoted spread and how fast it narrows, at the real minutes, on the venue a demo copy would fill
  on, plus the commission (already in `symbols.json` as `commissionRT`, about 0.51 pip a round trip on USD/JPY). A raw
  account's spread here is the honest input to `gotobi-cost`'s break-even and to #944.
- **Cannot measure**: the past. It starts on the day it is deployed (unless the tick history reaches back). It measures quotes,
  not fills: slippage on a market order at 00:55 or 17:05 New York stays unmeasured until a demo order is placed there, which
  would be a separate decision. It is one broker's spread, not the market's.
- **Weeks until the question is answered**: Rule G needs **20 Sunday reopens a pair** by #944's own pre-registered coverage
  rule (source (b) in its pre-registration is exactly these demo quotes), so about **20 weeks** (early April 2027), less if
  the tick history reaches back. Gotobi: there are about 5-6 gotobi days a month, so 20 gotobi entries take about **4 months**;
  a first reading against the 1.95-pip line is visible within **3-4 weeks**, because the commission is known and the question
  is whether the quoted spread at 00:55 is near 0.1 pip or near 2.
- **Risks**: a longer step in each round (capped, separate); the broker may not list some crosses (shown as `missing`); a raw
  account's quotes may not be representative of another broker; window boundaries around a Tokyo holiday or the two summer-time
  switches (covered by the new tests). It reads only: nothing is ever sent that could open or change an order.

---

## Route B: a GitHub Actions workflow for the two Dukascopy studies

**What it measures:** Dukascopy's historical bid and ask minute candles, 2009/2010 to now, i.e. a second, independent feed
with seventeen years of spreads at both leads' minutes, and both leads rerun with fills on the side that trades.

### What is already there

- `research/edge/weekend-gap-duka/PREREGISTRATION.md` and `research/edge/gotobi-duka-spread/PREREGISTRATION.md` are
  committed on their branches, each with a frozen copy of its rule (`frozen.mjs`, sha256 pinned by its test). Both stopped
  at their coverage probe ("NOT MEASURABLE") because the sandbox could not reach Dukascopy.
- **Their measurement code is not written yet**: `weekend-gap-duka/run.mjs` holds the probe and the pure pieces (mid from
  bid and ask, M1 to M5, the spread at a moment, the trade on the side that fills, net R, Holm), tested on a hand-made
  fixture, but the candle fetch, Measurement A, Test B, the feed check and the placebo loops are not written;
  `gotobi-duka-spread/run.mjs` holds its probe. Both RESULT.md files say so, and both say the measurement code must be added
  **under the same pre-registration** before any figure is read. That stays the rule: the workflow is only the place to run
  it.

### What the workflow would need

- A new file, for example `.github/workflows/duka-spread.yml`: `workflow_dispatch` only (never on push, never scheduled),
  `runs-on: ubuntu-latest`, **no secrets**, `permissions: contents: read` plus uploading the results as a workflow artifact
  (or `contents: write` limited to pushing result files to the study's own branch, if you prefer them committed by the
  runner). `xz` (for `decodeBi5`) is on the standard image.
- **The probe first**: each job runs the study's own probe; if Dukascopy does not answer there, the job stops and says so.
- **A matrix** of one job per pair (18 pairs for Rule G, 5 for gotobi), each under GitHub's 6-hour job limit, writing a
  compact per-pair file of the minutes the pre-registrations use; a last job joins them and runs the tests and placebos.
- **A cache of its own** (`actions/cache`, key `duka-ba-…`): `council/duka.mjs` caches BID files only (its `cacheable`
  pattern) and its file must not be edited for this (the pre-registrations import `decodeBi5` unchanged), so the study code
  keeps its own cache of BID and ASK files.
- Raw Dukascopy files are never committed to the repository (it is public); only the derived statistics (spreads by pair and
  year, the trades) go into each study's `result.json` and RESULT.md.

### How long the downloads would take

Dukascopy serves one minute file per symbol, side and UTC day; `council/duka.mjs` paces itself at about one file every
0.5-0.7 s and backs off on 503.

- **Gotobi**: 5 yen pairs x 2 sides x about 4,150 Tokyo business days since 2010 = about **41,500 files**: about 7 hours on
  one runner at that pace, about **1.5 hours** as a 5-job matrix.
- **Rule G**: 18 pairs x 2 sides x every weekday and Sunday from November 2009 (the ATR warm-up needs the weekdays) = about
  **190,000 files**: about 30 hours on one runner, about **2 hours** as an 18-job matrix (about 10,500 files a job). If
  Dukascopy throttles a parallel matrix, a second dispatch picks up from the cache.
- Cache size: minute files are small (a few KB to a few tens of KB), so a few GB in total, close to the repository's 10 GB
  Actions cache limit; it could push out the backtest's `duka-*` cache. Keeping only the needed minutes in compact per-pair
  files after the first run avoids that.

### Cost, reach, time, risks

- **Cost**: none (standard runners are free for a public repository; Dukascopy's data is free and keyless).
- **Can measure**: the spread at 00:55 / 06:00 UTC and at Sunday 17:05 New York (and +30, +60, +120 minutes) for every pair
  and year since 2010; both leads rerun with bid / ask fills; the feed check against OANDA; the placebos. It answers "was the
  lead real on a second feed, after its own spread" for the whole history at once.
- **Cannot measure**: the demo broker's spread (Dukascopy is an ECN feed; its reopen spread may differ from Fusion's), and
  slippage on a real order.
- **Weeks until the question is answered**: the code under the two pre-registrations has to be written and reviewed first
  (a few days of work, offline-tested like the pieces already there), then one dispatch of about 2 hours: about **1-2 weeks**
  in all, if Dukascopy answers the runner.
- **Risks**: Dukascopy may throttle or block GitHub's runners (it answered one file once; a whole matrix has not been tried);
  a gap in Dukascopy's history fails a pair's 95 % coverage gate (the pre-registrations already say what happens then); adding
  a workflow is a repository change you would approve as a pull request; its result is research only and changes no rule.

---

## Route C: OANDA bid / ask candles through the site's proxy

**What it measures:** OANDA's own bid and ask candles, i.e. the spread of the very feed every one of these studies took its
mid candles from.

### What would change (sketch only, not applied)

```js
// api/bars.js (sketch): an opt-in price side; the default stays mid, so the Desk, ChronosTrade and every caller are unchanged
const PRICE = { M: 'M', BA: 'BA' }, price = PRICE[String(q.price || 'M')] || 'M';
const p = new URLSearchParams({ granularity: tf[0], price, dailyAlignment: '0', alignmentTimezone: 'Etc/UTC', weeklyAlignment: 'Monday' });
// …
const bars = (j.candles || []).filter((c) => (price === 'M' ? c.mid : c.bid && c.ask)).map((c) => price === 'M'
  ? { time: Math.floor(+c.time), open: +c.mid.o, high: +c.mid.h, low: +c.mid.l, close: +c.mid.c, volume: c.volume, ...(c.complete ? {} : { live: true }) }
  : { time: Math.floor(+c.time), bid: [+c.bid.o, +c.bid.h, +c.bid.l, +c.bid.c], ask: [+c.ask.o, +c.ask.h, +c.ask.l, +c.ask.c], volume: c.volume, ...(c.complete ? {} : { live: true }) });
```

The cache keys follow the URL, so `price=BA` answers are cached apart from mid ones; the past-window rule (a day at the edge)
applies unchanged. Tests: `tests/oanda-symbols.test.mjs` and a new case that the default answer is byte-identical to today's.

### What it touches

- **A served API file.** `api/bars.js` feeds the Desk's charts, ChronosTrade, the Academy, price alerts' history and the
  research scripts. A change there deploys to meridianx.dev (`scripts/vercel-ignore.sh` deploys on `api/` changes) and needs
  your approval like any change to the site.
- **The firewall's rate limit**: "Rate limit market data" allows `/md` 900 requests a minute per IP. One request returns up
  to 5,000 candles, so the history is small: USD/JPY M1 for 2010-now is about 900 requests, M5 about 180; all 19 pairs at M5
  about 3,500 requests. Paced at one or two a second from the research sandbox, that is well inside the limit and does not
  take the site's capacity, but it is a load the live site would carry.
- **OANDA's own limits** on the practice token (`OANDA_TOKEN`, practice account): candles with `price=BA` are a standard
  request; the volume above is modest.

### Cost, reach, time, risks

- **Cost**: none (the existing Vercel plan and the existing OANDA practice token).
- **How far back**: the repository's own studies read OANDA H1 from January 2004 and gold M5 from June 2006
  (`trend-breadth-h1`, `mosha-sweep`), so forex M5 bid / ask very likely reaches 2005-2010; **not verified for `price=BA`**,
  a one-request probe per pair would say.
- **Can measure**: OANDA's quoted spread at every minute of both leads, every year, on the same feed as the signals, so the
  signals and the fills come from one source (a re-cost, not a second-feed check).
- **Cannot measure**: the demo broker's spread (OANDA's practice pricing is a retail account's, usually wider than a raw
  account's outside the reopen), a second-feed check of the signals (it is the same feed), or slippage.
- **Weeks until the question is answered**: once deployed, the data is there in a day; the measurement needs **its own
  pre-registration** (the two Dukascopy pre-registrations name Dukascopy, and #944's names the proxy only as a mid source),
  so about **1-2 weeks**.
- **Risks**: a change to a served file (a bug there would show on the Desk; the default-mid test guards it); research
  requests sharing the live site's per-IP limit; a third venue's spread that may answer the question for neither the market
  as a whole nor the broker the council uses.

---

## The three side by side

| | A: demo broker logging | B: Dukascopy workflow | C: OANDA bid / ask |
|---|---|---|---|
| Venue measured | the demo broker (where a copy would fill) | Dukascopy (a second feed) | OANDA (the signals' own feed) |
| History | from deploy on (plus whatever tick history the broker keeps) | 2009/2010 to now | probably 2005-2010 to now (to verify) |
| Changes | `council/ctrader-symbols.mjs` (read-only), one line in `council.yml`, a new data file | a new workflow + the two studies' code | `api/bars.js`, a served file |
| Touches the live site or trading | no | no | the site's candle API |
| Cost | free | free | free |
| Answer in | gotobi first reading 3-4 weeks, 20 entries ~4 months; Rule G 20 Sundays ~20 weeks | ~1-2 weeks if Dukascopy answers the runner | ~1-2 weeks after deploy and a new pre-registration |
| Second-feed check of the leads | no | yes | no |

## Recommendation

**Start with Route A, and run Route B beside it; hold Route C.** A is the only route that measures the broker the council
would actually trade on, it is read-only and demo-only through the session that already runs each round, it touches no
served file and no trading figure, and it feeds an existing pre-registration directly (#944's 20-reopen rule names these demo
quotes as its source); its one open question, how far back the broker keeps tick history, can be answered on its first run
and may shorten the wait from months to days. B is the right second step because it is the only route that gives seventeen
years at once and a check of both leads on a second feed, and its two pre-registrations are already committed: what is left
is finishing their code under those pre-registrations and a workflow with no secrets. C changes a file the live site serves
and measures a third venue that answers neither "what does the market charge" nor "what would our broker charge", so it is
worth doing only if A and B both fail. **None of this changes a trading rule, a cost constant, the mirror or any council
member; a forward paper stream of either lead would be a separate owner decision after a measured cost, and no edge is
claimed for either lead: both rest today on spreads nobody has measured.**
