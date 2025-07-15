const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

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

wss.on("connection", (ws) => {
  ws.id = uuidv4();
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  clients.set(ws, { id: ws.id });

  log(`✅ Client connected (ID: ${ws.id}). Total: ${clients.size}`);

  // Send last known elixir state to new client
  if (lastElixirState) {
    ws.send(JSON.stringify(lastElixirState));
    log(`📤 Sent last state to client ${ws.id}`);
  }

  let lastElixirForClient = null;

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      log(`❌ Invalid JSON from ${ws.id}, ignoring.`);
      return;
    }

    const elixir = data.elixir;

    // Only process valid elixir data
    if (typeof elixir === "number" && elixir >= 0 && elixir <= 10) {
      if (elixir === lastElixirForClient) {
        // Skip redundant updates
        return;
      }
      lastElixirForClient = elixir;

      lastElixirState = {
        type: "elixir_update",
        elixir,
        timestamp: Date.now(),
        from: ws.id
      };

      const payload = JSON.stringify(lastElixirState);

      // Broadcast to all other clients
      clients.forEach((info, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });

      log(`🔄 Broadcasted new elixir ${elixir} from ${ws.id} → ${clients.size - 1} clients`);
    } else {
      log(`⚠️ Ignored invalid elixir data from ${ws.id}: ${JSON.stringify(data)}`);
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

// Keep sockets alive
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

// Health check
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`🚀 Server listening on port ${PORT}`);
});
