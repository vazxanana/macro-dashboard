// Edge research · meridian-swing: robustness probe of the one near-miss (owner rule + hold to target 2) and the ADX band by period.
//   node probe.mjs <outDir>
import fs from 'node:fs';
const D = process.argv[2]; const rows = [];
for (const k of ['xau','eurusd','gbpusd','audusd','usdcad','usdchf']) { const j = JSON.parse(fs.readFileSync(`${D}/${k}.json`)); for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c,i)=>[c,r[i]])); o.m=k; rows.push(o);} }
const c = rows.filter(x=>x.status==='closed' && x.k==='swing');
const st = (a, e, cm=1) => { const R=a.map(x=>x['R_'+e]-cm*x.cost); const n=R.length, m=R.reduce((p,q)=>p+q,0)/n, sd=Math.sqrt(R.reduce((p,q)=>p+(q-m)**2,0)/(n-1)); return `n${n} ${m.toFixed(3)} t${(m/sd*Math.sqrt(n)).toFixed(2)}`; };
const own = c.filter(x=>x.d1==='against'); const yr=x=>new Date(x.filled*1000).getUTCFullYear();
console.log('owner tp2', st(own,'tp2'), '1.5x cost', st(own,'tp2',1.5), '2x', st(own,'tp2',2));
for (const m of ['xau','eurusd','gbpusd','audusd','usdcad','usdchf']) console.log(' ', m, st(own.filter(x=>x.m===m),'tp2'), '| none', st(own.filter(x=>x.m===m),'none'));
for (const y of [2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]) { const a=own.filter(x=>yr(x)===y); if(a.length>1) console.log(' ', y, st(a,'tp2'), '| none', st(a,'none')); }
for (const s of ['buy','sell']) console.log(' ', s, st(own.filter(x=>x.side===s),'tp2'));
console.log('owner tp2 excl xau', st(own.filter(x=>x.m!=='xau'),'tp2'), 'excl usdchf', st(own.filter(x=>x.m!=='usdchf'),'tp2'));
const b = own.filter(x=>x.adxBand===true);
console.log('owner+ADX band 2018-23', st(b.filter(x=>yr(x)>=2018&&yr(x)<=2023),'none'), '2024-26', st(b.filter(x=>yr(x)>=2024),'none'));
console.log('owner all 2018-23', st(own.filter(x=>yr(x)>=2018&&yr(x)<=2023),'none'), '2024-26', st(own.filter(x=>yr(x)>=2024),'none'));
// tp2 geometry
const rr2 = own.map(x=>x.R_tp2).filter(r=>r>0); console.log('owner tp2 winners avg R', (rr2.reduce((a,b)=>a+b,0)/rr2.length).toFixed(2), 'median rr1', own.map(x=>x.rr).sort((a,b)=>a-b)[own.length>>1]);
