# Development Setup

## Prerequisites

- Node.js 20+
- Google Chrome installed locally (Puppeteer uses it for scraping)

## Install

```bash
npm install
```

## Run

Start the backend and frontend in two separate terminals:

**Terminal 1 — backend:**
```bash
npx tsx src/server/index.ts
```
Starts the Express + WebSocket server on port 3000.

**Terminal 2 — frontend:**
```bash
npx vite --port 5173
```
Starts the Vite dev server with hot reload on port 5173. WebSocket requests are proxied to the backend via `vite.config.ts`.

Open `http://localhost:5173` in your browser.

## Usage

1. Paste a huuto.net or tori.fi search URL into the input field and click Add
2. The URL is stored in the browser's query string (shareable/bookmarkable)
3. A scrape triggers immediately, then repeats every 60 seconds
4. New listings are highlighted briefly when they appear

## Build

```bash
npm run build          # builds both client and server
npm run build:client   # vite build only
npm run build:server   # tsc only
```

## Type checking

```bash
npx tsc --noEmit
```

## Project config

| File | Purpose |
|------|---------|
| `tsconfig.json` | Shared TS config (client + server) |
| `tsconfig.server.json` | Server-only TS config (outputs to `dist/server/`) |
| `vite.config.ts` | Client build + dev server proxy config |

## Adding a new site parser

1. Create `src/server/parsers/yoursite.ts` implementing `SiteParser` from `types.ts`
2. Export it and add it to the `parsers` array in `src/server/scraper.ts`
3. Test with a throwaway script: navigate to the page with Puppeteer, call your parser, print results
