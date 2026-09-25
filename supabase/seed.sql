-- ============================================================================
-- CAMPUSATTEND OS - PRODUCTION DEMO SEED DATA
-- Database Seed: supabase/seed.sql
-- ============================================================================

-- Clean slate for seed re-runnability
TRUNCATE TABLE 
  notifications,
  audit_logs,
  leave_applications,
  attendance_adjustment_requests,
  attendance_records,
  attendance_sessions,
  timetable_exceptions,
  timetable_entries,
  device_pairing_records,
  classrooms,
  faculty_assignments,
  subject_offerings,
  subjects,
  faculty,
  enrollment_history,
  students,
  sections,
  semesters,
  programs,
  academic_terms,
  academic_years,
  departments,
  campuses,
  attendance_policies,
  profiles,
  institutions
CASCADE;

-- 1. INSTITUTIONS & CAMPUS
INSERT INTO institutions (id, name, code, timezone, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'Apex Institute of Technology & Science', 'AITS', 'Asia/Kolkata', true);

INSERT INTO campuses (id, institution_id, name, code, address) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Main Academic Campus', 'MAC', '42 Innovation Parkway, Tech District');

-- 2. ATTENDANCE POLICY
INSERT INTO attendance_policies (id, institution_id, min_attendance_percentage, warning_threshold, critical_threshold, late_grace_period_mins, consecutive_absenteeism_alert) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 75.00, 80.00, 75.00, 10, 3);

-- 3. PROFILES FOR KEY ROLES
-- Passwords in Auth would map to these users.
INSERT INTO profiles (id, institution_id, email, first_name, last_name, role, is_active) VALUES
-- Super Admin
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin@campusattend.edu', 'Sarah', 'Jenkins', 'super_admin', true),
-- Director
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'director@campusattend.edu', 'Robert', 'Vance', 'director', true),
-- IT Admin
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'itadmin@campusattend.edu', 'Alex', 'Mercer', 'it_admin', true),
-- HOD Computer Science
('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'hod.cse@campusattend.edu', 'Aris', 'Thorne', 'hod', true),
-- Faculty: Prof. Vikram Sharma (OS Instructor)
('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'vikram.sharma@campusattend.edu', 'Vikram', 'Sharma', 'faculty', true),
-- Faculty: Dr. Priya Nair (DBMS Instructor)
('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'priya.nair@campusattend.edu', 'Priya', 'Nair', 'faculty', true),
-- Students:
('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'aarav.patel@student.campusattend.edu', 'Aarav', 'Patel', 'student', true),
('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'ananya.iyer@student.campusattend.edu', 'Ananya', 'Iyer', 'student', true),
('30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'rohan.gupta@student.campusattend.edu', 'Rohan', 'Gupta', 'student', true),
('30000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'diya.sen@student.campusattend.edu', 'Diya', 'Sen', 'student', true),
('30000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'kabir.verma@student.campusattend.edu', 'Kabir', 'Verma', 'student', true);

-- 4. DEPARTMENTS
INSERT INTO departments (id, institution_id, name, code, hod_id) VALUES
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Department of Computer Science & Engineering', 'CSE', '30000000-0000-0000-0000-000000000004'),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Department of Electronics & Communication', 'ECE', NULL),
('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Department of Mechanical Engineering', 'MECH', NULL);

-- 5. ACADEMIC YEARS & TERMS
INSERT INTO academic_years (id, institution_id, name, start_date, end_date, is_current) VALUES
('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2025-2026', '2025-08-01', '2026-06-30', true);

INSERT INTO academic_terms (id, academic_year_id, name, start_date, end_date, is_active) VALUES
('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Odd Semester (Fall 2025)', '2025-08-01', '2025-12-20', true);

-- 6. PROGRAMS, SEMESTERS & SECTIONS
INSERT INTO programs (id, department_id, name, code, degree_level, duration_semesters) VALUES
('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'B.Tech in Computer Science & Engineering', 'BTECH-CSE', 'undergraduate', 8);

INSERT INTO semesters (id, program_id, academic_year_id, semester_number, is_active) VALUES
('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 5, true);

INSERT INTO sections (id, semester_id, name, capacity) VALUES
('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'Section A', 60),
('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 'Section B', 60);

-- 7. CLASSROOMS & DISPLAY DEVICES
INSERT INTO classrooms (id, campus_id, room_number, building, floor, capacity, device_pairing_code, device_status, is_active) VALUES
('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'LH-101', 'Turing Academic Block', 1, 65, 'LH101X', 'online', true),
('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'LH-204', 'Turing Academic Block', 2, 60, 'TRG204', 'online', true),
('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'CS-LAB3', 'Computing Center', 3, 45, 'CSL003', 'online', true);

-- 8. FACULTY
INSERT INTO faculty (id, profile_id, institution_id, department_id, employee_code, designation) VALUES
('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'EMP-CSE-001', 'Professor & Head of Department'),
('80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'EMP-CSE-014', 'Associate Professor'),
('80000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'EMP-CSE-019', 'Assistant Professor');

-- 9. STUDENTS
INSERT INTO students (id, profile_id, institution_id, roll_number, registration_number, current_section_id, batch_year) VALUES
('90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '23CSE001', 'REG-2023-CS-001', '62000000-0000-0000-0000-000000000001', 2023),
('90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '23CSE002', 'REG-2023-CS-002', '62000000-0000-0000-0000-000000000001', 2023),
('90000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '23CSE003', 'REG-2023-CS-003', '62000000-0000-0000-0000-000000000001', 2023),
('90000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '23CSE004', 'REG-2023-CS-004', '62000000-0000-0000-0000-000000000001', 2023),
('90000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '23CSE005', 'REG-2023-CS-005', '62000000-0000-0000-0000-000000000001', 2023);

-- 10. SUBJECTS & OFFERINGS
INSERT INTO subjects (id, department_id, name, code, credits, subject_type) VALUES
('A0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Operating Systems', 'CS501', 4, 'theory'),
('A0000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Database Management Systems', 'CS502', 4, 'theory'),
('A0000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Design & Analysis of Algorithms', 'CS503', 4, 'theory');

INSERT INTO subject_offerings (id, subject_id, semester_id, academic_year_id, is_active) VALUES
('A1000000-0000-0000-0000-000000000001', 'A0000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', true),
('A1000000-0000-0000-0000-000000000002', 'A0000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', true);

INSERT INTO faculty_assignments (id, faculty_id, subject_offering_id, section_id, is_primary) VALUES
('A2000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'A1000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', true),
('A2000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', true);

-- 11. TIMETABLE
INSERT INTO timetable_entries (id, subject_offering_id, faculty_id, classroom_id, section_id, day_of_week, start_time, end_time) VALUES
('B0000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 1, '09:00:00', '10:00:00'),
('B0000000-0000-0000-0000-000000000002', 'A1000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 1, '10:15:00', '11:15:00'),
('B0000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 3, '09:00:00', '10:00:00');

-- 12. ATTENDANCE SESSIONS (Past sessions + 1 active today + 1 cancelled)
INSERT INTO attendance_sessions (id, timetable_entry_id, subject_offering_id, faculty_id, classroom_id, section_id, session_date, start_time, end_time, session_type, status, secret_seed, is_attendance_locked) VALUES
-- Past finalized sessions for CS501
('C0000000-0000-0000-0000-000000000001', 'B0000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '14 days', '09:00:00', '10:00:00', 'lecture', 'completed', 'seed_cs501_session_1_secret_seed_key', true),
('C0000000-0000-0000-0000-000000000002', 'B0000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '12 days', '09:00:00', '10:00:00', 'lecture', 'completed', 'seed_cs501_session_2_secret_seed_key', true),
('C0000000-0000-0000-0000-000000000003', 'B0000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '7 days', '09:00:00', '10:00:00', 'lecture', 'completed', 'seed_cs501_session_3_secret_seed_key', true),
('C0000000-0000-0000-0000-000000000004', 'B0000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '5 days', '09:00:00', '10:00:00', 'lecture', 'completed', 'seed_cs501_session_4_secret_seed_key', true),

-- Cancelled session (to prove rule: CANCELLED sessions are NEVER counted!)
('C0000000-0000-0000-0000-000000000005', 'B0000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '2 days', '09:00:00', '10:00:00', 'lecture', 'cancelled', 'seed_cs501_cancelled_session', false),

-- LIVE ACTIVE SESSION FOR TODAY (Ready for smart display & mobile testing!)
('C0000000-0000-0000-0000-000000000099', 'B0000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', CURRENT_DATE, '09:00:00', '10:00:00', 'lecture', 'in_progress', 'live_demo_dynamic_qr_seed_key_2026', false);

-- 13. CANONICAL ATTENDANCE RECORDS (Past finalized sessions)
-- Student 1 (Aarav Patel): Attended all 4 sessions (100% in CS501)
INSERT INTO attendance_records (session_id, student_id, status, verification_method, marked_at, is_finalized) VALUES
('C0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'present', 'dynamic_qr', NOW() - INTERVAL '14 days', true),
('C0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'present', 'dynamic_qr', NOW() - INTERVAL '12 days', true),
('C0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', 'present', 'dynamic_qr', NOW() - INTERVAL '7 days', true),
('C0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'present', 'dynamic_qr', NOW() - INTERVAL '5 days', true);

-- Student 2 (Ananya Iyer): Attended 3 out of 4 (75% - Warning threshold)
INSERT INTO attendance_records (session_id, student_id, status, verification_method, marked_at, is_finalized) VALUES
('C0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'present', 'dynamic_qr', NOW() - INTERVAL '14 days', true),
('C0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'present', 'dynamic_qr', NOW() - INTERVAL '12 days', true),
('C0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'absent', 'manual_faculty', NOW() - INTERVAL '7 days', true),
('C0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', 'present', 'dynamic_qr', NOW() - INTERVAL '5 days', true);

-- Student 3 (Rohan Gupta): Attended 2 out of 4 (50% - Critical Shortage!)
INSERT INTO attendance_records (session_id, student_id, status, verification_method, marked_at, is_finalized) VALUES
('C0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 'present', 'dynamic_qr', NOW() - INTERVAL '14 days', true),
('C0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', 'absent', 'manual_faculty', NOW() - INTERVAL '12 days', true),
('C0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', 'absent', 'manual_faculty', NOW() - INTERVAL '7 days', true),
('C0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 'present', 'dynamic_qr', NOW() - INTERVAL '5 days', true);

-- Student 4 (Diya Sen): 3 present, 1 late (treated as attended per policy)
INSERT INTO attendance_records (session_id, student_id, status, verification_method, marked_at, is_finalized) VALUES
('C0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', 'present', 'dynamic_qr', NOW() - INTERVAL '14 days', true),
('C0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000004', 'late', 'dynamic_qr', NOW() - INTERVAL '12 days', true),
('C0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004', 'present', 'dynamic_qr', NOW() - INTERVAL '7 days', true),
('C0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000004', 'present', 'dynamic_qr', NOW() - INTERVAL '5 days', true);

-- Student 5 (Kabir Verma): 3 present, 1 excused (medical certificate approved)
INSERT INTO attendance_records (session_id, student_id, status, verification_method, marked_at, is_finalized, remarks) VALUES
('C0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', 'present', 'dynamic_qr', NOW() - INTERVAL '14 days', true, NULL),
('C0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000005', 'present', 'dynamic_qr', NOW() - INTERVAL '12 days', true, NULL),
('C0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000005', 'excused', 'leave_override', NOW() - INTERVAL '7 days', true, 'Approved medical leave ref #MED-2025-042'),
('C0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000005', 'present', 'dynamic_qr', NOW() - INTERVAL '5 days', true, NULL);

-- 14. SAMPLE LEAVE & ADJUSTMENT REQUESTS
INSERT INTO leave_applications (id, student_id, start_date, end_date, reason, leave_type, status, approved_by) VALUES
('D0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE - INTERVAL '6 days', 'Viral flu with physician bed rest advisory', 'medical', 'approved', '30000000-0000-0000-0000-000000000004'),
('D0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '4 days', 'Inter-collegiate Hackathon at National Institute', 'academic_duty', 'pending', NULL);

INSERT INTO attendance_adjustment_requests (id, student_id, session_id, requested_status, reason, status) VALUES
('E0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 'C0000000-0000-0000-0000-000000000003', 'excused', 'Was representing college at the regional robotics tournament', 'pending');
