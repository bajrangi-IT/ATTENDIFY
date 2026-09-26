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
  SlidersHorizontal,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  Sparkles,
  Key
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
  const [newPassword, setNewPassword] = useState('CampusPass2026!');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Student Modal
  const [editingStudent, setEditingStudent] = useState<StudentDirectoryItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRollNumber, setEditRollNumber] = useState('');
  const [editRegNumber, setEditRegNumber] = useState('');
  const [editBatchYear, setEditBatchYear] = useState(2023);
  const [editSectionId, setEditSectionId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Transfer Student Modal
  const [transferringStudent, setTransferringStudent] = useState<StudentDirectoryItem | null>(null);
  const [transferTargetSectionId, setTransferTargetSectionId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Credential & Password Management Modal
  const [manageCredentialsStudent, setManageCredentialsStudent] = useState<StudentDirectoryItem | null>(null);
  const [studentNewPassword, setStudentNewPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [submittingPasswordChange, setSubmittingPasswordChange] = useState(false);
  const [issuedPin, setIssuedPin] = useState<string | null>(null);
  const [submittingPinReset, setSubmittingPinReset] = useState(false);

  // Delete Student Confirm Dialog
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<StudentDirectoryItem | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

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

      if (data) {
        setStudents(data.items || []);
        setTotalCount(data.total_count || 0);
      }
    } catch (err: any) {
      console.error('Failed to query students:', err);
      toast.error('Search failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
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

  // Load detailed student attendance report for drill-down modal
  const handleOpenStudentDetail = async (st: StudentDirectoryItem) => {
    setSelectedStudent(st);
    setLoadingProfileDetails(true);
    try {
      const [{ data: sumData }, { data: recData }, { data: auditData }] = await Promise.all([
        supabase
          .from('v_student_attendance_summary')
          .select('*')
          .eq('student_id', st.student_id),
        supabase
          .from('attendance_records')
          .select(`
            id, status, is_late, marked_at,
            session:attendance_sessions(
              session_date, start_time, end_time,
              subject_offering:subject_offerings(subject:subjects(name, code))
            )
          `)
          .eq('student_id', st.student_id)
          .order('marked_at', { ascending: false })
          .limit(10),
        supabase
          .from('enrollment_history')
          .select(`
            id, effective_date, reason,
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
        p_phone: newPhone.trim() || null,
        p_password: newPassword.trim() || 'CampusPass2026!'
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Student Enrolled', `${newFirstName} ${newLastName} enrolled with login credentials.`);
      setShowCreateModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewRollNumber('');
      setNewRegNumber('');
      setNewPhone('');
      setNewPassword('CampusPass2026!');
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
    setEditEmail(st.email);
    setEditRollNumber(st.roll_number);
    setEditRegNumber(st.registration_number || st.roll_number);
    setEditBatchYear(st.batch_year);
    setEditSectionId(st.section_id);
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
        p_email: editEmail.trim().toLowerCase(),
        p_phone: editPhone.trim() || null,
        p_roll_number: editRollNumber.trim().toUpperCase(),
        p_registration_number: editRegNumber.trim().toUpperCase(),
        p_batch_year: Number(editBatchYear),
        p_section_id: editSectionId || null
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

  // Delete Student
  const handleConfirmDeleteStudent = async () => {
    if (!deleteConfirmStudent) return;
    setDeletingStudent(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_delete_student', {
        p_student_id: deleteConfirmStudent.student_id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Student Removed', `${deleteConfirmStudent.full_name} (${deleteConfirmStudent.roll_number}) deleted.`);
      setDeleteConfirmStudent(null);
      fetchStudents();
    } catch (err: any) {
      toast.error('Failed to delete student', err.message);
    } finally {
      setDeletingStudent(false);
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

  // Direct Password Update
  const handleSetDirectPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageCredentialsStudent || !manageCredentialsStudent.profile_id) return;
    if (studentNewPassword.trim().length < 6) {
      toast.error('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    setSubmittingPasswordChange(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_set_user_password', {
        p_profile_id: manageCredentialsStudent.profile_id,
        p_new_password: studentNewPassword.trim()
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(
        'Password Updated Successfully',
        `New password applied for ${manageCredentialsStudent.email}.`
      );
    } catch (err: any) {
      toast.error('Password Update Failed', err.message);
    } finally {
      setSubmittingPasswordChange(false);
    }
  };

  // Password Reset PIN / OTP
  const handleGeneratePin = async () => {
    if (!manageCredentialsStudent) return;
    setSubmittingPinReset(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_reset_user_password', {
        p_profile_id: manageCredentialsStudent.profile_id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setIssuedPin(data.temporary_pin);
      toast.success('Reset Code Generated', `Security OTP generated for ${data.email}.`);
    } catch (err: any) {
      toast.error('Password Reset Failed', err.message);
    } finally {
      setSubmittingPinReset(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setStudentNewPassword(result);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
    toast.success('Copied', 'Credential copied to clipboard.');
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
            Manage student records, roll numbers, authentication credentials, class transfers, and attendance thresholds.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all self-start md:self-center cursor-pointer"
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
                className="py-1.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
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
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer"
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
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer"
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
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer"
              >
                <option value="">All Semesters</option>
                {semesters
                  .filter((s) => !selectedProgramId || s.program_id === selectedProgramId)
                  .map((s) => (
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
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer"
              >
                <option value="">All Sections</option>
                {sections
                  .filter((sec) => !selectedSemesterId || sec.semester_id === selectedSemesterId)
                  .map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No students found</h3>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the search criteria or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Roll & Reg No.</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4 text-center">Attendance Gauge</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => (
                  <tr key={st.student_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{st.full_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {st.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-indigo-700">{st.roll_number}</div>
                      <div className="text-[10px] text-slate-400">{st.registration_number}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {st.program_name} • Sem {st.semester_number}
                      </div>
                      <div className="text-[11px] text-indigo-600 font-bold">Section {st.section_name}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`font-black text-xs ${
                            st.threshold_status === 'good'
                              ? 'text-emerald-700'
                              : st.threshold_status === 'warning'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {st.overall_attendance_percentage}%
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            st.threshold_status === 'good'
                              ? 'bg-emerald-50 text-emerald-600'
                              : st.threshold_status === 'warning'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {st.threshold_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={st.enrollment_status === 'active' ? 'active' : 'suspended'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenStudentDetail(st)}
                          title="View Attendance Breakdown"
                          className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setTransferringStudent(st);
                            setTransferTargetSectionId(st.section_id);
                          }}
                          title="Transfer Section / Semester"
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors border border-indigo-200 cursor-pointer"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          title="Edit Student Record & ID"
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setManageCredentialsStudent(st);
                            setStudentNewPassword('');
                            setIssuedPin(null);
                          }}
                          title="Manage ID & Login Password"
                          className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors border border-amber-200 cursor-pointer"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setStatusToggleStudent(st)}
                          title={st.enrollment_status === 'active' ? 'Deactivate Student' : 'Reactivate Student'}
                          className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
                            st.enrollment_status === 'active'
                              ? 'hover:bg-amber-50 text-amber-600 border-amber-200'
                              : 'hover:bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmStudent(st)}
                          title="Delete Student Record"
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-red-200 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
              <label className="text-[11px] font-bold text-slate-600">Roll Number (Student ID) *</label>
              <input
                type="text"
                required
                value={newRollNumber}
                onChange={(e) => setNewRollNumber(e.target.value.toUpperCase())}
                placeholder="e.g. CS2023024"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Registration Number</label>
              <input
                type="text"
                value={newRegNumber}
                onChange={(e) => setNewRegNumber(e.target.value.toUpperCase())}
                placeholder="REG-2023-0024"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Class Section *</label>
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
              <label className="text-[11px] font-bold text-slate-600">Institutional Email (Login ID) *</label>
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

          <div>
            <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
              <span>Initial Login Password *</span>
              <span className="text-[10px] text-slate-400 font-normal">Min. 6 characters</span>
            </label>
            <div className="relative mt-1">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 pr-9 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {createSubmitting ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit Student Record & ID">
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
              <label className="text-[11px] font-bold text-slate-600">Institutional Email (Login ID)</label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Registration Number</label>
              <input
                type="text"
                value={editRegNumber}
                onChange={(e) => setEditRegNumber(e.target.value.toUpperCase())}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Section</label>
              <select
                value={editSectionId}
                onChange={(e) => setEditSectionId(e.target.value)}
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
              <label className="text-[11px] font-bold text-slate-600">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {editSubmitting ? 'Saving...' : 'Save Updates'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Credential & Password Management Modal */}
      <Modal
        isOpen={!!manageCredentialsStudent}
        onClose={() => {
          setManageCredentialsStudent(null);
          setStudentNewPassword('');
          setIssuedPin(null);
        }}
        title={`Credentials & Password: ${manageCredentialsStudent?.full_name}`}
      >
        <div className="space-y-4">
          {/* Identity Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Login ID (Email):</span>
              <span className="font-bold text-slate-900 font-mono">{manageCredentialsStudent?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Roll Number:</span>
              <span className="font-bold text-indigo-700 font-mono">{manageCredentialsStudent?.roll_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Cohort & Section:</span>
              <span className="font-semibold text-slate-700">{manageCredentialsStudent?.program_name} (Section {manageCredentialsStudent?.section_name})</span>
            </div>
          </div>

          {/* Direct Password Form */}
          <form onSubmit={handleSetDirectPassword} className="space-y-3 pt-1 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Set New Login Password</span>
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Generate Strong</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showStudentPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={studentNewPassword}
                onChange={(e) => setStudentNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                className="w-full p-2.5 pr-20 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {studentNewPassword && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(studentNewPassword)}
                    title="Copy Password"
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowStudentPassword(!showStudentPassword)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showStudentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Instantly updates the password in Supabase Auth. The student can immediately sign in to their mobile scanner app or web portal.
            </p>

            <button
              type="submit"
              disabled={submittingPasswordChange || !studentNewPassword}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{submittingPasswordChange ? 'Updating Password...' : 'Save & Update Login Password'}</span>
            </button>
          </form>

          {/* Secondary Option: Issue OTP PIN */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Issue temporary single-use OTP?</span>
              <button
                type="button"
                onClick={handleGeneratePin}
                disabled={submittingPinReset}
                className="text-xs text-amber-700 hover:text-amber-800 font-bold cursor-pointer"
              >
                {submittingPinReset ? 'Generating...' : 'Issue Reset OTP'}
              </button>
            </div>

            {issuedPin && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Temporary 6-Digit OTP PIN
                </span>
                <div className="text-2xl font-mono font-black text-amber-900 tracking-widest">
                  {issuedPin}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Student Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmStudent}
        onClose={() => setDeleteConfirmStudent(null)}
        onConfirm={handleConfirmDeleteStudent}
        title="Delete Student Record"
        message={`Are you sure you want to permanently delete student ${deleteConfirmStudent?.full_name} (${deleteConfirmStudent?.roll_number})? This will permanently delete their registry profile, attendance records, and login credentials.`}
        confirmLabel={deletingStudent ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />

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
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {transferSubmitting ? 'Transferring...' : 'Execute Section Transfer'}
            </button>
          </div>
        </form>
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
