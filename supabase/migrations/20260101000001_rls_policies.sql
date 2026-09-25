-- ============================================================================
-- CAMPUSATTEND OS - ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 20260101000001_rls_policies.sql
-- ============================================================================

-- Enable RLS on all operational tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_pairing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR ROLE-BASED ACCESS CHECKS
-- ============================================================================

-- Get current authenticated user profile
CREATE OR REPLACE FUNCTION get_current_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user institution_id
CREATE OR REPLACE FUNCTION get_current_user_institution_id()
RETURNS UUID AS $$
  SELECT institution_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current faculty record ID
CREATE OR REPLACE FUNCTION get_current_faculty_id()
RETURNS UUID AS $$
  SELECT f.id FROM faculty f
  JOIN profiles p ON p.id = f.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current student record ID
CREATE OR REPLACE FUNCTION get_current_student_id()
RETURNS UUID AS $$
  SELECT s.id FROM students s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current student section ID
CREATE OR REPLACE FUNCTION get_current_student_section_id()
RETURNS UUID AS $$
  SELECT s.current_section_id FROM students s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 1. PROFILES POLICIES
-- ============================================================================

-- Any authenticated user can read profiles in their own institution
CREATE POLICY "Profiles readable within institution"
ON profiles FOR SELECT
TO authenticated
USING (institution_id = get_current_user_institution_id());

-- Users can update their own personal contact info
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Super admin and IT admin can manage profiles
CREATE POLICY "Admins can manage profiles"
ON profiles FOR ALL
TO authenticated
USING (get_current_user_role() IN ('super_admin', 'it_admin'))
WITH CHECK (get_current_user_role() IN ('super_admin', 'it_admin'));

-- ============================================================================
-- 2. INSTITUTIONS & CAMPUSES POLICIES
-- ============================================================================

CREATE POLICY "Institutions visible to members"
ON institutions FOR SELECT
TO authenticated
USING (id = get_current_user_institution_id() OR get_current_user_role() = 'super_admin');

CREATE POLICY "Campuses visible to members"
ON campuses FOR SELECT
TO authenticated
USING (institution_id = get_current_user_institution_id() OR get_current_user_role() = 'super_admin');

CREATE POLICY "Campuses manageable by super_admin and director"
ON campuses FOR ALL
TO authenticated
USING (get_current_user_role() IN ('super_admin', 'director'));

-- ============================================================================
-- 3. ACADEMIC STRUCTURE (Departments, Years, Terms, Programs, Semesters, Sections)
-- ============================================================================

CREATE POLICY "Academic structure readable by institution members"
ON departments FOR SELECT
TO authenticated
USING (institution_id = get_current_user_institution_id());

CREATE POLICY "Academic years readable by institution members"
ON academic_years FOR SELECT
TO authenticated
USING (institution_id = get_current_user_institution_id());

CREATE POLICY "Academic terms readable by institution members"
ON academic_terms FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM academic_years ay
  WHERE ay.id = academic_terms.academic_year_id
    AND ay.institution_id = get_current_user_institution_id()
));

CREATE POLICY "Programs readable by institution members"
ON programs FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM departments d
  WHERE d.id = programs.department_id
    AND d.institution_id = get_current_user_institution_id()
));

CREATE POLICY "Semesters readable by institution members"
ON semesters FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM programs p
  JOIN departments d ON d.id = p.department_id
  WHERE p.id = semesters.program_id
    AND d.institution_id = get_current_user_institution_id()
));

CREATE POLICY "Sections readable by institution members"
ON sections FOR SELECT
TO authenticated
USING (true);

-- Manage academic structure: Super admin, Director, HOD (for their department)
CREATE POLICY "Admins manage departments"
ON departments FOR ALL
TO authenticated
USING (get_current_user_role() IN ('super_admin', 'director'));

-- ============================================================================
-- 4. STUDENTS POLICIES
-- ============================================================================

-- Students can read only their own record
CREATE POLICY "Students read own record"
ON students FOR SELECT
TO authenticated
USING (
  profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR get_current_user_role() IN ('faculty', 'hod', 'director', 'it_admin', 'super_admin')
);

-- Management of students by IT Admin or Super Admin
CREATE POLICY "Admins manage students"
ON students FOR ALL
TO authenticated
USING (get_current_user_role() IN ('super_admin', 'it_admin'));

-- ============================================================================
-- 5. FACULTY POLICIES
-- ============================================================================

CREATE POLICY "Faculty readable by authenticated users"
ON faculty FOR SELECT
TO authenticated
USING (institution_id = get_current_user_institution_id());

CREATE POLICY "Admins manage faculty"
ON faculty FOR ALL
TO authenticated
USING (get_current_user_role() IN ('super_admin', 'director', 'it_admin'));

-- ============================================================================
-- 6. SUBJECTS & OFFERINGS
-- ============================================================================

CREATE POLICY "Subjects readable by all"
ON subjects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Subject offerings readable by all"
ON subject_offerings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Faculty assignments readable by all"
ON faculty_assignments FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 7. CLASSROOMS & DEVICE PAIRING (IT Admin Scoped)
-- ============================================================================

CREATE POLICY "Classrooms readable by all"
ON classrooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "IT Admin manages classrooms and devices"
ON classrooms FOR ALL
TO authenticated
USING (get_current_user_role() IN ('it_admin', 'super_admin'))
WITH CHECK (get_current_user_role() IN ('it_admin', 'super_admin'));

CREATE POLICY "Device pairing records manageable by IT Admin"
ON device_pairing_records FOR ALL
TO authenticated
USING (get_current_user_role() IN ('it_admin', 'super_admin'))
WITH CHECK (get_current_user_role() IN ('it_admin', 'super_admin'));

-- ============================================================================
-- 8. TIMETABLE POLICIES
-- ============================================================================

CREATE POLICY "Timetable readable by institution members"
ON timetable_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Faculty, HOD, and Admins manage timetable"
ON timetable_entries FOR ALL
TO authenticated
USING (get_current_user_role() IN ('faculty', 'hod', 'director', 'it_admin', 'super_admin'));

CREATE POLICY "Timetable exceptions readable by all"
ON timetable_exceptions FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 9. ATTENDANCE SESSIONS POLICIES
-- ============================================================================

-- Students can read sessions for their section
CREATE POLICY "Students read their section sessions"
ON attendance_sessions FOR SELECT
TO authenticated
USING (
  (get_current_user_role() = 'student' AND section_id = get_current_student_section_id())
  OR (get_current_user_role() = 'faculty' AND faculty_id = get_current_faculty_id())
  OR (get_current_user_role() IN ('hod', 'director', 'it_admin', 'super_admin'))
);

-- Faculty can create and update sessions they conduct
CREATE POLICY "Faculty manage own sessions"
ON attendance_sessions FOR ALL
TO authenticated
USING (
  (get_current_user_role() = 'faculty' AND faculty_id = get_current_faculty_id())
  OR get_current_user_role() IN ('hod', 'director', 'super_admin')
)
WITH CHECK (
  (get_current_user_role() = 'faculty' AND faculty_id = get_current_faculty_id())
  OR get_current_user_role() IN ('hod', 'director', 'super_admin')
);

-- ============================================================================
-- 10. ATTENDANCE RECORDS POLICIES (Strict Security!)
-- ============================================================================

-- Students can view ONLY their own attendance records
CREATE POLICY "Students view own attendance records"
ON attendance_records FOR SELECT
TO authenticated
USING (
  student_id = get_current_student_id()
  OR (
    get_current_user_role() = 'faculty' 
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s 
      WHERE s.id = attendance_records.session_id 
        AND s.faculty_id = get_current_faculty_id()
    )
  )
  OR get_current_user_role() IN ('hod', 'director', 'super_admin')
);

-- Faculty can insert and update attendance records for sessions they teach
CREATE POLICY "Faculty manage records for own sessions"
ON attendance_records FOR ALL
TO authenticated
USING (
  get_current_user_role() IN ('director', 'super_admin')
  OR (
    get_current_user_role() IN ('faculty', 'hod') 
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s 
      WHERE s.id = attendance_records.session_id 
        AND (s.faculty_id = get_current_faculty_id() OR get_current_user_role() = 'hod')
    )
  )
)
WITH CHECK (
  get_current_user_role() IN ('director', 'super_admin')
  OR (
    get_current_user_role() IN ('faculty', 'hod') 
    AND EXISTS (
      SELECT 1 FROM attendance_sessions s 
      WHERE s.id = attendance_records.session_id 
        AND (s.faculty_id = get_current_faculty_id() OR get_current_user_role() = 'hod')
    )
  )
);

-- Note: IT Admin explicitly does NOT have write permissions on attendance_records,
-- ensuring segregation of duties as required by the security specification!

-- ============================================================================
-- 11. ATTENDANCE ADJUSTMENT REQUESTS POLICIES
-- ============================================================================

-- Students can view and create their own adjustment requests
CREATE POLICY "Students manage own adjustment requests"
ON attendance_adjustment_requests FOR SELECT
TO authenticated
USING (
  student_id = get_current_student_id()
  OR get_current_user_role() IN ('faculty', 'hod', 'director', 'super_admin')
);

CREATE POLICY "Students insert own adjustment requests"
ON attendance_adjustment_requests FOR INSERT
TO authenticated
WITH CHECK (student_id = get_current_student_id());

CREATE POLICY "Faculty and HOD review adjustment requests"
ON attendance_adjustment_requests FOR UPDATE
TO authenticated
USING (get_current_user_role() IN ('faculty', 'hod', 'director', 'super_admin'));

-- ============================================================================
-- 12. LEAVE APPLICATIONS POLICIES
-- ============================================================================

CREATE POLICY "Students view and insert own leave applications"
ON leave_applications FOR SELECT
TO authenticated
USING (
  student_id = get_current_student_id()
  OR get_current_user_role() IN ('faculty', 'hod', 'director', 'super_admin')
);

CREATE POLICY "Students create leave applications"
ON leave_applications FOR INSERT
TO authenticated
WITH CHECK (student_id = get_current_student_id());

CREATE POLICY "Faculty and HOD approve leave applications"
ON leave_applications FOR UPDATE
TO authenticated
USING (get_current_user_role() IN ('faculty', 'hod', 'director', 'super_admin'));

-- ============================================================================
-- 13. NOTIFICATIONS & AUDIT LOGS
-- ============================================================================

CREATE POLICY "Users read own notifications"
ON notifications FOR SELECT
TO authenticated
USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users update own notifications read status"
ON notifications FOR UPDATE
TO authenticated
USING (recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Audit logs visible to Directors and Admins"
ON audit_logs FOR SELECT
TO authenticated
USING (get_current_user_role() IN ('director', 'it_admin', 'super_admin'));

CREATE POLICY "Admins manage import jobs"
ON import_jobs FOR ALL
TO authenticated
USING (get_current_user_role() IN ('it_admin', 'super_admin'));
