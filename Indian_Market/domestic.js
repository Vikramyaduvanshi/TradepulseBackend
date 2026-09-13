const axios = require("axios");
let express = require("express");
let Inidamarket = express.Router();

const { addExtra } = require("puppeteer-extra");
const chromium = require("@sparticuz/chromium");
const puppeteerCore = require("puppeteer-core");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

async function Domestic() {
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-http2", // important fix
    ],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.goto("https://www.nseindia.com", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 2000));

    const data = await page.evaluate(async () => {
      const res = await fetch(
        "https://www.nseindia.com/api/corporate-announcements?index=equities"
      );
      return res.json();
    });

    await browser.close();
    return { success: true, data };
  } catch (err) {
    await browser.close();
    console.log("Domestic Error:", err.message);
    return { success: false, error: err.message, data: [] };
  }
}

module.exports = Domestic;

// Inidamarket.get("/getindia_news", async (req, res) => {
//   try {
//     let data = await Domestic();







//     res.json({
//       success: true,
//       count: data.length,
//       data: data,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });






// module.exports= Inidamarket