const axios = require("axios");

const BASE = "https://api.stockedge.com/Api";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Origin: "https://web.stockedge.com",
  Referer: "https://web.stockedge.com/",
};

const NEWS_CACHE_MS = 5 * 60 * 1000;
const idCache = new Map();   // "rec" -> { id, name, slug, exact }  (ID badalti nahi)
const newsCache = new Map(); // id -> { data, at }

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const stripHtml = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

async function searchCompany(term) {
  const key = norm(term);
  if (idCache.has(key)) return idCache.get(key);

  const { data } = await axios.get(`${BASE}/UniversalSearchApi/GetQuickSearchResult`, {
    params: { searchTerm: term, lang: "en" },
    headers: HEADERS,
    timeout: 15000,
  });

  const stocks = (data?.Data || []).filter((x) => x.EntityName === "Stock");
  if (!stocks.length) return null;

  const exact = stocks.find((s) => norm(s.Slug) === key || norm(s.Name) === key);
  const best = exact || stocks.reduce((a, b) => (b.Score > a.Score ? b : a));

  const out = { id: best.DocId, name: best.Name, slug: best.Slug, exact: !!exact };
  idCache.set(key, out);
  return out;
}

async function getStockEdgeCompanyNews(term, { pages = 2, days = 30, maxItems = 8 } = {}) {
  try {
    const comp = await searchCompany(term);
    if (!comp) return { success: false, error: `"${term}" ke liye company nahi mili` };

    const hit = newsCache.get(comp.id);
    let raw;
    if (hit && Date.now() - hit.at < NEWS_CACHE_MS) {
      raw = hit.data;
    } else {
      raw = [];
      for (let page = 1; page <= pages; page++) {
        const { data } = await axios.get(
          `${BASE}/SecurityDashboardApi/GetNewsitemsForSecurity/${comp.id}`,
          { params: { page, pageSize: 10, lang: "en" }, headers: HEADERS, timeout: 15000 }
        );
        const items = Array.isArray(data) ? data : data?.Data || [];
        raw.push(...items);
        if (items.length < 10) break;
      }
      newsCache.set(comp.id, { data: raw, at: Date.now() });
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const news = raw
      .filter((n) => new Date(n.Date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
      .slice(0, maxItems)
      .map((n) => ({
        date: String(n.Date).slice(0, 10),
        time: n.Time,
        type: n.SubSectionName || "",
        headline: n.Description,
        summary: n.Caption,
        details: stripHtml(n.Details).slice(0, 700), // LLM prompt bhaari na ho
      }));

    return {
      success: true,
      company: comp.name,
      stockEdgeId: comp.id,
      exactMatch: comp.exact,
      sector: raw[0]?.SectorName || "",
      industry: raw[0]?.IndustryName || "",
      count: news.length,
      news,
    };
  } catch (err) {
    console.log("StockEdge news error:", err.response?.status, err.message);
    return { success: false, error: err.message };
  }
}



// Test: node stockedgeNews.js
async function newsdatastockedge(company_name) {
    let {news,stockEdgeId}= await getStockEdgeCompanyNews(company_name)

    
    let final= news.map((v)=>{
        let {date,details}=v
        return {
date,details
        }
    })
    
final.push(stockEdgeId)
// console.log(final)
    return final
}


module.exports = {getStockEdgeCompanyNews,newsdatastockedge};
//  newsdatastockedge("Affordable Robotic & Automation Ltd")