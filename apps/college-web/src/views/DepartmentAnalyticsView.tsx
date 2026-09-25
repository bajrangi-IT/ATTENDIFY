import React, { useState } from 'react';
import { mockDepartmentSummaries } from '../data/mockData';
import {
  BarChart3,
  AlertTriangle,
  Send,
  Download,
  Users,
  CheckCircle,
  FileText,
  Filter
} from 'lucide-react';

export const DepartmentAnalyticsView: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'good'>('all');
  const [alertSent, setAlertSent] = useState(false);

  const summaries = mockDepartmentSummaries;

  const filteredSummaries = summaries.filter((s) => {
    if (filter === 'all') return true;
    return s.threshold_status === filter;
  });

  const criticalCount = summaries.filter((s) => s.threshold_status === 'critical').length;
  const warningCount = summaries.filter((s) => s.threshold_status === 'warning').length;

  const triggerDefaulterAlerts = () => {
    setAlertSent(true);
    setTimeout(() => setAlertSent(false), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
              DEPARTMENT OF COMPUTER SCIENCE & ENG.
            </span>
            <span className="text-xs text-slate-500 font-medium">Head of Department: Dr. Aris Thorne</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Department Attendance Analytics</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time threshold calculations from finalized, non-cancelled academic sessions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerDefaulterAlerts}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Dispatch Defaulter Notice ({criticalCount})
          </button>

          <button
            onClick={() => alert('Department report exported to PDF.')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Export Report
          </button>
        </div>
      </div>

      {alertSent && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Automatic SMS & Email warnings dispatched to all students below the statutory 75.0% threshold.
          </div>
          <button onClick={() => setAlertSent(false)} className="text-rose-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Analytics KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
            <span>Dept. Average</span>
            <BarChart3 className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">80.8%</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">▲ 2.4% vs last academic term</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
            <span>Lectures Held</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">96</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">4 Cancelled (Excluded from basis)</p>
        </div>

        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-700 font-bold uppercase">
            <span>Warning Watch (75-80%)</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-800 mt-2">{warningCount} Students</div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Borderline attendance shortage</p>
        </div>

        <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold uppercase">
            <span>Critical Defaulters (&lt;75%)</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-800 mt-2">{criticalCount} Students</div>
          <p className="text-[11px] text-rose-700 font-medium mt-1">Ineligible for Semester End Exams</p>
        </div>
      </div>

      {/* Defaulter & Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Student Attendance Roster & Examination Eligibility</h2>
            <p className="text-xs text-slate-500">Calculated strictly per university statutory requirement (75% minimum attendance)</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({summaries.length})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === 'critical' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-100'
              }`}
            >
              Critical Shortage ({criticalCount})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === 'warning' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-100'
              }`}
            >
              Warning ({warningCount})
            </button>
            <button
              onClick={() => setFilter('good')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === 'good' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Eligible
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4 text-center">Conducted</th>
                <th className="py-3 px-4 text-center">Attended</th>
                <th className="py-3 px-4 text-center">Absent</th>
                <th className="py-3 px-4">Percentage</th>
                <th className="py-3 px-4">Exam Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.map((s) => (
                <tr key={s.student_id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.roll_number}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">{s.student_name}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-indigo-700">{s.subject_code}</span>: {s.subject_name}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold">{s.total_conducted_sessions}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">{s.attended_sessions}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">{s.absent_sessions}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 w-12">{s.attendance_percentage}%</span>
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            s.attendance_percentage >= 80
                              ? 'bg-emerald-500'
                              : s.attendance_percentage >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${s.attendance_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {s.threshold_status === 'good' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ELIGIBLE
                      </span>
                    ) : s.threshold_status === 'warning' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        WARNING (75.0%)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        DETAINED / SHORTAGE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
