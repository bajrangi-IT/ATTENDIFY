-- ============================================================================
-- CAMPUSATTEND OS - PRODUCTION DATABASE SCHEMA
-- Migration: 20260101000000_init_schema.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'student',
  'faculty',
  'hod',
  'director',
  'it_admin',
  'super_admin'
);

CREATE TYPE attendance_status AS ENUM (
  'present',
  'absent',
  'late',
  'excused',
  'pending_review'
);

CREATE TYPE verification_method AS ENUM (
  'dynamic_qr',
  'manual_faculty',
  'beacon',
  'kiosk_face',
  'leave_override'
);

CREATE TYPE session_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'audit_locked'
);

CREATE TYPE session_type AS ENUM (
  'lecture',
  'lab',
  'tutorial',
  'seminar',
  'extra_class'
);

CREATE TYPE leave_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

CREATE TYPE leave_type AS ENUM (
  'medical',
  'academic_duty',
  'personal',
  'sports',
  'bereavement'
);

CREATE TYPE adjustment_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE device_status AS ENUM (
  'online',
  'offline',
  'unpaired',
  'maintenance'
);

CREATE TYPE degree_level AS ENUM (
  'undergraduate',
  'postgraduate',
  'doctorate',
  'diploma'
);

-- ============================================================================
-- 1. INSTITUTIONS & CAMPUSES
-- ============================================================================

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  logo_url TEXT,
  address TEXT,
  timezone VARCHAR(100) DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

-- ============================================================================
-- 2. PROFILES & USER ROLES
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  phone_number VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_institution_role ON profiles(institution_id, role);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- ============================================================================
-- 3. DEPARTMENTS
-- ============================================================================

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  hod_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

-- ============================================================================
-- 4. ACADEMIC YEARS & TERMS
-- ============================================================================

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g. "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_year_dates CHECK (end_date > start_date)
);

CREATE TABLE academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g. "Odd Semester / Fall 2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT check_term_dates CHECK (end_date > start_date)
);

-- ============================================================================
-- 5. PROGRAMS, COURSES & SEMESTERS
-- ============================================================================

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  degree_level degree_level NOT NULL DEFAULT 'undergraduate',
  duration_semesters INT NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  semester_number INT NOT NULL CHECK (semester_number >= 1 AND semester_number <= 12),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(program_id, academic_year_id, semester_number)
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g. "Section A", "Section B"
  capacity INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semester_id, name)
);

-- ============================================================================
-- 6. STUDENTS & ENROLLMENT HISTORY
-- ============================================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  roll_number VARCHAR(50) NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  current_section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  batch_year INT NOT NULL,
  enrollment_status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, roll_number),
  UNIQUE(institution_id, registration_number)
);

CREATE INDEX idx_students_current_section ON students(current_section_id);

CREATE TABLE enrollment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  to_section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. FACULTY & FACULTY ASSIGNMENTS
-- ============================================================================

CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  employee_code VARCHAR(50) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, employee_code)
);

CREATE INDEX idx_faculty_department ON faculty(department_id);

-- ============================================================================
-- 8. SUBJECTS & SUBJECT OFFERINGS
-- ============================================================================

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  credits INT NOT NULL DEFAULT 4,
  subject_type VARCHAR(50) DEFAULT 'theory',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, code)
);

CREATE TABLE subject_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(subject_id, semester_id, academic_year_id)
);

CREATE TABLE faculty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  subject_offering_id UUID NOT NULL REFERENCES subject_offerings(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, subject_offering_id, section_id)
);

-- ============================================================================
-- 9. CLASSROOMS & SMART DISPLAY DEVICES
-- ============================================================================

CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  room_number VARCHAR(50) NOT NULL,
  building VARCHAR(100) NOT NULL,
  floor INT DEFAULT 1,
  capacity INT NOT NULL DEFAULT 60,
  device_pairing_code VARCHAR(10),
  device_status device_status DEFAULT 'unpaired',
  device_identifier VARCHAR(100),
  last_ping_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(campus_id, building, room_number)
);

CREATE TABLE device_pairing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  pairing_code VARCHAR(10) NOT NULL,
  device_identifier VARCHAR(100) NOT NULL,
  paired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- 10. TIMETABLE ENTRIES & EXCEPTIONS
-- ============================================================================

CREATE TABLE timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_offering_id UUID NOT NULL REFERENCES subject_offerings(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Mon, 7 = Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_timetable_times CHECK (end_time > start_time)
);

CREATE INDEX idx_timetable_lookup ON timetable_entries(section_id, day_of_week);

CREATE TABLE timetable_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  substitute_faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  substitute_classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  is_cancelled BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(timetable_entry_id, exception_date)
);

-- ============================================================================
-- 11. ATTENDANCE SESSIONS
-- ============================================================================

CREATE TABLE attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_entry_id UUID REFERENCES timetable_entries(id) ON DELETE SET NULL,
  subject_offering_id UUID NOT NULL REFERENCES subject_offerings(id) ON DELETE RESTRICT,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_type session_type DEFAULT 'lecture',
  status session_status DEFAULT 'scheduled',
  secret_seed VARCHAR(128) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  qr_expires_at TIMESTAMPTZ,
  is_attendance_locked BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_faculty_date ON attendance_sessions(faculty_id, session_date);
CREATE INDEX idx_sessions_section_date ON attendance_sessions(section_id, session_date);

-- ============================================================================
-- 12. ATTENDANCE RECORDS (Canonical - 1 record per student per session)
-- ============================================================================

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'absent',
  verification_method verification_method NOT NULL DEFAULT 'dynamic_qr',
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  is_finalized BOOLEAN DEFAULT true,
  remarks VARCHAR(255),
  device_fingerprint VARCHAR(100),
  ip_address INET,
  geo_lat NUMERIC(9,6),
  geo_lng NUMERIC(9,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- CRITICAL CONSTRAINT: Exactly one canonical record per student per session!
  CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
);

CREATE INDEX idx_attendance_student_session ON attendance_records(student_id, session_id);
CREATE INDEX idx_attendance_status ON attendance_records(status);

-- ============================================================================
-- 13. ATTENDANCE ADJUSTMENT REQUESTS & APPROVALS
-- ============================================================================

CREATE TABLE attendance_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  requested_status attendance_status NOT NULL,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status adjustment_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, session_id)
);

-- ============================================================================
-- 14. ATTENDANCE POLICIES & THRESHOLDS
-- ============================================================================

CREATE TABLE attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  min_attendance_percentage NUMERIC(5,2) DEFAULT 75.00 CHECK (min_attendance_percentage >= 0 AND min_attendance_percentage <= 100),
  warning_threshold NUMERIC(5,2) DEFAULT 80.00,
  critical_threshold NUMERIC(5,2) DEFAULT 75.00,
  late_grace_period_mins INT DEFAULT 10,
  consecutive_absenteeism_alert INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, department_id)
);

-- ============================================================================
-- 15. LEAVE APPLICATIONS
-- ============================================================================

CREATE TABLE leave_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  leave_type leave_type NOT NULL DEFAULT 'medical',
  status leave_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_leave_dates CHECK (end_date >= start_date)
);

-- ============================================================================
-- 16. NOTIFICATIONS & AUDIT LOGS
-- ============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, read_at);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- 17. IMPORT JOBS & ERROR REPORTS
-- ============================================================================

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total_rows INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_details JSONB,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 18. CANONICAL ATTENDANCE SUMMARY VIEW & CALCULATION ENGINE
-- ============================================================================

-- View: Aggregates attendance statistics cleanly per student and subject offering
-- Rule: ONLY sessions with status IN ('completed', 'audit_locked') are counted.
-- Rule: Cancelled sessions are strictly filtered out.
CREATE OR REPLACE VIEW v_student_attendance_summary AS
WITH held_sessions AS (
  SELECT 
    s.id AS session_id,
    s.subject_offering_id,
    s.section_id
  FROM attendance_sessions s
  WHERE s.status IN ('completed', 'audit_locked')
),
student_sessions AS (
  -- Pair each student with all finalized sessions held for their current section
  SELECT
    st.id AS student_id,
    st.roll_number,
    st.profile_id,
    hs.subject_offering_id,
    hs.session_id
  FROM students st
  JOIN held_sessions hs ON hs.section_id = st.current_section_id
),
attendance_aggregates AS (
  SELECT
    ss.student_id,
    ss.roll_number,
    ss.profile_id,
    ss.subject_offering_id,
    COUNT(ss.session_id) AS total_held,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present_count,
    COUNT(CASE WHEN ar.status = 'late' THEN 1 END) AS late_count,
    COUNT(CASE WHEN ar.status = 'excused' THEN 1 END) AS excused_count,
    COUNT(CASE WHEN ar.status = 'absent' OR ar.id IS NULL THEN 1 END) AS absent_count
  FROM student_sessions ss
  LEFT JOIN attendance_records ar 
    ON ar.session_id = ss.session_id 
   AND ar.student_id = ss.student_id 
   AND ar.is_finalized = true
  GROUP BY ss.student_id, ss.roll_number, ss.profile_id, ss.subject_offering_id
)
SELECT
  a.student_id,
  a.roll_number,
  p.first_name || ' ' || p.last_name AS student_name,
  a.subject_offering_id,
  sub.id AS subject_id,
  sub.code AS subject_code,
  sub.name AS subject_name,
  a.total_held,
  (a.present_count + a.late_count + a.excused_count) AS attended_count,
  a.present_count,
  a.late_count,
  a.excused_count,
  a.absent_count,
  CASE 
    WHEN a.total_held = 0 THEN 100.00
    ELSE ROUND(((a.present_count + a.late_count + a.excused_count)::NUMERIC / a.total_held::NUMERIC) * 100, 2)
  END AS attendance_percentage,
  CASE
    WHEN a.total_held = 0 THEN 'good'
    WHEN ROUND(((a.present_count + a.late_count + a.excused_count)::NUMERIC / a.total_held::NUMERIC) * 100, 2) < 75.00 THEN 'critical'
    WHEN ROUND(((a.present_count + a.late_count + a.excused_count)::NUMERIC / a.total_held::NUMERIC) * 100, 2) < 80.00 THEN 'warning'
    ELSE 'good'
  END AS threshold_status
FROM attendance_aggregates a
JOIN profiles p ON p.id = a.profile_id
JOIN subject_offerings so ON so.id = a.subject_offering_id
JOIN subjects sub ON sub.id = so.subject_id;

-- Function: Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_faculty_updated BEFORE UPDATE ON faculty
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON attendance_sessions
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_records_updated BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
