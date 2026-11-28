let express = require("express")
const { scrapePage } = require("./scrape");
const Authmiddleware = require("../middleware/Authmiddleware")
const { Finalanalysedforex, Usermodel } = require("../modal/modal");
const modelFunction = require("./analysed.mdel");
const checkLimit = require("../modal/checklimit");


let Forexrouter = express.Router()

Forexrouter.get("/full_market_analysed", async (req, res) => {

  try {
    let getalldata = await Finalanalysedforex.findOne()
    res.json({ message: "data fetched successfully", getalldata })
  } catch (e) {
    res.json({ message: e.message, success: true })
  }


})

const TTL_MS = 12 * 60 * 60e3; // 12 ghante
const MAX_ENTRIES = 200;       // Render RAM ke liye; zyada hue to sabse purani hat jayegi

const analysedstore = new Map(); // "newsId|language" -> { value, exp }
const inflight = new Map();      // "newsId|language" -> Promise (ek saath same request par ek hi kaam)

function getCached(key) {
  const hit = analysedstore.get(key);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    analysedstore.delete(key); // expire ho gaya
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  if (analysedstore.size >= MAX_ENTRIES) {
    analysedstore.delete(analysedstore.keys().next().value); // sabse purani hatao
  }
  analysedstore.set(key, { value, exp: Date.now() + TTL_MS });
}

// Isi news ka kisi aur language me result hai? (tumhara purana "language badli" wala case)
function hasOtherLanguage(newsId, language) {
  for (const [k, v] of analysedstore) {
    if (k.startsWith(`${newsId}|`) && k !== `${newsId}|${language}` && v.exp > Date.now()) {
      return true;
    }
  }
  return false;
}

async function main(url, language, description, newsId) {
  const id = newsId || url;
  const key = `${id}|${language}`;

  // 1) Same news + same language: seedha cache se
  const hit = getCached(key);
  if (hit) return hit;

  // 2) Same key par kaam chal raha hai to usi ka wait karo
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    let newsanalysed;

    if (hasOtherLanguage(id, language)) {
      // Is news ka kisi aur language me analysis ho chuka hai: scrape ki zarurat nahi,
      // description se hi naya language bana lo (tumhara purana logic)
      newsanalysed = await modelFunction(description, language);
    } else {
      // Bilkul nayi news: scrape karo
      const res = await scrapePage(url, { stealth: true });
      if (!res.success) {
      
        newsanalysed = await modelFunction(description, language);
      }else{
        newsanalysed = await modelFunction(res, language);
      }
      
    }

    if (newsanalysed) setCached(key, newsanalysed);
    return newsanalysed;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}



Forexrouter.post("/analysed_news", async (req, res) => {
  try {
    let { url, language, description, email, mobile, newsId } = req.body;

    const user = await Usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 3. Limit check
    const allowed = await checkLimit(user._id);
    if (!allowed) {
      const u = await Usermodel.findById(user._id).select("limit.blockedUntil");
      const retryTime = u?.limit?.blockedUntil
        ? new Date(u.limit.blockedUntil).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        : "some time";

      return res.status(429).json({
        success: false,
        message: `Limit has crossed, please try again after ${retryTime}`,
        retryAfter: u?.limit?.blockedUntil,
      });
    }

    let result = await main(url, language, description, newsId);

    res.json({ success: true, data: result });   // ← pehle hardcoded false tha, fix kiya
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});


module.exports = Forexrouter