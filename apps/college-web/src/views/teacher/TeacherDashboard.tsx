import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  BookOpen,
  Calendar,
  Clock,
  Radio,
  Users,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  TrendingUp,
  UserCheck,
  BarChart3
} from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { ManualAttendanceModal, ManualAttendancePreload } from '../../components/ManualAttendanceModal';
import { formatSectionShortBadge } from '../../lib/academicLabels';

interface TeacherDashboardProps {
  onNavigateToSession?: (sessionId?: string) => void;
  onNavigateToTimetable?: () => void;
  onNavigateToReports?: () => void;
}

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

const formatTime12 = (t: string) => {
  if (!t) return '';
  const parts = t.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${m} ${period}`;
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onNavigateToSession,
  onNavigateToTimetable,
  onNavigateToReports,
}) => {
  const { facultyRecord, profile, institution } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<number>(() => {
    const jsDay = new Date().getDay();
    return jsDay >= 1 && jsDay <= 6 ? jsDay : 1;
  });
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualModalPreload, setManualModalPreload] = useState<ManualAttendancePreload | null>(null);

  const [coordinatedSection, setCoordinatedSection] = useState<any | null>(null);
  const [coordinatedStudentsCount, setCoordinatedStudentsCount] = useState<number>(0);
  const [stats, setStats] = useState({
    totalClassesHeld: 0,
    averageAttendanceRate: 0,
    studentsAtRisk: 0,
    activeSessionId: null as string | null,
  });

  const loadTeacherData = async () => {
    setLoading(true);
    try {
        // 1. Fetch faculty assignments
        let aQuery = supabase
          .from('faculty_assignments')
          .select(`
            id, is_primary,
            section:sections(id, name, semester:semesters(semester_number, program:programs(name, code))),
            subject_offering:subject_offerings(id, subject:subjects(id, name, code, credits))
          `);

        if (facultyRecord?.id) {
          aQuery = aQuery.eq('faculty_id', facultyRecord.id);
        }

        const { data: assignments, error: aErr } = await aQuery;

        if (aErr) throw aErr;
        setAssignedSubjects(assignments || []);

        // 2. Fetch full weekly schedule (scoped to this faculty)
        let schedQuery = supabase
          .from('timetable_entries')
          .select(`
            id, day_of_week, start_time, end_time, classroom_id, section_id, subject_offering_id, faculty_id,
            classroom:classrooms(id, room_number, building),
            section:sections(id, name, semester:semesters(semester_number, program:programs(name, code))),
            subject_offering:subject_offerings(id, subject:subjects(id, name, code))
          `);

        if (facultyRecord?.id) {
          schedQuery = schedQuery.eq('faculty_id', facultyRecord.id);
        }

        const { data: schedule, error: scErr } = await schedQuery.order('start_time');

        if (scErr) throw scErr;
        const allSched = schedule || [];
        setWeeklySchedule(allSched);
        const currentDay = new Date().getDay() || 7;
        setTodaySchedule(allSched.filter((s) => s.day_of_week === currentDay));

        // 3. Fetch summary metrics from database
        let sessQuery = supabase
          .from('attendance_sessions')
          .select('id, status');

        if (facultyRecord?.id) {
          sessQuery = sessQuery.eq('faculty_id', facultyRecord.id);
        }

        const { data: sessions, error: sessErr } = await sessQuery;

        if (sessErr) throw sessErr;

        const held = sessions?.filter((s) => s.status === 'completed' || s.status === 'audit_locked').length || 0;
        const active = sessions?.find((s) => s.status === 'in_progress')?.id || null;

        // Fetch defaulter count (< 75%) from view - scoped to department
        let summaryQuery = supabase
          .from('v_student_attendance_summary')
          .select('attendance_percentage, threshold_status, department_id');

        if (facultyRecord?.department_id) {
          summaryQuery = summaryQuery.eq('department_id', facultyRecord.department_id);
        }

        const { data: summaryView } = await summaryQuery;

        let avg = 0;
        let risk = 0;
        if (summaryView && summaryView.length > 0) {
          const totalPct = summaryView.reduce((acc, row) => acc + parseFloat(row.attendance_percentage || 0), 0);
          avg = Math.round((totalPct / summaryView.length) * 10) / 10;
          risk = summaryView.filter((row) => row.threshold_status === 'critical').length;
        }

        setStats({
          totalClassesHeld: held,
          averageAttendanceRate: avg,
          studentsAtRisk: risk,
          activeSessionId: active,
        });

        // 4. Fetch Coordinated Class (Class Incharge) for this faculty member
        if (facultyRecord?.id) {
          const { data: coordSec } = await supabase
            .from('sections')
            .select(`
              id, name, capacity,
              semester:semesters(id, semester_number, program:programs(name, code, department:departments(name)))
            `)
            .eq('class_coordinator_id', facultyRecord.id)
            .maybeSingle();

          if (coordSec) {
            setCoordinatedSection(coordSec);
            const { count } = await supabase
              .from('students')
              .select('id', { count: 'exact', head: true })
              .eq('current_section_id', coordSec.id);
            setCoordinatedStudentsCount(count || 0);
          } else {
            setCoordinatedSection(null);
            setCoordinatedStudentsCount(0);
          }
        }
      } catch (err: any) {
        console.error('Error loading teacher dashboard data:', err);
        toast.error('Failed to load dashboard', err.message);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadTeacherData();

    // Setup realtime subscription for instant timetable & lecture synchronization
    const channel = supabase
      .channel('teacher_dashboard_sync_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries' }, () => {
        loadTeacherData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
        loadTeacherData();
      })
      .subscribe();

    const handleSync = () => {
      loadTeacherData();
    };

    window.addEventListener('campusattend:timetable-updated', handleSync);
    window.addEventListener('campusattend:sessions-updated', handleSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('campusattend:timetable-updated', handleSync);
      window.removeEventListener('campusattend:sessions-updated', handleSync);
    };
  }, [facultyRecord, toast]);

  const handleStartAttendanceSession = async (options?: {
    subjectOfferingId?: string;
    sectionId?: string;
    classroomId?: string;
    timetableEntryId?: string;
    sessionId?: string;
  }) => {
    try {
      // 1. If active session already known
      if (options?.sessionId) {
        onNavigateToSession?.(options.sessionId);
        return;
      }

      if (stats.activeSessionId) {
        onNavigateToSession?.(stats.activeSessionId);
        return;
      }

      // Check database for any currently in_progress session for this faculty
      let existingQuery = supabase
        .from('attendance_sessions')
        .select('id, classroom:classrooms(room_number, device_pairing_code)')
        .eq('status', 'in_progress');

      if (facultyRecord?.id) {
        existingQuery = existingQuery.eq('faculty_id', facultyRecord.id);
      }

      const { data: existingActive } = await existingQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingActive?.id) {
        toast.info('Active Session Resumed', 'Redirecting to your ongoing live attendance session.');
        onNavigateToSession?.(existingActive.id);
        return;
      }

      // 2. Resolve target subject_offering, section, and classroom
      let offeringId = options?.subjectOfferingId;
      let sectionId = options?.sectionId;
      let classroomId = options?.classroomId;
      let timetableEntryId = options?.timetableEntryId;

      if (!offeringId || !sectionId) {
        if (assignedSubjects.length > 0) {
          offeringId = assignedSubjects[0].subject_offering?.id;
          sectionId = assignedSubjects[0].section?.id;
        }
      }

      if (!classroomId) {
        const { data: roomList } = await supabase
          .from('classrooms')
          .select('id, room_number, device_pairing_code')
          .limit(1);
        classroomId = roomList?.[0]?.id;
      }

      if (!offeringId || !sectionId || !classroomId) {
        toast.warning(
          'Setup Required',
          'Please ensure subjects, sections, and classrooms are configured in Academic Setup.'
        );
        return;
      }

      // 3. Generate dynamic 6-digit OTP for this classroom session
      let sessionOtp = Math.floor(100000 + Math.random() * 900000).toString();
      try {
        const { data: rpcOtp } = await supabase.rpc('rpc_generate_classroom_otp', {
          p_classroom_id: classroomId,
        });
        if (rpcOtp) sessionOtp = rpcOtp;
      } catch (e) {
        await supabase
          .from('classrooms')
          .update({ device_pairing_code: sessionOtp })
          .eq('id', classroomId);
      }

      // 4. Create a real new attendance session
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const startTimeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
      const endHour = new Date(now.getTime() + 60 * 60 * 1000);
      const endTimeStr = endHour.toTimeString().split(' ')[0]; // HH:MM:SS

      const { data: newSession, error: createErr } = await supabase
        .from('attendance_sessions')
        .insert({
          faculty_id: facultyRecord?.id || null,
          subject_offering_id: offeringId,
          section_id: sectionId,
          classroom_id: classroomId,
          timetable_entry_id: timetableEntryId || null,
          session_date: todayDate,
          start_time: startTimeStr,
          end_time: endTimeStr,
          session_type: 'lecture',
          status: 'in_progress',
          is_attendance_locked: false,
          qr_expires_at: new Date(Date.now() + 36000000).toISOString(),
        })
        .select(`
          id,
          classroom:classrooms(room_number, device_pairing_code)
        `)
        .single();

      if (createErr) throw createErr;

      const roomName = (newSession?.classroom as any)?.room_number || 'Classroom';
      const pairCode = sessionOtp || (newSession?.classroom as any)?.device_pairing_code;

      toast.success(
        'Class Attendance Activated!',
        `Room ${roomName} Smart Board 6-Digit OTP: ${pairCode} is live and ready on /display.`
      );

      onNavigateToSession?.(newSession.id);
    } catch (err: any) {
      console.error('Error activating session:', err);
      toast.error('Failed to start attendance session', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            TEACHER CONSOLE
          </span>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Welcome back, {profile?.first_name || 'Prof.'} {profile?.last_name || 'Sharma'}
          </h1>
          <p className="text-xs text-indigo-200 mt-1">
            {facultyRecord?.department?.name || institution?.name || 'School of Engineering & Technology'} • SDGI Global University
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setManualModalPreload(null);
              setIsManualModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <BookOpen className="h-4 w-4" />
            <span>Manual Attendance (Guest/Library)</span>
          </button>

          <button
            onClick={() => handleStartAttendanceSession(stats.activeSessionId ? { sessionId: stats.activeSessionId } : undefined)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Radio className="h-4 w-4" />
            {stats.activeSessionId ? 'Open Active Live Session' : 'Conduct New Session'}
          </button>
        </div>
      </div>

      {/* Coordinated Class Banner (Class Incharge) */}
      {coordinatedSection && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-200">
              <UserCheck className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-400 text-purple-950 font-mono">
                  Official Class Coordinator
                </span>
                <span className="text-xs text-purple-200 font-semibold">
                  {Math.ceil((coordinatedSection.semester?.semester_number || 1) / 2)}th Year (Sem {coordinatedSection.semester?.semester_number})
                </span>
              </div>
              <h2 className="text-base font-black text-white mt-1">
                Class Incharge: Section {coordinatedSection.name}
              </h2>
              <p className="text-xs text-purple-200/80 mt-0.5">
                {coordinatedSection.semester?.program?.name || coordinatedSection.semester?.program?.code || 'Degree'} • {coordinatedStudentsCount} Enrolled Students • Capacity: {coordinatedSection.capacity}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {onNavigateToReports && (
              <button
                onClick={onNavigateToReports}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <BarChart3 className="h-4 w-4 text-purple-300" />
                <span>Class Attendance Report</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Classes Conducted</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-16" /> : stats.totalClassesHeld}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Finalized & Locked Sessions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Average Attendance</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-16" /> : `${stats.averageAttendanceRate}%`}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">▲ Compliant with 75% rule</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Assigned Courses</span>
            <BookOpen className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-16" /> : assignedSubjects.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active Lecture & Lab Cohorts</p>
        </div>

        <div className="bg-rose-50/60 p-5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold uppercase">
            <span>Students Below 75%</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-800 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-16" /> : stats.studentsAtRisk}
          </div>
          <button
            onClick={onNavigateToReports}
            className="text-[11px] text-rose-700 font-bold hover:underline mt-1 flex items-center gap-1"
          >
            View Defaulters &rarr;
          </button>
        </div>
      </div>

      {/* Grid: Assigned Classes & Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Classes */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-600" /> Assigned Subjects & Sections
              </h2>
              <span className="text-xs text-slate-400 font-medium">{assignedSubjects.length} Classes</span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : assignedSubjects.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No assigned subjects found.</p>
              ) : (
                assignedSubjects.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-indigo-600">
                          {item.subject_offering?.subject?.code}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {item.subject_offering?.subject?.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {item.section?.semester?.program?.name} • {item.section?.name} (Sem {item.section?.semester?.semester_number})
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleStartAttendanceSession({
                          subjectOfferingId: item.subject_offering?.id,
                          sectionId: item.section?.id,
                        })
                      }
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Radio className="h-3.5 w-3.5 text-indigo-200 animate-pulse" />
                      <span>Take Attendance</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Day-Wise Lecture Schedule */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" /> Day-Wise Lecture Schedule
              </h2>
              <button
                onClick={onNavigateToTimetable}
                className="text-xs text-indigo-600 hover:underline font-semibold"
              >
                Full Week Matrix &rarr;
              </button>
            </div>

            {/* Mini Day Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 overflow-x-auto">
              {DAYS.map((d) => {
                const isToday = (new Date().getDay() || 7) === d.id;
                const isSelected = selectedScheduleDay === d.id;
                const count = weeklySchedule.filter((s) => s.day_of_week === d.id).length;

                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedScheduleDay(d.id)}
                    className={`flex-1 min-w-[50px] py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    <span>{d.short}</span>
                    {isToday && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                    )}
                    <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (() => {
                const daySlots = weeklySchedule
                  .filter((s) => s.day_of_week === selectedScheduleDay)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                const activeDayObj = DAYS.find((d) => d.id === selectedScheduleDay);

                if (daySlots.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-semibold">No scheduled lectures for {activeDayObj?.name || 'this day'}</p>
                      <button
                        onClick={() => {
                          setManualModalPreload({
                            sessionDate: (new Date().getDay() || 7) === selectedScheduleDay ? new Date().toISOString().slice(0, 10) : undefined,
                          });
                          setIsManualModalOpen(true);
                        }}
                        className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Manual / Guest Lecture</span>
                      </button>
                    </div>
                  );
                }

                return daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {slot.subject_offering?.subject?.code}: {slot.subject_offering?.subject?.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {formatSectionShortBadge(slot.section)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1">
                        <span className="font-mono font-semibold text-indigo-600">
                          {formatTime12(slot.start_time)} - {formatTime12(slot.end_time)}
                        </span>
                        <span>Room {slot.classroom?.room_number || 'TBA'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Manual / Guest Lecture Option */}
                      <button
                        onClick={() => {
                          setManualModalPreload({
                            sectionId: slot.section_id || slot.section?.id,
                            subjectOfferingId: slot.subject_offering_id || slot.subject_offering?.id,
                            startTime: slot.start_time,
                            endTime: slot.end_time,
                            classroomId: slot.classroom_id || slot.classroom?.id,
                            sessionDate: (new Date().getDay() || 7) === selectedScheduleDay ? new Date().toISOString().slice(0, 10) : undefined,
                          });
                          setIsManualModalOpen(true);
                        }}
                        className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                        title="Mark manual attendance for Guest lecture, Library, or Timetable abnormality"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Manual</span>
                      </button>

                      <button
                        onClick={() =>
                          handleStartAttendanceSession({
                            subjectOfferingId: slot.subject_offering_id || slot.subject_offering?.id,
                            sectionId: slot.section_id || slot.section?.id,
                            classroomId: slot.classroom_id || slot.classroom?.id,
                            timetableEntryId: slot.id,
                          })
                        }
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Radio className="h-3.5 w-3.5 text-indigo-200 animate-pulse" />
                        <span>Live Session</span>
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Manual / Ad-hoc Attendance Modal */}
      <ManualAttendanceModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setManualModalPreload(null);
        }}
        initialData={manualModalPreload}
        onSuccess={() => {
          setIsManualModalOpen(false);
          setManualModalPreload(null);
          loadTeacherData();
        }}
      />
    </div>
  );
};
