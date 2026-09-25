import React, { useState } from 'react';
import { mockClassrooms } from '../data/mockData';
import { Classroom } from '@campusattend/shared-types';
import {
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  KeyRound,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  Plus,
  ShieldCheck,
  Building
} from 'lucide-react';

export const DeviceManagementView: React.FC = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>(mockClassrooms);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const generateNewPairingCode = (classroomId: string) => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setClassrooms((prev) =>
      prev.map((c) => (c.id === classroomId ? { ...c, device_pairing_code: randomCode, device_status: 'online' } : c))
    );
  };

  const handleSimulateCsvImport = (jobType: string) => {
    setImportStatus(`Processing bulk ${jobType} import job... Validating against schema.`);
    setTimeout(() => {
      setImportStatus(`Success! 60 student profiles and enrollment records verified & imported into PostgreSQL.`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              IT INFRASTRUCTURE & HARDWARE CONSOLE
            </span>
            <span className="text-xs text-slate-500 font-medium">Administrator: Alex Mercer</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Classroom Smart Displays & Kiosk Fleet</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Device authorization, cryptographic pairing codes, and bulk SIS data sync pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSimulateCsvImport('students')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <UploadCloud className="h-4 w-4" /> Import CSV Roster
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            {importStatus}
          </div>
          <button onClick={() => setImportStatus(null)} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Classroom Device Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {classrooms.map((room) => (
          <div key={room.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" />
                  Floor {room.floor}
                </span>
                {room.device_status === 'online' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ONLINE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                    UNPAIRED
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black text-slate-900">{room.room_number}</h3>
              <p className="text-xs text-slate-500 font-medium mb-3">{room.building}</p>

              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Class Capacity:</span>
                  <span className="font-semibold text-slate-700">{room.capacity} Seats</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Pairing PIN:</span>
                  <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {room.device_pairing_code || 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Heartbeat:</span>
                  <span className="font-medium text-slate-600">{room.last_ping_at || 'Never'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => generateNewPairingCode(room.id)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <KeyRound className="h-3.5 w-3.5" /> Rotate PIN
              </button>
              <a
                href="http://localhost:5174"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-500 hover:text-slate-900 font-semibold flex items-center gap-1"
              >
                View Kiosk &rarr;
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* CSV Bulk Importer Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          Bulk Academic Data Sync Jobs
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Automated CSV import pipeline supporting student rosters, faculty assignments, and semester timetable mapping.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all cursor-pointer">
            <h3 className="font-bold text-xs text-slate-800">Student Roll Roster</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Sync registration numbers, batch year, and section IDs.</p>
            <button
              onClick={() => handleSimulateCsvImport('Students')}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
            >
              Upload Students CSV
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all cursor-pointer">
            <h3 className="font-bold text-xs text-slate-800">Semester Timetable Matrix</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Map days, start/end slots, subject offerings, and rooms.</p>
            <button
              onClick={() => handleSimulateCsvImport('Timetable')}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
            >
              Upload Timetable CSV
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all cursor-pointer">
            <h3 className="font-bold text-xs text-slate-800">Faculty Subject Assignments</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Assign teachers to course codes and laboratory cohorts.</p>
            <button
              onClick={() => handleSimulateCsvImport('Faculty')}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
            >
              Upload Assignments CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
