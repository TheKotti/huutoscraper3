import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { setupWebSocket } from "./ws-handler.js";
import { shutdown } from "./browser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = express();
const server = createServer(app);

const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

async function gracefulShutdown() {
  console.log("Shutting down...");
  await shutdown();
  server.close();
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
