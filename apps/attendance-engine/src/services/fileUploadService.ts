import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { supabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface StoredDocument {
  id: string;
  ownerId: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string;
  entityId: string;
  createdAt: string;
}

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

const MAGIC_BYTES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47]
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class FileUploadService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'secure_storage');
    if (!fs.existsSync(this.uploadDir)) {
      try {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }
  }

  /**
   * Validates MIME type, extension, size, and magic bytes
   */
  validateFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): FileValidationResult {
    // 1. Size Check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds maximum permitted limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
      };
    }

    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    // 2. MIME Type Whitelist
    const mime = file.mimetype.toLowerCase();
    const validExtensions = ALLOWED_MIME_TYPES[mime];
    if (!validExtensions) {
      return {
        valid: false,
        error: `Disallowed MIME type: ${mime}. Allowed types: PDF, JPEG, PNG, WEBP`
      };
    }

    // 3. Extension Whitelist & Consistency
    const ext = path.extname(file.originalname).toLowerCase();
    if (!validExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension "${ext}" does not match declared MIME type "${mime}"`
      };
    }

    // 4. Magic Bytes Inspection (Anti-spoofing)
    const expectedMagic = MAGIC_BYTES[mime];
    if (expectedMagic) {
      for (let i = 0; i < expectedMagic.length; i++) {
        if (file.buffer[i] !== expectedMagic[i]) {
          return {
            valid: false,
            error: `File header magic bytes do not match declared ${mime} specification`
          };
        }
      }
    }

    // 5. Sanitized random storage filename
    const safeHash = crypto.randomBytes(16).toString('hex');
    const sanitizedFilename = `${safeHash}${ext}`;

    return {
      valid: true,
      sanitizedFilename,
      mimeType: mime,
      sizeBytes: file.size
    };
  }

  /**
   * Saves validated private document and stores metadata
   */
  async saveSecureDocument(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    ownerId: string,
    entityType: string,
    entityId: string
  ): Promise<StoredDocument> {
    const validation = this.validateFile(file);
    if (!validation.valid || !validation.sanitizedFilename) {
      throw new Error(validation.error || 'File validation failed');
    }

    const storageKey = validation.sanitizedFilename;
    const diskPath = path.join(this.uploadDir, storageKey);
    fs.writeFileSync(diskPath, file.buffer);

    const docId = crypto.randomUUID();
    const docRecord: StoredDocument = {
      id: docId,
      ownerId,
      originalFilename: path.basename(file.originalname),
      storageKey,
      mimeType: validation.mimeType!,
      sizeBytes: validation.sizeBytes!,
      entityType,
      entityId,
      createdAt: new Date().toISOString()
    };

    logger.info(`Secure document saved: ${docId}`, {
      ownerId,
      entityType,
      entityId,
      sizeBytes: docRecord.sizeBytes
    });

    return docRecord;
  }

  /**
   * Authorizes file access and generates time-limited signed URL
   */
  async generateSignedAccessUrl(
    doc: StoredDocument,
    requesterId: string,
    requesterRole: string
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    // Ownership & Access Permissions Check
    const isOwner = doc.ownerId === requesterId;
    const isPrivileged = ['director', 'hod', 'it_admin', 'super_admin'].includes(requesterRole);

    if (!isOwner && !isPrivileged) {
      logger.security(`Unauthorized document access attempt by ${requesterId} for document ${doc.id}`);
      throw new Error('Access denied: You do not have permission to view this confidential document');
    }

    // Generate signed token with 15-minute expiration
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    const tokenPayload = `${doc.id}:${requesterId}:${expiresAtMs}`;
    const signature = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'campusattend_default_secret_key_2026')
      .update(tokenPayload)
      .digest('hex');

    const signedUrl = `/api/upload/secure-file/${doc.storageKey}?token=${signature}&expires=${expiresAtMs}&docId=${doc.id}`;

    return {
      signedUrl,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  }

  /**
   * Verifies signed download token
   */
  verifyDownloadToken(docId: string, requesterId: string, token: string, expires: string): boolean {
    const expiresMs = parseInt(expires, 10);
    if (Date.now() > expiresMs) {
      return false; // Expired
    }

    const tokenPayload = `${docId}:${requesterId}:${expires}`;
    const expected = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'campusattend_default_secret_key_2026')
      .update(tokenPayload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  }

  getFilePath(storageKey: string): string {
    const resolved = path.join(this.uploadDir, storageKey);
    // Path traversal defense
    if (!resolved.startsWith(this.uploadDir)) {
      throw new Error('Directory traversal detected');
    }
    return resolved;
  }
}

export const fileUploadService = new FileUploadService();
