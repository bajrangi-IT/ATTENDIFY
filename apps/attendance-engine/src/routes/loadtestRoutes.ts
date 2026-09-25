import { Router, Request, Response } from 'express';
import { LoadTestRunner } from '../loadtest/loadtestEngine.js';

export const loadtestRouter = Router();

// POST /api/load-test/run
loadtestRouter.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      classesCount = 4,
      studentsPerClass = 65,
      duplicatePercentage = 15,
      concurrencyLimit = 30,
      includeInvalidQrProbe = true,
    } = req.body || {};

    const results = await LoadTestRunner.runSimulation({
      classesCount,
      studentsPerClass,
      duplicatePercentage,
      concurrencyLimit,
      includeInvalidQrProbe,
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      benchmark: results,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Load test execution failed',
    });
  }
});
