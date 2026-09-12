let dotenv= require("dotenv")
const http = require("http")
let cookieParser= require("cookie-parser")
dotenv.config()
let express= require("express");
let {Server}=require("socket.io")
let cors=require("cors")
const newsrouter = require("./Route/routes");
let App= express();
const server = http.createServer(App)
App.use(express.json());

let PORT= process.env.PORT || 8000
App.use(cors({

    origin: "http://localhost:5173", 

    credentials: true

}))

// COOKIE PARSER
App.use(cookieParser())

const ConnectDb = require("./config");
// App.use(cors())
const axios = require("axios");
const cron = require("node-cron");
const { News } = require("./modal/modal");
// const generateSummary = require("./Route/generate_summary");
const detectAssets = require("./Route/assest");
// const getPrice = require("./Route/assetsPrice");
const runDomesticPipeline = require("./Indian_Market/DomesticPipeLine");
const Indiarouter = require("./Indian_Market/Routes/first");
const Userrouter = require("./Userroutes/AuthRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");
const setupSocket = require("./socket/socket");
const fULL_forex_analyse = require("./forex_market/Full_forex_analyse");
const CalenderHandleWithUpsert = require("./forex_market/Forex_Calender");
const convertToCron = require("./forex_market/convertToCron");
const { fetchAllNews } = require("./forex_market/forex_fetch");
const Forexrouter = require("./forex_market/routes");
const IndiaResultrouter = require("./Indian_Market/Routes/Resultapi");
// const { generateSummary } = require("./  Route/generate_summary");

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true // Yeh allow karta hai cookies ko cross-origin bhejna
  }
});
// setup socket
// setupSocket(io)
setupSocket(io)

App.get("/test", (req, res)=>{

res.json({success:true, message:"testing routing is running successfully"});

})


App.use("/news", newsrouter);
App.use("/India", Indiarouter)
App.use("/user",Userrouter)
App.use("/forex", Forexrouter)
App.use("/india_result", IndiaResultrouter)


const categories = ["forex", "general", "crypto"];

// ===============================
// 🧠 IMPACT KEYWORDS (Weighted)
// ===============================
const impactKeywords = [
  { keyword: "interest rate", weight: 3 },
  { keyword: "fomc", weight: 3 },
  { keyword: "inflation", weight: 3 },
  { keyword: "cpi", weight: 3 },
  { keyword: "gdp", weight: 3 },
  { keyword: "central bank", weight: 3 },

  { keyword: "war", weight: 3 },
  { keyword: "geopolitical", weight: 2 },
  { keyword: "tariff", weight: 2 },

  { keyword: "oil", weight: 2 },
  { keyword: "gold", weight: 2 },
  { keyword: "crude", weight: 2 },

  { keyword: "jobs", weight: 2 },
  { keyword: "employment", weight: 2 },
  { keyword: "unemployment", weight: 2 },

  { keyword: "rate", weight: 1 }
];

// ===============================
// 🏷️ CATEGORY KEYWORDS
// ===============================
const categoryKeywords = {
ECONOMY: [
  "interest rate","rate cut","rate hike","inflation","cpi","core cpi","ppi","core ppi",
  "gdp","gdp growth","economic growth",
  "fomc","fed","rbi","ecb","boj","boe","rba","central bank",
  "monetary policy","policy decision","rate decision",
  "recession","slowdown","economic outlook","forecast","downgrade","upgrade",
  "soft landing","hard landing","stagflation",
  "quantitative easing","qe","quantitative tightening","qt",
  "stimulus","liquidity injection","tapering",
  "hawkish","dovish","tightening","easing",
  "trade balance","current account","fiscal deficit","budget deficit",
  "government spending","public debt",
  "jobs","jobless","employment","unemployment",
  "non-farm payroll","nfp","wages","salary",
  "labor market","job growth","claims","initial claims","jobless claims",
  "consumer confidence","business confidence","retail sales",
  "industrial production","manufacturing","services pmi","composite pmi",
  "housing market","home sales","housing starts","mortgage rate"
],

GEO_POLITICAL: [
  
  "war","conflict","attack","strike","airstrike","drone","missile",
  "projectile","bombing","shelling",
  "killed","assassinated","assassination","eliminated","targeted killing",
  "military","troops","deployment","airbase","naval base","defense system",
  "military operation","operation","offensive","retaliation",
  "nuclear","nuclear program","nuclear doctrine","missile test",
  "tension","escalation","crisis","geopolitical","standoff",
  "sanctions","tariff","embargo","trade restrictions",
  "oil supply","strait","shipping lane","trade route","energy crisis",
  "ceasefire","peace talks","negotiation","summit",
  "global risk","uncertainty","risk aversion","safe haven", "nato","nato's","north atlantic treaty organization","un",
  "united nations","unsc","security council","opec","opec+","bricks"
],

  COMMODITY: [
    "oil","crude","wti","brent","gold","silver","copper",
    "gas","natural gas","energy","commodity","opec",
    "supply","demand","inventory","output"
  ],

  MARKET: [
    "stock","equity","share","nasdaq","dow","s&p",
    "sensex","nifty","dax","ftse","index","indices",
    "bond","yield","treasury","volatility","vix",
    "market rally","selloff","correction","crash"
  ],

CRYPTO: [
  // Top Coins (FULL names only - safe)
  "bitcoin","ethereum","tether","binance coin","usd coin",
  "ripple","solana","cardano","dogecoin","tron",
  "avalanche","polkadot","polygon","litecoin","chainlink","stellar",

  // Mid coins (safe names)
  "monero","cosmos","uniswap","filecoin","aptos",
  "arbitrum","optimism","near protocol","internet computer",
  "vechain","algorand","hedera","decentraland",
  "axie infinity","tezos","eos","aave","maker","compound",

  // Ecosystem keywords (strong signals)
  "crypto","cryptocurrency","blockchain","web3","defi","nft",
  "staking","mining","smart contract",

  // Trading / impact (VERY IMPORTANT)
  "crypto crash","bitcoin crash","market crash",
  "liquidation","long liquidation","short liquidation",
  "whale movement","on-chain","exchange inflow","exchange outflow",

  // Regulation (HIGH IMPACT)
  "crypto regulation","crypto ban","ban on crypto",
  "bitcoin etf","ethereum etf","etf approval",

  // Security
  "crypto hack","exchange hack","wallet hack","rug pull","exploit"
],

FOREX: [
  "forex","currency","exchange rate","currency pair","fx market",
  "usd","eur","gbp","jpy","inr","aud","cad","chf","nzd",
  "dollar","euro","pound","yen","rupee",
  "eur/usd","usd/jpy","gbp/usd","usd/chf","aud/usd","usd/cad","nzd/usd",
  "eur/gbp","eur/jpy","gbp/jpy","aud/jpy","cad/jpy",
  "dxy","usd index","dollar index",
  "strong dollar","weak dollar","dollar strength","dollar weakness",
  "safe haven","flight to safety","yen strength","swiss franc",
  "risk on","risk off","risk sentiment","market sentiment",
  "forex volatility","currency volatility","volatility",
  "rally","selloff","drop","surge","plunge","spike",
  "fx intervention","currency intervention","devaluation","revaluation",
  "carry trade","yield differential","capital flows","hot money",
  "liquidity","market liquidity","fx liquidity",
  "em currency","emerging market currency","em fx"
],

CORPORATE: [
  "quarterly results","q1 results","q2 results","q3 results","q4 results",
  "earnings report","earnings results",
  "earnings beat","earnings miss",
  "revenue rises","revenue falls",
  "profit rises","profit falls","net profit",
  "raises guidance","cuts guidance","lowers guidance",
  "revises outlook","issues outlook",
  "acquires","acquisition","to acquire",
  "merger","merges with",
  "takeover","buyout",
  "ipo","initial public offering",
  "ipo opens","ipo closes","ipo subscribed",
  "lists on","listing debut",
  "share buyback","buyback announced",
  "declares dividend","dividend announced",
  "stock split","bonus shares","rights issue",
  "wins order","secures order","order worth",
  "bags contract","contract worth",
  "raises funds","fund raise","raises capital",
  "stake sale","sells stake","buys stake",
  "ceo resigns","ceo steps down","cfo resigns",
  "appoints ceo","appoints cfo",
  "files for bankruptcy","bankruptcy filing",
  "insolvency proceedings",
  "default on debt","loan default",
  "fraud case","accounting fraud",
  "regulatory probe","under investigation"
]
};


// 🔴 IMPACT DETECT (ADVANCED)

const getImpact = (headline) => {
  const h = headline.toLowerCase();
  let score = 0;

  impactKeywords.forEach(item => {
    if (h.includes(item.keyword)) {
      score += item.weight;
    }
  });

  if (score >= 5) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
};


// 🏷️ MULTI CATEGORY DETECT

const matchKeyword = (text, keyword) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
};
const detectCategories = (headline) => {
  const matched = [];

  for (let category in categoryKeywords) {
    if (
      categoryKeywords[category].some((k) =>
        matchKeyword(headline, k)
      )
    ) {
      matched.push(category);
    }
  }

  return matched.length ? matched : ["GENERAL"];
};


// ===============================
// 🧹 FORMAT NEWS
// ===============================
const formatNews = async (newsArray) => {
  return await Promise.all(
    newsArray.map(async (n) => {
      
      const title = n.title || n.headline || "";
      const description = n.description || "";
      const content = n.content || "";

      const impact = getImpact(title);

      // ✅ await fix
      // const existNews = await News.findOne({ url: n.url });

      // let ai_summary = existNews?.ai_summary || "";

      // 🔥 Detect only relevant assets
      // const assets = detectAssets(title + " " + description);

      // let newsPrices = {};
      // assets.forEach(a => {
      //   if (priceData[a]) {
      //     newsPrices[a] = priceData[a];
      //   }
      // });

      // 🔥 Generate AI only if not exists
      // if (!existNews) {
      //   ai_summary = await generateSummary(
      //     title,
      //     description,
      //     content?.slice(0, 1000), // 🔥 limit content
      //     newsPrices
      //   );
      // }

      return {
        title,
        source: n.source?.name || n.source || "",
        url: n.url,
        image_url: n.image || "",

        ai_summary:"",
        impact,

        description,
        content,

        categories: detectCategories(title),

        // priceData: newsPrices, // 🔥 ADD THIS

        time: new Date(n.publishedAt || n.datetime || Date.now())
      };
    })
  );
};

// ===============================
// 🌐 STORE (TEMP MEMORY)
// ===============================
let storedNews = [];

// ===============================
// ⏱️ CRON JOB
// ===============================
cron.schedule("*/30 * * * *", async () => {
  // console.log("Running cron at:", new Date().toLocaleTimeString());

  const assets = new Set();

  const rawNews = await fetchAllNews();

  // 🔥 STEP 1: Collect all unique assets
  for (let news of rawNews) {
    const detected = detectAssets(news.title + " " + news.description);
// isko behtar bnao assests ko
    detected.forEach(a => assets.add(a)); // ✅ correct way
  }

  // 🔥 STEP 2: Fetch prices (once per asset)
  // const currentpriceassets = {};

  // for (let asset of assets) {
  //   currentpriceassets[asset] = await getPrice(asset);
  // }
  
  // 🔥 STEP 3: Format news (pass price data)
  const formatted = await formatNews(rawNews);

  const map = new Map();

  // 🔥 STEP 4: Remove duplicates
  for (let news of formatted) {
    map.set(news.url, news);
  }

  const uniqueNews = Array.from(map.values());

  // 🔥 STEP 5: Save to DB
  for (let news of uniqueNews) {
    try {
      await News.updateOne(
        { url: news.url },
        { $setOnInsert: news },
        { upsert: true }
      );
    } catch (err) {
      console.log("Skip duplicate");
    }
  }

  // console.log("DB Updated", uniqueNews.length);
});


//crone for domestic
cron.schedule("*/30 * * * *", async () => {
  // console.log("⏰ Cron running every 1 minute...");

  try {
    await runDomesticPipeline();
  } catch (err) {
    console.log("Cron Error:", err.message);
  }
});


let eventJob = null;
let next_shedule= {}
function scheduleNextJob() {
  if (!next_shedule.time) return;

  // Purani cron band karega and next upcoming data ke bad run hoga 
  if (eventJob) {
    eventJob.stop();
    eventJob.destroy?.();
  }

  eventJob = cron.schedule(next_shedule.time, async () => {
    // console.log("⏰ Dynamic Event Triggered");

    let res = await CalenderHandleWithUpsert();

    next_shedule.idx++;

    while(res[next_shedule.idx].time==""){
      next_shedule.idx++;
    }

    if (res[next_shedule.idx]) {
      next_shedule.time = convertToCron(
        res[next_shedule.idx].time
      );

      // console.log("Next Event:", next_shedule.time);

      // next cron create
    
      scheduleNextJob();
    }
  });
}


cron.schedule("0 0 * * *", async () => {
try{
    // console.log("⏰ Daily Calendar Refresh");
// isme mene daily caleneder set krna and new cron update ka logic likhna hai
  let res = await CalenderHandleWithUpsert();
let i=0
while(res[i].time==""){
i++
}


  next_shedule.idx = i;

  if (res.length) {
    next_shedule.time = convertToCron(res[i].time);

    // console.log("First Event:", next_shedule.time);

    scheduleNextJob();
  }
}catch(e){
console.log(e.message)

}
});


cron.schedule("0 */2 * * *", async () => {
  // console.log("⏰ Cron running every 1 minute...");

  try {
    await fULL_forex_analyse();
  } catch (err) {
    console.log("Cron Error:", err.message);
  }
});





App.use(errorMiddleware)





server.listen(PORT, "0.0.0.0", () => {
    ConnectDb();
    console.log(`Server running on port ${PORT}`);
});