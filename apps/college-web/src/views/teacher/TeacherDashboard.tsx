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
  TrendingUp
} from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';

interface TeacherDashboardProps {
  onNavigateToSession?: (sessionId?: string) => void;
  onNavigateToTimetable?: () => void;
  onNavigateToReports?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onNavigateToSession,
  onNavigateToTimetable,
  onNavigateToReports,
}) => {
  const { facultyRecord, profile } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalClassesHeld: 0,
    averageAttendanceRate: 0,
    studentsAtRisk: 0,
    activeSessionId: null as string | null,
  });

  useEffect(() => {
    async function loadTeacherData() {
      setLoading(true);
      try {
        // 1. Fetch faculty assignments
        const { data: assignments, error: aErr } = await supabase
          .from('faculty_assignments')
          .select(`
            id, is_primary,
            section:sections(id, name, semester:semesters(semester_number, program:programs(name, code))),
            subject_offering:subject_offerings(id, subject:subjects(id, name, code, credits))
          `);

        if (aErr) throw aErr;
        setAssignedSubjects(assignments || []);

        // 2. Fetch today's schedule
        const currentDay = new Date().getDay() || 7; // Sunday = 7
        const { data: schedule, error: scErr } = await supabase
          .from('timetable_entries')
          .select(`
            id, day_of_week, start_time, end_time,
            classroom:classrooms(room_number, building),
            section:sections(name),
            subject_offering:subject_offerings(subject:subjects(name, code))
          `)
          .eq('day_of_week', currentDay)
          .order('start_time');

        if (scErr) throw scErr;
        setTodaySchedule(schedule || []);

        // 3. Fetch summary metrics from database
        const { data: sessions, error: sessErr } = await supabase
          .from('attendance_sessions')
          .select('id, status');

        if (sessErr) throw sessErr;

        const held = sessions?.filter((s) => s.status === 'completed' || s.status === 'audit_locked').length || 0;
        const active = sessions?.find((s) => s.status === 'in_progress')?.id || null;

        // Fetch defaulter count (< 75%) from view
        const { data: summaryView, error: vErr } = await supabase
          .from('v_student_attendance_summary')
          .select('attendance_percentage, threshold_status');

        let avg = 0;
        let risk = 0;
        if (summaryView && summaryView.length > 0) {
          const totalPct = summaryView.reduce((acc, row) => acc + parseFloat(row.attendance_percentage), 0);
          avg = Math.round((totalPct / summaryView.length) * 10) / 10;
          risk = summaryView.filter((row) => row.threshold_status === 'critical').length;
        }

        setStats({
          totalClassesHeld: held,
          averageAttendanceRate: avg,
          studentsAtRisk: risk,
          activeSessionId: active,
        });
      } catch (err: any) {
        console.error('Error loading teacher dashboard data:', err);
        toast.error('Failed to load dashboard', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTeacherData();
  }, [facultyRecord, toast]);

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
            Department of Computer Science & Engineering • Academic Semester 2025-26
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToSession?.(stats.activeSessionId || undefined)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            <Radio className="h-4 w-4" />
            {stats.activeSessionId ? 'Open Active Live Session' : 'Conduct New Session'}
          </button>
        </div>
      </div>

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
                      onClick={() => onNavigateToSession?.()}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 text-xs font-semibold text-slate-700 rounded-lg shadow-sm"
                    >
                      Start Roster
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Today's Timetable */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" /> Today's Lecture Schedule
              </h2>
              <button
                onClick={onNavigateToTimetable}
                className="text-xs text-indigo-600 hover:underline font-semibold"
              >
                Full Week Matrix &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : todaySchedule.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No scheduled lectures for today</p>
                </div>
              ) : (
                todaySchedule.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {slot.subject_offering?.subject?.code}: {slot.subject_offering?.subject?.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1">
                        <span className="font-mono font-semibold text-indigo-600">
                          {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                        </span>
                        <span>Room {slot.classroom?.room_number}</span>
                        <span>{slot.section?.name}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateToSession?.()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" /> Live Kiosk
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
