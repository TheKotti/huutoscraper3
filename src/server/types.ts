export interface Listing {
  title: string;
  url: string;
  price: string;
  listingTime: string;
}

export interface ScrapeResult {
  sourceUrl: string;
  listings: Listing[];
  error?: string;
}

// Client → Server. Clients declare which URLs they care about; the server owns
// the scrape schedule, so a client never asks for a scrape directly.
export type ClientMessage = {
  type: "subscribe";
  urls: string[];
};

// Server → Client
export type ServerMessage =
  | { type: "scrape_start" }
  | { type: "scrape_result"; results: ScrapeResult[] }
  | { type: "error"; message: string };

export interface SiteParser {
  matches(url: string): boolean;
  parse(page: import("puppeteer-core").Page): Promise<Listing[]>;
}
