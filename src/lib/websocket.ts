/**
 * WebSocket Gateway Server
 *
 * Socket.IO-based real-time communication gateway with room management for:
 *   - Live Chat (direct & group conversations, typing indicators, read receipts)
 *   - Real-time Updates (projects, tasks, orders, tickets, CMS changes)
 *   - Notifications (push delivery, mark-read, bulk actions)
 *   - Presence Tracking (online/offline, per-organization, per-room)
 *   - AI Streaming (token-by-token streaming status)
 *   - System Announcements & Admin Broadcasts
 *   - Multi-tenant Isolation (rooms scoped per organization)
 *
 * Architecture:
 *   - Mounted on the same HTTP server as Next.js (custom server)
 *   - JWT-based authentication on handshake
 *   - Redis adapter for horizontal scaling (multi-process)
 *   - Structured event namespacing: domain:action
 *   - Typed payloads for every event
 *
 * Environment Variables:
 *   WS_CORS_ORIGIN           — comma-separated allowed origins (default: *)
 *   WS_PING_INTERVAL_MS      — ping interval (default: 25000)
 *   WS_PING_TIMEOUT_MS       — ping timeout (default: 20000)
 *   WS_MAX_PAYLOAD_MB        — max payload in MB (default: 1)
 *   WS_REDIS_ADAPTER_ENABLED — use Redis adapter (default: false)
 *   WS_AUTH_REQUIRED         — require JWT auth for connections (default: true)
 */

import type { Server as HttpServer } from "http";
import type { Server as HttpsServer } from "https";
import { Server, type Socket, type Namespace } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient } from "@/lib/redis";
import { type JWTPayload, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_NAMESPACE = "/ws";

/** Core event domains */
export const WsDomain = {
  CHAT: "chat",
  NOTIFICATION: "notification",
  PROJECT: "project",
  TASK: "task",
  ORDER: "order",
  TICKET: "ticket",
  CMS: "cms",
  SYSTEM: "system",
  PRESENCE: "presence",
  AI: "ai",
  ANALYTICS: "analytics",
} as const;

export type WsDomain = (typeof WsDomain)[keyof typeof WsDomain];

/** Chat events */
export const ChatEvent = {
  MESSAGE_SEND: "chat:message:send",
  MESSAGE_RECEIVED: "chat:message:received",
  MESSAGE_UPDATED: "chat:message:updated",
  MESSAGE_DELETED: "chat:message:deleted",
  TYPING_START: "chat:typing:start",
  TYPING_STOP: "chat:typing:stop",
  READ_RECEIPT: "chat:read:receipt",
  CONVERSATION_CREATED: "chat:conversation:created",
  CONVERSATION_UPDATED: "chat:conversation:updated",
  USER_JOINED: "chat:user:joined",
  USER_LEFT: "chat:user:left",
} as const;

/** Notification events */
export const NotificationEvent = {
  NEW: "notification:new",
  READ: "notification:read",
  READ_ALL: "notification:read:all",
  DELETED: "notification:deleted",
  BULK_ACTION: "notification:bulk",
  PREFERENCES_UPDATED: "notification:preferences:updated",
  UNREAD_COUNT: "notification:unread:count",
} as const;

/** Project events */
export const ProjectEvent = {
  CREATED: "project:created",
  UPDATED: "project:updated",
  DELETED: "project:deleted",
  MEMBER_ADDED: "project:member:added",
  MEMBER_REMOVED: "project:member:removed",
  STATUS_CHANGED: "project:status:changed",
  STATS_UPDATED: "project:stats:updated",
} as const;

/** Task events */
export const TaskEvent = {
  CREATED: "task:created",
  UPDATED: "task:updated",
  DELETED: "task:deleted",
  STATUS_CHANGED: "task:status:changed",
  ASSIGNEE_CHANGED: "task:assignee:changed",
  COMMENT_ADDED: "task:comment:added",
  COMMENT_UPDATED: "task:comment:updated",
  COMMENT_DELETED: "task:comment:deleted",
  DUE_DATE_CHANGED: "task:due_date:changed",
  PRIORITY_CHANGED: "task:priority:changed",
  TIME_LOGGED: "task:time:logged",
} as const;

/** Order events */
export const OrderEvent = {
  CREATED: "order:created",
  UPDATED: "order:updated",
  STATUS_CHANGED: "order:status:changed",
  PAYMENT_RECEIVED: "order:payment:received",
  SHIPPED: "order:shipped",
  DELIVERED: "order:delivered",
  CANCELLED: "order:cancelled",
  REFUNDED: "order:refunded",
} as const;

/** Ticket events */
export const TicketEvent = {
  CREATED: "ticket:created",
  UPDATED: "ticket:updated",
  CLOSED: "ticket:closed",
  REOPENED: "ticket:reopened",
  AGENT_ASSIGNED: "ticket:agent:assigned",
  MESSAGE_ADDED: "ticket:message:added",
  PRIORITY_CHANGED: "ticket:priority:changed",
} as const;

/** CMS events */
export const CmsEvent = {
  PAGE_PUBLISHED: "cms:page:published",
  PAGE_UNPUBLISHED: "cms:page:unpublished",
  PAGE_UPDATED: "cms:page:updated",
  PAGE_DELETED: "cms:page:deleted",
  MEDIA_UPLOADED: "cms:media:uploaded",
  MEDIA_DELETED: "cms:media:deleted",
  NAVIGATION_UPDATED: "cms:navigation:updated",
  BLOCK_UPDATED: "cms:block:updated",
} as const;

/** System events */
export const SystemEvent = {
  ANNOUNCEMENT: "system:announcement",
  MAINTENANCE_MODE: "system:maintenance:mode",
  FEATURE_FLAG_CHANGED: "system:feature_flag:changed",
  SERVER_RESTART: "system:server:restart",
  HEALTH_STATUS: "system:health:status",
} as const;

/** Presence events */
export const PresenceEvent = {
  ONLINE: "presence:online",
  OFFLINE: "presence:offline",
  STATUS_CHANGED: "presence:status:changed",
  ACTIVITY_UPDATE: "presence:activity:update",
  HEARTBEAT: "presence:heartbeat",
} as const;

/** AI events */
export const AiEvent = {
  STREAM_START: "ai:stream:start",
  STREAM_TOKEN: "ai:stream:token",
  STREAM_END: "ai:stream:end",
  STREAM_ERROR: "ai:stream:error",
  GENERATION_COMPLETE: "ai:generation:complete",
  AGENT_THINKING: "ai:agent:thinking",
  AGENT_ACTION: "ai:agent:action",
  USAGE_UPDATE: "ai:usage:update",
} as const;

/** Analytics events */
export const AnalyticsEvent = {
  LIVE_VISITOR_COUNT: "analytics:live:visitor_count",
  LIVE_PAGE_VIEW: "analytics:live:page_view",
  METRIC_UPDATE: "analytics:metric:update",
  ALERT_TRIGGERED: "analytics:alert:triggered",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Authenticated socket user identity */
export interface WsUser {
  userId: string;
  tenantId: string;
  organizationId?: string;
  roles: string[];
  permissions: string[];
  displayName: string;
  avatarUrl?: string;
}

/** Extended socket with user data */
export interface AuthenticatedSocket extends Socket {
  wsUser: WsUser;
}

/** Chat message payload */
export interface ChatMessagePayload {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  contentType: "text" | "image" | "file" | "system";
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Typing indicator payload */
export interface TypingPayload {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

/** Read receipt payload */
export interface ReadReceiptPayload {
  conversationId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

/** Notification payload */
export interface NotificationPayload {
  notificationId: string;
  userId: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  icon?: string;
  image?: string;
  createdAt: string;
  readAt?: string;
}

/** Presence payload */
export interface PresencePayload {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: "online" | "away" | "busy" | "offline";
  lastSeenAt: string;
  currentRoom?: string;
  activity?: string;
}

/** Room subscription info */
export interface RoomInfo {
  room: string;
  type: WsDomain;
  joinedAt: string;
}

/** WebSocket gateway configuration */
export interface WsGatewayConfig {
  corsOrigin: string | string[];
  pingInterval: number;
  pingTimeout: number;
  maxPayloadBytes: number;
  redisAdapterEnabled: boolean;
  authRequired: boolean;
  jwtSecret: Uint8Array;
  maxConnectionsPerUser: number;
  connectionRateLimitWindowMs: number;
  connectionRateLimitMax: number;
}

/** AI stream event payload */
export interface AiStreamPayload {
  streamId: string;
  userId: string;
  provider: string;
  model: string;
  token?: string;
  fullText?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** System announcement */
export interface AnnouncementPayload {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  targetRoles?: string[];
  targetTenants?: string[];
  expiresAt?: string;
  actionUrl?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function buildWsConfig(): WsGatewayConfig {
  const jwtSecretStr = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "nexus-dev-secret-change-me";
  const jwtSecret = new TextEncoder().encode(jwtSecretStr);

  const corsOriginRaw = process.env.WS_CORS_ORIGIN || "*";
  const corsOrigin = corsOriginRaw === "*" ? "*" : corsOriginRaw.split(",").map((s) => s.trim());

  return {
    corsOrigin,
    pingInterval: Number(process.env.WS_PING_INTERVAL_MS || 25000),
    pingTimeout: Number(process.env.WS_PING_TIMEOUT_MS || 20000),
    maxPayloadBytes: Number(process.env.WS_MAX_PAYLOAD_MB || 1) * 1024 * 1024,
    redisAdapterEnabled: process.env.WS_REDIS_ADAPTER_ENABLED === "true",
    authRequired: process.env.WS_AUTH_REQUIRED !== "false",
    jwtSecret,
    maxConnectionsPerUser: Number(process.env.WS_MAX_CONNS_PER_USER || 5),
    connectionRateLimitWindowMs: Number(process.env.WS_RATE_LIMIT_WINDOW_MS || 10000),
    connectionRateLimitMax: Number(process.env.WS_RATE_LIMIT_MAX || 10),
  };
}

// ---------------------------------------------------------------------------
// Room Name Builders
// ---------------------------------------------------------------------------

/**
 * Build standardized room names with tenant isolation.
 * Pattern: {tenantId}:{domain}:{entityId}
 */

export function buildUserRoom(tenantId: string, userId: string): string {
  return `${tenantId}:user:${userId}`;
}

export function buildOrganizationRoom(tenantId: string, orgId: string): string {
  return `${tenantId}:org:${orgId}`;
}

export function buildProjectRoom(tenantId: string, projectId: string): string {
  return `${tenantId}:project:${projectId}`;
}

export function buildTaskRoom(tenantId: string, taskId: string): string {
  return `${tenantId}:task:${taskId}`;
}

export function buildOrderRoom(tenantId: string, orderId: string): string {
  return `${tenantId}:order:${orderId}`;
}

export function buildTicketRoom(tenantId: string, ticketId: string): string {
  return `${tenantId}:ticket:${ticketId}`;
}

export function buildConversationRoom(tenantId: string, conversationId: string): string {
  return `${tenantId}:conversation:${conversationId}`;
}

export function buildAdminRoom(tenantId: string): string {
  return `${tenantId}:admin`;
}

export function buildPublicRoom(tenantId: string): string {
  return `${tenantId}:public`;
}

export function buildAiStreamRoom(tenantId: string, streamId: string): string {
  return `${tenantId}:ai:stream:${streamId}`;
}

/**
 * Build a wildcard room name for broadcasting to all users in a tenant.
 */
export function buildTenantBroadcastRoom(tenantId: string): string {
  return `${tenantId}:*`;
}

// ---------------------------------------------------------------------------
// JWT Verification
// ---------------------------------------------------------------------------

async function verifyToken(
  token: string,
  secret: Uint8Array,
): Promise<WsUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256", "HS384", "HS512"],
    });

    const p = payload as JWTPayload & {
      sub?: string;
      userId?: string;
      tenantId?: string;
      organizationId?: string;
      roles?: string | string[];
      permissions?: string | string[];
      name?: string;
      email?: string;
      picture?: string;
    };

    const roles = typeof p.roles === "string" ? [p.roles] : (p.roles || []);
    const permissions = typeof p.permissions === "string" ? [p.permissions] : (p.permissions || []);

    return {
      userId: p.sub || p.userId || "",
      tenantId: p.tenantId || "default",
      organizationId: p.organizationId,
      roles,
      permissions,
      displayName: p.name || p.email || p.sub || "Unknown",
      avatarUrl: p.picture,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Connection Rate Limiter (in-memory)
// ---------------------------------------------------------------------------

interface ConnectionRecord {
  count: number;
  windowStart: number;
}

const connectionRateMap = new Map<string, ConnectionRecord>();

function checkConnectionRate(ip: string, config: WsGatewayConfig): boolean {
  const now = Date.now();
  const record = connectionRateMap.get(ip);

  if (!record || now - record.windowStart > config.connectionRateLimitWindowMs) {
    connectionRateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= config.connectionRateLimitMax) {
    return false;
  }

  record.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Per-User Connection Tracking
// ---------------------------------------------------------------------------

const userConnections = new Map<string, Set<string>>();

function trackUserConnection(userId: string, socketId: string): void {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(socketId);
}

function untrackUserConnection(userId: string, socketId: string): void {
  const sockets = userConnections.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userConnections.delete(userId);
    }
  }
}

function getUserConnectionCount(userId: string): number {
  return userConnections.get(userId)?.size || 0;
}

// ---------------------------------------------------------------------------
// Global IO Instance
// ---------------------------------------------------------------------------

const globalForWs = globalThis as unknown as {
  __io: Server | undefined;
  __config: WsGatewayConfig | undefined;
  __initialized: boolean;
};

// ---------------------------------------------------------------------------
// Socket Handler Registration
// ---------------------------------------------------------------------------

function registerSocketHandlers(socket: AuthenticatedSocket, io: Server): void {
  const { wsUser } = socket;
  const { tenantId, userId, organizationId, displayName, avatarUrl } = wsUser;

  // Track connection
  trackUserConnection(userId, socket.id);

  // ── Join core rooms ──────────────────────────────────────────────
  socket.join(buildUserRoom(tenantId, userId));

  if (organizationId) {
    socket.join(buildOrganizationRoom(tenantId, organizationId));
  }

  // Public tenant room (announcements, system-wide)
  socket.join(buildPublicRoom(tenantId));

  // Admin users join admin room
  if (wsUser.roles.includes("admin") || wsUser.roles.includes("superadmin")) {
    socket.join(buildAdminRoom(tenantId));
  }

  // ── Presence: Announce online ────────────────────────────────────
  const presencePayload: PresencePayload = {
    userId,
    displayName,
    avatarUrl,
    status: "online",
    lastSeenAt: new Date().toISOString(),
  };

  socket.broadcast.to(buildPublicRoom(tenantId)).emit(PresenceEvent.ONLINE, presencePayload);

  // Send current online users in tenant
  notifyPresenceUpdate(io, tenantId);

  // ── Chat: conversation management ────────────────────────────────
  socket.on(ChatEvent.MESSAGE_SEND, (payload: ChatMessagePayload) => {
    const room = buildConversationRoom(tenantId, payload.conversationId);
    io.to(room).emit(ChatEvent.MESSAGE_RECEIVED, {
      ...payload,
      serverTimestamp: new Date().toISOString(),
    });

    // Also emit to sender's personal room for multi-device sync
    socket.to(buildUserRoom(tenantId, userId)).emit(ChatEvent.MESSAGE_RECEIVED, {
      ...payload,
      serverTimestamp: new Date().toISOString(),
    });
  });

  socket.on(ChatEvent.TYPING_START, (payload: TypingPayload) => {
    const room = buildConversationRoom(tenantId, payload.conversationId);
    socket.to(room).emit(ChatEvent.TYPING_START, { ...payload, isTyping: true });
  });

  socket.on(ChatEvent.TYPING_STOP, (payload: TypingPayload) => {
    const room = buildConversationRoom(tenantId, payload.conversationId);
    socket.to(room).emit(ChatEvent.TYPING_STOP, { ...payload, isTyping: false });
  });

  socket.on(ChatEvent.READ_RECEIPT, (payload: ReadReceiptPayload) => {
    const room = buildConversationRoom(tenantId, payload.conversationId);
    socket.to(room).emit(ChatEvent.READ_RECEIPT, payload);
    // Sync to sender's other devices
    socket.to(buildUserRoom(tenantId, userId)).emit(ChatEvent.READ_RECEIPT, payload);
  });

  socket.on(ChatEvent.MESSAGE_UPDATED, (payload: ChatMessagePayload) => {
    const room = buildConversationRoom(tenantId, payload.conversationId);
    socket.to(room).emit(ChatEvent.MESSAGE_UPDATED, payload);
  });

  socket.on(ChatEvent.MESSAGE_DELETED, (payload: { conversationId: string; messageId: string }) => {
    const room = buildConversationRoom(tenantId, payload.conversationId);
    socket.to(room).emit(ChatEvent.MESSAGE_DELETED, payload);
  });

  // ── Join/Leave conversation rooms ────────────────────────────────
  socket.on("room:join", (roomName: string) => {
    if (typeof roomName === "string" && roomName.startsWith(`${tenantId}:`)) {
      socket.join(roomName);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[ws] ${displayName} (${userId}) joined room: ${roomName}`);
      }
    }
  });

  socket.on("room:leave", (roomName: string) => {
    if (typeof roomName === "string") {
      socket.leave(roomName);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[ws] ${displayName} (${userId}) left room: ${roomName}`);
      }
    }
  });

  // ── Presence: Heartbeat ──────────────────────────────────────────
  socket.on(PresenceEvent.HEARTBEAT, (data?: { activity?: string }) => {
    const update: PresencePayload = {
      userId,
      displayName,
      avatarUrl,
      status: "online",
      lastSeenAt: new Date().toISOString(),
      activity: data?.activity,
    };
    socket.broadcast.to(buildPublicRoom(tenantId)).emit(PresenceEvent.STATUS_CHANGED, update);
  });

  // ── Notification read acknowledgements ───────────────────────────
  socket.on(NotificationEvent.READ, (payload: { notificationId: string }) => {
    socket.to(buildUserRoom(tenantId, userId)).emit(NotificationEvent.READ, {
      notificationId: payload.notificationId,
      userId,
      readAt: new Date().toISOString(),
    });
  });

  socket.on(NotificationEvent.READ_ALL, () => {
    socket.to(buildUserRoom(tenantId, userId)).emit(NotificationEvent.READ_ALL, {
      userId,
      readAt: new Date().toISOString(),
    });
  });

  // ── Disconnect ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    untrackUserConnection(userId, socket.id);

    const remainingConnections = getUserConnectionCount(userId);

    if (remainingConnections === 0) {
      // User fully offline
      const offlinePayload: PresencePayload = {
        userId,
        displayName,
        avatarUrl,
        status: "offline",
        lastSeenAt: new Date().toISOString(),
      };
      io.to(buildPublicRoom(tenantId)).emit(PresenceEvent.OFFLINE, offlinePayload);
    }

    notifyPresenceUpdate(io, tenantId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[ws] ${displayName} (${userId}) disconnected (remaining: ${remainingConnections})`);
    }
  });
}

// ---------------------------------------------------------------------------
// Presence Helpers
// ---------------------------------------------------------------------------

async function notifyPresenceUpdate(io: Server, tenantId: string): Promise<void> {
  try {
    const sockets = await io.in(buildPublicRoom(tenantId)).fetchSockets();
    const onlineUsers = new Map<string, PresencePayload>();

    for (const s of sockets) {
      const authSocket = s as AuthenticatedSocket;
      if (authSocket.wsUser) {
        const u = authSocket.wsUser;
        onlineUsers.set(u.userId, {
          userId: u.userId,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          status: "online",
          lastSeenAt: new Date().toISOString(),
        });
      }
    }

    io.to(buildPublicRoom(tenantId)).emit("presence:list", {
      onlineCount: onlineUsers.size,
      users: Array.from(onlineUsers.values()),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // fetchSockets may fail if Redis adapter is temporarily unavailable
  }
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Create and attach a Socket.IO server to an existing HTTP server.
 *
 * Usage in custom server.ts:
 *
 * import { createServer } from "http";
 * import { parse } from "url";
 * import next from "next";
 * import { createWebSocketServer } from "@/lib/websocket";
 *
 * const app = next({ dev });
 * const handle = app.getRequestHandler();
 *
 * app.prepare().then(() => {
 *   const server = createServer((req, res) => {
 *     handle(req, res, parse(req.url!, true));
 *   });
 *
 *   createWebSocketServer(server);
 *
 *   server.listen(3000);
 * });
 *
 */
export function createWebSocketServer(
  httpServer: HttpServer | HttpsServer,
  opts?: { config?: Partial<WsGatewayConfig> },
): Server {
  if (globalForWs.__io) {
    return globalForWs.__io;
  }

  const baseConfig = buildWsConfig();
  const config: WsGatewayConfig = { ...baseConfig, ...opts?.config };

  globalForWs.__config = config;

  const pingInterval = config.pingInterval;
  const pingTimeout = config.pingTimeout;

  const io = new Server(httpServer, {
    path: WS_NAMESPACE,
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval,
    pingTimeout,
    maxHttpBufferSize: config.maxPayloadBytes,
    connectTimeout: 45000,
    transports: ["websocket", "polling"],
    allowEIO3: false,
    serveClient: false,
    cookie: false,
  });

  // ── Redis Adapter (optional, for horizontal scaling) ────────────
  if (config.redisAdapterEnabled) {
    try {
      const pubClient = getRedisClient().duplicate();
      const subClient = getRedisClient().duplicate();

      io.adapter(createAdapter(pubClient, subClient));

      if (process.env.NODE_ENV !== "production") {
        console.log("[ws] Redis adapter enabled for horizontal scaling");
      }
    } catch (err) {
      console.warn(
        "[ws] Failed to initialize Redis adapter, falling back to in-memory:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── Authentication Middleware ────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string }).token ||
        (socket.handshake.query as { token?: string }).token;

      if (!config.authRequired) {
        // Anonymous access — assign a guest identity
        (socket as AuthenticatedSocket).wsUser = {
          userId: `guest-${socket.id}`,
          tenantId: "default",
          roles: ["guest"],
          permissions: [],
          displayName: "Guest",
        };
        return next();
      }

      if (!token || typeof token !== "string") {
        return next(new Error("AUTH_REQUIRED: Missing authentication token"));
      }

      const wsUser = await verifyToken(token, config.jwtSecret);

      if (!wsUser) {
        return next(new Error("AUTH_INVALID: Invalid or expired token"));
      }

      (socket as AuthenticatedSocket).wsUser = wsUser;

      // Rate limit per IP
      const clientIp =
        socket.handshake.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        socket.handshake.address ||
        "unknown";

      if (!checkConnectionRate(clientIp, config)) {
        return next(new Error("RATE_LIMITED: Too many connection attempts"));
      }

      // Per-user connection limit
      const currentConns = getUserConnectionCount(wsUser.userId);
      if (currentConns >= config.maxConnectionsPerUser) {
        return next(new Error("CONNECTION_LIMIT: Maximum connections per user reached"));
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[ws] ${wsUser.displayName} (${wsUser.userId}) authenticated`);
      }

      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown authentication error";
      next(new Error(`AUTH_ERROR: ${message}`));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────
  io.on("connection", (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;

    if (!socket.wsUser) {
      socket.disconnect(true);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[ws] ${socket.wsUser.displayName} connected (${socket.id}) [tenant: ${socket.wsUser.tenantId}]`,
      );
    }

    registerSocketHandlers(socket, io);
  });

  // ── Error Handling ──────────────────────────────────────────────
  io.engine.on("connection_error", (err) => {
    const req = (err as { req?: { url?: string; headers?: Record<string, string> } }).req;
    const clientIp = req?.headers?.["x-forwarded-for"] || "unknown";
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ws] connection error from ${clientIp}:`, err.message);
    }
  });

  globalForWs.__io = io;
  globalForWs.__initialized = true;

  if (process.env.NODE_ENV !== "production") {
    console.log("[ws] WebSocket gateway initialized");
  }

  return io;
}

// ---------------------------------------------------------------------------
// Getter for the IO Instance
// ---------------------------------------------------------------------------

/**
 * Returns the shared Socket.IO server instance.
 * Throws if the server hasn't been created yet.
 */
export function getIO(): Server {
  if (!globalForWs.__io) {
    throw new Error(
      "WebSocket gateway not initialized. Call createWebSocketServer() first during server startup.",
    );
  }
  return globalForWs.__io;
}

/**
 * Safely returns the IO instance, or null if not initialized.
 */
export function getIoSafe(): Server | null {
  return globalForWs.__io || null;
}

// ---------------------------------------------------------------------------
// Server-Side Emit Helpers
// ---------------------------------------------------------------------------

/**
 * Emit a chat message to a conversation room from server-side code.
 */
export function emitChatMessage(tenantId: string, payload: ChatMessagePayload): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildConversationRoom(tenantId, payload.conversationId);
  io.to(room).emit(ChatEvent.MESSAGE_RECEIVED, {
    ...payload,
    serverTimestamp: new Date().toISOString(),
  });
}

/**
 * Emit a notification to a specific user.
 */
export function emitNotification(tenantId: string, userId: string, payload: NotificationPayload): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildUserRoom(tenantId, userId);
  io.to(room).emit(NotificationEvent.NEW, payload);
}

/**
 * Emit notifications to multiple users at once.
 */
export function emitNotificationBulk(
  tenantId: string,
  userIds: string[],
  payload: NotificationPayload,
): void {
  const io = getIoSafe();
  if (!io) return;
  for (const userId of userIds) {
    const room = buildUserRoom(tenantId, userId);
    io.to(room).emit(NotificationEvent.NEW, payload);
  }
}

/**
 * Emit a project update.
 */
export function emitProjectEvent(
  tenantId: string,
  projectId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildProjectRoom(tenantId, projectId);
  io.to(room).emit(event, { projectId, ...payload, timestamp: new Date().toISOString() });
}

/**
 * Emit a task update.
 */
export function emitTaskEvent(
  tenantId: string,
  taskId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildTaskRoom(tenantId, taskId);
  io.to(room).emit(event, { taskId, ...payload, timestamp: new Date().toISOString() });
}

/**
 * Emit an order update.
 */
export function emitOrderEvent(
  tenantId: string,
  orderId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildOrderRoom(tenantId, orderId);
  io.to(room).emit(event, { orderId, ...payload, timestamp: new Date().toISOString() });
}

/**
 * Emit a ticket update.
 */
export function emitTicketEvent(
  tenantId: string,
  ticketId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildTicketRoom(tenantId, ticketId);
  io.to(room).emit(event, { ticketId, ...payload, timestamp: new Date().toISOString() });
}

/**
 * Emit a CMS event.
 */
export function emitCmsEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const io = getIoSafe();
  if (!io) return;
  io.to(buildAdminRoom(tenantId)).emit(event, { ...payload, timestamp: new Date().toISOString() });
}

/**
 * Broadcast a system announcement to all users in a tenant.
 */
export function emitAnnouncement(tenantId: string, payload: AnnouncementPayload): void {
  const io = getIoSafe();
  if (!io) return;

  // If target roles specified, send to admin room; otherwise broadcast
  if (payload.targetRoles?.length) {
    io.to(buildAdminRoom(tenantId)).emit(SystemEvent.ANNOUNCEMENT, payload);
  } else {
    io.to(buildPublicRoom(tenantId)).emit(SystemEvent.ANNOUNCEMENT, payload);
  }
}

/**
 * Emit an AI stream token to a specific user.
 */
export function emitAiStreamToken(
  tenantId: string,
  userId: string,
  payload: AiStreamPayload,
): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildUserRoom(tenantId, userId);
  io.to(room).emit(AiEvent.STREAM_TOKEN, payload);
}

/**
 * Emit live analytics data.
 */
export function emitAnalyticsEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const io = getIoSafe();
  if (!io) return;
  io.to(buildAdminRoom(tenantId)).emit(event, { ...payload, timestamp: new Date().toISOString() });
}

/**
 * Emit unread notification count to a specific user.
 */
export function emitUnreadCount(
  tenantId: string,
  userId: string,
  count: number,
): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildUserRoom(tenantId, userId);
  io.to(room).emit(NotificationEvent.UNREAD_COUNT, { userId, count, timestamp: new Date().toISOString() });
}

/**
 * Force-disconnect a user (admin action).
 */
export function disconnectUser(tenantId: string, userId: string): void {
  const io = getIoSafe();
  if (!io) return;
  const room = buildUserRoom(tenantId, userId);

  io.in(room).fetchSockets().then((sockets) => {
    for (const socket of sockets) {
      socket.emit(SystemEvent.ANNOUNCEMENT, {
        id: "force-disconnect",
        title: "Session Terminated",
        body: "Your session has been terminated by an administrator.",
        severity: "warning" as const,
      });
      socket.disconnect(true);
    }
  }).catch(() => {
    // Silently ignore errors
  });
}

// ---------------------------------------------------------------------------
// Stats & Health Check
// ---------------------------------------------------------------------------

/**
 * Get basic stats about the WebSocket gateway.
 */
export async function getWsStats(): Promise<{
  connected: boolean;
  totalSockets: number;
  rooms: number;
  uptime: number;
}> {
  const io = getIoSafe();
  if (!io) {
    return { connected: false, totalSockets: 0, rooms: 0, uptime: 0 };
  }

  try {
    const sockets = await io.fetchSockets();
    const allRooms = io.sockets.adapter.rooms;
    const roomCount = allRooms.size;

    return {
      connected: true,
      totalSockets: sockets.length,
      rooms: roomCount,
      uptime: process.uptime(),
    };
  } catch {
    return { connected: false, totalSockets: 0, rooms: 0, uptime: process.uptime() };
  }
}

/**
 * Health check for the WebSocket gateway.
 */
export async function pingWebSocket(): Promise<boolean> {
  const io = getIoSafe();
  if (!io) return false;

  try {
    await io.fetchSockets();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get connected users count per tenant.
 */
export async function getTenantConnectionCount(tenantId: string): Promise<number> {
  const io = getIoSafe();
  if (!io) return 0;

  try {
    const sockets = await io.in(buildPublicRoom(tenantId)).fetchSockets();
    return sockets.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

/**
 * Gracefully close the WebSocket gateway.
 * Call during SIGTERM / SIGINT handler before shutting down the HTTP server.
 */
export async function closeWebSocketGateway(): Promise<void> {
  const io = globalForWs.__io;
  if (!io) return;

  // Notify all connected clients
  io.emit(SystemEvent.SERVER_RESTART, {
    message: "Server is shutting down for maintenance.",
    timestamp: new Date().toISOString(),
  });

  // Close all connections gracefully
  await io.close();

  globalForWs.__io = undefined;
  globalForWs.__initialized = false;
  userConnections.clear();
  connectionRateMap.clear();

  if (process.env.NODE_ENV !== "production") {
    console.log("[ws] WebSocket gateway closed");
  }
}

// ---------------------------------------------------------------------------
// Event Registry (for documentation / discovery)
// ---------------------------------------------------------------------------

export const WS_EVENT_REGISTRY = {
  chat: ChatEvent,
  notification: NotificationEvent,
  project: ProjectEvent,
  task: TaskEvent,
  order: OrderEvent,
  ticket: TicketEvent,
  cms: CmsEvent,
  system: SystemEvent,
  presence: PresenceEvent,
  ai: AiEvent,
  analytics: AnalyticsEvent,
  domains: WsDomain,
} as const;

/**
 * All known outbound events (for client-side subscription).
 */
export const ALL_EVENTS = [
  ...Object.values(ChatEvent),
  ...Object.values(NotificationEvent),
  ...Object.values(ProjectEvent),
  ...Object.values(TaskEvent),
  ...Object.values(OrderEvent),
  ...Object.values(TicketEvent),
  ...Object.values(CmsEvent),
  ...Object.values(SystemEvent),
  ...Object.values(PresenceEvent),
  ...Object.values(AiEvent),
  ...Object.values(AnalyticsEvent),
] as const;

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const websocket = {
  // Lifecycle
  create: createWebSocketServer,
  close: closeWebSocketGateway,
  getIO,
  getIoSafe,

  // Health & Stats
  ping: pingWebSocket,
  stats: getWsStats,
  tenantConnections: getTenantConnectionCount,

  // Room builders
  rooms: {
    user: buildUserRoom,
    organization: buildOrganizationRoom,
    project: buildProjectRoom,
    task: buildTaskRoom,
    order: buildOrderRoom,
    ticket: buildTicketRoom,
    conversation: buildConversationRoom,
    admin: buildAdminRoom,
    public: buildPublicRoom,
    aiStream: buildAiStreamRoom,
    tenantBroadcast: buildTenantBroadcastRoom,
  },

  // Server-side emitters
  emit: {
    chatMessage: emitChatMessage,
    notification: emitNotification,
    notificationBulk: emitNotificationBulk,
    projectEvent: emitProjectEvent,
    taskEvent: emitTaskEvent,
    orderEvent: emitOrderEvent,
    ticketEvent: emitTicketEvent,
    cmsEvent: emitCmsEvent,
    announcement: emitAnnouncement,
    aiStreamToken: emitAiStreamToken,
    analyticsEvent: emitAnalyticsEvent,
    unreadCount: emitUnreadCount,
    disconnectUser,
  },

  // User connection tracking
  getUserConnections: getUserConnectionCount,

  // Event registry
  events: WS_EVENT_REGISTRY,
  allEvents: ALL_EVENTS,
} as const;

export default websocket;