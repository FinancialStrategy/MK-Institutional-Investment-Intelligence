function mean(a){return a.reduce((s,x)=>s+x,0)/a.length}
function variance(a){const m=mean(a);return a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)}
function cov(a,b){const ma=mean(a),mb=mean(b);let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-ma)*(b[i]-mb);return s/(a.length-1)}
function retSeries(rows){const out=[];for(let i=1;i<rows.length;i++){const a=rows[i-1].close,b=rows[i].close;if(a>0&&b>0)out.push({date:rows[i].date,r:Math.log(b/a)});}return out}

export function alignReturns(payloads){
  const maps=payloads.map(p=>new Map(retSeries(p.rows).map(x=>[x.date,x.r])));
  const common=[...maps[0].keys()].filter(d=>maps.every(m=>m.has(d))).sort();
  return {dates:common, returns:common.map(d=>maps.map(m=>m.get(d)))};
}

function moments(aligned){
  const t=aligned.returns.length,n=aligned.returns[0]?.length||0;
  const cols=Array.from({length:n},(_,j)=>aligned.returns.map(r=>r[j]));
  const mu=cols.map(c=>mean(c)*252);
  const sigma=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>cov(cols[i],cols[j])*252));
  return {mu,sigma,t};
}
function portStats(w,mu,sigma,rf=0){
  let er=0,v=0;for(let i=0;i<w.length;i++){er+=w[i]*mu[i];for(let j=0;j<w.length;j++)v+=w[i]*w[j]*sigma[i][j];}
  const vol=Math.sqrt(Math.max(v,0));return {ret:er,vol,sharpe:vol>0?(er-rf)/vol:NaN};
}
function halton(index, base){
  let f=1,r=0,i=index;
  while(i>0){f/=base;r+=f*(i%base);i=Math.floor(i/base);}
  return Math.min(Math.max(r,1e-12),1-1e-12);
}
const HALTON_BASES=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53];
function candidateWeights(n,k){
  // Low-discrepancy Dirichlet(1) draw: covers the long-only simplex far more
  // evenly than the old sine generator, which clustered around equal weights.
  const a=[];let s=0;
  for(let i=0;i<n;i++){const u=halton(k+1,HALTON_BASES[i%HALTON_BASES.length]);const v=-Math.log(u);a.push(v);s+=v;}
  return a.map(x=>x/s);
}

export function previewFrontier(payloads, rf=0, samples=1800){
  const aligned=alignReturns(payloads);if(aligned.returns.length<60) throw new Error('Insufficient common return history for optimization preview.');
  const {mu,sigma,t}=moments(aligned), n=payloads.length, points=[];
  // Include corner and two-asset portfolios so the feasible set and frontier
  // are not artificially compressed around equal-weight allocations.
  for(let i=0;i<n;i++){const w=Array(n).fill(0);w[i]=1;points.push({...portStats(w,mu,sigma,rf),w});}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)for(const a of [.2,.4,.6,.8]){const w=Array(n).fill(0);w[i]=a;w[j]=1-a;points.push({...portStats(w,mu,sigma,rf),w});}
  for(let k=0;k<samples;k++){const w=candidateWeights(n,k);points.push({...portStats(w,mu,sigma,rf),w});}
  points.sort((a,b)=>a.vol-b.vol);
  const frontier=[];let best=-Infinity;for(const p of points){if(p.ret>best){frontier.push(p);best=p.ret;}}
  const minVol=points.reduce((a,b)=>b.vol<a.vol?b:a,points[0]);
  const maxSharpe=points.reduce((a,b)=>b.sharpe>a.sharpe?b:a,points[0]);
  return {points,frontier,minVol,maxSharpe,mu,sigma,observations:t};
}
