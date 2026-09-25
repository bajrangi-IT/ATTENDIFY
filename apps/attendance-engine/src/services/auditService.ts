import { supabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface AuditEventPayload {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  beforeValue?: any;
  afterValue?: any;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Logs an immutable security or operational event to PostgreSQL
   */
  async log(payload: AuditEventPayload): Promise<string | null> {
    try {
      const details = {
        reason: payload.reason || null,
        before: payload.beforeValue || null,
        after: payload.afterValue || null,
        ...(payload.metadata || {})
      };

      const { data, error } = await supabaseAdmin.rpc('rpc_log_audit_event', {
        p_actor_id: payload.actorId,
        p_action: payload.action,
        p_entity_type: payload.entityType,
        p_entity_id: payload.entityId,
        p_details: details,
        p_ip: payload.ipAddress || null
      });

      if (error) throw error;

      logger.info(`Audit logged: ${payload.action} on ${payload.entityType}:${payload.entityId}`, {
        actorId: payload.actorId,
        action: payload.action
      });

      return data;
    } catch (err: any) {
      logger.error('Failed to log audit event', err, { action: payload.action });
      return null;
    }
  }

  // Pre-configured helper methods for audited operations
  async logAttendanceCorrection(
    actorId: string,
    requestId: string,
    beforeStatus: string,
    afterStatus: string,
    reason: string,
    ip?: string
  ) {
    return this.log({
      actorId,
      action: 'ATTENDANCE_CORRECTION_RESOLVED',
      entityType: 'attendance_record',
      entityId: requestId,
      reason,
      beforeValue: { status: beforeStatus },
      afterValue: { status: afterStatus },
      ipAddress: ip
    });
  }

  async logStudentCreation(actorId: string, studentId: string, rollNumber: string, email: string, ip?: string) {
    return this.log({
      actorId,
      action: 'STUDENT_PROVISIONED',
      entityType: 'student',
      entityId: studentId,
      afterValue: { rollNumber, email },
      ipAddress: ip
    });
  }

  async logStudentStatusChange(actorId: string, studentId: string, beforeStatus: string, afterStatus: string, ip?: string) {
    return this.log({
      actorId,
      action: 'STUDENT_STATUS_TOGGLED',
      entityType: 'student',
      entityId: studentId,
      beforeValue: { status: beforeStatus },
      afterValue: { status: afterStatus },
      ipAddress: ip
    });
  }

  async logFacultyChange(actorId: string, facultyId: string, beforeDetails: any, afterDetails: any, ip?: string) {
    return this.log({
      actorId,
      action: 'FACULTY_RECORD_MODIFIED',
      entityType: 'faculty',
      entityId: facultyId,
      beforeValue: beforeDetails,
      afterValue: afterDetails,
      ipAddress: ip
    });
  }

  async logTimetableChange(
    actorId: string,
    entryId: string,
    beforeSchedule: any,
    afterSchedule: any,
    reason: string,
    ip?: string
  ) {
    return this.log({
      actorId,
      action: 'TIMETABLE_SLOT_MODIFIED',
      entityType: 'timetable_entry',
      entityId: entryId,
      reason,
      beforeValue: beforeSchedule,
      afterValue: afterSchedule,
      ipAddress: ip
    });
  }

  async logSessionLifecycle(
    actorId: string,
    sessionId: string,
    action: 'SESSION_CREATED' | 'SESSION_ENDED',
    details: any,
    ip?: string
  ) {
    return this.log({
      actorId,
      action,
      entityType: 'attendance_session',
      entityId: sessionId,
      afterValue: details,
      ipAddress: ip
    });
  }

  async logReportApproval(
    actorId: string,
    reportId: string,
    status: 'approved' | 'rejected',
    remarks: string,
    ip?: string
  ) {
    return this.log({
      actorId,
      action: status === 'approved' ? 'REPORT_APPROVED' : 'REPORT_REJECTED',
      entityType: 'attendance_session_report',
      entityId: reportId,
      reason: remarks,
      afterValue: { status },
      ipAddress: ip
    });
  }

  async logRoleChange(actorId: string, targetProfileId: string, oldRole: string, newRole: string, ip?: string) {
    return this.log({
      actorId,
      action: 'USER_ROLE_ELEVATED',
      entityType: 'profile',
      entityId: targetProfileId,
      beforeValue: { role: oldRole },
      afterValue: { role: newRole },
      ipAddress: ip
    });
  }

  async logDeviceEvent(
    actorId: string,
    classroomId: string,
    action: 'DEVICE_PAIRING' | 'DEVICE_REVOCATION' | 'CREDENTIALS_ROTATED',
    details: any,
    ip?: string
  ) {
    return this.log({
      actorId,
      action,
      entityType: 'classroom_display',
      entityId: classroomId,
      afterValue: details,
      ipAddress: ip
    });
  }
}

export const auditService = new AuditService();
