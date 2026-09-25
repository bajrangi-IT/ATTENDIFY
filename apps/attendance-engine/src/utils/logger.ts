/**
 * Structured Logger for CampusAttend OS Attendance Engine
 * Provides structured JSON logging with correlation IDs and automated credential redaction.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apiKey',
  'serviceRoleKey',
  'key',
  'pin'
];

function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redact Bearer tokens
    if (obj.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = redactSensitiveData(val);
      }
    }
    return clean;
  }
  return obj;
}

export class Logger {
  private service: string;

  constructor(service: string = 'attendance-engine') {
    this.service = service;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      service: this.service,
      message,
      ...(metadata ? { metadata: redactSensitiveData(metadata) } : {})
    };

    const formatted = JSON.stringify(entry);
    if (level === 'ERROR' || level === 'SECURITY') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log('INFO', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log('WARN', message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: Record<string, any>) {
    this.log('ERROR', message, {
      ...metadata,
      errorMessage: error?.message || String(error),
      errorCode: error?.code
    });
  }

  security(message: string, metadata?: Record<string, any>) {
    this.log('SECURITY', message, metadata);
  }
}

export const logger = new Logger('attendance-engine');
