import React, { useState, useEffect, useMemo } from 'react';
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
  FileSpreadsheet,
  XCircle,
  RefreshCw,
  Filter,
  CheckCircle2,
  BarChart3,
  GraduationCap
} from 'lucide-react';
import { formatSectionLabel, formatSectionShortBadge } from '../../lib/academicLabels';

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

  // Department isolation state
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');

  // Class-wise viewer state
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sectionStudents, setSectionStudents] = useState<any[]>([]);
  const [loadingSectionStudents, setLoadingSectionStudents] = useState<boolean>(false);

  // Raw fetched metrics
  const [rawFaculty, setRawFaculty] = useState<any[]>([]);
  const [rawSummaryRows, setRawSummaryRows] = useState<any[]>([]);
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
      const instId = profile?.institution_id || currentInstitutionId;
      if (!instId) {
        setCounts({
          totalStudents: 0,
          totalFaculty: 0,
          totalDepartments: 0,
          heldSessions: 0,
          cancelledSessions: 0,
          averageAttendance: 0,
          detainedCount: 0,
        });
        setLiveSessions([]);
        setDepartmentStats([]);
        setDepartmentsList([]);
        setLoading(false);
        return;
      }

      try {
        // High-performance parallel queries strictly scoped to institution
        const [
          { count: studCount },
          { data: facData },
          { data: depts },
        ] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', instId),
          supabase.from('faculty').select('id, department_id, employee_code').eq('institution_id', instId),
          supabase.from('departments').select('id, name, code').eq('institution_id', instId).order('name'),
        ]);

        const facultyList = facData || [];
        const facultyIds = facultyList.map((f: any) => f.id);
        const deptListRaw = depts || [];
        const deptIds = deptListRaw.map((d: any) => d.id);

        let heldCount = 0;
        let cancelledCount = 0;
        let inProgressSessions: any[] = [];
        let summaryRows: any[] = [];

        // Only query sessions if this institution has faculty
        if (facultyIds.length > 0) {
          const [
            { count: held },
            { count: cancelled },
            { data: live }
          ] = await Promise.all([
            supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).in('faculty_id', facultyIds).in('status', ['completed', 'audit_locked']),
            supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).in('faculty_id', facultyIds).eq('status', 'cancelled'),
            supabase.from('attendance_sessions')
              .select(`
                id, status, session_date, start_time, end_time, session_type, timetable_entry_id,
                subject_offering:subject_offerings(subject:subjects(code, name, department_id)),
                classroom:classrooms(room_number, building),
                section:sections(name, semester:semesters(program:programs(department_id))),
                faculty:faculty(department_id, profile:profiles(first_name, last_name))
              `)
              .in('faculty_id', facultyIds)
              .eq('status', 'in_progress')
              .order('created_at', { ascending: false })
              .limit(25),
          ]);
          heldCount = held || 0;
          cancelledCount = cancelled || 0;
          inProgressSessions = live || [];
        }

        // Only query summary rows if this institution has departments
        if (deptIds.length > 0) {
          const { data: sumRows } = await supabase
            .from('v_student_attendance_summary')
            .select('attendance_percentage, threshold_status, department_id')
            .in('department_id', deptIds);
          summaryRows = sumRows || [];
        }

        let avg = 0;
        let detained = 0;
        if (summaryRows && summaryRows.length > 0) {
          const totalPct = summaryRows.reduce((acc: number, row: any) => acc + (parseFloat(row.attendance_percentage) || 0), 0);
          avg = Math.round((totalPct / summaryRows.length) * 10) / 10;
          detained = summaryRows.filter((row: any) => row.threshold_status === 'critical').length;
        }

        setDepartmentsList(deptListRaw);
        setRawFaculty(facultyList);
        setRawSummaryRows(summaryRows);

        setCounts({
          totalStudents: studCount || summaryRows?.length || 0,
          totalFaculty: facultyList.length,
          totalDepartments: deptListRaw.length,
          heldSessions: heldCount,
          cancelledSessions: cancelledCount,
          averageAttendance: avg,
          detainedCount: detained,
        });

        // Filter sessions: only keep sessions for today and verify timetable validity
        const todayStr = new Date().toISOString().split('T')[0];
        const activeSessions = (inProgressSessions || []).filter((s: any) => {
          return !s.session_date || s.session_date === todayStr;
        });

        setLiveSessions(activeSessions);

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
            id: d.id,
            name: d.name,
            code: d.code,
            attendance: deptAvg,
            detained: deptDetained,
            hasData: deptRows.length > 0,
            totalStudents: deptRows.length,
          };
        });
        setDepartmentStats(deptList);

        // Fetch Sections for Class-Wise Report view
        let secItems: any[] = [];
        if (deptIds.length > 0) {
          const { data: progData } = await supabase
            .from('programs')
            .select('id, name, code, department_id')
            .in('department_id', deptIds);
          const progIds = (progData || []).map((p: any) => p.id);
          if (progIds.length > 0) {
            const { data: semData } = await supabase
              .from('semesters')
              .select('id, semester_number, program_id')
              .in('program_id', progIds);
            const semIds = (semData || []).map((s: any) => s.id);
            if (semIds.length > 0) {
              const { data: secData } = await supabase
                .from('sections')
                .select(`
                  id, name, capacity, semester_id, class_coordinator_id,
                  semester:semesters(
                    id, semester_number,
                    program:programs(id, name, code, department_id)
                  ),
                  coordinator:faculty(
                    id,
                    profile:profiles(first_name, last_name)
                  )
                `)
                .in('semester_id', semIds)
                .order('name');
              secItems = secData || [];
            }
          }
        }
        setSectionsList(secItems);
        if (secItems.length > 0) {
          setSelectedSectionId((prev) => prev || secItems[0].id);
        }
      } catch (err: any) {
        console.error('Error loading director metrics:', err);
        toast.error('Failed to load institution metrics', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDirectorMetrics();

    // Setup realtime subscription to listen to in_progress attendance sessions AND timetable_entries
    const sub = supabase
      .channel('director_sync_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        () => {
          loadDirectorMetrics();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timetable_entries' },
        () => {
          loadDirectorMetrics();
        }
      )
      .subscribe();

    // Listen to custom window events triggered when timetable is modified
    const handleSync = () => {
      loadDirectorMetrics();
    };
    window.addEventListener('campusattend:timetable-updated', handleSync);
    window.addEventListener('campusattend:sessions-updated', handleSync);

    return () => {
      supabase.removeChannel(sub);
      window.removeEventListener('campusattend:timetable-updated', handleSync);
      window.removeEventListener('campusattend:sessions-updated', handleSync);
    };
  }, [toast, profile?.institution_id, currentInstitutionId]);

  // Fetch students for selected section in Class-Wise Report Explorer
  useEffect(() => {
    if (!selectedSectionId) {
      setSectionStudents([]);
      return;
    }
    let isSubscribed = true;
    async function loadClassStudents() {
      setLoadingSectionStudents(true);
      try {
        const { data: studs, error: stErr } = await supabase
          .from('students')
          .select(`
            id, roll_number, branch,
            profile:profiles(first_name, last_name, email)
          `)
          .eq('current_section_id', selectedSectionId)
          .order('roll_number');

        if (stErr) throw stErr;
        if (!studs || studs.length === 0) {
          if (isSubscribed) {
            setSectionStudents([]);
            setLoadingSectionStudents(false);
          }
          return;
        }

        const studentIds = studs.map((s) => s.id);
        const { data: summaries } = await supabase
          .from('v_student_attendance_summary')
          .select('*')
          .in('student_id', studentIds);

        const sumMap = new Map<string, any>();
        (summaries || []).forEach((row: any) => {
          const existing = sumMap.get(row.student_id);
          if (!existing) {
            sumMap.set(row.student_id, {
              total_held: row.total_held || 0,
              attended_count: row.attended_count || 0,
              absent_count: row.absent_count || 0,
              pcts: [parseFloat(row.attendance_percentage) || 0],
            });
          } else {
            existing.total_held += (row.total_held || 0);
            existing.attended_count += (row.attended_count || 0);
            existing.absent_count += (row.absent_count || 0);
            existing.pcts.push(parseFloat(row.attendance_percentage) || 0);
          }
        });

        const enriched = studs.map((st: any) => {
          const meta = sumMap.get(st.id);
          let avgPct = 0;
          let held = 0;
          let attended = 0;
          let absent = 0;
          if (meta) {
            held = meta.total_held;
            attended = meta.attended_count;
            absent = meta.absent_count;
            const avg = meta.pcts.reduce((a: number, b: number) => a + b, 0) / meta.pcts.length;
            avgPct = Math.round(avg * 10) / 10;
          }
          return {
            id: st.id,
            roll_number: st.roll_number,
            name: `${st.profile?.first_name || ''} ${st.profile?.last_name || ''}`.trim() || 'Student',
            branch: st.branch || 'CSE',
            total_held: held,
            attended_count: attended,
            absent_count: absent,
            attendance_percentage: avgPct,
            threshold_status: avgPct >= 80 ? 'good' : avgPct >= 75 ? 'warning' : 'critical'
          };
        });

        if (isSubscribed) {
          setSectionStudents(enriched);
        }
      } catch (err) {
        console.error('Error loading section students:', err);
      } finally {
        if (isSubscribed) setLoadingSectionStudents(false);
      }
    }

    loadClassStudents();
    return () => {
      isSubscribed = false;
    };
  }, [selectedSectionId]);

  const selectedSectionObj = useMemo(() => {
    return sectionsList.find((s) => s.id === selectedSectionId);
  }, [sectionsList, selectedSectionId]);

  const classAvgAttendance = useMemo(() => {
    if (sectionStudents.length === 0) return 0;
    const sum = sectionStudents.reduce((acc, s) => acc + s.attendance_percentage, 0);
    return Math.round((sum / sectionStudents.length) * 10) / 10;
  }, [sectionStudents]);

  // Instant Dismiss / End active lecture
  const handleDismissSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        // If delete restricted by foreign key, update status to completed
        await supabase
          .from('attendance_sessions')
          .update({
            status: 'completed',
            end_time: new Date().toTimeString().split(' ')[0]
          })
          .eq('id', sessionId);
      }

      toast.success('Lecture Dismissed', 'Active lecture session removed from monitor.');
      window.dispatchEvent(new CustomEvent('campusattend:sessions-updated'));
      setLiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      toast.error('Failed to dismiss session', err.message);
    }
  };

  // Compute scoped metrics based on selectedDepartmentId
  const selectedDeptObj = departmentsList.find((d) => d.id === selectedDeptId);

  const scopedMetrics = useMemo(() => {
    if (selectedDeptId === 'all') {
      return {
        studentsCount: counts.totalStudents,
        facultyCount: counts.totalFaculty,
        heldCount: counts.heldSessions,
        cancelledCount: counts.cancelledSessions,
        averageAttendance: counts.averageAttendance,
        detainedCount: counts.detainedCount,
        liveSessionsList: liveSessions,
        deptStatsList: departmentStats,
      };
    }

    const deptRows = rawSummaryRows.filter((r) => r.department_id === selectedDeptId);
    const deptFacs = rawFaculty.filter((f) => f.department_id === selectedDeptId);

    let deptAvg = 0;
    let deptDetained = 0;
    if (deptRows.length > 0) {
      const sum = deptRows.reduce(
        (acc: number, r: any) => acc + (parseFloat(r.attendance_percentage) || 0),
        0
      );
      deptAvg = Math.round((sum / deptRows.length) * 10) / 10;
      deptDetained = deptRows.filter((r: any) => r.threshold_status === 'critical').length;
    }

    const deptLiveSessions = liveSessions.filter((s: any) => {
      const subjDept = s.subject_offering?.subject?.department_id;
      const facDept = s.faculty?.department_id;
      const progDept = s.section?.semester?.program?.department_id;
      return (
        subjDept === selectedDeptId ||
        facDept === selectedDeptId ||
        progDept === selectedDeptId
      );
    });

    const singleDeptStat = departmentStats.filter((d) => d.id === selectedDeptId);

    return {
      studentsCount: deptRows.length,
      facultyCount: deptFacs.length,
      heldCount: counts.heldSessions,
      cancelledCount: counts.cancelledSessions,
      averageAttendance: deptAvg,
      detainedCount: deptDetained,
      liveSessionsList: deptLiveSessions,
      deptStatsList:
        singleDeptStat.length > 0
          ? singleDeptStat
          : departmentStats.filter((d) => d.name === selectedDeptObj?.name),
    };
  }, [
    selectedDeptId,
    counts,
    liveSessions,
    departmentStats,
    rawSummaryRows,
    rawFaculty,
    selectedDeptObj,
  ]);

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
          {onNavigateToReports && (
            <button
              onClick={() => {
                const el = document.getElementById('class-wise-report');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else if (onNavigateToReports) {
                  onNavigateToReports();
                }
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>View Class-Wise Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Department Isolation Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Academic Department Scope</span>
              {selectedDeptId === 'all' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Campus-Wide Consolidated
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Isolated Department: {selectedDeptObj?.code || 'Scoped'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedDeptId === 'all'
                ? 'Consolidated view of all academic departments. Switch to a specific department to isolate data.'
                : `Active isolation filter: Showing student attendance, faculty count, and live classes strictly for ${selectedDeptObj?.name || 'selected department'}.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="all">🏫 All Departments (School Consolidated)</option>
            {departmentsList.map((dept) => (
              <option key={dept.id} value={dept.id}>
                📁 {dept.code} — {dept.name}
              </option>
            ))}
          </select>

          {selectedDeptId !== 'all' && (
            <button
              onClick={() => setSelectedDeptId('all')}
              className="px-3 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
            >
              Reset to All
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
            {loading ? <Skeleton className="h-8 w-20" /> : `${scopedMetrics.averageAttendance}%`}
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">
            {scopedMetrics.averageAttendance === 0
              ? 'No attendance records yet'
              : scopedMetrics.averageAttendance >= 75
              ? '▲ Compliant with 75% rule'
              : '▼ Below 75% requirement'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Enrolled Students</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-20" /> : scopedMetrics.studentsCount}
          </div>
          <button
            onClick={onNavigateToStudents}
            className="text-[11px] text-indigo-600 font-bold hover:underline mt-1 cursor-pointer"
          >
            {selectedDeptId === 'all'
              ? 'Browse Student Directory →'
              : `Browse ${selectedDeptObj?.code || 'Department'} Students →`}
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>{selectedDeptId === 'all' ? 'Active Faculty' : `${selectedDeptObj?.code || 'Dept'} Faculty`}</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-20" /> : scopedMetrics.facultyCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {selectedDeptId === 'all'
              ? `${scopedMetrics.heldCount} completed lectures institution-wide`
              : `Assigned instructors in ${selectedDeptObj?.code || 'department'}`}
          </p>
        </div>

        <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold uppercase">
            <span>Critical Shortage (&lt;75%)</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-800 mt-2 font-mono">
            {loading ? <Skeleton className="h-8 w-20" /> : `${scopedMetrics.detainedCount} Students`}
          </div>
          <button
            onClick={onNavigateToReports}
            className="text-[11px] text-rose-700 font-bold hover:underline mt-1 cursor-pointer"
          >
            Review Detention Watchlist &rarr;
          </button>
        </div>
      </div>

      {/* Live Class Monitor Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-rose-600 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Live Campus Lecture Monitor</h2>
                {selectedDeptId !== 'all' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedDeptObj?.code} Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {selectedDeptId === 'all'
                  ? 'Real-time active classes and digital presence across academic blocks'
                  : `Active lectures currently running for ${selectedDeptObj?.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toast.info('Syncing Live Classes', 'Refreshing live lecture sessions...');
                window.location.reload();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Refresh lecture status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {scopedMetrics.liveSessionsList.length} Active Classes Running
            </span>
          </div>
        </div>

        {scopedMetrics.liveSessionsList.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-xs font-semibold">
              {selectedDeptId === 'all'
                ? 'No active lecture sessions currently in progress across the campus.'
                : `No active lecture sessions in progress for ${selectedDeptObj?.name || 'this department'}.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scopedMetrics.liveSessionsList.map((session: any) => (
              <div
                key={session.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50"
              >
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
                    <span>
                      Class: <strong className="text-slate-700">{formatSectionLabel(session.section)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    Slot: {session.start_time?.substring(0, 5)} - {session.end_time?.substring(0, 5)}
                  </span>
                  <a
                    href="http://localhost:5174"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => handleDismissSession(session.id)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="End or dismiss this active lecture"
                  >
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    <span>End Class</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Class-Wise Attendance & Performance Explorer */}
      <div id="class-wise-report" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">
                Class-Wise Attendance &amp; Performance Explorer
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select any enrolled class to inspect live student roll-list, attended lectures, and statutory threshold compliance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Section Picker Dropdown */}
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="px-3.5 py-2 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              {sectionsList.length === 0 ? (
                <option value="">No Classes Found</option>
              ) : (
                sectionsList.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {formatSectionLabel(sec)}
                  </option>
                ))
              )}
            </select>

            {onNavigateToReports && (
              <button
                onClick={onNavigateToReports}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Full Statutory Report</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Class Key Highlights */}
        {selectedSectionObj && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Class &amp; Semester</span>
              <div className="font-bold text-slate-900 mt-0.5">
                {formatSectionLabel(selectedSectionObj)}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Class Coordinator</span>
              <div className="font-bold text-slate-900 mt-0.5">
                {selectedSectionObj.coordinator?.profile
                  ? `Prof. ${selectedSectionObj.coordinator.profile.first_name} ${selectedSectionObj.coordinator.profile.last_name}`
                  : 'Not Assigned'}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Enrolled Students</span>
              <div className="font-mono font-bold text-indigo-700 mt-0.5">
                {sectionStudents.length} Students
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Class Avg Attendance</span>
              <div className="font-mono font-bold text-emerald-700 mt-0.5">
                {classAvgAttendance}%
              </div>
            </div>
          </div>
        )}

        {/* Students Table */}
        {loadingSectionStudents ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading student attendance for this class...</p>
          </div>
        ) : sectionStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <Users className="h-6 w-6 mx-auto mb-1 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No students currently enrolled in this section</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Assign students to this section in the Student Directory or Bulk Import tool.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3 text-center">Conducted</th>
                  <th className="py-2.5 px-3 text-center">Attended</th>
                  <th className="py-2.5 px-3 text-center">Absent</th>
                  <th className="py-2.5 px-3">Attendance %</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sectionStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{st.roll_number}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{st.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {st.branch}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">{st.total_held}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">{st.attended_count}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">{st.absent_count}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{st.attendance_percentage}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              st.attendance_percentage >= 80
                                ? 'bg-emerald-500'
                                : st.attendance_percentage >= 75
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, st.attendance_percentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          st.threshold_status === 'good'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : st.threshold_status === 'warning'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {st.threshold_status === 'good' ? 'Eligible' : st.threshold_status === 'warning' ? 'Borderline' : 'Shortage'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Departmental Compliance Benchmarks */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" />
            {selectedDeptId === 'all'
              ? 'Departmental Compliance Benchmarks'
              : `Compliance Status: ${selectedDeptObj?.name || 'Department'}`}
          </h2>
          {selectedDeptId !== 'all' && (
            <button
              onClick={() => setSelectedDeptId('all')}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Show All Departments Benchmarks &rarr;
            </button>
          )}
        </div>

        <div className="space-y-4">
          {scopedMetrics.deptStatsList.map((dept: any) => (
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
