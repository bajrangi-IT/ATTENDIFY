import React, { useState } from 'react';
import { UserRole } from '@campusattend/shared-types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  BookOpen,
  Building,
  KeyRound,
  Sparkles,
  Tv,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react';

interface RoleCard {
  role: UserRole;
  title: string;
  name: string;
  badge: string;
  badgeColor: string;
  email: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  highlight: string;
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: 'student',
    title: 'Student Portal',
    name: 'Aarav Patel',
    badge: '3rd Year B.Tech CSE',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    email: 'aarav.patel@student.campusattend.edu',
    icon: GraduationCap,
    description: 'Scan classroom dynamic QR on phone/web, monitor attendance criteria, view timetable & lecture records.',
    highlight: 'Phone & Web QR Scanner'
  },
  {
    role: 'faculty',
    title: 'Faculty Portal',
    name: 'Dr. Vikram Sharma',
    badge: 'Associate Professor, CSE',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    email: 'vikram.sharma@campusattend.edu',
    icon: BookOpen,
    description: 'Start live lectures, get classroom Pairing Code (PAIR99), track real-time headcount & end sessions.',
    highlight: 'Live Session & Smart Board'
  },
  {
    role: 'director',
    title: 'Director & Academic Dean',
    name: 'Dr. Sarah Jenkins',
    badge: 'Institutional Director',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    email: 'director@campusattend.edu',
    icon: Building,
    description: 'Institution-wide metrics, review and approve lecture session reports with full student attendance rosters.',
    highlight: 'Governance & Approvals'
  }
];

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
  onOpenDisplay?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onOpenDisplay }) => {
  const { loginAsRole, signIn, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [selectedRole, setSelectedRole] = useState<UserRole>('faculty');
  const [email, setEmail] = useState('vikram.sharma@campusattend.edu');
  const [password, setPassword] = useState('CampusPass2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeAuthTab, setActiveAuthTab] = useState<'quick-roles' | 'credentials'>('quick-roles');

  const handleSelectRole = (r: UserRole) => {
    setSelectedRole(r);
    const card = ROLE_CARDS.find((c) => c.role === r);
    if (card) {
      setEmail(card.email);
    }
  };

  const handleInstantDemoLogin = async (roleToLogin: UserRole) => {
    setIsSubmitting(true);
    try {
      await loginAsRole(roleToLogin);
      const card = ROLE_CARDS.find((c) => c.role === roleToLogin);
      addToast({
        title: 'Logged In Successfully',
        message: `Welcome, ${card?.name || roleToLogin.toUpperCase()}! Entering ${card?.title}.`,
        type: 'success'
      });
      onLoginSuccess?.(roleToLogin);
    } catch (err: any) {
      addToast({
        title: 'Login Error',
        message: err.message || 'Could not authenticate demo user',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      addToast({
        title: 'Missing Fields',
        message: 'Please provide both email address and password.',
        type: 'warning'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (res.error) {
        addToast({
          title: 'Sign In Failed',
          message: res.error,
          type: 'error'
        });
      } else {
        addToast({
          title: 'Welcome Back',
          message: 'Institutional authentication verified.',
          type: 'success'
        });
        onLoginSuccess?.(selectedRole);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">CampusAttend OS</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                ERP v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Apex Institute of Technology &bull; Single-Port 24/7 Unified College Architecture
            </p>
          </div>
        </div>

        {/* Smart Board Link */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
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
            title="Open Classroom Interactive Smart Board Display"
          >
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>Open Smart Board (/display)</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full my-auto py-6 sm:py-8">
        {/* Banner: Demo Lecture Quick Instructions */}
        <div className="mb-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <span className="text-xs font-bold text-white">Live Classroom Ready: </span>
              <span className="text-xs font-mono text-indigo-300 font-semibold">Room LH-101 (Pairing Code: PAIR99)</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Faculty starts lecture &rarr; Dynamic QR rotates on /display &rarr; Students scan live.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleInstantDemoLogin('faculty')}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Faculty Demo
            </button>
            <button
              onClick={() => handleInstantDemoLogin('student')}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Student Scanner Demo
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex justify-center mb-6">
          <div className="p-1 bg-slate-900 border border-slate-800 rounded-2xl inline-flex gap-1 shadow-lg">
            <button
              type="button"
              onClick={() => setActiveAuthTab('quick-roles')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeAuthTab === 'quick-roles'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>⚡ 1-Click Role Access (Instant)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAuthTab('credentials')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeAuthTab === 'credentials'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>🔑 Institutional Sign In (SSO)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: SPACIOUS 1-CLICK ROLE ACCESS */}
        {activeAuthTab === 'quick-roles' && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto mb-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Select Your Role to Enter
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Choose any role below for instant 1-click access with pre-configured institutional permissions:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {ROLE_CARDS.map((card) => {
                const IconComponent = card.icon;
                const isSelected = selectedRole === card.role;

                return (
                  <div
                    key={card.role}
                    onClick={() => handleInstantDemoLogin(card.role)}
                    className="group relative p-5 sm:p-6 rounded-3xl border bg-slate-900/70 border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex justify-between items-start mb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
                              {card.title}
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">{card.name}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${card.badgeColor}`}>
                          {card.highlight}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        {card.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500 truncate max-w-[160px]">
                        {card.email}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstantDemoLogin(card.role);
                        }}
                        disabled={isSubmitting || authLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <span>⚡ 1-Click Login</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setActiveAuthTab('credentials')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4 cursor-pointer"
              >
                Prefer to sign in with email and password? Switch to Credentials Sign In &rarr;
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CENTERED INSTITUTIONAL CREDENTIALS LOGIN */}
        {activeAuthTab === 'credentials' && (
          <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-3">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Single Sign-On (SSO)</span>
              </div>
              <h2 className="text-xl font-black text-white">Institutional Sign In</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter credentials for <span className="font-bold text-white capitalize">{selectedRole.replace('_', ' ')}</span>
              </p>
            </div>

            {/* Role Switcher Pills */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Select Persona
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['student', 'faculty', 'director'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold capitalize transition truncate cursor-pointer ${
                      selectedRole === r
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Institutional Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@campusattend.edu"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 transition"
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
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-500">
                  <span>Seed password: CampusPass2026!</span>
                  <span onClick={() => setPassword('CampusPass2026!')} className="text-indigo-400 font-semibold cursor-pointer hover:underline">Autofill</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to {selectedRole.replace('_', ' ').toUpperCase()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setActiveAuthTab('quick-roles')}
                className="text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to 1-Click Role Access</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>
          <span>CampusAttend OS • Enterprise College ERP & Attendance Engine</span>
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
            <span>Open Smart Board Kiosk (/display)</span>
          </button>
          <span>•</span>
          <span className="font-mono text-slate-400">Student • Faculty • Director Unified System</span>
        </div>
      </footer>
    </div>
  );
};
