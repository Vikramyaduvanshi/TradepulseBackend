/**
 * Institutional Sector Intelligence System - Raw Data Output
 */

const getNSEData = require("./SectorIndex");
const getTechnicalData = require("./TechnicalAnalyse");
const sectorMapping = require("./sector_mapping.json");

// --- SECTOR IMPACT ENGINE ---
// 1. Pre-compute Map (Ise function ke bahar rakhein, sirf ek baar chalega)
const aliasMap = new Map();

for (const cat in sectorMapping.engine) {
    for (const indexName in sectorMapping.engine[cat]) {
        const config = sectorMapping.engine[cat][indexName];
        config.aliases.forEach(alias => {
            // Alias ko key banaya aur Index Name + Priority ko value
            aliasMap.set(alias.toLowerCase(), {
                indexName,
                priority: config.priority
            });
        });
    }
}

function sectorimpact(technical, nsedata) {
    const sectors = nsedata.sectors || [];
    const yahooIndustry = (technical.industry || "").toLowerCase().trim();
    const yahooSector = (technical.sector || "").toLowerCase().trim();

    const normalize = (str) => String(str || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const nseMap = new Map(sectors.map((s) => [normalize(s.indexName), s]));

    // STRATEGY 1: direct alias match
    const matchConfig = aliasMap.get(yahooIndustry) || aliasMap.get(yahooSector);
    if (matchConfig) {
        const found = sectors.find(
            (s) => s.indexName === matchConfig.indexName || s.symbol === matchConfig.indexName
        );
        if (found) return { ...found, matchType: "direct", priority: matchConfig.priority };
    }

    // STRATEGY 2: words se index name match
    const words = `${yahooIndustry} ${yahooSector}`.split(/[\s&,-]+/);
    for (const word of words) {
        const cleanWord = normalize(word);
        if (cleanWord.length < 4) continue;
        if (nseMap.has(cleanWord)) return { ...nseMap.get(cleanWord), matchType: "word" };
    }

    // STRATEGY 3: global fallback (broad market, stock ka apna sector nahi)
    const fb = sectorMapping.rules.global_fallback;
    const fallback = nseMap.get(normalize(fb)) || nseMap.get("NIFTY500");
    return fallback ? { ...fallback, matchType: "fallback" } : null;
}

// --- MAIN FUNCTION ---
async function sector_mapping(ticker = "BEL.NS") {
    try {
        const [technical, nsedata] = await Promise.all([
            getTechnicalData(ticker),
            getNSEData("full"),
        ]);

        if (!technical || !nsedata?.success) return null;

        return sectorimpact(technical, nsedata);
    } catch (error) {
        console.error("Sector mapping error:", error.message);
        return null;
    }
}

// async function main() {
//   let res= await sector_mapping("RECLTD.NS")
//   console.log(res)
// }

// main()



module.exports=sector_mapping