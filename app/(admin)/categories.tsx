import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Modal, TextInput,
  Alert, Platform, ActivityIndicator, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useIsDesktopWeb } from '@/components/WebSidebar';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getCategories, addCategory, updateCategory, deleteCategory,
  CategoryItem, getProducts,
} from '@/lib/storage';

const ICON_OPTIONS = [
  'leaf', 'basket', 'pencil', 'cart', 'fast-food', 'pizza', 'fish', 'beer',
  'cafe', 'ice-cream', 'nutrition', 'flower', 'medical', 'bandage', 'fitness',
  'football', 'bicycle', 'car', 'construct', 'hammer', 'color-palette',
  'shirt', 'glasses', 'watch', 'diamond', 'gift', 'paw', 'game-controller',
  'musical-note', 'book', 'laptop', 'phone-portrait', 'camera', 'bulb',
  'home', 'bed', 'restaurant', 'wine', 'water', 'flame',
];

const COLOR_OPTIONS = [
  '#2E7D32', '#E65100', '#1565C0', '#6A1B9A', '#C62828',
  '#00838F', '#F57F17', '#4E342E', '#37474F', '#AD1457',
  '#1B5E20', '#E91E63', '#FF6F00', '#0277BD', '#7B1FA2',
];

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<CategoryItem | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('cart');
  const [catColor, setCatColor] = useState('#2E7D32');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [cats, products] = await Promise.all([getCategories(), getProducts()]);
    setCategories(cats);
    const counts: Record<string, number> = {};
    products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    setProductCounts(counts);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function openAdd() {
    setEditCat(null);
    setCatName('');
    setCatIcon('cart');
    setCatColor('#2E7D32');
    setShowModal(true);
  }

  function openEdit(cat: CategoryItem) {
    setEditCat(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon);
    setCatColor(cat.color);
    setShowModal(true);
  }

  async function handleSave() {
    if (!catName.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (editCat) {
        await updateCategory(editCat.id, { name: catName.trim(), icon: catIcon, color: catColor });
      } else {
        await addCategory({ name: catName.trim(), icon: catIcon, color: catColor });
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(cat: CategoryItem) {
    if (cat.isDefault) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted. You can edit their name, icon, or color.');
      return;
    }
    const count = productCounts[cat.id] || 0;
    const msg = count > 0
      ? `"${cat.name}" has ${count} product(s). Deleting won't remove products, but they'll appear under "Uncategorized".`
      : `Delete "${cat.name}" category?`;
    Alert.alert('Delete Category', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(cat.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  const isDesktop = useIsDesktopWeb();
  const webTopPad = Platform.OS === 'web' ? (isDesktop ? 20 : 67) : 0;
  const webBottomPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Categories</Text>
          <Text style={styles.subtitle}>{categories.length} categories</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 + webBottomPad, gap: 10 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!categories.length}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="shape-plus" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No categories yet</Text>
              <Text style={styles.emptyDesc}>Add your first category to organize products</Text>
            </View>
          }
          renderItem={({ item }) => {
            const count = productCounts[item.id] || 0;
            return (
              <View style={styles.catCard}>
                <View style={[styles.catIconCircle, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={styles.catName}>{item.name}</Text>
                    {item.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.catCount}>{count} product{count !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.catActions}>
                  <Pressable style={styles.catActionBtn} onPress={() => openEdit(item)}>
                    <Ionicons name="create-outline" size={18} color={Colors.primary} />
                  </Pressable>
                  {!item.isDefault && (
                    <Pressable style={[styles.catActionBtn, styles.catActionBtnDel]} onPress={() => handleDelete(item)}>
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={[styles.modalSheet, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </Pressable>
                <Text style={styles.modalTitle}>{editCat ? 'Edit Category' : 'New Category'}</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
                <View style={styles.previewCard}>
                  <View style={[styles.previewIcon, { backgroundColor: catColor + '18' }]}>
                    <Ionicons name={catIcon as any} size={28} color={catColor} />
                  </View>
                  <Text style={[styles.previewName, { color: catColor }]}>{catName || 'Category Name'}</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Fruits, Dairy, Electronics..."
                    placeholderTextColor={Colors.textTertiary}
                    value={catName}
                    onChangeText={setCatName}
                    autoFocus
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Icon</Text>
                  <View style={styles.iconGrid}>
                    {ICON_OPTIONS.map(icon => (
                      <Pressable
                        key={icon}
                        style={[styles.iconOption, catIcon === icon && { backgroundColor: catColor + '20', borderColor: catColor }]}
                        onPress={() => { setCatIcon(icon); Haptics.selectionAsync(); }}
                      >
                        <Ionicons name={icon as any} size={20} color={catIcon === icon ? catColor : Colors.textSecondary} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Color</Text>
                  <View style={styles.colorGrid}>
                    {COLOR_OPTIONS.map(color => (
                      <Pressable
                        key={color}
                        style={[styles.colorOption, { backgroundColor: color }, catColor === color && styles.colorOptionActive]}
                        onPress={() => { setCatColor(color); Haptics.selectionAsync(); }}
                      >
                        {catColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Pressable
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.saveBtnText}>{editCat ? 'Update Category' : 'Create Category'}</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
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
    paddingHorizontal: 20, paddingVertical: 16,
  },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: Colors.text },
  subtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  emptyDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center' },

  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  catIconCircle: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  catInfo: { flex: 1 },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  defaultBadge: {
    backgroundColor: Colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.primary },
  catCount: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  catActions: { flexDirection: 'row', gap: 6 },
  catActionBtn: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary + '10',
  },
  catActionBtnDel: { backgroundColor: Colors.error + '10' },

  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },

  previewCard: {
    alignItems: 'center', gap: 10, paddingVertical: 20,
    backgroundColor: Colors.background, borderRadius: 16,
  },
  previewIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  previewName: { fontSize: 18, fontFamily: 'Poppins_700Bold' },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  input: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 14,
    fontFamily: 'Poppins_400Regular', fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
  },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorOption: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorOptionActive: { borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
