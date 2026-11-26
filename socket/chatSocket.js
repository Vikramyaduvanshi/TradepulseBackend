const checkLimit = require("../modal/checklimit")
const { Usermodel } = require("../modal/modal")
const predictorresult = require("../pricepredcition/Mainpredictor")
const companyAgent = require("./Model_text")

const TOTAL_SOURCES = 8

function preview(v, depth = 0) {
    if (v === null || v === undefined) return null
    if (typeof v === "string") return v.length > 160 ? v.slice(0, 160) + "…" : v
    if (typeof v === "number" || typeof v === "boolean") return v
    if (Array.isArray(v)) {
        return { count: v.length, items: depth < 2 ? v.slice(0, 3).map((x) => preview(x, depth + 1)) : [] }
    }
    if (typeof v === "object") {
        const out = {}
        Object.keys(v).slice(0, 8).forEach((k) => {
            if (v[k] === null || v[k] === undefined) return
            out[k] = depth < 2 ? preview(v[k], depth + 1) : "…"
        })
        return out
    }
    return String(v)
}

function safePreview(v) {
    try {
        const p = preview(v)
        const s = JSON.stringify(p)
        return s && s.length > 3000 ? { note: "Data too large, preview trimmed" } : p
    } catch (e) {
        return null
    }
}
function chatSocket(io, socket) {
    const { id } = socket.user

    socket.on("send_message", async (data) => {
        const send = (m) => socket.emit("receive_message", m)
        const fail = (message) => send({ error: true, message })

        const userText = String(data?.text || "").trim()
        if (!userText) return fail("Please type a company name.")
        if (socket.data.busy) return fail("Please wait, your previous analysis is still running.")
        socket.data.busy = true

        try {
            send("Understanding your query...")
            const model_text = await companyAgent(userText)
            const company = String(model_text || "").trim().toUpperCase()

            if (!company || company === "UNKNOWN") {
                return fail("Sorry, I couldn't identify a company from your message. Try asking like 'Tata Elxsi share price' or 'Reliance analysis'.")
            }

            // ---- Limit check (company pehchanne ke baad, analysis se pehle) ----
            // const allowed = await checkLimit(id)
            // if (!allowed) {
            //     const u = await Usermodel.findById(id).select("limit.blockedUntil")
            //     const retryTime = u?.limit?.blockedUntil
            //         ? new Date(u.limit.blockedUntil).toLocaleString("en-IN", {
            //             timeZone: "Asia/Kolkata",
            //             day: "2-digit",
            //             month: "short",
            //             hour: "2-digit",
            //             minute: "2-digit",
            //             hour12: true,
            //         })
            //         : "some time"
            //     return send({
            //         error: true,
            //         limitReached: true,
            //         message: `Limit has crossed, please try again after ${retryTime}`,
            //     })
            // }

            send(`Analyzing ${company}...`)

            let usedSources = 0
            const res = await predictorresult(company, (p) => {
                if (p.step === "Generating AI analysis") return send("Final analysis in progress, please wait...")
                if (p.ok) {
                    usedSources += 1
                    send(`✓ ${p.step}`)
                    send({ type: "source_data", name: p.step, ok: true, preview: safePreview(p.data) })
                } else {
                    send(`⚠ ${p.step} unavailable, continuing...`)
                    send({ type: "source_data", name: p.step, ok: false, preview: null })
                }
            })

            if (!res || res.success === false) {
                return fail(`Sorry, I couldn't find analysis data for "${company}". Please check the company name and try again.`)
            }

            send(`Analysis based on ${usedSources} of ${TOTAL_SOURCES} data sources`)
            send(res)
        } catch (err) {
            console.log("Error in chatSocket:", err.message)
            fail("Something went wrong while analyzing this request. Please try again.")
        } finally {
            socket.data.busy = false
        }
    })
}
module.exports = chatSocket