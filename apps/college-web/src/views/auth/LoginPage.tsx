import React, { useState } from 'react';
import { UserRole } from '@campusattend/shared-types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  BookOpen,
  Users,
  Shield,
  Server,
  KeyRound,
  Sparkles,
  Tv,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building,
  Smartphone,
  QrCode
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
    description: 'Scan classroom dynamic QR, monitor 75% attendance criteria, track timetable & leave requests.',
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
    description: 'Start live lectures, pair with Smart Board (LH-101), track real-time headcount & manual overrides.',
    highlight: 'Live Session & Smart Board'
  },
  {
    role: 'hod',
    title: 'Head of Department',
    name: 'Dr. Rajesh Kumar',
    badge: 'HOD, Computer Science',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    email: 'hod.cse@campusattend.edu',
    icon: Users,
    description: 'Monitor department-wide lectures, verify student attendance shortages & faculty allocations.',
    highlight: 'Department Analytics'
  },
  {
    role: 'director',
    title: 'Director & Academic Dean',
    name: 'Dr. Sarah Jenkins',
    badge: 'Institutional Director',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    email: 'director@campusattend.edu',
    icon: Building,
    description: 'Institution-wide metrics, review and approve session reports, directory audits & governance.',
    highlight: 'Governance & Approvals'
  },
  {
    role: 'it_admin',
    title: 'IT Systems Admin',
    name: 'Alex Morgan',
    badge: 'Kiosk & Fleet Admin',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    email: 'itadmin@campusattend.edu',
    icon: Server,
    description: 'Manage classroom smart board fleet, rotate pairing codes (PAIR99), bulk student CSV imports.',
    highlight: 'Kiosk Fleet & Pairing'
  },
  {
    role: 'super_admin',
    title: 'Super Administrator',
    name: 'Apex Institutional Admin',
    badge: 'Root Access',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    email: 'admin@campusattend.edu',
    icon: Shield,
    description: 'Comprehensive campus configuration, system-wide audit trail logs & security enforcement.',
    highlight: 'Full ERP Control'
  }
];

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { loginAsRole, signIn, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [selectedRole, setSelectedRole] = useState<UserRole>('faculty');
  const [email, setEmail] = useState('vikram.sharma@campusattend.edu');
  const [password, setPassword] = useState('CampusPass2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">CampusAttend OS</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                ERP v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Apex Institute of Technology &bull; Single-Port 24/7 Unified College Architecture
            </p>
          </div>
        </div>

        {/* Smart Board & Mobile Kiosk Links */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/mobile"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-2 transition shadow-sm"
          >
            <Smartphone className="w-4 h-4 text-indigo-400" />
            <span>Expo Go Mobile QR (/mobile)</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
          </a>
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-2 transition shadow-sm"
          >
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>Open Smart Board (/display)</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Port 3000 Online
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full my-auto py-8">
        {/* Banner: Demo Lecture Quick Instructions */}
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎯 Live Demo Classroom Ready:</span>
                <span className="font-mono text-indigo-400">Room LH-101 (Pairing Code: PAIR99)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Faculty starts session on phone/web &rarr; Board on <span className="font-mono text-indigo-300">/display</span> displays dynamic rotating QR &rarr; Students scan on phone to mark attendance in real time!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleInstantDemoLogin('faculty')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
            >
              Start as Faculty (Dr. Vikram)
            </button>
            <button
              onClick={() => handleInstantDemoLogin('student')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
            >
              Scan as Student (Aarav)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 6 Interactive Role Cards (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Select Your Role to Login
                </h2>
                <p className="text-xs text-slate-400">
                  Click any role card below for 1-click instant demo login or pre-fill institutional credentials:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ROLE_CARDS.map((card) => {
                const IconComponent = card.icon;
                const isSelected = selectedRole === card.role;

                return (
                  <div
                    key={card.role}
                    onClick={() => handleSelectRole(card.role)}
                    className={`relative p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                        : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Role Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-sm leading-tight">{card.title}</h3>
                            <span className="text-[11px] text-slate-400 font-medium">{card.name}</span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.badgeColor}`}
                        >
                          {card.highlight}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">
                        {card.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500 truncate">{card.email}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstantDemoLogin(card.role);
                        }}
                        disabled={isSubmitting || authLoading}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        ⚡ 1-Click Login
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sign In Credentials Form (4 Cols) */}
          <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
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
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] text-slate-500">Seed password: CampusPass2026!</span>
                  <span className="text-[10px] text-indigo-400 font-semibold cursor-pointer">Default</span>
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

            {/* Quick Demo One-Click Callout */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <p className="text-[11px] text-slate-400 text-center font-medium">
                Testing quickly? Use 1-click login:
              </p>
              <button
                type="button"
                onClick={() => handleInstantDemoLogin(selectedRole)}
                disabled={isSubmitting || authLoading}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <span>⚡ Instant Login as {selectedRole.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>
          <span>CampusAttend OS • Enterprise College ERP & Attendance Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/display" className="hover:text-slate-300 transition">Smart Board Kiosk</a>
          <span>•</span>
          <span className="font-mono text-slate-400">All Roles Synced 24x7</span>
        </div>
      </footer>
    </div>
  );
};
