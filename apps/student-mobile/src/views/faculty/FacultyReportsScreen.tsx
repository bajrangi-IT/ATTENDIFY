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

interface RiskStudent {
  student_id: string;
  roll_number: string;
  student_name: string;
  subject_name: string;
  subject_code: string;
  total_held: number;
  attended_count: number;
  attendance_percentage: number;
}

interface DisputeItem {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  subject_name: string;
  reason: string;
  evidence_url: string | null;
  status: string;
  created_at: string;
  session_id: string;
}

export const FacultyReportsScreen: React.FC = () => {
  const { profile, facultyRecord } = useAuth();
  const [activeTab, setActiveTab] = useState<'shortage' | 'disputes'>('shortage');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [riskStudents, setRiskStudents] = useState<RiskStudent[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);

  // Review dispute modal
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadReportsData = async () => {
    try {
      setLoading(true);

      // 1. Fetch students below 75% from canonical view
      const { data: viewData } = await supabase
        .from('v_student_attendance_summary')
        .select('*')
        .lt('attendance_percentage', 75)
        .order('attendance_percentage', { ascending: true })
        .limit(25);

      const formattedRisk: RiskStudent[] = (viewData || []).map((v: any) => ({
        student_id: v.student_id,
        roll_number: v.roll_number,
        student_name: v.student_name,
        subject_name: v.subject_name,
        subject_code: v.subject_code,
        total_held: v.total_held,
        attended_count: v.attended_count,
        attendance_percentage: Number(v.attendance_percentage),
      }));
      setRiskStudents(formattedRisk);

      // 2. Fetch pending student disputes
      const { data: dispData } = await supabase
        .from('attendance_adjustment_requests')
        .select(`
          id,
          student_id,
          reason,
          evidence_url,
          status,
          created_at,
          session_id,
          student:students(
            roll_number,
            profile:profiles(first_name, last_name)
          ),
          session:attendance_sessions(
            subject_offering:subject_offerings(
              subject:subjects(name)
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      const formattedDisputes: DisputeItem[] = (dispData || []).map((d: any) => ({
        id: d.id,
        student_id: d.student_id,
        student_name: d.student?.profile ? `${d.student.profile.first_name} ${d.student.profile.last_name}` : 'Student',
        roll_number: d.student?.roll_number || 'N/A',
        subject_name: d.session?.subject_offering?.subject?.name || 'Class Session',
        reason: d.reason,
        evidence_url: d.evidence_url,
        status: d.status,
        created_at: d.created_at,
        session_id: d.session_id,
      }));
      setDisputes(formattedDisputes);
    } catch (err) {
      console.error('Error loading reports data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadReportsData();
  };

  const handleDisputeDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedDispute) return;

    try {
      setSubmittingReview(true);

      // 1. Update dispute status
      const { error: dispErr } = await supabase
        .from('attendance_adjustment_requests')
        .update({
          status: decision,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: decision === 'rejected' ? reviewRemarks : null,
        })
        .eq('id', selectedDispute.id);

      if (dispErr) throw dispErr;

      // 2. If approved, update attendance_records
      if (decision === 'approved') {
        await supabase
          .from('attendance_records')
          .update({
            status: 'present',
            verification_method: 'manual_faculty',
            remarks: `Dispute approved by faculty: ${reviewRemarks || 'Verified'}`,
          })
          .eq('session_id', selectedDispute.session_id)
          .eq('student_id', selectedDispute.student_id);
      }

      // 3. Audit log
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: decision === 'approved' ? 'DISPUTE_APPROVED_FACULTY' : 'DISPUTE_REJECTED_FACULTY',
        entity_type: 'attendance_adjustment_request',
        entity_id: selectedDispute.id,
        details: { remarks: reviewRemarks },
      });

      Alert.alert(
        `Dispute ${decision.toUpperCase()}`,
        `Decision registered for ${selectedDispute.student_name}.`
      );

      setSelectedDispute(null);
      setReviewRemarks('');
      loadReportsData();
    } catch (err: any) {
      Alert.alert('Decision Failed', err.message || 'Could not record review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('shortage')}
          style={[styles.tabBtn, activeTab === 'shortage' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, activeTab === 'shortage' && styles.tabBtnTextActive]}>
            Shortage Watchlist ({riskStudents.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('disputes')}
          style={[styles.tabBtn, activeTab === 'disputes' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, activeTab === 'disputes' && styles.tabBtnTextActive]}>
            Dispute Reviews ({disputes.filter((d) => d.status === 'pending').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        {activeTab === 'shortage' ? (
          /* Shortage Tab */
          loading ? (
            <View style={styles.skeletonBox}>
              <Skeleton height={75} borderRadius={16} />
              <Skeleton height={75} borderRadius={16} />
            </View>
          ) : riskStudents.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="No Shortage Alerts"
              description="All students in your assigned sections currently maintain attendance at or above 75%."
            />
          ) : (
            riskStudents.map((st, i) => {
              const deficit = Math.max(0, Math.ceil(0.75 * st.total_held - st.attended_count));
              return (
                <Card key={i} variant="elevated" style={styles.riskCard}>
                  <View style={styles.riskHeader}>
                    <View style={styles.riskLeft}>
                      <Text style={styles.studentName}>{st.student_name}</Text>
                      <Text style={styles.rollNumber}>{st.roll_number}</Text>
                    </View>
                    <View style={styles.pctBadge}>
                      <Text style={styles.pctText}>{st.attendance_percentage}%</Text>
                    </View>
                  </View>

                  <Text style={styles.courseName}>
                    {st.subject_name} ({st.subject_code})
                  </Text>

                  <View style={styles.deficitBox}>
                    <Text style={styles.deficitText}>
                      Deficit: Attended {st.attended_count}/{st.total_held} classes &bull;{' '}
                      <Text style={styles.boldRed}>Needs {deficit} classes to reach 75%</Text>
                    </Text>
                  </View>
                </Card>
              );
            })
          )
        ) : (
          /* Disputes Tab */
          loading ? (
            <View style={styles.skeletonBox}>
              <Skeleton height={85} borderRadius={16} />
              <Skeleton height={85} borderRadius={16} />
            </View>
          ) : disputes.length === 0 ? (
            <EmptyState
              icon="✅"
              title="No Pending Disputes"
              description="There are no student attendance correction requests awaiting review."
            />
          ) : (
            disputes.map((d) => (
              <Card key={d.id} variant="elevated" style={styles.disputeCard}>
                <View style={styles.disputeTop}>
                  <View>
                    <Text style={styles.studentName}>{d.student_name}</Text>
                    <Text style={styles.rollNumber}>
                      {d.roll_number} &bull; {d.subject_name}
                    </Text>
                  </View>
                  <Badge
                    label={d.status}
                    variant={
                      d.status === 'approved' ? 'success' :
                      d.status === 'rejected' ? 'danger' : 'warning'
                    }
                  />
                </View>

                <Text style={styles.disputeReason} numberOfLines={2}>
                  "{d.reason}"
                </Text>

                {d.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <Button
                      title="Review Dispute"
                      size="sm"
                      onPress={() => {
                        setSelectedDispute(d);
                        setReviewRemarks('');
                      }}
                    />
                  </View>
                )}
              </Card>
            ))
          )
        )}
      </ScrollView>

      {/* Review Dispute Modal */}
      {selectedDispute && (
        <Modal
          visible={!!selectedDispute}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedDispute(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Review Student Dispute</Text>
              <Text style={styles.modalSubtitle}>
                {selectedDispute.student_name} ({selectedDispute.roll_number})
              </Text>

              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Student Explanation:</Text>
                <Text style={styles.detailText}>{selectedDispute.reason}</Text>
                {selectedDispute.evidence_url && (
                  <Text style={styles.evidenceLink}>
                    📎 Evidence URL: {selectedDispute.evidence_url}
                  </Text>
                )}
              </View>

              <Text style={styles.inputLabel}>Faculty Assessment Remarks</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={2}
                placeholder="Enter endorsement or reason for decision..."
                value={reviewRemarks}
                onChangeText={setReviewRemarks}
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.decisionRow}>
                <Button
                  title="Reject"
                  variant="danger"
                  loading={submittingReview}
                  onPress={() => handleDisputeDecision('rejected')}
                  style={styles.decisionBtn}
                />
                <Button
                  title="Approve Present"
                  variant="primary"
                  loading={submittingReview}
                  onPress={() => handleDisputeDecision('approved')}
                  style={styles.decisionBtn}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#4f46e5',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  skeletonBox: {
    gap: 8,
  },
  riskCard: {
    marginBottom: 8,
    padding: 14,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  riskLeft: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  rollNumber: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  pctBadge: {
    backgroundColor: '#fff1f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  pctText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#e11d48',
  },
  courseName: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
  },
  deficitBox: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deficitText: {
    fontSize: 10,
    color: '#64748b',
  },
  boldRed: {
    fontWeight: '700',
    color: '#e11d48',
  },
  disputeCard: {
    marginBottom: 8,
    padding: 14,
  },
  disputeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  disputeReason: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 10,
  },
  actionRow: {
    alignItems: 'flex-end',
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
  detailBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 18,
  },
  evidenceLink: {
    fontSize: 11,
    color: '#4f46e5',
    marginTop: 6,
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
    height: 60,
    marginBottom: 16,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  decisionBtn: {
    flex: 1,
  },
});
