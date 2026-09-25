import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/authMiddleware.js';
import { supabaseAdmin } from '../db/client.js';
import { auditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

export const auditRouter = Router();

/**
 * GET /api/audit-logs
 * Secure audit trail retrieval for institutional administrators
 * Normal users (students/faculty) are strictly forbidden
 */
auditRouter.get(
  '/',
  authenticateJwt,
  requireRole('director', 'hod', 'it_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const {
        action,
        entityType,
        actorId,
        startDate,
        endDate,
        limit = '50',
        offset = '0'
      } = req.query as Record<string, string>;

      let query = supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

      if (action) query = query.eq('action', action);
      if (entityType) query = query.eq('entity_type', entityType);
      if (actorId) query = query.eq('actor_id', actorId);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data: logs, count, error } = await query;
      if (error) throw error;

      return res.status(200).json({
        auditLogs: logs || [],
        total: count || 0,
        page: Math.floor(parseInt(offset, 10) / parseInt(limit, 10)) + 1
      });
    } catch (err: any) {
      logger.error('Failed to query audit logs', err);
      return res.status(500).json({ error: 'Failed to retrieve audit trail' });
    }
  }
);

/**
 * POST /api/audit-logs
 * Administrative / Service logging of operational actions
 */
auditRouter.post(
  '/',
  authenticateJwt,
  requireRole('faculty', 'hod', 'director', 'it_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        action,
        entityType,
        entityId,
        reason,
        beforeValue,
        afterValue,
        metadata
      } = req.body;

      if (!action || !entityType || !entityId) {
        return res.status(400).json({
          error: 'action, entityType, and entityId are required fields'
        });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      const logId = await auditService.log({
        actorId: user.id,
        action,
        entityType,
        entityId,
        reason,
        beforeValue,
        afterValue,
        ipAddress: clientIp,
        metadata
      });

      return res.status(201).json({
        success: true,
        auditLogId: logId,
        message: 'Immutable audit record registered'
      });
    } catch (err: any) {
      logger.error('Audit registration failed', err);
      return res.status(500).json({ error: 'Failed to record audit event' });
    }
  }
);

/**
 * Audit records are immutable: ANY update or delete attempt is rejected at both API and DB levels
 */
auditRouter.all('/:id', authenticateJwt, (req: Request, res: Response) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    logger.security(`Forbidden tamper attempt on audit log ${req.params.id} by ${(req as any).user?.id}`);
    return res.status(403).json({
      error: 'Audit logs are strictly immutable and cannot be updated or deleted.'
    });
  }
  return res.status(405).json({ error: 'Method not allowed' });
});
