import React from 'react';
import { UserRole } from '@campusattend/shared-types';
import {
  Radio,
  BarChart3,
  Calendar,
  ClipboardList,
  MonitorCheck,
  Shield,
  Sliders,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  Users,
  Building2,
  FileCheck,
  ShieldAlert,
  Home,
  X
} from 'lucide-react';

export type NavTab =
  | 'teacher-dashboard'
  | 'live-session'
  | 'teacher-reports'
  | 'timetable'
  | 'hod-dashboard'
  | 'director-dashboard'
  | 'director-approvals'
  | 'institutional-reports'
  | 'student-directory'
  | 'faculty-directory'
  | 'academic-setup'
  | 'audit-logs'
  | 'devices'
  | 'bulk-import'
  | 'student-portal';

interface SidebarProps {
  currentRole: UserRole;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  activeTab,
  onTabChange,
  isOpenOnMobile = false,
  onCloseMobile
}) => {
  const getNavItems = () => {
    switch (currentRole) {
      case 'faculty':
        return [
          { id: 'teacher-dashboard' as NavTab, label: 'Teacher Overview', icon: Home },
          { id: 'live-session' as NavTab, label: 'Live Attendance Console', icon: Radio, badge: 'REALTIME' },
          { id: 'timetable' as NavTab, label: 'Assigned Timetable', icon: Calendar },
          { id: 'teacher-reports' as NavTab, label: 'Reports & Shortage', icon: BarChart3 },
        ];
      case 'hod':
        return [
          { id: 'hod-dashboard' as NavTab, label: 'HOD Department Console', icon: Building2, badge: 'DEPT' },
          { id: 'faculty-directory' as NavTab, label: 'Department Faculty', icon: Users },
          { id: 'live-session' as NavTab, label: 'Active Class Sessions', icon: Radio },
          { id: 'timetable' as NavTab, label: 'Department Timetable', icon: Calendar },
          { id: 'institutional-reports' as NavTab, label: 'Department Reports (Async)', icon: BarChart3, badge: 'REPORTS' },
        ];
      case 'director':
        return [
          { id: 'director-dashboard' as NavTab, label: 'Executive College Overview', icon: BarChart3, badge: 'MAC' },
          { id: 'institutional-reports' as NavTab, label: 'Institutional Reports (Async)', icon: BarChart3, badge: 'BULLMQ' },
          { id: 'director-approvals' as NavTab, label: 'Session Report Approvals', icon: FileCheck },
          { id: 'student-directory' as NavTab, label: 'Student Directory & Profiles', icon: Users },
          { id: 'faculty-directory' as NavTab, label: 'Faculty & Academic Staff', icon: Users, badge: 'STAFF' },
          { id: 'academic-setup' as NavTab, label: 'Academic Setup & Structure', icon: Building2 },
          { id: 'timetable' as NavTab, label: 'Master Campus Timetable', icon: Calendar },
          { id: 'bulk-import' as NavTab, label: 'Bulk Data Imports', icon: FileSpreadsheet },
          { id: 'audit-logs' as NavTab, label: 'Institutional Audit Trail', icon: ShieldAlert },
        ];
      case 'it_admin':
        return [
          { id: 'devices' as NavTab, label: 'Smart Displays & Kiosks', icon: MonitorCheck, badge: 'FLEET' },
          { id: 'bulk-import' as NavTab, label: 'Bulk Data Ingestion Hub', icon: FileSpreadsheet },
          { id: 'audit-logs' as NavTab, label: 'Technical Logs & Health', icon: ShieldAlert },
        ];
      case 'super_admin':
        return [
          { id: 'director-dashboard' as NavTab, label: 'Institutional Overview', icon: BarChart3 },
          { id: 'director-approvals' as NavTab, label: 'Report Review Workflow', icon: FileCheck },
          { id: 'student-directory' as NavTab, label: 'Student Directory', icon: Users },
          { id: 'faculty-directory' as NavTab, label: 'Faculty Directory', icon: Users },
          { id: 'academic-setup' as NavTab, label: 'Academic Hierarchy', icon: Building2 },
          { id: 'timetable' as NavTab, label: 'Master Timetable', icon: Calendar },
          { id: 'devices' as NavTab, label: 'Hardware Kiosks', icon: MonitorCheck },
          { id: 'bulk-import' as NavTab, label: 'Bulk Data Imports', icon: FileSpreadsheet },
          { id: 'audit-logs' as NavTab, label: 'Full Security Audit', icon: ShieldAlert },
        ];
      case 'student':
        return [
          { id: 'student-portal' as NavTab, label: 'Attendance Gauge & Portal', icon: CheckCircle2, badge: 'MY STATS' },
          { id: 'timetable' as NavTab, label: "Weekly Schedule", icon: Clock },
        ];
    }
  };

  const navItems = getNavItems();

  const renderSidebarContent = () => (
    <div className="flex flex-col justify-between h-full">
      <div className="p-4 space-y-6">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
            <span>Navigation</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-indigo-400 font-mono capitalize">
                {currentRole.replace('_', ' ')}
              </span>
              {onCloseMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                      isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-indigo-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Security & System Info Footer */}
      <div className="p-4 border-t border-slate-800 text-xs">
        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold mb-1">
            <Shield className="h-4 w-4" />
            <span className="text-[11px]">Anti-Proxy Dynamic QR</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            15-second rotating cryptographic HMAC token with timestamp drift protection.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col justify-between shrink-0 h-[calc(100vh-4rem)] select-none">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenOnMobile && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[80vw] bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {renderSidebarContent()}
          </aside>
        </div>
      )}
    </>
  );
};
