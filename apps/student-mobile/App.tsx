import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { Header } from './src/components/common/Header';
import { BottomTabBar } from './src/components/navigation/BottomTabBar';
import { Card } from './src/components/common/Card';
import { Badge } from './src/components/common/Badge';
import { Button } from './src/components/common/Button';

// Screens
import { LoginScreen } from './src/views/auth/LoginScreen';
import { StudentHomeScreen } from './src/views/student/StudentHomeScreen';
import { StudentScannerScreen } from './src/views/student/StudentScannerScreen';
import { StudentTimetableScreen } from './src/views/student/StudentTimetableScreen';
import { StudentHistoryScreen } from './src/views/student/StudentHistoryScreen';
import { StudentLeavesScreen } from './src/views/student/StudentLeavesScreen';
import { StudentProfileScreen } from './src/views/student/StudentProfileScreen';

import { FacultyHomeScreen } from './src/views/faculty/FacultyHomeScreen';
import { FacultyLiveSessionScreen } from './src/views/faculty/FacultyLiveSessionScreen';
import { FacultyReportsScreen } from './src/views/faculty/FacultyReportsScreen';

import { DirectorHomeScreen } from './src/views/director/DirectorHomeScreen';
import { DirectorApprovalsScreen } from './src/views/director/DirectorApprovalsScreen';
import { DirectorStudentsScreen } from './src/views/director/DirectorStudentsScreen';
import { DirectorAuditScreen } from './src/views/director/DirectorAuditScreen';

import { ItAdminDevicesScreen } from './src/views/itadmin/ItAdminDevicesScreen';
import { ItAdminHealthScreen } from './src/views/itadmin/ItAdminHealthScreen';

const MainAppNavigator: React.FC = () => {
  const { profile, role, loading } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  if (!profile && !loading) {
    return <LoginScreen />;
  }

  // Header Title formatting
  const getHeaderTitle = () => {
    switch (role) {
      case 'student':
        if (activeTab === 'home') return 'My Attendance';
        if (activeTab === 'scan') return 'Camera Scanner';
        if (activeTab === 'timetable') return 'Class Timetable';
        if (activeTab === 'history') return 'Attendance Log';
        if (activeTab === 'leaves') return 'Leave Requests';
        return 'Student Portal';
      case 'faculty':
        if (activeTab === 'home') return 'Faculty Schedule';
        if (activeTab === 'session') return 'Live Lecture Console';
        if (activeTab === 'timetable') return 'Assigned Timetable';
        if (activeTab === 'reports') return 'Attendance Shortage';
        return 'Faculty Portal';
      case 'hod':
        if (activeTab === 'home') return 'Department Monitor';
        if (activeTab === 'session') return 'Active Lectures';
        if (activeTab === 'timetable') return 'Dept Faculty';
        if (activeTab === 'reports') return 'Leave Approvals';
        return 'HOD Console';
      case 'director':
        if (activeTab === 'home') return 'Institution Overview';
        if (activeTab === 'approvals') return 'Report Approvals';
        if (activeTab === 'students') return 'Student Directory';
        if (activeTab === 'audit') return 'Audit & Security';
        return 'Director Console';
      case 'it_admin':
      case 'super_admin':
        if (activeTab === 'devices') return 'Display Kiosk Fleet';
        if (activeTab === 'health') return 'System Telemetry';
        if (activeTab === 'audit') return 'Technical Logs';
        return 'IT Administration';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Mobile Top Header */}
      <Header
        title={getHeaderTitle()}
        subtitle={`Apex Institute • ${role.replace('_', ' ').toUpperCase()}`}
        onNotificationsPress={() => setIsNotificationsModalOpen(true)}
        onProfilePress={() => setIsProfileModalOpen(true)}
      />

      {/* Role-Authorized Screen Content */}
      <View style={styles.mainContent}>
        {/* STUDENT SCREENS */}
        {role === 'student' && (
          <>
            {activeTab === 'home' && (
              <StudentHomeScreen
                onNavigateToScan={() => setActiveTab('scan')}
                onNavigateToTimetable={() => setActiveTab('timetable')}
              />
            )}
            {activeTab === 'scan' && (
              <StudentScannerScreen
                onCheckinSuccess={() => setActiveTab('home')}
              />
            )}
            {activeTab === 'timetable' && <StudentTimetableScreen />}
            {activeTab === 'history' && <StudentHistoryScreen />}
            {activeTab === 'leaves' && <StudentLeavesScreen />}
          </>
        )}

        {/* FACULTY SCREENS */}
        {role === 'faculty' && (
          <>
            {activeTab === 'home' && (
              <FacultyHomeScreen
                onNavigateToLiveSession={(sessId) => {
                  setSelectedSessionId(sessId);
                  setActiveTab('session');
                }}
                onNavigateToTimetable={() => setActiveTab('timetable')}
                onNavigateToReports={() => setActiveTab('reports')}
              />
            )}
            {activeTab === 'session' && (
              <FacultyLiveSessionScreen
                sessionId={selectedSessionId}
                onSessionEnded={() => {
                  setSelectedSessionId(undefined);
                  setActiveTab('home');
                }}
              />
            )}
            {activeTab === 'timetable' && <StudentTimetableScreen />}
            {activeTab === 'reports' && <FacultyReportsScreen />}
          </>
        )}

        {/* HOD SCREENS */}
        {role === 'hod' && (
          <>
            {activeTab === 'home' && (
              <DirectorHomeScreen
                onNavigateToApprovals={() => setActiveTab('reports')}
                onNavigateToStudents={() => setActiveTab('timetable')}
              />
            )}
            {activeTab === 'session' && (
              <FacultyLiveSessionScreen
                sessionId={selectedSessionId}
                onSessionEnded={() => setActiveTab('home')}
              />
            )}
            {activeTab === 'timetable' && <StudentTimetableScreen />}
            {activeTab === 'reports' && <FacultyReportsScreen />}
          </>
        )}

        {/* DIRECTOR SCREENS */}
        {role === 'director' && (
          <>
            {activeTab === 'home' && (
              <DirectorHomeScreen
                onNavigateToApprovals={() => setActiveTab('approvals')}
                onNavigateToStudents={() => setActiveTab('students')}
              />
            )}
            {activeTab === 'approvals' && <DirectorApprovalsScreen />}
            {activeTab === 'students' && <DirectorStudentsScreen />}
            {activeTab === 'audit' && <DirectorAuditScreen />}
          </>
        )}

        {/* IT ADMIN SCREENS */}
        {(role === 'it_admin' || role === 'super_admin') && (
          <>
            {activeTab === 'devices' && <ItAdminDevicesScreen />}
            {activeTab === 'health' && <ItAdminHealthScreen />}
            {activeTab === 'audit' && <DirectorAuditScreen />}
          </>
        )}
      </View>

      {/* Role-Scoped Bottom Tab Navigation */}
      <BottomTabBar
        role={role}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Notifications Drawer Modal */}
      {isNotificationsModalOpen && (
        <Modal
          visible={isNotificationsModalOpen}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsNotificationsModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Institutional Alerts</Text>
                  <Text style={styles.sheetSubtitle}>{unreadCount} Unread Notifications</Text>
                </View>
                <TouchableOpacity onPress={markAllAsRead}>
                  <Text style={styles.markReadText}>Mark All Read</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.notifScroll}>
                {notifications.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => markAsRead(item.id)}
                    style={[styles.notifItem, !item.read && styles.notifItemUnread]}
                  >
                    <View style={styles.notifTop}>
                      <Text style={styles.notifTitle}>{item.title}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.notifMessage}>{item.message}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Button
                title="Close"
                variant="secondary"
                onPress={() => setIsNotificationsModalOpen(false)}
                style={styles.closeBtn}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Profile & Persona Switcher Modal */}
      {isProfileModalOpen && (
        <Modal
          visible={isProfileModalOpen}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsProfileModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.profileSheet}>
              <View style={styles.profileSheetHeader}>
                <Text style={styles.profileSheetTitle}>My Institutional Account</Text>
                <TouchableOpacity onPress={() => setIsProfileModalOpen(false)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <StudentProfileScreen />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainAppNavigator />
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  notifScroll: {
    marginBottom: 16,
  },
  notifItem: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notifItemUnread: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  notifTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  notifTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  notifMessage: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  closeBtn: {
    marginTop: 8,
  },
  profileSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
  },
  profileSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profileSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
  },
});
