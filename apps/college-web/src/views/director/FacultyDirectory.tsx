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
  KeyRound,
  BookOpen,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  Sparkles,
  Key
} from 'lucide-react';

interface FacultyItem {
  id: string;
  profile_id: string;
  employee_code: string;
  designation: string;
  department_id: string;
  department?: { id: string; name: string; code: string };
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    is_active: boolean;
  };
  assignments?: Array<{
    id: string;
    is_primary: boolean;
    section?: { id: string; name: string };
    subject_offering?: {
      subject?: { name: string; code: string };
    };
  }>;
}

export const FacultyDirectory: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [faculty, setFaculty] = useState<FacultyItem[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjectOfferings, setSubjectOfferings] = useState<any[]>([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add Faculty Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [phone, setPhone] = useState('');
  const [deptId, setDeptId] = useState('');
  const [initialPassword, setInitialPassword] = useState('CampusPass2026!');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Faculty Modal
  const [editingFaculty, setEditingFaculty] = useState<FacultyItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmployeeCode, setEditEmployeeCode] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Assign Subject & Section Modal
  const [assigningFaculty, setAssigningFaculty] = useState<FacultyItem | null>(null);
  const [assignOfferingId, setAssignOfferingId] = useState('');
  const [assignSectionId, setAssignSectionId] = useState('');
  const [isPrimaryTeacher, setIsPrimaryTeacher] = useState(true);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Credential & Password Management Modal
  const [manageCredentialsFaculty, setManageCredentialsFaculty] = useState<FacultyItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [submittingPasswordChange, setSubmittingPasswordChange] = useState(false);
  const [issuedPin, setIssuedPin] = useState<string | null>(null);
  const [submittingPinReset, setSubmittingPinReset] = useState(false);

  // Delete Faculty Confirm Dialog
  const [deleteConfirmFaculty, setDeleteConfirmFaculty] = useState<FacultyItem | null>(null);
  const [deletingFaculty, setDeletingFaculty] = useState(false);

  // Status toggle confirm
  const [statusConfirmFaculty, setStatusConfirmFaculty] = useState<FacultyItem | null>(null);

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      const [
        { data: facData, error: facErr },
        { data: deptData, error: deptErr },
        { data: secData },
        { data: offerData }
      ] = await Promise.all([
        supabase
          .from('faculty')
          .select(`
            id, profile_id, employee_code, designation, department_id,
            department:departments(id, name, code),
            profile:profiles(id, first_name, last_name, email, phone_number, is_active),
            assignments:faculty_assignments(
              id, is_primary,
              section:sections(id, name),
              subject_offering:subject_offerings(
                subject:subjects(name, code)
              )
            )
          `)
          .order('employee_code'),
        supabase.from('departments').select('id, name, code').order('name'),
        supabase.from('sections').select('id, name').order('name'),
        supabase.from('subject_offerings').select('id, subject:subjects(name, code)')
      ]);

      if (facErr) throw facErr;
      if (deptErr) throw deptErr;

      setFaculty((facData as any) || []);
      setDepartments(deptData || []);
      setSections(secData || []);
      setSubjectOfferings(offerData || []);

      if (deptData && deptData.length > 0 && !deptId) {
        setDeptId(deptData[0].id);
      }
      if (offerData && offerData.length > 0 && !assignOfferingId) {
        setAssignOfferingId(offerData[0].id);
      }
      if (secData && secData.length > 0 && !assignSectionId) {
        setAssignSectionId(secData[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching faculty:', err);
      toast.error('Failed to load faculty directory', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  // Filtered & Paginated Faculty
  const filteredFaculty = faculty.filter((f) => {
    const name = `${f.profile?.first_name || ''} ${f.profile?.last_name || ''}`.toLowerCase();
    const code = (f.employee_code || '').toLowerCase();
    const emailStr = (f.profile?.email || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    const matchesSearch = name.includes(term) || code.includes(term) || emailStr.includes(term);
    const matchesDept = selectedDeptId === 'all' || f.department_id === selectedDeptId;
    return matchesSearch && matchesDept;
  });

  const totalPages = Math.ceil(filteredFaculty.length / pageSize) || 1;
  const paginatedFaculty = filteredFaculty.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handle Add Faculty
  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdd(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_create_faculty', {
        p_institution_id: DEFAULT_INSTITUTION_ID,
        p_department_id: deptId,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: email.trim().toLowerCase(),
        p_employee_code: employeeCode.trim().toUpperCase(),
        p_designation: designation.trim(),
        p_phone: phone.trim() || null,
        p_password: initialPassword.trim() || 'CampusPass2026!'
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Faculty Provisioned', `${firstName} ${lastName} (${employeeCode}) added with login credentials.`);
      setShowAddModal(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setEmployeeCode('');
      setPhone('');
      setInitialPassword('CampusPass2026!');
      fetchFaculty();
    } catch (err: any) {
      toast.error('Failed to add faculty', err.message);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Edit Faculty
  const handleOpenEdit = (f: FacultyItem) => {
    setEditingFaculty(f);
    setEditFirstName(f.profile?.first_name || '');
    setEditLastName(f.profile?.last_name || '');
    setEditEmail(f.profile?.email || '');
    setEditEmployeeCode(f.employee_code || '');
    setEditDesignation(f.designation || 'Assistant Professor');
    setEditPhone(f.profile?.phone_number || '');
    setEditDeptId(f.department_id || (departments[0]?.id ?? ''));
  };

  // Handle Edit Faculty
  const handleEditFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setSubmittingEdit(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_update_faculty', {
        p_faculty_id: editingFaculty.id,
        p_department_id: editDeptId,
        p_first_name: editFirstName.trim(),
        p_last_name: editLastName.trim(),
        p_email: editEmail.trim().toLowerCase(),
        p_employee_code: editEmployeeCode.trim().toUpperCase(),
        p_designation: editDesignation.trim(),
        p_phone: editPhone.trim() || null
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Faculty Updated', 'Faculty profile and credentials successfully updated.');
      setEditingFaculty(null);
      fetchFaculty();
    } catch (err: any) {
      toast.error('Failed to update faculty', err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Delete Faculty
  const handleConfirmDeleteFaculty = async () => {
    if (!deleteConfirmFaculty) return;
    setDeletingFaculty(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_delete_faculty', {
        p_faculty_id: deleteConfirmFaculty.id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Faculty Removed', `${deleteConfirmFaculty.profile?.first_name} ${deleteConfirmFaculty.profile?.last_name} deleted.`);
      setDeleteConfirmFaculty(null);
      fetchFaculty();
    } catch (err: any) {
      toast.error('Failed to delete faculty', err.message);
    } finally {
      setDeletingFaculty(false);
    }
  };

  // Handle Subject & Section Assignment
  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningFaculty) return;
    setSubmittingAssign(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_assign_faculty', {
        p_faculty_id: assigningFaculty.id,
        p_subject_offering_id: assignOfferingId,
        p_section_id: assignSectionId,
        p_is_primary: isPrimaryTeacher
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Teaching Assignment Created', 'Faculty mapped to course offering & section.');
      setAssigningFaculty(null);
      fetchFaculty();
    } catch (err: any) {
      toast.error('Failed to assign teaching load', err.message);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async () => {
    if (!statusConfirmFaculty || !statusConfirmFaculty.profile) return;
    const currentActive = statusConfirmFaculty.profile.is_active;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
        .eq('id', statusConfirmFaculty.profile_id);

      if (error) throw error;

      toast.success(
        'Status Changed',
        `Faculty is now ${!currentActive ? 'Active' : 'Deactivated'}.`
      );
      setStatusConfirmFaculty(null);
      fetchFaculty();
    } catch (err: any) {
      toast.error('Failed to update status', err.message);
    }
  };

  // Handle Set Direct Password
  const handleSetDirectPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageCredentialsFaculty || !manageCredentialsFaculty.profile_id) return;
    if (newPassword.trim().length < 6) {
      toast.error('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    setSubmittingPasswordChange(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_set_user_password', {
        p_profile_id: manageCredentialsFaculty.profile_id,
        p_new_password: newPassword.trim()
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(
        'Password Updated Successfully',
        `New password applied for ${manageCredentialsFaculty.profile?.email}.`
      );
    } catch (err: any) {
      toast.error('Password Update Failed', err.message);
    } finally {
      setSubmittingPasswordChange(false);
    }
  };

  // Handle Password Reset PIN / OTP Issuance
  const handleGeneratePin = async () => {
    if (!manageCredentialsFaculty) return;
    setSubmittingPinReset(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_reset_user_password', {
        p_profile_id: manageCredentialsFaculty.profile_id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setIssuedPin(data.temporary_pin);
      toast.success('Temporary OTP Issued', `Secure reset code generated for ${data.email}.`);
    } catch (err: any) {
      toast.error('Failed to issue OTP', err.message);
    } finally {
      setSubmittingPinReset(false);
    }
  };

  // Helper to generate random strong password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(result);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
    toast.success('Copied', 'Credential copied to clipboard.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Institutional Administration
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Director Control</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Faculty & Academic Staff</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage faculty profiles, employee IDs, authentication passwords, class assignments, and account access.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all self-start md:self-center cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Provision New Faculty
        </button>
      </div>

      {/* Directory Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty name, employee code, email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Department:</span>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : paginatedFaculty.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No faculty members found</h3>
            <p className="text-xs text-slate-400 mt-1">Adjust search parameters or provision a new faculty account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Employee Code</th>
                  <th className="py-3 px-4">Department & Designation</th>
                  <th className="py-3 px-4">Teaching Assignments</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedFaculty.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {f.profile?.first_name} {f.profile?.last_name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {f.profile?.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                      {f.employee_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{f.department?.name || 'Unassigned'}</div>
                      <div className="text-[11px] text-slate-500">{f.designation}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {f.assignments && f.assignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {f.assignments.map((asg) => (
                            <span
                              key={asg.id}
                              className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                            >
                              {asg.subject_offering?.subject?.code} ({asg.section?.name})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No classes assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={f.profile?.is_active ? 'active' : 'suspended'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setAssigningFaculty(f)}
                          title="Assign Course & Section"
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors border border-indigo-100 cursor-pointer"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(f)}
                          title="Edit Faculty Details & ID"
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setManageCredentialsFaculty(f);
                            setNewPassword('');
                            setIssuedPin(null);
                          }}
                          title="Manage ID & Login Password"
                          className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors border border-amber-200 cursor-pointer"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setStatusConfirmFaculty(f)}
                          title={f.profile?.is_active ? 'Deactivate' : 'Reactivate'}
                          className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
                            f.profile?.is_active
                              ? 'hover:bg-amber-50 text-amber-600 border-amber-200'
                              : 'hover:bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmFaculty(f)}
                          title="Delete Faculty Account"
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

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredFaculty.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Add Faculty Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Provision New Faculty Account">
        <form onSubmit={handleAddFaculty} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Vikram"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Sharma"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Employee Code *</label>
              <input
                type="text"
                required
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder="e.g. EMP-CSE-104"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Designation *</label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="Professor">Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Adjunct Lecturer">Adjunct Lecturer</option>
                <option value="Teaching Assistant">Teaching Assistant</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Department *</label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Institutional Email (Login ID) *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vikram.sharma@faculty.campusattend.edu"
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
                type={showAddPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                className="w-full p-2 pr-9 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAddPassword(!showAddPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showAddPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {submittingAdd ? 'Provisioning...' : 'Confirm Provisioning'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Faculty Modal */}
      <Modal isOpen={!!editingFaculty} onClose={() => setEditingFaculty(null)} title="Edit Faculty Profile & ID">
        <form onSubmit={handleEditFaculty} className="space-y-4">
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
              <label className="text-[11px] font-bold text-slate-600">Employee Code</label>
              <input
                type="text"
                required
                value={editEmployeeCode}
                onChange={(e) => setEditEmployeeCode(e.target.value.toUpperCase())}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Department</label>
              <select
                value={editDeptId}
                onChange={(e) => setEditDeptId(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Designation</label>
              <input
                type="text"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
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
              onClick={() => setEditingFaculty(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingEdit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {submittingEdit ? 'Saving...' : 'Save Updates'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Subject & Section Modal */}
      <Modal
        isOpen={!!assigningFaculty}
        onClose={() => setAssigningFaculty(null)}
        title={`Assign Teaching Load: ${assigningFaculty?.profile?.first_name} ${assigningFaculty?.profile?.last_name}`}
      >
        <form onSubmit={handleAssignFaculty} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-600">Subject Offering *</label>
            <select
              value={assignOfferingId}
              onChange={(e) => setAssignOfferingId(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
            >
              {subjectOfferings.map((so) => (
                <option key={so.id} value={so.id}>
                  {so.subject?.name} ({so.subject?.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Target Section *</label>
            <select
              value={assignSectionId}
              onChange={(e) => setAssignSectionId(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimaryTeacher}
              onChange={(e) => setIsPrimaryTeacher(e.target.checked)}
              className="rounded text-indigo-600 cursor-pointer"
            />
            <label htmlFor="isPrimary" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Primary Course Instructor (receives direct attendance session rights)
            </label>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAssigningFaculty(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAssign}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {submittingAssign ? 'Assigning...' : 'Assign Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Credential & Password Management Modal */}
      <Modal
        isOpen={!!manageCredentialsFaculty}
        onClose={() => {
          setManageCredentialsFaculty(null);
          setNewPassword('');
          setIssuedPin(null);
        }}
        title={`Credentials & Password: ${manageCredentialsFaculty?.profile?.first_name} ${manageCredentialsFaculty?.profile?.last_name}`}
      >
        <div className="space-y-4">
          {/* Identity Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Login ID (Email):</span>
              <span className="font-bold text-slate-900 font-mono">{manageCredentialsFaculty?.profile?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Employee Code:</span>
              <span className="font-bold text-indigo-700 font-mono">{manageCredentialsFaculty?.employee_code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Academic Role:</span>
              <span className="font-semibold text-slate-700">{manageCredentialsFaculty?.designation} ({manageCredentialsFaculty?.department?.code})</span>
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
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                className="w-full p-2.5 pr-20 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newPassword)}
                    title="Copy Password"
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Updates password in Supabase Auth immediately. The faculty member can log in using their email and this password.
            </p>

            <button
              type="submit"
              disabled={submittingPasswordChange || !newPassword}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{submittingPasswordChange ? 'Updating Password...' : 'Save & Update Login Password'}</span>
            </button>
          </form>

          {/* Secondary Option: Issue OTP PIN */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Need single-use temporary OTP instead?</span>
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

      {/* Delete Faculty Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmFaculty}
        onClose={() => setDeleteConfirmFaculty(null)}
        onConfirm={handleConfirmDeleteFaculty}
        title="Delete Faculty Account"
        message={`Are you sure you want to permanently delete faculty member ${deleteConfirmFaculty?.profile?.first_name} ${deleteConfirmFaculty?.profile?.last_name} (${deleteConfirmFaculty?.employee_code})? This will remove their teaching allocations and authentication access.`}
        confirmLabel={deletingFaculty ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />

      {/* Status Toggle Confirm */}
      <ConfirmDialog
        isOpen={!!statusConfirmFaculty}
        onClose={() => setStatusConfirmFaculty(null)}
        onConfirm={handleToggleStatus}
        title={statusConfirmFaculty?.profile?.is_active ? 'Deactivate Faculty Access' : 'Reactivate Faculty Access'}
        message={`Are you sure you want to ${
          statusConfirmFaculty?.profile?.is_active ? 'deactivate' : 'reactivate'
        } ${statusConfirmFaculty?.profile?.first_name} ${statusConfirmFaculty?.profile?.last_name}?`}
        confirmLabel={statusConfirmFaculty?.profile?.is_active ? 'Deactivate' : 'Reactivate'}
        variant={statusConfirmFaculty?.profile?.is_active ? 'danger' : 'primary'}
      />
    </div>
  );
};
