import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
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

interface ClassroomDevice {
  id: string;
  room_number: string;
  building: string;
  floor: number;
  capacity: number;
  device_pairing_code: string | null;
  device_status: 'unpaired' | 'paired' | 'active' | 'offline' | 'error';
  device_identifier: string | null;
  last_ping_at: string | null;
}

export const ItAdminDevicesScreen: React.FC = () => {
  const { profile } = useAuth();
  const [classrooms, setClassrooms] = useState<ClassroomDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pairing PIN modal
  const [pairingRoom, setPairingRoom] = useState<ClassroomDevice | null>(null);
  const [generatedPin, setGeneratedPin] = useState('');

  const fetchFleet = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .order('room_number');

      if (error) throw error;
      setClassrooms(data || []);
    } catch (err) {
      console.error('Error fetching fleet:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFleet();
  };

  // Generate 6-Digit PIN
  const handleGeneratePin = async (room: ClassroomDevice) => {
    try {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const { error } = await supabase
        .from('classrooms')
        .update({
          device_pairing_code: pin,
          device_status: 'unpaired',
        })
        .eq('id', room.id);

      if (error) throw error;

      await supabase.from('device_pairing_records').insert({
        classroom_id: room.id,
        pairing_code: pin,
        device_identifier: 'PENDING_MOBILE_PIN_INPUT',
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'DEVICE_PAIRING_PIN_ISSUED',
        entity_type: 'classroom',
        entity_id: room.id,
        details: { room: room.room_number, pin },
      });

      setGeneratedPin(pin);
      setPairingRoom(room);
      fetchFleet();
    } catch (err: any) {
      Alert.alert('PIN Generation Error', err.message || 'Could not generate code.');
    }
  };

  // Revoke device
  const handleRevokeDevice = async (room: ClassroomDevice) => {
    Alert.alert(
      `Revoke Display for Room ${room.room_number}?`,
      'This will disconnect the classroom kiosk and require technician re-pairing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Device',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('classrooms')
                .update({
                  device_status: 'unpaired',
                  device_identifier: null,
                  device_pairing_code: null,
                })
                .eq('id', room.id);

              if (error) throw error;

              await supabase.from('audit_logs').insert({
                actor_id: profile?.id,
                action: 'DEVICE_REVOCATION_MOBILE',
                entity_type: 'classroom',
                entity_id: room.id,
                details: { room: room.room_number },
              });

              Alert.alert('Device Revoked', `Room ${room.room_number} is now unpaired.`);
              fetchFleet();
            } catch (err: any) {
              Alert.alert('Revocation Error', err.message || 'Failed to revoke.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Smart Display Kiosk Fleet</Text>
          <Text style={styles.subheading}>{classrooms.length} Classrooms Provisioned</Text>
        </View>

        {loading ? (
          <View style={styles.skeletonBox}>
            <Skeleton height={85} borderRadius={16} />
            <Skeleton height={85} borderRadius={16} />
          </View>
        ) : classrooms.length === 0 ? (
          <EmptyState
            icon="📺"
            title="No Classrooms Registered"
            description="There are no classroom display devices configured."
          />
        ) : (
          classrooms.map((room) => {
            const isPaired = room.device_status === 'active' || room.device_status === 'paired';

            return (
              <Card key={room.id} variant="elevated" style={styles.deviceCard}>
                <View style={styles.deviceTop}>
                  <View>
                    <Text style={styles.roomTitle}>Room {room.room_number}</Text>
                    <Text style={styles.buildingText}>
                      {room.building} &bull; Floor {room.floor} ({room.capacity} seats)
                    </Text>
                  </View>

                  <Badge
                    label={room.device_status}
                    variant={
                      room.device_status === 'active' ? 'success' :
                      room.device_status === 'paired' ? 'info' :
                      room.device_status === 'unpaired' ? 'warning' : 'danger'
                    }
                  />
                </View>

                <View style={styles.identifierBox}>
                  <Text style={styles.identifierLabel}>HARDWARE MAC / PIN:</Text>
                  <Text style={styles.identifierValue}>
                    {room.device_identifier || (room.device_pairing_code ? `PIN: ${room.device_pairing_code}` : 'None')}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <Button
                    title={isPaired ? 'Rotate PIN' : 'Pair Device'}
                    size="sm"
                    variant="primary"
                    onPress={() => handleGeneratePin(room)}
                    style={styles.actionBtn}
                  />

                  {room.device_identifier && (
                    <Button
                      title="Revoke"
                      size="sm"
                      variant="danger"
                      onPress={() => handleRevokeDevice(room)}
                      style={styles.actionBtn}
                    />
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Pairing PIN Modal */}
      {pairingRoom && (
        <Modal
          visible={!!pairingRoom}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setPairingRoom(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Kiosk Pairing PIN</Text>
              <Text style={styles.modalSubtitle}>
                Enter this code on the smart board in Room {pairingRoom.room_number}
              </Text>

              <View style={styles.pinBox}>
                <Text style={styles.pinText}>{generatedPin}</Text>
              </View>

              <Text style={styles.pinExpiryText}>
                ⏱️ Valid for 15 minutes. Automatically invalidates after timeout.
              </Text>

              <Button
                title="Done"
                onPress={() => setPairingRoom(null)}
                style={styles.doneBtn}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
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
  deviceCard: {
    marginBottom: 10,
    padding: 14,
  },
  deviceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  roomTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  buildingText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  identifierBox: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  identifierLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
  },
  identifierValue: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#0f172a',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
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
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  pinBox: {
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#4f46e5',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  pinText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1e1b4b',
    fontFamily: 'monospace',
    letterSpacing: 8,
  },
  pinExpiryText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
    marginBottom: 20,
  },
  doneBtn: {
    width: '100%',
  },
});
