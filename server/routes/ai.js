import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { getUserById, computeQuotaView, incrementQuotaUsed } from '../lib/users.js';

export const aiRouter = express.Router();

function getUpstreamConfig() {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  const apiKey = process.env.MAKE_API_KEY;
  return { webhookUrl, apiKey };
}

async function callMakeWebhook({ question }) {
  const { webhookUrl, apiKey } = getUpstreamConfig();
  if (!webhookUrl || !apiKey) {
    const missing = [!webhookUrl ? 'MAKE_WEBHOOK_URL' : null, !apiKey ? 'MAKE_API_KEY' : null].filter(Boolean).join(', ');
    throw new Error(`Missing env: ${missing}`);
  }

  const url = new URL(webhookUrl);
  url.searchParams.set('question', question);

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-make-apikey': apiKey,
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Upstream error: ${resp.status}`);
    err.status = resp.status;
    err.upstreamBody = text;
    throw err;
  }

  const bodyText = await resp.text();
  return bodyText || '星象模糊，无法解读。';
}

aiRouter.post('/ai', requireAuth, async (req, res) => {
  const { prompt, systemInstruction } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'prompt 不能为空' });
  }

  const userId = req.user.userId;
  const user = await getUserById(userId);
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: '请重新登录' });

  const quota = computeQuotaView(user);

  const fullQuestion = (typeof systemInstruction === 'string' && systemInstruction.trim())
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;

  // Pro: unlimited
  if (quota.isPro) {
    try {
      const text = await callMakeWebhook({ question: fullQuestion });
      return res.json({ text, ...quota });
    } catch (e) {
      return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'AI 服务暂时不可用', detail: String(e?.message || '') });
    }
  }

  // Free: total 3 lifetime
  if (quota.remaining <= 0) {
    return res.status(402).json({
      error: 'NO_QUOTA',
      message: '免费额度已用完（共 3 次）。请升级专业版继续使用。',
      ...quota,
    });
  }

  // Reserve one call first to reduce race; refund if upstream fails
  await incrementQuotaUsed({ userId, delta: 1 });

  try {
    const text = await callMakeWebhook({ question: fullQuestion });
    const fresh = await getUserById(userId);
    const view = computeQuotaView(fresh);
    return res.json({ text, ...view });
  } catch (e) {
    await incrementQuotaUsed({ userId, delta: -1 });
    const fresh = await getUserById(userId);
    const view = computeQuotaView(fresh);
    return res.status(502).json({
      error: 'UPSTREAM_ERROR',
      message: 'AI 服务暂时不可用，本次未扣额度',
      detail: String(e?.message || ''),
      ...view,
    });
  }
});
