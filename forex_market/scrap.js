const { withPage } = require("../pricepredcition/browserLauncher");
const cheerio = require("cheerio");

async function getFullArticle(url) {
  try {
    return await withPage(
      async (page) => {
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        const html = await page.content();

        const $ = cheerio.load(html);

        $("script, style, nav, footer, header").remove();

        const paragraphs = [];

        $("p").each((i, el) => {
          const text = $(el).text().trim();

          if (text.length > 50) {
            paragraphs.push(text);
          }
        });

        return { success: true, content: paragraphs.join("\n\n") };
      },
      { stealth: true, timeoutMs: 75000 }
    );
  } catch (err) {
    console.log("getFullArticle Error:", err.message);

    return { success: false, error: err.message };
  }
}

module.exports = getFullArticle;