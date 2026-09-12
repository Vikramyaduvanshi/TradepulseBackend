const { DomesticNews } = require("../modal/modal");
const Domestic = require("./domestic");
const Domestictheme = require("./DomesticTheme");


async function runDomesticPipeline() {

  // 1️⃣ NSE se data lao
  let data = await Domestic();

  // 2️⃣ Loop karo
  for (let item of data) {

    let { sm_isin, sort_date } = item;

    // 🔥 unique check (isin + date)
    let exists = await DomesticNews.findOne({
      isin: sm_isin,
      announcementDate: new Date(sort_date)
    });

    if (exists) {
      // console.log("Already exists, skip:", sm_isin);
      continue;
    }

    // 3️⃣ AI process (Domestictheme ek item ke liye call)
    let processed = await Domestictheme([item]); // array pass karna hai
    let finalData = processed[0];

    // 4️⃣ Save in DB
    await DomesticNews.create(finalData);

    // console.log("Saved:", sm_isin);
  }
}

module.exports=runDomesticPipeline;