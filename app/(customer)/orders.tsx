// copy and paste this complete code into orders.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Platform, RefreshControl, Pressable, Modal, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { updatePaymentStatus, Order } from '@/lib/storage';
import { markAllRead } from '@/lib/notifications';
import { useRealtimeOrders, useRealtimeNotifications } from '@/lib/realtime';
import { playNotificationBeep } from '@/lib/alert-sound';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  pending: { color: '#F57F17', bg: '#FFF8E1', icon: 'time-outline', label: 'Pending' },
  confirmed: { color: '#1565C0', bg: '#E3F2FD', icon: 'checkmark-circle-outline', label: 'Confirmed' },
  preparing: { color: '#6A1B9A', bg: '#F3E5F5', icon: 'restaurant-outline', label: 'Preparing' },
  out_for_delivery: { color: '#E65100', bg: '#FFF3E0', icon: 'bicycle-outline', label: 'Out for Delivery' },
  delivered: { color: '#2E7D32', bg: '#E8F5E9', icon: 'checkmark-done-circle-outline', label: 'Delivered' },
  canceled: { color: '#9E9E9E', bg: '#F5F5F5', icon: 'close-circle-outline', label: 'Cancelled' },
};

const ORDER_TIMELINE = [
  { status: 'pending', label: 'Order Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered', label: 'Delivered' },
];

const STATUS_INDEX: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 2, out_for_delivery: 3, delivered: 4, canceled: -1,
};

function OrderCard({ order, onTrack }: { order: Order; onTrack: () => void }) {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  
  const formatDate = (dateInput: any) => {
    try {
      if (!dateInput) return "N/A";
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "N/A"; 
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
      return "N/A";
    }
  };

  const dateStr = formatDate(order.createdAt);
  const currentStep = STATUS_INDEX[order.status] ?? 0;
  const isInTransit = order.status === 'out_for_delivery';

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>Order #{order.id ? order.id.slice(0, 8) : 'N/A'}</Text>
          <Text style={styles.orderDate}>{dateStr}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={13} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {order.status === 'canceled' ? (
        <View style={styles.canceledBanner}>
          <Ionicons name="close-circle" size={16} color={config.color} />
          <Text style={styles.canceledBannerText}>This order was cancelled by the shop</Text>
        </View>
      ) : (
        <View style={styles.timelineRow}>
          {ORDER_TIMELINE.map((step, i) => (
            <React.Fragment key={step.status}>
              <View style={styles.timelineStep}>
                <View style={[styles.timelineDot,
                  i < currentStep && styles.timelineDotDone,
                  i === currentStep && styles.timelineDotCurrent,
                ]}>
                  {i < currentStep && <Ionicons name="checkmark" size={8} color="#fff" />}
                  {i === currentStep && <View style={styles.timelineDotInner} />}
                </View>
                <Text style={[styles.timelineLabel, i === currentStep && { color: config.color, fontFamily: 'Poppins_600SemiBold' }]}
                  numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
              {i < ORDER_TIMELINE.length - 1 && (
                <View style={[styles.timelineLine, i < currentStep && styles.timelineLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>
      )}

      <View style={styles.orderItems}>
        {order.items.map((item, i) => (
          <Text key={i} style={styles.orderItemText}>
            {item.quantity}× {item.product.name}
          </Text>
        ))}
      </View>

      <View style={styles.orderFooter}>
        <View>
          <Text style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.orderTotal}>Rs.{order.totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.footerActions}>
          {isInTransit && (
            <Pressable style={styles.trackBtn} onPress={onTrack}>
              <Ionicons name="radio" size={14} color="#fff" />
              <Text style={styles.trackBtnText}>Track Live</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders, loading, refresh } = useRealtimeOrders({ customerId: user?.id });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard order={item} onTrack={() => {}} />}
          contentContainerStyle={{ padding: 20, gap: 14 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  orderCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  orderId: { fontWeight: 'bold' },
  orderDate: { fontSize: 12, color: '#666' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  timelineRow: { flexDirection: 'row', marginVertical: 10 },
  timelineStep: { alignItems: 'center', flex: 1 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ddd' },
  timelineDotDone: { backgroundColor: 'green' },
  timelineDotCurrent: { backgroundColor: 'blue' },
  timelineDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  timelineLine: { height: 2, flex: 1, backgroundColor: '#ddd', marginTop: 5 },
  timelineLineDone: { backgroundColor: 'green' },
  timelineLabel: { fontSize: 10 },
  orderItems: { marginVertical: 10 },
  orderItemText: { fontSize: 13 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10 },
  shopName: { fontSize: 12, color: 'blue' },
  orderTotal: { fontSize: 16, fontWeight: 'bold' },
  trackBtn: { backgroundColor: 'blue', flexDirection: 'row', padding: 8, borderRadius: 8 },
  trackBtnText: { color: '#fff', fontSize: 12 },
  canceledBanner: { backgroundColor: '#fee', padding: 10, borderRadius: 8, flexDirection: 'row' },
  canceledBannerText: { color: 'red', fontSize: 12 }
});
