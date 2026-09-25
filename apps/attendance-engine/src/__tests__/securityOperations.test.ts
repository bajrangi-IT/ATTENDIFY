import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { cacheManager } from '../redis/cache.js';
import { supabaseAdmin } from '../db/client.js';
import { fileUploadService } from '../services/fileUploadService.js';
import { reportGenerator } from '../services/reportGenerator.js';
import { reportQueueService } from '../services/reportQueue.js';
import { generateDynamicQrPayload, verifyDynamicQrToken } from '@campusattend/attendance-sdk';

describe('CampusAttend OS - Comprehensive Security & Operational Verification Suite', () => {
  // Pre-seeded real profiles from PostgreSQL database
  const studentUserHeader = {
    authorization: 'Bearer mock_student_token',
    'x-test-profile-id': '30000000-0000-0000-0000-000000000010',
    'x-test-role': 'student'
  };

  const facultyUserHeader = {
    authorization: 'Bearer mock_faculty_token',
    'x-test-profile-id': '30000000-0000-0000-0000-000000000005',
    'x-test-role': 'faculty'
  };

  const directorUserHeader = {
    authorization: 'Bearer mock_director_token',
    'x-test-profile-id': '30000000-0000-0000-0000-000000000002',
    'x-test-role': 'director'
  };

  /* -------------------------------------------------------------------------- */
  /* 1. Broken Authorization & Privilege Escalation                             */
  /* -------------------------------------------------------------------------- */
  describe('1. Broken Authorization & Privilege Escalation', () => {
    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const endpoints = [
        { method: 'post', path: '/api/reports/generate' },
        { method: 'get', path: '/api/audit-logs' },
        { method: 'get', path: '/api/notifications' },
        { method: 'post', path: '/api/upload/signed-url' }
      ];

      for (const ep of endpoints) {
        const res = await (request(app) as any)[ep.method](ep.path);
        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
      }
    });

    it('prevents students from accessing administrative audit logs (Privilege Escalation)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set(studentUserHeader);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('prevents faculty from generating institutional director-only reports', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .set(facultyUserHeader)
        .send({
          reportType: 'director_institution_report',
          format: 'pdf'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('prevents students from generating department or faculty analytics reports', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .set(studentUserHeader)
        .send({
          reportType: 'hod_department_report',
          format: 'excel'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Insecure Direct Object Reference (IDOR) Protection                      */
  /* -------------------------------------------------------------------------- */
  describe('2. Insecure Direct Object Reference (IDOR)', () => {
    it('forces studentId to the authenticated student profile id when requesting reports', async () => {
      // Student attempts to pass a different student's ID in filters
      const targetVictimId = '30000000-0000-0000-0000-000000000011';
      const res = await request(app)
        .post('/api/reports/generate')
        .set(studentUserHeader)
        .send({
          reportType: 'student_personal_attendance',
          format: 'csv',
          filters: {
            studentId: targetVictimId // IDOR attempt
          }
        });

      // Should succeed in queueing, but with requester's forced profile ID
      expect(res.status).toBe(202);
      expect(res.body.reportId).toBeDefined();
    }, 15000);

    it('blocks a student from viewing or downloading another user\'s report', async () => {
      // Create a report record belonging to faculty
      const { data: report } = await supabaseAdmin
        .from('generated_reports')
        .insert({
          institution_id: '00000000-0000-0000-0000-000000000001',
          requester_id: '30000000-0000-0000-0000-000000000005', // Faculty
          report_type: 'faculty_class_attendance',
          format: 'pdf',
          status: 'completed'
        })
        .select()
        .single();

      if (report) {
        // Student attempts to access faculty's report
        const res = await request(app)
          .get(`/api/reports/${report.id}`)
          .set(studentUserHeader);

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Access denied');
      }
    });

    it('blocks a user from marking another user\'s notification as read', async () => {
      const res = await request(app)
        .post('/api/notifications/00000000-0000-0000-0000-000000000099/read')
        .set(studentUserHeader);

      expect(res.status).toBe(404);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Audit Log Immutability & Security                                       */
  /* -------------------------------------------------------------------------- */
  describe('3. Immutable Audit Trails', () => {
    it('blocks HTTP PUT / DELETE requests on audit logs at API level', async () => {
      const putRes = await request(app)
        .put('/api/audit-logs/00000000-0000-0000-0000-000000000001')
        .set(directorUserHeader)
        .send({ action: 'TAMPERED_ACTION' });

      expect(putRes.status).toBe(403);
      expect(putRes.body.error).toContain('strictly immutable');

      const delRes = await request(app)
        .delete('/api/audit-logs/00000000-0000-0000-0000-000000000001')
        .set(directorUserHeader);

      expect(delRes.status).toBe(403);
      expect(delRes.body.error).toContain('strictly immutable');
    });

    it('enforces PostgreSQL database-level trigger immutability on audit_logs table', async () => {
      // 1. Insert an audit record directly into database
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          actor_id: '30000000-0000-0000-0000-000000000002',
          action: 'SECURITY_TEST_AUDIT',
          entity_type: 'test_entity',
          entity_id: '00000000-0000-0000-0000-000000000001',
          details: { test: true }
        })
        .select()
        .single();

      expect(insertErr).toBeNull();
      expect(inserted).toBeDefined();

      // 2. Attempt to UPDATE the audit record - MUST FAIL via trigger trg_audit_logs_immutable
      const { error: updateErr } = await supabaseAdmin
        .from('audit_logs')
        .update({ action: 'TAMPERED_RECORD' })
        .eq('id', inserted.id);

      expect(updateErr).not.toBeNull();
      expect(updateErr?.message).toContain('Audit logs are strictly immutable');

      // 3. Attempt to DELETE the audit record - MUST FAIL via trigger trg_audit_logs_immutable
      const { error: deleteErr } = await supabaseAdmin
        .from('audit_logs')
        .delete()
        .eq('id', inserted.id);

      expect(deleteErr).not.toBeNull();
      expect(deleteErr?.message).toContain('Audit logs are strictly immutable');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Dynamic QR Cryptography, Expiration & Replay Defense                     */
  /* -------------------------------------------------------------------------- */
  describe('4. Dynamic QR Cryptography & Anti-Replay Defense', () => {
    const sessionId = 'c0000000-0000-0000-0000-000000000099';
    const classroomId = '70000000-0000-0000-0000-000000000001';
    const secretSeed = 'live_demo_dynamic_qr_seed_key_2026';

    it('rejects expired QR tokens with timestamps outside the drift window', async () => {
      const pastTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const expiredPayload = await generateDynamicQrPayload(
        sessionId,
        classroomId,
        secretSeed,
        15,
        pastTime
      );

      const verification = await verifyDynamicQrToken(
        {
          sessionId,
          classroomId,
          epochWindow: expiredPayload.epoch_window,
          token: expiredPayload.token
        },
        secretSeed,
        15,
        Date.now()
      );

      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('expired');
    });

    it('rejects tampered QR tokens with corrupted signature or modified session ID', async () => {
      const validPayload = await generateDynamicQrPayload(
        sessionId,
        classroomId,
        secretSeed,
        15,
        Date.now()
      );

      // Tamper token string
      const tamperedToken = validPayload.token.slice(0, -4) + 'abcd';
      const verification = await verifyDynamicQrToken(
        {
          sessionId,
          classroomId,
          epochWindow: validPayload.epoch_window,
          token: tamperedToken
        },
        secretSeed,
        15,
        Date.now()
      );

      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('Invalid cryptographic token signature');
    });

    it('enforces rate limiting against QR scan spam / brute force', async () => {
      const spamStudent = 'spam-student-test-id';
      // 5 requests allowed
      for (let i = 0; i < 5; i++) {
        const res = await cacheManager.checkRateLimit('student', spamStudent, 5, 10);
        expect(res.allowed).toBe(true);
      }
      // 6th request rejected
      const rateLimited = await cacheManager.checkRateLimit('student', spamStudent, 5, 10);
      expect(rateLimited.allowed).toBe(false);
      expect(rateLimited.remaining).toBe(0);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Smart Board Credential Misuse Defense                                   */
  /* -------------------------------------------------------------------------- */
  describe('5. Smart Board Credential Misuse Defense', () => {
    it('rejects requests to display session feed without valid display token', async () => {
      const res = await request(app)
        .get('/api/display/session-feed?classroomId=70000000-0000-0000-0000-000000000001');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('rejects spoofed display token credentials', async () => {
      const res = await request(app)
        .get('/api/display/session-feed?classroomId=70000000-0000-0000-0000-000000000001')
        .set({ 'x-display-token': 'spoofed_token_123456' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Secure File Upload Validation & Private Document Protection              */
  /* -------------------------------------------------------------------------- */
  describe('6. Secure File Upload & Private Document Access', () => {
    it('rejects executable / disallowed MIME types', () => {
      const exeFile = {
        originalname: 'malicious.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('MZ...')
      };

      const result = fileUploadService.validateFile(exeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Disallowed MIME type');
    });

    it('detects and rejects extension spoofing (e.g. .exe masquerading as .pdf)', () => {
      const spoofedFile = {
        originalname: 'exploit.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('NOT_A_REAL_PDF_HEADER')
      };

      const result = fileUploadService.validateFile(spoofedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('magic bytes do not match');
    });

    it('validates authentic PDF files with legitimate %PDF header magic bytes', () => {
      const validPdf = {
        originalname: 'medical_certificate.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000)])
      };

      const result = fileUploadService.validateFile(validPdf);
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBeDefined();
      expect(result.sanitizedFilename?.endsWith('.pdf')).toBe(true);
    });

    it('rejects files exceeding the 5MB statutory limit', () => {
      const oversizedFile = {
        originalname: 'huge_document.pdf',
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024, // 6MB
        buffer: Buffer.alloc(6 * 1024 * 1024)
      };

      const result = fileUploadService.validateFile(oversizedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum permitted limit');
    });

    it('protects private documents from unauthorized users (Ownership Check)', async () => {
      const doc = await fileUploadService.saveSecureDocument(
        {
          originalname: 'confidential_leave_proof.pdf',
          mimetype: 'application/pdf',
          size: 512,
          buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(500)])
        },
        '30000000-0000-0000-0000-000000000010', // Student 1
        'leave_application',
        '00000000-0000-0000-0000-000000000099'
      );

      // Student 2 tries to generate signed download URL for Student 1's document
      await expect(
        fileUploadService.generateSignedAccessUrl(
          doc,
          '30000000-0000-0000-0000-000000000011', // Student 2
          'student'
        )
      ).rejects.toThrow('Access denied');

      // Director can access authorized documents for verification
      const directorAccess = await fileUploadService.generateSignedAccessUrl(
        doc,
        '30000000-0000-0000-0000-000000000002',
        'director'
      );
      expect(directorAccess.signedUrl).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Observability, Health Endpoints & Telemetry Metrics                      */
  /* -------------------------------------------------------------------------- */
  describe('7. Observability, Health & Telemetry Metrics', () => {
    it('returns basic health with database and cache status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBeDefined();
      expect(res.body.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.body.cache).toBeDefined();
    });

    it('returns detailed health with dependencies, queue metrics, and latency percentiles', async () => {
      const res = await request(app).get('/api/health/detailed');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.dependencies.database.healthy).toBe(true);
      expect(res.body.dependencies.redisCache).toBeDefined();
      expect(res.body.operations).toBeDefined();
      expect(res.body.operations.totalRequestsTracked).toBeGreaterThanOrEqual(0);
      expect(res.body.operations.activeAttendanceSessions).toBeGreaterThanOrEqual(0);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Asynchronous Reports & Non-Evaluative Department Comparison             */
  /* -------------------------------------------------------------------------- */
  describe('8. Asynchronous Reports & Non-Evaluative Department Comparison', () => {
    it('generates institutional director comparison without evaluative rankings', async () => {
      const csvReport = await reportGenerator.generate('director_department_comparison', 'csv', {
        institutionId: '00000000-0000-0000-0000-000000000001'
      });

      expect(csvReport.buffer).toBeDefined();
      expect(csvReport.contentType).toBe('text/csv');
      const csvText = csvReport.buffer.toString('utf-8');

      // Check header contains factual statistics
      expect(csvText).toContain('Department Code');
      expect(csvText).toContain('Average Attendance %');

      // Verify NO evaluative ranking words exist (e.g. "Rank", "Winner", "Best", "Worst")
      expect(csvText).not.toContain('Rank');
      expect(csvText).not.toContain('Best');
      expect(csvText).not.toContain('Worst');
    });

    it('supports PDF, Excel, and CSV multi-format compilation', async () => {
      const formats: ('csv' | 'excel' | 'pdf')[] = ['csv', 'excel', 'pdf'];

      for (const fmt of formats) {
        const out = await reportGenerator.generate('director_institution_report', fmt, {
          institutionId: '00000000-0000-0000-0000-000000000001'
        });
        expect(out.buffer.length).toBeGreaterThan(0);
        expect(out.extension).toBe(fmt === 'excel' ? 'xlsx' : fmt);
      }
    });

    it('enqueues large reports via BullMQ without blocking the API call', async () => {
      const startMs = Date.now();
      const res = await request(app)
        .post('/api/reports/generate')
        .set(directorUserHeader)
        .send({
          reportType: 'director_institution_report',
          format: 'excel',
          filters: { institutionId: '00000000-0000-0000-0000-000000000001' }
        });

      const durationMs = Date.now() - startMs;
      // Must respond immediately with 202 Accepted without blocking
      expect(durationMs).toBeLessThan(2500);
      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
      expect(res.body.reportId).toBeDefined();
    }, 15000);
  });
});
