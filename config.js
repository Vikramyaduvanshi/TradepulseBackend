let mongoose= require("mongoose")



async function ConnectDb(){


   try{
     await mongoose.connect(process.env.MONGO_URI)
     console.log("mongodb connected successfully")
   }catch(e){
console.log("server connected succesfully to db",e.message)
   }
}










module.exports=ConnectDb