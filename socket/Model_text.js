const { OpenAI } = require("openai");

const client = new OpenAI({
  apiKey: process.env.groq_api_key2 ,
  baseURL: "https://api.groq.com/openai/v1",
});

async function companyAgent(content) {
  // STEP 1: यूज़र के मैसेज से सटीक Google/Web Search क्वेरी जनरेट करें
  const queryResponse = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: `
You generate clean search queries to find the NSE stock symbol of an Indian company.
Rules:
1. Extract the company name from user input.
2. Output ONLY the search query in format: "<company name> nse share price"
3. No quotes, no explanation, no extra text.

Example:
User: rec ltd ka analysis karo
Output: rec ltd nse share price
        `,
      },
      {
        role: "user",
        content: content,
      },
    ],
    temperature: 0,
  });

  const searchQuery = queryResponse.choices[0].message.content.trim();

  // STEP 2: जनरेट की गई क्वेरी से आपकी Render API कॉल करें
  const apiUrl = `https://calenderforexfatory.onrender.com/nse_code?day=${encodeURIComponent(searchQuery)}`;
  const res = await fetch(apiUrl);
  const apiData = await res.json();
  const searchResults = apiData.data.slice(0,100) || "";

  // STEP 3: API के सर्च रिज़ल्ट से सटीक NSE Symbol निकालें
  const symbolResponse = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: `
You are an Indian stock market company identification agent.
Identify the exact NSE stock symbol from the user's request and the provided web search results.

Rules:
1. Look for patterns like "(NSE:SYMBOL)" or "/quote/nse/SYMBOL/" in the search results.
2. Return ONLY valid NSE symbols (e.g., RECLTD, TATAMOTORS, RELIANCE).
3. If multiple companies are mentioned, separate symbols with a comma.
4. Do not return BSE codes.
5. Do not explain anything.
6. If you cannot confidently identify the symbol, return "UNKNOWN".
        `,
      },
      {
        role: "user",
        content: `User Request: ${content}\n\nSearch Results:\n${searchResults}`,
      },
    ],
    temperature: 0,
  });

  return symbolResponse.choices[0].message.content.trim();
}




// async function main() {
//   let res= await companyAgent("rec ltd company ka analyse kro")
//   console.log(res)
// }


// main()
module.exports=companyAgent