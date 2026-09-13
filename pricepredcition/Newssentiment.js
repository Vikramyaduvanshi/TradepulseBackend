const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const parser = new Parser();

async function getNews(symbol) {
    const url = `https://news.google.com/rss/search?q=${symbol}+stock+india`;
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
        title: item.title,
        link: item.link,
        date: item.pubDate
    }));
}

const importantWords = [
    // --- RISK & CORPORATE GOVERNANCE (CRITICAL NEGATIVE) ---
    "fraud", "scam", "raid", "sebi", "penalty", "investigation", "probe", "irregularities",
    "default", "loss", "falls", "drops", "downgrade", "stake sale", "npa", "resigns", "quit",
    "offload", "block deal", "bulk deal", "litigation", "court", "verdict", "tax notice", 
    "auditor", "pledged", "slippage", "provisioning", "forensic", "discrepancy", "show cause",
    "whistleblower", "insolvency", "bankruptcy", "write-off", "cbi", "ed raid", "sfio", 
    "violation", "curbs", "restriction", "fines", "breach", "fema",

    // --- GROWTH & VALUE UNLOCKING (STRONG POSITIVE) ---
    "order", "contract", "wins", "deal", "profit", "beats", "guidance", "expansion",
    "dividend", "bonus", "split", "upgrade", "buy rating", "acquisition", "merger", "buyback",
    "patent", "capex", "jv", "joint venture", "outlook", "margin", "ebitda", "fundraising", 
    "l1 bidder", "export", "demerger", "turnaround", "debt free", "debt reduction", 
    "capacity addition", "order book", "market share", "pli scheme", "monetization",
    "strategic sale", "in-principle approval", "commissioned", "licence",

    // --- SECTOR SPECIFIC (HIGH IMPACT) ---
    "usfda", "form 483", "observations", "warning letter", "eir", // Pharma
    "casa", "nim", "asset quality", "gnpa", "nnpa", "slippages",   // Banking
    "tcv", "attrition", "digital transformation",                // IT
    "arpu", "subscriber addition",                               // Telecom
    "grm", "under-recovery", "windfall tax",                     // Oil & Gas
    "lme price", "anti-dumping",                                 // Metals

    // --- MACRO & REGULATORY (NEUTRAL/MARKET MOVERS) ---
    "results", "earnings", "budget", "policy", "government", "gdp", "inflation", "rbi", 
    "cci", "fed", "interest rate", "gst", "fdi", "fpi", "msci", "ftse", "rebalancing",
    "upper circuit", "lower circuit", "52-week high", "multi-year high"
];

function shouldOpen(title) {
    let t = title.toLowerCase();
    const actionWords = ["upside", "target", "jump", "surge", "breakout", "growth"];
    const hasAction = actionWords.some(word => t.includes(word));
    const hasCritical = importantWords.some(word => t.includes(word));
    return hasAction || hasCritical;
}

async function readArticle(googleUrl) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        const finalUrl = page.url();
        const html = await page.content();
        const $ = cheerio.load(html);

        $('script, style, nav, footer, header, noscript, ads, .sidebar, .related').remove();

        let title = $("meta[property='og:title']").attr("content") || $("h1").first().text() || $("title").text();
        let contentArray = [];
        $("p").each((i, el) => {
            let text = $(el).text().trim();
            if (text.length > 50) contentArray.push(text);
        });

        let articleContent = contentArray.join("\n\n");
        await browser.close();

        return {
            success: true,
            source: finalUrl,
            title: title ? title.trim() : "No Title",
            content: articleContent ? articleContent.slice(0, 1000) : "No Content Found",
        };
    } catch (error) {
        if (browser) await browser.close();
        return { success: false, error: error.message };
    }
}

async function Newssentiment(symbol) {
    try {
        let news = await getNews(symbol);
        news.sort((a, b) => new Date(b.date) - new Date(a.date));

        const fresh = news.filter(item => {
            let diff = (Date.now() - new Date(item.date)) / (1000 * 60 * 60 * 24);
            return diff <= 30;
        });

        const unique = [];
        const titles = new Set();
        for (let item of fresh) {
            let clean = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
            if (!titles.has(clean)) {
                titles.add(clean);
                unique.push(item);
            }
        }

        let final = [];
        let notopened = [];

        // Yahan limit lagayi hai (sirf top 5 articles) kyunki Puppeteer slow hota hai
        const topUnique = unique.slice(0, 5); 

        for (let item of topUnique) {
            if (shouldOpen(item.title)) {
                let res = await readArticle(item.link);
                if (res.success) {
                    final.push({
                        title: item.title,
                        date: item.date,
                        article: res.content,
                    });
                }
            } else {
                notopened.push({ title: item.title, date: item.date });
            }
        }

        // CRITICAL FIX: Data return karna zaroori hai
        return {
            symbol: symbol,
            total_fresh: unique.length,
            analyzed_count: final.length,
            articles: final,
        };

    } catch (error) {
        console.log("Error:", error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log("Fetching data, please wait... (Puppeteer is running)");
    let res = await Newssentiment("bel");
    console.log("--- FINAL RESULT ---");
    console.log(JSON.stringify(res, null, 2));
}

// main();

module.exports = Newssentiment;