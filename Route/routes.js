let express= require("express");
let newsrouter= express.Router()
const { News, Trade } = require("../modal/modal");



newsrouter.post("/post_news", async (req,res)=>{
try{
    let {title, description,image}= req.body;
// console.log(req.body)
let news1=  new News(
    {
        ...req.body,
        image_url:image
    }
)

await news1.save()

res.json({succees:true, message:"news created successfully"})
}catch(e){
res.json({success:false, message:e.message})
}
})

newsrouter.post("/post_trade", async (req,res)=>{
try{
    let {title, description,image }= req.body;

let News=new Trade(
    {
        ...req.body,
        image_url:image
    }
)

await News.save()

res.json({succees:true, message:"news created successfully"})
}catch(e){
res.json({success:false, message:e.message})
}
})

newsrouter.get("/get_news", async (req,res)=>{
try{
   let {searchword, page=1, limit=20}= req.query
// console.log(searchword)
   let searchobj={};
   if(searchword && searchword.trim() !== ""){
    searchobj.title= {$regex:searchword, $options:"i"}
   }

let skip= (Number(page)-1)*Number(limit)

let news= await News.aggregate([{$match:searchobj},{ $sort: { createdAt: -1 } }, {$skip:skip}, {$limit:Number(limit)}])

res.json({success:true, message:"data get successfully",news})

}catch(e){
res.json({success:false, message:e.message})
}

})

newsrouter.get("/get_news/:id", async (req,res)=>{
try{
    let id= req.params.id
   let res1= await News.findById(id)

res.json({success:true, message:"data get successfully",singlenews:res1})

}catch(e){
res.json({success:false, message:e.message})
}

})



newsrouter.get("/get_trade", async (req,res)=>{
try{
   let {searchword, page=1, limit=20}=req.query
let searchobj= {}
if(searchword && (searchword.trim() !=="" || searchword.trim() !==" ") ){
    searchobj.title={$regex:searchword, $option:"i"};
}
let skip= (Number(page)-1)*Number(limit);

let news=await Trade.aggregate([{$match:searchobj} ,{$sort:{createdAt:-1}}, {$skip:skip}, {$limit: Number(limit)}]);

res.json({success:true, message:"news fetched successfully",trades:news});
}catch(e){
res.json({message:e.message, success:false})
}
})



newsrouter.delete("/delete_news/:id", async (req,res)=>{

try{

let id = req.params.id

let result = await News.findByIdAndDelete(id)

res.json({message:"News deleted successfully"})

}catch(err){
res.status(500).json({error:err.message})
}

})



newsrouter.delete("/delete_trade/:id", async (req,res)=>{

try{

let id = req.params.id

let result = await Trade.findByIdAndDelete(id)

res.json({message:"Trade deleted successfully"})

}catch(err){
res.status(500).json({error:err.message})
}

})



newsrouter.put("/update_trade/:id", async (req,res)=>{

try{

let id = req.params.id

let result = await Trade.findByIdAndUpdate(
id,
req.body,
{new:true}
)

res.json({message:"Trade updated successfully",data:result})

}catch(err){
res.status(500).json({error:err.message})
}

})



newsrouter.put("/update_news/:id", async (req,res)=>{

try{

let id = req.params.id

let result = await News.findByIdAndUpdate(
id,
req.body,
{new:true}
)

res.json({message:"News updated successfully",data:result})

}catch(err){
res.status(500).json({error:err.message})
}

})

module.exports=newsrouter