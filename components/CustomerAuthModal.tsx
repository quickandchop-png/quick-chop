import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Modal,
  Animated, Platform, ScrollView, ActivityIndicator,
  Dimensions, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { hasUserPin, findCustomerByPhone } from '@/lib/storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type ModalStep = 'phone' | 'name' | 'pin_setup' | 'pin_verify';

interface CustomerAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialStep?: 'register' | 'pin_setup' | 'pin_verify';
}

function PinDots({ pin, length = 4 }: { pin: string; length?: number }) {
  return (
    <View style={styles.pinDots}>
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
      ))}
    </View>
  );
}

function NumPad({ onPress, onDelete }: { onPress: (n: string) => void; onDelete: () => void }) {
  const nums = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <View style={styles.numPad}>
      {nums.map((n, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [
            styles.numKey,
            n === '' && styles.numKeyEmpty,
            pressed && n !== '' && { opacity: 0.6, transform: [{ scale: 0.95 }] },
          ]}
          onPress={() => {
            if (n === '') return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (n === '⌫') onDelete();
            else onPress(n);
          }}
          disabled={n === ''}
        >
          <Text style={[styles.numKeyText, n === '⌫' && { color: Colors.error }]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CustomerAuthModal({
  visible, onClose, onSuccess, initialStep = 'register',
}: CustomerAuthModalProps) {
  const { registerCustomer, setupPin, verifyPin, user, hasPinSetup } = useAuth();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [step, setStep] = useState<ModalStep>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStage, setPinStage] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current); };
  }, []);

  useEffect(() => {
    if (visible) {
      const startStep: ModalStep =
        initialStep === 'pin_setup' ? 'pin_setup' :
        initialStep === 'pin_verify' ? 'pin_verify' : 'phone';
      setStep(startStep);
      setPhone(''); setName(''); setPin(''); setConfirmPin('');
      setPinStage('enter'); setError('');
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true,
      }).start();
    }
  }, [visible, initialStep]);

  // If user becomes set while modal is open, route to appropriate PIN step
  useEffect(() => {
    if (visible && user && (step === 'phone' || step === 'name')) {
      if (hasPinSetup) setStep('pin_verify');
      else setStep('pin_setup');
    }
  }, [visible, user, hasPinSetup]);

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true,
    }).start(() => onClose());
  }

  // Step 1: Phone submitted — check if account exists
  async function handlePhoneContinue() {
    if (!phone.trim() || phone.trim().length < 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const existing = await findCustomerByPhone(phone.trim());
      if (existing && existing.role === 'customer') {
        // Existing account — load it and go straight to PIN
        const u = await registerCustomer(phone.trim(), existing.name);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPin('');
        const alreadyHasPin = await hasUserPin(u.id);
        setStep(alreadyHasPin ? 'pin_verify' : 'pin_setup');
      } else {
        // New account — ask for name
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setStep('name');
        cleanupTimerRef.current = setTimeout(() => nameRef.current?.focus(), 200);
      }
    } catch (e: any) {
      setError(e.message || 'Could not continue. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2 (new users only): Name submitted → create account → setup PIN
  async function handleNameContinue() {
    if (!name.trim() || name.trim().length < 2) {
      setError('Enter your full name (at least 2 characters)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await registerCustomer(phone.trim(), name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPin(''); setConfirmPin(''); setPinStage('enter');
      setStep('pin_setup');
    } catch (e: any) {
      setError(e.message || 'Registration failed. Try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function handlePinSetupPress(n: string) {
    if (pinStage === 'enter') {
      if (pin.length < 4) {
        const newPin = pin + n;
        setPin(newPin);
        if (newPin.length === 4) setTimeout(() => setPinStage('confirm'), 300);
      }
    } else {
      if (confirmPin.length < 4) {
        const newConfirm = confirmPin + n;
        setConfirmPin(newConfirm);
        if (newConfirm.length === 4) setTimeout(() => handleConfirmPin(pin, newConfirm), 100);
      }
    }
  }

  function handlePinSetupDelete() {
    if (pinStage === 'confirm') setConfirmPin(p => p.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  }

  async function handleConfirmPin(entered: string, confirm: string) {
    if (entered !== confirm) {
      setError('PINs do not match. Try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPin(''); setConfirmPin(''); setPinStage('enter');
      return;
    }
    setLoading(true);
    try {
      await setupPin(entered);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
      setTimeout(() => onSuccess(), 300);
    } catch {
      setError('Failed to set PIN. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyPress(n: string) {
    if (pin.length < 4) {
      const newPin = pin + n;
      setPin(newPin);
      if (newPin.length === 4) setTimeout(() => handleVerifyPin(newPin), 100);
    }
  }

  function handleVerifyDelete() {
    setPin(p => p.slice(0, -1));
    setError('');
  }

  async function handleVerifyPin(entered: string) {
    setLoading(true);
    try {
      const ok = await verifyPin(entered);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleClose();
        setTimeout(() => onSuccess(), 300);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  }

  const isIOS = Platform.OS === 'ios';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {/* Overlay */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          {isIOS ? (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          )}
        </Pressable>

        {/* Sheet */}
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.handle} />

            {/* ── Step 1: Phone number only ── */}
            {step === 'phone' && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepIcon, { backgroundColor: Colors.primary + '18' }]}>
                    <Ionicons name="phone-portrait" size={26} color={Colors.primary} />
                  </View>
                  <Text style={styles.stepTitle}>Sign In or Register</Text>
                  <Text style={styles.stepSub}>Enter your mobile number to continue</Text>
                </View>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mobile Number (10 digits)"
                    placeholderTextColor={Colors.textTertiary}
                    value={phone}
                    onChangeText={t => { setPhone(t.replace(/\D/g, '')); setError(''); }}
                    keyboardType="phone-pad"
                    inputMode="numeric"
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={handlePhoneContinue}
                    autoFocus
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
                  onPress={handlePhoneContinue}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryLight]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={styles.actionBtnText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={styles.loginHint}>
                  Partner login?{' '}
                  <Text style={styles.loginHintLink} onPress={handleClose}>Close and use Staff Login</Text>
                </Text>
              </ScrollView>
            )}

            {/* ── Step 2: Name (new users only) ── */}
            {step === 'name' && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepIcon, { backgroundColor: Colors.primary + '18' }]}>
                    <Ionicons name="person-add" size={26} color={Colors.primary} />
                  </View>
                  <Text style={styles.stepTitle}>Create Your Account</Text>
                  <Text style={styles.stepSub}>Just your name to finish setting up</Text>
                </View>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Show phone (read-only) with a back arrow */}
                <Pressable style={[styles.inputWrap, { opacity: 0.7 }]} onPress={() => { setStep('phone'); setError(''); }}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={styles.inputIcon} />
                  <Text style={[styles.input, { color: Colors.text, paddingVertical: 14 }]}>{phone}</Text>
                  <Ionicons name="pencil-outline" size={16} color={Colors.textTertiary} style={{ marginRight: 12 }} />
                </Pressable>

                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    ref={nameRef}
                    style={styles.input}
                    placeholder="Your Full Name"
                    placeholderTextColor={Colors.textTertiary}
                    value={name}
                    onChangeText={t => { setName(t); setError(''); }}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleNameContinue}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
                  onPress={handleNameContinue}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryLight]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={styles.actionBtnText}>Create Account</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </ScrollView>
            )}

            {/* ── PIN Setup ── */}
            {step === 'pin_setup' && (
              <View style={styles.content}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepIcon, { backgroundColor: '#5433FF18' }]}>
                    <Ionicons name="keypad" size={26} color="#5433FF" />
                  </View>
                  <Text style={styles.stepTitle}>
                    {pinStage === 'enter' ? 'Set Your 4-Digit PIN' : 'Confirm Your PIN'}
                  </Text>
                  <Text style={styles.stepSub}>
                    {pinStage === 'enter' ? 'Used to confirm future orders quickly' : 'Re-enter the same PIN'}
                  </Text>
                </View>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <PinDots pin={pinStage === 'enter' ? pin : confirmPin} />
                {loading
                  ? <ActivityIndicator size="large" color="#5433FF" style={{ marginTop: 20 }} />
                  : <NumPad onPress={handlePinSetupPress} onDelete={handlePinSetupDelete} />
                }
              </View>
            )}

            {/* ── PIN Verify ── */}
            {step === 'pin_verify' && (
              <View style={styles.content}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepIcon, { backgroundColor: Colors.success + '18' }]}>
                    <Ionicons name="lock-closed" size={26} color={Colors.success} />
                  </View>
                  <Text style={styles.stepTitle}>Enter Your PIN</Text>
                  <Text style={styles.stepSub}>Confirm your identity with your 4-digit PIN</Text>
                </View>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <PinDots pin={pin} />
                {loading
                  ? <ActivityIndicator size="large" color={Colors.success} style={{ marginTop: 20 }} />
                  : <NumPad onPress={handleVerifyPress} onDelete={handleVerifyDelete} />
                }

                <Pressable style={styles.forgotPin} onPress={() => { setStep('pin_setup'); setPin(''); setError(''); setPinStage('enter'); }}>
                  <Text style={styles.forgotPinText}>Forgot PIN? Reset it</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  content: { paddingHorizontal: 24, paddingTop: 12 },
  stepHeader: { alignItems: 'center', marginBottom: 20 },
  stepIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  stepTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text, textAlign: 'center' },
  stepSub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 8 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFEBEE', padding: 10, borderRadius: 10, marginBottom: 14,
  },
  errorText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.error, flex: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 14,
    marginBottom: 12, borderWidth: 1.5, borderColor: Colors.border,
  },
  inputIcon: { paddingLeft: 12 },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, fontFamily: 'Poppins_400Regular', color: Colors.text },
  actionBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  actionBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  loginHint: { textAlign: 'center', fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 16, paddingBottom: 4 },
  loginHintLink: { color: Colors.primary, fontFamily: 'Poppins_600SemiBold' },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginVertical: 24 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent' },
  pinDotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  numPad: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 4 },
  numKey: {
    width: 74, height: 64, borderRadius: 16,
    backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  numKeyEmpty: { backgroundColor: 'transparent', borderWidth: 0 },
  numKeyText: { fontSize: 22, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  forgotPin: { alignSelf: 'center', marginTop: 20, marginBottom: 8 },
  forgotPinText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.primary },
});
