const axios = require("axios");
const cheerio = require("cheerio");
const { get } = require("../Route/routes");

// Time string ko minutes me convert karne ka helper function
function parseTimeToMinutes(timeStr) {
  timeStr = timeStr.toLowerCase().trim();
  
  if (timeStr.includes("min ago")) {
    return parseInt(timeStr);
  } else if (timeStr.includes("hr") || timeStr.includes("hour")) {
    const hours = parseInt(timeStr);
    // Agar hours ke sath minutes bhi hain (e.g., "2 hr 5 min ago")
    const minMatch = timeStr.match(/(\d+)\s*min/);
    const minutes = minMatch ? parseInt(minMatch[1]) : 0;
    return (hours * 60) + minutes;
  }
  
  // Agar time format 'yesterday' ya alag ho toh bada number return karein taaki filter ho jaye
  return 9999; 
}

async function getForexFactoryNews() {
  try {
    const { data } = await axios.get("https://www.forexfactory.com/news", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36"
      }
    });

    const $ = cheerio.load(data);
    const news = [];
    const THREE_HOURS_IN_MINUTES = 3 * 60; // 180 minutes

    // image_49bae1.jpg ke mutabiq sahi selector use kar rahe hain
    $(".news-block__item").each((i, el) => {
      const titleElement = $(el).find(".news-block__title a");
      const title = titleElement.attr("title") || titleElement.text().trim();
      const link = "https://www.forexfactory.com/" + titleElement.attr("href");
      
      // Details section me se time text nikalna
      const timeText = $(el).find(".news-block__details").text().trim(); 
      // Expected timeText sample: "from fxstreet.com | 40 min ago" ya "2 hr 5 min ago"
      
      // Sirf actual time nikalne ke liye clean-up (pipe symbol ke baad ka hissa)
      let timeCleaned = timeText;
      if (timeText.includes("|")) {
        timeCleaned = timeText.split("|")[1].trim();
      }

      const summary = $(el).find(".news-block__preview").text().trim();

      // Agar title aur time dono mil rahe hain tabhi process karein
      if (title && timeCleaned) {
        const minutesAgo = parseTimeToMinutes(timeCleaned);

        // Sirf wahi news add karein jo 180 minutes (3 hours) se kam purani ho
        if (minutesAgo <= THREE_HOURS_IN_MINUTES) {
          news.push({
            title,
            time: timeCleaned,
            summary,
            link
          });
        }
      }
    });

    return news;
  } catch (error) {
    console.error("Scraping me error aaya:", error.message);
    return [];
  }
}

// getForexFactoryNews().then((data) => {
//   console.log(`--- Last 3 Hours Ki News (Total: ${data.length}) ---`);
//   console.log(data);
// });


async function Cleanedforexfactorydata(){
let arr =await getForexFactoryNews()
let final = arr.map((v,i)=>{
  let {title,summary}=v
return { title,summary}
})
console.log(final)
return  final;
}

Cleanedforexfactorydata()



// module.exports=Cleanedforexfactorydata