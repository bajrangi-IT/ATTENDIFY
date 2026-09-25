import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config } from './config.js';
import { sessionRouter } from './routes/sessionRoutes.js';
import { attendanceRouter } from './routes/attendanceRoutes.js';
import { displayRouter } from './routes/displayRoutes.js';
import { loadtestRouter } from './routes/loadtestRoutes.js';
import { reportRouter } from './routes/reportRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { uploadRouter } from './routes/uploadRoutes.js';
import { cacheManager } from './redis/cache.js';
import { supabaseAdmin } from './db/client.js';
import { logger } from './utils/logger.js';
import { metricsCollector } from './utils/metrics.js';

export const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-display-token', 'apikey', 'x-correlation-id']
  })
);

app.use(express.json({ limit: '10mb' }));

// Telemetry & Correlation ID Tracking Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  (req as any).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const startTime = Date.now();

  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    metricsCollector.recordRequest(latencyMs, isError);

    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${latencyMs}ms)`, {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      latencyMs
    });
  });

  next();
});

// Basic Health Endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const cacheStatus = cacheManager.getStatus();
  const dbStart = Date.now();
  let dbLatencyMs = -1;
  let isDbHealthy = false;

  try {
    const { error } = await supabaseAdmin.from('institutions').select('id').limit(1);
    if (!error) {
      isDbHealthy = true;
      dbLatencyMs = Date.now() - dbStart;
    }
  } catch (err) {
    isDbHealthy = false;
  }

  return res.status(isDbHealthy ? 200 : 503).json({
    status: isDbHealthy ? 'healthy' : 'degraded',
    service: 'CampusAttend OS - Attendance Engine',
    timestamp: new Date().toISOString(),
    database: {
      healthy: isDbHealthy,
      latencyMs: dbLatencyMs
    },
    cache: cacheStatus
  });
});

// Detailed Observability & Dependency Health Endpoint
app.get('/api/health/detailed', async (_req: Request, res: Response) => {
  const dbStart = Date.now();
  let dbLatencyMs = -1;
  let isDbHealthy = false;
  let activeSessionsCount = 0;

  try {
    const { count, error } = await supabaseAdmin
      .from('attendance_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress');

    if (!error) {
      isDbHealthy = true;
      dbLatencyMs = Date.now() - dbStart;
      activeSessionsCount = count || 0;
    }
  } catch (err) {
    isDbHealthy = false;
  }

  // Redis Latency Probe
  const redisStart = Date.now();
  let redisLatencyMs = -1;
  let isRedisHealthy = false;
  const cacheStatus = cacheManager.getStatus();

  try {
    await cacheManager.get('health_probe_key');
    redisLatencyMs = Date.now() - redisStart;
    isRedisHealthy = true;
  } catch (err) {
    isRedisHealthy = false;
  }

  const mem = process.memoryUsage();
  const metricsSnapshot = metricsCollector.getSnapshot();

  const isOverallHealthy = isDbHealthy;

  return res.status(isOverallHealthy ? 200 : 503).json({
    status: isOverallHealthy ? 'healthy' : 'degraded',
    service: 'CampusAttend OS - Attendance & Operational Engine',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        healthy: isDbHealthy,
        latencyMs: dbLatencyMs,
        provider: 'Supabase PostgreSQL'
      },
      redisCache: {
        healthy: isRedisHealthy,
        latencyMs: redisLatencyMs,
        mode: cacheStatus.mode
      }
    },
    operations: {
      activeAttendanceSessions: activeSessionsCount,
      totalRequestsTracked: metricsSnapshot.totalRequests,
      errorRatePercent: metricsSnapshot.errorRatePercent,
      avgLatencyMs: metricsSnapshot.avgLatencyMs,
      p95LatencyMs: metricsSnapshot.p95LatencyMs,
      attendanceScansTotal: metricsSnapshot.attendanceScansTotal,
      qrFailuresTotal: metricsSnapshot.qrFailuresTotal,
      qrFailureRatePercent: metricsSnapshot.qrFailureRatePercent,
      queueJobsCompleted: metricsSnapshot.queueJobsCompleted,
      queueJobsFailed: metricsSnapshot.queueJobsFailed
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: +(mem.rss / 1024 / 1024).toFixed(2),
      heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(2)
    }
  });
});

// Mount Application Routes
app.use('/api/sessions', sessionRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/display', displayRouter);
app.use('/api/load-test', loadtestRouter);
app.use('/api/reports', reportRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/upload', uploadRouter);

// -----------------------------------------------------------------------------
// UNIFIED SINGLE-PORT STATIC FRONTEND HOSTING (24x7 Access for All Roles)
// -----------------------------------------------------------------------------
import path from 'path';
import fs from 'fs';

// Locate frontend dist directories across monorepo
const resolvedDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const candidateCollegeWeb = [
  path.resolve(resolvedDir, '../../college-web/dist'),
  path.resolve(resolvedDir, '../../../college-web/dist'),
  path.resolve(process.cwd(), 'apps/college-web/dist'),
  path.resolve(process.cwd(), '../college-web/dist'),
  path.resolve(process.cwd(), 'college-web/dist'),
];
const collegeWebDist = candidateCollegeWeb.find(p => fs.existsSync(p));

const candidateSmartDisplay = [
  path.resolve(resolvedDir, '../../smart-display/dist'),
  path.resolve(resolvedDir, '../../../smart-display/dist'),
  path.resolve(process.cwd(), 'apps/smart-display/dist'),
  path.resolve(process.cwd(), '../smart-display/dist'),
  path.resolve(process.cwd(), 'smart-display/dist'),
];
const smartDisplayDist = candidateSmartDisplay.find(p => fs.existsSync(p));

// 1. Mount Classroom Smart Display Kiosk at /display
if (smartDisplayDist) {
  app.use('/display', express.static(smartDisplayDist));
  app.get(['/display', '/display/*'], (_req: Request, res: Response) => {
    res.sendFile(path.join(smartDisplayDist, 'index.html'));
  });
  app.get('/kiosk', (_req: Request, res: Response) => res.redirect('/display'));
}

// 1.5 Mount Expo Go Mobile App Gateway at /mobile
app.get('/mobile', (_req: Request, res: Response) => {
  const expUrl = 'exp://192.168.0.102:8081';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CampusAttend OS - Expo Go Mobile App</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-indigo-500">
  <header class="max-w-2xl mx-auto w-full flex justify-between items-center pb-6 border-b border-slate-800">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
        CA
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight">CampusAttend Mobile</h1>
        <p class="text-xs text-slate-400">Expo Go Development Bundle</p>
      </div>
    </div>
    <a href="/" class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition">
      Web Portal &rarr;
    </a>
  </header>

  <main class="max-w-md mx-auto w-full my-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      Metro Bundler Online (Port 8081)
    </div>

    <div>
      <h2 class="text-2xl font-black tracking-tight">Scan for Expo Go</h2>
      <p class="text-xs text-slate-400 mt-1">
        Open on Android or iOS via the official Expo Go client
      </p>
    </div>

    <!-- QR Code Container -->
    <div class="p-4 bg-white rounded-2xl shadow-xl border-4 border-indigo-500/30 inline-block mx-auto">
      <img src="/expo_go_qr.png" alt="Expo Go QR Code" class="w-64 h-64 mx-auto rounded-lg" />
    </div>

    <!-- Deep Link details -->
    <div class="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-left space-y-1 font-mono text-xs">
      <span class="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Expo Go URL:</span>
      <a href="${expUrl}" class="text-indigo-400 hover:underline break-all font-semibold">${expUrl}</a>
    </div>

    <div class="space-y-3 text-left text-xs text-slate-300">
      <div class="flex items-start gap-2.5">
        <span class="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">1</span>
        <p><strong>Android:</strong> Open <strong class="text-white">Expo Go</strong> app & tap <strong class="text-indigo-400">"Scan QR code"</strong>.</p>
      </div>
      <div class="flex items-start gap-2.5">
        <span class="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">2</span>
        <p><strong>iOS (iPhone):</strong> Open native <strong class="text-white">Camera</strong> app & point at QR code, then tap the prompt.</p>
      </div>
    </div>

    <a href="${expUrl}" class="block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition text-center">
      Open in Expo Go on this Device
    </a>
  </main>

  <footer class="max-w-2xl mx-auto w-full text-center text-xs text-slate-600 pt-6 border-t border-slate-800">
    CampusAttend OS • Expo SDK 51 • Native Camera & Dynamic Attendance QR Engine
  </footer>
</body>
</html>`);
});

// 2. Mount College Web Portal (Student, Faculty, HOD, Director, IT Admin, Super Admin) at root /
if (collegeWebDist) {
  app.use(express.static(collegeWebDist));
  // Single-Page Application (SPA) routing fallback for all roles
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/display')) {
      return next();
    }
    res.sendFile(path.join(collegeWebDist, 'index.html'));
  });
}

// Centralized Secure Error Handling Middleware
// CRITICAL: Never expose database stack traces or secrets to users!
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const correlationId = (req as any).correlationId || 'unknown';

  // Server-side detailed logging
  logger.error('Unhandled internal server error', err, {
    correlationId,
    path: req.originalUrl,
    method: req.method
  });

  // Client sanitized response
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: 'An internal processing error occurred',
    message: statusCode < 500 ? err.message : 'The server encountered an unexpected condition. Please try again later.',
    correlationId
  });
});

// -----------------------------------------------------------------------------
// 24x7 UNINTERRUPTED RESILIENCE GUARDS
// -----------------------------------------------------------------------------
process.on('uncaughtException', (err: Error) => {
  logger.error('CRITICAL: 24x7 Daemon Caught Uncaught Exception (Preserving Process)', err);
  console.error('[24x7 DAEMON] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('CRITICAL: 24x7 Daemon Caught Unhandled Rejection (Preserving Process)', { reason });
  console.error('[24x7 DAEMON] Unhandled Rejection:', reason);
});

// Start server if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`================================================================`);
    console.log(`⚡ CampusAttend OS - Unified 24x7 Attendance & Institutional Platform`);
    console.log(`📡 Single Port Access: http://localhost:${config.port}`);
    console.log(`🎓 College Portal (All Roles):   http://localhost:${config.port}/`);
    console.log(`   └─ Student, Faculty, HOD, Director, IT Admin, Super Admin`);
    console.log(`📺 Smart Board Kiosk Display:    http://localhost:${config.port}/display`);
    console.log(`🚀 API & Dynamic QR Engine:     http://localhost:${config.port}/api/health`);
    console.log(`📊 24x7 Telemetry Probe:         http://localhost:${config.port}/api/health/detailed`);
    console.log(`🔒 Connected to Supabase at:     ${config.supabaseUrl}`);
    console.log(`⚡ High-Performance Cache:       ${JSON.stringify(cacheManager.getStatus())}`);
    console.log(`================================================================`);
  });
}
