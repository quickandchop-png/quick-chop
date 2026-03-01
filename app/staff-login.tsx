import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';

export default function StaffLoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminHint, setShowAdminHint] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleLogoTap() {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAdminHint(true);
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    }
  }
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
        setError('Invalid phone number or password');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (u.role === 'admin') {
        setError('Admin access is not available here');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (u.role === 'customer') {
        setError('This portal is for staff only. Please use the customer app.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (u.role === 'shopowner') router.replace('/(shopowner)');
        else if (u.role === 'delivery') router.replace('/(delivery)');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLogging(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
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
          colors={['#1A237E', '#283593', '#3949AB']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + webTopPad + 20 }]}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.logoRow}>
            <Pressable onPress={handleLogoTap}>
              <Image
                source={require('../assets/images/splash-icon.png')}
                style={styles.logoImage}
                contentFit="contain"
              />
            </Pressable>
            <View>
              <Text style={styles.logoText}>Staff Portal</Text>
              <Text style={styles.tagline}>Quick & Chop Management</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.formContainer}>
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Staff Sign In</Text>
            <Text style={styles.subtitle}>For Shop Owners & Delivery Partners</Text>

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
                placeholder="Mobile Number"
                placeholderTextColor={Colors.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="next"
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
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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
                colors={['#1A237E', '#3949AB']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {logging ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Demo Accounts</Text>
            <View style={styles.demoGrid}>
              {[
                { label: 'Shop Owner', phone: '8888888888', pass: 'shop123', icon: 'storefront' as const },
                { label: 'Delivery', phone: '6666666666', pass: 'deliver123', icon: 'bicycle' as const },
              ].map((demo) => (
                <Pressable
                  key={demo.label}
                  style={({ pressed }) => [styles.demoChip, pressed && { opacity: 0.8 }]}
                  onPress={() => { setPhone(demo.phone); setPassword(demo.pass); }}
                >
                  <Ionicons name={demo.icon} size={16} color="#3949AB" />
                  <Text style={styles.demoChipText}>{demo.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {showAdminHint && (
            <Pressable
              style={styles.adminHintCard}
              onPress={() => { setShowAdminHint(false); router.push('/super-secret-admin'); }}
            >
              <View style={styles.adminHintIcon}>
                <Ionicons name="shield-checkmark" size={18} color="#FF6B35" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminHintTitle}>Admin Access</Text>
                <Text style={styles.adminHintSub}>Tap to open the restricted admin portal</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FF6B35" />
            </Pressable>
          )}
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
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoImage: { width: 52, height: 52 },
  logoText: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff' },
  tagline: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: -2 },
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
  loginGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  loginBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  demoSection: { marginTop: 20, paddingHorizontal: 4 },
  demoTitle: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary, textAlign: 'center', marginBottom: 10 },
  demoGrid: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  demoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: '#3949AB30',
  },
  demoChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: '#3949AB' },
  adminHintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 16, marginHorizontal: 4,
    backgroundColor: '#1A0A00', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)',
  },
  adminHintIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,107,53,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  adminHintTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#FF6B35' },
  adminHintSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(255,107,53,0.6)', marginTop: 1 },
});
