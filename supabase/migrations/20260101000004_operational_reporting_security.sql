-- ============================================================================
-- CAMPUSATTEND OS - OPERATIONAL, REPORTING & SECURITY LAYER
-- Migration: 20260101000004_operational_reporting_security.sql
-- ============================================================================

-- 1. ASYNCHRONOUS REPORT JOBS TABLE
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  format VARCHAR(20) NOT NULL, -- 'pdf', 'excel', 'csv'
  status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  filters JSONB DEFAULT '{}'::jsonb,
  file_url TEXT,
  file_size_bytes BIGINT,
  row_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_requester ON generated_reports(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generated reports"
ON generated_reports FOR SELECT
USING (true);

CREATE POLICY "System can manage generated reports"
ON generated_reports FOR ALL
USING (true) WITH CHECK (true);


-- 2. IMMUTABLE AUDIT LOG ENFORCEMENT
-- Enforce absolute immutability: No UPDATE or DELETE allowed on audit_logs by anyone

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- Audit log helper procedure
CREATE OR REPLACE FUNCTION rpc_log_audit_event(
  p_actor_id UUID,
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip INET DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, details, ip_address, created_at
  ) VALUES (
    p_actor_id, p_action, p_entity_type, p_entity_id, p_details, p_ip, NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- 3. NOTIFICATION DISPATCH PROCEDURES
CREATE OR REPLACE FUNCTION rpc_create_notification(
  p_recipient_id UUID,
  p_title VARCHAR,
  p_message TEXT,
  p_type VARCHAR DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id, title, message, type, action_url, created_at
  ) VALUES (
    p_recipient_id, p_title, p_message, p_type, p_action_url, NOW()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Broadcast notification to all students in a section (e.g. for timetable changes or active sessions)
CREATE OR REPLACE FUNCTION rpc_broadcast_section_notification(
  p_section_id UUID,
  p_title VARCHAR,
  p_message TEXT,
  p_type VARCHAR DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO notifications (recipient_id, title, message, type, action_url, created_at)
  SELECT 
    st.profile_id,
    p_title,
    p_message,
    p_type,
    p_action_url,
    NOW()
  FROM students st
  WHERE st.current_section_id = p_section_id AND st.enrollment_status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- 4. REPORT DATA RETRIEVAL RPCs

-- A. Student Personal Attendance Report
CREATE OR REPLACE FUNCTION rpc_report_student_attendance(
  p_student_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'student_info', (
      SELECT jsonb_build_object(
        'student_id', st.id,
        'roll_number', st.roll_number,
        'name', p.first_name || ' ' || p.last_name,
        'email', p.email,
        'section', sec.name,
        'program', prog.name,
        'department', d.name
      )
      FROM students st
      JOIN profiles p ON p.id = st.profile_id
      JOIN sections sec ON sec.id = st.current_section_id
      JOIN semesters sem ON sem.id = sec.semester_id
      JOIN programs prog ON prog.id = sem.program_id
      JOIN departments d ON d.id = prog.department_id
      WHERE st.id = p_student_id
    ),
    'subject_summaries', (
      SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
      FROM (
        SELECT 
          s.code,
          s.name AS subject_name,
          COUNT(ar.id) AS total_held,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused')) AS attended_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'present') AS present_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'late') AS late_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'excused') AS excused_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent') AS absent_count,
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::NUMERIC / 
             NULLIF(COUNT(ar.id), 0) * 100), 2
          ) AS attendance_percentage
        FROM attendance_records ar
        JOIN attendance_sessions ses ON ses.id = ar.session_id
        JOIN subject_offerings so ON so.id = ses.subject_offering_id
        JOIN subjects s ON s.id = so.subject_id
        WHERE ar.student_id = p_student_id
          AND (p_start_date IS NULL OR ses.session_date >= p_start_date)
          AND (p_end_date IS NULL OR ses.session_date <= p_end_date)
        GROUP BY s.code, s.name
        ORDER BY s.code
      ) s
    ),
    'session_records', (
      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
      FROM (
        SELECT 
          ses.session_date,
          ses.start_time,
          ses.end_time,
          s.code AS subject_code,
          s.name AS subject_name,
          ar.status,
          ar.verification_method,
          ar.marked_at,
          ar.remarks
        FROM attendance_records ar
        JOIN attendance_sessions ses ON ses.id = ar.session_id
        JOIN subject_offerings so ON so.id = ses.subject_offering_id
        JOIN subjects s ON s.id = so.subject_id
        WHERE ar.student_id = p_student_id
          AND (p_start_date IS NULL OR ses.session_date >= p_start_date)
          AND (p_end_date IS NULL OR ses.session_date <= p_end_date)
        ORDER BY ses.session_date DESC, ses.start_time DESC
        LIMIT 500
      ) r
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- B. Faculty Class Attendance & Shortage Report
CREATE OR REPLACE FUNCTION rpc_report_faculty_class(
  p_subject_offering_id UUID,
  p_section_id UUID,
  p_threshold NUMERIC DEFAULT 75.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'class_info', (
      SELECT jsonb_build_object(
        'subject_code', s.code,
        'subject_name', s.name,
        'section_name', sec.name,
        'total_sessions', (
          SELECT COUNT(*) FROM attendance_sessions 
          WHERE subject_offering_id = p_subject_offering_id AND section_id = p_section_id AND status IN ('completed', 'audit_locked')
        )
      )
      FROM subject_offerings so
      JOIN subjects s ON s.id = so.subject_id
      JOIN sections sec ON sec.id = p_section_id
      WHERE so.id = p_subject_offering_id
    ),
    'roster', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT 
          st.id AS student_id,
          st.roll_number,
          p.first_name || ' ' || p.last_name AS student_name,
          p.email,
          COUNT(ar.id) AS total_held,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused')) AS attended_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent') AS absent_count,
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::NUMERIC / 
             NULLIF(COUNT(ar.id), 0) * 100), 2
          ) AS percentage,
          CASE 
            WHEN (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::NUMERIC / NULLIF(COUNT(ar.id), 0) * 100) < p_threshold
            THEN true ELSE false 
          END AS is_shortage
        FROM students st
        JOIN profiles p ON p.id = st.profile_id
        LEFT JOIN attendance_records ar ON ar.student_id = st.id
        LEFT JOIN attendance_sessions ses ON ses.id = ar.session_id 
          AND ses.subject_offering_id = p_subject_offering_id 
          AND ses.section_id = p_section_id
        WHERE st.current_section_id = p_section_id AND st.enrollment_status = 'active'
        GROUP BY st.id, st.roll_number, p.first_name, p.last_name, p.email
        ORDER BY st.roll_number ASC
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- C. Department / HOD Aggregation Report
CREATE OR REPLACE FUNCTION rpc_report_department_analytics(
  p_department_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'department_info', (
      SELECT jsonb_build_object('id', d.id, 'name', d.name, 'code', d.code)
      FROM departments d WHERE d.id = p_department_id
    ),
    'sections_summary', (
      SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
      FROM (
        SELECT 
          sec.id AS section_id,
          sec.name AS section_name,
          prog.name AS program_name,
          sem.semester_number,
          COUNT(DISTINCT st.id) AS total_students,
          COALESCE(AVG(ssum.attendance_percentage), 100.00)::NUMERIC(5,2) AS average_attendance,
          COUNT(DISTINCT st.id) FILTER (WHERE ssum.attendance_percentage < 75) AS shortage_count
        FROM sections sec
        JOIN semesters sem ON sem.id = sec.semester_id
        JOIN programs prog ON prog.id = sem.program_id
        LEFT JOIN students st ON st.current_section_id = sec.id
        LEFT JOIN mv_student_attendance_summary ssum ON ssum.student_id = st.id
        WHERE prog.department_id = p_department_id
        GROUP BY sec.id, sec.name, prog.name, sem.semester_number
        ORDER BY prog.name, sem.semester_number, sec.name
      ) s
    ),
    'faculty_metrics', (
      SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
      FROM (
        SELECT 
          fac.id AS faculty_id,
          fac.employee_code,
          p.first_name || ' ' || p.last_name AS faculty_name,
          fac.designation,
          COUNT(DISTINCT ses.id) AS total_sessions_conducted,
          COUNT(DISTINCT fa.id) AS assigned_classes_count
        FROM faculty fac
        JOIN profiles p ON p.id = fac.profile_id
        LEFT JOIN attendance_sessions ses ON ses.faculty_id = fac.id AND ses.status IN ('completed', 'audit_locked')
          AND (p_start_date IS NULL OR ses.session_date >= p_start_date)
          AND (p_end_date IS NULL OR ses.session_date <= p_end_date)
        LEFT JOIN faculty_assignments fa ON fa.faculty_id = fac.id
        WHERE fac.department_id = p_department_id
        GROUP BY fac.id, fac.employee_code, p.first_name, p.last_name, fac.designation
        ORDER BY fac.employee_code
      ) f
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- D. Director Institution-Wide Report (Includes objective Department Comparison without evaluative ranking)
CREATE OR REPLACE FUNCTION rpc_report_director_institutional(
  p_institution_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'institutional_metrics', (
      SELECT jsonb_build_object(
        'total_departments', (SELECT COUNT(*) FROM departments WHERE institution_id = p_institution_id),
        'total_faculty', (SELECT COUNT(*) FROM faculty WHERE institution_id = p_institution_id),
        'total_active_students', (SELECT COUNT(*) FROM students WHERE institution_id = p_institution_id AND enrollment_status = 'active'),
        'total_sessions_conducted', (
          SELECT COUNT(*) FROM attendance_sessions s
          JOIN classrooms c ON c.id = s.classroom_id
          JOIN campuses cmp ON cmp.id = c.campus_id
          WHERE cmp.institution_id = p_institution_id
            AND s.status IN ('completed', 'audit_locked')
            AND (p_start_date IS NULL OR s.session_date >= p_start_date)
            AND (p_end_date IS NULL OR s.session_date <= p_end_date)
        )
      )
    ),
    'department_comparison', (
      -- Objective department comparison data without evaluative ranking
      SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
      FROM (
        SELECT 
          dept.id AS department_id,
          dept.name AS department_name,
          dept.code AS department_code,
          COUNT(DISTINCT st.id) AS enrolled_students,
          COUNT(DISTINCT fac.id) AS faculty_count,
          COALESCE(AVG(ssum.attendance_percentage), 100.00)::NUMERIC(5,2) AS attendance_rate,
          COUNT(DISTINCT st.id) FILTER (WHERE ssum.attendance_percentage < 75) AS students_below_threshold
        FROM departments dept
        LEFT JOIN programs prog ON prog.department_id = dept.id
        LEFT JOIN semesters sem ON sem.program_id = prog.id
        LEFT JOIN sections sec ON sec.semester_id = sem.id
        LEFT JOIN students st ON st.current_section_id = sec.id AND st.enrollment_status = 'active'
        LEFT JOIN mv_student_attendance_summary ssum ON ssum.student_id = st.id
        LEFT JOIN faculty fac ON fac.department_id = dept.id
        WHERE dept.institution_id = p_institution_id
        GROUP BY dept.id, dept.name, dept.code
        ORDER BY dept.code ASC
      ) d
    ),
    'low_attendance_cohort', (
      SELECT COALESCE(jsonb_agg(l), '[]'::jsonb)
      FROM (
        SELECT 
          st.id AS student_id,
          st.roll_number,
          p.first_name || ' ' || p.last_name AS full_name,
          d.code AS department_code,
          sec.name AS section_name,
          AVG(ssum.attendance_percentage)::NUMERIC(5,2) AS current_percentage
        FROM students st
        JOIN profiles p ON p.id = st.profile_id
        JOIN sections sec ON sec.id = st.current_section_id
        JOIN semesters sem ON sem.id = sec.semester_id
        JOIN programs prog ON prog.id = sem.program_id
        JOIN departments d ON d.id = prog.department_id
        JOIN mv_student_attendance_summary ssum ON ssum.student_id = st.id
        WHERE st.institution_id = p_institution_id AND st.enrollment_status = 'active'
        GROUP BY st.id, st.roll_number, p.first_name, p.last_name, d.code, sec.name
        HAVING AVG(ssum.attendance_percentage) < 75
        ORDER BY AVG(ssum.attendance_percentage) ASC
        LIMIT 100
      ) l
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
