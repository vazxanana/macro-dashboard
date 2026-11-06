import json, numpy as np
H='/tmp/claude-0/-home-user-macro-dashboard/c2dc7fb2-4f29-5e98-9440-715a16060a88/scratchpad/hd/'
def m1():
    A=[]
    for y in (2023,2024,2025,2026): A+=json.load(open(H+f'xau_{y}.json'))['1m']
    a=np.array(A,dtype=float); a=a[np.argsort(a[:,0])]; _,i=np.unique(a[:,0],return_index=True); return a[i]
def rs(a,sec):
    k=(a[:,0]//sec).astype(np.int64); idx=np.flatnonzero(np.r_[True,k[1:]!=k[:-1]]); end=np.r_[idx[1:],len(a)]
    t=k[idx]*sec; o=a[idx,1]; h=np.maximum.reduceat(a[:,2],idx); l=np.minimum.reduceat(a[:,3],idx); c=a[end-1,4]
    return np.c_[t,o,h,l,c]
if __name__=='__main__':
    a=m1(); np.save('m1.npy',a); np.save('m5.npy',rs(a,300)); np.save('m15.npy',rs(a,900)); np.save('h1.npy',rs(a,3600))
    # trading day: shift +2h so the 22:00 UTC rollover starts a day
    b=a.copy(); b[:,0]+=7200; d=rs(b,86400); d[:,0]-=7200; np.save('d1.npy',d); print(len(a), len(d))
