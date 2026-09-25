import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface StudentRosterItem {
  id: string; // record id
  student_id: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  verification_method: string;
  marked_at: string | null;
}

interface FacultyLiveSessionScreenProps {
  sessionId?: string;
  onSessionEnded?: () => void;
}

export const FacultyLiveSessionScreen: React.FC<FacultyLiveSessionScreenProps> = ({
  sessionId,
  onSessionEnded,
}) => {
  const { profile, facultyRecord } = useAuth();
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');

  // Manual override modal
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [overrideReason, setOverrideReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // Load session & student roster
  const loadSessionRoster = async () => {
    try {
      setLoading(true);

      // 1. Identify active session
      let targetId = sessionId;
      if (!targetId) {
        const { data: latest } = await supabase
          .from('attendance_sessions')
          .select(`
            *,
            classroom:classrooms(room_number),
            section:sections(name),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            )
          `)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest) {
          targetId = latest.id;
          setActiveSession(latest);
        }
      } else {
        const { data: sess } = await supabase
          .from('attendance_sessions')
          .select(`
            *,
            classroom:classrooms(room_number),
            section:sections(name),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            )
          `)
          .eq('id', targetId)
          .maybeSingle();
        setActiveSession(sess || null);
      }

      if (!targetId) {
        setLoading(false);
        return;
      }

      // 2. Fetch student attendance records for this session
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          student_id,
          status,
          verification_method,
          marked_at,
          student:students(
            roll_number,
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('session_id', targetId);

      if (error) throw error;

      const formatted: StudentRosterItem[] = (records || []).map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        roll_number: r.student?.roll_number || 'N/A',
        first_name: r.student?.profile?.first_name || '',
        last_name: r.student?.profile?.last_name || '',
        status: r.status,
        verification_method: r.verification_method,
        marked_at: r.marked_at,
      }));

      setRoster(formatted);
    } catch (err) {
      console.error('Error loading live roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionRoster();

    // Supabase Realtime subscription for live attendance check-ins
    const channel = supabase
      .channel('faculty-live-roster')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
        },
        () => {
          loadSessionRoster();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // End Session and Generate Report
  const handleEndSession = async () => {
    if (!activeSession) return;

    Alert.alert(
      'End Attendance Session?',
      'This will finalize student attendance counts, lock further QR scans, and generate the session summary.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End & Submit Report',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Update session status
              await supabase
                .from('attendance_sessions')
                .update({
                  status: 'completed',
                  is_attendance_locked: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeSession.id);

              // 2. Finalize all records
              await supabase
                .from('attendance_records')
                .update({ is_finalized: true })
                .eq('session_id', activeSession.id);

              // 3. Create Session Report for Director review
              const presentCount = roster.filter((r) => r.status === 'present').length;
              const totalCount = roster.length;

              await supabase.from('attendance_session_reports').insert({
                session_id: activeSession.id,
                submitted_by: profile?.id,
                total_enrolled: totalCount,
                total_present: presentCount,
                total_absent: totalCount - presentCount,
                approval_status: 'submitted',
                notes: 'Mobile session completed and locked.',
              });

              // 4. Audit log
              await supabase.from('audit_logs').insert({
                actor_id: profile?.id,
                action: 'SESSION_FINALIZED_MOBILE',
                entity_type: 'attendance_session',
                entity_id: activeSession.id,
                details: { present: presentCount, total: totalCount },
              });

              Alert.alert('Session Finalized', 'Session report submitted to Director.');
              onSessionEnded?.();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not finalize session.');
            }
          },
        },
      ]
    );
  };

  // Submit Manual Attendance Override with Reason & Audit Log
  const handleSaveOverride = async () => {
    if (!selectedStudent || !overrideReason.trim()) {
      Alert.alert('Mandatory Reason', 'Please input an official justification for this attendance change.');
      return;
    }

    try {
      setSavingOverride(true);

      const { error } = await supabase
        .from('attendance_records')
        .update({
          status: overrideStatus,
          verification_method: 'manual_faculty',
          marked_at: new Date().toISOString(),
          remarks: overrideReason.trim(),
          is_finalized: true,
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'FACULTY_MANUAL_ATTENDANCE_OVERRIDE',
        entity_type: 'attendance_record',
        entity_id: selectedStudent.id,
        details: {
          student: `${selectedStudent.first_name} ${selectedStudent.last_name} (${selectedStudent.roll_number})`,
          new_status: overrideStatus,
          reason: overrideReason.trim(),
        },
      });

      Alert.alert('Attendance Updated', `Record updated to ${overrideStatus.toUpperCase()}.`);
      setSelectedStudent(null);
      setOverrideReason('');
      loadSessionRoster();
    } catch (err: any) {
      Alert.alert('Override Failed', err.message || 'Could not modify attendance record.');
    } finally {
      setSavingOverride(false);
    }
  };

  // Stats
  const total = roster.length;
  const present = roster.filter((r) => r.status === 'present').length;
  const absent = total - present;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  const filteredRoster = roster.filter((r) => {
    const matchSearch =
      r.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roll_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus =
      statusFilter === 'all' ||
      r.status === statusFilter;

    return matchSearch && matchStatus;
  });

  if (!activeSession && !loading) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="🔴"
          title="No Active Session Found"
          description="There is no active attendance session currently in progress. Start one from your schedule."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Session Header Strip */}
      <View style={styles.sessionHeader}>
        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.subjectTitle} numberOfLines={1}>
              {activeSession?.subject_offering?.subject?.name || 'Live Lecture'}
            </Text>
            <Badge label="LIVE" variant="danger" size="sm" />
          </View>
          <Text style={styles.subInfo}>
            {activeSession?.section?.name} &bull; Room {activeSession?.classroom?.room_number} &bull; QR Rotating
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleEndSession}
          style={styles.endBtn}
        >
          <Text style={styles.endBtnText}>End Session</Text>
        </TouchableOpacity>
      </View>

      {/* Realtime Attendance Headcount Gauge */}
      <View style={styles.headcountStrip}>
        <View style={styles.countBlock}>
          <Text style={styles.countNum}>{present}</Text>
          <Text style={styles.countLbl}>PRESENT</Text>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.countBlock}>
          <Text style={[styles.countNum, styles.redText]}>{absent}</Text>
          <Text style={styles.countLbl}>ABSENT</Text>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.countBlock}>
          <Text style={[styles.countNum, styles.indigoText]}>{percentage}%</Text>
          <Text style={styles.countLbl}>HEADCOUNT</Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or roll number..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.filterPills}>
          {(['all', 'present', 'absent'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setStatusFilter(f)}
              style={[styles.filterPill, statusFilter === f && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, statusFilter === f && styles.filterPillTextActive]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Student Roster List */}
      <ScrollView contentContainerStyle={styles.rosterList}>
        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={60} borderRadius={12} />
            <Skeleton height={60} borderRadius={12} />
            <Skeleton height={60} borderRadius={12} />
          </View>
        ) : filteredRoster.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No Students Matched"
            description="No student matches your search or filter."
          />
        ) : (
          filteredRoster.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedStudent(item);
                setOverrideStatus(item.status);
                setOverrideReason('');
              }}
            >
              <Card variant="elevated" style={styles.rosterCard}>
                <View style={styles.rosterRow}>
                  <View style={styles.rosterLeft}>
                    <Text style={styles.studentName}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={styles.rollNumber}>{item.roll_number}</Text>
                  </View>

                  <View style={styles.rosterRight}>
                    <Badge
                      label={item.status}
                      variant={
                        item.status === 'present' ? 'success' :
                        item.status === 'late' ? 'warning' : 'danger'
                      }
                    />
                    <Text style={styles.methodInfo}>
                      {item.marked_at ? new Date(item.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Manual Override Modal */}
      {selectedStudent && (
        <Modal
          visible={!!selectedStudent}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedStudent(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Manual Attendance Override</Text>
              <Text style={styles.modalSubtitle}>
                {selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.roll_number})
              </Text>

              {/* Status Radio Buttons */}
              <Text style={styles.inputLabel}>Set Attendance Status</Text>
              <View style={styles.statusOptionsRow}>
                {(['present', 'late', 'excused', 'absent'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setOverrideStatus(st)}
                    style={[styles.statusOpt, overrideStatus === st && styles.statusOptActive]}
                  >
                    <Text style={[styles.statusOptText, overrideStatus === st && styles.statusOptTextActive]}>
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Mandatory Reason & Audit Log Justification *</Text>
              <TextInput
                style={styles.overrideTextArea}
                multiline
                numberOfLines={3}
                placeholder="State official reason (e.g. verified student council duty, camera issue)..."
                value={overrideReason}
                onChangeText={setOverrideReason}
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setSelectedStudent(null)}
                  style={styles.modalBtn}
                />
                <Button
                  title="Confirm Override"
                  loading={savingOverride}
                  onPress={handleSaveOverride}
                  style={styles.modalBtn}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  endBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  endBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  headcountStrip: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    paddingVertical: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  countBlock: {
    alignItems: 'center',
  },
  countNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10b981',
  },
  redText: {
    color: '#f43f5e',
  },
  indigoText: {
    color: '#a5b4fc',
  },
  countLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: '#cbd5e1',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  vDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  filterBar: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 8,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#4f46e5',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  rosterList: {
    padding: 12,
    paddingBottom: 40,
  },
  skeletonBox: {
    gap: 8,
  },
  rosterCard: {
    marginBottom: 6,
    padding: 12,
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rosterLeft: {
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  rollNumber: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  rosterRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  methodInfo: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statusOptionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  statusOpt: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusOptActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  statusOptText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  statusOptTextActive: {
    color: '#ffffff',
  },
  overrideTextArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: '#0f172a',
    textAlignVertical: 'top',
    height: 70,
    marginBottom: 16,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
  },
});
