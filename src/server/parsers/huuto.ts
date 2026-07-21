import type { Page } from "puppeteer-core";
import type { SiteParser, Listing } from "../types.js";

export const huutoParser: SiteParser = {
  matches(url: string) {
    return url.includes("huuto.net");
  },

  async parse(page: Page): Promise<Listing[]> {
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>(".cky-btn-accept");
      btn?.click();
    });

    try {
      await page.waitForSelector("a[href*='/kohteet/']", { timeout: 15000 });
    } catch (err) {
      // A selector timeout is indistinguishable from "genuinely zero results"
      // without inspecting the page, but a search that always has matches going
      // quiet is far more likely to mean the DOM changed or Cloudflare stepped
      // in — so this is treated as a failure rather than a silent empty result.
      const snippet = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.log("[huuto] No listing links found. Page snippet:", snippet);
      throw err;
    }

    const now = new Date().toISOString();

    const raw = await page.evaluate(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>("a[href*='/kohteet/']");
      return Array.from(links).map((a) => {
        const title = a.querySelector("h3")?.textContent?.trim() ?? "";
        const priceEl = a.querySelector(".text-blue-500.font-bold");
        const price = priceEl?.textContent?.trim() ?? "";

        return {
          url: a.href.startsWith("http") ? a.href : `https://www.huuto.net${a.getAttribute("href")}`,
          title,
          price,
        };
      }).filter((item) => item.url && item.title);
    });

    return raw.map((item) => ({
      ...item,
      listingTime: now,
    }));
  },
};
