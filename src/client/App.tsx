import { useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useUrlParams } from "./hooks/useUrlParams";
import { UrlForm } from "./components/UrlForm";
import { JobList } from "./components/JobList";
import { KeywordInput } from "./components/KeywordInput";
import { ListingTable } from "./components/ListingTable";
import { TargetStatusLine } from "./components/TargetStatusLine";
import type { Listing } from "./types";

// huuto.net doesn't publish listing times, so its parser stamps every listing
// with the scrape time. Freeze the first value we saw for those, or rescrapes
// keep bumping it forward. tori.fi reports real times, so let those refresh.
function hasSyntheticTime(sourceUrl: string): boolean {
  return sourceUrl.includes("huuto.net");
}

export function App() {
  const { connected, scraping, results, error, subscribe } = useWebSocket();
  const { urls, keywords, addUrl, removeUrl, setKeywords } = useUrlParams();

  // "silent hill, deus ex" -> ["silent hill", "deus ex"], matched as substrings
  const keywordTerms = useMemo(
    () =>
      keywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    [keywords],
  );

  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [newUrls, setNewUrls] = useState<Set<string>>(new Set());
  const knownUrlsRef = useRef<Set<string>>(new Set());

  // When results come in, diff against known listings
  useEffect(() => {
    if (results.length === 0) return;

    const incoming: Listing[] = [];
    for (const r of results) {
      for (const l of r.listings) {
        incoming.push({ ...l, sourceUrl: r.sourceUrl });
      }
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
      const previous = merged.get(l.url);
      merged.set(
        l.url,
        previous && hasSyntheticTime(l.sourceUrl)
          ? { ...l, listingTime: previous.listingTime }
          : l,
      );
      knownUrlsRef.current.add(l.url);
    }

    const sorted = Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.listingTime).getTime() - new Date(a.listingTime).getTime(),
    );
    setAllListings(sorted);
    setNewUrls(freshUrls);

    // Clear "new" highlight after animation
    if (freshUrls.size > 0) {
      setTimeout(() => setNewUrls(new Set()), 2000);
    }
  }, [results]);

  // Declare interest and let the server drive the schedule. Running a timer
  // here meant every open tab cost a full extra scrape cycle.
  useEffect(() => {
    if (!connected) return;
    subscribe(urls);
  }, [connected, urls, subscribe]);

  const [compact, setCompact] = useState(false);

  return (
    <div className="app">
      <header>
        {!compact && <h1>HuutoScraper</h1>}
        <span className={`conn-status ${connected ? "online" : "offline"}`}>
          {scraping
            ? "Scraping..."
            : connected
              ? "Connected"
              : "Reconnecting..."}
        </span>
        <button className="compact-toggle" onClick={() => setCompact((c) => !c)}>
          {compact ? "Expand" : "Compact"}
        </button>
      </header>

      {!compact && (
        <section className="controls">
          <UrlForm onAdd={addUrl} />
          <JobList urls={urls} onRemove={removeUrl} />
          <KeywordInput value={keywords} onChange={setKeywords} />
        </section>
      )}

      {error && <div className="error-banner">{error}</div>}

      <section className="listings">
        {urls.map((sourceUrl) => {
          const group = allListings.filter((l) => l.sourceUrl === sourceUrl);
          const status = results.find((r) => r.sourceUrl === sourceUrl);
          return (
            <div key={sourceUrl} className="listing-group">
              <h2>
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                  {new URL(sourceUrl).hostname}
                </a>
                <span className="listing-count">{group.length}</span>
              </h2>
              <TargetStatusLine status={status} />
              <ListingTable
                listings={group}
                newUrls={newUrls}
                keywords={keywordTerms}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}
