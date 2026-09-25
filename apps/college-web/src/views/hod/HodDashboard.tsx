import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { exportToExcel } from '../../lib/exportUtils';
import {
  Building2,
  Users,
  AlertTriangle,
  Calendar,
  CheckCircle,
  XCircle,
  Radio,
  FileSpreadsheet,
  Clock,
  BookOpen,
  Send,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface DeptSummary {
  facultyCount: number;
  sectionCount: number;
  studentsAtRiskCount: number;
  todaySessionsCount: number;
}

interface ActiveSession {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  faculty_name: string;
  subject_name: string;
  subject_code: string;
  room_number: string;
  section_name: string;
}

interface StudentAtRisk {
  student_id: string;
  roll_number: string;
  student_name: string;
  subject_name: string;
  subject_code: string;
  total_held: number;
  attended_count: number;
  attendance_percentage: number;
  threshold_status: string;
}

interface LeaveRequest {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  status: string;
  created_at: string;
  student_name: string;
  roll_number: string;
  section_name: string;
}

export const HodDashboard: React.FC = () => {
  const { profile, facultyRecord } = useAuth();
  const { addToast } = useToast();

  const [department, setDepartment] = useState<{ id: string; name: string; code: string } | null>(null);
  const [stats, setStats] = useState<DeptSummary>({
    facultyCount: 0,
    sectionCount: 0,
    studentsAtRiskCount: 0,
    todaySessionsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'shortage' | 'leaves' | 'faculty'>('sessions');

  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [riskStudents, setRiskStudents] = useState<StudentAtRisk[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [deptFaculty, setDeptFaculty] = useState<any[]>([]);

  // Action dialogs
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewRemark, setReviewRemark] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Load Department Data
  const loadDepartmentScope = async () => {
    try {
      setLoading(true);

      // Determine department
      let deptId = facultyRecord?.department_id;
      let deptInfo = (facultyRecord as any)?.department;

      if (!deptId) {
        // Fallback: pick the first department (e.g. CSE)
        const { data: firstDept } = await supabase.from('departments').select('*').limit(1).single();
        if (firstDept) {
          deptId = firstDept.id;
          deptInfo = firstDept;
        }
      }

      if (!deptId) {
        setLoading(false);
        return;
      }

      setDepartment(deptInfo);

      // 1. Department Faculty count & listing
      const { data: facList, count: facCount } = await supabase
        .from('faculty')
        .select(`
          id,
          employee_code,
          designation,
          profile:profiles(first_name, last_name, email, phone_number)
        `, { count: 'exact' })
        .eq('department_id', deptId);

      setDeptFaculty(facList || []);

      // 2. Sections in department
      const { data: progList } = await supabase
        .from('programs')
        .select('id')
        .eq('department_id', deptId);

      const programIds = (progList || []).map((p) => p.id);

      let totalSections = 0;
      let sectionIds: string[] = [];
      if (programIds.length > 0) {
        const { data: semList } = await supabase
          .from('semesters')
          .select('id')
          .in('program_id', programIds);

        const semesterIds = (semList || []).map((s) => s.id);
        if (semesterIds.length > 0) {
          const { data: secList, count: secCount } = await supabase
            .from('sections')
            .select('id', { count: 'exact' })
            .in('semester_id', semesterIds);

          totalSections = secCount || 0;
          sectionIds = (secList || []).map((s) => s.id);
        }
      }

      // 3. Today's sessions for this department
      const today = new Date().toISOString().slice(0, 10);
      let sessionData: ActiveSession[] = [];
      if (sectionIds.length > 0) {
        const { data: sessList } = await supabase
          .from('attendance_sessions')
          .select(`
            id,
            start_time,
            end_time,
            status,
            section:sections(name),
            classroom:classrooms(room_number),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            ),
            faculty:faculty(
              profile:profiles(first_name, last_name)
            )
          `)
          .in('section_id', sectionIds)
          .eq('session_date', today)
          .order('start_time', { ascending: true });

        sessionData = (sessList || []).map((s: any) => ({
          id: s.id,
          start_time: s.start_time,
          end_time: s.end_time,
          status: s.status,
          section_name: s.section?.name || 'N/A',
          room_number: s.classroom?.room_number || 'N/A',
          subject_name: s.subject_offering?.subject?.name || 'N/A',
          subject_code: s.subject_offering?.subject?.code || 'N/A',
          faculty_name: s.faculty?.profile ? `${s.faculty.profile.first_name} ${s.faculty.profile.last_name}` : 'N/A'
        }));
      }
      setActiveSessions(sessionData);

      // 4. Low-attendance shortage students from canonical summary view
      const { data: summaryData } = await supabase
        .from('v_student_attendance_summary')
        .select('*')
        .lt('attendance_percentage', 75)
        .order('attendance_percentage', { ascending: true })
        .limit(20);

      const riskList: StudentAtRisk[] = (summaryData || []).map((item: any) => ({
        student_id: item.student_id,
        roll_number: item.roll_number,
        student_name: item.student_name,
        subject_name: item.subject_name,
        subject_code: item.subject_code,
        total_held: item.total_held,
        attended_count: item.attended_count,
        attendance_percentage: Number(item.attendance_percentage),
        threshold_status: item.threshold_status
      }));
      setRiskStudents(riskList);

      // 5. Pending leaves for students
      const { data: leaves } = await supabase
        .from('leave_applications')
        .select(`
          id,
          student_id,
          start_date,
          end_date,
          reason,
          leave_type,
          status,
          created_at,
          student:students(
            roll_number,
            profile:profiles(first_name, last_name),
            current_section:sections(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      const formattedLeaves: LeaveRequest[] = (leaves || []).map((l: any) => ({
        id: l.id,
        student_id: l.student_id,
        start_date: l.start_date,
        end_date: l.end_date,
        reason: l.reason,
        leave_type: l.leave_type,
        status: l.status,
        created_at: l.created_at,
        student_name: l.student?.profile ? `${l.student.profile.first_name} ${l.student.profile.last_name}` : 'Unknown',
        roll_number: l.student?.roll_number || 'N/A',
        section_name: l.student?.current_section?.name || 'N/A'
      }));
      setLeaveRequests(formattedLeaves);

      setStats({
        facultyCount: facCount || 0,
        sectionCount: totalSections,
        studentsAtRiskCount: riskList.length,
        todaySessionsCount: sessionData.length
      });
    } catch (err: any) {
      console.error('Failed to load HOD view:', err);
      addToast({
        title: 'Department Load Error',
        message: err.message || 'Unable to retrieve departmental statistics.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentScope();
  }, [facultyRecord]);

  // Handle Leave Approval / Rejection
  const handleLeaveDecision = async () => {
    if (!selectedLeave || !actionType) return;
    try {
      setSubmittingAction(true);
      const newStatus = actionType === 'approve' ? 'approved' : 'rejected';

      const { error } = await supabase
        .from('leave_applications')
        .update({
          status: newStatus,
          approved_by: profile?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedLeave.id);

      if (error) throw error;

      // Log into audit trail
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: actionType === 'approve' ? 'LEAVE_APPLICATION_APPROVED' : 'LEAVE_APPLICATION_REJECTED',
        entity_type: 'leave_application',
        entity_id: selectedLeave.id,
        details: {
          student_id: selectedLeave.student_id,
          remarks: reviewRemark,
          leave_dates: `${selectedLeave.start_date} to ${selectedLeave.end_date}`
        }
      });

      addToast({
        title: `Leave ${actionType === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Decision recorded for ${selectedLeave.student_name}.`,
        type: 'success'
      });

      setSelectedLeave(null);
      setActionType(null);
      setReviewRemark('');
      loadDepartmentScope();
    } catch (err: any) {
      addToast({
        title: 'Action Failed',
        message: err.message || 'Could not update leave request.',
        type: 'error'
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExportRiskReport = () => {
    if (riskStudents.length === 0) {
      addToast({ title: 'Export Empty', message: 'No students at risk to export.', type: 'warning' });
      return;
    }
    const data = riskStudents.map((s) => ({
      'Roll Number': s.roll_number,
      'Student Name': s.student_name,
      'Subject': `${s.subject_name} (${s.subject_code})`,
      'Total Held': s.total_held,
      'Attended': s.attended_count,
      'Attendance %': `${s.attendance_percentage}%`,
      'Shortage Gap': `${Math.max(0, Math.ceil(0.75 * s.total_held - s.attended_count))} lectures`
    }));
    exportToExcel(data, `${department?.code || 'DEPT'}_Attendance_Shortage_${new Date().toISOString().slice(0, 10)}`);
    addToast({ title: 'Report Exported', message: 'Low attendance roster downloaded.', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-indigo-900/40 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Building2 className="h-4 w-4" />
              <span>Head of Department Console</span>
            </div>
            <h1 className="text-2xl font-black mt-1">
              Department of {department?.name || 'Engineering & Technology'} ({department?.code || 'DEPT'})
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Real-time oversight of curriculum execution, faculty assignments, classroom lectures, and statutory attendance compliance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadDepartmentScope}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Department</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-medium block">Department Faculty</span>
            <div className="text-2xl font-bold text-white mt-1">{stats.facultyCount}</div>
            <span className="text-[10px] text-indigo-300">Teaching Staff Active</span>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-medium block">Academic Sections</span>
            <div className="text-2xl font-bold text-white mt-1">{stats.sectionCount}</div>
            <span className="text-[10px] text-emerald-400">Enrolled Batches</span>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-medium block">Students Below 75%</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{stats.studentsAtRiskCount}</div>
            <span className="text-[10px] text-rose-300">Require Escalation</span>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-medium block">Today's Lectures</span>
            <div className="text-2xl font-bold text-indigo-300 mt-1">{stats.todaySessionsCount}</div>
            <span className="text-[10px] text-slate-400">Timetable Slots</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'sessions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="h-4 w-4" />
          <span>Today's Sessions ({activeSessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shortage')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'shortage'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <span>Attendance Shortage Watchlist ({riskStudents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'leaves'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          <span>Leave Requests ({leaveRequests.filter(r => r.status === 'pending').length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('faculty')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'faculty'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Faculty Directory ({deptFaculty.length})</span>
        </button>
      </div>

      {/* Tab 1: Today's Department Sessions */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              Department Classroom Schedule for Today
            </h3>
            <span className="text-xs text-slate-500">Live Status via CampusAttend Core</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Section & Room</th>
                  <th className="py-3 px-4">Faculty In Charge</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No active or scheduled sessions for today.
                    </td>
                  </tr>
                ) : (
                  activeSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.subject_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{s.subject_code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700">{s.section_name}</span> &bull; Room {s.room_number}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {s.faculty_name}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            s.status === 'in_progress' ? 'success' :
                            s.status === 'completed' ? 'default' :
                            s.status === 'cancelled' ? 'danger' : 'warning'
                          }
                        >
                          {s.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Shortage Watchlist */}
      {activeTab === 'shortage' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                Attendance Shortage Watchlist (&lt;75% Statutory Cut-Off)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Students below statutory requirements subject to examination debarment.
              </p>
            </div>
            <button
              onClick={handleExportRiskReport}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Roster</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-center">Classes Attended</th>
                  <th className="py-3 px-4 text-center">Attendance %</th>
                  <th className="py-3 px-4">Shortage Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {riskStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No students currently below the 75% threshold in this department!
                    </td>
                  </tr>
                ) : (
                  riskStudents.map((st, i) => {
                    const requiredSessions = Math.max(0, Math.ceil(0.75 * st.total_held - st.attended_count));
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                          {st.roll_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {st.student_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800">{st.subject_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">({st.subject_code})</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {st.attended_count} / {st.total_held}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                            {st.attendance_percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                            Needs {requiredSessions} more lectures to reach 75%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Leave Requests & Dispute Resolution */}
      {activeTab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              Department Student Leave Applications
            </h3>
            <span className="text-xs text-slate-500">Authorized HOD Academic Sign-off</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Leave Duration</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No leave applications submitted.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{req.student_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {req.roll_number} &bull; {req.section_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {req.start_date} to {req.end_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {req.leave_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                        {req.reason}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            req.status === 'approved' ? 'success' :
                            req.status === 'rejected' ? 'danger' : 'warning'
                          }
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'pending' ? (
                          <div className="inline-flex items-center space-x-1">
                            <button
                              onClick={() => {
                                setSelectedLeave(req);
                                setActionType('approve');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLeave(req);
                                setActionType('reject');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Faculty Directory */}
      {activeTab === 'faculty' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              Department Faculty Roster & Designation
            </h3>
            <span className="text-xs text-slate-500">{deptFaculty.length} Instructors</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Employee Code</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deptFaculty.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {f.employee_code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {f.profile?.first_name} {f.profile?.last_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium text-[11px]">
                        {f.designation}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {f.profile?.email}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {f.profile?.phone_number || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Decision Modal */}
      {selectedLeave && actionType && (
        <Modal
          isOpen={!!selectedLeave}
          onClose={() => setSelectedLeave(null)}
          title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Student Leave Application`}
          subtitle={`Student: ${selectedLeave.student_name} (${selectedLeave.roll_number})`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <div><strong className="text-slate-600">Period:</strong> {selectedLeave.start_date} to {selectedLeave.end_date}</div>
              <div><strong className="text-slate-600">Reason:</strong> {selectedLeave.reason}</div>
              <div><strong className="text-slate-600">Category:</strong> {selectedLeave.leave_type}</div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Academic Remarks / Endorsement Note:
              </label>
              <textarea
                value={reviewRemark}
                onChange={(e) => setReviewRemark(e.target.value)}
                placeholder="Enter review remarks for official records..."
                className="w-full h-20 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedLeave(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveDecision}
                disabled={submittingAction}
                className={`px-4 py-2 text-white font-bold rounded-xl shadow-sm transition ${
                  actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingAction ? 'Processing...' : `Confirm ${actionType === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
