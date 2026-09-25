import React, { useState, useEffect } from 'react';
import { supabase, DEFAULT_INSTITUTION_ID } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TablePagination } from '../../components/ui/TablePagination';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Mail,
  BookOpen,
  ArrowRightLeft,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Percent,
  SlidersHorizontal
} from 'lucide-react';

interface StudentDirectoryItem {
  student_id: string;
  profile_id: string;
  roll_number: string;
  registration_number: string;
  batch_year: number;
  enrollment_status: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  user_active: boolean;
  department_id: string;
  department_name: string;
  program_id: string;
  program_name: string;
  semester_id: string;
  semester_number: number;
  section_id: string;
  section_name: string;
  overall_attendance_percentage: number;
  threshold_status: 'good' | 'warning' | 'critical';
}

export const StudentDirectory: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentDirectoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Metadata for filter dropdowns
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Server-side filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedThreshold, setSelectedThreshold] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Student Profile Detail Modal
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryItem | null>(null);
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [studentSummary, setStudentSummary] = useState<any[]>([]);
  const [studentAuditHistory, setStudentAuditHistory] = useState<any[]>([]);
  const [loadingProfileDetails, setLoadingProfileDetails] = useState(false);

  // Enroll Student Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRollNumber, setNewRollNumber] = useState('');
  const [newRegNumber, setNewRegNumber] = useState('');
  const [newSectionId, setNewSectionId] = useState('');
  const [newBatchYear, setNewBatchYear] = useState(new Date().getFullYear());
  const [newPhone, setNewPhone] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Student Modal
  const [editingStudent, setEditingStudent] = useState<StudentDirectoryItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRollNumber, setEditRollNumber] = useState('');
  const [editBatchYear, setEditBatchYear] = useState(2023);
  const [editPhone, setEditPhone] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Transfer Student Modal
  const [transferringStudent, setTransferringStudent] = useState<StudentDirectoryItem | null>(null);
  const [transferTargetSectionId, setTransferTargetSectionId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Password Reset / OTP Modal
  const [resetModalStudent, setResetModalStudent] = useState<StudentDirectoryItem | null>(null);
  const [issuedPin, setIssuedPin] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Status toggle confirmation
  const [statusToggleStudent, setStatusToggleStudent] = useState<StudentDirectoryItem | null>(null);

  // Load Metadata
  useEffect(() => {
    async function loadAcademicMetadata() {
      try {
        const [{ data: depts }, { data: progs }, { data: sems }, { data: secs }] = await Promise.all([
          supabase.from('departments').select('id, name, code').order('name'),
          supabase.from('programs').select('id, name, code, department_id').order('name'),
          supabase.from('semesters').select('id, semester_number, program_id').order('semester_number'),
          supabase.from('sections').select('id, name, semester_id').order('name'),
        ]);

        setDepartments(depts || []);
        setPrograms(progs || []);
        setSemesters(sems || []);
        setSections(secs || []);

        if (secs && secs.length > 0) {
          setNewSectionId(secs[0].id);
          setTransferTargetSectionId(secs[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load academic metadata:', err);
      }
    }
    loadAcademicMetadata();
  }, []);

  // Server-Side Search Query to PostgreSQL RPC
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const { data, error } = await supabase.rpc('rpc_search_students', {
        p_query: searchTerm.trim() || null,
        p_department_id: selectedDeptId || null,
        p_program_id: selectedProgramId || null,
        p_semester_id: selectedSemesterId || null,
        p_section_id: selectedSectionId || null,
        p_threshold_status: selectedThreshold || null,
        p_limit: pageSize,
        p_offset: offset
      });

      if (error) throw error;

      setStudents(data?.items || []);
      setTotalCount(data?.total_count || 0);
    } catch (err: any) {
      console.error('Error in rpc_search_students:', err);
      toast.error('Search Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchStudents();
    }, 200);
    return () => clearTimeout(handler);
  }, [
    searchTerm,
    selectedDeptId,
    selectedProgramId,
    selectedSemesterId,
    selectedSectionId,
    selectedThreshold,
    currentPage,
    pageSize
  ]);

  // Open Detailed Student Attendance Profile
  const handleOpenStudentProfile = async (st: StudentDirectoryItem) => {
    setSelectedStudent(st);
    setLoadingProfileDetails(true);
    try {
      const [{ data: sumData }, { data: recData }, { data: auditData }] = await Promise.all([
        supabase.from('v_student_attendance_summary').select('*').eq('student_id', st.student_id),
        supabase
          .from('attendance_records')
          .select(`
            id, status, verification_method, marked_at, remarks,
            session:attendance_sessions(
              session_date, start_time, end_time, session_type,
              subject_offering:subject_offerings(subject:subjects(code, name))
            )
          `)
          .eq('student_id', st.student_id)
          .order('marked_at', { ascending: false })
          .limit(50),
        supabase
          .from('enrollment_history')
          .select(`
            id, effective_date, reason, created_at,
            from_section:sections!from_section_id(name),
            to_section:sections!to_section_id(name)
          `)
          .eq('student_id', st.student_id)
          .order('effective_date', { ascending: false })
      ]);

      setStudentSummary(sumData || []);
      setStudentRecords(recData || []);
      setStudentAuditHistory(auditData || []);
    } catch (err: any) {
      toast.error('Error loading history', err.message);
    } finally {
      setLoadingProfileDetails(false);
    }
  };

  // Create Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_create_student', {
        p_institution_id: DEFAULT_INSTITUTION_ID,
        p_first_name: newFirstName.trim(),
        p_last_name: newLastName.trim(),
        p_email: newEmail.trim().toLowerCase(),
        p_roll_number: newRollNumber.trim().toUpperCase(),
        p_registration_number: (newRegNumber.trim() || newRollNumber.trim()).toUpperCase(),
        p_section_id: newSectionId,
        p_batch_year: Number(newBatchYear),
        p_phone: newPhone.trim() || null
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Student Enrolled', `${newFirstName} ${newLastName} added to academic registry.`);
      setShowCreateModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewRollNumber('');
      setNewRegNumber('');
      setNewPhone('');
      fetchStudents();
    } catch (err: any) {
      toast.error('Enrollment Failed', err.message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (st: StudentDirectoryItem) => {
    setEditingStudent(st);
    setEditFirstName(st.first_name);
    setEditLastName(st.last_name);
    setEditRollNumber(st.roll_number);
    setEditBatchYear(st.batch_year);
    setEditPhone(st.phone || '');
  };

  // Save Edit Student
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_update_student', {
        p_student_id: editingStudent.student_id,
        p_first_name: editFirstName.trim(),
        p_last_name: editLastName.trim(),
        p_phone: editPhone.trim() || null,
        p_roll_number: editRollNumber.trim().toUpperCase(),
        p_batch_year: Number(editBatchYear)
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Student Record Updated', `${editFirstName} ${editLastName} updated.`);
      setEditingStudent(null);
      fetchStudents();
    } catch (err: any) {
      toast.error('Update Failed', err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Transfer Student (Section/Semester)
  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringStudent) return;
    setTransferSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_transfer_student', {
        p_student_id: transferringStudent.student_id,
        p_to_section_id: transferTargetSectionId,
        p_reason: transferReason.trim()
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Transfer Complete', 'Student transferred and recorded in enrollment history.');
      setTransferringStudent(null);
      setTransferReason('');
      fetchStudents();
    } catch (err: any) {
      toast.error('Transfer Failed', err.message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async () => {
    if (!statusToggleStudent) return;
    const isCurrentlyActive = statusToggleStudent.enrollment_status === 'active';
    const nextStatus = isCurrentlyActive ? 'inactive' : 'active';
    try {
      const { data, error } = await supabase.rpc('rpc_admin_toggle_student_status', {
        p_student_id: statusToggleStudent.student_id,
        p_status: nextStatus
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Status Changed', `Student status is now ${nextStatus}.`);
      setStatusToggleStudent(null);
      fetchStudents();
    } catch (err: any) {
      toast.error('Status Change Failed', err.message);
    }
  };

  // Password Reset / OTP
  const handleResetPassword = async () => {
    if (!resetModalStudent) return;
    setResetSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_reset_user_password', {
        p_profile_id: resetModalStudent.profile_id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setIssuedPin(data.temporary_pin);
      toast.success('Reset Code Generated', `Security OTP generated for ${data.email}.`);
    } catch (err: any) {
      toast.error('Password Reset Failed', err.message);
    } finally {
      setResetSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              PostgreSQL Scaled Registry
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Director Control</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Student Academic Registry</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Indexed search across {totalCount} enrolled students with server-side pagination, section transfers, and statutory threshold monitoring.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all self-start md:self-center"
        >
          <Plus className="h-4 w-4" /> Enroll New Student
        </button>
      </div>

      {/* Directory Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Multi-filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Global Search */}
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, roll number, registration ID, or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            {/* Attendance Threshold Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-500">Threshold:</span>
              <select
                value={selectedThreshold}
                onChange={(e) => {
                  setSelectedThreshold(e.target.value);
                  setCurrentPage(1);
                }}
                className="py-1.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="">All Attendance</option>
                <option value="good">Good (≥ 80%)</option>
                <option value="warning">Warning (75% - 79%)</option>
                <option value="critical">Critical (&lt; 75%)</option>
              </select>
            </div>
          </div>

          {/* Academic Hierarchy Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div>
              <select
                value={selectedDeptId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value);
                  setSelectedProgramId('');
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedProgramId}
                onChange={(e) => {
                  setSelectedProgramId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600"
              >
                <option value="">All Programs</option>
                {programs
                  .filter((p) => !selectedDeptId || p.department_id === selectedDeptId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <select
                value={selectedSemesterId}
                onChange={(e) => {
                  setSelectedSemesterId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    Semester {s.semester_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600"
              >
                <option value="">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Students Table */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No students match filter criteria</h3>
            <p className="text-xs text-slate-400 mt-1">Try resetting search filters or enroll a new student.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Academic Placement</th>
                  <th className="py-3 px-4 text-center">Attendance %</th>
                  <th className="py-3 px-4">Enrollment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => (
                  <tr key={st.student_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleOpenStudentProfile(st)}
                        className="font-bold text-slate-900 hover:text-indigo-600 text-left transition-colors"
                      >
                        {st.full_name}
                      </button>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {st.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      {st.roll_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {st.program_name} (Sem {st.semester_number})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {st.department_name} • <span className="font-bold text-indigo-600">{st.section_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            st.threshold_status === 'good'
                              ? 'bg-emerald-500'
                              : st.threshold_status === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        />
                        <span
                          className={
                            st.threshold_status === 'good'
                              ? 'text-emerald-700'
                              : st.threshold_status === 'warning'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }
                        >
                          {st.overall_attendance_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={st.enrollment_status as any} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenStudentProfile(st)}
                          title="View Attendance Gauge & History"
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-slate-200"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setTransferringStudent(st);
                            setTransferTargetSectionId(st.section_id);
                          }}
                          title="Transfer Section / Semester"
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors border border-indigo-200"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          title="Edit Student Record"
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-slate-200"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setResetModalStudent(st);
                            setIssuedPin(null);
                          }}
                          title="Issue Password Reset PIN"
                          className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors border border-amber-200"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setStatusToggleStudent(st)}
                          title={st.enrollment_status === 'active' ? 'Deactivate Student' : 'Reactivate Student'}
                          className={`p-1.5 rounded-lg transition-colors border ${
                            st.enrollment_status === 'active'
                              ? 'hover:bg-red-50 text-red-600 border-red-200'
                              : 'hover:bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Enroll Student Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Enroll New Student">
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">First Name *</label>
              <input
                type="text"
                required
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="e.g. Diya"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Last Name *</label>
              <input
                type="text"
                required
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="e.g. Sen"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Roll Number *</label>
              <input
                type="text"
                required
                value={newRollNumber}
                onChange={(e) => setNewRollNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 23CSE089"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Registration Number</label>
              <input
                type="text"
                value={newRegNumber}
                onChange={(e) => setNewRegNumber(e.target.value.toUpperCase())}
                placeholder="e.g. REG-2023-CS-089"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Cohort Section *</label>
              <select
                value={newSectionId}
                onChange={(e) => setNewSectionId(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Batch Year *</label>
              <input
                type="number"
                required
                value={newBatchYear}
                onChange={(e) => setNewBatchYear(Number(e.target.value))}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Institutional Email *</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="diya.sen@student.campusattend.edu"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Contact Phone</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
            >
              {createSubmitting ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit Student Record">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">First Name</label>
              <input
                type="text"
                required
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Last Name</label>
              <input
                type="text"
                required
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Roll Number</label>
              <input
                type="text"
                required
                value={editRollNumber}
                onChange={(e) => setEditRollNumber(e.target.value.toUpperCase())}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Batch Year</label>
              <input
                type="number"
                value={editBatchYear}
                onChange={(e) => setEditBatchYear(Number(e.target.value))}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Phone</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              {editSubmitting ? 'Saving...' : 'Save Updates'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Section / Semester Modal */}
      <Modal
        isOpen={!!transferringStudent}
        onClose={() => setTransferringStudent(null)}
        title={`Transfer Student Cohort: ${transferringStudent?.full_name}`}
      >
        <form onSubmit={handleTransferStudent} className="space-y-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900">
            Current Section: <span className="font-bold">{transferringStudent?.section_name}</span> ({transferringStudent?.department_name})
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Transfer To Target Section *</label>
            <select
              value={transferTargetSectionId}
              onChange={(e) => setTransferTargetSectionId(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Administrative Transfer Reason *</label>
            <textarea
              required
              rows={3}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g. Branch migration, elective course alignment, or academic promotion..."
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTransferringStudent(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              {transferSubmitting ? 'Transferring...' : 'Execute Section Transfer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={!!resetModalStudent}
        onClose={() => {
          setResetModalStudent(null);
          setIssuedPin(null);
        }}
        title="Student Password Reset"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Zero Plaintext Exposure Policy:</span> Generating an administrative reset produces a single-use verification PIN logged into security audits.
            </div>
          </div>

          <div className="text-xs text-slate-600">
            Student: <span className="font-bold text-slate-900">{resetModalStudent?.full_name}</span> ({resetModalStudent?.email})
          </div>

          {issuedPin ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Single-Use Reset PIN Issued
              </span>
              <div className="text-3xl font-mono font-black text-emerald-900 tracking-widest">
                {issuedPin}
              </div>
              <p className="text-[11px] text-emerald-600 font-medium">
                Convey this PIN securely to the student. They will be required to set a new password on their mobile app.
              </p>
            </div>
          ) : (
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetModalStudent(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetSubmitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl"
              >
                {resetSubmitting ? 'Generating...' : 'Issue Reset PIN'}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Student Profile Detail Modal */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={`Student Profile: ${selectedStudent?.full_name}`}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Roll Number</span>
              <span className="font-mono font-bold text-slate-900">{selectedStudent?.roll_number}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Department</span>
              <span className="font-bold text-slate-900">{selectedStudent?.department_name}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Section</span>
              <span className="font-bold text-indigo-700">{selectedStudent?.section_name}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Overall Gauge</span>
              <span className="font-black text-emerald-700">{selectedStudent?.overall_attendance_percentage}%</span>
            </div>
          </div>

          {/* Subject-Wise Summary */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Subject Attendance Breakdown</h4>
            {loadingProfileDetails ? (
              <div className="text-xs text-slate-400 py-3">Loading breakdown...</div>
            ) : studentSummary.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 italic">No subject sessions held for this cohort yet.</div>
            ) : (
              <div className="space-y-2">
                {studentSummary.map((sum) => (
                  <div key={sum.subject_offering_id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{sum.subject_name} ({sum.subject_code})</div>
                      <div className="text-[11px] text-slate-500">
                        Attended {sum.attended_count} of {sum.total_held} lectures
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-sm text-slate-900">{sum.attendance_percentage}%</span>
                      <span className={`block text-[10px] font-bold uppercase ${
                        sum.threshold_status === 'good' ? 'text-emerald-600' : sum.threshold_status === 'warning' ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {sum.threshold_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrollment History */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Enrollment & Section History</h4>
            {studentAuditHistory.length === 0 ? (
              <div className="text-xs text-slate-400 py-2 italic">Initial cohort enrollment only. No transfers recorded.</div>
            ) : (
              <div className="space-y-1.5">
                {studentAuditHistory.map((hist) => (
                  <div key={hist.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">
                        {hist.from_section?.name || 'Previous'} → {hist.to_section?.name || 'New Section'}
                      </span>
                      <p className="text-[11px] text-slate-500 italic mt-0.5">{hist.reason}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{hist.effective_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Status Toggle Confirm */}
      <ConfirmDialog
        isOpen={!!statusToggleStudent}
        onClose={() => setStatusToggleStudent(null)}
        onConfirm={handleToggleStatus}
        title={statusToggleStudent?.enrollment_status === 'active' ? 'Deactivate Student Record' : 'Reactivate Student Record'}
        message={`Are you sure you want to ${
          statusToggleStudent?.enrollment_status === 'active' ? 'deactivate' : 'reactivate'
        } student ${statusToggleStudent?.full_name} (${statusToggleStudent?.roll_number})?`}
        confirmLabel={statusToggleStudent?.enrollment_status === 'active' ? 'Deactivate' : 'Reactivate'}
        variant={statusToggleStudent?.enrollment_status === 'active' ? 'danger' : 'primary'}
      />
    </div>
  );
};
