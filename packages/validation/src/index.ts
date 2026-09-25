import { z } from 'zod';

// ============================================================================
// Enums & Primitive Schemas
// ============================================================================

export const UserRoleSchema = z.enum([
  'student',
  'faculty',
  'hod',
  'director',
  'it_admin',
  'super_admin',
]);

export const AttendanceStatusSchema = z.enum([
  'present',
  'absent',
  'late',
  'excused',
  'pending_review',
]);

export const VerificationMethodSchema = z.enum([
  'dynamic_qr',
  'manual_faculty',
  'beacon',
  'kiosk_face',
  'leave_override',
]);

export const SessionStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'audit_locked',
]);

export const SessionTypeSchema = z.enum([
  'lecture',
  'lab',
  'tutorial',
  'seminar',
  'extra_class',
]);

export const LeaveTypeSchema = z.enum([
  'medical',
  'academic_duty',
  'personal',
  'sports',
  'bereavement',
]);

export const AdjustmentRequestStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);

// ============================================================================
// Auth & User Profile Schemas
// ============================================================================

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid academic email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const ProfileUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().nullable(),
  avatar_url: z.string().url('Invalid avatar URL').optional().nullable(),
});

// ============================================================================
// Attendance Session Schemas
// ============================================================================

export const CreateAttendanceSessionSchema = z.object({
  subject_offering_id: z.string().uuid('Invalid subject offering ID'),
  classroom_id: z.string().uuid('Invalid classroom ID'),
  section_id: z.string().uuid('Invalid section ID'),
  timetable_entry_id: z.string().uuid().optional().nullable(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  start_time: z.string().min(4, 'Start time required'),
  end_time: z.string().min(4, 'End time required'),
  session_type: SessionTypeSchema.default('lecture'),
});

export const UpdateSessionStatusSchema = z.object({
  status: SessionStatusSchema,
  cancellation_reason: z.string().max(255).optional(),
});

// ============================================================================
// Dynamic QR Token & Check-in Schemas
// ============================================================================

export const DynamicQrPayloadSchema = z.object({
  session_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  epoch_window: z.number().int().nonnegative(),
  token: z.string().min(16),
});

export const MarkAttendanceSchema = z.object({
  session_id: z.string().uuid('Session ID must be a valid UUID'),
  qr_token: z.string().min(10, 'QR verification token is required'),
  epoch_window: z.number().int().nonnegative(),
  device_fingerprint: z.string().max(100).optional(),
  geo_lat: z.number().min(-90).max(90).optional(),
  geo_lng: z.number().min(-180).max(180).optional(),
});

export const ManualAttendanceOverrideSchema = z.object({
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: AttendanceStatusSchema,
  remarks: z.string().max(255).optional(),
});

export const BulkAttendanceUpdateSchema = z.object({
  session_id: z.string().uuid(),
  records: z.array(
    z.object({
      student_id: z.string().uuid(),
      status: AttendanceStatusSchema,
      remarks: z.string().max(255).optional(),
    })
  ).min(1, 'At least one student record must be provided'),
});

// ============================================================================
// Leave & Adjustment Request Schemas
// ============================================================================

export const LeaveApplicationSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  leave_type: LeaveTypeSchema,
  document_url: z.string().url('Invalid URL for supporting document').optional().nullable(),
}).refine(data => new Date(data.end_date) >= new Date(data.start_date), {
  message: 'End date cannot be earlier than start date',
  path: ['end_date'],
});

export const AttendanceAdjustmentSchema = z.object({
  session_id: z.string().uuid('Valid session ID is required'),
  requested_status: AttendanceStatusSchema,
  reason: z.string().min(10, 'Please provide an explanatory reason of at least 10 characters').max(500),
  evidence_url: z.string().url('Must be a valid document/photo URL').optional().nullable(),
});

export const ReviewAdjustmentRequestSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  rejection_reason: z.string().max(255).optional(),
});

// ============================================================================
// Classroom & Device Pairing Schemas
// ============================================================================

export const PairDisplayDeviceSchema = z.object({
  classroom_id: z.string().uuid(),
  pairing_code: z.string().length(6, 'Pairing code must be exactly 6 characters').toUpperCase(),
  device_identifier: z.string().min(3).max(100),
});

export const TimetableEntrySchema = z.object({
  subject_offering_id: z.string().uuid(),
  faculty_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  section_id: z.string().uuid(),
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time format must be HH:MM or HH:MM:SS'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time format must be HH:MM or HH:MM:SS'),
  is_recurring: z.boolean().default(true),
});

export const AttendancePolicySchema = z.object({
  institution_id: z.string().uuid(),
  department_id: z.string().uuid().optional().nullable(),
  min_attendance_percentage: z.number().min(0).max(100),
  warning_threshold: z.number().min(0).max(100),
  critical_threshold: z.number().min(0).max(100),
  late_grace_period_mins: z.number().int().min(0).max(60),
  consecutive_absenteeism_alert: z.number().int().min(1).max(20),
});
