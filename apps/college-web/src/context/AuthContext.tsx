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
  updateProfile: (data: Partial<Profile>) => Promise<{ error?: string; success?: boolean }>;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default seed emails mapped per role for seamless persona switching in ERP
const ROLE_SEED_EMAILS: Record<UserRole, string> = {
  faculty: 'vikram.sharma@campusattend.edu',
  hod: 'hod.cse@campusattend.edu',
  director: 'director@campusattend.edu',
  it_admin: 'itadmin@campusattend.edu',
  super_admin: 'admin@campusattend.edu',
  student: 'aarav.patel@student.campusattend.edu',
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>('faculty');
  const [facultyRecord, setFacultyRecord] = useState<Faculty | null>(null);
  const [studentRecord, setStudentRecord] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch full details for a profile
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

  // Initial load
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

        // If no active auth session, default to demo faculty profile from DB
        const { data: defaultProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', ROLE_SEED_EMAILS.faculty)
          .maybeSingle();

        if (mounted && defaultProf) {
          await loadProfileDetails(defaultProf);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (prof) await loadProfileDetails(prof);
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Switch role persona by fetching corresponding profile from database
  const switchRole = async (newRole: UserRole) => {
    setLoading(true);
    try {
      const email = ROLE_SEED_EMAILS[newRole];
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (prof) {
        await loadProfileDetails(prof);
      } else {
        // Fallback role update
        setRole(newRole);
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, pass: string): Promise<{ error?: string }> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        return { error: error.message };
      }

      if (data?.user) {
        setUser(data.user);
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (prof) await loadProfileDetails(prof);
      }

      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      // Reset to default faculty demo profile
      await switchRole('faculty');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) return { error: error.message };
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!profile) return { error: 'No active profile' };
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number,
          avatar_url: data.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) return { error: error.message };

      setProfile((prev) => (prev ? { ...prev, ...data } : null));
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
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
        updateProfile,
        switchRole,
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
