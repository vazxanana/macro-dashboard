# Council live runner (laptop or VPS)

Runs the Trader and the cTrader demo mirror every 30 seconds, so a council trade reaches the demo within seconds. The GitHub
Actions council keeps the heavy members and steps aside for the Trader while this runner's heartbeat (council-data `live.json`)
is fresh; if the machine sleeps, the workflow takes the Trader back on its own.

## Windows laptop
1. Install [Node.js 22](https://nodejs.org) and [Git for Windows](https://git-scm.com). Clone this repository, e.g. `git clone https://github.com/vazxanana/macro-dashboard.git` in your user folder.
2. Create the folder `%USERPROFILE%\meridianx` and copy `scripts\live\env.example` there as `.env`. Fill in the values (GitHub token with Contents read/write on this repository; the cTrader demo keys you use for the workflow; optionally the OANDA practice token so the candles come from a local proxy instead of the site). Keep this file out of the repository.
3. In the repository folder run `scripts\live\install-task.cmd` once. It registers a login task and sets the laptop never to sleep on mains power. Start it right away with `schtasks /run /tn MeridianXLive`.
4. Check: a `live.json` appears on the council-data branch within a minute, and the council desk's mirror log shows rounds every 30 s.

Remove: `schtasks /delete /tn MeridianXLive /f`.

## Linux VPS
Node 22, git, clone the repository to `~/macro-dashboard`, `.env` in `~/meridianx/.env`, then install `scripts/live/meridianx-live.service` as a user service (instructions in the file).

## Rules it keeps
Demo accounts only (the mirror refuses a live account), the same message allowlist as the workflow, secrets never logged or stored in `.git/config`, the same council code as main (it restarts itself when main changes).
