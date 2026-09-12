// middleware/errorMiddleware.js

const errorMiddleware = (err, req, res, next) => {

    // =========================
    // DEFAULT VALUES
    // =========================
    let statusCode = err.statusCode || 500
    let message = err.message || "Internal Server Error"

    // =========================
    // LOG FULL ERROR
    // =========================
    // console.log("\n===== ERROR START =====")
    // console.log("Time:", new Date().toLocaleString())
    // console.log("Route:", req.originalUrl)
    // console.log("Method:", req.method)
    // console.log("Message:", err.message)
    // console.log("Stack:", err.stack)
    // console.log("===== ERROR END =====\n")


    // =========================
    // MONGODB INVALID OBJECT ID
    // =========================
    if (err.name === "CastError") {
        statusCode = 400
        message = "Invalid ID"
    }

    // =========================
    // MONGODB DUPLICATE KEY
    // =========================
    if (err.code === 11000) {
        statusCode = 400
        message = `Duplicate field value entered`
    }

    // =========================
    // JWT ERROR
    // =========================
    if (err.name === "JsonWebTokenError") {
        statusCode = 401
        message = "Invalid Token"
    }

    // =========================
    // JWT EXPIRED
    // =========================
    if (err.name === "TokenExpiredError") {
        statusCode = 401
        message = "Token Expired"
    }

    // =========================
    // MULTER FILE ERROR
    // =========================
    if (err.code === "LIMIT_FILE_SIZE") {
        statusCode = 400
        message = "File size too large"
    }

    // =========================
    // VALIDATION ERROR
    // =========================
    if (err.name === "ValidationError") {

        let errors = Object.values(err.errors).map((val) => val.message)

        statusCode = 400
        message = errors
    }

    // =========================
    // RESPONSE
    // =========================
    res.status(statusCode).json({
        success: false,
        message,
        errorType: err.name || "UnknownError",

        // only for development
        stack: process.env.NODE_ENV === "production"
            ? null
            : err.stack
    })
}

module.exports = errorMiddleware