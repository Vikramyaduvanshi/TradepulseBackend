const jwt = require("jsonwebtoken")
const CryptoJS = require("crypto-js")

const JWT_SECRET = process.env.JWT_SECRET
const AES_SECRET = process.env.AES_SECRET


function generateSecureToken(user,type) {

    // =========================
    // ORIGINAL DATA
    // =========================

    const originalPayload = {
        id: user._id,
        email: user.email,
        role: user.role
    }


    // =========================
    // ENCRYPT PAYLOAD
    // =========================

    const encryptedPayload = CryptoJS.AES.encrypt(

        JSON.stringify(originalPayload),
        AES_SECRET

    ).toString()



    // =========================
    // CREATE JWT
    // =========================

    let token;


    if(type=="accesstoken"){
        token = jwt.sign(

        {
            data: encryptedPayload
        },

        JWT_SECRET,

        {
            expiresIn: "15m"
        }
    )
    }
    if(type=="refreshtoken"){
        token = jwt.sign(

        {
            data: encryptedPayload
        },

        JWT_SECRET,

        {
            expiresIn: "7d"
        }
    )
    }

    return token
}


function verifySecureToken(token) {

    // =========================
    // VERIFY JWT
    // =========================

    const decoded = jwt.verify(
        token,
        JWT_SECRET
    )


    // =========================
    // DECRYPT DATA
    // =========================

    const bytes = CryptoJS.AES.decrypt(
        decoded.data,
        AES_SECRET
    )


    const originalData = JSON.parse(
        bytes.toString(CryptoJS.enc.Utf8)
    )

    return originalData
}


module.exports={generateSecureToken,verifySecureToken}

