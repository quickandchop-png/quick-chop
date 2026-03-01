import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, ScrollView, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import CustomerAuthModal from '../../components/CustomerAuthModal';
import { LANGUAGES, Language } from '../../lib/i18n';
import { getSavedAddresses, removeSavedAddress, SavedAddress, getPickedLocation, clearPickedLocation, addSavedAddress } from '../../lib/location-store';
import { getWalletBalance } from '../../lib/storage';

type ModalStep = 'register' | 'pin_setup' | 'pin_verify';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, isGuest, hasPinSetup } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState<ModalStep>('register');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [addingFromPicker, setAddingFromPicker] = useState(false);
  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  useFocusEffect(useCallback(() => {
    async function load() {
      const saved = await getSavedAddresses();
      setSavedAddresses(saved);
      if (addingFromPicker) {
        const picked = await getPickedLocation();
        if (picked) {
          const label = picked.address.length > 30 ? picked.address.substring(0, 30) + '...' : picked.address;
          await addSavedAddress({ label, address: picked.address, latitude: picked.latitude, longitude: picked.longitude });
          await clearPickedLocation();
          const updated = await getSavedAddresses();
          setSavedAddresses(updated);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setAddingFromPicker(false);
      }
      if (user?.id) {
        const bal = await getWalletBalance(user.id);
        setWalletBalance(bal);
      }
    }
    load();
  }, [user?.id, addingFromPicker]));

  async function handleRemoveAddress(addr: SavedAddress) {
    Alert.alert(t('removeAddress'), `${addr.label}\n${addr.address}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await removeSavedAddress(addr.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const updated = await getSavedAddresses();
          setSavedAddresses(updated);
        },
      },
    ]);
  }

  function openAuth(step: ModalStep) {
    setAuthStep(step);
    setShowAuth(true);
  }

  function handleLogout() {
    Alert.alert(t('logout'), t('logoutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'), style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace('/');
        },
      },
    ]);
  }

  async function handleSelectLanguage(lang: Language) {
    Haptics.selectionAsync();
    await setLanguage(lang);
    setShowLangPicker(false);
  }

  const currentLang = LANGUAGES.find(l => l.code === language);
  const webPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      {isGuest ? (
        <>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            style={styles.profileHeader}
          >
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.userName}>{t('welcomeGuest')}</Text>
            <Text style={styles.userPhone}>{t('signUpToTrack')}</Text>
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 + webPad }} showsVerticalScrollIndicator={false}>
            <Pressable
              style={({ pressed }) => [styles.guestActionBtn, { borderColor: Colors.primary, backgroundColor: Colors.primary }, pressed && { opacity: 0.85 }]}
              onPress={() => openAuth('register')}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={[styles.guestActionText, { color: '#fff' }]}>{t('signInCreateAccount')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.background }]}
              onPress={() => setShowLangPicker(true)}
            >
              <Ionicons name="language-outline" size={22} color={Colors.text} />
              <Text style={styles.menuLabel}>{t('language')}</Text>
              <Text style={styles.langCurrent}>{currentLang?.nativeName}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.guestInfoCard}>
              <Text style={styles.guestInfoTitle}>{t('whySignUp')}</Text>
              <View style={styles.guestInfoRow}>
                <Ionicons name="bag-check" size={16} color={Colors.primary} />
                <Text style={styles.guestInfoText}>{t('trackOrders')}</Text>
              </View>
              <View style={styles.guestInfoRow}>
                <Ionicons name="notifications" size={16} color={Colors.primary} />
                <Text style={styles.guestInfoText}>{t('getNotifications')}</Text>
              </View>
              <View style={styles.guestInfoRow}>
                <Ionicons name="keypad" size={16} color={Colors.primary} />
                <Text style={styles.guestInfoText}>{t('oneTapReorder')}</Text>
              </View>
              <View style={styles.guestInfoRow}>
                <Ionicons name="heart" size={16} color={Colors.primary} />
                <Text style={styles.guestInfoText}>{t('saveFavorites')}</Text>
              </View>
            </View>
            <Pressable style={styles.partnerLink} onPress={() => router.push('/staff-login')}>
              <Text style={styles.partnerLinkText}>{t('partnerLogin')}</Text>
            </Pressable>
          </ScrollView>
        </>
      ) : (
        <>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            style={styles.profileHeader}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.userName}>{user?.name || t('customer')}</Text>
            <Text style={styles.userPhone}>{user?.phone}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{t('customer')}</Text>
            </View>
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 + webPad }} showsVerticalScrollIndicator={false}>
            <View style={styles.pinStatusCard}>
              <View style={[styles.pinStatusIcon, { backgroundColor: hasPinSetup ? Colors.success + '18' : Colors.warning + '18' }]}>
                <Ionicons name={hasPinSetup ? 'shield-checkmark' : 'keypad'} size={20} color={hasPinSetup ? Colors.success : Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pinStatusTitle}>{hasPinSetup ? t('pinActive') : t('pinNotSet')}</Text>
                <Text style={styles.pinStatusSub}>{hasPinSetup ? t('pinIsActive') : t('setPinForQuick')}</Text>
              </View>
              <Pressable
                style={[styles.pinActionBtn, { borderColor: hasPinSetup ? Colors.primary : Colors.warning }]}
                onPress={() => openAuth('pin_setup')}
              >
                <Text style={[styles.pinActionText, { color: hasPinSetup ? Colors.primary : Colors.warning }]}>
                  {hasPinSetup ? t('change') : t('setPIN')}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.walletCard, { borderColor: walletBalance >= 100 ? Colors.success + '40' : Colors.border }]}>
              <View style={[styles.walletIconCircle, { backgroundColor: walletBalance >= 100 ? Colors.success + '18' : Colors.textTertiary + '18' }]}>
                <Ionicons name="wallet" size={22} color={walletBalance >= 100 ? Colors.success : Colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletTitle}>{t('walletBalance')}</Text>
                <Text style={[styles.walletAmount, { color: walletBalance >= 100 ? Colors.success : Colors.text }]}>
                  {'\u20B9'}{walletBalance.toFixed(2)}
                </Text>
                <Text style={[styles.walletSub, { color: walletBalance >= 100 ? Colors.success : Colors.textTertiary }]}>
                  {walletBalance >= 100 ? t('walletAvailable') : t('walletReach100')}
                </Text>
              </View>
            </View>

            <View style={styles.menuSection}>
              {[
                { icon: 'receipt-outline' as const, label: t('myOrders'), onPress: () => router.push('/(customer)/orders') },
                { icon: 'cart-outline' as const, label: t('myCart'), onPress: () => router.push('/(customer)/cart') },
                { icon: 'language-outline' as const, label: t('language'), extra: currentLang?.nativeName, onPress: () => setShowLangPicker(true) },
                { icon: 'heart-outline' as const, label: t('favorites'), onPress: () => Alert.alert(t('comingSoon'), t('favoritesComingSoon')) },
                { icon: 'location-outline' as const, label: t('savedAddresses'), extra: savedAddresses.length > 0 ? String(savedAddresses.length) : undefined, onPress: () => setShowAddresses(true) },
                { icon: 'help-circle-outline' as const, label: t('helpSupport'), onPress: () => Alert.alert(t('support'), t('contactUs')) },
              ].map((item, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.background }]}
                  onPress={item.onPress}
                >
                  <Ionicons name={item.icon} size={22} color={Colors.text} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.extra && <Text style={styles.langCurrent}>{item.extra}</Text>}
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color={Colors.error} />
              <Text style={styles.logoutText}>{t('signOut')}</Text>
            </Pressable>
          </ScrollView>
        </>
      )}

      <CustomerAuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => setShowAuth(false)}
        initialStep={authStep}
      />

      <Modal visible={showAddresses} transparent animationType="slide" onRequestClose={() => setShowAddresses(false)}>
        <View style={styles.langOverlay}>
          <Pressable style={styles.langBackdrop} onPress={() => setShowAddresses(false)} />
          <View style={[styles.addrSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
            <View style={styles.langHandle} />
            <Text style={styles.langTitle}>{t('savedAddresses')}</Text>
            {savedAddresses.length === 0 ? (
              <View style={styles.addrEmpty}>
                <Ionicons name="location-outline" size={36} color={Colors.textTertiary} />
                <Text style={styles.addrEmptyTitle}>{t('noSavedAddresses')}</Text>
                <Text style={styles.addrEmptyDesc}>Save addresses from Cart when placing an order</Text>
              </View>
            ) : (
              <FlatList
                data={savedAddresses}
                keyExtractor={item => item.id}
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <View style={styles.addrCard}>
                    <View style={styles.addrIconCircle}>
                      <Ionicons
                        name={item.label === 'Home' ? 'home' : item.label === 'Work' ? 'briefcase' : 'location'}
                        size={18}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLabel}>{item.label}</Text>
                      <Text style={styles.addrText} numberOfLines={2}>{item.address}</Text>
                    </View>
                    <Pressable
                      style={styles.addrRemoveBtn}
                      onPress={() => handleRemoveAddress(item)}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    </Pressable>
                  </View>
                )}
              />
            )}
            <Pressable
              style={styles.addrAddBtn}
              onPress={() => {
                setShowAddresses(false);
                setAddingFromPicker(true);
                router.push('/location-picker');
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.addrAddBtnText}>Add New Address</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={() => setShowLangPicker(false)}>
        <View style={styles.langOverlay}>
          <Pressable style={styles.langBackdrop} onPress={() => setShowLangPicker(false)} />
          <View style={[styles.langSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
            <View style={styles.langHandle} />
            <Text style={styles.langTitle}>{t('selectLanguage')}</Text>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[styles.langOption, language === lang.code && styles.langOptionActive]}
                onPress={() => handleSelectLanguage(lang.code)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.langName, language === lang.code && styles.langNameActive]}>{lang.nativeName}</Text>
                  <Text style={styles.langNameEn}>{lang.name}</Text>
                </View>
                {language === lang.code && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  profileHeader: {
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20,
    alignItems: 'center', gap: 6,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  userName: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', marginTop: 4 },
  userPhone: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  pinStatusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, marginHorizontal: 20, marginTop: 20, marginBottom: 4,
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
  },
  pinStatusIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pinStatusTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  pinStatusSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  pinActionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5 },
  pinActionText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  walletCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    backgroundColor: Colors.surface, marginHorizontal: 20, marginTop: 12, marginBottom: 4,
    padding: 18, borderRadius: 16, borderWidth: 1,
  },
  walletIconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const },
  walletTitle: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary, marginBottom: 2 },
  walletAmount: { fontSize: 22, fontFamily: 'Poppins_700Bold' },
  walletSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },
  menuSection: { marginTop: 16, paddingHorizontal: 20, gap: 2 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 6,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Poppins_500Medium', color: Colors.text },
  langCurrent: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.primary, marginRight: 4 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 10, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.error + '40',
  },
  logoutText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.error },

  guestActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 18,
    borderWidth: 1.5,
  },
  guestActionText: { flex: 1, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  guestInfoCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  guestInfoTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 4 },
  guestInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guestInfoText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  partnerLink: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  partnerLinkText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, opacity: 0.6 },

  addrSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
  },
  addrEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  addrEmptyTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  addrEmptyDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center' },
  addrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  addrIconCircle: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  addrLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  addrText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },
  addrRemoveBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.error + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  addrAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, marginTop: 12,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
  },
  addrAddBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },

  langOverlay: { flex: 1, justifyContent: 'flex-end' },
  langBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  langSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
  },
  langHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  langTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 6,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  langOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  langName: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  langNameActive: { color: Colors.primary },
  langNameEn: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 1 },
});
