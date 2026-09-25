import React, { useState } from 'react';
import { mockLeaveRequests, mockAdjustmentRequests } from '../data/mockData';
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  AlertCircle,
  User
} from 'lucide-react';

export const LeaveReviewView: React.FC = () => {
  const [leaves, setLeaves] = useState(mockLeaveRequests);
  const [adjustments, setAdjustments] = useState(mockAdjustmentRequests);

  const handleApproveLeave = (id: string) => {
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'approved' as const, approved_by: 'Dr. Aris Thorne (HOD)' } : l))
    );
  };

  const handleRejectLeave = (id: string) => {
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'rejected' as const } : l))
    );
  };

  const handleApproveAdjustment = (id: string) => {
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'approved' as const } : a))
    );
  };

  const handleRejectAdjustment = (id: string) => {
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected' as const } : a))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Leave Applications & Attendance Disputes</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Review medical certificates, academic duty leaves, and post-session attendance disputes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Applications Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Medical & Academic Duty Leaves
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                {leaves.filter((l) => l.status === 'pending').length} Pending
              </span>
            </div>

            <div className="space-y-3">
              {leaves.map((leave) => (
                <div key={leave.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                      {leave.leave_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {leave.start_date} to {leave.end_date}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium mb-3 leading-relaxed">{leave.reason}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div>
                      {leave.status === 'pending' ? (
                        <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Awaiting HOD Approval
                        </span>
                      ) : leave.status === 'approved' ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Rejected
                        </span>
                      )}
                    </div>

                    {leave.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveLeave(leave.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeave(leave.id)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attendance Adjustment Requests */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                Attendance Adjustment / Dispute Requests
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                {adjustments.filter((a) => a.status === 'pending').length} Pending
              </span>
            </div>

            <div className="space-y-3">
              {adjustments.map((adj) => (
                <div key={adj.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Rohan Gupta (23CSE003)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">
                      Claim: {adj.requested_status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium mb-3 leading-relaxed">{adj.reason}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div>
                      {adj.status === 'pending' ? (
                        <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Under Faculty Review
                        </span>
                      ) : adj.status === 'approved' ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Adjusted to Present
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Disallowed
                        </span>
                      )}
                    </div>

                    {adj.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveAdjustment(adj.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Grant Attendance
                        </button>
                        <button
                          onClick={() => handleRejectAdjustment(adj.id)}
                          className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
