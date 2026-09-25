import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface AuditItem {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor_name: string;
  actor_role: string;
}

export const DirectorAuditScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fleetStats, setFleetStats] = useState({
    totalRooms: 0,
    onlineDisplays: 0,
    unpaired: 0,
  });

  const fetchAuditData = async () => {
    try {
      setLoading(true);

      // 1. Fetch latest audit logs
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          entity_type,
          created_at,
          actor:profiles(first_name, last_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;

      const formatted: AuditItem[] = (data || []).map((l: any) => ({
        id: l.id,
        action: l.action,
        entity_type: l.entity_type,
        created_at: l.created_at,
        actor_name: l.actor ? `${l.actor.first_name} ${l.actor.last_name}` : 'System',
        actor_role: l.actor?.role || 'System',
      }));
      setLogs(formatted);

      // 2. Fetch classroom kiosk fleet status
      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('device_status');

      const total = classrooms?.length || 0;
      const online = classrooms?.filter((c) => c.device_status === 'active' || c.device_status === 'paired').length || 0;
      const unpair = classrooms?.filter((c) => c.device_status === 'unpaired').length || 0;

      setFleetStats({
        totalRooms: total,
        onlineDisplays: online,
        unpaired: unpair,
      });
    } catch (err) {
      console.error('Error fetching audit data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditData();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
    >
      {/* Kiosk Fleet Telemetry */}
      <View style={styles.sectionHeader}>
        <Text style={styles.heading}>Classroom Hardware Telemetry</Text>
      </View>

      <View style={styles.fleetRow}>
        <View style={styles.fleetCard}>
          <Text style={styles.fleetVal}>{fleetStats.totalRooms}</Text>
          <Text style={styles.fleetLbl}>Total Rooms</Text>
        </View>
        <View style={styles.fleetCard}>
          <Text style={[styles.fleetVal, styles.greenText]}>{fleetStats.onlineDisplays}</Text>
          <Text style={styles.fleetLbl}>Smart Displays UP</Text>
        </View>
        <View style={styles.fleetCard}>
          <Text style={[styles.fleetVal, styles.amberText]}>{fleetStats.unpaired}</Text>
          <Text style={styles.fleetLbl}>Unpaired</Text>
        </View>
      </View>

      {/* Forensic Audit Log List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.heading}>Institutional Forensic Audit Trail</Text>
        <Text style={styles.subheading}>Immutable record of overrides & approvals</Text>
      </View>

      {loading ? (
        <View style={styles.skeletonBox}>
          <Skeleton height={65} borderRadius={16} />
          <Skeleton height={65} borderRadius={16} />
          <Skeleton height={65} borderRadius={16} />
        </View>
      ) : logs.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="No Audit Records"
          description="No administrative audit events recorded yet."
        />
      ) : (
        logs.map((item) => {
          const isDanger = item.action.includes('OVERRIDE') || item.action.includes('REJECT');
          const isSuccess = item.action.includes('APPROVE') || item.action.includes('VERIFIED');

          return (
            <Card key={item.id} variant="elevated" style={styles.auditCard}>
              <View style={styles.auditTop}>
                <Badge
                  label={item.action}
                  variant={isDanger ? 'danger' : isSuccess ? 'success' : 'default'}
                  size="sm"
                />
                <Text style={styles.auditTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>

              <Text style={styles.actorText}>
                Actor: <Text style={styles.boldText}>{item.actor_name}</Text> ({item.actor_role})
              </Text>
              <Text style={styles.entityText}>Entity: {item.entity_type}</Text>
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
  sectionHeader: {
    marginBottom: 10,
    marginTop: 6,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subheading: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  fleetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  fleetCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  fleetVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  greenText: {
    color: '#059669',
  },
  amberText: {
    color: '#d97706',
  },
  fleetLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  skeletonBox: {
    gap: 8,
  },
  auditCard: {
    marginBottom: 8,
    padding: 12,
  },
  auditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  auditTime: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  actorText: {
    fontSize: 11,
    color: '#475569',
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  entityText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
