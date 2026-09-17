const YahooFinance = require("yahoo-finance2").default;

const yahooFinance =
  new YahooFinance();

const {
  SMA,
  EMA,
  RSI,
  MACD,
  ATR,
  ADX,
  BollingerBands,
} = require("technicalindicators");

// ==========================================
// FOREX SYMBOL FORMATTER
// ==========================================
function formatForexSymbol(symbol) {

const map = {
  // Major Pairs
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X",
  NZDUSD: "NZDUSD=X",
  USDCAD: "CAD=X",
  USDINR: "INR=X",

  // EUR Crosses
  EURAUD: "EURAUD=X",
  EURGBP: "EURGBP=X",
  EURJPY: "EURJPY=X",
  EURNZD: "EURNZD=X",

  // GBP Crosses
  GBPAUD: "GBPAUD=X",
  GBPJPY: "GBPJPY=X",
  GBPNZD: "GBPNZD=X",

  // AUD / NZD Crosses
  AUDJPY: "AUDJPY=X",
  AUDCAD: "AUDCAD=X",
  AUDNZD: "AUDNZD=X",
  NZDJPY: "NZDJPY=X",

  // Metals
  GOLD: "GC=F",
  SILVER: "SI=F"
};

  const clean =
    symbol.replace("/", "").toUpperCase();

  return map[clean] || symbol;
}

// ==========================================
// MAIN FUNCTION
// ==========================================
async function ForexTechnicalData(
  inputSymbol = "EURUSD"
) {

  try {

    // ==========================================
    // SYMBOL
    // ==========================================

    const symbol =
      formatForexSymbol(inputSymbol);

    // ==========================================
    // HISTORICAL DATA
    // ==========================================

    const rawCandles =
      await yahooFinance.historical(
        symbol,
        {
          period1: new Date("2024-01-01"),
          period2: new Date(),
          interval: "1d",
        },
        {
          validateResult: false
        }
      );

    // Aaj ka candle abhi market open hone ki wajah se
    // incomplete ho sakta hai (close/adjclose null) -
    // usko hata do taaki indicators kharab na hon
    const candles =
      (rawCandles || []).filter(
        c => c.close !== null && c.close !== undefined
      );

    if (
      !candles ||
      candles.length < 250
    ) {

      return {
        error: true,
        message: "Not enough data"
      };

    }

    // ==========================================
    // ARRAYS
    // ==========================================

    const close =
      candles.map(c => c.close);

    const high =
      candles.map(c => c.high);

    const low =
      candles.map(c => c.low);

    // ==========================================
    // CURRENT PRICE
    // ==========================================

    const currentPrice =
      close[close.length - 1];

    // ==========================================
    // SMA
    // ==========================================

    const sma50 =
      SMA.calculate({
        period: 50,
        values: close
      }).slice(-1)[0];

    const sma200 =
      SMA.calculate({
        period: 200,
        values: close
      }).slice(-1)[0];

    // ==========================================
    // EMA
    // ==========================================

    const ema20 =
      EMA.calculate({
        period: 20,
        values: close
      }).slice(-1)[0];

    const ema50 =
      EMA.calculate({
        period: 50,
        values: close
      }).slice(-1)[0];

    // ==========================================
    // RSI
    // ==========================================

    const rsi =
      RSI.calculate({
        period: 14,
        values: close
      }).slice(-1)[0];

    // ==========================================
    // MACD
    // ==========================================

    const macdData =
      MACD.calculate({
        values: close,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });

    const latestMACD =
      macdData[macdData.length - 1];

    const macdSignal =
      latestMACD.MACD >
      latestMACD.signal
        ? "Bullish"
        : "Bearish";

    // ==========================================
    // ATR (VOLATILITY)
    // ==========================================

    const atr =
      ATR.calculate({
        high,
        low,
        close,
        period: 14
      }).slice(-1)[0];

    // ==========================================
    // ADX (TREND STRENGTH)
    // ==========================================

    const adxData =
      ADX.calculate({
        high,
        low,
        close,
        period: 14
      }).slice(-1)[0];

    const adx =
      adxData?.adx || 0;

    // ==========================================
    // BOLLINGER BANDS
    // ==========================================

    const bb =
      BollingerBands.calculate({
        period: 20,
        stdDev: 2,
        values: close
      }).slice(-1)[0];

    // ==========================================
    // VOLATILITY LEVEL
    // ==========================================

    let volatility =
      "Low";

    const atrPercent =
      (atr / currentPrice) * 100;

    if (atrPercent > 1) {
      volatility = "High";
    }
    else if (atrPercent > 0.5) {
      volatility = "Moderate";
    }

    // ==========================================
    // TREND STRUCTURE
    // ==========================================

    let trend =
      "Sideways";

    if (
      currentPrice > sma50 &&
      sma50 > sma200 &&
      ema20 > ema50
    ) {

      trend = "Strong Bullish";

    }
    else if (
      currentPrice > sma50
    ) {

      trend = "Bullish";

    }
    else if (
      currentPrice < sma50 &&
      sma50 < sma200
    ) {

      trend = "Strong Bearish";

    }
    else if (
      currentPrice < sma50
    ) {

      trend = "Bearish";

    }

    // ==========================================
    // MOMENTUM
    // ==========================================

    let momentum =
      "Neutral";

    if (
      rsi > 60 &&
      macdSignal === "Bullish"
    ) {

      momentum = "Strong Bullish";

    }
    else if (
      rsi < 40 &&
      macdSignal === "Bearish"
    ) {

      momentum = "Strong Bearish";

    }

    // ==========================================
    // MARKET CONDITION
    // ==========================================

    let marketState =
      "Range Bound";

    if (
      adx > 25 &&
      trend.includes("Bullish")
    ) {

      marketState =
        "Bullish Trend";

    }
    else if (
      adx > 25 &&
      trend.includes("Bearish")
    ) {

      marketState =
        "Bearish Trend";

    }

    // ==========================================
    // TECHNICAL BIAS
    // ==========================================

    let technicalBias =
      "NEUTRAL";

    if (
      trend.includes("Bullish") &&
      macdSignal === "Bullish" &&
      rsi > 50
    ) {

      technicalBias = "BUY";

    }

    if (
      trend.includes("Bearish") &&
      macdSignal === "Bearish" &&
      rsi < 50
    ) {

      technicalBias = "SELL";

    }

    // ==========================================
    // SUPPORT / RESISTANCE
    // ==========================================

    const recentHigh =
      Math.max(...high.slice(-20));

    const recentLow =
      Math.min(...low.slice(-20));

    // ==========================================
    // RISK SENTIMENT
    // ==========================================

    let riskSentiment =
      "Neutral";

    if (
      inputSymbol.includes("JPY") ||
      inputSymbol.includes("CHF")
    ) {

      riskSentiment =
        "Safe Haven Sensitive";

    }

    if (
      inputSymbol.includes("AUD") ||
      inputSymbol.includes("NZD")
    ) {

      riskSentiment =
        "Risk-On Sensitive";

    }

    // ==========================================
    // FINAL RETURN
    // ==========================================

    return {

      pair:
        inputSymbol.toUpperCase(),

      yahooSymbol:
        symbol,

      currentPrice:
        Number(currentPrice.toFixed(5)),

      trend,

      marketState,

      technicalBias,

      momentum,

      volatility,

      riskSentiment,

      indicators: {

        rsi:
          Number(rsi.toFixed(2)),

        macd:
          macdSignal,

        adx:
          Number(adx.toFixed(2)),

        atr:
          Number(atr.toFixed(5)),

        sma50:
          Number(sma50.toFixed(5)),

        sma200:
          Number(sma200.toFixed(5)),

        ema20:
          Number(ema20.toFixed(5)),

        ema50:
          Number(ema50.toFixed(5)),

      },

      bollingerBands: {

        upper:
          Number(bb.upper.toFixed(5)),

        middle:
          Number(bb.middle.toFixed(5)),

        lower:
          Number(bb.lower.toFixed(5)),
      },

      supportResistance: {

        resistance:
          Number(recentHigh.toFixed(5)),

        support:
          Number(recentLow.toFixed(5))
      },

      summary: `
${inputSymbol.toUpperCase()} is currently in a ${trend} structure with ${momentum} momentum. MACD is ${macdSignal} while RSI stands at ${rsi.toFixed(2)}. ADX at ${adx.toFixed(2)} indicates ${
        adx > 25
          ? "a trending market"
          : "weak trend strength"
      }. Current volatility is ${volatility}.
      `.trim()

    };

  } catch (error) {

    console.log(
      "❌ Technical Error:",
      error.message
    );

    return {
      error: true,
      message: error.message
    };

  }

}

module.exports =ForexTechnicalData