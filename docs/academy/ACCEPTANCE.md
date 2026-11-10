# Owner acceptance checklist

About 30 minutes. Each step says what to do and what you should see. Tick it only if you saw it. Nothing here can place an
order: the Academy is replay and paper only.

## 0. Start it

Any of these:

- **Production (since 10 Nov 2026):** sign in to the desk at `https://meridianx.dev` as the owner, then open `/academy`
  (account menu → "MeridianX Academy"). Live candles; the store starts empty and is yours alone.
- **Local (always works, no deployment):**
  `sh scripts/build.sh && node --use-env-proxy scripts/academy-dev.mjs --live` then open `http://127.0.0.1:8770/academy`.
  This serves the built site with the real Academy API on a file store on your machine and live candles from the site's
  candle feed. Without `--live` (and without `--use-env-proxy`) it uses recorded real gold candles from 26 Apr to 17 May 2024
  and works offline.
- **Preview on Vercel:** follow `docs/academy/PREVIEW.md` (one project variable, then open the preview URL and sign in as
  the owner). A preview keeps its Academy files in its own folder; production is not touched.

## 1. Access

- [ ] Signed out, `/academy` shows "owner only" and loads no data.
- [ ] Signed in as a member who is not the owner (Fred, Orlando), the same.
- [ ] Signed in as the owner, the Desk's account menu shows "MeridianX Academy" and the page opens on the Train tab.

## 2. Replay and a decision

- [ ] Pick an edge (try `Gold momentum pullback` first: it has the most setups), keep the suggested dates, press Start.
      Candles load for five timeframes and the chart names its source.
- [ ] Play at 100×. The clock stops by itself on a setup and shows BUY, SELL or WAIT with evidence for and against, what
      would prove it wrong, the risk line and "Attempt 1 stored".
- [ ] Pause, step one candle, jump to a date, restart: each does what it says.
- [ ] The result of the setup is nowhere on the screen before the attempt is stored.

## 3. Correct it and prove it

- [ ] On a BUY or SELL you disagree with, choose "Change to WAIT", tick a reason, write one line, Save correction.
- [ ] A lesson draft appears ("When … → Then WAIT"). Trim it to one condition you believe, Save lesson.
- [ ] Press "Replay same trade again". The second attempt is WAIT, the lesson is named as applied, the verdict says
      "Learned", and the page says this proves recall, not generalisation.
- [ ] Under the verdict a control line says what the engine answers on the same trade with the lesson left out: it is the
      first answer again, so the change came from the lesson and from nothing else.
- [ ] Press "Test on new setups". Each unseen setup is decided twice (with and without your lessons) and the table shows
      net R for both with its n, and "too few to judge" under 20.
- [ ] Reload the page (or stop and start the local server). The lesson, the attempts and the saved session are still there.
- [ ] Lessons tab: switch the lesson off and replay the same trade: the answer goes back to the first one. Switch it on again.
- [ ] Lessons tab, "Check earlier corrections": every corrected trade is decided again with today's lessons; one that a
      later lesson undid is listed as a regression.
- [ ] A setup from "Test on new setups" cannot be corrected or turned into a lesson (the page says why): unseen setups stay unseen.

## 4. The other tabs

- [ ] **What if** (on a stored decision): the setup as proposed, your levels and the fixed variants each show a net R. The
      card says this is hindsight, for study.
- [ ] **Blind arena:** you answer first; only then is the engine's stored answer shown beside yours, and the result last.
- [ ] **Session:** replay a day, mark one "should have acted here" and one "right to wait"; the summary counts both.
- [ ] **Progress:** recall and new-setup results sit side by side and are never added together; your mistake is listed and
      comes back in the review queue.
- [ ] **Research:** the studies list opens; the counts say how many tests would pass by chance. Add one notebook note.
- [ ] **Models:** every scorer shows its walk-forward numbers and "rejected challenger"; nothing is promoted.
- [ ] **Costs:** "Off. No key is set. Spent: $0.00" (unless you set a language-model key yourself).
- [ ] **The analyst** (the written second opinion under a stored decision), through your own assistant: press "Set up the
      connector", paste the address into your assistant app as a custom connector, press "Ask the analyst" (the block says the
      question waits), tell the assistant "Answer my Academy questions", then press "Check for the answer". The answer sits
      beside the engine's, never in its place, marked as from your own assistant, at no cost (`docs/academy/LLM.md` section 9).
- [ ] **Audit:** every save you just made is a row with its time.

## 5. The honest numbers

Open `MERIDIANX_BUILD_PROGRESS.md` and check that these are stated plainly, with n and t:

- [ ] the seven edges before and after the clock correction;
- [ ] the decision policy against taking every setup (expectancy and drawdown): if it is not better, it says so;
- [ ] every trained scorer's verdict;
- [ ] what the research engine validated (possibly nothing).

## 6. Independent checks you can run yourself

- [ ] `node --test tests/*.test.mjs tests/*.test.js` ends with `fail 0`.
- [ ] `node scripts/audit/academy.cjs` (the browser walks every tab on recorded real candles) ends with all checks passed.
- [ ] `node --use-env-proxy scripts/audit/academy-review.mjs` (live candles: timestamps, no look-ahead, lessons across a
      restart, unseen setups kept apart, costs, the risk engine, all seven edges, no order path) ends with all checks passed.

## 7. Production

- [ ] You have read "Known problems" and "Owner decisions" in the progress file.
- [ ] The Academy is on `main` since 10 Nov 2026 (your "Deploy everything"): on production, `/academy` opens for the owner only
      and its store starts empty. To take it off again, revert the merge commit of pull request #1 on `main`.
