import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';
import {
  Search,
  Users,
  GraduationCap,
  Building2,
  Clock,
  Calendar,
  MapPin,
  BookOpen,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Coffee,
  Sparkles,
  Radio,
  BadgeAlert,
  CalendarDays
} from 'lucide-react';
import { formatSectionLabel, formatSectionShortBadge } from '../lib/academicLabels';

export type SearchResultType = 'student' | 'faculty' | 'section';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  metadata: {
    avatarText?: string;
    branch?: string;
    rollNumber?: string;
    employeeCode?: string;
    designation?: string;
    departmentName?: string;
    programName?: string;
    semesterNumber?: number;
    sectionName?: string;
    sectionId?: string;
    facultyId?: string;
    coordinatorName?: string;
  };
}

interface TimetableSlotInfo {
  id: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  subject_code: string;
  subject_name: string;
  classroom_name: string;
  faculty_name: string;
  section_name: string;
  is_live: boolean;
  is_past: boolean;
  is_upcoming: boolean;
}

export const GlobalSearch: React.FC = () => {
  const { profile, institution, currentInstitutionId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);

  // Inspector modal states
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [todaySlots, setTodaySlots] = useState<TimetableSlotInfo[]>([]);
  const [nextSlot, setNextSlot] = useState<TimetableSlotInfo | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveInstitutionId = profile?.institution_id || currentInstitutionId || institution?.id;

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search across students, faculty, and classes in this school
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || term.length < 2 || !effectiveInstitutionId) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const combinedResults: SearchResultItem[] = [];

        // 1. Search Students
        const { data: studentsData } = await supabase
          .from('students')
          .select(`
            id, roll_number, branch, current_section_id,
            profile:profiles(first_name, last_name, email),
            current_section:sections(
              id, name,
              semester:semesters(
                semester_number,
                program:programs(name, code, department:departments(name, code))
              )
            )
          `)
          .eq('institution_id', effectiveInstitutionId)
          .limit(10);

        // Client-filter students by term matching name, roll number, or branch
        const termLower = term.toLowerCase();
        (studentsData || []).forEach((st: any) => {
          const fullName = `${st.profile?.first_name || ''} ${st.profile?.last_name || ''}`.trim();
          const roll = st.roll_number || '';
          const branch = st.branch || '';
          const secName = st.current_section?.name || '';
          const progName = st.current_section?.semester?.program?.name || '';

          if (
            fullName.toLowerCase().includes(termLower) ||
            roll.toLowerCase().includes(termLower) ||
            branch.toLowerCase().includes(termLower) ||
            secName.toLowerCase().includes(termLower) ||
            progName.toLowerCase().includes(termLower)
          ) {
            const secLabel = formatSectionLabel(st.current_section);
            combinedResults.push({
              id: st.id,
              type: 'student',
              title: fullName || roll || 'Student',
              subtitle: `Student • Roll: ${roll} • Branch: ${branch || 'General'} • ${secLabel}`,
              metadata: {
                avatarText: (st.profile?.first_name?.[0] || 'S').toUpperCase(),
                branch,
                rollNumber: roll,
                sectionName: secName,
                sectionId: st.current_section_id,
                programName: progName,
                semesterNumber: st.current_section?.semester?.semester_number,
              },
            });
          }
        });

        // 2. Search Faculty
        const { data: facultyData } = await supabase
          .from('faculty')
          .select(`
            id, employee_code, designation, department_id,
            profile:profiles(first_name, last_name, email),
            department:departments(id, name, code)
          `)
          .eq('institution_id', effectiveInstitutionId)
          .limit(10);

        (facultyData || []).forEach((fac: any) => {
          const fullName = `${fac.profile?.first_name || ''} ${fac.profile?.last_name || ''}`.trim();
          const empCode = fac.employee_code || '';
          const deptName = fac.department?.name || '';
          const deptCode = fac.department?.code || '';
          const desig = fac.designation || 'Faculty Member';

          if (
            fullName.toLowerCase().includes(termLower) ||
            empCode.toLowerCase().includes(termLower) ||
            deptName.toLowerCase().includes(termLower) ||
            deptCode.toLowerCase().includes(termLower) ||
            desig.toLowerCase().includes(termLower)
          ) {
            combinedResults.push({
              id: fac.id,
              type: 'faculty',
              title: `Prof. ${fullName || empCode}`,
              subtitle: `Faculty • ${desig} • Dept: ${deptName || deptCode || 'Department'} • Emp ID: ${empCode}`,
              metadata: {
                avatarText: (fac.profile?.first_name?.[0] || 'F').toUpperCase(),
                employeeCode: empCode,
                designation: desig,
                departmentName: deptName,
                facultyId: fac.id,
              },
            });
          }
        });

        // 3. Search Classes / Sections
        // First get departments of institution to scope sections correctly
        const { data: deptRows } = await supabase
          .from('departments')
          .select('id')
          .eq('institution_id', effectiveInstitutionId);
        
        const deptIds = (deptRows || []).map((d: any) => d.id);
        if (deptIds.length > 0) {
          const { data: progRows } = await supabase
            .from('programs')
            .select('id')
            .in('department_id', deptIds);
          const progIds = (progRows || []).map((p: any) => p.id);

          if (progIds.length > 0) {
            const { data: semRows } = await supabase
              .from('semesters')
              .select('id')
              .in('program_id', progIds);
            const semIds = (semRows || []).map((s: any) => s.id);

            if (semIds.length > 0) {
              const { data: secData } = await supabase
                .from('sections')
                .select(`
                  id, name, capacity, semester_id,
                  semester:semesters(
                    semester_number,
                    program:programs(name, code, department:departments(name, code))
                  ),
                  coordinator:faculty(
                    id, employee_code,
                    profile:profiles(first_name, last_name)
                  )
                `)
                .in('semester_id', semIds)
                .limit(10);

              (secData || []).forEach((sec: any) => {
                const secName = sec.name || '';
                const progName = sec.semester?.program?.name || '';
                const progCode = sec.semester?.program?.code || '';
                const semNum = sec.semester?.semester_number || 1;
                const coordName = sec.coordinator?.profile
                  ? `${sec.coordinator.profile.first_name} ${sec.coordinator.profile.last_name}`
                  : '';

                if (
                  secName.toLowerCase().includes(termLower) ||
                  progName.toLowerCase().includes(termLower) ||
                  progCode.toLowerCase().includes(termLower) ||
                  `section ${secName}`.toLowerCase().includes(termLower) ||
                  `class ${secName}`.toLowerCase().includes(termLower) ||
                  coordName.toLowerCase().includes(termLower)
                ) {
                  const fullLabel = formatSectionLabel(sec);
                  combinedResults.push({
                    id: sec.id,
                    type: 'section',
                    title: fullLabel,
                    subtitle: `Class / Section • ${fullLabel}${coordName ? ` • Coordinator: ${coordName}` : ''}`,
                    metadata: {
                      sectionName: secName,
                      sectionId: sec.id,
                      programName: progName,
                      semesterNumber: semNum,
                      coordinatorName: coordName,
                    },
                  });
                }
              });
            }
          }
        }

        setResults(combinedResults);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, effectiveInstitutionId]);

  // Inspect schedule and live status when an item is clicked
  useEffect(() => {
    if (!selectedItem) {
      setActiveSession(null);
      setTodaySlots([]);
      setNextSlot(null);
      return;
    }

    let isSubscribed = true;
    const currentItem = selectedItem;
    if (!currentItem) return;

    async function loadEntitySchedule() {
      setLoadingSchedule(true);
      try {
        const now = new Date();
        const jsDay = now.getDay();
        // Database day_of_week: Monday=1 ... Sunday=7
        const dayOfWeek = jsDay === 0 ? 7 : jsDay;
        const currentTimeStr = now.toTimeString().slice(0, 8); // e.g. "11:30:00"

        let targetFacultyId = currentItem.type === 'faculty' ? currentItem.metadata.facultyId : null;
        let targetSectionId =
          currentItem.type === 'section'
            ? currentItem.metadata.sectionId
            : currentItem.type === 'student'
            ? currentItem.metadata.sectionId
            : null;

        // 1. Check live in_progress session in attendance_sessions
        let liveQuery = supabase
          .from('attendance_sessions')
          .select(`
            id, status, session_date, start_time, end_time, session_type,
            subject_offering:subject_offerings(subject:subjects(code, name)),
            classroom:classrooms(room_number, building),
            section:sections(name),
            faculty:faculty(profile:profiles(first_name, last_name))
          `)
          .eq('status', 'in_progress');

        if (targetFacultyId) {
          liveQuery = liveQuery.eq('faculty_id', targetFacultyId);
        } else if (targetSectionId) {
          liveQuery = liveQuery.eq('section_id', targetSectionId);
        }

        const { data: activeLive } = await liveQuery.limit(1);

        // 2. Fetch today's timetable entries
        let timetableQuery = supabase
          .from('timetable_entries')
          .select(`
            id, day_of_week, start_time, end_time,
            section:sections(
              id, name,
              semester:semesters(
                semester_number,
                program:programs(name, code)
              )
            ),
            classroom:classrooms(room_number, building),
            faculty:faculty(id, employee_code, profile:profiles(first_name, last_name)),
            subject_offering:subject_offerings(subject:subjects(code, name))
          `)
          .eq('day_of_week', dayOfWeek);

        if (targetFacultyId) {
          timetableQuery = timetableQuery.eq('faculty_id', targetFacultyId);
        } else if (targetSectionId) {
          timetableQuery = timetableQuery.eq('section_id', targetSectionId);
        }

        const { data: entries } = await timetableQuery.order('start_time');

        if (!isSubscribed) return;

        const formattedSlots: TimetableSlotInfo[] = (entries || []).map((e: any) => {
          const isLive = currentTimeStr >= e.start_time && currentTimeStr <= e.end_time;
          const isPast = currentTimeStr > e.end_time;
          const isUpcoming = currentTimeStr < e.start_time;

          return {
            id: e.id,
            start_time: e.start_time,
            end_time: e.end_time,
            day_of_week: e.day_of_week,
            subject_code: e.subject_offering?.subject?.code || 'SUB',
            subject_name: e.subject_offering?.subject?.name || 'Lecture',
            classroom_name: e.classroom ? `Room ${e.classroom.room_number}` : 'TBD',
            faculty_name: e.faculty?.profile
              ? `Prof. ${e.faculty.profile.first_name} ${e.faculty.profile.last_name}`
              : 'Assigned Faculty',
            section_name: formatSectionShortBadge(e.section),
            is_live: isLive,
            is_past: isPast,
            is_upcoming: isUpcoming,
          };
        });

        // Determine if live from attendance_sessions or timetable
        if (activeLive && activeLive.length > 0) {
          const sess: any = activeLive[0];
          setActiveSession({
            subject_code: sess.subject_offering?.subject?.code || 'LIVE',
            subject_name: sess.subject_offering?.subject?.name || 'Live Lecture',
            classroom_name: sess.classroom ? `Room ${sess.classroom.room_number}` : 'Classroom',
            faculty_name: sess.faculty?.profile
              ? `Prof. ${sess.faculty.profile.first_name} ${sess.faculty.profile.last_name}`
              : 'Faculty',
            section_name: sess.section?.name || 'Class',
            start_time: sess.start_time,
            end_time: sess.end_time,
            is_realtime_stream: true,
          });
        } else {
          // Check if timetable slot is active right now
          const currentSlot = formattedSlots.find((s) => s.is_live);
          if (currentSlot) {
            setActiveSession({
              subject_code: currentSlot.subject_code,
              subject_name: currentSlot.subject_name,
              classroom_name: currentSlot.classroom_name,
              faculty_name: currentSlot.faculty_name,
              section_name: currentSlot.section_name,
              start_time: currentSlot.start_time,
              end_time: currentSlot.end_time,
              is_realtime_stream: false,
            });
          } else {
            setActiveSession(null);
          }
        }

        // Find next slot
        const upcomingSlots = formattedSlots.filter((s) => s.is_upcoming);
        setNextSlot(upcomingSlots.length > 0 ? upcomingSlots[0] : null);
        setTodaySlots(formattedSlots);
      } catch (err) {
        console.error('Error loading schedule inspector:', err);
      } finally {
        if (isSubscribed) setLoadingSchedule(false);
      }
    }

    loadEntitySchedule();
    return () => {
      isSubscribed = false;
    };
  }, [selectedItem]);

  const handleSelectResult = (item: SearchResultItem) => {
    setSelectedItem(item);
    setIsOpen(false);
  };

  return (
    <>
      {/* Search Input Bar */}
      <div ref={containerRef} className="relative w-full max-w-md">
        <div className="relative flex items-center">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search students, faculty, or classes (e.g. Rahul, CSE, Section A)..."
            value={searchTerm}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            className="w-full pl-9 pr-12 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs font-medium text-slate-800 placeholder-slate-400"
          />
          {searchTerm ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setResults([]);
              }}
              className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-600 rounded-md transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 bg-slate-200/60 rounded border border-slate-300">
              Ctrl K
            </kbd>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isOpen && (searchTerm.trim().length >= 2 || results.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[460px] flex flex-col">
            <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                {loading
                  ? 'Searching School Ecosystem...'
                  : `${results.length} Matches in ${institution?.code || 'School'}`}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Click to inspect live lecture status</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {loading ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">Searching across directory &amp; classes...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No matching profiles or classes found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try searching by student name, roll number, faculty designation, or section name.
                  </p>
                </div>
              ) : (
                results.map((item) => (
                  <button
                    key={`${item.type}_${item.id}`}
                    onClick={() => handleSelectResult(item)}
                    className="w-full text-left p-3.5 hover:bg-indigo-50/60 transition flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                          item.type === 'student'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.type === 'faculty'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {item.type === 'student' ? (
                          <GraduationCap className="h-4 w-4" />
                        ) : item.type === 'faculty' ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                            {item.title}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono ${
                              item.type === 'student'
                                ? 'bg-emerald-100/70 text-emerald-800'
                                : item.type === 'faculty'
                                ? 'bg-purple-100/70 text-purple-800'
                                : 'bg-indigo-100/70 text-indigo-800'
                            }`}
                          >
                            {item.type}
                          </span>
                        </div>
                        {/* Subtitle explicitly describes role, class, or faculty details as requested */}
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center text-slate-400 group-hover:text-indigo-600 transition">
                      <span className="text-[10px] font-semibold mr-1 hidden sm:inline">Status</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Schedule & Status Inspector Modal */}
      {selectedItem && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title={`Academic Profile & Schedule Inspector`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Entity Header Banner */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm shadow-sm ${
                    selectedItem.type === 'student'
                      ? 'bg-emerald-600 text-white'
                      : selectedItem.type === 'faculty'
                      ? 'bg-purple-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {selectedItem.type === 'student' ? (
                    <GraduationCap className="h-6 w-6" />
                  ) : selectedItem.type === 'faculty' ? (
                    <Users className="h-6 w-6" />
                  ) : (
                    <BookOpen className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900">{selectedItem.title}</h2>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {selectedItem.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedItem.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
                <span>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* REAL-TIME STATUS CARD (Live Class vs Free Lecture) */}
            {loadingSchedule ? (
              <div className="p-8 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-500">Evaluating active session &amp; timetable...</span>
              </div>
            ) : activeSession ? (
              // 🟢 LIVE LECTURE IN PROGRESS
              <div className="bg-emerald-50/90 rounded-2xl p-5 border-2 border-emerald-400 shadow-sm relative overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                        {activeSession.is_realtime_stream ? '🔴 Live Session Active Right Now' : '🟢 Scheduled Class In Progress'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-emerald-950 mt-1">
                      <span className="font-mono text-emerald-700 mr-2">{activeSession.subject_code}</span>
                      {activeSession.subject_name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-800 pt-1">
                      <span className="flex items-center gap-1 bg-emerald-100/80 px-2 py-1 rounded-lg">
                        <Clock className="h-3.5 w-3.5 text-emerald-700" />
                        Slot: {activeSession.start_time?.substring(0, 5)} - {activeSession.end_time?.substring(0, 5)}
                      </span>
                      <span className="flex items-center gap-1 bg-emerald-100/80 px-2 py-1 rounded-lg">
                        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                        {activeSession.classroom_name}
                      </span>
                      {selectedItem.type !== 'faculty' && (
                        <span className="flex items-center gap-1 bg-emerald-100/80 px-2 py-1 rounded-lg">
                          <Users className="h-3.5 w-3.5 text-emerald-700" />
                          Faculty: {activeSession.faculty_name}
                        </span>
                      )}
                      {selectedItem.type !== 'section' && (
                        <span className="flex items-center gap-1 bg-emerald-100/80 px-2 py-1 rounded-lg">
                          <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
                          Section: {activeSession.section_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ⚪ FREE LECTURE / OFF-PERIOD
              <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                    <Coffee className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-900">
                      Currently Free (No Active Lecture)
                    </h3>
                    <p className="text-xs text-amber-700 font-medium">
                      There is no live or ongoing lecture scheduled at this current hour.
                    </p>
                  </div>
                </div>

                {nextSlot ? (
                  <div className="mt-3 pt-3 border-t border-amber-200/80 flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-700" />
                      Next Lecture Today:
                    </span>
                    <span className="font-bold text-amber-800">
                      <span className="font-mono">{nextSlot.start_time?.substring(0, 5)}</span> — {nextSlot.subject_name} ({nextSlot.classroom_name})
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-amber-200/80 text-xs font-semibold text-amber-800">
                    No further lectures scheduled for today.
                  </div>
                )}
              </div>
            )}

            {/* Today's Full Schedule Timeline */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  Today's Scheduled Periods ({todaySlots.length})
                </h3>
                <span className="text-[11px] text-slate-400 font-semibold">Real-Time Master Timetable</span>
              </div>

              {loadingSchedule ? (
                <div className="space-y-2">
                  <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                </div>
              ) : todaySlots.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                  <p className="text-xs font-bold text-slate-600">No scheduled periods for today</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This day has no slots entered in the master timetable.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySlots.map((slot, idx) => (
                    <div
                      key={slot.id || idx}
                      className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        slot.is_live
                          ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                          : slot.is_past
                          ? 'bg-slate-50/70 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {slot.start_time?.substring(0, 5)} - {slot.end_time?.substring(0, 5)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{slot.subject_code}: {slot.subject_name}</span>
                            {slot.is_live && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 animate-pulse">
                                Live Now
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span>{slot.classroom_name}</span>
                            <span>•</span>
                            <span>{selectedItem.type === 'faculty' ? slot.section_name : slot.faculty_name}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {slot.is_live ? (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> In Progress
                          </span>
                        ) : slot.is_past ? (
                          <span className="text-[10px] font-semibold text-slate-400">Completed</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-indigo-600">Upcoming</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
