const KEY='mk_thesis_history_v09';
export function readHistory(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
export function saveVersion(entry){const h=readHistory();h.unshift(entry);localStorage.setItem(KEY,JSON.stringify(h.slice(0,100)));return h;}
export function tickerHistory(ticker){return readHistory().filter(x=>x.ticker===ticker)}
export function diffThesis(curr,prev){if(!prev)return ['Initial thesis version'];const fields=[['core','Core thesis'],['assumptions','Assumptions'],['invalidation','Invalidation'],['catalysts','Catalysts']];const out=[];for(const [k,n] of fields)if((curr[k]||'').trim()!==(prev[k]||'').trim())out.push(`${n} changed`);return out.length?out:['No text changes vs prior version'];}
