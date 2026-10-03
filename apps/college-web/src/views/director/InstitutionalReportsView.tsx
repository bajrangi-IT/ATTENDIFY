import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { exportToExcel, exportToPdf } from '../../lib/exportUtils';
import {
  BarChart3,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  GraduationCap,
  Building2,
  BookOpen,
  Layers,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
  ShieldAlert,
  FileSpreadsheet,
  FileText
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
  department_id: string;
  duration_semesters: number;
}

interface Semester {
  id: string;
  semester_number: number;
  program_id: string;
  academic_year_id?: string;
}

interface Section {
  id: string;
  name: string;
  semester_id: string;
}

interface SubjectItem {
  id: string;
  code: string;
  name: string;
  offering_id?: string;
}

interface StudentAttendanceRow {
  student_id: string;
  roll_number: string;
  registration_number?: string;
  student_name: string;
  branch?: string;
  email?: string;
  phone?: string;
  department_name: string;
  program_name: string;
  semester_number: number;
  section_name: string;
  subject_code: string;
  subject_name: string;
  total_held: number;
  attended_count: number;
  present_count: number;
  late_count: number;
  excused_count: number;
  absent_count: number;
  attendance_percentage: number;
  threshold_status: 'regular' | 'warning' | 'shortage';
}

type SortField = 'roll' | 'name' | 'attendance';
type SortOrder = 'asc' | 'desc';

export const InstitutionalReportsView: React.FC = () => {
  const { profile, institution, currentInstitutionId } = useAuth();
  const toast = useToast();

  // Filter Selection States
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('overall'); // 'overall' or subject_id

  // Data & Display States
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceRow[]>([]);

  // Sorting & Table Filter States
  const [sortField, setSortField] = useState<SortField>('roll');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'regular' | 'shortage'>('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  const activeInstitutionId = profile?.institution_id || currentInstitutionId || '00000000-0000-0000-0000-000000000001';

  // 1. Initial Load: Fetch only departments belonging to this school
  useEffect(() => {
    async function loadDepartments() {
      setIsLoadingMetadata(true);
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, code')
          .eq('institution_id', activeInstitutionId)
          .order('name');

        if (error) throw error;
        setDepartments(data || []);
      } catch (err: any) {
        console.error('Failed to load departments:', err);
        toast.error('Failed to load departments', err.message);
      } finally {
        setIsLoadingMetadata(false);
      }
    }

    loadDepartments();
  }, [activeInstitutionId]);

  // 2. Cascade: When Department changes, load Programs
  useEffect(() => {
    async function loadPrograms() {
      if (!selectedDeptId) {
        setPrograms([]);
        setSelectedProgramId('');
        setSemesters([]);
        setSelectedSemesterId('');
        setSections([]);
        setSelectedSectionId('');
        setSubjects([]);
        setSelectedSubjectId('overall');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('programs')
          .select('id, name, code, department_id, duration_semesters')
          .eq('department_id', selectedDeptId)
          .order('name');

        if (error) throw error;
        setPrograms(data || []);
        setSelectedProgramId('');
        setSemesters([]);
        setSelectedSemesterId('');
        setSections([]);
        setSelectedSectionId('');
        setSubjects([]);
        setSelectedSubjectId('overall');
      } catch (err: any) {
        console.error('Failed to load programs:', err);
        toast.error('Failed to load courses', err.message);
      }
    }

    loadPrograms();
  }, [selectedDeptId]);

  // 3. Cascade: When Program changes, load Semesters/Years
  useEffect(() => {
    async function loadSemesters() {
      if (!selectedProgramId) {
        setSemesters([]);
        setSelectedSemesterId('');
        setSections([]);
        setSelectedSectionId('');
        setSubjects([]);
        setSelectedSubjectId('overall');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('semesters')
          .select('id, semester_number, program_id, academic_year_id')
          .eq('program_id', selectedProgramId)
          .order('semester_number');

        if (error) throw error;
        setSemesters(data || []);
        setSelectedSemesterId('');
        setSections([]);
        setSelectedSectionId('');
        setSubjects([]);
        setSelectedSubjectId('overall');
      } catch (err: any) {
        console.error('Failed to load semesters:', err);
        toast.error('Failed to load academic terms', err.message);
      }
    }

    loadSemesters();
  }, [selectedProgramId]);

  // 4. Cascade: When Semester changes, load Sections & Subjects
  useEffect(() => {
    async function loadSectionsAndSubjects() {
      if (!selectedSemesterId) {
        setSections([]);
        setSelectedSectionId('');
        setSubjects([]);
        setSelectedSubjectId('overall');
        return;
      }

      try {
        // Fetch sections for this semester
        const { data: secData, error: secErr } = await supabase
          .from('sections')
          .select('id, name, semester_id')
          .eq('semester_id', selectedSemesterId)
          .order('name');

        if (secErr) throw secErr;
        setSections(secData || []);
        setSelectedSectionId(secData && secData.length > 0 ? secData[0].id : '');

        // Fetch subject offerings for this semester
        const { data: offData, error: offErr } = await supabase
          .from('subject_offerings')
          .select(`
            id,
            subject:subjects(id, name, code)
          `)
          .eq('semester_id', selectedSemesterId);

        if (offErr) throw offErr;

        // Map unique subjects from offerings
        const subList: SubjectItem[] = [];
        const seen = new Set<string>();

        (offData || []).forEach((item: any) => {
          if (item.subject && !seen.has(item.subject.id)) {
            seen.add(item.subject.id);
            subList.push({
              id: item.subject.id,
              code: item.subject.code,
              name: item.subject.name,
              offering_id: item.id
            });
          }
        });

        // Also fallback to query subjects directly under this department if no offerings mapped yet
        if (subList.length === 0 && selectedDeptId) {
          const { data: directSubs } = await supabase
            .from('subjects')
            .select('id, name, code')
            .eq('department_id', selectedDeptId)
            .order('name');

          if (directSubs) {
            directSubs.forEach((s) => {
              subList.push({
                id: s.id,
                code: s.code,
                name: s.name
              });
            });
          }
        }

        setSubjects(subList);
        setSelectedSubjectId('overall'); // Default to Overall
      } catch (err: any) {
        console.error('Failed to load sections/subjects:', err);
        toast.error('Failed to load section curriculum', err.message);
      }
    }

    loadSectionsAndSubjects();
  }, [selectedSemesterId, selectedDeptId]);

  // Execute Show Attendance Query
  const handleShowAttendance = async () => {
    if (!selectedDeptId || !selectedProgramId || !selectedSemesterId || !selectedSectionId) {
      toast.warning('Incomplete Filters', 'Please select Department, Course, Semester/Year, and Section.');
      return;
    }

    setIsLoadingAttendance(true);
    setHasQueried(true);

    try {
      // 1. Fetch all students in this section strictly for this institution
      const { data: students, error: stErr } = await supabase
        .from('students')
        .select(`
          id,
          roll_number,
          registration_number,
          enrollment_status,
          branch,
          profile:profiles(id, first_name, last_name, email, phone_number)
        `)
        .eq('institution_id', activeInstitutionId)
        .eq('current_section_id', selectedSectionId)
        .order('roll_number');

      if (stErr) throw stErr;

      if (!students || students.length === 0) {
        setAttendanceData([]);
        setIsLoadingAttendance(false);
        return;
      }

      const studentIds = students.map((s) => s.id);

      // 2. Fetch live attendance summary aggregates from canonical view
      const { data: summaryRows, error: sumErr } = await supabase
        .from('v_student_attendance_summary')
        .select('*')
        .in('student_id', studentIds);

      if (sumErr) {
        console.warn('Attendance summary view query fallback:', sumErr);
      }

      // Metadata names for label display
      const currentDept = departments.find((d) => d.id === selectedDeptId);
      const currentProg = programs.find((p) => p.id === selectedProgramId);
      const currentSem = semesters.find((s) => s.id === selectedSemesterId);
      const currentSec = sections.find((s) => s.id === selectedSectionId);
      const currentSub = subjects.find((s) => s.id === selectedSubjectId);

      const rows: StudentAttendanceRow[] = students.map((st: any) => {
        const studentSummaries = (summaryRows || []).filter((r: any) => r.student_id === st.id);

        let totalHeld = 0;
        let attended = 0;
        let present = 0;
        let late = 0;
        let excused = 0;
        let absent = 0;
        let pct = 100.0;

        if (selectedSubjectId === 'overall') {
          // Combined overall attendance across all curriculum subjects
          if (studentSummaries.length > 0) {
            totalHeld = studentSummaries.reduce((acc, curr) => acc + (Number(curr.total_held) || 0), 0);
            attended = studentSummaries.reduce((acc, curr) => acc + (Number(curr.attended_count) || 0), 0);
            present = studentSummaries.reduce((acc, curr) => acc + (Number(curr.present_count) || 0), 0);
            late = studentSummaries.reduce((acc, curr) => acc + (Number(curr.late_count) || 0), 0);
            excused = studentSummaries.reduce((acc, curr) => acc + (Number(curr.excused_count) || 0), 0);
            absent = studentSummaries.reduce((acc, curr) => acc + (Number(curr.absent_count) || 0), 0);

            pct = totalHeld > 0 ? Number(((attended / totalHeld) * 100).toFixed(1)) : 100.0;
          }
        } else {
          // Specific single subject selected
          const match = studentSummaries.find(
            (r: any) => r.subject_id === selectedSubjectId || r.subject_offering_id === currentSub?.offering_id
          );

          if (match) {
            totalHeld = Number(match.total_held) || 0;
            attended = Number(match.attended_count) || 0;
            present = Number(match.present_count) || 0;
            late = Number(match.late_count) || 0;
            excused = Number(match.excused_count) || 0;
            absent = Number(match.absent_count) || 0;
            pct = totalHeld > 0 ? Number(((attended / totalHeld) * 100).toFixed(1)) : 100.0;
          }
        }

        const status: 'regular' | 'warning' | 'shortage' =
          totalHeld === 0 ? 'regular' : pct >= 75.0 ? 'regular' : pct >= 65.0 ? 'warning' : 'shortage';

        return {
          student_id: st.id,
          roll_number: st.roll_number || 'N/A',
          registration_number: st.registration_number,
          student_name: `${st.profile?.first_name || ''} ${st.profile?.last_name || ''}`.trim() || 'Unknown Student',
          branch: st.branch || 'CSE',
          email: st.profile?.email,
          phone: st.profile?.phone_number,
          department_name: currentDept?.name || 'Department',
          program_name: currentProg?.name || 'Course',
          semester_number: currentSem?.semester_number || 1,
          section_name: currentSec?.name || 'Section',
          subject_code: selectedSubjectId === 'overall' ? 'ALL' : currentSub?.code || 'SUBJ',
          subject_name: selectedSubjectId === 'overall' ? 'Overall (Combined Subjects)' : currentSub?.name || 'Subject',
          total_held: totalHeld,
          attended_count: attended,
          present_count: present,
          late_count: late,
          excused_count: excused,
          absent_count: absent,
          attendance_percentage: pct,
          threshold_status: status
        };
      });

      setAttendanceData(rows);
      toast.success(
        'Attendance Loaded',
        `Showing attendance for ${rows.length} students in Section ${currentSec?.name || ''}.`
      );
    } catch (err: any) {
      console.error('Error fetching attendance report:', err);
      toast.error('Query Failed', err.message);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'attendance' ? 'desc' : 'asc');
    }
  };

  // Filter & Search Logic
  const filteredAndSortedList = useMemo(() => {
    let result = [...attendanceData];

    // Status filter
    if (statusFilter === 'regular') {
      result = result.filter((r) => r.threshold_status === 'regular');
    } else if (statusFilter === 'shortage') {
      result = result.filter((r) => r.threshold_status !== 'regular');
    }

    // Branch filter
    if (selectedBranchFilter !== 'all') {
      result = result.filter((r) => (r.branch || 'CSE') === selectedBranchFilter);
    }

    // Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          r.roll_number.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortField === 'name') {
        const nameA = a.student_name.toLowerCase();
        const nameB = b.student_name.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else if (sortField === 'attendance') {
        return sortOrder === 'asc'
          ? a.attendance_percentage - b.attendance_percentage
          : b.attendance_percentage - a.attendance_percentage;
      } else {
        // Roll number sort (natural alphanumeric)
        return sortOrder === 'asc'
          ? a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true })
          : b.roll_number.localeCompare(a.roll_number, undefined, { numeric: true });
      }
    });

    return result;
  }, [attendanceData, statusFilter, selectedBranchFilter, searchQuery, sortField, sortOrder]);

  // Aggregate Metrics for Header Cards
  const stats = useMemo(() => {
    const total = attendanceData.length;
    if (total === 0) {
      return { total: 0, avg: 0, regular: 0, shortage: 0 };
    }
    const regular = attendanceData.filter((r) => r.threshold_status === 'regular').length;
    const shortage = total - regular;
    const totalPct = attendanceData.reduce((acc, curr) => acc + curr.attendance_percentage, 0);
    const avg = Number((totalPct / total).toFixed(1));

    return { total, avg, regular, shortage };
  }, [attendanceData]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredAndSortedList.length === 0) {
      toast.warning('No Data', 'No records to export.');
      return;
    }

    const currentProg = programs.find((p) => p.id === selectedProgramId);
    const currentSec = sections.find((s) => s.id === selectedSectionId);
    const currentSub = subjects.find((s) => s.id === selectedSubjectId);

    const exportRows = filteredAndSortedList.map((r, idx) => ({
      'S.No': idx + 1,
      'Roll Number': r.roll_number,
      'Student Name': r.student_name,
      'Department': r.department_name,
      'Course': r.program_name,
      'Semester': `Sem ${r.semester_number}`,
      'Section': r.section_name,
      'Subject Code': r.subject_code,
      'Subject Name': r.subject_name,
      'Total Held Lectures': r.total_held,
      'Attended Lectures': r.attended_count,
      'Absent Lectures': r.absent_count,
      'Attendance Percentage': `${r.attendance_percentage}%`,
      'Statutory Eligibility': r.threshold_status === 'regular' ? 'Eligible (>= 75%)' : 'Attendance Shortage (< 75%)'
    }));

    const subjectLabel = selectedSubjectId === 'overall' ? 'OVERALL' : currentSub?.code || 'SUBJECT';
    const filename = `Attendance_${currentProg?.code || 'Course'}_Sec${currentSec?.name || 'Sec'}_${subjectLabel}_${new Date().toISOString().substring(0, 10)}`;

    exportToExcel(exportRows, filename);
    toast.success('Excel Generated', 'Spreadsheet download started.');
  };

  // Export to PDF
  const handleExportPdf = () => {
    if (filteredAndSortedList.length === 0) {
      toast.warning('No Data', 'No records to export.');
      return;
    }

    const currentDept = departments.find((d) => d.id === selectedDeptId);
    const currentProg = programs.find((p) => p.id === selectedProgramId);
    const currentSem = semesters.find((s) => s.id === selectedSemesterId);
    const currentSec = sections.find((s) => s.id === selectedSectionId);
    const currentSub = subjects.find((s) => s.id === selectedSubjectId);

    const subjectLabel = selectedSubjectId === 'overall' ? 'Overall Combined Curriculum' : `${currentSub?.code} - ${currentSub?.name}`;

    const pdfRows = filteredAndSortedList.map((r) => ({
      roll: r.roll_number,
      name: r.student_name,
      held: String(r.total_held),
      attended: String(r.attended_count),
      absent: String(r.absent_count),
      pct: `${r.attendance_percentage}%`,
      status: r.threshold_status === 'regular' ? 'ELIGIBLE' : 'SHORTAGE'
    }));

    exportToPdf({
      title: 'Consolidated Institutional Attendance Report',
      subtitle: `Dept: ${currentDept?.name} | Course: ${currentProg?.name} (Sem ${currentSem?.semester_number} - Section ${currentSec?.name}) | Subject: ${subjectLabel}`,
      filename: `Attendance_Report_${currentProg?.code || 'COURSE'}_Sec_${currentSec?.name || 'A'}`,
      institutionName: institution?.name || 'SDGI Global University',
      columns: [
        { header: 'Roll No', dataKey: 'roll' },
        { header: 'Student Name', dataKey: 'name' },
        { header: 'Held', dataKey: 'held' },
        { header: 'Attended', dataKey: 'attended' },
        { header: 'Absent', dataKey: 'absent' },
        { header: 'Attendance %', dataKey: 'pct' },
        { header: 'Status', dataKey: 'status' }
      ],
      data: pdfRows
    });

    toast.success('PDF Generated', 'Academic attendance report ready.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Institutional ERP
            </span>
            <span className="text-xs text-slate-400 font-semibold">• {institution?.name || 'SDGI Global University'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Attendance Reports & Statutory Analytics
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Select Department, Course, Semester, Section, and Subject to review real-time student attendance in tabular format.
          </p>
        </div>

        {hasQueried && attendanceData.length > 0 && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleShowAttendance}
              disabled={isLoadingAttendance}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
              title="Sync live records from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAttendance ? 'animate-spin' : ''}`} />
              <span>Sync Live</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition shadow-2xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        )}
      </div>

      {/* Sequential Filter Card: Department -> Course -> Year/Semester & Section -> Subject */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Filter Cohort & Curriculum Parameters
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Step 1 to 5: Select criteria then click Show Attendance
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
          {/* 1. Department */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-indigo-500" />
              <span>1. Department *</span>
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="">-- Choose Department --</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Course / Program */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-indigo-500" />
              <span>2. Course / Program *</span>
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              disabled={!selectedDeptId || programs.length === 0}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedDeptId
                  ? 'Select department first'
                  : programs.length === 0
                  ? 'No programs configured'
                  : '-- Choose Course --'}
              </option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.name} ({prog.code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Year / Semester */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
              <span>3. Year / Semester *</span>
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              disabled={!selectedProgramId || semesters.length === 0}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedProgramId
                  ? 'Select course first'
                  : semesters.length === 0
                  ? 'No terms configured'
                  : '-- Choose Semester --'}
              </option>
              {semesters.map((sem) => {
                const yearNum = Math.ceil(sem.semester_number / 2);
                const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
                const yearLabel = yearLabels[yearNum - 1] || `Year ${yearNum}`;
                return (
                  <option key={sem.id} value={sem.id}>
                    {yearLabel} • Semester {sem.semester_number}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 4. Section */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-500" />
              <span>4. Section Cohort *</span>
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedSemesterId || sections.length === 0}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedSemesterId
                  ? 'Select semester first'
                  : sections.length === 0
                  ? 'No sections configured'
                  : '-- Choose Section --'}
              </option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Subject (Overall + Respective Subjects) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-indigo-500" />
              <span>5. Subject Scope</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedSemesterId}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* First Option: Overall */}
              <option value="overall">⭐ Overall (All Subjects Combined)</option>

              {/* Respective Subjects */}
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code}: {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Active School Context:</span>
            <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
              {institution?.name || 'School Directorate'}
            </span>
          </div>

          <button
            onClick={handleShowAttendance}
            disabled={
              !selectedDeptId ||
              !selectedProgramId ||
              !selectedSemesterId ||
              !selectedSectionId ||
              isLoadingAttendance
            }
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoadingAttendance ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading Attendance...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Show Attendance Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Shown once queried) */}
      {hasQueried && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Students in Section</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Enrolled cohort count</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Average Attendance</span>
              <BarChart3 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.avg}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Cohort cumulative rate</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Eligible (≥ 75%)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-2">{stats.regular}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Statutory exam eligible</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Shortage (&lt; 75%)</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-black text-rose-700 mt-2">{stats.shortage}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Attendance shortage alerts</p>
          </div>
        </div>
      )}

      {/* Main Tabular View */}
      {hasQueried && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Table Controls Bar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by student name or roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-semibold shrink-0">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    statusFilter === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({attendanceData.length})
                </button>
                <button
                  onClick={() => setStatusFilter('regular')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    statusFilter === 'regular' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Eligible ({stats.regular})
                </button>
                <button
                  onClick={() => setStatusFilter('shortage')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    statusFilter === 'shortage' ? 'bg-rose-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Shortage ({stats.shortage})
                </button>
              </div>

              {/* Branch Filter Dropdown */}
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="py-1 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Branches</option>
                <option value="CSE">Branch: CSE</option>
                <option value="CS">Branch: CS</option>
                <option value="DS">Branch: DS</option>
                <option value="AI/ML">Branch: AI / ML</option>
                <option value="IT">Branch: IT</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filteredAndSortedList.length}</strong> of{' '}
              <strong className="text-slate-800">{attendanceData.length}</strong> students
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center text-slate-400">#</th>

                  {/* Roll Number Header with Sort */}
                  <th
                    onClick={() => handleSort('roll')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/50 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Roll Number</span>
                      {sortField === 'roll' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Student Name Header with Sort (Ascending / Descending as explicitly requested) */}
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/50 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student Name</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-4">Subject Scope</th>
                  <th className="py-3 px-4 text-center">Conducted</th>
                  <th className="py-3 px-4 text-center">Attended</th>
                  <th className="py-3 px-4 text-center">Absent</th>

                  {/* Attendance Percentage Header with Sort (Arrow Up / Arrow Down as explicitly requested) */}
                  <th
                    onClick={() => handleSort('attendance')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/50 transition select-none text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Attendance %</span>
                      {sortField === 'attendance' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-4 text-center">Eligibility Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-1">
                        <Users className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-600 text-sm">No Student Records Found</p>
                        <p className="text-xs text-slate-400">
                          {searchQuery
                            ? `No students matching "${searchQuery}".`
                            : 'No students registered in this section yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedList.map((st, idx) => (
                    <tr
                      key={st.student_id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                        {st.roll_number}
                      </td>

                      {/* Student Name & Branch */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{st.student_name}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                            st.branch === 'DS' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            st.branch === 'CS' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            st.branch === 'AI/ML' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            st.branch === 'IT' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' :
                            'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {st.branch || 'CSE'}
                          </span>
                        </div>
                        {st.email && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            {st.email}
                          </div>
                        )}
                      </td>

                      {/* Subject Scope */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700">{st.subject_code}</span>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {st.subject_name}
                        </div>
                      </td>

                      {/* Conducted Lectures */}
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {st.total_held}
                      </td>

                      {/* Attended */}
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">
                        {st.attended_count}
                      </td>

                      {/* Absent */}
                      <td className="py-3 px-4 text-center font-semibold text-rose-600">
                        {st.absent_count}
                      </td>

                      {/* Attendance Percentage with Progress Bar */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span
                            className={`font-black font-mono text-xs ${
                              st.attendance_percentage >= 75
                                ? 'text-emerald-700'
                                : st.attendance_percentage >= 65
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {st.attendance_percentage.toFixed(1)}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                st.attendance_percentage >= 75
                                  ? 'bg-emerald-500'
                                  : st.attendance_percentage >= 65
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, st.attendance_percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {st.threshold_status === 'regular' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Eligible
                          </span>
                        ) : st.threshold_status === 'warning' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Warning (65-74%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Shortage (&lt;75%)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary */}
          {filteredAndSortedList.length > 0 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-medium gap-2">
              <div>
                Statutory attendance threshold: <strong className="text-slate-800">75.0%</strong>. Students with attendance below this threshold are marked with Shortage.
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Eligible: {stats.regular}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Shortage: {stats.shortage}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initial Empty State Before Selecting and Querying */}
      {!hasQueried && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Select Parameters to Generate Attendance Report
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Choose your <strong>Department</strong>, <strong>Course</strong>, <strong>Semester/Year</strong>, <strong>Section</strong>, and <strong>Subject (Overall or Specific)</strong> above, then click <strong>"Show Attendance Report"</strong> to view real-time student attendance in a sortable tabular view.
          </p>
        </div>
      )}
    </div>
  );
};
