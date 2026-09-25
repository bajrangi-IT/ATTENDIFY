import { Router, Request, Response } from 'express';
import { DisplayService } from '../services/displayService.js';
import { authenticateJwt, requireRole, verifyDisplayAuth } from '../middleware/authMiddleware.js';

export const displayRouter = Router();

// GET /api/display/poll (Smart Board state polling) - requires display credentials
displayRouter.get('/poll', verifyDisplayAuth, async (req: Request, res: Response) => {
  try {
    const token = (req.headers['x-display-token'] as string) || (req.query.token as string);
    const classroomId = req.query.classroom_id as string;

    const state = await DisplayService.getDisplayState(token, classroomId);
    return res.status(200).json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/display/session-feed (Live classroom dynamic QR and attendance roster) - requires display credentials
displayRouter.get('/session-feed', verifyDisplayAuth, async (req: Request, res: Response) => {
  try {
    const displayDevice = (req as any).displayDevice;
    const token = (req.headers['x-display-token'] as string) || (req.query.token as string);
    const classroomId = (req.query.classroomId as string) || displayDevice?.id;

    const state = await DisplayService.getDisplayState(token, classroomId);
    return res.status(200).json(state);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/display/pair (Device pairing with registration code)
displayRouter.post('/pair', async (req: Request, res: Response) => {
  try {
    const { pairing_code, device_identifier, device_name, device_model } = req.body;
    if (!pairing_code) {
      return res.status(400).json({ error: 'pairing_code is required' });
    }
    const result = await DisplayService.pairDevice(pairing_code, device_identifier, device_name, device_model);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/display/ping (Heartbeat) - requires display credentials
displayRouter.post('/ping', verifyDisplayAuth, async (req: Request, res: Response) => {
  try {
    const token = (req.headers['x-display-token'] as string) || req.body?.token;
    const result = await DisplayService.pingDevice(token);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/display/fleet (IT Admin fleet view) - requires IT Admin / Super Admin / Director
displayRouter.get(
  '/fleet',
  authenticateJwt,
  requireRole('it_admin', 'super_admin', 'director'),
  async (_req: Request, res: Response) => {
    try {
      const fleet = await DisplayService.getFleet();
      return res.status(200).json(fleet);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/display/:id/revoke (IT Admin revoke) - requires IT Admin / Super Admin
displayRouter.post(
  '/:id/revoke',
  authenticateJwt,
  requireRole('it_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await DisplayService.revokeDevice(id);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/display/:id/rotate (IT Admin rotate credentials) - requires IT Admin / Super Admin
displayRouter.post(
  '/:id/rotate',
  authenticateJwt,
  requireRole('it_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await DisplayService.rotateCredentials(id);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/display/:id (IT Admin rename/edit) - requires IT Admin / Super Admin
displayRouter.put(
  '/:id',
  authenticateJwt,
  requireRole('it_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await DisplayService.updateDevice(id, req.body);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);
