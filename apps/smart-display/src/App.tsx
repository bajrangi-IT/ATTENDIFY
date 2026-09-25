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
  QrCode as QrIcon,
  Tv,
  KeyRound,
  LogOut,
  Building,
  GraduationCap,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Supabase public client for smart board (Uses ONLY unprivileged anon key)
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

export default function SmartDisplayApp() {
  const [displayToken, setDisplayToken] = useState<string>(() => {
    return localStorage.getItem('campusattend_display_token') || 'dsp_live_lh101_smart_board_token_2026';
  });
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll classroom display state via unprivileged RPC
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
          setSessionState(data.session_state);

          if (data.session_state === 'ACTIVE_QR' && data.active_session) {
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
            const ended = data.ended_session;
            setEndedSession({
              subjectCode: ended.subject_code,
              subjectName: ended.subject_name,
              totalEnrolled: ended.total_enrolled,
              presentCount: ended.present_count,
              absentCount: ended.absent_count,
              attendancePercentage: ended.attendance_percentage,
            });
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
    const code = codeToUse || pairingCodeInput.trim();
    if (!code) return;

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
        setPairingError(error?.message || data?.error || 'Invalid classroom pairing code');
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

  // -------------------------------------------------------------
  // VIEW 1: UNPAIRED DEVICE REGISTRATION
  // -------------------------------------------------------------
  if (!displayToken) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-8 sm:p-16 select-none font-sans">
        <header className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                CampusAttend OS
                <span className="text-xs bg-indigo-500/20 text-indigo-400 font-mono font-medium px-2 py-0.5 rounded border border-indigo-500/30">
                  SMART DISPLAY KIÓSK
                </span>
              </h1>
              <p className="text-sm text-slate-400">Classroom Device Registration & Provisioning</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <span className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              Campus Mesh Connected
            </span>
            <span className="font-mono text-slate-300">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto w-full my-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 text-indigo-400">
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Pair Classroom Smart Board</h2>
            <p className="text-slate-400 text-sm">
              Enter the 6-character room pairing code provisioned in the IT Admin Fleet Console.
            </p>
          </div>

          {pairingError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{pairingError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Classroom Pairing Code
              </label>
              <input
                type="text"
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. LH101X"
                maxLength={10}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-4 text-center text-3xl font-mono tracking-widest text-white uppercase focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
              />
            </div>

            <button
              onClick={() => handlePairDevice()}
              disabled={isPairingLoading || !pairingCodeInput.trim()}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isPairingLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Authenticating Device...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Pair Smart Board Display
                </>
              )}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center mb-3">Or quick-pair for demo classrooms:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePairDevice('LH101X')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 flex flex-col items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="font-bold text-white">LH-101</span>
                <span className="text-slate-400">LH101X</span>
              </button>
              <button
                onClick={() => handlePairDevice('TRG204')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 flex flex-col items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="font-bold text-white">LH-204</span>
                <span className="text-slate-400">TRG204</span>
              </button>
              <button
                onClick={() => handlePairDevice('CSL003')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 flex flex-col items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="font-bold text-white">CS-LAB3</span>
                <span className="text-slate-400">CSL003</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-600">
          CampusAttend OS Device Daemon • Zero-Credential Classroom Display Protocol
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: PAIRED SMART DISPLAY (WAITING, ACTIVE_QR, SESSION_ENDED)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden font-sans">
      {/* Top Bar Header */}
      <header className="flex justify-between items-center border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/10">
            <Building className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-white">{roomNumber}</h1>
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE & SYNCED
              </span>
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{building}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Device ID: {classroomId.substring(0, 8)}</span>
            </p>
          </div>
        </div>

        {/* Live Clock & Fullscreen Button */}
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-400" />
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Display Options"
          >
            <KeyRound className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* IT Admin Quick Drawer */}
      {showAdminMenu && (
        <div className="fixed top-24 right-10 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl">
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
              className="w-full mt-3 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Unpair Smart Board
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          STATE A: ACTIVE_QR (Faculty started lecture)
      ------------------------------------------------------------- */}
      {sessionState === 'ACTIVE_QR' && activeSession ? (
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
          {/* Left Column: Lecture Meta & Headcount */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-sm font-semibold">
              <Sparkles className="w-4 h-4" />
              LIVE LECTURE IN PROGRESS
            </div>

            <div>
              <h2 className="text-5xl font-black text-white tracking-tight leading-tight">
                {activeSession.subjectCode}: {activeSession.subjectName}
              </h2>
              <p className="text-xl text-slate-400 mt-2 font-medium">
                {activeSession.sectionName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Instructor
                </span>
                <span className="text-lg font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                  {activeSession.facultyName}
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Scheduled Time
                </span>
                <span className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  {activeSession.startTime?.substring(0, 5)} - {activeSession.endTime?.substring(0, 5)}
                </span>
              </div>
            </div>

            {/* Live Headcount Progress Bar */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 space-y-3 shadow-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Real-time Attendance Headcount</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {activeSession.attendanceCount} / {activeSession.totalEnrolled || 60}
                  <span className="text-xs text-slate-400 font-sans ml-2 font-normal">present</span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400 rounded-full transition-all duration-700 shadow-lg shadow-emerald-500/20"
                  style={{
                    width: `${Math.min(100, ((activeSession.attendanceCount / (activeSession.totalEnrolled || 1)) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>Scan QR with CampusAttend Mobile App</span>
                <span>
                  {Math.round(((activeSession.attendanceCount / (activeSession.totalEnrolled || 1)) * 100))}% Enrolled
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Visibility Dynamic QR Box */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative p-6 sm:p-8 bg-white rounded-3xl shadow-2xl border-4 border-indigo-500/40 flex flex-col items-center">
              {/* Rotating Canvas */}
              <canvas ref={canvasRef} className="rounded-xl shadow-md" />

              {/* Dynamic countdown ring */}
              <div className="mt-5 w-full flex items-center justify-between px-2 pt-2 border-t border-slate-200 text-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                  <RefreshCw className={`w-4 h-4 text-indigo-600 ${secondsRemaining <= 3 ? 'animate-spin' : ''}`} />
                  ROTATING TOKEN
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                  <span className="text-slate-500">Expires in:</span>
                  <span className={`px-2 py-0.5 rounded text-sm ${secondsRemaining <= 3 ? 'bg-rose-100 text-rose-600 font-black' : 'bg-indigo-50 text-indigo-700'}`}>
                    {secondsRemaining}s
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400 font-mono text-center flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographically Signed • 15s Anti-Proxy Epoch
            </p>
          </div>
        </main>
      ) : sessionState === 'SESSION_ENDED' && endedSession ? (
        /* -------------------------------------------------------------
           STATE B: SESSION_ENDED (Teacher concluded session)
        ------------------------------------------------------------- */
        <main className="max-w-3xl mx-auto w-full my-auto text-center space-y-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-10 shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-4xl font-black text-white">Lecture Attendance Concluded</h2>
            <p className="text-lg text-slate-400 mt-2">
              {endedSession.subjectCode}: {endedSession.subjectName}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Enrolled</span>
              <span className="text-3xl font-black font-mono text-white">{endedSession.totalEnrolled}</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs uppercase tracking-wider text-emerald-500 block mb-1">Present</span>
              <span className="text-3xl font-black font-mono text-emerald-400">{endedSession.presentCount}</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs uppercase tracking-wider text-rose-500 block mb-1">Absent</span>
              <span className="text-3xl font-black font-mono text-rose-400">{endedSession.absentCount}</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs uppercase tracking-wider text-indigo-400 block mb-1">Attendance</span>
              <span className="text-3xl font-black font-mono text-indigo-400">{endedSession.attendancePercentage}%</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Finalized session report transmitted to Teacher and Dean of Academics. Returning to idle shortly...
          </p>
        </main>
      ) : (
        /* -------------------------------------------------------------
           STATE C: WAITING (Classroom is idle)
        ------------------------------------------------------------- */
        <main className="max-w-2xl mx-auto w-full my-auto text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
            <Tv className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Classroom Display Ready</h2>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              Waiting for faculty to begin their scheduled lecture session from the Web Portal or Mobile App.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 max-w-md mx-auto text-left space-y-2 text-sm text-slate-300">
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
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Listening for Lectures
              </span>
            </div>
          </div>
        </main>
      )}

      {/* Bottom Status Bar */}
      <footer className="flex justify-between items-center border-t border-slate-800/80 pt-6 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Zero-Trust Device Guard Active
          </span>
          <span>•</span>
          <span>No Teacher Login Required on Board</span>
        </div>
        <div className="font-mono text-slate-400">
          CampusAttend OS • Classroom Node
        </div>
      </footer>
    </div>
  );
}
