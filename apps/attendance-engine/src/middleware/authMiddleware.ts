import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { UserRole } from '@campusattend/shared-types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string; // Auth user id or profile id
    profileId: string;
    email: string;
    role: UserRole;
    institutionId: string;
  };
  displayDevice?: {
    id: string;
    roomNumber: string;
    campusId: string;
  };
}

/**
 * Validates Supabase JWT Bearer token and attaches user identity to request
 */
export async function verifyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Bearer token required.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      // Allow service_role key or dev bypass for testing environment
      if (token === process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NODE_ENV === 'test') {
        const profileId = (req.headers['x-test-profile-id'] as string) || '30000000-0000-0000-0000-000000000001';
        const role = (req.headers['x-test-role'] as UserRole) || 'director';
        req.user = {
          id: profileId,
          profileId,
          email: 'admin@campusattend.edu',
          role,
          institutionId: '00000000-0000-0000-0000-000000000001'
        };
        return next();
      }

      logger.security('Invalid or expired auth token presented', { ip: req.ip });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication session.'
      });
    }

    // 2. Fetch profile from database to determine role and institution
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, institution_id, is_active')
      .eq('user_id', authData.user.id)
      .single();

    if (profError || !profile) {
      logger.security('Authenticated user lacks profile record', { userId: authData.user.id });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Institutional account profile not found.'
      });
    }

    if (!profile.is_active) {
      logger.security('Deactivated user attempted login', { profileId: profile.id });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your institutional account has been deactivated by administration.'
      });
    }

    req.user = {
      id: authData.user.id,
      profileId: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
      institutionId: profile.institution_id
    };

    next();
  } catch (err: any) {
    logger.error('Unexpected error in auth verification', err);
    return res.status(500).json({
      error: 'Internal Error',
      message: 'Authentication verification service error.'
    });
  }
}

/**
 * Role-Based Access Control Middleware
 * Accepts either an array or spread arguments: requireRole('director', 'hod') or requireRole(['director', 'hod'])
 */
export function requireRole(...roles: (UserRole | UserRole[])[]) {
  const flatRoles: UserRole[] = (roles.flat() as UserRole[]);
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    if (!flatRoles.includes(req.user.role)) {
      logger.security('Privilege escalation attempt or unauthorized role access', {
        userRole: req.user.role,
        requiredRoles: flatRoles,
        path: req.originalUrl,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have administrative permission to access this resource.'
      });
    }

    next();
  };
}

export const authenticateJwt = verifyAuth;

/**
 * Smart Board Display Token Authentication
 */
export async function verifyDisplayAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const displayToken = (req.headers['x-display-token'] as string) || req.query.token as string;

  if (!displayToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Smart display token required (x-display-token header).'
    });
  }

  try {
    const { data: classroom, error } = await supabaseAdmin
      .from('classrooms')
      .select('id, room_number, campus_id, is_active, display_token')
      .eq('display_token', displayToken)
      .single();

    if (error || !classroom) {
      logger.security('Invalid display token presented', { ip: req.ip });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or revoked display credentials.'
      });
    }

    if (!classroom.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Classroom display kiosk is currently disabled.'
      });
    }

    req.displayDevice = {
      id: classroom.id,
      roomNumber: classroom.room_number,
      campusId: classroom.campus_id
    };

    next();
  } catch (err: any) {
    logger.error('Error verifying display token', err);
    return res.status(500).json({ error: 'Internal Error', message: 'Display auth service failure.' });
  }
}

/**
 * In-Memory Sliding-Window Rate Limiter
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number = 60, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.ip || 'anonymous') + ':' + req.baseUrl;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      logger.security('Rate limit exceeded', { ip: req.ip, endpoint: req.originalUrl });
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait before retrying.',
        retryAfterMs: entry.resetAt - now
      });
    }

    entry.count++;
    next();
  };
}
