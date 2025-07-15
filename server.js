const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];

function log(msg) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
}

wss.on("connection", (ws, req) => {
  clients.push(ws);
  log("✅ Client connected");

  ws.on("message", (message) => {
    try {
      // Log and optionally validate JSON
      log(`💬 Message: ${message.toString()}`);

      // Optional: Validate JSON format
      // const data = JSON.parse(message);

      // Broadcast to all others
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

    } catch (err) {
      log(`⚠️ Error handling message: ${err.message}`);
    }
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
    log("❌ Client disconnected");
  });

  ws.on("error", (err) => {
    log(`💥 WebSocket error: ${err.message}`);
  });
});

// Optional health check
app.get("/", (req, res) => {
  res.send("🟢 WebSocket Relay Server is running.");
});

// Optional ping to keep clients alive (esp. on Render)
setInterval(() => {
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000); // every 30 sec

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`🚀 Server listening on port ${PORT}`);
});
