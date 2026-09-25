import { Router, Request, Response } from 'express';
import { SessionService } from '../services/sessionService.js';

export const sessionRouter = Router();

// POST /api/sessions/start
sessionRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const result = await SessionService.startSession(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sessions/:id/end
sessionRouter.post('/:id/end', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await SessionService.endSession(id, notes);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/:id
sessionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await SessionService.getActiveSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.status(200).json(session);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
