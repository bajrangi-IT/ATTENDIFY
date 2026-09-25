import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';

interface SubjectSummary {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  total_held: number;
  attended_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_percentage: number;
  threshold_status: 'good' | 'warning' | 'critical';
}

interface ActiveSessionItem {
  id: string;
  subject_name: string;
  subject_code: string;
  room_number: string;
  start_time: string;
  end_time: string;
  faculty_name: string;
}

interface NextLectureItem {
  subject_name: string;
  subject_code: string;
  room_number: string;
  start_time: string;
  faculty_name: string;
}

interface StudentHomeScreenProps {
  onNavigateToScan: () => void;
  onNavigateToTimetable: () => void;
}

export const StudentHomeScreen: React.FC<StudentHomeScreenProps> = ({
  onNavigateToScan,
  onNavigateToTimetable,
}) => {
  const { studentRecord } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSessionItem | null>(null);
  const [nextLecture, setNextLecture] = useState<NextLectureItem | null>(null);

  const loadStudentDashboard = async () => {
    try {
      let sId = studentRecord?.id;
      let sectionId = studentRecord?.current_section_id;

      if (!sId) {
        // Fallback to first student in DB
        const { data: firstStud } = await supabase
          .from('students')
          .select('id, current_section_id')
          .limit(1)
          .single();
        if (firstStud) {
          sId = firstStud.id;
          sectionId = firstStud.current_section_id;
        }
      }

      if (!sId) {
        setLoading(false);
        return;
      }

      // 1. Fetch subject-wise attendance from canonical view
      const { data: viewData } = await supabase
        .from('v_student_attendance_summary')
        .select('*')
        .eq('student_id', sId);

      setSubjects((viewData as any) || []);

      // 2. Check for active attendance session for this section
      const today = new Date().toISOString().slice(0, 10);
      if (sectionId) {
        const { data: liveSess } = await supabase
          .from('attendance_sessions')
          .select(`
            id,
            start_time,
            end_time,
            status,
            classroom:classrooms(room_number),
            subject_offering:subject_offerings(
              subject:subjects(name, code)
            ),
            faculty:faculty(
              profile:profiles(first_name, last_name)
            )
          `)
          .eq('section_id', sectionId)
          .eq('session_date', today)
          .eq('status', 'in_progress')
          .maybeSingle();

        if (liveSess) {
          setActiveSession({
            id: liveSess.id,
            subject_name: (liveSess as any).subject_offering?.subject?.name || 'Lecture',
            subject_code: (liveSess as any).subject_offering?.subject?.code || 'SUB',
            room_number: (liveSess as any).classroom?.room_number || 'Room',
            start_time: liveSess.start_time,
            end_time: liveSess.end_time,
            faculty_name: (liveSess as any).faculty?.profile ? `${(liveSess as any).faculty.profile.first_name} ${(liveSess as any).faculty.profile.last_name}` : 'Faculty',
          });
        } else {
          setActiveSession(null);
        }

        // 3. Find next upcoming lecture today from timetable
        const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
        const currentTime = new Date().toTimeString().slice(0, 8);

        const { data: nextSlots } = await supabase
          .from('timetable_entries')
          .select(`
            start_time,
            classroom:classrooms(room_number),
            subject_offering:subject_offerings(subject:subjects(name, code)),
            faculty:faculty(profile:profiles(first_name, last_name))
          `)
          .eq('section_id', sectionId)
          .eq('day_of_week', dayOfWeek)
          .gte('start_time', currentTime)
          .order('start_time', { ascending: true })
          .limit(1);

        if (nextSlots && nextSlots.length > 0) {
          const s = nextSlots[0] as any;
          setNextLecture({
            subject_name: s.subject_offering?.subject?.name || 'Next Class',
            subject_code: s.subject_offering?.subject?.code || '',
            room_number: s.classroom?.room_number || 'TBA',
            start_time: s.start_time,
            faculty_name: s.faculty?.profile ? `${s.faculty.profile.first_name} ${s.faculty.profile.last_name}` : 'Instructor',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load mobile student home:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStudentDashboard();
  }, [studentRecord]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentDashboard();
  };

  // Cumulative Attendance Calculation
  const totalHeld = subjects.reduce((sum, s) => sum + s.total_held, 0);
  const totalAttended = subjects.reduce((sum, s) => sum + s.attended_count, 0);
  const cumulativePercentage = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : 100;
  const isCumulativeShortage = cumulativePercentage < 75;

  // Recovery Math: X = ceil(3 * Held - 4 * Attended)
  const recoveryClassesNeeded = Math.max(0, Math.ceil(3 * totalHeld - 4 * totalAttended));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
    >
      {/* 1. Cumulative Attendance Gauge Banner */}
      <View style={[styles.gaugeCard, isCumulativeShortage ? styles.gaugeShortage : styles.gaugeGood]}>
        <View style={styles.gaugeHeader}>
          <Text style={styles.gaugeTitle}>Cumulative Attendance</Text>
          <Badge
            label={cumulativePercentage >= 75 ? 'ELIGIBLE' : 'SHORTAGE ALERT'}
            variant={cumulativePercentage >= 75 ? 'success' : 'danger'}
          />
        </View>

        <View style={styles.gaugeStatsRow}>
          <Text style={styles.gaugePercentage}>{cumulativePercentage}%</Text>
          <View style={styles.gaugeRatio}>
            <Text style={styles.gaugeRatioText}>
              {totalAttended} of {totalHeld}
            </Text>
            <Text style={styles.gaugeRatioSub}>Total Sessions Attended</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, cumulativePercentage)}%` },
              cumulativePercentage >= 75 ? styles.progressGreen : styles.progressRed,
            ]}
          />
        </View>

        {/* Statutory Recovery Advice */}
        {isCumulativeShortage ? (
          <View style={styles.shortageAlertBox}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.shortageAlertText}>
              Statutory 75% rule: You must attend the next{' '}
              <Text style={styles.boldUnderline}>{recoveryClassesNeeded} consecutive lectures</Text> to qualify for end-term exams.
            </Text>
          </View>
        ) : (
          <Text style={styles.compliantText}>
            ✓ Satisfies statutory criteria (min 75%). Keep it up!
          </Text>
        )}
      </View>

      {/* 2. Active Session Card (If attendance is taking place NOW) */}
      {activeSession && (
        <Card variant="elevated" style={styles.activeSessionCard}>
          <View style={styles.activeHeader}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ATTENDANCE LIVE NOW</Text>
            </View>
            <Text style={styles.timeTag}>
              {activeSession.start_time.slice(0, 5)} - {activeSession.end_time.slice(0, 5)}
            </Text>
          </View>

          <Text style={styles.activeSubjectName}>{activeSession.subject_name}</Text>
          <Text style={styles.activeDetails}>
            Room {activeSession.room_number} &bull; {activeSession.faculty_name}
          </Text>

          <View style={styles.activeAction}>
            <Button
              title="Open Camera QR Scanner"
              onPress={onNavigateToScan}
              size="md"
              style={styles.scanButton}
            />
          </View>
        </Card>
      )}

      {/* 3. Next Upcoming Lecture Today */}
      {nextLecture && !activeSession && (
        <Card variant="flat" style={styles.nextLectureCard}>
          <View style={styles.nextLectureRow}>
            <View>
              <Text style={styles.nextClassLabel}>UPCOMING TODAY AT {nextLecture.start_time.slice(0, 5)}</Text>
              <Text style={styles.nextSubjectTitle}>{nextLecture.subject_name}</Text>
              <Text style={styles.nextSubtitle}>
                Room {nextLecture.room_number} &bull; {nextLecture.faculty_name}
              </Text>
            </View>
            <TouchableOpacity onPress={onNavigateToTimetable} style={styles.viewScheduleBtn}>
              <Text style={styles.viewScheduleText}>Schedule →</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* 4. Subject-Wise Attendance Breakdown */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Course-Wise Attendance</Text>
        <Text style={styles.sectionSubtitle}>{subjects.length} Enrolled</Text>
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
        </View>
      ) : subjects.length === 0 ? (
        <Card variant="flat">
          <Text style={styles.emptyText}>No subject attendance records found.</Text>
        </Card>
      ) : (
        subjects.map((sub) => {
          const isShort = sub.attendance_percentage < 75;
          const subRecovery = Math.max(0, Math.ceil(3 * sub.total_held - 4 * sub.attended_count));

          return (
            <Card key={sub.subject_id} variant="elevated" style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={styles.subjectCodeContainer}>
                  <Text style={styles.subjectCode}>{sub.subject_code}</Text>
                  <Text style={styles.subjectName} numberOfLines={1}>
                    {sub.subject_name}
                  </Text>
                </View>
                <View style={styles.subjectPctBadge}>
                  <Text style={[styles.subjectPctText, isShort ? styles.textRed : styles.textGreen]}>
                    {sub.attendance_percentage}%
                  </Text>
                </View>
              </View>

              <View style={styles.subjectStatsRow}>
                <Text style={styles.subjectStatsItem}>
                  Attended: <Text style={styles.boldText}>{sub.attended_count}</Text>
                </Text>
                <Text style={styles.subjectStatsItem}>
                  Total: <Text style={styles.boldText}>{sub.total_held}</Text>
                </Text>
                <Text style={styles.subjectStatsItem}>
                  Absent: <Text style={[styles.boldText, isShort && styles.textRed]}>{sub.absent_count}</Text>
                </Text>
              </View>

              {/* Course Progress Bar */}
              <View style={styles.subProgressBar}>
                <View
                  style={[
                    styles.subProgressFill,
                    { width: `${Math.min(100, sub.attendance_percentage)}%` },
                    isShort ? styles.progressRed : styles.progressGreen,
                  ]}
                />
              </View>

              {isShort && (
                <Text style={styles.subjectRecoveryNotice}>
                  Need {subRecovery} consecutive lectures to recover 75%
                </Text>
              )}
            </Card>
          );
        })
      )}
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
  gaugeCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  gaugeGood: {
    backgroundColor: '#312e81',
    borderColor: '#4338ca',
  },
  gaugeShortage: {
    backgroundColor: '#881337',
    borderColor: '#9f1239',
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gaugeTitle: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gaugeStatsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gaugePercentage: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  gaugeRatio: {
    alignItems: 'flex-end',
  },
  gaugeRatioText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  gaugeRatioSub: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGreen: {
    backgroundColor: '#10b981',
  },
  progressRed: {
    backgroundColor: '#f43f5e',
  },
  shortageAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  alertIcon: {
    fontSize: 16,
  },
  shortageAlertText: {
    color: '#fecdd3',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  boldUnderline: {
    fontWeight: '800',
    textDecorationLine: 'underline',
    color: '#ffffff',
  },
  compliantText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '600',
  },
  activeSessionCard: {
    backgroundColor: '#ffffff',
    borderColor: '#c7d2fe',
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
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeTag: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  activeSubjectName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  activeDetails: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    marginBottom: 12,
  },
  activeAction: {
    marginTop: 4,
  },
  scanButton: {
    backgroundColor: '#4f46e5',
  },
  nextLectureCard: {
    marginBottom: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  nextLectureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextClassLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  nextSubjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  nextSubtitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  viewScheduleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  viewScheduleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  skeletonContainer: {
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    paddingVertical: 12,
  },
  subjectCard: {
    marginBottom: 10,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectCodeContainer: {
    flex: 1,
    marginRight: 8,
  },
  subjectCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  subjectPctBadge: {
    alignItems: 'flex-end',
  },
  subjectPctText: {
    fontSize: 16,
    fontWeight: '800',
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#e11d48',
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  subjectStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectStatsItem: {
    fontSize: 11,
    color: '#64748b',
  },
  subProgressBar: {
    height: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  subProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  subjectRecoveryNotice: {
    fontSize: 10,
    color: '#e11d48',
    fontWeight: '600',
    marginTop: 6,
  },
});
