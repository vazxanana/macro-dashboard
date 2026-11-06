import json, numpy as np, time
S='/tmp/claude-0/-home-user-macro-dashboard/c2dc7fb2-4f29-5e98-9440-715a16060a88/scratchpad/ict/idx/'
COST={'nq':1.0,'es':0.5,'ym':2.5}
def sim(p,tgt=None,trail=(2,1.5),hold=48):
    stop=-1.0; best=0
    for hi,lo,cl in p[:hold]:
        if lo<=stop: return stop
        if tgt and hi>=tgt: return tgt
        best=max(best,hi)
        if trail and best>=trail[0]: stop=max(stop,best-trail[1])
    return p[min(hold,len(p))-1][2] if p else 0
D={m:json.load(open(S+m+'.json')) for m in ('nq','es','ym')}
yr=lambda x:time.gmtime(x['signalAt']).tm_year
rows={}
for m,L in D.items():
    print(f'===== {m.upper()}')
    for nm,f in (('ALL',lambda x:True),('A',lambda x:x['aset']),('A+',lambda x:x['aplus'])):
        for ex,kw in (('3R',dict(tgt=3,trail=None)),('trail',dict())):
            cells=[]
            for y in (2023,2024,2025,2026):
                r=np.array([sim(x['path'],**kw)-COST[m]/x['r0'] for x in L if f(x) and yr(x)==y and x['path']])
                cells.append(f'{y} n{len(r):3d} {r.mean():+.3f} {r.sum():+6.1f}')
                rows.setdefault((nm,ex,y),[]).extend(r.tolist())
            print(f'{nm:3s} {ex:5s}', ' | '.join(cells))
print('===== all three indices together')
for nm in ('ALL','A','A+'):
    for ex in ('3R','trail'):
        print(f'{nm:3s} {ex:5s}', ' | '.join(f"{y} n{len(rows[(nm,ex,y)]):4d} {np.mean(rows[(nm,ex,y)]):+.3f} {np.sum(rows[(nm,ex,y)]):+6.1f}" for y in (2023,2024,2025,2026)))
