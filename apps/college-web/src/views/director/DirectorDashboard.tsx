import React, { useState, useEffect } from 'react';
import { supabase, DEFAULT_INSTITUTION_ID } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  TrendingUp,
  Building2,
  Users,
  AlertCircle,
  FileCheck2,
  Radio,
  ExternalLink,
  BookOpen,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';

interface DirectorDashboardProps {
  onNavigateToReports?: () => void;
  onNavigateToStudents?: () => void;
  onNavigateToBulkImport?: () => void;
  onNavigateToAcademicSetup?: () => void;
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({
  onNavigateToReports,
  onNavigateToStudents,
  onNavigateToBulkImport,
  onNavigateToAcademicSetup,
}) => {
  const toast = useToast();
  const { profile, institution, currentInstitutionId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    totalDepartments: 0,
    heldSessions: 0,
    cancelledSessions: 0,
    averageAttendance: 0,
    detainedCount: 0,
  });

  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);

  useEffect(() => {
    async function loadDirectorMetrics() {
      setLoading(true);
      const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
      try {
        // High-performance parallel queries scoped to institution
        const [
          { count: studCount },
          { count: facCount },
          { count: deptCount },
          { count: heldCount },
          { count: cancelledCount },
          { data: inProgressSessions },
          { data: summaryRows },
          { data: depts },
        ] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', instId),
          supabase.from('faculty').select('*', { count: 'exact', head: true }).eq('institution_id', instId),
          supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', instId),
          supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).in('status', ['completed', 'audit_locked']),
          supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
          supabase.from('attendance_sessions')
            .select(`
              id, status, session_date, start_time, end_time, session_type,
              subject_offering:subject_offerings(subject:subjects(code, name)),
              classroom:classrooms(room_number, building),
              section:sections(name),
              faculty:faculty(profile:profiles(first_name, last_name))
            `)
            .eq('status', 'in_progress')
            .limit(10),
          supabase.from('v_student_attendance_summary').select('attendance_percentage, threshold_status, department_id'),
          supabase.from('departments').select('id, name, code').eq('institution_id', instId).order('name'),
        ]);

        let avg = 0;
        let detained = 0;
        if (summaryRows && summaryRows.length > 0) {
          const totalPct = summaryRows.reduce((acc: number, row: any) => acc + (parseFloat(row.attendance_percentage) || 0), 0);
          avg = Math.round((totalPct / summaryRows.length) * 10) / 10;
          detained = summaryRows.filter((row: any) => row.threshold_status === 'critical').length;
        }

        setCounts({
          totalStudents: studCount || 0,
          totalFaculty: facCount || 0,
          totalDepartments: deptCount || 0,
          heldSessions: heldCount || 0,
          cancelledSessions: cancelledCount || 0,
          averageAttendance: avg,
          detainedCount: detained,
        });

        setLiveSessions(inProgressSessions || []);

        // Calculate REAL department statistics - no hardcoded demo calculations
        const deptList = (depts || []).map((d: any) => {
          const deptRows = summaryRows?.filter((row: any) => row.department_id === d.id) || [];
          let deptAvg = 0;
          let deptDetained = 0;
          if (deptRows.length > 0) {
            const sum = deptRows.reduce((acc: number, r: any) => acc + (parseFloat(r.attendance_percentage) || 0), 0);
            deptAvg = Math.round((sum / deptRows.length) * 10) / 10;
            deptDetained = deptRows.filter((r: any) => r.threshold_status === 'critical').length;
          }
          return {
            name: d.name,
            code: d.code,
            attendance: deptAvg,
            detained: deptDetained,
            hasData: deptRows.length > 0,
          };
        });
        setDepartmentStats(deptList);
      } catch (err: any) {
        console.error('Error loading director metrics:', err);
        toast.error('Failed to load institution metrics', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDirectorMetrics();

    // Setup realtime subscription to listen to in_progress attendance sessions
    const sub = supabase
      .channel('director_live_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        () => {
          loadDirectorMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              DIRECTORATE & DEAN OF ACADEMICS
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {institution?.name ? `${institution.name} • SDGI Global University` : 'SDGI Global University'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Institutional Attendance Overview
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time cross-departmental analytics and live lecture attendance monitor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {onNavigateToBulkImport && (
            <button
              onClick={onNavigateToBulkImport}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk Data Intake (1000+)</span>
            </button>
          )}
          {onNavigateToAcademicSetup && (
            <button
              onClick={onNavigateToAcademicSetup}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Campus & Schools</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Tiles from real database tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Overall Attendance Rate</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-20" /> : `${counts.averageAttendance}%`}
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">
            {counts.heldSessions === 0 ? 'No attendance records yet' : counts.averageAttendance >= 75 ? '▲ Compliant with 75% rule' : '▼ Below 75% requirement'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Enrolled Students</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-20" /> : counts.totalStudents}
          </div>
          <button
            onClick={onNavigateToStudents}
            className="text-[11px] text-indigo-600 font-bold hover:underline mt-1"
          >
            Browse Student Directory &rarr;
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Held Sessions / Cancelled</span>
            <FileCheck2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span>
                {counts.heldSessions} <span className="text-sm font-medium text-slate-400">/ {counts.cancelledSessions}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cancelled lectures excluded from formula</p>
        </div>

        <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold uppercase">
            <span>Critical Shortage (&lt;75%)</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-800 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-20" /> : `${counts.detainedCount} Students`}
          </div>
          <button
            onClick={onNavigateToReports}
            className="text-[11px] text-rose-700 font-bold hover:underline mt-1"
          >
            Review Detention Watchlist &rarr;
          </button>
        </div>
      </div>

      {/* Live Class Monitor Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-rose-600 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Live Campus Lecture Monitor</h2>
              <p className="text-xs text-slate-500">Real-time active classes and digital presence across academic blocks</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {liveSessions.length} Active Classes Running
          </span>
        </div>

        {liveSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-xs font-semibold">No active lecture sessions currently in progress.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {liveSessions.map((session) => (
              <div key={session.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-indigo-600">
                      {session.subject_offering?.subject?.code}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {session.subject_offering?.subject?.name}
                    </span>
                    <StatusBadge status="in_progress" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                    <span>
                      Faculty:{' '}
                      <strong className="text-slate-700">
                        {session.faculty?.profile?.first_name} {session.faculty?.profile?.last_name}
                      </strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      Room {session.classroom?.room_number} ({session.classroom?.building})
                    </span>
                    <span>Section: {session.section?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    Slot: {session.start_time?.substring(0, 5)} - {session.end_time?.substring(0, 5)}
                  </span>
                  <a
                    href="http://localhost:5174"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1"
                  >
                    View Kiosk <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cross-Department Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600" /> Departmental Compliance Benchmarks
        </h2>
        <div className="space-y-4">
          {departmentStats.map((dept) => (
            <div key={dept.code} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-bold text-indigo-600">{dept.code}</span>
                  <h3 className="text-sm font-bold text-slate-800">{dept.name}</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Critical Shortage</span>
                    <div className="text-xs font-bold text-rose-600">{dept.detained} Students</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Average Attendance</span>
                    <div className="text-base font-black text-slate-900 font-mono">
                      {dept.hasData ? `${dept.attendance}%` : 'No Records Yet'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dept.attendance >= 75 ? 'bg-indigo-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${dept.attendance}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
