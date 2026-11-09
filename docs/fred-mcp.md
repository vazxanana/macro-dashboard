# Working on the ICT desk from ChatGPT (or Claude / Cursor)

The ICT desk has its own connector. Through it you can read the rules and every trade, look at candles, backtest
the desk's own model on 2020-now data with your own settings, compare your idea against the live rule, and propose a
change. A proposal becomes a draft pull request. The owner reviews it and decides. Nothing changes live until the
owner merges it.

## 1. Get your connector URL

Sign in on the desk, open **Profile**, find **ChatGPT connector**, type your desk password and copy the URL.
The URL contains your key, so don't share it. If it ever leaks, tell the owner and a new key will be made.

## 2. Add it

**ChatGPT (web).** Turn on Settings → Apps → Advanced settings → **Developer mode**. Then choose **Create app**
(older menus call it Settings → Connectors → Advanced → Create). Give it a name (for example "Meridian ICT"), paste
your URL as the MCP server URL, and set Authentication to **No authentication**. Tick the box to say you trust it,
then create it. In a chat, pick it from the **+** menu under Developer mode. On a Business or Enterprise workspace,
an admin has to allow developer mode first. Menus change: if yours look different, see OpenAI's help article
"Developer mode and MCP connectors in ChatGPT".

**Claude.** Go to Settings → Connectors → Add custom connector and paste the URL.

**Cursor.** Add this to `~/.cursor/mcp.json`: `{ "mcpServers": { "meridian-ict": { "url": "<your URL>" } } }`

ChatGPT asks you to confirm before any tool that writes (a note, a proposal or a comment). That's expected.

## 3. The tools

| Tool | What it does |
|---|---|
| `ict_guide` | Explains the desk, the model, the rules and the workflow. Start here. |
| `ict_rules` | The rule book (`.claude/skills/ICT/SKILL.md`) by section, plus the live parameters |
| `ict_trades`, `ict_trade` | Live and replay signals with stats and filters (market, grade, side, dates, outcome); one trade with every feature |
| `ict_status` | The tracker now: prices, open paper trades, shadow variants, notes |
| `ctrader_results` | Demo account results by label (no account numbers) |
| `ict_bars` | Candles (OANDA) for a market, timeframe and window, up to 1500 |
| `ict_backtest` | Runs the desk's own iFVG engine on 2020-now H1 candles with your parameters and filters. Returns n, win rate, average R, net R, profit factor, max drawdown, t, results by year and by side, in sample (2020-2023) vs out of sample (2024-now), and sample trades. |
| `ict_compare` | The live rule vs your proposal on the same candles: both sets, the differences, year by year and market by market, and a verdict |
| `ict_file_list`, `ict_file_read` | The ICT source files you may change |
| `ict_propose_change` | Opens a draft PR. Send whole files, a test, what / why / evidence / risk. |
| `ict_my_proposals`, `ict_proposal_comment` | Your PRs with CI status and the owner's comments; replies on your own PRs |
| `ict_note` | Saves a note on a trade or for the owner |
| `search`, `fetch` | Search across trades, rules and the guide (ChatGPT deep research uses these) |

Backtest settings (`params`): `piv` (swing candles, 3), `look` (96), `vmax` (candles from sweep to inversion, 6),
`maxAtr` (8), `holdH` (time exit in H1 candles, 36), `be` (break-even R, 1.5; 0 turns it off), `trail_from` /
`trail_dist` (2 / 1.5; trail_from 0 turns the trail off), `mark` (2).
Filters (`filters`): `min_grade`, `sides`, `sessions`, `atr_min` / `atr_max` (stop vs the daily ATR), `bias`, `zone`,
`min_body`, `max_speed`, `htf_fvg`, `skip_friday`, `min_room_r`.
`rule: "all"` tests every signal instead of the A-setups, and `sizing: "flat"` sizes every trade at 1 unit.

## 4. Example prompts

- "Call ict_guide, then summarise the A-setup rule in five lines."
- "Show the A-setup losses on NQ since 1 October and what they have in common."
- "Backtest NQ, ES and YM from 2020 with the live rule. Then compare it with skipping Fridays. Is the difference out of sample real?"
- "Compare the live rule with `vmax: 4` and `filters: { atr_max: 0.6 }` on all five markets. Show it year by year."
- "Read ict/tracker.mjs, change the A-setup to exclude the NY PM session, write a test for it, and propose the change with evidence_run."
- "What did the owner say on my proposals? Is CI green?"

## 5. The review rules

- **Paper only.** Nothing here places an order.
- **Every trade has a stop.** No change may remove a stop, move it away from the sweep, or loosen a trailed stop.
- **An edge must pass out of sample on 2020-now data.** That means at least 30 trades out of sample, positive
  average R both in sample and out of sample, and most out-of-sample years positive, all net of costs. A t of 2 or
  more is strong. Report every variant you tried, not only the best one.
- **The owner approves every rule change.** The server checks a proposal before it opens the PR:
  - only ICT files can change;
  - a code or rule change needs a test at `tests/ict-<topic>.test.mjs`;
  - every file must pass a syntax check;
  - no new network, environment or process access.

  CI runs the tests, and the owner decides.
- **ICT stays separate** from the council systems.

## 6. Limits and caveats

- **Rate limits per key:** 90 calls a minute, 12 backtests or comparisons per 10 minutes, 40 candle requests per
  10 minutes, and 20 writes an hour (6 of them can be proposals).
- **Backtest windows:** 1 to 5 markets, from 2020-01-01. Long answers are cut at 150,000 characters.
- **Backtests run on OANDA cash CFDs** (NQ → NAS100, ES → SPX500, YM → US30, RTY → US2000, GC → spot gold), while
  the live desk trades futures. Prices differ, but the structure is the same. If OANDA is unavailable, NQ, ES and YM
  use the research candles from 2023 on, and the answer says so.
