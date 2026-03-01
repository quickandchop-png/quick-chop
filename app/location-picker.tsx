import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator,
  Platform, ScrollView, Alert, Linking, Animated, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/colors';
import { savePickedLocation } from '../lib/location-store';
import { isFirebaseEnabled } from '../lib/storage';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function MapPreview({ latitude, longitude }: { latitude: number; longitude: number }) {
  if (Platform.OS === 'web') {
    const zoom = 15;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`;
    return (
      <View style={mapStyles.container}>
        <iframe
          src={src}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
          title="Map Preview"
        />
      </View>
    );
  }

  return (
    <View style={mapStyles.container}>
      <LinearGradient
        colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
        style={mapStyles.nativeMap}
      >
        <View style={mapStyles.gridOverlay}>
          {[...Array(6)].map((_, i) => (
            <View key={`h${i}`} style={[mapStyles.gridLine, mapStyles.horizontal, { top: `${(i + 1) * 14}%` as any }]} />
          ))}
          {[...Array(6)].map((_, i) => (
            <View key={`v${i}`} style={[mapStyles.gridLine, mapStyles.vertical, { left: `${(i + 1) * 14}%` as any }]} />
          ))}
        </View>

        <View style={mapStyles.roadH} />
        <View style={mapStyles.roadV} />

        <View style={mapStyles.pinContainer}>
          <View style={mapStyles.pinShadow} />
          <View style={mapStyles.pinOuter}>
            <Ionicons name="location" size={36} color={Colors.error} />
          </View>
        </View>

        <View style={mapStyles.coordBubble}>
          <Ionicons name="navigate-circle" size={14} color={Colors.primary} />
          <Text style={mapStyles.coordText}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        </View>

        <Pressable
          style={mapStyles.openMapBtn}
          onPress={() => {
            const url = Platform.select({
              ios: `maps:?q=${latitude},${longitude}`,
              android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
              default: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`,
            });
            if (url) Linking.openURL(url);
          }}
        >
          <Ionicons name="map-outline" size={14} color={Colors.primary} />
          <Text style={mapStyles.openMapText}>Open in Maps</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: { width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8F5E9' },
  nativeMap: { flex: 1, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(27,94,32,0.08)' },
  horizontal: { left: 0, right: 0, height: 1 },
  vertical: { top: 0, bottom: 0, width: 1 },
  roadH: { position: 'absolute', left: 0, right: 0, top: '48%', height: 8, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 },
  roadV: { position: 'absolute', top: 0, bottom: 0, left: '48%', width: 8, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 },
  pinContainer: { alignItems: 'center', marginBottom: 8 },
  pinShadow: { width: 20, height: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, marginTop: -6 },
  pinOuter: { marginBottom: -4 },
  coordBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, position: 'absolute', bottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  coordText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.text },
  openMapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, position: 'absolute', bottom: 8, right: 8,
  },
  openMapText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.primary },
});

export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dbSaved, setDbSaved] = useState(false);
  const [firebaseActive] = useState(() => isFirebaseEnabled());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dbSaved) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [dbSaved]);

  async function searchAddress(text: string) {
    if (text.trim().length < 3) { setResults([]); return; }
    setSearching(true);
    try {
      const encoded = encodeURIComponent(text + ', India');
      const res = await fetch(`${NOMINATIM_URL}/search?format=json&q=${encoded}&limit=5&addressdetails=1`, {
        headers: { 'User-Agent': 'QuickAndChop/1.0' },
      });
      const data: SearchResult[] = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    setDbSaved(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(text), 600);
  }

  function selectResult(result: SearchResult) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setSelectedAddress(result.display_name);
    setSelectedCoords({ latitude: parseFloat(result.lat), longitude: parseFloat(result.lon) });
    setResults([]);
    setQuery(result.display_name);
    setDbSaved(false);
  }

  async function handleDetectGPS() {
    setLocating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Please enable location access so we can find your delivery address automatically.',
          [
            { text: 'OK' },
            ...(Platform.OS !== 'web' ? [{ text: 'Open Settings', onPress: () => Linking.openSettings() }] : []),
          ]
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      let addressText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded.length > 0) {
          const r = geocoded[0];
          const parts = [r.name, r.street, r.district, r.subregion, r.city, r.region, r.postalCode]
            .filter(Boolean);
          addressText = parts.join(', ');
        }
      } catch {}

      setSelectedAddress(addressText);
      setSelectedCoords({ latitude, longitude });
      setQuery(addressText);
      setResults([]);
      setDbSaved(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', 'Could not get your location. Please search manually.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    if (!selectedAddress.trim() || !selectedCoords) {
      Alert.alert('No Location', 'Please search for an address or use GPS to pick your delivery location.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    await savePickedLocation({
      address: selectedAddress.trim(),
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      pickedAt: new Date().toISOString(),
    });

    setDbSaved(true);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      router.back();
    }, 1200);
  }

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Pick Delivery Location</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.storageBanner, { backgroundColor: firebaseActive ? Colors.info + '12' : Colors.warning + '12', borderColor: firebaseActive ? Colors.info + '30' : Colors.warning + '30' }]}>
          <Ionicons name={firebaseActive ? 'cloud' : 'phone-portrait'} size={15} color={firebaseActive ? Colors.info : Colors.warning} />
          <Text style={[styles.storageBannerText, { color: firebaseActive ? Colors.info : Colors.warning }]}>
            {firebaseActive
              ? 'Connected to Firebase · Address will be stored in Firestore'
              : 'Offline mode · Address stored on device (add Firebase keys to go live)'}
          </Text>
        </View>

        <View style={styles.searchSection}>
          <Text style={styles.sectionLabel}>Search Address</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Search area, street, city..."
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="search"
                onSubmitEditing={() => searchAddress(query)}
              />
              {searching && <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 10 }} />}
              {query.length > 0 && !searching && (
                <Pressable onPress={() => { setQuery(''); setResults([]); }} style={{ marginRight: 10 }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>

          {results.length > 0 && (
            <View style={styles.resultsBox}>
              {results.map((r, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: Colors.background }, i < results.length - 1 && styles.resultBorder]}
                  onPress={() => selectResult(r)}
                >
                  <Ionicons name="location-outline" size={16} color={Colors.primary} />
                  <Text style={styles.resultText} numberOfLines={2}>{r.display_name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.gpsBtn, pressed && { opacity: 0.85 }]}
          onPress={handleDetectGPS}
          disabled={locating}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.gpsBtnGradient}
          >
            {locating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="locate" size={20} color="#fff" />
            )}
            <Text style={styles.gpsBtnText}>
              {locating ? 'Detecting your location...' : 'Auto-Detect via GPS'}
            </Text>
          </LinearGradient>
        </Pressable>

        {selectedCoords && (
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <Ionicons name="map" size={18} color={Colors.primary} />
              <Text style={styles.previewTitle}>Selected Location</Text>
              {Platform.OS !== 'web' && (
                <View style={styles.osmBadge}>
                  <Text style={styles.osmBadgeText}>OpenStreetMap</Text>
                </View>
              )}
            </View>

            <MapPreview latitude={selectedCoords.latitude} longitude={selectedCoords.longitude} />

            <View style={styles.addressBox}>
              <Ionicons name="home" size={16} color={Colors.primary} />
              <Text style={styles.addressText} numberOfLines={3}>{selectedAddress}</Text>
            </View>

            <View style={styles.coordsRow}>
              <View style={styles.coordChip}>
                <Text style={styles.coordChipLabel}>LAT</Text>
                <Text style={styles.coordChipValue}>{selectedCoords.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordChip}>
                <Text style={styles.coordChipLabel}>LNG</Text>
                <Text style={styles.coordChipValue}>{selectedCoords.longitude.toFixed(6)}</Text>
              </View>
              <View style={[styles.coordChip, { backgroundColor: Colors.primary + '12' }]}>
                <Ionicons name="navigate-circle" size={14} color={Colors.primary} />
                <Text style={[styles.coordChipLabel, { color: Colors.primary }]}>GPS</Text>
              </View>
            </View>
          </View>
        )}

        {dbSaved ? (
          <Animated.View style={[styles.savedBanner, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>Location Saved!</Text>
              <Text style={styles.savedSub}>Returning to cart...</Text>
              <View style={styles.dbBadgeRow}>
                <Ionicons
                  name={firebaseActive ? 'cloud-done' : 'phone-portrait'}
                  size={13}
                  color={firebaseActive ? Colors.info : Colors.textSecondary}
                />
                <Text style={[styles.dbBadgeText, { color: firebaseActive ? Colors.info : Colors.textSecondary }]}>
                  {firebaseActive ? 'Stored in Firebase Firestore' : 'Stored in Device Storage (AsyncStorage)'}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          selectedCoords && (
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={handleSave}
              disabled={saving || !selectedCoords}
            >
              <LinearGradient
                colors={[Colors.accent, Colors.accentLight]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.saveBtnGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Delivery Address</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )
        )}

        {!selectedCoords && (
          <View style={styles.emptyHint}>
            <Ionicons name="map-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyHintTitle}>No location selected</Text>
            <Text style={styles.emptyHintSub}>Search for your area or tap GPS to auto-detect your delivery address</Text>
          </View>
        )}

        <View style={styles.poweredRow}>
          <Ionicons name="globe-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.poweredText}>Address search powered by OpenStreetMap Nominatim · No API key required</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: Colors.text },

  sectionLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: Colors.text, marginBottom: 8 },
  searchSection: { marginBottom: 4 },
  searchRow: { gap: 8 },
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
  },
  searchIcon: { paddingLeft: 14 },
  searchInput: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 10,
    fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.text,
  },
  resultsBox: {
    marginTop: 6, backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6,
  },
  resultItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  resultBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  resultText: { flex: 1, fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.text, lineHeight: 19 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },

  gpsBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  gpsBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  gpsBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  previewSection: { gap: 12, marginBottom: 16 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text, flex: 1 },
  osmBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  osmBadgeText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.primary },

  addressBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  addressText: { flex: 1, fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text, lineHeight: 20 },

  coordsRow: { flexDirection: 'row', gap: 8 },
  coordChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  coordChipLabel: { fontSize: 9, fontFamily: 'Poppins_700Bold', color: Colors.textTertiary, letterSpacing: 0.5 },
  coordChipValue: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.text },

  savedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#E8F5E9', borderRadius: 16, padding: 18, marginBottom: 16,
    borderWidth: 1.5, borderColor: Colors.success + '40',
  },
  savedTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: Colors.success },
  savedSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginTop: 2 },

  saveBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 16 },
  saveBtnText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },

  emptyHint: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyHintTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary },
  emptyHintSub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  poweredRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 8 },
  poweredText: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, textAlign: 'center', flex: 1 },
  dbBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  dbBadgeText: { fontSize: 11, fontFamily: 'Poppins_500Medium' },
  storageBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1,
  },
  storageBannerText: { fontSize: 12, fontFamily: 'Poppins_500Medium', flex: 1, lineHeight: 17 },
});
