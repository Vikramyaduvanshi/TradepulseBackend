const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const cheerio = require('cheerio');

async function readArticle(googleUrl) {
    let browser;
    try {
        // Step 1: Launch Browser
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        
        const page = await browser.newPage();
        
        // Real user ki tarah behave karne ke liye User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Step 2: Google News link par jana (Ye automatically redirect follow karega)
        await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Step 3: Get the Final URL after all redirects
        const finalUrl = page.url();

        // Step 4: Page ka HTML nikalna
        const html = await page.content();
        const $ = cheerio.load(html);

        // Kachra saaf karo
        $('script, style, nav, footer, header, noscript, ads, .sidebar, .related').remove();

        let title = $("meta[property='og:title']").attr("content") || $("h1").first().text() || $("title").text();
        
        let contentArray = [];
        $("p").each((i, el) => {
            let text = $(el).text().trim();
            if (text.length > 50) {
                contentArray.push(text);
            }
        });

        let articleContent = contentArray.join("\n\n");

        await browser.close();

        return {
            success: true,
            source: finalUrl,
            title: title ? title.trim() : "No Title",
            content: articleContent ? articleContent.slice(0, 5000) : "No Content Found",
        };

    } catch (error) {
        if (browser) await browser.close();
        return {
            success: false,
            error: `Puppeteer Error: ${error.message}`,
        };
    }
}

module.exports = readArticle;