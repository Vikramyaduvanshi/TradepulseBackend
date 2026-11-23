let mongoose = require("mongoose");

// 10 din (seconds me). Change karna ho to sirf yahan badlo.
const TTL_SECONDS = 10 * 24 * 60 * 60;

// ---------- Schemas ----------
const newsSchema = new mongoose.Schema({
  title: String,
  url: { type: String, unique: true },
  source: String,
  image_url: String,
  ai_summary: { type: String, default: "" },
  impact: String,
  categories: [String],
  description: String,
  content: String,
  time: Date,
}, { timestamps: true });

const tradeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image_url: { type: String, default: "" },
}, { timestamps: true });

const domesticNewsSchema = new mongoose.Schema({
  ID: { type: Number, unique: true },
  Date: Date,
  Time: String,
  Caption: String,
  Description: String,
  Details: String,
  GeneratedText: String,
}, { timestamps: true });

domesticNewsSchema.index({ ID: 1, Date: -1 });

const Userschema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true },
  password: { type: String, required: true },
  mobile: { type: Number },
  role: { type: String, enum: ["user", "vikram"], default: "user" },
  subscription: {
    sub: { type: Boolean, default: false },
    subtype: { type: String, enum: ["premium", "premiumPro", "silver", "silverPro", "gold", "goldPro"] },
  },
  Aichat: [{
    Chatname: { type: String },
    date: { type: Date, default: Date.now }, // () hata diya, warna sabki date same ho jati hai
    chat: [{ role: { type: String }, message: { type: String } }],
  }],
  limit: {
  count: { type: Number, default: 0 },
  blockedUntil: { type: Date, default: null },  // limit full hone ke 6 ghante baad ka time
}
}, { timestamps: true });

const Calenderschema = new mongoose.Schema({
  date: { type: String },
  time: { type: String },
  currency: { type: String },
  impact: { type: String },
  event: { type: String },
  actual: { type: String },
  forecast: { type: String },
  previous: { type: String },
}, { timestamps: true });

const finalmarketschema = new mongoose.Schema({
  analyseddata: String,
}, { timestamps: true }); // pehle timestamps nahi tha, TTL ke liye zaruri hai

// ---------- Auto-delete (TTL) ----------
// User ko jaan-boojhkar skip kiya hai
[newsSchema, tradeSchema, domesticNewsSchema, Calenderschema, finalmarketschema].forEach((schema) => {
  schema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
});

// ---------- Models ----------
const Usermodel = mongoose.model("User", Userschema);
const Finalanalysedforex = mongoose.model("Finalanalysedforex", finalmarketschema);
const Calender = mongoose.model("Calender", Calenderschema);
const DomesticNews = mongoose.model("DomesticNews", domesticNewsSchema);
const Trade = mongoose.model("Trade", tradeSchema);
const News = mongoose.model("News", newsSchema);

module.exports = { Trade, News, DomesticNews, Usermodel, Calender, Finalanalysedforex };