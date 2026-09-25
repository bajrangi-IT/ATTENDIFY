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
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface LiveClassItem {
  id: string;
  department_name: string;
  section_name: string;
  subject_name: string;
  subject_code: string;
  room_number: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  status: string;
  present_count: number;
  total_students: number;
}

interface DirectorHomeScreenProps {
  onNavigateToApprovals: () => void;
  onNavigateToStudents: () => void;
}

export const DirectorHomeScreen: React.FC<DirectorHomeScreenProps> = ({
  onNavigateToApprovals,
  onNavigateToStudents,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    totalDepartments: 0,
    activeSessionsCount: 0,
  });

  const [liveClasses, setLiveClasses] = useState<LiveClassItem[]>([]);

  const loadDirectorData = async () => {
    try {
      setLoading(true);

      // 1. Core KPIs
      const [studRes, facRes, deptRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('faculty').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
      ]);

      // 2. Fetch live classes today
      const today = new Date().toISOString().slice(0, 10);
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          start_time,
          end_time,
          status,
          section_id,
          section:sections(
            name,
            semester:semesters(
              program:programs(
                department:departments(name)
              )
            )
          ),
          classroom:classrooms(room_number),
          subject_offering:subject_offerings(
            subject:subjects(name, code)
          ),
          faculty:faculty(
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('session_date', today)
        .order('start_time', { ascending: true });

      const formattedClasses: LiveClassItem[] = await Promise.all(
        (sessions || []).map(async (s: any) => {
          // Count present students
          const { count: presentCnt } = await supabase
            .from('attendance_records')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', s.id)
            .eq('status', 'present');

          const { count: totalCnt } = await supabase
            .from('attendance_records')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', s.id);

          return {
            id: s.id,
            department_name: s.section?.semester?.program?.department?.name || 'Engineering',
            section_name: s.section?.name || 'Section',
            subject_name: s.subject_offering?.subject?.name || 'Lecture',
            subject_code: s.subject_offering?.subject?.code || '',
            room_number: s.classroom?.room_number || 'TBA',
            teacher_name: s.faculty?.profile ? `${s.faculty.profile.first_name} ${s.faculty.profile.last_name}` : 'Faculty',
            start_time: s.start_time,
            end_time: s.end_time,
            status: s.status,
            present_count: presentCnt || 0,
            total_students: totalCnt || 40,
          };
        })
      );

      setLiveClasses(formattedClasses);
      setStats({
        totalStudents: studRes.count || 0,
        totalFaculty: facRes.count || 0,
        totalDepartments: deptRes.count || 0,
        activeSessionsCount: formattedClasses.filter((c) => c.status === 'in_progress').length,
      });
    } catch (err) {
      console.error('Director dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDirectorData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDirectorData();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
    >
      {/* Executive Header Banner */}
      <View style={styles.execBanner}>
        <Text style={styles.execLabel}>DIRECTOR & DEAN CONSOLE</Text>
        <Text style={styles.execTitle}>Institution Live Operations</Text>
        <Text style={styles.execSub}>
          Apex Institute of Technology & Science &bull; Master College Oversight
        </Text>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{stats.totalStudents}</Text>
            <Text style={styles.kpiTitle}>Enrolled Students</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{stats.totalFaculty}</Text>
            <Text style={styles.kpiTitle}>Faculty Staff</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiVal, styles.greenText]}>{stats.activeSessionsCount}</Text>
            <Text style={styles.kpiTitle}>Live Lectures Now</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{stats.totalDepartments}</Text>
            <Text style={styles.kpiTitle}>Departments</Text>
          </View>
        </View>
      </View>

      {/* Quick Action Pills */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onNavigateToApprovals}
          style={styles.quickPill}
        >
          <Text style={styles.quickPillIcon}>📝</Text>
          <Text style={styles.quickPillText}>Review Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onNavigateToStudents}
          style={styles.quickPill}
        >
          <Text style={styles.quickPillIcon}>🎓</Text>
          <Text style={styles.quickPillText}>Student Directory</Text>
        </TouchableOpacity>
      </View>

      {/* Live Classes Monitor */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionHeading}>Live Campus Class Monitor</Text>
          <Text style={styles.sectionSub}>All departments active today</Text>
        </View>
        <Badge
          label={`${liveClasses.filter((c) => c.status === 'in_progress').length} ACTIVE`}
          variant="danger"
          size="sm"
        />
      </View>

      {loading ? (
        <View style={styles.skeletonBox}>
          <Skeleton height={90} borderRadius={16} />
          <Skeleton height={90} borderRadius={16} />
        </View>
      ) : liveClasses.length === 0 ? (
        <EmptyState
          icon="🏛️"
          title="No Sessions Scheduled Today"
          description="There are no classroom lectures or attendance sessions scheduled for today."
        />
      ) : (
        liveClasses.map((item) => (
          <Card key={item.id} variant="elevated" style={styles.classCard}>
            <View style={styles.classTopRow}>
              <View style={styles.classLeft}>
                <Text style={styles.deptBadge}>{item.department_name}</Text>
                <Text style={styles.classSubjectTitle}>{item.subject_name}</Text>
                <Text style={styles.classInstructor}>
                  👤 {item.teacher_name} &bull; Room {item.room_number} ({item.section_name})
                </Text>
              </View>

              <View style={styles.classRight}>
                <Badge
                  label={item.status}
                  variant={
                    item.status === 'in_progress' ? 'danger' :
                    item.status === 'completed' ? 'success' : 'default'
                  }
                />
                <Text style={styles.timeLabel}>
                  {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                </Text>
              </View>
            </View>

            {/* Live Headcount Gauge */}
            <View style={styles.headcountRow}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${item.total_students > 0 ? Math.min(100, Math.round((item.present_count / item.total_students) * 100)) : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.headcountText}>
                {item.present_count} / {item.total_students} Present
              </Text>
            </View>
          </Card>
        ))
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
  execBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  execLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 0.5,
  },
  execTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  execSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    marginBottom: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.06)',
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
  greenText: {
    color: '#34d399',
  },
  kpiTitle: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 2,
    fontWeight: '600',
  },
  quickBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickPillIcon: {
    fontSize: 16,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748b',
  },
  skeletonBox: {
    gap: 8,
  },
  classCard: {
    marginBottom: 10,
    padding: 14,
  },
  classTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  classLeft: {
    flex: 1,
    marginRight: 8,
  },
  deptBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  classSubjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  classInstructor: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  classRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  timeLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  headcountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  barContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  headcountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
});
