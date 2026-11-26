const launchBrowser = require("./browserLauncher");

const CACHE_MS = 3 * 60 * 60 * 1000; // 3 ghante
let cache = { data: null, at: 0 };
let inflight = null; // ek saath kai requests aayein to browser ek hi baar khule

async function scrapeFIIDII() {
  const browser = await launchBrowser(["--no-sandbox", "--disable-setuid-sandbox"]);
  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

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
      const res = await fetch("/api/fiidiiTradeReact", {
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

async function scrapeWithRetry(tries = 2) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await scrapeFIIDII();
    } catch (e) {
      lastErr = e;
      console.log(`FII/DII attempt ${i} failed:`, e.message);
    }
  }
  throw lastErr;
}

async function getFIIDII() {
  // Fresh cache hai to seedha do
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    return { success: true, data: cache.data, cached: true };
  }

  try {
    if (!inflight) inflight = scrapeWithRetry().finally(() => (inflight = null));
    const data = await inflight;
    cache = { data, at: Date.now() };
    return { success: true, data };
  } catch (err) {
    console.log("FII/DII Error:", err.message);
    // Purana cache hai to wahi de do, kuch na hone se behtar hai
    if (cache.data) return { success: true, data: cache.data, stale: true };
    return { success: false, error: err.message, data: [] };
  }
}



// async function main(){
//   let res= await getFIIDII() 
//   console.log(res)
// }
// main()
module.exports = getFIIDII;