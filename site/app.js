const API_BASE = String(window.APP_CONFIG?.API_BASE_URL || localStorage.getItem("mk-api-base") || "http://localhost:8000").replace(/\/$/, "");
const TLREF_OFFICIAL_URL = "https://www.borsaistanbul.com/endeksler/tlref";
const TCMB_PKA_URL = "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB%2BTR/Main%2BMenu/Istatistikler/Egilim%2BAnketleri/Piyasa%2BKatilimcilari%2BAnketi";
const TCMB_EVDS_URL = "https://evds3.tcmb.gov.tr/";

const DEFAULT_TENORS = [
  ["ON",1],["1W",7],["1M",30],["3M",91],["6M",182],["9M",273],
  ["1Y",365],["15M",456],["2Y",730],["3Y",1095],["5Y",1825],["7Y",2555],["10Y",3650],
].map(([label,days])=>({label,days,base_rate:null,base_source:null,base_source_type:null,credit_spread:0,liquidity_premium:0,capital_charge:0,fee_equivalent:0}));
const DEFAULT_TENOR_LABELS = new Set(DEFAULT_TENORS.map(x=>x.label));


const DEFAULT_INPUT = {
  language:"en", investor_type:"corporate", loan_type:"commercial", pricing_mode:"tlref_spread", curve_mode:"tcmb_survey",
  principal:1000000, valuation_date:"2026-10-05", days:365, tlref:.368433, direct_loan_rate:.40, credit_spread:.00, inflation:.2370, inflation_12m_expectation:.2370,
  ten_year_bond_yield:.30, bsmv_rate:.05, kkdf_rate:.00, withholding_rate:.15, corporate_tax_rate:.25,
  lender_tax_rate:.30, deductible_ratio:1.00, upfront_fee_rate:.00, commission_rate:.00,
  lender_funding_rate:.33, lender_ecl_rate:.015, lender_opex_rate:.005, lender_capital_rate:.010,
  scenarios:[
    {name:"Bear", probability:.20, tlref:.32, credit_spread:.04, inflation:.38},
    {name:"Base", probability:.50, tlref:.40, credit_spread:.00, inflation:.30},
    {name:"Bull", probability:.30, tlref:.45, credit_spread:-.02, inflation:.25},
  ],
  tenor_points:DEFAULT_TENORS.map(x=>({...x})),
};

const I18N = {
  en:{executive:"EXECUTIVE DASHBOARD",inputs:"INPUT CENTER",tax:"TAX & REGULATORY",borrower:"BORROWER COST",investment:"INVESTMENT / TLREF",carry:"NET CARRY / BREAK-EVEN",lender:"LENDER ECONOMICS",curve:"LOAN YIELD CURVE",ladder:"MATURITY LADDER",scenarios:"SCENARIO LAB",sensitivity:"SENSITIVITY LAB",real:"INFLATION / REAL COST",methodology:"METHODOLOGY",sources:"SOURCES",export:"EXPORT CENTER",run:"RUN ANALYSIS",verified:"LAST VERIFIED",engine:"ENGINE STATUS",active:"ACTIVE",official:"OFFICIAL DEFAULT",sourceNote:"Official rates are embedded as defaults and remain user-overridable.",positive:"POSITIVE CARRY",negative:"NEGATIVE CARRY"},
  tr:{executive:"Y\u00d6NET\u0130C\u0130 PANEL\u0130",inputs:"G\u0130RD\u0130 MERKEZ\u0130",tax:"VERG\u0130 VE MEVZUAT",borrower:"KRED\u0130 KULLANAN",investment:"YATIRIM / TLREF",carry:"NET CARRY / BA\u015eABA\u015e",lender:"KRED\u0130 VEREN",curve:"KRED\u0130 VER\u0130M E\u011eR\u0130S\u0130",ladder:"VADE MERD\u0130VEN\u0130",scenarios:"SENARYO LAB",sensitivity:"DUYARLILIK LAB",real:"ENFLASYON / REEL MAL\u0130YET",methodology:"METODOLOJ\u0130",sources:"KAYNAKLAR",export:"DI\u015eARI AKTARIM",run:"ANAL\u0130Z\u0130 \u00c7ALI\u015eTIR",verified:"SON DO\u011eRULAMA",engine:"MOTOR DURUMU",active:"AKT\u0130F",official:"RESM\u0130 VARSAYILAN",sourceNote:"Resm\u00ee oranlar varsay\u0131lan olarak g\u00f6m\u00fcl\u00fcd\u00fcr; kullan\u0131c\u0131 isterse de\u011fi\u015ftirebilir.",positive:"POZ\u0130T\u0130F CARRY",negative:"NEGAT\u0130F CARRY"}
};

const NAV = ["executive","inputs","tax","borrower","investment","carry","lender","curve","ladder","scenarios","sensitivity","real","methodology","sources","export"];
const state = {
  language: localStorage.getItem("mk-lang") || "en",
  theme: localStorage.getItem("mk-theme") || "dark",
  active:"executive", input:JSON.parse(JSON.stringify(DEFAULT_INPUT)), result:null, taxRegistry:[], taxVerified:"2026-10-04", loading:false, error:"",
  marketTLREF:null, marketMacro:null, useOfficialTLREF:true, useOfficialInflation:true, tlrefRange:"1Y"
};
state.input.language = state.language;

function trPolish(s){
  const pairs=[
    ["KREDI","KRED\u0130"],["MALIYET","MAL\u0130YET"],["VERGI","VERG\u0130"],["EFEKTIF","EFEKT\u0130F"],
    ["GUVENLIK","G\u00dcVENL\u0130K"],["BASABAS","BA\u015eABA\u015e"],["GIRDI","G\u0130RD\u0130"],["FIYATLAMA","F\u0130YATLAMA"],
    ["TUKETICI","T\u00dcKET\u0130C\u0130"],["GERCEK KISI","GER\u00c7EK K\u0130\u015e\u0130"],["DOGRU","DO\u011eRU"],
    ["PESIN","PE\u015e\u0130N"],["UCRET","\u00dcCRET"],["LIKIDITE","L\u0130K\u0130D\u0130TE"],["DEGER","DE\u011eER"],
    ["YURURLUK","Y\u00dcR\u00dcRL\u00dcK"],["NAKIT","NAK\u0130T"],["KOPRUSU","K\u00d6PR\u00dcS\u00dc"],["GELIR","GEL\u0130R"],
    ["EKONOMIK","EKONOM\u0130K"],["MINIMUM","M\u0130N\u0130MUM"],["GENIS","GEN\u0130\u015e"],["EGRI","E\u011eR\u0130"],
    ["YUZEYI","Y\u00dcZEY\u0130"],["ESD.","E\u015eD."],["OLASILIK","OLASILIK"],["SONUCLARI","SONU\u00c7LARI"],
    ["HARITASI","HAR\u0130TASI"],["GORELI","G\u00d6REL\u0130"],["GETIRI","GET\u0130R\u0130"],["RESMI","RESM\u0130"],
    ["TEKNIK","TEKN\u0130K"],["TURKCE","T\u00dcRK\u00c7E"],["INGILIZCE","\u0130NG\u0130L\u0130ZCE"],
    ["degistirebilir","de\u011fi\u015ftirebilir"],["degistirilebilir","de\u011fi\u015ftirilebilir"],["Resmi","Resm\u00ee"],
    ["kullanici","kullan\u0131c\u0131"],["varsayilan","varsay\u0131lan"],["ayri","ayr\u0131"],["izlenir","izlenir"],
    ["sonrasi","sonras\u0131"],["yatirim","yat\u0131r\u0131m"],["asiyor","a\u015f\u0131yor"],["kalkani","kalkan\u0131"],
    ["yalnizca","yaln\u0131zca"],["indirilebilir","indirilebilir"],["kisminda","k\u0131sm\u0131nda"],["uygulanir","uygulan\u0131r"],
    ["duzeltilmis","d\u00fczeltilmi\u015f"],["agirlikli","a\u011f\u0131rl\u0131kl\u0131"],["haritasi","haritas\u0131"],
    ["acisindan","a\u00e7\u0131s\u0131ndan"],["kopru","k\u00f6pr\u00fc"],["Dogrudan","Do\u011frudan"],["bagimsiz","ba\u011f\u0131ms\u0131z"],
    ["edilir","edilir"],["Teknik","Teknik"],["degerler","de\u011ferler"],["gorunumu","g\u00f6r\u00fcn\u00fcm\u00fc"],
    ["duyarlilik","duyarl\u0131l\u0131k"],["formulu","form\u00fcl\u00fc"],["yoktur","yoktur"],["Ayni","Ayn\u0131"],
    ["mevcut","mevcut"],["anlik","anl\u0131k"],["sekilde","\u015fekilde"],["verilir","verilir"],
    ["cozer","\u00e7\u00f6zer"],["esitleyen","e\u015fitleyen"],["orani","oran\u0131"],["ucretler","\u00fccretler"]
  ];
  let out=String(s); for(const [a,b] of pairs) out=out.split(a).join(b); return out;
}
const L=(en,tr)=>state.language==="tr"?trPolish(tr):en;
const TR_TEXT = {
  "TLREF EFFECTIVE":"TLREF EFEKTIF",
  "ALL-IN BORROWING":"TOPLAM KREDI MALIYETI",
  "AFTER-TAX BORROWING":"VERGI SONRASI KREDI MALIYETI",
  "AFTER-TAX INVESTMENT":"VERGI SONRASI YATIRIM",
  "NET CARRY":"NET CARRY",
  "BREAK-EVEN LOAN":"BASABAS KREDI FAIZI",
  "SAFETY MARGIN":"GUVENLIK MARJI",
  "P(CARRY > 0)":"P(CARRY > 0)",
  "Rate headroom":"Faiz marji tamponu",
  "BORROWER vs INVESTMENT":"KREDI MALIYETI vs YATIRIM",
  "SCENARIO NET CARRY":"SENARYO NET CARRY",
  "LOAN COST CURVE SNAPSHOT":"KREDI MALIYET EGRISI OZETI",
  "CORE BORROWING INPUTS":"TEMEL KREDI GIRDILERI",
  "CLASSIFICATION / PRICING":"SINIFLANDIRMA / FIYATLAMA",
  "TAX / COST OVERRIDES":"VERGI / MALIYET OVERRIDE",
  "LENDER INPUTS":"KREDI VEREN GIRDILERI",
  "Principal":"Kredi Tutari",
  "Valuation Date":"Degerleme Tarihi",
  "VKGS / Days":"VKGS / Gun",
  "Nominal Loan Rate":"Nominal Kredi Faizi",
  "Credit Spread":"Kredi Spread",
  "Expected Inflation":"Beklenen Enflasyon",
  "10Y TRY Bond Yield":"10Y TL Tahvil Getirisi",
  "Investor":"Yatirimci Tipi",
  "Corporate":"Kurum",
  "Individual":"Gercek Kisi",
  "Loan Type":"Kredi Turu",
  "Commercial":"Ticari",
  "Consumer":"Tuketici",
  "Pricing Mode":"Fiyatlama Modu",
  "Direct Loan Rate":"Dogrudan Kredi Faizi",
  "Withholding":"Stopaj",
  "Corporate Tax":"Kurumlar Vergisi",
  "Bank / Financial CIT":"Banka / Finansal Kurum KV",
  "Financing Cost Deductibility":"Finansman Gideri Indirilebilirlik",
  "Upfront Fee":"Pesin Ucret",
  "Commission":"Komisyon",
  "Funding Cost":"Fonlama Maliyeti",
  "Expected Credit Loss":"Beklenen Kredi Zarari",
  "Operating Cost":"Operasyon Maliyeti",
  "Capital / Liquidity":"Sermaye / Likidite",
  "OFFICIAL RATE REGISTRY":"RESMI ORAN SICILI",
  "Rate / Oran":"Oran",
  "Default":"Varsayilan",
  "Effective":"Yururluk",
  "Source":"Kaynak",
  "ACTIVE MODEL TAX SETTINGS":"AKTIF MODEL VERGI AYARLARI",
  "Parameter":"Parametre",
  "Model Value":"Model Degeri",
  "TAX TREATMENT LOGIC":"VERGI UYGULAMA MANTIGI",
  "Gross Income - Withholding = Net Income":"Brut Gelir - Stopaj = Net Gelir",
  "Withholding is tracked as cash withholding / tax credit; economic tax is not double-counted.":"Stopaj nakit kesinti / vergi mahsubu olarak izlenir; ekonomik vergi ikinci kez maliyet yazilmaz.",
  "Tax shield applies only to the deductible portion of financing cost.":"Vergi kalkani yalnizca indirilebilir finansman gideri kisminda uygulanir.",
  "NOMINAL LOAN RATE":"NOMINAL KREDI FAIZI",
  "CASH COST":"NAKIT MALIYET",
  "TAX SHIELD":"VERGI KALKANI",
  "AFTER-TAX COST":"VERGI SONRASI MALIYET",
  "BORROWER COST WATERFALL":"KREDI MALIYET KOPRUSU",
  "BORROWER DETAIL":"KREDI MALIYET DETAYI",
  "Metric":"Metrik",
  "Value":"Deger",
  "TLREF NOMINAL":"TLREF NOMINAL",
  "WITHHOLDING CASH":"NAKIT STOPAJ",
  "AFTER-TAX INCOME":"VERGI SONRASI GELIR",
  "TAX BRIDGE":"VERGI KOPRUSU",
  "GROSS / NET RETURN":"BRUT / NET GETIRI",
  "BREAK-EVEN SPREAD":"BASABAS SPREAD",
  "BREAK-EVEN FRONTIER":"BASABAS SINIRI",
  "PRE-TAX PROFIT":"VERGI ONCESI KAR",
  "AFTER-TAX PROFIT":"VERGI SONRASI KAR",
  "MIN REQUIRED RATE":"MINIMUM GEREKLI FAIZ",
  "SPREAD HEADROOM":"SPREAD TAMPONU",
  "LENDER ECONOMIC WATERFALL":"KREDI VEREN EKONOMIK KOPRUSU",
  "LENDER DETAIL":"KREDI VEREN DETAYI",
  "HORIZONTALLY WIDE TERM STRUCTURE":"YATAY GENIS VADE YAPISI",
  "TENOR INPUT SURFACE":"VADE GIRDI YUZEYI",
  "Tenor":"Vade",
  "Maturity Date":"Vade Tarihi",
  "Tenor Spread Adj.":"Vade Spread Ayari",
  "Liquidity":"Likidite",
  "Capital":"Sermaye",
  "Fee Eq.":"Ucret Esd.",
  "Nominal Loan":"Nominal Kredi",
  "All-in Effective":"Toplam Efektif",
  "After-Tax":"Vergi Sonrasi",
  "Real Cost":"Reel Maliyet",
  "PROBABILITY TOTAL":"OLASILIK TOPLAMI",
  "EXPECTED NET CARRY":"BEKLENEN NET CARRY",
  "EXPECTED RATE":"BEKLENEN ORAN",
  "SCENARIO INPUTS":"SENARYO GIRDILERI",
  "Scenario":"Senaryo",
  "Probability":"Olasilik",
  "Inflation":"Enflasyon",
  "PROBABILITY vs NET CARRY":"OLASILIK vs NET CARRY",
  "SCENARIO RESULTS":"SENARYO SONUCLARI",
  "Loan Rate":"Kredi Faizi",
  "Carry Amount":"Carry Tutari",
  "Real Carry":"Reel Carry",
  "TLREF x CREDIT SPREAD HEATMAP":"TLREF x KREDI SPREAD ISI HARITASI",
  "EXPECTED INFLATION":"BEKLENEN ENFLASYON",
  "REAL BORROWING COST":"REEL KREDI MALIYETI",
  "REAL INVESTMENT RETURN":"REEL YATIRIM GETIRISI",
  "10Y RELATIVE VALUE":"10Y GORELI DEGER",
  "NOMINAL / AFTER-TAX / REAL":"NOMINAL / VERGI SONRASI / REEL",
  "TLREF EFFECTIVE RETURN":"TLREF EFEKTIF GETIRI",
  "BORROWER CASH COST":"KREDI KULLANAN NAKIT MALIYETI",
  "AFTER-TAX BORROWING":"VERGI SONRASI KREDI MALIYETI",
  "CORPORATE WITHHOLDING":"KURUMSAL STOPAJ",
  "BREAK-EVEN":"BASABAS",
  "CURVE":"EGRI",
  "PROBABILITY":"OLASILIK",
  "After-tax investment income - after-tax borrowing cost":"Vergi sonrasi yatirim geliri - vergi sonrasi kredi maliyeti",
  "Cash borrowing cost - tax shield":"Nakit kredi maliyeti - vergi kalkani",
  "Deductible financing cost x corporate tax rate":"Indirilebilir finansman gideri x kurumlar vergisi orani",
  "Interest + BSMV + KKDF + fees + commission":"Faiz + BSMV + KKDF + ucretler + komisyon",
  "Cash withholding is tracked separately from the final economic corporate-tax burden where creditable.":"Mahsup edilebilir durumlarda nakit stopaj, nihai ekonomik kurumlar vergisi yukunden ayri izlenir.",
  "Solve loan rate where after-tax borrowing cost equals after-tax investment income":"Vergi sonrasi kredi maliyetini vergi sonrasi yatirim gelirine esitleyen kredi faizini cozer",
  "TLREF anchor + tenor credit spread + liquidity + capital + fee overlay, fitted with Nelson-Siegel / Svensson":"TLREF anchor + vade spread + likidite + sermaye + ucret yuklemeleri; Nelson-Siegel / Svensson ile fit edilir",
  "OFFICIAL / TECHNICAL SOURCES":"RESMI / TEKNIK KAYNAKLAR",
  "VALUE-ONLY EXCEL / TURKISH":"SADECE SONUC EXCEL / TURKCE",
  "VALUE-ONLY EXCEL / ENGLISH":"SADECE SONUC EXCEL / INGILIZCE",
  "RESULT EXCEL TR":"SONUC EXCEL TR",
  "RESULT EXCEL EN":"SONUC EXCEL EN",
  "Calculated values, input snapshot, curve ladder, scenarios, sensitivity, methodology and sources. No macros and no model calculation formulas.":"Hesaplanan degerler, girdi anlik gorunumu, egriler, vade merdiveni, senaryolar, duyarlilik, metodoloji ve kaynaklar. Makro ve hesaplama formulu yoktur.",
  "Same analytics in English with the current calculation snapshot frozen as report values.":"Ayni analizler Ingilizce olarak, mevcut hesap anlik gorunumu rapor degerleri halinde sabitlenmis sekilde verilir.",
  "Model inputs remain fully editable. Official tax defaults are separated from user assumptions.":"Model girdileri tamamen degistirilebilir. Resmi vergi varsayilanlari kullanici varsayimlarindan ayri izlenir.",
  "TLREF + Spread mode preserves reference-rate economics. Direct mode tests a quoted loan rate independently.":"TLREF + Spread modu referans faiz ekonomisini korur. Dogrudan mod teklif edilen kredi faizini bagimsiz test eder.",
  "After-tax investment return exceeds after-tax borrowing cost.":"Vergi sonrasi yatirim getirisi vergi sonrasi kredi maliyetini asiyor.",
  "After-tax borrowing cost exceeds after-tax investment return.":"Vergi sonrasi kredi maliyeti vergi sonrasi yatirim getirisini asiyor.",
  "INDIVIDUAL":"GERCEK KISI",
  "CORPORATE":"KURUM",
  "BORROWER":"KREDI KULLANAN",
  "TLREF anchor + user-entered base credit spread + tenor spread adjustment + liquidity premium + capital charge + fee equivalent. Nelson-Siegel and Svensson fit the all-in effective tenor costs.":"TLREF bazina kullanicinin girdigi kredi spread, vade spread ayari, likidite primi, sermaye yuklemesi ve ucret esdegeri eklenir. Nelson-Siegel ve Svensson toplam efektif vade maliyetlerine fit edilir.",
  "Rate registry verified in this build as of 2026-10-04. Product classification and exemptions remain user responsibility and are therefore overrideable.":"Oran sicili bu surumde 2026-10-04 itibariyla dogrulanmistir. Urun siniflandirmasi ve istisnalar kullanici tarafindan teyit edilmelidir; bu nedenle oranlar degistirilebilir.",
  "CURVE":"EGRI",
  "EXPORT":"AKTARIM",
  "VALUE-ONLY XLSX":"SADECE SONUC XLSX"
};
function translateStaticText(){
  if(state.language!=="tr") return;
  const root=document.getElementById("app");
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    const raw=node.nodeValue; const key=raw.trim();
    if(TR_TEXT[key]) node.nodeValue=raw.replace(key,trPolish(TR_TEXT[key]));
    else if(key.startsWith("Nominal ")) node.nodeValue=raw.replace("Nominal ","Nominal ");
    else if(key.startsWith("Shield ")) node.nodeValue=raw.replace("Shield ","Vergi Kalkani ");
    else if(key.startsWith("Deductible ")) node.nodeValue=raw.replace("Deductible ","Indirilebilir ");
    else if(key.startsWith("Spread ")) node.nodeValue=raw.replace("Spread ","Spread ");
  }
}
const pct=(v,d=2)=>v==null||!Number.isFinite(Number(v))?"N/A":`${(Number(v)*100).toFixed(d)}%`;
const bp=(v)=>v==null||!Number.isFinite(Number(v))?"N/A":`${(Number(v)*10000).toFixed(1)} bp`;
const money=v=>v==null||!Number.isFinite(Number(v))?"N/A":new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Number(v))+" TRY";
const esc=s=>String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

async function api(path, options={}){
  const res=await fetch(`${API_BASE}${path}`,options);
  if(!res.ok) throw new Error((await res.text())||`${res.status} ${res.statusText}`);
  return res;
}
async function simulate(){
  syncInputsFromDOM();
  state.loading=true; state.error=""; render();
  try{const r=await api("/simulate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...state.input,language:state.language})});state.result=await r.json();}
  catch(e){state.error=e?.message||"Calculation engine unavailable";}
  finally{state.loading=false;render();}
}
async function loadTaxes(){try{const r=await api("/tax-registry");const d=await r.json();state.taxRegistry=d.rates||[];state.taxVerified=d.verified_as_of||state.taxVerified;render();}catch(_){} }
function dayDiff(fromDate,toDate){
  const a=new Date(`${fromDate}T00:00:00Z`),b=new Date(`${toDate}T00:00:00Z`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return null;
  return Math.max(1,Math.round((b-a)/86400000));
}
function clearMacroCurveNodes(){
  state.input.tenor_points=state.input.tenor_points.filter(p=>{
    if(p.base_source_type!=="tcmb_pka")return true;
    if(DEFAULT_TENOR_LABELS.has(p.label)){p.base_rate=null;p.base_source=null;p.base_source_type=null;return true;}
    return false;
  });
}
function applyMacroCurveNodes(){
  const nodes=state.marketMacro?.policy_path?.nodes||[];
  if(!nodes.length)return;
  clearMacroCurveNodes();
  for(const n of nodes){
    const days=n.target_date?dayDiff(state.input.valuation_date,n.target_date):Number(n.days);
    if(!Number.isFinite(days)||days<=1)continue;
    let p=state.input.tenor_points.find(x=>x.label===n.label);
    if(!p){p={label:n.label,days,base_rate:null,base_source:null,base_source_type:null,credit_spread:0,liquidity_premium:0,capital_charge:0,fee_equivalent:0};state.input.tenor_points.push(p);}
    // Explicit market/user observations always supersede survey anchors.
    if(["user_market","viop_futures","swap"].includes(p.base_source_type))continue;
    p.days=days;
    p.base_rate=Number(n.tlref_proxy_rate??n.rate);
    const policyTxt=n.policy_rate!=null?` · Policy ${pct(Number(n.policy_rate),2)}`:"";
    const basisTxt=n.policy_to_tlref_basis!=null?` · Basis ${bp(Number(n.policy_to_tlref_basis))}`:"";
    p.base_source=`${n.source||state.marketMacro?.policy_path?.source||"TCMB PKA"}${n.target_date?` · ${n.target_date}`:""}${policyTxt}${basisTxt}`;
    p.base_source_type=n.source_type||"tcmb_pka";
  }
  state.input.tenor_points.sort((a,b)=>a.days-b.days);
  state.input.curve_mode="tcmb_survey";
}
async function loadMarketTLREF(force=false,runAfter=false){
  try{
    const r=await api(`/market/tlref${force?"?force=true":""}`);const d=await r.json();state.marketTLREF=d;
    if(state.useOfficialTLREF && d?.latest?.rate!=null){state.input.tlref=Number(d.latest.rate);const on=state.input.tenor_points.find(x=>x.label==="ON");if(on){on.base_rate=state.input.tlref;on.base_source="Borsa Istanbul TLREF";on.base_source_type="bist_tlref";}const base=state.input.scenarios?.find(x=>x.name==="Base");if(base)base.tlref=state.input.tlref;}
    if(runAfter)await simulate();else render();
  }catch(e){state.marketTLREF={status:"unavailable",is_live:false,warning:e?.message||"Official TLREF unavailable",history:[],stats:{}};if(runAfter)await simulate();else render();}
}
async function loadMarketMacro(force=false,runAfter=false){
  try{
    const r=await api(`/market/macro${force?"?force=true":""}`);const d=await r.json();state.marketMacro=d;
    if(state.useOfficialInflation && d?.inflation_12m?.value!=null){state.input.inflation_12m_expectation=Number(d.inflation_12m.value);state.input.inflation=Number(d.inflation_12m.value);const base=state.input.scenarios?.find(x=>x.name==="Base");if(base)base.inflation=Number(d.inflation_12m.value);}
    if(state.input.curve_mode==="tcmb_survey")applyMacroCurveNodes();
    if(runAfter)await simulate();else render();
  }catch(e){state.marketMacro={status:"unavailable",warning:e?.message||"TCMB macro data unavailable",policy_path:{nodes:[]}};if(runAfter)await simulate();else render();}
}
async function boot(){
  render();
  await Promise.all([loadTaxes(),loadMarketTLREF(false,false),loadMarketMacro(false,false)]);
  await simulate();
}
async function exportXlsx(lang){if(!state.result)return;const r=await api("/export-xlsx",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:state.input,result:state.result,language:lang})});const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=lang==="tr"?"Interest_Loan_Cost_Simulator_Result_TR.xlsx":"Interest_Loan_Cost_Simulator_Result_EN.xlsx";a.click();URL.revokeObjectURL(u);}

function turkishFlag(sizeClass="") {
  const uid=Math.random().toString(36).slice(2,10);
  const base=`trFlag-${uid}`;
  return `<svg class="${sizeClass}" viewBox="0 0 90 60" aria-label="Turkish flag" role="img" shape-rendering="geometricPrecision">
    <defs><mask id="${base}-crescent"><rect width="90" height="60" fill="black"/><circle cx="31" cy="30" r="15" fill="white"/><circle cx="37" cy="30" r="12" fill="black"/></mask></defs>
    <rect x="0.75" y="0.75" width="88.5" height="58.5" rx="2" fill="#E30A17" stroke="rgba(255,255,255,.42)" stroke-width="1.1"/>
    <circle cx="31" cy="30" r="15" fill="#fff" mask="url(#${base}-crescent)"/>
    <path fill="#fff" d="M53.0 21.8l2.68 7.77h8.17l-6.61 4.80 2.53 7.78L53 37.40l-6.77 4.75 2.53-7.78-6.61-4.80h8.17z"/>
  </svg>`;
}
function brand(){return `<div class="brand-lockup"><div class="mk-mark"><span>M</span><span>K</span></div><div class="crescent-mark">${turkishFlag("turkish-flag")}</div><div class="brand-copy"><div>MK FinTECH LabGEN</div><small>@2026 Istanbul Atelier</small></div></div>`;}
function miniBrand(){return `<div class="header-brand"><div class="header-mk">MK</div><div class="mini-flag">${turkishFlag("turkish-flag mini")}</div></div>`;}
function kpi(label,value,note="",tone="neutral"){return `<div class="kpi-card ${tone}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div>${note?`<div class="kpi-note">${esc(note)}</div>`:""}</div>`;}
function panel(title,body,cls=""){return `<section class="panel ${cls}"><div class="panel-title">${esc(title)}</div><div class="panel-body">${body}</div></section>`;}
function field(key,label,{percent=false,suffix="",badge="",disabled=false,hint=""}={}){const v=state.input[key];const shown=percent?Number(v)*100:Number(v);return `<label class="field ${disabled?"disabled":""}"><span class="field-label-row"><span>${esc(label)}</span>${badge?`<span class="official-badge">${esc(badge)}</span>`:""}</span><span class="field-box"><input data-field="${esc(key)}" data-percent="${percent?1:0}" type="number" value="${Number.isFinite(shown)?shown:0}" step="${percent?0.1:1}" ${disabled?"disabled":""}/>${percent?"<span>%</span>":suffix?`<span>${esc(suffix)}</span>`:""}</span>${hint?`<small class="field-hint">${esc(hint)}</small>`:""}</label>`;}
function table(columns,rows){return `<div class="table-wrap"><table class="smart-table"><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(c=>{const raw=row[c.key];const val=c.fmt==="pct"?pct(raw):c.fmt==="money"?money(raw):esc(raw);return `<td class="${typeof raw==="number"&&raw<0?"negative-cell":""}">${val}</td>`;}).join("")}</tr>`).join("")}</tbody></table></div>`;}
function plotBox(id){return `<div id="${id}" style="width:100%;height:100%;min-height:320px"></div>`;}
function layout(title,wide=false){const dark=state.theme==="dark";const out={paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",font:{color:dark?"#aab6ca":"#5d6a7e",family:"Arial",size:11},margin:{l:62,r:24,t:title?86:58,b:54},height:wide?470:340,autosize:true,hovermode:"x unified",xaxis:{gridcolor:dark?"#1a2b49":"#e6ebf2",zerolinecolor:dark?"#31415d":"#ccd4e0"},yaxis:{gridcolor:dark?"#1a2b49":"#e6ebf2",zerolinecolor:dark?"#31415d":"#ccd4e0",tickformat:".1%"},legend:{orientation:"h",y:1.14,x:1,xanchor:"right",yanchor:"bottom",font:{size:9}}};if(title)out.title={text:title,font:{size:12,color:dark?"#f5f7fb":"#1b2942",family:"Arial"},x:.01,y:.985,xanchor:"left",yanchor:"top"};return out;}
const plotConfig={responsive:true,displaylogo:false,modeBarButtonsToRemove:["lasso2d","select2d"]};

function executive(){if(!state.result)return empty();const r=state.result,k=r.kpis,positive=(k.net_carry_amount||0)>=0;return `<div class="section-eyebrow">INTEREST LOAN COST SIMULATOR <span>INTELLIGENCE</span></div><div class="kpi-grid">${kpi("TLREF EFFECTIVE",pct(k.tlref_effective_annual),`Nominal ${pct(state.input.tlref)}`,"accent")}${kpi("ALL-IN BORROWING",pct(k.all_in_borrowing_effective_annual),money(r.borrower.cash_cost))}${kpi("AFTER-TAX BORROWING",pct(k.after_tax_borrowing_effective_annual),`Shield ${money(r.borrower.tax_shield)}`)}${kpi("AFTER-TAX INVESTMENT",pct(k.after_tax_investment_effective_annual),money(r.investment.after_tax_income))}${kpi("NET CARRY",pct(k.net_carry_effective_annual),money(k.net_carry_amount),positive?"positive":"negative")}${kpi("BREAK-EVEN LOAN",pct(k.break_even_loan_rate),`Spread ${pct(k.break_even_spread)}`)}${kpi("SAFETY MARGIN",pct(k.safety_margin),"Rate headroom",(k.safety_margin||0)>=0?"positive":"negative")}${kpi("P(CARRY > 0)",pct(r.scenarios.positive_carry_probability,1),`E[Carry] ${money(r.scenarios.expected_net_carry_amount)}`)}</div><div class="decision-banner ${positive?"positive":"negative"}"><span class="decision-dot"></span><span>${positive?I18N[state.language].positive:I18N[state.language].negative}</span><small>${positive?"After-tax investment return exceeds after-tax borrowing cost.":"After-tax borrowing cost exceeds after-tax investment return."}</small></div><div class="grid two">${panel("BORROWER vs INVESTMENT",plotBox("chart-main-compare"))}${panel("SCENARIO NET CARRY",plotBox("chart-main-scenario"))}</div>${panel("LOAN COST CURVE SNAPSHOT",plotBox("chart-main-curve"),"wide-panel")}`;}
function activeLoanRate(){return state.input.pricing_mode==="tlref_spread"?Number(state.input.tlref)+Number(state.input.credit_spread):Number(state.input.direct_loan_rate);}
function inputs(){
  const tr=I18N[state.language],spreadMode=state.input.pricing_mode==="tlref_spread",activeRate=activeLoanRate();
  const infl=state.marketMacro?.inflation_12m;
  const policy=state.marketMacro?.policy_path;
  return `<div class="section-header"><div><div class="section-eyebrow">${tr.inputs}</div><p>${L("Official TLREF and TCMB 12M inflation expectation are loaded as live/reference anchors and remain user-overridable. The curve uses observed/survey tenor nodes rather than fabricating a slope from one spot rate.","Resmî TLREF ve TCMB 12 aylık enflasyon beklentisi canlı/referans ankor olarak yüklenir ve kullanıcı tarafından değiştirilebilir. Eğri tek spot faizden yapay eğim üretmek yerine gözlenen/anket vade düğümlerini kullanır.")}</p></div><button class="run-button" data-action="run">${state.loading?"...":tr.run}</button></div>
<div class="pricing-strip"><div><span>${L("ACTIVE PRICING","AKTİF FİYATLAMA")}</span><strong>${spreadMode?"TLREF + SPREAD":L("DIRECT LOAN RATE","DOĞRUDAN KREDİ FAİZİ")}</strong></div><div><span>TLREF</span><strong>${pct(state.input.tlref)}</strong></div><div><span>${L("BASE CREDIT SPREAD","BAZ KREDİ SPREAD")}</span><strong>${pct(state.input.credit_spread)}</strong></div><div><span>${L("ACTIVE NOMINAL LOAN RATE","AKTİF NOMİNAL KREDİ FAİZİ")}</span><strong>${pct(activeRate)}</strong></div></div>
<div class="grid three">
${panel(L("CORE BORROWING INPUTS","TEMEL KREDİ GİRDİLERİ"),`<div class="field-grid">${field("principal",L("Principal","Kredi Tutarı"),{suffix:"TRY"})}<label class="field"><span class="field-label-row"><span>${L("Valuation Date","Değerleme Tarihi")}</span></span><span class="field-box"><input data-date-field="valuation_date" type="date" value="${esc(state.input.valuation_date)}"/></span></label>${field("days",L("VKGS / Days","VKGS / Gün"))}${field("tlref","TLREF",{percent:true,badge:L("BIST ANCHOR","BIST ANKOR")})}${field("credit_spread",L("Base Credit Spread - Separate Input","Baz Kredi Spread - Ayrı Girdi"),{percent:true,badge:L("SEPARATE","AYRI")})}${field("direct_loan_rate",L("Direct Loan Rate","Doğrudan Kredi Faizi"),{percent:true,disabled:spreadMode})}${field("inflation_12m_expectation",L("12M Expected CPI - TCMB PKA","12A Beklenen TÜFE - TCMB PKA"),{percent:true,badge:L("TCMB PKA","TCMB PKA")})}${field("ten_year_bond_yield",L("10Y TRY Bond Yield - Reference Only","10Y TL Tahvil Getirisi - Sadece Referans"),{percent:true})}</div>
<div class="source-note"><span>${L("TLREF SOURCE","TLREF KAYNAĞI")}</span><a href="${TLREF_OFFICIAL_URL}" target="_blank" rel="noopener">Borsa İstanbul - TLREF</a><small>${state.marketTLREF?.latest?`${L("Official latest","Resmî son değer")}: ${pct(state.marketTLREF.latest.rate,4)} · ${esc(state.marketTLREF.latest.date)} · ${state.marketTLREF.is_live?L("LIVE WEB + FULL CSV HISTORY","CANLI WEB + TAM CSV TARİHÇE"):L("OFFICIAL CSV FALLBACK","RESMÎ CSV YEDEĞİ")}`:L("Loading official TLREF...","Resmî TLREF yükleniyor...")}</small><div class="source-actions"><button class="source-action" data-action="use-official-tlref">${L("USE OFFICIAL TLREF","RESMÎ TLREF'İ KULLAN")}</button><button class="source-action" data-action="refresh-tlref">${L("REFRESH BIST","BIST'TEN YENİLE")}</button></div></div>
<div class="source-note"><span>${L("12M INFLATION SOURCE","12A ENFLASYON KAYNAĞI")}</span><a href="${TCMB_EVDS_URL}" target="_blank" rel="noopener">TCMB EVDS</a><small>${infl?`${pct(infl.value)} · ${esc(infl.period||policy?.survey_period||"")} · ${infl.is_live?L("LIVE EVDS","CANLI EVDS"):L("OFFICIAL SURVEY SNAPSHOT","RESMÎ ANKET SNAPSHOT")}`:L("Loading TCMB expectation...","TCMB beklentisi yükleniyor...")}</small><div class="source-actions"><button class="source-action" data-action="use-official-inflation">${L("USE TCMB 12M CPI","TCMB 12A TÜFE'Yİ KULLAN")}</button><button class="source-action" data-action="refresh-macro">${L("REFRESH TCMB","TCMB'DEN YENİLE")}</button></div>${state.marketMacro?.warning?`<small class="source-warning">${esc(state.marketMacro.warning)}</small>`:""}</div>`)}
${panel(L("CLASSIFICATION / PRICING","SINIFLANDIRMA / FİYATLAMA"),`<div class="select-stack"><label>${L("Investor","Yatırımcı")}<select data-select="investor_type"><option value="corporate" ${state.input.investor_type==="corporate"?"selected":""}>${L("Corporate","Kurum")}</option><option value="individual" ${state.input.investor_type==="individual"?"selected":""}>${L("Individual","Gerçek Kişi")}</option></select></label><label>${L("Loan Type","Kredi Türü")}<select data-select="loan_type"><option value="commercial" ${state.input.loan_type==="commercial"?"selected":""}>${L("Commercial","Ticari")}</option><option value="consumer" ${state.input.loan_type==="consumer"?"selected":""}>${L("Consumer","Tüketici")}</option></select></label><label>${L("Pricing Mode","Fiyatlama Modu")}<select data-select="pricing_mode"><option value="tlref_spread" ${state.input.pricing_mode==="tlref_spread"?"selected":""}>TLREF + Spread</option><option value="direct" ${state.input.pricing_mode==="direct"?"selected":""}>${L("Direct Loan Rate","Doğrudan Kredi Faizi")}</option></select></label><label>${L("Curve Anchor Mode","Eğri Ankor Modu")}<select data-select="curve_mode"><option value="tcmb_survey" ${state.input.curve_mode==="tcmb_survey"?"selected":""}>TCMB PKA + BIST TLREF</option><option value="market_user" ${state.input.curve_mode==="market_user"?"selected":""}>${L("Market/User Tenor Nodes","Piyasa/Kullanıcı Vade Düğümleri")}</option><option value="manual" ${state.input.curve_mode==="manual"?"selected":""}>${L("Manual","Manuel")}</option></select></label></div><button class="run-button small" data-action="apply-tcmb-curve">${L("APPLY TCMB PKA CURVE NODES","TCMB PKA EĞRİ DÜĞÜMLERİNİ UYGULA")}</button><div class="formula-preview"><span>${L("ACTIVE PRICING EQUATION","AKTİF FİYATLAMA DENKLEMİ")}</span><strong>${spreadMode?`TLREF ${pct(state.input.tlref)} + Spread ${pct(state.input.credit_spread)} = ${pct(activeRate)}`:`${L("Direct Loan Rate","Doğrudan Kredi Faizi")} = ${pct(activeRate)}`}</strong></div></div>`)}
${panel(L("TAX / COST OVERRIDES","VERGİ / MALİYET OVERRIDE"),`<div class="field-grid">${field("bsmv_rate","BSMV",{percent:true})}${field("kkdf_rate","KKDF",{percent:true})}${field("withholding_rate",L("Withholding","Stopaj"),{percent:true})}${field("corporate_tax_rate",L("Corporate Tax","Kurumlar Vergisi"),{percent:true})}${field("deductible_ratio",L("Financing Cost Deductibility","Finansman Gideri İndirilebilirlik"),{percent:true})}${field("upfront_fee_rate",L("Upfront Fee","Peşin Ücret"),{percent:true})}${field("commission_rate",L("Commission","Komisyon"),{percent:true})}</div>`)}</div>`;
}
function taxPage(){const tr=I18N[state.language];const labelKey=state.language==="tr"?"label_tr":"label_en";return `<div class="section-header"><div><div class="section-eyebrow">${tr.tax}</div><p>${tr.sourceNote}</p></div><div class="verified-pill">${tr.verified}: ${esc(state.taxVerified)}</div></div>${panel("OFFICIAL RATE REGISTRY",table([{key:labelKey,label:"Rate / Oran"},{key:"rate",label:"Default",fmt:"pct"},{key:"effective_date",label:"Effective"},{key:"source",label:"Source"}],state.taxRegistry))}<div class="grid two">${panel("ACTIVE MODEL TAX SETTINGS",table([{key:"name",label:"Parameter"},{key:"value",label:"Model Value",fmt:"pct"}],[{name:"BSMV",value:state.input.bsmv_rate},{name:"KKDF",value:state.input.kkdf_rate},{name:"Withholding",value:state.input.withholding_rate},{name:"Corporate Tax",value:state.input.corporate_tax_rate},{name:"Lender Tax",value:state.input.lender_tax_rate}]))}${panel("TAX TREATMENT LOGIC",`<div class="logic-stack"><div>INDIVIDUAL<span>Gross Income - Withholding = Net Income</span></div><div>CORPORATE<span>Withholding is tracked as cash withholding / tax credit; economic tax is not double-counted.</span></div><div>BORROWER<span>Tax shield applies only to the deductible portion of financing cost.</span></div></div>`)}</div>`;}
function borrower(){if(!state.result)return empty();const b=state.result.borrower;return `<div class="kpi-grid four">${kpi("NOMINAL LOAN RATE",pct(b.nominal_rate))}${kpi("CASH COST",money(b.cash_cost),pct(b.cash_effective_annual))}${kpi("TAX SHIELD",money(b.tax_shield),`Deductible ${money(b.deductible_cost)}`,"accent")}${kpi("AFTER-TAX COST",money(b.after_tax_cost),pct(b.after_tax_effective_annual))}</div><div class="grid two">${panel("BORROWER COST WATERFALL",plotBox("chart-borrower"))}${panel("BORROWER DETAIL",table([{key:"label",label:"Metric"},{key:"value",label:"Value"}],Object.entries(b).map(([label,value])=>({label,value:typeof value==="number"?(label.includes("rate")||label.includes("annual")?pct(value):money(value)):String(value)}))))}</div>`;}
function investment(){
  if(!state.result)return empty();
  const i=state.result.investment,s=state.marketTLREF?.stats||{};
  const src=state.marketTLREF?.latest?`${state.marketTLREF.is_live?L("BIST LIVE WEB","BIST CANLI WEB"):L("BIST OFFICIAL CSV","BIST RESMÎ CSV")} · ${state.marketTLREF.latest.date}`:L("Market source loading","Piyasa kaynağı yükleniyor");
  const ranges=["1M","6M","1Y","5Y","ALL"];
  const controls=`<div class="range-strip">${ranges.map(x=>`<button data-tlref-range="${x}" class="${state.tlrefRange===x?"active":""}">${x}</button>`).join("")}</div>`;
  return `<div class="kpi-grid four">${kpi("TLREF NOMINAL",pct(i.tlref,4),src)}${kpi(L("21D TLREF AVG","21G TLREF ORT."),pct(s.mean_21d,2))}${kpi(L("63D TLREF AVG","63G TLREF ORT."),pct(s.mean_63d,2))}${kpi(L("REALIZED 1Y TLREF RETURN","GERÇEKLEŞEN 1Y TLREF GETİRİSİ"),pct(s.realized_return_1y,2))}</div><div class="source-note tlref-context"><span>${L("HISTORICAL TLREF ENGINE","TARİHSEL TLREF MOTORU")}</span><a href="${TLREF_OFFICIAL_URL}" target="_blank" rel="noopener">Borsa İstanbul - TLREF</a><small>${L("Bundled official daily TLREF history is merged with the latest Borsa Istanbul web observations. Rolling means and realized compounding are calculated from the real daily series.","Paketlenmiş resmî günlük TLREF tarihçesi en güncel Borsa İstanbul web gözlemleriyle birleştirilir. Hareketli ortalamalar ve gerçekleşen bileşik getiri gerçek günlük seriden hesaplanır.")}</small></div>${panel(L("OFFICIAL TLREF HISTORICAL SERIES","RESMÎ TLREF TARİHSEL SERİSİ"),controls+plotBox("chart-tlref-history"),"wide-panel")}<div class="grid two">${panel("TAX BRIDGE",plotBox("chart-tax-bridge"))}${panel("GROSS / NET RETURN",plotBox("chart-invest-return"))}</div>`;
}
function carry(){if(!state.result)return empty();const r=state.result,k=r.kpis,pos=(k.net_carry_amount||0)>=0;return `<div class="kpi-grid four">${kpi("NET CARRY",money(k.net_carry_amount),pct(k.net_carry_effective_annual),pos?"positive":"negative")}${kpi("BREAK-EVEN LOAN",pct(k.break_even_loan_rate))}${kpi("BREAK-EVEN SPREAD",pct(k.break_even_spread))}${kpi("SAFETY MARGIN",pct(k.safety_margin),"",(k.safety_margin||0)>=0?"positive":"negative")}</div>${panel("BREAK-EVEN FRONTIER",plotBox("chart-break-even"))}`;}
function lender(){if(!state.result)return empty();const l=state.result.lender;return `<div class="kpi-grid four">${kpi("PRE-TAX PROFIT",money(l.pre_tax_profit))}${kpi("AFTER-TAX PROFIT",money(l.after_tax_profit),"",l.after_tax_profit>=0?"positive":"negative")}${kpi("MIN REQUIRED RATE",pct(l.min_required_rate))}${kpi("SPREAD HEADROOM",pct(l.spread_headroom),"",l.spread_headroom>=0?"positive":"negative")}</div><div class="grid two">${panel("LENDER ECONOMIC WATERFALL",plotBox("chart-lender"))}${panel("LENDER DETAIL",table([{key:"metric",label:"Metric"},{key:"value",label:"Value"}],Object.entries(l).map(([metric,value])=>({metric,value:typeof value==="number"?(metric.includes("rate")||metric.includes("spread")?pct(value):money(value)):String(value)}))))}</div>`;}
function curve(){
  if(!state.result)return empty();
  const c=state.result.curve||{},ready=c.curve_status==="term_structure_available";
  const pka=state.marketMacro?.policy_path;
  const status=ready?L("TERM STRUCTURE AVAILABLE","VADE YAPISI MEVCUT"):L("TERM NODES REQUIRED","VADE DÜĞÜMLERİ GEREKLİ");
  const statusText=ready?`${L("Observed anchors","Gözlenen ankorlar")}: ${c.observed_node_count||0} · ${L("Fit horizon","Fit ufku")}: ${c.max_fit_days||0} ${L("days","gün")}. ${L("TCMB survey nodes are expectation anchors, not exchange-traded forward prices.","TCMB anket düğümleri beklenti ankorlarıdır; borsada işlem gören forward fiyatları değildir.")}`:L("At least four distinct base-rate nodes are needed for Nelson-Siegel and six for Svensson.","Nelson-Siegel için en az dört, Svensson için en az altı farklı baz faiz düğümü gerekir.");
  const basis=state.marketMacro?.tlref_policy_basis?.value;
  const sourceLine=pka?`${esc(pka.source||"TCMB PKA")} · ${esc(pka.survey_period||"")}${basis!=null?` · TLREF-policy basis ${bp(basis)}`:""}`:"TCMB PKA";
  return `<div class="section-header"><div><div class="section-eyebrow">${I18N[state.language].curve}</div><p>${L("The benchmark term structure starts with current BIST TLREF at ON. TCMB Market Participants Survey policy-rate expectations are converted into TLREF-equivalent survey proxies by adding the current observed TLREF-minus-policy-rate basis. Genuine VIOP/swap/user market nodes supersede survey proxies at the same tenor. Loan pricing overlays are then added and NS/Svensson are calibrated only inside the supported anchor horizon.","Benchmark vade yapısı ON noktasında güncel BIST TLREF ile başlar. TCMB Piyasa Katılımcıları Anketi politika faizi beklentileri, gözlenen güncel TLREF eksi politika faizi bazı eklenerek TLREF-eşdeğer anket proxy düğümlerine çevrilir. Gerçek VİOP/swap/kullanıcı piyasa düğümleri aynı vadede anket proxy'lerinin yerine geçer. Ardından kredi fiyatlama yüklemeleri eklenir ve NS/Svensson yalnız desteklenen ankor ufku içinde kalibre edilir.")}</p></div><button class="run-button" data-action="run">${I18N[state.language].run}</button></div><div class="curve-status ${ready?"ready":"warning"}"><span>${status}</span><small>${statusText}<br>${sourceLine}</small></div>${panel(L("NS / SVENSSON LOAN TERM STRUCTURE","NS / SVENSSON KREDİ VADE YAPISI"),plotBox("chart-curve-wide"),"wide-panel")}${panel(L("TENOR INPUT / SOURCE SURFACE","VADE GİRDİ / KAYNAK YÜZEYİ"),`<div class="table-wrap"><table class="smart-table editable curve-input-table"><thead><tr><th>Tenor</th><th>VKGS</th><th>${L("Base Rate","Baz Faiz")}</th><th>${L("Source","Kaynak")}</th><th>${L("Tenor Spread","Vade Spread")}</th><th>${L("Liquidity","Likidite")}</th><th>${L("Capital","Sermaye")}</th><th>${L("Fee Eq.","Ücret Eşd.")}</th></tr></thead><tbody>${state.input.tenor_points.map((p,i)=>`<tr><td>${esc(p.label)}</td><td>${p.days}</td><td><input data-tenor-index="${i}" data-tenor-key="base_rate" data-optional-percent="1" type="number" step="0.01" value="${p.base_rate==null?"":(p.base_rate*100).toFixed(2)}"/><span>%</span></td><td class="source-cell">${esc(p.base_source_type||"—")}</td>${["credit_spread","liquidity_premium","capital_charge","fee_equivalent"].map(key=>`<td><input data-tenor-index="${i}" data-tenor-key="${key}" type="number" step="0.05" value="${(Number(p[key]||0)*100).toFixed(2)}"/><span>%</span></td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="micro-note">${L("Source hierarchy: VIOP/swap/market or user market node > TCMB PKA survey anchor > in-horizon NS/Svensson interpolation. The model never extrapolates beyond the last genuine anchor by default. The 10Y government bond yield remains a reference marker unless you explicitly enter it as a base-rate node.","Kaynak hiyerarşisi: VİOP/swap/piyasa veya kullanıcı piyasa düğümü > TCMB PKA anket ankru > yalnız gözlenen ufuk içinde NS/Svensson interpolasyonu. Model varsayılan olarak son gerçek ankorun ötesine ekstrapolasyon yapmaz. 10Y devlet tahvili getirisi siz açıkça baz faiz düğümü olarak girmedikçe yalnız referans işaretidir.")}</div>`)}`;
}
function ladder(){if(!state.result)return empty();return panel(I18N[state.language].ladder,table([{key:"label",label:"Tenor"},{key:"days",label:"VKGS"},{key:"maturity_date",label:"Maturity Date"},{key:"base_rate",label:L("Base Rate","Baz Faiz"),fmt:"pct"},{key:"base_source_type",label:L("Source Type","Kaynak Tipi")},{key:"base_credit_spread",label:"Base Spread",fmt:"pct"},{key:"tenor_spread_adjustment",label:"Tenor Spread Adj.",fmt:"pct"},{key:"liquidity_premium",label:"Liquidity",fmt:"pct"},{key:"capital_charge",label:"Capital",fmt:"pct"},{key:"fee_equivalent",label:"Fee Eq.",fmt:"pct"},{key:"all_in_quote_rate",label:"All-in Quote",fmt:"pct"},{key:"cash_effective_annual",label:"Cash Effective",fmt:"pct"},{key:"after_tax_effective_annual",label:"After-Tax",fmt:"pct"},{key:"real_after_tax_effective",label:"Real Cost",fmt:"pct"}],state.result.curve.rows));}
function scenarios(){if(!state.result)return empty();const s=state.result.scenarios;return `<div class="kpi-grid four">${kpi("PROBABILITY TOTAL",pct(s.probability_total,1),"",s.probability_valid?"positive":"negative")}${kpi("EXPECTED NET CARRY",money(s.expected_net_carry_amount))}${kpi("P(CARRY > 0)",pct(s.positive_carry_probability,1))}${kpi("EXPECTED RATE",pct(s.expected_net_carry_rate))}</div><div class="grid two">${panel("SCENARIO INPUTS",`<div class="table-wrap"><table class="smart-table editable"><thead><tr><th>Scenario</th><th>Probability</th><th>TLREF</th><th>Spread</th><th>Inflation</th></tr></thead><tbody>${state.input.scenarios.map((x,i)=>`<tr><td>${esc(x.name)}</td>${["probability","tlref","credit_spread","inflation"].map(key=>`<td><input data-scenario-index="${i}" data-scenario-key="${key}" type="number" step="0.5" value="${(x[key]*100).toFixed(1)}"/><span>%</span></td>`).join("")}</tr>`).join("")}</tbody></table></div><button class="run-button small" data-action="run">${I18N[state.language].run}</button>`)}${panel("PROBABILITY vs NET CARRY",plotBox("chart-scenario-map"))}</div>${panel("SCENARIO RESULTS",table([{key:"name",label:"Scenario"},{key:"probability",label:"Probability",fmt:"pct"},{key:"tlref",label:"TLREF",fmt:"pct"},{key:"credit_spread",label:"Spread",fmt:"pct"},{key:"loan_rate",label:"Loan Rate",fmt:"pct"},{key:"net_carry_amount",label:"Carry Amount",fmt:"money"},{key:"net_carry_effective_annual",label:"Carry Eff.",fmt:"pct"},{key:"real_net_carry_effective",label:"Real Carry",fmt:"pct"}],s.rows))}`;}
function sensitivity(){if(!state.result)return empty();return panel("TLREF x CREDIT SPREAD HEATMAP",plotBox("chart-sensitivity"));}
function real(){if(!state.result)return empty();const r=state.result,k=r.kpis;const inf=state.marketMacro?.inflation_12m;return `<div class="kpi-grid four">${kpi(L("12M EXPECTED CPI","12A BEKLENEN TÜFE"),pct(state.input.inflation_12m_expectation),inf?`${inf.period||""} · TCMB PKA`:"")}${kpi("REAL BORROWING COST",pct(r.borrower.real_after_tax_effective))}${kpi("REAL INVESTMENT RETURN",pct(r.investment.real_after_tax_effective))}${kpi("10Y RELATIVE VALUE",pct(k.ten_year_bond_relative_value))}</div>${panel("NOMINAL / AFTER-TAX / REAL",plotBox("chart-real"))}`;}
function methodology(){
  const cards=[
    [L("TLREF EFFECTIVE RETURN","TLREF EFEKTİF GETİRİ"),"R_TLREF(d) = Π_t (1 + TLREF_t / 365)^(Δd_t) - 1"],
    [L("BORROWER CASH COST","KREDİ NAKİT MALİYETİ"),L("Interest + BSMV + KKDF + upfront fees + commission","Faiz + BSMV + KKDF + peşin ücretler + komisyon")],
    [L("TAX SHIELD","VERGİ KALKANI"),L("Deductible financing cost x corporate tax rate","İndirilebilir finansman gideri x kurumlar vergisi oranı")],
    [L("AFTER-TAX BORROWING","VERGİ SONRASI BORÇLANMA"),L("Cash borrowing cost - tax shield","Nakit kredi maliyeti - vergi kalkanı")],
    [L("12M EXPECTED CPI","12A BEKLENEN TÜFE"),L("Real cost = (1 + nominal after-tax cost) / (1 + TCMB 12M CPI expectation) - 1","Reel maliyet = (1 + nominal vergi sonrası maliyet) / (1 + TCMB 12A TÜFE beklentisi) - 1")],
    [L("NET CARRY","NET CARRY"),L("After-tax investment income - after-tax borrowing cost","Vergi sonrası yatırım geliri - vergi sonrası kredi maliyeti")],
    [L("BREAK-EVEN","BAŞABAŞ"),L("Solve the loan rate where after-tax borrowing cost equals after-tax investment income.","Vergi sonrası kredi maliyetini vergi sonrası yatırım gelirine eşitleyen kredi faizini çöz.")],
    [L("PROBABILITY","OLASILIK"),"E(Carry) = Σ p_i × Carry_i ; P(Carry > 0) = Σ p_i × I(Carry_i > 0)"]
  ];
  const nsFormula="y_NS(T) = β0 + β1[(1-e^(-T/τ1))/(T/τ1)] + β2[(1-e^(-T/τ1))/(T/τ1) - e^(-T/τ1)]";
  const svFormula="y_SV(T) = y_NS(T) + β3[(1-e^(-T/τ2))/(T/τ2) - e^(-T/τ2)]";
  const curveBlock=`<section class="panel methodology-wide"><div class="panel-title">${L("TERM-STRUCTURE METHODOLOGY - BIST TLREF / TCMB PKA / NELSON-SIEGEL / SVENSSON","VADE YAPISI METODOLOJİSİ - BIST TLREF / TCMB PKA / NELSON-SIEGEL / SVENSSON")}</div><div class="panel-body methodology-detail">
    <div class="method-step"><span>01</span><div><h4>${L("Historical TLREF engine","Tarihsel TLREF motoru")}</h4><p>${L("The bundled official Borsa Istanbul daily TLREF file is the permanent historical layer. It is merged with any newly parsed official web observations. Historical TLREF is a time series, not a cross-sectional yield curve.","Paketlenmiş resmî Borsa İstanbul günlük TLREF dosyası kalıcı tarihsel katmandır. Resmî web kaynağından yeni okunabilen gözlemlerle birleştirilir. Tarihsel TLREF bir zaman serisidir; yatay kesit verim eğrisi değildir.")}</p></div></div>
    <div class="method-step"><span>02</span><div><h4>${L("Current overnight anchor","Güncel gecelik ankor")}</h4><p>${L("The latest valid BIST TLREF observation is the ON anchor. A manual override is allowed, but one ON observation alone never identifies a 1W-10Y term structure.","Son geçerli BIST TLREF gözlemi ON ankorudur. Manuel override mümkündür; ancak tek ON gözlemi tek başına 1H-10Y vade yapısını tanımlamaz.")}</p></div></div>
    <div class="method-step"><span>03</span><div><h4>${L("Benchmark anchor hierarchy","Benchmark ankor hiyerarşisi")}</h4><p>${L("Priority is: observed VIOP TLREF futures / swap / user market node. When those prices are unavailable, TCMB PKA policy-rate expectations are converted into TLREF-equivalent survey proxies using the current observed TLREF minus current TCMB policy-rate basis. Model interpolation is allowed only inside the genuine/proxy anchor horizon. Survey proxies are expectations, not exchange-traded forward prices.","Öncelik sırası: gözlenen VİOP TLREF futures / swap / kullanıcı piyasa düğümüdür. Bu fiyatlar yoksa TCMB PKA politika faizi beklentileri, güncel gözlenen TLREF eksi güncel TCMB politika faizi bazı kullanılarak TLREF-eşdeğer anket proxy'lerine çevrilir. Model interpolasyonuna yalnız gerçek/proxy ankor ufku içinde izin verilir. Anket proxy'leri beklentidir; borsada işlem gören forward fiyatları değildir.")}</p></div></div>
    <div class="method-step"><span>04</span><div><h4>${L("No fabricated long-end","Yapay uzun vade yok")}</h4><p>${L("The model does not extrapolate beyond the last genuine benchmark anchor by default. 3Y-10Y values remain unavailable until a genuine market/user node is supplied. The 10Y TRY government-bond yield is displayed as a reference marker unless explicitly promoted to a base-rate node.","Model varsayılan olarak son gerçek benchmark ankorunun ötesine ekstrapolasyon yapmaz. Gerçek piyasa/kullanıcı düğümü girilene kadar 3Y-10Y değerleri üretilmez. 10Y TL devlet tahvili getirisi açıkça baz-faiz düğümüne dönüştürülmedikçe referans işareti olarak gösterilir.")}</p></div></div>
    <div class="method-step"><span>05</span><div><h4>${L("Nelson-Siegel benchmark fit","Nelson-Siegel benchmark fit")}</h4><div class="formula-line">${nsFormula}</div><p>${L("NS is calibrated by bounded nonlinear least squares when at least four distinct benchmark nodes exist. β0 is level, β1 slope, β2 curvature and τ1 the decay/curvature-location parameter.","En az dört farklı benchmark düğümü olduğunda NS sınırlandırılmış doğrusal olmayan en küçük karelerle kalibre edilir. β0 seviye, β1 eğim, β2 eğrilik ve τ1 sönüm/eğrilik-konum parametresidir.")}</p></div></div>
    <div class="method-step"><span>06</span><div><h4>Svensson</h4><div class="formula-line">${svFormula}</div><p>${L("Svensson requires at least six distinct nodes and adds β3/τ2 for a second curvature component. When raw anchors are monotone, the optimization includes a shape penalty so the displayed line remains an actual NS/Svensson function rather than being replaced by a non-parametric post-fit curve.","Svensson en az altı farklı düğüm gerektirir ve ikinci eğrilik bileşeni için β3/τ2 ekler. Ham ankorlar monoton olduğunda optimizasyona şekil cezası eklenir; böylece gösterilen çizgi sonradan parametrik olmayan bir eğriyle değiştirilmek yerine gerçek NS/Svensson fonksiyonu olarak kalır.")}</p></div></div>
    <div class="method-step"><span>07</span><div><h4>${L("Loan-curve overlay","Kredi eğrisi yüklemeleri")}</h4><div class="formula-line">q_loan(T) = y_benchmark(T) + s_base + s_tenor(T) + l(T) + k(T) + f(T)</div><p>${L("Base credit spread, tenor adjustment, liquidity premium, capital charge and annualized fee equivalent are explicit loan-pricing overlays. They are never inferred from historical TLREF.","Baz kredi spreadi, vade ayarı, likidite primi, sermaye yükü ve yıllıklandırılmış ücret eşdeğeri açık kredi fiyatlama yüklemeleridir. Bunlar tarihsel TLREF'ten türetilmez.")}</p></div></div>
    <div class="method-step"><span>08</span><div><h4>${L("Tax and real-cost layer","Vergi ve reel-maliyet katmanı")}</h4><p>${L("BSMV, KKDF, fees, deductible financing-cost tax shield and the TCMB 12-month CPI expectation are applied after the quoted rate curve to derive cash-effective, after-tax and real borrowing cost by tenor.","BSMV, KKDF, ücretler, indirilebilir finansman gideri vergi kalkanı ve TCMB 12 aylık TÜFE beklentisi kotasyon eğrisinden sonra uygulanarak vade bazında nakit-efektif, vergi sonrası ve reel borçlanma maliyeti üretilir.")}</p></div></div>
    <div class="method-step"><span>09</span><div><h4>${L("Fit diagnostics","Fit tanıları")}</h4><p>${L("Raw anchors remain visible beside both fitted curves. NS/Svensson RMSE, source type, observed-node count and maximum genuine fit horizon are retained. A visually smooth line is never allowed to hide missing market data.","Ham ankorlar iki fit eğrisinin yanında görünür kalır. NS/Svensson RMSE, kaynak tipi, gözlenen düğüm sayısı ve azami gerçek fit ufku korunur. Görsel olarak düzgün bir çizginin eksik piyasa verisini gizlemesine izin verilmez.")}</p></div></div>
    <div class="method-step"><span>10</span><div><h4>${L("Official sources","Resmî kaynaklar")}</h4><p>${L("BIST supplies TLREF and the 1-month TLREF futures contract framework; TCMB PKA/EVDS supplies survey expectations including the 12-month CPI expectation. Live futures settlement prices are not fabricated when a public machine-readable price feed is unavailable.","BIST TLREF'i ve 1 aylık TLREF vadeli işlem sözleşmesi çerçevesini; TCMB PKA/EVDS ise 12 aylık TÜFE dahil anket beklentilerini sağlar. Kamuya açık makine-okunur fiyat akışı bulunmadığında canlı futures uzlaşma fiyatı uydurulmaz.")}</p><a class="method-source" href="${TLREF_OFFICIAL_URL}" target="_blank" rel="noopener">Borsa İstanbul - TLREF</a> · <a class="method-source" href="${TCMB_PKA_URL}" target="_blank" rel="noopener">TCMB - PKA</a></div></div>
  </div></section>`;
  return `<div class="methodology-grid">${cards.map(([a,b])=>panel(a,`<div class="formula-line">${esc(b)}</div>`)).join("")}</div>${curveBlock}`;
}
function sources(){return panel("OFFICIAL / TECHNICAL SOURCES",`<div class="source-list"><a href="https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=DUYURU%2FUNIVERSAL%2F2026%2F2026_Gecici67.pdf" target="_blank">GIB - Temporary Article 67 Guide 2026</a><a href="https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=DUYURU%2FUNIVERSAL%2F2026%2F2026_Kurumlar_Vergisi_Beyan_Rehberi.pdf" target="_blank">GIB - Corporate Tax Return Guide 2026</a><a href="https://gib.gov.tr/mevzuat/kanun/445/bkk/1849" target="_blank">GIB - BSMV consolidated rates</a><a href="https://gib.gov.tr/mevzuat/kanun/445/ozelge/36832" target="_blank">GIB - KKDF official ruling / rates</a><a href="${TLREF_OFFICIAL_URL}" target="_blank">Borsa İstanbul - Official TLREF / Historical Series</a><a href="https://www.borsaistanbul.com/piyasalar/viop/vadeli-islem-sozlesmeleri/faiz-vadeli-islem-sozlesmeleri" target="_blank">Borsa İstanbul - 1 Month TLREF Futures Contract</a><a href="${TCMB_PKA_URL}" target="_blank">TCMB - Piyasa Katılımcıları Anketi</a><a href="${TCMB_EVDS_URL}" target="_blank">TCMB EVDS - 12M CPI Expectation</a><div class="micro-note">${L("Curve source hierarchy is explicit. Survey-based policy anchors are never labelled as exchange-traded futures; long-end extrapolation is disabled unless genuine nodes are supplied.","Eğri kaynak hiyerarşisi açıktır. Anket bazlı politika faizi ankorları hiçbir zaman borsada işlem gören futures olarak etiketlenmez; gerçek düğüm sağlanmadıkça uzun vade ekstrapolasyonu kapalıdır.")}</div></div>`);}
function exportPage(){return `<div class="section-eyebrow">${I18N[state.language].export}</div><div class="grid two">${panel("VALUE-ONLY EXCEL / TURKISH",`<p>Calculated values, input snapshot, curve ladder, scenarios, sensitivity, methodology and sources. No macros and no model calculation formulas.</p><button class="export-button" data-export="tr">RESULT EXCEL TR</button>`)}${panel("VALUE-ONLY EXCEL / ENGLISH",`<p>Same analytics in English with the current calculation snapshot frozen as report values.</p><button class="export-button" data-export="en">RESULT EXCEL EN</button>`)}</div>`;}
function empty(){return `<div class="micro-note">Run the analysis engine to populate this section.</div>`;}

const pages={executive,inputs,tax:taxPage,borrower,investment,carry,lender,curve,ladder,scenarios,sensitivity,real,methodology,sources,export:exportPage};
function shell(){const tr=I18N[state.language];return `<div class="app-shell"><aside class="sidebar">${brand()}<nav class="nav-list">${NAV.map((key,i)=>`<button data-nav="${key}" class="${state.active===key?"active":""}"><span>${String(i+1).padStart(2,"0")}</span>${esc(tr[key])}</button>`).join("")}</nav><div class="sidebar-footer"><div class="atelier-star">${turkishFlag("turkish-flag footer")}</div><div>MK FinTECH LabGEN<br/><small>@2026 Istanbul Atelier</small></div></div></aside><main class="main-area"><header class="topbar"><div class="title-lockup"><div class="main-title">INTEREST LOAN COST SIMULATOR <span>INTELLIGENCE</span></div><div class="intro-label">MK FinTECH LabGEN @2026 Istanbul Atelier</div></div><div class="top-meta"><div><span>${tr.verified}</span><strong>${esc(state.taxVerified)}</strong></div><div><span>${tr.engine}</span><strong>${tr.active}</strong></div><div><span>CURVE</span><strong>NS / SVENSSON</strong></div><div><span>EXPORT</span><strong>VALUE-ONLY XLSX</strong></div></div><div class="header-controls"><div class="segmented"><button data-lang="en" class="${state.language==="en"?"active":""}">EN</button><button data-lang="tr" class="${state.language==="tr"?"active":""}">TR</button></div><div class="segmented"><button data-theme="dark" class="${state.theme==="dark"?"active":""}">DARK</button><button data-theme="light" class="${state.theme==="light"?"active":""}">LIGHT</button></div>${miniBrand()}</div></header>${state.error?`<div class="error-banner">API / ENGINE ERROR: ${esc(state.error)}</div>`:""}<div class="content-area">${pages[state.active]()}</div></main></div>`;}

function render(){document.documentElement.dataset.theme=state.theme;document.documentElement.lang=state.language;document.getElementById("app").innerHTML=shell();translateStaticText();requestAnimationFrame(drawCharts);}

function syncInputElement(el){
  if(!el || el.disabled)return;
  if(el.matches("[data-field]")){const key=el.dataset.field;let v=Number(el.value);if(!Number.isFinite(v))return;if(el.dataset.percent==="1")v/=100;state.input[key]=key==="days"?Math.max(1,Math.round(v)):v;}
  else if(el.matches("[data-date-field]")){state.input[el.dataset.dateField]=el.value;}
  else if(el.matches("[data-select]")){const key=el.dataset.select;state.input[key]=el.value;}
  else if(el.matches("[data-tenor-index]")){const i=Number(el.dataset.tenorIndex),key=el.dataset.tenorKey,p=state.input.tenor_points[i];if(key==="base_rate"){const raw=String(el.value).trim();p.base_rate=raw===""?null:Number(raw)/100;if(raw!==""){p.base_source="User / Market Node";p.base_source_type="user_market";}else{p.base_source=null;p.base_source_type=null;}}else{p[key]=Number(el.value)/100;}}
  else if(el.matches("[data-scenario-index]")){state.input.scenarios[Number(el.dataset.scenarioIndex)][el.dataset.scenarioKey]=Number(el.value)/100;}
}
function syncInputsFromDOM(){document.querySelectorAll("[data-field],[data-date-field],[data-select],[data-tenor-index],[data-scenario-index]").forEach(syncInputElement);}

const appRoot=document.getElementById("app");
appRoot.addEventListener("input",e=>{const el=e.target.closest("[data-field],[data-date-field],[data-tenor-index],[data-scenario-index]");if(el){syncInputElement(el);if(el.matches('[data-field="tlref"]'))state.useOfficialTLREF=false;if(el.matches('[data-field="inflation_12m_expectation"]')){state.useOfficialInflation=false;state.input.inflation=state.input.inflation_12m_expectation;}}});
appRoot.addEventListener("change",e=>{const el=e.target.closest("[data-field],[data-date-field],[data-select],[data-tenor-index],[data-scenario-index]");if(!el)return;syncInputElement(el);if(el.matches("[data-select='loan_type']")){state.input.bsmv_rate=el.value==="consumer"?.15:.05;state.input.kkdf_rate=el.value==="consumer"?.15:0;render();}else if(el.matches("[data-select='pricing_mode']")){render();}else if(el.matches("[data-select='curve_mode']")){if(el.value==="tcmb_survey")applyMacroCurveNodes();else clearMacroCurveNodes();simulate();}else if(el.matches("[data-date-field='valuation_date']")&&state.input.curve_mode==="tcmb_survey"){applyMacroCurveNodes();simulate();}});
appRoot.addEventListener("keydown",e=>{if(e.key==="Enter" && e.target.matches("input,select")){e.preventDefault();syncInputsFromDOM();simulate();}});
appRoot.addEventListener("click",e=>{
  const nav=e.target.closest("[data-nav]");if(nav){state.active=nav.dataset.nav;render();return;}
  const lang=e.target.closest("[data-lang]");if(lang){state.language=lang.dataset.lang;state.input.language=state.language;localStorage.setItem("mk-lang",state.language);render();return;}
  const theme=e.target.closest("[data-theme]");if(theme){state.theme=theme.dataset.theme;localStorage.setItem("mk-theme",state.theme);render();return;}
  const useOfficial=e.target.closest("[data-action='use-official-tlref']");if(useOfficial){if(state.marketTLREF?.latest?.rate!=null){state.useOfficialTLREF=true;state.input.tlref=Number(state.marketTLREF.latest.rate);const on=state.input.tenor_points.find(x=>x.label==="ON");if(on){on.base_rate=state.input.tlref;on.base_source="Borsa Istanbul TLREF";on.base_source_type="bist_tlref";}simulate();}return;}
  const refreshTLREF=e.target.closest("[data-action='refresh-tlref']");if(refreshTLREF){state.useOfficialTLREF=true;loadMarketTLREF(true,true);return;}
  const useInfl=e.target.closest("[data-action='use-official-inflation']");if(useInfl){const v=state.marketMacro?.inflation_12m?.value;if(v!=null){state.useOfficialInflation=true;state.input.inflation_12m_expectation=Number(v);state.input.inflation=Number(v);simulate();}return;}
  const refreshMacro=e.target.closest("[data-action='refresh-macro']");if(refreshMacro){state.useOfficialInflation=true;loadMarketMacro(true,true);return;}
  const applyCurve=e.target.closest("[data-action='apply-tcmb-curve']");if(applyCurve){applyMacroCurveNodes();simulate();return;}
  const range=e.target.closest("[data-tlref-range]");if(range){state.tlrefRange=range.dataset.tlrefRange;render();return;}
  const run=e.target.closest("[data-action='run']");if(run){syncInputsFromDOM();simulate();return;}
  const exp=e.target.closest("[data-export]");if(exp){syncInputsFromDOM();exportXlsx(exp.dataset.export);return;}
});
function draw(id,data,lay){const el=document.getElementById(id);if(el&&window.Plotly)Plotly.react(el,data,lay,plotConfig);}
function drawCurve(id){
  if(!state.result)return;
  const c=state.result.curve||{},fit=c.fitted||{},grid=fit.grid||[],rawNodes=c.raw_nodes||[];
  const isSnapshot=id==="chart-main-curve";
  const traces=[];
  if(rawNodes.length){
    traces.push({type:"scatter",mode:"markers",name:L("Observed / Survey Base Nodes","Gözlenen / Anket Baz Düğümleri"),x:rawNodes.map(n=>n.days),y:rawNodes.map(n=>n.rate),customdata:rawNodes.map(n=>[n.label,n.source,n.source_type]),marker:{size:8,symbol:"circle-open",color:state.theme==="dark"?"#8fa0ba":"#55657d",line:{width:1.5}},hovertemplate:"%{customdata[0]}<br>Base %{y:.2%}<br>%{customdata[2]}<br>%{customdata[1]}<extra></extra>"});
    traces.push({type:"scatter",mode:"markers",name:L("Observed All-in Loan Nodes","Gözlenen All-in Kredi Düğümleri"),x:rawNodes.map(n=>n.days),y:rawNodes.map(n=>n.all_in_quote_rate),customdata:rawNodes.map(n=>[n.label,n.source_type]),marker:{size:7,color:"#f39a2e",symbol:"diamond"},hovertemplate:"%{customdata[0]}<br>All-in %{y:.2%}<br>%{customdata[1]}<extra></extra>"});
  }
  if(c.curve_status==="term_structure_available" && grid.length){
    traces.push({type:"scatter",mode:"lines",name:fit.ns?.display_name||"Nelson-Siegel",x:grid.map(r=>r.days),y:grid.map(r=>r.ns),line:{color:"#8da6ca",width:2.0,dash:"dot"},hovertemplate:"NS %{y:.2%}<br>VKGS %{x}<extra></extra>"});
    if(grid.some(r=>r.svensson!=null))traces.push({type:"scatter",mode:"lines",name:fit.svensson?.display_name||"Svensson",x:grid.map(r=>r.days),y:grid.map(r=>r.svensson),line:{color:state.theme==="dark"?"#f5f7fb":"#20304a",width:2.1},hovertemplate:"Svensson %{y:.2%}<br>VKGS %{x}<extra></extra>"});
  }
  const bond=Number(state.input.ten_year_bond_yield);
  if(Number.isFinite(bond))traces.push({type:"scatter",mode:"markers",name:L("10Y TRY Bond Reference","10Y TL Tahvil Referansı"),x:[3650],y:[bond],marker:{size:9,symbol:"x",color:"#c05c57"},hovertemplate:"10Y TRY Bond %{y:.2%}<extra></extra>"});
  const allY=[];for(const t of traces){for(const v of (t.y||[]))if(Number.isFinite(Number(v)))allY.push(Number(v));}
  let ymin=allY.length?Math.min(...allY):0,ymax=allY.length?Math.max(...allY):.5;const span=Math.max(ymax-ymin,0);const pad=Math.max(.005,span*.12);ymin-=pad;ymax+=pad;
  const l=layout(isSnapshot?"":L("Observed/Survey-Anchored Loan Term Structure - NS / Svensson","Gözlenen/Anket-Ankorlu Kredi Vade Yapısı - NS / Svensson"),true);
  l.margin.t=isSnapshot?60:96;l.legend={orientation:"h",y:isSnapshot?1.11:1.15,x:1,xanchor:"right",font:{size:9}};
  const tickRows=(c.rows||[]).filter(r=>r.days<=Math.max(c.max_fit_days||0,3650));
  l.xaxis={title:L("VKGS / Days to Maturity","VKGS / Vadeye Kalan Gün"),type:"log",gridcolor:state.theme==="dark"?"#1a2b49":"#e6ebf2",tickmode:"array",tickvals:tickRows.map(r=>r.days),ticktext:tickRows.map(r=>r.label),range:[0,Math.log10(Math.max(3650,c.max_fit_days||1))]};
  l.yaxis={title:L("Annual Rate","Yıllık Oran"),tickformat:".1%",range:[ymin,ymax],gridcolor:state.theme==="dark"?"#1a2b49":"#e6ebf2",zeroline:false};
  if(c.curve_status!=="term_structure_available")l.annotations=[{xref:"paper",yref:"paper",x:.5,y:.50,showarrow:false,align:"center",text:L("Insufficient distinct tenor nodes for NS/Svensson. Add market/user nodes or apply TCMB PKA anchors.","NS/Svensson için yeterli farklı vade düğümü yok. Piyasa/kullanıcı düğümleri ekleyin veya TCMB PKA ankorlarını uygulayın."),font:{size:isSnapshot?10:12,color:state.theme==="dark"?"#8fa0ba":"#637189"}}];
  draw(id,traces,l);
}
function drawTLREFHistory(id){
  const el=document.getElementById(id);if(!el||!window.Plotly)return;
  const full=state.marketTLREF?.history||[];
  if(!full.length){draw(id,[],{...layout(L("Official TLREF history unavailable","Resmî TLREF tarihçesi kullanılamıyor"),true),annotations:[{text:L("No official series loaded.","Resmî seri yüklenmedi."),xref:"paper",yref:"paper",x:.5,y:.5,showarrow:false}]});return;}
  const dates=full.map(r=>new Date(`${r.date}T00:00:00Z`)),rates=full.map(r=>Number(r.rate));
  const roll=(n)=>rates.map((_,i)=>{const s=Math.max(0,i-n+1),a=rates.slice(s,i+1);return a.reduce((x,y)=>x+y,0)/a.length;});
  const ma21=roll(21),ma63=roll(63);const end=dates[dates.length-1];const daysMap={"1M":31,"6M":183,"1Y":365,"5Y":1826};const cutoff=state.tlrefRange==="ALL"?null:new Date(end.getTime()-daysMap[state.tlrefRange]*86400000);
  const idx=dates.map((d,i)=>({d,i})).filter(x=>!cutoff||x.d>=cutoff).map(x=>x.i);
  const x=idx.map(i=>full[i].date),y=idx.map(i=>rates[i]),m21=idx.map(i=>ma21[i]),m63=idx.map(i=>ma63[i]);
  const all=[...y,...m21,...m63].filter(Number.isFinite);const lo=Math.min(...all),hi=Math.max(...all),pad=Math.max(.003,(hi-lo)*.08);
  const l=layout(L("Borsa Istanbul TLREF - official daily history","Borsa İstanbul TLREF - resmî günlük tarihçe"),true);l.xaxis={title:L("Date","Tarih"),gridcolor:state.theme==="dark"?"#1a2b49":"#e6ebf2"};l.yaxis={title:"TLREF",tickformat:".1%",range:[lo-pad,hi+pad],gridcolor:state.theme==="dark"?"#1a2b49":"#e6ebf2"};
  draw(id,[{type:"scatter",mode:"lines",name:"TLREF",x,y,line:{color:"#f39a2e",width:1.8},hovertemplate:"%{x}<br>TLREF %{y:.4%}<extra></extra>"},{type:"scatter",mode:"lines",name:"21D MA",x,y:m21,line:{color:"#8da6ca",width:1.1,dash:"dot"},hovertemplate:"21D %{y:.2%}<extra></extra>"},{type:"scatter",mode:"lines",name:"63D MA",x,y:m63,line:{color:state.theme==="dark"?"#f5f7fb":"#20304a",width:1.1,dash:"dash"},hovertemplate:"63D %{y:.2%}<extra></extra>"}],l);
}
function drawCharts(){if(!state.result)return;const r=state.result,k=r.kpis,dark=state.theme==="dark";if(state.active==="executive"){draw("chart-main-compare",[{type:"bar",x:["TLREF Gross","Investment After-Tax","Borrowing Cash","Borrowing After-Tax"],y:[r.investment.gross_effective_annual,r.investment.after_tax_effective_annual,r.borrower.cash_effective_annual,r.borrower.after_tax_effective_annual],marker:{color:["#f39a2e","#d6781d","#7b879d",dark?"#f5f7fb":"#20304a"]}}],{...layout(L("Effective annual comparison","Efektif yillik karsilastirma")),showlegend:false});draw("chart-main-scenario",[{type:"bar",x:r.scenarios.rows.map(x=>x.name),y:r.scenarios.rows.map(x=>x.net_carry_effective_annual),marker:{color:r.scenarios.rows.map(x=>x.net_carry_effective_annual>=0?"#d6781d":"#c05c57")}}],{...layout(L("Probability-weighted scenario set","Olasilik agirlikli senaryo seti")),showlegend:false});drawCurve("chart-main-curve");}
  if(state.active==="borrower"){const b=r.borrower;const l=layout(L("Cash to economic cost bridge","Nakit maliyetten ekonomik maliyete kopru"));l.yaxis={tickformat:",.0f",gridcolor:dark?"#1a2b49":"#e6ebf2"};draw("chart-borrower",[{type:"waterfall",x:["Interest","BSMV","KKDF","Fee","Commission","Tax Shield","After-Tax"],y:[b.interest,b.bsmv,b.kkdf,b.upfront_fee,b.commission,-b.tax_shield,0],measure:["relative","relative","relative","relative","relative","relative","total"]}],l);}
  if(state.active==="investment"){drawTLREFHistory("chart-tlref-history");const i=r.investment;let l=layout(L("Investment tax bridge","Yatirim vergi koprusu"));l.yaxis={tickformat:",.0f",gridcolor:dark?"#1a2b49":"#e6ebf2"};draw("chart-tax-bridge",[{type:"waterfall",x:["Gross Income","Cash Withholding","Tax Credit","Additional Tax","After-Tax Income"],y:[i.gross_income,-i.withholding_cash,i.withholding_credit,-i.additional_tax_payable,0],measure:["relative","relative","relative","relative","total"]}],l);draw("chart-invest-return",[{type:"bar",x:["Gross","After-Tax","Real After-Tax"],y:[i.gross_effective_annual,i.after_tax_effective_annual,i.real_after_tax_effective],marker:{color:["#f39a2e",dark?"#f5f7fb":"#20304a","#75839a"]}}],{...layout(L("Return normalization","Getiri normalizasyonu")),showlegend:false});}
  if(state.active==="carry"){draw("chart-break-even",[{type:"bar",name:L("After-Tax Investment","Vergi Sonrasi Yatirim"),x:["Current"],y:[r.investment.after_tax_effective_annual],marker:{color:"#f39a2e"}},{type:"bar",name:L("After-Tax Borrowing","Vergi Sonrasi Kredi"),x:["Current"],y:[r.borrower.after_tax_effective_annual],marker:{color:dark?"#f5f7fb":"#20304a"}},{type:"scatter",mode:"markers",name:L("Break-Even Loan Rate","Basabas Kredi Faizi"),x:["Current"],y:[k.break_even_loan_rate],marker:{color:"#c05c57",size:10}}],layout(L("Current economics versus break-even","Mevcut ekonomi ve basabas")));}
  if(state.active==="lender"){const x=r.lender;let l=layout(L("Loan economics from lender perspective","Kredi veren acisindan kredi ekonomisi"));l.yaxis={tickformat:",.0f",gridcolor:dark?"#1a2b49":"#e6ebf2"};draw("chart-lender",[{type:"waterfall",x:["Interest","Funding","ECL","Opex","Capital","Tax","After-Tax"],y:[x.interest_income,-x.funding_cost,-x.ecl,-x.opex,-x.capital_liquidity_charge,-x.tax,0],measure:["relative","relative","relative","relative","relative","relative","total"]}],l);}
  if(state.active==="curve")drawCurve("chart-curve-wide");
  if(state.active==="scenarios"){const s=r.scenarios.rows;const l=layout(L("Scenario map","Senaryo haritasi"));l.xaxis={title:"Probability",tickformat:".0%",gridcolor:dark?"#1a2b49":"#e6ebf2"};l.yaxis={title:"Net Carry",tickformat:".1%",gridcolor:dark?"#1a2b49":"#e6ebf2"};draw("chart-scenario-map",[{type:"scatter",mode:"markers+text",textposition:"top center",text:s.map(x=>x.name),x:s.map(x=>x.probability),y:s.map(x=>x.net_carry_effective_annual),marker:{size:s.map(x=>18+x.probability*40),color:s.map(x=>x.net_carry_effective_annual>=0?"#f39a2e":"#c05c57")}}],l);}
  if(state.active==="sensitivity"){const s=r.sensitivity;const l=layout(L("Net carry sensitivity","Net carry duyarliligi"),true);l.xaxis={title:L("Credit Spread (%)","Kredi Spread (%)")};l.yaxis={title:"TLREF (%)"};draw("chart-sensitivity",[{type:"heatmap",x:s.spread_values.map(x=>x*100),y:s.tlref_values.map(x=>x*100),z:s.grid.map(row=>row.map(x=>x*100)),colorscale:[[0,"#8c4547"],[.5,"#2c3952"],[1,"#e18a29"]],colorbar:{title:"Carry %"},hovertemplate:"Spread %{x:.2f}%<br>TLREF %{y:.2f}%<br>Net Carry %{z:.2f}%<extra></extra>"}],l);}
  if(state.active==="real"){draw("chart-real",[{type:"bar",name:L("Borrowing","Kredi Maliyeti"),x:["Nominal","After-Tax","Real"],y:[r.borrower.cash_effective_annual,r.borrower.after_tax_effective_annual,r.borrower.real_after_tax_effective],marker:{color:dark?"#f5f7fb":"#20304a"}},{type:"bar",name:L("Investment","Yatirim"),x:["Nominal","After-Tax","Real"],y:[r.investment.gross_effective_annual,r.investment.after_tax_effective_annual,r.investment.real_after_tax_effective],marker:{color:"#f39a2e"}}],{...layout(L("Inflation-normalized economics","Enflasyon duzeltilmis ekonomi")),barmode:"group"});}
}

boot();
