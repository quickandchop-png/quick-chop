import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function DeliveryProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const webTopPad = Platform.OS === 'web' ? 67 : 0;

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
      <LinearGradient colors={[Colors.accent, Colors.accentLight]} style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="bicycle" size={36} color={Colors.accent} />
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userPhone}>{user?.phone}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>Delivery Partner</Text></View>
      </LinearGradient>

      <View style={styles.menuSection}>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.background }]} onPress={() => router.push('/(delivery)')}>
          <Ionicons name="list-outline" size={22} color={Colors.text} />
          <Text style={styles.menuLabel}>My Tasks</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.background }]} onPress={() => Alert.alert('Support', 'Contact support@quickandchop.com')}>
          <Ionicons name="help-circle-outline" size={22} color={Colors.text} />
          <Text style={styles.menuLabel}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      <Pressable style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
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
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.error },
  logoutText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.error },
});
