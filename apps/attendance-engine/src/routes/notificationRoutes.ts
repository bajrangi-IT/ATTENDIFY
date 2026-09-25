import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/authMiddleware.js';
import { supabaseAdmin } from '../db/client.js';
import { notificationService, NotificationEventType } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

export const notificationRouter = Router();

/**
 * GET /api/notifications
 * Retrieves notifications for authenticated user with unread counter
 */
notificationRouter.get('/', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { unreadOnly = 'false', limit = '30', offset = '0' } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from('in_app_notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, count, error } = await query;
    if (error) throw error;

    // Fetch unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('in_app_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    return res.status(200).json({
      notifications: notifications || [],
      total: count || 0,
      unreadCount: unreadCount || 0
    });
  } catch (err: any) {
    logger.error('Failed to retrieve notifications', err);
    return res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

/**
 * POST /api/notifications/:id/read
 * Marks a single notification as read with IDOR protection
 */
notificationRouter.post('/:id/read', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('in_app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_id', user.id) // IDOR prevention
      .select('id, is_read, read_at')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Notification not found or access denied' });
    }

    return res.status(200).json({ success: true, notification: data });
  } catch (err: any) {
    logger.error('Failed to mark notification read', err);
    return res.status(500).json({ error: 'Failed to update notification state' });
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all notifications for user as read
 */
notificationRouter.post('/read-all', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const { error } = await supabaseAdmin
      .from('in_app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    logger.error('Failed to mark all notifications read', err);
    return res.status(500).json({ error: 'Failed to clear unread notifications' });
  }
});

/**
 * POST /api/notifications/dispatch-event
 * Dispatches an institutional event (attendance marked, low attendance, timetable changed, session started/ended, report, correction, leave, device offline)
 */
notificationRouter.post(
  '/dispatch-event',
  authenticateJwt,
  requireRole('faculty', 'hod', 'director', 'it_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const {
        eventType,
        recipientId,
        sectionId,
        title,
        message,
        actionUrl,
        channels = ['in_app', 'push']
      } = req.body;

      if (!eventType || (!recipientId && !sectionId)) {
        return res.status(400).json({
          error: 'eventType and either recipientId or sectionId are required'
        });
      }

      if (sectionId) {
        const count = await notificationService.broadcastSection(
          sectionId,
          title || `Campus Notice: ${eventType.replace(/_/g, ' ')}`,
          message || 'New institutional update for your class section.',
          eventType as NotificationEventType,
          actionUrl
        );

        return res.status(200).json({
          success: true,
          broadcastCount: count,
          message: `Dispatched to ${count} students in section ${sectionId}`
        });
      }

      const result = await notificationService.send({
        recipientId,
        title,
        message,
        type: eventType as NotificationEventType,
        actionUrl,
        channels
      });

      return res.status(200).json({
        success: true,
        result,
        message: `Notification dispatched for event ${eventType}`
      });
    } catch (err: any) {
      logger.error('Error dispatching notification event', err);
      return res.status(500).json({ error: 'Failed to dispatch notification' });
    }
  }
);
