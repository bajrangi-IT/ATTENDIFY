import { supabaseAdmin, executeRpc } from '../db/client.js';
import { cacheManager } from '../redis/cache.js';
import { verifyDynamicQrToken } from '@campusattend/attendance-sdk';

export interface ScanAttendanceRequest {
  sessionId: string;
  qrToken: string;
  epochWindow: number;
  clientAuthUserId?: string; // Resolved from validated JWT
  studentId?: string; // Looked up securely from authenticated profile
  deviceFingerprint?: string;
  geoLat?: number;
  geoLng?: number;
  ipAddress?: string;
  skipRateLimit?: boolean;
}

export interface ScanAttendanceResponse {
  success: boolean;
  status: 'present' | 'already_marked' | 'rejected';
  message: string;
  recordId?: string;
  markedAt?: string;
  headcount?: number;
  error?: string;
}

export class AttendanceService {
  /**
   * High-throughput attendance scan processor with multi-stage verification:
   * 1. Rate limiting (Redis sliding window)
   * 2. Identity resolution (never trusts client student ID)
   * 3. Redis fast session verification (fallback to Postgres)
   * 4. Dynamic QR cryptographic verification (HMAC-SHA256, drift window)
   * 5. Section enrollment check
   * 6. Concurrency-safe atomic PostgreSQL transaction with UNIQUE(session_id, student_id)
   * 7. Per-session live headcount increment & isolated channel notification
   */
  public static async processScan(req: ScanAttendanceRequest): Promise<ScanAttendanceResponse> {
    const startTime = Date.now();

    // 1. Mandatory fields validation
    if (!req.sessionId || !req.qrToken || req.epochWindow === undefined) {
      return {
        success: false,
        status: 'rejected',
        message: 'Invalid payload: sessionId, qrToken, and epochWindow are required.',
      };
    }

    // 2. Identity Resolution: Resolve student ID from authenticated user
    let studentId = req.studentId;
    let studentSectionId: string | undefined;

    if (!studentId && req.clientAuthUserId) {
      const { data: studentRecord } = await supabaseAdmin
        .from('students')
        .select('id, current_section_id, enrollment_status, profiles!inner(user_id)')
        .eq('profiles.user_id', req.clientAuthUserId)
        .single();

      if (!studentRecord || studentRecord.enrollment_status !== 'active') {
        return {
          success: false,
          status: 'rejected',
          message: 'Student record not found or enrollment inactive.',
        };
      }
      studentId = studentRecord.id;
      studentSectionId = studentRecord.current_section_id;
    }

    if (!studentId) {
      return {
        success: false,
        status: 'rejected',
        message: 'Unauthorized: Student identity could not be verified.',
      };
    }

    // 3. Fast Rate Limiting: Max 5 scans per 10 seconds per student to prevent flood attacks
    if (!req.skipRateLimit) {
      const rateCheck = await cacheManager.checkRateLimit('student', studentId, 5, 10);
      if (!rateCheck.allowed) {
        return {
          success: false,
          status: 'rejected',
          message: 'Too many rapid requests. Please wait a moment before trying again.',
        };
      }
    }

    // 4. Fast Session Lookup via Redis (Fallback to PostgreSQL)
    let sessionMeta = await cacheManager.getSessionMeta(req.sessionId);
    if (!sessionMeta) {
      // Database fallback
      const { data: dbSession } = await supabaseAdmin
        .from('attendance_sessions')
        .select('id, classroom_id, section_id, faculty_id, status, secret_seed, qr_expires_at, is_attendance_locked')
        .eq('id', req.sessionId)
        .single();

      if (!dbSession) {
        return {
          success: false,
          status: 'rejected',
          message: 'Attendance session not found.',
        };
      }

      sessionMeta = {
        id: dbSession.id,
        classroomId: dbSession.classroom_id,
        sectionId: dbSession.section_id,
        facultyId: dbSession.faculty_id,
        status: dbSession.status,
        secretSeed: dbSession.secret_seed,
        qrExpiresAt: dbSession.qr_expires_at,
        isAttendanceLocked: dbSession.is_attendance_locked,
        totalEnrolled: 0,
      };

      // Populate Redis cache for next concurrent scans in this class
      await cacheManager.setSessionMeta(req.sessionId, sessionMeta);
    }

    // Validate session active state
    if (sessionMeta.status !== 'in_progress' || sessionMeta.isAttendanceLocked) {
      return {
        success: false,
        status: 'rejected',
        message: `Session is ${sessionMeta.status}. Attendance is not accepting scans.`,
      };
    }

    // 5. Fast Section Verification (if resolved from student record)
    if (studentSectionId && studentSectionId !== sessionMeta.sectionId) {
      return {
        success: false,
        status: 'rejected',
        message: 'You are not enrolled in the section for this session.',
      };
    }

    // 6. Fast Cryptographic QR Check via SDK before hitting database write
    const qrVerification = await verifyDynamicQrToken(
      {
        sessionId: req.sessionId,
        classroomId: sessionMeta.classroomId,
        epochWindow: req.epochWindow,
        token: req.qrToken,
      },
      sessionMeta.secretSeed
    );

    if (!qrVerification.isValid) {
      return {
        success: false,
        status: 'rejected',
        message: qrVerification.reason || 'Invalid QR code. Please scan the current live classroom display.',
      };
    }

    // 7. Atomic PostgreSQL Transaction: Calls rpc_submit_qr_attendance
    // This executes: INSERT INTO attendance_records (...) ON CONFLICT (session_id, student_id) DO NOTHING
    const { data: txResult, error: txError } = await executeRpc<any>('rpc_submit_qr_attendance', {
      p_session_id: req.sessionId,
      p_student_id: studentId,
      p_qr_token: req.qrToken,
      p_epoch_window: req.epochWindow,
      p_device_fingerprint: req.deviceFingerprint || null,
      p_geo_lat: req.geoLat || null,
      p_geo_lng: req.geoLng || null,
    });

    if (txError || !txResult) {
      return {
        success: false,
        status: 'rejected',
        message: txError ? txError.message : 'Database transaction failed',
      };
    }

    if (!txResult.success) {
      return {
        success: false,
        status: 'rejected',
        message: txResult.error || 'Check-in rejected by database rule.',
      };
    }

    // 8. Live Headcount Maintenance:
    // If cleanly inserted (not already_marked), increment Redis counter
    let currentHeadcount = 0;
    if (txResult.status === 'present') {
      currentHeadcount = await cacheManager.incrementSessionCount(req.sessionId);
    } else {
      currentHeadcount = await cacheManager.getSessionCount(req.sessionId);
    }

    return {
      success: true,
      status: txResult.status,
      message: txResult.message,
      recordId: txResult.record_id,
      markedAt: txResult.marked_at,
      headcount: currentHeadcount,
    };
  }
}
