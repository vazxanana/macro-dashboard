# iFVG reversal model (ICT skill section 9) on gold, both sides via price mirroring.
import numpy as np, json, sys
SPREAD=0.30
def pivots(h,l,n):
    N=len(h); ph=np.zeros(N,bool); pl=np.zeros(N,bool)
    for j in range(n,N-n):
        w=h[j-n:j+n+1]; ph[j]=h[j]==w.max()
        w=l[j-n:j+n+1]; pl[j]=l[j]==w.min()
    return ph,pl
def run(B, D, side, P):
    t,o,h,l,c=B.T.copy()
    if side<0: o,h,l,c=-o,-l,-h,-c
    N=len(t); n=P['piv']; ph,pl=pivots(h,l,n)
    # daily context (prior completed day): PDH/PDL, 20d SMA, 20d range
    dt,do,dh,dl,dc=D.T.copy()
    if side<0: do,dh,dl,dc=-do,-dl,-dh,-dc
    di=np.searchsorted(dt,t,side='right')-2   # previous completed day index
    sma=np.convolve(dc,np.ones(20)/20,'full')[:len(dc)]
    rng=np.array([[dh[max(0,k-19):k+1].max(),dl[max(0,k-19):k+1].min()] for k in range(len(dc))])
    tr=np.maximum(h[1:],c[:-1])-np.minimum(l[1:],c[:-1]); atr=np.r_[np.nan,np.convolve(tr,np.ones(48)/48,'full')[:len(tr)]]
    act=[]  # active pivot lows: (price, idx)
    out=[]; last_exit=-1; i=n
    while i<N-1:
        j=i-n
        if j>=0 and pl[j]: act.append((l[j],j))
        act=[a for a in act if i-a[1]<=P['look']]
        swept=[a for a in act if l[i]<a[0]]
        if not swept or i<=last_exit: 
            i+=1; continue
        act=[a for a in act if l[i]>=a[0]]
        s=i; lo=l[s]; done=False
        for cidx in range(s, min(s+P['vmax']+1, N-1)):
            lo=min(lo,l[cidx])
            # most recent bearish FVG formed in the leg (k-2..k), k in [s-12, cidx-1]
            top=None
            for k in range(cidx-1, max(s-12,2)-1, -1):
                if h[k]<l[k-2]: top=l[k-2]; bot=h[k]; kk=k; break
            if top is None: continue
            if c[cidx]>top and o[cidx]<=top+1e-9 or (c[cidx]>top and c[cidx-1]<=top):
                e=c[cidx]; stop=lo-P['buf']; R0=e-stop
                if R0<=0.5 or not np.isfinite(atr[cidx]) or R0>P['maxatr']*atr[cidx]: break
                # internal high = most recent confirmed pivot high above entry since the swept pivot
                ih=None
                for k in range(cidx-n, max(cidx-P['look'],0), -1):
                    if ph[k] and h[k]>e: ih=h[k]; break
                valid = ih is None or h[cidx]<ih
                d=di[cidx]
                if d<20: break
                bull = dc[d]>sma[d]
                hi20,lo20=rng[d]; pd=(e-lo20)/(hi20-lo20+1e-9)
                # DOL: nearest pivot high above entry at >= 1R within lookback
                dol=None
                for k in range(cidx-n, max(cidx-P['look'],0), -1):
                    if ph[k] and h[k]>=e+R0: dol=h[k]; break
                body=abs(c[cidx]-o[cidx]); cr=(h[cidx]-l[cidx])+1e-9
                f=dict(t=int(t[cidx]),side=side,e=e,R0=R0,valid=valid,bull=bool(bull),pd=pd,speed=cidx-s,
                       bodyq=body/cr, closeloc=(c[cidx]-l[cidx])/cr, pdl=bool(lo<dl[d]), hr=int((t[cidx]%86400)//3600),
                       ih=ih, dol=dol, atr=atr[cidx], wd=int(((t[cidx]//86400)+4)%7))
                # simulate several exits
                res={}
                for name,tgt,be in P['exits']:
                    T = e+tgt*R0 if tgt!='dol' else (dol if dol is not None else e+2*R0)
                    st=stop; r=None; bem=False
                    for m in range(cidx+1, min(cidx+P['hold'], N)):
                        if l[m]<=st: r=(st-e); break
                        if h[m]>=T: r=(T-e); break
                        if be=='ih' and ih is not None and h[m]>=ih and not bem: st=e; bem=True
                        if be=='1r' and h[m]>=e+R0 and not bem: st=e; bem=True
                    if r is None: r=c[min(cidx+P['hold'],N)-1]-e
                    res[name]=round((r-SPREAD)/R0,3)
                f.update(res); out.append(f); last_exit=cidx+P['cool']; done=True
                break
        i = (last_exit+1) if done else i+1
    return out
if __name__=='__main__':
    tf=sys.argv[1] if len(sys.argv)>1 else 'm5'
    B=np.load(tf+'.npy'); D=np.load('d1.npy')
    P=dict(piv=3, look=96, vmax=6, buf=0.1, maxatr=8, hold={'m5':288,'m15':96,'h1':48}[tf], cool=6,
           exits=[('r1',1,None),('r2',2,None),('r3',3,None),('r2be',2,'ih'),('dol','dol',None),('dolbe','dol','ih')])
    T=run(B,D,1,P)+run(B,D,-1,P); T.sort(key=lambda x:x['t'])
    json.dump(T,open(f'ifvg_{tf}.json','w'),default=float); print(tf,len(T))
