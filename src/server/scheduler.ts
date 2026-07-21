import type { WebSocket } from "ws";
import type { ScrapeResult, ServerMessage } from "./types.js";
import { scrapeUrls } from "./scraper.js";

const SCRAPE_INTERVAL_MS = 60_000;

// One scrape schedule for the whole server, not one per connected client.
// Every client subscribes to a set of URLs; each tick scrapes the union of
// those sets exactly once and fans the results back out. Two browser tabs
// watching the same URL therefore cost the same as one.
const subscriptions = new Map<WebSocket, string[]>();
const cache = new Map<string, ScrapeResult>();

let timer: NodeJS.Timeout | null = null;
let running = false;
// A cycle was requested while one was already in flight — run once more when
// the current one finishes. Bounded to a single rerun so requests can't stack.
let rerunRequested = false;

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

/** Send a client whatever we already hold for the URLs it subscribed to. */
function deliver(ws: WebSocket, urls: string[]): void {
  const results = urls
    .map((url) => cache.get(url))
    .filter((r): r is ScrapeResult => r !== undefined);

  if (results.length > 0) {
    send(ws, { type: "scrape_result", results });
  }
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
    const results = await scrapeUrls(urls);
    for (const result of results) cache.set(result.sourceUrl, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] cycle failed: ${message}`);
    broadcast({ type: "error", message });
  } finally {
    running = false;
  }

  for (const [ws, subscribed] of subscriptions) deliver(ws, subscribed);

  if (rerunRequested) {
    rerunRequested = false;
    void runCycle();
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
  syncTimer();

  // Serve what we already have so a new tab paints immediately, then scrape
  // only if some URL is genuinely new to us.
  deliver(ws, urls);

  if (urls.some((url) => !cache.has(url))) {
    void runCycle();
  }
}

export function unsubscribe(ws: WebSocket): void {
  subscriptions.delete(ws);
  syncTimer();
}
