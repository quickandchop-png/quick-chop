import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, Alert,
  ScrollView, Platform, ActivityIndicator, Modal, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsDesktopWeb } from '@/components/WebSidebar';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import {
  getHomeContent, updateHomeContent, HomeContent,
  getUPIConfig, updateUPIMerchantId, verifyUPIMasterPin,
  changeUPIMasterPin, initUPIMasterPin, UPIConfig, UPIAuditEntry,
} from '@/lib/storage';

function MasterPinModal({
  visible,
  onClose,
  onSuccess,
  title,
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  title: string;
  subtitle: string;
}) {
  const [pin, setPin] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next.length === 4) {
      setTimeout(() => {
        onSuccess(next);
        setPin('');
      }, 150);
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleClose() {
    setPin('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={pinStyles.overlay} onPress={handleClose}>
        <Pressable style={pinStyles.card} onPress={e => e.stopPropagation()}>
          <View style={pinStyles.iconWrap}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
          </View>
          <Text style={pinStyles.title}>{title}</Text>
          <Text style={pinStyles.subtitle}>{subtitle}</Text>

          <Animated.View style={[pinStyles.dots, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[pinStyles.dot, i < pin.length && pinStyles.dotFilled]} />
            ))}
          </Animated.View>

          <View style={pinStyles.numpad}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [pinStyles.key, d === '' && pinStyles.keyEmpty, pressed && d && pinStyles.keyPressed]}
                onPress={() => d === '⌫' ? handleBackspace() : d && handleDigit(d)}
              >
                <Text style={[pinStyles.keyText, d === '⌫' && pinStyles.keyBackspace]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={pinStyles.cancelBtn} onPress={handleClose}>
            <Text style={pinStyles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function maskUpiId(id: string): string {
  const atIdx = id.indexOf('@');
  if (atIdx <= 0) return id;
  const local = id.slice(0, atIdx);
  const domain = id.slice(atIdx);
  if (local.length <= 3) return `${local}***${domain}`;
  return `${local.slice(0, 3)}${'*'.repeat(Math.min(local.length - 3, 5))}${domain}`;
}

function formatAuditTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ContentScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [content, setContent] = useState<HomeContent | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [upiConfig, setUpiConfig] = useState<UPIConfig | null>(null);
  const [upiUnlocked, setUpiUnlocked] = useState(false);
  const [upiEditId, setUpiEditId] = useState('');
  const [upiSaving, setUpiSaving] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalPurpose, setPinModalPurpose] = useState<'unlock' | 'save' | 'change_pin_verify' | 'change_pin_set'>('unlock');
  const [showAudit, setShowAudit] = useState(false);
  const [verifiedCurrentPin, setVerifiedCurrentPin] = useState('');

  const loadData = useCallback(async () => {
    const c = await getHomeContent();
    setContent(c);
    setVideoUrl(c.videoUrl);
    const upi = await getUPIConfig();
    setUpiConfig(upi);
    setUpiEditId(upi.merchantId);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleSaveVideo() {
    setSaving(true);
    await updateHomeContent({ videoUrl: videoUrl.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Video URL updated successfully');
    setSaving(false);
    loadData();
  }

  async function handleAddBanner() {
    if (!newBannerUrl.trim()) { Alert.alert('Error', 'Enter a banner image URL'); return; }
    const banners = [...(content?.bannerImages || []), newBannerUrl.trim()];
    await updateHomeContent({ bannerImages: banners });
    setNewBannerUrl('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  }

  async function handlePickBannerImage() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    };

    Alert.alert('Banner Image', 'Choose image source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required');
            return;
          }
          const result = await ImagePicker.launchCameraAsync(options);
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
            const banners = [...(content?.bannerImages || []), uri];
            await updateHomeContent({ bannerImages: banners });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync(options);
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
            const banners = [...(content?.bannerImages || []), uri];
            await updateHomeContent({ bannerImages: banners });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleRemoveBanner(index: number) {
    Alert.alert('Remove Banner', 'Remove this banner image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const banners = [...(content?.bannerImages || [])];
          banners.splice(index, 1);
          await updateHomeContent({ bannerImages: banners });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          loadData();
        },
      },
    ]);
  }

  function handleUnlockUPI() {
    setPinModalPurpose('unlock');
    setShowPinModal(true);
  }

  async function handlePinSuccess(pin: string) {
    setShowPinModal(false);

    if (pinModalPurpose === 'unlock') {
      const ok = await verifyUPIMasterPin(pin);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUpiUnlocked(true);
        if (!upiConfig?.masterPinHash) {
          await initUPIMasterPin(pin);
          await loadData();
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Incorrect PIN', 'The master PIN you entered is wrong.');
      }
    } else if (pinModalPurpose === 'save') {
      const ok = await verifyUPIMasterPin(pin);
      if (!ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Incorrect PIN', 'The master PIN you entered is wrong.');
        return;
      }
      if (!upiEditId.trim() || !upiEditId.includes('@')) {
        Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. shop@upi)');
        return;
      }
      setUpiSaving(true);
      const result = await updateUPIMerchantId(upiEditId, user?.name || 'Admin', pin);
      setUpiSaving(false);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('UPI ID Updated', 'The new UPI ID is now live across the app.');
        setUpiUnlocked(false);
        await loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to update UPI ID');
      }
    } else if (pinModalPurpose === 'change_pin_verify') {
      const ok = await verifyUPIMasterPin(pin);
      if (!ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Incorrect PIN', 'Current master PIN is wrong.');
        return;
      }
      setVerifiedCurrentPin(pin);
      setPinModalPurpose('change_pin_set');
      setTimeout(() => setShowPinModal(true), 300);
    } else if (pinModalPurpose === 'change_pin_set') {
      if (pin.length !== 4) return;
      const ok = await changeUPIMasterPin(verifiedCurrentPin, pin);
      setVerifiedCurrentPin('');
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('PIN Changed', 'Your new master security PIN is now active.');
        await loadData();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to change PIN. Please try again.');
      }
    }
  }

  function handleSaveUPI() {
    if (!upiEditId.trim() || !upiEditId.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Enter a valid UPI ID like yourshop@upi');
      return;
    }
    setPinModalPurpose('save');
    setShowPinModal(true);
  }

  function handleLockUPI() {
    setUpiUnlocked(false);
    setUpiEditId(upiConfig?.merchantId || '');
  }

  function handleChangePin() {
    setPinModalPurpose('change_pin_verify');
    setShowPinModal(true);
  }

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top + webTopPad }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <MasterPinModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handlePinSuccess}
        title={
          pinModalPurpose === 'unlock' ? 'Unlock UPI Settings' :
          pinModalPurpose === 'save' ? 'Confirm Changes' :
          pinModalPurpose === 'change_pin_verify' ? 'Enter Current PIN' :
          'Set New PIN'
        }
        subtitle={
          pinModalPurpose === 'unlock' ? 'Enter master security PIN to edit UPI settings' :
          pinModalPurpose === 'save' ? 'Re-enter master PIN to save new UPI ID' :
          pinModalPurpose === 'change_pin_verify' ? 'Enter your current master PIN first' :
          'Choose a new 4-digit master security PIN'
        }
      />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top + webTopPad }]}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Home Page Content</Text>
        <Text style={styles.subtitle}>Manage what customers see on the home page</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="videocam" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Offer / Promo Video</Text>
          </View>
          <Text style={styles.helpText}>Paste a video URL (MP4 link) to show on the customer home page</Text>
          <TextInput
            style={styles.urlInput}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="Enter video URL (mp4 format)"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
          />
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
            onPress={handleSaveVideo}
            disabled={saving}
          >
            <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.saveGradient}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Upload Video URL</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Banner Gallery</Text>
          </View>
          <Text style={styles.helpText}>These banners appear in the sliding gallery on the home page</Text>

          <View style={styles.bannerGrid}>
            {content?.bannerImages.map((url, index) => (
              <View key={index} style={styles.bannerCard}>
                <Image source={{ uri: url }} style={styles.bannerImage} contentFit="cover" />
                <Pressable
                  style={styles.removeBannerBtn}
                  onPress={() => handleRemoveBanner(index)}
                >
                  <Ionicons name="close-circle" size={26} color={Colors.error} />
                </Pressable>
                <Text style={styles.bannerIndex}>Banner {index + 1}</Text>
              </View>
            ))}
          </View>

          <View style={styles.addSection}>
            <Text style={styles.addLabel}>Add New Banner</Text>

            <Pressable
              style={({ pressed }) => [styles.uploadImageBtn, pressed && { opacity: 0.8 }]}
              onPress={handlePickBannerImage}
            >
              <Ionicons name="camera" size={22} color={Colors.primary} />
              <Text style={styles.uploadImageText}>Upload from Camera / Gallery</Text>
            </Pressable>

            <View style={styles.orDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.addBannerRow}>
              <TextInput
                style={styles.bannerInput}
                value={newBannerUrl}
                onChangeText={setNewBannerUrl}
                placeholder="Paste banner image URL..."
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
              />
              <Pressable
                style={({ pressed }) => [styles.addBannerBtn, pressed && { opacity: 0.8 }]}
                onPress={handleAddBanner}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        {user?.role === 'admin' && (
          <View style={[styles.section, styles.upiSection]}>
          <View style={styles.upiHeader}>
            <View style={styles.upiHeaderLeft}>
              <View style={[styles.upiIconWrap, upiUnlocked && styles.upiIconWrapUnlocked]}>
                <Ionicons name={upiUnlocked ? 'lock-open' : 'lock-closed'} size={20} color={upiUnlocked ? Colors.success : Colors.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>UPI Payment Settings</Text>
                <Text style={styles.upiAdminOnly}>Super Admin Only</Text>
              </View>
            </View>
            {!upiUnlocked ? (
              <Pressable style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.8 }]} onPress={handleUnlockUPI}>
                <Ionicons name="key" size={15} color="#fff" />
                <Text style={styles.unlockBtnText}>Unlock</Text>
              </Pressable>
            ) : (
              <Pressable style={({ pressed }) => [styles.lockBtn, pressed && { opacity: 0.8 }]} onPress={handleLockUPI}>
                <Ionicons name="lock-closed" size={15} color={Colors.textSecondary} />
                <Text style={styles.lockBtnText}>Lock</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.upiCurrentRow}>
            <Ionicons name="phone-portrait-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.upiCurrentLabel}>Active UPI ID:</Text>
            <Text style={styles.upiCurrentValue}>
              {upiUnlocked ? upiConfig?.merchantId : maskUpiId(upiConfig?.merchantId || '')}
            </Text>
          </View>

          {!upiUnlocked && (
            <View style={styles.lockedNote}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.lockedNoteText}>
                Default PIN is <Text style={styles.pinHint}>2580</Text>. Change it after first login.
              </Text>
            </View>
          )}

          {upiUnlocked && (
            <>
              <View style={styles.dividerThin} />
              <Text style={styles.editLabel}>Edit UPI Merchant ID</Text>
              <TextInput
                style={styles.urlInput}
                value={upiEditId}
                onChangeText={setUpiEditId}
                placeholder="e.g. yourshop@phonepe"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.helpText}>
                This UPI ID will be used globally for all customer payments. Any change is logged.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.saveUpiBtn, pressed && { opacity: 0.9 }]}
                onPress={handleSaveUPI}
                disabled={upiSaving}
              >
                <LinearGradient colors={['#00875A', '#00B87C']} style={styles.saveGradient}>
                  {upiSaving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.saveBtnText}>Save & Apply UPI ID</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.changePinBtn, pressed && { opacity: 0.8 }]}
                onPress={handleChangePin}
              >
                <Ionicons name="key-outline" size={16} color={Colors.primary} />
                <Text style={styles.changePinText}>Change Master Security PIN</Text>
              </Pressable>

              <Pressable
                style={styles.auditToggle}
                onPress={() => { setShowAudit(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Ionicons name={showAudit ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                <Text style={styles.auditToggleText}>
                  Audit Trail ({upiConfig?.auditTrail?.length || 0} changes)
                </Text>
              </Pressable>

              {showAudit && (
                <View style={styles.auditList}>
                  {(!upiConfig?.auditTrail || upiConfig.auditTrail.length === 0) ? (
                    <Text style={styles.auditEmpty}>No changes recorded yet.</Text>
                  ) : (
                    upiConfig.auditTrail.map((entry: UPIAuditEntry, i: number) => (
                      <View key={i} style={[styles.auditEntry, i < upiConfig.auditTrail.length - 1 && styles.auditEntryBorder]}>
                        <View style={styles.auditRow}>
                          <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                          <Text style={styles.auditTime}>{formatAuditTime(entry.timestamp)}</Text>
                          <Text style={styles.auditBy}>· {entry.changedBy}</Text>
                        </View>
                        <View style={styles.auditChange}>
                          <Text style={styles.auditOld}>{entry.previousId}</Text>
                          <Ionicons name="arrow-forward" size={12} color={Colors.textTertiary} />
                          <Text style={styles.auditNew}>{entry.newId}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const pinStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: 28,
    width: '88%', maxWidth: 360, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 20,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  title: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: 240, justifyContent: 'center', gap: 10 },
  key: {
    width: 68, height: 56, borderRadius: 14,
    backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyPressed: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  keyText: { fontSize: 20, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  keyBackspace: { fontSize: 18, color: Colors.textSecondary },
  cancelBtn: { marginTop: 20 },
  cancelText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 4, marginBottom: 20 },
  section: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  upiSection: { borderWidth: 1.5, borderColor: Colors.primary + '30' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  helpText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginBottom: 14 },
  urlInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 14, fontSize: 14,
    fontFamily: 'Poppins_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  saveBtn: { borderRadius: 12, overflow: 'hidden' },
  saveUpiBtn: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  bannerGrid: { gap: 12, marginBottom: 14 },
  bannerCard: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  bannerImage: { width: '100%', height: 130, borderRadius: 14 },
  removeBannerBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 13 },
  bannerIndex: { position: 'absolute', bottom: 8, left: 10, fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  addSection: { marginTop: 4 },
  addLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text, marginBottom: 10 },
  uploadImageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.primary + '10', borderWidth: 2, borderColor: Colors.primary + '30', borderStyle: 'dashed',
  },
  uploadImageText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerThin: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  orText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  addBannerRow: { flexDirection: 'row', gap: 10 },
  bannerInput: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 12, fontSize: 14,
    fontFamily: 'Poppins_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  addBannerBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  upiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  upiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upiIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  upiIconWrapUnlocked: { backgroundColor: Colors.success + '15' },
  upiAdminOnly: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.primary, marginTop: 1 },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  unlockBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  lockBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  upiCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  upiCurrentLabel: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  upiCurrentValue: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: Colors.text, flex: 1 },
  lockedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, padding: 10, borderRadius: 10 },
  lockedNoteText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, flex: 1 },
  pinHint: { fontFamily: 'Poppins_700Bold', color: Colors.primary },
  editLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text, marginBottom: 10 },
  changePinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08', marginBottom: 14,
  },
  changePinText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  auditToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  auditToggleText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  auditList: { marginTop: 12, backgroundColor: Colors.background, borderRadius: 12, padding: 12 },
  auditEmpty: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  auditEntry: { paddingVertical: 10 },
  auditEntryBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  auditTime: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  auditBy: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  auditChange: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  auditOld: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.error, flex: 1 },
  auditNew: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.success, flex: 1 },
});
