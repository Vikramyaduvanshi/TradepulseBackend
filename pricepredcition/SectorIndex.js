const launchBrowser = require("./browserLauncher");
const axios = require("axios");

// ==========================================
// MAIN FUNCTION
// mode:
// "summary" => top5 strong + weak
// "full"    => all 113 sectors cleaned
// ==========================================
async function getNSEData(mode = "summary") {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
    );

    await page.goto("https://www.nseindia.com", {
      waitUntil: "networkidle2"
    });

    await wait(3000);

    const cookies = await page.cookies();

    const cookieString = cookies
      .map(c => `${c.name}=${c.value}`)
      .join("; ");

    const res = await axios.get(
      "https://www.nseindia.com/api/allIndices",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
          Accept: "application/json",
          Referer: "https://www.nseindia.com/",
          Cookie: cookieString
        },
        timeout: 15000
      }
    );

    return { success: true, ...filterImportantData(res.data, mode) };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    await browser.close();
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
    "BROAD MARKET INDICES"
  ];

  const skipWords = [
    "VIX",
    "INVERSE",
    "DIVIDEND",
    "PR 1X",
    "TR 1X",
    "USD"
  ];

  const useful = indices.filter(item =>
    allowedKeys.includes(item.key) &&
    !skipWords.some(word =>
      item.index.toUpperCase().includes(word)
    )
  );

  const allSectors = useful.map(x => ({
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

  const topStrongSector = [...allSectors]
    .sort((a, b) => b.change30d - a.change30d)
    .slice(0, 5);

  const topWeakSector = [...allSectors]
    .sort((a, b) => a.change30d - b.change30d)
    .slice(0, 5);

  const nifty50 = indices.find(
    x => x.index === "NIFTY 50"
  );

  const advances = data.advances || 0;
  const declines = data.declines || 0;
  const unchanged = data.unchanged || 0;

  let breadth = "Neutral";

  if (advances > declines && advances < declines * 1.5)
    breadth = "Bullish";

  if (advances > declines * 1.5)
    breadth = "Strong Bullish";

  if (declines > advances && declines < advances * 1.5)
    breadth = "Bearish";

  if (declines > advances * 1.5)
    breadth = "Strong Bearish";

  const baseData = {
    timestamp: data.timestamp,

    marketMood: {
      breadth,
      advances,
      declines,
      unchanged
    },

    niftyTrend: nifty50
      ? {
          last: Number(nifty50.last),
          todayChange: Number(nifty50.percentChange),
          pe: Number(nifty50.pe || 0)
        }
      : null,

    totalSectorsScanned: allSectors.length
  };

  if (mode === "full") {
    return {
      ...baseData,
      sectors: allSectors
    };
  }

  return {
    ...baseData,
    topStrongSector,
    topWeakSector
  };
}

// ==========================================
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = getNSEData;