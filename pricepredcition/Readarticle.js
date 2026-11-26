const { withPage } = require("./browserLauncher");
const cheerio = require("cheerio");

async function readArticle(googleUrl) {
  try {
    return await withPage(
      async (page) => {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        // Heavy cheezein block karo
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          if (["image", "font", "stylesheet", "media"].includes(req.resourceType())) req.abort();
          else req.continue();
        });

        await page.goto(googleUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

        // Google News redirect hone ka wait
        await page
          .waitForFunction(() => !location.hostname.includes("news.google.com"), { timeout: 10000 })
          .catch(() => {});

        const finalUrl = page.url();
        if (finalUrl.includes("news.google.com")) {
          return { success: false, error: "Redirect nahi hua" };
        }

        const html = await page.content();
        const $ = cheerio.load(html);
        $("script, style, nav, footer, header, noscript, aside, .sidebar, .related").remove();

        const title =
          $("meta[property='og:title']").attr("content") ||
          $("h1").first().text() ||
          $("title").text();

        const paras = [];
        $("p").each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 50) paras.push(text);
        });

        const content = paras.join("\n\n").slice(0, 5000);
        if (!content) return { success: false, error: "Content nahi mila", source: finalUrl };

        return {
          success: true,
          source: finalUrl,
          title: title ? title.trim() : "No Title",
          content,
        };
      },
      { stealth: true, timeoutMs: 40000 }
    );
  } catch (error) {
    return { success: false, error: `Puppeteer Error: ${error.message}` };
  }
}

module.exports = readArticle;



// async function main() {
//     let res= await readArticle("https://vittarthi.com/markets/india")
//     console.log(res)
// }

// main()

module.exports = readArticle;