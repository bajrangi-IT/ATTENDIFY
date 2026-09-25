-- ============================================================================
-- CAMPUSATTEND OS - PRODUCTION ATTENDANCE ENGINE & DEVICE REGISTRATION
-- Migration: 20260101000002_attendance_engine.sql
-- ============================================================================

-- 1. Extend Classrooms Table for Smart Display Device Registration
ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS display_token VARCHAR(128),
  ADD COLUMN IF NOT EXISTS display_token_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS device_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

CREATE INDEX IF NOT EXISTS idx_classrooms_display_token ON classrooms(display_token);
CREATE INDEX IF NOT EXISTS idx_classrooms_pairing_code ON classrooms(device_pairing_code);

-- Extend attendance_session_reports if column missing
ALTER TABLE attendance_session_reports
  ADD COLUMN IF NOT EXISTS attendance_percentage NUMERIC(5,2);

-- Pre-seed display tokens for default classrooms so they work out-of-the-box
UPDATE classrooms
SET 
  display_token = 'dsp_live_lh101_smart_board_token_2026',
  display_token_created_at = NOW(),
  device_name = 'LH-101 86" Interactive Smart Board',
  device_model = 'Promethean ActivPanel 9',
  device_status = 'online'
WHERE room_number = 'LH-101' AND (display_token IS NULL OR display_token = '');

UPDATE classrooms
SET 
  display_token = 'dsp_live_lh204_smart_board_token_2026',
  display_token_created_at = NOW(),
  device_name = 'LH-204 75" Touch Kiosk',
  device_model = 'ViewSonic IFP7550',
  device_status = 'online'
WHERE room_number = 'LH-204' AND (display_token IS NULL OR display_token = '');

UPDATE classrooms
SET 
  display_token = 'dsp_live_cslab3_smart_board_token_2026',
  display_token_created_at = NOW(),
  device_name = 'CS-LAB3 Display Matrix',
  device_model = 'Samsung Flip Pro 85"',
  device_status = 'online'
WHERE room_number = 'CS-LAB3' AND (display_token IS NULL OR display_token = '');


-- ============================================================================
-- 2. PROCEDURE: rpc_start_attendance_session
-- Validates: faculty assignment, room, section, prevents overlaps, generates secret seed
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_start_attendance_session(
  p_timetable_entry_id UUID DEFAULT NULL,
  p_subject_offering_id UUID DEFAULT NULL,
  p_faculty_id UUID DEFAULT NULL,
  p_classroom_id UUID DEFAULT NULL,
  p_section_id UUID DEFAULT NULL,
  p_session_type session_type DEFAULT 'lecture'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_timetable_entry RECORD;
  v_faculty_id UUID := p_faculty_id;
  v_subject_offering_id UUID := p_subject_offering_id;
  v_classroom_id UUID := p_classroom_id;
  v_section_id UUID := p_section_id;
  v_secret_seed VARCHAR(128);
  v_new_session_id UUID;
  v_conflict RECORD;
  v_result JSONB;
BEGIN
  -- 1. If timetable_entry_id is provided, resolve parameters from it
  IF p_timetable_entry_id IS NOT NULL THEN
    SELECT * INTO v_timetable_entry FROM timetable_entries WHERE id = p_timetable_entry_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Timetable entry not found: %', p_timetable_entry_id;
    END IF;
    v_faculty_id := COALESCE(v_faculty_id, v_timetable_entry.faculty_id);
    v_subject_offering_id := COALESCE(v_subject_offering_id, v_timetable_entry.subject_offering_id);
    v_classroom_id := COALESCE(v_classroom_id, v_timetable_entry.classroom_id);
    v_section_id := COALESCE(v_section_id, v_timetable_entry.section_id);
  END IF;

  -- 2. Validate mandatory parameters
  IF v_faculty_id IS NULL OR v_subject_offering_id IS NULL OR v_classroom_id IS NULL OR v_section_id IS NULL THEN
    RAISE EXCEPTION 'Missing required session parameters: faculty, subject offering, classroom, and section are all required.';
  END IF;

  -- 3. Check for conflicting active sessions (Room concurrency)
  SELECT id, classroom_id INTO v_conflict
  FROM attendance_sessions
  WHERE classroom_id = v_classroom_id AND status = 'in_progress'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Classroom is already occupied by an active attendance session (Session ID: %)', v_conflict.id;
  END IF;

  -- 4. Check for conflicting active sessions (Section concurrency)
  SELECT id, section_id INTO v_conflict
  FROM attendance_sessions
  WHERE section_id = v_section_id AND status = 'in_progress'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Section is already attending another active session (Session ID: %)', v_conflict.id;
  END IF;

  -- 5. Check for conflicting active sessions (Faculty concurrency)
  SELECT id, faculty_id INTO v_conflict
  FROM attendance_sessions
  WHERE faculty_id = v_faculty_id AND status = 'in_progress'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Faculty member is already running an active session (Session ID: %)', v_conflict.id;
  END IF;

  -- 6. Generate cryptographically strong random secret seed
  v_secret_seed := encode(gen_random_bytes(32), 'hex');

  -- 7. Insert the new session
  INSERT INTO attendance_sessions (
    timetable_entry_id,
    subject_offering_id,
    faculty_id,
    classroom_id,
    section_id,
    session_date,
    start_time,
    end_time,
    session_type,
    status,
    secret_seed,
    qr_expires_at,
    is_attendance_locked,
    created_at,
    updated_at
  ) VALUES (
    p_timetable_entry_id,
    v_subject_offering_id,
    v_faculty_id,
    v_classroom_id,
    v_section_id,
    CURRENT_DATE,
    CURRENT_TIME,
    CURRENT_TIME + interval '1 hour',
    p_session_type,
    'in_progress',
    v_secret_seed,
    NOW() + interval '2 hours',
    false,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_session_id;

  -- 8. Mark classroom as online and active
  UPDATE classrooms
  SET device_status = 'online', last_ping_at = NOW()
  WHERE id = v_classroom_id;

  -- 9. Emit audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, details)
  VALUES (
    'session_started',
    'attendance_sessions',
    v_new_session_id,
    jsonb_build_object(
      'faculty_id', v_faculty_id,
      'classroom_id', v_classroom_id,
      'section_id', v_section_id,
      'subject_offering_id', v_subject_offering_id,
      'started_at', NOW()
    )
  );

  -- 10. Fetch session response with relations
  SELECT jsonb_build_object(
    'success', true,
    'session_id', s.id,
    'status', s.status,
    'subject_code', sub.code,
    'subject_name', sub.name,
    'section_name', sec.name,
    'room_number', c.room_number,
    'building', c.building,
    'secret_seed', s.secret_seed,
    'start_time', s.start_time,
    'qr_expires_at', s.qr_expires_at
  ) INTO v_result
  FROM attendance_sessions s
  JOIN subject_offerings so ON so.id = s.subject_offering_id
  JOIN subjects sub ON sub.id = so.subject_id
  JOIN sections sec ON sec.id = s.section_id
  JOIN classrooms c ON c.id = s.classroom_id
  WHERE s.id = v_new_session_id;

  RETURN v_result;
END;
$$;


-- ============================================================================
-- 3. PROCEDURE: rpc_submit_qr_attendance
-- High-throughput, idempotent attendance transaction with HMAC verification
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_submit_qr_attendance(
  p_session_id UUID,
  p_student_id UUID,
  p_qr_token VARCHAR,
  p_epoch_window BIGINT,
  p_device_fingerprint VARCHAR DEFAULT NULL,
  p_geo_lat NUMERIC DEFAULT NULL,
  p_geo_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_student RECORD;
  v_expected_message TEXT;
  v_expected_token TEXT;
  v_current_window BIGINT;
  v_window_drift BIGINT;
  v_record_id UUID;
  v_marked_at TIMESTAMPTZ;
  v_existing_record RECORD;
BEGIN
  -- 1. Validate session existence and active state
  SELECT id, classroom_id, section_id, status, is_attendance_locked, secret_seed, qr_expires_at
  INTO v_session
  FROM attendance_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  IF v_session.status != 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is currently ' || v_session.status || '. Only in-progress sessions accept scans.');
  END IF;

  IF v_session.is_attendance_locked = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance is locked for this session.');
  END IF;

  IF v_session.qr_expires_at IS NOT NULL AND NOW() > v_session.qr_expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session QR code window has expired.');
  END IF;

  -- 2. Validate student enrollment in this section
  SELECT id, current_section_id, enrollment_status
  INTO v_student
  FROM students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student record not found');
  END IF;

  IF v_student.enrollment_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student enrollment is not active');
  END IF;

  IF v_student.current_section_id != v_session.section_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student is not enrolled in the section for this session');
  END IF;

  -- 3. Verify cryptographic dynamic QR token (HMAC-SHA256)
  v_expected_message := v_session.id || ':' || v_session.classroom_id || ':' || p_epoch_window;
  v_expected_token := encode(hmac(v_expected_message::bytea, v_session.secret_seed::bytea, 'sha256'), 'hex');

  IF p_qr_token != v_expected_token THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or forged QR token signature');
  END IF;

  -- 4. Verify epoch window drift (15s rotation, max 1 window drift)
  v_current_window := floor(extract(epoch from now()) / 15);
  v_window_drift := abs(v_current_window - p_epoch_window);

  IF v_window_drift > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QR code has expired. Please scan the current live display.');
  END IF;

  -- 5. Insert atomic attendance record with unique constraint protection
  INSERT INTO attendance_records (
    session_id,
    student_id,
    status,
    verification_method,
    marked_at,
    is_finalized,
    device_fingerprint,
    geo_lat,
    geo_lng,
    created_at,
    updated_at
  ) VALUES (
    v_session.id,
    v_student.id,
    'present',
    'dynamic_qr',
    NOW(),
    true,
    p_device_fingerprint,
    p_geo_lat,
    p_geo_lng,
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id, student_id) DO NOTHING
  RETURNING id, marked_at INTO v_record_id, v_marked_at;

  -- If inserted cleanly
  IF v_record_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'present',
      'message', 'Attendance recorded successfully!',
      'record_id', v_record_id,
      'marked_at', v_marked_at
    );
  END IF;

  -- If conflict occurred (duplicate scan by same student in same session), handle idempotently
  SELECT id, status, marked_at INTO v_existing_record
  FROM attendance_records
  WHERE session_id = v_session.id AND student_id = v_student.id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'already_marked',
    'message', 'Attendance has already been recorded for this session.',
    'record_id', v_existing_record.id,
    'marked_at', v_existing_record.marked_at
  );
END;
$$;


-- ============================================================================
-- 4. PROCEDURE: rpc_end_attendance_session
-- Invalidate QR, lock attendance, bulk mark absentees, generate canonical report
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_end_attendance_session(
  p_session_id UUID,
  p_submission_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_total_enrolled INT := 0;
  v_present_count INT := 0;
  v_late_count INT := 0;
  v_excused_count INT := 0;
  v_absent_count INT := 0;
  v_attendance_pct NUMERIC(5,2) := 0.00;
  v_report_id UUID;
  v_faculty_profile_id UUID;
BEGIN
  -- 1. Fetch active session
  SELECT * INTO v_session
  FROM attendance_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  IF v_session.status = 'completed' THEN
    -- Already completed, return existing report
    SELECT id, total_enrolled, present_count, late_count, absent_count, excused_count, attendance_percentage
    INTO v_report_id, v_total_enrolled, v_present_count, v_late_count, v_absent_count, v_excused_count, v_attendance_pct
    FROM attendance_session_reports
    WHERE session_id = p_session_id
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'session_id', p_session_id,
      'status', 'completed',
      'total_enrolled', v_total_enrolled,
      'present_count', v_present_count,
      'absent_count', v_absent_count,
      'late_count', v_late_count,
      'excused_count', v_excused_count,
      'attendance_percentage', v_attendance_pct,
      'report_id', v_report_id
    );
  END IF;

  -- 2. Lock attendance and mark session completed
  UPDATE attendance_sessions
  SET 
    status = 'completed',
    is_attendance_locked = true,
    end_time = CURRENT_TIME,
    qr_expires_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id;

  -- 3. Bulk insert absent records for enrolled students who never scanned
  INSERT INTO attendance_records (
    session_id,
    student_id,
    status,
    verification_method,
    marked_at,
    is_finalized,
    remarks,
    created_at,
    updated_at
  )
  SELECT 
    v_session.id,
    st.id,
    'absent'::attendance_status,
    'manual_faculty'::verification_method,
    NOW(),
    true,
    'Unmarked at session finalization',
    NOW(),
    NOW()
  FROM students st
  WHERE st.current_section_id = v_session.section_id
    AND st.enrollment_status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.session_id = v_session.id AND ar.student_id = st.id
    );

  -- 4. Calculate canonical tallies
  SELECT COUNT(*) INTO v_total_enrolled
  FROM students
  WHERE current_section_id = v_session.section_id AND enrollment_status = 'active';

  SELECT 
    COUNT(CASE WHEN status = 'present' THEN 1 END),
    COUNT(CASE WHEN status = 'late' THEN 1 END),
    COUNT(CASE WHEN status = 'excused' THEN 1 END),
    COUNT(CASE WHEN status = 'absent' THEN 1 END)
  INTO v_present_count, v_late_count, v_excused_count, v_absent_count
  FROM attendance_records
  WHERE session_id = p_session_id;

  IF v_total_enrolled > 0 THEN
    v_attendance_pct := ROUND(((v_present_count + v_late_count + v_excused_count)::NUMERIC / v_total_enrolled::NUMERIC) * 100, 2);
  ELSE
    v_attendance_pct := 100.00;
  END IF;

  -- 5. Upsert attendance session report
  INSERT INTO attendance_session_reports (
    session_id,
    faculty_id,
    total_enrolled,
    present_count,
    late_count,
    excused_count,
    absent_count,
    attendance_percentage,
    submission_notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_session_id,
    v_session.faculty_id,
    v_total_enrolled,
    v_present_count,
    v_late_count,
    v_excused_count,
    v_absent_count,
    v_attendance_pct,
    COALESCE(p_submission_notes, 'Session ended and synchronized by faculty.'),
    'submitted',
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    total_enrolled = EXCLUDED.total_enrolled,
    present_count = EXCLUDED.present_count,
    late_count = EXCLUDED.late_count,
    excused_count = EXCLUDED.excused_count,
    absent_count = EXCLUDED.absent_count,
    attendance_percentage = EXCLUDED.attendance_percentage,
    status = 'submitted',
    updated_at = NOW()
  RETURNING id INTO v_report_id;

  -- 6. Notify faculty
  SELECT profile_id INTO v_faculty_profile_id FROM faculty WHERE id = v_session.faculty_id;
  IF v_faculty_profile_id IS NOT NULL THEN
    INSERT INTO notifications (recipient_id, title, message, type, action_url)
    VALUES (
      v_faculty_profile_id,
      'Attendance Session Finalized',
      'Session attendance closed. ' || v_present_count || '/' || v_total_enrolled || ' present (' || v_attendance_pct || '%). Report submitted to Director.',
      'session_closed',
      '/teacher/reports'
    );
  END IF;

  -- 7. Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, details)
  VALUES (
    'session_finalized',
    'attendance_sessions',
    p_session_id,
    jsonb_build_object(
      'total_enrolled', v_total_enrolled,
      'present_count', v_present_count,
      'absent_count', v_absent_count,
      'attendance_percentage', v_attendance_pct,
      'report_id', v_report_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'completed',
    'total_enrolled', v_total_enrolled,
    'present_count', v_present_count,
    'absent_count', v_absent_count,
    'late_count', v_late_count,
    'excused_count', v_excused_count,
    'attendance_percentage', v_attendance_pct,
    'report_id', v_report_id
  );
END;
$$;


-- ============================================================================
-- 5. PROCEDURE: rpc_get_smart_display_state
-- Secure Smart Board state poller/subscriber. Returns ONLY room/session/QR state.
-- ZERO student PII, ZERO credentials, ZERO service_role keys exposed.
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_get_smart_display_state(
  p_display_token VARCHAR DEFAULT NULL,
  p_classroom_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_classroom RECORD;
  v_session RECORD;
  v_now BIGINT;
  v_epoch_window BIGINT;
  v_qr_token TEXT;
  v_qr_message TEXT;
  v_attendance_count INT := 0;
  v_total_enrolled INT := 0;
  v_recent_ended RECORD;
BEGIN
  -- 1. Identify classroom
  IF p_display_token IS NOT NULL THEN
    SELECT * INTO v_classroom
    FROM classrooms
    WHERE display_token = p_display_token;
  ELSIF p_classroom_id IS NOT NULL THEN
    SELECT * INTO v_classroom
    FROM classrooms
    WHERE id = p_classroom_id;
  END IF;

  IF v_classroom.id IS NULL THEN
    RETURN jsonb_build_object(
      'paired', false,
      'error', 'Display not paired or invalid display token'
    );
  END IF;

  -- 2. Update device heartbeat
  UPDATE classrooms
  SET last_ping_at = NOW(), device_status = 'online'
  WHERE id = v_classroom.id;

  -- 3. Check for active session in this classroom
  SELECT 
    s.id,
    s.subject_offering_id,
    s.section_id,
    s.faculty_id,
    s.start_time,
    s.end_time,
    s.session_type,
    s.secret_seed,
    sub.code AS subject_code,
    sub.name AS subject_name,
    sec.name AS section_name,
    p.first_name || ' ' || p.last_name AS faculty_name
  INTO v_session
  FROM attendance_sessions s
  JOIN subject_offerings so ON so.id = s.subject_offering_id
  JOIN subjects sub ON sub.id = so.subject_id
  JOIN sections sec ON sec.id = s.section_id
  JOIN faculty f ON f.id = s.faculty_id
  JOIN profiles p ON p.id = f.profile_id
  WHERE s.classroom_id = v_classroom.id
    AND s.status = 'in_progress'
    AND s.is_attendance_locked = false
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Case A: Active Session Found -> Return ACTIVE_QR with rotating token
  IF v_session.id IS NOT NULL THEN
    v_now := (extract(epoch from now()) * 1000)::BIGINT;
    v_epoch_window := floor(extract(epoch from now()) / 15);
    v_qr_message := v_session.id || ':' || v_classroom.id || ':' || v_epoch_window;
    v_qr_token := encode(hmac(v_qr_message::bytea, v_session.secret_seed::bytea, 'sha256'), 'hex');

    -- Count marked students
    SELECT COUNT(*) INTO v_attendance_count
    FROM attendance_records
    WHERE session_id = v_session.id AND status IN ('present', 'late');

    -- Count total enrolled in section
    SELECT COUNT(*) INTO v_total_enrolled
    FROM students
    WHERE current_section_id = v_session.section_id AND enrollment_status = 'active';

    RETURN jsonb_build_object(
      'paired', true,
      'classroom_id', v_classroom.id,
      'room_number', v_classroom.room_number,
      'building', v_classroom.building,
      'session_state', 'ACTIVE_QR',
      'active_session', jsonb_build_object(
        'id', v_session.id,
        'subject_code', v_session.subject_code,
        'subject_name', v_session.subject_name,
        'section_name', v_session.section_name,
        'faculty_name', v_session.faculty_name,
        'session_type', v_session.session_type,
        'start_time', v_session.start_time,
        'end_time', v_session.end_time,
        'attendance_count', v_attendance_count,
        'total_enrolled', v_total_enrolled,
        'qr_token', v_qr_token,
        'epoch_window', v_epoch_window,
        'timestamp', v_now,
        'expires_in_seconds', 15 - (extract(epoch from now())::int % 15)
      )
    );
  END IF;

  -- Case B: Check if a session ended within the last 3 minutes in this room
  SELECT 
    s.id,
    sub.code AS subject_code,
    sub.name AS subject_name,
    rep.total_enrolled,
    rep.present_count,
    rep.absent_count,
    rep.attendance_percentage
  INTO v_recent_ended
  FROM attendance_sessions s
  JOIN subject_offerings so ON so.id = s.subject_offering_id
  JOIN subjects sub ON sub.id = so.subject_id
  LEFT JOIN attendance_session_reports rep ON rep.session_id = s.id
  WHERE s.classroom_id = v_classroom.id
    AND s.status = 'completed'
    AND s.updated_at >= NOW() - interval '3 minutes'
  ORDER BY s.updated_at DESC
  LIMIT 1;

  IF v_recent_ended.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'paired', true,
      'classroom_id', v_classroom.id,
      'room_number', v_classroom.room_number,
      'building', v_classroom.building,
      'session_state', 'SESSION_ENDED',
      'ended_session', jsonb_build_object(
        'subject_code', v_recent_ended.subject_code,
        'subject_name', v_recent_ended.subject_name,
        'total_enrolled', COALESCE(v_recent_ended.total_enrolled, 0),
        'present_count', COALESCE(v_recent_ended.present_count, 0),
        'absent_count', COALESCE(v_recent_ended.absent_count, 0),
        'attendance_percentage', COALESCE(v_recent_ended.attendance_percentage, 100.00)
      )
    );
  END IF;

  -- Case C: Default WAITING state
  RETURN jsonb_build_object(
    'paired', true,
    'classroom_id', v_classroom.id,
    'room_number', v_classroom.room_number,
    'building', v_classroom.building,
    'session_state', 'WAITING',
    'device_name', v_classroom.device_name,
    'status', v_classroom.device_status
  );
END;
$$;


-- ============================================================================
-- 6. PROCEDURES: Device Management (Pair, Revoke, Rotate, Ping)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_pair_display_device(
  p_pairing_code VARCHAR,
  p_device_identifier VARCHAR DEFAULT NULL,
  p_device_name VARCHAR DEFAULT NULL,
  p_device_model VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_classroom RECORD;
  v_token VARCHAR(128);
BEGIN
  -- 1. Find classroom by pairing code
  SELECT * INTO v_classroom
  FROM classrooms
  WHERE UPPER(device_pairing_code) = UPPER(TRIM(p_pairing_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid classroom pairing code.');
  END IF;

  -- 2. Generate new display token
  v_token := 'dsp_' || encode(gen_random_bytes(24), 'hex');

  -- 3. Update classroom
  UPDATE classrooms
  SET 
    display_token = v_token,
    display_token_created_at = NOW(),
    device_status = 'online',
    device_identifier = COALESCE(p_device_identifier, 'SmartBoard-' || v_classroom.room_number),
    device_name = COALESCE(p_device_name, v_classroom.room_number || ' Display Panel'),
    device_model = COALESCE(p_device_model, 'Interactive Smart Board'),
    last_ping_at = NOW()
  WHERE id = v_classroom.id;

  -- 4. Record in pairing records
  INSERT INTO device_pairing_records (
    classroom_id,
    pairing_code,
    device_identifier,
    paired_at,
    expires_at,
    is_active
  ) VALUES (
    v_classroom.id,
    UPPER(TRIM(p_pairing_code)),
    COALESCE(p_device_identifier, 'SmartBoard-' || v_classroom.room_number),
    NOW(),
    NOW() + interval '1 year',
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'display_token', v_token,
    'classroom_id', v_classroom.id,
    'room_number', v_classroom.room_number,
    'building', v_classroom.building
  );
END;
$$;

CREATE OR REPLACE FUNCTION rpc_revoke_display_device(
  p_classroom_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE classrooms
  SET 
    display_token = NULL,
    device_status = 'unpaired',
    device_identifier = NULL
  WHERE id = p_classroom_id;

  UPDATE device_pairing_records
  SET is_active = false
  WHERE classroom_id = p_classroom_id;

  RETURN jsonb_build_object('success', true, 'message', 'Display paired credentials revoked successfully');
END;
$$;

CREATE OR REPLACE FUNCTION rpc_rotate_display_credentials(
  p_classroom_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_pairing_code VARCHAR(10);
  v_new_token VARCHAR(128);
BEGIN
  -- Generate new readable pairing code (e.g. "LH-8472")
  v_new_pairing_code := UPPER(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  v_new_token := 'dsp_' || encode(gen_random_bytes(24), 'hex');

  UPDATE classrooms
  SET 
    device_pairing_code = v_new_pairing_code,
    display_token = v_new_token,
    display_token_created_at = NOW(),
    updated_at = NOW()
  WHERE id = p_classroom_id;

  RETURN jsonb_build_object(
    'success', true,
    'pairing_code', v_new_pairing_code,
    'display_token', v_new_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION rpc_ping_display_device(
  p_display_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE classrooms
  SET last_ping_at = NOW(), device_status = 'online'
  WHERE display_token = p_display_token
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid display token');
  END IF;

  RETURN jsonb_build_object('success', true, 'classroom_id', v_id, 'pinged_at', NOW());
END;
$$;

