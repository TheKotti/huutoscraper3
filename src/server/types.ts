export interface Listing {
  title: string;
  url: string;
  price: string;
  listingTime: string;
}

/** What one target's scrape produced this cycle. */
export interface ScrapeResult {
  sourceUrl: string;
  listings: Listing[];
  error?: string;
}

/**
 * What the client is told about a target: its last known good listings plus
 * when it last succeeded and last failed. Listings survive a failed cycle so a
 * broken target keeps showing what it had rather than emptying out.
 */
export interface TargetStatus {
  sourceUrl: string;
  listings: Listing[];
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
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
  | { type: "scrape_result"; results: TargetStatus[] }
  | { type: "error"; message: string };

export interface SiteParser {
  matches(url: string): boolean;
  parse(page: import("puppeteer-core").Page): Promise<Listing[]>;
}
