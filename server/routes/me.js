import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { getUserById, computeQuotaView } from '../lib/users.js';

export const meRouter = express.Router();

meRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const user = await getUserById(userId);
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: '请重新登录' });
  const quota = computeQuotaView(user);
  return res.json({ id: user.id, username: user.username, ...quota });
});
