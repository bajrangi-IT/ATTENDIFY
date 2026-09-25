import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface LeaveItem {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  created_at: string;
}

export const StudentLeavesScreen: React.FC = () => {
  const { studentRecord } = useAuth();
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Apply leave modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveType, setLeaveType] = useState('medical');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = async () => {
    try {
      let sId = studentRecord?.id;
      if (!sId) {
        const { data: firstStud } = await supabase.from('students').select('id').limit(1).single();
        if (firstStud) sId = firstStud.id;
      }

      if (!sId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('student_id', sId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaves(data || []);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [studentRecord]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  const handleApply = async () => {
    if (!studentRecord?.id) return;
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter a detailed reason for leave.');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('leave_applications').insert({
        student_id: studentRecord.id,
        start_date: startDate,
        end_date: endDate,
        leave_type: leaveType,
        reason: reason.trim(),
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert('Leave Submitted', 'Your application is pending HOD endorsement.');
      setIsModalOpen(false);
      setReason('');
      fetchLeaves();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Leave & Absence History</Text>
            <Text style={styles.subheading}>{leaves.length} Applications Recorded</Text>
          </View>
          <Button
            title="+ Apply"
            size="sm"
            onPress={() => setIsModalOpen(true)}
          />
        </View>

        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={80} borderRadius={16} />
            <Skeleton height={80} borderRadius={16} />
          </View>
        ) : leaves.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No Leave Applications"
            description="You have not submitted any medical or academic duty leave requests."
            actionTitle="+ Submit New Application"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          leaves.map((l) => (
            <Card key={l.id} variant="elevated" style={styles.leaveCard}>
              <View style={styles.leaveHeader}>
                <View style={styles.typeRow}>
                  <Text style={styles.leaveTypeBadge}>{l.leave_type.toUpperCase()}</Text>
                  <Text style={styles.leaveDates}>
                    {l.start_date} to {l.end_date}
                  </Text>
                </View>
                <Badge
                  label={l.status}
                  variant={
                    l.status === 'approved' ? 'success' :
                    l.status === 'rejected' ? 'danger' : 'warning'
                  }
                />
              </View>

              <Text style={styles.leaveReason} numberOfLines={2}>
                {l.reason}
              </Text>

              <Text style={styles.submittedDate}>
                Submitted on {new Date(l.created_at).toLocaleDateString()}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Apply Leave Modal Sheet */}
      {isModalOpen && (
        <Modal
          visible={isModalOpen}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Submit Leave Application</Text>
              <Text style={styles.modalSubtitle}>
                Official absence request will be evaluated by your Head of Department.
              </Text>

              <View style={styles.datesRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={styles.dateCol}>
                  <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Leave Category</Text>
              <View style={styles.typeSelector}>
                {['medical', 'academic_duty', 'personal'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.7}
                    onPress={() => setLeaveType(t)}
                    style={[styles.typeOption, leaveType === t && styles.typeOptionActive]}
                  >
                    <Text style={[styles.typeText, leaveType === t && styles.typeTextActive]}>
                      {t.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Reason for Leave *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="State your genuine reason..."
                value={reason}
                onChangeText={setReason}
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setIsModalOpen(false)}
                  style={styles.modalBtn}
                />
                <Button
                  title="Submit Application"
                  loading={submitting}
                  onPress={handleApply}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subheading: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  skeletonBox: {
    gap: 8,
  },
  leaveCard: {
    marginBottom: 10,
    padding: 14,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaveTypeBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  leaveDates: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  leaveReason: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  submittedDate: {
    fontSize: 10,
    color: '#94a3b8',
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
  datesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeOptionActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'capitalize',
  },
  typeTextActive: {
    color: '#ffffff',
  },
  textArea: {
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
