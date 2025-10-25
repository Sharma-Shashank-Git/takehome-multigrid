const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// 10x10 grid = 100 cells
let grid = Array(100).fill("");

// Keep track of each player's submission status
const hasSubmitted = new Map();

// Keep update history (optional feature)
let history = [];

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);
  hasSubmitted.set(socket.id, false);

  // Send initial grid and player count
  socket.emit("init", { grid, online: io.engine.clientsCount, history });

  io.emit("online", { online: io.engine.clientsCount });

  socket.on("updateCell", ({ idx, char }) => {
    if (typeof idx !== "number" || idx < 0 || idx >= 100) {
      socket.emit("errorMsg", "Invalid cell index.");
      return;
    }

    if (hasSubmitted.get(socket.id)) {
      socket.emit("errorMsg", "You already submitted once.");
      return;
    }

    if (grid[idx]) {
      socket.emit("errorMsg", "Cell already occupied.");
      return;
    }

    grid[idx] = char;
    const update = { idx, char, by: socket.id, ts: Date.now() };
    history.push(update);
    hasSubmitted.set(socket.id, true);

    io.emit("cellUpdated", update);
  });

  socket.on("getHistory", () => {
    socket.emit("history", history);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    hasSubmitted.delete(socket.id);
    io.emit("online", { online: io.engine.clientsCount });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
