import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth, ROLE_SEED_EMAILS } from '../../context/AuthContext';
import { UserRole } from '@campusattend/shared-types';
import { Button } from '../../components/common/Button';

export const LoginScreen: React.FC = () => {
  const { signIn, switchRole, resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('CampusAttend@2026');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your institutional email and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (res.error) {
      Alert.alert('Authentication Failed', res.error);
    }
  };

  const handleQuickPersonaSelect = (role: UserRole) => {
    const seedEmail = ROLE_SEED_EMAILS[role];
    setEmail(seedEmail);
    setPassword('CampusAttend@2026');
    switchRole(role);
  };

  const handleForgotPassword = () => {
    Alert.prompt
      ? Alert.prompt(
          'Password Reset',
          'Enter your registered institutional email address:',
          async (text) => {
            if (text) {
              const res = await resetPassword(text);
              if (res.error) {
                Alert.alert('Error', res.error);
              } else {
                Alert.alert('Dispatched', 'Password reset instructions have been emailed.');
              }
            }
          }
        )
      : Alert.alert('Password Reset', 'Contact campus IT administration to initiate a password reset token.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>🎓</Text>
          </View>
          <Text style={styles.appTitle}>CampusAttend OS</Text>
          <Text style={styles.appSubtitle}>Enterprise Attendance & Academic ERP</Text>
        </View>

        {/* Credentials Form */}
        <View style={styles.formCard}>
          <Text style={styles.formHeading}>Institutional Sign In</Text>

          <Text style={styles.inputLabel}>Institutional Email</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. name@campusattend.edu"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••••"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In to CampusAttend"
            loading={isSubmitting || loading}
            onPress={handleLogin}
            style={styles.loginBtn}
          />

          {/* No Signup Policy notice */}
          <Text style={styles.policyNotice}>
            🔒 Self-registration is restricted. Accounts are provisioned and authorized by College Administration.
          </Text>
        </View>

        {/* 1-Tap Persona Switcher for Mobile Evaluation */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.quickHeading}>1-Tap Demo Role Switcher</Text>
          <View style={styles.rolesRow}>
            {(['student', 'faculty', 'hod', 'director', 'it_admin'] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                activeOpacity={0.7}
                onPress={() => handleQuickPersonaSelect(r)}
                style={styles.roleButton}
              >
                <Text style={styles.roleBtnText}>{r.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  formHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 14,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  loginBtn: {
    marginBottom: 14,
  },
  policyNotice: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 14,
  },
  quickAccessSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  quickHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  roleButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  roleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
    textTransform: 'capitalize',
  },
});
