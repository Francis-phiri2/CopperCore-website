# CopperCore Industrial Supplies

A full-stack website for CopperCore Industrial Supplies Ltd, created by Mawu Creatives. The site pairs a high-performance responsive frontend served by Express with an enquiry API backed by SQLite (`better-sqlite3`).

---

## Tech Stack

- **Runtime:** Node.js 20+
- **Server:** Express 5 serving static assets and JSON API
- **Database:** SQLite (`better-sqlite3`) with WAL mode enabled
- **Security:** Helmet CSP & security headers, `express-rate-limit`, timing-safe admin token comparison, honeypot spam protection
- **Validation:** Zod schema validation
- **Frontend:** Vanilla HTML5, CSS3, ES modules (zero client-side build step)

---

## Quick Start (Local Development)

1. Make sure Node.js 20+ is installed:
   ```bash
   node -v
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Create your local environment file:
   ```bash
   cp .env.example .env
   ```
4. Start the development server (auto-reloads on file change):
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment & Hosting Options

This project is fully containerized and production-ready for deployment on any cloud host.

### Option 1: Render (Recommended with SQLite Disk)
A `render.yaml` blueprint is pre-configured in this repository.
1. Connect your GitHub / GitLab repository to [Render.com](https://render.com).
2. Choose **New Blueprint Instance** and select the repository.
3. Render will provision the web service with a persistent disk for SQLite at `/app/data`.

### Option 2: Railway / Heroku / Dokku
The repository contains a standard `Procfile`:
```procfile
web: node server.js
```
1. Create a new service on Railway or Heroku and link your repository.
2. In Railway, attach a persistent volume to `/app/data` (or `./data`).
3. Set environment variables:
   - `NODE_ENV=production`
   - `TRUST_PROXY=1`
   - `ADMIN_TOKEN=<your-secret-key>`

### Option 3: Docker / Container Deployment
A multi-stage, production-hardened `Dockerfile` is included:
```bash
# Build the Docker image
docker build -t coppercore-industrial .

# Run container with a persistent volume for the database
docker run -d \
  -p 3000:3000 \
  -v coppercore_data:/app/data \
  -e NODE_ENV=production \
  -e TRUST_PROXY=1 \
  -e ADMIN_TOKEN="your-secure-token-here" \
  --name coppercore \
  coppercore-industrial
```

### Option 4: Linux VPS / PM2
On an Ubuntu / Debian VPS with Nginx and Node.js:
```bash
git clone <your-repo>
cd CopperCore-website
npm ci --omit=dev
cp .env.example .env
# Edit .env with your production values

# Run with PM2 process manager
npm install -g pm2
pm2 start server.js --name "coppercore"
pm2 save
pm2 startup
```

---

## API Reference

### 1. Submit Enquiry
- **Endpoint:** `POST /api/enquiries`
- **Rate Limit:** 5 submissions per 15 minutes per IP
- **Payload:**
  ```json
  {
    "name": "Alex Banda",
    "company": "Example Mining Corp",
    "email": "alex@example.com",
    "phone": "+260 97 000 0000",
    "category": "Mining Equipment & Accessories",
    "message": "Requesting quote for underground drilling consumables.",
    "website": ""
  }
  ```
- **Responses:**
  - `201 Created`: `{ "ok": true, "id": "1", "message": "..." }`
  - `400 Bad Request`: Validation failure details
  - `429 Too Many Requests`: Rate limit exceeded

### 2. Admin Enquiries (Protected)
- **Endpoint:** `GET /api/admin/enquiries?limit=25`
- **Headers:** `Authorization: Bearer <ADMIN_TOKEN>`
- **Response:** Returns list of enquiries ordered by newest first.

### 3. Health Check
- **Endpoints:** `GET /api/health` or `GET /healthz`
- **Response:**
  ```json
  {
    "ok": true,
    "service": "coppercore-industrial",
    "uptime": 120,
    "timestamp": "2026-10-15T23:30:00.000Z"
  }
  ```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` in live environments |
| `PORT` | `3000` | Port the server listens on |
| `HOST` | `0.0.0.0` | Network interface to bind (uses `0.0.0.0` for containers) |
| `DATABASE_PATH` | `./data/coppercore.sqlite` | Filepath to SQLite database |
| `TRUST_PROXY` | `1` in prod | Enable when behind reverse proxies (Nginx, Render, Cloudflare) |
| `ADMIN_TOKEN` | (none) | Secret Bearer token required for `GET /api/admin/enquiries` |
