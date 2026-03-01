import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      setError('Please enter phone number and password');
      return;
    }
    setError('');
    setLogging(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const u = await login(phone.trim(), password.trim());
      if (!u) {
        setError('Invalid credentials');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (u.role !== 'admin') {
        setError('This portal is for Admin access only');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(admin)');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLogging(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0D0D0D' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1A0A00', '#3D1200', '#6B2200']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + webTopPad + 20 }]}
        >
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Ionicons name="shield-checkmark" size={30} color="#FF6B35" />
            </View>
            <View>
              <Text style={styles.logoText}>Admin Portal</Text>
              <Text style={styles.tagline}>Restricted Access</Text>
            </View>
          </View>
          <View style={styles.warningBadge}>
            <Ionicons name="warning" size={14} color="#FF6B35" />
            <Text style={styles.warningText}>Authorised Personnel Only</Text>
          </View>
        </LinearGradient>

        <View style={styles.formContainer}>
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Admin Sign In</Text>
            <Text style={styles.subtitle}>Enter your admin credentials to continue</Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Admin Phone Number"
                placeholderTextColor={Colors.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="next"
                autoFocus
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={handleLogin}
              disabled={logging}
            >
              <LinearGradient
                colors={['#6B2200', '#FF4500']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {logging
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="shield-checkmark" size={18} color="#fff" />
                      <Text style={styles.loginBtnText}>Access Admin Panel</Text>
                    </>
                }
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={Colors.textTertiary} />
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
        <View style={{ height: Platform.OS === 'web' ? 34 : insets.bottom + 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(255,107,53,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)',
  },
  logoText: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff' },
  tagline: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,107,53,0.8)', marginTop: -2 },
  warningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,107,53,0.1)', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 20, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)',
  },
  warningText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: '#FF6B35' },
  formContainer: { marginTop: -24, paddingHorizontal: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: 24,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 20, elevation: 8,
  },
  welcomeText: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginBottom: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFEBEE', padding: 12, borderRadius: 12, marginBottom: 16,
  },
  errorText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.error, flex: 1 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 14,
    marginBottom: 14, borderWidth: 1.5, borderColor: Colors.border,
  },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Poppins_400Regular', color: Colors.text },
  eyeBtn: { padding: 14 },
  loginBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  loginGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  loginBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  backLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 20, paddingVertical: 12,
  },
  backLinkText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
});
