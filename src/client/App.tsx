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

  // Each scrape_result carries the server's full current view of every watched
  // URL, so we rebuild from it rather than accumulating. A listing that has
  // fallen off its source is simply absent here and drops out of the UI, which
  // is what keeps outdated listings from piling up.
  useEffect(() => {
    if (results.length === 0) return;

    // What we currently show, so we can carry forward frozen synthetic times.
    const previousByUrl = new Map(allListings.map((l) => [l.url, l]));

    const freshUrls = new Set<string>();
    const next: Listing[] = [];

    for (const r of results) {
      for (const l of r.listings) {
        const listing: Listing = { ...l, sourceUrl: r.sourceUrl };
        if (!knownUrlsRef.current.has(listing.url)) {
          freshUrls.add(listing.url);
        }
        const previous = previousByUrl.get(listing.url);
        next.push(
          previous && hasSyntheticTime(listing.sourceUrl)
            ? { ...listing, listingTime: previous.listingTime }
            : listing,
        );
      }
    }

    next.sort(
      (a, b) =>
        new Date(b.listingTime).getTime() - new Date(a.listingTime).getTime(),
    );
    setAllListings(next);
    setNewUrls(freshUrls);

    // Track only what's currently present so this set can't grow without bound
    // either. A listing that disappears and later returns counts as new again.
    knownUrlsRef.current = new Set(next.map((l) => l.url));

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
