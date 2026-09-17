const { DomesticNews } = require("../modal/modal");
const Domestic = require("./domestic");
const Domestictheme = require("./DomesticTheme");
const fetchallnews = require("./Fetchallnews");


// async function runDomesticPipeline() {

//   // 1️⃣ NSE se data lao
//   // let data = await Domestic();  // old 
//   let data = await fetchallnews();  // old 

//   // 2️⃣ Loop karo
//   for (let item of data) {

//     let { sm_isin, sort_date } = item;

//     // 🔥 unique check (isin + date)
//     let exists = await DomesticNews.findOne({
//       isin: sm_isin,
//       announcementDate: new Date(sort_date)
//     });

//     if (exists) {
//       // console.log("Already exists, skip:", sm_isin);
//       continue;
//     }

//     // 3️⃣ AI process (Domestictheme ek item ke liye call)
//     let processed = await Domestictheme([item]); // array pass karna hai
//     let finalData = processed[0];

//     // 4️⃣ Save in DB
//     await DomesticNews.create(finalData);

//     // console.log("Saved:", sm_isin);
//   }
// }

async function runDomesticPipeline() {

  // 1️⃣ API se data lao
  let data = await fetchallnews();

  // 2️⃣ Loop karo
  for (let item of data) {

    let { ID } = item;

    // 🔥 unique check — ab sirf ID hi unique identifier hai (naya schema)
    let exists = await DomesticNews.findOne({ ID });

    if (exists) {
      // console.log("Already exists, skip:", ID);
      continue;
    }

    // 3️⃣ AI process (Domestictheme ek item ke liye call)
    let processed = await Domestictheme([item]); // array pass karna hai
    let finalData = processed[0];

    // 4️⃣ Save in DB
    await DomesticNews.create(finalData);

    // console.log("Saved:", ID);
  }
}

module.exports=runDomesticPipeline;