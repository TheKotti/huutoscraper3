import type { Page } from "puppeteer-core";
import type { ScrapeResult, SiteParser } from "./types.js";
import { createPage } from "./browser.js";
import { huutoParser } from "./parsers/huuto.js";
import { toriParser } from "./parsers/tori.js";

const parsers: SiteParser[] = [huutoParser, toriParser];

function getParser(url: string): SiteParser | undefined {
  return parsers.find((p) => p.matches(url));
}

export async function scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  let page: Page | null = null;

  try {
    page = await createPage();

    for (const url of urls) {
      const parser = getParser(url);
      if (!parser) {
        results.push({ sourceUrl: url, listings: [], error: "No parser for this URL" });
        continue;
      }

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise((r) => setTimeout(r, 3000));
        const listings = await parser.parse(page);
        console.log(`[scrape] ${url} => ${listings.length} listings`);
        results.push({ sourceUrl: url, listings });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scrape] ${url} => error: ${message}`);
        results.push({ sourceUrl: url, listings: [], error: message });
      }
    }
  } finally {
    await page?.close().catch(() => {});
  }

  return results;
}
