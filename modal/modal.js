let mongoose = require("mongoose");

// Schema
const newsSchema = new mongoose.Schema({
  title: String,
  url: { type: String, unique: true },
  source: String,
  image_url: String,
  ai_summary: { type: String, default: "" },
  impact: String,
  categories: [String],
  description: String,
  content: String,
  time: Date,
}, { timestamps: true });


let tradeSchema= new mongoose.Schema({
title:{type:String, required:true},
description:{type:String, required:true},
image_url:{type:String, default:""}
},
{
    timestamps:true
}
)




const domecticsNews = new mongoose.Schema(
  {
symbol:String,
sm_name:String,
smIndustry:String,
attchmntText:String,
isin:String,//for uniqnes in mongodb
attchmntFile:String,
GeneratedText:String,// will add news if new news come ,
announcementDate:Date
  },
 
  { timestamps: true }
);

domecticsNews.index({isin:1,announcementDate:-1 })

let Userschema= new mongoose.Schema({
  name: {type:String},
  email:{type:String, required:true},
  password:{type:String, required:true},
  mobile:{type:Number},
  role:{type:String,enum:["user","vikram"], default:"user"},
  subscription:{sub:{type:Boolean, default:false}, subtype:{type:String,enum:["premium","premiumPro","silver","silverPro", "gold", "goldPro"]}},
  Aichat:[{Chatname:{type:String}, date:{type:Date, default:Date.now()}, chat:[{role:{type:String}, message:{type:String}}]}]
},
 { timestamps: true }
)


let Usermodel= mongoose.model("User",Userschema)



let Calenderschema= new mongoose.Schema({
date:{type:String},
time:{type:String},
currency:{type:String},
impact:{type:String},
event:{type:String},
actual:{type:String},
forecast:{type:String},
previous:{type:String}   
},
 { timestamps: true }
)   

let finalmarketschema = new mongoose.Schema({

analyseddata:String

})

let Finalanalysedforex= mongoose.model("Finalanalysedforex",finalmarketschema)


let Calender= mongoose.model("Calender", Calenderschema)


let DomesticNews= mongoose.model("DomesticNews", domecticsNews)
let Trade= mongoose.model("Trade", tradeSchema);

let News= mongoose.model("News", newsSchema);

module.exports= {Trade, News,DomesticNews, Usermodel ,Calender,Finalanalysedforex};


