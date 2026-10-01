import React, { useState } from 'react';
import { UserRole } from '@campusattend/shared-types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  BookOpen,
  Building,
  KeyRound,
  Tv,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Building2,
  UserCheck,
  PlusCircle,
  CheckCircle2,
  Layers,
  MapPin,
  Phone,
  BadgeCheck
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
  onOpenDisplay?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onOpenDisplay }) => {
  const {
    loginAsRole,
    signIn,
    loading: authLoading,
    institutionsList,
    currentInstitutionId,
    switchInstitution,
    registerSchoolAndDirector
  } = useAuth();
  const { addToast } = useToast();

  // Active Main Tab: 'signin' | 'register_school'
  const [activeTab, setActiveTab] = useState<'signin' | 'register_school'>('signin');

  // Sign In Form State
  const [selectedRole, setSelectedRole] = useState<UserRole>('faculty');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    return currentInstitutionId || (institutionsList[0]?.id ?? '00000000-0000-0000-0000-000000000001');
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecutiveSubmitting, setIsExecutiveSubmitting] = useState(false);

  // School & Director Registration Form State
  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [campusAddress, setCampusAddress] = useState('SDGI Global University Campus, Delhi-NCR');
  const [departmentsInput, setDepartmentsInput] = useState('Computer Science & Engineering, Information Technology, Applied Sciences');
  const [directorFirstName, setDirectorFirstName] = useState('');
  const [directorLastName, setDirectorLastName] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorEmployeeId, setDirectorEmployeeId] = useState('');
  const [directorPassword, setDirectorPassword] = useState('CampusPass2026!');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Sync selected school id when institutionsList loads
  React.useEffect(() => {
    if (institutionsList && institutionsList.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(institutionsList[0].id);
    }
  }, [institutionsList]);

  // Handle Sign In Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      addToast({
        title: 'Required Fields Missing',
        message: 'Please enter both your institutional email address and password.',
        type: 'warning'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedSchoolId) {
        await switchInstitution(selectedSchoolId);
      }

      const res = await signIn(email.trim(), password, selectedSchoolId);
      if (res.error) {
        addToast({
          title: 'Sign In Failed',
          message: res.error,
          type: 'error'
        });
      } else {
        addToast({
          title: 'Welcome Back',
          message: 'Institutional credentials verified successfully.',
          type: 'success'
        });
        onLoginSuccess?.(selectedRole);
      }
    } catch (err: any) {
      addToast({
        title: 'Authentication Error',
        message: err.message || 'Could not complete sign in.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Executive Director Instant Verification
  const handleExecutiveDirectorLogin = async () => {
    setIsExecutiveSubmitting(true);
    try {
      if (selectedSchoolId) {
        await switchInstitution(selectedSchoolId);
      }
      await loginAsRole('director', selectedSchoolId);
      addToast({
        title: 'Director Session Active',
        message: 'Director governance portal accessed with executive authorization.',
        type: 'success'
      });
      onLoginSuccess?.('director');
    } catch (err: any) {
      addToast({
        title: 'Access Error',
        message: err.message || 'Could not verify director credentials.',
        type: 'error'
      });
    } finally {
      setIsExecutiveSubmitting(false);
    }
  };

  // Handle New School & Director Registration
  const handleRegisterSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !schoolCode.trim()) {
      addToast({
        title: 'School Information Required',
        message: 'Please provide the official School Name and Campus Code.',
        type: 'warning'
      });
      return;
    }
    if (!directorFirstName.trim() || !directorEmail.trim()) {
      addToast({
        title: 'Director Details Required',
        message: 'Please enter the Director Name and Official Academic Email.',
        type: 'warning'
      });
      return;
    }

    setIsRegistering(true);
    try {
      const depts = departmentsInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await registerSchoolAndDirector(
        {
          name: schoolName.trim(),
          code: schoolCode.trim().toUpperCase(),
          address: campusAddress.trim(),
          departments: depts
        },
        {
          firstName: directorFirstName.trim(),
          lastName: directorLastName.trim(),
          email: directorEmail.trim(),
          phone: directorPhone.trim(),
          employeeCode: directorEmployeeId.trim() || `DIR-${schoolCode.trim().toUpperCase()}-01`,
          password: directorPassword.trim()
        }
      );

      if (!res.success) {
        addToast({
          title: 'Registration Error',
          message: res.error || 'Failed to complete school registration.',
          type: 'error'
        });
      } else {
        addToast({
          title: 'Campus & Director Registered',
          message: `Welcome, Dr. ${directorFirstName}! ${schoolName} is now active in the university ERP system.`,
          type: 'success'
        });
        onLoginSuccess?.('director');
      }
    } catch (err: any) {
      addToast({
        title: 'Registration Failed',
        message: err.message || 'An error occurred during registration.',
        type: 'error'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">SDGI Global University</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                ENTERPRISE ERP
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multi-School Unified Academic ERP • Attendance, Timetables, Statutory Reporting & Campus Operations
            </p>
          </div>
        </div>

        {/* Classroom Smart Terminal Link */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              if (onOpenDisplay) {
                onOpenDisplay();
              } else {
                window.location.href = '/display';
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-bold text-indigo-300 hover:text-white flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
            title="Open Classroom Interactive Display Terminal"
          >
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>Classroom Smart Terminal (/display)</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-xl mx-auto w-full my-auto py-6 sm:py-8 space-y-6">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Main Top Tab Switcher */}
          <div className="flex p-1 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Portal Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register_school')}
              className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'register_school'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register School & Director</span>
            </button>
          </div>

          {/* TAB 1: SIGN IN */}
          {activeTab === 'signin' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-black text-white tracking-tight">Institutional Workspace Access</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select your assigned School / Campus and sign in with your institutional credentials.
                </p>
              </div>

              {/* School / Campus Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Select School / Campus
                  </span>
                  <span className="text-[10px] text-indigo-400 font-normal">
                    {institutionsList.length} Schools Registered
                  </span>
                </label>
                <div className="relative">
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => {
                      setSelectedSchoolId(e.target.value);
                      switchInstitution(e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 transition shadow-inner cursor-pointer"
                  >
                    {institutionsList.map((inst) => (
                      <option key={inst.id} value={inst.id} className="bg-slate-900 text-white">
                        {inst.name} ({inst.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role Pill Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Select Portal Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('student')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedRole === 'student'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('faculty')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedRole === 'faculty'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Faculty</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('director')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedRole === 'director'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>Director</span>
                  </button>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@sdgi.edu.in"
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-sans focus:outline-none focus:border-indigo-500 transition shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Account Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 font-sans focus:outline-none focus:border-indigo-500 transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || authLoading}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer mt-2"
                >
                  {isSubmitting || authLoading ? (
                    <span>Verifying Credentials...</span>
                  ) : (
                    <>
                      <span>SIGN IN TO {selectedRole.toUpperCase()} PORTAL</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-slate-900 px-3 text-slate-500 font-bold tracking-wider">
                    Executive Portal Access
                  </span>
                </div>
              </div>

              {/* Executive Director Access Card */}
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">Director & Academic Dean Console</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Authorized Access
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Access institutional analytics, statutory 75% attendance audits, faculty directories, and campus management reports.
                </p>
                <button
                  type="button"
                  onClick={handleExecutiveDirectorLogin}
                  disabled={isExecutiveSubmitting || authLoading}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-200" />
                  <span>{isExecutiveSubmitting ? 'Accessing Portal...' : 'Access Director Governance Console'}</span>
                </button>
              </div>

              {/* Register Callout */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-400">
                  New School or Campus Director?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register_school')}
                    className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer ml-1"
                  >
                    Register your School & Director profile &rarr;
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER SCHOOL & DIRECTOR */}
          {activeTab === 'register_school' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold mb-2">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>New Campus Onboarding</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Register School & Campus</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Onboard a new School / College / Campus under the university and establish its Director workspace.
                </p>
              </div>

              <form onSubmit={handleRegisterSchool} className="space-y-4">
                {/* School Details Section */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <Building2 className="w-4 h-4" />
                    <span>School / Institute Details</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      School / Institute Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="e.g. School of Artificial Intelligence & Robotics"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Campus / School Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        placeholder="e.g. SAIR"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white uppercase placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Campus Location / Address
                      </label>
                      <input
                        type="text"
                        value={campusAddress}
                        onChange={(e) => setCampusAddress(e.target.value)}
                        placeholder="e.g. Academic Block 4, North Campus"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Initial Departments (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={departmentsInput}
                      onChange={(e) => setDepartmentsInput(e.target.value)}
                      placeholder="e.g. Computer Science, AI & Machine Learning, Data Science"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      You can add and manage more departments, programs, and classrooms anytime in Academic Setup.
                    </p>
                  </div>
                </div>

                {/* Director Details Section */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4" />
                    <span>Director / Dean Credentials</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={directorFirstName}
                        onChange={(e) => setDirectorFirstName(e.target.value)}
                        placeholder="e.g. Rajesh"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={directorLastName}
                        onChange={(e) => setDirectorLastName(e.target.value)}
                        placeholder="e.g. Sharma"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Official Academic Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={directorEmail}
                        onChange={(e) => setDirectorEmail(e.target.value)}
                        placeholder="e.g. director.sair@sdgi.edu.in"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={directorPhone}
                        onChange={(e) => setDirectorPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Director Employee Code
                      </label>
                      <input
                        type="text"
                        value={directorEmployeeId}
                        onChange={(e) => setDirectorEmployeeId(e.target.value)}
                        placeholder="e.g. DIR-2026-005"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Portal Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          value={directorPassword}
                          onChange={(e) => setDirectorPassword(e.target.value)}
                          placeholder="Create access password"
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-3.5 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering || authLoading}
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer mt-2"
                >
                  {isRegistering ? (
                    <span>Registering School & Provisioning Workspace...</span>
                  ) : (
                    <>
                      <BadgeCheck className="w-4 h-4" />
                      <span>REGISTER SCHOOL & LAUNCH DIRECTOR WORKSPACE</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className="text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
                >
                  &larr; Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security Badge */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Secured Enterprise Single Sign-On & Academic Role Gateway</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>
          <span>SDGI Global University • Enterprise Multi-School Academic ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (onOpenDisplay) {
                onOpenDisplay();
              } else {
                window.location.href = '/display';
              }
            }}
            className="hover:text-indigo-400 font-semibold transition cursor-pointer flex items-center gap-1.5 text-slate-400"
          >
            <Tv className="w-3.5 h-3.5 text-indigo-400" />
            <span>Classroom Smart Terminal (/display)</span>
          </button>
          <span>•</span>
          <span className="text-slate-400">Official Institutional Portal</span>
        </div>
      </footer>
    </div>
  );
};
