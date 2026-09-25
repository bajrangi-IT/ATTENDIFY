import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Search,
  BookOpen
} from 'lucide-react';

export const ReportApprovalWorkflow: React.FC = () => {
  const { profile } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | 'changes_requested'>('approved');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_session_reports')
        .select(`
          id, session_id, total_enrolled, present_count, late_count, excused_count, absent_count,
          submission_notes, status, reviewed_at, review_remarks,
          session:attendance_sessions(
            session_date, start_time, end_time, session_type,
            subject_offering:subject_offerings(subject:subjects(code, name)),
            section:sections(name),
            classroom:classrooms(room_number)
          ),
          faculty:faculty(profile:profiles(first_name, last_name, email))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      toast.error('Failed to load reports', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleProcessReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('attendance_session_reports')
        .update({
          status: actionType,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          review_remarks: reviewRemarks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast.success(
        'Report Updated',
        `Attendance session report marked as ${actionType.toUpperCase().replace('_', ' ')}.`
      );
      setSelectedReport(null);
      setReviewRemarks('');
      fetchReports();
    } catch (err: any) {
      toast.error('Failed to update report', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Teacher Session Reports & Director Approval Workflow
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Review, validate, approve or request changes to lecture attendance reports submitted by faculty.
          </p>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Submitted Session Reports ({reports.length})</h2>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">No pending session reports submitted.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date & Slot</th>
                  <th className="py-3 px-4">Subject & Section</th>
                  <th className="py-3 px-4">Teacher</th>
                  <th className="py-3 px-4 text-center">Enrolled</th>
                  <th className="py-3 px-4 text-center">Attended</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => {
                  const attended = r.present_count + r.late_count + r.excused_count;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900">{r.session?.session_date}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.session?.start_time?.substring(0, 5)} - {r.session?.end_time?.substring(0, 5)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-indigo-700">
                          {r.session?.subject_offering?.subject?.code}: {r.session?.subject_offering?.subject?.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.session?.section?.name} • Room {r.session?.classroom?.room_number}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {r.faculty?.profile?.first_name} {r.faculty?.profile?.last_name}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">{r.total_enrolled}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">{attended}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">{r.absent_count}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setActionType('approved');
                            setReviewRemarks(r.review_remarks || '');
                          }}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors"
                        >
                          Review & Decide
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedReport && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReport(null)}
          title="Review Academic Session Report"
          subtitle={`Class: ${selectedReport.session?.subject_offering?.subject?.code} | Faculty: ${selectedReport.faculty?.profile?.first_name} ${selectedReport.faculty?.profile?.last_name}`}
          maxWidth="md"
        >
          <form onSubmit={handleProcessReport} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Lecture Date:</span>
                <span className="font-semibold text-slate-800">{selectedReport.session?.session_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Attendance Ratio:</span>
                <span className="font-bold text-slate-900">
                  {selectedReport.present_count + selectedReport.late_count + selectedReport.excused_count} / {selectedReport.total_enrolled} ({Math.round(((selectedReport.present_count + selectedReport.late_count + selectedReport.excused_count) / selectedReport.total_enrolled) * 100)}%)
                </span>
              </div>
              {selectedReport.submission_notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-bold block mb-0.5">Faculty Notes:</span>
                  <p className="text-slate-700 italic">{selectedReport.submission_notes}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Director Action</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActionType('approved')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    actionType === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Approve Report
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('changes_requested')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    actionType === 'changes_requested'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('rejected')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    actionType === 'rejected'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Reject Report
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Director Remarks / Instructions</label>
              <textarea
                rows={3}
                placeholder="Enter feedback or instructions for faculty regarding this session..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Save Decision'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
