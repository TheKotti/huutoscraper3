import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { ClientMessage, ServerMessage } from "./types.js";
import { subscribe, unsubscribe } from "./scheduler.js";

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (msg.type === "subscribe") {
        if (!Array.isArray(msg.urls)) {
          send(ws, { type: "error", message: "urls must be an array" });
          return;
        }
        subscribe(ws, msg.urls);
      }
    });

    ws.on("close", () => {
      unsubscribe(ws);
      console.log("Client disconnected");
    });
  });
}
