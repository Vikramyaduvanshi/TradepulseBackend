const launchBrowser = require("./browserLauncher");

const CACHE_MS = 5 * 60 * 1000; // 5 minute
let cache = { raw: null, at: 0 };
let inflight = null; // ek saath kai requests aayein to browser ek hi baar khule

// ==========================================
// NSE se raw allIndices data laata hai
// ==========================================
async function scrapeAllIndices() {
  const browser = await launchBrowser(["--no-sandbox", "--disable-setuid-sandbox"]);
  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
    );

    // Heavy cheezein block karo
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "font", "stylesheet", "media"].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto("https://www.nseindia.com", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await new Promise((r) => setTimeout(r, 3000)); // cookies set hone do

    const result = await page.evaluate(async () => {
      const res = await fetch("/api/allIndices", {
        headers: { accept: "application/json, text/plain, */*" },
        credentials: "include",
      });
      return { status: res.status, text: await res.text() };
    });

    if (result.status !== 200) {
      throw new Error(`NSE status ${result.status}: ${result.text.slice(0, 120)}`);
    }

    try {
      return JSON.parse(result.text);
    } catch {
      throw new Error("NSE ne JSON nahi bheja (shayad block): " + result.text.slice(0, 120));
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

// ==========================================
// MAIN FUNCTION
// mode:
// "summary" => top5 strong + weak + aaj ke gainers/losers
// "full"    => all sectors cleaned
// ==========================================
async function getNSEData(mode = "summary") {
  // Fresh cache hai to browser kholne ki zarurat nahi
  if (cache.raw && Date.now() - cache.at < CACHE_MS) {
    return { success: true, cached: true, ...filterImportantData(cache.raw, mode) };
  }

  try {
    if (!inflight) inflight = scrapeAllIndices().finally(() => (inflight = null));
    const raw = await inflight;
    cache = { raw, at: Date.now() };
    return { success: true, ...filterImportantData(raw, mode) };
  } catch (error) {
    console.log("NSE data error:", error.message);

    // Purana cache hai to wahi de do, kuch na hone se behtar hai
    if (cache.raw) {
      return { success: true, stale: true, ...filterImportantData(cache.raw, mode) };
    }
    return { success: false, error: error.message };
  }
}

// ==========================================
// FILTER FUNCTION
// ==========================================
function filterImportantData(data, mode) {
  const indices = data.data || [];

  const allowedKeys = [
    "THEMATIC INDICES",
    "STRATEGY INDICES",
    "SECTORAL INDICES",
    "BROAD MARKET INDICES",
  ];

  // Leverage/inverse/SME jaise indices sector nahi hain, ranking se hatao
  const skipWords = [
    "VIX", "INVERSE", "DIVIDEND", "USD",
    "LEVERAGE", "1X", "2X", "TR ", "PR ",
    "SME",
  ];

  const useful = indices.filter(
    (item) =>
      allowedKeys.includes(item.key) &&
      !skipWords.some((word) => (item.index || "").toUpperCase().includes(word))
  );

  const allSectors = useful.map((x) => ({
    sector: x.index || "",
    symbol: x.indexSymbol || "",
    indexName: x.indexName || x.index || "",
    category: x.key || "OTHERS",

    todayChange: Number(x.percentChange) || 0,
    change30d: Number(x.perChange30d) || 0,
    change1Y: Number(x.perChange365d) || 0,

    pe: Number(x.pe) || 0,
    pb: Number(x.pb) || 0,

    advances: Number(x.advances) || 0,
    declines: Number(x.declines) || 0,
  }));

  // Jinka 30 din ka data nahi hai (0), unhe ranking se hatao
  const rankable = allSectors.filter((s) => s.change30d !== 0);

  // 30 din ka trend: strong sirf wo jo badhe, weak sirf wo jo ghate
  const topStrongSector = [...rankable]
    .filter((s) => s.change30d > 0)
    .sort((a, b) => b.change30d - a.change30d)
    .slice(0, 5);

 const topWeakSector = [...rankable]
  .sort((a, b) => a.change30d - b.change30d)
  .slice(0, 5)
  .map((s) => ({ ...s, negative30d: s.change30d < 0 }));

  // Aaj ka mood: aaj kaun upar, kaun neeche
  const todayGainers = [...allSectors]
    .filter((s) => s.todayChange > 0)
    .sort((a, b) => b.todayChange - a.todayChange)
    .slice(0, 5);

  const todayLosers = [...allSectors]
    .filter((s) => s.todayChange < 0)
    .sort((a, b) => a.todayChange - b.todayChange)
    .slice(0, 5);

  const nifty50 = indices.find((x) => x.index === "NIFTY 50");

  const advances = data.advances || 0;
  const declines = data.declines || 0;
  const unchanged = data.unchanged || 0;

  let breadth = "Neutral";

  if (advances > declines && advances < declines * 1.5) breadth = "Bullish";
  if (advances > declines * 1.5) breadth = "Strong Bullish";
  if (declines > advances && declines < advances * 1.5) breadth = "Bearish";
  if (declines > advances * 1.5) breadth = "Strong Bearish";

  const baseData = {
    timestamp: data.timestamp,

    marketMood: {
      breadth,
      advances,
      declines,
      unchanged,
    },

    niftyTrend: nifty50
      ? {
          last: Number(nifty50.last),
          todayChange: Number(nifty50.percentChange),
          pe: Number(nifty50.pe || 0),
        }
      : null,

    totalSectorsScanned: allSectors.length,
  };

  if (mode === "full") {
    return {
      ...baseData,
      sectors: allSectors,
    };
  }

  return {
    ...baseData,
    topStrongSector,
    topWeakSector,
    todayGainers,
    todayLosers,
  };
}



// async function main() {
//   let res= await getNSEData()
//   console.log(res)
// }

// main()

module.exports = getNSEData;