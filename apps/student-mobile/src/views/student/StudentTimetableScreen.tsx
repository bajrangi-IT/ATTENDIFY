import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

const DAYS = [
  { id: 1, name: 'Mon', full: 'Monday' },
  { id: 2, name: 'Tue', full: 'Tuesday' },
  { id: 3, name: 'Wed', full: 'Wednesday' },
  { id: 4, name: 'Thu', full: 'Thursday' },
  { id: 5, name: 'Fri', full: 'Friday' },
  { id: 6, name: 'Sat', full: 'Saturday' },
];

interface TimetableSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  subject_code: string;
  room_number: string;
  building: string;
  faculty_name: string;
}

export const StudentTimetableScreen: React.FC = () => {
  const { studentRecord } = useAuth();
  const currentDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<number>(
    currentDayOfWeek <= 6 ? currentDayOfWeek : 1
  );

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimetable = async () => {
    try {
      let sectionId = studentRecord?.current_section_id;

      if (!sectionId) {
        const { data: firstStud } = await supabase
          .from('students')
          .select('current_section_id')
          .limit(1)
          .single();
        if (firstStud) sectionId = firstStud.current_section_id;
      }

      if (!sectionId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('timetable_entries')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          classroom:classrooms(room_number, building),
          subject_offering:subject_offerings(
            subject:subjects(name, code)
          ),
          faculty:faculty(
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('section_id', sectionId)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const formatted: TimetableSlot[] = (data || []).map((s: any) => ({
        id: s.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        subject_name: s.subject_offering?.subject?.name || 'Subject',
        subject_code: s.subject_offering?.subject?.code || '',
        room_number: s.classroom?.room_number || 'TBA',
        building: s.classroom?.building || 'Main Campus',
        faculty_name: s.faculty?.profile ? `${s.faculty.profile.first_name} ${s.faculty.profile.last_name}` : 'Instructor',
      }));

      setSlots(formatted);
    } catch (err) {
      console.error('Error fetching timetable:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [studentRecord]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTimetable();
  };

  const daySlots = slots.filter((s) => s.day_of_week === selectedDay);

  return (
    <View style={styles.container}>
      {/* Day Selector Pills */}
      <View style={styles.daysContainer}>
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.id;
          const isToday = currentDayOfWeek === d.id;

          return (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.7}
              onPress={() => setSelectedDay(d.id)}
              style={[styles.dayPill, isSelected && styles.dayPillActive]}
            >
              <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                {d.name}
              </Text>
              {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayHeading}>
            {DAYS.find((d) => d.id === selectedDay)?.full}'s Schedule
          </Text>
          <Text style={styles.slotCountText}>
            {daySlots.length} {daySlots.length === 1 ? 'Lecture' : 'Lectures'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={90} borderRadius={16} />
            <Skeleton height={90} borderRadius={16} />
          </View>
        ) : daySlots.length === 0 ? (
          <EmptyState
            icon="🏖️"
            title="No Lectures Scheduled"
            description="You have no classes scheduled on this day. Use this time for self-study!"
          />
        ) : (
          daySlots.map((slot) => (
            <Card key={slot.id} variant="elevated" style={styles.slotCard}>
              <View style={styles.slotTimeColumn}>
                <Text style={styles.slotStartTime}>{slot.start_time.slice(0, 5)}</Text>
                <Text style={styles.slotEndTime}>{slot.end_time.slice(0, 5)}</Text>
              </View>

              <View style={styles.slotDivider} />

              <View style={styles.slotDetails}>
                <View style={styles.codeRow}>
                  <Text style={styles.slotCode}>{slot.subject_code}</Text>
                  <Text style={styles.roomTag}>Room {slot.room_number}</Text>
                </View>

                <Text style={styles.slotSubject} numberOfLines={1}>
                  {slot.subject_name}
                </Text>

                <Text style={styles.slotFaculty}>
                  👤 {slot.faculty_name} &bull; {slot.building}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  daysContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    justifyContent: 'space-between',
  },
  dayPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    position: 'relative',
  },
  dayPillActive: {
    backgroundColor: '#4f46e5',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  dayTextActive: {
    color: '#ffffff',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4f46e5',
    marginTop: 3,
  },
  todayDotActive: {
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  slotCountText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  skeletonBox: {
    gap: 8,
  },
  slotCard: {
    flexDirection: 'row',
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  slotTimeColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 55,
  },
  slotStartTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  slotEndTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  slotDivider: {
    width: 2,
    height: 38,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
    borderRadius: 1,
  },
  slotDetails: {
    flex: 1,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  slotCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
  },
  roomTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  slotFaculty: {
    fontSize: 11,
    color: '#64748b',
  },
});
