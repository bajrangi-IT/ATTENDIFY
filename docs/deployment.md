# CampusAttend OS - Production Deployment Guide

## 1. Unified Single-Port 24x7 Architecture (All Roles & Kiosks on One Port)

CampusAttend OS can be deployed such that **ONE SINGLE PORT** (default port `3000` or configured via `PORT`) serves all frontend roles, classroom kiosks, and backend APIs continuously 24/7 without needing multiple listening ports or complex proxy setups.

### Single-Port Routing Table

| URL Route | Destination Application / Service | Authorized Roles / Clients |
| :--- | :--- | :--- |
| `http://localhost:3000/` | **College Web Portal** (`apps/college-web`) | **ALL ROLES**: Student, Faculty, HOD, Director, IT Admin, Super Admin |
| `http://localhost:3000/display` | **Smart Board Kiosk** (`apps/smart-display`) | Classroom 86" Smart Displays, Projector Kiosks |
| `http://localhost:3000/kiosk` | Shortcut redirect to `/display` | Smart Board hardware pairing & rotation |
| `http://localhost:3000/api/...` | **Attendance Engine Microservice** | JWT Authenticated API check-ins, scans, sessions |
| `http://localhost:3000/api/health` | **24x7 Liveness Healthcheck** | Load balancers, supervisor daemons, Uptime Kuma |
| `http://localhost:3000/api/health/detailed` | **24x7 Telemetry Probe** | Database latency, Redis status, memory RSS |

---

## 2. 24x7 High-Availability Deployment Options

### Option A: Built-in Standalone 24x7 Supervisor (Recommended for Linux/Windows VPS)
No external process manager installation required:
```bash
# 1. Build all frontend bundles once
npm run build

# 2. Launch 24x7 Supervisor Daemon
npm run serve:24x7
# Or in background on Linux:
nohup npm run serve:24x7 > logs/daemon.log 2>&1 &
```
- **Self-Healing:** Automatically restarts child process within 1 second if unhandled errors occur.
- **Continuous Health Probes:** Probes `/api/health` every 15 seconds.
- **Log Archiving:** Persists timestamped logs in `logs/supervisor.log`.

### Option B: PM2 Enterprise Process Manager
For automated system reboot recovery (`systemd` / Windows Service):
```bash
# Install PM2 globally
npm install -g pm2

# Start with production ecosystem config
npm run pm2:start

# Save process list for auto-boot on server restart
pm2 save
pm2 startup

# Monitor live 24/7 logs and metrics
npm run pm2:status
npm run pm2:logs
```

### Option C: Single-Port Docker Compose 24x7
```bash
# Launch containerized 24x7 stack on single port 3000
docker compose -f docker-compose.24x7.yml up -d
```

---

## 3. Multi-Tier Distributed Cloud Topology
For massive multi-campus university deployments with independent edge CDNs:

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  attendance-engine:
    image: campusattend/attendance-engine:latest
    build:
      context: .
      dockerfile: apps/attendance-engine/Dockerfile
    restart: always
    environment:
      - PORT=4000
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_URL=redis://redis:6379
      - CORS_ORIGIN=https://portal.campus.edu,https://board.campus.edu
    ports:
      - "4000:4000"
    depends_on:
      - redis
    networks:
      - internal-net

  redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis-data:/data
    networks:
      - internal-net

  web-gateway:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/ssl/certs:ro
    depends_on:
      - attendance-engine
    networks:
      - internal-net

networks:
  internal-net:
    driver: bridge

volumes:
  redis-data:
```

---

## 3. Environment Variables Audit & Hardening Matrix

| Variable | Scope | Safe for Frontend/Mobile? | Production Recommendation |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Web / Mobile | **YES** | Point to custom domain (e.g. `https://auth.campus.edu`) |
| `VITE_SUPABASE_ANON_KEY` | Web / Mobile | **YES** (Protected by RLS) | Never grant bypass privileges |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Only | **STRICTLY FORBIDDEN ON CLIENTS** | Store in Doppler / AWS Secrets Manager |
| `REDIS_URL` | Backend Only | **STRICTLY FORBIDDEN ON CLIENTS** | High-availability Redis with TLS enabled |
| `JWT_SECRET` | Backend / Supabase | **STRICTLY FORBIDDEN ON CLIENTS** | Min 256-bit cryptographically secure string |

---

## 4. Web Build & Deployment Commands

### College Web Application (`apps/college-web`)
```bash
# Build production bundle
npm run build --workspace=@campusattend/college-web

# Output location: apps/college-web/dist
# Deploy to static host:
npx vercel --prod apps/college-web/dist
# Or copy to Nginx /var/www/college-web
```

### Classroom Smart Display (`apps/smart-display`)
```bash
# Build production kiosk bundle
npm run build --workspace=@campusattend/smart-display

# Output location: apps/smart-display/dist
# Deploy to dedicated internal display server:
# https://board.campus.edu
```

---

## 5. Reverse Proxy Configuration (`nginx.conf`)
```nginx
server {
    listen 443 ssl http2;
    server_name api.campus.edu;

    ssl_certificate /etc/ssl/certs/fullchain.pem;
    ssl_certificate_key /etc/ssl/certs/privkey.pem;

    location / {
        proxy_pass http://attendance-engine:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
