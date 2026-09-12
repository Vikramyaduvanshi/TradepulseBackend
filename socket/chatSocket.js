const predictorresult = require("../pricepredcition/Mainpredictor")
const companyAgent = require("./Model_text")

function chatSocket(io, socket) {

    socket.on("send_message", async (data) => {

        try {
            let model_text = await companyAgent(data.text);

            if (!model_text || !model_text.trim()) {
                socket.emit("receive_message", {
                    error: true,
                    message: "Sorry, I couldn't identify a company from your message. Try asking like 'Tata Elxsi share price' or 'Reliance analysis'.",
                });
                return;
            }

            let res = await predictorresult(model_text.trim());

            if (!res) {
                socket.emit("receive_message", {
                    error: true,
                    message: `Sorry, I couldn't find analysis data for "${model_text.trim()}". Please check the company name and try again.`,
                });
                return;
            }

            socket.emit("receive_message", res);

        } catch (err) {
            console.log("Error in chatSocket:", err.message);
            socket.emit("receive_message", {
                error: true,
                message: "Something went wrong while analyzing this request. Please try again.",
            });
        }
    });
}

module.exports = chatSocket;