import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl, Pressable, Alert, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useIsDesktopWeb } from '../../components/WebSidebar';
import { getAllUsers, getProducts, getOrders, getShops, getCommissionStats, markShopCommissionCollected, updateOrderStatus, AppUser, Product, Order, Shop, ShopCommissionStat, getRewardPercent, setRewardPercent, getAllWalletBalances } from '../../lib/storage';
import { createNotification } from '../../lib/notifications';
import * as Haptics from 'expo-haptics';

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

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [commissionStats, setCommissionStats] = useState<ShopCommissionStat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardPercent, setRewardPercentState] = useState(1);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    const [u, p, o, s, cs, rp] = await Promise.all([getAllUsers(), getProducts(), getOrders(), getShops(), getCommissionStats(), getRewardPercent()]);
    setUsers(u); setProducts(p); setOrders(o); setShops(s); setCommissionStats(cs); setRewardPercentState(rp);
    const customerIds = u.filter(x => x.role === 'customer').map(x => x.id);
    if (customerIds.length > 0) {
      const wb = await getAllWalletBalances(customerIds);
      setWalletBalances(wb);
    }
  }, []);

  async function handleSettleShop(stat: ShopCommissionStat) {
    if (stat.outstandingCommission <= 0) return;
    Alert.alert(
      'Settle Commission',
      `Mark Rs.${stat.outstandingCommission.toFixed(2)} commission from ${stat.shopName} as collected?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Collected', onPress: async () => { await markShopCommissionCollected(stat.shopId); loadData(); } },
      ]
    );
  }

  const handleStatusUpdate = useCallback(async (order: Order, newStatus: Order['status']) => {
    const statusLabels: Record<string, string> = {
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      canceled: 'Canceled',
    };
    const notifTypes: Record<string, string> = {
      confirmed: 'order_confirmed',
      preparing: 'order_preparing',
      out_for_delivery: 'order_out_for_delivery',
      delivered: 'order_delivered',
      canceled: 'order_canceled',
    };
    const notifBodies: Record<string, string> = {
      confirmed: 'Your order has been confirmed!',
      preparing: 'Your order is being prepared!',
      out_for_delivery: 'Your order is out for delivery!',
      delivered: 'Your order has been delivered!',
      canceled: 'Your order has been cancelled.',
    };

    Alert.alert(
      'Update Status',
      `Change order status to "${statusLabels[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            await updateOrderStatus(order.id, newStatus);
            await createNotification(
              order.customerId,
              notifTypes[newStatus] as any,
              `Order ${statusLabels[newStatus]}`,
              notifBodies[newStatus],
              order.id
            );
            loadData();
          },
        },
      ]
    );
  }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0);
  const onlineRevenue = orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
  const codOrders = orders.filter(o => o.paymentMethod === 'cod').length;
  const upiOrders = orders.filter(o => o.paymentMethod === 'upi').length;
  const onlineOrders = orders.filter(o => o.paymentMethod === 'online').length;
  const pendingPayments = orders.filter(o => o.paymentStatus === 'pending').length;
  const totalCommission = commissionStats.reduce((s, c) => s + c.totalCommission, 0);
  const collectedCommission = commissionStats.reduce((s, c) => s + c.collectedCommission, 0);
  const outstandingCommission = commissionStats.reduce((s, c) => s + c.outstandingCommission, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const customers = users.filter(u => u.role === 'customer').length;
  const shopOwners = users.filter(u => u.role === 'shopowner').length;
  const deliveryBoys = users.filter(u => u.role === 'delivery').length;

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + webTopPad + 16 }, isDesktop && { borderBottomLeftRadius: 0, borderTopLeftRadius: 0 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Super Admin</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <View style={styles.logoSmall}>
            <Image source={require('../../assets/images/splash-icon.png')} style={{ width: 34, height: 34 }} contentFit="contain" />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatCard icon="people" label="Total Users" value={String(users.length)} color="#1565C0" isDesktop={isDesktop} />
        <StatCard icon="storefront" label="Shops" value={String(shops.length)} color="#6A1B9A" isDesktop={isDesktop} />
        <StatCard icon="bag" label="Products" value={String(products.length)} color="#E65100" isDesktop={isDesktop} />
        <StatCard icon="receipt" label="Orders" value={String(orders.length)} color="#2E7D32" isDesktop={isDesktop} />
        <StatCard icon="time" label="Pending" value={String(pendingOrders)} color="#F57F17" isDesktop={isDesktop} />
        <StatCard icon="cash" label="Revenue" value={`Rs.${totalRevenue}`} color="#00695C" isDesktop={isDesktop} />
      </View>

      <View style={styles.breakdownSection}>
        <Text style={styles.sectionTitle}>User Breakdown</Text>
        <View style={styles.breakdownCard}>
          {[
            { label: 'Customers', count: customers, icon: 'person', color: '#1565C0' },
            { label: 'Shop Owners', count: shopOwners, icon: 'storefront', color: '#6A1B9A' },
            { label: 'Delivery Partners', count: deliveryBoys, icon: 'bicycle', color: '#E65100' },
          ].map((item) => (
            <View key={item.label} style={styles.breakdownRow}>
              <View style={[styles.breakdownIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <Text style={styles.breakdownCount}>{item.count}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.breakdownSection}>
        <Text style={styles.sectionTitle}>Payment Overview</Text>
        <View style={styles.breakdownCard}>
          {[
            { label: 'Cash on Delivery', count: codOrders, icon: 'cash', color: '#2E7D32', suffix: ' orders' },
            { label: 'UPI Payments', count: upiOrders, icon: 'phone-portrait', color: '#FF6B00', suffix: ' orders' },
            { label: 'Card / Stripe', count: onlineOrders, icon: 'card', color: '#5433FF', suffix: ' orders' },
            { label: 'Pending Payments', count: pendingPayments, icon: 'time', color: '#F57F17', suffix: ' orders' },
            { label: 'Online Revenue', count: onlineRevenue, icon: 'trending-up', color: '#00695C', suffix: '', prefix: 'Rs.' },
          ].map((item) => (
            <View key={item.label} style={styles.breakdownRow}>
              <View style={[styles.breakdownIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <Text style={[styles.breakdownCount, { color: item.color }]}>
                {item.prefix || ''}{item.count}{item.suffix}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.breakdownSection}>
        <Text style={styles.sectionTitle}>Commission Dashboard</Text>
        <View style={styles.commissionSummary}>
          <View style={[styles.commissionSummaryCard, { borderColor: '#00695C30' }]}>
            <Ionicons name="wallet" size={20} color="#00695C" />
            <Text style={styles.commissionSummaryValue}>Rs.{totalCommission.toFixed(2)}</Text>
            <Text style={styles.commissionSummaryLabel}>Total Earned</Text>
          </View>
          <View style={[styles.commissionSummaryCard, { borderColor: Colors.success + '30' }]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.commissionSummaryValue}>Rs.{collectedCommission.toFixed(2)}</Text>
            <Text style={styles.commissionSummaryLabel}>Collected</Text>
          </View>
          <View style={[styles.commissionSummaryCard, { borderColor: '#F57F1730' }]}>
            <Ionicons name="hourglass" size={20} color="#F57F17" />
            <Text style={[styles.commissionSummaryValue, { color: '#F57F17' }]}>Rs.{outstandingCommission.toFixed(2)}</Text>
            <Text style={styles.commissionSummaryLabel}>Outstanding</Text>
          </View>
        </View>
        <Text style={styles.commissionNote}>₹0.50 service charge per item sold · collected from each shop</Text>
        {commissionStats.length > 0 && (
          <View style={[styles.breakdownCard, { marginTop: 10 }]}>
            {commissionStats.map((stat, idx) => (
              <View key={stat.shopId} style={[styles.commissionShopRow, idx === commissionStats.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#FF6B0018' }]}>
                  <Ionicons name="storefront" size={16} color="#FF6B00" />
                </View>
                <View style={styles.commissionShopInfo}>
                  <Text style={styles.commissionShopName} numberOfLines={1}>{stat.shopName}</Text>
                  <Text style={styles.commissionShopMeta}>{stat.orderCount} orders · Total Rs.{stat.totalCommission.toFixed(2)}</Text>
                </View>
                <View style={styles.commissionShopRight}>
                  {stat.outstandingCommission > 0 ? (
                    <Pressable
                      style={({ pressed }) => [styles.settleBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => handleSettleShop(stat)}
                    >
                      <Text style={styles.settleBtnText}>Rs.{stat.outstandingCommission.toFixed(2)} due</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.commissionOutstanding, { color: Colors.success }]}>Settled</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        {commissionStats.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No commission data yet</Text>
          </View>
        )}
      </View>

      <View style={styles.breakdownSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>Reward & Wallets</Text>
        </View>

        <View style={styles.rewardPercentCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.breakdownIcon, { backgroundColor: '#FF6B0018' }]}>
              <Ionicons name="gift" size={18} color="#FF6B00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardPercentLabel}>Cashback Rate</Text>
              <Text style={styles.rewardPercentSub}>Applied on every customer order</Text>
            </View>
          </View>
          <View style={styles.rewardPercentRow}>
            {[0.5, 1, 2, 3, 5].map(p => (
              <Pressable
                key={p}
                style={[styles.rewardPercentBtn, rewardPercent === p && styles.rewardPercentBtnActive]}
                onPress={async () => {
                  await setRewardPercent(p);
                  setRewardPercentState(p);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.rewardPercentBtnText, rewardPercent === p && styles.rewardPercentBtnTextActive]}>{p}%</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {users.filter(u => u.role === 'customer').length > 0 && (
          <View style={[styles.breakdownCard, { marginTop: 10 }]}>
            {users.filter(u => u.role === 'customer').map((cust, idx, arr) => {
              const bal = walletBalances[cust.id] || 0;
              return (
                <View key={cust.id} style={[styles.commissionShopRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.breakdownIcon, { backgroundColor: bal >= 100 ? Colors.success + '18' : '#1565C018' }]}>
                    <Ionicons name="wallet" size={16} color={bal >= 100 ? Colors.success : '#1565C0'} />
                  </View>
                  <View style={styles.commissionShopInfo}>
                    <Text style={styles.commissionShopName} numberOfLines={1}>{cust.name}</Text>
                    <Text style={styles.commissionShopMeta}>{cust.phone}</Text>
                  </View>
                  <Text style={[styles.commissionSummaryValue, { color: bal >= 100 ? Colors.success : Colors.text }]}>Rs.{bal.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        )}
        {users.filter(u => u.role === 'customer').length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No customers yet</Text>
          </View>
        )}
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>All Orders</Text>
        {orders.map((order) => {
          const nextStatusMap: Record<string, { status: Order['status']; label: string; icon: string; color: string }> = {
            pending: { status: 'confirmed', label: 'Confirm', icon: 'checkmark-circle', color: '#1565C0' },
            confirmed: { status: 'preparing', label: 'Prepare', icon: 'restaurant', color: '#E65100' },
            preparing: { status: 'out_for_delivery', label: 'Dispatch', icon: 'bicycle', color: '#6A1B9A' },
            out_for_delivery: { status: 'delivered', label: 'Delivered', icon: 'checkmark-done-circle', color: Colors.success },
          };
          const nextAction = nextStatusMap[order.status];

          return (
            <View key={order.id} style={styles.orderItem}>
              <View style={styles.orderTopRow}>
                <View style={styles.orderLeft}>
                  <Text style={styles.orderCustomer}>{order.customerName}</Text>
                  <Text style={styles.orderShop}>{order.shopName}</Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderAmount}>Rs.{order.totalAmount.toFixed(2)}</Text>
                  <View style={styles.orderBadgeRow}>
                    <View style={[styles.paymentDot, {
                      backgroundColor: order.paymentStatus === 'paid' || order.paymentStatus === 'upi_paid' ? Colors.success :
                        order.paymentStatus === 'pending' || order.paymentStatus === 'upi_pending' ? '#5433FF' :
                        order.paymentStatus === 'failed' ? Colors.error :
                        order.paymentStatus === 'cod' ? Colors.textTertiary : Colors.textTertiary
                    }]} />
                    <Text style={[styles.orderStatus, {
                      color: order.status === 'delivered' ? Colors.success : order.status === 'canceled' ? Colors.error : order.status === 'pending' ? Colors.warning : Colors.info,
                    }]}>{order.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.paymentMethodTag}>
                    {order.paymentStatus === 'paid' ? 'Paid' :
                      order.paymentStatus === 'upi_paid' ? 'UPI Paid' :
                      order.paymentStatus === 'upi_pending' ? 'UPI Pending' :
                      order.paymentStatus === 'pending' ? 'Unpaid' :
                      order.paymentStatus === 'cod' ? 'COD' : 'COD'}
                  </Text>
                </View>
              </View>

              {(order.deliveryTimeSlot || (order.walletDiscount && order.walletDiscount > 0)) && (
                <View style={styles.orderMetaRow}>
                  {order.deliveryTimeSlot ? (
                    <View style={styles.orderMetaItem}>
                      <Ionicons name="time-outline" size={13} color={Colors.info} />
                      <Text style={styles.orderMetaText}>{order.deliveryTimeSlot}</Text>
                    </View>
                  ) : null}
                  {order.walletDiscount && order.walletDiscount > 0 ? (
                    <View style={styles.orderMetaItem}>
                      <Ionicons name="wallet-outline" size={13} color="#6A1B9A" />
                      <Text style={[styles.orderMetaText, { color: '#6A1B9A' }]}>Wallet: -Rs.{order.walletDiscount.toFixed(2)}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {order.status !== 'delivered' && order.status !== 'canceled' && (
                <View style={styles.statusActionsRow}>
                  {nextAction && (
                    <Pressable
                      style={({ pressed }) => [styles.statusActionBtn, { borderColor: nextAction.color + '40', backgroundColor: nextAction.color + '10' }, pressed && { opacity: 0.7 }]}
                      onPress={() => handleStatusUpdate(order, nextAction.status)}
                    >
                      <Ionicons name={nextAction.icon as any} size={14} color={nextAction.color} />
                      <Text style={[styles.statusActionText, { color: nextAction.color }]}>{nextAction.label}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.statusActionBtn, { borderColor: Colors.error + '40', backgroundColor: Colors.error + '10' }, pressed && { opacity: 0.7 }]}
                    onPress={() => handleStatusUpdate(order, 'canceled')}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.error} />
                    <Text style={[styles.statusActionText, { color: Colors.error }]}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
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
  name: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff', marginTop: 2 },
  logoSmall: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginTop: 20 },
  statCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  breakdownSection: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 14 },
  breakdownCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 4, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  breakdownIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  breakdownLabel: { flex: 1, fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.text },
  breakdownCount: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.text },
  commissionSummary: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  commissionSummaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1.5, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  commissionSummaryValue: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: Colors.text },
  commissionSummaryLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center' },
  commissionNote: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginBottom: 4 },
  commissionShopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  commissionShopInfo: { flex: 1, gap: 2 },
  commissionShopName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  commissionShopMeta: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  commissionShopRight: { alignItems: 'flex-end' },
  commissionOutstanding: { fontSize: 12, fontFamily: 'Poppins_700Bold' },
  settleBtn: {
    backgroundColor: '#F57F1715', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#F57F1730',
  },
  settleBtnText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#F57F17' },
  recentSection: { marginTop: 24, paddingHorizontal: 20 },
  orderItem: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderLeft: { flex: 1, gap: 2 },
  orderCustomer: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  orderShop: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderAmount: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.text },
  orderStatus: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', textTransform: 'capitalize' as const },
  emptyState: { alignItems: 'center' as const, paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  orderBadgeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  paymentDot: { width: 7, height: 7, borderRadius: 4 },
  paymentMethodTag: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  orderMetaRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  orderMetaItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  orderMetaText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.info },
  statusActionsRow: { flexDirection: 'row' as const, gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  statusActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  statusActionText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  rewardPercentCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14, gap: 12,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  rewardPercentLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  rewardPercentSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  rewardPercentRow: { flexDirection: 'row' as const, gap: 8 },
  rewardPercentBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center' as const, backgroundColor: Colors.background,
  },
  rewardPercentBtnActive: { borderColor: '#FF6B00', backgroundColor: '#FF6B0012' },
  rewardPercentBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  rewardPercentBtnTextActive: { color: '#FF6B00' },
});
