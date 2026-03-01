import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Linking,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { getDeliveryLocation, DeliveryLocation } from '../../lib/tracking';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function WebMapView({ lat, lng, destLat, destLng }: {
  lat: number; lng: number; destLat?: number; destLng?: number;
}) {
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <View style={styles.mapContainer}>
      <iframe
        src={mapUrl}
        style={{ border: 'none', width: '100%', height: '100%', borderRadius: 0 }}
        title="Delivery Tracking Map"
      />
      <View style={styles.mapOverlay}>
        <View style={styles.mapPulse}>
          <View style={styles.mapPulseInner} />
        </View>
        <Text style={styles.mapLabel}>Delivery Partner</Text>
      </View>
    </View>
  );
}

function NativeMapPlaceholder({ lat, lng, destLat, destLng }: {
  lat: number; lng: number; destLat?: number; destLng?: number;
}) {
  const dist = destLat && destLng ? haversineDistance(lat, lng, destLat, destLng) : null;

  function openMaps() {
    const url = Platform.select({
      ios: `maps:?saddr=${lat},${lng}&daddr=${destLat},${destLng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}`,
    });
    if (url) Linking.openURL(url);
  }

  return (
    <View style={styles.nativeMapContainer}>
      <View style={styles.nativeMapBg}>
        <View style={styles.gridLines}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={`h${i}`} style={[styles.gridLine, styles.gridLineH, { top: `${i * 20}%` }]} />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={`v${i}`} style={[styles.gridLine, styles.gridLineV, { left: `${i * 20}%` }]} />
          ))}
        </View>
        <View style={styles.deliveryPinContainer}>
          <View style={styles.deliveryPin}>
            <Ionicons name="bicycle" size={22} color="#fff" />
          </View>
          <View style={styles.deliveryPinShadow} />
        </View>
        {destLat && destLng && (
          <View style={styles.destPinContainer}>
            <Ionicons name="home" size={20} color={Colors.error} />
          </View>
        )}
      </View>
      <View style={styles.coordRow}>
        <Ionicons name="location" size={14} color={Colors.textSecondary} />
        <Text style={styles.coordText}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
        <Pressable style={styles.openMapsBtn} onPress={openMaps}>
          <Ionicons name="open-outline" size={14} color={Colors.primary} />
          <Text style={styles.openMapsBtnText}>Open Maps</Text>
        </Pressable>
      </View>
      {dist !== null && (
        <View style={styles.distRow}>
          <Ionicons name="navigate" size={14} color={Colors.accent} />
          <Text style={styles.distText}>
            {dist < 1
              ? `${Math.round(dist * 1000)} m away from delivery address`
              : `${dist.toFixed(1)} km away from delivery address`}
          </Text>
        </View>
      )}
    </View>
  );
}

const POLL_INTERVAL = 7000;

export default function TrackOrderScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    orderId: string;
    deliveryBoyId: string;
    deliveryBoyName: string;
    customerAddress: string;
    lat: string;
    lng: string;
  }>();

  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const destLat = params.lat ? parseFloat(params.lat) : undefined;
  const destLng = params.lng ? parseFloat(params.lng) : undefined;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const fetchLocation = useCallback(async () => {
    if (!params.deliveryBoyId) {
      setLoading(false);
      return;
    }
    const loc = await getDeliveryLocation(params.deliveryBoyId);
    setLocation(loc);
    if (loc) setLastUpdated(new Date());
    setLoading(false);
    setPollCount(c => c + 1);
  }, [params.deliveryBoyId]);

  useEffect(() => {
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLocation]);

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <Text style={styles.headerSub}>Order #{params.orderId?.slice(0, 8)}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={fetchLocation}>
          <Ionicons name="refresh" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Locating delivery partner...</Text>
          </View>
        ) : !location ? (
          <View style={styles.noLocationContainer}>
            <View style={styles.noLocationIcon}>
              <Ionicons name="bicycle" size={48} color={Colors.textTertiary} />
            </View>
            <Text style={styles.noLocationTitle}>Location Not Available</Text>
            <Text style={styles.noLocationDesc}>
              {params.deliveryBoyName} hasn't started sharing their location yet.
              {'\n'}This screen auto-refreshes every 7 seconds.
            </Text>
            <View style={styles.waitingDots}>
              {[0, 1, 2].map(i => (
                <Animated.View
                  key={i}
                  style={[styles.dot, {
                    transform: [{ scale: i === pollCount % 3 ? pulseAnim : 1 }],
                    backgroundColor: i === pollCount % 3 ? Colors.primary : Colors.border,
                  }]}
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            {Platform.OS === 'web' ? (
              <WebMapView
                lat={location.latitude}
                lng={location.longitude}
                destLat={destLat}
                destLng={destLng}
              />
            ) : (
              <NativeMapPlaceholder
                lat={location.latitude}
                lng={location.longitude}
                destLat={destLat}
                destLng={destLng}
              />
            )}
          </>
        )}

        <View style={styles.infoPanel}>
          <View style={styles.deliveryBoyCard}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={22} color={Colors.primary} />
            </View>
            <View style={styles.deliveryBoyInfo}>
              <Text style={styles.deliveryBoyName}>{params.deliveryBoyName || 'Delivery Partner'}</Text>
              <View style={styles.liveRow}>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.liveText}>
                  {location ? 'Broadcasting live location' : 'Awaiting location...'}
                </Text>
              </View>
            </View>
            <View style={[styles.signalBadge, !location && styles.signalBadgeWaiting]}>
              <Ionicons name={location ? 'wifi' : 'wifi-outline'} size={14} color={location ? Colors.success : Colors.textTertiary} />
            </View>
          </View>

          {params.customerAddress && (
            <View style={styles.addressCard}>
              <Ionicons name="home" size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>Delivering to</Text>
                <Text style={styles.addressValue} numberOfLines={2}>{params.customerAddress}</Text>
              </View>
            </View>
          )}

          {lastUpdated && (
            <View style={styles.updateRow}>
              <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.updateText}>
                Updated {lastUpdated.toLocaleTimeString()} · refreshes every 7s
              </Text>
            </View>
          )}

          {location && destLat && destLng && (
            <View style={styles.distanceCard}>
              <Ionicons name="navigate" size={18} color={Colors.accent} />
              <View>
                <Text style={styles.distanceValue}>
                  {(() => {
                    const d = haversineDistance(location.latitude, location.longitude, destLat, destLng);
                    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
                  })()}
                </Text>
                <Text style={styles.distanceLabel}>from your location</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  headerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },

  content: { flex: 1 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },

  noLocationContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  noLocationIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, marginBottom: 8 },
  noLocationTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: Colors.text },
  noLocationDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  waitingDots: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  mapContainer: { height: SCREEN_H * 0.38, backgroundColor: Colors.border, position: 'relative' },
  mapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.9)', flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  mapPulse: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary + '30', justifyContent: 'center', alignItems: 'center' },
  mapPulseInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  mapLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: Colors.text },

  nativeMapContainer: { height: SCREEN_H * 0.35, margin: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  nativeMapBg: { flex: 1, backgroundColor: '#E8F0E8', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  gridLines: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.06)' },
  gridLineH: { left: 0, right: 0, height: 1 },
  gridLineV: { top: 0, bottom: 0, width: 1 },
  deliveryPinContainer: { alignItems: 'center' },
  deliveryPin: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  deliveryPinShadow: { width: 20, height: 8, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, marginTop: 4 },
  destPinContainer: { position: 'absolute', bottom: '20%', right: '25%' },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  coordText: { flex: 1, fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  openMapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openMapsBtnText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 8, backgroundColor: Colors.surface },
  distText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: Colors.textSecondary },

  infoPanel: { padding: 16, gap: 10 },
  deliveryBoyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  avatarCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  deliveryBoyInfo: { flex: 1 },
  deliveryBoyName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  signalBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.success + '15', justifyContent: 'center', alignItems: 'center' },
  signalBadgeWaiting: { backgroundColor: Colors.border },

  addressCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  addressLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  addressValue: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: Colors.text, marginTop: 2 },

  updateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  updateText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },

  distanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.accent + '10', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.accent + '25' },
  distanceValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: Colors.text },
  distanceLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
});
