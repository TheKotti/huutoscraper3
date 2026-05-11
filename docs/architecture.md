# Architecture

## Overview

HuutoScraper is a real-time web scraper that monitors huuto.net and tori.fi listing pages and displays new listings as they appear. The app consists of a Node.js backend that drives a headless Chrome browser and a React frontend that communicates over WebSocket.

There is no database. The backend is stateless — it receives URLs from the client, scrapes them, and returns results. The client owns the URL list (stored in the browser's URL query string) and handles diffing to detect new listings.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js / TypeScript, Express, ws |
| Scraper | puppeteer-core + puppeteer-extra-plugin-stealth |
| Frontend | React, Vite |
| Container | Docker (node:20-slim + Chromium) |

## Data flow

```
Browser URL params ──> React client ──> WebSocket ──> Node server
                                                        │
                                                   Puppeteer + Chromium
                                                        │
                                              huuto.net / tori.fi
                                                        │
                                                   Parse listings
                                                        │
Client receives results <── WebSocket <── Server sends ScrapeResult[]
     │
     ├── Diff against known listings
     ├── Highlight new ones
     └── Sort by listing time, newest first
```

## Project structure

```
src/
  server/
    index.ts            Express + WebSocket server entry point
    browser.ts          Singleton Chromium manager (puppeteer-extra + stealth)
    scraper.ts          Receives URLs, scrapes them sequentially using a shared page
    ws-handler.ts       WebSocket message routing
    types.ts            Shared types (Listing, ScrapeResult, messages)
    parsers/
      huuto.ts          huuto.net DOM extraction
      tori.ts           tori.fi DOM extraction + relative time parsing
  client/
    index.html          Entry HTML
    main.tsx            React entry point
    App.tsx             Root component: URL management, scrape loop, listing diffing
    types.ts            Client-side types (mirrors server types)
    hooks/
      useWebSocket.ts   WebSocket connection, reconnection, message dispatch
      useUrlParams.ts   Read/write monitored URLs from browser URL query string
    components/
      UrlForm.tsx       URL input form
      JobList.tsx       Active URL list with remove buttons
      ListingTable.tsx  Listing table sorted by time, with new-listing highlight
    style.css
```

## WebSocket protocol

**Client to server:**

| type | payload | description |
|------|---------|-------------|
| `scrape` | `{ urls: string[] }` | Scrape these URLs and return results |

**Server to client:**

| type | payload | description |
|------|---------|-------------|
| `scrape_start` | — | Scrape has begun |
| `scrape_result` | `{ results: ScrapeResult[] }` | Results for all URLs |
| `error` | `{ message }` | Error message |

## Parsers

Each parser implements `SiteParser` (matches a URL, extracts listings from a Puppeteer page).

**tori.fi** — selects `article.sf-search-ad` cards, extracts title from `h2`, price from `.font-bold span`, listing time from `.s-text-subtle`. Relative times ("5 min", "2 t") are converted to ISO timestamps. Listings older than 6 hours are filtered out.

**huuto.net** — selects `a[href*='/kohteet/']` links, extracts title from `h3`, price from `.text-blue-500.font-bold`. Dismisses the cookie banner first. Listing time is set to the scrape timestamp since huuto.net doesn't show relative times in the list view.

## Cloudflare bypass

The stealth plugin (`puppeteer-extra-plugin-stealth`) patches Chrome's fingerprint to avoid detection: hides webdriver flag, spoofs plugin enumeration, language/platform headers, etc. JavaScript is left enabled so Cloudflare challenges can resolve naturally.
