/**
 * CampusAttend OS - Core Shared Domain Types
 * Single source of truth for database entities, API payloads, and role definitions.
 */

// ============================================================================
// Roles & Enums
// ============================================================================

export type UserRole =
  | 'student'
  | 'faculty'
  | 'hod'
  | 'director'
  | 'it_admin'
  | 'super_admin';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'excused'
  | 'pending_review';

export type VerificationMethod =
  | 'dynamic_qr'
  | 'manual_faculty'
  | 'beacon'
  | 'kiosk_face'
  | 'leave_override';

export type SessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'audit_locked';

export type SessionType =
  | 'lecture'
  | 'lab'
  | 'tutorial'
  | 'seminar'
  | 'extra_class';

export type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type LeaveType =
  | 'medical'
  | 'academic_duty'
  | 'personal'
  | 'sports'
  | 'bereavement';

export type AdjustmentRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export type DeviceStatus =
  | 'online'
  | 'offline'
  | 'unpaired'
  | 'maintenance';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday, 7 = Sunday

export type DegreeLevel = 'undergraduate' | 'postgraduate' | 'doctorate' | 'diploma';

// ============================================================================
// Core Database Entities
// ============================================================================

export interface Institution {
  id: string;
  name: string;
  code: string;
  logo_url?: string | null;
  address?: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campus {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  hod_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string; // auth.users.id
  institution_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url?: string | null;
  phone_number?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  institution_id: string;
  name: string; // e.g. "2025-2026"
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface AcademicTerm {
  id: string;
  academic_year_id: string;
  name: string; // "Fall 2025" or "Odd Semester"
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Program {
  id: string;
  department_id: string;
  name: string; // "B.Tech Computer Science & Engineering"
  code: string; // "BTECH-CSE"
  degree_level: DegreeLevel;
  duration_semesters: number;
  created_at: string;
}

export interface Semester {
  id: string;
  program_id: string;
  academic_year_id: string;
  semester_number: number; // 1 to 8
  is_active: boolean;
}

export interface Section {
  id: string;
  semester_id: string;
  name: string; // "Section A"
  capacity: number;
  created_at: string;
}

export interface Student {
  id: string;
  profile_id: string;
  institution_id: string;
  roll_number: string;
  registration_number: string;
  current_section_id: string;
  batch_year: number;
  enrollment_status: 'active' | 'graduated' | 'suspended' | 'transferred';
  created_at: string;
  updated_at: string;
  profile?: Profile;
  current_section?: Section;
}

export interface EnrollmentHistory {
  id: string;
  student_id: string;
  from_section_id?: string | null;
  to_section_id: string;
  effective_date: string;
  reason?: string | null;
  approved_by?: string | null;
  created_at: string;
}

export interface Faculty {
  id: string;
  profile_id: string;
  institution_id: string;
  department_id: string;
  employee_code: string;
  designation: string; // "Associate Professor", "Assistant Professor", "HOD", etc.
  created_at: string;
  updated_at: string;
  profile?: Profile;
  department?: Department;
}

export interface Subject {
  id: string;
  department_id: string;
  name: string; // "Data Structures & Algorithms"
  code: string; // "CS301"
  credits: number;
  subject_type: 'theory' | 'lab' | 'elective';
  created_at: string;
}

export interface SubjectOffering {
  id: string;
  subject_id: string;
  semester_id: string;
  academic_year_id: string;
  is_active: boolean;
  subject?: Subject;
}

export interface FacultyAssignment {
  id: string;
  faculty_id: string;
  subject_offering_id: string;
  section_id: string;
  is_primary: boolean;
  created_at: string;
  faculty?: Faculty;
  subject_offering?: SubjectOffering;
  section?: Section;
}

export interface Classroom {
  id: string;
  campus_id: string;
  room_number: string;
  building: string;
  floor: number;
  capacity: number;
  device_pairing_code?: string | null;
  device_status: DeviceStatus;
  last_ping_at?: string | null;
  device_identifier?: string | null;
  is_active: boolean;
}

export interface TimetableEntry {
  id: string;
  subject_offering_id: string;
  faculty_id: string;
  classroom_id: string;
  section_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // "09:00:00"
  end_time: string; // "09:55:00"
  is_recurring: boolean;
  created_at: string;
  subject_offering?: SubjectOffering;
  faculty?: Faculty;
  classroom?: Classroom;
  section?: Section;
}

export interface TimetableException {
  id: string;
  timetable_entry_id: string;
  exception_date: string;
  substitute_faculty_id?: string | null;
  substitute_classroom_id?: string | null;
  is_cancelled: boolean;
  cancellation_reason?: string | null;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  timetable_entry_id?: string | null;
  subject_offering_id: string;
  faculty_id: string;
  classroom_id: string;
  section_id: string;
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // ISO or "09:00:00"
  end_time: string; // ISO or "10:00:00"
  session_type: SessionType;
  status: SessionStatus;
  secret_seed: string; // used for rotating QR HMAC generation
  qr_expires_at?: string | null;
  is_attendance_locked: boolean;
  created_at: string;
  updated_at: string;
  subject_offering?: SubjectOffering;
  faculty?: Faculty;
  classroom?: Classroom;
  section?: Section;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  verification_method: VerificationMethod;
  marked_at: string;
  is_finalized: boolean;
  remarks?: string | null;
  device_fingerprint?: string | null;
  ip_address?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  created_at: string;
  updated_at: string;
  student?: Student;
  session?: AttendanceSession;
}

export interface AttendanceAdjustmentRequest {
  id: string;
  student_id: string;
  session_id: string;
  requested_status: AttendanceStatus;
  reason: string;
  evidence_url?: string | null;
  status: AdjustmentRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
  session?: AttendanceSession;
}

export interface AttendancePolicy {
  id: string;
  institution_id: string;
  department_id?: string | null; // null = institutional default
  min_attendance_percentage: number; // default: 75.0%
  warning_threshold: number; // e.g. 80.0%
  critical_threshold: number; // e.g. 75.0%
  late_grace_period_mins: number; // e.g. 10
  consecutive_absenteeism_alert: number; // e.g. 3 sessions
  created_at: string;
  updated_at: string;
}

export interface LeaveApplication {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: LeaveType;
  status: LeaveStatus;
  approved_by?: string | null;
  document_url?: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
}

export interface Notification {
  id: string;
  recipient_id: string; // profiles.id
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'attendance' | 'approval';
  action_url?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface DevicePairingRecord {
  id: string;
  classroom_id: string;
  pairing_code: string;
  device_identifier: string;
  paired_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface ImportJob {
  id: string;
  institution_id: string;
  job_type: 'students' | 'faculty' | 'timetable' | 'enrollments';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
  error_count: number;
  error_details?: Array<{ row: number; reason: string }> | null;
  created_by: string;
  created_at: string;
}

// ============================================================================
// Calculated Aggregations & Analytical DTOs
// ============================================================================

export interface StudentAttendanceSummary {
  student_id: string;
  roll_number: string;
  student_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  total_conducted_sessions: number; // Only finalized & completed, not cancelled
  attended_sessions: number; // present + late (or weighted by policy)
  excused_sessions: number;
  absent_sessions: number;
  attendance_percentage: number; // (attended / total_conducted) * 100
  threshold_status: 'good' | 'warning' | 'critical';
}

export interface DynamicQrPayload {
  session_id: string;
  classroom_id: string;
  timestamp: number; // Epoch timestamp in ms
  epoch_window: number; // Window counter for TOTP-style rotation
  token: string; // HMAC-SHA256 signature
}

export interface MarkAttendanceRequest {
  session_id: string;
  qr_token: string;
  epoch_window: number;
  device_fingerprint?: string;
  geo_lat?: number;
  geo_lng?: number;
}

export interface MarkAttendanceResponse {
  success: boolean;
  status: AttendanceStatus;
  message: string;
  record_id?: string;
  session_title?: string;
  marked_at: string;
}
