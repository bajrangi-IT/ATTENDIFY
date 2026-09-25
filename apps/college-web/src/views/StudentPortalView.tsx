import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Calendar,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { calculateAttendanceMetrics } from '@campusattend/attendance-sdk';

export const StudentPortalView: React.FC = () => {
  const [selectedStudent, setSelectedStudent] = useState<'aarav' | 'rohan'>('aarav');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Profile data
  interface StudentViewData {
    name: string;
    roll: string;
    reg: string;
    section: string;
    percentage: number;
    status: 'good' | 'warning' | 'critical';
    attended: number;
    total: number;
    canMiss: number;
    needed: number;
  }

  const student: StudentViewData = selectedStudent === 'aarav'
    ? {
        name: 'Aarav Patel',
        roll: '23CSE001',
        reg: 'REG-2023-CS-001',
        section: 'B.Tech CSE - Section A (Sem 5)',
        percentage: 95.8,
        status: 'good',
        attended: 23,
        total: 24,
        canMiss: 6,
        needed: 0,
      }
    : {
        name: 'Rohan Gupta',
        roll: '23CSE003',
        reg: 'REG-2023-CS-003',
        section: 'B.Tech CSE - Section A (Sem 5)',
        percentage: 58.3,
        status: 'critical',
        attended: 14,
        total: 24,
        canMiss: 0,
        needed: 16,
      };

  const subjects = [
    { code: 'CS501', name: 'Operating Systems', held: 24, attended: selectedStudent === 'aarav' ? 23 : 14, faculty: 'Prof. Vikram Sharma' },
    { code: 'CS502', name: 'Database Management', held: 22, attended: selectedStudent === 'aarav' ? 21 : 12, faculty: 'Dr. Priya Nair' },
    { code: 'CS503', name: 'Design & Analysis of Algorithms', held: 20, attended: selectedStudent === 'aarav' ? 19 : 13, faculty: 'Dr. Aris Thorne' },
    { code: 'CS504', name: 'OS & DBMS Laboratory', held: 8, attended: selectedStudent === 'aarav' ? 8 : 4, faculty: 'Prof. Vikram Sharma' },
  ];

  const handleSubmitDispute = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setShowDisputeModal(false);
      setDisputeReason('');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Header & Persona Switcher */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              STUDENT ATTENDANCE CONSOLE
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">{student.reg}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{student.name}</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Roll Number: <span className="font-semibold text-slate-700">{student.roll}</span> • {student.section}
          </p>
        </div>

        {/* Switch demo student */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-semibold px-2">Demo View:</span>
          <button
            onClick={() => setSelectedStudent('aarav')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedStudent === 'aarav' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Aarav (95.8% Good)
          </button>
          <button
            onClick={() => setSelectedStudent('rohan')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedStudent === 'rohan' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Rohan (58.3% Shortage)
          </button>
        </div>
      </div>

      {/* Main Attendance Gauge Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Circular Percentage Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center text-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="14"
                className="text-slate-100"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="14"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * student.percentage) / 100}
                strokeLinecap="round"
                className={
                  student.status === 'good'
                    ? 'text-emerald-500'
                    : student.status === 'warning'
                    ? 'text-amber-500'
                    : 'text-rose-500'
                }
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                {student.percentage}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Overall Rate</span>
            </div>
          </div>

          <div className="mt-4">
            {student.status === 'good' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Examination Eligible (Good)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Attendance Shortage Alert
              </span>
            )}
          </div>
        </div>

        {/* Predictive Threshold Analysis */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Automated Statutory Threshold Analysis (75% Rule)
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Based on the Apex Institute Academic Regulation, students must maintain minimum 75.0% canonical attendance across all finalized lecture sessions to qualify for end-semester exams.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Safe Leave Buffer</span>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {student.canMiss > 0 ? `${student.canMiss} Classes` : '0 Classes'}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Classes you can safely miss while remaining above 75.0%
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Recovery Target</span>
                <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
                  {student.needed > 0 ? `${student.needed} Consecutive` : 'None Required'}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Consecutive sessions you must attend to cross the 75% threshold
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Notice an incorrect absence?</span>
            <button
              onClick={() => setShowDisputeModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Submit Attendance Dispute
            </button>
          </div>
        </div>
      </div>

      {/* Subject-Wise Attendance Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Enrolled Subject Performance</h2>
          <p className="text-xs text-slate-500">Breakdown of attended sessions versus finalized conducted sessions.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Instructor</th>
                <th className="py-3 px-4 text-center">Conducted</th>
                <th className="py-3 px-4 text-center">Attended</th>
                <th className="py-3 px-4">Percentage</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((sub) => {
                const pct = Math.round((sub.attended / sub.held) * 100);
                return (
                  <tr key={sub.code} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-indigo-700">{sub.code}</span>: {sub.name}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{sub.faculty}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">{sub.held}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">{sub.attended}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 w-10">{pct}%</span>
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {pct >= 75 ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          COMPLIANT
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          SHORTAGE
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Submit Attendance Adjustment</h3>
            <p className="text-xs text-slate-500 mb-4">
              File an official attendance dispute for faculty & HOD review.
            </p>

            {submitted ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold text-center">
                Dispute submitted successfully! Ticket dispatched to Prof. Vikram Sharma.
              </div>
            ) : (
              <form onSubmit={handleSubmitDispute} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject Session</label>
                  <select className="w-full text-xs p-2.5 border border-slate-300 rounded-xl">
                    <option>CS501: Operating Systems (Yesterday 09:00 AM)</option>
                    <option>CS502: Database Management (18 Mar 10:15 AM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Explanation Reason</label>
                  <textarea
                    rows={3}
                    required
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Describe why attendance was missed (e.g. mobile scanner camera error, hospital visit)..."
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
                  >
                    Submit Dispute
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
