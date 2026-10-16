import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';
const dbPath = path.resolve(here, process.env.DATABASE_PATH || './data/coppercore.sqlite');
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries(created_at);`);

const app = express();

// Trust reverse proxy (essential for Docker, Render, Fly.io, Railway, Heroku, Cloudflare, Nginx)
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true' || (isProd && process.env.TRUST_PROXY !== '0')) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'https://images.unsplash.com', 'data:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '16kb', type: 'application/json' }));

// Serve favicon
app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(here, 'public', 'favicon.svg'));
});

// Static assets with caching in production
app.use(express.static(path.join(here, 'public'), {
  extensions: ['html'],
  maxAge: isProd ? '1d' : 0
}));

// Rate limiter for enquiry submissions (5 requests per 15 minutes per IP)
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many enquiries from this connection. Please try again later.' }
});

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  category: z.string().trim().max(100).optional().default(''),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional().default('')
}).strict();

const insertEnquiry = db.prepare(`INSERT INTO enquiries (name, company, email, phone, category, message)
  VALUES (@name, @company, @email, @phone, @category, @message)`);
const listEnquiries = db.prepare('SELECT id, name, company, email, phone, category, message, created_at AS createdAt FROM enquiries ORDER BY id DESC LIMIT ?');

app.post('/api/enquiries', enquiryLimiter, (req, res) => {
  const parsed = enquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Check the required fields and try again.', fields: parsed.error.issues.map(issue => issue.path[0]) });
  }

  try {
    const { website: _website, ...enquiry } = parsed.data;
    const result = insertEnquiry.run(enquiry);
    return res.status(201).json({ ok: true, id: result.lastInsertRowid.toString(), message: 'Thank you for your enquiry. Our procurement team will review your specifications and contact you shortly.' });
  } catch (error) {
    console.error('Could not save enquiry:', error.message);
    return res.status(500).json({ error: 'We could not save your enquiry. Please try again later.' });
  }
});

app.get('/api/admin/enquiries', (req, res) => {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) return res.status(503).json({ error: 'Admin access is not configured.' });
  const suppliedToken = req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(401).json({ error: 'Unauthorized.' });
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 25;
  return res.json({ enquiries: listEnquiries.all(limit) });
});

// Health checks for container orchestrators, uptime monitors, and platforms
app.get(['/api/health', '/healthz'], (_req, res) => {
  res.json({
    ok: true,
    service: 'coppercore-industrial',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// Fallback: Return index.html for GET navigation requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(here, 'public', 'index.html'));
  }
  next();
});

// Global error handler
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'The submitted request is too large.' });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'The request body must be valid JSON.' });
  console.error('Request error:', error);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const server = app.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`CopperCore server running on http://${displayHost}:${port} (environment: ${process.env.NODE_ENV || 'development'})`);
});

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    try {
      db.close();
      console.log('Database connection closed.');
    } catch (err) {
      console.error('Error closing database:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
