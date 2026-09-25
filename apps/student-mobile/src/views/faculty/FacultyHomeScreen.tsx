import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface FacultyHomeScreenProps {
  onNavigateToLiveSession: (sessionId?: string) => void;
  onNavigateToTimetable: () => void;
  onNavigateToReports: () => void;
}

export const FacultyHomeScreen: React.FC<FacultyHomeScreenProps> = ({
  onNavigateToLiveSession,
  onNavigateToTimetable,
  onNavigateToReports,
}) => {
  const { facultyRecord, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [todayLectures, setTodayLectures] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [pendingDisputesCount, setPendingDisputesCount] = useState(0);

  const loadFacultyDashboard = async () => {
    try {
      let facId = facultyRecord?.id;
      if (!facId) {
        const { data: firstFac } = await supabase.from('faculty').select('id').limit(1).single();
        if (firstFac) facId = firstFac.id;
      }

      if (!facId) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();

      // 1. Fetch today's lectures from timetable
      const { data: slots } = await supabase
        .from('timetable_entries')
        .select(`
          id,
          start_time,
          end_time,
          section_id,
          classroom_id,
          subject_offering_id,
          classroom:classrooms(room_number, building),
          section:sections(name),
          subject_offering:subject_offerings(
            subject:subjects(name, code)
          )
        `)
        .eq('faculty_id', facId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true });

      setTodayLectures(slots || []);

      // 2. Check for active in_progress session
      const { data: sess } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          status,
          start_time,
          end_time,
          classroom:classrooms(room_number),
          section:sections(name),
          subject_offering:subject_offerings(
            subject:subjects(name, code)
          )
        `)
        .eq('faculty_id', facId)
        .eq('session_date', today)
        .eq('status', 'in_progress')
        .maybeSingle();

      setActiveSession(sess || null);

      // 3. Count pending student disputes
      const { count } = await supabase
        .from('attendance_adjustment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setPendingDisputesCount(count || 0);
    } catch (err) {
      console.error('Error loading faculty home:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFacultyDashboard();
  }, [facultyRecord]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFacultyDashboard();
  };

  // Start new attendance session from a timetable slot
  const handleStartSessionForSlot = async (slot: any) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Create attendance session in Supabase
      const { data: newSess, error } = await supabase
        .from('attendance_sessions')
        .insert({
          timetable_entry_id: slot.id,
          subject_offering_id: slot.subject_offering_id,
          faculty_id: facultyRecord?.id,
          classroom_id: slot.classroom_id,
          section_id: slot.section_id,
          session_date: today,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: 'in_progress',
          is_attendance_locked: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Populate absent placeholders for students in section
      const { data: sectionStudents } = await supabase
        .from('students')
        .select('id')
        .eq('current_section_id', slot.section_id);

      if (sectionStudents && sectionStudents.length > 0) {
        const records = sectionStudents.map((st) => ({
          session_id: newSess.id,
          student_id: st.id,
          status: 'absent',
          verification_method: 'dynamic_qr',
          is_finalized: false,
        }));
        await supabase.from('attendance_records').insert(records);
      }

      Alert.alert('Session Started', 'Dynamic QR is now rotating on classroom display.');
      onNavigateToLiveSession(newSess.id);
    } catch (err: any) {
      Alert.alert('Could Not Start Session', err.message || 'Session creation failed.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
    >
      {/* Faculty Greeting & Department */}
      <View style={styles.facultyBanner}>
        <Text style={styles.welcomeLabel}>FACULTY CONSOLE</Text>
        <Text style={styles.facultyName}>
          Prof. {profile?.first_name} {profile?.last_name}
        </Text>
        <Text style={styles.facultyDesignation}>
          {facultyRecord?.designation || 'Assistant Professor'} &bull; Code: {facultyRecord?.employee_code || 'FAC001'}
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiVal}>{todayLectures.length}</Text>
            <Text style={styles.kpiLabel}>Today's Lectures</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiVal}>{pendingDisputesCount}</Text>
            <Text style={styles.kpiLabel}>Disputes to Review</Text>
          </View>
        </View>
      </View>

      {/* Active Session Callout */}
      {activeSession && (
        <Card variant="elevated" style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE SESSION IN PROGRESS</Text>
            </View>
            <Badge label="ACTIVE" variant="danger" />
          </View>

          <Text style={styles.activeSubjectTitle}>
            {activeSession.subject_offering?.subject?.name}
          </Text>
          <Text style={styles.activeSubText}>
            Section {activeSession.section?.name} &bull; Room {activeSession.classroom?.room_number}
          </Text>

          <Button
            title="Open Live Attendance Console"
            onPress={() => onNavigateToLiveSession(activeSession.id)}
            style={styles.activeBtn}
          />
        </Card>
      )}

      {/* Today's Lectures */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today's Teaching Schedule</Text>
        <TouchableOpacity onPress={onNavigateToTimetable}>
          <Text style={styles.viewAllText}>Full Week →</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton height={85} borderRadius={16} />
          <Skeleton height={85} borderRadius={16} />
        </View>
      ) : todayLectures.length === 0 ? (
        <EmptyState
          icon="☕"
          title="No Lectures Today"
          description="You do not have any scheduled classes today on your master timetable."
        />
      ) : (
        todayLectures.map((slot) => (
          <Card key={slot.id} variant="elevated" style={styles.lectureCard}>
            <View style={styles.timeSection}>
              <Text style={styles.startTime}>{slot.start_time.slice(0, 5)}</Text>
              <Text style={styles.endTime}>{slot.end_time.slice(0, 5)}</Text>
            </View>

            <View style={styles.lectureDetails}>
              <View style={styles.metaRow}>
                <Text style={styles.codeBadge}>{slot.subject_offering?.subject?.code}</Text>
                <Text style={styles.sectionBadge}>{slot.section?.name}</Text>
              </View>

              <Text style={styles.subjectTitle} numberOfLines={1}>
                {slot.subject_offering?.subject?.name}
              </Text>

              <Text style={styles.locationText}>
                Room {slot.classroom?.room_number} &bull; {slot.classroom?.building}
              </Text>
            </View>

            <View style={styles.actionSection}>
              <Button
                title="Start"
                size="sm"
                onPress={() => handleStartSessionForSlot(slot)}
              />
            </View>
          </Card>
        ))
      )}

      {/* Quick Access Grid */}
      <View style={styles.quickAccessGrid}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNavigateToReports}
          style={styles.quickTile}
        >
          <Text style={styles.quickIcon}>📊</Text>
          <Text style={styles.quickTitle}>Attendance Reports</Text>
          <Text style={styles.quickSub}>Shortage & threshold statistics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNavigateToTimetable}
          style={styles.quickTile}
        >
          <Text style={styles.quickIcon}>📅</Text>
          <Text style={styles.quickTitle}>Weekly Timetable</Text>
          <Text style={styles.quickSub}>Master classroom slots</Text>
        </TouchableOpacity>
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
  facultyBanner: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  welcomeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 0.5,
  },
  facultyName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  facultyDesignation: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#a5b4fc',
    marginTop: 2,
    fontWeight: '600',
  },
  activeCard: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e11d48',
  },
  activeSubjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  activeSubText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    marginBottom: 12,
  },
  activeBtn: {
    backgroundColor: '#e11d48',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  skeletonContainer: {
    gap: 8,
  },
  lectureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  timeSection: {
    width: 52,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    paddingRight: 8,
  },
  startTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  endTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  lectureDetails: {
    flex: 1,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 3,
  },
  codeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subjectTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
  },
  actionSection: {
    marginLeft: 6,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickTile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  quickSub: {
    fontSize: 10,
    color: '#64748b',
  },
});
