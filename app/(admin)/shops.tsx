import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Alert,
  Platform, ActivityIndicator, RefreshControl, Modal, ScrollView,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import { useIsDesktopWeb } from '@/components/WebSidebar';
import { getShops, updateShop, getProducts, addProduct, Shop } from '@/lib/storage';
import { MASTER_PRODUCTS, MasterProduct } from '@/lib/product-master';

type SeedCategory = 'all' | 'vegetables' | 'groceries' | 'stationery';

const CATEGORY_TABS: { key: SeedCategory; label: string; icon: string; color: string; bg: string }[] = [
  { key: 'all', label: 'All', icon: 'apps', color: '#5C35D6', bg: '#EDE7F6' },
  { key: 'vegetables', label: 'Vegetables', icon: 'leaf', color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'groceries', label: 'Groceries', icon: 'bag', color: '#E65100', bg: '#FFF3E0' },
  { key: 'stationery', label: 'Stationery', icon: 'pencil', color: '#1565C0', bg: '#E3F2FD' },
];

const CATEGORY_ICON_MAP: Record<string, { icon: string; color: string; bg: string }> = {
  vegetables: { icon: 'leaf', color: '#2E7D32', bg: '#E8F5E9' },
  groceries: { icon: 'bag', color: '#E65100', bg: '#FFF3E0' },
  stationery: { icon: 'pencil', color: '#1565C0', bg: '#E3F2FD' },
};

export default function ShopsScreen() {
  const insets = useSafeAreaInsets();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [seedShop, setSeedShop] = useState<Shop | null>(null);
  const [seedCategory, setSeedCategory] = useState<SeedCategory>('all');
  const [seeding, setSeeding] = useState(false);
  const [alreadyHave, setAlreadyHave] = useState<Set<string>>(new Set());
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [gpsShop, setGpsShop] = useState<Shop | null>(null);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsAddr, setGpsAddr] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsSearchQuery, setGpsSearchQuery] = useState('');
  const [gpsSearchResults, setGpsSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [gpsSearching, setGpsSearching] = useState(false);
  const [savingGps, setSavingGps] = useState(false);

  const loadData = useCallback(async () => {
    const s = await getShops();
    setShops(s);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  async function toggleActive(shop: Shop) {
    await updateShop(shop.id, { isActive: !shop.isActive });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loadData();
  }

  async function openSeedModal(shop: Shop) {
    setSeedShop(shop);
    setSeedCategory('all');
    setLoadingExisting(true);
    try {
      const existing = await getProducts(undefined, shop.id);
      const names = new Set(existing.map(p => p.name.toLowerCase().trim()));
      setAlreadyHave(names);
    } finally {
      setLoadingExisting(false);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function closeSeedModal() {
    if (seeding) return;
    setSeedShop(null);
    setAlreadyHave(new Set());
  }

  function getItemsToSeed(category: SeedCategory): MasterProduct[] {
    const filtered = category === 'all'
      ? MASTER_PRODUCTS
      : MASTER_PRODUCTS.filter(p => p.category === category);
    return filtered.filter(p => !alreadyHave.has(p.name.toLowerCase().trim()));
  }

  async function handleSeed() {
    if (!seedShop) return;
    const items = getItemsToSeed(seedCategory);
    if (items.length === 0) {
      Alert.alert('Already Seeded', 'All items from this category are already in the shop.');
      return;
    }

    Alert.alert(
      'Seed Catalog',
      `Add ${items.length} item${items.length !== 1 ? 's' : ''} to "${seedShop.name}"?\n\nItems will be added with ₹0 price — the shop owner sets prices before they appear to customers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Add ${items.length} Items`,
          onPress: async () => {
            setSeeding(true);
            try {
              await Promise.all(
                items.map(item =>
                  addProduct({
                    name: item.name,
                    description: item.defaultDescription,
                    price: 0,
                    image: item.image,
                    category: item.category,
                    shopId: seedShop.id,
                    shopName: seedShop.name,
                    stock: 10,
                    unit: item.unit,
                  })
                )
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Done!', `${items.length} items added to ${seedShop.name}. The shop owner can now set prices.`);
              closeSeedModal();
            } catch {
              Alert.alert('Error', 'Failed to seed some items. Please try again.');
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  }

  function openGpsModal(shop: Shop) {
    setGpsShop(shop);
    setGpsLat(shop.latitude ?? null);
    setGpsLng(shop.longitude ?? null);
    setGpsAddr('');
    setGpsSearchQuery('');
    setGpsSearchResults([]);
  }

  function closeGpsModal() {
    setGpsShop(null);
    setGpsLat(null);
    setGpsLng(null);
    setGpsAddr('');
    setGpsSearchQuery('');
    setGpsSearchResults([]);
  }

  async function handleDetectShopGPS() {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location access in settings.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geo) {
          const parts = [geo.name, geo.street, geo.city, geo.region].filter(Boolean);
          setGpsAddr(parts.join(', '));
        }
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to detect GPS. Try searching instead.');
    } finally {
      setDetectingGps(false);
    }
  }

  async function handleShopGpsSearch() {
    if (!gpsSearchQuery.trim()) return;
    setGpsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(gpsSearchQuery.trim())}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'QuickAndChop/1.0' } }
      );
      setGpsSearchResults(await res.json());
    } catch {
      Alert.alert('Error', 'Search failed. Check your internet.');
    } finally {
      setGpsSearching(false);
    }
  }

  async function handleSaveShopGps() {
    if (!gpsShop || gpsLat == null || gpsLng == null) return;
    setSavingGps(true);
    try {
      await updateShop(gpsShop.id, { latitude: gpsLat, longitude: gpsLng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeGpsModal();
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to save location.');
    } finally {
      setSavingGps(false);
    }
  }

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;
  const itemsToSeed = seedShop ? getItemsToSeed(seedCategory) : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <Text style={styles.title}>Manage Shops</Text>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!shops.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const catInfo = CATEGORY_ICON_MAP[item.category] || CATEGORY_ICON_MAP.groceries;
            return (
              <View style={styles.shopCard}>
                <View style={[styles.shopIcon, { backgroundColor: catInfo.bg }]}>
                  <Ionicons name={catInfo.icon as any} size={24} color={catInfo.color} />
                </View>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{item.name}</Text>
                  <Text style={styles.shopOwner}>Owner: {item.ownerName}</Text>
                  <Text style={styles.shopDesc} numberOfLines={2}>{item.description}</Text>
                  {(item.latitude != null && item.longitude != null) && (
                    <View style={styles.shopLocationRow}>
                      <Ionicons name="location" size={12} color={Colors.success} />
                      <Text style={styles.shopLocationText}>
                        GPS: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.shopMeta}>
                    <View style={[styles.categoryBadge, { backgroundColor: catInfo.bg }]}>
                      <Text style={[styles.categoryText, { color: catInfo.color }]}>
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.toggleBtn, item.isActive ? styles.toggleActive : styles.toggleInactive]}
                      onPress={() => toggleActive(item)}
                    >
                      <Text style={[styles.toggleText, { color: item.isActive ? '#2E7D32' : Colors.error }]}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.seedBtn} onPress={() => openSeedModal(item)}>
                      <Ionicons name="add-circle-outline" size={13} color={Colors.primary} />
                      <Text style={styles.seedBtnText}>Seed Catalog</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.seedBtn, { borderColor: Colors.info + '40' }]}
                      onPress={() => openGpsModal(item)}
                    >
                      <Ionicons name="navigate-outline" size={13} color={Colors.info} />
                      <Text style={[styles.seedBtnText, { color: Colors.info }]}>
                        {item.latitude != null ? 'Update GPS' : 'Set GPS'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No shops registered</Text>
            </View>
          }
        />
      )}

      {/* Seed Catalog Modal */}
      <Modal
        visible={!!seedShop}
        transparent
        animationType="slide"
        onRequestClose={closeSeedModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSeedModal}>
          <View
            style={[styles.seedSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />

            <View style={styles.seedHeader}>
              <View style={styles.seedHeaderIcon}>
                <Ionicons name="library" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.seedTitle}>Seed Common Items</Text>
                {seedShop && <Text style={styles.seedShopName}>{seedShop.name}</Text>}
              </View>
            </View>

            <Text style={styles.seedDesc}>
              Add items from the master catalog to this shop. The shop owner will set prices — items with ₹0 price are hidden from customers.
            </Text>

            {/* Category Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {CATEGORY_TABS.map(tab => (
                <Pressable
                  key={tab.key}
                  style={[styles.categoryChip, seedCategory === tab.key && { backgroundColor: tab.bg, borderColor: tab.color }]}
                  onPress={() => setSeedCategory(tab.key)}
                >
                  <Ionicons name={tab.icon as any} size={14} color={seedCategory === tab.key ? tab.color : Colors.textSecondary} />
                  <Text style={[styles.categoryChipText, seedCategory === tab.key && { color: tab.color, fontFamily: 'Poppins_600SemiBold' }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Items Preview */}
            {loadingExisting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Checking existing products…</Text>
              </View>
            ) : (
              <View style={styles.previewBox}>
                <Ionicons
                  name={itemsToSeed.length > 0 ? 'add-circle' : 'checkmark-circle'}
                  size={20}
                  color={itemsToSeed.length > 0 ? Colors.primary : '#2E7D32'}
                />
                <Text style={styles.previewText}>
                  {itemsToSeed.length > 0
                    ? `${itemsToSeed.length} new item${itemsToSeed.length !== 1 ? 's' : ''} will be added`
                    : 'All items in this category already exist in this shop'}
                </Text>
              </View>
            )}

            {/* Item preview list */}
            {!loadingExisting && itemsToSeed.length > 0 && (
              <ScrollView style={styles.itemPreviewList} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
                {itemsToSeed.slice(0, 8).map(item => (
                  <View key={item.id} style={styles.itemPreviewRow}>
                    <Ionicons name="ellipse" size={6} color={Colors.primary} style={{ marginTop: 6 }} />
                    <Text style={styles.itemPreviewName}>{item.name}</Text>
                    <Text style={styles.itemPreviewUnit}>{item.unit}</Text>
                  </View>
                ))}
                {itemsToSeed.length > 8 && (
                  <Text style={styles.moreItems}>+{itemsToSeed.length - 8} more items…</Text>
                )}
              </ScrollView>
            )}

            {/* Seed Button */}
            <Pressable
              style={[styles.seedActionBtn, (seeding || itemsToSeed.length === 0 || loadingExisting) && styles.seedActionBtnDisabled]}
              onPress={handleSeed}
              disabled={seeding || itemsToSeed.length === 0 || loadingExisting}
            >
              {seeding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="add-circle" size={18} color="#fff" />
              )}
              <Text style={styles.seedActionBtnText}>
                {seeding ? 'Adding Items…' : itemsToSeed.length > 0 ? `Add ${itemsToSeed.length} Items to Shop` : 'All Items Present'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!gpsShop} transparent animationType="slide" onRequestClose={closeGpsModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={closeGpsModal}>
            <View style={[styles.seedSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <View style={styles.seedHeader}>
                <View style={[styles.seedHeaderIcon, { backgroundColor: Colors.info + '15' }]}>
                  <Ionicons name="navigate" size={20} color={Colors.info} />
                </View>
                <View>
                  <Text style={styles.seedTitle}>Set Shop Location</Text>
                  <Text style={styles.seedShopName}>{gpsShop?.name}</Text>
                </View>
              </View>

              {gpsLat != null && gpsLng != null ? (
                <View style={styles.gpsConfirmCard}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <View style={{ flex: 1, gap: 2 }}>
                    {!!gpsAddr && <Text style={styles.gpsConfirmAddr} numberOfLines={2}>{gpsAddr}</Text>}
                    <Text style={styles.gpsConfirmCoords}>{gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}</Text>
                  </View>
                  <Pressable onPress={() => { setGpsLat(null); setGpsLng(null); setGpsAddr(''); }}>
                    <Ionicons name="refresh" size={18} color={Colors.info} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <Pressable
                    style={styles.gpsAutoBtn}
                    onPress={handleDetectShopGPS}
                    disabled={detectingGps}
                  >
                    {detectingGps ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="navigate" size={16} color="#fff" />
                        <Text style={styles.gpsAutoBtnText}>Auto-Detect via GPS</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.gpsOrLabel}>or search by address</Text>
                  <View style={styles.gpsSearchRow}>
                    <TextInput
                      style={styles.gpsSearchField}
                      placeholder="Search address or area..."
                      placeholderTextColor={Colors.textTertiary}
                      value={gpsSearchQuery}
                      onChangeText={setGpsSearchQuery}
                      onSubmitEditing={handleShopGpsSearch}
                      returnKeyType="search"
                    />
                    <Pressable style={styles.gpsSearchSubmit} onPress={handleShopGpsSearch} disabled={gpsSearching}>
                      {gpsSearching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={16} color="#fff" />}
                    </Pressable>
                  </View>
                  {gpsSearchResults.length > 0 && (
                    <ScrollView style={{ maxHeight: 180 }}>
                      {gpsSearchResults.map((item, i) => (
                        <Pressable
                          key={i}
                          style={styles.gpsSearchResultItem}
                          onPress={() => {
                            setGpsLat(parseFloat(item.lat));
                            setGpsLng(parseFloat(item.lon));
                            setGpsAddr(item.display_name);
                            setGpsSearchResults([]);
                            Haptics.selectionAsync();
                          }}
                        >
                          <Ionicons name="location-outline" size={14} color={Colors.primary} />
                          <Text style={styles.gpsSearchResultText} numberOfLines={2}>{item.display_name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              <Pressable
                style={[styles.seedActionBtn, { marginTop: 16 }, (gpsLat == null || savingGps) && styles.seedActionBtnDisabled]}
                onPress={handleSaveShopGps}
                disabled={gpsLat == null || savingGps}
              >
                {savingGps ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="save" size={18} color="#fff" />
                )}
                <Text style={styles.seedActionBtnText}>{savingGps ? 'Saving...' : 'Save Location'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: Colors.text, paddingHorizontal: 20, paddingVertical: 12 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  shopCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 14,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  shopIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  shopInfo: { flex: 1, gap: 4 },
  shopName: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  shopOwner: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  shopDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  shopMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  categoryBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
  categoryText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold' },
  toggleBtn: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
  toggleActive: { backgroundColor: '#E8F5E9' },
  toggleInactive: { backgroundColor: '#FFEBEE' },
  toggleText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold' },
  seedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: Colors.primary + '12', borderWidth: 1, borderColor: Colors.primary + '30',
  },
  seedBtnText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  seedSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: '80%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  seedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  seedHeaderIcon: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary + '15',
  },
  seedTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  seedShopName: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  seedDesc: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary,
    lineHeight: 19, marginBottom: 14,
  },
  categoryScroll: { marginBottom: 14 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
  },
  categoryChipText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  previewText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text, flex: 1 },
  itemPreviewList: { maxHeight: 160, marginBottom: 16 },
  itemPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  itemPreviewName: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.text, flex: 1 },
  itemPreviewUnit: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  moreItems: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.primary, paddingTop: 4, paddingLeft: 14 },
  seedActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  seedActionBtnDisabled: { backgroundColor: Colors.textTertiary },
  seedActionBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  shopLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  shopLocationText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.success },
  gpsConfirmCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.success + '10', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.success + '30', marginTop: 12,
  },
  gpsConfirmAddr: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text },
  gpsConfirmCoords: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  gpsAutoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12,
  },
  gpsAutoBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  gpsOrLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center' },
  gpsSearchRow: { flexDirection: 'row', gap: 8 },
  gpsSearchField: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.text,
  },
  gpsSearchSubmit: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  gpsSearchResultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.background, borderRadius: 8, marginBottom: 2,
  },
  gpsSearchResultText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.text },
});
