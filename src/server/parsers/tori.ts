import type { Page } from "puppeteer-core";
import type { SiteParser, Listing } from "../types.js";

const MAX_AGE_MS = 6 * 3_600_000;

function parseRelativeTime(text: string): string | null {
  const now = Date.now();
  const t = text.trim().toLowerCase();

  if (t === "nyt" || t === "") return new Date(now).toISOString();

  const minMatch = t.match(/^(\d+)\s*min/);
  if (minMatch) return new Date(now - parseInt(minMatch[1]) * 60_000).toISOString();

  const hourMatch = t.match(/^(\d+)\s*t$/);
  if (hourMatch) {
    const ms = parseInt(hourMatch[1]) * 3_600_000;
    if (ms > MAX_AGE_MS) return null;
    return new Date(now - ms).toISOString();
  }

  // Anything older (days, dates) is filtered out
  return null;
}

export const toriParser: SiteParser = {
  matches(url: string) {
    return url.includes("tori.fi");
  },

  async parse(page: Page): Promise<Listing[]> {
    try {
      await page.waitForSelector("article.sf-search-ad", { timeout: 10000 });
    } catch {
      return [];
    }

    const raw = await page.evaluate(() => {
      const articles = document.querySelectorAll<HTMLElement>("article.sf-search-ad");
      return Array.from(articles).map((card) => {
        const linkEl = card.querySelector<HTMLAnchorElement>("a.sf-search-ad-link");
        const titleEl = card.querySelector("h2");
        const priceEl = card.querySelector(".font-bold span");
        const timeEl = card.querySelector(".s-text-subtle span:last-child");

        return {
          url: linkEl?.href ?? "",
          title: titleEl?.textContent?.trim() ?? "",
          price: priceEl?.textContent?.trim().replace(/ /g, " ") ?? "",
          rawTime: timeEl?.textContent?.trim() ?? "",
        };
      }).filter((item) => item.url && item.title);
    });

    return raw
      .map((item) => {
        const listingTime = parseRelativeTime(item.rawTime);
        if (!listingTime) return null;
        return { url: item.url, title: item.title, price: item.price, listingTime };
      })
      .filter((item): item is Listing => item !== null);
  },
};
