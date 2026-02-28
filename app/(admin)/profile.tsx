import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { LANGUAGES, Language } from '@/lib/i18n';
import { useIsDesktopWeb } from '@/components/WebSidebar';

export default function AdminProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;

  const currentLang = LANGUAGES.find(l => l.code === language);

  async function handleSelectLanguage(lang: Language) {
    Haptics.selectionAsync();
    await setLanguage(lang);
    setShowLangPicker(false);
  }

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await logout();
        router.replace('/');
      }},
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="shield-checkmark" size={36} color={Colors.primaryDark} />
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userPhone}>{user?.phone}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{t('superAdmin')}</Text></View>
      </LinearGradient>

      <View style={styles.menuSection}>
        {[
          { icon: 'people-outline' as const, label: t('manageUsers'), onPress: () => router.push('/(admin)/users') },
          { icon: 'images-outline' as const, label: t('contentManagement'), onPress: () => router.push('/(admin)/content') },
          { icon: 'storefront-outline' as const, label: t('manageShops'), onPress: () => router.push('/(admin)/shops') },
          { icon: 'language-outline' as const, label: t('language'), extra: currentLang?.nativeName, onPress: () => setShowLangPicker(true) },
          { icon: 'help-circle-outline' as const, label: t('helpSupport'), onPress: () => Alert.alert(t('support'), t('contactUs')) },
        ].map((item, i) => (
          <Pressable key={i} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.background }]} onPress={item.onPress}>
            <Ionicons name={item.icon} size={22} color={Colors.text} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            {item.extra && <Text style={styles.langCurrent}>{item.extra}</Text>}
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      <Pressable style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>{t('signOut')}</Text>
      </Pressable>

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
  profileHeader: { alignItems: 'center', paddingVertical: 30, marginHorizontal: 20, borderRadius: 24, marginTop: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  userName: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff' },
  userPhone: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  roleBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 14, borderRadius: 12 },
  roleText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  menuSection: { backgroundColor: Colors.surface, marginHorizontal: 20, marginTop: 20, borderRadius: 16, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Poppins_500Medium', color: Colors.text },
  langCurrent: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.primary, marginRight: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.error },
  logoutText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.error },

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
