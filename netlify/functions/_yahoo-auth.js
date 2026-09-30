const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36';

function cookiesFromHeaders(headers){
  try {
    const arr = headers.getSetCookie?.();
    if (Array.isArray(arr) && arr.length) return arr.map(x=>x.split(';')[0]).join('; ');
  } catch(_e) {}
  const one = headers.get('set-cookie');
  if (!one) return '';
  return one.split(/,(?=\s*[^;,]+=)/).map(x=>x.trim().split(';')[0]).join('; ');
}

async function bootstrapCookie(){
  const bootstrapUrls = [
    'https://fc.yahoo.com',
    'https://finance.yahoo.com/quote/AAPL/'
  ];
  for (const url of bootstrapUrls){
    try{
      const r = await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'},redirect:'manual'});
      const cookie = cookiesFromHeaders(r.headers);
      if(cookie) return cookie;
    }catch(_e){}
  }
  return '';
}

export async function yahooAuth(){
  const cookie = await bootstrapCookie();
  const crumbHosts=['https://query1.finance.yahoo.com/v1/test/getcrumb','https://query2.finance.yahoo.com/v1/test/getcrumb'];
  let last='';
  for(const url of crumbHosts){
    try{
      const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/plain,*/*','cookie':cookie}});
      const txt=(await r.text()).trim();
      last=`HTTP ${r.status}`;
      if(r.ok && txt && !txt.startsWith('{') && !txt.startsWith('<')) return {cookie,crumb:txt,status:'PASS'};
    }catch(e){last=e.message;}
  }
  return {cookie,crumb:'',status:'FAILED',error:`Yahoo crumb handshake failed${last?`: ${last}`:''}`};
}

export async function yahooJson(url,{auth=false,authState=null}={}){
  let u=url; let a=authState;
  if(auth){
    a=a||await yahooAuth();
    if(!a.crumb) throw new Error(a.error||'Yahoo authentication unavailable');
    const sep=u.includes('?')?'&':'?';
    u += `${sep}crumb=${encodeURIComponent(a.crumb)}`;
  }
  const r=await fetch(u,{headers:{'user-agent':UA,'accept':'application/json,text/plain,*/*',...(a?.cookie?{'cookie':a.cookie}:{})}});
  if(!r.ok){
    let body=''; try{body=(await r.text()).slice(0,300);}catch(_e){}
    throw new Error(`HTTP ${r.status}${body?` ${body}`:''}`);
  }
  return await r.json();
}

export function raw(v){ return v && typeof v==='object' && 'raw' in v ? v.raw : v; }
export const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
