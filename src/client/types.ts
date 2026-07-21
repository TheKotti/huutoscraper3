export interface Listing {
  title: string;
  url: string;
  price: string;
  listingTime: string;
  sourceUrl: string;
}

export interface TargetStatus {
  sourceUrl: string;
  listings: Listing[];
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

export type ClientMessage = {
  type: "subscribe";
  urls: string[];
};

export type ServerMessage =
  | { type: "scrape_start" }
  | { type: "scrape_result"; results: TargetStatus[] }
  | { type: "error"; message: string };
