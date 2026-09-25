import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, DEFAULT_INSTITUTION_ID } from '../lib/supabase';
import { UserRole, Profile, Faculty, Student } from '@campusattend/shared-types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  role: UserRole;
  facultyRecord: Faculty | null;
  studentRecord: Student | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>;
  switchRole: (newRole: UserRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ROLE_SEED_EMAILS: Record<UserRole, string> = {
  student: 'aarav.patel@student.campusattend.edu',
  faculty: 'vikram.sharma@campusattend.edu',
  hod: 'hod.cse@campusattend.edu',
  director: 'director@campusattend.edu',
  it_admin: 'itadmin@campusattend.edu',
  super_admin: 'admin@campusattend.edu',
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>('student');
  const [facultyRecord, setFacultyRecord] = useState<Faculty | null>(null);
  const [studentRecord, setStudentRecord] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileDetails = async (prof: Profile) => {
    setProfile(prof);
    setRole(prof.role);

    if (prof.role === 'faculty' || prof.role === 'hod') {
      const { data: fac } = await supabase
        .from('faculty')
        .select('*, department:departments(*)')
        .eq('profile_id', prof.id)
        .maybeSingle();
      setFacultyRecord(fac || null);
      setStudentRecord(null);
    } else if (prof.role === 'student') {
      const { data: stud } = await supabase
        .from('students')
        .select('*, current_section:sections(*)')
        .eq('profile_id', prof.id)
        .maybeSingle();
      setStudentRecord(stud || null);
      setFacultyRecord(null);
    } else {
      setFacultyRecord(null);
      setStudentRecord(null);
    }
  };

  const refreshProfile = async () => {
    if (!profile) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle();
    if (prof) {
      await loadProfileDetails(prof);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (mounted && prof) {
            await loadProfileDetails(prof);
            setLoading(false);
            return;
          }
        }

        // Default to student persona from DB
        const { data: defaultProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', ROLE_SEED_EMAILS.student)
          .maybeSingle();

        if (mounted && defaultProf) {
          await loadProfileDetails(defaultProf);
        }
      } catch (err) {
        console.error('Mobile Auth initialization failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (prof) await loadProfileDetails(prof);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string): Promise<{ error?: string }> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) throw error;
      if (data.user) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (profErr || !prof) {
          throw new Error('Profile record not provisioned for this user.');
        }

        if (!prof.is_active) {
          await supabase.auth.signOut();
          throw new Error('Account has been deactivated. Please contact IT Administration.');
        }

        await loadProfileDetails(prof);
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (newRole: UserRole) => {
    try {
      setLoading(true);
      const targetEmail = ROLE_SEED_EMAILS[newRole];
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

      if (prof) {
        await loadProfileDetails(prof);
      }
    } catch (err) {
      console.error('Role switch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Failed to dispatch reset instructions' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setFacultyRecord(null);
    setStudentRecord(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        facultyRecord,
        studentRecord,
        loading,
        signIn,
        signOut,
        resetPassword,
        switchRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
