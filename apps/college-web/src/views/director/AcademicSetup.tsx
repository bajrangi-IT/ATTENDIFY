import React, { useState, useEffect } from 'react';
import { supabase, DEFAULT_INSTITUTION_ID } from '../../lib/supabase';
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
  Tag
} from 'lucide-react';

export const AcademicSetup: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'subjects' | 'years' | 'offerings'>('hierarchy');

  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
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

  // Offering Modal
  const [showOfferingModal, setShowOfferingModal] = useState(false);
  const [offeringSubjectId, setOfferingSubjectId] = useState('');
  const [offeringSemesterId, setOfferingSemesterId] = useState('');
  const [offeringYearId, setOfferingYearId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: depts, error: dErr },
        { data: progs, error: pErr },
        { data: sems },
        { data: secs, error: sErr },
        { data: subs },
        { data: years, error: yErr },
        { data: offers }
      ] = await Promise.all([
        supabase.from('departments').select('*, hod:profiles(*)').order('name'),
        supabase.from('programs').select('*, department:departments(name, code)').order('name'),
        supabase.from('semesters').select('*, program:programs(name, code)').order('semester_number'),
        supabase.from('sections').select('*, semester:semesters(semester_number, program:programs(name, code))').order('name'),
        supabase.from('subjects').select('*, department:departments(name, code)').order('code'),
        supabase.from('academic_years').select('*').order('start_date', { ascending: false }),
        supabase.from('subject_offerings').select(`
          id, is_active,
          subject:subjects(id, name, code, credits),
          semester:semesters(id, semester_number, program:programs(name, code)),
          academic_year:academic_years(name)
        `)
      ]);

      if (dErr) throw dErr;
      if (pErr) throw pErr;
      if (sErr) throw sErr;
      if (yErr) throw yErr;

      setDepartments(depts || []);
      setPrograms(progs || []);
      setSemesters(sems || []);
      setSections(secs || []);
      setSubjects(subs || []);
      setAcademicYears(years || []);
      setSubjectOfferings(offers || []);

      if (depts && depts.length > 0) {
        if (!progDeptId) setProgDeptId(depts[0].id);
        if (!subjectDeptId) setSubjectDeptId(depts[0].id);
      }
      if (sems && sems.length > 0 && !sectionSemesterId) {
        setSectionSemesterId(sems[0].id);
      }
      if (subs && subs.length > 0 && !offeringSubjectId) {
        setOfferingSubjectId(subs[0].id);
      }
      if (years && years.length > 0 && !offeringYearId) {
        setOfferingYearId(years[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching academic setup:', err);
      toast.error('Failed to load academic setup', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('departments').insert({
        institution_id: DEFAULT_INSTITUTION_ID,
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
      const { error } = await supabase.from('programs').insert({
        department_id: progDeptId,
        name: progName.trim(),
        code: progCode.trim().toUpperCase(),
        degree_level: 'undergraduate',
        duration_semesters: 8,
      });
      if (error) throw error;

      toast.success('Program Created', `${progName} added.`);
      setShowProgramModal(false);
      setProgName('');
      setProgCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create program', err.message);
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

  const handleCreateAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('academic_years').insert({
        institution_id: DEFAULT_INSTITUTION_ID,
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

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('sections').insert({
        semester_id: sectionSemesterId,
        name: sectionName.trim(),
        capacity: Number(sectionCapacity)
      });
      if (error) throw error;

      toast.success('Section Created', `${sectionName} added to semester.`);
      setShowSectionModal(false);
      setSectionName('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create section', err.message);
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
            <span className="text-xs text-slate-400 font-semibold">• Director Control</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Academic Structure Setup</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Configure departments, degree courses, subject curricula, semester offerings, cohort sections, and academic year terms.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'hierarchy' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Departments & Programs
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

      {/* Tab 1: Hierarchy (Depts, Programs, Sections) */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
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
              onClick={() => setShowSectionModal(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Section
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Departments */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" /> Academic Departments ({departments.length})
              </h2>
              {loading ? (
                <TableSkeleton rows={4} columns={2} />
              ) : (
                <div className="space-y-2.5">
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
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-purple-600" /> Degree Programs ({programs.length})
              </h2>
              {loading ? (
                <TableSkeleton rows={4} columns={2} />
              ) : (
                <div className="space-y-2.5">
                  {programs.map((p) => (
                    <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-purple-600 font-mono">{p.code}</span>
                          <span className="font-bold text-xs text-slate-800">{p.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {p.department?.name} • 8 Semesters
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Sections */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" /> Active Cohort Sections ({sections.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sections.map((sec) => (
                <div key={sec.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs font-bold text-indigo-600">
                    {sec.semester?.program?.code} (Sem {sec.semester?.semester_number})
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 mt-0.5">{sec.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Capacity: {sec.capacity} Enrolled Students</p>
                </div>
              ))}
            </div>
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
              onClick={() => setShowYearModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Academic Year
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {academicYears.map((ay) => (
              <div key={ay.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                {ay.is_current && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Current Term
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
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white"
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
              placeholder="e.g. B.Tech in Mechanical Engineering"
              value={progName}
              onChange={(e) => setProgName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Program Code *</label>
            <input
              required
              type="text"
              placeholder="e.g. BTECH-MECH"
              value={progCode}
              onChange={(e) => setProgCode(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 uppercase font-mono"
            />
          </div>
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
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1 bg-white"
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

      {/* Academic Year Modal */}
      <Modal isOpen={showYearModal} onClose={() => setShowYearModal(false)} title="Create Academic Year">
        <form onSubmit={handleCreateAcademicYear} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Academic Year Title *</label>
            <input
              required
              type="text"
              placeholder="e.g. 2026-2027 Academic Session"
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
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
              id="yearCurrent"
              checked={yearIsCurrent}
              onChange={(e) => setYearIsCurrent(e.target.checked)}
              className="rounded text-indigo-600"
            />
            <label htmlFor="yearCurrent" className="text-xs font-bold text-slate-700">
              Set as Institution Active Current Year
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
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
            >
              Create Academic Year
            </button>
          </div>
        </form>
      </Modal>

      {/* Section Modal */}
      <Modal isOpen={showSectionModal} onClose={() => setShowSectionModal(false)} title="Add Cohort Section">
        <form onSubmit={handleCreateSection} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Target Semester *</label>
            <select
              value={sectionSemesterId}
              onChange={(e) => setSectionSemesterId(e.target.value)}
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
            <label className="text-xs font-bold text-slate-700">Section Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Section C"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Seat Capacity</label>
            <input
              type="number"
              value={sectionCapacity}
              onChange={(e) => setSectionCapacity(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 mt-1"
            />
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
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
            >
              Create Section
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
