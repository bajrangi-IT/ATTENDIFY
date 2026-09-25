#!/usr/bin/env node
/**
 * CampusAttend OS - 24x7 Standalone Supervisor Daemon
 * 
 * Provides continuous 24/7 uptime:
 * 1. Spawns and supervises the unified single-port application server.
 * 2. Automatically recovers and restarts upon unexpected process crashes.
 * 3. Runs periodic HTTP health checks against /api/health.
 * 4. Gracefully intercepts system signals (SIGTERM, SIGINT).
 */

import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = process.env.PORT || '3000';
let child = null;
let restartCount = 0;
let isShuttingDown = false;

// Ensure logs directory exists
const logsDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const supervisorLog = path.join(logsDir, 'supervisor.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] [24x7 SUPERVISOR] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(supervisorLog, line, { flag: 'a' });
}

function startServer() {
  if (isShuttingDown) return;

  log(`Starting CampusAttend OS Unified Server on Port ${PORT}... (Attempt #${restartCount + 1})`);

  const tsxCli = path.join(rootDir, 'node_modules/tsx/dist/cli.mjs');
  const serverScript = path.join(rootDir, 'apps/attendance-engine/src/server.ts');

  log(`Spawning High-Performance TypeScript Runtime: ${serverScript}`);
  child = spawn(process.execPath, [tsxCli, serverScript], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: PORT,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    log(`Server process exited with code=${code}, signal=${signal}`);
    child = null;

    if (!isShuttingDown) {
      restartCount++;
      const delayMs = Math.min(1000 * Math.pow(1.5, Math.min(restartCount, 6)), 15000);
      log(`Restarting server in ${(delayMs / 1000).toFixed(1)} seconds...`);
      setTimeout(startServer, delayMs);
    }
  });

  child.on('error', (err) => {
    log(`Process spawn error: ${err.message}`);
  });
}

// 24x7 Periodic Health Probe
setInterval(() => {
  if (isShuttingDown || !child) return;

  const req = http.get(`http://localhost:${PORT}/api/health`, { timeout: 8000 }, (res) => {
    res.resume();
    if (res.statusCode !== 200) {
      log(`Warning: Health check returned non-200 status (${res.statusCode})`);
    }
  });

  req.on('error', (err) => {
    log(`Warning: Health check probe failed: ${err.message}`);
  });

  req.on('timeout', () => {
    req.destroy();
    log(`Warning: Health check probe timed out after 5s`);
  });
}, 15000);

// Signal Handlers
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log(`Received ${signal}. Initiating graceful shutdown...`);

  if (child) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
    } else {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    log('Graceful shutdown complete.');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log('================================================================');
log(`CampusAttend OS - 24x7 High-Availability Supervisor Initialized`);
log(`Single Unified Port Target: http://localhost:${PORT}`);
log('================================================================');

startServer();
