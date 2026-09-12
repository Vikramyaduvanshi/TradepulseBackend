const predictorresult = require("../pricepredcition/Mainpredictor")
const companyAgent = require("./Model_text")

function chatSocket(io, socket) {

    socket.on("send_message", async(data) => {

        // console.log("send message ayi frontend se", data)

        // console.log("socket id", socket.id)
  let model_text= await companyAgent(data.text)
// console.log(model_text,"model text")

// // yha pr vo data bhi send krna hai jisko analyse krke ye predictor bna hai
        let res = await predictorresult(model_text.trim())

        // console.log("result in chatsocket", res)

        // let response = {...res,time: new Date().toLocaleTimeString(),sender: "ai"}

        socket.emit("receive_message", res)

    })

}

module.exports = chatSocket