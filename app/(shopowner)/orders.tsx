import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Alert,
  Platform, ActivityIndicator, RefreshControl, Modal, ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useIsDesktopWeb } from '@/components/WebSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { getOrders, updateOrderStatus, updatePaymentStatus, updateOrderAddress, getDeliveryBoys, Order, AppUser, getShopCommissionOutstanding, markShopCommissionCollected, getUPIActiveMerchantId } from '@/lib/storage';
import { createNotification, markAllRead } from '@/lib/notifications';
import { useRealtimeOrders, useRealtimeNotifications } from '@/lib/realtime';
import NewOrderAlert from '@/components/NewOrderAlert';
import { useLanguage } from '@/contexts/LanguageContext';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F57F17', confirmed: '#1565C0', preparing: '#6A1B9A',
  out_for_delivery: '#E65100', delivered: '#2E7D32', canceled: '#9E9E9E',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', canceled: 'Cancelled',
};

export default function ShopOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [deliveryBoys, setDeliveryBoys] = useState<AppUser[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'active' | 'done'>('new');
  const [alertOrder, setAlertOrder] = useState<Order | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [pendingReadyOrder, setPendingReadyOrder] = useState<Order | null>(null);
  const isFirstLoad = useRef(true);
  const [outstandingCommission, setOutstandingCommission] = useState(0);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [adminUpiId, setAdminUpiId] = useState('quickchop@upi');
  const [upiCopied, setUpiCopied] = useState(false);
  const [editingAddrOrderId, setEditingAddrOrderId] = useState<string | null>(null);
  const [editingAddrText, setEditingAddrText] = useState('');
  const [savingAddr, setSavingAddr] = useState(false);

  const handleNewOrder = useCallback((order: Order) => {
    if (!isFirstLoad.current) {
      setAlertOrder(order);
      setActiveTab('new');
    }
  }, []);

  const { orders, loading, refresh } = useRealtimeOrders(
    { shopId: user?.shopId || '' },
    handleNewOrder
  );

  const { notifications, unreadCount, refresh: refreshNotifs } = useRealtimeNotifications(user?.id);

  useEffect(() => {
    const timer = setTimeout(() => { isFirstLoad.current = false; }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useFocusEffect(useCallback(() => {
    getDeliveryBoys().then(setDeliveryBoys);
    if (user?.shopId) {
      getShopCommissionOutstanding(user.shopId).then(setOutstandingCommission);
    }
    getUPIActiveMerchantId().then(setAdminUpiId);
  }, [user?.shopId]));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshNotifs()]);
    setRefreshing(false);
  };

  const newOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ['confirmed', 'preparing', 'out_for_delivery'].includes(o.status));
  const doneOrders = orders.filter(o => o.status === 'delivered' || o.status === 'canceled');
  const displayOrders = activeTab === 'new' ? newOrders : activeTab === 'active' ? activeOrders : doneOrders;

  async function handleAcceptOrder(order: Order) {
    if (outstandingCommission > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowCommissionModal(true);
      return;
    }
    setProcessingId(order.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateOrderStatus(order.id, 'confirmed');
      await createNotification(
        order.customerId, 'order_confirmed',
        'Order Confirmed! ✅',
        `Your order from ${order.shopName} has been confirmed and will be prepared shortly.`,
        order.id
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setProcessingId(null);
    }
  }

  async function handlePayCommission() {
    if (!user?.shopId) return;
    Alert.alert(
      t('payCommission'),
      t('commissionDueMsg', { amount: outstandingCommission.toString() }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('payCommission'),
          onPress: async () => {
            await markShopCommissionCollected(user.shopId!);
            setOutstandingCommission(0);
            setShowCommissionModal(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(t('commissionPaid'), t('commissionPaidMsg'));
          },
        },
      ]
    );
  }

  async function handleRejectOrder(order: Order) {
    Alert.alert('Reject Order', 'Are you sure you want to reject this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setProcessingId(order.id);
          try {
            await updateOrderStatus(order.id, 'canceled' as any);
            await createNotification(
              order.customerId, 'order_canceled',
              'Order Cancelled',
              `Sorry, your order from ${order.shopName} could not be accepted at this time.`,
              order.id
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  }

  async function handleStartPreparing(order: Order) {
    setProcessingId(order.id);
    try {
      await updateOrderStatus(order.id, 'preparing');
      await createNotification(
        order.customerId, 'order_preparing',
        '🍳 Order Being Prepared',
        `Your order from ${order.shopName} is now being prepared!`,
        order.id
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setProcessingId(null);
    }
  }

  function handleReadyForPickup(order: Order) {
    if (deliveryBoys.length === 0) {
      Alert.alert('No Delivery Partners', 'No delivery partners available. Please add one from the Admin panel.');
      return;
    }
    setPendingReadyOrder(order);
    setShowDeliveryModal(true);
  }

  function openEditAddress(orderId: string, currentAddr: string) {
    setEditingAddrOrderId(orderId);
    setEditingAddrText(currentAddr);
  }

  async function handleSaveAddress() {
    if (!editingAddrOrderId || !editingAddrText.trim()) return;
    setSavingAddr(true);
    try {
      await updateOrderAddress(editingAddrOrderId, editingAddrText.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update address');
    } finally {
      setSavingAddr(false);
      setEditingAddrOrderId(null);
      setEditingAddrText('');
    }
  }

  async function handleAssignDelivery(partner: AppUser) {
    const order = pendingReadyOrder;
    if (!order) return;
    setShowDeliveryModal(false);
    setPendingReadyOrder(null);
    setProcessingId(order.id);
    try {
      await updateOrderStatus(order.id, 'out_for_delivery', partner.id, partner.name);
      const shopMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.shopName)}`;
      await Promise.all([
        createNotification(
          partner.id, 'delivery_assigned',
          '🛵 New Delivery Task!',
          `Pickup: ${order.shopName}\nCustomer: ${order.customerName}\nDrop: ${order.address}\nMap: ${shopMapsLink}`,
          order.id
        ),
        createNotification(
          order.customerId, 'order_ready',
          '🚀 Out for Delivery!',
          `${partner.name} is on the way with your order! Track the delivery in your orders tab.`,
          order.id
        ),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleOpenNotifs() {
    setShowNotifs(true);
    if (unreadCount > 0 && user) {
      await markAllRead(user.id);
      await refreshNotifs();
    }
  }

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Shop Orders</Text>
          {newOrders.length > 0 && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live Updates</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.notifBtn} onPress={handleOpenNotifs}>
          <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {outstandingCommission > 0 && (
        <Pressable
          style={styles.commissionBanner}
          onPress={() => setShowCommissionModal(true)}
        >
          <LinearGradient colors={['#FF6B00', '#FF9500']} style={styles.commissionBannerGradient}>
            <Ionicons name="warning" size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.commissionBannerTitle}>{t('commissionBlocked')}</Text>
              <Text style={styles.commissionBannerSub}>Rs.{outstandingCommission.toFixed(2)} {t('commissionDue').toLowerCase()}</Text>
            </View>
            <Text style={styles.commissionPayBtn}>{t('payCommission')}</Text>
          </LinearGradient>
        </Pressable>
      )}

      <View style={styles.tabRow}>
        {([
          { key: 'new', label: 'New', count: newOrders.length, color: Colors.warning },
          { key: 'active', label: 'Active', count: activeOrders.length, color: Colors.info },
          { key: 'done', label: 'Done', count: doneOrders.length, color: Colors.success },
        ] as const).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && { backgroundColor: tab.color + '18', borderColor: tab.color }]}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: tab.color }]}>{tab.label}</Text>
            {tab.count > 0 && (
              <View style={[styles.tabCount, { backgroundColor: tab.color }]}>
                <Text style={styles.tabCountText}>{tab.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={displayOrders}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!displayOrders.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              processingId={processingId}
              onAccept={() => handleAcceptOrder(item)}
              onReject={() => handleRejectOrder(item)}
              onPrepare={() => handleStartPreparing(item)}
              onReady={() => handleReadyForPickup(item)}
              onVerifyUPI={async () => {
                await updatePaymentStatus(item.id, 'upi_paid');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                refresh();
              }}
              onEditAddress={openEditAddress}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'new' ? 'No new orders' : activeTab === 'active' ? 'No active orders' : 'No completed orders'}
              </Text>
              <Text style={styles.emptyDesc}>Updates arrive automatically in real-time</Text>
            </View>
          }
        />
      )}

      <NewOrderAlert
        order={alertOrder}
        onDismiss={() => setAlertOrder(null)}
        onView={() => { setAlertOrder(null); setActiveTab('new'); }}
      />

      {/* Delivery Partner Selection Modal */}
      <Modal
        visible={showDeliveryModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowDeliveryModal(false); setPendingReadyOrder(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setShowDeliveryModal(false); setPendingReadyOrder(null); }}
        >
          <View
            style={[styles.deliverySheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <View style={styles.deliverySheetHeader}>
              <Ionicons name="bicycle" size={22} color={Colors.primary} />
              <Text style={styles.deliverySheetTitle}>Assign Delivery Partner</Text>
            </View>
            {pendingReadyOrder && (
              <Text style={styles.deliverySheetSub}>
                Order #{pendingReadyOrder.id.slice(0, 8)} · {pendingReadyOrder.customerName}
              </Text>
            )}
            <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
              {deliveryBoys.map(partner => (
                <Pressable
                  key={partner.id}
                  disabled={!!processingId}
                  style={({ pressed }) => [styles.deliveryPartnerCard, pressed && { opacity: 0.8 }, !!processingId && { opacity: 0.5 }]}
                  onPress={() => handleAssignDelivery(partner)}
                >
                  <View style={styles.deliveryPartnerAvatar}>
                    <Ionicons name="person" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveryPartnerName}>{partner.name}</Text>
                    <Text style={styles.deliveryPartnerPhone}>{partner.phone}</Text>
                  </View>
                  <View style={styles.deliveryAssignChip}>
                    <Ionicons name="bicycle" size={14} color="#fff" />
                    <Text style={styles.deliveryAssignChipText}>Assign</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!editingAddrOrderId}
        transparent
        animationType="fade"
        onRequestClose={() => { setEditingAddrOrderId(null); setEditingAddrText(''); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setEditingAddrOrderId(null); setEditingAddrText(''); }}
        >
          <View
            style={styles.editAddrSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <View style={styles.deliverySheetHeader}>
              <Ionicons name="location" size={22} color={Colors.primary} />
              <Text style={styles.deliverySheetTitle}>Edit Delivery Address</Text>
            </View>
            <TextInput
              style={styles.editAddrInput}
              value={editingAddrText}
              onChangeText={setEditingAddrText}
              multiline
              numberOfLines={3}
              placeholder="Enter updated delivery address"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable
                style={[styles.editAddrCancelBtn, { flex: 1 }]}
                onPress={() => { setEditingAddrOrderId(null); setEditingAddrText(''); }}
              >
                <Text style={styles.editAddrCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editAddrSaveBtn, { flex: 1 }, savingAddr && { opacity: 0.6 }]}
                onPress={handleSaveAddress}
                disabled={savingAddr || !editingAddrText.trim()}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.editAddrSaveText}>{savingAddr ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showNotifs} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.notifModal, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notifications</Text>
              <Pressable onPress={() => setShowNotifs(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {notifications.length === 0 ? (
                <View style={styles.emptyNotif}>
                  <Ionicons name="notifications-off-outline" size={40} color={Colors.textTertiary} />
                  <Text style={styles.emptyNotifText}>No notifications yet</Text>
                </View>
              ) : (
                notifications.map(n => (
                  <View key={n.id} style={[styles.notifItem, !n.read && styles.notifUnread]}>
                    <View style={styles.notifDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifItemTitle}>{n.title}</Text>
                      <Text style={styles.notifItemBody}>{n.body}</Text>
                      <Text style={styles.notifTime}>{new Date(n.createdAt).toLocaleTimeString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCommissionModal} transparent animationType="slide" onRequestClose={() => setShowCommissionModal(false)}>
        <View style={styles.commissionOverlay}>
          <Pressable style={styles.commissionBackdrop} onPress={() => setShowCommissionModal(false)} />
          <View style={[styles.commissionSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
            <View style={styles.commissionHandle} />
            <View style={styles.commissionIconCircle}>
              <Ionicons name="alert-circle" size={36} color="#FF6B00" />
            </View>
            <Text style={styles.commissionTitle}>{t('commissionBlocked')}</Text>

            <View style={styles.commissionAmountBox}>
              <Text style={styles.commissionAmountLabel}>{t('commissionDue')}</Text>
              <Text style={styles.commissionAmountValue}>Rs.{outstandingCommission.toFixed(2)}</Text>
            </View>

            <Text style={styles.commissionDesc}>
              {t('commissionBlockedMsg', { amount: outstandingCommission.toString() })}
            </Text>

            <View style={styles.commissionQrSection}>
              <Text style={styles.commissionQrLabel}>Scan QR to pay admin</Text>
              <View style={styles.commissionQrFrame}>
                <QRCode
                  value={`upi://pay?pa=${adminUpiId}&pn=Quick%20%26%20Chop%20Admin&am=${outstandingCommission}&cu=INR&tn=Commission`}
                  size={140}
                />
              </View>

              <View style={styles.commissionUpiRow}>
                <View style={styles.commissionUpiIdBox}>
                  <Ionicons name="phone-portrait" size={14} color="#FF6B00" />
                  <Text style={styles.commissionUpiIdText} numberOfLines={1}>{adminUpiId}</Text>
                </View>
                <Pressable
                  style={styles.commissionCopyBtn}
                  onPress={async () => {
                    await Clipboard.setStringAsync(adminUpiId);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setUpiCopied(true);
                    setTimeout(() => setUpiCopied(false), 2000);
                  }}
                >
                  <Ionicons name={upiCopied ? 'checkmark' : 'copy-outline'} size={14} color="#FF6B00" />
                  <Text style={styles.commissionCopyText}>{upiCopied ? 'Copied!' : 'Copy'}</Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [styles.commissionOpenUpiBtn, pressed && { opacity: 0.85 }]}
                onPress={async () => {
                  const upiUrl = `upi://pay?pa=${adminUpiId}&pn=${encodeURIComponent('Quick & Chop Admin')}&am=${outstandingCommission}&cu=INR&tn=Commission`;
                  const canOpen = await Linking.canOpenURL(upiUrl).catch(() => false);
                  if (canOpen) {
                    await Linking.openURL(upiUrl);
                  } else {
                    Alert.alert('No UPI App', `Please pay Rs.${outstandingCommission} to ${adminUpiId} manually.`);
                  }
                }}
              >
                <Ionicons name="open-outline" size={16} color="#FF6B00" />
                <Text style={styles.commissionOpenUpiText}>Open UPI App to Pay</Text>
              </Pressable>
            </View>

            <Pressable style={({ pressed }) => [styles.commissionPayFullBtn, pressed && { opacity: 0.85 }]} onPress={handlePayCommission}>
              <LinearGradient colors={['#FF6B00', '#FF9500']} style={styles.commissionPayGradient}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.commissionPayFullText}>I have paid - Settle Commission</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.commissionDismissBtn} onPress={() => setShowCommissionModal(false)}>
              <Text style={styles.commissionDismissText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function OrderCard({ order, processingId, onAccept, onReject, onPrepare, onReady, onVerifyUPI, onEditAddress }: {
  order: Order; processingId: string | null;
  onAccept: () => void; onReject: () => void; onPrepare: () => void; onReady: () => void; onVerifyUPI: () => void;
  onEditAddress: (orderId: string, currentAddr: string) => void;
}) {
  const isProcessing = processingId === order.id;
  const statusColor = STATUS_COLORS[order.status] || '#999';
  const date = new Date(order.createdAt);
  const timeStr = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderCustomer}>{order.customerName} · {order.customerPhone}</Text>
          <Text style={styles.orderTime}>{timeStr}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[order.status]}</Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        {order.items.map((i, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemQty}>{i.quantity}×</Text>
            <Text style={styles.itemName}>{i.product.name}</Text>
            <Text style={styles.itemPrice}>Rs.{(i.product.price * i.quantity).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {order.address && (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.addressText} numberOfLines={1}>{order.address}</Text>
          {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'preparing') && (
            <Pressable
              style={styles.editAddrBtn}
              onPress={() => onEditAddress(order.id, order.address)}
            >
              <Ionicons name="create-outline" size={14} color={Colors.info} />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.paymentRow}>
        <Ionicons
          name={order.paymentMethod === 'online' ? 'card-outline' : order.paymentMethod === 'upi' ? 'phone-portrait-outline' : 'cash-outline'}
          size={13}
          color={
            order.paymentStatus === 'paid' || order.paymentStatus === 'upi_paid' ? Colors.success :
            order.paymentStatus === 'pending' || order.paymentStatus === 'upi_pending' ? '#FF6B00' :
            Colors.textSecondary
          }
        />
        <Text style={[styles.paymentText, {
          color: order.paymentStatus === 'paid' || order.paymentStatus === 'upi_paid' ? Colors.success :
                 order.paymentStatus === 'pending' || order.paymentStatus === 'upi_pending' ? '#FF6B00' :
                 Colors.textSecondary,
        }]}>
          {order.paymentMethod === 'online'
            ? (order.paymentStatus === 'paid' ? 'Paid Online via Stripe' : 'Online – Payment Pending')
            : order.paymentMethod === 'upi'
              ? (order.paymentStatus === 'upi_paid' ? 'Paid via UPI' : 'UPI – Pending Verification')
              : 'Cash on Delivery'}
        </Text>
      </View>

      {order.paymentStatus === 'upi_pending' && (
        <Pressable
          style={({ pressed }) => [styles.upiVerifyBtn, pressed && { opacity: 0.8 }]}
          onPress={onVerifyUPI}
        >
          <Ionicons name="phone-portrait" size={14} color="#FF6B00" />
          <Text style={styles.upiVerifyText}>Mark UPI Payment Received</Text>
        </Pressable>
      )}

      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>Rs.{order.totalAmount.toFixed(2)}</Text>
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : order.status === 'pending' ? (
          <View style={styles.btnGroup}>
            <Pressable style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.8 }]} onPress={onReject}>
              <Ionicons name="close" size={16} color={Colors.error} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.8 }]} onPress={onAccept}>
              <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.acceptGradient}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : order.status === 'confirmed' ? (
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]} onPress={onPrepare}>
            <LinearGradient colors={['#6A1B9A', '#8E24AA']} style={styles.actionGradient}>
              <Ionicons name="restaurant" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Start Preparing</Text>
            </LinearGradient>
          </Pressable>
        ) : order.status === 'preparing' ? (
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]} onPress={onReady}>
            <LinearGradient colors={['#E65100', '#F4511E']} style={styles.actionGradient}>
              <Ionicons name="bicycle" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Order Ready</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.success },
  notifBtn: { padding: 8, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: 2 },
  badge: {
    position: 'absolute', top: -4, right: -4, width: 18, height: 18,
    borderRadius: 9, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#fff' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  tabCount: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  tabCountText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: Colors.text },
  orderCustomer: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },
  orderTime: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  orderItems: { gap: 6, marginBottom: 10 },
  itemRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  itemQty: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.primary, width: 24 },
  itemName: { flex: 1, fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.text },
  itemPrice: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  addressText: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  paymentText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },
  upiVerifyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
    backgroundColor: '#FF6B0012', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#FF6B0030',
  },
  upiVerifyText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#FF6B00', flex: 1 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotal: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  btnGroup: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.error + '40', backgroundColor: Colors.error + '10',
  },
  rejectBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.error },
  acceptBtn: { borderRadius: 10, overflow: 'hidden' },
  acceptGradient: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 14 },
  acceptBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  actionBtn: { borderRadius: 10, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14 },
  actionBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptyDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  notifModal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  notifTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  notifItem: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.background },
  notifUnread: { backgroundColor: Colors.primary + '08', borderWidth: 1, borderColor: Colors.primary + '20' },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5 },
  notifItemTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  notifItemBody: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },
  notifTime: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 4 },
  emptyNotif: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyNotifText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  deliverySheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: '70%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  deliverySheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  deliverySheetTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  deliverySheetSub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginBottom: 12 },
  deliveryPartnerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.background, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  deliveryPartnerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + '18', justifyContent: 'center', alignItems: 'center',
  },
  deliveryPartnerName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  deliveryPartnerPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },
  deliveryAssignChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
  },
  deliveryAssignChipText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  commissionBanner: { marginHorizontal: 20, marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  commissionBannerGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  commissionBannerTitle: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },
  commissionBannerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },
  commissionPayBtn: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },

  commissionOverlay: { flex: 1, justifyContent: 'flex-end' },
  commissionBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  commissionSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, alignItems: 'center',
  },
  commissionHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  commissionIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF6B0015',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  commissionTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  commissionDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  commissionAmountBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FF6B0008', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#FF6B0025', width: '100%', marginBottom: 4,
  },
  commissionAmountLabel: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.text },
  commissionAmountValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#FF6B00' },
  commissionQrSection: { alignItems: 'center', width: '100%', gap: 10, marginVertical: 8 },
  commissionQrLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  commissionQrFrame: {
    padding: 12, backgroundColor: '#fff', borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  commissionUpiRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  commissionUpiIdBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF6B0008', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#FF6B0025',
  },
  commissionUpiIdText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text, flexShrink: 1 },
  commissionCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF6B0012', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#FF6B0025',
  },
  commissionCopyText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#FF6B00' },
  commissionOpenUpiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    paddingVertical: 10, borderRadius: 10, backgroundColor: '#FF6B0008',
    borderWidth: 1, borderColor: '#FF6B0025',
  },
  commissionOpenUpiText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#FF6B00' },
  commissionPayFullBtn: { borderRadius: 14, overflow: 'hidden', width: '100%', marginTop: 4 },
  commissionPayGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  commissionPayFullText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  commissionDismissBtn: { paddingVertical: 10 },
  commissionDismissText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  editAddrBtn: { marginLeft: 'auto', padding: 4 },
  editAddrSheet: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginHorizontal: 24, width: '90%', maxWidth: 400, alignSelf: 'center',
  },
  editAddrInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 12, fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.text,
    minHeight: 80, textAlignVertical: 'top', marginTop: 12,
  },
  editAddrCancelBtn: {
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  editAddrCancelText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  editAddrSaveBtn: {
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  editAddrSaveText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
