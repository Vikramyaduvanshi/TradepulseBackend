require("dotenv").config();
const { OpenAI } = require("openai");

// ==========================================
// GROQ CLIENT
// ==========================================
const client = new OpenAI({
  apiKey: process.env.groq_api_key2,
  baseURL: "https://api.groq.com/openai/v1",
});

// ==========================================
// SAFE NUMBER PARSER
// ==========================================
function toNumber(val) {
  if (!val) return 0;

  return (
    Number(
      String(val)
        .replace(/,/g, "")
        .replace(/[^0-9.-]+/g, "")
    ) || 0
  );
}

// ==========================================
// CLEAN JSON
// ==========================================
function cleanJSON(text) {
  try {
    let cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first !== -1 && last !== -1) {
      cleaned = cleaned.slice(first, last + 1);
    }

    return JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      error: "Invalid JSON from AI",
      raw: text,
    };
  }
}

// ==========================================
// RETRY AI CALL
// ==========================================
async function callAI(prompt, retry = 2) {
  try {
    const res = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",

      temperature: 0.1,

      response_format: {
        type: "json_object",
      },

      messages: [
        {
          role: "system",
          content: `
You are an elite institutional trader AI.

You think like:
- smart money
- hedge funds
- operators
- delivery traders

You NEVER behave like a retail analyst.

You focus on:
- delivery accumulation
- institutional positioning
- liquidity
- sector momentum
- probability edge
- breakout probability
- operator intent

Return STRICT VALID JSON ONLY.
`,
        },

        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res.choices[0].message.content;
  } catch (err) {
    if (retry > 0) {
      return await callAI(prompt, retry - 1);
    }

    throw err;
  }
}

// ==========================================
// MAIN ENGINE
// ==========================================
async function getStockAIResult({
  screenerData,
  technicalData,
  newsData,
  fiiDiiData,
  deliveryData,
  sector_impact,
}) {
  try {

    // ======================================
    // SAFE DATA BUILD
    // ======================================
    const rawData = {
      fundamentals: {
        ...screenerData,

        roe: toNumber(screenerData?.roe),
        roce: toNumber(screenerData?.roce),

        pe: toNumber(screenerData?.pe),

        currentPrice: toNumber(
          screenerData?.currentPrice
        ),

        salesGrowthYoY: toNumber(
          screenerData?.salesGrowthYoY
        ),

        profitGrowthYoY: toNumber(
          screenerData?.profitGrowthYoY
        ),

        opm: toNumber(screenerData?.opm),
      },

      technicals: {
        ...technicalData,

        currentPrice: toNumber(
          technicalData?.currentPrice
        ),

        dma50: toNumber(technicalData?.dma50),

        dma200: toNumber(
          technicalData?.dma200
        ),

        rsi: toNumber(technicalData?.rsi),
      },

      news: newsData || {},

      institutions: fiiDiiData || [],

      delivery: {
        ...deliveryData,

        avg7DayDelivery: toNumber(
          deliveryData?.avg7DayDelivery
        ),

        currentDelivery: toNumber(
          deliveryData?.currentDelivery
        ),

        deliveryStrength: Number(
          Math.abs(
            toNumber(deliveryData?.currentDelivery) -
            toNumber(deliveryData?.avg7DayDelivery)
          ).toFixed(2)
        ),

        deliverySignal:
          toNumber(deliveryData?.currentDelivery) >
          toNumber(deliveryData?.avg7DayDelivery) + 3
            ? "ACCUMULATION"
            : toNumber(deliveryData?.currentDelivery) <
              toNumber(deliveryData?.avg7DayDelivery) - 3
            ? "DISTRIBUTION"
            : "NEUTRAL",
      },

      sector_impact: sector_impact || {},
    };

    // console.log(
    //   "FINAL DATA",
    //   JSON.stringify(rawData, null, 2)
    // );

    // ======================================
    // PROMPT
    // ======================================
const prompt = `
You are an elite institutional stock market AI.

Analyze this stock like:
- smart money
- hedge funds
- operators
- institutional delivery traders

DO NOT give generic retail analysis.

==================================================
VERY IMPORTANT RULES
==================================================

1. RETURN STRICT VALID JSON ONLY

2. USE ONLY ENUM VALUES PROVIDED

3. NEVER INVENT VALUES

4. NEVER RETURN EXTRA FIELDS

5. RISK-REWARD MUST BE MATHEMATICALLY CORRECT

6. breakoutChance MUST depend on:
- delivery
- sector momentum
- trend
- price structure
- volume participation
- MACD strength

7. If valuation is overheated:
reduce confidence.

8. If FII selling + strong delivery:
assume selective institutional buying.

9. If MACD is bearish:
reduce breakoutChance and confidence.

10. If volumeSpike < 1x:
reduce breakoutChance.

11. If PE > 50:
avoid excessive bullish confidence.

12. breakoutChance > 75 ONLY IF:
- strong volume
- bullish MACD
- strong delivery accumulation
- strong sector momentum

13. Confidence > 75 ONLY IF:
- strong delivery accumulation
- bullish sector
- bullish structure
- supportive volume
- no major valuation risk

14. If stock is:
- above 50 DMA
- above 200 DMA
- strong delivery accumulation
- strong sector

Then trendStrength should NOT be Weak.

15. If:
- accumulation present
- selective institutional buying
- strong sector alignment

Then operatorIntent should prefer:
- LONG BUILDUP
instead of NEUTRAL.

16. If upsideProbability < downsideProbability:
DO NOT return BUY signal.

17. If:
- MACD bearish
- volumeSpike < 1x
- PE > 50

Then:
- avoid Strong breakout setup
- avoid very high confidence
- avoid aggressive BUY signal

18. HOLD is preferred if:
- upside and downside are close
- valuation risk exists
- breakout confirmation missing
- volume participation weak

==================================================
ENUM RULES (STRICT)
==================================================

signal:
- BUY
- SELL
- HOLD

shortTerm:
- Bullish
- Bearish
- Sideways

next5DayBias:
- UP
- DOWN
- SIDEWAYS

valuationView:
- Cheap
- Fair
- Expensive
- Overheated

trendStrength:
- Strong
- Moderate
- Weak

sectorStrength:
- Strong
- Moderate
- Weak

sectorAlignment:
- FAVOURABLE
- NEUTRAL
- AGAINST

pricedIn:
- YES
- NO
- PARTIAL

liquidityTrap:
- YES
- NO
- POSSIBLE

operatorIntent:
- LONG BUILDUP
- SHORT BUILDUP
- DISTRIBUTION
- ACCUMULATION
- NEUTRAL

==================================================
PRIORITY ORDER
==================================================

1. DELIVERY ANALYSIS (MOST IMPORTANT)
2. PRICE STRUCTURE
3. SECTOR MOMENTUM
4. FII/DII FLOW
5. NEWS PRICING
6. FUNDAMENTALS
7. VALUATION

==================================================
DELIVERY RULES
==================================================

ACCUMULATION:
- deliverySignal = ACCUMULATION
- currentDelivery > avg7DayDelivery
- increasing momentum

DISTRIBUTION:
- deliverySignal = DISTRIBUTION
- weak momentum

SMART MONEY:
- rising delivery with stable price
- high delivery before breakout
- accumulation in strong sector

WEAK MOVE:
- low delivery
- weak sector
- FII selling

==================================================
VALUATION RULES
==================================================

Cheap:
PE < 20

Fair:
PE 20-35

Expensive:
PE 35-50

Overheated:
PE > 50

==================================================
TECHNICAL RULES
==================================================

Bullish:
- above 50 DMA
- above 200 DMA
- strong sector
- strong delivery
- bullish MACD
- volumeSpike > 1x

Moderate:
- above 50 DMA
- strong delivery
- but weak volume
- or bearish MACD

Weak:
- below 50 DMA
- weak delivery
- bearish MACD
- weak volume
- FII selling

==================================================
SECTOR RULES
==================================================

Strong sector:
- change30d > 10%
- positive todayChange

Moderate sector:
- positive but weak momentum

Weak sector:
- negative todayChange

==================================================
LIQUIDITY TRAP RULES
==================================================

Possible trap if:
- positive news after strong rally
- overvaluation + euphoria
- breakout without strong volume
- weak MACD

==================================================
RISK REWARD RULE
==================================================

riskReward MUST match:

(Target1 - averageEntry) /
(averageEntry - stopLoss)

Example:

Entry Zone = 435-450
Average Entry = 442.5

Target1 = 465
SL = 420

Reward = 22.5
Risk = 22.5

RR = 1:1

==================================================
CONFIDENCE RULES
==================================================

Confidence > 75 ONLY IF:
- strong delivery accumulation
- bullish sector
- bullish structure
- strong volume
- bullish MACD
- no major valuation risk

Confidence 60-75 IF:
- bullish setup
- but expensive valuation
- or weak volume
- or FII selling

Confidence < 60 IF:
- overheated valuation
- mixed signals
- weak sector
- bearish MACD

==================================================
BREAKOUT RULES
==================================================

BreakoutChance > 70 ONLY IF:
- bullish MACD
- strong volumeSpike
- strong delivery accumulation
- sector momentum strong

BreakoutChance 50-70 IF:
- mixed technicals
- bullish structure but weak volume
- expensive valuation

BreakoutChance < 50 IF:
- bearish MACD
- weak volume
- weak sector
- distribution signs

==================================================
FINAL DECISION RULES
==================================================

BUY:
- upsideProbability > downsideProbability
- strong accumulation
- bullish structure
- supportive sector
- confidence >= 65

SELL:
- downsideProbability > upsideProbability
- distribution
- weak structure

HOLD:
- mixed signals
- already priced in
- neutral RR
- upside and downside close
- weak breakout confirmation

==================================================
RETURN STRICT JSON ONLY
==================================================

{
  "company": "",

  "signal": "BUY | SELL | HOLD",

  "confidence": 0,

  "shortTerm": "Bullish | Bearish | Sideways",

  "next5DayBias": "UP | DOWN | SIDEWAYS",

  "entryZone": "",

  "target1": "",

  "target2": "",

  "stopLoss": "",

  "riskReward": "",

  "upsideProbability": 0,

  "downsideProbability": 0,

  "breakoutChance": 0,

  "deliveryAnalysis": "",

  "smartMoneyAction": "",

  "operatorIntent": "LONG BUILDUP | SHORT BUILDUP | DISTRIBUTION | ACCUMULATION | NEUTRAL",

  "liquidityTrap": "YES | NO | POSSIBLE",

  "valuationView": "Cheap | Fair | Expensive | Overheated",

  "trendStrength": "Strong | Moderate | Weak",

  "sectorStrength": "Strong | Moderate | Weak",

  "sectorAlignment": "FAVOURABLE | NEUTRAL | AGAINST",

  "pricedIn": "YES | NO | PARTIAL",

  "bestStrategy": "",

  "summary": "",

  "reasoning": [],

  "warnings": []
}

==================================================
STOCK DATA
==================================================

${JSON.stringify(rawData, null, 2)}

==================================================
STRICT JSON ONLY
==================================================
`;
    // ======================================
    // AI CALL
    // ======================================
    const raw = await callAI(prompt);

    // console.log("RAW AI:", raw);

    // ======================================
    // CLEAN RESULT
    // ======================================
    const result = cleanJSON(raw);

    return result;

  } catch (error) {
    console.log(error);

    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = getStockAIResult;