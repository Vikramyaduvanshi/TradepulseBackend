
const { Calender, Finalanalysedforex } = require("../modal/modal")
const Fetchcomineddata = require("./fetch_data_from_db")
const Cleanedforexfactorydata= require("./Forex_factory_news")
// const Cleangnewsdata = require("./forex_fetch")
const { gnewsdatafromdb } = require("./forex_fetch");
const ForexTechnicalData = require("./forex_technical")
const forexMarketAnalysis = require("./ForexAianalyses")

let pairs = [
  // Major Pairs
  "eurusd", "gbpusd", "usdjpy", "usdchf",
  "audusd", "nzdusd", "usdcad", "usdinr",

  // EUR Crosses
  "euraud", "eurgbp", "eurjpy", "eurnzd",

  // GBP Crosses
  "gbpaud", "gbpjpy", "gbpnzd",

  // AUD/NZD Crosses
  "audjpy", "audcad", "audnzd", "nzdjpy",

  // Metals
  "gold", "silver"
];
let pairstechincaldata=[]


async function fetchcalenderdata() {
  const targetDates = [];
  const now = new Date();

  // Aaj ka din milakar agle 3 din (Total 4 days: 0, 1, 2, 3)
  for (let i = 0; i < 4; i++) {
    const nextDate = new Date();
    nextDate.setDate(now.getDate() + i);

    // Same wahi format banana jo aapke database me store hai (e.g., "Tue Jun 23")
    const formattedDate = nextDate.toDateString()
      .split(" ")
      .slice(0, 3)
      .map((item, index) => index === 2 ? String(Number(item)) : item)
      .join(" ");

    targetDates.push(formattedDate);
  }

  // targetDates Array aisi dikhegi: ["Sun Jun 21", "Mon Jun 22", "Tue Jun 23", "Wed Jun 24"]

  // MongoDB me $in operator ka use karke saari dates ka data ek sath nikalna
  let ds = await Calender.aggregate([
    {
      $match: {
        date: { $in: targetDates }
      }
    },
    {
      // Optional: Data ko date ke hisab se sort karne ke liye (agar aap chahein)
      $sort: { updatedAt: 1 } 
    }
  ]);

  return ds;
}



async function fULL_forex_analyse(){ 
    // let news= await Fetchcomineddata()
     for(let v of pairs){
    let techinaldata = await ForexTechnicalData(v)
 pairstechincaldata.push(techinaldata)

}

let next3dayscalender= await fetchcalenderdata()
// console.log("\n")
// console.log(next3dayscalender, "next 3 days caleneder data");

let forexfactory_news = await Cleanedforexfactorydata()
// console.log(forexfactory_news , "forexfactory_news news previous 3 hours");

// let gnews= (await Cleangnewsdata()).slice(0,10)
// console.log(gnews , "gnews all all 24 hours ",gnews.length);

let gnews= await gnewsdatafromdb()
// console.log(gnews , "data from db",gnews.length,"gnews data from db");

let technical=pairstechincaldata
// console.log("pairs array me sabhi pairs ka technical data from yahoo")
// yha pr ai ko data dunga ye and final har pair ke liye and full market analyse krke db me store karenege 
let previousanalysed = await Finalanalysedforex.findOne()
// console.log("previous data analysed", previousanalysed)

const prompt = `
CURRENT TECHNICAL DATA

${JSON.stringify(technical)}

Next 3 days ECONOMIC CALENDAR

${JSON.stringify(next3dayscalender)}

FOREX FACTORY NEWS

${JSON.stringify(forexfactory_news)}

GLOBAL FOREX NEWS

${JSON.stringify(gnews)}

PREVIOUS MARKET ANALYSIS
${JSON.stringify(previousanalysed)}


Analyze complete forex market and return JSON.
`;

const aiAnalysis = await forexMarketAnalysis(prompt);

// console.log(pairstechincaldata.length, "pairs technical data");
// console.log(aiAnalysis, "final ai analyses data");
const updated = await Finalanalysedforex.findOneAndUpdate(
  {},
  { analyseddata: aiAnalysis },
  { new: true, upsert: true }
);

}





// fULL_forex_analyse() 
module.exports = fULL_forex_analyse   