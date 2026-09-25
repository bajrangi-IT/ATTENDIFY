import { AttendanceRecord, AttendanceSession, AttendancePolicy } from '@campusattend/shared-types';

export interface CalculationOptions {
  lateWeight?: number; // e.g. 1.0 (full attendance) or 0.8 (penalty)
  excusedCountsAsPresent?: boolean; // whether approved medical/duty leave counts towards attendance
  minAttendancePercentage?: number; // default: 75
  warningThreshold?: number; // default: 80
}

export interface CalculatedAttendanceMetrics {
  totalSessionsHeld: number; // Finalized non-cancelled sessions
  attendedSessions: number; // Present + (late * weight)
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  attendancePercentage: number; // Rounded to 2 decimal places
  thresholdStatus: 'good' | 'warning' | 'critical';
  classesNeededFor75: number;
  classesCanMissBefore75: number;
}

const DEFAULT_POLICY: CalculationOptions = {
  lateWeight: 1.0,
  excusedCountsAsPresent: true,
  minAttendancePercentage: 75.0,
  warningThreshold: 80.0,
};

/**
 * Enterprise Attendance Calculation Engine
 * 
 * Rules:
 * 1. Cancelled sessions are strictly excluded from total conducted sessions.
 * 2. Only sessions with status 'completed' or 'audit_locked' (or finalized) are considered held.
 * 3. Attendance percentage is computed dynamically from canonical attendance records and eligible sessions.
 * 4. We never store an editable static percentage in the database.
 */
export function calculateAttendanceMetrics(
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  policy: Partial<CalculationOptions> = {}
): CalculatedAttendanceMetrics {
  const mergedPolicy = { ...DEFAULT_POLICY, ...policy };

  // Filter valid held sessions: exclude cancelled or scheduled-in-future sessions
  const heldSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'audit_locked'
  );
  const heldSessionIds = new Set(heldSessions.map((s) => s.id));

  // Filter records belonging to valid held sessions
  const validRecords = records.filter(
    (r) => heldSessionIds.has(r.session_id) && r.is_finalized
  );

  let presentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let absentCount = 0;

  for (const record of validRecords) {
    switch (record.status) {
      case 'present':
        presentCount++;
        break;
      case 'late':
        lateCount++;
        break;
      case 'excused':
        excusedCount++;
        break;
      case 'absent':
      default:
        absentCount++;
        break;
    }
  }

  // Account for any held sessions where the student has no explicit record (implicitly absent)
  const recordedSessionIds = new Set(validRecords.map((r) => r.session_id));
  const unrecordedHeldCount = heldSessions.filter(
    (s) => !recordedSessionIds.has(s.id)
  ).length;
  absentCount += unrecordedHeldCount;

  const totalHeld = heldSessions.length;

  if (totalHeld === 0) {
    return {
      totalSessionsHeld: 0,
      attendedSessions: 0,
      presentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      absentCount: 0,
      attendancePercentage: 100.0, // Initial state before any classes held
      thresholdStatus: 'good',
      classesNeededFor75: 0,
      classesCanMissBefore75: 0,
    };
  }

  // Effective attended sessions
  let effectiveAttended = presentCount + lateCount * (mergedPolicy.lateWeight ?? 1.0);
  if (mergedPolicy.excusedCountsAsPresent) {
    effectiveAttended += excusedCount;
  }

  const rawPercentage = (effectiveAttended / totalHeld) * 100;
  const attendancePercentage = Math.round(rawPercentage * 100) / 100;

  // Determine threshold status
  let thresholdStatus: 'good' | 'warning' | 'critical' = 'good';
  if (attendancePercentage < (mergedPolicy.minAttendancePercentage ?? 75)) {
    thresholdStatus = 'critical';
  } else if (attendancePercentage < (mergedPolicy.warningThreshold ?? 80)) {
    thresholdStatus = 'warning';
  }

  // Calculate classes needed to achieve 75%
  // Formula: (A + x) / (T + x) >= 0.75  =>  x >= (0.75 * T - A) / (1 - 0.75)
  let classesNeededFor75 = 0;
  if (attendancePercentage < 75.0) {
    const required = (0.75 * totalHeld - effectiveAttended) / (1 - 0.75);
    classesNeededFor75 = Math.max(0, Math.ceil(required));
  }

  // Calculate classes that can be missed while staying above 75%
  // Formula: A / (T + y) >= 0.75  =>  y <= (A / 0.75) - T
  let classesCanMissBefore75 = 0;
  if (attendancePercentage >= 75.0) {
    const maxMissable = effectiveAttended / 0.75 - totalHeld;
    classesCanMissBefore75 = Math.max(0, Math.floor(maxMissable));
  }

  return {
    totalSessionsHeld: totalHeld,
    attendedSessions: effectiveAttended,
    presentCount,
    lateCount,
    excusedCount,
    absentCount,
    attendancePercentage,
    thresholdStatus,
    classesNeededFor75,
    classesCanMissBefore75,
  };
}
