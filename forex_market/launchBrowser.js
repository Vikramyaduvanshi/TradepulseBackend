const dotenv = require("dotenv");
dotenv.config();
const puppeteerCore = require("puppeteer-core");
const fs = require("fs");
const os = require("os");

let chromiumExecutablePathPromise = null;

async function getChromiumExecutablePath(chromium) {
  if (!chromiumExecutablePathPromise) {
    chromiumExecutablePathPromise = chromium.executablePath();
  }
  return chromiumExecutablePathPromise;
}

async function launchBrowser(extraArgs = [], useStealth = true) {
  const isProduction = process.env.NODE_ENV === "production";
  let puppeteer = puppeteerCore;

  if (useStealth) {
    const { addExtra } = require("puppeteer-extra");
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    puppeteer = addExtra(puppeteerCore);
    puppeteer.use(StealthPlugin());
  }

  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ];

  if (isProduction) {
    const chromium = require("@sparticuz/chromium");
    const executablePath = await getChromiumExecutablePath(chromium);

    return puppeteer.launch({
      args: [...chromium.args, ...defaultArgs, ...extraArgs],
      executablePath,
      headless: chromium.headless,
    });
  } else {
    return puppeteer.launch({
      headless: true,
      executablePath: findLocalChrome(),
      args: [...defaultArgs, ...extraArgs],
    });
  }
}

function findLocalChrome() {
  const platform = os.platform();

  const pathsByPlatform = {
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ],
  };

  const possiblePaths = pathsByPlatform[platform] || [];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    `Local Chrome not found for platform "${platform}". Install Chrome or set CHROME_PATH env variable.`
  );
}

module.exports = launchBrowser;