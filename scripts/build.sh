#!/bin/sh
# Builds out/. Run it locally and commit out/ (CI fails when out/ is stale). Vercel no longer runs it:
# vercel.json buildCommand only checks out/ exists and serves the committed copy (12 Nov 2026, build minutes cost).
set -e
mkdir -p out/macro
cp -r market-structure.html gold-trading.html manifest.json app.webmanifest sw.js offline.html icon-192.png icon-512.png icons robots.txt assets out/
cp market-structure.html out/index.html
node scripts/hoist-styles.mjs out/market-structure.html out/index.html
cp index.html out/macro/index.html
cp edge-lab.html backtest.html macro-desk.html out/
cp academy.html out/
node research/edge/build.mjs out
node scripts/veteran-index.mjs out
node scripts/self-host-fonts.mjs out
node scripts/pwa.mjs out
node scripts/stamp-assets.mjs out
