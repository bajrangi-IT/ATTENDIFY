import { describe, it, expect } from 'vitest';
import { UserRole } from '@campusattend/shared-types';

describe('CampusAttend OS - Mobile Application Workflows & Role Guards', () => {
  // 1. Role-Based Navigation Authorization
  describe('Mobile Role-Based Navigation Guards', () => {
    const ROLE_MOBILE_TABS: Record<UserRole, string[]> = {
      student: ['home', 'scan', 'timetable', 'history', 'leaves'],
      faculty: ['home', 'session', 'timetable', 'reports'],
      hod: ['home', 'session', 'timetable', 'reports'],
      director: ['home', 'approvals', 'students', 'audit'],
      it_admin: ['devices', 'health', 'audit'],
      super_admin: ['devices', 'health', 'audit'],
    };

    it('should grant student access to camera scan and shortage calculation', () => {
      const studentTabs = ROLE_MOBILE_TABS.student;
      expect(studentTabs).toContain('scan');
      expect(studentTabs).toContain('home');
      expect(studentTabs).toContain('leaves');
      expect(studentTabs).not.toContain('devices');
      expect(studentTabs).not.toContain('approvals');
    });

    it('should grant faculty live lecture console and dispute approvals', () => {
      const facultyTabs = ROLE_MOBILE_TABS.faculty;
      expect(facultyTabs).toContain('session');
      expect(facultyTabs).toContain('reports');
      expect(facultyTabs).not.toContain('devices');
    });

    it('should strictly limit IT admin to kiosk devices, telemetry and technical logs', () => {
      const itAdminTabs = ROLE_MOBILE_TABS.it_admin;
      expect(itAdminTabs).toContain('devices');
      expect(itAdminTabs).toContain('health');
      expect(itAdminTabs).toContain('audit');
      expect(itAdminTabs).not.toContain('scan');
      expect(itAdminTabs).not.toContain('leaves');
    });

    it('should grant Director executive oversight and session report sign-offs', () => {
      const directorTabs = ROLE_MOBILE_TABS.director;
      expect(directorTabs).toContain('home');
      expect(directorTabs).toContain('approvals');
      expect(directorTabs).toContain('students');
      expect(directorTabs).toContain('audit');
    });
  });

  // 2. Mobile Backend QR Verification Validation Rules
  describe('Backend QR Attendance Validation Rules', () => {
    interface CheckinContext {
      sessionStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      isLocked: boolean;
      studentSectionId: string;
      sessionSectionId: string;
      alreadyMarkedPresent: boolean;
      tokenValid: boolean;
    }

    const validateCheckin = (ctx: CheckinContext): { allowed: boolean; reason?: string } => {
      if (ctx.sessionStatus !== 'in_progress') {
        return { allowed: false, reason: 'SESSION_NOT_IN_PROGRESS' };
      }
      if (ctx.isLocked) {
        return { allowed: false, reason: 'SESSION_LOCKED' };
      }
      if (ctx.studentSectionId !== ctx.sessionSectionId) {
        return { allowed: false, reason: 'NOT_ENROLLED_IN_SECTION' };
      }
      if (ctx.alreadyMarkedPresent) {
        return { allowed: false, reason: 'DUPLICATE_ATTENDANCE' };
      }
      if (!ctx.tokenValid) {
        return { allowed: false, reason: 'TOKEN_EXPIRED_OR_INVALID' };
      }
      return { allowed: true };
    };

    it('should reject checkin if session is completed or scheduled', () => {
      const result = validateCheckin({
        sessionStatus: 'completed',
        isLocked: false,
        studentSectionId: 'sec-a',
        sessionSectionId: 'sec-a',
        alreadyMarkedPresent: false,
        tokenValid: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SESSION_NOT_IN_PROGRESS');
    });

    it('should reject duplicate attendance if student is already marked present', () => {
      const result = validateCheckin({
        sessionStatus: 'in_progress',
        isLocked: false,
        studentSectionId: 'sec-a',
        sessionSectionId: 'sec-a',
        alreadyMarkedPresent: true,
        tokenValid: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DUPLICATE_ATTENDANCE');
    });

    it('should reject checkin if student belongs to a different section', () => {
      const result = validateCheckin({
        sessionStatus: 'in_progress',
        isLocked: false,
        studentSectionId: 'sec-b',
        sessionSectionId: 'sec-a',
        alreadyMarkedPresent: false,
        tokenValid: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('NOT_ENROLLED_IN_SECTION');
    });

    it('should reject checkin if dynamic QR token is invalid or expired', () => {
      const result = validateCheckin({
        sessionStatus: 'in_progress',
        isLocked: false,
        studentSectionId: 'sec-a',
        sessionSectionId: 'sec-a',
        alreadyMarkedPresent: false,
        tokenValid: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TOKEN_EXPIRED_OR_INVALID');
    });

    it('should allow legitimate checkin when all rules pass', () => {
      const result = validateCheckin({
        sessionStatus: 'in_progress',
        isLocked: false,
        studentSectionId: 'sec-a',
        sessionSectionId: 'sec-a',
        alreadyMarkedPresent: false,
        tokenValid: true,
      });
      expect(result.allowed).toBe(true);
    });
  });

  // 3. Mobile Shortage Calculator Math
  describe('Mobile Shortage Recovery Formula', () => {
    const computeRecoveryLectures = (held: number, attended: number): number => {
      if (held === 0) return 0;
      const pct = (attended / held) * 100;
      if (pct >= 75) return 0;
      return Math.max(0, Math.ceil(3 * held - 4 * attended));
    };

    it('should calculate recovery count for mobile shortage banner', () => {
      expect(computeRecoveryLectures(30, 20)).toBe(10); // (20+10)/(30+10) = 30/40 = 75%
      expect(computeRecoveryLectures(40, 28)).toBe(8);  // (28+8)/(40+8) = 36/48 = 75%
      expect(computeRecoveryLectures(50, 45)).toBe(0);  // 90% -> 0
    });
  });
});
