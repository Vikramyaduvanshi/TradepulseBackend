const axios = require("axios");
const cheerio = require("cheerio");
const { Calender } = require("../modal/modal");

// Week start date (Sunday) calculate karne ke liye helper function
function getForexFactoryWeekString() {
  const now = new Date();
  
  // IST Time Zone Conversion
  const istDateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  }).format(now);

  const istDate = new Date(istDateStr);
  
  // Sunday ka date nikalein (Week Start)
  const dayOfWeek = istDate.getDay(); 
  const sunday = new Date(istDate);
  sunday.setDate(istDate.getDate() - dayOfWeek);

  const month = sunday.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const day = sunday.getDate();


  // Return format: "sep13.2026"
  return `${month}${day}`;
}

async function getForexFactoryCalendar(weekStr) {
  try {
    const result = await fetch(`https://calenderforexfatory.onrender.com/weak_calender?weak=${weekStr}`);
    if (!result.ok) {
      console.error(`API responded with status ${result.status}`);
      return [];
    }
    const res1 = await result.json();
    if (!Array.isArray(res1.data)) {
      console.error("Unexpected response shape:", res1);
      return [];
    }
    return res1.data;
  } catch (err) {
    console.error("Scraping error:", err.message);
    return [];
  }
}

function getIndiaDateTimeFormatted() {
  const now = new Date();
  const dateOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  };

  // e.g., "Thu, Sep 17" -> "Thu Sep 17"
  let formattedDate = new Intl.DateTimeFormat('en-US', dateOptions)
    .format(now)
    .replace(',', '');

  return formattedDate;
}

async function CalenderHandleWithUpsert() {
  try {
    const weekStr = getForexFactoryWeekString(); // Generates "sep13.2026"
    const todayDateStr = getIndiaDateTimeFormatted(); // Generates "Thu Sep 17"
console.log(weekStr, "week str")
   const calendars = await getForexFactoryCalendar(weekStr);
console.log(calendars)

    if (!calendars || calendars.length === 0) {
      console.log("No calendar events scraped.");
      return [];
    }

    // MongoDB Bulk Upsert
    const operations = calendars.map(item => ({
      updateOne: {
        filter: { 
          date: item.date, 
          time: item.time, 
          event: item.event, 
          currency: item.currency 
        },
        update: { $set: item },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      await Calender.bulkWrite(operations);
      console.log(`Successfully synced ${operations.length} events to MongoDB.`);
    }

    // Filter today's events
    const todayCalendar = calendars.filter(v => v.date === todayDateStr);
console.log(todayCalendar)
    console.log(`Today's Events (${todayDateStr}):`, todayCalendar.length);
    return todayCalendar;

  } catch (error) {
    console.error("Sync error:", error.message);
    return [];
  }
}
// CalenderHandleWithUpsert()

module.exports = CalenderHandleWithUpsert();