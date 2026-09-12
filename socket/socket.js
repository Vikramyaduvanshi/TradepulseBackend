const { Usermodel } = require("../modal/modal");
const { redisClient } = require("../redis");
const chatSocket = require("./chatSocket");
const socketmiddleware = require("./socketMiddleware");

function setupSocket(io){


io.use(socketmiddleware)

  io.on("connection", async (socket) => {

        // console.log("User Connected")

        // console.log(socket.id)

        // console.log(socket.user)
        // console.log("all connected users",io.sockets.sockets)
        let existuser= await Usermodel.findOne({email:socket.user.email})

        // STORE IN REDIS
        // await redisClient.set(`${existuser._id}`, socket.id)

        // chat events
       chatSocket(io, socket)

        socket.on("disconnect",async () => {

            console.log("Disconnected")
            // await redisClient.del(`${existuser._id}`)

        })

    })




}

module.exports= setupSocket