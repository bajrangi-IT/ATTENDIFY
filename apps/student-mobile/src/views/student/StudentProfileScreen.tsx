import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth, ROLE_SEED_EMAILS } from '../../context/AuthContext';
import { UserRole } from '@campusattend/shared-types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const StudentProfileScreen: React.FC = () => {
  const { profile, role, studentRecord, switchRole, signOut } = useAuth();

  const handleRoleSwitch = (newRole: UserRole) => {
    switchRole(newRole);
    Alert.alert('Role Switched', `Now operating as ${newRole.replace('_', ' ').toUpperCase()}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <Card variant="elevated" style={styles.profileHeaderCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.first_name ? profile.first_name.charAt(0) : 'S'}
          </Text>
        </View>

        <Text style={styles.name}>
          {profile ? `${profile.first_name} ${profile.last_name}` : 'Student User'}
        </Text>
        <Text style={styles.email}>{profile?.email}</Text>

        <View style={styles.roleRow}>
          <Badge label={role.replace('_', ' ')} variant="info" />
          <Badge label="Active Enrollment" variant="success" />
        </View>
      </Card>

      {/* Academic Credentials */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Academic Enrollment Credentials</Text>
      </View>

      <Card variant="elevated">
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Roll Number</Text>
          <Text style={styles.infoValue}>{studentRecord?.roll_number || '2022-CSE-001'}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registration ID</Text>
          <Text style={styles.infoValue}>{studentRecord?.registration_number || 'REG-2022-001'}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Current Section</Text>
          <Text style={styles.infoValue}>
            {(studentRecord as any)?.current_section?.name || 'Section A'}
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Batch Year</Text>
          <Text style={styles.infoValue}>{studentRecord?.batch_year || '2026'}</Text>
        </View>
      </Card>

      {/* Role / Persona Switcher for Mobile ERP Verification */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>ERP Mobile Role Switcher</Text>
      </View>

      <Card variant="flat" style={styles.personaCard}>
        <Text style={styles.personaDesc}>
          Switch to any institutional persona to test role-authorized screens on mobile:
        </Text>

        <View style={styles.rolesGrid}>
          {(['student', 'faculty', 'hod', 'director', 'it_admin'] as UserRole[]).map((r) => {
            const isCurrent = role === r;
            return (
              <TouchableOpacity
                key={r}
                activeOpacity={0.7}
                onPress={() => handleRoleSwitch(r)}
                style={[styles.rolePill, isCurrent && styles.rolePillActive]}
              >
                <Text style={[styles.rolePillText, isCurrent && styles.rolePillTextActive]}>
                  {r.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Security & Sign Out */}
      <View style={styles.logoutContainer}>
        <Button
          title="Sign Out of CampusAttend"
          variant="secondary"
          onPress={signOut}
          style={styles.logoutBtn}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeaderCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  email: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitleRow: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  personaCard: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  personaDesc: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  rolePillActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'capitalize',
  },
  rolePillTextActive: {
    color: '#ffffff',
  },
  logoutContainer: {
    marginTop: 24,
  },
  logoutBtn: {
    borderColor: '#fca5a5',
  },
});
