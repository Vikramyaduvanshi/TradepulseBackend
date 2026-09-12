const cookie = require("cookie")
const { verifySecureToken } = require("../Token/generateToken")

// socketMiddleware.js - update karo
const socketmiddleware = async (socket, next) => {
  try {
    // Pehle auth object check karo (mobile ke liye), fallback cookies (web ke liye)
    let accesstoken = socket.handshake.auth?.accesstoken;
    let refreshtoken = socket.handshake.auth?.refreshtoken;

    if (!accesstoken && !refreshtoken) {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      accesstoken = cookies.accesstoken;
      refreshtoken = cookies.refreshtoken;
    }

    if (!accesstoken && !refreshtoken) {
      return next(new Error("Token expires"));
    }

    let user;
    try {
      user = verifySecureToken(accesstoken);
    } catch {
      user = verifySecureToken(refreshtoken);
    }

    socket.user = user;
    next();
  } catch (e) {
    console.log(e);
    next(new Error("Invalid Token"));
  }
};

module.exports = socketmiddleware