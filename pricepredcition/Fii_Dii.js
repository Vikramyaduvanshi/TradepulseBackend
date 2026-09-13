const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

async function getFIIDII() {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
    );

    // Step 1: visit homepage like real user
    await page.goto("https://www.nseindia.com", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 5000));

    // Step 2: now fetch API
    const data = await page.evaluate(async () => {
      const res = await fetch(
        "https://www.nseindia.com/api/fiidiiTradeReact",
        {
          headers: {
            accept: "application/json",
          },
        }
      );
      return await res.json();
    });

    await browser.close();

    return { success: true, data };
  } catch (err) {
    await browser.close();
    console.log("FII/DII Error:", err.message);
    return { success: false, error: err.message, data: [] };
  }
}

module.exports = getFIIDII;