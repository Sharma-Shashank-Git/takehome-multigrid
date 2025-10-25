import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SERVER = "http://localhost:4000"; // change if deployed

export default function App() {
  const [grid, setGrid] = useState(Array(100).fill(""));
  const [online, setOnline] = useState(0);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    const socket = io(SERVER, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setError("");
    });

    socket.on("init", (payload) => {
      setGrid(payload.grid || Array(100).fill(""));
      setOnline(payload.online || 0);
      setHistory(payload.history || []);
    });

    socket.on("online", ({ online }) => {
      setOnline(online);
    });

    socket.on("cellUpdated", ({ idx, char }) => {
      setGrid((g) => {
        const next = [...g];
        next[idx] = char;
        return next;
      });
    });

    socket.on("history", (h) => setHistory(h));

    socket.on("errorMsg", (msg) => {
      setError(msg);
      setTimeout(() => setError(""), 2500);
    });

    socket.on("disconnect", () => {
      // nothing special
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const onClickCell = (idx) => {
    if (hasSubmitted) {
      setError("You already submitted and cannot update again.");
      return;
    }
    if (grid[idx] && grid[idx].length > 0) {
      setError("Cell is already occupied.");
      return;
    }
    const char = prompt("Enter a single Unicode character (emoji, letter, symbol):");
    if (!char) return;
    // use the first character (but allow multi-codepoint emojis)
    // we will accept what user types (no strict slicing)
    socketRef.current.emit("updateCell", { idx, char });
    // optimistic local - but server will enforce and broadcast
  };

  // Listen for server marking that our socket submitted
  useEffect(() => {
    if (!socketRef.current) return;
    const s = socketRef.current;
    const onCellUpdated = ({ idx, char, by }) => {
      // if the update was done by this socket id, mark hasSubmitted true
      if (by === s.id) setHasSubmitted(true);
    };
    s.on("cellUpdated", onCellUpdated);
    return () => s.off("cellUpdated", onCellUpdated);
  }, []);

  const requestHistory = () => {
    socketRef.current.emit("getHistory");
  };

  return (
    <div className="container">
      <div className="header">
        <h2>Multiplayer 10×10 Unicode Grid</h2>
        <div>
          <div className="small">Players online: <strong>{online}</strong></div>
          <div className="small">You can submit <strong>{hasSubmitted ? "no more updates" : "one update"}</strong></div>
        </div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 8 }}>{error}</div>}

      <div className="info small">Click any empty cell to submit a character. After you submit once, you cannot update again.</div>
      <div className="grid" role="grid">
        {grid.map((c, i) => (
          <div
            key={i}
            role="gridcell"
            className={`cell ${c ? "disabled" : ""}`}
            onClick={() => onClickCell(i)}
            title={c ? `Set by someone` : `Click to set`}
          >
            {c}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="button" onClick={requestHistory}>Load History</button>
      </div>

      <div className="history">
        <div style={{ fontWeight: 600 }}>History (most recent at bottom):</div>
        {history.length === 0 && <div className="small">No updates yet</div>}
        {history.map((h, idx) => (
          <div key={idx} className="small">
            [{new Date(h.ts).toLocaleTimeString()}] idx: {h.idx}, char: {h.char}
          </div>
        ))}
      </div>
    </div>
  );
}
