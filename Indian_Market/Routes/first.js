let express= require("express")
const { DomesticNews, Usermodel } = require("../../modal/modal");
const { UpcomingIpo, GetListedIPOs, GetOngoingIPOs } = require("../IPO");
const generateDomesticSummary = require("../DomesticAi");
const checkLimit = require("../../modal/checklimit");
let Indiarouter= express.Router()


Indiarouter.get("/india_news", async (req, res) => {
  try {
    let { limit = 20, page = 1, searchword, id } = req.query;

    let searchobj = {};

    if (id) {
      searchobj.ID = Number(id);
    } 
    
    else if (searchword) {
      // Ab dedicated company-name field nahi hai, isliye Caption + Description
      // dono me regex search kar rahe hain
      searchobj.$or = [
        { Description: { $regex: searchword, $options: "i" } },
        { Caption: { $regex: searchword, $options: "i" } }
      ];
    }

    let skip = (Number(page) - 1) * Number(limit);

    let news = await DomesticNews.aggregate([
      { $match: searchobj },
      { $sort: { Date: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $project: {
          ID: 1,
          Caption: 1,
          Description: 1,
          Details:1,
          Date: 1,
          Time: 1
        }
      }
    ]);

    res.json({ success: true, news });

  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

const stripHtml = (html = "") =>
  html
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

Indiarouter.post("/analysedIndia", async (req, res) => {
  try {
    const { Description, Details, email } = req.body;

    // 1. Pehle validation
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }
    if (!Description && !Details) {
      return res
        .status(400)
        .json({ success: false, message: "Description or Details required" });
    }

    // 2. User dhundo (await zaruri hai)
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

  
    const language = String(req.body.language || "English").trim().slice(0, 40);
    const finaltext = `Description: ${Description || ""}\nDetails: ${stripHtml(Details || "").slice(0, 6000)}`;

    const data = await generateDomesticSummary(finaltext, language);
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});



Indiarouter.get("/upcoming_ipo" , async (req,res)=>{

try{
    let {page=1,pageSize=10}=req.query

  let data= await UpcomingIpo(page,pageSize)
  return res.json({"message":"Upcoming IPO data fetched successfully", data})

}catch(e){
return res.json({"message":e.message})

}
})


Indiarouter.get("/get_listed_ipo" , async (req,res)=>{
try{
    let {page=1,pageSize=10}=req.query

  let data= await GetListedIPOs(page,pageSize)
  return res.json({"message":"listed IPO data fetched successfully", data})

}catch(e){
return res.json({"message":e.message})

}
})


Indiarouter.get("/get_ongoing_ipo" , async (req,res)=>{
try{
  let {page=1,pageSize=10}=req.query

  let data= await GetOngoingIPOs(page,pageSize)

  return res.json({"message":"ongoing IPO data fetched successfully", data})

}catch(e){

return res.json({"message":e.message})

}
})



module.exports=Indiarouter
