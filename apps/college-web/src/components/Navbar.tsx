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
  ArrowLeft,
  Menu,
  PlusCircle,
  Check
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onSearch?: (term: string) => void;
  onBackToLogin?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  onSearch,
  onBackToLogin,
  onToggleMobileMenu
}) => {
  const {
    profile,
    role,
    institution,
    resetPassword,
    updateProfile,
    signOut,
    institutionsList,
    switchInstitution,
    currentInstitutionId,
    registerSchoolAndDirector
  } = useAuth();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isSchoolMenuOpen, setIsSchoolMenuOpen] = useState(false);
  const [isRegisterSchoolModalOpen, setIsRegisterSchoolModalOpen] = useState(false);

  // New School Modal state
  const [modalSchoolName, setModalSchoolName] = useState('');
  const [modalSchoolCode, setModalSchoolCode] = useState('');
  const [modalCampusAddress, setModalCampusAddress] = useState('SDGI Global University Campus');
  const [modalDepartments, setModalDepartments] = useState('Computer Science, Management, Applied Sciences');
  const [modalDirectorFirst, setModalDirectorFirst] = useState('');
  const [modalDirectorLast, setModalDirectorLast] = useState('');
  const [modalDirectorEmail, setModalDirectorEmail] = useState('');
  const [modalDirectorPhone, setModalDirectorPhone] = useState('');
  const [isSavingSchool, setIsSavingSchool] = useState(false);

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
            id: 'announcement-1',
            title: 'Attendance System Online',
            message: 'Campus attendance tracking and verification system is active.',
            created_at: new Date().toISOString(),
            is_read: false
          },
          {
            id: 'announcement-2',
            title: 'Academic Term Active',
            message: 'Current semester schedule and student enrollment are in sync.',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            is_read: false
          }
        ]);
        setUnreadCount(0);
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

  const handleModalRegisterSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSchoolName.trim() || !modalSchoolCode.trim()) {
      addToast({
        title: 'Missing Required Fields',
        message: 'School Name and Campus Code are required.',
        type: 'warning'
      });
      return;
    }
    if (!modalDirectorFirst.trim() || !modalDirectorEmail.trim()) {
      addToast({
        title: 'Missing Director Information',
        message: 'Director name and institutional email are required.',
        type: 'warning'
      });
      return;
    }

    setIsSavingSchool(true);
    try {
      const depts = modalDepartments.split(',').map((d) => d.trim()).filter(Boolean);
      const res = await registerSchoolAndDirector(
        {
          name: modalSchoolName.trim(),
          code: modalSchoolCode.trim().toUpperCase(),
          address: modalCampusAddress.trim(),
          departments: depts
        },
        {
          firstName: modalDirectorFirst.trim(),
          lastName: modalDirectorLast.trim(),
          email: modalDirectorEmail.trim(),
          phone: modalDirectorPhone.trim(),
          employeeCode: `DIR-${modalSchoolCode.trim().toUpperCase()}-01`,
          password: 'CampusPass2026!'
        }
      );

      if (!res.success) {
        addToast({ title: 'Registration Failed', message: res.error || 'Failed to register school.', type: 'error' });
      } else {
        addToast({
          title: 'Campus Registered Successfully',
          message: `${modalSchoolName} registered and active in ERP system.`,
          type: 'success'
        });
        setIsRegisterSchoolModalOpen(false);
        // Clear form
        setModalSchoolName('');
        setModalSchoolCode('');
        setModalDirectorFirst('');
        setModalDirectorLast('');
        setModalDirectorEmail('');
        setModalDirectorPhone('');
      }
    } finally {
      setIsSavingSchool(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Campus Identity */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Toggle Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
          <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-black text-slate-900 tracking-tight text-sm sm:text-lg">SDGI Global University</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              ERP
            </span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSchoolMenuOpen(!isSchoolMenuOpen)}
              className="text-[11px] text-slate-600 hover:text-indigo-600 font-medium hidden sm:flex items-center gap-1.5 transition cursor-pointer hover:bg-slate-100 px-1.5 py-0.5 rounded-lg -ml-1"
              title="Click to switch School / Campus or register a new campus"
            >
              <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[240px] font-semibold text-slate-800">
                {institution?.name || 'School of Engineering & Technology'}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isSchoolMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSchoolMenuOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Campuses & Schools ({institutionsList.length})
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">Active Scope</span>
                </div>
                <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                  {institutionsList.map((inst) => {
                    const isSelected = inst.id === (institution?.id || currentInstitutionId);
                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={async () => {
                          await switchInstitution(inst.id);
                          setIsSchoolMenuOpen(false);
                          addToast({
                            title: 'Campus Context Switched',
                            message: `Now viewing ${inst.name} (${inst.code})`,
                            type: 'info'
                          });
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                          isSelected ? 'bg-indigo-50/80 text-indigo-950 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate font-semibold">{inst.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{inst.code} • {inst.address ? inst.address.slice(0, 30) + '...' : 'Main Campus'}</div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="p-1 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSchoolMenuOpen(false);
                      setIsRegisterSchoolModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>+ Register New School / Campus</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Search Bar (Desktop only) */}
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

      {/* Role Display, Notifications & Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-3">
        {/* Logout Button */}
        <button
          onClick={() => {
            if (onBackToLogin) {
              onBackToLogin();
            } else {
              signOut();
            }
            addToast({
              title: 'Logged Out',
              message: 'Session closed successfully.',
              type: 'info'
            });
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
          <span className="hidden sm:inline">Logout</span>
          <span className="sm:hidden text-[11px]">Logout</span>
        </button>

        {/* Read-Only Role Display (NO Dropdown, No Role Switch) */}
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl py-1 px-2.5 sm:px-3 border border-slate-200 shadow-2xs">
          <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Role:</span>
          <span className="text-xs font-bold text-slate-800 capitalize tracking-tight">
            {role === 'director'
              ? 'Director'
              : role === 'faculty'
              ? 'Faculty'
              : role === 'student'
              ? 'Student'
              : role === 'hod'
              ? 'HOD'
              : role === 'it_admin'
              ? 'IT Admin'
              : role === 'super_admin'
              ? 'Super Admin'
              : (role || currentRole)}
          </span>
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

      {/* Register New School & Campus Modal */}
      {isRegisterSchoolModalOpen && (
        <Modal
          isOpen={isRegisterSchoolModalOpen}
          onClose={() => setIsRegisterSchoolModalOpen(false)}
          title="Register New School / Campus & Director"
        >
          <form onSubmit={handleModalRegisterSchool} className="space-y-4 text-xs">
            <p className="text-slate-500 text-[11px]">
              Onboard a new School or Campus under SDGI Global University and establish its Director workspace.
            </p>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <span className="font-bold text-indigo-900 block text-xs">School Details</span>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">School / Institute Name *</label>
                <input
                  type="text"
                  required
                  value={modalSchoolName}
                  onChange={(e) => setModalSchoolName(e.target.value)}
                  placeholder="e.g. School of Artificial Intelligence & Robotics"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Campus Code *</label>
                  <input
                    type="text"
                    required
                    value={modalSchoolCode}
                    onChange={(e) => setModalSchoolCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SAIR"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Campus Location</label>
                  <input
                    type="text"
                    value={modalCampusAddress}
                    onChange={(e) => setModalCampusAddress(e.target.value)}
                    placeholder="e.g. Technology Block, Delhi-NCR"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Departments (Comma-separated)</label>
                <input
                  type="text"
                  value={modalDepartments}
                  onChange={(e) => setModalDepartments(e.target.value)}
                  placeholder="e.g. Computer Science, AI & Machine Learning, Data Science"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3">
              <span className="font-bold text-purple-900 block text-xs">Director & Dean Credentials</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={modalDirectorFirst}
                    onChange={(e) => setModalDirectorFirst(e.target.value)}
                    placeholder="Dr. Rajesh"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Last Name</label>
                  <input
                    type="text"
                    value={modalDirectorLast}
                    onChange={(e) => setModalDirectorLast(e.target.value)}
                    placeholder="Sharma"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Academic Email *</label>
                  <input
                    type="email"
                    required
                    value={modalDirectorEmail}
                    onChange={(e) => setModalDirectorEmail(e.target.value)}
                    placeholder="director.sair@sdgi.edu.in"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={modalDirectorPhone}
                    onChange={(e) => setModalDirectorPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRegisterSchoolModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSchool}
                className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 font-bold rounded-xl shadow-xs transition"
              >
                {isSavingSchool ? 'Registering School...' : 'Register School & Campus'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </header>
  );
};
