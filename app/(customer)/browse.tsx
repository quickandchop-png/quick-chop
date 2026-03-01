import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  ActivityIndicator, Platform, RefreshControl, Modal, KeyboardAvoidingView,
  ScrollView, Keyboard, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { getProducts, getShops, Product, Shop, addToCart, getCustomerPrice, getCategories, CategoryItem } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { translateProductName } from '../../lib/i18n';
import CustomerAuthModal from '../../components/CustomerAuthModal';
import { getPickedLocation } from '../../lib/location-store';
import { isVoiceSupported, startVoiceRecognition, stopVoiceRecognition } from '../../lib/voice-search';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MIN_KG = 0.05;
const STEP_KG = 0.05;

function parseUnitKg(unit: string): number {
  const lower = unit.toLowerCase().replace(/\s/g, '');
  const num = parseFloat(lower);
  if (lower.includes('kg')) return isNaN(num) ? 1 : num;
  if (lower.includes('g') && !lower.includes('pc') && !lower.includes('set')) {
    const g = isNaN(num) ? 100 : num;
    return g / 1000;
  }
  return 1;
}

function isWeightUnit(unit: string): boolean {
  const l = unit.toLowerCase();
  return l.includes('kg') || (l.includes('g') && !l.includes('pc') && !l.includes('pcs') && !l.includes('set'));
}

function getMinQtyUnits(unit: string): number {
  return isWeightUnit(unit) ? Math.round((MIN_KG / parseUnitKg(unit)) * 1000) / 1000 : 1;
}

function getStepQtyUnits(unit: string): number {
  return isWeightUnit(unit) ? Math.round((STEP_KG / parseUnitKg(unit)) * 1000) / 1000 : 1;
}

function formatKg(kg: number): string {
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded} kg`;
}

function totalWeightLabel(qty: number, unit: string): string {
  if (!isWeightUnit(unit)) return `${qty} × ${unit}`;
  const totalKg = qty * parseUnitKg(unit);
  return formatKg(totalKg);
}

function addBtnLabel(qty: number, unit: string): string {
  if (!isWeightUnit(unit)) return `Add ${qty} × ${unit} to Cart`;
  const totalKg = qty * parseUnitKg(unit);
  return `Add ${formatKg(totalKg)} to Cart`;
}

function ProductItem({
  product,
  onAddPress,
  distanceKm,
}: {
  product: Product;
  onAddPress: (product: Product) => void;
  distanceKm?: number;
}) {
  const { isGuest } = useAuth();
  const { t, language } = useLanguage();

  return (
    <View style={styles.productCard}>
      <Image source={{ uri: product.image }} style={styles.productImage} contentFit="cover" />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{translateProductName(product.name, language)}</Text>
        <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
        <View style={styles.shopDistRow}>
          <Text style={styles.productShop}>{product.shopName}</Text>
          {distanceKm !== undefined && (
            <View style={styles.distBadge}>
              <Ionicons name="location" size={10} color={Colors.primary} />
              <Text style={styles.distText}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</Text>
            </View>
          )}
        </View>
        <View style={styles.productRow}>
          <View>
            <Text style={styles.productPrice}>Rs.{getCustomerPrice(product.price)}</Text>
            <Text style={styles.productUnit}>{product.unit}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }, product.stock <= 0 && { backgroundColor: Colors.textTertiary }]}
            onPress={() => onAddPress(product)}
            disabled={product.stock <= 0}
          >
            <Ionicons name={isGuest ? 'log-in-outline' : 'add'} size={16} color="#fff" />
            <Text style={styles.addBtnText}>{product.stock <= 0 ? t('soldOut') : t('add')}</Text>
          </Pressable>
        </View>
        {product.stock <= 5 && product.stock > 0 && (
          <Text style={styles.lowStock}>{t('onlyLeft', { count: product.stock })}</Text>
        )}
      </View>
    </View>
  );
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [customerCoords, setCustomerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sortMode, setSortMode] = useState<'nearest' | 'lowest_price' | 'none'>('nearest');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(params.category || 'all');

  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);

  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [inputText, setInputText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addedDone, setAddedDone] = useState(false);
  const qtyInputRef = useRef<TextInput>(null);

  const { isGuest } = useAuth();
  const { t, language } = useLanguage();

  const shopDistances = useCallback(() => {
    if (!customerCoords) return new Map<string, number>();
    const map = new Map<string, number>();
    shops.forEach(s => {
      if (s.latitude && s.longitude) {
        map.set(s.id, haversineDistance(customerCoords.latitude, customerCoords.longitude, s.latitude, s.longitude));
      }
    });
    return map;
  }, [customerCoords, shops]);

  const [detectingGps, setDetectingGps] = useState(false);

  async function autoDetectGPS() {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('locationNeeded'), 'Please enable location permission or pick a delivery address from your cart.');
        setDetectingGps(false);
        return false;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCustomerCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setDetectingGps(false);
      return true;
    } catch {
      Alert.alert(t('locationNeeded'), 'Could not detect your location. Please set your delivery address from the cart.');
      setDetectingGps(false);
      return false;
    }
  }

  const loadData = useCallback(async () => {
    const cat = activeCategory === 'all' ? undefined : activeCategory as any;
    const [p, s, loc, cats] = await Promise.all([getProducts(cat), getShops(), getPickedLocation(), getCategories()]);
    setProducts(p);
    setShops(s);
    setAllCategories(cats);
    if (loc) {
      setCustomerCoords({ latitude: loc.latitude, longitude: loc.longitude });
    }
    setLoading(false);
  }, [activeCategory]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    return () => { stopVoiceRecognition(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  function handleAuthRequired(callback: () => void) {
    setPendingAction(() => callback);
    setShowAuth(true);
  }

  function handleAuthSuccess() {
    setShowAuth(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }

  function qtyToKgText(q: number, unit: string): string {
    if (!isWeightUnit(unit)) return String(q);
    const kg = Math.round(q * parseUnitKg(unit) * 1000) / 1000;
    return String(kg);
  }

  function openPicker(product: Product) {
    const initQty = getMinQtyUnits(product.unit);
    if (isGuest) {
      handleAuthRequired(() => {
        setPickerProduct(product);
        setQty(initQty);
        setInputText(qtyToKgText(initQty, product.unit));
        setAddedDone(false);
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickerProduct(product);
    setQty(initQty);
    setInputText(qtyToKgText(initQty, product.unit));
    setAddedDone(false);
  }

  function closePicker() {
    if (adding) return;
    setPickerProduct(null);
    setAddedDone(false);
  }

  function changeQty(delta: number) {
    if (!pickerProduct) return;
    const unitKg = parseUnitKg(pickerProduct.unit);
    const currentKg = qty * unitKg;
    const nextKg = Math.round((currentKg + delta * STEP_KG) * 1000) / 1000;
    const maxKg = pickerProduct.stock * unitKg;
    const clampedKg = Math.max(MIN_KG, Math.min(nextKg, maxKg));
    const nextQty = Math.round((clampedKg / unitKg) * 1000) / 1000;
    if (nextQty !== qty) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQty(nextQty);
      setInputText(qtyToKgText(nextQty, pickerProduct.unit));
      qtyInputRef.current?.blur();
    }
  }

  function handleInputChange(text: string) {
    setInputText(text.replace(/[^0-9.]/g, ''));
  }

  function handleInputBlur() {
    if (!pickerProduct) return;
    const parsed = parseFloat(inputText);
    const unitKg = parseUnitKg(pickerProduct.unit);
    const minKg = MIN_KG;
    const maxKg = pickerProduct.stock * unitKg;
    if (isNaN(parsed) || parsed <= 0) {
      const minQty = getMinQtyUnits(pickerProduct.unit);
      setQty(minQty);
      setInputText(qtyToKgText(minQty, pickerProduct.unit));
      return;
    }
    if (isWeightUnit(pickerProduct.unit)) {
      const snappedKg = Math.round(parsed / STEP_KG) * STEP_KG;
      const clampedKg = Math.max(minKg, Math.min(Math.round(snappedKg * 1000) / 1000, maxKg));
      const finalQty = Math.round((clampedKg / unitKg) * 1000) / 1000;
      setQty(finalQty);
      setInputText(qtyToKgText(finalQty, pickerProduct.unit));
    } else {
      const clamped = Math.max(1, Math.min(Math.round(parsed), pickerProduct.stock));
      setQty(clamped);
      setInputText(String(clamped));
    }
  }

  async function confirmAdd() {
    if (!pickerProduct || adding || pickerProduct.stock <= 0) return;
    setAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addToCart(pickerProduct, qty);
    setAdding(false);
    setAddedDone(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      setPickerProduct(null);
      setAddedDone(false);
    }, 900);
  }

  const distMap = shopDistances();

  const sortedShops = [...shops].sort((a, b) => {
    if (distMap.size > 0) {
      const da = distMap.get(a.id) ?? Infinity;
      const db = distMap.get(b.id) ?? Infinity;
      return da - db;
    }
    return 0;
  });

  const filtered = products
    .filter(p => p.price > 0)
    .filter(p => !selectedShopId || p.shopId === selectedShopId)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || translateProductName(p.name, language).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === 'nearest' && distMap.size > 0) {
        const da = distMap.get(a.shopId) ?? Infinity;
        const db = distMap.get(b.shopId) ?? Infinity;
        return da - db;
      }
      if (sortMode === 'lowest_price') {
        return a.price - b.price;
      }
      return 0;
    });

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  const totalPrice = pickerProduct ? (getCustomerPrice(pickerProduct.price) * qty).toFixed(2) : '0';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('browseProducts')}</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchProducts')}
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
            </Pressable>
          )}
          {Platform.OS === 'web' && isVoiceSupported() && (
            <Pressable
              onPress={() => {
                if (voiceListening) {
                  stopVoiceRecognition();
                  setVoiceListening(false);
                } else {
                  setVoiceListening(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  startVoiceRecognition(
                    language as any,
                    (text) => { setSearch(text); setVoiceListening(false); },
                    () => setVoiceListening(false),
                    () => setVoiceListening(false),
                  );
                }
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name={voiceListening ? 'radio' : 'mic'} size={20} color={voiceListening ? Colors.primary : Colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}
            onPress={() => { setActiveCategory('all'); Haptics.selectionAsync(); }}
          >
            <Ionicons name="grid" size={14} color={activeCategory === 'all' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.filterText, activeCategory === 'all' && styles.filterTextActive]}>{t('all')}</Text>
          </Pressable>
          {allCategories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.filterChip, activeCategory === cat.id && styles.filterChipActive]}
              onPress={() => { setActiveCategory(cat.id); Haptics.selectionAsync(); }}
            >
              <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.id ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.filterText, activeCategory === cat.id && styles.filterTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {shops.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopFilterRow}>
            <Pressable
              style={[styles.shopChip, !selectedShopId && styles.shopChipActive]}
              onPress={() => { setSelectedShopId(null); Haptics.selectionAsync(); }}
            >
              <Ionicons name="apps" size={13} color={!selectedShopId ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.shopChipText, !selectedShopId && styles.shopChipTextActive]}>{t('allShops') || 'All Shops'}</Text>
            </Pressable>
            {sortedShops.map((shop) => {
              const dist = distMap.get(shop.id);
              const isSelected = selectedShopId === shop.id;
              return (
                <Pressable
                  key={shop.id}
                  style={[styles.shopChip, isSelected && styles.shopChipActive]}
                  onPress={() => { setSelectedShopId(isSelected ? null : shop.id); Haptics.selectionAsync(); }}
                >
                  <Ionicons name="storefront" size={13} color={isSelected ? '#fff' : '#FF6B00'} />
                  <View>
                    <Text style={[styles.shopChipText, isSelected && styles.shopChipTextActive]} numberOfLines={1}>{shop.name}</Text>
                    {dist !== undefined && (
                      <Text style={[styles.shopChipDist, isSelected && { color: '#ffffffcc' }]}>
                        {dist < 1 ? `${Math.round(dist * 1000)}m ${t('awayLabel') || 'away'}` : `${dist.toFixed(1)}km ${t('awayLabel') || 'away'}`}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.sortRow}>
          <Pressable
            style={[styles.sortChip, sortMode === 'nearest' && styles.sortChipActive, detectingGps && { opacity: 0.6 }]}
            disabled={detectingGps}
            onPress={async () => {
              Haptics.selectionAsync();
              if (sortMode === 'nearest') {
                setSortMode('none');
                return;
              }
              if (!customerCoords) {
                const ok = await autoDetectGPS();
                if (ok) setSortMode('nearest');
              } else {
                setSortMode('nearest');
              }
            }}
          >
            {detectingGps ? (
              <ActivityIndicator size={13} color={Colors.primary} />
            ) : (
              <Ionicons name="location" size={13} color={sortMode === 'nearest' ? '#fff' : Colors.primary} />
            )}
            <Text style={[styles.sortChipText, sortMode === 'nearest' && styles.sortChipTextActive]}>
              {detectingGps ? 'Locating...' : t('nearest')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sortChip, sortMode === 'lowest_price' && styles.sortChipActive]}
            onPress={() => { setSortMode(sortMode === 'lowest_price' ? 'none' : 'lowest_price'); Haptics.selectionAsync(); }}
          >
            <Ionicons name="pricetag" size={13} color={sortMode === 'lowest_price' ? '#fff' : Colors.primary} />
            <Text style={[styles.sortChipText, sortMode === 'lowest_price' && styles.sortChipTextActive]}>{t('lowestPrice') || 'Lowest Price'}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductItem product={item} onAddPress={openPicker} distanceKm={distMap.get(item.shopId)} />
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="basket-off-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>
                {search ? 'No results found' : selectedShopId ? 'No products in this shop' : 'No products yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {search ? 'Try a different search term' : selectedShopId ? 'This shop hasn\'t added products yet' : 'Check back soon'}
              </Text>
            </View>
          }
        />
      )}

      {isGuest && (
        <View style={styles.guestBanner}>
          <Ionicons name="person-outline" size={16} color={Colors.primary} />
          <Text style={styles.guestBannerText}>{t('browsingAsGuest')}</Text>
        </View>
      )}

      {/* Quantity Picker Modal */}
      <Modal
        visible={!!pickerProduct}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBackdrop} onPress={() => { Keyboard.dismiss(); closePicker(); }} />
          {pickerProduct && (
            <View style={[styles.pickerSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 12 }]}>
              <View style={styles.sheetHandle} />
              <Pressable style={styles.closeBtn} onPress={closePicker} hitSlop={10}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>

              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetScrollContent}
              >
                {/* Compact Product Preview */}
                <View style={styles.productPreviewCompact}>
                  <Image
                    source={{ uri: pickerProduct.image }}
                    style={styles.previewImageCompact}
                    contentFit="cover"
                  />
                  <View style={styles.previewInfoCompact}>
                    <Text style={styles.previewName} numberOfLines={1}>{translateProductName(pickerProduct.name, language)}</Text>
                    <Text style={styles.previewShop}>{pickerProduct.shopName}</Text>
                    <Text style={styles.previewPrice}>Rs.{getCustomerPrice(pickerProduct.price)} <Text style={styles.previewUnit}>/ {pickerProduct.unit}</Text></Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Quantity Label */}
                <Text style={styles.qtyLabel}>{t('selectQuantity')}</Text>
                {isWeightUnit(pickerProduct.unit) && (
                  <Text style={styles.qtyHint}>{t('stepsOf50g')}  ·  {t('pricePer')} {pickerProduct.unit}</Text>
                )}

                {/* Stepper */}
                <View style={styles.stepper}>
                  <Pressable
                    style={[styles.stepBtn, qty <= getMinQtyUnits(pickerProduct.unit) && styles.stepBtnDisabled]}
                    onPress={() => changeQty(-1)}
                    disabled={qty <= getMinQtyUnits(pickerProduct.unit)}
                  >
                    <Ionicons name="remove" size={22} color={qty <= getMinQtyUnits(pickerProduct.unit) ? Colors.textTertiary : Colors.primary} />
                  </Pressable>

                  <View style={styles.qtyBox}>
                    {isWeightUnit(pickerProduct.unit) ? (
                      <View style={styles.inputRow}>
                        <TextInput
                          ref={qtyInputRef}
                          style={styles.qtyInput}
                          value={inputText}
                          onChangeText={handleInputChange}
                          onBlur={handleInputBlur}
                          onSubmitEditing={handleInputBlur}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          returnKeyType="done"
                          maxLength={6}
                        />
                        <Text style={styles.kgLabel}>kg</Text>
                      </View>
                    ) : (
                      <Text style={styles.qtyNum}>{totalWeightLabel(qty, pickerProduct.unit)}</Text>
                    )}
                  </View>

                  <Pressable
                    style={[styles.stepBtn, qty >= pickerProduct.stock && styles.stepBtnDisabled]}
                    onPress={() => changeQty(1)}
                    disabled={qty >= pickerProduct.stock}
                  >
                    <Ionicons name="add" size={22} color={qty >= pickerProduct.stock ? Colors.textTertiary : Colors.primary} />
                  </Pressable>
                </View>

                {/* Total */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('total')}</Text>
                  <Text style={styles.totalAmount}>Rs.{totalPrice}</Text>
                </View>

                {/* Add Button */}
                <Pressable
                  style={[styles.confirmBtn, (adding || addedDone) && styles.confirmBtnDone]}
                  onPress={confirmAdd}
                  disabled={adding || addedDone}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : addedDone ? (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.confirmBtnText}>{t('addedToCart')}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cart" size={20} color="#fff" />
                      <Text style={styles.confirmBtnText}>{addBtnLabel(qty, pickerProduct.unit)}</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomerAuthModal
        visible={showAuth}
        onClose={() => { setShowAuth(false); setPendingAction(null); }}
        onSuccess={handleAuthSuccess}
        initialStep="register"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.text },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  shopFilterRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingRight: 8 },
  shopChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    backgroundColor: '#FF6B0008', borderWidth: 1.5, borderColor: '#FF6B0025',
    maxWidth: 180,
  },
  shopChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  shopChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.text, maxWidth: 120 },
  shopChipTextActive: { color: '#fff' },
  shopChipDist: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.primary, marginTop: -1 },
  sortRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.primary + '12', borderWidth: 1, borderColor: Colors.primary + '30',
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.primary },
  sortChipTextActive: { color: '#fff' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden',
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  productImage: { width: 100, height: 110 },
  productInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  productName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  productDesc: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  productShop: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2, flex: 1 },
  shopDistRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.primary + '12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  distText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.primary },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  productPrice: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  productUnit: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  lowStock: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.warning, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptyDesc: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  guestBanner: {
    position: 'absolute', top: Platform.OS === 'web' ? 67 + 60 : 100,
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '15', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  guestBannerText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.primary },

  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, maxHeight: '85%',
  },
  sheetScrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8, marginHorizontal: 20 },
  closeBtn: {
    position: 'absolute', top: 18, right: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
  },

  productPreview: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 18 },
  previewImage: { width: 90, height: 90, borderRadius: 14 },
  previewInfo: { flex: 1, gap: 3 },
  productPreviewCompact: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  previewImageCompact: { width: 56, height: 56, borderRadius: 12 },
  previewInfoCompact: { flex: 1, gap: 2 },
  previewName: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: Colors.text },
  previewShop: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  previewDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, lineHeight: 17 },
  previewPrice: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.primary, marginTop: 4 },
  previewUnit: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },

  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 18 },

  qtyLabel: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text, textAlign: 'center' },
  qtyHint: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 },
  stepBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary + '40',
  },
  stepBtnDisabled: { backgroundColor: Colors.background, borderColor: Colors.border },
  qtyBox: { alignItems: 'center', minWidth: 120 },
  qtyNum: { fontSize: 30, fontFamily: 'Poppins_700Bold', color: Colors.text, lineHeight: 38 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyInput: {
    fontSize: 36, fontFamily: 'Poppins_700Bold', color: Colors.text,
    borderBottomWidth: 2, borderBottomColor: Colors.primary,
    minWidth: 70, textAlign: 'center', paddingVertical: 2,
  },
  kgLabel: { fontSize: 20, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary, marginTop: 4 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16,
  },
  totalLabel: { fontSize: 15, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  totalAmount: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.primary },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 15,
  },
  confirmBtnDone: { backgroundColor: Colors.success },
  confirmBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
