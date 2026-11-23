let express= require("express")
const { DomesticNews } = require("../../modal/modal");
const { UpcomingIpo, GetListedIPOs, GetOngoingIPOs } = require("../IPO");
const generateDomesticSummary = require("../DomesticAi");
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
    const { Description, Details } = req.body;
    const language = String(req.body.language || "English").trim().slice(0, 40);

    if (!Description && !Details) {
      return res
        .status(400)
        .json({ success: false, message: "Description or Details required" });
    }

    const finaltext = `Description: ${Description || ""}\nDetails: ${stripHtml(Details).slice(0, 6000)}`;

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
