import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Dimensions,
  FlatList, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeContent, getProducts, HomeContent, Product, addToCart, getCustomerPrice } from '@/lib/storage';
import CustomerAuthModal from '@/components/CustomerAuthModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateProductName } from '@/lib/i18n';
import { useVideoPlayer, VideoView } from 'expo-video';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;

function BannerSlider({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  return (
    <View style={styles.bannerSection}>
      <Text style={styles.sectionTitle}>Daily Specials</Text>
      <FlatList
        data={images}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `banner-${i}`}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        renderItem={({ item }) => (
          <View style={styles.bannerCard}>
            <Image source={{ uri: item }} style={styles.bannerImage} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.bannerOverlay}
            >
              <Text style={styles.bannerText}>Special Offer</Text>
              <Text style={styles.bannerSubText}>Up to 30% off today</Text>
            </LinearGradient>
          </View>
        )}
      />
    </View>
  );
}

function VideoSection({ videoUrl }: { videoUrl: string }) {
  const [showVideo, setShowVideo] = useState(false);
  const safeUrl = videoUrl.trim();
  const player = useVideoPlayer(safeUrl, (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.videoSection}>
      <Text style={styles.sectionTitle}>See How It Works</Text>
      {showVideo ? (
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.videoPlayer}
            allowsFullscreen
            allowsPictureInPicture
          />
        </View>
      ) : (
        <Pressable
          style={styles.videoThumbnail}
          onPress={() => { setShowVideo(true); player.play(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <LinearGradient colors={[Colors.primaryDark + 'DD', Colors.primary + 'AA']} style={styles.videoOverlay}>
            <View style={styles.playBtn}>
              <Ionicons name="play" size={32} color="#fff" />
            </View>
            <Text style={styles.videoLabel}>Watch Video</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

function CategoryCard({ title, icon, color, onPress }: { title: string; icon: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.categoryCard, pressed && { transform: [{ scale: 0.96 }] }]} onPress={onPress}>
      <LinearGradient colors={[color, color + 'CC']} style={styles.categoryGradient}>
        <MaterialCommunityIcons name={icon as any} size={32} color="#fff" />
        <Text style={styles.categoryText}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function ProductCard({ product, onAuthRequired }: { product: Product; onAuthRequired: (cb: () => void) => void }) {
  const [adding, setAdding] = useState(false);
  const { isGuest } = useAuth();
  const { language } = useLanguage();

  async function handleAdd() {
    if (isGuest) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAuthRequired(async () => {
        setAdding(true);
        await addToCart(product, 1);
        setTimeout(() => setAdding(false), 500);
      });
      return;
    }
    setAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addToCart(product, 1);
    setAdding(false);
  }

  return (
    <View style={styles.productCard}>
      <Image source={{ uri: product.image }} style={styles.productImage} contentFit="cover" />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{translateProductName(product.name, language)}</Text>
        <Text style={styles.productUnit}>{product.unit}</Text>
        <View style={styles.productBottom}>
          <Text style={styles.productPrice}>Rs.{getCustomerPrice(product.price)}</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={handleAdd}
            disabled={adding}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const [content, setContent] = useState<HomeContent | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  function handleAuthRequired(callback: () => void) {
    setPendingAction(() => callback);
    setShowAuthModal(true);
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    if (pendingAction) { pendingAction(); setPendingAction(null); }
  }

  const loadData = useCallback(async () => {
    const [c, p] = await Promise.all([getHomeContent(), getProducts()]);
    setContent(c);
    setProducts(p);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const topProducts = products.filter(p => p.price > 0).slice(0, 6);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={[styles.topHeader, { paddingTop: insets.top + webTopPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'Guest'}</Text>
            <Text style={styles.headerSub}>What would you like today?</Text>
          </View>
          <View style={styles.logoSmall}>
            <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 34, height: 34 }} contentFit="contain" />
          </View>
        </View>
      </LinearGradient>

      {content?.videoUrl?.trim() ? <VideoSection videoUrl={content.videoUrl.trim()} /> : null}

      <BannerSlider images={content?.bannerImages || []} />

      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <View style={styles.categoryGrid}>
          <CategoryCard
            title="Fresh Vegetables"
            icon="leaf"
            color="#2E7D32"
            onPress={() => { router.push({ pathname: '/(customer)/browse', params: { category: 'vegetables' } }); }}
          />
          <CategoryCard
            title="Stationery Store"
            icon="pencil-ruler"
            color="#1565C0"
            onPress={() => { router.push({ pathname: '/(customer)/browse', params: { category: 'stationery' } }); }}
          />
        </View>
      </View>

      <View style={styles.popularSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Items</Text>
          <Pressable onPress={() => router.push('/(customer)/browse')}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <FlatList
          data={topProducts}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          scrollEnabled={!!topProducts.length}
          renderItem={({ item }) => <ProductCard product={item} onAuthRequired={handleAuthRequired} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No products available</Text>
            </View>
          }
        />
      </View>

      <View style={{ height: 100 + (Platform.OS === 'web' ? 34 : insets.bottom) }} />
    </ScrollView>

    <CustomerAuthModal
      visible={showAuthModal}
      onClose={() => { setShowAuthModal(false); setPendingAction(null); }}
      onSuccess={handleAuthSuccess}
      initialStep="register"
    />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  topHeader: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff' },
  headerSub: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  logoSmall: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  videoSection: { marginTop: 20, paddingHorizontal: 0 },
  sectionTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text, marginBottom: 14, paddingHorizontal: 20 },
  videoContainer: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', height: 200, backgroundColor: '#000' },
  videoPlayer: { width: '100%', height: 200 },
  videoThumbnail: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', height: 180, backgroundColor: Colors.primaryDark },
  videoOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  videoLabel: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  bannerSection: { marginTop: 24 },
  bannerCard: { width: CARD_WIDTH, height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.border },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  bannerText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },
  bannerSubText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)' },
  categoriesSection: { marginTop: 24 },
  categoryGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 14 },
  categoryCard: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  categoryGradient: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  categoryText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  popularSection: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  seeAll: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  productCard: { width: 150, backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden', shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  productImage: { width: '100%', height: 110 },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  productUnit: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  productPrice: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  addBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  emptyState: { width: width - 40, alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
});
