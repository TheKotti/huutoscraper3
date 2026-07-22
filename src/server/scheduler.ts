import type { WebSocket } from "ws";
import type { TargetStatus, ServerMessage } from "./types.js";
import {
  scrapeUrls,
  URL_BUDGET_MS,
  PAGE_SETUP_BUDGET_MS,
} from "./scraper.js";
import { forceRestart } from "./browser.js";
import { withTimeout } from "./timeout.js";

const SCRAPE_INTERVAL_MS = 60_000;

// Cap retained listings per target. A scrape returns one page's worth, which is
// already bounded, but this keeps a pathologically large page from pinning a lot
// of memory on the small host this runs on.
const MAX_LISTINGS_PER_TARGET = 60;

// One scrape schedule for the whole server, not one per connected client.
// Every client subscribes to a set of URLs; each tick scrapes the union of
// those sets exactly once and fans the results back out. Two browser tabs
// watching the same URL therefore cost the same as one.
const subscriptions = new Map<WebSocket, string[]>();
const targets = new Map<string, TargetStatus>();

let timer: NodeJS.Timeout | null = null;
let running = false;
// A cycle was requested while one was already in flight — run once more when
// the current one finishes. Bounded to a single rerun so requests can't stack.
let rerunRequested = false;

/**
 * Ceiling for a whole cycle. The per-target budget in the scraper covers a slow
 * site; this covers the CDP calls it cannot bound (newPage, evaluate, close),
 * which hang indefinitely when Chrome is alive but unresponsive.
 */
function cycleBudget(urlCount: number): number {
  return PAGE_SETUP_BUDGET_MS + urlCount * (URL_BUDGET_MS + 5_000);
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function activeUrls(): string[] {
  const set = new Set<string>();
  for (const urls of subscriptions.values()) {
    for (const url of urls) set.add(url);
  }
  return Array.from(set);
}

function targetFor(url: string): TargetStatus {
  let target = targets.get(url);
  if (!target) {
    target = {
      sourceUrl: url,
      listings: [],
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
    };
    targets.set(url, target);
  }
  return target;
}

function recordSuccess(url: string, listings: TargetStatus["listings"]): void {
  const target = targetFor(url);
  // Newest first, then keep only the cap so an unusually large page can't grow
  // this target without bound.
  target.listings = [...listings]
    .sort(
      (a, b) =>
        new Date(b.listingTime).getTime() - new Date(a.listingTime).getTime(),
    )
    .slice(0, MAX_LISTINGS_PER_TARGET);
  target.lastSuccessAt = new Date().toISOString();
}

// Listings are deliberately left untouched: a target that breaks should keep
// showing its last known good data rather than emptying out.
function recordFailure(url: string, message: string): void {
  const target = targetFor(url);
  target.lastFailureAt = new Date().toISOString();
  target.lastError = message;
}

/** Send a client whatever we already hold for the URLs it subscribed to. */
function deliver(ws: WebSocket, urls: string[]): void {
  const results = urls
    .map((url) => targets.get(url))
    .filter((t): t is TargetStatus => t !== undefined);

  if (results.length > 0) {
    send(ws, { type: "scrape_result", results });
  }
}

function deliverAll(): void {
  for (const [ws, subscribed] of subscriptions) deliver(ws, subscribed);
}

function broadcast(msg: ServerMessage): void {
  for (const ws of subscriptions.keys()) send(ws, msg);
}

async function runCycle(): Promise<void> {
  // The in-flight guard. A slow site can push a cycle past the interval, and
  // without this the next tick would start a second scrape on the same browser
  // and the two would pile up indefinitely.
  if (running) {
    rerunRequested = true;
    console.log("[scheduler] cycle still running, deferring");
    return;
  }

  const urls = activeUrls();
  if (urls.length === 0) return;

  running = true;
  broadcast({ type: "scrape_start" });

  try {
    const results = await withTimeout(
      scrapeUrls(urls),
      cycleBudget(urls.length),
      "scrape cycle",
    );

    for (const result of results) {
      if (result.error) {
        recordFailure(result.sourceUrl, result.error);
      } else {
        recordSuccess(result.sourceUrl, result.listings);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] cycle failed: ${message}`);

    // Abandon this cycle: nothing that comes back from it can be trusted, and
    // the browser it was using is presumed wedged. Restarting is what lets the
    // next tick make progress instead of inheriting the same stuck Chrome.
    for (const url of urls) recordFailure(url, message);
    await forceRestart().catch(() => {});
    broadcast({ type: "error", message });
  } finally {
    running = false;
  }

  deliverAll();

  if (rerunRequested) {
    rerunRequested = false;
    void runCycle();
  }
}

// Drop cached results for URLs nobody is watching anymore. Without this the
// targets map only ever grows: every distinct URL ever subscribed would keep
// its last page of listings resident for the lifetime of the process.
function pruneTargets(): void {
  const active = new Set(activeUrls());
  for (const url of targets.keys()) {
    if (!active.has(url)) targets.delete(url);
  }
}

// No subscribers means no timer at all — an idle server does no scraping.
function syncTimer(): void {
  const shouldRun = subscriptions.size > 0 && activeUrls().length > 0;

  if (shouldRun && !timer) {
    timer = setInterval(() => void runCycle(), SCRAPE_INTERVAL_MS);
    console.log("[scheduler] started");
  } else if (!shouldRun && timer) {
    clearInterval(timer);
    timer = null;
    console.log("[scheduler] stopped, no subscribers");
  }
}

export function subscribe(ws: WebSocket, urls: string[]): void {
  subscriptions.set(ws, urls);
  // This may have been the last watcher of some previously-active URL.
  pruneTargets();
  syncTimer();

  // Serve what we already have so a new tab paints immediately, then scrape
  // only if some URL is genuinely new to us.
  deliver(ws, urls);

  if (urls.some((url) => !targets.has(url))) {
    void runCycle();
  }
}

export function unsubscribe(ws: WebSocket): void {
  subscriptions.delete(ws);
  pruneTargets();
  syncTimer();
}
