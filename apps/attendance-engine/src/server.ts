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
