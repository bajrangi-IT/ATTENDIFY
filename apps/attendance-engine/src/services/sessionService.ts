import { supabaseAdmin, executeRpc } from '../db/client.js';
import { cacheManager } from '../redis/cache.js';

export interface StartSessionParams {
  timetableEntryId?: string;
  subjectOfferingId?: string;
  facultyId?: string;
  classroomId?: string;
  sectionId?: string;
  sessionType?: 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'extra_class';
  callerUserId?: string;
}

export interface SessionResult {
  success: boolean;
  sessionId?: string;
  status?: string;
  subjectCode?: string;
  subjectName?: string;
  sectionName?: string;
  roomNumber?: string;
  building?: string;
  secretSeed?: string;
  startTime?: string;
  qrExpiresAt?: string;
  error?: string;
}

export class SessionService {
  /**
   * Starts an attendance session with comprehensive multi-level validation:
   * faculty assignment, classroom availability, section availability, timetable, and terms.
   */
  public static async startSession(params: StartSessionParams): Promise<SessionResult> {
    // 1. If callerUserId is present, resolve faculty ID and verify permissions
    let facultyId = params.facultyId;
    if (params.callerUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('user_id', params.callerUserId)
        .single();

      if (!profile || !['faculty', 'hod', 'director', 'super_admin'].includes(profile.role)) {
        return { success: false, error: 'Unauthorized: Only faculty and academic deans can initiate sessions.' };
      }

      if (profile.role === 'faculty' && !facultyId) {
        const { data: fac } = await supabaseAdmin
          .from('faculty')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        if (fac) facultyId = fac.id;
      }
    }

    // 2. Call PostgreSQL transactional stored procedure (enforcing strict room/section/faculty uniqueness)
    const { data, error } = await executeRpc<any>('rpc_start_attendance_session', {
      p_timetable_entry_id: params.timetableEntryId || null,
      p_subject_offering_id: params.subjectOfferingId || null,
      p_faculty_id: facultyId || null,
      p_classroom_id: params.classroomId || null,
      p_section_id: params.sectionId || null,
      p_session_type: params.sessionType || 'lecture',
    });

    if (error || !data || !data.success) {
      const msg = error ? (error.message || JSON.stringify(error)) : (data?.error || 'Failed to start session');
      return { success: false, error: msg };
    }

    // 3. Count total enrolled students in section for cache pre-warming
    const { count: enrolledCount } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('current_section_id', params.sectionId)
      .eq('enrollment_status', 'active');

    // 4. Pre-warm Redis session cache
    await cacheManager.setSessionMeta(data.session_id, {
      id: data.session_id,
      classroomId: params.classroomId!,
      sectionId: params.sectionId!,
      facultyId: facultyId || '',
      status: 'in_progress',
      secretSeed: data.secret_seed,
      qrExpiresAt: data.qr_expires_at,
      isAttendanceLocked: false,
      totalEnrolled: enrolledCount || 0,
    });

    // Initialize Redis live session counter to 0
    await cacheManager.setSessionCount(data.session_id, 0);

    return {
      success: true,
      sessionId: data.session_id,
      status: data.status,
      subjectCode: data.subject_code,
      subjectName: data.subject_name,
      sectionName: data.section_name,
      roomNumber: data.room_number,
      building: data.building,
      secretSeed: data.secret_seed,
      startTime: data.start_time,
      qrExpiresAt: data.qr_expires_at,
    };
  }

  /**
   * Finalizes an attendance session:
   * Locks attendance, invalidates QR, bulk marks absentees, computes statistics, and notifies director.
   */
  public static async endSession(sessionId: string, notes?: string): Promise<any> {
    // 1. Execute transactional stored procedure in PostgreSQL
    const { data, error } = await executeRpc<any>('rpc_end_attendance_session', {
      p_session_id: sessionId,
      p_submission_notes: notes || null,
    });

    if (error || !data || !data.success) {
      return {
        success: false,
        error: error ? error.message : (data?.error || 'Failed to finalize session'),
      };
    }

    // 2. Invalidate / clear Redis cache for this session
    await cacheManager.invalidateSession(sessionId);

    return data;
  }

  /**
   * Fetches active session details with cache fallback
   */
  public static async getActiveSession(sessionId: string): Promise<any> {
    // Try Redis cache first
    const cached = await cacheManager.getSessionMeta(sessionId);
    if (cached) return cached;

    // Fallback to database
    const { data: session } = await supabaseAdmin
      .from('attendance_sessions')
      .select('*, classrooms(room_number, building), sections(name), subject_offerings(subjects(code, name))')
      .eq('id', sessionId)
      .single();

    return session;
  }
}
