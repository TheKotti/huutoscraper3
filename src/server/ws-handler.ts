import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { ClientMessage, ServerMessage } from "./types.js";
import { scrapeUrls } from "./scraper.js";

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (msg.type === "scrape") {
        if (!msg.urls?.length) {
          send(ws, { type: "error", message: "No URLs provided" });
          return;
        }

        send(ws, { type: "scrape_start" });

        try {
          const results = await scrapeUrls(msg.urls);
          send(ws, { type: "scrape_result", results });
        } catch (err) {
          send(ws, { type: "error", message: err instanceof Error ? err.message : String(err) });
        }
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });
}
