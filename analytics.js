const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const stdev = a => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const covariance = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  const aa = a.slice(-n), bb = b.slice(-n);
  const ma = mean(aa), mb = mean(bb);
  return aa.reduce((s, x, i) => s + (x - ma) * (bb[i] - mb), 0) / (n - 1);
};
const quantile = (arr, q) => {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  const p = (a.length - 1) * q;
  const lo = Math.floor(p), hi = Math.ceil(p);
  if (lo === hi) return a[lo];
  return a[lo] + (p - lo) * (a[hi] - a[lo]);
};
const lastFinite = a => [...a].reverse().find(Number.isFinite) ?? NaN;
const cumulativeNav = (returns, start = 1) => {
  const nav = [start];
  returns.forEach(r => nav.push(nav.at(-1) * (1 + r)));
  return nav;
};
const annualizedReturn = returns => {
  if (!returns.length) return NaN;
  const terminal = returns.reduce((v, r) => v * (1 + r), 1);
  return terminal ** (252 / returns.length) - 1;
};

export function deriveSeries(rows) {
  const clean = rows.filter(r => Number.isFinite(r.adjClose ?? r.close));
  const closes = clean.map(r => r.adjClose ?? r.close);
  const returns = [];
  const logReturns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(closes[i] / closes[i - 1] - 1);
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return { clean, closes, returns, logReturns };
}

export function realizedVol(logReturns, annualization = 252) {
  return stdev(logReturns) * Math.sqrt(annualization);
}

export function rollingVol(logReturns, window = 21, annualization = 252) {
  return logReturns.map((_, i) => i + 1 < window ? null : realizedVol(logReturns.slice(i + 1 - window, i + 1), annualization));
}

export function ewmaVol(logReturns, lambda = 0.94, annualization = 252) {
  if (logReturns.length < 2) return NaN;
  const seedN = Math.min(20, logReturns.length);
  let variance = logReturns.slice(0, seedN).reduce((s, r) => s + r * r, 0) / seedN;
  for (const r of logReturns) variance = lambda * variance + (1 - lambda) * r * r;
  return Math.sqrt(variance * annualization);
}

export function ewmaSeries(logReturns, lambda = 0.94, annualization = 252) {
  if (logReturns.length < 2) return [];
  const seedN = Math.min(20, logReturns.length);
  let variance = logReturns.slice(0, seedN).reduce((s, r) => s + r * r, 0) / seedN;
  return logReturns.map(r => {
    variance = lambda * variance + (1 - lambda) * r * r;
    return Math.sqrt(variance * annualization);
  });
}

export function maxDrawdown(closes) {
  if (!closes.length) return { value: NaN, series: [] };
  let peak = closes[0], mdd = 0;
  const series = closes.map(v => {
    if (v > peak) peak = v;
    const dd = v / peak - 1;
    if (dd < mdd) mdd = dd;
    return dd;
  });
  return { value: mdd, series };
}

export function historicalVarEs(returns, confidence = 0.99) {
  if (returns.length < 30) return { var: NaN, es: NaN };
  const losses = returns.map(r => -r);
  const v = quantile(losses, confidence);
  const tail = losses.filter(x => x >= v);
  return { var: v, es: mean(tail) };
}

export function rsi(closes, period = 14) {
  if (closes.length <= period) return NaN;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    gains += Math.max(d, 0); losses += Math.max(-d, 0);
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function sma(closes, n) { return closes.length < n ? NaN : mean(closes.slice(-n)); }
export function smaSeries(closes, n) { return closes.map((_, i) => i + 1 < n ? null : mean(closes.slice(i + 1 - n, i + 1))); }

export function emaSeries(values, n) {
  if (!values.length) return [];
  const alpha = 2 / (n + 1);
  let e = values[0];
  return values.map((v, i) => i === 0 ? e : (e = alpha * v + (1 - alpha) * e));
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return { line: [], signal: [], hist: [], current: NaN, signalCurrent: NaN, histCurrent: NaN };
  const f = emaSeries(closes, fast), s = emaSeries(closes, slow);
  const line = closes.map((_, i) => f[i] - s[i]);
  const sig = emaSeries(line, signal);
  const hist = line.map((x, i) => x - sig[i]);
  return { line, signal: sig, hist, current: lastFinite(line), signalCurrent: lastFinite(sig), histCurrent: lastFinite(hist) };
}

export function atr(rows, n = 14) {
  if (rows.length <= n) return NaN;
  const trs = [];
  for (let i = 1; i < rows.length; i++) {
    const h = rows[i].high, l = rows[i].low, pc = rows[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let value = mean(trs.slice(0, n));
  for (let i = n; i < trs.length; i++) value = (value * (n - 1) + trs[i]) / n;
  return value;
}

export function percentileRank(history, value) {
  const a = history.filter(Number.isFinite);
  if (!a.length || !Number.isFinite(value)) return NaN;
  return a.filter(x => x <= value).length / a.length;
}

export function summary(rows) {
  const { clean, closes, returns, logReturns } = deriveSeries(rows);
  const last = closes.at(-1), prev = closes.at(-2);
  const vol21 = realizedVol(logReturns.slice(-21)), vol63 = realizedVol(logReturns.slice(-63));
  const ewma94 = ewmaVol(logReturns, 0.94), ewmaSlow = ewmaVol(logReturns, 0.97), ewmaFast = ewmaVol(logReturns, 0.90);
  const ewmaFastSeries = ewmaSeries(logReturns, 0.90), ewmaSlowSeries = ewmaSeries(logReturns, 0.97);
  const ratioSeries = ewmaFastSeries.map((x, i) => x / ewmaSlowSeries[i]);
  const volRatio = ewmaSlow ? ewmaFast / ewmaSlow : NaN;
  const volPercentile = percentileRank(ratioSeries.slice(-252), volRatio);
  const dd = maxDrawdown(closes), risk = historicalVarEs(returns, 0.99);
  const ma21 = sma(closes, 21), ma50 = sma(closes, 50), ma200 = sma(closes, 200);
  const ma21Series = smaSeries(closes, 21), ma50Series = smaSeries(closes, 50), ma200Series = smaSeries(closes, 200);
  const rsi14 = rsi(closes, 14), atr14 = atr(clean, 14), natr14 = Number.isFinite(atr14) && last ? atr14 / last : NaN;
  const mc = macd(closes);
  const structural = Number.isFinite(ma200) ? (last > ma200 && ma50 > ma200 ? 'POSITIVE' : last < ma200 && ma50 < ma200 ? 'NEGATIVE' : 'MIXED') : 'N/A';
  const tactical = Number.isFinite(ma21) ? (last > ma21 && rsi14 >= 50 && mc.histCurrent >= 0 ? 'POSITIVE' : last < ma21 && rsi14 < 50 && mc.histCurrent < 0 ? 'NEGATIVE' : 'MIXED') : 'N/A';
  const volRegime = Number.isFinite(volPercentile) ? (volPercentile >= 0.90 ? 'EXPANSION' : volPercentile <= 0.20 ? 'COMPRESSION' : 'NORMAL') : 'N/A';
  return {
    last, dailyReturn: prev ? last / prev - 1 : NaN, vol21, vol63, ewma: ewma94, ewmaFast, ewmaSlow, volRatio, volPercentile,
    ewmaFastSeries, ewmaSlowSeries, ratioSeries, rolling21: rollingVol(logReturns, 21), rolling63: rollingVol(logReturns, 63),
    mdd: dd.value, drawdownSeries: dd.series, var99: risk.var, es99: risk.es,
    ma21, ma50, ma200, ma21Series, ma50Series, ma200Series, rsi14, atr14, natr14, macd: mc,
    structural, tactical, volRegime, closes, returns, logReturns, dates: clean.map(r => r.date), clean
  };
}

export function alignAssets(assetPayloads) {
  if (!assetPayloads?.length) return { dates: [], prices: [], returns: [] };
  const maps = assetPayloads.map(a => new Map(a.rows.map(r => [r.date, r.adjClose ?? r.close])));
  const commonDates = [...maps[0].keys()].filter(d => maps.every(m => m.has(d))).sort();
  const prices = assetPayloads.map((a, idx) => commonDates.map(d => maps[idx].get(d)));
  const returns = prices.map(p => p.slice(1).map((x, i) => x / p[i] - 1));
  return { dates: commonDates.slice(1), priceDates: commonDates, prices, returns };
}

export function correlationMatrix(returnSeries, window = 126) {
  const rs = returnSeries.map(r => r.slice(-window));
  return rs.map((a, i) => rs.map((b, j) => {
    if (i === j) return 1;
    const den = stdev(a) * stdev(b);
    return den ? covariance(a, b) / den : NaN;
  }));
}

function betaSeries(assetPayloads, weights, benchmarkPayload) {
  if (!benchmarkPayload) return { portfolioBeta: NaN, assetBetas: weights.map(() => NaN) };
  const all = alignAssets([...assetPayloads, benchmarkPayload]);
  const bench = all.returns.at(-1);
  if (!bench?.length) return { portfolioBeta: NaN, assetBetas: weights.map(() => NaN) };
  const vb = covariance(bench, bench);
  const assetBetas = all.returns.slice(0, -1).map(r => vb ? covariance(r, bench) / vb : NaN);
  const port = Array.from({ length: bench.length }, (_, t) => weights.reduce((s, wi, i) => s + wi * all.returns[i][t], 0));
  return { portfolioBeta: vb ? covariance(port, bench) / vb : NaN, assetBetas, aligned: all, portfolioReturns: port, benchmarkReturns: bench };
}

export function portfolioAnalytics(assetPayloads, weights, benchmarkPayload = null) {
  if (!assetPayloads?.length) return null;
  const norm = weights.map(Number), sumW = norm.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sumW) || sumW === 0) return null;
  const w = norm.map(x => x / sumW);
  const aligned = alignAssets(assetPayloads);
  const n = aligned.returns[0]?.length || 0;
  if (n < 30) return null;
  const pRet = Array.from({ length: n }, (_, t) => w.reduce((s, wi, i) => s + wi * aligned.returns[i][t], 0));
  const annVol = stdev(pRet) * Math.sqrt(252);
  const cov = aligned.returns.map(a => aligned.returns.map(b => covariance(a.slice(-126), b.slice(-126))));
  const sigmaW = cov.map(row => row.reduce((s, c, j) => s + c * w[j], 0));
  const portVar = w.reduce((s, wi, i) => s + wi * sigmaW[i], 0);
  const dailySigma = Math.sqrt(Math.max(0, portVar));
  const mrc = dailySigma ? sigmaW.map(x => x / dailySigma) : w.map(() => NaN);
  const crc = mrc.map((x, i) => w[i] * x);
  const rcPct = dailySigma ? crc.map(x => x / dailySigma) : w.map(() => NaN);
  const risk = historicalVarEs(pRet, 0.99);
  const nav = cumulativeNav(pRet);
  const dd = maxDrawdown(nav);
  const shortCorr = correlationMatrix(aligned.returns, 63), longCorr = correlationMatrix(aligned.returns, 252);
  const corrDelta = shortCorr.map((row, i) => row.map((x, j) => x - longCorr[i][j]));
  const betaInfo = betaSeries(assetPayloads, w, benchmarkPayload);
  let benchmarkNav = [], alignedPortfolioNav = [], benchmarkDates = [], trackingError = NaN, informationRatio = NaN, activeAnnReturn = NaN, benchmarkAnnReturn = NaN, portfolioAnnReturn = annualizedReturn(pRet);
  if (betaInfo.aligned) {
    const active = betaInfo.portfolioReturns.map((r, i) => r - betaInfo.benchmarkReturns[i]);
    trackingError = stdev(active) * Math.sqrt(252);
    activeAnnReturn = mean(active) * 252;
    informationRatio = trackingError ? activeAnnReturn / trackingError : NaN;
    benchmarkAnnReturn = annualizedReturn(betaInfo.benchmarkReturns);
    benchmarkNav = cumulativeNav(betaInfo.benchmarkReturns);
    alignedPortfolioNav = cumulativeNav(betaInfo.portfolioReturns);
    benchmarkDates = betaInfo.aligned.dates;
    portfolioAnnReturn = annualizedReturn(betaInfo.portfolioReturns);
  }
  return {
    weights: w, pRet, annVol, var99: risk.var, es99: risk.es, mdd: dd.value, rcPct, mrc, crc, cov,
    shortCorr, longCorr, corrDelta, beta: betaInfo.portfolioBeta, assetBetas: betaInfo.assetBetas,
    nav, navDates: aligned.dates, benchmarkNav, alignedPortfolioNav, benchmarkDates, trackingError, informationRatio,
    activeAnnReturn, portfolioAnnReturn, benchmarkAnnReturn
  };
}

export function liquidityAnalytics(assetPayloads, weights, portfolioValue, participationRate = 0.10, window = 63) {
  if (!assetPayloads?.length || !Number.isFinite(portfolioValue) || portfolioValue <= 0) return [];
  const sumW = weights.reduce((a, b) => a + Number(b), 0);
  const w = weights.map(x => Number(x) / sumW);
  return assetPayloads.map((a, i) => {
    const rows = a.rows.slice(-window).filter(r => Number.isFinite(r.volume) && Number.isFinite(r.adjClose ?? r.close));
    const adtv = rows.length ? mean(rows.map(r => (r.adjClose ?? r.close) * r.volume)) : NaN;
    const avgVol = rows.length ? mean(rows.map(r => r.volume)) : NaN;
    const positionValue = portfolioValue * w[i];
    const daysToLiquidate = Number.isFinite(adtv) && adtv > 0 && participationRate > 0 ? positionValue / (adtv * participationRate) : NaN;
    return { ticker: a.ticker, weight: w[i], avgVolume: avgVol, adtv, positionValue, positionToADTV: adtv ? positionValue / adtv : NaN, daysToLiquidate };
  });
}

export function stressAnalytics(portfolio, marketShock = -0.10, corrTarget = 0.80, corrBlend = 0.50, volMultiplier = 1.25, portfolioValue = 1) {
  if (!portfolio) return null;
  const assetStressReturns = portfolio.assetBetas.map(b => Number.isFinite(b) ? b * marketShock : NaN);
  const contributions = assetStressReturns.map((r, i) => Number.isFinite(r) ? portfolio.weights[i] * r : NaN);
  const portfolioStressReturn = contributions.every(Number.isFinite) ? contributions.reduce((a, b) => a + b, 0) : NaN;
  const n = portfolio.weights.length;
  const currentCorr = portfolio.shortCorr;
  const dailyVols = portfolio.cov.map((row, i) => Math.sqrt(Math.max(0, row[i])) * volMultiplier);
  const stressedCorr = currentCorr.map((row, i) => row.map((rho, j) => i === j ? 1 : (1 - corrBlend) * rho + corrBlend * corrTarget));
  const stressedCov = stressedCorr.map((row, i) => row.map((rho, j) => rho * dailyVols[i] * dailyVols[j]));
  const sigmaW = stressedCov.map(row => row.reduce((s, c, j) => s + c * portfolio.weights[j], 0));
  const stressedDailyVar = portfolio.weights.reduce((s, wi, i) => s + wi * sigmaW[i], 0);
  const stressedDailyVol = Math.sqrt(Math.max(0, stressedDailyVar));
  const stressedAnnVol = stressedDailyVol * Math.sqrt(252);
  const stressedParametricVar99 = 2.326347874 * stressedDailyVol;
  return {
    assetStressReturns, contributions, portfolioStressReturn,
    portfolioStressPnL: Number.isFinite(portfolioStressReturn) ? portfolioValue * portfolioStressReturn : NaN,
    stressedCorr, stressedAnnVol, stressedParametricVar99,
    assumptions: { marketShock, corrTarget, corrBlend, volMultiplier }
  };
}

export function historicalReplay(assetPayloads, weights, startDate, endDate, benchmarkPayload = null) {
  if (!assetPayloads?.length || !startDate || !endDate) return null;
  const sumW = weights.reduce((a, b) => a + Number(b), 0);
  const w = weights.map(x => Number(x) / sumW);
  const calc = payload => {
    const rows = payload.rows.filter(r => r.date >= startDate && r.date <= endDate && Number.isFinite(r.adjClose ?? r.close));
    if (rows.length < 2) return { ret: NaN, from: null, to: null };
    const p0 = rows[0].adjClose ?? rows[0].close, p1 = rows.at(-1).adjClose ?? rows.at(-1).close;
    return { ret: p1 / p0 - 1, from: rows[0].date, to: rows.at(-1).date };
  };
  const assets = assetPayloads.map(calc);
  const portfolioReturn = assets.every(x => Number.isFinite(x.ret)) ? assets.reduce((s, x, i) => s + w[i] * x.ret, 0) : NaN;
  const benchmark = benchmarkPayload ? calc(benchmarkPayload) : { ret: NaN, from: null, to: null };
  return { assets, portfolioReturn, benchmarkReturn: benchmark.ret, benchmarkFrom: benchmark.from, benchmarkTo: benchmark.to };
}
