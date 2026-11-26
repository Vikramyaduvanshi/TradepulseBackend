const launchBrowser = require("./browserLauncher");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const parser = new Parser();

// symbol ya company name, dono chalenge (company name behtar hai)
async function getNews(query) {
    const q = encodeURIComponent(`${query} stock india`) + "+when:30d";
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(url);
    return feed.items.map((item) => ({
        title: item.title,
        link: item.link,
        date: item.pubDate,
    }));
}

const importantWords = [
    // RISK
    "fraud", "scam", "raid", "sebi", "penalty", "investigation", "probe", "irregularities",
    "default", "loss", "falls", "drops", "downgrade", "stake sale", "npa", "resigns", "quit",
    "offload", "block deal", "bulk deal", "litigation", "court", "verdict", "tax notice",
    "auditor", "pledged", "slippage", "provisioning", "forensic", "discrepancy", "show cause",
    "whistleblower", "insolvency", "bankruptcy", "write-off", "cbi", "ed raid", "sfio",
    "violation", "curbs", "restriction", "fines", "breach", "fema",
    // GROWTH
    "order", "contract", "wins", "deal", "profit", "beats", "guidance", "expansion",
    "dividend", "bonus", "split", "upgrade", "buy rating", "acquisition", "merger", "buyback",
    "patent", "capex", "jv", "joint venture", "outlook", "margin", "ebitda", "fundraising",
    "l1 bidder", "export", "demerger", "turnaround", "debt free", "debt reduction",
    "capacity addition", "order book", "market share", "pli scheme", "monetization",
    "strategic sale", "in-principle approval", "commissioned", "licence",
    // SECTOR
    "usfda", "form 483", "warning letter",
    "casa", "nim", "asset quality", "gnpa", "nnpa", "slippages",
    "tcv", "attrition", "digital transformation",
    "arpu", "subscriber addition",
    "grm", "under-recovery", "windfall tax",
    "lme price", "anti-dumping",
    // MACRO
    "results", "earnings", "budget", "policy", "gdp", "inflation", "rbi",
    "cci", "fed", "interest rate", "gst", "fdi", "fpi", "msci", "ftse", "rebalancing",
    "upper circuit", "lower circuit", "52-week high", "multi-year high",
    // ACTION
    "upside", "target", "jump", "surge", "breakout", "growth",
];

// Word boundary regex: "their" me "eir", "FedEx" me "fed" match nahi hoga
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const importantRe = new RegExp(`\\b(${importantWords.map(escapeRe).join("|")})\\b`, "i");

const shouldOpen = (title) => importantRe.test(title || "");

async function readArticle(browser, googleUrl) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        await page.setRequestInterception(true);
        page.on("request", (req) => {
            if (["image", "font", "stylesheet", "media"].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.goto(googleUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

        // Google News link redirect hone ka wait
        await page
            .waitForFunction(() => !location.hostname.includes("news.google.com"), { timeout: 10000 })
            .catch(() => {});

        const finalUrl = page.url();
        if (finalUrl.includes("news.google.com")) {
            return { success: false, error: "redirect nahi hua" };
        }

        const html = await page.content();
        const $ = cheerio.load(html);
        $("script, style, nav, footer, header, noscript, aside, .sidebar, .related").remove();

        const paras = [];
        $("p").each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50) paras.push(text);
        });

        const content = paras.join("\n\n").slice(0, 1000);
        return { success: !!content, source: finalUrl, content };
    } catch (error) {
        return { success: false, error: error.message };
    } finally {
        if (page) await page.close().catch(() => {});
    }
}

async function Newssentiment(query) {
    let browser;
    try {
        const news = await getNews(query);
        news.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Duplicate titles hatao
        const unique = [];
        const seen = new Set();
        for (const item of news) {
            const clean = (item.title || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
            if (clean && !seen.has(clean)) {
                seen.add(clean);
                unique.push(item);
            }
        }

        const top = unique.slice(0, 8); // headlines
        const toOpen = top.filter((i) => shouldOpen(i.title)).slice(0, 4); // articles

        const articles = [];
        if (toOpen.length) {
            browser = await launchBrowser(["--no-sandbox", "--disable-setuid-sandbox"]);
            for (const item of toOpen) {
                const res = await readArticle(browser, item.link);
                if (res.success) {
                    articles.push({ title: item.title, date: item.date, article: res.content });
                }
            }
        }

        // Saari headlines bhi bhejo (article khula ya nahi)
        const openedTitles = new Set(articles.map((a) => a.title));
        const headlines = top.map((i) => ({
            title: i.title,
            date: i.date,
            articleRead: openedTitles.has(i.title),
        }));

        return {
            success: true,
            query,
            total_fresh: unique.length,
            analyzed_count: articles.length,
            headlines,
            articles,
        };
    } catch (error) {
        console.log("Newssentiment Error:", error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}



async function main() {
    // let res= await Newssentiment("REC LTD")
    let res= await getNews("REC LTD")
    // console.log(res)
}

// main()

module.exports = Newssentiment;