export default async (req) => {
  const jsonHeaders = {'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'POST required'}), {status:405, headers:jsonHeaders});

  const base = (process.env.PYPORTFOLIOOPT_API_URL || '').trim();
  const secret = (process.env.QUANT_SERVICE_SECRET || '').trim();
  if (!base) return new Response(JSON.stringify({error:'PyPortfolioOpt service is not configured. Set PYPORTFOLIOOPT_API_URL.'}), {status:503, headers:jsonHeaders});
  if (!secret) return new Response(JSON.stringify({error:'Quant service authentication is not configured. Set QUANT_SERVICE_SECRET in Netlify.'}), {status:503, headers:jsonHeaders});

  try {
    const body = await req.text();
    const url = `${base.replace(/\/$/,'')}/optimize`;
    const r = await fetch(url, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'accept':'application/json',
        'authorization':`Bearer ${secret}`
      },
      body
    });
    const text = await r.text();
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {
        error:`Quant service returned a non-JSON response (HTTP ${r.status}).`,
        upstream_content_type:ct || 'unknown',
        upstream_preview:text.slice(0,180)
      };
    }
    return new Response(JSON.stringify(payload), {status:r.status, headers:jsonHeaders});
  } catch (e) {
    return new Response(JSON.stringify({error:`Optimizer proxy failed: ${e.message}`}), {status:502, headers:jsonHeaders});
  }
};
