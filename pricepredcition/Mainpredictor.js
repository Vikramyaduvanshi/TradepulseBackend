const Delevery = require("./Delevery")
const getFIIDII = require("./Fii_Dii")
const sector_mapping = require("./getStockSectorImpact")
const getStockSectorImpact = require("./getStockSectorImpact")
const getStockAIResult = require("./Groq_predict")
const Newssentiment = require("./Newssentiment")
const getScreenerData = require("./ScreenerData")
const getNSEData = require("./SectorIndex")
const getTechnicalData = require("./TechnicalAnalyse")




const withTimeout = (p, ms, name) =>
    Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`${name} timeout`)), ms)),
    ]);

async function predictorresult(symbol, onProgress = () => { }) {
    try {
        const total = 8;       // 7 fetch + 1 AI
        let done = 0;

        // call turant shuru hoti hai (parallel), khatam hone par progress bhejta hai
        const track = (name, promise) =>
            withTimeout(Promise.resolve(promise), 25000, name)
                .then((v) => {
                    onProgress({ step: name, ok: true, done: ++done, total, data: v });   // <-- data add kiya
                    return v;
                })
                .catch((e) => {
                    console.log(name, "failed:", e.message);
                    onProgress({ step: name, ok: false, done: ++done, total });
                    return null;          // ek fail hone par baaki na ruken
                });

        const [deliveryData, newsData, screenerData, technicalData, fiiDiiData, NSEdata, sector_impact] =
            await Promise.all([
                track("Delivery data", Delevery(symbol)),
                track("News sentiment", Newssentiment(symbol)),
                track("Fundamentals", getScreenerData(symbol)),
                track("Technical data", getTechnicalData(symbol + ".NS")),
                track("FII/DII data", getFIIDII()),
                track("NSE data", getNSEData()),
                track("Sector impact", sector_mapping(symbol + ".NS")),
            ]);

        onProgress({ step: "Generating AI analysis", ok: true, done: total - 1, total });

        const result = await withTimeout(
            getStockAIResult({ screenerData, technicalData, newsData, fiiDiiData, deliveryData, sector_impact }),
            60000,
            "AI analysis"
        );

        return result;
    } catch (e) {
        console.log(e.message);   // pehle jaisa: fail par undefined return
    }
}


module.exports = predictorresult

// predictorresult("bel")




