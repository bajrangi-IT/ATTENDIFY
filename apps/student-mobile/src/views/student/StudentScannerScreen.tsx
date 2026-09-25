import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { verifyDynamicQrToken } from '@campusattend/attendance-sdk';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

interface StudentScannerScreenProps {
  onCheckinSuccess?: () => void;
}

export const StudentScannerScreen: React.FC<StudentScannerScreenProps> = ({
  onCheckinSuccess,
}) => {
  const { profile, studentRecord } = useAuth();
  const { sendLocalNotification } = useNotifications();
  const [permission, requestPermission] = useCameraPermissions();

  const [isScanning, setIsScanning] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    timestamp?: string;
  } | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || verifying) return;
    setIsScanning(false);
    setVerifying(true);

    try {
      // 1. Parse QR payload
      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new Error('Unrecognized QR format. Please scan classroom Smart Board.');
      }

      const { session_id, token, epoch_window, classroom_id } = payload;
      if (!session_id || !token || epoch_window === undefined) {
        throw new Error('Invalid CampusAttend dynamic token structure.');
      }

      // 2. Fetch active session from Database
      const { data: session, error: sessErr } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          status,
          section_id,
          secret_seed,
          is_attendance_locked,
          classroom:classrooms(room_number),
          subject_offering:subject_offerings(
            subject:subjects(name, code)
          )
        `)
        .eq('id', session_id)
        .maybeSingle();

      if (sessErr || !session) {
        throw new Error('Lecture session not found or cancelled.');
      }

      if (session.status !== 'in_progress') {
        throw new Error(`Session is currently ${session.status}. Attendance is closed.`);
      }

      if (session.is_attendance_locked) {
        throw new Error('Attendance for this session has been locked by instructor.');
      }

      // 3. Resolve student ID
      let sId = studentRecord?.id;
      if (!sId) {
        const { data: sData } = await supabase
          .from('students')
          .select('id, current_section_id')
          .eq('profile_id', profile?.id)
          .maybeSingle();
        if (sData) {
          sId = sData.id;
        }
      }

      if (!sId) {
        throw new Error('Student registration record not found for active user.');
      }

      // 4. Atomic PostgreSQL Transaction & Dynamic QR Cryptographic Validation
      const { data: scanResult, error: scanRpcErr } = await supabase.rpc('rpc_submit_qr_attendance', {
        p_session_id: session_id,
        p_student_id: sId,
        p_qr_token: token,
        p_epoch_window: epoch_window,
        p_device_fingerprint: 'mobile-app-client',
        p_geo_lat: null,
        p_geo_lng: null,
      });

      if (scanRpcErr) {
        throw new Error(scanRpcErr.message || 'Attendance transaction failed.');
      }

      if (!scanResult || !scanResult.success) {
        throw new Error(scanResult?.error || 'Check-in rejected by institutional attendance policy.');
      }

      const isAlreadyMarked = scanResult.status === 'already_marked';
      const markedAt = scanResult.marked_at || new Date().toISOString();
      const subjectName = (session as any)?.subject_offering?.subject?.name || 'Class Lecture';
      const roomNum = (session as any)?.classroom?.room_number || 'Hall';

      // 7. Audit Log Entry
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'DYNAMIC_QR_CHECKIN_VERIFIED',
        entity_type: 'attendance_record',
        details: {
          session_id: session_id,
          subject: subjectName,
          room: roomNum,
          epoch_window,
        },
      });

      // 8. Trigger local notification
      sendLocalNotification({
        title: 'Attendance Confirmed!',
        message: `Verified present for ${subjectName} in Room ${roomNum}.`,
        type: 'attendance_result',
      });

      setVerificationResult({
        success: true,
        title: 'Attendance Verified!',
        message: `Successfully checked in for ${subjectName} in Room ${roomNum}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      onCheckinSuccess?.();
    } catch (err: any) {
      setVerificationResult({
        success: false,
        title: 'Check-In Denied',
        message: err.message || 'Verification failed. Please try again.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const resetScanner = () => {
    setVerificationResult(null);
    setIsScanning(true);
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.permissionText}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>
          CampusAttend uses your device camera to scan the dynamic rotating QR code on classroom smart boards.
        </Text>
        <Button title="Grant Camera Permission" onPress={requestPermission} style={styles.permButton} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Result Card Overlay */}
      {verificationResult ? (
        <View style={styles.resultContainer}>
          <Card
            variant="elevated"
            style={[
              styles.resultCard,
              verificationResult.success ? styles.resultSuccess : styles.resultError,
            ]}
          >
            <Text style={styles.resultEmoji}>
              {verificationResult.success ? '✅' : '❌'}
            </Text>
            <Text style={styles.resultTitle}>{verificationResult.title}</Text>
            <Text style={styles.resultMessage}>{verificationResult.message}</Text>
            {verificationResult.timestamp && (
              <Text style={styles.resultTime}>
                Logged at: {verificationResult.timestamp}
              </Text>
            )}

            <Button
              title={verificationResult.success ? 'Scan Another Class' : 'Try Again'}
              onPress={resetScanner}
              variant={verificationResult.success ? 'primary' : 'secondary'}
              style={styles.retryButton}
            />
          </Card>
        </View>
      ) : (
        /* Camera Viewfinder */
        <View style={styles.cameraWrapper}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          />

          {/* Viewfinder Target Overlay */}
          <View style={styles.overlay}>
            <View style={styles.unfocusedTop} />
            <View style={styles.middleRow}>
              <View style={styles.unfocusedSide} />
              <View style={styles.targetFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />

                {verifying && (
                  <View style={styles.verifyingOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.verifyingText}>Verifying HMAC Token...</Text>
                  </View>
                )}
              </View>
              <View style={styles.unfocusedSide} />
            </View>
            <View style={styles.unfocusedBottom}>
              <Text style={styles.instructionText}>
                Point camera at the rotating QR on your classroom display
              </Text>
              <Text style={styles.subInstructionText}>
                Rotating dynamic token with anti-proxy drift protection
              </Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  permissionText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  permButton: {
    width: '100%',
    maxWidth: 240,
  },
  cameraWrapper: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  unfocusedTop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 260,
  },
  unfocusedSide: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  targetFrame: {
    width: 260,
    height: 260,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#4f46e5',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  verifyingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  unfocusedBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  instructionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subInstructionText: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultCard: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
    borderRadius: 24,
  },
  resultSuccess: {
    borderTopWidth: 6,
    borderTopColor: '#10b981',
  },
  resultError: {
    borderTopWidth: 6,
    borderTopColor: '#e11d48',
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  resultTime: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#64748b',
    marginBottom: 16,
  },
  retryButton: {
    width: '100%',
    marginTop: 8,
  },
});
