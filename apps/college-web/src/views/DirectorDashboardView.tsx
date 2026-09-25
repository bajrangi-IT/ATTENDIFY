import React from 'react';
import {
  TrendingUp,
  Building2,
  Users,
  AlertCircle,
  FileCheck2,
  Download,
  ShieldCheck,
  Award
} from 'lucide-react';

export const DirectorDashboardView: React.FC = () => {
  const departmentMetrics = [
    { name: 'Computer Science & Engineering', code: 'CSE', students: 480, attendance: 83.4, detained: 18, color: 'indigo' },
    { name: 'Electronics & Communication', code: 'ECE', students: 360, attendance: 79.1, detained: 29, color: 'blue' },
    { name: 'Mechanical Engineering', code: 'MECH', students: 320, attendance: 81.6, detained: 21, color: 'emerald' },
    { name: 'Electrical Engineering', code: 'EEE', students: 240, attendance: 76.8, detained: 32, color: 'amber' },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              EXECUTIVE PORTAL
            </span>
            <span className="text-xs text-slate-500 font-medium">Director: Prof. Robert Vance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">College-Wide Institutional Attendance Intelligence</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Aggregated cross-departmental compliance & statutory attendance audits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => alert('Executive Accreditation Report generated.')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Board Report
          </button>
        </div>
      </div>

      {/* College-wide KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Overall Institution Attendance</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">80.2%</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Compliant with University 75% Mandate</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Total Enrolled Students</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">1,400</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Across 4 Engineering Departments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>Lectures Conducted</span>
            <FileCheck2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">384</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">98.4% Syllabus Timetable Adherence</p>
        </div>

        <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold uppercase">
            <span>Exam Ineligibility Risk</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-800 mt-2">100 Students</div>
          <p className="text-[11px] text-rose-700 font-medium mt-1">Current shortage list (&lt;75%)</p>
        </div>
      </div>

      {/* Cross-Department Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Departmental Comparative Benchmark</h2>
        <div className="space-y-4">
          {departmentMetrics.map((dept) => (
            <div key={dept.code} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-bold text-indigo-600">{dept.code}</span>
                  <h3 className="text-sm font-bold text-slate-800">{dept.name}</h3>
                  <span className="text-xs text-slate-500 font-medium">{dept.students} Enrolled Students</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Detained Risk</span>
                    <div className="text-xs font-bold text-rose-600">{dept.detained} Students</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Average Attendance</span>
                    <div className="text-base font-black text-slate-900 font-mono">{dept.attendance}%</div>
                  </div>
                </div>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    dept.attendance >= 80 ? 'bg-indigo-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${dept.attendance}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
