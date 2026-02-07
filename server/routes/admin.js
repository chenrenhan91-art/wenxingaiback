import express from 'express';
import crypto from 'crypto';
import { listUsers, setProStatus } from '../lib/users.js';
import { getDbPath } from '../lib/db.js';
import { signAdminToken, verifyToken } from '../lib/security.js';

export const adminRouter = express.Router();

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

adminRouter.post('/login', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: 'SERVER_MISCONFIG', message: 'ADMIN_PASSWORD 未配置' });
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < 1) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'password 不能为空' });
  }

  if (!safeEqual(password, adminPassword)) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '后台密码错误' });
  }

  const token = signAdminToken();
  return res.json({ token });
});

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录后台' });
  }

  try {
    const decoded = verifyToken(match[1]);
    if (!decoded || decoded.admin !== true) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '无后台权限' });
    }
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '后台登录已过期，请重新登录' });
  }
}

adminRouter.get('/users', requireAdmin, async (req, res) => {
  const users = await listUsers();
  const total = users.length;
  const proCount = users.filter(u => Boolean(u.isPro)).length;
  return res.json({ total, proCount, users });
});

adminRouter.get('/db-info', requireAdmin, async (req, res) => {
  return res.json({
    sqlitePath: getDbPath(),
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV || '',
  });
});

adminRouter.post('/set-pro', requireAdmin, async (req, res) => {
  const { userId, isPro } = req.body || {};
  const idNum = Number(userId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'userId 必须是正整数' });
  }

  const updated = await setProStatus({ userId: idNum, isPro: Boolean(isPro) });
  if (!updated) return res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });

  return res.json({ ok: true, user: { id: updated.id, username: updated.username, isPro: Boolean(updated.isPro) } });
});
