const mysql = require('mysql2/promise');

const BOOLEAN_FIELDS = new Set([
  'today_trade_available',
  'is_free_share',
  'allow_offer',
  'seller_completed',
  'buyer_completed',
  'read',
  'pi_verified',
]);

const TABLE_COLUMNS = {
  users: [
    'id',
    'nickname',
    'profile_image',
    'bio',
    'kyc_status',
    'trust_score',
    'rating',
    'trade_count',
    'activity_region',
    'verified_region',
    'display_activity_badge_id',
    'seller_type',
    'pi_verified',
    'created_at',
  ],
  products: [
    'id',
    'title',
    'description',
    'price',
    'category',
    'region',
    'status',
    'images',
    'seller_id',
    'trade_methods',
    'today_trade_available',
    'is_free_share',
    'allow_offer',
    'liked',
    'created_at',
  ],
  orders: [
    'id',
    'product_id',
    'buyer_id',
    'seller_id',
    'status',
    'proposed_price',
    'trade_method',
    'meetup_location',
    'meetup_time',
    'shipping_address',
    'shipping_name',
    'shipping_phone',
    'tracking_number',
    'shipping_company',
    'memo',
    'seller_completed',
    'buyer_completed',
    'created_at',
  ],
  chat_rooms: [
    'id',
    'product_id',
    'order_id',
    'buyer_id',
    'seller_id',
    'last_message',
    'last_message_time',
    'unread_count',
    'left_user_ids',
    'created_at',
  ],
  chat_messages: [
    'id',
    'room_id',
    'sender_id',
    'content',
    'type',
    'images',
    'order_id',
    'original_price',
    'proposed_price',
    'offer_result',
    'meetup_location',
    'meetup_time',
    'created_at',
  ],
  community_posts: [
    'id',
    'title',
    'content',
    'category',
    'author_id',
    'images',
    'tags',
    'comment_count',
    'like_count',
    'region',
    'latitude',
    'longitude',
    'order_id',
    'attached_product_id',
    'created_at',
  ],
  comments: ['id', 'post_id', 'author_id', 'content', 'parent_id', 'created_at'],
  reviews: [
    'id',
    'reviewer_id',
    'reviewee_id',
    'order_id',
    'rating',
    'tags',
    'comment',
    'product_title',
    'product_image',
    'created_at',
  ],
  notifications: ['id', 'target_user_id', 'type', 'title', 'content', 'link', 'read', 'created_at'],
  disputes: [
    'id',
    'order_id',
    'product_title',
    'product_image',
    'proposed_price',
    'trade_method',
    'buyer_id',
    'seller_id',
    'reason',
    'action',
    'description',
    'evidence',
    'status',
    'admin_response',
    'resolved_at',
    'created_at',
  ],
  favorites: ['id', 'user_id', 'product_id', 'created_at'],
  inquiries: [
    'id',
    'user_id',
    'email',
    'category',
    'title',
    'content',
    'images',
    'status',
    'admin_reply',
    'created_at',
    'replied_at',
  ],
  reports: [
    'id',
    'reporter_id',
    'target_type',
    'target_id',
    'reason',
    'description',
    'status',
    'admin_note',
    'resolved_by',
    'created_at',
    'resolved_at',
  ],
};

function parseMysqlUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use mysql:// or mysql2:// for the MySQL backend');
  }

  return {
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

function createPoolConfig(env) {
  const databaseUrl = env.DATABASE_URL || env.MYSQL_URL;
  const base = databaseUrl
    ? parseMysqlUrl(databaseUrl)
    : {
        host: env.DB_HOST,
        port: Number(env.DB_PORT) || 3306,
        user: env.DB_USER,
        password: env.DB_PASSWORD || '',
        database: env.DB_NAME,
      };

  if (!base.host || !base.user || !base.database) return null;

  return {
    ...base,
    waitForConnections: true,
    connectionLimit: Number(env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: false,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  };
}

function normalizeParam(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function replacePlaceholders(sql, params = []) {
  const values = [];
  const text = sql.replace(/\$(\d+)/g, (_match, index) => {
    values.push(normalizeParam(params[Number(index) - 1]));
    return '?';
  });

  return { text, values };
}

function parseJsonLike(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !['{', '['].includes(trimmed[0])) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeValue(key, rawValue) {
  let value = parseJsonLike(rawValue);

  if (Array.isArray(value)) {
    value = value.map((item) => normalizeValue('', item));
  } else if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    value = Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, normalizeValue(childKey, childValue)]));
  }

  if (BOOLEAN_FIELDS.has(key) && value !== null && value !== undefined) return Boolean(value);
  return value;
}

function normalizeRow(row) {
  const out = {};
  for (const [key, rawValue] of Object.entries(row)) {
    out[key] = normalizeValue(key, rawValue);
    if (key.toLowerCase() === 'count(*)') out.count = out[key];
  }
  return out;
}

function jsonObjectSql(alias, tableName) {
  const columns = TABLE_COLUMNS[tableName];
  if (!columns) return 'NULL';

  const pairs = columns.map((column) => `'${column}', ${alias}.${column}`).join(', ');
  const nullCheck = columns.includes('id') ? `${alias}.id` : `${alias}.${columns[0]}`;
  return `IF(${nullCheck} IS NULL, NULL, JSON_OBJECT(${pairs}))`;
}

class MysqlPool {
  constructor(pool) {
    this.pool = pool;
  }

  async query(sql, params = []) {
    const { text, values } = replacePlaceholders(sql, params);
    const [result] = await this.pool.query(text, values);

    if (Array.isArray(result)) {
      return { rows: result.map(normalizeRow), rowCount: result.length };
    }

    return {
      rows: [],
      rowCount: result.affectedRows || 0,
      insertId: result.insertId,
    };
  }

  async end() {
    await this.pool.end();
  }
}

function createDbPool(env = process.env) {
  const config = createPoolConfig(env);
  if (!config) return null;

  return new MysqlPool(mysql.createPool(config));
}

module.exports = { createDbPool, jsonObjectSql };
