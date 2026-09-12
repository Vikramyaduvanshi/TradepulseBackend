const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

async function getFullArticle(url) {

  let browser;

  try {

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"]
    });

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

    return paragraphs.join("\n\n");

  } catch (err) {

    if (browser) await browser.close();

    console.log(err.message);

    return "";

  }

}

// test
async function MAIN(){
let res=await  getFullArticle("https://www.bloomberg.com/news/articles/2026-05-21/asian-stocks-to-rise-on-optimism-over-iran-talks-markets-wrap")

// console.log(res)
}

// MAIN()