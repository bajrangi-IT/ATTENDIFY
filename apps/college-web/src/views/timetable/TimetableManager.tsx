import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { exportToExcel } from '../../lib/exportUtils';
import {
  Calendar,
  Clock,
  Plus,
  AlertTriangle,
  UserX,
  Trash2,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  UserCheck,
  Edit,
  History,
  ShieldCheck,
  DoorOpen,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { formatSectionLabel, formatSectionShortBadge } from '../../lib/academicLabels';
import { ManualAttendanceModal, ManualAttendancePreload } from '../../components/ManualAttendanceModal';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
];

const TIME_SLOTS = [
  { start: '09:00:00', end: '10:00:00', label: '09:00 - 10:00 AM' },
  { start: '10:00:00', end: '11:00:00', label: '10:00 - 11:00 AM' },
  { start: '11:15:00', end: '12:15:00', label: '11:15 - 12:15 PM' },
  { start: '12:15:00', end: '13:15:00', label: '12:15 - 01:15 PM' },
  { start: '14:00:00', end: '15:00:00', label: '02:00 - 03:00 PM' },
  { start: '15:00:00', end: '16:00:00', label: '03:00 - 04:00 PM' },
];

interface TimetableEntryItem {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section_id: string;
  classroom_id: string;
  faculty_id: string;
  subject_offering_id: string;
  section?: {
    id: string;
    name: string;
    semester?: {
      id: string;
      semester_number: number;
      program?: {
        id: string;
        name: string;
        code: string;
        department_id: string;
      };
    };
  };
  classroom?: { id: string; room_number: string; building: string };
  faculty?: {
    id: string;
    employee_code: string;
    profile?: { first_name: string; last_name: string };
  };
  subject_offering?: {
    id: string;
    subject?: { name: string; code: string };
  };
}

export const TimetableManager: React.FC = () => {
  const { profile, role, facultyRecord, currentInstitutionId } = useAuth();
  const { addToast } = useToast();
  const isFaculty = Boolean(facultyRecord?.id) || (role as string) === 'faculty' || (role as string) === 'hod' || (role as string) === 'teacher';
  const [filterToMySchedule, setFilterToMySchedule] = useState<boolean>(true);

  const [entries, setEntries] = useState<TimetableEntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Single Day View selection - default to today (Monday..Saturday, or Monday if Sunday)
  const getInitialDay = () => {
    const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (jsDay >= 1 && jsDay <= 6) return jsDay;
    return 1;
  };
  const [selectedDayId, setSelectedDayId] = useState<number>(getInitialDay);

  // Manual Attendance Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualModalPreload, setManualModalPreload] = useState<ManualAttendancePreload | null>(null);

  // Time format helper (12-hour AM/PM)
  const formatTime12 = (t: string) => {
    if (!t) return '';
    const parts = t.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(hour12).padStart(2, '0')}:${m} ${period}`;
  };

  // Live / Status helper
  const getSlotStatus = (entry: TimetableEntryItem, isDayToday: boolean) => {
    if (!isDayToday) {
      return { status: 'scheduled', label: 'Scheduled', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    const now = new Date();
    const curM = now.getHours() * 60 + now.getMinutes();
    const [sH, sM] = entry.start_time.split(':').map(Number);
    const [eH, eM] = entry.end_time.split(':').map(Number);
    const startM = sH * 60 + sM;
    const endM = eH * 60 + eM;

    if (curM >= startM && curM <= endM) {
      return { status: 'live', label: 'LIVE NOW', badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold animate-pulse' };
    }
    if (curM > endM) {
      return { status: 'completed', label: 'Completed', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold' };
    }
    return { status: 'upcoming', label: 'Upcoming', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' };
  };

  // Multi-tier filtering
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('ALL');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL');

  // Metadata for forms
  const [classrooms, setClassrooms] = useState<{ id: string; room_number: string; building: string }[]>([]);
  const [facultyList, setFacultyList] = useState<{ id: string; name: string }[]>([]);
  const [subjectOfferings, setSubjectOfferings] = useState<{ id: string; name: string; code: string }[]>([]);

  // Add / Edit Slot Modal
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formDay, setFormDay] = useState(1);
  const [formStartTime, setFormStartTime] = useState('09:00:00');
  const [formEndTime, setFormEndTime] = useState('10:00:00');
  const [formSectionId, setFormSectionId] = useState('');
  const [formClassroomId, setFormClassroomId] = useState('');
  const [formFacultyId, setFormFacultyId] = useState('');
  const [formSubjectOfferingId, setFormSubjectOfferingId] = useState('');
  const [formChangeReason, setFormChangeReason] = useState('');
  const [isSubmittingSlot, setIsSubmittingSlot] = useState(false);

  // Conflict Alert Dialog
  const [conflictError, setConflictError] = useState<{ type: string; message: string } | null>(null);

  // Timetable Change History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [changeHistoryList, setChangeHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Exception / Cancellation modal
  const [selectedEntryForException, setSelectedEntryForException] = useState<TimetableEntryItem | null>(null);
  const [exceptionDate, setExceptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [isCancelLecture, setIsCancelLecture] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [substituteFacultyId, setSubstituteFacultyId] = useState('');
  const [savingException, setSavingException] = useState(false);

  // Delete slot
  const [entryToDelete, setEntryToDelete] = useState<TimetableEntryItem | null>(null);

  // Fetch Metadata & Entries strictly scoped to current institution
  const loadTimetableData = async () => {
    const instId = profile?.institution_id || currentInstitutionId;
    try {
      setLoading(true);
      if (!instId) {
        setDepartments([]);
        setPrograms([]);
        setSemesters([]);
        setSections([]);
        setClassrooms([]);
        setFacultyList([]);
        setSubjectOfferings([]);
        setEntries([]);
        setLoading(false);
        return;
      }

      // 1. Fetch departments and faculty belonging strictly to this institution
      const [deptRes, facRes, campRes] = await Promise.all([
        supabase.from('departments').select('id, name, code').eq('institution_id', instId).order('name'),
        supabase.from('faculty').select('id, employee_code, profile:profiles(first_name, last_name)').eq('institution_id', instId).order('employee_code'),
        supabase.from('campuses').select('id').eq('institution_id', instId)
      ]);

      const deptList = deptRes.data || [];
      const deptIds = deptList.map((d: any) => d.id);
      const campIds = (campRes.data || []).map((c: any) => c.id);

      let progList: any[] = [];
      let semList: any[] = [];
      let secList: any[] = [];
      let subOfferList: any[] = [];
      let roomList: any[] = [];

      if (campIds.length > 0) {
        const { data: rooms } = await supabase.from('classrooms').select('id, room_number, building').in('campus_id', campIds).order('room_number');
        roomList = rooms || [];
      }

      if (deptIds.length > 0) {
        const [{ data: progs }, { data: subs }] = await Promise.all([
          supabase.from('programs').select('id, name, code, department_id').in('department_id', deptIds).order('name'),
          supabase.from('subjects').select('id, name, code').in('department_id', deptIds)
        ]);

        progList = progs || [];
        const progIds = progList.map((p: any) => p.id);
        const subIds = (subs || []).map((s: any) => s.id);

        if (progIds.length > 0) {
          const { data: sems } = await supabase.from('semesters').select('id, semester_number, program_id').in('program_id', progIds).order('semester_number');
          semList = sems || [];
          const semIds = semList.map((s: any) => s.id);

          if (semIds.length > 0) {
            const { data: secs } = await supabase
              .from('sections')
              .select(`
                id, name, semester_id,
                semester:semesters(
                  id, semester_number,
                  program:programs(id, name, code)
                )
              `)
              .in('semester_id', semIds)
              .order('name');
            secList = secs || [];
          }
        }

        if (subIds.length > 0) {
          const { data: offers } = await supabase.from('subject_offerings').select('id, subject:subjects(name, code)').in('subject_id', subIds);
          subOfferList = offers || [];
        }
      }

      setDepartments(deptList);
      setPrograms(progList);
      setSemesters(semList);
      setSections(secList);
      setClassrooms(roomList);

      const secIds = secList.map((s: any) => s.id);

      const formattedFac = (facRes.data || []).map((f: any) => ({
        id: f.id,
        name: f.profile ? `${f.profile.first_name} ${f.profile.last_name} (${f.employee_code})` : f.employee_code
      }));
      setFacultyList(formattedFac);

      const formattedOffers = subOfferList.map((o: any) => ({
        id: o.id,
        name: o.subject?.name || 'Subject',
        code: o.subject?.code || ''
      }));
      setSubjectOfferings(formattedOffers);

      if (formSectionId === '' && secList.length > 0) setFormSectionId(secList[0].id);
      if (formClassroomId === '' && roomList.length > 0) setFormClassroomId(roomList[0].id);
      if (formFacultyId === '' && formattedFac.length > 0) setFormFacultyId(formattedFac[0].id);
      if (formSubjectOfferingId === '' && formattedOffers.length > 0) setFormSubjectOfferingId(formattedOffers[0].id);

      // Query timetable entries - strictly scoped to this institution's sections
      if (secIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('timetable_entries')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          section_id,
          classroom_id,
          faculty_id,
          subject_offering_id,
          section:sections(
            id, name,
            semester:semesters(
              id, semester_number,
              program:programs(id, name, code, department_id)
            )
          ),
          classroom:classrooms(id, room_number, building),
          faculty:faculty(
            id, employee_code,
            profile:profiles(first_name, last_name)
          ),
          subject_offering:subject_offerings(
            id,
            subject:subjects(name, code)
          )
        `)
        .in('section_id', secIds);

      // Personal timetable scoping: If user is a faculty member, strictly scope to their assigned slots
      if (isFaculty && facultyRecord?.id && filterToMySchedule) {
        query = query.eq('faculty_id', facultyRecord.id);
      } else if (selectedSectionId !== 'ALL') {
        query = query.eq('section_id', selectedSectionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries((data as any) || []);
    } catch (err: any) {
      console.error('Failed to load timetable:', err);
      addToast({
        title: 'Timetable Load Error',
        message: err.message || 'Could not load timetable entries.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetableData();
  }, [selectedSectionId, profile?.institution_id, currentInstitutionId, filterToMySchedule, facultyRecord?.id]);

  // Load Timetable Change History
  const loadChangeHistory = async () => {
    try {
      setLoadingHistory(true);
      setShowHistoryModal(true);
      const { data, error } = await supabase
        .from('timetable_change_history')
        .select(`
          id, old_day_of_week, new_day_of_week, old_start_time, new_start_time,
          old_end_time, new_end_time, reason, effective_from, created_at,
          changed_by_profile:profiles!changed_by(first_name, last_name, email),
          old_faculty:faculty!old_faculty_id(employee_code, profile:profiles(first_name, last_name)),
          new_faculty:faculty!new_faculty_id(employee_code, profile:profiles(first_name, last_name)),
          old_classroom:classrooms!old_classroom_id(room_number, building),
          new_classroom:classrooms!new_classroom_id(room_number, building),
          timetable_entry:timetable_entries!timetable_entry_id(
            section:sections(name),
            subject_offering:subject_offerings(subject:subjects(name, code))
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setChangeHistoryList(data || []);
    } catch (err: any) {
      addToast({ title: 'Error', message: 'Could not load timetable change history.', type: 'error' });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Edit Modal for a Slot
  const handleOpenEditSlot = (entry: TimetableEntryItem) => {
    setEditingEntryId(entry.id);
    setFormDay(entry.day_of_week);
    setFormStartTime(entry.start_time);
    setFormEndTime(entry.end_time);
    setFormSectionId(entry.section_id);
    setFormClassroomId(entry.classroom_id);
    setFormFacultyId(entry.faculty_id);
    setFormSubjectOfferingId(entry.subject_offering_id);
    setFormChangeReason('');
    setIsSlotModalOpen(true);
  };

  // Open Add Slot
  const handleOpenAddSlot = () => {
    setEditingEntryId(null);
    setFormChangeReason('');
    setIsSlotModalOpen(true);
  };

  // Atomic Save with 3-Way Conflict Collision Detection
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSlot(true);
    setConflictError(null);

    try {
      const { data, error } = await supabase.rpc('rpc_admin_save_timetable_entry', {
        p_timetable_entry_id: editingEntryId,
        p_subject_offering_id: formSubjectOfferingId,
        p_faculty_id: formFacultyId,
        p_classroom_id: formClassroomId,
        p_section_id: formSectionId,
        p_day_of_week: formDay,
        p_start_time: formStartTime,
        p_end_time: formEndTime,
        p_changed_by: profile?.id || null,
        p_change_reason: formChangeReason.trim() || 'Curriculum Schedule Adjustment'
      });

      if (error) throw error;

      if (!data.success) {
        // Trigger rich conflict warning modal
        setConflictError({
          type: data.conflict_type || 'collision',
          message: data.error
        });
        return;
      }

      addToast({
        title: editingEntryId ? 'Timetable Updated' : 'Lecture Slot Created',
        message: data.message || 'Timetable saved with 0 conflicts detected.',
        type: 'success'
      });

      setIsSlotModalOpen(false);
      setEditingEntryId(null);
      loadTimetableData();
    } catch (err: any) {
      addToast({
        title: 'Collision Guard Triggered',
        message: err.message || 'Failed to save timetable slot.',
        type: 'error'
      });
    } finally {
      setIsSubmittingSlot(false);
    }
  };

  // Save Exception (Cancellation or Substitute Faculty)
  const handleSaveException = async () => {
    if (!selectedEntryForException) return;

    try {
      setSavingException(true);

      const { error } = await supabase.from('timetable_exceptions').insert({
        timetable_entry_id: selectedEntryForException.id,
        exception_date: exceptionDate,
        is_cancelled: isCancelLecture,
        cancellation_reason: isCancelLecture ? cancellationReason : null,
        substitute_faculty_id: !isCancelLecture && substituteFacultyId ? substituteFacultyId : null
      });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: isCancelLecture ? 'LECTURE_CANCELLED_EXCEPTION' : 'SUBSTITUTE_FACULTY_ASSIGNED',
        entity_type: 'timetable_exception',
        details: {
          entry_id: selectedEntryForException.id,
          date: exceptionDate,
          reason: cancellationReason
        }
      });

      addToast({
        title: isCancelLecture ? 'Lecture Cancelled for Date' : 'Substitute Assigned',
        message: `Exception recorded for ${exceptionDate}.`,
        type: 'info'
      });

      setSelectedEntryForException(null);
      setCancellationReason('');
      setIsCancelLecture(false);
      setSubstituteFacultyId('');
    } catch (err: any) {
      addToast({
        title: 'Failed to Save Exception',
        message: err.message || 'Could not record schedule exception.',
        type: 'error'
      });
    } finally {
      setSavingException(false);
    }
  };

  // Delete Timetable Entry and synchronize active lecture sessions
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      // 1. Explicitly clean up any active or scheduled attendance sessions linked to this slot
      // This prevents deleted slots from lingering as 'in_progress' on the Director & Teacher dashboards!
      await supabase
        .from('attendance_sessions')
        .delete()
        .eq('timetable_entry_id', entryToDelete.id);

      // Also clean up any active session matching the subject offering & section created today
      if (entryToDelete.subject_offering_id && entryToDelete.section_id) {
        await supabase
          .from('attendance_sessions')
          .delete()
          .eq('subject_offering_id', entryToDelete.subject_offering_id)
          .eq('section_id', entryToDelete.section_id)
          .eq('status', 'in_progress');
      }

      // 2. Delete the timetable entry
      const { error } = await supabase
        .from('timetable_entries')
        .delete()
        .eq('id', entryToDelete.id);

      if (error) throw error;

      // 3. Dispatch broadcast events so dashboards and displays refresh immediately without manual reload
      window.dispatchEvent(new CustomEvent('campusattend:timetable-updated', { detail: { deletedId: entryToDelete.id } }));
      window.dispatchEvent(new CustomEvent('campusattend:sessions-updated'));

      addToast({
        title: 'Class Schedule Slot Removed',
        message: 'Timetable entry and active lecture sessions synchronized.',
        type: 'info'
      });

      setEntryToDelete(null);
      loadTimetableData();
    } catch (err: any) {
      addToast({
        title: 'Delete Failed',
        message: err.message || 'Could not delete entry.',
        type: 'error'
      });
    }
  };

  // Export Timetable to Excel
  const handleExportTimetable = () => {
    if (entries.length === 0) {
      addToast({ title: 'Export Failed', message: 'No timetable entries to export.', type: 'warning' });
      return;
    }

    const data = entries.map((e) => {
      const dayName = DAYS.find((d) => d.id === e.day_of_week)?.name || `Day ${e.day_of_week}`;
      return {
        'Day': dayName,
        'Time': `${e.start_time.slice(0, 5)} - ${e.end_time.slice(0, 5)}`,
        'Section': formatSectionLabel(e.section),
        'Subject Code': e.subject_offering?.subject?.code || 'N/A',
        'Subject Name': e.subject_offering?.subject?.name || 'N/A',
        'Faculty': e.faculty?.profile ? `${e.faculty.profile.first_name} ${e.faculty.profile.last_name}` : 'N/A',
        'Room': e.classroom?.room_number || 'N/A',
        'Building': e.classroom?.building || 'N/A'
      };
    });

    exportToExcel(data, `CampusAttend_Timetable_${new Date().toISOString().slice(0, 10)}`);
    addToast({ title: 'Exported', message: 'Timetable spreadsheet downloaded.', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-xl">
            <Calendar className="h-6 w-6 text-indigo-600" />
            <span>{isFaculty && filterToMySchedule ? 'My Personal Teaching Timetable' : 'Class Timetable Schedule'}</span>
            {isFaculty && filterToMySchedule && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                Personal Schedule
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFaculty && filterToMySchedule
              ? `Weekly lecture commitments for Prof. ${facultyRecord?.profile ? `${facultyRecord.profile.first_name} ${facultyRecord.profile.last_name}` : 'Faculty'} (${facultyRecord?.employee_code || ''})`
              : 'Weekly lecture schedules, room allocations, and faculty assignments.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFaculty && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterToMySchedule(true)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterToMySchedule ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Lectures
              </button>
              <button
                type="button"
                onClick={() => setFilterToMySchedule(false)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  !filterToMySchedule ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Classes
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setManualModalPreload(null);
              setIsManualModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition cursor-pointer"
          >
            <BookOpen className="h-4 w-4" />
            <span>Manual Attendance (Guest / Library)</span>
          </button>

          <button
            onClick={loadChangeHistory}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <History className="h-4 w-4 text-slate-600" />
            <span>Schedule History</span>
          </button>

          <button
            onClick={handleExportTimetable}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>

          {(role === 'director' || role === 'hod' || role === 'super_admin' || role === 'it_admin') && (
            <button
              onClick={handleOpenAddSlot}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Lecture Slot</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
          <Filter className="h-4 w-4 text-slate-400" />
          <span>Filter Section:</span>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">All Classes &amp; Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSectionLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Conflict Detection Active</span>
        </div>
      </div>

      {/* Single-Day Selector Tabs Bar */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2 overflow-x-auto">
        {DAYS.map((day) => {
          const isToday = (new Date().getDay() === 0 ? 7 : new Date().getDay()) === day.id;
          const isSelected = selectedDayId === day.id;
          const count = entries.filter((e) => e.day_of_week === day.id).length;

          return (
            <button
              key={day.id}
              onClick={() => setSelectedDayId(day.id)}
              className={`flex-1 min-w-[130px] px-3.5 py-3 rounded-xl transition-all flex flex-col items-center justify-center text-center relative cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/20'
                  : 'bg-slate-50/70 hover:bg-slate-100 text-slate-700 border-slate-200/70 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs uppercase tracking-wider">{day.name}</span>
                {isToday && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                      isSelected
                        ? 'bg-emerald-400 text-emerald-950 font-bold'
                        : 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                    }`}
                  >
                    Today
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-medium mt-0.5 ${
                  isSelected ? 'text-indigo-100' : 'text-slate-400'
                }`}
              >
                {count} {count === 1 ? 'Lecture' : 'Lectures'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Single Day Time-Wise Schedule Display */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const activeDayObj = DAYS.find((d) => d.id === selectedDayId) || DAYS[0];
            const isSelectedDayToday = (new Date().getDay() === 0 ? 7 : new Date().getDay()) === selectedDayId;
            const dayEntries = entries
              .filter((e) => e.day_of_week === selectedDayId)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Day Section Header */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">
                          {activeDayObj.name}'s Lecture Schedule
                        </h3>
                        {isSelectedDayToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Today's Schedule
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dayEntries.length === 0
                          ? 'No lectures scheduled for this day'
                          : `Showing ${dayEntries.length} lectures arranged strictly in chronological order`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setManualModalPreload({
                          sessionDate: isSelectedDayToday ? new Date().toISOString().slice(0, 10) : undefined,
                        });
                        setIsManualModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Take Manual Attendance</span>
                    </button>

                    {(role === 'director' || role === 'hod' || role === 'super_admin' || role === 'it_admin') && (
                      <button
                        onClick={handleOpenAddSlot}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Slot</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Timeline List */}
                <div className="p-4 sm:p-6 space-y-3">
                  {dayEntries.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                      <Clock className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
                      <h4 className="font-bold text-sm text-slate-700">No Lectures Scheduled</h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                        There are no academic classes scheduled on {activeDayObj.name} for the selected section filters.
                      </p>
                      <button
                        onClick={() => {
                          setManualModalPreload({
                            sessionDate: isSelectedDayToday ? new Date().toISOString().slice(0, 10) : undefined,
                          });
                          setIsManualModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span>Record Manual / Special Attendance</span>
                      </button>
                    </div>
                  ) : (
                    dayEntries.map((entry) => {
                      const slotInfo = getSlotStatus(entry, isSelectedDayToday);
                      return (
                        <div
                          key={entry.id}
                          className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                        >
                          {/* Time column */}
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                              <Clock className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <div className="font-black text-sm text-slate-900 font-mono tracking-tight">
                                {formatTime12(entry.start_time)} - {formatTime12(entry.end_time)}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${slotInfo.badgeClass}`}>
                                  {slotInfo.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Subject & Class Details */}
                          <div className="flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-sm text-slate-900 leading-tight">
                                {entry.subject_offering?.subject?.name || 'Subject Offering'}
                              </h4>
                              {entry.subject_offering?.subject?.code && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {entry.subject_offering.subject.code}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {formatSectionShortBadge(entry.section)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <div className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700">
                                  {entry.faculty?.profile
                                    ? `Prof. ${entry.faculty.profile.first_name} ${entry.faculty.profile.last_name}`
                                    : entry.faculty?.employee_code || 'Assigned Faculty'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <DoorOpen className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="font-semibold text-slate-700">
                                  Room {entry.classroom?.room_number || 'TBD'}
                                  {entry.classroom?.building ? ` • ${entry.classroom.building}` : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center flex-wrap gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                            {/* Manual Attendance Trigger for this specific class */}
                            <button
                              onClick={() => {
                                setManualModalPreload({
                                  sectionId: entry.section_id,
                                  subjectOfferingId: entry.subject_offering_id,
                                  startTime: entry.start_time,
                                  endTime: entry.end_time,
                                  classroomId: entry.classroom_id,
                                  sessionDate: isSelectedDayToday ? new Date().toISOString().slice(0, 10) : undefined,
                                });
                                setIsManualModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                              title="Mark manual attendance for this class"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Manual / Ad-hoc</span>
                            </button>

                            {(role === 'director' || role === 'hod' || role === 'super_admin' || role === 'it_admin') && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditSlot(entry)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  title="Change Slot"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setSelectedEntryForException(entry)}
                                  className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                  title="Record Exception / Cancellation"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEntryToDelete(entry)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                  title="Delete Slot"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Add / Edit Timetable Slot Modal */}
      <Modal
        isOpen={isSlotModalOpen}
        onClose={() => {
          setIsSlotModalOpen(false);
          setEditingEntryId(null);
          setConflictError(null);
        }}
        title={editingEntryId ? 'Modify Timetable Slot' : 'Add New Class Lecture Slot'}
      >
        <form onSubmit={handleSaveSlot} className="space-y-4">
          {/* Conflict Error Callout */}
          {conflictError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-red-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Collision Guard Alert ({conflictError.type.toUpperCase()})</span>
              </div>
              <p className="text-red-700 leading-relaxed font-medium">{conflictError.message}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Day of Week *</label>
              <select
                value={formDay}
                onChange={(e) => setFormDay(Number(e.target.value))}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                {DAYS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">Target Section *</label>
              <select
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white font-medium text-slate-800"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSectionLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Start Time *</label>
              <input
                type="time"
                required
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">End Time *</label>
              <input
                type="time"
                required
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Subject Offering *</label>
            <select
              value={formSubjectOfferingId}
              onChange={(e) => setFormSubjectOfferingId(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
            >
              {subjectOfferings.map((so) => (
                <option key={so.id} value={so.id}>
                  {so.code} - {so.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Faculty Instructor *</label>
              <select
                value={formFacultyId}
                onChange={(e) => setFormFacultyId(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">Classroom / Lecture Hall *</label>
              <select
                value={formClassroomId}
                onChange={(e) => setFormClassroomId(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    Room {c.room_number} ({c.building})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editingEntryId && (
            <div>
              <label className="text-[11px] font-bold text-slate-600">Reason for Schedule Modification *</label>
              <textarea
                required
                rows={2}
                value={formChangeReason}
                onChange={(e) => setFormChangeReason(e.target.value)}
                placeholder="e.g. Relocated to Room 210 to accommodate higher seat capacity; time moved to 11:00 AM."
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Audited into timetable history. Past attendance relations are never corrupted.
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSlotModalOpen(false);
                setEditingEntryId(null);
                setConflictError(null);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingSlot}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
            >
              {isSubmittingSlot ? 'Verifying Collisions...' : editingEntryId ? 'Commit Change' : 'Save Lecture Slot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Timetable Change Audit Trail Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Timetable Change Audit Trail"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Immutable log of all room relocations, lecture time shifts, and faculty reassignments. Historical attendance records remain linked to their original session snapshots.
          </p>

          {loadingHistory ? (
            <div className="text-xs text-slate-400 py-6 text-center">Loading audit log...</div>
          ) : changeHistoryList.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center italic">No timetable modifications recorded yet.</div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {changeHistoryList.map((ch) => (
                <div key={ch.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {ch.timetable_entry?.section?.name} • {ch.timetable_entry?.subject_offering?.subject?.code}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(ch.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <span>
                      Room {ch.old_classroom?.room_number || 'TBD'} ({ch.old_start_time?.slice(0, 5)} - {ch.old_end_time?.slice(0, 5)})
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span className="text-indigo-700 font-bold">
                      Room {ch.new_classroom?.room_number || 'TBD'} ({ch.new_start_time?.slice(0, 5)} - {ch.new_end_time?.slice(0, 5)})
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 italic">
                    Reason: "{ch.reason || 'Curriculum Schedule Adjustment'}"
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium">
                    Changed by: {ch.changed_by_profile ? `${ch.changed_by_profile.first_name} ${ch.changed_by_profile.last_name}` : 'Academic Administrator'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Exception Modal (Cancellation / Substitute) */}
      <Modal
        isOpen={!!selectedEntryForException}
        onClose={() => setSelectedEntryForException(null)}
        title="Schedule Exception / Cancellation"
      >
        <div className="space-y-4">
          <div className="text-xs text-slate-600">
            Lecture:{' '}
            <span className="font-bold text-slate-900">
              {selectedEntryForException?.subject_offering?.subject?.name}
            </span>{' '}
            for <span className="font-bold">{selectedEntryForException?.section?.name}</span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Exception Date *</label>
            <input
              type="date"
              value={exceptionDate}
              onChange={(e) => setExceptionDate(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isCancel"
              checked={isCancelLecture}
              onChange={(e) => setIsCancelLecture(e.target.checked)}
              className="rounded text-red-600"
            />
            <label htmlFor="isCancel" className="text-xs font-bold text-red-600">
              Cancel lecture for this specific calendar date
            </label>
          </div>

          {isCancelLecture ? (
            <div>
              <label className="text-[11px] font-bold text-slate-600">Cancellation Notice / Reason *</label>
              <textarea
                rows={2}
                required
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g. Institutional holiday, academic conference, or medical leave."
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-bold text-slate-600">Assign Substitute Faculty</label>
              <select
                value={substituteFacultyId}
                onChange={(e) => setSubstituteFacultyId(e.target.value)}
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="">Select Substitute Instructor...</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setSelectedEntryForException(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveException}
              disabled={savingException}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              {savingException ? 'Saving...' : 'Record Exception'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Slot Confirm */}
      <ConfirmDialog
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Timetable Slot"
        message="Are you sure you want to permanently delete this timetable slot? (Historical attendance sessions remain unaffected)."
        confirmLabel="Delete Slot"
        variant="danger"
      />
      {/* Manual / Ad-hoc Attendance Modal */}
      <ManualAttendanceModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setManualModalPreload(null);
        }}
        initialData={manualModalPreload}
        onSuccess={() => {
          setIsManualModalOpen(false);
          setManualModalPreload(null);
          loadTimetableData();
        }}
      />
    </div>
  );
};
