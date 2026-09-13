const launchBrowser = require("../pricepredcition/browserLauncher");
const cheerio = require("cheerio");

async function getFullArticle(url) {

  let browser;

  try {

    browser = await launchBrowser();

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    const html = await page.content();

    const $ = cheerio.load(html);

    $("script, style, nav, footer, header").remove();

    let paragraphs = [];

    $("p").each((i, el) => {

      const text = $(el).text().trim();

      if (text.length > 50) {
        paragraphs.push(text);
      }

    });

    await browser.close();

    return { success: true, content: paragraphs.join("\n\n") };

  } catch (err) {

    if (browser) await browser.close();

    console.log("getFullArticle Error:", err.message);

    return { success: false, error: err.message };

  }

}

module.exports = getFullArticle;