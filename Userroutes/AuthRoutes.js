let express = require("express")
let bcrypt = require("bcrypt")
let jwt = require("jsonwebtoken")
const crypto = require("crypto");
const { Usermodel } = require("../modal/modal")
const asyncHandler = require("../utils/asyncHandler")
const { generateSecureToken, verifySecureToken } = require("../Token/generateToken")
let nodemailer= require("nodemailer");
let Userrouter = express.Router()



// ================= REGISTER =================

Userrouter.post("/register", asyncHandler(async (req, res) => {

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
        password: hashPassword
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

Userrouter.post("/login", asyncHandler(async (req, res) => {

    let { email, password } = req.body
    const isMobile = req.headers["x-platform"] === "mobile"


    if (!email || !password) {

        let error = new Error("Email and password required")
        error.statusCode = 400

        throw error
    }


    let user = await Usermodel.findOne({ email })

    if (!user) {

        let error = new Error("Invalid credentials")
        error.statusCode = 401

        throw error
    }


    let isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {


        let error = new Error("Invalid credentials")
        error.statusCode = 401

        throw error
    }


    let accesstoken = generateSecureToken(user, "accesstoken")
    let refreshtoken = generateSecureToken(user, "refreshtoken")




    if (isMobile) {

        return res.json({
            success: true,
            accesstoken,
            refreshtoken,
            userdata: { ...user, password: null }
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



Userrouter.get("/me", asyncHandler(async (req, res) => {

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

        res.json({
            success: true,
            userdata: { ...user, password: null }
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
            userdata: { ...user, password: null }
        })

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Refresh token expired or invalid"
        })
    }
})
)

let transported= nodemailer.createTransport({
service:"gmail",
auth:{
  user:process.env.USER,
  pass:process.env.App_password
}
})



const OTP_TTL_MS = 10 * 60e3;     // 10 minute
const RESEND_GAP_MS = 60e3;       // 1 minute me ek hi baar OTP
const MAX_ATTEMPTS = 5;           // galat OTP ki limit

function generateOTP(digits = 6) {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return crypto.randomInt(min, max).toString();
}

// userId(string) -> { otp, exp, attempts, createdAt, timer }
const Otpdstore = new Map();

function setOtp(userId, otp) {
  const old = Otpdstore.get(userId);
  if (old) clearTimeout(old.timer);

  const timer = setTimeout(() => Otpdstore.delete(userId), OTP_TTL_MS);
  timer.unref(); // is timer ki wajah se process band hone se na ruke

  Otpdstore.set(userId, {
    otp,
    exp: Date.now() + OTP_TTL_MS,
    attempts: 0,
    createdAt: Date.now(),
    timer,
  });
}

function deleteOtp(userId) {
  const entry = Otpdstore.get(userId);
  if (entry) clearTimeout(entry.timer);
  Otpdstore.delete(userId);
}

Userrouter.post("/forgot_password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Usermodel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User Not Found For This Account" });
    }

    const userId = String(user._id);

    // Spam rokne ke liye: 1 minute se pehle dobara OTP nahi
    const existing = Otpdstore.get(userId);
    if (existing && Date.now() - existing.createdAt < RESEND_GAP_MS) {
      return res.status(429).json({
        success: false,
        message: "Please wait 1 minute before requesting a new OTP",
      });
    }

    const OTP = generateOTP(6);
    setOtp(userId, OTP);

    try {
      await transported.sendMail({
        from: `TradePulse <${process.env.USER}>`,
        to: email,
        subject: "Password Reset OTP Tradepulse",
        html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
    <h2 style="color: #2e6ddf;">🔐 Password Reset Request</h2>
    <p>Hi there,</p>
    <p>You recently requested to reset your password for your Tradepulse account.</p>
    <p style="color:green;"><strong>This OTP is valid for the next 10 minutes</strong>. After that, it will expire for security reasons.</p>
    <div style="text-align: center; margin: 30px 0; font-size: 24px; letter-spacing: 4px;">
      OTP : <strong>${OTP}</strong>
    </div>
    <p style="color:red;">If you did not request this, you can safely ignore this email.</p>
    <p style="color: #555;">Thanks & regards,<br/><strong>Tradepulse Team</strong></p>
  </div>`,
      });
    } catch (mailErr) {
      deleteOtp(userId); // mail nahi gayi to OTP bhi hata do
      throw mailErr;
    }

    res.json({
      success: true,
      message: "Otp has sent to your email, Please check your email",
      id: user._id,
    });
  } catch (e) {
    console.log("forgot_password error:", e.message);
    res.json({ success: false, message: "Could not send OTP, please try again" });
  }
});
let saltRounds=10
Userrouter.post("/reset_password", async (req, res) => {
  try {
    const { password, otp, id } = req.body;

    if (!id || !otp || !password) {
      return res.json({ success: false, message: "id, otp and password are required" });
    }
    if (String(password).length < 6) {
      return res.json({ success: false, message: "Password must be at least 6 characters" });
    }

    const userId = String(id);
    const entry = Otpdstore.get(userId);

    if (!entry || entry.exp <= Date.now()) {
      deleteOtp(userId);
      return res.json({ success: false, message: "OTP expired, please request a new one" });
    }

    if (entry.attempts >= MAX_ATTEMPTS) {
      deleteOtp(userId);
      return res.json({ success: false, message: "Too many wrong attempts, request a new OTP" });
    }

    // Constant-time compare
    const given = Buffer.from(String(otp));
    const real = Buffer.from(entry.otp);
    const ok = given.length === real.length && crypto.timingSafeEqual(given, real);

    if (!ok) {
      entry.attempts++;
      return res.json({ success: false, message: "Invalid OTP" });
    }

    const hash = await bcrypt.hash(String(password), saltRounds);
    await Usermodel.findByIdAndUpdate(userId, { password: hash });

    deleteOtp(userId); // ek OTP sirf ek baar chalega

    res.json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    console.log("reset_password error:", e.message);
    res.json({ success: false, message: "Could not reset password, please try again" });
  }
});



module.exports = Userrouter