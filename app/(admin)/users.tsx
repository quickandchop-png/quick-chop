import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Alert,
  Platform, ActivityIndicator, RefreshControl, Modal,
  TextInput, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useIsDesktopWeb } from '../../components/WebSidebar';
import Colors from '../../constants/colors';
import { getAllUsers, deleteUser, toggleUserActive, createStaff, AppUser, StaffLocationData } from '../../lib/storage';

const ROLE_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  customer: { color: '#1565C0', icon: 'person', label: 'Customer' },
  shopowner: { color: '#6A1B9A', icon: 'storefront', label: 'Shop Owner' },
  delivery: { color: '#E65100', icon: 'bicycle', label: 'Delivery' },
  admin: { color: '#D32F2F', icon: 'shield-checkmark', label: 'Admin' },
};

function CreateStaffModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'shopowner' | 'delivery'>('shopowner');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [gpsLatitude, setGpsLatitude] = useState<number | null>(null);
  const [gpsLongitude, setGpsLongitude] = useState<number | null>(null);
  const [gpsAddress, setGpsAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searching, setSearching] = useState(false);

  function reset() {
    setName(''); setPhone(''); setPassword('');
    setRole('shopowner'); setError(''); setShowPassword(false);
    setGpsLatitude(null); setGpsLongitude(null); setGpsAddress('');
    setPincode(''); setServiceArea(''); setSearchQuery(''); setSearchResults([]);
  }

  async function handleDetectGPS() {
    setDetectingGps(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable it in settings.');
        setDetectingGps(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLatitude(loc.coords.latitude);
      setGpsLongitude(loc.coords.longitude);

      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const parts = [geo.name, geo.street, geo.city, geo.region].filter(Boolean);
          setGpsAddress(parts.join(', '));
          if (geo.postalCode) setPincode(geo.postalCode);
          if (geo.city || geo.subregion) setServiceArea(geo.city || geo.subregion || '');
        }
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError('Failed to detect GPS. Try searching instead.');
    } finally {
      setDetectingGps(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'QuickAndChop/1.0' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setError('Search failed. Check your internet connection.');
    } finally {
      setSearching(false);
    }
  }

  function selectSearchResult(item: { display_name: string; lat: string; lon: string }) {
    setGpsLatitude(parseFloat(item.lat));
    setGpsLongitude(parseFloat(item.lon));
    setGpsAddress(item.display_name);
    setSearchResults([]);
    setSearchQuery('');
    const postalMatch = item.display_name.match(/\b\d{6}\b/);
    if (postalMatch) setPincode(postalMatch[0]);
    Haptics.selectionAsync();
  }

  async function handleCreate() {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError('Please fill all fields');
      return;
    }
    if (phone.trim().length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const locationData: StaffLocationData = {};
      if (gpsLatitude != null && gpsLongitude != null) {
        locationData.latitude = gpsLatitude;
        locationData.longitude = gpsLongitude;
      }
      if (pincode.trim()) locationData.pincode = pincode.trim();
      if (serviceArea.trim()) locationData.serviceArea = serviceArea.trim();

      await createStaff(name.trim(), phone.trim(), password.trim(), role, locationData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to create staff');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => { reset(); onClose(); }} />
          <ScrollView
            style={styles.modalSheet}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Create Staff Account</Text>
              <Text style={styles.modalSubtitle}>New staff can log in using the Staff Portal</Text>

              <View style={styles.roleToggle}>
                {([
                  { value: 'shopowner', label: 'Shop Owner', icon: 'storefront' },
                  { value: 'delivery', label: 'Delivery Boy', icon: 'bicycle' },
                ] as const).map(r => (
                  <Pressable
                    key={r.value}
                    style={[styles.roleToggleBtn, role === r.value && styles.roleToggleBtnActive]}
                    onPress={() => { setRole(r.value); Haptics.selectionAsync(); }}
                  >
                    <Ionicons name={r.icon} size={18} color={role === r.value ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.roleToggleText, role === r.value && styles.roleToggleTextActive]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.mInputContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.mInputIcon} />
                <TextInput
                  style={styles.mInput}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.mInputContainer}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.mInput}
                  placeholder="Mobile Number (10 digits)"
                  placeholderTextColor={Colors.textTertiary}
                  value={phone}
                  onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <View style={styles.mInputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.mInputIcon} />
                <TextInput
                  style={[styles.mInput, { flex: 1 }]}
                  placeholder="Temporary Password (min 6 chars)"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textTertiary} />
                </Pressable>
              </View>

              <View style={styles.gpsSectionHeader}>
                <Ionicons name="location" size={16} color={Colors.primary} />
                <Text style={styles.gpsSectionTitle}>
                  {role === 'shopowner' ? 'Shop Location (GPS)' : 'Delivery Area (GPS)'}
                </Text>
              </View>

              {gpsLatitude != null && gpsLongitude != null ? (
                <View style={styles.gpsResultCard}>
                  <View style={styles.gpsResultTop}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Text style={styles.gpsResultText} numberOfLines={2}>
                      {gpsAddress || `${gpsLatitude.toFixed(5)}, ${gpsLongitude.toFixed(5)}`}
                    </Text>
                  </View>
                  <Text style={styles.gpsCoords}>{gpsLatitude.toFixed(5)}, {gpsLongitude.toFixed(5)}</Text>
                  <Pressable
                    onPress={() => { setGpsLatitude(null); setGpsLongitude(null); setGpsAddress(''); }}
                    style={styles.gpsChangeBtn}
                  >
                    <Ionicons name="refresh" size={14} color={Colors.info} />
                    <Text style={styles.gpsChangeBtnText}>Change Location</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.gpsPickerBox}>
                  <Pressable
                    style={({ pressed }) => [styles.gpsDetectBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleDetectGPS}
                    disabled={detectingGps}
                  >
                    {detectingGps ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="navigate" size={16} color="#fff" />
                        <Text style={styles.gpsDetectText}>Auto-Detect via GPS</Text>
                      </>
                    )}
                  </Pressable>

                  <Text style={styles.gpsOrText}>or search by address</Text>

                  <View style={styles.gpsSearchRow}>
                    <TextInput
                      style={styles.gpsSearchInput}
                      placeholder="Search address or area..."
                      placeholderTextColor={Colors.textTertiary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                    />
                    <Pressable style={styles.gpsSearchBtn} onPress={handleSearch} disabled={searching}>
                      {searching ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="search" size={16} color="#fff" />
                      )}
                    </Pressable>
                  </View>

                  {searchResults.length > 0 && (
                    <View style={styles.searchResultsList}>
                      {searchResults.map((item, i) => (
                        <Pressable
                          key={i}
                          style={({ pressed }) => [styles.searchResultItem, pressed && { backgroundColor: Colors.background }]}
                          onPress={() => selectSearchResult(item)}
                        >
                          <Ionicons name="location-outline" size={14} color={Colors.primary} />
                          <Text style={styles.searchResultText} numberOfLines={2}>{item.display_name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.pincodeRow}>
                <View style={[styles.mInputContainer, { flex: 1, marginBottom: 0 }]}>
                  <Ionicons name="pin-outline" size={18} color={Colors.textTertiary} style={styles.mInputIcon} />
                  <TextInput
                    style={styles.mInput}
                    placeholder="Pincode"
                    placeholderTextColor={Colors.textTertiary}
                    value={pincode}
                    onChangeText={t => setPincode(t.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                {role === 'delivery' && (
                  <View style={[styles.mInputContainer, { flex: 1.5, marginBottom: 0 }]}>
                    <Ionicons name="map-outline" size={18} color={Colors.textTertiary} style={styles.mInputIcon} />
                    <TextInput
                      style={styles.mInput}
                      placeholder="Service Area (e.g. city)"
                      placeholderTextColor={Colors.textTertiary}
                      value={serviceArea}
                      onChangeText={setServiceArea}
                    />
                  </View>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.9 }]}
                onPress={handleCreate}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#1A237E', '#3949AB']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.createBtnGradient}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="person-add" size={18} color="#fff" />
                        <Text style={styles.createBtnText}>Create Staff Account</Text>
                      </>
                  }
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('staff');
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    const u = await getAllUsers();
    setUsers(u);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const filtered = filterRole === 'all'
    ? users
    : filterRole === 'staff'
    ? users.filter(u => u.role === 'shopowner' || u.role === 'delivery')
    : users.filter(u => u.role === filterRole);

  function handleDelete(u: AppUser) {
    if (u.role === 'admin') { Alert.alert('Cannot Delete', 'Admin users cannot be deleted'); return; }
    Alert.alert('Delete Staff', `Permanently remove ${u.name}?\n\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteUser(u.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadData();
      }},
    ]);
  }

  async function handleToggleActive(u: AppUser) {
    const willActivate = u.isActive === false;
    const action = willActivate ? 'Reactivate' : 'Deactivate';
    const msg = willActivate
      ? `Reactivate ${u.name}? They will be able to log in again.`
      : `Deactivate ${u.name}? They will be immediately logged out and unable to log in.`;

    Alert.alert(action, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: willActivate ? 'default' : 'destructive', onPress: async () => {
        await toggleUserActive(u.id, willActivate);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadData();
      }},
    ]);
  }

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;
  const staffCount = users.filter(u => u.role === 'shopowner' || u.role === 'delivery').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Staff Management</Text>
          <Text style={styles.subtitle}>{staffCount} staff members</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Staff</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {[
          { key: 'staff', label: 'Staff' },
          { key: 'shopowner', label: 'Shop Owners' },
          { key: 'delivery', label: 'Delivery' },
          { key: 'customer', label: 'Customers' },
          { key: 'all', label: 'All Users' },
        ].map(({ key, label }) => (
          <Pressable
            key={key}
            style={[styles.filterChip, filterRole === key && styles.filterChipActive]}
            onPress={() => { setFilterRole(key); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.filterText, filterRole === key && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const config = ROLE_CONFIG[item.role] || ROLE_CONFIG.customer;
            const isDeactivated = item.isActive === false;
            const hasLocation = item.latitude != null && item.longitude != null;
            return (
              <View style={[styles.userCard, isDeactivated && styles.userCardDeactivated]}>
                <View style={[styles.userAvatar, { backgroundColor: config.color + (isDeactivated ? '10' : '18') }]}>
                  <Ionicons name={config.icon} size={20} color={isDeactivated ? Colors.textTertiary : config.color} />
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, isDeactivated && { color: Colors.textTertiary }]}>{item.name}</Text>
                    {isDeactivated && (
                      <View style={styles.deactivatedBadge}>
                        <Text style={styles.deactivatedBadgeText}>Deactivated</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userPhone}>+91 {item.phone}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <View style={[styles.roleBadge, { backgroundColor: config.color + '18', marginTop: 0 }]}>
                      <Text style={[styles.roleText, { color: isDeactivated ? Colors.textTertiary : config.color }]}>{config.label}</Text>
                    </View>
                    {hasLocation && (
                      <View style={[styles.roleBadge, { backgroundColor: Colors.success + '18', marginTop: 0 }]}>
                        <Text style={[styles.roleText, { color: Colors.success }]}>GPS</Text>
                      </View>
                    )}
                    {item.pincode && (
                      <View style={[styles.roleBadge, { backgroundColor: '#1565C018', marginTop: 0 }]}>
                        <Text style={[styles.roleText, { color: '#1565C0' }]}>{item.pincode}</Text>
                      </View>
                    )}
                    {item.serviceArea && (
                      <View style={[styles.roleBadge, { backgroundColor: '#E6510018', marginTop: 0 }]}>
                        <Text style={[styles.roleText, { color: '#E65100' }]}>{item.serviceArea}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {item.role !== 'admin' && (
                  <View style={styles.actionBtns}>
                    <Pressable
                      onPress={() => handleToggleActive(item)}
                      style={[styles.actionBtn, { backgroundColor: isDeactivated ? Colors.success + '18' : Colors.warning + '18' }]}
                    >
                      <Ionicons
                        name={isDeactivated ? 'checkmark-circle-outline' : 'ban-outline'}
                        size={17}
                        color={isDeactivated ? Colors.success : Colors.warning}
                      />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(item)} style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}>
                      <Ionicons name="trash-outline" size={17} color={Colors.error} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySubtitle}>
                {filterRole === 'staff' ? 'Tap "Add Staff" to create shop owners or delivery partners' : 'No users in this category yet'}
              </Text>
            </View>
          }
        />
      )}

      <CreateStaffModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); loadData(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text },
  subtitle: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1A237E', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  filterScroll: { maxHeight: 48 },
  filterRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center', paddingVertical: 4 },
  filterChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, gap: 12,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  userCardDeactivated: { opacity: 0.7 },
  userAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  userInfo: { flex: 1, gap: 2 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  deactivatedBadge: { backgroundColor: Colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  deactivatedBadgeText: { fontSize: 9, fontFamily: 'Poppins_600SemiBold', color: Colors.warning },
  userPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  roleBadge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, marginTop: 4 },
  roleText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold' },
  actionBtns: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 24, maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginBottom: 20 },
  roleToggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleToggleBtnActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  roleToggleText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  roleToggleTextActive: { color: '#fff' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFEBEE', padding: 10, borderRadius: 10, marginBottom: 14,
  },
  errorText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.error, flex: 1 },
  mInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 14,
    marginBottom: 12, borderWidth: 1.5, borderColor: Colors.border,
  },
  mInputIcon: { paddingLeft: 14 },
  countryCodeBox: { paddingLeft: 14, paddingRight: 4, justifyContent: 'center' },
  countryCodeText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  phoneDivider: { width: 1, height: 20, backgroundColor: Colors.border, marginRight: 2 },
  mInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.text },
  eyeBtn: { padding: 14 },
  createBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  createBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  createBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  gpsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 },
  gpsSectionTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  gpsPickerBox: { marginBottom: 14, gap: 10 },
  gpsDetectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12,
  },
  gpsDetectText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  gpsOrText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center' },
  gpsSearchRow: { flexDirection: 'row', gap: 8 },
  gpsSearchInput: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.text,
  },
  gpsSearchBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  searchResultsList: {
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  searchResultText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.text },
  gpsResultCard: {
    backgroundColor: Colors.success + '10', borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.success + '30', gap: 4,
  },
  gpsResultTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsResultText: { flex: 1, fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text },
  gpsCoords: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginLeft: 26 },
  gpsChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 26 },
  gpsChangeBtnText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.info },
  pincodeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
});
