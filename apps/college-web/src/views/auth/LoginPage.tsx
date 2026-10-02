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

      const res = await signIn(email.trim(), password, selectedSchoolId, selectedRole);
      if (res.error) {
        addToast({
          title: 'Sign In Failed',
          message: res.error,
          type: 'error'
        });
        return;
      } else {
        addToast({
          title: 'Welcome Back',
          message: 'Institutional credentials verified successfully.',
          type: 'success'
        });
        onLoginSuccess?.(res.profile?.role || selectedRole);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header Bar */}
      <header className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Attendify</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                ERP
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              SDGI Global University • Campus Academic Portal
            </p>
          </div>
        </div>

        {/* Classroom Smart Terminal Link */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              if (onOpenDisplay) {
                onOpenDisplay();
              } else {
                window.location.href = '/display';
              }
            }}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition shadow-2xs cursor-pointer"
            title="Open Classroom Interactive Display Terminal"
          >
            <Tv className="w-4 h-4 text-indigo-600" />
            <span>Classroom Display (/display)</span>
          </button>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-md mx-auto w-full my-auto py-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-lg shadow-slate-200/50 space-y-5">
          {/* Main Top Tab Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register_school')}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'register_school'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Register School</span>
            </button>
          </div>

          {/* TAB 1: SIGN IN */}
          {activeTab === 'signin' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sign In to Portal</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your school / campus and enter your credentials.
                </p>
              </div>

              {/* School / Campus Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    School / Campus
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {institutionsList.length} Schools
                  </span>
                </label>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => {
                    setSelectedSchoolId(e.target.value);
                    switchInstitution(e.target.value);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition cursor-pointer"
                >
                  {institutionsList.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.code === 'SOET' ? 'SET' : inst.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Role
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('student')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'student'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('faculty')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'faculty'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Faculty</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('director')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'director'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5 text-purple-600" />
                    <span>Director</span>
                  </button>
                </div>
              </div>

              {/* Sign In Form */}
              <form onSubmit={handleFormSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. director.set@sdgi.edu.in"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || authLoading}
                  className="w-full py-2.5 mt-1 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting || authLoading ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <span>Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Register Callout */}
              <div className="text-center pt-1">
                <p className="text-xs text-slate-500">
                  New campus director?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register_school')}
                    className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer ml-0.5"
                  >
                    Register new School & Director &rarr;
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER SCHOOL & DIRECTOR */}
          {activeTab === 'register_school' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Register School / Campus</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up a new constituent school and director profile.
                </p>
              </div>

              <form onSubmit={handleRegisterSchool} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    School / Institute Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. School of Engineering & Technology"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      School Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SET"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 uppercase font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Campus Location
                    </label>
                    <input
                      type="text"
                      value={campusAddress}
                      onChange={(e) => setCampusAddress(e.target.value)}
                      placeholder="e.g. Main Campus, NH-24"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Departments (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={departmentsInput}
                    onChange={(e) => setDepartmentsInput(e.target.value)}
                    placeholder="e.g. Computer Science, Mechanical Engineering, Civil Engineering"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-800 mb-2">Director Information</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={directorFirstName}
                        onChange={(e) => setDirectorFirstName(e.target.value)}
                        placeholder="e.g. Rajesh"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={directorLastName}
                        onChange={(e) => setDirectorLastName(e.target.value)}
                        placeholder="e.g. Sharma"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Official Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={directorEmail}
                      onChange={(e) => setDirectorEmail(e.target.value)}
                      placeholder="director.set@sdgi.edu.in"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={directorPhone}
                      onChange={(e) => setDirectorPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={directorPassword}
                      onChange={(e) => setDirectorPassword(e.target.value)}
                      placeholder="Account password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering || authLoading}
                  className="w-full py-2.5 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isRegistering ? (
                    <span>Registering School...</span>
                  ) : (
                    <>
                      <BadgeCheck className="w-4 h-4 text-emerald-400" />
                      <span>Register School & Launch Director Profile</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  &larr; Back to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
        <div>
          <span>Attendify • SDGI Global University ERP</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onOpenDisplay) {
                onOpenDisplay();
              } else {
                window.location.href = '/display';
              }
            }}
            className="hover:text-indigo-600 font-medium transition cursor-pointer flex items-center gap-1.5 text-slate-600"
          >
            <Tv className="w-3.5 h-3.5 text-indigo-600" />
            <span>Classroom Display (/display)</span>
          </button>
          <span>•</span>
          <span className="text-slate-400">Institutional Portal</span>
        </div>
      </footer>
    </div>
  );
};
