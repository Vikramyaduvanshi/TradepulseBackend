const axios = require("axios");
let express = require("express");
let Inidamarket = express.Router();

const launchBrowser = require("../pricepredcition/browserLauncher");

async function Domestic() {
  const browser = await launchBrowser(
    [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-http2", // important fix
    ],
    true // useStealth = true
  );

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