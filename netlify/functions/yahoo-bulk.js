const ALLOWED_RANGES = new Set(['1mo','3mo','6mo','1y','2y','5y','10y','max']);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': statusCode === 200 ? 'public, max-age=300' : 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

async function fetchTicker(ticker, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=1d&includeAdjustedClose=true&events=div%2Csplits`;
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 MKInstitutional/0.3', accept: 'application/json,text/plain,*/*' } });
  if (!response.ok) throw new Error(`${ticker}: Yahoo upstream ${response.status}`);
  const raw = await response.json();
  const result = raw?.chart?.result?.[0];
  if (!result) throw new Error(`${ticker}: ${raw?.chart?.error?.description || 'No result'}`);
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = (result.timestamp || []).map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: q.open?.[i] ?? null, high: q.high?.[i] ?? null, low: q.low?.[i] ?? null, close: q.close?.[i] ?? null,
    adjClose: adj?.[i] ?? q.close?.[i] ?? null, volume: q.volume?.[i] ?? null
  })).filter(r => [r.open, r.high, r.low, r.close].every(Number.isFinite));
  if (rows.length < 30) throw new Error(`${ticker}: insufficient valid observations`);
  return { ticker, source: 'Yahoo Finance', currency: result.meta?.currency || null, exchange: result.meta?.exchangeName || null, dataThrough: rows.at(-1)?.date || null, rows };
}

export async function handler(event) {
  try {
    const rawTickers = String(event.queryStringParameters?.tickers || '').split(',').map(x => x.trim()).filter(Boolean);
    const range = String(event.queryStringParameters?.range || '2y');
    const tickers = [...new Set(rawTickers)].slice(0, 12);
    if (!tickers.length) return json(400, { error: 'No tickers supplied' });
    if (!ALLOWED_RANGES.has(range)) return json(400, { error: 'Unsupported range' });
    if (tickers.some(t => t.length > 32)) return json(400, { error: 'Invalid ticker' });
    const settled = await Promise.allSettled(tickers.map(t => fetchTicker(t, range)));
    const assets = [], errors = [];
    settled.forEach((r, i) => r.status === 'fulfilled' ? assets.push(r.value) : errors.push({ ticker: tickers[i], error: r.reason?.message || 'Unknown error' }));
    if (!assets.length) return json(502, { error: 'All Yahoo requests failed', errors });
    return json(200, { source: 'Yahoo Finance', assets, errors });
  } catch (err) {
    return json(500, { error: err?.message || 'Unhandled server error' });
  }
}
