import * as echarts from 'echarts';
import './styles.css';
import { summary, portfolioAnalytics, liquidityAnalytics, stressAnalytics, historicalReplay } from './analytics.js';
import { maCrossBacktest, walkForwardMA } from './backtest.js';
import { UNIVERSE, FIELD_VALUES, PRESETS, filterUniverse } from './universe.js';
import { previewFrontier, alignReturns } from './optimizer-preview.js';
import { factorRegression, portfolioFactorExposure } from './factors.js';
import { readHistory, saveVersion, tickerHistory, diffThesis } from './thesis.js';
import { parseWeightText, vectorFromMap, mapFromVector, buildGroupConstraints, buildLiquidityCaps, parseRelativeViews, applyViewConfidences, migrationAnalysis, riskDecompositionLocal, strategyScenarioMatrix, regimeDiagnostic, regimeConstraintPreset, frontierDiagnostics } from './institutional-advanced.js';

const fmtPct = x => Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : 'N/A';
const fmtNum = (x, d = 2) => Number.isFinite(x) ? x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : 'N/A';
const fmtMoney = (x, ccy = '') => Number.isFinite(x) ? `${ccy ? ccy + ' ' : ''}${x.toLocaleString(undefined,{maximumFractionDigits:0})}` : 'N/A';
const fmtPctile = x => Number.isFinite(x) ? `${Math.round(x * 100)}th` : 'N/A';

const tabs = ['EXECUTIVE','UNIVERSE','FACTOR LAB','PORTFOLIO','OPTIMIZATION','ROBUSTNESS','MIGRATION','DECISION DESK','MARKET REGIME','VOLATILITY','RISK','STRESS','LIQUIDITY','RESEARCH','BACKTEST','WALK-FORWARD','THESIS','METHODOLOGY'];
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
  optimizationInputs: { rf: 0.03, method:'max_sharpe', lower:0, upper:0.40, l2:0.10, targetReturn:0.12, targetVolatility:0.15, riskAversion:1.0, blViews:'', riskBudgets:'', factorMax:{MKT:'',SMB:'',HML:'',RMW:'',CMA:'',MOM:''} },
  comparisonInputs: { rebalance:'monthly', costBps:10, initialBasis:'current' },
  modelInputs: { returnModel:'historical_mean', riskModel:'ledoit_wolf', emaSpan:500, ewmaSpan:180 },
  advancedConstraints: { commodityMax:null, equityMin:null, bondMin:null, regionMax:null, groupMax:null, minEffectiveN:null, turnoverLimit:null, turnoverPenalty:0, trackingErrorLimit:null, liquidityMaxDays:null, liquidityParticipation:0.10, portfolioValue:10000000 },
  blStudio: { relativeViews:'', confidences:'', tau:0.05 },
  currentWeightsText: '', benchmarkWeightsText: '',
  robustness: null, robustnessInputs: { strategy:'max_sharpe', bootstrapCount:20 }, lastOptimizerRequest:null,
  portfolioOOS: null, portfolioOOSInputs: { train:756, test:63, step:63, folds:10, costBps:10 },
  migrationTarget:'max_sharpe', migration: null, riskStrategy:'max_sharpe',
  scenarioMatrix: null,
  scenarioSelection: { scenario:'Equity Shock', strategy:'max_sharpe' },
  decisionNotes: '',
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
  return `<div class="brand brand-classic"><h1>MK INSTITUTIONAL INVESTMENT INTELLIGENCE</h1><p>Institutional Research • Portfolio Risk • Market Analytics • Netlify Edition v0.13.1</p></div>`;
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
  const primary = ['EXECUTIVE','UNIVERSE','OPTIMIZATION','ROBUSTNESS','MIGRATION','DECISION DESK','RISK','STRESS','BACKTEST','FACTOR LAB','RESEARCH','THESIS'];
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
  <div class="panel" style="margin-top:12px"><h3>MACD MOMENTUM</h3><div id="macdChart" class="chart small"></div></div>${regimeAllocationPanel()}`;
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
  return asset + p + riskDecompositionDesk();
}

function stressView() {
  const strategyScenario=strategyScenarioDesk();
  if (!state.portfolio) return '<div class="panel"><h3>STRESS LAB</h3><p class="sub">Run Portfolio for beta-based stress P&L. PortfolioOPTIM strategy scenarios are available after exact optimization.</p></div>'+strategyScenario;
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
    <div class="panel" style="margin-top:12px"><h3>HISTORICAL REPLAY</h3><div class="portfolio-controls"><label>Start<input id="replayStart" type="date" value="${state.replayDates.start}"></label><label>End<input id="replayEnd" type="date" value="${state.replayDates.end}"></label><button id="runReplay">RUN REALIZED REPLAY</button></div>${replayTable()}</div>${strategyScenario}`;
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
  if (!state.payload?.rows?.length) return '<div class="panel"><h3>WALK-FORWARD</h3><p class="sub">Run asset analysis first for the MA validation.</p></div>'+portfolioOOSSection();
  const w=state.walkforward;
  return `<div class="panel"><h3>WALK-FORWARD / OUT-OF-SAMPLE VALIDATION</h3><div class="portfolio-controls">
    <label>Train Days<input id="wfTrain" type="number" min="252" step="21" value="${state.walkInputs.train}"></label>
    <label>Test Days<input id="wfTest" type="number" min="63" step="21" value="${state.walkInputs.test}"></label>
    <button id="runWalk">RUN WALK-FORWARD</button></div>
    <p class="sub">Each fold optimizes fast/slow MA parameters only on the training window, then applies the selected parameters to the next untouched test window. Parameter grid: fast 10/20/30/40/50; slow 100/150/200.</p></div>
    ${w ? `<div class="grid kpis four" style="margin-top:12px">${[['OOS CAGR',fmtPct(w.metrics.cagr)],['OOS VOL',fmtPct(w.metrics.annVol)],['OOS SHARPE',fmtNum(w.metrics.sharpe,2)],['OOS SORTINO',fmtNum(w.metrics.sortino,2)],['OOS MAX DD',fmtPct(w.metrics.mdd)],['OOS CALMAR',fmtNum(w.metrics.calmar,2)],['FOLDS',w.folds.length],['TERMINAL NAV',fmtNum(w.metrics.terminal,3)]].map(([a,v])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${v}</div></div>`).join('')}</div>
    <div class="grid two"><div class="panel"><h3>OUT-OF-SAMPLE NAV</h3><div id="wfNav" class="chart"></div></div><div class="panel"><h3>FOLD RESULTS</h3><div class="table-scroll"><table><thead><tr><th>Train</th><th>Test</th><th>Fast</th><th>Slow</th><th>Train Sharpe</th><th>Test Sharpe</th><th>Test Return</th></tr></thead><tbody>${w.folds.map(f=>`<tr><td>${f.trainFrom}→${f.trainTo}</td><td>${f.testFrom}→${f.testTo}</td><td>${f.fast}</td><td>${f.slow}</td><td>${fmtNum(f.trainSharpe,2)}</td><td>${fmtNum(f.testSharpe,2)}</td><td>${fmtPct(f.testReturn)}</td></tr>`).join('')}</tbody></table></div></div></div>` : '<div class="panel" style="margin-top:12px"><p class="sub">Run walk-forward to generate OOS folds.</p></div>'}${portfolioOOSSection()}`;
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
  return `<div class="panel"><h3>METHODOLOGY — v0.13.1</h3>
  <table><thead><tr><th>Module</th><th>Formula / Method</th><th>Validation / Governance</th></tr></thead><tbody>
  <tr><td>Returns</td><td>rₜ = ln(Pₜ/Pₜ₋₁) for market diagnostics; PortfolioOPTIM uses aligned simple returns from prices</td><td>Finite positive observed prices only</td></tr>
  <tr><td>Realized Vol</td><td>σ = sd(r) × √252</td><td>Rolling 21D / 63D</td></tr>
  <tr><td>EWMA Fast / Slow</td><td>σ²ₜ = λσ²ₜ₋₁ + (1−λ)r²ₜ; λ=.90/.97</td><td>Filtered current-state diagnostic</td></tr>
  <tr><td>Drawdown</td><td>DDₜ = NAVₜ / max(NAV₀…NAVₜ) − 1</td><td>Observed path</td></tr>
  <tr><td>Historical VaR / CVaR</td><td>1% empirical daily return quantile; mean tail return below VaR</td><td>Explicitly 1-day empirical measures</td></tr>
  <tr><td>Portfolio Vol</td><td>σₚ = √(wᵀΣw)</td><td>Annual covariance on common aligned observations</td></tr>
  <tr><td>Risk Contribution</td><td>MRCᵢ=(Σw)ᵢ/σₚ; RCᵢ=wᵢMRCᵢ</td><td>Same PortfolioOPTIM covariance model</td></tr>
  <tr><td>Maximum Sharpe / Tangency</td><td>max (wᵀμ−Rf)/√(wᵀΣw)</td><td>CML anchored only to unregularized exact tangency solution</td></tr>
  <tr><td>Minimum Volatility</td><td>min wᵀΣw</td><td>Same active constraints and common model</td></tr>
  <tr><td>Risk Parity</td><td>Equalize portfolio risk contributions subject to supported controls</td><td>Compared on common μ/Σ/Rf evaluator</td></tr>
  <tr><td>Black–Litterman</td><td>Prior + absolute/relative views + confidence/tau → posterior μ/Σ</td><td>Weights optimized on posterior; common-basis score reported separately</td></tr>
  <tr><td>Expected Return Models</td><td>Historical mean / EMA expected return / CAPM proxy</td><td>User-selected; displayed in model snapshot</td></tr>
  <tr><td>Risk Models</td><td>Ledoit–Wolf / Sample covariance / EWMA covariance</td><td>User-selected; same model drives common evaluator</td></tr>
  <tr><td>Constraint Engine</td><td>Weight, factor, group, region, asset-class, Effective-N, turnover, tracking-error and liquidity caps</td><td>Precheck + binding diagnostics; advanced controls default OFF</td></tr>
  <tr><td>Liquidity Capacity</td><td>Capᵢ = ADTVᵢ × participation × maxExitDays / portfolioValue</td><td>Trailing 63D observed price×volume</td></tr>
  <tr><td>Walk-Forward OOS</td><td>Train-only optimization → locked weights → untouched non-overlapping test window</td><td>Transaction costs applied at fold transition; no look-ahead</td></tr>
  <tr><td>Robustness</td><td>Return/risk model grid + bootstrap resampling of observed returns</td><td>Weight bands, stability score and resampled exact-frontier envelope</td></tr>
  <tr><td>Migration</td><td>Δw = wTarget−wCurrent; notional = Δw × portfolio value</td><td>Turnover and one-way cost estimate disclosed</td></tr>
  <tr><td>Scenario Matrix</td><td>Σwᵢ×deterministic shockᵢ; correlation-spike case is a risk overlay</td><td>Transparent diagnostic assumptions; not forecasts</td></tr>
  <tr><td>Regime Presets</td><td>Existing trend/vol regime → named constraint preset</td><td>Never auto-applied; requires explicit user action</td></tr>
  <tr><td>Decision Desk</td><td>Consolidates target metrics, migration, robustness, OOS and scenarios</td><td>Decision support only; no automatic recommendation/execution</td></tr>
  <tr><td>Fama–French + MOM</td><td>(Rᵢ−Rf)=α+βMKT(MKT−Rf)+βSMB·SMB+βHML·HML+βRMW·RMW+βCMA·CMA+βMOM·MOM+ε</td><td>Kenneth French daily factors; ≥126 common observations</td></tr>
  <tr><td>Research</td><td>Yahoo market metadata + optional EODHD fundamentals/catalysts</td><td>No synthetic fill; missing fields remain unavailable</td></tr>
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
    <p class="sub">Selected universe: ${state.selectedUniverse.join(', ')||'none'}. Preview uses real Yahoo price history. Exact constrained optimization is routed to the optional Python PortfolioOPTIM service. Factor-neutral bounds require Factor Lab loadings.</p>
    <div class="portfolio-controls">
      <label>Risk-Free %<input id="optRf" type="number" step="0.1" value="${state.optimizationInputs.rf*100}"></label>
      <label>Optimization Strategy<select id="optMethod">${[['max_sharpe','Maximum Sharpe / Tangency'],['min_volatility','Minimum Volatility'],['efficient_return','Target Return / Minimum Risk'],['efficient_risk','Target Volatility / Maximum Return'],['max_quadratic_utility','Maximum Quadratic Utility'],['risk_parity','Risk Parity / ERC'],['hrp','Hierarchical Risk Parity'],['black_litterman','Black–Litterman'],['cla_min_volatility','CLA Minimum Volatility'],['cla_max_sharpe','CLA Maximum Sharpe'],['min_semivariance','Minimum Semivariance'],['min_cvar','Minimum CVaR'],['min_cdar','Minimum CDaR']].map(([v,n])=>`<option value="${v}" ${v===state.optimizationInputs.method?'selected':''}>${n}</option>`).join('')}</select></label>
      <label>Lower Bound<input id="optLower" type="number" step="0.01" value="${state.optimizationInputs.lower}"></label>
      <label>Upper Bound<input id="optUpper" type="number" step="0.05" value="${state.optimizationInputs.upper}"></label>
      <label>L2 Gamma<input id="optL2" type="number" step="0.05" value="${state.optimizationInputs.l2}"></label>
      <label class="strategy-param target-return-param">Target Return %<input id="optTargetReturn" type="number" step="0.1" value="${(state.optimizationInputs.targetReturn??0.12)*100}"></label>
      <label class="strategy-param target-vol-param">Target Volatility %<input id="optTargetVol" type="number" step="0.1" value="${(state.optimizationInputs.targetVolatility??0.15)*100}"></label>
      <label class="strategy-param risk-aversion-param">Risk Aversion<input id="optRiskAversion" type="number" min="0.01" step="0.25" value="${state.optimizationInputs.riskAversion??1}"></label>
      <button id="runOptPreview">RUN REAL-DATA FRONTIER</button><button id="runPyOpt" class="exact-opt-btn">RUN PORTFOLIOOPTIM EXACT</button><span id="quantServiceStatus" class="quant-service-status">CHECKING QUANT ENGINE...</span>
    </div>
    <div id="strategyHelp" class="strategy-help"></div>
    <h4>MODEL GOVERNANCE</h4>
    <div class="portfolio-controls advanced-opt">
      <label>Expected Return Model<select id="returnModel"><option value="historical_mean" ${state.modelInputs.returnModel==='historical_mean'?'selected':''}>Historical Mean</option><option value="ema_mean" ${state.modelInputs.returnModel==='ema_mean'?'selected':''}>EMA Expected Return</option><option value="capm" ${state.modelInputs.returnModel==='capm'?'selected':''}>CAPM / Universe Market Proxy</option></select></label>
      <label>Risk Model<select id="riskModel"><option value="ledoit_wolf" ${state.modelInputs.riskModel==='ledoit_wolf'?'selected':''}>Ledoit–Wolf Shrinkage</option><option value="sample_cov" ${state.modelInputs.riskModel==='sample_cov'?'selected':''}>Sample Covariance</option><option value="ewma_cov" ${state.modelInputs.riskModel==='ewma_cov'?'selected':''}>EWMA Covariance</option></select></label>
      <label>EMA Span<input id="emaSpan" type="number" min="20" step="20" value="${state.modelInputs.emaSpan}"></label>
      <label>EWMA Span<input id="ewmaSpan" type="number" min="20" step="20" value="${state.modelInputs.ewmaSpan}"></label>
    </div>
    <h4>BLACK–LITTERMAN VIEW STUDIO</h4>
    <div class="portfolio-controls advanced-opt">
      <label>Absolute Views<input id="blViews" value="${state.optimizationInputs.blViews||''}" placeholder="SPY:0.08,GC=F:0.06"></label>
      <label>Relative Views<input id="blRelativeViews" value="${state.blStudio.relativeViews||''}" placeholder="SPY>IEF:0.03,GC=F>SPY:0.02"></label>
      <label>View Confidence<input id="blConfidences" value="${state.blStudio.confidences||''}" placeholder="SPY:0.70,SPY>IEF:0.60"></label>
      <label>BL Tau<input id="blTau" type="number" min="0.001" max="1" step="0.01" value="${state.blStudio.tau}"></label>
      <label>Risk Budgets<input id="riskBudgets" value="${state.optimizationInputs.riskBudgets||''}" placeholder="SPY:1,GC=F:1,IEF:1"></label>
    </div>
    <p class="sub">Absolute and relative views are annual return assumptions in decimal form. Confidence controls the Black–Litterman view uncertainty matrix; Tau controls prior uncertainty. All comparison metrics are re-scored on the common base model.</p>
    <h4>INSTITUTIONAL CONSTRAINT ENGINE</h4>
    <div class="portfolio-controls advanced-opt">
      <label>Current Weights<input id="currentWeightsText" value="${state.currentWeightsText||''}" placeholder="SPY:30,GC=F:10,IEF:20..."></label>
      <label>Benchmark Weights<input id="benchmarkWeightsText" value="${state.benchmarkWeightsText||''}" placeholder="Optional for tracking error"></label>
      <label>Commodity Max %<input id="commodityMax" type="number" step="1" value="${Number.isFinite(state.advancedConstraints.commodityMax)?state.advancedConstraints.commodityMax*100:''}"></label>
      <label>Equity Min %<input id="equityMin" type="number" step="1" value="${Number.isFinite(state.advancedConstraints.equityMin)?state.advancedConstraints.equityMin*100:''}"></label>
      <label>Bond Min %<input id="bondMin" type="number" step="1" value="${Number.isFinite(state.advancedConstraints.bondMin)?state.advancedConstraints.bondMin*100:''}" placeholder="off"></label>
      <label>Region Max %<input id="regionMax" type="number" step="1" value="${Number.isFinite(state.advancedConstraints.regionMax)?state.advancedConstraints.regionMax*100:''}"></label>
      <label>Group Max %<input id="groupMax" type="number" step="1" value="${Number.isFinite(state.advancedConstraints.groupMax)?state.advancedConstraints.groupMax*100:''}"></label>
      <label>Min Effective N<input id="minEffectiveN" type="number" min="1" step="0.5" value="${state.advancedConstraints.minEffectiveN??''}"></label>
      <label>Turnover Limit %<input id="turnoverLimit" type="number" min="0" step="5" value="${Number.isFinite(state.advancedConstraints.turnoverLimit)?state.advancedConstraints.turnoverLimit*100:''}"></label>
      <label>Turnover Penalty<input id="turnoverPenalty" type="number" min="0" step="0.05" value="${state.advancedConstraints.turnoverPenalty||0}"></label>
      <label>Tracking Error Limit %<input id="trackingErrorLimit" type="number" min="0" step="0.5" value="${Number.isFinite(state.advancedConstraints.trackingErrorLimit)?state.advancedConstraints.trackingErrorLimit*100:''}" placeholder="off"></label>
      <label>Portfolio Value<input id="optPortfolioValue" type="number" min="1" value="${state.advancedConstraints.portfolioValue}"></label>
      <label>ADV Participation %<input id="optParticipation" type="number" min="0.1" max="100" step="0.5" value="${state.advancedConstraints.liquidityParticipation*100}"></label>
      <label>Max Exit Days<input id="liquidityMaxDays" type="number" min="0.25" step="0.25" value="${state.advancedConstraints.liquidityMaxDays}"></label>
    </div>
    <p class="sub">Group caps are generated from the selected universe metadata. Liquidity caps use the trailing 63-day average dollar volume, portfolio value, participation rate and maximum exit days. Tracking error requires benchmark weights; turnover controls require current weights.</p>
    <h4>FACTOR EXPOSURE CONSTRAINTS — MAX ABSOLUTE BETA</h4>
    <div class="portfolio-controls factor-constraints">${['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>`<label>${k}<input id="fc${k}" type="number" min="0" step="0.05" value="${fm[k]??''}" placeholder="unconstrained"></label>`).join('')}</div>
    <p class="sub">Example: HML = 0.10 constrains portfolio HML loading to −0.10 ≤ βHML ≤ +0.10. Leave blank for no factor constraint. HRP/CLA do not accept these linear constraints in this service.</p>
  </div>
    ${o?`<div class="grid kpis four" style="margin-top:12px">${[['OBS',o.observations],['MIN VOL',fmtPct(o.minVol.vol)],['MIN VOL RETURN',fmtPct(o.minVol.ret)],['MAX SHARPE',fmtNum(o.maxSharpe.sharpe,2)],['MS RETURN',fmtPct(o.maxSharpe.ret)],['MS VOL',fmtPct(o.maxSharpe.vol)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div>
    <div class="grid optimization-grid"><div class="panel frontier-panel"><div class="frontier-head"><div><h3>${ex?.frontier?.length?'PORTFOLIOOPTIM EFFICIENT FRONTIER':'EFFICIENT FRONTIER — PREVIEW'}</h3><p class="sub">${ex?.frontier?.length?'Exact constrained frontier is primary. CML is anchored to the unregularized Maximum Sharpe / Tangency solution; preview remains diagnostic only.':'Run PortfolioOPTIM to overlay the exact constrained frontier.'}</p></div><span class="engine-badge ${ex?.frontier?.length?'live':'preview'}">${ex?.frontier?.length?'EXACT LIVE':'PREVIEW'}</span></div>${ex?.benchmarks?.max_sharpe?.performance?frontierAnalyticsStrip(ex):''}<div id="frontierChart" class="chart frontier-chart"></div></div><div class="panel solution-panel"><h3>${ex?'PORTFOLIO SOLUTIONS':'PREVIEW PORTFOLIOS'}</h3><p class="sub solution-note">Risk/return metrics use the same annualized model shown on the frontier. Weights below 0.10% are hidden for readability.</p>${ex?.benchmarks?.min_volatility?solutionBlock('Minimum Volatility',ex.benchmarks.min_volatility,state.selectedUniverse.map(t=>ex.benchmarks.min_volatility.weights?.[t]||0)):solutionBlock('Minimum Volatility',{performance:o.minVol},o.minVol.w)}${ex?.benchmarks?.max_sharpe?solutionBlock('Maximum Sharpe / Tangency',ex.benchmarks.max_sharpe,state.selectedUniverse.map(t=>ex.benchmarks.max_sharpe.weights?.[t]||0),true):solutionBlock('Maximum Sharpe',{performance:o.maxSharpe},o.maxSharpe.w,true)}${ex?.benchmarks?.risk_parity?solutionBlock('Risk Parity',ex.benchmarks.risk_parity,state.selectedUniverse.map(t=>ex.benchmarks.risk_parity.weights?.[t]||0)):''}${ex?.benchmarks?.black_litterman?solutionBlock('Black–Litterman — Common Basis',ex.benchmarks.black_litterman,state.selectedUniverse.map(t=>ex.benchmarks.black_litterman.weights?.[t]||0)):ex?.benchmarks?.black_litterman_error?unavailableSolutionBlock('Black–Litterman',ex.benchmarks.black_litterman_error):''}${ex && !['max_sharpe','min_volatility','risk_parity','black_litterman'].includes(ex.method)?solutionBlock(`Selected — ${String(ex.method||'Optimizer').replaceAll('_',' ')}`,{performance:ex.performance},state.selectedUniverse.map(t=>ex.weights?.[t]||0)):''}</div></div>`:''}
    ${ex?`<div class="panel strategy-comparison-panel" style="margin-top:12px"><div class="frontier-head"><div><h3>PORTFOLIO STRATEGY COMPARISON LAB</h3><p class="sub">Institutional apples-to-apples comparison: optimizer strategies use the same selected universe, common dates, PortfolioOPTIM evaluation model, risk-free rate and active bounds/factor constraints. Equal Weight and Current Portfolio are reference portfolios and may sit outside optimizer constraints. Historical path diagnostics apply the same funding basis, rebalance cadence and transaction-cost assumption to every target portfolio.</p></div><span class="engine-badge live">COMMON BASIS</span></div><div class="comparison-controls"><label>Rebalance<select id="cmpRebalance"><option value="monthly" ${state.comparisonInputs.rebalance==='monthly'?'selected':''}>Monthly</option><option value="quarterly" ${state.comparisonInputs.rebalance==='quarterly'?'selected':''}>Quarterly</option><option value="none" ${state.comparisonInputs.rebalance==='none'?'selected':''}>Buy & Hold / No Rebalance</option></select></label><label>Initial Funding<select id="cmpInitialBasis"><option value="current" ${state.comparisonInputs.initialBasis==='current'?'selected':''}>Current Portfolio if available</option><option value="cash" ${state.comparisonInputs.initialBasis==='cash'?'selected':''}>Cash / New Funding</option><option value="target" ${state.comparisonInputs.initialBasis==='target'?'selected':''}>Assume Already at Target</option></select></label><label>Transaction Cost (bp)<input id="cmpCostBps" type="number" min="0" step="1" value="${state.comparisonInputs.costBps}"></label><div class="comparison-basis"><span>UNIVERSE</span><b>${state.selectedUniverse.length} assets</b></div><div class="comparison-basis"><span>OBS</span><b>${o.observations}</b></div><div class="comparison-basis"><span>RF</span><b>${fmtPct(state.optimizationInputs.rf)}</b></div><div class="comparison-basis"><span>BOUNDS</span><b>${fmtPct(state.optimizationInputs.lower)} / ${fmtPct(state.optimizationInputs.upper)}</b></div></div><h4>MODEL SNAPSHOT — PORTFOLIOOPTIM COMMON EVALUATION MODEL</h4>${strategyComparisonTable(o,ex)}<h4>HISTORICAL PATH DIAGNOSTICS — COMMON SAMPLE</h4>${strategyHistoricalTable(o,ex)}<div class="grid two strategy-path-grid" style="margin-top:12px"><div><h4>STRATEGY NAV — NET OF ASSUMED COSTS</h4><div id="strategyNavChart" class="chart strategy-path-chart"></div></div><div><h4>DRAWDOWN PATH</h4><div id="strategyDrawdownChart" class="chart strategy-path-chart"></div></div></div><div class="grid two strategy-heat-grid" style="margin-top:12px"><div><h4>CAPITAL WEIGHTS HEATMAP</h4><div id="strategyWeightHeatmap" class="chart strategy-heatmap"></div></div><div><h4>RISK CONTRIBUTION HEATMAP</h4><div id="strategyRiskHeatmap" class="chart strategy-heatmap"></div></div></div><p class="sub comparison-note"><strong>Governance:</strong> historical path diagnostics are in-sample implementation diagnostics of today's target weights, not an out-of-sample performance claim. Use Walk-Forward for forecast-valid strategy evaluation. Black–Litterman uses posterior views to form weights, then is re-evaluated on the same PortfolioOPTIM base model and realized path as every other strategy. Daily VaR/CVaR are empirical 1-day measures. Initial transition costs follow the selected funding basis.</p>${frontierDiagnosticsPanel()}</div>`:''}
    ${ex?`<div class="grid two" style="margin-top:12px"><div class="panel"><h3>PORTFOLIOOPTIM — ${ex.method}</h3><p class="sub">Engine: ${ex.engine} • ${ex.observations} complete observations • ${ex.data_start} → ${ex.data_end}</p>${ex.factor_exposure?`<h4>OPTIMIZED FACTOR EXPOSURE</h4><table><tbody>${Object.entries(ex.factor_exposure).map(([k,v])=>`<tr><td>${k}</td><td>${fmtNum(v,3)}</td></tr>`).join('')}</tbody></table>`:''}<pre class="jsonbox">${JSON.stringify(ex.performance,null,2)}</pre></div><div class="panel"><h3>SELECTED STRATEGY CONSTRAINT DIAGNOSTICS</h3><p class="sub">Scope: selected ${String(ex.method||'optimizer').replaceAll('_',' ')}${ex.method==='max_sharpe'&&Number(state.optimizationInputs.l2||0)>0?' with L2 regularization':''}. These bindings can differ from the pure Tangency benchmark.</p>${constraintDiagnosticsTable(ex.constraint_diagnostics)}${ex?.benchmarks?.max_sharpe?.constraint_diagnostics?`<h4>TANGENCY BENCHMARK BINDINGS</h4>${constraintDiagnosticsTable(ex.benchmarks.max_sharpe.constraint_diagnostics)}`:''}<p class="sub">Binding constraints explain why optimized weights may sit exactly on configured caps/floors.</p></div></div>`:''}`;
}

function commonOptimizationModel(o,ex){
  const tickers=state.selectedUniverse;
  const mu=tickers.map(t=>Number(ex?.expected_returns?.[t]));
  const sigma=tickers.map(r=>tickers.map(c=>Number(ex?.covariance?.[r]?.[c])));
  if(mu.length&&mu.every(Number.isFinite)&&sigma.length===tickers.length&&sigma.every(row=>row.length===tickers.length&&row.every(Number.isFinite))){
    return {mu,sigma,source:'PortfolioOPTIM',spec:ex?.model_spec||{}};
  }
  return o;
}

function strategyComparisonRows(o,ex){
  if(!o)return [];
  const model=commonOptimizationModel(o,ex);
  const bench=ex?.benchmarks||{};
  const rows=[];
  const curW=selectedCurrentWeights();
  const add=(key,label,weights,kind='optimizer',source=null)=>{
    if(!weights||weights.length!==state.selectedUniverse.length)return;
    const w=weights.map(Number);
    if(!w.every(Number.isFinite))return;
    const sum=w.reduce((a,b)=>a+b,0); if(!(sum>0))return;
    const wn=w.map(x=>x/sum);
    // PortfolioOPTIM backend is the canonical evaluator for optimizer strategies.
    // Frontend re-evaluation is used only for reference portfolios or as fallback.
    const canonical=canonicalStrategyPerf(source);
    const local=portfolioPointFromWeights(wn,model);
    const p=canonical||local; if(!p)return;
    const hhi=wn.reduce((a,x)=>a+x*x,0);
    const maxWeight=Math.max(...wn.map(Math.abs));
    const turnover=curW?0.5*wn.reduce((a,x,i)=>a+Math.abs(x-curW[i]),0):NaN;
    const consistency=(canonical&&local)?{
      retDelta:Math.abs(canonical.ret-local.ret),
      volDelta:Math.abs(canonical.vol-local.vol),
      sharpeDelta:Math.abs(canonical.sharpe-local.sharpe),
    }:null;
    rows.push({key,label,kind,weights:wn,...p,hhi,effectiveN:hhi>0?1/hhi:NaN,maxWeight,turnover,consistency});
  };
  const bw=x=>state.selectedUniverse.map(t=>Number(x?.weights?.[t]||0));
  add('max_sharpe','Maximum Sharpe / Tangency',bw(bench.max_sharpe),'optimizer',bench.max_sharpe);
  add('min_volatility','Minimum Volatility',bw(bench.min_volatility),'optimizer',bench.min_volatility);
  add('risk_parity','Risk Parity',bw(bench.risk_parity),'optimizer',bench.risk_parity);
  if(bench.black_litterman)add('black_litterman','Black–Litterman',bw(bench.black_litterman),'optimizer',bench.black_litterman);
  const eq=Array(state.selectedUniverse.length).fill(1/Math.max(1,state.selectedUniverse.length));
  add('equal_weight','Equal Weight',eq,'benchmark');
  if(curW)add('current','Current Portfolio',curW,'benchmark');
  return rows;
}

function riskContributionShares(weights,o){
  if(!weights||!o?.sigma)return [];
  const n=weights.length, sw=Array(n).fill(0);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)sw[i]+=o.sigma[i][j]*weights[j];
  const comp=weights.map((w,i)=>w*sw[i]);
  const total=comp.reduce((a,b)=>a+b,0);
  return Math.abs(total)>1e-14?comp.map(x=>x/total):comp.map(()=>NaN);
}
function strategyComparisonTable(o,ex){
  const rows=strategyComparisonRows(o,ex);
  if(!rows.length)return '<p class="sub">Run PortfolioOPTIM Exact to populate the strategy comparison.</p>';
  const spec=ex?.model_spec||{}, bench=ex?.benchmarks||{};
  const unavailableBl=!bench.black_litterman;
  const blReason=bench.black_litterman_error||'No valid Black–Litterman solution returned.';
  const body=rows.map(r=>`<tr><td><b>${r.label}</b></td><td>${r.kind==='benchmark'?'Reference':'Optimizer'}</td><td>${fmtPct(r.ret)}</td><td>${fmtPct(r.vol)}</td><td>${fmtNum(r.sharpe,2)}</td><td>${fmtNum(r.hhi,3)}</td><td>${fmtNum(r.effectiveN,2)}</td><td>${fmtPct(r.maxWeight)}</td><td>${Number.isFinite(r.turnover)?fmtPct(r.turnover):'N/A'}</td></tr>`).join('');
  const blRow=unavailableBl?`<tr class="strategy-unavailable"><td><b>Black–Litterman</b></td><td>Optimizer</td><td colspan="7">UNAVAILABLE — ${blReason}</td></tr>`:'';
  const maxMismatch=Math.max(0,...rows.filter(r=>r.consistency).map(r=>Math.max(r.consistency.retDelta,r.consistency.volDelta)));
  const audit=maxMismatch>5e-7?`<span class="consistency-warning">MODEL CHECK WARNING: max local/backend delta ${fmtNum(maxMismatch*10000,2)} bp</span>`:'<span class="consistency-ok">MODEL CHECK PASS</span>';
  return `<div class="strategy-compare-wrap"><table class="strategy-compare"><thead><tr><th>Strategy</th><th>Type</th><th>Return</th><th>Volatility</th><th>Sharpe</th><th>HHI</th><th>Effective N</th><th>Max Weight</th><th>Turnover vs Current</th></tr></thead><tbody>${body}${blRow}</tbody></table></div><p class="sub comparison-model-note">Common evaluation: ${spec.expected_return_model||'PortfolioOPTIM expected returns'} • ${spec.risk_model||'PortfolioOPTIM covariance'} • annualization ${spec.frequency||252} • evaluator ${spec.comparison_evaluator||'common model'}. ${audit} Comparison benchmarks are unregularized; L2 remains a selected-strategy control.</p>`;
}


function quantileSorted(a,q){
  if(!a.length)return NaN;
  const x=[...a].sort((u,v)=>u-v), p=(x.length-1)*q, lo=Math.floor(p), hi=Math.ceil(p);
  return lo===hi?x[lo]:x[lo]+(p-lo)*(x[hi]-x[lo]);
}
function rebalanceKey(date,mode){
  if(mode==='none')return 'ALL';
  const y=String(date).slice(0,4), m=Number(String(date).slice(5,7));
  return mode==='quarterly'?`${y}-Q${Math.floor((m-1)/3)+1}`:`${y}-${String(m).padStart(2,'0')}`;
}
function historicalPathForWeights(targetWeights){
  if(!state.optimizationPayloads?.length||!targetWeights?.length)return null;
  const a=alignReturns(state.optimizationPayloads); if(!a?.returns?.length)return null;
  const target=targetWeights.map(Number), s=target.reduce((x,y)=>x+y,0); if(!(s>0))return null;
  const tw=target.map(x=>x/s), mode=state.comparisonInputs?.rebalance||'monthly', bps=Math.max(0,Number(state.comparisonInputs?.costBps||0));
  const basis=state.comparisonInputs?.initialBasis||'current', curW=selectedCurrentWeights();
  let initialTurnover=0;
  if(basis==='cash') initialTurnover=1.0;
  else if(basis==='current'&&curW) initialTurnover=.5*tw.reduce((z,x,i)=>z+Math.abs(x-curW[i]),0);
  // target basis intentionally assumes the portfolio already holds target weights.
  let w=[...tw], lastKey=rebalanceKey(a.dates[0],mode), turnover=initialTurnover;
  const initialCost=initialTurnover*bps/10000;
  let nav=Math.max(1-initialCost,1e-9), grossNav=1, peak=nav, costDrag=initialCost;
  const navs=[], grossNavs=[], dds=[], rets=[], grossRets=[], monthly=new Map();
  for(let t=0;t<a.returns.length;t++){
    const key=rebalanceKey(a.dates[t],mode); let tc=0;
    if(t>0&&mode!=='none'&&key!==lastKey){
      const tr=.5*w.reduce((z,x,i)=>z+Math.abs(x-tw[i]),0); turnover+=tr; tc=tr*bps/10000; costDrag+=tc; w=[...tw]; lastKey=key;
    }
    const simple=a.returns[t].map(x=>Math.exp(x)-1);
    const gross=w.reduce((z,x,i)=>z+x*simple[i],0), net=gross-tc;
    nav*=Math.max(1+net,1e-9); grossNav*=Math.max(1+gross,1e-9); peak=Math.max(peak,nav); const dd=nav/peak-1;
    rets.push(net); grossRets.push(gross); navs.push(nav); grossNavs.push(grossNav); dds.push(dd);
    const mk=String(a.dates[t]).slice(0,7), cur=monthly.get(mk)??1; monthly.set(mk,cur*(1+net));
    const denom=1+gross;
    if(denom>0)w=w.map((x,i)=>x*(1+simple[i])/denom);
  }
  const n=rets.length, years=n/252, cagr=years>0?Math.pow(nav,1/years)-1:NaN, grossCagr=years>0?Math.pow(grossNav,1/years)-1:NaN;
  const avg=rets.reduce((x,y)=>x+y,0)/Math.max(1,n), variance=rets.reduce((x,y)=>x+(y-avg)**2,0)/Math.max(1,n-1), dailySd=Math.sqrt(Math.max(0,variance)), vol=dailySd*Math.sqrt(252);
  const rf=Number(state.optimizationInputs.rf||0), rfDaily=Math.pow(1+rf,1/252)-1;
  const excess=rets.map(x=>x-rfDaily), avgExcess=excess.reduce((x,y)=>x+y,0)/Math.max(1,n);
  const sharpe=dailySd>0?avgExcess/dailySd*Math.sqrt(252):NaN;
  const downsideDaily=Math.sqrt(excess.reduce((z,x)=>z+Math.min(x,0)**2,0)/Math.max(1,n));
  const sortino=downsideDaily>0?avgExcess/downsideDaily*Math.sqrt(252):NaN;
  const mdd=Math.min(0,...dds), calmar=Math.abs(mdd)>1e-12?cagr/Math.abs(mdd):NaN;
  const q01=quantileSorted(rets,.01), tail=rets.filter(x=>x<=q01), var99=-q01, cvar99=tail.length?-tail.reduce((z,x)=>z+x,0)/tail.length:NaN;
  const posDays=rets.filter(x=>x>0).length/Math.max(1,n), mrets=[...monthly.values()].map(x=>x-1), worstMonth=mrets.length?Math.min(...mrets):NaN;
  const annTurnover=years>0?turnover/years:NaN, annCost=Number.isFinite(grossCagr)&&Number.isFinite(cagr)?grossCagr-cagr:NaN;
  return {dates:a.dates,navs,grossNavs,dds,rets,grossRets,cagr,grossCagr,vol,sharpe,sortino,mdd,calmar,var99,cvar99,worstMonth,posDays,annTurnover,annCost,turnover,costDrag,initialTurnover};
}
function strategyHistoricalRows(o,ex){
  return strategyComparisonRows(o,ex).map(r=>({...r,hist:historicalPathForWeights(r.weights)})).filter(r=>r.hist);
}
function strategyHistoricalTable(o,ex){
  const rows=strategyHistoricalRows(o,ex); if(!rows.length)return '<p class="sub">Historical comparison path unavailable.</p>';
  return `<div class="strategy-compare-wrap"><table class="strategy-compare historical-compare"><thead><tr><th>Strategy</th><th>CAGR</th><th>Ann. Vol</th><th>Sharpe</th><th>Sortino</th><th>Max DD</th><th>Calmar</th><th>1D VaR 99%</th><th>1D CVaR 99%</th><th>Worst Month</th><th>Positive Days</th><th>Ann. Turnover</th><th>Ann. Cost Drag</th><th>Initial Turnover</th></tr></thead><tbody>${rows.map(r=>{const h=r.hist;return `<tr><td><b>${r.label}</b></td><td>${fmtPct(h.cagr)}</td><td>${fmtPct(h.vol)}</td><td>${fmtNum(h.sharpe,2)}</td><td>${fmtNum(h.sortino,2)}</td><td>${fmtPct(h.mdd)}</td><td>${fmtNum(h.calmar,2)}</td><td>${fmtPct(h.var99)}</td><td>${fmtPct(h.cvar99)}</td><td>${fmtPct(h.worstMonth)}</td><td>${fmtPct(h.posDays)}</td><td>${fmtPct(h.annTurnover)}</td><td>${fmtPct(h.annCost)}</td><td>${fmtPct(h.initialTurnover)}</td></tr>`}).join('')}</tbody></table></div>`;
}
function strategyPathChart(id,o,ex,mode='nav'){
  const el=document.querySelector(id); if(!el)return;
  const rows=strategyHistoricalRows(o,ex); if(!rows.length)return;
  const dates=rows[0].hist.dates, series=rows.map(r=>({name:r.label,type:'line',showSymbol:false,smooth:false,data:(mode==='nav'?r.hist.navs:r.hist.dds),lineStyle:{width:r.kind==='benchmark'?1.3:2}}));
  const {muted,grid}=baseAxis(), c=echarts.init(el);
  c.setOption({animation:false,tooltip:{trigger:'axis',confine:true},legend:{top:0,type:'scroll',textStyle:{color:muted,fontSize:9}},grid:{left:62,right:22,top:48,bottom:45},xAxis:{type:'category',data:dates,boundaryGap:false,axisLabel:{color:muted,fontSize:9},axisLine:{lineStyle:{color:grid}}},yAxis:{type:'value',scale:mode==='nav',axisLabel:{color:muted,formatter:v=>mode==='nav'?Number(v).toFixed(2):`${(v*100).toFixed(0)}%`},splitLine:{lineStyle:{color:grid,type:'dashed'}}},series},true);
  requestAnimationFrame(()=>c.resize());
}

function strategyHeatmap(id,o,ex,mode='weights'){
  const el=document.querySelector(id); if(!el)return;
  const rows=strategyComparisonRows(o,ex); if(!rows.length)return;
  const model=commonOptimizationModel(o,ex);
  const {muted}=baseAxis(); const assets=state.selectedUniverse;
  const data=[];
  rows.forEach((r,yi)=>{
    const vals=mode==='risk'?riskContributionShares(r.weights,model):r.weights;
    vals.forEach((v,xi)=>data.push([xi,yi,Number.isFinite(v)?v:null]));
  });
  const vals=data.map(x=>Math.abs(x[2])).filter(Number.isFinite); const mx=Math.max(.01,...vals);
  const c=echarts.init(el);
  c.setOption({animation:false,tooltip:{formatter:p=>`${rows[p.data[1]].label}<br>${assets[p.data[0]]}: ${(Number(p.data[2])*100).toFixed(2)}%`},grid:{left:160,right:24,top:18,bottom:58},xAxis:{type:'category',data:assets,axisLabel:{color:muted,rotate:30,fontSize:10}},yAxis:{type:'category',data:rows.map(r=>r.label),axisLabel:{color:muted,fontSize:10}},visualMap:{min:mode==='risk'?-mx:0,max:mx,calculable:false,orient:'horizontal',left:'center',bottom:0,textStyle:{color:muted,fontSize:9}},series:[{type:'heatmap',data,label:{show:true,fontSize:9,formatter:p=>Number.isFinite(p.data[2])?`${(p.data[2]*100).toFixed(1)}%`:''},emphasis:{itemStyle:{shadowBlur:6}}}]});
}

function perfTriplet(perf){
  if(!perf)return null;
  const ret=Number(perf.expected_return ?? perf.ret);
  const vol=Number(perf.volatility ?? perf.vol);
  const sharpe=Number(perf.sharpe);
  return {ret,vol,sharpe};
}
function canonicalStrategyPerf(source){
  return perfTriplet(source?.common_performance || source?.performance || source);
}
function unavailableSolutionBlock(title,reason){
  return `<section class="solution-block unavailable"><div class="solution-title"><h4>${title}</h4><span class="solution-tag warning">UNAVAILABLE</span></div><p class="sub">${reason||'No valid solution returned.'}</p></section>`;
}
function solutionBlock(title,source,w,isTangency=false){
  const p=canonicalStrategyPerf(source);
  const metrics=p?`<div class="solution-metrics">
    <div><span>RETURN</span><b>${fmtPct(p.ret)}</b></div>
    <div><span>VOLATILITY</span><b>${fmtPct(p.vol)}</b></div>
    <div><span>SHARPE</span><b>${fmtNum(p.sharpe,2)}</b></div>
  </div>`:'';
  const tag=isTangency?'<span class="solution-tag">CML ANCHOR</span>':'';
  return `<section class="solution-block"><div class="solution-title"><h4>${title}</h4>${tag}</div>${metrics}${weightsTable('',w,0.001)}</section>`;
}
function frontierAnalyticsStrip(ex){
  const t=canonicalStrategyPerf(ex?.benchmarks?.max_sharpe);
  const m=canonicalStrategyPerf(ex?.benchmarks?.min_volatility);
  if(!t)return '';
  const rf=Number(state.optimizationInputs.rf||0);
  const slope=Number.isFinite(t.vol)&&t.vol>0?(t.ret-rf)/t.vol:NaN;
  return `<div class="frontier-analytics">
    <div><span>TANGENCY RETURN</span><b>${fmtPct(t.ret)}</b></div>
    <div><span>TANGENCY VOL</span><b>${fmtPct(t.vol)}</b></div>
    <div><span>TANGENCY SHARPE</span><b>${fmtNum(t.sharpe,2)}</b></div>
    <div><span>CML SLOPE</span><b>${fmtNum(slope,2)}</b></div>
    ${m?`<div><span>MIN VOL</span><b>${fmtPct(m.vol)}</b></div>`:''}
  </div>`;
}
function weightsTable(title,w,minDisplay=0){if(!w)return '';const rows=state.selectedUniverse.map((t,i)=>({t,w:Number(w[i]||0)})).filter(x=>Math.abs(x.w)>=minDisplay);return `<h4>${title}</h4><table><thead><tr><th>Asset</th><th>Weight</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.t}</td><td>${fmtPct(x.w)}</td></tr>`).join('')||'<tr><td colspan="2">All weights below display threshold.</td></tr>'}</tbody></table>`;}
function constraintDiagnosticsTable(d){
  if(!d)return '<p class="sub">No diagnostics returned.</p>';
  const rows=[['Solver status',d.solver_status||'optimal'],['Lower bound',Number.isFinite(d.lower_bound)?fmtPct(d.lower_bound):'N/A'],['Upper bound',Number.isFinite(d.upper_bound)?fmtPct(d.upper_bound):'N/A'],['Binding lower',Array.isArray(d.binding_lower)&&d.binding_lower.length?d.binding_lower.join(', '):'None'],['Binding upper',Array.isArray(d.binding_upper)&&d.binding_upper.length?d.binding_upper.join(', '):'None'],['Turnover',Number.isFinite(d.turnover)?fmtPct(d.turnover):'N/A'],['Turnover limit',Number.isFinite(d.turnover_limit)?fmtPct(d.turnover_limit):'N/A'],['Effective N',Number.isFinite(d.effective_n)?fmtNum(d.effective_n,2):'N/A'],['Minimum Effective N',Number.isFinite(d.min_effective_n)?fmtNum(d.min_effective_n,2):'N/A'],['Tracking error',Number.isFinite(d.tracking_error)?fmtPct(d.tracking_error):'N/A'],['Tracking-error limit',Number.isFinite(d.tracking_error_limit)?fmtPct(d.tracking_error_limit):'N/A']];
  const groups=Array.isArray(d.group_constraints)&&d.group_constraints.length?`<h4>GROUP / ASSET-CLASS BOUNDS</h4><table><thead><tr><th>Constraint</th><th>Exposure</th><th>Range</th><th>Binding</th></tr></thead><tbody>${d.group_constraints.map(x=>`<tr><td>${x.name}</td><td>${fmtPct(x.exposure)}</td><td>${fmtPct(x.lower)} to ${fmtPct(x.upper)}</td><td>${x.binding?'YES':'NO'}</td></tr>`).join('')}</tbody></table>`:'';
  const factors=Array.isArray(d.factor_constraints)&&d.factor_constraints.length?`<h4>FACTOR BOUNDS</h4><table><thead><tr><th>Factor</th><th>Exposure</th><th>Range</th><th>Binding</th></tr></thead><tbody>${d.factor_constraints.map(x=>`<tr><td>${x.factor}</td><td>${fmtNum(x.exposure,3)}</td><td>${fmtNum(x.lower,3)} to ${fmtNum(x.upper,3)}</td><td>${x.binding?'YES':'NO'}</td></tr>`).join('')}</tbody></table>`:'';
  const liq=Object.keys(d.liquidity_caps||{}).length?`<details><summary>Liquidity caps (${Object.keys(d.liquidity_caps).length})</summary><table><thead><tr><th>Asset</th><th>Max Weight</th></tr></thead><tbody>${Object.entries(d.liquidity_caps).map(([t,v])=>`<tr><td>${t}</td><td>${fmtPct(Number(v))}</td></tr>`).join('')}</tbody></table></details>`:'';
  return `<table><tbody>${rows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>${groups}${factors}${liq}`;
}
async function fetchUniversePayloads(){
  const tickers=state.selectedUniverse.slice(0,36);if(tickers.length<2)throw new Error('Select at least two assets in Universe.');
  const assets=[];const errors=[];
  for(let i=0;i<tickers.length;i+=10){const batch=tickers.slice(i,i+10);const r=await fetch(`/api/yahoo-bulk?tickers=${encodeURIComponent(batch.join(','))}&range=10y`);const p=await r.json();if(!r.ok)throw new Error(p.error||'Bulk data failed');assets.push(...(p.assets||[]));errors.push(...(p.errors||[]));}
  const mp=new Map(assets.map(a=>[a.ticker,a]));const missing=tickers.filter(t=>!mp.has(t));if(missing.length)throw new Error(`Missing validated data: ${missing.join(', ')}${errors.length?' • source errors returned':''}`);return tickers.map(t=>mp.get(t));
}
async function runOptPreview(){
  try{state.optimizationInputs={...state.optimizationInputs,rf:Number(document.querySelector('#optRf').value)/100,method:document.querySelector('#optMethod').value,lower:Number(document.querySelector('#optLower').value),upper:Number(document.querySelector('#optUpper').value),l2:Number(document.querySelector('#optL2').value),targetReturn:Number(document.querySelector('#optTargetReturn')?.value)/100,targetVolatility:Number(document.querySelector('#optTargetVol')?.value)/100,riskAversion:Number(document.querySelector('#optRiskAversion')?.value)||1,factorMax:Object.fromEntries(['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>[k,document.querySelector('#fc'+k)?.value??'']))};const payloads=await fetchUniversePayloads();state.optimizationPayloads=payloads;state.optimization=previewFrontier(payloads,state.optimizationInputs.rf,1800);state.optimizerExact=null;renderView();}catch(e){alert(e.message);}
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
      el.textContent=`PORTFOLIOOPTIM ONLINE${p.version?` • v${p.version}`:''}`;
      el.classList.add('online'); el.classList.remove('offline');
      btn.disabled=false; btn.title='Run exact PortfolioOPTIM optimization on the Python quant service.';
    }else{
      el.textContent='QUANT ENGINE OFFLINE'; el.classList.add('offline'); el.classList.remove('online');
      btn.disabled=false; btn.title='Quant service status check failed. Click to retry and see the exact error.';
    }
  }catch(e){
    el.textContent='QUANT ENGINE STATUS UNKNOWN'; el.classList.add('offline'); el.classList.remove('online');
    btn.disabled=false; btn.title='Status check failed. Click to retry.';
  }
}


function parsePairsText(txt){
  return Object.fromEntries(String(txt||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>{const [k,v]=x.split(':');return [k?.trim(),Number(v)];}).filter(([k,v])=>k&&Number.isFinite(v)));
}
function pctInput(id){const el=document.querySelector(id);if(!el||el.value==='')return null;const n=Number(el.value);return Number.isFinite(n)?n/100:null;}
function numInput(id,fallback=null){const el=document.querySelector(id);if(!el||el.value==='')return fallback;const n=Number(el.value);return Number.isFinite(n)?n:fallback;}
function collectOptimizationUi(){
  state.modelInputs.returnModel=document.querySelector('#returnModel')?.value||state.modelInputs.returnModel;
  state.modelInputs.riskModel=document.querySelector('#riskModel')?.value||state.modelInputs.riskModel;
  state.modelInputs.emaSpan=numInput('#emaSpan',state.modelInputs.emaSpan);
  state.modelInputs.ewmaSpan=numInput('#ewmaSpan',state.modelInputs.ewmaSpan);
  state.blStudio.relativeViews=document.querySelector('#blRelativeViews')?.value??state.blStudio.relativeViews;
  state.blStudio.confidences=document.querySelector('#blConfidences')?.value??state.blStudio.confidences;
  state.blStudio.tau=numInput('#blTau',state.blStudio.tau);
  state.currentWeightsText=document.querySelector('#currentWeightsText')?.value??state.currentWeightsText;
  state.benchmarkWeightsText=document.querySelector('#benchmarkWeightsText')?.value??state.benchmarkWeightsText;
  state.advancedConstraints.commodityMax=pctInput('#commodityMax');
  state.advancedConstraints.equityMin=pctInput('#equityMin');
  state.advancedConstraints.bondMin=pctInput('#bondMin');
  state.advancedConstraints.regionMax=pctInput('#regionMax');
  state.advancedConstraints.groupMax=pctInput('#groupMax');
  state.advancedConstraints.minEffectiveN=numInput('#minEffectiveN',null);
  state.advancedConstraints.turnoverLimit=pctInput('#turnoverLimit');
  state.advancedConstraints.turnoverPenalty=numInput('#turnoverPenalty',0)||0;
  state.advancedConstraints.trackingErrorLimit=pctInput('#trackingErrorLimit');
  state.advancedConstraints.portfolioValue=numInput('#optPortfolioValue',state.advancedConstraints.portfolioValue);
  state.advancedConstraints.liquidityParticipation=(numInput('#optParticipation',state.advancedConstraints.liquidityParticipation*100)||0)/100;
  state.advancedConstraints.liquidityMaxDays=numInput('#liquidityMaxDays',state.advancedConstraints.liquidityMaxDays);
}
function buildFactorConstraints(){
  state.optimizationInputs.factorMax=Object.fromEntries(['MKT','SMB','HML','RMW','CMA','MOM'].map(k=>[k,document.querySelector('#fc'+k)?.value??state.optimizationInputs.factorMax?.[k]??'']));
  const constrained=Object.entries(state.optimizationInputs.factorMax).filter(([,v])=>v!==''&&Number.isFinite(Number(v)));
  if(!constrained.length)return [];
  if(!state.factorResults.length)throw new Error('Run Factor Lab for the selected universe before applying factor constraints.');
  const map=new Map(state.factorResults.map(x=>[x.ticker,x.result]));
  return constrained.map(([factor,val])=>{const max=Math.abs(Number(val));return {factor,lower:-max,upper:max,loadings:Object.fromEntries(state.selectedUniverse.map(t=>[t,map.get(t)?.loadings?.[factor]??null]))};});
}
function buildOptimizerRequest(payloads,methodOverride=null){
  collectOptimizationUi();
  const method=methodOverride||document.querySelector('#optMethod')?.value||state.optimizationInputs.method;
  state.optimizationInputs.method=method;
  state.optimizationInputs.rf=numInput('#optRf',state.optimizationInputs.rf*100)/100;
  state.optimizationInputs.lower=numInput('#optLower',state.optimizationInputs.lower);
  state.optimizationInputs.upper=numInput('#optUpper',state.optimizationInputs.upper);
  state.optimizationInputs.l2=numInput('#optL2',state.optimizationInputs.l2);
  state.optimizationInputs.targetReturn=(numInput('#optTargetReturn',(state.optimizationInputs.targetReturn??0.12)*100))/100;
  state.optimizationInputs.targetVolatility=(numInput('#optTargetVol',(state.optimizationInputs.targetVolatility??0.15)*100))/100;
  state.optimizationInputs.riskAversion=numInput('#optRiskAversion',state.optimizationInputs.riskAversion)||1;
  state.optimizationInputs.blViews=document.querySelector('#blViews')?.value??state.optimizationInputs.blViews;
  state.optimizationInputs.riskBudgets=document.querySelector('#riskBudgets')?.value??state.optimizationInputs.riskBudgets;
  const absViews=parsePairsText(state.optimizationInputs.blViews);
  const relative=parseRelativeViews(state.blStudio.relativeViews);
  const vc=applyViewConfidences(absViews,relative,state.blStudio.confidences);
  const current=parseWeightText(state.currentWeightsText,state.selectedUniverse);
  const benchmark=parseWeightText(state.benchmarkWeightsText,state.selectedUniverse);
  const groups=buildGroupConstraints(state.selectedUniverse,state.advancedConstraints);
  const liquidityCaps=buildLiquidityCaps(payloads,state.advancedConstraints.portfolioValue,state.advancedConstraints.liquidityParticipation,state.advancedConstraints.liquidityMaxDays,state.optimizationInputs.upper);
  const pm=priceMatrix(payloads);
  return {tickers:state.selectedUniverse,dates:pm.dates,prices:pm.prices,method,risk_free_rate:state.optimizationInputs.rf,lower_bound:state.optimizationInputs.lower,upper_bound:state.optimizationInputs.upper,l2_gamma:state.optimizationInputs.l2,target_return:state.optimizationInputs.targetReturn,target_volatility:state.optimizationInputs.targetVolatility,risk_aversion:state.optimizationInputs.riskAversion,factor_constraints:buildFactorConstraints(),group_constraints:groups,absolute_views:absViews,relative_views:vc.relative_views,view_confidences:vc.view_confidences,bl_tau:state.blStudio.tau,risk_budgets:parsePairsText(state.optimizationInputs.riskBudgets),current_weights:current,benchmark_weights:benchmark,turnover_limit:state.advancedConstraints.turnoverLimit,turnover_penalty:state.advancedConstraints.turnoverPenalty,tracking_error_limit:state.advancedConstraints.trackingErrorLimit,min_effective_n:state.advancedConstraints.minEffectiveN,liquidity_caps:liquidityCaps,return_model:state.modelInputs.returnModel,risk_model:state.modelInputs.riskModel,ema_span:state.modelInputs.emaSpan,ewma_span:state.modelInputs.ewmaSpan,frontier_points:81};
}

async function runPyOpt(){
  const btn=document.querySelector('#runPyOpt'); const oldText=btn?.textContent;
  try{
    if(btn){btn.disabled=true;btn.textContent='RUNNING EXACT OPTIMIZER...';}
    if(!state.optimizationPayloads)await runOptPreview();
    const payloads=state.optimizationPayloads; if(!payloads)throw new Error('Real-data frontier could not be prepared. Run REAL-DATA FRONTIER first and retry.');
    const body=buildOptimizerRequest(payloads);
    state.lastOptimizerRequest=body;
    const r=await fetch('/api/optimizer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const raw=await r.text(); let p;
    try{p=JSON.parse(raw);}catch{throw new Error(`Optimizer returned non-JSON (HTTP ${r.status}). ${raw.slice(0,120)}`);}
    if(!r.ok)throw new Error(p.error||p.detail||`PortfolioOPTIM failed (HTTP ${r.status})`);
    state.optimizerExact=p; state.robustness=null; state.portfolioOOS=null; state.migration=null; state.scenarioMatrix=null; renderView();
  }catch(e){alert(e.message);}
  finally{const b=document.querySelector('#runPyOpt');if(b){b.disabled=false;b.textContent=oldText||'RUN PORTFOLIOOPTIM EXACT';}}
}


function updateStrategyControls(){
  const method=document.querySelector('#optMethod')?.value||state.optimizationInputs.method;
  const show=(sel,on)=>{const el=document.querySelector(sel);if(el)el.style.display=on?'':'none';};
  show('.target-return-param',method==='efficient_return');
  show('.target-vol-param',method==='efficient_risk');
  show('.risk-aversion-param',method==='max_quadratic_utility');
  const help={
    max_sharpe:'Pure Tangency is the constrained maximum-Sharpe benchmark. If L2 Gamma > 0, the selected regularized Max-Sharpe portfolio is shown separately because regularization can move it away from geometric tangency.',
    min_volatility:'Finds the lowest-volatility portfolio subject to the active weight and factor constraints.',
    efficient_return:'Minimizes volatility for the specified annual target return.',
    efficient_risk:'Maximizes expected return for the specified annual target volatility.',
    max_quadratic_utility:'Balances expected return against variance using the Risk Aversion parameter.',
    risk_parity:'Targets equal or custom risk-contribution budgets rather than maximizing expected return.',
    hrp:'Hierarchical Risk Parity uses return clustering and does not require expected-return forecasts.',
    black_litterman:'Combines the historical-return prior with the absolute views entered below, then optimizes the posterior portfolio.',
    cla_min_volatility:'Critical Line Algorithm solution for minimum volatility.',
    cla_max_sharpe:'Critical Line Algorithm solution for maximum Sharpe.',
    min_semivariance:'Minimizes downside semivariance using historical returns.',
    min_cvar:'Minimizes Conditional Value at Risk (CVaR).',
    min_cdar:'Minimizes Conditional Drawdown at Risk (CDaR).'
  };
  const box=document.querySelector('#strategyHelp');if(box)box.textContent=help[method]||'';
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


function advancedStrategyRows(){
  return strategyComparisonRows(state.optimization,state.optimizerExact);
}
function strategyRowByKey(key){return advancedStrategyRows().find(x=>x.key===key)||advancedStrategyRows()[0]||null;}
function exactBenchmarkByKey(key){
  const b=state.optimizerExact?.benchmarks||{};
  if(key==='max_sharpe')return b.max_sharpe;
  if(key==='min_volatility')return b.min_volatility;
  if(key==='risk_parity')return b.risk_parity;
  if(key==='black_litterman')return b.black_litterman;
  return null;
}
function mapWeightsFromRow(row){return row?mapFromVector(state.selectedUniverse,row.weights):{};}
function commonMuCov(){
  const ex=state.optimizerExact;if(!ex)return null;
  const mu=state.selectedUniverse.map(t=>Number(ex.expected_returns?.[t]));
  const cov=state.selectedUniverse.map(r=>state.selectedUniverse.map(c=>Number(ex.covariance?.[r]?.[c])));
  return mu.every(Number.isFinite)&&cov.every(r=>r.every(Number.isFinite))?{mu,cov}:null;
}

function robustnessView(){
  if(!state.optimizerExact)return `<div class="panel"><h3>ROBUSTNESS & STABILITY LAB</h3><p class="sub">Run PortfolioOPTIM Exact first. Robustness uses the same validated price matrix and active constraints, then perturbs return/risk estimators and bootstrap samples.</p></div>`;
  const r=state.robustness, sum=r?.summary||{};
  const grid=(r?.model_grid||[]).map(x=>x.error?`<tr><td>${x.return_model}</td><td>${x.risk_model}</td><td colspan="4">${x.error}</td></tr>`:`<tr><td>${x.return_model}</td><td>${x.risk_model}</td><td>${fmtPct(x.performance?.expected_return)}</td><td>${fmtPct(x.performance?.volatility)}</td><td>${fmtNum(x.performance?.sharpe,2)}</td><td>${fmtNum(Object.values(x.weights||{}).filter(Number.isFinite).length,0)}</td></tr>`).join('');
  const wt=state.selectedUniverse.map(t=>`<tr><td>${t}</td><td>${fmtPct(sum.mean_weights?.[t])}</td><td>${fmtPct(sum.weight_std?.[t])}</td><td>${fmtPct(sum.p10_weights?.[t])}</td><td>${fmtPct(sum.p90_weights?.[t])}</td></tr>`).join('');
  return `<div class="panel"><div class="frontier-head"><div><h3>ROBUST OPTIMIZATION & PARAMETER STABILITY</h3><p class="sub">Tests estimator sensitivity across expected-return/covariance model combinations and bootstrap resamples. The stable baseline remains unchanged until you explicitly run this lab.</p></div><span class="engine-badge ${r?'live':'preview'}">${r?'ROBUSTNESS LIVE':'READY'}</span></div>
    <div class="portfolio-controls"><label>Strategy<select id="robustStrategy"><option value="max_sharpe" ${state.robustnessInputs.strategy==='max_sharpe'?'selected':''}>Maximum Sharpe</option><option value="min_volatility" ${state.robustnessInputs.strategy==='min_volatility'?'selected':''}>Minimum Volatility</option><option value="risk_parity" ${state.robustnessInputs.strategy==='risk_parity'?'selected':''}>Risk Parity</option><option value="black_litterman" ${state.robustnessInputs.strategy==='black_litterman'?'selected':''}>Black–Litterman</option></select></label><label>Bootstrap Samples<input id="robustBoot" type="number" min="0" max="40" step="5" value="${state.robustnessInputs.bootstrapCount}"></label><button id="runRobustness">RUN ROBUSTNESS</button></div>
    <p class="sub">Model grid: historical mean / EMA / CAPM × Ledoit–Wolf / Sample / EWMA covariance. Bootstrap weights are solved on resampled real-return histories; no synthetic market assumptions are used beyond resampling observed returns.</p></div>
    ${r?`<div class="grid kpis four" style="margin-top:12px">${[['STABILITY SCORE',fmtPct(sum.stability_score)],['MEAN L1 DISTANCE',fmtPct(sum.mean_l1_distance)],['BOOTSTRAPS',r.bootstrap_successes??0],['ROBUST RETURN',fmtPct(sum.common_performance?.expected_return)],['ROBUST VOL',fmtPct(sum.common_performance?.volatility)],['ROBUST SHARPE',fmtNum(sum.common_performance?.sharpe,2)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div>
    <div class="grid two"><div class="panel"><h3>MODEL GRID</h3><div class="table-scroll"><table><thead><tr><th>Return Model</th><th>Risk Model</th><th>Return</th><th>Vol</th><th>Sharpe</th><th>Assets</th></tr></thead><tbody>${grid}</tbody></table></div></div><div class="panel"><h3>RESAMPLED WEIGHT ENVELOPE</h3><div id="robustnessWeights" class="chart"></div></div></div><div class="panel" style="margin-top:12px"><h3>RESAMPLED EFFICIENT FRONTIER ENVELOPE</h3><p class="sub">Bootstrap-resampled exact frontiers show the uncertainty band around the mean risk/return frontier. The displayed band is diagnostic, not a forecast distribution.</p><div id="robustFrontier" class="chart robust-frontier-chart"></div></div>
    <div class="panel" style="margin-top:12px"><h3>WEIGHT STABILITY BANDS</h3><div class="table-scroll"><table><thead><tr><th>Asset</th><th>Mean</th><th>Std</th><th>P10</th><th>P90</th></tr></thead><tbody>${wt}</tbody></table></div></div>`:''}`;
}

async function runRobustness(){
  try{
    if(!state.lastOptimizerRequest)throw new Error('Run PortfolioOPTIM Exact first so robustness can reuse the exact validated request.');
    state.robustnessInputs.strategy=document.querySelector('#robustStrategy')?.value||state.robustnessInputs.strategy;
    state.robustnessInputs.bootstrapCount=Math.max(0,Math.min(40,Number(document.querySelector('#robustBoot')?.value||20)));
    const body={request:{...state.lastOptimizerRequest,method:state.robustnessInputs.strategy,l2_gamma:0},strategy:state.robustnessInputs.strategy,return_models:['historical_mean','ema_mean','capm'],risk_models:['ledoit_wolf','sample_cov','ewma_cov'],bootstrap_count:state.robustnessInputs.bootstrapCount,bootstrap_seed:2026};
    const r=await fetch('/api/portfolio-advanced?action=robustness',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const raw=await r.text();let x;try{x=JSON.parse(raw)}catch{throw new Error(`Robustness returned non-JSON (HTTP ${r.status}).`)}if(!r.ok)throw new Error(x.error||x.detail||'Robustness failed');state.robustness=x;renderView();
  }catch(e){alert(e.message);}
}

function migrationView(){
  if(!state.optimizerExact)return `<div class="panel"><h3>CURRENT → TARGET MIGRATION</h3><p class="sub">Run PortfolioOPTIM Exact first to create target portfolios.</p></div>`;
  const rows=advancedStrategyRows().filter(x=>x.kind==='optimizer');
  const m=state.migration;
  return `<div class="panel"><h3>CURRENT PORTFOLIO → TARGET PORTFOLIO MIGRATION</h3><div class="portfolio-controls"><label>Current Weights<input id="migrationCurrent" value="${state.currentWeightsText||''}" placeholder="SPY:30,GC=F:10,IEF:20..."></label><label>Target Strategy<select id="migrationTarget">${rows.map(r=>`<option value="${r.key}" ${state.migrationTarget===r.key?'selected':''}>${r.label}</option>`).join('')}</select></label><label>Portfolio Value<input id="migrationValue" type="number" value="${state.advancedConstraints.portfolioValue}"></label><label>Cost (bp)<input id="migrationCost" type="number" min="0" value="${state.comparisonInputs.costBps}"></label><button id="runMigration">BUILD TRADE LIST</button></div><p class="sub">Trade notional = target weight minus current weight × portfolio value. Estimated transaction cost uses the entered one-way basis-point assumption on gross turnover.</p></div>
  ${m?`<div class="grid kpis four" style="margin-top:12px">${[['TURNOVER',fmtPct(m.turnover)],['EST. COST',fmtMoney(m.cost)],['CURRENT RETURN',fmtPct(m.currentPerformance?.ret)],['TARGET RETURN',fmtPct(m.targetPerformance?.ret)],['CURRENT VOL',fmtPct(m.currentPerformance?.vol)],['TARGET VOL',fmtPct(m.targetPerformance?.vol)],['CURRENT SHARPE',fmtNum(m.currentPerformance?.sharpe,2)],['TARGET SHARPE',fmtNum(m.targetPerformance?.sharpe,2)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div><div class="panel" style="margin-top:12px"><h3>IMPLEMENTATION TRADE LIST</h3><div class="table-scroll"><table><thead><tr><th>Asset</th><th>Current</th><th>Target</th><th>Δ Weight</th><th>Action</th><th>Notional</th></tr></thead><tbody>${m.trades.map(x=>`<tr><td>${x.ticker}</td><td>${fmtPct(x.current)}</td><td>${fmtPct(x.target)}</td><td>${fmtPct(x.delta)}</td><td>${x.action}</td><td>${fmtMoney(x.notional)}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
}
function runMigration(){
  try{
    state.currentWeightsText=document.querySelector('#migrationCurrent')?.value||state.currentWeightsText;state.migrationTarget=document.querySelector('#migrationTarget')?.value||state.migrationTarget;state.advancedConstraints.portfolioValue=Number(document.querySelector('#migrationValue')?.value||state.advancedConstraints.portfolioValue);state.comparisonInputs.costBps=Number(document.querySelector('#migrationCost')?.value||state.comparisonInputs.costBps);
    const row=strategyRowByKey(state.migrationTarget);if(!row)throw new Error('Target strategy unavailable.');const current=parseWeightText(state.currentWeightsText,state.selectedUniverse),target=mapWeightsFromRow(row),mc=commonMuCov();state.migration=migrationAnalysis(state.selectedUniverse,current,target,state.advancedConstraints.portfolioValue,state.comparisonInputs.costBps,mc?.mu,mc?.cov,state.optimizationInputs.rf);renderView();
  }catch(e){alert(e.message);}
}

function riskDecompositionDesk(){
  if(!state.optimizerExact)return '';
  const rows=advancedStrategyRows().filter(x=>x.kind==='optimizer');const row=rows.find(x=>x.key===state.riskStrategy)||rows[0];if(!row)return '';
  const b=exactBenchmarkByKey(row.key);const rd=b?.risk_decomposition||state.optimizerExact?.risk_decomposition;const mc=commonMuCov();const local=rd?null:riskDecompositionLocal(state.selectedUniverse,mapWeightsFromRow(row),mc?.cov);const rc=rd?.risk_contribution_pct||Object.fromEntries(state.selectedUniverse.map((t,i)=>[t,local?.rcPct?.[i]]));const mrc=rd?.marginal_risk_contribution||Object.fromEntries(state.selectedUniverse.map((t,i)=>[t,local?.mrc?.[i]]));const clusters=rd?.correlation_clusters||{};
  return `<div class="panel" style="margin-top:12px"><div class="frontier-head"><div><h3>RISK DECOMPOSITION DESK</h3><p class="sub">Marginal and total risk contributions use the PortfolioOPTIM covariance model selected in Optimization.</p></div><label>Strategy<select id="riskStrategySelect">${rows.map(x=>`<option value="${x.key}" ${x.key===row.key?'selected':''}>${x.label}</option>`).join('')}</select></label></div><div class="grid kpis four">${[['PORTFOLIO VOL',fmtPct(rd?.performance?.volatility??local?.vol)],['EFFECTIVE N',fmtNum(rd?.effective_n??local?.effectiveN,2)],['DIVERSIFICATION RATIO',fmtNum(rd?.diversification_ratio??local?.diversificationRatio,2)],['HHI',fmtNum(rd?.hhi??local?.hhi,3)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div><div class="table-scroll" style="margin-top:12px"><table><thead><tr><th>Asset</th><th>Weight</th><th>Marginal RC</th><th>Risk Contribution</th><th>Correlation Cluster</th></tr></thead><tbody>${state.selectedUniverse.map((t,i)=>`<tr><td>${t}</td><td>${fmtPct(row.weights[i])}</td><td>${fmtNum(Number(mrc?.[t]),4)}</td><td>${fmtPct(Number(rc?.[t]))}</td><td>${clusters?.[t]??'N/A'}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function strategyScenarioDesk(){
  if(!state.optimizerExact)return '';
  const rows=advancedStrategyRows().filter(x=>x.kind==='optimizer'||x.key==='equal_weight');
  const mc=commonMuCov();
  const matrix=strategyScenarioMatrix(state.selectedUniverse,rows,mc?.cov);state.scenarioMatrix=matrix;
  const scenarios=matrix.map(x=>x.scenario);
  if(!scenarios.includes(state.scenarioSelection.scenario))state.scenarioSelection.scenario=scenarios[0]||'';
  if(!rows.some(x=>x.key===state.scenarioSelection.strategy))state.scenarioSelection.strategy=rows[0]?.key||'';
  const selected=matrix.find(x=>x.scenario===state.scenarioSelection.scenario)||matrix[0];
  const selectedValue=selected?.values?.find(x=>x.key===state.scenarioSelection.strategy)||selected?.values?.[0];
  const unmapped=[...new Set(matrix.flatMap(x=>x.unmapped||[]))];
  const mappingBadge=unmapped.length?`<span class="engine-badge warning">UNMAPPED ${unmapped.length}</span>`:`<span class="engine-badge live">MAPPING PASS</span>`;
  const attributionRows=(selectedValue?.contributions||[]).map(x=>`<tr><td>${x.ticker}</td><td>${x.assetClass}</td><td>${x.group}</td><td>${fmtPct(x.weight)}</td><td>${fmtPct(x.shock)}</td><td>${fmtPct(x.contribution)}</td><td class="${x.mapped?'stress-mapped':'stress-unmapped'}">${x.mapped?'MAPPED':'UNMAPPED'}</td></tr>`).join('');
  const riskCells=(v,sc)=>sc.correlationTarget!=null?`<div class="stress-cell-main">${fmtPct(v.return)}</div><div class="stress-cell-sub">Vol ${fmtPct(v.baseVol)} → ${fmtPct(v.stressedVol)}</div>`:`<div class="stress-cell-main">${fmtPct(v.return)}</div>`;
  return `<div class="panel stress-strategy-panel" style="margin-top:12px"><div class="frontier-head"><div><h3>STRATEGY SCENARIO MATRIX</h3><p class="sub">Each deterministic scenario is applied asset-by-asset, then aggregated as Σ(weight × asset shock). Correlation Spike keeps deterministic return at 0% and recomputes strategy volatility from a stressed covariance matrix.</p></div>${mappingBadge}</div><div class="table-scroll"><table><thead><tr><th>Scenario</th>${rows.map(r=>`<th>${r.label}</th>`).join('')}<th>Risk Overlay</th></tr></thead><tbody>${matrix.map(sc=>`<tr><td><b>${sc.scenario}</b><div class="sub">${sc.description}</div></td>${sc.values.map(v=>`<td>${riskCells(v,sc)}</td>`).join('')}<td>${sc.correlationTarget!=null?`ρ target ${fmtNum(sc.correlationTarget,2)} • blend ${fmtPct(sc.correlationBlend)} • asset vol ×${fmtNum(sc.volMultiplier,2)}`:'—'}</td></tr>`).join('')}</tbody></table></div>${unmapped.length?`<p class="stress-warning"><strong>UNMAPPED ASSETS:</strong> ${unmapped.join(', ')}. Their deterministic shock defaults to the explicit fallback classification and should be reviewed before relying on the scenario.</p>`:''}</div>
  <div class="panel stress-attribution-panel" style="margin-top:12px"><div class="frontier-head"><div><h3>SCENARIO ATTRIBUTION</h3><p class="sub">Audit trail for the selected strategy/scenario. Portfolio shock must equal the sum of asset-level contributions.</p></div><span class="engine-badge live">WEIGHTED P&amp;L</span></div><div class="portfolio-controls"><label>Scenario<select id="stressScenarioSelect">${matrix.map(sc=>`<option value="${sc.scenario}" ${state.scenarioSelection.scenario===sc.scenario?'selected':''}>${sc.scenario}</option>`).join('')}</select></label><label>Strategy<select id="stressStrategySelect">${rows.map(r=>`<option value="${r.key}" ${state.scenarioSelection.strategy===r.key?'selected':''}>${r.label}</option>`).join('')}</select></label></div><div class="grid kpis four" style="margin-top:10px">${[['PORTFOLIO SHOCK',fmtPct(selectedValue?.return)],['BASE VOL',fmtPct(selectedValue?.baseVol)],['STRESSED VOL',fmtPct(selectedValue?.stressedVol)],['Δ VOL',fmtPct(selectedValue?.deltaVol)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div><div class="table-scroll" style="margin-top:10px"><table><thead><tr><th>Asset</th><th>Asset Class</th><th>Group</th><th>Weight</th><th>Shock</th><th>Contribution</th><th>Mapping</th></tr></thead><tbody>${attributionRows}</tbody><tfoot><tr><td colspan="5"><strong>Portfolio Total</strong></td><td><strong>${fmtPct(selectedValue?.return)}</strong></td><td>${unmapped.length?'REVIEW':'PASS'}</td></tr></tfoot></table></div><p class="sub">For deterministic shocks, stressed return = Σ wᵢsᵢ. Correlation Spike is a risk-only overlay: return shock remains 0 while stressed volatility is recomputed from the stressed covariance matrix.</p></div>`;
}

function regimeAllocationPanel(){
  const r=regimeDiagnostic(state.metrics);const p=regimeConstraintPreset(r.preset);
  return `<div class="panel" style="margin-top:12px"><div class="frontier-head"><div><h3>REGIME-AWARE ALLOCATION OVERLAY</h3><p class="sub">Regime classification is descriptive. It does not automatically change portfolio weights; applying a preset only populates transparent constraint controls in Optimization.</p></div><span class="engine-badge ${r.name==='RISK-OFF'?'preview':'live'}">${r.name}</span></div><div class="grid kpis four">${[['REGIME SCORE',fmtNum(r.score,0)],['PRESET',r.preset.toUpperCase()],['EQUITY MIN',fmtPct(p.equityMin)],['BOND MIN',fmtPct(p.bondMin)],['COMMODITY MAX',fmtPct(p.commodityMax)],['MIN EFFECTIVE N',fmtNum(p.minEffectiveN,1)]].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div><p class="sub">${r.notes.join(' ')||'No strong regime signal.'}</p><button id="applyRegimePreset" data-preset="${r.preset}">APPLY ${r.preset.toUpperCase()} CONSTRAINT PRESET</button></div>`;
}
function applyRegimePreset(){const preset=document.querySelector('#applyRegimePreset')?.dataset.preset||'balanced';state.advancedConstraints={...state.advancedConstraints,...regimeConstraintPreset(preset)};state.active='OPTIMIZATION';renderView();}

function frontierDiagnosticsPanel(){
  const ex=state.optimizerExact;if(!ex?.frontier?.length)return '';
  const rows=advancedStrategyRows();const d=frontierDiagnostics(ex.frontier,rows);return `<div class="panel" style="margin-top:12px"><h3>EFFICIENT FRONTIER DIAGNOSTICS</h3><div class="grid kpis four"><div class="kpi"><div class="label">MEDIAN CURVATURE</div><div class="num smallnum">${fmtNum(d.curvature,3)}</div></div><div class="kpi"><div class="label">FRONTIER POINTS</div><div class="num smallnum">${ex.frontier.length}</div></div><div class="kpi"><div class="label">MODEL</div><div class="num smallnum">${ex.model_spec?.risk_model||'N/A'}</div></div><div class="kpi"><div class="label">RETURN ESTIMATOR</div><div class="num smallnum">${ex.model_spec?.expected_return_model||'N/A'}</div></div></div><div class="table-scroll" style="margin-top:12px"><table><thead><tr><th>Strategy</th><th>Return Gap to Frontier at Same Vol</th><th>Interpretation</th></tr></thead><tbody>${d.efficiency.map(x=>`<tr><td>${x.label}</td><td>${fmtPct(x.gap)}</td><td>${Number.isFinite(x.gap)&&Math.abs(x.gap)<0.0005?'Near mean-variance frontier':'Different objective / off-frontier'}</td></tr>`).join('')}</tbody></table></div><p class="sub">Risk Parity and Black–Litterman are not required to lie on the classical mean-variance frontier because their objectives differ.</p></div>`;
}

function portfolioOOSSection(){
  const o=state.portfolioOOS;const metrics=o?.metrics||{};const labels={max_sharpe:'Maximum Sharpe',min_volatility:'Minimum Volatility',risk_parity:'Risk Parity',black_litterman:'Black–Litterman',equal_weight:'Equal Weight'};
  return `<div class="panel" style="margin-top:16px"><div class="frontier-head"><div><h3>PORTFOLIO STRATEGY WALK-FORWARD / OOS</h3><p class="sub">Each fold estimates portfolio weights on the training window only, locks those weights, and evaluates the next untouched test window with common transaction-cost assumptions.</p></div><span class="engine-badge ${o?'live':'preview'}">${o?'OOS LIVE':'READY'}</span></div><div class="portfolio-controls"><label>Train Days<input id="pWfTrain" type="number" min="252" step="21" value="${state.portfolioOOSInputs.train}"></label><label>Test Days<input id="pWfTest" type="number" min="21" step="21" value="${state.portfolioOOSInputs.test}"></label><label>Step Days<input id="pWfStep" type="number" min="21" step="21" value="${state.portfolioOOSInputs.step}"></label><label>Max Folds<input id="pWfFolds" type="number" min="1" max="20" value="${state.portfolioOOSInputs.folds}"></label><label>Cost bp<input id="pWfCost" type="number" min="0" value="${state.portfolioOOSInputs.costBps}"></label><button id="runPortfolioOOS">RUN PORTFOLIO OOS</button></div></div>
  ${o?`<div class="grid two"><div class="panel"><h3>OUT-OF-SAMPLE STRATEGY NAV</h3><div id="portfolioOosNav" class="chart"></div></div><div class="panel"><h3>OOS SCORECARD</h3><div class="table-scroll"><table><thead><tr><th>Strategy</th><th>CAGR</th><th>Vol</th><th>Sharpe</th><th>Sortino</th><th>Max DD</th><th>Turnover</th></tr></thead><tbody>${Object.entries(metrics).map(([k,m])=>`<tr><td>${labels[k]||k}</td><td>${fmtPct(m.cagr)}</td><td>${fmtPct(m.volatility)}</td><td>${fmtNum(m.sharpe,2)}</td><td>${fmtNum(m.sortino,2)}</td><td>${fmtPct(m.max_drawdown)}</td><td>${fmtPct(m.annualized_turnover)}</td></tr>`).join('')}</tbody></table></div></div></div>`:''}`;
}
async function runPortfolioOOS(){
  try{if(!state.lastOptimizerRequest)throw new Error('Run PortfolioOPTIM Exact first.');state.portfolioOOSInputs.train=Number(document.querySelector('#pWfTrain')?.value||756);state.portfolioOOSInputs.test=Number(document.querySelector('#pWfTest')?.value||63);state.portfolioOOSInputs.step=Number(document.querySelector('#pWfStep')?.value||63);state.portfolioOOSInputs.folds=Number(document.querySelector('#pWfFolds')?.value||10);state.portfolioOOSInputs.costBps=Number(document.querySelector('#pWfCost')?.value||10);const body={request:{...state.lastOptimizerRequest,l2_gamma:0},train_days:state.portfolioOOSInputs.train,test_days:state.portfolioOOSInputs.test,step_days:state.portfolioOOSInputs.step,max_folds:state.portfolioOOSInputs.folds,cost_bps:state.portfolioOOSInputs.costBps,strategies:['max_sharpe','min_volatility','risk_parity','black_litterman','equal_weight']};const r=await fetch('/api/portfolio-advanced?action=walkforward',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const raw=await r.text();let x;try{x=JSON.parse(raw)}catch{throw new Error(`Walk-forward returned non-JSON (HTTP ${r.status}).`)}if(!r.ok)throw new Error(x.error||x.detail||'Walk-forward failed');state.portfolioOOS=x;renderView();}catch(e){alert(e.message);}
}

function decisionDeskView(){
  if(!state.optimizerExact)return `<div class="panel"><h3>EXECUTIVE PORTFOLIO DECISION DESK</h3><p class="sub">Run PortfolioOPTIM Exact first. This desk summarizes the selected target, implementation gap, robustness, OOS validation, scenarios and binding constraints without changing the portfolio automatically.</p></div>`;
  const row=strategyRowByKey(state.migrationTarget)||advancedStrategyRows()[0];const current=parseWeightText(state.currentWeightsText,state.selectedUniverse);const mc=commonMuCov();const mig=migrationAnalysis(state.selectedUniverse,current,mapWeightsFromRow(row),state.advancedConstraints.portfolioValue,state.comparisonInputs.costBps,mc?.mu,mc?.cov,state.optimizationInputs.rf);const scen=strategyScenarioMatrix(state.selectedUniverse,[row]);const worst=scen.length?[...scen].sort((a,b)=>a.values[0].return-b.values[0].return)[0]:null;const diag=exactBenchmarkByKey(row.key)?.constraint_diagnostics||state.optimizerExact.constraint_diagnostics||{};const oos=state.portfolioOOS?.metrics?.[row.key];const robust=state.robustness?.summary;
  return `<div class="panel"><div class="frontier-head"><div><h3>EXECUTIVE PORTFOLIO DECISION DESK</h3><p class="sub">Decision support only: the desk reports the selected strategy and implementation consequences; it does not auto-execute trades.</p></div><span class="engine-badge live">PORTFOLIOOPTIM v${state.optimizerExact.version||'LIVE'}</span></div><div class="portfolio-controls"><label>Target Strategy<select id="decisionTarget">${advancedStrategyRows().filter(x=>x.kind==='optimizer').map(x=>`<option value="${x.key}" ${row.key===x.key?'selected':''}>${x.label}</option>`).join('')}</select></label><button id="refreshDecisionDesk">REFRESH DESK</button></div></div>
  <div class="grid kpis four" style="margin-top:12px">${[['TARGET RETURN',fmtPct(row.ret)],['TARGET VOL',fmtPct(row.vol)],['TARGET SHARPE',fmtNum(row.sharpe,2)],['TURNOVER',fmtPct(mig.turnover)],['EST. COST',fmtMoney(mig.cost)],['ROBUST STABILITY',fmtPct(robust?.stability_score)],['OOS SHARPE',fmtNum(oos?.sharpe,2)],['WORST SCENARIO',worst?`${worst.scenario} ${fmtPct(worst.values[0].return)}`:'N/A']].map(([a,b])=>`<div class="kpi"><div class="label">${a}</div><div class="num smallnum">${b}</div></div>`).join('')}</div>
  <div class="grid two"><div class="panel"><h3>IMPLEMENTATION SUMMARY</h3><table><tbody><tr><td>Target</td><td>${row.label}</td></tr><tr><td>Current portfolio supplied</td><td>${Object.values(current).some(x=>x>0)?'YES':'NO'}</td></tr><tr><td>Binding lower</td><td>${diag.binding_lower?.join(', ')||'None'}</td></tr><tr><td>Binding upper</td><td>${diag.binding_upper?.join(', ')||'None'}</td></tr><tr><td>Effective N</td><td>${fmtNum(exactBenchmarkByKey(row.key)?.risk_decomposition?.effective_n,2)}</td></tr><tr><td>Tracking Error</td><td>${fmtPct(diag.tracking_error)}</td></tr></tbody></table></div><div class="panel"><h3>VALIDATION STATUS</h3><table><tbody><tr><td>Common-basis model</td><td>${state.optimizerExact.model_spec?.risk_model||'N/A'}</td></tr><tr><td>Walk-forward OOS</td><td>${oos?'AVAILABLE':'NOT RUN'}</td></tr><tr><td>Robustness</td><td>${robust?'AVAILABLE':'NOT RUN'}</td></tr><tr><td>Black–Litterman views</td><td>${state.optimizerExact.benchmarks?.black_litterman?'AVAILABLE':state.optimizerExact.benchmarks?.black_litterman_error||'NOT SUPPLIED'}</td></tr><tr><td>Worst scenario</td><td>${worst?`${worst.scenario}: ${fmtPct(worst.values[0].return)}`:'N/A'}</td></tr></tbody></table></div></div>
  <div class="panel" style="margin-top:12px"><h3>TOP IMPLEMENTATION TRADES</h3><div class="table-scroll"><table><thead><tr><th>Asset</th><th>Action</th><th>Δ Weight</th><th>Notional</th></tr></thead><tbody>${mig.trades.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,12).map(x=>`<tr><td>${x.ticker}</td><td>${x.action}</td><td>${fmtPct(x.delta)}</td><td>${fmtMoney(x.notional)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function refreshDecisionDesk(){state.migrationTarget=document.querySelector('#decisionTarget')?.value||state.migrationTarget;renderView();}


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
  else if (state.active === 'ROBUSTNESS') view.innerHTML = robustnessView();
  else if (state.active === 'MIGRATION') view.innerHTML = migrationView();
  else if (state.active === 'DECISION DESK') view.innerHTML = decisionDeskView();
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
  if (state.active === 'OPTIMIZATION') { document.querySelector('#runOptPreview')?.addEventListener('click', runOptPreview); document.querySelector('#runPyOpt')?.addEventListener('click', runPyOpt); document.querySelector('#optMethod')?.addEventListener('change',updateStrategyControls); document.querySelector('#cmpRebalance')?.addEventListener('change',e=>{state.comparisonInputs.rebalance=e.target.value;renderView();}); document.querySelector('#cmpInitialBasis')?.addEventListener('change',e=>{state.comparisonInputs.initialBasis=e.target.value;renderView();}); document.querySelector('#cmpCostBps')?.addEventListener('change',e=>{state.comparisonInputs.costBps=Math.max(0,Number(e.target.value)||0);renderView();}); updateStrategyControls(); checkQuantServiceStatus(); }
  if (state.active === 'ROBUSTNESS') document.querySelector('#runRobustness')?.addEventListener('click',runRobustness);
  if (state.active === 'MIGRATION') document.querySelector('#runMigration')?.addEventListener('click',runMigration);
  if (state.active === 'DECISION DESK') { document.querySelector('#refreshDecisionDesk')?.addEventListener('click',refreshDecisionDesk); document.querySelector('#decisionTarget')?.addEventListener('change',refreshDecisionDesk); }
  if (state.active === 'MARKET REGIME') document.querySelector('#applyRegimePreset')?.addEventListener('click',applyRegimePreset);
  if (state.active === 'RISK') document.querySelector('#riskStrategySelect')?.addEventListener('change',e=>{state.riskStrategy=e.target.value;renderView();});
  if (state.active === 'RESEARCH' || state.active === 'THESIS') { document.querySelector('#loadResearch')?.addEventListener('click', loadResearch); document.querySelector('#runResearchHealth')?.addEventListener('click', runResearchHealth); document.querySelector('#saveThesis')?.addEventListener('click', saveThesis); }
  if (state.active === 'STRESS') {
    document.querySelector('#runStress')?.addEventListener('click', runStress);
    document.querySelector('#runReplay')?.addEventListener('click', runReplay);
    document.querySelector('#stressScenarioSelect')?.addEventListener('change',e=>{state.scenarioSelection.scenario=e.target.value;renderView();});
    document.querySelector('#stressStrategySelect')?.addEventListener('change',e=>{state.scenarioSelection.strategy=e.target.value;renderView();});
  }
  if (state.active === 'BACKTEST') document.querySelector('#runBacktest')?.addEventListener('click', runBacktest);
  if (state.active === 'WALK-FORWARD') { document.querySelector('#runWalk')?.addEventListener('click', runWalkForward); document.querySelector('#runPortfolioOOS')?.addEventListener('click',runPortfolioOOS); }
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
  const model=commonOptimizationModel(o,ex);
  const finite=p=>Number.isFinite(p?.vol)&&Number.isFinite(p?.ret);
  // Re-score sampled feasible portfolios on the same PortfolioOPTIM model used by
  // the exact frontier whenever the backend model matrix is available.
  const rescored=(o.points||[]).map(p=>p?.w?{...portfolioPointFromWeights(p.w,model),w:p.w}:p).filter(finite);
  rescored.sort((a,b)=>a.vol-b.vol);
  const sampledFrontier=[]; let best=-Infinity;
  for(const p of rescored){if(p.ret>best){sampledFrontier.push(p);best=p.ret;}}
  const step=Math.max(1,Math.ceil(rescored.length/360));
  const cloud=rescored.filter((_,i)=>i%step===0).map(p=>[p.vol,p.ret,p.sharpe]);
  const ef=sampledFrontier.map(p=>[p.vol,p.ret,p.sharpe]);
  const exact=(ex?.frontier||[])
    .filter(p=>Number.isFinite(p?.volatility)&&Number.isFinite(p?.return))
    .sort((a,b)=>a.volatility-b.volatility)
    .map(p=>[p.volatility,p.return,p.sharpe]);

  const eqW=Array(state.selectedUniverse.length).fill(1/Math.max(1,state.selectedUniverse.length));
  const eq=portfolioPointFromWeights(eqW,model);
  const cur=portfolioPointFromWeights(selectedCurrentWeights(),model);
  const exactPoint=(ex?.performance&&Number.isFinite(ex.performance.volatility)&&Number.isFinite(ex.performance.expected_return))
    ? {vol:ex.performance.volatility,ret:ex.performance.expected_return,sharpe:ex.performance.sharpe}
    : null;
  const bench=ex?.benchmarks||{};
  const benchWeights=x=>state.selectedUniverse.map(t=>Number(x?.weights?.[t]||0));
  const pickPerf=x=>{const p=canonicalStrategyPerf(x);return p&&Number.isFinite(p.vol)&&Number.isFinite(p.ret)?{vol:p.vol,ret:p.ret,sharpe:p.sharpe}:null;};
  const minVolExact=pickPerf(bench.min_volatility);
  const maxSharpeExact=pickPerf(bench.max_sharpe);
  // Risk Parity and Black-Litterman are re-scored on the common base model for
  // placement relative to the exact mean-variance frontier.
  const rpExact=bench.risk_parity?(pickPerf(bench.risk_parity)||portfolioPointFromWeights(benchWeights(bench.risk_parity),model)):null;
  const blExact=bench.black_litterman?(pickPerf(bench.black_litterman)||portfolioPointFromWeights(benchWeights(bench.black_litterman),model)):null;
  const tangent=maxSharpeExact||o.maxSharpe;
  const rf=Number(state.optimizationInputs.rf||0);

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
    {name:'Sampled Feasible Set',type:'scatter',symbolSize:2.2,data:cloud,itemStyle:{opacity:.045},emphasis:{itemStyle:{opacity:.32}},z:1},
    {name:'Sampled Frontier Envelope',type:'line',showSymbol:false,smooth:false,data:ef,lineStyle:{width:1,type:'dashed',opacity:hasExact?.18:.75},z:2}
  ];
  if(hasExact) series.push({name:'PortfolioOPTIM Exact Frontier',type:'line',showSymbol:false,smooth:false,connectNulls:false,lineStyle:{width:3.6,opacity:1},data:exact,z:9});

  const addPoint=(name,p,symbol,size,label,pos='top',z=12)=>{
    if(!p)return;
    series.push({
      name,type:'scatter',symbol,symbolSize:size,data:[[p.vol,p.ret,p.sharpe]],z,
      label:{show:true,position:pos,distance:10,formatter:label,fontWeight:700,fontSize:11,
        backgroundColor:'rgba(9,15,23,.76)',borderRadius:4,padding:[3,5]}
    });
  };
  addPoint('Minimum Volatility',minVolExact||o.minVol,'diamond',15,'MIN VOL','left',13);
  const nearReg=exactPoint&&ex?.method==='max_sharpe'&&Number(state.optimizationInputs.l2||0)>0&&maxSharpeExact&&Math.abs(exactPoint.vol-maxSharpeExact.vol)<0.012&&Math.abs(exactPoint.ret-maxSharpeExact.ret)<0.012;
  addPoint('Maximum Sharpe / Tangency',maxSharpeExact||o.maxSharpe,'circle',17,'TANGENCY',nearReg?'left':'top',14);
  if(eq)addPoint('Equal Weight',eq,'rect',12,'EQUAL WT','bottom',11);
  if(cur)addPoint('Current Portfolio',cur,'triangle',16,'CURRENT','right',15);
  if(rpExact)addPoint('Risk Parity — Common Model',rpExact,'roundRect',14,'RISK PARITY','bottom',13);
  if(blExact)addPoint('Black–Litterman — Common Model',blExact,'pin',18,'BLACK–LITTERMAN','right',13);
  if(exactPoint && ex?.method==='max_sharpe' && Number(state.optimizationInputs.l2||0)>0)
    addPoint('Selected Regularized Max Sharpe',exactPoint,'pin',18,'REG. MAX SHARPE',nearReg?'right':'right',15);
  else if(exactPoint && !['max_sharpe','min_volatility','risk_parity','black_litterman'].includes(ex?.method))
    addPoint(`Selected ${String(ex.method||'Optimizer').replaceAll('_',' ')}`,exactPoint,'pin',18,'SELECTED','top',14);
  if(cml.length)series.push({name:'Capital Market Line',type:'line',showSymbol:false,data:cml,lineStyle:{width:1.7,type:'dotted',opacity:.8},z:6});

  c.setOption({
    animation:false,
    tooltip:{trigger:'item',confine:true,backgroundColor:'rgba(8,14,22,.97)',borderWidth:1,
      formatter:p=>{const base=`<b>${p.seriesName}</b><br>Volatility ${(p.value[0]*100).toFixed(2)}%<br>Expected Return ${(p.value[1]*100).toFixed(2)}%${Number.isFinite(p.value[2])?`<br>Sharpe ${Number(p.value[2]).toFixed(2)}`:''}`;if(p.seriesName==='Maximum Sharpe / Tangency')return `${base}<br>Risk-free ${(rf*100).toFixed(2)}%<br><span style="opacity:.75">CML anchor • unregularized solution</span>`;if(p.seriesName==='Capital Market Line')return `${base}<br>Risk-free ${(rf*100).toFixed(2)}%`;return base;}},
    legend:{top:0,left:10,right:10,type:'plain',itemGap:12,itemWidth:16,itemHeight:8,textStyle:{color:muted,fontSize:10},selected:{'Sampled Feasible Set':false,'Sampled Frontier Envelope':true}},
    grid:{left:78,right:30,top:68,bottom:64},
    xAxis:{type:'value',name:'ANNUALIZED VOLATILITY',nameLocation:'middle',nameGap:44,min:axisXMin,max:axisXMax,splitNumber:5,
      axisLabel:{color:muted,formatter:v=>`${(v*100).toFixed(1)}%`},axisLine:{show:true,lineStyle:{color:grid}},splitLine:{lineStyle:{color:grid,type:'dashed',opacity:.7}}},
    yAxis:{type:'value',name:'EXPECTED RETURN',nameLocation:'middle',nameGap:56,min:axisYMin,max:axisYMax,splitNumber:5,
      axisLabel:{color:muted,formatter:v=>`${(v*100).toFixed(1)}%`},axisLine:{show:true,lineStyle:{color:grid}},splitLine:{lineStyle:{color:grid,type:'dashed',opacity:.7}}},
    series
  },true);
  requestAnimationFrame(()=>c.resize());
}


function robustFrontierChart(id, rows){
  const el=document.querySelector(id); if(!el||!Array.isArray(rows)||!rows.length)return;
  const {muted,grid}=baseAxis(); const c=echarts.init(el);
  const mean=rows.map(x=>[Number(x.mean_volatility),Number(x.mean_return)]).filter(x=>x.every(Number.isFinite));
  const low=rows.map(x=>[Number(x.p10_volatility),Number(x.p10_return)]).filter(x=>x.every(Number.isFinite));
  const high=rows.map(x=>[Number(x.p90_volatility),Number(x.p90_return)]).filter(x=>x.every(Number.isFinite));
  const all=[...mean,...low,...high]; if(!all.length)return;
  const xs=all.map(x=>x[0]), ys=all.map(x=>x[1]); const xp=Math.max((Math.max(...xs)-Math.min(...xs))*.10,.002); const yp=Math.max((Math.max(...ys)-Math.min(...ys))*.12,.002);
  c.setOption({animation:false,tooltip:{trigger:'item',formatter:p=>`<b>${p.seriesName}</b><br>Volatility ${(p.value[0]*100).toFixed(2)}%<br>Return ${(p.value[1]*100).toFixed(2)}%`},legend:{top:0,textStyle:{color:muted}},grid:{left:72,right:24,top:40,bottom:52},xAxis:{type:'value',name:'ANNUALIZED VOLATILITY',nameLocation:'middle',nameGap:36,min:Math.max(0,Math.min(...xs)-xp),max:Math.max(...xs)+xp,axisLabel:{color:muted,formatter:v=>`${(v*100).toFixed(1)}%`},splitLine:{lineStyle:{color:grid,type:'dashed'}}},yAxis:{type:'value',name:'EXPECTED RETURN',nameLocation:'middle',nameGap:48,min:Math.min(...ys)-yp,max:Math.max(...ys)+yp,axisLabel:{color:muted,formatter:v=>`${(v*100).toFixed(1)}%`},splitLine:{lineStyle:{color:grid,type:'dashed'}}},series:[{name:'Mean Frontier',type:'line',showSymbol:false,data:mean,lineStyle:{width:3}},{name:'P10 Envelope',type:'line',showSymbol:false,data:low,lineStyle:{width:1.4,type:'dashed',opacity:.7}},{name:'P90 Envelope',type:'line',showSymbol:false,data:high,lineStyle:{width:1.4,type:'dashed',opacity:.7}}]});
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
  if (state.active === 'WALK-FORWARD' && state.portfolioOOS) {
    const navSeries=[]; const labels={max_sharpe:'Maximum Sharpe',min_volatility:'Minimum Volatility',risk_parity:'Risk Parity',black_litterman:'Black–Litterman',equal_weight:'Equal Weight'};
    for(const [k,rs] of Object.entries(state.portfolioOOS.returns||{})){let v=1;navSeries.push({name:labels[k]||k,data:(rs||[]).map(r=>v*=1+Number(r||0))});}
    if(navSeries.length) lineChart('#portfolioOosNav',state.portfolioOOS.dates||[],navSeries,false);
  }
  if (state.active === 'ROBUSTNESS' && state.robustness?.summary) {
    const s=state.robustness.summary; barChart('#robustnessWeights',state.selectedUniverse,[{name:'Mean Weight',data:state.selectedUniverse.map(t=>Number(s.mean_weights?.[t]||0))},{name:'Weight Std',data:state.selectedUniverse.map(t=>Number(s.weight_std?.[t]||0))}],true);
    robustFrontierChart('#robustFrontier',state.robustness.resampled_frontier||[]);
  }
  if (state.active === 'FACTOR LAB' && state.factorResults.some(x=>x.result)) { factorExposureHeatmap('#factorHeatmap', state.factorResults.filter(x=>x.result)); if(state.factorPortfolio) barChart('#factorPortfolio', Object.keys(state.factorPortfolio), [{name:'Beta',data:Object.values(state.factorPortfolio)}], false); }
  if (state.active === 'OPTIMIZATION' && state.optimization) {
    frontierChart('#frontierChart', state.optimization, state.optimizerExact);
    if(state.optimizerExact){ strategyPathChart('#strategyNavChart',state.optimization,state.optimizerExact,'nav'); strategyPathChart('#strategyDrawdownChart',state.optimization,state.optimizerExact,'drawdown'); strategyHeatmap('#strategyWeightHeatmap',state.optimization,state.optimizerExact,'weights'); strategyHeatmap('#strategyRiskHeatmap',state.optimization,state.optimizerExact,'risk'); }
  }
}

renderView();
loadData();
