const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid"); // for client IDs

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = new Map(); // Map<WebSocket, clientInfo>
let lastElixirState = null;

function log(msg) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
}

// Heartbeat function
function heartbeat() {
  this.isAlive = true;
}

// WebSocket connection
wss.on("connection", (ws) => {
  ws.id = uuidv4();
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  clients.set(ws, { id: ws.id });

  log(`✅ Client connected (ID: ${ws.id}). Total: ${clients.size}`);

  // Optional: replay last elixir state on new connection
  if (lastElixirState) {
    ws.send(JSON.stringify(lastElixirState));
    log(`📤 Sent last state to client ${ws.id}`);
  }

  ws.on("message", (message) => {
    log(`💬 Received from ${ws.id}: ${message}`);

    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      log(`❌ Invalid JSON from ${ws.id}, ignoring.`);
      return;
    }

    // Validate elixir update
    if (typeof data.elixir === "number" && data.elixir >= 0 && data.elixir <= 10) {
      lastElixirState = {
        type: "elixir_update",
        elixir: data.elixir,
        timestamp: Date.now(),
        from: ws.id
      };

      // Broadcast to all clients EXCEPT the sender
      clients.forEach((info, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(lastElixirState));
        }
      });

      log(`🔄 Broadcasted elixir update from ${ws.id} → ${clients.size - 1} clients`);
    } else {
      log(`⚠️ Ignored invalid elixir data from ${ws.id}: ${message}`);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    log(`❌ Client disconnected (ID: ${ws.id}). Remaining: ${clients.size}`);
  });

  ws.on("error", (err) => {
    log(`💥 WebSocket error from ${ws.id}: ${err.message}`);
  });
});

// Clean up dead sockets
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      log(`⚰️ Terminating dead connection (${ws.id})`);
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("🟢 WebSocket Relay Server is running.");
});

// Graceful shutdown
process.on("SIGINT", () => {
  log("🔻 Shutting down...");
  clearInterval(interval);
  server.close(() => {
    log("✅ Server closed");
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`🚀 Server listening on port ${PORT}`);
});
