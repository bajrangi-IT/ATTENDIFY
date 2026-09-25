import React, { useState, useEffect } from 'react';
import { UserRole } from '@campusattend/shared-types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginPage } from './views/auth/LoginPage';
import { SmartDisplayView } from './views/display/SmartDisplayView';

// Views
import { TeacherDashboard } from './views/teacher/TeacherDashboard';
import { LiveSessionManager } from './views/teacher/LiveSessionManager';
import { TeacherReports } from './views/teacher/TeacherReports';
import { HodDashboard } from './views/hod/HodDashboard';
import { DirectorDashboard } from './views/director/DirectorDashboard';
import { ReportApprovalWorkflow } from './views/director/ReportApprovalWorkflow';
import { StudentDirectory } from './views/director/StudentDirectory';
import { FacultyDirectory } from './views/director/FacultyDirectory';
import { AcademicSetup } from './views/director/AcademicSetup';
import { AuditLogView } from './views/director/AuditLogView';
import { InstitutionalReportsView } from './views/director/InstitutionalReportsView';
import { DeviceKioskFleet } from './views/itadmin/DeviceKioskFleet';
import { BulkStudentImport } from './views/itadmin/BulkStudentImport';
import { TimetableManager } from './views/timetable/TimetableManager';
import { StudentDashboard } from './views/student/StudentDashboard';

const MainAppContent: React.FC = () => {
  const { role, isAuthenticated, loading, signOut } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole>(role || 'faculty');
  const [activeTab, setActiveTab] = useState<NavTab>('teacher-dashboard');

  // Direct /display route support
  const [isDisplayRoute, setIsDisplayRoute] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/display') || window.location.hash.startsWith('#/display');
  });

  const getDefaultTabForRole = (r: UserRole): NavTab => {
    switch (r) {
      case 'student':
        return 'student-portal';
      case 'faculty':
        return 'teacher-dashboard';
      case 'hod':
        return 'hod-dashboard';
      case 'director':
        return 'director-dashboard';
      case 'it_admin':
        return 'devices';
      case 'super_admin':
        return 'director-dashboard';
      default:
        return 'teacher-dashboard';
    }
  };

  // Sync internal tab & role whenever auth role changes
  useEffect(() => {
    if (role) {
      setCurrentRole(role);
      setActiveTab(getDefaultTabForRole(role));
    }
  }, [role]);

  // Support browser/phone Back Button to return to Login screen
  useEffect(() => {
    if (isAuthenticated) {
      window.history.pushState({ screen: 'dashboard' }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      // Check display route change
      if (window.location.pathname.startsWith('/display') || window.location.hash.startsWith('#/display')) {
        setIsDisplayRoute(true);
        return;
      } else {
        setIsDisplayRoute(false);
      }

      // If user was logged in and hit back, sign out and show login page
      if (isAuthenticated) {
        signOut();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, signOut]);

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setActiveTab(getDefaultTabForRole(newRole));
    // Push history state so back button returns to login
    window.history.pushState({ screen: 'dashboard' }, '');
  };

  // 1. Direct Smart Board Route (/display)
  if (isDisplayRoute) {
    return (
      <SmartDisplayView
        onBack={() => {
          window.history.pushState({}, '', '/');
          setIsDisplayRoute(false);
        }}
      />
    );
  }

  // 2. Loading Spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500 flex items-center justify-center animate-pulse mb-4 text-indigo-400">
          <span className="font-bold text-lg font-mono">CA</span>
        </div>
        <p className="text-xs text-slate-400 font-mono">Initializing CampusAttend ERP Session...</p>
      </div>
    );
  }

  // 3. Unauthenticated Gate -> Render Role-Based Login Screen
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={handleRoleChange}
        onOpenDisplay={() => {
          window.history.pushState({}, '', '/display');
          setIsDisplayRoute(true);
        }}
      />
    );
  }

  // 4. Authenticated Institutional Workspace
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onBackToLogin={() => signOut()}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentRole={currentRole} activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto h-[calc(100vh-4rem)]">
          {/* Teacher Views */}
          {activeTab === 'teacher-dashboard' && <TeacherDashboard />}
          {activeTab === 'live-session' && <LiveSessionManager />}
          {activeTab === 'teacher-reports' && <TeacherReports />}

          {/* HOD Views */}
          {activeTab === 'hod-dashboard' && <HodDashboard />}

          {/* Director & Academic Setup Views */}
          {activeTab === 'director-dashboard' && <DirectorDashboard />}
          {activeTab === 'institutional-reports' && <InstitutionalReportsView />}
          {activeTab === 'director-approvals' && <ReportApprovalWorkflow />}
          {activeTab === 'student-directory' && <StudentDirectory />}
          {activeTab === 'faculty-directory' && <FacultyDirectory />}
          {activeTab === 'academic-setup' && <AcademicSetup />}
          {activeTab === 'audit-logs' && <AuditLogView />}

          {/* IT Admin Views */}
          {activeTab === 'devices' && <DeviceKioskFleet />}
          {activeTab === 'bulk-import' && <BulkStudentImport />}

          {/* Master Timetable */}
          {activeTab === 'timetable' && <TimetableManager />}

          {/* Student Portal */}
          {activeTab === 'student-portal' && <StudentDashboard />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainAppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
