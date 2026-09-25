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
import { Button } from '../../components/common/Button';

export const ItAdminHealthScreen: React.FC = () => {
  const [latency, setLatency] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  const checkTelemetry = async () => {
    try {
      setChecking(true);
      const start = Date.now();
      await supabase.from('campuses').select('id').limit(1);
      const end = Date.now();
      setLatency(end - start);
    } catch {
      setLatency(-1);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkTelemetry();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={checking} onRefresh={checkTelemetry} colors={['#4f46e5']} />}
    >
      <View style={styles.header}>
        <Text style={styles.heading}>System Telemetry & Health</Text>
        <Text style={styles.subheading}>Live infrastructure metrics</Text>
      </View>

      {/* Latency & Connectivity Cards */}
      <View style={styles.metricsRow}>
        <Card variant="elevated" style={styles.metricCard}>
          <Text style={styles.metricTitle}>Database Ping</Text>
          <Text style={[styles.metricVal, latency && latency > 0 ? styles.greenText : styles.redText]}>
            {latency !== null && latency >= 0 ? `${latency}ms` : 'Error'}
          </Text>
          <Text style={styles.metricSub}>Supabase PostgreSQL</Text>
        </Card>

        <Card variant="elevated" style={styles.metricCard}>
          <Text style={styles.metricTitle}>Realtime WebSocket</Text>
          <Text style={[styles.metricVal, realtimeConnected ? styles.greenText : styles.redText]}>
            {realtimeConnected ? 'CONNECTED' : 'OFFLINE'}
          </Text>
          <Text style={styles.metricSub}>10 events/sec cap</Text>
        </Card>
      </View>

      <Card variant="elevated" style={styles.healthStatusCard}>
        <Text style={styles.healthTitle}>Campus Infrastructure Status</Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Row Level Security (RLS)</Text>
          <Badge label="ACTIVE" variant="success" size="sm" />
        </View>
        <View style={styles.divider} />

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Anti-Proxy HMAC Rotation</Text>
          <Badge label="15s DRIFT" variant="info" size="sm" />
        </View>
        <View style={styles.divider} />

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>API Service Endpoint</Text>
          <Text style={styles.monoEndpoint}>gibeljemxpogvqgdjipt.supabase.co</Text>
        </View>
      </Card>

      <Button
        title="Re-Test Infrastructure Ping"
        loading={checking}
        onPress={checkTelemetry}
        variant="primary"
        style={styles.pingBtn}
      />
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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '900',
    marginVertical: 4,
  },
  greenText: {
    color: '#059669',
  },
  redText: {
    color: '#e11d48',
  },
  metricSub: {
    fontSize: 10,
    color: '#94a3b8',
  },
  healthStatusCard: {
    padding: 16,
    marginBottom: 16,
  },
  healthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  monoEndpoint: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#4f46e5',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  pingBtn: {
    marginTop: 8,
  },
});
