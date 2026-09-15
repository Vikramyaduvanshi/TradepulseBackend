const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.FOREX_NEWS_SUMMARY,
  baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Analyze a news item using a Groq-hosted LLM.
 *
 * Accepts TWO kinds of input:
 *  1. A successful scraped page object: { success: true, url, title, content, length }
 *  2. A plain fallback string/description — used when scraping fails and the
 *     caller only has a short description of the news (no full article text).
 *
 * @param {Object|string} input - Scraped res object OR a plain description string.
 * @param {string} language - Output language for the analysis (e.g. "English", "Hindi", "Hinglish").
 * @returns {Promise<Object>} Parsed JSON analysis object.
 */
async function modelFunction(input, language = "English") {
  let url = "unknown";
  let title = "";
  let content = "";
  let sourceType = "full_article"; // "full_article" | "description_only"

  if (typeof input === "string") {
    // Fallback path: only a short description is available (scraping failed)
    if (!input.trim()) {
      throw new Error("Empty description passed to modelFunction");
    }
    content = input.trim();
    sourceType = "description_only";
  } else if (input && typeof input === "object") {
    // Full scrape path
    if (!input.content || !input.content.trim()) {
      throw new Error("Scraped object passed to modelFunction has no content");
    }
    url = input.url || "unknown";
    title = input.title || "";
    content = input.content;
    sourceType = "full_article";
  } else {
    throw new Error("Invalid input passed to modelFunction");
  }

  const systemPrompt = `
You are an Elite News Intelligence Analyst working for a media research desk.

Your job is to analyze a single news item using ONLY the data provided by the user.

You are NOT allowed to use outside knowledge, assumptions, or anything not present in the given title/content/url.
If something cannot be determined from the given text, mark it as "insufficient_data" — never invent it.

IMPORTANT — the input can be one of two kinds, indicated by "SOURCE_TYPE" in the user message:
- "full_article": complete scraped article text is available. Analyze in full depth.
- "description_only": only a short description/snippet is available (full article could not be scraped).
  In this case, work only with what's given, keep "key_points" and "key_quotes" limited to what's actually
  stated, and set any field you cannot support to "insufficient_data" rather than guessing or padding.
  Do NOT pretend this is a full article.

====================================================
STRICT RULES
====================================================
1. Base every claim ONLY on the provided title/content.
2. Do not fabricate names, numbers, quotes, or events not present in the text.
3. Strip out unrelated boilerplate (ads, "You Might Like", "Sponsored Links", Taboola/Outbrain junk, unrelated headline teasers) before analyzing — do not treat these as article content.
4. Quotes you extract must be copied exactly as they appear in the content, and attributed to the correct speaker.
5. Write ALL narrative/text fields (summary, key_points, bias_notes, institutional_summary, etc.) in this language: "${language}". Keep proper nouns, tickers, and quoted speech as-is.
6. Return ONLY valid JSON. No markdown, no code fences, no commentary outside the JSON object.

====================================================
OUTPUT JSON SCHEMA
====================================================
{
  "url": "",
  "source_type": "full_article | description_only",
  "headline": "",
  "published_context": "",
  "category": "",
  "summary": "",
  "key_points": [],
  "entities": {
    "people": [],
    "organizations": [],
    "locations": []
  },
  "key_quotes": [
    { "speaker": "", "quote": "" }
  ],
  "sentiment": {
    "overall": "Positive | Negative | Neutral | Mixed",
    "reasoning": ""
  },
  "political_lean_signals": {
    "detected": true,
    "notes": ""
  },
  "credibility_flags": {
    "opinion_vs_fact": "",
    "unverified_claims": [],
    "notes": ""
  },
  "relevance_tags": [],
  "institutional_summary": ""
}

====================================================
FIELD GUIDANCE
====================================================
- "category": one concise label, e.g. Politics, Economy, Markets, Sports, Technology.
- "key_points": 3-6 bullet-style factual points, no fluff, no ad content.
- "entities": only names/orgs/places explicitly mentioned in the content.
- "key_quotes": only direct quotes present verbatim in the content; max 3, max 30 words each.
- "sentiment": sentiment of the article's framing/tone, not your opinion.
- "political_lean_signals": only flag lean if the wording/framing in the text itself signals it; otherwise set detected: false and notes: "insufficient_data".
- "credibility_flags.unverified_claims": claims stated as fact in the article that lack cited evidence within the text itself (e.g. no source named for a figure).
- "institutional_summary": 2-3 sentence high-level takeaway for a research desk, in "${language}".
- "source_type": echo back exactly the SOURCE_TYPE given in the user message ("full_article" or "description_only").

Return ONLY the JSON object matching this schema exactly. No missing fields.
`.trim();

  const userPrompt = `
SOURCE_TYPE: ${sourceType}
ARTICLE URL: ${url}
ARTICLE TITLE: ${title || "(not provided)"}

${sourceType === "full_article" ? "ARTICLE CONTENT" : "DESCRIPTION"}:
"""
${content}
"""
`.trim();

  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      // Fallback: strip accidental code fences and retry once
      const cleaned = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    return parsed;
  } catch (error) {
    console.error("News Analysis AI Error:", error.message);
    throw error;
  }
}

module.exports = modelFunction;