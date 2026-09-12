let express= require("express")
const Authmiddleware = require("../middleware/Authmiddleware")
const { Finalanalysedforex } = require("../modal/modal")

let Forexrouter= express.Router()

Forexrouter.get("/full_market_analysed", async (req,res)=>{

try{
        let getalldata= await Finalanalysedforex.findOne()
        res.json({message:"data fetched successfully", getalldata})
}catch(e){
res.json({message:e.message, success:true})
}


})



module.exports= Forexrouter