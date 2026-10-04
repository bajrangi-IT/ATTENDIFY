import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from './ui/Modal';
import { formatSectionLabel } from '../lib/academicLabels';
import {
  BookOpen,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  Sparkles,
  GraduationCap,
  Search,
  Building2,
  AlertCircle,
  Coffee,
  FileText,
  Check,
  X,
  Radio,
  CheckCheck
} from 'lucide-react';

export interface ManualAttendancePreload {
  institutionId?: string;
  sectionId?: string;
  subjectOfferingId?: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  classroomId?: string;
  defaultTopic?: string;
  sessionType?: 'lecture' | 'guest_lecture' | 'library' | 'seminar' | 'extra_class' | 'lab';
}

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: ManualAttendancePreload | null;
}

interface StudentRosterItem {
  id: string; // student_id
  roll_number: string;
  name: string;
  branch: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const { facultyRecord, profile, institution, currentInstitutionId } = useAuth();
  const toast = useToast();

  const [availableInstitutions, setAvailableInstitutions] = useState<any[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>(
    initialData?.institutionId || profile?.institution_id || currentInstitutionId || institution?.id || '00000000-0000-0000-0000-000000000001'
  );

  // Metadata dropdown state
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [classroomsList, setClassroomsList] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Form Fields
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialData?.sectionId || '');
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(initialData?.subjectOfferingId || '');
  const [sessionType, setSessionType] = useState<'lecture' | 'guest_lecture' | 'library' | 'seminar' | 'extra_class' | 'lab'>(
    initialData?.sessionType || 'guest_lecture'
  );
  const [sessionDate, setSessionDate] = useState<string>(
    initialData?.sessionDate || new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState<string>(
    initialData?.startTime?.substring(0, 5) || '10:00'
  );
  const [endTime, setEndTime] = useState<string>(
    initialData?.endTime?.substring(0, 5) || '11:00'
  );
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(initialData?.classroomId || '');
  const [customVenue, setCustomVenue] = useState<string>('Auditorium / Library Hall');
  const [sessionTopic, setSessionTopic] = useState<string>(initialData?.defaultTopic || '');

  // Student Roster
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch all schools/institutions so faculty can switch target school if teaching across institutions
  useEffect(() => {
    async function loadInstitutions() {
      try {
        const { data } = await supabase
          .from('institutions')
          .select('id, name, code')
          .order('name');
        if (data && data.length > 0) {
          setAvailableInstitutions(data);
        }
      } catch (err) {
        console.warn('Could not load institutions list:', err);
      }
    }
    loadInstitutions();
  }, []);

  // Update selected institution when initialData changes
  useEffect(() => {
    if (initialData?.institutionId) {
      setSelectedInstitutionId(initialData.institutionId);
    }
  }, [initialData]);

  // 1. Fetch available sections, subjects, classrooms for the selected institution
  useEffect(() => {
    if (!isOpen || !selectedInstitutionId) return;

    async function loadAcademicMeta() {
      setLoadingMeta(true);
      setRoster([]);
      setSubjectsList([]);
      try {
        // Fetch departments first
        const { data: depts } = await supabase
          .from('departments')
          .select('id')
          .eq('institution_id', selectedInstitutionId);

        const deptIds = (depts || []).map((d: any) => d.id);
        if (deptIds.length > 0) {
          const { data: progs } = await supabase
            .from('programs')
            .select('id')
            .in('department_id', deptIds);
          const progIds = (progs || []).map((p: any) => p.id);

          if (progIds.length > 0) {
            const { data: sems } = await supabase
              .from('semesters')
              .select('id')
              .in('program_id', progIds);
            const semIds = (sems || []).map((s: any) => s.id);

            if (semIds.length > 0) {
              const { data: secs } = await supabase
                .from('sections')
                .select(`
                  id, name, semester_id,
                  semester:semesters(
                    id, semester_number,
                    program:programs(id, name, code, department_id)
                  )
                `)
                .in('semester_id', semIds)
                .order('name');

              const secRows = secs || [];
              setSectionsList(secRows);
              if (secRows.length > 0) {
                // If current selected section is not in the new list, select first
                if (!selectedSectionId || !secRows.some(s => s.id === selectedSectionId)) {
                  setSelectedSectionId(secRows[0].id);
                }
              } else {
                setSectionsList([]);
                setSelectedSectionId('');
                setRoster([]);
              }
            } else {
              setSectionsList([]);
              setSelectedSectionId('');
              setRoster([]);
            }
          } else {
            setSectionsList([]);
            setSelectedSectionId('');
            setRoster([]);
          }
        } else {
          setSectionsList([]);
          setSelectedSectionId('');
          setRoster([]);
        }

        // Fetch campuses for classrooms
        const { data: campusList } = await supabase
          .from('campuses')
          .select('id')
          .eq('institution_id', selectedInstitutionId);

        const campusIds = (campusList || []).map((c: any) => c.id);
        let roomRows: any[] = [];

        if (campusIds.length > 0) {
          const { data: rooms } = await supabase
            .from('classrooms')
            .select('id, room_number, building')
            .in('campus_id', campusIds)
            .order('room_number');
          roomRows = rooms || [];
        }

        if (roomRows.length === 0) {
          // Fallback to any classrooms
          const { data: fallbackRooms } = await supabase
            .from('classrooms')
            .select('id, room_number, building')
            .limit(10);
          roomRows = fallbackRooms || [];
        }

        setClassroomsList(roomRows);
        if (!selectedClassroomId && roomRows.length > 0) {
          setSelectedClassroomId(roomRows[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load manual attendance meta:', err);
      } finally {
        setLoadingMeta(false);
      }
    }

    loadAcademicMeta();
  }, [isOpen, selectedInstitutionId]);

  // 2. Fetch subject offerings for the selected section
  useEffect(() => {
    if (!selectedSectionId) {
      setSubjectsList([]);
      return;
    }

    async function loadSectionSubjects() {
      try {
        const sec = sectionsList.find((s) => s.id === selectedSectionId);
        const semId = sec?.semester_id || sec?.semester?.id;

        if (semId) {
          const { data: offers } = await supabase
            .from('subject_offerings')
            .select(`
              id,
              subject:subjects(id, name, code)
            `)
            .eq('semester_id', semId);

          const offerRows = offers || [];
          setSubjectsList(offerRows);
          if (offerRows.length > 0 && !selectedOfferingId) {
            setSelectedOfferingId(offerRows[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load section subjects:', err);
      }
    }

    loadSectionSubjects();
  }, [selectedSectionId, sectionsList]);

  // 3. Fetch students of the selected section and populate default 'present' roster
  useEffect(() => {
    if (!selectedSectionId || !selectedInstitutionId) {
      setRoster([]);
      return;
    }

    async function loadSectionStudents() {
      setLoadingStudents(true);
      try {
        const { data: students, error } = await supabase
          .from('students')
          .select(`
            id, roll_number, branch, institution_id,
            profile:profiles(first_name, last_name, email)
          `)
          .eq('current_section_id', selectedSectionId)
          .eq('institution_id', selectedInstitutionId)
          .order('roll_number');

        if (error) throw error;

        const rosterItems: StudentRosterItem[] = (students || []).map((st: any) => ({
          id: st.id,
          roll_number: st.roll_number,
          name: `${st.profile?.first_name || ''} ${st.profile?.last_name || ''}`.trim() || 'Student',
          branch: st.branch || 'CSE',
          status: 'present', // Default to present for quick one-click adjustments
          remarks: '',
        }));

        setRoster(rosterItems);
      } catch (err: any) {
        console.error('Failed to load students for manual session:', err);
        toast.error('Could not load students', err.message);
      } finally {
        setLoadingStudents(false);
      }
    }

    loadSectionStudents();
  }, [selectedSectionId, selectedInstitutionId]);

  // Batch actions
  const handleMarkAll = (status: 'present' | 'absent') => {
    setRoster((prev) => prev.map((s) => ({ ...s, status })));
  };

  const handleToggleStudentStatus = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setRoster((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  const handleUpdateStudentRemarks = (studentId: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, remarks } : s))
    );
  };

  // Filtered Roster for UI Search
  const filteredRoster = useMemo(() => {
    if (!searchTerm.trim()) return roster;
    const term = searchTerm.toLowerCase();
    return roster.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.roll_number.toLowerCase().includes(term) ||
        s.branch.toLowerCase().includes(term)
    );
  }, [roster, searchTerm]);

  // Summary counts
  const presentCount = roster.filter((s) => s.status === 'present').length;
  const absentCount = roster.filter((s) => s.status === 'absent').length;
  const lateCount = roster.filter((s) => s.status === 'late').length;
  const excusedCount = roster.filter((s) => s.status === 'excused').length;

  // 4. Save and Finalize Manual Attendance
  const handleFinalizeAttendance = async () => {
    if (!selectedSectionId) {
      toast.warning('Selection Required', 'Please select a target class/section.');
      return;
    }
    if (!selectedOfferingId) {
      toast.warning('Subject Required', 'Please select the respective subject for this attendance.');
      return;
    }
    if (roster.length === 0) {
      toast.warning('Empty Class', 'No enrolled students found in this section.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Resolve classroom ID or fallback
      let finalClassroomId = selectedClassroomId;
      if (!finalClassroomId && classroomsList.length > 0) {
        finalClassroomId = classroomsList[0].id;
      }
      if (!finalClassroomId) {
        const { data: anyRoom } = await supabase.from('classrooms').select('id').limit(1).maybeSingle();
        finalClassroomId = anyRoom?.id;
      }

      // 1.1 Resolve faculty ID (if user is Director or HOD without direct facultyRecord)
      let assignedFacultyId = facultyRecord?.id || null;
      if (!assignedFacultyId) {
        const { data: fa } = await supabase
          .from('faculty_assignments')
          .select('faculty_id')
          .eq('subject_offering_id', selectedOfferingId)
          .limit(1)
          .maybeSingle();
        if (fa?.faculty_id) {
          assignedFacultyId = fa.faculty_id;
        } else {
          const { data: anyFac } = await supabase.from('faculty').select('id').limit(1).maybeSingle();
          if (anyFac?.id) assignedFacultyId = anyFac.id;
        }
      }

      // Format custom reason/topic
      const typeLabel =
        sessionType === 'guest_lecture'
          ? 'Guest Lecture'
          : sessionType === 'library'
          ? 'Library Period'
          : sessionType === 'seminar'
          ? 'Seminar / Workshop'
          : sessionType === 'extra_class'
          ? 'Extra Lecture'
          : sessionType === 'lab'
          ? 'Special Practical'
          : 'Manual Lecture';

      const reasonNote = sessionTopic.trim()
        ? `[${typeLabel.toUpperCase()}] ${sessionTopic.trim()} (Venue: ${customVenue})`
        : `[${typeLabel.toUpperCase()}] Manual Class Register (Venue: ${customVenue})`;

      // 2. Insert attendance_sessions row with status 'completed' and is_attendance_locked true
      const { data: newSession, error: sessErr } = await supabase
        .from('attendance_sessions')
        .insert({
          faculty_id: assignedFacultyId,
          institution_id: selectedInstitutionId,
          subject_offering_id: selectedOfferingId,
          section_id: selectedSectionId,
          classroom_id: finalClassroomId,
          session_date: sessionDate,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          session_type: sessionType,
          status: 'completed',
          is_attendance_locked: true,
          cancellation_reason: reasonNote,
        })
        .select('id')
        .single();

      if (sessErr) throw sessErr;

      const sessionId = newSession.id;

      // 3. Batch insert attendance_records for each student with verification_method 'manual_faculty' and is_finalized true
      const recordRows = roster.map((s) => ({
        session_id: sessionId,
        student_id: s.id,
        status: s.status,
        verification_method: 'manual_faculty',
        is_finalized: true,
        marked_at: new Date().toISOString(),
        remarks: s.remarks?.trim() || reasonNote,
      }));

      const { error: recErr } = await supabase
        .from('attendance_records')
        .insert(recordRows);

      if (recErr) throw recErr;

      // 3.1 Create and transmit session report directly to the target School's Directorate
      const attended = presentCount + lateCount + excusedCount;
      const pct = roster.length > 0 ? Math.round((attended / roster.length) * 100) : 0;
      await supabase
        .from('attendance_session_reports')
        .upsert({
          session_id: sessionId,
          faculty_id: assignedFacultyId,
          institution_id: selectedInstitutionId,
          total_enrolled: roster.length,
          present_count: presentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          absent_count: absentCount,
          attendance_percentage: pct,
          submission_notes: `Manual Attendance Register: ${reasonNote}`,
          status: 'submitted',
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' });

      // 4. Create an audit log entry for total compliance transparency
      await supabase.from('attendance_audit_log').insert({
        record_id: null,
        changed_by_profile_id: profile?.id,
        old_status: null,
        new_status: 'present',
        override_reason: `Manual Session Created: ${reasonNote} (${presentCount} Present, ${absentCount} Absent)`,
      }).select().maybeSingle();

      // 5. Broadcast synchronization events across browser windows and dashboards
      window.dispatchEvent(new CustomEvent('campusattend:sessions-updated'));
      window.dispatchEvent(new CustomEvent('campusattend:timetable-updated'));

      toast.success(
        'Manual Attendance Recorded!',
        `Successfully logged attendance for ${roster.length} students (${presentCount} Present, ${absentCount} Absent).`
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error submitting manual attendance:', err);
      toast.error('Failed to submit manual attendance', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Attendance"
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Target School / Institution */}
        {availableInstitutions.length > 0 && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800">Target School / College</span>
            </div>
            <select
              value={selectedInstitutionId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedInstitutionId(newId);
                setSelectedSectionId('');
                setSelectedOfferingId('');
                setSectionsList([]);
                setSubjectsList([]);
                setRoster([]);
              }}
              className="p-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 min-w-[240px]"
            >
              {availableInstitutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} {inst.code ? `(${inst.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Section 1: Session Nature & Target Class Setup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {/* Lecture Type */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Lecture Category / Type *
            </label>
            <select
              value={sessionType}
              onChange={(e: any) => setSessionType(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="guest_lecture">🎓 Guest Lecture / Visiting Speaker</option>
              <option value="library">📚 Library / Reading Session</option>
              <option value="seminar">🗣️ Seminar / Workshop / Conference</option>
              <option value="extra_class">⚡ Extra / Remedial Class</option>
              <option value="lab">🔬 Special Practical / Lab Session</option>
              <option value="lecture">📝 Standard Lecture (Manual Register)</option>
            </select>
          </div>

          {/* Target Section (with Year and Semester) */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Target Class / Section *
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
            >
              {sectionsList.length === 0 ? (
                <option value="">No Classes Found</option>
              ) : (
                sectionsList.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {formatSectionLabel(sec)}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Subject / Course Slot */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Subject Credit Course *
            </label>
            <select
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              {subjectsList.length === 0 ? (
                <option value="">No Subjects for this Class</option>
              ) : (
                subjectsList.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.subject?.code}: {off.subject?.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Session Date *
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
            />
          </div>

          {/* Time Slot (Start - End) */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Lecture Time Slot *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-mono font-bold"
              />
              <span className="text-slate-400 font-bold text-xs">to</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-mono font-bold"
              />
            </div>
          </div>

          {/* Venue / Location */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Venue / Hall / Room *
            </label>
            <input
              type="text"
              placeholder="e.g. Main Auditorium, Central Library, Room 204"
              value={customVenue}
              onChange={(e) => setCustomVenue(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
            />
          </div>

          {/* Special Topic or Guest Speaker Info */}
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Topic / Guest Speaker / Abnormality Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Special Lecture on Cyber Security by Guest Speaker Dr. Rajesh Verma"
              value={sessionTopic}
              onChange={(e) => setSessionTopic(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-medium text-slate-900"
            />
          </div>
        </div>

        {/* Section 2: Student Roster & Live Marking Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900">
                Student Attendance Roster ({roster.length} Enrolled)
              </h3>
            </div>

            {/* Quick Batch Actions & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search roll or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>Mark All Absent</span>
              </button>
            </div>
          </div>

          {/* Realtime Attendance Metric Pills */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-emerald-50/80 border border-emerald-200 py-1.5 px-2 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-700">Present</span>
              <div className="font-mono font-black text-emerald-800 text-base">{presentCount}</div>
            </div>
            <div className="bg-rose-50/80 border border-rose-200 py-1.5 px-2 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-700">Absent</span>
              <div className="font-mono font-black text-rose-800 text-base">{absentCount}</div>
            </div>
            <div className="bg-amber-50/80 border border-amber-200 py-1.5 px-2 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-amber-700">Late</span>
              <div className="font-mono font-black text-amber-800 text-base">{lateCount}</div>
            </div>
            <div className="bg-blue-50/80 border border-blue-200 py-1.5 px-2 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-700">Excused</span>
              <div className="font-mono font-black text-blue-800 text-base">{excusedCount}</div>
            </div>
          </div>

          {/* Roster Table */}
          {loadingStudents ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading student roster for this class...</p>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <AlertCircle className="w-6 h-6 mx-auto mb-1 text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No students found matching your criteria</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
              {filteredRoster.map((st) => (
                <div
                  key={st.id}
                  className="p-3 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-slate-900 w-24 shrink-0">
                      {st.roll_number}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{st.name}</div>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                        {st.branch}
                      </span>
                    </div>
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleStudentStatus(st.id, 'present')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                        st.status === 'present'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      P
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStudentStatus(st.id, 'absent')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                        st.status === 'absent'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStudentStatus(st.id, 'late')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                        st.status === 'late'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      L
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStudentStatus(st.id, 'excused')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                        st.status === 'excused'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      E
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Attendance will be finalized and synced dynamically with canonical reports.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting || roster.length === 0}
              onClick={handleFinalizeAttendance}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Syncing Records...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit &amp; Finalize Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
