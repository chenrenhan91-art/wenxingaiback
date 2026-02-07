import express from 'express';
import { createUser, getUserByUsername, verifyPassword, computeQuotaView } from '../lib/users.js';
import { signToken, getJwtSecretStatus } from '../lib/security.js';

export const authRouter = express.Router();

function validateCreds(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return '账号或密码格式错误';
  const u = username.trim();
  if (u.length < 3 || u.length > 32) return '用户名长度需 3-32';
  if (password.length < 6 || password.length > 72) return '密码长度需 6-72';
  return null;
}

authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  const err = validateCreds(username, password);
  if (err) return res.status(400).json({ error: 'BAD_REQUEST', message: err });

  try {
    const user = await createUser({ username: username.trim(), password });
    const token = signToken({ userId: user.id });
    const quota = computeQuotaView(user);
    const jwtStatus = getJwtSecretStatus();
    return res.json({
      token,
      user: { id: user.id, username: user.username, ...quota },
      warning: jwtStatus.usingDefault ? 'JWT_SECRET 未配置，当前为开发模式，请尽快设置环境变量' : undefined,
    });
  } catch (e) {
    const msg = String(e?.message || '注册失败');
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return res.status(409).json({ error: 'USERNAME_TAKEN', message: '用户名已被注册' });
    }
    return res.status(500).json({ error: 'SERVER_ERROR', message: '注册失败' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const err = validateCreds(username, password);
  if (err) return res.status(400).json({ error: 'BAD_REQUEST', message: err });

  const user = await getUserByUsername(username.trim());
  if (!user) return res.status(401).json({ error: 'INVALID_LOGIN', message: '账号或密码错误' });

  const ok = await verifyPassword(user, password);
  if (!ok) return res.status(401).json({ error: 'INVALID_LOGIN', message: '账号或密码错误' });

  const token = signToken({ userId: user.id });
  const quota = computeQuotaView(user);
  return res.json({ token, user: { id: user.id, username: user.username, ...quota } });
});
