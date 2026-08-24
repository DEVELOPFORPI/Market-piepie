/**
 * MarketPiePie API Server
 * DATABASE_URL ? ??????? DB ???? /api/health ?? ??????????????.
 */
require("dotenv").config();
const _dns = require("dns");
const _origLookup = _dns.lookup;
_dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  _origLookup.call(_dns, hostname, options, (err, address, family) => {
    if (err && err.code === "ENOTFOUND") {
      _dns.resolve6(hostname, (err6, addresses) => {
        if (!err6 && addresses && addresses.length > 0) {
          callback(null, addresses[0], 6);
        } else {
          callback(err);
        }
      });
    } else {
      callback(err, address, family);
    }
  });
};

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const xss = require("xss");
const { createDbPool, jsonObjectSql } = require("./db");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

function sanitize(val) {
  if (typeof val === "string") return xss(val);
  if (Array.isArray(val)) return val.map(sanitize);
  if (val && typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = sanitize(v);
    return out;
  }
  return val;
}

const TEXT_LIMIT = {
  listingTitle: 40,
  listingDescription: 2000,
  postTitle: 40,
  postBody: 2000,
  inquiryTitle: 40,
  inquiryContent: 1000,
  inquiryEmail: 255,
  meetupPlace: 50,
  comment: 300,
  receiptNotes: 200,
  reviewComment: 500,
  reportDetails: 500,
  chatMessage: 1000,
  disputeDetails: 1000,
};

function clipText(value, max) {
  if (value == null) return value;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

function clipUserChatContent(content, type) {
  const kind = type || "text";
  if (kind !== "text" && kind !== "user") return content;
  return clipText(content, TEXT_LIMIT.chatMessage);
}

const MAX_CHAT_IMAGES = 5;
function clipChatImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map(String).filter(Boolean).slice(0, MAX_CHAT_IMAGES);
}

const PORT = Number(process.env.PORT) || 3001;
const app = express();
// Browser -> Vercel rewrite -> Nginx -> Express.
// Trust both proxy hops so req.ip resolves to the actual client instead of
// Vercel's shared egress IP (which made unrelated users share one rate limit).
app.set("trust proxy", 2);

const R2_MAX_UPLOAD_MB = Number(process.env.R2_MAX_UPLOAD_MB || 8);
const R2_MAX_UPLOAD_BYTES = Math.max(1, R2_MAX_UPLOAD_MB) * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
let r2Client = null;

function trimSlashes(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

function normalizePublicBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function encodeKeyPath(key) {
  return String(key || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function requestBaseUrl(req) {
  const configured = normalizePublicBaseUrl(
    process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      "",
  );
  if (configured) return configured;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

function imageUrlForKey(req, config, key) {
  if (config.publicBaseUrl) return `${config.publicBaseUrl}/${key}`;
  return `${requestBaseUrl(req)}/api/uploads/object/${encodeKeyPath(key)}`;
}

function safePathSegment(value, fallback) {
  const cleaned = trimSlashes(value || fallback)
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-"))
    .filter(Boolean)
    .join("/");
  return cleaned || fallback;
}

function extensionForMime(mimeType, originalName = "") {
  const fromName = String(originalName).toLowerCase().match(/\.(avif|gif|jpe?g|png|webp)$/);
  if (fromName) return fromName[0] === ".jpeg" ? ".jpg" : fromName[0];
  const map = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  return map[mimeType] || ".jpg";
}

function getR2Config() {
  const accountId =
    process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || "";
  const endpoint =
    process.env.R2_ENDPOINT ||
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucket =
    process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || "";
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    "";
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    "";
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
  );
  const region = process.env.R2_REGION || "auto";

  const missing = [];
  if (!endpoint) missing.push("R2_ENDPOINT or R2_ACCOUNT_ID");
  if (!bucket) missing.push("R2_BUCKET");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");

  return {
    ok: missing.length === 0,
    missing,
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    region,
    uploadPrefix: safePathSegment(process.env.R2_UPLOAD_PREFIX || "uploads", "uploads"),
  };
}

function getR2Client() {
  const config = getR2Config();
  if (!config.ok) {
    const err = new Error(`R2 is not configured: ${config.missing.join(", ")}`);
    err.statusCode = 503;
    throw err;
  }
  if (!r2Client) {
    r2Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }
  return { client: r2Client, config };
}

// ????????? ?????? ???????? (DB ???, ????? ???? ?????) ??????????????????????????????????????????
const sessionCache = new Map();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7?
/**
 * 사용 중인 세션은 만료 시각을 뒤로 미뤄 재로그인을 요구하지 않는다.
 * 매 요청마다 쓰지 않도록 발급/갱신 후 하루가 지난 세션만 갱신한다.
 */
const SESSION_TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;

function touchSession(token, session) {
  if (Date.now() - session.createdAt < SESSION_TOUCH_AFTER_MS) return;
  session.createdAt = Date.now();
  if (pool) {
    pool
      .query(
        "UPDATE sessions SET created_at = CURRENT_TIMESTAMP(3) WHERE token = $1",
        [token],
      )
      .catch(() => {});
  }
}

function purgeSessionCacheForUser(userId) {
  for (const [token, session] of sessionCache) {
    if (session.userId === userId) sessionCache.delete(token);
  }
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  purgeSessionCacheForUser(userId);
  if (pool) {
    try {
      await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await pool.query(
        "INSERT INTO sessions (token, user_id) VALUES ($1, $2)",
        [token, userId],
      );
    } catch {}
  }
  sessionCache.set(token, { userId, createdAt: Date.now() });
  return token;
}

async function getAccountStatus(userId) {
  if (!pool || !userId) return { accountStatus: "active", suspensionReason: null };
  try {
    const { rows } = await pool.query(
      "SELECT account_status, suspension_reason FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    const accountStatus = rows[0]?.account_status || "active";
    return {
      accountStatus,
      suspensionReason:
        accountStatus === "suspended" ? rows[0]?.suspension_reason || null : null,
    };
  } catch (e) {
    if (/account_status|Unknown column/i.test(String(e.message))) {
      return { accountStatus: "active", suspensionReason: null };
    }
    return { accountStatus: "active", suspensionReason: null };
  }
}

/** Pi @username — admin/DB only; users row is created on verification payment */
function isGuestId(id) {
  return typeof id === "string" && id.startsWith("guest_");
}

async function upsertGuest(guestId, { deviceId, region } = {}) {
  if (!pool || !isGuestId(guestId)) return;
  try {
    await pool.query(
      `INSERT INTO guests (id, device_id, region, last_seen_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         device_id = COALESCE($2, device_id),
         region = COALESCE($3, region),
         last_seen_at = CURRENT_TIMESTAMP(3)`,
      [guestId, deviceId || null, region || null],
    );
  } catch (e) {
    console.warn("[guests] upsert failed:", e.message);
  }
}

async function linkGuestToPi(guestId, piUid, piUsername) {
  if (!pool || !isGuestId(guestId) || !piUid) return;
  try {
    await pool.query(
      `UPDATE guests
       SET pi_uid = $1,
           pi_username = COALESCE($2, pi_username),
           last_seen_at = CURRENT_TIMESTAMP(3)
       WHERE id = $3 AND converted_user_id IS NULL`,
      [piUid, piUsername || null, guestId],
    );
  } catch (e) {
    console.warn("[guests] link Pi failed:", e.message);
  }
}

async function promoteGuestToUser(piUid, piUsername) {
  if (!pool || !piUid) return;
  const username =
    typeof piUsername === "string" && piUsername.trim()
      ? piUsername.trim()
      : null;
  // guests 조회가 실패해도 users 생성은 반드시 시도해야 한다
  let guest = null;
  try {
    const { rows } = await pool.query(
      `SELECT id, pi_username FROM guests
       WHERE pi_uid = $1 AND converted_user_id IS NULL
       ORDER BY last_seen_at DESC LIMIT 1`,
      [piUid],
    );
    guest = rows[0] || null;
  } catch (e) {
    console.warn("[guests] lookup failed (continuing):", e.message);
  }

  const resolvedUsername = username || guest?.pi_username || null;
  try {
    await pool.query(
      `INSERT INTO users (id, nickname, pi_username, pi_verified, kyc_status)
       VALUES ($1, $1, $2, true, 'verified')
       ON DUPLICATE KEY UPDATE
         pi_verified = true,
         kyc_status = 'verified',
         pi_username = COALESCE($2, users.pi_username)`,
      [piUid, resolvedUsername],
    );
    console.log("[users] promoted to verified user:", piUid);
  } catch (e) {
    console.error("[users] promote INSERT failed:", piUid, e.message);
    return;
  }

  if (guest?.id) {
    try {
      await pool.query(
        "UPDATE guests SET converted_user_id = $1 WHERE id = $2",
        [piUid, guest.id],
      );
    } catch (e) {
      console.warn("[guests] convert mark failed:", e.message);
    }
  }
}

function stripPrivateUserFields(row) {
  if (!row || typeof row !== "object") return row;
  const { pi_username, ...publicUser } = row;
  return publicUser;
}

async function getUserIdFromToken(token) {
  if (!token) return null;
  const cached = sessionCache.get(token);
  if (cached) {
    if (Date.now() - cached.createdAt > SESSION_TTL_MS) {
      sessionCache.delete(token);
      if (pool)
        pool
          .query("DELETE FROM sessions WHERE token=$1", [token])
          .catch(() => {});
      return null;
    }
    touchSession(token, cached);
    return cached.userId;
  }
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      "SELECT user_id, created_at FROM sessions WHERE token=$1",
      [token],
    );
    if (!rows.length) return null;
    const age = Date.now() - new Date(rows[0].created_at).getTime();
    if (age > SESSION_TTL_MS) {
      pool
        .query("DELETE FROM sessions WHERE token=$1", [token])
        .catch(() => {});
      return null;
    }
    const session = {
      userId: rows[0].user_id,
      createdAt: new Date(rows[0].created_at).getTime(),
    };
    sessionCache.set(token, session);
    touchSession(token, session);
    return session.userId;
  } catch {
    return null;
  }
}

setInterval(
  () => {
    const now = Date.now();
    for (const [token, session] of sessionCache) {
      if (now - session.createdAt > SESSION_TTL_MS) sessionCache.delete(token);
    }
    if (pool)
      pool
        .query(
          "DELETE FROM sessions WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)",
        )
        .catch(() => {});
  },
  60 * 60 * 1000,
);

// ????????? ?? ?????????? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
async function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    req.authUserId = await getUserIdFromToken(auth.slice(7));
  }
  next();
}

// 개인 데이터(주문·채팅·알림·찜)는 세션이 있어야만 접근할 수 있다.
// requireAuth 는 users 행을 요구해 게스트 세션을 막으므로, 조회 계열에는
// 세션 주체만 확인하는 아래 헬퍼를 쓴다.
function requireSession(req, res) {
  if (!req.authUserId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

/** 요청에 담긴 대상 id 중 하나라도 본인이 아니면 403. */
function denyOtherUser(req, res, ...ids) {
  for (const id of ids) {
    if (id && id !== req.authUserId) {
      res.status(403).json({ error: "Forbidden" });
      return true;
    }
  }
  return false;
}

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userId = await getUserIdFromToken(auth.slice(7));
  if (!userId)
    return res.status(401).json({ error: "Invalid or expired session" });
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT account_status FROM users WHERE id = $1 LIMIT 1",
        [userId],
      );
      if (!rows.length)
        return res.status(401).json({ error: "User not found" });
      if (rows[0].account_status === "suspended")
        return res.status(403).json({ error: "Account suspended" });
    } catch (e) {
      if (!/account_status|Unknown column/i.test(String(e.message))) {
        return res.status(500).json({ error: "Could not verify account status" });
      }
    }
  }
  req.authUserId = userId;
  next();
}

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://marketpiepietest.vercel.app",
  "https://marketpiepie.vercel.app",
  "https://blindlounge.xyz",
  "https://www.blindlounge.xyz",
  "https://pie.blindlounge.xyz",
  "https://www.pie.blindlounge.xyz",
];
const envAllowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [];
const allowAnyOrigin = envAllowedOrigins.includes("*");
const allowedOrigins = Array.from(
  new Set(
    [...defaultAllowedOrigins, ...envAllowedOrigins].filter(
      (origin) => origin !== "*",
    ),
  ),
);
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowAnyOrigin || allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}
function corsOptionsDelegate(req, callback) {
  const origin = req.header("Origin");
  callback(null, {
    origin: isAllowedOrigin(origin) ? origin || false : false,
    credentials: true,
  });
}
app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: "10mb" }));
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") req.body = sanitize(req.body);
  next();
});
app.use(optionalAuth);

// Mobile carriers put many users behind one shared IP (CGNAT), so keying the
// rate limit purely by IP throttles innocent users. Prefer the authenticated
// user id and fall back to the IP for anonymous traffic.
const perUserKey = (req) =>
  req.authUserId ? `u:${req.authUserId}` : rateLimit.ipKeyGenerator(req.ip);
const logRateLimited = (req, res) => {
  console.log(
    `[rate-limit] 429 key=${perUserKey(req)} ip=${req.ip} path=${req.path} xff=${req.headers["x-forwarded-for"] || "-"}`,
  );
  res.status(429).json({ error: "Too many requests" });
};
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: perUserKey,
  handler: logRateLimited,
  // Health checks must remain available to distinguish DB outages from
  // ordinary API rate limiting.
  skip: (req) => req.path === "/health",
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimited,
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimited,
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimited,
});
// 중단된 결제 정리는 로그인 전에도 불려야 해서 세션을 요구할 수 없다.
// 대신 별도 한도를 둬서, 결제 id 를 찍어보는 시도가 실제 결제 요청 한도를
// 갉아먹지 못하게 분리한다.
const incompletePaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: perUserKey,
  handler: logRateLimited,
});
app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);
app.use("/api/guests/", authLimiter);
app.use("/api/payments/", paymentLimiter);
app.use("/api/uploads/", uploadLimiter);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: R2_MAX_UPLOAD_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPG, PNG, WebP, GIF, or AVIF images are allowed"));
  },
});

function parseImageUpload(req, res, next) {
  imageUpload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `Image must be ${R2_MAX_UPLOAD_MB}MB or smaller`
          : err.message;
      return res.status(status).json({ error: message });
    }
    return res.status(400).json({ error: err.message || "Invalid image upload" });
  });
}

// ── 관리자 세션 토큰 ────────────────────────────────────────────
// 비밀번호는 서버 환경변수에만 두고, 클라이언트는 로그인 시 한 번만 교환해
// 받은 단기 토큰을 사용한다. 원문 비밀번호가 브라우저에 남지 않게 하기 위함.
const ADMIN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const ADMIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_FAIL_MAX = 10;
const adminTokens = new Map();
const adminFailures = new Map();

function issueAdminToken() {
  const now = Date.now();
  for (const [token, expiresAt] of adminTokens) {
    if (expiresAt <= now) adminTokens.delete(token);
  }
  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.set(token, now + ADMIN_TOKEN_TTL_MS);
  return token;
}

function isValidAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const expiresAt = adminTokens.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function matchesAdminPassword(supplied) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof supplied !== "string" || !supplied) return false;
  const digest = (v) => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(digest(supplied), digest(expected));
}

function adminLockedOut(ip) {
  const entry = adminFailures.get(ip);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    adminFailures.delete(ip);
    return false;
  }
  return entry.count >= ADMIN_FAIL_MAX;
}

function recordAdminFailure(ip) {
  const now = Date.now();
  const entry = adminFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    adminFailures.set(ip, { count: 1, resetAt: now + ADMIN_FAIL_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

async function requireUploadActor(req, res, next) {
  if (isValidAdminToken(req.headers["x-admin-token"])) {
    req.uploadActorId = "admin";
    return next();
  }

  if (req.authUserId) {
    req.uploadActorId = req.authUserId;
    return next();
  }

  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const userId = await getUserIdFromToken(auth.slice(7));
    if (userId) {
      req.authUserId = userId;
      req.uploadActorId = userId;
      return next();
    }
  }

  return res.status(401).json({ error: "Authentication required" });
}

let pool = null;
pool = createDbPool();

// ── 자동 마이그레이션 ──────────────────────────────────────────
// 서버 시작 시 backend/migrations/*.sql 을 순서대로 실행한다.
// 이미 적용된 파일은 schema_migrations 테이블로 건너뛰고,
// "already exists" 류 오류는 무시하므로 기존 DB에도 안전하다.
async function runMigrations() {
  if (!pool) {
    console.warn("[migrate] skipped: database not configured");
    return;
  }
  const fs = require("fs");
  const path = require("path");
  const dir = path.join(__dirname, "..", "migrations");
  if (!fs.existsSync(dir)) {
    console.warn("[migrate] skipped: migrations dir not found at", dir);
    return;
  }

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename VARCHAR(255) PRIMARY KEY,
         applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await pool.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file],
      );
      if (rows.length) continue;

      const sql = fs
        .readFileSync(path.join(dir, file), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        try {
          await pool.query(stmt);
        } catch (e) {
          // 기존 DB에 이미 반영된 항목은 통과
          if (
            /already exists|Duplicate (column|key|entry)|check that (column\/key|it) exists|Can't DROP/i.test(
              e.message,
            )
          ) {
            console.log(`[migrate] skip (${file}): ${e.message.slice(0, 80)}`);
          } else {
            throw e;
          }
        }
      }

      await pool.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1) ON DUPLICATE KEY UPDATE filename = filename",
        [file],
      );
      console.log(`[migrate] applied: ${file}`);
    }
  } catch (e) {
    console.error("[migrate] failed:", e.message);
  }
}

const migrationsReady = runMigrations();

async function queryReturning(
  sql,
  params,
  table,
  whereSql = "id=$1",
  whereParams = [params[0]],
  options = {},
) {
  const result = await pool.query(sql, params);
  if (options.emptyOnNoChange && result.rowCount === 0)
    return { rows: [], rowCount: 0 };
  return pool.query(
    `SELECT * FROM ${table} WHERE ${whereSql} LIMIT 1`,
    whereParams,
  );
}

// ????????? ???????? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/health", async (req, res) => {
  const out = { ok: true, service: "marketpiepie-backend v1", db: "skipped" };
  if (!pool) return res.json(out);
  try {
    await pool.query("SELECT 1");
    await pool.query("SELECT 1 FROM products LIMIT 1");
    out.db = "connected";
    return res.json(out);
  } catch (e) {
    out.ok = false;
    out.db = "error";
    return res.status(503).json(out);
  }
});

app.post(
  "/api/uploads/image",
  requireUploadActor,
  parseImageUpload,
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }

    try {
      const { client, config } = getR2Client();
      const folder = safePathSegment(req.body?.folder || "images", "images");
      const actor = safePathSegment(req.uploadActorId || "user", "user");
      const date = new Date().toISOString().slice(0, 10);
      const ext = extensionForMime(req.file.mimetype, req.file.originalname);
      const key = [
        config.uploadPrefix,
        folder,
        actor,
        date,
        `${crypto.randomUUID()}${ext}`,
      ].join("/");

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );

      res.status(201).json({
        ok: true,
        url: imageUrlForKey(req, config, key),
        key,
        contentType: req.file.mimetype,
        size: req.file.size,
      });
    } catch (e) {
      const status = e.statusCode || 500;
      res.status(status).json({ error: e.message || "Image upload failed" });
    }
  },
);

app.get("/api/uploads/object/*", async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: "object key is required" });

  try {
    const { client, config } = getR2Client();
    const object = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );

    if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
    if (object.ContentLength != null) res.setHeader("Content-Length", String(object.ContentLength));
    if (object.ETag) res.setHeader("ETag", object.ETag);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (object.Body && typeof object.Body.pipe === "function") {
      object.Body.pipe(res);
      return;
    }

    const bytes = object.Body && typeof object.Body.transformToByteArray === "function"
      ? await object.Body.transformToByteArray()
      : null;
    if (!bytes) return res.status(500).json({ error: "Could not read object" });
    return res.send(Buffer.from(bytes));
  } catch (e) {
    const status = e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404 ? 404 : 500;
    res.status(status).json({ error: status === 404 ? "Object not found" : e.message || "Could not load object" });
  }
});

// ????????? ??? ??????? ????????? ???? (?????????? ?? ??? NODE_ENV=production ?????) ?????????
const DEV_USER_PRESETS = {
  user1: { nickname: "Seller Pingoo", pi_username: "local-user1" },
  user2: { nickname: "Buyer Pororo", pi_username: "local-user2" },
  user3: { nickname: "Buyer Crong", pi_username: "local-user3" },
};

// Guest session (all environments) — guests table only, not users
app.post("/api/guests/session", async (req, res) => {
  const guestId = req.body.guestId;
  if (!isGuestId(guestId)) {
    return res.status(400).json({ error: "guestId required (guest_...)" });
  }
  await upsertGuest(guestId, {
    deviceId: req.body.deviceId,
    region: req.body.region,
  });
  const sessionToken = await createSession(guestId);
  res.json({ guestId, sessionToken });
});

if (process.env.NODE_ENV !== "production") {
  app.post("/api/auth/dev-login", async (req, res) => {
    const userId = req.body.userId;
    if (!userId || isGuestId(userId)) {
      return res.status(400).json({
        error: "dev-login is for local preset users only; use POST /api/guests/session for guests",
      });
    }
    const preset = DEV_USER_PRESETS[userId];
    if (!preset) {
      return res.status(400).json({ error: "Unknown dev user" });
    }
    const { nickname, pi_username: piUsername } = preset;
    if (pool) {
      const upsertUser = async (withPiUsername) => {
        if (withPiUsername) {
          await pool.query(
            `INSERT INTO users (id, nickname, pi_username, kyc_status) VALUES ($1, $2, $3, 'verified')
             ON DUPLICATE KEY UPDATE
               nickname = COALESCE($2, users.nickname),
               pi_username = COALESCE($3, users.pi_username),
               id = id`,
            [userId, nickname, piUsername],
          );
          return;
        }
        await pool.query(
          `INSERT INTO users (id, nickname, kyc_status) VALUES ($1, $2, 'verified')
           ON DUPLICATE KEY UPDATE nickname = COALESCE($2, users.nickname), id = id`,
          [userId, nickname],
        );
      };
      try {
        await upsertUser(Boolean(piUsername));
      } catch (e) {
        if (piUsername && /pi_username|Unknown column/i.test(String(e.message))) {
          console.warn("[dev-login] pi_username column missing — run ALTER TABLE; saving without it");
          try {
            await upsertUser(false);
          } catch (e2) {
            console.error("[dev-login] users upsert failed:", e2.message);
          }
        } else {
          console.error("[dev-login] users upsert failed:", e.message);
        }
      }
    }
    const account = await getAccountStatus(userId);
    if (account.accountStatus === "suspended") {
      console.log(`[dev-login] suspended userId=${userId}`);
      return res.json({
        uid: userId,
        username: nickname,
        piVerified: true,
        sessionToken: null,
        ...account,
      });
    }
    const sessionToken = await createSession(userId);
    console.log(`[dev-login] userId=${userId} nickname=${nickname}`);
    res.json({
      uid: userId,
      username: nickname,
      piVerified: true,
      sessionToken,
      ...account,
    });
  });
}

// --- Pi Network Payments (?????? ????? ????????? ????? ?? .env ?? PI_API_KEY) ---

const PI_API_BASE = "https://api.minepi.com/v2";

async function piApiCall(method, path, data) {
  const piKey = process.env.PI_API_KEY;
  if (!piKey) {
    throw new Error("PI_API_KEY is not set (add to backend .env)");
  }

  const fetch = (await import("node-fetch")).default;

  const opts = {
    method,

    headers: {
      Authorization: "Key " + piKey,

      "Content-Type": "application/json",
    },
  };

  if (data) opts.body = JSON.stringify(data);

  const res = await fetch(PI_API_BASE + path, opts);

  if (!res.ok) {
    const text = await res.text();

    throw new Error("Pi API " + path + " failed: " + res.status + " " + text);
  }

  return res.json();
}

/** Pi 결제 종류 — metadata.type 과 매핑 */
const PAYMENT_TYPE = {
  PROFILE_VERIFICATION: "profile_verification",
  BADGE_PURCHASE: "badge_purchase",
  OTHER: "other",
};

function normalizePaymentType(metadata) {
  const t = metadata?.type;
  if (t === "verification" || t === PAYMENT_TYPE.PROFILE_VERIFICATION) {
    return PAYMENT_TYPE.PROFILE_VERIFICATION;
  }
  if (t === PAYMENT_TYPE.BADGE_PURCHASE) return PAYMENT_TYPE.BADGE_PURCHASE;
  if (typeof t === "string" && t.trim()) return t.trim();
  return PAYMENT_TYPE.OTHER;
}

function isProfileVerificationPayment(metadata) {
  return normalizePaymentType(metadata) === PAYMENT_TYPE.PROFILE_VERIFICATION;
}

async function resolvePaymentPiUsername(info) {
  const fromMeta = info.metadata?.username;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const uid = info.user_uid;
  if (pool && uid) {
    try {
      const { rows } = await pool.query(
        "SELECT pi_username FROM users WHERE id = $1",
        [uid],
      );
      if (rows[0]?.pi_username) return String(rows[0].pi_username);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function resolvePaymentWalletAddress(info) {
  // U2A: 결제자 지갑 = from_address. 승인 직후엔 비어 있을 수 있어
  // 메타데이터에 넣어 둔 값도 같이 본다.
  const candidates = [
    info?.from_address,
    info?.metadata?.wallet_address,
    info?.metadata?.wallet,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function upsertPaymentRecord(paymentId, status, { txid, paymentInfo } = {}) {
  if (!pool || !paymentId) return paymentInfo || null;
  let info = paymentInfo;
  try {
    if (!info) info = await piApiCall("GET", "/payments/" + paymentId);
    const paymentType = normalizePaymentType(info.metadata);
    const userId = info.user_uid || null;
    const amount = Number(info.amount) || 0;
    const memo = info.memo || null;
    const metadataJson = info.metadata ? JSON.stringify(info.metadata) : null;
    const resolvedTxid = txid || info.transaction?.txid || null;
    const piUsername = await resolvePaymentPiUsername(info);
    const walletAddress = resolvePaymentWalletAddress(info);

    await pool.query(
      `INSERT INTO payments (id, user_id, payment_type, amount, memo, txid, status, pi_username, wallet_address, metadata, approved_at, completed_at, cancelled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         CASE WHEN $7 IN ('approved','completed') THEN CURRENT_TIMESTAMP(3) ELSE NULL END,
         CASE WHEN $7 = 'completed' THEN CURRENT_TIMESTAMP(3) ELSE NULL END,
         CASE WHEN $7 = 'cancelled' THEN CURRENT_TIMESTAMP(3) ELSE NULL END)
       ON DUPLICATE KEY UPDATE
         user_id = COALESCE($2, user_id),
         payment_type = COALESCE($3, payment_type),
         amount = COALESCE($4, amount),
         memo = COALESCE($5, memo),
         txid = COALESCE($6, txid),
         status = $7,
         pi_username = COALESCE($8, pi_username),
         wallet_address = COALESCE($9, wallet_address),
         metadata = COALESCE($10, metadata),
         approved_at = CASE WHEN $7 IN ('approved','completed') THEN COALESCE(approved_at, CURRENT_TIMESTAMP(3)) ELSE approved_at END,
         completed_at = CASE WHEN $7 = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP(3)) ELSE completed_at END,
         cancelled_at = CASE WHEN $7 = 'cancelled' THEN COALESCE(cancelled_at, CURRENT_TIMESTAMP(3)) ELSE cancelled_at END`,
      [
        paymentId,
        userId,
        paymentType,
        amount,
        memo,
        resolvedTxid,
        status,
        piUsername,
        walletAddress,
        metadataJson,
      ],
    );
    return info;
  } catch (e) {
    console.error("[payments] upsert failed:", paymentId, e.message);
    return info || null;
  }
}

async function handleVerificationPaymentComplete(paymentInfo) {
  if (!paymentInfo?.user_uid) return;
  if (!isProfileVerificationPayment(paymentInfo.metadata)) return;
  await promoteGuestToUser(
    paymentInfo.user_uid,
    paymentInfo.metadata?.username,
  );
}

// ??? ????

/**
 * 결제가 요청자 본인 것인지 Pi 서버 원본으로 확인한다.
 * 클라이언트가 보낸 결제 정보는 어떤 경우에도 신뢰하지 않는다.
 */
async function requirePaymentOwner(req, res, paymentId) {
  if (!requireSession(req, res)) return null;
  let info;
  try {
    info = await piApiCall("GET", "/payments/" + paymentId);
  } catch (e) {
    res
      .status(502)
      .json({ error: "Could not verify payment with Pi: " + e.message });
    return null;
  }
  if (!info || info.user_uid !== req.authUserId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return info;
}

app.post("/api/payments/approve", async (req, res) => {
  const { paymentId } = req.body;

  if (!paymentId) return res.status(400).json({ error: "paymentId required" });

  const info = await requirePaymentOwner(req, res, paymentId);
  if (!info) return;

  if (!isValidPricedPayment(info)) {
    try {
      await piApiCall("POST", "/payments/" + paymentId + "/cancel", {});
      await upsertPaymentRecord(paymentId, "cancelled", { paymentInfo: info });
    } catch {
      /* ignore */
    }
    return res.status(400).json({ error: "Invalid payment amount" });
  }

  try {
    const result = await piApiCall(
      "POST",
      "/payments/" + paymentId + "/approve",
      {},
    );

    console.log("Payment approved:", paymentId);

    await upsertPaymentRecord(paymentId, "approved");

    res.json(result);
  } catch (e) {
    // already_approved??? ????????? ???

    if (e.message && e.message.includes("already_approved")) {
      console.log("Payment already approved:", paymentId);

      await upsertPaymentRecord(paymentId, "approved");

      return res.json({ message: "already approved" });
    }

    console.error("Payment approve error:", e.message);

    res.status(500).json({ error: e.message });
  }
});

// ??? ?????

app.post("/api/payments/complete", async (req, res) => {
  const { paymentId, txid } = req.body;

  if (!paymentId || !txid)
    return res.status(400).json({ error: "paymentId and txid required" });

  if (!(await requirePaymentOwner(req, res, paymentId))) return;

  try {
    const result = await piApiCall(
      "POST",
      "/payments/" + paymentId + "/complete",
      { txid },
    );

    console.log("Payment completed:", paymentId, txid);

    let paymentInfo = null;
    if (pool) {
      paymentInfo = await upsertPaymentRecord(paymentId, "completed", { txid });
      if (paymentInfo) await handleVerificationPaymentComplete(paymentInfo);
    }

    res.json(result);
  } catch (e) {
    // already_completed??? ????????? ???

    if (e.message && e.message.includes("already_completed")) {
      console.log("Payment already completed:", paymentId);

      if (pool) {
        const paymentInfo = await upsertPaymentRecord(paymentId, "completed", {
          txid,
        });
        if (paymentInfo) await handleVerificationPaymentComplete(paymentInfo);
      }

      return res.json({ message: "already completed" });
    }

    console.error("Payment complete error:", e.message);

    res.status(500).json({ error: e.message });
  }
});

// ?????? ??? ???

// Pi SDK 의 onIncompletePaymentFound 콜백은 로그인 세션이 만들어지기 전에도
// 호출되므로 세션을 요구할 수 없다. 대신 요청 본문에서는 결제 id 만 쓰고
// 금액·소유자·txid 등 나머지는 전부 Pi 서버 원본에서 다시 읽는다.
app.post("/api/payments/incomplete", incompletePaymentLimiter, async (req, res) => {
  const { payment } = req.body;

  const paymentId = payment && payment.identifier;

  if (!paymentId)
    return res.status(400).json({ error: "payment.identifier required" });

  // 남의 결제 id 를 찍어보며 취소시키는 시도를 막기 위해 형식부터 거른다.
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(paymentId)))
    return res.status(400).json({ error: "invalid payment identifier" });

  try {
    const info = await piApiCall("GET", "/payments/" + paymentId);

    // Pi 계정으로 로그인한 상태라면 본인 결제만 정리할 수 있다.
    // 게스트·비로그인은 아직 Pi uid 를 알 수 없는 복구 단계라 통과시키되,
    // 처리에 쓰는 값은 전부 Pi 원본(info)뿐이라 위조할 여지가 없다.
    const callerIsPiUser = req.authUserId && !isGuestId(req.authUserId);
    if (callerIsPiUser && info.user_uid && info.user_uid !== req.authUserId) {
      console.warn(
        `[payments] incomplete rejected: ${paymentId} belongs to ${info.user_uid}, caller ${req.authUserId}`,
      );
      return res.status(403).json({ error: "Forbidden" });
    }
    // 완료(txid 있음)는 복구를 위해 로그인 전에도 허용한다.
    // 취소는 본인 Pi 로그인일 때만 — 비로그인으로 남의 결제를 끊지 못하게 한다.

    const txid = info.transaction && info.transaction.txid;

    if (!txid && !isValidPricedPayment(info)) {
      if (!callerIsPiUser) {
        return res
          .status(401)
          .json({ error: "Login required to cancel incomplete payment" });
      }
      await piApiCall("POST", "/payments/" + paymentId + "/cancel", {});
      await upsertPaymentRecord(paymentId, "cancelled", { paymentInfo: info });
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    if (txid) {
      const result = await piApiCall(
        "POST",
        "/payments/" + paymentId + "/complete",
        { txid },
      );

      console.log("Incomplete payment completed:", paymentId);

      let paymentInfo = null;
      if (pool) {
        paymentInfo = await upsertPaymentRecord(paymentId, "completed", {
          txid,
          paymentInfo: info,
        });
        if (paymentInfo) await handleVerificationPaymentComplete(paymentInfo);
      }

      res.json(result);
    } else {
      if (!callerIsPiUser) {
        return res
          .status(401)
          .json({ error: "Login required to cancel incomplete payment" });
      }
      const result = await piApiCall(
        "POST",
        "/payments/" + paymentId + "/cancel",
        {},
      );

      console.log("Incomplete payment cancelled:", paymentId);

      await upsertPaymentRecord(paymentId, "cancelled", { paymentInfo: info });

      res.json(result);
    }
  } catch (e) {
    console.error("Incomplete payment error:", e.message);

    res.status(500).json({ error: e.message });
  }
});

const DEFAULT_APP_PRICES = {
  signup: 3.14,
  badges: {
    "01": 15,
    "02": 75,
    "03": 150,
    "04": 10,
    "05": 50,
    "06": 100,
    "07": 12,
    "08": 60,
    "09": 120,
    "10": 180,
    "11": 240,
    "12": 80,
    "13": 200,
    "14": 10,
  },
};

let appPricesCache = {
  signup: DEFAULT_APP_PRICES.signup,
  badges: { ...DEFAULT_APP_PRICES.badges },
};

function cloneAppPrices(src) {
  return { signup: src.signup, badges: { ...src.badges } };
}

function getAppPrices() {
  return appPricesCache;
}

function publicAppPrices() {
  const prices = getAppPrices();
  return { signupFee: prices.signup, badges: { ...prices.badges } };
}

function amountsEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.00005;
}

function parsePriceAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return null;
  return Math.round(n * 10000) / 10000;
}

async function loadAppPrices() {
  if (!pool) return getAppPrices();
  try {
    const { rows } = await pool.query("SELECT price_key, amount FROM app_prices");
    const next = cloneAppPrices(DEFAULT_APP_PRICES);
    for (const row of rows) {
      const amount = parsePriceAmount(row.amount);
      if (amount == null) continue;
      if (row.price_key === "signup") next.signup = amount;
      else if (typeof row.price_key === "string" && row.price_key.startsWith("badge_")) {
        const id = row.price_key.slice(6);
        if (DEFAULT_APP_PRICES.badges[id] != null) next.badges[id] = amount;
      }
    }
    appPricesCache = next;
  } catch (e) {
    console.error("[prices] load failed:", e.message);
  }
  return getAppPrices();
}

function extractPurchasedBadgeId(metadata) {
  if (!metadata) return null;
  try {
    const obj = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    const id = obj && obj.badgeId;
    if (typeof id === "string" && /^(0[1-9]|1[0-4])$/.test(id)) return id;
  } catch {
    /* ignore */
  }
  return null;
}

function isValidBadgePurchaseAmount(info) {
  if (normalizePaymentType(info?.metadata) !== PAYMENT_TYPE.BADGE_PURCHASE) return true;
  const id = extractPurchasedBadgeId(info.metadata);
  const expected = id ? getAppPrices().badges[id] : null;
  return expected != null && amountsEqual(info.amount, expected);
}

function isValidVerificationAmount(info) {
  if (normalizePaymentType(info?.metadata) !== PAYMENT_TYPE.PROFILE_VERIFICATION) return true;
  return amountsEqual(info.amount, getAppPrices().signup);
}

function isValidPricedPayment(info) {
  return isValidBadgePurchaseAmount(info) && isValidVerificationAmount(info);
}

app.get("/api/payments/my-badges", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT metadata FROM payments
       WHERE user_id = $1 AND payment_type = 'badge_purchase' AND status = 'completed'`,
      [req.authUserId],
    );
    const ids = new Set();
    for (const row of rows) {
      const id = extractPurchasedBadgeId(row.metadata);
      if (id) ids.add(id);
    }
    res.json({ badgeIds: [...ids] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/prices", async (_req, res) => {
  if (pool) await loadAppPrices();
  res.json(publicAppPrices());
});

app.get("/api/admin/prices", requireAdmin, async (_req, res) => {
  if (pool) await loadAppPrices();
  res.json(publicAppPrices());
});

app.put("/api/admin/prices", requireDb, requireAdmin, async (req, res) => {
  await loadAppPrices();
  const next = cloneAppPrices(getAppPrices());
  const rows = [];

  if (req.body?.signupFee != null) {
    const signupFee = parsePriceAmount(req.body.signupFee);
    if (signupFee == null) return res.status(400).json({ error: "Invalid signup fee" });
    next.signup = signupFee;
    rows.push(["signup", signupFee]);
  }

  const incoming = req.body?.badges;
  if (incoming && typeof incoming === "object") {
    for (const [id, raw] of Object.entries(incoming)) {
      if (DEFAULT_APP_PRICES.badges[id] == null) {
        return res.status(400).json({ error: "Unknown badge: " + id });
      }
      const amount = parsePriceAmount(raw);
      if (amount == null) return res.status(400).json({ error: "Invalid badge price: " + id });
      next.badges[id] = amount;
      rows.push(["badge_" + id, amount]);
    }
  }

  if (!rows.length) return res.status(400).json({ error: "No prices to update" });

  try {
    for (const [key, amount] of rows) {
      await pool.query(
        `INSERT INTO app_prices (price_key, amount)
         VALUES ($1, $2)
         ON DUPLICATE KEY UPDATE amount = $2, updated_at = CURRENT_TIMESTAMP(3)`,
        [key, amount],
      );
    }
    appPricesCache = next;
    res.json(publicAppPrices());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function requireDb(req, res, next) {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  next();
}

// ????????? Pi Network ?? ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.post("/api/auth/pi/verify", async (req, res) => {
  const { accessToken, guestId } = req.body;
  if (!accessToken)
    return res.status(400).json({ error: "accessToken required" });
  try {
    const https = require("https");
    const piRes = await new Promise((resolve, reject) => {
      const r = https.get(
        "https://api.minepi.com/v2/me",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        (resp) => {
          let data = "";
          resp.on("data", (chunk) => {
            data += chunk;
          });
          resp.on("end", () => {
            if (resp.statusCode === 200) resolve(JSON.parse(data));
            else reject(new Error(`Pi API ${resp.statusCode}: ${data}`));
          });
        },
      );
      r.on("error", reject);
    });
    let piVerified = false;
    if (pool) {
      const { rows } = await pool.query(
        "SELECT pi_verified FROM users WHERE id = $1",
        [piRes.uid],
      );
      if (rows.length > 0) piVerified = !!rows[0].pi_verified;

      // 결제는 완료됐는데 users 반영이 누락된 경우 로그인 시점에 복구
      // (재결제 요구 방지)
      if (!piVerified) {
        try {
          const { rows: paid } = await pool.query(
            `SELECT id FROM payments
             WHERE user_id = $1 AND payment_type = 'profile_verification' AND status = 'completed'
             LIMIT 1`,
            [piRes.uid],
          );
          if (paid.length) {
            await promoteGuestToUser(piRes.uid, piRes.username);
            piVerified = true;
            console.log("[auth] healed missing user from completed payment:", piRes.uid);
          }
        } catch (e) {
          console.warn("[auth] payment heal check failed:", e.message);
        }
      }
    }
    if (!piVerified && isGuestId(guestId)) {
      await linkGuestToPi(guestId, piRes.uid, piRes.username);
    }
    const account = await getAccountStatus(piRes.uid);
    if (account.accountStatus === "suspended") {
      return res.json({
        uid: piRes.uid,
        username: piRes.username,
        piVerified,
        sessionToken: null,
        ...account,
      });
    }
    const sessionToken = await createSession(piRes.uid);
    res.json({
      uid: piRes.uid,
      username: piRes.username,
      piVerified,
      sessionToken,
      ...account,
    });
  } catch (e) {
    res
      .status(401)
      .json({ error: "Pi token verification failed: " + e.message });
  }
});

// PiePie + 7자리 — 프로필 생성 기본 닉네임 (DB 중복 없을 때까지 재시도)
app.get("/api/nicknames/suggest", requireDb, async (_req, res) => {
  try {
    for (let attempt = 0; attempt < 25; attempt++) {
      const digits = String(Math.floor(1_000_000 + Math.random() * 9_000_000));
      const nickname = `PiePie${digits}`;
      const { rows } = await pool.query(
        "SELECT 1 FROM users WHERE nickname = $1 LIMIT 1",
        [nickname],
      );
      if (!rows.length) return res.json({ nickname });
    }
    res.status(503).json({ error: "Could not generate unique nickname" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/users/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(stripPrivateUserFields(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Public read-only disputes for a user profile (trust transparency) */
app.get("/api/users/:id/disputes", requireDb, async (req, res) => {
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(
      `SELECT id, order_id, product_title, product_image, proposed_price, trade_method,
              buyer_id, seller_id, opened_by_user_id, reason, status, created_at, resolved_at
       FROM disputes
       WHERE buyer_id = $1 OR seller_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const ORDER_STATUS_COMPLETE = "완료";
const PRODUCT_STATUS_SOLD = "판매완료";
const PRODUCT_STATUS_FOR_SALE = "판매중";
const PRODUCT_STATUS_RESERVED = "예약중";
const ORDER_STATUS_DISPUTE = "분쟁";
const ORDER_STATUS_ADMIN_RESOLVED = "관리자해결";

/** 홈·관리자 공통: 완료 주문이 있으면 판매완료, 약속이 있으면 예약중, 아니면 판매중. */
function productListingStatusSql(alias = "p") {
  return `(CASE
      WHEN EXISTS (
        SELECT 1 FROM orders o
         WHERE o.product_id = ${alias}.id
           AND (o.status IN ('완료','수령완료','completed','complete')
                OR (o.buyer_completed = true AND o.seller_completed = true))
      ) THEN '${PRODUCT_STATUS_SOLD}'
      WHEN EXISTS (
        SELECT 1 FROM orders o
         WHERE o.product_id = ${alias}.id
           AND o.status NOT IN ('완료','수령완료','분쟁','completed','complete','received','dispute')
           AND (
             o.status IN ('약속확정','meetup_set')
             OR (NULLIF(o.meetup_location, '') IS NOT NULL AND NULLIF(o.meetup_time, '') IS NOT NULL)
           )
      ) THEN '${PRODUCT_STATUS_RESERVED}'
      WHEN ${alias}.status = '${PRODUCT_STATUS_SOLD}' THEN '${PRODUCT_STATUS_SOLD}'
      ELSE '${PRODUCT_STATUS_FOR_SALE}'
    END)`;
}

/** 사용자 칩과 맞춤: 열린 분쟁이면 분쟁, 약속이 있으면 약속확정. */
function orderDisplayStatusSql(alias = "o") {
  return `(CASE
      WHEN EXISTS (
        SELECT 1 FROM disputes d
         WHERE d.order_id = ${alias}.id AND d.status <> 'RESOLVED'
      ) THEN '${ORDER_STATUS_DISPUTE}'
      WHEN ${alias}.status NOT IN ('완료','수령완료','분쟁','completed','complete','received','dispute')
        AND (
          ${alias}.status IN ('약속확정','meetup_set')
          OR (NULLIF(${alias}.meetup_location, '') IS NOT NULL AND NULLIF(${alias}.meetup_time, '') IS NOT NULL)
        ) THEN '약속확정'
      ELSE ${alias}.status
    END)`;
}

function userLiveRatingSql(alias = "u") {
  return `COALESCE((SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.reviewee_id = ${alias}.id), 0)`;
}

function userLiveTrustSql(alias = "u") {
  return `COALESCE((
    SELECT GREATEST(0, LEAST(100, ROUND((AVG(rv.rating) / 5) * 100)))
      FROM reviews rv WHERE rv.reviewee_id = ${alias}.id
  ), 50)`;
}

function userLiveTradeCountSql(alias = "u") {
  return `COALESCE((
    SELECT COUNT(*) FROM orders o2
      LEFT JOIN products p2 ON o2.product_id = p2.id
     WHERE o2.status = '${ORDER_STATUS_COMPLETE}'
       AND (o2.buyer_id = ${alias}.id OR o2.seller_id = ${alias}.id)
       AND COALESCE(p2.is_free_share, 0) = 0
       AND COALESCE(NULLIF(o2.proposed_price, 0), p2.price, 0) > 0
  ), 0)`;
}

/** 홈·관리자가 같이 쓰는 기준: 완료 주문이 있으면 판매완료, 약속이 남아 있으면 예약중, 아니면 판매중. */
async function syncProductListingStatusFromOrders(productId) {
  if (!productId) return;
  try {
    const { rows: products } = await pool.query(
      "SELECT status FROM products WHERE id=$1",
      [productId],
    );
    if (!products.length) return;
    const current = products[0].status;

    const { rows: complete } = await pool.query(
      `SELECT id FROM orders
        WHERE product_id=$1
          AND (status IN ('완료','수령완료','completed','complete')
               OR (buyer_completed=true AND seller_completed=true))
        LIMIT 1`,
      [productId],
    );
    if (complete.length) {
      if (current !== PRODUCT_STATUS_SOLD) {
        await pool.query("UPDATE products SET status=$2 WHERE id=$1", [
          productId,
          PRODUCT_STATUS_SOLD,
        ]);
      }
      return;
    }
    if (current === PRODUCT_STATUS_SOLD) return;

    const { rows: reserved } = await pool.query(
      `SELECT id FROM orders
        WHERE product_id=$1
          AND status NOT IN ('완료','수령완료','분쟁','completed','complete','received','dispute')
          AND (
            status IN ('약속확정','meetup_set')
            OR (
              meetup_location IS NOT NULL AND meetup_location <> ''
              AND meetup_time IS NOT NULL AND meetup_time <> ''
            )
          )
        LIMIT 1`,
      [productId],
    );
    const next = reserved.length
      ? PRODUCT_STATUS_RESERVED
      : PRODUCT_STATUS_FOR_SALE;
    if (current !== next) {
      await pool.query("UPDATE products SET status=$2 WHERE id=$1", [
        productId,
        next,
      ]);
    }
  } catch (e) {
    console.warn("[products] listing status sync failed:", e.message);
  }
}

/** 분쟁이 진행 중인 상품은 수정·삭제로 증거가 사라지면 안 된다. */
async function hasOpenDisputeOnProduct(productId) {
  if (!productId) return false;
  const { rows } = await pool.query(
    `SELECT d.id FROM disputes d
       INNER JOIN orders o ON o.id = d.order_id
      WHERE o.product_id = $1 AND d.status <> 'RESOLVED'
      LIMIT 1`,
    [productId],
  );
  return rows.length > 0;
}

/**
 * 관리자가 분쟁을 해결하면 거래를 처음 채팅을 시작한 시점으로 되돌린다.
 * 약속·배송·수령 기록을 모두 비워 어느 쪽도 중단된 거래를 이어가지 못하게 하고,
 * 상품은 다시 판매중으로 열어 새 제안을 받을 수 있게 한다.
 */
async function resetOrderAfterAdminDisputeResolved(orderId) {
  if (!orderId) return;
  try {
    const { rows: stillOpen } = await pool.query(
      "SELECT id FROM disputes WHERE order_id=$1 AND status <> 'RESOLVED' LIMIT 1",
      [orderId],
    );
    if (stillOpen.length) return;

    const { rows: orderRows } = await pool.query(
      "SELECT status, product_id FROM orders WHERE id=$1",
      [orderId],
    );
    if (!orderRows.length || orderRows[0].status !== ORDER_STATUS_DISPUTE) return;

    await pool.query(
      `UPDATE orders
          SET status=$2,
              meetup_location=NULL, meetup_time=NULL, meetup_accepted=FALSE,
              shipping_address=NULL, shipping_name=NULL, shipping_phone=NULL,
              tracking_number=NULL, shipping_company=NULL,
              shipping_proof_images=JSON_ARRAY(),
              receipt_condition=NULL, receipt_notes=NULL,
              seller_completed=FALSE, buyer_completed=FALSE
        WHERE id=$1`,
      [orderId, ORDER_STATUS_ADMIN_RESOLVED],
    );
    await pool.query(
      `INSERT INTO order_timeline_events (id, order_id, type, description)
       VALUES ($1,$2,$3,$4)
       ON DUPLICATE KEY UPDATE id=id`,
      [
        `t_disp_${orderId}_${Date.now()}`,
        orderId,
        ORDER_STATUS_ADMIN_RESOLVED,
        "Dispute resolved by admin",
      ],
    );

    const productId = orderRows[0].product_id;
    if (productId) {
      const { rows: otherComplete } = await pool.query(
        "SELECT id FROM orders WHERE product_id=$1 AND id<>$2 AND status=$3 LIMIT 1",
        [productId, orderId, ORDER_STATUS_COMPLETE],
      );
      if (!otherComplete.length) {
        await pool.query(
          "UPDATE products SET status=$2 WHERE id=$1 AND status<>$2",
          [productId, PRODUCT_STATUS_FOR_SALE],
        );
      }
    }
  } catch (e) {
    console.warn("[disputes] order reset failed:", e.message);
  }
}

async function healSoldProductsForUser(userId) {
  if (!userId) return;
  try {
    await pool.query(
      `UPDATE products p
         INNER JOIN orders o ON o.product_id = p.id
          SET p.status = $1
        WHERE o.status = $2
          AND (o.buyer_id = $3 OR o.seller_id = $3)
          AND p.status <> $1`,
      [PRODUCT_STATUS_SOLD, ORDER_STATUS_COMPLETE, userId],
    );
  } catch (e) {
    console.warn("[orders] sold product heal failed:", e.message);
  }
}

/**
 * 신뢰도·평점·거래수는 클라이언트가 보내온 값을 믿지 않고
 * 리뷰/주문 테이블에서 서버가 다시 계산한다.
 */
async function computeUserReputation(userId) {
  const stats = { trust_score: 50, rating: 0, trade_count: 0 };
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) AS cnt, AVG(rating) AS avg_rating FROM reviews WHERE reviewee_id=$1",
      [userId],
    );
    if (Number(rows[0]?.cnt || 0) > 0) {
      const avg = Number(rows[0].avg_rating || 0);
      stats.rating = Math.round(avg * 10) / 10;
      stats.trust_score = Math.max(
        0,
        Math.min(100, Math.round((avg / 5) * 100)),
      );
    }
  } catch (e) {
    console.warn("[users] rating recompute failed:", e.message);
  }
  try {
    // 무료 나눔은 거래 수에 넣지 않는다 (프론트 getTradeCount 와 동일 기준)
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       WHERE o.status = $1
         AND (o.buyer_id = $2 OR o.seller_id = $2)
         AND COALESCE(p.is_free_share, 0) = 0
         AND COALESCE(NULLIF(o.proposed_price, 0), p.price, 0) > 0`,
      [ORDER_STATUS_COMPLETE, userId],
    );
    stats.trade_count = Number(rows[0]?.cnt || 0);
  } catch (e) {
    console.warn("[users] trade count recompute failed:", e.message);
  }
  return stats;
}

app.post("/api/users", requireDb, requireAuth, async (req, res) => {
  const {
    id,
    nickname,
    profile_image,
    bio,
    activity_region,
    verified_region,
    display_activity_badge_id,
    seller_type,
  } = req.body;
  if (!id) return res.status(400).json({ error: "id required" });
  if (isGuestId(id)) {
    return res.status(400).json({
      error: "Guest accounts belong in guests until Pi verification payment completes",
    });
  }

  // 거래 상대 프로필은 외래키용으로 "없으면 생성"만 하고 절대 덮어쓰지 않는다.
  if (id !== req.authUserId) {
    try {
      await pool.query(
        "INSERT INTO users (id, nickname) VALUES ($1, $1) ON DUPLICATE KEY UPDATE id = id",
        [id],
      );
      const { rows } = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
      return res.json(stripPrivateUserFields(rows[0]) || { id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const isUuidLike = (s) => s && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s);
  const safeNickname =
    !nickname || nickname === id || isUuidLike(nickname) ? null : nickname;
  try {
    const rep = await computeUserReputation(id);
    const { rows } = await queryReturning(
      `INSERT INTO users (id, nickname, profile_image, bio, kyc_status, trust_score, rating, trade_count, activity_region, verified_region, display_activity_badge_id, seller_type)
       VALUES ($1, COALESCE($2, $1), $3,$4,'unverified',$5,$6,$7,$8,$9,$10,$11)
       ON DUPLICATE KEY UPDATE
         nickname = CASE
           WHEN $2 IS NOT NULL THEN $2
           ELSE COALESCE(NULLIF(users.nickname, ''), NULLIF(users.nickname, users.id), users.nickname)
         END,
         profile_image=COALESCE(VALUES(profile_image), users.profile_image),
         bio=COALESCE(VALUES(bio), users.bio),
         kyc_status=CASE WHEN users.pi_verified THEN 'verified' ELSE users.kyc_status END,
         trust_score=VALUES(trust_score),
         rating=VALUES(rating),
         trade_count=VALUES(trade_count),
         activity_region=COALESCE(VALUES(activity_region), users.activity_region),
         verified_region=COALESCE(VALUES(verified_region), users.verified_region),
         display_activity_badge_id=COALESCE(VALUES(display_activity_badge_id), users.display_activity_badge_id),
         seller_type=COALESCE(VALUES(seller_type), users.seller_type)`,
      [
        id,
        safeNickname,
        profile_image,
        bio,
        rep.trust_score,
        rep.rating,
        rep.trade_count,
        activity_region,
        verified_region,
        display_activity_badge_id,
        seller_type,
      ],
      "users",
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/users/:id", requireDb, requireAuth, async (req, res) => {
  if (req.authUserId !== req.params.id)
    return res.status(403).json({ error: "Forbidden" });
  const {
    nickname,
    profile_image,
    bio,
    activity_region,
    display_activity_badge_id,
    seller_type,
  } = req.body;
  try {
    const { rows } = await queryReturning(
      `UPDATE users SET nickname=$2, profile_image=$3, bio=$4, activity_region=$5,
       display_activity_badge_id=$6, seller_type=$7 WHERE id=$1`,
      [
        req.params.id,
        nickname,
        profile_image,
        bio,
        activity_region,
        display_activity_badge_id,
        seller_type,
      ],
      "users",
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ?????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/products", requireDb, async (req, res) => {
  const { category, status, seller_id } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  try {
    let query = `SELECT p.*, ${jsonObjectSql("u", "users")} AS seller FROM products p
                 LEFT JOIN users u ON p.seller_id = u.id WHERE 1=1`;
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND p.category=$${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND p.status=$${params.length}`;
    }
    if (seller_id) {
      params.push(seller_id);
      query += ` AND p.seller_id=$${params.length}`;
    }
    // 정지된 판매자의 상품은 목록에서 내린다 — 정지 해제되면 다시 보인다.
    if (req.authUserId) {
      params.push(req.authUserId);
      const me = `$${params.length}`;
      query += ` AND (p.admin_hidden = false OR p.seller_id = ${me})`;
      query += ` AND (COALESCE(u.account_status, 'active') <> 'suspended' OR p.seller_id = ${me})`;
    } else {
      query += ` AND p.admin_hidden = false`;
      query += ` AND COALESCE(u.account_status, 'active') <> 'suspended'`;
    }
    params.push(limit, offset);
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Public: listing has an open buyer-filed dispute (home 분쟁중), optionally excluding one pair. */
app.get("/api/products/:id/open-buyer-dispute", requireDb, async (req, res) => {
  const excludeBuyer = typeof req.query.exclude_buyer_id === "string" ? req.query.exclude_buyer_id : "";
  const excludeSeller = typeof req.query.exclude_seller_id === "string" ? req.query.exclude_seller_id : "";
  try {
    const params = [req.params.id];
    let extra = "";
    if (excludeBuyer && excludeSeller) {
      params.push(excludeBuyer, excludeSeller);
      extra = " AND NOT (d.buyer_id = $2 AND d.seller_id = $3)";
    }
    const { rows } = await pool.query(
      `SELECT 1
         FROM disputes d
         JOIN orders o ON o.id = d.order_id
        WHERE o.product_id = $1
          AND d.status <> 'RESOLVED'
          AND (d.opened_by_user_id IS NULL OR d.opened_by_user_id <> d.seller_id)
          ${extra}
        LIMIT 1`,
      params,
    );
    res.json({ open: rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/products/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.account_status AS seller_account_status,
              ${jsonObjectSql("u", "users")} AS seller FROM products p
       LEFT JOIN users u ON p.seller_id = u.id WHERE p.id=$1`,
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Product not found" });
    // 정지된 판매자의 상품도 숨긴 상품과 같게 다룬다 — 기존 거래 당사자만 볼 수 있다.
    const listingBlocked =
      rows[0].admin_hidden || rows[0].seller_account_status === "suspended";
    if (listingBlocked && rows[0].seller_id !== req.authUserId) {
      if (!req.authUserId) {
        return res.status(404).json({ error: "Product not found" });
      }
      const access = await pool.query(
        `SELECT 1
           FROM chat_rooms
          WHERE product_id = $1 AND (buyer_id = $2 OR seller_id = $2)
          UNION
         SELECT 1
           FROM orders
          WHERE product_id = $1 AND (buyer_id = $2 OR seller_id = $2)
          LIMIT 1`,
        [req.params.id, req.authUserId],
      );
      if (!access.rows.length) {
        return res.status(404).json({ error: "Product not found" });
      }
    }
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/products", requireDb, requireAuth, async (req, res) => {
  const {
    id,
    title,
    description,
    price,
    category,
    region,
    status,
    images,
    seller_id,
    trade_methods,
    today_trade_available,
    is_free_share,
    allow_offer,
  } = req.body;
  if (seller_id && req.authUserId !== seller_id)
    return res.status(403).json({ error: "Forbidden" });
  const effectiveSellerId = req.authUserId;
  try {
    if (id) {
      const { rows: existingProduct } = await pool.query(
        "SELECT seller_id FROM products WHERE id=$1",
        [id],
      );
      if (
        existingProduct.length &&
        existingProduct[0].seller_id !== req.authUserId
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // 등록은 막지 않고, 분쟁 중인 기존 상품의 덮어쓰기만 막는다.
      if (existingProduct.length && (await hasOpenDisputeOnProduct(id))) {
        return res
          .status(409)
          .json({ error: "This listing is in dispute and cannot be edited" });
      }
    }
    const { rows } = await queryReturning(
      `INSERT INTO products (id, title, description, price, category, region, status, images, seller_id, trade_methods, today_trade_available, is_free_share, allow_offer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), description=VALUES(description), price=VALUES(price),
         category=VALUES(category), region=VALUES(region), status=VALUES(status),
         images=VALUES(images), trade_methods=VALUES(trade_methods),
         today_trade_available=VALUES(today_trade_available),
         is_free_share=VALUES(is_free_share), allow_offer=VALUES(allow_offer)`,
      [
        id,
        clipText(title, TEXT_LIMIT.listingTitle),
        clipText(description, TEXT_LIMIT.listingDescription),
        price,
        category,
        region,
        status || "active",
        images || [],
        effectiveSellerId,
        trade_methods || [],
        today_trade_available || false,
        is_free_share || false,
        allow_offer || false,
      ],
      "products",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/products/:id", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT seller_id FROM products WHERE id=$1",
      [req.params.id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Product not found" });
    if (existing[0].seller_id !== req.authUserId)
      return res.status(403).json({ error: "Forbidden" });
    if (await hasOpenDisputeOnProduct(req.params.id)) {
      return res
        .status(409)
        .json({ error: "This listing is in dispute and cannot be edited" });
    }
    const {
      title,
      description,
      price,
      category,
      region,
      status,
      images,
      trade_methods,
      today_trade_available,
      is_free_share,
      allow_offer,
    } = req.body;
    const { rows } = await queryReturning(
      `UPDATE products SET title=$2, description=$3, price=$4, category=$5, region=$6,
       status=$7, images=$8, trade_methods=$9, today_trade_available=$10,
       is_free_share=$11, allow_offer=$12 WHERE id=$1`,
      [
        req.params.id,
        clipText(title, TEXT_LIMIT.listingTitle),
        clipText(description, TEXT_LIMIT.listingDescription),
        price,
        category,
        region,
        status,
        images,
        trade_methods,
        today_trade_available,
        is_free_share,
        allow_offer,
      ],
      "products",
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch(
  "/api/products/:id/status",
  requireDb,
  requireAuth,
  async (req, res) => {
    try {
      const { rows: existing } = await pool.query(
        "SELECT seller_id FROM products WHERE id=$1",
        [req.params.id],
      );
      if (!existing.length)
        return res.status(404).json({ error: "Product not found" });
      if (existing[0].seller_id !== req.authUserId)
        return res.status(403).json({ error: "Forbidden" });
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: "status required" });
      const { rows } = await queryReturning(
        "UPDATE products SET status=$2 WHERE id=$1",
        [req.params.id, status],
        "products",
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete("/api/products/:id", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT seller_id FROM products WHERE id=$1",
      [req.params.id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Product not found" });
    if (existing[0].seller_id !== req.authUserId)
      return res.status(403).json({ error: "Forbidden" });
    if (await hasOpenDisputeOnProduct(req.params.id)) {
      return res
        .status(409)
        .json({ error: "This listing is in dispute and cannot be deleted" });
    }
    await pool.query(
      `UPDATE favorites SET product_id=NULL WHERE product_id=$1`,
      [req.params.id],
    );
    await pool.query(
      `UPDATE chat_rooms SET product_id=NULL WHERE product_id=$1`,
      [req.params.id],
    );
    await pool.query(`UPDATE orders SET product_id=NULL WHERE product_id=$1`, [
      req.params.id,
    ]);
    await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ?? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/orders", requireDb, async (req, res) => {
  const { buyer_id, seller_id, status } = req.query;
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.query.user_id, buyer_id, seller_id)) return;
  // 필터가 없으면 전체 주문이 나가므로 항상 본인으로 범위를 좁힌다.
  const user_id = buyer_id || seller_id ? req.query.user_id : req.authUserId;
  try {
    await healSoldProductsForUser(user_id || req.authUserId);
    let query = `SELECT o.*,
      o.meetup_location AS meetup_place,
      SUBSTRING_INDEX(COALESCE(o.meetup_time,''), ' ', 1) AS meetup_date,
      CASE WHEN LOCATE(' ', COALESCE(o.meetup_time,'')) > 0
        THEN SUBSTRING(o.meetup_time, LOCATE(' ', o.meetup_time)+1)
        ELSE o.meetup_time
      END AS meetup_time_only,
      (SELECT COALESCE(JSON_ARRAYAGG(
        JSON_OBJECT('id', e.id, 'type', e.type, 'description', e.description, 'timestamp', e.created_at)
      ), JSON_ARRAY()) FROM order_timeline_events e WHERE e.order_id = o.id) AS timeline,
      ${jsonObjectSql("p", "products")} AS product,
      ${jsonObjectSql("b", "users")} AS buyer,
      ${jsonObjectSql("s", "users")} AS seller
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users b ON o.buyer_id = b.id
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE 1=1`;
    const params = [];
    if (user_id) {
      params.push(user_id);
      query += ` AND (o.buyer_id=$${params.length} OR o.seller_id=$${params.length})`;
    }
    if (buyer_id) {
      params.push(buyer_id);
      query += ` AND o.buyer_id=$${params.length}`;
    }
    if (seller_id) {
      params.push(seller_id);
      query += ` AND o.seller_id=$${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND o.status=$${params.length}`;
    }
    query += " ORDER BY o.created_at DESC LIMIT 200";
    const { rows } = await pool.query(query, params);
    const mapped = rows.map((r) => ({
      ...r,
      meetup_time: r.meetup_time_only || r.meetup_time,
    }));
    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function mapOrderRowForApi(row) {
  if (!row) return row;
  const meetupTimeOnly =
    row.meetup_time_only ||
    (row.meetup_time && String(row.meetup_time).includes(" ")
      ? String(row.meetup_time).split(/\s+/).slice(1).join(" ")
      : row.meetup_time);
  const meetupDate =
    row.meetup_date ||
    (row.meetup_time && String(row.meetup_time).includes(" ")
      ? String(row.meetup_time).split(/\s+/)[0]
      : undefined);
  return {
    ...row,
    meetup_place: row.meetup_place || row.meetup_location,
    meetup_date: meetupDate,
    meetup_time: meetupTimeOnly,
  };
}

app.get("/api/orders/:id", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT o.*,
        o.meetup_location AS meetup_place,
        SUBSTRING_INDEX(COALESCE(o.meetup_time,''), ' ', 1) AS meetup_date,
        CASE WHEN LOCATE(' ', COALESCE(o.meetup_time,'')) > 0
          THEN SUBSTRING(o.meetup_time, LOCATE(' ', o.meetup_time)+1)
          ELSE o.meetup_time
        END AS meetup_time_only,
        ${jsonObjectSql("p", "products")} AS product,
        ${jsonObjectSql("b", "users")} AS buyer,
        ${jsonObjectSql("s", "users")} AS seller
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN users b ON o.buyer_id = b.id
       LEFT JOIN users s ON o.seller_id = s.id
       WHERE o.id=$1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Order not found" });
    if (
      rows[0].buyer_id !== req.authUserId &&
      rows[0].seller_id !== req.authUserId
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const order = mapOrderRowForApi(rows[0]);
    const { rows: timeline } = await pool.query(
      "SELECT * FROM order_timeline_events WHERE order_id=$1 ORDER BY created_at ASC",
      [req.params.id],
    );
    order.timeline = timeline;
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Public party summary for a dispute post (no evidence / private notes). */
app.get("/api/orders/:orderId/dispute-summaries", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.order_id, d.product_title, d.product_image, d.proposed_price, d.trade_method,
              d.buyer_id, d.seller_id, d.opened_by_user_id, d.reason, d.status, d.created_at, d.resolved_at,
              bu.nickname AS buyer_nickname, su.nickname AS seller_nickname
       FROM disputes d
       LEFT JOIN users bu ON bu.id = d.buyer_id
       LEFT JOIN users su ON su.id = d.seller_id
       WHERE d.order_id = $1
       ORDER BY d.created_at DESC
       LIMIT 10`,
      [req.params.orderId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Buyer/seller: full disputes on this order, including the other party's reason and evidence. */
app.get("/api/orders/:orderId/disputes", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows: orderRows } = await pool.query(
      "SELECT buyer_id, seller_id FROM orders WHERE id=$1",
      [req.params.orderId],
    );
    if (!orderRows.length) return res.status(404).json({ error: "Order not found" });
    if (
      orderRows[0].buyer_id !== req.authUserId &&
      orderRows[0].seller_id !== req.authUserId
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { rows } = await pool.query(
      `SELECT d.*, bu.nickname AS buyer_nickname, su.nickname AS seller_nickname
       FROM disputes d
       LEFT JOIN users bu ON bu.id = d.buyer_id
       LEFT JOIN users su ON su.id = d.seller_id
       WHERE d.order_id = $1
       ORDER BY d.created_at ASC`,
      [req.params.orderId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders", requireDb, requireAuth, async (req, res) => {
  const {
    id,
    product_id,
    buyer_id,
    seller_id,
    status,
    proposed_price,
    trade_method,
    meetup_place,
    meetup_date,
    meetup_time,
    memo,
    receipt_condition,
    receipt_notes,
    buyer_completed,
    seller_completed,
    meetup_accepted,
    shipping_address,
    shipping_name,
    shipping_phone,
    tracking_number,
    shipping_company,
    shipping_proof_images,
  } = req.body;
  console.log("[POST /api/orders] REQUEST", {
    id,
    buyer_id,
    seller_id,
    status,
    authUserId: req.authUserId,
  });
  // ?? ???(??? ?? ???) ? ? ??? ?? ??
  if (req.authUserId !== buyer_id && req.authUserId !== seller_id) {
    console.log(
      "[POST /api/orders] FORBIDDEN - authUserId is neither buyer nor seller",
      { authUserId: req.authUserId, buyer_id, seller_id },
    );
    return res.status(403).json({ error: "Forbidden" });
  }
  const meetupLocation = meetup_place || null;
  const meetupDateTime =
    meetup_date && meetup_time
      ? `${meetup_date} ${meetup_time}`
      : meetup_time || null;
  try {
    const existingOrder = await pool.query(
      "SELECT id FROM orders WHERE id = $1 LIMIT 1",
      [id],
    );
    if (!existingOrder.rows.length && product_id) {
      const product = await pool.query(
        `SELECT p.admin_hidden, u.account_status AS seller_account_status
           FROM products p LEFT JOIN users u ON p.seller_id = u.id
          WHERE p.id = $1 LIMIT 1`,
        [product_id],
      );
      if (
        product.rows[0]?.admin_hidden ||
        product.rows[0]?.seller_account_status === "suspended"
      ) {
        return res.status(409).json({ error: "This listing is hidden by admin" });
      }
    }
    const { rows } = await queryReturning(
      `INSERT INTO orders (id, product_id, buyer_id, seller_id, status, proposed_price, trade_method, meetup_location, meetup_time, memo, receipt_condition, receipt_notes, buyer_completed, seller_completed, meetup_accepted, shipping_address, shipping_name, shipping_phone, tracking_number, shipping_company, shipping_proof_images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON DUPLICATE KEY UPDATE
         status=VALUES(status), proposed_price=VALUES(proposed_price),
         meetup_location=VALUES(meetup_location), meetup_time=VALUES(meetup_time),
         memo=VALUES(memo),
         receipt_condition=VALUES(receipt_condition), receipt_notes=VALUES(receipt_notes),
         buyer_completed=VALUES(buyer_completed), seller_completed=VALUES(seller_completed),
         meetup_accepted=VALUES(meetup_accepted),
         shipping_address=VALUES(shipping_address), shipping_name=VALUES(shipping_name),
         shipping_phone=VALUES(shipping_phone), tracking_number=VALUES(tracking_number),
         shipping_company=VALUES(shipping_company),
         shipping_proof_images=VALUES(shipping_proof_images)`,
      [
        id,
        product_id,
        buyer_id,
        seller_id,
        status || "PENDING_OFFER",
        proposed_price || 0,
        trade_method,
        clipText(meetupLocation, TEXT_LIMIT.meetupPlace),
        meetupDateTime,
        memo,
        receipt_condition || null,
        clipText(receipt_notes, TEXT_LIMIT.receiptNotes) || null,
        buyer_completed || false,
        seller_completed || false,
        meetup_accepted || false,
        shipping_address || null,
        shipping_name || null,
        shipping_phone || null,
        tracking_number || null,
        shipping_company || null,
        shipping_proof_images || [],
      ],
      "orders",
    );
    console.log("[POST /api/orders] SUCCESS", {
      id: rows[0].id,
      status: rows[0].status,
    });
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("[POST /api/orders] ERROR", e.message, "body:", req.body);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/orders/:id", requireDb, requireAuth, async (req, res) => {
  console.log("[PUT /api/orders/:id] REQUEST", {
    id: req.params.id,
    body: req.body,
    authUserId: req.authUserId,
  });
  try {
    const { rows: orderCheck } = await pool.query(
      "SELECT buyer_id, seller_id FROM orders WHERE id=$1",
      [req.params.id],
    );
    if (!orderCheck.length)
      return res.status(404).json({ error: "Order not found" });
    if (
      req.authUserId !== orderCheck[0].buyer_id &&
      req.authUserId !== orderCheck[0].seller_id
    ) {
      console.log("[PUT /api/orders/:id] FORBIDDEN", {
        authUserId: req.authUserId,
        buyerId: orderCheck[0].buyer_id,
        sellerId: orderCheck[0].seller_id,
      });
      return res.status(403).json({ error: "Forbidden" });
    }
    const changingMeetup =
      req.body.meetup_location !== undefined ||
      req.body.meetup_place !== undefined ||
      req.body.meetup_date !== undefined ||
      req.body.meetup_time !== undefined;
    if (changingMeetup && req.authUserId !== orderCheck[0].seller_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // ???? meetup_place/meetup_date? ???? DB?? meetup_location + meetup_time(combined)? ??
    const meetupLocation =
      req.body.meetup_location !== undefined
        ? req.body.meetup_location
        : req.body.meetup_place;
    let meetupTimeCombined;
    if (
      req.body.meetup_date !== undefined ||
      req.body.meetup_time !== undefined
    ) {
      const d = req.body.meetup_date || "";
      const t = req.body.meetup_time || "";
      meetupTimeCombined = d && t ? `${d} ${t}` : d || t;
    }
    const sets = [];
    const vals = [req.params.id];
    const fields = {
      status: req.body.status,
      meetup_location:
        meetupLocation !== undefined
          ? clipText(meetupLocation, TEXT_LIMIT.meetupPlace)
          : undefined,
      meetup_time: meetupTimeCombined,
      tracking_number: req.body.tracking_number,
      shipping_company: req.body.shipping_company,
      shipping_address: req.body.shipping_address,
      shipping_name: req.body.shipping_name,
      shipping_phone: req.body.shipping_phone,
      seller_completed: req.body.seller_completed,
      buyer_completed: req.body.buyer_completed,
      proposed_price: req.body.proposed_price,
      trade_method: req.body.trade_method,
      meetup_accepted: req.body.meetup_accepted,
      shipping_proof_images: req.body.shipping_proof_images,
      memo: req.body.memo,
      receipt_condition: req.body.receipt_condition,
      receipt_notes:
        req.body.receipt_notes !== undefined
          ? clipText(req.body.receipt_notes, TEXT_LIMIT.receiptNotes)
          : undefined,
    };
    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) {
        vals.push(val);
        sets.push(`${col}=$${vals.length}`);
      }
    }
    if (sets.length === 0)
      return res.status(400).json({ error: "No fields to update" });
    const { rows } = await queryReturning(
      `UPDATE orders SET ${sets.join(", ")} WHERE id=$1`,
      vals,
      "orders",
    );
    if (!rows.length) return res.status(404).json({ error: "Order not found" });
    console.log("[PUT /api/orders/:id] SUCCESS", {
      id: req.params.id,
      newStatus: rows[0].status,
      buyer_completed: rows[0].buyer_completed,
      seller_completed: rows[0].seller_completed,
    });
    if (rows[0].product_id) {
      await syncProductListingStatusFromOrders(rows[0].product_id);
    }
    res.json(rows[0]);
  } catch (e) {
    console.error("[PUT /api/orders/:id] error:", e.message, "body:", req.body);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/orders/:id", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT buyer_id, seller_id FROM orders WHERE id=$1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Order not found" });
    if (req.authUserId !== rows[0].buyer_id && req.authUserId !== rows[0].seller_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await pool.query("DELETE FROM orders WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ?? ???????? ????? ????
app.post(
  "/api/orders/:id/timeline",
  requireDb,
  requireAuth,
  async (req, res) => {
    const { id, event_type, type, description } = req.body;
    const evtType = event_type || type;
    try {
      const { rows: oCheck } = await pool.query(
        "SELECT buyer_id, seller_id FROM orders WHERE id=$1",
        [req.params.id],
      );
      if (!oCheck.length)
        return res.status(404).json({ error: "Order not found" });
      if (
        req.authUserId !== oCheck[0].buyer_id &&
        req.authUserId !== oCheck[0].seller_id
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { rows } = await queryReturning(
        `INSERT INTO order_timeline_events (id, order_id, type, description)
       VALUES ($1,$2,$3,$4)
       ON DUPLICATE KEY UPDATE id=id`,
        [id, req.params.id, evtType, description],
        "order_timeline_events",
        "id=$1",
        [id],
        { emptyOnNoChange: true },
      );
      res.status(201).json(rows[0] || {});
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ????????? ????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/chat-rooms", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.query.user_id)) return;
  // 필터가 없으면 전체 채팅방이 나가므로 항상 본인으로 범위를 좁힌다.
  const user_id = req.query.user_id || req.authUserId;
  try {
    let query = `SELECT cr.*,
      CASE WHEN COALESCE(p.admin_hidden, 0) = 1
                OR su.account_status = 'suspended'
           THEN 1 ELSE 0 END AS product_admin_hidden,
      ${jsonObjectSql("bu", "users")} AS buyer_user,
      ${jsonObjectSql("su", "users")} AS seller_user,
      ${jsonObjectSql("p", "products")} AS product_data
      FROM chat_rooms cr
      LEFT JOIN users bu ON cr.buyer_id = bu.id
      LEFT JOIN users su ON cr.seller_id = su.id
      LEFT JOIN products p ON cr.product_id = p.id
      WHERE 1=1`;
    const params = [];
    query += ` AND COALESCE(cr.admin_hidden, 0) = 0`;
    if (user_id) {
      params.push(user_id);
      // Hide only for users who left; the other party still sees the ended room
      query += ` AND (cr.buyer_id=$${params.length} OR cr.seller_id=$${params.length}) AND NOT JSON_CONTAINS(COALESCE(cr.left_user_ids, JSON_ARRAY()), JSON_QUOTE(CAST($${params.length} AS CHAR)))`;
    }
    query += " ORDER BY cr.last_message_time DESC";
    const { rows } = await pool.query(query, params);
    const result = rows.map((r) => {
      const otherUser = user_id === r.buyer_id ? r.seller_user : r.buyer_user;
      return {
        ...r,
        other_user: otherUser,
        product_data: r.product_data,
        buyer_user: undefined,
        seller_user: undefined,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * 로컬에만 남은 채팅방이 "아직 저장 전"인지 "서버에서 사라진(숨김·삭제) 방"인지 구분한다.
 * 서버가 아는 방 id만 돌려주므로, 목록에 없는데 여기 들어오면 로컬에서 지우면 된다.
 */
app.post("/api/chat-rooms/known", requireDb, requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.slice(0, 200).map(String).filter(Boolean)
    : [];
  if (!ids.length) return res.json({ ids: [] });
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const userParam = `$${ids.length + 1}`;
    const { rows } = await pool.query(
      `SELECT id FROM chat_rooms
        WHERE id IN (${placeholders})
          AND (buyer_id = ${userParam} OR seller_id = ${userParam})`,
      [...ids, req.authUserId],
    );
    res.json({ ids: rows.map((r) => String(r.id)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 프론트에서 언어별 문구로 치환하는 고정 문자열 (chatDisplay.ts와 짝) */
const CHAT_MSG_ADMIN_DELETED = "This message was removed by an admin.";

/** 관리자가 가린 메시지는 원문 대신 안내 문구만 내려준다. 원문은 DB에 남는다. */
function maskDeletedChatMessage(row) {
  if (!row || !row.deleted_at) return row;
  return {
    ...row,
    content: CHAT_MSG_ADMIN_DELETED,
    images: [],
    deleted_reason: undefined,
  };
}

app.get("/api/chat-rooms/:id/messages", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows: roomCheck } = await pool.query(
      "SELECT buyer_id, seller_id, admin_hidden FROM chat_rooms WHERE id=$1",
      [req.params.id],
    );
    if (!roomCheck.length)
      return res.status(404).json({ error: "Room not found" });
    if (
      req.authUserId !== roomCheck[0].buyer_id &&
      req.authUserId !== roomCheck[0].seller_id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (roomCheck[0].admin_hidden) {
      return res.status(404).json({ error: "Room not found" });
    }
    const { rows } = await pool.query(
      `SELECT m.*, ${jsonObjectSql("u", "users")} AS sender FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.room_id=$1 ORDER BY m.created_at ASC LIMIT 500`,
      [req.params.id],
    );
    res.json(rows.map(maskDeletedChatMessage));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 읽음 상태만 가볍게 조회 — Realtime 수신이 실패해도 읽음 표시가 갱신되도록
app.get("/api/chat-rooms/:id/read-state", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows } = await pool.query(
      "SELECT buyer_id, seller_id, read_state FROM chat_rooms WHERE id=$1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Room not found" });
    if (
      req.authUserId !== rows[0].buyer_id &&
      req.authUserId !== rows[0].seller_id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const readState =
      rows[0].read_state && typeof rows[0].read_state === "object"
        ? rows[0].read_state
        : {};
    res.json({ read_state: readState });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chat-rooms", requireDb, requireAuth, async (req, res) => {
  const { id, product_id, buyer_id, seller_id, order_id, left_user_ids, rejoin } =
    req.body;
  if (req.authUserId !== buyer_id && req.authUserId !== seller_id)
    return res.status(403).json({ error: "Forbidden" });
  try {
    const existingRoom = await pool.query(
      "SELECT id FROM chat_rooms WHERE id = $1 LIMIT 1",
      [id],
    );
    if (!existingRoom.rows.length && product_id) {
      const product = await pool.query(
        `SELECT p.admin_hidden, u.account_status AS seller_account_status
           FROM products p LEFT JOIN users u ON p.seller_id = u.id
          WHERE p.id = $1 LIMIT 1`,
        [product_id],
      );
      if (
        product.rows[0]?.admin_hidden ||
        product.rows[0]?.seller_account_status === "suspended"
      ) {
        return res.status(409).json({ error: "This listing is hidden by admin" });
      }
    }
    const leftIds = Array.isArray(left_user_ids) ? left_user_ids : [];
    const { rows } = await queryReturning(
      `INSERT INTO chat_rooms (id, product_id, buyer_id, seller_id, order_id, left_user_ids)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON DUPLICATE KEY UPDATE
         product_id = COALESCE(VALUES(product_id), product_id),
         order_id = COALESCE(VALUES(order_id), order_id),
         left_user_ids = IF($7, JSON_ARRAY(), COALESCE(VALUES(left_user_ids), left_user_ids))`,
      [
        id,
        product_id,
        buyer_id,
        seller_id,
        order_id || null,
        leftIds,
        rejoin ? 1 : 0,
      ],
      "chat_rooms",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/chat-rooms/:id", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows: roomCheck } = await pool.query(
      "SELECT buyer_id, seller_id, read_state, left_user_ids, admin_hidden FROM chat_rooms WHERE id=$1",
      [req.params.id],
    );
    if (!roomCheck.length)
      return res.status(404).json({ error: "Room not found" });
    if (
      req.authUserId !== roomCheck[0].buyer_id &&
      req.authUserId !== roomCheck[0].seller_id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (roomCheck[0].admin_hidden) {
      return res.status(409).json({ error: "This chat was hidden by an admin" });
    }

    const sets = [];
    const vals = [req.params.id];

    if (req.body.left_user_ids !== undefined) {
      vals.push(JSON.stringify(req.body.left_user_ids || []));
      sets.push(`left_user_ids=$${vals.length}`);
    }
    if (req.body.order_id !== undefined) {
      vals.push(req.body.order_id || null);
      sets.push(`order_id=$${vals.length}`);
    }
    if (req.body.read_state !== undefined && req.body.read_state) {
      const existing =
        roomCheck[0].read_state && typeof roomCheck[0].read_state === "object"
          ? roomCheck[0].read_state
          : {};
      const merged = { ...existing, ...req.body.read_state };
      vals.push(JSON.stringify(merged));
      sets.push(`read_state=$${vals.length}`);
    }

    if (sets.length === 0)
      return res.status(400).json({ error: "No fields to update" });

    const { rows } = await queryReturning(
      `UPDATE chat_rooms SET ${sets.join(", ")} WHERE id=$1`,
      vals,
      "chat_rooms",
    );
    if (!rows.length) return res.status(404).json({ error: "Room not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(
  "/api/chat-rooms/:id/messages",
  requireDb,
  requireAuth,
  async (req, res) => {
    const {
      id,
      sender_id,
      content,
      type,
      images,
      order_id,
      original_price,
      proposed_price,
      offer_result,
      meetup_location,
      meetup_time,
      meetup_place,
      meetup_date,
    } = req.body;
    if (
      sender_id &&
      sender_id !== req.authUserId &&
      sender_id !== "system"
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { rows: roomCheck } = await pool.query(
        "SELECT buyer_id, seller_id, admin_hidden, product_id FROM chat_rooms WHERE id=$1",
        [req.params.id],
      );
      if (!roomCheck.length)
        return res.status(404).json({ error: "Room not found" });
      if (
        req.authUserId !== roomCheck[0].buyer_id &&
        req.authUserId !== roomCheck[0].seller_id
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (roomCheck[0].admin_hidden) {
        return res.status(409).json({ error: "This chat was hidden by an admin" });
      }
      // 숨긴 상품·정지된 판매자는 대화만 남기고 새 거래(가격 제안)는 막는다.
      if (type === "price_offer" && roomCheck[0].product_id) {
        const { rows: productRows } = await pool.query(
          `SELECT p.admin_hidden, u.account_status AS seller_account_status
             FROM products p LEFT JOIN users u ON p.seller_id = u.id
            WHERE p.id = $1 LIMIT 1`,
          [roomCheck[0].product_id],
        );
        if (
          productRows[0]?.admin_hidden ||
          productRows[0]?.seller_account_status === "suspended"
        ) {
          return res.status(409).json({ error: "This listing is hidden by admin" });
        }
      }
      const effectiveSenderId =
        sender_id === "system" ? "system" : req.authUserId;
      const meetupLocation = meetup_place || meetup_location || null;
      const meetupTimeCombined =
        meetup_date && meetup_time
          ? `${meetup_date} ${meetup_time}`
          : meetup_time || null;
      const { rows } = await queryReturning(
        `INSERT INTO chat_messages (id, room_id, sender_id, content, type, images, order_id, original_price, proposed_price, offer_result, meetup_location, meetup_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON DUPLICATE KEY UPDATE id=id`,
        [
          id,
          req.params.id,
          effectiveSenderId,
          clipUserChatContent(content, type),
          type || "text",
          clipChatImages(images),
          order_id,
          original_price,
          proposed_price,
          offer_result,
          clipText(meetupLocation, TEXT_LIMIT.meetupPlace),
          meetupTimeCombined,
        ],
        "chat_messages",
        "id=$1",
        [id],
        { emptyOnNoChange: true },
      );
      // 메시지 저장과 함께 read_state 갱신: 수신자는 안 읽음, 발신자는 읽음.
      // (클라이언트 PATCH에 의존하면 폴링이 stale read_state를 덮어써 배지가 안 뜸)
      const { rows: roomRows } = await pool.query(
        "SELECT buyer_id, seller_id, read_state FROM chat_rooms WHERE id=$1",
        [req.params.id],
      );
      const room = roomRows[0];
      const readState =
        room && room.read_state && typeof room.read_state === "object"
          ? { ...room.read_state }
          : {};
      if (room) {
        [room.buyer_id, room.seller_id].forEach((uid) => {
          if (uid && uid !== effectiveSenderId) {
            readState[uid] = { ...(readState[uid] || {}), read: false };
          }
        });
        if (effectiveSenderId && effectiveSenderId !== "system") {
          readState[effectiveSenderId] = {
            ...(readState[effectiveSenderId] || {}),
            read: true,
            lastReadAt: new Date().toISOString(),
          };
        }
      }
      await pool.query(
        `UPDATE chat_rooms SET last_message=$2, last_message_time=NOW(), read_state=$3 WHERE id=$1`,
        [req.params.id, content, JSON.stringify(readState)],
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ????????? ???????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/posts", requireDb, async (req, res) => {
  const { category, author_id } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  try {
    let query = `SELECT p.*, ${jsonObjectSql("u", "users")} AS author,
      ${jsonObjectSql("ap", "products")} AS attached_product
      FROM community_posts p
                 LEFT JOIN users u ON p.author_id = u.id
                 LEFT JOIN products ap ON p.attached_product_id = ap.id
                 WHERE 1=1`;
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND p.category=$${params.length}`;
    }
    if (author_id) {
      params.push(author_id);
      query += ` AND p.author_id=$${params.length}`;
    }
    if (req.authUserId) {
      params.push(req.authUserId);
      query += ` AND (COALESCE(p.admin_hidden, 0) = 0 OR p.author_id = $${params.length})`;
    } else {
      query += ` AND COALESCE(p.admin_hidden, 0) = 0`;
    }
    params.push(limit, offset);
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/posts/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, ${jsonObjectSql("u", "users")} AS author,
      ${jsonObjectSql("ap", "products")} AS attached_product
      FROM community_posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN products ap ON p.attached_product_id = ap.id
      WHERE p.id=$1 LIMIT 1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    if (rows[0].admin_hidden && rows[0].author_id !== req.authUserId) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/posts", requireDb, requireAuth, async (req, res) => {
  const {
    id,
    title,
    content,
    category,
    author_id,
    images,
    tags,
    region,
    latitude,
    longitude,
    order_id,
    attached_product_id,
  } = req.body;
  if (author_id && req.authUserId !== author_id)
    return res.status(403).json({ error: "Forbidden" });
  const effectiveAuthorId = req.authUserId;
  try {
    if (id) {
      const { rows: existingPost } = await pool.query(
        "SELECT author_id FROM community_posts WHERE id=$1",
        [id],
      );
      if (
        existingPost.length &&
        existingPost[0].author_id !== req.authUserId
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const { rows } = await queryReturning(
      `INSERT INTO community_posts (id, title, content, category, author_id, images, tags, region, latitude, longitude, order_id, attached_product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), content=VALUES(content), category=VALUES(category),
         images=VALUES(images), tags=VALUES(tags), region=VALUES(region)`,
      [
        id,
        clipText(title, TEXT_LIMIT.postTitle),
        clipText(content, TEXT_LIMIT.postBody),
        category,
        effectiveAuthorId,
        images || [],
        tags || [],
        region,
        latitude,
        longitude,
        order_id,
        attached_product_id,
      ],
      "community_posts",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/posts/:id", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT author_id FROM community_posts WHERE id=$1",
      [req.params.id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Post not found" });
    if (existing[0].author_id !== req.authUserId)
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM community_posts WHERE id=$1", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ?????
app.get("/api/posts/:id/comments", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, ${jsonObjectSql("u", "users")} AS author FROM comments c
       LEFT JOIN users u ON c.author_id = u.id
       WHERE c.post_id=$1
         AND (COALESCE(c.admin_hidden, 0) = 0${req.authUserId ? " OR c.author_id = $2" : ""})
       ORDER BY c.created_at ASC`,
      req.authUserId ? [req.params.id, req.authUserId] : [req.params.id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(
  "/api/posts/:id/comments",
  requireDb,
  requireAuth,
  async (req, res) => {
    const { id, author_id, content, parent_id } = req.body;
    if (author_id && req.authUserId !== author_id)
      return res.status(403).json({ error: "Forbidden" });
    try {
      const { rows } = await queryReturning(
        `INSERT INTO comments (id, post_id, author_id, content, parent_id)
       VALUES ($1,$2,$3,$4,$5)
       ON DUPLICATE KEY UPDATE id=id`,
        [id, req.params.id, author_id, clipText(content, TEXT_LIMIT.comment), parent_id],
        "comments",
        "id=$1",
        [id],
        { emptyOnNoChange: true },
      );
      if (rows.length > 0) {
        await pool.query(
          `UPDATE community_posts SET comment_count = comment_count + 1 WHERE id=$1`,
          [req.params.id],
        );
      }
      const countRes = await pool.query(
        `SELECT comment_count FROM community_posts WHERE id=$1 LIMIT 1`,
        [req.params.id],
      );
      res.status(201).json({
        count: Number(countRes.rows[0]?.comment_count || 0),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete("/api/comments/:id", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT author_id, post_id FROM comments WHERE id=$1",
      [req.params.id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Comment not found" });
    if (existing[0].author_id !== req.authUserId)
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM comments WHERE id=$1", [req.params.id]);
    await pool.query(
      `UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id=$1`,
      [existing[0].post_id],
    );
    const countRes = await pool.query(
      `SELECT comment_count FROM community_posts WHERE id=$1 LIMIT 1`,
      [existing[0].post_id],
    );
    res.json({ count: Number(countRes.rows[0]?.comment_count || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ?? ?? ??: { liked, count }
app.get("/api/posts/:id/likes", requireDb, async (req, res) => {
  const { user_id } = req.query;
  try {
    const countRes = await pool.query(
      `SELECT COUNT(*) AS count FROM post_likes WHERE post_id=$1`,
      [req.params.id],
    );
    let liked = false;
    if (user_id) {
      const likedRes = await pool.query(
        `SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2 LIMIT 1`,
        [req.params.id, user_id],
      );
      liked = likedRes.rows.length > 0;
    }
    res.json({ liked, count: countRes.rows[0].count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Post comment count */
app.get("/api/posts/:id/comment-count", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT comment_count FROM community_posts WHERE id=$1 LIMIT 1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ count: Number(rows[0].comment_count || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function getDailyViewDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 하루 1회 집계용 열람자 키.
 *
 * 비로그인 사용자는 클라이언트가 보내오는 식별자를 쓰지 않는다. 그 값은
 * 요청마다 마음대로 바꿀 수 있어 조회수를 무한히 부풀릴 수 있었다.
 * 대신 서버가 직접 보는 IP 를 기준으로 하되, 같은 IP(공유기·통신사 NAT)
 * 뒤의 서로 다른 기기가 전부 1명으로 합쳐지지 않도록 브라우저 정보를
 * 16개 그룹으로 뭉뚱그려 섞는다. 그래서 한 IP 가 하루에 올릴 수 있는
 * 조회수는 글 하나당 최대 16 으로 묶인다.
 */
function getDailyViewerKey(req) {
  if (req.authUserId) {
    return crypto
      .createHash("sha256")
      .update(`user:${req.authUserId}`)
      .digest("hex");
  }
  const uaBucket = crypto
    .createHash("sha256")
    .update(String(req.headers["user-agent"] || ""))
    .digest("hex")
    .slice(0, 1);
  return crypto
    .createHash("sha256")
    .update(`client:${req.ip || "unknown"}|${uaBucket}`)
    .digest("hex");
}

async function recordDailyContentView(req, targetType, targetId, tableName) {
  const inserted = await pool.query(
    `INSERT IGNORE INTO content_views
       (target_type, target_id, viewer_key, view_date)
     VALUES ($1, $2, $3, $4)`,
    [targetType, targetId, getDailyViewerKey(req), getDailyViewDate()],
  );

  if (inserted.rowCount > 0) {
    await pool.query(
      `UPDATE ${tableName} SET view_count = view_count + 1 WHERE id = $1`,
      [targetId],
    );
  }

  const { rows } = await pool.query(
    `SELECT view_count FROM ${tableName} WHERE id = $1 LIMIT 1`,
    [targetId],
  );
  return {
    found: rows.length > 0,
    count: rows.length ? Number(rows[0].view_count || 0) : 0,
    counted: inserted.rowCount > 0,
  };
}

/** Post view count */
app.get("/api/posts/:id/views", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT view_count FROM community_posts WHERE id=$1 LIMIT 1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ count: Number(rows[0].view_count || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/posts/:id/view", requireDb, async (req, res) => {
  try {
    const post = await pool.query(
      `SELECT author_id, view_count FROM community_posts WHERE id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (!post.rows.length) return res.status(404).json({ error: "Not found" });

    if (req.authUserId && post.rows[0].author_id === req.authUserId) {
      return res.json({
        count: Number(post.rows[0].view_count || 0),
        counted: false,
      });
    }

    const result = await recordDailyContentView(
      req,
      "post",
      req.params.id,
      "community_posts",
    );
    res.json({ count: result.count, counted: result.counted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ??? ??
app.post("/api/posts/:id/like", requireDb, requireAuth, async (req, res) => {
  const userId = req.authUserId;
  const postId = req.params.id;
  try {
    // ?? upsert(FK ?? ??)
    await pool.query(
      `INSERT INTO users (id, nickname, kyc_status) VALUES ($1, $1, 'unverified') ON DUPLICATE KEY UPDATE id=id`,
      [userId],
    );
    const ins = await pool.query(
      `INSERT INTO post_likes (user_id, post_id) VALUES ($1,$2) ON DUPLICATE KEY UPDATE user_id=user_id`,
      [userId, postId],
    );
    if (ins.rowCount > 0) {
      await pool.query(
        `UPDATE community_posts SET like_count = like_count + 1 WHERE id=$1`,
        [postId],
      );
    }
    const countRes = await pool.query(
      `SELECT COUNT(*) AS count FROM post_likes WHERE post_id=$1`,
      [postId],
    );
    res.json({ liked: true, count: countRes.rows[0].count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ??? ??
app.delete("/api/posts/:id/like", requireDb, requireAuth, async (req, res) => {
  const userId = req.authUserId;
  const postId = req.params.id;
  try {
    const del = await pool.query(
      `DELETE FROM post_likes WHERE user_id=$1 AND post_id=$2`,
      [userId, postId],
    );
    if (del.rowCount > 0) {
      await pool.query(
        `UPDATE community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id=$1`,
        [postId],
      );
    }
    const countRes = await pool.query(
      `SELECT COUNT(*) AS count FROM post_likes WHERE post_id=$1`,
      [postId],
    );
    res.json({ liked: false, count: countRes.rows[0].count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 분쟁 게시글 Up/Down 투표 조회
app.get("/api/posts/:id/dispute-votes", requireDb, async (req, res) => {
  const { user_id } = req.query;
  const postId = req.params.id;
  try {
    const countRes = await pool.query(
      `SELECT
        SUM(CASE WHEN vote = 'like' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN vote = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
       FROM dispute_post_votes WHERE post_id=$1`,
      [postId],
    );
    let vote = null;
    if (user_id) {
      const myRes = await pool.query(
        `SELECT vote FROM dispute_post_votes WHERE post_id=$1 AND user_id=$2 LIMIT 1`,
        [postId, user_id],
      );
      vote = myRes.rows[0]?.vote || null;
    }
    res.json({
      vote,
      likeCount: Number(countRes.rows[0]?.like_count || 0),
      dislikeCount: Number(countRes.rows[0]?.dislike_count || 0),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 분쟁 게시글 Up/Down 투표 (같은 버튼 재클릭 시 해제, 반대 버튼은 전환)
app.put("/api/posts/:id/dispute-vote", requireDb, requireAuth, async (req, res) => {
  const userId = req.authUserId;
  const postId = req.params.id;
  const { vote } = req.body || {};
  if (vote !== "like" && vote !== "dislike") {
    return res.status(400).json({ error: "vote must be like or dislike" });
  }
  try {
    await pool.query(
      `INSERT INTO users (id, nickname, kyc_status) VALUES ($1, $1, 'unverified') ON DUPLICATE KEY UPDATE id=id`,
      [userId],
    );
    const existing = await pool.query(
      `SELECT vote FROM dispute_post_votes WHERE user_id=$1 AND post_id=$2 LIMIT 1`,
      [userId, postId],
    );
    if (existing.rows.length && existing.rows[0].vote === vote) {
      await pool.query(
        `DELETE FROM dispute_post_votes WHERE user_id=$1 AND post_id=$2`,
        [userId, postId],
      );
    } else {
      await pool.query(
        `INSERT INTO dispute_post_votes (user_id, post_id, vote) VALUES ($1,$2,$3)
         ON DUPLICATE KEY UPDATE vote=$3`,
        [userId, postId, vote],
      );
    }
    const countRes = await pool.query(
      `SELECT
        SUM(CASE WHEN vote = 'like' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN vote = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
       FROM dispute_post_votes WHERE post_id=$1`,
      [postId],
    );
    const myRes = await pool.query(
      `SELECT vote FROM dispute_post_votes WHERE post_id=$1 AND user_id=$2 LIMIT 1`,
      [postId, userId],
    );
    res.json({
      vote: myRes.rows[0]?.vote || null,
      likeCount: Number(countRes.rows[0]?.like_count || 0),
      dislikeCount: Number(countRes.rows[0]?.dislike_count || 0),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ?? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/reviews", requireDb, async (req, res) => {
  const { reviewee_id, reviewer_id, order_id } = req.query;
  try {
    let query = `SELECT r.*, ${jsonObjectSql("u", "users")} AS reviewer FROM reviews r
                 LEFT JOIN users u ON r.reviewer_id = u.id WHERE 1=1`;
    const params = [];
    if (reviewee_id) {
      params.push(reviewee_id);
      query += ` AND r.reviewee_id=$${params.length}`;
    }
    if (reviewer_id) {
      params.push(reviewer_id);
      query += ` AND r.reviewer_id=$${params.length}`;
    }
    if (order_id) {
      params.push(order_id);
      query += ` AND r.order_id=$${params.length}`;
    }
    query += " ORDER BY r.created_at DESC LIMIT 200";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/reviews", requireDb, requireAuth, async (req, res) => {
  const {
    id,
    reviewer_id,
    reviewee_id,
    order_id,
    rating,
    tags,
    comment,
    product_title,
    product_image,
  } = req.body;
  console.log("[POST /api/reviews] REQUEST", {
    id,
    reviewer_id,
    reviewee_id,
    order_id,
    rating,
    authUserId: req.authUserId,
  });
  if (reviewer_id && req.authUserId !== reviewer_id) {
    console.log("[POST /api/reviews] FORBIDDEN", {
      authUserId: req.authUserId,
      reviewer_id,
    });
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!reviewee_id) {
    console.log("[POST /api/reviews] SKIP - empty reviewee_id");
    return res.status(400).json({ error: "reviewee_id required" });
  }
  try {
    // FK ?? ??: reviewer/reviewee ???? ??? ?? ??
    await pool.query(
      `INSERT INTO users (id, nickname, kyc_status) VALUES ($1, $1, 'unverified')
       ON DUPLICATE KEY UPDATE id=id`,
      [reviewer_id],
    );
    await pool.query(
      `INSERT INTO users (id, nickname, kyc_status) VALUES ($1, $1, 'unverified')
       ON DUPLICATE KEY UPDATE id=id`,
      [reviewee_id],
    );
    const dup = await pool.query(
      `SELECT id FROM reviews WHERE order_id=$1 AND reviewer_id=$2 LIMIT 1`,
      [order_id, reviewer_id],
    );
    if (dup.rows.length) {
      return res.status(409).json({ error: "You already reviewed this order" });
    }
    const { rows } = await queryReturning(
      `INSERT INTO reviews (id, reviewer_id, reviewee_id, order_id, rating, tags, comment, product_title, product_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        reviewer_id,
        reviewee_id,
        order_id,
        rating,
        tags || [],
        clipText(comment, TEXT_LIMIT.reviewComment),
        product_title,
        product_image,
      ],
      "reviews",
    );
    console.log("[POST /api/reviews] SUCCESS", { id: rows[0]?.id });
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("[POST /api/reviews] ERROR", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ????????? ???? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/notifications", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.query.target_user_id)) return;
  const target_user_id = req.query.target_user_id || req.authUserId;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE target_user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [target_user_id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 알림은 본인, 거래 상대, 또는 내 글에 댓글 단 사람에게만 보낼 수 있다. */
async function hasTradeRelationship(actorId, targetId) {
  if (!actorId || !targetId) return false;
  if (actorId === targetId) return true;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM chat_rooms
       WHERE (buyer_id=$1 AND seller_id=$2) OR (buyer_id=$2 AND seller_id=$1)
       LIMIT 1`,
      [actorId, targetId],
    );
    if (rows.length) return true;
    const { rows: orderRows } = await pool.query(
      `SELECT 1 FROM orders
       WHERE (buyer_id=$1 AND seller_id=$2) OR (buyer_id=$2 AND seller_id=$1)
       LIMIT 1`,
      [actorId, targetId],
    );
    return orderRows.length > 0;
  } catch (e) {
    // 조회 자체가 실패하면 알림을 잃지 않도록 통과시킨다 (인증은 이미 통과한 상태)
    console.warn("[notifications] relationship check failed:", e.message);
    return true;
  }
}

async function canNotifyPostAuthor(actorId, targetId, type, link) {
  if (type !== "comment" || typeof link !== "string") return false;
  const m = link.match(/^\/community\/post\/([^/?#]+)/);
  if (!m) return false;
  try {
    const { rows } = await pool.query(
      "SELECT author_id FROM community_posts WHERE id=$1 LIMIT 1",
      [m[1]],
    );
    return Boolean(rows[0] && rows[0].author_id === targetId && actorId !== targetId);
  } catch (e) {
    console.warn("[notifications] post-author check failed:", e.message);
    return false;
  }
}

app.post("/api/notifications", requireDb, async (req, res) => {
  const { id, target_user_id, type, link } = req.body;
  if (!requireSession(req, res)) return;
  if (!target_user_id)
    return res.status(400).json({ error: "target_user_id required" });
  if (
    !(await hasTradeRelationship(req.authUserId, target_user_id)) &&
    !(await canNotifyPostAuthor(req.authUserId, target_user_id, type, link))
  )
    return res.status(403).json({ error: "Forbidden" });
  const clamp = (v, max) =>
    typeof v === "string" ? v.slice(0, max) : v == null ? null : String(v).slice(0, max);
  const title = clamp(req.body.title, 200);
  const content = clamp(req.body.content, 2000);
  console.log("[POST /api/notifications] REQUEST", {
    id,
    target_user_id,
    type,
    title,
  });
  try {
    const { rows } = await queryReturning(
      `INSERT INTO notifications (id, target_user_id, type, title, content, link)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON DUPLICATE KEY UPDATE id=id`,
      [id, target_user_id, type, title, content, link],
      "notifications",
      "id=$1",
      [id],
      { emptyOnNoChange: true },
    );
    console.log("[POST /api/notifications] SUCCESS", {
      id,
      inserted: rows.length > 0,
    });
    res.status(201).json(rows[0] || {});
  } catch (e) {
    console.error("[POST /api/notifications] ERROR", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/notifications/:id/read", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows: nCheck } = await pool.query(
      "SELECT target_user_id FROM notifications WHERE id=$1",
      [req.params.id],
    );
    if (nCheck.length && nCheck[0].target_user_id !== req.authUserId)
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("UPDATE notifications SET `read`=true WHERE id=$1", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/notifications/:id", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const { rows: nCheck } = await pool.query(
      "SELECT target_user_id FROM notifications WHERE id=$1",
      [req.params.id],
    );
    if (!nCheck.length) return res.json({ ok: true });
    if (nCheck[0].target_user_id !== req.authUserId)
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM notifications WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/notifications/bulk-delete", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (ids.length === 0) return res.status(400).json({ error: "ids required" });
  try {
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    await pool.query(
      `DELETE FROM notifications WHERE target_user_id=$1 AND id IN (${placeholders})`,
      [req.authUserId, ...ids],
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/disputes", requireDb, async (req, res) => {
  const { seller_id } = req.query;
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.query.buyer_id, seller_id)) return;
  // 필터가 없으면 전체 분쟁이 나가므로 항상 본인으로 범위를 좁힌다.
  const buyer_id = seller_id ? req.query.buyer_id : req.authUserId;
  try {
    let query = "SELECT * FROM disputes WHERE 1=1";
    const params = [];
    if (buyer_id) {
      params.push(buyer_id);
      query += ` AND buyer_id=$${params.length}`;
    }
    if (seller_id) {
      params.push(seller_id);
      query += ` AND seller_id=$${params.length}`;
    }
    query += " ORDER BY created_at DESC LIMIT 200";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/disputes", requireDb, requireAuth, async (req, res) => {
  const {
    id,
    order_id,
    product_title,
    product_image,
    proposed_price,
    trade_method,
    buyer_id,
    seller_id,
    reason,
    action,
    description,
    evidence,
  } = req.body;
  if (req.authUserId !== buyer_id && req.authUserId !== seller_id)
    return res.status(403).json({ error: "Forbidden" });
  try {
    const { rows } = await queryReturning(
      `INSERT INTO disputes (id, order_id, product_title, product_image, proposed_price, trade_method, buyer_id, seller_id, opened_by_user_id, reason, action, description, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON DUPLICATE KEY UPDATE id=id`,
      [
        id,
        order_id,
        product_title,
        product_image,
        proposed_price,
        trade_method,
        buyer_id,
        seller_id,
        req.authUserId,
        reason,
        action,
        clipText(description, TEXT_LIMIT.disputeDetails),
        Array.isArray(evidence) ? evidence.slice(0, 5) : [],
      ],
      "disputes",
      "order_id=$1 AND opened_by_user_id=$2",
      [order_id, req.authUserId],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Buyer/seller: update dispute status (mutual resolve or request review) */
app.put("/api/disputes/:id", requireDb, requireAuth, async (req, res) => {
  const { status, admin_response } = req.body;
  const allowed = ["IN_REVIEW", "RESOLVED"];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    const check = await pool.query(
      "SELECT buyer_id, seller_id, opened_by_user_id FROM disputes WHERE id=$1",
      [req.params.id],
    );
    if (!check.rows.length) return res.status(404).json({ error: "Not found" });
    const row = check.rows[0];
    if (req.authUserId !== row.buyer_id && req.authUserId !== row.seller_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!row.opened_by_user_id || req.authUserId !== row.opened_by_user_id) {
      return res.status(403).json({ error: "Only the party who filed the dispute can update it" });
    }
    const { rows } = await queryReturning(
      `UPDATE disputes SET status=$1, admin_response=COALESCE($2, admin_response),
       resolved_at=${status === "RESOLVED" ? "NOW()" : "resolved_at"}
       WHERE id=$3`,
      [status, admin_response ?? null, req.params.id],
      "disputes",
      "id=$1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ???? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/favorites", requireDb, async (req, res) => {
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.query.user_id)) return;
  const user_id = req.query.user_id || req.authUserId;
  try {
    const { rows } = await pool.query(
      `SELECT f.*, ${jsonObjectSql("p", "products")} AS product FROM favorites f
       LEFT JOIN products p ON f.product_id = p.id
       WHERE f.user_id=$1 ORDER BY f.created_at DESC`,
      [user_id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/favorites", requireDb, async (req, res) => {
  const { product_id } = req.body;
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.body.user_id)) return;
  const user_id = req.authUserId;
  try {
    const { rows } = await queryReturning(
      `INSERT INTO favorites (user_id, product_id) VALUES ($1,$2)
       ON DUPLICATE KEY UPDATE user_id=user_id`,
      [user_id, product_id],
      "favorites",
      "user_id=$1 AND product_id=$2",
      [user_id, product_id],
      { emptyOnNoChange: true },
    );
    res.status(201).json(rows[0] || { user_id, product_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/favorites", requireDb, async (req, res) => {
  const { product_id } = req.query;
  if (!requireSession(req, res)) return;
  if (denyOtherUser(req, res, req.query.user_id)) return;
  const user_id = req.authUserId;
  try {
    await pool.query(
      "DELETE FROM favorites WHERE user_id=$1 AND product_id=$2",
      [user_id, product_id],
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ?? ??? (??? ??? API DB) ???????????????????????????????????????????????????????????????????????????????????????????????????
app.post("/api/inquiries", requireDb, async (req, res) => {
  const { user_id, email, category, title, content, images } = req.body;
  if (!requireSession(req, res)) return;
  if (!title || !String(title).trim() || !content || !String(content).trim()) {
    return res.status(400).json({ error: "title and content are required" });
  }
  if (denyOtherUser(req, res, user_id)) return;
  const id = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const cat = (category || "general").toString().slice(0, 200);
  const imgs = Array.isArray(images) ? images.slice(0, 5).map(String) : [];
  try {
    const { rows } = await queryReturning(
      `INSERT INTO inquiries (id, user_id, email, category, title, content, images, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
      `,
      [
        id,
        req.authUserId,
        email ? clipText(String(email).trim(), TEXT_LIMIT.inquiryEmail) : null,
        cat,
        clipText(String(title).trim(), TEXT_LIMIT.inquiryTitle),
        clipText(String(content).trim(), TEXT_LIMIT.inquiryContent),
        imgs,
      ],
      "inquiries",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User: list own inquiries (authenticated)
app.get("/api/inquiries", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, email, category, title, content, images, status,
              admin_reply, created_at, replied_at
         FROM inquiries
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [req.authUserId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ?????? API ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_PASSWORD)
    return res.status(503).json({ error: "Admin not configured" });
  if (isValidAdminToken(req.headers["x-admin-token"])) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// 비밀번호를 단기 토큰으로 교환한다. 실패는 IP 단위로 누적 차단.
app.post("/api/admin/login", (req, res) => {
  if (!process.env.ADMIN_PASSWORD)
    return res.status(503).json({ error: "Admin not configured" });
  if (adminLockedOut(req.ip)) {
    console.warn(`[admin] login locked out ip=${req.ip}`);
    return res.status(429).json({ error: "Too many attempts" });
  }
  if (!matchesAdminPassword(req.body?.password)) {
    recordAdminFailure(req.ip);
    console.warn(`[admin] login failed ip=${req.ip}`);
    return res.status(401).json({ error: "Unauthorized" });
  }
  adminFailures.delete(req.ip);
  const token = issueAdminToken();
  console.log(`[admin] login ok ip=${req.ip} token=${token.slice(0, 8)}…`);
  res.json({ token, expires_in: ADMIN_TOKEN_TTL_MS });
});

app.post("/api/admin/logout", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (typeof token === "string") adminTokens.delete(token);
  res.json({ ok: true });
});

// ?????????? ?????
app.get("/api/admin/stats", requireDb, requireAdmin, async (_req, res) => {
  const zero = () => ({ rows: [{ count: "0" }] });
  const emptyRows = () => ({ rows: [] });
  try {
    const r = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM products"),
      pool.query("SELECT COUNT(*) FROM orders"),
      pool.query("SELECT COUNT(*) FROM community_posts"),
      pool.query("SELECT COUNT(*) FROM chat_rooms"),
      pool.query("SELECT COUNT(*) FROM disputes"),
      pool.query("SELECT COUNT(*) FROM reviews"),
      pool.query("SELECT COUNT(*) FROM disputes WHERE status='OPEN'"),
      pool.query(
        `SELECT COUNT(*) FROM orders o
          WHERE ${orderDisplayStatusSql("o")} <> '${ORDER_STATUS_DISPUTE}'
            AND (${orderDisplayStatusSql("o")} IN ('완료','수령완료','completed','complete')
                 OR (o.buyer_completed = true AND o.seller_completed = true))`,
      ),
      pool.query("SELECT COUNT(*) FROM products WHERE is_free_share=true"),
      pool.query("SELECT COUNT(*) FROM inquiries").catch(zero),
      pool.query("SELECT COUNT(*) FROM reports").catch(zero),
      pool.query("SELECT COUNT(*) FROM reports WHERE status='open'").catch(zero),
      pool
        .query("SELECT COUNT(*) FROM inquiries WHERE status='pending'")
        .catch(zero),
      pool
        .query("SELECT COUNT(*) FROM users WHERE account_status='suspended'")
        .catch(zero),
      pool
        .query("SELECT COUNT(*) FROM products WHERE admin_hidden=true")
        .catch(zero),
      pool
        .query("SELECT COUNT(*) FROM users WHERE created_at >= CURDATE()")
        .catch(zero),
      pool
        .query(
          "SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
        )
        .catch(zero),
      pool
        .query(
          `SELECT COUNT(*) FROM products p WHERE ${productListingStatusSql("p")}='${PRODUCT_STATUS_FOR_SALE}'`,
        )
        .catch(zero),
      pool
        .query(
          `SELECT COUNT(*) FROM products p WHERE ${productListingStatusSql("p")}='${PRODUCT_STATUS_RESERVED}'`,
        )
        .catch(zero),
      pool
        .query(
          `SELECT COUNT(*) FROM products p WHERE ${productListingStatusSql("p")}='${PRODUCT_STATUS_SOLD}'`,
        )
        .catch(zero),
      pool
        .query(
          `SELECT COUNT(*) FROM orders o
            WHERE ${orderDisplayStatusSql("o")} IN ('제안중','pending_offer')`,
        )
        .catch(zero),
      pool
        .query(
          `SELECT COUNT(*) FROM orders o
            WHERE ${orderDisplayStatusSql("o")}='${ORDER_STATUS_DISPUTE}'`,
        )
        .catch(zero),
      pool
        .query(
          `SELECT COUNT(*) FROM orders o
            WHERE ${orderDisplayStatusSql("o")} NOT IN ('completed','complete','완료','수령완료','제안중','pending_offer','제안거절','offer_declined','분쟁','dispute','관리자해결')
              AND NOT (o.buyer_completed = true AND o.seller_completed = true)`,
        )
        .catch(zero),
      pool
        .query("SELECT COUNT(*) FROM notices WHERE published=true")
        .catch(zero),
      pool
        .query("SELECT COUNT(*) FROM home_popups WHERE enabled=true")
        .catch(zero),
      pool.query(
        "SELECT id, nickname, created_at FROM users ORDER BY created_at DESC LIMIT 5",
      ),
      pool.query(
        `SELECT id, ${orderDisplayStatusSql("o")} AS status, created_at
           FROM orders o ORDER BY created_at DESC LIMIT 5`,
      ),
      pool
        .query(
          `SELECT id, target_type, reason, status, created_at
           FROM reports WHERE status='open'
           ORDER BY created_at DESC LIMIT 5`,
        )
        .catch(emptyRows),
      pool
        .query(
          `SELECT id, title, status, created_at
           FROM inquiries WHERE status='pending'
           ORDER BY created_at DESC LIMIT 5`,
        )
        .catch(emptyRows),
      pool
        .query(
          `SELECT id, reason, status, created_at
           FROM disputes WHERE status='OPEN'
           ORDER BY created_at DESC LIMIT 5`,
        )
        .catch(emptyRows),
    ]);
    const payments = await fetchPaymentSummary();
    res.json({
      payments,
      users: +r[0].rows[0].count,
      products: +r[1].rows[0].count,
      orders: +r[2].rows[0].count,
      posts: +r[3].rows[0].count,
      chatRooms: +r[4].rows[0].count,
      disputes: +r[5].rows[0].count,
      reviews: +r[6].rows[0].count,
      openDisputes: +r[7].rows[0].count,
      completedOrders: +r[8].rows[0].count,
      freeShareProducts: +r[9].rows[0].count,
      inquiries: +r[10].rows[0].count,
      reports: +r[11].rows[0].count,
      openReports: +r[12].rows[0].count,
      pendingInquiries: +r[13].rows[0].count,
      suspendedUsers: +r[14].rows[0].count,
      hiddenProducts: +r[15].rows[0].count,
      usersToday: +r[16].rows[0].count,
      usersWeek: +r[17].rows[0].count,
      productsForSale: +r[18].rows[0].count,
      productsReserved: +r[19].rows[0].count,
      productsSold: +r[20].rows[0].count,
      ordersPending: +r[21].rows[0].count,
      ordersDispute: +r[22].rows[0].count,
      ordersInProgress: +r[23].rows[0].count,
      publishedNotices: +r[24].rows[0].count,
      enabledPopups: +r[25].rows[0].count,
      recentUsers: r[26].rows,
      recentOrders: r[27].rows,
      recentOpenReports: r[28].rows,
      recentPendingInquiries: r[29].rows,
      recentOpenDisputes: r[30].rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ??? ????? ??
app.get("/api/admin/users", requireDb, requireAdmin, async (req, res) => {
  const activityCounts = `,
              (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS product_count,
              (SELECT COUNT(*) FROM community_posts cp WHERE cp.author_id = u.id) AS post_count,
              (SELECT COUNT(*) FROM reports r
                WHERE r.reporter_id = u.id OR (r.target_type = 'user' AND r.target_id = u.id)) AS report_count,
              (SELECT COUNT(*) FROM disputes d
                WHERE d.buyer_id = u.id OR d.seller_id = u.id) AS dispute_count`;
  const liveRep = `,
              ${userLiveTrustSql("u")} AS trust_score,
              ${userLiveRatingSql("u")} AS rating,
              ${userLiveTradeCountSql("u")} AS trade_count`;
  const fullSelect = `SELECT id, nickname, profile_image, bio, kyc_status,
              activity_region, seller_type, pi_verified, pi_username,
              account_status, suspension_reason, suspended_at, created_at
              ${liveRep}
              ${activityCounts}
       FROM users u ORDER BY created_at DESC LIMIT 500`;
  const fallbackSelect = `SELECT id, nickname, profile_image, bio, kyc_status,
              activity_region, seller_type, pi_verified,
              account_status, suspension_reason, suspended_at, created_at
              ${liveRep}
              ${activityCounts}
       FROM users u ORDER BY created_at DESC LIMIT 500`;
  try {
    let rows;
    try {
      ({ rows } = await pool.query(fullSelect));
    } catch (e) {
      if (/pi_username|Unknown column/i.test(String(e.message))) {
        console.warn("[admin/users] pi_username column missing — fallback query");
        ({ rows } = await pool.query(fallbackSelect));
        rows = rows.map((row) => ({ ...row, pi_username: null }));
      } else {
        throw e;
      }
    }
    res.json(rows);
  } catch (e) {
    console.error("[admin/users] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ????? ??????
app.get("/api/admin/users/:id", requireDb, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id=$1", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const [products, orders, posts, reports, disputes, reputation] = await Promise.all([
      pool.query(
        `SELECT id, title, ${productListingStatusSql("p")} AS status, price, admin_hidden, created_at
           FROM products p WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [req.params.id],
      ),
      pool.query(
        `SELECT id, product_id, buyer_id, seller_id,
                ${orderDisplayStatusSql("o")} AS status, proposed_price, created_at
           FROM orders o WHERE buyer_id=$1 OR seller_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [req.params.id],
      ),
      pool.query(
        "SELECT id,title,category,view_count,created_at FROM community_posts WHERE author_id=$1 ORDER BY created_at DESC LIMIT 100",
        [req.params.id],
      ),
      pool.query(
        `SELECT id,target_type,target_id,reason,status,created_at
           FROM reports
          WHERE reporter_id=$1 OR (target_type='user' AND target_id=$1)
          ORDER BY created_at DESC LIMIT 100`,
        [req.params.id],
      ),
      pool.query(
        `SELECT id,order_id,reason,status,created_at
           FROM disputes
          WHERE buyer_id=$1 OR seller_id=$1
          ORDER BY created_at DESC LIMIT 100`,
        [req.params.id],
      ),
      computeUserReputation(req.params.id),
    ]);
    res.json({
      ...rows[0],
      trust_score: reputation.trust_score,
      rating: reputation.rating,
      trade_count: reputation.trade_count,
      products: products.rows,
      orders: orders.rows,
      posts: posts.rows,
      reports: reports.rows,
      disputes: disputes.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????? ????? (????/KYC ??? ???)
app.put("/api/admin/users/:id", requireDb, requireAdmin, async (req, res) => {
  try {
    const { nickname, kyc_status, trust_score, bio, seller_type } = req.body;
    const { rows } = await queryReturning(
      `UPDATE users SET nickname=COALESCE($1,nickname), kyc_status=COALESCE($2,kyc_status),
       trust_score=COALESCE($3,trust_score), bio=COALESCE($4,bio), seller_type=COALESCE($5,seller_type)
       WHERE id=$6`,
      [nickname, kyc_status, trust_score, bio, seller_type, req.params.id],
      "users",
      "id=$1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch(
  "/api/admin/users/:id/suspension",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const suspended = Boolean(req.body.suspended);
    const reason = suspended
      ? String(req.body.reason || "").trim().slice(0, 500)
      : null;
    const expectedStatus = req.body.expectedStatus
      ? String(req.body.expectedStatus)
      : null;
    try {
      if (expectedStatus) {
        const current = await pool.query(
          "SELECT account_status FROM users WHERE id = $1 LIMIT 1",
          [req.params.id],
        );
        if (!current.rows.length)
          return res.status(404).json({ error: "Not found" });
        const currentStatus = current.rows[0].account_status || "active";
        if (currentStatus !== expectedStatus) {
          return res.status(409).json({
            error: "Account status changed",
            account_status: currentStatus,
          });
        }
      }
      const { rows } = await queryReturning(
        `UPDATE users
            SET account_status = $1,
                suspension_reason = $2,
                suspended_at = CASE WHEN $1 = 'suspended' THEN NOW() ELSE NULL END
          WHERE id = $3`,
        [suspended ? "suspended" : "active", reason, req.params.id],
        "users",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      if (suspended) {
        await pool.query("DELETE FROM sessions WHERE user_id = $1", [req.params.id]);
        for (const [token, session] of sessionCache) {
          if (session.userId === req.params.id) sessionCache.delete(token);
        }
      }
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ????? ?????
app.delete(
  "/api/admin/users/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ── 결제 내역 ────────────────────────────────────────────────
// orphan = 인증비 결제는 완료됐는데 users 계정이 만들어지지 않은 건.
// 사용자가 "돈은 냈는데 가입이 안 된다"고 문의하는 경우가 여기에 잡힌다.
const EMPTY_PAYMENT_SUMMARY = {
  total_count: 0,
  completed_count: 0,
  completed_amount: 0,
  cancelled_count: 0,
  pending_count: 0,
  verification_count: 0,
  badge_count: 0,
  orphan_count: 0,
  week_count: 0,
  week_amount: 0,
};

// payments 테이블이 없는 예전 DB 에서도 대시보드가 죽지 않도록 실패 시 0 을 돌려준다.
async function fetchPaymentSummary() {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_count,
        SUM(p.status = 'completed') AS completed_count,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) AS completed_amount,
        SUM(p.status = 'cancelled') AS cancelled_count,
        SUM(p.status NOT IN ('completed', 'cancelled')) AS pending_count,
        SUM(p.status = 'completed' AND p.payment_type = 'profile_verification') AS verification_count,
        SUM(p.status = 'completed' AND p.payment_type = 'badge_purchase') AS badge_count,
        SUM(
          p.status = 'completed'
          AND p.payment_type = 'profile_verification'
          AND p.user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id)
        ) AS orphan_count,
        SUM(p.status = 'completed'
            AND p.completed_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS week_count,
        SUM(CASE WHEN p.status = 'completed'
                  AND p.completed_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                 THEN p.amount ELSE 0 END) AS week_amount
      FROM payments p`);
    const s = rows[0] || {};
    return Object.fromEntries(
      Object.keys(EMPTY_PAYMENT_SUMMARY).map((key) => [key, Number(s[key] || 0)]),
    );
  } catch (e) {
    console.warn("[admin/payments] summary failed:", e.message);
    return { ...EMPTY_PAYMENT_SUMMARY };
  }
}

app.get("/api/admin/payments", requireDb, requireAdmin, async (_req, res) => {
  try {
    const [summary, { rows }] = await Promise.all([
      fetchPaymentSummary(),
      pool.query(
        `SELECT p.id, p.user_id, p.payment_type, p.amount, p.memo, p.txid, p.status,
                p.pi_username, p.wallet_address,
                p.created_at, p.approved_at, p.completed_at, p.cancelled_at,
                u.nickname AS user_nickname,
                (u.id IS NOT NULL) AS account_exists
         FROM payments p
         LEFT JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC
         LIMIT 500`,
      ),
    ]);
    res.json({
      summary,
      rows: rows.map((row) => ({
        ...row,
        amount: Number(row.amount || 0),
        account_exists: Boolean(Number(row.account_exists)),
      })),
    });
  } catch (e) {
    console.error("[admin/payments] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Pi 서버에서 결제 원본을 다시 읽어 기록을 맞추고, 인증비 결제면 계정 생성을 재시도한다.
app.post(
  "/api/admin/payments/:id/repair",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const paymentId = req.params.id;
    try {
      const info = await piApiCall("GET", "/payments/" + paymentId);
      const txid = info.transaction?.txid || null;
      const cancelled = Boolean(
        info.status?.cancelled || info.status?.user_cancelled,
      );
      const completed = Boolean(info.status?.developer_completed || txid);
      const status = completed
        ? "completed"
        : cancelled
          ? "cancelled"
          : info.status?.developer_approved
            ? "approved"
            : "created";

      await upsertPaymentRecord(paymentId, status, { txid, paymentInfo: info });
      if (completed) await handleVerificationPaymentComplete(info);

      const { rows } = await pool.query(
        `SELECT p.*, u.nickname AS user_nickname, (u.id IS NOT NULL) AS account_exists
         FROM payments p LEFT JOIN users u ON u.id = p.user_id
         WHERE p.id = $1`,
        [paymentId],
      );
      if (!rows.length)
        return res.status(404).json({ error: "Payment not found" });
      console.log(`[admin] payment repaired id=${paymentId} status=${status}`);
      res.json({
        ...rows[0],
        amount: Number(rows[0].amount || 0),
        account_exists: Boolean(Number(rows[0].account_exists)),
      });
    } catch (e) {
      console.error("[admin/payments] repair failed:", paymentId, e.message);
      res.status(502).json({ error: e.message });
    }
  },
);

// ??? ????? ??
app.get("/api/admin/disputes", requireDb, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, bu.nickname AS buyer_nickname, su.nickname AS seller_nickname
       FROM disputes d
       LEFT JOIN users bu ON bu.id = d.buyer_id
       LEFT JOIN users su ON su.id = d.seller_id
       ORDER BY d.created_at DESC`,
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????? ?????? ??? / ?????? ???
app.put(
  "/api/admin/disputes/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const { status, admin_response } = req.body;
      const { rows } = await queryReturning(
        `UPDATE disputes SET status=COALESCE($1,status), admin_response=COALESCE($2,admin_response),
       resolved_at=${status === "RESOLVED" ? "NOW()" : "resolved_at"}
       WHERE id=$3`,
        [status, admin_response, req.params.id],
        "disputes",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const dispute = rows[0];
      if (status === "RESOLVED") {
        await resetOrderAfterAdminDisputeResolved(dispute.order_id);
        const title = String(dispute.product_title || "Listing");
        const targets = [dispute.buyer_id, dispute.seller_id].filter(Boolean);
        for (const targetId of targets) {
          try {
            await pool.query(
              `INSERT INTO notifications (id, target_user_id, type, title, content, link)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON DUPLICATE KEY UPDATE id=id`,
              [
                `notif_disp_${dispute.id}_${targetId}_${Date.now()}`,
                targetId,
                "order",
                "Dispute resolved",
                `The dispute for "${title}" has been resolved.`,
                `/dispute/${dispute.order_id}?view=other`,
              ],
            );
          } catch (notifyErr) {
            console.warn("[disputes] resolve notification failed:", notifyErr.message);
          }
        }
      }
      res.json(dispute);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ?????? ????? (??????)
app.delete(
  "/api/admin/products/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// Admin: list products with seller info, filterable by status/free_share/search
app.get("/api/admin/products", requireDb, requireAdmin, async (req, res) => {
  const { status, q, free_share, hidden } = req.query;
  try {
    const listingStatusExpr = productListingStatusSql("p");
    let query = `SELECT p.id, p.title, p.price, p.category, p.region, p.images,
                        p.is_free_share, p.allow_offer, p.seller_id, p.description,
                        p.admin_hidden, p.admin_hidden_reason, p.created_at,
                        u.nickname AS seller_nickname,
                        ${listingStatusExpr} AS status
                 FROM products p
                 LEFT JOIN users u ON p.seller_id = u.id
                 WHERE 1=1`;
    const params = [];
    if (status) {
      params.push(status);
      query += ` AND ${listingStatusExpr}=$${params.length}`;
    }
    if (free_share === "true") {
      query += ` AND p.is_free_share=true`;
    }
    if (hidden === "true") {
      query += ` AND p.admin_hidden=true`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (p.title LIKE $${params.length} OR CAST(p.id AS CHAR) LIKE $${params.length})`;
    }
    query += ` ORDER BY p.created_at DESC LIMIT 500`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch(
  "/api/admin/products/:id/visibility",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const hidden = Boolean(req.body.hidden);
    const reason = hidden ? String(req.body.reason || "").trim().slice(0, 500) : null;
    try {
      const { rows } = await queryReturning(
        `UPDATE products
            SET admin_hidden = $1,
                admin_hidden_reason = $2,
                admin_hidden_at = CASE WHEN $1 THEN NOW() ELSE NULL END
          WHERE id = $3`,
        [hidden, reason, req.params.id],
        "products",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// Admin: list community posts with author info
app.get("/api/admin/posts", requireDb, requireAdmin, async (req, res) => {
  const { category, q } = req.query;
  try {
    let query = `SELECT p.*, u.nickname AS author_nickname,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
                 FROM community_posts p
                 LEFT JOIN users u ON p.author_id = u.id
                 WHERE 1=1`;
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND p.category=$${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (p.title LIKE $${params.length} OR p.content LIKE $${params.length})`;
    }
    query += ` ORDER BY p.created_at DESC LIMIT 500`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete(
  "/api/admin/posts/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      await pool.query("DELETE FROM community_posts WHERE id=$1", [
        req.params.id,
      ]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.patch(
  "/api/admin/posts/:id/visibility",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const hidden = Boolean(req.body.hidden);
    const reason = hidden ? String(req.body.reason || "").trim().slice(0, 500) : null;
    try {
      const { rows } = await queryReturning(
        `UPDATE community_posts
            SET admin_hidden = $1,
                admin_hidden_reason = $2,
                admin_hidden_at = CASE WHEN $1 THEN NOW() ELSE NULL END
          WHERE id = $3`,
        [hidden, reason, req.params.id],
        "community_posts",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.patch(
  "/api/admin/comments/:id/visibility",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const hidden = Boolean(req.body.hidden);
    const reason = hidden ? String(req.body.reason || "").trim().slice(0, 500) : null;
    try {
      const { rows } = await queryReturning(
        `UPDATE comments
            SET admin_hidden = $1,
                admin_hidden_reason = $2,
                admin_hidden_at = CASE WHEN $1 THEN NOW() ELSE NULL END
          WHERE id = $3`,
        [hidden, reason, req.params.id],
        "comments",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete(
  "/api/admin/comments/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const { rows: existing } = await pool.query(
        "SELECT post_id FROM comments WHERE id=$1",
        [req.params.id],
      );
      if (!existing.length) return res.status(404).json({ error: "Not found" });
      await pool.query("DELETE FROM comments WHERE id=$1", [req.params.id]);
      if (existing[0].post_id) {
        await pool.query(
          `UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id=$1`,
          [existing[0].post_id],
        );
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ─── Reports (신고) ─────────────────────────────────────────
const VALID_REPORT_TARGETS = new Set([
  "product",
  "post",
  "review",
  "user",
  "comment",
]);

// User submits a report
app.post("/api/reports", requireDb, requireAuth, async (req, res) => {
  const { target_type, target_id, reason, description } = req.body;
  if (!target_type || !VALID_REPORT_TARGETS.has(target_type)) {
    return res.status(400).json({ error: "Invalid target_type" });
  }
  if (!target_id || !reason || !String(reason).trim()) {
    return res.status(400).json({ error: "target_id and reason are required" });
  }
  const id = `rpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  try {
    // Prevent duplicate open reports from same reporter on same target
    const dup = await pool.query(
      `SELECT id FROM reports
       WHERE reporter_id=$1 AND target_type=$2 AND target_id=$3 AND status='open'
       LIMIT 1`,
      [req.authUserId, target_type, target_id],
    );
    if (dup.rows.length) {
      return res
        .status(409)
        .json({ error: "You already reported this. Wait for admin review." });
    }
    const { rows } = await queryReturning(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
      `,
      [
        id,
        req.authUserId,
        target_type,
        target_id,
        String(reason).trim(),
        description
          ? clipText(String(description).trim(), TEXT_LIMIT.reportDetails)
          : null,
      ],
      "reports",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User: list own reports (optional, lets users see their submission status)
app.get("/api/reports/mine", requireDb, requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reports WHERE reporter_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.authUserId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: list all reports with optional filters
app.get("/api/admin/reports", requireDb, requireAdmin, async (req, res) => {
  const { status, target_type } = req.query;
  try {
    let query = `SELECT r.*,
                        rep.nickname AS reporter_nickname,
                        rep.kyc_status AS reporter_kyc_status,
                        rep.account_status AS reporter_account_status,
                        rep.pi_username AS reporter_pi_username,
                        rep.activity_region AS reporter_activity_region,
                        rsv.nickname AS resolved_by_nickname,
                        owner.id AS owner_id,
                        owner.nickname AS owner_nickname,
                        owner.kyc_status AS owner_kyc_status,
                        owner.account_status AS owner_account_status,
                        owner.pi_username AS owner_pi_username,
                        owner.activity_region AS owner_activity_region,
                        c.post_id AS comment_post_id,
                        CASE r.target_type
                          WHEN 'product' THEN p.title
                          WHEN 'post' THEN cp.title
                          WHEN 'comment' THEN LEFT(c.content, 80)
                          WHEN 'review' THEN COALESCE(rv.product_title, LEFT(rv.comment, 80))
                          WHEN 'user' THEN owner.nickname
                          ELSE NULL
                        END AS target_title,
                        CASE r.target_type
                          WHEN 'product' THEN p.description
                          WHEN 'post' THEN cp.content
                          WHEN 'comment' THEN c.content
                          WHEN 'review' THEN rv.comment
                          ELSE NULL
                        END AS target_body,
                        CASE r.target_type WHEN 'product' THEN p.price ELSE NULL END AS target_price,
                        CASE r.target_type WHEN 'product' THEN p.is_free_share ELSE NULL END AS target_is_free_share,
                        CASE r.target_type
                          WHEN 'product' THEN p.images
                          WHEN 'post' THEN cp.images
                          ELSE NULL
                        END AS target_images,
                        CASE r.target_type
                          WHEN 'product' THEN p.id
                          WHEN 'post' THEN cp.id
                          WHEN 'comment' THEN c.id
                          WHEN 'review' THEN rv.id
                          WHEN 'user' THEN owner.id
                          ELSE NULL
                        END AS target_row_id,
                        CASE r.target_type
                          WHEN 'product' THEN p.admin_hidden
                          WHEN 'post' THEN cp.admin_hidden
                          WHEN 'comment' THEN c.admin_hidden
                          ELSE 0
                        END AS target_hidden,
                        CASE r.target_type
                          WHEN 'product' THEN p.admin_hidden_reason
                          WHEN 'post' THEN cp.admin_hidden_reason
                          WHEN 'comment' THEN c.admin_hidden_reason
                          ELSE NULL
                        END AS target_hidden_reason
                 FROM reports r
                 LEFT JOIN users rep ON r.reporter_id = rep.id
                 LEFT JOIN users rsv ON r.resolved_by = rsv.id
                 LEFT JOIN products p ON r.target_type = 'product' AND r.target_id = p.id
                 LEFT JOIN community_posts cp ON r.target_type = 'post' AND r.target_id = cp.id
                 LEFT JOIN comments c ON r.target_type = 'comment' AND r.target_id = c.id
                 LEFT JOIN reviews rv ON r.target_type = 'review' AND r.target_id = rv.id
                 LEFT JOIN users owner ON owner.id = CASE r.target_type
                   WHEN 'product' THEN p.seller_id
                   WHEN 'post' THEN cp.author_id
                   WHEN 'comment' THEN c.author_id
                   WHEN 'review' THEN rv.reviewer_id
                   WHEN 'user' THEN r.target_id
                   ELSE NULL
                 END
                 WHERE 1=1`;
    const params = [];
    if (status) {
      params.push(status);
      query += ` AND r.status=$${params.length}`;
    }
    if (target_type) {
      params.push(target_type);
      query += ` AND r.target_type=$${params.length}`;
    }
    query += ` ORDER BY r.created_at DESC LIMIT 500`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: resolve / reopen a report
app.put("/api/admin/reports/:id", requireDb, requireAdmin, async (req, res) => {
  const { status, admin_note } = req.body;
  if (status && !["open", "resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    const { rows } = await queryReturning(
      `UPDATE reports SET
         status = COALESCE($1, status),
         admin_note = COALESCE($2, admin_note),
         resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $3
      `,
      [status ?? null, admin_note ?? null, req.params.id],
      "reports",
      "id=$1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 관리자 채팅 중재
// 대화 본문에는 주소·연락처가 그대로 남으므로 목록에서는 메타데이터만 주고,
// 본문은 방을 직접 열었을 때만 내려준다.
// ---------------------------------------------------------------------------

/** 같은 주문 또는 같은 상품·구매자·판매자 조합의 분쟁을 이 방에 연결된 것으로 본다. */
const ROOM_DISPUTE_JOIN_SQL = `FROM disputes d
     LEFT JOIN orders o ON o.id = d.order_id
    WHERE (r.order_id IS NOT NULL AND d.order_id = r.order_id)
       OR (o.product_id = r.product_id AND o.buyer_id = r.buyer_id AND o.seller_id = r.seller_id)`;

const ROOM_DISPUTE_COUNT_SQL = `(SELECT COUNT(*) ${ROOM_DISPUTE_JOIN_SQL})`;
const ROOM_OPEN_DISPUTE_COUNT_SQL = `(SELECT COUNT(*) ${ROOM_DISPUTE_JOIN_SQL} AND d.status <> 'RESOLVED')`;
const ROOM_REPORT_COUNT_SQL = `(SELECT COUNT(*) FROM reports rp
    WHERE rp.target_type IN ('chat','chat_room') AND rp.target_id = r.id)`;

async function getChatRoomModerationLinks(roomId) {
  const { rows } = await pool.query(
    `SELECT ${ROOM_DISPUTE_COUNT_SQL} AS dispute_count,
            ${ROOM_REPORT_COUNT_SQL} AS report_count
       FROM chat_rooms r WHERE r.id=$1`,
    [roomId],
  );
  if (!rows.length) return null;
  return {
    disputeCount: Number(rows[0].dispute_count || 0),
    reportCount: Number(rows[0].report_count || 0),
  };
}

// 목록: 메시지 본문·마지막 메시지는 내려주지 않는다.
app.get("/api/admin/chat-rooms", requireDb, requireAdmin, async (req, res) => {
  const { q, filter } = req.query;
  try {
    const params = [];
    let query = `
      SELECT r.id, r.product_id, r.order_id, r.buyer_id, r.seller_id,
             r.created_at, r.last_message_time, r.left_user_ids,
             r.admin_hidden, r.admin_hidden_reason, r.admin_hidden_at,
             p.title AS product_title,
             bu.nickname AS buyer_nickname,
             su.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id=r.id) AS message_count,
             (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id=r.id AND m.deleted_at IS NOT NULL) AS deleted_message_count,
             ${ROOM_DISPUTE_COUNT_SQL} AS dispute_count,
             ${ROOM_OPEN_DISPUTE_COUNT_SQL} AS open_dispute_count,
             ${ROOM_REPORT_COUNT_SQL} AS report_count
        FROM chat_rooms r
        LEFT JOIN products p ON p.id = r.product_id
        LEFT JOIN users bu ON bu.id = r.buyer_id
        LEFT JOIN users su ON su.id = r.seller_id
       WHERE 1=1`;
    if (q) {
      params.push(`%${q}%`);
      const i = `$${params.length}`;
      query += ` AND (p.title LIKE ${i} OR bu.nickname LIKE ${i} OR su.nickname LIKE ${i} OR r.id LIKE ${i})`;
    }
    if (filter === "dispute") query += ` AND ${ROOM_DISPUTE_COUNT_SQL} > 0`;
    else if (filter === "reported") query += ` AND ${ROOM_REPORT_COUNT_SQL} > 0`;
    else if (filter === "deleted") {
      query += ` AND (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id=r.id AND m.deleted_at IS NOT NULL) > 0`;
    } else if (filter === "hidden") {
      query += ` AND COALESCE(r.admin_hidden, 0) = 1`;
    }
    query += ` ORDER BY COALESCE(r.last_message_time, r.created_at) DESC LIMIT 300`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 대화 열람
app.get(
  "/api/admin/chat-rooms/:id/messages",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const links = await getChatRoomModerationLinks(req.params.id);
      if (!links) return res.status(404).json({ error: "Room not found" });
      const { rows } = await pool.query(
        `SELECT m.id, m.sender_id, m.content, m.type, m.images, m.order_id,
                m.original_price, m.proposed_price, m.offer_result,
                m.deleted_at, m.deleted_by_admin, m.deleted_reason, m.created_at,
                u.nickname AS sender_nickname
           FROM chat_messages m
           LEFT JOIN users u ON u.id = m.sender_id
          WHERE m.room_id=$1
          ORDER BY m.created_at ASC
          LIMIT 1000`,
        [req.params.id],
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// 메시지 가리기 / 되돌리기 — 원문은 지우지 않는다.
app.put(
  "/api/admin/chat-messages/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const { deleted, reason } = req.body || {};
    try {
      const hide = deleted !== false;
      const { rows } = await queryReturning(
        `UPDATE chat_messages
            SET deleted_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
                deleted_by_admin = CASE WHEN $1 THEN 1 ELSE 0 END,
                deleted_reason = CASE WHEN $1 THEN $2 ELSE NULL END
          WHERE id = $3`,
        [hide ? 1 : 0, reason || null, req.params.id],
        "chat_messages",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const updated = rows[0];
      // 채팅 목록 미리보기에 가린 문구가 그대로 남지 않도록 맞춰 준다.
      if (hide && updated.room_id) {
        await pool.query(
          `UPDATE chat_rooms SET last_message=$2
            WHERE id=$1 AND (last_message_time IS NULL OR last_message_time <= $3)`,
          [updated.room_id, CHAT_MSG_ADMIN_DELETED, updated.created_at],
        );
      }
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// 방 숨기기 / 되돌리기 — 사용자 목록에서만 빠지고 대화는 남는다.
app.put(
  "/api/admin/chat-rooms/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    const { hidden, reason } = req.body || {};
    try {
      const hide = hidden !== false;
      const { rows } = await queryReturning(
        `UPDATE chat_rooms
            SET admin_hidden = $1,
                admin_hidden_reason = CASE WHEN $1 THEN $2 ELSE NULL END,
                admin_hidden_at = CASE WHEN $1 THEN NOW() ELSE NULL END
          WHERE id = $3`,
        [hide ? 1 : 0, reason || null, req.params.id],
        "chat_rooms",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// 방 삭제: 대화까지 지워진다. 분쟁·신고가 있어도 관리자가 지울 수 있다.
app.delete(
  "/api/admin/chat-rooms/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT id FROM chat_rooms WHERE id=$1", [
        req.params.id,
      ]);
      if (!rows.length) return res.status(404).json({ error: "Room not found" });
      await pool.query("DELETE FROM chat_rooms WHERE id=$1", [req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ??? ???????? (??????)
app.get("/api/admin/inquiries", requireDb, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.nickname AS user_nickname
       FROM inquiries i
       LEFT JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC`,
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put(
  "/api/admin/inquiries/:id",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const { admin_reply, status } = req.body;
      const { rows } = await queryReturning(
        `UPDATE inquiries SET
         admin_reply = COALESCE($1, admin_reply),
         status = COALESCE($2, status),
         replied_at = CASE WHEN $2 = 'replied' THEN NOW() ELSE replied_at END
       WHERE id = $3
      `,
        [admin_reply ?? null, status ?? null, req.params.id],
        "inquiries",
        "id=$1",
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const inquiry = rows[0];
      if (inquiry.user_id && admin_reply && String(admin_reply).trim()) {
        const title = String(inquiry.title || "Inquiry");
        const notifId = `notif_inq_${inquiry.id}_${Date.now()}`;
        try {
          await pool.query(
            `INSERT INTO notifications (id, target_user_id, type, title, content, link)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON DUPLICATE KEY UPDATE id=id`,
            [
              notifId,
              inquiry.user_id,
              "inquiry",
              "Inquiry reply",
              `We replied to your inquiry "${title}".`,
              `/my/inquiries?id=${encodeURIComponent(inquiry.id)}`,
            ],
          );
        } catch (notifyErr) {
          console.warn("[inquiries] reply notification failed:", notifyErr.message);
        }
      }
      res.json(inquiry);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ——— Home popup & notices ———
function isMissingTableError(message) {
  return /doesn't exist|does not exist|Unknown table|42P01/i.test(String(message));
}

async function nextHomePopupRevision() {
  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(revision), 0) + 1 AS rev FROM home_popups",
  );
  return Number(rows[0]?.rev) || 1;
}

async function disableAllHomePopups() {
  await pool.query("UPDATE home_popups SET enabled = false WHERE enabled = true");
}

const HOME_POPUP_TITLE_MAX = 30;
function validateHomePopupTitle(title) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return { ok: false, error: "title is required" };
  if (trimmed.length > HOME_POPUP_TITLE_MAX) {
    return {
      ok: false,
      error: `title must be at most ${HOME_POPUP_TITLE_MAX} characters`,
    };
  }
  return { ok: true, title: trimmed };
}

app.get("/api/home-popup", requireDb, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, hero_image, detail_link, notice_id, revision, enabled, created_at
         FROM home_popups
        WHERE enabled = true
        ORDER BY revision DESC
        LIMIT 1`,
    );
    res.json(rows[0] ?? null);
  } catch (e) {
    if (isMissingTableError(e.message)) return res.json(null);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/notices", requireDb, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, view_count, created_at, updated_at
         FROM notices
        WHERE published = true
        ORDER BY created_at DESC
        LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    if (isMissingTableError(e.message)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/notices/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, content, view_count, created_at, updated_at
         FROM notices
        WHERE id = $1 AND published = true`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(404).json({ error: "Not found" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/notices/:id/view", requireDb, async (req, res) => {
  try {
    const notice = await pool.query(
      `SELECT id FROM notices WHERE id = $1 AND published = true LIMIT 1`,
      [req.params.id],
    );
    if (!notice.rows.length) return res.status(404).json({ error: "Not found" });

    const result = await recordDailyContentView(
      req,
      "notice",
      req.params.id,
      "notices",
    );
    res.json({ count: result.count, counted: result.counted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/notices", requireDb, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, content, published, view_count, created_at, updated_at
         FROM notices
        ORDER BY created_at DESC
        LIMIT 200`,
    );
    res.json(rows);
  } catch (e) {
    if (isMissingTableError(e.message)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/admin/notices", requireDb, requireAdmin, async (req, res) => {
  const { title, content, published } = req.body;
  if (!title || !String(title).trim() || !content || !String(content).trim()) {
    return res.status(400).json({ error: "title and content are required" });
  }
  if (String(title).trim().length > 255) {
    return res.status(400).json({ error: "title must be at most 255 characters" });
  }
  const id = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  try {
    const { rows } = await queryReturning(
      `INSERT INTO notices (id, title, content, published)
       VALUES ($1, $2, $3, $4)`,
      [id, String(title).trim(), String(content).trim(), published !== false],
      "notices",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/admin/notices/:id", requireDb, requireAdmin, async (req, res) => {
  const { title, content, published } = req.body;
  if (title != null && !String(title).trim()) {
    return res.status(400).json({ error: "title is required" });
  }
  if (title != null && String(title).trim().length > 255) {
    return res.status(400).json({ error: "title must be at most 255 characters" });
  }
  if (content != null && !String(content).trim()) {
    return res.status(400).json({ error: "content is required" });
  }
  try {
    const { rows } = await queryReturning(
      `UPDATE notices SET
         title = COALESCE($1, title),
         content = COALESCE($2, content),
         published = COALESCE($3, published)
       WHERE id = $4`,
      [
        title != null ? String(title).trim() : null,
        content != null ? String(content).trim() : null,
        published != null ? Boolean(published) : null,
        req.params.id,
      ],
      "notices",
      "id=$1",
      [req.params.id],
      { emptyOnNoChange: true },
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/admin/notices/:id", requireDb, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM notices WHERE id = $1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/home-popups", requireDb, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.hero_image, p.detail_link, p.notice_id, p.revision,
              p.enabled, p.created_at, n.title AS notice_title
         FROM home_popups p
         LEFT JOIN notices n ON n.id = p.notice_id
        ORDER BY p.created_at DESC
        LIMIT 200`,
    );
    res.json(rows);
  } catch (e) {
    if (isMissingTableError(e.message)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/admin/home-popups", requireDb, requireAdmin, async (req, res) => {
  const { title, hero_image, detail_link, notice_id, enabled } = req.body;
  const titleCheck = validateHomePopupTitle(title);
  if (!titleCheck.ok) return res.status(400).json({ error: titleCheck.error });
  if (!hero_image || !String(hero_image).trim()) {
    return res.status(400).json({ error: "hero_image is required" });
  }
  const id = `popup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const revision = await nextHomePopupRevision();
  const shouldEnable = enabled !== false;
  try {
    if (shouldEnable) await disableAllHomePopups();
    const { rows } = await queryReturning(
      `INSERT INTO home_popups (id, title, hero_image, detail_link, notice_id, revision, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        titleCheck.title,
        String(hero_image).trim(),
        detail_link ? String(detail_link).trim() : null,
        notice_id || null,
        revision,
        shouldEnable,
      ],
      "home_popups",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/admin/home-popups/:id", requireDb, requireAdmin, async (req, res) => {
  const { title, hero_image, detail_link, notice_id, enabled, bump_revision } = req.body;
  if (title != null) {
    const titleCheck = validateHomePopupTitle(title);
    if (!titleCheck.ok) return res.status(400).json({ error: titleCheck.error });
  }
  try {
    const existing = await pool.query("SELECT * FROM home_popups WHERE id = $1", [
      req.params.id,
    ]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    const prev = existing.rows[0];

    let revision = prev.revision;
    if (bump_revision || (enabled === true && !prev.enabled)) {
      revision = await nextHomePopupRevision();
    }
    if (enabled === true) await disableAllHomePopups();

    const { rows } = await queryReturning(
      `UPDATE home_popups SET
         title = COALESCE($1, title),
         hero_image = COALESCE($2, hero_image),
         detail_link = COALESCE($3, detail_link),
         notice_id = COALESCE($4, notice_id),
         enabled = COALESCE($5, enabled),
         revision = $6
       WHERE id = $7`,
      [
        title != null ? validateHomePopupTitle(title).title : null,
        hero_image != null ? String(hero_image).trim() : null,
        detail_link !== undefined ? (detail_link ? String(detail_link).trim() : null) : null,
        notice_id !== undefined ? notice_id || null : null,
        enabled !== undefined ? Boolean(enabled) : null,
        revision,
        req.params.id,
      ],
      "home_popups",
      "id=$1",
      [req.params.id],
      { emptyOnNoChange: true },
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/admin/home-popups/:id", requireDb, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM home_popups WHERE id = $1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? 404 ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ????????? Socket.io ???????? ????? ????????????????????????????????????????????????????????????????????????????????????????????????????????????
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

const userSockets = new Map();

io.on("connection", async (socket) => {
  const token = socket.handshake.auth?.token || socket.handshake.query.token;
  const userId = token ? await getUserIdFromToken(token) : null;
  if (!userId) {
    socket.disconnect(true);
    return;
  }
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
  socket.join(`user:${userId}`);

  socket.on("join_room", async (roomId) => {
    if (pool) {
      try {
        const { rows } = await pool.query(
          "SELECT buyer_id, seller_id FROM chat_rooms WHERE id=$1",
          [roomId],
        );
        if (
          !rows.length ||
          (userId !== rows[0].buyer_id && userId !== rows[0].seller_id)
        )
          return;
      } catch {
        return;
      }
    }
    socket.join(`room:${roomId}`);
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(`room:${roomId}`);
  });

  socket.on("send_message", async (data) => {
    const { roomId, message, room } = data;
    if (!roomId || !message) return;
    const claimedSender = message.senderId;
    if (claimedSender !== userId && claimedSender !== "system") return;

    let roomBuyerId = room?.buyerId;
    let roomSellerId = room?.sellerId;
    if (pool) {
      try {
        const { rows } = await pool.query(
          "SELECT buyer_id, seller_id FROM chat_rooms WHERE id=$1",
          [roomId],
        );
        if (
          !rows.length ||
          (userId !== rows[0].buyer_id && userId !== rows[0].seller_id)
        ) {
          return;
        }
        roomBuyerId = rows[0].buyer_id;
        roomSellerId = rows[0].seller_id;
      } catch {
        return;
      }
    } else if (
      userId !== roomBuyerId &&
      userId !== roomSellerId
    ) {
      return;
    }

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO chat_messages (id, room_id, sender_id, content, type, images, order_id, original_price, proposed_price, offer_result, meetup_location, meetup_time)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON DUPLICATE KEY UPDATE id=id`,
          [
            message.id,
            roomId,
            claimedSender === "system" ? "system" : userId,
            clipUserChatContent(message.content, message.type),
            message.type || "text",
            clipChatImages(message.images),
            message.orderId || null,
            message.originalPrice ?? null,
            message.proposedPrice ?? null,
            message.offerResult || null,
            clipText(
              message.meetupPlace || message.meetupLocation || null,
              TEXT_LIMIT.meetupPlace,
            ),
            message.meetupDate && message.meetupTime
              ? `${message.meetupDate} ${message.meetupTime}`
              : message.meetupTime || null,
          ],
        );
      } catch (e) {
        console.error("[socket] save message error:", e.message);
      }
    }

    socket.to(`room:${roomId}`).emit("new_message", { roomId, message });

    const participantIds = [roomBuyerId, roomSellerId].filter(Boolean);
    participantIds.forEach((uid) => {
      if (uid !== message.senderId) {
        io.to(`user:${uid}`).emit("room_updated", {
          roomId,
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          senderId: message.senderId,
        });
      }
    });
  });

  socket.on("create_room", (data) => {
    const { room } = data;
    const participantIds = [room.buyerId, room.sellerId].filter(Boolean);
    participantIds.forEach((uid) => {
      if (uid !== room.buyerId) {
        io.to(`user:${uid}`).emit("new_room", { room });
      }
    });
  });

  socket.on("typing", (data) => {
    socket
      .to(`room:${data.roomId}`)
      .emit("typing", { userId: data.userId, roomId: data.roomId });
  });

  socket.on("disconnect", () => {
    if (userId && userSockets.has(userId)) {
      userSockets.get(userId).delete(socket.id);
      if (userSockets.get(userId).size === 0) userSockets.delete(userId);
    }
  });
});

migrationsReady.finally(() => {
  void loadAppPrices();
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[backend] http://0.0.0.0:${PORT}  (health: /api/health, ws: enabled)`,
    );
  });
});
