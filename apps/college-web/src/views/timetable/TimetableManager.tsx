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
  ArrowRight
} from 'lucide-react';

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
  const { profile, role } = useAuth();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<TimetableEntryItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch Metadata & Entries
  const loadTimetableData = async () => {
    try {
      setLoading(true);

      const [deptRes, progRes, semRes, secRes, roomRes, facRes, offerRes] = await Promise.all([
        supabase.from('departments').select('id, name, code').order('name'),
        supabase.from('programs').select('id, name, code, department_id').order('name'),
        supabase.from('semesters').select('id, semester_number, program_id').order('semester_number'),
        supabase.from('sections').select('id, name, semester_id').order('name'),
        supabase.from('classrooms').select('id, room_number, building').order('room_number'),
        supabase.from('faculty').select('id, employee_code, profile:profiles(first_name, last_name)').order('employee_code'),
        supabase.from('subject_offerings').select('id, subject:subjects(name, code)')
      ]);

      setDepartments(deptRes.data || []);
      setPrograms(progRes.data || []);
      setSemesters(semRes.data || []);

      if (secRes.data && secRes.data.length > 0) {
        setSections(secRes.data);
        if (formSectionId === '') setFormSectionId(secRes.data[0].id);
      }

      if (roomRes.data && roomRes.data.length > 0) {
        setClassrooms(roomRes.data);
        if (formClassroomId === '') setFormClassroomId(roomRes.data[0].id);
      }

      if (facRes.data && facRes.data.length > 0) {
        const formattedFac = facRes.data.map((f: any) => ({
          id: f.id,
          name: f.profile ? `${f.profile.first_name} ${f.profile.last_name} (${f.employee_code})` : f.employee_code
        }));
        setFacultyList(formattedFac);
        if (formFacultyId === '') setFormFacultyId(formattedFac[0].id);
      }

      if (offerRes.data && offerRes.data.length > 0) {
        const formattedOffers = offerRes.data.map((o: any) => ({
          id: o.id,
          name: o.subject?.name || 'Subject',
          code: o.subject?.code || ''
        }));
        setSubjectOfferings(formattedOffers);
        if (formSubjectOfferingId === '') setFormSubjectOfferingId(formattedOffers[0].id);
      }

      // Query timetable entries
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
        `);

      if (selectedSectionId !== 'ALL') {
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
  }, [selectedSectionId]);

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

  // Delete Timetable Entry
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      const { error } = await supabase
        .from('timetable_entries')
        .delete()
        .eq('id', entryToDelete.id);

      if (error) throw error;

      addToast({
        title: 'Slot Removed',
        message: 'Timetable entry deleted. Past attendance sessions remain preserved.',
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
        'Section': e.section?.name || 'N/A',
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
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xl">
            <Calendar className="h-6 w-6 text-indigo-600" />
            <span>Master Campus Timetable & Collision Guard</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Atomic Teacher, Room, and Section conflict detection. Updates student/faculty views without destroying historical attendance relations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadChangeHistory}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <History className="h-4 w-4 text-slate-600" />
            <span>Change Audit Trail</span>
          </button>

          <button
            onClick={handleExportTimetable}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Schedule</span>
          </button>

          {(role === 'director' || role === 'hod' || role === 'super_admin' || role === 'it_admin') && (
            <button
              onClick={handleOpenAddSlot}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-600/20 transition"
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
          <span>Active Cohort View:</span>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">Entire Campus (All Sections)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>3-Way Conflict Engine Active (Teacher, Room, Section)</span>
        </div>
      </div>

      {/* Grid Timetable Display */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {DAYS.map((day) => {
            const dayEntries = entries
              .filter((e) => e.day_of_week === day.id)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <div
                key={day.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden"
              >
                {/* Day Header */}
                <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">{day.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">
                    {dayEntries.length} Classes
                  </Badge>
                </div>

                {/* Day Slots List */}
                <div className="p-2 space-y-2 flex-1 min-h-[360px] bg-slate-50/30">
                  {dayEntries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <Clock className="h-6 w-6 stroke-[1.5] mb-1.5 text-slate-300" />
                      <span className="text-[11px] font-medium">No Lectures Scheduled</span>
                    </div>
                  ) : (
                    dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group relative"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-indigo-700 font-mono">
                            {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {entry.section?.name || 'Section'}
                          </span>
                        </div>

                        <div className="font-bold text-xs text-slate-900 leading-tight mb-1">
                          {entry.subject_offering?.subject?.name || 'Subject Offering'}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center space-x-1 mb-1">
                          <UserCheck className="h-3 w-3 text-slate-400" />
                          <span className="truncate">
                            {entry.faculty?.profile
                              ? `${entry.faculty.profile.first_name} ${entry.faculty.profile.last_name}`
                              : entry.faculty?.employee_code || 'Faculty'}
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-slate-600 flex items-center space-x-1">
                          <DoorOpen className="h-3 w-3 text-indigo-500" />
                          <span>Room {entry.classroom?.room_number || 'TBD'}</span>
                        </div>

                        {/* Action buttons on card hover */}
                        {(role === 'director' || role === 'hod' || role === 'super_admin' || role === 'it_admin') && (
                          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <button
                              onClick={() => handleOpenEditSlot(entry)}
                              className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" /> Change
                            </button>
                            <button
                              onClick={() => setSelectedEntryForException(entry)}
                              className="text-amber-600 font-semibold hover:underline flex items-center gap-0.5"
                            >
                              <AlertTriangle className="h-3 w-3" /> Exception
                            </button>
                            <button
                              onClick={() => setEntryToDelete(entry)}
                              className="text-red-500 hover:text-red-700 p-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
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
                className="w-full mt-1 p-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
    </div>
  );
};
