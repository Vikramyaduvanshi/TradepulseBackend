const axios = require("axios");
const cheerio = require("cheerio");
const { Calender } = require("../modal/modal");

async function getForexFactoryCalendar(str) {
  try {
    const { data } = await axios.get(
      `https://www.forexfactory.com/calendar?week=${str}.2026`,
      { 
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const $ = cheerio.load(data);

    const events = [];

    let currentDate = "";

    $("tr.calendar__row").each((i, row) => {
      // Date column sometimes only appears on first row of day
      const dateText = $(row)
        .find(".calendar__date")
        .text()
        .trim();

      if (dateText) {
        currentDate = dateText;
      }

      const time = $(row)
        .find(".calendar__time")
        .text()
        .trim();

      const currency = $(row)
        .find(".calendar__currency")
        .text()
        .trim();

      const event = $(row)
        .find(".calendar__event")
        .text()
        .trim();

      const actual = $(row)
        .find(".calendar__actual")
        .text()
        .trim();

      const forecast = $(row)
        .find(".calendar__forecast")
        .text()
        .trim();

      const previous = $(row)
        .find(".calendar__previous")
        .text()
        .trim();

      // Impact Detection
      const impactHtml =
        $(row).find(".calendar__impact").html() || "";

      let impact = "Low";

      if (
        impactHtml.includes("icon--ff-impact-red") ||
        impactHtml.includes("high")
      ) {
        impact = "High";
      } else if (
        impactHtml.includes("icon--ff-impact-ora") ||
        impactHtml.includes("medium")
      ) {
        impact = "Medium";
      } else if (
        impactHtml.includes("icon--ff-impact-yel") ||
        impactHtml.includes("low")
      ) {
        impact = "Low";
      }

      if (currency) {
        events.push({
          date: currentDate,
          time,
          currency,
          impact,
          event,
          actual: actual || null,
          forecast: forecast || null,
          previous: previous || null,
        });
      }
    });

    return events;
  } catch (err) {
    console.error("Error:", err.message);
    return [];
  }
}



function getIndiaDateTimeFormatted() {
  const now = new Date();

  // 1. Date Format: 'Sat May 30' (India ke According)
  const dateOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    timeZone: 'Asia/Kolkata' // Yeh ensure karega ki date India ki ho
  };
  
  let formattedDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
  formattedDate = formattedDate.replace(',', ''); // Comma hatane ke liye

  // 2. Time Format: '12:13pm' (India ke According)
  const timeOptions = { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'Asia/Kolkata' // Yeh ensure karega ki time India ka ho
  };
  
  let formattedTime = new Intl.DateTimeFormat('en-US', timeOptions).format(now);
  formattedTime = formattedTime.replace(/\s+/g, '').toLowerCase(); // Spaces hatakar lowercase karein

  return {
    date: formattedDate,
    time: formattedTime
  };
}



async function CalenderHandleWithUpsert() {
  try {
    let current_time= getIndiaDateTimeFormatted()
    let str= current_time.date.split(" ").slice(1).join("").toLocaleLowerCase()
  
    let calendars = await getForexFactoryCalendar(str);
    let today_calender=[]
    // Har ek event ko check karein, agar date, time aur event same hai toh update karein, 
    // nahi toh naya banayein
    const operations = calendars.map(item => ({
      updateOne: {
        filter: { date: item.date, time: item.time, event: item.event ,currency:item.currency},
        update: { $set: item },
        upsert: true // Agar nahi mila toh naya insert karein
      }
    }));

    await Calender.bulkWrite(operations);

today_calender= calendars.filter((v)=>{
if(v.date==current_time.date) return v

})

    // console.log(operations);
    // console.log(today_calender);


return today_calender

  } catch (error) {
    console.error("Sync error:", error.message);
  }
}

// CalenderHandleWithUpsert()
module.exports = CalenderHandleWithUpsert