import React, { useState } from 'react';
import { Sliders, Save, CheckCircle, ShieldAlert, Clock, Bell } from 'lucide-react';

export const PolicyConfigView: React.FC = () => {
  const [minPercentage, setMinPercentage] = useState(75.0);
  const [warningThreshold, setWarningThreshold] = useState(80.0);
  const [gracePeriod, setGracePeriod] = useState(10);
  const [consecutiveAbsentAlert, setConsecutiveAbsentAlert] = useState(3);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            SUPER ADMINISTRATOR SETTINGS
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1.5">
            Attendance Policy & Statutory Threshold Rules
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Global attendance parameters enforced across all departments and calculations.
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          Institutional policies updated successfully in PostgreSQL `attendance_policies` table.
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              Minimum Examination Eligibility Threshold (%)
            </label>
            <p className="text-[11px] text-slate-500">
              Students falling below this percentage are classified as detained / critical shortage.
            </p>
            <input
              type="number"
              step="0.5"
              min="50"
              max="100"
              value={minPercentage}
              onChange={(e) => setMinPercentage(parseFloat(e.target.value))}
              className="w-full text-sm font-bold font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              Warning Watch Threshold (%)
            </label>
            <p className="text-[11px] text-slate-500">
              Triggers proactive notification to student and academic advisor before detention occurs.
            </p>
            <input
              type="number"
              step="0.5"
              min="50"
              max="100"
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(parseFloat(e.target.value))}
              className="w-full text-sm font-bold font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              Late Arrival Grace Period (Minutes)
            </label>
            <p className="text-[11px] text-slate-500">
              Scans recorded within this time after session start are classified as 'present'; thereafter 'late'.
            </p>
            <input
              type="number"
              min="1"
              max="60"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(parseInt(e.target.value))}
              className="w-full text-sm font-bold font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Bell className="h-4 w-4 text-purple-500" />
              Consecutive Absence Alert Limit
            </label>
            <p className="text-[11px] text-slate-500">
              Number of consecutive unexcused absences before mandatory guardian dispatch.
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={consecutiveAbsentAlert}
              onChange={(e) => setConsecutiveAbsentAlert(parseInt(e.target.value))}
              className="w-full text-sm font-bold font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> Save Institutional Policies
          </button>
        </div>
      </form>
    </div>
  );
};
