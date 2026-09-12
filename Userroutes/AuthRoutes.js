let express = require("express")
let bcrypt = require("bcrypt")
let jwt = require("jsonwebtoken")

const { Usermodel } = require("../modal/modal")
const asyncHandler = require("../utils/asyncHandler")
const { generateSecureToken, verifySecureToken } = require("../Token/generateToken")

let Userrouter = express.Router()



// ================= REGISTER =================

Userrouter.post("/register",asyncHandler(async (req, res) => {

        let { name, email, password, mobile } = req.body


        if (!name || !email || !password || !mobile) {

            let error = new Error("All fields are required")
            error.statusCode = 400

            throw error
        }


        let existingUser = await Usermodel.findOne({ email })

        if (existingUser) {

            let error = new Error("User already exists")
            error.statusCode = 409

            throw error
        }


        let hashPassword = await bcrypt.hash(password, 10)


        let newUser = await Usermodel.create({
           ...req.body,
           password:hashPassword
        })


        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email
            }
        })

    })
)





// ================= LOGIN =================

Userrouter.post("/login",asyncHandler(async (req, res) => {

        let { email, password } = req.body
        const isMobile = req.headers["x-platform"] === "mobile"

// console.log(isMobile,email,password)

        if (!email || !password) {

            let error = new Error("Email and password required")
            error.statusCode = 400

            throw error
        }


        let user = await Usermodel.findOne({ email })
// console.log("user",user)
        if (!user) {

            let error = new Error("Invalid credentials")
            error.statusCode = 401

            throw error
        }


        let isMatch = await bcrypt.compare(password, user.password)
// console.log("inside is match",isMatch)
        if (!isMatch) {


            let error = new Error("Invalid credentials")
            error.statusCode = 401

            throw error
        }


        let accesstoken = generateSecureToken(user,"accesstoken")
        let refreshtoken= generateSecureToken(user,"refreshtoken")

       


if(isMobile){

   return res.json({
      success:true,
      accesstoken,
      refreshtoken,
      userdata:{...user,password:null}
   })
}


 res.cookie("accesstoken", accesstoken, {

    httpOnly: true,

    secure: false,

    sameSite: "lax",

    maxAge: 1 * 60 * 1000

})


res.cookie("refreshtoken", refreshtoken, {

    httpOnly: true,

    secure: false,

    sameSite: "lax",

    maxAge: 7 * 24 * 60 * 60 * 1000

})

        res.status(200).json({
            success: true,
            message: "Login successful",
        })

    })
)



Userrouter.get("/me",asyncHandler(async (req, res) => {

        const token =
            req.headers.authorization?.split(" ")[1]

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access token required"
            })
        }

        try {

            const userData =
                verifySecureToken(token)

            const user =
                await Usermodel
                    .findById(userData.id)
                    .select("-password")

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found"
                })
            }

            // console.log("route hit me",token)
            res.json({
                success: true,
                userdata:{...user,password:null}
            })

        } catch (error) {

            return res.status(401).json({
                success: false,
                message: "Access token expired or invalid"
            })
        }
    })
)



Userrouter.post("/refresh", asyncHandler(async (req, res) => {

        const { refreshtoken } = req.body

        if (!refreshtoken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token required"
            })
        }

        try {

            const userData =
                verifySecureToken(refreshtoken)

            const user =
                await Usermodel.findById(userData.id)

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found"
                })
            }

            const accesstoken =
                generateSecureToken(
                    user,
                    "accesstoken"
                )

            res.json({
                success: true,
                accesstoken,
                userdata:{...user,password:null}
            })

        } catch (error) {

            return res.status(401).json({
                success: false,
                message: "Refresh token expired or invalid"
            })
        }
    })
)


module.exports = Userrouter