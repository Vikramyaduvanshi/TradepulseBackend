"use strict";

const axios = require("axios");
const Parser = require("rss-parser");

// ─────────────────────────────────────────────────────────────
// RSS PARSER — Chrome UA taaki sites block na kare
// ─────────────────────────────────────────────────────────────

const rssParser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":
      "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const GNEWS_TOKEN    = "d79b544b4e9bec9b8e616fefa95042bf";
const GNEWS_MAX      = 5;
const GNEWS_DELAY_MS = 1200;
const FRESH_HOURS    = 24;

// ─────────────────────────────────────────────────────────────
// SOURCE 1 — GNews API  (full article content milta hai)
// ─────────────────────────────────────────────────────────────

const GNEWS_QUERIES = [
  // Currency pairs
  "forex OR USD OR EUR OR GBP OR JPY OR CHF OR AUD OR CAD OR NZD OR INR OR CNY",
  // Central banks
  "Fed OR FOMC OR ECB OR BOJ OR BOE OR RBA OR BOC OR RBI OR SNB OR PBOC OR RBNZ",
  // Macro
  '"interest rates" OR inflation OR CPI OR PPI OR NFP OR payrolls OR unemployment OR GDP OR recession',
  // Yields + Dollar
  'DXY OR "bond yields" OR "treasury yields" OR "yield curve" OR "10-year yield"',
  // Commodities
  "gold OR XAU OR silver OR oil OR crude OR brent OR WTI OR OPEC",
  // Geopolitics
  "war OR sanctions OR tariffs OR geopolitics OR Iran OR Israel OR Russia OR Ukraine OR China OR Taiwan",
  // Risk + Sentiment
  '"risk-off" OR "safe haven" OR "risk-on" OR VIX OR volatility OR "market panic"',
  // CB speakers
  'Powell OR Lagarde OR hawkish OR dovish OR "rate hike" OR "rate cut"',
];

async function fetchGNews() {
  const articles = [];
  for (const q of GNEWS_QUERIES) {
    try {
      const res = await axios.get("https://gnews.io/api/v4/search", {
        params: { q, lang: "en", max: GNEWS_MAX, sortby: "publishedAt", token: GNEWS_TOKEN },
        timeout: 10000,
      });
      for (const a of res.data?.articles || []) {
        articles.push({
          title:       a.title        || "",
          description: a.description  || "",
          // GNews deta hai partial content — yahi best hai bina scraping ke
          content:     a.content      || a.description || "",
          url:         a.url          || "",
          publishedAt: a.publishedAt  || new Date().toISOString(),
          source:      a.source?.name || "GNews",
          fetchedFrom: "gnews",
        });
      }
      await delay(GNEWS_DELAY_MS);
    } catch (err) {
      console.warn(`[GNews] ❌ "${q.slice(0, 35)}…" — ${err.message}`);
    }
  }

  return articles;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 2 — RSS FEEDS
// Sirf wahi feeds jo actually kaam karti hain (tested)
// ─────────────────────────────────────────────────────────────

const RSS_FEEDS = [

  // ── CONFIRMED WORKING (tumhare output mein the) ──────────────

  {
    name: "Forex Live",
    url:  "https://www.forexlive.com/feed/news",
  },
  {
    name: "Investing.com — Forex",
    url:  "https://www.investing.com/rss/news_25.rss",
  },
  {
    name: "Investing.com — Economy",
    url:  "https://www.investing.com/rss/news_14.rss",
  },
  {
    name: "Investing.com — Commodities",
    url:  "https://www.investing.com/rss/news_4.rss",
  },
  {
    name: "Investing.com — Analysis",
    url:  "https://www.investing.com/rss/news_285.rss",
  },
  {
    name: "Federal Reserve — Press Releases",
    url:  "https://www.federalreserve.gov/feeds/press_all.xml",
  },
  {
    name: "ECB — Press Releases",
    url:  "https://www.ecb.europa.eu/rss/press.html",
  },
  {
    name: "CNBC — Forex",
    url:  "https://www.cnbc.com/id/20910258/device/rss/rss.html",
  },
  {
    name: "CNBC — Economy",
    url:  "https://www.cnbc.com/id/20910247/device/rss/rss.html",
  },
  {
    name: "CNBC — World Markets",
    url:  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
  {
    name: "Bloomberg — Markets",
    url:  "https://feeds.bloomberg.com/markets/news.rss",
  },
  {
    name: "MarketWatch — Pulse",
    url:  "https://feeds.marketwatch.com/marketwatch/marketpulse/",
  },
  {
    name: "MarketWatch — Top Stories",
    url:  "https://feeds.marketwatch.com/marketwatch/topstories/",
  },

  // ── CENTRAL BANKS ──────────────────────────────────────────

  {
    name: "Bank of England",
    url:  "https://www.bankofengland.co.uk/rss/news",
  },
  {
    name: "Bank of Japan",
    url:  "https://www.boj.or.jp/en/rss/index.rss",
  },
  {
    name: "BIS — Speeches",
    url:  "https://www.bis.org/doclist/all_speeches.rss",
  },
  {
    name: "IMF — News",
    url:  "https://www.imf.org/en/News/rss?language=eng",
  },

  // ── GOOGLE NEWS (free, no key, high volume) ─────────────────
  // Har topic ke liye alag query = better coverage

  {
    name: "Google News — Forex & Currency",
    url:  "https://news.google.com/rss/search?q=forex+USD+EUR+GBP+currency+exchange&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Fed & Rates",
    url:  "https://news.google.com/rss/search?q=Federal+Reserve+FOMC+interest+rates+Powell&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — ECB & Euro",
    url:  "https://news.google.com/rss/search?q=ECB+Lagarde+euro+eurozone+rates&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — BOJ & Yen",
    url:  "https://news.google.com/rss/search?q=Bank+of+Japan+BOJ+yen+JPY+Ueda&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Inflation & CPI",
    url:  "https://news.google.com/rss/search?q=inflation+CPI+PPI+core+interest+rate&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — NFP & Jobs",
    url:  "https://news.google.com/rss/search?q=NFP+payrolls+jobs+report+unemployment&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Gold & Silver",
    url:  "https://news.google.com/rss/search?q=gold+price+XAU+silver+precious+metals&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Oil & Energy",
    url:  "https://news.google.com/rss/search?q=crude+oil+WTI+Brent+OPEC+energy+price&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — DXY & Bonds",
    url:  "https://news.google.com/rss/search?q=DXY+dollar+index+treasury+yield+bonds&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Risk Sentiment",
    url:  "https://news.google.com/rss/search?q=risk+off+safe+haven+VIX+market+panic&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Geopolitics",
    url:  "https://news.google.com/rss/search?q=geopolitics+sanctions+war+Ukraine+Russia+Israel&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Trade & Tariffs",
    url:  "https://news.google.com/rss/search?q=tariffs+trade+war+China+US+exports&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — India Rupee",
    url:  "https://news.google.com/rss/search?q=RBI+rupee+INR+India+inflation+forex+reserves&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — China Yuan",
    url:  "https://news.google.com/rss/search?q=China+yuan+PBOC+stimulus+property+economy&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News — Recession GDP",
    url:  "https://news.google.com/rss/search?q=recession+GDP+economic+slowdown+stagflation&hl=en-US&gl=US&ceid=US:en",
  },
];

async function fetchRSS() {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const parsed = await rssParser.parseURL(feed.url);
        const items = (parsed.items || []).map((item) => ({
          title:       item.title          || "",
          description: item.contentSnippet || item.summary || "",
          content:     item.content        || item.contentSnippet || item.summary || "",
          url:         item.link           || "",
          publishedAt: item.pubDate        || item.isoDate || new Date().toISOString(),
          source:      feed.name,
          fetchedFrom: "rss",
        }));
       
        return items;
      } catch (err) {
        console.warn(`[RSS] ❌ ${feed.name}: ${err.message.slice(0, 60)}`);
        return [];
      }
    })
  );

  const articles = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // console.log(`[RSS]  Total: ${articles.length} articles from ${RSS_FEEDS.length} feeds`);
  return articles;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 3 — Yahoo Finance RSS
// Har currency pair + commodity ki dedicated headline feed
// ─────────────────────────────────────────────────────────────

const YAHOO_SYMBOLS = [
  // Major pairs
  { symbol: "EURUSD=X",  label: "EUR/USD" },
  { symbol: "GBPUSD=X",  label: "GBP/USD" },
  { symbol: "USDJPY=X",  label: "USD/JPY" },
  { symbol: "AUDUSD=X",  label: "AUD/USD" },
  { symbol: "USDCAD=X",  label: "USD/CAD" },
  { symbol: "USDCHF=X",  label: "USD/CHF" },
  { symbol: "NZDUSD=X",  label: "NZD/USD" },
  { symbol: "USDINR=X",  label: "USD/INR" },
  { symbol: "USDCNH=X",  label: "USD/CNH" },
  // Commodities
  { symbol: "GC=F",      label: "Gold"    },
  { symbol: "SI=F",      label: "Silver"  },
  { symbol: "CL=F",      label: "Crude Oil" },
  { symbol: "BZ=F",      label: "Brent Oil" },
  { symbol: "NG=F",      label: "Natural Gas" },
  // Indices / Macro
  { symbol: "DX-Y.NYB",  label: "DXY"    },
  { symbol: "^TNX",      label: "10Y Yield" },
  { symbol: "^TYX",      label: "30Y Yield" },
  { symbol: "^VIX",      label: "VIX"    },
  { symbol: "^GSPC",     label: "S&P 500" },
];

async function fetchYahooFinance() {
  const results = await Promise.allSettled(
    YAHOO_SYMBOLS.map(async ({ symbol, label }) => {
      try {
        const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
        const parsed = await rssParser.parseURL(url);
        return (parsed.items || []).map((item) => ({
          title:       item.title          || "",
          description: item.contentSnippet || item.summary || "",
          content:     item.contentSnippet || item.summary || "",
          url:         item.link           || "",
          publishedAt: item.pubDate        || item.isoDate || new Date().toISOString(),
          source:      `Yahoo Finance — ${label}`,
          fetchedFrom: "yahoo",
          symbol,
        }));
      } catch (err) {
        console.warn(`[Yahoo] ❌ ${label}: ${err.message.slice(0, 50)}`);
        return [];
      }
    })
  );

  const articles = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  console.log(`[Yahoo] ✅ ${articles.length} articles from ${YAHOO_SYMBOLS.length} symbols`);
  return articles;
}

// ─────────────────────────────────────────────────────────────
// MERGE — Deduplicate + 24h filter + Sort
// ─────────────────────────────────────────────────────────────

function mergeAndClean(all) {
  // Step 1: 24h filter
  const cutoff = Date.now() - FRESH_HOURS * 3_600_000;
  const fresh = all.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return !isNaN(t) && t >= cutoff;
  });

  // Step 2: Deduplicate by normalised title
  const seen = new Set();
  const unique = [];
  for (const a of fresh) {
    const key = (a.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (key.length > 10 && !seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }

  // Step 3: Sort newest first
  unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return unique;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function Fetchcomineddata() {
  // console.log("\n📡 Fetching from all sources…\n");
  const t0 = Date.now();

  // Sab parallel chalao
  const [gNews, rss, yahoo] = await Promise.allSettled([
    fetchGNews(),
    fetchRSS(),
    fetchYahooFinance(),
  ]);

  const combined = [
    ...(gNews.status === "fulfilled" ? gNews.value : []),
    ...(rss.status   === "fulfilled" ? rss.value   : []),
    ...(yahoo.status === "fulfilled" ? yahoo.value  : []),
  ];

  const clean = mergeAndClean(combined);

//   console.log(`
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ FETCH COMPLETE  (${((Date.now() - t0) / 1000).toFixed(1)}s)
//    Raw articles  : ${combined.length}
//    After dedup   : ${clean.length}
//    Sources       : GNews API | ${RSS_FEEDS.length} RSS feeds | ${YAHOO_SYMBOLS.length} Yahoo symbols
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// `);

  return clean;
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// module.exports = Fetchcomineddata;