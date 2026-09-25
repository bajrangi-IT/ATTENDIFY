import React, { useState, useEffect } from 'react';
import { UserRole } from '@campusattend/shared-types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from './ui/Modal';
import {
  GraduationCap,
  Building2,
  Bell,
  Search,
  KeyRound,
  User,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Shield,
  Clock,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onSearch?: (term: string) => void;
  onBackToLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRole, onRoleChange, onSearch, onBackToLogin }) => {
  const { profile, role, switchRole, resetPassword, updateProfile, signOut } = useAuth();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // Password reset form
  const [resetEmail, setResetEmail] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Profile edit form
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Live in-app notifications
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchLiveNotifications = async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (data && data.length > 0) {
        setLiveNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      } else {
        // Fallback to institutional announcements
        setLiveNotifications([
          {
            id: 'demo-1',
            title: 'Attendance Engine Operational',
            message: 'High-throughput dynamic QR check-in & BullMQ workers active.',
            created_at: new Date().toISOString(),
            is_read: false
          },
          {
            id: 'demo-2',
            title: 'Audit Logging Enforced',
            message: 'Immutable audit triggers active on institutional logs.',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            is_read: false
          }
        ]);
        setUnreadCount(2);
      }
    } catch (err) {
      console.error('Error loading live notifications', err);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();

    if (!profile?.id) return;
    const channel = supabase
      .channel(`user-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'in_app_notifications', filter: `recipient_id=eq.${profile.id}` },
        (payload: any) => {
          setLiveNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((c) => c + 1);
          addToast({
            title: payload.new.title || 'New Notification',
            message: payload.new.message,
            type: 'info'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleMarkAllRead = async () => {
    if (profile?.id) {
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', profile.id)
        .eq('is_read', false);
    }
    setLiveNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    addToast({ title: 'Notifications Cleared', message: 'All alerts marked as read.', type: 'info' });
  };

  const handleRoleSelect = async (newRole: UserRole) => {
    await switchRole(newRole);
    onRoleChange(newRole);
    addToast({
      title: 'Persona Switched',
      message: `Operating as ${newRole.replace('_', ' ').toUpperCase()}`,
      type: 'info'
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToReset = resetEmail.trim() || profile?.email || '';
    if (!emailToReset) return;

    try {
      setIsSubmittingReset(true);
      const res = await resetPassword(emailToReset);
      if (res.error) {
        addToast({ title: 'Reset Error', message: res.error, type: 'error' });
      } else {
        addToast({
          title: 'Reset Link Dispatched',
          message: `Instructions sent to ${emailToReset}.`,
          type: 'success'
        });
        setIsPasswordModalOpen(false);
      }
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleOpenEditProfile = () => {
    setEditFirstName(profile?.first_name || '');
    setEditLastName(profile?.last_name || '');
    setEditPhone(profile?.phone_number || '');
    setIsEditProfileModalOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      const res = await updateProfile({
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        phone_number: editPhone.trim()
      });

      if (res.error) {
        addToast({ title: 'Update Failed', message: res.error, type: 'error' });
      } else {
        addToast({ title: 'Profile Updated', message: 'Your name and contact details were saved.', type: 'success' });
        setIsEditProfileModalOpen(false);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Campus Identity */}
      <div className="flex items-center space-x-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 tracking-tight text-lg">CampusAttend OS</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              ERP v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Building2 className="h-3 w-3 text-slate-400" />
            Apex Institute of Technology & Science &bull; Odd Semester 2025-26
          </p>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Global search students, faculty, classrooms, courses..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch?.(e.target.value);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
          />
        </div>
      </div>

      {/* Role Switcher, Notifications & Profile */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Prominent Back to Login / Switch Role Button */}
        <button
          onClick={() => {
            if (onBackToLogin) {
              onBackToLogin();
            } else {
              signOut();
            }
            addToast({
              title: 'Returned to Login',
              message: 'Select another role or account.',
              type: 'info'
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition shadow-xs cursor-pointer"
          title="Sign out and return to Role Selection / Login Screen"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
          <span className="hidden sm:inline">Logout / Switch Role</span>
          <span className="sm:hidden">Logout</span>
        </button>

        {/* Role Switcher Pill */}
        <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 px-2.5 hidden sm:inline">Role:</span>
          <select
            value={currentRole}
            onChange={(e) => handleRoleSelect(e.target.value as UserRole)}
            className="bg-white text-slate-800 text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer capitalize"
          >
            <option value="faculty">Faculty (Teacher)</option>
            <option value="hod">Head of Department (HOD)</option>
            <option value="director">Director / Dean Academic</option>
            <option value="it_admin">IT Admin</option>
            <option value="super_admin">Super Administrator</option>
            <option value="student">Student Portal</option>
          </select>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">Campus Alerts</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {liveNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl border transition ${
                      !n.is_read
                        ? 'bg-indigo-50/50 border-indigo-100'
                        : 'bg-slate-50/50 border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-800 text-[11px] flex items-center gap-1.5">
                        {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 inline-block" />}
                        {n.title}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center space-x-2.5 p-1 rounded-xl hover:bg-slate-100 transition"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {profile ? profile.first_name.charAt(0) : 'U'}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {profile ? `${profile.first_name} ${profile.last_name}` : 'Logged In User'}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">
                {currentRole.replace('_', ' ')}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="font-bold text-slate-900">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-[11px] text-slate-400 truncate">{profile?.email}</p>
              </div>

              <button
                onClick={handleOpenEditProfile}
                className="w-full flex items-center space-x-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition text-left"
              >
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit Profile</span>
              </button>

              <button
                onClick={() => {
                  setResetEmail(profile?.email || '');
                  setIsPasswordModalOpen(true);
                  setIsProfileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition text-left"
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                <span>Change / Reset Password</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                onClick={() => {
                  signOut();
                  setIsProfileMenuOpen(false);
                  addToast({ title: 'Logged Out', message: 'Signed out from session.', type: 'info' });
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition text-left font-medium"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {isPasswordModalOpen && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title="Security & Password Reset"
          subtitle="Generate a secure password update token dispatched to your institutional email."
        >
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Registered Institutional Email *</label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="name@campusattend.edu"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 space-y-1">
              <div className="flex items-center space-x-1.5 text-indigo-700 font-semibold">
                <Shield className="h-4 w-4" />
                <span>Supabase Auth Security Guard</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                A cryptographic single-use reset link will be transmitted via Supabase Auth Mailer to securely update your credentials.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReset}
                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-xs transition"
              >
                {isSubmittingReset ? 'Dispatching...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileModalOpen && (
        <Modal
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          title="Edit Profile Information"
          subtitle="Update your full name and institutional contact number."
        >
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-xs transition"
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </header>
  );
};
