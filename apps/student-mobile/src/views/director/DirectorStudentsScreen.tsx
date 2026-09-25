import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface StudentDirectoryItem {
  id: string;
  roll_number: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  email: string;
  section_name: string;
  department_name: string;
  batch_year: number;
}

export const DirectorStudentsScreen: React.FC = () => {
  const [students, setStudents] = useState<StudentDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected student profile modal
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryItem | null>(null);
  const [studentSummary, setStudentSummary] = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          roll_number,
          registration_number,
          batch_year,
          profile:profiles(first_name, last_name, email),
          current_section:sections(
            name,
            semester:semesters(
              program:programs(
                department:departments(name)
              )
            )
          )
        `)
        .order('roll_number');

      if (error) throw error;

      const formatted: StudentDirectoryItem[] = (data || []).map((s: any) => ({
        id: s.id,
        roll_number: s.roll_number,
        registration_number: s.registration_number,
        first_name: s.profile?.first_name || '',
        last_name: s.profile?.last_name || '',
        email: s.profile?.email || '',
        section_name: s.current_section?.name || 'Section A',
        department_name: s.current_section?.semester?.program?.department?.name || 'Computer Science',
        batch_year: s.batch_year,
      }));

      setStudents(formatted);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const handleSelectStudent = async (st: StudentDirectoryItem) => {
    setSelectedStudent(st);
    try {
      setLoadingSummary(true);
      const { data } = await supabase
        .from('v_student_attendance_summary')
        .select('*')
        .eq('student_id', st.id);
      setStudentSummary(data || []);
    } catch (err) {
      console.error('Error loading student summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const filtered = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search student by name, roll no, or email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.resultsCount}>{filtered.length} students found</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={65} borderRadius={16} />
            <Skeleton height={65} borderRadius={16} />
            <Skeleton height={65} borderRadius={16} />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No Students Matched"
            description="No student matches your query criteria."
          />
        ) : (
          filtered.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => handleSelectStudent(item)}
            >
              <Card variant="elevated" style={styles.studentCard}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.studentName}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={styles.rollNumber}>{item.roll_number}</Text>
                    <Text style={styles.deptText}>
                      {item.department_name} &bull; {item.section_name}
                    </Text>
                  </View>
                  <View style={styles.viewArrow}>
                    <Text style={styles.arrowText}>→</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Student Profile Modal */}
      {selectedStudent && (
        <Modal
          visible={!!selectedStudent}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedStudent(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedStudent.roll_number} &bull; {selectedStudent.email}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionHeading}>Subject-Wise Attendance Breakdown</Text>

              {loadingSummary ? (
                <Skeleton height={100} borderRadius={12} />
              ) : studentSummary.length === 0 ? (
                <Text style={styles.noSummaryText}>No completed sessions recorded yet.</Text>
              ) : (
                <ScrollView style={styles.summaryList}>
                  {studentSummary.map((sub, i) => {
                    const isShort = Number(sub.attendance_percentage) < 75;
                    return (
                      <View key={i} style={styles.summaryItem}>
                        <View style={styles.summaryTop}>
                          <Text style={styles.subName}>{sub.subject_name}</Text>
                          <Text style={[styles.subPct, isShort ? styles.redText : styles.greenText]}>
                            {sub.attendance_percentage}%
                          </Text>
                        </View>
                        <Text style={styles.subStats}>
                          Attended: {sub.attended_count} / {sub.total_held} classes &bull; Absent: {sub.absent_count}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              <Button
                title="Close Profile"
                variant="secondary"
                onPress={() => setSelectedStudent(null)}
                style={styles.closeModalBtn}
              />
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
  searchBar: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 6,
  },
  resultsCount: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  skeletonBox: {
    gap: 8,
  },
  studentCard: {
    marginBottom: 8,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  rollNumber: {
    fontSize: 11,
    color: '#4f46e5',
    fontFamily: 'monospace',
    fontWeight: '700',
    marginTop: 1,
  },
  deptText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  viewArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#4f46e5',
    fontWeight: '800',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  noSummaryText: {
    color: '#94a3b8',
    fontSize: 12,
    marginVertical: 12,
  },
  summaryList: {
    maxHeight: 240,
    marginBottom: 16,
  },
  summaryItem: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  subPct: {
    fontSize: 13,
    fontWeight: '800',
  },
  greenText: {
    color: '#059669',
  },
  redText: {
    color: '#e11d48',
  },
  subStats: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
  },
  closeModalBtn: {
    marginTop: 8,
  },
});
