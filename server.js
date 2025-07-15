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
  log("✅ Client connected");

  ws.on("message", (message) => {
    try {
      log(`💬 Message: ${message.toString()}`);

      // Broadcast to ALL connected clients (including sender)
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
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

// Optional: Health check route for Render/UptimeRobot
app.get("/", (req, res) => {
  res.send("🟢 WebSocket Relay Server is running.");
});

// Optional: Keep WebSocket clients alive
setInterval(() => {
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000); // every 30 seconds

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`🚀 Server listening on port ${PORT}`);
});
