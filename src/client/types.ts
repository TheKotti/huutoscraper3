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

export type ClientMessage = {
  type: "scrape";
  urls: string[];
};

export type ServerMessage =
  | { type: "scrape_start" }
  | { type: "scrape_result"; results: ScrapeResult[] }
  | { type: "error"; message: string };
