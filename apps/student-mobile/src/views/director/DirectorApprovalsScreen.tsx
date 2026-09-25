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

interface SessionReportItem {
  id: string;
  session_id: string;
  total_enrolled: number;
  total_present: number;
  total_absent: number;
  approval_status: 'submitted' | 'approved' | 'rejected' | 'changes_requested';
  notes: string | null;
  created_at: string;
  teacher_name: string;
  teacher_email: string;
  subject_name: string;
  subject_code: string;
  section_name: string;
  session_date: string;
}

export const DirectorApprovalsScreen: React.FC = () => {
  const { profile } = useAuth();
  const [reports, setReports] = useState<SessionReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Review modal
  const [selectedReport, setSelectedReport] = useState<SessionReportItem | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | 'changes_requested' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('attendance_session_reports')
        .select(`
          id,
          session_id,
          total_enrolled,
          total_present,
          total_absent,
          approval_status,
          notes,
          created_at,
          submitter:profiles(first_name, last_name, email),
          session:attendance_sessions(
            session_date,
            section:sections(name),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: SessionReportItem[] = (data || []).map((r: any) => ({
        id: r.id,
        session_id: r.session_id,
        total_enrolled: r.total_enrolled,
        total_present: r.total_present,
        total_absent: r.total_absent,
        approval_status: r.approval_status,
        notes: r.notes,
        created_at: r.created_at,
        teacher_name: r.submitter ? `${r.submitter.first_name} ${r.submitter.last_name}` : 'Faculty',
        teacher_email: r.submitter?.email || '',
        subject_name: r.session?.subject_offering?.subject?.name || 'Class Session',
        subject_code: r.session?.subject_offering?.subject?.code || '',
        section_name: r.session?.section?.name || 'Section',
        session_date: r.session?.session_date || 'N/A',
      }));

      setReports(formatted);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const handleDecision = async () => {
    if (!selectedReport || !actionType) return;

    try {
      setSubmittingAction(true);

      const { error } = await supabase
        .from('attendance_session_reports')
        .update({
          approval_status: actionType,
          approved_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          reviewer_comments: reviewComment.trim() || null,
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      // If approved, lock the session
      if (actionType === 'approved') {
        await supabase
          .from('attendance_sessions')
          .update({ is_attendance_locked: true, status: 'audit_locked' })
          .eq('id', selectedReport.session_id);
      }

      // Log into audit trail
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: `SESSION_REPORT_${actionType.toUpperCase()}`,
        entity_type: 'attendance_session_report',
        entity_id: selectedReport.id,
        details: {
          comments: reviewComment.trim(),
          session_id: selectedReport.session_id,
        },
      });

      Alert.alert(
        'Decision Registered',
        `Session report marked as ${actionType.replace('_', ' ').toUpperCase()}.`
      );

      setSelectedReport(null);
      setActionType(null);
      setReviewComment('');
      fetchReports();
    } catch (err: any) {
      Alert.alert('Decision Error', err.message || 'Could not update report status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const pendingCount = reports.filter((r) => r.approval_status === 'submitted').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Session Report Approvals</Text>
            <Text style={styles.subheading}>{pendingCount} Awaiting Official Sign-Off</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={100} borderRadius={16} />
            <Skeleton height={100} borderRadius={16} />
          </View>
        ) : reports.length === 0 ? (
          <EmptyState
            icon="✅"
            title="All Reports Cleared"
            description="There are no pending faculty attendance reports submitted for review."
          />
        ) : (
          reports.map((item) => {
            const isPending = item.approval_status === 'submitted';
            const pct = Math.round((item.total_present / (item.total_enrolled || 1)) * 100);

            return (
              <Card key={item.id} variant="elevated" style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportLeft}>
                    <Text style={styles.subjectTitle}>{item.subject_name}</Text>
                    <Text style={styles.instructorText}>
                      👤 {item.teacher_name} &bull; {item.section_name} ({item.session_date})
                    </Text>
                  </View>

                  <Badge
                    label={item.approval_status.replace('_', ' ')}
                    variant={
                      item.approval_status === 'approved' ? 'success' :
                      item.approval_status === 'rejected' ? 'danger' :
                      item.approval_status === 'changes_requested' ? 'warning' : 'info'
                    }
                  />
                </View>

                {/* Metrics Breakdown */}
                <View style={styles.metricsBox}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricVal}>{item.total_present}</Text>
                    <Text style={styles.metricLbl}>PRESENT</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, styles.redText]}>{item.total_absent}</Text>
                    <Text style={styles.metricLbl}>ABSENT</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricVal}>{item.total_enrolled}</Text>
                    <Text style={styles.metricLbl}>ENROLLED</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, styles.greenText]}>{pct}%</Text>
                    <Text style={styles.metricLbl}>TURNOUT</Text>
                  </View>
                </View>

                {item.notes && (
                  <Text style={styles.notesText}>Note: "{item.notes}"</Text>
                )}

                {/* Actions */}
                {isPending && (
                  <View style={styles.actionBtnRow}>
                    <Button
                      title="Approve"
                      variant="primary"
                      size="sm"
                      onPress={() => {
                        setSelectedReport(item);
                        setActionType('approved');
                      }}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Changes"
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setSelectedReport(item);
                        setActionType('changes_requested');
                      }}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Reject"
                      variant="danger"
                      size="sm"
                      onPress={() => {
                        setSelectedReport(item);
                        setActionType('rejected');
                      }}
                      style={styles.actionBtn}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Decision Modal */}
      {selectedReport && actionType && (
        <Modal
          visible={!!selectedReport}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedReport(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>
                {actionType === 'approved' ? 'Approve Session Report' :
                 actionType === 'rejected' ? 'Reject Session Report' : 'Request Report Changes'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedReport.subject_name} &bull; Instructor: {selectedReport.teacher_name}
              </Text>

              <Text style={styles.inputLabel}>Executive Review Remarks</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="Enter remarks or adjustments required..."
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setSelectedReport(null)}
                  style={styles.modalBtn}
                />
                <Button
                  title={`Confirm ${actionType.replace('_', ' ')}`}
                  variant={actionType === 'approved' ? 'primary' : 'danger'}
                  loading={submittingAction}
                  onPress={handleDecision}
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
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subheading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  skeletonBox: {
    gap: 8,
  },
  reportCard: {
    marginBottom: 12,
    padding: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportLeft: {
    flex: 1,
    marginRight: 8,
  },
  subjectTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  instructorText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  redText: {
    color: '#e11d48',
  },
  greenText: {
    color: '#059669',
  },
  notesText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
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
    textTransform: 'capitalize',
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
