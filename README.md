# Meridian X

A paper-trading desk run by an automated council (gold, forex, index futures, crypto), live at
[meridianx.dev](https://meridianx.dev). Paper trading and demo accounts only. Not financial advice.

- **What it is, in plain English:** [MERIDIAN-X.md](MERIDIAN-X.md)
- **Decisions waiting on the owner:** [docs/owner-decisions.md](docs/owner-decisions.md)
- **Working on the ICT desk from ChatGPT (or another MCP client):** [docs/fred-mcp.md](docs/fred-mcp.md)
- **Developer notes (map, rules, build and test):** [CLAUDE.md](CLAUDE.md), starting with "Start here"

## Quick start for developers

```sh
sh scripts/build.sh                    # build the site into out/ (commit out/ with page changes)
node --test tests/*.test.mjs tests/*.test.js
```

The site is static pages plus Vercel functions in `api/`; the council runs on GitHub Actions (`.github/workflows/council.yml`)
and writes to the `council-data` branch. `netlify.toml` and `_redirects` are left over from an early Netlify version and are not
used by the live site.
