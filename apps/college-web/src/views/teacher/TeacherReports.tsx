import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { exportToExcel, exportToPdf } from '../../lib/exportUtils';
import { TablePagination } from '../../components/ui/TablePagination';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import {
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Download,
  BookOpen
} from 'lucide-react';

export const TeacherReports: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedThreshold, setSelectedThreshold] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('v_student_attendance_summary')
          .select('*')
          .order('roll_number');

        if (error) throw error;
        setReportsData(data || []);
      } catch (err: any) {
        console.error('Error fetching reports:', err);
        toast.error('Failed to load reports', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [toast]);

  // Unique subjects for filter
  const subjectsList = useMemo(() => {
    const map = new Map<string, string>();
    reportsData.forEach((r) => {
      map.set(r.subject_code, `${r.subject_code} - ${r.subject_name}`);
    });
    return Array.from(map.entries());
  }, [reportsData]);

  // Filtering
  const filteredData = useMemo(() => {
    return reportsData.filter((item) => {
      const matchesSearch =
        item.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.roll_number.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSubject = selectedSubject === 'all' || item.subject_code === selectedSubject;
      const matchesThreshold = selectedThreshold === 'all' || item.threshold_status === selectedThreshold;

      return matchesSearch && matchesSubject && matchesThreshold;
    });
  }, [reportsData, searchTerm, selectedSubject, selectedThreshold]);

  const paginatedData = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return filteredData.slice(from, from + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Summary counts
  const criticalCount = reportsData.filter((r) => r.threshold_status === 'critical').length;
  const warningCount = reportsData.filter((r) => r.threshold_status === 'warning').length;

  const handleExportExcel = () => {
    const exportRows = filteredData.map((r) => ({
      'Roll Number': r.roll_number,
      'Student Name': r.student_name,
      'Subject Code': r.subject_code,
      'Subject Name': r.subject_name,
      'Conducted Lectures': r.total_held,
      'Attended Lectures': r.attended_count,
      'Absent Lectures': r.absent_count,
      'Attendance Percentage': `${r.attendance_percentage}%`,
      'Statutory Eligibility': r.threshold_status === 'good' ? 'Eligible' : r.threshold_status === 'warning' ? 'Warning (75%)' : 'Detained Shortage',
    }));

    exportToExcel(exportRows, `Attendance_Summary_${selectedSubject}_${new Date().toISOString().substring(0, 10)}`);
    toast.success('Excel Report Generated', 'Download initialized.');
  };

  const handleExportPdf = () => {
    const exportRows = filteredData.map((r) => ({
      roll: r.roll_number,
      name: r.student_name,
      subject: `${r.subject_code}`,
      held: String(r.total_held),
      attended: String(r.attended_count),
      pct: `${r.attendance_percentage}%`,
      status: r.threshold_status.toUpperCase(),
    }));

    exportToPdf({
      title: 'Subject-wise Consolidated Attendance & Statutory Eligibility Report',
      subtitle: `Filter: Subject [${selectedSubject}] | Threshold [${selectedThreshold}] | Generated strictly from finalized non-cancelled sessions`,
      filename: `Attendance_Report_${selectedSubject}`,
      columns: [
        { header: 'Roll Number', dataKey: 'roll' },
        { header: 'Student Name', dataKey: 'name' },
        { header: 'Subject', dataKey: 'subject' },
        { header: 'Held', dataKey: 'held' },
        { header: 'Attended', dataKey: 'attended' },
        { header: 'Attendance %', dataKey: 'pct' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: exportRows,
    });
    toast.success('PDF Report Generated', 'Download initialized.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Academic Attendance Reports & Shortage Analysis
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Computed dynamically from finalized canonical attendance records. Cancelled sessions are strictly excluded.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel Sheet
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileText className="h-4 w-4" /> Download PDF Report
          </button>
        </div>
      </div>

      {/* Threshold Alert Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase">Total Student Subject Enrollments</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{reportsData.length}</div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-sm">
          <div className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Warning Borderline (75% - 80%)
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1 font-mono">{warningCount} Students</div>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-sm">
          <div className="text-xs font-bold text-rose-800 uppercase flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Critical Shortage Defaulters (&lt; 75%)
          </div>
          <div className="text-2xl font-black text-rose-800 mt-1 font-mono">{criticalCount} Students</div>
        </div>
      </div>

      {/* Filters & Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or roll number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Subject Selector */}
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
            >
              <option value="all">All Subjects</option>
              {subjectsList.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>

            {/* Threshold Selector */}
            <select
              value={selectedThreshold}
              onChange={(e) => {
                setSelectedThreshold(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
            >
              <option value="all">All Statuses</option>
              <option value="critical">Critical (&lt; 75%)</option>
              <option value="warning">Warning (75% - 80%)</option>
              <option value="good">Good Standing (&ge; 80%)</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-xs font-semibold">No attendance records match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Course / Subject</th>
                  <th className="py-3 px-4 text-center">Conducted</th>
                  <th className="py-3 px-4 text-center">Attended</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4">Percentage</th>
                  <th className="py-3 px-4 text-right">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row) => (
                  <tr key={`${row.student_id}_${row.subject_code}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{row.roll_number}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{row.student_name}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-indigo-700">{row.subject_code}</span>: {row.subject_name}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">{row.total_held}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                      {row.attended_count}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">{row.absent_count}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 w-12">{row.attendance_percentage}%</span>
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              parseFloat(row.attendance_percentage) >= 80
                                ? 'bg-emerald-500'
                                : parseFloat(row.attendance_percentage) >= 75
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, parseFloat(row.attendance_percentage))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {row.threshold_status === 'good' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ELIGIBLE
                        </span>
                      ) : row.threshold_status === 'warning' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          WARNING (75%)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          DETAINED SHORTAGE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          currentPage={currentPage}
          totalRecords={filteredData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
