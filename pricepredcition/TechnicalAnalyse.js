const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

const { SMA, RSI, MACD } = require("technicalindicators");

// ==========================================
// MAIN FUNCTION
// ==========================================
async function getTechnicalData(symbol = "BEL.NS") {
  try {
    // ==========================================
    // 1. HISTORICAL DATA
    // ==========================================
    const candles = await yahooFinance.historical(symbol, {
      period1: new Date("2024-01-01"),
      period2: new Date(),
      interval: "1d",
    });

    if (!candles || candles.length === 0) {
      console.log("No historical data found for", symbol);
      return { success: false, error: `No historical data found for ${symbol}` };
    }

    // ==========================================
    // 2. PROFILE DATA (sector included)
    // ==========================================
    const profile = await yahooFinance.quoteSummary(symbol, {
      modules: ["assetProfile", "price"]
    });

    const sector =
      profile.assetProfile?.sector || "Unknown";

    const industry =
      profile.assetProfile?.industry || "Unknown";

    const companyName =
      profile.price?.longName || symbol;

    // ==========================================
    // ARRAYS
    // ==========================================
    const close = candles.map(c => c.close);
    const volume = candles.map(c => c.volume);

    // ==========================================
    // Ensure enough data points for 200 DMA
    // ==========================================
    if (close.length < 200) {
      return {
        success: false,
        error: `Not enough historical data to calculate 200-DMA for ${symbol} (need 200+ days, got ${close.length})`,
      };
    }

    // ==========================================
    // 50 DMA
    // ==========================================
    const dma50 = SMA.calculate({
      period: 50,
      values: close
    }).slice(-1)[0];

    // ==========================================
    // 200 DMA
    // ==========================================
    const dma200 = SMA.calculate({
      period: 200,
      values: close
    }).slice(-1)[0];

    // ==========================================
    // RSI
    // ==========================================
    const rsi = RSI.calculate({
      period: 14,
      values: close
    }).slice(-1)[0];

    // ==========================================
    // MACD
    // ==========================================
    const macdResult = MACD.calculate({
      values: close,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    }).slice(-1)[0];

    if (!macdResult) {
      return { success: false, error: `Not enough data to calculate MACD for ${symbol}` };
    }

    const macdSignal =
      macdResult.MACD > macdResult.signal
        ? "Bullish"
        : "Bearish";

    // ==========================================
    // VOLUME SPIKE
    // ==========================================
    const last20Volume = volume.slice(-20);

    const avg20Volume =
      last20Volume.reduce((a, b) => a + b, 0) /
      last20Volume.length;

    const todayVolume = volume.slice(-1)[0];

    const volumeSpike = (
      todayVolume / avg20Volume
    ).toFixed(2);

    // ==========================================
    // CURRENT PRICE
    // ==========================================
    const currentPrice = close.slice(-1)[0];

    // ==========================================
    // TREND
    // ==========================================
    let trend = "Weak";

    if (currentPrice > dma50 && dma50 > dma200) {
      trend = "Strong Uptrend";
    } else if (currentPrice > dma50) {
      trend = "Uptrend";
    }

    // ==========================================
    // SIGNAL
    // ==========================================
    let signal = "Neutral";

    if (rsi < 30) signal = "Oversold Buy Zone";
    else if (rsi > 70) signal = "Overbought";
    else if (macdSignal === "Bullish") signal = "Bullish";

    // ==========================================
    // FINAL RETURN
    // ==========================================
    return {
      success: true,
      symbol,
      companyName,
      sector,
      industry,

      currentPrice: currentPrice.toFixed(2),

      dma50: dma50.toFixed(2),
      dma200: dma200.toFixed(2),

      rsi: rsi.toFixed(2),

      macd: macdSignal,

      volumeSpike: volumeSpike + "x",

      trend,
      signal
    };

  } catch (error) {
    console.log("Technical Data Error:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = getTechnicalData;