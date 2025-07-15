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

wss.on("connection", (ws) => {
  clients.push(ws);
  log("✅ Client connected. Total: " + clients.length);

  ws.on("message", (message) => {
    log(`💬 Received: ${message}`);

    // ✅ Send to ALL clients, including the sender
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        log(`🔄 Sent to client`);
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
    log("❌ Client disconnected. Remaining: " + clients.length);
  });

  ws.on("error", (err) => {
    log(`💥 WebSocket error: ${err.message}`);
  });
});

// Optional: health check
app.get("/", (req, res) => {
  res.send("🟢 WebSocket Relay Server is running.");
});

// Keep connections alive
setInterval(() => {
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`🚀 Server listening on port ${PORT}`);
});
