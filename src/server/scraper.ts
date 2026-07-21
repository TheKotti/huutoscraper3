import type { Page } from "puppeteer-core";
import type { ScrapeResult, SiteParser } from "./types.js";
import { createPage } from "./browser.js";
import { withTimeout } from "./timeout.js";
import { huutoParser } from "./parsers/huuto.js";
import { toriParser } from "./parsers/tori.js";

const parsers: SiteParser[] = [huutoParser, toriParser];

// goto and waitForSelector carry their own timeouts, but page.evaluate does not.
// This bounds a whole target so one wedged page can't starve the others.
export const URL_BUDGET_MS = 90_000;
export const PAGE_SETUP_BUDGET_MS = 30_000;
const PAGE_CLOSE_BUDGET_MS = 10_000;

function getParser(url: string): SiteParser | undefined {
  return parsers.find((p) => p.matches(url));
}

export async function scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  let page: Page | null = null;

  try {
    page = await withTimeout(createPage(), PAGE_SETUP_BUDGET_MS, "createPage");

    for (const url of urls) {
      const parser = getParser(url);
      if (!parser) {
        results.push({ sourceUrl: url, listings: [], error: "No parser for this URL" });
        continue;
      }

      const target = page;
      try {
        // No settle delay here on purpose: every parser waits for its own
        // listing selector, so a fixed sleep only buys the page more time to
        // run scripts we don't need.
        const listings = await withTimeout(
          (async () => {
            await target.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
            return parser.parse(target);
          })(),
          URL_BUDGET_MS,
          `scrape ${url}`,
        );
        console.log(`[scrape] ${url} => ${listings.length} listings`);
        results.push({ sourceUrl: url, listings });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scrape] ${url} => error: ${message}`);
        results.push({ sourceUrl: url, listings: [], error: message });
      }
    }
  } finally {
    if (page) {
      // A wedged renderer can hang close() as readily as evaluate()
      await withTimeout(page.close(), PAGE_CLOSE_BUDGET_MS, "page.close").catch(
        () => {},
      );
    }
  }

  return results;
}
