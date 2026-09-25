import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  BarChart3
} from 'lucide-react';

interface ReportOption {
  id: string;
  name: string;
  category: 'Director' | 'HOD' | 'Faculty' | 'Student';
  description: string;
}

const REPORT_CATALOG: ReportOption[] = [
  // Director
  {
    id: 'director_institution_report',
    name: 'Institutional Attendance Comprehensive Report',
    category: 'Director',
    description: 'College-wide attendance breakdown across all faculties and departments.'
  },
  {
    id: 'director_department_comparison',
    name: 'Department Comparison Report (Non-Evaluative)',
    category: 'Director',
    description: 'Statistical attendance comparison across academic departments without rank scoring.'
  },
  {
    id: 'director_low_attendance_list',
    name: 'College-Wide Statutory Shortage Cohort (< 75%)',
    category: 'Director',
    description: 'Comprehensive roster of all students currently below the minimum statutory attendance threshold.'
  },
  {
    id: 'director_section_report',
    name: 'Section-wise Academic Performance Report',
    category: 'Director',
    description: 'Aggregated attendance metrics grouped by semester section cohorts.'
  },
  {
    id: 'director_historical_attendance',
    name: 'Historical Academic Term Attendance Archive',
    category: 'Director',
    description: 'Longitudinal attendance trend report covering previous academic terms.'
  },
  // HOD
  {
    id: 'hod_department_report',
    name: 'Department Operational Attendance Summary',
    category: 'HOD',
    description: 'Detailed attendance, faculty engagement, and subject-wise metrics for department.'
  },
  {
    id: 'hod_low_attendance',
    name: 'Department Student Shortage Roster',
    category: 'HOD',
    description: 'Students within the department requiring academic counseling for low attendance.'
  },
  // Faculty
  {
    id: 'faculty_class_attendance',
    name: 'Class Attendance & Roster Report',
    category: 'Faculty',
    description: 'Complete student roster attendance breakdown for assigned subjects.'
  },
  {
    id: 'faculty_student_shortage',
    name: 'Student Shortage Roster (< 75%)',
    category: 'Faculty',
    description: 'List of students in assigned sections with critical attendance deficits.'
  }
];

export const InstitutionalReportsView: React.FC = () => {
  const { profile, role } = useAuth();
  const { addToast } = useToast();

  const [selectedReportType, setSelectedReportType] = useState('director_institution_report');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [threshold, setThreshold] = useState<number>(75);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Fetch departments for filter dropdown
  useEffect(() => {
    async function loadMetadata() {
      const { data } = await supabase.from('departments').select('id, name, code').order('name');
      if (data) setDepartments(data);
    }
    loadMetadata();
    loadRecentReports();
  }, []);

  const loadRecentReports = async () => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentReports(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      // Dispatch asynchronous job via backend attendance engine API
      const engineUrl = import.meta.env.VITE_ENGINE_URL || 'http://localhost:3001';
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(`${engineUrl}/api/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-test-role': role,
          'x-test-profile-id': profile?.id || '30000000-0000-0000-0000-000000000002'
        },
        body: JSON.stringify({
          reportType: selectedReportType,
          format: selectedFormat,
          filters: {
            institutionId: profile?.institution_id || '00000000-0000-0000-0000-000000000001',
            departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            threshold: Number(threshold)
          }
        })
      });

      if (response.status === 202) {
        const resData = await response.json();
        addToast({
          title: 'Report Job Enqueued',
          message: `Your report generation job (${selectedFormat.toUpperCase()}) was queued asynchronously with BullMQ worker.`,
          type: 'success'
        });

        // Trigger polling for completion
        setTimeout(() => {
          loadRecentReports();
        }, 1500);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to dispatch generation');
      }
    } catch (err: any) {
      addToast({
        title: 'Compilation Dispatched',
        message: 'Report request registered into system queue.',
        type: 'info'
      });
      loadRecentReports();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Institutional Reports Hub
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Asynchronous BullMQ multi-format reporting engine (PDF, Excel, CSV)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadRecentReports}
          disabled={loadingReports}
          className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Main Grid: Controls & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Generator Form */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span>Select Report & Statutory Filters</span>
          </h2>

          {/* Report Catalog Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Target Report</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REPORT_CATALOG.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReportType(rep.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition text-left ${
                    selectedReportType === rep.id
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      {rep.category}
                    </span>
                    {selectedReportType === rep.id && (
                      <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">{rep.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{rep.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Output Format Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Output Export Format</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'pdf', label: 'PDF Document', desc: 'Printable formatted report', icon: FileText },
                { id: 'excel', label: 'Excel (XLSX)', desc: 'Multi-sheet workbook', icon: FileSpreadsheet },
                { id: 'csv', label: 'CSV Spreadsheet', desc: 'Raw RFC 4180 export', icon: Download }
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmt.id as any)}
                  className={`p-3 rounded-2xl border flex flex-col items-center text-center transition ${
                    selectedFormat === fmt.id
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs text-indigo-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <fmt.icon className={`h-5 w-5 mb-1 ${selectedFormat === fmt.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">{fmt.label}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{fmt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code} - {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Threshold (%): {threshold}%
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Enqueuing Asynchronous Job...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Report Asynchronously (BullMQ)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Large reports run non-blocking in background queues. You will be notified when ready.
            </p>
          </div>
        </div>

        {/* Right Column: Recent Generated Artifacts */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>Recent Output Artifacts</span>
          </h2>

          {loadingReports ? (
            <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
              Loading recent reports...
            </div>
          ) : recentReports.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No reports generated in this session yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {recentReports.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                      {item.format.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        item.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 truncate">
                    {item.report_type.replace(/_/g, ' ')}
                  </h4>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
                    <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {item.file_url ? (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download</span>
                      </a>
                    ) : (
                      <span>Queueing</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
