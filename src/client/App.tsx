import { useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useUrlParams } from "./hooks/useUrlParams";
import { UrlForm } from "./components/UrlForm";
import { JobList } from "./components/JobList";
import { WordListInput } from "./components/WordListInput";
import { ListingTable } from "./components/ListingTable";
import { TargetStatusLine } from "./components/TargetStatusLine";
import { parseTerms, matchesAny } from "./matching";
import type { Listing } from "./types";

// huuto.net doesn't publish listing times, so its parser stamps every listing
// with the scrape time. Freeze the first value we saw for those, or rescrapes
// keep bumping it forward. tori.fi reports real times, so let those refresh.
function hasSyntheticTime(sourceUrl: string): boolean {
  return sourceUrl.includes("huuto.net");
}

export function App() {
  const { connected, scraping, results, error, subscribe } = useWebSocket();
  const { urls, keywords, hidden, addUrl, removeUrl, setKeywords, setHidden } =
    useUrlParams();

  const keywordTerms = useMemo(() => parseTerms(keywords), [keywords]);
  const hiddenTerms = useMemo(() => parseTerms(hidden), [hidden]);

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
          <WordListInput
            value={keywords}
            onChange={setKeywords}
            placeholder="Highlight keywords, comma separated (e.g. silent hill, deus ex)"
          />
          <WordListInput
            value={hidden}
            onChange={setHidden}
            placeholder="Hide listings containing, comma separated (e.g. rikki, viallinen)"
          />
        </section>
      )}

      {error && <div className="error-banner">{error}</div>}

      <section className="listings">
        {urls.map((sourceUrl) => {
          const group = allListings.filter((l) => l.sourceUrl === sourceUrl);
          // Filtered for display only, never removed from allListings, so
          // clearing a hidden word brings its listings straight back.
          const visible = group.filter((l) => {
            const title = l.title.toLowerCase();
            // A highlight keyword rescues a listing a hidden word would drop
            return (
              !matchesAny(title, hiddenTerms) || matchesAny(title, keywordTerms)
            );
          });
          const hiddenCount = group.length - visible.length;
          const status = results.find((r) => r.sourceUrl === sourceUrl);
          return (
            <div key={sourceUrl} className="listing-group">
              <h2>
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                  {new URL(sourceUrl).hostname}
                </a>
                <span className="listing-count">{visible.length}</span>
                {hiddenCount > 0 && (
                  <span className="listing-hidden-count">
                    {hiddenCount} hidden
                  </span>
                )}
              </h2>
              <TargetStatusLine status={status} />
              <ListingTable
                listings={visible}
                newUrls={newUrls}
                keywords={keywordTerms}
                hiddenCount={hiddenCount}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}
