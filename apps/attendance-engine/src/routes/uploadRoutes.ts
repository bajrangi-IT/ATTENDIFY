import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { fileUploadService, StoredDocument } from '../services/fileUploadService.js';
import { logger } from '../utils/logger.js';

export const uploadRouter = Router();

// In-memory document registry for demo/engine persistence
const documentRegistry = new Map<string, StoredDocument>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * POST /api/upload/document
 * Authenticated upload for evidence documents (e.g. medical certificates, leave proofs)
 */
uploadRouter.post(
  '/document',
  authenticateJwt,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { entityType, entityId } = req.body;
      if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType and entityId are required' });
      }

      const doc = await fileUploadService.saveSecureDocument(
        req.file,
        user.id,
        entityType,
        entityId
      );

      documentRegistry.set(doc.id, doc);

      return res.status(201).json({
        success: true,
        message: 'Confidential document uploaded and encrypted successfully',
        document: {
          id: doc.id,
          originalFilename: doc.originalFilename,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          entityType: doc.entityType,
          entityId: doc.entityId,
          createdAt: doc.createdAt
        }
      });
    } catch (err: any) {
      logger.error('Document upload error', err);
      return res.status(400).json({
        error: err.message || 'File upload failed validation'
      });
    }
  }
);

/**
 * POST /api/upload/signed-url
 * Generates an ephemeral signed URL after verifying ownership & permissions
 */
uploadRouter.post('/signed-url', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { docId } = req.body;

    if (!docId) {
      return res.status(400).json({ error: 'docId is required' });
    }

    const doc = documentRegistry.get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { signedUrl, expiresAt } = await fileUploadService.generateSignedAccessUrl(
      doc,
      user.id,
      user.role
    );

    return res.status(200).json({
      signedUrl,
      expiresAt,
      mimeType: doc.mimeType
    });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Forbidden' });
  }
});

/**
 * GET /api/upload/secure-file/:storageKey
 * Serves secure file if valid cryptographic signature provided
 */
uploadRouter.get('/secure-file/:storageKey', async (req: Request, res: Response) => {
  try {
    const { storageKey } = req.params;
    const { token, expires, docId } = req.query as { token?: string; expires?: string; docId?: string };

    if (!token || !expires || !docId) {
      return res.status(401).json({ error: 'Missing security verification tokens' });
    }

    const doc = documentRegistry.get(docId);
    if (!doc || doc.storageKey !== storageKey) {
      return res.status(404).json({ error: 'File not found' });
    }

    const isValid = fileUploadService.verifyDownloadToken(docId, doc.ownerId, token, expires);
    if (!isValid) {
      return res.status(403).json({ error: 'Security token is invalid or expired' });
    }

    const filePath = fileUploadService.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File missing from storage' });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (err: any) {
    logger.error('Secure file download failure', err);
    return res.status(500).json({ error: 'Secure retrieval failed' });
  }
});
