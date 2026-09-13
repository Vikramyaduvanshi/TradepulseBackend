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
  const isProduction = process.env.NODE_ENV === "production";

  let puppeteer = puppeteerCore;

  if (useStealth) {
    const { addExtra } = require("puppeteer-extra");
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    puppeteer = addExtra(puppeteerCore);
    puppeteer.use(StealthPlugin());
  }

  if (isProduction) {
    const chromium = require("@sparticuz/chromium");
    const executablePath = await getChromiumExecutablePath(chromium);

    return puppeteer.launch({
      args: [...chromium.args, ...extraArgs],
      executablePath,
      headless: chromium.headless,
    });
  } else {
    return puppeteer.launch({
      headless: true,
      executablePath: findLocalChrome(),
      args: extraArgs,
    });
  }
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

module.exports = launchBrowser;