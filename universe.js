export const UNIVERSE = [
  // US equities / factor proxies
  {ticker:'AAPL',name:'Apple',region:'North America',country:'United States',assetClass:'Equity',group:'Technology',currency:'USD',factors:['Quality','Growth','Large Cap']},
  {ticker:'MSFT',name:'Microsoft',region:'North America',country:'United States',assetClass:'Equity',group:'Technology',currency:'USD',factors:['Quality','Growth','Large Cap']},
  {ticker:'NVDA',name:'NVIDIA',region:'North America',country:'United States',assetClass:'Equity',group:'Technology',currency:'USD',factors:['Growth','Momentum','Large Cap']},
  {ticker:'BRK-B',name:'Berkshire Hathaway',region:'North America',country:'United States',assetClass:'Equity',group:'Financials',currency:'USD',factors:['Quality','Value','Large Cap']},
  {ticker:'IWM',name:'iShares Russell 2000 ETF',region:'North America',country:'United States',assetClass:'Factor ETF',group:'Equity Factor',currency:'USD',factors:['Size','Small Cap']},
  {ticker:'VLUE',name:'iShares MSCI USA Value Factor ETF',region:'North America',country:'United States',assetClass:'Factor ETF',group:'Equity Factor',currency:'USD',factors:['Value']},
  {ticker:'QUAL',name:'iShares MSCI USA Quality Factor ETF',region:'North America',country:'United States',assetClass:'Factor ETF',group:'Equity Factor',currency:'USD',factors:['Quality','Profitability']},
  {ticker:'MTUM',name:'iShares MSCI USA Momentum Factor ETF',region:'North America',country:'United States',assetClass:'Factor ETF',group:'Equity Factor',currency:'USD',factors:['Momentum']},
  {ticker:'USMV',name:'iShares MSCI USA Min Vol Factor ETF',region:'North America',country:'United States',assetClass:'Factor ETF',group:'Equity Factor',currency:'USD',factors:['Low Volatility','Defensive']},
  {ticker:'SPY',name:'SPDR S&P 500 ETF',region:'North America',country:'United States',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market','Large Cap']},

  // Europe / UK / Switzerland
  {ticker:'VGK',name:'Vanguard FTSE Europe ETF',region:'Europe',country:'Pan-Europe',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market']},
  {ticker:'EWU',name:'iShares MSCI United Kingdom ETF',region:'Europe',country:'United Kingdom',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market']},
  {ticker:'EWL',name:'iShares MSCI Switzerland ETF',region:'Europe',country:'Switzerland',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Quality','Defensive']},
  {ticker:'FEZ',name:'SPDR Euro Stoxx 50 ETF',region:'Europe',country:'Euro Area',assetClass:'Equity ETF',group:'Large Cap',currency:'USD',factors:['Market','Large Cap']},

  // Asia Pacific / EM
  {ticker:'EWJ',name:'iShares MSCI Japan ETF',region:'Asia Pacific',country:'Japan',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market']},
  {ticker:'EWY',name:'iShares MSCI South Korea ETF',region:'Asia Pacific',country:'South Korea',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market']},
  {ticker:'EWA',name:'iShares MSCI Australia ETF',region:'Asia Pacific',country:'Australia',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market','Commodity Beta']},
  {ticker:'INDA',name:'iShares MSCI India ETF',region:'Asia Pacific',country:'India',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market','Growth']},
  {ticker:'MCHI',name:'iShares MSCI China ETF',region:'Asia Pacific',country:'China',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market']},
  {ticker:'EEM',name:'iShares MSCI Emerging Markets ETF',region:'Emerging Markets',country:'Multi-country',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market','EM']},
  {ticker:'EWZ',name:'iShares MSCI Brazil ETF',region:'Emerging Markets',country:'Brazil',assetClass:'Equity ETF',group:'Broad Market',currency:'USD',factors:['Market','Commodity Beta','Value']},

  // Turkey
  {ticker:'^XU100',name:'BIST 100 Index',region:'Emerging Markets',country:'Türkiye',assetClass:'Index',group:'Broad Market',currency:'TRY',factors:['Market','EM']},
  {ticker:'THYAO.IS',name:'Turkish Airlines',region:'Emerging Markets',country:'Türkiye',assetClass:'Equity',group:'Industrials',currency:'TRY',factors:['Cyclical','FX Sensitivity']},
  {ticker:'TURSG.IS',name:'Türkiye Sigorta',region:'Emerging Markets',country:'Türkiye',assetClass:'Equity',group:'Financials',currency:'TRY',factors:['Value','Financials']},

  // Fixed income proxies
  {ticker:'SHY',name:'iShares 1-3 Year Treasury Bond ETF',region:'North America',country:'United States',assetClass:'Bond ETF',group:'Government Bonds',currency:'USD',factors:['Rates','Short Duration','Defensive']},
  {ticker:'IEF',name:'iShares 7-10 Year Treasury Bond ETF',region:'North America',country:'United States',assetClass:'Bond ETF',group:'Government Bonds',currency:'USD',factors:['Rates','Duration','Defensive']},
  {ticker:'TLT',name:'iShares 20+ Year Treasury Bond ETF',region:'North America',country:'United States',assetClass:'Bond ETF',group:'Government Bonds',currency:'USD',factors:['Rates','Long Duration','Defensive']},
  {ticker:'TIP',name:'iShares TIPS Bond ETF',region:'North America',country:'United States',assetClass:'Bond ETF',group:'Inflation Linked Bonds',currency:'USD',factors:['Inflation Hedge','Rates','Defensive']},
  {ticker:'LQD',name:'iShares iBoxx Investment Grade Corporate Bond ETF',region:'North America',country:'United States',assetClass:'Bond ETF',group:'Credit',currency:'USD',factors:['Credit','Rates']},
  {ticker:'HYG',name:'iShares iBoxx High Yield Corporate Bond ETF',region:'North America',country:'United States',assetClass:'Bond ETF',group:'Credit',currency:'USD',factors:['Credit','Risk On']},

  // Precious metals
  {ticker:'GC=F',name:'Gold Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Precious Metals',currency:'USD',factors:['Gold','Inflation Hedge','Defensive']},
  {ticker:'SI=F',name:'Silver Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Precious Metals',currency:'USD',factors:['Silver','Precious Metals','Cyclical']},
  {ticker:'PL=F',name:'Platinum Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Precious Metals',currency:'USD',factors:['Platinum','Precious Metals','Cyclical']},
  {ticker:'GLD',name:'SPDR Gold Shares',region:'Global',country:'Global',assetClass:'Commodity ETF',group:'Precious Metals',currency:'USD',factors:['Gold','Inflation Hedge','Defensive']},
  {ticker:'SLV',name:'iShares Silver Trust',region:'Global',country:'Global',assetClass:'Commodity ETF',group:'Precious Metals',currency:'USD',factors:['Silver','Precious Metals']},

  // Miners
  {ticker:'GDX',name:'VanEck Gold Miners ETF',region:'Global',country:'Global',assetClass:'Mining ETF',group:'Gold Miners',currency:'USD',factors:['Gold Beta','Mining','Cyclical']},
  {ticker:'GDXJ',name:'VanEck Junior Gold Miners ETF',region:'Global',country:'Global',assetClass:'Mining ETF',group:'Gold Miners',currency:'USD',factors:['Gold Beta','Mining','Small Cap','High Beta']},
  {ticker:'COPX',name:'Global X Copper Miners ETF',region:'Global',country:'Global',assetClass:'Mining ETF',group:'Copper Miners',currency:'USD',factors:['Copper Beta','Mining','Cyclical']},
  {ticker:'PICK',name:'iShares MSCI Global Metals & Mining Producers ETF',region:'Global',country:'Global',assetClass:'Mining ETF',group:'Diversified Mining',currency:'USD',factors:['Mining','Commodity Beta','Cyclical']},

  // Industrial commodities / energy / agriculture
  {ticker:'HG=F',name:'Copper Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Industrial Metals',currency:'USD',factors:['Copper','Growth Beta','Cyclical']},
  {ticker:'ALI=F',name:'Aluminium Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Industrial Metals',currency:'USD',factors:['Aluminium','Growth Beta','Cyclical']},
  {ticker:'CL=F',name:'WTI Crude Oil Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Energy',currency:'USD',factors:['Energy','Inflation Beta','Cyclical']},
  {ticker:'BZ=F',name:'Brent Crude Oil Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Energy',currency:'USD',factors:['Energy','Inflation Beta','Cyclical']},
  {ticker:'NG=F',name:'Natural Gas Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Energy',currency:'USD',factors:['Energy','High Volatility']},
  {ticker:'ZC=F',name:'Corn Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Agriculture',currency:'USD',factors:['Agriculture','Inflation Beta']},
  {ticker:'ZW=F',name:'Wheat Futures',region:'Global',country:'Global',assetClass:'Commodity',group:'Agriculture',currency:'USD',factors:['Agriculture','Inflation Beta']},

  // FX / USD proxy
  {ticker:'DX-Y.NYB',name:'US Dollar Index',region:'Global',country:'Global',assetClass:'FX Index',group:'FX',currency:'USD',factors:['USD','Macro']}
];

export const FIELD_VALUES = {
  region: [...new Set(UNIVERSE.map(x => x.region))].sort(),
  assetClass: [...new Set(UNIVERSE.map(x => x.assetClass))].sort(),
  group: [...new Set(UNIVERSE.map(x => x.group))].sort(),
  factor: [...new Set(UNIVERSE.flatMap(x => x.factors))].sort()
};

export const PRESETS = {
  'Global Multi-Asset': ['SPY','VGK','EWJ','EEM','IEF','LQD','GC=F','HG=F','CL=F','DX-Y.NYB'],
  'Fama-French Style US Factors': ['SPY','IWM','VLUE','QUAL','MTUM','USMV'],
  'Precious Metals': ['GC=F','SI=F','PL=F','GLD','SLV'],
  'Metals & Miners': ['GC=F','SI=F','HG=F','GDX','GDXJ','COPX','PICK'],
  'Inflation Sensitive': ['GC=F','CL=F','HG=F','ZC=F','ZW=F','TIP'],
  'Defensive Diversifiers': ['IEF','TLT','GC=F','USMV','EWL'],
  'Türkiye Core': ['^XU100','THYAO.IS','TURSG.IS']
};

export function filterUniverse(filters = {}) {
  return UNIVERSE.filter(x => {
    if (filters.region && filters.region !== 'ALL' && x.region !== filters.region) return false;
    if (filters.assetClass && filters.assetClass !== 'ALL' && x.assetClass !== filters.assetClass) return false;
    if (filters.group && filters.group !== 'ALL' && x.group !== filters.group) return false;
    if (filters.factor && filters.factor !== 'ALL' && !x.factors.includes(filters.factor)) return false;
    const q = (filters.search || '').trim().toLowerCase();
    if (q && !`${x.ticker} ${x.name} ${x.country} ${x.group} ${x.factors.join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
