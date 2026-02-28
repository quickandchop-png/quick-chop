import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useIsDesktopWeb } from '@/components/WebSidebar';
import {
  getProducts, getShops, addProduct, updateProduct, deleteProduct,
  Product, Shop, ProductCategory, getCategories, CategoryItem,
} from '@/lib/storage';
import { MASTER_PRODUCTS, MasterProduct } from '@/lib/product-master';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateProductName } from '@/lib/i18n';

type EditMode = null | 'add' | 'edit' | 'quick' | 'bulkPricing';

export default function AdminProductsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('');
  const [customCategory, setCustomCategory] = useState<ProductCategory>('vegetables');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [saving, setSaving] = useState(false);

  const [quickCategory, setQuickCategory] = useState<ProductCategory>('vegetables');
  const [selectedMasterItems, setSelectedMasterItems] = useState<MasterProduct[]>([]);
  const [bulkData, setBulkData] = useState<Record<string, { price: string; stock: string; shopId: string }>>({});
  const [savingBulk, setSavingBulk] = useState(false);

  const loadData = useCallback(async () => {
    const cat = activeCategory === 'all' ? undefined : activeCategory;
    const [p, s, cats] = await Promise.all([getProducts(cat), getShops(), getCategories()]);
    setProducts(p);
    setShops(s);
    setAllCategories(cats);
    setLoading(false);
  }, [activeCategory]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  function openAdd() {
    setEditMode(null);
    setEditProduct(null);
    setSelectedMasterItems([]);
    setBulkData({});
    setName(''); setDescription(''); setPrice(''); setImage('');
    setStock(''); setUnit(''); setCustomCategory('vegetables');
    setSelectedShopId(shops[0]?.id || '');
    setTimeout(() => setEditMode('quick'), 50);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setName(p.name);
    setDescription(p.description);
    setPrice(String(p.price));
    setImage(p.image);
    setStock(String(p.stock));
    setUnit(p.unit);
    setCustomCategory(p.category || 'vegetables');
    setSelectedShopId(p.shopId);
    setEditMode('edit');
  }

  function closeModal() {
    setEditMode(null);
    setEditProduct(null);
    setSelectedMasterItems([]);
    setBulkData({});
  }

  async function pickImage() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    };
    Alert.alert('Product Image', 'Choose image source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required to take photos');
            return;
          }
          const result = await ImagePicker.launchCameraAsync(options);
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync(options);
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSave() {
    if (!name.trim() || !price) return;
    const shop = shops.find(s => s.id === selectedShopId);
    if (!shop) {
      Alert.alert('Error', 'Please select a shop');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const productData = {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        image: image.trim(),
        stock: parseInt(stock) || 0,
        unit: unit.trim(),
        shopId: shop.id,
        shopName: shop.name,
        category: customCategory,
      };
      if (editProduct) {
        await updateProduct(editProduct.id, productData);
      } else {
        await addProduct(productData);
      }
      closeModal();
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Product) {
    Alert.alert(t('deleteProduct'), t('removeProduct').replace('{name}', translateProductName(p.name, language)), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await deleteProduct(p.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          loadData();
        },
      },
    ]);
  }

  function toggleMasterItem(item: MasterProduct) {
    Haptics.selectionAsync();
    setSelectedMasterItems(prev => {
      const exists = prev.find(p => p.id === item.id);
      if (exists) {
        const next = prev.filter(p => p.id !== item.id);
        const nextData = { ...bulkData };
        delete nextData[item.id];
        setBulkData(nextData);
        return next;
      }
      const defaultShop = shops.find(s => s.category === item.category);
      setBulkData(d => ({ ...d, [item.id]: { price: '', stock: '', shopId: defaultShop?.id || shops[0]?.id || '' } }));
      return [...prev, item];
    });
  }

  function updateBulkField(id: string, field: 'price' | 'stock' | 'shopId', val: string) {
    setBulkData(d => ({ ...d, [id]: { ...d[id], [field]: val } }));
  }

  async function handleSaveBulk() {
    const missing = selectedMasterItems.filter(item => !bulkData[item.id]?.price);
    if (missing.length > 0) {
      Alert.alert(t('missingPrice'), t('enterPriceFor').replace('{names}', missing.map(m => translateProductName(m.name, language)).join(', ')));
      return;
    }
    setSavingBulk(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      for (const item of selectedMasterItems) {
        const d = bulkData[item.id];
        const shop = shops.find(s => s.id === d.shopId);
        await addProduct({
          name: item.name,
          description: item.defaultDescription,
          price: parseFloat(d.price),
          image: item.image,
          stock: parseInt(d.stock) || 50,
          unit: item.unit,
          shopId: d.shopId,
          shopName: shop?.name || 'Unknown',
          category: item.category,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save products');
    } finally {
      setSavingBulk(false);
    }
  }

  const categoryCounts: Record<string, number> = {};
  if (activeCategory === 'all') {
    products.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
  }

  const masterFiltered = MASTER_PRODUCTS.filter(p => p.category === quickCategory);
  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('allProducts')}</Text>
          <Text style={styles.subtitle}>{t('itemsAcrossShops').replace('{count}', String(products.length)).replace('{shops}', String(shops.length))}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>{t('add')}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}
          onPress={() => { setActiveCategory('all'); Haptics.selectionAsync(); }}
        >
          <MaterialCommunityIcons name="grid" size={14} color={activeCategory === 'all' ? '#fff' : Colors.textSecondary} />
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
            {activeCategory === 'all' && (
              <View style={[styles.countBadge, activeCategory === cat.id && styles.countBadgeActive]}>
                <Text style={[styles.countText, activeCategory === cat.id && styles.countTextActive]}>
                  {categoryCounts[cat.id] || 0}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {activeCategory === 'all' && allCategories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
          {allCategories.map(cat => (
            <View key={cat.id} style={[styles.summaryCard, { borderLeftColor: cat.color }]}>
              <Ionicons name={cat.icon as any} size={18} color={cat.color} />
              <Text style={styles.summaryCount}>{categoryCounts[cat.id] || 0}</Text>
              <Text style={styles.summaryLabel}>{cat.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!products.length}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="basket-off-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{loading ? '...' : t('noProductsFound')}</Text>
            <Text style={styles.emptyDesc}>
              {loading ? '' : activeCategory !== 'all' ? t('noCategoryProducts') : t('productsAppearHere')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const shop = shops.find(s => s.id === item.shopId);
          const catItem = allCategories.find(c => c.id === item.category);
          const catColor = catItem?.color || '#666';
          const catLabel = catItem?.name || item.category;
          return (
            <View style={styles.productCard}>
              <Image source={{ uri: item.image }} style={styles.productImage} contentFit="cover" />
              <View style={styles.productInfo}>
                <View style={styles.productTopRow}>
                  <Text style={styles.productName} numberOfLines={1}>{translateProductName(item.name, language)}</Text>
                  <View style={[styles.categoryBadge, { backgroundColor: catColor + '15' }]}>
                    <Text style={[styles.categoryBadgeText, { color: catColor }]}>{catLabel}</Text>
                  </View>
                </View>
                <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text>
                <View style={styles.shopRow}>
                  <Ionicons name="storefront-outline" size={12} color={Colors.textTertiary} />
                  <Text style={styles.shopName}>{item.shopName || shop?.name || 'Unknown Shop'}</Text>
                </View>
                <View style={styles.productBottomRow}>
                  <Text style={styles.productPrice}>Rs.{item.price}</Text>
                  <Text style={styles.productUnit}>{item.unit}</Text>
                  <View style={[styles.stockBadge, item.stock <= 5 && styles.stockLow]}>
                    <Text style={[styles.stockText, item.stock <= 5 && styles.stockTextLow]}>
                      {item.stock} {t('inStock')}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.productActions}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="create-outline" size={18} color={Colors.primary} />
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.actionBtnDelete]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={editMode !== null} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />

              {(editMode === 'quick' || editMode === 'bulkPricing') && (
                <>
                  <View style={styles.modalHeader}>
                    <Pressable onPress={() => editMode === 'bulkPricing' ? setEditMode('quick') : closeModal()}>
                      <Ionicons name={editMode === 'bulkPricing' ? 'arrow-back' : 'close'} size={24} color={Colors.text} />
                    </Pressable>
                    <Text style={styles.modalTitle}>
                      {editMode === 'bulkPricing' ? `${t('setPrices')} (${selectedMasterItems.length})` : t('quickAddProducts')}
                    </Text>
                    <Pressable onPress={() => { setEditMode('add'); setEditProduct(null); }}>
                      <Text style={styles.customModeLink}>{t('custom')}</Text>
                    </Pressable>
                  </View>

                  {editMode === 'quick' && (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabsScroll} contentContainerStyle={styles.categoryTabs}>
                        {allCategories.map(cat => (
                          <Pressable
                            key={cat.id}
                            style={[styles.categoryTab, quickCategory === cat.id && styles.categoryTabActive]}
                            onPress={() => { setQuickCategory(cat.id); Haptics.selectionAsync(); }}
                          >
                            <Ionicons
                              name={cat.icon as any}
                              size={16}
                              color={quickCategory === cat.id ? '#fff' : Colors.textSecondary}
                            />
                            <Text style={[styles.categoryTabText, quickCategory === cat.id && styles.categoryTabTextActive]}>
                              {cat.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <FlatList
                        data={masterFiltered}
                        keyExtractor={item => item.id}
                        numColumns={2}
                        columnWrapperStyle={{ gap: 10 }}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 10 }}
                        style={{ maxHeight: 380 }}
                        renderItem={({ item }) => {
                          const selected = !!selectedMasterItems.find(s => s.id === item.id);
                          return (
                            <Pressable
                              style={[styles.masterItemCard, selected && styles.masterItemCardSelected]}
                              onPress={() => toggleMasterItem(item)}
                            >
                              <Image source={{ uri: item.image }} style={styles.masterItemImg} contentFit="cover" />
                              {selected && (
                                <View style={styles.masterItemCheck}>
                                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                                </View>
                              )}
                              <Text style={styles.masterItemName} numberOfLines={1}>{translateProductName(item.name, language)}</Text>
                              <Text style={styles.masterItemUnit}>{item.unit}</Text>
                            </Pressable>
                          );
                        }}
                      />

                      {selectedMasterItems.length > 0 && (
                        <View style={styles.selectionBar}>
                          <Text style={styles.selectionCount}>{t('itemsSelected').replace('{count}', String(selectedMasterItems.length))}</Text>
                          <Pressable style={styles.nextBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setEditMode('bulkPricing'); }}>
                            <Text style={styles.nextBtnText}>{t('setPrices')} →</Text>
                          </Pressable>
                        </View>
                      )}
                    </>
                  )}

                  {editMode === 'bulkPricing' && (
                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
                      {selectedMasterItems.map(item => {
                        const shopForItem = shops.find(s => s.id === bulkData[item.id]?.shopId);
                        return (
                          <View key={item.id} style={styles.bulkItemRow}>
                            <Image source={{ uri: item.image }} style={styles.bulkItemImg} contentFit="cover" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.bulkItemName}>{translateProductName(item.name, language)}</Text>
                              <Text style={styles.bulkItemUnit}>{item.unit}</Text>
                              <Text style={styles.bulkItemShop} numberOfLines={1}>{shopForItem?.name || t('selectShop')}</Text>
                            </View>
                            <TextInput
                              style={styles.bulkInput}
                              placeholder="Price"
                              placeholderTextColor={Colors.textTertiary}
                              keyboardType="numeric"
                              value={bulkData[item.id]?.price || ''}
                              onChangeText={v => updateBulkField(item.id, 'price', v)}
                            />
                            <TextInput
                              style={styles.bulkInput}
                              placeholder="Stock"
                              placeholderTextColor={Colors.textTertiary}
                              keyboardType="numeric"
                              value={bulkData[item.id]?.stock || ''}
                              onChangeText={v => updateBulkField(item.id, 'stock', v)}
                            />
                          </View>
                        );
                      })}

                      <Pressable
                        style={[styles.saveAllBtn, savingBulk && { opacity: 0.7 }]}
                        onPress={handleSaveBulk}
                        disabled={savingBulk}
                      >
                        {savingBulk ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-done" size={18} color="#fff" />
                            <Text style={styles.saveAllBtnText}>{t('addAllProducts')}</Text>
                          </>
                        )}
                      </Pressable>
                    </ScrollView>
                  )}
                </>
              )}

              {(editMode === 'add' || editMode === 'edit') && (
                <>
                  <View style={styles.modalHeader}>
                    <Pressable onPress={() => editMode === 'add' ? setEditMode('quick') : closeModal()}>
                      <Ionicons name={editMode === 'add' ? 'arrow-back' : 'close'} size={24} color={Colors.text} />
                    </Pressable>
                    <Text style={styles.modalTitle}>{editProduct ? t('editProduct') : t('customProduct')}</Text>
                    <View style={{ width: 60 }} />
                  </View>

                  <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                      {allCategories.map(cat => (
                        <Pressable
                          key={cat.id}
                          style={[styles.categoryPill, customCategory === cat.id && styles.categoryPillActive]}
                          onPress={() => { setCustomCategory(cat.id); Haptics.selectionAsync(); }}
                        >
                          <Text style={[styles.categoryPillText, customCategory === cat.id && styles.categoryPillTextActive]}>
                            {cat.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>{t('assignToShop')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {shops.map(s => (
                        <Pressable
                          key={s.id}
                          style={[styles.shopPill, selectedShopId === s.id && styles.shopPillActive]}
                          onPress={() => { setSelectedShopId(s.id); Haptics.selectionAsync(); }}
                        >
                          <Text style={[styles.shopPillText, selectedShopId === s.id && styles.shopPillTextActive]}>{s.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <TextInput
                      style={styles.input}
                      placeholder={`${t('productName')} *`}
                      placeholderTextColor={Colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                    />
                    <TextInput
                      style={[styles.input, styles.inputMulti]}
                      placeholder={t('description')}
                      placeholderTextColor={Colors.textTertiary}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={2}
                    />
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={`${t('priceRs')} *`}
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="numeric"
                        value={price}
                        onChangeText={setPrice}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t('stock')}
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="numeric"
                        value={stock}
                        onChangeText={setStock}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t('unitLabel')}
                      placeholderTextColor={Colors.textTertiary}
                      value={unit}
                      onChangeText={setUnit}
                    />

                    <View style={styles.imageRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t('imageUrl')}
                        placeholderTextColor={Colors.textTertiary}
                        value={image}
                        onChangeText={setImage}
                      />
                      <Pressable style={styles.galleryBtn} onPress={pickImage}>
                        <Ionicons name="image" size={20} color={Colors.primary} />
                      </Pressable>
                    </View>

                    {!!image && (
                      <Image source={{ uri: image }} style={styles.previewImage} contentFit="cover" />
                    )}

                    <Pressable
                      style={[styles.saveBtn, (!name.trim() || !price || !selectedShopId) && styles.saveBtnDisabled, saving && { opacity: 0.7 }]}
                      onPress={handleSave}
                      disabled={!name.trim() || !price || !selectedShopId || saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={20} color="#fff" />
                          <Text style={styles.saveBtnText}>{editProduct ? t('updateProduct') : t('addProduct')}</Text>
                        </>
                      )}
                    </Pressable>
                  </ScrollView>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: Colors.text },
  subtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
  },
  addBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  countBadge: {
    backgroundColor: Colors.primary + '18', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, marginLeft: 2,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  countText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  countTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4,
    borderLeftWidth: 3, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  summaryCount: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  summaryLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  productCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, overflow: 'hidden',
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  productImage: { width: 80, height: 90 },
  productInfo: { flex: 1, padding: 10, justifyContent: 'space-between' },
  productTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  productName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text, flex: 1 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  categoryBadgeText: { fontSize: 10, fontFamily: 'Poppins_500Medium', textTransform: 'capitalize' },
  productDesc: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  shopName: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  productBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  productPrice: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  productUnit: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  stockBadge: { backgroundColor: Colors.success + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' },
  stockLow: { backgroundColor: Colors.error + '15' },
  stockText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.success },
  stockTextLow: { color: Colors.error },
  productActions: { justifyContent: 'space-around', padding: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center',
  },
  actionBtnDelete: { backgroundColor: Colors.error + '12' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  emptyDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%', paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: Colors.text },
  customModeLink: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },

  categoryTabsScroll: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  categoryTabs: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 10 },
  categoryTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  categoryTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryTabText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  categoryTabTextActive: { color: '#fff' },

  masterItemCard: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  masterItemCardSelected: { borderColor: Colors.primary, borderWidth: 2 },
  masterItemImg: { width: '100%', height: 90 },
  masterItemCheck: { position: 'absolute', top: 6, right: 6, backgroundColor: '#fff', borderRadius: 12 },
  masterItemName: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.text, paddingHorizontal: 8, paddingTop: 6 },
  masterItemUnit: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, paddingHorizontal: 8, paddingBottom: 8 },

  selectionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
  },
  selectionCount: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  nextBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  nextBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  bulkItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  bulkItemImg: { width: 48, height: 48, borderRadius: 10 },
  bulkItemName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  bulkItemUnit: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  bulkItemShop: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.primary, marginTop: 2 },
  bulkInput: {
    width: 70, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.text,
    backgroundColor: Colors.surface, textAlign: 'center',
  },
  saveAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 8,
  },
  saveAllBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  categoryPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryPillText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  categoryPillTextActive: { color: '#fff' },

  fieldLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text, marginTop: 4 },
  shopPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  shopPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  shopPillText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },
  shopPillTextActive: { color: '#fff' },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  imageRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  galleryBtn: {
    width: 50, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary + '10',
  },
  previewImage: { width: '100%', height: 160, borderRadius: 12 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
