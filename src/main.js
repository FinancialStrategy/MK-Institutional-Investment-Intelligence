import * as echarts from 'echarts';
import './styles.css';
import { summary, portfolioAnalytics, liquidityAnalytics, stressAnalytics, historicalReplay } from './analytics.js';
import { maCrossBacktest, walkForwardMA } from './backtest.js';
import { UNIVERSE, FIELD_VALUES, PRESETS, filterUniverse } from './universe.js';
import { previewFrontier, alignReturns } from './optimizer-preview.js';
import { factorRegression, portfolioFactorExposure } from './factors.js';
import { readHistory, saveVersion, tickerHistory, diffThesis } from './thesis.js';

const fmtPct = x => Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : 'N/A';
const fmtNum = (x, d = 2) => Number.isFinite(x) ? x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : 'N/A';
const fmtMoney = (x, ccy = '') => Number.isFinite(x) ? `${ccy ? ccy + ' ' : ''}${x.toLocaleString(undefined,{maximumFractionDigits:0})}` : 'N/A';
const fmtPctile = x => Number.isFinite(x) ? `${Math.round(x * 100)}th` : 'N/A';

const tabs = ['EXECUTIVE','UNIVERSE','FACTOR LAB','PORTFOLIO','OPTIMIZATION','MARKET REGIME','VOLATILITY','RISK','STRESS','LIQUIDITY','RESEARCH','BACKTEST','WALK-FORWARD','THESIS','METHODOLOGY'];
let state = {
  ticker: 'AAPL', range: '5y', interval: '1d', payload: null, metrics: null,
  active: 'EXECUTIVE', theme: localStorage.getItem('mk_theme') || 'dark', uiMode: localStorage.getItem('mk_ui_mode') || 'classic', benchmark: '^GSPC',
  portfolioText: 'AAPL:40,MSFT:30,NVDA:30', portfolioValue: 10000000, participationRate: 0.10,
  portfolio: null, portfolioPayloads: [], benchmarkPayload: null, liquidity: [],
  stress: null, replay: null,
  stressInputs: { marketShock: -0.10, corrTarget: 0.80, corrBlend: 0.50, volMultiplier: 1.25 },
  replayDates: { start: '2020-02-19', end: '2020-03-23' },
  backtest: null, walkforward: null,
  backtestInputs: { fast: 21, slow: 200, costBps: 5, slippageBps: 2 },
  walkInputs: { train: 504, test: 126 },
  universeFilters: { region:'ALL', assetClass:'ALL', group:'ALL', factor:'ALL', search:'' },
  selectedUniverse: ['SPY','IWM','VLUE','QUAL','MTUM','USMV','GC=F','HG=F'],
  universePreview: [],
  optimization: null, optimizerExact: null,
  optimizationInputs: { rf: 0.03, method:'max_sharpe', lower:0, upper:0.40, l2:0.10, blViews:'', riskBudgets:'', factorMax:{MKT:'',SMB:'',HML:'',RMW:'',CMA:'',MOM:''} },
  factorData: null, factorResults: [], factorPortfolio: null,
  research: null,
  thesis: JSON.parse(localStorage.getItem('mk_thesis') || 'null') || { core:'', assumptions:'', invalidation:'', catalysts:'' }
};

function presentationDock() {
  return `<div class="presentation-dock" aria-label="Presentation controls">
    <div class="dock-label">INTERFACE</div>
    <div class="dock-segment">
      <button id="uiClassic" class="dock-btn ${state.uiMode==='classic'?'active':''}">CLASSIC v0.9</button>
      <button id="uiLabgen" class="dock-btn ${state.uiMode==='labgen'?'active':''}">MK LABGEN</button>
    </div>
    <div class="dock-label">THEME</div>
    <button id="theme" class="dock-theme">${state.theme === 'dark' ? '☾ DARK' : '☀ LIGHT'}</button>
  </div>`;
}

function classicBrandMarkup() {
  return `<div class="brand brand-classic"><h1>MK INSTITUTIONAL INVESTMENT INTELLIGENCE</h1><p>Institutional Research • Portfolio Risk • Market Analytics • Netlify Edition v0.10.1</p></div>`;
}

function labgenBrandMarkup() {
  return `<div class="lab-brand-lockup">
    <div class="lab-mk-row"><span class="lab-mk">MK</span><span class="lab-flag" aria-label="Turkish flag">🇹🇷</span></div>
    <div class="lab-signature"><span>FinTECH</span> <b>LabGEN</b><small>@2026 Istanbul</small></div>
  </div>`;
}

function statusMarkup() {
  return `<div class="status">
    <div class="box"><div class="label">Data Through</div><div class="value" id="dataThrough">—</div></div>
    <div class="box"><div class="label">Last Refresh</div><div class="value" id="refresh">—</div></div>
    <div class="box"><div class="label">Data Quality</div><div class="value" id="quality">—</div></div>
    <div class="box"><div class="label">Source</div><div class="value" id="source">—</div></div>
  </div>`;
}

function assetControlsMarkup(compact=false) {
  return `<div class="controls ${compact?'controls-compact':''}">
    <label>Ticker<input id="ticker" value="${state.ticker}" placeholder="AAPL / GC=F / THYAO.IS"></label>
    <label>Range<select id="range">${['6mo','1y','2y','5y','10y','max'].map(x => `<option ${x === state.range ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <button id="load">RUN ASSET ANALYSIS</button>
  </div>`;
}

function classicTemplate() {
  return `<div class="shell classic-shell">
    ${presentationDock()}
    <div class="topbar classic-topbar">
      <div class="header">
        ${classicBrandMarkup()}
        ${statusMarkup()}
      </div>
      <div class="tabs classic-tabs">${tabs.map(t => `<button class="tab ${t === state.active ? 'active' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
    </div>
    <main class="content classic-content">
      ${assetControlsMarkup(false)}
      <div id="notice" class="notice">Real-data-only mode. Missing or failed data are shown as unavailable; no synthetic market observations are generated.</div>
      <section id="view"></section>
    </main>
  </div>`;
}

function labgenTemplate() {
  const primary = ['EXECUTIVE','UNIVERSE','OPTIMIZATION','RISK','STRESS','BACKTEST','FACTOR LAB','RESEARCH','THESIS'];
  const secondary = ['PORTFOLIO','MARKET REGIME','VOLATILITY','LIQUIDITY','WALK-FORWARD','METHODOLOGY'];
  return `<div class="lab-app-shell">
    ${presentationDock()}
    <aside class="lab-sidebar">
      ${labgenBrandMarkup()}
      <div class="lab-side-rule"></div>
      <div class="lab-side-title">CORE WORKSPACE</div>
      <nav class="lab-side-nav">
        ${primary.map(t => `<button class="tab lab-nav-item ${t === state.active ? 'active' : ''}" data-tab="${t}"><span class="nav-dot"></span>${t}</button>`).join('')}
      </nav>
      <div class="lab-side-title secondary-title">ANALYTICS</div>
      <nav class="lab-side-nav lab-side-secondary">
        ${secondary.map(t => `<button class="tab lab-nav-item ${t === state.active ? 'active' : ''}" data-tab="${t}"><span class="nav-dot"></span>${t}</button>`).join('')}
      </nav>
      <div class="lab-side-footer">MK FinTECH LabGEN<br><span>Institutional Analytics Platform</span></div>
    </aside>
    <section class="lab-workspace">
      <header class="lab-topbar">
        <div class="lab-project-title"><div><span class="orange">Institutional</span> Investment Intelligence</div><small>Global Markets • Multi-Asset Analytics • Portfolio Construction • Risk & Research</small></div>
        ${statusMarkup()}
      </header>
      <div class="lab-commandbar">
        ${assetControlsMarkup(true)}
        <div class="lab-context"><span>${state.active}</span><b>${state.ticker}</b></div>
      </div>
      <main class="lab-content">
        <div id="notice" class="notice lab-notice">Real-data-only mode • Verified observations only • No synthetic market prices</div>
        <section id="view"></section>
      </main>
    </section>
  </div>`;
}

function appTemplate() {
  return state.uiMode === 'labgen' ? labgenTemplate() : classicTemplate();
}

document.querySelector('#app').innerHTML = appTemplate();
bindChrome();
function applyPresentationState() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.ui = state.uiMode;
}
function rebuildChrome() {
  const snapshot = { dataThrough: document.querySelector('#dataThrough')?.textContent || '—', refresh: document.querySelector('#refresh')?.textContent || '—', quality: document.querySelector('#quality')?.textContent || '—', source: document.querySelector('#source')?.textContent || '—' };
  document.querySelector('#app').innerHTML = appTemplate();
  bindChrome();
  Object.entries(snapshot).forEach(([id,val]) => { const el=document.querySelector('#'+id); if(el) el.textContent=val; });
  renderView();
}
function bindChrome() {
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    state.active = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
    renderView();
  }));
  document.querySelector('#load')?.addEventListener('click', () => {
    state.ticker = document.querySelector('#ticker').value.trim();
    state.range = document.querySelector('#range').value;
    loadData();
  });
  document.querySelector('#theme')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mk_theme', state.theme);
    applyPresentationState();
    rebuildChrome();
  });
  document.querySelector('#uiClassic')?.addEventListener('click', () => {
    state.uiMode='classic'; localStorage.setItem('mk_ui_mode','classic'); applyPresentationState(); rebuildChrome();
  });
  document.querySelector('#uiLabgen')?.addEventListener('click', () => {
    state.uiMode='labgen'; localStorage.setItem('mk_ui_mode','labgen'); applyPresentationState(); rebuildChrome();
  });
}

applyPresentationState();

async function loadData() {
  const notice = document.querySelector('#notice');
  notice.className = 'notice'; notice.textContent = 'Loading verified market data…';
  try {
    const r = await fetch(`/api/yahoo-chart?ticker=${encodeURIComponent(state.ticker)}&range=${state.range}&interval=${state.interval}`);
    const p = await r.json();
    if (!r.ok) throw new Error(p.error || `HTTP ${r.status}`);
    if (!Array.isArray(p.rows) || p.rows.length < 30) throw new Error('Insufficient valid OHLC observations.');
    state.payload = p; state.metrics = summary(p.rows); state.backtest = null; state.walkforward = null;
    document.querySelector('#dataThrough').textContent = p.dataThrough || 'N/A';
    document.querySelector('#refresh').textContent = new Date().toLocaleString();
    document.querySelector('#quality').textContent = 'PASS';
    document.querySelector('#source').textContent = p.source || 'N/A';
    notice.textContent = `${p.ticker} • ${p.exchange || 'Exchange N/A'} • ${p.currency || 'Currency N/A'} • ${p.rows.length} validated OHLC observations.`;
    renderView();
  } catch (e) {
    state.payload = null; state.metrics = null;
    document.querySelector('#quality').textContent = 'FAIL';
    notice.className = 'notice error'; notice.textContent = `DATA UNAVAILABLE — ${e.message}`;
    renderView();
  }
}

function stateClass(v) {
  return ['POSITIVE','COMPRESSION','NORMAL','PASS'].includes(v) ? 'good' : ['NEGATIVE','EXPANSION','FAIL'].includes(v) ? 'bad' : 'warn';
}

function classicExecutive() {
  if (!state.metrics) return '<div class="panel">Run analysis to populate the institutional cockpit.</div>';
  const m = state.metrics;
  return `<div class="grid kpis">
    ${[['PRICE',fmtNum(m.last)],['1D RETURN',fmtPct(m.dailyReturn)],['VOL 21D',fmtPct(m.vol21)],['EWMA VOL',fmtPct(m.ewma)],['VaR 99%',fmtPct(m.var99)],['ES 99%',fmtPct(m.es99)],['MAX DD',fmtPct(m.mdd)],['RSI 14',fmtNum(m.rsi14,1)]].map(([a,b]) => `<div class="kpi"><div class="label">${a}</div><div class="num">${b}</div></div>`).join('')}
  </div>
  <div class="grid two">
    <div class="panel"><h3>PRICE STRUCTURE — 21 / 50 / 200D</h3><div id="priceChart" class="chart"></div></div>
    <div class="panel"><h3>REGIME STATES</h3><div class="state-grid">
      ${[['STRUCTURAL',m.structural],['TACTICAL',m.tactical],['VOL REGIME',m.volRegime],['EWMA FAST/SLOW',fmtNum(m.volRatio,2)],['VOL PERCENTILE',fmtPctile(m.volPercentile)],['DATA QUALITY','PASS']].map(([a,b]) => `<div class="state"><div class="label">${a}</div><div class="sval ${stateClass(b)}">${b}</div></div>`).join('')}
    </div>
    <h3 style="margin-top:18px">RISK MATRIX</h3>
    <table><thead><tr><th>Metric</th><th>Current</th><th>Interpretation</th></tr></thead><tbody>
      <tr><td>Realized Vol 21D</td><td>${fmtPct(m.vol21)}</td><td>${m.vol21 > m.vol63 ? 'Above 63D' : 'At/below 63D'}</td></tr>
      <tr><td>EWMA Fast / Slow</td><td>${fmtNum(m.volRatio,2)}</td><td>${m.volRegime}</td></tr>
      <tr><td>Historical VaR 99%</td><td>${fmtPct(m.var99)}</td><td>1-day loss quantile</td></tr>
      <tr><td>Historical ES 99%</td><td>${fmtPct(m.es99)}</td><td>Mean tail loss</td></tr>
      <tr><td>NATR 14</td><td>${fmtPct(m.natr14)}</td><td>ATR normalized by price</td></tr>
    </tbody></table></div>
  </div>
  <div class="panel" style="margin-top:12px"><h3>UNDERWATER / DRAWDOWN</h3><div id="ddChart" class="chart small"></div></div>`;
}


function labgenExecutive() {
  if (!state.metrics) return `<div class="lab-empty-state"><div class="lab-empty-title">Institutional Executive Cockpit</div><p>Run verified asset analysis to populate the MK LabGEN executive workspace.</p></div>`;
  const m=state.metrics;
  const hero=[
    ['PRICE',fmtNum(m.last),'Verified close'],
    ['1D RETURN',fmtPct(m.dailyReturn),'Latest session'],
    ['VOLATILITY 21D',fmtPct(m.vol21),m.vol21>m.vol63?'Above 63D':'At/below 63D'],
    ['VaR 99%',fmtPct(m.var99),'Historical 1D'],
    ['ES 99%',fmtPct(m.es99),'Tail loss'],
    ['MAX DRAWDOWN',fmtPct(m.mdd),'Full window']
  ];
  return `<div class="lab-exec-head">
      <div><div class="lab-eyebrow">EXECUTIVE MARKET INTELLIGENCE</div><h2>${state.ticker} <span>Institutional Risk & Market Structure</span></h2></div>
      <div class="lab-exec-badges"><span>${m.structural} STRUCTURAL</span><span>${m.volRegime} VOL</span><span>DATA PASS</span></div>
    </div>
    <div class="lab-hero-kpis">${hero.map(([a,b,c])=>`<article class="lab-hero-card"><div class="label">${a}</div><div class="lab-hero-num">${b}</div><div class="lab-hero-sub">${c}</div></article>`).join('')}</div>
    <div class="lab-dashboard-grid">
      <section class="panel lab-chart-panel lab-span-8"><div class="lab-panel-title"><div><span>MARKET STRUCTURE</span><h3>Price • 21D • 50D • 200D</h3></div><div class="lab-mini-tag">${state.range.toUpperCase()}</div></div><div id="priceChart" class="chart lab-main-chart"></div></section>
      <section class="panel lab-span-4"><div class="lab-panel-title"><div><span>REGIME MONITOR</span><h3>Structural / Tactical Evidence</h3></div></div>
        <div class="lab-regime-list">
          ${[['Structural Trend',m.structural],['Tactical Momentum',m.tactical],['Volatility Regime',m.volRegime],['EWMA Fast / Slow',fmtNum(m.volRatio,2)],['Vol Percentile',fmtPctile(m.volPercentile)],['RSI 14',fmtNum(m.rsi14,1)]].map(([a,b])=>`<div><span>${a}</span><b class="${stateClass(b)}">${b}</b></div>`).join('')}
        </div>
      </section>
      <section class="panel lab-span-7"><div class="lab-panel-title"><div><span>DOWNSIDE RISK</span><h3>Underwater / Drawdown Profile</h3></div></div><div id="ddChart" class="chart small"></div></section>
      <section class="panel lab-span-5"><div class="lab-panel-title"><div><span>RISK SNAPSHOT</span><h3>Institutional Risk Matrix</h3></div></div>
        <table class="lab-risk-table"><tbody>
          <tr><td>Realized Vol 21D</td><td>${fmtPct(m.vol21)}</td></tr>
          <tr><td>Realized Vol 63D</td><td>${fmtPct(m.vol63)}</td></tr>
          <tr><td>EWMA Current</td><td>${fmtPct(m.ewma)}</td></tr>
          <tr><td>Historical VaR 99%</td><td>${fmtPct(m.var99)}</td></tr>
          <tr><td>Historical ES 99%</td><td>${fmtPct(m.es99)}</td></tr>
          <tr><td>NATR 14</td><td>${fmtPct(m.natr14)}</td></tr>
        </tbody></table>
        <div class="lab-action-strip"><button class="lab-jump" data-jump="OPTIMIZATION">PORTFOLIO OPTIMIZATION</button><button class="lab-jump" data-jump="FACTOR LAB">FACTOR LAB</button><button class="lab-jump" data-jump="RESEARCH">RESEARCH</button></div>
      </section>
    </div>`;
}

function executive() {
  return state.uiMode === 'labgen' ? labgenExecutive() : classicExecutive();
}

function marketRegime() {
  if (!state.metrics) return '<div class="panel">Run asset analysis first.</div>';
  const m = state.metrics;
  return `<div class="grid two">
    <div class="panel"><h3>MULTI-HORIZON PRICE STRUCTURE</h3><div id="regimePrice" class="chart"></div></div>
    <div class="panel"><h3>STRUCTURAL VS TACTICAL</h3><table><tbody>
      <tr><td>Close</td><td>${fmtNum(m.last)}</td></tr><tr><td>MA 21</td><td>${fmtNum(m.ma21)}</td></tr><tr><td>MA 50</td><td>${fmtNum(m.ma50)}</td></tr><tr><td>MA 200</td><td>${fmtNum(m.ma200)}</td></tr>
      <tr><td>RSI 14</td><td>${fmtNum(m.rsi14,1)}</td></tr><tr><td>MACD</td><td>${fmtNum(m.macd.current,3)}</td></tr><tr><td>MACD Histogram</td><td>${fmtNum(m.macd.histCurrent,3)}</td></tr>
      <tr><td>Structural State</td><td class="${stateClass(m.structural)}">${m.structural}</td></tr><tr><td>Tactical State</td><td class="${stateClass(m.tactical)}">${m.tactical}</td></tr>
    </tbody></table><p class="sub">Structural state is driven by price, MA50 and MA200. Tactical state additionally requires MA21, RSI and MACD histogram confirmation.</p></div>
  </div>
  <div class="panel" style="margin-top:12px"><h3>MACD MOMENTUM</h3><div id="macdChart" class="chart small"></div></div>`;
}

function volatilityView() {
  if (!state.metrics) return '<div class="panel">Run asset analysis first.</div>';
  const m = state.metrics;
  return `<div class="grid kpis four">
    ${[['RV 21D',fmtPct(m.vol21)],['RV 63D',fmtPct(m.vol63)],['EWMA FAST',fmtPct(m.ewmaFast)],['EWMA SLOW',fmtPct(m.ewmaSlow)],['FAST/SLOW',fmtNum(m.volRatio,2)],['PERCENTILE',fmtPctile(m.volPercentile)],['NATR 14',fmtPct(m.natr14)],['REGIME',m.volRegime]].map(([a,b]) => `<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}
  </div>
  <div class="grid two"><div class="panel"><h3>ROLLING REALIZED VOLATILITY</h3><div id="rollingVol" class="chart"></div></div><div class="panel"><h3>EWMA FAST / SLOW</h3><div id="ewmaVol" class="chart"></div></div></div>`;
}

function portfolioView() {
  return `<div class="panel"><h3>PORTFOLIO INPUT</h3>
    <div class="portfolio-controls">
      <label>Tickers & Weights<input id="portfolioText" value="${state.portfolioText}" placeholder="AAPL:40,MSFT:30,NVDA:30"></label>
      <label>Benchmark<input id="benchmark" value="${state.benchmark}" placeholder="^GSPC"></label>
      <label>Portfolio Value<input id="portfolioValue" type="number" value="${state.portfolioValue}"></label>
      <label>Participation %<input id="participation" type="number" step="1" min="1" max="100" value="${state.participationRate*100}"></label>
      <button id="runPortfolio">RUN PORTFOLIO RISK</button>
    </div>
    <p class="sub">Weights are normalized automatically. Portfolio value is used only for liquidity and stress P&L. Market observations come from Yahoo Finance through Netlify Functions.</p></div>
    <div id="portfolioResults" style="margin-top:12px">${portfolioResults()}</div>`;
}

function portfolioResults() {
  const p = state.portfolio;
  if (!p || !state.portfolioPayloads.length) return '<div class="panel"><p class="sub">Enter a real portfolio and run the analysis.</p></div>';
  const names = state.portfolioPayloads.map(x => x.ticker);
  return `<div class="grid kpis four">
    ${[['PORTFOLIO VOL',fmtPct(p.annVol)],['VaR 99%',fmtPct(p.var99)],['ES 99%',fmtPct(p.es99)],['MAX DD',fmtPct(p.mdd)],['BETA',fmtNum(p.beta,2)],['TRACKING ERROR',fmtPct(p.trackingError)],['INFO RATIO',fmtNum(p.informationRatio,2)],['ACTIVE ANN.',fmtPct(p.activeAnnReturn)]].map(([a,b]) => `<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}
  </div>
  <div class="grid two">
    <div class="panel"><h3>PORTFOLIO NAV vs BENCHMARK</h3><div id="portfolioNav" class="chart"></div></div>
    <div class="panel"><h3>CAPITAL WEIGHT vs RISK CONTRIBUTION</h3><div id="riskContribution" class="chart"></div></div>
  </div>
  <div class="grid two">
    <div class="panel"><h3>SHORT CORRELATION — 63D</h3><div id="corrShort" class="chart"></div></div>
    <div class="panel"><h3>CORRELATION CHANGE — 63D minus 252D</h3><div id="corrDelta" class="chart"></div></div>
  </div>
  <div class="panel" style="margin-top:12px"><h3>PORTFOLIO EXPOSURE TABLE</h3><table><thead><tr><th>Asset</th><th>Weight</th><th>Risk Contribution</th><th>Beta</th><th>Data Through</th></tr></thead><tbody>${names.map((n,i)=>`<tr><td>${n}</td><td>${fmtPct(p.weights[i])}</td><td>${fmtPct(p.rcPct[i])}</td><td>${fmtNum(p.assetBetas[i],2)}</td><td>${state.portfolioPayloads[i].dataThrough}</td></tr>`).join('')}</tbody></table></div>`;
}

async function runPortfolio() {
  const txt = document.querySelector('#portfolioText').value.trim();
  const benchmark = document.querySelector('#benchmark').value.trim();
  const portfolioValue = Number(document.querySelector('#portfolioValue').value);
  const participation = Number(document.querySelector('#participation').value) / 100;
  const entries = txt.split(',').map(x => x.trim()).filter(Boolean).map(x => {
    const [ticker, rawWeight] = x.split(':');
    return { ticker: ticker?.trim(), weight: Number(rawWeight) };
  }).filter(x => x.ticker && Number.isFinite(x.weight));
  if (!entries.length) return alert('Use format TICKER:WEIGHT, e.g. AAPL:40,MSFT:30');
  state.portfolioText = txt; state.benchmark = benchmark || '^GSPC';
  state.portfolioValue = Number.isFinite(portfolioValue) && portfolioValue > 0 ? portfolioValue : 10000000;
  state.participationRate = Number.isFinite(participation) && participation > 0 ? Math.min(participation,1) : 0.10;
  const tickers = [...entries.map(x => x.ticker), state.benchmark];
  const r = await fetch(`/api/yahoo-bulk?tickers=${encodeURIComponent(tickers.join(','))}&range=10y`);
  const payload = await r.json();
  if (!r.ok) return alert(payload.error || 'Portfolio data request failed');
  const map = new Map(payload.assets.map(a => [a.ticker, a]));
  const missing = entries.filter(x => !map.has(x.ticker));
  if (missing.length) return alert(`Missing validated data: ${missing.map(x => x.ticker).join(', ')}`);
  state.portfolioPayloads = entries.map(x => map.get(x.ticker));
  state.benchmarkPayload = map.get(state.benchmark) || null;
  state.portfolio = portfolioAnalytics(state.portfolioPayloads, entries.map(x => x.weight), state.benchmarkPayload);
  state.liquidity = liquidityAnalytics(state.portfolioPayloads, entries.map(x => x.weight), state.portfolioValue, state.participationRate, 63);
  state.stress = stressAnalytics(state.portfolio, state.stressInputs.marketShock, state.stressInputs.corrTarget, state.stressInputs.corrBlend, state.stressInputs.volMultiplier, state.portfolioValue);
  state.replay = historicalReplay(state.portfolioPayloads, entries.map(x => x.weight), state.replayDates.start, state.replayDates.end, state.benchmarkPayload);
  renderView();
}

function riskView() {
  const m = state.metrics;
  const asset = m ? `<div class="panel"><h3>ASSET RISK MATRIX</h3><table><thead><tr><th>Metric</th><th>Current</th><th>Method</th><th>Status</th></tr></thead><tbody>
  <tr><td>Realized Vol 21D</td><td>${fmtPct(m.vol21)}</td><td>Std(log returns) × √252</td><td>PASS</td></tr>
  <tr><td>Realized Vol 63D</td><td>${fmtPct(m.vol63)}</td><td>Std(log returns) × √252</td><td>PASS</td></tr>
  <tr><td>Historical VaR 99%</td><td>${fmtPct(m.var99)}</td><td>99th percentile of daily loss</td><td>${Number.isFinite(m.var99)?'PASS':'N/A'}</td></tr>
  <tr><td>Historical ES 99%</td><td>${fmtPct(m.es99)}</td><td>Mean loss beyond VaR</td><td>${Number.isFinite(m.es99)?'PASS':'N/A'}</td></tr>
  <tr><td>Maximum Drawdown</td><td>${fmtPct(m.mdd)}</td><td>Peak-to-trough</td><td>PASS</td></tr>
  <tr><td>NATR 14</td><td>${fmtPct(m.natr14)}</td><td>ATR14 / Close</td><td>PASS</td></tr>
  </tbody></table></div>` : '<div class="panel">Run asset analysis first.</div>';
  const p = state.portfolio ? `<div class="panel" style="margin-top:12px"><h3>PORTFOLIO RISK SUMMARY</h3><table><tbody>
  <tr><td>Annualized Volatility</td><td>${fmtPct(state.portfolio.annVol)}</td></tr><tr><td>Historical VaR 99%</td><td>${fmtPct(state.portfolio.var99)}</td></tr><tr><td>Historical ES 99%</td><td>${fmtPct(state.portfolio.es99)}</td></tr><tr><td>Maximum Drawdown</td><td>${fmtPct(state.portfolio.mdd)}</td></tr><tr><td>Beta</td><td>${fmtNum(state.portfolio.beta,2)}</td></tr><tr><td>Tracking Error</td><td>${fmtPct(state.portfolio.trackingError)}</td></tr><tr><td>Information Ratio</td><td>${fmtNum(state.portfolio.informationRatio,2)}</td></tr>
  </tbody></table></div>` : '';
  return asset + p;
}

function stressView() {
  if (!state.portfolio) return '<div class="panel"><h3>STRESS LAB</h3><p class="sub">Run Portfolio first. Stress calculations require validated multi-asset data and benchmark betas.</p></div>';
  const s = state.stress;
  return `<div class="panel"><h3>HYPOTHETICAL STRESS CONTROLS</h3><div class="portfolio-controls">
    <label>Benchmark Shock %<input id="marketShock" type="number" step="1" value="${state.stressInputs.marketShock*100}"></label>
    <label>Stress Corr Target<input id="corrTarget" type="number" step="0.05" min="-1" max="1" value="${state.stressInputs.corrTarget}"></label>
    <label>Corr Blend<input id="corrBlend" type="number" step="0.05" min="0" max="1" value="${state.stressInputs.corrBlend}"></label>
    <label>Vol Multiplier<input id="volMultiplier" type="number" step="0.05" min="0.5" max="5" value="${state.stressInputs.volMultiplier}"></label>
    <button id="runStress">APPLY STRESS</button></div>
    <p class="sub">P&L shock uses each asset's estimated benchmark beta. Correlation/volatility inputs stress portfolio risk, not deterministic P&L. No unobserved factor sensitivities are invented.</p></div>
    <div class="grid kpis four" style="margin-top:12px">
      ${[['PORTFOLIO SHOCK',fmtPct(s?.portfolioStressReturn)],['STRESS P&L',fmtMoney(s?.portfolioStressPnL)],['STRESSED VOL',fmtPct(s?.stressedAnnVol)],['STRESSED PARAM VaR99',fmtPct(s?.stressedParametricVar99)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}
    </div>
    <div class="grid two"><div class="panel"><h3>STRESS P&L CONTRIBUTION</h3><div id="stressWaterfall" class="chart"></div></div><div class="panel"><h3>STRESSED CORRELATION</h3><div id="stressCorr" class="chart"></div></div></div>
    <div class="panel" style="margin-top:12px"><h3>HISTORICAL REPLAY</h3><div class="portfolio-controls"><label>Start<input id="replayStart" type="date" value="${state.replayDates.start}"></label><label>End<input id="replayEnd" type="date" value="${state.replayDates.end}"></label><button id="runReplay">RUN REALIZED REPLAY</button></div>${replayTable()}</div>`;
}

function replayTable() {
  const r = state.replay;
  if (!r) return '<p class="sub">No replay calculated.</p>';
  const names = state.portfolioPayloads.map(x=>x.ticker);
  return `<table><thead><tr><th>Asset</th><th>Realized Return</th><th>Period</th></tr></thead><tbody>${r.assets.map((x,i)=>`<tr><td>${names[i]}</td><td>${fmtPct(x.ret)}</td><td>${x.from || 'N/A'} → ${x.to || 'N/A'}</td></tr>`).join('')}<tr><td><strong>Portfolio</strong></td><td><strong>${fmtPct(r.portfolioReturn)}</strong></td><td>${state.replayDates.start} → ${state.replayDates.end}</td></tr><tr><td><strong>${state.benchmark}</strong></td><td><strong>${fmtPct(r.benchmarkReturn)}</strong></td><td>${r.benchmarkFrom || 'N/A'} → ${r.benchmarkTo || 'N/A'}</td></tr></tbody></table>`;
}

function liquidityView() {
  if (!state.portfolio || !state.liquidity.length) return '<div class="panel"><h3>LIQUIDITY</h3><p class="sub">Run Portfolio first. Liquidity uses actual Yahoo volume and price observations.</p></div>';
  const maxDays = Math.max(...state.liquidity.map(x=>Number.isFinite(x.daysToLiquidate)?x.daysToLiquidate:0));
  return `<div class="grid kpis four">
    ${[['PORTFOLIO VALUE',fmtMoney(state.portfolioValue)],['PARTICIPATION',fmtPct(state.participationRate)],['WINDOW','63D'],['MAX EXIT DAYS',fmtNum(maxDays,2)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}
  </div>
  <div class="grid two"><div class="panel"><h3>DAYS TO LIQUIDATE</h3><div id="liquidityChart" class="chart"></div></div><div class="panel"><h3>LIQUIDITY TABLE</h3><table><thead><tr><th>Asset</th><th>Position</th><th>ADTV 63D</th><th>Position / ADTV</th><th>Exit Days</th></tr></thead><tbody>${state.liquidity.map(x=>`<tr><td>${x.ticker}</td><td>${fmtMoney(x.positionValue)}</td><td>${fmtMoney(x.adtv)}</td><td>${fmtNum(x.positionToADTV,2)}x</td><td>${fmtNum(x.daysToLiquidate,2)}</td></tr>`).join('')}</tbody></table></div></div>`;
}


function backtestView() {
  if (!state.payload?.rows?.length) return '<div class="panel"><h3>BACKTEST LAB</h3><p class="sub">Run asset analysis first.</p></div>';
  const b = state.backtest;
  return `<div class="panel"><h3>MA CROSSOVER BACKTEST — STRICT t-1 SIGNAL</h3><div class="portfolio-controls">
    <label>Fast MA<input id="btFast" type="number" min="2" value="${state.backtestInputs.fast}"></label>
    <label>Slow MA<input id="btSlow" type="number" min="3" value="${state.backtestInputs.slow}"></label>
    <label>Cost bps<input id="btCost" type="number" min="0" step="1" value="${state.backtestInputs.costBps}"></label>
    <label>Slippage bps<input id="btSlip" type="number" min="0" step="1" value="${state.backtestInputs.slippageBps}"></label>
    <button id="runBacktest">RUN BACKTEST</button></div>
    <p class="sub">Position applied to return t-1→t is formed only from prices available through t-1. Trading costs and slippage are charged on position turnover.</p></div>
    ${b ? `<div class="grid kpis four" style="margin-top:12px">${[['CAGR',fmtPct(b.metrics.cagr)],['VOL',fmtPct(b.metrics.annVol)],['SHARPE',fmtNum(b.metrics.sharpe,2)],['SORTINO',fmtNum(b.metrics.sortino,2)],['MAX DD',fmtPct(b.metrics.mdd)],['CALMAR',fmtNum(b.metrics.calmar,2)],['EXPOSURE',fmtPct(b.metrics.exposure)],['TURNOVER',fmtNum(b.metrics.turnover,0)]].map(([a,v])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${v}</div></div>`).join('')}</div>
    <div class="grid two"><div class="panel"><h3>STRATEGY NAV vs BUY & HOLD</h3><div id="btNav" class="chart"></div></div><div class="panel"><h3>BACKTEST DIAGNOSTICS</h3><table><tbody>
    <tr><td>Hit Rate</td><td>${fmtPct(b.metrics.hitRate)}</td></tr><tr><td>Profit Factor</td><td>${fmtNum(b.metrics.profitFactor,2)}</td></tr><tr><td>Entries</td><td>${b.metrics.entries}</td></tr><tr><td>Exits</td><td>${b.metrics.exits}</td></tr><tr><td>Terminal Strategy NAV</td><td>${fmtNum(b.metrics.terminal,3)}</td></tr><tr><td>Terminal Buy & Hold NAV</td><td>${fmtNum(b.metrics.benchmarkTerminal,3)}</td></tr>
    </tbody></table></div></div>` : '<div class="panel" style="margin-top:12px"><p class="sub">Set parameters and run the backtest.</p></div>'}`;
}

function walkForwardView() {
  if (!state.payload?.rows?.length) return '<div class="panel"><h3>WALK-FORWARD</h3><p class="sub">Run asset analysis first.</p></div>';
  const w=state.walkforward;
  return `<div class="panel"><h3>WALK-FORWARD / OUT-OF-SAMPLE VALIDATION</h3><div class="portfolio-controls">
    <label>Train Days<input id="wfTrain" type="number" min="252" step="21" value="${state.walkInputs.train}"></label>
    <label>Test Days<input id="wfTest" type="number" min="63" step="21" value="${state.walkInputs.test}"></label>
    <button id="runWalk">RUN WALK-FORWARD</button></div>
    <p class="sub">Each fold optimizes fast/slow MA parameters only on the training window, then applies the selected parameters to the next untouched test window. Parameter grid: fast 10/20/30/40/50; slow 100/150/200.</p></div>
    ${w ? `<div class="grid kpis four" style="margin-top:12px">${[['OOS CAGR',fmtPct(w.metrics.cagr)],['OOS VOL',fmtPct(w.metrics.annVol)],['OOS SHARPE',fmtNum(w.metrics.sharpe,2)],['OOS SORTINO',fmtNum(w.metrics.sortino,2)],['OOS MAX DD',fmtPct(w.metrics.mdd)],['OOS CALMAR',fmtNum(w.metrics.calmar,2)],['FOLDS',w.folds.length],['TERMINAL NAV',fmtNum(w.metrics.terminal,3)]].map(([a,v])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${v}</div></div>`).join('')}</div>
    <div class="grid two"><div class="panel"><h3>OUT-OF-SAMPLE NAV</h3><div id="wfNav" class="chart"></div></div><div class="panel"><h3>FOLD RESULTS</h3><div class="table-scroll"><table><thead><tr><th>Train</th><th>Test</th><th>Fast</th><th>Slow</th><th>Train Sharpe</th><th>Test Sharpe</th><th>Test Return</th></tr></thead><tbody>${w.folds.map(f=>`<tr><td>${f.trainFrom}→${f.trainTo}</td><td>${f.testFrom}→${f.testTo}</td><td>${f.fast}</td><td>${f.slow}</td><td>${fmtNum(f.trainSharpe,2)}</td><td>${fmtNum(f.testSharpe,2)}</td><td>${fmtPct(f.testReturn)}</td></tr>`).join('')}</tbody></table></div></div></div>` : '<div class="panel" style="margin-top:12px"><p class="sub">Run walk-forward to generate OOS folds.</p></div>'}`;
}

function runBacktest() {
  state.backtestInputs.fast=Number(document.querySelector('#btFast').value);
  state.backtestInputs.slow=Number(document.querySelector('#btSlow').value);
  state.backtestInputs.costBps=Number(document.querySelector('#btCost').value);
  state.backtestInputs.slippageBps=Number(document.querySelector('#btSlip').value);
  if(state.backtestInputs.fast>=state.backtestInputs.slow) return alert('Fast MA must be below Slow MA.');
  state.backtest=maCrossBacktest(state.payload.rows,state.backtestInputs.fast,state.backtestInputs.slow,state.backtestInputs.costBps,state.backtestInputs.slippageBps);
  renderView();
}

function runWalkForward() {
  state.walkInputs.train=Number(document.querySelector('#wfTrain').value);
  state.walkInputs.test=Number(document.querySelector('#wfTest').value);
  state.walkforward=walkForwardMA(state.payload.rows,{train:state.walkInputs.train,test:state.walkInputs.test,costBps:state.backtestInputs.costBps,slippageBps:state.backtestInputs.slippageBps});
  renderView();
}

function methodology() {
  return `<div class="panel"><h3>METHODOLOGY — v0.9</h3>
  <table><thead><tr><th>Module</th><th>Formula / Method</th><th>Validation</th></tr></thead><tbody>
  <tr><td>Returns</td><td>rₜ = ln(Pₜ/Pₜ₋₁)</td><td>Finite positive prices</td></tr>
  <tr><td>Realized Vol</td><td>σ = sd(r) × √252</td><td>Rolling 21D / 63D</td></tr>
  <tr><td>EWMA Fast / Slow</td><td>σ²ₜ = λσ²ₜ₋₁ + (1−λ)r²ₜ; λ=.90/.97</td><td>Filtered current-state</td></tr>
  <tr><td>Vol Regime</td><td>Fast/Slow ratio percentile over trailing history</td><td>Expansion ≥90th; Compression ≤20th percentile</td></tr>
  <tr><td>Drawdown</td><td>DDₜ = Pₜ / max(P₀…Pₜ) − 1</td><td>Full validated series</td></tr>
  <tr><td>Historical VaR / ES</td><td>Q₉₉(loss); E[loss | loss ≥ VaR]</td><td>≥30 returns</td></tr>
  <tr><td>Portfolio Vol</td><td>√(wᵀΣw) × √252</td><td>Common dates only</td></tr>
  <tr><td>Risk Contribution</td><td>MRCᵢ=(Σw)ᵢ/σₚ; RCᵢ=wᵢMRCᵢ</td><td>126D covariance</td></tr>
  <tr><td>Portfolio Beta</td><td>Cov(Rₚ,Rᵦ)/Var(Rᵦ)</td><td>User-selected benchmark</td></tr>
  <tr><td>Tracking Error</td><td>sd(Rₚ−Rᵦ) × √252</td><td>Common benchmark dates</td></tr>
  <tr><td>Information Ratio</td><td>Annualized mean active return / Tracking Error</td><td>Common benchmark dates</td></tr>
  <tr><td>Liquidity</td><td>ADTV=mean(Price×Volume); ExitDays=Position/(ADTV×Participation)</td><td>63D real price/volume</td></tr>
  <tr><td>Beta Shock P&L</td><td>Shockᵢ=βᵢ×BenchmarkShock; PortfolioShock=ΣwᵢShockᵢ</td><td>Requires estimated beta</td></tr>
  <tr><td>Correlation Stress</td><td>ρ*=(1−α)ρ+α·ρtarget; σ*=volMultiplier×σ</td><td>Risk stress only; no fake P&L factor</td></tr>
  <tr><td>Stress Parametric VaR</td><td>2.3263 × stressed daily σ</td><td>Normal approximation disclosed</td></tr>
  <tr><td>Historical Replay</td><td>Actual cumulative asset returns between chosen observed dates</td><td>No synthetic fill; requires data coverage</td></tr>
  <tr><td>Backtest</td><td>MA crossover; signal from data through t-1 applied to return t-1→t</td><td>Costs + slippage on turnover; no look-ahead</td></tr>
  <tr><td>Walk-Forward</td><td>Train optimization → untouched test window; rolling folds</td><td>OOS metrics reported separately</td></tr>
  <tr><td>Fama–French + MOM</td><td>(Rᵢ−Rf)=α+βMKT(MKT−Rf)+βSMB·SMB+βHML·HML+βRMW·RMW+βCMA·CMA+βMOM·MOM+ε</td><td>Kenneth French daily factors; ≥126 common observations</td></tr>
  <tr><td>Factor Constraints</td><td>lowerₖ ≤ Σwᵢβᵢ,ₖ ≤ upperₖ</td><td>Applied only when regression loadings are available</td></tr>
  <tr><td>Fundamentals</td><td>Revenue, margins, FCF, ROE, ROIC, leverage derived from reported statements</td><td>EODHD connector; no synthetic fill</td></tr>
  <tr><td>Thesis Change Log</td><td>Versioned thesis text + research snapshot</td><td>Browser local persistence; timestamped</td></tr>
  </tbody></table></div>`;
}


function optionList(values,current){return `<option value="ALL" ${current==='ALL'?'selected':''}>ALL</option>`+values.map(x=>`<option ${x===current?'selected':''}>${x}</option>`).join('');}

function universeView(){
  const f=state.universeFilters, rows=filterUniverse(f); state.universePreview=rows;
  return `<div class="panel"><h3>INVESTMENT UNIVERSE BUILDER</h3>
    <p class="sub">Build a cross-region, cross-asset investable set. Region → asset class → commodity/mining group → factor taxonomy can be combined. Factor labels are universe classification tags; measured factor loadings are a separate regression layer.</p>
    <div class="portfolio-controls universe-controls">
      <label>Region<select id="uRegion">${optionList(FIELD_VALUES.region,f.region)}</select></label>
      <label>Asset Class<select id="uAsset">${optionList(FIELD_VALUES.assetClass,f.assetClass)}</select></label>
      <label>Group<select id="uGroup">${optionList(FIELD_VALUES.group,f.group)}</select></label>
      <label>Factor / Theme<select id="uFactor">${optionList(FIELD_VALUES.factor,f.factor)}</select></label>
      <label>Search<input id="uSearch" value="${f.search}" placeholder="gold / value / Türkiye / mining"></label>
      <button id="applyUniverse">APPLY FILTERS</button>
    </div>
    <div class="preset-row">${Object.keys(PRESETS).map(k=>`<button class="preset-btn" data-preset="${k}">${k}</button>`).join('')}</div>
  </div>
  <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>UNIVERSE RESULTS</h3><span class="sub">${rows.length} instruments • ${state.selectedUniverse.length} selected</span></div>
    <div class="universe-actions"><button id="selectVisible">SELECT VISIBLE</button><button id="clearSelected" class="secondary">CLEAR SELECTION</button><button id="sendPortfolio" class="secondary">SEND TO PORTFOLIO</button><button id="sendOptimizer">SEND TO OPTIMIZER</button></div>
    <table><thead><tr><th></th><th>Ticker</th><th>Name</th><th>Region</th><th>Asset Class</th><th>Group</th><th>Factors</th></tr></thead><tbody>
    ${rows.map(x=>`<tr><td><input class="ucheck" type="checkbox" value="${x.ticker}" ${state.selectedUniverse.includes(x.ticker)?'checked':''}></td><td>${x.ticker}</td><td>${x.name}</td><td>${x.region}</td><td>${x.assetClass}</td><td>${x.group}</td><td>${x.factors.join(', ')}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function syncUniverseChecks(){
  state.selectedUniverse=[...document.querySelectorAll('.ucheck:checked')].map(x=>x.value);
}
function bindUniverse(){
  document.querySelector('#applyUniverse')?.addEventListener('click',()=>{state.universeFilters={region:document.querySelector('#uRegion').value,assetClass:document.querySelector('#uAsset').value,group:document.querySelector('#uGroup').value,factor:document.querySelector('#uFactor').value,search:document.querySelector('#uSearch').value};renderView();});
  document.querySelectorAll('.preset-btn').forEach(b=>b.addEventListener('click',()=>{state.selectedUniverse=(PRESETS[b.dataset.preset]||[]).filter(t=>UNIVERSE.some(x=>x.ticker===t));state.universeFilters={region:'ALL',assetClass:'ALL',group:'ALL',factor:'ALL',search:''};renderView();}));
  document.querySelector('#selectVisible')?.addEventListener('click',()=>{state.selectedUniverse=[...new Set([...state.selectedUniverse,...state.universePreview.map(x=>x.ticker)])];renderView();});
  document.querySelector('#clearSelected')?.addEventListener('click',()=>{state.selectedUniverse=[];renderView();});
  document.querySelectorAll('.ucheck').forEach(c=>c.addEventListener('change',syncUniverseChecks));
  document.querySelector('#sendPortfolio')?.addEventListener('click',()=>{syncUniverseChecks();if(!state.selectedUniverse.length)return alert('Select at least one instrument.');const w=100/state.selectedUniverse.length;state.portfolioText=state.selectedUniverse.map(t=>`${t}:${w.toFixed(4)}`).join(',');state.active='PORTFOLIO';document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===state.active));renderView();});
  document.querySelector('#sendOptimizer')?.addEventListener('click',()=>{syncUniverseChecks();if(state.selectedUniverse.length<2)return alert('Select at least two instruments.');state.active='OPTIMIZATION';document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===state.active));renderView();});
}

function optimizationView(){
  const o=state.optimization, ex=state.optimizerExact, fm=state.optimizationInputs.factorMax||{};
  return `<div class="panel"><h3>PORTFOLIO OPTIMIZATION LAB</h3>
    <p class="sub">Selected universe: ${state.selectedUniverse.join(', ')||'none'}. Preview uses real Yahoo price history. Exact constrained optimization is routed to the optional Python PyPortfolioOpt service. Factor-neutral bounds require Factor Lab loadings.</p>
    <div class="portfolio-controls">
      <label>Risk-Free %<input id="optRf" type="number" step="0.1" value="${state.optimizationInputs.rf*100}"></label>
      <label>Method<select id="optMethod">${[['max_sharpe','Max Sharpe'],['min_volatility','Minimum Volatility'],['max_quadratic_utility','Quadratic Utility'],['black_litterman','Black–Litterman'],['risk_parity','Risk Parity / ERC'],['hrp','Hierarchical Risk Parity'],['cla_min_volatility','CLA Minimum Volatility'],['cla_max_sharpe','CLA Max Sharpe'],['min_semivariance','Minimum Semivariance'],['min_cvar','Minimum CVaR'],['min_cdar','Minimum CDaR']].map(([v,n])=>`<option value="${v}" ${v===state.optimizationInputs.method?'selected':''}>${n}</option>`).join('')}</select></label>
      <label>Lower Bound<input id="optLower" type="number" step="0.01" value="${state.optimizationInputs.lower}"></label>
      <label>Upper Bound<input id="optUpper" type="number" step="0.05" value="${state.optimizationInputs.upper}"></label>
      <label>L2 Gamma<input id="optL2" type="number" step="0.05" value="${state.optimizationInputs.l2}"></label>
      <button id="runOptPreview">RUN REAL-DATA FRONTIER</button><button id="runPyOpt" class="exact-opt-btn">RUN PYPORTFOLIOOPT EXACT</button><span id="quantServiceStatus" class="quant-service-status">CHECKING QUANT ENGINE...</span>
    </div>
    <div class="portfolio-controls advanced-opt">
      <label>Black–Litterman Absolute Views<input id="blViews" value="${state.optimizationInputs.blViews||''}" placeholder="SPY:0.08,GLD:0.06"></label>
      <label>Risk Budgets<input id="riskBudgets" value="${state.optimizationInputs.riskBudgets||''}" placeholder="SPY:1,GLD:1,TLT:1"></label>
    </div>
    <p class="sub">Black–Litterman views are annual expected-return views in decimal form (e.g. 0.08 = 8%). The current implementation uses historical mean returns as the prior and reports that choice explicitly. Risk Parity uses equal risk budgets when the field is blank; custom positive budgets are normalized automatically.</p>
    <h4>FACTOR EXPOSURE CONSTRAINTS — MAX ABSOLUTE BETA</h4>
    <div class="portfolio-controls factor-constraints">${['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>`<label>${k}<input id="fc${k}" type="number" min="0" step="0.05" value="${fm[k]??''}" placeholder="unconstrained"></label>`).join('')}</div>
    <p class="sub">Example: HML = 0.10 constrains portfolio HML loading to −0.10 ≤ βHML ≤ +0.10. Leave blank for no factor constraint. HRP/CLA do not accept these linear constraints in this service.</p>
  </div>
    ${o?`<div class="grid kpis four" style="margin-top:12px">${[['OBS',o.observations],['MIN VOL',fmtPct(o.minVol.vol)],['MIN VOL RETURN',fmtPct(o.minVol.ret)],['MAX SHARPE',fmtNum(o.maxSharpe.sharpe,2)],['MS RETURN',fmtPct(o.maxSharpe.ret)],['MS VOL',fmtPct(o.maxSharpe.vol)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div>
    <div class="grid optimization-grid"><div class="panel frontier-panel"><div class="frontier-head"><div><h3>${ex?.frontier?.length?'PYPORTFOLIOOPT EFFICIENT FRONTIER':'EFFICIENT FRONTIER — PREVIEW'}</h3><p class="sub">${ex?.frontier?.length?'Exact constrained frontier is primary; preview is retained as a diagnostic reference.':'Run PyPortfolioOpt to overlay the exact constrained frontier.'}</p></div><span class="engine-badge ${ex?.frontier?.length?'live':'preview'}">${ex?.frontier?.length?'EXACT LIVE':'PREVIEW'}</span></div><div id="frontierChart" class="chart frontier-chart"></div></div><div class="panel solution-panel"><h3>${ex?'PORTFOLIO SOLUTIONS':'PREVIEW PORTFOLIOS'}</h3>${ex?.benchmarks?.min_volatility?weightsTable('Minimum Volatility',state.selectedUniverse.map(t=>ex.benchmarks.min_volatility.weights?.[t]||0),0.001):weightsTable('Minimum Volatility',o.minVol.w,0.001)}${ex?.benchmarks?.max_sharpe?weightsTable('Maximum Sharpe / Tangency',state.selectedUniverse.map(t=>ex.benchmarks.max_sharpe.weights?.[t]||0),0.001):weightsTable('Maximum Sharpe',o.maxSharpe.w,0.001)}${ex?.benchmarks?.risk_parity?weightsTable('Risk Parity',state.selectedUniverse.map(t=>ex.benchmarks.risk_parity.weights?.[t]||0),0.001):''}${ex?.benchmarks?.black_litterman?weightsTable('Black–Litterman',state.selectedUniverse.map(t=>ex.benchmarks.black_litterman.weights?.[t]||0),0.001):''}${ex?weightsTable(`Selected — ${String(ex.method||'Optimizer').replaceAll('_',' ')}`,state.selectedUniverse.map(t=>ex.weights?.[t]||0),0.001):''}</div></div>`:''}
    ${ex?`<div class="grid two" style="margin-top:12px"><div class="panel"><h3>PYPORTFOLIOOPT — ${ex.method}</h3><p class="sub">Engine: ${ex.engine} • ${ex.observations} complete observations • ${ex.data_start} → ${ex.data_end}</p>${ex.factor_exposure?`<h4>OPTIMIZED FACTOR EXPOSURE</h4><table><tbody>${Object.entries(ex.factor_exposure).map(([k,v])=>`<tr><td>${k}</td><td>${fmtNum(v,3)}</td></tr>`).join('')}</tbody></table>`:''}<pre class="jsonbox">${JSON.stringify(ex.performance,null,2)}</pre></div><div class="panel"><h3>CONSTRAINT DIAGNOSTICS</h3>${constraintDiagnosticsTable(ex.constraint_diagnostics)}<p class="sub">Binding constraints explain why optimized weights may sit exactly on configured caps/floors.</p></div></div>`:''}`;
}
function weightsTable(title,w,minDisplay=0){if(!w)return '';const rows=state.selectedUniverse.map((t,i)=>({t,w:Number(w[i]||0)})).filter(x=>Math.abs(x.w)>=minDisplay);return `<h4>${title}</h4><table><thead><tr><th>Asset</th><th>Weight</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.t}</td><td>${fmtPct(x.w)}</td></tr>`).join('')||'<tr><td colspan="2">All weights below display threshold.</td></tr>'}</tbody></table>`;}
function constraintDiagnosticsTable(d){if(!d)return '<p class="sub">No diagnostics returned.</p>';const rows=[['Solver status',d.solver_status||'optimal'],['Lower bound',Number.isFinite(d.lower_bound)?fmtPct(d.lower_bound):'N/A'],['Upper bound',Number.isFinite(d.upper_bound)?fmtPct(d.upper_bound):'N/A'],['Binding lower',Array.isArray(d.binding_lower)&&d.binding_lower.length?d.binding_lower.join(', '):'None'],['Binding upper',Array.isArray(d.binding_upper)&&d.binding_upper.length?d.binding_upper.join(', '):'None']];return `<table><tbody>${rows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>${Array.isArray(d.factor_constraints)&&d.factor_constraints.length?`<h4>FACTOR BOUNDS</h4><table><thead><tr><th>Factor</th><th>Exposure</th><th>Range</th><th>Binding</th></tr></thead><tbody>${d.factor_constraints.map(x=>`<tr><td>${x.factor}</td><td>${fmtNum(x.exposure,3)}</td><td>${fmtNum(x.lower,3)} to ${fmtNum(x.upper,3)}</td><td>${x.binding?'YES':'NO'}</td></tr>`).join('')}</tbody></table>`:''}`;}
async function fetchUniversePayloads(){
  const tickers=state.selectedUniverse.slice(0,36);if(tickers.length<2)throw new Error('Select at least two assets in Universe.');
  const assets=[];const errors=[];
  for(let i=0;i<tickers.length;i+=10){const batch=tickers.slice(i,i+10);const r=await fetch(`/api/yahoo-bulk?tickers=${encodeURIComponent(batch.join(','))}&range=10y`);const p=await r.json();if(!r.ok)throw new Error(p.error||'Bulk data failed');assets.push(...(p.assets||[]));errors.push(...(p.errors||[]));}
  const mp=new Map(assets.map(a=>[a.ticker,a]));const missing=tickers.filter(t=>!mp.has(t));if(missing.length)throw new Error(`Missing validated data: ${missing.join(', ')}${errors.length?' • source errors returned':''}`);return tickers.map(t=>mp.get(t));
}
async function runOptPreview(){
  try{state.optimizationInputs={rf:Number(document.querySelector('#optRf').value)/100,method:document.querySelector('#optMethod').value,lower:Number(document.querySelector('#optLower').value),upper:Number(document.querySelector('#optUpper').value),l2:Number(document.querySelector('#optL2').value),factorMax:Object.fromEntries(['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>[k,document.querySelector('#fc'+k)?.value??'']))};const payloads=await fetchUniversePayloads();state.optimizationPayloads=payloads;state.optimization=previewFrontier(payloads,state.optimizationInputs.rf,1800);state.optimizerExact=null;renderView();}catch(e){alert(e.message);}
}
function priceMatrix(payloads){
  const maps=payloads.map(p=>new Map(p.rows.filter(r=>Number.isFinite(r.close)&&r.close>0).map(r=>[r.date,r.close])));const dates=[...maps[0].keys()].filter(d=>maps.every(m=>m.has(d))).sort();return {dates,prices:dates.map(d=>maps.map(m=>m.get(d)))};
}
async function checkQuantServiceStatus(){
  const el=document.querySelector('#quantServiceStatus');
  const btn=document.querySelector('#runPyOpt');
  if(!el||!btn)return;
  try{
    const r=await fetch('/api/quant-health',{cache:'no-store'});
    const raw=await r.text(); let p={}; try{p=JSON.parse(raw);}catch{}
    if(r.ok&&p.ok){
      el.textContent=`PYPORTFOLIOOPT ONLINE${p.version?` • v${p.version}`:''}`;
      el.classList.add('online'); el.classList.remove('offline');
      btn.disabled=false; btn.title='Run exact PyPortfolioOpt optimization on the Python quant service.';
    }else{
      el.textContent='QUANT ENGINE OFFLINE'; el.classList.add('offline'); el.classList.remove('online');
      btn.disabled=false; btn.title='Quant service status check failed. Click to retry and see the exact error.';
    }
  }catch(e){
    el.textContent='QUANT ENGINE STATUS UNKNOWN'; el.classList.add('offline'); el.classList.remove('online');
    btn.disabled=false; btn.title='Status check failed. Click to retry.';
  }
}

async function runPyOpt(){
  const btn=document.querySelector('#runPyOpt'); const oldText=btn?.textContent;
  try{
    if(btn){btn.disabled=true;btn.textContent='RUNNING EXACT OPTIMIZER...';}
    if(!state.optimizationPayloads)await runOptPreview(); const payloads=state.optimizationPayloads; if(!payloads)throw new Error('Real-data frontier could not be prepared. Run REAL-DATA FRONTIER first and retry.');
    state.optimizationInputs.factorMax=Object.fromEntries(['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>[k,document.querySelector('#fc'+k)?.value??'']));
    const factorConstraints=[]; const constrained=Object.entries(state.optimizationInputs.factorMax).filter(([,v])=>v!==''&&Number.isFinite(Number(v)));
    if(constrained.length){
      if(!state.factorResults.length) throw new Error('Run Factor Lab for the selected universe before applying factor constraints.');
      const map=new Map(state.factorResults.map(x=>[x.ticker,x.result]));
      for(const [factor,val] of constrained){const max=Math.abs(Number(val));factorConstraints.push({factor,lower:-max,upper:max,loadings:Object.fromEntries(state.selectedUniverse.map(t=>[t,map.get(t)?.loadings?.[factor]??null]))});}
    }
    const parsePairs=(txt)=>Object.fromEntries(String(txt||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>{const [k,v]=x.split(':');return [k?.trim(),Number(v)];}).filter(([k,v])=>k&&Number.isFinite(v)));
    state.optimizationInputs.blViews=document.querySelector('#blViews')?.value||''; state.optimizationInputs.riskBudgets=document.querySelector('#riskBudgets')?.value||'';
    const pm=priceMatrix(payloads); const body={tickers:state.selectedUniverse,dates:pm.dates,prices:pm.prices,method:document.querySelector('#optMethod').value,risk_free_rate:Number(document.querySelector('#optRf').value)/100,lower_bound:Number(document.querySelector('#optLower').value),upper_bound:Number(document.querySelector('#optUpper').value),l2_gamma:Number(document.querySelector('#optL2').value),factor_constraints:factorConstraints,absolute_views:parsePairs(state.optimizationInputs.blViews),risk_budgets:parsePairs(state.optimizationInputs.riskBudgets)};
    const r=await fetch('/api/optimizer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const raw=await r.text(); let p;
    try{p=JSON.parse(raw);}catch{throw new Error(`Optimizer returned non-JSON (HTTP ${r.status}). ${raw.slice(0,120)}`);}
    if(!r.ok)throw new Error(p.error||p.detail||`PyPortfolioOpt failed (HTTP ${r.status})`); state.optimizerExact=p; renderView();
  }catch(e){alert(e.message);}
  finally{const b=document.querySelector('#runPyOpt');if(b){b.disabled=false;b.textContent=oldText||'RUN PYPORTFOLIOOPT EXACT';}}
}


function smartVal(v,k=''){
  if(v===null||v===undefined||v==='')return 'N/A'; if(typeof v==='string')return v;
  if(!Number.isFinite(v))return String(v); const kl=k.toLowerCase();
  if(kl.includes('margin')||kl==='roe'||kl==='roa'||kl.includes('growth')||kl.includes('yield')) return fmtPct(v);
  if(Math.abs(v)>=1e9)return `${(v/1e9).toFixed(2)}B`; if(Math.abs(v)>=1e6)return `${(v/1e6).toFixed(2)}M`; return fmtNum(v,2);
}
function fundamentalsTable(rows){if(!rows?.length)return '<p class="sub">No statement periods returned.</p>';return `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Revenue</th><th>Op Margin</th><th>Net Income</th><th>FCF</th><th>ROE</th><th>ROIC</th><th>Net Debt</th></tr></thead><tbody>${rows.slice(0,6).map(x=>`<tr><td>${x.date||'N/A'}</td><td>${smartVal(x.revenue)}</td><td>${fmtPct(x.operatingMargin)}</td><td>${smartVal(x.netIncome)}</td><td>${smartVal(x.freeCashFlow)}</td><td>${fmtPct(x.roe)}</td><td>${fmtPct(x.roic)}</td><td>${smartVal(x.netDebt)}</td></tr>`).join('')}</tbody></table></div>`;}
function researchView(){
  const r=state.research, hist=tickerHistory(state.ticker), latest=hist[0];
  return `<div class="panel"><h3>FUNDAMENTALS / VALUATION / CATALYST / THESIS MONITOR</h3><p class="sub">v0.9 separates market metadata, deep company statements, sourced catalysts and versioned thesis history. Yahoo failure in one metadata endpoint no longer blocks the Research module: chart metadata is the hard fallback and unavailable fields remain N/A.</p>
  <div class="portfolio-controls"><label>Research Ticker<input id="researchTicker" value="${state.ticker}"></label><button id="loadResearch">LOAD RESEARCH PACKAGE</button><button id="runResearchHealth">RUN CONNECTOR DIAGNOSTICS</button></div><p class="sub"><strong>Source policy:</strong> Yahoo Finance = price/market metadata; EODHD = deep fundamentals, valuation fields and primary sourced catalysts. Classic v0.9 and MK LabGEN use the exact same merged research state.</p><div id="researchHealthBox"></div></div>
  ${r?`<div class="grid two" style="margin-top:12px"><div class="panel"><h3>VALUATION SNAPSHOT</h3><div class="status-line ${r.valuation?.status==='PASS'?'good':r.valuation?.status==='PARTIAL'?'warn':'bad'}">${r.valuation?.status||'N/A'}</div><table><tbody>${Object.entries(r.valuation?.metrics||{}).map(([k,v])=>`<tr><td>${k}</td><td>${smartVal(v,k)}</td></tr>`).join('')||'<tr><td colspan="2">No valuation fields returned.</td></tr>'}</tbody></table><p class="sub">Source: ${r.valuation?.source||'N/A'} • Data through: ${r.valuation?.dataThrough||'N/A'}</p>${(r.valuation?.notes||[]).map(x=>`<div class="notice">${x}</div>`).join('')}${r.valuation?.diagnostics?`<details><summary>Source diagnostics</summary><pre class="jsonbox">${JSON.stringify(r.valuation.diagnostics,null,2)}</pre></details>`:''}</div>
  <div class="panel"><h3>FUNDAMENTAL EVIDENCE</h3>${['SOURCE_NOT_CONFIGURED','SOURCE_UNAVAILABLE','FAILED'].includes(r.fundamentals?.status)?`<div class="notice">${r.fundamentals?.message||r.fundamentals?.error||'Fundamental source unavailable.'}</div>`:`<div class="grid kpis four mini-kpis">${[['Revenue Growth',r.fundamentals?.highlights?.revenueGrowth],['Net Income Growth',r.fundamentals?.highlights?.netIncomeGrowth],['FCF Growth',r.fundamentals?.highlights?.fcfGrowth],['P/E',r.fundamentals?.highlights?.pe]].map(([k,v])=>`<div class="kpi"><div class="label">${k}</div><div class="num smallnum">${k==='P/E'?fmtNum(v,2):fmtPct(v)}</div></div>`).join('')}</div>${fundamentalsTable(r.fundamentals?.annual)}`}<p class="sub">Source: ${r.fundamentals?.source||'N/A'} • Status: ${r.fundamentals?.status||'N/A'}</p>${r.fundamentals?.diagnostics?`<details><summary>Source diagnostics</summary><pre class="jsonbox">${JSON.stringify(r.fundamentals.diagnostics,null,2)}</pre></details>`:''}</div></div>
  <div class="panel" style="margin-top:12px"><h3>CATALYST MONITOR</h3>${['SOURCE_NOT_CONFIGURED','SOURCE_UNAVAILABLE','FAILED'].includes(r.catalysts?.status)?`<div class="notice">${r.catalysts?.message||r.catalysts?.error||'Catalyst source unavailable.'}</div>`:`<table><thead><tr><th>Date</th><th>Type</th><th>Estimate</th><th>Actual</th><th>Source</th></tr></thead><tbody>${(r.catalysts?.events||[]).map(e=>`<tr><td>${e.date||'N/A'}</td><td>${e.type}</td><td>${e.estimate??'N/A'}</td><td>${e.actual??'N/A'}</td><td>${e.source}</td></tr>`).join('')||'<tr><td colspan="5">No sourced events returned.</td></tr>'}</tbody></table>`}${r.catalysts?.diagnostics?`<details><summary>Source diagnostics</summary><pre class="jsonbox">${JSON.stringify(r.catalysts.diagnostics,null,2)}</pre></details>`:''}</div>`:''}
  <div class="panel" style="margin-top:12px"><h3>THESIS MONITOR — VERSIONED</h3><div class="thesis-grid"><label>Core Thesis<textarea id="thCore" rows="5">${state.thesis.core}</textarea></label><label>Key Assumptions<textarea id="thAssumptions" rows="5">${state.thesis.assumptions}</textarea></label><label>Invalidation Conditions<textarea id="thInvalidation" rows="5">${state.thesis.invalidation}</textarea></label><label>Catalysts / Manual Notes<textarea id="thCatalysts2" rows="5">${state.thesis.catalysts}</textarea></label></div><button id="saveThesis">SAVE NEW THESIS VERSION</button>${latest?`<p class="sub">Latest saved: ${new Date(latest.savedAt).toLocaleString()} • ${diffThesis(state.thesis,hist[1]?.thesis).join(' • ')}</p>`:''}</div>
  <div class="panel" style="margin-top:12px"><h3>THESIS CHANGE LOG — ${state.ticker}</h3><table><thead><tr><th>Saved At</th><th>Changes vs Previous</th><th>Research Status</th></tr></thead><tbody>${hist.slice(0,12).map((x,i)=>`<tr><td>${new Date(x.savedAt).toLocaleString()}</td><td>${diffThesis(x.thesis,hist[i+1]?.thesis).join(', ')}</td><td>${x.researchStatus||'N/A'}</td></tr>`).join('')||'<tr><td colspan="3">No saved thesis versions yet.</td></tr>'}</tbody></table></div>`;
}
async function loadResearch(){
  const ticker=document.querySelector('#researchTicker').value.trim(); if(!ticker)return alert('Research ticker is required.'); state.ticker=ticker; const prior=tickerHistory(ticker); state.thesis=prior[0]?.thesis?{...prior[0].thesis}:{core:'',assumptions:'',invalidation:'',catalysts:''};
  const urls=[['valuation',`/api/yahoo-research?ticker=${encodeURIComponent(ticker)}`],['fundamentals',`/api/company-fundamentals?ticker=${encodeURIComponent(ticker)}`],['catalysts',`/api/catalysts?ticker=${encodeURIComponent(ticker)}`]];
  const results=await Promise.all(urls.map(async([k,u])=>{try{const r=await fetch(u);const p=await r.json();return [k,r.ok?p:{status:'FAILED',error:p.error||`HTTP ${r.status}`}]}catch(e){return[k,{status:'FAILED',error:e.message}]}}));
  state.research=Object.fromEntries(results); let v=state.research.valuation, f=state.research.fundamentals;
  // Unified source policy: Yahoo supplies market/price metadata; EODHD is primary for deep fundamentals and valuation fields.
  // Both Classic v0.9 and MK LabGEN render this same merged state object.
  if(f?.status==='PASS' || f?.status==='PARTIAL'){
    const h=f.highlights||{};
    const eodMetrics={'Market Cap':h.marketCapitalization,'Trailing P/E':h.trailingPE??h.pe,'Forward P/E':h.forwardPE,'Price / Book':h.priceBook,'EPS TTM':h.eps,'Book Value / Share':h.bookValue,'Dividend Yield':h.dividendYield,'EV / EBITDA':h.enterpriseValueEbitda};
    if(!v?.metrics){v={ticker,status:'PARTIAL',source:'EODHD fundamentals/valuation',dataThrough:null,metrics:{},notes:[],diagnostics:{}}; state.research.valuation=v;}
    // EODHD wins for company/fundamental valuation fields. Yahoo remains authoritative for market price/exchange/currency/52W fields when available.
    for(const [k,val] of Object.entries(eodMetrics)) if(Number.isFinite(val)) v.metrics[k]=val;
    const gotEod=Object.values(eodMetrics).some(Number.isFinite);
    if(gotEod){
      v.status='PASS';
      v.source=`Yahoo market metadata + ${f.source||'EODHD fundamentals'}`;
      v.notes=[...(v.notes||[]),'Source policy: Yahoo for market metadata; EODHD for deep fundamentals and valuation. Both UI templates share this merged package.'];
    }
  }
  if(v?.status==='FAILED' && !['PASS','PARTIAL'].includes(f?.status)) alert(`Research metadata failed: ${v.error}. Open Source diagnostics for the exact Yahoo/EODHD reason.`);
  renderView();
}
async function runResearchHealth(){
  const ticker=document.querySelector('#researchTicker')?.value.trim()||state.ticker||'AAPL';
  const box=document.querySelector('#researchHealthBox'); if(box) box.innerHTML='<div class="notice">Running server-side connector diagnostics…</div>';
  try{const r=await fetch(`/api/research-health?ticker=${encodeURIComponent(ticker)}`); const p=await r.json(); if(box) box.innerHTML=`<details open><summary>Connector diagnostics — ${p.overall||'UNKNOWN'}</summary><pre class="jsonbox">${JSON.stringify(p,null,2)}</pre></details>`;}catch(e){if(box) box.innerHTML=`<div class="notice">Diagnostics failed: ${e.message}</div>`;}
}
function saveThesis(){
  state.thesis={core:document.querySelector('#thCore')?.value||'',assumptions:document.querySelector('#thAssumptions')?.value||'',invalidation:document.querySelector('#thInvalidation')?.value||'',catalysts:document.querySelector('#thCatalysts2')?.value||''}; localStorage.setItem('mk_thesis',JSON.stringify(state.thesis));
  saveVersion({ticker:state.ticker,savedAt:new Date().toISOString(),thesis:{...state.thesis},researchStatus:state.research?.valuation?.status||'NOT_LOADED',researchSnapshot:state.research?{valuation:state.research.valuation?.metrics||{},fundamentalHighlights:state.research.fundamentals?.highlights||{},catalysts:state.research.catalysts?.events||[]}:null}); renderView();
}

async function fetchFactorData(){if(state.factorData)return state.factorData;const r=await fetch('/api/fama-french');const p=await r.json();if(!r.ok)throw new Error(p.error||'Factor data unavailable');state.factorData=p;return p;}
async function runFactorLab(){
  try{const payloads=await fetchUniversePayloads();const ff=await fetchFactorData();const results=[];for(const p of payloads){try{results.push({ticker:p.ticker,result:factorRegression(p.rows,ff.rows),error:null});}catch(e){results.push({ticker:p.ticker,result:null,error:e.message});}}
    state.factorResults=results;const good=results.filter(x=>x.result);const w=good.length?good.map(()=>1/good.length):[];state.factorPortfolio=good.length?portfolioFactorExposure(good.map(x=>x.result),w):null;renderView();
  }catch(e){alert(e.message);}
}
function factorLabView(){
  const good=state.factorResults.filter(x=>x.result);return `<div class="panel"><h3>FAMA–FRENCH 5 FACTOR + MOMENTUM LAB</h3><p class="sub"><strong>Reference model: U.S. Fama–French 5 factors + Momentum.</strong> For non-U.S. assets, coefficients should be read as sensitivity to the U.S. factor set, not as a local-region style classification. Regional factor libraries are a separate extension. Daily OLS: (Rᵢ−Rf) = α + βMKT(MKT−Rf) + βSMB SMB + βHML HML + βRMW RMW + βCMA CMA + βMOM MOM + ε. Factor observations come from the Kenneth R. French Data Library; asset returns use validated Yahoo prices. Minimum 126 common daily observations.</p><p class="sub">Selected universe: ${state.selectedUniverse.join(', ')||'none'}</p><button id="runFactorLab">RUN FACTOR REGRESSIONS</button></div>
  ${good.length?`<div class="grid two" style="margin-top:12px"><div class="panel"><h3>FACTOR EXPOSURE HEATMAP</h3><div id="factorHeatmap" class="chart"></div></div><div class="panel"><h3>EQUAL-WEIGHT UNIVERSE FACTOR EXPOSURE</h3><div id="factorPortfolio" class="chart"></div><p class="sub">This is an evidence view, not a recommendation. Optimization factor constraints are configured separately in Optimization Lab.</p></div></div>
  <div class="panel" style="margin-top:12px"><h3>REGRESSION DIAGNOSTICS</h3><div class="table-scroll"><table><thead><tr><th>Asset</th><th>N</th><th>Alpha Ann.</th><th>R²</th><th>MKT</th><th>SMB</th><th>HML</th><th>RMW</th><th>CMA</th><th>MOM</th></tr></thead><tbody>${state.factorResults.map(x=>x.result?`<tr><td>${x.ticker}</td><td>${x.result.n}</td><td>${fmtPct(x.result.alphaAnnual)}</td><td>${fmtPct(x.result.r2)}</td>${['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>`<td>${fmtNum(x.result.loadings[k],2)}</td>`).join('')}</tr>`:`<tr><td>${x.ticker}</td><td colspan="9">${x.error}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
}


function placeholder() {
  return `<div class="panel"><h3>${state.active}</h3><p class="sub">Reserved module in the product roadmap. Current production build implements market regime, volatility, portfolio risk, benchmark attribution, stress and liquidity.</p></div>`;
}

function renderView() {
  const view = document.querySelector('#view');
  if (state.active === 'EXECUTIVE') view.innerHTML = executive();
  else if (state.active === 'MARKET REGIME') view.innerHTML = marketRegime();
  else if (state.active === 'VOLATILITY') view.innerHTML = volatilityView();
  else if (state.active === 'UNIVERSE') view.innerHTML = universeView();
  else if (state.active === 'FACTOR LAB') view.innerHTML = factorLabView();
  else if (state.active === 'PORTFOLIO') view.innerHTML = portfolioView();
  else if (state.active === 'OPTIMIZATION') view.innerHTML = optimizationView();
  else if (state.active === 'RISK') view.innerHTML = riskView();
  else if (state.active === 'STRESS') view.innerHTML = stressView();
  else if (state.active === 'LIQUIDITY') view.innerHTML = liquidityView();
  else if (state.active === 'BACKTEST') view.innerHTML = backtestView();
  else if (state.active === 'WALK-FORWARD') view.innerHTML = walkForwardView();
  else if (state.active === 'RESEARCH' || state.active === 'THESIS') view.innerHTML = researchView();
  else if (state.active === 'METHODOLOGY') view.innerHTML = methodology();
  else view.innerHTML = placeholder();
  document.querySelectorAll('.lab-jump').forEach(b=>b.addEventListener('click',()=>{ state.active=b.dataset.jump; renderView(); }));
  if (state.active === 'UNIVERSE') bindUniverse();
  if (state.active === 'FACTOR LAB') document.querySelector('#runFactorLab')?.addEventListener('click', runFactorLab);
  if (state.active === 'PORTFOLIO') document.querySelector('#runPortfolio')?.addEventListener('click', runPortfolio);
  if (state.active === 'OPTIMIZATION') { document.querySelector('#runOptPreview')?.addEventListener('click', runOptPreview); document.querySelector('#runPyOpt')?.addEventListener('click', runPyOpt); checkQuantServiceStatus(); }
  if (state.active === 'RESEARCH' || state.active === 'THESIS') { document.querySelector('#loadResearch')?.addEventListener('click', loadResearch); document.querySelector('#runResearchHealth')?.addEventListener('click', runResearchHealth); document.querySelector('#saveThesis')?.addEventListener('click', saveThesis); }
  if (state.active === 'STRESS') {
    document.querySelector('#runStress')?.addEventListener('click', runStress);
    document.querySelector('#runReplay')?.addEventListener('click', runReplay);
  }
  if (state.active === 'BACKTEST') document.querySelector('#runBacktest')?.addEventListener('click', runBacktest);
  if (state.active === 'WALK-FORWARD') document.querySelector('#runWalk')?.addEventListener('click', runWalkForward);
  requestAnimationFrame(drawActiveCharts);
}

function runStress() {
  state.stressInputs.marketShock = Number(document.querySelector('#marketShock').value) / 100;
  state.stressInputs.corrTarget = Number(document.querySelector('#corrTarget').value);
  state.stressInputs.corrBlend = Number(document.querySelector('#corrBlend').value);
  state.stressInputs.volMultiplier = Number(document.querySelector('#volMultiplier').value);
  state.stress = stressAnalytics(state.portfolio, state.stressInputs.marketShock, state.stressInputs.corrTarget, state.stressInputs.corrBlend, state.stressInputs.volMultiplier, state.portfolioValue);
  renderView();
}

function runReplay() {
  state.replayDates.start = document.querySelector('#replayStart').value;
  state.replayDates.end = document.querySelector('#replayEnd').value;
  state.replay = historicalReplay(state.portfolioPayloads, state.portfolio.weights, state.replayDates.start, state.replayDates.end, state.benchmarkPayload);
  renderView();
}

function baseAxis() {
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  const grid = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  return { muted, grid };
}

function lineChart(id, dates, series, yPct = false) {
  const el = document.querySelector(id); if (!el) return;
  const { muted, grid } = baseAxis(); const c = echarts.init(el);
  c.setOption({ animation:false, backgroundColor:'transparent', grid:{left:58,right:22,top:28,bottom:38}, tooltip:{trigger:'axis'}, legend:{top:0,textStyle:{color:muted}}, xAxis:{type:'category',data:dates,axisLabel:{color:muted},axisLine:{lineStyle:{color:grid}}}, yAxis:{type:'value',scale:true,axisLabel:{color:muted,formatter:yPct ? v=>`${(v*100).toFixed(0)}%` : undefined},splitLine:{lineStyle:{color:grid}}}, series:series.map(s=>({type:'line',showSymbol:false,...s})) });
  window.addEventListener('resize', () => c.resize(), { once:true });
}

function barChart(id, labels, series, yPct = false) {
  const el = document.querySelector(id); if (!el) return;
  const { muted, grid } = baseAxis(); const c = echarts.init(el);
  c.setOption({animation:false,tooltip:{trigger:'axis'},legend:{textStyle:{color:muted}},grid:{left:62,right:20,top:34,bottom:48},xAxis:{type:'category',data:labels,axisLabel:{color:muted,rotate:labels.length>6?25:0}},yAxis:{type:'value',axisLabel:{color:muted,formatter:yPct?v=>`${(v*100).toFixed(1)}%`:undefined},splitLine:{lineStyle:{color:grid}}},series:series.map(s=>({type:'bar',...s}))});
}

function heatmap(id, labels, matrix, min=-1, max=1) {
  const el=document.querySelector(id); if(!el)return;
  const { muted }=baseAxis(); const data=[]; matrix.forEach((row,i)=>row.forEach((v,j)=>data.push([j,i,Number.isFinite(v)?v:null])));
  const c=echarts.init(el);
  c.setOption({animation:false,tooltip:{position:'top',formatter:p=>`${labels[p.data[1]]} / ${labels[p.data[0]]}: ${Number(p.data[2]).toFixed(2)}`},grid:{left:70,right:20,top:20,bottom:60},xAxis:{type:'category',data:labels,axisLabel:{color:muted,rotate:35}},yAxis:{type:'category',data:labels,axisLabel:{color:muted}},visualMap:{min,max,calculable:true,orient:'horizontal',left:'center',bottom:0,textStyle:{color:muted}},series:[{type:'heatmap',data,label:{show:true,formatter:p=>Number(p.data[2]).toFixed(2)},emphasis:{itemStyle:{shadowBlur:8}}}]});
}


function factorExposureHeatmap(id,results){
  const el=document.querySelector(id);if(!el)return;const {muted}=baseAxis();const factors=['MKT','SMB','HML','RMW','CMA','MOM'],assets=results.map(x=>x.ticker),data=[];results.forEach((x,i)=>factors.forEach((k,j)=>data.push([j,i,x.result.loadings[k]])));const vals=data.map(x=>Math.abs(x[2])).filter(Number.isFinite),mx=Math.max(1,...vals);const c=echarts.init(el);c.setOption({animation:false,tooltip:{formatter:p=>`${assets[p.data[1]]} / ${factors[p.data[0]]}: ${Number(p.data[2]).toFixed(3)}`},grid:{left:80,right:20,top:20,bottom:60},xAxis:{type:'category',data:factors,axisLabel:{color:muted}},yAxis:{type:'category',data:assets,axisLabel:{color:muted}},visualMap:{min:-mx,max:mx,calculable:true,orient:'horizontal',left:'center',bottom:0,textStyle:{color:muted}},series:[{type:'heatmap',data,label:{show:true,formatter:p=>Number(p.data[2]).toFixed(2)}}]});
}

function selectedCurrentWeights(){
  const out={};
  String(state.portfolioText||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>{
    const [t,v]=x.split(':'); const n=Number(v); if(t&&Number.isFinite(n)) out[t.trim()]=n/100;
  });
  const w=state.selectedUniverse.map(t=>out[t]);
  if(w.length && w.every(Number.isFinite)){
    const sum=w.reduce((a,b)=>a+b,0); if(sum>0) return w.map(x=>x/sum);
  }
  return null;
}
function portfolioPointFromWeights(w,o){
  if(!w||!o?.mu||!o?.sigma)return null;
  let er=0,v=0; for(let i=0;i<w.length;i++){er+=w[i]*o.mu[i];for(let j=0;j<w.length;j++)v+=w[i]*w[j]*o.sigma[i][j];}
  const vol=Math.sqrt(Math.max(v,0)); return {vol,ret:er,sharpe:vol>0?(er-(state.optimizationInputs.rf||0))/vol:NaN};
}
function frontierChart(id,o,ex=null){
  const el=document.querySelector(id); if(!el)return;
  const {muted,grid}=baseAxis(); const c=echarts.init(el);
  const finite=p=>Number.isFinite(p?.vol)&&Number.isFinite(p?.ret);
  const pts=(o.points||[]).filter(finite);
  const step=Math.max(1,Math.ceil(pts.length/360));
  const cloud=pts.filter((_,i)=>i%step===0).map(p=>[p.vol,p.ret,p.sharpe]);
  const ef=(o.frontier||[]).filter(finite).map(p=>[p.vol,p.ret,p.sharpe]);
  const exact=(ex?.frontier||[])
    .filter(p=>Number.isFinite(p?.volatility)&&Number.isFinite(p?.return))
    .sort((a,b)=>a.volatility-b.volatility)
    .map(p=>[p.volatility,p.return,p.sharpe]);

  const eqW=Array(state.selectedUniverse.length).fill(1/Math.max(1,state.selectedUniverse.length));
  const eq=portfolioPointFromWeights(eqW,o);
  const cur=portfolioPointFromWeights(selectedCurrentWeights(),o);
  const exactPoint=(ex?.performance&&Number.isFinite(ex.performance.volatility)&&Number.isFinite(ex.performance.expected_return))
    ? {vol:ex.performance.volatility,ret:ex.performance.expected_return,sharpe:ex.performance.sharpe}
    : null;
  const bench=ex?.benchmarks||{};
  const pickPerf=x=>x?.performance&&Number.isFinite(x.performance.volatility)&&Number.isFinite(x.performance.expected_return)
    ? {vol:x.performance.volatility,ret:x.performance.expected_return,sharpe:x.performance.sharpe}:null;
  const minVolExact=pickPerf(bench.min_volatility);
  const maxSharpeExact=pickPerf(bench.max_sharpe);
  const rpExact=pickPerf(bench.risk_parity);
  const blExact=pickPerf(bench.black_litterman);
  const tangent=maxSharpeExact||o.maxSharpe;
  const rf=Number(state.optimizationInputs.rf||0);

  // Axis scaling is intentionally based on investable portfolios only.
  // The risk-free intercept must not stretch the vertical scale.
  const markers=[eq,cur,exactPoint,minVolExact,maxSharpeExact,rpExact,blExact].filter(Boolean);
  const investable=[...cloud,...ef,...exact,...markers.map(p=>[p.vol,p.ret,p.sharpe])]
    .filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  const xs=investable.map(p=>p[0]), ys=investable.map(p=>p[1]);
  let xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
  if(!Number.isFinite(xmin)||!Number.isFinite(xmax)){xmin=0;xmax=.25;}
  if(!Number.isFinite(ymin)||!Number.isFinite(ymax)){ymin=0;ymax=.15;}
  const xspan=Math.max(xmax-xmin,.02), yspan=Math.max(ymax-ymin,.02);
  const xpad=Math.max(xspan*.07,.004), ypad=Math.max(yspan*.12,.004);
  const axisXMin=Math.max(0,xmin-xpad), axisXMax=xmax+xpad;
  const axisYMin=ymin-ypad, axisYMax=ymax+ypad;

  // Clip the CML to the visible plot instead of forcing the chart down to RF.
  let cml=[];
  if(tangent&&Number.isFinite(tangent.vol)&&tangent.vol>0&&Number.isFinite(tangent.ret)){
    const slope=(tangent.ret-rf)/tangent.vol;
    if(Number.isFinite(slope)&&Math.abs(slope)>1e-12){
      const xFromY=(axisYMin-rf)/slope;
      const startX=Math.max(axisXMin,Math.min(axisXMax,xFromY));
      const endX=axisXMax;
      cml=[[startX,rf+slope*startX],[endX,rf+slope*endX]];
    }
  }

  const hasExact=exact.length>1;
  const series=[
    {name:'Feasible Set',type:'scatter',symbolSize:2.6,data:cloud,itemStyle:{opacity:.075},emphasis:{itemStyle:{opacity:.5}},z:1},
    {name:'Preview Frontier',type:'line',showSymbol:false,smooth:.18,data:ef,lineStyle:{width:1.1,type:'dashed',opacity:hasExact?.28:.9},z:3}
  ];
  if(hasExact) series.push({name:'PyPortfolioOpt Exact Frontier',type:'line',showSymbol:false,smooth:.22,lineStyle:{width:3.6,opacity:1},data:exact,z:9});

  const addPoint=(name,p,symbol,size,label,pos='top',z=12)=>{
    if(!p)return;
    series.push({
      name,type:'scatter',symbol,symbolSize:size,data:[[p.vol,p.ret,p.sharpe]],z,
      label:{show:true,position:pos,distance:10,formatter:label,fontWeight:700,fontSize:11,
        backgroundColor:'rgba(9,15,23,.76)',borderRadius:4,padding:[3,5]}
    });
  };
  addPoint('Minimum Volatility',minVolExact||o.minVol,'diamond',15,'MIN VOL','left',13);
  addPoint('Maximum Sharpe / Tangency',maxSharpeExact||o.maxSharpe,'circle',17,'TANGENCY','top',14);
  if(eq)addPoint('Equal Weight',eq,'rect',12,'EQUAL WT','bottom',11);
  if(cur)addPoint('Current Portfolio',cur,'triangle',16,'CURRENT','right',15);
  if(rpExact)addPoint('Risk Parity',rpExact,'roundRect',14,'RISK PARITY','bottom',13);
  if(blExact)addPoint('Black–Litterman',blExact,'pin',18,'BLACK–LITTERMAN','right',13);
  if(exactPoint && !['max_sharpe','min_volatility','risk_parity','black_litterman'].includes(ex?.method))
    addPoint(`Selected ${String(ex.method||'Optimizer').replaceAll('_',' ')}`,exactPoint,'pin',18,'SELECTED','top',14);
  if(cml.length)series.push({name:'Capital Market Line',type:'line',showSymbol:false,data:cml,lineStyle:{width:1.7,type:'dotted',opacity:.8},z:6});

  c.setOption({
    animation:false,
    tooltip:{trigger:'item',confine:true,backgroundColor:'rgba(8,14,22,.97)',borderWidth:1,
      formatter:p=>`<b>${p.seriesName}</b><br>Volatility ${(p.value[0]*100).toFixed(2)}%<br>Expected Return ${(p.value[1]*100).toFixed(2)}%${Number.isFinite(p.value[2])?`<br>Sharpe ${Number(p.value[2]).toFixed(2)}`:''}`},
    legend:{top:0,left:'center',type:'scroll',itemGap:14,itemWidth:18,itemHeight:8,textStyle:{color:muted,fontSize:11}},
    grid:{left:78,right:30,top:68,bottom:64},
    xAxis:{type:'value',name:'ANNUALIZED VOLATILITY',nameLocation:'middle',nameGap:44,min:axisXMin,max:axisXMax,splitNumber:5,
      axisLabel:{color:muted,formatter:v=>`${(v*100).toFixed(1)}%`},axisLine:{show:true,lineStyle:{color:grid}},splitLine:{lineStyle:{color:grid,type:'dashed',opacity:.7}}},
    yAxis:{type:'value',name:'EXPECTED RETURN',nameLocation:'middle',nameGap:56,min:axisYMin,max:axisYMax,splitNumber:5,
      axisLabel:{color:muted,formatter:v=>`${(v*100).toFixed(1)}%`},axisLine:{show:true,lineStyle:{color:grid}},splitLine:{lineStyle:{color:grid,type:'dashed',opacity:.7}}},
    series
  },true);
  requestAnimationFrame(()=>c.resize());
}


function drawActiveCharts() {
  const m = state.metrics;
  if (state.active === 'EXECUTIVE' && m) {
    lineChart('#priceChart', m.dates, [{name:'Close',data:m.closes},{name:'MA21',data:m.ma21Series},{name:'MA50',data:m.ma50Series},{name:'MA200',data:m.ma200Series}]);
    lineChart('#ddChart', m.dates, [{name:'Drawdown',data:m.drawdownSeries,areaStyle:{opacity:.18}}], true);
  }
  if (state.active === 'MARKET REGIME' && m) {
    lineChart('#regimePrice', m.dates, [{name:'Close',data:m.closes},{name:'MA21',data:m.ma21Series},{name:'MA50',data:m.ma50Series},{name:'MA200',data:m.ma200Series}]);
    lineChart('#macdChart', m.dates, [{name:'MACD',data:m.macd.line},{name:'Signal',data:m.macd.signal},{name:'Histogram',data:m.macd.hist,type:'bar'}]);
  }
  if (state.active === 'VOLATILITY' && m) {
    const vd = m.dates.slice(1);
    lineChart('#rollingVol', vd, [{name:'21D',data:m.rolling21},{name:'63D',data:m.rolling63}], true);
    lineChart('#ewmaVol', vd, [{name:'EWMA Fast λ=.90',data:m.ewmaFastSeries},{name:'EWMA Slow λ=.97',data:m.ewmaSlowSeries}], true);
  }
  if (state.active === 'PORTFOLIO' && state.portfolio) {
    const p=state.portfolio,names=state.portfolioPayloads.map(x=>x.ticker);
    barChart('#riskContribution', names, [{name:'Capital Weight',data:p.weights},{name:'Risk Contribution',data:p.rcPct}], true);
    if (p.benchmarkNav?.length && p.alignedPortfolioNav?.length) {
      lineChart('#portfolioNav', p.benchmarkDates, [{name:'Portfolio',data:p.alignedPortfolioNav.slice(1)},{name:'Benchmark',data:p.benchmarkNav.slice(1)}]);
    } else lineChart('#portfolioNav', p.navDates, [{name:'Portfolio',data:p.nav.slice(1)}]);
    heatmap('#corrShort',names,p.shortCorr,-1,1); heatmap('#corrDelta',names,p.corrDelta,-0.5,0.5);
  }
  if (state.active === 'STRESS' && state.stress) {
    const names=state.portfolioPayloads.map(x=>x.ticker);
    barChart('#stressWaterfall', names, [{name:'Stress Contribution',data:state.stress.contributions}], true);
    heatmap('#stressCorr', names, state.stress.stressedCorr, -1, 1);
  }
  if (state.active === 'LIQUIDITY' && state.liquidity.length) {
    barChart('#liquidityChart', state.liquidity.map(x=>x.ticker), [{name:'Exit Days',data:state.liquidity.map(x=>x.daysToLiquidate)}], false);
  }
  if (state.active === 'BACKTEST' && state.backtest) {
    lineChart('#btNav', state.backtest.dates, [{name:'Strategy',data:state.backtest.nav},{name:'Buy & Hold',data:state.backtest.benchmarkNav}]);
  }
  if (state.active === 'WALK-FORWARD' && state.walkforward) {
    lineChart('#wfNav', state.walkforward.dates, [{name:'OOS Strategy',data:state.walkforward.nav}]);
  }
  if (state.active === 'FACTOR LAB' && state.factorResults.some(x=>x.result)) { factorExposureHeatmap('#factorHeatmap', state.factorResults.filter(x=>x.result)); if(state.factorPortfolio) barChart('#factorPortfolio', Object.keys(state.factorPortfolio), [{name:'Beta',data:Object.values(state.factorPortfolio)}], false); }
  if (state.active === 'OPTIMIZATION' && state.optimization) {
    frontierChart('#frontierChart', state.optimization, state.optimizerExact);
  }
}

renderView();
loadData();
