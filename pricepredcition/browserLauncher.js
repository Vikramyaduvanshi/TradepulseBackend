const puppeteerCore = require("puppeteer-core");
const fs = require("fs");

let chromiumExecutablePathPromise = null; // cache

async function getChromiumExecutablePath(chromium) {
  if (!chromiumExecutablePathPromise) {
    chromiumExecutablePathPromise = chromium.executablePath();
  }
  return chromiumExecutablePathPromise;
}

async function launchBrowser(extraArgs = [], useStealth = false) {
  // @sparticuz/chromium sirf Linux (Render) par chalta hai.
  // Windows PC par production me bhi local Chrome use hoga.
  const useSparticuz =
    process.env.NODE_ENV === "production" &&
    process.platform === "linux" &&
    !process.env.USE_LOCAL_CHROME;

  let puppeteer = puppeteerCore;

  if (useStealth) {
    const { addExtra } = require("puppeteer-extra");
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    puppeteer = addExtra(puppeteerCore);
    puppeteer.use(StealthPlugin());
  }

  if (useSparticuz) {
    const chromium = require("@sparticuz/chromium");
    const executablePath = await getChromiumExecutablePath(chromium);

    return puppeteer.launch({
      args: [...chromium.args, ...extraArgs],
      executablePath,
      headless: chromium.headless,
    });
  }

  return puppeteer.launch({
    headless: true,
    executablePath: findLocalChrome(),
    args: extraArgs,
  });
}

function findLocalChrome() {
  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    "Local Chrome not found. Please install Google Chrome or update the path in browserLauncher.js"
  );
}

// ==========================================
// NEW: shared browser + page limiter
// ==========================================
const DEFAULT_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];
const shared = new Map(); // "plain" / "stealth" -> Promise<Browser>

function getSharedBrowser(useStealth = false, extraArgs = DEFAULT_ARGS) {
  const key = useStealth ? "stealth" : "plain";
  if (!shared.has(key)) {
    const p = launchBrowser(extraArgs, useStealth)
      .then((b) => {
        b.on("disconnected", () => shared.delete(key)); // crash hua to agli baar naya khulega
        return b;
      })
      .catch((e) => {
        shared.delete(key);
        throw e;
      });
    shared.set(key, p);
  }
  return shared.get(key);
}

// Ek time par kitne pages: Render (kam RAM) par 1, PC par 3
const MAX_PAGES = process.platform === "linux" && process.env.NODE_ENV === "production" ? 1 : 3;
let active = 0;
const queue = [];

function runNext() {
  if (active >= MAX_PAGES || !queue.length) return;
  active++;
  const { job, resolve, reject } = queue.shift();
  job()
    .then(resolve, reject)
    .finally(() => {
      active--;
      runNext();
    });
}

function limited(job) {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject });
    runNext();
  });
}

// fn(page) chalata hai; page apne aap band hota hai; timeout par page zabardasti band
async function withPage(fn, { stealth = false, timeoutMs = 40000, extraArgs } = {}) {
  return limited(async () => {
    const browser = await getSharedBrowser(stealth, extraArgs);
    const page = await browser.newPage();
    const timer = setTimeout(() => page.close().catch(() => {}), timeoutMs);
    try {
      return await fn(page);
    } finally {
      clearTimeout(timer);
      await page.close().catch(() => {});
    }
  });
}

async function closeAllBrowsers() {
  for (const p of shared.values()) {
    try { (await p).close(); } catch {}
  }
  shared.clear();
}
process.on("SIGTERM", closeAllBrowsers);
process.on("SIGINT", closeAllBrowsers);

module.exports = launchBrowser;                 // purana use waise hi chalega
module.exports.withPage = withPage;
module.exports.getSharedBrowser = getSharedBrowser;