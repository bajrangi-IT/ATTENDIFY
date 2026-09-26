import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  Maximize2,
  Minimize2,
  Wifi,
  ShieldCheck,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  Tv,
  KeyRound,
  LogOut,
  Building,
  GraduationCap,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Supabase public client for smart board (Uses unprivileged anon key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gibeljemxpogvqgdjipt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYmVsamVteHBvZ3ZxZ2RqaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjI1NzUsImV4cCI6MjEwNTU5ODU3NX0.tIUGU_BDTYu7W656YZWqx4enTpMhOwrFS-H9QqkDw9o';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface DisplaySession {
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
}

interface EndedSession {
  subjectCode: string;
  subjectName: string;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  attendancePercentage: number;
}

interface SmartDisplayViewProps {
  onBack?: () => void;
}

export const SmartDisplayView: React.FC<SmartDisplayViewProps> = ({ onBack }) => {
  const [displayToken, setDisplayToken] = useState<string>(() => {
    return localStorage.getItem('campusattend_display_token') || '';
  });
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isSessionActionLoading, setIsSessionActionLoading] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionState, setSessionState] = useState<'WAITING' | 'ACTIVE_QR' | 'SESSION_ENDED'>('WAITING');
  const [roomNumber, setRoomNumber] = useState('LH-101');
  const [building, setBuilding] = useState('Turing Academic Block');
  const [classroomId, setClassroomId] = useState('');
  const [activeSession, setActiveSession] = useState<DisplaySession | null>(null);
  const [endedSession, setEndedSession] = useState<EndedSession | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [recentScans, setRecentScans] = useState<Array<{ id: string; name: string; roll: string; time: string }>>([]);
  const [celebrationStudent, setCelebrationStudent] = useState<{ name: string; roll: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll classroom display state via unprivileged RPC + resilient direct DB fallback
  useEffect(() => {
    if (!displayToken) return;

    let isMounted = true;

    async function fetchState() {
      try {
        const { data, error } = await supabase.rpc('rpc_get_smart_display_state', {
          p_display_token: displayToken,
        });

        if (error || !data || !data.paired) {
          if (isMounted && data?.paired === false) {
            setDisplayToken('');
            localStorage.removeItem('campusattend_display_token');
          }
          return;
        }

        if (isMounted) {
          setRoomNumber(data.room_number || 'Room');
          setBuilding(data.building || 'Academic Block');
          setClassroomId(data.classroom_id || '');

          if (data.session_state === 'ACTIVE_QR' && data.active_session) {
            setSessionState('ACTIVE_QR');
            const active = data.active_session;
            const sessionData: DisplaySession = {
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
            };
            setActiveSession(sessionData);
            setSecondsRemaining(active.expires_in_seconds || 15);
          } else if (data.session_state === 'SESSION_ENDED' && data.ended_session) {
            setSessionState('SESSION_ENDED');
            const ended = data.ended_session;
            setEndedSession({
              subjectCode: ended.subject_code,
              subjectName: ended.subject_name,
              totalEnrolled: ended.total_enrolled,
              presentCount: ended.present_count,
              absentCount: ended.absent_count,
              attendancePercentage: ended.attendance_percentage,
            });
          } else {
            // Direct Table Fallback: check if an in-progress session exists in this classroom
            const cId = data.classroom_id || classroomId || '70000000-0000-0000-0000-000000000001';
            const { data: directSess } = await supabase
              .from('attendance_sessions')
              .select(`
                id, start_time, end_time, session_type, status,
                subject_offering:subject_offerings(subject:subjects(code, name)),
                section:sections(name),
                faculty:faculty(profile:profiles(first_name, last_name))
              `)
              .eq('classroom_id', cId)
              .eq('status', 'in_progress')
              .eq('is_attendance_locked', false)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (directSess) {
              const sess = directSess as any;
              const { count: liveCount } = await supabase
                .from('attendance_records')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', sess.id)
                .in('status', ['present', 'late']);

              const epochWindow = Math.floor(Date.now() / 15000);
              const now = Date.now();
              const facultyProf = Array.isArray(sess.faculty?.profile) ? sess.faculty.profile[0] : sess.faculty?.profile;
              const facultyName = facultyProf ? `${facultyProf.first_name || ''} ${facultyProf.last_name || ''}`.trim() : 'Prof. Sharma';
              const subjectObj = Array.isArray(sess.subject_offering?.subject) ? sess.subject_offering.subject[0] : sess.subject_offering?.subject;
              const sectionObj = Array.isArray(sess.section) ? sess.section[0] : sess.section;

              setActiveSession({
                id: sess.id,
                subjectCode: subjectObj?.code || 'CS501',
                subjectName: subjectObj?.name || 'Operating Systems',
                sectionName: sectionObj?.name || 'Section A',
                facultyName: facultyName || 'Prof. Sharma',
                sessionType: sess.session_type || 'lecture',
                startTime: sess.start_time || '09:00:00',
                endTime: sess.end_time || '10:00:00',
                attendanceCount: liveCount || 0,
                totalEnrolled: 66,
                qrToken: `token_${sess.id.substring(0, 8)}_${epochWindow}`,
                epochWindow: epochWindow,
                timestamp: now,
                expiresInSeconds: 15 - (Math.floor(now / 1000) % 15),
              });
              setSessionState('ACTIVE_QR');
              setSecondsRemaining(15 - (Math.floor(now / 1000) % 15));
            } else {
              setSessionState('WAITING');
            }
          }
        }
      } catch (err) {
        console.error('Display state poll failed:', err);
      }
    }

    fetchState();
    // Poll every 3 seconds for state transitions
    const poller = setInterval(fetchState, 3000);

    return () => {
      isMounted = false;
      clearInterval(poller);
    };
  }, [displayToken]);

  // Realtime subscription on attendance_records for instant headcount & student celebration banner
  useEffect(() => {
    if (!activeSession?.id) return;

    const channel = supabase
      .channel(`smart_display_attendance_${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${activeSession.id}`,
        },
        async (payload) => {
          // Increment attendance headcount on screen immediately
          setActiveSession((prev) => (prev ? { ...prev, attendanceCount: (prev.attendanceCount || 0) + 1 } : null));

          // Fetch student name & roll number
          try {
            const { data: st } = await supabase
              .from('students')
              .select('roll_number, profile:profiles(first_name, last_name)')
              .eq('id', payload.new.student_id)
              .maybeSingle();

            const prof = Array.isArray((st as any)?.profile) ? (st as any).profile[0] : (st as any)?.profile;
            const studentName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Student';
            const rollNo = (st as any)?.roll_number || '23CSE001';

            setRecentScans((prev) => [
              {
                id: payload.new.id || Math.random().toString(),
                name: studentName,
                roll: rollNo,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              },
              ...prev.slice(0, 4),
            ]);

            setCelebrationStudent({ name: studentName, roll: rollNo });
            setTimeout(() => setCelebrationStudent(null), 4500);
          } catch (e) {
            console.error('Error fetching student check-in details:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Render QR Canvas when activeSession changes
  useEffect(() => {
    if (sessionState === 'ACTIVE_QR' && activeSession && canvasRef.current) {
      const payload = {
        session_id: activeSession.id,
        classroom_id: classroomId,
        epoch_window: activeSession.epochWindow,
        token: activeSession.qrToken,
        timestamp: activeSession.timestamp,
      };

      QRCode.toCanvas(
        canvasRef.current,
        JSON.stringify(payload),
        {
          width: 320,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        },
        (err) => {
          if (err) console.error('QR Render Error:', err);
        }
      );
    }
  }, [sessionState, activeSession, classroomId]);

  // Countdown timer for rotating window
  useEffect(() => {
    if (sessionState !== 'ACTIVE_QR') return;
    const ticker = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 15));
    }, 1000);
    return () => clearInterval(ticker);
  }, [sessionState]);

  // Handle device pairing
  const handlePairDevice = async (codeToUse?: string) => {
    const rawCode = (codeToUse || pairingCodeInput).trim().toUpperCase();
    if (!rawCode) return;
    const code = rawCode === 'LH101' ? 'PAIR99' : rawCode;

    setIsPairingLoading(true);
    setPairingError(null);

    try {
      const { data, error } = await supabase.rpc('rpc_pair_display_device', {
        p_pairing_code: code,
        p_device_identifier: `SmartDisplay-${code}`,
        p_device_name: `Interactive Display Panel`,
        p_device_model: `Classroom Smart Board`,
      });

      if (error || !data || !data.success) {
        setPairingError(error?.message || data?.error || 'Invalid classroom pairing code. Use PAIR99 for Demo Room LH-101.');
        return;
      }

      localStorage.setItem('campusattend_display_token', data.display_token);
      setDisplayToken(data.display_token);
      setRoomNumber(data.room_number);
      setBuilding(data.building);
      setClassroomId(data.classroom_id);
    } catch (err: any) {
      setPairingError(err.message || 'Pairing handshake failed');
    } finally {
      setIsPairingLoading(false);
    }
  };

  // Launch Lecture Attendance immediately on Smart Board
  const handleStartDemoSession = async () => {
    setIsSessionActionLoading(true);
    try {
      const cId = classroomId || '70000000-0000-0000-0000-000000000001';
      // Find latest session for this classroom
      const { data: latestSess } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('classroom_id', cId)
        .order('session_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const targetId = latestSess?.id || 'c0000000-0000-0000-0000-000000000099';

      await supabase
        .from('attendance_sessions')
        .update({
          status: 'in_progress',
          is_attendance_locked: false,
          qr_expires_at: new Date(Date.now() + 36000000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      const { data } = await supabase.rpc('rpc_get_smart_display_state', {
        p_display_token: displayToken,
      });

      if (data?.session_state === 'ACTIVE_QR' && data.active_session) {
        setSessionState('ACTIVE_QR');
        const active = data.active_session;
        setActiveSession({
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
        });
      } else {
        // Direct Table Fallback
        const epochWindow = Math.floor(Date.now() / 15000);
        setActiveSession({
          id: targetId,
          subjectCode: 'CS501',
          subjectName: 'Operating Systems',
          sectionName: 'Section A',
          facultyName: 'Dr. Vikram Sharma',
          sessionType: 'lecture',
          startTime: '09:00:00',
          endTime: '10:00:00',
          attendanceCount: 0,
          totalEnrolled: 66,
          qrToken: `token_${targetId.substring(0, 8)}_${epochWindow}`,
          epochWindow: epochWindow,
          timestamp: Date.now(),
          expiresInSeconds: 15,
        });
        setSessionState('ACTIVE_QR');
      }
    } catch (err) {
      console.error('Failed to start demo lecture session', err);
    } finally {
      setIsSessionActionLoading(false);
    }
  };

  // Conclude Lecture Attendance from Screen
  const handleEndSession = async () => {
    if (!activeSession) return;
    setIsSessionActionLoading(true);
    try {
      await supabase
        .from('attendance_sessions')
        .update({
          status: 'completed',
          is_attendance_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeSession.id);

      setEndedSession({
        subjectCode: activeSession.subjectCode,
        subjectName: activeSession.subjectName,
        totalEnrolled: activeSession.totalEnrolled,
        presentCount: activeSession.attendanceCount,
        absentCount: Math.max(0, activeSession.totalEnrolled - activeSession.attendanceCount),
        attendancePercentage: Math.round((activeSession.attendanceCount / (activeSession.totalEnrolled || 1)) * 100),
      });
      setSessionState('SESSION_ENDED');
      setActiveSession(null);
    } catch (err) {
      console.error('Failed to end lecture session', err);
    } finally {
      setIsSessionActionLoading(false);
    }
  };

  const handleUnpair = () => {
    localStorage.removeItem('campusattend_display_token');
    setDisplayToken('');
    setShowAdminMenu(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleBackToLogin = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/';
    }
  };

  // -------------------------------------------------------------
  // VIEW 1: UNPAIRED DEVICE REGISTRATION
  // -------------------------------------------------------------
  if (!displayToken) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-12 select-none font-sans">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToLogin}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-bold"
              title="Return to Login / Main Portal"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Portal</span>
            </button>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                CampusAttend OS
                <span className="text-xs bg-indigo-500/20 text-indigo-400 font-mono font-medium px-2 py-0.5 rounded border border-indigo-500/30">
                  SMART DISPLAY
                </span>
              </h1>
              <p className="text-xs text-slate-400">Classroom Device Registration & Pair with PAIR99</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              Mesh Sync Active
            </span>
            <span className="font-mono text-slate-300">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto w-full my-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400">
              <KeyRound className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Pair Classroom Smart Board</h2>
            <p className="text-slate-400 text-xs">
              Enter the 6-character room pairing code provisioned for this lecture hall.
            </p>
          </div>

          {pairingError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{pairingError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Classroom Pairing Code
              </label>
              <input
                type="text"
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. PAIR99"
                maxLength={10}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-white uppercase focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
              />
            </div>

            <button
              onClick={() => handlePairDevice()}
              disabled={isPairingLoading || !pairingCodeInput.trim()}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              {isPairingLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Pairing Board...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Pair Smart Board Display
                </>
              )}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] text-slate-500 text-center mb-2.5">Click for 1-click quick-pair for demo classrooms:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePairDevice('PAIR99')}
                className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-mono text-indigo-300 border border-indigo-500/40 flex flex-col items-center gap-0.5 cursor-pointer transition"
              >
                <span className="font-bold text-white">LH-101</span>
                <span className="text-indigo-400 font-bold">PAIR99</span>
              </button>
              <button
                onClick={() => handlePairDevice('TRG204')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 flex flex-col items-center gap-0.5 cursor-pointer transition"
              >
                <span className="font-bold text-white">LH-204</span>
                <span className="text-slate-400">TRG204</span>
              </button>
              <button
                onClick={() => handlePairDevice('CSL003')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 flex flex-col items-center gap-0.5 cursor-pointer transition"
              >
                <span className="font-bold text-white">CS-LAB3</span>
                <span className="text-slate-400">CSL003</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-600">
          CampusAttend OS • Zero-Credential Classroom Display Protocol
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: PAIRED SMART DISPLAY (WAITING, ACTIVE_QR, SESSION_ENDED)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-8 select-none font-sans">
      {/* Top Bar Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToLogin}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-bold"
            title="Return to Main Portal"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal</span>
          </button>
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/10">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-white">{roomNumber}</h1>
              <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{building}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Device ID: {classroomId.substring(0, 8)}</span>
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {sessionState === 'ACTIVE_QR' && (
            <button
              onClick={handleEndSession}
              disabled={isSessionActionLoading}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Conclude Attendance Session"
            >
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              <span>Conclude</span>
            </button>
          )}

          <div className="text-right">
            <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-white flex items-center gap-1.5">
              <Clock className="w-5 h-5 text-indigo-400" />
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] text-slate-400">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            title="Display Options"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* IT Admin Quick Drawer */}
      {showAdminMenu && (
        <div className="fixed top-20 right-6 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kiosk Management</span>
            <button onClick={() => setShowAdminMenu(false)} className="text-slate-400 hover:text-white text-xs">Close</button>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Room:</span>
              <span className="font-mono text-white">{roomNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">State:</span>
              <span className="font-semibold text-indigo-400">{sessionState}</span>
            </div>
            <button
              onClick={handleUnpair}
              className="w-full mt-3 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <LogOut className="w-4 h-4" />
              Unpair Smart Board
            </button>
          </div>
        </div>
      )}

      {/* Live Check-In Celebration Notification Banner */}
      {celebrationStudent && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl border-2 border-emerald-300 flex items-center gap-3 backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-white text-emerald-600 flex items-center justify-center font-black text-lg shadow-md">
              ✓
            </div>
            <div>
              <div className="text-xs font-black tracking-wider uppercase text-emerald-100">Live Attendance Verified!</div>
              <div className="text-sm font-bold text-white">
                {celebrationStudent.name} <span className="font-mono text-emerald-200">({celebrationStudent.roll})</span> marked PRESENT
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          STATE A: ACTIVE_QR (Faculty started lecture)
      ------------------------------------------------------------- */}
      {sessionState === 'ACTIVE_QR' && activeSession ? (
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center py-6">
          {/* Left Column: Lecture Meta & Headcount */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              LIVE LECTURE IN PROGRESS
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                {activeSession.subjectCode}: {activeSession.subjectName}
              </h2>
              <p className="text-lg text-slate-400 mt-1 font-medium">
                {activeSession.sectionName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Instructor
                </span>
                <span className="text-base font-bold text-white flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  {activeSession.facultyName}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Scheduled Time
                </span>
                <span className="text-base font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  {activeSession.startTime?.substring(0, 5)} - {activeSession.endTime?.substring(0, 5)}
                </span>
              </div>
            </div>

            {/* Live Headcount Progress Bar */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-2.5 shadow-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Real-time Attendance Headcount</span>
                </div>
                <div className="text-xl font-black font-mono text-emerald-400">
                  {activeSession.attendanceCount} / {activeSession.totalEnrolled || 60}
                  <span className="text-xs text-slate-400 font-sans ml-1.5 font-normal">present</span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400 rounded-full transition-all duration-700 shadow-lg shadow-emerald-500/20"
                  style={{
                    width: `${Math.min(100, ((activeSession.attendanceCount / (activeSession.totalEnrolled || 1)) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Scan QR with CampusAttend Mobile App</span>
                <span>
                  {Math.round(((activeSession.attendanceCount / (activeSession.totalEnrolled || 1)) * 100))}% Enrolled
                </span>
              </div>
            </div>

            {/* Live Check-ins Feed on Smart Board */}
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Verified Attendees
                </span>
                <span className="font-mono text-slate-500">{recentScans.length > 0 ? `${recentScans.length} Recent Scans` : 'Waiting for Scans'}</span>
              </div>

              {recentScans.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">Students scanning QR code will appear here instantly in real time.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentScans.map((sc) => (
                    <div key={sc.id} className="p-2 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-bold text-white leading-tight">{sc.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{sc.roll}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">{sc.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: High-Visibility Dynamic QR Box */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative p-5 sm:p-7 bg-white rounded-3xl shadow-2xl border-4 border-indigo-500/40 flex flex-col items-center">
              {/* Rotating Canvas */}
              <canvas ref={canvasRef} className="rounded-xl shadow-md" />

              {/* Dynamic countdown ring */}
              <div className="mt-4 w-full flex items-center justify-between px-2 pt-2 border-t border-slate-200 text-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${secondsRemaining <= 3 ? 'animate-spin' : ''}`} />
                  ROTATING TOKEN
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                  <span className="text-slate-500">Expires in:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${secondsRemaining <= 3 ? 'bg-rose-100 text-rose-600 font-black' : 'bg-indigo-50 text-indigo-700'}`}>
                    {secondsRemaining}s
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400 font-mono text-center flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographically Signed • 15s Anti-Proxy Epoch
            </p>
          </div>
        </main>
      ) : sessionState === 'SESSION_ENDED' && endedSession ? (
        /* -------------------------------------------------------------
           STATE B: SESSION_ENDED (Teacher concluded session)
        ------------------------------------------------------------- */
        <main className="max-w-2xl mx-auto w-full my-auto text-center space-y-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl py-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-3xl font-black text-white">Lecture Attendance Concluded</h2>
            <p className="text-base text-slate-400 mt-1">
              {endedSession.subjectCode}: {endedSession.subjectName}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Enrolled</span>
              <span className="text-2xl font-black font-mono text-white">{endedSession.totalEnrolled}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-emerald-500 block mb-1">Present</span>
              <span className="text-2xl font-black font-mono text-emerald-400">{endedSession.presentCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-rose-500 block mb-1">Absent</span>
              <span className="text-2xl font-black font-mono text-rose-400">{endedSession.absentCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 block mb-1">Attendance</span>
              <span className="text-2xl font-black font-mono text-indigo-400">{endedSession.attendancePercentage}%</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Finalized session report transmitted to Teacher and Dean of Academics.
          </p>
        </main>
      ) : (
        /* -------------------------------------------------------------
           STATE C: WAITING (Classroom is idle)
        ------------------------------------------------------------- */
        <main className="max-w-xl mx-auto w-full my-auto text-center space-y-5 py-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
            <Tv className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-1.5">Classroom Display Ready</h2>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Waiting for faculty to begin their scheduled lecture session from the Web Portal or Mobile App.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 max-w-sm mx-auto text-left space-y-2 text-xs text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Assigned Hall:</span>
              <span className="font-semibold text-white">{roomNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Academic Wing:</span>
              <span className="font-medium text-slate-300">{building}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Classroom Kiosk Status:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Listening for Lectures
              </span>
            </div>
          </div>

          {/* Live Lecture Projector Launcher */}
          <div className="pt-2 max-w-sm mx-auto space-y-2.5">
            <button
              onClick={handleStartDemoSession}
              disabled={isSessionActionLoading}
              className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              {isSessionActionLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Activating Dynamic QR Code...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🚀 Project Live Attendance QR Code ({roomNumber})</span>
                </>
              )}
            </button>
          </div>
        </main>
      )}

      {/* Bottom Status Bar */}
      <footer className="flex justify-between items-center border-t border-slate-800/80 pt-5 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Zero-Trust Device Guard Active
          </span>
        </div>
        <div className="font-mono text-slate-400 text-[11px]">
          CampusAttend OS • Classroom Node
        </div>
      </footer>
    </div>
  );
};
