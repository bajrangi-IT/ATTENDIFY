import React, { useState } from 'react';
import { initialStudentsRoster, RosterStudent } from '../data/mockData';
import { AttendanceStatus } from '@campusattend/shared-types';
import {
  Play,
  Square,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  FileDown
} from 'lucide-react';

export const LiveSessionView: React.FC = () => {
  const [roster, setRoster] = useState<RosterStudent[]>(initialStudentsRoster);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLocked, setIsLocked] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'in_progress' | 'completed' | 'cancelled'>('in_progress');

  // Stats
  const total = roster.length;
  const presentCount = roster.filter((s) => s.status === 'present').length;
  const lateCount = roster.filter((s) => s.status === 'late').length;
  const excusedCount = roster.filter((s) => s.status === 'excused').length;
  const absentCount = roster.filter((s) => s.status === 'absent').length;
  const presentPercentage = Math.round(((presentCount + lateCount + excusedCount) / total) * 100);

  // Manual status override
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    if (isLocked) {
      alert('Session is locked against changes.');
      return;
    }
    setRoster((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              status: newStatus,
              method: 'manual_faculty',
              markedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : s
      )
    );
  };

  const filteredRoster = roster.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openSmartDisplayKiosk = () => {
    window.open('http://localhost:5174', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Session Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              CS501 • LECTURE
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {sessionStatus === 'in_progress' ? 'SESSION IN PROGRESS' : sessionStatus.toUpperCase()}
            </span>
            {isLocked && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                <Lock className="h-3 w-3" /> AUDIT LOCKED
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operating Systems (Sem 5 - Section A)</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Instructor: <span className="font-semibold text-slate-700">Prof. Vikram Sharma</span> • Classroom: <span className="font-semibold text-slate-700">LH-101 (Turing Hall)</span> • Slot: <span className="font-semibold text-slate-700">09:00 AM - 10:00 AM</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openSmartDisplayKiosk}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
            title="Open dedicated classroom smart display"
          >
            <ExternalLink className="h-4 w-4" />
            Launch Classroom Kiosk
          </button>

          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              isLocked
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Lock className="h-4 w-4" />
            {isLocked ? 'Unlock Roster' : 'Lock Roster'}
          </button>

          <button
            onClick={() => setSessionStatus('completed')}
            disabled={sessionStatus === 'completed'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Finalize Session
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Total Enrolled</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Section A Roster</div>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 shadow-sm">
          <div className="text-xs font-bold text-emerald-700 uppercase">Present</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{presentCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Dynamic QR Verified</div>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 shadow-sm">
          <div className="text-xs font-bold text-amber-700 uppercase">Late</div>
          <div className="text-2xl font-black text-amber-800 mt-1">{lateCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">After Grace Period</div>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200/80 shadow-sm">
          <div className="text-xs font-bold text-blue-700 uppercase">Excused</div>
          <div className="text-2xl font-black text-blue-800 mt-1">{excusedCount}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Approved Medical/Duty</div>
        </div>

        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 shadow-sm">
          <div className="text-xs font-bold text-rose-700 uppercase">Absent</div>
          <div className="text-2xl font-black text-rose-800 mt-1">{absentCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">{100 - presentPercentage}% Absentee Rate</div>
        </div>
      </div>

      {/* Roster Table with Search and Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters & Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
              {['all', 'present', 'absent', 'late', 'excused'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
                    statusFilter === tab
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              onClick={() => alert('Attendance report exported to CSV.')}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
              title="Export Session CSV"
            >
              <FileDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Canonical Attendance Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Time Marked</th>
                <th className="py-3 px-4">Notes / Remarks</th>
                <th className="py-3 px-4 text-right">Manual Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.map((student) => {
                const getStatusBadge = () => {
                  switch (student.status) {
                    case 'present':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">PRESENT</span>;
                    case 'late':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">LATE</span>;
                    case 'excused':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">EXCUSED</span>;
                    case 'absent':
                    default:
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">ABSENT</span>;
                  }
                };

                return (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{student.rollNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{student.name}</td>
                    <td className="py-3.5 px-4">{getStatusBadge()}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-500">
                      {student.method === 'dynamic_qr' ? (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <ShieldCheck className="h-3.5 w-3.5" /> Dynamic QR
                        </span>
                      ) : student.method === 'manual_faculty' ? (
                        <span className="flex items-center gap-1 text-slate-600">
                          <UserCheck className="h-3.5 w-3.5" /> Faculty Override
                        </span>
                      ) : student.method === 'leave_override' ? (
                        <span className="flex items-center gap-1 text-blue-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Leave Approval
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{student.markedAt || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-500 italic">{student.remarks || '—'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <button
                          onClick={() => handleStatusChange(student.id, 'present')}
                          disabled={isLocked}
                          className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
                            student.status === 'present' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          P
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'late')}
                          disabled={isLocked}
                          className={`px-2.5 py-1 text-[11px] font-bold border-l border-slate-200 transition-all ${
                            student.status === 'late' ? 'bg-amber-500 text-white' : 'bg-white hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          L
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'excused')}
                          disabled={isLocked}
                          className={`px-2.5 py-1 text-[11px] font-bold border-l border-slate-200 transition-all ${
                            student.status === 'excused' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          E
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'absent')}
                          disabled={isLocked}
                          className={`px-2.5 py-1 text-[11px] font-bold border-l border-slate-200 transition-all ${
                            student.status === 'absent' ? 'bg-rose-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          A
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
