import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer-core";

puppeteer.use(StealthPlugin());

let browser: Browser | null = null;

const CHROME_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--disable-translate",
  "--no-first-run",
  "--window-size=1280,800",
];

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      findChromePath(),
    args: CHROME_ARGS,
  }) as unknown as Browser;

  browser.on("disconnected", () => {
    browser = null;
    console.log("Browser disconnected, will relaunch on next scrape");
  });

  console.log("Browser launched");
  return browser;
}

// The parsers only read text and class names, so images, styling and fonts are
// pure overhead. Blocking them cuts most of the bytes and memory per scrape.
// Scripts stay enabled so Cloudflare challenges can still resolve.
const BLOCKED_RESOURCES = new Set(["image", "media", "font", "stylesheet"]);

export async function createPage(): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (BLOCKED_RESOURCES.has(req.resourceType())) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });

  return page;
}

export async function shutdown(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log("Browser closed");
  }
}

function findChromePath(): string {
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/chromium";
}
