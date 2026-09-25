import { describe, it, expect } from 'vitest';
import {
  generateDynamicQrPayload,
  verifyDynamicQrToken,
  getEpochWindow,
} from '../crypto';
import { calculateAttendanceMetrics } from '../calculations';
import { AttendanceSession, AttendanceRecord } from '@campusattend/shared-types';

describe('Dynamic QR Code Verification Engine', () => {
  const sessionId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const classroomId = '11111111-2222-3333-4444-555555555555';
  const secretSeed = 'super_secret_faculty_seed_key_xyz123';

  it('generates a valid QR payload for current window', async () => {
    const now = Date.now();
    const payload = await generateDynamicQrPayload(sessionId, classroomId, secretSeed, 15, now);

    expect(payload.session_id).toBe(sessionId);
    expect(payload.classroom_id).toBe(classroomId);
    expect(payload.epoch_window).toBe(getEpochWindow(now, 15));
    expect(payload.token).toBeDefined();
    expect(payload.token.length).toBeGreaterThan(10);
  });

  it('verifies a genuine token in the current epoch window', async () => {
    const now = Date.now();
    const payload = await generateDynamicQrPayload(sessionId, classroomId, secretSeed, 15, now);

    const result = await verifyDynamicQrToken(
      {
        sessionId: payload.session_id,
        classroomId: payload.classroom_id,
        epochWindow: payload.epoch_window,
        token: payload.token,
      },
      secretSeed,
      15,
      now
    );

    expect(result.isValid).toBe(true);
  });

  it('rejects expired QR tokens exceeding allowed drift', async () => {
    const createdTime = 1700000000000;
    const payload = await generateDynamicQrPayload(sessionId, classroomId, secretSeed, 15, createdTime);

    // 4 windows later (60 seconds later)
    const scanTime = createdTime + 60 * 1000;

    const result = await verifyDynamicQrToken(
      {
        sessionId: payload.session_id,
        classroomId: payload.classroom_id,
        epochWindow: payload.epoch_window,
        token: payload.token,
      },
      secretSeed,
      15,
      scanTime,
      1 // only 1 window drift allowed
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects tampered or forged tokens', async () => {
    const now = Date.now();
    const payload = await generateDynamicQrPayload(sessionId, classroomId, secretSeed, 15, now);

    const result = await verifyDynamicQrToken(
      {
        sessionId: payload.session_id,
        classroomId: payload.classroom_id,
        epochWindow: payload.epoch_window,
        token: 'forged_fake_token_1234567890abcdef',
      },
      secretSeed,
      15,
      now
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Invalid cryptographic token signature');
  });
});

describe('College Attendance Calculation Engine', () => {
  const dummySession = (id: string, status: AttendanceSession['status']): AttendanceSession => ({
    id,
    subject_offering_id: 'sub-1',
    faculty_id: 'fac-1',
    classroom_id: 'room-1',
    section_id: 'sec-1',
    session_date: '2026-03-01',
    start_time: '09:00:00',
    end_time: '10:00:00',
    session_type: 'lecture',
    status,
    secret_seed: 'seed',
    is_attendance_locked: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const dummyRecord = (
    id: string,
    sessionId: string,
    status: AttendanceRecord['status']
  ): AttendanceRecord => ({
    id,
    session_id: sessionId,
    student_id: 'stud-1',
    status,
    verification_method: 'dynamic_qr',
    marked_at: new Date().toISOString(),
    is_finalized: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  it('correctly calculates percentage and excludes cancelled lectures', () => {
    // 5 sessions total: 4 completed, 1 cancelled
    const sessions = [
      dummySession('s1', 'completed'),
      dummySession('s2', 'completed'),
      dummySession('s3', 'completed'),
      dummySession('s4', 'completed'),
      dummySession('s5', 'cancelled'), // CANCELLED must NOT be counted!
    ];

    // Student attended 3 of the 4 completed sessions
    const records = [
      dummyRecord('r1', 's1', 'present'),
      dummyRecord('r2', 's2', 'present'),
      dummyRecord('r3', 's3', 'present'),
      dummyRecord('r4', 's4', 'absent'),
    ];

    const metrics = calculateAttendanceMetrics(sessions, records);

    expect(metrics.totalSessionsHeld).toBe(4); // Excludes cancelled s5
    expect(metrics.presentCount).toBe(3);
    expect(metrics.absentCount).toBe(1);
    expect(metrics.attendancePercentage).toBe(75.0);
    expect(metrics.thresholdStatus).toBe('warning'); // 75% is on warning border (>=75 critical threshold, <80 warning)
    expect(metrics.classesNeededFor75).toBe(0);
  });

  it('flags shortage < 75% as critical and computes required classes to recover', () => {
    // 10 completed sessions
    const sessions = Array.from({ length: 10 }, (_, i) =>
      dummySession(`s${i + 1}`, 'completed')
    );

    // Student attended only 6 (60%)
    const records = [
      ...Array.from({ length: 6 }, (_, i) => dummyRecord(`r${i}`, `s${i + 1}`, 'present')),
      ...Array.from({ length: 4 }, (_, i) => dummyRecord(`r${i + 6}`, `s${i + 7}`, 'absent')),
    ];

    const metrics = calculateAttendanceMetrics(sessions, records);

    expect(metrics.totalSessionsHeld).toBe(10);
    expect(metrics.attendancePercentage).toBe(60.0);
    expect(metrics.thresholdStatus).toBe('critical');

    // To reach 75%: (6 + x) / (10 + x) >= 0.75  =>  0.25x >= 1.5 => x >= 6 classes
    expect(metrics.classesNeededFor75).toBe(6);
  });

  it('computes classes that can be missed safely when attendance > 75%', () => {
    // 20 sessions held, student attended 18 (90%)
    const sessions = Array.from({ length: 20 }, (_, i) =>
      dummySession(`s${i + 1}`, 'completed')
    );
    const records = [
      ...Array.from({ length: 18 }, (_, i) => dummyRecord(`r${i}`, `s${i + 1}`, 'present')),
      ...Array.from({ length: 2 }, (_, i) => dummyRecord(`r${i + 18}`, `s${i + 19}`, 'absent')),
    ];

    const metrics = calculateAttendanceMetrics(sessions, records);

    expect(metrics.attendancePercentage).toBe(90.0);
    expect(metrics.thresholdStatus).toBe('good');
    // 18 / (20 + y) >= 0.75 => 18 / 0.75 - 20 = 24 - 20 = 4 classes
    expect(metrics.classesCanMissBefore75).toBe(4);
  });
});
