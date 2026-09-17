// const generateDomesticSummary = require("./DomesticAi")
// const ExtractTotext = require("./PdfTotext")





// async function Domestictheme(arr){

// let newarr = await Promise.all(arr.map(async (v,i)=>{
// let {symbol, sm_name, smIndustry, attchmntText, sm_isin, sort_date, attchmntFile} = v

// let text = await ExtractTotext(attchmntFile)
// let gt = await generateDomesticSummary(sm_name, text) 

// return {
// symbol,
// sm_name,
// smIndustry,
// attchmntText,
// isin: sm_isin,
// attchmntFile,
// GeneratedText: gt,
// announcementDate: new Date(sort_date) 
// }
// }))

// return newarr
// }

// module.exports=Domestictheme
const cheerio = require("cheerio");

/**
 * Raw HTML "Details" field ko clean, readable plain text me convert karta hai.
 * cheerio use karte hain kyunki:
 *  - saare HTML tags (<p>, <div>, <br>, etc.) properly hatte hain
 *  - HTML entities (&nbsp;, &amp;, etc.) sahi tarike se decode hoti hain
 *  - simple regex se sirf tags hatte, entities reh jaati (jaise &nbsp; wapas aa jaata)
 */
function cleanHtmlToText(html) {
  if (!html) return "";

  const $ = cheerio.load(html);

  // Empty <div><br></div> jaisे trailing junk blocks hata do
  $("br").replaceWith("\n");

  let text = $.root().text();

  text = text
    .replace(/\u00A0/g, " ")        // &nbsp; ke baad bhi kabhi-kabhi raw non-breaking space reh jaata hai
    .replace(/[ \t]+/g, " ")        // multiple spaces/tabs ko ek space
    .replace(/\n\s*\n+/g, "\n\n")   // multiple blank lines ko ek blank line
    .replace(/^\s+|\s+$/g, "")      // start/end ka whitespace
    .trim();

  return text;
}

/**
 * API ka "Date" field hamesha T00:00:00 (midnight) deta hai — asli time
 * "Time" field me alag string ("12:30 pm") ke roop me aata hai. Isko
 * combine karke ek real, sortable timestamp banate hain.
 *
 * NSE/BSE announcements IST (UTC+5:30) me hote hain, isliye explicitly
 * "+05:30" offset use karte hain — server ki local timezone chahe kuch
 * bhi ho, result hamesha sahi/consistent rahega.
 */
function combineDateAndTime(dateStr, timeStr) {
  const datePart = dateStr.split("T")[0]; // "2026-09-16"

  const match = (timeStr || "").trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);

  if (!match) {
    // Time format samajh nahi aaya to fallback: sirf date, explicit IST midnight
    return new Date(`${datePart}T00:00:00+05:30`);
  }

  let [, hh, mm, ampm] = match;
  hh = parseInt(hh, 10);
  mm = parseInt(mm, 10);
  ampm = ampm.toLowerCase();

  if (ampm === "pm" && hh !== 12) hh += 12;
  if (ampm === "am" && hh === 12) hh = 0;

  const hhStr = String(hh).padStart(2, "0");
  const mmStr = String(mm).padStart(2, "0");

  return new Date(`${datePart}T${hhStr}:${mmStr}:00+05:30`);
}

/**
 * News items ko process karta hai: HTML clean karta hai, Date+Time ko
 * combine karke ek real sortable timestamp banata hai, aur final object
 * schema (DomesticNews model) ke exact fields ke saath return karta hai.
 *
 * Note: GeneratedText ab yahan generate NAHI hota — wo on-demand,
 * frontend se trigger hone par alag se generateDomesticSummary() call
 * karke banaya jaata hai.
 *
 * @param {Array} arr - Raw API items ka array
 * @returns {Promise<Array>} Schema-matching processed items ka array
 */
async function Domestictheme(arr) {

  let newarr = await Promise.all(arr.map(async (v) => {
    let { ID, Date: newsDate, Time, Caption, Description, Details } = v;

    const combinedDate = combineDateAndTime(newsDate, Time);

    return {
      ID,
      Date: combinedDate, // Date + Time dono combined — ab sahi sorting hogi
      Time,
      Caption,
      Description,
      Details,          // original HTML raw store hota hai (frontend rendering ke liye)
    };
  }));

  return newarr;
}

module.exports = Domestictheme;