// ai.js
const PROVIDERS = [
  { name: "groq",       url: "https://api.groq.com/openai/v1/chat/completions",
    key: process.env.GROQ_KEY,       model: process.env.GROQ_MODEL },        // jaise openai/gpt-oss-120b
  { name: "gemini",     url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: process.env.GEMINI_KEY,     model: process.env.GEMINI_MODEL },      // AI Studio se exact ID copy karo
  { name: "mistral",    url: "https://api.mistral.ai/v1/chat/completions",
    key: process.env.MISTRAL_KEY,    model: process.env.MISTRAL_MODEL },
  { name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_KEY, model: process.env.OPENROUTER_MODEL }, // koi :free model
].filter((p) => p.key && p.model);

async function callProvider(p, messages) {
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ model: p.model, messages, temperature: 0.3 }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const err = new Error(`${p.name} ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim();
}

// 429/5xx/timeout par agle provider par jao
export async function generateWithFallback(messages) {
  let lastErr;
  for (const p of PROVIDERS) {
    try {
      const text = await callProvider(p, messages);
      if (text) return text;
    } catch (e) {
      lastErr = e;
      console.log("AI provider failed:", e.message);
    }
  }
  throw lastErr || new Error("All AI providers failed");
}