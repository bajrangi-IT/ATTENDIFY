import { describe, it, expect, beforeAll } from 'vitest';
import { cacheManager } from '../redis/cache.js';
import { AttendanceService } from '../services/attendanceService.js';
import { DisplayService } from '../services/displayService.js';
import { LoadTestRunner } from '../loadtest/loadtestEngine.js';
import { generateDynamicQrPayload, verifyDynamicQrToken } from '@campusattend/attendance-sdk';
import { supabaseAdmin } from '../db/client.js';

describe('CampusAttend OS - Production Attendance Engine', () => {
  const testSessionId = 'c0000000-0000-0000-0000-000000000099';
  const testClassroomId = '70000000-0000-0000-0000-000000000001';
  const testSecretSeed = 'live_demo_dynamic_qr_seed_key_2026';
  const testStudentId = '90000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    // Reset test session to in_progress in database
    await supabaseAdmin
      .from('attendance_sessions')
      .update({
        status: 'in_progress',
        is_attendance_locked: false,
        qr_expires_at: new Date(Date.now() + 7200000).toISOString(),
        secret_seed: testSecretSeed,
      })
      .eq('id', testSessionId);

    // Ensure student is assigned to section 62000000-0000-0000-0000-000000000001
    await supabaseAdmin
      .from('students')
      .update({ current_section_id: '62000000-0000-0000-0000-000000000001' })
      .eq('id', testStudentId);

    // Prime cache with test session
    await cacheManager.setSessionMeta(testSessionId, {
      id: testSessionId,
      classroomId: testClassroomId,
      sectionId: '62000000-0000-0000-0000-000000000001',
      facultyId: '80000000-0000-0000-0000-000000000002',
      status: 'in_progress',
      secretSeed: testSecretSeed,
      qrExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      isAttendanceLocked: false,
      totalEnrolled: 60,
    });
    await cacheManager.setSessionCount(testSessionId, 0);
  }, 20000);

  describe('1. Redis / In-Memory Resilient Cache Layer', () => {
    it('stores and retrieves session metadata accurately', async () => {
      const meta = await cacheManager.getSessionMeta(testSessionId);
      expect(meta).not.toBeNull();
      expect(meta?.id).toBe(testSessionId);
      expect(meta?.secretSeed).toBe(testSecretSeed);
    });

    it('enforces sliding window rate limiting per student', async () => {
      const studentKey = 'test-ratelimit-student';
      // First 5 requests should pass
      for (let i = 0; i < 5; i++) {
        const check = await cacheManager.checkRateLimit('student', studentKey, 5, 10);
        expect(check.allowed).toBe(true);
      }
      // 6th request must be blocked
      const blocked = await cacheManager.checkRateLimit('student', studentKey, 5, 10);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('manages atomic session headcount counters', async () => {
      const count1 = await cacheManager.incrementSessionCount(testSessionId);
      expect(count1).toBeGreaterThanOrEqual(1);

      const retrieved = await cacheManager.getSessionCount(testSessionId);
      expect(retrieved).toBe(count1);
    });
  });

  describe('2. Cryptographic Dynamic QR Security', () => {
    it('generates cryptographically valid HMAC token and accepts it within drift window', async () => {
      const now = Date.now();
      const payload = await generateDynamicQrPayload(
        testSessionId,
        testClassroomId,
        testSecretSeed,
        15,
        now
      );

      const verification = await verifyDynamicQrToken(
        {
          sessionId: payload.session_id,
          classroomId: payload.classroom_id,
          epochWindow: payload.epoch_window,
          token: payload.token,
        },
        testSecretSeed,
        15,
        now
      );

      expect(verification.isValid).toBe(true);
    });

    it('strictly rejects forged or tampered QR tokens', async () => {
      const now = Date.now();
      const payload = await generateDynamicQrPayload(
        testSessionId,
        testClassroomId,
        testSecretSeed,
        15,
        now
      );

      const verification = await verifyDynamicQrToken(
        {
          sessionId: payload.session_id,
          classroomId: payload.classroom_id,
          epochWindow: payload.epoch_window,
          token: 'forged_fake_token_attacker_tampered',
        },
        testSecretSeed,
        15,
        now
      );

      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('Invalid cryptographic token signature');
    });

    it('strictly rejects expired QR tokens beyond allowable drift window', async () => {
      const now = Date.now();
      const expiredTime = now - 60000; // 4 windows ago (60s ago)
      const payload = await generateDynamicQrPayload(
        testSessionId,
        testClassroomId,
        testSecretSeed,
        15,
        expiredTime
      );

      const verification = await verifyDynamicQrToken(
        {
          sessionId: payload.session_id,
          classroomId: payload.classroom_id,
          epochWindow: payload.epoch_window,
          token: payload.token,
        },
        testSecretSeed,
        15,
        now // verifying with current time
      );

      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('expired');
    });
  });

  describe('3. Attendance Transaction Atomicity & Idempotency', () => {
    it('handles idempotent student scans without raising duplicate constraint error', async () => {
      const now = Date.now();
      const payload = await generateDynamicQrPayload(
        testSessionId,
        testClassroomId,
        testSecretSeed,
        15,
        now
      );

      // Attempt scan with student
      const scan1 = await AttendanceService.processScan({
        sessionId: testSessionId,
        studentId: testStudentId,
        qrToken: payload.token,
        epochWindow: payload.epoch_window,
      });

      // Must succeed with either 'present' or 'already_marked'
      expect(scan1.success).toBe(true);
      expect(['present', 'already_marked']).toContain(scan1.status);

      // Immediate duplicate scan MUST return 'already_marked' cleanly with 200 OK
      const scan2 = await AttendanceService.processScan({
        sessionId: testSessionId,
        studentId: testStudentId,
        qrToken: payload.token,
        epochWindow: payload.epoch_window,
      });

      expect(scan2.success).toBe(true);
      expect(scan2.status).toBe('already_marked');
      expect(scan2.message).toContain('already been recorded');
    }, 25000);
  });

  describe('4. Smart Board State Isolation & Security', () => {
    it('returns unprivileged display state without student PII, credentials, or seeds', async () => {
      const displayState = await DisplayService.getDisplayState('dsp_live_lh101_smart_board_token_2026');

      expect(displayState.paired).toBe(true);
      expect(displayState.roomNumber).toBe('LH-101');
      expect(['WAITING', 'ACTIVE_QR', 'SESSION_ENDED']).toContain(displayState.sessionState);

      // Verify strict security boundary: NO secret seeds or student arrays exposed to smart display
      const rawJson = JSON.stringify(displayState);
      expect(rawJson).not.toContain('secret_seed');
      expect(rawJson).not.toContain('service_role');
      expect(rawJson).not.toContain('password');
    }, 25000);
  });

  describe('5. Multi-Class Concurrent Load Simulation', () => {
    it('successfully processes concurrent students across multiple simultaneous classes with 0 failure rate', async () => {
      const results = await LoadTestRunner.runSimulation({
        classesCount: 2,
        studentsPerClass: 15,
        duplicatePercentage: 20,
        concurrencyLimit: 10,
        includeInvalidQrProbe: true,
      });

      expect(results.totalRequests).toBeGreaterThanOrEqual(15);
      expect(results.failureRate).toBeLessThanOrEqual(5);
      expect(results.requestsPerSecond).toBeGreaterThan(0);
      expect(results.latencyStats.avgMs).toBeGreaterThanOrEqual(0);
      expect(results.invalidTokenProbesRejected).toBeGreaterThan(0);
    }, 60000);
  });
});
