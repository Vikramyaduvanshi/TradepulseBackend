const { OpenAI } = require("openai");

const client = new OpenAI({
  apiKey: process.env.groq_api_key2,
  baseURL: "https://api.groq.com/openai/v1",
});

async function companyAgent(content) {
  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",

    messages: [
      {
        role: "system",
        content: `
You are an Indian stock market company identification agent.

Your job is to identify the NSE stock symbol from the company mentioned
in the user's content.

Rules:
1. Identify the company name.
2. Return its NSE symbol.
3. If multiple companies are mentioned, return all relevant NSE symbols.
4. Do not return BSE codes.
5. Do not explain anything.
6. Return only valid NSE symbols.
7. If you cannot confidently identify the company, return "UNKNOWN".

Examples:

User: Analyse Tata Motors
Output: TATAMOTORS

User: Give me NSE code of Reliance Industries
Output: RELIANCE

User: Analyse Infosys
Output: INFY

User: What is the NSE symbol of HDFC Bank?
Output: HDFCBANK
        `,
      },
      {
        role: "user",
        content: content,
      },
    ],
    temperature: 0,
  });

  return response.choices[0].message.content.trim();
}

module.exports=companyAgent