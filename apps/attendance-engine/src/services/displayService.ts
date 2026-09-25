import { supabaseAdmin, executeRpc } from '../db/client.js';

export interface DisplayStateResponse {
  paired: boolean;
  classroomId?: string;
  roomNumber?: string;
  building?: string;
  sessionState?: 'WAITING' | 'ACTIVE_QR' | 'SESSION_ENDED';
  deviceName?: string;
  status?: string;
  activeSession?: {
    id: string;
    subjectCode: string;
    subjectName: string;
    sectionName: string;
    facultyName: string;
    sessionType: string;
    startTime: string;
    endTime: string;
    attendanceCount: number;
    totalEnrolled: number;
    qrToken: string;
    epochWindow: number;
    timestamp: number;
    expiresInSeconds: number;
  };
  endedSession?: {
    subjectCode: string;
    subjectName: string;
    totalEnrolled: number;
    presentCount: number;
    absentCount: number;
    attendancePercentage: number;
  };
  error?: string;
}

export class DisplayService {
  /**
   * Fetches unprivileged smart display state for classroom.
   * Strips all student PII, credentials, and seeds.
   */
  public static async getDisplayState(displayToken?: string, classroomId?: string): Promise<DisplayStateResponse> {
    const { data, error } = await executeRpc<any>('rpc_get_smart_display_state', {
      p_display_token: displayToken || null,
      p_classroom_id: classroomId || null,
    });

    if (error || !data) {
      return {
        paired: false,
        error: error ? error.message : 'Classroom display not found or unpaired',
      };
    }

    if (!data.paired) {
      return {
        paired: false,
        error: data.error || 'Display not paired',
      };
    }

    if (data.session_state === 'ACTIVE_QR') {
      const active = data.active_session;
      return {
        paired: true,
        classroomId: data.classroom_id,
        roomNumber: data.room_number,
        building: data.building,
        sessionState: 'ACTIVE_QR',
        activeSession: {
          id: active.id,
          subjectCode: active.subject_code,
          subjectName: active.subject_name,
          sectionName: active.section_name,
          facultyName: active.faculty_name,
          sessionType: active.session_type,
          startTime: active.start_time,
          endTime: active.end_time,
          attendanceCount: active.attendance_count,
          totalEnrolled: active.total_enrolled,
          qrToken: active.qr_token,
          epochWindow: active.epoch_window,
          timestamp: active.timestamp,
          expiresInSeconds: active.expires_in_seconds,
        },
      };
    }

    if (data.session_state === 'SESSION_ENDED') {
      const ended = data.ended_session;
      return {
        paired: true,
        classroomId: data.classroom_id,
        roomNumber: data.room_number,
        building: data.building,
        sessionState: 'SESSION_ENDED',
        endedSession: {
          subjectCode: ended.subject_code,
          subjectName: ended.subject_name,
          totalEnrolled: ended.total_enrolled,
          presentCount: ended.present_count,
          absentCount: ended.absent_count,
          attendancePercentage: ended.attendance_percentage,
        },
      };
    }

    return {
      paired: true,
      classroomId: data.classroom_id,
      roomNumber: data.room_number,
      building: data.building,
      sessionState: 'WAITING',
      deviceName: data.device_name,
      status: data.status,
    };
  }

  /**
   * Device pairing handshake: IT Admin or Display enters 6-character code
   */
  public static async pairDevice(pairingCode: string, identifier?: string, name?: string, model?: string): Promise<any> {
    const { data, error } = await executeRpc<any>('rpc_pair_display_device', {
      p_pairing_code: pairingCode,
      p_device_identifier: identifier || null,
      p_device_name: name || null,
      p_device_model: model || null,
    });

    if (error || !data || !data.success) {
      return {
        success: false,
        error: error ? error.message : (data?.error || 'Pairing failed'),
      };
    }

    return data;
  }

  /**
   * IT Admin revokes a display pairing
   */
  public static async revokeDevice(classroomId: string): Promise<any> {
    const { data, error } = await executeRpc<any>('rpc_revoke_display_device', {
      p_classroom_id: classroomId,
    });

    if (error || !data) {
      return { success: false, error: error?.message || 'Revocation failed' };
    }
    return data;
  }

  /**
   * IT Admin rotates credentials for a classroom display
   */
  public static async rotateCredentials(classroomId: string): Promise<any> {
    const { data, error } = await executeRpc<any>('rpc_rotate_display_credentials', {
      p_classroom_id: classroomId,
    });

    if (error || !data) {
      return { success: false, error: error?.message || 'Credential rotation failed' };
    }
    return data;
  }

  /**
   * Heartbeat ping from smart display
   */
  public static async pingDevice(displayToken: string): Promise<any> {
    const { data, error } = await executeRpc<any>('rpc_ping_display_device', {
      p_display_token: displayToken,
    });
    return data || { success: false, error: error?.message };
  }

  /**
   * IT Admin Device Fleet Management list
   */
  public static async getFleet(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('classrooms')
      .select('id, room_number, building, floor, capacity, device_pairing_code, device_status, device_identifier, device_name, device_model, display_token, last_ping_at, is_active')
      .order('room_number', { ascending: true });

    if (error || !data) return [];

    const now = Date.now();
    return data.map((d: any) => {
      // Determine if offline based on last_ping_at > 2 minutes
      const lastPing = d.last_ping_at ? new Date(d.last_ping_at).getTime() : 0;
      const isActuallyOnline = d.display_token && (now - lastPing < 120000);

      return {
        id: d.id,
        roomNumber: d.room_number,
        building: d.building,
        capacity: d.capacity,
        pairingCode: d.device_pairing_code,
        status: !d.display_token ? 'unpaired' : (isActuallyOnline ? 'online' : 'offline'),
        deviceName: d.device_name || `${d.room_number} Smart Board`,
        deviceModel: d.device_model || 'Interactive Kiosk',
        identifier: d.device_identifier,
        lastSeen: d.last_ping_at,
        isPaired: !!d.display_token,
      };
    });
  }

  /**
   * IT Admin updates / renames display device
   */
  public static async updateDevice(classroomId: string, updates: { deviceName?: string; deviceModel?: string; roomNumber?: string }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('classrooms')
      .update({
        device_name: updates.deviceName,
        device_model: updates.deviceModel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', classroomId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }
}
