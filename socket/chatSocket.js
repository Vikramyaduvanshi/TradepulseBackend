const predictorresult = require("../pricepredcition/Mainpredictor")
const companyAgent = require("./Model_text")

const TOTAL_SOURCES = 7

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

    socket.on("send_message", async (data) => {
        const send = (m) => socket.emit("receive_message", m)
        const fail = (message) => send({ error: true, message })

        const userText = String(data?.text || "").trim()
        if (!userText) return fail("Please type a company name.")
        if (socket.data.busy) return fail("Please wait, your previous analysis is still running.")
        socket.data.busy = true

        try {
            send("Understanding your query...")
            let model_text = await companyAgent(userText)

            if (!model_text || !model_text.trim()) {
                return fail("Sorry, I couldn't identify a company from your message. Try asking like 'Tata Elxsi share price' or 'Reliance analysis'.")
            }

            const company = model_text.trim()
            send(`Analyzing ${company}...`)

            let usedSources = 0
            let res = await predictorresult(company, (p) => {
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

            if (!res) {
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