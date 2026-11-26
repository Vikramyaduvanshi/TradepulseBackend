const { CompanyFundamentals } = require("../Indian_Market/Routes/result")
const Delevery = require("./Delevery")
const getFIIDII = require("./Fii_Dii")
const sector_mapping = require("./getStockSectorImpact")
const getStockSectorImpact = require("./getStockSectorImpact")
const getStockAIResult = require("./Groq_predict")
// const Newssentiment = require("./Newssentiment")
const getScreenerData = require("./ScreenerData")
const getNSEData = require("./SectorIndex")
const { newsdatastockedge } = require("./stockedge")
const getTechnicalData = require("./TechnicalAnalyse")
const { cached } = require("./catched");



const withTimeout = (p, ms, name) =>
    Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`${name} timeout`)), ms)),
    ]);

async function predictorresult(symbol, onProgress = () => { }) {
    try {
        console.log(symbol, "symbol in predictorresult ")
        const total = 9; // 6 parallel + news + stockedge fundamentals + AI
        let done = 0;

        const track = (name, promise) =>
            withTimeout(Promise.resolve(promise), 25000, name)
                .then((v) => {
                    const ok = v != null && v.success !== false;
                    onProgress({ step: name, ok, done: ++done, total, data: v });
                    return v;
                })
                .catch((e) => {
                    console.log(name, "failed:", e.message);
                    onProgress({ step: name, ok: false, done: ++done, total });
                    return null;
                });

        const [deliveryData, screenerData, technicalData, fiiDiiData, NSEdata, sector_impact] =
            await Promise.all([
                track("Delivery data", cached(`del:${symbol}`, 60 * 60e3, () => Delevery(symbol))),
                track("Fundamentals", cached(`scr:${symbol}`, 12 * 3600e3, () => getScreenerData(symbol))),
                track("Technical data", cached(`tech:${symbol}`, 5 * 60e3, () => getTechnicalData(symbol + ".NS"))),
                track("FII/DII data", cached("fiidii", 60 * 60e3, () => getFIIDII())),
                track("NSE data", cached("nse", 10 * 60e3, () => getNSEData())),
                track("Sector impact", cached(`sector:${symbol}`, 30 * 60e3, () => sector_mapping(symbol + ".NS"))),]);

        // Symbol galat ho to yahin rok do
        if (!technicalData?.success) {
            return { success: false, error: `Technical data nahi mila for ${symbol}` };
        }

        // Yahoo ka official naam, na mile to LLM wala
        const officialName = screenerData.company;

        const newsData = await track(
            "News sentiment",
            cached(`news:${symbol}`, 20 * 60e3, () => newsdatastockedge(officialName))
        );
        const lastNews = Array.isArray(newsData) ? newsData[newsData.length - 1] : null;
        const stockedgefundamental = lastNews
            ? await track(
                "StockEdge fundamentals",
                cached(`fund:${symbol}`, 6 * 60 * 60e3, () => CompanyFundamentals(lastNews))
            )
            : null;

        onProgress({ step: "Generating AI analysis", ok: true, done: total - 1, total });

        return await withTimeout(
            getStockAIResult({
                screenerData, technicalData, newsData, stockedgefundamental,
                sector_impact, NSEdata, deliveryData, fiiDiiData,
            }),
            60000,
            "AI analysis"
        );
    } catch (e) {
        console.log("predictorresult error:", e);
        return { success: false, error: e.message };
    }
}


module.exports = predictorresult

// async function main() {
//     const res = await predictorresult("AFFORDABLE", (p) => {
//         // data bahut bada hota hai, sirf step, ok aur count dikhao
//         console.log(`[${p.done}/${p.total}] ${p.step} -> ${p.ok ? "ok" : "FAIL"}`);
//     });

//     console.log("FINAL:", JSON.stringify(res, null, 2));
// }

// if (require.main === module) main();

