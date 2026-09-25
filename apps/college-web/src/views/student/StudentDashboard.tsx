import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  FileText,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';

interface StudentSubjectSummary {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  total_held: number;
  attended_count: number;
  present_count: number;
  late_count: number;
  excused_count: number;
  absent_count: number;
  attendance_percentage: number;
  threshold_status: 'good' | 'warning' | 'critical';
}

interface DateWiseRecord {
  id: string;
  marked_at: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  verification_method: string;
  remarks: string | null;
  session: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    session_type: string;
    subject_name: string;
    subject_code: string;
    classroom_number: string;
  };
}

interface LeaveAppItem {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  status: string;
  created_at: string;
}

export const StudentDashboard: React.FC = () => {
  const { profile, studentRecord } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gauge' | 'records' | 'schedule' | 'leaves'>('gauge');

  // Real Database state
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [subjectSummaries, setSubjectSummaries] = useState<StudentSubjectSummary[]>([]);
  const [dateWiseRecords, setDateWiseRecords] = useState<DateWiseRecord[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveAppItem[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);

  // Correction Request Modal
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<DateWiseRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionEvidence, setCorrectionEvidence] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // New Leave Modal
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveType, setLeaveType] = useState('medical');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const fetchStudentData = async () => {
    try {
      setLoading(true);

      // 1. Identify active student
      let sId = studentRecord?.id;
      let sInfo = studentRecord;

      if (!sId) {
        // Fallback to first student in database (e.g. Aarav Patel)
        const { data: firstStud } = await supabase
          .from('students')
          .select('*, profile:profiles(*), current_section:sections(*)')
          .limit(1)
          .single();

        if (firstStud) {
          sId = firstStud.id;
          sInfo = firstStud;
        }
      }

      if (!sId) {
        setLoading(false);
        return;
      }

      setStudentInfo(sInfo);

      // 2. Fetch canonical attendance summary from DB View
      const { data: viewData, error: viewErr } = await supabase
        .from('v_student_attendance_summary')
        .select('*')
        .eq('student_id', sId);

      if (viewErr) throw viewErr;
      setSubjectSummaries((viewData as any) || []);

      // 3. Fetch date-wise attendance records
      const { data: recData, error: recErr } = await supabase
        .from('attendance_records')
        .select(`
          id,
          marked_at,
          status,
          verification_method,
          remarks,
          session:attendance_sessions(
            id,
            session_date,
            start_time,
            end_time,
            session_type,
            classroom:classrooms(room_number),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            )
          )
        `)
        .eq('student_id', sId)
        .order('marked_at', { ascending: false });

      if (recErr) throw recErr;

      const formattedRecords: DateWiseRecord[] = (recData || []).map((r: any) => ({
        id: r.id,
        marked_at: r.marked_at,
        status: r.status,
        verification_method: r.verification_method,
        remarks: r.remarks,
        session: {
          id: r.session?.id,
          session_date: r.session?.session_date,
          start_time: r.session?.start_time,
          end_time: r.session?.end_time,
          session_type: r.session?.session_type,
          subject_name: r.session?.subject_offering?.subject?.name || 'Class Lecture',
          subject_code: r.session?.subject_offering?.subject?.code || 'SUB',
          classroom_number: r.session?.classroom?.room_number || 'TBA'
        }
      }));
      setDateWiseRecords(formattedRecords);

      // 4. Fetch leaves
      const { data: leaves } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('student_id', sId)
        .order('created_at', { ascending: false });

      setLeaveHistory(leaves || []);

      // 5. Fetch Today's Timetable for Student's section
      const sectionId = (sInfo as any)?.current_section_id || (sInfo as any)?.current_section?.id;
      if (sectionId) {
        const todayDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay(); // 1=Mon, 7=Sun
        const { data: sched } = await supabase
          .from('timetable_entries')
          .select(`
            id,
            start_time,
            end_time,
            classroom:classrooms(room_number, building),
            faculty:faculty(profile:profiles(first_name, last_name)),
            subject_offering:subject_offerings(subject:subjects(name, code))
          `)
          .eq('section_id', sectionId)
          .eq('day_of_week', todayDayOfWeek)
          .order('start_time', { ascending: true });

        setTodaySchedule(sched || []);
      }
    } catch (err: any) {
      console.error('Error fetching student portal:', err);
      addToast({
        title: 'Failed to Load Portal',
        message: err.message || 'Could not load student attendance gauge.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentRecord]);

  // Overall attendance calculation
  const totalHeldAll = subjectSummaries.reduce((acc, s) => acc + s.total_held, 0);
  const totalAttendedAll = subjectSummaries.reduce((acc, s) => acc + s.attended_count, 0);
  const overallPercentage = totalHeldAll > 0 ? Math.round((totalAttendedAll / totalHeldAll) * 100) : 100;

  // Submit Leave Application
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInfo?.id) return;

    try {
      setSubmittingLeave(true);
      const { error } = await supabase.from('leave_applications').insert({
        student_id: studentInfo.id,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        leave_type: leaveType,
        reason: leaveReason,
        status: 'pending'
      });

      if (error) throw error;

      addToast({
        title: 'Leave Submitted',
        message: 'Your leave application was sent to your HOD for approval.',
        type: 'success'
      });

      setIsLeaveModalOpen(false);
      setLeaveReason('');
      fetchStudentData();
    } catch (err: any) {
      addToast({
        title: 'Submission Error',
        message: err.message || 'Could not submit leave application.',
        type: 'error'
      });
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Submit Attendance Correction / Dispute Request
  const handleSubmitCorrection = async () => {
    if (!selectedRecordForCorrection || !studentInfo?.id) return;

    try {
      setSubmittingCorrection(true);

      const { error } = await supabase.from('attendance_adjustment_requests').insert({
        student_id: studentInfo.id,
        session_id: selectedRecordForCorrection.session.id,
        requested_status: 'present',
        reason: correctionReason,
        evidence_url: correctionEvidence || null,
        status: 'pending'
      });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'ATTENDANCE_CORRECTION_REQUESTED',
        entity_type: 'attendance_record',
        entity_id: selectedRecordForCorrection.id,
        details: {
          session_id: selectedRecordForCorrection.session.id,
          reason: correctionReason
        }
      });

      addToast({
        title: 'Correction Requested',
        message: 'Dispute submitted for instructor and HOD verification.',
        type: 'success'
      });

      setSelectedRecordForCorrection(null);
      setCorrectionReason('');
      setCorrectionEvidence('');
    } catch (err: any) {
      addToast({
        title: 'Request Failed',
        message: err.message || 'Could not submit correction request.',
        type: 'error'
      });
    } finally {
      setSubmittingCorrection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-indigo-900/40 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <GraduationCap className="h-4 w-4" />
              <span>CampusAttend Student Portal</span>
            </div>
            <h1 className="text-2xl font-black mt-1">
              {studentInfo?.profile ? `${studentInfo.profile.first_name} ${studentInfo.profile.last_name}` : 'Student Dashboard'}
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Roll No: <span className="text-white font-mono font-bold">{studentInfo?.roll_number || 'N/A'}</span> &bull; Section: <span className="text-white font-bold">{studentInfo?.current_section?.name || 'Assigned'}</span> &bull; Batch: <span className="text-white font-bold">{studentInfo?.batch_year || '2026'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              <span>Apply for Leave</span>
            </button>

            <button
              onClick={fetchStudentData}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Attendance KPI Gauge */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-semibold block">Cumulative Attendance</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-3xl font-black ${
                overallPercentage >= 75 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {overallPercentage}%
              </span>
              <span className="text-[11px] text-slate-300">
                ({totalAttendedAll} / {totalHeldAll} classes)
              </span>
            </div>
            <p className={`text-[10px] mt-1 font-semibold ${
              overallPercentage >= 75 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {overallPercentage >= 75 ? 'Satisfies 75% Statutory Exam Criteria' : 'Statutory Shortage! Exam Debarment Risk'}
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-semibold block">Subjects Enrolled</span>
            <div className="text-2xl font-bold text-white mt-1">{subjectSummaries.length}</div>
            <span className="text-[10px] text-indigo-300">Active Curriculum Courses</span>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-semibold block">Today's Lectures</span>
            <div className="text-2xl font-bold text-indigo-300 mt-1">{todaySchedule.length}</div>
            <span className="text-[10px] text-slate-400">Classroom Sessions</span>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-semibold block">Leave Status</span>
            <div className="text-2xl font-bold text-white mt-1">
              {leaveHistory.filter((l) => l.status === 'pending').length} Pending
            </div>
            <span className="text-[10px] text-slate-400">Applications Recorded</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('gauge')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'gauge'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Subject-Wise Gauge ({subjectSummaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'records'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Date-Wise Records & Disputes ({dateWiseRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'schedule'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Today's Schedule ({todaySchedule.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-2 border-b-2 ${
            activeTab === 'leaves'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>My Leave Applications ({leaveHistory.length})</span>
        </button>
      </div>

      {/* Tab 1: Subject-Wise Breakdown with Statutory Recovery Math */}
      {activeTab === 'gauge' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectSummaries.map((sub) => {
            const isShort = sub.attendance_percentage < 75;
            // Exact Statutory Recovery Math: X = ceil(3H - 4A)
            const classesNeeded = Math.max(0, Math.ceil(3 * sub.total_held - 4 * sub.attended_count));

            return (
              <div
                key={sub.subject_id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                      {sub.subject_code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{sub.subject_name}</h3>
                  </div>

                  <div className="text-right">
                    <span className={`text-xl font-black ${
                      sub.attendance_percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {sub.attendance_percentage}%
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {sub.attended_count} / {sub.total_held} classes
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      sub.attendance_percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, sub.attendance_percentage)}%` }}
                  />
                </div>

                {/* Breakdown metrics */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1 border-t border-slate-100">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Present</span>
                    <span className="font-bold text-emerald-600">{sub.present_count}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Late</span>
                    <span className="font-bold text-amber-600">{sub.late_count}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Excused</span>
                    <span className="font-bold text-indigo-600">{sub.excused_count}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Absent</span>
                    <span className="font-bold text-rose-600">{sub.absent_count}</span>
                  </div>
                </div>

                {/* Statutory Recovery Advice */}
                {isShort ? (
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200/80 text-rose-800 text-xs flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <div>
                      <strong>Attendance Shortage Alert:</strong> You must attend the next{' '}
                      <span className="font-bold underline">{classesNeeded} consecutive classes</span> to recover statutory 75% eligibility.
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 text-emerald-800 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Eligible for semester end-term examinations.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Date-Wise Records & Dispute Actions */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Date-Wise Attendance Trail</h3>
            <span className="text-xs text-slate-500">Official Campus Log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Verification Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dateWiseRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No attendance records logged yet.
                    </td>
                  </tr>
                ) : (
                  dateWiseRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {r.session.session_date} &bull; {r.session.start_time.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.session.subject_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.session.subject_code}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        Room {r.session.classroom_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 capitalize">
                          {r.verification_method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            r.status === 'present' ? 'success' :
                            r.status === 'late' ? 'warning' :
                            r.status === 'excused' ? 'info' : 'danger'
                          }
                        >
                          {r.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.status === 'absent' && (
                          <button
                            onClick={() => setSelectedRecordForCorrection(r)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg transition"
                          >
                            Dispute / Correct
                          </button>
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

      {/* Tab 3: Today's Schedule */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-800">Today's Class Schedule</h3>
          {todaySchedule.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No classes scheduled for today. Enjoy your study day!
            </p>
          ) : (
            <div className="space-y-3">
              {todaySchedule.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 text-white font-mono font-bold px-3 py-2 rounded-xl text-center">
                      {slot.start_time.slice(0, 5)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {slot.subject_offering?.subject?.name}
                      </h4>
                      <p className="text-slate-500 text-[11px]">
                        Instructor:{' '}
                        {slot.faculty?.profile ? `${slot.faculty.profile.first_name} ${slot.faculty.profile.last_name}` : 'Faculty'} &bull; Room {slot.classroom?.room_number}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">Scheduled</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Leave History */}
      {activeTab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">My Leave History</h3>
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              + New Leave
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No leave applications submitted yet.
                    </td>
                  </tr>
                ) : (
                  leaveHistory.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {l.start_date} to {l.end_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {l.leave_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                        {l.reason}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            l.status === 'approved' ? 'success' :
                            l.status === 'rejected' ? 'danger' : 'warning'
                          }
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(l.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Application Modal */}
      {isLeaveModalOpen && (
        <Modal
          isOpen={isLeaveModalOpen}
          onClose={() => setIsLeaveModalOpen(false)}
          title="Submit Student Leave Application"
          subtitle="Official application will be routed to your Head of Department for review."
        >
          <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">End Date *</label>
                <input
                  type="date"
                  required
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Category / Type *</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl capitalize"
              >
                <option value="medical">Medical Leave (Sick / Health)</option>
                <option value="duty">Academic Duty / College Event</option>
                <option value="personal">Personal / Family Emergency</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Detailed Reason *</label>
              <textarea
                required
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="State reason for absence..."
                className="w-full h-20 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingLeave}
                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-sm transition"
              >
                {submittingLeave ? 'Submitting...' : 'Submit Leave'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Attendance Dispute / Correction Modal */}
      {selectedRecordForCorrection && (
        <Modal
          isOpen={!!selectedRecordForCorrection}
          onClose={() => setSelectedRecordForCorrection(null)}
          title="Attendance Dispute & Correction Request"
          subtitle={`Lecture: ${selectedRecordForCorrection.session.subject_name} on ${selectedRecordForCorrection.session.session_date}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-slate-600">
                You were marked <strong>ABSENT</strong> on {selectedRecordForCorrection.session.session_date}.
                If you were physically present in Room {selectedRecordForCorrection.session.classroom_number} or had approved duty leave, submit your dispute below.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reason for Dispute *</label>
              <textarea
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Explain why you were present (e.g. dynamic QR scan timeout, student council event)..."
                className="w-full h-20 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supporting Evidence URL (Optional)</label>
              <input
                type="url"
                value={correctionEvidence}
                onChange={(e) => setCorrectionEvidence(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedRecordForCorrection(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCorrection}
                disabled={submittingCorrection || !correctionReason.trim()}
                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-sm transition"
              >
                {submittingCorrection ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
