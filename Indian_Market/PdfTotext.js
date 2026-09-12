const axios = require("axios");
const { PDFParse } = require("pdf-parse");


function extractImportantText(fullText) {
  const startMatch = fullText.match(/(sub:|subject)/i);
  const endMatch = fullText.match(/(thanking you|thank you)/i);

  const startIndex = startMatch ? startMatch.index : -1;
  const endIndex = endMatch ? endMatch.index : -1;

  if (startIndex === -1) return fullText;

  return fullText.slice(
    startIndex,
    endIndex !== -1 ? endIndex : undefined
  );
}


async function ExtractTotext(url) {
  // console.log(url)
  try {
    // console.log("extract function running");

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Referer: "https://www.nseindia.com/",
        Accept: "application/pdf",
      },
      timeout: 15000,
    });
// console.log("pdf",response.data)
//     console.log("after axios");

 let parser=new PDFParse({data:response.data})
     const data = await parser.getText(); 

//     console.log("text extracted");
// console.log(data.text)
let finaltext=await extractImportantText(data.text)

    return finaltext;
  } catch (e) {
    console.log("error occured in pdf convert into text", e.message);
    return "";
  }
}

module.exports=ExtractTotext