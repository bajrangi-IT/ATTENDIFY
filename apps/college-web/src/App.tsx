import React, { useState } from 'react';
import { UserRole } from '@campusattend/shared-types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';

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
  const { role } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole>('faculty');
  const [activeTab, setActiveTab] = useState<NavTab>('teacher-dashboard');

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    switch (newRole) {
      case 'faculty':
        setActiveTab('teacher-dashboard');
        break;
      case 'hod':
        setActiveTab('hod-dashboard');
        break;
      case 'director':
        setActiveTab('director-dashboard');
        break;
      case 'it_admin':
        setActiveTab('devices');
        break;
      case 'super_admin':
        setActiveTab('director-dashboard');
        break;
      case 'student':
        setActiveTab('student-portal');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar currentRole={currentRole} onRoleChange={handleRoleChange} />
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
