import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { exportToExcel, exportToPdf } from '../../lib/exportUtils';
import { AttendanceStatus, AttendanceSession, Student } from '@campusattend/shared-types';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TablePagination } from '../../components/ui/TablePagination';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import {
  Play,
  Pause,
  Square,
  Lock,
  Search,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Send,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

interface RosterItem {
  record_id?: string;
  student_id: string;
  roll_number: string;
  student_name: string;
  status: AttendanceStatus;
  marked_at?: string;
  verification_method?: string;
  remarks?: string;
}

export const LiveSessionManager: React.FC = () => {
  const { facultyRecord, profile } = useAuth();
  const toast = useToast();

  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'roll' | 'name' | 'status'>('roll');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Manual marking / correction modal
  const [selectedStudentForManual, setSelectedStudentForManual] = useState<RosterItem | null>(null);
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('present');
  const [manualReason, setManualReason] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Submit to director modal
  const [showSubmitReportModal, setShowSubmitReportModal] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // End session dialog
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);

  // 1. Fetch sessions conducted by this faculty or active sessions
  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select(`
          id, session_date, start_time, end_time, session_type, status, is_attendance_locked, secret_seed,
          subject_offering:subject_offerings(subject:subjects(name, code)),
          classroom:classrooms(room_number, building),
          section:sections(name),
          faculty:faculty(employee_code, profile:profiles(first_name, last_name))
        `)
        .order('session_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setSessionsList(data);
        const inProgress = data.find((s) => s.status === 'in_progress') || data[0];
        setSelectedSessionId(inProgress.id);
        setActiveSession(inProgress);
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      toast.error('Failed to load attendance sessions', err.message);
    }
  }, [toast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 2. Fetch student roster & attendance records for the selected session
  const fetchSessionRoster = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      // Get session section ID
      const { data: sessionData, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('*, section:sections(*), classroom:classrooms(*), subject_offering:subject_offerings(subject:subjects(*))')
        .eq('id', sessionId)
        .single();

      if (sErr) throw sErr;
      setActiveSession(sessionData);

      // Get all students enrolled in this session's section
      const { data: students, error: studErr } = await supabase
        .from('students')
        .select('id, roll_number, profile:profiles(first_name, last_name, email)')
        .eq('current_section_id', sessionData.section_id)
        .order('roll_number');

      if (studErr) throw studErr;

      // Get attendance records for this session
      const { data: records, error: recErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('session_id', sessionId);

      if (recErr) throw recErr;

      // Join students with canonical records
      const recordMap = new Map(records?.map((r) => [r.student_id, r]) || []);

      const items: RosterItem[] = (students || []).map((st: any) => {
        const rec = recordMap.get(st.id);
        return {
          record_id: rec?.id,
          student_id: st.id,
          roll_number: st.roll_number,
          student_name: `${st.profile?.first_name || ''} ${st.profile?.last_name || ''}`.trim(),
          status: rec ? rec.status : 'absent',
          marked_at: rec?.marked_at ? new Date(rec.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          verification_method: rec?.verification_method,
          remarks: rec?.remarks,
        };
      });

      setRoster(items);
    } catch (err: any) {
      console.error('Error fetching roster:', err);
      toast.error('Failed to load student roster', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionRoster(selectedSessionId);
    }
  }, [selectedSessionId, fetchSessionRoster]);

  // 3. Setup Supabase Realtime subscription on attendance_records table
  useEffect(() => {
    if (!selectedSessionId) return;

    const channel = supabase
      .channel(`session_attendance_${selectedSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${selectedSessionId}`,
        },
        (payload) => {
          // Refresh roster dynamically when a record is inserted or updated via QR scan
          fetchSessionRoster(selectedSessionId);
          if (payload.eventType === 'INSERT') {
            toast.info('Live Check-in', 'A student verified attendance via Dynamic QR.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSessionId, fetchSessionRoster, toast]);

  // Session Control Actions
  const handleSessionStatusChange = async (newStatus: 'in_progress' | 'completed' | 'cancelled') => {
    if (!activeSession) return;
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', activeSession.id);

      if (error) throw error;

      setActiveSession((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(`Session status updated to ${newStatus}`);
      fetchSessions();
    } catch (err: any) {
      toast.error('Failed to update session status', err.message);
    }
  };

  const handleToggleLock = async () => {
    if (!activeSession) return;
    const newLockState = !activeSession.is_attendance_locked;
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ is_attendance_locked: newLockState, updated_at: new Date().toISOString() })
        .eq('id', activeSession.id);

      if (error) throw error;

      setActiveSession((prev: any) => ({ ...prev, is_attendance_locked: newLockState }));
      toast.info(newLockState ? 'Session Locked' : 'Session Unlocked', 'Attendance changes restricted.');
    } catch (err: any) {
      toast.error('Failed to toggle session lock', err.message);
    }
  };

  // Manual Attendance Correction / Marking with Mandatory Reason & Audit Trail
  const handleSaveManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForManual || !activeSession) return;
    if (!manualReason.trim()) {
      toast.warning('Mandatory Reason Required', 'Please enter a valid justification for this manual override.');
      return;
    }

    setManualSubmitting(true);
    try {
      // 1. Upsert attendance record
      const { error: upsertErr } = await supabase
        .from('attendance_records')
        .upsert(
          {
            session_id: activeSession.id,
            student_id: selectedStudentForManual.student_id,
            status: manualStatus,
            verification_method: 'manual_faculty',
            marked_at: new Date().toISOString(),
            is_finalized: true,
            remarks: manualReason,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id, student_id' }
        );

      if (upsertErr) throw upsertErr;

      // 2. Insert into audit_logs table to record who made the correction and reason
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'MANUAL_ATTENDANCE_OVERRIDE',
        entity_type: 'attendance_record',
        details: {
          session_id: activeSession.id,
          student_id: selectedStudentForManual.student_id,
          student_name: selectedStudentForManual.student_name,
          roll_number: selectedStudentForManual.roll_number,
          new_status: manualStatus,
          previous_status: selectedStudentForManual.status,
          mandatory_reason: manualReason,
        },
      });

      toast.success(
        'Attendance Updated',
        `${selectedStudentForManual.student_name} marked as ${manualStatus.toUpperCase()}. Audit log recorded.`
      );

      setSelectedStudentForManual(null);
      setManualReason('');
      fetchSessionRoster(activeSession.id);
    } catch (err: any) {
      toast.error('Failed to save manual attendance', err.message);
    } finally {
      setManualSubmitting(false);
    }
  };

  // Submit Session Summary to Director Workflow
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    setReportSubmitting(true);
    try {
      const total = roster.length;
      const present = roster.filter((r) => r.status === 'present').length;
      const late = roster.filter((r) => r.status === 'late').length;
      const excused = roster.filter((r) => r.status === 'excused').length;
      const absent = roster.filter((r) => r.status === 'absent').length;

      const { error } = await supabase.from('attendance_session_reports').upsert(
        {
          session_id: activeSession.id,
          faculty_id: activeSession.faculty_id,
          total_enrolled: total,
          present_count: present,
          late_count: late,
          excused_count: excused,
          absent_count: absent,
          submission_notes: reportNotes,
          status: 'submitted',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      );

      if (error) throw error;

      toast.success('Report Submitted', 'Session summary dispatched to the Director for approval review.');
      setShowSubmitReportModal(false);
      setReportNotes('');
    } catch (err: any) {
      toast.error('Failed to submit report', err.message);
    } finally {
      setReportSubmitting(false);
    }
  };

  // Data Filtering, Sorting & Pagination
  const filteredRoster = useMemo(() => {
    let result = roster.filter((item) => {
      const matchesSearch =
        item.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let valA = a[sortBy === 'roll' ? 'roll_number' : sortBy === 'name' ? 'student_name' : 'status'];
      let valB = b[sortBy === 'roll' ? 'roll_number' : sortBy === 'name' ? 'student_name' : 'status'];
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return result;
  }, [roster, searchTerm, statusFilter, sortBy, sortOrder]);

  const paginatedRoster = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return filteredRoster.slice(from, from + pageSize);
  }, [filteredRoster, currentPage, pageSize]);

  // Stats calculation
  const totalEnrolled = roster.length;
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;
  const excusedCount = roster.filter((r) => r.status === 'excused').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const attendanceRate = totalEnrolled > 0 ? Math.round(((presentCount + lateCount + excusedCount) / totalEnrolled) * 100) : 0;

  // Exports
  const handleExportExcel = () => {
    const exportData = roster.map((r) => ({
      'Roll Number': r.roll_number,
      'Student Name': r.student_name,
      Status: r.status.toUpperCase(),
      'Marked At': r.marked_at || 'N/A',
      Method: r.verification_method || 'N/A',
      Remarks: r.remarks || '',
    }));
    exportToExcel(exportData, `Attendance_${activeSession?.session_date || 'Session'}_${activeSession?.subject_offering?.subject?.code || 'Class'}`);
    toast.success('Export Successful', 'Excel roster sheet generated.');
  };

  const handleExportPdf = () => {
    const exportData = roster.map((r) => ({
      roll: r.roll_number,
      name: r.student_name,
      status: r.status.toUpperCase(),
      time: r.marked_at || '—',
      method: (r.verification_method || '—').replace('_', ' '),
    }));

    exportToPdf({
      title: `Session Attendance Roster - ${activeSession?.subject_offering?.subject?.name || 'Class'} (${activeSession?.subject_offering?.subject?.code || ''})`,
      subtitle: `Date: ${activeSession?.session_date} | Slot: ${activeSession?.start_time} - ${activeSession?.end_time} | Section: ${activeSession?.section?.name || 'A'} | Room: ${activeSession?.classroom?.room_number || ''}`,
      filename: `Attendance_Report_${activeSession?.session_date}`,
      columns: [
        { header: 'Roll Number', dataKey: 'roll' },
        { header: 'Student Name', dataKey: 'name' },
        { header: 'Attendance Status', dataKey: 'status' },
        { header: 'Time Marked', dataKey: 'time' },
        { header: 'Verification Method', dataKey: 'method' },
      ],
      data: exportData,
    });
    toast.success('Export Successful', 'PDF report downloaded.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Session Picker & Primary Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              {activeSession?.subject_offering?.subject?.code || 'CS501'} • {activeSession?.session_type?.toUpperCase() || 'LECTURE'}
            </span>
            <StatusBadge status={activeSession?.status || 'scheduled'} />
            {activeSession?.is_attendance_locked && (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                <Lock className="h-3 w-3" /> AUDIT LOCKED
              </span>
            )}
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeSession?.subject_offering?.subject?.name || 'Operating Systems'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Date: <span className="font-semibold text-slate-700">{activeSession?.session_date}</span> • Slot:{' '}
            <span className="font-semibold text-slate-700">{activeSession?.start_time} - {activeSession?.end_time}</span> • Classroom:{' '}
            <span className="font-semibold text-slate-700">{activeSession?.classroom?.room_number} ({activeSession?.classroom?.building})</span> • Section:{' '}
            <span className="font-semibold text-slate-700">{activeSession?.section?.name}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switch Session Dropdown */}
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="text-xs font-semibold py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
          >
            {sessionsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_date} ({s.start_time.substring(0, 5)}) - {s.subject_offering?.subject?.code} ({s.status})
              </option>
            ))}
          </select>

          {activeSession?.status !== 'in_progress' ? (
            <button
              onClick={() => handleSessionStatusChange('in_progress')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Play className="h-4 w-4" /> Start Session
            </button>
          ) : (
            <button
              onClick={() => setShowEndSessionDialog(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Square className="h-4 w-4" /> End Session
            </button>
          )}

          <button
            onClick={handleToggleLock}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all ${
              activeSession?.is_attendance_locked
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Lock className="h-4 w-4" />
            {activeSession?.is_attendance_locked ? 'Unlock' : 'Lock Roster'}
          </button>

          <button
            onClick={() => setShowSubmitReportModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Send className="h-4 w-4" /> Submit Report
          </button>

          <a
            href="http://localhost:5174"
            target="_blank"
            rel="noreferrer"
            className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Launch Classroom Kiosk Display"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Enrolled Capacity</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalEnrolled}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Section Roster</div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">Present (Live)</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{presentCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">{attendanceRate}% Rate</div>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-700 uppercase">Late</div>
          <div className="text-2xl font-black text-amber-800 mt-1">{lateCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Grace period exceeded</div>
        </div>

        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 shadow-sm">
          <div className="text-[11px] font-bold text-blue-700 uppercase">Excused</div>
          <div className="text-2xl font-black text-blue-800 mt-1">{excusedCount}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Approved Duty/Medical</div>
        </div>

        <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="text-[11px] font-bold text-rose-700 uppercase">Absent</div>
          <div className="text-2xl font-black text-rose-800 mt-1">{absentCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">{100 - attendanceRate}% Absentee</div>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or roll..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Pills */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs">
              {['all', 'present', 'absent', 'late', 'excused'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setStatusFilter(tab);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg capitalize font-semibold transition-all ${
                    statusFilter === tab
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Export buttons */}
            <button
              onClick={handleExportExcel}
              className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden md:inline">Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Export to PDF (.pdf)"
            >
              <FileText className="h-4 w-4 text-rose-600" />
              <span className="hidden md:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : paginatedRoster.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">No students found matching your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setSortBy('roll');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Roll Number {sortBy === 'roll' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setSortBy('name');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Student Name {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4">Verification Method</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Audit Note / Reason</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRoster.map((item) => (
                  <tr key={item.student_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{item.roll_number}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{item.student_name}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      {item.verification_method === 'dynamic_qr' ? (
                        <span className="flex items-center gap-1 font-medium text-indigo-600">
                          <ShieldCheck className="h-3.5 w-3.5" /> Dynamic QR
                        </span>
                      ) : item.verification_method === 'manual_faculty' ? (
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <UserCheck className="h-3.5 w-3.5" /> Faculty Override
                        </span>
                      ) : item.verification_method === 'leave_override' ? (
                        <span className="flex items-center gap-1 font-medium text-blue-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Excused Leave
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{item.marked_at || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">{item.remarks || '—'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedStudentForManual(item);
                          setManualStatus(item.status);
                          setManualReason('');
                        }}
                        disabled={activeSession?.is_attendance_locked}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                      >
                        Correct / Mark
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <TablePagination
          currentPage={currentPage}
          totalRecords={filteredRoster.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Manual Attendance Marking / Correction Modal */}
      {selectedStudentForManual && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStudentForManual(null)}
          title="Manual Attendance Marking / Correction"
          subtitle={`Student: ${selectedStudentForManual.student_name} (${selectedStudentForManual.roll_number})`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveManualAttendance} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-bold">Audit Compliance Requirement:</span>
                <p className="mt-0.5 leading-relaxed">
                  All manual changes bypass the dynamic QR cryptographic gate and are logged with your user ID and timestamp in the immutable audit table.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Attendance Classification</label>
              <div className="grid grid-cols-4 gap-2">
                {(['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((st) => (
                  <button
                    type="button"
                    key={st}
                    onClick={() => setManualStatus(st)}
                    className={`py-2 text-xs font-bold rounded-xl capitalize border transition-all ${
                      manualStatus === st
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Reason / Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="State mandatory justification (e.g. Student phone battery exhausted, authorized college event participation, medical certificate attached)..."
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedStudentForManual(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={manualSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
              >
                {manualSubmitting ? 'Recording Audit...' : 'Save & Log Correction'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Submit Session Report Modal */}
      {showSubmitReportModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSubmitReportModal(false)}
          title="Submit Session Attendance Report to Director"
          subtitle="Dispatches consolidated lecture attendance to Academic Administration"
          maxWidth="md"
        >
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-1 text-indigo-900">
              <div className="flex justify-between">
                <span>Total Registered:</span>
                <span className="font-bold">{totalEnrolled}</span>
              </div>
              <div className="flex justify-between">
                <span>Present / Attended:</span>
                <span className="font-bold text-emerald-700">{presentCount + lateCount + excusedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Absentee Count:</span>
                <span className="font-bold text-rose-700">{absentCount}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-indigo-200">
                <span>Attendance Percentage:</span>
                <span>{attendanceRate}%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Academic Notes</label>
              <textarea
                rows={3}
                placeholder="Optional comments regarding student engagement, topics covered, or reasons for abnormal absenteeism..."
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSubmitReportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
              >
                {reportSubmitting ? 'Transmitting...' : 'Submit Final Report'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* End Session Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showEndSessionDialog}
        onClose={() => setShowEndSessionDialog(false)}
        onConfirm={async () => {
          await handleSessionStatusChange('completed');
          setShowEndSessionDialog(false);
        }}
        title="End Lecture Session?"
        message="Are you sure you want to end this attendance session? Check-ins from classroom smart displays will be closed."
        confirmText="End Lecture Session"
        variant="warning"
      />
    </div>
  );
};
