import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/colors';
import { useIsDesktopWeb } from '../../components/WebSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { getProducts, getOrders, Product, Order } from '../../lib/storage';

function StatCard({ icon, label, value, color, isDesktop }: { icon: string; label: string; value: string; color: string; isDesktop?: boolean }) {
  return (
    <View style={[styles.statCard, isDesktop && { width: '30%', minWidth: 160 }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ShopDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.shopId) return;
    const [p, o] = await Promise.all([
      getProducts(undefined, user.shopId),
      getOrders({ shopId: user.shopId }),
    ]);
    setProducts(p);
    setOrders(o);
  }, [user]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;

  return (
    <ScrollView
      style={[styles.container]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={[styles.header, { paddingTop: insets.top + webTopPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Shop Dashboard</Text>
            <Text style={styles.shopName}>{user?.name}</Text>
          </View>
          <View style={styles.logoSmall}>
            <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 34, height: 34 }} contentFit="contain" />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatCard icon="bag" label="Products" value={String(products.length)} color="#1565C0" isDesktop={isDesktop} />
        <StatCard icon="time" label="Pending" value={String(pendingOrders)} color="#F57F17" isDesktop={isDesktop} />
        <StatCard icon="cube" label="Total Stock" value={String(totalStock)} color="#6A1B9A" isDesktop={isDesktop} />
        <StatCard icon="cash" label="Revenue" value={`Rs.${totalRevenue}`} color="#2E7D32" isDesktop={isDesktop} />
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        {orders.slice(0, 5).map((order) => (
          <View key={order.id} style={styles.orderItem}>
            <View style={styles.orderLeft}>
              <Text style={styles.orderCustomer}>{order.customerName}</Text>
              <Text style={styles.orderItems}>{order.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}</Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderAmount}>Rs.{order.totalAmount}</Text>
              <View style={[styles.statusDot, { backgroundColor: order.status === 'delivered' ? Colors.success : order.status === 'pending' ? Colors.warning : Colors.info }]} />
            </View>
          </View>
        ))}
        {orders.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        )}
      </View>

      <View style={{ height: 100 + (Platform.OS === 'web' ? 34 : insets.bottom) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.8)' },
  shopName: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff', marginTop: 2 },
  logoSmall: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginTop: 20 },
  statCard: {
    width: '47%', backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  recentSection: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 14 },
  orderItem: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  orderLeft: { flex: 1, gap: 4 },
  orderCustomer: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  orderItems: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  orderRight: { alignItems: 'flex-end', gap: 6 },
  orderAmount: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.text },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
});
