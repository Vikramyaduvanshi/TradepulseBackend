let express= require("express")
const { scrapePage } = require("./scrape"); 
const Authmiddleware = require("../middleware/Authmiddleware")
const { Finalanalysedforex, Usermodel } = require("../modal/modal");
const modelFunction = require("./analysed.mdel");
const checkLimit = require("../modal/checklimit");

let Forexrouter= express.Router()

Forexrouter.get("/full_market_analysed", async (req,res)=>{

try{
        let getalldata= await Finalanalysedforex.findOne()
        res.json({message:"data fetched successfully", getalldata})
}catch(e){
res.json({message:e.message, success:true})
}


})


async function main(url,language,description) {
  const res = await scrapePage(url, { stealth: true });
let newsanalysed;
// console.log(res)
  if (res.success==false) {
    console.log("Scraping failed:", res.error);
     newsanalysed = await modelFunction(description, language);

  }else{
     newsanalysed = await modelFunction(res, language);   
  }


  return newsanalysed;
}



Forexrouter.post("/analysed_news", async (req, res) => {
  try {
    let { url, language, description,email,mobile } = req.body;

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

    let result = await main(url, language, description);
    console.log("analysed ",result)
    res.json({ success: true, data: result });   // ← pehle hardcoded false tha, fix kiya
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});


module.exports= Forexrouter