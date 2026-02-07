import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

export async function createUser({ username, password }) {
  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.run(
    `INSERT INTO users (username, password_hash, is_pro, ai_quota_total, ai_quota_used)
     VALUES (?, ?, 0, 3, 0)`,
    [username, passwordHash],
  );

  return getUserById(result.lastID);
}

export async function getUserByUsername(username) {
  const db = await getDb();
  return db.get(
    `SELECT id, username, password_hash as passwordHash, is_pro as isPro, ai_quota_total as quotaTotal, ai_quota_used as quotaUsed
     FROM users WHERE username = ?`,
    [username],
  );
}

export async function getUserById(id) {
  const db = await getDb();
  return db.get(
    `SELECT id, username, password_hash as passwordHash, is_pro as isPro, ai_quota_total as quotaTotal, ai_quota_used as quotaUsed
     FROM users WHERE id = ?`,
    [id],
  );
}

export function computeQuotaView(user) {
  const total = user.quotaTotal ?? 3;
  const used = user.quotaUsed ?? 0;
  const remaining = Math.max(0, total - used);
  return {
    total,
    used,
    remaining,
    isPro: Boolean(user.isPro),
  };
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

export async function setProStatus({ userId, isPro }) {
  const db = await getDb();
  await db.run(`UPDATE users SET is_pro = ? WHERE id = ?`, [isPro ? 1 : 0, userId]);
  return getUserById(userId);
}

export async function incrementQuotaUsed({ userId, delta }) {
  const db = await getDb();
  await db.run(`UPDATE users SET ai_quota_used = ai_quota_used + ? WHERE id = ?`, [delta, userId]);
  return getUserById(userId);
}

export async function listUsers() {
  const db = await getDb();
  const rows = await db.all(
    `SELECT
      id,
      username,
      is_pro as isPro,
      ai_quota_total as quotaTotal,
      ai_quota_used as quotaUsed,
      created_at as createdAt
    FROM users
    ORDER BY id DESC`,
  );
  // SQLite 存的 is_pro 是 0/1，统一转成布尔值方便前端判断
  return rows.map(r => ({ ...r, isPro: Boolean(r.isPro) }));
}
