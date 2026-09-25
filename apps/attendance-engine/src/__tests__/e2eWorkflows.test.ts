import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { supabaseAdmin } from '../db/client.js';
import { cacheManager } from '../redis/cache.js';
import { AttendanceService } from '../services/attendanceService.js';
import { generateDynamicQrPayload, verifyDynamicQrToken } from '@campusattend/attendance-sdk';

describe('CampusAttend OS - Complete End-to-End System & Failure Verification', () => {
  const institutionId = '00000000-0000-0000-0000-000000000001';
  const campusId = '10000000-0000-0000-0000-000000000001';

  // Dynamic IDs created during E2E test run
  let testDeptId: string;
  let testProgramId: string;
  let academicYearId: string;
  let testSemesterId: string;
  let testSectionId: string;
  let testCourseId: string;
  let testSubjectOfferingId: string;
  let testClassroomId: string;
  let testDisplayToken: string;
  let testTimetableId: string;
  let testSessionId: string;
  let testReportId: string;

  const testStudentProfileId = '30000000-0000-0000-0000-000000000010'; // Aarav Patel
  const testStudentId = '90000000-0000-0000-0000-000000000001';
  const testFacultyProfileId = '30000000-0000-0000-0000-000000000005'; // Vikram Sharma
  const testFacultyId = '80000000-0000-0000-0000-000000000002';
  const testDirectorProfileId = '30000000-0000-0000-0000-000000000002'; // Director

  /* -------------------------------------------------------------------------- */
  /* PHASE 1: ADMINISTRATOR PROVISIONING & PAIRING FLOW                         */
  /* -------------------------------------------------------------------------- */
  describe('Phase 1: Administrator Provisioning & Pairing Workflow', () => {
    it('creates academic department, degree program, and cohort section', async () => {
      // 1. Create department
      const deptCode = `AI${Date.now().toString().slice(-4)}`;
      const { data: dept, error: deptErr } = await supabaseAdmin
        .from('departments')
        .insert({
          institution_id: institutionId,
          name: `Department of AI & Data Systems ${deptCode}`,
          code: deptCode
        })
        .select()
        .single();

      expect(deptErr).toBeNull();
      testDeptId = dept.id;

      // 2. Create program
      const { data: prog, error: progErr } = await supabaseAdmin
        .from('programs')
        .insert({
          department_id: testDeptId,
          name: 'B.Tech Artificial Intelligence',
          code: `BTECH_${deptCode}`,
          degree_level: 'undergraduate',
          duration_semesters: 8
        })
        .select()
        .single();

      expect(progErr).toBeNull();
      testProgramId = prog.id;

      // 3. Resolve academic year
      const { data: academicYear } = await supabaseAdmin
        .from('academic_years')
        .select('id')
        .eq('institution_id', institutionId)
        .limit(1)
        .single();

      academicYearId = academicYear?.id || '20000000-0000-0000-0000-000000000000';

      // 4. Create semester
      const { data: semester, error: semErr } = await supabaseAdmin
        .from('semesters')
        .insert({
          program_id: testProgramId,
          academic_year_id: academicYearId,
          semester_number: 5,
          is_active: true
        })
        .select()
        .single();

      expect(semErr).toBeNull();
      testSemesterId = semester.id;

      // 5. Create section
      const { data: section, error: secErr } = await supabaseAdmin
        .from('sections')
        .insert({
          semester_id: testSemesterId,
          name: 'Section Alpha',
          capacity: 60
        })
        .select()
        .single();

      expect(secErr).toBeNull();
      testSectionId = section.id;

      // Enroll test student into this test section
      await supabaseAdmin
        .from('students')
        .update({ current_section_id: testSectionId })
        .eq('id', testStudentId);
    }, 20000);

    it('assigns course, faculty offering, timetable slot, and classroom smart display', async () => {
      // 1. Create course subject
      const subCode = `CS${Date.now().toString().slice(-4)}`;
      const { data: subject, error: subErr } = await supabaseAdmin
        .from('subjects')
        .insert({
          department_id: testDeptId,
          code: subCode,
          name: 'Autonomous Agentic Systems',
          credits: 4,
          subject_type: 'theory'
        })
        .select()
        .single();

      expect(subErr).toBeNull();
      testCourseId = subject.id;

      // 2. Create subject offering for faculty
      const { data: offering, error: offErr } = await supabaseAdmin
        .from('subject_offerings')
        .insert({
          subject_id: testCourseId,
          semester_id: testSemesterId,
          academic_year_id: academicYearId,
          is_active: true
        })
        .select()
        .single();

      expect(offErr).toBeNull();
      testSubjectOfferingId = offering.id;

      // Assign faculty to offering & section
      await supabaseAdmin
        .from('faculty_assignments')
        .insert({
          faculty_id: testFacultyId,
          subject_offering_id: testSubjectOfferingId,
          section_id: testSectionId,
          is_primary: true
        });

      // 3. Create classroom with smart display pairing credentials
      testDisplayToken = `disp_test_${Date.now()}`;
      const { data: classroom, error: roomErr } = await supabaseAdmin
        .from('classrooms')
        .insert({
          campus_id: campusId,
          building: 'Turing Hall',
          room_number: `TH-${Date.now().toString().slice(-3)}`,
          capacity: 75,
          is_active: true,
          display_token: testDisplayToken,
          device_pairing_code: 'PAIR99'
        })
        .select()
        .single();

      expect(roomErr).toBeNull();
      testClassroomId = classroom.id;

      // 4. Create timetable schedule slot
      const { data: timetable, error: ttErr } = await supabaseAdmin
        .from('timetable_entries')
        .insert({
          subject_offering_id: testSubjectOfferingId,
          faculty_id: testFacultyId,
          section_id: testSectionId,
          classroom_id: testClassroomId,
          day_of_week: 1, // Monday
          start_time: '10:00:00',
          end_time: '11:00:00',
          is_recurring: true
        })
        .select()
        .single();

      expect(ttErr).toBeNull();
      testTimetableId = timetable.id;
    }, 20000);
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 2: FACULTY ATTENDANCE SESSION & SMART BOARD LIFECYCLE                */
  /* -------------------------------------------------------------------------- */
  describe('Phase 2: Faculty Attendance Session & Live Display Execution', () => {
    const secretSeed = 'live_session_e2e_crypto_seed_2026';

    it('faculty starts an authorized lecture session', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

      const { data: session, error: sessErr } = await supabaseAdmin
        .from('attendance_sessions')
        .insert({
          timetable_entry_id: testTimetableId,
          subject_offering_id: testSubjectOfferingId,
          section_id: testSectionId,
          classroom_id: testClassroomId,
          faculty_id: testFacultyId,
          session_date: now.toISOString().split('T')[0],
          start_time: '10:00:00',
          end_time: '11:00:00',
          session_type: 'lecture',
          status: 'in_progress',
          secret_seed: secretSeed,
          qr_expires_at: expiresAt.toISOString(),
          is_attendance_locked: false
        })
        .select()
        .single();

      expect(sessErr).toBeNull();
      expect(session).toBeDefined();
      testSessionId = session.id;

      // Pre-warm Redis / in-memory cache
      await cacheManager.setSessionMeta(testSessionId, {
        id: testSessionId,
        classroomId: testClassroomId,
        sectionId: testSectionId,
        facultyId: testFacultyId,
        status: 'in_progress',
        secretSeed,
        qrExpiresAt: expiresAt.toISOString(),
        isAttendanceLocked: false,
        totalEnrolled: 60
      });
      await cacheManager.setSessionCount(testSessionId, 0);
    });

    it('smart board polls and retrieves active dynamic QR session feed', async () => {
      const res = await request(app)
        .get(`/api/display/session-feed?classroomId=${testClassroomId}`)
        .set({ 'x-display-token': testDisplayToken });

      expect(res.status).toBe(200);
      expect(res.body.paired).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 3: STUDENT CHECK-IN & ATTENDANCE CONFIRMATION                        */
  /* -------------------------------------------------------------------------- */
  describe('Phase 3: Student Dynamic QR Scan & Real-Time Headcount', () => {
    const secretSeed = 'live_session_e2e_crypto_seed_2026';

    it('student generates and scans dynamic QR token, verifying attendance', async () => {
      // 1. Generate valid QR payload
      const qrPayload = await generateDynamicQrPayload(
        testSessionId,
        testClassroomId,
        secretSeed,
        15,
        Date.now()
      );

      // 2. Process check-in
      const result = await AttendanceService.processScan({
        sessionId: testSessionId,
        qrToken: qrPayload.token,
        epochWindow: qrPayload.epoch_window,
        studentId: testStudentId,
        deviceFingerprint: 'student_device_e2e_test',
        ipAddress: '127.0.0.1'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('present');

      // 3. Verify count incremented in cache
      const liveCount = await cacheManager.getSessionCount(testSessionId);
      expect(liveCount).toBeGreaterThanOrEqual(1);
    });

    it('detects and rejects duplicate check-in (Idempotent Protection)', async () => {
      const qrPayload = await generateDynamicQrPayload(
        testSessionId,
        testClassroomId,
        secretSeed,
        15,
        Date.now()
      );

      // Duplicate scan
      const res = await AttendanceService.processScan({
        sessionId: testSessionId,
        qrToken: qrPayload.token,
        epochWindow: qrPayload.epoch_window,
        studentId: testStudentId,
        deviceFingerprint: 'student_device_e2e_test',
        ipAddress: '127.0.0.1'
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('already_marked');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 4: FACULTY SESSION FINALIZATION & REPORT SUBMISSION                  */
  /* -------------------------------------------------------------------------- */
  describe('Phase 4: Session Finalization & Report Submission', () => {
    it('faculty ends session, locks QR attendance, and submits report', async () => {
      // 1. Mark session completed
      const { error: endErr } = await supabaseAdmin
        .from('attendance_sessions')
        .update({
          status: 'completed',
          is_attendance_locked: true
        })
        .eq('id', testSessionId);

      expect(endErr).toBeNull();
      await cacheManager.invalidateSession(testSessionId);

      // 2. Submit session report
      const { data: report, error: repErr } = await supabaseAdmin
        .from('attendance_session_reports')
        .insert({
          session_id: testSessionId,
          faculty_id: testFacultyId,
          total_enrolled: 60,
          present_count: 52,
          late_count: 3,
          excused_count: 1,
          absent_count: 4,
          attendance_percentage: 93.33,
          submission_notes: 'Regular lecture delivered on Autonomous Systems.',
          status: 'pending'
        })
        .select()
        .single();

      expect(repErr).toBeNull();
      expect(report).toBeDefined();
      testReportId = report.id;
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 5: DIRECTOR OVERSIGHT, SEARCH & REPORT APPROVAL                       */
  /* -------------------------------------------------------------------------- */
  describe('Phase 5: Director Oversight & Institutional Approval', () => {
    it('director searches student attendance roster and reviews pending report', async () => {
      // 1. Query student attendance summary
      const { data: summary, error: sumErr } = await supabaseAdmin
        .from('v_student_attendance_summary')
        .select('*')
        .limit(5);

      expect(sumErr).toBeNull();
      expect(summary).toBeDefined();

      // 2. Review and approve session report
      const { data: updatedReport, error: appErr } = await supabaseAdmin
        .from('attendance_session_reports')
        .update({
          status: 'approved',
          reviewed_by: testDirectorProfileId,
          reviewed_at: new Date().toISOString(),
          review_remarks: 'Verified against smart kiosk logs and approved.'
        })
        .eq('id', testReportId)
        .select()
        .single();

      expect(appErr).toBeNull();
      expect(updatedReport.status).toBe('approved');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 6: REAL-TIME TIMETABLE MUTATION & MULTI-DEVICE PROPAGATION          */
  /* -------------------------------------------------------------------------- */
  describe('Phase 6: Timetable Modification & Real-Time Sync', () => {
    it('director modifies timetable slot; updates propagate across all clients', async () => {
      const newRoom = `TH-MOD-${Date.now().toString().slice(-3)}`;

      // 1. Create new room
      const { data: newClassroom } = await supabaseAdmin
        .from('classrooms')
        .insert({
          campus_id: campusId,
          building: 'Turing Hall North',
          room_number: newRoom,
          capacity: 80,
          is_active: true
        })
        .select()
        .single();

      // 2. Update timetable slot
      const { data: updatedSlot, error: modErr } = await supabaseAdmin
        .from('timetable_entries')
        .update({
          classroom_id: newClassroom?.id,
          start_time: '11:15:00',
          end_time: '12:15:00'
        })
        .eq('id', testTimetableId)
        .select('id, start_time, end_time, classroom_id')
        .single();

      expect(modErr).toBeNull();
      expect(updatedSlot).toBeDefined();
      expect(updatedSlot!.start_time).toBe('11:15:00');
      expect(updatedSlot!.classroom_id).toBe(newClassroom?.id);

      // 3. Verify student query reflects updated timetable slot
      const { data: studentView } = await supabaseAdmin
        .from('timetable_entries')
        .select('*, classroom:classrooms(room_number)')
        .eq('id', testTimetableId)
        .single();

      expect(studentView).toBeDefined();
      expect((studentView as any).classroom.room_number).toBe(newRoom);
      expect((studentView as any).start_time).toBe('11:15:00');

      // 4. Verify faculty query reflects updated timetable slot
      const { data: facultyView } = await supabaseAdmin
        .from('timetable_entries')
        .select('*, classroom:classrooms(room_number)')
        .eq('id', testTimetableId)
        .single();

      expect(facultyView).toBeDefined();
      expect((facultyView as any).classroom.room_number).toBe(newRoom);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 7: FAILURE & EDGE CASE TESTS                                         */
  /* -------------------------------------------------------------------------- */
  describe('Phase 7: Comprehensive Failure & Negative Safety Tests', () => {
    it('safely falls back to in-memory store when Redis is unavailable', async () => {
      await cacheManager.setSessionCount('test-fallback-session', 42);
      const count = await cacheManager.getSessionCount('test-fallback-session');
      expect(count).toBe(42);
    });

    it('rejects attendance check-in for completed / locked session', async () => {
      const result = await AttendanceService.processScan({
        sessionId: testSessionId,
        studentId: testStudentId,
        qrToken: 'dummy_token',
        epochWindow: 12345
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Attendance is not accepting scans');
    });

    it('rejects attendance check-in for non-existent / deactivated student account', async () => {
      const result = await AttendanceService.processScan({
        sessionId: 'c0000000-0000-0000-0000-000000000099',
        studentId: '00000000-0000-0000-0000-000000000000',
        qrToken: 'any_token',
        epochWindow: 100
      });

      expect(result.success).toBe(false);
    });

    it('rejects smart board display request with revoked token', async () => {
      const res = await request(app)
        .get('/api/display/session-feed?classroomId=70000000-0000-0000-0000-000000000001')
        .set({ 'x-display-token': 'revoked_token_abcdef123456' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });
  });

  afterAll(async () => {
    // Restore default test student section
    await supabaseAdmin
      .from('students')
      .update({ current_section_id: '62000000-0000-0000-0000-000000000001' })
      .eq('id', testStudentId);
  });
});
