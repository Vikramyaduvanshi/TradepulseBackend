let express= require("express")
const { GetAllResult } = require("./result")

let IndiaResultrouter = express.Router()


IndiaResultrouter.get("/all_result", async(req,res)=>{

try{
    let {page=1,pageSize=10}=req.query
 let data = await GetAllResult(page,pageSize)

return res.json({"message" :"all result fetched successfully", data})

}catch(e){
return res.json({"message" : e.message})
}

})

module.exports= IndiaResultrouter