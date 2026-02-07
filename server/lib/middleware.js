import { verifyToken } from './security.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录' });
  }

  try {
    const decoded = verifyToken(match[1]);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '登录已过期，请重新登录' });
  }
}
