import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { UserRole } from '@campusattend/shared-types';

export interface TabItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
}

interface BottomTabBarProps {
  role: UserRole;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  role,
  activeTab,
  onSelectTab,
}) => {
  const getTabsForRole = (): TabItem[] => {
    switch (role) {
      case 'student':
        return [
          { id: 'home', label: 'Overview', icon: '📊' },
          { id: 'scan', label: 'Scan QR', icon: '📷' },
          { id: 'timetable', label: 'Schedule', icon: '📅' },
          { id: 'history', label: 'History', icon: '📜' },
          { id: 'leaves', label: 'Leaves', icon: '📝' },
        ];
      case 'faculty':
        return [
          { id: 'home', label: 'Classes', icon: '📚' },
          { id: 'session', label: 'Live Console', icon: '🔴' },
          { id: 'timetable', label: 'Timetable', icon: '📅' },
          { id: 'reports', label: 'Shortage', icon: '⚠️' },
        ];
      case 'hod':
        return [
          { id: 'home', label: 'Dept Live', icon: '🏛️' },
          { id: 'session', label: 'Classes', icon: '🔴' },
          { id: 'timetable', label: 'Faculty', icon: '👥' },
          { id: 'reports', label: 'Approvals', icon: '✅' },
        ];
      case 'director':
        return [
          { id: 'home', label: 'Overview', icon: '🏛️' },
          { id: 'approvals', label: 'Approvals', icon: '✅' },
          { id: 'students', label: 'Students', icon: '🎓' },
          { id: 'audit', label: 'Audit Trail', icon: '🛡️' },
        ];
      case 'it_admin':
      case 'super_admin':
        return [
          { id: 'devices', label: 'Displays', icon: '📺' },
          { id: 'health', label: 'Telemetry', icon: '⚡' },
          { id: 'audit', label: 'Audit Logs', icon: '🛡️' },
        ];
    }
  };

  const tabs = getTabsForRole();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isCenterAction = tab.id === 'scan';

          if (isCenterAction) {
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => onSelectTab(tab.id)}
                style={styles.centerButtonContainer}
              >
                <View style={styles.centerButton}>
                  <Text style={styles.centerIcon}>{tab.icon}</Text>
                </View>
                <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.7}
              onPress={() => onSelectTab(tab.id)}
              style={styles.tabItem}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  container: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabLabel: {
    color: '#4f46e5',
    fontWeight: '800',
  },
  centerButtonContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: -20,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  centerIcon: {
    fontSize: 24,
  },
});
