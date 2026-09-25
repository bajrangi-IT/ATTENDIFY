import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase, DEFAULT_INSTITUTION_ID } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { exportToExcel } from '../../lib/exportUtils';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  FileCheck,
  Users,
  GraduationCap,
  Calendar,
  History,
  Info,
  ShieldCheck
} from 'lucide-react';

export const BulkStudentImport: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab: 'students' | 'faculty' | 'timetable' | 'history'
  const [activeTab, setActiveTab] = useState<'students' | 'faculty' | 'timetable' | 'history'>('students');

  // Metadata caches
  const [sections, setSections] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectOfferings, setSubjectOfferings] = useState<any[]>([]);

  // Parsed rows
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Import History
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedJobErrors, setSelectedJobErrors] = useState<any[] | null>(null);

  // Load Metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [secRes, deptRes, facRes, roomRes, subRes, offRes] = await Promise.all([
          supabase.from('sections').select('id, name, semester_id').order('name'),
          supabase.from('departments').select('id, name, code').order('code'),
          supabase.from('faculty').select('id, employee_code, profile:profiles(first_name, last_name)'),
          supabase.from('classrooms').select('id, room_number, building'),
          supabase.from('subjects').select('id, code, name'),
          supabase.from('subject_offerings').select('id, subject:subjects(id, code, name)')
        ]);

        setSections(secRes.data || []);
        setDepartments(deptRes.data || []);
        setFaculty(facRes.data || []);
        setClassrooms(roomRes.data || []);
        setSubjects(subRes.data || []);
        setSubjectOfferings(offRes.data || []);
      } catch (err: any) {
        console.error('Failed to load import metadata:', err);
      }
    }
    loadMetadata();
  }, []);

  // Load History Jobs
  const fetchImportHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;
      setHistoryJobs(data || []);
    } catch (err: any) {
      console.error('Error fetching import jobs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchImportHistory();
    }
  }, [activeTab]);

  // Reset current upload
  const handleResetUpload = () => {
    setParsedRows([]);
    setFileName('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download Sample Template for Current Tab
  const handleDownloadTemplate = () => {
    if (activeTab === 'students') {
      const data = [
        {
          roll_number: '23CSE001',
          registration_number: 'REG-2023-CS-001',
          first_name: 'Aarav',
          last_name: 'Patel',
          email: 'aarav.patel@student.campusattend.edu',
          phone: '+91 98765 43210',
          section_name: sections[0]?.name || 'Section A',
          batch_year: 2023
        },
        {
          roll_number: '23CSE002',
          registration_number: 'REG-2023-CS-002',
          first_name: 'Diya',
          last_name: 'Sharma',
          email: 'diya.sharma@student.campusattend.edu',
          phone: '+91 98765 43211',
          section_name: sections[0]?.name || 'Section A',
          batch_year: 2023
        }
      ];
      exportToExcel(data, 'CampusAttend_Students_Template');
    } else if (activeTab === 'faculty') {
      const data = [
        {
          employee_code: 'FAC-CSE-001',
          first_name: 'Vikram',
          last_name: 'Sharma',
          department_code: departments[0]?.code || 'CSE',
          email: 'vikram.sharma@faculty.campusattend.edu',
          designation: 'Associate Professor',
          phone: '+91 98765 11111'
        },
        {
          employee_code: 'FAC-CSE-002',
          first_name: 'Priya',
          last_name: 'Nair',
          department_code: departments[0]?.code || 'CSE',
          email: 'priya.nair@faculty.campusattend.edu',
          designation: 'Assistant Professor',
          phone: '+91 98765 22222'
        }
      ];
      exportToExcel(data, 'CampusAttend_Faculty_Template');
    } else if (activeTab === 'timetable') {
      const data = [
        {
          day_of_week: 1,
          start_time: '09:00',
          end_time: '10:00',
          subject_code: subjects[0]?.code || 'CS501',
          faculty_code: faculty[0]?.employee_code || 'FAC-CSE-001',
          section_name: sections[0]?.name || 'Section A',
          room_number: classrooms[0]?.room_number || 'LH-101'
        }
      ];
      exportToExcel(data, 'CampusAttend_Timetable_Template');
    }

    addToast({
      title: 'Template Downloaded',
      message: 'Fill this spreadsheet and upload to execute transaction-safe ingestion.',
      type: 'info'
    });
  };

  // Handle File Upload and Client-side Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          addToast({ title: 'Empty Sheet', message: 'No rows detected in uploaded file.', type: 'warning' });
          setIsProcessing(false);
          return;
        }

        // Validate and annotate rows based on active entity
        const validated = rawJson.map((row, idx) => {
          const errors: string[] = [];

          if (activeTab === 'students') {
            if (!row.roll_number) errors.push('Missing roll_number');
            if (!row.email) errors.push('Missing email');
            if (!row.section_name) errors.push('Missing section_name');
            const matchedSec = sections.find(
              (s) => s.name.toLowerCase() === String(row.section_name || '').toLowerCase()
            );
            if (!matchedSec) errors.push(`Unknown section: ${row.section_name}`);

            return {
              rowNumber: idx + 2,
              ...row,
              section_id: matchedSec?.id,
              isValid: errors.length === 0,
              errors
            };
          } else if (activeTab === 'faculty') {
            if (!row.employee_code) errors.push('Missing employee_code');
            if (!row.email) errors.push('Missing email');
            const matchedDept = departments.find(
              (d) => d.code.toLowerCase() === String(row.department_code || '').toLowerCase()
            );
            if (!matchedDept) errors.push(`Unknown department: ${row.department_code}`);

            return {
              rowNumber: idx + 2,
              ...row,
              department_id: matchedDept?.id,
              isValid: errors.length === 0,
              errors
            };
          } else {
            // Timetable
            if (!row.day_of_week) errors.push('Missing day_of_week (1-7)');
            if (!row.start_time || !row.end_time) errors.push('Missing start_time/end_time');
            const matchedSub = subjects.find(
              (s) => s.code.toLowerCase() === String(row.subject_code || '').toLowerCase()
            );
            const matchedOffer = subjectOfferings.find(
              (so) => (so.subject as any)?.code?.toLowerCase() === String(row.subject_code || '').toLowerCase()
            );
            const matchedFac = faculty.find(
              (f) => f.employee_code.toLowerCase() === String(row.faculty_code || '').toLowerCase()
            );
            const matchedSec = sections.find(
              (s) => s.name.toLowerCase() === String(row.section_name || '').toLowerCase()
            );
            const matchedRoom = classrooms.find(
              (c) => c.room_number.toLowerCase() === String(row.room_number || '').toLowerCase()
            );

            if (!matchedOffer) errors.push(`No offering for subject: ${row.subject_code}`);
            if (!matchedFac) errors.push(`Unknown faculty: ${row.faculty_code}`);
            if (!matchedSec) errors.push(`Unknown section: ${row.section_name}`);
            if (!matchedRoom) errors.push(`Unknown room: ${row.room_number}`);

            return {
              rowNumber: idx + 2,
              ...row,
              subject_offering_id: matchedOffer?.id,
              faculty_id: matchedFac?.id,
              section_id: matchedSec?.id,
              classroom_id: matchedRoom?.id,
              isValid: errors.length === 0,
              errors
            };
          }
        });

        setParsedRows(validated);
      } catch (err: any) {
        addToast({ title: 'Parse Error', message: 'Could not parse Excel/CSV document.', type: 'error' });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Execute Batch Transaction Ingestion
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      addToast({ title: 'Validation Alert', message: 'No valid records to ingest.', type: 'warning' });
      return;
    }

    setIsImporting(true);
    try {
      let rpcName = '';
      let payloadRecords: any[] = [];

      if (activeTab === 'students') {
        rpcName = 'rpc_admin_bulk_import_students';
        payloadRecords = validRows.map((r) => ({
          roll_number: r.roll_number,
          registration_number: r.registration_number || r.roll_number,
          first_name: r.first_name,
          last_name: r.last_name || '',
          email: r.email,
          phone: r.phone || null,
          section_id: r.section_id,
          batch_year: r.batch_year || new Date().getFullYear()
        }));
      } else if (activeTab === 'faculty') {
        rpcName = 'rpc_admin_bulk_import_faculty';
        payloadRecords = validRows.map((r) => ({
          employee_code: r.employee_code,
          first_name: r.first_name,
          last_name: r.last_name || '',
          department_id: r.department_id,
          email: r.email,
          designation: r.designation || 'Assistant Professor',
          phone: r.phone || null
        }));
      } else {
        rpcName = 'rpc_admin_bulk_import_timetable';
        payloadRecords = validRows.map((r) => ({
          day_of_week: Number(r.day_of_week),
          start_time: r.start_time.includes(':') && r.start_time.length === 5 ? `${r.start_time}:00` : r.start_time,
          end_time: r.end_time.includes(':') && r.end_time.length === 5 ? `${r.end_time}:00` : r.end_time,
          subject_offering_id: r.subject_offering_id,
          faculty_id: r.faculty_id,
          section_id: r.section_id,
          classroom_id: r.classroom_id
        }));
      }

      const { data, error } = await supabase.rpc(rpcName, {
        p_institution_id: DEFAULT_INSTITUTION_ID,
        p_records: payloadRecords,
        p_created_by: profile?.id || null
      });

      if (error) throw error;

      setImportResult(data);
      addToast({
        title: 'Batch Ingestion Complete',
        message: `Successfully ingested ${data.inserted_count} of ${data.total_rows} records.`,
        type: data.error_count === 0 ? 'success' : 'warning'
      });
    } catch (err: any) {
      console.error('Batch Ingestion Failure:', err);
      addToast({
        title: 'Ingestion Error',
        message: err.message || 'Transaction aborted by server.',
        type: 'error'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              Transaction-Safe Ingestion Engine
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Director & IT Admin</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Bulk Academic Ingestion Hub</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Batch import students, faculty cohorts, and master timetable schedules with pre-flight schema validation and collision checks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 self-start md:self-center">
          <button
            onClick={() => {
              setActiveTab('students');
              handleResetUpload();
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-indigo-600" /> Students
          </button>
          <button
            onClick={() => {
              setActiveTab('faculty');
              handleResetUpload();
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'faculty' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 text-purple-600" /> Faculty
          </button>
          <button
            onClick={() => {
              setActiveTab('timetable');
              handleResetUpload();
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'timetable' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-emerald-600" /> Timetable
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5 text-slate-600" /> Ingestion History
          </button>
        </div>
      </div>

      {/* Ingestion Tabs Content */}
      {activeTab !== 'history' && (
        <div className="space-y-6">
          {/* Upload Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-indigo-600" />
                  Upload {activeTab === 'students' ? 'Student Registry' : activeTab === 'faculty' ? 'Faculty Staff' : 'Timetable Matrix'} (.xlsx / .csv)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download the institutional schema template, populate columns, and verify below.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" /> Download Template
                </button>
                {parsedRows.length > 0 && (
                  <button
                    onClick={handleResetUpload}
                    className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 text-center transition-colors bg-slate-50/50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-file-input"
              />
              <label htmlFor="bulk-file-input" className="cursor-pointer block space-y-2">
                <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-800">
                  {fileName ? fileName : 'Click to select spreadsheet or drop file here'}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Supports standard Excel (.xlsx) and comma-separated (.csv) files.
                </div>
              </label>
            </div>
          </div>

          {/* Pre-flight Preview Table */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm text-slate-900">Pre-Flight Ingestion Preview</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                    {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800">
                      {invalidCount} Errors
                    </span>
                  )}
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={isImporting || validCount === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isImporting ? 'Ingesting Transactionally...' : `Execute Ingestion (${validCount} Records)`}
                </button>
              </div>

              {/* Rows List */}
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Status</th>
                      {activeTab === 'students' && (
                        <>
                          <th className="py-2.5 px-3">Roll #</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Section</th>
                        </>
                      )}
                      {activeTab === 'faculty' && (
                        <>
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Email</th>
                        </>
                      )}
                      {activeTab === 'timetable' && (
                        <>
                          <th className="py-2.5 px-3">Day</th>
                          <th className="py-2.5 px-3">Time</th>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3">Faculty</th>
                          <th className="py-2.5 px-3">Room</th>
                        </>
                      )}
                      <th className="py-2.5 px-3">Diagnostic Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-red-50/40 hover:bg-red-50'}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{r.rowNumber}</td>
                        <td className="py-2.5 px-3">
                          {r.isValid ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Ready
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-red-700">
                              <XCircle className="h-3.5 w-3.5 text-red-600" /> Invalid
                            </span>
                          )}
                        </td>
                        {activeTab === 'students' && (
                          <>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{r.roll_number}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{r.first_name} {r.last_name}</td>
                            <td className="py-2.5 px-3 text-slate-500">{r.email}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{r.section_name}</td>
                          </>
                        )}
                        {activeTab === 'faculty' && (
                          <>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{r.employee_code}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{r.first_name} {r.last_name}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{r.department_code}</td>
                            <td className="py-2.5 px-3 text-slate-500">{r.email}</td>
                          </>
                        )}
                        {activeTab === 'timetable' && (
                          <>
                            <td className="py-2.5 px-3 font-bold">Day {r.day_of_week}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{r.start_time} - {r.end_time}</td>
                            <td className="py-2.5 px-3 font-bold text-indigo-700">{r.subject_code}</td>
                            <td className="py-2.5 px-3">{r.faculty_code}</td>
                            <td className="py-2.5 px-3 font-bold">{r.room_number}</td>
                          </>
                        )}
                        <td className="py-2.5 px-3">
                          {r.errors && r.errors.length > 0 ? (
                            <span className="text-[11px] text-red-600 font-semibold">{r.errors.join(', ')}</span>
                          ) : (
                            <span className="text-[11px] text-emerald-600">Schema verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ingestion Report Callout */}
              {importResult && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      Transaction Ingestion Summary (Job ID: {importResult.job_id})
                    </span>
                    <Badge variant={importResult.error_count === 0 ? 'success' : 'warning'}>
                      {importResult.inserted_count} Inserted / {importResult.error_count} Errors
                    </Badge>
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="space-y-1 text-xs text-red-700 max-h-32 overflow-y-auto pt-2 border-t border-slate-200">
                      {importResult.errors.map((err: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Import History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Historical Batch Ingestions</h3>
              <p className="text-xs text-slate-500">Audited batch jobs and error reports stored in PostgreSQL.</p>
            </div>
            <button
              onClick={fetchImportHistory}
              className="p-2 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading audit history...</div>
          ) : historyJobs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">No batch jobs executed yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Job ID</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Processed</th>
                    <th className="py-3 px-4 text-center">Errors</th>
                    <th className="py-3 px-4">Execution Date</th>
                    <th className="py-3 px-4 text-right">Error Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{job.id.slice(0, 8)}...</td>
                      <td className="py-3 px-4 uppercase font-bold text-indigo-700">{job.job_type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : job.status === 'completed_with_errors'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {job.processed_rows} / {job.total_rows}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-red-600">
                        {job.error_count}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {job.error_count > 0 ? (
                          <button
                            onClick={() => setSelectedJobErrors(job.error_details || [])}
                            className="text-xs font-bold text-indigo-600 hover:underline"
                          >
                            Inspect Errors
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Zero errors</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Error Details Modal */}
      <Modal
        isOpen={!!selectedJobErrors}
        onClose={() => setSelectedJobErrors(null)}
        title="Batch Ingestion Error Report"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Records that violated relational constraints or duplicate uniqueness checks during ingestion:
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {selectedJobErrors?.map((err, idx) => (
              <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                <div className="font-bold text-red-800 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{err.error}</span>
                </div>
                {err.record && (
                  <pre className="text-[10px] bg-white p-2 rounded border border-red-100 font-mono text-slate-700 overflow-x-auto">
                    {JSON.stringify(err.record, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setSelectedJobErrors(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
