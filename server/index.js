import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { createRequire } from 'module';
import { initDb } from './lib/db.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { aiRouter } from './routes/ai.js';
import { adminRouter } from './routes/admin.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();
app.disable('x-powered-by');

// So req.ip uses X-Forwarded-For when proxied by local Nginx
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : 'loopback');

initDb();

app.use(express.json({ limit: '1mb' }));

// Static site
app.use(express.static(projectRoot));

// Version
app.get('/api/version', (req, res) => res.json({ version: pkg.version }));

// API
app.use('/api/auth', authRouter);
app.use('/api', meRouter);
app.use('/api', aiRouter);
app.use('/api/admin', adminRouter);

// SPA-ish fallback to index.html for convenience when user hits / directly
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[wenxing] Server listening on http://localhost:${port}`);
});
