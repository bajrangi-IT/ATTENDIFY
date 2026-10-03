import React, { useState, useEffect } from 'react';
import { supabase, DEFAULT_INSTITUTION_ID } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TableSkeleton } from '../../components/ui/Skeleton';
import {
  Building2,
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  FolderTree,
  BookOpen,
  Clock,
  Sparkles,
  Edit,
  Tag,
  DoorOpen,
  LayoutGrid,
  UserCheck,
  UserPlus
} from 'lucide-react';

export const AcademicSetup: React.FC = () => {
  const toast = useToast();
  const {
    profile,
    institution,
    currentInstitutionId
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'classrooms' | 'subjects' | 'years' | 'offerings'>('hierarchy');

  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [subjectOfferings, setSubjectOfferings] = useState<any[]>([]);

  // Department Modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');

  // Program Modal
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [progName, setProgName] = useState('');
  const [progCode, setProgCode] = useState('');
  const [progDeptId, setProgDeptId] = useState('');
  const [progDegreeLevel, setProgDegreeLevel] = useState('undergraduate');
  const [progDuration, setProgDuration] = useState(8);

  // Classroom Modal
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomBuilding, setRoomBuilding] = useState('');
  const [roomFloor, setRoomFloor] = useState(1);
  const [roomCapacity, setRoomCapacity] = useState(60);
  const [roomCampusId, setRoomCampusId] = useState('');

  // Subject Modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectCredits, setSubjectCredits] = useState(4);
  const [subjectDeptId, setSubjectDeptId] = useState('');
  const [subjectType, setSubjectType] = useState('core');

  // Academic Year Modal
  const [showYearModal, setShowYearModal] = useState(false);
  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');
  const [yearIsCurrent, setYearIsCurrent] = useState(false);

  // Section Modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionSemesterId, setSectionSemesterId] = useState('');
  const [sectionCapacity, setSectionCapacity] = useState(70);
  const [sectionCoordinatorId, setSectionCoordinatorId] = useState('');

  // Class Coordinator Assign Modal
  const [showAssignCoordinatorModal, setShowAssignCoordinatorModal] = useState(false);
  const [assigningSection, setAssigningSection] = useState<any | null>(null);
  const [targetCoordinatorId, setTargetCoordinatorId] = useState('');
  const [facultyList, setFacultyList] = useState<any[]>([]);

  // Offering Modal
  const [showOfferingModal, setShowOfferingModal] = useState(false);
  const [offeringSubjectId, setOfferingSubjectId] = useState('');
  const [offeringSemesterId, setOfferingSemesterId] = useState('');
  const [offeringYearId, setOfferingYearId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
    try {
      // 0. Guarantee institution exists in database
      const { data: instCheck } = await supabase.from('institutions').select('id').eq('id', instId).maybeSingle();
      if (!instCheck) {
        try {
          await supabase.from('institutions').upsert({
            id: instId,
            name: institution?.name || 'Academic Institution',
            code: institution?.code || 'INST',
            address: institution?.address || 'SDGI Global University Campus',
            timezone: 'Asia/Kolkata',
            is_active: true
          });
        } catch (instSyncErr) {
          console.warn('Auto-sync institution notice:', instSyncErr);
        }
      }

      // 1. Fetch departments, academic years, and campuses strictly for this institution
      let [
        { data: depts, error: dErr },
        { data: years, error: yErr },
        { data: camps, error: cErr }
      ] = await Promise.all([
        supabase.from('departments').select('*, hod:profiles(*)').eq('institution_id', instId).order('name'),
        supabase.from('academic_years').select('*').eq('institution_id', instId).order('start_date', { ascending: false }),
        supabase.from('campuses').select('*').eq('institution_id', instId).order('name')
      ]);

      if (dErr) throw dErr;
      if (yErr) throw yErr;
      if (cErr) throw cErr;

      // Auto-provision default campus block if this school doesn't have one yet
      let campList = camps || [];
      if (campList.length === 0) {
        try {
          const { data: newCamp } = await supabase.from('campuses').insert({
            id: crypto.randomUUID(),
            institution_id: instId,
            name: `${institution?.name || 'Main'} Campus Block`,
            code: `${(institution?.code || 'CAMP').toUpperCase()}-MAIN`,
            address: institution?.address || 'SDGI Global University Campus'
          }).select().single();
          if (newCamp) campList = [newCamp];
        } catch (cProvErr) {
          console.warn('Campus auto-provision notice:', cProvErr);
        }
      }

      // Auto-provision default academic year if this school doesn't have one yet
      let yearList = years || [];
      if (yearList.length === 0) {
        try {
          const { data: newYear } = await supabase.from('academic_years').insert({
            id: crypto.randomUUID(),
            institution_id: instId,
            name: '2025-2026',
            start_date: '2025-08-01',
            end_date: '2026-06-30',
            is_current: true
          }).select().single();
          if (newYear) yearList = [newYear];
        } catch (yProvErr) {
          console.warn('Academic year auto-provision notice:', yProvErr);
        }
      }

      const deptList = depts || [];
      const deptIds = deptList.map((d: any) => d.id);
      const campIds = campList.map((c: any) => c.id);

      // 2. Fetch programs and subjects strictly belonging to this institution's departments
      let progList: any[] = [];
      let subList: any[] = [];
      if (deptIds.length > 0) {
        const [{ data: progs, error: pErr }, { data: subs }] = await Promise.all([
          supabase.from('programs').select('*, department:departments(name, code)').in('department_id', deptIds).order('name'),
          supabase.from('subjects').select('*, department:departments(name, code)').in('department_id', deptIds).order('code')
        ]);
        if (pErr) throw pErr;
        progList = progs || [];
        subList = subs || [];
      }

      const progIds = progList.map((p: any) => p.id);
      const subIds = subList.map((s: any) => s.id);

      // 3. Fetch semesters strictly belonging to this institution's programs
      let semList: any[] = [];
      if (progIds.length > 0) {
        const { data: sems } = await supabase
          .from('semesters')
          .select('*, program:programs(name, code), academic_year:academic_years(name)')
          .in('program_id', progIds)
          .order('semester_number');
        semList = sems || [];
      }

      const semIds = semList.map((s: any) => s.id);

      // 4. Fetch sections strictly belonging to this institution's semesters with coordinator
      let secList: any[] = [];
      if (semIds.length > 0) {
        const { data: secs, error: sErr } = await supabase
          .from('sections')
          .select(`
            *,
            semester:semesters(semester_number, program:programs(name, code)),
            coordinator:faculty!sections_class_coordinator_id_fkey(id, employee_code, designation, profile:profiles(first_name, last_name, email))
          `)
          .in('semester_id', semIds)
          .order('name');
        if (sErr) throw sErr;
        secList = secs || [];
      }

      // 5. Fetch subject offerings strictly belonging to this institution's subjects
      let offerList: any[] = [];
      if (subIds.length > 0) {
        const { data: offers } = await supabase
          .from('subject_offerings')
          .select(`
            id, is_active,
            subject:subjects(id, name, code, credits),
            semester:semesters(id, semester_number, program:programs(name, code)),
            academic_year:academic_years(name)
          `)
          .in('subject_id', subIds);
        offerList = offers || [];
      }

      // 6. Fetch classrooms strictly belonging to this institution's campuses
      let roomList: any[] = [];
      if (campIds.length > 0) {
        const { data: rooms } = await supabase
          .from('classrooms')
          .select('*, campus:campuses(name)')
          .in('campus_id', campIds)
          .order('room_number');
        roomList = rooms || [];
      }

      // 7. Fetch faculty members strictly belonging to this institution for Class Coordinator roles
      const { data: facs } = await supabase
        .from('faculty')
        .select('id, employee_code, designation, profile:profiles(first_name, last_name, email)')
        .eq('institution_id', instId)
        .order('employee_code');
      setFacultyList(facs || []);

      setDepartments(deptList);
      setPrograms(progList);
      setSemesters(semList);
      setSections(secList);
      setSubjects(subList);
      setAcademicYears(years || []);
      setSubjectOfferings(offerList);
      setClassrooms(roomList);
      setCampuses(campList);

      setProgDeptId(deptList[0]?.id || '');
      setSubjectDeptId(deptList[0]?.id || '');
      setRoomCampusId(campList[0]?.id || '');
      setSectionSemesterId(semList[0]?.id || '');
      setOfferingSubjectId(subList[0]?.id || '');
      setOfferingYearId(years?.[0]?.id || '');
    } catch (err: any) {
      console.error('Error fetching academic setup:', err);
      toast.error('Failed to load academic setup', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.institution_id, currentInstitutionId]);

  const handleAutoGenerateSemesters = async () => {
    try {
      setLoading(true);
      let activeYearId = academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id;
      if (!activeYearId) {
        const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
        const { data: newYear, error: yErr } = await supabase
          .from('academic_years')
          .insert({
            institution_id: instId,
            name: '2025-2026',
            start_date: '2025-08-01',
            end_date: '2026-06-30',
            is_current: true
          })
          .select()
          .single();
        if (yErr) throw yErr;
        activeYearId = newYear.id;
      }

      const rowsToInsert: any[] = [];
      for (const prog of programs) {
        const duration = prog.duration_semesters || 8;
        for (let s = 1; s <= duration; s++) {
          const exists = semesters.some((sem) => sem.program_id === prog.id && sem.semester_number === s);
          if (!exists) {
            rowsToInsert.push({
              program_id: prog.id,
              academic_year_id: activeYearId,
              semester_number: s,
              is_active: true
            });
          }
        }
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('semesters').insert(rowsToInsert);
        if (error) throw error;
        toast.success('Semesters Generated', `Successfully provisioned ${rowsToInsert.length} semesters.`);
      } else {
        toast.info('Semesters Present', 'All programs already have active semesters configured.');
      }
      await fetchData();
    } catch (err: any) {
      console.error('Error generating semesters:', err);
      toast.error('Failed to generate semesters', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
    try {
      // Ensure institution exists in PostgreSQL institutions table to avoid foreign key violation
      const { data: instCheck } = await supabase.from('institutions').select('id').eq('id', instId).maybeSingle();
      if (!instCheck) {
        await supabase.from('institutions').upsert({
          id: instId,
          name: institution?.name || 'Academic Institution',
          code: institution?.code || 'INST',
          address: institution?.address || 'SDGI Global University Campus',
          timezone: 'Asia/Kolkata',
          is_active: true
        });
      }

      const { error } = await supabase.from('departments').insert({
        institution_id: instId,
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
      });
      if (error) throw error;

      toast.success('Department Created', `${deptName} added to institution.`);
      setShowDeptModal(false);
      setDeptName('');
      setDeptCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create department', err.message);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const duration = Number(progDuration) || 8;
      const { data: newProg, error } = await supabase
        .from('programs')
        .insert({
          department_id: progDeptId,
          name: progName.trim(),
          code: progCode.trim().toUpperCase(),
          degree_level: progDegreeLevel,
          duration_semesters: duration,
        })
        .select()
        .single();
      if (error) throw error;

      // Automatically provision semesters for the newly created program
      let activeYearId = academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id;
      if (newProg && activeYearId) {
        const semRows = [];
        for (let i = 1; i <= duration; i++) {
          semRows.push({
            program_id: newProg.id,
            academic_year_id: activeYearId,
            semester_number: i,
            is_active: true
          });
        }
        await supabase.from('semesters').insert(semRows);
      }

      toast.success('Program Created', `${progName} added with ${duration} semesters provisioned.`);
      setShowProgramModal(false);
      setProgName('');
      setProgCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create program', err.message);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
    try {
      let campId = roomCampusId || campuses[0]?.id;
      if (!campId) {
        const { data: createdCamp } = await supabase.from('campuses').insert({
          id: crypto.randomUUID(),
          institution_id: instId,
          name: `${institution?.name || 'Main'} Campus Block`,
          code: `${(institution?.code || 'CAMP').toUpperCase()}-MAIN`,
          address: institution?.address || 'SDGI Global University Campus'
        }).select().single();
        campId = createdCamp?.id;
      }

      const { error } = await supabase.from('classrooms').insert({
        campus_id: campId,
        room_number: roomNumber.trim().toUpperCase(),
        building: roomBuilding.trim(),
        floor: Number(roomFloor) || 1,
        capacity: Number(roomCapacity) || 60,
        is_active: true
      });
      if (error) throw error;

      toast.success('Classroom Registered', `Room ${roomNumber} in ${roomBuilding} created.`);
      setShowClassroomModal(false);
      setRoomNumber('');
      setRoomBuilding('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create classroom', err.message);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('subjects').insert({
        department_id: subjectDeptId,
        name: subjectName.trim(),
        code: subjectCode.trim().toUpperCase(),
        credits: Number(subjectCredits),
        subject_type: subjectType
      });
      if (error) throw error;

      toast.success('Subject Created', `${subjectCode} - ${subjectName} registered.`);
      setShowSubjectModal(false);
      setSubjectName('');
      setSubjectCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create subject', err.message);
    }
  };

  const handleOpenYearModal = () => {
    const curYear = new Date().getFullYear();
    setYearName(`${curYear}-${curYear + 1}`);
    setYearStartDate(`${curYear}-08-01`);
    setYearEndDate(`${curYear + 1}-06-30`);
    setYearIsCurrent(academicYears.length === 0);
    setShowYearModal(true);
  };

  const handleCreateAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
    try {
      if (yearIsCurrent) {
        // Unset any existing active years
        await supabase.from('academic_years').update({ is_current: false }).eq('institution_id', instId);
      }

      const { error } = await supabase.from('academic_years').insert({
        institution_id: instId,
        name: yearName.trim(),
        start_date: yearStartDate,
        end_date: yearEndDate,
        is_current: yearIsCurrent
      });
      if (error) throw error;

      toast.success('Academic Year Created', `${yearName} registered.`);
      setShowYearModal(false);
      setYearName('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create academic year', err.message);
    }
  };

  const handleSetActiveYear = async (yearId: string) => {
    const instId = profile?.institution_id || currentInstitutionId || DEFAULT_INSTITUTION_ID;
    try {
      await supabase.from('academic_years').update({ is_current: false }).eq('institution_id', instId);
      const { error } = await supabase.from('academic_years').update({ is_current: true }).eq('id', yearId);
      if (error) throw error;

      toast.success('Active Term Updated', 'Set as currently running academic term.');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to set active term', err.message);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let semId = sectionSemesterId;
      if (!semId && semesters.length > 0) {
        semId = semesters[0].id;
      }
      if (!semId) {
        toast.error('Semester Required', 'No semester selected. Please auto-generate semesters first.');
        return;
      }

      const { error } = await supabase.from('sections').insert({
        semester_id: semId,
        name: sectionName.trim(),
        capacity: Number(sectionCapacity),
        class_coordinator_id: sectionCoordinatorId || null
      });
      if (error) throw error;

      toast.success('Class / Section Created', `${sectionName} added to semester.`);
      setShowSectionModal(false);
      setSectionName('');
      setSectionCoordinatorId('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create section', err.message);
    }
  };

  const handleAssignCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSection) return;
    try {
      const { error } = await supabase
        .from('sections')
        .update({ class_coordinator_id: targetCoordinatorId || null })
        .eq('id', assigningSection.id);
      if (error) throw error;

      toast.success('Class Coordinator Updated', targetCoordinatorId ? 'Assigned faculty as class incharge.' : 'Removed class coordinator.');
      setShowAssignCoordinatorModal(false);
      setAssigningSection(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to assign coordinator', err.message);
    }
  };

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('subject_offerings').insert({
        subject_id: offeringSubjectId,
        semester_id: offeringSemesterId || semesters[0]?.id,
        academic_year_id: offeringYearId,
        is_active: true
      });
      if (error) throw error;

      toast.success('Course Offering Created', 'Subject mapped to semester.');
      setShowOfferingModal(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create offering', err.message);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              Curriculum & Hierarchy
            </span>
            <span className="text-xs text-slate-400 font-semibold">• {institution?.name || 'School of Engineering & Technology'} (SDGI Global University)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Academic Structure Setup</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Configure departments, degree courses, subject curricula, semester offerings, cohort sections, and academic year terms.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 gap-1">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'hierarchy' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Structure & Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('classrooms')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'classrooms' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Classrooms & Labs ({classrooms.length})
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'subjects' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Courses & Subjects ({subjects.length})
          </button>
          <button
            onClick={() => setActiveTab('years')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'years' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Academic Years ({academicYears.length})
          </button>
          <button
            onClick={() => setActiveTab('offerings')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'offerings' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Subject Offerings ({subjectOfferings.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Hierarchy (Depts, Programs, Sections, Classrooms) */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setShowDeptModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Department
            </button>
            <button
              onClick={() => setShowProgramModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Program
            </button>
            <button
              onClick={() => {
                if (!sectionSemesterId && semesters.length > 0) {
                  setSectionSemesterId(semesters[0].id);
                }
                setShowSectionModal(true);
              }}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Class / Section
            </button>
            <button
              onClick={() => setShowClassroomModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Classroom / Hall
            </button>
            {semesters.length === 0 && (
              <button
                onClick={handleAutoGenerateSemesters}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="h-4 w-4" /> Generate Semesters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Departments */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" /> Academic Departments ({departments.length})
                </h2>
                <button
                  onClick={() => setShowDeptModal(true)}
                  className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {loading ? (
                <TableSkeleton rows={4} columns={2} />
              ) : departments.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No departments added yet.</div>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {departments.map((d) => (
                    <div key={d.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-indigo-600 font-mono">{d.code}</span>
                          <span className="font-bold text-xs text-slate-800">{d.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          HOD: {d.hod ? `${d.hod.first_name} ${d.hod.last_name}` : 'Institutional Appointee'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Degree Programs */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-purple-600" /> Degree Programs ({programs.length})
                </h2>
                <button
                  onClick={() => setShowProgramModal(true)}
                  className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {loading ? (
                <TableSkeleton rows={4} columns={2} />
              ) : programs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No degree programs added yet.</div>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {programs.map((p) => (
                    <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-purple-600 font-mono">{p.code}</span>
                          <span className="font-bold text-xs text-slate-800">{p.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {p.department?.name || 'Academic Dept'} • {p.duration_semesters || 8} Semesters
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Classes / Cohort Sections */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" /> Active Classes & Cohort Sections ({sections.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Student batches enrolled per semester and degree program.</p>
              </div>
              <button
                onClick={() => {
                  if (!sectionSemesterId && semesters.length > 0) {
                    setSectionSemesterId(semesters[0].id);
                  }
                  setShowSectionModal(true);
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Class / Section
              </button>
            </div>
            {sections.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center">
                <p className="text-xs text-slate-500 font-medium">No class sections registered yet.</p>
                <button
                  onClick={() => setShowSectionModal(true)}
                  className="mt-2 text-xs font-bold text-purple-600 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Click here to create your first class section
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sections.map((sec) => {
                  const semNum = sec.semester?.semester_number || 1;
                  const yearNum = Math.ceil(semNum / 2);
                  const yearSuffixes = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
                  const yearLabel = yearSuffixes[yearNum - 1] || `Year ${yearNum}`;
                  const coordinatorName = sec.coordinator?.profile
                    ? `${sec.coordinator.profile.first_name} ${sec.coordinator.profile.last_name}`
                    : null;

                  return (
                    <div key={sec.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-purple-300 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                            {yearLabel} • Sem {semNum}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">Cap: {sec.capacity}</span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900 mt-1">{sec.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {sec.semester?.program?.name || sec.semester?.program?.code || 'Degree Program'}
                        </p>
                      </div>

                      {/* Class Coordinator Display & Quick Assign */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Class Coordinator</p>
                          {coordinatorName ? (
                            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-0.5 truncate" title={coordinatorName}>
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{coordinatorName}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 font-medium italic flex items-center gap-1 mt-0.5">
                              Not Assigned
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningSection(sec);
                            setTargetCoordinatorId(sec.class_coordinator_id || '');
                            setShowAssignCoordinatorModal(true);
                          }}
                          className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-lg text-[11px] font-bold shrink-0 transition-colors flex items-center gap-1 shadow-sm"
                          title="Assign or change class coordinator"
                        >
                          <UserPlus className="h-3 w-3" />
                          {coordinatorName ? 'Change' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Campus Classrooms & Lecture Halls */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-emerald-600" /> Physical Classrooms & Lecture Halls ({classrooms.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Physical lecture rooms, computing labs, and tutorial rooms on campus.</p>
              </div>
              <button
                onClick={() => setShowClassroomModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Classroom / Hall
              </button>
            </div>
            {classrooms.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center">
                <p className="text-xs text-slate-500 font-medium">No classrooms configured yet.</p>
                <button
                  onClick={() => setShowClassroomModal(true)}
                  className="mt-2 text-xs font-bold text-emerald-600 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a classroom or lecture hall
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {classrooms.slice(0, 8).map((room) => (
                  <div key={room.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-emerald-700 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                        {room.room_number}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">{room.capacity} seats</span>
                    </div>
                    <h3 className="font-bold text-xs text-slate-900 mt-1.5 truncate">{room.building}</h3>
                    <p className="text-[10px] text-slate-500">Floor {room.floor || 1} • {room.campus?.name || 'Main Campus'}</p>
                  </div>
                ))}
              </div>
            )}
            {classrooms.length > 8 && (
              <div className="mt-3 text-right">
                <button
                  onClick={() => setActiveTab('classrooms')}
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  View all {classrooms.length} classrooms & labs →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Classrooms & Labs Dedicated View */}
      {activeTab === 'classrooms' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-emerald-600" /> Physical Classrooms, Labs & Lecture Halls ({classrooms.length})
              </h2>
              <p className="text-xs text-slate-500">Rooms assigned for lectures, tutorials, practicals, and automated biometric kiosk attendance.</p>
            </div>
            <button
              onClick={() => setShowClassroomModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" /> Add Classroom / Hall
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((room) => (
              <div key={room.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-sm text-emerald-700 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                      {room.room_number}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      room.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {room.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-slate-900">{room.building}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Floor {room.floor || 1} • {room.campus?.name || 'Main Campus'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-medium">
                    Capacity: <strong className="text-slate-800">{room.capacity} seats</strong>
                  </span>
                  {room.device_identifier ? (
                    <span className="text-[10px] font-mono text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                      Kiosk: {room.device_identifier}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No Kiosk Paired</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Subjects & Courses */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Institutional Course Curriculum</h2>
              <p className="text-xs text-slate-500">Subjects offered across academic engineering faculties.</p>
            </div>
            <button
              onClick={() => setShowSubjectModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Subject
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Subject Code</th>
                  <th className="py-3 px-4">Subject Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Credits</th>
                  <th className="py-3 px-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{sub.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{sub.name}</td>
                    <td className="py-3 px-4 text-slate-600">{sub.department?.name}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{sub.credits}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {sub.subject_type || 'Core'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Academic Years */}
      {activeTab === 'years' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Academic Years & Terms</h2>
              <p className="text-xs text-slate-500">Institutional session calendars and term boundaries.</p>
            </div>
            <button
              onClick={handleOpenYearModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Academic Year
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {academicYears.map((ay) => (
              <div key={ay.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative flex flex-col justify-between">
                <div>
                  {ay.is_current && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Current Active Term
                    </span>
                  )}
                  <h3 className="font-bold text-base text-slate-900">{ay.name}</h3>
                  <div className="text-xs text-slate-500 mt-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" /> Start: {ay.start_date}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> End: {ay.end_date}
                    </div>
                  </div>
                </div>

                {!ay.is_current && (
                  <button
                    type="button"
                    onClick={() => handleSetActiveYear(ay.id)}
                    className="mt-3 w-full py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-bold transition-colors"
                  >
                    Set as Current Term
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Subject Offerings */}
      {activeTab === 'offerings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Subject Offerings</h2>
              <p className="text-xs text-slate-500">Curricular links between subjects, semesters, and academic terms.</p>
            </div>
            <button
              onClick={() => setShowOfferingModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Create Course Offering
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Program & Semester</th>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectOfferings.map((so) => (
                  <tr key={so.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {so.subject?.name} <span className="font-mono text-indigo-600">({so.subject?.code})</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {so.semester?.program?.name} (Sem {so.semester?.semester_number})
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{so.academic_year?.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Department Modal */}
      <Modal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title="Add Academic Department">
        <form onSubmit={handleCreateDepartment} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Department Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Department of Mechanical Engineering"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Department Code *</label>
            <input
              required
              type="text"
              placeholder="e.g. MECH"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 uppercase font-mono"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeptModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
            >
              Create Department
            </button>
          </div>
        </form>
      </Modal>

      {/* Program Modal */}
      <Modal isOpen={showProgramModal} onClose={() => setShowProgramModal(false)} title="Add Degree Program">
        <form onSubmit={handleCreateProgram} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Department *</label>
            <select
              value={progDeptId}
              onChange={(e) => setProgDeptId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Program Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Bachelor of Technology in Computer Science"
              value={progName}
              onChange={(e) => setProgName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Program Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. BTECH-CSE"
                value={progCode}
                onChange={(e) => setProgCode(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 uppercase font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Degree Level</label>
              <select
                value={progDegreeLevel}
                onChange={(e) => setProgDegreeLevel(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium"
              >
                <option value="undergraduate">Undergraduate (UG)</option>
                <option value="postgraduate">Postgraduate (PG)</option>
                <option value="diploma">Diploma</option>
                <option value="doctorate">Doctorate / PhD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Duration (Semesters)</label>
              <select
                value={progDuration}
                onChange={(e) => setProgDuration(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium"
              >
                <option value={2}>2 Semesters (1 Year)</option>
                <option value={4}>4 Semesters (2 Years - M.Tech/MBA)</option>
                <option value={6}>6 Semesters (3 Years - BCA/BBA)</option>
                <option value={8}>8 Semesters (4 Years - B.Tech/B.Pharm)</option>
                <option value={10}>10 Semesters (5 Years - Integrated)</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-indigo-600 bg-indigo-50 p-2 rounded-lg font-medium">
            💡 Semesters 1 through {progDuration} will be automatically created and linked to the active academic session.
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowProgramModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
            >
              Create Program
            </button>
          </div>
        </form>
      </Modal>

      {/* Subject Modal */}
      <Modal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} title="Register Academic Subject">
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Department *</label>
            <select
              value={subjectDeptId}
              onChange={(e) => setSubjectDeptId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium"
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
              <label className="text-xs font-bold text-slate-700">Subject Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. CS601"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 uppercase font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Credits *</label>
              <input
                required
                type="number"
                min={1}
                max={10}
                value={subjectCredits}
                onChange={(e) => setSubjectCredits(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Subject Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Distributed Database Systems"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Subject Type</label>
            <select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium"
            >
              <option value="core">Core Theory</option>
              <option value="lab">Practical / Laboratory</option>
              <option value="elective">Departmental Elective</option>
              <option value="open_elective">Open / University Elective</option>
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSubjectModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
            >
              Register Subject
            </button>
          </div>
        </form>
      </Modal>

      {/* Classroom Modal */}
      <Modal isOpen={showClassroomModal} onClose={() => setShowClassroomModal(false)} title="Add Classroom / Lecture Hall">
        <form onSubmit={handleCreateClassroom} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Room Number / Identifier *</label>
              <input
                required
                type="text"
                placeholder="e.g. LH-101, Lab-3, CR-204"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Building / Academic Block *</label>
              <input
                required
                type="text"
                placeholder="e.g. Turing Academic Block"
                value={roomBuilding}
                onChange={(e) => setRoomBuilding(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Floor Number</label>
              <input
                type="number"
                min={0}
                max={20}
                value={roomFloor}
                onChange={(e) => setRoomFloor(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Seating Capacity</label>
              <input
                type="number"
                min={10}
                max={500}
                value={roomCapacity}
                onChange={(e) => setRoomCapacity(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Campus</label>
              <select
                value={roomCampusId}
                onChange={(e) => setRoomCampusId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowClassroomModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700"
            >
              Register Classroom
            </button>
          </div>
        </form>
      </Modal>

      {/* Section Modal */}
      <Modal isOpen={showSectionModal} onClose={() => setShowSectionModal(false)} title="Add Class / Cohort Section">
        <form onSubmit={handleCreateSection} className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Target Semester *</label>
              {semesters.length === 0 && (
                <button
                  type="button"
                  onClick={handleAutoGenerateSemesters}
                  className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto-Generate Semesters
                </button>
              )}
            </div>

            {semesters.length === 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2 mt-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-600" /> No semesters configured yet!
                </p>
                <p className="text-[11px] text-amber-700">
                  Degree programs require semester terms before cohort sections can be created. Click below to automatically provision Semesters 1 to 8.
                </p>
                <button
                  type="button"
                  onClick={handleAutoGenerateSemesters}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" /> ⚡ Auto-Generate Semesters Now
                </button>
              </div>
            ) : (
              <select
                required
                value={sectionSemesterId}
                onChange={(e) => setSectionSemesterId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium text-slate-800"
              >
                <option value="">-- Select Target Semester --</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.program?.name || s.program?.code} — Semester {s.semester_number} ({s.academic_year?.name || 'Active Session'})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Class / Section Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Section A, Section B, CSE-AIML-1"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 font-medium"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Student Seat Capacity</label>
            <input
              type="number"
              min={1}
              max={300}
              value={sectionCapacity}
              onChange={(e) => setSectionCapacity(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Class Coordinator (Faculty Incharge)</label>
            <select
              value={sectionCoordinatorId}
              onChange={(e) => setSectionCoordinatorId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium text-slate-800"
            >
              <option value="">-- No Coordinator Assigned (Optional) --</option>
              {facultyList.map((f) => {
                const name = f.profile ? `${f.profile.first_name} ${f.profile.last_name}` : f.employee_code;
                return (
                  <option key={f.id} value={f.id}>
                    {name} ({f.employee_code}{f.designation ? ` • ${f.designation}` : ''})
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-slate-400 mt-0.5">Faculty member assigned to oversee this specific class & attendance.</p>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSectionModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={semesters.length === 0}
              className="px-4 py-2 bg-purple-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl hover:bg-purple-700"
            >
              Create Class / Section
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Class Coordinator Modal */}
      <Modal
        isOpen={showAssignCoordinatorModal}
        onClose={() => {
          setShowAssignCoordinatorModal(false);
          setAssigningSection(null);
        }}
        title={`Assign Class Coordinator — ${assigningSection?.name || 'Class'}`}
      >
        <form onSubmit={handleAssignCoordinator} className="space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
            <p className="font-bold">
              Class: {assigningSection?.name} ({assigningSection?.semester?.program?.name || 'Degree Program'})
            </p>
            <p className="text-[11px] text-purple-700 mt-0.5">
              The assigned faculty member will oversee this class's attendance registers, defaulters, and curricular reports.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Select Faculty Incharge</label>
            <select
              value={targetCoordinatorId}
              onChange={(e) => setTargetCoordinatorId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white font-medium text-slate-800"
            >
              <option value="">-- No Coordinator (Unassigned) --</option>
              {facultyList.map((f) => {
                const name = f.profile ? `${f.profile.first_name} ${f.profile.last_name}` : f.employee_code;
                return (
                  <option key={f.id} value={f.id}>
                    {name} ({f.employee_code}{f.designation ? ` • ${f.designation}` : ''})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAssignCoordinatorModal(false);
                setAssigningSection(null);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Save Class Coordinator
            </button>
          </div>
        </form>
      </Modal>

      {/* Academic Year Modal */}
      <Modal isOpen={showYearModal} onClose={() => setShowYearModal(false)} title="Add Academic Year & Term">
        <form onSubmit={handleCreateAcademicYear} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Academic Session Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. 2026-2027 or 2025-2026"
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 font-medium"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Start Date *</label>
              <input
                required
                type="date"
                value={yearStartDate}
                onChange={(e) => setYearStartDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">End Date *</label>
              <input
                required
                type="date"
                value={yearEndDate}
                onChange={(e) => setYearEndDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="yearIsCurrent"
              checked={yearIsCurrent}
              onChange={(e) => setYearIsCurrent(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="yearIsCurrent" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Set as Current Active Session for this School
            </label>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowYearModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Create Academic Year
            </button>
          </div>
        </form>
      </Modal>

      {/* Subject Offering Modal */}
      <Modal isOpen={showOfferingModal} onClose={() => setShowOfferingModal(false)} title="Create Course Offering">
        <form onSubmit={handleCreateOffering} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Subject *</label>
            <select
              value={offeringSubjectId}
              onChange={(e) => setOfferingSubjectId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Semester *</label>
            <select
              value={offeringSemesterId}
              onChange={(e) => setOfferingSemesterId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.program?.name} (Semester {s.semester_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Academic Year *</label>
            <select
              value={offeringYearId}
              onChange={(e) => setOfferingYearId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOfferingModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
            >
              Create Offering
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
