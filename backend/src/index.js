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

const PORT = Number(process.env.PORT) || 3001;
const app = express();
// Vercel ???? ???? X-Forwarded-For ??? ?? ????? IP ??
app.set("trust proxy", 1);

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

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  sessionCache.set(token, { userId, createdAt: Date.now() });
  if (pool) {
    try {
      await pool.query(
        "INSERT INTO sessions (token, user_id) VALUES ($1, $2) ON DUPLICATE KEY UPDATE token=token",
        [token, userId],
      );
    } catch {}
  }
  return token;
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
    sessionCache.set(token, {
      userId: rows[0].user_id,
      createdAt: new Date(rows[0].created_at).getTime(),
    });
    return rows[0].user_id;
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

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userId = await getUserIdFromToken(auth.slice(7));
  if (!userId)
    return res.status(401).json({ error: "Invalid or expired session" });
  req.authUserId = userId;
  next();
}

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://blindlounge.xyz",
  "https://www.blindlounge.xyz",
  "https://pie.blindlounge.xyz",
  "https://www.pie.blindlounge.xyz",
  "https://market-piepie-frontend.vercel.app",
  "https://marketpiepeie.vercel.app",
  "https://merketpiepietest.vercel.app",
  "https://marketpiepietest.vercel.app",
  "https://marketpiepie.vercel.app",
  "https://piepie-market.vercel.app",
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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);
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

async function requireUploadActor(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const suppliedAdminPassword = req.headers["x-admin-password"];
  if (adminPassword && suppliedAdminPassword === adminPassword) {
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
app.get("/api/health", async (_req, res) => {
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
if (process.env.NODE_ENV !== "production") {
  app.post("/api/auth/dev-login", async (req, res) => {
    const userId =
      req.body.userId || `guest_${crypto.randomBytes(8).toString("hex")}`;
    const nickname = req.body.nickname || "TestUser";
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO users (id, nickname, kyc_status) VALUES ($1, $2, 'verified')
           ON DUPLICATE KEY UPDATE id=id`,
          [userId, nickname],
        );
      } catch {
        /* ignore if no DB */
      }
    }
    const sessionToken = await createSession(userId);
    console.log(`[dev-login] userId=${userId} nickname=${nickname}`);
    res.json({
      uid: userId,
      username: nickname,
      piVerified: true,
      sessionToken,
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

// ??? ????

app.post("/api/payments/approve", async (req, res) => {
  const { paymentId } = req.body;

  if (!paymentId) return res.status(400).json({ error: "paymentId required" });

  try {
    const result = await piApiCall(
      "POST",
      "/payments/" + paymentId + "/approve",
      {},
    );

    console.log("Payment approved:", paymentId);

    res.json(result);
  } catch (e) {
    // already_approved??? ????????? ???

    if (e.message && e.message.includes("already_approved")) {
      console.log("Payment already approved:", paymentId);

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

  try {
    const result = await piApiCall(
      "POST",
      "/payments/" + paymentId + "/complete",
      { txid },
    );

    console.log("Payment completed:", paymentId, txid);

    // ??? ????? ??? ????? DB??? ?????

    if (pool) {
      const paymentInfo = await piApiCall("GET", "/payments/" + paymentId);

      if (paymentInfo && paymentInfo.user_uid) {
        await pool.query(
          "INSERT INTO users (id, nickname, pi_verified) VALUES ($1, $2, true) ON DUPLICATE KEY UPDATE pi_verified = true",

          [paymentInfo.user_uid, paymentInfo.user_uid],
        );
      }
    }

    res.json(result);
  } catch (e) {
    // already_completed??? ????????? ???

    if (e.message && e.message.includes("already_completed")) {
      console.log("Payment already completed:", paymentId);

      return res.json({ message: "already completed" });
    }

    console.error("Payment complete error:", e.message);

    res.status(500).json({ error: e.message });
  }
});

// ?????? ??? ???

app.post("/api/payments/incomplete", async (req, res) => {
  const { payment } = req.body;

  if (!payment) return res.status(400).json({ error: "payment required" });

  try {
    const paymentId = payment.identifier;

    const txid = payment.transaction && payment.transaction.txid;

    if (txid) {
      const result = await piApiCall(
        "POST",
        "/payments/" + paymentId + "/complete",
        { txid },
      );

      console.log("Incomplete payment completed:", paymentId);

      res.json(result);
    } else {
      const result = await piApiCall(
        "POST",
        "/payments/" + paymentId + "/cancel",
        {},
      );

      console.log("Incomplete payment cancelled:", paymentId);

      res.json(result);
    }
  } catch (e) {
    console.error("Incomplete payment error:", e.message);

    res.status(500).json({ error: e.message });
  }
});

// ????????? DB ?????? ?????????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function requireDb(req, res, next) {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  next();
}

// ????????? Pi Network ?? ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.post("/api/auth/pi/verify", async (req, res) => {
  const { accessToken } = req.body;
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
    }
    const sessionToken = await createSession(piRes.uid);
    res.json({
      uid: piRes.uid,
      username: piRes.username,
      piVerified,
      sessionToken,
    });
  } catch (e) {
    res
      .status(401)
      .json({ error: "Pi token verification failed: " + e.message });
  }
});

// ????????? ????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/users/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/users", requireDb, async (req, res) => {
  const {
    id,
    nickname,
    profile_image,
    bio,
    kyc_status,
    trust_score,
    rating,
    trade_count,
    activity_region,
    verified_region,
    display_activity_badge_id,
    seller_type,
  } = req.body;
  const isUuidLike = (s) => s && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s);
  const safeNickname =
    !nickname || nickname === id || isUuidLike(nickname) ? null : nickname;
  try {
    const { rows } = await queryReturning(
      `INSERT INTO users (id, nickname, profile_image, bio, kyc_status, trust_score, rating, trade_count, activity_region, verified_region, display_activity_badge_id, seller_type)
       VALUES ($1, COALESCE($2, $1), $3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON DUPLICATE KEY UPDATE
         nickname = CASE
           WHEN $2 IS NOT NULL THEN $2
           ELSE COALESCE(NULLIF(users.nickname, ''), NULLIF(users.nickname, users.id), users.nickname)
         END,
         profile_image=COALESCE(VALUES(profile_image), users.profile_image),
         bio=COALESCE(VALUES(bio), users.bio),
         kyc_status=COALESCE(NULLIF(VALUES(kyc_status),'unverified'), users.kyc_status, VALUES(kyc_status)),
         trust_score=GREATEST(VALUES(trust_score), users.trust_score),
         rating=CASE WHEN VALUES(rating) > 0 THEN VALUES(rating) ELSE users.rating END,
         trade_count=GREATEST(VALUES(trade_count), users.trade_count),
         activity_region=COALESCE(VALUES(activity_region), users.activity_region),
         verified_region=COALESCE(VALUES(verified_region), users.verified_region),
         display_activity_badge_id=COALESCE(VALUES(display_activity_badge_id), users.display_activity_badge_id),
         seller_type=COALESCE(VALUES(seller_type), users.seller_type)`,
      [
        id,
        safeNickname,
        profile_image,
        bio,
        kyc_status || "unverified",
        trust_score || 0,
        rating || 0,
        trade_count || 0,
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
    params.push(limit, offset);
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/products/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, ${jsonObjectSql("u", "users")} AS seller FROM products p
       LEFT JOIN users u ON p.seller_id = u.id WHERE p.id=$1`,
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Product not found" });
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
        title,
        description,
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
  const { buyer_id, seller_id, user_id, status } = req.query;
  if (req.authUserId) {
    if (user_id && req.authUserId !== user_id)
      return res.status(403).json({ error: "Forbidden" });
    if (buyer_id && req.authUserId !== buyer_id)
      return res.status(403).json({ error: "Forbidden" });
    if (seller_id && req.authUserId !== seller_id)
      return res.status(403).json({ error: "Forbidden" });
  }
  try {
    let query = `SELECT o.*,
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

app.get("/api/orders/:id", requireDb, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*,
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
    const order = rows[0];
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
    buyer_completed,
    seller_completed,
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
    const { rows } = await queryReturning(
      `INSERT INTO orders (id, product_id, buyer_id, seller_id, status, proposed_price, trade_method, meetup_location, meetup_time, memo, buyer_completed, seller_completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON DUPLICATE KEY UPDATE
         status=VALUES(status), proposed_price=VALUES(proposed_price),
         meetup_location=VALUES(meetup_location), meetup_time=VALUES(meetup_time),
         buyer_completed=VALUES(buyer_completed), seller_completed=VALUES(seller_completed)`,
      [
        id,
        product_id,
        buyer_id,
        seller_id,
        status || "PENDING_OFFER",
        proposed_price || 0,
        trade_method,
        meetupLocation,
        meetupDateTime,
        memo,
        buyer_completed || false,
        seller_completed || false,
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
      meetup_location: meetupLocation,
      meetup_time: meetupTimeCombined,
      tracking_number: req.body.tracking_number,
      shipping_company: req.body.shipping_company,
      seller_completed: req.body.seller_completed,
      buyer_completed: req.body.buyer_completed,
      proposed_price: req.body.proposed_price,
      trade_method: req.body.trade_method,
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
    res.json(rows[0]);
  } catch (e) {
    console.error("[PUT /api/orders/:id] error:", e.message, "body:", req.body);
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
  const { user_id } = req.query;
  if (req.authUserId && user_id && req.authUserId !== user_id)
    return res.status(403).json({ error: "Forbidden" });
  try {
    let query = `SELECT cr.*,
      ${jsonObjectSql("bu", "users")} AS buyer_user,
      ${jsonObjectSql("su", "users")} AS seller_user,
      ${jsonObjectSql("p", "products")} AS product_data
      FROM chat_rooms cr
      LEFT JOIN users bu ON cr.buyer_id = bu.id
      LEFT JOIN users su ON cr.seller_id = su.id
      LEFT JOIN products p ON cr.product_id = p.id
      WHERE 1=1`;
    const params = [];
    if (user_id) {
      params.push(user_id);
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

app.get("/api/chat-rooms/:id/messages", requireDb, async (req, res) => {
  try {
    const { rows: roomCheck } = await pool.query(
      "SELECT buyer_id, seller_id FROM chat_rooms WHERE id=$1",
      [req.params.id],
    );
    if (!roomCheck.length)
      return res.status(404).json({ error: "Room not found" });
    if (
      req.authUserId &&
      req.authUserId !== roomCheck[0].buyer_id &&
      req.authUserId !== roomCheck[0].seller_id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { rows } = await pool.query(
      `SELECT m.*, ${jsonObjectSql("u", "users")} AS sender FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.room_id=$1 ORDER BY m.created_at ASC LIMIT 500`,
      [req.params.id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chat-rooms", requireDb, requireAuth, async (req, res) => {
  const { id, product_id, buyer_id, seller_id } = req.body;
  if (req.authUserId !== buyer_id && req.authUserId !== seller_id)
    return res.status(403).json({ error: "Forbidden" });
  try {
    const { rows } = await queryReturning(
      `INSERT INTO chat_rooms (id, product_id, buyer_id, seller_id)
       VALUES ($1,$2,$3,$4)
       ON DUPLICATE KEY UPDATE left_user_ids = JSON_ARRAY()`,
      [id, product_id, buyer_id, seller_id],
      "chat_rooms",
    );
    res.status(201).json(rows[0]);
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
    if (sender_id && req.authUserId !== sender_id)
      return res.status(403).json({ error: "Forbidden" });
    try {
      const { rows } = await queryReturning(
        `INSERT INTO chat_messages (id, room_id, sender_id, content, type, images, order_id, original_price, proposed_price, offer_result)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON DUPLICATE KEY UPDATE id=id`,
        [
          id,
          req.params.id,
          sender_id,
          content,
          type || "text",
          images || [],
          order_id,
          original_price,
          proposed_price,
          offer_result,
        ],
        "chat_messages",
        "id=$1",
        [id],
        { emptyOnNoChange: true },
      );
      await pool.query(
        `UPDATE chat_rooms SET last_message=$2, last_message_time=NOW() WHERE id=$1`,
        [req.params.id, content],
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
    let query = `SELECT p.*, ${jsonObjectSql("u", "users")} AS author FROM community_posts p
                 LEFT JOIN users u ON p.author_id = u.id WHERE 1=1`;
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND p.category=$${params.length}`;
    }
    if (author_id) {
      params.push(author_id);
      query += ` AND p.author_id=$${params.length}`;
    }
    params.push(limit, offset);
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
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
  try {
    const { rows } = await queryReturning(
      `INSERT INTO community_posts (id, title, content, category, author_id, images, tags, region, latitude, longitude, order_id, attached_product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), content=VALUES(content), category=VALUES(category),
         images=VALUES(images), tags=VALUES(tags), region=VALUES(region)`,
      [
        id,
        title,
        content,
        category,
        author_id,
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
       WHERE c.post_id=$1 ORDER BY c.created_at ASC`,
      [req.params.id],
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
        [id, req.params.id, author_id, content, parent_id],
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
      res.status(201).json(rows[0] || {});
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
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ??? ??? ??? ???????????????????????????????????????????
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

// ????????? ?? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/reviews", requireDb, async (req, res) => {
  const { reviewee_id, reviewer_id } = req.query;
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
    const { rows } = await queryReturning(
      `INSERT INTO reviews (id, reviewer_id, reviewee_id, order_id, rating, tags, comment, product_title, product_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON DUPLICATE KEY UPDATE rating=VALUES(rating), comment=VALUES(comment)`,
      [
        id,
        reviewer_id,
        reviewee_id,
        order_id,
        rating,
        tags || [],
        comment,
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
  const { target_user_id } = req.query;
  if (req.authUserId && target_user_id && req.authUserId !== target_user_id)
    return res.status(403).json({ error: "Forbidden" });
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

app.post("/api/notifications", requireDb, async (req, res) => {
  const { id, target_user_id, type, title, content, link } = req.body;
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
  try {
    const { rows: nCheck } = await pool.query(
      "SELECT target_user_id FROM notifications WHERE id=$1",
      [req.params.id],
    );
    if (
      req.authUserId &&
      nCheck.length &&
      nCheck[0].target_user_id !== req.authUserId
    )
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("UPDATE notifications SET `read`=true WHERE id=$1", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ????? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/disputes", requireDb, async (req, res) => {
  const { buyer_id, seller_id } = req.query;
  if (req.authUserId) {
    if (buyer_id && req.authUserId !== buyer_id)
      return res.status(403).json({ error: "Forbidden" });
    if (seller_id && req.authUserId !== seller_id)
      return res.status(403).json({ error: "Forbidden" });
  }
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
      `INSERT INTO disputes (id, order_id, product_title, product_image, proposed_price, trade_method, buyer_id, seller_id, reason, action, description, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON DUPLICATE KEY UPDATE description=VALUES(description)`,
      [
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
        evidence || [],
      ],
      "disputes",
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ????????? ???? ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
app.get("/api/favorites", requireDb, async (req, res) => {
  const { user_id } = req.query;
  if (req.authUserId && user_id && req.authUserId !== user_id)
    return res.status(403).json({ error: "Forbidden" });
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
  const { user_id, product_id } = req.body;
  if (req.authUserId && user_id && req.authUserId !== user_id)
    return res.status(403).json({ error: "Forbidden" });
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
  const { user_id, product_id } = req.query;
  if (req.authUserId && user_id && req.authUserId !== user_id)
    return res.status(403).json({ error: "Forbidden" });
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
  if (!title || !String(title).trim() || !content || !String(content).trim()) {
    return res.status(400).json({ error: "title and content are required" });
  }
  if (req.authUserId && user_id && req.authUserId !== user_id) {
    return res.status(403).json({ error: "Forbidden" });
  }
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
        user_id || null,
        email || null,
        cat,
        String(title).trim(),
        String(content).trim(),
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
const ADMIN_PW = process.env.ADMIN_PASSWORD;
function requireAdmin(req, res, next) {
  if (!ADMIN_PW) return res.status(503).json({ error: "Admin not configured" });
  const pw = req.headers["x-admin-password"];
  if (pw !== ADMIN_PW) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ?????????? ?????
app.get("/api/admin/stats", requireDb, requireAdmin, async (_req, res) => {
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
      pool.query("SELECT COUNT(*) FROM orders WHERE status='completed'"),
      pool.query("SELECT COUNT(*) FROM products WHERE is_free_share=true"),
      pool
        .query("SELECT COUNT(*) FROM inquiries")
        .catch(() => ({ rows: [{ count: "0" }] })),
      pool
        .query("SELECT COUNT(*) FROM reports")
        .catch(() => ({ rows: [{ count: "0" }] })),
      pool
        .query("SELECT COUNT(*) FROM reports WHERE status='open'")
        .catch(() => ({ rows: [{ count: "0" }] })),
      pool.query(
        "SELECT id, nickname, created_at FROM users ORDER BY created_at DESC LIMIT 5",
      ),
      pool.query(
        "SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5",
      ),
    ]);
    res.json({
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
      recentUsers: r[13].rows,
      recentOrders: r[14].rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ??? ????? ??
app.get("/api/admin/users", requireDb, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nickname, profile_image, bio, kyc_status, trust_score, rating,
              trade_count, activity_region, seller_type, created_at
       FROM users ORDER BY created_at DESC LIMIT 500`,
    );
    res.json(rows);
  } catch (e) {
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
    const products = await pool.query(
      "SELECT id,title,status,price,created_at FROM products WHERE seller_id=$1 ORDER BY created_at DESC",
      [req.params.id],
    );
    const orders = await pool.query(
      "SELECT id,status,created_at FROM orders WHERE buyer_id=$1 OR seller_id=$1 ORDER BY created_at DESC",
      [req.params.id],
    );
    res.json({ ...rows[0], products: products.rows, orders: orders.rows });
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
      res.json(rows[0]);
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
  const { status, q, free_share } = req.query;
  try {
    let query = `SELECT p.*, u.nickname AS seller_nickname
                 FROM products p
                 LEFT JOIN users u ON p.seller_id = u.id
                 WHERE 1=1`;
    const params = [];
    if (status) {
      params.push(status);
      query += ` AND p.status=$${params.length}`;
    }
    if (free_share === "true") {
      query += ` AND p.is_free_share=true`;
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
        description ? String(description).trim() : null,
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
                        rsv.nickname AS resolved_by_nickname
                 FROM reports r
                 LEFT JOIN users rep ON r.reporter_id = rep.id
                 LEFT JOIN users rsv ON r.resolved_by = rsv.id
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

// Admin: resolve / dismiss / reopen a report
app.put("/api/admin/reports/:id", requireDb, requireAdmin, async (req, res) => {
  const { status, admin_note } = req.body;
  if (status && !["open", "resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    const { rows } = await queryReturning(
      `UPDATE reports SET
         status = COALESCE($1, status),
         admin_note = COALESCE($2, admin_note),
         resolved_at = CASE WHEN $1 IN ('resolved','dismissed') THEN NOW() ELSE resolved_at END
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
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

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

    if (pool && room) {
      try {
        await pool.query(
          `INSERT INTO chat_messages (id, room_id, sender_id, content, type, images)
           VALUES ($1,$2,$3,$4,$5,$6) ON DUPLICATE KEY UPDATE id=id`,
          [
            message.id,
            roomId,
            message.senderId,
            message.content,
            message.type || "text",
            message.images || [],
          ],
        );
      } catch (e) {
        console.error("[socket] save message error:", e.message);
      }
    }

    socket.to(`room:${roomId}`).emit("new_message", { roomId, message });

    const participantIds = [room?.buyerId, room?.sellerId].filter(Boolean);
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

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[backend] http://0.0.0.0:${PORT}  (health: /api/health, ws: enabled)`,
  );
});
