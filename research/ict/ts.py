# Turtle soup on the previous day's range (one-candle range): H1 runs PDL (bull bias) and closes back inside -> buy.
import numpy as np, json
H=np.load('h1.npy'); D=np.load('d1.npy'); cut=1735689600; SP=0.5
def st(r):
    r=np.array(r)
    if not len(r): return '-'
    eq=np.cumsum(r); dd=(np.maximum.accumulate(np.r_[0,eq])[1:]-eq).max(); return f'n{len(r):3d} {r.mean():+.3f} {r.sum():+6.1f} dd{dd:4.1f}'
def run(side, S, Rn, thr, tgt):
    t,o,h,l,c=H.T.copy(); dt,do,dh,dl,dc=D.T.copy()
    if side<0: o,h,l,c=-o,-l,-h,-c; do,dh,dl,dc=-do,-dl,-dh,-dc
    di=np.searchsorted(dt,t,side='right')-1   # current day index
    out=[]; i=1; N=len(t)
    while i<N-1:
        d=di[i]; p=d-1
        if p<max(S,Rn): i+=1; continue
        pdl,pdh=dl[p],dh[p]; mid=(pdl+pdh)/2
        day=np.flatnonzero(di[:i+1]==d); lo=l[day].min()
        if lo<pdl and c[i]>pdl and c[i-1]<=pdl:
            sma=dc[p-S+1:p+1].mean(); hi20=dh[p-Rn+1:p+1].max(); lo20=dl[p-Rn+1:p+1].min()
            w=dc[p]>sma; pd=(c[i]-lo20)/(hi20-lo20)
            if w and pd<thr:
                e=c[i]; st_=lo-0.1; R0=e-st_
                T={'mid':mid,'pdh':pdh,'2r':e+2*R0}[tgt]
                if R0>0.5 and T>e:
                    r=None
                    for m in range(i+1,min(i+48,N)):
                        if l[m]<=st_: r=st_-e; break
                        if h[m]>=T: r=T-e; break
                    if r is None: r=c[min(i+48,N)-1]-e
                    out.append((t[i],(r-SP)/R0))
                    i=np.flatnonzero(di>d)[0] if (di>d).any() else N; continue
        i+=1
    return out
for tgt in ('mid','pdh','2r'):
  for thr in (0.5,1.01):
    L=sorted(run(1,50,20,thr,tgt)+run(-1,50,20,thr,tgt))
    print(f'tgt {tgt:3s} pd<{thr}', 'A',st([r for t,r in L if t<cut]),'| B',st([r for t,r in L if t>=cut]))
