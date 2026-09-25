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

interface HistoryRecord {
  id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  verification_method: string;
  marked_at: string;
  remarks: string | null;
  session_id: string;
  session_date: string;
  start_time: string;
  subject_name: string;
  subject_code: string;
  room_number: string;
}

export const StudentHistoryScreen: React.FC = () => {
  const { profile, studentRecord } = useAuth();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dispute modal
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const fetchHistory = async () => {
    try {
      let sId = studentRecord?.id;
      if (!sId) {
        const { data: firstStud } = await supabase
          .from('students')
          .select('id')
          .limit(1)
          .single();
        if (firstStud) sId = firstStud.id;
      }

      if (!sId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          status,
          verification_method,
          marked_at,
          remarks,
          session:attendance_sessions(
            id,
            session_date,
            start_time,
            classroom:classrooms(room_number),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            )
          )
        `)
        .eq('student_id', sId)
        .order('marked_at', { ascending: false });

      if (error) throw error;

      const formatted: HistoryRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        verification_method: r.verification_method,
        marked_at: r.marked_at,
        remarks: r.remarks,
        session_id: r.session?.id,
        session_date: r.session?.session_date || 'N/A',
        start_time: r.session?.start_time || '',
        subject_name: r.session?.subject_offering?.subject?.name || 'Lecture',
        subject_code: r.session?.subject_offering?.subject?.code || '',
        room_number: r.session?.classroom?.room_number || 'Room',
      }));

      setRecords(formatted);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [studentRecord]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const handleOpenDispute = (rec: HistoryRecord) => {
    setSelectedRecord(rec);
    setDisputeReason('');
    setEvidenceUrl('');
  };

  const handleSubmitDispute = async () => {
    if (!selectedRecord || !studentRecord?.id) return;
    if (!disputeReason.trim()) {
      Alert.alert('Required', 'Please enter a valid reason for this dispute.');
      return;
    }

    try {
      setSubmittingDispute(true);

      const { error } = await supabase
        .from('attendance_adjustment_requests')
        .insert({
          student_id: studentRecord.id,
          session_id: selectedRecord.session_id,
          requested_status: 'present',
          reason: disputeReason.trim(),
          evidence_url: evidenceUrl.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'ATTENDANCE_CORRECTION_REQUESTED',
        entity_type: 'attendance_record',
        entity_id: selectedRecord.id,
        details: {
          session_id: selectedRecord.session_id,
          reason: disputeReason.trim(),
        },
      });

      Alert.alert(
        'Dispute Submitted',
        'Your correction request has been forwarded to your faculty and HOD for official review.'
      );
      setSelectedRecord(null);
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not record adjustment request.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Date-Wise Attendance Trail</Text>
          <Text style={styles.countText}>{records.length} Recorded</Text>
        </View>

        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={75} borderRadius={16} />
            <Skeleton height={75} borderRadius={16} />
            <Skeleton height={75} borderRadius={16} />
          </View>
        ) : records.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No Attendance Records"
            description="You have not participated in any finalized attendance sessions yet."
          />
        ) : (
          records.map((rec) => {
            const isAbsent = rec.status === 'absent';

            return (
              <Card key={rec.id} variant="elevated" style={styles.recordCard}>
                <View style={styles.recordMain}>
                  <View style={styles.recordLeft}>
                    <View style={styles.codeDateRow}>
                      <Text style={styles.subjectCode}>{rec.subject_code}</Text>
                      <Text style={styles.dateText}>
                        {rec.session_date} &bull; {rec.start_time.slice(0, 5)}
                      </Text>
                    </View>

                    <Text style={styles.subjectName} numberOfLines={1}>
                      {rec.subject_name}
                    </Text>

                    <Text style={styles.methodText}>
                      Method: <Text style={styles.methodBold}>{rec.verification_method.replace('_', ' ')}</Text> &bull; Rm {rec.room_number}
                    </Text>
                  </View>

                  <View style={styles.recordRight}>
                    <Badge
                      label={rec.status}
                      variant={
                        rec.status === 'present' ? 'success' :
                        rec.status === 'late' ? 'warning' :
                        rec.status === 'excused' ? 'info' : 'danger'
                      }
                    />

                    {isAbsent && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleOpenDispute(rec)}
                        style={styles.disputeButton}
                      >
                        <Text style={styles.disputeText}>Dispute</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Dispute Modal */}
      {selectedRecord && (
        <Modal
          visible={!!selectedRecord}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Attendance Dispute Request</Text>
              <Text style={styles.modalSubtitle}>
                {selectedRecord.subject_name} on {selectedRecord.session_date}
              </Text>

              <Text style={styles.inputLabel}>Reason for Dispute *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="Explain why you were present (e.g. camera focus issue, duty leave)..."
                value={disputeReason}
                onChangeText={setDisputeReason}
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Supporting Evidence URL (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://drive.google.com/..."
                value={evidenceUrl}
                onChangeText={setEvidenceUrl}
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setSelectedRecord(null)}
                  style={styles.modalBtn}
                />
                <Button
                  title="Submit Dispute"
                  loading={submittingDispute}
                  onPress={handleSubmitDispute}
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
    marginBottom: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  countText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  skeletonBox: {
    gap: 8,
  },
  recordCard: {
    marginBottom: 8,
    padding: 14,
  },
  recordMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLeft: {
    flex: 1,
    marginRight: 8,
  },
  codeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  subjectCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  methodText: {
    fontSize: 10,
    color: '#64748b',
  },
  methodBold: {
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  disputeButton: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  disputeText: {
    fontSize: 10,
    color: '#4f46e5',
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
    height: 80,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
  },
});
