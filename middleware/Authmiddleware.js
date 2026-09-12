const { Usermodel } = require("../modal/modal");
const { verifySecureToken, generateSecureToken } = require("../Token/generateToken");

function Authmiddleware(){
    return async (req,res,next)=>{
        let access_token = req.cookies?.accesstoken
        let refresh_token = req.cookies?.refreshtoken
        let payload;

if(access_token){
try{
payload = verifySecureToken(access_token)
}
catch(e){
if(e.message == "jwt expired"){
    // console.log("access token has expired")
}else{
    return res.json({message:"invalid access token", success:false})
}
}
}

if(!payload){

if(!refresh_token){
  return   res.json({message:"please login again", success:false})
}
try {
let refreshpayload= verifySecureToken(refresh_token)
let new_access_token= generateSecureToken(refreshpayload)
    res.cookie("accesstoken", new_access_token, {
              httpOnly:true,
              secure:true,
              sameSite:"none",
              maxAge:7 * 24 * 60 * 60 * 1000
            })

payload=refreshpayload
}catch(e){
res.json({message:"session expired",success:false})
}

}

let checksub= await Usermodel.findById(payload._id)

if(checksub.subscription){
    req.userId= payload._id
    next()
}else{
return res.json({message:"subscription has expired"}) 
}

    }
}

module.exports=Authmiddleware