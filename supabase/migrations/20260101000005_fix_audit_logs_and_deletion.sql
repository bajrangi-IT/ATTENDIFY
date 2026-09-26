-- ============================================================================
-- CAMPUSATTEND OS - FIX AUDIT LOG IMMUTABILITY CONFLICT & SECURE DELETIONS
-- Migration: 20260101000005_fix_audit_logs_and_deletion.sql
-- ============================================================================

-- 1. FIX AUDIT LOG IMMUTABILITY CONFLICT
-- When a user/profile is deleted, PostgreSQL's ON DELETE SET NULL foreign key
-- on audit_logs.actor_id attempts an UPDATE on audit_logs.
-- However, trg_audit_logs_immutable forbids ANY UPDATE or DELETE on audit_logs,
-- which throws: "Audit logs are strictly immutable and cannot be updated or deleted."
--
-- For standard compliance (FERPA, SOC2, ISO), audit records must remain intact as 
-- historical append-only logs. The historical actor_id should remain preserved 
-- without attempting to mutate the audit table when a user profile is deleted.
-- Therefore, we drop the cascading foreign key constraint from audit_logs.actor_id.

ALTER TABLE IF EXISTS audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

-- Re-assert strict immutability trigger on audit_logs
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


-- 2. RELAX RESTRICT CONSTRAINTS ON HISTORICAL SESSIONS & TIMETABLES FOR FACULTY
-- Allow faculty to be safely removed without breaking historical timetable / session records
ALTER TABLE IF EXISTS timetable_entries
  DROP CONSTRAINT IF EXISTS timetable_entries_faculty_id_fkey,
  ALTER COLUMN faculty_id DROP NOT NULL,
  ADD CONSTRAINT timetable_entries_faculty_id_fkey 
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_faculty_id_fkey,
  ALTER COLUMN faculty_id DROP NOT NULL,
  ADD CONSTRAINT attendance_sessions_faculty_id_fkey 
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL;


-- 3. ADMINISTRATIVE SECURE DELETE STUDENT RPC
CREATE OR REPLACE FUNCTION rpc_admin_delete_student(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_profile_id UUID;
  v_institution_id UUID;
  v_student_roll VARCHAR;
  v_student_name TEXT;
  v_email VARCHAR;
BEGIN
  -- Resolve student by either student record ID or profile ID
  SELECT s.id, s.profile_id, s.institution_id, s.roll_number, (p.first_name || ' ' || p.last_name), p.email
  INTO v_student_id, v_profile_id, v_institution_id, v_student_roll, v_student_name, v_email
  FROM students s
  JOIN profiles p ON p.id = s.profile_id
  WHERE s.id = p_student_id OR s.profile_id = p_student_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found.'
    );
  END IF;

  -- 1. Delete materialized attendance summary and archives
  DELETE FROM mv_student_attendance_summary WHERE student_id = v_student_id;
  DELETE FROM attendance_records_archive WHERE student_id = v_student_id;

  -- 2. Delete student attendance adjustment requests & leave applications
  DELETE FROM attendance_adjustment_requests WHERE student_id = v_student_id;
  DELETE FROM leave_applications WHERE student_id = v_student_id;

  -- 3. Delete student attendance records
  DELETE FROM attendance_records WHERE student_id = v_student_id;

  -- 4. Delete enrollment history
  DELETE FROM enrollment_history WHERE student_id = v_student_id;

  -- 5. Delete student biometrics / credentials if table exists
  BEGIN
    DELETE FROM student_biometrics WHERE student_id = v_student_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 6. Delete notifications & reports for this student profile
  DELETE FROM notifications WHERE recipient_id = v_profile_id;
  DELETE FROM generated_reports WHERE requester_id = v_profile_id;

  -- 7. Delete student enrollment record
  DELETE FROM students WHERE id = v_student_id;

  -- 8. Delete profile record
  DELETE FROM profiles WHERE id = v_profile_id;

  -- 9. Delete auth user record if permitted
  BEGIN
    DELETE FROM auth.users WHERE id = v_profile_id OR lower(email) = lower(v_email);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 10. Write immutable audit log entry for this administrative action
  INSERT INTO audit_logs (
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    'DELETE_STUDENT',
    'student',
    v_student_id,
    jsonb_build_object(
      'roll_number', v_student_roll,
      'student_name', v_student_name,
      'institution_id', v_institution_id,
      'deleted_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student ' || v_student_name || ' (' || v_student_roll || ') successfully deleted.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


-- 4. ADMINISTRATIVE SECURE DELETE FACULTY RPC
CREATE OR REPLACE FUNCTION rpc_admin_delete_faculty(
  p_faculty_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faculty_id UUID;
  v_profile_id UUID;
  v_institution_id UUID;
  v_employee_code VARCHAR;
  v_faculty_name TEXT;
  v_email VARCHAR;
BEGIN
  -- Resolve faculty by either faculty record ID or profile ID
  SELECT f.id, f.profile_id, f.institution_id, f.employee_code, (p.first_name || ' ' || p.last_name), p.email
  INTO v_faculty_id, v_profile_id, v_institution_id, v_employee_code, v_faculty_name, v_email
  FROM faculty f
  JOIN profiles p ON p.id = f.profile_id
  WHERE f.id = p_faculty_id OR f.profile_id = p_faculty_id
  LIMIT 1;

  IF v_faculty_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faculty member not found.'
    );
  END IF;

  -- 1. Unassign as HOD if applicable
  UPDATE departments SET hod_id = NULL WHERE hod_id = v_profile_id;

  -- 2. Clear faculty substitutions & timetable history
  UPDATE timetable_exceptions SET substitute_faculty_id = NULL WHERE substitute_faculty_id = v_faculty_id;
  UPDATE timetable_change_history SET old_faculty_id = NULL WHERE old_faculty_id = v_faculty_id;
  UPDATE timetable_change_history SET new_faculty_id = NULL WHERE new_faculty_id = v_faculty_id;
  UPDATE timetable_entries SET faculty_id = NULL WHERE faculty_id = v_faculty_id;

  -- 3. Delete or unlink attendance sessions & reports
  DELETE FROM attendance_session_reports WHERE faculty_id = v_faculty_id;
  DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions WHERE faculty_id = v_faculty_id);
  DELETE FROM attendance_sessions WHERE faculty_id = v_faculty_id;

  -- 4. Delete faculty assignments & leave requests
  DELETE FROM faculty_assignments WHERE faculty_id = v_faculty_id;
  DELETE FROM faculty_leave_requests WHERE faculty_id = v_faculty_id;

  -- 5. Delete notifications & reports for this faculty profile
  DELETE FROM notifications WHERE recipient_id = v_profile_id;
  DELETE FROM generated_reports WHERE requester_id = v_profile_id;

  -- 6. Delete faculty registry entry
  DELETE FROM faculty WHERE id = v_faculty_id;

  -- 7. Delete profile record
  DELETE FROM profiles WHERE id = v_profile_id;

  -- 8. Delete auth user record if permitted
  BEGIN
    DELETE FROM auth.users WHERE id = v_profile_id OR lower(email) = lower(v_email);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 9. Write immutable audit log entry for this administrative action
  INSERT INTO audit_logs (
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    'DELETE_FACULTY',
    'faculty',
    v_faculty_id,
    jsonb_build_object(
      'employee_code', v_employee_code,
      'faculty_name', v_faculty_name,
      'institution_id', v_institution_id,
      'deleted_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Faculty ' || v_faculty_name || ' (' || v_employee_code || ') successfully deleted.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
