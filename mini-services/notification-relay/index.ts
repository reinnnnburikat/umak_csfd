/**
 * Notification Relay — Socket.IO mini-service (port 3003)
 *
 * Receives notification events via HTTP POST from Next.js API routes
 * and pushes them in real-time to connected Socket.IO clients.
 *
 * Architecture: Two HTTP servers on the same port using a simple approach.
 * The Socket.IO server handles its own transport on path "/".
 * Custom HTTP endpoints are handled by intercepting requests before engine.io.
 *
 * HTTP Endpoints (for Next.js backend):
 *   POST /notify     — Send notification to specific users
 *   POST /broadcast  — Broadcast to all clients or by role
 *   POST /refresh    — Signal data refresh for a module
 *   GET  /health     — Health check
 *
 * Events emitted to clients:
 *   notification  — New notification object (for badge update + toast)
 *   data-refresh  — Signal that data has changed and UI should refresh
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server, Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = 3003;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuthPayload {
  userId: string;
  role: string;
}

interface NotificationPayload {
  id: string;
  type: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  createdAt: string;
}

interface NotifyBody {
  userIds: string[];
  notification: NotificationPayload;
}

interface BroadcastBody {
  notification: NotificationPayload;
  roles?: string[];
}

interface RefreshBody {
  module: string;
  action: string;
  recordId?: string;
}

// ---------------------------------------------------------------------------
// Track connected users: socket.id → { userId, role }
// ---------------------------------------------------------------------------
const connectedUsers = new Map<string, { userId: string; role: string }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

/** Join all role rooms for a given role (including supplementary hierarchy). */
function joinRoleRooms(socket: Socket, role: string) {
  socket.join(`role:${role}`);
  const lower = role.toLowerCase();
  // Staff/admin/superadmin also join lower-privilege role rooms
  if (lower === "staff" || lower === "admin" || lower === "superadmin") {
    socket.join("role:staff");
  }
  if (lower === "admin" || lower === "superadmin") {
    socket.join("role:admin");
  }
  if (lower === "superadmin") {
    socket.join("role:superadmin");
  }
}

/** Leave all role rooms for a given role. */
function leaveRoleRooms(socket: Socket, role: string) {
  socket.leave(`role:${role}`);
  const lower = role.toLowerCase();
  if (lower === "staff" || lower === "admin" || lower === "superadmin") {
    socket.leave("role:staff");
  }
  if (lower === "admin" || lower === "superadmin") {
    socket.leave("role:admin");
  }
  if (lower === "superadmin") {
    socket.leave("role:superadmin");
  }
}

// ---------------------------------------------------------------------------
// Handle custom HTTP endpoints (called before Socket.IO)
// Returns true if the request was handled, false otherwise.
// ---------------------------------------------------------------------------
async function handleCustomEndpoint(
  req: IncomingMessage,
  res: ServerResponse,
  io: Server
): Promise<boolean> {
  // CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  const url = req.url || "/";

  // GET /health
  if (req.method === "GET" && url === "/health") {
    sendJson(res, 200, {
      status: "ok",
      connections: io.sockets.sockets.size,
    });
    return true;
  }

  // POST /notify
  if (req.method === "POST" && url === "/notify") {
    try {
      const raw = await readBody(req);
      const body: NotifyBody = JSON.parse(raw);

      if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
        sendJson(res, 400, { error: "Missing or empty userIds" });
        return true;
      }
      if (!body.notification?.id || !body.notification?.type || !body.notification?.message) {
        sendJson(res, 400, { error: "Missing notification fields (id, type, message required)" });
        return true;
      }

      for (const userId of body.userIds) {
        io.to(`user:${userId}`).emit("notification", body.notification);
      }
      console.log(`[relay] notify → ${body.userIds.length} user(s)`);
      sendJson(res, 200, { success: true, deliveredTo: body.userIds.length });
    } catch (err) {
      console.error("[relay] Error processing /notify:", err);
      if (!res.headersSent) sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  // POST /broadcast
  if (req.method === "POST" && url === "/broadcast") {
    try {
      const raw = await readBody(req);
      const body: BroadcastBody = JSON.parse(raw);

      if (!body.notification?.id || !body.notification?.type || !body.notification?.message) {
        sendJson(res, 400, { error: "Missing notification fields (id, type, message required)" });
        return true;
      }

      if (body.roles && Array.isArray(body.roles) && body.roles.length > 0) {
        for (const role of body.roles) {
          io.to(`role:${role}`).emit("notification", body.notification);
        }
        console.log(`[relay] broadcast → roles: ${body.roles.join(", ")}`);
      } else {
        io.emit("notification", body.notification);
        console.log("[relay] broadcast → all connected sockets");
      }
      sendJson(res, 200, { success: true });
    } catch (err) {
      console.error("[relay] Error processing /broadcast:", err);
      if (!res.headersSent) sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  // POST /refresh
  if (req.method === "POST" && url === "/refresh") {
    try {
      const raw = await readBody(req);
      const body: RefreshBody = JSON.parse(raw);

      if (!body.module || !body.action) {
        sendJson(res, 400, { error: "Missing required fields: module, action" });
        return true;
      }

      io.emit("data-refresh", {
        module: body.module,
        action: body.action,
        recordId: body.recordId,
      });
      console.log(`[relay] data-refresh → module: ${body.module}, action: ${body.action}`);
      sendJson(res, 200, { success: true });
    } catch (err) {
      console.error("[relay] Error processing /refresh:", err);
      if (!res.headersSent) sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  // Not a custom endpoint — let Socket.IO handle it
  return false;
}

// ---------------------------------------------------------------------------
// Create HTTP server with custom endpoint handling
// ---------------------------------------------------------------------------
const httpServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Save Socket.IO's internal request handler
const ioRequestHandler = httpServer.listeners("request").pop() as (
  req: IncomingMessage,
  res: ServerResponse
) => void;

// Remove all request listeners and install our own
httpServer.removeAllListeners("request");

httpServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // Try our custom endpoints first
    const handled = await handleCustomEndpoint(req, res, io);
    if (handled) return;

    // Not a custom endpoint — forward to Socket.IO
    if (ioRequestHandler) {
      ioRequestHandler(req, res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  } catch (err) {
    console.error("[relay] Unhandled request error:", err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal server error");
    }
  }
});

// ---------------------------------------------------------------------------
// Socket.IO connection handling
// ---------------------------------------------------------------------------
io.on("connection", (socket: Socket) => {
  console.log(`[socket] Connected: ${socket.id}`);

  socket.on("authenticate", (payload: AuthPayload) => {
    try {
      if (!payload?.userId || !payload?.role) {
        socket.emit("error", { message: "userId and role are required" });
        return;
      }

      const { userId, role } = payload;

      // Leave previous rooms if re-authenticating
      const prev = connectedUsers.get(socket.id);
      if (prev) {
        socket.leave(`user:${prev.userId}`);
        leaveRoleRooms(socket, prev.role);
      }

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Join role-based rooms
      joinRoleRooms(socket, role);

      // Track connected user
      connectedUsers.set(socket.id, { userId, role });

      socket.emit("authenticated", { userId, role });
      console.log(`[socket] Authenticated: ${socket.id} → user:${userId}, role:${role}`);
    } catch (err) {
      console.error("[socket] Error in authenticate handler:", err);
    }
  });

  socket.on("disconnect", (reason) => {
    try {
      const auth = connectedUsers.get(socket.id);
      if (auth) {
        socket.leave(`user:${auth.userId}`);
        leaveRoleRooms(socket, auth.role);
        connectedUsers.delete(socket.id);
        console.log(`[socket] Disconnected: ${socket.id} → user:${auth.userId}, reason: ${reason}`);
      } else {
        console.log(`[socket] Disconnected (unauthenticated): ${socket.id}, reason: ${reason}`);
      }
    } catch (err) {
      console.error("[socket] Error in disconnect handler:", err);
    }
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(`[notification-relay] Server listening on port ${PORT}`);
  console.log(`[notification-relay] Socket.IO path: /`);
  console.log(`[notification-relay] Endpoints: POST /notify, POST /broadcast, POST /refresh, GET /health`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const shutdown = (signal: string) => {
  console.log(`\n[notification-relay] Received ${signal}, shutting down...`);
  io.disconnectSockets(true);
  httpServer.close(() => {
    console.log("[notification-relay] Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[notification-relay] Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Prevent unhandled rejection crashes
process.on("unhandledRejection", (reason) => {
  console.error("[notification-relay] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[notification-relay] Uncaught exception:", err);
});
