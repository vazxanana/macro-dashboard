#!/bin/sh
# Builds out/. Run it locally and commit out/ (CI fails when out/ is stale). The Cloudflare Worker serves the committed
# out/ (cloudflare/wrangler.jsonc assets); nothing builds it on deploy.
set -e
mkdir -p out
cp -r market-structure.html gold-trading.html manifest.json app.webmanifest charts.webmanifest sw.js offline.html icon-192.png icon-512.png icons robots.txt assets out/
cp market-structure.html out/index.html
node scripts/hoist-styles.mjs out/market-structure.html out/index.html
cp edge-lab.html backtest.html macro-desk.html out/
cp academy.html farm.html out/
node scripts/equinox-page.mjs out   # equinox.html + the Desk's data reader, Mosha styles and replay card (23 Nov 2026)
node research/edge/build.mjs out
node scripts/veteran-index.mjs out
node scripts/self-host-fonts.mjs out
node scripts/pwa.mjs out
node scripts/charts-app.mjs out   # charts.html = the Desk page as the charts-only app (26 Nov 2026)
node scripts/stamp-assets.mjs out
