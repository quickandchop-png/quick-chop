import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Order } from '@/lib/storage';
import { playNewOrderAlert } from '@/lib/alert-sound';

interface NewOrderAlertProps {
  order: Order | null;
  onDismiss: () => void;
  onView: () => void;
}

export default function NewOrderAlert({ order, onDismiss, onView }: NewOrderAlertProps) {
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const visible = order !== null;

  useEffect(() => {
    if (visible) {
      playNewOrderAlert();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        dismissAnim();
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-200);
    }
  }, [visible, order?.id]);

  function dismissAnim() {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }

  if (!order) return null;

  const total = order.items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissAnim}>
      <Pressable style={styles.overlay} onPress={dismissAnim}>
        <Animated.View
          style={[styles.alertCard, { transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.alertInner}>
              <View style={styles.alertIconWrap}>
                <View style={styles.alertIconBg}>
                  <Ionicons name="bag-add" size={28} color="#fff" />
                </View>
                <View style={styles.pulseDot} />
              </View>

              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>New Order!</Text>
                <Text style={styles.alertSub}>{order.customerName} • {itemCount} item{itemCount > 1 ? 's' : ''}</Text>
                <Text style={styles.alertAmount}>Rs. {total.toFixed(0)}</Text>
                <Text style={styles.alertPayment}>
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                </Text>
              </View>

              <View style={styles.alertActions}>
                <Pressable
                  style={[styles.alertBtn, styles.alertBtnPrimary]}
                  onPress={() => { onView(); dismissAnim(); }}
                >
                  <Text style={styles.alertBtnPrimaryText}>View</Text>
                </Pressable>
                <Pressable style={[styles.alertBtn, styles.alertBtnSecondary]} onPress={dismissAnim}>
                  <Ionicons name="close" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  alertCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  alertInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
    borderRadius: 20,
  },
  alertIconWrap: { position: 'relative' },
  alertIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  alertContent: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.text },
  alertSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  alertAmount: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.primary, marginTop: 2 },
  alertPayment: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  alertActions: { flexDirection: 'column', gap: 6, alignItems: 'center' },
  alertBtn: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBtnPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  alertBtnPrimaryText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  alertBtnSecondary: {
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
