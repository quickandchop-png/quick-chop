import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList,
  Platform, ActivityIndicator, RefreshControl, Linking, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { getOrders, updateOrderStatus, Order } from '@/lib/storage';
import { updateDeliveryLocation, clearDeliveryLocation } from '@/lib/tracking';
import { markAllRead } from '@/lib/notifications';
import { useRealtimeOrders, useRealtimeNotifications } from '@/lib/realtime';
import { playNotificationBeep } from '@/lib/alert-sound';

const STATUS_COLORS: Record<string, string> = {
  out_for_delivery: '#E65100', delivered: '#2E7D32', pending: '#F57F17',
  confirmed: '#1565C0', preparing: '#6A1B9A',
};

export default function DeliveryTasksScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<'assigned' | 'available'>('assigned');
  const [sharingLocation, setSharingLocation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstLoad = useRef(true);

  const handleNewAssignment = useCallback((order: Order) => {
    if (!isFirstLoad.current) {
      playNotificationBeep();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, []);

  const { orders, loading: assignedLoading, refresh: refreshAssigned } = useRealtimeOrders(
    { deliveryBoyId: user?.id || '' },
    handleNewAssignment
  );
  const { orders: allAvailable, loading: availableLoading, refresh: refreshAvailable } = useRealtimeOrders(
    { status: 'preparing' }
  );
  const { notifications, unreadCount, refresh: refreshNotifs } = useRealtimeNotifications(user?.id);

  const loading = assignedLoading;
  const allOrders = allAvailable.filter(o => !o.deliveryBoyId);
  const currentActiveOrder = orders.find(o => o.status === 'out_for_delivery') || null;

  useEffect(() => {
    const timer = setTimeout(() => { isFirstLoad.current = false; }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useFocusEffect(useCallback(() => {
    markAllRead(user?.id || '');
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
        locationInterval.current = null;
        setSharingLocation(false);
      }
    };
  }, [user]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAssigned(), refreshAvailable(), refreshNotifs()]);
    setRefreshing(false);
  };

  async function toggleLocationSharing(value: boolean) {
    if (!user || !currentActiveOrder) return;

    if (value) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setSharingLocation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const pushLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await updateDeliveryLocation(
            user.id, user.name, currentActiveOrder.id,
            loc.coords.latitude, loc.coords.longitude
          );
        } catch {}
      };

      await pushLocation();
      locationInterval.current = setInterval(pushLocation, 8000);
    } else {
      setSharingLocation(false);
      if (locationInterval.current) { clearInterval(locationInterval.current); locationInterval.current = null; }
      if (user) await clearDeliveryLocation(user.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handlePickup(order: Order) {
    if (!user) return;
    await updateOrderStatus(order.id, 'out_for_delivery', user.id, user.name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleDelivered(orderId: string) {
    await updateOrderStatus(orderId, 'delivered');
    setSharingLocation(false);
    if (locationInterval.current) { clearInterval(locationInterval.current); locationInterval.current = null; }
    if (user) await clearDeliveryLocation(user.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function openInMaps(order: Order) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { addressCoords, address } = order;
    const url = addressCoords
      ? Platform.select({
          ios: `maps:?q=${addressCoords.latitude},${addressCoords.longitude}`,
          android: `geo:${addressCoords.latitude},${addressCoords.longitude}?q=${addressCoords.latitude},${addressCoords.longitude}`,
          default: `https://www.openstreetmap.org/?mlat=${addressCoords.latitude}&mlon=${addressCoords.longitude}`,
        })
      : Platform.select({
          ios: `maps:?q=${encodeURIComponent(address)}`,
          android: `geo:0,0?q=${encodeURIComponent(address)}`,
          default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        });
    if (url) Linking.openURL(url);
  }

  const displayOrders = tab === 'assigned' ? orders : allOrders;
  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const activeCount = orders.filter(o => o.status === 'out_for_delivery').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const newNotifs = notifications.filter(n => !n.read);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <LinearGradient colors={[Colors.accent, Colors.accentLight]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Delivery Dashboard</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <View style={styles.notifPill}>
                <Ionicons name="notifications" size={14} color="#fff" />
                <Text style={styles.notifPillText}>{unreadCount} new</Text>
              </View>
            )}
            <View style={styles.logoSmall}>
              <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 34, height: 34 }} contentFit="contain" />
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{deliveredCount}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{allOrders.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>
      </LinearGradient>

      {currentActiveOrder && (
        <View style={[styles.locationShareBar, sharingLocation && styles.locationShareBarActive]}>
          <View style={styles.locationShareLeft}>
            <Ionicons name={sharingLocation ? 'radio' : 'location-outline'} size={18} color={sharingLocation ? Colors.success : Colors.textSecondary} />
            <View>
              <Text style={styles.locationShareTitle}>
                {sharingLocation ? 'Broadcasting your location' : 'Share live location'}
              </Text>
              <Text style={styles.locationShareSub}>
                {sharingLocation ? 'Customer can see you on the map' : 'Enable so customer can track you'}
              </Text>
            </View>
          </View>
          <Switch
            value={sharingLocation}
            onValueChange={toggleLocationSharing}
            trackColor={{ false: Colors.border, true: Colors.success + '60' }}
            thumbColor={sharingLocation ? Colors.success : Colors.textTertiary}
          />
        </View>
      )}

      {newNotifs.length > 0 && (
        <View style={styles.notifBanner}>
          <Ionicons name="notifications" size={16} color={Colors.warning} />
          <Text style={styles.notifBannerText} numberOfLines={2}>
            {newNotifs[0].title}: {newNotifs[0].body}
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {(['assigned', 'available'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { setTab(t); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'assigned' ? `My Tasks (${orders.length})` : `Available (${allOrders.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={displayOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!displayOrders.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || '#999') + '18' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#999' }]}>
                    {item.status.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.infoText}>{item.customerName} · {item.customerPhone}</Text>
              </View>

              <Pressable style={styles.addressRow} onPress={() => openInMaps(item)}>
                <Ionicons name="location" size={15} color={Colors.primary} />
                <Text style={styles.addressText} numberOfLines={2}>{item.address || 'No address'}</Text>
                <View style={styles.navBadge}>
                  <Ionicons name="navigate" size={11} color="#fff" />
                </View>
              </Pressable>

              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.infoText}>{item.shopName}</Text>
              </View>

              <View style={styles.itemsList}>
                {item.items.map((i, idx) => (
                  <Text key={idx} style={styles.itemText}>{i.quantity}× {i.product.name}</Text>
                ))}
              </View>

              <View style={styles.orderFooter}>
                <Text style={styles.orderTotal}>Rs.{item.totalAmount}</Text>
                {tab === 'available' && (
                  <Pressable
                    style={({ pressed }) => [styles.pickupBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => handlePickup(item)}
                  >
                    <Ionicons name="hand-left" size={15} color="#fff" />
                    <Text style={styles.pickupBtnText}>Accept Task</Text>
                  </Pressable>
                )}
                {tab === 'assigned' && item.status === 'out_for_delivery' && (
                  <View style={styles.btnGroup}>
                    <Pressable
                      style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => openInMaps(item)}
                    >
                      <Ionicons name="map" size={14} color={Colors.primary} />
                      <Text style={styles.mapBtnText}>Navigate</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.deliveredBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => handleDelivered(item.id)}
                    >
                      <Ionicons name="checkmark-circle" size={14} color="#fff" />
                      <Text style={styles.deliveredBtnText}>Delivered</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bicycle-outline" size={56} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>{tab === 'assigned' ? 'No tasks assigned' : 'No orders available'}</Text>
              <Text style={styles.emptyDesc}>Pull to refresh for new orders</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.8)' },
  name: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  notifPillText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  logoSmall: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 12 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff' },
  statLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  locationShareBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  locationShareBarActive: { borderColor: Colors.success + '50', backgroundColor: Colors.success + '06' },
  locationShareLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  locationShareTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  locationShareSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 1 },

  notifBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 10, padding: 12,
    backgroundColor: Colors.warning + '12', borderRadius: 12, borderWidth: 1, borderColor: Colors.warning + '30',
  },
  notifBannerText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.text, lineHeight: 18 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  orderCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  statusText: { fontSize: 9, fontFamily: 'Poppins_700Bold' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  infoText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, flex: 1 },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5,
    backgroundColor: Colors.primary + '08', padding: 10, borderRadius: 10,
  },
  addressText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.primary },
  navBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  itemsList: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 2 },
  itemText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  orderTotal: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.text },
  btnGroup: { flexDirection: 'row', gap: 6 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + '30' },
  mapBtnText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  pickupBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  pickupBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  deliveredBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.success, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8 },
  deliveredBtnText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptyDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
});
