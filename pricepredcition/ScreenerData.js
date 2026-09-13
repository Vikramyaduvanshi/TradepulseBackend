const axios = require("axios");
const cheerio = require("cheerio");


async function getScreenerData(symbol = "BEL") {
  try {
    const url = `https://www.screener.in/company/${symbol}/`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);

    const result = {
      company: $("h1").first().text().trim(),
      symbol,

      roe: "",
      roce: "",
      debt: "",
      debtEquity: "",
      currentPrice: "",
      pe: "",
      bookValue: "",

      salesGrowthYoY: "",
      profitGrowthYoY: "",
      freeCashFlow: "",
      opm: "",
      npm: "",

      sales: [],
      profit: [],
      eps: [],
    };

    // Agar company mila hi nahi (invalid symbol), company name empty rahega
    if (!result.company) {
      console.log(`Screener: No company found for symbol "${symbol}"`);
      return { success: false, error: `No data found for symbol "${symbol}"` };
    }

    // =====================================
    // TOP RATIOS
    // =====================================
    $("li").each((i, el) => {
      const label = $(el).find(".name").text().trim().toLowerCase();
      const value = $(el).find(".number").text().trim();

      if (label === "roe") result.roe = value;
      if (label === "roce") result.roce = value;
      if (label === "debt") result.debt = value;
      if (label.includes("debt to equity")) result.debtEquity = value;
      if (label === "current price") result.currentPrice = value;
      if (label === "stock p/e") result.pe = value;
      if (label === "book value") result.bookValue = value;
    });

    // =====================================
    // QUARTERLY TABLE ONLY
    // =====================================
    $("#quarters tbody tr").each((i, row) => {
      const title = $(row).find("td").first().text().trim().toLowerCase();

      const values = [];

      $(row)
        .find("td")
        .each((idx, td) => {
          if (idx !== 0) {
            const txt = $(td)
              .text()
              .trim()
              .replace(/,/g, "")
              .replace(/%/g, "");

            values.push(txt);
          }
        });

      if (title.includes("sales")) {
        result.sales = values.map(Number);
      }

      if (title.includes("net profit")) {
        result.profit = values.map(Number);
      }

      if (title.includes("opm")) {
        result.opm = values[values.length - 1] + "%";
      }

      if (title.includes("eps in rs")) {
        result.eps = values.map(Number);
      }
    });

    // =====================================
    // CASH FLOW TABLE
    // =====================================
    $("table tbody tr").each((i, row) => {
      const key = $(row).find("td").first().text().trim().toLowerCase();
      const val = $(row).find("td").eq(1).text().trim();

      if (key.includes("cash from operations")) {
        result.freeCashFlow = val;
      }
    });

    // =====================================
    // YoY Growth
    // =====================================
    function growth(current, previous) {
      if (!previous || previous === 0) return "0.00";
      return (((current - previous) / previous) * 100).toFixed(2);
    }

    if (result.sales.length >= 5) {
      const latest = result.sales[result.sales.length - 1];
      const prevYear = result.sales[result.sales.length - 5];
      result.salesGrowthYoY = growth(latest, prevYear) + "%";
    }

    if (result.profit.length >= 5) {
      const latest = result.profit[result.profit.length - 1];
      const prevYear = result.profit[result.profit.length - 5];
      result.profitGrowthYoY = growth(latest, prevYear) + "%";
    }

    return { success: true, ...result };
  } catch (error) {
    console.log("Screener Error:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = getScreenerData;