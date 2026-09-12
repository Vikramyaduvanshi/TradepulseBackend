const axios = require("axios");

const api_key = process.env.FINNHUB_KEY;
// console.log(api_key)
const keywords = [
  "fed", "fomc", "ecb", "boj", "boe", "rba", "rbi", "powell", "lagarde","intervenes",
  "inflation", "cpi", "ppi", "interest", "rate", "hawkish", "dovish",
  "rate hike", "rate cut", "gdp", "recession", "nfp", "payrolls",
  "unemployment", "usd", "eur", "gbp", "jpy", "dxy", "currency",
  "gold", "oil", "crude", "brent", "wti", "opec", "war", "iran",
  "ukraine", "geopolitics", "risk-off", "safe haven"
];

// ==========================================
// FETCH NEWS
// ==========================================

async function fetchData() {
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/news?category=general&token=d6t7l6pr01qoqoisi4cgd6t7l6pr01qoqoisi4d0`
    );

    return res.data || [];

  } catch (err) {
    console.log("❌ FETCH ERROR:", err.message);
    return [];
  }
}

// ==========================================
// CLEAN + FILTER NEWS
// ==========================================

function cleanData(arr) {

  const uniqueNews = [];
  const seen = new Set();

  for (let val of arr) {

    if (!val.headline || !val.summary) continue;

    const cleanTitle = val.headline
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");

    // REMOVE DUPLICATES
    if (seen.has(cleanTitle)) continue;
    seen.add(cleanTitle);

    // FULL TEXT
    const fullText = `${val.headline} ${val.summary}`.toLowerCase();

    // MATCH KEYWORDS
    const matchedKeywords = keywords.filter(word =>
      fullText.includes(word)
    );

    // IGNORE LOW QUALITY NEWS
    if (matchedKeywords.length === 0) continue;

    // ==========================================
    // IMPACT SCORE
    // ==========================================

    let impactScore = matchedKeywords.length * 10;
    let impactLevel = "LOW";

    if (impactScore >= 60) {
      impactLevel = "HIGH";
    } else if (impactScore >= 30) {
      impactLevel = "MEDIUM";
    }

    // ==========================================
    // SENTIMENT ENGINE
    // ==========================================

    let sentiment = "Neutral";

    if ( fullText.includes("hawkish") || fullText.includes("rate hike") || fullText.includes("hot inflation")) {
      sentiment = "USD Bullish";

    } else if ( fullText.includes("rate cut") || fullText.includes("dovish") || fullText.includes("recession")
    ) {
      sentiment = "USD Bearish";

    } else if ( fullText.includes("war") || fullText.includes("iran") || fullText.includes("ukraine")
    ) {
      sentiment = "Risk-Off";
    }

    // ==========================================
    // PUSH FINAL OBJECT
    // ==========================================

    uniqueNews.push({
      headline: val.headline,
      summary: val.summary,
      source: val.source,
      url: val.url,
      image: val.image,
      publishedAt: new Date(val.datetime * 1000),

      matchedKeywords,
      impactScore,
      impactLevel,
      sentiment
    });
  }

  // SORT BY IMPACT SCORE
  uniqueNews.sort((a, b) => b.impactScore - a.impactScore);

  return uniqueNews;
}

// ==========================================
// MAIN ENGINE
// ==========================================

async function MAIN() {

  const rawData = await fetchData();

  const cleanedNews = cleanData(rawData);

  const finalOutput = {
    totalNews: cleanedNews.length,
    analyzedAt: new Date(),
    news: cleanedNews.slice(0, 20)
  };

  // console.log(JSON.stringify(finalOutput, null, 2));
}

// MAIN();