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
  ShieldCheck
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: (role: UserRole) => void;
  onOpenDisplay?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onOpenDisplay }) => {
  const { loginAsRole, signIn, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [selectedRole, setSelectedRole] = useState<UserRole>('faculty');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirectorDemoSubmitting, setIsDirectorDemoSubmitting] = useState(false);

  // Real Email & Password Login
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      addToast({
        title: 'Required Fields Missing',
        message: 'Please enter both your email address and password.',
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

  // Dedicated Director Demo Login (Only Director demo preserved as requested)
  const handleDirectorDemoLogin = async () => {
    setIsDirectorDemoSubmitting(true);
    try {
      await loginAsRole('director');
      addToast({
        title: 'Director Demo Session Started',
        message: 'Welcome, Dr. Sarah Jenkins! Accessing Director Governance Portal.',
        type: 'success'
      });
      onLoginSuccess?.('director');
    } catch (err: any) {
      addToast({
        title: 'Demo Access Error',
        message: err.message || 'Could not initialize Director demo session.',
        type: 'error'
      });
    } finally {
      setIsDirectorDemoSubmitting(false);
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
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">CampusAttend OS</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                ERP v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Apex Institute of Technology &bull; Unified College Attendance & Institutional Portal
            </p>
          </div>
        </div>

        {/* Smart Board Kiosk Link */}
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
            title="Open Classroom Interactive Smart Board Display"
          >
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>Open Smart Board Screen (/display)</span>
          </button>
        </div>
      </header>

      {/* Main Body: Real Credentials Login */}
      <main className="max-w-md mx-auto w-full my-auto py-6 sm:py-10 space-y-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Card Header */}
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-3">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Institutional Sign In</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Welcome to Portal</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter your registered email address and password to sign in to your institutional workspace.
            </p>
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

          {/* Real Login Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@campusattend.edu"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-sans focus:outline-none focus:border-indigo-500 transition shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                  <span>Sign In to {selectedRole.toUpperCase()} PORTAL</span>
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
                Director Demo Option
              </span>
            </div>
          </div>

          {/* Preserved Director Demo Button (Only Director Demo Allowed) */}
          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">Director & Academic Dean</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Demo Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Explore college-wide attendance analytics, statutory reports, and teacher attendance submissions without manual sign-in.
            </p>
            <button
              type="button"
              onClick={handleDirectorDemoLogin}
              disabled={isDirectorDemoSubmitting || authLoading}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isDirectorDemoSubmitting ? 'Starting Session...' : '⚡ Launch Director Demo Console'}</span>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Secured via Zero-Trust Supabase Authentication & Role Guard</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>
          <span>CampusAttend OS &bull; Apex Institute of Technology & Science</span>
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
            <span>Classroom Smart Board (/display)</span>
          </button>
          <span>•</span>
          <span className="font-mono text-slate-400">Password-Protected Institutional Gate</span>
        </div>
      </footer>
    </div>
  );
};
