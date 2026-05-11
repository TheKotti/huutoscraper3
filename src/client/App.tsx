import { useEffect, useRef, useState, useMemo } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useUrlParams } from "./hooks/useUrlParams";
import { UrlForm } from "./components/UrlForm";
import { JobList } from "./components/JobList";
import { ListingTable } from "./components/ListingTable";
import type { Listing } from "./types";

const SCRAPE_INTERVAL_MS = 60_000;

export function App() {
  const { connected, scraping, results, error, scrape } = useWebSocket();
  const { urls, addUrl, removeUrl } = useUrlParams();

  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [newUrls, setNewUrls] = useState<Set<string>>(new Set());
  const knownUrlsRef = useRef<Set<string>>(new Set());

  // When results come in, diff against known listings
  useEffect(() => {
    if (results.length === 0) return;

    const incoming: Listing[] = [];
    for (const r of results) {
      incoming.push(...r.listings);
    }

    const freshUrls = new Set<string>();
    const merged = new Map<string, Listing>();

    // Keep existing listings
    for (const l of allListings) {
      merged.set(l.url, l);
    }

    for (const l of incoming) {
      if (!knownUrlsRef.current.has(l.url)) {
        freshUrls.add(l.url);
      }
      merged.set(l.url, l);
      knownUrlsRef.current.add(l.url);
    }

    const sorted = Array.from(merged.values()).sort(
      (a, b) => new Date(b.listingTime).getTime() - new Date(a.listingTime).getTime()
    );
    setAllListings(sorted);
    setNewUrls(freshUrls);

    // Clear "new" highlight after animation
    if (freshUrls.size > 0) {
      setTimeout(() => setNewUrls(new Set()), 2000);
    }
  }, [results]);

  // Trigger scrape on interval and when URLs change
  useEffect(() => {
    if (!connected || urls.length === 0) return;

    scrape(urls);
    const timer = setInterval(() => scrape(urls), SCRAPE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [connected, urls, scrape]);

  return (
    <div className="app">
      <header>
        <h1>HuutoScraper</h1>
        <span className={`conn-status ${connected ? "online" : "offline"}`}>
          {scraping ? "Scraping..." : connected ? "Connected" : "Reconnecting..."}
        </span>
      </header>

      <section className="controls">
        <UrlForm onAdd={addUrl} />
        <JobList urls={urls} onRemove={removeUrl} />
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="listings">
        <h2>Listings ({allListings.length})</h2>
        <ListingTable listings={allListings} newUrls={newUrls} />
      </section>
    </div>
  );
}
