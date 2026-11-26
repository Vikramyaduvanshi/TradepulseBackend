require("dotenv").config();
const { OpenAI } = require("openai");

const client = new OpenAI({
  apiKey:  process.env.groq_api_key2 ,
  baseURL: "https://api.groq.com/openai/v1",
});

// ⚠️ File ke upar apne existing imports / `client` (OpenAI-compatible) wahi rakho.
// File ke neeche apna purana module.exports bhi wahi rakho.

// ⚠️ File ke upar apne existing imports / `client` (OpenAI-compatible) wahi rakho.
// File ke neeche apna purana module.exports bhi wahi rakho.
// ⚠️ File ke upar apne existing imports / `client` (OpenAI-compatible) wahi rakho.
// File ke neeche apna purana module.exports bhi wahi rakho.

const OUTPUT_LANGUAGE = "simple English"; // "Hinglish" / "Hindi" bhi kar sakte ho

// ==========================================
// HELPERS
// ==========================================
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[,%₹\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Number(Number(x).toFixed(d)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const pct = (a, b) => (a != null && b != null && b !== 0 ? (a / b - 1) * 100 : null);
const numArr = (arr) => (Array.isArray(arr) ? arr.map(num).filter((x) => x != null) : []);
const stanceOf = (s) => (s >= 60 ? "BULLISH" : s <= 40 ? "BEARISH" : "NEUTRAL");

function cleanJSON(text) {
  try {
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

async function callAI(prompt, retry = 2) {
  try {
    const res = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful, senior equity analyst explainer. Return STRICT VALID JSON ONLY. Use only the numbers given. Never invent data. If a value is missing, say it is missing.",
        },
        { role: "user", content: prompt },
      ],
    });
    return res.choices[0].message.content;
  } catch (err) {
    if (retry > 0) {
      await sleep(800 * (3 - retry));
      return callAI(prompt, retry - 1);
    }
    throw err;
  }
}

// ==========================================
// TIME / FRESHNESS (NSE: Mon-Fri 9:15-15:30 IST)
// ==========================================
const DAY = 86400000;
const isBiz = (t) => {
  const g = new Date(t).getUTCDay();
  return g !== 0 && g !== 6;
};
const prevBiz = (t) => {
  let x = t - DAY;
  while (!isBiz(x)) x -= DAY;
  return x;
};
const bizLag = (from, to) => {
  if (from == null || to == null || from >= to) return 0;
  let n = 0, x = from;
  while (x < to) {
    x += DAY;
    if (isBiz(x)) n++;
  }
  return n;
};

function istParts(now) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

function marketState(now) {
  const p = istParts(now);
  const today = Date.UTC(p.y, p.m - 1, p.d);
  const mins = p.h * 60 + p.min;
  const OPEN = 9 * 60 + 15, CLOSE = 15 * 60 + 30;
  const biz = isBiz(today);
  const open = biz && mins >= OPEN && mins < CLOSE;

  let lastCompleted;
  if (biz && mins >= CLOSE) lastCompleted = today;
  else if (biz) lastCompleted = prevBiz(today);
  else {
    let x = today;
    while (!isBiz(x)) x -= DAY;
    lastCompleted = x;
  }
  return { open, today, lastCompleted };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseDMY(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})[-\/ ]([A-Za-z]{3}|\d{1,2})[-\/ ](\d{4})/);
  if (!m) return null;
  const mo = /^\d+$/.test(m[2]) ? +m[2] : MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  return Date.UTC(+m[3], mo - 1, +m[1]);
}

function fmtLag(date, lag) {
  if (!date) return null;
  return lag > 0 ? `${date} (${lag} session${lag > 1 ? "s" : ""} behind)` : date;
}

// ==========================================
// DATA CLEANING + INTEGRITY
// ==========================================
function prepareNews(newsData, now) {
  const items = Array.isArray(newsData)
    ? newsData.filter((n) => n && typeof n === "object" && n.details)
    : [];
  return items.slice(0, 5).map((n) => {
    const t = Date.parse(n.date);
    return {
      date: n.date,
      ageDays: Number.isFinite(t) ? Math.round((now.getTime() - t) / DAY) : null,
      details: String(n.details).slice(0, 700),
    };
  });
}

// StockEdge ka data usi company ka hai ya nahi (screener EPS se match)
function verifyStockEdge(screenerData, fund) {
  if (!Array.isArray(fund) || fund.length === 0) return { ok: false, reason: "no_data" };
  const eps = numArr(screenerData?.eps);
  const scrEps = eps[eps.length - 1];
  const seEps = num(fund[0]?.EPS);
  if (scrEps == null || seEps == null || scrEps === 0) return { ok: true, unverified: true };
  const ratio = seEps / scrEps;
  if (ratio < 0.5 || ratio > 2) {
    return { ok: false, reason: "company_mismatch", detail: `EPS ${seEps} vs screener EPS ${scrEps}` };
  }
  return { ok: true };
}

function compactQuarters(fund) {
  return (fund || []).slice(0, 3).map((q) => ({
    quarter: q.DateEndName,
    sales: round(q.NET_SALES),
    salesGrowthYoY: round(q.NET_SALES_Growth_Yoy),
    ebitda: round(q.EBITDA),
    ebitdaMargin: round(q.EBITDA_Margin),
    netProfit: round(q.NET_PROFIT),
    profitGrowthYoY: round(q.NET_PROFIT_Growth_YoY),
    eps: round(q.EPS),
  }));
}

const normName = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\.(ns|bo)$/, "")
    .replace(/\b(limited|ltd|the|corporation|corp|company|co|inc|of|india|and)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function sameCompany(a, b) {
  const A = normName(a), B = normName(b);
  if (!A.length || !B.length) return null;
  const setB = new Set(B);
  const common = A.filter((x) => setB.has(x)).length;
  return common / Math.min(A.length, B.length) >= 0.5;
}

// Alag-alag sources ek hi company ke hain ya nahi
function checkIntegrity({ screenerData, technicalData }) {
  const issues = [];
  const s = screenerData?.company, t = technicalData?.companyName;
  if (s && t && sameCompany(s, t) === false) {
    issues.push(`Company mismatch between sources: "${s}" (fundamentals) vs "${t}" (technicals)`);
  }
  const p1 = num(screenerData?.currentPrice), p2 = num(technicalData?.currentPrice);
  if (p1 && p2 && Math.abs(p1 / p2 - 1) > 0.05) {
    issues.push(`Price mismatch between sources: ${p1} vs ${p2}`);
  }
  return issues;
}

// ==========================================
// SECTOR: company ka sector -> NSE index (fallback)
// ==========================================
const SECTOR_MAP = [
  { test: (s, i) => /financial/i.test(s) && /bank/i.test(i), names: ["NIFTY BANK", "NIFTY PSU BANK", "NIFTY PRIVATE BANK"] },
  { test: (s, i) => /financial/i.test(s) && /capital markets|asset management/i.test(i), names: ["NIFTY CAPITAL MARKETS", "NIFTY FINANCIAL SERVICES"] },
  { test: (s) => /financial/i.test(s), names: ["NIFTY FINANCIAL SERVICES", "NIFTY FINANCIAL SERVICES 25/50", "NIFTY FIN SERVICE"] },
  { test: (s, i) => /industrials/i.test(s) && /aerospace|defense/i.test(i), names: ["NIFTY INDIA DEFENCE"] },
  { test: (s) => /industrials/i.test(s), names: ["NIFTY INDIA MANUFACTURING", "NIFTY CPSE", "NIFTY INFRASTRUCTURE", "NIFTY INDUSTRIAL"] },
  { test: (s) => /technology/i.test(s), names: ["NIFTY IT"] },
  { test: (s) => /healthcare/i.test(s), names: ["NIFTY PHARMA", "NIFTY HEALTHCARE INDEX"] },
  { test: (s) => /energy/i.test(s), names: ["NIFTY ENERGY", "NIFTY OIL & GAS"] },
  { test: (s) => /utilities/i.test(s), names: ["NIFTY ENERGY", "NIFTY POWER"] },
  { test: (s) => /basic materials/i.test(s), names: ["NIFTY METAL"] },
  { test: (s, i) => /consumer cyclical/i.test(s) && /auto/i.test(i), names: ["NIFTY AUTO"] },
  { test: (s) => /consumer cyclical/i.test(s), names: ["NIFTY CONSUMER DURABLES", "NIFTY AUTO"] },
  { test: (s) => /consumer defensive/i.test(s), names: ["NIFTY FMCG"] },
  { test: (s) => /real estate/i.test(s), names: ["NIFTY REALTY"] },
  { test: (s) => /communication/i.test(s), names: ["NIFTY MEDIA", "NIFTY MIDSMALL IT & TELECOM"] },
];

function suggestSector(sector, industry) {
  const hit = SECTOR_MAP.find((m) => m.test(String(sector || ""), String(industry || "")));
  return hit ? hit.names : [];
}

function deriveSector(sector, industry, NSEdata) {
  const names = suggestSector(sector, industry).map((n) => n.toUpperCase());
  if (!names.length || !NSEdata) return null;
  const all = [
    ...(NSEdata.topStrongSector || []), ...(NSEdata.topWeakSector || []),
    ...(NSEdata.todayGainers || []), ...(NSEdata.todayLosers || []),
  ];
  for (const n of names) {
    const hit = all.find((x) => String(x.sector || x.indexName || "").toUpperCase() === n);
    if (hit) return { ...hit, matchType: "derived" };
  }
  return null;
}

// ==========================================
// DERIVED METRICS (raw data se khud nikaale)
// ==========================================
function deriveFundamentals(screenerData, price) {
  const p = numArr(screenerData?.profit);
  const e = numArr(screenerData?.eps);
  const sl = numArr(screenerData?.sales);
  const n = p.length;

  const yoy = (arr) => (arr.length >= 5 && arr[arr.length - 5] > 0 ? pct(arr[arr.length - 1], arr[arr.length - 5]) : null);

  const profitYoY = yoy(p) ?? num(screenerData?.profitGrowthYoY);
  const salesYoY = yoy(sl) ?? num(screenerData?.salesGrowthYoY);
  const profitQoQ = n >= 2 && p[n - 2] > 0 ? pct(p[n - 1], p[n - 2]) : null;

  const last8 = p.slice(-8);
  const positiveQuarters = last8.length ? last8.filter((x) => x > 0).length : null;

  const last4eps = e.slice(-4);
  const ttmEps = last4eps.length === 4 ? last4eps.reduce((a, b) => a + b, 0) : null;
  const epsMean = mean(last4eps);
  const epsCV = last4eps.length === 4 && epsMean ? sd(last4eps) / Math.abs(epsMean) : null;

  const peReported = num(screenerData?.pe);
  const peCalc = price && ttmEps && ttmEps > 0 ? price / ttmEps : null;
  const bookValue = num(screenerData?.bookValue);
  const pb = price && bookValue ? price / bookValue : null;

  return {
    profitYoY: round(profitYoY, 1),
    salesYoY: round(salesYoY, 1),
    profitQoQ: round(profitQoQ, 1),
    positiveQuarters, quartersChecked: last8.length,
    ttmEps: round(ttmEps), epsCV: round(epsCV),
    peReported, peCalc: round(peCalc, 1),
    bookValue, pb: round(pb),
    roe: num(screenerData?.roe), roce: num(screenerData?.roce), opm: num(screenerData?.opm),
  };
}

function deriveDelivery(deliveryData) {
  const dp = Array.isArray(deliveryData?.dataPoints) ? deliveryData.dataPoints : [];
  const pcts = dp.map((d) => num(d.deliveryPercentage)).filter((x) => x != null);
  const vols = dp.map((d) => num(d.tradedQty)).filter((x) => x != null);
  const first3 = pcts.length >= 6 ? mean(pcts.slice(0, 3)) : null;
  const last3 = pcts.length >= 6 ? mean(pcts.slice(-3)) : null;
  const prevVols = vols.slice(0, -1);
  const volRatio = vols.length >= 3 ? vols[vols.length - 1] / mean(prevVols) : null;
  return {
    current: num(deliveryData?.currentDelivery),
    avg7: num(deliveryData?.avg7DayDelivery),
    momentum: deliveryData?.momentum || null,
    trendPts: first3 != null && last3 != null ? round(last3 - first3, 1) : null,
    min: pcts.length ? Math.min(...pcts) : null,
    max: pcts.length ? Math.max(...pcts) : null,
    volRatio: round(volRatio),
    lastDate: dp.length ? dp[dp.length - 1].date : null,
    series: dp.map((d) => ({ date: d.date, deliveryPct: d.deliveryPercentage })),
  };
}

function deriveFlows(fiiDiiData) {
  const rows = fiiDiiData?.data || [];
  const fii = rows.find((r) => /FII/i.test(r.category));
  const dii = rows.find((r) => /DII/i.test(r.category));
  return {
    fiiNet: fii ? num(fii.netValue) : null,
    diiNet: dii ? num(dii.netValue) : null,
    date: fii?.date || dii?.date || null,
  };
}

// ==========================================
// SCORECARDS (0-100, higher = more favourable)
// ==========================================
function cardTechnical(t, volReliable) {
  const price = num(t?.currentPrice), d50 = num(t?.dma50), d200 = num(t?.dma200);
  const rsi = num(t?.rsi), vs = num(t?.volumeSpike);
  if (price == null || d50 == null || d200 == null) return null;

  let s = 50;
  const ev = [];
  const dist50 = pct(price, d50), dist200 = pct(price, d200);

  if (price > d50) { s += 12; ev.push(`Price is ${round(dist50, 1)}% above 50-DMA (${d50})`); }
  else { s -= 12; ev.push(`Price is ${round(Math.abs(dist50), 1)}% below 50-DMA (${d50})`); }

  if (price > d200) { s += 10; ev.push(`Price is ${round(dist200, 1)}% above 200-DMA (${d200})`); }
  else { s -= 10; ev.push(`Price is ${round(Math.abs(dist200), 1)}% below 200-DMA (${d200})`); }

  if (d50 > d200) { s += 6; ev.push("50-DMA is above 200-DMA (positive structure)"); }
  else { s -= 6; ev.push("50-DMA is below 200-DMA (negative structure)"); }

  if (t?.macd) {
    if (t.macd === "Bullish") { s += 8; ev.push("MACD is bullish"); }
    else { s -= 8; ev.push("MACD is bearish"); }
  }

  if (rsi != null) {
    if (rsi > 70) { s -= 8; ev.push(`RSI ${rsi} is overbought`); }
    else if (rsi >= 55) { s += 6; ev.push(`RSI ${rsi} shows strength`); }
    else if (rsi >= 40) ev.push(`RSI ${rsi} is neutral`);
    else if (rsi >= 30) { s -= 5; ev.push(`RSI ${rsi} is weak`); }
    else { s += 5; ev.push(`RSI ${rsi} is oversold (bounce possible)`); }
  }

  if (vs != null) {
    if (!volReliable) {
      ev.push(`Volume is ${vs}x normal so far today (market is open, partial day, not scored)`);
    } else if (vs >= 1.3) { s += 6; ev.push(`Volume is ${vs}x normal (confirming)`); }
    else if (vs < 0.8) { s -= 6; ev.push(`Volume is only ${vs}x normal (weak participation)`); }
    else ev.push(`Volume is ${vs}x normal`);
  }

  if (t?.trend === "Weak") { s -= 5; ev.push("Source trend rating: Weak"); }
  else if (t?.trend === "Strong") { s += 5; ev.push("Source trend rating: Strong"); }

  s = clamp(Math.round(s), 0, 100);
  return { key: "technical", name: "Technical trend", score: s, stance: stanceOf(s), evidence: ev };
}

function cardParticipation(dv, fl, flowLag) {
  if (dv.current == null && fl.fiiNet == null && fl.diiNet == null) return null;
  let s = 50;
  const ev = [];

  if (dv.current != null && dv.avg7 != null) {
    const diff = dv.current - dv.avg7;
    if (diff > 3) { s += 12; ev.push(`Delivery ${dv.current}% is above its 7-day average (${dv.avg7}%)`); }
    else if (diff < -3) { s -= 12; ev.push(`Delivery ${dv.current}% is below its 7-day average (${dv.avg7}%)`); }
    else ev.push(`Delivery ${dv.current}% is close to its 7-day average (${dv.avg7}%)`);
  }
  if (dv.trendPts != null) {
    if (dv.trendPts > 2) { s += 8; ev.push(`Delivery rose ${dv.trendPts} pts over the week`); }
    else if (dv.trendPts < -2) { s -= 8; ev.push(`Delivery fell ${Math.abs(dv.trendPts)} pts over the week`); }
  }
  if (dv.current != null) {
    if (dv.current >= 55) { s += 6; ev.push("High delivery share suggests investor-type buying"); }
    else if (dv.current < 35) { s -= 6; ev.push("Low delivery share suggests speculative trading"); }
  }
  if (dv.volRatio != null) {
    if (dv.volRatio >= 1.3) ev.push(`Last full-day traded volume was ${dv.volRatio}x the earlier average`);
    else if (dv.volRatio < 0.7) { s -= 4; ev.push(`Last full-day traded volume was only ${dv.volRatio}x the earlier average`); }
  }

  // purane flows ka weight aadha
  const ff = flowLag >= 1 ? 0.5 : 1;
  const age = flowLag >= 1 ? ` [${fl.date}, ${flowLag} session${flowLag > 1 ? "s" : ""} old, half weight]` : "";
  if (fl.fiiNet != null) {
    if (fl.fiiNet > 1000) { s += 10 * ff; ev.push(`FII net buying ₹${round(fl.fiiNet, 0)} Cr${age}`); }
    else if (fl.fiiNet < -1000) { s -= 10 * ff; ev.push(`FII net selling ₹${round(Math.abs(fl.fiiNet), 0)} Cr${age}`); }
    else ev.push(`FII flow is small (₹${round(fl.fiiNet, 0)} Cr)${age}`);
  }
  if (fl.diiNet != null) {
    if (fl.diiNet > 1000) { s += 5 * ff; ev.push(`DII net buying ₹${round(fl.diiNet, 0)} Cr`); }
    else if (fl.diiNet < -1000) { s -= 5 * ff; ev.push(`DII net selling ₹${round(Math.abs(fl.diiNet), 0)} Cr`); }
  }

  s = clamp(Math.round(s), 0, 100);
  return { key: "participation", name: "Smart money & participation", score: s, stance: stanceOf(s), evidence: ev };
}

function cardFundamentals(f, quarters, isFin) {
  const has = f.profitYoY != null || f.roe != null || f.salesYoY != null;
  if (!has) return null;
  let s = 50;
  const ev = [];

  if (f.profitYoY != null) {
    if (f.profitYoY > 30) s += 12;
    else if (f.profitYoY > 10) s += 6;
    else if (f.profitYoY < -30) s -= 15;
    else if (f.profitYoY < -10) s -= 8;
    ev.push(`Profit growth YoY (latest quarter, standalone): ${f.profitYoY}%`);
  }
  if (f.salesYoY != null) {
    if (f.salesYoY > 15) s += 6;
    else if (f.salesYoY < -5) s -= 6;
    ev.push(`Sales growth YoY (latest quarter, standalone): ${f.salesYoY}%`);
  }
  if (f.profitQoQ != null) ev.push(`Profit vs previous quarter: ${f.profitQoQ}%`);

  if (f.positiveQuarters != null && f.quartersChecked >= 6) {
    if (f.positiveQuarters >= f.quartersChecked - 1) { s += 6; ev.push(`Profitable in ${f.positiveQuarters} of last ${f.quartersChecked} quarters (consistent)`); }
    else if (f.positiveQuarters <= f.quartersChecked / 2) { s -= 8; ev.push(`Profitable in only ${f.positiveQuarters} of last ${f.quartersChecked} quarters`); }
    else ev.push(`Profitable in ${f.positiveQuarters} of last ${f.quartersChecked} quarters`);
  }

  if (f.roe != null) {
    const hi = isFin ? 15 : 18, mid = isFin ? 11 : 12;   // lenders ke liye ROE thresholds thode kam
    if (f.roe >= hi) s += 10;
    else if (f.roe >= mid) s += 4;
    else if (f.roe < 8) s -= 8;
    ev.push(`ROE ${f.roe}%`);
  }
  if (isFin) {
    ev.push("ROCE and operating margin are not used for lenders");
  } else {
    if (f.roce != null) {
      if (f.roce >= 18) s += 6;
      else if (f.roce < 10) s -= 4;
      ev.push(`ROCE ${f.roce}%`);
    }
    if (f.opm != null) {
      if (f.opm >= 15) s += 4;
      else if (f.opm < 8) s -= 4;
      ev.push(`Operating margin ${f.opm}%`);
    }
  }
  if (f.epsCV != null && f.epsCV > 0.6) { s -= 4; ev.push("Quarterly EPS is lumpy (high variation)"); }

  if (quarters?.length) {
    const q = quarters[0];
    if (q.profitGrowthYoY != null) {
      if (q.profitGrowthYoY > 10) s += 4;
      else if (q.profitGrowthYoY < -10) s -= 4;
      ev.push(`Consolidated profit growth YoY (${q.quarter}): ${q.profitGrowthYoY}%`);
    }
  }

  s = clamp(Math.round(s), 0, 100);
  return { key: "fundamentals", name: "Fundamentals quality", score: s, stance: stanceOf(s), evidence: ev };
}

function cardValuation(f, sec, sectorOk, niftyPe, isFin) {
  if (f.peReported == null && f.pb == null) return null;
  let s = 50;
  const ev = [];
  const pe = f.peReported;
  const sPe = num(sec?.pe);

  if (isFin && f.pb != null && f.roe != null && f.roe > 0) {
    // Lender: P/B vs ROE se judge karo (justified P/B ~ ROE / cost of equity)
    const fair = f.roe / 12;
    const r = f.pb / fair;
    s += r < 0.7 ? 18 : r < 0.9 ? 8 : r > 1.5 ? -18 : r > 1.2 ? -8 : 0;
    ev.push(`P/B ${f.pb} vs justified P/B ≈ ${round(fair)} (ROE ${f.roe}% ÷ 12% cost of equity, simple heuristic)`);
    ev.push(`Book value ₹${f.bookValue} per share`);
    if (pe) {
      if (sectorOk && sPe) {
        const rr = pe / sPe;
        s += rr < 0.8 ? 5 : rr > 1.25 ? -5 : 0;
        ev.push(`PE ${pe} vs sector PE ${sPe} (${round(rr)}x)`);
      } else ev.push(`PE ${pe} (lenders normally trade at low PE, so it is not compared with Nifty)`);
      if (f.peCalc && Math.abs(f.peCalc / pe - 1) <= 0.1) ev.push(`PE matches TTM EPS ${f.ttmEps}`);
    }
  } else {
    if (pe) {
      if (sectorOk && sPe) {
        const r = pe / sPe;
        s += r < 0.7 ? 15 : r < 0.9 ? 7 : r > 1.3 ? -15 : r > 1.1 ? -7 : 0;
        ev.push(`PE ${pe} vs sector PE ${sPe} (${round(r)}x)`);
      } else if (niftyPe) {
        const r = pe / niftyPe;
        s += r < 0.8 ? 10 : r < 1 ? 4 : r > 1.5 ? -12 : r > 1.2 ? -5 : 0;
        ev.push(`PE ${pe} vs Nifty PE ${niftyPe} (${round(r)}x)`);
      } else ev.push(`PE ${pe}`);
      if (f.peCalc && Math.abs(f.peCalc / pe - 1) <= 0.1) ev.push(`PE matches TTM EPS ${f.ttmEps}`);
    }
    if (f.pb != null) {
      ev.push(`P/B ${f.pb} (book value ₹${f.bookValue} per share)`);
      if (f.roe != null) {
        if (f.pb > 3 && f.roe < 10) { s -= 10; ev.push(`P/B ${f.pb} is high for ROE ${f.roe}%`); }
        else if (f.pb <= 3 && f.roe >= 12) { s += 8; ev.push("Reasonable P/B with healthy ROE"); }
      }
    }
  }

  s = clamp(Math.round(s), 0, 100);
  return { key: "valuation", name: "Valuation", score: s, stance: stanceOf(s), evidence: ev };
}

function cardMarket(NSEdata) {
  const mm = NSEdata?.marketMood;
  const nifty = NSEdata?.niftyTrend;
  if (!mm && !nifty) return null;
  let s = 50;
  const ev = [];

  const adv = num(mm?.advances), dec = num(mm?.declines);
  if (adv != null && dec) {
    const r = adv / dec;
    if (r < 0.5) s -= 15;
    else if (r < 0.8) s -= 6;
    else if (r > 1.5) s += 10;
    else if (r > 1.2) s += 5;
    ev.push(`Market breadth: ${adv} advances vs ${dec} declines (${mm?.breadth || "n/a"})`);
  }
  const ch = num(nifty?.todayChange);
  if (ch != null) {
    if (ch < -1.5) s -= 8;
    else if (ch < -0.7) s -= 4;
    else if (ch > 1.5) s += 8;
    else if (ch > 0.7) s += 4;
    ev.push(`Nifty ${ch}% on the day${nifty?.pe ? `, Nifty PE ${nifty.pe}` : ""}`);
  }

  s = clamp(Math.round(s), 0, 100);
  return { key: "market", name: "Market regime", score: s, stance: stanceOf(s), evidence: ev };
}

function cardSector(sec, sectorOk) {
  if (!sectorOk) return null;
  let s = 50;
  const t = num(sec.todayChange), m = num(sec.change30d);
  const ev = [];
  if (m != null) { s += m > 5 ? 12 : m > 0 ? 6 : m < -5 ? -12 : -6; ev.push(`${sec.sector}: ${m}% in 30 days`); }
  if (t != null) { s += t > 0 ? 6 : -6; ev.push(`${sec.sector}: ${t}% today`); }
  if (sec.matchType === "derived") ev.push("Sector index derived from the company's sector/industry");
  s = clamp(Math.round(s), 0, 100);
  return { key: "sector", name: "Sector strength", score: s, stance: stanceOf(s), evidence: ev };
}

// ==========================================
// SIGNAL + LEVELS + RISK FLAGS
// ==========================================
const WEIGHTS = { technical: 22, participation: 22, fundamentals: 22, valuation: 12, market: 12, sector: 10 };

function buildWatch(price, d50, d200) {
  const c = [{ name: "50-DMA", v: d50 }, { name: "200-DMA", v: d200 }].filter((x) => x.v != null);
  const below = c.filter((x) => x.v < price).sort((a, b) => b.v - a.v)[0] || null;
  const above = c.filter((x) => x.v > price).sort((a, b) => a.v - b.v)[0] || null;
  const mk = (x) => x && { level: x.v, basis: x.name, distancePct: round(pct(x.v, price), 1) };

  let support = mk(below), resistance = mk(above);
  // DMA se koi level na mile to approx zone (swing high/low ka data nahi hai)
  if (!support) support = { level: round(price * 0.95), basis: "approx -5%", distancePct: -5, approximate: true };
  if (!resistance) resistance = { level: round(price * 1.05), basis: "approx +5%", distancePct: 5, approximate: true };

  const plain = (b) => String(b).replace("50-DMA", "50-day average price").replace("200-DMA", "200-day average price");
  const scenarios = {
    bullish: resistance.approximate
      ? `The price keeps rising above about ₹${resistance.level} with more buyers taking delivery.`
      : `The price closes above ₹${resistance.level} (its ${plain(resistance.basis)}), ideally with more buyers taking delivery.`,
    bearish: support.approximate
      ? `The price falls below about ₹${support.level} (an approximate level, as swing-low data is not available).`
      : `The price closes below ₹${support.level} (its ${plain(support.basis)}).`,
  };
  return { support, resistance, scenarios };
}

function buildRiskFlags(c) {
  const { f, dv, fl, tech, mkt, integrity, stockedgeCheck, stale, screenerData, cards, isFin, ms, flowLag, delivLag, sectorDerived, sectorHint } = c;
  const flags = [];
  const add = (severity, text) => flags.push({ severity, text });

  // NOTE: ye texts end-user ko dikhte hain, isliye plain language me hain
  integrity.forEach((t) => add("high", `Data check failed: ${t}. Please treat this result with caution.`));
  if (!stockedgeCheck.ok && stockedgeCheck.reason === "company_mismatch")
    add("medium", "Quarterly results and news from one data source did not match this company, so they were left out.");
  if (stockedgeCheck.ok && stockedgeCheck.unverified)
    add("low", "Quarterly results could not be double-checked against other data.");

  if (!isFin && f.peReported && f.peReported > 35 && f.roe != null && f.roe < 10)
    add("high", `The price is high (${f.peReported}x yearly earnings) compared with the company's returns (${f.roe}% return on equity), so it already expects strong future growth.`);
  else if (!isFin && f.pb && f.pb > 3 && f.roe != null && f.roe < 10)
    add("medium", `The price is high compared with the company's book value (${f.pb}x) and returns (${f.roe}% return on equity).`);
  if (f.epsCV != null && f.epsCV > 0.5) add("medium", "Quarterly earnings jump around a lot, so one strong quarter may not repeat.");
  if (f.peCalc && f.peReported && Math.abs(f.peCalc / f.peReported - 1) > 0.15)
    add("low", `The reported price-to-earnings (${f.peReported}x) does not match the figure worked out from recent earnings (${f.peCalc}x).`);

  if (isFin)
    add("medium", "This is a lender: data on bad loans, lending margins and capital strength is not included, so a cheap-looking valuation may hide risks.");

  if (f.profitYoY != null && f.profitYoY < -10)
    add("medium", `Profit is down ${Math.abs(f.profitYoY)}% compared with the same quarter last year.`);

  if (dv.trendPts != null && dv.trendPts < -2)
    add("medium", "Fewer buyers are holding on to this stock than last week (delivery percentage is falling).");
  if (ms.open) add("low", "The market is open, so today's price and trading volume are still changing.");
  else if (tech?.volSpike != null && tech.volSpike < 0.8) add("medium", `Trading volume is low (${tech.volSpike}x its usual level).`);
  if (tech?.rsi != null && tech.rsi > 70) add("medium", `The stock looks overheated after a sharp rise (RSI ${tech.rsi}).`);
  if (tech?.rsi != null && tech.rsi < 30) add("low", `The stock has fallen sharply (RSI ${tech.rsi}); a bounce or further fall are both possible.`);

  if (mkt?.stance === "BEARISH") add("medium", "The overall market is weak today, which can drag individual stocks down.");
  if (fl.fiiNet != null && fl.diiNet != null && fl.fiiNet > 1000 && fl.diiNet < -1000)
    add("low", "Foreign investors are buying while domestic funds are selling, so big-investor signals are mixed.");
  if (fl.fiiNet != null && fl.diiNet != null && fl.fiiNet < -1000 && fl.diiNet > 1000)
    add("low", "Foreign investors are selling while domestic funds are buying, so big-investor signals are mixed.");

  if (flowLag >= 1)
    add(flowLag >= 2 ? "medium" : "low", `Investor flow data is from ${fl.date} (${flowLag} trading day${flowLag > 1 ? "s" : ""} old), so it counts for less.`);
  if (delivLag >= 2)
    add("low", `Delivery data ends on ${dv.lastDate} (${delivLag} trading days old).`);

  if (!cards.sector)
    add("low", "Sector performance could not be matched, so it is not used.");
  else if (sectorDerived)
    add("low", `Sector view uses ${sectorDerived}, matched from the company's sector.`);

  if (!isFin) {
    const noDebt = !screenerData?.debt && !screenerData?.debtEquity;
    const noFcf = !screenerData?.freeCashFlow;
    if (noDebt || noFcf) add("low", "Debt and cash flow data is not available.");
  }
  if (stale != null && stale > 3) add("medium", `Market data is ${stale} days old.`);

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

function buildSignal(cards, tech, mktCard, missingCount, integrityCount, volReliable) {
  const list = Object.values(cards).filter(Boolean);
  let wsum = 0, wtot = 0, bull = 0, bear = 0;
  for (const c of list) {
    const w = WEIGHTS[c.key] || 0;
    wsum += w * (c.score - 50) * 2;
    wtot += w;
    if (c.stance === "BULLISH") bull++;
    if (c.stance === "BEARISH") bear++;
  }
  const score = wtot ? Math.round(wsum / wtot) + 0 : 0;   // "+ 0" se -0 nahi aata
  const conflict = bull >= 2 && bear >= 2;

  let signal = "HOLD";
  if (!conflict && score >= 25) signal = "BUY";
  else if (!conflict && score <= -25) signal = "SELL";

  const gates = [];
  if (signal === "BUY" && volReliable && tech?.volSpike != null && tech.volSpike < 0.8) {
    signal = "HOLD"; gates.push("BUY downgraded to HOLD: volume is weak.");
  }
  if (signal === "BUY" && mktCard && mktCard.score <= 30) {
    signal = "HOLD"; gates.push("BUY downgraded to HOLD: market breadth is strongly bearish.");
  }

  const agree = Math.max(bull, bear) >= 4 ? 5 : 0;
  const confidence = clamp(
    Math.round(50 + Math.abs(score) / 2 + agree - missingCount * 5 - integrityCount * 15 - (conflict ? 10 : 0)),
    30, 85
  );
  return { score, signal, confidence, conflict, gates, bull, bear };
}

// ==========================================
// SIMPLE VIEW (end-user ke liye, bina jargon)
// ==========================================
const joinList = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const inr = (x) => `₹${Math.abs(Math.round(x)).toLocaleString("en-IN")} Cr`;
const int = (x) => Math.round(x).toLocaleString("en-IN");

function buildSimple({ sig, cards, f, fl, dv, tech, price, sec, NSEdata, isFin, watch, flowLag, ms, niftyPe }) {
  const toneOf = (c) => (c.score >= 60 ? "good" : c.score <= 40 ? "bad" : "neutral");
  const items = [];

  if (cards.technical) {
    const t = toneOf(cards.technical);
    const d = price && tech.d50 ? pct(price, tech.d50) : null;
    items.push({
      key: "trend", short: "price trend", label: "Price trend",
      status: t === "good" ? "Strong" : t === "bad" ? "Weak" : "Mixed", tone: t,
      note: d != null
        ? `Trading ${round(Math.abs(d), 1)}% ${d >= 0 ? "above" : "below"} its 50-day average price.`
        : "Based on recent price movement.",
    });
  }

  if (cards.valuation) {
    const t = toneOf(cards.valuation);
    let note;
    if (isFin && f.pb != null && f.roe != null && f.roe > 0)
      note = `Priced at ${f.pb}x its book value; with a ${f.roe}% return on equity it could normally justify about ${round(f.roe / 12, 1)}x.`;
    else if (f.peReported && niftyPe)
      note = `Price is ${round(f.peReported, 1)}x its yearly earnings, versus about ${niftyPe}x for the overall market.`;
    else if (f.peReported) note = `Price is ${round(f.peReported, 1)}x its yearly earnings.`;
    else note = "Based on book value and returns.";
    items.push({
      key: "value", short: "value", label: "Value for money",
      status: t === "good" ? "Cheap" : t === "bad" ? "Expensive" : "Fairly priced", tone: t, note,
    });
  }

  if (cards.fundamentals) {
    const t = toneOf(cards.fundamentals);
    const p1 = f.profitYoY != null ? `Profit is ${f.profitYoY >= 0 ? "up" : "down"} ${Math.abs(f.profitYoY)}% compared with the same quarter last year.` : null;
    const p2 = f.positiveQuarters != null && f.quartersChecked >= 6
      ? `Profitable in ${f.positiveQuarters} of the last ${f.quartersChecked} quarters.` : null;
    items.push({
      key: "business", short: "business health", label: "Business health",
      status: t === "good" ? "Healthy" : t === "bad" ? "Weak" : "Mixed", tone: t,
      note: [p1, p2].filter(Boolean).join(" ") || "Based on profits and returns.",
    });
  }

  if (cards.participation) {
    const t = toneOf(cards.participation);
    const bits = [];
    if (fl.fiiNet != null) bits.push(`foreign investors ${fl.fiiNet >= 0 ? "bought" : "sold"} ${inr(fl.fiiNet)}`);
    if (fl.diiNet != null) bits.push(`domestic funds ${fl.diiNet >= 0 ? "bought" : "sold"} ${inr(fl.diiNet)}`);
    let note = bits.length
      ? `Across the market, ${bits.join(" and ")}${fl.date ? ` (${fl.date}${flowLag >= 1 ? ", not the latest day" : ""})` : ""}.`
      : "";
    if (dv.trendPts != null && dv.trendPts < -2) note += " Fewer buyers are holding on to this stock than last week.";
    else if (dv.trendPts != null && dv.trendPts > 2) note += " More buyers are holding on to this stock than last week.";
    items.push({
      key: "investors", short: "investor activity", label: "Investor activity",
      status: t === "good" ? "Buying" : t === "bad" ? "Selling" : "Mixed", tone: t, note: note.trim() || "Based on trading activity.",
    });
  }

  if (cards.market) {
    const t = toneOf(cards.market);
    const mm = NSEdata?.marketMood || {};
    const ch = num(NSEdata?.niftyTrend?.todayChange);
    const note = mm.advances != null && mm.declines != null
      ? `${int(mm.advances)} stocks rose while ${int(mm.declines)} fell${ms.open ? " so far today" : " today"}.`
      : ch != null ? `Nifty moved ${ch}% today.` : "Based on overall market breadth.";
    items.push({
      key: "market", short: "market mood", label: "Market mood",
      status: t === "good" ? "Positive" : t === "bad" ? "Negative" : "Neutral", tone: t, note,
    });
  }

  if (cards.sector) {
    const t = toneOf(cards.sector);
    const m = num(sec?.change30d);
    items.push({
      key: "sector", short: "sector", label: "Sector",
      status: t === "good" ? "Strong" : t === "bad" ? "Weak" : "Mixed", tone: t,
      note: m != null ? `${sec.sector} is ${m >= 0 ? "up" : "down"} ${Math.abs(m)}% over the last 30 days.` : "Based on sector performance.",
    });
  }

  const good = items.filter((i) => i.tone === "good").map((i) => i.short);
  const bad = items.filter((i) => i.tone === "bad").map((i) => i.short);

  const verdictLabel = sig.signal === "BUY" ? "Looks favourable" : sig.signal === "SELL" ? "Looks weak" : "Wait and watch";
  let verdictText;
  if (sig.signal === "BUY") verdictText = `Most areas look supportive: ${joinList(good)}.`;
  else if (sig.signal === "SELL") verdictText = `Most areas look weak: ${joinList(bad)}.`;
  else if (good.length && bad.length)
    verdictText = `Mixed picture: ${joinList(good)} ${good.length > 1 ? "look" : "looks"} good, but ${joinList(bad)} ${bad.length > 1 ? "are" : "is"} weak.`;
  else if (good.length) verdictText = "Most areas look fine, but not strong enough for a clear buy.";
  else if (bad.length) verdictText = "Several areas are weak, but not enough for a clear sell.";
  else verdictText = "Signals are mostly neutral, so there is no clear edge either way.";

  const notes = [];
  if (isFin) notes.push("Data on bad loans, lending margins and capital strength is not included for lenders, so a cheap-looking valuation may hide risks.");
  if (ms.open) notes.push("The market is open, so today's numbers are still changing.");
  if (flowLag >= 1) notes.push("Investor flow data is from an earlier day.");

  return {
    verdictLabel,
    verdictText,
    confidenceLabel: `${sig.confidence >= 70 ? "High" : sig.confidence >= 50 ? "Medium" : "Low"} confidence`,
    outlook: items.map(({ key, label, status, tone, note }) => ({ key, label, status, tone, note })),
    whatChanges: watch
      ? [{ label: "Gets better if", text: watch.scenarios.bullish }, { label: "Gets worse if", text: watch.scenarios.bearish }]
      : [],
    notes,
  };
}

// ==========================================
// MAIN
// ==========================================
async function getStockAIResult(input) {
  try {
    const { screenerData, technicalData, newsData, stockedgefundamental, sector_impact, NSEdata, deliveryData, fiiDiiData } = input;
    const now = input.now ? new Date(input.now) : new Date();   // test ke liye input.now de sakte ho

    // 0) market state + company type
    const ms = marketState(now);
    const volReliable = !ms.open;
    const techSector = technicalData?.sector || "";
    const techIndustry = technicalData?.industry || "";
    const isFin =
      /financial|bank|insur/i.test(techSector) ||
      /credit|bank|insurance|lending|finance|capital markets|asset management|nbfc/i.test(techIndustry);

    // 1) verification
    const check = verifyStockEdge(screenerData, stockedgefundamental);
    const quarters = check.ok ? compactQuarters(stockedgefundamental) : null;
    const news = check.ok ? prepareNews(newsData, now) : [];
    const integrity = checkIntegrity({ screenerData, technicalData });

    // 2) derived metrics
    const price = num(technicalData?.currentPrice) ?? num(screenerData?.currentPrice);
    const f = deriveFundamentals(screenerData, price);
    const dv = deriveDelivery(deliveryData);
    const fl = deriveFlows(fiiDiiData);
    const niftyPe = num(NSEdata?.niftyTrend?.pe);
    const tech = {
      volSpike: num(technicalData?.volumeSpike),
      rsi: num(technicalData?.rsi),
      d50: num(technicalData?.dma50),
      d200: num(technicalData?.dma200),
    };

    // sector: pehle jo mila, nahi to company ke sector se NSE index nikalo
    let sec = sector_impact;
    let sectorDerived = null;
    const sectorHint = suggestSector(techSector, techIndustry)[0] || null;
    if (!sec || sec.matchType === "fallback") {
      const d = deriveSector(techSector, techIndustry, NSEdata);
      if (d) { sec = d; sectorDerived = d.sector; }
    }
    const sectorOk = !!sec && sec.matchType !== "fallback";

    // freshness
    const flowTs = parseDMY(fl.date);
    const flowLag = flowTs != null ? bizLag(flowTs, ms.lastCompleted) : 0;
    const delivTs = parseDMY(dv.lastDate);
    const delivLag = delivTs != null ? bizLag(delivTs, ms.lastCompleted) : 0;

    // 3) scorecards
    const cards = {
      technical: cardTechnical(technicalData, volReliable),
      participation: cardParticipation(dv, fl, flowLag),
      fundamentals: cardFundamentals(f, quarters, isFin),
      valuation: cardValuation(f, sec, sectorOk, niftyPe, isFin),
      market: cardMarket(NSEdata),
      sector: cardSector(sec, sectorOk),
    };
    const scorecard = Object.values(cards).filter(Boolean);

    const missing = Object.keys(cards).filter((k) => !cards[k]);
    if (!check.ok) missing.push("quarterly_results_and_news");

    // 4) signal
    const sig = buildSignal(cards, tech, cards.market, missing.length, integrity.length, volReliable);

    // 5) levels (BUY/SELL) + watch levels (hamesha)
    let levels = null;
    if (price && sig.signal !== "HOLD") {
      const atr = num(technicalData?.atr14);
      const unit = atr || price * 0.02;
      const dir = sig.signal === "BUY" ? 1 : -1;
      const sl = price - dir * 1.5 * unit;
      const t1 = price + dir * 2 * unit;
      const t2 = price + dir * 3.5 * unit;
      levels = {
        entryZone: `${(price - 0.25 * unit).toFixed(2)}-${(price + 0.25 * unit).toFixed(2)}`,
        stopLoss: sl.toFixed(2),
        target1: t1.toFixed(2),
        target2: t2.toFixed(2),
        riskReward: `1:${(Math.abs(t1 - price) / Math.abs(price - sl)).toFixed(2)}`,
        levelsBasis: atr ? "ATR14" : "approx 2% of price",
      };
    }
    const watch = price && tech.d50 != null && tech.d200 != null ? buildWatch(price, tech.d50, tech.d200) : null;

    // 6) risk flags
    const ts = Date.parse(String(NSEdata?.timestamp || "").replace(/-/g, " "));
    const stale = Number.isFinite(ts) ? Math.round((now.getTime() - ts) / DAY) : null;
    const riskFlags = buildRiskFlags({
      f, dv, fl, tech, mkt: cards.market, integrity, stockedgeCheck: check, stale, screenerData, cards,
      isFin, ms, flowLag, delivLag, sectorDerived, sectorHint,
    });

    // 7) Simple, user-friendly view (jargon-free). Detailed numbers scorecards me hain.
    const simple = buildSimple({
      sig, cards, f, fl, dv, tech, price, sec, NSEdata, isFin, watch, flowLag, ms, niftyPe,
    });

    // 8) data quality + freshness
    const used = [];
    if (cards.technical) used.push("Technical");
    if (deliveryData) used.push("Delivery");
    if (fiiDiiData) used.push("FII/DII");
    if (screenerData) used.push("Fundamentals");
    if (NSEdata) used.push("Market (NSE)");
    if (sectorOk) used.push(sectorDerived ? "Sector (derived)" : "Sector");
    if (check.ok) used.push("Quarterly results & news");
    const excluded = [];
    if (!check.ok) excluded.push("Quarterly results & news (company mismatch / unavailable)");
    if (!sectorOk) excluded.push("Sector (not matched)");
    const staleCount = (flowLag >= 1 ? 1 : 0) + (delivLag >= 2 ? 1 : 0);
    const dataQuality = {
      score: clamp(Math.round(100 - missing.length * 12 - integrity.length * 25 - staleCount * 5), 0, 100),
      used, excluded,
    };
    const freshness = {
      marketOpen: ms.open,
      market: NSEdata?.timestamp || null,
      flows: fmtLag(fl.date, flowLag),
      delivery: fmtLag(dv.lastDate, delivLag),
    };

    // 9) AI: sirf explain + synthesize
    const compactCards = scorecard.map((c) => ({ name: c.name, score: c.score, stance: c.stance, evidence: c.evidence }));
    const facts = JSON.parse(JSON.stringify({
      company: screenerData?.company,
      sector: techSector, industry: techIndustry,
      price,
      derived: {
        ttmEps: f.ttmEps, pe: f.peReported, pb: f.pb, bookValuePerShare: f.bookValue,
        roe: f.roe, roce: isFin ? undefined : f.roce, opm: isFin ? undefined : f.opm,
        profitYoY_standalone: f.profitYoY, salesYoY_standalone: f.salesYoY,
        profitVsPrevQuarter: f.profitQoQ, profitableQuarters: `${f.positiveQuarters}/${f.quartersChecked}`,
      },
      delivery: { current: dv.current, avg7: dv.avg7, trendPts: dv.trendPts, momentum: dv.momentum, lastFullDayVolumeVsEarlierAvg: dv.volRatio, series: dv.series },
      market: {
        asOf: NSEdata?.timestamp, breadth: NSEdata?.marketMood, nifty: NSEdata?.niftyTrend,
        strongSectors: (NSEdata?.topStrongSector || []).slice(0, 3).map((x) => `${x.sector} (${x.change30d}% 30d)`),
        weakSectors: (NSEdata?.topWeakSector || []).slice(0, 3).map((x) => `${x.sector} (${x.change30d}% 30d)`),
      },
      flows_crore: fl,
      freshness,
      context: {
        marketOpenNow: ms.open,
        isLender: isFin,
        sectorSource: sectorDerived ? "derived" : sectorOk ? "matched" : "not matched",
      },
      news,
      quarterlyResults_consolidated: quarters,
    }));

    const prompt = `
Tum ek senior equity analyst ki tarah explain karo. Signal, score, confidence, scorecards aur levels code ne nikaal diye hain, unko change mat karo.
Output language: ${OUTPUT_LANGUAGE}.

COMPUTED (final):
${JSON.stringify({ signal: sig.signal, confidence: sig.confidence, score: sig.score, conflict: sig.conflict, gates: sig.gates, scorecards: compactCards, watchLevels: watch && { support: watch.support, resistance: watch.resistance }, levels }, null, 2)}

RISK FLAGS (already shown to user, repeat mat karo):
${JSON.stringify(riskFlags.map((x) => x.text), null, 2)}

FACTS:
${JSON.stringify(facts, null, 2)}

Rules:
- Sirf COMPUTED aur FACTS ke numbers use karo; kuch invent mat karo. Missing ko "not available" bolo.
- P/B FACTS.derived.pb hai. bookValuePerShare ko P/B mat samjho.
- context.marketOpenNow true ho to aaj ka volume/price adhura hai; volume ko weak mat bolo.
- context.isLender true ho to bank/NBFC ki tarah P/B aur ROE se judge karo; debt, ROCE, operating margin ki baat mat karo; NPA/asset quality ka data nahi hai ye yaad rakho.
- freshness me flows/delivery purane hon to unki date saaf batao.
- Standalone aur consolidated numbers mix mat karo, label ke saath bolo.
- Reasoning me har point kisi scorecard ke evidence se juda ho; bullish aur bearish dono taraf ke points do.
- Sector scorecard na ho to sector se conclusion mat nikalo.
- News me ageDays dekho; 30+ din purani news ko kam weight do.
- Language "will go up/down" ya guaranteed return jaisi na ho. "If already holding" / "for a new entry" jaisa conditional likho; user ke position ko maan mat lo.
- HOLD me levels nahi hote; whatToWatch/strategy me watchLevels use karo. Agar level "approx" hai to use approximate hi bolo.

Sirf JSON:
{
  "summary": "4-5 lines, overall picture aur sabse bada trade-off",
  "reasoning": ["max 6 points, har ek scorecard/evidence se juda"],
  "bullCase": "1-2 lines: kya sahi hua to upside banta hai",
  "bearCase": "1-2 lines: kya galat ho sakta hai",
  "whatToWatch": ["max 3 concrete triggers (levels/delivery/volume/flows)"],
  "deliveryAnalysis": "1-2 lines",
  "bestStrategy": "1-2 lines, conditional"
}`;

    let text = {};
    try {
      text = cleanJSON(await callAI(prompt));
    } catch (e) {
      console.log("AI explanation failed:", e.message);
    }
    if (!text.summary) {
      const best = [...scorecard].sort((a, b) => b.score - a.score)[0];
      const worst = [...scorecard].sort((a, b) => a.score - b.score)[0];
      text.summary =
        `${screenerData?.company || "This stock"}: computed signal ${sig.signal} (score ${sig.score}, confidence ${sig.confidence}%). ` +
        (best && worst ? `Strongest area: ${best.name} (${best.score}); weakest: ${worst.name} (${worst.score}). ` : "") +
        "AI commentary is unavailable right now.";
    }

    const warnings = [...new Set([...sig.gates, ...riskFlags.map((x) => x.text)])].slice(0, 8);

    return {
      company: screenerData?.company || "",
      signal: sig.signal,
      confidence: sig.confidence,
      score: sig.score,
      ...(levels || {}),
      simple,
      scorecard,
      watchLevels: watch && { support: watch.support, resistance: watch.resistance },
      scenarios: watch?.scenarios,
      riskFlags,
      dataQuality,
      freshness,
      isLender: isFin,
      sectorHint: sectorOk ? undefined : sectorHint,
      metrics: f,
      signals: Object.fromEntries(scorecard.map((c) => [c.key, c.stance])),
      gatesApplied: sig.gates,
      dataMissing: missing,
      asOf: NSEdata?.timestamp || deliveryData?.analysisDate || null,
      summary: text.summary || "",
      reasoning: Array.isArray(text.reasoning) ? text.reasoning : [],
      bullCase: text.bullCase || "",
      bearCase: text.bearCase || "",
      whatToWatch: Array.isArray(text.whatToWatch) ? text.whatToWatch : [],
      warnings,
      deliveryAnalysis: text.deliveryAnalysis || "",
      bestStrategy: text.bestStrategy || "",
    };
  } catch (error) {
    console.log(error);
    return { success: false, error: error.message };
  }
}

// async function getStockAIResult(input) {
  
//     const { screenerData, technicalData, newsData,sector_impact, NSEdata, deliveryData,fiiDiiData ,stockedgefundamental} = input;
//     const computed = buildSignals(input);

// console.log("data in getstockairesult")
// console.log("screenerData",screenerData)
// console.log("technicalData",technicalData)
// console.log("newsData",newsData)
// console.log("stockedgefundamental",stockedgefundamental)
// console.log("NSEdata", NSEdata)
// console.log("sector_impact",sector_impact)
// console.log("fiidiidata",fiiDiiData)
// console.log("deliveryData",deliveryData)


// }
module.exports = getStockAIResult;