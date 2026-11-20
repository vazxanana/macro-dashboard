// Probe 4 (20 Nov 2026): which Kalshi economics series exist for the releases the desk follows, and their open events. Prints only.
const UA = { 'user-agent': 'Mozilla/5.0 (macro desk; public data)', accept: '*/*' };
const get = async (u) => { const r = await fetch(u, { headers: UA }); return { s: r.status, t: await r.text() }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const RE = /\b(CPI|PCE|PPI|payroll|jobs|jobless|claims|unemploy|ISM|PMI|retail|GDP|fed\b|fomc|rate (cut|hike)|yield|treasur|10.?y|gold|silver|oil|crude|dollar|DXY|yen|JPY|EUR|recession|inflation|nasdaq|S&P|earnings|wage|JOLT|consumer|sentiment|housing starts|ECB|BOJ|Bank of Japan|Bank of England)/i;
try { const { t } = await get('https://api.elections.kalshi.com/trade-api/v2/series?category=Economics'); const j = JSON.parse(t);
  const hit = (j.series || []).filter((s) => RE.test(s.title) && !/gas price|AAAGAS/i.test(s.ticker + s.title));
  console.log('== series', (j.series || []).length, 'matched', hit.length); for (const s of hit) console.log('  ', s.ticker, '|', s.title, '|', s.frequency);
} catch (e) { console.log('series ERR', e.message); }
try { const { t } = await get('https://api.elections.kalshi.com/trade-api/v2/series?category=Financials'); const j = JSON.parse(t);
  console.log('== financials', (j.series || []).length); for (const s of (j.series || [])) console.log('  ', s.ticker, '|', s.title, '|', s.frequency);
} catch (e) { console.log('fin ERR', e.message); }
for (const s of ['KXRETAIL', 'KXRATEHIKE', 'KXEFFR', 'KXUSPSPEND', 'KXEIACRUDEW', 'KXPPI', 'KXPPICORE', 'KXJOBLESSCLAIMS', 'KXISMPMI', 'KXPCE', 'KXADP', 'KXJOLTS', 'KXTNOTEW', 'KXUSDJPY', 'KXGOLDW', 'KXWTI', 'KXCBDECISIONJAPAN', 'KXECBDECISION']) {
  try { const { s: st, t } = await get(`https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${s}&status=open&with_nested_markets=true&limit=2`); const j = JSON.parse(t);
    console.log('==', s, st, (j.events || []).map((e) => `${e.event_ticker} | ${e.title} | ${e.sub_title} | ${e.strike_period || ''} | ${(e.markets || []).slice(0, 12).map((m) => `${m.yes_sub_title}:${m.last_price_dollars}/${m.yes_bid_dollars}-${m.yes_ask_dollars} v${m.volume_fp} c${String(m.close_time).slice(0, 16)}`).join(' , ')}`).join('\n      ') || 'none open');
  } catch (e) { console.log(s, 'ERR', e.message); }
  await wait(900);
}
try { const { t } = await get('https://www.bls.gov/schedule/news_release/bls.ics'); const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ev = t.split('BEGIN:VEVENT').slice(1).map((b) => ({ d: (/DTSTART[^:]*:(\d{8}T\d{6})/.exec(b) || [])[1], s: (/SUMMARY:(.*)/.exec(b) || [])[1], raw: (/DTSTART[^\r\n]*/.exec(b) || [])[0] })).filter((e) => e.d && e.d.slice(0, 8) >= now).sort((a, b) => a.d.localeCompare(b.d));
  console.log('== bls upcoming', ev.length); for (const e of ev.slice(0, 40)) console.log('  ', e.raw, '|', (e.s || '').trim());
} catch (e) { console.log('bls ERR', e.message); }
try { const { t } = await get('https://apps.bea.gov/API/signup/release_dates.json'); const j = JSON.parse(t); const now = new Date().toISOString();
  for (const k of Object.keys(j)) { const up = (j[k].release_dates || []).filter((d) => d >= now).slice(0, 3); if (up.length) console.log('  bea', k, '|', up.join(' , ')); }
} catch (e) { console.log('bea ERR', e.message); }
