const axios = require("axios");

const getPrice = async (symbol) => {
  // console.log(symbol, "symbol in getprice");

  try {

    const res = await axios.get(
      "https://api.twelvedata.com/price",
      {
        params: {
          symbol: symbol, 
          apikey: process.env.TWELVE_API_KEY,
        },
      }
    );

    // ✅ success check
    if (res.data.price) {
      // console.log("Twelve Data:", res.data.price);
      return parseFloat(res.data.price);
    }

    // ❌ if error from API
    console.log("Twelve Data error:", res.data);

  } catch (err) {
    console.log("Twelve Data failed:", err.message);
  }
}

module.exports=getPrice