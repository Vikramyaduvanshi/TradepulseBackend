let express= require("express")
const { DomesticNews } = require("../../modal/modal");
const { UpcomingIpo, GetListedIPOs, GetOngoingIPOs } = require("../IPO");
let Indiarouter= express.Router()



Indiarouter.get("/india_news", async (req, res) => {
  try {
    let { limit = 20, page = 1, searchword, isin } = req.query;

    let searchobj = {};

  
    if (isin) {
      searchobj.isin = isin;
    } 
   
    else if (searchword) {
      searchobj.sm_name = { $regex: searchword, $options: "i" };
    }

    let skip = (Number(page) - 1) * Number(limit);

    let news = await DomesticNews.aggregate([
      { $match: searchobj },
      { $sort: { announcementDate: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $project: {
          symbol: 1,
          sm_name: 1,
          GeneratedText: 1,
          announcementDate: 1,
          isin: 1 
        }
      }
    ]);

    res.json({ success: true, news });

  } catch (e) {
    res.json({ success: false, message: e.message });
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
