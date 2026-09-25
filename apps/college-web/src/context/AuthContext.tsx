import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, DEFAULT_INSTITUTION_ID } from '../lib/supabase';
import { UserRole, Profile, Faculty, Student } from '@campusattend/shared-types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  role: UserRole;
  facultyRecord: Faculty | null;
  studentRecord: Student | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginAsRole: (role: UserRole) => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error?: string; success?: boolean }>;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default seed emails mapped per role for persona authentication in ERP
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
  const [role, setRole] = useState<UserRole>('faculty');
  const [facultyRecord, setFacultyRecord] = useState<Faculty | null>(null);
  const [studentRecord, setStudentRecord] = useState<Student | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('campusattend_auth_user');
  });
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
            setIsAuthenticated(true);
            setLoading(false);
            return;
          }
        }

        // Check if an authorized demo persona was stored in local session
        const storedUser = localStorage.getItem('campusattend_auth_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            const targetEmail = parsed.email || ROLE_SEED_EMAILS[parsed.role as UserRole];
            if (targetEmail) {
              const { data: demoProf } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', targetEmail)
                .maybeSingle();

              if (mounted && demoProf) {
                await loadProfileDetails(demoProf);
                setIsAuthenticated(true);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.warn('Failed parsing stored auth persona', e);
          }
        }

        // No active session -> remain unauthenticated (renders LoginPage)
        if (mounted) {
          setIsAuthenticated(false);
          setProfile(null);
          setUser(null);
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
        if (prof) {
          await loadProfileDetails(prof);
          setIsAuthenticated(true);
        }
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // 1-Click Login as Role
  const loginAsRole = async (targetRole: UserRole) => {
    setLoading(true);
    try {
      const email = ROLE_SEED_EMAILS[targetRole];
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (prof) {
        await loadProfileDetails(prof);
        setIsAuthenticated(true);
        localStorage.setItem(
          'campusattend_auth_user',
          JSON.stringify({ role: targetRole, email, profileId: prof.id })
        );
      } else {
        // Fallback
        setRole(targetRole);
        setIsAuthenticated(true);
        localStorage.setItem('campusattend_auth_user', JSON.stringify({ role: targetRole, email }));
      }
    } finally {
      setLoading(false);
    }
  };

  // Switch role persona from navbar dropdown
  const switchRole = async (newRole: UserRole) => {
    await loginAsRole(newRole);
  };

  const signIn = async (email: string, pass: string): Promise<{ error?: string }> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        // Fallback check if email exists in database (demo seed login verification)
        const { data: fallbackProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email.trim())
          .maybeSingle();

        if (fallbackProf && pass === 'CampusPass2026!') {
          await loadProfileDetails(fallbackProf);
          setIsAuthenticated(true);
          localStorage.setItem(
            'campusattend_auth_user',
            JSON.stringify({ role: fallbackProf.role, email: fallbackProf.email, profileId: fallbackProf.id })
          );
          return {};
        }

        return { error: error.message };
      }

      if (data?.user) {
        setUser(data.user);
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (prof) {
          await loadProfileDetails(prof);
          setIsAuthenticated(true);
          localStorage.setItem(
            'campusattend_auth_user',
            JSON.stringify({ role: prof.role, email: prof.email, profileId: prof.id })
          );
        }
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
      localStorage.removeItem('campusattend_auth_user');
      setUser(null);
      setProfile(null);
      setFacultyRecord(null);
      setStudentRecord(null);
      setIsAuthenticated(false);
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
        isAuthenticated,
        loading,
        loginAsRole,
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
