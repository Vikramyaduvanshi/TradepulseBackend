let launchBrowser = require("./launchBrowser");
const cheerio = require("cheerio");

// Tags jinke andar text kabhi bhi "main content" nahi hota
const JUNK_SELECTORS =
  "script, style, noscript, nav, footer, header, aside, form, iframe, " +
  "svg, button, input, .ad, .ads, .advertisement, .cookie, .cookie-banner, " +
  "[class*='popup'], [class*='modal'], [class*='newsletter'], [id*='cookie']";

// Patterns jo batate hain ki page abhi bhi bot-check / challenge / block page hai,
// asli article content nahi. Isse hum "success: true" false-positive rokte hain.
const CHALLENGE_PATTERNS = [
  "just a moment",
  "performing security verification",
  "verification successful. waiting for",
  "checking your browser",
  "enable javascript and cookies to continue",
  "ddos protection by cloudflare",
  "cf-browser-verification",
  "attention required! | cloudflare",
  "please verify you are a human",
  "please stand by, while we are checking your browser",
  "access denied",
  "403 forbidden",
  "request unsuccessful",
  "unusual traffic from your computer network",
  "captcha",
];

function looksLikeChallengeOrBlock(title, content) {
  const haystack = `${title} ${content}`.toLowerCase();
  return CHALLENGE_PATTERNS.some((p) => haystack.includes(p));
}

/**
 * Kisi bhi element ke andar ka "clean text" nikalta hai
 * aur text density (text length / html length) ka score deta hai.
 * Jis block ka score sabse zyada hota hai, wahi usually main article/content hota hai.
 */
function scoreNode($, el) {
  const $el = $(el);
  const text = $el.text().replace(/\s+/g, " ").trim();
  const textLength = text.length;

  if (textLength < 200) return { score: 0, text: "" };

  const linkText = $el
    .find("a")
    .map((i, a) => $(a).text())
    .get()
    .join(" ").length;

  const linkDensity = linkText / textLength;

  // Paragraph count content ke real hone ka strong signal hai
  const pCount = $el.find("p").length;

  let score = textLength * (1 - linkDensity);
  score += pCount * 25; // har paragraph ka bonus

  // Bahut zyada links wale blocks (menus/lists) ko penalize karo
  if (linkDensity > 0.5) score *= 0.3;

  return { score, text };
}

/**
 * Kisi bhi page se main readable content nikalta hai.
 * Strategy:
 *  1. Pehle common article containers try karo (fast path)
 *  2. Nahi mile to poore DOM mein best-scoring block dhundo (generic fallback)
 */
function extractMainContent(html) {
  const $ = cheerio.load(html);
  $(JUNK_SELECTORS).remove();

  // 1) Fast path: common semantic/article selectors
  const commonSelectors = [
    "article",
    "[role='main']",
    "main",
    ".article-body",
    ".article-content",
    ".post-content",
    ".entry-content",
    "#content",
    ".story-body",
  ];

  let best = { score: 0, text: "" };

  for (const sel of commonSelectors) {
    $(sel).each((i, el) => {
      const result = scoreNode($, el);
      if (result.score > best.score) best = result;
    });
  }

  // 2) Fallback: scan every reasonably-sized div/section on the page
  if (best.score < 400) {
    $("div, section, article").each((i, el) => {
      const result = scoreNode($, el);
      if (result.score > best.score) best = result;
    });
  }

  // 3) Last resort: sab <p> tags jodo (purana behaviour, safety net)
  if (best.score < 200) {
    const paragraphs = [];
    $("p").each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 40) paragraphs.push(text);
    });
    return paragraphs.join("\n\n");
  }

  return best.text
    .split(/\n{2,}|(?<=[.!?])\s{2,}/)
    .map((t) => t.trim())
    .filter((t) => t.length > 30)
    .join("\n\n") || best.text;
}

/**
 * Generic scraper — kisi bhi URL se readable content nikalta hai.
 * @param {string} url
 * @param {object} options
 * @param {boolean} options.stealth - bot-detection wali sites ke liye true rakho
 * @param {number} options.timeout - ms me navigation timeout
 * @param {string} options.waitUntil - "networkidle2" | "domcontentloaded" | "load"
 * @param {number} options.retries - challenge fail hone par kitni baar reload+retry kare
 */
async function scrapePage(url, options = {}) {
  const {
    stealth = true,
    timeout = 60000,
    waitUntil = "networkidle2",
    retries = 1,
  } = options;

  let browser;

  try {
    browser = await launchBrowser([], stealth);
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 900 });

    await page.goto(url, { waitUntil, timeout });

    let title = "";
    let html = "";
    let content = "";
    let attempt = 0;

    // Retry loop: agar challenge resolve nahi hota ya content abhi bhi
    // challenge/block page jaisa lagta hai, to reload karke dobara try karo.
    while (attempt <= retries) {
      const resolved = await waitForCloudflareChallenge(page);

      // Challenge resolve hone ke baad bhi page settle hone ka thoda time do
      if (resolved) {
        await new Promise((r) => setTimeout(r, 1200));
      }

      // Lazy-load content trigger karne ke liye scroll
      await autoScroll(page);

      title = await page.title().catch(() => "");
      html = await page.content();
      content = extractMainContent(html);

      const stillBlocked = looksLikeChallengeOrBlock(title, content);

      // Content bahut chhota hai (challenge page jaisa) ya block pattern match hua
      if (!stillBlocked && content && content.length > 150) {
        break; // Real content mil gaya
      }

      attempt++;

      if (attempt <= retries) {
        console.log(
          `Challenge/block page detected (attempt ${attempt}/${retries}), reloading...`
        );
        await page
          .reload({ waitUntil, timeout })
          .catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Final verdict: agar ab bhi challenge/block page jaisa content hai,
    // ya content ka size bahut chhota hai, to ise FAIL treat karo.
    if (looksLikeChallengeOrBlock(title, content) || !content || content.length < 150) {
      return {
        success: false,
        url,
        error:
          "Blocked by bot-check / verification page did not resolve (Cloudflare or similar).",
        title,
        rawLength: content ? content.length : 0,
      };
    }

    return {
      success: true,
      url,
      title,
      content,
      length: content.length,
    };
  } catch (err) {
    console.log("scrapePage Error:", err.message);
    return { success: false, url, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

// Cloudflare/other bot-check challenge page ko detect kar ke resolve hone tak wait karta hai.
// Returns true agar challenge detect hua tha aur resolve ho gaya, false agar challenge tha hi nahi.
async function waitForCloudflareChallenge(page, maxWaitMs = 20000) {
  try {
    const isChallenge = await page.evaluate(() => {
      const title = document.title || "";
      const body = document.body ? document.body.innerText : "";
      const t = title.toLowerCase();
      const b = body.toLowerCase();
      return (
        t.includes("just a moment") ||
        t.includes("attention required") ||
        b.includes("performing security verification") ||
        b.includes("checking your browser") ||
        b.includes("verification successful. waiting for") ||
        b.includes("enable javascript and cookies") ||
        !!document.querySelector(
          "#challenge-running, .cf-browser-verification, #cf-challenge-running"
        )
      );
    });

    if (!isChallenge) return false;

    console.log("Bot-check challenge mila, resolve hone ka wait kar rahe hain...");

    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 1500));

      const stillChallenge = await page
        .evaluate(() => {
          const title = document.title || "";
          const body = document.body ? document.body.innerText : "";
          const t = title.toLowerCase();
          const b = body.toLowerCase();
          return (
            t.includes("just a moment") ||
            b.includes("performing security verification") ||
            b.includes("checking your browser") ||
            b.includes("verification successful. waiting for") ||
            !!document.querySelector(
              "#challenge-running, .cf-browser-verification, #cf-challenge-running"
            )
          );
        })
        .catch(() => true); // agar evaluate fail ho (navigating), abhi bhi "challenge chal rha hai" maan lo

      if (!stillChallenge) {
        // Challenge resolve ho gaya, page ko settle hone ka thoda aur time do
        await new Promise((r) => setTimeout(r, 1000));
        return true;
      }
    }

    // Timeout ho gaya, challenge resolve nahi hua
    return true;
  } catch (e) {
    // Agar evaluate fail ho (navigation ho rahi ho) to bas aage badh jao
    return false;
  }
}

// Lazy-loaded content trigger karne ke liye halka sa auto-scroll
async function autoScroll(page) {
  await page
    .evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight || totalHeight > 6000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    })
    .catch(() => {}); // agar page navigate ho jaye to ignore karo
}

module.exports = { scrapePage, extractMainContent };