const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(express.json({ limit: "256kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const sessions = new Map();

function tokenFrom(req) {
  return (req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function getSession(token) {
  return token ? sessions.get(token) : undefined;
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "KAT relay",
    version: 3
  });
});

app.get("/session", (req, res) => {
  const session = getSession(tokenFrom(req));

  if (!session) {
    return res.status(401).json({
      authenticated: false,
      error: "Invalid token"
    });
  }

  res.json({
    authenticated: true,
    gameName: session.gameName,
    gameConnected: !!session.gameSocket
  });
});

app.post("/register-game", (req, res) => {
  const gameName = String(
    req.body?.gameName || "KAT"
  ).slice(0, 64);

  const token = newToken();

  sessions.set(token, {
    gameName,
    gameSocket: null,
    createdAt: Date.now()
  });

  res.json({
    token,
    gameUrl: "/game"
  });
});

app.post("/execute", (req, res) => {
  const token = tokenFrom(req);
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({
      error: "Invalid token"
    });
  }

  if (
    !session.gameSocket ||
    session.gameSocket.readyState !== 1
  ) {
    return res.status(409).json({
      error: "Game is not connected"
    });
  }

  const source = String(req.body?.source || "");

  if (!source.trim()) {
    return res.status(400).json({
      error: "Empty source"
    });
  }

  if (source.length > 256 * 1024) {
    return res.status(413).json({
      error: "Script too large"
    });
  }

  const requestId = crypto.randomUUID();

  session.gameSocket.send(
    JSON.stringify({
      type: "execute",
      requestId,
      source
    })
  );

  res.json({
    ok: true,
    requestId,
    output: "Command sent to game."
  });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(
    request.url,
    "http://localhost"
  );

  if (url.pathname !== "/game") {
    socket.destroy();
    return;
  }

  const token =
    url.searchParams.get("token") || "";

  const session = getSession(token);

  if (!session) {
    socket.write(
      "HTTP/1.1 401 Unauthorized\r\n\r\n"
    );
    socket.destroy();
    return;
  }

  wss.handleUpgrade(
    request,
    socket,
    head,
    ws => {
      wss.emit(
        "connection",
        ws,
        request,
        session
      );
    }
  );
});

wss.on(
  "connection",
  (ws, request, session) => {
    if (
      session.gameSocket &&
      session.gameSocket.readyState === 1
    ) {
      session.gameSocket.close(
        4000,
        "Replaced by newer connection"
      );
    }

    session.gameSocket = ws;

    ws.send(
      JSON.stringify({
        type: "connected",
        gameName: session.gameName
      })
    );

    ws.on("message", raw => {
      let message;

      try {
        message = JSON.parse(
          raw.toString()
        );
      } catch {
        return;
      }

      if (message.type === "result") {
        // Reserved for future result handling.
      }
    });

    ws.on("close", () => {
      if (session.gameSocket === ws) {
        session.gameSocket = null;
      }
    });

    ws.on("error", () => {
      if (session.gameSocket === ws) {
        session.gameSocket = null;
      }
    });
  }
);

const port = Number(
  process.env.PORT || 3000
);

server.listen(port, () => {
  console.log(
    `KAT relay listening on port ${port}`
  );
});
