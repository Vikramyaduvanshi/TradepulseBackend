let express= require("express")
const { scrapePage } = require("./scrape"); 
const Authmiddleware = require("../middleware/Authmiddleware")
const { Finalanalysedforex } = require("../modal/modal");
const modelFunction = require("./analysed.mdel");

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
console.log(res)
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
    let { url, language, description } = req.body;
    let result = await main(url, language, description);
    res.json({ success: true, data: result });   // ← pehle hardcoded false tha, fix kiya
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});


module.exports= Forexrouter