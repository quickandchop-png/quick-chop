import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  Alert, Platform, ActivityIndicator, Linking, Modal, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { getCart, updateCartItem, clearCart, createOrder, updatePaymentStatus, CartItem, getUPIActiveMerchantId, getCustomerPrice, CUSTOMER_CARE_CHARGE, getShopUPIId, getWalletBalance, addWalletReward, redeemWallet } from '@/lib/storage';
import CustomerAuthModal from '@/components/CustomerAuthModal';
import { getPickedLocation, clearPickedLocation, getSavedAddresses, addSavedAddress, removeSavedAddress, SavedAddress } from '@/lib/location-store';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateProductName } from '@/lib/i18n';
import { createNotification } from '@/lib/notifications';

const BACKEND_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : Platform.OS === 'web'
    ? 'http://localhost:5000'
    : 'http://localhost:5000';

function CartItemRow({ item, onUpdate }: { item: CartItem; onUpdate: () => void }) {
  const { language } = useLanguage();
  async function changeQty(delta: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateCartItem(item.product.id, item.quantity + delta);
    onUpdate();
  }

  return (
    <View style={styles.cartItem}>
      <Image source={{ uri: item.product.image }} style={styles.itemImage} contentFit="cover" />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{translateProductName(item.product.name, language)}</Text>
        <Text style={styles.itemShop}>{item.product.shopName}</Text>
        <Text style={styles.itemPrice}>Rs.{getCustomerPrice(item.product.price)} × {item.quantity}</Text>
      </View>
      <View style={styles.qtyControls}>
        <Pressable style={styles.qtyBtn} onPress={() => changeQty(-1)}>
          <Ionicons name={item.quantity <= 1 ? 'trash-outline' : 'remove'} size={16} color={item.quantity <= 1 ? Colors.error : Colors.text} />
        </Pressable>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <Pressable style={styles.qtyBtn} onPress={() => changeQty(1)}>
          <Ionicons name="add" size={16} color={Colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}


function PaymentSelector({
  selected, onSelect, merchantId,
}: { selected: 'cod' | 'online' | 'upi'; onSelect: (m: 'cod' | 'online' | 'upi') => void; merchantId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyUpiId() {
    await Clipboard.setStringAsync(merchantId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const upiQrValue = `upi://pay?pa=${merchantId}&pn=Quick%20%26%20Chop&cu=INR`;

  return (
    <View style={styles.paymentSection}>
      <Text style={styles.sectionHeading}>Payment Method</Text>
      <View style={styles.paymentRow}>
        <Pressable
          style={[styles.paymentCard, selected === 'cod' && styles.paymentCardSelected]}
          onPress={() => { onSelect('cod'); Haptics.selectionAsync(); }}
        >
          <View style={[styles.paymentIcon, selected === 'cod' && { backgroundColor: Colors.success + '20' }]}>
            <Ionicons name="cash" size={22} color={selected === 'cod' ? Colors.success : Colors.textSecondary} />
          </View>
          <Text style={[styles.paymentTitle, selected === 'cod' && { color: Colors.success }]}>Cash on Delivery</Text>
          <Text style={styles.paymentSub}>Pay when arrived</Text>
          {selected === 'cod' && <View style={styles.paymentCheck}><Ionicons name="checkmark-circle" size={18} color={Colors.success} /></View>}
        </Pressable>

        <Pressable
          style={[styles.paymentCard, selected === 'upi' && styles.paymentCardUpiSelected]}
          onPress={() => { onSelect('upi'); Haptics.selectionAsync(); }}
        >
          <View style={[styles.paymentIcon, selected === 'upi' && { backgroundColor: '#FF6B0020' }]}>
            <Ionicons name="phone-portrait" size={22} color={selected === 'upi' ? '#FF6B00' : Colors.textSecondary} />
          </View>
          <Text style={[styles.paymentTitle, selected === 'upi' && { color: '#FF6B00' }]}>Pay via UPI</Text>
          <Text style={styles.paymentSub}>PhonePe · GPay · Any UPI</Text>
          {selected === 'upi' && <View style={styles.paymentCheck}><Ionicons name="checkmark-circle" size={18} color="#FF6B00" /></View>}
        </Pressable>

        <Pressable
          style={[styles.paymentCard, selected === 'online' && styles.paymentCardOnlineSelected]}
          onPress={() => { onSelect('online'); Haptics.selectionAsync(); }}
        >
          <View style={[styles.paymentIcon, selected === 'online' && { backgroundColor: '#5433FF20' }]}>
            <Ionicons name="card" size={22} color={selected === 'online' ? '#5433FF' : Colors.textSecondary} />
          </View>
          <Text style={[styles.paymentTitle, selected === 'online' && { color: '#5433FF' }]}>Card / Stripe</Text>
          <Text style={styles.paymentSub}>Credit · Debit</Text>
          {selected === 'online' && <View style={styles.paymentCheck}><Ionicons name="checkmark-circle" size={18} color="#5433FF" /></View>}
        </Pressable>
      </View>

      {selected === 'upi' && (
        <View style={styles.upiPanel}>
          <View style={styles.upiQrCard}>
            <View style={styles.upiQrFrame}>
              <QRCode
                value={upiQrValue}
                size={148}
                color="#1a1a1a"
                backgroundColor="#fff"
              />
            </View>
            <Text style={styles.upiQrHint}>Scan with any UPI app camera</Text>
          </View>

          <View style={styles.upiDivider}>
            <View style={styles.upiDividerLine} />
            <Text style={styles.upiDividerText}>or use UPI ID</Text>
            <View style={styles.upiDividerLine} />
          </View>

          <View style={styles.upiIdRow}>
            <View style={styles.upiIdBox}>
              <Ionicons name="at" size={16} color="#FF6B00" style={{ marginRight: 6 }} />
              <Text style={styles.upiIdText} selectable>{merchantId}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.upiCopyBtn, pressed && { opacity: 0.75 }]}
              onPress={handleCopyUpiId}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? Colors.success : '#FF6B00'} />
              <Text style={[styles.upiCopyText, copied && { color: Colors.success }]}>
                {copied ? 'Copied!' : 'Copy ID'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.upiAppsLabel}>Works with PhonePe · Google Pay · BHIM · Paytm · Any UPI</Text>
        </View>
      )}

      {selected === 'online' && (
        <View style={styles.stripeNote}>
          <Ionicons name="shield-checkmark" size={14} color="#5433FF" />
          <Text style={styles.stripeNoteText}>Secure payment via Stripe. Opens in browser after order placement.</Text>
        </View>
      )}
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user, isGuest, hasPinSetup } = useAuth();
  const { t } = useLanguage();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'upi'>('cod');
  const [upiMerchantId, setUpiMerchantId] = useState('quickchop@upi');
  const [showPaymentPending, setShowPaymentPending] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<'register' | 'pin_setup' | 'pin_verify'>('register');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWallet, setUseWallet] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    const [c, loc, saved] = await Promise.all([getCart(), getPickedLocation(), getSavedAddresses()]);
    setCart(c);
    setSavedAddresses(saved);
    if (c.length > 0) {
      const shopId = c[0]?.product.shopId;
      if (shopId) {
        const shopUpi = await getShopUPIId(shopId);
        setUpiMerchantId(shopUpi);
      } else {
        const mid = await getUPIActiveMerchantId();
        setUpiMerchantId(mid);
      }
    }
    if (loc) {
      setAddress(loc.address);
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    } else {
      setAddress('');
      setCoords(null);
    }
    setLoading(false);
  }, []);

  const loadWallet = useCallback(async () => {
    if (user && !isGuest) {
      const bal = await getWalletBalance(user.id);
      setWalletBalance(bal);
    }
  }, [user, isGuest]);

  useFocusEffect(useCallback(() => { loadCart(); loadWallet(); }, [loadCart, loadWallet]));

  function generateTimeSlots(): { label: string; value: string }[] {
    const now = new Date();
    const hour = now.getHours();
    const slots: { label: string; value: string }[] = [];
    slots.push({ label: t('asSoonAsPossible'), value: 'asap' });
    if (hour < 16) slots.push({ label: 'Today 4 PM - 6 PM', value: 'today_16_18' });
    if (hour < 18) slots.push({ label: 'Today 6 PM - 8 PM', value: 'today_18_20' });
    slots.push({ label: 'Tomorrow 8 AM - 10 AM', value: 'tomorrow_08_10' });
    slots.push({ label: 'Tomorrow 10 AM - 12 PM', value: 'tomorrow_10_12' });
    slots.push({ label: 'Tomorrow 2 PM - 4 PM', value: 'tomorrow_14_16' });
    return slots;
  }

  const timeSlots = generateTimeSlots();

  const total = cart.reduce((sum, item) => sum + getCustomerPrice(item.product.price) * item.quantity, 0);
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const customerCareTotal = Math.round(totalQty * CUSTOMER_CARE_CHARGE * 100) / 100;
  const walletDiscountAmount = useWallet && walletBalance >= 100 ? Math.min(walletBalance, total) : 0;
  const finalTotal = Math.round((total - walletDiscountAmount) * 100) / 100;

  async function handleClearCart() {
    Alert.alert('Clear Cart', 'Remove all items from cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => { await clearCart(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); loadCart(); },
      },
    ]);
  }

  async function handleClearAddress() {
    await clearPickedLocation();
    setAddress('');
    setCoords(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSaveAddress() {
    if (!address.trim() || !coords) return;
    Alert.prompt
      ? Alert.prompt(t('savedAddressLabel'), '', async (label: string) => {
          if (label?.trim()) {
            await addSavedAddress({ label: label.trim(), address, latitude: coords.latitude, longitude: coords.longitude });
            setSavedAddresses(await getSavedAddresses());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(t('addressSaved'));
          }
        })
      : (() => {
          const label = address.length > 30 ? address.substring(0, 30) + '...' : address;
          addSavedAddress({ label, address, latitude: coords.latitude, longitude: coords.longitude }).then(async () => {
            setSavedAddresses(await getSavedAddresses());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          });
        })();
  }

  function handleSelectSavedAddress(saved: SavedAddress) {
    setAddress(saved.address);
    setCoords({ latitude: saved.latitude, longitude: saved.longitude });
    setShowSavedAddresses(false);
    Haptics.selectionAsync();
  }

  async function handleRemoveSavedAddress(id: string) {
    await removeSavedAddress(id);
    setSavedAddresses(await getSavedAddresses());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function notifyShopOwner(orderId: string) {
    if (!user) return;
    const shopId = cart[0]?.product.shopId;
    if (shopId) {
      await createNotification(
        shopId, 'new_order',
        'New Order Received!',
        `${user.name} placed an order for Rs.${total}`,
        orderId
      );
    }
  }

  async function handlePlaceOrderCOD() {
    if (!address.trim() || !user) return;
    if (!selectedTimeSlot) {
      Alert.alert(t('deliveryTimeSlot'), t('timeSlotRequired'));
      return;
    }
    setOrdering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const discount = walletDiscountAmount > 0 ? walletDiscountAmount : undefined;
      if (discount && discount > 0) {
        await redeemWallet(user.id, discount);
      }
      const order = await createOrder(
        user.id, user.name, user.phone, cart,
        address.trim(), coords || undefined, 'cod',
        undefined, selectedTimeSlot, discount
      );
      await clearPickedLocation();
      await notifyShopOwner(order.id);
      const reward = await addWalletReward(user.id, finalTotal);
      const rewardAmount = Math.round(finalTotal * 0.01 * 100) / 100;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Order Placed!', `Your order is confirmed. Pay cash when it arrives.${rewardAmount > 0 ? `\n${t('earnedReward').replace('{amount}', rewardAmount.toFixed(2))}` : ''}`);
      setAddress('');
      setCoords(null);
      setSelectedTimeSlot(null);
      setUseWallet(false);
      loadCart();
      loadWallet();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  }

  async function handlePlaceOrderOnline() {
    if (!address.trim() || !user) return;
    if (!selectedTimeSlot) {
      Alert.alert(t('deliveryTimeSlot'), t('timeSlotRequired'));
      return;
    }
    setOrdering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const discount = walletDiscountAmount > 0 ? walletDiscountAmount : undefined;
      if (discount && discount > 0) {
        await redeemWallet(user.id, discount);
      }
      const order = await createOrder(
        user.id, user.name, user.phone, cart,
        address.trim(), coords || undefined, 'online',
        undefined, selectedTimeSlot, discount
      );

      const response = await fetch(`${BACKEND_URL}/api/payment/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          amount: finalTotal,
          customerName: user.name,
          items: cart.map(item => ({
            name: item.product.name,
            price: getCustomerPrice(item.product.price),
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        Alert.alert('Payment Error', err.error || 'Could not initiate payment. Check Stripe configuration.');
        setOrdering(false);
        return;
      }

      const { checkoutUrl } = await response.json();

      await clearPickedLocation();
      await notifyShopOwner(order.id);
      await addWalletReward(user.id, finalTotal);
      setAddress('');
      setCoords(null);
      setSelectedTimeSlot(null);
      setUseWallet(false);
      loadCart();
      loadWallet();

      setPendingOrderId(order.id);
      setShowPaymentPending(true);

      if (checkoutUrl) Linking.openURL(checkoutUrl);

      pollCountRef.current = 0;
      pollRef.current = setInterval(async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > 40) {
          clearInterval(pollRef.current!);
          setShowPaymentPending(false);
          return;
        }
        try {
          const r = await fetch(`${BACKEND_URL}/api/payment/status/${order.id}`);
          const { paymentStatus } = await r.json();
          if (paymentStatus === 'paid') {
            clearInterval(pollRef.current!);
            setShowPaymentPending(false);
            await updatePaymentStatus(order.id, 'paid');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Payment Confirmed!', 'Your payment was successful. Check the Orders tab.');
          } else if (paymentStatus === 'failed') {
            clearInterval(pollRef.current!);
            setShowPaymentPending(false);
            await updatePaymentStatus(order.id, 'failed');
            Alert.alert('Payment Cancelled', 'Your order was placed but payment was not completed. Contact support.');
          }
        } catch {}
      }, 3000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  }

  function handlePlaceOrder() {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please pick your delivery location first.');
      return;
    }
    if (!selectedTimeSlot) {
      Alert.alert(t('deliveryTimeSlot'), t('timeSlotRequired'));
      return;
    }
    if (isGuest) {
      setAuthStep('register');
      setShowAuthModal(true);
      return;
    }
    if (!hasPinSetup) {
      setAuthStep('pin_setup');
      setShowAuthModal(true);
      return;
    }
    setAuthStep('pin_verify');
    setShowAuthModal(true);
  }

  async function handlePlaceOrderUPI() {
    if (!address.trim() || !user) return;
    if (!selectedTimeSlot) {
      Alert.alert(t('deliveryTimeSlot'), t('timeSlotRequired'));
      return;
    }
    setOrdering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const discount = walletDiscountAmount > 0 ? walletDiscountAmount : undefined;
      if (discount && discount > 0) {
        await redeemWallet(user.id, discount);
      }
      const order = await createOrder(
        user.id, user.name, user.phone, cart,
        address.trim(), coords || undefined, 'upi',
        undefined, selectedTimeSlot, discount
      );
      await clearPickedLocation();
      await notifyShopOwner(order.id);
      const reward = await addWalletReward(user.id, finalTotal);
      const rewardAmount = Math.round(finalTotal * 0.01 * 100) / 100;
      setAddress('');
      setCoords(null);
      setSelectedTimeSlot(null);
      setUseWallet(false);
      loadCart();
      loadWallet();

      const shopId = cart[0]?.product.shopId;
      const liveMerchantId = shopId ? await getShopUPIId(shopId) : await getUPIActiveMerchantId();
      const upiMerchantName = encodeURIComponent('Quick & Chop');
      const upiUrl = `upi://pay?pa=${liveMerchantId}&pn=${upiMerchantName}&am=${finalTotal}&cu=INR&tn=Order-${order.id.slice(0, 8)}`;
      const canOpen = await Linking.canOpenURL(upiUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      }
      Alert.alert(
        'Order Placed!',
        canOpen
          ? `Pay in your UPI app. The shop owner will verify your payment before preparing your order.${rewardAmount > 0 ? `\n${t('earnedReward').replace('{amount}', rewardAmount.toFixed(2))}` : ''}`
          : `No UPI app found. Please pay Rs.${finalTotal} manually to the shopkeeper. Your order is placed.`,
        [
          {
            text: 'View My Orders',
            onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.push('/(customer)/orders'); },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    if (paymentMethod === 'cod') {
      handlePlaceOrderCOD();
    } else if (paymentMethod === 'upi') {
      handlePlaceOrderUPI();
    } else {
      handlePlaceOrderOnline();
    }
  }

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top + webTopPad }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cart</Text>
        {cart.length > 0 && (
          <Pressable onPress={handleClearCart}>
            <Ionicons name="trash-outline" size={22} color={Colors.error} />
          </Pressable>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyDesc}>Browse products and add items to your cart</Text>
          <Pressable
            style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/(customer)/browse')}
          >
            <Text style={styles.browseBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(item) => item.product.id}
            renderItem={({ item }) => <CartItemRow item={item} onUpdate={loadCart} />}
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 220 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!cart.length}
            ListFooterComponent={
              <View>
                <View style={styles.addressSection}>
                  <View style={styles.addressLabelRow}>
                    <Ionicons name="location" size={16} color={Colors.primary} />
                    <Text style={styles.addressLabel}>Delivery Location</Text>
                    {coords && (
                      <View style={styles.gpsBadge}>
                        <Ionicons name="navigate" size={10} color="#fff" />
                        <Text style={styles.gpsBadgeText}>GPS</Text>
                      </View>
                    )}
                  </View>

                  {address ? (
                    <View style={styles.selectedAddressCard}>
                      <View style={styles.selectedAddressContent}>
                        <Text style={styles.selectedAddressText} numberOfLines={3}>{address}</Text>
                        {coords && (
                          <Text style={styles.selectedCoordsText}>
                            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                          </Text>
                        )}
                      </View>
                      <Pressable onPress={handleClearAddress} style={styles.clearAddrBtn}>
                        <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.noAddressHint}>
                      <Ionicons name="map-outline" size={20} color={Colors.textTertiary} />
                      <Text style={styles.noAddressText}>No location picked yet</Text>
                    </View>
                  )}

                  <View style={styles.addressBtnRow}>
                    <Pressable
                      style={({ pressed }) => [styles.pickLocationBtn, { flex: 1 }, pressed && { opacity: 0.85 }]}
                      onPress={() => router.push('/location-picker')}
                    >
                      <LinearGradient
                        colors={[Colors.primary, Colors.primaryLight]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.pickLocationGradient}
                      >
                        <Ionicons name={address ? 'create-outline' : 'location'} size={18} color="#fff" />
                        <Text style={styles.pickLocationText}>
                          {address ? t('changeDeliveryLocation') : t('pickDeliveryLocation')}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>

                  {address && coords && (
                    <Pressable
                      style={({ pressed }) => [styles.saveAddressBtn, pressed && { opacity: 0.8 }]}
                      onPress={handleSaveAddress}
                    >
                      <Ionicons name="bookmark-outline" size={16} color={Colors.primary} />
                      <Text style={styles.saveAddressBtnText}>{t('saveAddress')}</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={({ pressed }) => [styles.useSavedBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => setShowSavedAddresses(true)}
                  >
                    <Ionicons name="bookmarks-outline" size={16} color="#FF6B00" />
                    <Text style={styles.useSavedBtnText}>
                      {savedAddresses.length > 0
                        ? `${t('useSavedAddress')} (${savedAddresses.length})`
                        : t('savedAddresses')}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#FF6B00" />
                  </Pressable>

                  {!address && (
                    <View style={styles.manualSection}>
                      <Text style={styles.manualLabel}>{t('orTypeManually')}</Text>
                      <TextInput
                        style={styles.manualInput}
                        placeholder={t('addressPlaceholder')}
                        placeholderTextColor={Colors.textTertiary}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.timeSlotSection}>
                  <View style={styles.addressLabelRow}>
                    <Ionicons name="time-outline" size={16} color={Colors.primary} />
                    <Text style={styles.addressLabel}>{t('deliveryTimeSlot')}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {timeSlots.map((slot) => (
                      <Pressable
                        key={slot.value}
                        style={[
                          styles.timeSlotBtn,
                          selectedTimeSlot === slot.value && styles.timeSlotBtnSelected,
                        ]}
                        onPress={() => {
                          setSelectedTimeSlot(slot.value);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text
                          style={[
                            styles.timeSlotBtnText,
                            selectedTimeSlot === slot.value && styles.timeSlotBtnTextSelected,
                          ]}
                        >
                          {slot.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {!selectedTimeSlot && (
                    <Text style={styles.timeSlotHint}>{t('selectTimeSlot')}</Text>
                  )}
                </View>

                {user && !isGuest && (
                  <View style={styles.walletSection}>
                    <View style={styles.addressLabelRow}>
                      <Ionicons name="wallet-outline" size={16} color={walletBalance >= 100 ? Colors.success : Colors.textTertiary} />
                      <Text style={styles.addressLabel}>{t('walletBalance')}</Text>
                    </View>
                    <View style={styles.walletCard}>
                      <Text style={[styles.walletAmount, { color: walletBalance >= 100 ? Colors.success : Colors.textTertiary }]}>
                        Rs.{walletBalance.toFixed(2)}
                      </Text>
                      {walletBalance < 100 ? (
                        <Text style={styles.walletHint}>{t('walletReach100')}</Text>
                      ) : (
                        <Pressable
                          style={[styles.walletToggle, useWallet && styles.walletToggleActive]}
                          onPress={() => {
                            setUseWallet(!useWallet);
                            Haptics.selectionAsync();
                          }}
                        >
                          <Ionicons
                            name={useWallet ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={useWallet ? Colors.success : Colors.textTertiary}
                          />
                          <Text style={[styles.walletToggleText, useWallet && { color: Colors.success }]}>
                            {useWallet ? `${t('walletApplied')} (-Rs.${walletDiscountAmount.toFixed(2)})` : t('applyWallet')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                <PaymentSelector selected={paymentMethod} onSelect={setPaymentMethod} merchantId={upiMerchantId} />
              </View>
            }
          />

          <View style={[styles.bottomBar, { paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84 }]}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>{t('total')}</Text>
                <Text style={styles.paymentMethodLabel}>
                  {paymentMethod === 'cod' ? '💵 Cash on Delivery' : paymentMethod === 'upi' ? '📱 UPI Payment' : '💳 Card / Stripe'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {walletDiscountAmount > 0 ? (
                  <>
                    <Text style={[styles.totalAmount, { fontSize: 13, textDecorationLine: 'line-through' as const, color: Colors.textTertiary }]}>Rs.{total.toFixed(2)}</Text>
                    <Text style={styles.totalAmount}>Rs.{finalTotal.toFixed(2)}</Text>
                    <Text style={{ fontSize: 10, color: Colors.success }}>Wallet: -Rs.{walletDiscountAmount.toFixed(2)}</Text>
                  </>
                ) : (
                  <Text style={styles.totalAmount}>Rs.{total.toFixed(2)}</Text>
                )}
                <Text style={{ fontSize: 10, color: Colors.textTertiary }}>{t('inclCustomerCare')} Rs.{customerCareTotal.toFixed(2)}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.orderBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }, !address && styles.orderBtnDisabled]}
              onPress={handlePlaceOrder}
              disabled={ordering || !address}
            >
              <LinearGradient
                colors={
                  !address ? [Colors.textTertiary, Colors.textTertiary]
                  : paymentMethod === 'cod' ? [Colors.primary, Colors.primaryLight]
                  : paymentMethod === 'upi' ? ['#FF6B00', '#FF9500']
                  : ['#5433FF', '#8B6FFF']
                }
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.orderGradient}
              >
                {ordering ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={paymentMethod === 'cod' ? 'bag-check' : paymentMethod === 'upi' ? 'phone-portrait' : 'card'}
                      size={20} color="#fff"
                    />
                    <Text style={styles.orderBtnText}>
                      {!address ? 'Add Address First'
                        : paymentMethod === 'cod' ? 'Place Order (COD)'
                        : paymentMethod === 'upi' ? 'Pay via UPI'
                        : 'Pay & Place Order'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}

      <CustomerAuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialStep={authStep}
      />

      <Modal visible={showPaymentPending} transparent animationType="fade">
        <View style={styles.paymentModal}>
          <View style={styles.paymentModalCard}>
            <ActivityIndicator size="large" color="#5433FF" />
            <Text style={styles.paymentModalTitle}>Waiting for Payment</Text>
            <Text style={styles.paymentModalSub}>
              Complete the payment in your browser.{'\n'}This screen will update automatically.
            </Text>
            <Pressable
              style={styles.paymentModalDismiss}
              onPress={() => {
                clearInterval(pollRef.current!);
                setShowPaymentPending(false);
                router.push('/(customer)/orders');
              }}
            >
              <Text style={styles.paymentModalDismissText}>Check Orders Instead</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showSavedAddresses} transparent animationType="slide" onRequestClose={() => setShowSavedAddresses(false)}>
        <View style={styles.savedAddrOverlay}>
          <Pressable style={styles.savedAddrBackdrop} onPress={() => setShowSavedAddresses(false)} />
          <View style={[styles.savedAddrSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
            <View style={styles.savedAddrHandle} />
            <Text style={styles.savedAddrTitle}>{t('savedAddresses')}</Text>
            {savedAddresses.length === 0 ? (
              <View style={styles.savedAddrEmpty}>
                <Ionicons name="bookmark-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.savedAddrEmptyText}>{t('noSavedAddresses')}</Text>
              </View>
            ) : (
              savedAddresses.map((addr) => (
                <Pressable
                  key={addr.id}
                  style={({ pressed }) => [styles.savedAddrItem, pressed && { backgroundColor: Colors.primary + '08' }]}
                  onPress={() => handleSelectSavedAddress(addr)}
                >
                  <Ionicons name="location" size={20} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedAddrLabel}>{addr.label}</Text>
                    <Text style={styles.savedAddrText} numberOfLines={2}>{addr.address}</Text>
                  </View>
                  <Pressable onPress={() => handleRemoveSavedAddress(addr.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </Pressable>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: Colors.text },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 100 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptyDesc: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  browseBtn: { marginTop: 12, backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  browseBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  cartItem: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: 12, gap: 12,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  itemImage: { width: 70, height: 70, borderRadius: 12 },
  itemInfo: { flex: 1, justifyContent: 'center', gap: 2 },
  itemName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  itemShop: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  itemPrice: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: Colors.primary, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text, minWidth: 20, textAlign: 'center' },

  addressSection: { marginTop: 16 },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  addressLabel: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text, flex: 1 },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  gpsBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#fff' },
  selectedAddressCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: Colors.primary + '30',
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  selectedAddressContent: { flex: 1 },
  selectedAddressText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text, lineHeight: 20 },
  selectedCoordsText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 4 },
  clearAddrBtn: { padding: 2, marginLeft: 8 },
  noAddressHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  noAddressText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  pickLocationBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  pickLocationGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  pickLocationText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  manualSection: { gap: 6, marginTop: 4 },
  manualLabel: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  manualInput: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12, fontSize: 13,
    fontFamily: 'Poppins_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border,
    minHeight: 64, textAlignVertical: 'top',
  },

  paymentSection: { marginTop: 20 },
  sectionHeading: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text, marginBottom: 12 },
  paymentRow: { flexDirection: 'row', gap: 12 },
  paymentCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', gap: 6, position: 'relative',
  },
  paymentCardSelected: { borderColor: Colors.success, backgroundColor: Colors.success + '06' },
  paymentCardUpiSelected: { borderColor: '#FF6B00', backgroundColor: '#FF6B0008' },
  paymentCardOnlineSelected: { borderColor: '#5433FF', backgroundColor: '#5433FF08' },
  paymentIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  paymentTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text, textAlign: 'center' },
  paymentSub: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center' },
  paymentCheck: { position: 'absolute', top: 8, right: 8 },
  stripeNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10,
    backgroundColor: '#5433FF08', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#5433FF20',
  },
  stripeNoteText: { flex: 1, fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, lineHeight: 16 },
  upiPanel: {
    marginTop: 12, backgroundColor: '#FF6B0006', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FF6B0025', gap: 12, alignItems: 'center',
  },
  upiQrCard: { alignItems: 'center', gap: 8 },
  upiQrFrame: {
    padding: 12, backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  upiQrHint: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center' },
  upiDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  upiDividerLine: { flex: 1, height: 1, backgroundColor: '#FF6B0030' },
  upiDividerText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#FF6B00' },
  upiIdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  upiIdBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#FF6B0030',
  },
  upiIdText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text, flexShrink: 1 },
  upiCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF6B0012', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#FF6B0030',
  },
  upiCopyText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#FF6B00' },
  upiAppsLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  paymentMethodLabel: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary, marginTop: 2 },
  totalAmount: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text },
  orderBtn: { borderRadius: 14, overflow: 'hidden' },
  orderBtnDisabled: { opacity: 0.7 },
  orderGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  orderBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  paymentModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  paymentModalCard: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: 32,
    marginHorizontal: 32, alignItems: 'center', gap: 12,
  },
  paymentModalTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  paymentModalSub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  paymentModalDismiss: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  paymentModalDismissText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },

  addressBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  saveAddressBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '25',
  },
  saveAddressBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  useSavedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: '#FF6B0010', borderWidth: 1, borderColor: '#FF6B0025',
  },
  useSavedBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#FF6B00' },

  savedAddrOverlay: { flex: 1, justifyContent: 'flex-end' },
  savedAddrBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  savedAddrSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '70%',
  },
  savedAddrHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  savedAddrTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  savedAddrEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  savedAddrEmptyText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  savedAddrItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, marginBottom: 8,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  savedAddrLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  savedAddrText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },

  timeSlotSection: { marginTop: 20 },
  timeSlotBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  timeSlotBtnSelected: {
    borderColor: Colors.primary, backgroundColor: Colors.primary + '10',
  },
  timeSlotBtnText: {
    fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary,
  },
  timeSlotBtnTextSelected: {
    color: Colors.primary, fontFamily: 'Poppins_600SemiBold',
  },
  timeSlotHint: {
    fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.error, marginTop: 6,
  },

  walletSection: { marginTop: 20 },
  walletCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  walletAmount: {
    fontSize: 20, fontFamily: 'Poppins_700Bold', marginBottom: 4,
  },
  walletHint: {
    fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary,
  },
  walletToggle: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  walletToggleActive: {
    borderColor: Colors.success + '50', backgroundColor: Colors.success + '08',
  },
  walletToggleText: {
    fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary,
  },
});
