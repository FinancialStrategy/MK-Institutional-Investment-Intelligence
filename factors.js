const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function inv(A){const n=A.length,M=A.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)throw new Error('Singular factor regression matrix');[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=0;j<2*n;j++)M[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];for(let j=0;j<2*n;j++)M[r][j]-=f*M[c][j];}}return M.map(r=>r.slice(n));}
function mm(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,x,k)=>s+x*B[k][j],0)));}
function tr(A){return A[0].map((_,i)=>A.map(r=>r[i]));}
export function factorRegression(assetRows,factorRows){
  const am=new Map(); for(let i=1;i<assetRows.length;i++){const a=assetRows[i-1],b=assetRows[i];if(Number.isFinite(a.close)&&a.close>0&&Number.isFinite(b.close)&&b.close>0)am.set(b.date,b.close/a.close-1);}
  const rows=factorRows.filter(f=>am.has(f.date)); if(rows.length<126)throw new Error(`Insufficient common factor observations (${rows.length}; need 126).`);
  const X=rows.map(f=>[1,f.mkt,f.smb,f.hml,f.rmw,f.cma,f.mom]); const y=rows.map(f=>[am.get(f.date)-f.rf]);
  const Xt=tr(X),XtX=mm(Xt,X),XtY=mm(Xt,y),I=inv(XtX),b=mm(I,XtY).map(x=>x[0]);
  const yh=X.map(r=>r.reduce((s,x,i)=>s+x*b[i],0)),yv=y.map(x=>x[0]),ym=mean(yv),res=yv.map((v,i)=>v-yh[i]);const sse=res.reduce((s,x)=>s+x*x,0),sst=yv.reduce((s,x)=>s+(x-ym)**2,0),r2=sst>0?1-sse/sst:null;const dof=rows.length-X[0].length,s2=dof>0?sse/dof:null;const se=I.map((r,i)=>Number.isFinite(s2)?Math.sqrt(Math.max(0,s2*r[i])):null);const t=b.map((v,i)=>Number.isFinite(se[i])&&se[i]>0?v/se[i]:null);
  return {n:rows.length,start:rows[0].date,end:rows.at(-1).date,alphaDaily:b[0],alphaAnnual:(1+b[0])**252-1,loadings:{MKT:b[1],SMB:b[2],HML:b[3],RMW:b[4],CMA:b[5],MOM:b[6]},tstats:{ALPHA:t[0],MKT:t[1],SMB:t[2],HML:t[3],RMW:t[4],CMA:t[5],MOM:t[6]},r2};
}
export function portfolioFactorExposure(results,weights){const ks=['MKT','SMB','HML','RMW','CMA','MOM'],out={};for(const k of ks)out[k]=results.reduce((s,r,i)=>s+(weights[i]||0)*(r?.loadings?.[k]||0),0);return out;}
