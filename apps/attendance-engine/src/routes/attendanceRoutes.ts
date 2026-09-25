import { Router, Request, Response } from 'express';
import { AttendanceService } from '../services/attendanceService.js';
import { supabase } from '../db/client.js';

export const attendanceRouter = Router();

// POST /api/attendance/scan
attendanceRouter.post('/scan', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let clientAuthUserId: string | undefined;

    // Validate JWT if provided in Bearer authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        clientAuthUserId = user.id;
      }
    }

    const {
      sessionId,
      session_id,
      qrToken,
      qr_token,
      epochWindow,
      epoch_window,
      studentId,
      student_id,
      deviceFingerprint,
      device_fingerprint,
      geoLat,
      geo_lat,
      geoLng,
      geo_lng,
    } = req.body;

    const result = await AttendanceService.processScan({
      sessionId: sessionId || session_id,
      qrToken: qrToken || qr_token,
      epochWindow: epochWindow ?? epoch_window,
      studentId: studentId || student_id,
      clientAuthUserId,
      deviceFingerprint: deviceFingerprint || device_fingerprint,
      geoLat: geoLat ?? geo_lat,
      geoLng: geoLng ?? geo_lng,
      ipAddress: req.ip,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      status: 'rejected',
      message: err.message || 'Internal server error during attendance transaction',
    });
  }
});
